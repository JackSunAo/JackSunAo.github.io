"""Rear landscape with real plants, replacing the placeholder blobs from landscape.py in place:
garden rooms (roses, lavender, hydrangea, perennial borders, wisteria, willow pond, kitchen garden,
orchard over bluebonnets), the framed activity lawn (live oak with swing, crape myrtles, shade
trees, real grass), shoreline cypress and switchgrass, the wildflower meadow, boundary woods and
the far shore."""
import math
import random
import re

import bpy

import front_yard as FY
import vegetation as V

PLACEHOLDER = re.compile(
    r"^(.*_green|.*_fl_.*|Wisteria|OrnGrass\d+|Willow_.*|Fruit.*_(trunk|crown)|Bluebonnets|Veg.*|Herbs|"
    r"FrameShrubs|FrameFlowers_.*|Crape\d+_.*|Oak_trunk|Oak_branch|Oak\d_crown|TreeE\d_.*|PlayShade\d_.*|"
    r"BBQTree\d_.*|Cypress\d+|ShoreGrass|Meadow_.*|MeadowW\d_.*|MeadowE\d_.*|West\d+_.*|East\d+_.*|"
    r"Screen\d+_\d_.*|FarTree\d+)$")


def _height_scale(coll, target):
    h = max((o.dimensions.z for o in coll.objects if o.type == "MESH"), default=1.0)
    return target / max(h, 1e-3)


def _clear():
    n = 0
    for o in list(bpy.data.objects):
        if PLACEHOLDER.match(o.name) and o.users_collection and o.users_collection[0].name in ("Site", "Details", "FacadeExtras"):
            bpy.data.objects.remove(o, do_unlink=True)
            n += 1
    return n


def build(bm, M, coll):
    g = bm.ground
    rnd = random.Random(77)
    S = bm.SHORE
    _clear()
    for nm in ("FormalGravel", "PergolaWalk", "BorderWalk", "KitchenGravel", "GardenSidePath", "LawnLoop"):
        o = bpy.data.objects.get(nm)
        if o:
            o.data.materials.clear()
            o.data.materials.append(M["gravel"])
    for nm in ("FirePitWall", "FirePitSeatCut", "FirePitBowl", "FirePitFlame"):
        o = bpy.data.objects.get(nm)
        if o:
            bpy.data.objects.remove(o, do_unlink=True)
    import props
    props.place("stone_fire_pit", (30.0, 95.4, g(30.0, 95.4) + 0.05), 0, 1.5, coll, name="RY_FirePit")
    for o in bpy.data.objects:                     # flower-bed soil strips -> mulch
        if o.name.endswith("_bed") and o.type == "MESH":
            o.data.materials.clear()
            o.data.materials.append(M["mulch"])

    # ---------------- plant libraries
    lib = {}
    lib["oak"] = V.load("island_tree_01", lambda n: n == "island_tree_01_LOD0", "oak1")
    lib["shade"] = V.load("island_tree_02", lambda n: n == "island_tree_02_LOD1", "shade2")
    lib["shade3"] = V.load("island_tree_03", lambda n: n == "island_tree_03_LOD1", "shade3")
    lib["crape"] = V.load("jacaranda_tree", lambda n: n in ("jacaranda_tree_LOD1", "jacaranda_tree_trunk_LOD1"), "crape")
    lib["fruit"] = V.load("tree_small_02", lambda n: n in ("tree_small_02_LOD1", "tree_small_02_trunk"), "magnolia")
    lib["fir"] = V.load("fir_tree_01", lambda n: re.fullmatch(r"fir_tree_01_[abc]_LOD1", n) is not None, "fir")
    lib["shrub"] = V.load("shrub_02", lambda n: n.endswith("_LOD1"), "shrub02")
    lib["leafy"] = V.load("shrub_04", lambda n: n.endswith("_LOD1"), "shrub04")
    lib["white"] = V.load("shrub_01", lambda n: n.endswith("_LOD1"), "shrub01")
    lib["fern"] = V.load("fern_02", lambda n: True, "fern")
    lib["peri"] = V.load("periwinkle_plant", lambda n: n.endswith("_LOD1"), "periwinkle")
    lib["yellow"] = V.load("flower_empodium", lambda n: n.endswith("_LOD1"), "empodium")
    lib["orange"] = V.load("flower_gazania", lambda n: True, "gazania")
    lib["tufts"] = V.load("grass_medium_02", lambda n: re.fullmatch(r"grass_medium_02_[a-e]", n) is not None, "tufts")
    lib["lawn"] = V.load("grass_bermuda_01", lambda n: re.fullmatch(r"grass_bermuda_01_(medium|small)_[a-f]", n) is not None, "bermuda")
    # the jacaranda's lavender bloom reads as a 'Muskogee' lavender crape myrtle as-is
    P = V.proto_collection
    lib["rose"] = P("rose", [V.bloom_bush(f"Rose{i}", 50 + i, 0.42, 0.9, 170, 26, c, 0.04)
                            for i, c in enumerate(("#d9476b", "#f08aa8", "#f6efe6", "#c22f45"))])
    lib["hydrangea"] = P("hydrangea", [V.bloom_bush(f"Hydrangea{i}", 60 + i, 0.6, 1.0, 220, 18, c, 0.09, "#3d6b33", ball=True)
                                      for i, c in enumerate(("#9db4e8", "#c9b3e6", "#f3f1f6"))])
    lib["lavender"] = P("lavender", [V.spike_plant(f"Lavender{i}", 70 + i, 0.55, 60, "#8f6fd0", "#9aa98f", 0.12, 0.28) for i in range(2)])
    lib["salvia"] = P("salvia", [V.spike_plant(f"Salvia{i}", 80 + i, 0.75, 40, c, "#4f7238", 0.14, 0.3)
                                for i, c in enumerate(("#d9534f", "#e86a9a", "#c8364a"))])
    lib["mexsage"] = P("mexsage", [V.spike_plant(f"MexSage{i}", 90 + i, 1.15, 35, "#7d4fb0", "#7d8f74", 0.28, 0.35) for i in range(2)])
    lib["russian"] = P("russian", [V.spike_plant(f"RussianSage{i}", 95 + i, 1.2, 50, "#9b8fd6", "#b7c2b4", 0.4, 0.35) for i in range(2)])
    lib["catmint"] = P("catmint", [V.spike_plant(f"Catmint{i}", 99 + i, 0.4, 70, "#8f9be0", "#93a78a", 0.1, 0.32) for i in range(2)])
    lib["cone"] = P("coneflower", [V.daisy_plant(f"Coneflower{i}", 110 + i, 0.8, 16, "#d77fb0", "#7a4a1e", spread=0.25, droop=0.8) for i in range(2)])
    lib["rudbeckia"] = P("rudbeckia", [V.daisy_plant(f"Rudbeckia{i}", 120 + i, 0.65, 20, "#f2c94c", "#2b1a10", spread=0.28, droop=0.3) for i in range(2)])
    lib["gaillardia"] = P("gaillardia", [V.daisy_plant(f"Gaillardia{i}", 125 + i, 0.4, 14, "#e0503a", "#5a2a14", spread=0.2, petal_len=0.03, droop=0.2) for i in range(2)])
    lib["lupine"] = P("lupine", [V.spike_plant(f"Bluebonnet{i}", 130 + i, 0.32, 10, c, "#6a8f55", 0.09, 0.12)
                                for i, c in enumerate(("#3f5fcf", "#4f74d6", "#e0503a"))])
    lib["iris"] = P("iris", [V.grass_clump(f"IrisLeaves{i}", 140 + i, 0.9, 60, 0.12, "#4f7a3c", "#5b4fd6", 30, 0.012) for i in range(2)])
    lib["muhly"] = P("muhly", [V.grass_clump(f"MuhlyR{i}", 150 + i, 0.85, 240, 0.35, "#9aa57c", "#d9a0c4") for i in range(2)])
    lib["switch"] = P("switch", [V.grass_clump(f"Switch{i}", 160 + i, 1.2, 260, 0.25, "#8aa070", "#c8b27a", 160, 0.007) for i in range(2)])
    lib["lettuce"] = P("lettuce", [V.bloom_bush(f"Veg{i}", 170 + i, 0.18, 0.22, 60, 6 if i else 0, "#c9403b", 0.03, "#6aa03e", ball=True) for i in range(2)])
    lib["willow"] = P("willow", [V.willow("WillowTree", 180)])

    def drop(x, y, dz=0.0):
        return (x, y, g(x, y) + dz)

    # ---------------- garden rooms (west)
    for side, (x1, x2) in (("W", (0.6, 2.2)), ("E", (5.8, 7.4))):
        pts = V.sample_poly([(x1, 13.8), (x2, 13.8), (x2, 28.6), (x1, 28.6)], 2.0, rnd, min_dist=0.75)
        V.scatter(f"RY_SideHyd{side}", lib["hydrangea"], [drop(x, y) for x, y in pts[::2]], coll, 1, (0.8, 1.0))
        V.scatter(f"RY_SideSal{side}", lib["salvia"], [drop(x, y) for x, y in pts[1::2]], coll, 2, (0.9, 1.1))
    for i, (x, y) in enumerate([(1, 30), (8.5, 30), (1, 35.5), (8.5, 35.5)]):
        box = [(x + 0.45, y + 0.45), (x + 5.05, y + 0.45), (x + 5.05, y + 3.35), (x + 0.45, y + 3.35)]
        roses = V.sample_poly(box, 3.0, rnd, lambda a, b: x + 1.0 < a < x + 4.5 and y + 0.95 < b < y + 2.85, min_dist=0.75)
        V.scatter(f"RY_Rose{i}", lib["rose"], [drop(a, b) for a, b in roses], coll, 10 + i, (0.85, 1.05))
        edge = V.sample_poly(box, 12.0, rnd, lambda a, b: not (x + 1.0 < a < x + 4.5 and y + 0.95 < b < y + 2.85), min_dist=0.38)
        V.scatter(f"RY_Lav{i}", lib["lavender"], [drop(a, b) for a, b in edge], coll, 20 + i, (0.85, 1.1))
    _hedges(bm, lib, coll, rnd, r"^(FormalHedge\d_\d|GardenHedge\d+|EastHedge\d+)$")
    _wisteria(bm, coll, rnd)
    border_cols = [("salvia", 1.0), ("mexsage", 0.6), ("cone", 1.0), ("rudbeckia", 1.0), ("catmint", 0.9), ("russian", 0.5), ("muhly", 0.35)]
    for side, (x1, x2) in (("W", (1.0, 5.5)), ("E", (9.5, 14.0))):
        _drifts(f"RY_Border{side}", [(x1, 46.1), (x2, 46.1), (x2, 59.9), (x1, 59.9)], border_cols, lib, bm, coll, rnd, 1.6)
        gc = V.sample_poly([(x1, 46.2), (x2, 46.2), (x2, 59.8), (x1, 59.8)], 6.0, rnd)
        V.scatter(f"RY_BorderGround{side}", lib["peri"], [drop(x, y) for x, y in gc], coll, 32, (2.2, 3.2))
        shrubs = V.sample_poly([(x1, 47), (x2, 47), (x2, 59), (x1, 59)], 0.25, rnd, min_dist=2.5)
        V.scatter(f"RY_BorderShrub{side}", lib["shrub"], [drop(x, y) for x, y in shrubs], coll, 31, (0.5, 0.7))
    pond_edge = V.sample_poly([(0.6, 62.3), (14.4, 62.3), (14.4, 64.0), (0.6, 64.0)], 2.0, rnd, min_dist=0.6)
    V.scatter("RY_Iris", lib["iris"], [drop(x, y) for x, y in pond_edge[::2]], coll, 40, (0.8, 1.1))
    V.scatter("RY_Fern", lib["fern"], [drop(x, y) for x, y in pond_edge[1::2]], coll, 41, (0.9, 1.3))
    ring = [(6.5 + 4.9 * math.cos(a) * 1.08, 68 + 4.5 * math.sin(a) * 1.08) for a in [k * 0.35 for k in range(18)]]
    V.scatter("RY_PondIris", lib["iris"], [drop(x, y) for x, y in ring[::2]], coll, 42, (0.8, 1.0))
    V.scatter("RY_PondFern", lib["fern"], [drop(x, y) for x, y in ring[1::2]], coll, 43, (0.8, 1.1))
    V.scatter("RY_Willow", lib["willow"], [drop(2.6, 73.4)], coll, 44, (1.0, 1.0))
    veg = []
    for y in (76, 79, 82):
        for x in (1.5, 8.5):
            veg += [drop(x + 0.35 + i * 0.5, y + 0.45 + j * 0.65, 0.5) for i in range(8) for j in range(2)]
    V.scatter("RY_Veg", lib["lettuce"], veg, coll, 45, (0.9, 1.2))
    fruit = [drop(x, y) for x in (2.5, 7.5, 12.5) for y in (91.8, 95.6)]
    V.scatter("RY_Fruit", lib["fruit"], [p + (0.85,) for p in fruit], coll, 46)
    lup = V.sample_poly([(0.6, 90.2), (14.4, 90.2), (14.4, 97.4), (0.6, 97.4)], 9.0, rnd, min_dist=0.22)
    V.scatter("RY_Bluebonnets", lib["lupine"], [drop(x, y) for x, y in lup], coll, 47, (0.9, 1.2))

    # ---------------- activity lawn (centre)
    cx, cy = 30.0, 74.0
    clear = [(18.2, 84.2, 25.5, 91.2), (36.5, 88.5, 44.5, 94.5), (27.0, 92.5, 33.0, 98.5), (15.5, 96.5, 26.5, 100),
             (39.5, 62.0, 47.0, 72.0)]

    def frame_keep(x, y):
        if V.in_poly(x, y, [(cx + 15.4 * math.cos(a), cy + 21.4 * math.sin(a)) for a in [k * 0.2 for k in range(32)]]):
            return False
        return not any(a <= x <= b and d1 <= y <= d2 for a, d1, b, d2 in clear)
    frame = [(15.8, 50.8), (47.2, 50.8), (47.2, 96.8), (15.8, 96.8)]
    sh = V.sample_poly(frame, 0.35, rnd, frame_keep, min_dist=1.3)
    V.scatter("RY_FrameShrubs", lib["shrub"], [drop(x, y) for x, y in sh], coll, 50, (0.55, 0.85))
    _drifts("RY_Frame", frame, [("salvia", 0.6), ("cone", 0.7), ("rudbeckia", 0.6), ("catmint", 0.7), ("muhly", 0.4), ("lavender", 0.5)],
            lib, bm, coll, rnd, 0.9, keep=frame_keep)
    crapes = [(17.5, 56), (16.8, 62), (17.4, 68), (16.9, 74.5), (17.6, 80)]
    V.scatter("RY_Crape", lib["crape"], [drop(x, y) + (0.27,) for x, y in crapes], coll, 51)
    V.scatter("RY_Oak", lib["oak"], [drop(43.5, 66.5) + (2.7,)], coll, 52)
    shade = [(45.5, 56.5, 1.9), (44.8, 78.5, 2.0), (17.2, 87.5, 1.7), (24.5, 94.8, 1.5), (46.0, 90.0, 1.8), (35.2, 96.4, 1.4)]
    V.scatter("RY_Shade", lib["shade"], [drop(x, y) + (s,) for x, y, s in shade[::2]], coll, 53)
    V.scatter("RY_Shade3", lib["shade3"], [drop(x, y) + (s,) for x, y, s in shade[1::2]], coll, 54)
    _lawn(bm, lib, coll, rnd)

    # ---------------- shoreline, meadow, boundary woods, far shore
    fir_s = _height_scale(lib["fir"], 1.0)
    cyp = [(38.5, S - 1.4, 9.0), (3.0, S - 1.6, 8.0), (11.0, S - 1.5, 9.5), (56.0, S - 1.5, 8.5), (79.0, S - 1.4, 9.0)]
    V.scatter("RY_Cypress", lib["fir"], [drop(x, y) + (fir_s * h,) for x, y, h in cyp], coll, 60)
    sw = V.sample_poly([(0, S - 2.4), (82, S - 2.4), (82, S - 0.5), (0, S - 0.5)], 1.2, rnd,
                       lambda x, y: not (15 < x < 33 or 35.5 < x < 51), min_dist=0.9)
    V.scatter("RY_Switch", lib["switch"], [drop(x, y) for x, y in sw], coll, 61, (0.8, 1.2))
    meadow = [(52.2, 66.2), (81.3, 66.2), (81.3, S - 2.5), (52.2, S - 2.5)]
    mf = V.sample_poly(meadow, 4.0, rnd)
    third = len(mf) // 4
    V.scatter("RY_MeadowY", lib["yellow"], [drop(x, y) for x, y in mf[:third]], coll, 62, (2.0, 3.0))
    V.scatter("RY_MeadowO", lib["gaillardia"], [drop(x, y) for x, y in mf[third:2 * third]], coll, 63, (0.8, 1.1))
    V.scatter("RY_MeadowB", lib["lupine"], [drop(x, y) for x, y in mf[2 * third:3 * third]], coll, 64, (0.9, 1.2))
    V.scatter("RY_MeadowG", lib["tufts"], [drop(x, y) for x, y in mf[3 * third:]], coll, 65, (0.8, 1.4))
    mt = [(54.6, y, 1.5) for y in (70, 77, 84, 91)] + [(79.4, y + 3, 1.6) for y in (70, 77, 84, 91)] + [(57.5, 96.5, 1.2), (77.0, 70.0, 1.3)]
    V.scatter("RY_MeadowTrees", lib["shade3"], [drop(x, y) + (s,) for x, y, s in mt], coll, 66)
    wb = [(-2.5 + rnd.uniform(-1, 1), y, rnd.uniform(1.5, 2.1)) for y in range(2, int(S) - 2, 4)]
    V.scatter("RY_WestWood", lib["shade"], [drop(x, y) + (s,) for x, y, s in wb[::2]], coll, 67)
    V.scatter("RY_WestWood3", lib["shade3"], [drop(x, y) + (s,) for x, y, s in wb[1::2]], coll, 68)
    sc = [(x + (1.5 if yy == 8 else 0) + rnd.uniform(-0.5, 0.5), yy, rnd.uniform(1.2, 1.6)) for x in range(52, 81, 3) for yy in (4, 8, 12)]
    sc += [(80.8, y, rnd.uniform(1.2, 1.5)) for y in range(18, 34, 3)]
    V.scatter("RY_EastScreen", lib["shade"], [drop(x, y) + (s,) for x, y, s in sc[::2]], coll, 69)
    V.scatter("RY_EastScreen3", lib["shade3"], [drop(x, y) + (s,) for x, y, s in sc[1::2]], coll, 70)
    far = [(-420 + i * 7.0 + rnd.uniform(-3, 3), 545 + rnd.uniform(0, 45), bm.LAKE + rnd.uniform(1, 6), fir_s * rnd.uniform(14, 24))
           for i in range(130)]
    V.scatter("RY_FarShore", lib["fir"], far, coll, 71)


def _drifts(name, poly, mix, lib, bm, coll, rnd, density, keep=lambda x, y: True):
    """Plant a bed in naturalistic drifts: clusters of one species, mixed along the bed."""
    g = bm.ground
    xs, ys = [p[0] for p in poly], [p[1] for p in poly]
    area = (max(xs) - min(xs)) * (max(ys) - min(ys))
    weights = [w for _, w in mix]
    by = {k: [] for k, _ in mix}
    taken = []
    for _ in range(int(area * density / 3)):
        k = rnd.choices([k for k, _ in mix], weights)[0]
        c = (rnd.uniform(min(xs), max(xs)), rnd.uniform(min(ys), max(ys)))
        for _ in range(rnd.randint(3, 7)):
            x, y = c[0] + rnd.gauss(0, 0.55), c[1] + rnd.gauss(0, 0.55)
            if not V.in_poly(x, y, poly) or not keep(x, y):
                continue
            if any((x - a) ** 2 + (y - b) ** 2 < 0.16 for a, b in taken[-60:]):
                continue
            taken.append((x, y))
            by[k].append((x, y, g(x, y)))
    for i, (k, pts) in enumerate(by.items()):
        V.scatter(f"{name}_{k}", lib[k], pts, coll, 200 + i, (0.85, 1.15))


def _hedges(bm, lib, coll, rnd, pattern):
    rx = re.compile(pattern)
    pts = []
    for o in list(bpy.data.objects):
        if rx.match(o.name) and o.type == "MESH":
            o.data.materials.clear()
            o.data.materials.append(V._mat("HedgeCore", "#1f3a16", 0.9, var=0.1))
            pts += FY.sample_surface(o, 170, rnd, inset=0.09)
    V.scatter("RY_Hedges", lib["leafy"], pts, coll, 5, (0.75, 1.0), tilt=3.1)


def _wisteria(bm, coll, rnd):
    """Leafy canopy over the pergola beams with hanging violet racemes."""
    import bmesh
    from mathutils import Vector
    g = bm.ground
    z = g(7.5, 43) + 2.95
    leaf = V._mat("WisteriaLeaf", "#5d8a3c", 0.6, sss=0.2, var=0.2)
    fl = V._mat("WisteriaBloom", "#a28ad8", 0.5, sss=0.4, var=0.15)
    b = bmesh.new()
    for k in range(900):
        x, y = rnd.uniform(0.8, 14.2), rnd.uniform(41.2, 44.8)
        lf = bmesh.ops.create_icosphere(b, subdivisions=1, radius=rnd.uniform(0.05, 0.09))
        bmesh.ops.scale(b, vec=(1, 0.5, 0.2), verts=lf["verts"])
        bmesh.ops.translate(b, vec=(x, y, z + rnd.uniform(0.0, 0.25)), verts=lf["verts"])
    for k in range(260):
        x, y = rnd.uniform(0.9, 14.1), rnd.uniform(41.3, 44.7)
        L = rnd.uniform(0.25, 0.5)
        for i in range(9):
            t = i / 8
            r = 0.035 * (1 - 0.6 * t)
            s = bmesh.ops.create_icosphere(b, subdivisions=1, radius=r)
            bmesh.ops.translate(b, vec=(x + rnd.uniform(-.01, .01), y + rnd.uniform(-.01, .01), z - L * t), verts=s["verts"])
            for f in {f for v in s["verts"] for f in v.link_faces}:
                f.material_index = 1
    o = V._mesh_obj("RY_Wisteria", b, [leaf, fl])
    coll.objects.link(o)


def _lawn(bm, lib, coll, rnd):
    g = bm.ground
    cams = [(31.5, 98.6), (19.5, 37.6)]                    # lawn view, pool view

    def keep(x, y):
        if not V.in_poly(x, y, [(30 + 13.4 * math.cos(a), 74 + 19.4 * math.sin(a)) for a in [k * 0.2 for k in range(32)]]):
            return False
        return True
    region = [(16.6, 54.6), (43.4, 54.6), (43.4, 93.4), (16.6, 93.4)]
    near = lambda x, y: keep(x, y) and min(math.hypot(x - a, y - b) for a, b in cams) < 22
    far = lambda x, y: keep(x, y) and min(math.hypot(x - a, y - b) for a, b in cams) >= 22
    pts = V.sample_poly(region, 700.0, rnd, near) + V.sample_poly(region, 240.0, rnd, far)
    V.scatter("RY_Lawn", lib["lawn"], [(x, y, g(x, y) - 0.01) for x, y in pts], coll, 80, (1.1, 1.6), tilt=0.25)
