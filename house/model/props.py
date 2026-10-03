"""Furniture / prop placement: Poly Haven models appended once and placed as collection instances.
Falls back to glTF when a .blend can't be read by this Blender version."""
import math
import os

import bpy

import assets
import vegetation as V

_PROPS = {}
SCALE_FIX = {"Chandelier_01": 0.01}
EXCLUDE = ("Sphere_stash",)


def _import_gltf(aid):
    info = assets._json(assets.API + aid)["gltf"]["1k"]["gltf"]
    folder = os.path.join(assets.ROOT, "models", aid, "gltf")
    path = assets._download(info["url"], os.path.join(folder, os.path.basename(info["url"])), info.get("size"))
    for rel, inc in info.get("include", {}).items():
        assets._download(inc["url"], os.path.join(folder, rel), inc.get("size"))
    try:
        bpy.ops.preferences.addon_enable(module="io_scene_gltf2")
    except Exception:
        pass
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]


def library(aid, pick=lambda n: True):
    if aid in _PROPS:
        return _PROPS[aid]
    coll = bpy.data.collections.new("PROP_" + aid)
    V._lib_root().children.link(coll)
    objs = []
    try:
        path = assets.model(aid)
        with bpy.data.libraries.load(path, link=False) as (src, dst):
            dst.objects = [n for n in src.objects if pick(n) and not n.startswith(EXCLUDE)]
        objs = [o for o in dst.objects if o is not None]
        V._fix_images(os.path.dirname(path))
    except OSError:
        objs = _import_gltf(aid)
        for o in objs:
            for c in list(o.users_collection):
                c.objects.unlink(o)
    for o in objs:
        coll.objects.link(o)
    s = SCALE_FIX.get(aid)
    if s:
        for o in objs:
            if o.parent is None:
                o.scale = [v * s for v in o.scale]
                o.location = [v * s for v in o.location]
    _PROPS[aid] = coll
    return coll


def place(aid, loc, rot_deg=0.0, scale=1.0, coll=None, pick=lambda n: True, name=None):
    lib = library(aid, pick)
    e = bpy.data.objects.new(name or f"P_{aid}", None)
    e.instance_type = "COLLECTION"
    e.instance_collection = lib
    e.location = loc
    e.rotation_euler = (0, 0, math.radians(rot_deg))
    e.scale = (scale, scale, scale)
    (coll or bpy.context.scene.collection).objects.link(e)
    return e
