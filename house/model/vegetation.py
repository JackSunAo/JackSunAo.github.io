"""Realistic vegetation: Poly Haven scanned plants instanced with geometry nodes, plus procedural
plants for species Poly Haven doesn't have (agave, ornamental grasses, lavender / salvia spikes,
coneflower, iris). Instancing keeps one copy of each plant in memory however many are placed.
"""
import math
import os
import random

import bmesh
import bpy
from mathutils import Matrix, Vector

import assets

LIB_ROOT = None
_LIB = {}


# ---------------------------------------------------------------- asset library
def _lib_root():
    global LIB_ROOT
    if LIB_ROOT is None:
        LIB_ROOT = bpy.data.collections.new("PlantLibrary")
        bpy.context.scene.collection.children.link(LIB_ROOT)
        bpy.context.view_layer.layer_collection.children[LIB_ROOT.name].exclude = True
    return LIB_ROOT


def _fix_images(folder):
    for img in bpy.data.images:
        if img.source != "FILE" or not img.filepath:
            continue
        p = bpy.path.abspath(img.filepath)
        if not os.path.exists(p):
            cand = os.path.join(folder, "textures", os.path.basename(img.filepath))
            if os.path.exists(cand):
                img.filepath = cand


def load(aid, pick, name=None, res="1k"):
    """Append the objects of a Poly Haven model whose names pass `pick(name)` into an excluded
    collection; returns that collection (children are the instance variants)."""
    key = name or aid
    if key in _LIB:
        return _LIB[key]
    path = assets.model(aid, res)
    with bpy.data.libraries.load(path, link=False) as (src, dst):
        dst.objects = [n for n in src.objects if pick(n)]
    coll = bpy.data.collections.new("LIB_" + key)
    _lib_root().children.link(coll)
    for o in dst.objects:
        if o is None or o.type not in ("MESH", "CURVE"):
            continue
        o.parent = None
        o.location = (0, 0, 0)
        o.rotation_euler = (0, 0, 0)
        coll.objects.link(o)
    _fix_images(os.path.dirname(path))
    _LIB[key] = coll
    return coll


def proto_collection(name, objs):
    coll = bpy.data.collections.new("LIB_" + name)
    _lib_root().children.link(coll)
    for o in objs:
        coll.objects.link(o)
    _LIB[name] = coll
    return coll


# ---------------------------------------------------------------- instancer
def _instancer_group(coll):
    name = "GN_" + coll.name
    if name in bpy.data.node_groups:
        return bpy.data.node_groups[name]
    ng = bpy.data.node_groups.new(name, "GeometryNodeTree")
    ng.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    ng.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    n, l = ng.nodes, ng.links
    gi, go = n.new("NodeGroupInput"), n.new("NodeGroupOutput")
    ci = n.new("GeometryNodeCollectionInfo")
    ci.transform_space = "ORIGINAL"
    ci.inputs["Collection"].default_value = coll
    ci.inputs["Separate Children"].default_value = True
    ci.inputs["Reset Children"].default_value = True
    iop = n.new("GeometryNodeInstanceOnPoints")
    iop.inputs["Pick Instance"].default_value = True

    def attr(nm, dt):
        a = n.new("GeometryNodeInputNamedAttribute")
        a.data_type = dt
        a.inputs["Name"].default_value = nm
        return a
    rot, scl, var = attr("rot", "FLOAT_VECTOR"), attr("scl", "FLOAT_VECTOR"), attr("var", "INT")
    l.new(gi.outputs[0], iop.inputs["Points"])
    l.new(ci.outputs[0], iop.inputs["Instance"])
    l.new(var.outputs["Attribute"], iop.inputs["Instance Index"])
    l.new(rot.outputs["Attribute"], iop.inputs["Rotation"])
    l.new(scl.outputs["Attribute"], iop.inputs["Scale"])
    l.new(iop.outputs[0], go.inputs[0])
    return ng


def scatter(name, coll, points, parent_coll, seed=1, scale=(0.8, 1.2), tilt=0.0, variants=None, yaw=True):
    """points: [(x, y, z)] or [(x, y, z, s)] (s = explicit uniform scale)."""
    if not points:
        return None
    rnd = random.Random(seed)
    nvar = len(coll.objects)
    me = bpy.data.meshes.new(name)
    me.vertices.add(len(points))
    co, rot, scl, var = [], [], [], []
    for p in points:
        co += p[:3]
        s = p[3] if len(p) > 3 else rnd.uniform(*scale)
        rot += [rnd.uniform(-tilt, tilt), rnd.uniform(-tilt, tilt), rnd.uniform(0, 2 * math.pi) if yaw else 0.0]
        scl += [s, s, s * rnd.uniform(0.9, 1.1)]
        var.append(rnd.choice(variants) if variants else rnd.randrange(nvar))
    me.vertices.foreach_set("co", co)
    a = me.attributes.new("rot", "FLOAT_VECTOR", "POINT"); a.data.foreach_set("vector", rot)
    a = me.attributes.new("scl", "FLOAT_VECTOR", "POINT"); a.data.foreach_set("vector", scl)
    a = me.attributes.new("var", "INT", "POINT"); a.data.foreach_set("value", var)
    o = bpy.data.objects.new(name, me)
    parent_coll.objects.link(o)
    mod = o.modifiers.new("scatter", "NODES")
    mod.node_group = _instancer_group(coll)
    return o


# ---------------------------------------------------------------- sampling helpers
def in_poly(x, y, poly):
    inside = False
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            inside = not inside
    return inside


def sample_poly(poly, density, rnd, keep=lambda x, y: True, min_dist=0.0):
    xs, ys = [p[0] for p in poly], [p[1] for p in poly]
    x1, x2, y1, y2 = min(xs), max(xs), min(ys), max(ys)
    n = int((x2 - x1) * (y2 - y1) * density)
    pts = []
    grid = {}
    cell = max(min_dist, 1e-3)
    for _ in range(n):
        x, y = rnd.uniform(x1, x2), rnd.uniform(y1, y2)
        if not in_poly(x, y, poly) or not keep(x, y):
            continue
        if min_dist > 0:
            gx, gy = int(x / cell), int(y / cell)
            if any((x - px) ** 2 + (y - py) ** 2 < min_dist ** 2
                   for i in (-1, 0, 1) for j in (-1, 0, 1) for (px, py) in grid.get((gx + i, gy + j), ())):
                continue
            grid.setdefault((gx, gy), []).append((x, y))
        pts.append((x, y))
    return pts


def dist_to_polyline(x, y, pts):
    best = 1e9
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        dx, dy = bx - ax, by - ay
        t = max(0.0, min(1.0, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy + 1e-12)))
        best = min(best, math.hypot(x - ax - t * dx, y - ay - t * dy))
    return best


# ---------------------------------------------------------------- procedural plants
def _mat(name, base, rough=0.5, sss=0.0, var=0.15, alpha=None, sheen=0.0):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    ob = nt.nodes.new("ShaderNodeObjectInfo")
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 3.0
    nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    r, g, b = [int(base[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    lin = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    c0 = [lin(c) * (1 - var) for c in (r, g, b)]
    c1 = [min(1, lin(c) * (1 + var)) for c in (r, g, b)]
    ramp.color_ramp.elements[0].color = (*c0, 1)
    ramp.color_ramp.elements[1].color = (*c1, 1)
    mix = nt.nodes.new("ShaderNodeMath")
    mix.operation = "ADD"
    nt.links.new(nz.outputs["Fac"], mix.inputs[0])
    rnd = nt.nodes.new("ShaderNodeMath")
    rnd.operation = "MULTIPLY"
    rnd.inputs[1].default_value = 0.6
    nt.links.new(ob.outputs["Random"], rnd.inputs[0])
    nt.links.new(rnd.outputs[0], mix.inputs[1])
    half = nt.nodes.new("ShaderNodeMath")
    half.operation = "MULTIPLY"
    half.inputs[1].default_value = 0.62
    nt.links.new(mix.outputs[0], half.inputs[0])
    nt.links.new(half.outputs[0], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], p.inputs["Base Color"])
    p.inputs["Roughness"].default_value = rough
    if sss:
        p.inputs["Subsurface Weight"].default_value = sss
        p.inputs["Subsurface Radius"].default_value = (0.2, 0.3, 0.1)
        p.inputs["Subsurface Scale"].default_value = 0.01
    if sheen:
        p.inputs["Sheen Weight"].default_value = sheen
    if alpha is not None:
        p.inputs["Alpha"].default_value = alpha
    return m


def _mesh_obj(name, bm, mats):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for poly in me.polygons:
        poly.use_smooth = True
    o = bpy.data.objects.new(name, me)
    for m in mats:
        o.data.materials.append(m)
    return o


def agave(name, seed, radius=0.75, n_leaves=34):
    """Agave ovatifolia: broad cupped blue-grey leaves in a golden-angle rosette, dark terminal spines."""
    rnd = random.Random(seed)
    leaf_m = _mat("AgaveLeaf", "#8fae9f", 0.42, sss=0.08, var=0.12, sheen=0.25)
    spine_m = _mat("AgaveSpine", "#3a2a1e", 0.5, var=0.05)
    bm = bmesh.new()
    golden = math.pi * (3 - math.sqrt(5))
    segs = 9
    for k in range(n_leaves):
        f = k / n_leaves                       # 0 = outer, 1 = inner
        az = k * golden + rnd.uniform(-0.05, 0.05)
        L = radius * (1.05 - 0.55 * f) * rnd.uniform(0.92, 1.08)
        W = L * 0.36
        elev = math.radians(14 + 62 * f ** 0.8)
        droop = 0.18 * (1 - f)
        dirv = Vector((math.cos(az), math.sin(az), 0))
        side = Vector((-math.sin(az), math.cos(az), 0))
        rows = []
        for i in range(segs + 1):
            s = i / segs
            reach = s * L * math.cos(elev)
            z = s * L * math.sin(elev) - droop * L * s * s + 0.02
            c = dirv * reach + Vector((0, 0, z))
            w = W * (math.sin(math.pi * min(1.0, 0.18 + s * 0.95)) ** 0.9) * (1 - s) ** 0.25
            cup = 0.28 * w
            rows.append([bm.verts.new(c - side * w / 2 + Vector((0, 0, cup))),
                         bm.verts.new(c - side * w / 4 + Vector((0, 0, cup * 0.35))),
                         bm.verts.new(c),
                         bm.verts.new(c + side * w / 4 + Vector((0, 0, cup * 0.35))),
                         bm.verts.new(c + side * w / 2 + Vector((0, 0, cup)))])
        for i in range(segs):
            for j in range(4):
                bm.faces.new((rows[i][j], rows[i][j + 1], rows[i + 1][j + 1], rows[i + 1][j]))
        tip = dirv * (L * math.cos(elev)) + Vector((0, 0, L * math.sin(elev) - droop * L + 0.02))
        tipdir = (tip - (dirv * (0.9 * L * math.cos(elev)) + Vector((0, 0, 0.9 * L * math.sin(elev) - droop * L * 0.81 + 0.02)))).normalized()
        sp = bmesh.ops.create_cone(bm, cap_ends=True, segments=5, radius1=0.012, radius2=0.0, depth=0.07)
        q = tipdir.to_track_quat("Z", "Y")
        mtx = Matrix.Translation(tip + tipdir * 0.03) @ q.to_matrix().to_4x4()
        bmesh.ops.transform(bm, matrix=mtx, verts=sp["verts"])
        for fc in {f for v in sp["verts"] for f in v.link_faces}:
            fc.material_index = 1
    return _mesh_obj(name, bm, [leaf_m, spine_m])


def grass_clump(name, seed, height=0.9, blades=220, spread=0.35, color="#a9b48a", plume=None, plume_n=420, width=0.009):
    """Fountain-shaped ornamental grass; optional airy plume (muhly pink haze)."""
    rnd = random.Random(seed)
    blade_m = _mat(f"Grass_{color}", color, 0.55, sss=0.15, var=0.2)
    mats = [blade_m]
    bm = bmesh.new()
    segs = 6
    for b in range(blades):
        az = rnd.uniform(0, 2 * math.pi)
        lean = rnd.uniform(0.05, 0.9) * (rnd.random() ** 0.5)
        L = height * rnd.uniform(0.6, 1.15)
        w = width * rnd.uniform(0.7, 1.3)
        base = Vector((math.cos(az), math.sin(az), 0)) * rnd.uniform(0, 0.06)
        d = Vector((math.cos(az), math.sin(az), 0))
        side = Vector((-math.sin(az), math.cos(az), 0))
        rows = []
        for i in range(segs + 1):
            s = i / segs
            ang = lean * (0.3 + 1.2 * s)            # bends over toward the tip
            p = base + d * (spread * L * math.sin(ang) * s) + Vector((0, 0, L * s * math.cos(ang * 0.8)))
            ww = w * (1 - s) ** 0.8 + 0.0005
            rows.append((bm.verts.new(p - side * ww), bm.verts.new(p + side * ww)))
        for i in range(segs):
            bm.faces.new((rows[i][0], rows[i][1], rows[i + 1][1], rows[i + 1][0]))
    if plume:
        pm = _mat(f"Plume_{plume}", plume, 0.7, sss=0.3, var=0.15, alpha=0.75)
        mats.append(pm)
        for k in range(plume_n):
            az = rnd.uniform(0, 2 * math.pi)
            r = rnd.uniform(0.0, spread * height * 0.9)
            c = Vector((math.cos(az) * r, math.sin(az) * r, height * rnd.uniform(0.7, 1.25)))
            dd = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(0.2, 1))).normalized() * rnd.uniform(0.05, 0.14)
            side = dd.cross(Vector((0, 0, 1))).normalized() * 0.0012
            v = [bm.verts.new(c - side), bm.verts.new(c + side), bm.verts.new(c + dd + side), bm.verts.new(c + dd - side)]
            f = bm.faces.new(v)
            f.material_index = 1
    return _mesh_obj(name, bm, mats)


def spike_plant(name, seed, height=0.6, stems=45, flower="#8f6fd0", leaf="#7d8f74", spike_len=0.2, spread=0.25):
    """Lavender / salvia / Russian sage: leafy mound with upright flower spikes."""
    rnd = random.Random(seed)
    lm = _mat(f"Leaf_{leaf}", leaf, 0.6, sss=0.1, var=0.15)
    fm = _mat(f"Bloom_{flower}", flower, 0.55, sss=0.25, var=0.18)
    bm = bmesh.new()
    for k in range(stems):
        az = rnd.uniform(0, 2 * math.pi)
        r = rnd.uniform(0, spread) * rnd.random() ** 0.5
        top = Vector((math.cos(az) * r * 1.6, math.sin(az) * r * 1.6, height * rnd.uniform(0.75, 1.1)))
        base = Vector((math.cos(az) * r * 0.3, math.sin(az) * r * 0.3, 0))
        st = bmesh.ops.create_cone(bm, segments=4, radius1=0.004, radius2=0.002, depth=(top - base).length)
        dvec = (top - base).normalized()
        mtx = Matrix.Translation((top + base) / 2) @ dvec.to_track_quat("Z", "Y").to_matrix().to_4x4()
        bmesh.ops.transform(bm, matrix=mtx, verts=st["verts"])
        # florets along the top of the stem
        nfl = 14
        for i in range(nfl):
            s = 1 - (i / nfl) * (spike_len / max(0.01, (top - base).length))
            p = base + (top - base) * s
            rr = 0.014 * (1 - i / nfl * 0.4)
            fl = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=rr)
            bmesh.ops.transform(bm, matrix=Matrix.Translation(p + Vector((rnd.uniform(-.006, .006), rnd.uniform(-.006, .006), 0))), verts=fl["verts"])
            for f in {f for v in fl["verts"] for f in v.link_faces}:
                f.material_index = 1
    # foliage mound
    for k in range(int(stems * 1.2)):
        az = rnd.uniform(0, 2 * math.pi)
        r = rnd.uniform(0, spread * 1.1)
        p = Vector((math.cos(az) * r, math.sin(az) * r, rnd.uniform(0.03, height * 0.45)))
        lf = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=rnd.uniform(0.03, 0.06))
        bmesh.ops.scale(bm, vec=(1, 0.5, 0.35), verts=lf["verts"])
        bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Matrix.Rotation(rnd.uniform(0, 6.28), 3, "Z"), verts=lf["verts"])
        bmesh.ops.translate(bm, vec=p, verts=lf["verts"])
    return _mesh_obj(name, bm, [lm, fm])


def daisy_plant(name, seed, height=0.7, heads=14, petal="#d77fb0", center="#7a4a1e", leaf="#4f7238", spread=0.22, petal_len=0.045, droop=0.5):
    """Coneflower / black-eyed Susan / gaillardia: stems with daisy heads."""
    rnd = random.Random(seed)
    lm = _mat(f"Leaf_{leaf}", leaf, 0.6, sss=0.1, var=0.15)
    pm = _mat(f"Petal_{petal}", petal, 0.5, sss=0.35, var=0.12)
    cm = _mat(f"Disk_{center}", center, 0.7, var=0.1)
    bm = bmesh.new()
    for k in range(heads):
        az = rnd.uniform(0, 2 * math.pi)
        r = rnd.uniform(0, spread)
        top = Vector((math.cos(az) * r, math.sin(az) * r, height * rnd.uniform(0.7, 1.05)))
        st = bmesh.ops.create_cone(bm, segments=4, radius1=0.004, radius2=0.003, depth=top.z)
        bmesh.ops.transform(bm, matrix=Matrix.Translation(Vector((top.x * 0.6, top.y * 0.6, top.z / 2))), verts=st["verts"])
        disk = bmesh.ops.create_icosphere(bm, subdivisions=2, radius=0.016)
        bmesh.ops.scale(bm, vec=(1, 1, 0.8), verts=disk["verts"])
        bmesh.ops.translate(bm, vec=top + Vector((0, 0, 0.008)), verts=disk["verts"])
        for f in {f for v in disk["verts"] for f in v.link_faces}:
            f.material_index = 2
        npet = 14
        for i in range(npet):
            a = i / npet * 2 * math.pi + rnd.uniform(-0.1, 0.1)
            d = Vector((math.cos(a), math.sin(a), -droop * 0.6))
            d.normalize()
            side = Vector((-math.sin(a), math.cos(a), 0)) * 0.006
            p0 = top + d * 0.012
            p1 = top + d * (0.012 + petal_len)
            v = [bm.verts.new(p0 - side), bm.verts.new(p0 + side), bm.verts.new(p1 + side * 0.6), bm.verts.new(p1 - side * 0.6)]
            f = bm.faces.new(v)
            f.material_index = 1
    for k in range(heads * 3):
        az = rnd.uniform(0, 2 * math.pi)
        r = rnd.uniform(0, spread)
        p = Vector((math.cos(az) * r, math.sin(az) * r, rnd.uniform(0.04, height * 0.4)))
        lf = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=rnd.uniform(0.04, 0.07))
        bmesh.ops.scale(bm, vec=(1, 0.4, 0.25), verts=lf["verts"])
        bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Matrix.Rotation(rnd.uniform(0, 6.28), 3, "Z"), verts=lf["verts"])
        bmesh.ops.translate(bm, vec=p, verts=lf["verts"])
    return _mesh_obj(name, bm, [lm, pm, cm])


def tweak_material(mat, hue=0.5, sat=1.0, val=1.0):
    """Insert a Hue/Saturation step between a material's base-colour texture and its BSDF."""
    if mat is None or not mat.use_nodes or mat.get("_tweaked"):
        return
    nt = mat.node_tree
    for node in nt.nodes:
        if node.type == "BSDF_PRINCIPLED":
            sock = node.inputs["Base Color"]
            if not sock.links:
                continue
            src = sock.links[0].from_socket
            hs = nt.nodes.new("ShaderNodeHueSaturation")
            hs.inputs["Hue"].default_value = hue
            hs.inputs["Saturation"].default_value = sat
            hs.inputs["Value"].default_value = val
            nt.links.new(src, hs.inputs["Color"])
            nt.links.new(hs.outputs["Color"], sock)
    mat["_tweaked"] = 1


def coll_materials(coll):
    out = []
    for o in coll.objects:
        for m in o.data.materials:
            if m and m not in out:
                out.append(m)
    return out


def cone_core(name, x, y, z, r, h, coll, segs=24):
    """Topiary core (pointed cone); leaves are scattered over it afterwards."""
    bmm = bmesh.new()
    bmesh.ops.create_cone(bmm, cap_ends=True, segments=segs, radius1=r, radius2=0.02, depth=h)
    bmesh.ops.translate(bmm, vec=(x, y, z + h / 2), verts=bmm.verts[:])
    me = bpy.data.meshes.new(name)
    bmm.to_mesh(me)
    bmm.free()
    o = bpy.data.objects.new(name, me)
    o.data.materials.append(_mat("HedgeCore", "#1f3a16", 0.9, var=0.1))
    coll.objects.link(o)
    return o


def bloom_bush(name, seed, radius=0.45, height=0.8, n_leaf=160, n_bloom=24, bloom="#d9476b", bloom_r=0.035,
               leaf="#3f6b2a", petals=True, ball=False):
    """Rose / hydrangea style shrub: leafy mound with blooms on the surface (cupped roses or flower balls)."""
    rnd = random.Random(seed)
    lm = _mat(f"Leaf_{leaf}", leaf, 0.55, sss=0.12, var=0.18)
    bmat = _mat(f"Bloom_{bloom}", bloom, 0.5, sss=0.35, var=0.15)
    bmm = bmesh.new()
    for k in range(n_leaf):
        u, v = rnd.uniform(0, 2 * math.pi), rnd.uniform(0.05, 1.0)
        r = radius * math.sqrt(v) * rnd.uniform(0.75, 1.05)
        p = Vector((math.cos(u) * r, math.sin(u) * r, height * (0.15 + 0.85 * math.sqrt(max(0.0, 1 - (r / radius) ** 2)) * rnd.uniform(0.7, 1.0))))
        lf = bmesh.ops.create_icosphere(bmm, subdivisions=1, radius=rnd.uniform(0.035, 0.06))
        bmesh.ops.scale(bmm, vec=(1, 0.45, 0.12), verts=lf["verts"])
        bmesh.ops.rotate(bmm, cent=(0, 0, 0), matrix=Matrix.Rotation(rnd.uniform(0, 6.28), 3, "Z") @ Matrix.Rotation(rnd.uniform(-0.6, 0.6), 3, "X"), verts=lf["verts"])
        bmesh.ops.translate(bmm, vec=p, verts=lf["verts"])
    for k in range(n_bloom):
        u = rnd.uniform(0, 2 * math.pi)
        r = radius * rnd.uniform(0.1, 0.95)
        p = Vector((math.cos(u) * r, math.sin(u) * r, height * (0.25 + 0.8 * math.sqrt(max(0.0, 1 - (r / radius) ** 2)))))
        if ball:
            fl = bmesh.ops.create_icosphere(bmm, subdivisions=2, radius=bloom_r * rnd.uniform(0.85, 1.2))
            for vv in fl["verts"]:
                vv.co *= 1 + 0.12 * math.sin(vv.co.x * 120) * math.sin(vv.co.y * 130)
            geo = fl["verts"]
        else:
            fl = bmesh.ops.create_cone(bmm, cap_ends=True, segments=10, radius1=bloom_r * 0.45, radius2=bloom_r, depth=bloom_r * 1.2)
            geo = fl["verts"]
        bmesh.ops.translate(bmm, vec=p, verts=geo)
        for f in {f for vv in geo for f in vv.link_faces}:
            f.material_index = 1
    return _mesh_obj(name, bmm, [lm, bmat])


def willow(name, seed, height=9.5, crown=4.8, strands=3400):
    """Weeping willow: leaning trunk, arching scaffold limbs, and a dome of long hanging branchlets
    clothed in narrow leaves (each strand is a curved twig with alternate lanceolate leaves)."""
    rnd = random.Random(seed)
    bark = _mat("WillowBark", "#4f4234", 0.85, var=0.2)
    leaf = _mat("WillowLeaf3", "#6a8636", 0.55, sss=0.0, var=0.3)
    bmm = bmesh.new()
    up = Vector((0, 0, 1))

    def seg(p, q, r0, r1, sides=8):
        d = q - p
        c = bmesh.ops.create_cone(bmm, cap_ends=False, segments=sides, radius1=r0, radius2=r1, depth=d.length)
        mtx = Matrix.Translation((p + q) / 2) @ d.normalized().to_track_quat("Z", "Y").to_matrix().to_4x4()
        bmesh.ops.transform(bmm, matrix=mtx, verts=c["verts"])

    lean = Vector((rnd.uniform(-0.35, 0.35), rnd.uniform(-0.35, 0.35), 0))
    knee = Vector((0, 0, 0.6)) + lean * 0.2
    fork = Vector((0, 0, 2.9)) + lean
    seg(Vector((0, 0, -0.25)), knee, 0.66, 0.44, 14)
    seg(knee, fork, 0.44, 0.31, 14)
    tips = []
    for k in range(6):
        a = k * math.pi / 3 + rnd.uniform(-0.35, 0.35)
        out = Vector((math.cos(a), math.sin(a), 0))
        p, r = fork.copy(), 0.24
        d = (out * 0.55 + up).normalized()
        L = rnd.uniform(4.0, 5.0)
        pts = [p]
        for i in range(5):
            q = p + d * (L / 5)
            seg(p, q, r, r * 0.78)
            p, r = q, r * 0.78
            d = (d + out * 0.25 - up * (0.05 + 0.06 * i)).normalized()
            pts.append(p)
        for j in range(2, 6):
            for _ in range(2):
                ang = a + rnd.uniform(-0.9, 0.9)
                o2 = Vector((math.cos(ang), math.sin(ang), 0))
                p2, rr = pts[j].copy(), r * 0.9
                d2 = (o2 * 0.9 + up * 0.5).normalized()
                L2 = rnd.uniform(1.2, 2.2)
                for i in range(3):
                    q2 = p2 + d2 * (L2 / 3)
                    seg(p2, q2, max(0.012, rr), max(0.01, rr * 0.7), 5)
                    p2, rr = q2, rr * 0.7
                    d2 = (d2 + o2 * 0.3 - up * 0.35).normalized()
                    tips.append(p2.copy())
    nbark = len(bmm.faces)
    centre = Vector((lean.x, lean.y, height * 0.6))
    for s in range(strands):
        if rnd.random() < 0.4 and tips:
            o = rnd.choice(tips) + Vector((rnd.uniform(-0.6, 0.6), rnd.uniform(-0.6, 0.6), rnd.uniform(-0.3, 0.4)))
        else:
            u = rnd.uniform(0, 2 * math.pi)
            cphi = rnd.uniform(-0.2, 1.0)
            sphi = math.sqrt(1 - cphi * cphi)
            f = rnd.uniform(0.8, 1.0)
            o = centre + Vector((crown * sphi * math.cos(u), crown * sphi * math.sin(u), height * 0.4 * cphi)) * f
        flat = Vector((o.x - lean.x, o.y - lean.y, 0))
        outv = flat.normalized() if flat.length > 0.3 else Vector((math.cos(s), math.sin(s), 0))
        outer = flat.length / crown
        bottom = rnd.uniform(0.5, 2.0) if outer > 0.55 else o.z - rnd.uniform(1.5, 3.5)
        L = max(0.8, o.z - max(0.4, bottom))
        side = Vector((-outv.y, outv.x, 0)) * rnd.uniform(-0.25, 0.25)
        P0 = o
        P1 = o + outv * rnd.uniform(0.2, 0.5) + up * rnd.uniform(0.05, 0.3)
        P2 = o + outv * rnd.uniform(0.35, 0.8) + side - up * L
        bez = lambda t: P0 * (1 - t) ** 2 + P1 * (2 * (1 - t) * t) + P2 * (t * t)
        tan = lambda t: ((P1 - P0) * (2 * (1 - t)) + (P2 - P1) * (2 * t)).normalized()
        n = max(8, int(L / 0.05))
        prev = None
        for i in range(7):                                        # thin twig ribbon
            t = i / 6
            b = bez(t)
            w = Vector((-outv.y, outv.x, 0)) * 0.0025
            pair = (bmm.verts.new(b - w), bmm.verts.new(b + w))
            if prev:
                bmm.faces.new((prev[0], prev[1], pair[1], pair[0]))
            prev = pair
        for i in range(n):
            t = (i + 0.5) / n
            b, T = bez(t), tan(t)
            n1 = T.cross(up if abs(T.z) < 0.95 else Vector((1, 0, 0))).normalized()
            n2 = T.cross(n1)
            th = i * 2.39996 + rnd.uniform(-0.4, 0.4)
            perp = n1 * math.cos(th) + n2 * math.sin(th)
            beta = math.radians(rnd.uniform(28, 50))
            lv = (T * math.cos(beta) + perp * math.sin(beta)).normalized()
            ell = rnd.uniform(0.07, 0.11) * (1.0 - 0.35 * t)
            sd = lv.cross(perp).normalized() * ell * 0.13
            v = (bmm.verts.new(b), bmm.verts.new(b + lv * ell * 0.45 + sd), bmm.verts.new(b + lv * ell),
                 bmm.verts.new(b + lv * ell * 0.45 - sd))
            f = bmm.faces.new(v)
            f.material_index = 1
    return _mesh_obj(name, bmm, [bark, leaf])
