"""BabaDoll 小眠羊 plush lambs, modelled from the product photos (design/reference/lamb/).

Five versions (sitting height):
  palm      小眠羊 掌心小偶        ~15 cm  white sherpa, pink paw pads, gingham bib
  doll      小眠羊 玩偶            25 cm   white sherpa, gingham bib with lace, white bow
  night     小眠羊特别版 夜话      25 cm   white sherpa body + hood, black face, ears, hands and feet
  hug       小眠羊 抱偶            37 cm   white sherpa, gingham bib
  messenger 小眠羊特别版 信使      31 cm   pink sherpa, white face, white horns, large white satin bow

Shared construction: big round head in a fleece hood with little horns and a lace frill around the
face, drooping ears with pink lining, embroidered eyes, pink nose and stitched mouth, blush, chubby
pear body, short arms, legs sticking forward with stitched paw pads, pom tail, leather back tag.
Fleece is real particle hair (curled, clumped) so it reads as sherpa plush in Cycles.

Local frame: unit sitting height, doll faces -Y, sits on z = 0. `lamb(...)` returns a root empty.
"""
import math
import random

import bmesh
import bpy
from mathutils import Matrix, Vector

COLL = None

VARIANTS = {
    "palm": dict(fleece="#f2eee6", face="#f8f6f2", ear_in="#f1c8c2", pad="#e8b3aa", eye="#2c4f9f",
                 face_fur=False, limb=None, bib=True, bow="#f4f1ea", big_bow=False, height=0.15, chub=1.12),
    "doll": dict(fleece="#f3efe7", face="#f8f6f2", ear_in="#f1c8c2", pad="#e8b3aa", eye="#2c4f9f",
                 face_fur=False, limb=None, bib=True, bow="#f4f1ea", big_bow=False, height=0.25, chub=1.0),
    "night": dict(fleece="#f1ede4", face="#151515", ear_in="#1c1c1c", pad="#151515", eye="#2a2a2e",
                  face_fur=True, limb="#141414", bib=True, bow="#f4f1ea", big_bow=False, height=0.25, chub=1.0),
    "hug": dict(fleece="#f3efe7", face="#f8f6f2", ear_in="#f1c8c2", pad="#e8b3aa", eye="#2c4f9f",
                face_fur=False, limb=None, bib=True, bow="#f4f1ea", big_bow=False, height=0.37, chub=0.96),
    "messenger": dict(fleece="#e9bcc0", face="#f8f5f2", ear_in="#f2d2d0", pad="#e9dccd", eye="#6e4330",
                      face_fur=False, limb=None, bib=False, bow="#fbfaf7", big_bow=True, height=0.31, chub=1.0,
                      chest="#f0d9d6"),
}


# ---------------------------------------------------------------- materials
def _lin(h):
    h = h.lstrip("#")
    f = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return [f(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4)]


def fabric(name, hexcol, rough=0.85, sheen=0.6, bump=0.25, scale=600.0):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*_lin(hexcol), 1)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Sheen Weight"].default_value = sheen
    p.inputs["Subsurface Weight"].default_value = 0.05
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = scale
    nz.inputs["Detail"].default_value = 3.0
    bp = nt.nodes.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = bump
    bp.inputs["Distance"].default_value = 0.0005
    nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
    nt.links.new(nz.outputs["Fac"], bp.inputs["Height"])
    nt.links.new(bp.outputs["Normal"], p.inputs["Normal"])
    return m


def satin(name, hexcol):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*_lin(hexcol), 1)
    p.inputs["Roughness"].default_value = 0.28
    p.inputs["Anisotropic"].default_value = 0.6
    p.inputs["Sheen Weight"].default_value = 0.3
    return m


def gingham(name="Gingham", c1="#8fa5c0", c2="#f4f3ef"):
    """Woven blue/white check: two stripe sets multiplied."""
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Object"], sep.inputs[0])
    bands = []
    for axis in ("X", "Z"):
        mul = nt.nodes.new("ShaderNodeMath")
        mul.operation = "MULTIPLY"
        mul.inputs[1].default_value = 28.0          # checks per local unit
        nt.links.new(sep.outputs[axis], mul.inputs[0])
        fr = nt.nodes.new("ShaderNodeMath")
        fr.operation = "FRACT"
        nt.links.new(mul.outputs[0], fr.inputs[0])
        gt = nt.nodes.new("ShaderNodeMath")
        gt.operation = "GREATER_THAN"
        gt.inputs[1].default_value = 0.5
        nt.links.new(fr.outputs[0], gt.inputs[0])
        bands.append(gt)
    add = nt.nodes.new("ShaderNodeMath")
    add.operation = "ADD"
    nt.links.new(bands[0].outputs[0], add.inputs[0])
    nt.links.new(bands[1].outputs[0], add.inputs[1])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    cr = ramp.color_ramp
    cr.interpolation = "CONSTANT"
    cr.elements[0].position, cr.elements[0].color = 0.0, (*_lin(c2), 1)
    cr.elements[1].position, cr.elements[1].color = 0.66, (*[c * 0.62 for c in _lin(c1)], 1)
    e = cr.elements.new(0.33)
    e.color = (*_lin(c1), 1)
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs["From Max"].default_value = 2.0
    nt.links.new(add.outputs[0], mr.inputs["Value"])
    nt.links.new(mr.outputs["Result"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], p.inputs["Base Color"])
    p.inputs["Roughness"].default_value = 0.8
    p.inputs["Sheen Weight"].default_value = 0.4
    return m


def lace(name="Lace", hexcol="#f6f4ee"):
    """Eyelet lace: white cotton with punched holes (alpha from a voronoi)."""
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*_lin(hexcol), 1)
    p.inputs["Roughness"].default_value = 0.75
    p.inputs["Sheen Weight"].default_value = 0.5
    p.inputs["Subsurface Weight"].default_value = 0.2
    tc = nt.nodes.new("ShaderNodeTexCoord")
    vo = nt.nodes.new("ShaderNodeTexVoronoi")
    vo.inputs["Scale"].default_value = 140.0
    nt.links.new(tc.outputs["Object"], vo.inputs["Vector"])
    gt = nt.nodes.new("ShaderNodeMath")
    gt.operation = "GREATER_THAN"
    gt.inputs[1].default_value = 0.12
    nt.links.new(vo.outputs["Distance"], gt.inputs[0])
    nt.links.new(gt.outputs[0], p.inputs["Alpha"])
    return m


def hair_mat(name, hexcol, rough=0.55):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.remove(nt.nodes["Principled BSDF"])
    h = nt.nodes.new("ShaderNodeBsdfHairPrincipled")
    h.parametrization = "COLOR"
    # strands scatter light many times, so the fibre colour is set brighter than the target fleece colour
    h.inputs["Color"].default_value = (*[min(1.0, c ** 0.55) for c in _lin(hexcol)], 1)
    h.inputs["Roughness"].default_value = rough
    h.inputs["Radial Roughness"].default_value = 0.85
    h.inputs["Coat"].default_value = 0.2
    h.inputs["Random Roughness"].default_value = 0.3
    nt.links.new(h.outputs[0], nt.nodes["Material Output"].inputs["Surface"])
    return m


def blush_mat(name="LambBlush", hexcol="#f0a7a4"):
    """Soft airbrushed blush: colour fades to transparent toward the edge of a disc."""
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*_lin(hexcol), 1)
    p.inputs["Roughness"].default_value = 0.9
    tc = nt.nodes.new("ShaderNodeTexCoord")
    gr = nt.nodes.new("ShaderNodeTexGradient")
    gr.gradient_type = "SPHERICAL"
    nt.links.new(tc.outputs["Object"], gr.inputs["Vector"])
    mm = nt.nodes.new("ShaderNodeMath")
    mm.operation = "MULTIPLY"
    mm.inputs[1].default_value = 0.75
    nt.links.new(gr.outputs["Fac"], mm.inputs[0])
    nt.links.new(mm.outputs[0], p.inputs["Alpha"])
    return m


# ---------------------------------------------------------------- mesh helpers
def _obj(name, bm, mats, parent, smooth=True, subsurf=1):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = smooth
    o = bpy.data.objects.new(name, me)
    for m in mats:
        o.data.materials.append(m)
    if subsurf:
        sd = o.modifiers.new("smooth", "SUBSURF")
        sd.levels = sd.render_levels = subsurf
    COLL.objects.link(o)
    o.parent = parent
    return o


def ellipsoid(name, c, r, m, parent, seg=32, taper=0.0, subsurf=1):
    """Ellipsoid centred at c with radii r; taper > 0 narrows the top half (pear shape)."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=seg // 2, radius=1.0)
    for v in bm.verts:
        x, y, z = v.co
        k = 1.0 - taper * max(0.0, z) + 0.08 * taper * max(0.0, -z)
        v.co = Vector((c[0] + x * r[0] * k, c[1] + y * r[1] * k, c[2] + z * r[2]))
    return _obj(name, bm, [m], parent, subsurf=subsurf)


def capsule(name, p0, p1, r0, r1, m, parent, seg=20):
    """Tapered capsule between two points (limbs)."""
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    L = d.length
    bm = bmesh.new()
    rings = 10
    verts = []
    for i in range(rings + 1):
        t = i / rings
        # hemispherical ends folded into a smooth profile
        z = -r0 + (L + r0 + r1) * t
        if z < 0:
            rr = math.sqrt(max(0.0, r0 * r0 - z * z))
        elif z > L:
            rr = math.sqrt(max(0.0, r1 * r1 - (z - L) ** 2))
        else:
            rr = r0 + (r1 - r0) * z / L
        verts.append([bm.verts.new((rr * math.cos(2 * math.pi * k / seg), rr * math.sin(2 * math.pi * k / seg), z))
                      for k in range(seg)])
    for a, b in zip(verts, verts[1:]):
        for k in range(seg):
            bm.faces.new((a[k], a[(k + 1) % seg], b[(k + 1) % seg], b[k]))
    bm.faces.new(list(reversed(verts[0])))
    bm.faces.new(verts[-1])
    rot = d.normalized().to_track_quat("Z", "Y").to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=Matrix.Translation(p0) @ rot, verts=bm.verts[:])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _obj(name, bm, [m], parent)


def disc_on(name, centre, normal, rx, ry, m, parent, lift=0.002, seg=32, up=Vector((0, 0, 1)), thick=0.0, dome=0.0):
    """Elliptic patch lying on a surface point, facing `normal` (eyes, nose, pads, blush)."""
    n = Vector(normal).normalized()
    xa = up.cross(n)
    if xa.length < 1e-6:
        xa = Vector((1, 0, 0))
    xa.normalize()
    ya = n.cross(xa)
    bm = bmesh.new()
    c = bm.verts.new(Vector(centre) + n * (lift + dome))
    ring = []
    for k in range(seg):
        a = 2 * math.pi * k / seg
        ring.append(bm.verts.new(Vector(centre) + n * lift + xa * rx * math.cos(a) + ya * ry * math.sin(a)))
    for k in range(seg):
        bm.faces.new((c, ring[k], ring[(k + 1) % seg]))
    o = _obj(name, bm, [m], parent, subsurf=0)
    if thick:
        s = o.modifiers.new("t", "SOLIDIFY")
        s.thickness = thick
    return o


# ---------------------------------------------------------------- fleece
def fleece(o, mat, density, length, curl=0.45, seed=0, short=False):
    """Particle-hair sherpa on `o`: curled, clumped, slightly rough strands normal to the surface."""
    if mat.name not in [m.name for m in o.data.materials]:
        o.data.materials.append(mat)
    md = o.modifiers.new("fleece", "PARTICLE_SYSTEM")
    ps = md.particle_system
    ps.seed = seed
    s = ps.settings
    s.type = "HAIR"
    s.use_advanced_hair = True
    area = sum(p.area for p in o.data.polygons)
    s.count = max(400, int(area * density * 8))
    s.emit_from = "FACE"
    s.use_emit_random = True
    s.use_even_distribution = True
    s.normal_factor = length / 4.0      # hair_length = 4 x the emit velocity
    s.factor_random = 0.15 * length
    s.length_random = 0.3
    s.child_type = "INTERPOLATED"
    s.child_percent = 3
    s.rendered_child_count = 12 if not short else 8
    s.child_length = 0.85
    s.child_length_threshold = 0.3
    s.clump_factor = 0.92 if not short else 0.35
    s.clump_shape = 0.35                # tight curly nubs (sherpa)
    s.roughness_1 = 0.12 * length
    s.roughness_1_size = 1.0
    s.roughness_2 = 0.15 * length
    s.roughness_2_size = 0.5
    s.roughness_2_threshold = 0.6
    s.roughness_endpoint = 0.15 * length
    if not short:
        s.kink = "CURL"
        s.kink_amplitude = curl * length * 1.1
        s.kink_frequency = 4.0
        s.kink_shape = 0.2
    s.material = [m.name for m in o.data.materials].index(mat.name) + 1   # 1-based slot
    s.root_radius = 1.0
    s.tip_radius = 0.25
    s.radius_scale = 0.0014 if not short else 0.001
    s.use_close_tip = True
    s.render_type = "PATH"
    s.display_step = 3
    s.render_step = 4
    return ps


# ---------------------------------------------------------------- one lamb
def _head_surface(c, r, d):
    """Point on the head ellipsoid in direction d (local) and its normal."""
    d = Vector(d).normalized()
    t = 1.0 / math.sqrt((d.x / r[0]) ** 2 + (d.y / r[1]) ** 2 + (d.z / r[2]) ** 2)
    p = Vector(c) + d * t
    n = Vector(((p.x - c[0]) / r[0] ** 2, (p.y - c[1]) / r[1] ** 2, (p.z - c[2]) / r[2] ** 2)).normalized()
    return p, n


def ruffle(name, centre, rx, rz, y, depth, waves, m, parent, width=0.035, tilt=0.6, start=0.0, end=2 * math.pi):
    """Gathered lace ruffle following an ellipse in the x-z plane at y (face frill, bib edge)."""
    bm = bmesh.new()
    n = 160
    inner, outer = [], []
    for i in range(n + 1):
        a = start + (end - start) * i / n
        cx, cz = math.cos(a), math.sin(a)
        wav = math.sin(a * waves) * depth
        pi = Vector((centre[0] + rx * cx, y + wav, centre[2] + rz * cz))
        po = Vector((centre[0] + (rx + width) * cx, y + wav - width * tilt + wav * 0.5, centre[2] + (rz + width) * cz))
        inner.append(bm.verts.new(pi))
        outer.append(bm.verts.new(po))
    for i in range(n):
        bm.faces.new((inner[i], inner[i + 1], outer[i + 1], outer[i]))
    o = _obj(name, bm, [m], parent, subsurf=1)
    s = o.modifiers.new("t", "SOLIDIFY")
    s.thickness = 0.002
    return o


def bow(name, centre, size, m, parent, tails=0.6):
    """Ribbon bow: two flattened loops, a knot and two tails."""
    cx, cy, cz = centre
    objs = []
    for s in (-1, 1):
        lp = ellipsoid(f"{name}_loop{s}", (0, 0, 0), (size * 0.55, size * 0.14, size * 0.32), m, parent, 24)
        lp.location = (cx + s * size * 0.55, cy, cz + size * 0.05)
        lp.rotation_euler.y = s * 0.25            # loops lift slightly outward
        objs.append(lp)
        tl = capsule(f"{name}_tail{s}", (cx + s * size * 0.1, cy - size * 0.02, cz - size * 0.1),
                     (cx + s * size * 0.45, cy - size * 0.06, cz - size * tails * 1.4), size * 0.12, size * 0.1, m, parent, 12)
        objs.append(tl)
    objs.append(ellipsoid(name + "_knot", (cx, cy - size * 0.05, cz), (size * 0.18, size * 0.14, size * 0.2), m, parent, 16))
    return objs


def lamb(name, variant, location=(0, 0, 0), rot_deg=0.0, height=None, coll=None, seed=0):
    global COLL
    COLL = coll or bpy.context.scene.collection
    V = VARIANTS[variant]
    H = height or V["height"]
    ch = V["chub"]
    rnd = random.Random(seed)
    root = bpy.data.objects.new(name, None)
    COLL.objects.link(root)
    root.location = location
    root.rotation_euler = (0, 0, math.radians(rot_deg))
    root.scale = (H, H, H)

    fl_base = fabric(f"LambBase_{variant}", V["fleece"], 0.95, 0.8, 0.4, 300)
    fl_hair = hair_mat(f"LambFleece_{variant}", V["fleece"])
    face = fabric(f"LambFace_{variant}", V["face"], 0.8, 0.5, 0.15, 900)
    ear_in = fabric(f"LambEarIn_{variant}", V["ear_in"], 0.8, 0.6, 0.15, 900)
    pad = fabric(f"LambPad_{variant}", V["pad"], 0.85, 0.6, 0.2, 900)
    stitch = fabric("LambStitch", "#9a6f6a", 0.8, 0.0, 0.0)
    limb_hair, limb_base = fl_hair, fl_base
    blk_hair = hair_mat("LambBlackFleece", V["limb"]) if V["limb"] else None
    blk_base = fabric("LambBlackBase", V["limb"], 0.9, 0.6, 0.3) if V["limb"] else None
    L = 0.02                          # fleece length (unit height): ~5 mm on the 25 cm doll

    # ---- head (face fabric), hood (fleece) with face opening, horns, frill
    hc, hr = (0.0, 0.0, 0.70), (0.205 * ch, 0.19 * ch, 0.19)
    head = ellipsoid(name + "_head", hc, hr, face, root, 48)
    if V["face_fur"]:
        fleece(head, hair_mat("LambBlackFace", V["face"], 0.45), 900, 0.012, seed=seed + 1, short=True)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=24, radius=1.0)
    hood_r = (hr[0] * 1.08, hr[1] * 1.08, hr[2] * 1.1)
    kill = []
    for v in bm.verts:
        x, y, z = v.co
        # face opening: ellipse centred slightly low on the front
        if y < -0.2 and (x / 0.7) ** 2 + ((z + 0.14) / 0.76) ** 2 < 1.0:
            kill.append(v)
        v.co = Vector((hc[0] + x * hood_r[0], hc[1] + y * hood_r[1] + 0.012, hc[2] + 0.015 + z * hood_r[2]))
    bmesh.ops.delete(bm, geom=kill, context="VERTS")
    hood = _obj(name + "_hood", bm, [fl_base], root)
    sol = hood.modifiers.new("t", "SOLIDIFY")
    sol.thickness = 0.012
    sol.offset = 1.0
    hood.modifiers.move(len(hood.modifiers) - 1, 0)
    fleece(hood, fl_hair, 1400, L, seed=seed + 2)
    for s in (-1, 1):
        hn = capsule(f"{name}_horn{s}", (s * 0.085, 0.01, 0.86), (s * 0.13, 0.0, 0.95), 0.045, 0.02,
                     fl_base if variant != "messenger" else fabric("LambHornWhite", "#f6f3ee", 0.8, 0.6), root, 16)
        fleece(hn, fl_hair if variant != "messenger" else hair_mat("LambHornHair", "#f6f3ee"), 900, L * 0.45, seed=seed + 3 + s, short=True)
    ruffle(name + "_frill", (0.0, 0.0, hc[2] - 0.026), hr[0] * 0.72, hr[2] * 0.8, hc[1] - hr[1] * 0.74, 0.004, 30,
           lace(), root, 0.018, 0.6)

    # ---- face details
    ey = []
    for s in (-1, 1):
        p, n = _head_surface(hc, hr, (s * 0.36, -1.0, -0.08))
        ey.append((p, n))
        if variant == "night":
            disc_on(f"{name}_eye{s}", p, n, 0.026, 0.028, fabric("LambEyeBead", "#0a0a0c", 0.15, 0.0, 0.0), root, 0.001, dome=0.006)
        else:
            disc_on(f"{name}_eyerim{s}", p, n, 0.03, 0.033, fabric(f"LambEyeRim_{variant}", "#202a44" if variant != "messenger" else "#3a241a", 0.5, 0.2, 0.0), root, 0.0015)
            disc_on(f"{name}_eye{s}", p, n, 0.024, 0.027, satin(f"LambEye_{variant}", V["eye"]), root, 0.0025, dome=0.002)
            hp = p + Vector((s * -0.008, 0, 0.01))
            disc_on(f"{name}_glint{s}", hp, n, 0.006, 0.006, satin("LambGlint", "#f6f6f4"), root, 0.0045)
            bp, bn = _head_surface(hc, hr, (s * 0.5, -1.0, -0.32))
            disc_on(f"{name}_blush{s}", bp, bn, 0.035, 0.022, blush_mat(), root, 0.0012)
    p, n = _head_surface(hc, hr, (0.0, -1.0, -0.22))
    nose_col = "#e88f97" if variant != "night" else "#3a2a2c"
    disc_on(name + "_nose", p, n, 0.022, 0.016, fabric("LambNose_" + variant, nose_col, 0.6, 0.4, 0.1), root, 0.002, dome=0.003)
    p2, n2 = _head_surface(hc, hr, (0.0, -1.0, -0.36))
    disc_on(name + "_mouth", p2, n2, 0.0035, 0.018, fabric("LambNose_" + variant, nose_col, 0.6, 0.4, 0.1), root, 0.0018)

    # ---- ears: drooping leaves, fleece outside, lining inside
    for s in (-1, 1):
        ec = (s * 0.3 * ch, -0.03, 0.66)
        em = blk_base or fl_base
        eo = ellipsoid(f"{name}_ear{s}", (0, 0, 0), (0.12, 0.04, 0.068), em, root, 24)
        eo.location = ec
        eo.rotation_euler = (0.0, s * math.radians(32), s * math.radians(-12))
        fleece(eo, blk_hair or fl_hair, 1300, L * 0.7, seed=seed + 10 + s, short=bool(blk_hair))
        li = ellipsoid(f"{name}_earin{s}", (0, -0.03, -0.004), (0.088, 0.014, 0.046), ear_in, root, 20)
        li.location = ec
        li.rotation_euler = eo.rotation_euler

    # ---- body, arms, legs, pads, tail
    body = ellipsoid(name + "_body", (0.0, 0.03, 0.29), (0.215 * ch, 0.19 * ch, 0.27), fl_base, root, 40, taper=0.28)
    fleece(body, fl_hair, 1100, L, seed=seed + 20)
    if V.get("chest"):
        ch_m = fabric("LambChest_" + variant, V["chest"], 0.95, 0.8, 0.4, 300)
        chest = ellipsoid(name + "_chest", (0.0, -0.11, 0.3), (0.12, 0.08, 0.17), ch_m, root, 24)
        fleece(chest, hair_mat("LambChestHair_" + variant, V["chest"]), 1100, L * 0.9, seed=seed + 21)
    for s in (-1, 1):
        arm = capsule(f"{name}_arm{s}", (s * 0.16 * ch, -0.02, 0.43), (s * 0.235 * ch, -0.1, 0.2), 0.06, 0.055, limb_base, root)
        fleece(arm, limb_hair, 1100, L * 0.8, seed=seed + 30 + s)
        leg = capsule(f"{name}_leg{s}", (s * 0.105 * ch, -0.02, 0.1), (s * 0.13 * ch, -0.25, 0.075), 0.08, 0.075, limb_base, root)
        fleece(leg, limb_hair, 1100, L * 0.8, seed=seed + 40 + s)
        if blk_base:
            hm = ellipsoid(f"{name}_mitt{s}", (s * 0.25 * ch, -0.14, 0.2), (0.075, 0.075, 0.075), blk_base, root, 20)
            fleece(hm, blk_hair, 1500, L * 0.6, seed=seed + 60 + s, short=True)
            ft = ellipsoid(f"{name}_boot{s}", (s * 0.13 * ch, -0.29, 0.08), (0.092, 0.08, 0.09), blk_base, root, 20)
            fleece(ft, blk_hair, 1500, L * 0.6, seed=seed + 70 + s, short=True)
        pc = Vector((s * 0.13 * ch, -0.25 - 0.072 - (0.02 if blk_base else 0), 0.075))
        disc_on(f"{name}_pad{s}", pc, (0, -1, 0.1), 0.06, 0.065, pad, root, 0.004, dome=0.012)
        disc_on(f"{name}_padseam{s}", pc + Vector((0, -0.017, -0.01)), (0, -1, 0.1), 0.0025, 0.035, stitch, root, 0.002)
    tail = ellipsoid(name + "_tail", (0.0, 0.2 * ch, 0.12), (0.05, 0.045, 0.05), fl_base, root, 20)
    fleece(tail, fl_hair, 1500, L * 0.9, seed=seed + 50)
    disc_on(name + "_tag", (0.0, 0.205 * ch, 0.5), (0, 1, 0.15), 0.05, 0.016, fabric("LambTag", "#8a6036", 0.55, 0.2, 0.1), root, 0.03, thick=0.004)

    # ---- bib with lace edge + small bow, or the messenger's big satin bow
    if V["bib"]:
        bm = bmesh.new()
        c = bm.verts.new((0.0, -0.2, 0.5))
        ring = []
        for k in range(25):
            a = math.pi + math.pi * k / 24          # lower half-ellipse
            ring.append(bm.verts.new((0.145 * math.cos(a), -0.21 + 0.045 * math.sin(a) ** 2, 0.5 + 0.11 * math.sin(a))))
        for k in range(24):
            bm.faces.new((c, ring[k], ring[k + 1]))
        bib = _obj(name + "_bib", bm, [gingham()], root, subsurf=1)
        s_ = bib.modifiers.new("t", "SOLIDIFY")
        s_.thickness = 0.004
        ruffle(name + "_biblace", (0.0, 0.0, 0.5), 0.145, 0.11, -0.2, 0.004, 22, lace(), root, 0.022, 0.3, math.pi, 2 * math.pi)
        bow(name + "_bow", (0.0, -0.225, 0.525), 0.04, satin(f"LambBow_{variant}", V["bow"]), root, 0.4)
    if V["big_bow"]:
        bow(name + "_bow", (0.0, -0.235, 0.5), 0.085, satin(f"LambBow_{variant}", V["bow"]), root, 0.9)
    return root


# ---------------------------------------------------------------- arrangement on a bed
ORDER = [("palm", 0.15), ("doll", 0.25), ("hug", 0.37), ("messenger", 0.31), ("night", 0.25)]


def on_bed(x, y, z, rot_deg, width, coll=None, depth_offset=0.0):
    """Line the five lambs up across a bed, tallest in the middle, facing the foot of the bed.
    (x, y, z): centre of the row on the duvet; rot_deg: direction the dolls face (0 = -Y)."""
    a = math.radians(rot_deg)
    ux, uy = math.cos(a), math.sin(a)
    n = len(ORDER)
    gaps = [h * 0.82 + 0.06 for _, h in ORDER]          # body + ears + fleece, a hand's width apart
    total = sum(gaps)
    u = -total / 2
    roots = []
    for k, (v, h) in enumerate(ORDER):
        u += gaps[k] / 2
        px, py = x + ux * u, y + uy * u
        roots.append(lamb(f"Lamb_{v}", v, (px, py, z), rot_deg + (k - 2) * 4.0, h, coll, seed=k * 97))
        u += gaps[k] / 2
    return roots
