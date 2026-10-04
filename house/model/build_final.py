"""Photoreal build: real house construction + PBR materials + HDRI lighting (+ landscape / interiors
as those modules come online). Output: house/model/final.blend and house/renders/final/*.png

  python build_final.py --views front --preview      # quick check
  python build_final.py --views front,lake           # full quality
  python build_final.py --samples 256 --scale 1.0
"""
import math
import os
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import assets  # noqa: E402
import build_massing as bm  # noqa: E402
import details  # noqa: E402
import facade  # noqa: E402
import front_yard  # noqa: E402
import interiors  # noqa: E402
import armory  # noqa: E402
import lowerlevel  # noqa: E402
import rich  # noqa: E402
import rear_yard  # noqa: E402
import outdoor  # noqa: E402
import outdoor2  # noqa: E402
import vehicles  # noqa: E402
import house_real  # noqa: E402
import materials_pbr  # noqa: E402

OUT_DIR = os.environ.get("RENDER_OUT", os.path.join(HERE, "..", "renders", "final"))
OUT_BLEND = os.path.join(HERE, "final.blend")

# per view: lighting mode and where the sun (or the sunset glow) sits, as a compass azimuth
# (degrees clockwise from north = +Y). Hero views place the glow where it flatters the shot.
LIGHT = {
    "front": ("dusk", 200), "front_close": ("dusk", 200), "lake": ("dusk", 15), "pool": ("day", 250), "lawn": ("day", 235),
    "garden": ("day", 250), "aerial": ("day", 225),
    "int_great": ("inside", 235), "int_loft": ("inside", 235), "int_stair": ("inside", 160),
    "int_game": ("inside", 235), "int_kitchen": ("inside", 235), "int_media": ("inside", 160),
    "int_armory": ("inside", 235), "int_secret": ("inside", 235), "int_living": ("inside", 235),
    "int_game2": ("inside", 235), "int_master": ("inside", 235), "int_mbath": ("inside", 235),
    "int_bed2": ("inside", 235), "int_bed3": ("inside", 235), "int_bed4": ("inside", 160), "int_guest": ("inside", 160),
    "int_powder": ("inside", 235), "int_bath2": ("inside", 235), "int_bath4": ("inside", 160), "int_dining": ("inside", 160),
    "int_closet": ("inside", 235),
    "heli": ("day", 60), "dock": ("day", 300),
    "int_cinema": ("inside", 0, 0.8), "int_wine": ("inside", 0, 0.6), "int_gym": ("inside", 0, 0.6),
}
EXTRA_VIEWS = {
    # name: (location, target, lens, resolution, shift_y)
    "front_close": ((24.0, 2.0, 1.5), (17.0, 13.5, 4.8), 20, (1600, 1600), 0.08),
    # interiors, framed like the video: great room from the 2F gallery, the loft over the void, stair + rings ...
    "int_great": ((18.3, 20.55, 5.75), (21.3, 29.0, 2.3), 15, (1600, 1100), 0.0),
    "int_loft": ((18.2, 19.9, 5.65), (29.5, 27.3, 5.3), 16, (1600, 1100), 0.0),
    "int_stair": ((16.0, 13.85, 1.5), (19.6, 17.2, 3.7), 14, (1200, 1600), 0.0),
    "int_game": ((25.9, 22.35, 5.6), (31.5, 29.3, 6.2), 14, (1600, 1100), 0.0),
    "int_kitchen": ((26.05, 28.95, 1.6), (33.0, 23.4, 1.0), 16, (1600, 1100), 0.0),
    "int_media": ((27.9, 10.95, 5.55), (24.6, 19.9, 5.3), 16, (1600, 1100), 0.0),
    "int_living": ((16.45, 21.75, 1.5), (21.0, 27.7, 1.15), 17, (1600, 1100), 0.0),
    "int_game2": ((26.2, 28.4, 5.65), (31.2, 22.6, 4.85), 16, (1600, 1100), 0.0),
    "int_master": ((12.05, 28.6, 1.6), (14.3, 23.4, 1.0), 16, (1600, 1100), 0.0),
    "int_mbath": ((11.15, 23.45, 1.6), (8.6, 27.6, 1.0), 15, (1600, 1100), 0.0),
    "int_closet": ((14.5, 22.85, 1.6), (14.2, 19.3, 1.2), 15, (1600, 1100), 0.0),
    "int_bed2": ((11.6, 13.85, 5.65), (12.6, 20.6, 4.9), 17, (1600, 1100), 0.0),
    "int_bed3": ((15.2, 22.3, 5.55), (9.6, 27.9, 4.95), 18, (1600, 1100), 0.0),
    "int_bed4": ((29.3, 15.4, 5.6), (31.2, 21.6, 4.9), 16, (1600, 1100), 0.0),
    "int_guest": ((29.3, 15.4, 1.6), (31.2, 21.6, 0.9), 16, (1600, 1100), 0.0),
    "int_powder": ((25.3, 19.3, 1.6), (22.5, 21.6, 1.15), 14, (1600, 1100), 0.0),
    "int_bath2": ((10.2, 20.6, 5.65), (8.3, 18.9, 4.95), 14, (1600, 1100), 0.0),
    "int_bath4": ((32.3, 18.95, 5.6), (33.6, 21.7, 4.9), 13, (1600, 1100), 0.0),
    "int_dining": ((27.9, 11.2, 1.6), (24.2, 16.8, 1.0), 18, (1600, 1100), 0.0),
    "int_armory": ((12.55, 19.95, 1.65), (8.6, 22.6, 1.2), 14, (1600, 1100), 0.0),
    "int_secret": ((11.0, 14.9, 1.5), (10.45, 21.5, 1.3), 20, (1200, 1500), 0.0),
    "heli": ((79.0, 63.5, -1.75), (65.0, 49.0, -2.0), 28, (1600, 900), 0.0),
    "dock": ((62.0, 136.0, -3.55), (42.0, 114.0, -2.6), 28, (1600, 900), 0.0),
    "int_cinema": ((15.5, 22.45, -2.15), (11.3, 14.0, -2.6), 16, (1600, 1100), 0.0),
    "int_wine": ((25.1, 21.95, -2.3), (17.4, 16.2, -2.35), 15, (1600, 1100), 0.0),
    "int_gym": ((28.6, 9.75, -2.15), (30.6, 21.0, -2.75), 16, (1600, 1100), 0.0),
}

REPLACED_PREFIX = ("Main_", "StoneGable_", "BrickWing_", "EastGable_", "RearGable_", "Dormer2", "Dormer3")
KEEP = {"DormerWin0", "DormerWin1"}      # replaced by dormer_windows() once the facade is built


def parse():
    a = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    opt = {"views": None, "preview": "--preview" in a, "samples": None, "scale": None, "noinst": "--no-interior" in a}
    for k in ("views", "samples", "scale"):
        if f"--{k}" in a:
            opt[k] = a[a.index(f"--{k}") + 1]
    return opt


# ---------------------------------------------------------------- lighting
def hdri_sun_angle(key):
    """Equirect column of the brightest sky pixel -> angle (rad, from +X toward +Y) in HDRI space."""
    img = bpy.data.images.load(assets.hdri(key, "1k"), check_existing=False)    # private copy: removed below
    w, h = img.size
    px = img.pixels[:]
    best, bu = -1.0, 0
    for y in range(h // 2, h, 2):                 # upper hemisphere (image rows bottom-up)
        row = y * w * 4
        for x in range(0, w, 2):
            i = row + x * 4
            lum = px[i] * 0.2126 + px[i + 1] * 0.7152 + px[i + 2] * 0.0722
            if lum > best:
                best, bu = lum, x
    u = (bu + 0.5) / w
    bpy.data.images.remove(img)
    return -(u - 0.5) * 2 * math.pi


SUN_CACHE = {}


def set_world(key, compass_deg, strength, exposure):
    scn = bpy.context.scene
    w = scn.world or bpy.data.worlds.new("World")
    scn.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    env = nt.nodes.new("ShaderNodeTexEnvironment")
    env.image = bpy.data.images.load(assets.hdri(key, "4k"), check_existing=True)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    if key not in SUN_CACHE:
        SUN_CACHE[key] = hdri_sun_angle(key)
    phi = math.radians(90 - compass_deg)           # compass -> angle from +X toward +Y
    mp.inputs["Rotation"].default_value[2] = SUN_CACHE[key] - phi
    nt.links.new(tc.outputs["Generated"], mp.inputs["Vector"])
    nt.links.new(mp.outputs["Vector"], env.inputs["Vector"])
    nt.links.new(env.outputs["Color"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = strength
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
    scn.view_settings.exposure = exposure


def dusk_sun(on, compass_deg=200, elev=7.0):
    """Low, warm, soft key light for the golden-hour look (the puresky HDRI's sun sits on the horizon)."""
    o = bpy.data.objects.get("DuskSun")
    if o is None:
        L = bpy.data.lights.new("DuskSun", "SUN")
        o = bpy.data.objects.new("DuskSun", L)
        bpy.context.scene.collection.objects.link(o)
    o.data.energy = float(os.environ.get("SUN_E", 1.2))
    o.data.color = (1.0, 0.64, 0.38)
    o.data.angle = math.radians(8)
    o.hide_render = not on
    bm.aim(o, compass_deg, elev)


def room_lights(rooms, coll, warm=(1.0, 0.70, 0.45), w_per_m2=float(os.environ.get("ROOM_W", 35))):
    for name, (x1, y1, x2, y2, zf, zc, kind) in rooms.items():
        zc = zc if zc is not None else zf + 3.2
        L = bpy.data.lights.new("RL_" + name, "AREA")
        L.shape = "RECTANGLE"
        L.size, L.size_y = max(0.5, (x2 - x1) * 0.55), max(0.5, (y2 - y1) * 0.55)
        L.energy = w_per_m2 * (x2 - x1) * (y2 - y1)
        L.color = warm
        o = bpy.data.objects.new("RL_" + name, L)
        o.location = ((x1 + x2) / 2, (y1 + y2) / 2, zc - 0.05)
        coll.objects.link(o)


def porch_lights(coll):
    """Real light sources in the wall lanterns and porch-ceiling cans."""
    for i, (x, y) in enumerate([(8.75, 13.15), (14.65, 13.15), (15.55, 12.85), (20.55, 12.85)]):
        L = bpy.data.lights.new(f"Lantern{i}", "POINT")
        L.energy, L.color, L.shadow_soft_size = 90, (1.0, 0.66, 0.36), 0.08
        o = bpy.data.objects.new(f"LanternL{i}", L)
        o.location = (x, y, 2.3)
        coll.objects.link(o)
    for i, x in enumerate((10.2, 13.6, 17.0, 20.2)):
        L = bpy.data.lights.new(f"PorchCan{i}", "SPOT")
        L.energy, L.color, L.spot_size, L.spot_blend, L.shadow_soft_size = 60, (1.0, 0.75, 0.5), math.radians(80), 0.6, 0.05
        o = bpy.data.objects.new(f"PorchCan{i}", L)
        o.location = (x, 11.9, 3.35)
        coll.objects.link(o)


def dormer_windows(M, coll):
    """Real windows in the two west-wing dormers (cream casing, black frame, 2x2 lites, dark room behind)."""
    for i, x in enumerate((9.2, 12.2)):
        o = bpy.data.objects.get(f"DormerWin{i}")
        if o:
            bpy.data.objects.remove(o, do_unlink=True)
        a, b = x + 0.3, x + 1.7 - 0.3
        y = 14.6 - 0.2
        z1 = bm.EAVE + (14.6 - bm.Y_MAIN) * 1.1
        z2 = z1 + 1.3
        room = interiors.mat("DormerRoom", "#2a241f", 0.9)
        def bx(n, u1, u2, d1, d2, za, zb, m):
            house_real._box(n, u1, u2, y - d2, y - d1, za, zb, m, coll)
        bx(f"Dormer{i}_room", a, b, 0.0, 0.004, z1, z2, room)
        bx(f"Dormer{i}_glass", a, b, 0.03, 0.036, z1, z2, M["glass"])
        for k, (u1, u2, za, zb) in enumerate(((a, a + 0.06, z1, z2), (b - 0.06, b, z1, z2), (a, b, z1, z1 + 0.06), (a, b, z2 - 0.06, z2))):
            bx(f"Dormer{i}_f{k}", u1, u2, 0.0, 0.06, za, zb, M["frame"])
        bx(f"Dormer{i}_mv", (a + b) / 2 - 0.022, (a + b) / 2 + 0.022, 0.02, 0.05, z1, z2, M["frame"])
        bx(f"Dormer{i}_mh", a, b, 0.02, 0.05, (z1 + z2) / 2 - 0.022, (z1 + z2) / 2 + 0.022, M["frame"])
        for k, (u1, u2, za, zb) in enumerate(((a - 0.11, a, z1 - 0.05, z2 + 0.12), (b, b + 0.11, z1 - 0.05, z2 + 0.12),
                                               (a - 0.11, b + 0.11, z2, z2 + 0.14))):
            bx(f"Dormer{i}_casing{k}", u1, u2, 0.0, 0.035, za, zb, M["trim"])
        bx(f"Dormer{i}_sill", a - 0.16, b + 0.16, 0.0, 0.08, z1 - 0.1, z1 - 0.03, M["trim"])


def trim_roofs_inside(coll):
    """Eave overhangs that run into the house (where one roof meets a taller part of the building) would hang
    below the ceilings inside; cut every roof slab with the footprint prism below the eave line."""
    bmesh_ = __import__("bmesh")
    b = bmesh_.new()
    pts = house_real.FOOTPRINT
    lo = [b.verts.new((x, y, -2.0)) for x, y in pts]
    hi = [b.verts.new((x, y, house_real.EAVE - 0.005)) for x, y in pts]
    b.faces.new(list(reversed(lo)))
    b.faces.new(hi)
    for i in range(len(pts)):
        j = (i + 1) % len(pts)
        b.faces.new((lo[i], lo[j], hi[j], hi[i]))
    b.normal_update()
    me = bpy.data.meshes.new("RoofTrimCutter")
    b.to_mesh(me)
    b.free()
    cutter = bpy.data.objects.new("RoofTrimCutter", me)
    coll.objects.link(cutter)
    cutter.hide_render = True
    cutter.display_type = "WIRE"
    for o in list(coll.objects) + [o for o in bpy.data.objects if o.name.startswith("Garage_")]:
        if o.name.endswith(("_roofS", "_roofN", "_roofW", "_roofE")):
            m = o.modifiers.new("trim_inside", "BOOLEAN")
            m.operation, m.solver, m.object = "DIFFERENCE", "EXACT", cutter


# ---------------------------------------------------------------- scene assembly
def build(opt):
    bm.reset()
    bm.materials()
    bm.build_site()
    bm.build_house()
    for o in list(bpy.data.objects):
        if o.name.startswith(REPLACED_PREFIX) or (o.name in {w["name"] for w in bm.WINDOWS} and o.name not in KEEP):
            bpy.data.objects.remove(o, do_unlink=True)
    bm.build_terrace()
    bm.build_heli()
    bm.build_lake()
    M = materials_pbr.build_all(dusk=True)
    details.apply_materials(M)
    details.build_extras(M, bm.collection("FacadeExtras"))
    for o in list(bpy.data.collections["FacadeExtras"].objects):   # facade.py builds the gutters now
        if o.name.startswith("Gutter"):
            bpy.data.objects.remove(o, do_unlink=True)
    coll = bm.collection("RealHouse")
    info = house_real.build(bm, M, coll)
    for o in coll.objects:                     # roof slabs: shingles with cream fascia on the rim
        if o.name.endswith(("_roofS", "_roofN", "_roofW", "_roofE")):
            o.data.materials.clear()
            o.data.materials.append(M["shingle"])
            o.data.materials.append(M["trim"])
            for mod in o.modifiers:
                if mod.type == "SOLIDIFY":
                    mod.material_offset_rim = 1
    trim_roofs_inside(coll)
    facade.build(M, bm.collection("Windows"))
    dormer_windows(M, bm.collection("Windows"))
    details.build_landscape(M, bm.collection("Hardscape"))
    if "--no-interior" not in sys.argv:
        interiors.build(M, bm.collection("Interiors"))
        facade.interior_trim(M, bm.collection("Interiors"))
        armory.build(M, bm.collection("Interiors"))
        armory.secret_door(hinge_xy=(10.03, 18.565), angle_deg=-72.0)
        lowerlevel.build(M, bm.collection("LowerLevel"))
        rich.build(M, bm.collection("RichInteriors"))
    if "--no-plants" not in sys.argv:
        front_yard.build(bm, M, bm.collection("FrontYard"))
        rear_yard.build(bm, M, bm.collection("RearYard"))
    outdoor.build(bm, M, bm.collection("Outdoor"))
    outdoor2.build(bm, M, bm.collection("Outdoor2"))
    vehicles.build(bm, M, bm.collection("Vehicles"))
    lights = bm.collection("Lights")
    room_lights(info["rooms"], lights)
    porch_lights(lights)
    return M


def render(opt, M):
    scn = bpy.context.scene
    bm.render_setup(opt["preview"])
    c = scn.cycles
    c.samples = int(opt["samples"] or (32 if opt["preview"] else 256))
    c.max_bounces, c.diffuse_bounces, c.glossy_bounces = 8, 3, 3
    c.transmission_bounces, c.transparent_max_bounces = 6, 24
    c.caustics_reflective = c.caustics_refractive = False
    c.sample_clamp_indirect = 8.0
    c.use_adaptive_sampling = True
    c.adaptive_threshold = float(os.environ.get("NOISE", "0.015"))
    scn.render.use_persistent_data = True
    scn.view_settings.look = os.environ.get("LOOK", "AgX - Medium High Contrast")
    views = dict(bm.VIEWS)
    for k, (loc, tgt, lens, res, sh) in EXTRA_VIEWS.items():
        views[k] = (loc, tgt, lens, res, 0, 0, sh)
    for name, v in views.items():
        bm.camera(name, v[0], v[1], v[2], v[6] if len(v) > 6 else 0.0)
    os.makedirs(OUT_DIR, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND, compress=True)
    names = opt["views"].split(",") if opt["views"] else ["front", "lake", "pool", "lawn", "garden", "aerial"]
    scale = float(opt["scale"] or (0.5 if opt["preview"] else 1.0))
    for name in names:
        v = views[name]
        target = os.path.join(OUT_DIR, f"{name}{'_preview' if opt['preview'] else ''}.png")
        if "--skip-existing" in sys.argv and os.path.exists(target):
            print("skip", target, flush=True)
            continue
        scn.camera = bpy.data.objects["Cam_" + name]
        scn.render.resolution_x, scn.render.resolution_y = int(v[3][0] * scale), int(v[3][1] * scale)
        spec = LIGHT.get(name, ("dusk", 20))
        mode, az = spec[:2]
        expo = spec[2] if len(spec) > 2 else float(os.environ.get("INSIDE_EXPOSURE", "0.3"))
        if mode == "dusk":
            set_world(os.environ.get("DUSK_HDRI", "dusk"), int(os.environ.get("DUSK_AZ", az)), 1.0,
                      float(os.environ.get("DUSK_EXPOSURE", "-0.2")))
        elif mode == "inside":          # daylight through the windows, house lights on (as in the video)
            set_world("day", az, 1.0, expo)
        else:
            set_world("day", az, 1.0, 0.0)
        dusk_sun(mode == "dusk", int(os.environ.get("SUN_AZ", az)), float(os.environ.get("SUN_EL", 7)))
        for o in bpy.data.objects:
            if o.type == "LIGHT" and (o.name.startswith(("RL_", "LanternL", "PorchCan")) or o.get("dusk_only")):
                o.hide_render = (mode == "day") or (mode == "inside" and bool(o.get("dusk_only")))
            if o.type == "LIGHT" and o.name.startswith("RL_") and o.data.type == "AREA":
                if "base_energy" not in o:
                    o["base_energy"] = o.data.energy
                # by day the room fill is only a bounce stand-in: windows must stay the brightest thing
                o.data.energy = o["base_energy"] * (float(os.environ.get("INSIDE_RL", "0.3")) if mode == "inside" else 1.0)
        scn.render.filepath = os.path.join(OUT_DIR, f"{name}{'_preview' if opt['preview'] else ''}.png")
        bpy.ops.render.render(write_still=True)
        print("rendered", scn.render.filepath, flush=True)


if __name__ == "__main__":
    o = parse()
    M = build(o)
    render(o, M)
