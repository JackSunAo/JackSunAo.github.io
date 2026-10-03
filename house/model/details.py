"""Facade detailing on top of the massing: real windows, trims, lanterns, hedges, material swap.

Runs after build_massing has built the scene; uses build_massing.WINDOWS for window positions.
"""
import math

import bpy
from mathutils import Vector

import build_massing as bm


def _box(name, x1, x2, y1, y2, z1, z2, material, coll):
    o = bm.box(name, x1, x2, y1, y2, z1, z2, "wall", coll)
    o.data.materials[0] = material
    return o


def _facade_box(spec, name, u1, u2, d1, d2, z1, z2, material, coll):
    """Box in facade space: u along the wall, d outward from the wall face (d=0 at the face)."""
    p, out = spec["plane"], spec["out"]
    y1, y2 = sorted((p + out * d1, p + out * d2))
    if spec["axis"] == "y":
        return _box(name, u1, u2, y1, y2, z1, z2, material, coll)
    return _box(name, y1, y2, u1, u2, z1, z2, material, coll)


# ---------------------------------------------------------------- materials
WALL_MAP = [  # (object-name prefix, material key)
    ("Main_", "siding"), ("Dormer", "siding"), ("StoneGable_", "stone"), ("Chimney", "stone"),
    ("BrickWing_", "brick"), ("EastGable_", "brick"), ("RearGable_", "brick"), ("Garage_", "brick"),
    ("Hangar_", "brick"), ("BarHouse", "brick"), ("PoolEquip", "brick"),
]


def apply_materials(M):
    col_taupe = M["column"]
    for o in bpy.data.objects:
        if o.type != "MESH":
            continue
        n = o.name

        def put(m):
            o.data.materials.clear()
            o.data.materials.append(m)

        if n.endswith(("_roofS", "_roofN", "_roofW", "_roofE")):
            top = M["metal"] if n.startswith(("Hangar", "BH_")) else M["shingle"]
            o.data.materials.clear()
            o.data.materials.append(top)
            o.data.materials.append(M["trim"])
            for mod in o.modifiers:
                if mod.type == "SOLIDIFY":
                    mod.material_offset_rim = 1
            continue
        if n in ("PorchRoof", "PatioRoof"):
            o.data.materials.clear()
            o.data.materials.append(M["metal"])
            o.data.materials.append(M["trim"])
            o.modifiers[0].material_offset_rim = 1
            continue
        for prefix, key in WALL_MAP:
            if n.startswith(prefix):
                put(M[key])
                break
        else:
            if n.startswith(("PorchPost", "PatioPost")):
                put(col_taupe)
            elif n in ("PorchSlab", "Deck", "LowerTerrace", "LoungeFloor", "FirePitPad") or n.startswith(("Step", "BarStair")):
                put(M["limestone_paver"])
            elif n.startswith(("RetainW", "RetainE", "Bulkhead")):
                put(M["stone"])
            elif n == "Terrain" or n.startswith("Ground") or n == "FarGround":
                put(M["lawn"])
            elif n in ("Walkway",):
                put(M["aggregate"])
            elif n in ("Driveway", "MotorCourt", "HangarApron", "TowPath", "BoatPath", "GardenSidePath"):
                put(M["drive"])
            elif n in ("Lake",):
                put(M["lake"])
            elif n in ("PoolWater", "SwimUpWater", "SpaWater"):
                put(M["pool"])
            elif n in ("BarRoofSlab",):
                put(M["trim"])
            elif n.startswith(("GarageDoor", "HangarDoor")):
                put(M["door"])
            elif n in ("BarGlassLake", "BarWindowPool", "LoungeGlass"):
                put(M["glass"])
            elif n.endswith("_crown") or n.startswith(("Shrub", "Parterre")):
                put(M["foliage"])
            elif n.startswith("FarTree") or n.startswith("FarHill"):
                put(M["far_foliage"])


# ---------------------------------------------------------------- windows
def build_windows(M, coll):
    """Replace each massing panel with glass + black frame + mullions + surround."""
    for spec in bm.WINDOWS:
        old = bpy.data.objects.get(spec["name"])
        if old:
            bpy.data.objects.remove(old, do_unlink=True)
        n, a, b, z1, z2, st = spec["name"], spec["a"], spec["b"], spec["z1"], spec["z2"], spec["style"]
        w, h = b - a, z2 - z1
        if st == "door":
            _facade_box(spec, n + "_leaf", a, b, 0.0, 0.08, z1, z2, M["door"], coll)
            _facade_box(spec, n + "_lite", a + 0.15, b - 0.15, 0.08, 0.09, z1 + 1.2, z2 - 0.2, M["glass"], coll)
            for k, (u1, u2) in enumerate([(a - 0.2, a), (b, b + 0.2)]):
                _facade_box(spec, f"{n}_jamb{k}", u1, u2, 0.0, 0.12, z1, z2 + 0.2, M["trim"], coll)
            _facade_box(spec, n + "_head", a - 0.2, b + 0.2, 0.0, 0.12, z2, z2 + 0.2, M["trim"], coll)
            continue
        # glass sits just proud of the wall face, frame and mullions in front of it
        _facade_box(spec, n + "_glass", a, b, 0.005, 0.015, z1, z2, M["glass"], coll)
        f, depth = 0.07, 0.09
        _facade_box(spec, n + "_fL", a, a + f, 0.0, depth, z1, z2, M["frame"], coll)
        _facade_box(spec, n + "_fR", b - f, b, 0.0, depth, z1, z2, M["frame"], coll)
        _facade_box(spec, n + "_fB", a, b, 0.0, depth, z1, z1 + f, M["frame"], coll)
        _facade_box(spec, n + "_fT", a, b, 0.0, depth, z2 - f, z2, M["frame"], coll)
        cols = 2 if w > 1.4 else 1
        rows = 2 if h > 1.5 else 1
        for i in range(1, cols):
            u = a + w * i / cols
            _facade_box(spec, f"{n}_mv{i}", u - 0.03, u + 0.03, 0.0, depth * 0.8, z1, z2, M["frame"], coll)
        for j in range(1, rows):
            zz = z1 + h * j / rows
            _facade_box(spec, f"{n}_mh{j}", a, b, 0.0, depth * 0.8, zz - 0.03, zz + 0.03, M["frame"], coll)
        if st == "siding":
            # cream casing + sill (the reference's taupe wing and dormers)
            c = 0.14
            _facade_box(spec, n + "_cL", a - c, a, 0.0, 0.05, z1 - 0.05, z2 + c, M["trim"], coll)
            _facade_box(spec, n + "_cR", b, b + c, 0.0, 0.05, z1 - 0.05, z2 + c, M["trim"], coll)
            _facade_box(spec, n + "_cT", a - c - 0.04, b + c + 0.04, 0.0, 0.07, z2, z2 + c + 0.04, M["trim"], coll)
            _facade_box(spec, n + "_sill", a - c - 0.04, b + c + 0.04, 0.0, 0.09, z1 - 0.1, z1, M["trim"], coll)
        else:
            # brick / stone: black flat head above, cast-stone sill below (as in the reference)
            _facade_box(spec, n + "_head", a - 0.12, b + 0.12, 0.0, 0.1, z2 + 0.02, z2 + 0.32, M["frame"], coll)
            _facade_box(spec, n + "_sill", a - 0.08, b + 0.08, 0.0, 0.08, z1 - 0.1, z1, M["trim"], coll)


# ---------------------------------------------------------------- facade extras
def build_extras(M, coll):
    Y_MAIN, Y_EGABLE = bm.Y_MAIN, bm.Y_EGABLE
    # wall lanterns either side of the openings under the porch
    for i, x in enumerate((8.75, 14.65, 15.55, 20.55)):
        y = Y_MAIN - (0.3 if 15 <= x <= 22 else 0.0)
        _box(f"Lantern{i}_body", x - 0.14, x + 0.14, y - 0.3, y - 0.02, 2.05, 2.55, M["frame"], coll)
        _box(f"Lantern{i}_glow", x - 0.1, x + 0.1, y - 0.26, y - 0.06, 2.1, 2.5, M["lantern"], coll)
        _box(f"Lantern{i}_cap", x - 0.17, x + 0.17, y - 0.33, y, 2.55, 2.62, M["frame"], coll)
    # porch column caps and bases
    for x in (8.6, 11.9, 15.2, 18.5, 21.7):
        yp = Y_MAIN - 3.2
        _box(f"ColBase{x}", x - 0.28, x + 0.28, yp + 0.12, yp + 0.68, -0.05, 0.35, M["trim"], coll)
        _box(f"ColCap{x}", x - 0.28, x + 0.28, yp + 0.12, yp + 0.68, 3.25, 3.5, M["trim"], coll)
    # porch beam / frieze under the metal roof
    _box("PorchBeam", 8.2, 22.0, Y_MAIN - 3.0, Y_MAIN - 2.8, 3.2, 3.55, M["trim"], coll)
    # diamond brick pattern on the east gable, left of the 2F window (reference detail)
    x1, x2, z1, z2, step = 28.75, 30.55, 3.45, 6.55, 0.6
    y = Y_EGABLE - 0.025
    for k in range(-6, 8):
        for sgn in (1, -1):
            # diagonal strip from (x, z1) rising at 45 degrees, clipped to the panel
            x0 = x1 + k * step
            pts = []
            for t in [i * 0.05 for i in range(0, 200)]:
                xx = x0 + t if sgn > 0 else x0 + (z2 - z1) - t
                zz = z1 + t
                if x1 <= xx <= x2 and z1 <= zz <= z2:
                    pts.append((xx, zz))
            if len(pts) < 2:
                continue
            (xa, za), (xb, zb) = pts[0], pts[-1]
            L = math.hypot(xb - xa, zb - za)
            o = _box(f"Diamond{k}{sgn}", -L / 2, L / 2, -0.012, 0.012, -0.025, 0.025, M["brick_dark"], coll)
            o.location = ((xa + xb) / 2, y, (za + zb) / 2)
            o.rotation_euler = (0, -math.atan2(zb - za, xb - xa), 0)
    # gutters along the main front eaves (cream half-rounds)
    for i, (xa, xb, yy, zz) in enumerate([(8.0, 15.0, Y_MAIN - 0.45, bm.EAVE - 0.5), (22.0, 28.5, bm.Y_BRICK - 0.4, bm.EAVE - 0.47)]):
        g = bm.cylinder(f"Gutter{i}", 0, 0, -(xb - xa) / 2, (xb - xa) / 2, 0.08, "wall", coll, 12)
        g.data.materials[0] = M["trim"]
        g.rotation_euler = (0, math.radians(90), 0)
        g.location = ((xa + xb) / 2, yy, zz)


# ---------------------------------------------------------------- landscape near the entry
def _offset(pts, d):
    res = []
    for i, p in enumerate(pts):
        q0, q1 = pts[max(0, i - 1)], pts[min(len(pts) - 1, i + 1)]
        t = Vector((q1[0] - q0[0], q1[1] - q0[1])).normalized()
        res.append((p[0] - t.y * d, p[1] + t.x * d))
    return res


def _hedge_line(name, pts, width, height, material, coll):
    o = bm.ribbon(name, pts, width, "hedge", coll, dz=height)
    o.data.materials[0] = material
    mod = o.modifiers.new("solid", "SOLIDIFY")
    mod.thickness = height + 0.2
    mod.offset = -1.0
    bev = o.modifiers.new("bevel", "BEVEL")
    bev.width = 0.12
    bev.segments = 2
    return o


def build_landscape(M, coll):
    walk = bm.bezier((17, -0.2), (10, 4), (28, 6), (19.5, bm.Y_MAIN - 3.2))
    for s in (1, -1):
        curb = _offset(walk, s * 1.3)
        o = bm.ribbon(f"Curb{s}", curb, 0.22, "paving", coll, dz=0.09)
        o.data.materials[0] = M["paver"]
        hedge = _offset(walk, s * 1.75)[2:-6]
        _hedge_line(f"Boxwood{s}", hedge, 0.55, 0.45, M["boxwood"], coll)
    # agave / grass clumps in the front beds (simple spiky stand-ins)
    import random
    rnd = random.Random(7)
    for i in range(36):
        x = rnd.uniform(8.5, 18.0) if i < 22 else rnd.uniform(22.3, 33.6)
        y = rnd.uniform(bm.Y_MAIN - 4.6, bm.Y_MAIN - 3.4) if i < 22 else rnd.uniform(bm.Y_EGABLE - 1.4, bm.Y_EGABLE - 0.2)
        z = bm.ground(x, y)
        bpy.ops.mesh.primitive_cone_add(vertices=7, radius1=0.45, radius2=0.0, depth=0.7, location=(x, y, z + 0.3))
        a = bpy.context.active_object
        a.name = f"Agave{i}"
        a.data.materials.append(M["agave"])
        for c in a.users_collection:
            c.objects.unlink(a)
        coll.objects.link(a)
    # small conical evergreens by the porch (as in the reference)
    for i, (x, y) in enumerate([(8.2, 9.6), (13.3, 9.7), (17.7, 9.6), (28.9, 8.4)]):
        z = bm.ground(x, y)
        bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=0.7, radius2=0.05, depth=3.2, location=(x, y, z + 1.6))
        t = bpy.context.active_object
        t.name = f"Evergreen{i}"
        t.data.materials.append(M["boxwood"])
        for c in t.users_collection:
            c.objects.unlink(t)
        coll.objects.link(t)
