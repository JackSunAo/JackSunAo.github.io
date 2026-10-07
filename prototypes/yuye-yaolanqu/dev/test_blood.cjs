const { chromium } = require('playwright');
const path = require('path');
const out = path.join(__dirname, 'shots');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message + ' ' + (e.stack || '').split('\n').slice(0, 3).join(' | ')));
  await page.goto('file://' + path.join(__dirname, 'dist/test.html'));
  await page.waitForTimeout(2500);
  const ev = (f, a) => page.evaluate(f, a);
  const shot = async (name, n, wait = 2800) => { await ev(k => __dbg.step(k), n); await page.waitForTimeout(wait); await page.screenshot({ path: path.join(out, name + '.png') }); console.log('shot', name); };
  const iso = (keep) => `const D = __dbg; D.G.playT = 999; D.G.flood.next = D.G.t + 999; D.SQUAD.tokenCD = 0; D.infected.forEach(e => { if (e.type !== '${keep}') { e.pos.set(14, -0.25, 24); e.setState('lurk'); e.aware = 0; e.provoked = false; } });`;
  await ev(() => { __dbg.startGame(); __dbg.skipOpening(); __dbg.step(30); });
  await page.waitForTimeout(2000);
  // 1) the office comes at you from the front: a clinch, not the ground
  await ev(new Function(iso('office') + ` const o = D.infected.find(e => e.type === 'office'); D.P.pos.set(-4, -0.25, 12); D.P.yaw = 0; D.P.adr = 0; D.P.stamina = 100; o.pos.set(-4, -0.25, 12.7); o.yaw = Math.PI; o.aware = 1.2; o.provoked = true; o.state = 'lunge'; o.st = 0; o.lungeT.copy(D.P.pos); D.G.camMode = 'close'; D.cam.yaw = 1.2;`));
  await shot('60_clinch', 6);
  console.log('clinch:', JSON.stringify(await ev(() => ({ p: __dbg.P.state, need: __dbg.P.clinchNeed, by: __dbg.P.clinchBy && __dbg.P.clinchBy.type }))));
  for (let i = 0; i < 6 && await ev(() => __dbg.P.state === 'clinch'); i++) await ev(k => { __dbg.clinchAct(k % 2 ? 'knee' : 'shove'); __dbg.step(3); }, i);
  await shot('61_pushed_off', 12);
  console.log('after shoving:', JSON.stringify(await ev(() => ({ p: __dbg.P.state, o: __dbg.infected.find(e => e.type === 'office').state }))));
  // 2) same again, and you do nothing: it drags you down
  await ev(new Function(iso('office') + ` const o = D.infected.find(e => e.type === 'office'); D.P.invuln = 0; D.P.state = 'move'; o.pos.set(-4, -0.25, 12.7); o.state = 'lunge'; o.st = 0; o.lungeT.copy(D.P.pos); o.bal = 1;`));
  await ev(() => __dbg.step(4)); const c2 = await ev(() => __dbg.P.state); await ev(() => __dbg.step(60));
  console.log('no response:', c2, '->', await ev(() => __dbg.P.state));
  // 3) the butcher from behind: straight to the ground
  await ev(new Function(iso('butcher') + ` const b = D.infected.find(e => e.type === 'butcher'); const pi = D.P.pinnedBy; if (pi) { pi.setState('stalk'); } D.P.state = 'move'; D.P.pinnedBy = null; document.getElementById('qte').classList.remove('on'); D.P.invuln = 0; D.P.yaw = 0; b.pos.set(-4, -0.25, 11.3); b.yaw = 0; b.aware = 1.2; b.state = 'lunge'; b.st = 0; b.lungeT.copy(D.P.pos); D.infected.find(e => e.type === 'office').pos.set(14, -0.25, 24);`));
  await ev(() => __dbg.step(5)); console.log('tackle from behind:', await ev(() => __dbg.P.state + ' by ' + (__dbg.P.pinnedBy && __dbg.P.pinnedBy.type)));
  // 4) the axe: a heavy chop into the chest, another; watch it bleed out, pass out, die
  await ev(() => { const D = __dbg; D.resetGame(); });
  await ev(new Function(iso('office') + ` const o = D.infected.find(e => e.type === 'office'); D.P.invuln = 999; D.switchWeapon('axe'); D.P.pos.set(-4, -0.25, 12); D.P.yaw = 0; o.pos.set(-4, -0.25, 13.5); o.yaw = Math.PI; o.state = 'recover'; o.st = 0; o.cool = 99; o.aware = 1.2; D.SQUAD.tokenCD = 99; D.G.camMode = 'close'; D.cam.yaw = 1.0;
    const dir = new THREE.Vector3(0, 0, 1); o.injure('torso', 'L', 75, 'heavy', true, dir, { x: 0.1, z: -1 }, false); o.injure('torso', 'R', 75, 'heavy', true, dir, { x: -0.1, z: -1 }, false); if (!o.body.arteries.torso) o.cutArtery('torso', 'L', dir, 5);`));
  const sample = async l => console.log(l, JSON.stringify(await ev(() => { const o = __dbg.infected.find(e => e.type === 'office'); return { st: o.state, blood: +o.body.blood.toFixed(1), bleed: +o.body.bleed.toFixed(2), art: +o.body.art.toFixed(2), cond: o.condition(), dead: o.dead }; })));
  await sample('t0'); await shot('62_arterial', 45); await sample('t1.5s');
  await ev(() => __dbg.step(150)); await sample('t6.5s');
  await shot('63_ko', 150); await sample('t11.5s');
  await ev(() => __dbg.step(450)); await sample('t26.5s');
  // 5) a neck cut
  await ev(new Function(iso('butcher') + ` const b = D.infected.find(e => e.type === 'butcher'); b.pos.set(-4, -0.25, 13.5); b.state = 'recover'; b.cool = 99; b.cutArtery('neck', 'L', new THREE.Vector3(0, 0, 1), 9);`));
  let t = 0; for (; t < 40 && !(await ev(() => __dbg.infected.find(e => e.type === 'butcher').ko)); t++) await ev(() => __dbg.step(15));
  console.log('neck cut: unconscious after ~', (t * 0.5).toFixed(1), 's');
  // 6) a quiet kill: the student lurking with its back to you
  await ev(() => { const D = __dbg; D.resetGame(); });
  await ev(new Function(iso('student') + ` const s = D.infected.find(e => e.type === 'student'); D.G.playT = 0; s.pos.set(-6, -0.25, 15); s.yaw = Math.PI; s.state = 'search'; s.st = 0; s.searchYaw = Math.PI; s.aware = 0.2; s.seen = 0; D.P.pos.set(-6, -0.25, 15.9); D.P.yaw = Math.PI; D.P.crouch = true; D.P.shutter = true; D.G.camMode = 'close'; D.cam.yaw = 0.9;`));
  await ev(() => __dbg.step(2));
  console.log('takedown target:', JSON.stringify(await ev(() => { const t = __dbg.takedownTarget(); return t && { kind: t.kind, type: t.e.type }; })));
  await ev(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' })); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE' })); });
  await shot('64_takedown', 16);
  await shot('65_takedown_after', 40);
  console.log('after takedown:', JSON.stringify(await ev(() => __dbg.infected.map(e => e.type + ':' + e.state + ' aw' + e.aware.toFixed(2)))));
  console.log(errors.length ? errors.slice(0, 10).join('\n') : 'no errors');
  await browser.close();
})();
