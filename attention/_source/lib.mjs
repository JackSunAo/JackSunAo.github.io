// Shared helpers: easing, colour, fonts, text layout and drawing primitives.
import { GlobalFonts } from '@napi-rs/canvas';
import path from 'path';

// ---------- math & easing ----------
export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const prog = (t, a, b) => clamp((t - a) / (b - a));
export const smooth = (x) => x * x * (3 - 2 * x);
export const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
export const easeInCubic = (x) => x * x * x;
export const easeInOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const easeOutQuart = (x) => 1 - Math.pow(1 - x, 4);
export const easeInOutQuart = (x) => (x < 0.5 ? 8 * x ** 4 : 1 - Math.pow(-2 * x + 2, 4) / 2);
export const easeOutExpo = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
export const easeInExpo = (x) => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10));
export const easeInOutExpo = (x) =>
  x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2;
export const easeInOutSine = (x) => -(Math.cos(Math.PI * x) - 1) / 2;
// fade window: 0 before a, ramps to 1 by a+fin, holds, ramps to 0 between b-fout and b
export const win = (t, a, b, fin = 0.4, fout = 0.4, ein = easeOutCubic, eout = easeInOutCubic) => {
  if (t <= a || t >= b) return 0;
  const i = fin > 0 ? ein(clamp((t - a) / fin)) : 1;
  const o = fout > 0 ? 1 - eout(clamp((t - (b - fout)) / fout)) : 1;
  return Math.min(i, o);
};

// deterministic PRNG
export function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- colour ----------
export const COL = {
  bg: [11, 10, 9],
  ink: [238, 232, 220],
  q: [255, 106, 61], // vermillion – query / focus
  k: [230, 194, 122], // pale gold – key
  v: [138, 169, 214], // slate blue – value
};
// global fade multiplier: a shot sets it so everything it draws fades together
export let FADE = 1;
export const setFade = (f) => { FADE = clamp(f); };
export const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a * FADE})`;
export const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];

// ---------- fonts ----------
export function registerFonts(dir) {
  const reg = (file, alias) => {
    const ok = GlobalFonts.registerFromPath(path.join(dir, file), alias);
    if (!ok) throw new Error('font failed: ' + file);
  };
  reg('InstrumentSerif-Regular.ttf', 'ISR');
  reg('InstrumentSerif-Italic.ttf', 'ISI');
  for (const w of [400, 500, 600]) reg(`NotoSerifSC-${w}.ttf`, `SerifSC${w}`);
  for (const w of [300, 400, 500]) reg(`NotoSansSC-${w}.ttf`, `SansSC${w}`);
  reg('IBMPlexMono-Light.ttf', 'Mono300');
  reg('IBMPlexMono-Regular.ttf', 'Mono400');
  reg('IBMPlexMono-Medium.ttf', 'Mono500');
}
export const font = (fam, size) => `${size}px ${fam}`;

// ---------- text ----------
const layoutCache = new Map();
export function layout(ctx, str, f, tracking = 0) {
  const key = f + '|' + tracking + '|' + str;
  let L = layoutCache.get(key);
  if (L) return L;
  ctx.font = f;
  const chars = Array.from(str);
  const xs = [];
  let acc = '';
  for (let i = 0; i < chars.length; i++) {
    xs.push(ctx.measureText(acc).width + i * tracking);
    acc += chars[i];
  }
  const width = ctx.measureText(str).width + Math.max(0, chars.length - 1) * tracking;
  const ws = chars.map((c, i) => (i < chars.length - 1 ? xs[i + 1] - xs[i] - tracking : width - xs[i]));
  L = { chars, xs, ws, width };
  layoutCache.set(key, L);
  return L;
}
export const textWidth = (ctx, str, f, tracking = 0) => layout(ctx, str, f, tracking).width;

function originX(x, w, align) {
  return align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
}

// plain text with optional tracking
export function text(ctx, str, x, y, o) {
  const { f, color = COL.ink, alpha = 1, align = 'left', tracking = 0 } = o;
  if (alpha <= 0.002 || !str) return;
  const L = layout(ctx, str, f, tracking);
  const x0 = originX(x, L.width, align);
  ctx.font = f;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = Array.isArray(color) ? rgba(color, 1) : color;
  ctx.globalAlpha = 1;
  ctx.globalAlpha = alpha;
  if (!tracking) ctx.fillText(str, x0, y);
  else for (let i = 0; i < L.chars.length; i++) ctx.fillText(L.chars[i], x0 + L.xs[i], y);
  ctx.globalAlpha = 1;
}

// Editorial mask reveal: glyphs rise from behind the baseline, and exit upwards.
export function reveal(ctx, str, x, y, t, o) {
  const {
    f, size, color = COL.ink, alpha = 1, align = 'left', tracking = 0,
    tIn, tOut = null, stagger = 0.02, durIn = 0.7, durOut = 0.45, rise = 0.95, mask = true,
    colorAt = null,
  } = o;
  if (t < tIn || alpha <= 0.002) return;
  const L = layout(ctx, str, f, tracking);
  const n = L.chars.length;
  const x0 = originX(x, L.width, align);
  ctx.save();
  if (mask) {
    ctx.beginPath();
    ctx.rect(x0 - size * 0.6, y - size * 1.25, L.width + size * 1.2, size * 1.62);
    ctx.clip();
  }
  ctx.font = f;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  for (let i = 0; i < n; i++) {
    const ti = tIn + i * stagger;
    const pin = clamp((t - ti) / durIn);
    if (pin <= 0) continue;
    const ein = easeOutExpo(pin);
    let dy = (1 - ein) * rise * size;
    let a = clamp(pin * 2.2);
    if (tOut !== null) {
      const to = tOut + i * stagger * 0.5;
      const po = clamp((t - to) / durOut);
      if (po >= 1) continue;
      const eo = easeInCubic(po);
      dy -= eo * rise * size * 0.85;
      a *= 1 - eo;
    }
    const c = colorAt ? colorAt(i) : color;
    ctx.fillStyle = Array.isArray(c) ? rgba(c, 1) : c;
    ctx.globalAlpha = a * alpha;
    ctx.fillText(L.chars[i], x0 + L.xs[i], y + dy);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

// Soft defocus by drawing a glyph on two rings of taps (cheap stand-in for blur)
export function defocusGlyph(ctx, ch, x, y, r) {
  if (r < 0.35) {
    ctx.fillText(ch, x, y);
    return;
  }
  const a0 = ctx.globalAlpha;
  const taps = [[0, 0, 0.16]];
  for (let k = 0; k < 6; k++) taps.push([Math.cos((k / 6) * 6.283) * r * 0.5, Math.sin((k / 6) * 6.283) * r * 0.5, 0.07]);
  for (let k = 0; k < 10; k++) taps.push([Math.cos((k / 10) * 6.283 + 0.3) * r, Math.sin((k / 10) * 6.283 + 0.3) * r, 0.042]);
  for (const [dx, dy, w] of taps) {
    ctx.globalAlpha = a0 * w;
    ctx.fillText(ch, x + dx, y + dy);
  }
  ctx.globalAlpha = a0;
}

// ---------- geometry ----------
// cubic "arch" from (x1,y1) to (x2,y2) peaking h above the higher endpoint
export function archPoints(x1, y1, x2, y2, h, n = 56) {
  const cy = Math.min(y1, y2) - h / 0.75;
  const pts = new Array(n + 1);
  for (let i = 0; i <= n; i++) {
    const u = i / n, v = 1 - u;
    const a = v * v * v, b = 3 * v * v * u, c = 3 * v * u * u, d = u * u * u;
    pts[i] = [a * x1 + b * x1 + c * x2 + d * x2, a * y1 + b * cy + c * cy + d * y2];
  }
  return pts;
}
export function cubicPoints(p0, p1, p2, p3, n = 48) {
  const pts = new Array(n + 1);
  for (let i = 0; i <= n; i++) {
    const u = i / n, v = 1 - u;
    const a = v * v * v, b = 3 * v * v * u, c = 3 * v * u * u, d = u * u * u;
    pts[i] = [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]];
  }
  return pts;
}
// trace the part of a polyline between fractions [f0,f1] of its length
export function tracePartial(ctx, pts, f0, f1) {
  if (f1 <= f0) return false;
  const n = pts.length;
  const cum = [0];
  for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = cum[n - 1];
  const s0 = f0 * L, s1 = f1 * L;
  const at = (s) => {
    let i = 1;
    while (i < n - 1 && cum[i] < s) i++;
    const seg = cum[i] - cum[i - 1] || 1;
    const u = clamp((s - cum[i - 1]) / seg);
    return [lerp(pts[i - 1][0], pts[i][0], u), lerp(pts[i - 1][1], pts[i][1], u), i];
  };
  const a = at(s0), b = at(s1);
  ctx.moveTo(a[0], a[1]);
  for (let i = a[2]; i < b[2]; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.lineTo(b[0], b[1]);
  return true;
}
export function pointAt(pts, f) {
  const n = pts.length;
  const cum = [0];
  for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const s = clamp(f) * cum[n - 1];
  let i = 1;
  while (i < n - 1 && cum[i] < s) i++;
  const u = clamp((s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1));
  return [lerp(pts[i - 1][0], pts[i][0], u), lerp(pts[i - 1][1], pts[i][1], u)];
}

export function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// soft radial glow
export function glow(ctx, x, y, r, c, a) {
  if (a <= 0.002) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(c, a));
  g.addColorStop(0.4, rgba(c, a * 0.35));
  g.addColorStop(1, rgba(c, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
