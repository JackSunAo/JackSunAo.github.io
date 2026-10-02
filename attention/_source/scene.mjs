// "Attention Is All You Need" — 30 s explainer. Design space 1920×1080, time in seconds.
import { createCanvas } from '@napi-rs/canvas';
import {
  mulberry32,
  clamp, lerp, prog, smooth, easeOutCubic, easeInCubic, easeInOutCubic, easeOutQuart, easeInOutQuart,
  easeOutExpo, easeInOutExpo, easeInOutSine, win, COL, rgba, mix, font, layout, textWidth, text, reveal,
  defocusGlyph, archPoints, cubicPoints, tracePartial, pointAt, roundRect, glow,
} from './lib.mjs';

export const W = 1920, H = 1080, DURATION = 30;
const FAST = [[2.3, 3.45], [3.4, 6.4], [6.95, 7.4], [10.9, 11.9], [13.0, 14.5], [17.75, 19.3], [20.0, 21.3], [23.45, 24.25], [25.95, 26.75], [27.8, 28.5]];
export const samplesAt = (t) => (FAST.some(([a, b]) => t >= a && t <= b) ? 8 : 4);

// ---------------------------------------------------------------- fonts
const F = {
  title: font('ISR', 128),
  tok: font('ISR', 54),
  mono11: font('Mono400', 11),
  mono12: font('Mono400', 12),
  mono13: font('Mono400', 13),
  monoL12: font('Mono300', 12),
  head: font('SerifSC500', 44),
  sub: font('SansSC400', 20),
};

// ---------------------------------------------------------------- data
const WORDS = ['The', 'animal', "didn't", 'cross', 'the', 'street', 'because', 'it', 'was', 'too', 'tired'];
const IT = 7;
const W_TIRED = [0.02, 0.58, 0.03, 0.02, 0.01, 0.12, 0.04, 0.06, 0.03, 0.03, 0.06];
const W_WIDE = [0.02, 0.10, 0.03, 0.02, 0.04, 0.60, 0.04, 0.06, 0.02, 0.02, 0.05];
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
const N = 11;
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

// ---------------------------------------------------------------- timeline
const CAPS = [
  { t0: 3.3, t1: 6.95, head: '过去：逐词阅读', sub: 'RNN 一次只读一个词，距离越远，记忆越模糊' },
  { t0: 7.15, t1: 9.6, head: '注意力：每个词同时看向所有词', sub: '不再逐个传递，所有位置一步并行计算' },
  { t0: 9.75, t1: 13.15, head: '上下文，决定“看向谁”', sub: 'tired → it 指 animal　·　wide → it 指 street' },
  { t0: 13.35, t1: 17.75, head: '一行公式，就是全部核心', sub: '用 Q 去匹配每个 K，再按匹配度加权汇总 V' },
  { t0: 17.95, t1: 20.95, head: '多头注意力：8 个视角，同时理解', sub: '有的追踪指代，有的关注语序与句法，最后拼接融合' },
  { t0: 21.1, t1: 23.5, head: '层层堆叠，就是 Transformer', sub: '编码器、解码器各 6 层，正弦位置编码标记词序' },
  { t0: 23.65, t1: 26.1, head: '更快，也更准', sub: '比循环、卷积结构训练得更快，翻译质量也更高' },
  { t0: 26.25, t1: 28.05, head: '此后的大模型，几乎都由此出发', sub: '从 GPT、BERT 到今天的大语言模型' },
];
const SECTIONS = [
  { t0: 3.2, t1: 6.95, n: '01', tag: 'RECURRENCE' },
  { t0: 7.05, t1: 13.15, n: '02', tag: 'SELF-ATTENTION' },
  { t0: 13.25, t1: 17.75, n: '03', tag: 'SCALED DOT-PRODUCT ATTENTION' },
  { t0: 17.85, t1: 20.95, n: '04', tag: 'MULTI-HEAD ATTENTION' },
  { t0: 21.05, t1: 26.1, n: '05', tag: 'THE TRANSFORMER' },
  { t0: 26.15, t1: 28.05, n: '06', tag: 'LEGACY' },
];

// reading head (RNN) step times
const STEP0 = 3.62, STEP = 0.255;
const stepTime = (i) => STEP0 + i * STEP;
const SWAP0 = 11.0, SWAP1 = 11.75;

// ---------------------------------------------------------------- sentence layout
const TOK_Y = 478, LINE_Y = 508, TOK_SIZE = 54, GAP = 21;
let _ctx = null;
const tw = (s, f = F.tok) => textWidth(_ctx, s, f);
function tokenRow(t) {
  const sp = easeInOutCubic(prog(t, SWAP0 + 0.1, SWAP1));
  const ws = WORDS.map((w) => tw(w));
  ws[10] = lerp(tw('tired'), tw('wide'), sp);
  const total = ws.reduce((a, b) => a + b, 0) + GAP * (N - 1);
  let x = 960 - total / 2;
  const out = [];
  for (let i = 0; i < N; i++) { out.push({ x, w: ws[i], cx: x + ws[i] / 2 }); x += ws[i] + GAP; }
  out.total = total; out.sp = sp;
  return out;
}
const itWeights = (t) => {
  const sp = easeInOutCubic(prog(t, SWAP0 + 0.15, SWAP1 + 0.1));
  return W_TIRED.map((w, i) => lerp(w, W_WIDE[i], sp));
};

// ---------------------------------------------------------------- matrix layout (S4)
const MX = 1296, MY = 262, MP = 40, MC = 34;
const cellRect = (i, j) => [MX + j * MP + (MP - MC) / 2, MY + i * MP + (MP - MC) / 2, MC, MC];
const cellAlpha = (w) => clamp(0.05 + 0.95 * Math.pow(clamp(w / 0.6), 0.75));

// heads layout (S5)
const HP = 12, HC = 10, HGAP = 34;
const HSIZE = N * HP;
const H_X0 = 960 - (8 * HSIZE + 7 * HGAP) / 2, H_Y = 372;

// architecture layout (S6)
const XE = 766, XD = 1154, BW = 252, BH = 36;
const ARCH = {
  enc: [
    { id: 'emb', y: 742, label: 'Input Embedding' },
    { id: 'mha', y: 640, label: 'Multi-Head Attention', attn: true },
    { id: 'an1', y: 590, label: 'Add & Norm', thin: true },
    { id: 'ff', y: 530, label: 'Feed Forward' },
    { id: 'an2', y: 480, label: 'Add & Norm', thin: true },
  ],
  dec: [
    { id: 'emb', y: 742, label: 'Output Embedding' },
    { id: 'mmha', y: 640, label: 'Masked Multi-Head Attention', attn: true },
    { id: 'an1', y: 590, label: 'Add & Norm', thin: true },
    { id: 'mha', y: 520, label: 'Multi-Head Attention', attn: true },
    { id: 'an2', y: 470, label: 'Add & Norm', thin: true },
    { id: 'ff', y: 410, label: 'Feed Forward' },
    { id: 'an3', y: 360, label: 'Add & Norm', thin: true },
    { id: 'lin', y: 290, label: 'Linear' },
    { id: 'sm', y: 240, label: 'Softmax' },
  ],
};
const PLUS_Y = 692;

// ---------------------------------------------------------------- main
export function drawFrame(ctx, t, S = 1) {
  _ctx = ctx;
  _t = t;
  ctx.setTransform(S, 0, 0, S, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  background(ctx, t, S);

  ctx.save();
  const cs = 1 + 0.032 * easeInOutSine(clamp(t / DURATION));
  ctx.translate(960, 480);
  ctx.scale(cs, cs);
  ctx.translate(-960, -480);
  sceneTitle(ctx, t);
  sceneSentence(ctx, t);
  sceneFormula(ctx, t);
  sceneMatrix(ctx, t);
  sceneArch(ctx, t);
  sceneStats(ctx, t);
  sceneTimeline(ctx, t);
  sceneEnd(ctx, t);
  lateDot(ctx, t);
  ctx.restore();

  chrome(ctx, t);
  captions(ctx, t);

  // fade from / to black
  const fade = Math.max(1 - prog(t, 0, 0.25), easeInCubic(prog(t, 29.6, 30)));
  if (fade > 0) {
    ctx.globalAlpha = fade;
    ctx.fillStyle = '#050404';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
}

let _bg = null, _bgS = 0;
function buildBackground(S) {
  // radial lift computed in float and dithered, so the 8-bit output never bands
  const w = Math.round(W * S), h = Math.round(H * S);
  const c = createCanvas(w, h);
  const g = c.getContext('2d');
  const img = g.createImageData(w, h);
  const d = img.data;
  const rnd = mulberry32(7);
  const cx = 960 * S, cy = 470 * S, R = 1180 * S;
  const base = COL.bg, lift = [26, 22, 18];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const r = Math.hypot((x - cx) * 0.92, y - cy) / R;
      const f = Math.pow(1 - smooth(clamp(r)), 1.7);
      const vig = 1 - 0.38 * smooth(clamp((r - 0.55) / 0.7));
      const k = (y * w + x) * 4;
      const n = rnd() + rnd() - 1;
      d[k] = clamp(((base[0] + lift[0] * f) * vig + n * 0.9) / 255) * 255 + 0.5;
      d[k + 1] = clamp(((base[1] + lift[1] * f) * vig + n * 0.9) / 255) * 255 + 0.5;
      d[k + 2] = clamp(((base[2] + lift[2] * f) * vig + n * 0.9) / 255) * 255 + 0.5;
      d[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}
function background(ctx, t, S) {
  if (!_bg || _bgS !== S) { _bg = buildBackground(S); _bgS = S; }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(_bg, 0, 0);
  ctx.setTransform(S, 0, 0, S, 0, 0);
}

// ---------------------------------------------------------------- chrome
function chrome(ctx, t) {
  const a = win(t, 3.0, 28.15, 0.8, 0.5);
  if (a <= 0) return;
  text(ctx, 'ATTENTION IS ALL YOU NEED', 96, 76, { f: F.mono12, tracking: 2.6, alpha: 0.5 * a });
  text(ctx, 'VASWANI ET AL.  ·  NIPS 2017', 1824, 76, { f: F.mono12, tracking: 2.6, alpha: 0.38 * a, align: 'right' });

  // segmented progress rule
  const x0 = 96, x1 = 1824, y = 1016, gap = 10;
  const segW = (x1 - x0 - gap * (SECTIONS.length - 1)) / SECTIONS.length;
  ctx.lineCap = 'butt';
  SECTIONS.forEach((s, i) => {
    const sx = x0 + i * (segW + gap);
    ctx.strokeStyle = rgba(COL.ink, 0.12 * a);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(sx, y); ctx.lineTo(sx + segW, y); ctx.stroke();
    const p = prog(t, s.t0, s.t1 + 0.1);
    if (p > 0) {
      ctx.strokeStyle = rgba(p < 1 ? COL.ink : COL.ink, (p < 1 ? 0.62 : 0.32) * a);
      ctx.beginPath(); ctx.moveTo(sx, y); ctx.lineTo(sx + segW * p, y); ctx.stroke();
    }
  });
  ctx.lineCap = 'round';
}

function captions(ctx, t) {
  for (const s of SECTIONS) {
    if (t < s.t0 || t > s.t1 + 0.6) continue;
    const ty = 846;
    const bar = easeOutExpo(prog(t, s.t0, s.t0 + 0.7)) * (1 - easeInCubic(prog(t, s.t1, s.t1 + 0.4)));
    ctx.fillStyle = rgba(COL.q, bar);
    ctx.fillRect(96, ty - 9, 18 * bar, 2);
    reveal(ctx, s.n + ' / 06', 128, ty, t, { f: F.mono12, size: 12, tracking: 2.6, color: COL.q, tIn: s.t0 + 0.05, tOut: s.t1, stagger: 0.015, durIn: 0.6, durOut: 0.35 });
    reveal(ctx, s.tag, 128 + 92, ty, t, { f: F.mono12, size: 12, tracking: 2.6, alpha: 0.55, tIn: s.t0 + 0.12, tOut: s.t1, stagger: 0.008, durIn: 0.6, durOut: 0.35 });
  }
  for (const c of CAPS) {
    if (t < c.t0 || t > c.t1 + 0.6) continue;
    reveal(ctx, c.head, 94, 914, t, { f: F.head, size: 44, tIn: c.t0, tOut: c.t1 - 0.32, stagger: 0.022, durIn: 0.75, durOut: 0.38 });
    reveal(ctx, c.sub, 96, 962, t, { f: F.sub, size: 20, alpha: 0.62, tIn: c.t0 + 0.18, tOut: c.t1 - 0.36, stagger: 0.009, durIn: 0.7, durOut: 0.34 });
  }
}

// ---------------------------------------------------------------- S1 title
function sceneTitle(ctx, t) {
  if (t > 3.4) return;
  const title = 'Attention Is All You Need';
  const L = layout(ctx, title, F.title);
  const x0 = 960 - L.width / 2, y = 548;
  ctx.font = F.title;
  ctx.fillStyle = rgba(COL.ink);
  for (let i = 0; i < L.chars.length; i++) {
    const ti = 0.42 + i * 0.028;
    const p = prog(t, ti, ti + 1.0);
    if (p <= 0) continue;
    const to = 2.38 + i * 0.009;
    const po = easeInCubic(prog(t, to, to + 0.5));
    if (po >= 1) continue;
    const e = easeOutCubic(p);
    const a = e * (1 - po);
    const r = 15 * (1 - e) + 12 * po;
    const dy = 20 * (1 - easeOutExpo(p)) - 26 * po;
    ctx.globalAlpha = a;
    defocusGlyph(ctx, L.chars[i], x0 + L.xs[i], y + dy, r);
  }
  ctx.globalAlpha = 1;
  const out = 1 - easeInCubic(prog(t, 2.45, 2.95));
  reveal(ctx, 'ARXIV 1706.03762  ·  JUNE 2017', 960, 392, t, { f: F.mono13, size: 13, tracking: 3.4, align: 'center', alpha: 0.55 * out, tIn: 0.75, stagger: 0.012, durIn: 0.8 });
  reveal(ctx, '开启大模型时代的那篇论文', 960, 664, t, { f: font('SerifSC400', 30), size: 30, tracking: 9, align: 'center', alpha: 0.9 * out, tIn: 1.25, stagger: 0.04, durIn: 0.9 });
  const authors = 'ASHISH VASWANI · NOAM SHAZEER · NIKI PARMAR · JAKOB USZKOREIT · LLION JONES · AIDAN N. GOMEZ · ŁUKASZ KAISER · ILLIA POLOSUKHIN';
  const aa = easeOutCubic(prog(t, 1.65, 2.3)) * out;
  text(ctx, authors, 960, 730, { f: F.monoL12, tracking: 1.6, align: 'center', alpha: 0.4 * aa });
}

// ---------------------------------------------------------------- S2/S3 sentence
function headPos(t, row) {
  // vermillion reading head travels token to token
  if (t < STEP0 - 0.25) return null;
  let i = 0;
  while (i < N - 1 && t > stepTime(i + 1) - 0.17) i++;
  const tArr = stepTime(i);
  if (t < tArr && i === 0) {
    const p = easeInOutCubic(prog(t, STEP0 - 0.42, STEP0));
    return [lerp(960, row[0].cx, p), i];
  }
  if (i > 0 && t < stepTime(i)) {
    const p = easeInOutCubic(prog(t, stepTime(i) - 0.17, stepTime(i)));
    return [lerp(row[i - 1].cx, row[i].cx, p), i];
  }
  return [row[i].cx, i];
}

function sceneSentence(ctx, t) {
  if (t > 14.6) return;
  const row = tokenRow(t);

  // --- the rule (born in S1, becomes the reading line in S2/S3)
  const lineIn = easeOutExpo(prog(t, 0.2, 1.5));
  const toRow = easeInOutCubic(prog(t, 2.55, 3.35));
  const lineOut = easeInOutCubic(prog(t, 12.95, 13.6));
  const ly = lerp(600, LINE_Y, toRow);
  const hw = lerp(560 * lineIn, row.total / 2 + 46, toRow) * (1 - lineOut);
  if (hw > 0.5) {
    ctx.strokeStyle = rgba(COL.ink, lerp(0.28, 0.2, toRow));
    ctx.lineWidth = 1;
    ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(960 - hw, ly); ctx.lineTo(960 + hw, ly); ctx.stroke();
    ctx.lineCap = 'round';
    // end ticks
    const ta = toRow * (1 - lineOut);
    if (ta > 0) {
      ctx.strokeStyle = rgba(COL.ink, 0.3 * ta);
      ctx.beginPath(); ctx.moveTo(960 - hw, ly - 5); ctx.lineTo(960 - hw, ly + 5); ctx.moveTo(960 + hw, ly - 5); ctx.lineTo(960 + hw, ly + 5); ctx.stroke();
    }
  }

  // --- focus dot (S1) → reading head (S2)
  const dotIn = easeOutExpo(prog(t, 0.05, 0.6));
  const hp = headPos(t, row);
  const dotGone = prog(t, 6.95, 7.05);
  if (dotIn > 0 && dotGone < 1) {
    let dx = 960, dy = lerp(600, LINE_Y, toRow);
    if (hp) dx = hp[0];
    const pulse = 1 + 0.6 * Math.exp(-Math.pow((t - 0.45) / 0.18, 2));
    glow(ctx, dx, dy, 34 * pulse, COL.q, 0.28 * dotIn);
    ctx.fillStyle = rgba(COL.q, dotIn);
    ctx.beginPath(); ctx.arc(dx, dy, 4.2 * dotIn, 0, Math.PI * 2); ctx.fill();
    if (hp && t > STEP0 - 0.1) {
      const la = win(t, STEP0 - 0.1, 6.9, 0.3, 0.3);
      text(ctx, 't = ' + String(hp[1] + 1).padStart(2, '0'), dx, LINE_Y + 30, { f: F.mono11, tracking: 1.2, align: 'center', alpha: 0.55 * la, color: COL.q });
    }
  }

  // --- parallel flash (S3a): eleven heads at once
  if (t > 6.95 && t < 8.2) {
    const sp = easeOutExpo(prog(t, 6.98, 7.3));
    const fa = 1 - easeInCubic(prog(t, 7.35, 8.1));
    const from = row[10].cx;
    for (let i = 0; i < N; i++) {
      const x = lerp(from, row[i].cx, sp);
      glow(ctx, x, LINE_Y, 26, COL.q, 0.22 * fa);
      ctx.fillStyle = rgba(COL.q, fa);
      ctx.beginPath(); ctx.arc(x, LINE_Y, 3.6, 0, Math.PI * 2); ctx.fill();
    }
  }

  // --- RNN hidden-state chain (S2)
  const chainA = win(t, 3.3, 7.25, 0.4, 0.35);
  if (chainA > 0) {
    const cy = 566;
    const drop = 10 * easeInCubic(prog(t, 6.9, 7.25));
    text(ctx, 'h', row[0].x - 46, cy + 4 + drop, { f: font('ISI', 22), alpha: 0.5 * chainA });
    for (let i = 0; i < N; i++) {
      const ti = stepTime(i);
      const p = easeOutCubic(prog(t, ti - 0.05, ti + 0.2));
      if (p <= 0) continue;
      if (i > 0) {
        const lp = easeInOutCubic(prog(t, ti - 0.17, ti));
        ctx.strokeStyle = rgba(COL.ink, 0.28 * chainA);
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(row[i - 1].cx + 7, cy + drop); ctx.lineTo(lerp(row[i - 1].cx + 7, row[i].cx - 7, lp), cy + drop); ctx.stroke();
      }
      // memory of "animal" carried along the chain, fading with distance
      const mem = i >= 1 ? Math.exp(-(i - 1) / 1.9) : 0;
      const c = mix(COL.ink, COL.q, mem);
      ctx.strokeStyle = rgba(c, (0.35 + 0.6 * mem) * chainA * p);
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(row[i].cx, cy + drop, 5.5 * p, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = rgba(COL.q, mem * 0.95 * chainA * p);
      ctx.beginPath(); ctx.arc(row[i].cx, cy + drop, 3.4 * p, 0, Math.PI * 2); ctx.fill();
    }
  }

  // --- RNN's weak long-range link: dashed "it → animal ?"
  const qa = win(t, 5.35, 7.4, 0.3, 0.5);
  if (qa > 0) {
    const p = easeInOutCubic(prog(t, 5.4, 6.3));
    const pts = archPoints(row[IT].cx, TOK_Y - 50, row[1].cx, TOK_Y - 50, 92);
    ctx.save();
    ctx.setLineDash([3, 7]);
    ctx.strokeStyle = rgba(COL.ink, 0.42 * qa);
    ctx.lineWidth = 1.2;
    ctx.beginPath(); tracePartial(ctx, pts, 0, p); ctx.stroke();
    ctx.restore();
    const apex = pointAt(pts, 0.5);
    text(ctx, '?', apex[0], apex[1] - 14, { f: font('ISI', 34), align: 'center', alpha: 0.75 * qa * easeOutCubic(prog(t, 6.0, 6.4)), color: COL.q });
  }

  // --- all-to-all lattice (S3a)
  const webIn = prog(t, 7.12, 8.45);
  if (webIn > 0 && t < 13.7) {
    const fadeToFocus = lerp(1, 0.22, easeInOutCubic(prog(t, 9.55, 10.2)));
    const webOut = 1 - easeInOutCubic(prog(t, 12.9, 13.5));
    const breathe = (k) => 0.85 + 0.15 * Math.sin(t * 2.2 + k * 0.7);
    ctx.lineWidth = 1;
    let k = 0;
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++, k++) {
        const d = j - i;
        const x1 = row[i].cx + (d / 10) * row[i].w * 0.34;
        const x2 = row[j].cx - (d / 10) * row[j].w * 0.34;
        const h = 16 + 0.3 * (x2 - x1);
        const pts = archPoints(x1, TOK_Y - 50, x2, TOK_Y - 50, h, 40);
        const p = easeInOutCubic(clamp(webIn * 1.25 - (k % 7) * 0.035));
        if (p <= 0) continue;
        ctx.strokeStyle = rgba(COL.ink, 0.2 * fadeToFocus * webOut * breathe(k));
        ctx.beginPath();
        tracePartial(ctx, pts, 0, p / 2);
        tracePartial(ctx, pts, 1 - p / 2, 1);
        ctx.stroke();
      }
    }
  }

  // --- focus: arcs from "it" weighted by attention (S3b)
  const focus = win(t, 9.55, 13.45, 0.6, 0.5);
  const wts = itWeights(t);
  if (focus > 0) {
    const order = [...Array(N).keys()].filter((j) => j !== IT).sort((a, b) => wts[a] - wts[b]);
    for (const j of order) {
      const w = wts[j];
      const ox = row[IT].cx + (j < IT ? -3 : 3);
      const pts = archPoints(ox, TOK_Y - 50, row[j].cx, TOK_Y - 50, 22 + 0.34 * Math.abs(row[j].cx - ox), 56);
      const p = easeInOutCubic(prog(t, 9.62 + (Math.abs(j - IT) - 1) * 0.045, 10.45 + (Math.abs(j - IT) - 1) * 0.045));
      const hot = smooth(clamp((w - 0.18) / 0.3));
      ctx.strokeStyle = rgba(mix(COL.ink, COL.q, hot), (0.22 + 0.78 * Math.pow(w / 0.6, 0.6)) * focus);
      ctx.lineWidth = 0.9 + 6.2 * w;
      ctx.beginPath(); tracePartial(ctx, pts, 0, p); ctx.stroke();
      if (hot > 0.05 && p > 0.98) {
        const end = pts[pts.length - 1];
        glow(ctx, end[0], end[1], 30, COL.q, 0.22 * hot * focus);
      }
    }
    // weight bars under the rule + numbers
    for (let j = 0; j < N; j++) {
      const w = wts[j];
      const bp = easeOutCubic(prog(t, 9.9 + j * 0.03, 10.6 + j * 0.03));
      const morph = prog(t, 13.05, 13.95); // S4 takes over
      if (bp <= 0 || morph > 0) continue;
      const hot = smooth(clamp((w - 0.18) / 0.3));
      const bh = 96 * w * bp;
      ctx.fillStyle = rgba(mix(COL.ink, COL.q, hot), (0.5 + 0.5 * hot) * focus);
      ctx.fillRect(row[j].cx - 2, LINE_Y + 12, 4, Math.max(1, bh));
      text(ctx, w.toFixed(2), row[j].cx, LINE_Y + 96, { f: F.mono12, align: 'center', tracking: 0.5, color: hot > 0.5 ? COL.q : COL.ink, alpha: (0.38 + 0.6 * hot) * focus * bp });
    }
  }

  // --- tokens
  const tokOut = prog(t, 13.05, 14.3);
  for (let i = 0; i < N; i++) {
    // S2 brightness: dim until read, then decays (RNN memory)
    let b = 0;
    const tin = 3.12 + i * 0.03;
    const appear = easeOutCubic(prog(t, tin, tin + 0.6));
    if (appear <= 0) continue;
    if (t < 7.0) {
      const tr = stepTime(i);
      b = 0.26;
      if (t >= tr - 0.06) b = 0.26 + 0.74 * Math.exp(-Math.max(0, t - tr) / 0.62) * clamp((t - tr + 0.06) / 0.06);
    }
    const all = easeOutCubic(prog(t, 6.98, 7.25));
    b = lerp(b, 1, all);
    let c = COL.ink;
    const itHot = easeInOutCubic(prog(t, 9.6, 10.0)) * (1 - prog(t, 13.1, 13.6));
    if (i === IT) c = mix(COL.ink, COL.q, itHot);
    const word = i === 10 ? null : WORDS[i];
    const flight = easeInOutCubic(clamp((t - 13.08 - i * 0.028) / 0.95));
    if (flight > 0) {
      drawFlyingToken(ctx, WORDS[i] === 'tired' ? 'wide' : WORDS[i], row[i], i, flight, c);
      continue;
    }
    if (word) {
      const rise = (1 - easeOutExpo(prog(t, tin, tin + 0.7))) * 40;
      clipRise(ctx, row[i], () => text(ctx, word, row[i].cx, TOK_Y + rise, { f: F.tok, align: 'center', alpha: b * appear, color: c }));
    } else {
      // tired → wide swap
      const sp = prog(t, SWAP0, SWAP1);
      const rise = (1 - easeOutExpo(prog(t, tin, tin + 0.7))) * 40;
      const outP = easeInCubic(clamp(sp * 1.6));
      const inP = easeOutExpo(clamp(sp * 1.6 - 0.45));
      clipRise(ctx, row[i], () => {
        if (outP < 1) text(ctx, 'tired', row[i].x, TOK_Y + rise - outP * 46, { f: F.tok, alpha: b * appear * (1 - outP) });
        if (inP > 0) text(ctx, 'wide', row[i].x, TOK_Y - (1 - inP) * -46, { f: F.tok, alpha: b * inP, color: mix(COL.ink, COL.k, 0.9 * win(t, SWAP0 + 0.3, 13.0, 0.3, 1.2)) });
      });
    }
  }

  // underline on the attended word
  if (focus > 0) {
    const sp = easeInOutCubic(prog(t, SWAP0 + 0.2, SWAP1 + 0.15));
    const a = row[1], s = row[5];
    const x = lerp(a.x, s.x, sp), w = lerp(a.w, s.w, sp);
    const ua = easeOutCubic(prog(t, 10.2, 10.6)) * focus;
    ctx.fillStyle = rgba(COL.q, ua);
    ctx.fillRect(x, TOK_Y + 13, w * ua, 2);
    // swapped-word marker
    const ma = win(t, SWAP0 - 0.1, 12.9, 0.3, 0.5);
    if (ma > 0) {
      ctx.fillStyle = rgba(COL.k, 0.8 * ma);
      ctx.fillRect(row[10].x, TOK_Y + 13, row[10].w * easeOutCubic(prog(t, SWAP0, SWAP0 + 0.5)), 2);
    }
  }
}

function clipRise(ctx, r, fn) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x - 40, TOK_Y - TOK_SIZE * 1.2, r.w + 80, TOK_SIZE * 1.55);
  ctx.clip();
  fn();
  ctx.restore();
}

function drawFlyingToken(ctx, word, r, i, f, c) {
  // from sentence slot to a rotated column label above the matrix
  const tx = MX + i * MP + MP / 2 - 2, ty = MY - 12;
  const x = lerp(r.cx, tx, f), y = lerp(TOK_Y, ty, f);
  const size = lerp(TOK_SIZE, 17, f);
  const ang = lerp(0, -Math.PI * 0.3, f);
  const anchor = lerp(0.5, 0, f);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.font = font('ISR', size);
  const w = ctx.measureText(word).width;
  const hot = i === IT ? 1 : 0;
  const s4out = 1 - easeInOutCubic(prog(_t, 17.75, 18.25));
  ctx.fillStyle = rgba(hot ? COL.q : mix(c, COL.ink, f), lerp(1, 0.72, f) * s4out);
  ctx.fillText(word, -w * anchor, 0);
  ctx.restore();
}
let _t = 0;

// ---------------------------------------------------------------- S4 formula
function sceneFormula(ctx, t) {
  if (t < 13.6 || t > 18.6) return;
  const out = 1 - easeInOutCubic(prog(t, 17.7, 18.25));
  const slide = -40 * easeInCubic(prog(t, 17.7, 18.25));
  if (out <= 0) return;
  ctx.save();
  ctx.translate(slide, 0);
  const size = 66;
  const R = font('ISR', size), I = font('ISI', size);
  const RS = font('ISI', size * 0.58);
  const x0 = 120, y1 = 330, y2 = 470;
  // tokens of line 1
  const segs1 = [['Attention', R, COL.ink], ['(', R, COL.ink], ['Q', I, COL.q], [', ', R, COL.ink], ['K', I, COL.k], [', ', R, COL.ink], ['V', I, COL.v], [')', R, COL.ink]];
  let x = x0;
  const tIn = 14.15;
  segs1.forEach(([s, f, c], k) => {
    const p = prog(t, tIn + k * 0.05, tIn + k * 0.05 + 0.7);
    rise(ctx, s, x, y1, p, f, c, out);
    x += textWidth(ctx, s, f);
  });
  // line 2: = softmax( QK^T / sqrt(d_k) ) V
  const t2 = 14.55;
  x = x0;
  const eq = '= ';
  rise(ctx, eq, x, y2, prog(t, t2, t2 + 0.7), R, COL.ink, out * 0.8);
  x += textWidth(ctx, eq, R);
  rise(ctx, 'softmax', x, y2, prog(t, t2 + 0.06, t2 + 0.76), R, COL.ink, out);
  x += textWidth(ctx, 'softmax', R) + 8;
  const axis = y2 - size * 0.27;
  // fraction parts
  const wQ = textWidth(ctx, 'Q', I), wK = textWidth(ctx, 'K', I), wT = textWidth(ctx, 'T', RS);
  const numW = wQ + wK + 2 + wT;
  const wd = textWidth(ctx, 'd', I), wk = textWidth(ctx, 'k', RS);
  const denW = 30 + wd + wk;
  const fw = Math.max(numW, denW) + 26;
  const pIn = prog(t, t2 + 0.14, t2 + 0.84);
  // left paren
  paren(ctx, x + 18, axis + 6, 66, -1, easeOutCubic(pIn) * out);
  const fx = x + 38;
  // numerator
  const nx = fx + (fw - numW) / 2, ny = axis - 16;
  rise(ctx, 'Q', nx, ny, prog(t, t2 + 0.2, t2 + 0.9), I, COL.q, out);
  rise(ctx, 'K', nx + wQ + 2, ny, prog(t, t2 + 0.25, t2 + 0.95), I, COL.k, out);
  rise(ctx, 'T', nx + wQ + wK + 4, ny - size * 0.38, prog(t, t2 + 0.3, t2 + 1.0), RS, COL.k, out);
  // bar
  const bp = easeInOutCubic(prog(t, t2 + 0.3, t2 + 0.9));
  ctx.fillStyle = rgba(COL.ink, 0.9 * out);
  ctx.fillRect(fx, axis - 1, fw * bp, 2);
  // denominator with radical
  const dx = fx + (fw - denW) / 2, dyb = axis + size * 0.94;
  const rp = easeInOutCubic(prog(t, t2 + 0.35, t2 + 1.0));
  ctx.strokeStyle = rgba(COL.ink, 0.9 * out);
  ctx.lineWidth = 2;
  const rad = [[dx, dyb - 20], [dx + 6, dyb - 24], [dx + 14, dyb + 4], [dx + 26, dyb - size * 0.72], [dx + denW + 4, dyb - size * 0.72]];
  ctx.beginPath(); tracePartial(ctx, rad, 0, rp); ctx.stroke();
  rise(ctx, 'd', dx + 30, dyb, prog(t, t2 + 0.45, t2 + 1.1), I, COL.ink, out);
  rise(ctx, 'k', dx + 30 + wd + 1, dyb + size * 0.16, prog(t, t2 + 0.5, t2 + 1.15), RS, COL.k, out);
  // right paren and V
  paren(ctx, fx + fw + 20, axis + 6, 66, 1, easeOutCubic(pIn) * out);
  rise(ctx, 'V', fx + fw + 42, y2, prog(t, t2 + 0.5, t2 + 1.2), I, COL.v, out);

  // legend
  const LG = [
    [COL.q, 'Q', '查询', '我在找什么'],
    [COL.k, 'K', '键', '我有什么特征'],
    [COL.v, 'V', '值', '我携带的信息'],
  ];
  LG.forEach(([c, l, zh, ex], k) => {
    const ly = 598 + k * 52;
    const p = prog(t, 15.35 + k * 0.16, 16.05 + k * 0.16);
    rise(ctx, l, x0, ly, p, font('ISI', 36), c, out);
    rise(ctx, zh, x0 + 44, ly - 2, prog(t, 15.42 + k * 0.16, 16.12 + k * 0.16), font('SerifSC500', 22), COL.ink, out);
    rise(ctx, ex, x0 + 44 + 44 + 18, ly - 2, prog(t, 15.48 + k * 0.16, 16.18 + k * 0.16), font('SansSC400', 20), COL.ink, out * 0.6);
  });
  // leader from legend to formula letters: subtle hairline under line 1
  const ha = easeInOutCubic(prog(t, 15.2, 15.9)) * out;
  if (ha > 0) {
    ctx.strokeStyle = rgba(COL.ink, 0.14);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x0, 548); ctx.lineTo(x0 + 520 * ha, 548); ctx.stroke();
  }
  ctx.restore();
}

function rise(ctx, s, x, y, p, f, c, alpha = 1) {
  if (p <= 0 || alpha <= 0) return;
  const e = easeOutExpo(p);
  ctx.save();
  const size = parseFloat(f);
  ctx.beginPath();
  ctx.rect(x - 4, y - size * 1.1, textWidth(ctx, s, f) + 12, size * 1.45);
  ctx.clip();
  text(ctx, s, x, y + (1 - e) * size * 0.9, { f, color: c, alpha: clamp(p * 2) * alpha });
  ctx.restore();
}

function paren(ctx, x, y, h, dir, a) {
  if (a <= 0) return;
  // crescent-shaped parenthesis, thick in the middle; dir -1 = "(", +1 = ")"
  const top = y - h, bot = y + h * 0.95, mid = (top + bot) / 2;
  ctx.fillStyle = rgba(COL.ink, 0.9 * a);
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.quadraticCurveTo(x + dir * 30, mid, x, bot);
  ctx.quadraticCurveTo(x + dir * 24.5, mid, x, top);
  ctx.fill();
}

// ---------------------------------------------------------------- S4 matrix / S5 heads
function sceneMatrix(ctx, t) {
  if (t < 13.0 || t > 21.6) return;
  const wts = itWeights(t);
  const row = tokenRow(t);
  // row labels
  const labA = win(t, 13.7, 18.2, 0.5, 0.45);
  if (labA > 0) {
    for (let i = 0; i < N; i++) {
      const p = easeOutCubic(prog(t, 13.75 + i * 0.03, 14.4 + i * 0.03));
      const w = i === 10 ? 'wide' : WORDS[i];
      text(ctx, w, MX - 12 - (1 - p) * 10, MY + i * MP + MP / 2 + 6, { f: font('ISR', 17), align: 'right', alpha: (i === IT ? 1 : 0.62) * labA * p, color: i === IT ? COL.q : COL.ink });
    }
    // axis captions
    text(ctx, 'QUERY ↓', MX - 12, MY + N * MP + 30, { f: F.mono11, align: 'right', tracking: 1.6, alpha: 0.4 * labA * easeOutCubic(prog(t, 14.3, 14.9)), color: COL.q });
    text(ctx, 'KEY →', MX + N * MP, MY + N * MP + 30, { f: F.mono11, align: 'right', tracking: 1.6, alpha: 0.4 * labA * easeOutCubic(prog(t, 14.3, 14.9)), color: COL.k });
  }

  // softmax row: outline + Σ = 1
  const ra = win(t, 16.0, 17.85, 0.4, 0.35);
  if (ra > 0) {
    const p = easeInOutCubic(prog(t, 16.0, 16.7));
    const x = MX - 4, y = MY + IT * MP + 1, w = N * MP + 8, hh = MP - 2;
    const pts = [[x, y], [x + w, y], [x + w, y + hh], [x, y + hh], [x, y]];
    ctx.strokeStyle = rgba(COL.q, 0.85 * ra);
    ctx.lineWidth = 1.2;
    ctx.beginPath(); tracePartial(ctx, pts, 0, p); ctx.stroke();
    text(ctx, 'Σ = 1', x + w + 14, y + hh / 2 + 5, { f: F.mono13, tracking: 1, color: COL.q, alpha: ra * easeOutCubic(prog(t, 16.4, 16.9)) });
  }

  // S5 geometry: matrix → 8 heads → concat strip → MHA box
  const toHeads = easeInOutQuart(prog(t, 17.8, 18.45));
  const spread = (k) => easeInOutQuart(prog(t, 18.38 + Math.abs(k - 3.5) * 0.025, 19.08 + Math.abs(k - 3.5) * 0.025));
  const centerX = 960 - HSIZE / 2;
  const concat = easeInOutQuart(prog(t, 20.05, 20.6));
  const toBox = easeInOutQuart(prog(t, 20.55, 21.15));
  const boxFade = prog(t, 21.1, 21.35);
  if (boxFade >= 1) return;

  const nHeads = t < 18.38 ? 1 : 8;
  const order = [3, 4, 2, 5, 1, 6, 7, 0].filter((h) => h < nHeads);
  for (const h of order) {
    const M = HEADS[h];
    // head-local placement
    const hx0 = H_X0 + h * (HSIZE + HGAP);
    const sp = spread(h);
    // concat: gaps close around centre
    const cx0 = 960 - (8 * HSIZE) / 2 + h * HSIZE;
    let ox = lerp(centerX, hx0, sp);
    let oy = H_Y;
    let pitch = HP;
    // matrix (S4) state for head 0: shrink into the centre slot, then fan out
    if (h === 0) {
      const sx = lerp(MX, centerX, toHeads);
      ox = lerp(sx, hx0, sp);
      oy = lerp(MY, H_Y, toHeads);
      pitch = lerp(MP, HP, toHeads);
    }
    ox = lerp(ox, cx0, concat);
    const cell = pitch * (MC / MP);
    // morph pattern from head 0 as it spreads out
    const patternMix = h === 0 ? 1 : easeInOutCubic(prog(t, 18.5 + h * 0.03, 19.2 + h * 0.03));
    const hc = HEAD_COL[h];
    const headA = h === 0 ? 1 : clamp(sp * 5);
    // collapse into MHA box (S6)
    const bx = XE - BW / 2, by = ARCH.enc[1].y - BH / 2;
    const stripX0 = 960 - (8 * HSIZE) / 2;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        let w = M[i][j];
        if (h > 0) w = lerp(MAT[i][j], M[i][j], patternMix);
        if (h === 0 && i === IT && t < 14.5) w = wts[j];
        // cascade in (S4)
        let ap = 1;
        if (h === 0) {
          if (i === IT) ap = 1;
          else ap = easeOutCubic(prog(t, 13.9 + (i + j) * 0.022, 14.5 + (i + j) * 0.022));
        }
        if (ap <= 0) continue;
        let x = ox + j * pitch + (pitch - cell) / 2, y = oy + i * pitch + (pitch - cell) / 2, cw = cell, chh = cell;
        // the "it" row of head 0 grows out of the weight bars
        if (h === 0 && i === IT) {
          const m = easeInOutCubic(prog(t, 13.05 + j * 0.02, 13.95 + j * 0.02));
          const bh = Math.max(1, 96 * wts[j]);
          x = lerp(row[j].cx - 2, x, m); y = lerp(LINE_Y + 12, y, m); cw = lerp(4, cw, m); chh = lerp(bh, chh, m);
        }
        if (toBox > 0) {
          const sx = (x - stripX0) / (8 * HSIZE), sy = (y - oy) / (N * pitch);
          x = lerp(x, bx + sx * BW, toBox); y = lerp(y, by + sy * BH, toBox);
          cw = lerp(cw, (BW / (8 * N)) * 0.9, toBox); chh = lerp(chh, (BH / N) * 0.9, toBox);
        }
        let c = h === 0 ? (i === IT ? COL.q : COL.ink) : hc;
        if (h === 0 && toHeads > 0) c = mix(c, i === IT ? COL.q : HEAD_COL[0], toHeads * 0.5);
        const al = cellAlpha(w) * ap * headA * (1 - boxFade) * (h === 0 && i !== IT ? 0.8 : 1);
        ctx.fillStyle = rgba(c, al);
        if (cw > 6) { ctx.beginPath(); roundRect(ctx, x, y, cw, chh, Math.min(3, cw * 0.12)); ctx.fill(); }
        else ctx.fillRect(x, y, cw, chh);
      }
    }
    // faint frame per head
    const fa = (h === 0 ? win(t, 13.9, 21.0, 0.6, 0.4) : headA * (1 - concat)) * 0.16;
    if (fa > 0 && toBox < 0.5) {
      ctx.strokeStyle = rgba(COL.ink, fa);
      ctx.lineWidth = 1;
      ctx.strokeRect(ox - 0.5 - 4, oy - 0.5 - 4, N * pitch + 8, N * pitch + 8);
    }
    // labels
    const la = win(t, 18.95 + h * 0.04, 20.2, 0.45, 0.35);
    if (la > 0) {
      text(ctx, 'HEAD ' + (h + 1), ox, oy - 16, { f: F.mono11, tracking: 1.6, alpha: 0.55 * la, color: h === 0 ? COL.q : COL.ink });
    }
  }
  // concat bracket
  const ca = win(t, 19.35, 20.75, 0.45, 0.4);
  if (ca > 0) {
    const y = H_Y + HSIZE + 26;
    const x0 = H_X0, x1 = H_X0 + 8 * HSIZE + 7 * HGAP;
    const p = easeInOutCubic(prog(t, 19.35, 19.95));
    ctx.strokeStyle = rgba(COL.ink, 0.35 * ca);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(960 - (960 - x0) * p, y - 8); ctx.lineTo(960 - (960 - x0) * p, y); ctx.lineTo(960 + (x1 - 960) * p, y); ctx.lineTo(960 + (x1 - 960) * p, y - 8);
    ctx.stroke();
    text(ctx, 'CONCAT  →  LINEAR', 960, y + 30, { f: F.mono12, tracking: 3, align: 'center', alpha: 0.6 * ca });
    text(ctx, 'h = 8', 960, H_Y - 62, { f: font('ISI', 30), align: 'center', alpha: 0.85 * win(t, 18.6, 20.4, 0.5, 0.4) });
  }
}

// ---------------------------------------------------------------- S6 architecture
function box(ctx, cx, cy, label, o) {
  const { p, a, attn = false, thin = false, hot = 0 } = o;
  if (p <= 0 || a <= 0) return;
  const w = BW, h = thin ? 26 : BH;
  const x = cx - w / 2, y = cy - h / 2;
  const c = attn ? mix(COL.ink, COL.q, 0.85) : COL.ink;
  if (attn) {
    ctx.fillStyle = rgba(COL.q, (0.1 + 0.25 * hot) * a * p);
    ctx.beginPath(); roundRect(ctx, x, y, w, h, 5); ctx.fill();
  }
  const pts = [[x + w / 2, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y], [x + w / 2, y]];
  ctx.strokeStyle = rgba(c, (attn ? 0.9 : 0.42 + (thin ? -0.12 : 0)) * a);
  ctx.lineWidth = attn ? 1.4 : 1;
  ctx.beginPath(); tracePartial(ctx, pts, 0, easeInOutCubic(p)); ctx.stroke();
  if (!attn) {
    ctx.fillStyle = rgba(COL.ink, 0.035 * a * p);
    ctx.beginPath(); roundRect(ctx, x, y, w, h, 4); ctx.fill();
  }
  text(ctx, label, cx, cy + 4.6, { f: thin ? F.mono12 : F.mono13, align: 'center', tracking: 0.3, color: COL.ink, alpha: (thin ? 0.52 : 0.85) * a * clamp(p * 1.6 - 0.4) });
}
function arrow(ctx, pts, p, a, c = COL.ink, al = 0.4) {
  if (p <= 0 || a <= 0) return;
  ctx.strokeStyle = rgba(c, al * a);
  ctx.lineWidth = 1;
  ctx.beginPath(); tracePartial(ctx, pts, 0, p); ctx.stroke();
  if (p > 0.98) {
    const [x2, y2] = pts[pts.length - 1], [x1, y1] = pts[pts.length - 2];
    const ang = Math.atan2(y2 - y1, x2 - x1);
    ctx.fillStyle = rgba(c, al * 1.4 * a);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - 7 * Math.cos(ang - 0.42), y2 - 7 * Math.sin(ang - 0.42));
    ctx.lineTo(x2 - 7 * Math.cos(ang + 0.42), y2 - 7 * Math.sin(ang + 0.42));
    ctx.fill();
  }
}

function sceneArch(ctx, t) {
  if (t < 20.9 || t > 26.8) return;
  const a = win(t, 20.95, 26.75, 0.15, 0.6);
  const shift = easeInOutQuart(prog(t, 23.5, 24.15));
  const dim = lerp(1, 0.4, shift);
  ctx.save();
  // collapse into the timeline origin (S7): shrink about the diagram's centre while flying to the dot
  const col = easeInOutQuart(prog(t, 26.05, 26.6));
  if (col > 0) {
    const cx = 630, cy = 500, k = 1 - 0.96 * col;
    ctx.translate(lerp(cx, 300, col), lerp(cy, 470, col));
    ctx.scale(k, k);
    ctx.translate(-cx, -cy);
  }
  // move left & shrink for the results
  ctx.translate(lerp(0, -330, shift), lerp(0, 20, shift));
  ctx.translate(960, 480); ctx.scale(lerp(1, 0.86, shift), lerp(1, 0.86, shift)); ctx.translate(-960, -480);
  const A = a * dim * (1 - col);
  const base = 21.0;
  const bp = (k) => prog(t, base + 0.04 * k, base + 0.04 * k + 0.55);
  // encoder
  ARCH.enc.forEach((b, k) => {
    const p = b.id === 'mha' ? 1 : bp(k);
    const hot = b.attn ? pulseAt(t, 22.4) : 0;
    box(ctx, XE, b.y, b.label, { p, a: b.id === 'mha' ? A * easeOutCubic(prog(t, 21.05, 21.35)) : A, attn: b.attn, thin: b.thin, hot });
  });
  ARCH.dec.forEach((b, k) => {
    const hot = b.attn ? pulseAt(t, b.id === 'mmha' ? 22.6 : 22.85) : 0;
    box(ctx, XD, b.y, b.label, { p: bp(k + 2), a: A, attn: b.attn, thin: b.thin, hot });
  });
  // ⊕ and positional encodings
  for (const [cx, side] of [[XE, -1], [XD, 1]]) {
    const p = easeOutCubic(prog(t, base + 0.1, base + 0.6));
    ctx.strokeStyle = rgba(COL.ink, 0.6 * A * p);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, PLUS_Y, 9, 0, Math.PI * 2); ctx.moveTo(cx - 5, PLUS_Y); ctx.lineTo(cx + 5, PLUS_Y); ctx.moveTo(cx, PLUS_Y - 5); ctx.lineTo(cx, PLUS_Y + 5); ctx.stroke();
    // sine-wave icon
    const ix = cx + side * 178;
    ctx.strokeStyle = rgba(COL.k, 0.85 * A * p);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let k = 0; k <= 40; k++) {
      const u = k / 40;
      const xx = ix - 22 + u * 44, yy = PLUS_Y + Math.sin(u * Math.PI * 4 + t * 5) * 6;
      if (k === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
    }
    ctx.stroke();
    ctx.strokeStyle = rgba(COL.ink, 0.3 * A * p);
    ctx.beginPath(); ctx.moveTo(ix - side * 28, PLUS_Y); ctx.lineTo(cx + side * 12, PLUS_Y); ctx.stroke();
    text(ctx, 'Positional', ix, PLUS_Y + 30, { f: F.mono11, align: 'center', alpha: 0.5 * A * p });
    text(ctx, 'Encoding', ix, PLUS_Y + 44, { f: F.mono11, align: 'center', alpha: 0.5 * A * p });
  }
  // N× frames
  const fp = easeInOutCubic(prog(t, base + 0.35, base + 1.0));
  ctx.save();
  ctx.setLineDash([2, 5]);
  ctx.strokeStyle = rgba(COL.ink, 0.25 * A);
  ctx.lineWidth = 1;
  const fr = (x, y, w, h) => { const pts = [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]; ctx.beginPath(); tracePartial(ctx, pts, 0, fp); ctx.stroke(); };
  fr(XE - BW / 2 - 18, 456, BW + 36, 210);
  fr(XD - BW / 2 - 18, 336, BW + 36, 330);
  ctx.restore();
  text(ctx, '6×', XE - BW / 2 - 30, 566, { f: font('ISI', 30), align: 'right', alpha: 0.85 * A * fp });
  text(ctx, '×6', XD + BW / 2 + 30, 506, { f: font('ISI', 30), alpha: 0.85 * A * fp });
  // io labels
  const io = easeOutCubic(prog(t, base + 0.2, base + 0.8));
  text(ctx, 'Inputs', XE, 800, { f: F.mono12, align: 'center', tracking: 1, alpha: 0.5 * A * io });
  text(ctx, 'Outputs (shifted right)', XD, 800, { f: F.mono12, align: 'center', tracking: 1, alpha: 0.5 * A * io });
  text(ctx, 'Output Probabilities', XD, 196, { f: F.mono12, align: 'center', tracking: 1, alpha: 0.5 * A * easeOutCubic(prog(t, base + 0.6, base + 1.1)) });
  // arrows
  const ap = (k) => easeInOutCubic(prog(t, base + 0.25 + k * 0.05, base + 0.75 + k * 0.05));
  const up = (x, y1, y2, k) => arrow(ctx, [[x, y1], [x, y2]], ap(k), A);
  up(XE, 786, 742 + 18, 0); up(XD, 786, 742 + 18, 0);
  up(XE, 742 - 17, PLUS_Y + 10, 1); up(XD, 742 - 17, PLUS_Y + 10, 1);
  up(XE, PLUS_Y - 10, 640 + 18, 2); up(XD, PLUS_Y - 10, 640 + 18, 2);
  up(XE, 640 - 17, 590 + 14, 3); up(XE, 590 - 13, 530 + 18, 4); up(XE, 530 - 17, 480 + 14, 5);
  up(XD, 640 - 17, 590 + 14, 3); up(XD, 590 - 13, 520 + 18, 4); up(XD, 520 - 17, 470 + 14, 5); up(XD, 470 - 13, 410 + 18, 6); up(XD, 410 - 17, 360 + 14, 7);
  up(XD, 360 - 13, 290 + 18, 8); up(XD, 290 - 17, 240 + 18, 9); up(XD, 240 - 17, 206, 10);
  // encoder → decoder cross attention
  const cross = [[XE, 480 - 13], [XE, 430], [XD - BW / 2 - 40, 430], [XD - BW / 2 - 40, 560], [XD - 40, 560], [XD - 40, 520 + 18]];
  arrow(ctx, cross, ap(7), A, COL.q, 0.55);
  // residual skips
  ctx.strokeStyle = rgba(COL.ink, 0.18 * A);
  ctx.lineWidth = 1;
  const skip = (x, y1, y2, k, side = -1) => {
    const pts = [[x, y1], [x + side * (BW / 2 + 9), y1], [x + side * (BW / 2 + 9), y2], [x + side * (BW / 2), y2]];
    ctx.beginPath(); tracePartial(ctx, pts, 0, ap(k)); ctx.stroke();
  };
  skip(XE, 670, 590, 3); skip(XE, 565, 480, 5);
  skip(XD, 670, 590, 3, 1); skip(XD, 560, 470, 5, 1); skip(XD, 450, 360, 7, 1);

  // data pulse travelling up through the model
  const pp = prog(t, 22.15, 23.4);
  if (pp > 0 && pp < 1) {
    const path = [[XE, 800], [XE, 430], [XD - BW / 2 - 40, 430], [XD - BW / 2 - 40, 560], [XD, 560], [XD, 200]];
    const [px, py] = pointAt(path, easeInOutCubic(pp));
    const pa = Math.sin(pp * Math.PI);
    glow(ctx, px, py, 40, COL.q, 0.5 * pa * A);
    ctx.fillStyle = rgba(COL.q, pa * A);
    ctx.beginPath(); ctx.arc(px, py, 3.6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
const pulseAt = (t, tc) => Math.exp(-Math.pow((t - tc) / 0.22, 2));

// ---------------------------------------------------------------- S6 results
function sceneStats(ctx, t) {
  if (t < 23.55 || t > 26.5) return;
  const a = win(t, 23.6, 26.45, 0.4, 0.45);
  const rows = [
    { v: 28.4, dec: 1, unit: 'BLEU', zh: 'WMT 2014 英→德 翻译', note: '超越此前最佳（含集成模型）2 分以上' },
    { v: 41.8, dec: 1, unit: 'BLEU', zh: 'WMT 2014 英→法 翻译', note: '单模型新纪录' },
    { v: 3.5, dec: 1, unit: '天', zh: '8 块 P100 GPU 完成训练', note: '训练成本仅为同期最佳模型的一小部分' },
  ];
  const x0 = 1130;
  rows.forEach((r, k) => {
    const t0 = 23.78 + k * 0.2;
    const p = prog(t, t0, t0 + 0.9);
    if (p <= 0) return;
    const y = 318 + k * 172;
    const cnt = r.v * easeOutQuart(prog(t, t0, t0 + 1.1));
    const num = cnt.toFixed(r.dec);
    const NF = font('ISR', 104);
    const out = 1 - easeInCubic(prog(t, 25.95, 26.4));
    rise(ctx, num, x0, y, p, NF, COL.ink, a * out);
    const nw = textWidth(ctx, r.v.toFixed(r.dec), NF);
    if (r.unit === '天') rise(ctx, r.unit, x0 + nw + 14, y, prog(t, t0 + 0.1, t0 + 0.9), font('SerifSC500', 34), COL.ink, a * out * 0.9);
    else rise(ctx, r.unit, x0 + nw + 16, y - 6, prog(t, t0 + 0.1, t0 + 0.9), F.mono13, COL.ink, a * out * 0.65);
    rise(ctx, r.zh, x0 + 4, y + 40, prog(t, t0 + 0.15, t0 + 0.95), font('SansSC400', 19), COL.ink, a * out * 0.85);
    rise(ctx, r.note, x0 + 4, y + 68, prog(t, t0 + 0.22, t0 + 1.0), font('SansSC400', 16), COL.q, a * out * 0.85);
    if (k < 2) {
      const lp = easeInOutCubic(prog(t, t0 + 0.2, t0 + 0.9));
      ctx.fillStyle = rgba(COL.ink, 0.12 * a * out);
      ctx.fillRect(x0, y + 96, 560 * lp, 1);
    }
  });
}

// ---------------------------------------------------------------- S7 legacy timeline
function sceneTimeline(ctx, t) {
  if (t < 26.0 || t > 28.5) return;
  const a = win(t, 26.1, 28.35, 0.3, 0.4);
  const y = 470;
  const ms = [
    ['2017', 'Transformer'], ['2018', 'GPT · BERT'], ['2019', 'GPT-2 · T5'], ['2020', 'GPT-3 · ViT'], ['2022', 'ChatGPT'], ['今天', '大语言模型'],
  ];
  const x0 = 300, dx = 264;
  const lp = easeInOutQuart(prog(t, 26.35, 27.15));
  // base rule
  ctx.strokeStyle = rgba(COL.ink, 0.22 * a);
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + (dx * 5 + 60) * lp, y); ctx.stroke();
  // lineage in vermillion
  ctx.strokeStyle = rgba(COL.q, 0.9 * a);
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + dx * 5 * easeInOutQuart(prog(t, 26.5, 27.5)), y); ctx.stroke();
  ms.forEach(([yr, name], k) => {
    const x = x0 + k * dx;
    const t0 = 26.5 + k * 0.14;
    const p = prog(t, t0, t0 + 0.7);
    if (p <= 0) return;
    if (k > 0) {
      ctx.fillStyle = rgba(COL.ink, 0.8 * a * easeOutCubic(p));
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    }
    const yf = yr === '今天' ? font('SansSC400', 13) : F.mono12;
    rise(ctx, yr, x - textWidth(ctx, yr, yf, 0) / 2, y - 26, p, yf, k === 0 ? COL.q : COL.ink, a * 0.7);
    const nf = k === 5 ? font('SerifSC500', 26) : font('ISR', 32);
    rise(ctx, name, x - textWidth(ctx, name, nf) / 2, y + 52, prog(t, t0 + 0.05, t0 + 0.75), nf, COL.ink, a * (k === 0 ? 1 : 0.88));
  });
}

// the focus dot carried from the timeline origin to the end card
function lateDot(ctx, t) {
  if (t < 26.2) return;
  const oa = easeOutExpo(prog(t, 26.25, 26.6));
  const fly = easeInOutCubic(prog(t, 27.85, 28.4));
  const x = lerp(300, 960, fly), y = lerp(470, 404, fly);
  const r = lerp(5, 4.6, fly);
  const pulse = 1 + 0.7 * Math.exp(-Math.pow((t - 28.5) / 0.2, 2));
  glow(ctx, x, y, lerp(40, 36, fly) * pulse, COL.q, lerp(0.35, 0.3, fly) * oa);
  ctx.fillStyle = rgba(COL.q, oa);
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

// ---------------------------------------------------------------- end card
function sceneEnd(ctx, t) {
  if (t < 28.0) return;
  const title = 'Attention Is All You Need';
  const f = font('ISR', 96);
  const L = layout(ctx, title, f);
  const x0 = 960 - L.width / 2, y = 528;
  ctx.font = f;
  ctx.fillStyle = rgba(COL.ink);
  for (let i = 0; i < L.chars.length; i++) {
    const ti = 28.12 + i * 0.012;
    const p = prog(t, ti, ti + 0.75);
    if (p <= 0) continue;
    const e = easeOutCubic(p);
    ctx.globalAlpha = e;
    defocusGlyph(ctx, L.chars[i], x0 + L.xs[i], y + 12 * (1 - easeOutExpo(p)), 12 * (1 - e));
  }
  ctx.globalAlpha = 1;
  reveal(ctx, '注意力，就是你所需要的一切', 960, 606, t, { f: font('SerifSC400', 26), size: 26, tracking: 8, align: 'center', alpha: 0.85, tIn: 28.4, stagger: 0.03, durIn: 0.8 });
  reveal(ctx, 'VASWANI ET AL.  ·  2017', 960, 668, t, { f: F.mono13, size: 13, tracking: 3.4, align: 'center', alpha: 0.5, tIn: 28.6, stagger: 0.012 });
}
