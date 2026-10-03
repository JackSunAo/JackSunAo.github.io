"""Interiors after the walkthrough video: curved oak staircase with iron balusters and a stacked-ring
LED chandelier in the foyer, furnished rooms with curtains, lamps and warm light.

All coordinates are world metres (see house_real). 1F floor z = 0, 2F floor z = F1.
"""
import math
import random

import bmesh
import bpy
from mathutils import Matrix, Vector

import house_real as H
import props as P
import vegetation as V

F1, EAVE = H.F1, H.EAVE
WARM = (1.0, 0.66, 0.40)
COLL = None
M = None


# ---------------------------------------------------------------- small builders
def mat(name, hexcol, rough=0.5, metal=0.0, emit=None, sss=0.0, transmission=0.0, alpha=None):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    h = hexcol.lstrip("#")
    lin = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    p.inputs["Base Color"].default_value = (*[lin(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4)], 1)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    if emit:
        p.inputs["Emission Color"].default_value = (*emit[0], 1)
        p.inputs["Emission Strength"].default_value = emit[1]
    if sss:
        p.inputs["Subsurface Weight"].default_value = sss
    if transmission:
        p.inputs["Transmission Weight"].default_value = transmission
    if alpha is not None:
        p.inputs["Alpha"].default_value = alpha
    return m


def box(name, x1, x2, y1, y2, z1, z2, material, bevel=0.0):
    o = H._box(name, min(x1, x2), max(x1, x2), min(y1, y2), max(y1, y2), z1, z2, material, COLL)
    if bevel:
        b = o.modifiers.new("bevel", "BEVEL")
        b.width, b.segments = bevel, 3
        for p in o.data.polygons:
            p.use_smooth = True
    return o


def cyl(name, x, y, z1, z2, r, material, verts=24):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=verts, radius1=r, radius2=r, depth=z2 - z1)
    bmesh.ops.translate(bm, vec=(x, y, (z1 + z2) / 2), verts=bm.verts[:])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    o.data.materials.append(material)
    COLL.objects.link(o)
    return o


def point_light(name, loc, energy, radius=0.05, color=WARM):
    L = bpy.data.lights.new(name, "POINT")
    L.energy, L.color, L.shadow_soft_size = energy, color, radius
    o = bpy.data.objects.new(name, L)
    o.location = loc
    COLL.objects.link(o)
    return o


def table_lamp(name, x, y, z, h=0.62, shade="#efe6d6"):
    cyl(name + "_base", x, y, z, z + h * 0.55, 0.07, mat("LampCeramic", "#d8d0c4", 0.3))
    cyl(name + "_shade", x, y, z + h * 0.55, z + h, 0.19, mat("LampShade", shade, 0.7, sss=0.6, transmission=0.4), 32)
    point_light(name + "_L", (x, y, z + h * 0.75), 28, 0.08)


def rug(name, x1, x2, y1, y2, z, base="#d9cfbf", border="#6b5a48"):
    m = bpy.data.materials.get("Rug_" + base) or _rug_mat("Rug_" + base, base, border)
    box(name, x1, x2, y1, y2, z, z + 0.012, m)


def _rug_mat(name, base, border):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 140.0
    nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.inputs["Scale"].default_value = 1.4
    wave.wave_type = "RINGS"
    nt.links.new(tc.outputs["Generated"], wave.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    h = lambda s: [((int(s[i:i + 2], 16) / 255 + 0.055) / 1.055) ** 2.4 for i in (1, 3, 5)]
    ramp.color_ramp.elements[0].color = (*h(border), 1)
    ramp.color_ramp.elements[1].color = (*h(base), 1)
    ramp.color_ramp.elements[0].position = 0.35
    ramp.color_ramp.elements[1].position = 0.6
    nt.links.new(wave.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], p.inputs["Base Color"])
    p.inputs["Roughness"].default_value = 0.95
    p.inputs["Sheen Weight"].default_value = 0.5
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.4
    nt.links.new(nz.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], p.inputs["Normal"])
    return m


def curtain(name, axis, plane, u1, u2, z1, z2, inward, folds=7, depth=0.07, fabric=None):
    """Pleated curtain panel hanging in the plane `axis = plane`, spanning u1..u2, z1..z2."""
    fabric = fabric or mat("Linen", "#efe8db", 0.8, sss=0.25, transmission=0.25)
    nu, nz = folds * 6, 6
    bm = bmesh.new()
    rows = []
    for j in range(nz + 1):
        z = z1 + (z2 - z1) * j / nz
        row = []
        for i in range(nu + 1):
            t = i / nu
            u = u1 + (u2 - u1) * t
            d = inward * depth * (0.5 + 0.5 * math.sin(t * folds * 2 * math.pi)) * (0.85 + 0.15 * (j / nz))
            co = (plane + d, u, z) if axis == "x" else (u, plane + d, z)
            row.append(bm.verts.new(co))
        rows.append(row)
    for j in range(nz):
        for i in range(nu):
            bm.faces.new((rows[j][i], rows[j][i + 1], rows[j + 1][i + 1], rows[j + 1][i]))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    o = bpy.data.objects.new(name, me)
    o.data.materials.append(fabric)
    s = o.modifiers.new("thick", "SOLIDIFY")
    s.thickness = 0.008
    COLL.objects.link(o)
    return o


def bed(name, cx, cy, z, rot, w=1.95, l=2.15, linen="#f3efe7", head="#b9ad9c"):
    """Upholstered king bed; rot = direction the foot points (0 = +y, 180 = -y, 90 = -x, 270 = +x)."""
    objs = []
    L = mat("BedLinen", linen, 0.85, sss=0.1)
    Hm = mat("Headboard_" + head, head, 0.9)
    Wd = mat("BedWood", "#5a4434", 0.45)
    objs.append(box(name + "_frame", -w / 2 - 0.05, w / 2 + 0.05, -0.05, l, 0.0, 0.32, Hm, 0.03))
    objs.append(box(name + "_mattress", -w / 2, w / 2, 0.02, l - 0.03, 0.32, 0.6, L, 0.06))
    objs.append(box(name + "_duvet", -w / 2 - 0.04, w / 2 + 0.04, 0.55, l + 0.02, 0.5, 0.66, L, 0.08))
    objs.append(box(name + "_head", -w / 2 - 0.1, w / 2 + 0.1, -0.12, 0.0, 0.0, 1.35, Hm, 0.04))
    objs.append(box(name + "_throw", -w / 2 - 0.05, w / 2 + 0.05, l - 0.55, l + 0.04, 0.6, 0.68, mat("Throw", "#8c7b66", 0.9), 0.03))
    for k, px in enumerate((-w / 4, w / 4)):
        objs.append(box(f"{name}_pil{k}", px - 0.36, px + 0.36, 0.06, 0.3, 0.6, 0.86, L, 0.08))
        objs.append(box(f"{name}_pilf{k}", px - 0.3, px + 0.3, 0.22, 0.4, 0.62, 0.84, mat("Cushion", "#a99c86", 0.9), 0.07))
    rotm = Matrix.Rotation(math.radians(rot), 4, "Z")
    for o in objs:
        o.data.transform(rotm)
        o.location = (cx, cy, z)
    return objs


def nightstand(name, x, y, z, rot=0):
    o = box(name, -0.3, 0.3, -0.22, 0.22, 0, 0.6, mat("WalnutFurniture", "#4a3526", 0.4), 0.01)
    o.data.transform(Matrix.Rotation(math.radians(rot), 4, "Z"))
    o.location = (x, y, z)
    table_lamp(name + "_lamp", x, y, z + 0.6)


def bookcase(name, axis, plane, u1, u2, z1, z2, inward, depth=0.36, books=True):
    """Built-in bookcase against a wall; books from the Poly Haven decorative set."""
    wood = mat("BookcasePaint", "#2f3b36", 0.45)
    d0, d1 = plane, plane + inward * depth
    def bx(n, a1, a2, za, zb):
        if axis == "y":
            return box(n, a1, a2, min(d0, d1), max(d0, d1), za, zb, wood)
        return box(n, min(d0, d1), max(d0, d1), a1, a2, za, zb, wood)
    bx(name + "_back", u1, u2, z1, z2)
    nshel = int((z2 - z1 - 0.3) / 0.38)
    for k in range(nshel + 1):
        zz = z1 + 0.25 + k * 0.38
        bx(f"{name}_sh{k}", u1, u2, zz - 0.03, zz)
    bays = max(1, int((u2 - u1) / 0.9))
    for k in range(bays + 1):
        uu = u1 + (u2 - u1) * k / bays
        bx(f"{name}_div{k}", uu - 0.025, uu + 0.025, z1, z2)
    if not books:
        return
    lib = P.library("decorative_book_set_01", lambda n: n.startswith("book_"))
    rnd = random.Random(hash(name) & 0xffff)
    pts = []
    for k in range(nshel):
        zz = z1 + 0.25 + k * 0.38
        uu = u1 + 0.06
        while uu < u2 - 0.08:
            if rnd.random() < 0.12:
                uu += rnd.uniform(0.15, 0.35)
                continue
            mid = plane + inward * (depth * 0.55)
            pts.append((uu, mid, zz) if axis == "y" else (mid, uu, zz))
            uu += rnd.uniform(0.035, 0.05)
    V.scatter(name + "_books", lib, pts, COLL, 3, (0.95, 1.1), yaw=False)
    if axis == "x":
        bpy.data.objects[name + "_books"].rotation_euler.z = math.radians(90)
        o = bpy.data.objects[name + "_books"]
        # rotation is applied around the origin: re-place the points so they land on the shelf
        me = o.data
        for v in me.vertices:
            x, y, z = v.co
            v.co = (y, -x, z)


# ---------------------------------------------------------------- the foyer: curved stair + ring chandelier
STAIR_C = Vector((19.4, 16.1))
R_OUT, R_IN = 2.05, 0.85
N_STEPS = 22


def curved_stair():
    rise = F1 / N_STEPS
    a0, sweep = math.radians(180), math.radians(270)
    da = sweep / N_STEPS
    oak = M["floor_oak"]
    white = mat("RiserPaint", "#f2efe8", 0.45)
    slat = mat("StringerSlats", "#c9a27a", 0.5)
    iron = M["frame"]
    rail = mat("HandrailOak", "#b88a5a", 0.35)
    bm = bmesh.new()
    for i in range(N_STEPS):
        a, b = a0 + i * da, a0 + (i + 1) * da
        zt = (i + 1) * rise
        pts = []
        for ang in (a, b):
            for r in (R_IN, R_OUT):
                pts.append((STAIR_C.x + r * math.cos(ang), STAIR_C.y + r * math.sin(ang)))
        # tread (oak, 4 cm, small nosing) and riser (white)
        tv = [bm.verts.new((x, y, zt - 0.045)) for x, y in pts] + [bm.verts.new((x, y, zt)) for x, y in pts]
        for f in [(0, 2, 3, 1), (4, 5, 7, 6), (0, 1, 5, 4), (2, 6, 7, 3), (0, 4, 6, 2), (1, 3, 7, 5)]:
            face = bm.faces.new([tv[k] for k in f])
            face.material_index = 0
        rv = []
        for r in (R_IN, R_OUT):
            x, y = STAIR_C.x + r * math.cos(a), STAIR_C.y + r * math.sin(a)
            rv += [bm.verts.new((x, y, zt - rise)), bm.verts.new((x, y, zt - 0.045))]
        face = bm.faces.new((rv[0], rv[2], rv[3], rv[1]))
        face.material_index = 1
    # helicoidal soffit and the two stringers (outer one clad in vertical oak slats, as in the video)
    seg = 60
    soff, outer, inner = [], [], []
    for k in range(seg + 1):
        t = k / seg
        ang = a0 + sweep * t
        z = F1 * t
        co = math.cos(ang), math.sin(ang)
        so = (STAIR_C.x + R_OUT * co[0], STAIR_C.y + R_OUT * co[1])
        si = (STAIR_C.x + R_IN * co[0], STAIR_C.y + R_IN * co[1])
        zs = max(0.0, z - 0.38)
        soff.append((bm.verts.new((*si, zs)), bm.verts.new((*so, zs))))
        outer.append((bm.verts.new((so[0] + 0.03 * co[0], so[1] + 0.03 * co[1], zs)), bm.verts.new((so[0] + 0.03 * co[0], so[1] + 0.03 * co[1], z + 0.12))))
        inner.append((bm.verts.new((si[0] - 0.03 * co[0], si[1] - 0.03 * co[1], zs)), bm.verts.new((si[0] - 0.03 * co[0], si[1] - 0.03 * co[1], z + 0.12))))
    for k in range(seg):
        f = bm.faces.new((soff[k][0], soff[k + 1][0], soff[k + 1][1], soff[k][1])); f.material_index = 1
        f = bm.faces.new((outer[k][0], outer[k + 1][0], outer[k + 1][1], outer[k][1])); f.material_index = 2
        f = bm.faces.new((inner[k][1], inner[k + 1][1], inner[k + 1][0], inner[k][0])); f.material_index = 1
    me = bpy.data.meshes.new("CurvedStair")
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new("CurvedStair", me)
    for m_ in (oak, white, slat):
        o.data.materials.append(m_)
    COLL.objects.link(o)
    # balusters (black iron, square loops on alternate treads) and the oak handrail, outer side
    bal_pts = []
    for i in range(N_STEPS):
        for f in (0.3, 0.75):
            ang = a0 + (i + f) * da
            bal_pts.append((ang, (i + 1) * rise))
    for k, (ang, zt) in enumerate(bal_pts):
        x, y = STAIR_C.x + (R_OUT - 0.06) * math.cos(ang), STAIR_C.y + (R_OUT - 0.06) * math.sin(ang)
        box(f"Baluster{k}", x - 0.012, x + 0.012, y - 0.012, y + 0.012, zt, zt + 0.92, iron)
        if k % 4 == 0:
            box(f"BalLoop{k}", x - 0.01, x + 0.01, y - 0.01, y + 0.01, zt + 0.35, zt + 0.37, iron)
    curve = bpy.data.curves.new("Handrail", "CURVE")
    curve.dimensions = "3D"
    sp = curve.splines.new("POLY")
    n = 80
    sp.points.add(n)
    for k in range(n + 1):
        t = k / n
        ang = a0 + sweep * t
        sp.points[k].co = (STAIR_C.x + (R_OUT - 0.06) * math.cos(ang), STAIR_C.y + (R_OUT - 0.06) * math.sin(ang), F1 * t + 0.95, 1)
    curve.bevel_depth = 0.035
    curve.bevel_resolution = 3
    ho = bpy.data.objects.new("Handrail", curve)
    ho.data.materials.append(rail)
    COLL.objects.link(ho)


def railing_line(name, p0, p1, z, h=0.95):
    """Straight iron balustrade with oak cap along a 2F slab edge."""
    iron, rail = M["frame"], mat("HandrailOak", "#b88a5a", 0.35)
    (x0, y0), (x1, y1) = p0, p1
    L = math.hypot(x1 - x0, y1 - y0)
    n = max(2, int(L / 0.12))
    for k in range(n + 1):
        t = k / n
        x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
        box(f"{name}_b{k}", x - 0.011, x + 0.011, y - 0.011, y + 0.011, z, z + h, iron)
    if abs(y1 - y0) < 1e-6:
        box(name + "_cap", min(x0, x1), max(x0, x1), y0 - 0.035, y0 + 0.035, z + h, z + h + 0.05, rail, 0.015)
    else:
        box(name + "_cap", x0 - 0.035, x0 + 0.035, min(y0, y1), max(y0, y1), z + h, z + h + 0.05, rail, 0.015)


def ring_chandelier(cx, cy, z_ceiling):
    """Three stacked LED rings (black outside, warm light inside) on fine cables."""
    black = mat("RingBlack", "#141414", 0.35, 0.6)
    led = mat("RingLED", "#fff3e0", 0.4, emit=((1.0, 0.82, 0.6), 18.0))
    for k, (r, z) in enumerate(((0.95, z_ceiling - 2.2), (0.72, z_ceiling - 2.65), (0.5, z_ceiling - 3.05))):
        bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=0.03, major_segments=96, minor_segments=12,
                                         location=(cx, cy, z))
        t = bpy.context.active_object
        t.name = f"RingChand{k}"
        t.scale = (1, 1, 1.4)
        t.data.materials.append(black)
        for c in t.users_collection:
            c.objects.unlink(t)
        COLL.objects.link(t)
        bpy.ops.mesh.primitive_torus_add(major_radius=r - 0.028, minor_radius=0.012, major_segments=96, minor_segments=8,
                                         location=(cx, cy, z - 0.012))
        s = bpy.context.active_object
        s.name = f"RingLED{k}"
        s.data.materials.append(led)
        for c in s.users_collection:
            c.objects.unlink(s)
        COLL.objects.link(s)
        for j in range(3):
            a = j * 2 * math.pi / 3 + k * 0.4
            x, y = cx + r * math.cos(a), cy + r * math.sin(a)
            cyl(f"RingCable{k}{j}", x, y, z + 0.03, z_ceiling, 0.003, black, 6)
        point_light(f"RingL{k}", (cx, cy, z - 0.05), 120, 0.4)


# ---------------------------------------------------------------- rooms
def curtains_for_windows(skip=("door", "arch")):
    """A pair of pleated linen panels inside every window of a lived-in room."""
    for (n, axis, plane, a, b, z1, z2, out, style) in H.WINDOWS:
        if style in skip or n.startswith(("GR", "Kit", "Game", "Stone")):
            continue
        floor = 0.0 if z1 < F1 - 0.5 else F1
        top = min(z2 + 0.35, (F1 - 0.35) if floor == 0.0 else EAVE - 0.08)
        inner = plane - out * (H.T_EXT + 0.1)
        for side, (u1, u2) in (("L", (a - 0.45, a + 0.12)), ("R", (b - 0.12, b + 0.45))):
            curtain(f"Curtain_{n}{side}", axis, inner, u1, u2, floor + 0.02, top, -out, folds=4)
        rod_mat = M["frame"]
        if axis == "y":
            box(f"Rod_{n}", a - 0.5, b + 0.5, inner - 0.015, inner + 0.015, top, top + 0.03, rod_mat)
        else:
            box(f"Rod_{n}", inner - 0.015, inner + 0.015, a - 0.5, b + 0.5, top, top + 0.03, rod_mat)


def study():
    z = 0.0
    walnut = mat("WalnutFurniture", "#4a3526", 0.4)
    rug("StudyRug", 9.3, 13.9, 14.6, 18.0, z, "#b7a58c", "#3f3428")
    box("Desk_top", 10.6, 12.6, 16.0, 16.9, 0.74, 0.79, walnut, 0.01)
    box("Desk_pedL", 10.65, 11.15, 16.05, 16.85, 0.0, 0.74, walnut, 0.01)
    box("Desk_pedR", 12.05, 12.55, 16.05, 16.85, 0.0, 0.74, walnut, 0.01)
    P.place("ArmChair_01", (11.6, 17.35, z), 180, coll=COLL, name="StudyChair")
    P.place("mid_century_lounge_chair", (9.3, 14.7, z), 35, coll=COLL, name="StudyLounge")
    table_lamp("StudyLamp", 12.25, 16.4, 0.79, 0.5)
    bookcase("StudyShelvesN", "y", 18.925, 8.4, 14.85, 0.0, 3.6, -1)
    bookcase("StudyShelvesW", "x", 8.3, 17.4, 18.8, 0.0, 3.6, 1, books=False)
    P.place("Chandelier_02", (11.6, 16.3, F1 - 0.3 - 0.85), 0, coll=COLL, name="StudyChand")
    point_light("StudyChandL", (11.6, 16.3, F1 - 0.3 - 0.5), 60, 0.15)


def foyer():
    curved_stair()
    marble = M["paver"]
    box("FoyerMarble", 15.1, 21.9, 13.5, 20.9, 0.0, 0.006, marble)
    P.place("ClassicConsole_01", (15.4, 19.6, 0.0), 270, coll=COLL, name="FoyerConsole")
    P.place("ceramic_vase_01", (15.4, 19.3, 0.95), 0, 1.3, coll=COLL, name="FoyerVase")
    ring_chandelier(STAIR_C.x, STAIR_C.y, EAVE)
    # 2F gallery railings around the stair void (open side where the stair arrives on the north)
    z = F1
    railing_line("RailVoidW", (17.2, 13.6), (17.2, 18.6), z)
    railing_line("RailVoidS", (17.2, 13.6), (21.6, 13.6), z)
    railing_line("RailVoidE", (21.6, 13.6), (21.6, 18.6), z)
    railing_line("RailVoidN", (17.2, 18.6), (18.9, 18.6), z)
    railing_line("RailGreat", (16.0, 21.0), (25.5, 21.0), z)


def dining():
    z = 0.0
    walnut = mat("DiningWalnut", "#3e2c20", 0.35)
    rug("DiningRug", 23.0, 27.5, 12.2, 17.4, z, "#c9bea9", "#5c4f40")
    box("DiningTop", 24.55, 25.95, 13.2, 16.4, 0.74, 0.79, walnut, 0.012)
    for y in (13.7, 15.9):
        box(f"DiningTrestle{y}", 24.95, 25.55, y - 0.06, y + 0.06, 0.0, 0.74, walnut, 0.01)
    box("DiningStretcher", 25.2, 25.3, 13.7, 15.9, 0.2, 0.28, walnut)
    for k, y in enumerate((13.6, 14.8, 16.0)):
        P.place("dining_chair_02", (24.25, y, z), 270, coll=COLL, name=f"DChairW{k}")
        P.place("dining_chair_02", (26.25, y, z), 90, coll=COLL, name=f"DChairE{k}")
    P.place("dining_chair_02", (25.25, 12.75, z), 0, coll=COLL, name="DChairS")
    P.place("dining_chair_02", (25.25, 16.85, z), 180, coll=COLL, name="DChairN")
    P.place("Chandelier_03", (25.25, 14.8, F1 - 0.3), 0, coll=COLL, name="DiningChand")
    point_light("DiningChandL", (25.25, 14.8, F1 - 1.0), 90, 0.3)
    P.place("ClassicConsole_01", (28.1, 14.8, z), 90, coll=COLL, name="DiningBuffet")
    P.place("ceramic_vase_02", (28.1, 14.3, 0.95), 0, 1.2, coll=COLL)
    P.place("hanging_picture_frame_02", (28.42, 14.8, 2.1), 90, 1.6, coll=COLL, name="DiningArt")


def guest():
    z = 0.0
    rug("GuestRug", 29.4, 32.9, 16.6, 21.0, z)
    bed("GuestBed", 31.15, 21.9, z, 180)
    nightstand("GuestNSL", 29.75, 21.55, z)
    nightstand("GuestNSR", 32.55, 21.55, z)
    P.place("modern_arm_chair_01", (29.4, 10.6, z), 40, coll=COLL, name="GuestChair")
    P.place("potted_plant_01", (33.2, 10.0, z), 0, coll=COLL, name="GuestPlant")


def bedroom2():
    z = F1
    rug("Bed2Rug", 9.6, 13.6, 16.2, 20.4, z)
    bed("Bed2Bed", 11.6, 20.9, z, 180)
    nightstand("Bed2NSL", 10.2, 20.55, z)
    nightstand("Bed2NSR", 13.0, 20.55, z)
    P.place("Ottoman_01", (11.6, 16.3, z), 0, coll=COLL, name="Bed2Bench")


def bedroom4():
    z = F1
    rug("Bed4Rug", 29.4, 32.9, 16.6, 21.0, z)
    bed("Bed4Bed", 31.15, 21.9, z, 180, head="#8e9aa0")
    nightstand("Bed4NSL", 29.75, 21.55, z)
    nightstand("Bed4NSR", 32.55, 21.55, z)
    P.place("modern_arm_chair_01", (32.9, 10.4, z), 320, coll=COLL, name="Bed4Chair")


def media_room():
    """Media room from the video: TV wall flanked by vertical wood slats, accent chairs, sectional."""
    z = F1
    slat = mat("MediaSlats", "#7a5a40", 0.45)
    for k in range(26):
        x = 22.6 + k * 0.09
        if 24.3 < x < 26.2:
            continue
        box(f"MediaSlat{k}", x, x + 0.05, 19.82, 19.9, z, EAVE - 0.4, slat)
    box("TVPanel", 24.35, 26.15, 19.86, 19.9, z + 1.0, z + 2.05, mat("TVBlack", "#0b0b0c", 0.15))
    box("TVScreen", 24.4, 26.1, 19.855, 19.86, z + 1.05, z + 2.0, mat("TVScreen", "#1b2a3a", 0.1, emit=((0.55, 0.7, 1.0), 2.5)))
    box("MediaConsole", 23.6, 26.9, 19.45, 19.88, z, z + 0.5, mat("WalnutFurniture", "#4a3526", 0.4), 0.01)
    P.place("sofa_03", (25.25, 13.4, z), 0, coll=COLL, name="MediaSofa")
    P.place("modern_arm_chair_01", (24.3, 16.4, z), 200, coll=COLL, name="MediaChair1")
    P.place("modern_arm_chair_01", (26.2, 16.4, z), 160, coll=COLL, name="MediaChair2")
    P.place("modern_coffee_table_02", (25.25, 14.9, z), 0, coll=COLL, name="MediaTable")
    rug("MediaRug", 23.2, 27.3, 12.6, 17.8, z, "#bfb6a6", "#3a3a3a")
    # tray ceiling: dark wood frame around a raised centre (as in the video)
    dark = M["beam"]
    for (x1, x2, y1, y2) in ((22.1, 28.4, 11.0, 11.25), (22.1, 28.4, 19.5, 19.75), (22.1, 22.35, 11.0, 19.75), (28.15, 28.4, 11.0, 19.75)):
        box(f"MediaTray{x1}{y1}", x1, x2, y1, y2, EAVE - 0.35, EAVE, dark)
    point_light("MediaLamp", (25.25, 15.0, EAVE - 0.6), 45, 0.2)


def build(materials, coll):
    global COLL, M
    COLL, M = coll, materials
    curtains_for_windows()
    study()
    foyer()
    dining()
    guest()
    bedroom2()
    bedroom4()
    media_room()
