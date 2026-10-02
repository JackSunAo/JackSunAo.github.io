// Usage:
//   node render.mjs stills <scale> <outdir> t1 t2 ...
//   node render.mjs video <scale> <fps> <samples> <frameFrom> <frameTo> <outfile>
import { createCanvas } from '@napi-rs/canvas';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { registerFonts } from './lib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
registerFonts(path.join(here, 'fonts'));
const sceneMod = await import(process.env.SCENE ? path.resolve(process.env.SCENE) : path.join(here, 'scene.mjs'));
const { drawFrame, W, H } = sceneMod;
const samplesAt = sceneMod.samplesAt ?? (() => 4);
const [mode, ...args] = process.argv.slice(2);

if (mode === 'stills') {
  const [scaleS, outdir, ...ts] = args;
  const S = parseFloat(scaleS);
  const c = createCanvas(Math.round(W * S), Math.round(H * S));
  const ctx = c.getContext('2d');
  fs.mkdirSync(outdir, { recursive: true });
  for (const ts_ of ts) {
    const t = parseFloat(ts_);
    drawFrame(ctx, t, S);
    fs.writeFileSync(path.join(outdir, `still_${t.toFixed(2).padStart(5, '0')}.png`), await c.encode('png'));
  }
} else if (mode === 'video') {
  const [scaleS, fpsS, samplesS, f0S, f1S, out] = args;
  const S = parseFloat(scaleS), fps = parseFloat(fpsS), f0 = parseInt(f0S), f1 = parseInt(f1S);
  const NSarg = samplesS === 'auto' ? null : parseInt(samplesS);
  const w = Math.round(W * S), h = Math.round(H * S);
  const c = createCanvas(w, h);
  const ctx = c.getContext('2d');
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${w}x${h}`, '-r', String(fps), '-i', '-',
    '-c:v', 'libx264rgb', '-preset', 'ultrafast', '-qp', '0', '-threads', '2', '-pix_fmt', 'rgb24', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const acc = new Uint16Array(w * h * 4);
  const outBuf = Buffer.alloc(w * h * 4);
  const shutter = 0.5 / fps;
  const write = (buf) => new Promise((res) => { if (!ff.stdin.write(buf)) ff.stdin.once('drain', res); else res(); });
  const tStart = Date.now();
  for (let f = f0; f < f1; f++) {
    const t = f / fps;
    const NS = NSarg ?? samplesAt(t);
    if (NS <= 1) {
      drawFrame(ctx, t, S);
      const d = c.data();
      d.copy(outBuf);
    } else {
      acc.fill(0);
      for (let k = 0; k < NS; k++) {
        const tk = t + ((k + 0.5) / NS - 0.5) * shutter;
        drawFrame(ctx, Math.max(0, tk), S);
        const d = c.data();
        for (let i = 0; i < d.length; i++) acc[i] += d[i];
      }
      const half = NS >> 1;
      for (let i = 0; i < acc.length; i++) outBuf[i] = ((acc[i] + half) / NS) | 0;
    }
    await write(Buffer.from(outBuf));
    if ((f - f0) % 30 === 0) {
      const el = (Date.now() - tStart) / 1000;
      process.stderr.write(`[${path.basename(out)}] frame ${f} (${f - f0 + 1}/${f1 - f0}) ${(el / (f - f0 + 1)).toFixed(2)}s/f\n`);
    }
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
}
