"""Lived-in interiors (style 5, deep-green velvet): every room furnished the way people actually use it.

Game room (85" TV, PS5 Pro, Xbox Series X, Switch, controllers, arcade cabinets, pool table with balls,
bar fridge, popcorn), gym (functional trainer, rower, spin bikes, kettlebells, plates, plyo boxes, mats,
cold plunge, towels), bedrooms with layered bedding, dressers, TVs, desks, a teen gamer room, en-suite
bathrooms (vanities, toilets, glass showers, tub), walk-in closet, kitchen and dining styling.

All pieces are built in a local frame whose +y faces into the room; `wall(x, y, side)` gives the root.
"""
import math
import random

import bmesh
import bpy
from mathutils import Matrix, Vector

import assets
import house_real as H
import interiors as I
import furnish as Fu
import props as P

F1, EAVE, ZC1 = H.F1, H.EAVE, H.F1 - H.SLAB
R, root = Fu._rbox, Fu._root
COLL = None


def M(name, hexcol, rough=0.5, metal=0.0, **kw):
    return I.mat(name, hexcol, rough, metal, **kw)


def glossy(name, hexcol, rough=0.12, metal=0.0, coat=0.6):
    m = M(name, hexcol, rough, metal)
    m.node_tree.nodes["Principled BSDF"].inputs["Coat Weight"].default_value = coat
    return m


def glow(name, hexcol, strength):
    rgb = Fu._lin(hexcol)
    return M(name, hexcol, 0.4, emit=(tuple(rgb), strength))


def screen_mat(name, uv_center=(0.45, 0.52), zoom=0.18, strength=1.6):
    """A TV / monitor picture: a crop of the sky HDRI (bright, believable 'content')."""
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.remove(nt.nodes["Principled BSDF"])
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (zoom, zoom * 0.56, 1)
    mp.inputs["Location"].default_value = (uv_center[0] - zoom / 2, uv_center[1] - zoom * 0.28, 0)
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(assets.hdri("day", "1k"), check_existing=False)
    tex.image.name = name + "_img"
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Strength"].default_value = strength
    nt.links.new(tc.outputs["UV"], mp.inputs["Vector"])
    nt.links.new(mp.outputs["Vector"], tex.inputs["Vector"])
    nt.links.new(tex.outputs["Color"], em.inputs["Color"])
    nt.links.new(em.outputs["Emission"], nt.nodes["Material Output"].inputs["Surface"])
    return m


def panel(name, w, h, m, parent, y=0.0, z=0.0, x=0.0):
    """Flat UV-mapped quad in the local x-z plane facing +y (screens, art, mirrors)."""
    me = bpy.data.meshes.new(name)
    me.from_pydata([(x - w / 2, y, z), (x + w / 2, y, z), (x + w / 2, y, z + h), (x - w / 2, y, z + h)], [], [(0, 1, 2, 3)])
    uv = me.uv_layers.new()
    for i, (u, v) in enumerate(((0, 0), (1, 0), (1, 1), (0, 1))):
        uv.data[i].uv = (u, v)
    o = bpy.data.objects.new(name, me)
    o.data.materials.append(m)
    COLL.objects.link(o)
    o.parent = parent
    return o


def wall(name, x, y, z, side):
    """Root on a wall: side = which wall the object stands against ('S', 'N', 'W', 'E')."""
    rot = {"S": 0, "N": 180, "W": -90, "E": 90}[side]
    return root(name, x, y, z, rot)


def sphere(name, x, y, z, r, m, parent=None, seg=16):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=seg // 2, radius=r, matrix=Matrix.Translation((x, y, z)))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    o = bpy.data.objects.new(name, me)
    o.data.materials.append(m)
    COLL.objects.link(o)
    if parent:
        o.parent = parent
    return o


def hollow(target, cutter):
    """Boolean-subtract `cutter` from `target` (real cavities for tubs and basins); cutter is hidden."""
    md = target.modifiers.new("hollow", "BOOLEAN")
    md.operation, md.solver, md.object = "DIFFERENCE", "EXACT", cutter
    cutter.hide_render = True
    cutter.display_type = "WIRE"
    return target


def remove(prefixes):
    for o in list(bpy.data.objects):
        if o.name.startswith(prefixes):
            bpy.data.objects.remove(o, do_unlink=True)


# ---------------------------------------------------------------- shared materials
def mats():
    return dict(
        black=M("RichBlack", "#121212", 0.45), plastic_w=glossy("ConsoleWhite", "#f2f2f0", 0.25, 0, 0.3),
        plastic_b=glossy("ConsoleBlack", "#141416", 0.3, 0, 0.3), steel=M("BrushedSteel", "#b9bcc0", 0.3, 1.0),
        chrome=M("Chrome", "#d8d8d8", 0.08, 1.0), brass=M("Brass", "#b08d57", 0.3, 1.0),
        walnut=Fu.fabric("wood", "#4a3122"), oak=Fu.fabric("wood", "#b8966c"), ceramic=glossy("Porcelain", "#f6f5f1", 0.08),
        rubber=M("GymRubberBlk", "#161616", 0.8), velvet=Fu.fabric("velvet", "#22392f"), linen=Fu.fabric("linen", "#ece6da"),
        leather=Fu.fabric("leather", "#161616"), glass=bpy.data.materials.get("ArchGlass") or M("Glass2", "#dfe9ea", 0.02, transmission=1.0),
        marble=I.marble_mat(), mirror=M("Mirror", "#e8eaec", 0.02, 1.0),
    )


# ---------------------------------------------------------------- consoles & media
def tv(name, x, y, z_bottom, side, inches=85, mt=None, picture=None):
    w = inches * 0.0254 * 0.872
    h = inches * 0.0254 * 0.49
    r = wall(name, x, y, z_bottom, side)
    R(name + "_body", 0, 0.035, 0, w + 0.02, 0.05, h + 0.02, mt["black"], 0.004, r)
    scr = screen_mat(name + "_scr", picture) if picture else glossy("TVOff", "#060708", 0.04, 0.0, 1.0)
    panel(name + "_pic", w - 0.01, h - 0.01, scr, r, 0.0605, 0.005)      # bedroom TVs are switched off
    R(name + "_glow", 0, 0.004, 0.05, w * 0.9, 0.004, h * 0.85, glow("TVBacklight", "#a8c4ff", 3.0), 0.0, r)
    return r


def ps5_pro(name, x, y, z, rot, mt):
    """PS5 Pro standing vertical: white shells, black core with three bands (≈ 0.39 x 0.09 x 0.27 m)."""
    r = root(name, x, y, z, rot)
    R(name + "_stand", 0, 0, 0, 0.12, 0.12, 0.012, mt["plastic_b"], 0.004, r)
    R(name + "_core", 0, 0, 0.012, 0.06, 0.26, 0.39, mt["plastic_b"], 0.01, r)
    for s in (-1, 1):
        R(f"{name}_shell{s}", s * 0.04, 0, 0.012, 0.02, 0.27, 0.395, mt["plastic_w"], 0.012, r)
    for k, zz in enumerate((0.14, 0.2, 0.26)):
        R(f"{name}_band{k}", 0, 0.0, 0.012 + zz, 0.1, 0.275, 0.012, mt["plastic_b"], 0.003, r)
    R(name + "_led", 0, 0.131, 0.36, 0.05, 0.002, 0.005, glow("PSBlueLED", "#5aa0ff", 8.0), 0.0, r)
    return r


def xbox(name, x, y, z, rot, mt):
    r = root(name, x, y, z, rot)
    R(name + "_body", 0, 0, 0, 0.151, 0.151, 0.301, mt["plastic_b"], 0.006, r)
    Fu._cyl(name + "_vent", 0, 0, 0.301, 0.304, 0.06, M("XboxVentGreen", "#1d3a22", 0.4), r, 32)
    R(name + "_logo", -0.05, 0.0756, 0.25, 0.012, 0.001, 0.012, glow("XboxLED", "#f4f4f4", 6.0), 0.0, r)
    return r


def switch(name, x, y, z, rot, mt):
    r = root(name, x, y, z, rot)
    R(name + "_dock", 0, 0, 0, 0.173, 0.054, 0.104, mt["plastic_b"], 0.008, r)
    R(name + "_screen", 0, 0.034, 0.025, 0.152, 0.014, 0.09, mt["plastic_b"], 0.004, r)
    panel(name + "_disp", 0.135, 0.075, screen_mat("SwitchScreen", (0.62, 0.5), 0.12, 1.2), r, 0.0415, 0.033)
    R(name + "_jcL", -0.095, 0.034, 0.025, 0.035, 0.014, 0.1, glossy("JoyconRed", "#e3373e", 0.3), 0.012, r)
    R(name + "_jcR", 0.095, 0.034, 0.025, 0.035, 0.014, 0.1, glossy("JoyconBlue", "#00a5e0", 0.3), 0.012, r)
    return r


def controller(name, x, y, z, rot, m, accent):
    r = root(name, x, y, z, rot)
    R(name + "_body", 0, 0, 0, 0.11, 0.055, 0.035, m, 0.015, r)
    for s in (-1, 1):
        R(f"{name}_grip{s}", s * 0.05, -0.03, 0, 0.04, 0.06, 0.03, m, 0.015, r)
        Fu._cyl(f"{name}_stick{s}", s * 0.022, 0.0, 0.035, 0.045, 0.009, accent, r, 12)
    return r


def game_cases(name, x, y, z, rot, n, rnd):
    r = root(name, x, y, z, rot)
    cols = ["#1f4fa8", "#f0f0f0", "#0e7a0e", "#c8161d", "#202020", "#e8e8e8"]
    xx = 0.0
    for k in range(n):
        R(f"{name}{k}", xx, 0, 0, 0.014, 0.135, 0.17, M("Case" + cols[k % 6], cols[k % 6], 0.4), 0.001, r)
        xx += 0.0155
    return r


# ---------------------------------------------------------------- game room
def game_room(mt):
    z = F1
    remove(("PT", "GameSofa", "GameRedCabinet", "Dartboard", "GameRug"))
    rnd = random.Random(3)
    # media wall: 85" TV, walnut console, consoles, soundbar, LED, cases
    tv("GameTV", 31.0, 22.08, z + 0.82, "S", 85, mt, (0.38, 0.5))
    con = wall("GameConsole", 31.0, 22.08, z, "S")
    R("GameConsoleBody", 0, 0.23, 0.08, 2.6, 0.45, 0.42, mt["walnut"], 0.006, con)
    R("GameConsolePlinth", 0, 0.23, 0.0, 2.5, 0.4, 0.08, mt["black"], 0.0, con)
    for k in range(4):
        R(f"GameConsoleSeam{k}", -0.975 + k * 0.65, 0.452, 0.1, 0.004, 0.004, 0.38, mt["black"], 0, con)
    R("GameSoundbar", 0, 0.12, 0.5, 1.2, 0.1, 0.065, mt["black"], 0.02, con)
    ps5_pro("PS5Pro", 29.95, 22.36, z + 0.5, 0, mt)
    xbox("XboxSX", 32.1, 22.3, z + 0.5, 0, mt)
    switch("SwitchOLED", 31.75, 22.4, z + 0.5, 0, mt)
    game_cases("PSCases", 30.15, 22.3, z + 0.5, 0, 12, rnd)
    controller("DualSense1", 30.5, 24.55, z + 0.43, 20, mt["plastic_w"], mt["plastic_b"])
    controller("DualSense2", 30.95, 24.45, z + 0.43, -15, mt["plastic_w"], mt["plastic_b"])
    controller("XboxPad", 31.6, 24.6, z + 0.43, 10, mt["plastic_b"], mt["plastic_b"])
    # headset on a stand
    hs = root("Headset", 32.24, 22.42, z + 0.5, 0)
    Fu._cyl("HeadsetBase", 0, 0, 0, 0.012, 0.06, mt["black"], hs, 24)
    Fu._cyl("HeadsetPole", 0, 0, 0.012, 0.26, 0.008, mt["black"], hs, 12)
    for s in (-1, 1):
        R(f"HeadsetCup{s}", s * 0.085, 0, 0.13, 0.04, 0.09, 0.1, mt["plastic_w"], 0.03, hs)
    R("HeadsetBand", 0, 0, 0.26, 0.2, 0.03, 0.02, mt["plastic_w"], 0.01, hs)
    # sectional in green velvet facing the TV, ottoman, throw, rug
    I.rug("GameRug2", 29.0, 33.1, 23.0, 27.0, z, "#2e2e30", "#8a7550")
    s1 = Fu.sofa("GameSectional", 31.0, 25.9, z, 180, 3.1, 1.0)
    for k, (dx, c) in enumerate(((-1.1, "#b08d57"), (-0.6, "#e9e4da"), (0.6, "#1d2b3a"), (1.1, "#6b2e2a"))):
        Fu.pillow(f"GamePil{k}", dx, -0.28, 0.5, c, s1)
    ot = root("GameOttoman", 31.0, 24.5, z, 0)
    R("GameOttomanBody", 0, 0, 0.05, 1.2, 0.7, 0.36, Fu.fabric("leather", "#3a2a1e"), 0.06, ot)
    R("GameTray", 0.25, 0.0, 0.41, 0.45, 0.32, 0.02, mt["walnut"], 0.005, ot)
    Fu.throw("GameThrow", 32.3, 26.0, z + 0.62, 90, "#6b2e2a")
    # pool table: rails, pockets, felt, racked balls, cue rack on the loft wall
    pt = root("PoolTable", 27.3, 25.7, z, 0)
    felt = M("PoolFelt2", "#1f4f5e", 0.9)
    wood = mt["walnut"]
    R("PTCabinet", 0, 0, 0.2, 1.3, 2.45, 0.52, wood, 0.03, pt)
    R("PTBed", 0, 0, 0.72, 1.12, 2.24, 0.06, felt, 0.0, pt)
    for (x0, y0, sx, sy) in ((0, 1.18, 1.36, 0.12), (0, -1.18, 1.36, 0.12), (0.62, 0, 0.12, 2.36), (-0.62, 0, 0.12, 2.36)):
        R(f"PTRail{x0}{y0}", x0, y0, 0.72, sx, sy, 0.1, wood, 0.012, pt)
    for (px, py) in ((-0.58, -1.14), (0.58, -1.14), (-0.6, 0), (0.6, 0), (-0.58, 1.14), (0.58, 1.14)):
        Fu._cyl(f"PTPocket{px}{py}", px, py, 0.75, 0.83, 0.06, mt["black"], pt, 16)
    for (lx, ly) in ((-0.5, -0.95), (0.5, -0.95), (-0.5, 0.95), (0.5, 0.95)):
        R(f"PTLeg{lx}{ly}", lx, ly, 0.0, 0.2, 0.2, 0.22, wood, 0.02, pt)
    cols = ["#f2c700", "#1a3fa0", "#c8161d", "#5b2a86", "#f07a00", "#0d6b2f", "#7a1e1e", "#111111",
            "#f2c700", "#1a3fa0", "#c8161d", "#5b2a86", "#f07a00", "#0d6b2f", "#7a1e1e"]
    k = 0
    for row in range(5):
        for j in range(row + 1):
            sphere(f"Ball{k}", (j - row / 2) * 0.058, 0.55 + row * 0.05, 0.808, 0.0286,
                   glossy("Ball" + cols[k], cols[k], 0.08, 0, 1.0), pt, 16)
            k += 1
    sphere("CueBall", 0.05, -0.6, 0.808, 0.0286, glossy("BallWhite", "#f6f2e6", 0.08, 0, 1.0), pt, 16)
    cue = R("PoolCue", 0, 0, 0, 0.012, 1.45, 0.012, wood, 0.004)
    cue.location = (27.75, 25.0, z + 0.86)
    cue.rotation_euler = (0, 0, math.radians(18))
    # pendant over the pool table
    for k, yy in enumerate((24.9, 25.7, 26.5)):
        Fu._cyl(f"PTPend{k}", 27.3, yy, z + 1.9, z + 2.05, 0.17, mt["black"], None, 32)
        Fu._cyl(f"PTPendRod{k}", 27.3, yy, z + 2.05, EAVE + (27.3 - 25.5) - 0.4, 0.004, mt["black"], None, 6)
        I.point_light(f"PTPendL{k}", (27.3, yy, z + 1.85), 30, 0.1)
    # two arcade cabinets on the east wall, bar fridge + popcorn by the hall opening
    for k, yy in enumerate((26.95, 27.8)):
        a = wall(f"Arcade{k}", 33.68, yy, z, "E")
        col = ["#1b1b8c", "#8c1b1b"][k]
        R(f"Arcade{k}_body", 0, 0.38, 0, 0.68, 0.76, 1.75, M("ArcadeBlack", "#141414", 0.4), 0.01, a)
        for s in (-1, 1):
            R(f"Arcade{k}_side{s}", s * 0.345, 0.38, 0, 0.012, 0.8, 1.8, glossy("ArcadeArt" + col, col, 0.25), 0.003, a)
        R(f"Arcade{k}_marquee", 0, 0.7, 1.62, 0.62, 0.06, 0.16, glow("Marquee" + col, "#ffd27a", 4.0), 0.0, a)
        scr = panel(f"Arcade{k}_scr", 0.5, 0.4, screen_mat("ArcadeScreen", (0.3 + 0.3 * k, 0.55), 0.1, 2.5), a, 0.77, 1.1)
        R(f"Arcade{k}_panel", 0, 0.82, 0.92, 0.62, 0.22, 0.06, M("ArcadePanel", "#222222", 0.4), 0.01, a)
        for b in range(6):
            Fu._cyl(f"Arcade{k}_btn{b}", -0.05 + (b % 3) * 0.07, 0.8 + (b // 3) * 0.05, 0.98, 0.995, 0.014,
                    glossy("Btn" + str(b), ["#e3373e", "#f2c700", "#00a5e0"][b % 3], 0.3), a, 12)
        Fu._cyl(f"Arcade{k}_stick", -0.2, 0.82, 0.98, 1.06, 0.006, mt["black"], a, 8)
        sphere(f"Arcade{k}_ball", -0.2, 0.82, 1.07, 0.02, glossy("BtnRed", "#e3373e", 0.3), a)
    fr = wall("BarFridge", 28.65, 22.08, z, "S")
    R("BarFridgeBody", 0, 0.3, 0, 0.6, 0.6, 0.86, mt["steel"], 0.01, fr)
    R("BarFridgeGlass", 0, 0.602, 0.08, 0.5, 0.01, 0.72, M("FridgeGlass", "#222a30", 0.05), 0.0, fr)
    R("BarFridgeLight", 0, 0.5, 0.78, 0.48, 0.02, 0.01, glow("FridgeLED", "#e8f2ff", 6.0), 0.0, fr)
    for row in range(3):
        for j in range(5):
            Fu._cyl(f"Can{row}{j}", -0.2 + j * 0.1, 0.48, 0.12 + row * 0.24, 0.24 + row * 0.24, 0.033,
                    glossy("Can" + str((row + j) % 3), ["#c8161d", "#1a3fa0", "#e8e8e8"][(row + j) % 3], 0.2, 1.0), fr, 16)
    pc = root("Popcorn", 28.65, 22.4, z + 0.86, 0)
    R("PopcornCart", 0, 0, 0, 0.42, 0.32, 0.5, glossy("PopcornRed", "#b3161d", 0.25), 0.01, pc)
    R("PopcornGlass", 0, 0.0, 0.08, 0.38, 0.28, 0.36, mt["glass"], 0.0, pc)
    R("PopcornFill", 0, 0, 0.08, 0.34, 0.24, 0.14, M("Popcorn", "#f4e3b0", 0.8), 0.02, pc)
    R("PopcornRoof", 0, 0, 0.5, 0.44, 0.34, 0.04, glossy("PopcornRed", "#b3161d", 0.25), 0.01, pc)
    P.place("dartboard", (33.68, 22.75, z + 1.73), 270, coll=COLL, name="Dartboard")
    I.point_light("GameTVFill", (31.0, 23.6, z + 2.6), 60, 0.6)


# ---------------------------------------------------------------- gym
def kettlebell(name, x, y, z, s, m):
    sphere(name + "_ball", x, y, z + 0.09 * s, 0.09 * s, m)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.06 * s, minor_radius=0.012 * s, location=(x, y, z + 0.2 * s),
                                     rotation=(math.pi / 2, 0, 0))
    t = bpy.context.active_object
    t.name = name + "_handle"
    t.data.materials.append(m)
    for c in t.users_collection:
        c.objects.unlink(t)
    COLL.objects.link(t)


def gym(mt):
    z = -3.9
    remove(("GymTV",))
    # rubber tile floor (1 m tiles with seams) over the existing floor
    tile = bpy.data.materials.new("GymTiles")
    tile.use_nodes = True
    nt = tile.node_tree
    p = nt.nodes["Principled BSDF"]
    br = nt.nodes.new("ShaderNodeTexBrick")
    br.inputs["Scale"].default_value = 1.0
    br.inputs["Mortar Size"].default_value = 0.004
    br.inputs["Brick Width"].default_value = 1.0
    br.inputs["Row Height"].default_value = 1.0
    br.offset = 0.0
    br.inputs["Color1"].default_value = (0.022, 0.022, 0.024, 1)
    br.inputs["Color2"].default_value = (0.03, 0.03, 0.032, 1)
    br.inputs["Mortar"].default_value = (0.005, 0.005, 0.005, 1)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nt.links.new(tc.outputs["Object"], br.inputs["Vector"])
    nt.links.new(br.outputs["Color"], p.inputs["Base Color"])
    p.inputs["Roughness"].default_value = 0.85
    I.box("GymTileFloor", 25.82, 33.68, 9.42, 22.78, z, z + 0.012, tile)
    # functional trainer (two towers with weight stacks) on the west wall
    ft = wall("FuncTrainer", 25.82, 11.8, z, "W")
    steel = M("RackSteel", "#1a1b1d", 0.45, 0.8)
    for s in (-1, 1):
        R(f"FT_post{s}a", s * 1.05, 0.1, 0, 0.08, 0.08, 2.3, steel, 0.005, ft)
        R(f"FT_post{s}b", s * 1.05, 0.55, 0, 0.08, 0.08, 2.3, steel, 0.005, ft)
        for k in range(14):
            R(f"FT_plate{s}{k}", s * 1.05, 0.32, 0.12 + k * 0.035, 0.3, 0.18, 0.03, M("StackPlate", "#2a2a2c", 0.5, 0.6), 0.002, ft)
        Fu._cyl(f"FT_guide{s}", s * 1.05 - 0.06, 0.32, 0.1, 2.2, 0.01, mt["chrome"], ft, 8)
        Fu._cyl(f"FT_guide{s}b", s * 1.05 + 0.06, 0.32, 0.1, 2.2, 0.01, mt["chrome"], ft, 8)
        R(f"FT_shroud{s}", s * 1.05, 0.62, 0.1, 0.34, 0.02, 1.0, M("ShroudRed", "#9c1c1c", 0.4), 0.004, ft)
        R(f"FT_arm{s}", s * 1.05, 0.75, 1.3, 0.06, 0.4, 0.06, steel, 0.005, ft)
        R(f"FT_handle{s}", s * 1.05, 0.98, 1.0, 0.12, 0.03, 0.03, M("Grip", "#151515", 0.7), 0.01, ft)
    R("FT_top", 0, 0.32, 2.3, 2.2, 0.55, 0.08, steel, 0.005, ft)
    R("FT_pullup", 0, 0.75, 2.28, 1.8, 0.04, 0.04, mt["chrome"], 0.01, ft)
    R("FT_base", 0, 0.32, 0, 2.3, 0.6, 0.05, steel, 0.005, ft)
    # rowing machine
    rw = root("Rower", 27.2, 14.6, z, 90)
    R("RowRail", 0, 0, 0.12, 0.08, 2.2, 0.06, mt["black"], 0.01, rw)
    R("RowSeat", 0, -0.2, 0.2, 0.3, 0.32, 0.06, mt["black"], 0.03, rw)
    fan = R("RowFlywheel", 0, 1.0, 0.1, 0.12, 0.5, 0.5, M("RowerFan", "#1d1d1f", 0.4), 0.2, rw)
    R("RowMonitorArm", 0, 0.75, 0.3, 0.03, 0.03, 0.55, mt["black"], 0.01, rw)
    R("RowMonitor", 0, 0.72, 0.85, 0.2, 0.04, 0.16, mt["black"], 0.01, rw)
    for s in (-1, 1):
        R(f"RowFoot{s}", s * 0.12, 0.45, 0.16, 0.12, 0.26, 0.04, mt["black"], 0.01, rw)
    # two spin bikes facing the TV wall
    for k, xx in enumerate((26.75, 27.85)):
        b = root(f"Spin{k}", xx, 20.4, z, 180)
        R(f"Spin{k}_base", 0, 0, 0, 0.55, 1.2, 0.06, mt["black"], 0.02, b)
        R(f"Spin{k}_frame", 0, 0.1, 0.06, 0.1, 0.12, 0.75, M("SpinRed", "#b81c22", 0.35, 0.4), 0.02, b)
        fw = R(f"Spin{k}_wheel", 0, 0.42, 0.06, 0.06, 0.48, 0.48, mt["chrome"], 0.2, b)
        R(f"Spin{k}_seatpost", 0, -0.18, 0.06, 0.05, 0.05, 0.95, mt["black"], 0.01, b)
        R(f"Spin{k}_saddle", 0, -0.2, 1.0, 0.16, 0.28, 0.07, mt["black"], 0.03, b)
        R(f"Spin{k}_stem", 0, 0.38, 0.06, 0.05, 0.05, 1.12, mt["black"], 0.01, b)
        R(f"Spin{k}_bars", 0, 0.42, 1.16, 0.46, 0.06, 0.04, mt["black"], 0.02, b)
        R(f"Spin{k}_screen", 0, 0.48, 1.24, 0.42, 0.03, 0.26, mt["black"], 0.01, b)
        panel(f"Spin{k}_disp", 0.38, 0.22, screen_mat("SpinScreen", (0.55, 0.5), 0.15, 1.5), b, 0.497, 1.26)
    # kettlebell rack on the east wall
    kr = wall("KBRack", 33.68, 16.7, z, "E")
    R("KBRackTop", 0, 0.3, 0.55, 1.6, 0.45, 0.04, steel, 0.005, kr)
    R("KBRackLow", 0, 0.3, 0.15, 1.6, 0.45, 0.04, steel, 0.005, kr)
    for s in (-1, 1):
        R(f"KBRackLeg{s}", s * 0.78, 0.3, 0, 0.04, 0.45, 0.6, steel, 0.005, kr)
    kbm = M("KBBlack", "#1c1c1c", 0.55, 0.3)
    for k in range(5):
        for t, zz in enumerate((0.19, 0.59)):
            pos = kr.matrix_world @ Vector((-0.6 + k * 0.3, 0.3, zz))
            kettlebell(f"KB{k}{t}", pos.x, pos.y, z + zz, 0.8 + 0.1 * k, kbm)
    # plate tree, med balls, plyo boxes, mats, foam roller, gym ball
    pt = root("PlateTree", 29.45, 12.2, z, 0)
    Fu._cyl("PlateTreePole", 0, 0, 0, 1.2, 0.03, steel, pt, 12)
    Fu._cyl("PlateTreeBase", 0, 0, 0, 0.05, 0.35, steel, pt, 24)
    for k, (zz, rr) in enumerate(((0.35, 0.225), (0.6, 0.225), (0.85, 0.19))):
        for s in (-1, 1):
            p_ = Fu._cyl(f"Plate{k}{s}", 0, 0, -0.03, 0.03, rr, mt["rubber"], None, 40)
            p_.rotation_euler.x = math.pi / 2
            p_.location = (29.45, 12.2 + s * 0.08, z + zz)
    for k in range(3):
        sphere(f"MedBall{k}", 29.2 + k * 0.32, 15.6, z + 0.15, 0.15, M("MedBall", "#2d2d30", 0.8))
    wood = Fu.fabric("wood", "#c7a77b")
    for k, (w_, h_) in enumerate(((0.75, 0.6), (0.6, 0.45), (0.45, 0.3))):
        R(f"Plyo{k}", 29.4, 17.0, z + sum(hh for _, hh in ((0.75, 0.6), (0.6, 0.45), (0.45, 0.3))[:k]), w_, w_ * 0.8, h_, wood, 0.01)
    for k, col in enumerate(("#3c5a73", "#6b2e2a")):
        R(f"YogaMat{k}", 30.6 + k * 0.75, 18.4, z + 0.012, 0.61, 1.83, 0.006, M("Mat" + col, col, 0.8), 0.003)
    r_ = Fu._cyl("FoamRoller", 0, 0, -0.45, 0.45, 0.075, M("FoamBlue", "#2b6cb0", 0.8), None, 24)
    r_.rotation_euler.y = math.pi / 2
    r_.location = (31.4, 17.2, z + 0.09)
    sphere("GymBall", 32.6, 18.6, z + 0.33, 0.32, glossy("GymBallGrey", "#8a8f94", 0.35))
    # battle rope looping from the rack base
    pts = [(30.3, 12.1, z + 0.05)] + [(30.3 - 0.4 * i, 11.6 + 0.12 * math.sin(i * 1.2), z + 0.03) for i in range(1, 9)]
    for i, (a, b) in enumerate(zip(pts, pts[1:])):
        d = Vector(b) - Vector(a)
        o = Fu._cyl(f"Rope{i}", 0, 0, 0, d.length, 0.02, M("Rope", "#2d2a26", 0.9), None, 10)
        o.location = a
        o.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
    # cold plunge next to the sauna
    cp = root("ColdPlunge", 29.85, 21.85, z, 0)
    R("PlungeShell", 0, 0, 0, 1.5, 1.0, 0.85, Fu.fabric("wood", "#8a6444"), 0.03, cp)
    R("PlungeWater", 0, 0, 0.6, 1.36, 0.86, 0.2, bpy.data.materials.get("PoolWaterReal") or M("PlungeW", "#9fd6e0", 0.02, transmission=1.0), 0.02, cp)
    R("PlungeChiller", -0.95, 0.1, 0, 0.35, 0.5, 0.55, mt["black"], 0.02, cp)
    # towel shelf + water dispenser + speakers on the south wall
    tw = wall("TowelShelf", 29.5, 9.42, z, "S")
    for k, zz in enumerate((0.5, 0.9, 1.3)):
        R(f"TowelBoard{k}", 0, 0.2, zz, 1.0, 0.36, 0.03, mt["oak"], 0.004, tw)
        for j in range(4):
            r2 = Fu._cyl(f"Towel{k}{j}", 0, 0, -0.15, 0.15, 0.06, M("TowelWhite", "#f1efea", 0.95), None, 16)
            r2.rotation_euler.x = math.pi / 2
            r2.location = tw.matrix_world @ Vector((-0.36 + j * 0.24, 0.2, zz + 0.09))
    wd = wall("WaterCooler", 30.5, 9.42, z, "S")
    R("CoolerBody", 0, 0.18, 0, 0.32, 0.32, 1.0, mt["steel"], 0.01, wd)
    Fu._cyl("CoolerBottle", 0, 0.18, 1.0, 1.42, 0.13, M("BottleBlue", "#bcd7ea", 0.05, transmission=0.9), wd, 24)
    for s in (-1, 1):
        sp = wall(f"GymSpeaker{s}", 28.0 + s * 1.6, 9.42, z + 2.2, "S")
        R(f"GymSpeakerBox{s}", 0, 0.12, 0, 0.25, 0.22, 0.38, mt["black"], 0.01, sp)
    tv("GymTV2", 28.0, 9.43, z + 1.25, "S", 75, mt, (0.62, 0.48))


# ---------------------------------------------------------------- beds & bedroom furniture
def big_bed(name, x, y, z, side, width=2.0, length=2.15, head_col="#22392f", duvet="#f2efe8", throw_col="#6b2e2a",
            pillow_cols=("#f2efe8", "#f2efe8", "#b08d57", "#1d2b3a")):
    """Bed with a tall channel-tufted headboard against `side` wall, layered bedding."""
    r = wall(name, x, y, z, side)
    head = Fu.fabric("velvet", head_col)
    lin = Fu.fabric("linen", duvet)
    w, L = width, length
    R(name + "_headboard", 0, 0.06, 0.0, w + 0.3, 0.12, 1.45, head, 0.04, r)
    for k in range(int((w + 0.3) / 0.22)):
        R(f"{name}_chan{k}", -(w + 0.3) / 2 + 0.11 + k * 0.22, 0.125, 0.45, 0.2, 0.03, 0.95, head, 0.03, r)
    R(name + "_base", 0, 0.12 + L / 2, 0.05, w + 0.06, L, 0.3, head, 0.03, r)
    R(name + "_mattress", 0, 0.12 + L / 2, 0.35, w, L - 0.04, 0.24, lin, 0.06, r)
    R(name + "_duvet", 0, 0.12 + L / 2 + 0.22, 0.55, w + 0.08, L - 0.42, 0.1, lin, 0.05, r)
    R(name + "_fold", 0, 0.12 + 0.62, 0.6, w + 0.06, 0.22, 0.08, lin, 0.04, r)
    R(name + "_throw", 0, 0.12 + L - 0.35, 0.64, w + 0.12, 0.55, 0.035, Fu.fabric("linen", throw_col), 0.015, r)
    xs = [-w / 4, w / 4]
    for k, px in enumerate(xs):
        R(f"{name}_sham{k}", px, 0.24, 0.6, w / 2 - 0.06, 0.16, 0.55, Fu.fabric("linen", pillow_cols[0]), 0.08, r).rotation_euler.x = math.radians(-12)
        R(f"{name}_pil{k}", px, 0.4, 0.6, w / 2 - 0.12, 0.16, 0.42, Fu.fabric("linen", pillow_cols[1]), 0.08, r).rotation_euler.x = math.radians(-14)
    R(name + "_lumbar", 0, 0.55, 0.62, 0.7, 0.14, 0.28, Fu.fabric("velvet", pillow_cols[2]), 0.07, r).rotation_euler.x = math.radians(-16)
    R(name + "_acc", 0.32, 0.52, 0.62, 0.42, 0.14, 0.4, Fu.fabric("linen", pillow_cols[3]), 0.08, r).rotation_euler.x = math.radians(-14)
    return r


def nightstand2(name, x, y, z, side, mt, items=True, phone=True):
    r = wall(name, x, y, z, side)
    R(name + "_body", 0, 0.24, 0.12, 0.6, 0.45, 0.48, mt["walnut"], 0.006, r)
    for k in range(2):
        R(f"{name}_dr{k}", 0, 0.466, 0.16 + k * 0.22, 0.56, 0.006, 0.2, mt["walnut"], 0.002, r)
        R(f"{name}_pull{k}", 0, 0.472, 0.25 + k * 0.22, 0.14, 0.012, 0.012, mt["brass"], 0.003, r)
    for sx in (-1, 1):
        R(f"{name}_leg{sx}", sx * 0.27, 0.24, 0, 0.03, 0.4, 0.12, mt["brass"], 0.003, r)
    pos = r.matrix_world @ Vector((0.12, 0.2, 0.6))
    I.table_lamp(name + "_lamp", pos.x, pos.y, pos.z, 0.55, "#efe6d6")
    if items:
        R(name + "_book1", -0.15, 0.25, 0.6, 0.18, 0.24, 0.03, Fu.fabric("linen", "#1d2b3a"), 0.003, r)
        R(name + "_book2", -0.15, 0.25, 0.63, 0.16, 0.22, 0.025, Fu.fabric("linen", "#b08d57"), 0.003, r)
        Fu._cyl(name + "_glass", -0.18, 0.38, 0.6, 0.71, 0.032, mt["glass"], r, 16)
        if phone:
            R(name + "_phone", -0.14, 0.27, 0.655, 0.075, 0.155, 0.008, glossy("Phone", "#111111", 0.1), 0.004, r)
    return r


def dresser(name, x, y, z, side, mt, w=1.6, tv_in=0, decor=True):
    r = wall(name, x, y, z, side)
    R(name + "_body", 0, 0.25, 0.12, w, 0.5, 0.75, mt["walnut"], 0.006, r)
    cols = int(w / 0.5)
    for c in range(cols):
        for k in range(3):
            R(f"{name}_dr{c}{k}", -w / 2 + (c + 0.5) * w / cols, 0.501, 0.15 + k * 0.24, w / cols - 0.02, 0.006, 0.22, mt["walnut"], 0.002, r)
            R(f"{name}_pull{c}{k}", -w / 2 + (c + 0.5) * w / cols, 0.508, 0.26 + k * 0.24, 0.12, 0.012, 0.012, mt["brass"], 0.003, r)
    for sx in (-1, 1):
        R(f"{name}_leg{sx}", sx * (w / 2 - 0.05), 0.25, 0, 0.04, 0.44, 0.12, mt["brass"], 0.003, r)
    if decor:
        Fu._cyl(name + "_vase", -w / 2 + 0.25, 0.25, 0.87, 1.15, 0.07, glossy("VaseBlack", "#1a1a1a", 0.2), r, 24)
        for k in range(3):
            st = R(f"{name}_stem{k}", -w / 2 + 0.25 + (k - 1) * 0.03, 0.25, 1.15, 0.006, 0.006, 0.35, M("Stem", "#5d6b3c", 0.6), 0.0, r)
            st.rotation_euler.y = math.radians((k - 1) * 12)
        R(name + "_tray", w / 2 - 0.3, 0.25, 0.87, 0.35, 0.22, 0.015, mt["brass"], 0.004, r)
        Fu._cyl(name + "_candle", w / 2 - 0.36, 0.25, 0.885, 0.98, 0.04, M("Candle", "#f1ebe0", 0.5, sss=0.4), r, 20)
        R(name + "_frame", w / 2 - 0.2, 0.18, 0.885, 0.18, 0.02, 0.23, M("PhotoFrame", "#161616", 0.4), 0.003, r).rotation_euler.x = math.radians(-8)
    if tv_in:
        tv(name + "_TV", x, y, z + 1.35, side, tv_in, mt)
    return r


def armchair_lamp(name, x, y, z, rot, mt, col="#22392f"):
    st = dict(Fu.style())
    st["chair"] = ("velvet", col)
    Fu.accent_chair(name, x, y, z, rot, st)
    a = math.radians(rot)
    lx, ly = x + 0.55 * math.cos(a) - 0.25 * math.sin(a), y + 0.55 * math.sin(a) + 0.25 * math.cos(a)
    Fu._cyl(name + "_lampbase", lx, ly, z, z + 0.02, 0.15, mt["brass"], None, 24)
    Fu._cyl(name + "_lamppole", lx, ly, z, z + 1.45, 0.012, mt["brass"], None, 8)
    Fu._cyl(name + "_lampshade", lx, ly, z + 1.4, z + 1.65, 0.2, M("LampShade", "#efe6d6", 0.7, sss=0.6, transmission=0.4), None, 32)
    I.point_light(name + "_lampL", (lx, ly, z + 1.5), 35, 0.1)


def art(name, x, y, z, side, w, h, uv):
    r = wall(name, x, y, z, side)
    R(name + "_frame", 0, 0.02, 0, w, 0.035, h, M("ArtFrame", "#161616", 0.4), 0.004, r)
    R(name + "_mat", 0, 0.0385, 0.04, w - 0.08, 0.002, h - 0.08, M("ArtMat", "#f3f1ec", 0.8), 0.0, r)
    pic = bpy.data.materials.get("PrintImage") or screen_mat("ArtPic", (0.5, 0.5), 0.2, 0.0)
    m = bpy.data.materials.get("ArtImage_" + name)
    panel(name + "_pic", w - 0.24, h - 0.24, screen_mat("ArtImage_" + name, uv, 0.16, 0.55), r, 0.041, 0.12)
    return r


def wardrobe(name, x, y, z, side, mt, w=2.4, h=2.5):
    r = wall(name, x, y, z, side)
    R(name + "_body", 0, 0.3, 0.0, w, 0.6, h, mt["walnut"], 0.006, r)
    n = int(w / 0.6)
    for k in range(n):
        R(f"{name}_door{k}", -w / 2 + (k + 0.5) * w / n, 0.602, 0.08, w / n - 0.012, 0.006, h - 0.12, mt["walnut"], 0.002, r)
        R(f"{name}_pull{k}", -w / 2 + (k + 0.5) * w / n + (0.2 if k % 2 == 0 else -0.2), 0.612, 0.9, 0.012, 0.012, 0.6, mt["brass"], 0.003, r)
    return r


def clothes_rail(name, x, y, z, side, w, mt, rnd):
    r = wall(name, x, y, z, side)
    R(name + "_back", 0, 0.01, 0, w, 0.02, 2.6, mt["oak"], 0.0, r)
    R(name + "_shelf", 0, 0.3, 1.95, w, 0.58, 0.03, mt["oak"], 0.003, r)
    Fu._cyl(name + "_rod", 0, 0, -w / 2, w / 2, 0.012, mt["brass"], None, 12).rotation_euler.y = math.pi / 2
    o = bpy.data.objects[name + "_rod"]
    o.parent = r
    o.location = (0, 0.3, 1.85)
    cols = ["#1d2b3a", "#f2efe8", "#6b2e2a", "#2e2e30", "#b08d57", "#8a9aa8", "#efe6d6", "#22392f", "#5c4a3a"]
    xx = -w / 2 + 0.06
    k = 0
    while xx < w / 2 - 0.06:
        L = rnd.uniform(0.7, 1.2)
        R(f"{name}_cl{k}", xx, 0.3, 1.82 - L, 0.03, rnd.uniform(0.42, 0.5), L, Fu.fabric("linen", rnd.choice(cols)), 0.012, r)
        xx += rnd.uniform(0.045, 0.07)
        k += 1
    for k in range(int(w / 0.35)):
        R(f"{name}_box{k}", -w / 2 + 0.2 + k * 0.35, 0.3, 1.98, 0.28, 0.35, 0.22, M("ShoeBox", rnd.choice(["#efe6d6", "#e2d6c0", "#1a1a1a"]), 0.6), 0.01, r)


# ---------------------------------------------------------------- bathrooms
def tile_mat(name, c1, c2, size=0.6, mortar=0.002):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    br = nt.nodes.new("ShaderNodeTexBrick")
    br.inputs["Scale"].default_value = 1.0 / size
    br.inputs["Mortar Size"].default_value = mortar
    br.inputs["Brick Width"].default_value = 1.0
    br.inputs["Row Height"].default_value = 1.0 if size > 0.2 else 0.5
    br.inputs["Color1"].default_value = (*Fu._lin(c1), 1)
    br.inputs["Color2"].default_value = (*Fu._lin(c2), 1)
    br.inputs["Mortar"].default_value = (*[c * 0.7 for c in Fu._lin(c2)], 1)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nt.links.new(tc.outputs["Object"], br.inputs["Vector"])
    nt.links.new(br.outputs["Color"], p.inputs["Base Color"])
    p.inputs["Roughness"].default_value = 0.25
    p.inputs["Coat Weight"].default_value = 0.3
    return m


def toilet(name, x, y, z, side, mt):
    r = wall(name, x, y, z, side)
    c = mt["ceramic"]
    R(name + "_tank", 0, 0.1, 0.38, 0.42, 0.18, 0.4, c, 0.03, r)
    R(name + "_bowl", 0, 0.42, 0.0, 0.36, 0.5, 0.4, c, 0.12, r)
    R(name + "_seat", 0, 0.45, 0.4, 0.38, 0.5, 0.03, c, 0.08, r)
    R(name + "_lid", 0, 0.42, 0.43, 0.37, 0.47, 0.02, c, 0.08, r)
    R(name + "_flush", 0, 0.1, 0.79, 0.05, 0.03, 0.02, mt["chrome"], 0.006, r)
    tp = wall(name + "_tp", 0, 0, 0, side)
    tp.parent = r
    tp.location = (0.45, 0.02, 0.68)
    tp.rotation_euler = (0, 0, 0)
    Fu._cyl(name + "_roll", 0, 0, -0.06, 0.06, 0.055, M("TPaper", "#f6f6f2", 0.9), None, 20).rotation_euler.y = math.pi / 2
    ro = bpy.data.objects[name + "_roll"]
    ro.parent = tp
    ro.location = (0, 0.07, 0)
    return r


def vanity(name, x, y, z, side, mt, w=1.6, sinks=2, mirror_h=1.0):
    r = wall(name, x, y, z, side)
    R(name + "_cab", 0, 0.28, 0.15, w, 0.55, 0.7, mt["walnut"], 0.006, r)
    n = max(2, int(w / 0.5))
    for k in range(n):
        R(f"{name}_door{k}", -w / 2 + (k + 0.5) * w / n, 0.556, 0.18, w / n - 0.012, 0.006, 0.64, mt["walnut"], 0.002, r)
        R(f"{name}_pull{k}", -w / 2 + (k + 0.5) * w / n, 0.563, 0.7, 0.14, 0.012, 0.012, mt["brass"], 0.003, r)
    R(name + "_top", 0, 0.29, 0.85, w + 0.04, 0.58, 0.04, mt["marble"], 0.004, r)
    xs = [0.0] if sinks == 1 else [-w / 4, w / 4]
    for k, sx in enumerate(xs):
        bowl = R(f"{name}_basin{k}", sx, 0.32, 0.89, 0.46, 0.36, 0.14, mt["ceramic"], 0.06, r)
        cav = R(f"{name}_basinCut{k}", sx, 0.32, 0.92, 0.4, 0.3, 0.2, mt["ceramic"], 0.05, r)
        hollow(bowl, cav)
        Fu._cyl(f"{name}_drain{k}", sx, 0.32, 0.92, 0.925, 0.02, mt["brass"], r, 16)
        Fu._cyl(f"{name}_faucet{k}", sx, 0.06, 0.89, 1.2, 0.014, mt["brass"], r, 16)
        R(f"{name}_spout{k}", sx, 0.15, 1.17, 0.025, 0.2, 0.025, mt["brass"], 0.01, r)
        R(f"{name}_mirror{k}", sx, 0.025, 1.05, min(0.9, w / len(xs) - 0.15), 0.02, mirror_h, mt["brass"], 0.01, r)
        R(f"{name}_mglass{k}", sx, 0.036, 1.08, min(0.9, w / len(xs) - 0.15) - 0.05, 0.004, mirror_h - 0.06, mt["mirror"], 0.0, r)
        for s in (-1, 1):
            px = sx + s * (min(0.9, w / len(xs) - 0.15) / 2 + 0.1)
            R(f"{name}_sconce{k}{s}", px, 0.06, 1.45, 0.08, 0.1, 0.24, glow("SconceGlow2", "#ffe2b8", 5.0), 0.03, r)
        pos = r.matrix_world @ Vector((sx, 0.6, 1.55))
        I.point_light(f"{name}_L{k}", (pos.x, pos.y, pos.z), 25, 0.2)
    # soap, tray, towel
    R(name + "_tray", w / 2 - 0.15, 0.16, 0.89, 0.18, 0.12, 0.012, mt["brass"], 0.003, r)
    Fu._cyl(name + "_soap", w / 2 - 0.19, 0.16, 0.9, 1.08, 0.03, glossy("SoapAmber", "#8a5a2a", 0.1), r, 16)
    R(name + "_handtowel", -w / 2 + 0.12, 0.62, 0.55, 0.22, 0.03, 0.4, M("TowelWhite", "#f1efea", 0.95), 0.02, r)
    return r


def shower(name, x1, y1, x2, y2, z, h, glass_sides, mt, head_wall="S"):
    """Walk-in shower: marble-clad walls, glass on the given open sides ('N','S','E','W'), rain head, niche."""
    marble = mt["marble"]
    I.box(name + "_floor", x1, x2, y1, y2, z, z + 0.02, tile_mat("ShowerFloor", "#d9d6cf", "#c9c5bd", 0.1))
    for s in ("N", "S", "E", "W"):
        if s in glass_sides:
            continue
        if s == "S":
            I.box(name + "_wS", x1, x2, y1, y1 + 0.015, z, z + h, marble)
        if s == "N":
            I.box(name + "_wN", x1, x2, y2 - 0.015, y2, z, z + h, marble)
        if s == "W":
            I.box(name + "_wW", x1, x1 + 0.015, y1, y2, z, z + h, marble)
        if s == "E":
            I.box(name + "_wE", x2 - 0.015, x2, y1, y2, z, z + h, marble)
    for s in glass_sides:
        if s in ("N", "S"):
            yy = y2 if s == "N" else y1
            I.box(name + "_g" + s, x1 + 0.02, x2 - 0.02, yy - 0.005, yy + 0.005, z + 0.02, z + 2.05, mt["glass"])
            I.box(name + "_gb" + s, x1, x2, yy - 0.012, yy + 0.012, z + 2.05, z + 2.08, mt["brass"])
        else:
            xx = x2 if s == "E" else x1
            I.box(name + "_g" + s, xx - 0.005, xx + 0.005, y1 + 0.02, y2 - 0.02, z + 0.02, z + 2.05, mt["glass"])
            I.box(name + "_gb" + s, xx - 0.012, xx + 0.012, y1, y2, z + 2.05, z + 2.08, mt["brass"])
    cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
    Fu._cyl(name + "_rain", cx, cy, z + 2.2, z + 2.215, 0.15, mt["brass"], None, 32)
    Fu._cyl(name + "_arm", cx, cy, z + 2.215, z + h, 0.01, mt["brass"], None, 8)
    wx = {"S": (cx, y1 + 0.04), "N": (cx, y2 - 0.04), "W": (x1 + 0.04, cy), "E": (x2 - 0.04, cy)}[head_wall]
    Fu._cyl(name + "_valve", wx[0], wx[1], z + 1.1, z + 1.13, 0.05, mt["brass"], None, 24)
    R(name + "_niche", wx[0], wx[1], z + 1.25, 0.5 if head_wall in "SN" else 0.04, 0.04 if head_wall in "SN" else 0.5, 0.35,
      M("NicheShadow", "#b9b4ab", 0.3), 0.0)
    for k, col in enumerate(("#f1ebe0", "#2a3a4a", "#8a5a2a")):
        dx = (k - 1) * 0.1
        px, py = (wx[0] + dx, wx[1]) if head_wall in "SN" else (wx[0], wx[1] + dx)
        Fu._cyl(f"{name}_bottle{k}", px, py, z + 1.25, z + 1.45, 0.03, glossy("Bottle" + col, col, 0.2), None, 16)


def tub(name, x, y, z, rot, mt):
    r = root(name, x, y, z, rot)
    shell = R(name + "_shell", 0, 0, 0, 0.82, 1.72, 0.6, mt["ceramic"], 0.3, r)
    cav = R(name + "_cav", 0, 0, 0.12, 0.68, 1.56, 0.7, mt["ceramic"], 0.28, r)
    hollow(shell, cav)
    R(name + "_water", 0, 0, 0.12, 0.66, 1.54, 0.3, bpy.data.materials.get("PoolWaterReal") or mt["glass"], 0.26, r)
    R(name + "_towel", 0.43, -0.45, 0.35, 0.05, 0.45, 0.28, M("TowelWhite", "#f1efea", 0.95), 0.02, r)
    Fu._cyl(name + "_filler", 0, 1.05, 0, 0.95, 0.025, mt["brass"], r, 16)
    R(name + "_spout", 0, 0.95, 0.9, 0.04, 0.22, 0.04, mt["brass"], 0.015, r)
    R(name + "_tray", 0, 0.2, 0.6, 0.86, 0.22, 0.02, Fu.fabric("wood", "#8a6444"), 0.005, r)
    Fu._cyl(name + "_candle", 0.2, 0.2, 0.62, 0.72, 0.04, M("Candle", "#f1ebe0", 0.5, sss=0.4), r, 20)
    R(name + "_book", -0.15, 0.2, 0.62, 0.15, 0.2, 0.025, Fu.fabric("linen", "#1d2b3a"), 0.003, r)
    return r


def towel_bar(name, x, y, z, side, mt, w=0.7, col="#f1efea"):
    r = wall(name, x, y, z, side)
    R(name + "_bar", 0, 0.08, 0, w, 0.02, 0.02, mt["brass"], 0.008, r)
    R(name + "_towel", 0, 0.09, -0.55, w - 0.12, 0.05, 0.6, M("Towel_" + col, col, 0.95), 0.02, r)
    return r


def bath_floor(name, x1, y1, x2, y2, z):
    I.box(name, x1, x2, y1, y2, z, z + 0.008, tile_mat("BathFloor", "#e4e1da", "#d8d4cc", 0.6))


def wainscot(name, x1, y1, x2, y2, z, h=1.2):
    t = tile_mat("BathWallTile", "#f2f0ea", "#e6e2da", 0.15, 0.003)
    for (a, b, c, d) in ((x1, x2, y1, y1 + 0.012), (x1, x2, y2 - 0.012, y2), (x1, x1 + 0.012, y1, y2), (x2 - 0.012, x2, y1, y2)):
        I.box(f"{name}{a:.1f}{c:.1f}", a, b, c, d, z, z + h, t)


# ---------------------------------------------------------------- rooms
def master_suite(mt):
    z = 0.0
    remove(("MasterBed", "MasterNS", "MasterBench", "MasterLounge", "MasterRug", "MasterChand"))
    I.rug("MasterRug2", 12.0, 15.6, 24.0, 27.6, z, "#2e2e30", "#8a7550")
    big_bed("MBed", 13.75, 23.08, z, "S", 2.0, 2.15)
    nightstand2("MNSL", 12.35, 23.08, z, "S", mt)
    nightstand2("MNSR", 15.15, 23.08, z, "S", mt, phone=False)
    art("MArt", 13.75, 23.08, z + 1.65, "S", 1.6, 0.9, (0.42, 0.6))
    bn = root("MBench", 13.75, 25.6, z, 0)
    R("MBenchSeat", 0, 0, 0.3, 1.5, 0.45, 0.16, Fu.fabric("velvet", "#b08d57"), 0.05, bn)
    for sx in (-1, 1):
        R(f"MBenchLeg{sx}", sx * 0.68, 0, 0, 0.04, 0.4, 0.3, mt["brass"], 0.004, bn)
    dresser("MDresser", 15.92, 26.3, z, "E", mt, 1.6, tv_in=65)
    armchair_lamp("MChair", 15.25, 28.25, z, 220, mt, "#1d2b3a")
    I.point_light("MasterFill", (13.8, 26.0, ZC1 - 0.3), 80, 0.8)
    # master bath (8–11.5 x 23–29): tub under the west window, shower NW corner, double vanity on the partition
    bath_floor("MBathFloor", 8.15, 23.15, 11.42, 28.85, z)
    wainscot("MBathWain", 8.16, 23.16, 11.42, 28.84, z, 1.2)
    tub("MTub", 8.75, 25.75, z, 0, mt)
    shower("MShower", 8.16, 27.3, 9.45, 28.84, z, ZC1 - 0.05, ("E", "S"), mt, "N")
    vanity("MVanity", 11.42, 25.9, z, "E", mt, 2.0, 2)
    toilet("MToilet", 10.6, 28.84, z, "N", mt)
    towel_bar("MTowel", 9.9, 23.16, z + 1.3, "S", mt, 0.8)
    P.place("potted_plant_02", (11.0, 23.6, z), 0, 0.8, coll=COLL, name="MBathPlant")
    R("MBathMat", 10.5, 25.9, z + 0.008, 0.6, 1.1, 0.012, Fu.fabric("linen", "#ece6da"), 0.01)
    I.point_light("MBathFill", (9.8, 26.0, ZC1 - 0.3), 60, 0.8)
    # walk-in closet (13–16 x 21–23 and 13–15 x 19–21)
    rnd = random.Random(8)
    clothes_rail("MCloset1", 13.08, 21.9, z, "W", 1.6, mt, rnd)
    clothes_rail("MCloset2", 15.92, 22.0, z, "E", 1.8, mt, rnd)
    clothes_rail("MCloset3", 14.0, 19.08, z, "S", 1.7, mt, rnd)
    I.point_light("ClosetL", (14.3, 21.2, ZC1 - 0.3), 40, 0.5)


def ensuite(prefix, x1, y1, x2, y2, z, zc, mt, door_side, layout):
    """Compact en-suite: shower at one end, vanity + toilet on the long walls."""
    bath_floor(prefix + "Floor", x1 + 0.08, y1 + 0.08, x2 - 0.08, y2 - 0.08, z)
    wainscot(prefix + "Wain", x1 + 0.08, y1 + 0.08, x2 - 0.08, y2 - 0.08, z, 1.2)
    layout(prefix, x1 + 0.08, y1 + 0.08, x2 - 0.08, y2 - 0.08, z, zc)
    I.point_light(prefix + "Fill", ((x1 + x2) / 2, (y1 + y2) / 2, zc - 0.3), 45, 0.6)


def sitting_area(tag, x, y, z, rot, mt, sofa_col="#22392f", rug=("#2e2e30", "#8a7550")):
    """Loveseat + two chairs + round table on a rug, centred at (x, y); rot turns the group."""
    st = dict(Fu.style())
    st["sofa"] = ("velvet", sofa_col)
    a = math.radians(rot)
    def at(dx, dy):
        return x + dx * math.cos(a) - dy * math.sin(a), y + dx * math.sin(a) + dy * math.cos(a)
    I.rug(tag + "SitRug", x - 1.3, x + 1.3, y - 1.1, y + 1.1, z, *rug)
    sx, sy = at(0, -0.65)
    s = Fu.sofa(tag + "Loveseat", sx, sy, z, rot, 1.8, 0.9, st)
    Fu.pillow(tag + "LSPil0", -0.45, -0.24, 0.5, "#b08d57", s)
    Fu.pillow(tag + "LSPil1", 0.45, -0.24, 0.5, "#e9e4da", s)
    tx, ty = at(0, 0.35)
    Fu.coffee_table(tag + "SitTable", tx, ty, z, st, 0.9, 0.6)
    for k, dx in enumerate((-0.75, 0.75)):
        cx, cy = at(dx, 1.05)
        Fu.accent_chair(f"{tag}SitChair{k}", cx, cy, z, rot + 180 + (25 if k == 0 else -25), st)


def plant(name, x, y, z, s=1.0, kind="potted_plant_01"):
    P.place(kind, (x, y, z), random.Random(hash(name) & 0xff).uniform(0, 360), s, coll=COLL, name=name)


def bedrooms(mt):
    remove(("Bed2Bed", "Bed2NS", "Bed2Rug", "Bed2Bench", "Bed4Bed", "Bed4NS", "Bed4Rug", "Bed4Chair",
            "GuestBed", "GuestNS", "GuestRug", "GuestChair", "GuestPlant"))
    rnd = random.Random(12)
    # ---- bed 2 (upper, 8–15 x 13.5–21; bath 8–10.4 x 18.4–21)
    z = F1
    I.rug("Bed2Rug2", 11.0, 14.4, 17.0, 20.2, z, "#d9d0c1", "#1d2b3a")
    big_bed("B2Bed", 12.7, 20.92, z, "N", 1.8, 2.1, head_col="#1d2b3a", throw_col="#b08d57")
    nightstand2("B2NSL", 11.35, 20.92, z, "N", mt)
    nightstand2("B2NSR", 14.05, 20.92, z, "N", mt, phone=False)
    d = wall("B2Desk", 8.08, 16.4, z, "W")
    R("B2DeskTop", 0, 0.3, 0.74, 1.4, 0.6, 0.04, mt["walnut"], 0.004, d)
    for sx in (-1, 1):
        R(f"B2DeskLeg{sx}", sx * 0.66, 0.3, 0, 0.04, 0.56, 0.74, mt["brass"], 0.003, d)
    P.place("classic_laptop", (8.5, 16.4, z + 0.78), 90, coll=COLL, name="B2Laptop")
    P.place("desk_lamp_arm_01", (8.3, 15.9, z + 0.78), 90, coll=COLL, name="B2DeskLamp")
    Fu.accent_chair("B2DeskChair", 9.0, 16.4, z, 90, dict(Fu.style(), chair=("velvet", "#b08d57")))
    dresser("B2Dresser", 14.92, 16.3, z, "E", mt, 1.6, tv_in=55)
    armchair_lamp("B2Chair", 14.3, 14.2, z, 225, mt, "#6b2e2a")
    sitting_area("B2", 11.4, 15.2, z, 0, mt, "#1d2b3a")
    art("B2Art", 12.7, 20.92, z + 1.65, "N", 1.4, 0.8, (0.7, 0.55))
    plant("B2Plant", 14.55, 20.5, z, 1.2, "potted_plant_02")
    plant("B2Plant2", 8.5, 14.0, z, 1.1)
    # ---- bed 3: teen gamer room (upper, 8–16 x 21–29; bath 8–10.6 x 21–23.4)
    I.rug("B3Rug", 12.0, 15.6, 24.2, 27.8, z, "#2e2e30", "#3a6ea5")
    big_bed("B3Bed", 15.92, 26.0, z, "E", 1.6, 2.05, head_col="#2e2e30", duvet="#e9edf2", throw_col="#3a6ea5",
            pillow_cols=("#e9edf2", "#e9edf2", "#3a6ea5", "#2e2e30"))
    nightstand2("B3NS", 15.92, 24.6, z, "E", mt)
    dk = wall("B3Desk", 8.08, 27.7, z, "W")
    R("B3DeskTop", 0, 0.38, 0.74, 1.7, 0.75, 0.035, mt["black"], 0.004, dk)
    for sx in (-1, 1):
        R(f"B3DeskLeg{sx}", sx * 0.8, 0.38, 0, 0.06, 0.7, 0.74, mt["black"], 0.004, dk)
    for k, dx in enumerate((-0.33, 0.33)):
        m = R(f"B3Monitor{k}", dx, 0.12, 1.0, 0.62, 0.03, 0.37, mt["black"], 0.004, dk)
        m.rotation_euler.z = math.radians(-12 if k == 0 else 12)
        p_ = panel(f"B3MonScr{k}", 0.6, 0.34, screen_mat(f"B3Screen{k}", (0.25 + 0.4 * k, 0.5), 0.12, 1.4), dk, 0.137 + 0.0, 1.015, dx)
        p_.rotation_euler.z = math.radians(-12 if k == 0 else 12)
        R(f"B3MonStand{k}", dx, 0.12, 0.775, 0.04, 0.04, 0.24, mt["black"], 0.004, dk)
    R("B3Keyboard", 0, 0.42, 0.775, 0.44, 0.14, 0.02, mt["black"], 0.004, dk)
    R("B3KeyRGB", 0, 0.42, 0.776, 0.45, 0.15, 0.004, glow("RGBStrip", "#7a4dff", 4.0), 0.0, dk)
    R("B3Mouse", 0.32, 0.45, 0.775, 0.06, 0.11, 0.035, mt["black"], 0.02, dk)
    R("B3MousePad", 0.15, 0.42, 0.775, 0.85, 0.35, 0.003, M("MousePad", "#1b1b1b", 0.8), 0.0, dk)
    pcx = dk.matrix_world @ Vector((0.75, 0.4, 0.0))
    pc = root("B3PC", pcx.x, pcx.y, z, -90)
    R("B3PCCase", 0, 0, 0, 0.23, 0.48, 0.5, mt["black"], 0.006, pc)
    R("B3PCGlass", 0.116, 0, 0.03, 0.002, 0.44, 0.44, M("PCGlass", "#20242a", 0.05), 0.0, pc)
    for k in range(3):
        Fu._cyl(f"B3Fan{k}", 0.0, -0.23, 0.08 + k * 0.14, 0.1 + k * 0.14, 0.055, glow("FanRGB", ["#00e5ff", "#ff2bd6", "#7a4dff"][k], 6.0), pc, 24)
    I.point_light("B3RGB", (pcx.x + 0.3, pcx.y, z + 0.3), 8, 0.1, (0.6, 0.3, 1.0))
    gc = root("B3GamingChair", 9.15, 27.7, z, 90)
    blk = Fu.fabric("leather", "#151515")
    R("GCSeat", 0, 0.05, 0.45, 0.55, 0.52, 0.12, blk, 0.04, gc)
    R("GCBack", 0, -0.24, 0.55, 0.55, 0.12, 0.85, blk, 0.05, gc)
    R("GCStripe", 0, -0.175, 0.7, 0.14, 0.01, 0.6, M("GCRed", "#b3161d", 0.4), 0.0, gc)
    Fu._cyl("GCPost", 0, 0, 0.08, 0.45, 0.03, mt["chrome"], gc, 12)
    for k in range(5):
        a = k * 2 * math.pi / 5
        leg = R(f"GCLeg{k}", 0.17 * math.cos(a), 0.17 * math.sin(a), 0.05, 0.34, 0.04, 0.03, mt["black"], 0.01, gc)
        leg.rotation_euler.z = a
    ps5_pro("B3PS5", 11.3, 28.62, z + 0.48, 180, mt)
    tv("B3TV", 11.75, 28.86, z + 0.85, "N", 55, mt)
    tc = wall("B3TVConsole", 11.75, 28.86, z, "N")
    R("B3TVConsoleBody", 0, 0.22, 0.08, 1.2, 0.42, 0.4, mt["oak"], 0.005, tc)
    shelf = wall("B3Shelf", 11.9, 21.08, z, "S")
    R("B3ShelfBody", 0, 0.17, 0, 1.6, 0.34, 1.9, mt["oak"], 0.004, shelf)
    for k in range(5):
        R(f"B3ShelfBoard{k}", 0, 0.17, 0.05 + k * 0.42, 1.56, 0.3, 0.02, mt["oak"], 0.0, shelf)
        xx = -0.7
        while xx < 0.7:
            w_ = rnd.uniform(0.02, 0.045)
            R(f"B3Book{k}_{xx:.2f}", xx, 0.17, 0.07 + k * 0.42, w_, 0.22, rnd.uniform(0.2, 0.3),
              Fu.fabric("linen", rnd.choice(["#1d2b3a", "#b3161d", "#f2c700", "#efe6d6", "#2e2e30", "#3a6ea5"])), 0.002, shelf)
            xx += w_ + 0.004
            if rnd.random() < 0.08:
                xx += 0.2
    s3 = Fu.sofa("B3Couch", 11.75, 25.9, z, 0, 2.0, 0.9, dict(Fu.style(), sofa=("velvet", "#2e2e30")))
    Fu.pillow("B3CouchPil0", -0.5, -0.24, 0.5, "#3a6ea5", s3)
    Fu.pillow("B3CouchPil1", 0.5, -0.24, 0.5, "#b3161d", s3)
    ot = root("B3Ottoman", 11.75, 27.2, z, 0)
    R("B3OttomanBody", 0, 0, 0.04, 1.0, 0.55, 0.36, Fu.fabric("leather", "#3a2a1e"), 0.05, ot)
    controller("B3Pad", 11.6, 27.15, z + 0.4, 25, mt["plastic_w"], mt["plastic_b"])
    switch("B3Switch", 12.0, 28.62, z + 0.48, 180, mt)
    R("B3LEDStrip", 11.75, 28.84, z + 2.6, 4.0, 0.02, 0.02, glow("RGBStripBlue", "#4d7dff", 5.0), 0.0)
    shelf2 = wall("B3WallShelf", 15.92, 23.7, z + 1.6, "E")
    R("B3WallShelfBoard", 0, 0.12, 0, 0.9, 0.24, 0.025, mt["oak"], 0.003, shelf2)
    for k, col in enumerate(("#b3161d", "#f2c700", "#3a6ea5", "#2e2e30")):
        R(f"B3Figure{k}", -0.3 + k * 0.2, 0.12, 0.025, 0.07, 0.07, 0.16 + 0.03 * k, glossy("Fig" + col, col, 0.3), 0.02, shelf2)
    plant("B3Plant", 9.0, 28.5, z, 1.1, "potted_plant_02")
    bb = root("B3BeanBag", 11.3, 22.7, z, 30)
    R("B3BeanBagBody", 0, 0, 0, 0.9, 0.9, 0.55, Fu.fabric("velvet", "#3a6ea5"), 0.3, bb)
    for k, (yy, uv) in enumerate(((27.9, (0.2, 0.55)), (28.55, (0.7, 0.5)))):
        art(f"B3Poster{k}", 15.92, yy, z + 1.35, "E", 0.6, 0.85, uv)
    # ---- bed 4 (upper) and guest (ground): same footprint, en-suite at 32.1–34 x 18.8–22
    for tag, zz, head, thr in (("B4", F1, "#1d2b3a", "#b08d57"), ("GS", 0.0, "#22392f", "#6b2e2a")):
        I.rug(tag + "Rug", 28.9, 31.6, 16.4, 20.6, zz, "#d9d0c1", "#8a7550")
        big_bed(tag + "Bed", 30.05, 21.92, zz, "N", 1.6, 2.05, head_col=head, throw_col=thr)
        nightstand2(tag + "NSL", 28.86, 21.92, zz, "N", mt)
        nightstand2(tag + "NSR", 31.25, 21.92, zz, "N", mt, phone=False)
        dresser(tag + "Dresser", 28.58, 11.0, zz, "W", mt, 1.6, tv_in=55)
        wardrobe(tag + "Wardrobe", 28.58, 14.2, zz, "W", mt, 2.4, 2.4 if zz else 2.6)
        lr = root(tag + "Luggage", 33.0, 17.4, zz, 90)
        R(tag + "LuggageRack", 0, 0, 0.45, 0.65, 0.45, 0.04, mt["oak"], 0.004, lr)
        for sx in (-1, 1):
            R(f"{tag}LugLeg{sx}", sx * 0.3, 0, 0, 0.03, 0.42, 0.45, mt["oak"], 0.004, lr)
        R(tag + "Suitcase", 0, 0, 0.49, 0.55, 0.38, 0.24, glossy("Suitcase", "#9a7b55", 0.3), 0.03, lr)
        I.point_light(tag + "Fill", (30.6, 16.0, zz + 3.0), 70, 0.8)
        sitting_area(tag, 31.0, 13.4, zz, 90, mt, "#22392f" if tag == "B4" else "#1d2b3a")
        art(tag + "Art", 30.05, 21.92, zz + 1.65, "N", 1.3, 0.75, (0.3 + (0.3 if tag == "B4" else 0), 0.55))
        plant(tag + "Plant", 28.95, 9.45, zz, 1.2, "potted_plant_02")


def baths(mt):
    def b2(p, x1, y1, x2, y2, z, zc):                       # bed2 en-suite: shower west end, vanity south, toilet east
        shower(p + "Sh", x1, y1 + 1.3, x1 + 1.0, y2, z, zc - z - 0.05, ("E", "S"), mt, "W")
        vanity(p + "Van", (x1 + x2) / 2 + 0.2, y1, z, "S", mt, 1.2, 1)
        toilet(p + "WC", x1 + 1.67, y2, z, "N", mt)
        towel_bar(p + "Towel", x1, y1 + 0.6, z + 1.3, "W", mt, 0.6)

    def b3(p, x1, y1, x2, y2, z, zc):
        shower(p + "Sh", x1, y1, x1 + 1.0, y1 + 1.2, z, zc - z - 0.05, ("E", "N"), mt, "W")
        vanity(p + "Van", (x1 + x2) / 2 + 0.3, y2, z, "N", mt, 1.2, 1)
        toilet(p + "WC", x2, y2 - 0.55, z, "E", mt)
        towel_bar(p + "Towel", x1 + 1.6, y1, z + 1.3, "S", mt, 0.6, "#3a6ea5")

    def b4(p, x1, y1, x2, y2, z, zc):                       # 1.9 x 3.2: shower at the north end
        shower(p + "Sh", x1, y2 - 1.0, x2, y2, z, zc - z - 0.05, ("S",), mt, "N")
        vanity(p + "Van", x2, y1 + 1.15, z, "E", mt, 1.0, 1)
        toilet(p + "WC", x1, y1 + 1.1, z, "W", mt)
        towel_bar(p + "Towel", x2, y1 + 0.35, z + 1.3, "E", mt, 0.5)

    ensuite("Bath2", 8, 18.4, 10.4, 21, F1, EAVE, mt, "E", b2)
    ensuite("Bath3", 8, 21, 10.6, 23.4, F1, EAVE, mt, "E", b3)
    ensuite("Bath4", 32.1, 18.8, 34, 22, F1, EAVE, mt, "S", b4)
    ensuite("GBath", 32.1, 18.8, 34, 22, 0.0, ZC1, mt, "S", b4)
    # powder room (22–25.5 x 19–22): statement vanity, dark walls, sconces, toilet
    z = 0.0
    bath_floor("PowderFloor", 22.08, 19.08, 25.42, 21.92, z)
    I.box("PowderWallNs", 21.95, 25.5, 21.92, 22.05, z, ZC1, I.M["plaster_int"])
    I.box("PowderWallWs", 21.95, 22.08, 19.0, 22.05, z, ZC1, I.M["plaster_int"])
    I.box("PowderWallN", 22.08, 25.42, 21.915, 21.92, z, ZC1, M("PowderWall", "#22392f", 0.85))
    I.box("PowderWallW", 22.08, 22.085, 19.08, 21.92, z, ZC1, M("PowderWall", "#22392f", 0.85))
    vanity("PowderVan", 23.6, 21.915, z, "N", mt, 1.1, 1, 1.0)
    toilet("PowderWC", 22.085, 20.3, z, "W", mt)
    P.place("potted_plant_04", (25.1, 21.6, z), 0, 0.6, coll=COLL, name="PowderPlant")
    I.point_light("PowderFill", (23.7, 20.5, ZC1 - 0.3), 30, 0.5)


def kitchen_life(mt):
    z = 0.94
    sm = root("StandMixer", 33.35, 23.3, z, 90)
    red = glossy("MixerRed", "#a3161d", 0.2, 0.2)
    R("MixerBase", 0, 0, 0, 0.18, 0.3, 0.04, red, 0.02, sm)
    R("MixerPillar", 0, -0.1, 0.04, 0.12, 0.1, 0.25, red, 0.04, sm)
    R("MixerHead", 0, 0.0, 0.27, 0.15, 0.36, 0.13, red, 0.06, sm)
    Fu._cyl("MixerBowl", 0, 0.06, 0.04, 0.2, 0.1, mt["steel"], sm, 32)
    kb = root("KnifeBlock", 33.45, 24.5, z, 90)
    R("KnifeBlockBody", 0, 0, 0, 0.12, 0.2, 0.24, mt["walnut"], 0.01, kb)
    for k in range(5):
        R(f"KnifeHandle{k}", -0.03 + (k % 2) * 0.03, -0.06 + k * 0.03, 0.24, 0.018, 0.022, 0.11, mt["black"], 0.006, kb)
    Fu._cyl("UtensilCrock", 33.42, 26.5, z, z + 0.17, 0.065, mt["ceramic"], None, 24)
    for k in range(5):
        u = R(f"Utensil{k}", 0, 0, 0, 0.02, 0.02, 0.3, mt["walnut"] if k % 2 else mt["black"], 0.006)
        u.location = (33.42 + 0.02 * math.cos(k), 26.5 + 0.02 * math.sin(k), z + 0.05)
        u.rotation_euler = (math.radians(8 * math.cos(k * 1.3)), math.radians(8 * math.sin(k * 1.3)), 0)
    P.place("brass_pot_01", (33.3, 25.25, 0.95), 0, coll=COLL, name="RangePot")
    P.place("wooden_cutting_board", (33.35, 28.8, z), 90, coll=COLL, name="CutBoard2")
    P.place("bananas", (30.4, 25.0, 0.95), 30, coll=COLL, name="IslandBananas")
    P.place("food_apple_01", (30.95, 25.45, 1.06), 0, coll=COLL, name="IslandApple")
    P.place("tea_set_01", (28.9, 25.05, 0.95), 0, coll=COLL, name="IslandTea")
    tt = root("Toaster", 33.4, 27.25, z, 90)
    R("ToasterBody", 0, 0, 0, 0.18, 0.3, 0.2, mt["steel"], 0.04, tt)
    for k in range(2):
        R(f"ToasterSlot{k}", 0, -0.06 + k * 0.12, 0.2, 0.12, 0.02, 0.003, mt["black"], 0.0, tt)
    for k, x in enumerate((26.6, 27.2, 28.9)):
        Fu._cyl(f"HerbPot{k}", x, 29.0, 0.9, 1.02, 0.07, glossy("HerbPot", "#e8e1d4", 0.3), None, 24)
        sphere(f"Herb{k}", x, 29.0, 1.1, 0.09, M("Herb", "#4d7a3a", 0.7, sss=0.2))
    R("DishTowel", 0, 0, 0, 0.012, 0.26, 0.45, Fu.fabric("linen", "#1d2b3a"), 0.004).location = (33.0, 25.4, 0.27)


def dining_life(mt):
    rnd = random.Random(4)
    plate = glossy("Plate", "#f7f6f2", 0.15)
    for k, (x, y) in enumerate([(24.25, 13.6), (24.25, 14.8), (24.25, 16.0), (26.25, 13.6), (26.25, 14.8), (26.25, 16.0),
                                (25.25, 12.75), (25.25, 16.85)]):
        px = x + (0.42 if x < 25 else -0.42) if x != 25.25 else x
        py = y if x != 25.25 else y + (0.42 if y < 14 else -0.42)
        Fu._cyl(f"Plate{k}", px, py, 0.79, 0.805, 0.14, plate, None, 32)
        Fu._cyl(f"Charger{k}", px, py, 0.79, 0.795, 0.17, mt["brass"], None, 32)
        Fu._cyl(f"Napkin{k}", px, py, 0.805, 0.82, 0.06, Fu.fabric("linen", "#22392f"), None, 6)
        gx, gy = px + (0.12 if x != 25.25 else 0.15), py + (0.15 if x != 25.25 else 0.12)
        Fu._cyl(f"WGlass{k}", gx, gy, 0.79, 0.95, 0.035, mt["glass"], None, 16)
    for k, y in enumerate((14.2, 15.4)):
        Fu._cyl(f"Candlestick{k}", 25.25, y, 0.79, 0.99, 0.02, mt["brass"], None, 12)
        Fu._cyl(f"Taper{k}", 25.25, y, 0.99, 1.24, 0.011, M("Candle", "#f1ebe0", 0.5, sss=0.4), None, 12)
    Fu._cyl("CenterBowl", 25.25, 14.8, 0.79, 0.89, 0.2, M("BowlBlack", "#1a1a1a", 0.3), None, 32)
    for k in range(6):
        sphere(f"CenterFruit{k}", 25.25 + 0.1 * math.cos(k), 14.8 + 0.1 * math.sin(k), 0.93, 0.045, M("Pear", "#b9a33a", 0.5))


def study_life(mt):
    remove(("StudyRug",))
    P.place("classic_laptop", (11.4, 16.45, 0.79), 180, coll=COLL, name="StudyLaptop")
    P.place("desk_lamp_arm_01", (10.85, 16.7, 0.79), 200, coll=COLL, name="StudyDeskLamp")
    P.place("stationery_supplies", (12.3, 16.75, 0.79), 0, coll=COLL, name="StudyStationery")
    P.place("mantel_clock_01", (12.0, 18.6, 1.4), 180, coll=COLL, name="StudyClock")
    I.rug("StudyRug2", 9.3, 13.9, 14.6, 18.0, 0.0, "#2e2e30", "#8a7550")


def media_life(mt):
    remove(("MediaSofa", "MediaRug"))
    I.rug("MediaRug2", 23.2, 27.3, 12.4, 17.6, F1, "#2e2e30", "#8a7550")
    s = Fu.sofa("MediaSofa2", 25.25, 13.3, F1, 0, 3.0, 1.0)
    for k, (dx, c) in enumerate(((-1.0, "#b08d57"), (-0.5, "#e9e4da"), (0.6, "#1d2b3a"), (1.05, "#6b2e2a"))):
        Fu.pillow(f"MediaPil{k}", dx, -0.28, 0.5, c, s)
    Fu.throw("MediaThrow", 23.95, 13.5, F1 + 0.62, 0, "#b08d57")
    R("MediaSoundbar", 25.25, 19.75, F1 + 0.52, 1.0, 0.1, 0.06, mt["black"], 0.02)
    xbox("MediaXbox", 23.9, 19.6, F1 + 0.5, 180, mt)
    controller("MediaPad", 25.0, 14.9, F1 + 0.43, 30, mt["plastic_b"], mt["plastic_b"])


def build(materials, coll):
    global COLL
    COLL = coll
    I.COLL, I.M = coll, materials
    mt = mats()
    game_room(mt)
    gym(mt)
    master_suite(mt)
    bedrooms(mt)
    baths(mt)
    kitchen_life(mt)
    dining_life(mt)
    study_life(mt)
    media_life(mt)
