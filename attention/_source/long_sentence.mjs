// Chapters 01–03 (10–52 s): the sentence, from sequential reading to self-attention to Q · K · V.
import {
  clamp, lerp, prog, smooth, easeOutCubic, easeInCubic, easeInOutCubic, easeOutExpo, easeOutQuart, win,
  COL, rgba, mix, font, textWidth, text, mulberry32, glow, archPoints, tracePartial, pointAt, cubicPoints, setFade,
} from './lib.mjs';
import {
  F, WORDS, N, IT, W_TIRED, W_WIDE, BEAT, shot, word, strip, stripWidth,
} from './long_common.mjs';

const TOK = 54, TOK_Y = 470, LINE_Y = 500, GAP = 21;
const STEP0 = 11.0; // one word per beat
const stepT = (i) => STEP0 + i * BEAT;
const SWAP0 = 28.0, SWAP1 = 28.75;
const colX = (i) => 1010 + (i - 5) * 138;

// ---------------------------------------------------------------- vectors for the Q · K · V chapter (d = 8, real arithmetic)
const D = 8;
const rnd = mulberry32(5);
const gauss = () => { let s = 0; for (let k = 0; k < 6; k++) s += rnd(); return (s - 3) * 1.4142; };
const vec = (s) => Array.from({ length: D }, () => gauss() * s);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const QV = WORDS.map(() => vec(0.8));
QV[IT] = [1.1, -0.7, 0.9, 0.3, -1.0, 0.7, -0.4, 0.8];
const q2 = dot(QV[IT], QV[IT]);
const LOGIT = W_WIDE.map((w) => Math.log(w) + 4.6); // softmax(LOGIT) == W_WIDE exactly
const RAW = LOGIT.map((z) => z * Math.sqrt(D)); // q·k before scaling
const KV = RAW.map((s) => {
  const n = vec(0.5);
  const p = dot(n, QV[IT]) / q2;
  return n.map((v, i) => v - p * QV[IT][i] + (s / q2) * QV[IT][i]); // q·k == s
});
const VV = WORDS.map(() => vec(0.8));
VV[5] = [1.2, -1.1, 1.0, -0.9, 1.1, -1.2, 0.9, -1.0];
VV[1] = [-1.0, 1.1, -0.9, 1.0, -1.1, 0.8, -1.0, 1.1];
const OUT = Array.from({ length: D }, (_, d) => W_WIDE.reduce((s, w, j) => s + w * VV[j][d], 0));
const SCORE_MAX = Math.max(...RAW);

// ---------------------------------------------------------------- layout of the big row
let _ctx = null;
const tw = (s, size) => textWidth(_ctx, s, font('ISR', size));
function rowAt(t) {
  const sp = easeInOutCubic(prog(t, SWAP0 + 0.05, SWAP1));
  const ws = WORDS.map((w) => tw(w, TOK));
  ws[10] = lerp(tw('tired', TOK), tw('wide', TOK), sp);
  const total = ws.reduce((a, b) => a + b, 0) + GAP * (N - 1);
  let x = 960 - total / 2;
  const out = [];
  for (let i = 0; i < N; i++) { out.push({ x, w: ws[i], cx: x + ws[i] / 2 }); x += ws[i] + GAP; }
  out.total = total;
  return out;
}
const itWeights = (t) => {
  const sp = easeInOutCubic(prog(t, SWAP0 + 0.1, SWAP1 + 0.1));
  return W_TIRED.map((w, i) => lerp(w, W_WIDE[i], sp));
};

// ---------------------------------------------------------------- main entry
export function sceneSentence(ctx, t) {
  _ctx = ctx;
  if (t < 9.8 || t > 52.6) return;
  const row = rowAt(t);
  ruleAndHead(ctx, t, row);
  if (t < 20.4) recurrence(ctx, t, row);
  if (t > 19.8 && t < 32.4) selfAttention(ctx, t, row);
  tokens(ctx, t, row);
  if (t > 31.4) qkv(ctx, t, row);
}

// ---------------------------------------------------------------- the rule + the reading head
function headPos(t, row) {
  if (t < STEP0 - 0.5 || t > 20.2) return null;
  let i = 0;
  while (i < N - 1 && t > stepT(i + 1) - 0.2) i++;
  if (i === 0 && t < stepT(0)) {
    const p = easeInOutCubic(prog(t, STEP0 - 0.5, STEP0));
    return [lerp(960, row[0].cx, p), 0];
  }
  if (i > 0 && t < stepT(i)) {
    const p = easeInOutCubic(prog(t, stepT(i) - 0.2, stepT(i)));
    return [lerp(row[i - 1].cx, row[i].cx, p), i];
  }
  return [row[i].cx, i];
}

function ruleAndHead(ctx, t, row) {
  const lineIn = easeOutExpo(prog(t, 10.0, 11.0));
  const lineOut = easeInOutCubic(prog(t, 31.5, 32.2));
  const hw = (row.total / 2 + 46) * lineIn * (1 - lineOut);
  if (hw > 0.5) {
    ctx.strokeStyle = rgba(COL.ink, 0.2);
    ctx.lineWidth = 1;
    ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(960 - hw, LINE_Y); ctx.lineTo(960 + hw, LINE_Y); ctx.stroke();
    ctx.lineCap = 'round';
    const ta = lineIn * (1 - lineOut);
    ctx.strokeStyle = rgba(COL.ink, 0.3 * ta);
    ctx.beginPath(); ctx.moveTo(960 - hw, LINE_Y - 5); ctx.lineTo(960 - hw, LINE_Y + 5); ctx.moveTo(960 + hw, LINE_Y - 5); ctx.lineTo(960 + hw, LINE_Y + 5); ctx.stroke();
  }
  // the dot, born on the downbeat at 10.0, then the reading head
  const dotIn = easeOutExpo(prog(t, 9.9, 10.5));
  const dotOut = prog(t, 19.9, 20.1);
  const hp = headPos(t, row);
  if (dotIn > 0 && dotOut < 1) {
    const dx = hp ? hp[0] : 960;
    const pulse = 1 + 0.7 * Math.exp(-Math.pow((t - 10.05) / 0.16, 2));
    glow(ctx, dx, LINE_Y, 34 * pulse, COL.q, 0.28 * dotIn * (1 - dotOut));
    ctx.fillStyle = rgba(COL.q, dotIn * (1 - dotOut));
    ctx.beginPath(); ctx.arc(dx, LINE_Y, 4.2 * dotIn, 0, Math.PI * 2); ctx.fill();
    if (hp && t < 16.4) {
      text(ctx, 't = ' + String(hp[1] + 1).padStart(2, '0'), dx, LINE_Y + 30, { f: F.mono11, tracking: 1.2, align: 'center', alpha: 0.55 * win(t, STEP0 - 0.2, 16.3, 0.2, 0.3), color: COL.q });
    }
  }
}

// ---------------------------------------------------------------- 01 recurrence
function recurrence(ctx, t, row) {
  const cy = 566;
  const A = win(t, 10.8, 19.9, 0.4, 0.35);
  if (A > 0) {
    text(ctx, 'h', row[0].x - 46, cy + 4, { f: font('ISI', 22), alpha: 0.5 * A });
    for (let i = 0; i < N; i++) {
      const ti = stepT(i);
      const p = easeOutCubic(prog(t, ti - 0.05, ti + 0.2));
      if (p <= 0) continue;
      if (i > 0) {
        const lp = easeInOutCubic(prog(t, ti - 0.2, ti));
        ctx.strokeStyle = rgba(COL.ink, 0.28 * A);
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(row[i - 1].cx + 7, cy); ctx.lineTo(lerp(row[i - 1].cx + 7, row[i].cx - 7, lp), cy); ctx.stroke();
      }
      const mem = i >= 1 ? Math.exp(-(i - 1) / 1.9) : 0;
      ctx.strokeStyle = rgba(mix(COL.ink, COL.q, mem), (0.35 + 0.6 * mem) * A * p);
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(row[i].cx, cy, 5.5 * p, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = rgba(COL.q, mem * 0.95 * A * p);
      ctx.beginPath(); ctx.arc(row[i].cx, cy, 3.4 * p, 0, Math.PI * 2); ctx.fill();
    }
  }

  // 16.0–19.0: the signal "animal" → "it" crawls through six hops, one per beat, getting weaker
  const B = win(t, 15.9, 19.9, 0.3, 0.3);
  if (B > 0) {
    const pts = archPoints(row[1].cx, TOK_Y - 50, row[IT].cx, TOK_Y - 50, 96);
    const drawn = easeInOutCubic(prog(t, 16.0, 16.8));
    ctx.save();
    ctx.setLineDash([3, 7]);
    ctx.strokeStyle = rgba(COL.ink, 0.42 * B);
    ctx.lineWidth = 1.2;
    ctx.beginPath(); tracePartial(ctx, pts, 0, drawn); ctx.stroke();
    ctx.restore();
    // hop edges light up in vermillion, fading with distance
    for (let k = 1; k <= 6; k++) {
      const ta = 16.5 + (k - 1) * BEAT; // hop k arrives at node 1+k
      const p = easeOutCubic(prog(t, ta - 0.3, ta));
      if (p <= 0) continue;
      const a = 1 - (k - 1) * 0.13;
      ctx.strokeStyle = rgba(COL.q, 0.95 * a * B);
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(row[k].cx + 7, cy);
      ctx.lineTo(lerp(row[k].cx + 7, row[k + 1].cx - 7, p), cy);
      ctx.stroke();
      const lab = ['100%', '59%', '35%', '21%', '12%', '7%', '4%'][k];
      text(ctx, lab, row[k + 1].cx, cy + 28, { f: F.mono11, align: 'center', alpha: 0.7 * B * p, color: COL.q, tracking: 0.5 });
    }
    text(ctx, '100%', row[1].cx, cy + 28, { f: F.mono11, align: 'center', alpha: 0.7 * B * easeOutCubic(prog(t, 16.2, 16.6)), color: COL.q, tracking: 0.5 });
    text(ctx, '信息保留（示意）', row[0].x - 4, cy + 28, { f: font('SansSC400', 13), alpha: 0.4 * B * easeOutCubic(prog(t, 16.3, 16.8)), color: COL.ink });
    // hop counter at the apex of the arc
    const hops = clamp(Math.floor((t - 16.5) / BEAT) + 1, 0, 6);
    const apex = pointAt(pts, 0.5);
    if (hops > 0) text(ctx, hops + ' 步', apex[0], apex[1] - 14, { f: font('SerifSC500', 26), align: 'center', alpha: 0.95 * B, color: COL.q });
    else text(ctx, '?', apex[0], apex[1] - 14, { f: font('ISI', 34), align: 'center', alpha: 0.75 * B * easeOutCubic(prog(t, 16.4, 16.8)), color: COL.q });
  }
}

// ---------------------------------------------------------------- 02 self-attention
function selfAttention(ctx, t, row) {
  // eleven dots flash out of "it" on the downbeat, then the all-to-all lattice draws itself
  if (t > 19.95 && t < 21.4) {
    const sp = easeOutExpo(prog(t, 20.0, 20.35));
    const fa = 1 - easeInCubic(prog(t, 20.4, 21.2));
    for (let i = 0; i < N; i++) {
      const x = lerp(row[IT].cx, row[i].cx, sp);
      glow(ctx, x, LINE_Y, 26, COL.q, 0.22 * fa);
      ctx.fillStyle = rgba(COL.q, fa);
      ctx.beginPath(); ctx.arc(x, LINE_Y, 3.6, 0, Math.PI * 2); ctx.fill();
    }
  }
  const webIn = prog(t, 20.0, 21.8);
  const webOut = 1 - easeInOutCubic(prog(t, 31.4, 32.0));
  if (webIn > 0 && webOut > 0) {
    const dim = lerp(1, 0.22, easeInOutCubic(prog(t, 24.0, 24.6)));
    const breathe = (k) => 0.85 + 0.15 * Math.sin(t * 2.2 + k * 0.7);
    ctx.lineWidth = 1;
    let k = 0;
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++, k++) {
        const d = j - i;
        const x1 = row[i].cx + (d / 10) * row[i].w * 0.34;
        const x2 = row[j].cx - (d / 10) * row[j].w * 0.34;
        const pts = archPoints(x1, TOK_Y - 50, x2, TOK_Y - 50, 16 + 0.3 * (x2 - x1), 40);
        const p = easeInOutCubic(clamp(webIn * 1.25 - (k % 7) * 0.035));
        if (p <= 0) continue;
        ctx.strokeStyle = rgba(COL.ink, 0.2 * dim * webOut * breathe(k));
        ctx.beginPath();
        tracePartial(ctx, pts, 0, p / 2);
        tracePartial(ctx, pts, 1 - p / 2, 1);
        ctx.stroke();
      }
    }
  }
  // focus arcs from "it", thickness = attention weight
  const focus = win(t, 24.0, 31.7, 0.5, 0.45);
  const wts = itWeights(t);
  if (focus > 0) {
    const order = [...Array(N).keys()].filter((j) => j !== IT).sort((a, b) => wts[a] - wts[b]);
    for (const j of order) {
      const w = wts[j];
      const ox = row[IT].cx + (j < IT ? -3 : 3);
      const pts = archPoints(ox, TOK_Y - 50, row[j].cx, TOK_Y - 50, 22 + 0.34 * Math.abs(row[j].cx - ox), 56);
      const d0 = 24.1 + (Math.abs(j - IT) - 1) * 0.05;
      const p = easeInOutCubic(prog(t, d0, d0 + 0.8));
      const hot = smooth(clamp((w - 0.18) / 0.3));
      ctx.strokeStyle = rgba(mix(COL.ink, COL.q, hot), (0.22 + 0.78 * Math.pow(w / 0.6, 0.6)) * focus);
      ctx.lineWidth = 0.9 + 6.2 * w;
      ctx.beginPath(); tracePartial(ctx, pts, 0, p); ctx.stroke();
      if (hot > 0.05 && p > 0.98) {
        const end = pts[pts.length - 1];
        glow(ctx, end[0], end[1], 30, COL.q, 0.22 * hot * focus);
      }
    }
    for (let j = 0; j < N; j++) {
      const w = wts[j];
      const bp = easeOutCubic(prog(t, 24.5 + j * 0.03, 25.2 + j * 0.03));
      if (bp <= 0) continue;
      const hot = smooth(clamp((w - 0.18) / 0.3));
      ctx.fillStyle = rgba(mix(COL.ink, COL.q, hot), (0.5 + 0.5 * hot) * focus);
      ctx.fillRect(row[j].cx - 2, LINE_Y + 12, 4, Math.max(1, 96 * w * bp));
      text(ctx, w.toFixed(2), row[j].cx, LINE_Y + 96, { f: F.mono12, align: 'center', tracking: 0.5, color: hot > 0.5 ? COL.q : COL.ink, alpha: (0.38 + 0.6 * hot) * focus * bp });
    }
    // underline the attended word
    const sp = easeInOutCubic(prog(t, SWAP0 + 0.05, SWAP1 + 0.05));
    const a = row[1], s = row[5];
    const ux = lerp(a.x, s.x, sp), uw = lerp(a.w, s.w, sp);
    const ua = easeOutCubic(prog(t, 24.6, 25.0)) * focus;
    ctx.fillStyle = rgba(COL.q, ua);
    ctx.fillRect(ux, TOK_Y + 13, uw * ua, 2);
    const ma = win(t, SWAP0 - 0.1, 31.5, 0.3, 0.5);
    if (ma > 0) {
      ctx.fillStyle = rgba(COL.k, 0.8 * ma);
      ctx.fillRect(row[10].x, TOK_Y + 13, row[10].w * easeOutCubic(prog(t, SWAP0, SWAP0 + 0.5)), 2);
    }
  }
}

// ---------------------------------------------------------------- the words themselves
function tokens(ctx, t, row) {
  for (let i = 0; i < N; i++) {
    const tin = 10.0 + i * 0.05;
    const appear = easeOutCubic(prog(t, tin, tin + 0.7));
    if (appear <= 0) continue;
    // reading brightness: dim until read, then it decays (the network "forgets")
    let b = 1;
    if (t < 20.2) {
      const tr = stepT(i);
      b = 0.26;
      if (t >= tr - 0.06) b = 0.26 + 0.74 * Math.exp(-Math.max(0, t - tr) / 0.9) * clamp((t - tr + 0.06) / 0.06);
      b = lerp(b, 1, easeOutCubic(prog(t, 19.9, 20.2)));
    }
    let c = COL.ink;
    if (i === IT) c = mix(COL.ink, COL.q, easeInOutCubic(prog(t, 24.0, 24.4)));
    // flight to the Q·K·V column row
    const e = easeInOutCubic(clamp((t - 31.95 - i * 0.03) / 0.9));
    const cx = lerp(row[i].cx, colX(i), e);
    const y = lerp(TOK_Y, 204, e);
    const size = lerp(TOK, 40, e);
    const rise = (1 - easeOutExpo(prog(t, tin, tin + 0.8))) * 40;
    ctx.save();
    if (rise > 1) { ctx.beginPath(); ctx.rect(cx - 140, y - TOK * 1.2, 280, TOK * 1.55); ctx.clip(); }
    if (i !== 10) word(ctx, WORDS[i], cx, y + rise, size, c, b * appear);
    else {
      const sp = prog(t, SWAP0, SWAP1);
      const outP = easeInCubic(clamp(sp * 1.6));
      const inP = easeOutExpo(clamp(sp * 1.6 - 0.45));
      if (outP < 1) word(ctx, 'tired', cx, y + rise - outP * 46, size, COL.ink, b * appear * (1 - outP));
      if (inP > 0) word(ctx, 'wide', cx, y + (1 - inP) * 46, size, mix(COL.ink, COL.k, 0.9 * win(t, SWAP0 + 0.3, 32.0, 0.3, 1.0)), b * inP);
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------- 03 Q · K · V
const QY = 252, KY = 292, VY = 332, CH_ = 16;
const SX = (i) => colX(i) - stripWidth(D) / 2;
const BARY = 592; // bar baseline
function qkv(ctx, t, row) {
  const A = shot(t, 32.2, 52.0, 0.5, 0.6);
  if (A <= 0) return;
  setFade(A);
  // labels
  const labels = [['Q', 'x · W_Q', QY, COL.q], ['K', 'x · W_K', KY, COL.k], ['V', 'x · W_V', VY, COL.v]];
  labels.forEach(([l, f, y], r) => {
    const p = easeOutCubic(prog(t, 33.0 + r, 33.6 + r));
    text(ctx, l, 86, y + 14, { f: font('ISI', 26), color: labels[r][3], alpha: p, align: 'left' });
    text(ctx, '= ' + f, 112, y + 13, { f: F.mono11, alpha: 0.5 * p, tracking: 0.4 });
  });
  // vector strips, one row per bar-beat: Q at 33, K at 34, V at 35
  const rows = [[QV, QY, COL.q, 33.0], [KV, KY, COL.k, 34.0], [VV, VY, COL.v, 35.0]];
  const dimV = lerp(1, 0.45, easeInOutCubic(prog(t, 38.0, 38.6)));
  for (const [M, y, c, t0] of rows) {
    for (let j = 0; j < N; j++) {
      const p = easeOutCubic(prog(t, t0 + j * 0.06, t0 + j * 0.06 + 0.5));
      if (p <= 0) continue;
      let a = p;
      if (M === VV) a *= lerp(dimV, 1, easeInOutCubic(prog(t, 47.9, 48.5)));
      strip(ctx, SX(j), y + (1 - p) * 10, M[j], c, a, 10, CH_, 2);
    }
  }
  // 38–43.5: the scanner (one key per beat) and the score bars
  const sc = (j) => 38.0 + j * BEAT;
  const stage2 = easeInOutCubic(prog(t, 44.0, 45.0));
  const stage3 = easeInOutCubic(prog(t, 46.0, 47.0));
  const barsOut = 1 - easeInOutCubic(prog(t, 48.0, 48.6));
  const BA = A * barsOut;
  // Q frame
  const qf = easeOutCubic(prog(t, 38.0, 38.4)) * barsOut;
  if (qf > 0) {
    ctx.strokeStyle = rgba(COL.q, 0.95 * qf);
    ctx.lineWidth = 1.4;
    ctx.strokeRect(SX(IT) - 5, QY - 4, stripWidth(D) + 10, CH_ + 8);
    glow(ctx, colX(IT), QY + 8, 60, COL.q, 0.2 * qf);
  }
  const scanJ = clamp(Math.floor((t - 38.0) / BEAT), -1, N - 1);
  if (t >= 38.0 && t < 43.9) {
    const j = scanJ;
    const p = (t - sc(j)) / BEAT;
    const a = (1 - easeInCubic(clamp(p))) ;
    ctx.strokeStyle = rgba(COL.k, 0.95 * a);
    ctx.lineWidth = 1.6;
    ctx.strokeRect(SX(j) - 5, KY - 4, stripWidth(D) + 10, CH_ + 8);
    glow(ctx, colX(j), KY + 8, 46, COL.k, 0.26 * a);
  }
  const wts = W_WIDE;
  const hOf = (j) => {
    const s1 = RAW[j] / SCORE_MAX * 168;
    const s2 = (RAW[j] / Math.sqrt(D)) / SCORE_MAX * 168;
    const s3 = wts[j] / 0.62 * 168;
    return lerp(lerp(s1, s2, stage2), s3, stage3);
  };
  const vOf = (j) => lerp(lerp(RAW[j], RAW[j] / Math.sqrt(D), stage2), wts[j], stage3);
  for (let j = 0; j < N; j++) {
    const grow = easeOutCubic(prog(t, sc(j) + 0.02, sc(j) + 0.34));
    if (grow <= 0 || BA <= 0) continue;
    const hh = Math.max(1.5, hOf(j) * grow);
    const hot = j === 5 ? 1 : 0;
    const c = hot ? COL.q : mix(COL.ink, COL.k, 0.35);
    ctx.fillStyle = rgba(c, (hot ? 0.95 : 0.55) * BA);
    ctx.fillRect(colX(j) - 22, BARY - hh, 44, hh);
    const v = vOf(j);
    const lab = stage3 > 0.5 ? v.toFixed(2) : v.toFixed(1);
    text(ctx, lab, colX(j), BARY - hh - 10, { f: F.mono12, align: 'center', alpha: (hot ? 1 : 0.6) * BA * grow, color: hot ? COL.q : COL.ink, tracking: 0.4 });
  }
  if (BA > 0 && t > 38.2) {
    ctx.fillStyle = rgba(COL.ink, 0.2 * BA);
    ctx.fillRect(colX(0) - 40, BARY + 1, colX(10) - colX(0) + 80, 1);
    const l1 = (1 - stage2) * 1, l2 = stage2 * (1 - stage3), l3 = stage3;
    const lab = (s, a) => text(ctx, s, 960, BARY + 34, { f: F.mono13, align: 'center', tracking: 1.4, alpha: 0.7 * a * BA });
    lab('q · k', l1 * easeOutCubic(prog(t, 38.3, 38.8)));
    lab('q · k  /  √dk', l2);
    lab('softmax( q · k / √dk )', l3);
    text(ctx, 'dk = 8（示意）', 1824, BARY + 34, { f: font('SansSC400', 13), align: 'right', alpha: 0.4 * BA });
    text(ctx, '总和 = 1.00', 1824, BARY - 150, { f: font('SansSC500', 17), align: 'right', color: COL.q, alpha: stage3 * BA, tracking: 1 });
  }

  // 48–51.5: weighted sum of V → the new "it"
  const D0 = 48.0;
  const outCol = colX(IT);
  const OY = 704;
  const fa = easeOutCubic(prog(t, D0, D0 + 0.6)) * A;
  if (fa > 0.01) {
    const order = [...Array(N).keys()].sort((a, b) => wts[a] - wts[b]);
    for (const j of order) {
      const w = wts[j];
      const pts = cubicPoints([colX(j), VY + CH_ + 8], [colX(j), 470], [outCol, 560], [outCol, OY - 10], 40);
      const p = easeInOutCubic(prog(t, D0 + 0.3 + (j % 4) * 0.05, D0 + 1.7));
      const hot = smooth(clamp((w - 0.1) / 0.4));
      ctx.strokeStyle = rgba(mix(COL.ink, COL.v, hot), (0.3 + 0.7 * hot) * fa);
      ctx.lineWidth = 0.8 + 9 * w;
      ctx.beginPath(); tracePartial(ctx, pts, 0, p); ctx.stroke();
      // weight under the V strip
      text(ctx, w.toFixed(2), colX(j), VY + CH_ + 28, { f: F.mono12, align: 'center', color: hot > 0.5 ? COL.v : COL.ink, alpha: (0.4 + 0.55 * hot) * fa, tracking: 0.4 });
      // a bead of information runs down each thread
      const bp = prog(t, D0 + 1.0 + (j % 4) * 0.05, D0 + 2.4);
      if (bp > 0 && bp < 1) {
        const [bx, by] = pointAt(pts, easeInOutCubic(bp));
        ctx.fillStyle = rgba(COL.v, (0.3 + 0.7 * hot) * Math.sin(bp * Math.PI) * fa);
        ctx.beginPath(); ctx.arc(bx, by, 1.5 + 3 * hot, 0, Math.PI * 2); ctx.fill();
      }
    }
    // the output strip fills in as the beads arrive
    const op = easeOutCubic(prog(t, D0 + 1.6, D0 + 2.8));
    if (op > 0) {
      strip(ctx, outCol - stripWidth(D) / 2, OY, OUT, mix(COL.v, COL.q, 0.25), op * fa, 10, CH_, 2);
      glow(ctx, outCol, OY + 8, 70, COL.v, 0.16 * op * fa);
      text(ctx, "it'", outCol - stripWidth(D) / 2 - 20, OY + 15, { f: font('ISI', 30), align: 'right', color: COL.ink, alpha: op * fa });
      text(ctx, '= w1·V1 + w2·V2 + …', outCol, OY + 44, { f: F.mono12, align: 'center', alpha: 0.55 * op * fa, tracking: 0.6 });
    }
    // a pointer to the dominant source
    const pa = easeOutCubic(prog(t, D0 + 1.2, D0 + 1.8)) * fa;
    text(ctx, 'street  0.60', colX(5), VY + CH_ + 52, { f: font('Mono500', 12), align: 'center', color: COL.v, alpha: pa, tracking: 0.6 });
  }
  setFade(1);
}
