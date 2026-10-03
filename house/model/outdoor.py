"""Outdoor living and the 'toys': pool water and tile, deck loungers and umbrellas, covered-patio
living/dining/kitchen, bar-house fit-out, boathouse finishes, yacht and helicopter materials, and
the dusk landscape lighting (path lights, pool lights, string lights, dock lights)."""
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


def pool_water(name="PoolWaterReal"):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    p = nt.nodes.new("ShaderNodeBsdfPrincipled")
    p.inputs["Base Color"].default_value = (0.75, 0.95, 0.95, 1)
    p.inputs["Roughness"].default_value = 0.02
    p.inputs["IOR"].default_value = 1.333
    p.inputs["Transmission Weight"].default_value = 1.0
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 1.6
    nz.inputs["Detail"].default_value = 6.0
    nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.08
    nt.links.new(nz.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], p.inputs["Normal"])
    vol = nt.nodes.new("ShaderNodeVolumeAbsorption")
    vol.inputs["Color"].default_value = (0.62, 0.92, 0.92, 1)
    vol.inputs["Density"].default_value = 0.18
    nt.links.new(p.outputs[0], out.inputs["Surface"])
    nt.links.new(vol.outputs[0], out.inputs["Volume"])
    return m


def pool_tile(name="PoolTile"):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    br = nt.nodes.new("ShaderNodeTexBrick")
    br.inputs["Scale"].default_value = 1.0
    br.inputs["Brick Width"].default_value = 0.025
    br.inputs["Row Height"].default_value = 0.025
    br.inputs["Mortar Size"].default_value = 0.002
    br.offset = 0.0
    br.inputs["Color1"].default_value = (0.20, 0.55, 0.62, 1)
    br.inputs["Color2"].default_value = (0.32, 0.68, 0.72, 1)
    br.inputs["Mortar"].default_value = (0.85, 0.88, 0.86, 1)
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    comb = nt.nodes.new("ShaderNodeCombineXYZ")
    nt.links.new(geo.outputs["Position"], sep.inputs[0])
    add = nt.nodes.new("ShaderNodeMath")
    add.operation = "ADD"
    nt.links.new(sep.outputs["X"], add.inputs[0])
    nt.links.new(sep.outputs["Y"], add.inputs[1])
    nt.links.new(add.outputs[0], comb.inputs["X"])
    nt.links.new(sep.outputs["Z"], comb.inputs["Y"])
    nt.links.new(comb.outputs[0], br.inputs["Vector"])
    nt.links.new(br.outputs["Color"], p.inputs["Base Color"])
    p.inputs["Roughness"].default_value = 0.15
    return m


# ---------------------------------------------------------------- furniture builders
def chaise(name, x, y, z, rot):
    frame = _m("PowderBronze", "#3a3632", 0.4, 0.6)
    cush = _m("OutdoorCushion", "#efe9dd", 0.85)
    objs = [I.box(name + "_frame", -0.33, 0.33, -1.0, 1.0, 0.22, 0.27, frame, 0.01),
            I.box(name + "_cush", -0.31, 0.31, -0.98, 0.35, 0.27, 0.36, cush, 0.04)]
    back = I.box(name + "_back", -0.31, 0.31, 0.0, 0.75, 0.0, 0.09, cush, 0.04)
    back.data.transform(Matrix.Rotation(math.radians(48), 4, "X"))
    back.data.transform(Matrix.Translation((0, 0.35, 0.32)))
    objs.append(back)
    for lx in (-0.3, 0.3):
        for ly in (-0.9, 0.85):
            objs.append(I.box(f"{name}_leg{lx}{ly}", lx - 0.02, lx + 0.02, ly - 0.02, ly + 0.02, 0.0, 0.22, frame))
    for o in objs:
        o.data.transform(Matrix.Rotation(math.radians(rot), 4, "Z"))
        o.location = (x, y, z)


def umbrella(name, x, y, z, r=1.4, h=2.5, fabric="#f2ede3"):
    I.cyl(name + "_pole", x, y, z, z + h, 0.025, _m("PowderBronze", "#3a3632", 0.4, 0.6), 12)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=False, segments=8, radius1=r, radius2=0.05, depth=0.45)
    bmesh.ops.translate(bm, vec=(x, y, z + h - 0.2), verts=bm.verts[:])
    me = bpy.data.meshes.new(name + "_canopy")
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name + "_canopy", me)
    o.data.materials.append(_m("UmbrellaFabric_" + fabric, fabric, 0.85, sss=0.3))
    s = o.modifiers.new("t", "SOLIDIFY")
    s.thickness = 0.01
    COLL.objects.link(o)
    I.cyl(name + "_base", x, y, z, z + 0.12, 0.28, _m("UmbrellaBase", "#2a2a2a", 0.5), 16)


def bottles(name, x1, x2, y, z, face, n=24, seed=3):
    rnd = random.Random(seed)
    cols = ["#2f5a2a", "#6b3f1e", "#d8c9a0", "#3a2a5a", "#9a4a1a", "#e8e2d0"]
    for k in range(n):
        x = x1 + (x2 - x1) * (k + 0.5) / n
        c = rnd.choice(cols)
        h = rnd.uniform(0.25, 0.34)
        I.cyl(f"{name}{k}", x, y, z, z + h, 0.035, _m("Bottle_" + c, c, 0.05, transmission=0.85), 12)


def string_lights(name, p0, p1, z0, sag=0.35, n=24):
    bulb = _m("Bulb", "#fff1d6", 0.3, emit=((1.0, 0.75, 0.45), 30.0))
    wire = _m("Wire", "#111111", 0.6)
    (x0, y0), (x1, y1) = p0, p1
    pts = []
    for k in range(n + 1):
        t = k / n
        pts.append(Vector((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z0 - sag * 4 * t * (1 - t))))
    curve = bpy.data.curves.new(name + "_wire", "CURVE")
    curve.dimensions = "3D"
    sp = curve.splines.new("POLY")
    sp.points.add(len(pts) - 1)
    for k, p in enumerate(pts):
        sp.points[k].co = (*p, 1)
    curve.bevel_depth = 0.004
    o = bpy.data.objects.new(name + "_wire", curve)
    o.data.materials.append(wire)
    COLL.objects.link(o)
    for k, p in enumerate(pts[1:-1]):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=6, radius=0.03, location=(p.x, p.y, p.z - 0.05))
        b = bpy.context.active_object
        b.name = f"{name}_b{k}"
        b.data.materials.append(bulb)
        for c in b.users_collection:
            c.objects.unlink(b)
        COLL.objects.link(b)


def path_light(name, x, y, z, energy=10):
    body = _m("PathLightBronze", "#2c2620", 0.45, 0.5)
    I.cyl(name + "_post", x, y, z, z + 0.5, 0.035, body, 10)
    I.cyl(name + "_cap", x, y, z + 0.5, z + 0.53, 0.09, body, 16)
    I.cyl(name + "_lens", x, y, z + 0.44, z + 0.5, 0.05, _m("PathLens", "#fff4dc", 0.3, emit=((1.0, 0.72, 0.42), 12.0)), 12)
    L = I.point_light(name + "_L", (x, y, z + 0.42), energy, 0.03)
    L["dusk_only"] = 1


# ---------------------------------------------------------------- build
def build(bm, materials, coll):
    global COLL, M
    COLL, M = coll, materials
    I.COLL, I.M = coll, materials
    g = bm.ground

    # pool: real water, mosaic tile shell (transferred onto the boolean faces of the deck)
    water = pool_water()
    for nm in ("PoolWater", "SwimUpWater", "SpaWater", "FountainWater"):
        o = bpy.data.objects.get(nm)
        if o:
            o.data.materials.clear()
            o.data.materials.append(water)
    tile = pool_tile()
    deck = bpy.data.objects.get("Deck")
    if deck:
        for mod in deck.modifiers:
            if mod.type == "BOOLEAN" and mod.object:
                mod.material_mode = "TRANSFER"
                cut = mod.object
                cut.data.materials.clear()
                cut.data.materials.append(tile if "Lounge" not in cut.name else M["plaster_int"])
    spa = bpy.data.objects.get("Spa")
    if spa:                                              # hollow the spa shell: tiled basin, water below the rim
        sc = bm.cylinder("SpaCut", 14.4, 43, 0.0, 0.7, 1.07, "pool", COLL, 48)
        sc.data.materials.clear()
        sc.data.materials.append(tile)
        md = spa.modifiers.new("basin", "BOOLEAN")
        md.operation, md.solver, md.object, md.material_mode = "DIFFERENCE", "EXACT", sc, "TRANSFER"
        sc.hide_render = sc.hide_viewport = True
        spa.data.materials.clear()
        spa.data.materials.append(M["limestone_paver"] if "limestone_paver" in M else M["paver"])
        Ls = I.point_light("SpaLight", (14.4, 43, 0.15), 25, 0.1, (0.75, 0.95, 1.0))
        Ls["dusk_only"] = 1
    for k in range(3):                                   # underwater lights
        L = I.point_light(f"PoolLight{k}", (17.5 + k * 4.5, 41.5, -1.2), 60, 0.1, (0.75, 0.95, 1.0))
        L["dusk_only"] = 1

    # deck loungers + umbrellas (north side of the pool faces the lake)
    for k, x in enumerate((17.0, 19.3, 21.6, 23.9)):
        chaise(f"Chaise{k}", x, 39.2, 0.0, 180)
    umbrella("Umbrella1", 20.45, 38.4, 0.0)
    umbrella("Umbrella2", 25.2, 38.4, 0.0)
    for k, x in enumerate((13.8, 15.0)):
        chaise(f"ChaiseW{k}", x, 37.0, 0.0, 180)

    # covered patio: sofa group at the outdoor fireplace, dining table, kitchen
    P.place("sofa_03", (18.4, 31.2, 0.0), 90, coll=coll, name="PatioSofa")
    P.place("modern_arm_chair_01", (19.6, 29.8, 0.0), 160, coll=coll, name="PatioChair1")
    P.place("modern_arm_chair_01", (19.6, 32.6, 0.0), 20, coll=coll, name="PatioChair2")
    P.place("coffee_table_round_01", (17.6, 31.2, 0.0), 0, 0.8, coll=coll, name="PatioTable")
    teak = _m("Teak", "#8a6a48", 0.55)
    I.box("PatioDiningTop", 22.0, 24.6, 30.5, 31.6, 0.74, 0.79, teak, 0.01)
    for x in (22.2, 24.4):
        I.box(f"PatioDiningLeg{x}", x - 0.05, x + 0.05, 30.6, 31.5, 0.0, 0.74, teak)
    for k, x in enumerate((22.6, 23.3, 24.0)):
        P.place("dining_chair_02", (x, 30.1, 0.0), 0, coll=coll, name=f"PDChairS{k}")
        P.place("dining_chair_02", (x, 32.0, 0.0), 180, coll=coll, name=f"PDChairN{k}")
    stone = M["stone"]
    I.box("OutdoorKitchen", 26.0, 28.9, 29.15, 29.85, 0.0, 0.92, stone)
    I.box("OutdoorKitchenTop", 25.95, 28.95, 29.1, 29.9, 0.92, 0.96, _m("Granite", "#3a3836", 0.25))
    I.box("Grill", 26.6, 27.6, 29.2, 29.85, 0.96, 1.25, _m("Stainless", "#b8bcc0", 0.25, 1.0), 0.02)
    for k, x in enumerate((17.0, 21.0, 25.0, 28.0)):
        I.point_light(f"PatioCan{k}", (x, 31.2, 3.4), 40, 0.05)["dusk_only"] = 1

    # bar house fit-out: counter top, back bar with bottles, stools, pendants
    I.box("BarCounterTop", 29.55, 30.45, 41.1, 44.9, 1.05, 1.1, _m("Granite", "#3a3836", 0.25))
    I.box("BarBackShelf", 31.7, 32.1, 41.0, 45.0, 0.9, 2.4, _m("WalnutFurniture", "#4a3526", 0.4))
    rnd = random.Random(9)
    cols = ["#2f5a2a", "#6b3f1e", "#d8c9a0", "#3a2a5a", "#9a4a1a", "#e8e2d0"]
    for k, z in enumerate((1.25, 1.75, 2.1)):
        y = 41.15
        while y < 44.85:
            c = rnd.choice(cols)
            I.cyl(f"Bottle{k}_{y:.2f}", 31.9, y, z, z + rnd.uniform(0.22, 0.32), 0.035,
                  _m("Bottle_" + c, c, 0.05, transmission=0.85), 12)
            y += rnd.uniform(0.09, 0.14)
        I.box(f"BarShelfBoard{k}", 31.7, 32.1, 41.0, 45.0, z - 0.03, z, _m("WalnutFurniture", "#4a3526", 0.4))
    for k, y in enumerate((41.8, 43.0, 44.2)):
        P.place("bar_chair_round_01", (32.75, y, 0.0), 270, coll=coll, name=f"BarStool{k}")
        I.cyl(f"BarPendant{k}", 30.0, y, 2.6, 2.85, 0.12, _m("PendantGlass", "#f6e7c8", 0.2, emit=((1.0, 0.7, 0.4), 6.0)), 16)
        I.point_light(f"BarPendantL{k}", (30.0, y, 2.55), 35, 0.08)["dusk_only"] = 1

    # boathouse finishes: white posts, timber decks; yacht materials and rails
    deckwood = _m("DockDecking", "#8c7358", 0.7)
    for o in bpy.data.objects:
        if o.name.startswith(("BH_Walk", "BH_Link", "BH_UpperFloor", "BH_Stair", "Pier", "PierT")):
            o.data.materials.clear()
            o.data.materials.append(deckwood)
        elif o.name.startswith(("BH_UpPost", "BH_Pile")):
            o.data.materials.clear()
            o.data.materials.append(_m("DockWhite", "#efeee9", 0.5))
    gel = _m("Gelcoat", "#f7f7f5", 0.08)
    gel.node_tree.nodes["Principled BSDF"].inputs["Coat Weight"].default_value = 1.0
    hull = bpy.data.objects.get("Yacht_Hull")
    if hull:
        hull.data.materials.clear()
        hull.data.materials.append(gel)
        sub = hull.modifiers.new("smooth", "SUBSURF")
        sub.levels = sub.render_levels = 2
        for p in hull.data.polygons:
            p.use_smooth = True
        loc = hull.location
        I.box("Yacht_TeakDeck", -1.35, 1.35, -5.3, -2.6, 0.97, 1.0, teak).location = loc
        cab = bpy.data.objects.get("Yacht_Cabin")
        if cab:
            cab.data.materials.clear()
            cab.data.materials.append(gel)

    # helicopter: two-tone paint (cream with a dark-bronze stripe), metallic flake
    paint = _m("HeliPaint", "#efe6d3", 0.22, 0.25)
    paint.node_tree.nodes["Principled BSDF"].inputs["Coat Weight"].default_value = 1.0
    for o in bpy.data.objects:
        if o.name.startswith(("Heli_Cabin", "Heli_Engine", "Heli_Boom", "Heli_Fin", "Heli_Stab")):
            o.data.materials.clear()
            o.data.materials.append(paint)
            sub = o.modifiers.new("smooth", "SUBSURF")
            sub.levels = sub.render_levels = 1

    # dusk landscape lighting
    walk = bm.bezier((17, -0.2), (10, 4), (28, 6), (19.5, bm.Y_MAIN - 3.2), 60)
    for k, i in enumerate(range(4, 56, 7)):
        x, y = walk[i]
        for s in (-1, 1):
            q0, q1 = walk[i - 1], walk[i + 1]
            t = Vector((q1[0] - q0[0], q1[1] - q0[1])).normalized()
            px, py = x - t.y * 1.45 * s, y + t.x * 1.45 * s
            path_light(f"PathLight{k}{s}", px, py, g(px, py))
    for k, (x, y) in enumerate([(5.5, 47), (5.5, 53), (5.5, 59), (9.5, 47), (9.5, 53), (9.5, 59)]):
        path_light(f"GardenLight{k}", x, y, g(x, y), 6)
    for k, y in enumerate((bm.SHORE + 1, bm.SHORE + 4, bm.SHORE + 7, bm.SHORE + 9.5)):
        path_light(f"DockLight{k}", 22.6, y, -4.1, 8)
    string_lights("BBQLights", (36.8, 88.8), (44.2, 94.2), g(40.5, 91.5) + 2.95)
    string_lights("BBQLights2", (44.2, 88.8), (36.8, 94.2), g(40.5, 91.5) + 2.95)
    for x, y in ((43.5, 66.5),):
        L = bpy.data.lights.new("OakUplight", "SPOT")
        L.energy, L.color, L.spot_size = 300, (1.0, 0.8, 0.55), math.radians(70)
        o = bpy.data.objects.new("OakUplight", L)
        o.location = (x + 2.5, y - 2.5, g(x, y) + 0.2)
        o.rotation_euler = (math.radians(-25), math.radians(-25), 0)
        o["dusk_only"] = 1
        coll.objects.link(o)
