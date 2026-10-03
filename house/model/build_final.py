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
import house_real  # noqa: E402
import materials_pbr  # noqa: E402

OUT_DIR = os.path.join(HERE, "..", "renders", "final")
OUT_BLEND = os.path.join(HERE, "final.blend")

# per view: lighting mode and where the sun (or the sunset glow) sits, as a compass azimuth
# (degrees clockwise from north = +Y). Hero views place the glow where it flatters the shot.
LIGHT = {
    "front": ("dusk", 200), "front_close": ("dusk", 200), "lake": ("dusk", 15), "pool": ("day", 250), "lawn": ("day", 235),
    "garden": ("day", 250), "aerial": ("day", 225),
}
EXTRA_VIEWS = {
    # name: (location, target, lens, resolution, shift_y)
    "front_close": ((24.0, 2.0, 1.5), (17.0, 13.5, 4.8), 20, (1600, 1600), 0.08),
}

REPLACED_PREFIX = ("Main_", "StoneGable_", "BrickWing_", "EastGable_", "RearGable_", "Dormer2", "Dormer3")
KEEP = {"DormerWin0", "DormerWin1"}      # dormer glass stays until the dormers get real windows


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
    img = bpy.data.images.load(assets.hdri(key, "1k"), check_existing=True)
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
    o.data.energy = float(os.environ.get("SUN_E", 2.6))
    o.data.color = (1.0, 0.64, 0.38)
    o.data.angle = math.radians(8)
    o.hide_render = not on
    bm.aim(o, compass_deg, elev)


def room_lights(rooms, coll, warm=(1.0, 0.70, 0.45), w_per_m2=float(os.environ.get("ROOM_W", 200))):
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
    facade.build(M, bm.collection("Windows"))
    details.build_landscape(M, bm.collection("Hardscape"))
    if "--no-plants" not in sys.argv:
        front_yard.build(bm, M, bm.collection("FrontYard"))
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
        scn.camera = bpy.data.objects["Cam_" + name]
        scn.render.resolution_x, scn.render.resolution_y = int(v[3][0] * scale), int(v[3][1] * scale)
        mode, az = LIGHT.get(name, ("dusk", 20))
        if mode == "dusk":
            set_world(os.environ.get("DUSK_HDRI", "dusk"), int(os.environ.get("DUSK_AZ", az)), 1.0,
                      float(os.environ.get("DUSK_EXPOSURE", "0.9")))
        else:
            set_world("day", az, 1.0, 0.0)
        dusk_sun(mode == "dusk", int(os.environ.get("SUN_AZ", az)), float(os.environ.get("SUN_EL", 7)))
        for o in bpy.data.objects:
            if o.type == "LIGHT" and (o.name.startswith(("RL_", "LanternL", "PorchCan"))):
                o.hide_render = (mode != "dusk")
        scn.render.filepath = os.path.join(OUT_DIR, f"{name}{'_preview' if opt['preview'] else ''}.png")
        bpy.ops.render.render(write_still=True)
        print("rendered", scn.render.filepath, flush=True)


if __name__ == "__main__":
    o = parse()
    M = build(o)
    render(o, M)
