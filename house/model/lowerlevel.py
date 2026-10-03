"""Lower level (walk-out basement) after design/lower-level.svg:
home cinema, glass wine cellar with a tasting lounge, gym with sauna, and the lake lounge that opens
onto the lower terrace under the pool deck.

The rooms under the house are closed boxes (floor -3.9, ceiling -0.75: below the terrain surface, so the
site grid never shows inside). The lake lounge sits in the pool-deck block (floor -3.3).
"""
import math
import random

import bmesh
import bpy
from mathutils import Matrix, Vector

import assets
import interiors as I
import props as P
import vegetation as V

ZF, ZC = -3.9, -0.75          # basement floor / ceiling under the house
COLL = None
M = None


def shell(name, x1, x2, y1, y2, z1, z2, floor, ceil, walls, t=0.08):
    """Closed room: floor, ceiling and four walls as boxes outside the clear volume."""
    I.box(name + "_floor", x1 - t, x2 + t, y1 - t, y2 + t, z1 - t, z1, floor)
    I.box(name + "_ceil", x1 - t, x2 + t, y1 - t, y2 + t, z2, z2 + t, ceil)
    w = walls if isinstance(walls, (list, tuple)) else [walls] * 4
    I.box(name + "_wS", x1 - t, x2 + t, y1 - t, y1, z1, z2, w[0])
    I.box(name + "_wN", x1 - t, x2 + t, y2, y2 + t, z1, z2, w[1])
    I.box(name + "_wW", x1 - t, x1, y1, y2, z1, z2, w[2])
    I.box(name + "_wE", x2, x2 + t, y1, y2, z1, z2, w[3])


def carpet(name, hexcol, scale=900.0):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = I.mat(name, hexcol, 1.0)
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = scale
    nz.inputs["Detail"].default_value = 2.0
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.35
    bump.inputs["Distance"].default_value = 0.002
    nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
    nt.links.new(nz.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], p.inputs["Normal"])
    p.inputs["Sheen Weight"].default_value = 0.6
    return m


def light_area(name, x, y, z, sx, sy, energy, color=(1.0, 0.72, 0.48)):
    L = bpy.data.lights.new(name, "AREA")
    L.shape, L.size, L.size_y, L.energy, L.color = "RECTANGLE", sx, sy, energy, color
    o = bpy.data.objects.new(name, L)
    o.location = (x, y, z)
    COLL.objects.link(o)
    return o


# ---------------------------------------------------------------- wine bottles (instanced)
def _lathe(bm, prof, seg, mi, z0=0.0):
    rings = []
    for r, z in prof:
        if r < 1e-6:
            rings.append([bm.verts.new((0, 0, z + z0))])
            continue
        rings.append([bm.verts.new((r * math.cos(2 * math.pi * k / seg), r * math.sin(2 * math.pi * k / seg), z + z0))
                      for k in range(seg)])
    for a, b in zip(rings, rings[1:]):
        if len(a) == 1 and len(b) == 1:
            continue
        if len(a) == 1:
            for k in range(seg):
                bm.faces.new((a[0], b[k], b[(k + 1) % seg])).material_index = mi
        elif len(b) == 1:
            for k in range(seg):
                bm.faces.new((a[k], b[0], a[(k + 1) % seg])).material_index = mi
        else:
            for k in range(seg):
                bm.faces.new((a[k], b[k], b[(k + 1) % seg], a[(k + 1) % seg])).material_index = mi


def bottle_library():
    lib = bpy.data.collections.new("BottleLib")
    bpy.context.scene.collection.children.link(lib)
    lib.hide_render = lib.hide_viewport = True
    glass = I.mat("WineBottleGlass", "#0e2414", 0.06)
    glass.node_tree.nodes["Principled BSDF"].inputs["Coat Weight"].default_value = 1.0
    clear = I.mat("WineBottleClear", "#3a2a12", 0.06)
    clear.node_tree.nodes["Principled BSDF"].inputs["Coat Weight"].default_value = 1.0
    label = I.mat("WineLabel", "#ece3cf", 0.55)
    foils = [I.mat("Foil" + c, c, 0.3, 0.8) for c in ("#5e1220", "#b8954a", "#141414", "#e9e2d2")]
    bordeaux = [(0.0, 0.012), (0.024, 0.004), (0.0362, 0.0), (0.0375, 0.006), (0.0375, 0.19), (0.033, 0.21),
                (0.022, 0.228), (0.0155, 0.245), (0.0145, 0.286), (0.0162, 0.289), (0.0162, 0.298), (0.0, 0.298)]
    burgundy = [(0.0, 0.012), (0.026, 0.004), (0.0395, 0.0), (0.0405, 0.006), (0.0405, 0.15), (0.034, 0.19),
                (0.024, 0.225), (0.0155, 0.25), (0.0148, 0.288), (0.0165, 0.29), (0.0165, 0.298), (0.0, 0.298)]
    for k in range(4):
        bm = bmesh.new()
        prof = bordeaux if k % 2 == 0 else burgundy
        _lathe(bm, prof, 20, 0)
        _lathe(bm, [(0.0, 0.254), (0.0168, 0.254), (0.0168, 0.301), (0.0, 0.301)], 20, 1)       # capsule
        if k < 3:
            rr = prof[4][0] + 0.0006
            _lathe(bm, [(rr, 0.07), (rr, 0.15)], 20, 2)                                             # label band
        me = bpy.data.meshes.new(f"Bottle{k}")
        bm.to_mesh(me)
        bm.free()
        for poly in me.polygons:
            poly.use_smooth = True
        o = bpy.data.objects.new(f"Bottle{k}", me)
        for mm in ((glass if k != 1 else clear), foils[k], label):
            o.data.materials.append(mm)
        lib.objects.link(o)
    return lib


def instances(name, lib, items):
    """items: [(loc, euler, scale, variant)] -> one geometry-nodes instancer object."""
    me = bpy.data.meshes.new(name)
    me.vertices.add(len(items))
    co, rot, scl, var = [], [], [], []
    for loc, eul, s, v in items:
        co += loc
        rot += eul
        scl += (s, s, s)
        var.append(v)
    me.vertices.foreach_set("co", co)
    a = me.attributes.new("rot", "FLOAT_VECTOR", "POINT"); a.data.foreach_set("vector", rot)
    a = me.attributes.new("scl", "FLOAT_VECTOR", "POINT"); a.data.foreach_set("vector", scl)
    a = me.attributes.new("var", "INT", "POINT"); a.data.foreach_set("value", var)
    o = bpy.data.objects.new(name, me)
    COLL.objects.link(o)
    mod = o.modifiers.new("inst", "NODES")
    mod.node_group = V._instancer_group(lib)
    return o


def wine_rack(name, lib, axis, plane, u1, u2, z1, z2, inward, wood, rnd, cell=0.105, depth=0.34, led=None):
    """Floor-to-vault cubby rack, bottles lying necks-out. axis 'x' = rack along y on a wall at x=plane."""
    d0, d1 = plane, plane + inward * depth
    lo, hi = min(d0, d1), max(d0, d1)
    nu, nz = int((u2 - u1) / cell), int((z2 - z1 - 0.12) / cell)
    def bx(n, a1, a2, za, zb, dd=(lo, hi)):
        if axis == "x":
            return I.box(n, dd[0], dd[1], a1, a2, za, zb, wood)
        return I.box(n, a1, a2, dd[0], dd[1], za, zb, wood)
    bx(name + "_plinth", u1, u1 + nu * cell, z1, z1 + 0.12)
    for k in range(nz + 1):
        z = z1 + 0.12 + k * cell
        bx(f"{name}_h{k}", u1, u1 + nu * cell, z - 0.009, z + 0.009)
    for k in range(nu + 1):
        u = u1 + k * cell
        bx(f"{name}_v{k}", u - 0.009, u + 0.009, z1 + 0.12, z1 + 0.12 + nz * cell)
    if led:
        bx(name + "_led", u1, u1 + nu * cell, z1 + 0.12 + nz * cell - 0.012, z1 + 0.12 + nz * cell - 0.004,
           (hi - 0.02, hi) if inward > 0 else (lo, lo + 0.02))
    if axis == "x":
        eul = (0.0, math.pi / 2, 0.0) if inward > 0 else (0.0, -math.pi / 2, 0.0)
    else:
        eul = (-math.pi / 2, 0.0, 0.0) if inward > 0 else (math.pi / 2, 0.0, 0.0)
    items = []
    for i in range(nu):
        for k in range(nz):
            if rnd.random() < 0.06:
                continue
            u = u1 + (i + 0.5) * cell
            z = z1 + 0.12 + k * cell + 0.009 + 0.0385
            dd = plane + inward * (depth - 0.03 - 0.30 + rnd.uniform(-0.01, 0.01))
            loc = (dd, u, z) if axis == "x" else (u, dd, z)
            items.append((loc, eul, 1.0, rnd.randrange(4)))
    return instances(name + "_bottles", lib, items)


def barrel(name, x, y, z, r=0.34, h=0.95, standing=True):
    oak = I.mat("BarrelOak", "#6e4a2c", 0.6)
    hoop = I.mat("BarrelHoop", "#1d1d1f", 0.4, 0.8)
    bm = bmesh.new()
    prof = [(0.0, 0.0), (r * 0.86, 0.0)] + [(r * (0.86 + 0.14 * math.sin(math.pi * t / 10)), h * t / 10) for t in range(11)] + [(0.0, h)]
    _lathe(bm, prof, 32, 0)
    for zz in (0.08, 0.22, h - 0.22, h - 0.08):
        rr = r * (0.86 + 0.14 * math.sin(math.pi * zz / h)) + 0.004
        _lathe(bm, [(rr, zz - 0.02), (rr, zz + 0.02)], 32, 1)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for poly in me.polygons:
        poly.use_smooth = True
    o = bpy.data.objects.new(name, me)
    o.data.materials.append(oak)
    o.data.materials.append(hoop)
    o.location = (x, y, z)
    if not standing:
        o.rotation_euler = (0, math.pi / 2, 0)
        o.location = (x - h / 2, y, z + r)
    COLL.objects.link(o)
    return o


def recliner(name, x, y, z, leather, rot=0.0):
    """Home-theatre recliner facing -y (towards the screen)."""
    parts = []
    def b(n, x1, x2, y1, y2, z1, z2, m, bev):
        parts.append(I.box(f"{name}_{n}", x1, x2, y1, y2, z1, z2, m, bev))
    base = I.mat("ReclinerBase", "#141414", 0.6)
    b("base", -0.42, 0.42, -0.38, 0.40, 0.0, 0.18, base, 0.01)
    b("seat", -0.29, 0.29, -0.46, 0.34, 0.18, 0.48, leather, 0.07)
    b("armL", -0.45, -0.29, -0.42, 0.44, 0.18, 0.66, leather, 0.06)
    b("armR", 0.29, 0.45, -0.42, 0.44, 0.18, 0.66, leather, 0.06)
    b("back", -0.29, 0.29, 0.26, 0.48, 0.40, 1.05, leather, 0.08)
    b("head", -0.25, 0.25, 0.20, 0.36, 0.86, 1.08, leather, 0.06)
    for sx in (-0.37, 0.37):
        parts.append(I.cyl(f"{name}_cup{sx}", sx, -0.25, 0.62, 0.665, 0.042, I.mat("CupHolder", "#0a0a0a", 0.3, 0.6)))
    e = bpy.data.objects.new(name, None)
    e.location = (x, y, z)
    e.rotation_euler.z = rot
    COLL.objects.link(e)
    for p in parts:
        p.parent = e
    return e


# ---------------------------------------------------------------- rooms
def cinema():
    x1, x2, y1, y2 = 8.4, 16.0, 13.8, 22.8
    navy = I.mat("CinemaCeiling", "#11151d", 0.9)
    fabric = carpet("AcousticFabric", "#272b33", 1400.0)
    rug = carpet("CinemaCarpet", "#3a2629", 900.0)
    walnut = I.mat("CinemaWalnut", "#4a3122", 0.4)
    shell("Cinema", x1, x2, y1, y2, ZF, ZC, rug, navy, fabric)
    # stage + screen wall: black velvet, 3.5 m 2.39:1 screen showing a landscape, tower speakers
    velvet = I.mat("Velvet", "#070707", 1.0)
    I.box("CinemaStage", x1, x2, y1, y1 + 0.9, ZF, ZF + 0.3, velvet)
    I.box("CinemaScreenWall", x1, x2, y1, y1 + 0.03, ZF + 0.3, ZC, velvet)
    sw, sh = 3.5, 3.5 / 2.39
    cx = (x1 + x2) / 2
    zb = ZF + 0.75
    scr = bpy.data.meshes.new("CinemaScreen")
    scr.from_pydata([(cx - sw / 2, y1 + 0.05, zb), (cx + sw / 2, y1 + 0.05, zb), (cx + sw / 2, y1 + 0.05, zb + sh),
                     (cx - sw / 2, y1 + 0.05, zb + sh)], [], [(0, 1, 2, 3)])
    uv = scr.uv_layers.new()
    for i, (u, v) in enumerate(((0.36, 0.45), (0.56, 0.45), (0.56, 0.617), (0.36, 0.617))):
        uv.data[i].uv = (u, v)
    so = bpy.data.objects.new("CinemaScreen", scr)
    sm = bpy.data.materials.new("CinemaScreenImage")
    sm.use_nodes = True
    nt = sm.node_tree
    nt.nodes.remove(nt.nodes["Principled BSDF"])
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(assets.hdri("day", "1k"), check_existing=False)
    tex.image.name = "CinemaFrame"
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Strength"].default_value = 0.55
    nt.links.new(tex.outputs["Color"], em.inputs["Color"])
    nt.links.new(em.outputs["Emission"], nt.nodes["Material Output"].inputs["Surface"])
    so.data.materials.append(sm)
    COLL.objects.link(so)
    I.box("CinemaScreenFrame", cx - sw / 2 - 0.08, cx + sw / 2 + 0.08, y1 + 0.03, y1 + 0.045, zb - 0.08, zb + sh + 0.08,
          I.mat("ScreenFrame", "#050505", 0.9))
    for sx in (cx - sw / 2 - 0.55, cx + sw / 2 + 0.25):
        I.box(f"CinemaTower{sx:.1f}", sx, sx + 0.3, y1 + 0.05, y1 + 0.45, ZF + 0.3, ZF + 1.55, I.mat("SpeakerBlack", "#101010", 0.5), 0.01)
        I.box(f"CinemaGrille{sx:.1f}", sx + 0.02, sx + 0.28, y1 + 0.451, y1 + 0.455, ZF + 0.35, ZF + 1.5, fabric)
    # side walls: fabric panels between walnut fins, warm sconces
    for k in range(9):
        y = y1 + 1.2 + k * 0.95
        for xw, sgn in ((x1, 1), (x2, -1)):
            I.box(f"CinemaFin{k}{sgn}", xw, xw + sgn * 0.12, y - 0.04, y + 0.04, ZF, ZC, walnut)
            if k % 2 == 1:
                I.box(f"CinemaSconce{k}{sgn}", xw + sgn * 0.05, xw + sgn * 0.14, y + 0.3, y + 0.62, ZF + 1.75, ZF + 2.05,
                      I.mat("SconceGlow", "#ffe2b8", 0.5, emit=((1.0, 0.72, 0.45), 6.0)), 0.01)
                I.point_light(f"CinemaSconceL{k}{sgn}", (xw + sgn * 0.3, y + 0.46, ZF + 1.9), 8, 0.1)
    # star ceiling
    rnd = random.Random(7)
    bm = bmesh.new()
    for _ in range(650):
        x, y, r = rnd.uniform(x1 + 0.3, x2 - 0.3), rnd.uniform(y1 + 0.5, y2 - 0.3), rnd.uniform(0.002, 0.006)
        v = [bm.verts.new((x + r * math.cos(a), y + r * math.sin(a), ZC - 0.002)) for a in [k * math.pi / 3 for k in range(6)]]
        bm.faces.new(list(reversed(v)))
    me = bpy.data.meshes.new("StarCeiling")
    bm.to_mesh(me)
    bm.free()
    st = bpy.data.objects.new("StarCeiling", me)
    st.data.materials.append(I.mat("Stars", "#ffffff", 0.5, emit=((1.0, 0.95, 0.85), 60.0)))
    COLL.objects.link(st)
    # riser + two rows of recliners, aisle step lights
    I.box("CinemaRiser", x1, x2, 19.9, y2, ZF, ZF + 0.42, rug)
    I.box("CinemaRiserNose", x1, x2, 19.88, 19.92, ZF + 0.38, ZF + 0.42, walnut)
    I.box("CinemaStepLED", x1 + 0.2, x2 - 0.2, 19.86, 19.88, ZF + 0.36, ZF + 0.37, I.mat("StepLED", "#ffd9a8", 0.5, emit=((1.0, 0.7, 0.4), 8.0)))
    leather = I.mat("ReclinerLeather", "#4a2a1c", 0.42)
    leather.node_tree.nodes["Principled BSDF"].inputs["Coat Weight"].default_value = 0.25
    for row, (y, z) in enumerate(((18.2, ZF), (21.3, ZF + 0.42))):
        for k in range(4):
            x = cx - 1.38 + k * 0.92
            recliner(f"Recliner{row}{k}", x, y, z, leather)
    light_area("RL_cinema_cove", cx, (y1 + y2) / 2, ZC - 0.05, 6.0, 7.0, 90)


def wine_cellar(lib):
    x1, x2, y1, y2 = 16.2, 20.2, 14.0, 22.8
    stone_floor = M["paver"]
    vault = M["brick"]
    mahogany = I.mat("RackMahogany", "#3b2216", 0.5)
    shell("Cellar", x1, x2, y1, y2, ZF, ZC, stone_floor, vault, [vault, vault, vault, I.mat("Clear", "#000000", 1.0, alpha=0.0)])
    # segmental brick vault (rise 0.6 m) spanning the cellar
    spring, rise, span = ZC - 0.6, 0.6, x2 - x1
    R = (span ** 2 / 4 + rise ** 2) / (2 * rise)
    c = Vector(((x1 + x2) / 2, 0, spring + rise - R))
    half = math.asin(span / 2 / R)
    bm = bmesh.new()
    n = 24
    rows = []
    for y in (y1, y2):
        rows.append([bm.verts.new((c.x + R * math.sin(-half + 2 * half * k / n), y, c.z + R * math.cos(-half + 2 * half * k / n))) for k in range(n + 1)])
    for k in range(n):
        bm.faces.new((rows[0][k], rows[1][k], rows[1][k + 1], rows[0][k + 1]))
    me = bpy.data.meshes.new("CellarVault")
    bm.to_mesh(me)
    bm.free()
    vo = bpy.data.objects.new("CellarVault", me)
    vo.data.materials.append(vault)
    COLL.objects.link(vo)
    for y in (y1, y2):
        I.box(f"CellarTympanum{y}", x1, x2, y - 0.01, y + 0.01, spring, ZC, vault)
    rnd = random.Random(3)
    wine_rack("RackW", lib, "x", x1, y1 + 0.1, y2 - 0.1, ZF, spring - 0.05, 1, mahogany, rnd, led=True)
    wine_rack("RackS", lib, "y", y1, x1 + 0.4, x2 - 0.4, ZF, spring - 0.05, 1, mahogany, rnd, led=True)
    wine_rack("RackN", lib, "y", y2, x1 + 0.4, x2 - 0.4, ZF, spring - 0.05, -1, mahogany, rnd, led=True)
    led = I.mat("RackLED", "#fff0d8", 0.4, emit=((1.0, 0.78, 0.5), 30.0))
    for o in bpy.data.objects:
        if o.name.startswith("Rack") and o.name.endswith("_led"):
            o.data.materials[0] = led
    # barrel tasting table, glasses, decanter
    barrel("CellarBarrel", 18.6, 18.4, ZF, 0.36, 0.98)
    top = I.mat("BarrelTopGlass", "#d7e3e6", 0.03, transmission=1.0)
    I.cyl("CellarBarrelTop", 18.6, 18.4, ZF + 0.98, ZF + 1.0, 0.55, top, 48)
    glassm = I.mat("WineGlass", "#f2f5f6", 0.02, transmission=1.0)
    redwine = I.mat("RedWine", "#4a0a12", 0.05, transmission=0.6)
    for k, (dx, dy) in enumerate(((0.22, 0.1), (-0.18, 0.2), (0.05, -0.25))):
        x, y = 18.6 + dx, 18.4 + dy
        I.cyl(f"GlassStem{k}", x, y, ZF + 1.0, ZF + 1.09, 0.004, glassm, 12)
        I.cyl(f"GlassFoot{k}", x, y, ZF + 1.0, ZF + 1.003, 0.035, glassm, 24)
        I.cyl(f"GlassBowl{k}", x, y, ZF + 1.09, ZF + 1.2, 0.04, glassm, 24)
        I.cyl(f"GlassWine{k}", x, y, ZF + 1.095, ZF + 1.13, 0.037, redwine, 24)
    for k, y in enumerate((15.5, 21.3)):
        I.cyl(f"CellarPendantRod{k}", 18.2, y, ZC - 0.75, ZC, 0.004, I.mat("Brass", "#b08d57", 0.3, 1.0), 8)
        I.cyl(f"CellarPendant{k}", 18.2, y, ZC - 0.95, ZC - 0.75, 0.09, I.mat("PendantAmber", "#e8b878", 0.3, emit=((1.0, 0.62, 0.3), 5.0)), 24)
        I.point_light(f"CellarPendantL{k}", (18.2, y, ZC - 1.0), 25, 0.08)
    light_area("RL_cellar", 18.4, 18.4, spring - 0.1, 2.0, 6.0, 380)
    for k, (x, y) in enumerate(((16.9, 15.5), (16.9, 18.4), (16.9, 21.3), (18.2, 14.7), (18.2, 22.1))):
        L = bpy.data.lights.new(f"CellarGraze{k}", "SPOT")
        L.energy, L.color, L.spot_size, L.spot_blend, L.shadow_soft_size = 60, (1.0, 0.72, 0.45), math.radians(70), 0.8, 0.05
        o = bpy.data.objects.new(f"CellarGraze{k}", L)
        o.location = (x + (0.6 if x < 17 else 0), y + (0.6 if y < 15 else (-0.6 if y > 22 else 0)), spring - 0.15)
        tgt = Vector((x - (0.4 if x < 17 else 0), y - (0.4 if y < 15 else (-0.4 if y > 22 else 0)), ZF + 0.8))
        o.rotation_euler = (tgt - o.location).to_track_quat("-Z", "Y").to_euler()
        COLL.objects.link(o)
    # glass wall to the tasting lounge: black steel grid
    steel = I.mat("SteelFrame", "#121212", 0.4, 0.8)
    xg = x2
    I.box("CellarGlass", xg - 0.006, xg + 0.006, y1, y2, ZF, ZC, M["glass"])
    for y in [y1 + k * (y2 - y1) / 6 for k in range(7)]:
        I.box(f"CellarMullion{y:.2f}", xg - 0.025, xg + 0.025, y - 0.025, y + 0.025, ZF, ZC, steel)
    for z in (ZF + 0.02, ZF + 2.3, ZC - 0.02):
        I.box(f"CellarTransom{z:.2f}", xg - 0.025, xg + 0.025, y1, y2, z - 0.025, z + 0.025, steel)


def tasting_lounge():
    x1, x2, y1, y2 = 20.2, 25.6, 14.0, 22.8
    wall = I.mat("LoungeGreen", "#2e3b33", 0.8)
    shell("Tasting", x1, x2, y1, y2, ZF, ZC, M["floor_oak"], M["ceiling"], [wall, wall, I.mat("Clear", "#000000", 1.0, alpha=0.0), wall])
    for k in range(10):                                   # applied wall moulding (picture-frame panels) on the east wall
        y = y1 + 0.5 + k * 0.82
        I.box(f"TastingMould{k}", x2 - 0.02, x2, y, y + 0.66, ZF + 0.9, ZF + 0.93, wall)
        I.box(f"TastingMouldB{k}", x2 - 0.02, x2, y, y + 0.66, ZF + 2.35, ZF + 2.38, wall)
    I.rug("TastingRug", 21.2, 24.6, 15.6, 20.8, ZF, "#8a6f58", "#2d241d")
    P.place("ArmChair_01", (23.9, 17.0, ZF), 70, coll=COLL, name="TastingChair1")
    P.place("ArmChair_01", (23.9, 19.4, ZF), 110, coll=COLL, name="TastingChair2")
    P.place("sofa_02", (21.4, 18.2, ZF), 270, coll=COLL, name="TastingSofa")
    P.place("coffee_table_round_01", (22.7, 18.2, ZF), 0, coll=COLL, name="TastingTable")
    P.place("hanging_picture_frame_01", (25.58, 18.2, ZF + 1.55), 90, 1.5, coll=COLL, name="TastingArt")
    P.place("side_table_tall_01", (25.1, 15.0, ZF), 0, coll=COLL, name="TastingSide")
    P.place("potted_plant_02", (25.0, 22.2, ZF), 0, coll=COLL, name="TastingPlant")
    for k, y in enumerate((16.0, 20.4)):
        I.box(f"TastingSconce{k}", x2 - 0.12, x2 - 0.02, y - 0.08, y + 0.08, ZF + 1.75, ZF + 2.05,
              I.mat("SconceGlow", "#ffe2b8", 0.5, emit=((1.0, 0.72, 0.45), 6.0)), 0.01)
        I.point_light(f"TastingSconceL{k}", (x2 - 0.35, y, ZF + 1.9), 15, 0.1)
    P.place("Chandelier_03", (22.7, 18.2, ZC), 0, coll=COLL, name="TastingChand")
    I.point_light("TastingChandL", (22.7, 18.2, ZC - 0.7), 60, 0.25)
    light_area("RL_tasting", 22.9, 18.4, ZC - 0.05, 3.5, 6.0, 140)


def gym_spa():
    x1, x2, y1, y2 = 25.8, 33.7, 9.4, 22.8
    rubber = carpet("GymRubber", "#202224", 220.0)
    wall = M["plaster_int"]
    shell("Gym", x1, x2, y1, y2, ZF, ZC, rubber, M["ceiling"], wall)
    mirror = I.mat("Mirror", "#e8eaec", 0.02, 1.0)
    I.box("GymMirror", x2 - 0.03, x2, y1 + 0.4, y1 + 6.4, ZF + 0.3, ZF + 2.5, mirror)
    oakslat = I.mat("GymOakSlat", "#a77d52", 0.5)
    for k in range(40):
        x = x1 + 0.2 + k * 0.1
        I.box(f"GymSlat{k}", x, x + 0.05, y1, y1 + 0.03, ZF, ZC, oakslat)
    steel = I.mat("RackSteel", "#1a1b1d", 0.45, 0.8)
    chrome = I.mat("Chrome", "#d8d8d8", 0.08, 1.0)
    rubberb = I.mat("PlateRubber", "#151515", 0.75)
    # power rack + barbell
    rx, ry = 30.2, 12.2
    for (dx, dy) in ((0, 0), (1.2, 0), (0, 1.1), (1.2, 1.1)):
        I.box(f"RackPost{dx}{dy}", rx + dx - 0.04, rx + dx + 0.04, ry + dy - 0.04, ry + dy + 0.04, ZF, ZF + 2.3, steel)
    for z in (ZF + 0.05, ZF + 2.26):
        I.box(f"RackBeamF{z:.2f}", rx - 0.04, rx + 1.24, ry - 0.04, ry + 0.04, z - 0.04, z + 0.04, steel)
        I.box(f"RackBeamB{z:.2f}", rx - 0.04, rx + 1.24, ry + 1.06, ry + 1.14, z - 0.04, z + 0.04, steel)
        I.box(f"RackBeamL{z:.2f}", rx - 0.04, rx + 0.04, ry, ry + 1.1, z - 0.04, z + 0.04, steel)
        I.box(f"RackBeamR{z:.2f}", rx + 1.16, rx + 1.24, ry, ry + 1.1, z - 0.04, z + 0.04, steel)
    bz = ZF + 1.35
    bar = bpy.data.objects.new("Barbell", None)
    COLL.objects.link(bar)
    I.cyl("BarbellShaft", 0, 0, -1.1, 1.1, 0.014, chrome, 16).parent = bar
    for s in (-1, 1):
        for k, (rr, w) in enumerate(((0.225, 0.06), (0.225, 0.06), (0.16, 0.035))):
            z0 = s * (0.7 + sum(ww for _, ww in ((0.225, 0.06), (0.225, 0.06), (0.16, 0.035))[:k]))
            I.cyl(f"Plate{s}{k}", 0, 0, min(z0, z0 + s * w), max(z0, z0 + s * w), rr, rubberb, 40).parent = bar
    bar.location = (rx + 0.6, ry - 0.13, bz)
    bar.rotation_euler = (0, math.pi / 2, 0)
    # dumbbell rack along the mirror
    I.box("DBRackTop", x2 - 0.75, x2 - 0.2, y1 + 0.8, y1 + 5.8, ZF + 0.62, ZF + 0.66, steel)
    I.box("DBRackLow", x2 - 0.75, x2 - 0.2, y1 + 0.8, y1 + 5.8, ZF + 0.30, ZF + 0.34, steel)
    for (yy,) in ((y1 + 0.85,), (y1 + 5.75,)):
        I.box(f"DBRackLeg{yy:.1f}", x2 - 0.75, x2 - 0.2, yy - 0.03, yy + 0.03, ZF, ZF + 0.66, steel)
    for k in range(10):
        y = y1 + 1.0 + k * 0.47
        z = ZF + (0.66 if k % 2 == 0 else 0.34)
        hw = 0.05 + 0.006 * k
        hb = bpy.data.objects.new(f"Dumbbell{k}", None)
        COLL.objects.link(hb)
        for s in (-1, 1):
            o = I.cyl(f"DBhead{k}{s}", 0, 0, min(s * 0.07, s * (0.07 + hw)), max(s * 0.07, s * (0.07 + hw)), 0.055 + 0.004 * k, rubberb, 6)
            o.parent = hb
        I.cyl(f"DBgrip{k}", 0, 0, -0.07, 0.07, 0.016, chrome, 12).parent = hb
        hb.location = (x2 - 0.475, y, z + 0.06 + 0.055 + 0.004 * k)
        hb.rotation_euler = (0, math.pi / 2, 0)
    # flat bench, treadmill, wall TV
    pad = I.mat("BenchPad", "#121212", 0.5)
    I.box("BenchPad", 30.5, 30.82, 13.8, 15.0, ZF + 0.38, ZF + 0.46, pad, 0.02)
    I.box("BenchFrame", 30.6, 30.72, 13.9, 14.9, ZF, ZF + 0.38, steel)
    tread = I.mat("TreadBelt", "#0c0c0c", 0.8)
    for k, x in enumerate((27.0, 28.3)):
        I.box(f"TreadDeck{k}", x - 0.42, x + 0.42, 16.4, 18.4, ZF, ZF + 0.25, steel, 0.02)
        I.box(f"TreadBelt{k}", x - 0.3, x + 0.3, 16.5, 18.3, ZF + 0.25, ZF + 0.26, tread)
        I.box(f"TreadUpL{k}", x - 0.42, x - 0.36, 16.3, 16.42, ZF + 0.25, ZF + 1.3, steel)
        I.box(f"TreadUpR{k}", x + 0.36, x + 0.42, 16.3, 16.42, ZF + 0.25, ZF + 1.3, steel)
        I.box(f"TreadConsole{k}", x - 0.42, x + 0.42, 16.15, 16.45, ZF + 1.25, ZF + 1.45, steel, 0.02)
        I.box(f"TreadScreen{k}", x - 0.2, x + 0.2, 16.3, 16.31, ZF + 1.33, ZF + 1.57,
              I.mat("TreadScreenGlow", "#203040", 0.2, emit=((0.3, 0.5, 0.8), 2.0)))
    I.box("GymTV", 26.9, 28.5, y1 + 0.04, y1 + 0.09, ZF + 1.6, ZF + 2.5, I.mat("TVBlack", "#0b0b0c", 0.15))
    # sauna: cedar box with a glass front, benches, heater; glass steam shower next to it
    cedar = I.mat("Cedar", "#b9875a", 0.6)
    sx1, sx2, sy1, sy2 = 30.8, 33.6, 19.6, 22.7
    I.box("SaunaBack", sx1, sx2, sy2 - 0.05, sy2, ZF, ZF + 2.3, cedar)
    I.box("SaunaSide", sx2 - 0.05, sx2, sy1, sy2, ZF, ZF + 2.3, cedar)
    I.box("SaunaTop", sx1, sx2, sy1, sy2, ZF + 2.25, ZF + 2.3, cedar)
    I.box("SaunaSideW", sx1, sx1 + 0.05, sy1, sy2, ZF, ZF + 2.3, cedar)
    I.box("SaunaGlass", sx1 + 0.05, sx2 - 0.05, sy1 - 0.01, sy1 + 0.01, ZF + 0.05, ZF + 2.25, M["glass"])
    for k in range(2):
        z = ZF + 0.45 + k * 0.5
        I.box(f"SaunaBench{k}", sx1 + 0.05, sx2 - 0.05, sy2 - 0.55 - k * 0.0, sy2 - 0.05, z, z + 0.05, cedar)
    I.box("SaunaHeater", sx1 + 0.15, sx1 + 0.55, sy1 + 0.25, sy1 + 0.6, ZF, ZF + 0.7, steel, 0.02)
    I.box("SaunaStones", sx1 + 0.17, sx1 + 0.53, sy1 + 0.27, sy1 + 0.58, ZF + 0.7, ZF + 0.8, I.mat("SaunaStone", "#55524e", 0.9))
    I.box("SaunaGlowStrip", sx1 + 0.1, sx2 - 0.1, sy2 - 0.56, sy2 - 0.54, ZF + 0.42, ZF + 0.44,
          I.mat("SaunaLED", "#ffcf8a", 0.5, emit=((1.0, 0.6, 0.3), 8.0)))
    I.point_light("SaunaL", ((sx1 + sx2) / 2, sy2 - 0.8, ZF + 2.0), 40, 0.3)
    P.place("potted_plant_04", (x1 + 0.5, y2 - 0.5, ZF), 0, coll=COLL, name="GymPlant")
    light_area("RL_gym", (x1 + x2) / 2, (y1 + y2) / 2, ZC - 0.05, 5.0, 9.0, 1100, (1.0, 0.9, 0.8))
    strip = I.mat("GymLED", "#ffffff", 0.4, emit=((1.0, 0.95, 0.88), 14.0))
    for k in range(4):                                   # recessed linear LED lines
        x = x1 + 1.3 + k * 1.8
        I.box(f"GymLEDLine{k}", x - 0.03, x + 0.03, y1 + 0.8, y2 - 0.8, ZC - 0.012, ZC - 0.002, strip)
    I.box("GymAccent", x1, x1 + 0.02, y1 + 0.3, y2 - 0.3, ZF, ZC, I.mat("GymCharcoal", "#2a2c2f", 0.7))


def lake_lounge():
    """Walk-out lounge under the pool deck: glass wall to the lake, sectional, bar, warm light."""
    x1, x2, y1, y2 = 28.7, 34.9, 36.1, 46.0
    zf, zc = -3.3, -0.45
    I.box("LakeLoungeCeil", x1, x2, y1, y2, zc, zc + 0.05, M["ceiling"])
    I.box("LakeLoungeFloorOak", x1, x2, y1, y2, zf, zf + 0.01, M["floor_oak"])
    slat = I.mat("LoungeSlat", "#8a6444", 0.5)
    for k in range(48):
        y = y1 + 0.3 + k * 0.18
        I.box(f"LoungeSlat{k}", x1, x1 + 0.06, y, y + 0.08, zf, zc, slat)
    I.rug("LakeRug", 29.6, 33.0, 41.2, 44.8, zf + 0.01, "#d8cfbf", "#5b4c3d")
    P.place("sofa_03", (31.3, 41.4, zf), 0, coll=COLL, name="LakeSofa")
    P.place("sofa_02", (29.5, 43.2, zf), 270, coll=COLL, name="LakeSofa2")
    P.place("modern_arm_chair_01", (33.4, 44.0, zf), 150, coll=COLL, name="LakeChair")
    P.place("modern_coffee_table_01", (31.3, 43.0, zf), 0, coll=COLL, name="LakeTable")
    P.place("potted_plant_01", (34.4, 45.5, zf), 0, coll=COLL, name="LakePlant")
    # bar along the east wall
    white = I.mat("BarWhiteOak", "#c9a77c", 0.45)
    I.box("LakeBar", x2 - 0.75, x2 - 0.15, 37.0, 40.6, zf, zf + 1.05, white, 0.01)
    I.box("LakeBarTop", x2 - 0.85, x2 - 0.1, 36.9, 40.7, zf + 1.05, zf + 1.1, I.mat("CalacattaTop", "#f3f1ec", 0.12), 0.005)
    for k, y in enumerate((37.5, 38.6, 39.7)):
        P.place("bar_chair_round_01", (x2 - 1.25, y, zf), 270, coll=COLL, name=f"LakeStool{k}")
        I.cyl(f"LakePendant{k}", x2 - 0.5, y, zc - 0.85, zc - 0.6, 0.12, I.mat("PendantGlass", "#f6e7c8", 0.2, emit=((1.0, 0.7, 0.4), 6.0)), 24)
        I.cyl(f"LakePendantRod{k}", x2 - 0.5, y, zc - 0.6, zc, 0.005, I.mat("Brass", "#b08d57", 0.3, 1.0), 8)
        I.point_light(f"RL_LakePendantL{k}", (x2 - 0.5, y, zc - 0.9), 30, 0.1)
    light_area("RL_lakelounge", (x1 + x2) / 2, (y1 + y2) / 2, zc - 0.03, 4.0, 7.0, 260)
    # replace the massing glass with real glass + slim black frames
    g = bpy.data.objects.get("LoungeGlass")
    if g:
        g.data.materials.clear()
        g.data.materials.append(M["glass"])
    steel = I.mat("SteelFrame", "#121212", 0.4, 0.8)
    for x in [28.7 + k * 6.2 / 4 for k in range(5)]:
        I.box(f"LoungeMullion{x:.2f}", x - 0.03, x + 0.03, 46.08, 46.22, -3.25, -0.5, steel)
    for z in (-3.22, -0.53):
        I.box(f"LoungeRail{z}", 28.7, 34.9, 46.08, 46.22, z - 0.03, z + 0.03, steel)


def build(materials, coll):
    global COLL, M
    COLL, M = coll, materials
    I.COLL, I.M = coll, materials
    lib = bottle_library()
    cinema()
    wine_cellar(lib)
    tasting_lounge()
    gym_spa()
    lake_lounge()
