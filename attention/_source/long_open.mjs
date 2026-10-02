// Opening (0–10 s): page one of the paper, lit like a projection in a dark hall, then its thesis sentence.
import { createCanvas } from '@napi-rs/canvas';
import {
  clamp, lerp, prog, easeOutCubic, easeInCubic, easeInOutCubic, easeInOutQuart, easeOutExpo, mulberry32,
  COL, rgba, font, text, reveal, glow,
} from './lib.mjs';
import { F } from './long_common.mjs';

const PW = 1000, PH = 1294, PS = 3;
const SERIF = '"Liberation Serif", "Times New Roman", serif';

const ABSTRACT =
  'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder. ' +
  'The best performing models also connect the encoder and decoder through an attention mechanism. ' +
  'We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely. ' +
  'Experiments on two machine translation tasks show these models to be superior in quality while being more parallelizable and requiring significantly less time to train. ' +
  'Our model achieves 28.4 BLEU on the WMT 2014 English-to-German translation task, improving over the existing best results, including ensembles, by over 2 BLEU. ' +
  'On the WMT 2014 English-to-French translation task, our model establishes a new single-model state-of-the-art BLEU score of 41.8 after training for 3.5 days on eight GPUs, a small fraction of the training costs of the best models from the literature. ' +
  'We show that the Transformer generalizes well to other tasks by applying it successfully to English constituency parsing both with large and limited training data.';

const AUTHORS = [
  [['Ashish Vaswani', '*', 'Google Brain'], ['Noam Shazeer', '*', 'Google Brain'], ['Niki Parmar', '*', 'Google Research'], ['Jakob Uszkoreit', '*', 'Google Research']],
  [['Llion Jones', '*', 'Google Research'], ['Aidan N. Gomez', '* †', 'University of Toronto'], ['Łukasz Kaiser', '*', 'Google Brain']],
  [['Illia Polosukhin', '* ‡', '']],
];

let _page = null, G = null;

function buildPage() {
  const c = createCanvas(PW * PS, PH * PS);
  const g = c.getContext('2d');
  g.scale(PS, PS);
  const bg = g.createLinearGradient(0, 0, 0, PH);
  bg.addColorStop(0, '#f3efe6');
  bg.addColorStop(1, '#ebe6da');
  g.fillStyle = bg;
  g.fillRect(0, 0, PW, PH);
  const ink = '#1c1b19';
  g.fillStyle = ink;
  g.textBaseline = 'alphabetic';
  const geo = { authors: [] };

  // rules and title
  g.fillRect(130, 116, 740, 5);
  g.fillRect(130, 240, 740, 1.6);
  g.font = `bold 44px ${SERIF}`;
  g.textAlign = 'center';
  const title = 'Attention Is All You Need';
  g.fillText(title, 500, 194);
  const tw = g.measureText(title).width;
  geo.title = { x0: 500 - tw / 2, x1: 500 + tw / 2, y: 194 };

  // authors
  const rowY = [304, 414, 524];
  AUTHORS.forEach((row, ri) => {
    const colW = 740 / row.length;
    row.forEach(([name, mark, aff], ci) => {
      const cx = 130 + colW * (ci + 0.5);
      g.font = `bold 19px ${SERIF}`;
      const nw = g.measureText(name).width;
      g.font = `19px ${SERIF}`;
      const mw = g.measureText(' ' + mark).width;
      const x0 = cx - (nw + mw) / 2;
      g.textAlign = 'left';
      g.font = `bold 19px ${SERIF}`;
      g.fillText(name, x0, rowY[ri]);
      g.font = `19px ${SERIF}`;
      g.fillText(' ' + mark, x0 + nw, rowY[ri] - 4);
      g.font = `italic 17px ${SERIF}`;
      g.textAlign = 'center';
      if (aff) g.fillText(aff, cx, rowY[ri] + 24);
      geo.authors.push({ x0, x1: x0 + nw, y: rowY[ri] });
    });
  });

  // abstract
  g.textAlign = 'center';
  g.font = `bold 22px ${SERIF}`;
  g.fillText('Abstract', 500, 640);
  g.textAlign = 'left';
  g.font = `19.5px ${SERIF}`;
  const x0 = 190, width = 620, lh = 27;
  const words = ABSTRACT.split(' ');
  const wt = words.map((w) => g.measureText(w).width);
  const space = g.measureText(' ').width;
  const pos = [];
  let i = 0, y = 686;
  while (i < words.length) {
    let j = i, sum = 0;
    while (j < words.length && sum + wt[j] + (j > i ? space : 0) <= width) { sum += wt[j] + (j > i ? space : 0); j++; }
    const n = j - i;
    const lastLine = j >= words.length;
    const gap = lastLine || n === 1 ? space : (width - (sum - (n - 1) * space)) / (n - 1);
    let x = x0;
    for (let k = i; k < j; k++) {
      g.fillText(words[k], x, y);
      pos[k] = { x, y, w: wt[k] };
      x += wt[k] + gap;
    }
    i = j;
    y += lh;
  }
  // thesis sentence boxes (one per line)
  const a = words.findIndex((w, k) => w === 'based' && words[k + 1] === 'solely');
  const b = words.findIndex((w) => w === 'entirely.');
  const lines = new Map();
  for (let k = a; k <= b; k++) {
    const p = pos[k];
    const L = lines.get(p.y) || { y: p.y, x0: p.x, x1: p.x + p.w };
    L.x0 = Math.min(L.x0, p.x);
    L.x1 = Math.max(L.x1, p.x + p.w);
    lines.set(p.y, L);
  }
  geo.thesis = [...lines.values()].sort((u, v) => u.y - v.y);

  // footer + arXiv margin stamp
  g.font = `15px ${SERIF}`;
  g.fillStyle = '#55524b';
  g.textAlign = 'left';
  g.fillRect(130, 1212, 120, 1);
  g.fillText('31st Conference on Neural Information Processing Systems (NIPS 2017), Long Beach, CA, USA.', 130, 1238);
  g.save();
  g.translate(70, 640);
  g.rotate(-Math.PI / 2);
  g.textAlign = 'center';
  g.font = `bold 23px ${SERIF}`;
  g.fillStyle = '#6b675e';
  g.fillText('arXiv:1706.03762v7  [cs.CL]  2 Aug 2023', 0, 0);
  g.restore();

  _page = c;
  G = geo;
}

// camera keyframes: [arrival time, centre x, centre y, zoom, tilt in degrees]
const KF = [
  [0.0, 500, 640, 0.6, -11],
  [3.0, 500, 214, 1.5, -4],
  [5.0, 500, 410, 1.12, -2.2],
  [7.0, null, null, 1.42, 0],
];
const MOVE = 1.4;
function camera(t) {
  const th = G.thesis;
  const tc = { x: 500, y: (th[0].y + th[th.length - 1].y) / 2 - 8 };
  const kf = KF.map(([tt, x, y, z, a]) => [tt, x ?? tc.x, y ?? tc.y, z, a]);
  let cur = kf[0];
  for (let k = 1; k < kf.length; k++) {
    const s = kf[k][0] - MOVE;
    if (t <= s) break;
    const e = easeInOutQuart(clamp((t - s) / MOVE));
    const p = kf[k - 1];
    cur = [kf[k][0], lerp(p[1], kf[k][1], e), lerp(p[2], kf[k][2], e), lerp(p[3], kf[k][3], e), lerp(p[4], kf[k][4], e)];
    if (t < kf[k][0]) break;
  }
  const drift = 1 + 0.0045 * t;
  return { cx: cur[1], cy: cur[2], z: cur[3] * drift, th: cur[4] };
}

export function sceneOpen(ctx, t) {
  if (t > 10.1) return;
  if (!_page) buildPage();
  const rnd = mulberry32(21);

  // projector cone + dust, fading with the page
  const vis = easeOutCubic(clamp(t / 1.4)) * (1 - easeInCubic(prog(t, 7.9, 8.7)));
  if (vis > 0.002) {
    const cone = ctx.createLinearGradient(0, 0, 0, 1080);
    cone.addColorStop(0, `rgba(255,236,206,${0.085 * vis})`);
    cone.addColorStop(1, 'rgba(255,236,206,0)');
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(800, -40); ctx.lineTo(1120, -40); ctx.lineTo(1760, 1100); ctx.lineTo(160, 1100);
    ctx.closePath(); ctx.fill();
    for (let k = 0; k < 70; k++) {
      const x0 = rnd() * 1920, y0 = rnd() * 1080, sp = 4 + rnd() * 10, ph = rnd() * 6.28, r = 0.8 + rnd() * 1.7;
      const x = (x0 + t * sp * 1.4) % 1920, y = (y0 - t * sp + 1080 * 4) % 1080;
      const tw = 0.4 + 0.6 * Math.sin(t * 1.3 + ph) ** 2;
      glow(ctx, x, y, r * 6, [255, 238, 214], 0.16 * tw * vis);
      ctx.fillStyle = rgba([255, 240, 220], 0.5 * tw * vis);
      ctx.beginPath(); ctx.arc(x, y, r * 0.55, 0, 6.283); ctx.fill();
    }
  }

  // the page
  const pageA = vis;
  if (pageA > 0.002) {
    const cam = camera(t);
    const exit = prog(t, 7.9, 8.7);
    ctx.save();
    ctx.translate(960, 500);
    ctx.rotate((cam.th * Math.PI) / 180);
    const z = cam.z * (1 + 0.1 * easeInCubic(exit));
    ctx.scale(z, z);
    ctx.translate(-cam.cx, -cam.cy);
    ctx.globalAlpha = pageA;
    ctx.shadowColor = 'rgba(255,226,190,0.2)';
    ctx.shadowBlur = 120;
    ctx.fillStyle = '#ebe6da';
    ctx.fillRect(0, 0, PW, PH);
    ctx.shadowBlur = 0;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(_page, 0, 0, PW, PH);
    // exposure: let the page sit a little below white
    ctx.fillStyle = 'rgba(16,13,10,0.14)';
    ctx.fillRect(0, 0, PW, PH);

    // marker highlights
    ctx.globalCompositeOperation = 'multiply';
    const tt = G.title;
    const pt = easeInOutCubic(prog(t, 3.0, 3.75));
    if (pt > 0) {
      ctx.fillStyle = 'rgba(255,128,84,0.9)';
      ctx.fillRect(tt.x0 - 10, tt.y - 38, (tt.x1 - tt.x0 + 20) * pt, 52);
    }
    G.thesis.forEach((L, k) => {
      const p = easeInOutCubic(prog(t, 7.0 + k * 0.2, 7.0 + k * 0.2 + 0.55));
      if (p <= 0) return;
      ctx.fillStyle = 'rgba(255,128,84,0.9)';
      ctx.fillRect(L.x0 - 4, L.y - 19, (L.x1 - L.x0 + 8) * p, 26);
    });
    ctx.globalCompositeOperation = 'source-over';

    // author marks, one every 1/4 s
    G.authors.forEach((a, k) => {
      const p = easeOutExpo(prog(t, 4.8 + k * 0.25, 4.8 + k * 0.25 + 0.4));
      if (p <= 0) return;
      ctx.fillStyle = rgba(COL.q, 0.95);
      ctx.fillRect(a.x0, a.y + 5, (a.x1 - a.x0) * p, 2.2);
      ctx.beginPath(); ctx.arc(a.x0 - 9, a.y - 6, 3 * p, 0, 6.283); ctx.fill();
    });
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // the thesis, set large
  const cardOut = 9.5;
  const l1 = 'based solely on attention mechanisms,';
  const l2 = 'dispensing with recurrence and convolutions entirely.';
  const f = font('ISR', 68);
  const i0 = l1.indexOf('attention');
  reveal(ctx, 'THE CLAIM  ·  ABSTRACT', 960, 372, t, { f: F.mono13, size: 13, tracking: 3.4, align: 'center', alpha: 0.55, tIn: 8.15, tOut: cardOut, stagger: 0.012, durIn: 0.7, durOut: 0.35 });
  reveal(ctx, l1, 960, 470, t, {
    f, size: 68, align: 'center', tIn: 8.25, tOut: cardOut, stagger: 0.016, durIn: 0.8, durOut: 0.4,
    colorAt: (i) => (i >= i0 && i < i0 + 9 ? COL.q : COL.ink),
  });
  reveal(ctx, l2, 960, 556, t, { f, size: 68, align: 'center', tIn: 8.55, tOut: cardOut + 0.05, stagger: 0.016, durIn: 0.8, durOut: 0.4 });
  reveal(ctx, '完全基于注意力机制，彻底抛开循环与卷积', 960, 650, t, { f: font('SerifSC400', 30), size: 30, tracking: 8, align: 'center', alpha: 0.9, tIn: 9.0, tOut: cardOut + 0.1, stagger: 0.035, durIn: 0.8, durOut: 0.4 });
}
