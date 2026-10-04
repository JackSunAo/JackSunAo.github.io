"""Interior styling: procedural modern furniture whose fabrics, leathers, woods and accents come from a
style palette (env STYLE). Used to compare furnishing directions before the whole house is restyled.

Styles (keys): farmhouse 温润现代农舍, lake 湖畔度假, ranch 德州精致牧场, minimal 现代侘寂暖白, moody 经典深色对比.
"""
import math
import os
import random

import bmesh
import bpy
from mathutils import Matrix, Vector

import interiors as I

STYLES = {
    "farmhouse": dict(sofa=("linen", "#d8cfbf"), chair=("leather", "#8a5530"), wood="#b8966c", metal="#1a1a1a",
                      pillows=["#ebe4d6", "#7f8b6f", "#c7b393", "#efe9de", "#8f7a5c"], rug=("#d9d0c1", "#9a8b74"),
                      table=("wood", "#b8966c"), throw="#a48c6c", dining=("#b8966c", ("linen", "#e6dfd2"))),
    "lake": dict(sofa=("linen", "#efede8"), chair=("rattan", "#c39a63"), wood="#d6c6ad", metal="#c9a66b",
                 pillows=["#6f8ea8", "#f2f0ea", "#a9bdcc", "#2f4a63", "#e3dccd"], rug=("#c2aa82", "#a48d67"),
                 table=("wood", "#d6c6ad"), throw="#9fb4c4", dining=("#d6c6ad", ("rattan", "#c39a63"))),
    "ranch": dict(sofa=("leather", "#7b4a2a"), chair=("velvet", "#55603a"), wood="#4a3426", metal="#1d1d1d",
                  pillows=["#d8c9a8", "#5c3b25", "#e9e0cf", "#7c6a3c", "#b07a4a"], rug=("#dccfb6", "#4b3727"),
                  table=("wood", "#4a3426"), throw="#c8b58c", dining=("#4a3426", ("leather", "#7b4a2a"))),
    "minimal": dict(sofa=("boucle", "#e6dfd3"), chair=("linen", "#b9a48b"), wood="#cbb59a", metal="#8c8378",
                    pillows=["#c0704b", "#ece6db", "#a99581", "#d8cbb8", "#8a5a3c"], rug=("#e9e3d7", "#dad1c2"),
                    table=("travertine", "#d8c9ac"), throw="#c9b9a2", dining=("#cbb59a", ("boucle", "#e6dfd3"))),
    "moody": dict(sofa=("velvet", "#22392f"), chair=("leather", "#161616"), wood="#2e231c", metal="#b08d57",
                  pillows=["#b08d57", "#e9e4da", "#1d2b3a", "#6b2e2a", "#3a3a3d"], rug=("#2e2e30", "#8a7550"),
                  table=("marble", "#f0eee9"), throw="#6b2e2a", dining=("#2e231c", ("velvet", "#1d2b3a"))),
}
NAMES = {"farmhouse": "温润现代农舍", "lake": "湖畔度假", "ranch": "德州精致牧场", "minimal": "现代侘寂暖白", "moody": "经典深色对比"}


def style():
    st = dict(STYLES[os.environ.get("STYLE", "moody")])
    if os.environ.get("SOFA"):                      # e.g. SOFA=velvet:#1f2c44 overrides the sofa upholstery
        kind, col = os.environ["SOFA"].split(":")
        st["sofa"] = (kind, col)
    return st


# ---------------------------------------------------------------- materials
def _lin(h):
    h = h.lstrip("#")
    f = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return [f(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4)]


def fabric(kind, hexcol):
    name = f"F_{kind}_{hexcol}"
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    base = _lin(hexcol)
    col = nt.nodes.new("ShaderNodeRGB")
    col.outputs[0].default_value = (*base, 1)
    bump = nt.nodes.new("ShaderNodeBump")
    if kind in ("linen", "boucle", "velvet"):
        nz = nt.nodes.new("ShaderNodeTexNoise")
        nz.inputs["Scale"].default_value = {"linen": 900.0, "boucle": 260.0, "velvet": 1500.0}[kind]
        nz.inputs["Detail"].default_value = 4.0
        nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
        # slight tonal variation so large panels don't look flat
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.inputs["Factor"].default_value = 0.18 if kind != "velvet" else 0.08
        nt.links.new(col.outputs[0], mix.inputs["A"])
        nt.links.new(nz.outputs["Color"], mix.inputs["B"])
        nt.links.new(mix.outputs["Result"], p.inputs["Base Color"])
        nt.links.new(nz.outputs["Fac"], bump.inputs["Height"])
        bump.inputs["Strength"].default_value = {"linen": 0.25, "boucle": 0.9, "velvet": 0.05}[kind]
        bump.inputs["Distance"].default_value = 0.004
        nt.links.new(bump.outputs["Normal"], p.inputs["Normal"])
        p.inputs["Roughness"].default_value = 0.9 if kind != "velvet" else 0.55
        p.inputs["Sheen Weight"].default_value = 0.6 if kind != "velvet" else 1.0
        p.inputs["Sheen Roughness"].default_value = 0.5 if kind != "velvet" else 0.3
    elif kind == "leather":
        vor = nt.nodes.new("ShaderNodeTexVoronoi")
        vor.inputs["Scale"].default_value = 420.0
        nt.links.new(tc.outputs["Object"], vor.inputs["Vector"])
        nz = nt.nodes.new("ShaderNodeTexNoise")
        nz.inputs["Scale"].default_value = 3.0
        nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.inputs["Factor"].default_value = 0.35
        nt.links.new(col.outputs[0], mix.inputs["A"])
        nt.links.new(nz.outputs["Color"], mix.inputs["B"])
        nt.links.new(mix.outputs["Result"], p.inputs["Base Color"])
        nt.links.new(vor.outputs["Distance"], bump.inputs["Height"])
        bump.inputs["Strength"].default_value = 0.15
        nt.links.new(bump.outputs["Normal"], p.inputs["Normal"])
        p.inputs["Roughness"].default_value = 0.42
        p.inputs["Coat Weight"].default_value = 0.2
    elif kind == "rattan":
        wv = nt.nodes.new("ShaderNodeTexWave")
        wv.inputs["Scale"].default_value = 60.0
        wv.inputs["Distortion"].default_value = 2.0
        wv2 = nt.nodes.new("ShaderNodeTexWave")
        wv2.bands_direction = "Y"
        wv2.inputs["Scale"].default_value = 60.0
        for w in (wv, wv2):
            nt.links.new(tc.outputs["Object"], w.inputs["Vector"])
        mx = nt.nodes.new("ShaderNodeMath")
        mx.operation = "MAXIMUM"
        nt.links.new(wv.outputs["Fac"], mx.inputs[0])
        nt.links.new(wv2.outputs["Fac"], mx.inputs[1])
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].color = (*[c * 0.45 for c in base], 1)
        ramp.color_ramp.elements[1].color = (*base, 1)
        nt.links.new(mx.outputs[0], ramp.inputs["Fac"])
        nt.links.new(ramp.outputs["Color"], p.inputs["Base Color"])
        nt.links.new(mx.outputs[0], bump.inputs["Height"])
        bump.inputs["Strength"].default_value = 0.6
        nt.links.new(bump.outputs["Normal"], p.inputs["Normal"])
        p.inputs["Roughness"].default_value = 0.6
    else:                                                    # wood / travertine / marble / metal
        nz = nt.nodes.new("ShaderNodeTexNoise")
        nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
        if kind == "wood":
            wv = nt.nodes.new("ShaderNodeTexWave")
            wv.inputs["Scale"].default_value = 6.0
            wv.inputs["Distortion"].default_value = 6.0
            wv.inputs["Detail"].default_value = 3.0
            nt.links.new(tc.outputs["Object"], wv.inputs["Vector"])
            src = wv.outputs["Fac"]
            lo, hi, rough = 0.7, 1.12, 0.45
        elif kind == "travertine":
            nz.inputs["Scale"].default_value = 18.0
            nz.inputs["Detail"].default_value = 8.0
            src = nz.outputs["Fac"]
            lo, hi, rough = 0.82, 1.06, 0.55
            nt.links.new(nz.outputs["Fac"], bump.inputs["Height"])
            bump.inputs["Strength"].default_value = 0.4
            nt.links.new(bump.outputs["Normal"], p.inputs["Normal"])
        elif kind == "marble":
            return I.marble_mat()
        else:
            src = nz.outputs["Fac"]
            lo, hi, rough = 0.95, 1.05, 0.3
            p.inputs["Metallic"].default_value = 1.0
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].color = (*[min(1, c * lo) for c in base], 1)
        ramp.color_ramp.elements[1].color = (*[min(1, c * hi) for c in base], 1)
        nt.links.new(src, ramp.inputs["Fac"])
        nt.links.new(ramp.outputs["Color"], p.inputs["Base Color"])
        p.inputs["Roughness"].default_value = rough
    return m


# ---------------------------------------------------------------- geometry helpers
def _rbox(name, cx, cy, z1, sx, sy, sz, m, r=0.04, parent=None):
    """Rounded upholstered block centred on (cx, cy), bottom at z1 (local to parent)."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Translation((cx, cy, z1 + sz / 2)) @ Matrix.Diagonal((sx, sy, sz, 1)))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    o.data.materials.append(m)
    if r > 0:
        b = o.modifiers.new("round", "BEVEL")
        b.width, b.segments, b.limit_method = min(r, sx / 2.05, sy / 2.05, sz / 2.05), 5, "NONE"
        b.profile = 0.6
    for p in o.data.polygons:
        p.use_smooth = False
    I.COLL.objects.link(o)
    if parent:
        o.parent = parent
    return o


def _cyl(name, x, y, z1, z2, r, m, parent=None, seg=24):
    o = I.cyl(name, x, y, z1, z2, r, m, seg)
    if parent:
        o.parent = parent
    return o


def _root(name, x, y, z, rot_deg):
    e = bpy.data.objects.new(name, None)
    e.location = (x, y, z)
    e.rotation_euler = (0, 0, math.radians(rot_deg))
    I.COLL.objects.link(e)
    return e


# ---------------------------------------------------------------- furniture (all face +y at rot 0)
def sofa(name, x, y, z, rot, length=2.6, depth=1.0, st=None, curved=False):
    st = st or style()
    up = fabric(*st["sofa"])
    leg = fabric("wood", st["wood"]) if st["sofa"][0] != "velvet" else fabric("metal", st["metal"])
    root = _root(name, x, y, z, rot)
    L, D = length, depth
    seat_h, arm_w = 0.44, 0.2 if not curved else 0.0
    _rbox(name + "_base", 0, 0.01, 0.12, L - 0.05, D - 0.05, 0.26, up, 0.03, root)     # inset: no coplanar faces
    n = 3 if L > 2.2 else 2
    inner = L - 2 * arm_w
    for k in range(n):
        cx = -inner / 2 + inner * (k + 0.5) / n
        _rbox(f"{name}_seat{k}", cx, 0.08, 0.38, inner / n - 0.015, D - 0.28, 0.14, up, 0.06, root)
        _rbox(f"{name}_back{k}", cx, -D / 2 + 0.2, 0.42, inner / n - 0.02, 0.22, 0.42, up, 0.08, root)
    _rbox(name + "_backframe", 0, -D / 2 + 0.07, 0.12, L - 0.02, 0.14, 0.62 if not curved else 0.56, up, 0.05, root)
    if not curved:
        for s in (-1, 1):
            _rbox(f"{name}_arm{s}", s * (L / 2 - arm_w / 2), 0.012, 0.12, arm_w, D - 0.01, 0.5, up, 0.06, root)
    else:
        for s in (-1, 1):
            _rbox(f"{name}_wing{s}", s * (L / 2 - 0.1), -0.05, 0.12, 0.2, D - 0.1, 0.42, up, 0.1, root)
    for sx in (-1, 1):
        for sy in (-1, 1):
            _rbox(f"{name}_leg{sx}{sy}", sx * (L / 2 - 0.08), sy * (D / 2 - 0.08), 0.0, 0.05, 0.05, 0.12, leg, 0.01, root)
    return root


def accent_chair(name, x, y, z, rot, st=None):
    st = st or style()
    kind, col = st["chair"]
    m = fabric(kind, col)
    wood = fabric("wood", st["wood"])
    root = _root(name, x, y, z, rot)
    if kind == "rattan":
        _rbox(name + "_shell", 0, -0.05, 0.25, 0.8, 0.78, 0.5, m, 0.12, root)
        _rbox(name + "_cush", 0, 0.05, 0.42, 0.62, 0.6, 0.12, fabric("linen", "#f1eee7"), 0.05, root)
        _rbox(name + "_back", 0, -0.38, 0.45, 0.8, 0.12, 0.45, m, 0.06, root)
    else:
        _rbox(name + "_seat", 0, 0.04, 0.3, 0.74, 0.7, 0.16, m, 0.06, root)
        _rbox(name + "_back", 0, -0.32, 0.3, 0.74, 0.14, 0.52, m, 0.07, root)
        for s in (-1, 1):
            _rbox(f"{name}_arm{s}", s * 0.4, -0.02, 0.22, 0.1, 0.72, 0.38, m if kind != "leather" else wood, 0.03, root)
    for sx in (-1, 1):
        for sy in (-1, 1):
            _rbox(f"{name}_leg{sx}{sy}", sx * 0.33, sy * 0.3, 0.0, 0.04, 0.04, 0.25, wood, 0.01, root)
    pillow(name + "_pil", 0, -0.18, 0.52, st["pillows"][1], root, 0.42)
    return root


def pillow(name, x, y, z, col, parent=None, w=0.48, tilt=-14):
    o = _rbox(name, x, y, z, w, 0.16, w, fabric("linen", col), 0.07, parent)
    o.rotation_euler.x = math.radians(tilt)
    return o


def coffee_table(name, x, y, z, st=None, w=1.4, d=0.8):
    st = st or style()
    kind, col = st["table"]
    top = fabric(kind, col)
    root = _root(name, x, y, z, 0)
    if kind in ("travertine",):
        _rbox(name + "_drum", 0, 0, 0.0, w, d, 0.38, top, 0.03, root)
    elif kind == "marble":
        _rbox(name + "_top", 0, 0, 0.36, w, d, 0.04, top, 0.006, root)
        frame = fabric("metal", st["metal"])
        for sx in (-1, 1):
            _rbox(f"{name}_leg{sx}", sx * (w / 2 - 0.08), 0, 0.0, 0.03, d - 0.1, 0.36, frame, 0.004, root)
    else:
        _rbox(name + "_top", 0, 0, 0.34, w, d, 0.06, top, 0.008, root)
        _rbox(name + "_shelf", 0, 0, 0.08, w - 0.12, d - 0.12, 0.03, top, 0.005, root)
        for sx in (-1, 1):
            for sy in (-1, 1):
                _rbox(f"{name}_leg{sx}{sy}", sx * (w / 2 - 0.05), sy * (d / 2 - 0.05), 0.0, 0.06, 0.06, 0.34, top, 0.005, root)
    # styling on top: books, a bowl
    _rbox(name + "_book1", -0.3, 0.05, 0.4 if kind != "travertine" else 0.38, 0.32, 0.24, 0.04, fabric("linen", st["pillows"][2]), 0.003, root)
    _rbox(name + "_book2", -0.3, 0.05, 0.44 if kind != "travertine" else 0.42, 0.28, 0.2, 0.03, fabric("linen", st["pillows"][0]), 0.003, root)
    _cyl(name + "_bowl", 0.3, -0.05, 0.4 if kind != "travertine" else 0.38, 0.48 if kind != "travertine" else 0.46, 0.13,
         fabric("wood", st["wood"]), root, 32)
    return root


def throw(name, x, y, z, rot, col, parent=None):
    o = _rbox(name, 0, 0, 0, 0.5, 0.9, 0.03, fabric("linen", col), 0.012)
    o.location = (x, y, z)
    o.rotation_euler = (0, math.radians(8), math.radians(rot))
    return o


# ---------------------------------------------------------------- the great room, restyled
def great_room_living(z=0.0):
    st = style()
    I.rug("GreatRug", 16.7, 21.6, 23.2, 27.6, z, *st["rug"])
    curved = os.environ.get("STYLE") == "minimal"
    s1 = sofa("GreatSofa", 19.15, 24.2, z, 0, 2.9, 1.0, st, curved)
    s2 = sofa("GreatSofa2", 17.15, 26.25, z, 270, 2.3, 1.0, st, curved)
    for k, (dx, c) in enumerate(((-1.0, st["pillows"][0]), (-0.55, st["pillows"][1]), (0.6, st["pillows"][2]), (1.05, st["pillows"][4]))):
        pillow(f"GreatPil{k}", dx, -0.28, 0.5, c, s1)
    for k, (dx, c) in enumerate(((-0.75, st["pillows"][3]), (0.75, st["pillows"][1]))):
        pillow(f"GreatPil2_{k}", dx, -0.28, 0.5, c, s2)
    throw("GreatThrow", 20.35, 24.05, z + 0.62, 0, st["throw"])
    accent_chair("GreatChair", 21.25, 25.55, z, 120, st)
    accent_chair("GreatChair2", 21.25, 26.95, z, 75, st)
    coffee_table("GreatTable", 19.15, 25.95, z, st)
