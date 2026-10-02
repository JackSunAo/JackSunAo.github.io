// Shared world definition: one analytic ground-height function drives the terrain mesh,
// the height texture (used by water ray-marching / wet sand), the wave solver and the camera.
// Convention: +z = open sea, -z = land, x runs along the beach. Still-water level y = 0 (+ tide).
import { clamp, smoothstep, vnoise, fbm } from './noise.js';

export const WORLD = {
  // height texture domain
  hx0: -300, hx1: 300, hz0: -150, hz1: 330,
  // wave solver domain
  wx0: -180, wx1: 180, wz0: -60, wz1: 300,
  // foam / wetness simulation domain
  fx0: -170, fx1: 170, fz0: -75, fz1: 185,
};

const sq = (x) => x * x;
const smax = (a, b, k) => 0.5 * (a + b + Math.sqrt((a - b) * (a - b) + k * k));

// gently curved bay with rhythmic beach cusps
export function shoreZ(x) {
  return -x * x / 1500 + 2.2 * Math.sin(x / 31 + 0.7) + 1.0 * Math.sin(x / 13 + 2.0) + 1.5 * (vnoise(x / 22, 7.7) - 0.5);
}

// returns rockiness / vegetation masks too when `out` is passed
export function groundHeight(x, z, out) {
  const zs = shoreZ(x);
  const u = z - zs;
  let h;
  if (u >= 0) {
    // seaward: gentle slope, sand bars, soft undulations
    const D = 0.026 * u + 0.0002 * u * u;
    const bm = 0.72 + 0.28 * Math.sin(x / 26 + 1.3) + 0.35 * (vnoise(x / 15, 3.1) - 0.5);
    const bar1 = 0.82 * bm * Math.exp(-sq((u - 46 - 7 * Math.sin(x / 40 + 0.4)) / 9.5));
    const bar2 = 0.55 * (0.8 + 0.4 * Math.sin(x / 33)) * Math.exp(-sq((u - 96) / 15));
    const swell = 0.09 * (fbm(x / 16, z / 16, 3) - 0.5) * Math.min(1, u / 12 + 0.3);
    h = -D + bar1 + bar2 + swell;
    // ease into the foreshore near u = 0
    const e = smoothstep(0, 5, u);
    h = h * (0.35 + 0.65 * e);
  } else {
    const w = -u;
    const berm = 1.05 * (1 - Math.exp(-0.06 * w / 1.05));
    const dune = 3.4 * smoothstep(34, 100, w) * (0.5 + 1.0 * fbm(x / 24 + 4, z / 24, 4));
    const hills = 0.05 * Math.max(w - 120, 0) + 9 * smoothstep(160, 520, w) * fbm(x / 80, w / 80 + 9, 4);
    const sandy = 0.07 * (vnoise(x / 5, z / 5) - 0.5);
    h = berm + dune + hills + sandy;
  }
  // rocky headlands closing the bay at both ends
  const ax = smoothstep(96, 140, Math.abs(x));
  const bz = 1 - smoothstep(55, 175, z);
  const rockN = fbm(x / 17 + 11, z / 17, 4);
  const rock = -40 * (1 - ax) * (1 - ax) + ax * (9.5 * bz - 12 * (1 - bz)) + ax * bz * 4.2 * (rockN - 0.5);
  h = smax(h, rock, 1.4);
  if (out) {
    out.u = u;
    out.rock = clamp(ax * bz * 1.5, 0, 1);
    out.veg = u < -30 ? smoothstep(-34, -62, u) * smoothstep(0.38, 0.62, fbm(x / 13 + 31, z / 13, 3)) * (1 - out.rock) : 0;
  }
  return h;
}

export function groundNormal(x, z, e = 0.35) {
  const hx = (groundHeight(x + e, z) - groundHeight(x - e, z)) / (2 * e);
  const hz = (groundHeight(x, z + e) - groundHeight(x, z - e)) / (2 * e);
  return { hx, hz };
}

// build a monotone coordinate array with fine spacing in [a, b] and growth outside
function axis(min, a, b, max, fine, grow) {
  const mid = [];
  for (let v = a; v <= b + 1e-6; v += fine) mid.push(v);
  const lo = [];
  let s = fine, v = a;
  while (v > min) { s *= grow; v -= s; lo.push(Math.max(v, min)); }
  const hi = [];
  s = fine; v = b;
  while (v < max) { s *= grow; v += s; hi.push(Math.min(v, max)); }
  return [...lo.reverse(), ...mid, ...hi];
}

export function buildTerrainGeometry(THREE, spacing = 0.8) {
  const xs = axis(-900, -165, 165, 900, spacing, 1.045);
  const zs = axis(-820, -70, 200, 345, spacing, 1.04);
  const nx = xs.length, nz = zs.length;
  const pos = new Float32Array(nx * nz * 3);
  const nor = new Float32Array(nx * nz * 3);
  const info = new Float32Array(nx * nz * 3);
  const tmp = {};
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const x = xs[i], z = zs[j];
      const y = groundHeight(x, z, tmp);
      pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
      const n = groundNormal(x, z, Math.max(0.3, spacing * 0.5));
      const l = Math.hypot(n.hx, 1, n.hz);
      nor[k * 3] = -n.hx / l; nor[k * 3 + 1] = 1 / l; nor[k * 3 + 2] = -n.hz / l;
      info[k * 3] = tmp.u; info[k * 3 + 1] = tmp.rock; info[k * 3 + 2] = tmp.veg;
    }
  }
  const idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
  let p = 0;
  for (let j = 0; j < nz - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
      idx[p++] = a; idx[p++] = c; idx[p++] = b;
      idx[p++] = b; idx[p++] = c; idx[p++] = d;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('aInfo', new THREE.BufferAttribute(info, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, -200), 2000);
  return g;
}

// RGBA32F: height, d/dx, d/dz, beach coordinate u. Built in async chunks so the loader can paint.
export async function buildHeightTexture(THREE, size = 1024, onProgress) {
  const { hx0, hx1, hz0, hz1 } = WORLD;
  const data = new Float32Array(size * size * 4);
  const tmp = {};
  for (let j = 0; j < size; j++) {
    const z = hz0 + (j + 0.5) / size * (hz1 - hz0);
    for (let i = 0; i < size; i++) {
      const x = hx0 + (i + 0.5) / size * (hx1 - hx0);
      const k = (j * size + i) * 4;
      const h = groundHeight(x, z, tmp);
      const e = 0.4;
      data[k] = h;
      data[k + 1] = (groundHeight(x + e, z) - groundHeight(x - e, z)) / (2 * e);
      data[k + 2] = (groundHeight(x, z + e) - groundHeight(x, z - e)) / (2 * e);
      data[k + 3] = tmp.u;
    }
    if (j % 64 === 63 && onProgress) { onProgress(j / size); await new Promise((r) => setTimeout(r, 0)); }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.FloatType);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}
