"""Stage 2: massing + facade details + procedural materials, dusk lighting for the hero views.

Usage:
  python build_detailed.py                    # all views
  python build_detailed.py --views front      # subset
  python build_detailed.py --preview          # quick, half resolution
"""
import math
import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build_massing as bm  # noqa: E402
import details  # noqa: E402
import materials  # noqa: E402

OUT_DIR = os.path.join(HERE, "..", "renders", "detail")
OUT_BLEND = os.path.join(HERE, "detailed.blend")

# per-view lighting: dusk = reference look (low warm sun, lit interiors); day = clear afternoon
LIGHT = {
    "front": "dusk", "lake": "dusk", "pool": "day", "lawn": "day", "garden": "day", "aerial": "day",
}


def set_light(mode, sky, sun, M, view_az):
    scn = bpy.context.scene
    glass = M["glass"].node_tree.nodes["Principled BSDF"]
    lantern = M["lantern"].node_tree.nodes["Principled BSDF"]
    bg = scn.world.node_tree.nodes["Background"]
    if mode == "dusk":
        sky.sun_elevation = math.radians(1.5)
        sky.sun_rotation = math.radians(295)
        bg.inputs["Strength"].default_value = 0.9
        sun.data.energy = 0.9
        sun.data.color = (1.0, 0.62, 0.38)
        bm.aim(sun, 295, 4)
        glass.inputs["Emission Strength"].default_value = 1.4
        lantern.inputs["Emission Strength"].default_value = 30.0
        scn.view_settings.exposure = 0.45
    else:
        sky.sun_elevation = math.radians(32)
        sky.sun_rotation = math.radians(view_az)
        bg.inputs["Strength"].default_value = 0.3
        sun.data.energy = 3.4
        sun.data.color = (1.0, 0.97, 0.92)
        bm.aim(sun, view_az, 32)
        glass.inputs["Emission Strength"].default_value = 0.0
        lantern.inputs["Emission Strength"].default_value = 0.0
        scn.view_settings.exposure = 0.0


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    preview = "--preview" in args
    views = args[args.index("--views") + 1].split(",") if "--views" in args else list(bm.VIEWS)

    bm.reset()
    bm.materials()
    bm.build_site()
    bm.build_house()
    bm.build_terrace()
    bm.build_heli()
    bm.build_lake()
    M = materials.build_all(dusk=True)
    coll = bm.collection("Details")
    details.apply_materials(M)
    details.build_windows(M, coll)
    details.build_extras(M, coll)
    details.build_landscape(M, coll)

    bm.render_setup(preview)
    scn = bpy.context.scene
    scn.cycles.samples = 24 if preview else 128
    scn.cycles.max_bounces = 6
    sky, sun = bm.world_and_light(235, 32)
    for name, view in bm.VIEWS.items():
        bm.camera(name, view[0], view[1], view[2], view[6] if len(view) > 6 else 0.0)
    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND, compress=True)

    os.makedirs(OUT_DIR, exist_ok=True)
    for name in views:
        loc, target, lens, res, az, el = bm.VIEWS[name][:6]
        scn.camera = bpy.data.objects["Cam_" + name]
        scale = 0.5 if preview else 1.0
        scn.render.resolution_x, scn.render.resolution_y = int(res[0] * scale), int(res[1] * scale)
        set_light(LIGHT.get(name, "day"), sky, sun, M, az)
        idx = list(bm.VIEWS).index(name) + 1
        scn.render.filepath = os.path.join(OUT_DIR, f"{idx:02d}_{name}.png")
        bpy.ops.render.render(write_still=True)
        print("rendered", scn.render.filepath, flush=True)


if __name__ == "__main__":
    main()
