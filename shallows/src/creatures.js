// Fish, gulls, dune grass, rocks, driftwood, suspended particles. All motion is evaluated in vertex shaders.
import * as THREE from 'three';
import { groundHeight, shoreZ } from './world.js';
import { rng, smoothstep } from './noise.js';

const propLight = /* glsl */ `
vec3 propLight(vec3 alb, vec3 N){
  return alb*(uSunCol*max(dot(N, uSunDir), 0.0) + skyAmbient(N));
}`;

// ------------------------------------------------------------------ fish
function fishGeometry() {
  const seg = 9, ring = 6;
  const pos = [], idx = [];
  const prof = (t) => (t < 0.5 ? Math.sin((t / 0.5) * Math.PI * 0.5) * 0.9 + 0.1 : 1 - (t - 0.5) / 0.5 * 0.82) * (t > 0.85 ? 0.55 : 1) ;
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const z = 0.5 - t;                       // nose at +z
    const r = Math.max(prof(t), 0.05) * 0.12;
    for (let j = 0; j < ring; j++) {
      const a = (j / ring) * Math.PI * 2;
      pos.push(Math.cos(a) * r * 0.55, Math.sin(a) * r * (1.0 + 0.0), z);
    }
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < ring; j++) {
    const a = i * ring + j, b = i * ring + ((j + 1) % ring), c = a + ring, d = b + ring;
    idx.push(a, c, b, b, c, d);
  }
  // tail fin
  const base = pos.length / 3;
  pos.push(0, 0, -0.45, 0, 0.14, -0.62, 0, -0.14, -0.62, 0, 0, -0.5);
  idx.push(base, base + 1, base + 2, base + 2, base + 1, base);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function makeFish(U, common, count, schools) {
  const g = fishGeometry();
  const ig = new THREE.InstancedBufferGeometry();
  ig.index = g.index; ig.attributes.position = g.attributes.position; ig.attributes.normal = g.attributes.normal;
  const r = rng(77);
  const seed = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    seed[i * 4] = i % schools.length; seed[i * 4 + 1] = r(); seed[i * 4 + 2] = r(); seed[i * 4 + 3] = r();
  }
  ig.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4));
  ig.instanceCount = count;
  const S = schools.map((s) => new THREE.Vector4(s.x, s.z, s.R, s.v));
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...U, uSchool: { value: S } },
    transparent: true, depthWrite: true,
    vertexShader: /* glsl */ `
${common}
#define NS ${schools.length}
uniform vec4 uSchool[NS];
attribute vec4 aSeed;
varying vec3 vN; varying vec3 vP; varying float vT; varying float vBed;
void main(){
  int si = int(aSeed.x + 0.5);
  vec4 S = uSchool[si];
  float ph = float(si)*1.7;
  float th = uTime*S.w/S.z + ph;
  vec2 c = S.xy + vec2(cos(th), 0.7*sin(th))*S.z;
  vec2 hd = normalize(vec2(-sin(th), 0.7*cos(th)));
  vec2 side = vec2(-hd.y, hd.x);
  vec3 off = (aSeed.yzw - 0.5)*vec3(3.4, 1.0, 3.8);
  off.xz += 0.35*vec2(sin(uTime*0.9 + aSeed.y*20.0), cos(uTime*0.7 + aSeed.z*20.0));
  vec2 xz = c + side*off.x + hd*off.z;
  float bed = groundTex(xz).x;
  float surf = uTide - 0.28;
  float y = mix(bed + 0.22, surf, 0.2 + 0.6*aSeed.w);
  float alive = step(bed + 0.5, surf);
  vec3 lp = position;
  float sc = 0.55 + 0.35*aSeed.z;
  float wag = sin(uTime*8.0 + aSeed.y*30.0 - lp.z*7.0)*0.07*smoothstep(0.35, -0.5, lp.z);
  lp.x += wag;
  lp *= sc*alive;
  // orient +z along heading, slight bank
  vec3 f = vec3(hd.x, 0.0, hd.y);
  vec3 s = vec3(side.x, 0.0, side.y);
  vec3 wp = vec3(xz.x, y + 0.05*sin(uTime*1.3 + aSeed.x), xz.y) + s*lp.x + vec3(0.0,1.0,0.0)*lp.y + f*lp.z;
  vN = normalize(s*normal.x + vec3(0.0,1.0,0.0)*normal.y + f*normal.z);
  vP = wp; vT = aSeed.y; vBed = bed;
  gl_Position = projectionMatrix*viewMatrix*vec4(wp, 1.0);
}`,
    fragmentShader: /* glsl */ `
${common}
${propLight}
varying vec3 vN; varying vec3 vP; varying float vT; varying float vBed;
void main(){
  vec3 N = normalize(vN);
  vec3 V = normalize(uCamPos - vP);
  float belly = smoothstep(0.2, -0.6, N.y);
  vec3 alb = mix(vec3(0.16,0.20,0.22), vec3(0.78,0.80,0.74), belly);
  alb = mix(alb, vec3(0.8,0.62,0.22), step(0.8, vT)*0.55);
  float surf = uTide;
  float dpt = max(surf - vP.y, 0.0);
  vec3 sig = absorbCoef();
  vec3 lit = alb*(uSunCol*max(N.y*0.5 + 0.5, 0.2)*exp(-sig*dpt)*0.8 + skyAmbient(N)*exp(-sig*dpt*0.9));
  float dist = length(uCamPos - vP);
  if (uUnder > 0.5) {
    vec3 trans = exp(-sig*dist);
    vec3 inscat = bodyColor()*waterLight()*(1.0 - exp(-dist*vec3(0.11,0.13,0.15)*(1.0+uTurb)));
    gl_FragColor = vec4(lit*trans + inscat, 1.0);
  } else {
    float path = dpt/max(abs(V.y), 0.18);
    vec3 T = exp(-sig*(path + 0.0));
    float a = clamp(T.g*1.05 - 0.04, 0.0, 0.92);
    gl_FragColor = vec4(lit*T/max(T.g, 1e-3)*0.96, a);
  }
}`,
  });
  const m = new THREE.Mesh(ig, mat);
  m.frustumCulled = false; m.renderOrder = 5;
  return m;
}

// ------------------------------------------------------------------ gulls
function gullGeometry() {
  const pos = [], aw = [], idx = [];
  const push = (x, y, z, w) => { pos.push(x, y, z); aw.push(w); return pos.length / 3 - 1; };
  // body spine and two wings, spanwise factor w grows to 1 at the tips
  const b0 = push(0, 0, 0.42, 0), bl = push(-0.07, 0, 0.0, 0), br = push(0.07, 0, 0.0, 0), b3 = push(0, 0, -0.38, 0), bu = push(0, 0.05, 0.05, 0);
  idx.push(b0, bl, br, bl, b3, br, b0, br, bu, b0, bu, bl);
  for (const sgn of [-1, 1]) {
    const w0 = push(sgn*0.07, 0, 0.12, 0), w1 = push(sgn*0.07, 0, -0.14, 0);
    const m0 = push(sgn*0.55, 0.0, 0.07, 0.5), m1 = push(sgn*0.5, 0.0, -0.16, 0.5);
    const t0 = push(sgn*1.05, 0.0, -0.06, 1.0), t1 = push(sgn*0.95, 0.0, -0.2, 1.0);
    if (sgn < 0) idx.push(w0, m0, w1, w1, m0, m1, m0, t0, m1, m1, t0, t1);
    else idx.push(w0, w1, m0, w1, m1, m0, m0, m1, t0, m1, t1, t0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aW', new THREE.Float32BufferAttribute(aw, 1));
  g.setIndex(idx);
  return g;
}

export function makeGulls(U, common, count) {
  const g = gullGeometry();
  const ig = new THREE.InstancedBufferGeometry();
  ig.index = g.index; ig.attributes.position = g.attributes.position; ig.attributes.aW = g.attributes.aW;
  const r = rng(4242);
  const seed = new Float32Array(count * 4), path = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    seed[i * 4] = r(); seed[i * 4 + 1] = r(); seed[i * 4 + 2] = r(); seed[i * 4 + 3] = r();
    // cx, cz, radius, altitude
    path[i * 4] = (r() - 0.5) * 260; path[i * 4 + 1] = -30 + r() * 170;
    path[i * 4 + 2] = 18 + r() * 55; path[i * 4 + 3] = 16 + r() * 42;
  }
  ig.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4));
  ig.setAttribute('aPath', new THREE.InstancedBufferAttribute(path, 4));
  ig.instanceCount = count;
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...U },
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
${common}
attribute float aW; attribute vec4 aSeed; attribute vec4 aPath;
varying float vW; varying vec3 vP; varying float vShade;
void main(){
  float sp = 0.045 + 0.03*aSeed.x;
  float th = uTime*sp*(aSeed.y > 0.5 ? 1.0 : -1.0) + aSeed.z*6.283;
  vec2 c = aPath.xy + vec2(cos(th), sin(th))*aPath.z;
  vec2 tg = vec2(-sin(th), cos(th))*(aSeed.y > 0.5 ? 1.0 : -1.0);
  float alt = aPath.w + 3.0*sin(uTime*0.13 + aSeed.w*9.0);
  vec3 f = normalize(vec3(tg.x, 0.0, tg.y));
  vec3 s = vec3(-f.z, 0.0, f.x);
  float flapRate = 3.2 + 2.0*aSeed.x;
  float glide = smoothstep(0.35, 0.65, sin(uTime*0.21 + aSeed.w*30.0)*0.5 + 0.5);
  float flap = sin(uTime*flapRate + aSeed.w*20.0)*(1.0 - 0.8*glide);
  float scale = 0.8 + 0.5*aSeed.y;
  vec3 lp = position*scale;
  lp.y += aW*aW*(0.3*flap - 0.16*glide*0.0)*scale + aW*0.07*scale;   // bend up toward the tips
  float bank = -0.35;
  vec3 up = normalize(vec3(0.0,1.0,0.0) + s*bank*(aSeed.y > 0.5 ? 1.0 : -1.0)*0.6);
  vec3 wp = vec3(c.x, alt, c.y) + s*lp.x + up*lp.y + f*lp.z;
  vW = aW; vP = wp; vShade = 0.5 + 0.5*flap;
  gl_Position = projectionMatrix*viewMatrix*vec4(wp, 1.0);
}`,
    fragmentShader: /* glsl */ `
${common}
varying float vW; varying vec3 vP; varying float vShade;
void main(){
  vec3 alb = mix(vec3(0.92,0.92,0.90), vec3(0.62,0.64,0.66), smoothstep(0.1, 0.8, vW)*0.55);
  alb = mix(alb, vec3(0.06), smoothstep(0.82, 1.0, vW));
  vec3 N = normalize(vec3(0.0, 1.0, 0.0));
  vec3 col = alb*(uSunCol*0.55 + skyAmbient(N)*1.1);
  float dist = length(uCamPos - vP);
  col = applyHaze(col, dist);
  gl_FragColor = vec4(col, 1.0);
}`,
  });
  const m = new THREE.Mesh(ig, mat);
  m.frustumCulled = false; m.renderOrder = 3;
  return m;
}

// ------------------------------------------------------------------ dune grass
export function makeGrass(U, common, count) {
  const R = rng(1234);
  const blade = [], bw = [];
  const blades = 4;
  const bg = new THREE.BufferGeometry();
  const pos = [], h = [], idx = [];
  for (let b = 0; b < blades; b++) {
    const a = (b / blades) * Math.PI * 2 + 0.4, ox = Math.cos(a) * 0.05, oz = Math.sin(a) * 0.05;
    const dx = -Math.sin(a), dz = Math.cos(a), lean = 0.28 + 0.12 * (b % 2);
    const i0 = pos.length / 3;
    pos.push(ox - dx * 0.018, 0, oz - dz * 0.018, ox + dx * 0.018, 0, oz + dz * 0.018, ox + Math.cos(a) * lean, 0.55, oz + Math.sin(a) * lean);
    h.push(0, 0, 1);
    idx.push(i0, i0 + 1, i0 + 2);
  }
  bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  bg.setAttribute('aH', new THREE.Float32BufferAttribute(h, 1));
  bg.setIndex(idx);
  const ig = new THREE.InstancedBufferGeometry();
  ig.index = bg.index; ig.attributes.position = bg.attributes.position; ig.attributes.aH = bg.attributes.aH;
  const inst = new Float32Array(count * 4); // x, z, scale, rot
  let n = 0, tries = 0;
  const tmp = {};
  while (n < count && tries < count * 40) {
    tries++;
    const x = (R() - 0.5) * 300, z = shoreZ(x) - 30 - R() * 150;
    const y = groundHeight(x, z, tmp);
    if (tmp.veg < 0.18 || R() > tmp.veg + 0.15) continue;
    inst[n * 4] = x; inst[n * 4 + 1] = z; inst[n * 4 + 2] = 0.7 + R() * 1.4 + (R() < 0.04 ? 1.6 : 0); inst[n * 4 + 3] = R() * 6.283;
    n++;
  }
  ig.setAttribute('aInst', new THREE.InstancedBufferAttribute(inst, 4));
  ig.instanceCount = n;
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...U, uHeight: U.uHeight },
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
${common}
attribute float aH; attribute vec4 aInst;
varying float vH; varying vec3 vP; varying float vTone;
void main(){
  vec2 xz = aInst.xy;
  float y = groundTex(xz).x;
  float dist = length(vec3(xz.x, y, xz.y) - uCamPos);
  float vis = 1.0 - smoothstep(70.0, 120.0, dist);
  float c = cos(aInst.w), s = sin(aInst.w);
  vec3 lp = position*aInst.z*vis;
  vec3 r = vec3(lp.x*c - lp.z*s, lp.y, lp.x*s + lp.z*c);
  float sway = (sin(uTime*1.7 + xz.x*0.35 + xz.y*0.21) + 0.5*sin(uTime*3.1 + xz.x*0.9))*0.12*aH*aH*aInst.z;
  r.x += sway*uWind.x; r.z += sway*uWind.y;
  vec3 wp = vec3(xz.x, y, xz.y) + r;
  vH = aH; vP = wp; vTone = fract(sin(dot(xz, vec2(12.9898, 78.233)))*43758.5453);
  gl_Position = projectionMatrix*viewMatrix*vec4(wp, 1.0);
}`,
    fragmentShader: /* glsl */ `
${common}
varying float vH; varying vec3 vP; varying float vTone;
void main(){
  vec3 base = mix(vec3(0.16,0.20,0.07), vec3(0.34,0.31,0.12), vTone);
  vec3 tip = mix(vec3(0.46,0.50,0.20), vec3(0.74,0.66,0.36), vTone);
  vec3 alb = mix(base, tip, vH);
  vec3 N = normalize(vec3(0.0, 1.0, 0.0));
  vec3 col = alb*(uSunCol*(0.45 + 0.35*vH) + skyAmbient(N));
  float dist = length(uCamPos - vP);
  col = applyHaze(col, dist);
  gl_FragColor = vec4(col, 1.0);
}`,
  });
  const m = new THREE.Mesh(ig, mat);
  m.frustumCulled = false; m.renderOrder = 1;
  return m;
}

// ------------------------------------------------------------------ rocks & driftwood
function rockGeometry(seed) {
  const g = new THREE.IcosahedronGeometry(1, 2);
  const p = g.attributes.position;
  const R = rng(seed);
  const ph = [R() * 6, R() * 6, R() * 6];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = 1 + 0.22 * Math.sin(x * 2.1 + ph[0]) * Math.cos(z * 1.7 + ph[1]) + 0.14 * Math.sin(y * 3.3 + x * 2 + ph[2]);
    p.setXYZ(i, x * n * 1.1, y * n * 0.72, z * n);
  }
  g.computeVertexNormals();
  return g;
}

export function makeProps(U, common, rockCount, woodCount) {
  const R = rng(555);
  const group = new THREE.Group();
  const matFor = (tint) => new THREE.ShaderMaterial({
    uniforms: { ...U, uTint: { value: new THREE.Color(...tint) } },
    vertexShader: /* glsl */ `
${common}
varying vec3 vN; varying vec3 vP; varying vec3 vL;
void main(){
  vec4 wp = modelMatrix*instanceMatrix*vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix*instanceMatrix)*normal);
  vP = wp.xyz; vL = position;
  gl_Position = projectionMatrix*viewMatrix*wp;
}`,
    fragmentShader: /* glsl */ `
${common}
uniform vec3 uTint;
varying vec3 vN; varying vec3 vP; varying vec3 vL;
void main(){
  vec3 N = normalize(vN);
  float n = fbm3(vP.xz*2.3 + vP.y*1.7);
  vec3 alb = uTint*(0.7 + 0.6*n);
  float dpt = uTide - vP.y;
  float wet = smoothstep(-0.1, 0.5, dpt + 0.15);
  alb *= mix(1.0, 0.6, wet);
  vec3 col = alb*(uSunCol*max(dot(N, uSunDir), 0.0) + skyAmbient(N));
  col = applyHaze(col, length(uCamPos - vP));
  gl_FragColor = vec4(col, 1.0);
}`,
  });
  const tmp = {};
  for (let v = 0; v < 3; v++) {
    const geo = rockGeometry(100 + v);
    const per = Math.ceil(rockCount / 3);
    const mesh = new THREE.InstancedMesh(geo, matFor([0.4, 0.37, 0.33]), per);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
    let n = 0, tries = 0;
    while (n < per && tries < per * 60) {
      tries++;
      const side = R() < 0.5 ? -1 : 1;
      const x = side * (92 + R() * 70), z = -10 + R() * 125;
      const y = groundHeight(x, z, tmp);
      if (y < -0.4 || tmp.rock < 0.25) continue;
      const sc = 0.35 + Math.pow(R(), 2.2) * 2.4;
      p.set(x, y - sc * 0.2, z); e.set(R() * 0.4, R() * 6.28, R() * 0.4); q.setFromEuler(e); s.set(sc, sc, sc * (0.8 + R() * 0.5));
      m.compose(p, q, s); mesh.setMatrixAt(n++, m);
    }
    mesh.count = n; mesh.frustumCulled = false; mesh.renderOrder = 1;
    group.add(mesh);
  }
  // driftwood close to the old high-tide line
  {
    const geo = new THREE.CylinderGeometry(0.09, 0.12, 1, 7, 1);
    geo.rotateZ(Math.PI / 2);
    const mesh = new THREE.InstancedMesh(geo, matFor([0.55, 0.47, 0.38]), woodCount);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
    for (let i = 0; i < woodCount; i++) {
      const x = (R() - 0.5) * 150, z = shoreZ(x) - 6 - R() * 5;
      const y = groundHeight(x, z);
      p.set(x, y + 0.08, z); e.set((R() - 0.5) * 0.2, R() * 6.28, (R() - 0.5) * 0.2); q.setFromEuler(e);
      const L = 1.6 + R() * 3.2; s.set(L, 0.8 + R() * 0.8, 0.8 + R() * 0.8);
      m.compose(p, q, s); mesh.setMatrixAt(i, m);
    }
    mesh.frustumCulled = false; mesh.renderOrder = 1;
    group.add(mesh);
  }
  return group;
}

// ------------------------------------------------------------------ suspended particles (visible under water)
export function makeMotes(U, common, count) {
  const g = new THREE.BufferGeometry();
  const seed = new Float32Array(count * 3);
  const r = rng(31);
  for (let i = 0; i < count; i++) { seed[i * 3] = r(); seed[i * 3 + 1] = r(); seed[i * 3 + 2] = r(); }
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...U },
    transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
${common}
attribute vec3 aSeed;
varying float vA;
void main(){
  vec3 box = vec3(14.0, 6.0, 14.0);
  vec3 p = aSeed*box + vec3(uTime*0.05*(aSeed.x - 0.5), uTime*0.03, uTime*0.04*(aSeed.z - 0.5)) + 0.4*vec3(sin(uTime*0.4 + aSeed.y*30.0), 0.0, cos(uTime*0.35 + aSeed.x*30.0));
  p = mod(p - uCamPos + box*0.5, box) - box*0.5;
  vec3 wp = uCamPos + p;
  vec4 mv = viewMatrix*vec4(wp, 1.0);
  gl_Position = projectionMatrix*mv;
  float d = length(p);
  gl_PointSize = clamp((0.035 + 0.05*aSeed.y)*600.0/max(-mv.z, 0.2), 1.0, 6.0);
  float h = wp.y - groundTex(wp.xz).x;
  vA = uUnder*smoothstep(7.0, 1.0, d)*smoothstep(0.0, 0.3, h)*(0.25 + 0.75*aSeed.z);
}`,
    fragmentShader: /* glsl */ `
${common}
varying float vA;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.0, length(c))*vA;
  gl_FragColor = vec4(waterLight()*vec3(0.5, 0.9, 1.0)*a*0.5, 1.0);
}`,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false; pts.renderOrder = 6;
  return pts;
}
