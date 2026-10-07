"""The body under the clothes: MakeHuman's base mesh (hm08) and its shape targets, both released CC0.

Its macro targets give a real human body for a sex, age, build and ancestry (here East Asian); a few measure targets
shape it further. The body is then fitted to the game's own skeleton (the joints in rigs.json): each limb segment is
turned and stretched onto its game bone, blended by MakeHuman's own skin weights, so the flesh sits on the bones the
game animates. What comes out is the triangle surface (metres, feet on y = 0, facing +z, the figure's left at +x),
the eyeballs, and landmarks (eyes, mouth, nose, ears, hands) for painting the face.

Data: MH_DATA (default /tmp/claude-0/mhd) holds 3dobjs/base.obj, targets/, rigs/standard/ from the MPFB 2 release
(download.tuxfamily.org/makehuman/releases/mpfb-2.0.0-a2.zip, mpfb/data/)."""
import gzip, json, os
import numpy as np

MHD = os.environ.get('MH_DATA', '/tmp/claude-0/mhd')
_obj = None


def load_base():
    global _obj
    if _obj is not None:
        return _obj
    cache = os.path.join(MHD, 'base_cache.npz')
    if os.path.exists(cache):
        z = np.load(cache, allow_pickle=True)
        _obj = {k: z[k] for k in z.files}
        _obj['groups'] = z['groups'].item()
        return _obj
    V, faces, fg, groups, g = [], [], [], {}, None
    for line in open(os.path.join(MHD, '3dobjs/base.obj')):
        if line.startswith('v '):
            V.append([float(x) for x in line.split()[1:4]])
        elif line.startswith('g '):
            g = line.split()[1]
        elif line.startswith('f '):
            idx = [int(t.split('/')[0]) - 1 for t in line.split()[1:]]
            groups.setdefault(g, []).append(len(faces))
            faces.append(idx + [idx[-1]] * (4 - len(idx)))
    _obj = {'V': np.array(V) * 0.1, 'F': np.array(faces, np.int32), 'groups': {k: np.array(v) for k, v in groups.items()}}
    np.savez(cache, V=_obj['V'], F=_obj['F'], groups=np.array(_obj['groups'], dtype=object))
    return _obj


def target(name):
    p = os.path.join(MHD, 'targets', name + '.target.gz')
    rows = [l.split() for l in gzip.open(p, 'rt') if l.strip() and not l.startswith('#')]
    if not rows:
        return np.zeros(0, np.int64), np.zeros((0, 3))
    a = np.array(rows, float)
    return a[:, 0].astype(np.int64), a[:, 1:4] * 0.1


def parts(v, levels, cuts):
    """weights of the named levels for a slider value (MakeHuman's macro interpolation)"""
    w = {}
    for (lo, hi), (a, b) in zip(cuts, zip(levels[:-1], levels[1:])):
        if lo <= v <= hi:
            t = (v - lo) / (hi - lo)
            w[a] = w.get(a, 0) + 1 - t
            w[b] = w.get(b, 0) + t
            break
    return {k: x for k, x in w.items() if x > 1e-6}


def age_value(years):
    return 0.1875 + (years - 11) / 14 * 0.3125 if years < 25 else 0.5 + (years - 25) / 65 * 0.5


def shape(gender=0.0, years=25, muscle=0.5, weight=0.5, height=0.5, proportions=0.5, race=None, cup=0.5, firm=0.5, extra=None):
    """the base mesh's vertices for these settings (metres, MakeHuman's own frame)"""
    O = load_base()
    V = O['V'].copy()
    race = race or {'asian': 1.0}
    G = {'female': 1 - gender, 'male': gender}
    A = parts(age_value(years), ['baby', 'child', 'young', 'old'], [(0, 0.1875), (0.1875, 0.5), (0.5, 1.0)])
    M = parts(muscle, ['minmuscle', 'averagemuscle', 'maxmuscle'], [(0, 0.5), (0.5, 1.0)])
    W = parts(weight, ['minweight', 'averageweight', 'maxweight'], [(0, 0.5), (0.5, 1.0)])
    Hh = {'minheight': max(0.0, (0.5 - height) * 2), 'maxheight': max(0.0, (height - 0.5) * 2)}
    Pp = {'uncommonproportions': max(0.0, (0.5 - proportions) * 2), 'idealproportions': max(0.0, (proportions - 0.5) * 2)}
    C = parts(cup, ['mincup', 'averagecup', 'maxcup'], [(0, 0.5), (0.5, 1.0)])
    Fm = parts(firm, ['minfirmness', 'averagefirmness', 'maxfirmness'], [(0, 0.5), (0.5, 1.0)])
    todo = []
    for g, gw in G.items():
        if gw <= 0: continue
        for a, aw in A.items():
            for r, rw in race.items():
                todo.append((f'macrodetails/{r}-{g}-{a}', gw * aw * rw))
            for m, mw in M.items():
                for w_, ww in W.items():
                    base = gw * aw * mw * ww
                    todo.append((f'macrodetails/universal-{g}-{a}-{m}-{w_}', base))
                    for k, x in Hh.items():
                        if x > 0: todo.append((f'macrodetails/height/{g}-{a}-{m}-{w_}-{k}', base * x))
                    for k, x in Pp.items():
                        if x > 0: todo.append((f'macrodetails/proportions/{g}-{a}-{m}-{w_}-{k}', base * x))
                    if g == 'female':
                        for c, cw in C.items():
                            for f, fw in Fm.items():
                                if c == 'averagecup' and f == 'averagefirmness': continue
                                todo.append((f'breast/{g}-{a}-{m}-{w_}-{c}-{f}', base * cw * fw))
    for name, x in (extra or {}).items():  # measure targets: {'torso/measure-waist-circ-decr': 0.4, ...}
        todo.append((name, x))
    for name, x in todo:
        if x <= 1e-5: continue
        try:
            i, d = target(name)
        except FileNotFoundError:
            continue
        V[i] += d * x
    return V


def cube(V, name):
    O = load_base()
    f = O['F'][O['groups'][name]]
    return V[np.unique(f)].mean(axis=0)


def rig_joints(V):
    """MakeHuman's joints on this shape"""
    names = ['pelvis', 'neck', 'head', 'head-2', 'spine-1', 'spine-2', 'spine-3', 'spine-4', 'ground', 'mouth', 'jaw']
    J = {n: cube(V, 'joint-' + n) for n in names}
    for s, S in (('l', 'L'), ('r', 'R')):
        for n in ('clavicle', 'shoulder', 'elbow', 'hand', 'hand-3', 'upper-leg', 'knee', 'ankle', 'foot-1', 'eye', 'upperlid', 'lowerlid'):
            J[f'{n}{S}'] = cube(V, f'joint-{s}-{n}')
    return J


# MakeHuman's game-engine skeleton, gathered into the pieces the fit moves on their own
GROUPS = {
    'torso': ['Root', 'pelvis', 'spine_01', 'spine_02', 'spine_03', 'clavicle_l', 'clavicle_r'],
    'head': ['neck_01', 'head'],
    'upperL': ['upperarm_l'], 'lowerL': ['lowerarm_l'], 'handL': ['hand_l'],
    'upperR': ['upperarm_r'], 'lowerR': ['lowerarm_r'], 'handR': ['hand_r'],
    'thighL': ['thigh_l'], 'calfL': ['calf_l'], 'footL': ['foot_l', 'ball_l'],
    'thighR': ['thigh_r'], 'calfR': ['calf_r'], 'footR': ['foot_r', 'ball_r'],
}
_W = None


def group_weights():
    global _W
    if _W is not None:
        return _W
    W = json.load(open(os.path.join(MHD, 'rigs/standard/weights.game_engine.json')))['weights']
    n = len(load_base()['V'])
    names = list(GROUPS)
    M = np.zeros((n, len(names)))
    for gi, g in enumerate(names):
        for b in GROUPS[g]:
            for b2, lst in W.items():
                if b2 == b or (b2.startswith(('index', 'middle', 'ring', 'pinky', 'thumb')) and b2.endswith(b[-2:]) and b.startswith('hand')):
                    for vi, w in lst:
                        M[int(vi), gi] += w
    s = M.sum(axis=1, keepdims=True)
    M[s[:, 0] == 0, 0] = 1.0  # helpers no bone holds ride with the torso
    _W = (names, M / np.maximum(M.sum(axis=1, keepdims=True), 1e-9))
    return _W


def rot_between(a, b):
    a, b = a / np.linalg.norm(a), b / np.linalg.norm(b)
    v, c = np.cross(a, b), float(np.dot(a, b))
    if np.linalg.norm(v) < 1e-9:
        return np.eye(3)
    K = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    return np.eye(3) + K + K @ K / (1 + c)


def seg_xf(a0, b0, a1, b1, radial=1.0):
    """the map taking segment a0-b0 onto a1-b1: turned, stretched along its length, scaled across by radial"""
    d0 = b0 - a0; L0 = np.linalg.norm(d0); u = d0 / L0
    s = np.linalg.norm(b1 - a1) / L0
    S = np.eye(3) * radial + (s - radial) * np.outer(u, u)
    R = rot_between(d0, b1 - a1)
    M = R @ S
    return M, a1 - M @ a0


def fit(V, J, G, radial=1.0):
    """move the shape onto the game's joints G (rigs.json, metres) with linear blend skinning"""
    ground = J['ground'][1]
    V = V - [0, ground, 0]
    J = {k: v - [0, ground, 0] for k, v in J.items()}
    g = {k: np.asarray(v, float) for k, v in G.items()}
    X = {}
    # the trunk: pelvis to the base of the neck, stretched upright only; the game's head joint is that neck base
    sy = (g['head'][1] - g['pelvis'][1]) / (J['neck'][1] - J['pelvis'][1])
    Mt = np.diag([radial, sy, radial])
    X['torso'] = (Mt, g['pelvis'] - Mt @ J['pelvis'])
    X['head'] = (np.eye(3), g['head'] - J['neck'])
    for S in 'LR':
        X['upper' + S] = seg_xf(J['shoulder' + S], J['elbow' + S], g['sh' + S], g['el' + S], radial)
        Ml, tl = seg_xf(J['elbow' + S], J['hand' + S], g['el' + S], g['hand' + S], radial)
        X['lower' + S] = (Ml, tl)
        Mh = rot_between(J['hand' + S] - J['elbow' + S], g['hand' + S] - g['el' + S])
        X['hand' + S] = (Mh, g['hand' + S] - Mh @ J['hand' + S])
        # legs: the game's ankle sits lower than the anatomical one; keep the foot on the ground and the ankle height
        an = np.array([g['ankle' + S][0], J['ankle' + S][1], g['ankle' + S][2]])
        X['thigh' + S] = seg_xf(J['upper-leg' + S], J['knee' + S], g['hip' + S], g['knee' + S], radial)
        X['calf' + S] = seg_xf(J['knee' + S], J['ankle' + S], g['knee' + S], an, radial)
        X['foot' + S] = (np.eye(3), an - J['ankle' + S])
    names, Wm = group_weights()
    out = np.zeros_like(V)
    for gi, nm in enumerate(names):
        M, t = X[nm]
        w = Wm[:, gi]
        nz = w > 0
        out[nz] += w[nz, None] * (V[nz] @ M.T + t)
    Jn = {}
    for k, v in J.items():  # the joints themselves, carried by the piece they belong to
        nm = {'neck': 'head', 'head': 'head', 'head-2': 'head', 'mouth': 'head', 'jaw': 'head'}.get(k)
        for S in 'LR':
            if k.endswith(S) and len(k) > 1:
                base = k[:-1]
                nm = {'shoulder': 'upper' + S, 'elbow': 'lower' + S, 'hand': 'hand' + S, 'hand-3': 'hand' + S, 'upper-leg': 'thigh' + S,
                      'knee': 'calf' + S, 'ankle': 'foot' + S, 'foot-1': 'foot' + S, 'clavicle': 'torso',
                      'eye': 'head', 'upperlid': 'head', 'lowerlid': 'head'}.get(base, nm)
        nm = nm or 'torso'
        M, t = X[nm]
        Jn[k] = M @ v + t
    return out, Jn


def body(look, G, s):
    """the fitted body for a game character: surface triangles, eyes and landmarks"""
    fem = bool(look.get('female'))
    girth = look.get('girth', 1.0)
    years = look.get('age', 24 if fem else 32)
    weight = float(np.clip(0.5 + (girth - (0.88 if fem else 1.0)) * 1.6, 0.05, 1.0))
    muscle = look.get('muscle', 0.42 if fem else 0.58)
    extra = {f'eyes/{S}-eye-height2-incr': 0.45 for S in 'lr'}       # eyes open enough to read at a distance
    if fem:
        extra.update({f'eyes/{S}-eye-scale-incr': 0.2 for S in 'lr'})  # a woman's figure that reads at a distance: waist in, hips and bust a little fuller
        extra.update({'torso/measure-waist-circ-decr': 0.45, 'hip/hip-scale-horiz-incr': 0.15, 'torso/measure-shoulder-dist-decr': 0.25,
                      'head/head-oval': 0.4})
    if look.get('weight', 0) > 95:
        weight = max(weight, 0.85); extra['stomach/stomach-pregnant-incr'] = 0.25
    V = shape(gender=0.0 if fem else 1.0, years=years, muscle=muscle, weight=weight, proportions=0.75 if fem else 0.6,
              cup=look.get('cup', 0.55 if fem else 0.5), firm=0.6, extra=extra)
    J = rig_joints(V)
    V, J = fit(V, J, G)
    O = load_base()
    F = O['F'][O['groups']['body']]
    tri = np.concatenate([F[:, [0, 1, 2]], F[:, [0, 2, 3]]])
    tri = tri[(tri[:, 0] != tri[:, 1]) & (tri[:, 1] != tri[:, 2]) & (tri[:, 0] != tri[:, 2])]
    used = np.unique(tri)
    remap = -np.ones(len(V), np.int64); remap[used] = np.arange(len(used))
    eyes = []
    for S, g in (('L', 'helper-l-eye'), ('R', 'helper-r-eye')):
        ev = V[np.unique(O['F'][O['groups'][g]])]
        c = ev.mean(axis=0); r = float(np.linalg.norm(ev - c, axis=1).mean())
        eyes.append((c, r))
    marks = landmarks(V, J, O)
    return {'V': V[used], 'F': remap[tri].astype(np.int32), 'J': J, 'eyes': eyes, 'marks': marks, 'Vall': V}


def landmarks(V, J, O):
    """clusters of body vertices the colour pass paints: mouth, nose, ears, hands (by position on this mesh)"""
    bv = np.unique(O['F'][O['groups']['body']])
    P = V[bv]
    eL, eR = J['eyeL'], J['eyeR']
    ec = (eL + eR) / 2; ew = np.linalg.norm(eL - eR)
    m = J['mouth']
    out = {}
    d = P - m
    out['mouth'] = P[(np.abs(d[:, 0]) < ew * 0.42) & (np.abs(d[:, 1]) < ew * 0.16) & (d[:, 2] > -ew * 0.05)]
    near = (np.abs(P[:, 0] - ec[0]) < ew * 0.25) & (P[:, 1] < ec[1]) & (P[:, 1] > m[1] + ew * 0.1)
    tip = P[near][np.argmax(P[near][:, 2])]
    out['nose'] = P[near & (np.linalg.norm(P - tip, axis=1) < ew * 0.45) & (P[:, 2] > tip[2] - ew * 0.5)]
    for S, sx in (('L', 1), ('R', -1)):
        side = P[(np.abs(P[:, 1] - ec[1] + ew * 0.1) < ew * 0.6) & (np.abs(P[:, 2] - (ec[2] - ew * 1.3)) < ew * 0.6)]
        side = side[side[:, 0] * sx > 0]
        x0 = side[:, 0].max() if sx > 0 else side[:, 0].min()
        out['ear' + S] = side[np.abs(side[:, 0] - x0) < ew * 0.22]
    return out


# ---------- the body as distance volumes, for the sculpting kernel ----------
def sdist(P, V, F):
    import igl
    S, _, _, _ = igl.signed_distance(np.ascontiguousarray(P, np.float64), V, F, sign_type=igl.SIGNED_DISTANCE_TYPE_FAST_WINDING_NUMBER)
    return S


def axes(lo, hi, h):
    n = np.ceil((np.asarray(hi) - lo) / h).astype(int) + 1
    return [lo[i] + np.arange(n[i]) * h for i in range(3)], n


def band_grid(V, F, lo, hi, h, prev, out_band, in_band):
    """exact distance where the coarser volume says the surface is near, its value elsewhere"""
    from scipy.ndimage import map_coordinates
    lo = np.asarray(lo, float)
    ax, n = axes(lo, hi, h)
    X, Y, Z = np.meshgrid(*ax, indexing='ij')
    P = np.stack([X.ravel(), Y.ravel(), Z.ravel()], 1)
    po, ph, pd = prev
    c = map_coordinates(pd, ((P - po) / ph).T, order=1, mode='nearest')
    need = (c < out_band + ph * 0.9) & (c > -in_band - ph * 0.9)
    d = c.copy()
    d[need] = sdist(P[need], V, F)
    return lo, h, d.reshape(n).astype(np.float32)


def distance_grids(B, s):
    """finest first: head, hands, feet, then the whole body"""
    import igl
    V, F = igl.loop(B['V'], B['F'], 1)
    J = B['J']
    lo = V.min(axis=0) - 0.06; hi = V.max(axis=0) + 0.06
    ax, n = axes(lo, hi, 0.016)
    X, Y, Z = np.meshgrid(*ax, indexing='ij')
    coarse = (lo, 0.016, sdist(np.stack([X.ravel(), Y.ravel(), Z.ravel()], 1), V, F).reshape(n))
    body = band_grid(V, F, lo, hi, 0.004, coarse, 0.045, 0.02)
    out = []
    hc = (J['eyeL'] + J['eyeR']) / 2
    hlo = np.array([hc[0] - 0.12, J['neck'][1] - 0.02, hc[2] - 0.24]); hhi = np.array([hc[0] + 0.12, hc[1] + 0.16, hc[2] + 0.06])
    out.append(band_grid(V, F, hlo, hhi, 0.0015, body, 0.022, 0.008))
    for S in 'LR':
        hd, h3 = J['hand' + S], J['hand-3' + S]
        c = hd + (h3 - hd) * 1.2
        out.append(band_grid(V, F, c - 0.13, c + 0.13, 0.002, body, 0.014, 0.006))
        an = J['ankle' + S]
        out.append(band_grid(V, F, an + [-0.08, -0.08, -0.1], an + [0.08, 0.1, 0.2], 0.0025, body, 0.02, 0.008))
    out.append(body)
    return out, (V, F)


# ---------- what the colour pass paints on the face, as distances like the hand-built head's features ----------
def face_marks(B):
    """lid margins (the edges of the eye openings), the mouth line, and the clusters found by landmarks()"""
    O = load_base()
    V, F = B['V'], B['F']
    E = np.sort(np.concatenate([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]]), axis=1)
    u, c = np.unique(E, axis=0, return_counts=True)
    bnd = np.unique(u[c == 1])
    out = {'lidU': [], 'lidL': []}
    for c_, r in B['eyes']:
        bv = bnd[np.linalg.norm(V[bnd] - c_, axis=1) < r * 2.2]
        out['lidU'].append(V[bv[V[bv, 1] > c_[1] - r * 0.15]])
        out['lidL'].append(V[bv[V[bv, 1] <= c_[1] - r * 0.15]])
    out = {k: np.concatenate(v) for k, v in out.items()}
    Va = B['Vall']
    ut = Va[np.unique(O['F'][O['groups']['helper-upper-teeth']])]; lt = Va[np.unique(O['F'][O['groups']['helper-lower-teeth']])]
    front = lambda T: T[T[:, 2] > T[:, 2].max() - 0.004]
    slit = (front(ut)[:, 1].min() + front(lt)[:, 1].max()) / 2
    out['slit'] = np.array([0.0, slit, max(ut[:, 2].max(), lt[:, 2].max())])
    out['mouthW'] = float(np.ptp(ut[:, 0])) * 0.5
    for k in ('nose', 'earL', 'earR'):
        out[k] = B['marks'][k]
    return out


def tag_distance(B, marks, P, tag, s):
    """a stand-in for the distance to a hand-built feature, so the colour rules carry over"""
    from scipy.spatial import cKDTree
    def near(pts):
        return cKDTree(pts).query(P)[0].astype(np.float32)
    if tag in ('nose', 'lidU', 'lidL'):
        return near(marks[tag])
    if tag == 'ear':
        return near(np.concatenate([marks['earL'], marks['earR']]))
    sl, hw = marks['slit'], marks['mouthW']
    x, y, z = P[:, 0] / hw, P[:, 1] - sl[1], P[:, 2]
    fr = z > sl[2] - 0.004
    if tag in ('lipU', 'lipL'):
        up = tag == 'lipU'
        hy = (0.0062 * (1 - 0.45 * x * x) + 0.0006 * np.cos(x * 9)) if up else 0.0078 * (1 - 0.35 * x * x)
        yy = np.where(up, np.maximum(y, 0), np.maximum(-y, 0)) / np.maximum(hy, 1e-4)
        e = np.sqrt(x * x + yy * yy) * ((y >= 0) if up else (y < 0))
        e = np.where(((y >= 0) if up else (y < 0)) & fr, e, 9.0)
        return (np.maximum(e - 1.0, 0.0) * 0.008).astype(np.float32)
    if tag == 'mouth':
        return np.where((np.abs(x) < 0.92) & fr, np.abs(y) - 0.0007, 9.0).astype(np.float32)
    if tag == 'hand':
        d = np.full(len(P), 9.0, np.float32)
        J = B['J']
        for S in 'LR':
            a, b = J['elbow' + S], J['hand' + S]
            ax = (b - a) / np.linalg.norm(b - a)
            t = (P - b) @ ax
            d = np.minimum(d, np.where((t > 0.01) & (np.linalg.norm(P - b, axis=1) < 0.25), 0.0, 9.0))
        return d
    return None
