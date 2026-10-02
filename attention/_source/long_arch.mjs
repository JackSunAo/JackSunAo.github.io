// Chapter 07 (78–94 s): encoder, decoder with causal mask, and cross-attention.
import {
  clamp, lerp, prog, easeOutCubic, easeInCubic, easeInOutCubic, easeOutExpo,
  COL, rgba, mix, font, text, glow, tracePartial, pointAt, roundRect, setFade,
} from './lib.mjs';
import { F, WORDS, N, BEAT, shot } from './long_common.mjs';

const XE = 540, XD = 980, BW = 250, BH = 36, PLUS_Y = 692;
const ENC = [
  { id: 'emb', y: 742, label: 'Input Embedding', t: 78.5 },
  { id: 'mha', y: 640, label: 'Multi-Head Attention', attn: true, t: 79.5 },
  { id: 'an1', y: 590, label: 'Add & Norm', thin: true, t: 80.0 },
  { id: 'ff', y: 530, label: 'Feed Forward', t: 80.5 },
  { id: 'an2', y: 480, label: 'Add & Norm', thin: true, t: 81.0 },
];
const DEC = [
  { id: 'emb', y: 742, label: 'Output Embedding', t: 84.5 },
  { id: 'mmha', y: 640, label: 'Masked Multi-Head Attention', attn: true, t: 85.5 },
  { id: 'an1', y: 590, label: 'Add & Norm', thin: true, t: 86.0 },
  { id: 'mha', y: 520, label: 'Multi-Head Attention', attn: true, t: 86.5 },
  { id: 'an2', y: 470, label: 'Add & Norm', thin: true, t: 87.0 },
  { id: 'ff', y: 410, label: 'Feed Forward', t: 87.5 },
  { id: 'an3', y: 360, label: 'Add & Norm', thin: true, t: 88.0 },
  { id: 'lin', y: 290, label: 'Linear', t: 88.5 },
  { id: 'sm', y: 240, label: 'Softmax', t: 89.0 },
];

function box(ctx, cx, cy, label, { p, a, attn = false, thin = false, hot = 0 }) {
  if (p <= 0 || a <= 0) return;
  const w = BW, h = thin ? 26 : BH;
  const x = cx - w / 2, y = cy - h / 2;
  if (attn) {
    ctx.fillStyle = rgba(COL.q, (0.1 + 0.3 * hot) * a * p);
    ctx.beginPath(); roundRect(ctx, x, y, w, h, 5); ctx.fill();
  } else {
    ctx.fillStyle = rgba(COL.ink, 0.035 * a * p);
    ctx.beginPath(); roundRect(ctx, x, y, w, h, 4); ctx.fill();
  }
  const pts = [[x + w / 2, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y], [x + w / 2, y]];
  ctx.strokeStyle = rgba(attn ? mix(COL.ink, COL.q, 0.85) : COL.ink, (attn ? 0.9 : thin ? 0.3 : 0.42) * a);
  ctx.lineWidth = attn ? 1.4 : 1;
  ctx.beginPath(); tracePartial(ctx, pts, 0, easeInOutCubic(p)); ctx.stroke();
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
const pulseAt = (t, tc) => Math.exp(-Math.pow((t - tc) / 0.2, 2));

// English / German with the alignment the decoder learns (illustrative)
const EN = ['The', 'animal', "didn't", 'cross', 'the', 'street', 'because', 'it', 'was', 'too', 'tired'];
const DE = ['Das', 'Tier', 'überquerte', 'die', 'Straße', 'nicht', 'weil', 'es', 'zu', 'müde', 'war'];
const ALIGN = (() => {
  const main = [[0, 0.7], [1, 0.7], [3, 0.6], [4, 0.7], [5, 0.7], [2, 0.65], [6, 0.7], [7, 0.45], [9, 0.6], [10, 0.7], [8, 0.6]];
  return main.map(([c, w], g) => {
    const r = Array(N).fill(0.02);
    r[c] += w;
    if (g === 7) r[1] += 0.35;
    if (g === 2) r[2] += 0.15;
    if (g === 8) r[8] += 0.2;
    const s = r.reduce((a, b) => a + b, 0);
    return r.map((x) => x / s);
  });
})();

const IX = 1440, IY = 392, IC = 22; // inset origin and cell pitch

export function sceneArch(ctx, t) {
  const A = shot(t, 77.9, 94.0, 0.4, 0.6);
  if (A <= 0) return;
  setFade(A);

  // ---- encoder (78–84) and decoder (84–90) boxes
  ENC.forEach((b) => {
    const hot = b.attn ? pulseAt(t, 82.7) : 0;
    box(ctx, XE, b.y, b.label, { p: prog(t, b.t, b.t + 0.45), a: 1, attn: b.attn, thin: b.thin, hot });
  });
  DEC.forEach((b) => {
    const hot = b.id === 'mmha' ? Math.max(pulseAt(t, 89.2), 0) : b.id === 'mha' ? pulseAt(t, 91.6) : 0;
    box(ctx, XD, b.y, b.label, { p: prog(t, b.t, b.t + 0.45), a: 1, attn: b.attn, thin: b.thin, hot });
  });

  // ---- embeddings + positional encoding
  [[XE, -1, 79.0, 78.5], [XD, 1, 85.0, 84.5]].forEach(([cx, side, tp, te]) => {
    const p = easeOutCubic(prog(t, tp, tp + 0.4));
    ctx.strokeStyle = rgba(COL.ink, 0.6 * p);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, PLUS_Y, 9, 0, Math.PI * 2); ctx.moveTo(cx - 5, PLUS_Y); ctx.lineTo(cx + 5, PLUS_Y); ctx.moveTo(cx, PLUS_Y - 5); ctx.lineTo(cx, PLUS_Y + 5); ctx.stroke();
    const ix = cx + side * 178;
    ctx.strokeStyle = rgba(COL.k, 0.85 * p);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let k = 0; k <= 40; k++) {
      const u = k / 40;
      const xx = ix - 22 + u * 44, yy = PLUS_Y + Math.sin(u * Math.PI * 4 + t * 5) * 6;
      if (k === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
    }
    ctx.stroke();
    ctx.strokeStyle = rgba(COL.ink, 0.3 * p);
    ctx.beginPath(); ctx.moveTo(ix - side * 28, PLUS_Y); ctx.lineTo(cx + side * 12, PLUS_Y); ctx.stroke();
    text(ctx, 'Positional', ix, PLUS_Y + 30, { f: F.mono11, align: 'center', alpha: 0.5 * p });
    text(ctx, 'Encoding', ix, PLUS_Y + 44, { f: F.mono11, align: 'center', alpha: 0.5 * p });
    const io = easeOutCubic(prog(t, te, te + 0.5));
    text(ctx, cx === XE ? 'Inputs' : 'Outputs (shifted right)', cx, 800, { f: F.mono12, align: 'center', tracking: 1, alpha: 0.5 * io });
  });
  text(ctx, 'Output Probabilities', XD, 196, { f: F.mono12, align: 'center', tracking: 1, alpha: 0.5 * easeOutCubic(prog(t, 89.2, 89.8)) });

  // ---- arrows between blocks
  const upE = (y1, y2, tt) => arrow(ctx, [[XE, y1], [XE, y2]], easeInOutCubic(prog(t, tt, tt + 0.4)), 1);
  const upD = (y1, y2, tt) => arrow(ctx, [[XD, y1], [XD, y2]], easeInOutCubic(prog(t, tt, tt + 0.4)), 1);
  upE(786, 760, 78.5); upE(725, PLUS_Y + 10, 79.0); upE(PLUS_Y - 10, 658, 79.5);
  upE(622, 603, 80.0); upE(577, 548, 80.5); upE(512, 493, 81.0);
  upD(786, 760, 84.5); upD(725, PLUS_Y + 10, 85.0); upD(PLUS_Y - 10, 658, 85.5);
  upD(622, 603, 86.0); upD(577, 538, 86.5); upD(502, 483, 87.0); upD(457, 428, 87.5);
  upD(392, 373, 88.0); upD(347, 308, 88.5); upD(272, 258, 89.0); upD(222, 206, 89.3);
  // residual skips
  const skip = (x, y1, y2, tt, side) => {
    const pts = [[x, y1], [x + side * (BW / 2 + 10), y1], [x + side * (BW / 2 + 10), y2], [x + side * (BW / 2), y2]];
    ctx.strokeStyle = rgba(COL.ink, 0.22);
    ctx.lineWidth = 1;
    ctx.beginPath(); tracePartial(ctx, pts, 0, easeInOutCubic(prog(t, tt, tt + 0.6))); ctx.stroke();
  };
  skip(XE, 670, 590, 81.5, -1); skip(XE, 565, 480, 81.7, -1);
  skip(XD, 670, 590, 87.5, 1); skip(XD, 560, 470, 87.7, 1); skip(XD, 450, 360, 87.9, 1);
  const rl = easeOutCubic(prog(t, 81.6, 82.2));
  text(ctx, 'residual', XE - BW / 2 - 14, 630, { f: F.mono11, align: 'right', alpha: 0.4 * rl });

  // ---- N× frames and titles
  const fe = easeInOutCubic(prog(t, 82.0, 82.8));
  const fd = easeInOutCubic(prog(t, 88.2, 89.0));
  ctx.save();
  ctx.setLineDash([2, 5]);
  ctx.strokeStyle = rgba(COL.ink, 0.25);
  ctx.lineWidth = 1;
  const fr = (x, y, w, h, p) => { const pts = [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]; ctx.beginPath(); tracePartial(ctx, pts, 0, p); ctx.stroke(); };
  fr(XE - BW / 2 - 18, 452, BW + 36, 222, fe);
  fr(XD - BW / 2 - 18, 334, BW + 36, 340, fd);
  ctx.restore();
  text(ctx, '6×', XE - BW / 2 - 30, 566, { f: font('ISI', 30), align: 'right', alpha: 0.85 * fe });
  text(ctx, '×6', XD + BW / 2 + 30, 506, { f: font('ISI', 30), alpha: 0.85 * fd });
  text(ctx, 'ENCODER', XE - BW / 2 - 18, 440, { f: F.mono12, tracking: 3, alpha: 0.6 * fe });
  text(ctx, 'DECODER', XD - BW / 2 - 18, 322, { f: F.mono12, tracking: 3, alpha: 0.6 * fd });

  // ---- feed-forward note (top-left)
  const na = easeOutCubic(prog(t, 83.0, 83.7)) * (1 - easeInOutCubic(prog(t, 84.0, 84.6)));
  if (na > 0) {
    text(ctx, 'FEED-FORWARD', 96, 238, { f: F.mono12, tracking: 3, alpha: 0.6 * na, color: COL.q });
    text(ctx, 'FFN(x) = max(0, xW1 + b1) W2 + b2', 96, 270, { f: F.mono13, alpha: 0.75 * na, tracking: 0.4 });
    text(ctx, '每个位置各自独立：512 → 2048 → 512', 96, 300, { f: font('SansSC400', 15), alpha: 0.55 * na });
  }
  // data pulse up the encoder
  const pe = prog(t, 82.6, 83.7);
  if (pe > 0 && pe < 1) {
    const py = lerp(800, 467, easeInOutCubic(pe));
    glow(ctx, XE, py, 40, COL.q, 0.5 * Math.sin(pe * Math.PI));
    ctx.fillStyle = rgba(COL.q, Math.sin(pe * Math.PI));
    ctx.beginPath(); ctx.arc(XE, py, 3.6, 0, Math.PI * 2); ctx.fill();
  }

  // ---- the causal mask inset (85.5–89.8)
  const ma = easeOutCubic(prog(t, 85.6, 86.2)) * (1 - easeInOutCubic(prog(t, 89.7, 90.2)));
  if (ma > 0) {
    text(ctx, 'CAUSAL MASK', IX + (N * IC) / 2, IY - 42, { f: F.mono12, align: 'center', tracking: 3, alpha: 0.6 * ma });
    text(ctx, '行：正在生成的位置　列：能看到的位置', IX + (N * IC) / 2, IY - 18, { f: font('SansSC400', 13), align: 'center', alpha: 0.5 * ma });
    for (let i = 0; i < N; i++) {
      const rp = easeOutCubic(prog(t, 86.2 + i * 0.25, 86.6 + i * 0.25));
      for (let j = 0; j < N; j++) {
        const x = IX + j * IC, y = IY + i * IC;
        if (j <= i) {
          ctx.fillStyle = rgba(COL.q, (0.25 + 0.55 * (j === i ? 1 : 0.55)) * rp * ma);
          ctx.beginPath(); roundRect(ctx, x + 1, y + 1, IC - 3, IC - 3, 3); ctx.fill();
        } else {
          ctx.strokeStyle = rgba(COL.ink, 0.28 * rp * ma);
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(x + 6, y + 6); ctx.lineTo(x + IC - 8, y + IC - 8); ctx.moveTo(x + IC - 8, y + 6); ctx.lineTo(x + 6, y + IC - 8); ctx.stroke();
        }
      }
    }
    const na2 = easeOutCubic(prog(t, 88.6, 89.3)) * ma;
    text(ctx, '未来位置 = −∞ → 权重为 0', IX + (N * IC) / 2, IY + N * IC + 34, { f: font('SansSC400', 15), align: 'center', color: COL.q, alpha: na2 });
  }

  // ---- cross-attention (90–94)
  const cp = easeInOutCubic(prog(t, 90.2, 91.3));
  const cross = [[XE, 467], [XE, 410], [XD - BW / 2 - 46, 410], [XD - BW / 2 - 46, 520], [XD - BW / 2, 520]];
  arrow(ctx, cross, cp, 1, COL.q, 0.7);
  const ca = easeOutCubic(prog(t, 90.3, 90.9)) * (1 - easeInOutCubic(prog(t, 93.5, 94.0)));
  if (ca > 0) {
    text(ctx, 'CROSS-ATTENTION · 示意', IX + (N * IC) / 2, IY - 70, { f: F.mono12, align: 'center', tracking: 3, alpha: 0.6 * ca });
    for (let j = 0; j < N; j++) {
      ctx.save();
      ctx.translate(IX + j * IC + IC / 2, IY - 8);
      ctx.rotate(-0.9);
      text(ctx, EN[j], 0, 0, { f: font('ISR', 15), alpha: (j === 7 || j === 1 ? 1 : 0.55) * ca, color: j === 7 || j === 1 ? COL.q : COL.ink });
      ctx.restore();
    }
    for (let i = 0; i < N; i++) {
      const rp = easeOutCubic(prog(t, 90.6 + i * 0.2, 91.1 + i * 0.2));
      text(ctx, DE[i], IX - 10, IY + i * IC + 16, { f: font('ISR', 16), align: 'right', alpha: (i === 7 ? 1 : 0.6) * rp * ca, color: i === 7 ? COL.q : COL.ink });
      for (let j = 0; j < N; j++) {
        const w = ALIGN[i][j];
        const x = IX + j * IC, y = IY + i * IC;
        const hot = i === 7 && (j === 7 || j === 1);
        ctx.fillStyle = rgba(hot ? COL.q : COL.ink, clamp(0.05 + 0.95 * Math.pow(w / 0.62, 0.8)) * rp * ca * (hot ? 1 : 0.8));
        ctx.beginPath(); roundRect(ctx, x + 1, y + 1, IC - 3, IC - 3, 3); ctx.fill();
      }
    }
    const ea = easeOutCubic(prog(t, 92.6, 93.2)) * ca;
    ctx.strokeStyle = rgba(COL.q, 0.9 * ea);
    ctx.lineWidth = 1.3;
    ctx.strokeRect(IX - 3, IY + 7 * IC - 2, N * IC + 6, IC + 3);
    text(ctx, '译到 es 时 → 看向 it 与 animal', IX + (N * IC) / 2, IY + N * IC + 34, { f: font('SansSC400', 15), align: 'center', color: COL.q, alpha: ea });
  }
  // a data pulse along the cross path and up the decoder
  const pp = prog(t, 91.0, 93.2);
  if (pp > 0 && pp < 1) {
    const path = [[XE, 467], [XE, 410], [XD - BW / 2 - 46, 410], [XD - BW / 2 - 46, 520], [XD, 520], [XD, 200]];
    const [px, py] = pointAt(path, easeInOutCubic(pp));
    const pa = Math.sin(pp * Math.PI);
    glow(ctx, px, py, 40, COL.q, 0.5 * pa);
    ctx.fillStyle = rgba(COL.q, pa);
    ctx.beginPath(); ctx.arc(px, py, 3.6, 0, Math.PI * 2); ctx.fill();
  }
  setFade(1);
}
