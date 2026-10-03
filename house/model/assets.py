"""Poly Haven asset cache (CC0): HDRIs, PBR textures and .blend models.

Everything lands in house/assets/ (git-ignored) and is re-downloaded on demand, so a fresh
container only needs network access. `python assets.py` prefetches the full manifest.
"""
import concurrent.futures as cf
import json
import os
import sys
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", "assets"))
API = "https://api.polyhaven.com/files/"
UA = {"User-Agent": "JackSunAoHouseModel/1.0 (github.com/JackSunAo/JackSunAo.github.io)"}

HDRIS = {"dusk": "syferfontein_0d_clear_puresky", "dusk_clouds": "evening_road_01_puresky",
         "day": "kloofendal_48d_partly_cloudy_puresky"}

TEXTURES = {  # role: (asset id, resolution)
    "brick": ("whitewashed_brick", "2k"),
    "stone": ("white_sandstone_blocks_02", "2k"),
    "shingle": ("grey_roof_01", "2k"),
    "floor_oak": ("laminate_floor_02", "2k"),
    "paver": ("marble_01", "2k"),
    "gravel": ("sandy_gravel", "1k"),
    "aggregate": ("gravel_concrete_03", "1k"),
    "lawn_ground": ("leafy_grass", "2k"),
    "sand": ("coast_sand_01", "1k"),
    "plaster": ("white_plaster_02", "1k"),
    "mulch": ("forest_leaves_04", "1k"),
    "concrete": ("brushed_concrete_2", "1k"),
    "bark_oak": ("jolcham_oak_bark_01", "1k"),
}
TEX_MAPS = {"diff": "Diffuse", "nor": "nor_gl", "rough": "Rough", "disp": "Displacement", "ao": "AO"}

MODELS_PLANTS = ["island_tree_01", "island_tree_02", "island_tree_03", "jacaranda_tree", "tree_small_02",
                 "fir_tree_01", "pine_tree_01", "shrub_01", "shrub_02", "shrub_03", "shrub_04", "shrub_sorrel_01",
                 "fern_02", "grass_medium_01", "grass_medium_02", "grass_bermuda_01", "flower_gazania",
                 "flower_empodium", "flower_ursinia", "periwinkle_plant", "dandelion_01", "celandine_01",
                 "potted_plant_01", "potted_plant_02", "boulder_01"]
MODELS_FURNITURE = ["sofa_02", "sofa_03", "Sofa_01", "modern_arm_chair_01", "mid_century_lounge_chair", "ArmChair_01",
                    "coffee_table_round_01", "modern_coffee_table_01", "modern_coffee_table_02", "dining_table",
                    "dining_chair_02", "Chandelier_01", "Chandelier_02", "Chandelier_03", "modern_ceiling_lamp_01",
                    "ceiling_fan", "Television_01", "television_02", "bar_chair_round_01", "throw_pillows_01",
                    "side_table_01", "side_table_tall_01", "Ottoman_01", "ClassicConsole_01", "wooden_picnic_table",
                    "outdoor_table_chair_set_01", "stone_fire_pit", "planter_box_01", "planter_box_02",
                    "potted_plant_04", "dartboard", "chess_set", "bolt_action_rifle_7_62", "decorative_book_set_01",
                    "book_encyclopedia_set_01", "ceramic_vase_01", "ceramic_vase_02", "hanging_picture_frame_01",
                    "hanging_picture_frame_02", "wooden_display_shelves_01", "exterior_aircon_unit", "Lantern_01"]


def _json(url, tries=4):
    for i in range(tries):
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60))
        except Exception:
            if i == tries - 1:
                raise
            time.sleep(2 ** i)


def _download(url, path, size=None, tries=4):
    if os.path.exists(path) and (size is None or os.path.getsize(path) == size):
        return path
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".part"
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=300) as r, open(tmp, "wb") as f:
                while True:
                    b = r.read(1 << 20)
                    if not b:
                        break
                    f.write(b)
            os.replace(tmp, path)
            return path
        except Exception:
            if i == tries - 1:
                raise
            time.sleep(2 ** i)


def hdri(key, res="4k"):
    aid = HDRIS.get(key, key)
    info = _json(API + aid)["hdri"][res]["hdr"]
    return _download(info["url"], os.path.join(ROOT, "hdri", f"{aid}_{res}.hdr"), info.get("size"))


def texture(role):
    """{'diff': path, 'nor': path, 'rough': path, 'disp': path, 'ao': path} (missing maps omitted)."""
    aid, res = TEXTURES.get(role, (role, "1k"))
    files = _json(API + aid)
    out = {}
    for k, name in TEX_MAPS.items():
        entry = files.get(name, {}).get(res)
        if not entry:
            continue
        fmt = "jpg" if "jpg" in entry else ("png" if "png" in entry else None)
        if fmt is None:
            continue
        info = entry[fmt]
        out[k] = _download(info["url"], os.path.join(ROOT, "tex", aid, os.path.basename(info["url"])), info.get("size"))
    return out


def model(aid, res="1k"):
    """Path to the asset's .blend; its texture files are placed beside it as the .blend expects."""
    info = _json(API + aid)["blend"][res]["blend"]
    folder = os.path.join(ROOT, "models", aid)
    blend = _download(info["url"], os.path.join(folder, os.path.basename(info["url"])), info.get("size"))
    for rel, inc in info.get("include", {}).items():
        _download(inc["url"], os.path.join(folder, rel), inc.get("size"))
    return blend


def prefetch():
    jobs = [("hdri", k) for k in HDRIS] + [("tex", r) for r in TEXTURES] + \
           [("model", m) for m in MODELS_PLANTS + MODELS_FURNITURE]

    def run(job):
        kind, name = job
        try:
            {"hdri": hdri, "tex": texture, "model": model}[kind](name)
            return f"ok {kind} {name}"
        except Exception as e:  # keep going; a missing asset falls back to procedural
            return f"FAIL {kind} {name}: {e}"
    with cf.ThreadPoolExecutor(6) as ex:
        for line in ex.map(run, jobs):
            print(line, flush=True)


if __name__ == "__main__":
    prefetch() if len(sys.argv) == 1 else print(model(sys.argv[1]))
