// severed parts: the piece flies as itself, the body loses it; the door: holes show and the planks fly
const { openGame } = require('./bench_lib.cjs'); const fs = require('fs');
(async () => {
  const { browser, page, errs } = await openGame({ w: 960, h: 540 });
  const r = await page.evaluate(() => {
    const D = __dbg; D.startGame(); D.skipOpening(); D.step(60);
    const e = D.infected[0]; e.pos.set(0.6, -0.25, 7.6); e.yaw = 0; e.setState('lurk'); D.P.pos.set(0.6, -0.25, 9.0); D.P.yaw = Math.PI;
    D.G.camOv = { pos: new THREE.Vector3(3.2, 2.2, 10.4), tgt: new THREE.Vector3(0.6, 0.9, 7.6), fov: 40 }; D.step(10);
    e.severArm('L', new THREE.Vector3(-1, 0.3, 0)); e.severLeg('R', new THREE.Vector3(1, 0.2, 0)); D.step(4);
    const shots = []; D.composerRender(); shots.push(D.renderer.domElement.toDataURL());
    e.decapitate(new THREE.Vector3(0, 1, 0.3)); D.step(10); D.composerRender(); shots.push(D.renderer.domElement.toDataURL());
    D.step(60); D.composerRender(); shots.push(D.renderer.domElement.toDataURL());
    const slotsOff = e.h.parts.filter(p => p.userData.skinOff).length, drawnSelf = e.h.parts.filter(p => p.layers.test(D.camera.layers)).length;
    // door: chop it full of holes
    D.G.camOv = { pos: new THREE.Vector3(1.6, 1.6, 6.2), tgt: new THREE.Vector3(0, 1.0, 3.1), fov: 42 };
    for (let i = 0; i < 40; i++) { D.doorChop(0.2 + (i % 5) * 0.18, 0.4 + Math.floor(i / 5) * 0.2, 1.4); D.step(2); }
    D.step(20); D.composerRender(); shots.push(D.renderer.domElement.toDataURL());
    return { shots, slotsOff, drawnSelf, parts: e.h.parts.length, holes: D.door.holes, bad: D.checkStatic() };
  });
  r.shots.forEach((s, i) => fs.writeFileSync(`shots/gib_${i}.png`, Buffer.from(s.split(',')[1], 'base64')));
  console.log(`parts ${r.parts}, torn off (drawn as themselves) ${r.slotsOff} / ${r.drawnSelf}, door holes ${r.holes}, static check: ${r.bad.length ? r.bad.join('; ') : 'ok'}`);
  console.log('errors:', errs.length ? errs.join('\n') : 'none'); await browser.close();
})();
