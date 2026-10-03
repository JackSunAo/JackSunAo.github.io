"""Windows, doors and facade trim for the real house (house_real.WINDOWS).

Glass and frames sit inside the wall opening, 0.12–0.2 m behind the outer face, so every window
has a real reveal. Surrounds follow the reference: cream casing + sill on siding, black flat head +
cast-stone sill on brick and stone. Great-room transoms get arched heads.
"""
import math

import bmesh
import bpy

import house_real as H

FRAME_W, FRAME_D, RECESS = 0.07, 0.07, 0.14


def _box(name, x1, x2, y1, y2, z1, z2, mat, coll):
    return H._box(name, min(x1, x2), max(x1, x2), min(y1, y2), max(y1, y2), z1, z2, mat, coll)


def _fb(spec, name, u1, u2, d1, d2, z1, z2, mat, coll):
    """Box in facade space: u along the wall, d outward from the outer wall face."""
    axis, plane, out = spec[1], spec[2], spec[7]
    y1, y2 = plane + out * d1, plane + out * d2
    if axis == "y":
        return _box(name, u1, u2, y1, y2, z1, z2, mat, coll)
    return _box(name, y1, y2, u1, u2, z1, z2, mat, coll)


def _arch_glass(spec, name, a, b, z1, z2, d, mat, coll, frame_mat, spandrel_mat):
    """Arched-top window panel (segmental arch springing at 70% height) + arched frame."""
    axis, plane, out = spec[1], spec[2], spec[7]
    w = b - a
    spring = z1 + (z2 - z1) * 0.62
    rise = z2 - spring
    r = (w * w / 4 + rise * rise) / (2 * rise)
    cu, cz = (a + b) / 2, z2 - r
    pts = [(a, z1), (b, z1), (b, spring)]
    for i in range(1, 16):
        t = i / 16
        ang = math.atan2(spring - cz, b - cu) + t * (math.pi - 2 * math.atan2(spring - cz, b - cu))
        pts.append((cu + r * math.cos(ang), cz + r * math.sin(ang)))
    pts.append((a, spring))

    def P(u, z, dd):
        yy = plane + out * dd
        return (u, yy, z) if axis == "y" else (yy, u, z)
    bmm = bmesh.new()
    v0 = [bmm.verts.new(P(u, z, d)) for u, z in pts]
    v1 = [bmm.verts.new(P(u, z, d + 0.01)) for u, z in pts]
    bmm.faces.new(v0)
    bmm.faces.new(list(reversed(v1)))
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bmm.faces.new((v0[i], v0[j], v1[j], v1[i]))
    me = bpy.data.meshes.new(name)
    bmm.to_mesh(me)
    bmm.free()
    o = bpy.data.objects.new(name, me)
    o.data.materials.append(mat)
    coll.objects.link(o)
    # arched frame: thin tube along the arch
    curve = bpy.data.curves.new(name + "_arc", "CURVE")
    curve.dimensions = "3D"
    sp = curve.splines.new("POLY")
    arc = pts[2:] + [pts[0]]
    sp.points.add(len(arc) - 1)
    for k, (u, z) in enumerate(arc):
        x, y, zz = P(u, z, d + 0.03)
        sp.points[k].co = (x, y, zz, 1)
    curve.bevel_depth = 0.035
    curve.bevel_resolution = 2
    co = bpy.data.objects.new(name + "_frame", curve)
    co.data.materials.append(frame_mat)
    coll.objects.link(co)
    # spandrel: the rectangular wall opening minus the arch, closed with a cream panel
    poly = [(a, z2)] + list(reversed(pts[2:])) + [(b, z2)]
    bm2 = bmesh.new()
    s0 = [bm2.verts.new(P(u, z, -0.07)) for u, z in poly]
    s1 = [bm2.verts.new(P(u, z, -0.03)) for u, z in poly]
    bm2.faces.new(s0)
    bm2.faces.new(list(reversed(s1)))
    for i in range(len(poly)):
        j = (i + 1) % len(poly)
        bm2.faces.new((s0[i], s0[j], s1[j], s1[i]))
    me2 = bpy.data.meshes.new(name + "_spandrel")
    bm2.to_mesh(me2)
    bm2.free()
    so = bpy.data.objects.new(name + "_spandrel", me2)
    so.data.materials.append(spandrel_mat)
    coll.objects.link(so)
    return o, spring


def build(M, coll):
    for spec in H.WINDOWS:
        n, axis, plane, a, b, z1, z2, out, style = spec
        w, h = b - a, z2 - z1
        if style == "door":
            # entry: dark walnut door with a tall glass lite, sidelight-free; limestone surround
            _fb(spec, n + "_leaf", a, b, -RECESS - 0.06, -RECESS, z1, z2, M["door"], coll)
            _fb(spec, n + "_lite", a + 0.18, b - 0.18, -RECESS + 0.005, -RECESS + 0.012, z1 + 1.0, z2 - 0.25, M["glass"], coll)
            for k, (u1, u2) in enumerate([(a - 0.22, a), (b, b + 0.22)]):
                _fb(spec, f"{n}_jamb{k}", u1, u2, 0.0, 0.08, z1, z2 + 0.22, M["stone"], coll)
            _fb(spec, n + "_head", a - 0.32, b + 0.32, 0.0, 0.12, z2, z2 + 0.34, M["stone"], coll)
            _fb(spec, n + "_handle", b - 0.16, b - 0.12, -RECESS + 0.0, -RECESS + 0.08, z1 + 0.9, z1 + 1.3, M["frame"], coll)
            continue
        d_glass = -RECESS
        # frame ring (inside the reveal) and glass
        if style == "arch":
            _arch_glass(spec, n + "_glass", a, b, z1, z2, d_glass, M["glass"], coll, M["frame"], M["trim"])
            _fb(spec, n + "_fB", a, b, d_glass - 0.02, d_glass + FRAME_D, z1, z1 + FRAME_W, M["frame"], coll)
            for k, u in enumerate((a + w / 3, a + 2 * w / 3)):
                _fb(spec, f"{n}_mv{k}", u - 0.025, u + 0.025, d_glass, d_glass + FRAME_D * 0.8, z1, z2 - 0.05, M["frame"], coll)
            continue
        _fb(spec, n + "_glass", a, b, d_glass, d_glass + 0.012, z1, z2, M["glass"], coll)
        for k, (u1, u2, za, zb) in enumerate([(a, a + FRAME_W, z1, z2), (b - FRAME_W, b, z1, z2),
                                              (a, b, z1, z1 + FRAME_W), (a, b, z2 - FRAME_W, z2)]):
            _fb(spec, f"{n}_f{k}", u1, u2, d_glass - 0.02, d_glass + FRAME_D, za, zb, M["frame"], coll)
        # muntins: 2 x 2 on big windows, 1 x 2 on tall narrow ones (reference windows)
        cols = 2 if w > 1.4 else 1
        rows = 2 if h > 1.5 else 1
        for i in range(1, cols):
            u = a + w * i / cols
            _fb(spec, f"{n}_mv{i}", u - 0.03, u + 0.03, d_glass, d_glass + FRAME_D * 0.8, z1, z2, M["frame"], coll)
        for j in range(1, rows):
            zz = z1 + h * j / rows
            _fb(spec, f"{n}_mh{j}", a, b, d_glass, d_glass + FRAME_D * 0.8, zz - 0.03, zz + 0.03, M["frame"], coll)
        if style == "siding":
            c = 0.14
            _fb(spec, n + "_cL", a - c, a, 0.0, 0.05, z1 - 0.06, z2 + c, M["trim"], coll)
            _fb(spec, n + "_cR", b, b + c, 0.0, 0.05, z1 - 0.06, z2 + c, M["trim"], coll)
            _fb(spec, n + "_cT", a - c - 0.05, b + c + 0.05, 0.0, 0.08, z2, z2 + c + 0.06, M["trim"], coll)
            if z1 > 0.1:
                _fb(spec, n + "_sill", a - c - 0.05, b + c + 0.05, -RECESS, 0.09, z1 - 0.08, z1, M["trim"], coll)
        else:
            _fb(spec, n + "_head", a - 0.12, b + 0.12, 0.0, 0.10, z2 + 0.03, z2 + 0.33, M["frame"], coll)
            if z1 > 0.1:
                _fb(spec, n + "_sill", a - 0.07, b + 0.07, -RECESS, 0.07, z1 - 0.09, z1, M["stone"], coll)
    _trims(M, coll)


def _trims(M, coll):
    """Frieze boards under the eaves and cream gutters + downspouts on the front."""
    E = H.EAVE
    frieze = [  # (x1, x2, y1, y2): a 0.25 m board just under the eave on the street faces
        (8, 15, 13.5 - 0.04, 13.5), (22, 28.5, 10.5 - 0.04, 10.5), (28.5, 34, 9.0 - 0.04, 9.0)]
    for i, (x1, x2, y1, y2) in enumerate(frieze):
        _box(f"Frieze{i}", x1, x2, y1, y2, E - 0.28, E, M["trim"], coll)
    gutters = [(8.0, 15.0, 13.5 - 0.5, E - 0.45), (22.0, 28.5, 10.5 - 0.45, E - 0.42), (8.0, 25.5, 29.0 + 0.5, E - 0.45)]
    for i, (xa, xb, yy, zz) in enumerate(gutters):
        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.075, depth=xb - xa, location=((xa + xb) / 2, yy, zz),
                                            rotation=(0, math.radians(90), 0))
        g = bpy.context.active_object
        g.name = f"Gutter{i}"
        g.data.materials.append(M["trim"])
        for c in g.users_collection:
            c.objects.unlink(g)
        coll.objects.link(g)
    for i, (x, y) in enumerate([(8.15, 13.2), (14.85, 13.2), (22.2, 10.25), (28.3, 10.25), (28.7, 8.75), (33.8, 8.75)]):
        _box(f"Downspout{i}", x - 0.05, x + 0.05, y - 0.05, y + 0.05, -0.4, H.EAVE - 0.45, M["trim"], coll)


def interior_trim(M, coll):
    """Inside each opening: painted jamb liners over the inner part of the reveal, a stool and apron
    under windows, and flat casings on the room face (arched transoms get liners only)."""
    paint = bpy.data.materials.get("BaseboardPaint")
    if paint is None:
        paint = M["trim"]
    T = H.T_EXT
    d_in = -(RECESS + 0.022)                      # liners butt against the back of the frame
    for spec in H.WINDOWS:
        n, axis, plane, a, b, z1, z2, out, style = spec
        if style == "door":
            continue
        floor_level = z1 < 0.25 or (H.F1 - 0.05 <= z1 <= H.F1 + 0.25)
        T = H.T_EXT + (0.022 if n.startswith("Game") and axis == "y" else 0.0)   # proud of the teal accent wall
        _fb(spec, n + "_linL", a, a + 0.012, -T - 0.002, d_in, z1, z2, paint, coll)
        _fb(spec, n + "_linR", b - 0.012, b, -T - 0.002, d_in, z1, z2, paint, coll)
        if style == "arch":
            continue
        _fb(spec, n + "_linH", a, b, -T - 0.002, d_in, z2 - 0.012, z2, paint, coll)
        if not floor_level:
            _fb(spec, n + "_stool", a - 0.06, b + 0.06, -T - 0.035, d_in, z1 - 0.025, z1, paint, coll)
            _fb(spec, n + "_apron", a - 0.03, b + 0.03, -T - 0.016, -T, z1 - 0.13, z1 - 0.025, paint, coll)
        else:
            _fb(spec, n + "_linS", a, b, -T - 0.002, d_in, z1, z1 + 0.012, paint, coll)
        _fb(spec, n + "_casL", a - 0.075, a, -T - 0.016, -T, z1 - (0.0 if floor_level else 0.025), z2 + 0.075, paint, coll)
        _fb(spec, n + "_casR", b, b + 0.075, -T - 0.016, -T, z1 - (0.0 if floor_level else 0.025), z2 + 0.075, paint, coll)
        _fb(spec, n + "_casH", a - 0.075, b + 0.075, -T - 0.016, -T, z2, z2 + 0.075, paint, coll)
