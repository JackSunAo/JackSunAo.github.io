"""A character as signed-distance primitives: anatomy built around the game's own bind-pose joints, then clothes,
shoes, hair, hats and gear from the same look the game uses (rigs.json). Layers say what each surface is made of."""
import numpy as np
from sdf import Prims, nrm, v3, UNION, SUB, INTER, HARD, MASKCONE, MASKBOX, CAPCONE

# layers
L_SKIN, L_TOP, L_BOTTOM, L_COAT, L_SHOES, L_HAIR, L_HAT, L_ACC, L_EYE, L_SCARF, L_SKIRT, L_DETAIL, L_LEGS, L_APRON, L_VEST, L_PACK, L_GEAR = range(17)
NL = 17
L_DRAPE, L_DRAPE_LO = 17, 18   # the body smoothed for clothes to hang from: loosely (tops, coats) and closer (trousers)
NLT = 19
LAYER_NAMES = ['skin', 'top', 'bottom', 'coat', 'shoes', 'hair', 'hat', 'acc', 'eye', 'scarf', 'skirt', 'detail', 'legs', 'apron', 'vest', 'pack', 'gear']

X, Y, Z = np.array([1.0, 0, 0]), np.array([0, 1.0, 0]), np.array([0, 0, 1.0])
import os as _os
USE_MH = _os.environ.get('CHAR_BODY', 'mh') == 'mh'   # the scanned-style body; 'sdf' for the hand-built one

# what a few characters wear that the game's flat look doesn't say
OVERRIDES = {
    'fireman': {'coatLen': 'long', 'shoeStyle': 'tall'},
    'doctor': {'coatLen': 'long', 'coatOpen': True},
    'office': {'shoeStyle': 'dress'},
    'student': {'shoeStyle': 'sneakers'},
    'trainer': {'shoeStyle': 'sneakers'},
    'mother': {'shoeStyle': 'flats'},
    'mei': {'shoeStyle': 'flats'},
    'butcher': {'sleeves': 'rolled'},
    'chef': {'sleeves': 'long'},
    'station': {'shoeStyle': 'dress'},
    'clerk': {'coatLen': 'fitted'},
    'biker': {'coatLen': 'short'},
    'police': {'shoeStyle': 'boots'},
    'rider': {'coatLen': 'short'},
}


class Char:
    def __init__(self, cid, rig):
        self.id = cid
        L = dict(rig['look'])
        L.update(OVERRIDES.get(cid, {}))
        self.look = L
        self.J = {k: v3(v) for k, v in rig['joints'].items()}
        self.s = rig['s']
        self.fem = bool(L.get('female'))
        self.g = L.get('girth', 1.0)
        self.P = Prims()
        self.feat = {}

    # ---------------- anatomy ----------------
    def build(self):
        if USE_MH:
            self.mh_body()
        else:
            self.torso(); self.limbs(); self.head(); self.hands()
        self.clothes()
        return self.P

    def mh_body(self):
        """a real body (MakeHuman's, fitted to the game's joints) as distance volumes; the eyes in their sockets"""
        import os, mh
        B = mh.body(self.look, {k: list(v) for k, v in self.J.items()}, self.s)
        self.mhB = B
        work = os.environ.get('WORK', '/tmp/claude-0/cb'); os.makedirs(work, exist_ok=True)
        cache = f'{work}/{self.id}_dg.npz'
        key = np.array([B['V'].sum(), B['V'][:, 1].max()])
        grids = None
        if os.path.exists(cache):
            z = np.load(cache)
            if np.allclose(z['key'], key):
                grids = [(z[f'o{i}'], float(z[f'h{i}']), z[f'd{i}']) for i in range(int(z['n']))]
        if grids is None:
            grids, _ = mh.distance_grids(B, self.s)
            np.savez(cache, key=key, n=len(grids), **{f'o{i}': g[0] for i, g in enumerate(grids)}, **{f'h{i}': g[1] for i, g in enumerate(grids)}, **{f'd{i}': g[2] for i, g in enumerate(grids)})
        for o, h, d in grids:
            self.P.grid(o, h, d)
        # clothes don't follow every hollow and bump: they hang from a smoothed body (the whole-body volume blurred)
        from scipy.ndimage import gaussian_filter
        o, h, d = grids[-1]
        for layer, sig in ((L_DRAPE, 0.02), (L_DRAPE_LO, 0.007)):
            self.P.grid(o, h, gaussian_filter(d, sig / h, mode='nearest'), layer=layer)
        f = 0.94 if self.fem else 1.0
        em = (B['J']['eyeL'] + B['J']['eyeR']) / 2
        self.hc = em - v3([0, 0.006, 0.079 * f]) * self.s   # where the hand-built head had its centre, so hats and hair still fit
        self.eyes = B['eyes']
        for c, r in B['eyes']:
            self.P.ell(c, [r * 1.0] * 3, layer=L_EYE, k=0.0, tag='eye')
        # hair and hats were drawn round the hand-built head: map that head's box onto this one's, axis by axis
        V, s = B['V'], self.s
        hv = V[V[:, 1] > em[1] - 0.01]
        top, back = hv[:, 1].max(), hv[:, 2].min()
        band = hv[np.abs(hv[:, 1] - (em[1] + 0.025)) < 0.012]
        halfw = np.abs(band[:, 0]).max()
        brow = hv[(np.abs(hv[:, 0]) < 0.01) & (np.abs(hv[:, 1] - (em[1] + 0.02)) < 0.006)][:, 2].max()
        sx = halfw / (0.074 * f * s)
        sy = (top - (self.hc[1] + 0.006 * s)) / ((0.025 + 0.09 * f - 0.006) * s)
        sb, sf = (-0.012 - 0.097 * f), 0.088 * f                      # the old head's back and brow, head units
        sz = (brow - back) / ((sf - sb) * s)
        self.Hk = np.array([sx, sy, sz]); self.Hz0 = (brow - sf * sz * s) - self.hc[2]

    def torso(self):
        P, J, s, fem = self.P, self.J, self.s, self.fem
        gw, gd = s * self.g ** 0.75, s * self.g ** 0.9
        pel, ch, hd = J['pelvis'], J['chest'], J['head']
        py, cy = pel[1], ch[1]
        heavy = max(0.0, self.g - 1.2)
        if fem:
            P.ell([0, py - 0.03 * s, -0.008], [0.168 * gw, 0.11 * s, 0.108 * gd], k=0.03)                                # pelvis
            for sx in (-1, 1): P.ell([sx * 0.07 * gw, py - 0.08 * s, -0.06 * gd], [0.074 * gw, 0.088 * s, 0.072 * gd], k=0.035)  # glutes
            P.ell([0, py + 0.08 * s, 0.012 * gd], [0.132 * gw, 0.1 * s, 0.088 * gd], k=0.045)                               # lower belly
            P.ell([0, py + 0.2 * s, 0.0], [0.112 * gw, 0.1 * s, 0.082 * gd], k=0.05)                                         # waist
            P.ell([0, cy - 0.155 * s, -0.008], [0.132 * gw, 0.16 * s, 0.098 * gd], k=0.05)                                   # ribcage
            for sx in (-1, 1):                                                                                                 # breasts
                c = [sx * 0.064 * gw, cy - 0.135 * s, 0.072 * gd]
                P.ell(c, [0.058 * gw, 0.054 * s, 0.05 * gd], k=0.045, up=[0, 1, 0.35], ax=[1, 0, sx * 0.3], tag='breast')
        else:
            P.ell([0, py - 0.035 * s, -0.005], [0.155 * gw, 0.105 * s, 0.105 * gd], k=0.03)
            for sx in (-1, 1): P.ell([sx * 0.068 * gw, py - 0.075 * s, -0.056 * gd], [0.07 * gw, 0.084 * s, 0.068 * gd], k=0.035)
            P.ell([0, py + 0.07 * s, 0.018 * gd], [0.14 * gw, 0.11 * s, 0.095 * gd], k=0.045)
            P.ell([0, py + 0.2 * s, 0.008 * gd], [0.134 * gw, 0.12 * s, 0.095 * gd], k=0.05)
            P.ell([0, cy - 0.16 * s, -0.005], [0.152 * gw, 0.172 * s, 0.108 * gd], k=0.05)
            for sx in (-1, 1):                                                                                                 # pectorals
                P.ell([sx * 0.068 * gw, cy - 0.1 * s, 0.058 * gd], [0.08 * gw, 0.058 * s, 0.03 * gd], k=0.06, up=[sx * 0.25, 1, 0], tag='pec')
        if heavy > 0:                                                                                                          # a heavy man's gut
            P.ell([0, py + 0.14 * s, (0.06 + 0.12 * heavy) * gd], [0.16 * gw, 0.16 * s, (0.11 + 0.08 * heavy) * gd], k=0.06)
        P.ell([0, cy - 0.09 * s, -0.05 * gd], [0.148 * gw, 0.1 * s, 0.07 * gd], k=0.04)                                       # shoulder blades
        for side, sh in ((1, J['shL']), (-1, J['shR'])):
            P.cone([0, cy + 0.075 * s, -0.022 * s], sh + v3([-side * 0.02 * s, 0.022 * s, -0.012 * s]), 0.055 * s, 0.042 * s, k=0.045)  # trapezius
            P.cone([side * 0.02 * s, cy + 0.025 * s, 0.035 * s], sh + v3([0, 0.012 * s, 0.012 * s]), 0.026 * s, 0.032 * s, k=0.03)     # collarbone
        # neck: from the collar up into the skull, a little forward
        P.cone([0, cy + 0.02 * s, -0.008 * s], [0, hd[1] + 0.07 * s, -0.004 * s], (0.056 if not fem else 0.049) * gw, (0.049 if not fem else 0.043) * s, k=0.03, tag='neck')

    def limbs(self):
        P, J, s, fem = self.P, self.J, self.s, self.fem
        gw = s * self.g ** 0.6
        am = 0.86 if fem else 1.0
        for side, sh, el, wr in ((1, J['shL'], J['elL'], J['handL']), (-1, J['shR'], J['elR'], J['handR'])):
            ad = nrm(el - sh)
            out = nrm(np.cross(Z, ad)) * -side  # away from the body, at right angles to the arm
            if np.dot(out, [side, 0, 0]) < 0: out = -out
            P.ell(sh + out * 0.012 * s + ad * 0.03 * s, [0.054 * gw * am, 0.072 * s, 0.054 * gw * am], k=0.035, up=ad, ax=out, tag='delt')
            P.cone(sh, el, 0.049 * gw * am, 0.037 * gw * am, k=0.03)
            P.ell(sh + (el - sh) * 0.48 + Z * 0.012 * s, [0.04 * gw * am, 0.08 * s, 0.038 * gw * am], k=0.03, up=ad, ax=out)   # biceps
            P.ell(sh + (el - sh) * 0.42 - Z * 0.016 * s, [0.04 * gw * am, 0.09 * s, 0.036 * gw * am], k=0.03, up=ad, ax=out)   # triceps
            P.ell(el, [0.036 * gw * am, 0.04 * s, 0.034 * gw * am], k=0.02, up=ad, ax=out)
            fd = nrm(wr - el)
            P.cone(el, wr, 0.041 * gw * am, 0.028 * gw * am, k=0.03, ax=Z, sx=1.0, sz=0.82)
            P.ell(el + (wr - el) * 0.27 + Z * 0.004, [0.041 * gw * am, 0.075 * s, 0.035 * gw * am], k=0.03, up=fd, ax=Z)
        for side, hp, kn, an in ((1, J['hipL'], J['kneeL'], J['ankleL']), (-1, J['hipR'], J['kneeR'], J['ankleR'])):
            td = nrm(kn - hp)
            lw = gw * (1.04 if fem else 1.0)
            P.cone(hp + v3([side * 0.004, 0.02 * s, 0]), kn, 0.088 * lw, 0.054 * lw, k=0.045)
            P.ell(hp + (kn - hp) * 0.42 + Z * 0.026 * s, [0.066 * lw, 0.16 * s, 0.058 * lw], k=0.035, up=td)              # quadriceps
            P.ell(hp + (kn - hp) * 0.46 - Z * 0.028 * s, [0.06 * lw, 0.15 * s, 0.05 * lw], k=0.035, up=td)                # hamstrings
            P.ell(hp + (kn - hp) * 0.25 - X * side * 0.032 * s, [0.05 * lw, 0.1 * s, 0.05 * lw], k=0.035, up=td)          # adductors
            P.ell(kn + Z * 0.012 * s, [0.048 * lw, 0.052 * s, 0.048 * lw], k=0.025)
            sd = nrm(an - kn)
            P.cone(kn, an, 0.05 * lw, 0.032 * lw, k=0.03)
            P.ell(kn + (an - kn) * 0.28 - Z * 0.024 * s, [0.046 * lw, 0.1 * s, 0.042 * lw], k=0.03, up=sd)                # calf
            P.ell(an, [0.034 * lw, 0.034 * s, 0.034 * lw], k=0.02)
            # the bare foot (shoes cover it): heel to toes, flat on the ground
            heel, toe = an + v3([0, -0.022 * s, -0.035 * s]), an + v3([side * 0.012 * s, -0.03 * s, 0.15 * s])
            P.cone(heel, toe, 0.03 * s, 0.026 * s, k=0.02, ax=X, sx=1.25, sz=0.75)
            P.ell(an + v3([side * 0.004 * s, -0.012 * s, 0.05 * s]), [0.036 * s, 0.026 * s, 0.06 * s], k=0.02, up=[0, 1, -0.35])   # instep

    def head(self):
        P, J, s, fem = self.P, self.J, self.s, self.fem
        hc = J['head'] + v3([0, 0.1 * s, 0.012 * s])
        self.hc = hc
        f = 0.94 if fem else 1.0
        H = lambda x, y, z: hc + v3([x, y, z]) * s
        P.ell(H(0, 0.025, -0.012), [0.074 * s * f, 0.09 * s * f, 0.097 * s * f], k=0.03, tag='cranium')
        P.ell(H(0, -0.022, 0.034), [0.056 * s * f, 0.072 * s, 0.062 * s * f], k=0.026)
        jx = 0.05 if fem else 0.055
        for sx in (-1, 1):
            P.cone(H(sx * jx, -0.048, -0.006), H(sx * 0.011, -0.1 * f, 0.068 * f), 0.022 * s * f, 0.015 * s, k=0.026)        # mandible
            P.ell(H(sx * 0.047 * f, -0.012, 0.058 * f), [0.022 * s, 0.016 * s, 0.022 * s], k=0.022)                        # cheekbone
        P.ell(H(0, -0.098 * f, 0.07 * f), [0.019 * s * f, 0.018 * s, 0.016 * s], k=0.016, tag='chin')
        P.cone(H(-0.045 * f, 0.028, 0.08 * f), H(0.045 * f, 0.028, 0.08 * f), (0.009 if fem else 0.013) * s, (0.009 if fem else 0.013) * s, k=0.022, tag='brow')
        ez = 0.079 * f
        for sx in (-1, 1):
            P.ell(H(sx * 0.031 * f, 0.006, 0.092 * f), [0.02 * s, 0.0135 * s, 0.016 * s], op=SUB, k=0.01)                 # eye socket
            P.ell(H(sx * 0.031 * f, 0.006, ez), [0.0124 * s] * 3, layer=L_EYE, k=0.0, tag='eye')                              # eyeball
            P.ell(H(sx * 0.031 * f, 0.0172, 0.0845 * f), [0.0158 * s, 0.0058 * s, 0.0112 * s], k=0.005, tag='lidU')          # upper lid
            P.ell(H(sx * 0.031 * f, -0.0048, 0.0835 * f), [0.0145 * s, 0.0042 * s, 0.0105 * s], k=0.005, tag='lidL')
        n = 0.86 if fem else 1.0
        P.cone(H(0, 0.006, 0.093 * f), H(0, -0.03 * n, 0.112 * f), 0.0075 * s * n, 0.0102 * s * n, k=0.012, tag='nose')
        P.ell(H(0, -0.033 * n, 0.109 * f), [0.0118 * s * n, 0.0098 * s * n, 0.0108 * s * n], k=0.008, tag='nose')
        for sx in (-1, 1): P.ell(H(sx * 0.0118 * n, -0.0385 * n, 0.1015 * f), [0.0088 * s * n, 0.0078 * s * n, 0.009 * s * n], k=0.006, tag='nose')
        lt = 1.18 if fem else 1.0
        P.ell(H(0, -0.0552, 0.0842 * f), [0.0215 * s, 0.0058 * s * lt, 0.0105 * s * lt], k=0.007, tag='lipU')
        P.ell(H(0, -0.0665, 0.0822 * f), [0.0198 * s, 0.0068 * s * lt, 0.0105 * s * lt], k=0.007, tag='lipL')
        if self.look.get('infected') and self.look.get('jawSlack'):
            P.ell(H(0, -0.064, 0.098 * f), [0.017 * s, 0.011 * s, 0.014 * s], op=SUB, k=0.004, tag='mouth')               # hanging open
        else:
            P.box(H(0, -0.0607, 0.093 * f), [0.0195 * s, 0.001 * s, 0.009 * s], op=SUB, k=0.002, round_=0.0008, tag='mouth')
        for sx in (-1, 1):
            P.ell(H(sx * 0.077 * f, -0.004, -0.006), [0.011 * s, 0.03 * s, 0.019 * s], k=0.006, up=[0, 1, -0.25], ax=[1, 0, sx * 0.3], tag='ear')
            P.ell(H(sx * 0.086 * f, -0.006, -0.002), [0.0068 * s, 0.016 * s, 0.0098 * s], op=SUB, k=0.004)

    def hands(self):
        P, J, s, fem = self.P, self.J, self.s, self.fem
        hm = 0.88 if fem else 1.0
        for side, el, wr in ((1, J['elL'], J['handL']), (-1, J['elR'], J['handR'])):
            ad = nrm(wr - el)
            pn = nrm(np.cross(ad, Z)) * side          # palm faces down and in toward the body
            th = nrm(Z - ad * np.dot(Z, ad))           # thumb side
            q = lambda a, b, c: wr + ad * a * s * hm + th * b * s * hm + pn * c * s * hm
            P.box(q(0.048, 0, 0.002), [0.04 * s * hm, 0.047 * s * hm, 0.0145 * s * hm], k=0.012, up=ad, ax=th, round_=0.011 * s, tag='hand')
            for i, (b, r) in enumerate(((0.027, 0.0092), (0.009, 0.0098), (-0.009, 0.0094), (-0.026, 0.0082))):
                ln = (0.04, 0.045, 0.042, 0.034)[i]
                k0 = q(0.09, b, 0.0)
                k1 = k0 + (ad * 0.75 + pn * 0.66) * ln * 0.55 * s * hm                                               # curled: relaxed grip
                k2 = k1 + (ad * 0.05 + pn * 1.0) * ln * 0.5 * s * hm
                P.cone(k0, k1, r * s * hm, r * 0.92 * s * hm, k=0.007, tag='hand')
                P.cone(k1, k2, r * 0.92 * s * hm, r * 0.8 * s * hm, k=0.006, tag='hand')
            t0 = q(0.022, 0.032, 0.006); t1 = t0 + (ad * 0.55 + th * 0.5 + pn * 0.65) * 0.035 * s * hm; t2 = t1 + (ad * 0.7 + pn * 0.7) * 0.026 * s * hm
            P.cone(t0, t1, 0.0125 * s * hm, 0.0105 * s * hm, k=0.008, tag='hand')
            P.cone(t1, t2, 0.0105 * s * hm, 0.0088 * s * hm, k=0.006, tag='hand')

    # ---------------- clothes ----------------
    def clothes(self):
        L, P, J, s = self.look, self.P, self.J, self.s
        pel, ch = J['pelvis'], J['chest']
        py, cy = pel[1], ch[1]
        gw = s * self.g ** 0.75
        legs_bare = L.get('skirt') is not None
        und = L.get('undress')
        if und in ('underwear', 'nude'):  # caught at night, at home, in a ward: what they had on, or nothing
            if und == 'underwear':
                if self.fem: self.bra(); self.panties()
                else: self.boxers()
            self.hair(L.get('hairStyle', 'short'))
            return
        # top: a shirt, sweater, blouse or a dress's bodice
        sleeves = L.get('sleeves', 'long')
        self.garment_upper(L_TOP, 0.009 if L.get('skirt') else 0.014, sleeves, hem=py - (0.04 if L.get('skirt') else 0.09) * s, folds=0.0012)
        # trousers unless a skirt; tights under a short skirt
        if not legs_bare:
            tight = self.id in ('trainer',) or L.get('bottomStyle') == 'leggings'
            self.garment_lower(L_BOTTOM, 0.003 if tight else 0.0075, top=py + 0.09 * s, folds=0.0006 if tight else 0.0022)
        else:
            if L.get('skirtLen') == 'knee' and L.get('legs'):
                self.garment_lower(L_LEGS, 0.0014, top=py + 0.06 * s, folds=0.0, to_ankle_bottom=True)
            self.skirt(L.get('skirtLen', 'long'))
        if L.get('coat'):
            self.coat(L.get('coatLen', 'jacket'), L.get('coatOpen', True))
        if L.get('vest'):
            self.garment_upper(L_VEST, 0.026, 'none', hem=py - 0.06 * s, folds=0.001, neck_drop=0.05)
        if L.get('apron'):
            self.apron()
        if L.get('topOpen'):  # torn open down the front, the bra under it
            if self.fem: self.bra(L_ACC)
            P.cone([0, cy + 0.04 * s, 0.14 * s], [0.02 * s, py + 0.0 * s, 0.12 * s], 0.075 * s, 0.03 * s, layer=L_TOP, op=SUB, k=0.01, ax=X, sx=1.0, sz=1.6, noise=(0.006, 40, 1.0))
        if L.get('tears'):  # ripped by hands and teeth
            rs = np.random.default_rng(L.get('seed', 1))
            for _ in range(int(L['tears'])):
                lay = rs.choice([L_TOP, L_SKIRT if L.get('skirt') else L_BOTTOM])
                y = rs.uniform(py - 0.3 * s, cy - 0.05 * s) if lay == L_TOP else rs.uniform(J['kneeL'][1], py - 0.05 * s)
                a = rs.uniform(0, 2 * np.pi); r_ = 0.16 * s
                P.ell([np.sin(a) * r_ * 0.8, y, np.cos(a) * r_ * 0.7], [rs.uniform(0.025, 0.05) * s, rs.uniform(0.03, 0.07) * s, 0.05 * s], layer=lay, op=SUB, k=0.006, noise=(0.006, 50, 1.0))
        if L.get('shoeStyle') == 'none' or L.get('barefoot'):
            pass
        elif L.get('oneShoe'):
            self.shoes(L.get('shoeStyle', 'boots'), sides=(1,))
        else:
            self.shoes(L.get('shoeStyle', 'boots'))
        self.hair(L.get('hairStyle', 'short'))
        if L.get('cap'): self.cap()
        if L.get('helmet'): self.helmet()
        if L.get('nurseCap'): P.box(self.H(0, 0.112, 0.03), self.Rk([0.05 * s, 0.016 * s, 0.03 * s]), layer=L_HAT, k=0.004, up=[0, 1, 0.35], round_=0.004 * s)
        if L.get('scarf'): self.scarf()
        if L.get('backpack'): self.backpack()
        if L.get('tie'): self.tie()
        if L.get('collar'): self.collar()
        if L.get('lanyard'): self.lanyard()
        if L.get('cleaverInShoulder') or self.id == 'butcher': self.cleaver()

    def Rk(self, r):
        """radii drawn for the old head, stretched to this one"""
        return list(np.asarray(r, float) * (self.Hk if hasattr(self, 'Hk') else 1.0))

    def H(self, x, y, z):
        if hasattr(self, 'Hk'):  # the real head: the old head's frame stretched onto it (y measured up from the eyes)
            k = self.Hk
            return self.hc + v3([x * k[0], 0.006 + (y - 0.006) * k[1], 0]) * self.s + v3([0, 0, z * k[2] * self.s + self.Hz0])
        return self.hc + v3([x, y, z]) * self.s

    def garment_upper(self, layer, t, sleeves, hem, folds, neck_drop=0.0):
        P, J, s = self.P, self.J, self.s
        cy = J['chest'][1]
        def masks():
            P.cone([0, hem, 0], [0, cy + 0.2 * s, 0], 0.3, 0.3, layer=-1, k=0.0, t=CAPCONE)
            for sh, el, wr in ((J['shL'], J['elL'], J['handL']), (J['shR'], J['elR'], J['handR'])):
                if sleeves == 'none':
                    continue
                end = {'long': wr - nrm(wr - el) * 0.012 * s, 'rolled': el + (wr - el) * 0.35, 'short': sh + (el - sh) * 0.48}[sleeves]
                if sleeves == 'long' or sleeves == 'rolled':
                    P.cone(sh, el, 0.11, 0.11, layer=-1, k=0.0, t=CAPCONE); P.cone(el, end, 0.1, 0.1, layer=-1, k=0.03, t=CAPCONE)
                else:
                    P.cone(sh, end, 0.11, 0.11, layer=-1, k=0.0, t=CAPCONE)
            # neckline: a scoop at the front, higher at the back
            self.neckhole(neck_drop)
            if sleeves == 'none':  # armholes
                for sh in (J['shL'], J['shR']):
                    P.ell(sh + v3([0, -0.03 * s, 0]), [0.075 * s, 0.11 * s, 0.09 * s], layer=-1, op=INTER, k=0.0, tag=None)
        if sleeves == 'none':
            # a vest: torso only, trimmed by plane, armholes carved after (as a separate subtract on the layer)
            def masks2():
                P.cone([0, hem, 0], [0, cy + 0.07 * s, 0], 0.3, 0.3, layer=-1, k=0.0, t=CAPCONE)
                self.neckhole(neck_drop)
            P.garment(layer, t, [masks2], k=0.01, noise=(folds, 30, 0.5), base=L_DRAPE if USE_MH else 0)
            for sh in (J['shL'], J['shR']):
                P.ell(sh + v3([0, -0.035 * s, 0]), [0.07 * s, 0.1 * s, 0.085 * s], layer=layer, op=SUB, k=0.01)
            return
        P.garment(layer, t, [masks], k=0.01, noise=(folds, 36, 0.6), base=L_DRAPE if USE_MH else 0)

    def neckhole(self, drop=0.0):
        """a neckline: a hole round the neck (lower at the front, deeper for a scoop), the shoulders stay covered"""
        P, J, s = self.P, self.J, self.s
        cy = J['chest'][1]; r = (0.064 if not self.fem else 0.058) * s * self.g ** 0.6
        P.capcone([0, cy + 0.03 * s - drop * s, 0.012 * s + drop * 0.6 * s], [0, cy + 0.45 * s, 0.03 * s], r + drop * 0.4 * s, r + 0.01 * s, layer=-1, op=SUB, k=0.008, ax=[1, 0, 0], sx=1.0, sz=1.12)
        P.ell(self.hc + v3([0, -0.005, 0.01]) * s, [0.098 * s, 0.135 * s, 0.125 * s], layer=-1, op=SUB, k=0.01)  # and never over the head

    def garment_lower(self, layer, t, top, folds, to_ankle_bottom=False, end_frac=None):
        P, J, s = self.P, self.J, self.s
        def masks():
            P.cone([0, top, 0], [0, J['pelvis'][1] - 0.14 * s, 0], 0.25, 0.25, layer=-1, k=0.0, t=CAPCONE)
            for hp, kn, an in ((J['hipL'], J['kneeL'], J['ankleL']), (J['hipR'], J['kneeR'], J['ankleR'])):
                if end_frac is not None:  # shorts: down the thigh only
                    P.cone(hp, hp + (kn - hp) * end_frac, 0.13, 0.13, layer=-1, k=0.0, t=CAPCONE)
                    continue
                end = an + v3([0, (-0.03 if to_ankle_bottom else 0.03) * s, 0])
                P.cone(hp, kn, 0.13, 0.13, layer=-1, k=0.0, t=CAPCONE); P.cone(kn, end, 0.11, 0.11, layer=-1, k=0.03, t=CAPCONE)
                if to_ankle_bottom:  # tights cover the foot too
                    P.cone(an, an + v3([0, -0.03 * s, 0.17 * s]), 0.06, 0.06, layer=-1, k=0.0, t=CAPCONE)
            P.plane([0, top, 0], [0, 1, 0], layer=-1, op=INTER, k=0.004)
        P.garment(layer, t, [masks], k=0.008, noise=(folds, 26, 0.35), base=(L_DRAPE_LO if layer != L_LEGS else 0) if USE_MH else 0)

    def skirt(self, length):
        P, J, s = self.P, self.J, self.s
        py = J['pelvis'][1]
        gw = s * self.g ** 0.75
        kn_y = J['kneeL'][1]
        if length == 'knee':
            bot, flare = kn_y + 0.03 * s, -0.01
        else:
            bot, flare = J['ankleL'][1] + 0.06 * s, 0.07
        self.hip_wrap(L_SKIRT, 0.011, py + 0.075 * s, bot, flare, (0.002, 18, 0.25))

    def hip_wrap(self, layer, t, top_y, hem_y, flare, noise):
        """cloth that follows the hips and seat down to the crotch, then hangs as one fall round both legs"""
        P, J, s = self.P, self.J, self.s
        crotch = J['hipL'][1] - 0.075 * s
        def m():
            P.cone([0, top_y, 0], [0, crotch - 0.02 * s, 0], 0.3, 0.3, layer=-1, k=0.0, t=CAPCONE)
            P.plane([0, top_y, 0], [0, 1, 0], layer=-1, op=INTER, k=0.004)
            P.plane([0, crotch - 0.03 * s, 0], [0, -1, 0], layer=-1, op=INTER, k=0.01)
        P.garment(layer, t, [m], k=0.008, noise=noise, base=L_DRAPE if USE_MH else 0)
        if hem_y < crotch - 0.01:
            xm, zf, zb = self.span(crotch + 0.02 * s, hem_y)   # as wide as the hips and thighs really are, all the way down
            hw, hd, cz = xm + t + 0.008, (zf - zb) / 2 * 1.22 + t + 0.004, (zf + zb) / 2
            x0, f0, b0 = self.extent(top_y)                      # from inside the waist down in one smooth fall: no step at the crotch or the waist
            hn = (zf - zb) / 2 + t + 0.004                         # as deep as the hips; the fall below a little deeper, for the thighs' corners
            P.capcone([0, top_y + 0.02 * s, (f0 + b0) / 2], [0, crotch - 0.01 * s, cz], x0 * 0.85, hw * 0.97, layer=layer, k=0.04, ax=X, sx=1.0, sz=hn / hw, noise=noise)
            P.capcone([0, crotch, cz], [0, hem_y, cz - 0.004], hw * 0.97, hw + flare * s, layer=layer, k=0.05, ax=X, sx=1.0, sz=hn * 1.12 / hw, noise=noise)

    def coat(self, length, open_front):
        P, J, s = self.P, self.J, self.s
        py, cy = J['pelvis'][1], J['chest'][1]
        gw = s * self.g ** 0.75
        hem = {'long': J['kneeL'][1] - 0.05 * s, 'jacket': py - 0.07 * s, 'short': py - 0.03 * s, 'fitted': py - 0.06 * s}[length]
        thick = 0.016 if length != 'fitted' else 0.012
        crotch = J['hipL'][1] - 0.075 * s
        self.garment_upper(L_COAT, thick, 'long', hem=max(hem, crotch - 0.02 * s), folds=0.0025, neck_drop=0.0)
        if length != 'short' and hem < crotch - 0.01:  # below the crotch it hangs as one skirt round both legs
            xm, zf, zb = self.span(crotch + 0.02 * s, hem)
            hw, hd, cz = xm + thick + 0.008, (zf - zb) / 2 * 1.22 + thick + 0.004, (zf + zb) / 2
            P.capcone([0, crotch + 0.06 * s, cz], [0, hem, cz - 0.006], hw, hw + (0.05 if length == 'long' else 0.012) * s, layer=L_COAT, k=0.07, ax=X, sx=1.0, sz=hd / hw, noise=(0.0028, 16, 0.25))
        if self.g > 1.2:  # round a belly
            P.ell([0, py + 0.14 * s, (0.08 + 0.1 * (self.g - 1.2)) * s], [0.17 * gw, 0.17 * s, 0.14 * gw], layer=L_COAT, k=0.04)
        # collar standing round the neck
        P.torus([0, cy + 0.045 * s, -0.004], [0, 1, 0.22], 0.068 * gw, 0.019 * s, layer=L_COAT, k=0.01)
        P.ell(self.hc + v3([0, -0.005, 0.01]) * s, [0.098 * s, 0.135 * s, 0.125 * s], layer=L_COAT, op=SUB, k=0.01)  # the collar keeps off the jaw
        if open_front:  # open down the front: what's under it shows in a V
            P.cone([0, cy + 0.06 * s, 0.17 * s], [0, py - 0.02 * s, 0.16 * s], 0.075 * s, 0.014 * s, layer=L_COAT, op=SUB, k=0.004)


    def bust(self):
        """the points of the chest, left and right (from the real body when there is one)"""
        J, s = self.J, self.s
        if hasattr(self, 'mhB'):
            V = self.mhB['V']; out = []
            for sx in (1, -1):
                m = (V[:, 0] * sx > 0.02) & (V[:, 0] * sx < 0.16 * s) & (V[:, 1] > J['pelvis'][1] + 0.15) & (V[:, 1] < J['chest'][1] - 0.02) & (np.abs(V[:, 0]) < 0.2)
                out.append(V[m][np.argmax(V[m][:, 2])])
            return out
        return [v3([sx * 0.064 * s, J['chest'][1] - 0.135 * s, 0.1 * s]) for sx in (1, -1)]

    def bra(self, layer=L_TOP):
        """cups over the breasts, a band under them, straps over the shoulders"""
        P, J, s = self.P, self.J, self.s
        bl, br = self.bust()
        ub = min(bl[1], br[1]) - 0.055 * s
        def m():
            for b in (bl, br):
                P.ell(b + v3([0, 0.008 * s, -0.035 * s]), [0.072 * s, 0.07 * s, 0.07 * s], layer=-1, k=0.0)
            P.cone([0, ub - 0.012 * s, 0], [0, ub + 0.02 * s, 0], 0.19 * s, 0.19 * s, layer=-1, k=0.0, t=CAPCONE)
            for b, sh in ((bl, J['shL']), (br, J['shR'])):
                top = b + v3([0, 0.06 * s, -0.01 * s]); over = sh + v3([-np.sign(sh[0]) * 0.045 * s, 0.03 * s, 0.0])
                P.cone(top, over, 0.009 * s, 0.009 * s, layer=-1, k=0.0)
                P.cone(over, v3([over[0] * 0.8, ub + 0.01 * s, -0.12 * s]), 0.009 * s, 0.009 * s, layer=-1, k=0.0)
        P.garment(layer, 0.0035, [m], k=0.004, base=L_DRAPE_LO if USE_MH else 0)

    def panties(self):
        P, J, s = self.P, self.J, self.s
        top = J['hipL'][1] + 0.06 * s
        crotch = J['hipL'][1] - 0.085 * s
        def m():
            P.cone([0, top, 0], [0, crotch - 0.03 * s, 0], 0.3, 0.3, layer=-1, k=0.0, t=CAPCONE)
            for side in (1, -1):  # leg openings: cut from the crotch up to the hip bone, a high V
                c = v3([side * 0.02 * s, crotch + 0.012 * s, 0.0]); n = nrm([-side * 0.7, 1.0, 0.0])
                P.box(c - n * 0.2, [0.2, 0.2, 0.3], layer=-1, op=SUB, k=0.008, up=n, ax=[0, 0, 1], round_=0.0)
        P.garment(L_BOTTOM, 0.003, [m], k=0.004, base=L_DRAPE_LO if USE_MH else 0)

    def boxers(self):
        J, s = self.J, self.s
        self.garment_lower(L_BOTTOM, 0.007, top=J['pelvis'][1] + 0.05 * s, folds=0.0016, end_frac=0.38)

    def apron(self):
        P, J, s = self.P, self.J, self.s
        py, cy = J['pelvis'][1], J['chest'][1]
        gw = s * self.g ** 0.75
        def masks():
            P.box([0, (cy - 0.1 * s + py) / 2, 0.2], [0.13 * gw, (cy - 0.1 * s - py) / 2 + 0.02, 0.2], layer=-1, k=0.0, t=MASKBOX)
        P.garment(L_APRON, 0.012 if self.g < 1.2 else 0.018, [masks], k=0.006, noise=(0.0012, 22, 0.4), base=L_DRAPE if USE_MH else 0)
        # the skirt of it, hanging in front of the thighs: a panel round the front of the fall of the legs
        low = J['kneeL'][1] + (0.04 if self.id != 'butcher' else -0.02) * s
        top = py + 0.03 * s
        xm, zf, zb = self.span(top, low)
        hw, hd, cz = xm + 0.02, (zf - zb) / 2 * 1.25 + 0.02, (zf + zb) / 2
        th = 0.012 if self.g < 1.2 else 0.016
        P.capcone([0, top, cz], [0, low, cz + 0.01], hw, hw + 0.01, layer=L_APRON, k=0.0, ax=X, sx=1.0, sz=hd / hw, noise=(0.002, 16, 0.3))
        P.capcone([0, top + 0.03, cz], [0, low - 0.02, cz + 0.01], hw - th, hw + 0.01 - th, layer=L_APRON, op=SUB, k=0.0, ax=X, sx=1.0, sz=(hd - th) / (hw - th))
        P.plane([0, 0, cz + 0.02], [0, 0, -1], layer=L_APRON, op=INTER, k=0.004, lo=(-1, low - 0.05, -1), hi=(1, top + 0.01, 1))
        for sx in (-1, 1):  # neck strap
            P.cone([sx * 0.06 * gw, cy - 0.1 * s, 0.1 * s], [sx * 0.045, cy + 0.06 * s, 0.0], 0.006 * s, 0.006 * s, layer=L_APRON, k=0.004)

    def shoes(self, style, sides=(1, -1)):
        P, J, s = self.P, self.J, self.s
        for side, an in ((1, J['ankleL']), (-1, J['ankleR'])):
            if side not in sides: continue
            toe = an + v3([side * 0.012 * s, -0.03 * s, 0.15 * s])
            if style == 'heels':
                def m(an=an):
                    P.cone(an + v3([0, 0.005 * s, 0]), an + v3([0, -0.03 * s, 0.2 * s]), 0.075, 0.075, layer=-1, k=0, t=MASKCONE)
                    P.plane(an + v3([0, 0.004 * s, -0.03 * s]), [0, 1, -0.45], layer=-1, op=INTER)
                P.garment(L_SHOES, 0.004, [m], k=0.004)
                P.cone(an + v3([0, -0.032 * s, 0.12 * s]), an + v3([side * 0.01 * s, -0.045 * s, 0.205 * s]), 0.022 * s, 0.006 * s, layer=L_SHOES, k=0.01, ax=X, sx=1.0, sz=0.5)  # the point
                P.box(an + v3([0, -0.03 * s, -0.04 * s]), [0.011 * s, 0.024 * s, 0.012 * s], layer=L_SHOES, k=0.004, round_=0.003 * s)     # heel

                continue
            up = {'tall': J['kneeL'][1] - 0.06 * s - an[1], 'boots': 0.11 * s, 'sneakers': 0.025 * s, 'dress': 0.015 * s, 'flats': 0.0}[style]
            t = {'tall': 0.007, 'boots': 0.011, 'sneakers': 0.011, 'dress': 0.006, 'flats': 0.005}[style]
            def m(an=an, up=up, toe=toe):
                P.cone(an + v3([0, up, 0]), an, 0.075, 0.075, layer=-1, k=0, t=MASKCONE)
                P.cone(an, toe + v3([0, 0, 0.03 * s]), 0.075, 0.075, layer=-1, k=0, t=MASKCONE)
                if style == 'flats':
                    P.plane(an + v3([0, -0.004 * s, -0.03 * s]), [0, 1, -0.35], layer=-1, op=INTER)
            P.garment(L_SHOES, t, [m], k=0.006, noise=(0.0008 if style == 'tall' else 0.0, 30, 0.3))
            sole = {'tall': 0.012, 'boots': 0.014, 'sneakers': 0.018, 'dress': 0.008, 'flats': 0.006}[style]
            def ms(an=an, toe=toe, sole=sole):
                P.cone(an, toe + v3([0, 0, 0.03 * s]), 0.09, 0.09, layer=-1, k=0, t=MASKCONE)
                P.plane([0, sole, 0], [0, 1, 0], layer=-1, op=INTER, k=0.002)
            P.garment(L_SHOES, t + 0.006, [ms], k=0.004)

    def hair(self, style):
        P, s, fem = self.P, self.s, self.fem
        H = self.H
        f = 0.94 if fem else 1.0
        def scalp(front=0.045, back=-0.065, sides=None):
            def m():
                P.ell(H(0, 0.02, -0.012), self.Rk([0.11 * s, 0.13 * s, 0.13 * s]), layer=-1, k=0.0)
                fp, bp = H(0, front, 0.095), H(0, back, -0.1)
                dvec = nrm(fp - bp); n = nrm(np.cross(dvec, X)) if False else nrm(np.array([0, -dvec[2], dvec[1]]))
                if n[1] > 0: n = -n
                P.plane(fp, n, layer=-1, op=INTER, k=0.004)
                if sides is not None:  # keep hair off the ears and sideburns low
                    for sx in (-1, 1): P.ell(H(sx * 0.08, sides, 0.0), self.Rk([0.03 * s, 0.035 * s, 0.035 * s]), layer=-1, op=INTER, k=0.0)
            return m
        strand = (0.0016, 110, 0.18)
        if style in ('short', 'messy', 'sparse'):
            t = {'short': 0.0085, 'messy': 0.012, 'sparse': 0.003}[style]
            P.garment(L_HAIR, t, [scalp(0.05 if style != 'sparse' else 0.07, -0.06)], k=0.006, noise=(0.003, 60, 0.6) if style == 'messy' else strand)
            if style == 'sparse':
                P.ell(H(0, 0.1, 0.02), self.Rk([0.07 * s, 0.05 * s, 0.075 * s]), layer=L_HAIR, op=SUB, k=0.02)  # the crown has gone
            return
        # women's styles: a fuller cap, then the shape of the cut
        P.garment(L_HAIR, 0.011, [scalp(0.052, -0.07)], k=0.006, noise=strand)
        if style == 'bun':
            P.ell(H(0, 0.06, -0.108), self.Rk([0.04 * s, 0.035 * s, 0.035 * s]), layer=L_HAIR, k=0.012, noise=strand)
        if style == 'ponytail':
            P.ell(H(0, 0.045, -0.103), [0.022 * s] * 3, layer=L_HAIR, k=0.01)
            P.cone(H(0, 0.04, -0.11), H(0, -0.17, -0.15), 0.026 * s, 0.014 * s, layer=L_HAIR, k=0.01, ax=X, sx=1.15, sz=0.8, noise=(0.002, 90, 0.2))
        if style in ('bob', 'long'):
            # hair that hangs: a shell round the skull, falling straight from its widest to the cut, open at the face
            R = self.Rk([0.09 * s * f, 0.112 * s, 0.106 * s])
            c = H(0, 0.0, -0.012)
            cut = H(0, -0.095, 0)[1] if style == 'bob' else self.J['chest'][1] - 0.03 * self.s
            hang = (0.0016, 85, 0.12)
            P.ell(c, R, layer=L_HAIR, k=0.01, noise=hang)
            P.capcone(H(0, -0.01, -0.016), [c[0], cut, c[2] - 0.012 * self.s], R[0] * 0.99, R[0] * (1.02 if style == 'bob' else 0.96), layer=L_HAIR, k=0.03, ax=X, sx=1.0, sz=R[2] / R[0] * 0.92, noise=hang)
            P.ell(H(0, -0.045, 0.1), self.Rk([0.064 * s * f, 0.1 * s, 0.09 * s]), layer=L_HAIR, op=SUB, k=0.014)           # the face, an oval
            jaw = H(0, -0.1, 0)[1]
            P.box([0, jaw - 0.15, H(0, 0, 0.0)[2] + 0.15], [0.25, 0.15, 0.15], layer=L_HAIR, op=SUB, k=0.02, round_=0.01)   # nothing under the chin
            P.ell(self.hc + v3([0, -0.16, -0.01]) * s, [0.07 * s, 0.09 * s, 0.07 * s], layer=L_HAIR, op=SUB, k=0.02)          # nor round the neck
            P.ell(H(0, 0.06, 0.066), self.Rk([0.07 * s * f, 0.028 * s, 0.04 * s]), layer=L_HAIR, k=0.014, noise=strand)      # fringe swept across
            if style == 'long':  # and down the back, lying on it
                J = self.J; top = self.J['head'][1] + 0.02 * self.s; low = J['chest'][1] - 0.2 * self.s
                def mb():
                    P.cone([0, top, -0.12], [0, low, -0.12], 0.115 * self.s, 0.075 * self.s, layer=-1, k=0.0, ax=X, sx=1.0, sz=2.0, t=CAPCONE)
                    P.plane([0, 0, -0.02], [0, 0, 1], layer=-1, op=INTER, k=0.01)
                P.garment(L_HAIR, 0.013, [mb], k=0.03, noise=(0.0018, 80, 0.1), base=L_DRAPE if USE_MH else 0)
                P.plane([0, low, 0], [0, -1, -0.25], layer=L_HAIR, op=INTER, k=0.02)

    def cap(self):
        P, s, H = self.P, self.s, self.H
        police = self.id in ('police', 'station')
        def m():
            P.ell(H(0, 0.02, -0.012), self.Rk([0.12 * s, 0.13 * s, 0.13 * s]), layer=-1, k=0.0)
            P.plane(H(0, 0.04, 0.09), [0, -0.92, -0.4], layer=-1, op=INTER, k=0.004)
        P.garment(L_HAT, 0.022, [m], k=0.008, noise=(0.0008, 40, 1))
        if police:  # a flat crown and a band
            P.ell(H(0, 0.1, -0.005), self.Rk([0.1 * s, 0.03 * s, 0.11 * s]), layer=L_HAT, k=0.02)
        P.ell(H(0, 0.044, 0.1), self.Rk([0.058 * s, 0.006 * s, 0.05 * s]), layer=L_HAT, k=0.008, up=[0, 1, -0.28])  # the peak, curved down a little

    def helmet(self):
        P, s, H = self.P, self.s, self.H
        P.ell(H(0, 0.045, -0.01), self.Rk([0.115 * s, 0.105 * s, 0.125 * s]), layer=L_HAT, k=0.0)
        P.plane(H(0, 0.012, 0), [0, -1, 0], layer=L_HAT, op=INTER, k=0.004)
        P.ell(H(0, 0.014, -0.045), self.Rk([0.155 * s, 0.009 * s, 0.2 * s]), layer=L_HAT, k=0.012)            # brim, long at the back
        P.box(H(0, 0.145, -0.01), self.Rk([0.012 * s, 0.012 * s, 0.11 * s]), layer=L_HAT, k=0.02, round_=0.008 * s)  # comb
        P.box(H(0, 0.08, 0.12), self.Rk([0.03 * s, 0.035 * s, 0.006 * s]), layer=L_HAT, k=0.008, up=[0, 1, 0.3], round_=0.003 * s)  # front shield

    def scarf(self):
        """wound round the neck (cloth grown out from it), one end hanging down the front"""
        P, J, s = self.P, self.J, self.s
        cy = J['chest'][1]
        jaw = self.H(0, -0.1, 0)[1]
        def m():
            P.cone([0, cy - 0.01 * s, 0.005], [0, jaw - 0.012 * s, 0.0], 0.085 * s, 0.075 * s, layer=-1, k=0.0, t=CAPCONE)
            P.ell(self.hc + v3([0, -0.005, 0.01]) * s, [0.098 * s, 0.135 * s, 0.125 * s], layer=-1, op=SUB, k=0.01)
        P.garment(L_SCARF, 0.022, [m], k=0.012, noise=(0.004, 30, 0.6))
        z0 = self.front_z(0.04 * s, cy - 0.01 * s)
        P.cone([0.035 * s, cy + 0.0 * s, z0 + 0.008], [0.06 * s, cy - 0.2 * s, self.front_z(0.06 * s, cy - 0.2 * s) + 0.01], 0.032 * s, 0.028 * s, layer=L_SCARF, k=0.03, ax=X, sx=1.2, sz=0.32, noise=(0.003, 30, 0.3))

    def backpack(self):
        P, J, s = self.P, self.J, self.s
        cy = J['chest'][1]
        big = self.id == 'rider'
        hw, hh, hd = (0.2, 0.22, 0.17) if big else (0.135, 0.17, 0.065)
        zb = min(self.extent(y)[2] for y in (cy - 0.08 * s, cy - 0.17 * s, cy - 0.26 * s)) - 0.018   # the back, with what's worn on it
        P.box([0, cy - 0.17 * s, zb - hd * s + 0.01], [hw * s, hh * s, hd * s], layer=L_PACK, k=0.02, round_=(0.03 if big else 0.045) * s, noise=(0.001, 30, 1))
        for sx in (-1, 1):
            P.cone([sx * 0.085 * s, cy + 0.05 * s, -0.03 * s], [sx * 0.11 * s, cy - 0.3 * s, 0.08 * s], 0.012 * s, 0.012 * s, layer=L_PACK, k=0.01, ax=X, sx=1.6, sz=0.45)

    def tie(self):
        P, J, s = self.P, self.J, self.s
        cy = J['chest'][1]
        z0 = self.front_z(0, cy + 0.01 * s)
        z1 = self.front_z(0, J['pelvis'][1] + 0.16 * s)
        P.cone([0, cy + 0.02 * s, z0 + 0.004], [0, J['pelvis'][1] + 0.14 * s, z1 + 0.005], 0.01 * s, 0.022 * s, layer=L_DETAIL, k=0.004, ax=X, sx=1.0, sz=0.22, tag='tie')

    def collar(self):
        P, J, s = self.P, self.J, self.s
        cy = J['chest'][1]
        for sx in (-1, 1):
            P.box([sx * 0.028 * s, cy + 0.035 * s, self.front_z(sx * 0.03 * s, cy + 0.03 * s) + 0.002], [0.026 * s, 0.018 * s, 0.004 * s], layer=L_DETAIL, k=0.004, up=[sx * 0.4, 1, 0.3], ax=[1, -sx * 0.4, 0], round_=0.002 * s, tag='collar')

    def lanyard(self):
        P, J, s = self.P, self.J, self.s
        cy = J['chest'][1]
        cz = self.front_z(0.03 * s, cy - 0.17 * s)
        for sx in (-1, 1):
            P.cone([sx * 0.05 * s, cy + 0.05 * s, 0.0], [0.03 * s, cy - 0.15 * s, cz + 0.004], 0.0028 * s, 0.0028 * s, layer=L_DETAIL, k=0.002, tag='lanyard')
        P.box([0.03 * s, cy - 0.19 * s, cz + 0.005], [0.024 * s, 0.034 * s, 0.002 * s], layer=L_DETAIL, k=0.002, round_=0.002 * s, tag='card')

    def cleaver(self):
        P, J, s = self.P, self.J, self.s
        sh = J['shL']
        c = sh + v3([-0.04 * s, 0.035 * s, 0.02 * s])
        d = nrm([0.5, 0.75, 0.42])
        P.box(c + d * 0.03 * s, [0.004 * s, 0.05 * s, 0.045 * s], layer=L_GEAR, k=0.0, up=d, ax=[0.84, -0.54, 0], round_=0.001 * s, tag='blade')
        P.cone(c + d * 0.08 * s, c + d * 0.19 * s, 0.012 * s, 0.013 * s, layer=L_GEAR, k=0.004)

    def extent(self, y):
        """the body's half-width and front/back at a height (bare body, before clothes)"""
        import sdf
        A = self.P.array(); out = np.zeros(NLT)
        def inside(x, z):
            sdf.eval_layers(A, self.P.GV, x, y, z, NLT, out); return out[0] < 0.0
        xm = 0.4
        while xm > 0 and not any(inside(xm, z) for z in np.arange(-0.2, 0.2, 0.01)): xm -= 0.003
        zf = 0.3
        while zf > -0.3 and not any(inside(x, zf) for x in np.arange(-xm, xm + 1e-9, 0.01)): zf -= 0.003
        zb = -0.3
        while zb < zf and not any(inside(x, zb) for x in np.arange(-xm, xm + 1e-9, 0.01)): zb += 0.003
        return xm, zf, zb

    def span(self, y0, y1, n=5):
        """the widest the body (and what's on it) gets between two heights"""
        E = [self.extent(y) for y in np.linspace(y0, y1, n)]
        return max(e[0] for e in E), max(e[1] for e in E), min(e[2] for e in E)

    def front_z(self, x, y, start=0.4):
        """the front of what's built so far at (x, y), found by marching in from the front"""
        from sdf import eval_point
        A = self.P.array()
        z = start
        while z > -0.3:
            if eval_point(A, self.P.GV, x, y, z, NLT, False) < 0.0005:
                return z
            z -= 0.002
        return 0.0


def bounds(ch):
    J = ch.J
    pts = np.array(list(J.values()))
    lo = pts.min(axis=0) - np.array([0.16, 0.0, 0.3])
    hi = pts.max(axis=0) + np.array([0.16, 0.0, 0.32])
    lo[1] = -0.01
    hi[1] = ch.hc[1] + 0.2 * ch.s
    return lo, hi
