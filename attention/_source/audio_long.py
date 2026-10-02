"""Original 120 BPM score for the 2-minute cut. Fully synthesised; every drum hit and event sits on the video's beat grid
(1 beat = 0.5 s, 1 bar = 2 s). Output: 48 kHz stereo WAV (loudness-normalised afterwards with ffmpeg)."""
import sys, wave
import numpy as np
from scipy.signal import fftconvolve, butter, sosfilt, sosfiltfilt

SR = 48000
DUR = 120.0
N = int(SR * DUR)
BPM = 120
BEAT = 60.0 / BPM
rng = np.random.default_rng(3)

BUS = {k: np.zeros((2, N)) for k in ('drums', 'bass', 'pad', 'music', 'fx')}
SEND = np.zeros((2, N))
KICKS = []  # for sidechain


def midi(m):
    return 440.0 * 2 ** ((np.asarray(m, dtype=float) - 69) / 12)


def pan_g(p):
    a = (np.clip(p, -1, 1) + 1) * np.pi / 4
    return np.cos(a), np.sin(a)


def put(bus, sig, t0, g=1.0, pan=0.0, rev=0.2):
    i0 = int(round(t0 * SR))
    if i0 >= N or len(sig) == 0:
        return
    if i0 < 0:
        sig = sig[-i0:]
        i0 = 0
    sig = sig[: N - i0]
    gl, gr = pan_g(pan)
    BUS[bus][0, i0:i0 + len(sig)] += sig * g * gl
    BUS[bus][1, i0:i0 + len(sig)] += sig * g * gr
    if rev > 0:
        SEND[0, i0:i0 + len(sig)] += sig * g * gl * rev
        SEND[1, i0:i0 + len(sig)] += sig * g * gr * rev


def lp(x, fc, order=2):
    return sosfiltfilt(butter(order, fc / (SR / 2), btype='low', output='sos'), x)


def hp(x, fc, order=2):
    return sosfiltfilt(butter(order, fc / (SR / 2), btype='high', output='sos'), x)


def bp(x, f1, f2, order=2):
    return sosfiltfilt(butter(order, [f1 / (SR / 2), min(f2, SR / 2 - 200) / (SR / 2)], btype='band', output='sos'), x)


def env_adsr(n, a, r):
    e = np.ones(n)
    na, nr = int(a * SR), int(r * SR)
    if na:
        e[:na] = np.linspace(0, 1, na) ** 2
    if nr:
        e[-nr:] *= np.linspace(1, 0, nr) ** 1.5
    return e


# ------------------------------------------------------------------ instruments
def kick(punch=1.0):
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    f = 46 + 120 * np.exp(-t / 0.032)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t / 0.2)
    s += 0.35 * np.sin(2 * ph) * np.exp(-t / 0.05)
    click = hp(rng.standard_normal(n), 2500) * np.exp(-t / 0.003) * 0.18 * punch
    s = np.tanh(1.5 * (s + click)) / np.tanh(1.5)
    s[:int(0.001 * SR)] *= np.linspace(0, 1, int(0.001 * SR))
    return s


def clap():
    n = int(0.32 * SR)
    t = np.arange(n) / SR
    nz = bp(rng.standard_normal(n), 900, 4200)
    env = np.exp(-t / 0.075)
    for k in range(3):
        env += 0.9 * np.exp(-np.clip(t - k * 0.009, 0, None) / 0.006) * (t >= k * 0.009) * (1 - k * 0.2)
    s = nz * env
    return s / np.max(np.abs(s))


def hat(open_=False):
    n = int((0.22 if open_ else 0.05) * SR)
    t = np.arange(n) / SR
    nz = hp(rng.standard_normal(n), 7000)
    return nz * np.exp(-t / (0.07 if open_ else 0.012)) * 0.9


def bass_note(f, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t) + 0.12 * np.sin(2 * np.pi * 3 * f * t)
    s *= env_adsr(n, 0.004, min(0.08, dur * 0.4))
    return np.tanh(1.6 * s) / np.tanh(1.6)


def pad_chord(freqs, dur, bright=1.0, seed=0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    r = np.random.default_rng(seed)
    out = np.zeros((2, n))
    for fi, f in enumerate(freqs):
        for side, det in ((0, -4.0), (1, 4.0)):
            ff = f * 2 ** (det / 1200)
            layer = np.zeros(n)
            k = 1
            while k * ff < 6500 and k <= 16:
                amp = (1 / k ** 1.5) / (1 + (k * ff / (1100 * bright)) ** 2)
                layer += amp * np.sin(2 * np.pi * k * ff * t + r.random() * 6.28)
                k += 1
            out[side] += layer * (0.8 + 0.2 * np.sin(2 * np.pi * (0.08 + 0.04 * r.random()) * t + r.random() * 6.28))
    return out


def bell(f, dur=2.5, decay=1.1, glass=0.35):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * t) * np.exp(-t / decay)
    s += 0.32 * np.sin(2 * np.pi * 2.0 * f * t) * np.exp(-t / (decay * 0.45))
    s += glass * 0.5 * np.sin(2 * np.pi * 2.76 * f * t) * np.exp(-t / (decay * 0.22))
    s += glass * 0.25 * np.sin(2 * np.pi * 5.4 * f * t) * np.exp(-t / (decay * 0.09))
    na = int(0.004 * SR)
    s[:na] *= np.linspace(0, 1, na)
    return s


def pluck(f, dur=1.4, decay=0.35):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for k, a in ((1, 1.0), (2, 0.5), (3, 0.22), (4, 0.1), (5, 0.05)):
        s += a * np.sin(2 * np.pi * k * f * t) * np.exp(-t * k / decay)
    na = int(0.004 * SR)
    s[:na] *= np.linspace(0, 1, na) ** 2
    return s


def tick(f=1900, dur=0.09):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.014)
    s += 0.5 * np.sin(2 * np.pi * f * 1.63 * t) * np.exp(-t / 0.007)
    s += 0.35 * hp(rng.standard_normal(n), 3000) * np.exp(-t / 0.0018)
    na = int(0.0008 * SR)
    s[:na] *= np.linspace(0, 1, na)
    return s


def swish(dur, f_from, f_to, peak=0.5, q=0.7):
    n = int(dur * SR)
    nz = rng.standard_normal(n)
    out = np.zeros(n)
    blk = 1024
    zi = None
    for b0 in range(0, n, blk):
        u = (b0 + blk / 2) / n
        fc = f_from * (f_to / f_from) ** u
        lo, hi = fc * (1 - q / 2), min(fc * (1 + q / 2), SR / 2 - 100)
        sos = butter(2, [lo / (SR / 2), hi / (SR / 2)], btype='band', output='sos')
        if zi is None:
            zi = np.zeros((sos.shape[0], 2))
        y, zi = sosfilt(sos, nz[b0:b0 + blk], zi=zi)
        out[b0:b0 + blk] = y
    u = np.linspace(0, 1, n)
    env = np.where(u < peak, (u / peak) ** 2, ((1 - u) / (1 - peak)) ** 1.6)
    return out * env


def riser(dur, f0=300, f1=9000):
    s = swish(dur, f0, f1, peak=0.97, q=1.1)
    n = len(s)
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * np.cumsum(180 * (6 ** (t / dur))) / SR) * (t / dur) ** 2 * 0.25
    return s / np.max(np.abs(s)) * 0.9 + tone


def impact():
    n = int(2.4 * SR)
    t = np.arange(n) / SR
    boom = np.sin(2 * np.pi * np.cumsum(38 + 90 * np.exp(-t / 0.08)) / SR) * np.exp(-t / 0.7)
    crash = hp(rng.standard_normal(n), 3500) * np.exp(-t / 0.55) * 0.3
    return np.tanh(1.3 * (boom + crash)) / np.tanh(1.3)


def scale_note(i, base=69):  # A minor-pentatonic-ish scale in F major: F G A C D
    degs = [0, 2, 4, 7, 9]
    return base + 12 * (i // 5) + degs[i % 5] - 4  # starts on F4 when base=69 → 65


# ------------------------------------------------------------------ harmony: F major home, Dm - Bb - F - C
CHORDS = [
    dict(root=38, tones=[62, 65, 69, 72, 76]),   # Dm9
    dict(root=34, tones=[58, 62, 65, 69, 74]),   # Bbmaj7(9)
    dict(root=41, tones=[65, 69, 72, 76, 67]),   # Fmaj7(add9)
    dict(root=36, tones=[60, 64, 67, 74, 71]),   # Cadd9
]
EDGES = [10, 20, 32, 52, 60, 70, 78, 94, 102, 110, 116, 120]


def chord_regions():
    """[(t0, t1, chord)] — the cycle restarts on every chapter boundary so changes always land on a bar."""
    out = [(0, 6, CHORDS[0]), (6, 10, CHORDS[1])]
    for a, b in zip(EDGES[:-1], EDGES[1:]):
        t = a
        k = 0
        while t < b - 1e-6:
            t1 = min(t + 4, b)
            out.append((t, t1, CHORDS[k % 4] if b < 116 or a < 116 else CHORDS[2]))
            t = t1
            k += 1
    return out


REG = chord_regions()
inside = lambda t, a, b: a - 1e-6 <= t < b - 1e-6


# ------------------------------------------------------------------ pad (continuous), with a section-level gain curve
PAD_GAIN = [(0, 0.0), (1.2, 0.8), (8, 0.9), (10, 1.0), (52, 1.0), (60, 0.8), (70, 0.9), (78, 1.0), (116, 1.0), (118, 0.9), (120, 0.0)]


def curve(points, t):
    ts, vs = zip(*points)
    return np.interp(t, ts, vs)


def build_pad():
    for k, (a, b, ch) in enumerate(REG):
        dur = b - a + 0.8
        v = pad_chord(midi(ch['tones'][:4]), dur, 1.0, seed=k)
        env = env_adsr(v.shape[1], 0.35, 0.7)
        seg = v * env * 0.035
        i0 = int(a * SR)
        seg = seg[:, : N - i0]
        BUS['pad'][:, i0:i0 + seg.shape[1]] += seg
        SEND[:, i0:i0 + seg.shape[1]] += seg * 0.3
    tt = np.arange(N) / SR
    BUS['pad'] *= curve(PAD_GAIN, tt)[None, :]


# ------------------------------------------------------------------ drum grid
SECT = {  # (t0, t1): kick mode, clap, hats, bass mode, arps, lead
    (10, 20): ('half', False, 'sparse', 'simple', None, False),
    (20, 32): ('four', True, '8th', 'full', 'eighth', False),
    (32, 44): ('half', True, '8th', 'simple', 'eighth_soft', False),
    (44, 48): ('half', True, '8th', 'simple', 'eighth_soft', False),
    (48, 52): ('four', True, '8th', 'full', 'eighth', False),
    (52, 60): ('one', False, None, None, 'eighth_soft', False),
    (60, 70): ('four', True, '8th', 'full', 'sixteenth', True),
    (70, 74): (None, False, None, None, None, False),
    (74, 76): (None, False, 'sparse', None, 'climb', False),
    (76, 78): ('half', False, 'sparse', None, 'climb', False),
    (78, 94): ('four', True, '8th', 'full', 'eighth', True),
    (94, 102): ('half', True, '8th', 'simple', None, False),
    (102, 110): ('four', True, '8th', 'full', 'eighth', True),
    (110, 116): ('one', False, None, 'simple', None, True),
}


def build_drums_and_music():
    kk, cl = kick(), clap()
    h_c, h_o = hat(False), hat(True)
    for (a, b), (km, clp, hats, bm, arp, lead) in SECT.items():
        nb = int(round((b - a) / BEAT))
        for j in range(nb):
            t = a + j * BEAT
            m = j % 4
            # kicks
            kv = {'four': 1.0, 'half': 1.0 if m in (0, 2) else 0, 'one': 1.0 if m == 0 else 0}.get(km, 0)
            if kv:
                put('drums', kk, t, 0.9 if m == 0 else 0.75, 0.0, 0.03)
                KICKS.append(t)
            if clp and m in (1, 3):
                put('drums', cl, t, 0.45, 0.05 * (1 if m == 1 else -1), 0.28)
            if hats:
                put('drums', h_c, t, 0.18 if m else 0.24, -0.25, 0.04)
                if hats == '8th':
                    put('drums', h_o if m in (1, 3) else h_c, t + BEAT / 2, 0.16 if m in (1, 3) else 0.11, 0.25, 0.05)
        # bass
        if bm:
            for (ra, rb, ch) in REG:
                lo, hi = max(a, ra), min(b, rb)
                if hi - lo < 1e-6:
                    continue
                f0 = float(midi(ch['root']))
                t = lo
                while t < hi - 1e-6:
                    bar_beat = ((t - a) / BEAT) % 4
                    if bm == 'full':
                        pats = [(0, 1, 0.7), (1.5, 1, 0.3), (2, 1, 0.7), (3, 1.5, 0.3), (3.5, 2, 0.28)]
                    else:
                        pats = [(0, 1, 1.4), (2, 1, 0.8)]
                    for off, mul, d in pats:
                        tt = t + off * BEAT
                        if tt < hi - 1e-6:
                            put('bass', bass_note(f0 * mul, d * 1.0), tt, 0.5 if off in (0, 2) else 0.32, 0.0, 0.02)
                    t += 4 * BEAT
        # arps
        if arp:
            for (ra, rb, ch) in REG:
                lo, hi = max(a, ra), min(b, rb)
                if hi - lo < 1e-6:
                    continue
                tones = ch['tones']
                step = {'eighth': 0.5, 'eighth_soft': 0.5, 'sixteenth': 0.25, 'climb': 0.25}[arp] * BEAT * 2
                g = 0.045 if arp != 'eighth_soft' else 0.028
                k = 0
                t = lo
                while t < hi - 1e-6:
                    if arp == 'climb':
                        note = scale_note(int((t - 74) / (0.125) * 0.42) + 3) + 12
                    else:
                        seq = [0, 2, 3, 1, 4, 2, 3, 1]
                        note = tones[seq[k % 8] % len(tones)] + (12 if k % 8 in (3, 5) else 0)
                    put('music', pluck(float(midi(note)), 1.0, 0.28), t, g, ((k % 6) - 2.5) * 0.28, 0.35)
                    t += step / 2 if arp in ('sixteenth', 'climb') else step / 2
                    k += 1
        # lead hook (two bars per chord)
        if lead:
            hook = [(0, 2, 12), (1.5, 3, 12), (2, 2, 12), (3.5, 1, 12), (4, 0, 24), (5.5, 1, 12), (6, 2, 12), (7.5, 4, 12)]
            for (ra, rb, ch) in REG:
                lo, hi = max(a, ra), min(b, rb)
                if hi - lo < 1e-6 or (rb - ra) < 3.9:
                    continue
                for off, idx, oct_ in hook:
                    tt = ra + off * BEAT
                    if lo <= tt < hi:
                        note = ch['tones'][idx] + (oct_ if oct_ == 24 else 12)
                        put('music', bell(float(midi(note)), 1.6, 0.55, 0.2), tt, 0.05, 0.0, 0.5)
                        put('music', pluck(float(midi(note)), 0.9, 0.22), tt, 0.03, 0.0, 0.3)


# ------------------------------------------------------------------ the story: one sound for every thing that happens on screen
W_WIDE = np.array([0.02, 0.10, 0.03, 0.02, 0.04, 0.60, 0.04, 0.06, 0.02, 0.02, 0.05])
RAW = (np.log(W_WIDE) + 4.6) * np.sqrt(8)
panx = lambda x: float(np.clip((x - 960) / 960 * 1.25, -0.9, 0.9))
COLX = lambda i: 1010 + (i - 5) * 138
TOKX = [413, 535, 677, 800, 897, 998, 1142, 1248, 1318, 1404, 1498]


def story():
    F, B = 'fx', 'music'
    # --- opening: a page lit in a dark hall
    put(F, swish(2.5, 200, 1400, peak=0.7, q=0.9), 0.0, 0.06, 0.0, 0.7)
    for k, m in enumerate([81, 86, 88]):
        put(B, bell(float(midi(m)), 3.2, 1.4, 0.25), 0.7 + k * 0.5, 0.045, (-0.3, 0.3, 0.0)[k], 0.9)
    put(F, swish(1.4, 400, 3000, peak=0.6), 1.6, 0.05, 0.0, 0.6)             # camera push to the title
    put(F, swish(0.8, 1500, 5000, peak=0.5, q=0.5), 3.0, 0.06, 0.0, 0.5)     # marker swipe over the title
    put(B, bell(float(midi(74)), 2.0, 0.9), 3.0, 0.05, 0.0, 0.8)
    for k in range(8):                                                       # eight authors, one every 1/4 s
        put(F, tick(1700 + 90 * k, 0.07), 4.8 + 0.25 * k, 0.1, -0.7 + k * 0.2, 0.3)
    put(F, swish(0.9, 600, 4000, peak=0.5, q=0.5), 6.4, 0.05, 0.0, 0.5)
    for k, tt in enumerate((7.0, 7.2)):                                      # the thesis highlighter
        put(F, swish(0.6, 1200, 4800, peak=0.5, q=0.5), tt, 0.06, 0.0, 0.5)
    put(B, bell(float(midi(81)), 2.4, 1.0), 7.5, 0.05, 0.2, 0.9)
    put(F, swish(1.0, 3000, 500, peak=0.35), 7.9, 0.05, 0.0, 0.7)            # page falls away
    put(F, riser(2.0), 8.0, 0.16, 0.0, 0.5)                                  # riser into the drop
    # snare roll 8.0 → 10.0, accelerating
    cl = clap()
    t, step = 8.0, 0.5
    while t < 10.0 - 1e-6:
        put('drums', cl, t, 0.18 + 0.3 * (t - 8) / 2, 0.0, 0.2)
        step = max(0.0625, step * 0.72)
        t += step
    for j in range(4):                                                       # pre-drop kicks, growing
        put('drums', kick(), 8.0 + j * 0.5, 0.25 + 0.15 * j, 0.0, 0.02)
        KICKS.append(8.0 + j * 0.5)
    put(F, impact(), 10.0, 0.5, 0.0, 0.5)                                    # the drop
    # --- 01 recurrence: eleven ticks, one per word, then six weakening hops
    for i in range(11):
        put(F, tick(1800 + (i % 2) * 40, 0.08), 11.0 + 0.5 * i, 0.16 * (1 - 0.02 * i), panx(TOKX[i]), 0.22)
    put(B, bell(float(midi(69)), 2.0, 0.9), 16.0, 0.04, 0.3, 0.8)
    for k in range(6):
        put(B, bell(float(midi(88 - 3 * k)), 1.2, 0.5 + 0.1 * (6 - k), 0.2), 16.5 + 0.5 * k, 0.055 * (1 - 0.1 * k), -0.4 + 0.15 * k, 0.6)
    # --- 02 self-attention
    put(F, impact(), 20.0, 0.45, 0.0, 0.5)
    put(F, swish(1.8, 800, 7000, peak=0.6), 20.0, 0.06, 0.0, 0.7)
    for i in range(11):
        put(B, bell(float(midi(74 + [0, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26][i])), 2.4, 1.1, 0.35), 20.02 + 0.004 * i, 0.03, panx(TOKX[i]), 0.9)
    put(B, pluck(float(midi(62)), 2.0, 0.7), 24.1, 0.1, panx(535), 0.45)
    put(B, pluck(float(midi(69)), 2.0, 0.7), 24.12, 0.06, panx(535), 0.45)
    put(F, swish(0.8, 900, 2600, peak=0.5), 28.0, 0.05, panx(1498), 0.5)
    put(B, pluck(float(midi(66)), 2.0, 0.7), 28.8, 0.1, panx(998), 0.45)
    put(B, pluck(float(midi(73)), 2.0, 0.7), 28.82, 0.06, panx(998), 0.45)
    # --- 03 Q K V
    put(F, swish(1.2, 500, 3500, peak=0.5), 31.9, 0.05, 0.3, 0.6)
    for r, m in enumerate([76, 79, 83]):       # Q, K, V rows arrive on 33, 34, 35
        put(B, bell(float(midi(m)), 2.2, 0.9, 0.25), 33.0 + r, 0.05, -0.3 + r * 0.3, 0.8)
    for j in range(11):                          # the scanner: pitch follows the score
        note = scale_note(int(RAW[j] / 12 * 9) + 3) + 12
        put(B, pluck(float(midi(note)), 0.9, 0.3), 38.0 + 0.5 * j, 0.1 + (0.08 if j == 5 else 0), panx(COLX(j) * 0.9 + 96), 0.4)
    put(F, swish(0.9, 3500, 500, peak=0.4), 44.0, 0.05, 0.0, 0.6)            # ÷√dk: squeeze
    put(F, swish(1.0, 400, 4000, peak=0.9), 46.0, 0.06, 0.0, 0.6)            # softmax: lift
    for m in (72, 76, 79):
        put(B, bell(float(midi(m)), 2.2, 0.9, 0.2), 47.0, 0.04, 0.0, 0.8)
    t, step = 44.8, 0.5                                                        # build into the weighted sum
    while t < 48.0 - 1e-6:
        put('drums', cl, t, 0.12 + 0.2 * (t - 44.8) / 3.2, 0.0, 0.2)
        step = max(0.0625, step * 0.8)
        t += step
    put(F, swish(1.6, 5000, 700, peak=0.3), 48.0, 0.05, 0.0, 0.6)            # threads converge
    for k, m in enumerate([72, 76, 79, 84, 88]):
        put(B, bell(float(midi(m)), 2.2, 0.8, 0.2), 49.6 + 0.08 * k, 0.04, 0.35, 0.8)
    # --- 04 scaling: each step up in dimension lifts the pitch
    put(F, swish(1.0, 500, 2500, peak=0.5), 52.0, 0.05, 0.0, 0.6)
    for k, m in enumerate([60, 67, 72, 76, 79]):
        put(B, bell(float(midi(m)), 1.4, 0.55, 0.15), 52.5 + k, 0.05 + 0.01 * k, -0.4 + 0.2 * k, 0.6)
    put(F, riser(1.9, 200, 6000), 58.0, 0.12, 0.0, 0.5)
    put(B, bell(float(midi(48 + 12)), 2.0, 0.9, 0.1), 57.6, 0.03, -0.4, 0.8)    # the left panel collapses
    put(B, bell(float(midi(79)), 2.0, 0.9, 0.2), 57.6, 0.05, 0.4, 0.8)           # the right panel stays calm
    # --- 05 multi-head
    put(F, impact(), 60.0, 0.3, 0.0, 0.5)
    put(B, bell(float(midi(79)), 2.4, 1.0), 60.1, 0.05, 0.0, 0.8)
    put(F, swish(1.3, 300, 5000, peak=0.5, q=1.0), 61.6, 0.07, 0.0, 0.6)
    put(F, impact(), 62.0, 0.4, 0.0, 0.5)
    HN = [67, 71, 74, 78, 81, 83, 86, 90]
    for h, m in enumerate(HN):
        x = 960 - (8 * 165 + 7 * 34) / 2 + h * (165 + 34) + 82
        put(B, pluck(float(midi(m)), 1.6, 0.5), 63.0 + 0.5 * h, 0.075, panx(x), 0.55)
    put(F, swish(0.8, 600, 3000, peak=0.85), 66.0, 0.06, 0.0, 0.5)
    put(F, tick(1500, 0.1), 67.0, 0.14, 0.0, 0.3)
    for m in (72, 76, 79, 84):
        put(B, bell(float(midi(m)), 2.6, 1.1, 0.25), 68.0, 0.04, 0.0, 0.8)
    # --- 06 position
    put(F, swish(1.1, 3000, 300, peak=0.3), 69.9, 0.05, 0.0, 0.6)
    for k in range(10):                          # shuffle: a rattle of ticks
        put(F, tick(1200 + 140 * ((k * 7) % 9), 0.06), 71.0 + 0.1 * k, 0.1, -0.7 + 0.15 * k, 0.3)
    put(B, bell(float(midi(66)), 2.6, 1.0), 72.2, 0.05, 0.0, 0.8)
    put(F, riser(2.0, 250, 8000), 75.9, 0.1, 0.0, 0.5)
    # --- 07 transformer
    put(F, impact(), 78.0, 0.45, 0.0, 0.5)
    for k, tt in enumerate((78.5, 79.0, 79.5, 80.0, 80.5, 81.0)):
        put(B, pluck(float(midi(scale_note(k * 2 + 2) + 12)), 1.4, 0.4), tt, 0.1, -0.35, 0.5)
    put(F, swish(0.9, 500, 2500, peak=0.5), 82.0, 0.05, -0.3, 0.5)
    put(F, swish(1.1, 300, 3500, peak=0.8), 82.6, 0.06, -0.3, 0.5)
    put(B, bell(float(midi(81)), 2.0, 0.8), 83.0, 0.04, -0.5, 0.8)
    for k in range(10):
        put(B, pluck(float(midi(scale_note(k * 2) + 12)), 1.4, 0.4), 84.5 + 0.5 * k, 0.09, 0.35, 0.5)
    for i in range(11):                          # causal mask: a staircase of ticks
        put(F, tick(1500 + 90 * i, 0.06), 86.2 + 0.25 * i, 0.09, 0.6, 0.3)
    put(B, bell(float(midi(84)), 2.0, 0.9), 89.2, 0.05, 0.3, 0.8)
    put(F, swish(1.2, 400, 4000, peak=0.5), 90.2, 0.07, 0.0, 0.6)           # cross-attention path
    for i in range(11):
        put(F, tick(1900 + 70 * i, 0.06), 90.6 + 0.2 * i, 0.09, 0.6, 0.3)
    put(F, swish(2.2, 300, 5000, peak=0.9), 91.0, 0.06, 0.0, 0.6)
    put(B, bell(float(midi(88)), 2.4, 1.0), 92.6, 0.07, 0.4, 0.8)           # "es" lights up
    # --- 08 Table 1
    put(F, impact(), 94.0, 0.3, 0.0, 0.5)
    put(B, bell(float(midi(81)), 2.4, 1.2, 0.3), 94.5, 0.09, 0.0, 0.8)       # one hop
    for k in range(15):                          # fifteen hops, a rapid climb
        put(F, tick(1300 + 60 * k, 0.05), 96.2 + 0.1 * k, 0.1, -0.5 + k * 0.07, 0.3)
    for k, m in enumerate((72, 76, 79)):         # three jumps
        put(B, pluck(float(midi(m + 12)), 1.2, 0.4), 98.2 + 0.3 * k, 0.1, 0.2, 0.5)
    for m in (69, 72, 76, 81, 84):
        put(B, bell(float(midi(m)), 2.8, 1.2, 0.3), 99.6, 0.05, 0.0, 0.8)
    # --- 09 results
    put(F, impact(), 102.0, 0.3, 0.0, 0.5)
    for k in range(8):
        put(B, bell(float(midi(scale_note(k * 1 + 4) + 12)), 1.8, 0.8 + 0.05 * k, 0.25), 102.5 + 0.5 * k, 0.05 + 0.012 * k, -0.4, 0.7)
    for k in range(3):
        t0 = 106.0 + 0.5 * k
        for j in range(1, 11):
            u = j / 10
            put(F, tick(2200 + 140 * k, 0.04), t0 + 1.2 * (1 - (1 - u) ** 0.25), 0.06 * (1 - 0.5 * u), 0.45, 0.25)
        put(B, bell(float(midi(79 + 3 * k)), 2.4, 1.0, 0.25), t0 + 1.2, 0.07, 0.45, 0.8)
    # --- 10 legacy
    put(F, impact(), 110.0, 0.35, 0.0, 0.5)
    put(F, swish(2.4, 400, 6000, peak=0.9), 110.5, 0.05, 0.0, 0.7)
    for k, m in enumerate([74, 76, 78, 81, 83, 86]):
        put(B, bell(float(midi(m)), 3.0, 1.4, 0.3), 110.5 + 0.5 * k, 0.07, -0.6 + 0.24 * k, 0.8)
    put(F, swish(1.0, 700, 2600, peak=0.7), 115.0, 0.05, 0.0, 0.6)
    # --- end card
    put(F, impact(), 116.0, 0.6, 0.0, 0.6)
    for k, m in enumerate([62, 69, 74, 78, 81, 86]):
        put(B, bell(float(midi(m)), 3.6, 2.0, 0.2), 116.1 + 0.06 * k, 0.05 if m > 70 else 0.07, (-0.35, 0.35, -0.2, 0.2, -0.1, 0.1)[k], 0.9)
    put(B, bell(float(midi(93)), 3.0, 1.6, 0.2), 117.0, 0.04, 0.0, 0.9)


# ------------------------------------------------------------------ mix
def make_ir(rt60=2.2, length=3.0, seed=5):
    n = int(length * SR)
    t = np.arange(n) / SR
    r = np.random.default_rng(seed)
    ir = np.zeros((2, n))
    decay = np.exp(-6.91 * t / rt60)
    for ch in range(2):
        nz = r.standard_normal(n) * decay
        w = np.clip(t / 1.2, 0, 1)
        tail = lp(nz, 9000) * (1 - w) + lp(nz, 2500) * w
        for _ in range(14):
            d = r.uniform(0.008, 0.07)
            tail[int(d * SR)] += r.uniform(-0.6, 0.6) * (1 - d * 8)
        pre = int(0.012 * SR)
        ir[ch, pre:] = tail[: n - pre]
    ir /= np.sqrt(np.sum(ir ** 2, axis=1, keepdims=True))
    return ir


def main(out):
    build_pad()
    build_drums_and_music()
    story()
    # sidechain: every kick ducks the pad / bass / arps
    imp = np.zeros(N)
    for tk in KICKS:
        i = int(tk * SR)
        if 0 <= i < N:
            imp[i] = 1.0
    kern = np.exp(-np.arange(int(0.45 * SR)) / (0.16 * SR))
    env = np.clip(fftconvolve(imp, kern)[:N], 0, 1)
    duck = 1 - 0.55 * env
    for k, d in (('pad', 0.9), ('bass', 1.0), ('music', 0.5)):
        BUS[k] *= (1 - d * (1 - duck))[None, :]
    ir = make_ir()
    wet = np.stack([fftconvolve(SEND[0], ir[0])[:N], fftconvolve(SEND[1], ir[1])[:N]])
    wet = hp(wet, 200)
    mix = BUS['drums'] * 1.0 + BUS['bass'] * 1.0 + BUS['pad'] * 1.0 + BUS['music'] * 1.0 + BUS['fx'] * 1.0 + 0.55 * wet
    mix = hp(mix, 26)
    mix = lp(mix, 15000)
    fi = int(0.2 * SR)
    mix[:, :fi] *= np.linspace(0, 1, fi) ** 2
    fo0 = int(118.2 * SR)
    mix[:, fo0:] *= np.linspace(1, 0, N - fo0) ** 1.6
    peak = np.max(np.abs(mix))
    mix = np.tanh(mix / peak * 1.25 * 0.9) / np.tanh(1.25 * 0.9) * 0.89
    pcm = (np.clip(mix.T, -1, 1) * 32767).astype('<i2')
    with wave.open(out, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print('wrote', out, 'peak before limit', round(float(peak), 3), 'kicks', len(KICKS))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'score_long.wav')
