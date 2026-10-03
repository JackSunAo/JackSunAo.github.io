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
    def bx(n, a1, a2, za, zb, dd=(d0, d1)):
        if axis == "y":
            return box(n, a1, a2, min(dd), max(dd), za, zb, wood)
        return box(n, min(dd), max(dd), a1, a2, za, zb, wood)
    bx(name + "_back", u1, u2, z1, z2, (d0, d0 + inward * 0.02))       # thin back panel against the wall
    bx(name + "_plinth", u1, u2, z1, z1 + 0.1)
    bx(name + "_top", u1, u2, z2 - 0.04, z2)
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
    bookcase("StudyShelvesN", "y", 18.925, 8.4, 10.0, 0.0, 3.6, -1)
    bookcase("StudyShelvesN2", "y", 18.925, 11.0, 14.85, 0.0, 3.6, -1)
    bookcase("StudyShelvesNtop", "y", 18.925, 10.0, 11.0, 2.46, 3.6, -1)
    bookcase("SecretDoor", "y", 18.925, 10.03, 10.97, 0.0, 2.43, -1)     # hidden door to the armory
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
    box("TVScreen", 24.4, 26.1, 19.855, 19.86, z + 1.05, z + 2.0, mat("TVScreen", "#0d1218", 0.08, emit=((0.55, 0.7, 1.0), 0.35)))
    for k, y in enumerate((13.2, 16.6)):
        P.place("hanging_picture_frame_01", (28.42, y, z + 1.65), 90, 1.4, coll=COLL, name=f"MediaArt{k}")
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
    build_rear()


# ---------------------------------------------------------------- rear rooms (video): great room, kitchen, game room, master
def _pendant_rings(name, cx, cy, z_top, drop=2.4, radii=(0.75, 0.55)):
    black = mat("RingBlack", "#141414", 0.35, 0.6)
    led = mat("RingLED", "#fff3e0", 0.4, emit=((1.0, 0.82, 0.6), 18.0))
    for k, r in enumerate(radii):
        z = z_top - drop - k * 0.35
        for nm, rr, mm in ((f"{name}{k}", 0.028, black), (f"{name}{k}led", 0.011, led)):
            bpy.ops.mesh.primitive_torus_add(major_radius=r - (0.026 if mm is led else 0), minor_radius=rr,
                                             major_segments=96, minor_segments=10, location=(cx, cy, z - (0.01 if mm is led else 0)))
            t = bpy.context.active_object
            t.name = nm
            t.data.materials.append(mm)
            for c in t.users_collection:
                c.objects.unlink(t)
            COLL.objects.link(t)
        for j in range(3):
            a = j * 2 * math.pi / 3
            cyl(f"{name}{k}cab{j}", cx + r * math.cos(a), cy + r * math.sin(a), z, z_top, 0.003, black, 6)
        point_light(f"{name}{k}L", (cx, cy, z - 0.05), 70, 0.3)


def fireplace(x1, x2, y_wall, inward=-1):
    stone = M["stone"]
    d = lambda v: y_wall + inward * v
    box("FireSurround", x1 - 0.45, x2 + 0.45, d(0.0), d(0.35), 0.0, 2.6, stone)
    box("FireBox", x1, x2, d(0.3), d(0.37), 0.35, 1.25, mat("Firebox", "#141210", 0.9))
    box("FireMantel", x1 - 0.6, x2 + 0.6, d(0.0), d(0.45), 1.45, 1.55, mat("MantelOak", "#6b4c33", 0.5))
    box("FireHearth", x1 - 0.6, x2 + 0.6, d(0.0), d(0.75), 0.0, 0.25, stone)
    box("FireGlow", x1 + 0.15, x2 - 0.15, d(0.31), d(0.33), 0.4, 0.75, mat("Embers", "#ff7a2a", 0.6, emit=((1.0, 0.45, 0.15), 6.0)))
    point_light("FireL", ((x1 + x2) / 2, d(0.7), 0.6), 80, 0.3, (1.0, 0.5, 0.2))


def great_room():
    z = 0.0
    fireplace(20.05, 21.55, 28.7, -1)
    # floor-to-ceiling limestone chimney breast above the firebox (lines up with the chimney outside)
    box("FireBreast", 19.75, 21.85, 28.4, 28.7, 2.6, EAVE, M["stone"])
    rug("GreatRug", 16.7, 21.6, 23.2, 27.6, z, "#d3cab9", "#2c2c2c")
    P.place("sofa_03", (19.3, 24.1, z), 0, coll=COLL, name="GreatSofa")
    P.place("sofa_03", (17.1, 26.1, z), 270, coll=COLL, name="GreatSofa2")
    P.place("modern_arm_chair_01", (21.5, 25.4, z), 120, coll=COLL, name="GreatChair")
    P.place("modern_coffee_table_02", (19.3, 25.9, z), 0, coll=COLL, name="GreatTable")
    P.place("throw_pillows_01", (18.9, 24.0, 0.45), 0, coll=COLL, name="GreatPillows")
    P.place("side_table_01", (17.0, 24.5, z), 0, coll=COLL, name="GreatSide")
    table_lamp("GreatLamp", 17.0, 24.5, 0.55, 0.6)
    # dining in front of the windows, geometric rug, ring pendants (as in the video)
    rug("GreatDiningRug", 21.9, 25.2, 22.3, 27.6, z, "#e9e4d8", "#1d1d1d")
    walnut = mat("DiningWalnut", "#3e2c20", 0.35)
    box("GreatDiningTop", 22.95, 24.15, 23.2, 26.6, 0.74, 0.79, walnut, 0.012)
    for y in (23.7, 26.1):
        box(f"GreatDiningLeg{y}", 23.3, 23.8, y - 0.06, y + 0.06, 0.0, 0.74, walnut, 0.01)
    for k, y in enumerate((23.5, 24.9, 26.3)):
        P.place("dining_chair_02", (22.65, y, z), 270, coll=COLL, name=f"GDChairW{k}")
        P.place("dining_chair_02", (24.45, y, z), 90, coll=COLL, name=f"GDChairE{k}")
    _pendant_rings("GreatRings", 23.55, 24.9, EAVE)
    P.place("potted_plant_01", (16.6, 28.2, z), 0, coll=COLL, name="GreatPlant")
    P.place("potted_plant_01", (25.0, 28.2, z), 60, coll=COLL, name="GreatPlant2")


def marble_mat(name="CalacattaMarble"):
    """Polished white marble with soft grey veining (noise-distorted waves)."""
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = mat(name, "#f2f0eb", 0.1)
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    wv = nt.nodes.new("ShaderNodeTexWave")
    wv.inputs["Scale"].default_value = 1.6
    wv.inputs["Distortion"].default_value = 14.0
    wv.inputs["Detail"].default_value = 6.0
    wv.inputs["Detail Scale"].default_value = 2.0
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (0.42, 0.42, 0.43, 1)
    ramp.color_ramp.elements[1].position = 0.12
    ramp.color_ramp.elements[1].color = (0.88, 0.87, 0.85, 1)
    nt.links.new(tc.outputs["Object"], wv.inputs["Vector"])
    nt.links.new(wv.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], p.inputs["Base Color"])
    p.inputs["Coat Weight"].default_value = 0.4
    return m


def _front(axis, plane, out):
    """Box builder in a cabinet-front frame: u along the run, d outward from the front plane."""
    def fb(n, u1, u2, d1, d2, z1, z2, m, bev=0.0):
        if axis == "x":
            return box(n, plane + out * d1, plane + out * d2, u1, u2, z1, z2, m, bev)
        return box(n, u1, u2, plane + out * d1, plane + out * d2, z1, z2, m, bev)
    return fb


def shaker(name, axis, plane, out, u1, u2, z1, z2, n, paint, pull, horizontal_pull=False):
    """Row of shaker doors/drawers: slab + raised frame + brass pull, 3 mm reveals."""
    fb = _front(axis, plane, out)
    w = (u2 - u1) / n
    for k in range(n):
        a, b = u1 + k * w + 0.0015, u1 + (k + 1) * w - 0.0015
        fb(f"{name}{k}_slab", a, b, 0.0, 0.018, z1 + 0.0015, z2 - 0.0015, paint)
        fw = min(0.065, (z2 - z1) * 0.22)
        for j, (ua, ub, za, zb) in enumerate(((a, a + fw, z1, z2), (b - fw, b, z1, z2), (a, b, z1, z1 + fw), (a, b, z2 - fw, z2))):
            fb(f"{name}{k}_fr{j}", ua, ub, 0.018, 0.03, za + 0.0015, zb - 0.0015, paint)
        if horizontal_pull:
            m = (a + b) / 2
            fb(f"{name}{k}_pull", m - 0.08, m + 0.08, 0.03, 0.05, (z1 + z2) / 2 - 0.007, (z1 + z2) / 2 + 0.007, pull)
        else:
            uu = b - 0.05 if k % 2 == 0 else a + 0.05
            zz = z2 - 0.18 if z2 < 1.2 else (z1 + 0.15 if z2 - z1 < 1.5 else 1.05)
            fb(f"{name}{k}_pull", uu - 0.007, uu + 0.007, 0.03, 0.05, zz - 0.08, zz + 0.08, pull)


def xz_prism(name, pts, y1, y2, m):
    bmm = bmesh.new()
    a = [bmm.verts.new((x, y1, zz)) for x, zz in pts]
    b = [bmm.verts.new((x, y2, zz)) for x, zz in pts]
    bmm.faces.new(a)
    bmm.faces.new(list(reversed(b)))
    for i in range(len(pts)):
        j = (i + 1) % len(pts)
        bmm.faces.new((a[i], a[j], b[j], b[i]))
    bmesh.ops.recalc_face_normals(bmm, faces=bmm.faces)
    me = bpy.data.meshes.new(name)
    bmm.to_mesh(me)
    bmm.free()
    o = bpy.data.objects.new(name, me)
    o.data.materials.append(m)
    COLL.objects.link(o)
    return o


def cone_pendant(name, x, y, z_ceiling, z_bottom, r=0.2):
    black = mat("PendantBlack", "#151515", 0.45, 0.3)
    brass = mat("Brass", "#b08d57", 0.3, 1.0)
    bmm = bmesh.new()
    seg = 40
    rings = []
    for rr, zz in ((r, z_bottom), (r * 0.25, z_bottom + 0.26), (0.03, z_bottom + 0.3)):
        rings.append([bmm.verts.new((x + rr * math.cos(2 * math.pi * k / seg), y + rr * math.sin(2 * math.pi * k / seg), zz)) for k in range(seg)])
    for ra, rb in zip(rings, rings[1:]):
        for k in range(seg):
            bmm.faces.new((ra[k], ra[(k + 1) % seg], rb[(k + 1) % seg], rb[k]))
    me = bpy.data.meshes.new(name)
    bmm.to_mesh(me)
    bmm.free()
    for p in me.polygons:
        p.use_smooth = True
    o = bpy.data.objects.new(name, me)
    o.data.materials.append(black)
    sol = o.modifiers.new("shell", "SOLIDIFY")
    sol.thickness = 0.004
    COLL.objects.link(o)
    cyl(name + "_rim", x, y, z_bottom - 0.004, z_bottom + 0.006, r + 0.003, brass, 40)
    cyl(name + "_rod", x, y, z_bottom + 0.3, z_ceiling, 0.005, brass, 8)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.055, location=(x, y, z_bottom + 0.12))
    b = bpy.context.active_object
    b.name = name + "_bulb"
    b.data.materials.append(mat("BulbWarm", "#fff3e0", 0.3, emit=((1.0, 0.78, 0.5), 25.0)))
    for c in b.users_collection:
        c.objects.unlink(b)
    COLL.objects.link(b)
    point_light(name + "_L", (x, y, z_bottom + 0.05), 45, 0.06)


def kitchen():
    z = 0.0
    white = mat("CabinetWhite", "#f1eee7", 0.35)
    marble = marble_mat()
    brass = mat("Brass", "#b08d57", 0.3, 1.0)
    steel = mat("Stainless", "#b8bcc0", 0.25, 1.0)
    kick = mat("ToeKick", "#3a3632", 0.6)
    # east wall: base runs either side of a 48" range, marble counter + full-height splash, uppers, plaster hood
    xe = 33.7
    for k, (ya, yb) in enumerate(((22.15, 24.92), (26.18, 29.25))):
        box(f"KBaseE{k}", 33.1, xe, ya, yb, 0.1, 0.9, white)
        box(f"KKickE{k}", 33.16, xe, ya, yb, 0.0, 0.1, kick)
        nd = max(2, round((yb - ya) / 0.6))
        shaker(f"KDrawE{k}", "x", 33.1, -1, ya, yb, 0.7, 0.9, nd, white, brass, True)
        shaker(f"KDoorE{k}", "x", 33.1, -1, ya, yb, 0.1, 0.7, nd, white, brass)
        box(f"KTopE{k}", 33.04, xe, ya, yb, 0.9, 0.94, marble)
        box(f"KUpperE{k}", 33.36, xe, ya, yb if k else 24.75, 1.5, 2.45, white)
        shaker(f"KUpDoorE{k}", "x", 33.36, -1, ya, yb if k else 24.75, 1.5, 2.45, nd, white, brass)
        box(f"KCrownE{k}", 33.32, xe, ya, yb if k else 24.75, 2.45, 2.53, white)
        box(f"KUnderLED{k}", 33.4, 33.44, ya + 0.05, (yb if k else 24.75) - 0.05, 1.49, 1.5,
            mat("UnderCabLED", "#fff3e0", 0.4, emit=((1.0, 0.8, 0.55), 8.0)))
    box("KSplashE", xe - 0.02, xe, 22.15, 29.25, 0.94, 1.5, marble)
    box("KSplashRange", xe - 0.02, xe, 24.75, 26.35, 1.5, 1.95, marble)
    box("KRangeBody", 33.06, xe, 24.95, 26.15, 0.0, 0.92, steel, 0.004)
    box("KRangeTop", 33.06, xe, 24.95, 26.15, 0.92, 0.935, mat("CooktopBlack", "#121212", 0.35))
    for k in range(6):
        y = 25.0 + k * 0.2
        box(f"KGrate{k}", 33.1, xe - 0.04, y, y + 0.018, 0.935, 0.95, mat("CastIron", "#1b1b1b", 0.6, 0.5))
    for k, (ya, yb) in enumerate(((24.98, 25.54), (25.56, 26.12))):
        box(f"KOvenDoor{k}", 33.05, 33.065, ya, yb, 0.12, 0.72, steel)
        box(f"KOvenWin{k}", 33.045, 33.05, ya + 0.08, yb - 0.08, 0.3, 0.58, mat("OvenGlass", "#0c0c0d", 0.05))
        box(f"KOvenBar{k}", 32.99, 33.01, ya + 0.04, yb - 0.04, 0.66, 0.68, steel)
    for k in range(6):
        y = 25.05 + k * 0.2
        bpy.ops.mesh.primitive_cylinder_add(radius=0.022, depth=0.03, location=(33.03, y, 0.82), rotation=(0, math.pi / 2, 0))
        kb = bpy.context.active_object
        kb.name = f"KKnob{k}"
        kb.data.materials.append(mat("KnobBlack", "#161616", 0.4, 0.6))
        for c in kb.users_collection:
            c.objects.unlink(kb)
        COLL.objects.link(kb)
    box("KHoodBand", 33.0, xe, 24.8, 26.3, 1.95, 2.2, white, 0.005)
    box("KHoodStrap", 32.995, 33.0, 24.8, 26.3, 1.98, 2.02, brass)
    xz_prism("KHoodTaper", [(33.0, 2.2), (xe, 2.2), (xe, 3.65), (33.3, 3.65)], 24.8, 26.3, white)
    # south wall: pantry tower between the two doors, stainless fridge column by the east run
    shaker("KPantry", "y", 22.75, 1, 27.75, 30.2, 0.1, 2.6, 4, white, brass)
    box("KPantryBox", 27.75, 30.2, 22.1, 22.75, 0.0, 2.6, white)
    box("KPantryCrown", 27.72, 30.23, 22.1, 22.8, 2.6, 2.7, white)
    box("KFridge", 32.0, 33.04, 22.1, 22.8, 0.0, 2.15, steel, 0.004)
    box("KFridgeSplit", 32.515, 32.525, 22.8, 22.805, 0.05, 2.1, mat("FridgeSeam", "#2a2a2a", 0.5))
    for x in (32.45, 32.59):
        box(f"KFridgeHandle{x}", x - 0.012, x + 0.012, 22.84, 22.87, 0.6, 1.6, steel)
        box(f"KFridgeHandleS{x}a", x - 0.008, x + 0.008, 22.8, 22.84, 0.62, 0.66, steel)
        box(f"KFridgeHandleS{x}b", x - 0.008, x + 0.008, 22.8, 22.84, 1.54, 1.58, steel)
    box("KFridgeCab", 32.0, 33.04, 22.1, 22.75, 2.15, 2.6, white)
    # north wall: base run under the windows (counter at the sill line)
    box("KBaseN", 25.95, 30.1, 28.68, 29.3, 0.1, 0.86, white)
    box("KKickN", 25.95, 30.1, 28.74, 29.3, 0.0, 0.1, kick)
    shaker("KDoorN", "y", 28.68, -1, 25.95, 30.1, 0.1, 0.86, 7, white, brass)
    box("KTopN", 25.95, 30.1, 28.62, 29.3, 0.86, 0.9, marble)
    # island: marble waterfall, sink + brass faucet, panelled fronts, stools on the south side
    box("IslandBase", 28.05, 31.55, 24.75, 25.8, 0.1, 0.9, white)
    box("IslandKick", 28.1, 31.5, 24.8, 25.75, 0.0, 0.1, kick)
    shaker("IslandFrontN", "y", 25.8, 1, 28.05, 31.55, 0.1, 0.9, 6, white, brass)
    shaker("IslandBackS", "y", 24.75, -1, 28.05, 31.55, 0.1, 0.9, 4, white, brass, True)
    box("IslandTop", 27.95, 31.65, 24.45, 25.9, 0.9, 0.95, marble)
    for x in (27.9, 31.65):
        box(f"IslandWaterfall{x}", x, x + 0.05, 24.45, 25.9, 0.0, 0.95, marble)
    box("IslandSink", 29.4, 30.2, 25.25, 25.7, 0.93, 0.951, mat("SinkSteel", "#3a3b3d", 0.25, 1.0))
    cyl("FaucetBody", 29.8, 25.8, 0.95, 1.36, 0.016, brass, 16)
    box("FaucetSpout", 29.785, 29.815, 25.5, 25.81, 1.33, 1.36, brass)
    cyl("FaucetHead", 29.8, 25.5, 1.27, 1.36, 0.017, brass, 16)
    for k, x in enumerate((28.6, 29.8, 31.0)):
        P.place("bar_chair_round_01", (x, 24.05, z), 0, coll=COLL, name=f"IslandStool{k}")
        cone_pendant(f"IslandPendant{k}", x, 25.15, F1 - H.SLAB, 2.35)
    # a few lived-in things: bowl of lemons, vase with olive branches, board, cookbooks, coffee machine
    bowl = mat("BowlCeramic", "#e9e4da", 0.3)
    cyl("IslandBowl", 30.75, 25.3, 0.95, 1.03, 0.16, bowl, 32)
    lemon = mat("Lemon", "#e3c23a", 0.45)
    rnd = random.Random(4)
    for k in range(7):
        a = k * 0.9
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.04, segments=16, ring_count=10,
                                             location=(30.75 + 0.08 * math.cos(a), 25.3 + 0.08 * math.sin(a), 1.06 + 0.02 * (k % 2)))
        l = bpy.context.active_object
        l.name = f"Lemon{k}"
        l.scale = (1, 1, 0.85)
        l.data.materials.append(lemon)
        for c in l.users_collection:
            c.objects.unlink(l)
        COLL.objects.link(l)
    P.place("ceramic_vase_02", (28.5, 25.4, 0.95), 0, 1.1, coll=COLL, name="IslandVase")
    box("CuttingBoard", 33.15, 33.6, 27.6, 28.05, 0.94, 0.965, mat("BoardOak", "#a77a4c", 0.5), 0.004)
    box("CoffeeMachine", 33.3, 33.66, 22.5, 22.85, 0.94, 1.36, steel, 0.01)
    for k, c in enumerate(("#7a2b22", "#2a3f5a", "#d9cdb4")):
        box(f"Cookbook{k}", 33.45, 33.68, 28.4 + k * 0.045, 28.44 + k * 0.045, 0.94, 1.2, mat("Book_" + c, c, 0.6))
    P.place("potted_plant_04", (26.3, 28.95, 0.9), 0, 0.6, coll=COLL, name="KitchenHerb")


def game_room():
    z = F1
    teal = M["teal"]
    beam = M["beam"]
    plaster = M["plaster_int"]
    xL, xR, xm = 25.6, 33.7, 29.75
    yS, yN = 22.1, 29.28
    ridge_z = EAVE + (xm - 25.5) * 1.0 - 0.32
    # vaulted plaster ceiling under the lake gable
    for nm, (xa, xb) in (("VaultW", (xL, xm)), ("VaultE", (xm, xR))):
        za = EAVE + (0.0 if xa == xL else (xm - 25.5) - 0.32)
        zb = EAVE + ((xm - 25.5) - 0.32 if xa == xL else 0.0)
        bmm = bmesh.new()
        v = [bmm.verts.new(c) for c in ((xa, yS, za), (xb, yS, zb), (xb, yN, zb), (xa, yN, za))]
        bmm.faces.new(v)
        me = bpy.data.meshes.new(nm)
        bmm.to_mesh(me)
        bmm.free()
        o = bpy.data.objects.new(nm, me)
        o.data.materials.append(plaster)
        COLL.objects.link(o)
    # teal accent wall on the lake gable (wall + triangle), windows cut out
    bmm = bmesh.new()
    pts = [(xL, z), (xR, z), (xR, EAVE), (xm, ridge_z), (xL, EAVE)]
    f0 = [bmm.verts.new((x, yN, zz)) for x, zz in pts]
    f1 = [bmm.verts.new((x, yN - 0.02, zz)) for x, zz in pts]
    bmm.faces.new(f0)
    bmm.faces.new(list(reversed(f1)))
    for i in range(len(pts)):
        j = (i + 1) % len(pts)
        bmm.faces.new((f0[i], f1[i], f1[j], f0[j]))
    me = bpy.data.meshes.new("TealWall")
    bmm.to_mesh(me)
    bmm.free()
    tw = bpy.data.objects.new("TealWall", me)
    tw.data.materials.append(teal)
    COLL.objects.link(tw)
    boxes = [(a, b, yN - 0.5, yN + 0.5, z1, z2) for (n, ax, pl, a, b, z1, z2, out, st) in H.WINDOWS if n.startswith("Game")]
    cut = H._cutter_from_boxes(None, "TealCuts", boxes, COLL)
    H._boolean(tw, cut)
    # espresso trusses: rafters on both slopes, collar ties, ridge beam (video)
    for k, y in enumerate((22.9, 24.7, 26.5, 28.3)):
        for side in (-1, 1):
            xa, xb = (xL, xm) if side < 0 else (xm, xR)
            za, zb = (EAVE, ridge_z) if side < 0 else (ridge_z, EAVE)
            L = math.hypot(xb - xa, zb - za)
            o = box(f"Rafter{k}{side}", -L / 2, L / 2, -0.09, 0.09, -0.14, 0.0, beam)
            o.location = ((xa + xb) / 2, y, (za + zb) / 2 - 0.02)
            o.rotation_euler = (0, -math.atan2(zb - za, xb - xa), 0)
        tie_z = EAVE + 1.25
        dx = (tie_z - EAVE)
        box(f"CollarTie{k}", xL + dx, xR - dx, y - 0.09, y + 0.09, tie_z - 0.22, tie_z, beam)
    box("RidgeBeam", xm - 0.1, xm + 0.1, yS, yN, ridge_z - 0.25, ridge_z, beam)
    # pool table (teal felt, dark wood), sputnik chandelier, window seat + Roman shades, sectional
    wood = mat("PoolTableWood", "#3b2618", 0.35)
    felt = mat("PoolFelt", "#1f5a66", 0.9)
    box("PTBase", 28.7, 30.9, 24.4, 27.9, z + 0.25, z + 0.72, wood, 0.03)
    box("PTFelt", 28.85, 30.75, 24.55, 27.75, z + 0.72, z + 0.78, felt)
    for (x1, x2, y1, y2) in ((28.6, 31.0, 24.3, 24.55), (28.6, 31.0, 27.75, 28.0), (28.6, 28.85, 24.3, 28.0), (30.75, 31.0, 24.3, 28.0)):
        box(f"PTRail{x1}{y1}", x1, x2, y1, y2, z + 0.72, z + 0.82, wood, 0.015)
    for (x, y) in ((29.0, 24.7), (30.6, 24.7), (29.0, 27.6), (30.6, 27.6)):
        box(f"PTLeg{x}{y}", x - 0.12, x + 0.12, y - 0.12, y + 0.12, z, z + 0.3, wood, 0.02)
    gold = mat("SputnikGold", "#c7a15a", 0.25, 1.0)
    bulb = mat("SputnikBulb", "#fff6e6", 0.2, emit=((1.0, 0.85, 0.65), 25.0))
    cz = ridge_z - 1.6
    cyl("SputnikRod", 29.8, 26.15, cz, ridge_z - 0.25, 0.01, gold, 8)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.09, location=(29.8, 26.15, cz))
    s = bpy.context.active_object
    s.name = "SputnikHub"
    s.data.materials.append(gold)
    for c in s.users_collection:
        c.objects.unlink(s)
    COLL.objects.link(s)
    rnd = random.Random(5)
    for k in range(28):
        d = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1))).normalized()
        L = rnd.uniform(0.35, 0.55)
        p = Vector((29.8, 26.15, cz)) + d * L / 2
        o = box(f"SputnikArm{k}", -0.006, 0.006, -0.006, 0.006, -L / 2, L / 2, gold)
        o.location = p
        o.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.025, segments=10, ring_count=6, location=Vector((29.8, 26.15, cz)) + d * L)
        b = bpy.context.active_object
        b.name = f"SputnikBulb{k}"
        b.data.materials.append(bulb)
        for c in b.users_collection:
            c.objects.unlink(b)
        COLL.objects.link(b)
    point_light("SputnikL", (29.8, 26.15, cz), 140, 0.4)
    seat = mat("WindowSeat", "#f1eee7", 0.4)
    cush = mat("SeatCushion", "#e9e4da", 0.85)
    box("WindowSeat", 26.1, 33.5, 28.75, 29.28, z, z + 0.45, seat, 0.01)
    box("WindowSeatCush", 26.15, 33.45, 28.78, 29.25, z + 0.45, z + 0.55, cush, 0.03)
    pillows = ["#24495a", "#f3efe7", "#9c2f2f", "#24495a", "#f3efe7", "#1f1f1f"]
    for k, c in enumerate(pillows):
        x = 26.5 + k * 1.2
        o = box(f"SeatPillow{k}", x - 0.22, x + 0.22, 28.95, 29.1, z + 0.55, z + 0.95, mat("Pillow_" + c, c, 0.9), 0.06)
    shade = mat("RomanShade", "#efe9dd", 0.85, sss=0.3)
    for (n, ax, pl, a, b, z1, z2, out, st) in H.WINDOWS:
        if n.startswith("Game") and n != "GameHigh" and n != "GameE":
            for f in range(4):
                zz = z2 - 0.05 - f * 0.1
                box(f"Shade_{n}{f}", a - 0.05, b + 0.05, 29.2, 29.27, zz - 0.11, zz, shade, 0.02)
    railing_line("RailLoft", (25.58, 22.62), (25.58, 28.78), z)       # loft overlooking the great room
    P.place("sofa_03", (27.0, 25.4, z), 270, coll=COLL, name="GameSofa")
    rug("GameRug", 28.0, 31.6, 23.8, 28.5, z, "#9aa3a8", "#2f3b40")
    P.place("dartboard", (33.68, 23.4, z + 1.73), 270, coll=COLL, name="Dartboard")
    box("GameRedCabinet", 33.1, 33.68, 27.6, 28.6, z, z + 1.0, mat("RedLacquer", "#8f1f1f", 0.3), 0.01)


def master():
    z = 0.0
    rug("MasterRug", 9.4, 14.6, 23.6, 27.6, z, "#ddd5c6", "#8a7c66")
    bed("MasterBed", 12.0, 23.15, z, 0, 2.05, 2.2, head="#c9bfae")
    nightstand("MasterNSL", 10.55, 23.5, z)
    nightstand("MasterNSR", 13.45, 23.5, z)
    P.place("Ottoman_01", (12.0, 26.1, z), 0, coll=COLL, name="MasterBench")
    P.place("mid_century_lounge_chair", (9.2, 27.8, z), 140, coll=COLL, name="MasterLounge")
    P.place("Chandelier_02", (12.0, 25.0, F1 - 0.3 - 0.85), 0, coll=COLL, name="MasterChand")
    point_light("MasterChandL", (12.0, 25.0, F1 - 0.3 - 0.5), 50, 0.15)


def build_rear():
    great_room()
    kitchen()
    game_room()
    master()
