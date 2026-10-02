import * as THREE from 'three';
import { WORLD, groundHeight, shoreZ, buildTerrainGeometry, buildHeightTexture } from './world.js';
import { makeWaveTextures, solveWaves, SurfaceSampler, NW } from './waves.js';
import { makeSmallWaves } from './smallwaves.js';
import {
  commonChunk, skyVert, skyFrag, waterVert, waterFrag, terrainVert, terrainFrag, quadVert, simFrag,
} from './glsl.js';
import { Post } from './post.js';
import { makeFish, makeGulls, makeGrass, makeProps, makeMotes } from './creatures.js';
import { clamp, smoothstep, lerp, rng } from './noise.js';

const $ = (id) => document.getElementById(id);
const qs = new URLSearchParams(location.search);
const isTouch = matchMedia('(pointer:coarse)').matches;
document.body.classList.toggle('touch', isTouch);

// ------------------------------------------------------------------ settings
const DEFAULTS = {
  waveHeight: 1.2, waveDir: 0, breaker: 1.0, shoreFoam: 1.0, persist: 0.5, swash: 1.0, wetSand: 1.0, tide: 0,
  clarity: 1.0, turb: 0.15, caustics: 1.0, exposure: 1.0, sunElev: 24, overcast: 0.0, timeSpeed: 1.0, chop: 1.0,
};
const params = { ...DEFAULTS };
const SLIDERS = [
  ['海况', null],
  ['waveHeight', '波高', 0.4, 1.8, 0.05, (v) => v.toFixed(2) + '×'],
  ['waveDir', '波向', -35, 35, 1, (v) => v.toFixed(0) + '°'],
  ['breaker', '碎浪强度', 0, 1.6, 0.05, (v) => v.toFixed(2)],
  ['chop', '风浪细纹', 0.3, 1.6, 0.05, (v) => v.toFixed(2)],
  ['tide', '潮位', -0.5, 0.6, 0.02, (v) => (v >= 0 ? '+' : '') + v.toFixed(2) + ' m'],
  ['岸线', null],
  ['shoreFoam', '岸边泡沫', 0, 1.5, 0.05, (v) => v.toFixed(2)],
  ['persist', '泡沫持续', 0, 1, 0.02, (v) => v.toFixed(2)],
  ['swash', '上溯水舌', 0.4, 2, 0.05, (v) => v.toFixed(2)],
  ['wetSand', '湿沙', 0, 1.2, 0.05, (v) => v.toFixed(2)],
  ['水体', null],
  ['clarity', '透明度', 0.5, 1.6, 0.05, (v) => v.toFixed(2)],
  ['turb', '浑浊度', 0, 1, 0.02, (v) => v.toFixed(2)],
  ['caustics', '焦散', 0, 1.5, 0.05, (v) => v.toFixed(2)],
  ['光与时间', null],
  ['sunElev', '太阳高度', 3, 70, 1, (v) => v.toFixed(0) + '°'],
  ['exposure', '曝光', 0.5, 1.8, 0.02, (v) => v.toFixed(2)],
  ['timeSpeed', '时间速度', 0, 3, 0.1, (v) => v.toFixed(1) + '×'],
];
const TIMES = [
  { name: '晴昼', e: 54, o: 0.0 },
  { name: '午后', e: 24, o: 0.0 },
  { name: '黄金时刻', e: 7, o: 0.0 },
  { name: '柔和阴天', e: 38, o: 1.0 },
];

// ------------------------------------------------------------------ quality
const QUALITY = {
  low:    { label: 'Low',    pr: 0.6,  msaa: 0, nr: 150, na: 180, terr: 1.7, march: 18, iters: 1, grass: 4000,  fish: 28, motes: 200, rocks: 40 },
  medium: { label: 'Medium', pr: 0.85, msaa: 0, nr: 220, na: 280, terr: 1.15, march: 22, iters: 1, grass: 12000, fish: 48, motes: 400, rocks: 80 },
  high:   { label: 'High',   pr: 1.0,  msaa: 4, nr: 300, na: 360, terr: 0.85, march: 26, iters: 2, grass: 22000, fish: 70, motes: 600, rocks: 120 },
  ultra:  { label: 'Ultra',  pr: 1.5,  msaa: 4, nr: 360, na: 440, terr: 0.7,  march: 28, iters: 2, grass: 34000, fish: 90, motes: 800, rocks: 150 },
};
let qualityKey = qs.get('q') || (isTouch ? 'medium' : 'high');
if (!QUALITY[qualityKey]) qualityKey = 'high';
let autoQuality = !qs.get('q');

// ------------------------------------------------------------------ presets
const PRESETS = [
  { n: '海滩全景', en: 'Hero Beach', x: -34, z: () => shoreZ(-34) - 8, rule: ['ground', 2.1], look: [28, -1.2, 62], fov: 62 },
  { n: '波打际', en: 'Shoreline', x: -9, z: () => shoreZ(-9) - 1.4, rule: ['ground', 0.55], look: [16, 0.05, 14], fov: 62 },
  { n: '游泳视线', en: 'Swimmer', x: 6, z: 62, rule: ['surf', 0.2], look: [-46, 1.6, 230], fov: 64 },
  { n: '空拍', en: 'Aerial', x: -66, z: -78, rule: ['abs', 78], look: [10, -2, 52], fov: 55 },
  { n: '水中·朝岸', en: 'Underwater Shore', x: 4, z: () => shoreZ(4) + 30, rule: ['under', 0.5], look: [2, -0.5, -12], fov: 70 },
  { n: '水中·朝海', en: 'Underwater Sea', x: 6, z: () => shoreZ(6) + 60, rule: ['under', 0.95], look: [-6, 0.3, 170], fov: 70 },
  { n: '碎浪特写', en: 'Breaker Close-up', x: -6, z: () => shoreZ(-6) + 30, rule: ['surf', 0.45], look: [14, 0.35, 66], fov: 66 },
  { n: '离岸回望', en: 'Offshore Return', x: 26, z: 205, rule: ['surf', 2.4], look: [-6, 8, -40], fov: 60 },
  { n: '湿沙特写', en: 'Wet Sand Close-up', x: 2, z: () => shoreZ(2) - 3.2, rule: ['ground', 0.3], look: [9, -0.15, 12], fov: 52 },
  { n: '黄金时刻', en: 'Golden Hour', x: -26, z: () => shoreZ(-26) - 6, rule: ['ground', 1.1], look: [34, 1.6, 52], fov: 60, sun: { e: 7, o: 0 } },
];

// ------------------------------------------------------------------ globals
let renderer, post, scene, camera;
let tex = null, waveOut = null, sampler = null;
let simRT = [null, null], simIdx = 0, simMat, simScene, simCam, simQuad;
let objects = {};
let manualLin = false;
let simT = 38, paused = false;
let under = false, underAmt = 0, wetLens = 0;
let uiHidden = false;
let exploring = false;
let presetIdx = -1;
let loaded = false;
const smallWaves = makeSmallWaves();

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const U = {
  uTime: { value: 0 }, uTide: { value: 0 },
  uSunDir: { value: V3(0.4, 0.5, 0.7) }, uSunCol: { value: V3(3, 3, 3) }, uSkyAmb: { value: V3(0.4, 0.5, 0.7) },
  uZenith: { value: V3() }, uHorizon: { value: V3() }, uSunHaze: { value: V3() },
  uCamPos: { value: V3() }, uUnder: { value: 0 }, uClarity: { value: 1 }, uTurb: { value: 0.15 }, uCaustics: { value: 1 },
  uChop: { value: 1 }, uCloudCover: { value: 0.58 }, uPixelAng: { value: 0.001 }, uWind: { value: new THREE.Vector2(0.8, 0.6) },
  uNoise: { value: null },
  uHeight: { value: null }, uHDom: { value: new THREE.Vector4(WORLD.hx0, WORLD.hz0, 1 / (WORLD.hx1 - WORLD.hx0), 1 / (WORLD.hz1 - WORLD.hz0)) },
  uWPhase: { value: null }, uWAmp: { value: null }, uWBrk: { value: null },
  uWDom: { value: new THREE.Vector4(WORLD.wx0, WORLD.wz0, 1 / (WORLD.wx1 - WORLD.wx0), 1 / (WORLD.wz1 - WORLD.wz0)) },
  uWTexel: { value: new THREE.Vector2(1 / NW, 1 / NW) },
  uWStep: { value: new THREE.Vector2((WORLD.wx1 - WORLD.wx0) / NW, (WORLD.wz1 - WORLD.wz0) / NW) },
  uWOmega: { value: V3() }, uWKx: { value: V3() }, uWKyE: { value: V3() }, uWPhi0: { value: V3(0, 1.7, 3.1) },
  uFoam: { value: null }, uFDom: { value: new THREE.Vector4(WORLD.fx0, WORLD.fz0, 1 / (WORLD.fx1 - WORLD.fx0), 1 / (WORLD.fz1 - WORLD.fz0)) },
  uWetSand: { value: 1 }, uDebug: { value: 0 }, uShoreFoamVis: { value: 1 }, uCamXZ: { value: new THREE.Vector2() }, uInvVP: { value: new THREE.Matrix4() },
};

const msg = (t, p) => { $('lmsg').textContent = t; if (p != null) $('lbar').style.width = (p * 100).toFixed(0) + '%'; };
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
const tick = () => new Promise((r) => setTimeout(r, 0));
function toast(t) {
  const el = $('toast'); el.textContent = t; el.classList.add('show');
  clearTimeout(toast.h); toast.h = setTimeout(() => el.classList.remove('show'), 1800);
}

// ------------------------------------------------------------------ lighting from sun height / overcast
function applyLighting() {
  const e = (params.sunElev * Math.PI) / 180;
  const hz = new THREE.Vector2(0.5, 0.866).normalize();
  const sd = U.uSunDir.value.set(hz.x * Math.cos(e), Math.sin(e), hz.y * Math.cos(e)).normalize();
  const warm = smoothstep(34, 4, params.sunElev);
  const over = params.overcast;
  const mixc = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
  const sunI = (0.5 + 0.5 * Math.min(1, Math.sin(e) * 2.4)) * 3.0 * (1 - 0.82 * over);
  const sc = mixc([1.0, 0.95, 0.86], [1.0, 0.57, 0.28], warm).map((v) => v * sunI);
  U.uSunCol.value.set(...sc);
  const lum = 0.78 + 0.35 * Math.sin(e);
  let zen = mixc([0.105, 0.285, 0.66], [0.14, 0.22, 0.45], warm).map((v) => v * lum);
  let hor = mixc([0.62, 0.78, 0.93], [0.95, 0.68, 0.5], warm * 0.85).map((v) => v * (0.92 + 0.1 * Math.sin(e)));
  const gray = [0.5, 0.55, 0.6];
  zen = mixc(zen, gray.map((v) => v * 0.85), over * 0.8);
  hor = mixc(hor, gray.map((v) => v * 1.15), over * 0.85);
  U.uZenith.value.set(...zen); U.uHorizon.value.set(...hor);
  U.uSkyAmb.value.set(...mixc(zen, hor, 0.45).map((v) => v * 0.98));
  U.uSunHaze.value.set(...sc.map((v) => v * 0.1));
  U.uCloudCover.value = lerp(0.6, 0.3, over);
}

// ------------------------------------------------------------------ build scene objects (re-run on quality change)
const noiseTexture = () => {
  const d = new Uint8Array(256 * 256 * 4);
  const r = rng(2024);
  for (let i = 0; i < d.length; i++) d[i] = (r() * 256) | 0;
  const t = new THREE.DataTexture(d, 256, 256, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  return t;
};

function polarGeometry(nr, na) {
  const pos = new Float32Array((nr + 1) * na * 3);
  for (let i = 0; i <= nr; i++) {
    const s = i / nr;
    const r = 0.18 + 7500 * Math.pow(s, 4.4);
    for (let j = 0; j < na; j++) {
      const a = (j / na) * Math.PI * 2;
      const k = (i * na + j) * 3;
      pos[k] = Math.cos(a) * r; pos[k + 1] = 0; pos[k + 2] = Math.sin(a) * r;
    }
  }
  const idx = [];
  for (let i = 0; i < nr; i++) for (let j = 0; j < na; j++) {
    const a = i * na + j, b = i * na + ((j + 1) % na), c = a + na, d = b + na;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  return g;
}

function defsFor(q) {
  const d = { MARCH_STEPS: q.march, CAUSTIC_ITERS: q.iters };
  if (manualLin) d.MANUAL_LIN = '';
  return d;
}

function disposeObjects() {
  for (const k of Object.keys(objects)) {
    const o = objects[k];
    scene.remove(o);
    o.traverse?.((c) => { c.geometry?.dispose?.(); c.material?.dispose?.(); });
  }
  objects = {};
}

function buildObjects() {
  const q = QUALITY[qualityKey];
  const common = commonChunk(smallWaves);
  const defines = defsFor(q);
  disposeObjects();

  const mat = (vert, frag, extra = {}) => new THREE.ShaderMaterial({
    uniforms: U, vertexShader: vert, fragmentShader: frag, defines: { ...defines }, ...extra,
  });

  // sky
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const sky = new THREE.Mesh(sg, mat(skyVert, skyFrag(common), { depthTest: false, depthWrite: false }));
  sky.frustumCulled = false; sky.renderOrder = -10;
  objects.sky = sky;

  // terrain
  const terr = new THREE.Mesh(buildTerrainGeometry(THREE, q.terr), mat(terrainVert, terrainFrag(common)));
  terr.frustumCulled = false; terr.renderOrder = 0;
  objects.terrain = terr;

  // water
  const water = new THREE.Mesh(polarGeometry(q.nr, q.na), mat(waterVert(common), waterFrag(common), {
    transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  }));
  water.frustumCulled = false; water.renderOrder = 2;
  objects.water = water;

  // life & props
  objects.grass = makeGrass(U, common, q.grass);
  objects.props = makeProps(U, common, q.rocks, 10);
  objects.fish = makeFish(U, common, q.fish, [
    { x: -30, z: 62, R: 16, v: 1.0 }, { x: 22, z: 74, R: 20, v: 1.25 }, { x: 4, z: 96, R: 26, v: 1.6 },
    { x: -50, z: 100, R: 18, v: 1.1 }, { x: 46, z: 58, R: 14, v: 0.9 }, { x: -6, z: 44, R: 10, v: 0.8 },
  ]);
  objects.gulls = makeGulls(U, common, isTouch ? 10 : 18);
  objects.motes = makeMotes(U, common, q.motes);
  for (const k of ['sky', 'terrain', 'water', 'grass', 'props', 'fish', 'gulls', 'motes']) {
    if (objects[k].material) objects[k].material.defines = objects[k].material.defines;
    scene.add(objects[k]);
  }
  // shared defines for materials made inside creatures.js
  for (const k of ['grass', 'fish', 'gulls', 'motes']) {
    const m = objects[k].material;
    m.defines = { ...(m.defines || {}), ...defines };
  }
  objects.props.traverse((c) => { if (c.material) c.material.defines = { ...(c.material.defines || {}), ...defines }; });
}

function makeSimTargets() {
  const floatOK = renderer.extensions.has('EXT_color_buffer_float');
  const type = floatOK ? THREE.FloatType : THREE.HalfFloatType;
  const filt = manualLin && floatOK ? THREE.NearestFilter : THREE.LinearFilter;
  for (let i = 0; i < 2; i++) {
    simRT[i] = new THREE.WebGLRenderTarget(1024, 768, {
      type, format: THREE.RGBAFormat, minFilter: filt, magFilter: filt, depthBuffer: false, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping,
    });
  }
  simScene = new THREE.Scene();
  simCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const common = commonChunk(smallWaves);
  simMat = new THREE.ShaderMaterial({
    uniforms: {
      ...U, uPrev: { value: null }, uDt: { value: 0.016 }, uFoamGain: { value: 1 }, uShoreFoam: { value: 1 }, uPersist: { value: 0.5 },
      uDryTime: { value: 70 }, uFoamMax: { value: 0.9 }, uInit: { value: 0 },
    },
    vertexShader: quadVert, fragmentShader: simFrag(common), defines: defsFor(QUALITY[qualityKey]),
    depthTest: false, depthWrite: false,
  });
  simQuad = new THREE.Mesh(g, simMat);
  simQuad.frustumCulled = false;
  simScene.add(simQuad);
  // clear
  for (const rt of simRT) { renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); }
  renderer.setRenderTarget(null);
  U.uFoam.value = simRT[0].texture;
}

function simStep(dt, init = 0) {
  const src = simRT[simIdx], dst = simRT[1 - simIdx];
  const u = simMat.uniforms;
  u.uPrev.value = src.texture;
  u.uDt.value = dt;
  u.uFoamGain.value = params.breaker;
  u.uShoreFoam.value = params.shoreFoam;
  u.uPersist.value = params.persist;
  u.uInit.value = init;
  renderer.setRenderTarget(dst);
  renderer.render(simScene, simCam);
  renderer.setRenderTarget(null);
  simIdx = 1 - simIdx;
  U.uFoam.value = simRT[simIdx].texture;
}

// ------------------------------------------------------------------ wave (re)solve
let solveTimer = 0;
function resolveWaves() {
  waveOut = solveWaves(tex, { tide: params.tide, height: params.waveHeight, dir: params.waveDir, swash: params.swash });
  U.uWOmega.value.set(...waveOut.omega);
  U.uWKx.value.set(...waveOut.kx);
  U.uWKyE.value.set(...waveOut.kyE);
  sampler.setParams(waveOut, params.chop, params.tide);
}
function scheduleSolve() {
  clearTimeout(solveTimer);
  solveTimer = setTimeout(resolveWaves, 90);
}

// ------------------------------------------------------------------ camera rig
const cam = {
  pos: V3(-42, 4, -16), yaw: 0.6, pitch: -0.1, fov: 58,
  from: null, to: null, t: 1, dur: 1.8, rule: null,
};
const vel = V3();
const keys = new Set();
const joy = { x: 0, y: 0 };
let vertInput = 0;

function surfaceAt(x, z) { return sampler.height(x, z, simT); }
function ruleY(rule, x, z) {
  const [k, v] = rule;
  if (k === 'abs') return v;
  if (k === 'ground') return Math.max(groundHeight(x, z), params.tide - 0.1) + v;
  if (k === 'surf') return surfaceAt(x, z) + v;
  if (k === 'under') return Math.max(surfaceAt(x, z) - v, groundHeight(x, z) + 0.3);
  return v;
}
function lookAngles(from, to) {
  const dx = to[0] - from.x, dy = to[1] - from.y, dz = to[2] - from.z;
  return { yaw: Math.atan2(dx, dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
}
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
const ease = (t) => t * t * (3 - 2 * t);

function goPreset(i, instant = false) {
  const P = PRESETS[i];
  presetIdx = i;
  setExplore(false);
  const x = P.x, z = typeof P.z === 'function' ? P.z() : P.z;
  const y = ruleY(P.rule, x, z);
  const a = lookAngles(V3(x, y, z), P.look);
  if (P.sun) { params.sunElev = P.sun.e; params.overcast = P.sun.o; syncUI(); applyLighting(); }
  cam.from = { x: cam.pos.x, y: cam.pos.y, z: cam.pos.z, yaw: cam.yaw, pitch: cam.pitch, fov: cam.fov };
  cam.to = { x, z, yaw: a.yaw, pitch: a.pitch, fov: P.fov };
  cam.rule = P.rule;
  cam.t = instant ? 1 : 0;
  cam.dur = instant ? 0.001 : 1.9;
  document.querySelectorAll('#presets button').forEach((b, k) => b.classList.toggle('on', k === i));
}

function updateCamera(dt) {
  if (exploring) {
    updateExplore(dt);
  } else if (cam.to) {
    cam.t = Math.min(1, cam.t + dt / cam.dur);
    const e = ease(cam.t);
    const f = cam.from, t = cam.to;
    cam.pos.x = lerp(f.x, t.x, e); cam.pos.z = lerp(f.z, t.z, e);
    const yEnd = ruleY(cam.rule, cam.pos.x, cam.pos.z);
    // before arrival blend the start height into the rule height; afterwards follow the rule (buoyancy)
    cam.pos.y = cam.t < 1 ? lerp(f.y, yEnd, e) : yEnd;
    cam.yaw = f.yaw + angDiff(f.yaw, t.yaw) * e;
    cam.pitch = lerp(f.pitch, t.pitch, e);
    cam.fov = lerp(f.fov, t.fov, e);
    if (cam.t >= 1) { cam.yaw = t.yaw + (cam.yawOff || 0); cam.pitch = t.pitch + (cam.pitchOff || 0); }
  }
  // never dive into the sea bed
  const gh = groundHeight(cam.pos.x, cam.pos.z);
  cam.pos.y = Math.max(cam.pos.y, gh + 0.22);
  cam.pitch = clamp(cam.pitch, -1.5, 1.5);
}

function updateExplore(dt) {
  const gh = groundHeight(cam.pos.x, cam.pos.z);
  const surf = surfaceAt(cam.pos.x, cam.pos.z);
  const depth = surf - gh;
  const swimming = depth > 1.3;
  const sprint = keys.has('shift') ? 2.0 : 1.0;
  let fx = 0, fz = 0;
  if (keys.has('w') || keys.has('arrowup')) fz += 1;
  if (keys.has('s') || keys.has('arrowdown')) fz -= 1;
  if (keys.has('d') || keys.has('arrowright')) fx += 1;
  if (keys.has('a') || keys.has('arrowleft')) fx -= 1;
  fx += joy.x; fz += -joy.y;
  const len = Math.hypot(fx, fz);
  if (len > 1) { fx /= len; fz /= len; }
  const speedBase = swimming ? 2.4 : depth > 0.3 ? 2.0 : 3.4;
  const sp = speedBase * sprint;
  const sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw);
  const tvx = (sy * fz + cy * fx) * sp, tvz = (cy * fz - sy * fx) * sp;
  const k = 1 - Math.exp(-dt * (swimming ? 2.2 : 6.0));    // water gives inertia
  vel.x += (tvx - vel.x) * k; vel.z += (tvz - vel.z) * k;
  cam.pos.x = clamp(cam.pos.x + vel.x * dt, -230, 230);
  cam.pos.z = clamp(cam.pos.z + vel.z * dt, -110, 280);
  const gh2 = groundHeight(cam.pos.x, cam.pos.z);
  const surf2 = surfaceAt(cam.pos.x, cam.pos.z);
  const depth2 = surf2 - gh2;
  let vv = (keys.has(' ') || keys.has('space') ? 1 : 0) - (keys.has('c') ? 1 : 0) + vertInput;
  if (depth2 > 1.3) {
    let ty = cam.pos.y;
    if (vv !== 0) { ty += vv * 1.4 * dt; cam.diving = true; }
    else if (cam.pos.y < surf2 - 0.1) ty += 0.45 * dt;   // gentle buoyancy
    else { ty = lerp(ty, surf2 + 0.16, 1 - Math.exp(-dt * 6)); }
    cam.pos.y = clamp(ty, gh2 + 0.45, surf2 + 0.3);
  } else {
    const wantEye = gh2 + 1.7 - clamp(depth2, 0, 1.2) * 0.35;
    cam.pos.y = lerp(cam.pos.y, Math.max(wantEye, surf2 + 0.2), 1 - Math.exp(-dt * 8));
  }
}

// ------------------------------------------------------------------ input
let dragging = false, lastX = 0, lastY = 0;
function bindInput(canvas) {
  canvas.addEventListener('pointerdown', (e) => {
    if (e.target !== canvas) return;
    dragging = true; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture(e.pointerId); canvas.focus();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY;
    const s = 0.0036 * (cam.fov / 60);
    cam.yaw -= dx * s; cam.pitch -= dy * s;
    if (!exploring) { cam.yawOff = (cam.yawOff || 0) - dx * s; cam.pitchOff = (cam.pitchOff || 0) - dy * s; }
  });
  const up = (e) => { dragging = false; try { canvas.releasePointerCapture(e.pointerId); } catch (_) { /* noop */ } };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    cam.fov = clamp(cam.fov + e.deltaY * 0.03, 28, 90);
    if (cam.to) cam.to.fov = cam.fov;
  }, { passive: false });
  addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    const k = e.key.toLowerCase();
    if (k === 'escape') { if (uiHidden) setUIHidden(false); else { $('about').classList.remove('open'); $('panel').classList.remove('open'); } return; }
    if (k === ' ') { e.preventDefault(); if (exploring) keys.add(' '); else togglePause(); return; }
    if (/^[0-9]$/.test(k)) { goPreset(k === '0' ? 9 : +k - 1); return; }
    if (k === 'e') { toggleExplore(); return; }
    if (k === 'h') { setUIHidden(!uiHidden); return; }
    if (k === 'f') { toggleFull(); return; }
    if (k === 'p') { togglePause(); return; }
    if (k === 'r') { resetView(); return; }
    keys.add(k);
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
  });
  addEventListener('keyup', (e) => { keys.delete(e.key.toLowerCase()); if (e.key === ' ') keys.delete(' '); });
  addEventListener('blur', () => keys.clear());
  // joystick
  const jz = $('joy'), knob = jz.querySelector('i');
  let jid = null;
  const jmove = (e) => {
    const r = jz.getBoundingClientRect();
    let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    joy.x = x; joy.y = y; knob.style.transform = `translate(${x * 36}px,${y * 36}px)`;
  };
  jz.addEventListener('pointerdown', (e) => { jid = e.pointerId; jz.setPointerCapture(jid); jmove(e); });
  jz.addEventListener('pointermove', (e) => { if (e.pointerId === jid) jmove(e); });
  const jend = () => { jid = null; joy.x = joy.y = 0; knob.style.transform = ''; };
  jz.addEventListener('pointerup', jend); jz.addEventListener('pointercancel', jend);
  const hold = (id, v) => {
    const b = $(id);
    b.addEventListener('pointerdown', (e) => { vertInput += v; b.setPointerCapture(e.pointerId); b._h = true; });
    const end = () => { if (b._h) { vertInput -= v; b._h = false; } };
    b.addEventListener('pointerup', end); b.addEventListener('pointercancel', end);
  };
  hold('bUp', 1); hold('bDown', -1);
  addEventListener('touchstart', (e) => { if (uiHidden && e.touches.length >= 3) setUIHidden(false); }, { passive: true });
}

// ------------------------------------------------------------------ UI
function buildUI() {
  const pb = $('presets');
  PRESETS.forEach((p, i) => {
    const b = document.createElement('button');
    b.innerHTML = `<b>${String(i + 1).padStart(2, '0')}</b><span>${p.n}</span>`;
    b.title = p.en; b.addEventListener('click', () => goPreset(i));
    pb.appendChild(b);
  });
  const panel = $('panel');
  let html = '';
  for (const s of SLIDERS) {
    if (s[1] === null) { html += `<h2>${s[0]}</h2>`; continue; }
    const [k, label, mn, mx, st] = s;
    html += `<div class="row"><label for="s_${k}">${label}</label><output id="o_${k}"></output><input id="s_${k}" type="range" min="${mn}" max="${mx}" step="${st}"></div>`;
  }
  html += `<h2>时间预设</h2><div class="chips" id="times">${TIMES.map((t, i) => `<button class="chip" data-i="${i}">${t.name}</button>`).join('')}</div>`;
  html += `<h2>画质</h2><select id="qsel"><option value="auto">自动</option>${Object.entries(QUALITY).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}</select>`;
  html += `<div class="btnrow"><button class="chip" id="bReset">重置设置</button></div>`;
  panel.innerHTML = html;
  for (const s of SLIDERS) {
    if (s[1] === null) continue;
    const k = s[0], el = $('s_' + k);
    el.addEventListener('input', () => {
      params[k] = +el.value; $('o_' + k).textContent = s[5](params[k]);
      if (['waveHeight', 'waveDir', 'tide', 'swash'].includes(k)) scheduleSolve();
      if (k === 'sunElev' || k === 'overcast') applyLighting();
    });
  }
  panel.querySelectorAll('#times .chip').forEach((b) => b.addEventListener('click', () => {
    const t = TIMES[+b.dataset.i];
    params.sunElev = t.e; params.overcast = t.o; syncUI(); applyLighting();
  }));
  $('qsel').addEventListener('change', (e) => {
    if (e.target.value === 'auto') { autoQuality = true; } else { autoQuality = false; setQuality(e.target.value); }
  });
  $('bReset').addEventListener('click', () => { Object.assign(params, DEFAULTS); syncUI(); applyLighting(); resolveWaves(); toast('已恢复默认设置'); });
  $('bSet').addEventListener('click', () => { $('panel').classList.toggle('open'); $('bSet').classList.toggle('on'); });
  $('bInfo').addEventListener('click', () => $('about').classList.add('open'));
  $('aboutClose').addEventListener('click', () => $('about').classList.remove('open'));
  $('about').addEventListener('click', (e) => { if (e.target === $('about')) $('about').classList.remove('open'); });
  $('bFull').addEventListener('click', toggleFull);
  $('bScenery').addEventListener('click', () => setUIHidden(true));
  $('bShot').addEventListener('click', () => { shotPending = true; });
  $('bExplore').addEventListener('click', toggleExplore);
  $('bPause').addEventListener('click', togglePause);
  syncUI();
}
function syncUI() {
  for (const s of SLIDERS) {
    if (s[1] === null) continue;
    const k = s[0];
    $('s_' + k).value = params[k]; $('o_' + k).textContent = s[5](params[k]);
  }
}
function toggleFull() {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen)?.call(document.documentElement);
}
let savedFocus = null;
function setUIHidden(h) {
  if (h === uiHidden) return;
  uiHidden = h;
  if (h) { savedFocus = document.activeElement; document.activeElement?.blur?.(); toast(isTouch ? '三指轻点恢复界面' : '按 Esc 恢复界面'); }
  document.body.classList.toggle('ui-hidden', h);
  if (!h) { (savedFocus && savedFocus.focus) ? savedFocus.focus({ preventScroll: true }) : $('c').focus(); }
}
function togglePause() { paused = !paused; $('bPause').classList.toggle('on', paused); $('bPause').querySelector('span').textContent = paused ? '继续' : '暂停'; }
function setExplore(on) {
  if (on === exploring) return;
  exploring = on;
  document.body.classList.toggle('explore', on);
  $('bExplore').classList.toggle('on', on);
  if (on) { cam.yawOff = cam.pitchOff = 0; vel.set(0, 0, 0); document.querySelectorAll('#presets button').forEach((b) => b.classList.remove('on')); }
}
function toggleExplore() { setExplore(!exploring); if (exploring) toast('探索模式：WASD 移动，拖动环视'); }
function resetView() { cam.yawOff = cam.pitchOff = 0; goPreset(presetIdx < 0 ? 0 : presetIdx); }

// ------------------------------------------------------------------ quality / size
function setQuality(k) {
  if (k === qualityKey && objects.water) return;
  qualityKey = k;
  $('qlabel').textContent = QUALITY[k].label;
  if (renderer) { buildObjects(); resize(); }
}
function resize() {
  const q = QUALITY[qualityKey];
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const scale = q.pr >= 1 ? Math.min(q.pr, dpr) : q.pr;
  const w = Math.max(2, Math.floor(innerWidth * scale));
  const h = Math.max(2, Math.floor(innerHeight * scale));
  renderer.setSize(w, h, false);
  post.resize(w, h, q.msaa);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}

// ------------------------------------------------------------------ main loop
let last = 0, shotPending = false, fpsAcc = 0, fpsN = 0, fpsShown = 0, warmT = 0, lowStreak = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (!loaded) return;
  const rawDt = Math.min((now - last) / 1000 || 0.016, 0.1);
  last = now;
  const dt = qs.get('fixed') ? 1 / 30 : rawDt;
  if (!paused) simT += dt * params.timeSpeed;
  renderFrame(dt, rawDt);
  // fps + automatic quality
  fpsAcc += rawDt; fpsN++;
  if (fpsAcc > 0.5) {
    fpsShown = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0;
    $('fps').textContent = ' · ' + fpsShown.toFixed(0) + ' fps';
    warmT += 0.5;
    if (autoQuality && warmT > 4) {
      const order = ['low', 'medium', 'high', 'ultra'];
      const i = order.indexOf(qualityKey);
      if (fpsShown < 26 && i > 0) { lowStreak++; if (lowStreak >= 3) { lowStreak = 0; setQuality(order[i - 1]); $('qsel').value = 'auto'; toast('已自动降低画质以保持流畅'); warmT = 0; } }
      else lowStreak = 0;
    }
  }
}

function renderFrame(dt, rawDt) {
  updateCamera(dt);
  camera.position.copy(cam.pos);
  const cp = Math.cos(cam.pitch);
  camera.lookAt(cam.pos.x + Math.sin(cam.yaw) * cp, cam.pos.y + Math.sin(cam.pitch), cam.pos.z + Math.cos(cam.yaw) * cp);
  camera.fov = cam.fov; camera.updateProjectionMatrix();
  camera.updateMatrixWorld();

  // under-water state (hysteresis) and lens wetness
  const surf = surfaceAt(cam.pos.x, cam.pos.z);
  const rel = cam.pos.y - surf;
  const gh = groundHeight(cam.pos.x, cam.pos.z);
  const wasUnder = under;
  if (!under && rel < -0.01 && surf - gh > 0.05) under = true;
  else if (under && (rel > 0.03 || surf - gh < 0.0)) under = false;
  underAmt += ((under ? 1 : 0) - underAmt) * Math.min(1, rawDt * 10);
  if (under) wetLens = Math.max(0, wetLens - rawDt / 1.5);
  else if (rel < 0.5 && surf - gh > 0.2) wetLens = Math.max(wetLens, 0.25 * (1 - rel / 0.5));
  if (!under) wetLens = Math.max(0, wetLens - rawDt / 10);
  if (wasUnder && !under) wetLens = 1;

  U.uTime.value = simT;
  U.uTide.value = params.tide;
  U.uCamPos.value.copy(cam.pos);
  U.uCamXZ.value.set(cam.pos.x, cam.pos.z);
  U.uUnder.value = under ? 1 : 0;
  U.uClarity.value = params.clarity; U.uTurb.value = params.turb; U.uCaustics.value = params.caustics; U.uChop.value = params.chop;
  U.uWetSand.value = params.wetSand;
  U.uPixelAng.value = (2 * Math.tan((cam.fov * Math.PI) / 360)) / renderer.domElement.height;
  const vp = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  U.uInvVP.value.copy(vp).invert();
  sampler.setParams(waveOut, params.chop, params.tide);

  if (!paused) simStep(Math.min(dt * params.timeSpeed, 0.08));

  renderer.setRenderTarget(post.sceneRT);
  renderer.setClearColor(0x000000, 1);
  renderer.clear();
  renderer.render(scene, camera);
  post.run({
    exposure: 0.66 * params.exposure, bloom: 0.09, threshold: 2.2, under: underAmt, wetLens,
    time: simT, vignette: 0.55,
  });
  if (shotPending) {
    shotPending = false;
    renderer.domElement.toBlob((b) => {
      if (!b) return;
      const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'coastal-shallows.png'; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    });
  }
}

// ------------------------------------------------------------------ boot
async function boot() {
  const canvas = $('c');
  const gl2 = canvas.getContext('webgl2', { antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false, preserveDrawingBuffer: !!qs.get('shot') });
  if (!gl2) throw new Error('当前浏览器不支持 WebGL2，无法运行此页面。');
  renderer = new THREE.WebGLRenderer({ canvas, context: gl2, antialias: false });
  renderer.autoClear = true;
  renderer.setPixelRatio(1);
  if (!renderer.extensions.has('EXT_color_buffer_float') && !renderer.extensions.has('EXT_color_buffer_half_float')) throw new Error('显卡不支持浮点渲染目标。');
  manualLin = !renderer.extensions.has('OES_texture_float_linear');
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); toast('图形上下文丢失，请刷新页面'); });
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(60, 1, 0.05, 14000);
  post = new Post(renderer);

  msg('正在生成海底与海岸地形…', 0.05);
  await tick();
  U.uNoise.value = noiseTexture();
  const filt = manualLin ? THREE.NearestFilter : THREE.LinearFilter;
  const hTex = await buildHeightTexture(THREE, 1024, (p) => msg('正在生成海底与海岸地形…', 0.05 + 0.4 * p));
  hTex.minFilter = hTex.magFilter = filt; hTex.needsUpdate = true;
  U.uHeight.value = hTex;

  msg('正在求解浅水波场…', 0.5);
  await tick();
  tex = makeWaveTextures(THREE);
  for (const t of [tex.phase, tex.amp, tex.brk]) { t.minFilter = t.magFilter = filt; }
  U.uWPhase.value = tex.phase; U.uWAmp.value = tex.amp; U.uWBrk.value = tex.brk;
  sampler = new SurfaceSampler(tex, smallWaves);
  resolveWaves();

  msg('正在编译着色器…', 0.65);
  await tick();
  applyLighting();
  $('qlabel').textContent = QUALITY[qualityKey].label;
  makeSimTargets();
  buildObjects();
  buildUI();
  bindInput(canvas);
  resize();
  addEventListener('resize', resize);

  msg('正在预热浪花与湿沙历史…', 0.75);
  await nextFrame();
  const startPreset = Math.max(0, Math.min(9, (+qs.get('preset') || 1) - 1));
  goPreset(startPreset, true);
  cam.pos.set(cam.to.x, ruleY(cam.rule, cam.to.x, cam.to.z), cam.to.z);
  cam.yaw = cam.to.yaw; cam.pitch = cam.to.pitch; cam.fov = cam.to.fov;
  if (qs.get('t')) simT = +qs.get('t');
  const warm = qs.get('warm') != null ? +qs.get('warm') : 80;
  const dtw = 0.22;
  for (let i = 0; i < warm; i++) {
    U.uTime.value = simT - (warm - i) * dtw;
    simStep(dtw, i === 0 ? 1 : 0);
    if (i % 10 === 9) { msg('正在预热浪花与湿沙历史…', 0.75 + 0.2 * (i / warm)); await nextFrame(); }
  }
  loaded = true;
  renderFrame(0.016, 0.016);
  last = performance.now();
  requestAnimationFrame(frame);
  await nextFrame();
  $('loader').classList.add('done');
  setTimeout(() => $('loader').remove(), 900);
  // debugging / verification hooks
  window.__coastal = {
    params, U, goPreset, setExplore, setUIHidden, simTime: () => simT, setTime: (t) => { simT = t; }, renderOnce: (dt = 1 / 30) => { simT += dt; renderFrame(dt, dt); },
    foamStats: () => { const rt = simRT[simIdx]; const b = new Float32Array(1024 * 768 * 4); renderer.readRenderTargetPixels(rt, 0, 0, 1024, 768, b); let f = 0, w = 0, fm = 0; const rows = []; for (let j = 0; j < 768; j += 64) { let rf = 0, rw = 0; for (let i = 0; i < 1024; i++) { rf += b[(j * 1024 + i) * 4]; rw += b[(j * 1024 + i) * 4 + 1]; } rows.push([j, +(rf / 1024).toFixed(3), +(rw / 1024).toFixed(3)]); } for (let k = 0; k < b.length; k += 4) { f += b[k]; w += b[k + 1]; fm = Math.max(fm, b[k]); } return { foam: f / (b.length / 4), wet: w / (b.length / 4), foamMax: fm, rows }; },
    cam, resolveWaves, setQuality, camera, renderer, objects, get under() { return under; }, applyLighting, syncUI, surfaceAt, step: (n, dt = 1 / 30) => { for (let i = 0; i < n; i++) { simT += dt; renderFrame(dt, dt); } },
  };
}

boot().catch((e) => {
  console.error(e);
  const l = $('loader');
  l.classList.add('err');
  $('lmsg').textContent = '启动失败：' + (e && e.message ? e.message : e);
});
