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
BONES = mh.GAME_BONES

# what each sample wears: asset folders, and how to recolour them
OUTFITS = {
    'mei': {'proxy': 'proxymeshes/female_generic/female_generic.proxy', 'skin': 'skins/young_lightskinned_female_diffuse3.png', 'skin_tint': (1.0, 0.95, 0.84),
            'eyes': 'eyes/brownlight_eye.png', 'brows': 'eyebrows/eyebrow010/eyebrow010.mhclo', 'lashes': 'eyelashes/eyelashes02/eyelashes02.mhclo',
            'hair': ('hair/ponytail01/ponytail01.mhclo', (0.16, 0.11, 0.08)),
            'clothes': [('clothes/female_casualsuit01/female_casualsuit01.mhclo', {'top': '#6e7f84'}), ('clothes/shoes03/shoes03.mhclo', {})]},
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
        if len(p) >= 2 and p[0] in ('diffuseTexture', 'normalmapTexture', 'aomapTexture'):
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
        M = K.read_map(f'{A}/{path}')
        d = os.path.dirname(f'{A}/{path}')
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
        loaded.append((path, recol, M, P, W, UV, faces, mt))

    # the body: a lighter mesh than the base, skin where nothing covers it
    pm = K.read_map(f'{A}/{O["proxy"]}')
    pd = os.path.dirname(f'{A}/{O["proxy"]}')
    _, puv, pf = K.read_obj(f'{pd}/{pm["obj"]}')
    PP = K.fit_map(pm, Va); WP = (Wall[pm['refs']] * pm['w'][:, :, None]).sum(1)
    hidden = np.isin(pm['refs'][:, 0], np.array(sorted(deleted), np.int64)) if deleted else np.zeros(len(PP), bool)
    TV, TT = K.tris(pf, keep=lambda vs, g: not hidden[vs].all())
    skin = load(f'{A}/{O["skin"]}', 2048)
    g = skin.mean(-1, keepdims=True); skin = (g + (skin - g) * 0.8) * np.array(O['skin_tint'], np.float32)   # a little less pink, a little more olive
    add('skin', PP, TV, TT, puv, WP, {'map': texsave(skin, 'skin')}, 'skin')

    # eyes: the base mesh's own eyeballs, with an iris texture
    bV, bUV, bfaces = K.read_obj(f'{mh.MHD}/3dobjs/base.obj')
    TV, _ = K.tris(bfaces, keep=lambda vs, g: g in ('helper-l-eye', 'helper-r-eye'))
    # the iris texture holds two eyeballs; project each eye straight from the front onto one of them
    EU = np.zeros((len(Va), 2))
    for c, r in B['eyes']:
        vi = np.unique(TV[np.linalg.norm(Va[TV].mean(1) - c, axis=1) < r * 1.5])
        EU[vi, 0] = 0.293 + (Va[vi, 0] - c[0]) / r * 0.2; EU[vi, 1] = 0.297 + (Va[vi, 1] - c[1]) / r * 0.2
    eye = load(f'{A}/{O["eyes"]}', 512)
    add('eyes', Va, TV, TV, EU, Wall, {'map': texsave(eye, 'eyes')}, 'eye')

    for key, kind, size in (('brows', 'brow', 512), ('lashes', 'lash', 256)):
        M, P, W, UV, faces, mt = asset(O[key])
        TV, TT = K.tris(faces)
        tx = load(mt['diffuseTexture'], size, alpha=True)
        add(key, P, TV, TT, UV, W, {'map': texsave(tx, key)}, kind, alpha=0.35, double=True)

    hp, hcol = O['hair']
    M, P, W, UV, faces, mt = asset(hp)
    TV, TT = K.tris(faces)
    tx = load(mt['diffuseTexture'], 1024, alpha=True)
    lum = tx[..., :3].mean(-1, keepdims=True); tx[..., :3] = np.clip(lum / max(lum[tx[..., 3] > 0.5].mean(), 1e-3) * np.array(hcol), 0, 1)
    add('hair', P, TV, TT, UV, W, {'map': texsave(tx, 'hair')}, 'hair', alpha=0.45, double=True)

    for path, recol, M, P, W, UV, faces, mt in loaded:
        name = os.path.basename(path).replace('.mhclo', '')
        TV, TT = K.tris(faces)
        size = 512 if 'shoes' in name else 1024
        tx = load(mt['diffuseTexture'], size)
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
        t = {'map': texsave(tx, name)}
        if 'normalmapTexture' in mt and os.path.exists(mt['normalmapTexture']):
            fn = f'{tag}_{name}_n.webp'; save(load(mt['normalmapTexture'], size), f'{out}/{fn}', 92); t['nrm'] = fn
        add(name, P, TV, TT, UV, W, t, 'cloth')
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
    export(parts, out, tag, G, style)


def export(parts, out, tag, joints, style):
    meta = {'id': tag, 'bones': BONES, 'joints': joints, 'style': style, 'parts': []}
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
    build(cid, rigs[cid], out, style)
