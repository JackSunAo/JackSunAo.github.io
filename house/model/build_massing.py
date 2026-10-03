"""Massing (white) model of the lakefront estate, built procedurally with Blender's bpy.

Coordinates match house/design/siteplan.py:
  X = meters east from the left lot line, Y = meters from the street toward the lake,
  Z = meters relative to the main floor (±0.0). The lake's normal level is -5.0.

Usage:
  python build_massing.py                 # build, save massing.blend, render all views
  python build_massing.py --views front   # render a subset (comma-separated)
  python build_massing.py --preview       # fast low-sample, low-res renders
"""
import math
import os
import sys

import bpy
import bmesh
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_BLEND = os.path.join(HERE, "massing.blend")
OUT_DIR = os.path.join(HERE, "..", "renders", "massing")

# ---------------------------------------------------------------- levels
F1, F2 = 4.0, 3.4   # storey heights (13 ft + 11 ft, matching the reference image)
EAVE = F1 + F2      # 2-storey wall top
Y_MAIN = 13.5       # front wall of the west wing / stone gable (porch in front)
Y_BRICK = 10.5      # brick wing front, flush with the porch
Y_EGABLE = 9.0      # east gable, projecting furthest
LAKE = -5.0
SHORE = 62.0


def ground(x, y):
    """Finished grade: gentle front lawn, flat around the house, then falling toward the lake."""
    if y <= 16.5:
        return -0.9 + 0.4 * max(0.0, y) / 16.5
    if y <= 29.0:
        return -0.5
    if y <= 46.5:
        t = (y - 29.0) / 17.5
        return -0.5 - 2.5 * (3 * t * t - 2 * t * t * t)
    if y <= SHORE:
        return -3.0 - 1.4 * (y - 46.5) / (SHORE - 46.5)
    return -7.0


# ---------------------------------------------------------------- scene setup
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


MATS = {}


def mat(name, color, rough=0.8, metal=0.0, alpha=1.0, emit=None):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*color, 1.0)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    if alpha < 1.0:
        p.inputs["Alpha"].default_value = alpha
    if emit:
        p.inputs["Emission Color"].default_value = (*emit[0], 1.0)
        p.inputs["Emission Strength"].default_value = emit[1]
    MATS[name] = m
    return m


def srgb(h):
    """Hex -> linear RGB tuple."""
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c)


def materials():
    mat("wall", srgb("#ecebe7"), 0.9)
    mat("roof", srgb("#8d8f93"), 0.85)
    mat("metalroof", srgb("#77736e"), 0.5, 0.3)
    mat("glass", srgb("#2c3238"), 0.08)
    mat("lawn", srgb("#b9c8a6"), 1.0)
    mat("garden", srgb("#a7bf8f"), 1.0)
    mat("paving", srgb("#ddd6c8"), 0.9)
    mat("asphalt", srgb("#b8b4ad"), 0.95)
    mat("deck", srgb("#e6e0d4"), 0.85)
    mat("wood", srgb("#b59b7c"), 0.8)
    mat("hedge", srgb("#7f9a6c"), 1.0)
    mat("tree", srgb("#8fa97a"), 1.0)
    mat("trunk", srgb("#8a7a68"), 1.0)
    mat("water", srgb("#5d8fa6"), 0.04)
    mat("pool", srgb("#55b3c9"), 0.03)
    mat("street", srgb("#9a9a9a"), 0.95)
    mat("heli", srgb("#f1ece2"), 0.35)
    mat("hull", srgb("#f7f7f5"), 0.25)
    mat("dark", srgb("#3b3b3d"), 0.6)
    mat("hpad", srgb("#c9c6bf"), 0.9)
    mat("mark", srgb("#f6f6f6"), 0.6)
    mat("windsock", srgb("#ff7f27"), 0.7)
    mat("farshore", srgb("#97a88c"), 1.0)


# ---------------------------------------------------------------- mesh helpers
def link(obj, collection):
    collection.objects.link(obj)
    return obj


def new_mesh(name, verts, faces, material, coll):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    obj = bpy.data.objects.new(name, me)
    obj.data.materials.append(MATS[material])
    return link(obj, coll)


def box(name, x1, x2, y1, y2, z1, z2, material, coll):
    v = [(x1, y1, z1), (x2, y1, z1), (x2, y2, z1), (x1, y2, z1),
         (x1, y1, z2), (x2, y1, z2), (x2, y2, z2), (x1, y2, z2)]
    f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    return new_mesh(name, v, f, material, coll)


def quad_slab(name, pts, thickness, material, coll):
    obj = new_mesh(name, pts, [(0, 1, 2, 3)], material, coll)
    mod = obj.modifiers.new("solid", "SOLIDIFY")
    mod.thickness = thickness
    mod.offset = 1.0
    return obj


def gable(name, x1, x2, y1, y2, z_eave, ridge="x", pitch=1.0, overhang=0.45,
          wall="wall", roof="roof", coll=None, base=None):
    """Walls (from `base` to eave) + triangular gable infill + two solidified roof planes."""
    objs = []
    if base is not None:
        objs.append(box(name + "_walls", x1, x2, y1, y2, base, z_eave, wall, coll))
    if ridge == "x":
        half = (y2 - y1) / 2
        ym = (y1 + y2) / 2
        zr = z_eave + half * pitch
        v = [(x1, y1, z_eave), (x1, y2, z_eave), (x1, ym, zr), (x2, y1, z_eave), (x2, y2, z_eave), (x2, ym, zr)]
        f = [(0, 1, 2), (3, 5, 4), (0, 3, 4, 1)]
        objs.append(new_mesh(name + "_gable", v, f, wall, coll))
        ze = z_eave - overhang * pitch
        a, b = x1 - overhang, x2 + overhang
        objs.append(quad_slab(name + "_roofS", [(a, y1 - overhang, ze), (b, y1 - overhang, ze), (b, ym, zr), (a, ym, zr)], 0.22, roof, coll))
        objs.append(quad_slab(name + "_roofN", [(a, ym, zr), (b, ym, zr), (b, y2 + overhang, ze), (a, y2 + overhang, ze)], 0.22, roof, coll))
    else:
        half = (x2 - x1) / 2
        xm = (x1 + x2) / 2
        zr = z_eave + half * pitch
        v = [(x1, y1, z_eave), (x2, y1, z_eave), (xm, y1, zr), (x1, y2, z_eave), (x2, y2, z_eave), (xm, y2, zr)]
        f = [(0, 2, 1), (3, 4, 5), (0, 1, 4, 3)]
        objs.append(new_mesh(name + "_gable", v, f, wall, coll))
        ze = z_eave - overhang * pitch
        a, b = y1 - overhang, y2 + overhang
        objs.append(quad_slab(name + "_roofW", [(x1 - overhang, a, ze), (xm, a, zr), (xm, b, zr), (x1 - overhang, b, ze)], 0.22, roof, coll))
        objs.append(quad_slab(name + "_roofE", [(xm, a, zr), (x2 + overhang, a, ze), (x2 + overhang, b, ze), (xm, b, zr)], 0.22, roof, coll))
    return objs


def terrain_strip(name, x1, x2, y1, y2, material, coll, dz=0.04, step=1.0):
    """Flat-ish surface following the grade (paths, lawns, drives)."""
    nx = max(1, int(math.ceil((x2 - x1) / step)))
    ny = max(1, int(math.ceil((y2 - y1) / step)))
    verts, faces = [], []
    for j in range(ny + 1):
        y = y1 + (y2 - y1) * j / ny
        for i in range(nx + 1):
            x = x1 + (x2 - x1) * i / nx
            verts.append((x, y, ground(x, y) + dz))
    for j in range(ny):
        for i in range(nx):
            a = j * (nx + 1) + i
            faces.append((a, a + 1, a + nx + 2, a + nx + 1))
    return new_mesh(name, verts, faces, material, coll)


def ribbon(name, pts, width, material, coll, dz=0.05):
    """Strip of given width along a polyline, draped on the grade."""
    verts, faces = [], []
    for i, p in enumerate(pts):
        q0 = pts[max(0, i - 1)]
        q1 = pts[min(len(pts) - 1, i + 1)]
        t = Vector((q1[0] - q0[0], q1[1] - q0[1])).normalized()
        n = Vector((-t.y, t.x)) * (width / 2)
        for s in (1, -1):
            x, y = p[0] + n.x * s, p[1] + n.y * s
            verts.append((x, y, ground(x, y) + dz))
    for i in range(len(pts) - 1):
        a = 2 * i
        faces.append((a, a + 1, a + 3, a + 2))
    return new_mesh(name, verts, faces, material, coll)


def bezier(p0, p1, p2, p3, n=40):
    out = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        out.append(tuple(u ** 3 * a + 3 * u * u * t * b + 3 * u * t * t * c + t ** 3 * d
                         for a, b, c, d in zip(p0, p1, p2, p3)))
    return out


def cylinder(name, x, y, z1, z2, r, material, coll, verts=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=z2 - z1, location=(x, y, (z1 + z2) / 2))
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(MATS[material])
    for c in obj.users_collection:
        c.objects.unlink(obj)
    return link(obj, coll)


def blob(name, x, y, z, rx, ry, rz, material, coll, subdiv=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdiv, radius=1.0, location=(x, y, z))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (rx, ry, rz)
    obj.data.materials.append(MATS[material])
    for c in obj.users_collection:
        c.objects.unlink(obj)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return link(obj, coll)


def tree(name, x, y, height, radius, coll):
    z0 = ground(x, y)
    cylinder(name + "_trunk", x, y, z0, z0 + height * 0.45, max(0.12, radius * 0.08), "trunk", coll, 8)
    blob(name + "_crown", x, y, z0 + height * 0.62, radius, radius, height * 0.38, "tree", coll)


def boolean_cut(target, cutter):
    mod = target.modifiers.new("cut_" + cutter.name, "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.object = cutter
    cutter.hide_render = True
    cutter.hide_viewport = True


def collection(name):
    c = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(c)
    return c


# ---------------------------------------------------------------- site
def build_site():
    c = collection("Site")
    # terrain grid (lot + neighbours), lake bed beyond the shore
    x1, x2, y1, y2, step = -160.0, 240.0, -80.0, 62.0, 2.0
    nx, ny = int((x2 - x1) / step), int((y2 - y1) / step)
    bm = bmesh.new()
    rows = []
    for j in range(ny + 1):
        y = y1 + j * step
        rows.append([bm.verts.new((x1 + i * step, y, ground(x1 + i * step, y))) for i in range(nx + 1)])
    for j in range(ny):
        for i in range(nx):
            bm.faces.new((rows[j][i], rows[j][i + 1], rows[j + 1][i + 1], rows[j + 1][i]))
    me = bpy.data.meshes.new("Terrain")
    bm.to_mesh(me)
    bm.free()
    t = bpy.data.objects.new("Terrain", me)
    t.data.materials.append(MATS["lawn"])
    link(t, c)
    box("LakeBed", -300, 420, SHORE, 900, -9, -7, "farshore", c)
    box("Bulkhead", -160, 240, SHORE - 0.4, SHORE + 0.2, -7.5, ground(0, SHORE) + 0.25, "paving", c)
    box("FarGround", -900, 900, -900, -79.9, -3.0, ground(0, -80), "lawn", c)
    for side, (a, b) in (("W", (-900, -159.9)), ("E", (239.9, 900))):
        terrain_strip("Ground" + side, a, b, -80, SHORE, "lawn", c, dz=0.0, step=20.0)
    box("Lake", -600, 700, SHORE, 1200, LAKE - 0.05, LAKE, "water", c)
    box("Street", -900, 900, -12, -0.2, -1.2, -0.95, "street", c)

    # far shore: low wooded hills
    for i, (x, w, h) in enumerate([(-260, 220, 22), (-40, 180, 16), (150, 240, 26), (380, 220, 18)]):
        blob(f"FarHill{i}", x, 620, LAKE, w, 90, h, "farshore", c, 3)
    for i in range(70):
        x = -420 + i * 12.5 + (i * 37 % 9)
        y = 545 + (i * 53 % 40)
        blob(f"FarTree{i}", x, y, LAKE + 6 + (i * 17 % 7), 6, 6, 8, "tree", c, 1)

    # front: walkway, drive, motor court, planting
    ribbon("Walkway", bezier((17, -0.2), (10, 4), (28, 6), (19.5, Y_MAIN - 3.2)), 2.4, "paving", c)
    terrain_strip("Driveway", 45, 49, -0.2, 17, "asphalt", c)
    terrain_strip("MotorCourt", 41.5, 49.5, 17, 31, "asphalt", c)
    terrain_strip("HangarApron", 49.5, 53, 17, 31, "asphalt", c)
    box("FrontBed", 8, 18.2, Y_MAIN - 4.7, Y_MAIN - 3.2, -0.9, -0.55, "garden", c)
    box("FrontBed2", 21.5, 29, Y_BRICK - 1.8, Y_BRICK, -0.9, -0.55, "garden", c)
    box("FrontBed3", 29, 34, Y_EGABLE - 1.6, Y_EGABLE, -0.9, -0.55, "garden", c)
    for i, (x, y) in enumerate([(9.5, 9.5), (13, 9.5), (16.5, 9.5), (23, 9.5), (27.5, 9.5), (32, 8.0)]):
        blob(f"Shrub{i}", x, y, -0.3, 0.9, 0.7, 0.9, "hedge", c, 1)
    tree("OakFront1", -6.0, 2.0, 11, 6.5, c)
    tree("OakFront2", 37.5, 5.0, 10, 5.5, c)
    for i, x in enumerate(range(52, 81, 3)):
        for k, y in enumerate((4, 8, 12)):
            tree(f"Screen{i}_{k}", x + (1.5 if y == 8 else 0), y, 7.5, 1.9, c)
    for i, y in enumerate(range(18, 34, 3)):
        tree(f"East{i}", 80.8, y, 7, 1.6, c)
    for i, y in enumerate(range(2, 60, 4)):
        tree(f"West{i}", -2.5, y, 8, 2.0, c)

    # garden (west): side path + arbor, rose parterres + fountain, pergola, raised beds, greenhouse
    terrain_strip("GardenSidePath", 0.8, 7.2, 16.5, 29, "paving", c)
    terrain_strip("GardenLawn", 0, 12.5, 29, 59.5, "garden", c, dz=0.02)
    for x in (1.5, 6.5):
        box(f"ArborPost{x}", x - 0.1, x + 0.1, 15.9, 16.1, -0.5, 2.4, "wood", c)
    box("ArborTop", 1.3, 6.7, 15.8, 16.2, 2.4, 2.6, "wood", c)
    for i, (x, y) in enumerate([(1.5, 30.5), (7, 30.5), (1.5, 35.5), (7, 35.5)]):
        g = ground(x + 2, y + 1.75)
        box(f"Parterre{i}", x, x + 4, y, y + 3.5, g - 0.3, g + 0.6, "hedge", c)
    g = ground(6.25, 34.75)
    cylinder("Fountain", 6.25, 34.75, g - 0.2, g + 0.5, 0.9, "paving", c)
    cylinder("FountainTier", 6.25, 34.75, g + 0.5, g + 1.3, 0.3, "paving", c)
    g = ground(6, 42.75)
    for x in range(1, 12, 2):
        for y in (41.2, 44.3):
            box(f"PergolaPost{x}_{y}", x + 0.4, x + 0.6, y - 0.1, y + 0.1, g - 0.3, g + 2.8, "wood", c)
    for x in range(1, 12, 1):
        box(f"PergolaBeam{x}", x + 0.45, x + 0.55, 40.8, 44.7, g + 2.8, g + 3.0, "wood", c)
    for i, y in enumerate([46, 49.5, 53]):
        for x in (1.5, 7):
            gg = ground(x + 2, y + 1.1)
            box(f"RaisedBed{i}_{x}", x, x + 4, y, y + 2.2, gg - 0.3, gg + 0.55, "wood", c)
    gg = ground(5, 58)
    box("Greenhouse", 2, 8, 56.8, 59, gg - 0.2, gg + 2.6, "glass", c)
    gable("GreenhouseRoof", 2, 8, 56.8, 59, gg + 2.6, "x", 0.8, 0.1, "glass", "glass", c)
    for i, (x, y) in enumerate([(11, 50), (11, 57.5), (11.2, 53.7)]):
        tree(f"Fruit{i}", x, y, 4.0, 1.4, c)

    # rear lawn: fire pit, boathouse path, pier
    g = ground(20, 57.5)
    cylinder("FirePit", 20, 57.5, g - 0.2, g + 0.45, 1.0, "paving", c)
    terrain_strip("FirePitPad", 16.5, 23.5, 54.5, 60.5, "paving", c, dz=0.03)
    terrain_strip("BoatPath", 44.5, 47.5, 31, SHORE, "paving", c)
    zp = -4.1
    box("Pier", 22.5, 24.5, SHORE - 0.5, 70, zp - 0.3, zp, "wood", c)
    box("PierT", 18, 29, 70, 72, zp - 0.3, zp, "wood", c)
    for x in (18.3, 22.7, 24.3, 28.7):
        for y in (64, 67, 70.3, 71.7):
            if 18 <= x <= 29 and (y > 69.9 or 22.5 <= x <= 24.5):
                cylinder(f"Piling{x}_{y}", x, y, -8, zp + 0.6, 0.15, "wood", c, 8)
    return c


# ---------------------------------------------------------------- house
def build_house():
    """Proportions follow the reference image: tall 3.7 m + 3.2 m storeys, steep gables,
    brick wing flush with the porch front and the east gable projecting further."""
    c = collection("House")
    base = -1.0
    # main side-gabled block (west wing + centre), ridge running east-west
    gable("Main", 8, 29, Y_MAIN, 29, EAVE, "x", 1.1, 0.45, coll=c, base=base)
    # front stone gable, steep, rising over the porch
    gable("StoneGable", 15, 22, Y_MAIN - 0.3, 22, EAVE + 0.4, "y", 1.6, 0.35, coll=c, base=base)
    # brick wing, flush with the porch front, eave facing the street
    gable("BrickWing", 22, 28.5, Y_BRICK, 20, EAVE, "x", 1.15, 0.4, coll=c, base=base)
    # east front gable, projecting furthest
    gable("EastGable", 28.5, 34, Y_EGABLE, 29, EAVE, "y", 1.5, 0.4, coll=c, base=base)
    # rear game-room gable (over kitchen / breakfast, facing the lake)
    gable("RearGable", 25.5, 33.5, 22, 29.6, EAVE, "y", 1.0, 0.4, coll=c, base=base)
    # dormers: two on the west wing roof, two high up behind the brick wing
    for i, (x, w, y0) in enumerate([(9.2, 1.7, 14.6), (12.2, 1.7, 14.6), (22.3, 1.4, 19.2), (24.6, 1.4, 19.2)]):
        z0 = EAVE + (y0 - Y_MAIN) * 1.1
        box(f"Dormer{i}", x, x + w, y0 - 0.2, y0 + 1.8, z0 - 0.6, z0 + 1.6, "wall", c)
        gable(f"Dormer{i}R", x, x + w, y0 - 0.2, y0 + 1.8, z0 + 1.6, "y", 1.6, 0.15, coll=c)
        box(f"DormerWin{i}", x + 0.3, x + w - 0.3, y0 - 0.26, y0 - 0.18, z0, z0 + 1.3, "glass", c)
    # porch: shed metal roof on posts across the west wing and stone gable
    yp = Y_MAIN - 3.2
    quad_slab("PorchRoof", [(8.2, yp, 3.5), (22, yp, 3.5), (22, Y_MAIN, 4.05), (8.2, Y_MAIN, 4.05)], 0.14, "metalroof", c)
    for x in (8.6, 11.9, 15.2, 18.5, 21.7):
        box(f"PorchPost{x}", x - 0.2, x + 0.2, yp + 0.2, yp + 0.6, -0.5, 3.5, "wall", c)
    box("PorchSlab", 8.2, 22, yp, Y_MAIN, -0.7, -0.05, "deck", c)
    # chimneys: great-room fireplace (rear) and outdoor fireplace (patio)
    box("Chimney", 20.0, 21.6, 29.0, 30.2, base, 16.2, "wall", c)
    box("ChimneyPatio", 15.0, 16.4, 31.6, 33.2, 0, 6.6, "wall", c)
    # key windows as dark inset panels so the massing reads (x1, x2, facade y, z1, z2)
    win = [
        (16.8, 20.2, Y_MAIN - 0.3, 4.4, 6.9),                                     # stone gable 2F
        (16.0, 17.8, Y_MAIN - 0.3, 0.2, 3.0), (18.6, 20.4, Y_MAIN - 0.3, 0.2, 3.0),  # stone gable 1F
        (9.0, 13.8, Y_MAIN, 4.6, 6.4),                                             # west wing 2F triple
        (9.2, 11.8, Y_MAIN, 0.2, 3.0), (12.6, 14.4, Y_MAIN, 0.2, 3.0),             # porch glass doors
        (23.0, 23.8, Y_BRICK, 4.3, 6.3), (24.85, 25.65, Y_BRICK, 4.3, 6.3), (26.7, 27.5, Y_BRICK, 4.3, 6.3),
        (22.7, 25.0, Y_BRICK, 0.4, 3.0), (25.5, 27.8, Y_BRICK, 0.4, 3.0),         # brick wing 1F pair
        (29.9, 32.6, Y_EGABLE, 0.4, 3.0), (30.8, 31.8, Y_EGABLE, 4.3, 6.3), (31.0, 31.6, Y_EGABLE, 7.8, 8.7),
    ]
    for i, (a, b, y, z1, z2) in enumerate(win):
        box(f"WinF{i}", a, b, y - 0.06, y + 0.02, z1, z2, "glass", c)
    box("FrontDoor", 20.9, 21.8, Y_MAIN - 0.36, Y_MAIN - 0.28, 0, 2.9, "dark", c)
    # lake facade: two-storey great-room glass either side of the chimney, game-room windows above kitchen
    for i, x in enumerate([16.4, 18.1, 21.8, 23.5]):
        box(f"WinGR{i}", x, x + 1.6, 29.0, 29.08, 0.2, 3.6, "glass", c)
        box(f"WinGRt{i}", x + 0.1, x + 1.5, 29.0, 29.08, 4.0, 6.2, "glass", c)
    for i, x in enumerate([26.3, 28.2, 30.1, 32.0]):
        box(f"WinGame{i}", x, x + 1.3, 29.58, 29.66, 4.3, 6.2, "glass", c)
        box(f"WinKit{i}", x, x + 1.3, 29.58, 29.66, 0.3, 3.0, "glass", c)
    box("WinGameHigh", 29.0, 30.0, 29.58, 29.66, 7.6, 8.6, "glass", c)
    for i, x in enumerate([9.5, 12.0]):
        box(f"WinR{i}", x, x + 1.6, 29.0, 29.08, 0.3, 3.0, "glass", c)
        box(f"WinR2{i}", x, x + 1.6, 29.0, 29.08, 4.4, 6.2, "glass", c)
    # garage: side-entry, doors facing east
    gable("Garage", 34, 41.5, 20, 28.5, 3.6, "y", 0.9, 0.4, coll=c, base=-0.6)
    for i, y in enumerate([21.0, 24.9]):
        box(f"GarageDoor{i}", 41.5, 41.58, y, y + 2.8, -0.5, 2.4, "dark", c)
    # covered patio on posts
    quad_slab("PatioRoof", [(15, 29, 4.0), (29, 29, 4.0), (29, 33.5, 3.5), (15, 33.5, 3.5)], 0.14, "metalroof", c)
    for x in (18.5, 22.0, 25.5, 28.7):
        box(f"PatioPost{x}", x - 0.2, x + 0.2, 33.1, 33.5, 0, 3.5, "wall", c)
    return c


# ---------------------------------------------------------------- pool terrace, bar house, lower level
def build_terrace():
    c = collection("PoolTerrace")
    deck = box("Deck", 13, 38, 29, 46.5, -6, 0, "deck", c)
    cut = box("PoolCut", 16, 28, 41.2, 46.3, -1.6, 0.5, "pool", c)
    cut2 = box("SwimUpCut", 27.4, 29.5, 41.4, 44.6, -1.2, 0.5, "pool", c)
    lounge = box("LoungeCut", 28.6, 35, 36, 47, -3.3, -0.4, "pool", c)
    boolean_cut(deck, cut)
    boolean_cut(deck, cut2)
    boolean_cut(deck, lounge)
    box("PoolWater", 16, 28, 41.2, 46.3, -1.6, -0.05, "pool", c)
    box("SwimUpWater", 27.4, 29.5, 41.4, 44.6, -1.2, -0.12, "pool", c)
    for i, y in enumerate((42.0, 43.0, 44.0)):
        cylinder(f"SwimStool{i}", 28.9, y, -1.2, -0.55, 0.25, "paving", c, 12)
    cylinder("Spa", 14.4, 43, -0.6, 0.45, 1.3, "deck", c)
    cylinder("SpaWater", 14.4, 43, 0.1, 0.36, 1.05, "pool", c)
    # lower-level lake lounge: glass wall set back under the deck, lower terrace in front
    box("LoungeGlass", 28.7, 34.9, 46.1, 46.2, -3.2, -0.5, "glass", c)
    box("LoungeFloor", 28.6, 35, 36, 46.5, -3.6, -3.3, "deck", c)
    zt = -3.1
    box("LowerTerrace", 16, 36, 46.5, 50, -4.5, zt, "deck", c)
    for i in range(10):     # stair from the deck down to the lower terrace
        z = -0.3 * (i + 1)
        box(f"Step{i}", 36.2, 38, 46.5 + i * 0.3, 46.8 + i * 0.3, -4.5, z, "deck", c)
    # pool bar house: flat roof deck with railing, exterior stair
    box("BarHouse", 29.5, 36.5, 37, 45.5, 0, 3.4, "wall", c)
    box("BarRoofSlab", 29.3, 36.7, 36.8, 45.7, 3.4, 3.65, "roof", c)
    for (a, b, y1, y2) in [(29.3, 36.7, 36.8, 36.9), (29.3, 36.7, 45.6, 45.7), (29.3, 29.4, 36.8, 45.7), (36.6, 36.7, 36.8, 45.7)]:
        box(f"BarRail{a}_{y1}", a, b, y1, y2, 3.65, 4.7, "dark", c)
    box("BarGlassLake", 29.8, 36.2, 45.45, 45.55, 0.1, 3.0, "glass", c)
    box("BarWindowPool", 29.45, 29.55, 41.4, 44.6, 1.0, 2.6, "glass", c)
    for i in range(12):
        z = 0.3 * (i + 1)
        box(f"BarStair{i}", 36.5, 37.7, 37.2 + i * 0.42, 37.62 + i * 0.42, 0, z, "deck", c)
    box("PoolEquip", 35, 40, 29.5, 32, -0.6, 1.2, "wall", c)
    # side retaining walls of the raised deck
    box("RetainW", 12.6, 13.0, 29, 46.5, -6, 0.45, "paving", c)
    box("RetainE", 38.0, 38.4, 29, 46.5, -6, 0.45, "paving", c)
    return c


# ---------------------------------------------------------------- helicopter zone
def build_heli():
    c = collection("Helicopter")
    # hangar: barn-like, door on the lake-facing gable end
    gable("Hangar", 53, 69, 17, 31, 4.5, "y", 0.5, 0.5, coll=c, base=-0.8)
    box("HangarDoor", 54.5, 67.5, 31.0, 31.08, -0.5, 4.1, "dark", c)
    terrain_strip("TowPath", 59.5, 62.5, 31, 45, "asphalt", c)
    zc = ground(66, 51)
    zp = zc + 0.25
    cylinder("FATO", 66, 51, zc - 1.5, zc + 0.1, 10.0, "lawn", c, 48)
    box("TLOF", 60, 72, 45, 57, zc - 1.5, zp, "hpad", c)
    # H marking + touchdown circle (flat inlays)
    box("H_left", 64.3, 64.9, 48.6, 53.4, zp, zp + 0.02, "mark", c)
    box("H_right", 67.1, 67.7, 48.6, 53.4, zp, zp + 0.02, "mark", c)
    box("H_bar", 64.9, 67.1, 50.7, 51.3, zp, zp + 0.02, "mark", c)
    bpy.ops.mesh.primitive_torus_add(major_radius=5.2, minor_radius=0.15, location=(66, 51, zp))
    ring = bpy.context.active_object
    ring.name = "TD_Circle"
    ring.scale = (1, 1, 0.1)
    ring.data.materials.append(MATS["mark"])
    for col in ring.users_collection:
        col.objects.unlink(ring)
    link(ring, c)
    for a in range(0, 360, 30):
        x, y = 66 + 6.6 * math.cos(math.radians(a)), 51 + 6.6 * math.sin(math.radians(a))
        cylinder(f"PadLight{a}", x, y, zp, zp + 0.2, 0.12, "mark", c, 8)
    gw = ground(77, 43.5)
    cylinder("WindsockPole", 77, 43.5, gw, gw + 5.5, 0.06, "dark", c, 8)
    bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=0.35, radius2=0.15, depth=2.2,
                                    location=(78.1, 43.5, gw + 5.3), rotation=(0, math.radians(90), 0))
    sock = bpy.context.active_object
    sock.name = "Windsock"
    sock.data.materials.append(MATS["windsock"])
    for col in sock.users_collection:
        col.objects.unlink(sock)
    link(sock, c)
    helicopter(66, 51, zp, c, heading=200)
    return c


def helicopter(x, y, z, coll, heading=0):
    """Light single-engine helicopter (~13 m overall, 10.7 m rotor), parented to an empty."""
    root = bpy.data.objects.new("Helicopter", None)
    link(root, coll)
    parts = []
    parts.append(blob("Heli_Cabin", 0, 1.0, 1.55, 1.05, 2.1, 0.95, "heli", coll, 3))
    parts.append(blob("Heli_Canopy", 0, 2.1, 1.75, 0.9, 1.05, 0.7, "glass", coll, 3))
    parts.append(blob("Heli_Engine", 0, -0.6, 2.35, 0.6, 1.3, 0.45, "heli", coll, 2))
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.22, depth=5.6, location=(0, -3.6, 1.95),
                                        rotation=(math.radians(90), 0, 0))
    boom = bpy.context.active_object
    boom.name = "Heli_Boom"
    boom.data.materials.append(MATS["heli"])
    for col in boom.users_collection:
        col.objects.unlink(boom)
    link(boom, coll)
    parts.append(boom)
    parts.append(box("Heli_Fin", -0.06, 0.06, -6.6, -5.9, 1.9, 3.3, "heli", coll))
    parts.append(box("Heli_Stab", -1.0, 1.0, -5.6, -5.2, 1.9, 1.98, "heli", coll))
    parts.append(cylinder("Heli_Mast", 0, -0.2, 2.6, 3.05, 0.12, "dark", coll, 12))
    for i, a in enumerate((0, 120, 240)):
        r = math.radians(a)
        bl = box(f"Heli_Blade{i}", -0.18, 0.18, 0.2, 5.35, 3.0, 3.06, "dark", coll)
        bl.location = (0, -0.2, 0)
        bl.rotation_euler = (0, 0, r)
        parts.append(bl)
    parts.append(box("Heli_TailRotor", 0.12, 0.16, -6.7, -5.7, 2.3, 3.3, "dark", coll))
    for s in (-1, 1):
        parts.append(box(f"Heli_Skid{s}", s * 1.05 - 0.05, s * 1.05 + 0.05, -1.2, 2.6, 0.08, 0.16, "dark", coll))
        for yy in (-0.4, 1.8):
            parts.append(box(f"Heli_Strut{s}{yy}", s * 1.0 - 0.04, s * 1.0 + 0.04, yy - 0.04, yy + 0.04, 0.16, 0.9, "dark", coll))
    for p in parts:
        p.parent = root
    root.location = (x, y, z)
    root.rotation_euler = (0, 0, math.radians(heading))


# ---------------------------------------------------------------- boathouse + yacht
def build_lake():
    c = collection("Boathouse")
    zw = -4.0            # walkway level, ~1 m above the normal lake level
    for (a, b, y1, y2) in [(36, 37, 63, 77), (44, 45, 63, 77), (49, 50, 63, 77), (36, 50, 63, 64)]:
        box(f"BH_Walk{a}_{y1}", a, b, y1, y2, zw - 0.3, zw, "wood", c)
    box("BH_Link", 44.5, 47.5, SHORE - 0.5, 63, zw - 0.3, zw, "wood", c)
    for x in (36.2, 44.5, 49.8):
        for y in (63.3, 67.8, 72.3, 76.7):
            cylinder(f"BH_Pile{x}_{y}", x, y, -8, zw + 3.2, 0.18, "wood", c, 8)
    zf = -0.9            # upper sun-deck floor, roof pavilion above
    box("BH_UpperFloor", 35.8, 50.2, 62.8, 77.2, zf - 0.35, zf, "deck", c)
    for x in (36.2, 43.0, 49.8):
        for y in (63.2, 70.0, 76.8):
            box(f"BH_UpPost{x}_{y}", x - 0.15, x + 0.15, y - 0.15, y + 0.15, zf, zf + 2.9, "wall", c)
    gable("BH_Roof", 35.8, 50.2, 62.8, 77.2, zf + 2.9, "y", 0.6, 0.5, coll=c)
    box("BH_Rail", 35.8, 50.2, 77.1, 77.2, zf, zf + 1.05, "dark", c)
    box("BH_Stair", 37.0, 38.2, 63.2, 66.0, zw, zf, "wood", c)
    yacht(40.5, 70.0, LAKE + 0.45, c)
    for x in (46.0, 48.0):     # personal watercraft on lifts
        blob(f"JetSki{x}", x, 66.2, LAKE + 0.9, 0.6, 1.6, 0.4, "hull", c, 2)
    return c


def yacht(x, y, z, coll):
    """~11 m day cruiser, bow toward the lake (+Y). Hull lofted from width/height sections."""
    L, B = 11.0, 3.5
    sections = []   # (y offset from stern, half beam at deck, keel depth)
    for i in range(12):
        t = i / 11
        hb = B / 2 * (1.0 if t < 0.55 else math.cos((t - 0.55) / 0.45 * math.pi / 2) ** 0.8 + 0.02)
        keel = 0.9 if t < 0.85 else 0.9 * (1 - (t - 0.85) / 0.15 * 0.6)
        sections.append((t * L - L / 2, hb, keel, 0.95 + 0.25 * t))
    verts, faces = [], []
    for (yy, hb, keel, sheer) in sections:
        verts += [(-hb, yy, sheer), (-hb * 0.85, yy, 0.0), (0, yy, -keel), (hb * 0.85, yy, 0.0), (hb, yy, sheer)]
    for i in range(len(sections) - 1):
        a, b = 5 * i, 5 * (i + 1)
        for k in range(4):
            faces.append((a + k, a + k + 1, b + k + 1, b + k))
        faces.append((a + 4, a, b, b + 4))          # deck
    faces.append((4, 3, 2, 1, 0))                    # transom
    n = 5 * (len(sections) - 1)
    faces.append((n, n + 1, n + 2, n + 3, n + 4))
    hull = new_mesh("Yacht_Hull", verts, faces, "hull", coll)
    hull.location = (x, y, z)
    cab = box("Yacht_Cabin", -1.3, 1.3, -1.8, 1.8, 1.0, 2.1, "hull", coll)
    cab.location = (x, y, z)
    wind = box("Yacht_Glass", -1.25, 1.25, 1.8, 1.9, 1.05, 2.0, "glass", coll)
    wind.location = (x, y, z)
    top = box("Yacht_Hardtop", -1.5, 1.5, -2.6, 1.7, 2.1, 2.22, "dark", coll)
    top.location = (x, y, z)


# ---------------------------------------------------------------- lighting, cameras, render
def world_and_light(sun_azimuth, sun_elevation):
    scn = bpy.context.scene
    world = bpy.data.worlds.new("World")
    scn.world = world
    world.use_nodes = True
    nt = world.node_tree
    sky = nt.nodes.new("ShaderNodeTexSky")
    sky.sky_type = "NISHITA"
    sky.sun_disc = False
    sky.sun_elevation = math.radians(sun_elevation)
    sky.sun_rotation = math.radians(sun_azimuth)
    sky.air_density = 1.2
    bg = nt.nodes["Background"]
    bg.inputs["Strength"].default_value = 0.25
    nt.links.new(sky.outputs["Color"], bg.inputs["Color"])
    sun = bpy.data.lights.new("Sun", "SUN")
    sun.energy = 3.2
    sun.angle = math.radians(1.5)
    obj = bpy.data.objects.new("Sun", sun)
    scn.collection.objects.link(obj)
    aim(obj, sun_azimuth, sun_elevation)
    return sky, obj


def aim(sun_obj, azimuth, elevation):
    """Azimuth: degrees clockwise from north (+Y). Sun shines from that direction."""
    az, el = math.radians(azimuth), math.radians(elevation)
    to_sun = Vector((math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el)))
    sun_obj.rotation_euler = (-to_sun).to_track_quat("-Z", "Y").to_euler()


VIEWS = {
    # name: (camera location, target, focal mm, resolution, sun azimuth, sun elevation[, lens shift y])
    "front": ((22.0, -2.5, 1.3), (18.0, 13.5, 1.3), 20, (1200, 1200), 235, 32, 0.10),
    "lake":  ((26.0, 135.0, -3.2), (27.0, 35.0, 1.0), 40, (1600, 900), 300, 18),
    "pool":  ((19.5, 37.6, 1.7), (33.0, 62.0, -2.0), 20, (1600, 900), 290, 22),
    "aerial": ((-32.0, -26.0, 52.0), (40.0, 42.0, -2.0), 30, (1600, 900), 235, 38),
}


def camera(name, loc, target, lens, shift_y=0.0):
    """shift_y > 0 frames higher while the camera stays level, keeping verticals straight."""
    cam = bpy.data.cameras.new(name)
    cam.lens = lens
    cam.shift_y = shift_y
    cam.clip_end = 3000
    obj = bpy.data.objects.new("Cam_" + name, cam)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = loc
    obj.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    return obj


def render_setup(preview):
    scn = bpy.context.scene
    scn.render.engine = "CYCLES"
    scn.cycles.device = "CPU"
    scn.cycles.samples = 16 if preview else 64
    scn.cycles.use_denoising = True
    scn.cycles.max_bounces = 4
    scn.render.film_transparent = False
    scn.view_settings.view_transform = "AgX"
    scn.view_settings.look = "AgX - Base Contrast"
    scn.render.image_settings.file_format = "PNG"


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    preview = "--preview" in args
    views = list(VIEWS)
    if "--views" in args:
        views = args[args.index("--views") + 1].split(",")
    reset()
    materials()
    build_site()
    build_house()
    build_terrace()
    build_heli()
    build_lake()
    render_setup(preview)
    sky, sun = world_and_light(235, 32)
    for name, view in VIEWS.items():
        loc, target, lens = view[:3]
        camera(name, loc, target, lens, view[6] if len(view) > 6 else 0.0)
    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND, compress=True)
    os.makedirs(OUT_DIR, exist_ok=True)
    scn = bpy.context.scene
    for i, name in enumerate(views):
        loc, target, lens, res, az, el = VIEWS[name][:6]
        scn.camera = bpy.data.objects["Cam_" + name]
        scale = 0.5 if preview else 1.0
        scn.render.resolution_x, scn.render.resolution_y = int(res[0] * scale), int(res[1] * scale)
        aim(sun, az, el)
        sky.sun_rotation = math.radians(az)
        sky.sun_elevation = math.radians(el)
        idx = list(VIEWS).index(name) + 1
        scn.render.filepath = os.path.join(OUT_DIR, f"{idx:02d}_{name}.png")
        bpy.ops.render.render(write_still=True)
        print("rendered", scn.render.filepath, flush=True)


if __name__ == "__main__":
    main()
