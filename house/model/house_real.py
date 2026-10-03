"""The main house as real construction: hollow exterior walls with thickness, floor and ceiling slabs,
interior partitions with door openings, window/door openings cut through the walls, gable roofs
whose end walls only exist where they are real walls, and room data for interiors and lighting.

Volumes (outer faces, metres; Y toward the lake):
  main     x  8   – 25.5, y 13.5 – 29    ridge along X   (west wing + centre, great room)
  stone    x 15   – 22,   y 13.2 – 22    ridge along Y   (front stone gable, stair hall)
  brick    x 22   – 28.5, y 10.5 – 22    ridge along X   (brick wing: dining / media room)
  east     x 28.5 – 34,   y  9   – 22    ridge along Y   (east front gable: guest suite / bedroom 4)
  rear     x 25.5 – 34,   y 22   – 29.6  ridge along Y   (lake gable: kitchen / vaulted game room)
"""
import math

import bmesh
import bpy

F1, F2 = 4.0, 3.4
EAVE = F1 + F2                 # 7.4
T_EXT, T_INT = 0.3, 0.15       # wall thicknesses
SLAB = 0.3

FOOTPRINT = [(8, 13.5), (15, 13.5), (15, 13.2), (22, 13.2), (22, 10.5), (28.5, 10.5), (28.5, 9.0), (34, 9.0),
             (34, 29.6), (25.5, 29.6), (25.5, 29), (8, 29)]          # counter-clockwise

ROOFS = [  # name, x1, x2, y1, y2, eave z, ridge axis, pitch, overhang, end walls [(side, material)]
    ("Main", 8, 25.5, 13.5, 29, EAVE, "x", 1.1, 0.45, [("x1", "siding"), ("x2", "brick")]),
    ("StoneGable", 15, 22, 13.2, 22, EAVE + 0.4, "y", 1.6, 0.35, [("y1", "stone")]),
    ("BrickWing", 22, 28.5, 10.5, 22, EAVE, "x", 1.15, 0.4, [("x1", "brick"), ("x2", "brick")]),
    ("EastGable", 28.5, 34, 9.0, 22, EAVE, "y", 1.5, 0.4, [("y1", "brick")]),
    ("RearGable", 25.5, 34, 22, 29.6, EAVE, "y", 1.0, 0.4, [("y1", "plaster"), ("y2", "brick")]),
]

# ---------------------------------------------------------------- openings
# (name, axis, plane, a, b, z1, z2, out, style); plane = outer wall face, out = outward direction
WINDOWS = [
    # front – stone gable
    ("FrontDoor", "y", 13.2, 20.85, 21.85, 0.0, 2.9, -1, "door"),
    ("StoneUp", "y", 13.2, 16.8, 20.2, 4.4, 6.9, -1, "stone"),
    ("StoneDn1", "y", 13.2, 15.9, 17.7, 0.0, 3.0, -1, "stone"),
    ("StoneDn2", "y", 13.2, 18.5, 20.3, 0.0, 3.0, -1, "stone"),
    # front – west wing (porch): glass doors below, triple window above
    ("WestDn1", "y", 13.5, 9.2, 11.8, 0.0, 3.0, -1, "siding"),
    ("WestDn2", "y", 13.5, 12.6, 14.4, 0.0, 3.0, -1, "siding"),
    ("WestUp1", "y", 13.5, 9.0, 10.5, 4.6, 6.4, -1, "siding"),
    ("WestUp2", "y", 13.5, 10.65, 12.15, 4.6, 6.4, -1, "siding"),
    ("WestUp3", "y", 13.5, 12.3, 13.8, 4.6, 6.4, -1, "siding"),
    # front – brick wing
    ("BrickDn1", "y", 10.5, 22.7, 25.0, 0.4, 3.0, -1, "brick"),
    ("BrickDn2", "y", 10.5, 25.5, 27.8, 0.4, 3.0, -1, "brick"),
    ("BrickUp1", "y", 10.5, 23.0, 23.8, 4.3, 6.3, -1, "brick"),
    ("BrickUp2", "y", 10.5, 24.85, 25.65, 4.3, 6.3, -1, "brick"),
    ("BrickUp3", "y", 10.5, 26.7, 27.5, 4.3, 6.3, -1, "brick"),
    # front – east gable
    ("EastDn", "y", 9.0, 29.9, 32.6, 0.4, 3.0, -1, "brick"),
    ("EastUp", "y", 9.0, 30.8, 31.8, 4.3, 6.3, -1, "brick"),
    ("EastAttic", "y", 9.0, 31.0, 31.6, 7.8, 8.7, -1, "brick"),
    # rear – great room wall of glass (doors below, transoms above), west wing
    ("GR1", "y", 29.0, 16.4, 18.0, 0.0, 3.6, 1, "siding"), ("GR2", "y", 29.0, 18.1, 19.7, 0.0, 3.6, 1, "siding"),
    ("GR3", "y", 29.0, 21.9, 23.5, 0.0, 3.6, 1, "siding"), ("GR4", "y", 29.0, 23.6, 25.2, 0.0, 3.6, 1, "siding"),
    ("GRt1", "y", 29.0, 16.5, 17.9, 4.0, 6.4, 1, "arch"), ("GRt2", "y", 29.0, 18.2, 19.6, 4.0, 6.4, 1, "arch"),
    ("GRt3", "y", 29.0, 22.0, 23.4, 4.0, 6.4, 1, "arch"), ("GRt4", "y", 29.0, 23.7, 25.1, 4.0, 6.4, 1, "arch"),
    ("MasterR1", "y", 29.0, 9.5, 11.3, 0.4, 3.0, 1, "siding"), ("MasterR2", "y", 29.0, 12.2, 14.0, 0.4, 3.0, 1, "siding"),
    ("Bed3R1", "y", 29.0, 9.5, 11.1, 4.4, 6.3, 1, "siding"), ("Bed3R2", "y", 29.0, 12.4, 14.0, 4.4, 6.3, 1, "siding"),
    # rear – lake gable: kitchen below, game room windows + high window above
    ("Kit1", "y", 29.6, 26.4, 27.8, 0.9, 3.0, 1, "brick"), ("Kit2", "y", 29.6, 28.3, 29.7, 0.9, 3.0, 1, "brick"),
    ("KitDoor", "y", 29.6, 30.4, 32.6, 0.0, 3.0, 1, "brick"),
    ("Game1", "y", 29.6, 26.3, 27.7, 4.4, 6.4, 1, "brick"), ("Game2", "y", 29.6, 28.2, 29.6, 4.4, 6.4, 1, "brick"),
    ("Game3", "y", 29.6, 30.1, 31.5, 4.4, 6.4, 1, "brick"), ("Game4", "y", 29.6, 32.0, 33.4, 4.4, 6.4, 1, "brick"),
    ("GameHigh", "y", 29.6, 29.25, 30.25, 8.0, 9.2, 1, "brick"),
    # sides
    ("StudyW", "x", 8.0, 15.0, 17.2, 0.4, 3.0, -1, "siding"), ("MasterW", "x", 8.0, 24.5, 27.0, 0.4, 3.0, -1, "siding"),
    ("Bed2W", "x", 8.0, 15.5, 17.3, 4.4, 6.3, -1, "siding"), ("Bed3W", "x", 8.0, 24.6, 26.4, 4.4, 6.3, -1, "siding"),
    ("GuestE", "x", 34.0, 13.0, 15.4, 0.4, 3.0, 1, "brick"), ("Bed4E", "x", 34.0, 13.2, 15.2, 4.3, 6.3, 1, "brick"),
    ("GameE", "x", 34.0, 23.5, 25.5, 4.4, 6.4, 1, "brick"),
]

# ---------------------------------------------------------------- rooms
# name: (x1, y1, x2, y2, floor z, ceiling z, kind)
ROOMS = {
    "study": (8, 13.5, 15, 19, 0, F1 - SLAB, "study"),
    "armory": (8, 19, 13, 23, 0, F1 - SLAB, "armory"),
    "closet": (13, 19, 16, 23, 0, F1 - SLAB, "closet"),
    "master": (8, 23, 16, 29, 0, F1 - SLAB, "bedroom"),
    "foyer": (15, 13.2, 22, 21, 0, EAVE, "foyer"),
    "great": (16, 21, 25.5, 29, 0, EAVE, "great"),
    "dining": (22, 10.5, 28.5, 19, 0, F1 - SLAB, "dining"),
    "powder": (22, 19, 25.5, 22, 0, F1 - SLAB, "bath"),
    "guest": (28.5, 9.0, 34, 22, 0, F1 - SLAB, "bedroom"),
    "kitchen": (25.5, 22, 34, 29.6, 0, F1 - SLAB, "kitchen"),
    "bed2": (8, 13.5, 15, 21, F1, EAVE, "bedroom"),
    "bed3": (8, 21, 16, 29, F1, EAVE, "bedroom"),
    "media": (22, 10.5, 28.5, 20, F1, EAVE, "media"),
    "hall2": (22, 20, 25.5, 22, F1, EAVE, "hall"),
    "bed4": (28.5, 9.0, 34, 22, F1, EAVE, "bedroom"),
    "game": (25.5, 22, 34, 29.6, F1, None, "game"),       # vaulted
}

# interior partitions: (x1, y1, x2, y2, floor z, top z, doors[(centre along wall, width)])
PARTITIONS = [
    # ground floor
    (15, 13.5, 15, 19, 0, F1 - SLAB, [(17.6, 1.0)]),            # study | foyer
    (8, 19, 15, 19, 0, F1 - SLAB, [(10.5, 0.9)]),               # study | armory (hidden door)
    (13, 19, 13, 23, 0, F1 - SLAB, []),                         # armory | closet
    (8, 23, 16, 23, 0, F1 - SLAB, [(14.5, 0.9)]),               # master | closet
    (16, 21, 16, 29, 0, F1 - SLAB, [(22.5, 1.0)]),              # master | great room
    (15, 19, 15, 21, 0, F1 - SLAB, []),
    (22, 13.2, 22, 19, 0, F1 - SLAB, [(16.0, 1.6)]),            # foyer | dining (wide cased opening)
    (22, 19, 25.5, 19, 0, F1 - SLAB, [(23.6, 0.9)]),            # dining | powder
    (25.5, 19, 25.5, 22, 0, F1 - SLAB, []),
    (28.5, 10.5, 28.5, 22, 0, F1 - SLAB, [(18.5, 0.9)]),        # dining | guest
    (25.5, 22, 34, 22, 0, F1 - SLAB, [(27.0, 1.2), (31.5, 0.9)]),  # kitchen | powder/guest
    (25.5, 22, 25.5, 29.6, 0, F1 - SLAB, [(25.5, 3.2)]),        # kitchen | great room (wide opening)
    # upper floor
    (15, 13.5, 15, 21, F1, EAVE, [(19.5, 0.9)]),                # bed2 | stair hall
    (8, 21, 16, 21, F1, EAVE, [(15.2, 0.9)]),                   # bed2 | bed3
    (16, 21, 16, 29, F1, EAVE, []),                              # bed3 | great-room void
    (22, 13.2, 22, 20, F1, EAVE, [(18.5, 1.0)]),                # stair hall | media
    (22, 20, 25.5, 20, F1, EAVE, []),
    (28.5, 10.5, 28.5, 22, F1, EAVE, [(20.8, 0.9)]),            # media/hall | bed4
    (25.5, 22, 34, 22, F1, EAVE, [(27.0, 2.4)]),                # hall | game room (wide)
    (25.5, 22, 25.5, 29.6, F1, EAVE, [(25.7, 6.2)]),            # game-room loft overlooking the great room
]

# slab holes: great-room double height, curved-stair void
FLOOR2_HOLES = [(16, 21, 25.5, 29), (17.2, 13.6, 21.6, 18.6)]
CEIL2_HOLES = [(25.5, 22, 34, 29.6)]     # game room is vaulted


def _poly_offset(poly, t):
    """Inward offset of a counter-clockwise rectilinear polygon."""
    n = len(poly)
    lines = []
    for i in range(n):
        (x0, y0), (x1, y1) = poly[i], poly[(i + 1) % n]
        dx, dy = x1 - x0, y1 - y0
        L = math.hypot(dx, dy)
        nx, ny = -dy / L * t, dx / L * t
        lines.append(((x0 + nx, y0 + ny), (dx, dy)))
    out = []
    for i in range(n):
        (p, d), (q, e) = lines[i - 1], lines[i]
        den = d[0] * e[1] - d[1] * e[0]
        s = ((q[0] - p[0]) * e[1] - (q[1] - p[1]) * e[0]) / den
        out.append((p[0] + d[0] * s, p[1] + d[1] * s))
    return out


def _ring_solid(name, outer, inner, z0, z1, coll, mat_ext, mat_int):
    """Closed wall ring between an outer and inner contour, z0..z1. Material 0 = exterior faces."""
    bm = bmesh.new()
    n = len(outer)
    vo0 = [bm.verts.new((x, y, z0)) for x, y in outer]
    vo1 = [bm.verts.new((x, y, z1)) for x, y in outer]
    vi0 = [bm.verts.new((x, y, z0)) for x, y in inner]
    vi1 = [bm.verts.new((x, y, z1)) for x, y in inner]
    for i in range(n):
        j = (i + 1) % n
        f = bm.faces.new((vo0[i], vo0[j], vo1[j], vo1[i])); f.material_index = 0       # outside
        f = bm.faces.new((vi0[j], vi0[i], vi1[i], vi1[j])); f.material_index = 1       # inside
        f = bm.faces.new((vo1[i], vo1[j], vi1[j], vi1[i])); f.material_index = 1       # top
        f = bm.faces.new((vo0[j], vo0[i], vi0[i], vi0[j])); f.material_index = 1       # bottom
    me = bpy.data.meshes.new(name)
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    o.data.materials.append(mat_ext)
    o.data.materials.append(mat_int)
    coll.objects.link(o)
    return o


def _slab(bm_mod, name, poly, z0, z1, mat, coll, holes=()):
    bm = bmesh.new()
    vb = [bm.verts.new((x, y, z0)) for x, y in poly]
    vt = [bm.verts.new((x, y, z1)) for x, y in poly]
    bm.faces.new(list(reversed(vb)))
    bm.faces.new(vt)
    n = len(poly)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((vb[i], vb[j], vt[j], vt[i]))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    o.data.materials.append(mat)
    coll.objects.link(o)
    if holes:
        cut = _cutter_from_boxes(bm_mod, name + "_holes", [(a, c, b, d, z0 - 0.1, z1 + 0.1) for a, b, c, d in holes], coll)
        _boolean(o, cut)
    return o


def _cutter_from_boxes(bm_mod, name, boxes, coll):
    """boxes: (x1, x2, y1, y2, z1, z2) – note argument order x1, x2, y1, y2."""
    bm = bmesh.new()
    for (x1, x2, y1, y2, z1, z2) in boxes:
        x1, x2 = sorted((x1, x2)); y1, y2 = sorted((y1, y2))
        v = [bm.verts.new(p) for p in [(x1, y1, z1), (x2, y1, z1), (x2, y2, z1), (x1, y2, z1),
                                        (x1, y1, z2), (x2, y1, z2), (x2, y2, z2), (x1, y2, z2)]]
        for f in [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]:
            bm.faces.new([v[i] for i in f])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    coll.objects.link(o)
    o.hide_render = True
    o.hide_viewport = True
    return o


def _boolean(target, cutter, transfer_mat=None):
    mod = target.modifiers.new("cut", "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.solver = "EXACT"
    mod.object = cutter
    if transfer_mat is not None:
        cutter.data.materials.append(transfer_mat)
        mod.material_mode = "TRANSFER"
    return mod


def _apply_modifiers(o):
    bpy.context.view_layer.objects.active = o
    for m in list(o.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)


def _assign_facade_materials(o, M):
    """Exterior faces get a facade material by zone; interior faces stay plaster (slot 1)."""
    zones = {"siding": M["siding"], "stone": M["stone"], "brick": M["brick"], "plaster": M["plaster_int"]}
    o.data.materials.clear()
    for k in ("brick", "plaster", "siding", "stone"):
        o.data.materials.append(zones[k])
    idx = {"brick": 0, "plaster": 1, "siding": 2, "stone": 3}
    me = o.data
    for p in me.polygons:
        c, nrm = p.center, p.normal
        if p.material_index == 1:          # interior / top / bottom faces from the ring
            p.material_index = idx["plaster"]
            continue
        zone = "brick"
        if c.x < 15.01:
            zone = "siding"
        if abs(c.y - 13.2) < 0.05 and 15 <= c.x <= 22 and nrm.y < -0.5:
            zone = "stone"
        if c.z < -0.05:                    # exposed foundation / plinth
            zone = "stone"
        p.material_index = idx[zone]


def _gable_end(name, axis, at, a, b, z_eave, pitch, inward, mat, coll, thickness=T_EXT):
    """Triangular gable wall in the plane axis=at, spanning a..b, eave z_eave, ridge mid-span."""
    half = (b - a) / 2
    zr = z_eave + half * pitch
    m = (a + b) / 2
    pts = [(a, z_eave), (b, z_eave), (m, zr)]
    bm = bmesh.new()
    def P(u, z, d):
        return (at + d, u, z) if axis == "x" else (u, at + d, z)
    f0 = [bm.verts.new(P(u, z, 0)) for u, z in pts]
    f1 = [bm.verts.new(P(u, z, inward * thickness)) for u, z in pts]
    bm.faces.new(f0)
    bm.faces.new(list(reversed(f1)))
    for i in range(3):
        j = (i + 1) % 3
        bm.faces.new((f0[i], f1[i], f1[j], f0[j]))
    me = bpy.data.meshes.new(name)
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    o.data.materials.append(mat)
    coll.objects.link(o)
    return o


def _partition(name, x1, y1, x2, y2, z0, z1, doors, mat, coll):
    """Interior wall with door gaps (2.4 m doors, lintel above). Returns created objects."""
    objs = []
    horiz = abs(y2 - y1) < 1e-6
    a, b = (x1, x2) if horiz else (y1, y2)
    gaps = sorted((c - w / 2, c + w / 2) for c, w in doors)
    cuts = [a] + [v for g in gaps for v in g] + [b]
    t = T_INT / 2
    def mk(n, u1, u2, za, zb):
        if u2 - u1 < 0.02:
            return
        if horiz:
            o = _box(n, u1, u2, y1 - t, y1 + t, za, zb, mat, coll)
        else:
            o = _box(n, x1 - t, x1 + t, u1, u2, za, zb, mat, coll)
        objs.append(o)
    for i in range(0, len(cuts), 2):
        mk(f"{name}_{i}", cuts[i], cuts[i + 1], z0, z1)
    for k, (g1, g2) in enumerate(gaps):
        top = min(z1, z0 + 2.4 if (g2 - g1) < 2.0 else z0 + 3.0)
        if top < z1 - 0.02:
            mk(f"{name}_lintel{k}", g1, g2, top, z1)
    return objs


def _box(name, x1, x2, y1, y2, z1, z2, mat, coll):
    me = bpy.data.meshes.new(name)
    v = [(x1, y1, z1), (x2, y1, z1), (x2, y2, z1), (x1, y2, z1), (x1, y1, z2), (x2, y1, z2), (x2, y2, z2), (x1, y2, z2)]
    f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    me.from_pydata(v, [], f)
    o = bpy.data.objects.new(name, me)
    o.data.materials.append(mat)
    coll.objects.link(o)
    return o


def opening_boxes():
    """Cutter boxes for every exterior opening (through the full wall)."""
    boxes = []
    for (n, axis, plane, a, b, z1, z2, out, style) in WINDOWS:
        if axis == "y":
            boxes.append((a, b, plane - 0.6, plane + 0.6, z1, z2))
        else:
            boxes.append((plane - 0.6, plane + 0.6, a, b, z1, z2))
    return boxes


def build(bm_mod, M, coll):
    """Build the real house shell. `bm_mod` is the running build_massing module; M = materials."""
    out = {}
    inner = _poly_offset(FOOTPRINT, T_EXT)
    walls = _ring_solid("HouseWalls", FOOTPRINT, inner, -1.0, EAVE, coll, M["brick"], M["plaster_int"])
    # stone gable front rises 0.4 m higher than the other eaves
    _box("StoneGableCap", 15, 22, 13.2, 13.2 + T_EXT, EAVE, EAVE + 0.4, M["stone"], coll)
    cut = _cutter_from_boxes(bm_mod, "HouseOpenings", opening_boxes(), coll)
    _boolean(walls, cut, M["reveal"])
    _apply_modifiers(walls)
    _assign_facade_materials(walls, M)
    # keep the reveals (cutter faces) as their own slot after facade assignment
    if M["reveal"].name not in [m.name for m in walls.data.materials]:
        walls.data.materials.append(M["reveal"])
    out["walls"] = walls

    # slabs: ground floor, upper floor (with voids), upper ceiling (open over the game room)
    _slab(bm_mod, "Floor1", inner, -SLAB, 0.0, M["floor_oak"], coll)
    _slab(bm_mod, "Floor2", inner, F1 - SLAB, F1, M["floor_oak"], coll, FLOOR2_HOLES)
    _slab(bm_mod, "Ceiling2", inner, EAVE, EAVE + 0.2, M["ceiling"], coll, CEIL2_HOLES)
    # 1F ceiling finish = underside of Floor2: give that slab a ceiling-coloured second material
    f2 = bpy.data.objects["Floor2"]
    f2.data.materials.append(M["ceiling"])
    _apply_modifiers(f2)
    for p in f2.data.polygons:
        if p.normal.z < -0.5:
            p.material_index = 1

    # partitions
    for i, (x1, y1, x2, y2, z0, z1, doors) in enumerate(PARTITIONS):
        _partition(f"Part{i}", x1, y1, x2, y2, z0, z1, doors, M["plaster_int"], coll)

    # roofs: slabs from the massing gable() helper, end walls only where they are real walls
    for (name, x1, x2, y1, y2, ze, axis, pitch, oh, ends) in ROOFS:
        objs = bm_mod.gable(name, x1, x2, y1, y2, ze, axis, pitch, oh, coll=coll)
        prism = objs[0]                       # the solid infill prism; not wanted in a hollow house
        bpy.data.objects.remove(prism, do_unlink=True)
        for side, mat in ends:
            if axis == "x":
                at, inward = (x1, 1) if side == "x1" else (x2, -1)
                _gable_end(f"{name}_end_{side}", "x", at, y1, y2, ze, pitch, inward,
                           M[mat] if mat != "plaster" else M["plaster_int"], coll)
            else:
                at, inward = (y1, 1) if side == "y1" else (y2, -1)
                _gable_end(f"{name}_end_{side}", "y", at, x1, x2, ze, pitch, inward,
                           M[mat] if mat != "plaster" else M["plaster_int"], coll)
    # the main roof's east end must stay open where the game-room vault sits below the rear gable
    out["rooms"] = ROOMS
    return out
