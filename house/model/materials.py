"""Procedural PBR materials for the detailed model (no image textures needed).

Every wall/roof material uses a world-space "facade" coordinate: u runs along the wall
(x for walls facing ±Y, y for walls facing ±X) and v is height, so bricks, stone courses,
siding boards and shingle rows line up across separate objects without UV unwrapping.
Palette: house/design colours taken from the reference image.
"""
import bpy

PALETTE = {
    "shingle": "#2B2B2D",      # architectural asphalt shingles, charcoal
    "metal": "#3A3632",        # standing-seam porch roof, dark bronze
    "siding": "#9B9081",       # lap siding, warm taupe (≈ SW 7032 Warm Stone)
    "trim": "#E9DFCB",         # fascia, window casing, gutters (≈ SW 7012 Creamy)
    "stone": "#E4D6B8",        # chopped limestone
    "brick": "#ECE2CF",        # light cream brick
    "mortar": "#F3EDE0",
    "frame": "#1E1C1A",        # black-bronze window frames
    "door": "#2A1E17",         # dark walnut entry door
    "aggregate": "#C9BBA6",    # exposed-aggregate walkway
    "paver": "#E3DACB",        # walkway border pavers
}


def lin(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c) + (1.0,)


def shade(h, k):
    """Scale a hex colour's linear value by k (k < 1 darker)."""
    r, g, b, a = lin(h)
    return (min(1, r * k), min(1, g * k), min(1, b * k), 1.0)


def _new(name):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return m, nt, bsdf


def facade_coords(nt):
    """Vector(u, v, 0) in metres: u along the wall, v = height (see module docstring)."""
    g = bpy.data.node_groups.get("FacadeCoords")
    if g is None:
        g = bpy.data.node_groups.new("FacadeCoords", "ShaderNodeTree")
        g.interface.new_socket("Vector", in_out="OUTPUT", socket_type="NodeSocketVector")
        n = g.nodes
        geo = n.new("ShaderNodeNewGeometry")
        pos = n.new("ShaderNodeSeparateXYZ")
        nrm = n.new("ShaderNodeSeparateXYZ")
        g.links.new(geo.outputs["Position"], pos.inputs[0])
        g.links.new(geo.outputs["Normal"], nrm.inputs[0])
        ax = n.new("ShaderNodeMath"); ax.operation = "ABSOLUTE"
        ay = n.new("ShaderNodeMath"); ay.operation = "ABSOLUTE"
        g.links.new(nrm.outputs["X"], ax.inputs[0])
        g.links.new(nrm.outputs["Y"], ay.inputs[0])
        gt = n.new("ShaderNodeMath"); gt.operation = "GREATER_THAN"
        g.links.new(ax.outputs[0], gt.inputs[0])
        g.links.new(ay.outputs[0], gt.inputs[1])
        mix = n.new("ShaderNodeMix"); mix.data_type = "FLOAT"
        g.links.new(gt.outputs[0], mix.inputs["Factor"])
        g.links.new(pos.outputs["X"], mix.inputs["A"])
        g.links.new(pos.outputs["Y"], mix.inputs["B"])
        comb = n.new("ShaderNodeCombineXYZ")
        g.links.new(mix.outputs["Result"], comb.inputs["X"])
        g.links.new(pos.outputs["Z"], comb.inputs["Y"])
        go = n.new("NodeGroupOutput")
        g.links.new(comb.outputs[0], go.inputs[0])
    node = nt.nodes.new("ShaderNodeGroup")
    node.node_tree = g
    return node


def _noise(nt, vec_socket, scale, detail=4.0):
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = scale
    nz.inputs["Detail"].default_value = detail
    nt.links.new(vec_socket, nz.inputs["Vector"])
    return nz


def _bump(nt, bsdf, height_socket, strength, distance=0.02):
    b = nt.nodes.new("ShaderNodeBump")
    b.inputs["Strength"].default_value = strength
    b.inputs["Distance"].default_value = distance
    nt.links.new(height_socket, b.inputs["Height"])
    nt.links.new(b.outputs["Normal"], bsdf.inputs["Normal"])
    return b


def masonry(name, base, mortar, brick_w, brick_h, mortar_w, var=0.12, rough=0.85, bump=0.6, offset=0.5):
    """Brick / cut stone: Brick Texture in facade coords + colour variation + mortar relief."""
    m, nt, bsdf = _new(name)
    fc = facade_coords(nt)
    br = nt.nodes.new("ShaderNodeTexBrick")
    br.offset = offset
    br.inputs["Scale"].default_value = 1.0
    br.inputs["Brick Width"].default_value = brick_w
    br.inputs["Row Height"].default_value = brick_h
    br.inputs["Mortar Size"].default_value = mortar_w
    br.inputs["Mortar Smooth"].default_value = 0.15
    br.inputs["Bias"].default_value = 0.0
    br.inputs["Color1"].default_value = shade(base, 1 - var)
    br.inputs["Color2"].default_value = shade(base, 1 + var * 0.6)
    br.inputs["Mortar"].default_value = lin(mortar)
    nt.links.new(fc.outputs[0], br.inputs["Vector"])
    # subtle surface mottling on top of the per-brick colour
    nz = _noise(nt, fc.outputs[0], 6.0)
    mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"; mix.blend_type = "MULTIPLY"
    mix.inputs["Factor"].default_value = 0.12
    nt.links.new(br.outputs["Color"], mix.inputs["A"])
    nt.links.new(nz.outputs["Color"], mix.inputs["B"])
    nt.links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = rough
    inv = nt.nodes.new("ShaderNodeMath"); inv.operation = "SUBTRACT"
    inv.inputs[0].default_value = 1.0
    nt.links.new(br.outputs["Fac"], inv.inputs[1])
    _bump(nt, bsdf, inv.outputs[0], bump, 0.01)
    return m


def siding(name, color, exposure=0.18, rough=0.6):
    """Horizontal lap siding: sawtooth wave on height gives each board a shadow line."""
    m, nt, bsdf = _new(name)
    fc = facade_coords(nt)
    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.wave_type = "BANDS"
    wave.bands_direction = "Y"
    wave.wave_profile = "SAW"
    wave.inputs["Scale"].default_value = 1.0 / exposure / 3.14159 * 0.5 * 3.14159 * 2
    wave.inputs["Distortion"].default_value = 0.0
    nt.links.new(fc.outputs[0], wave.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = shade(color, 0.82)
    ramp.color_ramp.elements[1].color = shade(color, 1.05)
    nt.links.new(wave.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = rough
    _bump(nt, bsdf, wave.outputs["Fac"], 0.5, 0.015)
    return m


def shingles(name, color, rough=0.9):
    """Architectural shingles: staggered tabs of random width, rows following height."""
    m, nt, bsdf = _new(name)
    fc = facade_coords(nt)
    br = nt.nodes.new("ShaderNodeTexBrick")
    br.offset = 0.37
    br.offset_frequency = 1
    br.inputs["Scale"].default_value = 1.0
    br.inputs["Brick Width"].default_value = 0.42
    br.inputs["Row Height"].default_value = 0.10
    br.inputs["Mortar Size"].default_value = 0.006
    br.inputs["Color1"].default_value = shade(color, 0.75)
    br.inputs["Color2"].default_value = shade(color, 1.35)
    br.inputs["Mortar"].default_value = shade(color, 0.35)
    nt.links.new(fc.outputs[0], br.inputs["Vector"])
    nz = _noise(nt, fc.outputs[0], 40.0, 2.0)
    mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"; mix.blend_type = "MULTIPLY"
    mix.inputs["Factor"].default_value = 0.35
    nt.links.new(br.outputs["Color"], mix.inputs["A"])
    nt.links.new(nz.outputs["Color"], mix.inputs["B"])
    nt.links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = rough
    _bump(nt, bsdf, br.outputs["Fac"], 0.35, 0.01)
    return m


def standing_seam(name, color, seam=0.45):
    m, nt, bsdf = _new(name)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Object"], sep.inputs[0])
    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.wave_type = "BANDS"
    wave.bands_direction = "X"
    wave.wave_profile = "SIN"
    wave.inputs["Scale"].default_value = 1.0 / seam
    wave.inputs["Distortion"].default_value = 0.0
    nt.links.new(tc.outputs["Object"], wave.inputs["Vector"])
    pw = nt.nodes.new("ShaderNodeMath"); pw.operation = "POWER"
    pw.inputs[1].default_value = 12.0
    nt.links.new(wave.outputs["Fac"], pw.inputs[0])
    bsdf.inputs["Base Color"].default_value = lin(color)
    bsdf.inputs["Metallic"].default_value = 0.6
    bsdf.inputs["Roughness"].default_value = 0.38
    _bump(nt, bsdf, pw.outputs[0], 0.8, 0.02)
    return m


def plain(name, color, rough=0.6, metal=0.0, bump_scale=0.0):
    m, nt, bsdf = _new(name)
    bsdf.inputs["Base Color"].default_value = lin(color)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if bump_scale:
        tc = nt.nodes.new("ShaderNodeTexCoord")
        nz = _noise(nt, tc.outputs["Object"], bump_scale, 6.0)
        _bump(nt, bsdf, nz.outputs["Fac"], 0.25, 0.01)
    return m


def aggregate(name, base):
    """Exposed-aggregate concrete: fine Voronoi pebbles over a sandy base."""
    m, nt, bsdf = _new(name)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    vor = nt.nodes.new("ShaderNodeTexVoronoi")
    vor.inputs["Scale"].default_value = 90.0
    nt.links.new(tc.outputs["Object"], vor.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = shade(base, 0.7)
    ramp.color_ramp.elements[1].color = shade(base, 1.15)
    nt.links.new(vor.outputs["Color"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.8
    _bump(nt, bsdf, vor.outputs["Distance"], 0.4, 0.005)
    return m


def glass(name, interior=None, strength=0.0):
    """Window glass. With `interior`, a warm emission stands in for lit rooms behind it (dusk shots)."""
    m, nt, bsdf = _new(name)
    bsdf.inputs["Base Color"].default_value = (0.02, 0.025, 0.03, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.03
    bsdf.inputs["Specular IOR Level"].default_value = 0.6
    if interior:
        bsdf.inputs["Emission Color"].default_value = lin(interior)
        bsdf.inputs["Emission Strength"].default_value = strength
    return m


def water(name, color, ripple=6.0):
    m, nt, bsdf = _new(name)
    bsdf.inputs["Base Color"].default_value = lin(color)
    bsdf.inputs["Roughness"].default_value = 0.02
    bsdf.inputs["Transmission Weight"].default_value = 0.0
    bsdf.inputs["Specular IOR Level"].default_value = 0.7
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nz = _noise(nt, tc.outputs["Object"], ripple, 3.0)
    _bump(nt, bsdf, nz.outputs["Fac"], 0.12, 0.05)
    return m


def lawn(name):
    m, nt, bsdf = _new(name)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nz = _noise(nt, tc.outputs["Object"], 0.4, 6.0)
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = lin("#4f7a2c")
    ramp.color_ramp.elements[1].color = lin("#7aa847")
    nt.links.new(nz.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.95
    fine = _noise(nt, tc.outputs["Object"], 60.0, 2.0)
    _bump(nt, bsdf, fine.outputs["Fac"], 0.5, 0.01)
    return m


def build_all(dusk=True):
    """Create every detailed material; returns {massing material name: new material}."""
    P = PALETTE
    mats = {
        "brick": masonry("Brick", P["brick"], P["mortar"], 0.215, 0.067, 0.010, 0.07, 0.85, 0.5),
        "stone": masonry("Limestone", P["stone"], P["mortar"], 0.62, 0.30, 0.012, 0.16, 0.9, 0.9, 0.42),
        "siding": siding("LapSiding", P["siding"]),
        "shingle": shingles("Shingles", P["shingle"]),
        "metal": standing_seam("StandingSeam", P["metal"]),
        "trim": plain("Trim", P["trim"], 0.5),
        "frame": plain("WindowFrame", P["frame"], 0.4, 0.3),
        "door": plain("EntryDoor", P["door"], 0.45),
        "glass": glass("Glass", "#ffb866" if dusk else None, 2.2 if dusk else 0.0),
        "glass_dark": glass("GlassDark"),
        "aggregate": aggregate("Aggregate", P["aggregate"]),
        "paver": plain("Paver", P["paver"], 0.8, 0.0, 30.0),
        "lawn": lawn("Lawn"),
        "pool": water("PoolWater", "#2f9fb8", 3.0),
        "lake": water("LakeWater", "#2d5566", 0.8),
        "lantern": plain("LanternGlow", "#ffcf8a", 0.4),
    }
    lg = mats["lantern"].node_tree.nodes["Principled BSDF"]
    lg.inputs["Emission Color"].default_value = lin("#ffb35c")
    lg.inputs["Emission Strength"].default_value = 25.0 if dusk else 0.0
    return mats
