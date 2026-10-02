// Chapters 04–06 (52–78 s): why divide by √dk, multi-head attention, positional encoding.
import {
  clamp, lerp, prog, smooth, easeOutCubic, easeInCubic, easeInOutCubic, easeOutExpo, easeInOutQuart, easeOutQuart,
  COL, rgba, mix, font, textWidth, text, mulberry32, glow, archPoints, tracePartial, roundRect, setFade,
} from './lib.mjs';
import { F, WORDS, N, IT, W_WIDE, BEAT, shot, word } from './long_common.mjs';

// ================================================================ 04 · scaling — real arithmetic, not a cartoon
const DS = [4, 16, 64, 256, 1024];
const rnd = mulberry32(11);
const gauss = () => { let s = 0; for (let k = 0; k < 6; k++) s += rnd(); return (s - 3) * 1.4142; };
const softmax = (a) => { const m = Math.max(...a); const e = a.map((x) => Math.exp(x - m)); const s = e.reduce((x, y) => x + y, 0); return e.map((x) => x / s); };
const scoresFor = (d) => {
  const q = Array.from({ length: d }, gauss);
  return Array.from({ length: N }, () => { let s = 0; for (let i = 0; i < d; i++) s += q[i] * gauss(); return s; });
};
const SAMPLES = DS.map((d) => { const sc = scoresFor(d); return { d, un: softmax(sc), sc: softmax(sc.map((s) => s / Math.sqrt(d))) }; });
const CURVE_D = Array.from({ length: 24 }, (_, i) => Math.round(2 * Math.pow(1024, i / 23)));
const CURVE = CURVE_D.map((d) => {
  let u = 0, s = 0; const trials = 80;
  for (let k = 0; k < trials; k++) { const sc = scoresFor(d); u += Math.max(...softmax(sc)); s += Math.max(...softmax(sc.map((x) => x / Math.sqrt(d)))); }
  return [d, u / trials, s / trials];
});

let _ctx = null;
function dkLabel(ctx, x, y, size, color, alpha, tail, align = 'center') {
  const fd = font('ISI', size), fk = font('ISR', size * 0.58), ft = font('ISR', size);
  const wd = textWidth(ctx, 'd', fd), wk = textWidth(ctx, 'k', fk), wt = textWidth(ctx, tail, ft);
  const tot = wd + wk + wt;
  const x0 = align === 'center' ? x - tot / 2 : x;
  text(ctx, 'd', x0, y, { f: fd, color, alpha });
  text(ctx, 'k', x0 + wd, y + size * 0.16, { f: fk, color, alpha });
  text(ctx, tail, x0 + wd + wk, y, { f: ft, color, alpha });
}

export function sceneScaling(ctx, t) {
  _ctx = ctx;
  const A = shot(t, 52.1, 60.0, 0.5, 0.6);
  if (A <= 0) return;
  setFade(A);
  let idx = 0;
  for (let k = 1; k <= 4; k++) idx += easeInOutCubic(prog(t, 52.5 + k - 0.5, 52.5 + k));
  const k0 = Math.min(4, Math.floor(idx)), k1 = Math.min(4, k0 + 1), f = idx - k0;
  const val = (key, j) => lerp(SAMPLES[k0][key][j], SAMPLES[k1][key][j], f);
  const dShow = DS[Math.round(idx)];
  const panels = [
    { x0: 130, key: 'un', title: '没有缩放', sub: 'softmax( q · k )', col: COL.q },
    { x0: 1030, key: 'sc', title: '除以 √dk', sub: 'softmax( q · k / √dk )', col: COL.k },
  ];
  const BASE = 410, MAXH = 190;
  panels.forEach((P, pi) => {
    const pa = easeOutCubic(prog(t, 52.3 + pi * 0.25, 53.0 + pi * 0.25));
    text(ctx, P.title, P.x0 + 380, 236, { f: font('SerifSC500', 26), align: 'center', alpha: pa });
    text(ctx, P.sub, P.x0 + 380, 264, { f: F.mono13, align: 'center', alpha: 0.5 * pa, tracking: 0.8 });
    ctx.fillStyle = rgba(COL.ink, 0.2 * pa);
    ctx.fillRect(P.x0, BASE + 1, 760, 1);
    let mx = 0;
    for (let j = 0; j < N; j++) mx = Math.max(mx, val(P.key, j));
    for (let j = 0; j < N; j++) {
      const w = val(P.key, j);
      const hot = w === mx;
      const h = Math.max(1.5, w * MAXH) * pa;
      ctx.fillStyle = rgba(hot ? P.col : mix(COL.ink, P.col, 0.18), (hot ? 0.95 : 0.5) * pa);
      ctx.fillRect(P.x0 + 33 + j * 66 - 18, BASE - h, 36, h);
    }
    text(ctx, '最大权重', P.x0 + 330, BASE + 40, { f: font('SansSC400', 16), align: 'right', alpha: 0.6 * pa });
    text(ctx, mx.toFixed(2), P.x0 + 346, BASE + 41, { f: font('Mono500', 20), alpha: pa, color: P.col });
  });
  // the verdict at d = 1024
  const nv = easeOutCubic(prog(t, 57.6, 58.3));
  text(ctx, '一个词独占，其余趋近 0 → 梯度消失', 130 + 380, BASE + 84, { f: font('SansSC400', 17), align: 'center', color: COL.q, alpha: nv });
  text(ctx, '依然平稳 → 可以训练', 1030 + 380, BASE + 84, { f: font('SansSC400', 17), align: 'center', color: COL.k, alpha: nv });

  // the dimension readout and the curve
  dkLabel(ctx, 960, 534, 40, COL.ink, easeOutCubic(prog(t, 52.4, 53.0)), ' = ' + dShow);
  const PX0 = 520, PX1 = 1400, PY0 = 590, PY1 = 790;
  const lx = (d) => PX0 + (Math.log(d / 2) / Math.log(1024)) * (PX1 - PX0);
  const ly = (v) => PY1 - v * (PY1 - PY0);
  const ca = easeOutCubic(prog(t, 52.6, 53.4));
  ctx.strokeStyle = rgba(COL.ink, 0.14 * ca);
  ctx.lineWidth = 1;
  [0, 0.5, 1].forEach((v) => { ctx.beginPath(); ctx.moveTo(PX0, ly(v)); ctx.lineTo(PX1, ly(v)); ctx.stroke(); });
  text(ctx, '最大权重', PX0 - 14, PY0 + 4, { f: font('SansSC400', 13), align: 'right', alpha: 0.5 * ca });
  text(ctx, '1.0', PX0 - 14, ly(1) + 20, { f: F.mono11, align: 'right', alpha: 0.4 * ca });
  DS.forEach((d) => {
    text(ctx, String(d), lx(d), PY1 + 22, { f: F.mono11, align: 'center', alpha: (d === dShow ? 0.95 : 0.4) * ca, color: d === dShow ? COL.ink : COL.ink });
    ctx.fillStyle = rgba(COL.ink, 0.3 * ca);
    ctx.fillRect(lx(d) - 0.5, PY1, 1, 5);
  });
  const dNow = Math.exp(lerp(Math.log(DS[k0]), Math.log(DS[k1]), f));
  [[1, COL.q, '无缩放'], [2, COL.k, '÷ √dk']].forEach(([ci, c, lab]) => {
    ctx.strokeStyle = rgba(c, 0.28 * ca);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    CURVE.forEach((p, i) => { const x = lx(p[0]), y = ly(p[ci]); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
    ctx.stroke();
    ctx.strokeStyle = rgba(c, 0.95 * ca);
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    let started = false;
    CURVE.forEach((p) => { if (p[0] > dNow) return; const x = lx(p[0]), y = ly(p[ci]); if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y); });
    // interpolate the tip to the current d
    const tipIdx = CURVE.findIndex((p) => p[0] > dNow);
    let tipY;
    if (tipIdx > 0) {
      const a = CURVE[tipIdx - 1], b = CURVE[tipIdx];
      const u = (Math.log(dNow) - Math.log(a[0])) / (Math.log(b[0]) - Math.log(a[0]));
      tipY = lerp(a[ci], b[ci], u);
    } else tipY = CURVE[CURVE.length - 1][ci];
    ctx.lineTo(lx(dNow), ly(tipY));
    ctx.stroke();
    glow(ctx, lx(dNow), ly(tipY), 22, c, 0.4 * ca);
    ctx.fillStyle = rgba(c, ca);
    ctx.beginPath(); ctx.arc(lx(dNow), ly(tipY), 4, 0, Math.PI * 2); ctx.fill();
    text(ctx, lab, PX1 + 12, ly(CURVE[CURVE.length - 1][ci]) + 5, { f: font('SansSC400', 14), color: c, alpha: 0.9 * ca });
  });
  setFade(1);
}

// ================================================================ 05 · multi-head
const norm = (r) => { const s = r.reduce((a, b) => a + b, 0); return r.map((x) => x / s); };
const MAT = [
  [0.40, 0.38, 0.04, 0.04, 0.03, 0.03, 0.02, 0.02, 0.01, 0.01, 0.02],
  [0.22, 0.38, 0.10, 0.12, 0.02, 0.04, 0.02, 0.05, 0.02, 0.01, 0.02],
  [0.03, 0.30, 0.25, 0.30, 0.02, 0.03, 0.02, 0.01, 0.02, 0.01, 0.01],
  [0.02, 0.28, 0.14, 0.24, 0.04, 0.22, 0.02, 0.01, 0.01, 0.01, 0.01],
  [0.02, 0.02, 0.02, 0.06, 0.36, 0.46, 0.02, 0.01, 0.01, 0.01, 0.01],
  [0.02, 0.05, 0.03, 0.20, 0.25, 0.36, 0.03, 0.02, 0.01, 0.01, 0.02],
  [0.02, 0.04, 0.08, 0.10, 0.02, 0.06, 0.30, 0.18, 0.12, 0.03, 0.05],
  W_WIDE,
  [0.02, 0.04, 0.03, 0.03, 0.02, 0.08, 0.10, 0.34, 0.24, 0.06, 0.04],
  [0.01, 0.02, 0.02, 0.02, 0.01, 0.04, 0.03, 0.06, 0.12, 0.30, 0.37],
  [0.01, 0.03, 0.02, 0.04, 0.03, 0.42, 0.04, 0.10, 0.08, 0.12, 0.11],
].map(norm);
function headMatrix(h) {
  const M = [];
  for (let i = 0; i < N; i++) {
    const r = [];
    for (let j = 0; j < N; j++) {
      let w = 0.015;
      if (h === 1) w += (j === i - 1 ? 0.8 : 0) + (j === i ? 0.12 : 0) + (i === 0 && j === 0 ? 0.8 : 0);
      if (h === 2) w += (j === i + 1 ? 0.8 : 0) + (j === i ? 0.12 : 0) + (i === N - 1 && j === i ? 0.8 : 0);
      if (h === 3) w += (j === 0 ? 0.55 : 0) + (j === i ? 0.18 : 0);
      if (h === 4) { const g = [0, 0, 1, 1, 2, 2, 3, 3, 3, 3, 3]; w += g[i] === g[j] ? 0.35 : 0; }
      if (h === 5) w += (j === 1 || j === 5 ? 0.45 : 0) + (j === i ? 0.06 : 0);
      if (h === 6) w += (j === 3 || j === 8 ? 0.45 : 0) + (j === 2 ? 0.1 : 0);
      if (h === 7) w += (j === i ? 0.7 : 0) + 0.04;
      r.push(w);
    }
    M.push(norm(r));
  }
  return M;
}
const HEADS = [MAT, ...[1, 2, 3, 4, 5, 6, 7].map(headMatrix)];
const HEAD_COL = [COL.q, mix(COL.q, COL.k, 0.55), COL.k, mix(COL.k, COL.ink, 0.6), COL.ink, mix(COL.ink, COL.v, 0.55), COL.v, mix(COL.v, COL.q, 0.4)];
const HEAD_TAG = ['指代', '前一词', '后一词', '句首', '短语', '关键词', '动词宾语', '自身'];
const cellAlpha = (w) => clamp(0.05 + 0.95 * Math.pow(clamp(w / 0.6), 0.75));

const HP = 15, HC = 13, HSIZE = N * HP, HGAP = 34, HY = 300;
const HX = (h) => 960 - (8 * HSIZE + 7 * HGAP) / 2 + h * (HSIZE + HGAP);

export function sceneMultiHead(ctx, t) {
  const A = shot(t, 59.9, 70.0, 0.5, 0.6);
  if (A <= 0) return;
  setFade(A);
  const toSlot = easeInOutQuart(prog(t, 62.0, 63.0));
  const spread = (h) => easeInOutQuart(prog(t, 62.0 + Math.abs(h - 3.5) * 0.04, 63.2 + Math.abs(h - 3.5) * 0.04));
  const concat = easeInOutQuart(prog(t, 66.0, 67.0));
  const BIGX = 960 - (N * 25) / 2, BIGY = 330;
  const order = [3, 4, 2, 5, 1, 6, 7, 0];
  for (const h of order) {
    if (h > 0 && t < 62.0) continue;
    const M = HEADS[h];
    const sp = h === 0 ? 1 : spread(h);
    const cx0 = 960 - (8 * HSIZE) / 2 + h * HSIZE;
    let ox, oy, pitch;
    if (h === 0) {
      const sx = lerp(BIGX, 960 - HSIZE / 2, toSlot);
      ox = lerp(sx, HX(0), spread(0));
      oy = lerp(BIGY, HY, toSlot);
      pitch = lerp(25, HP, toSlot);
    } else {
      ox = lerp(960 - HSIZE / 2, HX(h), sp);
      oy = HY; pitch = HP;
    }
    ox = lerp(ox, cx0, concat);
    const cell = pitch * (HC / HP);
    const headA = h === 0 ? 1 : clamp(sp * 5);
    const pm = h === 0 ? 1 : easeInOutCubic(prog(t, 62.1 + h * 0.03, 63.2 + h * 0.03));
    const c = HEAD_COL[h];
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const w = h === 0 ? M[i][j] : lerp(MAT[i][j], M[i][j], pm);
        const ap = h === 0 ? easeOutCubic(prog(t, 60.1 + (i + j) * 0.03, 60.7 + (i + j) * 0.03)) : 1;
        if (ap <= 0) continue;
        const x = ox + j * pitch + (pitch - cell) / 2, y = oy + i * pitch + (pitch - cell) / 2;
        const isIt = h === 0 && i === IT;
        ctx.fillStyle = rgba(isIt ? COL.q : h === 0 ? COL.ink : c, cellAlpha(w) * ap * headA * (h === 0 && !isIt ? 0.85 : 1));
        if (cell > 8) { ctx.beginPath(); roundRect(ctx, x, y, cell, cell, Math.min(3, cell * 0.12)); ctx.fill(); }
        else ctx.fillRect(x, y, cell, cell);
      }
    }
    const fa = (h === 0 ? easeOutCubic(prog(t, 60.4, 61.0)) : headA * (1 - concat)) * 0.18;
    if (fa > 0.004) {
      ctx.strokeStyle = rgba(COL.ink, fa);
      ctx.lineWidth = 1;
      ctx.strokeRect(ox - 4.5, oy - 4.5, N * pitch + 8, N * pitch + 8);
    }
    // label pops on its own beat
    const lt = 63.0 + h * BEAT;
    const la = easeOutCubic(prog(t, lt, lt + 0.35)) * (1 - concat) * (1 - prog(t, 65.9, 66.4));
    if (la > 0 && t > 62.9) {
      text(ctx, 'HEAD ' + (h + 1), ox, oy - 16, { f: F.mono11, tracking: 1.6, alpha: 0.6 * la, color: h === 0 ? COL.q : COL.ink });
      text(ctx, HEAD_TAG[h], ox, oy + HSIZE + 28, { f: font('SansSC400', 15), alpha: 0.75 * la, color: c });
    }
  }
  // the single head before the fan-out
  const sa = easeOutCubic(prog(t, 60.3, 61.0)) * (1 - prog(t, 61.9, 62.4));
  if (sa > 0) {
    text(ctx, 'ONE HEAD', 960, 296, { f: F.mono12, align: 'center', tracking: 3, alpha: 0.55 * sa });
    text(ctx, '只有一种注意力模式', 960, 640, { f: font('SerifSC400', 24), align: 'center', alpha: 0.85 * sa, tracking: 4 });
  }
  // d_model split
  const da = easeOutCubic(prog(t, 63.4, 64.1)) * (1 - prog(t, 69.2, 69.8));
  text(ctx, 'd_model = 512 = 8 × 64', 960, 238, { f: font('Mono500', 15), align: 'center', alpha: 0.7 * da, tracking: 1.4 });
  // concat bracket → W_O → output
  const ba = easeOutCubic(prog(t, 65.5, 66.2));
  if (ba > 0) {
    const by = HY + HSIZE + 70;
    const x0 = 960 - (8 * HSIZE) / 2, x1 = 960 + (8 * HSIZE) / 2;
    const p = easeInOutCubic(prog(t, 66.0, 66.8));
    ctx.strokeStyle = rgba(COL.ink, 0.4 * ba);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(960 - (960 - x0) * p, by - 8); ctx.lineTo(960 - (960 - x0) * p, by); ctx.lineTo(960 + (x1 - 960) * p, by); ctx.lineTo(960 + (x1 - 960) * p, by - 8);
    ctx.stroke();
    text(ctx, 'CONCAT', 960, by + 28, { f: F.mono12, align: 'center', tracking: 3, alpha: 0.65 * ba });
    const lp = easeOutCubic(prog(t, 67.0, 67.7));
    if (lp > 0) {
      ctx.strokeStyle = rgba(COL.ink, 0.35 * lp);
      ctx.beginPath(); ctx.moveTo(960, by + 40); ctx.lineTo(960, by + 40 + 44 * lp); ctx.stroke();
      ctx.strokeStyle = rgba(COL.q, 0.9 * lp);
      ctx.beginPath(); roundRect(ctx, 960 - 130, by + 86, 260, 42, 5); ctx.stroke();
      text(ctx, 'Linear  ·  W_O', 960, by + 112, { f: font('Mono500', 14), align: 'center', alpha: lp, tracking: 1 });
    }
    const op = easeOutCubic(prog(t, 68.0, 68.8));
    if (op > 0) {
      ctx.strokeStyle = rgba(COL.ink, 0.35 * op);
      ctx.beginPath(); ctx.moveTo(960, by + 128); ctx.lineTo(960, by + 128 + 30 * op); ctx.stroke();
      text(ctx, 'MultiHead( Q, K, V )', 960, by + 192, { f: font('ISI', 36), align: 'center', alpha: op });
    }
  }
  setFade(1);
}

// ================================================================ 06 · positional encoding
const SLOT = [3, 9, 0, 6, 8, 1, 10, 5, 2, 7, 4]; // word i sits in slot SLOT[i] after the shuffle
const slotX = (s) => 960 + (s - 5) * 150;
const PD = 64, PN = 64, PC = 8;
const PE = Array.from({ length: PN }, (_, pos) => Array.from({ length: PD }, (_, k) => {
  const i = k >> 1;
  const a = pos / Math.pow(10000, (2 * i) / PD);
  return k % 2 === 0 ? Math.sin(a) : Math.cos(a);
}));

export function scenePosition(ctx, t) {
  // A: the sentence is a bag of words to attention
  const A = shot(t, 69.9, 74.1, 0.45, 0.45);
  if (A > 0) {
    setFade(A);
    const e = easeInOutCubic(prog(t, 71.0, 72.1));
    const TY = 430;
    const slotOf = (i) => lerp(i, SLOT[i], e);
    const lift = (i) => Math.sin(e * Math.PI) * (i % 2 ? -26 : 26);
    // arcs follow the "it" token; their weights never change
    const itS = slotOf(IT);
    const order = [...Array(N).keys()].filter((j) => j !== IT).sort((a, b) => W_WIDE[a] - W_WIDE[b]);
    for (const j of order) {
      const w = W_WIDE[j];
      const x1 = slotX(itS), x2 = slotX(slotOf(j));
      const pts = archPoints(x1, TY - 50, x2, TY - 50, 20 + 0.22 * Math.abs(x2 - x1), 48);
      const p = easeInOutCubic(prog(t, 70.2 + Math.abs(j - IT) * 0.04, 70.9 + Math.abs(j - IT) * 0.04));
      const hot = smooth(clamp((w - 0.18) / 0.3));
      ctx.strokeStyle = rgba(mix(COL.ink, COL.q, hot), (0.22 + 0.78 * Math.pow(w / 0.6, 0.6)));
      ctx.lineWidth = 0.9 + 6.2 * w;
      ctx.beginPath(); tracePartial(ctx, pts, 0, p); ctx.stroke();
    }
    for (let i = 0; i < N; i++) {
      const ap = easeOutCubic(prog(t, 70.0 + i * 0.03, 70.6 + i * 0.03));
      const x = slotX(slotOf(i));
      word(ctx, WORDS[i], x, TY + lift(i), 40, i === IT ? COL.q : COL.ink, ap);
      text(ctx, W_WIDE[i].toFixed(2), x, TY + 44, { f: F.mono12, align: 'center', alpha: (0.3 + 0.6 * (W_WIDE[i] > 0.3 ? 1 : 0)) * ap, color: W_WIDE[i] > 0.3 ? COL.q : COL.ink, tracking: 0.4 });
    }
    const sa = easeOutCubic(prog(t, 72.1, 72.7));
    text(ctx, '词序打乱了 —— 权重一个都没变', 960, 590, { f: font('SerifSC500', 28), align: 'center', alpha: sa, tracking: 3 });
    text(ctx, 'Attention( shuffle(x) )  =  shuffle( Attention(x) )', 960, 632, { f: F.mono13, align: 'center', alpha: 0.5 * sa, tracking: 1 });
    setFade(1);
  }
  // B: sine waves of many wavelengths give every position its own fingerprint
  const B = shot(t, 73.9, 78.0, 0.5, 0.6);
  if (B > 0) {
    setFade(B);
    const HX0 = 330, HY0 = 190;
    const scanPos = clamp((t - 74.4) / 3.2) * (PN - 1);
    const reveal = easeOutCubic(prog(t, 74.0, 75.0));
    for (let pos = 0; pos < PN; pos++) {
      const ca = clamp((scanPos - pos) / 6 + 0.12) * 0 + (pos <= scanPos + 6 ? 1 : 0.0);
      const colA = pos <= scanPos ? 1 : 0.22;
      for (let k = 0; k < PD; k++) {
        const v = PE[pos][k];
        const c = v > 0 ? COL.q : COL.v;
        ctx.fillStyle = rgba(c, (0.05 + 0.95 * Math.abs(v) ** 0.9) * colA * reveal * 0.95);
        ctx.fillRect(HX0 + pos * PC, HY0 + k * PC, PC - 1, PC - 1);
      }
    }
    // current position scan
    const sx = HX0 + Math.min(PN - 1, Math.floor(scanPos)) * PC;
    ctx.strokeStyle = rgba(COL.ink, 0.9 * reveal);
    ctx.lineWidth = 1.4;
    ctx.strokeRect(sx - 1, HY0 - 4, PC + 1, PD * PC + 6);
    text(ctx, '位置 →', HX0, HY0 - 18, { f: font('SansSC400', 14), alpha: 0.55 * reveal });
    text(ctx, '维度 ↓', HX0 - 16, HY0 + 14, { f: font('SansSC400', 14), align: 'right', alpha: 0.55 * reveal });
    text(ctx, 'pos = ' + Math.floor(scanPos), HX0 + PN * PC, HY0 - 18, { f: font('Mono500', 14), align: 'right', color: COL.q, alpha: reveal, tracking: 1 });
    // three of the sine waves
    const GX0 = 960, GW = 760;
    [[0, '维度 0 · 波长最短'], [16, '维度 16'], [32, '维度 32 · 波长最长']].forEach(([k, lab], r) => {
      const gy = 250 + r * 150;
      const ra = easeOutCubic(prog(t, 74.4 + r * BEAT, 75.0 + r * BEAT)) * 1;
      ctx.strokeStyle = rgba(COL.ink, 0.12 * ra);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(GX0, gy); ctx.lineTo(GX0 + GW, gy); ctx.stroke();
      text(ctx, lab, GX0, gy - 52, { f: font('SansSC400', 14), alpha: 0.6 * ra });
      ctx.lineWidth = 2;
      ctx.strokeStyle = rgba(r === 0 ? COL.q : r === 1 ? COL.k : COL.v, 0.95 * ra);
      ctx.beginPath();
      for (let pos = 0; pos <= Math.min(PN - 1, scanPos); pos += 0.25) {
        const i = k >> 1;
        const v = Math.sin(pos / Math.pow(10000, (2 * i) / PD));
        const x = GX0 + (pos / (PN - 1)) * GW, y = gy - v * 40;
        if (pos === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      const v = Math.sin(scanPos / Math.pow(10000, (2 * (k >> 1)) / PD));
      glow(ctx, GX0 + (scanPos / (PN - 1)) * GW, gy - v * 40, 20, r === 0 ? COL.q : r === 1 ? COL.k : COL.v, 0.5 * ra);
    });
    const fa = easeOutCubic(prog(t, 75.6, 76.4));
    text(ctx, 'PE(pos, 2i)    = sin( pos / 10000^(2i/d) )', GX0, 700, { f: F.mono13, alpha: 0.6 * fa, tracking: 0.6 });
    text(ctx, 'PE(pos, 2i+1)  = cos( pos / 10000^(2i/d) )', GX0, 726, { f: F.mono13, alpha: 0.6 * fa, tracking: 0.6 });
    setFade(1);
  }
}
