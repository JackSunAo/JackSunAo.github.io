// Chapters 08–10 and the end card (94–120 s): Table 1, results, legacy.
import {
  clamp, lerp, prog, easeOutCubic, easeInCubic, easeInOutCubic, easeOutExpo, easeOutQuart, easeInOutQuart, win,
  COL, rgba, mix, font, layout, textWidth, text, reveal, defocusGlyph, glow, archPoints, tracePartial, setFade,
} from './lib.mjs';
import { F, BEAT, shot } from './long_common.mjs';

// text that rises out of a mask
function rise(ctx, s, x, y, p, f, c, alpha = 1, align = 'left') {
  if (p <= 0 || alpha <= 0) return;
  const size = parseFloat(f);
  const w = textWidth(ctx, s, f);
  const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  const e = easeOutExpo(p);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0 - 6, y - size * 1.1, w + 14, size * 1.45);
  ctx.clip();
  text(ctx, s, x0, y + (1 - e) * size * 0.9, { f, color: c, alpha: clamp(p * 2) * alpha });
  ctx.restore();
}

// ================================================================ 08 · Table 1 — why self-attention
const NODES = 16, NX0 = 560, NDX = 36;
const nx = (i) => NX0 + i * NDX;
const ROWS = [
  { name: 'Self-Attention', y: 330, t0: 94.5, vals: ['O(n²·d)', 'O(1)', 'O(1)'], hops: 1 },
  { name: 'Recurrent', y: 480, t0: 96.0, vals: ['O(n·d²)', 'O(n)', 'O(n)'], hops: 15 },
  { name: 'Convolutional', y: 630, t0: 98.0, vals: ['O(k·n·d²)', 'O(1)', 'O(log_k n)'], hops: 3 },
];
const COLX = [1300, 1500, 1700];

export function sceneTable(ctx, t) {
  const A = shot(t, 93.9, 102.0, 0.5, 0.5);
  if (A <= 0) return;
  setFade(A);
  const ha = easeOutCubic(prog(t, 94.2, 94.9));
  text(ctx, '从第 1 个位置，走到第 16 个位置', NX0, 214, { f: font('SansSC400', 15), alpha: 0.6 * ha });
  ['每层计算量', '串行步数', '最长路径'].forEach((s, k) => text(ctx, s, COLX[k], 214, { f: font('SansSC500', 15), align: 'center', alpha: 0.65 * ha }));
  ctx.fillStyle = rgba(COL.ink, 0.16 * ha);
  ctx.fillRect(110, 236, 1700, 1);
  const emph = easeInOutCubic(prog(t, 99.6, 100.4));
  ROWS.forEach((R, ri) => {
    const rp = easeOutCubic(prog(t, R.t0 - 0.2, R.t0 + 0.4));
    const dim = ri === 0 ? 1 : lerp(1, 0.32, emph);
    const a = rp * dim;
    text(ctx, R.name, 130, R.y + 10, { f: font('ISR', 34), alpha: a, color: ri === 0 ? mix(COL.ink, COL.q, emph * 0.8) : COL.ink });
    // the sixteen positions
    for (let i = 0; i < NODES; i++) {
      const on = i === 0 || i === NODES - 1;
      ctx.fillStyle = rgba(on ? COL.ink : COL.ink, (on ? 0.9 : 0.4) * a);
      ctx.beginPath(); ctx.arc(nx(i), R.y, on ? 4.2 : 2.6, 0, Math.PI * 2); ctx.fill();
    }
    // the path from 1 to 16
    let hopsDone = 0;
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = rgba(COL.q, 0.95 * a);
    if (ri === 0) {
      const p = easeInOutCubic(prog(t, R.t0, R.t0 + 0.9));
      const pts = archPoints(nx(0), R.y - 6, nx(NODES - 1), R.y - 6, 62, 56);
      ctx.beginPath(); tracePartial(ctx, pts, 0, p); ctx.stroke();
      hopsDone = p > 0.98 ? 1 : 0;
    } else if (ri === 1) {
      for (let k = 0; k < 15; k++) {
        const p = easeOutCubic(prog(t, R.t0 + 0.2 + k * 0.1, R.t0 + 0.2 + k * 0.1 + 0.18));
        if (p <= 0) continue;
        ctx.beginPath(); ctx.moveTo(nx(k), R.y); ctx.lineTo(lerp(nx(k), nx(k + 1), p), R.y); ctx.stroke();
        if (p > 0.95) hopsDone = k + 1;
      }
    } else {
      const jumps = [[0, 9], [9, 12], [12, 15]];
      jumps.forEach(([a0, b0], k) => {
        const p = easeInOutCubic(prog(t, R.t0 + 0.2 + k * 0.3, R.t0 + 0.2 + k * 0.3 + 0.4));
        if (p <= 0) return;
        const pts = archPoints(nx(a0), R.y - 6, nx(b0), R.y - 6, 14 + 4.5 * (b0 - a0), 40);
        ctx.beginPath(); tracePartial(ctx, pts, 0, p); ctx.stroke();
        if (p > 0.98) hopsDone = k + 1;
      });
    }
    if (hopsDone > 0) text(ctx, hopsDone + ' 步', nx(NODES - 1) + 34, R.y + 8, { f: font('SerifSC500', 22), color: COL.q, alpha: a });
    // the numbers
    R.vals.forEach((v, k) => {
      const hot = ri === 0 && k > 0;
      const c = hot ? mix(COL.ink, COL.q, emph) : COL.ink;
      rise(ctx, v, COLX[k], R.y + 8, prog(t, R.t0 + 0.1 + k * 0.12, R.t0 + 0.8 + k * 0.12), font('Mono500', 20), c, dim, 'center');
    });
    if (ri === 0 && emph > 0) {
      ctx.strokeStyle = rgba(COL.q, 0.8 * emph);
      ctx.lineWidth = 1.2;
      ctx.beginPath(); roundRect2(ctx, 110, R.y - 62, 1700, 124, 6); ctx.stroke();
    }
  });
  setFade(1);
}
function roundRect2(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
}

// ================================================================ 09 · results
const BLEU = [
  ['ByteNet', 23.75], ['GNMT + RL', 24.6], ['ConvS2S', 25.16], ['MoE', 26.03],
  ['GNMT + RL (ens.)', 26.30], ['ConvS2S (ens.)', 26.36], ['Transformer (base)', 27.3], ['Transformer (big)', 28.4],
];
export function sceneResults(ctx, t) {
  const A = shot(t, 101.9, 110.0, 0.5, 0.5);
  if (A <= 0) return;
  setFade(A);
  const ta = easeOutCubic(prog(t, 102.2, 102.9));
  text(ctx, 'WMT 2014  EN→DE  ·  BLEU', 130, 214, { f: F.mono13, tracking: 2, alpha: 0.6 * ta });
  BLEU.forEach(([name, v], k) => {
    const y = 250 + k * 52;
    const p = easeOutCubic(prog(t, 102.5 + k * BEAT, 102.5 + k * BEAT + 0.55));
    const hot = k === BLEU.length - 1;
    const w = ((v - 22) / 7) * 560 * p;
    text(ctx, name, 350, y + 19, { f: font(hot ? 'Mono500' : 'Mono400', 13), align: 'right', alpha: (hot ? 1 : 0.6) * p, color: hot ? COL.q : COL.ink });
    ctx.fillStyle = rgba(hot ? COL.q : mix(COL.ink, COL.k, 0.35), (hot ? 0.95 : 0.5) * p);
    ctx.fillRect(370, y, Math.max(1, w), 26);
    text(ctx, (22 + (w / 560) * 7).toFixed(2), 370 + w + 12, y + 19, { f: font('Mono500', 14), alpha: (hot ? 1 : 0.65) * p, color: hot ? COL.q : COL.ink });
  });
  text(ctx, '数据：论文 Table 2　·　横轴自 22 BLEU 起', 130, 690, { f: font('SansSC400', 12), alpha: 0.38 * ta });

  const blocks = [
    { y: 300, v: 28.4, dec: 1, unit: 'BLEU', zh: 'WMT 2014 英→德', note: '超越此前最佳（含集成模型）2 分以上', t0: 106.0 },
    { y: 470, v: 41.8, dec: 1, unit: 'BLEU', zh: 'WMT 2014 英→法', note: '单模型新纪录', t0: 106.5 },
    { y: 640, v: 3.5, dec: 1, unit: '天', zh: '8 块 P100 GPU 完成训练', note: '基础模型仅需 12 小时', t0: 107.0 },
  ];
  const X0 = 1190;
  blocks.forEach((b, k) => {
    const p = prog(t, b.t0, b.t0 + 0.9);
    if (p <= 0) return;
    const num = (b.v * easeOutQuart(prog(t, b.t0, b.t0 + 1.2))).toFixed(b.dec);
    const NF = font('ISR', 112);
    rise(ctx, num, X0, b.y, p, NF, COL.ink, 1);
    const nw = textWidth(ctx, b.v.toFixed(b.dec), NF);
    if (b.unit === '天') rise(ctx, b.unit, X0 + nw + 14, b.y, prog(t, b.t0 + 0.1, b.t0 + 0.9), font('SerifSC500', 34), COL.ink, 0.9);
    else rise(ctx, b.unit, X0 + nw + 16, b.y - 6, prog(t, b.t0 + 0.1, b.t0 + 0.9), F.mono13, COL.ink, 0.65);
    rise(ctx, b.zh, X0 + 4, b.y + 38, prog(t, b.t0 + 0.15, b.t0 + 0.95), font('SansSC400', 19), COL.ink, 0.85);
    rise(ctx, b.note, X0 + 4, b.y + 66, prog(t, b.t0 + 0.22, b.t0 + 1.0), font('SansSC400', 16), COL.q, 0.9);
    if (k < 2) {
      ctx.fillStyle = rgba(COL.ink, 0.12 * easeInOutCubic(prog(t, b.t0 + 0.2, b.t0 + 0.9)));
      ctx.fillRect(X0, b.y + 92, 540, 1);
    }
  });
  setFade(1);
}

// ================================================================ 10 · legacy + end card
const MS = [['2017', 'Transformer'], ['2018', 'GPT · BERT'], ['2019', 'GPT-2 · T5'], ['2020', 'GPT-3 · ViT'], ['2022', 'ChatGPT'], ['今天', '大语言模型']];
export function sceneLegacy(ctx, t) {
  if (t < 109.9 || t > 120) return;
  const A = shot(t, 110.0, 115.6, 0.3, 0.4);
  const y = 470, x0 = 300, dx = 264;
  if (A > 0) {
    ctx.strokeStyle = rgba(COL.ink, 0.22 * A);
    ctx.lineWidth = 1;
    const lp = easeInOutQuart(prog(t, 110.4, 111.4));
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + (dx * 5 + 60) * lp, y); ctx.stroke();
    ctx.strokeStyle = rgba(COL.q, 0.9 * A);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + dx * 5 * easeInOutQuart(prog(t, 110.5, 113.0)), y); ctx.stroke();
    MS.forEach(([yr, name], k) => {
      const x = x0 + k * dx;
      const t0 = 110.5 + k * BEAT;
      const p = prog(t, t0, t0 + 0.7);
      if (p <= 0) return;
      if (k > 0) {
        ctx.fillStyle = rgba(COL.ink, 0.8 * A * easeOutCubic(p));
        ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
      }
      const yf = yr === '今天' ? font('SansSC400', 13) : F.mono12;
      rise(ctx, yr, x, y - 26, p, yf, k === 0 ? COL.q : COL.ink, A * 0.7, 'center');
      const nf = k === 5 ? font('SerifSC500', 26) : font('ISR', 32);
      rise(ctx, name, x, y + 52, prog(t, t0 + 0.05, t0 + 0.75), nf, COL.ink, A * (k === 0 ? 1 : 0.88), 'center');
    });
  }
  // the focus dot: lives at the timeline origin, then flies home to the end card
  const oa = easeOutExpo(prog(t, 110.0, 110.5));
  const fly = easeInOutCubic(prog(t, 115.0, 115.9));
  const gone = prog(t, 119.2, 119.7);
  const px = lerp(x0, 960, fly), py = lerp(y, 404, fly);
  const pulse = 1 + 0.8 * Math.exp(-Math.pow((t - 110.05) / 0.16, 2)) + 0.7 * Math.exp(-Math.pow((t - 116.0) / 0.2, 2));
  glow(ctx, px, py, 40 * pulse, COL.q, 0.34 * oa * (1 - gone));
  ctx.fillStyle = rgba(COL.q, oa * (1 - gone));
  ctx.beginPath(); ctx.arc(px, py, lerp(5, 4.6, fly), 0, Math.PI * 2); ctx.fill();

  // end card
  if (t < 115.8) return;
  const title = 'Attention Is All You Need';
  const f = font('ISR', 96);
  const L = layout(ctx, title, f);
  const tx0 = 960 - L.width / 2, ty = 528;
  ctx.font = f;
  ctx.fillStyle = rgba(COL.ink);
  for (let i = 0; i < L.chars.length; i++) {
    const ti = 116.1 + i * 0.03;
    const p = prog(t, ti, ti + 0.8);
    if (p <= 0) continue;
    const e = easeOutCubic(p);
    ctx.globalAlpha = e;
    defocusGlyph(ctx, L.chars[i], tx0 + L.xs[i], ty + 12 * (1 - easeOutExpo(p)), 12 * (1 - e));
  }
  ctx.globalAlpha = 1;
  reveal(ctx, '注意力，就是你所需要的一切', 960, 606, t, { f: font('SerifSC400', 26), size: 26, tracking: 8, align: 'center', alpha: 0.85, tIn: 117.0, stagger: 0.035, durIn: 0.8 });
  reveal(ctx, 'VASWANI ET AL.  ·  NIPS 2017  ·  ARXIV 1706.03762', 960, 668, t, { f: F.mono13, size: 13, tracking: 3.4, align: 'center', alpha: 0.5, tIn: 117.6, stagger: 0.012 });
}
