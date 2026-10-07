"""Signed-distance sculpting kernel.

A character is a list of primitives, each belonging to a layer (skin, shirt, trousers, coat, shoes, hair, ...).
Skin primitives are blended with smooth unions into one body; a garment can be "the body grown outward by t,
inside a mask" so clothes follow the anatomy; hats, hair, aprons and gear are their own shapes. The surface is the
nearest layer everywhere, and which layer is nearest says what a point is made of.

Everything is in metres in the body's own space: feet on y = 0, facing +z, the figure's left at +x.
"""
import math
import numpy as np
from numba import njit, prange

# primitive record layout (float64[32])
T, LAYER, OP, K = 0, 1, 2, 3
A, B, AX = 4, 7, 12          # point a / point b (or axisY) / local x axis
RA, RB, SX, SZ = 10, 11, 15, 16
BMIN, BMAX = 17, 20         # culling box
NAMP, NFREQ, NSTRY = 23, 24, 25
MLO, MHI = 26, 27            # garment: mask primitive index range
TAG = 28
NP = 32
# types
ROUNDCONE, ELLIPSOID, BOX, OFFSET, PLANE, MASKCONE, MASKBOX, TORUS, CAPCONE, GRID = 0, 1, 2, 3, 4, 5, 6, 7, 8, 9
# ops
UNION, SUB, INTER, HARD = 0, 1, 2, 3
BIG = 1e3
NVIS = 17   # layers past this are never surfaces: smoothed copies of the body that clothes drape from


@njit(cache=True, inline='always')
def smin(a, b, k):
    if k <= 0.0:
        return min(a, b)
    h = max(k - abs(a - b), 0.0) / k
    return min(a, b) - h * h * k * 0.25


@njit(cache=True, inline='always')
def smax(a, b, k):
    return -smin(-a, -b, k)


@njit(cache=True)
def hash3(ix, iy, iz):
    h = (ix * 374761393 + iy * 668265263 + iz * 2147483647) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((h ^ (h >> 16)) & 0xFFFF) / 65535.0


@njit(cache=True)
def vnoise(x, y, z):
    ix, iy, iz = math.floor(x), math.floor(y), math.floor(z)
    fx, fy, fz = x - ix, y - iy, z - iz
    ux, uy, uz = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy), fz * fz * (3 - 2 * fz)
    ix, iy, iz = int(ix), int(iy), int(iz)
    a = hash3(ix, iy, iz); b = hash3(ix + 1, iy, iz); c = hash3(ix, iy + 1, iz); d = hash3(ix + 1, iy + 1, iz)
    e = hash3(ix, iy, iz + 1); f = hash3(ix + 1, iy, iz + 1); g = hash3(ix, iy + 1, iz + 1); h = hash3(ix + 1, iy + 1, iz + 1)
    x1 = a + (b - a) * ux; x2 = c + (d - c) * ux; x3 = e + (f - e) * ux; x4 = g + (h - g) * ux
    y1 = x1 + (x2 - x1) * uy; y2 = x3 + (x4 - x3) * uy
    return (y1 + (y2 - y1) * uz) * 2.0 - 1.0


@njit(cache=True)
def fbm(x, y, z):
    return vnoise(x, y, z) * 0.6 + vnoise(x * 2.03, y * 2.03, z * 2.03) * 0.3 + vnoise(x * 4.1, y * 4.1, z * 4.1) * 0.1


@njit(cache=True)
def grid_d(pr, GV, px, py, pz):
    """a sampled distance volume (the scanned body): origin a, step ra, size b, start in GV at mlo; trilinear"""
    h = pr[RA]
    nx, ny, nz = int(pr[B]), int(pr[B + 1]), int(pr[B + 2])
    fx, fy, fz = (px - pr[A]) / h, (py - pr[A + 1]) / h, (pz - pr[A + 2]) / h
    if fx < 0.0 or fy < 0.0 or fz < 0.0 or fx > nx - 1.001 or fy > ny - 1.001 or fz > nz - 1.001:
        return BIG
    i, j, k = int(fx), int(fy), int(fz)
    u, v, w = fx - i, fy - j, fz - k
    o = int(pr[MLO]); sy = nz; sx = ny * nz
    b = o + i * sx + j * sy + k
    c00 = GV[b] * (1 - w) + GV[b + 1] * w
    c01 = GV[b + sy] * (1 - w) + GV[b + sy + 1] * w
    c10 = GV[b + sx] * (1 - w) + GV[b + sx + 1] * w
    c11 = GV[b + sx + sy] * (1 - w) + GV[b + sx + sy + 1] * w
    return (c00 * (1 - v) + c01 * v) * (1 - u) + (c10 * (1 - v) + c11 * v) * u


@njit(cache=True)
def prim_d(pr, px, py, pz):
    t = int(pr[T])
    if t == ROUNDCONE or t == MASKCONE:
        ax, ay, az = pr[A], pr[A + 1], pr[A + 2]
        bx, by, bz = pr[B] - ax, pr[B + 1] - ay, pr[B + 2] - az
        qx, qy, qz = px - ax, py - ay, pz - az
        L2 = bx * bx + by * by + bz * bz
        h = (qx * bx + qy * by + qz * bz) / L2 if L2 > 0 else 0.0
        h = min(1.0, max(0.0, h))
        rx, ry, rz = qx - bx * h, qy - by * h, qz - bz * h
        sx, sz = pr[SX], pr[SZ]
        if sx != 1.0 or sz != 1.0:  # elliptical cross-section: squash along the local x axis and the third axis
            L = math.sqrt(L2) if L2 > 0 else 1.0
            ux, uy, uz = bx / L, by / L, bz / L
            xx, xy, xz = pr[AX], pr[AX + 1], pr[AX + 2]
            zx, zy, zz = uy * xz - uz * xy, uz * xx - ux * xz, ux * xy - uy * xx
            lx = rx * xx + ry * xy + rz * xz
            lz = rx * zx + ry * zy + rz * zz
            r = pr[RA] + (pr[RB] - pr[RA]) * h
            return (math.sqrt((lx / sx) ** 2 + (lz / sz) ** 2) - r) * min(sx, sz)
        return math.sqrt(rx * rx + ry * ry + rz * rz) - (pr[RA] + (pr[RB] - pr[RA]) * h)
    if t == CAPCONE:  # a cone cut flat at both ends (a skirt, a coat's fall), elliptical in section
        ax, ay, az = pr[A], pr[A + 1], pr[A + 2]
        bx, by, bz = pr[B] - ax, pr[B + 1] - ay, pr[B + 2] - az
        L = math.sqrt(bx * bx + by * by + bz * bz)
        ux, uy, uz = bx / L, by / L, bz / L
        qx, qy, qz = px - ax, py - ay, pz - az
        h = qx * ux + qy * uy + qz * uz
        rx, ry, rz = qx - ux * h, qy - uy * h, qz - uz * h
        xx, xy, xz = pr[AX], pr[AX + 1], pr[AX + 2]
        zx, zy, zz = uy * xz - uz * xy, uz * xx - ux * xz, ux * xy - uy * xx
        lx = (rx * xx + ry * xy + rz * xz) / pr[SX]
        lz = (rx * zx + ry * zy + rz * zz) / pr[SZ]
        r = pr[RA] + (pr[RB] - pr[RA]) * min(1.0, max(0.0, h / L))
        side = (math.sqrt(lx * lx + lz * lz) - r) * min(pr[SX], pr[SZ])
        return max(side, max(-h, h - L))
    if t == ELLIPSOID:
        qx, qy, qz = px - pr[A], py - pr[A + 1], pz - pr[A + 2]
        yx, yy, yz = pr[B], pr[B + 1], pr[B + 2]
        xx, xy, xz = pr[AX], pr[AX + 1], pr[AX + 2]
        zx, zy, zz = xy * yz - xz * yy, xz * yx - xx * yz, xx * yy - xy * yx
        lx = (qx * xx + qy * xy + qz * xz) / pr[RA]
        ly = (qx * yx + qy * yy + qz * yz) / pr[RB]
        lz = (qx * zx + qy * zy + qz * zz) / pr[SX]
        k0 = math.sqrt(lx * lx + ly * ly + lz * lz)
        k1 = math.sqrt((lx / pr[RA]) ** 2 + (ly / pr[RB]) ** 2 + (lz / pr[SX]) ** 2)
        if k1 < 1e-9:
            return -min(pr[RA], pr[RB], pr[SX])
        return k0 * (k0 - 1.0) / k1
    if t == BOX or t == MASKBOX:
        qx, qy, qz = px - pr[A], py - pr[A + 1], pz - pr[A + 2]
        yx, yy, yz = pr[B], pr[B + 1], pr[B + 2]
        xx, xy, xz = pr[AX], pr[AX + 1], pr[AX + 2]
        zx, zy, zz = xy * yz - xz * yy, xz * yx - xx * yz, xx * yy - xy * yx
        rr = pr[SZ]
        dx = abs(qx * xx + qy * xy + qz * xz) - pr[RA] + rr
        dy = abs(qx * yx + qy * yy + qz * yz) - pr[RB] + rr
        dz = abs(qx * zx + qy * zy + qz * zz) - pr[SX] + rr
        ox, oy, oz = max(dx, 0.0), max(dy, 0.0), max(dz, 0.0)
        return math.sqrt(ox * ox + oy * oy + oz * oz) + min(max(dx, max(dy, dz)), 0.0) - rr
    if t == PLANE:
        return (px - pr[A]) * pr[B] + (py - pr[A + 1]) * pr[B + 1] + (pz - pr[A + 2]) * pr[B + 2]
    if t == TORUS:  # centre a, axis b, major ra, minor rb
        qx, qy, qz = px - pr[A], py - pr[A + 1], pz - pr[A + 2]
        nx, ny, nz = pr[B], pr[B + 1], pr[B + 2]
        h = qx * nx + qy * ny + qz * nz
        rx, ry, rz = qx - nx * h, qy - ny * h, qz - nz * h
        rl = math.sqrt(rx * rx + ry * ry + rz * rz) - pr[RA]
        return math.sqrt(rl * rl + h * h) - pr[RB]
    return BIG


@njit(cache=True, inline='always')
def inbox(pr, px, py, pz):
    return pr[BMIN] <= px <= pr[BMAX] and pr[BMIN + 1] <= py <= pr[BMAX + 1] and pr[BMIN + 2] <= pz <= pr[BMAX + 2]


@njit(cache=True)
def eval_layers(P, GV, px, py, pz, nl, out):
    """distance of every layer at a point (out[nl]); layer 0 is the body, garments read it"""
    for l in range(nl):
        out[l] = BIG
    n = P.shape[0]
    gmask = 0
    for i in range(n):
        pr = P[i]
        l = int(pr[LAYER])
        if l < 0:
            continue  # masks are read by garments only
        op = int(pr[OP])
        t = int(pr[T])
        if not inbox(pr, px, py, pz):
            if op == INTER:
                out[l] = BIG
            continue
        if t == GRID:  # finest volume first; once one holds the point the coarser ones (of that layer) are skipped
            if (gmask >> l) & 1:
                continue
            d = grid_d(pr, GV, px, py, pz)
            if d < BIG:
                gmask |= 1 << l
                out[l] = min(out[l], d)
            continue
        if t == OFFSET:  # a garment: the body grown by ra, kept where its masks are
            md = BIG
            for j in range(int(pr[MLO]), int(pr[MHI])):
                mj = P[j]
                if int(mj[OP]) == INTER:  # a mask can be trimmed: a hairline, a hem
                    md = smax(md, prim_d(mj, px, py, pz) if inbox(mj, px, py, pz) else BIG, mj[K])
                elif int(mj[OP]) == SUB:  # or holed: a neckline round the neck
                    if inbox(mj, px, py, pz):
                        md = smax(md, -prim_d(mj, px, py, pz), mj[K])
                elif inbox(mj, px, py, pz):
                    md = smin(md, prim_d(mj, px, py, pz), mj[K])
            d = smax(out[int(pr[TAG])] - pr[RA], md, pr[K])
        else:
            d = prim_d(pr, px, py, pz)
        if pr[NAMP] != 0.0:
            f = pr[NFREQ]
            d += pr[NAMP] * fbm(px * f, py * f * pr[NSTRY], pz * f)
        if op == UNION:
            out[l] = smin(out[l], d, pr[K])
        elif op == SUB:
            out[l] = smax(out[l], -d, pr[K])
        elif op == INTER:
            out[l] = smax(out[l], d, pr[K])
        else:
            out[l] = min(out[l], d)


@njit(cache=True)
def eval_point(P, GV, px, py, pz, nl, skip_body):
    out = np.empty(nl)
    eval_layers(P, GV, px, py, pz, nl, out)
    d = BIG
    for l in range(min(nl, NVIS)):
        if l == 0 and skip_body:
            continue
        d = min(d, out[l])
    return d


@njit(parallel=True, cache=True)
def grid_eval(P, GV, nl, ox, oy, oz, h, nx, ny, nz, coarse, ch, cox, coy, coz, thresh, clip):
    """distance on a grid; where a coarse pass says the surface is far, its value is reused. clip: y range kept"""
    G = np.empty((nx, ny, nz), dtype=np.float32)
    cnx, cny, cnz = coarse.shape
    for i in prange(nx):
        out = np.empty(nl)
        x = ox + i * h
        for j in range(ny):
            y = oy + j * h
            for k in range(nz):
                z = oz + k * h
                if cnx > 1:
                    fi = (x - cox) / ch; fj = (y - coy) / ch; fk = (z - coz) / ch
                    ii = min(max(int(fi), 0), cnx - 2); jj = min(max(int(fj), 0), cny - 2); kk = min(max(int(fk), 0), cnz - 2)
                    c = coarse[ii, jj, kk]
                    for a in range(2):
                        for b in range(2):
                            for e in range(2):
                                v = coarse[ii + a, jj + b, kk + e]
                                if abs(v) < abs(c):
                                    c = v
                    if abs(c) > thresh:
                        G[i, j, k] = c
                        continue
                eval_layers(P, GV, x, y, z, nl, out)
                d = BIG
                for l in range(min(nl, NVIS)):
                    d = min(d, out[l])
                if y < clip[0]:
                    d = max(d, clip[0] - y)
                if y > clip[1]:
                    d = max(d, y - clip[1])
                G[i, j, k] = d
    return G


@njit(parallel=True, cache=True)
def layers_at(P, GV, nl, pts):
    """per-point distances of every layer (for colouring texels)"""
    n = pts.shape[0]
    R = np.empty((n, nl), dtype=np.float32)
    for i in prange(n):
        out = np.empty(nl)
        eval_layers(P, GV, pts[i, 0], pts[i, 1], pts[i, 2], nl, out)
        for l in range(nl):
            R[i, l] = out[l]
    return R


@njit(parallel=True, cache=True)
def prims_at(P, idx, pts):
    """raw distance to chosen primitives (facial features, regions) for colouring"""
    n = pts.shape[0]
    m = idx.shape[0]
    R = np.empty((n, m), dtype=np.float32)
    for i in prange(n):
        for j in range(m):
            R[i, j] = prim_d(P[idx[j]], pts[i, 0], pts[i, 1], pts[i, 2])
    return R


@njit(parallel=True, cache=True)
def fbm_at(pts, f, sy):
    n = pts.shape[0]
    R = np.empty(n, dtype=np.float32)
    for i in prange(n):
        R[i] = fbm(pts[i, 0] * f, pts[i, 1] * f * sy, pts[i, 2] * f)
    return R


def v3(x):
    return np.asarray(x, dtype=np.float64)


def nrm(v):
    v = v3(v)
    n = np.linalg.norm(v)
    return v / n if n > 0 else v


def perp_axis(u):
    """some unit vector at right angles to u (for round cones that don't care)"""
    u = nrm(u)
    t = np.array([1.0, 0, 0]) if abs(u[0]) < 0.9 else np.array([0, 0, 1.0])
    x = np.cross(t, u)
    return nrm(np.cross(u, x)) if False else nrm(t - u * np.dot(t, u))


class Prims:
    """builder for a character's primitive list"""

    def __init__(self):
        self.rows = []
        self.tags = {}
        self.GV = np.zeros(8, np.float32)
        self.base = 0   # the body layer garments grow from unless told otherwise

    def grid(self, origin, h, data, layer=0):
        """a sampled distance volume; add the finest first"""
        o = len(self.GV)
        self.GV = np.concatenate([self.GV, data.astype(np.float32).ravel()])
        n = np.array(data.shape, float)
        lo = np.asarray(origin, float); hi = lo + (n - 1) * h
        r = self._row(GRID, layer, HARD, 0.0, lo, hi)
        r[A:A + 3], r[RA], r[B:B + 3], r[MLO] = lo, h, n, o
        return len(self.rows) - 1

    def _row(self, t, layer, op, k, box_lo, box_hi, tag=None):
        r = np.zeros(NP)
        r[T], r[LAYER], r[OP], r[K] = t, layer, op, k
        r[BMIN:BMIN + 3] = box_lo
        r[BMAX:BMAX + 3] = box_hi
        r[NSTRY] = 1.0
        r[SX] = r[SZ] = 1.0
        self.rows.append(r)
        i = len(self.rows) - 1
        if tag:
            self.tags.setdefault(tag, []).append(i)
        return r

    def capcone(self, a, b, ra, rb, **kw):
        return self.cone(a, b, ra, rb, t=CAPCONE, **kw)

    def cone(self, a, b, ra, rb, layer=0, k=0.02, op=UNION, ax=None, sx=1.0, sz=1.0, tag=None, noise=(0, 0, 1), t=ROUNDCONE):
        a, b = v3(a), v3(b)
        rmax = max(ra, rb) * max(sx, sz, 1.0)
        m = rmax + k + abs(noise[0]) * 1.5 + 0.004
        r = self._row(t, layer, op, k, np.minimum(a, b) - m, np.maximum(a, b) + m, tag)
        r[A:A + 3], r[B:B + 3], r[RA], r[RB] = a, b, ra, rb
        u = b - a
        axv = nrm(ax) if ax is not None else perp_axis(u if np.linalg.norm(u) > 0 else [0, 1, 0])
        if np.linalg.norm(u) > 0:  # keep the x axis at right angles to the cone
            un = nrm(u)
            axv = nrm(axv - un * np.dot(axv, un))
        r[AX:AX + 3], r[SX], r[SZ] = axv, sx, sz
        r[NAMP], r[NFREQ], r[NSTRY] = noise
        return len(self.rows) - 1

    def ell(self, c, rad, layer=0, k=0.02, op=UNION, up=(0, 1, 0), ax=(1, 0, 0), tag=None, noise=(0, 0, 1)):
        c = v3(c)
        m = max(rad) + k + abs(noise[0]) * 1.5 + 0.004
        r = self._row(ELLIPSOID, layer, op, k, c - m, c + m, tag)
        upv = nrm(up)
        axv = nrm(v3(ax) - upv * np.dot(v3(ax), upv))
        r[A:A + 3], r[B:B + 3], r[AX:AX + 3] = c, upv, axv
        r[RA], r[RB], r[SX] = rad
        r[NAMP], r[NFREQ], r[NSTRY] = noise
        return len(self.rows) - 1

    def box(self, c, half, layer=0, k=0.01, op=UNION, up=(0, 1, 0), ax=(1, 0, 0), round_=0.005, tag=None, noise=(0, 0, 1), t=BOX):
        c = v3(c)
        m = float(np.linalg.norm(half)) + k + abs(noise[0]) * 1.5 + 0.004
        r = self._row(t, layer, op, k, c - m, c + m, tag)
        upv = nrm(up)
        axv = nrm(v3(ax) - upv * np.dot(v3(ax), upv))
        r[A:A + 3], r[B:B + 3], r[AX:AX + 3] = c, upv, axv
        r[RA], r[RB], r[SX] = half
        r[SZ] = min(round_, min(half) * 0.99)
        r[NAMP], r[NFREQ], r[NSTRY] = noise
        return len(self.rows) - 1

    def torus(self, c, axis, R, r_, layer=0, k=0.01, op=UNION, tag=None, noise=(0, 0, 1)):
        c = v3(c)
        m = R + r_ + k + abs(noise[0]) * 1.5 + 0.004
        row = self._row(TORUS, layer, op, k, c - m, c + m, tag)
        row[A:A + 3], row[B:B + 3], row[RA], row[RB] = c, nrm(axis), R, r_
        row[NAMP], row[NFREQ], row[NSTRY] = noise
        return len(self.rows) - 1

    def plane(self, p, n, layer, op=INTER, k=0.0, lo=(-9, -9, -9), hi=(9, 9, 9), tag=None):
        r = self._row(PLANE, layer, op, k, v3(lo), v3(hi), tag)
        r[A:A + 3], r[B:B + 3] = v3(p), nrm(n)
        return len(self.rows) - 1

    def garment(self, layer, thick, masks, k=0.012, noise=(0, 0, 1), tag=None, base=None):
        """masks: list of callables that add mask primitives (layer -1) and return their indices"""
        lo = len(self.rows)
        for f in masks:
            f()
        hi = len(self.rows)
        bl = np.min([self.rows[i][BMIN:BMIN + 3] for i in range(lo, hi)], axis=0) - thick - 0.03
        bh = np.max([self.rows[i][BMAX:BMAX + 3] for i in range(lo, hi)], axis=0) + thick + 0.03
        r = self._row(OFFSET, layer, UNION, k, bl, bh, tag)
        r[RA], r[MLO], r[MHI] = thick, lo, hi
        r[TAG] = self.base if base is None else base
        r[NAMP], r[NFREQ], r[NSTRY] = noise
        return len(self.rows) - 1

    def array(self):
        rows = np.array(self.rows)
        # layer order matters: body first so garments can read it; masks stay where they are (index ranges)
        return rows
