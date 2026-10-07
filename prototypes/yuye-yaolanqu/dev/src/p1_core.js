/* ===== P1 core: renderer, post, utils, textures ===== */
const V3 = THREE.Vector3;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (cur, target, k, dt) => cur + (target - cur) * (1 - Math.exp(-k * dt));
const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
function rng(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25)); // the quality system (p8c) sets the real value
renderer.setSize(innerWidth, innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.NoToneMapping; // done in the grade pass

// shadows fade out over the last stretch of a shadow map instead of stopping at a hard line: someone walking out past the
// moon's shadow loses it gradually (a spotlight's cone is already dark there, so only the moon's square edge changes)
THREE.ShaderChunk.shadowmap_pars_fragment = THREE.ShaderChunk.shadowmap_pars_fragment.replace(/(float getShadow\([\s\S]*?)(\n\s*return shadow;)/,
  '$1\n\t\tvec2 shEdge = abs( shadowCoord.xy - 0.5 ) * 2.0;\n\t\tshadow = mix( shadow, 1.0, smoothstep( 0.82, 0.98, max( shEdge.x, shEdge.y ) ) );$2');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05080d);
scene.fog = new THREE.FogExp2(0x070b11, 0.022);
const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.1, 160);
camera.position.set(0, 12, 14);

/* ---------- post processing ---------- */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, time: { value: 0 }, res: { value: new THREE.Vector2(1, 1) },
    vig: { value: 0.55 }, grain: { value: 0.02 }, aberr: { value: 0.0003 }, exposure: { value: 1.0 },
    flash: { value: 0 }, hurt: { value: 0 }, desat: { value: 0 }, bars: { value: 0 }
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time, vig, grain, aberr, exposure, flash, hurt, desat, bars; uniform vec2 res; varying vec2 vUv;
    vec3 aces(vec3 x){ float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14; return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.0,1.0); }
    void main(){
      vec2 uv=vUv; vec2 d=uv-0.5; float r2=dot(d,d);
      vec2 off=d*r2*aberr*14.0;
      vec3 col; col.r=texture2D(tDiffuse,uv+off).r; col.g=texture2D(tDiffuse,uv).g; col.b=texture2D(tDiffuse,uv-off).b;
      col*=exposure; col+=flash*vec3(0.55,0.65,0.85);
      col=aces(col);
      float l=dot(col,vec3(0.299,0.587,0.114));
      vec3 cool=col*vec3(0.92,0.99,1.08); vec3 warm=col*vec3(1.035,1.0,0.965);
      col=mix(cool,warm,smoothstep(0.22,0.8,l));
      col=mix(vec3(l),col,0.9-desat*0.7);
      col=mix(col,col*vec3(1.0,0.55,0.5),hurt*0.8);
      col*=1.0-vig*smoothstep(0.12,0.78,sqrt(r2)*1.55)-hurt*0.5*smoothstep(0.1,0.7,sqrt(r2));
      float g=fract(sin(dot(uv*res+fract(time)*37.0,vec2(12.9898,78.233)))*43758.5453); col+=(g-0.5)*grain;
      col=pow(max(col,0.0),vec3(1.0/2.2));
      float bar=smoothstep(0.0,0.002,min(uv.y,1.0-uv.y)-0.115*bars);
      col*=mix(1.0,bar,step(0.001,bars));
      gl_FragColor=vec4(col,1.0);
    }`
};
let composer, bloomPass, gradePass;
function makeComposer(samples = 4) {
  if (composer) { composer.renderTarget1.dispose(); composer.renderTarget2.dispose(); if (bloomPass) bloomPass.dispose(); }
  const w = innerWidth, h = innerHeight, pr = renderer.getPixelRatio();
  const rt = new THREE.WebGLRenderTarget(w * pr, h * pr, { type: THREE.HalfFloatType, samples });
  composer = new THREE.EffectComposer(renderer, rt);
  composer.setPixelRatio(pr);
  composer.addPass(new THREE.RenderPass(scene, camera));
  bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(w, h), 0.5, 0.65, 0.85);
  composer.addPass(bloomPass);
  gradePass = new THREE.ShaderPass(GradeShader);
  composer.addPass(gradePass);
  composer.setSize(w, h); gradePass.uniforms.res.value.set(w, h);
}
makeComposer();
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  composer.setSize(innerWidth, innerHeight);
  gradePass.uniforms.res.value.set(innerWidth, innerHeight);
});
gradePass.uniforms.res.value.set(innerWidth, innerHeight);

/* ---------- procedural textures ---------- */
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function toTex(c, srgb = true, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.encoding = THREE.sRGBEncoding;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
function shade(hex, f) {
  const c = new THREE.Color(hex); c.multiplyScalar(f);
  return '#' + c.getHexString();
}
function woodCanvas(base, plank, w = 512, h = 512, seed = 1, dirt = 0.35) {
  const c = mkCanvas(w, h), g = c.getContext('2d'), R = rng(seed);
  const n = Math.round(h / plank);
  for (let i = 0; i < n; i++) {
    const y = i * plank, v = 0.72 + R() * 0.55;
    g.fillStyle = shade(base, v); g.fillRect(0, y, w, plank);
    for (let k = 0; k < 28; k++) {
      g.strokeStyle = `rgba(0,0,0,${0.02 + R() * 0.05})`; g.lineWidth = 0.8 + R() * 2.4;
      const yy = y + R() * plank; g.beginPath(); g.moveTo(0, yy); let x = 0;
      while (x < w) { x += 25 + R() * 70; g.lineTo(x, yy + (R() - 0.5) * 4); } g.stroke();
    }
    if (R() < 0.6) {
      const kx = R() * w, ky = y + plank * (0.25 + R() * 0.5);
      const gr = g.createRadialGradient(kx, ky, 1, kx, ky, 9 + R() * 8);
      gr.addColorStop(0, 'rgba(20,10,4,.8)'); gr.addColorStop(1, 'rgba(20,10,4,0)');
      g.fillStyle = gr; g.beginPath(); g.ellipse(kx, ky, 22, 9, 0, 0, 7); g.fill();
    }
    g.fillStyle = 'rgba(0,0,0,.62)'; g.fillRect(0, y, w, 2);
    g.fillRect(R() * w, y, 2, plank);
  }
  for (let k = 0; k < 260; k++) {
    const x = R() * w, y = R() * h, r = 4 + R() * 26;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(10,6,3,${dirt * 0.5 * R()})`); gr.addColorStop(1, 'rgba(10,6,3,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return c;
}
function woodMat(base, plank, tile, opts = {}) {
  const c = woodCanvas(base, plank, 512, 512, opts.seed || 3, opts.dirt ?? 0.35);
  const map = toTex(c), bump = toTex(c, false);
  map.repeat.set(1, 1); bump.repeat.set(1, 1);
  const m = new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 0.55, roughness: opts.rough ?? 0.88, metalness: 0 });
  m.userData.tile = tile || 1.6; // metres per texture repeat
  return m;
}
/* BoxGeometry with world-scaled UVs so planks keep the same size */
function boxGeo(w, h, d, tile = 1.6) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
    const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0] / tile, uv.getY(k) * dims[f][1] / tile);
  }
  return g;
}
function mesh(geo, mat, x = 0, y = 0, z = 0, cast = true, recv = true) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = recv; return m;
}
function skinCanvas(hex, infected, pale) {
  const c = mkCanvas(256, 256), g = c.getContext('2d'), R = rng(11);
  const base = new THREE.Color(hex);
  if (infected) base.lerp(new THREE.Color('#8f9c8a'), 0.55);
  else if (pale) base.lerp(new THREE.Color('#b9b3ad'), pale);
  g.fillStyle = '#' + base.getHexString(); g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(${R() < 0.5 ? '90,50,40' : '255,230,210'},${0.03 + R() * 0.06})`;
    g.fillRect(R() * 256, R() * 256, 1 + R() * 3, 1 + R() * 3);
  }
  if (infected || pale) {
    g.strokeStyle = `rgba(${infected ? '70,45,95' : '100,80,120'},${infected ? 0.7 : 0.22})`;
    const veins = infected ? 30 : 8;
    for (let i = 0; i < veins; i++) {
      let x = R() * 256, y = R() * 256; g.lineWidth = 0.8 + R() * 1.6; g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 7; k++) { x += (R() - 0.5) * 38; y += 8 + R() * 22; g.lineTo(x, y); } g.stroke();
    }
    for (let i = 0; i < 14; i++) {
      const x = R() * 256, y = R() * 256, r = 6 + R() * 16, gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(40,20,50,.35)'); gr.addColorStop(1, 'rgba(40,20,50,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
  }
  return c;
}
function clothCanvas(hex, wear = 0.3, blood = false, seed = 5) {
  const c = mkCanvas(128, 128), g = c.getContext('2d'), R = rng(seed);
  g.fillStyle = hex; g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 2) for (let x = 0; x < 128; x += 2) { g.fillStyle = (x + y) % 4 ? 'rgba(0,0,0,.045)' : 'rgba(255,255,255,.03)'; g.fillRect(x, y, 2, 2); }
  for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '0,0,0' : '255,255,255'},${0.02 + R() * 0.05})`; g.fillRect(R() * 128, R() * 128, 1 + R() * 2, 1); }
  for (let i = 0; i < 60 * wear; i++) {
    const x = R() * 128, y = R() * 128, r = 6 + R() * 22, gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(25,18,10,${0.45 * wear})`); gr.addColorStop(1, 'rgba(25,18,10,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  if (blood) for (let i = 0; i < 9; i++) {
    const x = R() * 128, y = R() * 128, r = 4 + R() * 14, gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(90,10,10,.85)'); gr.addColorStop(1, 'rgba(90,10,10,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  return c;
}
// a canvas is painted once per pattern; every later caller gets a copy (a few microseconds instead of thousands of brush strokes)
function memoCanvas(fn) {
  const cache = new Map();
  return (...args) => { const k = JSON.stringify(args); let c = cache.get(k); if (!c) cache.set(k, c = fn(...args)); const out = mkCanvas(c.width, c.height); out.getContext('2d').drawImage(c, 0, 0); return out; };
}
skinCanvas = memoCanvas(skinCanvas); clothCanvas = memoCanvas(clothCanvas);
function softDisc(size = 128, stops = [[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']]) {
  const c = mkCanvas(size, size), g = c.getContext('2d'), gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(s => gr.addColorStop(s[0], s[1])); g.fillStyle = gr; g.fillRect(0, 0, size, size);
  return toTex(c, true, false);
}
