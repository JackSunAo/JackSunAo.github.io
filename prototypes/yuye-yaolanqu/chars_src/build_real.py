"""A dressed character from MakeHuman's asset library, in one of two looks, as game files:
  real   the photographic skin, fabric and hair textures as they are (plus grime)
  paint  the same textures turned into brushwork (a Kuwahara filter, inked edges, canvas grain), lit in bands in game
usage: python build_real.py <id> <rigs.json> <out dir> <real|paint>"""
import sys, json, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage
import mh, mhkit as K

A = K.MHA
C = os.environ.get('MH_COMMUNITY', '/tmp/claude-0/mhc/x')   # the community asset packs (CC0), unpacked
BONES = mh.GAME_BONES


def ap(p):
    """an asset path: 'c/...' in the community packs, else in the base library"""
    return f'{C}/{p[2:]}' if p.startswith('c/') else (p if os.path.isabs(p) else f'{A}/{p}')

# what each sample wears: asset folders, and how to recolour them
OUTFITS = {
    'mei': {'proxy': 'proxymeshes/female_generic/female_generic.proxy', 'skin': 'skins/young_lightskinned_female_diffuse3.png', 'skin_tint': (1.0, 0.95, 0.84),
            'eyes': 'eyes/brownlight_eye.png', 'brows': 'eyebrows/eyebrow010/eyebrow010.mhclo', 'lashes': 'eyelashes/eyelashes02/eyelashes02.mhclo',
            'hair': ('hair/ponytail01/ponytail01.mhclo', (0.16, 0.11, 0.08)),
            'clothes': [('clothes/female_casualsuit01/female_casualsuit01.mhclo', {'top': '#6e7f84'}), ('clothes/shoes03/shoes03.mhclo', {})]},
    # survivor: a knit sweater, wool trousers, ankle boots, hair up; mud on the boots and the turn-ups
    'mei2': {'look': 'mei', 'proxy': 'proxymeshes/female_generic/female_generic.proxy', 'skin': 'c/skins/onlytheghosts_young_eurasian_female', 'skin_tint': (1.0, 0.98, 0.95),
             'eyes': 'eyes/brownlight_eye.png', 'brows': 'eyebrows/eyebrow010/eyebrow010.mhclo', 'lashes': 'eyelashes/eyelashes02/eyelashes02.mhclo',
             'hair': ('c/hair/rehmanpolanski_hair_bun_brown/rehmanpolanski_hair_bun_brown.mhclo', (0.12, 0.085, 0.06)),
             'clothes': [('c/clothes/toigo_wool_pants/toigo_wool_pants.mhclo', {'all': '#2e3138'}), ('c/clothes/toigo_fisherman_sweater/toigo_fisherman_sweater.mhclo', {'all': '#66767c'}),
                         ('c/clothes/toigo_ankle_boots_female/toigo_ankle_boots_female.mhclo', {'all': '#2a211b'})], 'mud': 0.7},
    # infected nurse: a white uniform dress, tights, flats; the grey skin of the turned, blood at the mouth and down the front
    'nurse2': {'look': 'nurse', 'proxy': 'proxymeshes/female_generic/female_generic.proxy', 'skin': 'c/skins/sohh_female_zombie_skin', 'skin_tint': (1.0, 1.0, 1.0),
               'eyes': 'eyes/brownlight_eye.png', 'eye_cloud': True, 'brows': 'eyebrows/eyebrow010/eyebrow010.mhclo', 'lashes': 'eyelashes/eyelashes02/eyelashes02.mhclo',
               'hair': ('c/hair/toigo_blunt_bob/toigo_blunt_bob.mhclo', (0.1, 0.07, 0.05)),
               'clothes': [('c/clothes/kwnet_at_pantyhose01/kwnet_at_pantyhose01.mhclo', {'all': '#d9cfc2', 'sheer': True}), ('c/clothes/toigo_shift_dress/toigo_shift_dress.mhclo', {'all': '#dfe3e0'}),
                           ('c/clothes/toigo_ballet_flats/toigo_ballet_flats.mhclo', {'all': '#e4e2dc'})], 'mud': 0.9, 'blood': 1.0},
}


# id colours for the low-poly bake: far apart so blending at the seams can be undone by taking the nearest
ID_COL = [np.array(c, np.float32) / 255 for c in ((255, 0, 0), (0, 255, 0), (0, 0, 255), (255, 255, 0), (255, 0, 255), (0, 255, 255), (255, 128, 0), (128, 0, 255),
                                                   (0, 128, 255), (255, 0, 128), (128, 255, 0), (0, 255, 128), (128, 128, 128), (255, 255, 255), (64, 0, 0), (0, 64, 0))]


def hexc(h):
    h = h.lstrip('#'); return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.float32) / 255.0


def mhmat(path):
    out = {}
    for line in open(path, errors='ignore'):
        p = line.split()
        if len(p) >= 2 and p[0] in ('diffuseTexture', 'normalmapTexture', 'aomapTexture', 'bumpmapTexture'):
            out[p[0]] = os.path.normpath(os.path.join(os.path.dirname(path), p[1]))
    return out


def load(path, size, alpha=False):
    im = Image.open(path).convert('RGBA' if alpha else 'RGB')
    if size: im = im.resize((size, size), Image.LANCZOS)
    return np.asarray(im, np.float32) / 255.0


def save(arr, path, q=90):
    Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8)).save(path, quality=q, method=6)


def uv_mask(size, U, F, sel):
    """texels covered by the chosen triangles (to recolour one garment of a two-piece outfit)"""
    im = Image.new('L', (size, size), 0); d = ImageDraw.Draw(im)
    for f in F[sel]:
        d.polygon([(U[i, 0] * size, (1 - U[i, 1]) * size) for i in f], fill=255)
    return ndimage.binary_dilation(np.asarray(im) > 0, iterations=3)


def weather(tx, P, TV, TT, UV, kind, O, B, G):
    """mud splashed up from the ground, grime in the cloth, and on the infected the blood: at the mouth, down the front, on the hands"""
    import sdf
    size = tx.shape[0]
    Pc = P[TV].reshape(-1, 3); Uc = UV[TT].reshape(-1, 2); Fc = np.arange(len(Pc)).reshape(-1, 3)
    pos, cov = K.raster_positions(Uc, Fc, Pc, size)
    q = pos.reshape(-1, 3)
    nz = lambda f, sy=1.0, off=0.0: sdf.fbm_at(q + off, f, sy).reshape(size, size)
    y = pos[..., 1]
    rgb = tx[..., :3]
    if kind == 'cloth':  # wear and grime
        rgb = rgb * (1 - 0.14 * np.clip(nz(5.0) + 0.3, 0, 1))[..., None]
    mud = O.get('mud', 0) * np.clip((0.5 - y) / 0.42, 0, 1) ** 1.4 * np.clip(nz(14.0, 1.0, 3.0) * 1.6 + 0.55, 0, 1)
    mud *= {'skin': 0.5, 'hair': 0.0}.get(kind, 1.0)
    rgb = rgb * (1 - mud[..., None] * 0.72) + np.array([0.19, 0.145, 0.1]) * mud[..., None] * 0.72
    bl = O.get('blood', 0)
    if bl and kind in ('skin', 'cloth'):
        em = (B['eyes'][0][0] + B['eyes'][1][0]) / 2
        src = [(em + [0, -0.065, -0.005], 0.04), (np.array([0.03, G['chest'][1] - 0.06, 0.12]), 0.08),
               (np.array(G['handL']) + [0, -0.06, 0], 0.07), (np.array(G['handR']) + [0, -0.06, 0], 0.06)]
        b = np.zeros(y.shape)
        for c, r in src:
            d = np.linalg.norm(pos - c, axis=-1) / r
            b = np.maximum(b, np.clip(1.3 - d, 0, 1) * np.clip(nz(30.0, 1.0, 7.0) * 1.4 + 0.75, 0, 1))
        # runs: down from the chin and the chest wound, thin and uneven
        top = em[1] - 0.06 - 0.12 * np.clip(nz(3.0, 1.0, 9.0) + 0.5, 0, 1)              # each run starts and stops at its own height
        run = np.clip(nz(45.0, 0.08, 2.0) * 3.4 - 0.55, 0, 1) * np.clip(nz(8.0, 0.3, 4.0) * 2 + 0.4, 0, 1)
        run *= (np.abs(pos[..., 0] - 0.015) < 0.1) * (y < top) * (y > G['pelvis'][1] - 0.2 + 0.15 * np.clip(nz(2.0, 1.0, 5.0), 0, 1)) * (pos[..., 2] > 0.0)
        b = np.clip(np.maximum(b, run * 0.8) * bl, 0, 1)
        blood = np.array([0.24, 0.02, 0.02]) * (0.8 + 0.4 * np.clip(nz(90.0, 1.0, 1.0)[..., None], -0.5, 0.5))
        rgb = rgb * (1 - b[..., None] * 0.88) + blood * b[..., None] * 0.88
    out = tx.copy(); out[..., :3] = np.where(cov[..., None], np.clip(rgb, 0, 1), tx[..., :3])
    return out


def covered(Pv, Nv, outer):
    """vertices lying under a layer of cloth (its nearest surface right over them, not off past its edge)"""
    import igl
    if not outer: return np.zeros(len(Pv), bool)
    V = np.concatenate([o[0] for o in outer]); off = np.cumsum([0] + [len(o[0]) for o in outer])[:-1]
    F = np.concatenate([o[1] + k for o, k in zip(outer, off)]).astype(np.int64)
    d2, fi, C = igl.point_mesh_squared_distance(np.ascontiguousarray(Pv, np.float64), V.astype(np.float64), F)
    fn = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]]); fn /= np.maximum(np.linalg.norm(fn, axis=1, keepdims=True), 1e-12)
    dv = Pv - C; n = fn[fi]
    along = (dv * n).sum(1); tang = np.linalg.norm(dv - n * along[:, None], axis=1)
    # near an opening (collar, cuff, hem) keep what's under: the cloth's edge must not leave a gap when it moves
    E = np.sort(np.concatenate([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]]), axis=1)
    u, c = np.unique(E, axis=0, return_counts=True)
    edge = V[np.unique(u[c == 1])]
    from scipy.spatial import cKDTree
    de = cKDTree(edge).query(C)[0] if len(edge) else np.full(len(C), 9.0)
    return (np.sqrt(d2) < 0.035) & (tang < 0.004) & (de > 0.018)


def recolour(tx, hexs):
    """a whole garment in another colour, its weave, folds and wear kept (prints and logos flattened out)"""
    lum = tx[..., :3].mean(-1, keepdims=True)
    ls = ndimage.median_filter(lum[..., 0], 25)[..., None]
    lum = np.where(np.abs(lum - ls) > 0.12, ls, lum)
    m = np.median(lum[lum > 0.02]) if (lum > 0.02).any() else 0.5
    out = tx.copy(); out[..., :3] = np.clip(lum / max(m, 1e-3) * hexc(hexs), 0, 1)
    return out


def sharpen(img, amount=0.55, radius=1.2):
    """unsharp mask: the library's textures are soft"""
    rgb = img[..., :3]
    bl = np.stack([ndimage.gaussian_filter(rgb[..., c], radius) for c in range(3)], -1)
    out = img.copy(); out[..., :3] = np.clip(rgb + (rgb - bl) * amount, 0, 1)
    return out


def neutral_skin(skin, target=(0.76, 0.60, 0.50), sat=0.9):
    """white-balance a skin texture toward a natural East Asian tone (the library's skins run orange)"""
    m = skin.reshape(-1, 3)
    body = m[(m.mean(1) > 0.25) & (m.mean(1) < 0.95)]
    gain = np.array(target) / np.maximum(np.median(body, 0), 1e-3)
    gain = gain / gain.mean() * (np.mean(target) / np.median(body.mean(1)))
    out = np.clip(skin * gain, 0, 1)
    g = out.mean(-1, keepdims=True)
    return np.clip(g + (out - g) * sat, 0, 1)


def skin_normal(skin, size):
    """pores and fine creases: high-pass of the skin's own shading plus a fine noise, as a normal map"""
    lum = skin.mean(-1)
    hp = lum - ndimage.gaussian_filter(lum, 3.0)
    rs = np.random.default_rng(11)
    pores = ndimage.gaussian_filter(rs.standard_normal(lum.shape), 0.7) * 0.008
    return bump_to_normal(hp * 0.4 + pores, strength=4.0)


def bump_to_normal(h, strength=6.0):
    gx = ndimage.sobel(h, 1) / 8.0; gy = ndimage.sobel(h, 0) / 8.0
    n = np.stack([-gx * strength, gy * strength, np.ones_like(h)], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return n * 0.5 + 0.5


def kuwahara(img, r):
    """oil-paint smoothing: each texel takes the mean of whichever neighbouring quadrant is the flattest"""
    out = np.empty_like(img)
    lum = img[..., :3].mean(-1)
    best = np.full(lum.shape, np.inf)
    k = r + 1
    for dy in (0, -r):
        for dx in (0, -r):
            m = ndimage.uniform_filter(lum, k, origin=(-dy - r // 2 if dy else r // 2, -dx - r // 2 if dx else r // 2) if False else 0)
            sh = lambda a: np.roll(np.roll(a, dy + r // 2, 0), dx + r // 2, 1)
            mu = sh(ndimage.uniform_filter(lum, k)); var = sh(ndimage.uniform_filter(lum * lum, k)) - mu * mu
            col = np.stack([sh(ndimage.uniform_filter(img[..., c], k)) for c in range(img.shape[-1])], -1)
            take = var < best
            out[take] = col[take]; best = np.where(take, var, best)
    return out


def painterly(img, r):
    rgb = img[..., :3]
    p = kuwahara(rgb, r)
    p = kuwahara(p, max(2, r // 2))
    lum = p.mean(-1)
    edges = np.clip((ndimage.gaussian_filter(lum, r * 0.5) - ndimage.gaussian_filter(lum, r * 1.6)) * -6, 0, 0.45)   # inked darks along the folds
    p = p * (1 - edges[..., None])
    g = p.mean(-1, keepdims=True); p = np.clip(g + (p - g) * 1.18, 0, 1)                                              # a little richer colour
    rs = np.random.default_rng(3)
    grain = ndimage.gaussian_filter(rs.standard_normal(lum.shape), 0.8) * 0.035
    strokes = ndimage.gaussian_filter(rs.standard_normal(lum.shape), (r * 1.5, r * 0.4)) * 0.18                      # brush direction
    p = np.clip(p * (1 + grain[..., None] + strokes[..., None]), 0, 1)
    return np.concatenate([p, img[..., 3:]], -1) if img.shape[-1] == 4 else p


def build(cid, rig, out, style):
    O = OUTFITS[cid]
    look, G = rig['look'], rig['joints']
    B = mh.body(look, G, rig['s'])
    Va = B['Vall']
    Wall = mh.game_weights_all(Va, G)
    parts = []
    os.makedirs(out, exist_ok=True)
    tag = f'{cid}_{style}'

    raw = {}; masks = {}
    def texsave(arr, name, size_note=''):
        raw[name] = arr
        if style == 'paint':
            if name == 'skin':  # skin painted smooth: soft planes of colour, warm in the shadows, no blotches
                rgb = arr[..., :3]
                base = np.stack([ndimage.gaussian_filter(rgb[..., c], 3.0) for c in range(3)], -1)
                det = rgb - np.stack([ndimage.gaussian_filter(rgb[..., c], 12.0) for c in range(3)], -1)
                arr = np.clip(base + det * 0.35, 0, 1)
                q = 14.0; arr = np.round(arr * q) / q * 0.5 + arr * 0.5   # a hint of flat, laid-down colour
            elif name not in ('eyes', 'brows', 'lashes'):
                arr = painterly(arr, max(3, arr.shape[0] // 200))
        fn = f'{tag}_{name}.webp'
        save(arr, f'{out}/{fn}')
        return fn

    def add(name, P, TV, TT, UV, W, tex, kind, alpha=0.0, double=False):
        Pp, N, U, F, Wp = K.split_uv(P, TV, TT, UV, W)
        T = K.tangents(Pp, N, U, F)
        si, sw = K.top4(Wp)
        parts.append({'name': name, 'kind': kind, 'alpha': alpha, 'double': double, 'tex': tex,
                      'd': {'P': Pp.astype(np.float32), 'N': N.astype(np.float32), 'U': U.astype(np.float32), 'T': T.astype(np.float32),
                            'SI': si, 'SW': sw.astype(np.float32), 'I': F.ravel().astype(np.uint32)}})
        print(f'  {name}: {len(Pp)} verts {len(F)} tris', flush=True)

    def asset(path):
        M = K.read_map(ap(path))
        d = os.path.dirname(ap(path))
        V0, UV, faces = K.read_obj(f'{d}/{M["obj"] or os.path.basename(path).replace(".mhclo", ".obj")}')
        P = K.fit_map(M, Va)
        W = (Wall[M['refs']] * M['w'][:, :, None]).sum(1)
        mats = [f for f in os.listdir(d) if f.endswith('.mhmat')]
        mt = mhmat(f'{d}/{mats[0]}') if mats else {}
        return M, P, W, UV, faces, mt

    deleted = set()
    loaded = []
    for path, recol in O['clothes']:
        M, P, W, UV, faces, mt = asset(path)
        deleted |= M['delete']
        TV, TT = K.tris(faces)
        loaded.append([path, recol, M, P, W, UV, TV, TT, mt])
    # each layer of clothes hides what is under it (from the outermost in): inner garments' faces and, below, the skin
    for i in range(len(loaded) - 1, -1, -1):
        outer = [(o[3], o[6]) for o in loaded[i + 1:] if not o[1].get('sheer')]
        if outer:
            P, TV = loaded[i][3], loaded[i][6]
            hid = covered(P, K.vertex_normals(P, TV), outer)
            keep = ~hid[TV].all(1)
            loaded[i][6], loaded[i][7] = TV[keep], loaded[i][7][keep]

    # the body: a lighter mesh than the base, skin where nothing covers it
    pm = K.read_map(ap(O["proxy"]))
    pd = os.path.dirname(ap(O["proxy"]))
    _, puv, pf = K.read_obj(f'{pd}/{pm["obj"]}')
    PP = K.fit_map(pm, Va); WP = (Wall[pm['refs']] * pm['w'][:, :, None]).sum(1)
    hidden = np.isin(pm['refs'][:, 0], np.array(sorted(deleted), np.int64)) if deleted else np.zeros(len(PP), bool)
    TV0, _ = K.tris(pf)
    hidden |= covered(PP, K.vertex_normals(PP, TV0), [(o[3], o[6]) for o in loaded if not o[1].get('sheer')])
    TV, TT = K.tris(pf, keep=lambda vs, g: not hidden[vs].all())   # skin under clothes goes (or it pokes through when they bend)
    sp = ap(O['skin']); stex = {}
    if os.path.isdir(sp):  # a skin pack folder: its material says which images
        stex = mhmat(os.path.join(sp, [f for f in os.listdir(sp) if f.endswith('.mhmat')][0])); sp = stex['diffuseTexture']
    skin = load(sp, 2048)
    if not O.get('blood'): skin = neutral_skin(skin) * np.array(O['skin_tint'], np.float32)
    skin = sharpen(skin, 0.5)
    skin = weather(skin, PP, TV, TT, puv, 'skin', O, B, G)
    st = {'map': texsave(skin, 'skin')}
    if 'bumpmapTexture' in stex and os.path.exists(stex['bumpmapTexture']):
        nm = bump_to_normal(load(stex['bumpmapTexture'], 2048).mean(-1))
    else:
        nm = skin_normal(skin, 2048)
    fn = f'{tag}_skin_n.webp'; save(nm, f'{out}/{fn}', 92); st['nrm'] = fn
    add('skin', PP, TV, TT, puv, WP, st, 'skin')
    em = (B['eyes'][0][0] + B['eyes'][1][0]) / 2
    Pc, Uc = PP[TV].reshape(-1, 3), puv[TT].reshape(-1, 2)
    reg_masks = {'face': (Pc[:, 1] > em[1] - 0.09) & (Pc[:, 1] < em[1] + 0.04) & (Pc[:, 2] > em[2] - 0.03), 'head': Pc[:, 1] > G['head'][1],
                 'torso': (Pc[:, 1] > G['pelvis'][1] - 0.05) & (Pc[:, 1] < G['chest'][1] + 0.02) & (np.abs(Pc[:, 0]) < 0.17),
                 'legs': (Pc[:, 1] < G['pelvis'][1] - 0.08) & (Pc[:, 1] > 0.08), 'arms': (np.abs(Pc[:, 0]) > 0.2) & (Pc[:, 1] > G['pelvis'][1])}
    rs_ = np.random.default_rng(7)
    regions = {k: [[round(float(Uc[i, 0]), 4), round(1 - float(Uc[i, 1]), 4)] for i in rs_.choice(np.nonzero(m)[0], min(240, int(m.sum())), replace=False)] for k, m in reg_masks.items() if m.any()}

    # eyes: the base mesh's own eyeballs, with an iris texture
    bV, bUV, bfaces = K.read_obj(f'{mh.MHD}/3dobjs/base.obj')
    TV, _ = K.tris(bfaces, keep=lambda vs, g: g in ('helper-l-eye', 'helper-r-eye'))
    # the iris texture holds two eyeballs; project each eye straight from the front onto one of them
    EU = np.zeros((len(Va), 2))
    for c, r in B['eyes']:
        vi = np.unique(TV[np.linalg.norm(Va[TV].mean(1) - c, axis=1) < r * 1.5])
        EU[vi, 0] = 0.293 + (Va[vi, 0] - c[0]) / r * 0.2; EU[vi, 1] = 0.297 + (Va[vi, 1] - c[1]) / r * 0.2
    eye = load(ap(O["eyes"]), 512)
    if O.get('eye_cloud'):  # the turned: irises gone milky
        lum = eye.mean(-1, keepdims=True); eye = np.clip(0.55 + lum * 0.45, 0, 1) * np.array([0.95, 0.93, 0.82])
    add('eyes', Va, TV, TV, EU, Wall, {'map': texsave(eye, 'eyes')}, 'eye')

    for key, kind, size in (('brows', 'brow', 512), ('lashes', 'lash', 256)):
        M, P, W, UV, faces, mt = asset(O[key])
        TV, TT = K.tris(faces)
        tx = load(mt['diffuseTexture'], size, alpha=True)
        add(key, P, TV, TT, UV, W, {'map': texsave(tx, key)}, kind, alpha=0.35, double=True)

    hp, hcol = O['hair']
    M, P, W, UV, faces, mt = asset(hp)
    TV, TT = K.tris(faces)
    tx = load(mt['diffuseTexture'], 2048, alpha=True)
    tx = sharpen(tx, 0.4)
    if hcol is not None:
        lum = tx[..., :3].mean(-1, keepdims=True); tx[..., :3] = np.clip(lum / max(lum[tx[..., 3] > 0.5].mean(), 1e-3) * np.array(hcol), 0, 1)
    add('hair', P, TV, TT, UV, W, {'map': texsave(tx, 'hair')}, 'hair', alpha=0.45, double=True)

    for path, recol, M, P, W, UV, TV, TT, mt in loaded:
        name = os.path.basename(path).replace('.mhclo', '')
        size = 512 if ('shoes' in name or 'boots' in name or 'flats' in name) else 2048
        tx = load(mt['diffuseTexture'], size, alpha=True)
        has_a = bool((tx[..., 3] < 0.5).mean() > 0.01 and (tx[..., 3] > 0.5).mean() > 0.2)
        if not has_a: tx = tx[..., :3]
        if 'all' in recol: tx = recolour(tx, recol['all'])
        tx = sharpen(tx, 0.6)
        if 'aomapTexture' in mt and os.path.exists(mt['aomapTexture']):
            ao = load(mt['aomapTexture'], size).mean(-1, keepdims=True); tx = tx * (0.35 + 0.65 * ao)
        if 'top' in recol:  # the upper garment recoloured, its shading and folds kept
            cy = (P[TV].mean(1))[:, 1]
            msk = uv_mask(size, UV, TT, cy > G['pelvis'][1] + 0.03)
            lum = tx.mean(-1, keepdims=True)
            ls = ndimage.median_filter(lum[..., 0], 31)[..., None]          # print and logos out, the folds' shading kept
            lum = np.where(np.abs(lum - ls) > 0.1, ls, lum); m = lum[msk].mean()
            tx = np.where(msk[..., None], np.clip(lum / m * hexc(recol['top']) * 1.05, 0, 1), tx)
            masks[name] = msk
        tx = weather(tx, P, TV, TT, UV, 'cloth', O, B, G)
        t = {'map': texsave(tx, name)}
        if 'normalmapTexture' in mt and os.path.exists(mt['normalmapTexture']):
            fn = f'{tag}_{name}_n.webp'; save(load(mt['normalmapTexture'], size), f'{out}/{fn}', 92); t['nrm'] = fn
        add(name, P, TV, TT, UV, W, t, 'cloth', alpha=0.5 if has_a else 0.0, double=has_a)
    if style == 'real':  # the dressed high model, for baking down to one low mesh and one texture (bake_lp.py)
        hi = {'joints': G, 's': rig['s'], 'mh_v': B['V'], 'mh_f': B['F'], 'mh_w': mh.game_weights(B, G)}
        names = []
        for i, p in enumerate(parts):
            d = p['d']; key = p['tex']['map'].replace(f'{tag}_', '').replace('.webp', '')
            img = raw[key]
            if p['alpha']:  # behind the strands, the strands' own colour (so a bake that hits a gap still gets hair)
                a = img[..., 3] > 0.5
                if a.any(): img = img.copy(); img[~a, :3] = img[a, :3].mean(0)
            fn = f'{out}/{tag}_hi_{p["name"]}.png'; save(img[..., :3] if img.shape[-1] == 4 else img, fn)
            # which piece of which garment each texel is (two ids for a two-piece outfit: top and bottom)
            ids = np.zeros(img.shape[:2] + (3,), np.float32); ids[:] = ID_COL[2 * i + 1]
            if p['name'] in masks: ids[masks[p['name']]] = ID_COL[2 * i]
            save(ids, f'{out}/{tag}_hi_{p["name"]}_id.png')
            if img.shape[-1] == 4: save(img, f'{out}/{tag}_hi_{p["name"]}_a.png')
            hi.update({f'P{i}': d['P'], 'F%d' % i: d['I'].reshape(-1, 3), f'U{i}': d['U']})
            names.append([p['name'], p['kind'], p['alpha'], 2 * i, 2 * i + 1, p['name'] in masks])
        np.savez(f'{out}/{tag}_hi.npz', names=np.array(json.dumps(names)), n=len(parts), **{k: (np.array(json.dumps(v)) if k == 'joints' else v) for k, v in hi.items()})
    export(parts, out, tag, G, style, regions)


def export(parts, out, tag, joints, style, regions=None):
    meta = {'id': tag, 'bones': BONES, 'joints': joints, 'style': style, 'parts': [], 'regions': regions or {}}
    blob = bytearray()
    for p in parts:
        d = p['d']
        lo, hi = d['P'].min(0), d['P'].max(0)
        q = lambda a, lo, hi: np.round((a - lo) / np.maximum(hi - lo, 1e-9) * 65535).astype(np.uint16)
        swq = np.round(d['SW'] * 255).astype(np.int32); swq[:, 0] += 255 - swq.sum(1)
        arrs = {'pos': q(d['P'], lo, hi), 'nrm': np.round(d['N'] * 127).astype(np.int8), 'uv': q(np.clip(d['U'], 0, 1), 0.0, 1.0),
                'tan': np.round(d['T'] * 127).astype(np.int8), 'si': d['SI'], 'sw': swq.clip(0, 255).astype(np.uint8),
                'idx': d['I'].astype(np.uint16 if len(d['P']) < 65536 else np.uint32)}
        L = {'nv': int(len(d['P'])), 'ni': int(len(d['I'])), 'lo': lo.tolist(), 'hi': hi.tolist(), 'buf': {}}
        for k, a in arrs.items():
            while len(blob) % 4: blob.append(0)
            L['buf'][k] = [len(blob), str(a.dtype), int(a.size)]
            blob += a.tobytes()
        meta['parts'].append({'name': p['name'], 'kind': p['kind'], 'alpha': p['alpha'], 'double': p['double'], 'tex': p['tex'], 'lods': [L]})
    open(f'{out}/{tag}.mesh.bin', 'wb').write(bytes(blob))
    json.dump(meta, open(f'{out}/{tag}.mesh.json', 'w'))
    print(tag, 'parts', len(parts), 'tris', sum(p['lods'][0]['ni'] // 3 for p in meta['parts']), 'bin', len(blob) // 1024, 'KB')


if __name__ == '__main__':
    cid, rigs, out, style = sys.argv[1], json.load(open(sys.argv[2])), sys.argv[3], sys.argv[4]
    build(cid, rigs[OUTFITS[cid].get('look', cid)], out, style)
