/* ===== P4 audio: everything synthesised with WebAudio ===== */
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const SND = {
  ctx: null, ready: false, listener: { pos: new V3(), right: new V3(1, 0, 0), indoor: false },
  humGain: 0, humDegrade: 0, tension: 0, rainLevel: 1, exertion: 0, adr: 0, nextBreath: 0, nextBeat: 0,
  init() {
    if (this.ready) return;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3.5; comp.attack.value = 0.005; comp.release.value = 0.3;
    this.master.connect(comp); comp.connect(ctx.destination);
    this.verb = ctx.createConvolver(); this.verb.buffer = this.impulse(3.2, 2.4);
    this.verbOut = ctx.createGain(); this.verbOut.gain.value = 0.55; this.verb.connect(this.verbOut); this.verbOut.connect(this.master);
    this.noiseBuf = this.makeNoise(5);
    this.music = ctx.createGain(); this.music.gain.value = 0.5; this.music.connect(this.master);
    const mSend = ctx.createGain(); mSend.gain.value = 0.6; this.music.connect(mSend); mSend.connect(this.verb);
    this.sfx = ctx.createGain(); this.sfx.gain.value = 1; this.sfx.connect(this.master);
    this.amb = ctx.createGain(); this.amb.gain.value = 1; this.amb.connect(this.master);
    this.startRain(); this.startWind(); this.startMusic(); this.startHum(); this.startBuzz();
    this.ready = true;
  },
  setMuted(m) { if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.1); },
  makeNoise(sec) {
    const ctx = this.ctx, b = ctx.createBuffer(2, ctx.sampleRate * sec, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); let p = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; p = 0.97 * p + 0.03 * w; d[i] = w * 0.6 + p * 2.2; } }
    return b;
  },
  impulse(sec, decay) {
    const ctx = this.ctx, len = ctx.sampleRate * sec, b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return b;
  },
  noise(t0, dur, loop = true) { const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = loop; s.start(t0, Math.random() * 4); if (dur) s.stop(t0 + dur); return s; },
  osc(type, f, t0, t1) { const o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t0); o.start(t0); if (t1) o.stop(t1); return o; },
  filt(type, f, q = 0.7) { const b = this.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; },
  gain(v = 0) { const g = this.ctx.createGain(); g.gain.value = v; return g; },
  env(g, t0, a, peak, d) { g.gain.cancelScheduledValues(t0); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d); },
  chain(...n) { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; },
  // positional output: distance falloff, pan, indoor/outdoor occlusion, reverb send
  out(pos, vol = 1, rev = 0.3) {
    const ctx = this.ctx, L = this.listener;
    const g = this.gain(1), lp = this.filt('lowpass', 18000), pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pos) {
      const dx = pos.x - L.pos.x, dz = pos.z - L.pos.z, d = Math.hypot(dx, dz);
      g.gain.value = vol / (1 + d * d / 30);
      if (pan) pan.pan.value = clamp((dx * L.right.x + dz * L.right.z) / 7, -0.9, 0.9);
      if (insideCabin(pos.x, pos.z) !== L.indoor) { lp.frequency.value = 900; g.gain.value *= 0.5; }
    } else g.gain.value = vol;
    g.connect(lp); let last = lp; if (pan) { lp.connect(pan); last = pan; }
    last.connect(this.sfx);
    const s = this.gain(rev); last.connect(s); s.connect(this.verb);
    return g;
  },
  /* ---- ambience ---- */
  startRain() {
    const t = this.ctx.currentTime;
    const n1 = this.noise(t), hp = this.filt('highpass', 450), lp = this.filt('lowpass', 7500);
    this.rainOut = this.gain(0); this.chain(n1, hp, lp, this.rainOut, this.amb);
    const n2 = this.noise(t), lp2 = this.filt('lowpass', 750), pk = this.filt('peaking', 220, 1.2); pk.gain.value = 6;
    this.rainIn = this.gain(0); this.chain(n2, lp2, pk, this.rainIn, this.amb);
    const s = this.gain(0.25); this.rainOut.connect(s); s.connect(this.verb);
  },
  startWind() {
    const t = this.ctx.currentTime, n = this.noise(t), bp = this.filt('bandpass', 380, 0.6);
    this.wind = this.gain(0.0); this.chain(n, bp, this.wind, this.amb);
    const lfo = this.osc('sine', 0.07, t), lg = this.gain(0.05); lfo.connect(lg); lg.connect(this.wind.gain);
    const lfo2 = this.osc('sine', 0.11, t), lg2 = this.gain(160); lfo2.connect(lg2); lg2.connect(bp.frequency);
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
    const s = this.gain(0.4); this.humOut.connect(s); s.connect(this.verb);
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
  /* ---- one-shots ---- */
  step(pos, surface, vol = 0.5) {
    if (!this.ready) return; const t = this.ctx.currentTime, o = this.out(pos, vol, 0.12);
    const n = this.noise(t, 0.09), g = this.gain(0);
    const f = surface === 'mud' ? this.filt('lowpass', 520) : surface === 'porch' ? this.filt('bandpass', 260, 3) : this.filt('bandpass', 330, 1.6);
    this.env(g, t, 0.004, surface === 'mud' ? 0.5 : 0.7, 0.08); this.chain(n, f, g, o);
    if (surface === 'mud') { const n2 = this.noise(t + 0.02, 0.12), b = this.filt('bandpass', 1400, 2), g2 = this.gain(0); b.frequency.setValueAtTime(900, t); b.frequency.exponentialRampToValueAtTime(2400, t + 0.1); this.env(g2, t + 0.02, 0.01, 0.12, 0.1); this.chain(n2, b, g2, o); }
    const th = this.osc('sine', surface === 'mud' ? 70 : 110, t, t + 0.12), tg = this.gain(0); this.env(tg, t, 0.004, 0.3, 0.09); this.chain(th, tg, o);
  },
  swing(pos, heavy) {
    if (!this.ready) return; const t = this.ctx.currentTime, o = this.out(pos, heavy ? 0.7 : 0.5, 0.1);
    const n = this.noise(t, 0.35), b = this.filt('bandpass', 600, 1.2), g = this.gain(0);
    b.frequency.setValueAtTime(500, t); b.frequency.exponentialRampToValueAtTime(heavy ? 1800 : 2600, t + (heavy ? 0.26 : 0.16));
    this.env(g, t, heavy ? 0.12 : 0.06, 0.55, heavy ? 0.2 : 0.12); this.chain(n, b, g, o);
  },
  hit(pos, heavy) {
    if (!this.ready) return; const t = this.ctx.currentTime, o = this.out(pos, heavy ? 1.1 : 0.85, 0.25);
    const k = this.osc('sine', heavy ? 95 : 120, t, t + 0.3), kg = this.gain(0); k.frequency.exponentialRampToValueAtTime(40, t + 0.22); this.env(kg, t, 0.003, 0.9, 0.22); this.chain(k, kg, o);
    const n = this.noise(t, 0.15), lp = this.filt('lowpass', heavy ? 1100 : 1700), ng = this.gain(0); this.env(ng, t, 0.002, 0.7, 0.11); this.chain(n, lp, ng, o);
    const c = this.noise(t, 0.06), bp = this.filt('bandpass', 2600, 2), cg = this.gain(0); this.env(cg, t, 0.001, heavy ? 0.4 : 0.25, 0.05); this.chain(c, bp, cg, o);
  },
  thud(pos) {
    if (!this.ready) return; const t = this.ctx.currentTime, o = this.out(pos, 0.9, 0.2);
    const n = this.noise(t, 0.5), lp = this.filt('lowpass', 320), g = this.gain(0); this.env(g, t, 0.005, 0.9, 0.4); this.chain(n, lp, g, o);
    const k = this.osc('sine', 60, t, t + 0.4), kg = this.gain(0); this.env(kg, t, 0.005, 0.6, 0.35); this.chain(k, kg, o);
  },
  growl(pos, vol = 0.6, dur = 1.1) {
    if (!this.ready) return; const t = this.ctx.currentTime, o = this.out(pos, vol, 0.35);
    const f0 = rnd(75, 115), s = this.osc('sawtooth', f0, t, t + dur + 0.1); s.frequency.linearRampToValueAtTime(f0 * rnd(0.8, 1.2), t + dur);
    const am = this.osc('sine', rnd(14, 22), t, t + dur + 0.1), ag = this.gain(0.5), g = this.gain(0); am.connect(ag); ag.connect(g.gain);
    const b = this.filt('bandpass', 420, 1.5), b2 = this.filt('peaking', 1100, 3); b2.gain.value = 8;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.5, t + 0.15); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    this.chain(s, b, b2, g, o);
    const n = this.noise(t, dur), nb = this.filt('bandpass', 900, 1.5), ng = this.gain(0); ng.gain.setValueAtTime(0.0001, t); ng.gain.linearRampToValueAtTime(0.25, t + 0.2); ng.gain.linearRampToValueAtTime(0.0001, t + dur); this.chain(n, nb, ng, o);
  },
  shriek(pos, vol = 0.7) {
    if (!this.ready) return; const t = this.ctx.currentTime, o = this.out(pos, vol, 0.45);
    const s = this.osc('sawtooth', 280, t, t + 0.9); s.frequency.exponentialRampToValueAtTime(rnd(800, 1000), t + 0.18); s.frequency.exponentialRampToValueAtTime(420, t + 0.8);
    const b = this.filt('bandpass', 1500, 1.2), g = this.gain(0); this.env(g, t, 0.03, 0.4, 0.75); this.chain(s, b, g, o);
    const n = this.noise(t, 0.8), nb = this.filt('bandpass', 2600, 1), ng = this.gain(0); this.env(ng, t, 0.03, 0.3, 0.7); this.chain(n, nb, ng, o);
  },
  clicks(pos, count = 4) { // the infected "language": short tongue clicks
    if (!this.ready) return; const t = this.ctx.currentTime, o = this.out(pos, 0.55, 0.5);
    for (let i = 0; i < count; i++) { const tt = t + i * rnd(0.09, 0.16) + (i === count - 1 ? 0.15 : 0); const n = this.noise(tt, 0.03), b = this.filt('bandpass', rnd(1600, 2400), 6), g = this.gain(0); this.env(g, tt, 0.001, 0.7, 0.025); this.chain(n, b, g, o); }
  },
  thunder(delay, power) {
    if (!this.ready) return; const t = this.ctx.currentTime + delay, o = this.out(null, 0.9 * power, 0.6);
    const n = this.noise(t, 6), lp = this.filt('lowpass', 170), g = this.gain(0);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.9, t + 0.25); g.gain.exponentialRampToValueAtTime(0.25, t + 1.6); g.gain.exponentialRampToValueAtTime(0.0001, t + 5.5);
    this.chain(n, lp, g, o);
    if (power > 0.8) { const c = this.noise(t, 0.3), hp = this.filt('highpass', 1800), cg = this.gain(0); this.env(cg, t, 0.002, 0.35, 0.25); this.chain(c, hp, cg, o); }
  },
  click() { if (!this.ready) return; const t = this.ctx.currentTime, o = this.out(null, 0.3, 0.05); [0, 0.05].forEach(d => { const s = this.osc('square', 2200, t + d, t + d + 0.012), g = this.gain(0.2); this.chain(s, g, o); }); },
  drip(pos) { if (!this.ready) return; const t = this.ctx.currentTime, o = this.out(pos, 0.35, 0.5); const s = this.osc('sine', 1700, t, t + 0.15); s.frequency.exponentialRampToValueAtTime(800, t + 0.1); const g = this.gain(0); this.env(g, t, 0.002, 0.4, 0.12); this.chain(s, g, o); },
  heartbeat(vol = 0.6) { if (!this.ready) return; const t = this.ctx.currentTime; [0, 0.24].forEach((d, i) => { const k = this.osc('sine', 55, t + d, t + d + 0.25), g = this.gain(0); this.env(g, t + d, 0.01, vol * (i ? 0.6 : 1), 0.2); this.chain(k, g, this.sfx); }); },
  grunt() { if (!this.ready) return; const t = this.ctx.currentTime, o = this.out(null, 0.5, 0.1); const n = this.noise(t, 0.2), b = this.filt('bandpass', 700, 2), g = this.gain(0); this.env(g, t, 0.01, 0.5, 0.15); this.chain(n, b, g, o); },
  babyCry(pos, vol = 0.35) {
    if (!this.ready) return; const t = this.ctx.currentTime, o = this.out(pos, vol, 0.35);
    for (let k = 0; k < 2; k++) {
      const t0 = t + k * 0.9, s = this.osc('sawtooth', 420, t0, t0 + 0.8);
      s.frequency.setValueAtTime(380, t0); s.frequency.linearRampToValueAtTime(560, t0 + 0.25); s.frequency.linearRampToValueAtTime(430, t0 + 0.7);
      const vib = this.osc('sine', 9, t0, t0 + 0.8), vg = this.gain(18); vib.connect(vg); vg.connect(s.frequency);
      const b1 = this.filt('bandpass', 1100, 3), b2 = this.filt('peaking', 2600, 3); b2.gain.value = 9; const g = this.gain(0); this.env(g, t0, 0.05, 0.35, 0.65);
      this.chain(s, b1, b2, g, o);
    }
  },
  babyCoo(pos) { if (!this.ready) return; const t = this.ctx.currentTime, o = this.out(pos, 0.25, 0.3); const s = this.osc('triangle', 520, t, t + 0.4); s.frequency.linearRampToValueAtTime(720, t + 0.2); s.frequency.linearRampToValueAtTime(600, t + 0.35); const b = this.filt('bandpass', 1200, 2), g = this.gain(0); this.env(g, t, 0.03, 0.3, 0.3); this.chain(s, b, g, o); },
  /* ---- infected voices: each roar is a different message ---- */
  voiceLayer(o, t0, dur, pts, { bp = 1100, q = 1.2, peak = 0.45, am = 30, amDepth = 0.35, v = 1, wave = 'sawtooth' } = {}) {
    const b = this.filt('bandpass', bp * Math.sqrt(v), q), pk = this.filt('peaking', bp * 2.1 * Math.sqrt(v), 2); pk.gain.value = 7;
    const amg = this.gain(1), g = this.gain(0);
    [-13, 13].forEach(dc => { const s = this.osc(wave, pts[0][1] * v, t0, t0 + dur + 0.05); s.detune.value = dc; pts.forEach(([dt, f], i) => { if (i) s.frequency.exponentialRampToValueAtTime(f * v, t0 + dt); }); s.connect(b); });
    if (am) { const a = this.osc('sine', am, t0, t0 + dur + 0.05), ag = this.gain(amDepth); a.connect(ag); ag.connect(amg.gain); }
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(peak, t0 + Math.min(0.09, dur * 0.25)); g.gain.setValueAtTime(peak * 0.82, t0 + dur * 0.7); g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    this.chain(b, pk, amg, g, o);
  },
  rasp(o, t0, dur, f, peak = 0.3, f1) {
    const n = this.noise(t0, dur + 0.05), b = this.filt('bandpass', f, 1.1), g = this.gain(0);
    if (f1) { b.frequency.setValueAtTime(f, t0); b.frequency.exponentialRampToValueAtTime(f1, t0 + dur); }
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(peak, t0 + 0.07); g.gain.linearRampToValueAtTime(0.0001, t0 + dur); this.chain(n, b, g, o);
  },
  roar(pos, type, v = 1) {
    if (!this.ready) return; const t = this.ctx.currentTime, o = this.out(pos, 1.05, 0.65);
    if (type === 'spot') { this.voiceLayer(o, t, 1.05, [[0, 170], [0.26, 640], [1.0, 360]], { bp: 1250, peak: 0.5, am: 34, v }); this.rasp(o, t, 1.0, 2300 * v, 0.32); }
    else if (type === 'flank') { for (let i = 0; i < 3; i++) { const t0 = t + i * 0.24; this.voiceLayer(o, t0, 0.18, [[0, 140], [0.07, 215], [0.17, 115]], { bp: 680, q: 1.6, peak: 0.6, am: 0, v }); this.rasp(o, t0, 0.15, 1100 * v, 0.22); } }
    else if (type === 'wail') { this.voiceLayer(o, t, 1.8, [[0, 430], [0.35, 480], [1.7, 150]], { bp: 900, peak: 0.42, am: 7, amDepth: 0.6, v }); const n = this.noise(t, 1.6), lp = this.filt('lowpass', 520), am = this.osc('sine', 21, t, t + 1.6), ag = this.gain(0.5), g = this.gain(0.0); am.connect(ag); ag.connect(g.gain); g.gain.setValueAtTime(0.25, t); g.gain.linearRampToValueAtTime(0.0001, t + 1.6); this.chain(n, lp, g, o); }
    else if (type === 'rally') { this.voiceLayer(o, t, 2.1, [[0, 150], [0.9, 520], [1.7, 470], [2.1, 300]], { bp: 1000, peak: 0.5, am: 5, amDepth: 0.2, v }); this.voiceLayer(o, t + 0.05, 2.0, [[0, 75], [0.9, 260], [2.0, 150]], { bp: 500, peak: 0.25, am: 0, v }); this.rasp(o, t, 2.0, 1800 * v, 0.18); }
    else if (type === 'retreat') { this.rasp(o, t, 0.95, 3200, 0.38, 1000); this.voiceLayer(o, t, 0.9, [[0, 320], [0.9, 120]], { bp: 800, peak: 0.22, am: 0, v }); }
  },
  /* ---- impacts & bodies ---- */
  impact(pos, kind, power = 1, blade) {
    if (!this.ready) return; const t = this.ctx.currentTime, heavy = kind === 'heavy', o = this.out(pos, (heavy ? 1.25 : 0.95) * (0.7 + 0.3 * power), 0.22);
    const k = this.osc('sine', heavy ? 88 : 115, t, t + 0.35), kg = this.gain(0); k.frequency.exponentialRampToValueAtTime(38, t + 0.25); this.env(kg, t, 0.002, blade ? 0.6 : 1.0, 0.26); this.chain(k, kg, o);
    const n = this.noise(t, 0.18), lp = this.filt('lowpass', heavy ? 1300 : 1900), ng = this.gain(0); this.env(ng, t, 0.001, 0.85, 0.12); this.chain(n, lp, ng, o);
    if (blade) { const c = this.noise(t, 0.12), hp = this.filt('bandpass', 3800, 1.5), cg = this.gain(0); hp.frequency.setValueAtTime(4800, t); hp.frequency.exponentialRampToValueAtTime(1600, t + 0.1); this.env(cg, t, 0.001, 0.5, 0.1); this.chain(c, hp, cg, o); }
    else { const c = this.noise(t, 0.05), bp = this.filt('bandpass', 2900, 2.5), cg = this.gain(0); this.env(cg, t, 0.0008, heavy ? 0.55 : 0.35, 0.04); this.chain(c, bp, cg, o); }
    const w = this.noise(t + 0.015, 0.18), wb = this.filt('bandpass', 750, 3), wg = this.gain(0); wb.frequency.setValueAtTime(1100, t); wb.frequency.exponentialRampToValueAtTime(380, t + 0.15); this.env(wg, t + 0.015, 0.005, blade ? 0.55 : 0.35, 0.14); this.chain(w, wb, wg, o);
    if (heavy) this.crunch(pos, 3);
  },
  crunch(pos, n = 4, vol = 0.45) { // bone
    if (!this.ready) return; const t = this.ctx.currentTime, o = this.out(pos, vol, 0.15);
    for (let i = 0; i < n; i++) { const tt = t + 0.01 + i * rnd(0.012, 0.024); const c = this.noise(tt, 0.025), b = this.filt('bandpass', rnd(1400, 2600), 5), g = this.gain(0); this.env(g, tt, 0.0005, 0.7, 0.02); this.chain(c, b, g, o); }
  },
  kick(pos) {
    if (!this.ready) return; const t = this.ctx.currentTime, o = this.out(pos, 0.95, 0.15);
    const n = this.noise(t, 0.2), lp = this.filt('lowpass', 480), g = this.gain(0); this.env(g, t, 0.003, 0.95, 0.16); this.chain(n, lp, g, o);
    const k = this.osc('sine', 72, t, t + 0.25), kg = this.gain(0); k.frequency.exponentialRampToValueAtTime(42, t + 0.2); this.env(kg, t, 0.003, 0.8, 0.18); this.chain(k, kg, o);
  },
  exhale(pos, v = 1, vol = 0.45) { // a body has air knocked out of it; no pain in it
    if (!this.ready) return; const t = this.ctx.currentTime, o = this.out(pos, vol, 0.2);
    const n = this.noise(t, 0.25), b = this.filt('bandpass', 620 * v, 1.3), g = this.gain(0); this.env(g, t, 0.008, 0.5, 0.2); this.chain(n, b, g, o);
    const s = this.osc('sawtooth', 125 * v, t, t + 0.2), sb = this.filt('bandpass', 520 * v, 2), sg = this.gain(0); s.frequency.exponentialRampToValueAtTime(85 * v, t + 0.18); this.env(sg, t, 0.006, 0.25, 0.16); this.chain(s, sb, sg, o);
  },
  shout(pos, v = 1, vol = 0.5) { // a human voice: one called word, three formants over a buzzy fundamental
    if (!this.ready) return; const t = this.ctx.currentTime, o = this.out(pos, vol, 0.25), f0 = 150 * v * rnd(0.92, 1.1), dur = rnd(0.22, 0.38);
    const s = this.osc('sawtooth', f0, t, t + dur + 0.05); s.frequency.linearRampToValueAtTime(f0 * 1.25, t + dur * 0.3); s.frequency.linearRampToValueAtTime(f0 * 0.85, t + dur);
    [[700, 6, 0.5], [1150, 7, 0.35], [2500, 8, 0.12]].forEach(([f, q, a]) => {
      const b = this.filt('bandpass', f * Math.sqrt(v), q), g = this.gain(0);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(a, t + 0.03); g.gain.setValueAtTime(a * 0.8, t + dur * 0.7); g.gain.linearRampToValueAtTime(0.0001, t + dur);
      s.connect(b); b.connect(g); g.connect(o);
    });
  },
  bodyFall(pos, weight = 80) {
    if (!this.ready) return; const t = this.ctx.currentTime, w = clamp(weight / 80, 0.6, 1.6), o = this.out(pos, 0.75 + 0.3 * w, 0.2);
    const n = this.noise(t, 0.5), lp = this.filt('lowpass', 260 + 120 / w), g = this.gain(0); this.env(g, t, 0.005, 0.95, 0.38); this.chain(n, lp, g, o);
    const k = this.osc('sine', 62 / Math.sqrt(w), t, t + 0.4), kg = this.gain(0); this.env(kg, t, 0.004, 0.7, 0.32); this.chain(k, kg, o);
    const sp = this.noise(t + 0.01, 0.3), hp = this.filt('highpass', 1300), sg = this.gain(0); this.env(sg, t + 0.01, 0.004, 0.32 * this.rainLevel + 0.08, 0.24); this.chain(sp, hp, sg, o);
  },
  spurt(pos, vol = 0.25) { // arterial pulse
    if (!this.ready) return; const t = this.ctx.currentTime, o = this.out(pos, vol, 0.1);
    const n = this.noise(t, 0.2), b = this.filt('bandpass', 900, 1.5), g = this.gain(0); b.frequency.setValueAtTime(1400, t); b.frequency.exponentialRampToValueAtTime(500, t + 0.18); this.env(g, t, 0.01, 0.5, 0.17); this.chain(n, b, g, o);
  },
  whistle() {
    if (!this.ready) return; const t = this.ctx.currentTime, o = this.out(null, 0.32, 0.5);
    [[0, 1850, 2350, 0.16], [0.22, 2350, 1750, 0.28]].forEach(([d, f0, f1, dur]) => { const s = this.osc('sine', f0, t + d, t + d + dur + 0.03), g = this.gain(0); s.frequency.exponentialRampToValueAtTime(f1, t + d + dur); this.env(g, t + d, 0.02, 0.5, dur); this.chain(s, g, o); });
  },
  breathe(t0, per, vol) {
    const o = this.out(null, vol, 0.05);
    const n = this.noise(t0, per * 0.45), b = this.filt('bandpass', 1050, 0.8), g = this.gain(0); this.env(g, t0, per * 0.08, 0.6, per * 0.3); this.chain(n, b, g, o);
    const n2 = this.noise(t0 + per * 0.5, per * 0.4), b2 = this.filt('bandpass', 1750, 1.1), g2 = this.gain(0); this.env(g2, t0 + per * 0.5, per * 0.12, 0.32, per * 0.25); this.chain(n2, b2, g2, o);
  },
  /* ---- the cabin taking damage ---- */
  chop(pos) { // an axe biting into a plank: a dry thunk, a crack, the squeal of the blade pulled free
    if (!this.ready) return; const t = this.ctx.currentTime, o = this.out(pos, 1.1, 0.35);
    const k = this.osc('sine', 150, t, t + 0.25), kg = this.gain(0); k.frequency.exponentialRampToValueAtTime(70, t + 0.18); this.env(kg, t, 0.002, 0.9, 0.18); this.chain(k, kg, o);
    const n = this.noise(t, 0.12), b = this.filt('bandpass', 1400, 1.4), g = this.gain(0); this.env(g, t, 0.001, 0.9, 0.09); this.chain(n, b, g, o);
    const c = this.noise(t + 0.01, 0.06), hb = this.filt('highpass', 2500), cg = this.gain(0); this.env(cg, t + 0.01, 0.001, 0.45, 0.05); this.chain(c, hb, cg, o);
    const sq = this.osc('sawtooth', 620, t + 0.35, t + 0.62), sb = this.filt('bandpass', 1300, 6), sg = this.gain(0); sq.frequency.linearRampToValueAtTime(480, t + 0.6); this.env(sg, t + 0.35, 0.03, 0.08, 0.22); this.chain(sq, sb, sg, o);
  },
  splinter(pos) {
    if (!this.ready) return; const t = this.ctx.currentTime, o = this.out(pos, 0.9, 0.3);
    for (let i = 0; i < 6; i++) { const tt = t + i * rnd(0.01, 0.03); const n = this.noise(tt, 0.05), b = this.filt('bandpass', rnd(900, 2600), 3), g = this.gain(0); this.env(g, tt, 0.001, 0.6, 0.04); this.chain(n, b, g, o); }
    const l = this.noise(t, 0.3), lp = this.filt('lowpass', 500), lg = this.gain(0); this.env(lg, t, 0.005, 0.5, 0.25); this.chain(l, lp, lg, o);
  },
  doorBang(pos, power = 1) { // a body against the door: boom, and the door rattling in its frame
    if (!this.ready) return; const t = this.ctx.currentTime, o = this.out(pos, 0.6 + power * 0.6, 0.45);
    const n = this.noise(t, 0.4), lp = this.filt('lowpass', 240), g = this.gain(0); this.env(g, t, 0.004, 1, 0.32); this.chain(n, lp, g, o);
    const k = this.osc('sine', 58, t, t + 0.35), kg = this.gain(0); this.env(kg, t, 0.003, 0.8 * power, 0.3); this.chain(k, kg, o);
    for (let i = 0; i < 4; i++) { const tt = t + 0.05 + i * 0.045; const r = this.noise(tt, 0.03), b = this.filt('bandpass', rnd(700, 1100), 4), rg = this.gain(0); this.env(rg, tt, 0.001, 0.3 * power, 0.025); this.chain(r, b, rg, o); }
  },
  glass(pos) {
    if (!this.ready) return; const t = this.ctx.currentTime, o = this.out(pos, 1, 0.5);
    const n = this.noise(t, 0.35), hp = this.filt('highpass', 3000), g = this.gain(0); this.env(g, t, 0.001, 0.8, 0.3); this.chain(n, hp, g, o);
    for (let i = 0; i < 9; i++) { const tt = t + 0.04 + i * rnd(0.03, 0.09), f = rnd(3000, 6500); const s = this.osc('sine', f, tt, tt + 0.12), sg = this.gain(0); this.env(sg, tt, 0.001, 0.12, 0.1); this.chain(s, sg, o); }
  },
  pry(pos) { // nails dragged out of wood
    if (!this.ready) return; const t = this.ctx.currentTime, o = this.out(pos, 0.7, 0.3);
    const s = this.osc('sawtooth', 900, t, t + 0.45), b = this.filt('bandpass', 1800, 8), g = this.gain(0); s.frequency.linearRampToValueAtTime(560, t + 0.4); this.env(g, t, 0.02, 0.18, 0.38); this.chain(s, b, g, o);
    const c = this.noise(t, 0.4), cb = this.filt('bandpass', 700, 2), cg = this.gain(0); this.env(cg, t, 0.02, 0.2, 0.35); this.chain(c, cb, cg, o);
  },
  barMove(pos) { const t = this.ctx.currentTime; if (!this.ready) return; const o = this.out(pos, 0.6, 0.2); const n = this.noise(t, 0.35), b = this.filt('bandpass', 420, 1.5), g = this.gain(0); this.env(g, t, 0.02, 0.6, 0.3); this.chain(n, b, g, o); const k = this.osc('sine', 120, t + 0.3, t + 0.5), kg = this.gain(0); this.env(kg, t + 0.3, 0.003, 0.5, 0.15); this.chain(k, kg, o); },
  woodDrop(pos) { if (!this.ready) return; const t = this.ctx.currentTime, o = this.out(pos, 0.6, 0.2); [0, 0.07].forEach((d, i) => { const k = this.osc('triangle', i ? 260 : 190, t + d, t + d + 0.12), kg = this.gain(0); this.env(kg, t + d, 0.002, i ? 0.25 : 0.45, 0.1); this.chain(k, kg, o); }); },
  hammer(pos) { if (!this.ready) return; const t = this.ctx.currentTime, o = this.out(pos, 0.9, 0.3); const s = this.osc('square', 1800, t, t + 0.03), sg = this.gain(0); this.env(sg, t, 0.001, 0.25, 0.025); this.chain(s, sg, o); const k = this.osc('sine', 160, t, t + 0.15), kg = this.gain(0); this.env(kg, t, 0.002, 0.7, 0.12); this.chain(k, kg, o); },
  creak(pos) { if (!this.ready) return; const t = this.ctx.currentTime, o = this.out(pos, 0.5, 0.4); const s = this.osc('sawtooth', 210, t, t + 0.7), b = this.filt('bandpass', 900, 9), g = this.gain(0); s.frequency.linearRampToValueAtTime(320, t + 0.35); s.frequency.linearRampToValueAtTime(240, t + 0.65); const am = this.osc('sine', 28, t, t + 0.7), ag = this.gain(0.06); am.connect(ag); ag.connect(g.gain); this.env(g, t, 0.05, 0.12, 0.6); this.chain(s, b, g, o); },
  scrape(pos) { // an axe head dragged along the ground
    if (!this.ready) return; const t = this.ctx.currentTime, o = this.out(pos, 0.45, 0.35);
    const n = this.noise(t, 0.7), b = this.filt('bandpass', 2400, 3), g = this.gain(0); b.frequency.setValueAtTime(2200, t); b.frequency.linearRampToValueAtTime(2700, t + 0.6); this.env(g, t, 0.06, 0.3, 0.6); this.chain(n, b, g, o);
    const r = this.osc('sawtooth', 1150, t, t + 0.7), rb = this.filt('bandpass', 3400, 10), rg = this.gain(0); this.env(rg, t, 0.08, 0.035, 0.55); this.chain(r, rb, rg, o);
  },
  /* ---- per-frame mixing & scheduling ---- */
  update(dt) {
    if (!this.ready) return;
    const t = this.ctx.currentTime, L = this.listener, rl = this.rainLevel;
    this.rainOut.gain.setTargetAtTime(rl * (L.indoor ? 0.16 : 0.55), t, 0.3);
    this.rainIn.gain.setTargetAtTime(rl * (L.indoor ? 0.75 : 0.12), t, 0.3);
    this.wind.gain.setTargetAtTime((L.indoor ? 0.05 : 0.14) * (0.4 + rl * 0.6), t, 0.5);
    this.humOut.gain.setTargetAtTime(this.humGain, t, 0.25);
    this.tensionGain.gain.setTargetAtTime(this.tension * 0.9, t, 0.4);
    this.hiTone.gain.setTargetAtTime(this.tension * 0.012, t, 0.6);
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
