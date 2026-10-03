"""Photoreal materials from Poly Haven PBR scans (house/assets/tex), mapped in world space.

Walls use box projection on world coordinates (metres), so brick courses and stone blocks keep their
real size on every wall and match across separate objects. Colour is nudged toward the reference
palette with a gentle HSV / multiply step, never repainted flat.
"""
import os

import bpy

import assets
import materials as legacy    # palette + procedural siding / standing seam / glass / water


def _img(path, colorspace):
    img = bpy.data.images.load(path, check_existing=True)
    img.colorspace_settings.name = colorspace
    return img


def pbr(name, role, scale_m, tint=None, tint_mix=0.0, value=1.0, rough_mul=1.0, bump=0.6, disp=0.0, sat=1.0):
    """World-space box-mapped PBR material. `scale_m` = metres covered by one texture tile."""
    maps = assets.texture(role)
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    sc = nt.nodes.new("ShaderNodeVectorMath")
    sc.operation = "SCALE"
    sc.inputs["Scale"].default_value = 1.0 / scale_m
    nt.links.new(geo.outputs["Position"], sc.inputs[0])

    def tex(key, cs):
        n = nt.nodes.new("ShaderNodeTexImage")
        n.image = _img(maps[key], cs)
        n.projection = "BOX"
        n.projection_blend = 0.15
        nt.links.new(sc.outputs[0], n.inputs["Vector"])
        return n

    diff = tex("diff", "sRGB")
    col = diff.outputs["Color"]
    if sat != 1.0 or value != 1.0:
        hsv = nt.nodes.new("ShaderNodeHueSaturation")
        hsv.inputs["Saturation"].default_value = sat
        hsv.inputs["Value"].default_value = value
        nt.links.new(col, hsv.inputs["Color"])
        col = hsv.outputs["Color"]
    if tint:
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.inputs["Factor"].default_value = tint_mix
        mix.inputs["B"].default_value = legacy.lin(tint)
        nt.links.new(col, mix.inputs["A"])
        col = mix.outputs["Result"]
    nt.links.new(col, bsdf.inputs["Base Color"])
    if "rough" in maps:
        r = tex("rough", "Non-Color")
        mul = nt.nodes.new("ShaderNodeMath")
        mul.operation = "MULTIPLY"
        mul.inputs[1].default_value = rough_mul
        nt.links.new(r.outputs["Color"], mul.inputs[0])
        nt.links.new(mul.outputs[0], bsdf.inputs["Roughness"])
    if "nor" in maps:
        nm = tex("nor", "Non-Color")
        nmap = nt.nodes.new("ShaderNodeNormalMap")
        nmap.inputs["Strength"].default_value = bump
        nt.links.new(nm.outputs["Color"], nmap.inputs["Color"])
        nt.links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])
    if disp and "disp" in maps:
        d = tex("disp", "Non-Color")
        dn = nt.nodes.new("ShaderNodeDisplacement")
        dn.inputs["Scale"].default_value = disp
        dn.inputs["Midlevel"].default_value = 0.5
        nt.links.new(d.outputs["Color"], dn.inputs["Height"])
        nt.links.new(dn.outputs["Displacement"], out.inputs["Displacement"])
        m.displacement_method = "BUMP"
    return m


def arch_glass(name="ArchGlass", tint=(0.92, 0.96, 0.95)):
    """Window glass: refractive for camera rays, fully transparent for shadow rays so sun and lamp
    light pass through (the usual architectural-visualisation setup)."""
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    lp = nt.nodes.new("ShaderNodeLightPath")
    glass = nt.nodes.new("ShaderNodeBsdfGlass")
    glass.inputs["IOR"].default_value = 1.45
    glass.inputs["Roughness"].default_value = 0.0
    glass.inputs["Color"].default_value = (*tint, 1)
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    mx = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(lp.outputs["Is Shadow Ray"], mx.inputs["Fac"])
    nt.links.new(glass.outputs[0], mx.inputs[1])
    nt.links.new(tr.outputs[0], mx.inputs[2])
    nt.links.new(mx.outputs[0], out.inputs["Surface"])
    return m


def paint(name, hexcol, rough=0.6, bump_noise=0.0):
    m = legacy.plain(name, hexcol, rough, 0.0, bump_noise)
    return m


def build_all(dusk=True):
    """Return the material table used by the real house, landscape and interiors."""
    P = legacy.PALETTE
    M = legacy.build_all(dusk)            # keeps siding, metal roof, glass, water, foliage, etc.
    M.update({
        # facades: cream brick (smooth modern), chopped limestone blocks, dark architectural shingles
        "brick": pbr("BrickPBR", "brick", 1.6, "#f5dfb6", 0.85, value=1.38, sat=0.35, bump=0.8),
        "stone": pbr("LimestonePBR", "stone", 2.4, "#f3dcb2", 0.7, value=1.3, sat=0.8, bump=1.0),
        "shingle": pbr("ShinglePBR", "shingle", 2.0, "#3a3a3d", 0.6, value=0.55, sat=0.4, bump=0.9),
        "reveal": pbr("RevealBrick", "brick", 1.6, "#f7ebd3", 0.75, value=1.3, sat=0.35, bump=0.5),
        # ground and paving
        "paver": pbr("LimestonePavers", "paver", 2.0, "#efe4cf", 0.3, value=1.0, sat=0.8, rough_mul=1.4, bump=0.4),
        "limestone_paver": pbr("DeckPavers", "paver", 2.0, "#efe4cf", 0.3, value=1.0, sat=0.8, rough_mul=1.4, bump=0.4),
        "aggregate": pbr("ExposedAggregate", "gravel", 0.9, "#f0e3cb", 0.6, value=1.3, sat=0.8, bump=0.7),
        "gravel": pbr("DGGravel", "gravel", 1.5, None, 0.0, bump=0.8),
        "drive": pbr("DriveConcrete", "concrete", 3.0, "#e4ded2", 0.3, value=1.05, sat=0.6),
        "lawn_ground": pbr("LawnGround", "lawn_ground", 4.0, "#5f9a3a", 0.55, value=0.95, sat=1.3, bump=0.4),
        "sand": pbr("BeachSand", "sand", 3.0, None, 0.0, bump=0.6),
        "mulch": pbr("Mulch", "mulch", 1.5, "#6a4a32", 0.3, value=0.8, bump=0.8),
        # interiors
        "floor_oak": pbr("WhiteOakFloor", "floor_oak", 2.0, "#e2c9a4", 0.35, value=1.05, sat=0.8, rough_mul=0.9, bump=0.3),
        "plaster_int": pbr("InteriorPlaster", "plaster", 2.0, "#eadfcb", 0.75, value=1.05, sat=0.3, bump=0.15),
        "ceiling": paint("CeilingPaint", "#f4f1ea", 0.85),
        "teal": paint("TealAccentWall", "#24495a", 0.75),
        "lawn": None,
        "beam": paint("EspressoBeam", "#2e2420", 0.55, 25.0),
    })
    M["lawn"] = M["lawn_ground"]
    M["glass"] = arch_glass()
    return M
