"""Colour pass: every texel of the low-poly UV layout knows where it sits on the body (the baked position map), so its
colour is worked out there, at full texture resolution: which layer it is (skin, cloth, leather, hair...), the face's
features, cloth weave and wear, mud, blood. Ambient occlusion darkens the creases.

Outputs (all at the bake size):  <id>_albedo.webp   colour
                                 <id>_mr.webp       R skin (for paling with blood loss), G roughness (where three.js reads it), B glow (infected eyes)
                                 <id>_nrm.webp      the baked normals, re-encoded
usage: python color.py <id> <rigs.json> <work dir>
"""
import sys, json
import numpy as np
from PIL import Image
from scipy import ndimage
import sdf
from body import Char, NL, NLT, L_SKIN, L_TOP, L_BOTTOM, L_COAT, L_SHOES, L_HAIR, L_HAT, L_ACC, L_EYE, L_SCARF, L_SKIRT, L_DETAIL, L_LEGS, L_APRON, L_VEST, L_PACK, L_GEAR


def hexc(h):
    h = h.lstrip('#'); return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.float32) / 255.0


def lin(c):  # sRGB -> linear for mixing, and back
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def srgb(c):
    c = np.clip(c, 0, 1); return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def mixc(a, b, t):
    return a + (b - a) * np.asarray(t)[..., None] if np.ndim(t) else a + (b - a) * t


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)


def run(cid, rigs, work):
    rig = rigs[cid]
    ch = Char(cid, rig); ch.build(); A = ch.P.array(); L = ch.look; s = ch.s
    pos = np.load(f'{work}/{cid}_pos.npy')               # (H, W, 4), rows bottom-up as Blender stores them
    H, W = pos.shape[:2]
    cov = np.any(np.abs(pos[..., :3]) > 1e-6, axis=-1)  # texels no island covers stay at the origin
    P = pos[cov][:, :3].astype(np.float64)
    n = len(P)
    D = sdf.layers_at(A, ch.P.GV, NLT, P)[:, :NL]                           # (n, NL)
    lay = np.argmin(np.where(D < 0, -D * 0.5, D), axis=1)  # the surface a texel lies on: nearest layer, inside counts less
    noise = lambda f, sy=1.0, off=0.0: sdf.fbm_at(P + off, f, sy)
    col = np.zeros((n, 3), np.float32); rough = np.full(n, 0.85, np.float32); skinm = np.zeros(n, np.float32); glow = np.zeros(n, np.float32)
    infected = bool(L.get('infected'))
    hc = ch.hc; q = (P - hc) / s                          # head-local, body metres

    mhm = None
    if hasattr(ch, 'mhB'):
        import mh
        mhm = mh.face_marks(ch.mhB)

    def tagd(tag):
        if mhm is not None:
            d = mh.tag_distance(ch.mhB, mhm, P, tag, s)
            if d is not None: return d
        idx = np.array(ch.P.tags.get(tag, []), np.int64)
        if len(idx) == 0: return np.full(n, 9.0, np.float32)
        return sdf.prims_at(A, idx, P).min(axis=1)

    # ---------- skin ----------
    skin = hexc(L.get('skin', '#c99a78'))
    if infected: skin = skin + (hexc('#8a9688') - skin) * 0.55
    elif L.get('pale'): skin = skin + (hexc('#bdb6af') - skin) * L['pale'] * 0.6
    sk = lin(skin)[None, :].repeat(n, 0)
    var = noise(9.0); var2 = noise(45.0, 1.0, 3.3)
    sk *= (1 + 0.07 * var[:, None] + 0.04 * var2[:, None])
    red = lin(hexc('#b8574a'))
    fx, fy, fz = q[:, 0], q[:, 1], q[:, 2]
    face = (fz > 0.03) & (np.abs(fy) < 0.12)
    cheek = np.exp(-(((np.abs(fx) - 0.042) / 0.022) ** 2 + ((fy + 0.022) / 0.02) ** 2)) * face
    nose = np.clip(1 - tagd('nose') / (0.006 * s), 0, 1)
    ear = np.clip(1 - tagd('ear') / (0.004 * s), 0, 1)
    flush = cheek * (0.22 if ch.fem and not infected else 0.12) + nose * 0.12 + ear * 0.15
    sk = mixc(sk, sk * 0.6 + red * 0.4, flush)
    # eye sockets a little darker, the brow line, lids and lashes
    lidu = tagd('lidU'); lidl = tagd('lidL')
    sock = np.exp(-(((np.abs(fx) - 0.031) / 0.024) ** 2 + ((fy - 0.004) / 0.016) ** 2)) * face
    sk *= (1 - 0.18 * sock)[:, None] if not infected else (1 - 0.42 * sock)[:, None]
    hair_c = lin(hexc(L.get('hair', '#22170f')))
    bx = np.abs(fx)
    brow_y = 0.025 + 0.006 * np.sin(np.clip((bx - 0.012) / 0.04, 0, 1) * np.pi) * (1.4 if ch.fem else 1.0) - (bx - 0.03) * 0.08
    bw = (0.0042 if ch.fem else 0.0062) * (1 - 0.5 * smoothstep(0.03, 0.052, bx))
    brow = (1 - smoothstep(bw * 0.55, bw, np.abs(fy - brow_y))) * smoothstep(0.007, 0.012, bx) * (1 - smoothstep(0.048, 0.056, bx)) * face * (fz > 0.06)
    brow = brow * (0.7 + 0.3 * np.clip(noise(420.0, 0.25) + 0.5, 0, 1))  # hairs, not a painted bar
    sk = mixc(sk, hair_c * 1.15, brow * 0.85)
    lash = (lidu < 0.0016 * s) & (fy < 0.0125 + 0.003) & (fy > 0.004) & (fz > 0.075)          # the lash line under the upper lid
    if ch.fem: lash |= (lidu < 0.0024 * s) & (fy > 0.006) & (fy < 0.016) & (bx > 0.04) & (fz > 0.07)  # a little liner, winged
    sk = mixc(sk, lin(hexc('#1a110d')), lash * 0.85)
    # lips
    lips = np.clip(1 - np.minimum(tagd('lipU'), tagd('lipL')) / (0.0018 * s), 0, 1)
    lipc = lin(hexc(L.get('lip', '#b4555a') if ch.fem else '#9a5a50'))
    if infected: lipc = lin(hexc('#5a3a40'))
    sk = mixc(sk, lipc, lips * (0.85 if ch.fem else 0.55))
    mouth = np.clip(1 - tagd('mouth') / (0.0012 * s), 0, 1)
    sk = mixc(sk, lin(hexc('#1a0606')), mouth)
    # stubble on the men who have it; blush on the women
    if L.get('stubble') or (not ch.fem and cid in ('you', 'zhou', 'butcher', 'fireman', 'worker', 'chef')):
        jaw = ((fy < -0.035) & (fy > -0.125) & (fz > -0.03) | ((np.abs(fy + 0.048) < 0.006) & (bx < 0.02))) & (bx < 0.075) & (lips < 0.3)
        sk = mixc(sk, sk * 0.62, jaw * (0.35 + 0.35 * (noise(600.0) > 0)))
    if infected:  # veins gone dark under grey skin, round the neck, temples and hands
        vn = np.abs(noise(70.0, 1.0, 7.7))
        veins = (vn < 0.035) * (1 - smoothstep(0.0, 0.035, vn))
        where = np.exp(-((fy + 0.12) / 0.09) ** 2) + np.exp(-(((bx - 0.065) / 0.02) ** 2 + ((fy - 0.02) / 0.04) ** 2)) + (tagd('hand') < 0.003) * 1.0
        sk = mixc(sk, lin(hexc('#3a2040')), np.clip(veins * where, 0, 1) * 0.7)
        sk = mixc(sk, lin(hexc('#5a3a3a')), np.clip(noise(6.0, 1.0, 5.1) * 0.8, 0, 1) * 0.35)  # mottling
    m = lay == L_SKIN
    col[m] = sk[m]; rough[m] = 0.55 - lips[m] * 0.15; skinm[m] = 1.0

    # ---------- eyes ----------
    m = lay == L_EYE
    if m.any():
        eyes = [(c_, r_) for c_, r_ in ch.eyes] if hasattr(ch, 'eyes') else [(hc + np.array([sx * 0.031 * (0.94 if ch.fem else 1), 0.006, 0.079 * (0.94 if ch.fem else 1)]) * s, 0.0124 * s) for sx in (-1, 1)]
        iris_a, pupil_a = (0.5, 0.18) if hasattr(ch, 'eyes') else (0.34, 0.13)
        for c, er in eyes:
            d = P - c; r = np.linalg.norm(d, axis=1) + 1e-9; ang = np.arccos(np.clip(d[:, 2] / r, -1, 1))
            mm = m & (r < er * 1.3)
            iris_c = lin(hexc(['#3b2414', '#4a3018', '#2c2016', '#5a4428'][ch.P.rows.__len__() % 4]))
            scl = lin(hexc('#d8d0c4' if not infected else '#c9c09a'))
            e = np.clip((iris_a - ang) / 0.03, 0, 1)
            ir = mixc(scl, iris_c * (0.8 + 0.4 * noise(900.0)[:, None]), e)
            if infected:
                ir = mixc(scl, lin(hexc('#e2dcb8')), e)
                glow[mm] = 1.0
            else:
                ir = mixc(ir, lin(hexc('#060404')), (ang < pupil_a) * 1.0)
                ir = mixc(ir, ir * 0.55, np.clip((ang - iris_a + 0.06) / 0.06, 0, 1) * e)  # the darker ring at the iris edge
            col[mm] = ir[mm]; rough[mm] = 0.12

    # ---------- hair ----------
    m = lay == L_HAIR
    if m.any():
        st = noise(260.0, 0.06); st2 = noise(90.0, 0.12, 1.7)
        hc_ = hair_c[None, :] * (1 + 0.35 * st[:, None] + 0.2 * st2[:, None])
        roots = smoothstep(0.0, 0.006, D[:, L_HAIR] * -1)
        col[m] = hc_[m]; rough[m] = 0.42

    # ---------- cloth ----------
    def cloth(layer, hexs, weave=1.0, wear=0.5, dirt=0.4, rgh=0.88, kind='plain'):
        mm = lay == layer
        if not mm.any(): return
        base = lin(hexc(hexs))
        c = base[None, :].repeat(n, 0)
        c *= (1 + 0.09 * noise(18.0, 1.0, 11.0)[:, None])                                  # dye and fading
        if kind == 'denim':
            tw = np.sin((P[:, 0] + P[:, 1]) * 2600) * 0.5 + 0.5; c *= (0.9 + 0.18 * tw[:, None])
        elif kind == 'knit':
            kn = np.sin(P[:, 1] * 1500) * np.sin(P[:, 0] * 900 + P[:, 2] * 900); c *= (0.92 + 0.1 * kn[:, None])
        elif kind == 'leather':
            c *= (0.9 + 0.2 * noise(140.0)[:, None])
        else:
            wv = np.sin(P[:, 0] * 2200 + P[:, 2] * 2200) * np.sin(P[:, 1] * 2200); c *= (1 + 0.05 * weave * wv[:, None])
        c *= (1 + 0.12 * wear * np.clip(noise(55.0, 1.0, 2.2), 0, 1)[:, None])                # rubbed lighter
        low = smoothstep(0.55, 0.0, P[:, 1])                                                 # mud splashed up from the ground
        mud = np.clip(noise(30.0, 0.6, 9.0) + 0.3, 0, 1) * low * dirt
        c = mixc(c, lin(hexc('#2e2418')), mud * 0.8)
        grime = np.clip(noise(12.0, 1.0, 4.4), 0, 1) * 0.25 * dirt
        c *= (1 - grime)[:, None]
        col[mm] = c[mm]; rough[mm] = rgh
    cloth(L_TOP, L.get('top', '#4b5a52'), kind='knit' if cid in ('mother', 'mei') else 'plain', dirt=0.3)
    cloth(L_BOTTOM, L.get('bottom', '#33302c'), kind='denim' if cid in ('barista', 'biker') else 'plain', dirt=0.9)
    cloth(L_COAT, L.get('coat', L.get('top', '#4a4434')), kind='leather' if cid == 'biker' else 'plain', wear=0.8, dirt=0.6, rgh=0.6 if cid == 'biker' else 0.9)
    cloth(L_SKIRT, L.get('skirt', '#3b4656'), dirt=0.5)
    cloth(L_SCARF, L.get('scarf', '#8a6638'), kind='knit', dirt=0.2)
    cloth(L_APRON, L.get('apronCol', '#c9c2b2'), dirt=0.5)
    cloth(L_VEST, L.get('vest', '#e0662a'), dirt=0.5, rgh=0.7)
    cloth(L_PACK, L.get('backpack', '#3b382e'), dirt=0.5, rgh=0.8)
    hat = L.get('helmet') or L.get('cap') or ('#f1f0ea' if L.get('nurseCap') else '#333333')
    cloth(L_HAT, hat, weave=0.3, dirt=0.2, rgh=0.35 if L.get('helmet') else 0.85)
    cloth(L_SHOES, L.get('shoes', '#211a15'), kind='leather', dirt=1.0, rgh=0.45 if L.get('shoeStyle') in ('heels', 'dress') else 0.6)
    m = lay == L_SHOES
    sole = m & (P[:, 1] < 0.018 * s + 0.004)
    col[sole] = lin(hexc('#141210')); rough[sole] = 0.8
    if L.get('legs'):  # tights: the leg shows through
        m = lay == L_LEGS
        t = lin(hexc(L['legs'])); sheer = 0.78 + 0.12 * np.clip(noise(30.0), -1, 1)
        c = sk * (1 - sheer[:, None]) + t[None, :] * sheer[:, None]
        col[m] = c[m]; rough[m] = 0.42
    m = lay == L_DETAIL
    if m.any():
        dt = np.stack([tagd('tie'), tagd('collar'), tagd('lanyard'), tagd('card')], 1); which = np.argmin(dt, 1)
        cols = [lin(hexc(L.get('tie', '#2b3340'))), lin(hexc(L.get('collar', '#e8e6df'))), lin(hexc('#2d4f7a')), lin(hexc('#e8e6df'))]
        for i, c in enumerate(cols): mm = m & (which == i); col[mm] = c; rough[mm] = 0.6
    m = lay == L_GEAR
    if m.any():
        bl = tagd('blade') < 0.002
        col[m & bl] = lin(hexc('#b4b8bc')); rough[m & bl] = 0.25
        col[m & ~bl] = lin(hexc('#2a1d14')); rough[m & ~bl] = 0.8

    # ---------- marks ----------
    if L.get('stripes'):  # reflective tape round the coat, sleeves and trouser legs
        y = P[:, 1]
        bands = np.zeros(n, bool)
        for yy in (ch.J['chest'][1] - 0.12 * s, ch.J['pelvis'][1] + 0.02 * s, ch.J['kneeL'][1] + 0.12 * s, ch.J['ankleL'][1] + 0.12 * s):
            bands |= np.abs(y - yy) < 0.022 * s
        for sh, el, wr in ((ch.J['shL'], ch.J['elL'], ch.J['handL']), (ch.J['shR'], ch.J['elR'], ch.J['handR'])):
            mid = el + (wr - el) * 0.5; ax = (wr - el) / np.linalg.norm(wr - el)
            bands |= (np.abs((P - mid) @ ax) < 0.02 * s) & (np.linalg.norm(P - mid, axis=1) < 0.08 * s)
        mm = bands & np.isin(lay, [L_COAT, L_VEST, L_BOTTOM])
        col[mm] = lin(hexc('#d6d29c')); rough[mm] = 0.3
    if infected or L.get('bloodTorso'):  # where it bit and was bitten: mouth, chin, chest, hands, and what ran down
        bite = [(hc + np.array([0, -0.08, 0.07]) * s, 0.05 * s), (np.array([0.06 * s, ch.J['chest'][1] - 0.02, 0.1 * s]), 0.09 * s),
                (ch.J['handL'] + np.array([0, -0.05 * s, 0]), 0.07 * s), (ch.J['handR'] + np.array([0, -0.05 * s, 0]), 0.07 * s)]
        b = np.zeros(n, np.float32)
        for c, r in bite:
            dd = np.linalg.norm(P - c, axis=1) / r
            b = np.maximum(b, np.clip(1.2 - dd, 0, 1))
        run_ = np.clip(noise(55.0, 0.08, 6.6) * 2 - 0.2, 0, 1) * np.clip(1 - np.abs(P[:, 0] - 0.05 * s) / (0.18 * s), 0, 1) * smoothstep(0.6, 1.4, P[:, 1]) * smoothstep(ch.J['chest'][1] + 0.05, ch.J['chest'][1] - 0.4, P[:, 1])
        sp = np.clip(noise(80.0, 1.0, 12.0) * 1.6 - 0.1, 0, 1)
        amt = np.clip(b * (0.6 + 0.6 * sp) + run_ * 0.8, 0, 1) * (1.0 if infected else 0.6)
        if cid == 'butcher': amt = np.maximum(amt, (lay == L_APRON) * np.clip(noise(25.0, 1.0, 3.0) * 1.2 + 0.4, 0, 1))
        dry = lin(hexc('#3a0606')); wet = lin(hexc('#5a0808'))
        col = mixc(col, mixc(dry[None, :].repeat(n, 0), wet[None, :].repeat(n, 0), sp), amt * 0.92)
        rough = rough * (1 - amt * 0.5)

    # ---------- occlusion, out to textures ----------
    ao = np.asarray(Image.open(f'{work}/{cid}_ao.png').convert('L'), np.float32) / 255.0
    ao = ao[::-1][cov]  # Blender's pixel rows run bottom-up; PNGs top-down
    aok = np.where(np.isin(lay, [L_SKIN, L_EYE]), 0.5, 0.82)  # skin scatters light into its creases; cloth doesn't
    col *= (1 - aok + aok * ao)[:, None]
    alb = np.zeros((H, W, 3), np.float32); alb[cov] = srgb(col)
    mr = np.zeros((H, W, 3), np.float32); mr[cov, 0] = skinm; mr[cov, 1] = rough; mr[cov, 2] = glow
    alb, mr = dilate(alb, cov), dilate(mr, cov)
    Image.fromarray((alb[::-1] * 255).astype(np.uint8)).save(f'{work}/{cid}_albedo.webp', quality=88, method=6)
    Image.fromarray((mr[::-1] * 255).astype(np.uint8)).resize((W // 2, H // 2), Image.BILINEAR).save(f'{work}/{cid}_mr.webp', quality=90, method=6)
    nrm = np.asarray(Image.open(f'{work}/{cid}_nrm.png').convert('RGB'), np.float32) / 255.0
    nrm = dilate(nrm[::-1].copy(), cov)
    Image.fromarray((nrm[::-1] * 255).astype(np.uint8)).save(f'{work}/{cid}_nrm.webp', quality=92, method=6)
    # where a hit can land, for painting wounds onto the right part of the texture: a few hundred texels per region
    ys, xs = np.nonzero(cov)
    py_, pel, chy = P[:, 1], ch.J['pelvis'][1], ch.J['chest'][1]
    regions = {
        'face': (lay == L_SKIN) & (q[:, 2] > 0.03) & (np.abs(q[:, 1]) < 0.1) & (np.abs(q[:, 0]) < 0.06),
        'head': np.isin(lay, [L_SKIN, L_HAIR, L_HAT]) & (P[:, 1] > ch.J['head'][1]),
        'torso': (py_ > pel - 0.05) & (py_ < chy + 0.02) & (np.abs(P[:, 0]) < 0.2 * s) & ~np.isin(lay, [L_HAIR, L_EYE]),
        'legs': (py_ < pel - 0.08) & (py_ > 0.08),
        'arms': (np.abs(P[:, 0]) > 0.24 * s) & (py_ > pel)}
    rs = np.random.default_rng(7); reg = {}
    for k, msk in regions.items():
        ii = np.nonzero(msk)[0]
        if len(ii) == 0: continue
        pick = rs.choice(ii, min(320, len(ii)), replace=False)
        reg[k] = [[round((xs[i] + 0.5) / W, 4), round(1 - (ys[i] + 0.5) / H, 4)] for i in pick]  # canvas u, v (v down)
    mj = f'{work}/{cid}.mesh.json'
    meta = json.load(open(mj)); meta['regions'] = reg; meta['tex'] = W; json.dump(meta, open(mj, 'w'))
    counts = np.bincount(lay, minlength=NL)
    print(cid, 'texels', n, 'layers', {i: int(c) for i, c in enumerate(counts) if c}, flush=True)


def dilate(img, cov, it=10):
    """push colour out past the islands' edges so filtering never pulls in the empty background"""
    img = img.copy(); m = cov.copy()
    for _ in range(it):
        grown = ndimage.binary_dilation(m)
        ring = grown & ~m
        if not ring.any(): break
        acc = np.zeros_like(img); cnt = np.zeros(m.shape, np.float32)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                sh = np.roll(np.roll(m, dy, 0), dx, 1); acc += np.roll(np.roll(img, dy, 0), dx, 1) * sh[..., None]; cnt += sh
        img[ring] = acc[ring] / np.maximum(cnt[ring], 1)[..., None]
        m = grown
    img[~m] = img[m].mean(axis=0)
    return img


if __name__ == '__main__':
    run(sys.argv[1], json.load(open(sys.argv[2])), sys.argv[3])
