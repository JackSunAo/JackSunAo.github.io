// shared benchmark harness: scripted scenes, per-pass draw-call breakdown, JS timings, hitch detection
const { chromium } = require('playwright');
const path = require('path');
async function openGame(opts = {}) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-precise-memory-info', '--js-flags=--expose-gc', '--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: opts.w || 1280, height: opts.h || 720 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n'))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file://' + path.join(__dirname, opts.file || 'dist/test.html'));
  await page.waitForTimeout(opts.wait || 1500);
  // instrument: who is drawn in which pass
  await page.evaluate(() => {
    const D = __dbg, R = D.renderer, I = window.__I = { pass: 'main', tally: {}, on: false };
    const C = D.cats || {};
    const cat = o => {
      for (let p = o; p; p = p.parent) if (p.userData && p.userData.human) { const who = p.userData.who || 'human'; return who + (o.isSkinnedMesh ? '' : '-gear'); }
      const m0 = o.material;
      if (m0 === C.decalMat) return 'decal'; if (m0 && m0.map === C.poolTex) return 'pool'; if (m0 === C.gougeMat || m0 === C.crackMat) return 'doormark';
      if (m0 === C.puddleMat) return 'puddle'; if (m0 === C.streakMat) return 'streak'; if (m0 && m0.map === C.ringTex) return 'ring';
      for (let p = o; p; p = p.parent) if (p === C.doorPivot) return 'door';
      if (o.isPoints || o.isLine || o.isLineSegments) return 'particles';
      if (o.isSprite) return 'sprite';
      const m = o.material; if (m && m.color && m.color.getHex() === 0x1a1612) return 'tree';
      if (m && m.transparent) return 'transparent';
      return 'world';
    };
    const rbd = R.renderBufferDirect.bind(R);
    R.renderBufferDirect = function (camera, scene, geometry, material, object, group) {
      if (I.on) { const k = I.pass + ':' + cat(object); I.tally[k] = (I.tally[k] || 0) + 1; }
      return rbd(camera, scene, geometry, material, object, group);
    };
    if (!D.PERF) { // the old build: split three's own shadow step per light
      const sm = R.shadowMap, orig = sm.render;
      sm.render = function (lights, scene, camera) { const prev = I.pass; for (const l of lights) { I.pass = 'sh-' + l.type; orig.call(sm, [l], scene, camera); } I.pass = prev; };
    }
    // tag the humans
    D.P.h.root.userData.who = 'player'; D.mother.h.root.userData.who = 'mother';
    D.defenders.forEach(d => { d.h.root.userData.who = 'defender'; });
  });
  return { browser, page, errs };
}
// measure n frames of the real frame function; returns stats
async function measure(page, label, n = 40) {
  return page.evaluate(([label, n]) => {
    const D = __dbg, R = D.renderer, I = window.__I;
    for (const e of D.infected) if (e.h && !e.h.root.userData.who) e.h.root.userData.who = 'infected';
    const gl = R.getContext(), px = new Uint8Array(4);
    const rf = D.renderFrame || (dt => { D.step(1, dt); D.composerRender(); });
    const prog0 = R.info.programs.length;
    const T = { tick: [], render: [], sync: [], total: [] }; let calls = 0, tris = 0;
    I.tally = {};
    for (let i = 0; i < n; i++) {
      I.on = i === n - 1; // tally one frame
      R.info.autoReset = false; R.info.reset();
      const t0 = performance.now();
      const parts = rf(1 / 60);
      const t1 = performance.now();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); // wait for the (software) GPU
      const t2 = performance.now();
      T.total.push(t1 - t0); T.sync.push(t2 - t1);
      if (parts) { T.tick.push(parts.tick); T.render.push(parts.render); }
      calls += R.info.render.calls; tris += R.info.render.triangles;
    }
    I.on = false;
    const med = a => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
    const p95 = a => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * 0.95))]; };
    const by = {}; for (const k in I.tally) { const [pass, c] = k.split(':'); by[pass] = by[pass] || { total: 0 }; by[pass][c] = I.tally[k]; by[pass].total += I.tally[k]; }
    return { label, calls: Math.round(calls / n), tris: Math.round(tris / n / 1000) + 'k', js: +med(T.total).toFixed(2), jsP95: +p95(T.total).toFixed(2), tick: +med(T.tick).toFixed(2), render: +med(T.render).toFixed(2), gpuSync: +med(T.sync).toFixed(1), newPrograms: R.info.programs.length - prog0, programs: R.info.programs.length, by };
  }, [label, n]);
}
function show(r) {
  const passes = Object.entries(r.by).sort((a, b) => b[1].total - a[1].total).map(([p, o]) => '    ' + p.padEnd(12) + String(o.total).padStart(5) + '  ' + Object.entries(o).filter(([k]) => k !== 'total').sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + v).join(', ')).join('\n');
  return `${r.label}\n  draw calls ${r.calls}, tris ${r.tris}, JS ${r.js} ms (p95 ${r.jsP95}; tick ${r.tick}, render ${r.render}), swiftshader wait ${r.gpuSync} ms, programs ${r.programs} (+${r.newPrograms})\n${passes}`;
}
// scripted scenes
const SCENES = {
  outdoorStart: `D.startGame(); D.skipOpening(); D.step(300);`,
  indoor: `D.P.pos.set(1.6, 0, 0.9); D.step(60);`,
  wave5Siege: `D.P.pos.set(1.2, 0, -0.6); D.G.playT = 999; D.P.invuln = 99;
    for (let w = 0; w < 3; w++) { D.infected.forEach(e => { if (!e.dead) { e.dead = true; } }); D.spawnWave(); }
    D.infected.forEach(e => { if (!e.dead) { e.provoked = true; e.aware = 1.2; } }); D.step(600);`,
  command: `D.setCommand(true, true); D.step(30);`,
  commandOff: `D.setCommand(false, true); D.step(10);`,
  possessDoor: `D.possess(D.defenders[0]); D.step(120);`,
  yardBrawl: `D.possess(D.P, true); D.P.pos.set(0.5, -0.25, 8.5); D.toggleTorch && D.toggleTorch(); D.infected.forEach((e, i) => { if (!e.dead) { e.pos.set(0.5 + Math.cos(i) * 3, -0.25, 8.5 + Math.sin(i) * 3); } }); D.step(120);`
};
module.exports = { openGame, measure, show, SCENES };
