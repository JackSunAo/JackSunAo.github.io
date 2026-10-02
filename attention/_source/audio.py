"""Score for the 30 s Attention explainer: ambient pad + event sound design synced to the visuals.

Everything is synthesised (additive tones, filtered noise, convolution reverb) so the track
is deterministic and royalty-free. Output: 48 kHz stereo float WAV, normalised later with ffmpeg.
"""
import numpy as np
from scipy.signal import fftconvolve, butter, sosfiltfilt, sosfilt
import wave, sys

SR = 48000
DUR = 30.0
N = int(SR * DUR)
rng = np.random.default_rng(11)

dry = np.zeros((2, N))
send = np.zeros((2, N))  # reverb send bus


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def pan_gains(p):
    # equal-power pan, p in [-1, 1]
    a = (p + 1) * np.pi / 4
    return np.cos(a), np.sin(a)


def add(sig, t0, gain=1.0, pan=0.0, rev=0.25):
    i0 = int(round(t0 * SR))
    if i0 >= N:
        return
    if i0 < 0:
        sig = sig[-i0:]
        i0 = 0
    sig = sig[: N - i0]
    gl, gr = pan_gains(pan)
    dry[0, i0:i0 + len(sig)] += sig * gain * gl
    dry[1, i0:i0 + len(sig)] += sig * gain * gr
    send[0, i0:i0 + len(sig)] += sig * gain * gl * rev
    send[1, i0:i0 + len(sig)] += sig * gain * gr * rev


def env_adsr(n, a, d=0.0, s=1.0, r=0.0):
    e = np.ones(n) * s
    na, nd, nr = int(a * SR), int(d * SR), int(r * SR)
    if na:
        e[:na] = np.linspace(0, 1, na) ** 2
    if nd:
        e[na:na + nd] = np.linspace(1, s, nd)
    if nr:
        e[-nr:] *= np.linspace(1, 0, nr) ** 1.5
    return e


def lp(x, fc, order=2):
    sos = butter(order, fc / (SR / 2), btype='low', output='sos')
    return sosfiltfilt(sos, x)


def hp(x, fc, order=2):
    sos = butter(order, fc / (SR / 2), btype='high', output='sos')
    return sosfiltfilt(sos, x)


def bp(x, f1, f2, order=2):
    sos = butter(order, [f1 / (SR / 2), f2 / (SR / 2)], btype='band', output='sos')
    return sosfiltfilt(sos, x)


# ------------------------------------------------------------------ instruments
def pad_note(f, dur, bright=1.0, seed=0):
    """Warm additive pad voice: soft saw-like spectrum, two detuned layers, slow movement."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    r = np.random.default_rng(seed)
    out = np.zeros((2, n))
    fc = 1050 * bright
    for side, det in ((0, -3.5), (1, 3.5)):
        ff = f * 2 ** (det / 1200)
        k = 1
        layer = np.zeros(n)
        while k * ff < 7000 and k <= 24:
            amp = (1 / k ** 1.5) / (1 + (k * ff / fc) ** 2)
            vib = 0.0018 * np.sin(2 * np.pi * (0.13 + 0.05 * r.random()) * t + r.random() * 6.28)
            layer += amp * np.sin(2 * np.pi * k * ff * (t + vib / (2 * np.pi * 0.2)) + r.random() * 6.28)
            k += 1
        mov = 0.82 + 0.18 * np.sin(2 * np.pi * (0.07 + 0.04 * r.random()) * t + r.random() * 6.28)
        out[side] = layer * mov
    return out


def bell(f, dur=2.5, decay=1.1, glass=0.35, attack=0.004):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * t) * np.exp(-t / decay)
    s += 0.32 * np.sin(2 * np.pi * 2.0 * f * t) * np.exp(-t / (decay * 0.45))
    s += glass * 0.5 * np.sin(2 * np.pi * 2.76 * f * t) * np.exp(-t / (decay * 0.22))
    s += glass * 0.25 * np.sin(2 * np.pi * 5.4 * f * t) * np.exp(-t / (decay * 0.09))
    na = int(attack * SR)
    s[:na] *= np.linspace(0, 1, na)
    return s


def pluck(f, dur=2.0, decay=0.6):
    """Soft felt-like pluck: a few harmonics with faster decay at the top."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for k, a in ((1, 1.0), (2, 0.45), (3, 0.18), (4, 0.08)):
        s += a * np.sin(2 * np.pi * k * f * t) * np.exp(-t * k / decay)
    na = int(0.006 * SR)
    s[:na] *= np.linspace(0, 1, na) ** 2
    return s


def tick(f=1900, dur=0.09):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.014)
    s += 0.5 * np.sin(2 * np.pi * f * 1.63 * t) * np.exp(-t / 0.007)
    nz = rng.standard_normal(n) * np.exp(-t / 0.0018)
    s += 0.35 * hp(nz, 3000)
    na = int(0.0008 * SR)
    s[:na] *= np.linspace(0, 1, na)
    return s


def whoosh(dur, f_from, f_to, peak=0.5, q=0.6):
    """Filtered noise swell whose band glides from f_from to f_to; envelope peaks at `peak` (0..1)."""
    n = int(dur * SR)
    nz = rng.standard_normal(n)
    # time-varying band via block processing
    out = np.zeros(n)
    blk = 1024
    zi = None
    for b0 in range(0, n, blk):
        u = (b0 + blk / 2) / n
        fc = f_from * (f_to / f_from) ** u
        lo, hi = fc * (1 - q / 2), min(fc * (1 + q / 2), SR / 2 - 100)
        sos = butter(2, [lo / (SR / 2), hi / (SR / 2)], btype='band', output='sos')
        seg = nz[b0:b0 + blk]
        if zi is None:
            zi = np.zeros((sos.shape[0], 2))
        y, zi = sosfilt(sos, seg, zi=zi)
        out[b0:b0 + blk] = y
    u = np.linspace(0, 1, n)
    env = np.where(u < peak, (u / peak) ** 2, ((1 - u) / (1 - peak)) ** 1.6)
    return out * env


def thump(f0=95, f1=48, dur=0.6):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / 0.05)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t / 0.18) + 0.25 * np.sin(2 * ph) * np.exp(-t / 0.06)
    s += 0.12 * hp(rng.standard_normal(n), 1500) * np.exp(-t / 0.004)
    na = int(0.003 * SR)
    s[:na] *= np.linspace(0, 1, na)
    return np.tanh(1.4 * s) / np.tanh(1.4)


def glide(f0, f1, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    u = t / dur
    f = f0 * (f1 / f0) ** (u ** 1.2)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) + 0.25 * np.sin(2 * ph)
    env = np.sin(np.pi * u) ** 1.5
    return s * env


# ------------------------------------------------------------------ the pad (harmony)
D2, B1, G1, A1 = midi(38), midi(35), midi(31), midi(33)
CHORDS = [
    # start, end, notes (midi), brightness, gain
    (0.05, 7.6, [57, 62, 64], 0.65, 0.9),             # Dsus2 – restrained (title, RNN)
    (6.9, 13.9, [57, 62, 64, 66, 73], 1.05, 0.85),    # Dmaj9 – blooms with attention
    (13.2, 18.5, [57, 61, 62, 66, 71], 0.95, 0.85),   # Bm9 – the formula
    (17.75, 21.6, [55, 59, 62, 66, 69], 1.0, 0.85),   # Gmaj9 – many heads
    (20.95, 26.7, [57, 59, 64, 69, 71], 1.1, 0.85),   # Asus2 – the machine, results
    (26.05, 28.7, [55, 59, 62, 66, 71, 74], 1.15, 0.85),  # Gmaj9 lift – legacy
    (28.0, 30.0, [57, 62, 64, 66, 73, 78], 1.2, 0.95),     # Dmaj9 resolve – end card
]
SUBS = [(0.0, 7.6, D2), (6.9, 13.9, D2), (13.2, 18.5, B1), (17.75, 21.6, G1), (20.95, 26.7, A1), (26.05, 28.7, G1), (28.0, 30.0, D2)]

for ci, (a, b, notes, bright, g) in enumerate(CHORDS):
    dur = b - a
    for ni, m in enumerate(notes):
        v = pad_note(midi(m), dur, bright, seed=ci * 31 + ni)
        att = 1.6 if ci == 0 else 0.9
        rel = 1.2 if ci < len(CHORDS) - 1 else 0.6
        e = env_adsr(v.shape[1], att, 0, 1, rel)
        level = 0.03 * g * (0.85 if m > 70 else 1.0)
        i0 = int(a * SR)
        seg = hp(v, 140) * e * level
        seg = seg[:, : N - i0]
        dry[:, i0:i0 + seg.shape[1]] += seg
        send[:, i0:i0 + seg.shape[1]] += seg * 0.35

for a, b, f in SUBS:
    n = int((b - a) * SR)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * t) + 0.18 * np.sin(2 * np.pi * 2 * f * t) + 0.06 * np.sin(2 * np.pi * 3 * f * t)
    s *= env_adsr(n, 1.4, 0, 1, 1.2) * 0.022
    add(hp(s, 32), a, 1.0, 0.0, rev=0.05)

# ------------------------------------------------------------------ events (times follow scene.mjs)
TOK_CX = [413, 535, 677, 800, 897, 998, 1142, 1248, 1318, 1404, 1498]  # sentence x positions (design px)
panx = lambda x: np.clip((x - 960) / 960 * 1.25, -0.9, 0.9)

# opening: soft breath + low bloom as the focus dot appears
add(whoosh(1.2, 300, 1200, peak=0.55, q=0.9), 0.0, 0.05, 0.0, rev=0.6)
add(thump(80, 42, 1.6), 0.38, 0.24, 0.0, rev=0.25)
for k, m in enumerate([81, 86, 88]):  # title shimmer
    add(bell(midi(m), 3.0, 1.3, 0.25), 0.55 + k * 0.32, 0.046, (-0.3, 0.25, 0.0)[k], rev=0.85)
add(whoosh(0.9, 2500, 600, peak=0.4, q=0.8), 2.35, 0.03, 0.0, rev=0.5)  # title exits

# RNN: eleven sequential ticks travelling left → right
for i in range(11):
    t0 = 3.62 + i * 0.255
    add(tick(1850 + (i % 2) * 40), t0, 0.16 * (1 - 0.03 * i), panx(TOK_CX[i]), rev=0.18)
add(bell(midi(69), 2.5, 0.9, 0.2), 6.0, 0.03, 0.35, rev=0.8)  # the "?"

# parallel: every word lights at once – eleven glass notes, each panned to its word
PAR = [74, 78, 81, 85, 86, 88, 90, 93, 97, 98, 100]
for i, m in enumerate(PAR):
    add(bell(midi(m), 3.5, 1.6, 0.4, attack=0.006), 7.0 + 0.004 * i, 0.044, panx(TOK_CX[i]), rev=0.9)
add(thump(70, 40, 1.4), 6.98, 0.165, 0.0, rev=0.3)
add(whoosh(1.6, 1500, 6000, peak=0.6, q=0.7), 7.1, 0.025, 0.0, rev=0.8)  # lattice rising

# focus: arc lands on "animal", then on "street" after the swap
add(pluck(midi(62), 2.5, 0.8), 10.62, 0.14, panx(535), rev=0.45)
add(pluck(midi(69), 2.5, 0.8), 10.64, 0.08, panx(535), rev=0.45)
add(whoosh(0.8, 900, 2600, peak=0.5, q=0.7), 10.95, 0.04, panx(1498), rev=0.5)  # tired → wide
add(pluck(midi(66), 2.5, 0.8), 11.8, 0.14, panx(998), rev=0.45)
add(pluck(midi(73), 2.5, 0.8), 11.82, 0.08, panx(998), rev=0.45)

# tokens fly to the matrix; cells sparkle in
add(whoosh(1.3, 500, 3500, peak=0.5, q=0.8), 13.0, 0.05, 0.3, rev=0.6)
for d in range(21):
    add(tick(3200 + 60 * (d % 3), 0.05), 13.9 + d * 0.022, 0.034, 0.55, rev=0.35)
add(bell(midi(81), 2.5, 1.2, 0.3), 16.35, 0.044, 0.6, rev=0.8)  # Σ = 1

# multi-head: shrink, then eight plucks panned across the row of heads
add(whoosh(0.7, 2500, 700, peak=0.6, q=0.8), 17.8, 0.035, 0.4, rev=0.5)
HEAD_NOTES = [67, 71, 74, 78, 81, 83, 86, 90]
for h, m in enumerate(HEAD_NOTES):
    x = 960 - (8 * 132 + 7 * 34) / 2 + h * (132 + 34) + 66
    add(pluck(midi(m), 2.0, 0.55), 18.75 + abs(h - 3.5) * 0.03 + h * 0.012, 0.072, panx(x), rev=0.55)
add(whoosh(0.65, 700, 2600, peak=0.85, q=0.8), 20.0, 0.04, 0.0, rev=0.4)  # concat
add(thump(90, 45, 1.0), 21.1, 0.225, -0.15, rev=0.25)

# architecture assembles bottom-up, then a data pulse travels through it
for k in range(11):
    add(tick(2300 + 90 * (k % 4), 0.06), 21.0 + 0.04 * k, 0.047, -0.25 if k < 5 else 0.25, rev=0.3)
for k, m in enumerate([57, 64, 69, 71, 76, 81]):  # data pulse: an arpeggio that climbs with it
    add(bell(midi(m), 2.2, 0.9, 0.15, attack=0.01), 22.15 + k * 0.21, 0.05 if m < 70 else 0.04, -0.4 + k * 0.16, rev=0.6)
for tt, pp in ((22.4, -0.2), (22.6, 0.2), (22.85, 0.2)):
    add(bell(midi(76), 1.6, 0.6, 0.2), tt, 0.036, pp, rev=0.6)

# results: counters roll in on the right
add(whoosh(0.7, 1800, 600, peak=0.5, q=0.8), 23.45, 0.03, -0.3, rev=0.4)
for k in range(3):
    t0 = 23.78 + k * 0.2
    for j in range(1, 13):
        u = j / 12
        tt = t0 + 1.1 * (1 - (1 - u) ** 0.25)  # inverse of easeOutQuart
        add(tick(2600 + 120 * k, 0.04), tt, 0.0297 * (1 - 0.5 * u), 0.45, rev=0.25)
    add(bell(midi(79 + 2 * k), 2.0, 0.9, 0.25), t0 + 1.1, 0.036, 0.45, rev=0.7)

# legacy: everything collapses into one point, then the lineage unfolds
add(whoosh(0.6, 3000, 500, peak=0.85, q=0.8), 26.0, 0.04, -0.2, rev=0.5)
add(thump(85, 50, 0.9), 26.6, 0.135, -0.4, rev=0.3)
for k, m in enumerate([74, 76, 78, 81, 83, 86]):
    x = 300 + k * 264
    add(bell(midi(m), 3.0, 1.3, 0.3), 26.5 + k * 0.14, 0.058, panx(x), rev=0.8)

# end card: the dot travels home, final bloom
add(whoosh(0.7, 800, 2400, peak=0.7, q=0.8), 27.8, 0.03, -0.3, rev=0.5)
add(thump(75, 38, 1.8), 28.45, 0.225, 0.0, rev=0.35)
for k, m in enumerate([62, 69, 74, 78, 81, 86]):
    add(bell(midi(m), 3.0, 1.8, 0.2, attack=0.02), 28.12 + k * 0.05, 0.044 if m > 70 else 0.065, (-0.35, 0.35, -0.2, 0.2, -0.1, 0.1)[k], rev=0.8)

# ------------------------------------------------------------------ reverb (synthetic stereo IR)
def make_ir(rt60=2.4, length=3.2, seed=5):
    n = int(length * SR)
    t = np.arange(n) / SR
    r = np.random.default_rng(seed)
    ir = np.zeros((2, n))
    decay = np.exp(-6.91 * t / rt60)
    for ch in range(2):
        nz = r.standard_normal(n) * decay
        # darker tail: blend between bright and dark versions over time
        dark = lp(nz, 2500)
        bright = lp(nz, 9000)
        w = np.clip(t / 1.2, 0, 1)
        tail = bright * (1 - w) + dark * w
        # early reflections
        for _ in range(14):
            d = r.uniform(0.008, 0.07)
            tail[int(d * SR)] += r.uniform(-0.6, 0.6) * (1 - d * 8)
        pre = int(0.012 * SR)
        ir[ch, pre:] = tail[: n - pre]
    ir /= np.sqrt(np.sum(ir ** 2, axis=1, keepdims=True))
    return ir


ir = make_ir()
wet = np.stack([fftconvolve(send[0], ir[0])[:N], fftconvolve(send[1], ir[1])[:N]])
wet = hp(wet, 180)
mix = dry + 0.55 * wet

# tone: gentle tilt, remove rumble, tame the top
mix = hp(mix, 28)
mix = lp(mix, 14000)

# fade in/out
fade_in = int(0.15 * SR)
mix[:, :fade_in] *= np.linspace(0, 1, fade_in) ** 2
fo0 = int(29.25 * SR)
mix[:, fo0:] *= np.linspace(1, 0, N - fo0) ** 1.8

# soft limiting (headroom is fixed by loudnorm afterwards)
peak = np.max(np.abs(mix))
mix = mix / peak * 0.89
mix = np.tanh(mix * 1.15) / np.tanh(1.15)

out = sys.argv[1] if len(sys.argv) > 1 else 'score.wav'
pcm = (np.clip(mix.T, -1, 1) * 32767).astype('<i2')
with wave.open(out, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('wrote', out, 'peak before limit', round(float(peak), 3))
