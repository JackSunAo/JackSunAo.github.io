// Parallel chunked render: node make.mjs <scale> <fps> <workers> <outdir> [chunkFrames]
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
const [scaleS = '2', fpsS = '60', workersS = '4', outdir = 'out/master', chunkS = '60'] = process.argv.slice(2);
const fps = parseFloat(fpsS), total = Math.round(30 * fps), chunk = parseInt(chunkS), workers = parseInt(workersS);
fs.mkdirSync(outdir, { recursive: true });
const jobs = [];
for (let f = 0, k = 0; f < total; f += chunk, k++) jobs.push({ k, f0: f, f1: Math.min(total, f + chunk), file: path.join(outdir, `seg_${String(k).padStart(3, '0')}.mkv`) });
let next = 0, done = 0;
const t0 = Date.now();
await new Promise((resolve, reject) => {
  const launch = () => {
    if (next >= jobs.length) return;
    const j = jobs[next++];
    if (fs.existsSync(j.file + '.done')) { done++; if (done === jobs.length) resolve(); else launch(); return; }
    const p = spawn('node', ['render.mjs', 'video', scaleS, fpsS, 'auto', String(j.f0), String(j.f1), j.file], { stdio: ['ignore', 'ignore', 'pipe'] });
    p.stderr.on('data', () => {});
    p.on('close', (code) => {
      if (code !== 0) return reject(new Error('chunk failed ' + j.k));
      fs.writeFileSync(j.file + '.done', '');
      done++;
      console.log(`chunk ${j.k} done (${done}/${jobs.length}) elapsed ${((Date.now() - t0) / 1000).toFixed(0)}s`);
      if (done === jobs.length) resolve(); else launch();
    });
  };
  for (let i = 0; i < workers; i++) launch();
});
fs.writeFileSync(path.join(outdir, 'list.txt'), jobs.map((j) => `file '${path.basename(j.file)}'`).join('\n') + '\n');
console.log('all chunks done in', ((Date.now() - t0) / 1000).toFixed(0), 's');
