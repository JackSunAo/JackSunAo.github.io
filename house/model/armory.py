"""Armory behind the study's hidden bookcase door (x 8-13, y 19-23, ground floor).

Generic firearms are modelled procedurally from side profiles (extruded, bevelled) plus turned parts:
bolt-action rifle with scope, classic iron-sight rifle, modern sporting rifle (black / tan), pump shotgun,
polymer pistols (black / tan), a steel 1911-style pistol and a revolver. Racks, safe, display cabinet,
island, workbench with tool pegboard, ammo boxes and cans, LED lighting.
"""
import math
import random

import bmesh
import bpy
from mathutils import Matrix, Vector

import house_real as H
import interiors as I

F1 = H.F1
COLL = None
X0, X1, Y0, Y1 = 8.3, 12.925, 19.075, 22.925      # interior faces of the room
ZC = F1 - H.SLAB


# ---------------------------------------------------------------- materials
def _walnut(name="GunWalnut", dark=(0.10, 0.045, 0.02), light=(0.30, 0.14, 0.06), scale=22.0):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (scale * 0.25, scale, scale)
    wv = nt.nodes.new("ShaderNodeTexWave")
    wv.wave_type, wv.bands_direction = "BANDS", "X"
    wv.inputs["Distortion"].default_value = 7.0
    wv.inputs["Detail"].default_value = 4.0
    wv.inputs["Detail Scale"].default_value = 1.5
    ns = nt.nodes.new("ShaderNodeTexNoise")
    ns.inputs["Scale"].default_value = 60.0
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "FLOAT"
    mix.inputs["Factor"].default_value = 0.25
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (*dark, 1)
    ramp.color_ramp.elements[1].color = (*light, 1)
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    nt.links.new(mp.outputs["Vector"], wv.inputs["Vector"])
    nt.links.new(mp.outputs["Vector"], ns.inputs["Vector"])
    nt.links.new(wv.outputs["Fac"], mix.inputs["A"])
    nt.links.new(ns.outputs["Fac"], mix.inputs["B"])
    nt.links.new(mix.outputs["Result"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], p.inputs["Base Color"])
    p.inputs["Roughness"].default_value = 0.32
    p.inputs["Coat Weight"].default_value = 0.6
    p.inputs["Coat Roughness"].default_value = 0.08
    return m


def mats():
    return {
        "blued": I.mat("GunBlued", "#23262b", 0.3, 1.0),
        "nitride": I.mat("GunNitride", "#1b1c1e", 0.42, 0.85),
        "polymer": I.mat("GunPolymer", "#141414", 0.62),
        "fde": I.mat("GunFDE", "#9a8160", 0.6),
        "anodized": I.mat("GunAnodized", "#18191b", 0.48, 0.7),
        "stainless": I.mat("GunStainless", "#b9b8b4", 0.24, 1.0),
        "rubber": I.mat("GunRubber", "#0d0d0d", 0.85),
        "lens": I.mat("ScopeLens", "#0b1018", 0.03, 0.0),
        "brass": I.mat("CartridgeBrass", "#b58c45", 0.28, 1.0),
        "walnut": _walnut(),
        "walnut_light": _walnut("GunWalnutLight", (0.16, 0.07, 0.03), (0.42, 0.22, 0.10), 18.0),
    }


# ---------------------------------------------------------------- part builder (one mesh per gun)
class Part:
    def __init__(self):
        self.bm = bmesh.new()
        self.mats = []

    def _mi(self, m):
        if m not in self.mats:
            self.mats.append(m)
        return self.mats.index(m)

    def prism(self, pts, thick, m, y=0.0):
        """Side profile (u along the gun, v up) extruded across the gun."""
        mi = self._mi(m)
        a = [self.bm.verts.new((u, y - thick / 2, v)) for u, v in pts]
        b = [self.bm.verts.new((u, y + thick / 2, v)) for u, v in pts]
        faces = [self.bm.faces.new(a), self.bm.faces.new(b)]
        n = len(pts)
        for i in range(n):
            j = (i + 1) % n
            faces.append(self.bm.faces.new((a[i], a[j], b[j], b[i])))
        for f in faces:
            f.material_index = mi
        return faces

    def box(self, u1, u2, v1, v2, thick, m, y=0.0):
        return self.prism([(u1, v1), (u2, v1), (u2, v2), (u1, v2)], thick, m, y)

    def bar(self, p, q, w, thick, m, y=0.0):
        """Straight bar of width w between profile points p and q."""
        d = Vector((q[0] - p[0], q[1] - p[1]))
        n = Vector((-d.y, d.x)).normalized() * (w / 2)
        pts = [(p[0] + n.x, p[1] + n.y), (q[0] + n.x, q[1] + n.y), (q[0] - n.x, q[1] - n.y), (p[0] - n.x, p[1] - n.y)]
        return self.prism(pts, thick, m, y)

    def tube(self, u1, u2, v, r1, r2=None, m=None, seg=20, y=0.0, axis="u"):
        """Turned part along the gun (axis u) or across it (axis y) or up (axis v)."""
        r2 = r1 if r2 is None else r2
        L = u2 - u1
        if axis == "u":
            T = Matrix.Translation(((u1 + u2) / 2, y, v)) @ Matrix.Rotation(math.pi / 2, 4, "Y")
        elif axis == "y":
            T = Matrix.Translation((v[0], (u1 + u2) / 2, v[1])) @ Matrix.Rotation(math.pi / 2, 4, "X")
        else:
            T = Matrix.Translation((v[0], y, (u1 + u2) / 2))
        res = bmesh.ops.create_cone(self.bm, cap_ends=True, cap_tris=False, segments=seg,
                                    radius1=r1, radius2=r2, depth=L, matrix=T)
        mi = self._mi(m)
        for f in {f for v_ in res["verts"] for f in v_.link_faces}:
            f.material_index = mi
            f.smooth = True

    def finish(self, name, bevel=0.0015):
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces)
        me = bpy.data.meshes.new(name)
        self.bm.to_mesh(me)
        self.bm.free()
        o = bpy.data.objects.new(name, me)
        for m in self.mats:
            o.data.materials.append(m)
        if bevel:
            b = o.modifiers.new("bevel", "BEVEL")
            b.width, b.segments, b.limit_method = bevel, 2, "ANGLE"
            b.angle_limit = math.radians(40)
            b.harden_normals = True
        return o


# ---------------------------------------------------------------- long guns (origin at the butt toe, muzzle +u)
def _hunting_stock(P, wood, rubber, straight=False):
    grip = [(0.45, 0.074), (0.43, 0.045), (0.385, 0.030), (0.35, 0.058)] if not straight else [(0.42, 0.070), (0.36, 0.062)]
    pts = [(0.012, 0.0), (0.022, 0.150), (0.24, 0.132), (0.36, 0.118), (0.405, 0.113), (0.405, 0.122),
           (0.93, 0.122), (0.955, 0.108), (0.945, 0.088), (0.62, 0.080), (0.50, 0.076)] + grip + [(0.20, 0.052)]
    P.prism(pts, 0.042, wood)
    P.prism([(0.0, 0.0), (0.012, 0.0), (0.022, 0.150), (0.009, 0.150)], 0.044, rubber)


def bolt_rifle(name, M, scope=True, wood="walnut"):
    P = Part()
    _hunting_stock(P, M[wood], M["rubber"])
    P.tube(0.40, 0.64, 0.137, 0.0165, 0.0165, M["blued"])                   # receiver
    P.tube(0.64, 1.13, 0.137, 0.0105, 0.0078, M["blued"])                   # barrel, tapered
    P.tube(-0.03, 0.03, (0.445, 0.135), 0.006, 0.006, M["blued"], 10, axis="y")   # bolt handle
    P.tube(0.028, 0.045, (0.445, 0.135), 0.011, 0.011, M["blued"], 12, axis="y")  # bolt knob
    P.box(0.470, 0.540, 0.050, 0.078, 0.034, M["blued"])                    # floorplate
    P.bar((0.455, 0.078), (0.452, 0.050), 0.005, 0.012, M["blued"])         # trigger guard
    P.bar((0.452, 0.050), (0.395, 0.050), 0.005, 0.012, M["blued"])
    P.bar((0.432, 0.077), (0.428, 0.058), 0.005, 0.006, M["blued"])         # trigger
    if scope:
        P.tube(0.420, 0.745, 0.188, 0.0127, 0.0127, M["anodized"], 24)
        P.tube(0.745, 0.815, 0.188, 0.0127, 0.0245, M["anodized"], 28)
        P.tube(0.815, 0.835, 0.188, 0.0245, 0.0245, M["anodized"], 28)
        P.tube(0.834, 0.836, 0.188, 0.021, 0.021, M["lens"], 24)
        P.tube(0.365, 0.420, 0.188, 0.0195, 0.0135, M["anodized"], 24)
        P.tube(0.355, 0.366, 0.188, 0.0195, 0.0195, M["rubber"], 24)
        P.tube(0.180, 0.215, (0.58, 0.0), 0.012, 0.012, M["anodized"], 16, axis="v")  # elevation turret
        P.tube(-0.035, 0.035, (0.58, 0.188), 0.011, 0.011, M["anodized"], 16, axis="y")  # windage
        for u in (0.47, 0.67):                                               # rings + bases
            P.tube(u - 0.008, u + 0.008, 0.188, 0.0158, 0.0158, M["anodized"], 24)
            P.box(u - 0.009, u + 0.009, 0.150, 0.176, 0.022, M["anodized"])
    else:
        P.box(1.105, 1.118, 0.147, 0.158, 0.004, M["blued"])                # front sight
        P.box(0.70, 0.715, 0.147, 0.154, 0.012, M["blued"])                 # rear sight
    return P.finish(name)


def pump_shotgun(name, M):
    P = Part()
    pts = [(0.012, 0.0), (0.022, 0.150), (0.25, 0.130), (0.33, 0.118), (0.36, 0.105),
           (0.36, 0.080), (0.30, 0.066), (0.20, 0.052)]
    P.prism(pts, 0.042, M["walnut_light"])
    P.prism([(0.0, 0.0), (0.012, 0.0), (0.022, 0.150), (0.009, 0.150)], 0.044, M["rubber"])
    P.prism([(0.355, 0.075), (0.355, 0.150), (0.55, 0.150), (0.56, 0.140), (0.56, 0.088), (0.53, 0.078)],
            0.036, M["blued"])                                                # receiver
    P.tube(0.55, 1.18, 0.135, 0.0115, 0.0115, M["blued"])                   # barrel
    P.tube(0.55, 1.07, 0.105, 0.0105, 0.0105, M["blued"])                   # magazine tube
    P.tube(1.07, 1.085, 0.105, 0.0120, 0.0120, M["blued"])                  # cap
    P.tube(0.66, 0.86, 0.106, 0.0215, 0.0215, M["walnut_light"], 24)        # pump fore-end
    for u in [0.68 + 0.012 * k for k in range(14)]:
        P.tube(u, u + 0.004, 0.106, 0.0222, 0.0222, M["walnut"], 24)        # grip grooves
    P.tube(1.172, 1.178, 0.149, 0.0025, 0.0025, M["stainless"], 8, axis="u")  # bead
    P.bar((0.43, 0.078), (0.425, 0.050), 0.005, 0.012, M["blued"])
    P.bar((0.425, 0.050), (0.36, 0.052), 0.005, 0.012, M["blued"])
    P.bar((0.405, 0.077), (0.400, 0.057), 0.005, 0.006, M["blued"])
    return P.finish(name)


def sporting_rifle(name, M, body="anodized", furniture="polymer"):
    P = Part()
    A, F = M[body], M[furniture]
    P.prism([(0.0, 0.040), (0.0, 0.170), (0.05, 0.172), (0.20, 0.150), (0.20, 0.118), (0.12, 0.110)], 0.038, F)  # stock
    P.box(0.0, 0.010, 0.040, 0.170, 0.040, M["rubber"])
    P.tube(0.15, 0.30, 0.140, 0.0155, 0.0155, A)                            # buffer tube
    P.prism([(0.295, 0.095), (0.295, 0.158), (0.50, 0.158), (0.50, 0.105), (0.43, 0.095)], 0.030, A)  # receivers
    P.prism([(0.33, 0.158), (0.50, 0.158), (0.50, 0.172), (0.33, 0.172)], 0.022, A)                   # top rail
    for k in range(17):
        u = 0.335 + k * 0.0096
        P.box(u, u + 0.0048, 0.172, 0.176, 0.022, A)
    P.prism([(0.315, 0.095), (0.345, 0.098), (0.315, 0.010), (0.285, 0.008)], 0.026, F)  # pistol grip
    P.prism([(0.405, 0.096), (0.455, 0.096), (0.470, 0.030), (0.455, -0.040), (0.415, -0.045), (0.420, 0.030)],
            0.024, F)                                                         # curved magazine
    P.bar((0.395, 0.095), (0.392, 0.070), 0.005, 0.012, A)
    P.bar((0.392, 0.070), (0.335, 0.072), 0.005, 0.012, A)
    P.bar((0.372, 0.094), (0.368, 0.078), 0.005, 0.006, A)
    P.tube(0.50, 0.83, 0.142, 0.026, 0.026, A, 8)                           # free-float handguard (octagonal)
    P.box(0.50, 0.83, 0.166, 0.176, 0.022, A)
    P.tube(0.83, 0.93, 0.142, 0.0095, 0.0095, M["nitride"])                 # barrel
    P.tube(0.93, 0.985, 0.142, 0.0115, 0.0115, M["nitride"], 6)             # muzzle device
    P.box(0.36, 0.43, 0.176, 0.186, 0.026, A)                               # red-dot optic
    P.tube(0.37, 0.43, 0.205, 0.016, 0.016, A, 24)
    P.tube(0.4295, 0.431, 0.205, 0.013, 0.013, M["lens"], 20)
    return P.finish(name)


# ---------------------------------------------------------------- handguns (origin at grip bottom-rear, muzzle +u)
def polymer_pistol(name, M, frame="polymer", slide="nitride"):
    P = Part()
    S, F = M[slide], M[frame]
    P.box(0.0, 0.187, 0.100, 0.131, 0.0254, S)                              # slide
    for k in range(6):                                                       # rear serrations
        u = 0.010 + k * 0.0055
        P.box(u, u + 0.0025, 0.103, 0.128, 0.0262, M["polymer"])
    P.box(0.181, 0.186, 0.131, 0.136, 0.004, S)                             # sights
    P.box(0.006, 0.015, 0.131, 0.137, 0.018, S)
    P.box(0.040, 0.182, 0.080, 0.100, 0.024, F)                             # dust cover
    P.prism([(-0.004, 0.100), (0.064, 0.100), (0.058, 0.080), (0.035, 0.004), (0.031, -0.001),
             (-0.017, -0.001), (-0.021, 0.006), (-0.004, 0.072), (-0.012, 0.088)], 0.030, F)  # grip frame
    P.bar((0.100, 0.081), (0.094, 0.052), 0.006, 0.012, F)                  # trigger guard
    P.bar((0.094, 0.052), (0.052, 0.050), 0.006, 0.012, F)
    P.bar((0.076, 0.080), (0.071, 0.060), 0.005, 0.007, M["polymer"])       # trigger
    P.box(-0.019, 0.035, -0.007, 0.0, 0.031, M["polymer"])                  # magazine base
    return P.finish(name, 0.0008)


def steel_pistol(name, M):
    """1911-pattern: stainless slide and frame, walnut grip panels."""
    P = Part()
    S = M["stainless"]
    P.box(0.0, 0.216, 0.102, 0.130, 0.023, S)
    for k in range(7):
        u = 0.008 + k * 0.005
        P.box(u, u + 0.0022, 0.105, 0.127, 0.0236, M["blued"])
    P.box(0.205, 0.211, 0.130, 0.136, 0.004, S)
    P.box(0.006, 0.016, 0.130, 0.137, 0.016, S)
    P.box(0.050, 0.200, 0.088, 0.102, 0.021, S)
    P.prism([(-0.006, 0.102), (0.060, 0.102), (0.055, 0.086), (0.036, 0.003), (-0.016, 0.000),
             (-0.012, 0.070), (-0.016, 0.090)], 0.022, S)
    P.prism([(0.002, 0.082), (0.050, 0.082), (0.034, 0.010), (-0.010, 0.008)], 0.028, M["walnut"])  # grip panels
    P.bar((0.104, 0.088), (0.099, 0.058), 0.005, 0.011, S)
    P.bar((0.099, 0.058), (0.054, 0.056), 0.005, 0.011, S)
    P.bar((0.078, 0.086), (0.076, 0.066), 0.004, 0.007, S)
    P.tube(-0.013, 0.000, (0.004, 0.124), 0.006, 0.006, S, 10, axis="y")   # hammer spur (approx.)
    return P.finish(name, 0.0008)


def revolver(name, M):
    P = Part()
    S = M["stainless"]
    P.prism([(0.030, 0.082), (0.135, 0.082), (0.135, 0.124), (0.055, 0.126), (0.040, 0.118)], 0.024, S)  # frame
    P.tube(0.068, 0.124, 0.101, 0.0205, 0.0205, S, 6)                        # cylinder (fluted look)
    P.tube(0.066, 0.068, 0.101, 0.0175, 0.0175, S, 24)
    P.tube(0.135, 0.255, 0.114, 0.0085, 0.0085, S, 20)                       # barrel
    P.box(0.135, 0.255, 0.094, 0.108, 0.013, S)                              # full under-lug
    P.prism([(0.238, 0.122), (0.252, 0.122), (0.252, 0.132)], 0.004, S)      # ramp sight
    P.prism([(0.040, 0.118), (0.052, 0.118), (0.030, 0.142), (0.022, 0.138)], 0.008, S)  # hammer
    P.prism([(0.034, 0.088), (0.058, 0.084), (0.040, 0.004), (-0.012, -0.002), (-0.004, 0.050), (0.010, 0.082)],
            0.030, M["walnut"])                                               # wood grip
    P.bar((0.095, 0.082), (0.090, 0.056), 0.005, 0.011, S)
    P.bar((0.090, 0.056), (0.058, 0.058), 0.005, 0.011, S)
    P.bar((0.076, 0.081), (0.071, 0.064), 0.004, 0.006, S)
    return P.finish(name, 0.0008)


# ---------------------------------------------------------------- tools
def wrench(name, M, L):
    P = Part()
    P.box(0.0, L, -0.006, 0.006, 0.004, M["stainless"])
    P.tube(-0.006, 0.006, (0.0, 0.0), 0.0135, 0.0135, M["stainless"], 16, axis="y")
    P.tube(-0.003, 0.003, (0.0, 0.0), 0.0075, 0.0075, M["polymer"], 6, axis="y")
    P.prism([(L - 0.004, -0.004), (L + 0.016, -0.013), (L + 0.020, -0.004), (L + 0.008, 0.0),
             (L + 0.020, 0.004), (L + 0.016, 0.013), (L - 0.004, 0.004)], 0.005, M["stainless"])
    return P.finish(name, 0.0006)


def screwdriver(name, M, L, col):
    P = Part()
    P.tube(0.0, 0.10, 0.0, 0.0145, 0.012, col, 8)
    P.tube(0.10, 0.10 + L, 0.0, 0.0035, 0.0035, M["stainless"], 10)
    P.tube(0.10 + L, 0.11 + L, 0.0, 0.0035, 0.0012, M["stainless"], 10)
    return P.finish(name, 0.0)


def hammer(name, M):
    P = Part()
    P.box(0.0, 0.30, -0.012, 0.012, 0.022, M["walnut_light"])
    P.box(0.26, 0.355, -0.025, 0.025, 0.026, M["blued"])
    P.tube(0.355, 0.375, 0.0, 0.0145, 0.0145, M["blued"], 16)
    return P.finish(name, 0.001)


def pliers(name, M, col):
    P = Part()
    P.prism([(0.0, 0.004), (0.13, 0.012), (0.20, 0.006), (0.20, 0.0), (0.13, 0.002), (0.0, -0.006)], 0.010, M["blued"])
    P.prism([(0.0, -0.004), (0.13, -0.012), (0.20, -0.006), (0.20, 0.0), (0.13, -0.002), (0.0, 0.006)], 0.010, M["blued"], 0.011)
    P.bar((0.0, 0.010), (0.12, 0.016), 0.014, 0.014, col)
    P.bar((0.0, -0.010), (0.12, -0.016), 0.014, 0.014, col, 0.011)
    return P.finish(name, 0.0008)


# ---------------------------------------------------------------- placement helpers
def _inst(src, name, loc, R):
    o = bpy.data.objects.new(name, src.data)
    o.matrix_world = Matrix.Translation(loc) @ R.to_4x4()
    for m in src.modifiers:
        b = o.modifiers.new(m.name, m.type)
        for k in ("width", "segments", "limit_method", "angle_limit", "harden_normals"):
            setattr(b, k, getattr(m, k))
    COLL.objects.link(o)
    return o


def _axes(ux, uy, uz):
    """Rotation whose columns are the world directions of the local axes."""
    return Matrix((ux, uy, uz)).transposed()


UP_SIDE_X = _axes((0, 0, 1), (1, 0, 0), (0, 1, 0))      # long gun upright, side facing +x
FLAT_FACE_MY = _axes((1, 0, 0), (0, 1, 0), (0, 0, 1))   # hanging flat on a north wall, side toward -y
ON_TABLE = _axes((1, 0, 0), (0, 0, 1), (0, -1, 0))       # lying on its side on a table


def ammo_box(name, x1, x2, y1, y2, z, h, col):
    I.box(name, x1, x2, y1, y2, z, z + h, col, 0.002)
    I.box(name + "_band", x1 - 0.001, x2 + 0.001, y1 - 0.001, y2 + 0.001, z + h * 0.55, z + h * 0.8,
          I.mat("AmmoLabelWhite", "#ece6d8", 0.6))


def ammo_can(name, x, y, z, rot=0):
    od = I.mat("AmmoCanOD", "#4a4f2a", 0.55, 0.45)
    w, d, h = 0.28, 0.15, 0.19
    if rot:
        w, d = d, w
    I.box(name, x - w / 2, x + w / 2, y - d / 2, y + d / 2, z, z + h, od, 0.006)
    I.box(name + "_lid", x - w / 2 - 0.004, x + w / 2 + 0.004, y - d / 2 - 0.004, y + d / 2 + 0.004, z + h - 0.035, z + h, od, 0.004)
    I.box(name + "_handle", x - 0.05, x + 0.05, y - 0.012, y + 0.012, z + h, z + h + 0.012, I.mat("GunBlued", "#23262b", 0.3, 1.0))


def ycyl(name, x, z, y1, y2, r, m, seg=32):
    """Cylinder whose axis runs along y (dials, hubs, knobs on a south-facing surface)."""
    bm = bmesh.new()
    T = Matrix.Translation((x, (y1 + y2) / 2, z)) @ Matrix.Rotation(math.pi / 2, 4, "X")
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r, depth=y2 - y1, matrix=T)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    o.data.materials.append(m)
    for p in o.data.polygons:
        p.use_smooth = len(p.vertices) == 4
    COLL.objects.link(o)
    return o


# ---------------------------------------------------------------- the room
def build(materials, coll):
    global COLL
    COLL = coll
    I.COLL, I.M = coll, materials
    M = mats()
    lib = bpy.data.collections.new("ArmoryLib")
    bpy.context.scene.collection.children.link(lib)
    lib.hide_render = lib.hide_viewport = True
    guns = {
        "bolt": bolt_rifle("ArmBolt", M), "classic": bolt_rifle("ArmClassic", M, scope=False, wood="walnut_light"),
        "msr": sporting_rifle("ArmMSR", M), "msr_tan": sporting_rifle("ArmMSRtan", M, "anodized", "fde"),
        "pump": pump_shotgun("ArmPump", M),
        "pistol": polymer_pistol("ArmPistol", M), "pistol_tan": polymer_pistol("ArmPistolTan", M, "fde"),
        "steel": steel_pistol("ArmSteel", M), "revolver": revolver("ArmRevolver", M),
    }
    for o in guns.values():
        lib.objects.link(o)

    walnut_panel = I.mat("ArmoryWalnut", "#4b3122", 0.4)
    dark = I.mat("ArmorySlatwall", "#2b2d30", 0.55)
    felt = I.mat("RackFelt", "#2d4a3a", 0.95)
    led = I.mat("ArmoryLED", "#fff4e2", 0.4, emit=((1.0, 0.86, 0.68), 12.0))
    steel_dark = I.mat("SafeBlack", "#121314", 0.38, 0.6)
    chrome = I.mat("Chrome", "#d8d8d8", 0.08, 1.0)
    red = I.mat("ToolChestRed", "#8e1b17", 0.3, 0.55)
    block = I.mat("ButcherBlock", "#b07d4f", 0.45)
    leather = I.mat("BenchMat", "#1d2420", 0.8)
    glass = materials["glass"]

    # west wall: walnut paneling, base cabinet with drawers, felt butt shelf, barrel comb, rifles, ammo shelf, LED
    I.box("ArmPanelW", X0, X0 + 0.02, Y0, Y1, 0.0, ZC, walnut_panel)
    I.box("ArmBaseW", X0, X0 + 0.52, Y0 + 0.15, Y1 - 0.15, 0.0, 0.90, walnut_panel, 0.004)
    for k in range(5):
        y = Y0 + 0.2 + k * (Y1 - Y0 - 0.4) / 5
        I.box(f"ArmDrawerW{k}", X0 + 0.52, X0 + 0.53, y + 0.03, y + (Y1 - Y0 - 0.4) / 5 - 0.03, 0.12, 0.82, walnut_panel, 0.003)
        I.box(f"ArmPullW{k}", X0 + 0.53, X0 + 0.545, y + 0.25, y + 0.45, 0.70, 0.715, chrome)
    I.box("ArmFeltW", X0 + 0.02, X0 + 0.50, Y0 + 0.15, Y1 - 0.15, 0.90, 0.93, felt)
    I.box("ArmCombW", X0 + 0.02, X0 + 0.20, Y0 + 0.15, Y1 - 0.15, 1.62, 1.70, walnut_panel, 0.004)
    order = ["bolt", "msr", "pump", "classic", "msr_tan", "bolt", "pump", "msr", "classic", "bolt", "msr_tan", "pump"]
    n = len(order)
    for k, g in enumerate(order):
        y = Y0 + 0.36 + k * (Y1 - Y0 - 0.72) / (n - 1)
        _inst(guns[g], f"Rack_{g}{k}", (X0 + 0.11, y - 0.06, 0.93), UP_SIDE_X)
    I.box("ArmShelfW", X0, X0 + 0.38, Y0 + 0.15, Y1 - 0.15, 2.28, 2.32, walnut_panel, 0.003)
    I.box("ArmLEDW", X0 + 0.30, X0 + 0.34, Y0 + 0.2, Y1 - 0.2, 2.27, 2.28, led)
    rnd = random.Random(11)
    cols = [I.mat(f"AmmoBox{k}", c, 0.55) for k, c in enumerate(("#9b2a22", "#1f4f8a", "#d9a21b", "#2f6b3a", "#2b2b2b"))]
    y = Y0 + 0.25
    while y < Y1 - 0.4:
        w = rnd.uniform(0.09, 0.13)
        ammo_box(f"AmmoW{y:.2f}", X0 + 0.08, X0 + 0.30, y, y + w, 2.32, rnd.choice((0.07, 0.09, 0.11)), rnd.choice(cols))
        y += w + rnd.uniform(0.01, 0.08)
    I.box("ArmUpperW", X0, X0 + 0.40, Y0 + 0.15, Y1 - 0.15, 2.75, ZC - 0.05, walnut_panel, 0.004)
    I.point_light("ArmRackL", (X0 + 0.9, (Y0 + Y1) / 2, 2.2), 60, 0.6)

    # north wall: slatwall with handguns, counter with drawers, leather mat, ammo cans
    I.box("ArmSlatN", X0 + 0.55, X1 - 0.72, Y1 - 0.05, Y1, 1.05, 2.55, dark)
    for k in range(16):
        z = 1.10 + k * 0.09
        I.box(f"ArmSlatGroove{k}", X0 + 0.55, X1 - 0.72, Y1 - 0.052, Y1 - 0.045, z, z + 0.012, I.mat("SlatGroove", "#16171a", 0.6))
    pistols = ["pistol", "steel", "pistol_tan", "revolver", "pistol", "steel", "pistol", "pistol_tan",
               "revolver", "pistol", "steel", "pistol", "pistol_tan", "pistol", "revolver", "steel"]
    for k, g in enumerate(pistols):
        r, c = divmod(k, 4)
        x = X0 + 0.95 + c * 0.82
        z = 1.25 + r * 0.31
        _inst(guns[g], f"Wall_{g}{k}", (x, Y1 - 0.075, z), FLAT_FACE_MY)
        I.box(f"Peg{k}", x + 0.045, x + 0.06, Y1 - 0.09, Y1 - 0.05, z + 0.095, z + 0.105, chrome)
    I.box("ArmCounterN", X0 + 0.55, X1 - 0.72, Y1 - 0.6, Y1, 0.0, 0.90, walnut_panel, 0.004)
    for k in range(4):
        x = X0 + 0.6 + k * (X1 - X0 - 1.32) / 4
        I.box(f"ArmDrawerN{k}", x + 0.03, x + (X1 - X0 - 1.32) / 4 - 0.03, Y1 - 0.61, Y1 - 0.6, 0.12, 0.82, walnut_panel, 0.003)
        I.box(f"ArmPullN{k}", x + 0.3, x + 0.55, Y1 - 0.625, Y1 - 0.61, 0.70, 0.715, chrome)
    I.box("ArmTopN", X0 + 0.53, X1 - 0.70, Y1 - 0.62, Y1, 0.90, 0.94, block, 0.003)
    ammo_can("AmmoCan0", X0 + 1.0, Y1 - 0.3, 0.94)
    ammo_can("AmmoCan1", X0 + 1.33, Y1 - 0.3, 0.94)
    ammo_can("AmmoCan2", X0 + 1.17, Y1 - 0.3, 1.13)
    I.box("ArmLEDN", X0 + 0.55, X1 - 0.72, Y1 - 0.12, Y1 - 0.08, 2.62, 2.63, led)
    I.box("ArmValanceN", X0 + 0.55, X1 - 0.72, Y1 - 0.14, Y1, 2.62, 2.72, walnut_panel)

    # east wall: workbench, red tool chests, pegboard with tools, bench vise
    I.box("BenchTop", X1 - 0.68, X1, Y0 + 0.55, Y1 - 0.62, 0.92, 0.98, block, 0.003)
    for k, (ya, yb) in enumerate(((Y0 + 0.6, Y0 + 1.35), (Y0 + 1.4, Y0 + 2.15))):
        I.box(f"ToolChest{k}", X1 - 0.62, X1 - 0.02, ya, yb, 0.0, 0.88, red, 0.006)
        for j in range(6):
            z = 0.08 + j * 0.13
            I.box(f"ToolDrawer{k}{j}", X1 - 0.63, X1 - 0.62, ya + 0.03, yb - 0.03, z + 0.01, z + 0.12, red, 0.002)
            I.box(f"ToolPull{k}{j}", X1 - 0.645, X1 - 0.63, ya + 0.1, yb - 0.1, z + 0.09, z + 0.105, chrome)
    peg = I.mat("Pegboard", "#c9b48f", 0.7)
    I.box("Pegboard", X1 - 0.02, X1, Y0 + 0.55, Y1 - 0.62, 1.10, 2.30, peg)
    I.box("ArmLEDE", X1 - 0.22, X1 - 0.18, Y0 + 0.6, Y1 - 0.66, 2.38, 2.39, led)
    I.box("ArmShelfE", X1 - 0.30, X1, Y0 + 0.55, Y1 - 0.62, 2.39, 2.43, walnut_panel)
    tool_side = _axes((0, 0, -1), (-1, 0, 0), (0, 1, 0))      # hanging, handle up, face toward -x
    tools = []
    for k, L in enumerate((0.13, 0.15, 0.17, 0.19, 0.21, 0.23, 0.25)):
        tools.append(wrench(f"Wrench{k}", M, L))
    cols_sd = [I.mat("SDRed", "#a3201b", 0.4), I.mat("SDYellow", "#d8a316", 0.4), I.mat("SDBlack", "#1a1a1a", 0.5)]
    sds = [screwdriver(f"Screwdriver{k}", M, 0.08 + 0.025 * k, cols_sd[k % 3]) for k in range(6)]
    for o in tools + sds:
        lib.objects.link(o)
    hm = hammer("Hammer", M)
    pl = pliers("Pliers", M, cols_sd[0])
    for o in (hm, pl):
        lib.objects.link(o)
    for k, t in enumerate(tools):
        _inst(t, f"WallWrench{k}", (X1 - 0.03, Y0 + 0.75 + k * 0.07, 2.18), tool_side)
    for k, t in enumerate(sds):
        _inst(t, f"WallSD{k}", (X1 - 0.04, Y0 + 1.40 + k * 0.06, 2.20), tool_side)
    _inst(hm, "WallHammer", (X1 - 0.04, Y0 + 1.95, 2.22), tool_side)
    _inst(pl, "WallPliers", (X1 - 0.04, Y0 + 2.20, 2.20), tool_side)
    _inst(pl, "WallPliers2", (X1 - 0.04, Y0 + 2.35, 2.20), tool_side)
    I.box("ViseBase", X1 - 0.62, X1 - 0.42, Y0 + 2.45, Y0 + 2.65, 0.98, 1.04, M["blued"], 0.004)
    I.box("ViseJawA", X1 - 0.66, X1 - 0.60, Y0 + 2.46, Y0 + 2.64, 1.04, 1.15, M["blued"], 0.004)
    I.box("ViseJawB", X1 - 0.52, X1 - 0.46, Y0 + 2.46, Y0 + 2.64, 1.04, 1.15, M["blued"], 0.004)
    I.box("ViseScrew", X1 - 0.75, X1 - 0.66, Y0 + 2.54, Y0 + 2.56, 1.08, 1.10, chrome)

    # south wall: gun safe (west of the hidden door), lit glass display cabinet (east of it)
    I.box("GunSafe", X0 + 0.12, X0 + 1.27, Y0, Y0 + 0.66, 0.0, 1.85, steel_dark, 0.012)
    I.box("GunSafeDoorLine", X0 + 0.20, X0 + 1.19, Y0 + 0.66, Y0 + 0.667, 0.08, 1.77, I.mat("SafeSeam", "#08090a", 0.5))
    I.box("GunSafeDoor", X0 + 0.21, X0 + 1.18, Y0 + 0.667, Y0 + 0.675, 0.09, 1.76, steel_dark, 0.004)
    hub = (X0 + 0.95, Y0 + 0.675, 1.0)
    ycyl("SafeHub", hub[0], hub[2], hub[1], hub[1] + 0.05, 0.035, chrome)
    for k in range(5):
        o = I.box(f"SafeSpoke{k}", -0.007, 0.007, -0.007, 0.007, 0.0, 0.17, chrome, 0.003)
        o.location = (hub[0], hub[1] + 0.04, hub[2])
        o.rotation_euler = (0, k * 2 * math.pi / 5, 0)
        ycyl(f"SafeKnob{k}", hub[0] + 0.17 * math.sin(k * 2 * math.pi / 5), hub[2] + 0.17 * math.cos(k * 2 * math.pi / 5),
             hub[1] + 0.03, hub[1] + 0.06, 0.014, chrome)
    ycyl("SafeDial", X0 + 0.95, 1.30, Y0 + 0.675, Y0 + 0.70, 0.045, chrome)
    ycyl("SafeDialRing", X0 + 0.95, 1.30, Y0 + 0.675, Y0 + 0.685, 0.06, steel_dark)
    I.box("SafeLogo", X0 + 0.55, X0 + 0.85, Y0 + 0.676, Y0 + 0.678, 1.55, 1.60, chrome)
    cx1, cx2 = X1 - 1.72, X1 - 0.10
    I.box("DispBase", cx1, cx2, Y0, Y0 + 0.5, 0.0, 0.85, walnut_panel, 0.004)
    I.box("DispTop", cx1, cx2, Y0, Y0 + 0.5, 2.25, 2.40, walnut_panel, 0.004)
    I.box("DispBack", cx1, cx2, Y0, Y0 + 0.02, 0.85, 2.25, felt)
    for x in (cx1, (cx1 + cx2) / 2 - 0.02, cx2 - 0.04):
        I.box(f"DispStile{x:.2f}", x, x + 0.04, Y0 + 0.44, Y0 + 0.5, 0.85, 2.25, walnut_panel)
    I.box("DispGlass", cx1 + 0.04, cx2 - 0.04, Y0 + 0.46, Y0 + 0.47, 0.85, 2.25, glass)
    I.box("DispLED", cx1 + 0.05, cx2 - 0.05, Y0 + 0.2, Y0 + 0.24, 2.24, 2.25, led)
    disp = _axes((0, 0, 1), (0, -1, 0), (1, 0, 0))    # upright, side facing the room (+y)
    for k, g in enumerate(("classic", "bolt", "pump", "msr")):
        _inst(guns[g], f"Disp_{g}", (cx1 + 0.25 + k * 0.38, Y0 + 0.24, 0.85), disp)
    I.point_light("DispL", ((cx1 + cx2) / 2, Y0 + 0.3, 2.0), 25, 0.2)

    # island: walnut drawers, cleaning mat, a rifle in a cradle, handgun, cleaning kit, ear protection
    ix1, ix2, iy1, iy2 = 9.55, 11.45, 20.55, 21.45
    I.box("IslandArm", ix1 + 0.05, ix2 - 0.05, iy1 + 0.05, iy2 - 0.05, 0.0, 0.92, walnut_panel, 0.005)
    I.box("IslandArmTop", ix1, ix2, iy1, iy2, 0.92, 0.97, block, 0.004)
    I.box("IslandMat", ix1 + 0.2, ix2 - 0.2, iy1 + 0.12, iy2 - 0.12, 0.97, 0.975, leather)
    for k in range(3):
        x = ix1 + 0.1 + k * 0.58
        I.box(f"IslandDrawer{k}", x, x + 0.52, iy1 + 0.04, iy1 + 0.05, 0.6, 0.86, walnut_panel, 0.002)
        I.box(f"IslandPull{k}", x + 0.16, x + 0.36, iy1 + 0.025, iy1 + 0.04, 0.78, 0.795, chrome)
    cradle = I.mat("CradleRed", "#b0281f", 0.45)
    I.box("CradleA", 10.25, 10.32, 20.9, 21.1, 0.975, 1.07, cradle, 0.004)
    I.box("CradleB", 10.85, 10.92, 20.9, 21.1, 0.975, 1.07, cradle, 0.004)
    _inst(guns["bolt"], "BenchRifle", (9.90, 21.08, 1.075), ON_TABLE)
    _inst(guns["pistol"], "BenchPistol", (11.05, 20.78, 0.99), ON_TABLE)
    I.box("CleaningKit", 9.7, 10.05, 20.7, 20.82, 0.975, 1.035, I.mat("KitCase", "#1d1d1f", 0.5), 0.004)
    muff = I.mat("EarMuff", "#262c2a", 0.6)
    I.cyl("MuffL", 11.20, 21.22, 0.975, 1.03, 0.045, muff)
    I.cyl("MuffR", 11.34, 21.22, 0.975, 1.03, 0.045, muff)
    ammo_box("IslandAmmo", 9.75, 9.86, 21.15, 21.32, 0.975, 0.06, cols[0])
    for k in range(5):                                   # a few loose cartridges
        I.cyl(f"Cartridge{k}", 9.92 + k * 0.016, 21.25, 0.975, 1.03, 0.0048, M["brass"], 10)
    I.box("IslandPendant", 9.85, 11.15, 20.97, 21.03, 2.30, 2.34, I.mat("PendantBar", "#151515", 0.4, 0.5))
    I.box("IslandPendantLED", 9.87, 11.13, 20.98, 21.02, 2.295, 2.30, led)
    for x in (10.0, 11.0):
        I.cyl(f"IslandPendantRod{x}", x, 21.0, 2.34, ZC, 0.004, chrome, 6)
    I.point_light("IslandArmL", (10.5, 21.0, 2.1), 70, 0.4)

    # recessed cans
    for k, (x, y) in enumerate(((9.2, 20.0), (9.2, 22.0), (11.9, 20.0), (11.9, 22.0))):
        I.cyl(f"ArmCan{k}", x, y, ZC - 0.012, ZC - 0.002, 0.06, led)
    return guns


def secret_door(study_coll_prefix="StudyShelvesN", hinge_xy=(11.0, 18.565), angle_deg=38.0):
    """Swing the bookcase section in front of the armory door open (hinge on its east edge)."""
    e = bpy.data.objects.new("SecretDoorHinge", None)
    e.location = (*hinge_xy, 0.0)
    COLL.objects.link(e)
    for o in list(bpy.data.objects):
        if o.name.startswith("SecretDoor") and o is not e:
            o.parent = e
            o.matrix_parent_inverse = Matrix.Translation((-hinge_xy[0], -hinge_xy[1], 0.0))
    e.rotation_euler.z = math.radians(angle_deg)
