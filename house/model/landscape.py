"""Rear landscape: themed garden rooms (west), the framed activity lawn (centre), shoreline,
pier and wildflower meadow (east). Coordinates match house/design/siteplan.py.

Called from build_massing.build_site(bm, coll) with the *running* build_massing module so the
shared material table and helpers are the same objects.
"""
import math
import random

import bmesh
import bpy
from mathutils import Matrix

FLOWER = {   # name: hex
    "fl_pink": "#e58fb3", "fl_purple": "#8f6fd0", "fl_white": "#f4f1ea", "fl_yellow": "#f2c94c",
    "fl_red": "#c9403b", "fl_blue": "#4f74d6", "fl_orange": "#e8833a", "fl_lavender": "#a28ad8",
}


def _materials(bm):
    for k, h in FLOWER.items():
        bm.mat(k, bm.srgb(h), 0.7)
    bm.mat("soil", bm.srgb("#5b4636"), 1.0)
    bm.mat("mulch", bm.srgb("#7a5a3e"), 1.0)
    bm.mat("gravel", bm.srgb("#d8cbb1"), 0.95)
    bm.mat("sand", bm.srgb("#ead8ae"), 0.95)
    bm.mat("shrub", bm.srgb("#4f7238"), 0.95)
    bm.mat("crape", bm.srgb("#d987ad"), 0.9)
    bm.mat("willow", bm.srgb("#9cbc6a"), 0.95)
    bm.mat("cypress", bm.srgb("#4d6b3a"), 0.95)
    bm.mat("grass_tan", bm.srgb("#c8b27a"), 0.95)
    bm.mat("lilypad", bm.srgb("#4f8a3c"), 0.6)
    bm.mat("stone", bm.srgb("#cfc4ae"), 0.85)
    bm.mat("play", bm.srgb("#2f6b8f"), 0.5)


# ---------------------------------------------------------------- scatter helpers
def scatter(bm, coll, name, pts, material, size=(0.25, 0.4), lift=0.15, squash=0.8, seed=1):
    """One mesh of many small low-poly blobs (flower heads, shrubs) sitting on the grade."""
    if not pts:
        return None
    rnd = random.Random(seed)
    mesh = bpy.data.meshes.new(name)
    b = bmesh.new()
    for (x, y) in pts:
        r = rnd.uniform(*size)
        z = bm.ground(x, y) + lift + r * squash
        mtx = Matrix.Translation((x, y, z)) @ Matrix.Diagonal((1, 1, squash, 1))
        bmesh.ops.create_icosphere(b, subdivisions=1, radius=r, matrix=mtx)
    b.to_mesh(mesh)
    b.free()
    for p in mesh.polygons:
        p.use_smooth = True
    o = bpy.data.objects.new(name, mesh)
    o.data.materials.append(bm.MATS[material])
    coll.objects.link(o)
    return o


def pts_in(rnd, x1, y1, x2, y2, n, keep=lambda x, y: True):
    out = []
    tries = 0
    while len(out) < n and tries < n * 20:
        tries += 1
        x, y = rnd.uniform(x1, x2), rnd.uniform(y1, y2)
        if keep(x, y):
            out.append((x, y))
    return out


def flower_bed(bm, coll, name, x1, y1, x2, y2, colors, density, seed, keep=lambda x, y: True, shrubs=0.25):
    """Soil bed + green mounds + coloured flower drifts (colours clustered, like real drifts)."""
    rnd = random.Random(seed)
    bm.terrain_strip(name + "_bed", x1, x2, y1, y2, "soil", coll, dz=0.03, step=2.0)
    area = (x2 - x1) * (y2 - y1)
    green = pts_in(rnd, x1 + 0.3, y1 + 0.3, x2 - 0.3, y2 - 0.3, int(area * density * shrubs), keep)
    scatter(bm, coll, name + "_green", green, "shrub", (0.35, 0.6), 0.0, 0.75, seed)
    # drifts: pick centres, give each a colour, scatter heads around them
    by_color = {c: [] for c in colors}
    n_drifts = max(2, int(area / 6))
    for _ in range(n_drifts):
        cx, cy = rnd.uniform(x1, x2), rnd.uniform(y1, y2)
        col = rnd.choice(colors)
        for _ in range(int(density * 12)):
            x, y = cx + rnd.gauss(0, 0.9), cy + rnd.gauss(0, 0.9)
            if x1 + 0.2 < x < x2 - 0.2 and y1 + 0.2 < y < y2 - 0.2 and keep(x, y):
                by_color[col].append((x, y))
    for col, pts in by_color.items():
        scatter(bm, coll, f"{name}_{col}", pts, col, (0.08, 0.16), 0.4, 0.7, seed + sum(map(ord, col)))


def ellipse_pts(cx, cy, rx, ry, n=96):
    return [(cx + rx * math.cos(2 * math.pi * i / n), cy + ry * math.sin(2 * math.pi * i / n)) for i in range(n + 1)]


def in_ellipse(x, y, cx, cy, rx, ry):
    return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0


def small_tree(bm, coll, name, x, y, h, r, crown_mat):
    z0 = bm.ground(x, y)
    bm.cylinder(name + "_trunk", x, y, z0, z0 + h * 0.5, max(0.1, r * 0.08), "trunk", coll, 8)
    o = bm.blob(name + "_bloom", x, y, z0 + h * 0.65, r, r, h * 0.35, crown_mat, coll, 2)
    return o


def cone_tree(bm, coll, name, x, y, h, r, material):
    z0 = bm.ground(x, y)
    bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=r, radius2=0.1, depth=h, location=(x, y, z0 + h / 2))
    o = bpy.context.active_object
    o.name = name
    o.data.materials.append(bm.MATS[material])
    for c in o.users_collection:
        c.objects.unlink(o)
    coll.objects.link(o)
    return o


# ---------------------------------------------------------------- garden rooms (west)
def build_garden(bm, c):
    g = bm.ground
    rnd = random.Random(5)
    # side path + arbor from the front yard, flowers both sides
    bm.terrain_strip("GardenSidePath", 2.2, 5.8, 13.5, 29, "gravel", c)
    flower_bed(bm, c, "SideBedW", 0.6, 13.6, 2.2, 28.8, ["fl_purple", "fl_white", "fl_pink"], 2.0, 11)
    flower_bed(bm, c, "SideBedE", 5.8, 13.6, 7.4, 28.8, ["fl_purple", "fl_white", "fl_pink"], 2.0, 12)
    for x in (2.0, 6.0):
        bm.box(f"ArborPost{x}", x - 0.1, x + 0.1, 12.9, 13.1, g(x, 13) - 0.3, g(x, 13) + 2.5, "wood", c)
    bm.box("ArborTop", 1.8, 6.2, 12.8, 13.2, g(4, 13) + 2.5, g(4, 13) + 2.7, "wood", c)

    # 1 formal garden: boxwood-edged beds of roses / lavender / hydrangea, central fountain
    bm.terrain_strip("FormalGravel", 0.5, 14.5, 29.3, 40.3, "gravel", c, dz=0.02)
    for i, (x, y) in enumerate([(1, 30), (8.5, 30), (1, 35.5), (8.5, 35.5)]):
        z = g(x + 2.75, y + 1.9)
        for k, (a, b, yy1, yy2) in enumerate([(x, x + 5.5, y, y + 0.35), (x, x + 5.5, y + 3.45, y + 3.8),
                                              (x, x + 0.35, y, y + 3.8), (x + 5.15, x + 5.5, y, y + 3.8)]):
            bm.box(f"FormalHedge{i}_{k}", a, b, yy1, yy2, z - 0.4, z + 0.55, "hedge", c)
        flower_bed(bm, c, f"Formal{i}", x + 0.4, y + 0.4, x + 5.1, y + 3.4,
                   ["fl_pink", "fl_red", "fl_white", "fl_lavender"], 3.0, 20 + i, shrubs=0.4)
    z = g(7.5, 35)
    bm.cylinder("FountainBasin", 7.5, 35, z - 0.2, z + 0.45, 1.15, "stone", c, 32)
    bm.cylinder("FountainWater", 7.5, 35, z + 0.3, z + 0.42, 1.0, "pool", c, 32)
    bm.cylinder("FountainTier", 7.5, 35, z + 0.42, z + 1.4, 0.18, "stone", c, 16)
    bm.cylinder("FountainBowl", 7.5, 35, z + 1.3, z + 1.45, 0.55, "stone", c, 24)

    # 2 wisteria pergola walk
    z = g(7.5, 43)
    for x in range(1, 15, 2):
        for y in (41.6, 44.4):
            bm.box(f"PergolaPost{x}_{y}", x - 0.1, x + 0.1, y - 0.1, y + 0.1, z - 0.3, z + 2.8, "wood", c)
    for x in [i * 0.7 + 0.8 for i in range(20)]:
        bm.box(f"PergolaBeam{x:.1f}", x - 0.05, x + 0.05, 41.2, 44.8, z + 2.8, z + 3.0, "wood", c)
    wis = pts_in(rnd, 0.8, 41.3, 14.2, 44.7, 260)
    scatter(bm, c, "Wisteria", [(x, y) for x, y in wis], "fl_lavender", (0.18, 0.32), 2.75, 1.4, 3)
    bm.terrain_strip("PergolaWalk", 0.8, 14.2, 41.6, 44.4, "gravel", c, dz=0.02)

    # 3 double perennial border along a gravel walk, bench at the end
    bm.terrain_strip("BorderWalk", 5.5, 9.5, 46, 60.5, "gravel", c, dz=0.02)
    cols = ["fl_purple", "fl_pink", "fl_yellow", "fl_white", "fl_blue", "fl_orange"]
    flower_bed(bm, c, "BorderW", 1, 46, 5.5, 60, cols, 3.2, 31)
    flower_bed(bm, c, "BorderE", 9.5, 46, 14, 60, cols, 3.2, 32)
    grass = pts_in(rnd, 1, 46, 14, 60, 16, lambda x, y: x < 4.8 or x > 10.2)
    for i, (x, y) in enumerate(grass):
        cone_tree(bm, c, f"OrnGrass{i}", x, y, 0.9, 0.22, "grass_tan")
    zb = g(7.5, 60.6)
    bm.box("GardenBench", 6.4, 8.6, 60.3, 60.8, zb, zb + 0.45, "wood", c)
    bm.box("GardenBenchBack", 6.4, 8.6, 60.7, 60.85, zb + 0.45, zb + 0.95, "wood", c)

    # 4 lily pond, gazebo, weeping willow
    z = g(6.5, 68)
    ring = bm.cylinder("PondCoping", 6.5, 68, z - 0.3, z + 0.12, 1.0, "stone", c, 48)
    ring.scale = (4.9, 4.5, 1)
    water = bm.cylinder("PondWater", 6.5, 68, z - 0.4, z + 0.16, 1.0, "pool", c, 48)
    water.scale = (4.6, 4.2, 1)
    for i, (x, y) in enumerate([(5, 69), (7.5, 66.5), (8.2, 70), (4.5, 66.2), (6.6, 68.4), (9.0, 67.6), (4.0, 69.8)]):
        bm.cylinder(f"LilyPad{i}", x, y, z + 0.16, z + 0.18, 0.45, "lilypad", c, 12)
        bm.blob(f"Lily{i}", x + 0.15, y + 0.1, z + 0.24, 0.13, 0.13, 0.08, "fl_pink", c, 1)
    zg = g(12.6, 71)
    bm.cylinder("GazeboFloor", 12.6, 71, zg - 0.3, zg + 0.25, 2.0, "wood", c, 8)
    for a in range(0, 360, 45):
        x, y = 12.6 + 1.8 * math.cos(math.radians(a)), 71 + 1.8 * math.sin(math.radians(a))
        bm.cylinder(f"GazeboPost{a}", x, y, zg + 0.25, zg + 2.8, 0.08, "wall", c, 8)
    bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=2.4, radius2=0.05, depth=1.8, location=(12.6, 71, zg + 3.7))
    roof = bpy.context.active_object
    roof.name = "GazeboRoof"
    roof.data.materials.append(bm.MATS["roof"])
    for col in roof.users_collection:
        col.objects.unlink(roof)
    c.objects.link(roof)
    zw = g(2.6, 73.4)
    bm.cylinder("Willow_trunk", 2.6, 73.4, zw, zw + 3.5, 0.3, "trunk", c, 8)
    bm.blob("Willow_canopy", 2.6, 73.4, zw + 4.2, 3.4, 3.4, 3.6, "willow", c, 3)
    flower_bed(bm, c, "PondEdge", 0.6, 62.3, 14.4, 64.0, ["fl_blue", "fl_white", "fl_yellow"], 2.5, 41)

    # 5 kitchen + herb garden, greenhouse
    bm.terrain_strip("KitchenGravel", 0.8, 14.2, 75.5, 90.0, "gravel", c, dz=0.02)
    for i, y in enumerate((76, 79, 82)):
        for x, extra in ((1.5, "fl_red"), (8.5, "fl_yellow")):
            z = g(x + 2.25, y + 1.1)
            bm.box(f"RaisedBed{i}_{x}", x, x + 4.5, y, y + 2.2, z - 0.3, z + 0.55, "wood", c)
            veg = pts_in(rnd, x + 0.3, y + 0.3, x + 4.2, y + 1.9, 22)
            scatter(bm, c, f"Veg{i}_{x}", [(a, b) for a, b in veg], "shrub", (0.18, 0.3), 0.55, 0.7, i)
            scatter(bm, c, f"VegFruit{i}_{x}", veg[:6], extra, (0.08, 0.12), 0.75, 1.0, i + 7)
    z = g(4, 87.3)
    for k, r in enumerate((1.5, 1.1, 0.7, 0.35)):
        bm.cylinder(f"HerbSpiral{k}", 4, 87.3, z - 0.2, z + 0.25 * (k + 1), r, "stone", c, 24)
    scatter(bm, c, "Herbs", pts_in(rnd, 2.6, 85.9, 5.4, 88.7, 30, lambda x, y: in_ellipse(x, y, 4, 87.3, 1.4, 1.4)),
            "fl_lavender", (0.1, 0.18), 0.6, 0.8, 9)
    z = g(11.25, 87.25)
    bm.box("Greenhouse", 8.5, 14, 85.5, 89, z - 0.2, z + 2.4, "glass", c)
    bm.gable("GreenhouseRoof", 8.5, 14, 85.5, 89, z + 2.4, "x", 0.8, 0.1, "glass", "glass", c)

    # 6 small orchard in a bluebonnet meadow
    blue = pts_in(rnd, 0.6, 90.2, 14.4, 97.4, 900)
    scatter(bm, c, "Bluebonnets", blue, "fl_blue", (0.06, 0.11), 0.08, 1.0, 13)
    for x in (2.5, 7.5, 12.5):
        for y in (91.8, 95.6):
            bm.tree(f"Fruit{x}_{y}", x, y, 4.2, 1.5, c)

    # garden hedge toward the lawn, with two openings
    for (y1, y2) in ((50, 62), (64, 84), (86, 97.5)):
        y = y1
        while y < y2:
            yb = min(y + 3, y2)
            z1, z2 = g(15, y), g(15, yb)
            bm.box(f"GardenHedge{y:.0f}", 14.6, 15.4, y, yb, min(z1, z2) - 0.3, max(z1, z2) + 1.4, "hedge", c)
            y = yb


# ---------------------------------------------------------------- activity lawn (centre)
LAWN = (30.0, 74.0)       # lawn ellipse centre; path ring and planted frame around it


def build_lawn(bm, c):
    g = bm.ground
    rnd = random.Random(8)
    cx, cy = LAWN
    # gravel walking loop
    bm.ribbon("LawnLoop", ellipse_pts(cx, cy, 14.3, 20.3, 140), 1.8, "gravel", c, dz=0.04)
    # planted frame outside the loop: shrubs + perennials, leaving the activity corners open
    clear = [(18.2, 84.2, 25.5, 91.2), (36.5, 88.5, 44.5, 94.5), (27.0, 92.5, 33.0, 98.5),
             (15.5, 96.5, 26.5, 100), (39.5, 62.0, 47.0, 72.0)]

    def frame_keep(x, y):
        if in_ellipse(x, y, cx, cy, 15.4, 21.4):
            return False
        return not any(a <= x <= b and d1 <= y <= d2 for a, d1, b, d2 in clear)
    shrubs = pts_in(rnd, 15.8, 50.8, 47.2, 96.8, 420, frame_keep)
    scatter(bm, c, "FrameShrubs", shrubs, "shrub", (0.45, 0.9), 0.0, 0.8, 4)
    cols = ["fl_purple", "fl_pink", "fl_white", "fl_yellow"]
    for k, col in enumerate(cols):
        fl = pts_in(rnd, 15.8, 50.8, 47.2, 96.8, 700, frame_keep)
        scatter(bm, c, f"FrameFlowers_{col}", fl, col, (0.09, 0.16), 0.5, 0.7, 10 + k)
    # west grove: crape myrtles, hammock between two of them
    for i, (x, y, r) in enumerate([(17.5, 56, 2.2), (16.8, 62, 2.0), (17.4, 68, 2.3), (16.9, 74.5, 2.0), (17.6, 80, 2.2)]):
        small_tree(bm, c, f"Crape{i}", x, y, 5.5, r, "crape")
    z = g(17.5, 65)
    bm.box("Hammock", 17.25, 17.75, 62.4, 67.6, z + 0.7, z + 0.82, "fl_white", c)
    # great live oak with a rope swing, picnic tables in its shade
    ox, oy = 43.5, 66.5
    z = g(ox, oy)
    bm.cylinder("Oak_trunk", ox, oy, z, z + 5.5, 0.75, "trunk", c, 12)
    branch = bm.box("Oak_branch", -3.6, 0, -0.25, 0.25, -0.25, 0.25, "trunk", c)
    branch.location = (ox, oy - 0.2, z + 5.0)
    branch.rotation_euler = (0, math.radians(-8), math.radians(35))
    for k, (dx, dy, rx, rz) in enumerate([(0, 0, 7.0, 3.4), (-2.5, 1.5, 4.5, 2.6), (2.4, -1.8, 4.2, 2.4)]):
        bm.blob(f"Oak{k}_crown", ox + dx, oy + dy, z + 8.0, rx, rx * 0.9, rz, "tree", c, 3)
    sx, sy = ox - 2.6, oy - 2.0
    for k, dx in enumerate((-0.35, 0.35)):
        bm.cylinder(f"SwingRope{k}", sx + dx, sy, z + 0.55, z + 5.3, 0.02, "dark", c, 6)
    bm.box("SwingSeat", sx - 0.45, sx + 0.45, sy - 0.15, sy + 0.15, z + 0.5, z + 0.56, "wood", c)
    for i, (x, y) in enumerate([(44.2, 69.8), (45.3, 65.6), (41.8, 68.6)]):
        zz = g(x, y)
        bm.box(f"Picnic{i}_top", x - 1.0, x + 1.0, y - 0.4, y + 0.4, zz + 0.72, zz + 0.78, "wood", c)
        for s in (-1, 1):
            bm.box(f"Picnic{i}_bench{s}", x - 1.0, x + 1.0, y + s * 0.75 - 0.15, y + s * 0.75 + 0.15, zz + 0.42, zz + 0.47, "wood", c)
        bm.box(f"Picnic{i}_leg", x - 0.9, x + 0.9, y - 0.05, y + 0.05, zz, zz + 0.72, "wood", c)
    bm.tree("TreeE1", 45.5, 56.5, 8, 3.2, c)
    bm.tree("TreeE2", 44.8, 78.5, 9, 3.4, c)
    # lawn games
    for i, y in enumerate((66, 70)):
        zz = g(26.5, y)
        o = bm.box(f"Cornhole{i}", -0.3, 0.3, -0.6, 0.6, 0, 0.04, "fl_red", c)
        o.location = (26.5, y, zz + 0.15)
        o.rotation_euler = (math.radians(14 if i == 0 else -14), 0, 0)
    # children's play area in the shade: swing set, tower + slide, sandpit, on mulch
    bm.terrain_strip("PlayMulch", 18.2, 25.5, 84.2, 91.2, "mulch", c, dz=0.05)
    z = g(21.8, 87.7)
    for x in (18.8, 22.4):
        for s in (-1, 1):
            p = bm.box(f"SwingA{x}{s}", -0.06, 0.06, -0.06, 0.06, 0, 2.6, "wood", c)
            p.location = (x, 87.8 + s * 0.55, z)
            p.rotation_euler = (math.radians(s * -12), 0, 0)
    bm.box("SwingBeam", 18.6, 22.6, 87.7, 87.9, z + 2.45, z + 2.6, "wood", c)
    for k, x in enumerate((19.6, 20.6, 21.6)):
        bm.box(f"KidSwing{k}", x - 0.25, x + 0.25, 87.65, 87.95, z + 0.45, z + 0.5, "play", c)
        for dx in (-0.22, 0.22):
            bm.cylinder(f"KidRope{k}{dx}", x + dx, 87.8, z + 0.5, z + 2.45, 0.015, "dark", c, 6)
    bm.box("PlayTower", 22.9, 25.0, 86.0, 88.0, z, z + 1.5, "wood", c)
    bm.gable("PlayTowerRoof", 22.9, 25.0, 86.0, 88.0, z + 2.8, "y", 0.9, 0.15, "wood", "play", c)
    for x in (22.95, 24.95):
        for y in (86.05, 87.95):
            bm.box(f"TowerPost{x}{y}", x - 0.05, x + 0.05, y - 0.05, y + 0.05, z + 1.5, z + 2.8, "wood", c)
    bm.quad_slab("Slide", [(23.4, 88.0, z + 1.5), (24.4, 88.0, z + 1.5), (24.4, 90.8, z + 0.25), (23.4, 90.8, z + 0.25)], 0.06, "fl_yellow", c)
    bm.cylinder("Sandpit", 20.0, 90.2, g(20, 90.2) - 0.1, g(20, 90.2) + 0.25, 0.85, "wood", c, 24)
    bm.cylinder("SandpitSand", 20.0, 90.2, g(20, 90.2), g(20, 90.2) + 0.22, 0.75, "sand", c, 24)
    bm.tree("PlayShade1", 17.2, 87.5, 8, 2.6, c)
    bm.tree("PlayShade2", 24.5, 94.8, 7, 2.2, c)
    # barbecue pavilion with a dining table, framed by trees
    z = g(40.5, 91.5)
    bm.box("BBQ_Slab", 36.5, 44.5, 88.5, 94.5, z - 0.4, z + 0.15, "deck", c)
    for x in (36.8, 44.2):
        for y in (88.8, 94.2):
            bm.box(f"BBQ_Post{x}{y}", x - 0.15, x + 0.15, y - 0.15, y + 0.15, z + 0.15, z + 3.0, "wall", c)
    bm.gable("BBQ_Roof", 36.5, 44.5, 88.5, 94.5, z + 3.0, "x", 0.6, 0.35, coll=c)
    bm.box("BBQ_Grill", 37.1, 41.0, 93.0, 93.9, z + 0.15, z + 1.0, "stone", c)
    bm.box("BBQ_GrillTop", 37.1, 41.0, 93.0, 93.9, z + 1.0, z + 1.05, "dark", c)
    bm.box("BBQ_Table", 38.5, 42.5, 89.7, 91.2, z + 0.72, z + 0.8, "wood", c)
    bm.box("BBQ_TableLeg", 39.0, 42.0, 90.3, 90.6, z + 0.15, z + 0.72, "wood", c)
    bm.tree("BBQTree1", 46.0, 90.0, 8, 2.6, c)
    bm.tree("BBQTree2", 35.2, 96.4, 6, 1.8, c)
    # end of the view axis: lakeside fire-pit circle
    z = g(30, 95.4)
    bm.cylinder("FirePitPad", 30, 95.4, z - 0.3, z + 0.05, 2.7, "deck", c, 40)
    bm.cylinder("FirePitWall", 30, 95.4, z + 0.05, z + 0.5, 2.0, "stone", c, 40)
    bm.cylinder("FirePitSeatCut", 30, 95.4, z + 0.05, z + 0.52, 1.6, "deck", c, 40)
    bm.cylinder("FirePitBowl", 30, 95.4, z + 0.05, z + 0.45, 0.6, "dark", c, 24)
    bm.blob("FirePitFlame", 30, 95.4, z + 0.6, 0.25, 0.25, 0.35, "lantern_glow", c, 1)
    # sand beach running into the water beside the pier
    bm.terrain_strip("Beach", 15.5, 26.5, 96.5, 100, "sand", c, dz=0.04)
    zs = g(20, 100)
    bm.quad_slab("BeachSlope", [(15.5, 100, zs + 0.04), (26.5, 100, zs + 0.04), (26.5, 108, -6.2), (15.5, 108, -6.2)], 0.3, "sand", c)


# ---------------------------------------------------------------- shoreline, pier, meadow
def build_shore(bm, c):
    g = bm.ground
    rnd = random.Random(12)
    S = bm.SHORE
    zp = -4.1
    bm.box("Pier", 22.5, 24.5, S - 0.5, S + 8, zp - 0.3, zp, "wood", c)
    bm.box("PierT", 18, 29, S + 8, S + 10, zp - 0.3, zp, "wood", c)
    for x in (18.3, 22.7, 24.3, 28.7):
        for y in (S + 2, S + 5, S + 8.3, S + 9.7):
            if y > S + 7.9 or 22.5 <= x <= 24.5:
                bm.cylinder(f"Piling{x}_{y}", x, y, -8, zp + 0.6, 0.15, "wood", c, 8)
    # bald cypress + native grasses along the bank, open at beach, fire pit, pier and boathouse
    for i, x in enumerate((38.5, 3, 11, 56, 79)):
        cone_tree(bm, c, f"Cypress{i}", x, S - 1.4, 7.5 + (i % 3), 1.8, "cypress")
    grass = pts_in(rnd, 0, S - 2.2, 82, S - 0.6, 160,
                   lambda x, y: not (15 < x < 33 or 35.5 < x < 51))
    scatter(bm, c, "ShoreGrass", grass, "grass_tan", (0.35, 0.55), 0.0, 1.3, 5)
    # boathouse path (golf cart), along the meadow hedge
    bm.terrain_strip("BoatPath", 48, 50.5, 31, S, "paving", c)
    # east wildflower meadow, kept low for the helicopter approach, groves at its edges
    pts = pts_in(rnd, 52.2, 66.2, 81.3, S - 2.5, 2600)
    rnd.shuffle(pts)
    cols = ["fl_blue", "fl_yellow", "fl_orange", "fl_white", "fl_pink"]
    for k, col in enumerate(cols):
        scatter(bm, c, f"Meadow_{col}", pts[k::len(cols)], col, (0.05, 0.1), 0.1, 1.0, 20 + k)
    for i, y in enumerate((70, 77, 84, 91)):
        bm.tree(f"MeadowW{i}", 54.6, y, 8, 2.1, c)
        bm.tree(f"MeadowE{i}", 79.4, y + 3, 9, 2.3, c)
    bm.tree("MeadowW5", 57.5, 96.5, 6, 1.6, c)
    bm.tree("MeadowE5", 77.0, 70.0, 7, 1.8, c)
    # low hedge between lawn and the helicopter / meadow side
    for y in range(33, int(S) - 3, 3):
        z1, z2 = g(51.2, y), g(51.2, y + 3)
        bm.box(f"EastHedge{y}", 50.8, 51.6, y, y + 3, min(z1, z2) - 0.3, max(z1, z2) + 1.0, "hedge", c)


def build(bm, c):
    _materials(bm)
    bm.mat("lantern_glow", bm.srgb("#ff9a3c"), 0.5, emit=(bm.srgb("#ff8a2a"), 30.0))
    build_garden(bm, c)
    build_lawn(bm, c)
    build_shore(bm, c)
