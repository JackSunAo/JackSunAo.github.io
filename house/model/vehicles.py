"""Detailed helicopter (light single-engine, ~13 m with rotors) and day-cruiser yacht (~11 m),
replacing the massing blobs. Both are lofted from cross-sections and smoothed.

Helicopter local frame: y forward (nose +y), x right, z up; origin on the pad between the skids.
Yacht local frame: bow +y, origin at the waterline.
"""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector

import interiors as I

COLL = None


def _m(name, hexcol, rough=0.5, metal=0.0, **kw):
    return I.mat(name, hexcol, rough, metal, **kw)


def _paint(name, hexcol, rough=0.2, metal=0.2):
    m = _m(name, hexcol, rough, metal)
    m.node_tree.nodes["Principled BSDF"].inputs["Coat Weight"].default_value = 1.0
    m.node_tree.nodes["Principled BSDF"].inputs["Coat Roughness"].default_value = 0.03
    return m


def loft(name, sections, seg, mats, zone=None, cap0=True, cap1=True, subsurf=1):
    """sections: [(y, half_w, half_h, zc, n)] superellipse rings along y. zone(face centre, section index) -> mat idx."""
    bm = bmesh.new()
    rings = []
    for (y, w, h, zc, n) in sections:
        ring = []
        for k in range(seg):
            a = 2 * math.pi * k / seg
            c, s = math.cos(a), math.sin(a)
            x = w * math.copysign(abs(c) ** (2 / n), c)
            z = zc + h * math.copysign(abs(s) ** (2 / n), s)
            ring.append(bm.verts.new((x, y, z)))
        rings.append(ring)
    for i in range(len(rings) - 1):
        a, b = rings[i], rings[i + 1]
        for k in range(seg):
            f = bm.faces.new((a[k], a[(k + 1) % seg], b[(k + 1) % seg], b[k]))
            if zone:
                f.material_index = zone(f.calc_center_median(), i)
    for ring, flag in ((rings[0], cap0), (rings[-1], cap1)):
        if flag:
            f = bm.faces.new(ring)
            if zone:
                f.material_index = zone(f.calc_center_median(), 0)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    o = bpy.data.objects.new(name, me)
    for m in mats:
        o.data.materials.append(m)
    if subsurf:
        sd = o.modifiers.new("smooth", "SUBSURF")
        sd.levels = sd.render_levels = subsurf
    COLL.objects.link(o)
    return o


def _section_at(secs, y):
    """Linear interpolation of (half_w, half_h, zc, n) along y in a loft section list (sorted by y, either way)."""
    pts = sorted(secs, key=lambda q: q[0])
    if y <= pts[0][0]:
        return pts[0][1:]
    for a, b in zip(pts, pts[1:]):
        if a[0] <= y <= b[0]:
            t = (y - a[0]) / (b[0] - a[0])
            return tuple(a[k] + (b[k] - a[k]) * t for k in range(1, 5))
    return pts[-1][1:]


def skin_patch(name, secs, y0, y1, a0, a1, scale, m, ny=24, na=40):
    """A surface patch on a lofted superellipse body between y0..y1 and angles a0..a1, pushed out by `scale`."""
    bm = bmesh.new()
    rows = []
    for j in range(ny + 1):
        y = y0 + (y1 - y0) * j / ny
        w, h, zc, n = _section_at(secs, y)
        row = []
        for k in range(na + 1):
            a = a0 + (a1 - a0) * k / na
            c, s_ = math.cos(a), math.sin(a)
            x = w * scale * math.copysign(abs(c) ** (2 / n), c)
            z = zc + h * scale * math.copysign(abs(s_) ** (2 / n), s_)
            row.append(bm.verts.new((x, y, z)))
        rows.append(row)
    for j in range(ny):
        for k in range(na):
            bm.faces.new((rows[j][k], rows[j][k + 1], rows[j + 1][k + 1], rows[j + 1][k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    o = bpy.data.objects.new(name, me)
    o.data.materials.append(m)
    sol = o.modifiers.new("t", "SOLIDIFY")
    sol.thickness, sol.offset = 0.004, 1.0
    COLL.objects.link(o)
    return o


def tube_path(name, pts, r, m):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    sp = cu.splines.new("POLY")
    sp.points.add(len(pts) - 1)
    for p, c in zip(sp.points, pts):
        p.co = (*c, 1)
    cu.bevel_depth, cu.bevel_resolution = r, 3
    cu.use_fill_caps = True
    o = bpy.data.objects.new(name, cu)
    o.data.materials.append(m)
    COLL.objects.link(o)
    return o


def prism_yz(name, pts, x0, t, m):
    """Profile in the y-z plane extruded across x (fins)."""
    bm = bmesh.new()
    a = [bm.verts.new((x0 - t / 2, y, z)) for y, z in pts]
    b = [bm.verts.new((x0 + t / 2, y, z)) for y, z in pts]
    bm.faces.new(a)
    bm.faces.new(list(reversed(b)))
    for i in range(len(pts)):
        j = (i + 1) % len(pts)
        bm.faces.new((a[i], a[j], b[j], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    o.data.materials.append(m)
    bv = o.modifiers.new("bevel", "BEVEL")
    bv.width, bv.segments = 0.02, 3
    COLL.objects.link(o)
    return o


def _parent(objs, root):
    for o in objs:
        o.parent = root


# ---------------------------------------------------------------- helicopter
def helicopter(x, y, z, heading):
    for o in list(bpy.data.objects):
        if o.name.startswith("Heli_") or o.name == "Helicopter":
            bpy.data.objects.remove(o, do_unlink=True)
    cream = _paint("HeliCream", "#efe6d3", 0.22, 0.25)
    bronze = _paint("HeliBronze", "#3a3632", 0.25, 0.5)
    glass = _m("HeliGlass", "#0d1218", 0.04)
    glass.node_tree.nodes["Principled BSDF"].inputs["Coat Weight"].default_value = 1.0
    dark = _m("HeliDark", "#1b1c1e", 0.45, 0.6)
    steel = _m("HeliSkidSteel", "#c9c9c6", 0.3, 1.0)
    objs = []
    secs = [(2.45, 0.06, 0.06, 1.30, 2.0), (2.32, 0.42, 0.42, 1.33, 2.2), (2.05, 0.62, 0.64, 1.42, 2.4),
            (1.55, 0.76, 0.80, 1.50, 2.6), (0.80, 0.82, 0.88, 1.55, 2.8), (0.00, 0.82, 0.90, 1.58, 2.8),
            (-0.70, 0.78, 0.85, 1.63, 2.7), (-1.30, 0.62, 0.66, 1.79, 2.5), (-1.80, 0.40, 0.43, 1.98, 2.3),
            (-2.20, 0.26, 0.26, 2.08, 2.0)]

    def zone(c, i):
        return 1 if c.z < 1.12 else 0                  # bronze belly band below the waterline
    objs.append(loft("Heli_Fuselage", secs, 48, [cream, bronze], zone))
    # glazing as smooth patches laid just proud of the skin (clean edges, no per-face stair-steps):
    # wrap-around windscreen with chin bubble, and a window in each cabin door; slim black frames
    frame = _m("HeliFrame", "#141414", 0.4, 0.3)
    objs.append(skin_patch("Heli_Windscreen", secs, 0.62, 2.36, -0.62, math.pi + 0.62, 1.006, glass))
    objs.append(skin_patch("Heli_WindscreenFrame", secs, 0.56, 0.64, -0.66, math.pi + 0.66, 1.009, frame))
    objs.append(skin_patch("Heli_Pillar", secs, 0.62, 2.0, math.pi / 2 - 0.035, math.pi / 2 + 0.035, 1.009, frame))
    for side, (a0, a1) in (("R", (0.12, 0.78)), ("L", (math.pi - 0.78, math.pi - 0.12))):
        objs.append(skin_patch(f"Heli_DoorWin{side}", secs, -0.72, 0.42, a0, a1, 1.006, glass))
        objs.append(skin_patch(f"Heli_DoorSeam{side}", secs, -0.78, -0.75, -0.75, 0.95, 1.004, frame) if side == "R" else
                    skin_patch(f"Heli_DoorSeam{side}", secs, -0.78, -0.75, math.pi - 0.95, math.pi + 0.75, 1.004, frame))
    objs.append(loft("Heli_Cowling", [(0.35, 0.22, 0.08, 2.40, 2.5), (0.0, 0.46, 0.24, 2.46, 2.8), (-1.0, 0.48, 0.28, 2.48, 2.8),
                                      (-1.6, 0.40, 0.22, 2.42, 2.6), (-1.98, 0.18, 0.10, 2.32, 2.2)], 28, [cream]))
    objs.append(loft("Heli_Boom", [(-2.15, 0.26, 0.26, 2.08, 2.0), (-4.4, 0.18, 0.18, 2.14, 2.0), (-6.75, 0.11, 0.12, 2.20, 2.0)],
                     24, [cream], subsurf=0))
    objs.append(loft("Heli_Exhaust", [(-1.55, 0.09, 0.09, 2.55, 2.0), (-2.0, 0.08, 0.08, 2.5, 2.0)], 16, [dark], subsurf=0))
    # fin, stabiliser with end plates, tail rotor, tail skid
    objs.append(prism_yz("Heli_Fin", [(-6.05, 2.12), (-6.45, 3.30), (-6.88, 3.30), (-6.78, 2.12), (-6.82, 1.58), (-6.48, 1.58)], 0.0, 0.08, cream))
    objs.append(I.box("Heli_Stab", -1.1, 1.1, -5.75, -5.3, 2.10, 2.16, cream, 0.01))
    for s in (-1, 1):
        objs.append(prism_yz(f"Heli_EndPlate{s}", [(-5.25, 1.95), (-5.4, 2.55), (-5.75, 2.55), (-5.75, 1.95)], s * 1.12, 0.04, cream))
    objs.append(I.cyl("Heli_TRHub", 0.18, -6.5, 2.62, 2.7, 0.07, dark, 16))
    for k, a in enumerate((25, 205)):
        b = I.box(f"Heli_TRBlade{k}", -0.015, 0.015, -0.06, 0.06, 0.0, 0.85, dark, 0.005)
        b.location = (0.26, -6.5, 2.66)
        b.rotation_euler = (math.radians(a), 0, 0)
        objs.append(b)
    objs.append(tube_path("Heli_TailSkid", [(0, -6.3, 1.98), (0, -6.75, 1.45), (0, -6.95, 1.42)], 0.02, steel))
    # mast, hub, three blades with a slight droop
    objs.append(I.cyl("Heli_Mast", 0, -0.15, 2.7, 3.02, 0.09, dark, 16))
    objs.append(I.cyl("Heli_Hub", 0, -0.15, 3.0, 3.12, 0.24, dark, 24))
    for k in range(3):
        a = math.radians(30 + k * 120)
        b = I.box(f"Heli_Blade{k}", -0.17, 0.17, 0.0, 5.3, -0.02, 0.02, dark, 0.008)
        b.location = (0, -0.15, 3.06)
        b.rotation_euler = (math.radians(-1.5), 0, a)       # droop about the blade's own x, then the azimuth
        objs.append(b)
    # skids: long tubes with upturned toes, bent cross tubes
    for s in (-1, 1):
        objs.append(tube_path(f"Heli_Skid{s}", [(s * 1.1, -1.55, 0.06), (s * 1.1, 1.95, 0.06), (s * 1.1, 2.25, 0.16), (s * 1.1, 2.4, 0.34)], 0.045, steel))
    for yy in (1.2, -0.9):
        objs.append(tube_path(f"Heli_Cross{yy}", [(-1.1, yy, 0.08), (-1.0, yy, 0.45), (-0.62, yy, 0.72), (0.62, yy, 0.72),
                                                  (1.0, yy, 0.45), (1.1, yy, 0.08)], 0.04, steel))
    objs.append(I.cyl("Heli_Beacon", 0, -1.1, 2.72, 2.78, 0.04, _m("BeaconRed", "#d8261c", 0.3, emit=((1, 0.1, 0.05), 2.0)), 12))
    root = bpy.data.objects.new("Helicopter", None)
    COLL.objects.link(root)
    _parent(objs, root)
    root.location = (x, y, z)
    root.rotation_euler = (0, 0, math.radians(heading))
    return root


# ---------------------------------------------------------------- yacht
def yacht(x, y, z_water, heading=0.0):
    for o in list(bpy.data.objects):
        if o.name.startswith("Yacht_"):
            bpy.data.objects.remove(o, do_unlink=True)
    gel = _paint("Gelcoat", "#f7f7f5", 0.08, 0.0)
    navy = _paint("HullNavy", "#1c2b44", 0.12, 0.0)
    teak = _m("TeakDeck", "#9a7148", 0.6)
    glass = _m("YachtGlass", "#16202a", 0.03)
    steel = _m("YachtSteel", "#d5d5d2", 0.15, 1.0)
    cush = _m("Cushion", "#f1ede4", 0.8)
    L = 11.0
    bm = bmesh.new()
    rings = []
    n = 26
    for i in range(n + 1):
        t = i / n
        yy = -L / 2 + t * L
        hb = 1.75 if t < 0.55 else 1.75 * max(0.03, math.cos((t - 0.55) / 0.45 * math.pi / 2) ** 0.75)
        zs = 1.05 + 0.4 * t * t
        zk = -0.6 if t < 0.78 else -0.6 + (t - 0.78) / 0.22 * 1.15
        zch = 0.12 + 0.25 * max(0.0, t - 0.6)
        side = [(0.0, zk), (0.42 * hb, zk + 0.33 * (zch - zk)), (0.86 * hb, zch), (0.93 * hb, zch + 0.03),
                (0.98 * hb, (zch + zs) / 2), (hb, zs)]
        full = [(-px, pz) for px, pz in reversed(side)] + side[1:]
        rings.append([bm.verts.new((px, yy, pz)) for px, pz in full])
    m = len(rings[0])
    for i in range(n):
        a, b = rings[i], rings[i + 1]
        for k in range(m - 1):
            f = bm.faces.new((a[k], a[k + 1], b[k + 1], b[k]))
            c = f.calc_center_median()
            f.material_index = 1 if c.z > rings[i][0].co.z - 0.34 else 0       # navy sheer band
    bm.faces.new(rings[0])                                                       # transom
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("Yacht_Hull")
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    hull = bpy.data.objects.new("Yacht_Hull", me)
    hull.data.materials.append(gel)
    hull.data.materials.append(navy)
    hull.modifiers.new("smooth", "SUBSURF").levels = 1
    COLL.objects.link(hull)
    objs = [hull]
    # teak deck as a flat ring cap at the sheer (stepping up toward the bow)
    bm = bmesh.new()
    prev = None
    for i in range(n + 1):
        t = i / n
        yy = -L / 2 + t * L
        hb = (1.75 if t < 0.55 else 1.75 * max(0.03, math.cos((t - 0.55) / 0.45 * math.pi / 2) ** 0.75)) - 0.08
        zs = 1.05 + 0.4 * t * t - 0.02
        pair = (bm.verts.new((-hb, yy, zs)), bm.verts.new((hb, yy, zs)))
        if prev:
            bm.faces.new((prev[0], prev[1], pair[1], pair[0]))
        prev = pair
    me = bpy.data.meshes.new("Yacht_Deck")
    bm.to_mesh(me)
    bm.free()
    deck = bpy.data.objects.new("Yacht_Deck", me)
    deck.data.materials.append(teak)
    COLL.objects.link(deck)
    objs.append(deck)
    # cockpit: helm console with raked windscreen, hardtop on stainless posts, seating, bow sun pad, rails, platform
    objs.append(I.box("Yacht_Console", -1.2, 1.2, 0.4, 1.4, 1.05, 1.95, gel, 0.05))
    ws = I.box("Yacht_Windscreen", -1.25, 1.25, -0.02, 0.02, 0.0, 0.75, glass, 0.01)
    ws.location = (0, 1.42, 1.93)
    ws.rotation_euler = (math.radians(-35), 0, 0)
    objs.append(ws)
    objs.append(I.box("Yacht_Hardtop", -1.45, 1.45, -1.6, 1.6, 2.95, 3.05, gel, 0.04))
    for (px, py) in ((-1.3, 1.3), (1.3, 1.3), (-1.3, -1.4), (1.3, -1.4)):
        objs.append(I.cyl(f"Yacht_Post{px}{py}", px, py, 1.05, 2.95, 0.03, steel, 12))
    objs.append(I.box("Yacht_Bench", -1.5, 1.5, -3.9, -3.2, 1.05, 1.5, cush, 0.06))
    objs.append(I.box("Yacht_BenchBack", -1.5, 1.5, -4.15, -3.85, 1.05, 1.95, cush, 0.06))
    objs.append(I.box("Yacht_Helm", 0.3, 1.0, -0.4, 0.2, 1.05, 1.55, cush, 0.06))
    objs.append(I.box("Yacht_SunPad", -0.85, 0.85, 2.2, 3.7, 1.25, 1.42, cush, 0.08))
    for s in (-1, 1):
        objs.append(tube_path(f"Yacht_Rail{s}", [(s * 1.6, 0.8, 1.5), (s * 1.55, 2.5, 1.75), (s * 1.2, 4.0, 1.95),
                                                 (s * 0.45, 5.0, 2.05), (0, 5.25, 2.08)], 0.016, steel))
        for py in (1.5, 3.0, 4.3):
            objs.append(I.cyl(f"Yacht_Stanchion{s}{py}", s * (1.55 if py < 2 else (1.3 if py < 3.5 else 0.8)), py,
                              1.05 + 0.4 * ((py + 5.5) / 11) ** 2, 1.8 + 0.2 * (py / 5), 0.012, steel, 8))
    objs.append(I.box("Yacht_SwimPlatform", -1.6, 1.6, -6.1, -5.45, 0.18, 0.26, teak, 0.02))
    objs.append(I.box("Yacht_Engine", -0.55, 0.55, -6.3, -5.6, -0.25, 0.75, _m("OutboardBlack", "#141414", 0.35, 0.3), 0.08))
    root = bpy.data.objects.new("Yacht", None)
    COLL.objects.link(root)
    _parent(objs, root)
    root.location = (x, y, z_water)
    root.rotation_euler = (0, 0, math.radians(heading))
    return root


def jet_ski(name, x, y, z, heading):
    """Personal watercraft: deep-V hull, deck, seat, handlebar, on a dock lift."""
    gel = _paint("JetSkiPaint", "#eef0f2", 0.12, 0.0)
    accent = _paint("JetSkiAccent", "#1c2b44", 0.2, 0.2)
    black = _m("JetSkiBlack", "#151515", 0.5)
    secs = [(1.55, 0.05, 0.05, 0.42, 2.0), (1.3, 0.38, 0.25, 0.38, 2.2), (0.8, 0.56, 0.32, 0.36, 2.6), (0.0, 0.6, 0.33, 0.35, 2.8),
            (-0.8, 0.58, 0.32, 0.34, 2.8), (-1.45, 0.52, 0.28, 0.34, 2.6), (-1.6, 0.45, 0.22, 0.36, 2.4)]
    objs = [loft(name + "_hull", secs, 32, [gel, accent], lambda c, i: 1 if c.z < 0.2 else 0)]
    objs.append(loft(name + "_seat", [(0.35, 0.05, 0.05, 0.75, 2.0), (0.2, 0.22, 0.1, 0.76, 2.5), (-0.9, 0.22, 0.1, 0.76, 2.5),
                                      (-1.05, 0.05, 0.05, 0.74, 2.0)], 20, [black]))
    objs.append(loft(name + "_cowl", [(1.2, 0.05, 0.05, 0.66, 2.0), (1.0, 0.32, 0.12, 0.72, 2.4), (0.45, 0.34, 0.16, 0.78, 2.6),
                                      (0.35, 0.05, 0.05, 0.8, 2.0)], 24, [gel]))
    objs.append(tube_path(name + "_bar", [(-0.38, 0.55, 0.98), (0.38, 0.55, 0.98)], 0.018, black))
    root = bpy.data.objects.new(name, None)
    COLL.objects.link(root)
    _parent(objs, root)
    root.location = (x, y, z)
    root.rotation_euler = (0, 0, math.radians(heading))
    return root


def boathouse_finish(bm):
    """Boathouse upper-deck railing as glass with a black cap (the massing rail was a solid slab)."""
    rail = bpy.data.objects.get("BH_Rail")
    if rail is None:
        return
    bb = [rail.matrix_world @ Vector(c) for c in rail.bound_box]
    x1, x2 = min(v.x for v in bb), max(v.x for v in bb)
    y1, y2 = min(v.y for v in bb), max(v.y for v in bb)
    z1, z2 = min(v.z for v in bb), max(v.z for v in bb)
    rail.hide_render = True
    glass = bpy.data.materials.get("ArchGlass") or _m("RailGlass", "#cfdde0", 0.03, transmission=1.0)
    black = _m("SteelFrame", "#121212", 0.4, 0.8)
    I.box("BH_RailGlass", x1, x2, (y1 + y2) / 2 - 0.006, (y1 + y2) / 2 + 0.006, z1 + 0.06, z2 - 0.05, glass)
    I.box("BH_RailCap", x1, x2, y1 - 0.02, y2 + 0.02, z2 - 0.05, z2, black)
    for k in range(int((x2 - x1) / 1.6) + 1):
        x = x1 + k * (x2 - x1) / int((x2 - x1) / 1.6)
        I.box(f"BH_RailPost{k}", x - 0.03, x + 0.03, y1 - 0.02, y2 + 0.02, z1, z2, black)


def build(bm, M, coll):
    global COLL
    COLL = coll
    I.COLL = coll
    zp = bm.ground(66, 51) + 0.25
    helicopter(66, 51, zp, 200)
    # yacht easing out of the boathouse slip toward the open lake
    yacht(40.5, 122.0, bm.LAKE + 0.05, 0.0)
    for o in list(bpy.data.objects):
        if o.name.startswith("JetSki") and o.type == "MESH" and "_" not in o.name:
            loc = o.location.copy()
            bpy.data.objects.remove(o, do_unlink=True)
            jet_ski(f"PWC{loc.x:.0f}", loc.x, loc.y, bm.LAKE + 0.45, 0.0)
    boathouse_finish(bm)
