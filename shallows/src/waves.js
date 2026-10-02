// CPU wave solver (runs at start-up and when tide / wave settings change; never per frame).
// For each of three swell trains it marches from deep water to the shore along every x column and stores
//   phase  Φ  (integral of the depth dependent wavenumber → crest lines bend with the sea bed),
//   amplitude A (Green's-law shoaling × refraction, depth-limited breaking, swash floor),
//   breaker state B (turbulence memory behind the breaking point).
// The GPU then evaluates η = Σ A·profile(Φ − ωt) analytically, so water, foam, wet sand and caustics all
// share the same wave field.
import { WORLD, groundHeight } from './world.js';
import { clamp, smoothstep, vnoise } from './noise.js';

export const NW = 512;
const G = 9.81;

export const TRAINS = [
  { T: 7.8, off: 6, a0: 0.42, phi: 0.0 },
  { T: 5.6, off: -21, a0: 0.23, phi: 1.7 },
  { T: 10.6, off: 17, a0: 0.17, phi: 3.1 },
];

function solveK(w, d) {
  let k = Math.max((w * w) / G, w / Math.sqrt(G * d));
  for (let i = 0; i < 5; i++) {
    const t = Math.tanh(k * d);
    const f = G * k * t - w * w;
    const fp = G * (t + k * d * (1 - t * t));
    k = Math.max(k - f / fp, 1e-4);
  }
  return k;
}

let groundGrid = null;
function ensureGround() {
  if (groundGrid) return;
  const { wx0, wx1, wz0, wz1 } = WORLD;
  groundGrid = new Float32Array(NW * NW);
  for (let j = 0; j < NW; j++) {
    const z = wz0 + ((j + 0.5) / NW) * (wz1 - wz0);
    for (let i = 0; i < NW; i++) {
      const x = wx0 + ((i + 0.5) / NW) * (wx1 - wx0);
      groundGrid[j * NW + i] = groundHeight(x, z);
    }
  }
}

export function makeWaveTextures(THREE) {
  const mk = () => {
    const t = new THREE.DataTexture(new Float32Array(NW * NW * 4), NW, NW, THREE.RGBAFormat, THREE.FloatType);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  };
  return { phase: mk(), amp: mk(), brk: mk() };
}

// params: { tide, height, dir (deg), swash }
export function solveWaves(tex, p) {
  ensureGround();
  const { wx0, wx1, wz0, wz1 } = WORLD;
  const dz = (wz1 - wz0) / NW;
  const out = { omega: [0, 0, 0], kx: [0, 0, 0], kyE: [0, 0, 0] };
  const P = tex.phase.image.data, A = tex.amp.image.data, B = tex.brk.image.data;

  TRAINS.forEach((tr, ti) => {
    const w = (2 * Math.PI) / tr.T;
    const th0 = ((tr.off + p.dir) * Math.PI) / 180;
    const k0 = solveK(w, 400);
    const ks = k0 * Math.sin(th0);
    const cos0 = Math.cos(th0);
    const cg0 = 0.5 * (w / k0);
    out.omega[ti] = w;
    out.kx[ti] = ks;
    const Amp0 = tr.a0 * p.height;
    const asw = p.swash * 0.5 * Amp0;

    for (let i = 0; i < NW; i++) {
      const x = wx0 + ((i + 0.5) / NW) * (wx1 - wx0);
      const gOn = 0.8 * (1 + 0.3 * (vnoise(x / 17 + ti * 5.3, ti * 7.1) - 0.5));
      let phi = ks * x, amp = Amp0, bst = 0, cgPrev = cg0, cosPrev = cos0, kyPrev = -1;
      for (let j = NW - 1; j >= 0; j--) {
        const gh = groundGrid[j * NW + i];
        const dd = p.tide - gh;               // still-water depth (negative on land)
        const d = Math.max(dd, 0.12);
        const k = solveK(w, d);
        const ky = Math.sqrt(Math.max(k * k - ks * ks, 0.0144 * k * k));
        const cg = 0.5 * (w / k) * (1 + (2 * k * d) / Math.sinh(2 * k * d));
        const cosT = ky / k;
        if (kyPrev >= 0) phi += 0.5 * (ky + kyPrev) * dz;
        kyPrev = ky;
        // Green's law + refraction (energy flux conservation along the ray tube)
        amp *= Math.sqrt(cgPrev / cg) * Math.sqrt(cosPrev / cosT);
        cgPrev = cg; cosPrev = cosT;
        amp = Math.min(amp, 2.5);
        // depth limited breaking
        const lim = 0.5 * gOn * d;
        const sat = 0.5 * 0.55 * d;
        let bNew;
        if (amp > lim) { amp = Math.min(amp, Math.max(sat, 0.0)); bNew = 1; }
        else bNew = smoothstep(0.72, 1.0, amp / lim);
        if (amp > sat && bst > 0.2) amp = Math.max(sat, amp * 0.985); // keep decaying inside the surf zone
        bst = Math.max(bNew, bst * 0.94);
        let a = amp;
        if (d < 0.7) a = Math.max(a, asw * smoothstep(0.7, 0.18, d));
        if (dd < 0) a = Math.max(amp, asw) * Math.exp(dd / (0.5 * p.swash + 0.15));
        const o = (j * NW + i) * 4;
        P[o + ti] = phi; P[o + 3] = d;
        A[o + ti] = a; A[o + 3] = 0;
        B[o + ti] = bst; B[o + 3] = 0;
      }
      if (i === NW >> 1) out.kyE[ti] = Math.sqrt(Math.max(k0 * k0 - ks * ks, 0.01));
    }
  });
  tex.phase.needsUpdate = tex.amp.needsUpdate = tex.brk.needsUpdate = true;
  return out;
}

// ---- CPU mirror of the GPU surface height (used for camera buoyancy / under-water test) ----
export class SurfaceSampler {
  constructor(tex, smallWaves) {
    this.P = tex.phase.image.data; this.A = tex.amp.image.data;
    this.sw = smallWaves; this.u = null; this.chop = 1; this.tide = 0;
  }
  setParams(u, chop, tide) { this.u = u; this.chop = chop; this.tide = tide; }
  _fetch(arr, qx, qz, ch) {
    const fx = qx * NW - 0.5, fz = qz * NW - 0.5;
    const i0 = Math.floor(fx), j0 = Math.floor(fz), tx = fx - i0, tz = fz - j0;
    const c = (i, j) => arr[(clamp(j, 0, NW - 1) * NW + clamp(i, 0, NW - 1)) * 4 + ch];
    return (c(i0, j0) * (1 - tx) + c(i0 + 1, j0) * tx) * (1 - tz) + (c(i0, j0 + 1) * (1 - tx) + c(i0 + 1, j0 + 1) * tx) * tz;
  }
  height(x, z, t) {
    const { wx0, wx1, wz0, wz1 } = WORLD;
    const sx = wx1 - wx0, sz = wz1 - wz0;
    const e = 0.5 / NW;
    let qx = (x - wx0) / sx, qz = (z - wz0) / sz;
    const qcx = clamp(qx, e, 1 - e), qcz = clamp(qz, e, 1 - e);
    const ex = x - (wx0 + qcx * sx), ez = z - (wz0 + qcz * sz);
    const d = Math.max(this._fetch(this.P, qcx, qcz, 3), 0.1);
    let eta = 0;
    for (let i = 0; i < 3; i++) {
      const phi = this._fetch(this.P, qcx, qcz, i) + this.u.kx[i] * ex - this.u.kyE[i] * ez - this.u.omega[i] * t + TRAINS[i].phi;
      const a = this._fetch(this.A, qcx, qcz, i);
      const s = clamp((0.9 * a) / (0.5 * d + 0.1), 0, 0.85);
      const tp = phi + s * Math.sin(phi);
      eta += a * (Math.cos(tp) + 0.25 * s * Math.cos(2 * tp));
    }
    // chop fades out where there is hardly any water (matches the shader's smoothstep)
    let h = 0;
    for (const w of this.sw) {
      h += w.a * this.chop * Math.sin(w.k * (w.dx * x + w.dz * z) - w.w * t + w.ph);
    }
    return this.tide + eta + h;
  }
}
