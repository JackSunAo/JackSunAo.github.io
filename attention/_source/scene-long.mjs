// "Attention Is All You Need" — 2-minute cut. Design space 1920×1080, time in seconds, locked to 120 BPM.
import { createCanvas } from '@napi-rs/canvas';
import { clamp, prog, smooth, easeInCubic, easeInOutSine, mulberry32, COL, rgba, setFade } from './lib.mjs';
import { W, H, DURATION, kick, chrome, captions } from './long_common.mjs';
import { sceneOpen } from './long_open.mjs';
import { sceneSentence } from './long_sentence.mjs';
import { sceneScaling, sceneMultiHead, scenePosition } from './long_mid.mjs';
import { sceneArch } from './long_arch.mjs';
import { sceneTable, sceneResults, sceneLegacy } from './long_end.mjs';

export { W, H, DURATION };
export const samplesAt = () => 4;

// ---------------------------------------------------------------- background (dithered radial lift)
let _bg = null, _bgS = 0;
function buildBackground(S) {
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

export function drawFrame(ctx, t, S = 1) {
  setFade(1);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  if (!_bg || _bgS !== S) { _bg = buildBackground(S); _bgS = S; }
  ctx.drawImage(_bg, 0, 0);
  ctx.setTransform(S, 0, 0, S, 0, 0);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.save();
  // slow drift + beat kick
  const cs = 1 + 0.03 * easeInOutSine(clamp(t / DURATION)) + 0.0085 * kick(t);
  ctx.translate(960, 480);
  ctx.scale(cs, cs);
  ctx.translate(-960, -480);
  sceneOpen(ctx, t);
  setFade(1);
  sceneSentence(ctx, t);
  setFade(1);
  sceneScaling(ctx, t);
  sceneMultiHead(ctx, t);
  scenePosition(ctx, t);
  setFade(1);
  sceneArch(ctx, t);
  setFade(1);
  sceneTable(ctx, t);
  sceneResults(ctx, t);
  sceneLegacy(ctx, t);
  setFade(1);
  ctx.restore();

  chrome(ctx, t);
  captions(ctx, t);

  const fade = Math.max(1 - prog(t, 0, 0.4), easeInCubic(prog(t, 119.3, 120)));
  if (fade > 0) {
    ctx.globalAlpha = fade;
    ctx.fillStyle = '#050404';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
}
