"""Characters dressed from MakeHuman's own asset library: a low-poly body (proxy) with a real skin texture, eyes,
eyebrows and lashes, hair made of strand cards, and fitted clothes with their fabric maps.

Every asset says where each of its vertices sits relative to the base mesh (three base vertices, weights and an
offset: .proxy / .mhclo files), so once the base mesh has been shaped and fitted to the game's skeleton (mh.py) the
assets follow it, and take their skin weights from the same three vertices.

Assets: MH_ASSETS (default /tmp/claude-0/mha), laid out like download.tuxfamily.org/makehuman/assets/1.1/base/."""
import os, re
import numpy as np

MHA = os.environ.get('MH_ASSETS', '/tmp/claude-0/mha')


def read_obj(path):
    V, T, faces = [], [], []
    group = None
    for line in open(path, errors='ignore'):
        if line.startswith('v '):
            V.append([float(x) for x in line.split()[1:4]])
        elif line.startswith('vt '):
            T.append([float(x) for x in line.split()[1:3]])
        elif line.startswith('g '):
            group = line.split()[1] if len(line.split()) > 1 else None
        elif line.startswith('f '):
            vs, ts = [], []
            for tok in line.split()[1:]:
                p = tok.split('/')
                vs.append(int(p[0]) - 1); ts.append(int(p[1]) - 1 if len(p) > 1 and p[1] else -1)
            faces.append((vs, ts, group))
    return np.array(V), np.array(T) if T else np.zeros((0, 2)), faces


def tris(faces, keep=None):
    tv, tt = [], []
    for vs, ts, g in faces:
        if keep is not None and not keep(vs, g):
            continue
        for k in range(1, len(vs) - 1):
            tv.append([vs[0], vs[k], vs[k + 1]]); tt.append([ts[0], ts[k], ts[k + 1]])
    return np.array(tv, np.int64), np.array(tt, np.int64)


def read_map(path):
    """a .proxy or .mhclo: where its vertices sit on the base mesh, which base vertices it hides, its files"""
    M = {'scale': {}, 'refs': [], 'w': [], 'off': [], 'delete': set(), 'obj': None, 'mat': None, 'zdepth': 50}
    mode = None
    for line in open(path, errors='ignore'):
        s = line.strip()
        if not s or s.startswith('#'):
            continue
        p = s.split()
        if p[0] in ('x_scale', 'y_scale', 'z_scale'):
            M['scale'][p[0][0]] = (int(p[1]), int(p[2]), float(p[3])); continue
        if p[0] == 'obj_file': M['obj'] = p[1]; continue
        if p[0] == 'material': M['mat'] = p[1]; continue
        if p[0] == 'z_depth': M['zdepth'] = int(p[1]); continue
        if p[0] == 'verts': mode = 'verts'; continue
        if p[0] == 'delete_verts': mode = 'delete'; continue
        if p[0] in ('weights', 'vertexboneweights_file'): mode = None; continue
        if mode == 'verts' and re.match(r'^-?\d', p[0]):
            if len(p) == 1:
                M['refs'].append([int(p[0])] * 3); M['w'].append([1.0, 0, 0]); M['off'].append([0, 0, 0])
            elif len(p) >= 9:
                M['refs'].append([int(x) for x in p[:3]]); M['w'].append([float(x) for x in p[3:6]]); M['off'].append([float(x) for x in p[6:9]])
            continue
        if mode == 'delete' and re.match(r'^\d', p[0]):
            i = 0
            while i < len(p):
                if i + 2 < len(p) and p[i + 1] == '-':
                    M['delete'].update(range(int(p[i]), int(p[i + 2]) + 1)); i += 3
                else:
                    M['delete'].add(int(p[i])); i += 1
            continue
    M['refs'] = np.array(M['refs'], np.int64); M['w'] = np.array(M['w']); M['off'] = np.array(M['off'])
    return M


def fit_map(M, Vm):
    """the asset's vertices on a shaped base mesh (metres in, metres out; MakeHuman's offsets are in decimetres)"""
    Vd = Vm * 10.0
    sc = np.ones(3)
    for ax, i in (('x', 0), ('y', 1), ('z', 2)):
        if ax in M['scale']:
            a, b, den = M['scale'][ax]
            sc[i] = abs(Vd[a, i] - Vd[b, i]) / den
    P = (Vd[M['refs']] * M['w'][:, :, None]).sum(1) + M['off'] * sc
    return P * 0.1


def vertex_normals(P, F):
    N = np.zeros_like(P)
    fn = np.cross(P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 0]])
    for k in range(3):
        np.add.at(N, F[:, k], fn)
    return N / np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-12)


def tangents(P, N, U, F):
    t = np.zeros_like(P); b = np.zeros_like(P)
    p0, p1, p2 = P[F[:, 0]], P[F[:, 1]], P[F[:, 2]]
    u0, u1, u2 = U[F[:, 0]], U[F[:, 1]], U[F[:, 2]]
    e1, e2, d1, d2 = p1 - p0, p2 - p0, u1 - u0, u2 - u0
    r = d1[:, 0] * d2[:, 1] - d2[:, 0] * d1[:, 1]
    r = np.where(np.abs(r) < 1e-12, 1e-12, r)
    sd = (e1 * d2[:, 1:2] - e2 * d1[:, 1:2]) / r[:, None]
    td = (e2 * d1[:, 0:1] - e1 * d2[:, 0:1]) / r[:, None]
    for k in range(3):
        np.add.at(t, F[:, k], sd); np.add.at(b, F[:, k], td)
    t = t - N * (t * N).sum(1, keepdims=True)
    t /= np.maximum(np.linalg.norm(t, axis=1, keepdims=True), 1e-12)
    w = np.where((np.cross(N, t) * b).sum(1) < 0, -1.0, 1.0)
    return np.concatenate([t, w[:, None]], 1)


def split_uv(Pv, TV, TT, UVs, Wv):
    """one game vertex per (position, uv) pair; normals from the welded positions so seams don't show"""
    Nv = vertex_normals(Pv, TV)
    key = TV.astype(np.int64) * (len(UVs) + 1) + np.where(TT < 0, len(UVs), TT)
    uk, inv = np.unique(key.ravel(), return_inverse=True)
    vi = uk // (len(UVs) + 1); ti = uk % (len(UVs) + 1)
    U = np.vstack([UVs, [[0.0, 0.0]]])[ti]
    P, N, W = Pv[vi], Nv[vi], Wv[vi]
    F = inv.reshape(-1, 3)
    return P, N, U, F, W


def top4(W):
    idx = np.argsort(-W, axis=1)[:, :4]
    w = np.take_along_axis(W, idx, 1)
    w = w / np.maximum(w.sum(1, keepdims=True), 1e-9)
    return idx.astype(np.uint8), w
