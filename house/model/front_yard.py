"""Front yard planting after the reference image: curved boxwood hedges along the exposed-aggregate
walk, agave + ornamental grass beds, conical evergreens at the porch, foundation shrubs, a real
grass lawn and two live oaks framing the house."""
import bisect
import math
import random
import re

import bmesh
import bpy


import vegetation as V

WALK = None   # filled from the massing walkway bezier

WEST_BED = [(8.2, 10.15), (18.3, 10.15), (18.3, 8.6), (17.4, 6.6), (15.8, 5.0), (13.6, 4.4), (10.5, 4.2), (8.2, 4.6)]
EAST_BED = [(22.05, 10.35), (28.45, 10.35), (28.45, 8.85), (34.2, 8.85), (34.2, 7.0), (25.0, 6.9), (22.6, 7.6)]


def _clear_placeholders():
    pat = re.compile(r"^(Agave\d+|Evergreen\d+|FrontBed\d?|Shrub\d+|OakFront\d_(trunk|crown))$")
    for o in list(bpy.data.objects):
        if pat.match(o.name):
            bpy.data.objects.remove(o, do_unlink=True)


def _bed_mesh(name, poly, ground, mat, coll):
    bmm = bmesh.new()
    vs = [bmm.verts.new((x, y, ground(x, y) + 0.035)) for x, y in poly]
    f = bmm.faces.new(vs)
    bmesh.ops.triangulate(bmm, faces=[f])
    # subdivide so the bed follows the grade
    bmesh.ops.subdivide_edges(bmm, edges=bmm.edges[:], cuts=3, use_grid_fill=True)
    for v in bmm.verts:
        v.co.z = ground(v.co.x, v.co.y) + 0.035
    me = bpy.data.meshes.new(name)
    bmm.to_mesh(me)
    bmm.free()
    o = bpy.data.objects.new(name, me)
    o.data.materials.append(mat)
    coll.objects.link(o)
    return o


def sample_surface(obj, density, rnd, inset=0.0):
    dg = bpy.context.evaluated_depsgraph_get()
    eo = obj.evaluated_get(dg)
    me = eo.to_mesh()
    me.calc_loop_triangles()
    mw = obj.matrix_world
    tris = [(t.area, [mw @ me.vertices[i].co for i in t.vertices], t.normal.copy()) for t in me.loop_triangles]
    cum, tot = [], 0.0
    for a, _, _ in tris:
        tot += a
        cum.append(tot)
    pts = []
    for _ in range(int(tot * density)):
        k = bisect.bisect(cum, rnd.uniform(0, tot))
        k = min(k, len(tris) - 1)
        _, (a, b, c), n = tris[k]
        u, v = rnd.random(), rnd.random()
        if u + v > 1:
            u, v = 1 - u, 1 - v
        p = a + (b - a) * u + (c - a) * v - n * inset
        pts.append((p.x, p.y, p.z))
    eo.to_mesh_clear()
    return pts


def build(bm, M, coll):
    """bm = running build_massing module; M = material table; coll = target collection."""
    g = bm.ground
    rnd = random.Random(42)
    walk = bm.bezier((17, -0.2), (10, 4), (28, 6), (19.5, bm.Y_MAIN - 3.2), 60)
    _clear_placeholders()

    # ---------------- beds
    for name, poly in (("BedWest", WEST_BED), ("BedEast", EAST_BED)):
        _bed_mesh(name, poly, g, M["mulch"], coll)

    def in_beds(x, y):
        return V.in_poly(x, y, WEST_BED) or V.in_poly(x, y, EAST_BED)

    def bed_keep(x, y):
        return V.dist_to_polyline(x, y, walk) > 2.25

    # ---------------- libraries
    agaves = V.proto_collection("agave", [V.agave(f"AgaveProto{i}", 11 + i, radius=r)
                                          for i, r in enumerate((0.72, 0.62, 0.8))])
    muhly = V.proto_collection("muhly", [V.grass_clump(f"MuhlyProto{i}", 21 + i, 0.85, 240, 0.35, "#9aa57c", "#d9a0c4")
                                         for i in range(2)])
    feather = V.proto_collection("feather", [V.grass_clump(f"FeatherProto{i}", 31 + i, 0.55, 300, 0.5, "#cfc48e", None, width=0.004)
                                             for i in range(2)])
    fir = V.load("fir_tree_01", lambda n: re.fullmatch(r"fir_tree_01_[abc]_LOD1", n) is not None, "fir")
    shrub = V.load("shrub_02", lambda n: n.endswith("_LOD1"), "shrub02")
    leafy = V.load("shrub_04", lambda n: n.endswith("_LOD1"), "shrub04")
    peri = V.load("periwinkle_plant", lambda n: n.endswith("_LOD1"), "periwinkle")
    yellow = V.load("flower_empodium", lambda n: n.endswith("_LOD1"), "empodium")
    oak = V.load("island_tree_01", lambda n: n == "island_tree_01_LOD0", "oak1")
    oak2 = V.load("island_tree_02", lambda n: n == "island_tree_02_LOD0", "oak2")
    magnolia = V.load("tree_small_02", lambda n: n in ("tree_small_02_LOD1", "tree_small_02_trunk"), "magnolia")
    lawn = V.load("grass_bermuda_01", lambda n: re.fullmatch(r"grass_bermuda_01_(medium|small)_[a-f]", n) is not None, "bermuda")
    tufts = V.load("grass_medium_02", lambda n: re.fullmatch(r"grass_medium_02_[a-e]", n) is not None, "tufts")

    # ---------------- agaves and grasses in the beds
    ag_w = V.sample_poly(WEST_BED, 3.0, rnd, lambda x, y: bed_keep(x, y) and y < 9.4, min_dist=1.45)[:9]
    ag_e = V.sample_poly(EAST_BED, 3.0, rnd, lambda x, y: bed_keep(x, y) and y < 8.6, min_dist=1.5)[:4]
    V.scatter("FY_Agave", agaves, [(x, y, g(x, y) + 0.02) for x, y in ag_w + ag_e], coll, 3, (0.85, 1.15))
    taken = ag_w + ag_e

    def free(x, y, r):
        return all((x - a) ** 2 + (y - b) ** 2 > r * r for a, b in taken)
    mu = V.sample_poly(WEST_BED, 3.0, rnd, lambda x, y: bed_keep(x, y) and free(x, y, 0.9), min_dist=1.1)[:8]
    mu += V.sample_poly(EAST_BED, 3.0, rnd, lambda x, y: bed_keep(x, y) and free(x, y, 0.9), min_dist=1.1)[:9]
    V.scatter("FY_Muhly", muhly, [(x, y, g(x, y)) for x, y in mu], coll, 4, (0.8, 1.1))
    taken += mu
    fe = V.sample_poly(WEST_BED, 6.0, rnd, lambda x, y: bed_keep(x, y) and free(x, y, 0.6), min_dist=0.7)[:14]
    fe += V.sample_poly(EAST_BED, 6.0, rnd, lambda x, y: bed_keep(x, y) and free(x, y, 0.6), min_dist=0.7)[:10]
    V.scatter("FY_Feather", feather, [(x, y, g(x, y)) for x, y in fe], coll, 5, (0.8, 1.2))
    taken += fe
    fl = V.sample_poly(WEST_BED, 14.0, rnd, lambda x, y: bed_keep(x, y) and free(x, y, 0.45), min_dist=0.3)[:70]
    fl += V.sample_poly(EAST_BED, 14.0, rnd, lambda x, y: bed_keep(x, y) and free(x, y, 0.45), min_dist=0.3)[:60]
    half = len(fl) // 2
    V.scatter("FY_Periwinkle", peri, [(x, y, g(x, y)) for x, y in fl[:half]], coll, 6, (2.0, 3.0))
    V.scatter("FY_Yellow", yellow, [(x, y, g(x, y)) for x, y in fl[half:]], coll, 7, (2.0, 3.0))

    # ---------------- conical evergreens at the porch and wing corners, foundation shrubs
    cones = [(9.9, 9.55, 3.6), (13.8, 9.6, 4.1), (17.3, 9.45, 3.8), (22.75, 9.75, 4.3), (29.0, 8.3, 4.0), (33.7, 8.3, 3.5)]
    cone_pts = []
    for i, (x, y, h) in enumerate(cones):
        core = V.cone_core(f"FY_ConeCore{i}", x, y, g(x, y), h * 0.2, h, coll)
        cone_pts += sample_surface(core, 150, rnd, inset=0.05)
    V.scatter("FY_Cones", leafy, cone_pts, coll, 8, (1.0, 1.35), tilt=3.1)
    found = [(x, 9.75) for x in (8.9, 11.6, 15.6, 18.0)] + [(x, 9.95) for x in (24.0, 25.9, 27.6)] + [(x, 8.45) for x in (30.6, 32.4)]
    V.scatter("FY_Foundation", shrub, [(x, y, g(x, y)) for x, y in found], coll, 9, (0.5, 0.65))

    # ---------------- boxwood hedges: leaf clusters over the hedge cores from the detail pass
    for nm in ("Boxwood1", "Boxwood-1"):
        core = bpy.data.objects.get(nm)
        if core is None:
            continue
        core.data.materials.clear()
        core.data.materials.append(V._mat("HedgeCore", "#1f3a16", 0.9, var=0.1))
        pts = sample_surface(core, 190, rnd, inset=0.1)
        V.scatter(f"FY_Hedge{nm[-2:]}", leafy, pts, coll, 10, (0.75, 1.0), tilt=3.1)

    # ---------------- trees framing the house
    V.scatter("FY_Oaks", oak, [(37.5, 5.0, g(37.5, 5.0), 2.5)], coll, 11)
    V.scatter("FY_Oaks2", oak2, [(-6.0, 2.0, g(-6.0, 2.0), 2.8)], coll, 12)
    V.scatter("FY_Magnolia", magnolia, [(5.6, 11.2, g(5.6, 11.2), 1.3), (37.2, 11.5, g(37.2, 11.5), 1.2)], coll, 13)

    # ---------------- lawn: grass instances where the camera can see them, textured ground beyond
    house_front = lambda x, y: (8.0 <= x <= 22.0 and y > 10.1) or (22.0 < x <= 28.5 and y > 10.3) or (28.5 < x <= 34.4 and y > 8.8)

    def lawn_keep(x, y):
        if in_beds(x, y) or house_front(x, y):
            return False
        if 44.6 < x < 49.4 and y < 17.5:                       # driveway
            return False
        if x < 8.0 and y > 12.6:                               # garden side path
            return False
        if V.dist_to_polyline(x, y, walk) < 1.48:              # walk + curbs
            return False
        return math.hypot(x - 22.0, y + 2.5) < 34.0            # within useful range of the front camera
    region = [(-8, -0.3), (44.6, -0.3), (44.6, 19.0), (-8, 19.0)]
    near = lambda x, y: lawn_keep(x, y) and math.hypot(x - 22.0, y + 2.5) < 16.0
    far = lambda x, y: lawn_keep(x, y) and math.hypot(x - 22.0, y + 2.5) >= 16.0
    blades = V.sample_poly(region, 900.0, rnd, near) + V.sample_poly(region, 330.0, rnd, far)
    for m in V.coll_materials(lawn) + V.coll_materials(tufts):
        V.tweak_material(m, 0.53, 1.6, 3.3)          # lush, sunlit St. Augustine green
    V.scatter("FY_Lawn", lawn, [(x, y, g(x, y) - 0.01) for x, y in blades], coll, 14, (1.1, 1.6), tilt=0.25)
    tu = V.sample_poly(region, 4.0, rnd, lawn_keep)
    V.scatter("FY_LawnTufts", tufts, [(x, y, g(x, y) - 0.02) for x, y in tu], coll, 15, (0.5, 0.8), tilt=0.2)
