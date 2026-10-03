"""Second outdoor pass: the things the wide shots still showed as blocks.

- garden walks in irregular limestone flagstone with mossy joints, warmer decomposed-granite gravel
- a real cedar play set (tower, canvas roof, wave slide, rock wall, swing beam with belt swings, sandbox)
- the pool bar house as a hollow limestone pavilion: lake-side glass folding doors, open serving window
  to the swim-up bar under a steel awning, entry door, glass roof-deck rail, sconces, roof-deck lounge
- far shore: forest-canopy material with distance haze instead of flat pale blobs
- barbecue pavilion: stained timber posts, metal roof, grill island, picnic table
"""
import math
import random

import bmesh
import bpy
from mathutils import Matrix, Vector

import interiors as I
import props as P

COLL = None
M = None


def _m(name, hexcol, rough=0.5, metal=0.0, **kw):
    return I.mat(name, hexcol, rough, metal, **kw)


# ---------------------------------------------------------------- materials
def flagstone(name="Flagstone", scale=1.1):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (scale, scale, scale)
    edge = nt.nodes.new("ShaderNodeTexVoronoi")
    edge.feature = "DISTANCE_TO_EDGE"
    edge.inputs["Randomness"].default_value = 0.9
    cell = nt.nodes.new("ShaderNodeTexVoronoi")
    cell.inputs["Randomness"].default_value = 0.9
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 18.0
    nz.inputs["Detail"].default_value = 8.0
    for n in (edge, cell, nz):
        nt.links.new(mp.outputs["Vector"], n.inputs["Vector"])
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    # per-stone tone: two limestone shades picked by the cell colour, speckled by noise
    tone = nt.nodes.new("ShaderNodeValToRGB")
    tone.color_ramp.elements[0].color = (0.36, 0.31, 0.24, 1)
    tone.color_ramp.elements[1].color = (0.55, 0.49, 0.39, 1)
    sep = nt.nodes.new("ShaderNodeSeparateColor")
    nt.links.new(cell.outputs["Color"], sep.inputs["Color"])
    mixf = nt.nodes.new("ShaderNodeMath")
    mixf.operation = "MULTIPLY_ADD"
    mixf.inputs[1].default_value = 0.8
    nt.links.new(sep.outputs["Red"], mixf.inputs[0])
    nt.links.new(nz.outputs["Fac"], mixf.inputs[2])
    sub = nt.nodes.new("ShaderNodeMath")
    sub.operation = "SUBTRACT"
    sub.inputs[1].default_value = 0.25
    nt.links.new(mixf.outputs[0], sub.inputs[0])
    nt.links.new(sub.outputs[0], tone.inputs["Fac"])
    # joints: dark soil with a touch of moss
    joint = nt.nodes.new("ShaderNodeMapRange")
    joint.inputs["From Min"].default_value = 0.015
    joint.inputs["From Max"].default_value = 0.045
    nt.links.new(edge.outputs["Distance"], joint.inputs["Value"])
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs["A"].default_value = (0.12, 0.13, 0.07, 1)
    nt.links.new(joint.outputs["Result"], mix.inputs["Factor"])
    nt.links.new(tone.outputs["Color"], mix.inputs["B"])
    nt.links.new(mix.outputs["Result"], p.inputs["Base Color"])
    p.inputs["Roughness"].default_value = 0.82
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.6
    bump.inputs["Distance"].default_value = 0.02
    hgt = nt.nodes.new("ShaderNodeMath")
    hgt.operation = "MULTIPLY_ADD"
    hgt.inputs[1].default_value = 0.08
    nt.links.new(nz.outputs["Fac"], hgt.inputs[0])
    nt.links.new(joint.outputs["Result"], hgt.inputs[2])
    nt.links.new(hgt.outputs[0], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], p.inputs["Normal"])
    return m


def canopy(name="FarCanopy"):
    """Distant forest: lumpy crowns, dark green lifted toward the sky colour by haze."""
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 0.08
    nz.inputs["Detail"].default_value = 10.0
    nz.inputs["Roughness"].default_value = 0.65
    nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.35
    ramp.color_ramp.elements[0].color = (0.018, 0.03, 0.02, 1)
    ramp.color_ramp.elements[1].position = 0.7
    ramp.color_ramp.elements[1].color = (0.055, 0.08, 0.055, 1)
    nt.links.new(nz.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], p.inputs["Base Color"])
    p.inputs["Roughness"].default_value = 0.95
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 1.0
    bump.inputs["Distance"].default_value = 3.0
    nt.links.new(nz.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], p.inputs["Normal"])
    # haze: a little emission in the sky tint so the far shore sits back in the air
    p.inputs["Emission Color"].default_value = (0.45, 0.58, 0.75, 1)
    p.inputs["Emission Strength"].default_value = 0.06
    return m


def dg_gravel(name="DecomposedGranite"):
    """Compacted decomposed granite: warm tan fines with scattered pebbles."""
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    vor = nt.nodes.new("ShaderNodeTexVoronoi")
    vor.inputs["Scale"].default_value = 140.0
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 4.0
    nz.inputs["Detail"].default_value = 6.0
    fine = nt.nodes.new("ShaderNodeTexNoise")
    fine.inputs["Scale"].default_value = 400.0
    for n in (vor, nz, fine):
        nt.links.new(tc.outputs["Object"], n.inputs["Vector"])
    pebble = nt.nodes.new("ShaderNodeMapRange")
    pebble.inputs["From Min"].default_value = 0.25
    pebble.inputs["From Max"].default_value = 0.1
    nt.links.new(vor.outputs["Distance"], pebble.inputs["Value"])
    base = nt.nodes.new("ShaderNodeValToRGB")
    base.color_ramp.elements[0].color = (0.33, 0.25, 0.15, 1)
    base.color_ramp.elements[1].color = (0.52, 0.42, 0.28, 1)
    add = nt.nodes.new("ShaderNodeMath")
    add.operation = "MULTIPLY_ADD"
    add.inputs[1].default_value = 0.5
    nt.links.new(nz.outputs["Fac"], add.inputs[0])
    nt.links.new(fine.outputs["Fac"], add.inputs[2])
    sub = nt.nodes.new("ShaderNodeMath")
    sub.operation = "SUBTRACT"
    sub.inputs[1].default_value = 0.35
    nt.links.new(add.outputs[0], sub.inputs[0])
    nt.links.new(sub.outputs[0], base.inputs["Fac"])
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs["B"].default_value = (0.62, 0.58, 0.52, 1)
    nt.links.new(pebble.outputs["Result"], mix.inputs["Factor"])
    nt.links.new(base.outputs["Color"], mix.inputs["A"])
    nt.links.new(mix.outputs["Result"], p.inputs["Base Color"])
    p.inputs["Roughness"].default_value = 0.9
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.5
    bump.inputs["Distance"].default_value = 0.01
    hb = nt.nodes.new("ShaderNodeMath")
    hb.operation = "ADD"
    nt.links.new(pebble.outputs["Result"], hb.inputs[0])
    nt.links.new(fine.outputs["Fac"], hb.inputs[1])
    nt.links.new(hb.outputs[0], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], p.inputs["Normal"])
    return m


# ---------------------------------------------------------------- garden walks
def garden_paths():
    stone = flagstone()
    for n in ("BorderWalk", "GardenSidePath", "PergolaWalk"):
        o = bpy.data.objects.get(n)
        if o:
            o.data.materials.clear()
            o.data.materials.append(stone)
    dg = dg_gravel()
    for n in ("LawnLoop", "FormalGravel", "KitchenGravel"):
        o = bpy.data.objects.get(n)
        if o:
            o.data.materials.clear()
            o.data.materials.append(dg)
    for n in ("FarHill0", "FarHill1", "FarHill2", "FarHill3"):
        o = bpy.data.objects.get(n)
        if o:
            o.data.materials.clear()
            o.data.materials.append(canopy())
    for o in bpy.data.objects:
        if o.name.startswith("FarTree"):
            o.data.materials.clear()
            o.data.materials.append(canopy())


def far_forest(bm):
    """Wooded far shore: a few thousand instanced trees on the hills across the lake (real silhouettes)."""
    import re
    import vegetation as V
    import rear_yard as RY
    fir = V.load("fir_tree_01", lambda n: re.fullmatch(r"fir_tree_01_[abc]_LOD1", n) is not None, "fir")
    shade = V.load("island_tree_02", lambda n: n == "island_tree_02_LOD1", "shade2")
    shade3 = V.load("island_tree_03", lambda n: n == "island_tree_03_LOD1", "shade3")
    fir_s = RY._height_scale(fir, 1.0)
    hills = [(-260, 220, 22), (-40, 180, 16), (150, 240, 26), (380, 220, 18)]

    def hz(x, y):
        best = None
        for xc, w, h in hills:
            q = 1 - ((x - xc) / w) ** 2 - ((y - 620) / 90) ** 2
            if q > 0:
                z = bm.LAKE + h * math.sqrt(q)
                best = z if best is None else max(best, z)
        return best
    rnd = random.Random(31)
    pf, ps, ps3 = [], [], []
    for _ in range(3200):
        x, y = rnd.uniform(-480, 600), rnd.uniform(534, 690)
        z = hz(x, y)
        if z is None or z < bm.LAKE + 0.6:
            continue
        r = rnd.random()
        if r < 0.4:
            pf.append((x, y, z - 0.5, fir_s * rnd.uniform(12, 22)))
        elif r < 0.7:
            ps.append((x, y, z - 0.5, rnd.uniform(1.8, 2.8)))
        else:
            ps3.append((x, y, z - 0.5, rnd.uniform(1.8, 2.8)))
    V.scatter("FarForestFir", fir, pf, COLL, 81)
    V.scatter("FarForestShade", shade, ps, COLL, 82)
    V.scatter("FarForestShade3", shade3, ps3, COLL, 83)


def wild_ground():
    """Unmown ground outside the lot: dry and green grasses with bare patches, large-scale variation
    (the lawn texture's mowing stripes only belong inside the estate)."""
    m = bpy.data.materials.get("WildGround")
    if m is None:
        m = bpy.data.materials.new("WildGround")
        m.use_nodes = True
        nt = m.node_tree
        p = nt.nodes["Principled BSDF"]
        tc = nt.nodes.new("ShaderNodeTexCoord")
        big = nt.nodes.new("ShaderNodeTexNoise")
        big.inputs["Scale"].default_value = 0.03
        big.inputs["Detail"].default_value = 6.0
        mid = nt.nodes.new("ShaderNodeTexNoise")
        mid.inputs["Scale"].default_value = 0.6
        mid.inputs["Detail"].default_value = 8.0
        fine = nt.nodes.new("ShaderNodeTexNoise")
        fine.inputs["Scale"].default_value = 30.0
        for n in (big, mid, fine):
            nt.links.new(tc.outputs["Object"], n.inputs["Vector"])
        mix = nt.nodes.new("ShaderNodeMath")
        mix.operation = "MULTIPLY_ADD"
        mix.inputs[1].default_value = 0.6
        nt.links.new(big.outputs["Fac"], mix.inputs[0])
        nt.links.new(mid.outputs["Fac"], mix.inputs[2])
        sub = nt.nodes.new("ShaderNodeMath")
        sub.operation = "SUBTRACT"
        sub.inputs[1].default_value = 0.35
        nt.links.new(mix.outputs[0], sub.inputs[0])
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        cr = ramp.color_ramp
        cr.elements[0].position, cr.elements[0].color = 0.15, (0.05, 0.075, 0.025, 1)
        cr.elements[1].position, cr.elements[1].color = 0.75, (0.16, 0.14, 0.07, 1)
        e = cr.elements.new(0.45)
        e.color = (0.08, 0.11, 0.035, 1)
        nt.links.new(sub.outputs[0], ramp.inputs["Fac"])
        nt.links.new(ramp.outputs["Color"], p.inputs["Base Color"])
        p.inputs["Roughness"].default_value = 0.95
        bump = nt.nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.4
        nt.links.new(fine.outputs["Fac"], bump.inputs["Height"])
        nt.links.new(bump.outputs["Normal"], p.inputs["Normal"])
    t = bpy.data.objects.get("Terrain")
    if t:
        if m.name not in [x.name for x in t.data.materials]:
            t.data.materials.append(m)
        idx = [x.name for x in t.data.materials].index(m.name)
        for poly in t.data.polygons:
            c = poly.center
            if c.x < -3 or c.x > 85 or c.y < -13:
                poly.material_index = idx
    for n in ("GroundW", "GroundE", "FarGround"):
        o = bpy.data.objects.get(n)
        if o:
            o.data.materials.clear()
            o.data.materials.append(m)


def woodland(bm):
    """Neighbouring land as Texas hill-country woodland (live oaks, cedar elms, junipers) with clearings,
    so the estate does not sit in an empty field in the wide shots."""
    import re
    import vegetation as V
    import rear_yard as RY
    fir = V.load("fir_tree_01", lambda n: re.fullmatch(r"fir_tree_01_[abc]_LOD1", n) is not None, "fir")
    shade = V.load("island_tree_02", lambda n: n == "island_tree_02_LOD1", "shade2")
    shade3 = V.load("island_tree_03", lambda n: n == "island_tree_03_LOD1", "shade3")
    fir_s = RY._height_scale(fir, 1.0)
    rnd = random.Random(57)
    regions = [(-160, -4, -60, 97), (86, 240, -60, 97), (-160, 240, -110, -15)]
    pf, ps, ps3 = [], [], []
    grid = {}
    for (x1, x2, y1, y2) in regions:
        n = int((x2 - x1) * (y2 - y1) / 45)
        for _ in range(n):
            x, y = rnd.uniform(x1, x2), rnd.uniform(y1, y2)
            if math.sin(x * 0.045) + math.cos(y * 0.06 + 1.3) + 0.6 * math.sin((x + y) * 0.11) < -1.5:
                continue                                      # a few clearings
            cx, cy = int(x // 5), int(y // 5)
            if any((x - a) ** 2 + (y - b) ** 2 < 20 for i in (-1, 0, 1) for j in (-1, 0, 1) for a, b in grid.get((cx + i, cy + j), ())):
                continue
            grid.setdefault((cx, cy), []).append((x, y))
            z = bm.ground(x, y) - 0.2
            r = rnd.random()
            if r < 0.22:
                pf.append((x, y, z, fir_s * rnd.uniform(9, 16)))
            elif r < 0.62:
                ps.append((x, y, z, rnd.uniform(1.3, 2.2)))
            else:
                ps3.append((x, y, z, rnd.uniform(1.3, 2.2)))
    wild_ground()
    V.scatter("WoodlandFir", fir, pf, COLL, 91)
    V.scatter("WoodlandShade", shade, ps, COLL, 92)
    V.scatter("WoodlandShade3", shade3, ps3, COLL, 93)


# ---------------------------------------------------------------- cedar play set
def _post(name, x, y, z1, z2, w, m):
    return I.box(name, x - w / 2, x + w / 2, y - w / 2, y + w / 2, z1, z2, m, 0.004)


def _beam(name, p, q, w, h, m):
    """Timber between two points (any direction), cross-section w x h."""
    d = Vector(q) - Vector(p)
    o = I.box(name, -w / 2, w / 2, -h / 2, h / 2, 0.0, d.length, m, 0.003)
    o.location = p
    o.rotation_euler = d.normalized().to_track_quat("Z", "Y").to_euler()
    return o


def playground(bm):
    for o in list(bpy.data.objects):
        if o.name.startswith(("PlayTower", "TowerPost", "Slide", "SwingA", "SwingBeam", "KidSwing", "KidRope", "Sandpit")):
            bpy.data.objects.remove(o, do_unlink=True)
    g = bm.ground
    z = g(21.8, 87.7) + 0.05
    cedar = _m("Cedar", "#b9875a", 0.6)
    cedar_dk = _m("CedarWeathered", "#8f6845", 0.7)
    canvas = _m("PlayCanvas", "#2f5d3a", 0.85)
    green = _m("SlideGreen", "#2f8a3e", 0.35)
    chain = _m("SwingChain", "#9a9a98", 0.35, 1.0)
    rubber = _m("SwingRubber", "#141414", 0.7)
    # tower 1.8 x 1.8, deck at 1.45 m
    x1, x2, y1, y2 = 22.6, 24.4, 85.4, 87.2
    zt = z + 1.45
    for (x, y) in ((x1, y1), (x2, y1), (x1, y2), (x2, y2)):
        _post(f"PlayPost{x}{y}", x, y, z - 0.05, z + 2.9, 0.11, cedar)
    for k in range(12):
        y = y1 + 0.06 + k * 0.145
        I.box(f"PlayDeck{k}", x1, x2, y, y + 0.13, zt - 0.04, zt, cedar)
    I.box("PlayDeckRimS", x1, x2, y1 - 0.03, y1 + 0.02, zt - 0.2, zt, cedar_dk)
    I.box("PlayDeckRimN", x1, x2, y2 - 0.02, y2 + 0.03, zt - 0.2, zt, cedar_dk)
    for side, (a, b, fixed, along) in {"W": (y1, y2, x1, "y"), "E": (y1, y2, x2, "y"), "N": (x1, 23.0, y2, "x"), "N2": (23.9, x2, y2, "x")}.items():
        for zz in (zt + 0.45, zt + 0.95):
            if along == "y":
                I.box(f"PlayRail{side}{zz:.2f}", fixed - 0.03, fixed + 0.03, a, b, zz - 0.04, zz + 0.04, cedar)
            else:
                I.box(f"PlayRail{side}{zz:.2f}", a, b, fixed - 0.03, fixed + 0.03, zz - 0.04, zz + 0.04, cedar)
        n = int((b - a) / 0.12)
        for k in range(1, n):
            u = a + k * (b - a) / n
            if along == "y":
                I.box(f"PlayBal{side}{k}", fixed - 0.02, fixed + 0.02, u - 0.03, u + 0.03, zt, zt + 0.95, cedar)
            else:
                I.box(f"PlayBal{side}{k}", u - 0.03, u + 0.03, fixed - 0.02, fixed + 0.02, zt, zt + 0.95, cedar)
    # canvas gable roof (ridge along x) on a timber frame
    zr0, zr1 = z + 2.9, z + 3.55
    ym = (y1 + y2) / 2
    bmm = bmesh.new()
    for (ya, za, yb, zb) in ((y1 - 0.15, zr0 - 0.08, ym, zr1), (y2 + 0.15, zr0 - 0.08, ym, zr1)):
        v = [bmm.verts.new((x1 - 0.15, ya, za)), bmm.verts.new((x2 + 0.15, ya, za)),
             bmm.verts.new((x2 + 0.15, yb, zb)), bmm.verts.new((x1 - 0.15, yb, zb))]
        bmm.faces.new(v)
    me = bpy.data.meshes.new("PlayRoof")
    bmm.to_mesh(me)
    bmm.free()
    ro = bpy.data.objects.new("PlayRoof", me)
    ro.data.materials.append(canvas)
    sol = ro.modifiers.new("t", "SOLIDIFY")
    sol.thickness = 0.01
    COLL.objects.link(ro)
    I.box("PlayRidge", x1 - 0.15, x2 + 0.15, ym - 0.04, ym + 0.04, zr1 - 0.1, zr1 + 0.01, cedar)
    for x in (x1, x2):
        _beam(f"PlayRafterS{x}", (x, y1, zr0), (x, ym, zr1), 0.06, 0.1, cedar)
        _beam(f"PlayRafterN{x}", (x, y2, zr0), (x, ym, zr1), 0.06, 0.1, cedar)
    # wave slide from the north deck edge
    sx1, sx2 = 23.15, 23.75
    bmm = bmesh.new()
    rows = []
    n = 24
    for k in range(n + 1):
        t = k / n
        y = y2 + t * 3.0
        zz = zt - 0.05 - t * (1.15) + 0.06 * math.sin(t * math.pi * 2) * (1 - t)
        if t > 0.85:
            zz = zt - 0.05 - 0.85 * 1.15 + 0.0
        prof = [(sx1 - 0.04, zz + 0.32), (sx1, zz + 0.02), (sx1 + 0.05, zz), (sx2 - 0.05, zz), (sx2, zz + 0.02), (sx2 + 0.04, zz + 0.32)]
        rows.append([bmm.verts.new((x, y, zp)) for x, zp in prof])
    for a, b in zip(rows, rows[1:]):
        for i in range(len(a) - 1):
            bmm.faces.new((a[i], a[i + 1], b[i + 1], b[i]))
    me = bpy.data.meshes.new("WaveSlide")
    bmm.to_mesh(me)
    bmm.free()
    for poly in me.polygons:
        poly.use_smooth = True
    so = bpy.data.objects.new("WaveSlide", me)
    so.data.materials.append(green)
    sol = so.modifiers.new("t", "SOLIDIFY")
    sol.thickness = 0.02
    COLL.objects.link(so)
    zexit = zt - 0.05 - 0.85 * 1.15
    for y in (y2 + 2.6, y2 + 3.0):
        _post(f"SlideLeg{y:.1f}", (sx1 + sx2) / 2, y, z - 0.05, zexit, 0.06, green)
    # rock wall on the south side
    xa, xb = (x1 + x2) / 2 - 0.5, (x1 + x2) / 2 + 0.5
    bmm = bmesh.new()
    v = [bmm.verts.new(c) for c in ((xa, y1 - 0.9, z), (xb, y1 - 0.9, z), (xb, y1 - 0.02, zt), (xa, y1 - 0.02, zt))]
    bmm.faces.new(v)
    me = bpy.data.meshes.new("RockWall")
    bmm.to_mesh(me)
    bmm.free()
    wall = bpy.data.objects.new("RockWall", me)
    wall.data.materials.append(cedar)
    wall.modifiers.new("t", "SOLIDIFY").thickness = 0.04
    COLL.objects.link(wall)
    rnd = random.Random(12)
    holds = [_m(f"Hold{c}", c, 0.6) for c in ("#d8432f", "#f2b632", "#2f7fd8", "#3fae4a", "#8a3fb0")]
    for k in range(14):
        t = rnd.uniform(0.08, 0.92)
        y = y1 - 0.9 + 0.88 * t
        zz = z + 1.45 * t
        x = (x1 + x2) / 2 + rnd.uniform(-0.38, 0.38)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.045, location=(x, y - 0.03, zz + 0.02))
        h = bpy.context.active_object
        h.name = f"Hold{k}"
        h.scale = (1.2, 0.6, 0.9)
        h.data.materials.append(rnd.choice(holds))
        for c in h.users_collection:
            c.objects.unlink(h)
        COLL.objects.link(h)
    # swing beam west of the tower, A-frame at the far end
    bz = z + 2.45
    _beam("SwingBeamReal", (18.3, ym, bz), (x1, ym, bz), 0.1, 0.18, cedar)
    for s in (-1, 1):
        _beam(f"SwingLeg{s}", (18.3, ym + s * 0.85, z - 0.05), (18.3, ym, bz), 0.1, 0.1, cedar)
    _beam("SwingBrace", (18.3, ym - 0.55, z + 0.7), (18.3, ym + 0.55, z + 0.7), 0.06, 0.1, cedar)
    for k, x in enumerate((19.3, 20.4, 21.5)):
        zs = z + 0.48
        if k < 2:                                   # belt swings
            bmm = bmesh.new()
            rows = []
            for i in range(9):
                t = i / 8
                xx = x - 0.24 + 0.48 * t
                zz = zs + 0.06 * (2 * t - 1) ** 2
                rows.append((bmm.verts.new((xx, ym - 0.08, zz)), bmm.verts.new((xx, ym + 0.08, zz))))
            for a, b in zip(rows, rows[1:]):
                bmm.faces.new((a[0], b[0], b[1], a[1]))
            me = bpy.data.meshes.new(f"BeltSwing{k}")
            bmm.to_mesh(me)
            bmm.free()
            bo = bpy.data.objects.new(f"BeltSwing{k}", me)
            bo.data.materials.append(rubber)
            bo.modifiers.new("t", "SOLIDIFY").thickness = 0.012
            COLL.objects.link(bo)
            for dx in (-0.24, 0.24):
                I.cyl(f"Chain{k}{dx}", x + dx, ym, zs + 0.06, bz - 0.09, 0.006, chain, 6)
        else:                                       # trapeze bar with rings
            I.box("TrapezeBar", x - 0.25, x + 0.25, ym - 0.015, ym + 0.015, z + 1.1, z + 1.13, _m("TrapezeYellow", "#e3b52f", 0.4))
            for dx in (-0.25, 0.25):
                I.cyl(f"TrapezeChain{dx}", x + dx, ym, z + 1.13, bz - 0.09, 0.006, chain, 6)
    # sandbox under the deck
    I.box("SandboxSand", x1 + 0.08, x2 - 0.08, y1 + 0.08, y2 - 0.08, z - 0.05, z + 0.12, M["sand"])
    for (a, b, c, d) in ((x1, x2, y1, y1 + 0.06), (x1, x2, y2 - 0.06, y2), (x1, x1 + 0.06, y1, y2), (x2 - 0.06, x2, y1, y2)):
        I.box(f"SandboxRim{a}{c}", a, b, c, d, z - 0.05, z + 0.2, cedar_dk)
    I.cyl("SandBucket", 23.1, 86.0, z + 0.12, z + 0.3, 0.09, _m("BucketRed", "#d8432f", 0.4), 16)


# ---------------------------------------------------------------- pool bar house
def bar_house(bm):
    old = bpy.data.objects.get("BarHouse")
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    for o in list(bpy.data.objects):
        if o.name.startswith("BarRail") or o.name == "BarWindowPool":
            bpy.data.objects.remove(o, do_unlink=True)
    stone = M["stone"]
    steel = _m("SteelFrame", "#121212", 0.4, 0.8)
    x1, x2, y1, y2, t, h = 29.5, 36.5, 37.0, 45.5, 0.25, 3.4
    plaster = M["plaster_int"]

    def wall(n, a1, a2, b1, b2, za, zb):
        I.box(n, a1, a2, b1, b2, za, zb, stone)

    # south wall with entry door (32.0-33.8) and a window (34.5-36.0)
    wall("BarWS1", x1, 32.0, y1, y1 + t, 0, h)
    wall("BarWS2", 33.8, 34.5, y1, y1 + t, 0, h)
    wall("BarWS3", 36.0, x2, y1, y1 + t, 0, h)
    wall("BarWSh1", 32.0, 33.8, y1, y1 + t, 2.6, h)
    wall("BarWSh2", 34.5, 36.0, y1, y1 + t, 2.4, h)
    wall("BarWSs2", 34.5, 36.0, y1, y1 + t, 0, 1.0)
    # west wall with the open serving window to the swim-up bar (41.4-44.6, 1.0-2.6)
    wall("BarWW1", x1, x1 + t, y1, 41.4, 0, h)
    wall("BarWW2", x1, x1 + t, 44.6, y2, 0, h)
    wall("BarWWs", x1, x1 + t, 41.4, 44.6, 0, 1.0)
    wall("BarWWh", x1, x1 + t, 41.4, 44.6, 2.6, h)
    # east wall solid, north (lake) wall almost all glass folding doors (30.0-36.0)
    wall("BarWE", x2 - t, x2, y1, y2, 0, h)
    wall("BarWN1", x1, 30.0, y2 - t, y2, 0, h)
    wall("BarWN2", 36.0, x2, y2 - t, y2, 0, h)
    wall("BarWNh", 30.0, 36.0, y2 - t, y2, 3.0, h)
    for o in bpy.data.objects:
        if o.name.startswith("BarW") and o.type == "MESH":
            pass
    I.box("BarFloor", x1 + t, x2 - t, y1 + t, y2 - t, 0.0, 0.01, M["limestone_paver"])
    I.box("BarCeiling", x1 + t, x2 - t, y1 + t, y2 - t, 3.3, 3.4, _m("CeilingCedar", "#a87a50", 0.6))
    for k in range(30):
        x = x1 + t + 0.1 + k * 0.215
        I.box(f"BarCeilJoint{k}", x, x + 0.008, y1 + t, y2 - t, 3.29, 3.3, _m("CeilingJoint", "#3a2a1c", 0.7))
    # glass: lake folding doors (6 leaves), door + window on the south, all in black steel
    g = bpy.data.objects.get("BarGlassLake")
    if g:
        bpy.data.objects.remove(g, do_unlink=True)
    I.box("BarLakeGlass", 30.0, 36.0, y2 - 0.14, y2 - 0.12, 0.05, 3.0, M["glass"])
    for k in range(7):
        x = 30.0 + k * 1.0
        I.box(f"BarLakeStile{k}", x - 0.03, x + 0.03, y2 - 0.17, y2 - 0.09, 0.0, 3.0, steel)
    for zz in (0.03, 1.0, 2.97):
        I.box(f"BarLakeRail{zz}", 30.0, 36.0, y2 - 0.17, y2 - 0.09, zz - 0.03, zz + 0.03, steel)
    I.box("BarDoorGlass", 32.0, 33.8, y1 + 0.11, y1 + 0.13, 0.0, 2.6, M["glass"])
    for x in (32.0, 32.9, 33.8):
        I.box(f"BarDoorStile{x}", x - 0.035, x + 0.035, y1 + 0.08, y1 + 0.16, 0.0, 2.6, steel)
    for zz in (0.06, 2.57):
        I.box(f"BarDoorRail{zz}", 32.0, 33.8, y1 + 0.08, y1 + 0.16, zz - 0.04, zz + 0.04, steel)
    for x in (32.82, 32.98):
        I.box(f"BarDoorPull{x}", x - 0.01, x + 0.01, y1 + 0.01, y1 + 0.06, 0.8, 1.6, _m("Brass", "#b08d57", 0.3, 1.0))
    I.box("BarSWinGlass", 34.5, 36.0, y1 + 0.11, y1 + 0.13, 1.0, 2.4, M["glass"])
    for (a, b, za, zb) in ((34.5, 34.56, 1.0, 2.4), (35.94, 36.0, 1.0, 2.4), (34.5, 36.0, 1.0, 1.06), (34.5, 36.0, 2.34, 2.4), (35.22, 35.28, 1.0, 2.4)):
        I.box(f"BarSWinF{a}{za}", a, b, y1 + 0.08, y1 + 0.16, za, zb, steel)
    # serving window: stone sill counter outside, steel awning above, swim-up side
    I.box("BarServeSill", x1 - 0.35, x1 + t + 0.05, 41.3, 44.7, 1.0, 1.06, M["limestone_paver"])
    I.box("BarAwning", x1 - 1.0, x1, 41.1, 44.9, 2.85, 2.9, steel)
    for y in (41.15, 44.85):
        _beam(f"BarAwningTie{y}", (x1 - 0.95, y, 2.88), (x1, y, 3.35), 0.02, 0.02, steel)
    # sconces either side of the door and the serving window
    glow = _m("SconceGlow", "#ffe2b8", 0.5, emit=((1.0, 0.72, 0.45), 6.0))
    for (x, y, nx, ny) in ((31.6, y1, 0, -1), (34.2, y1, 0, -1), (x1, 41.0, -1, 0), (x1, 45.0, -1, 0)):
        I.box(f"BarSconce{x}{y}", x - 0.07 + nx * 0.12, x + 0.07, y - 0.07 + ny * 0.12, y + 0.07, 2.2, 2.45, steel, 0.005)
        I.box(f"BarSconceGlow{x}{y}", x - 0.05 + nx * 0.13, x + 0.05 + nx * 0.0, y - 0.05 + ny * 0.13, y + 0.05 + ny * 0.0, 2.24, 2.41, glow)
        L = I.point_light(f"BarSconceL{x}{y}", (x + nx * 0.3, y + ny * 0.3, 2.3), 20, 0.05)
        L["dusk_only"] = 1
    # roof deck: glass balustrade with a slim black cap, lounge set
    zr = 3.65
    for (a, b, c, d) in ((29.35, 36.65, 36.85, 36.87), (29.35, 36.65, 45.63, 45.65), (29.35, 29.37, 36.85, 45.65),
                         (36.63, 36.65, 36.85, 41.5), (36.63, 36.65, 42.6, 45.65)):     # gap where the outside stair arrives
        I.box(f"RoofGlass{a}{c}", a, b, c, d, zr, zr + 1.0, M["glass"])
    for (a, b, c, d) in ((29.33, 36.67, 36.83, 36.89), (29.33, 36.67, 45.61, 45.67), (29.33, 29.39, 36.83, 45.67),
                         (36.61, 36.67, 36.83, 41.5), (36.61, 36.67, 42.6, 45.67)):
        I.box(f"RoofCap{a}{c}", a, b, c, d, zr + 1.0, zr + 1.05, steel)
    for y in (41.5, 42.6):
        I.box(f"RoofGatePost{y}", 36.6, 36.68, y - 0.04, y + 0.04, zr, zr + 1.05, steel)
    P.place("sofa_03", (33.0, 44.3, zr), 180, coll=COLL, name="RoofSofa")
    P.place("modern_arm_chair_01", (31.2, 42.6, zr), 250, coll=COLL, name="RoofChair1")
    P.place("modern_arm_chair_01", (34.8, 42.6, zr), 110, coll=COLL, name="RoofChair2")
    P.place("coffee_table_round_01", (33.0, 42.6, zr), 0, 0.9, coll=COLL, name="RoofTable")
    P.place("potted_plant_01", (29.9, 37.4, zr), 0, coll=COLL, name="RoofPlant1")
    P.place("potted_plant_01", (36.1, 45.1, zr), 40, coll=COLL, name="RoofPlant2")
    # interior fill so the open window and glass read lit at dusk
    L = bpy.data.lights.new("RL_barhouse", "AREA")
    L.shape, L.size, L.size_y, L.energy, L.color = "RECTANGLE", 5.0, 6.5, 260, (1.0, 0.72, 0.48)
    o = bpy.data.objects.new("RL_barhouse", L)
    o.location = (33.0, 41.25, 3.25)
    COLL.objects.link(o)


# ---------------------------------------------------------------- barbecue pavilion
def bbq_pavilion(bm):
    stain = _m("TimberStain", "#6e4b31", 0.6)
    for o in bpy.data.objects:
        if o.name.startswith("BBQ_Post"):
            o.data.materials.clear()
            o.data.materials.append(stain)
        elif o.name.startswith("BBQ_Roof") and o.name.endswith(("_roofS", "_roofN", "_roofW", "_roofE")):
            o.data.materials.clear()
            o.data.materials.append(M["metal"])
            o.data.materials.append(M["trim"])
        elif o.name in ("BBQ_Table", "BBQ_TableLeg"):
            o.hide_render = True
        elif o.name == "BBQ_Grill":
            o.data.materials.clear()
            o.data.materials.append(M["stone"])
        elif o.name == "BBQ_GrillTop":
            o.data.materials.clear()
            o.data.materials.append(_m("Granite", "#3a3836", 0.25))
    g = bm.ground
    z = g(40.5, 91.5) + 0.15
    I.box("BBQGrillHood", 38.2, 39.6, 93.15, 93.85, z + 0.9, z + 1.25, _m("Stainless", "#b8bcc0", 0.25, 1.0), 0.02)
    P.place("wooden_picnic_table", (40.5, 90.5, z), 90, coll=COLL, name="BBQPicnic")
    for k, y in enumerate((88.8, 94.2)):
        I.box(f"BBQBeamX{k}", 36.8, 44.2, y - 0.08, y + 0.08, z + 2.6, z + 2.85, stain)
    for x in (36.8, 44.2):
        I.box(f"BBQBeamY{x}", x - 0.08, x + 0.08, 88.8, 94.2, z + 2.6, z + 2.85, stain)


def lake_water():
    """Deep lake water reads dark; the sky reflection does the rest (the massing teal looked like a pool)."""
    m = M.get("lake")
    if m:
        p = m.node_tree.nodes.get("Principled BSDF")
        if p and not p.inputs["Base Color"].is_linked:
            p.inputs["Base Color"].default_value = (0.010, 0.026, 0.026, 1)


def heli_area(bm):
    """Helipad: charcoal concrete TLOF with white H and yellow touchdown ring, grass FATO; ribbed hangar door."""
    fato = bpy.data.objects.get("FATO")
    if fato:
        fato.hide_render = True
    pad = _m("PadConcrete", "#55585b", 0.75)
    white = _m("PadWhite", "#f2f2ef", 0.6)
    yellow = _m("PadYellow", "#e8b628", 0.55)
    for o in bpy.data.objects:
        if o.name == "TLOF":
            o.data.materials.clear()
            o.data.materials.append(pad)
        elif o.name.startswith("H_"):
            o.data.materials.clear()
            o.data.materials.append(white)
        elif o.name == "TD_Circle":
            o.data.materials.clear()
            o.data.materials.append(yellow)
        elif o.name.startswith("PadLight"):
            o.data.materials.clear()
            o.data.materials.append(_m("PadLightGreen", "#7fe08a", 0.3, emit=((0.4, 1.0, 0.5), 3.0)))
    door = bpy.data.objects.get("HangarDoor")
    if door:
        door.data.materials.clear()
        door.data.materials.append(_m("HangarDoorMetal", "#4a4744", 0.45, 0.6))
        x1, x2, y, z1, z2 = 54.5, 67.5, 31.08, -0.5, 4.1
        seam = _m("HangarSeam", "#2a2826", 0.6, 0.5)
        for k in range(1, 13):                          # vertical door leaves
            x = x1 + k * (x2 - x1) / 13
            I.box(f"HangarLeaf{k}", x - 0.015, x + 0.015, y, y + 0.03, z1, z2, seam)
        for k in range(1, 9):                           # horizontal ribs
            z = z1 + k * (z2 - z1) / 9
            I.box(f"HangarRib{k}", x1, x2, y, y + 0.02, z - 0.01, z + 0.01, seam)
        I.box("HangarDoorTrack", x1 - 0.3, x2 + 0.3, y, y + 0.12, z2, z2 + 0.18, seam)


def lily_pond(bm):
    """Natural lily pond: dark still water, notched lily pads in clusters, pink and white water lilies,
    and a slatted teak bench at the end of the border walk instead of the massing block."""
    water = bpy.data.objects.get("PondWater")
    if water:
        dark = _m("PondWaterDark", "#0b1a14", 0.02)
        dark.node_tree.nodes["Principled BSDF"].inputs["Specular IOR Level"].default_value = 0.6
        water.data.materials.clear()
        water.data.materials.append(dark)
    for o in list(bpy.data.objects):
        if o.name.startswith(("LilyPad", "Lily")) and o.type == "MESH":
            bpy.data.objects.remove(o, do_unlink=True)
    z = bm.ground(6.5, 68) + 0.165
    pad_m = _m("LilyPadLeaf", "#3f6a2a", 0.35, sss=0.1)
    pad_m.node_tree.nodes["Principled BSDF"].inputs["Coat Weight"].default_value = 0.5
    rnd = random.Random(21)
    bmm = bmesh.new()
    clusters = [(5.0, 69.2), (8.0, 66.6), (8.6, 69.8), (4.3, 66.5), (9.6, 67.9)]
    pads = []
    for cx, cy in clusters:
        for _ in range(rnd.randint(5, 9)):
            x, y = cx + rnd.gauss(0, 0.5), cy + rnd.gauss(0, 0.45)
            if ((x - 6.5) / 4.3) ** 2 + ((y - 68) / 3.9) ** 2 > 1:
                continue
            r = rnd.uniform(0.12, 0.26)
            if any((x - a) ** 2 + (y - b) ** 2 < (r + rr) ** 2 * 0.8 for a, b, rr in pads):
                continue
            pads.append((x, y, r))
            notch = rnd.uniform(0, 2 * math.pi)
            n = 20
            ring = []
            for k in range(n + 1):
                a = notch + 0.32 + (2 * math.pi - 0.64) * k / n
                ring.append(bmm.verts.new((x + r * math.cos(a), y + r * math.sin(a), z + rnd.uniform(0, 0.004))))
            c = bmm.verts.new((x, y, z + 0.006))
            for k in range(n):
                bmm.faces.new((c, ring[k], ring[k + 1]))
    me = bpy.data.meshes.new("LilyPads")
    bmm.to_mesh(me)
    bmm.free()
    lp = bpy.data.objects.new("LilyPads", me)
    lp.data.materials.append(pad_m)
    COLL.objects.link(lp)
    # blossoms: two rings of cupped petals with a yellow centre
    pink = _m("WaterLilyPink", "#f0a6c4", 0.45, sss=0.4)
    white = _m("WaterLilyWhite", "#f6f2ec", 0.45, sss=0.4)
    gold = _m("WaterLilyCentre", "#e8b62c", 0.5)
    bmm = bmesh.new()
    for j, (x, y, r) in enumerate(pads[::3]):
        fx, fy = x + r * 0.3, y - r * 0.2
        mi = j % 2
        for ring_i, (cnt, L, tilt) in enumerate(((10, 0.075, 0.55), (8, 0.06, 0.95))):
            for k in range(cnt):
                a = 2 * math.pi * k / cnt + ring_i * 0.3
                d = Vector((math.cos(a), math.sin(a), 0))
                up = Vector((0, 0, 1))
                tip = d * math.cos(tilt) * L + up * math.sin(tilt) * L
                side = Vector((-d.y, d.x, 0)) * 0.016
                b0 = Vector((fx, fy, z + 0.01))
                v = [bmm.verts.new(b0), bmm.verts.new(b0 + tip * 0.5 + side), bmm.verts.new(b0 + tip),
                     bmm.verts.new(b0 + tip * 0.5 - side)]
                bmm.faces.new(v).material_index = mi
        cen = bmesh.ops.create_icosphere(bmm, subdivisions=1, radius=0.014)
        bmesh.ops.translate(bmm, vec=(fx, fy, z + 0.03), verts=cen["verts"])
        for f in {f for vv in cen["verts"] for f in vv.link_faces}:
            f.material_index = 2
    me = bpy.data.meshes.new("WaterLilies")
    bmm.to_mesh(me)
    bmm.free()
    wl = bpy.data.objects.new("WaterLilies", me)
    for m in (pink, white, gold):
        wl.data.materials.append(m)
    COLL.objects.link(wl)
    # teak garden bench (replaces the massing blocks)
    for n in ("GardenBench", "GardenBenchBack"):
        o = bpy.data.objects.get(n)
        if o:
            o.hide_render = True
    teak = _m("TeakBench", "#9a7650", 0.55)
    x1, x2, yb = 6.4, 8.6, 60.55
    zb = bm.ground(7.5, 60.6)
    for k in range(5):
        y = yb - 0.22 + k * 0.1
        I.box(f"BenchSeatSlat{k}", x1, x2, y, y + 0.075, zb + 0.43, zb + 0.46, teak, 0.004)
    for k in range(4):
        zz = zb + 0.58 + k * 0.1
        I.box(f"BenchBackSlat{k}", x1, x2, yb + 0.28 + k * 0.012, yb + 0.30 + k * 0.012, zz, zz + 0.07, teak, 0.004)
    for x in (x1 + 0.06, (x1 + x2) / 2, x2 - 0.06):
        I.box(f"BenchFrame{x:.2f}", x - 0.03, x + 0.03, yb - 0.24, yb + 0.26, zb + 0.38, zb + 0.43, teak, 0.004)
    for x in (x1 + 0.06, x2 - 0.06):
        I.box(f"BenchLegF{x:.2f}", x - 0.03, x + 0.03, yb - 0.24, yb - 0.18, zb, zb + 0.66, teak, 0.004)
        I.box(f"BenchLegB{x:.2f}", x - 0.03, x + 0.03, yb + 0.26, yb + 0.32, zb, zb + 0.98, teak, 0.004)
        I.box(f"BenchArm{x:.2f}", x - 0.035, x + 0.035, yb - 0.26, yb + 0.3, zb + 0.64, zb + 0.68, teak, 0.004)


def build(bm, materials, coll):
    global COLL, M
    COLL, M = coll, materials
    I.COLL, I.M = coll, materials
    garden_paths()
    far_forest(bm)
    woodland(bm)
    playground(bm)
    bar_house(bm)
    bbq_pavilion(bm)
    heli_area(bm)
    lake_water()
    lily_pond(bm)
