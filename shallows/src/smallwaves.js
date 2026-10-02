// Wind-chop spectrum: a handful of analytic directional waves (λ ≈ 0.35–7 m) layered over the swell trains.
// Shared by the GLSL (as constant arrays) and by the JS surface sampler used for the camera.
import { rng } from './noise.js';

export const NSW = 14;

export function makeSmallWaves(windAngle = 0.25) {
  const r = rng(90210);
  const waves = [];
  for (let i = 0; i < NSW; i++) {
    const k = 0.95 * Math.pow(1.25, i);
    const ang = windAngle + (r() - 0.5) * 2.1;
    const slope = (0.05 + 0.02 * r()) * Math.pow(k, -0.3);          // a·k  → visual steepness of every component
    const a = slope / k;
    const w = Math.sqrt(9.81 * k + 7.4e-5 * k * k * k);
    waves.push({ dx: Math.cos(ang) * 0 + Math.sin(ang), dz: -Math.cos(ang), k, a, w, ph: r() * Math.PI * 2 });
  }
  return waves;
}

export function smallWavesGLSL(waves) {
  const f = (x) => (Math.abs(x) < 1e-9 ? '0.0' : x.toFixed(6));
  const A = waves.map((w) => `vec4(${f(w.dx)},${f(w.dz)},${f(w.k)},${f(w.a)})`).join(',');
  const B = waves.map((w) => `vec2(${f(w.w)},${f(w.ph)})`).join(',');
  return `#define NSW ${waves.length}
const vec4 SW[NSW] = vec4[NSW](${A});
const vec2 SWP[NSW] = vec2[NSW](${B});
`;
}
