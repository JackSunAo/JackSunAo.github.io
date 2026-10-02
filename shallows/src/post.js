// HDR scene target, bloom chain, and the final grade (tone map, under-water look, lens droplets).
import * as THREE from 'three';
import { quadVert } from './glsl.js';

const downFrag = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThreshold; uniform float uFirst;
varying vec2 vUv;
vec3 s(vec2 o){ return texture2D(tSrc, vUv + o*uTexel).rgb; }
void main(){
  vec3 c = s(vec2(0.0))*0.25 + (s(vec2(-1.0,-1.0)) + s(vec2(1.0,-1.0)) + s(vec2(-1.0,1.0)) + s(vec2(1.0,1.0)))*0.1875
         + (s(vec2(-2.0,0.0)) + s(vec2(2.0,0.0)) + s(vec2(0.0,-2.0)) + s(vec2(0.0,2.0)))*0.0 ;
  if (uFirst > 0.5) {
    float l = max(c.r, max(c.g, c.b));
    c *= clamp((l - uThreshold)/max(l, 1e-3), 0.0, 1.0);
    c = min(c, vec3(60.0));
  }
  gl_FragColor = vec4(c, 1.0);
}`;

const upFrag = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uWeight;
varying vec2 vUv;
vec3 s(vec2 o){ return texture2D(tSrc, vUv + o*uTexel).rgb; }
void main(){
  vec3 c = s(vec2(0.0))*4.0 + (s(vec2(1.0,0.0)) + s(vec2(-1.0,0.0)) + s(vec2(0.0,1.0)) + s(vec2(0.0,-1.0)))*2.0
         + s(vec2(1.0,1.0)) + s(vec2(-1.0,1.0)) + s(vec2(1.0,-1.0)) + s(vec2(-1.0,-1.0));
  gl_FragColor = vec4(c/16.0*uWeight, 1.0);
}`;

const finalFrag = /* glsl */ `
uniform sampler2D tScene; uniform sampler2D tBloom;
uniform float uExposure, uBloom, uUnderAmt, uWetLens, uTime, uAspect, uVignette;
uniform vec2 uSunScreen; uniform float uSunVis;
varying vec2 vUv;
float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x*p.y); }
vec2 h22(vec2 p){ return vec2(h21(p), h21(p + 19.19)); }

vec3 aces(vec3 x){
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x*(a*x + b))/(x*(c*x + d) + e), 0.0, 1.0);
}

void droplets(vec2 uv, float wet, out vec2 off, out float mask, out float spec, out float rim){
  off = vec2(0.0); mask = 0.0; spec = 0.0; rim = 0.0;
  for (int L = 0; L < 2; L++){
    float sc = L == 0 ? 6.5 : 12.0;
    vec2 q = uv*vec2(uAspect, 1.0)*sc;
    q.y += uTime*(L == 0 ? 0.012 : 0.02);
    vec2 id = floor(q); vec2 f = fract(q) - 0.5;
    vec2 r = h22(id + float(L)*31.7);
    float cap = wet*(L == 0 ? 0.55 : 0.8);
    float exist = step(r.x, cap);
    vec2 c = (r - 0.5)*0.42;
    float rad = (0.11 + 0.17*h21(id + 7.1))*smoothstep(0.0, 0.4, wet);
    // slow slide with a faint trail
    vec2 dv = f - c;
    float dd = length(dv);
    float m = smoothstep(rad, rad*0.8, dd)*exist;
    vec2 nrm = dv/max(rad, 1e-3);
    float z = sqrt(max(1.0 - dot(nrm, nrm), 0.0));
    vec3 n3 = normalize(vec3(nrm, z + 0.25));
    off += -nrm*m*(L == 0 ? 0.030 : 0.017);
    mask = max(mask, m);
    spec += m*pow(max(dot(n3, normalize(vec3(-0.45, 0.65, 0.6))), 0.0), 18.0);
    rim += m*smoothstep(0.55, 1.0, length(nrm));
  }
}

void main(){
  vec2 uv = vUv;
  if (uUnderAmt > 0.0) {
    uv += uUnderAmt*0.0022*vec2(sin(uv.y*38.0 + uTime*1.6), cos(uv.x*31.0 + uTime*1.2));
  }
  vec2 off; float mask, spec, rim;
  droplets(uv, uWetLens, off, mask, spec, rim);
  vec2 suv = uv + off;
  vec3 col;
  float ca = 0.0012*(uUnderAmt + mask*3.0);
  col.r = texture2D(tScene, suv + vec2(ca, 0.0)).r;
  col.g = texture2D(tScene, suv).g;
  col.b = texture2D(tScene, suv - vec2(ca, 0.0)).b;
  vec3 bl = texture2D(tBloom, suv).rgb;
  col += bl*uBloom*(1.0 + 0.5*uUnderAmt);
  col *= 1.0 - mask*0.12*rim;
  col += spec*0.55*vec3(1.0, 0.97, 0.9)*mask;
  col *= uExposure;
  col = aces(col);
  // gentle grade: slight warmth in the highlights, cool shadows
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, 1.08);
  vec2 vq = vUv - 0.5;
  col *= 1.0 - uVignette*dot(vq, vq)*1.1;
  col = pow(col, vec3(1.0/2.2));
  // light dither against banding in the smooth sky / water gradients
  col += (h21(gl_FragCoord.xy + uTime) - 0.5)/255.0;
  gl_FragColor = vec4(col, 1.0);
}`;

export class Post {
  constructor(renderer) {
    this.r = renderer;
    this.scene = new THREE.Scene();
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    this.quad = new THREE.Mesh(g, null);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
    const mk = (frag, uniforms, extra = {}) => new THREE.ShaderMaterial({
      vertexShader: quadVert, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, ...extra,
    });
    this.matDown = mk(downFrag, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 1.0 }, uFirst: { value: 0 } });
    this.matUp = mk(upFrag, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uWeight: { value: 1 } },
      { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor });
    this.final = mk(finalFrag, {
      tScene: { value: null }, tBloom: { value: null }, uExposure: { value: 1 }, uBloom: { value: 0.06 }, uUnderAmt: { value: 0 },
      uWetLens: { value: 0 }, uTime: { value: 0 }, uAspect: { value: 1 }, uVignette: { value: 0.5 },
      uSunScreen: { value: new THREE.Vector2() }, uSunVis: { value: 0 },
    });
    this.sceneRT = null; this.bloom = [];
    this.w = 0; this.h = 0;
  }

  resize(w, h, msaa) {
    this.w = w; this.h = h;
    if (this.sceneRT) this.sceneRT.dispose();
    this.bloom.forEach((b) => b.dispose());
    this.sceneRT = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      depthBuffer: true, samples: msaa,
    });
    this.bloom = [];
    let bw = Math.max(2, w >> 1), bh = Math.max(2, h >> 1);
    for (let i = 0; i < 5; i++) {
      this.bloom.push(new THREE.WebGLRenderTarget(bw, bh, {
        type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false,
      }));
      bw = Math.max(2, bw >> 1); bh = Math.max(2, bh >> 1);
    }
  }

  pass(mat, target) {
    this.quad.material = mat;
    this.r.setRenderTarget(target);
    this.r.render(this.scene, this.cam);
  }

  // scene has already been rendered into sceneRT
  run(opts) {
    const r = this.r;
    r.autoClear = false;
    // bloom
    let src = this.sceneRT.texture;
    for (let i = 0; i < this.bloom.length; i++) {
      const rt = this.bloom[i];
      this.matDown.uniforms.tSrc.value = src;
      this.matDown.uniforms.uTexel.value.set(1 / (i === 0 ? this.w : this.bloom[i - 1].width), 1 / (i === 0 ? this.h : this.bloom[i - 1].height));
      this.matDown.uniforms.uThreshold.value = opts.threshold;
      this.matDown.uniforms.uFirst.value = i === 0 ? 1 : 0;
      r.setRenderTarget(rt); r.clear();
      this.pass(this.matDown, rt);
      src = rt.texture;
    }
    for (let i = this.bloom.length - 1; i > 0; i--) {
      const lo = this.bloom[i], hi = this.bloom[i - 1];
      this.matUp.uniforms.tSrc.value = lo.texture;
      this.matUp.uniforms.uTexel.value.set(1 / lo.width, 1 / lo.height);
      this.matUp.uniforms.uWeight.value = 1.0;
      this.pass(this.matUp, hi);
    }
    const u = this.final.uniforms;
    u.tScene.value = this.sceneRT.texture;
    u.tBloom.value = this.bloom[0].texture;
    u.uExposure.value = opts.exposure;
    u.uBloom.value = opts.bloom;
    u.uUnderAmt.value = opts.under;
    u.uWetLens.value = opts.wetLens;
    u.uTime.value = opts.time;
    u.uAspect.value = this.w / this.h;
    u.uVignette.value = opts.vignette;
    this.pass(this.final, null);
    r.autoClear = true;
  }
}
