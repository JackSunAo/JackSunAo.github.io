/* ===== P4 audio: a bank of physically modelled sounds, placed in space =====
   Sounds are synthesised once, when the game starts, into buffers with several variants each (no two footsteps or
   blows alike): wood by its vibration modes, creaks by stick-slip friction exciting them, glass as a crack and a fall of
   ringing shards, bodies as mass and cloth and wet, the infected as a glottis with jitter, fry and gurgle driving a
   vocal tract. Each is then placed in the world: binaural (HRTF) panning, falloff, air soaking up the highs with
   distance, walls muffling, and the space it is in (the cabin's dry wooden room or the wet forest) answering. */
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
/* The synthesis lives in one self-contained function so it can run in a worker (a growl or breaking glass takes tens
   of milliseconds to make: on the main thread that is a dropped frame) and, failing that, here. */
function AUDIO_LIB() {
/* ---------- offline DSP on Float32Arrays ---------- */
const DSP = {
  sr: 44100,
  buf(sec) { return new Float32Array(Math.max(1, Math.ceil(sec * this.sr))); },
  // RBJ biquad, run in place; f may be a function of the sample index for sweeps (coefficients refreshed every 32)
  biquad(x, type, f, q = 0.707, gainDb = 0, from = 0, to = x.length) {
    const sr = this.sr; let b0, b1, b2, a1, a2, x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    const coef = fr => {
      const w = 2 * Math.PI * Math.min(fr, sr * 0.45) / sr, cs = Math.cos(w), sn = Math.sin(w), al = sn / (2 * q), A = Math.pow(10, gainDb / 40);
      let c0, c1, c2, d0, d1, d2;
      if (type === 'lp') { c0 = (1 - cs) / 2; c1 = 1 - cs; c2 = c0; d0 = 1 + al; d1 = -2 * cs; d2 = 1 - al; }
      else if (type === 'hp') { c0 = (1 + cs) / 2; c1 = -(1 + cs); c2 = c0; d0 = 1 + al; d1 = -2 * cs; d2 = 1 - al; }
      else if (type === 'bp') { c0 = al; c1 = 0; c2 = -al; d0 = 1 + al; d1 = -2 * cs; d2 = 1 - al; }
      else { c0 = 1 + al * A; c1 = -2 * cs; c2 = 1 - al * A; d0 = 1 + al / A; d1 = -2 * cs; d2 = 1 - al / A; } // peaking
      b0 = c0 / d0; b1 = c1 / d0; b2 = c2 / d0; a1 = d1 / d0; a2 = d2 / d0;
    };
    const dyn = typeof f === 'function'; if (!dyn) coef(f);
    for (let i = from; i < to; i++) {
      if (dyn && (i - from) % 32 === 0) coef(f(i));
      const v = x[i], y = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = v; y2 = y1; y1 = y; x[i] = y;
    }
    return x;
  },
  noise(n, color = 'white') { const x = new Float32Array(n); let b = 0, p0 = 0, p1 = 0, p2 = 0;
    for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1;
      if (color === 'white') x[i] = w;
      else if (color === 'brown') { b = (b + 0.02 * w) / 1.02; x[i] = b * 3.5; }
      else { p0 = 0.99765 * p0 + w * 0.099046; p1 = 0.963 * p1 + w * 0.2965164; p2 = 0.57 * p2 + w * 1.0526913; x[i] = (p0 + p1 + p2 + w * 0.1848) * 0.2; } } // pink
    return x; },
  // damped sinusoids: the ring of something struck (modes: [Hz, decay seconds, amplitude])
  modal(x, at, modes, gain = 1) { const sr = this.sr;
    for (const [f, dec, a] of modes) { const k = Math.exp(-1 / (dec * sr)), w = 2 * Math.PI * f / sr, ph = Math.random() * 6.28; let e = a * gain;
      for (let i = at; i < x.length && e > 1e-4; i++) { x[i] += e * Math.sin(w * (i - at) + ph); e *= k; } }
    return x; },
  // excitation through a bank of resonances (a creak's wood, a door's panel)
  resonate(x, res) { const out = new Float32Array(x.length); for (const [f, q, g] of res) { const y = Float32Array.from(x); this.biquad(y, 'bp', f, q); for (let i = 0; i < y.length; i++) out[i] += y[i] * g; } return out; },
  env(x, a, d, from = 0, shape = 2) { const sr = this.sr, A = a * sr, D = d * sr; for (let i = 0; i < x.length; i++) { const t = i - from; let e = 0; if (t >= 0) e = t < A ? t / A : Math.pow(Math.max(0, 1 - (t - A) / D), shape); x[i] *= e; } return x; },
  add(x, y, at = 0, g = 1) { for (let i = 0; i < y.length && at + i < x.length; i++) if (at + i >= 0) x[at + i] += y[i] * g; return x; },
  shape(x, k, asym = 0) { const n = Math.tanh(k); for (let i = 0; i < x.length; i++) x[i] = Math.tanh(k * (x[i] + asym * x[i] * x[i])) / n; return x; },
  norm(x, peak = 0.9) { let m = 1e-9; for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i])); const k = peak / m; for (let i = 0; i < x.length; i++) x[i] *= k; return x; },
  fadeOut(x, sec) { const n = Math.min(x.length, Math.floor(sec * this.sr)); for (let i = 0; i < n; i++) x[x.length - 1 - i] *= i / n; return x; },
  // a burst of short sharp impulses (wood fibres going, bone, gravel)
  crackle(x, at, count, span, color, amp = 1) { const sr = this.sr;
    for (let c = 0; c < count; c++) { const t = at + Math.floor(Math.pow(Math.random(), 1.6) * span * sr), len = Math.floor(sr * (0.0006 + Math.random() * 0.003)), a = amp * (0.3 + Math.random()) * (1 - (t - at) / (span * sr + 1));
      for (let i = 0; i < len && t + i < x.length; i++) x[t + i] += (Math.random() * 2 - 1) * a * (1 - i / len); }
    if (color) this.biquad(x, 'bp', color[0], color[1], 0, at, Math.min(x.length, at + Math.floor(span * sr) + 2000));
    return x; },
  /* the infected's voice: a glottal pulse train with jitter, shimmer, fry and subharmonics, breath and gurgle, through a
     moving vocal tract (parallel formants), roughened by an asymmetric shaper. f0, vowel and level are functions of t */
  voice(dur, o) {
    const sr = this.sr, n = Math.floor(dur * sr), x = new Float32Array(n);
    let ph = 0, per = 0, alt = 1, jit = 1, last = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr, f0 = o.f0(t) * jit;
      ph += f0 / sr;
      if (ph >= 1) { ph -= 1; per++; jit = 1 + (Math.random() * 2 - 1) * o.jitter; alt = (per % 2 ? 1 - o.sub : 1) * (1 + (Math.random() * 2 - 1) * o.shimmer);
        if (o.fry && Math.random() < o.fry * 0.35) ph -= Math.random() * 0.8; } // a skipped, dragged period: the creak of a wrecked voice
      const p = ph, g = p < 0.55 ? 0.5 - 0.5 * Math.cos(Math.PI * p / 0.55) : p < 0.72 ? Math.cos(Math.PI * (p - 0.55) / 0.34) : 0;
      const d = g - last; last = g; // flow derivative: the buzz
      x[i] = (d * 18 * alt + (Math.random() * 2 - 1) * o.breath * (0.3 + g)) * o.level(t);
    }
    // vocal tract: formants move with the vowel
    const out = new Float32Array(n), F = o.formants;
    for (let k = 0; k < 4; k++) { const y = Float32Array.from(x); this.biquad(y, 'bp', i => F(i / sr)[k][0], F(0)[k][1]); const a = F(0)[k][2]; for (let i = 0; i < n; i++) out[i] += y[i] * a; }
    if (o.gurgle) for (let b = 0; b < dur * o.gurgle; b++) this.modal(out, Math.floor(Math.random() * n * 0.9), [[180 + Math.random() * 700, 0.012 + Math.random() * 0.02, 0.15 + Math.random() * 0.3]]); // blood in the throat
    if (o.harsh) this.shape(out, o.harsh, 0.25);
    return this.norm(out, 0.9);
  }
};
const VOW = { a: [[730, 7], [1090, 9], [2440, 10], [3300, 12]], o: [[570, 7], [840, 8], [2410, 10], [3200, 12]], u: [[300, 6], [870, 8], [2240, 10], [3100, 12]], e: [[530, 7], [1840, 10], [2480, 10], [3400, 12]], i: [[300, 6], [2290, 10], [3010, 12], [3600, 12]], ae: [[660, 7], [1720, 10], [2410, 10], [3300, 12]] };
// a vowel path for the tract: [[t, vowel], ...]; sc scales the tract (smaller = higher formants); amplitudes per formant
function tract(path, sc, amps = [1, 0.7, 0.35, 0.18]) {
  return t => { let a = path[0], b = path[path.length - 1]; for (let i = 0; i < path.length - 1; i++) if (t >= path[i][0] && t <= path[i + 1][0]) { a = path[i]; b = path[i + 1]; break; }
    const u = b[0] > a[0] ? Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0]))) : 0;
    return VOW[a[1]].map((fm, k) => [(fm[0] + (VOW[b[1]][k][0] - fm[0]) * u) * sc, fm[1], amps[k]]); };
}
const curve = pts => t => { if (t <= pts[0][0]) return pts[0][1]; for (let i = 0; i < pts.length - 1; i++) if (t <= pts[i + 1][0]) { const [t0, v0] = pts[i], [t1, v1] = pts[i + 1]; return v0 + (v1 - v0) * (t - t0) / (t1 - t0); } return pts[pts.length - 1][1]; };

/* ---------- the recipes: each returns one variant (mono Float32Array) ---------- */
const R1 = (a, b) => a + Math.random() * (b - a);
const RECIPES = {
  // footsteps: heel then toe; mud sucks, boards ring a little, the porch is hollow underneath
  step_mud() { const D = DSP, x = D.buf(0.32), th = D.noise(x.length, 'brown'); D.biquad(th, 'lp', 260); D.env(th, 0.004, 0.09); D.add(x, th, 0, 1.4);
    const suck = D.noise(D.sr * 0.18); D.biquad(suck, 'bp', i => 700 + i / D.sr * 9000, 2.2); D.env(suck, 0.03, 0.12); D.add(x, suck, Math.floor(D.sr * R1(0.03, 0.06)), 0.45);
    for (let b = 0; b < 3; b++) D.modal(x, Math.floor(D.sr * R1(0.04, 0.2)), [[R1(500, 1300), R1(0.01, 0.03), R1(0.08, 0.2)]]); // bubbles
    const toe = D.noise(D.sr * 0.06, 'brown'); D.biquad(toe, 'lp', 400); D.env(toe, 0.003, 0.05); D.add(x, toe, Math.floor(D.sr * R1(0.07, 0.11)), 0.6); return D.norm(x, 0.8); },
  step_wood() { const D = DSP, x = D.buf(0.35), hit = (at, g) => { const c = D.noise(Math.floor(D.sr * 0.012)); D.env(c, 0.0005, 0.011); D.add(x, c, at, g * 0.5);
      D.modal(x, at, [[R1(95, 130), 0.05, 0.9], [R1(210, 260), 0.035, 0.5], [R1(420, 520), 0.02, 0.3], [R1(900, 1300), 0.008, 0.2]], g); };
    hit(0, 1); hit(Math.floor(D.sr * R1(0.06, 0.1)), 0.55); D.biquad(x, 'lp', 3500); return D.norm(x, 0.85); },
  step_porch() { const D = DSP, x = D.buf(0.4), hit = (at, g) => { const c = D.noise(Math.floor(D.sr * 0.01)); D.env(c, 0.0005, 0.009); D.add(x, c, at, g * 0.4);
      D.modal(x, at, [[R1(70, 90), 0.12, 1], [R1(160, 190), 0.08, 0.6], [R1(330, 390), 0.04, 0.35]], g); };
    hit(0, 1); hit(Math.floor(D.sr * R1(0.06, 0.1)), 0.6); const wet = D.noise(Math.floor(D.sr * 0.08)); D.biquad(wet, 'hp', 2500); D.env(wet, 0.002, 0.07); D.add(x, wet, 0, 0.15); return D.norm(x, 0.85); },
  // stick-slip: friction catching and letting go, faster and slower, ringing the plank: a board creaking under weight
  creak() { const D = DSP, dur = R1(0.5, 0.95), x = D.buf(dur + 0.1), sr = D.sr, rate = curve([[0, R1(25, 45)], [dur * 0.4, R1(70, 140)], [dur, R1(30, 60)]]);
    let t = 0.01; while (t < dur) { const i = Math.floor(t * sr), a = Math.sin(Math.PI * t / dur) * (0.6 + Math.random() * 0.6); if (i < x.length) { x[i] += a; x[i + 1] -= a * 0.6; } t += 1 / rate(t) * (1 + (Math.random() - 0.5) * 0.25); }
    const y = D.resonate(x, [[R1(380, 520), 14, 1], [R1(800, 1100), 18, 0.7], [R1(1500, 1900), 20, 0.4], [R1(2600, 3200), 24, 0.2]]); D.biquad(y, 'hp', 150); return D.norm(y, 0.8); },
  // a door on its hinges: slower, longer, iron in it
  hinge() { const D = DSP, dur = R1(0.8, 1.3), x = D.buf(dur + 0.15), sr = D.sr, rate = curve([[0, 18], [dur * 0.3, R1(45, 70)], [dur * 0.75, R1(30, 50)], [dur, 15]]);
    let t = 0.02; while (t < dur) { const i = Math.floor(t * sr), a = Math.pow(Math.sin(Math.PI * t / dur), 0.6); x[i] += a; t += 1 / rate(t) * (1 + (Math.random() - 0.5) * 0.18); }
    const y = D.resonate(x, [[R1(650, 800), 30, 1], [R1(1300, 1600), 34, 0.8], [R1(2100, 2500), 30, 0.5], [R1(3400, 4000), 28, 0.25], [R1(160, 210), 8, 0.4]]); return D.norm(y, 0.8); },
  // a body against the door: the panel booms, the frame and latch rattle, dust
  door_bang() { const D = DSP, x = D.buf(0.9), th = D.noise(Math.floor(D.sr * 0.05), 'brown'); D.env(th, 0.001, 0.045); D.add(x, th, 0, 1.2);
    D.modal(x, 0, [[R1(55, 70), 0.28, 1], [R1(120, 150), 0.2, 0.6], [R1(230, 290), 0.12, 0.35], [R1(470, 560), 0.06, 0.2]]);
    for (let r = 0; r < 6; r++) D.modal(x, Math.floor(D.sr * (0.03 + r * R1(0.03, 0.06))), [[R1(1800, 3200), 0.015, R1(0.06, 0.14)], [R1(4200, 5600), 0.01, 0.05]]); // latch and hinges
    return D.norm(x, 0.9); },
  // wood giving way: a spray of cracks, fibres tearing, a deep knock and the board's last ring
  splinter() { const D = DSP, x = D.buf(1.0); D.crackle(x, 0, 90, 0.35, [1800, 0.8], 1.0); D.crackle(x, Math.floor(D.sr * 0.02), 40, 0.5, [600, 0.9], 0.6);
    D.modal(x, 0, [[R1(80, 110), 0.18, 1.2], [R1(190, 240), 0.12, 0.7], [R1(420, 520), 0.07, 0.4], [R1(950, 1200), 0.04, 0.25]]);
    const tear = D.noise(Math.floor(D.sr * 0.35)); D.biquad(tear, 'bp', 1400, 0.9); D.env(tear, 0.01, 0.3); D.add(x, tear, Math.floor(D.sr * 0.01), 0.35);
    for (let k = 0; k < 5; k++) { const at = Math.floor(D.sr * R1(0.25, 0.8)); D.modal(x, at, [[R1(300, 900), 0.05, R1(0.1, 0.25)], [R1(1200, 2200), 0.02, 0.08]]); } // bits landing
    return D.norm(x, 0.9); },
  // a pane: the crack, the sheet letting go, shards ringing as they fall and hit and hit again
  glass() { const D = DSP, x = D.buf(1.6), sr = D.sr; const crack = D.noise(Math.floor(sr * 0.03)); D.biquad(crack, 'hp', 1800); D.env(crack, 0.0003, 0.028); D.add(x, crack, 0, 1.2);
    D.modal(x, 0, [[R1(1100, 1500), 0.05, 0.35], [R1(2300, 2900), 0.04, 0.25]]);
    const shard = (at, g) => { const f = R1(2600, 9000); D.modal(x, at, [[f, R1(0.02, 0.12), g], [f * R1(1.4, 2.6), R1(0.01, 0.05), g * 0.5], [f * R1(2.8, 4.2), 0.008, g * 0.25]]); };
    for (let k = 0; k < 70; k++) shard(Math.floor(sr * Math.pow(Math.random(), 2) * 0.25), R1(0.04, 0.16));                  // the break
    for (let k = 0; k < 45; k++) { const t = R1(0.28, 0.6); shard(Math.floor(sr * t), R1(0.03, 0.12)); if (Math.random() < 0.5) shard(Math.floor(sr * (t + R1(0.08, 0.25))), R1(0.01, 0.05)); } // landing and bouncing
    const grit = D.noise(Math.floor(sr * 0.5)); D.biquad(grit, 'hp', 4500); D.env(grit, 0.02, 0.45); D.add(x, grit, Math.floor(sr * 0.25), 0.12);
    return D.norm(x, 0.9); },
  // an axe into a plank: the bite, the thunk of the wood, the steel ringing, the pull
  chop() { const D = DSP, x = D.buf(0.8), c = D.noise(Math.floor(D.sr * 0.008)); D.env(c, 0.0002, 0.007); D.add(x, c, 0, 1);
    D.modal(x, 0, [[R1(140, 180), 0.08, 1], [R1(320, 400), 0.05, 0.6], [R1(700, 900), 0.03, 0.4]]); D.modal(x, 0, [[R1(2100, 2600), 0.09, 0.12], [R1(5200, 6100), 0.05, 0.06]]);
    D.crackle(x, Math.floor(D.sr * 0.005), 25, 0.08, [2200, 1], 0.5);
    const pull = D.noise(Math.floor(D.sr * 0.2)); D.biquad(pull, 'bp', i => 1600 - i / D.sr * 2000, 4); D.env(pull, 0.03, 0.15); D.add(x, pull, Math.floor(D.sr * 0.4), 0.15); return D.norm(x, 0.9); },
  // a blunt blow on a body: the low thump of mass, cloth slapped, flesh, sometimes something in it giving
  hit_blunt() { const D = DSP, x = D.buf(0.4), sr = D.sr; const th = D.noise(Math.floor(sr * 0.06), 'brown'); D.biquad(th, 'lp', 200); D.env(th, 0.001, 0.055); D.add(x, th, 0, 2.2);
    D.modal(x, 0, [[R1(70, 100), 0.06, 0.8], [R1(140, 180), 0.04, 0.3]]);
    const cl = D.noise(Math.floor(sr * 0.02)); D.biquad(cl, 'bp', R1(1500, 2600), 1.2); D.env(cl, 0.0005, 0.018); D.add(x, cl, 0, 0.6);
    const fl = D.noise(Math.floor(sr * 0.05)); D.biquad(fl, 'bp', i => 1200 - i / sr * 12000, 1.4); D.env(fl, 0.001, 0.045); D.add(x, fl, Math.floor(sr * 0.002), 0.5);
    D.shape(x, 1.6); return D.norm(x, 0.95); },
  // a blade biting into a body: the edge, the wet tear, a lighter thump
  hit_blade() { const D = DSP, x = D.buf(0.45), sr = D.sr; const e = D.noise(Math.floor(sr * 0.02)); D.biquad(e, 'hp', 3200); D.env(e, 0.0003, 0.018); D.add(x, e, 0, 0.9);
    const tear = D.noise(Math.floor(sr * 0.16)); D.biquad(tear, 'bp', i => 2600 - i / sr * 9000, 1.6); D.env(tear, 0.003, 0.14); D.add(x, tear, Math.floor(sr * 0.004), 0.7);
    D.crackle(x, Math.floor(sr * 0.006), 20, 0.12, [1600, 1.2], 0.35);
    const th = D.noise(Math.floor(sr * 0.05), 'brown'); D.biquad(th, 'lp', 260); D.env(th, 0.001, 0.045); D.add(x, th, 0, 1.2);
    for (let b = 0; b < 4; b++) D.modal(x, Math.floor(sr * R1(0.03, 0.2)), [[R1(250, 700), R1(0.008, 0.02), R1(0.05, 0.12)]]); // wet
    return D.norm(x, 0.95); },
  bone() { const D = DSP, x = D.buf(0.25); D.crackle(x, 0, Math.floor(R1(6, 14)), 0.07, [R1(1800, 3200), 1.4], 1); D.modal(x, 0, [[R1(400, 700), 0.02, 0.4]]); return D.norm(x, 0.85); },
  kick() { const D = DSP, x = D.buf(0.35), th = D.noise(Math.floor(D.sr * 0.06), 'brown'); D.biquad(th, 'lp', 240); D.env(th, 0.001, 0.05); D.add(x, th, 0, 2);
    const sl = D.noise(Math.floor(D.sr * 0.03)); D.biquad(sl, 'bp', 900, 1); D.env(sl, 0.0005, 0.028); D.add(x, sl, 0, 0.7); D.modal(x, 0, [[R1(80, 110), 0.05, 0.6]]); return D.norm(x, 0.95); },
  body_fall() { const D = DSP, x = D.buf(0.8), sr = D.sr; const th = D.noise(Math.floor(sr * 0.12), 'brown'); D.biquad(th, 'lp', 180); D.env(th, 0.003, 0.11); D.add(x, th, 0, 2.5);
    D.modal(x, 0, [[R1(45, 65), 0.12, 0.9], [R1(95, 130), 0.07, 0.4]]);
    const cl = D.noise(Math.floor(sr * 0.1)); D.biquad(cl, 'bp', 1200, 0.9); D.env(cl, 0.005, 0.09); D.add(x, cl, 0, 0.35);
    const sp = D.noise(Math.floor(sr * 0.3)); D.biquad(sp, 'hp', 1800); D.env(sp, 0.004, 0.28); D.add(x, sp, Math.floor(sr * 0.01), 0.25); // the splash
    const b2 = D.noise(Math.floor(sr * 0.06), 'brown'); D.biquad(b2, 'lp', 220); D.env(b2, 0.003, 0.05); D.add(x, b2, Math.floor(sr * R1(0.14, 0.22)), 0.8); // settling
    return D.norm(x, 0.95); },
  thud() { const D = DSP, x = D.buf(0.5), th = D.noise(Math.floor(D.sr * 0.08), 'brown'); D.biquad(th, 'lp', 220); D.env(th, 0.002, 0.07); D.add(x, th, 0, 2); D.modal(x, 0, [[R1(55, 80), 0.1, 0.8]]); return D.norm(x, 0.9); },
  swing(heavy) { const D = DSP, dur = heavy ? 0.42 : 0.26, x = D.noise(Math.floor(D.sr * dur), 'pink'), sr = D.sr;
    D.biquad(x, 'bp', i => { const t = i / sr / dur; return (heavy ? 300 : 500) + Math.sin(Math.PI * t) * (heavy ? 1100 : 2000); }, 1.8);
    for (let i = 0; i < x.length; i++) { const t = i / x.length; x[i] *= Math.pow(Math.sin(Math.PI * Math.pow(t, 0.8)), 2); } return D.norm(x, 0.8); },
  swing_heavy() { return RECIPES.swing(true); }, swing_light() { return RECIPES.swing(false); },
  spurt() { const D = DSP, x = D.noise(Math.floor(D.sr * 0.22)); D.biquad(x, 'bp', i => 1500 - i / D.sr * 4000, 1.4); D.env(x, 0.01, 0.2); for (let b = 0; b < 5; b++) D.modal(x, Math.floor(D.sr * R1(0, 0.15)), [[R1(300, 600), 0.015, 0.2]]); return D.norm(x, 0.8); },
  drip() { const D = DSP, x = D.buf(0.18), f = R1(900, 1800); for (let i = 0; i < x.length; i++) { const t = i / D.sr; x[i] = Math.sin(2 * Math.PI * (f * t + f * 0.6 * t * t * 8)) * Math.exp(-t * 40); } return D.norm(x, 0.6); },
  hammer() { const D = DSP, x = D.buf(0.35); D.modal(x, 0, [[R1(1800, 2400), 0.03, 0.5], [R1(4200, 5000), 0.02, 0.25]]); D.modal(x, 0, [[R1(140, 180), 0.06, 0.9], [R1(330, 400), 0.04, 0.4]]); return D.norm(x, 0.9); },
  wood_drop() { const D = DSP, x = D.buf(0.5); for (let k = 0; k < 3; k++) D.modal(x, Math.floor(D.sr * k * R1(0.06, 0.11)), [[R1(180, 260), 0.06, 1 / (k + 1)], [R1(500, 700), 0.03, 0.5 / (k + 1)]]); return D.norm(x, 0.85); },
  bar_move() { const D = DSP, x = D.noise(Math.floor(D.sr * 0.45), 'pink'); D.biquad(x, 'bp', 420, 1.4); D.env(x, 0.03, 0.4); D.modal(x, Math.floor(D.sr * 0.32), [[R1(110, 140), 0.06, 1], [R1(260, 320), 0.04, 0.4]]); return D.norm(x, 0.85); },
  pry() { const D = DSP, dur = 0.5, x = D.buf(dur), sr = D.sr; let t = 0; while (t < dur) { x[Math.floor(t * sr)] += 1; t += 1 / (300 + 400 * Math.sin(Math.PI * t / dur)); }
    const y = D.resonate(x, [[R1(1700, 2100), 25, 1], [R1(3300, 3900), 25, 0.6], [R1(700, 900), 10, 0.4]]); return D.norm(y, 0.8); },
  scrape() { const D = DSP, x = D.noise(Math.floor(D.sr * 0.7)); D.biquad(x, 'bp', i => 2200 + i / D.sr * 800, 3); for (let i = 0; i < x.length; i++) x[i] *= 0.5 + 0.5 * Math.abs(Math.sin(i / D.sr * 31)); D.env(x, 0.06, 0.6); D.crackle(x, 0, 40, 0.65, [3000, 2], 0.25); return D.norm(x, 0.7); },
  thunder() { const D = DSP, dur = 6, x = D.noise(Math.floor(D.sr * dur), 'brown'), sr = D.sr; D.biquad(x, 'lp', 220);
    for (let i = 0; i < x.length; i++) { const t = i / sr; x[i] *= Math.exp(-t * 0.55) * (0.6 + 0.4 * Math.sin(t * 2.3 + Math.sin(t * 0.7) * 3)); }
    for (let k = 0; k < 6; k++) { const at = R1(0.2, 3.5), n = D.noise(Math.floor(sr * 0.6), 'brown'); D.biquad(n, 'lp', 300); D.env(n, 0.05, 0.5); D.add(x, n, Math.floor(at * sr), R1(0.4, 1)); }
    const crack = D.noise(Math.floor(sr * 0.25)); D.biquad(crack, 'hp', 1200); D.env(crack, 0.002, 0.22); D.add(x, crack, 0, 0.4); return D.norm(x, 0.95); },
  heartbeat() { const D = DSP, x = D.buf(0.5); [0, 0.22].forEach((d, k) => D.modal(x, Math.floor(D.sr * d), [[R1(48, 56), 0.06, k ? 0.6 : 1], [R1(90, 110), 0.03, 0.3]])); D.biquad(x, 'lp', 300); return D.norm(x, 0.9); },
  click_ui() { const D = DSP, x = D.buf(0.06); D.modal(x, 0, [[2200, 0.006, 0.6], [3300, 0.004, 0.3]]); D.modal(x, Math.floor(D.sr * 0.045), [[2600, 0.005, 0.4]]); return D.norm(x, 0.7); },
  whistle() { const D = DSP, x = D.buf(0.6), sr = D.sr; const f = curve([[0, 1850], [0.16, 2350], [0.22, 2350], [0.5, 1750]]), a = curve([[0, 0], [0.03, 1], [0.16, 0.8], [0.2, 0.2], [0.24, 1], [0.48, 0.6], [0.55, 0]]); let ph = 0;
    for (let i = 0; i < x.length; i++) { const t = i / sr; ph += f(t) / sr; x[i] = Math.sin(2 * Math.PI * ph) * a(t) + (Math.random() - 0.5) * 0.05 * a(t); } return D.norm(x, 0.7); },
  // a man's grunt / a struggle (the player)
  grunt() { const D = DSP, d = R1(0.18, 0.3); return D.voice(d, { f0: curve([[0, R1(110, 140)], [d, R1(80, 100)]]), jitter: 0.03, shimmer: 0.2, fry: 0.4, sub: 0.2, breath: 0.25, harsh: 0, level: curve([[0, 0], [0.02, 1], [d * 0.7, 0.8], [d, 0]]), formants: tract([[0, 'u'], [d, 'a']], 1) }); },
  cough() { const D = DSP, x = D.buf(0.9); for (let k = 0; k < 2; k++) { const b = D.noise(Math.floor(D.sr * 0.16)); D.biquad(b, 'bp', 900, 0.8); D.biquad(b, 'peaking', 1800, 1.5, 8); D.env(b, 0.004, 0.14); D.add(x, b, Math.floor(D.sr * k * R1(0.28, 0.4)), 1 - k * 0.3); } return D.norm(x, 0.8); },
  breath_in() { const D = DSP, x = D.noise(Math.floor(D.sr * 0.5), 'pink'); D.biquad(x, 'bp', 1600, 0.9); D.biquad(x, 'peaking', 3000, 2, 6); D.env(x, 0.15, 0.3, 0, 1); return D.norm(x, 0.5); },
  breath_out() { const D = DSP, x = D.noise(Math.floor(D.sr * 0.5), 'pink'); D.biquad(x, 'bp', 950, 0.8); D.env(x, 0.05, 0.4); return D.norm(x, 0.5); },
  baby_cry() { const D = DSP, d = 1.8; return D.voice(d, { f0: curve([[0, 400], [0.25, 560], [0.7, 430], [0.85, 380], [1.0, 410], [1.25, 580], [1.65, 450], [1.8, 400]]), jitter: 0.02, shimmer: 0.1, fry: 0.05, sub: 0, breath: 0.15, harsh: 1.2,
    level: curve([[0, 0], [0.06, 1], [0.7, 0.9], [0.82, 0], [0.95, 0], [1.02, 1], [1.7, 0.8], [1.8, 0]]), formants: tract([[0, 'ae'], [0.7, 'a'], [1, 'ae'], [1.8, 'a']], 1.55) }); },
  baby_coo() { const D = DSP, d = 0.45; return D.voice(d, { f0: curve([[0, 520], [0.2, 720], [0.45, 600]]), jitter: 0.01, shimmer: 0.05, fry: 0, sub: 0, breath: 0.25, harsh: 0, level: curve([[0, 0], [0.05, 1], [0.35, 0.7], [0.45, 0]]), formants: tract([[0, 'u'], [0.45, 'o']], 1.5) }); }
};
/* the infected's calls, for a man's or a woman's throat (sc: tract size, p: pitch). Each is a message (see ROAR) */
function infRecipe(kind, female) {
  const p = female ? 1.75 : 1, sc = female ? 1.16 : 0.92, D = DSP;
  const base = { jitter: 0.06, shimmer: 0.35, fry: 0.5, sub: 0.35, breath: 0.35, harsh: 2.4, gurgle: 6 };
  const V = (d, o) => D.voice(d, Object.assign({}, base, o));
  switch (kind) {
    case 'growl': { const d = R1(0.9, 1.5); return V(d, { f0: curve([[0, R1(70, 95) * p], [d * 0.5, R1(60, 85) * p], [d, R1(55, 75) * p]]), fry: 0.85, sub: 0.55, breath: 0.45, harsh: 2.0, gurgle: 14, level: curve([[0, 0], [0.12, 1], [d * 0.6, 0.85], [d, 0]]), formants: tract([[0, 'u'], [d * 0.5, 'o'], [d, 'u']], sc) }); }
    case 'shriek': { const d = R1(0.7, 0.95); return V(d, { f0: curve([[0, 260 * p], [0.16, R1(700, 950) * p], [d, 380 * p]]), fry: 0.15, sub: 0.15, breath: 0.5, harsh: 3.2, gurgle: 3, level: curve([[0, 0], [0.03, 1], [d * 0.7, 0.8], [d, 0]]), formants: tract([[0, 'a'], [0.2, 'ae'], [d, 'e']], sc * 1.05) }); }
    case 'spot': { const d = 1.1; return V(d, { f0: curve([[0, 160 * p], [0.28, R1(560, 680) * p], [d, 330 * p]]), level: curve([[0, 0], [0.08, 1], [0.8, 0.8], [d, 0]]), formants: tract([[0, 'o'], [0.3, 'a'], [d, 'ae']], sc) }); }
    case 'flank': { const x = D.buf(0.95); for (let k = 0; k < 3; k++) D.add(x, V(0.2, { f0: curve([[0, 130 * p], [0.07, 210 * p], [0.2, 110 * p]]), fry: 0.7, harsh: 1.6, level: curve([[0, 0], [0.02, 1], [0.2, 0]]), formants: tract([[0, 'o'], [0.2, 'u']], sc) }), Math.floor(D.sr * k * 0.26), 0.9); return D.norm(x, 0.9); }
    case 'wail': { const d = 1.9; return V(d, { f0: curve([[0, 420 * p], [0.35, 480 * p], [1.7, 150 * p], [d, 130 * p]]), fry: 0.25, sub: 0.2, harsh: 1.6, gurgle: 4, level: curve([[0, 0], [0.15, 1], [1.4, 0.7], [d, 0]]), formants: tract([[0, 'a'], [0.8, 'o'], [d, 'u']], sc) }); }
    case 'rally': { const d = 2.2; return V(d, { f0: curve([[0, 150 * p], [0.9, 520 * p], [1.7, 470 * p], [d, 300 * p]]), fry: 0.2, sub: 0.3, harsh: 2.0, level: curve([[0, 0], [0.3, 0.8], [0.9, 1], [1.9, 0.8], [d, 0]]), formants: tract([[0, 'u'], [0.9, 'o'], [1.6, 'a'], [d, 'o']], sc) }); }
    case 'retreat': { const d = 0.95, x = D.noise(Math.floor(D.sr * d)); D.biquad(x, 'bp', i => 3200 - i / D.sr * 2200, 1.2); D.env(x, 0.05, 0.85); D.add(x, V(d, { f0: curve([[0, 320 * p], [d, 120 * p]]), breath: 0.8, harsh: 1.2, level: curve([[0, 0], [0.1, 0.5], [d, 0]]), formants: tract([[0, 'e'], [d, 'u']], sc) }), 0, 0.6); return D.norm(x, 0.85); }
    case 'help': { const x = D.buf(1.2); for (let k = 0; k < 3; k++) D.add(x, V(0.3, { f0: curve([[0, 300 * p], [0.1, R1(600, 750) * p], [0.3, 350 * p]]), harsh: 3, level: curve([[0, 0], [0.03, 1], [0.3, 0]]), formants: tract([[0, 'a'], [0.3, 'ae']], sc) }), Math.floor(D.sr * k * 0.36), 0.9); return D.norm(x, 0.9); }
    case 'exhale': { const d = R1(0.25, 0.4); return V(d, { f0: curve([[0, 120 * p], [d, 80 * p]]), fry: 0.9, sub: 0.5, breath: 1.1, harsh: 0.8, gurgle: 10, level: curve([[0, 0], [0.02, 1], [d, 0]]), formants: tract([[0, 'a'], [d, 'u']], sc) }); }
    case 'clicks': { const x = D.buf(0.8), n = 3 + Math.floor(Math.random() * 3); let t = 0; for (let k = 0; k < n; k++) { D.modal(x, Math.floor(D.sr * t), [[R1(1500, 2500), 0.006, 1], [R1(3500, 4500), 0.004, 0.4]]); t += R1(0.08, 0.15) + (k === n - 2 ? 0.12 : 0); } return D.norm(x, 0.8); }
  }
}
// a human call (the defenders, you): one word's worth of vowel on a voiced source
function shoutRecipe(v) { const D = DSP, d = R1(0.24, 0.4), f0 = 150 * v * R1(0.92, 1.1), sc = v > 1.2 ? 1.15 : 1;
  const vw = [['a', 'o'], ['e', 'a'], ['o', 'a'], ['a', 'e']][Math.floor(Math.random() * 4)];
  return D.voice(d, { f0: curve([[0, f0], [d * 0.3, f0 * 1.25], [d, f0 * 0.85]]), jitter: 0.015, shimmer: 0.08, fry: 0.05, sub: 0, breath: 0.15, harsh: 0.9, level: curve([[0, 0], [0.03, 1], [d * 0.7, 0.85], [d, 0]]), formants: tract([[0, vw[0]], [d, vw[1]]], sc) }); }
return { DSP, RECIPES, infRecipe, shoutRecipe };
}
const AUD = AUDIO_LIB(), DSP = AUD.DSP;
function audioJob(L, kind, a) { return kind === 'r' ? L.RECIPES[a]() : kind === 'i' ? L.infRecipe(a[0], a[1]) : L.shoutRecipe(a); }

/* ---------- impulse responses for the two places sound lives ---------- */
function makeIR(ctx, kind) {
  const sr = ctx.sampleRate, cabin = kind === 'cabin', rt = cabin ? 0.5 : 1.5, len = Math.floor(sr * rt * 1.2), b = ctx.createBuffer(2, len, sr);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c), pre = Math.floor(sr * (cabin ? 0.002 : 0.012));
    let lp = 0;
    for (let i = pre; i < len; i++) { const t = (i - pre) / sr, decay = Math.exp(-6.9 * t / rt), w = Math.random() * 2 - 1, k = cabin ? 0.35 - 0.3 * Math.min(1, t / rt) : 0.25 - 0.22 * Math.min(1, t / rt); lp += (w - lp) * Math.max(0.02, k); d[i] = lp * decay; } // darker as it dies
    const taps = cabin ? 14 : 22; // early reflections: walls close by, or tree trunks scattered off in the dark
    for (let k = 0; k < taps; k++) { const t = cabin ? 0.003 + Math.random() * 0.03 : 0.02 + Math.random() * 0.16, i = Math.floor(t * sr); if (i < len) d[i] += (Math.random() < 0.5 ? -1 : 1) * (cabin ? 0.6 : 0.35) * Math.exp(-t * (cabin ? 30 : 8)); }
  }
  return b;
}

const SND = {
  ctx: null, ready: false, listener: { pos: new V3(), right: new V3(1, 0, 0), indoor: false },
  humGain: 0, humDegrade: 0, tension: 0, rainLevel: 1, exertion: 0, adr: 0, nextBreath: 0, nextBeat: 0,
  bank: {}, queue: [], voices: [], MAX_VOICES: 28,
  init() {
    if (this.ready) return;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = this.ctx = new AC(); DSP.sr = ctx.sampleRate;
    this.master = ctx.createGain(); this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.25;
    this.master.connect(comp); comp.connect(ctx.destination);
    // the two rooms: the cabin (close, dry, wooden) and outside (wet, wide, trees)
    this.verbIn = ctx.createConvolver(); this.verbIn.buffer = makeIR(ctx, 'cabin');
    this.verbOut = ctx.createConvolver(); this.verbOut.buffer = makeIR(ctx, 'forest');
    const vi = this.gain(0.8), vo = this.gain(0.75); this.verbIn.connect(vi); vi.connect(this.master); this.verbOut.connect(vo); vo.connect(this.master);
    this.verb = this.verbOut; // music and the hum use the open air
    this.noiseBuf = this.makeNoise(5);
    this.music = ctx.createGain(); this.music.gain.value = 0.45; this.music.connect(this.master);
    const mSend = ctx.createGain(); mSend.gain.value = 0.55; this.music.connect(mSend); mSend.connect(this.verbOut);
    this.sfx = ctx.createGain(); this.sfx.gain.value = 1; this.sfx.connect(this.master);
    this.amb = ctx.createGain(); this.amb.gain.value = 1; this.amb.connect(this.master);
    this.l = ctx.listener;
    this.startRain(); this.startWind(); this.startMusic(); this.startHum(); this.startBuzz();
    this.planBank();
    this.ready = true;
  },
  setMuted(m) { if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.1); },
  /* ---- the bank: built a few variants at a time, in the gaps between frames ---- */
  planBank() {
    const Q = (name, n, job) => { for (let i = 0; i < n; i++) this.queue.push([name, ...job]); };
    Q('step_mud', 6, ['r', 'step_mud']); Q('step_wood', 6, ['r', 'step_wood']); Q('step_porch', 5, ['r', 'step_porch']);
    Q('hit_blunt', 6, ['r', 'hit_blunt']); Q('hit_blade', 6, ['r', 'hit_blade']); Q('bone', 6, ['r', 'bone']); Q('swing_light', 4, ['r', 'swing_light']); Q('swing_heavy', 4, ['r', 'swing_heavy']);
    for (const f of [false, true]) { const g = f ? 'F' : 'M'; Q('growl' + g, 5, ['i', ['growl', f]]); Q('shriek' + g, 3, ['i', ['shriek', f]]); Q('clicks' + g, 3, ['i', ['clicks', f]]); Q('exhale' + g, 4, ['i', ['exhale', f]]); }
    Q('kick', 4, ['r', 'kick']); Q('thud', 4, ['r', 'thud']); Q('body_fall', 4, ['r', 'body_fall']); Q('creak', 5, ['r', 'creak']); Q('hinge', 3, ['r', 'hinge']); Q('door_bang', 4, ['r', 'door_bang']); Q('splinter', 4, ['r', 'splinter']);
    Q('glass', 3, ['r', 'glass']); Q('chop', 4, ['r', 'chop']); Q('grunt', 4, ['r', 'grunt']); Q('cough', 2, ['r', 'cough']);
    for (const f of [false, true]) { const g = f ? 'F' : 'M'; for (const k of ['spot', 'flank', 'wail', 'rally', 'retreat', 'help']) Q(k + g, 2, ['i', [k, f]]); }
    for (const v of [0.85, 1.05, 1.45]) Q('shout' + v, 3, ['s', v]);
    Q('spurt', 3, ['r', 'spurt']); Q('drip', 4, ['r', 'drip']); Q('hammer', 3, ['r', 'hammer']); Q('wood_drop', 3, ['r', 'wood_drop']); Q('bar_move', 2, ['r', 'bar_move']); Q('pry', 3, ['r', 'pry']); Q('scrape', 3, ['r', 'scrape']);
    Q('thunder', 3, ['r', 'thunder']); Q('heartbeat', 2, ['r', 'heartbeat']); Q('click_ui', 1, ['r', 'click_ui']); Q('whistle', 1, ['r', 'whistle']); Q('breath_in', 3, ['r', 'breath_in']); Q('breath_out', 3, ['r', 'breath_out']);
    Q('baby_cry', 3, ['r', 'baby_cry']); Q('baby_coo', 2, ['r', 'baby_coo']);
    this.startWorker();
  },
  startWorker() { // hand the whole queue to a worker; buffers come back one by one. No worker: bake() makes them here
    try {
      const src = 'const L = (' + AUDIO_LIB.toString() + ')(); const job = ' + audioJob.toString() + ';\n' +
        'onmessage = e => { L.DSP.sr = e.data.sr; for (const [name, k, a] of e.data.jobs) { const d = job(L, k, a); postMessage({ name, d }, [d.buffer]); } postMessage({ done: 1 }); };';
      const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' })), w = new Worker(url);
      w.onmessage = e => { if (e.data.done) { w.terminate(); URL.revokeObjectURL(url); this.worker = null; return; } this.addBuf(e.data.name, e.data.d); };
      w.onerror = () => { this.worker = null; this.queue = this.sent || []; }; // fall back to baking here
      this.sent = this.queue; this.queue = []; this.worker = w;
      w.postMessage({ sr: this.ctx.sampleRate, jobs: this.sent });
    } catch (e) { this.worker = null; }
  },
  addBuf(name, data) { const b = this.ctx.createBuffer(1, data.length, this.ctx.sampleRate);
    b.copyToChannel ? b.copyToChannel(data, 0) : b.getChannelData(0).set(data);
    (this.bank[name] = this.bank[name] || []).push(b); },
  bake(budgetMs) { // the fallback: make sounds on this thread until the frame's slice is spent
    const t0 = performance.now();
    while (this.queue.length && performance.now() - t0 < budgetMs) { const [name, k, a] = this.queue.shift(); this.addBuf(name, audioJob(AUD, k, a)); }
  },
  pick(name) { const L = this.bank[name]; if (!L || !L.length) return null; let i = Math.floor(Math.random() * L.length); if (L.length > 1 && i === L.last) i = (i + 1) % L.length; L.last = i; return L[i]; },
  /* ---- placing a sound in the world ---- */
  // pos null: in your own head (UI, your breathing, heartbeat). opts: vol, rate, rev (extra room), near (min distance), lp
  play(name, pos, vol = 1, opts = {}) {
    if (!this.ready) return null; const b = this.pick(name); if (!b) return null;
    const ctx = this.ctx, t = ctx.currentTime + (opts.delay || 0), L = this.listener;
    // too many at once: the quietest old one gives way
    this.voices = this.voices.filter(v => v.end > ctx.currentTime);
    if (this.voices.length >= this.MAX_VOICES) { this.voices.sort((a, c) => a.lvl - c.lvl); const v = this.voices.shift(); try { v.src.stop(); } catch (e) {} }
    const src = ctx.createBufferSource(); src.buffer = b; src.playbackRate.value = (opts.rate || 1) * (1 + (Math.random() - 0.5) * (opts.vary ?? 0.08));
    const g = this.gain(vol); src.connect(g);
    let lvl = vol, out = g;
    if (pos) {
      const dx = pos.x - L.pos.x, dz = pos.z - L.pos.z, dy = (pos.y || 0) - (L.pos.y || 0), d = Math.max(opts.near || 0.6, Math.hypot(dx, dz, dy * 0.5));
      // falloff, and the air soaking up the top end with distance (rain and wet leaves more than dry air)
      const fall = 2 / (2 + Math.max(0, d - 1.5)); g.gain.value = vol * fall; lvl *= fall;
      let cut = 20000 / (1 + d / 7);
      const sIn = insideCabin(pos.x, pos.z), wall = sIn !== L.indoor, gap = door.ang > 0.3 || door.fallen ? 0.45 : 1;
      if (wall) { cut = Math.min(cut, 650 + (1 - gap) * 2500); g.gain.value *= 0.45 + (1 - gap) * 0.35; } // through the walls, muffled; an open door lets more in
      if (opts.lp) cut = Math.min(cut, opts.lp);
      const lp = this.filt('lowpass', cut, 0.6); g.connect(lp);
      const pan = ctx.createPanner(); pan.panningModel = 'HRTF'; pan.distanceModel = 'linear'; pan.rolloffFactor = 0; pan.refDistance = 1;
      if (pan.positionX) { pan.positionX.value = pos.x; pan.positionY.value = (pos.y || 0) + 1.0; pan.positionZ.value = pos.z; } else pan.setPosition(pos.x, (pos.y || 0) + 1.0, pos.z);
      lp.connect(pan); pan.connect(this.sfx); out = pan;
      // the room answers more the further away it is: close sounds are dry, far ones mostly room
      const wet = Math.min(0.85, (opts.rev ?? 0.25) + d / 26), send = this.gain(wet * vol * fall * (wall ? 0.6 : 1) * 1.4);
      lp.connect(send); send.connect(sIn ? this.verbIn : this.verbOut);
    } else { g.connect(this.sfx); const send = this.gain((opts.rev ?? 0.1) * vol); g.connect(send); send.connect(L.indoor ? this.verbIn : this.verbOut); }
    src.start(t); const end = t + b.duration / src.playbackRate.value;
    if (opts.dur && opts.dur < b.duration) { g.gain.setValueAtTime(g.gain.value, t + opts.dur * 0.8); g.gain.linearRampToValueAtTime(0.0001, t + opts.dur); src.stop(t + opts.dur + 0.05); }
    this.voices.push({ src, end, lvl });
    return src;
  },
  // which throat: a woman's voice parameter runs high
  vk(v) { return (v || 1) >= 1.15 ? 'F' : 'M'; },
  vrate(v) { v = v || 1; return v >= 1.15 ? v / 1.4 : v; }, // within a voice class, the pitch still follows the person
  makeNoise(sec) {
    const ctx = this.ctx, b = ctx.createBuffer(2, ctx.sampleRate * sec, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); let p = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; p = 0.97 * p + 0.03 * w; d[i] = w * 0.6 + p * 2.2; } }
    return b;
  },
  noise(t0, dur, loop = true) { const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = loop; s.start(t0, Math.random() * 4); if (dur) s.stop(t0 + dur); return s; },
  osc(type, f, t0, t1) { const o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t0); o.start(t0); if (t1) o.stop(t1); return o; },
  filt(type, f, q = 0.7) { const b = this.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; },
  gain(v = 0) { const g = this.ctx.createGain(); g.gain.value = v; return g; },
  env(g, t0, a, peak, d) { g.gain.cancelScheduledValues(t0); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d); },
  chain(...n) { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; },
  out(pos, vol = 1, rev = 0.3) { // for the few live-synthesised sounds left (the fluorescent buzz): same placement rules, simpler
    const g = this.gain(vol), lp = this.filt('lowpass', 18000);
    if (pos) { const L = this.listener, d = Math.hypot(pos.x - L.pos.x, pos.z - L.pos.z); g.gain.value = vol * 2 / (2 + Math.max(0, d - 1.5)); lp.frequency.value = 20000 / (1 + d / 7); if (insideCabin(pos.x, pos.z) !== L.indoor) lp.frequency.value = 700; }
    g.connect(lp); lp.connect(this.sfx); const s = this.gain(rev); lp.connect(s); s.connect(this.verbOut); return g;
  },
  /* ---- ambience: rain as a wash plus drops close by on what they fall on; wind in gusts, whistling through the gaps ---- */
  startRain() {
    const t = this.ctx.currentTime;
    const n1 = this.noise(t), hp = this.filt('highpass', 400), lp = this.filt('lowpass', 7000);
    this.rainOut = this.gain(0); this.chain(n1, hp, lp, this.rainOut, this.amb);
    const n2 = this.noise(t), lp2 = this.filt('lowpass', 650), pk = this.filt('peaking', 180, 1.2); pk.gain.value = 7;
    this.rainIn = this.gain(0); this.chain(n2, lp2, pk, this.rainIn, this.amb); // the roof drumming over you
    const s = this.gain(0.2); this.rainOut.connect(s); s.connect(this.verbOut);
    this.nextDrop = 0;
  },
  drop(t) { // one drop near you: a leaf tick, a puddle plink, a board knock (on the roof if you are inside)
    const L = this.listener, a = Math.random() * 6.28, r = 1 + Math.random() * 7, p = new V3(L.pos.x + Math.cos(a) * r, 0, L.pos.z + Math.sin(a) * r);
    const ctx = this.ctx, k = Math.random(), o = this.gain(0), lp = this.filt(L.indoor ? 'lowpass' : 'bandpass', L.indoor ? 900 : 2500 + k * 4000, L.indoor ? 0.7 : 2);
    const pan = ctx.createStereoPanner(); pan.pan.value = Math.max(-1, Math.min(1, ((p.x - L.pos.x) * L.right.x + (p.z - L.pos.z) * L.right.z) / r));
    const f = L.indoor ? 140 + Math.random() * 120 : k < 0.5 ? 1200 + Math.random() * 1800 : 2600 + Math.random() * 3000;
    const s = this.osc('sine', f, t, t + 0.05); if (!L.indoor && k < 0.5) s.frequency.exponentialRampToValueAtTime(f * 1.6, t + 0.04);
    this.env(o, t, 0.001, (L.indoor ? 0.05 : 0.025) * this.rainLevel / (1 + r * 0.3), L.indoor ? 0.05 : 0.03); this.chain(s, lp, o, pan, this.amb);
  },
  startWind() {
    const t = this.ctx.currentTime, n = this.noise(t), bp = this.filt('bandpass', 380, 0.6);
    this.wind = this.gain(0.0); this.chain(n, bp, this.wind, this.amb);
    const lfo = this.osc('sine', 0.07, t), lg = this.gain(0.05); lfo.connect(lg); lg.connect(this.wind.gain);
    const lfo2 = this.osc('sine', 0.11, t), lg2 = this.gain(160); lfo2.connect(lg2); lg2.connect(bp.frequency);
    // gaps in the boards whistle when a gust pushes through
    const n2 = this.noise(t), w1 = this.filt('bandpass', 1240, 28), w2 = this.filt('bandpass', 1870, 32); this.whistleG = this.gain(0); n2.connect(w1); n2.connect(w2); w1.connect(this.whistleG); w2.connect(this.whistleG); this.whistleG.connect(this.amb);
    const lfo3 = this.osc('sine', 0.05, t), lg3 = this.gain(30); lfo3.connect(lg3); lg3.connect(w1.frequency); lg3.connect(w2.frequency);
  },
  startBuzz() {
    const t = this.ctx.currentTime, o = this.osc('sawtooth', 120, t), bp = this.filt('bandpass', 240, 3);
    this.buzz = this.gain(0); this.chain(o, bp, this.buzz);
    this.buzzOut = this.out(new V3(3.3, 2.5, 5.5), 1, 0.1); this.buzz.connect(this.buzzOut);
  },
  /* ---- music: drone pad + sparse piano + tension pulse ---- */
  startMusic() {
    this.chords = [[50, 53, 57, 62], [46, 53, 58, 62], [43, 50, 55, 58], [45, 52, 57, 61]];
    this.chordIdx = 0; this.nextChord = this.ctx.currentTime + 0.5; this.nextNote = this.ctx.currentTime + 4; this.nextPulse = 0;
    this.pianoScale = [74, 77, 79, 81, 84, 86, 72, 69];
    this.tensionGain = this.gain(0); this.tensionGain.connect(this.music);
    const t = this.ctx.currentTime, hi = this.osc('sine', mtof(87), t), trem = this.osc('sine', 6.5, t), tg = this.gain(0.5);
    const hg = this.gain(0.0); trem.connect(tg); tg.connect(hg.gain); this.chain(hi, hg, this.tensionGain);
    this.hiTone = hg;
  },
  pad(notes, t0, dur) {
    const lp = this.filt('lowpass', 520, 0.6), g = this.gain(0); this.chain(lp, g, this.music);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.055, t0 + 3.2); g.gain.setValueAtTime(0.055, t0 + dur - 3); g.gain.linearRampToValueAtTime(0.0001, t0 + dur + 1.5);
    notes.forEach(m => [-6, 6].forEach(cents => { const o = this.osc('sawtooth', mtof(m), t0, t0 + dur + 1.6); o.detune.value = cents; o.connect(lp); }));
    const sub = this.osc('sine', mtof(notes[0] - 12), t0, t0 + dur + 1.6), sg = this.gain(0.6); this.chain(sub, sg, lp);
  },
  piano(m, t0, vol = 0.07) {
    const g = this.gain(0), lp = this.filt('lowpass', 2600); this.chain(lp, g, this.music);
    this.env(g, t0, 0.006, vol, 3.2);
    [['triangle', 1, 1], ['sine', 2, 0.35], ['sine', 3, 0.12]].forEach(([ty, mul, v]) => { const o = this.osc(ty, mtof(m) * mul, t0, t0 + 3.4); const og = this.gain(v); this.chain(o, og, lp); });
  },
  pulse(t0, vol) {
    const o = this.osc('sine', 62, t0, t0 + 0.35); o.frequency.exponentialRampToValueAtTime(38, t0 + 0.3);
    const g = this.gain(0); this.env(g, t0, 0.01, vol, 0.3); this.chain(o, g, this.tensionGain);
  },
  /* ---- lullaby hum (the mother) ---- */
  startHum() {
    const t = this.ctx.currentTime;
    this.humOut = this.gain(0); this.humOut.connect(this.music);
    const s = this.gain(0.4); this.humOut.connect(s); s.connect(this.verbIn);
    this.humNotes = [[69, 1], [74, 1], [72, 1], [69, 2], [65, 1], [67, 1], [69, 1], [65, 1], [62, 3], [65, 1], [67, 1], [69, 1], [72, 2], [69, 1], [67, 1], [65, 1], [64, 1], [62, 3], [0, 2]];
    this.humIdx = 0; this.nextHum = t + 1; this.humDrift = 0; this.humSkip = 0;
  },
  humNote(m, t0, dur) {
    const deg = this.humDegrade;
    this.humDrift = clamp(this.humDrift + (Math.random() - 0.5) * deg * 70, -deg * 90, deg * 90);
    const f = mtof(m - 12) * Math.pow(2, this.humDrift / 1200);
    const o = this.osc('triangle', f, t0, t0 + dur + 0.3), o2 = this.osc('sine', f * 2, t0, t0 + dur + 0.3);
    const vib = this.osc('sine', 5 + deg * 3, t0, t0 + dur + 0.3), vg = this.gain(f * (0.004 + deg * 0.02)); vib.connect(vg); vg.connect(o.frequency); vg.connect(o2.frequency);
    const f1 = this.filt('bandpass', 420, 1.4), f2 = this.filt('peaking', 950, 2); f2.gain.value = 5;
    const g = this.gain(0), g2 = this.gain(0.25);
    o.connect(f1); o2.connect(g2); g2.connect(f1); this.chain(f1, f2, g, this.humOut);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.32, t0 + 0.09); g.gain.setValueAtTime(0.3, t0 + dur * 0.75); g.gain.linearRampToValueAtTime(0.0001, t0 + dur + 0.25);
  },
  /* ---- the game's sounds, by what happened ---- */
  step(pos, surface, vol = 0.5) {
    const s = surface === 'mud' ? 'step_mud' : surface === 'porch' ? 'step_porch' : 'step_wood';
    this.play(s, pos, vol * 1.1, { rev: 0.08, vary: 0.12 });
    if (surface !== 'mud' && Math.random() < (surface === 'porch' ? 0.22 : 0.12)) this.play('creak', pos, vol * 0.35, { delay: 0.04, rev: 0.15, rate: 0.9 + Math.random() * 0.3 }); // the old boards answer
  },
  swing(pos, heavy) { this.play(heavy ? 'swing_heavy' : 'swing_light', pos, heavy ? 0.7 : 0.5, { rev: 0.05 }); },
  hit(pos, heavy) { this.play('hit_blunt', pos, heavy ? 1.1 : 0.85, { rev: 0.15 }); if (heavy) this.play('bone', pos, 0.4, { delay: 0.008 }); },
  thud(pos) { this.play('thud', pos, 0.9, { rev: 0.18 }); },
  growl(pos, vol = 0.6, dur = 1.1, v = 1) { this.play('growl' + this.vk(v), pos, vol * 1.15, { dur, rate: this.vrate(v), rev: 0.3 }); },
  shriek(pos, vol = 0.7, v = 1) { this.play('shriek' + this.vk(v), pos, vol * 1.1, { rate: this.vrate(v), rev: 0.4 }); },
  clicks(pos, count = 4, v = 1) { this.play('clicks' + this.vk(v), pos, 0.6, { rev: 0.35, dur: 0.18 * count + 0.2 }); },
  thunder(delay, power) { this.play('thunder', null, 0.9 * power, { delay, rev: 0.55, vary: 0.15 }); },
  click() { this.play('click_ui', null, 0.35, { rev: 0 }); },
  drip(pos) { this.play('drip', pos, 0.35, { rev: 0.4 }); },
  heartbeat(vol = 0.6) { this.play('heartbeat', null, vol, { rev: 0, vary: 0.02 }); },
  grunt(pos) { this.play(pos ? 'cough' : 'grunt', pos || null, pos ? 0.4 : 0.55, { rev: 0.1 }); },
  babyCry(pos, vol = 0.35) { this.play('baby_cry', pos, vol, { rev: 0.3, vary: 0.05 }); },
  babyCoo(pos) { this.play('baby_coo', pos, 0.25, { rev: 0.25, vary: 0.05 }); },
  roar(pos, type, v = 1) { // a call means something; it carries: far ones arrive dark and roomy, near ones raw
    const k = type === 'breach' ? 'spot' : type;
    this.play(k + this.vk(v), pos, 1.15, { rate: this.vrate(v), rev: 0.45, near: 1.5 });
  },
  impact(pos, kind, power = 1, blade) {
    const heavy = kind === 'heavy', vol = (heavy ? 1.2 : 0.95) * (0.7 + 0.3 * power);
    this.play(blade ? 'hit_blade' : kind === 'kick' ? 'kick' : 'hit_blunt', pos, vol, { rev: 0.15, rate: heavy ? 0.9 : 1.05 });
    if (heavy && !blade) this.play('bone', pos, 0.45, { delay: 0.01 });
    if (blade && heavy) this.play('bone', pos, 0.3, { delay: 0.02, rate: 0.8 });
  },
  crunch(pos, n = 4, vol = 0.45) { this.play('bone', pos, vol * 1.2, { rate: 0.85 + n * 0.04 }); if (n > 4) this.play('bone', pos, vol * 0.7, { delay: 0.04 }); },
  kick(pos) { this.play('kick', pos, 0.95, { rev: 0.12 }); },
  exhale(pos, v = 1, vol = 0.45) { this.play('exhale' + this.vk(v), pos, vol, { rate: this.vrate(v), rev: 0.15 }); },
  shout(pos, v = 1, vol = 0.5) { const k = v < 0.95 ? 0.85 : v < 1.25 ? 1.05 : 1.45; this.play('shout' + k, pos, vol * 1.2, { rate: v / k, rev: 0.25, vary: 0.04 }); },
  bodyFall(pos, weight = 80) { const w = clamp(weight / 80, 0.6, 1.6); this.play('body_fall', pos, 0.75 + 0.3 * w, { rate: 1.15 / Math.sqrt(w), rev: 0.18 }); },
  spurt(pos, vol = 0.25) { this.play('spurt', pos, vol, { rev: 0.05 }); },
  whistle() { this.play('whistle', null, 0.32, { rev: 0.5, vary: 0.02 }); },
  breathe(t0, per, vol) { this.play('breath_in', null, vol * 0.9, { rate: 1.1 / Math.max(0.5, per), rev: 0.02 }); this.play('breath_out', null, vol, { delay: per * 0.48, rate: 1.1 / Math.max(0.5, per), rev: 0.02 }); },
  chop(pos) { this.play('chop', pos, 1.1, { rev: 0.35 }); },
  splinter(pos) { this.play('splinter', pos, 1.0, { rev: 0.35 }); },
  doorBang(pos, power = 1) { this.play('door_bang', pos, 0.6 + power * 0.6, { rev: 0.45, rate: 1.05 - power * 0.1 }); },
  glass(pos) { this.play('glass', pos, 1.0, { rev: 0.45 }); },
  pry(pos) { this.play('pry', pos, 0.7, { rev: 0.3 }); },
  barMove(pos) { this.play('bar_move', pos, 0.6, { rev: 0.2 }); },
  woodDrop(pos) { this.play('wood_drop', pos, 0.6, { rev: 0.2 }); },
  hammer(pos) { this.play('hammer', pos, 0.9, { rev: 0.3 }); },
  creak(pos) { this.play('hinge', pos, 0.55, { rev: 0.35 }); },
  scrape(pos) { this.play('scrape', pos, 0.45, { rev: 0.35 }); },
  /* ---- per-frame mixing & scheduling ---- */
  update(dt) {
    if (!this.ready) return;
    if (this.queue.length) this.bake(G.mode === 'play' ? 2 : 8);
    const ctx = this.ctx, t = ctx.currentTime, L = this.listener, rl = this.rainLevel, l = this.l;
    // the listener: at your head, facing where the camera faces
    const fx = L.right.z, fz = -L.right.x;
    if (l.positionX) { l.positionX.value = L.pos.x; l.positionY.value = (L.pos.y || 0) + 1.6; l.positionZ.value = L.pos.z; l.forwardX.value = fx; l.forwardY.value = 0; l.forwardZ.value = fz; l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0; }
    else { l.setPosition(L.pos.x, (L.pos.y || 0) + 1.6, L.pos.z); l.setOrientation(fx, 0, fz, 0, 1, 0); }
    this.rainOut.gain.setTargetAtTime(rl * (L.indoor ? 0.13 : 0.5), t, 0.3);
    this.rainIn.gain.setTargetAtTime(rl * (L.indoor ? 0.7 : 0.1), t, 0.3);
    this.wind.gain.setTargetAtTime((L.indoor ? 0.05 : 0.14) * (0.4 + rl * 0.6), t, 0.5);
    this.whistleG.gain.setTargetAtTime(L.indoor ? 0.012 + 0.01 * Math.max(0, Math.sin(t * 0.21)) : 0.003, t, 0.8);
    if (t > this.nextDrop) { const n = 1 + Math.floor(rl * 3); for (let i = 0; i < n; i++) this.drop(t + Math.random() * 0.05); this.nextDrop = t + 0.04 + Math.random() * 0.05 / Math.max(0.2, rl); }
    this.humOut.gain.setTargetAtTime(this.humGain, t, 0.25);
    this.tensionGain.gain.setTargetAtTime(this.tension * 0.9, t, 0.4);
    this.hiTone.gain.setTargetAtTime(this.tension * 0.012, t, 0.6);
    this.music.gain.setTargetAtTime(0.45 * (1 - 0.35 * this.adr), t, 0.6); // the music steps back when it gets close
    if (t > this.nextChord - 0.1) { this.pad(this.chords[this.chordIdx % 4], this.nextChord, 9); this.chordIdx++; this.nextChord += 9; }
    if (t > this.nextNote) {
      if (this.tension < 0.5 && Math.random() < 0.8) this.piano(this.pianoScale[Math.floor(Math.random() * this.pianoScale.length)], t + 0.02, 0.05 + Math.random() * 0.03);
      this.nextNote = t + rnd(2.6, 6.5);
    }
    if (this.tension > 0.05 && t > this.nextPulse) { this.pulse(t + 0.01, 0.5 * this.tension); this.pulse(t + 0.27, 0.32 * this.tension); this.nextPulse = t + (this.tension > 0.6 ? 0.62 : 0.86); }
    // breathing scales with exertion; the heartbeat comes up with adrenaline
    if (this.exertion > 0.08 && t > this.nextBreath) { const per = lerp(1.6, 0.55, this.exertion); this.breathe(t + 0.01, per, 0.05 + this.exertion * 0.17); this.nextBreath = t + per; }
    if (this.adr > 0.22 && t > this.nextBeat) { this.heartbeat(0.2 + this.adr * 0.5); this.nextBeat = t + 60 / (72 + this.adr * 78); }
    if (t > this.nextHum - 0.05) {
      const [m, beats] = this.humNotes[this.humIdx % this.humNotes.length]; const dur = beats * 0.78 * (1 + this.humDegrade * 0.4);
      if (m && this.humGain > 0.002 && Math.random() > this.humDegrade * 0.3) this.humNote(m, this.nextHum, dur);
      this.humIdx++; this.nextHum += dur + (Math.random() < this.humDegrade * 0.2 ? rnd(0.4, 1.2) : 0);
      if (this.nextHum < t) this.nextHum = t + 0.05;
    }
  }
};
