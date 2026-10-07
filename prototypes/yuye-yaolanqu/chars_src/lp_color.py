"""The baked texture of a light character, finished like a hand-painted one: photo noise taken out of the cloth (folds
kept), skin smoothed into soft planes, a gentle top light and the occlusion painted in, colours graded down to the
game's palette, the brows and lash line painted onto the face from the high model's cards.

Two finishes:  frost  the photo textures kept, graded dark and grey with soot (a Frostpunk-like realism)
               illus  no photo at all: each garment one painted colour, light laid on in soft bands, ink in the creases
                      and along the edges of things, simple painted features (an illustrated look)
usage: python lp_color.py <tag> <work dir> <frost|illus> [infected] [out tag]   (after bake_lp.py)  ->  <out>_{albedo,nrm,mr}.webp + mesh"""
import sys, json
import numpy as np
from PIL import Image
from scipy import ndimage
from build_real import kuwahara
from color import dilate
from build_real import ID_COL, OUTFITS, hexc


def img(path, mode='RGB'):
    return np.asarray(Image.open(path).convert(mode), np.float32) / 255.0


def lin(c): return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
def srgb(c): c = np.clip(c, 0, 1); return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def mblur(a, sig, m):
    """blur inside the islands only (the empty texture between them must not bleed into their edges)"""
    w = ndimage.gaussian_filter(m.astype(np.float32), sig)
    if a.ndim == 3:
        return np.stack([ndimage.gaussian_filter(a[..., c] * m, sig) for c in range(a.shape[-1])], -1) / np.maximum(w, 1e-4)[..., None]
    return ndimage.gaussian_filter(a * m, sig) / np.maximum(w, 1e-4)


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)


def run(tag, work, style='frost', infected=False, outtag=None):
    outtag = outtag or tag + '_lp'
    col = img(f'{work}/{tag}_lp_col.png')
    ao = img(f'{work}/{tag}_lp_ao.png', 'L')
    wn = img(f'{work}/{tag}_lp_wn.png') * 2 - 1
    mask = img(f'{work}/{tag}_lp_mask.png')
    pos = np.load(f'{work}/{tag}_lp_pos.npy')[::-1]           # Blender rows run bottom-up; images top-down
    cov = np.any(np.abs(pos[..., :3]) > 1e-6, axis=-1)
    H, W = cov.shape
    skin, hair, eye = mask[..., 0] > 0.5, mask[..., 1] > 0.5, mask[..., 2] > 0.5
    cloth = cov & ~skin & ~hair & ~eye

    n = wn / np.maximum(np.linalg.norm(wn, axis=-1, keepdims=True), 1e-6)
    key = np.array([-0.35, 0.75, 0.55]); key /= np.linalg.norm(key)
    light = 0.82 + 0.16 * n[..., 1] + 0.1 * np.clip((n * key).sum(-1), -1, 1)
    d = np.load(f'{work}/{tag}_hi.npz'); names = json.loads(str(d['names']))
    rs = np.random.default_rng(5)
    if style == 'frost':
        # simplify: cloth and hair lose the photo grain, skin goes smooth
        k = kuwahara(col, 3)
        smooth = mblur(col, 2.0, cov)
        detail = col - mblur(col, 8.0, cov)
        out = np.where(skin[..., None], np.clip(smooth + detail * 0.3, 0, 1), np.where(cloth[..., None] | hair[..., None], col * 0.35 + k * 0.65, col))
        occ = np.where(skin, 0.55 + 0.45 * ao, np.where(eye, 1.0, 0.3 + 0.7 * ao))
        o = lin(out) * (light * occ)[..., None]
        g = o.mean(-1, keepdims=True)
        o = np.where(cloth[..., None], g + (o - g) * 0.62, np.where(skin[..., None], g + (o - g) * 0.82, g + (o - g) * 0.8))
        # soot and wet grime: heavier low down and in the creases
        y = pos[..., 1]; grime = np.clip(ndimage.gaussian_filter(rs.standard_normal(cov.shape), 6) * 4 + 0.3, 0, 1)
        dirt = np.clip((0.9 - y) / 0.9, 0, 1) * 0.5 + (1 - ao) * 0.4
        o = o * (1 - np.where(cloth | hair, 0.45, 0.15) * np.clip(dirt * grime, 0, 0.8))[..., None]
        lum = o.mean(-1, keepdims=True); t = np.clip(lum * 3.0, 0, 1)
        o = o * (np.array([0.78, 0.84, 1.0]) * (1 - t) + np.array([1.05, 0.99, 0.9]) * t) * 0.8
    else:
        # each piece of clothing one colour (the photo only tells which colour), shaded in soft bands
        idm = np.asarray(Image.open(f'{work}/{tag}_lp_id.png').convert('RGB'), np.float32) / 255.0
        pal = np.array(ID_COL)
        ids = np.argmin(((idm[..., None, :] - pal[None, None]) ** 2).sum(-1), -1)
        base = np.zeros_like(col)
        look_cols = {}
        for nm, kind, alpha, ia, ib, split in names:
            for idv in ((ia, ib) if split else (ib,)):
                m = cov & (ids == idv)
                if m.sum() < 20: continue
                c = np.median(col[m], 0)
                if kind == 'skin': c = c * 0.96
                if kind == 'hair': c = np.median(col[m & (col.mean(-1) < np.percentile(col[m].mean(-1), 60))], 0)
                base[m] = c
        broad = mblur(col, 14, cov)   # the big variations (fades, wear) only
        bm = mblur(base, 14, cov)
        base = np.clip(base * (1 + 0.35 * (broad.mean(-1, keepdims=True) - bm.mean(-1, keepdims=True)) / np.maximum(bm.mean(-1, keepdims=True), 0.05)), 0, 1)
        occ = np.where(skin, 0.6 + 0.4 * ao, 0.35 + 0.65 * ao)
        L = light * occ
        band = 0.66 + 0.2 * smoothstep(0.62, 0.7, L) + 0.14 * smoothstep(0.86, 0.93, L)   # shadow, middle tone, light
        o = lin(base) * band[..., None]
        shadow = np.clip(1 - band, 0, 1)[..., None]
        o = o * (1 - shadow * 0.6) + o * np.array([0.72, 0.78, 1.0]) * shadow * 0.6       # shadows go cool
        o = o * np.where(band[..., None] > 0.95, np.array([1.04, 1.0, 0.95]), 1.0)          # lights warm
        # hair keeps its big strands, simplified
        hk = kuwahara(col, 5); hl = hk.mean(-1) / np.maximum(base.mean(-1), 0.05)
        o = np.where(hair[..., None], o * np.clip(0.7 + 0.45 * hl, 0.55, 1.35)[..., None], o)
        # ink: creases (from the bent normals) and the edges where one thing meets another
        tn = img(f'{work}/{tag}_lp_nrm.png') * 2 - 1
        crease = np.clip((np.abs(ndimage.sobel(tn[..., 0], 1)) + np.abs(ndimage.sobel(tn[..., 1], 0))) * 0.9 - 0.25, 0, 0.5) * ~skin * ndimage.binary_erosion(cov, iterations=3)
        edge = np.zeros(cov.shape, bool); inner = ndimage.binary_erosion(cov, iterations=2)
        for ax in (0, 1):
            for sh in (1, -1):   # neighbours that really touch on the body (not across a seam in the texture)
                near = np.linalg.norm(np.roll(pos[..., :3], sh, ax) - pos[..., :3], axis=-1) < 0.006
                edge |= (np.roll(ids, sh, ax) != ids) & np.roll(inner, sh, ax) & inner & near
        edge = ndimage.binary_dilation(edge) & cov
        o = o * (1 - np.clip(crease + edge * 0.35, 0, 0.6))[..., None]
        # the face: warm cheeks, lips from where the photo had them, eyes painted
        heady = pos[..., 1]
        J = json.loads(str(d['joints']))
        face = skin & (heady > J['head'][1] + 0.05) & (pos[..., 2] > 0.06)
        red = col[..., 0] - col[..., 1]
        lips = face & (red > np.percentile(red[face], 93)) & (heady < np.percentile(heady[face], 40))
        lips = ndimage.binary_opening(lips, iterations=1)
        lipm = ndimage.gaussian_filter(lips.astype(np.float32), 1.2)
        o = o * (1 - lipm[..., None] * 0.35) + lin(np.array([0.62, 0.3, 0.3])) * lipm[..., None] * 0.35
        if eye.any():
            ep = pos[eye][:, :3]; ec = []
            for sx in (1, -1):
                q = ep[ep[:, 0] * sx > 0]
                if len(q): ec.append(q[np.argmax(q[:, 2])])
            o[eye] = lin(np.array([0.82, 0.78, 0.72]))
            for c in ec:
                dd = np.linalg.norm(pos[..., :3] - c, axis=-1)
                o[eye & (dd < 0.0058)] = lin(np.array([0.24, 0.14, 0.08]) if not infected else np.array([0.85, 0.82, 0.62]))
                o[eye & (dd < 0.0026)] = lin(np.array([0.03, 0.02, 0.02]) if not infected else np.array([0.9, 0.88, 0.7]))

    # 4. the brows and the lash line, painted from the high model's cards
    head = cov & (pos[..., 1] > float(json.loads(str(d['joints']))['head'][1]))
    P = pos[head][:, :3].astype(np.float64)
    import igl
    for i, (nm, kind, alpha, *_) in enumerate(names):
        if kind not in ('brow', 'lash'): continue
        V, F, U = d[f'P{i}'].astype(np.float64), d[f'F{i}'].astype(np.int64), d[f'U{i}']
        tx = img(f'{work}/{tag}_hi_{nm}_a.png', 'RGBA')
        d2, fi, C = igl.point_mesh_squared_distance(P, V, F)
        tri = V[F[fi]]
        v0, v1, v2 = tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0], C - tri[:, 0]
        d00, d01, d11 = (v0 * v0).sum(1), (v0 * v1).sum(1), (v1 * v1).sum(1); d20, d21 = (v2 * v0).sum(1), (v2 * v1).sum(1)
        den = np.maximum(d00 * d11 - d01 * d01, 1e-12); b1 = (d11 * d20 - d01 * d21) / den; b2 = (d00 * d21 - d01 * d20) / den; b0 = 1 - b1 - b2
        uv = U[F[fi, 0]] * b0[:, None] + U[F[fi, 1]] * b1[:, None] + U[F[fi, 2]] * b2[:, None]
        px = np.clip((uv[:, 0] * tx.shape[1]).astype(int), 0, tx.shape[1] - 1); py = np.clip(((1 - uv[:, 1]) * tx.shape[0]).astype(int), 0, tx.shape[0] - 1)
        tol = 0.0045 if kind == 'brow' else 0.0025
        a = tx[py, px, 3] * np.clip(1 - (np.sqrt(d2) - tol) / 0.0015, 0, 1)
        full = np.zeros(cov.shape, np.float32); full[head] = a
        full = ndimage.grey_dilation(full, size=(3, 3) if kind == 'brow' else (2, 2))  # thin hairs thickened into a drawn stroke
        full = mblur(full, 1.0 if kind == 'brow' else 0.7, cov)
        full = smoothstep(0.08, 0.38, full) * (0.8 if kind == 'brow' else 0.7)
        a = full[head]
        ink = lin(np.array([0.09, 0.065, 0.05]) if kind == 'lash' else np.median(tx[tx[..., 3] > 0.5][:, :3], 0) * 0.55)
        sub = o[head]; sub = sub * (1 - a[:, None]) + ink * a[:, None]; o[head] = sub

    # 5. out: albedo, gentler normals (the shapes are in the colour now), roughness / skin / glow
    alb = srgb(o)
    nrm = img(f'{work}/{tag}_lp_nrm.png'); nrm = (nrm - 0.5) * (np.array([0.6, 0.6, 1.0]) if style == 'frost' else np.array([0.25, 0.25, 1.0])) + 0.5
    rough = np.where(skin, 0.66 if style == 'frost' else 0.8, np.where(hair, 0.55 if style == 'frost' else 0.7, np.where(eye, 0.2, 0.92)))
    mr = np.stack([skin.astype(np.float32), rough, (eye & bool(infected)).astype(np.float32)], -1)
    alb, nrm, mr = dilate(alb, cov), dilate(nrm, cov), dilate(mr, cov)
    Image.fromarray((alb * 255).astype(np.uint8)).save(f'{work}/{outtag}_albedo.webp', quality=90, method=6)
    Image.fromarray((nrm * 255).astype(np.uint8)).save(f'{work}/{outtag}_nrm.webp', quality=92, method=6)
    Image.fromarray((mr * 255).astype(np.uint8)).resize((W // 2, H // 2), Image.BILINEAR).save(f'{work}/{outtag}_mr.webp', quality=90, method=6)
    # where wounds can be painted
    import shutil
    shutil.copy(f'{work}/{tag}_lp.mesh.bin', f'{work}/{outtag}.mesh.bin')
    meta = json.load(open(f'{work}/{tag}_lp.mesh.json')); meta_p = f'{work}/{outtag}.mesh.json'; J = meta['joints']
    ys, xs = np.nonzero(cov); Pp = pos[cov][:, :3]
    sk, hr = skin[cov], hair[cov]
    regions = {'face': sk & (Pp[:, 1] > J['head'][1] + 0.05) & (Pp[:, 2] > 0.04), 'head': (sk | hr) & (Pp[:, 1] > J['head'][1]),
               'torso': (Pp[:, 1] > J['pelvis'][1] - 0.05) & (Pp[:, 1] < J['chest'][1] + 0.02) & (np.abs(Pp[:, 0]) < 0.18) & ~hr,
               'legs': (Pp[:, 1] < J['pelvis'][1] - 0.08) & (Pp[:, 1] > 0.08), 'arms': (np.abs(Pp[:, 0]) > 0.22) & (Pp[:, 1] > J['pelvis'][1])}
    rs = np.random.default_rng(7); reg = {}
    for kk, m in regions.items():
        ii = np.nonzero(m)[0]
        if len(ii): reg[kk] = [[round((xs[i] + 0.5) / W, 4), round((ys[i] + 0.5) / H, 4)] for i in rs.choice(ii, min(320, len(ii)), replace=False)]
    meta['regions'] = reg; meta['tex'] = W; json.dump(meta, open(meta_p, 'w'))
    print(tag, 'painted', int(cov.sum()), 'texels; skin', int(skin.sum()), 'hair', int(hair.sum()))


if __name__ == '__main__':
    a = sys.argv
    run(a[1], a[2], a[3], len(a) > 4 and a[4] == 'infected', a[5] if len(a) > 5 else None)
