// All GLSL lives here. Chunks are concatenated into the individual programs in materials.js.
import { smallWavesGLSL } from './smallwaves.js';

export function commonChunk(smallWaves) {
  return /* glsl */ `
#define PI 3.14159265359
uniform float uTime;
uniform float uTide;
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform vec3 uSkyAmb;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSunHaze;
uniform vec3 uCamPos;
uniform float uUnder;
uniform float uClarity;
uniform float uTurb;
uniform float uCaustics;
uniform float uChop;
uniform float uCloudCover;
uniform float uPixelAng;
uniform vec2 uWind;
uniform sampler2D uNoise;

${smallWavesGLSL(smallWaves)}

float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f*f*(3.0-2.0*f);
  return texture2D(uNoise, (i + f + 0.5)/256.0).r;
}
float fbm4(vec2 p){
  float s = 0.0, a = 0.5;
  for (int i=0;i<4;i++){ s += a*vnoise(p); p = p*2.03 + vec2(17.1, 9.3); a *= 0.5; }
  return s/0.9375;
}
float fbm3(vec2 p){
  float s = 0.0, a = 0.5;
  for (int i=0;i<3;i++){ s += a*vnoise(p); p = p*2.03 + vec2(17.1, 9.3); a *= 0.5; }
  return s/0.875;
}

// bilinear fetch that also works where float textures cannot be linearly filtered
vec4 texLin(sampler2D s, vec2 uv, vec2 size){
#ifdef MANUAL_LIN
  vec2 st = clamp(uv, vec2(0.0), vec2(1.0))*size - 0.5;
  vec2 i = floor(st), f = fract(st);
  vec2 a = (clamp(i, vec2(0.0), size-1.0) + 0.5)/size;
  vec2 b = (clamp(i+vec2(1.0,0.0), vec2(0.0), size-1.0) + 0.5)/size;
  vec2 c = (clamp(i+vec2(0.0,1.0), vec2(0.0), size-1.0) + 0.5)/size;
  vec2 d = (clamp(i+vec2(1.0), vec2(0.0), size-1.0) + 0.5)/size;
  return mix(mix(texture2D(s,a), texture2D(s,b), f.x), mix(texture2D(s,c), texture2D(s,d), f.x), f.y);
#else
  return texture2D(s, uv);
#endif
}

// ---------- ground (height, d/dx, d/dz, beach coordinate u) ----------
uniform sampler2D uHeight;
uniform vec4 uHDom;
#define HSIZE vec2(1024.0)
vec4 groundTex(vec2 p){ return texLin(uHeight, (p - uHDom.xy)*uHDom.zw, HSIZE); }

// ---------- swell trains (phase solved on the CPU, see waves.js) ----------
uniform sampler2D uWPhase;
uniform sampler2D uWAmp;
uniform sampler2D uWBrk;
uniform vec4 uWDom;
uniform vec2 uWTexel;
uniform vec2 uWStep;
uniform vec3 uWOmega;
uniform vec3 uWKx;
uniform vec3 uWKyE;
uniform vec3 uWPhi0;
#define WSIZE vec2(512.0)

struct SwellS { float eta; vec2 grad; float detdt; float brk; vec2 flow; };

SwellS swellField(vec2 p, float t){
  SwellS S;
  vec2 q = (p - uWDom.xy)*uWDom.zw;
  vec2 qc = clamp(q, 0.5*uWTexel, 1.0 - 0.5*uWTexel);
  vec2 pc = uWDom.xy + qc/uWDom.zw;
  vec2 ext = p - pc;
  vec4 P0 = texLin(uWPhase, qc, WSIZE);
  vec4 Px = texLin(uWPhase, qc + vec2(uWTexel.x, 0.0), WSIZE);
  vec4 Pz = texLin(uWPhase, qc + vec2(0.0, uWTexel.y), WSIZE);
  vec3 gx = (Px.rgb - P0.rgb)/uWStep.x + uWKx*step(1e-4, abs(ext.x));
  vec3 gz = (Pz.rgb - P0.rgb)/uWStep.y - uWKyE*step(1e-4, abs(ext.y));
  vec3 phi = P0.rgb + uWKx*ext.x - uWKyE*ext.y + uWPhi0 - uWOmega*t;
  vec3 A = texLin(uWAmp, qc, WSIZE).rgb;
  vec3 B = texLin(uWBrk, qc, WSIZE).rgb;
  float d = max(P0.a, 0.1);
  vec3 sk = clamp(0.9*A/(0.5*d + 0.1), 0.0, 0.85);
  S.eta = 0.0; S.grad = vec2(0.0); S.detdt = 0.0; S.brk = 0.0; S.flow = vec2(0.0);
  for (int i=0;i<3;i++){
    float th = phi[i], s = sk[i], a = A[i];
    float tp = th + s*sin(th);
    float f = cos(tp) + 0.25*s*cos(2.0*tp);
    float df = -(sin(tp) + 0.5*s*sin(2.0*tp))*(1.0 + s*cos(th));
    vec2 gp = vec2(gx[i], gz[i]);
    S.eta += a*f;
    S.grad += a*df*gp;
    S.detdt -= a*df*uWOmega[i];
    float cr = smoothstep(0.45, 0.98, f);
    float wgt = clamp(a/0.12, 0.0, 1.0);
    S.brk += B[i]*cr*wgt*0.4;
    float gl = max(length(gp), 0.04);
    float c = min(uWOmega[i]/gl, 9.0);
    float uo = clamp(c*a*f/max(d, 0.25), -1.8, 1.8);
    S.flow += (gp/gl)*(uo + B[i]*cr*wgt*0.5*min(c, 5.0));
  }
  return S;
}

// ---------- wind chop ----------
float smallWaves(vec2 p, float t, float pf, float ampScale, out vec2 g){
  float h = 0.0; g = vec2(0.0);
  for (int i=0;i<NSW;i++){
    vec4 w = SW[i]; vec2 wp = SWP[i];
    float fk = 1.0 - smoothstep(0.5, 1.7, w.z*pf);
    float a = w.w*ampScale*fk;
    float ph = w.z*dot(w.xy, p) - wp.x*t + wp.y;
    h += a*sin(ph);
    g += (a*w.z*cos(ph))*w.xy;
  }
  return h;
}

// ---------- light / water helpers ----------
vec3 absorbCoef(){ return vec3(0.30, 0.100, 0.085)/uClarity + vec3(0.14, 0.12, 0.10)*uTurb; }
vec3 bodyColor(){ return vec3(0.050, 0.160, 0.165)*(1.0 + 0.5*uTurb) + vec3(0.02,0.015,0.0)*uTurb; }
float sunUnderCos(){ // cosine of the refracted sun direction
  float s2 = (1.0 - uSunDir.y*uSunDir.y)/1.7689;
  return sqrt(max(1.0 - s2, 0.05));
}
vec3 skyAmbient(vec3 n){ return mix(uSkyAmb*0.28 + vec3(0.05,0.045,0.04), uSkyAmb, n.y*0.5 + 0.5); }
vec3 waterLight(){ return uSunCol*max(uSunDir.y, 0.08)*0.34 + uSkyAmb*0.62; }

vec4 cloudLayer(vec3 d){
  if (d.y < 0.012) return vec4(0.0);
  float t = 1.0/(d.y + 0.045);
  vec2 p = d.xz*t*0.62 + uWind*uTime*0.0016;
  float n = fbm4(p*1.7);
  float n2 = fbm3(p*5.1 + 3.7);
  float dens = n + 0.22*(n2 - 0.5);
  float c = smoothstep(uCloudCover, uCloudCover + 0.17, dens);
  if (c < 0.003) return vec4(0.0);
  vec2 sp = uSunDir.xz/max(uSunDir.y, 0.2)*0.13;
  float nl = fbm3((p + sp)*1.7) + 0.22*(n2 - 0.5);
  float lit = clamp(0.62 + (dens - nl)*3.4, 0.0, 1.0);
  float thick = smoothstep(uCloudCover, uCloudCover + 0.45, dens);
  vec3 bright = uSunCol*0.55 + uSkyAmb*0.55;
  vec3 shade = uSkyAmb*0.55 + uHorizon*0.12 + vec3(0.02,0.03,0.05);
  vec3 col = mix(shade, bright, lit*(1.0 - 0.45*thick));
  float mu = max(dot(d, uSunDir), 0.0);
  col += uSunCol*pow(mu, 9.0)*0.22*(1.0 - thick);
  float fade = smoothstep(0.012, 0.16, d.y);
  return vec4(col, c*fade);
}

vec3 skyRadiance(vec3 d, float withSun){
  float y = max(d.y, 0.0);
  vec3 col = mix(uZenith, uHorizon, pow(1.0 - y, 3.6));
  float mu = max(dot(d, uSunDir), 0.0);
  col += uSunHaze*(pow(mu, 5.0)*0.16 + pow(mu, 48.0)*0.55);
  vec4 cl = cloudLayer(vec3(d.x, max(d.y, 0.0), d.z));
  col = mix(col, cl.rgb, cl.a);
  if (withSun > 0.5) col += uSunCol*7.0*smoothstep(0.99992, 0.999975, mu)*(1.0 - cl.a);
  return col;
}

float ggx(float NdH, float a){
  float a2 = a*a;
  float d = NdH*NdH*(a2 - 1.0) + 1.0;
  return a2/(PI*d*d + 1e-6);
}

// ---------- foam / wet history ----------
uniform sampler2D uFoam;
uniform vec4 uFDom;
#define FSIZE vec2(1024.0, 768.0)
vec4 foamTex(vec2 p){ return texLin(uFoam, (p - uFDom.xy)*uFDom.zw, FSIZE); }
float foamAlpha(vec2 p, float f){
  float n = fbm4(p*1.9 + vec2(0.0, uTime*0.03));
  float n2 = vnoise(p*7.3);
  float m = f*(0.5 + 0.95*n) + 0.22*(n2 - 0.5)*f;
  return smoothstep(0.3, 0.78, m);
}
vec3 foamColor(){ return (uSunCol*max(uSunDir.y, 0.1)*0.5 + uSkyAmb*0.95)*0.88; }

// ---------- sand ----------
vec3 sandAlbedo(vec2 p){
  float n1 = fbm3(p*0.17);
  float n2 = vnoise(p*2.7);
  float n3 = vnoise(p*19.0);
  vec3 a = mix(vec3(0.70, 0.585, 0.41), vec3(0.83, 0.725, 0.545), n1);
  a *= 0.93 + 0.12*n2 + 0.09*(n3 - 0.5);
  return a;
}
// ripples + grain; fade → 0 removes them (distance / depth)
vec3 sandNormal(vec2 p, vec3 n, float fade, float wetK){
  vec2 dir = normalize(vec2(0.82, 0.57));
  float w = 0.0;
  float warp = fbm3(p*0.35)*5.0;
  float ph = dot(p, dir)*28.0 + warp;
  float rip = cos(ph)*(0.55 + 0.45*vnoise(p*0.6));
  vec2 g = dir*rip*0.045;
  float gr = vnoise(p*23.0) - 0.5;
  g += vec2(vnoise(p*31.0 + 4.0) - 0.5, vnoise(p*29.0 + 9.0) - 0.5)*0.12;
  g *= fade*mix(1.0, 0.45, wetK);
  return normalize(n + vec3(-g.x, 0.0, -g.y));
}

vec3 hazeCol(){ return uHorizon*0.92 + uSunHaze*0.05; }
vec3 applyHaze(vec3 col, float dist){ return mix(col, hazeCol(), 1.0 - exp(-dist*0.00011)); }

// ---------- caustics (analytic: focusing of sun rays by the chop gradient) ----------
vec2 refrOff(vec2 q, float H, float t){
  vec2 g = vec2(0.0);
  for (int i=0;i<NSW;i++){
    vec4 w = SW[i]; vec2 wp = SWP[i];
    float ph = w.z*dot(w.xy, q) - wp.x*t + wp.y;
    g += (w.w*uChop*w.z*cos(ph))*w.xy;
  }
  vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
  vec3 r = refract(-uSunDir, n, 1.0/1.333);
  return r.xz*H/max(-r.y, 0.25);
}
float causticAt(vec2 P, float H, float pf){
  if (H < 0.02) return 1.0;
  vec2 q = P - refrOff(P, H, uTime);
  q = P - refrOff(q, H, uTime);
  #if CAUSTIC_ITERS > 1
  q = P - refrOff(q, H, uTime);
  #endif
  float e = 0.04;
  vec2 m0 = q + refrOff(q, H, uTime);
  vec2 mx = q + vec2(e, 0.0) + refrOff(q + vec2(e, 0.0), H, uTime);
  vec2 mz = q + vec2(0.0, e) + refrOff(q + vec2(0.0, e), H, uTime);
  mat2 J = mat2((mx - m0)/e, (mz - m0)/e);
  float det = abs(determinant(J));
  float I = clamp(1.0/(det + 0.07), 0.0, 7.0)*0.62;
  float contrast = uCaustics*exp(-H/6.5)*(1.0 - smoothstep(0.25, 1.4, pf*5.0));
  return mix(1.0, I, clamp(contrast, 0.0, 1.0)) + 0.18*contrast*I*I*0.25;
}

// ---------- sea-bed ray march through the height texture ----------
float marchBed(vec3 o, vec3 d, out vec3 hit, out float ok){
  float t = 0.0, dt = 0.3;
  ok = 0.0;
  for (int i=0;i<MARCH_STEPS;i++){
    float tn = t + dt;
    vec3 pp = o + d*tn;
    float s = pp.y - groundTex(pp.xz).x;
    if (s < 0.0){
      float a = t, b = tn;
      for (int k=0;k<5;k++){
        float m = 0.5*(a + b);
        vec3 q = o + d*m;
        if (q.y - groundTex(q.xz).x > 0.0) a = m; else b = m;
      }
      hit = o + d*b; ok = 1.0;
      return b;
    }
    t = tn; dt *= 1.23;
  }
  hit = o + d*t;
  return t;
}
`;
}

// ---------------------------------------------------------------- sky
export const skyVert = /* glsl */ `
varying vec2 vNdc;
void main(){ vNdc = position.xy; gl_Position = vec4(position.xy, 1.0, 1.0); }
`;
export const skyFrag = (common) => /* glsl */ `
${common}
uniform mat4 uInvVP;
varying vec2 vNdc;
void main(){
  vec4 w = uInvVP*vec4(vNdc, 1.0, 1.0);
  vec3 d = normalize(w.xyz/w.w - uCamPos);
  vec3 col;
  if (uUnder > 0.5) {
    col = bodyColor()*waterLight()*1.4;
  } else {
    col = skyRadiance(d, 1.0);
    if (d.y < 0.0) col = mix(col, hazeCol(), smoothstep(0.0, -0.06, d.y));
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

// ---------------------------------------------------------------- water
export const waterVert = (common) => /* glsl */ `
${common}
uniform vec2 uCamXZ;
varying vec3 vWorld;
void main(){
  vec2 pxz = uCamXZ + position.xz;
  float pf = max(0.9, length(position.xz)*0.045);
  SwellS sw = swellField(pxz, uTime);
  vec2 sg;
  float sh = smallWaves(pxz, uTime, pf*2.2, uChop, sg);
  vec3 wp = vec3(pxz.x, uTide + sw.eta + sh, pxz.y);
  vWorld = wp;
  gl_Position = projectionMatrix*viewMatrix*vec4(wp, 1.0);
}
`;

export const waterFrag = (common) => /* glsl */ `
${common}
varying vec3 vWorld;
uniform float uShoreFoamVis;
uniform float uWetSand;

vec3 bedShade(vec3 hit, float surfY, float pf){
  vec4 gt = groundTex(hit.xz);
  vec3 N = normalize(vec3(-gt.y, 1.0, -gt.z));
  float H = max(surfY - hit.y, 0.0);
  float depthFade = exp(-H*0.35)/(1.0 + pf*8.0);
  N = sandNormal(hit.xz, N, depthFade, 0.0);
  vec3 sig = absorbCoef();
  vec3 sunT = exp(-sig*H/sunUnderCos());
  float C = causticAt(hit.xz, H, pf);
  float NL = max(dot(N, uSunDir), 0.0);
  vec3 direct = uSunCol*NL*sunT*C;
  vec3 amb = skyAmbient(N)*exp(-sig*H*0.9)*0.9;
  vec3 alb = sandAlbedo(hit.xz);
  return alb*(direct + amb);
}

void main(){
  vec2 p = vWorld.xz;
  vec3 toCam = uCamPos - vWorld;
  float dist = length(toCam);
  vec3 V = toCam/dist;
  float pf = dist*uPixelAng*1.4;

  SwellS sw = swellField(p, uTime);
  vec4 gt = groundTex(p);
  float depthHere = uTide - gt.x;
  float chopScale = uChop*smoothstep(-0.05, 0.5, depthHere + sw.eta);
  vec2 sg;
  float sh = smallWaves(p, uTime, pf, chopScale, sg);
  float surfY = uTide + sw.eta + sh;
  float thick = surfY - gt.x;
  if (thick <= 0.0004) discard;

  vec2 gH = sw.grad + sg;
  float farK = smoothstep(200.0, 2400.0, dist);
  gH *= 1.0 - 0.75*farK;
  vec3 N = normalize(vec3(-gH.x, 1.0, -gH.y));
  vec3 P = vec3(p.x, surfY, p.y);
  vec4 fs = foamTex(p);
  float fa = foamAlpha(p, fs.r);
  vec3 sig = absorbCoef();
  vec3 col;
  float alphaOut = smoothstep(0.0, 0.03, thick);

  if (uUnder < 0.5) {
    float NdV = max(dot(N, V), 0.002);
    float F = 0.02 + 0.98*pow(1.0 - NdV, 5.0);
    vec3 R = reflect(-V, N);
    R.y = abs(R.y);
    vec3 sky = skyRadiance(R, 0.0);
    // sun glitter
    vec3 Hh = normalize(V + uSunDir);
    float NdH = max(dot(N, Hh), 0.0);
    float NdL = max(dot(N, uSunDir), 0.0);
    float rough = 0.016 + 0.35*clamp(pf*0.6, 0.0, 1.0)*(1.0 + 0.2*farK) + 0.05*farK;
    float Fs = 0.02 + 0.98*pow(1.0 - max(dot(Hh, V), 0.0), 5.0);
    vec3 spec = uSunCol*ggx(NdH, rough)*Fs*0.25*NdL/max(NdV, 0.06);
    spec *= 0.014;
    // refraction → sea bed
    vec3 T = refract(-V, N, 1.0/1.333);
    vec3 hit; float ok;
    float L = marchBed(P, normalize(T), hit, ok);
    vec3 trans = exp(-sig*L);
    vec3 body = bodyColor()*waterLight();
    vec3 inscat = body*(1.0 - exp(-L*vec3(0.11, 0.13, 0.15)*(1.0 + uTurb)));
    vec3 refr;
    if (ok > 0.5) refr = bedShade(hit, surfY, pf)*trans + inscat;
    else refr = inscat + body*0.35*trans;
    // a little translucent glow in thin crests
    float crest = smoothstep(0.55, 1.0, sw.brk);
    refr += body*crest*0.6;
    col = refr*(1.0 - F) + sky*F + spec;
    // foam
    vec3 fcol = foamColor()*(0.8 + 0.2*NdL);
    float direct = smoothstep(0.07, 0.3, sw.brk)*(0.35 + 0.9*fbm3(p*2.6 + vec2(0.0, uTime*0.05)))*smoothstep(0.35, 0.8, vnoise(p*5.0 + 3.0) + 0.4*sw.brk);
    fa = max(fa, clamp(direct, 0.0, 1.0));
    col = mix(col, fcol, fa*0.93);
    col = applyHaze(col, dist);
  } else {
    // seen from below: Snell's window, total internal reflection, bubbles
    vec3 Nd = -N;
    vec3 Vv = -V;                      // ray direction going up toward the surface
    float cosI = max(dot(Vv, N), 0.0);
    float F = 0.02 + 0.98*pow(1.0 - cosI, 5.0);
    vec3 Tt = refract(Vv, Nd, 1.333);
    float tir = dot(Tt, Tt) < 0.001 ? 1.0 : 0.0;
    float distCam = dist;
    vec3 trans = exp(-sig*distCam);
    vec3 body = bodyColor()*waterLight()*exp(-sig*max(vWorld.y - uCamPos.y, 0.0)*0.0);
    vec3 inscat = body*(1.0 - exp(-distCam*vec3(0.11, 0.13, 0.15)*(1.0 + uTurb)));
    // reflected (mirror of sea bed)
    vec3 R = reflect(Vv, Nd);
    vec3 hit; float ok;
    R.y = -abs(R.y);
    float L = marchBed(P, normalize(R), hit, ok);
    vec3 refl;
    vec3 trR = exp(-sig*L);
    vec3 inR = body*(1.0 - exp(-L*vec3(0.11, 0.13, 0.15)*(1.0 + uTurb)));
    refl = (ok > 0.5 ? bedShade(hit, surfY, pf)*trR : vec3(0.0)) + inR;
    vec3 win = vec3(0.0);
    if (tir < 0.5) {
      vec3 dir = normalize(Tt);
      win = skyRadiance(dir, 1.0);
      // shoreline / dunes through the window: march the height field
      float tt = 2.0; bool landHit = false;
      for (int i=0;i<18;i++){
        vec3 q = P + dir*tt;
        if (q.y < groundTex(q.xz).x) { landHit = true; break; }
        tt *= 1.28;
      }
      if (landHit) win = mix(vec3(0.62,0.52,0.38)*(uSunCol*max(dir.y,0.15)*0.6 + uSkyAmb*0.7), hazeCol(), 1.0 - exp(-tt*0.003));
    }
    vec3 beyond = tir > 0.5 ? refl : mix(win, refl, F);
    col = beyond*trans + inscat;
    vec3 fcol = foamColor()*0.85;
    col = mix(col, fcol*trans + inscat*0.6, fa*0.55);
  }
  gl_FragColor = vec4(col, alphaOut);
}
`;

// ---------------------------------------------------------------- terrain
export const terrainVert = /* glsl */ `
attribute vec3 aInfo;
varying vec3 vPos;
varying vec3 vNrm;
varying vec3 vInfo;
void main(){
  vPos = position; vNrm = normal; vInfo = aInfo;
  gl_Position = projectionMatrix*viewMatrix*vec4(position, 1.0);
}
`;

export const terrainFrag = (common) => /* glsl */ `
${common}
uniform float uWetSand;
uniform float uDebug;
varying vec3 vPos;
varying vec3 vNrm;
varying vec3 vInfo;
void main(){
  vec3 P = vPos;
  vec3 toCam = uCamPos - P;
  float dist = length(toCam);
  vec3 V = toCam/dist;
  float depth = uTide - P.y;
  if (uUnder < 0.5 && depth > 1.7) discard;

  vec3 N = normalize(vNrm);
  float rockM = max(vInfo.y, smoothstep(0.62, 0.42, N.y));
  float veg = vInfo.z*(1.0 - rockM);
  float fadeD = 1.0/(1.0 + dist*0.06);

  // wet history + water film
  SwellS sw = swellField(P.xz, uTime);
  float film = uTide + sw.eta - P.y;
  vec4 fs = foamTex(P.xz);
  float wet = max(fs.g, smoothstep(-0.03, 0.01, film))*uWetSand;
  wet = clamp(wet*(0.9 + 0.2*vnoise(P.xz*0.9)), 0.0, 1.0);
  wet = max(wet, smoothstep(-0.05, 0.4, depth));    // sea bed is always wet

  vec3 sand = sandAlbedo(P.xz);
  float nGrass = fbm3(P.xz*0.4);
  vec3 grass = mix(vec3(0.26,0.31,0.12), vec3(0.50,0.46,0.20), nGrass);
  float nRock = fbm4(P.xz*0.55);
  vec3 rock = mix(vec3(0.27,0.24,0.21), vec3(0.46,0.41,0.35), nRock);
  vec3 alb = mix(sand, grass, clamp(veg*1.2, 0.0, 1.0));
  alb = mix(alb, rock, rockM);
  float sandW = (1.0 - rockM)*(1.0 - veg);

  N = sandNormal(P.xz, N, fadeD*sandW*exp(-max(depth, 0.0)*0.25), wet);
  float dark = mix(1.0, 0.56, wet*(1.0 - 0.6*rockM));
  alb *= dark;
  alb = mix(vec3(dot(alb, vec3(0.333))), alb, 1.0 + 0.25*wet);

  float NL = max(dot(N, uSunDir), 0.0);
  vec3 direct = uSunCol*NL;
  vec3 amb = skyAmbient(N);
  vec3 col;
  if (uUnder > 0.5 && depth > 0.0) {
    vec3 sig = absorbCoef();
    float H = depth;
    float C = causticAt(P.xz, H, dist*uPixelAng*1.4);
    direct = uSunCol*NL*exp(-sig*H/sunUnderCos())*C;
    amb = skyAmbient(N)*exp(-sig*H*0.9)*0.9;
  }
  col = alb*(direct + amb);

  // wet sheen: reflection of sky + sun on damp sand
  if (uUnder < 0.5) {
    float NdV = max(dot(N, V), 0.001);
    float F = (0.03 + 0.97*pow(1.0 - NdV, 5.0))*wet*(1.0 - rockM*0.7);
    vec3 R = reflect(-V, N); R.y = abs(R.y);
    vec3 sky = skyRadiance(R, 0.0);
    float rough = mix(0.5, 0.09, smoothstep(0.0, 0.03, film)*0.7 + 0.3*wet);
    vec3 Hh = normalize(V + uSunDir);
    float sp = ggx(max(dot(N, Hh), 0.0), rough)*0.25*NL/max(NdV, 0.1);
    col += sky*F*0.45 + uSunCol*sp*F*0.04;
  }

  // foam left on the sand
  float fa = foamAlpha(P.xz, fs.r)*step(film, 0.002);
  col = mix(col, foamColor()*(0.85 + 0.15*NL), fa*0.9*(1.0 - rockM*0.5));

  if (uUnder > 0.5) {
    vec3 sig = absorbCoef();
    vec3 trans = exp(-sig*dist);
    vec3 body = bodyColor()*waterLight();
    vec3 inscat = body*(1.0 - exp(-dist*vec3(0.11, 0.13, 0.15)*(1.0 + uTurb)));
    col = col*trans + inscat;
  } else {
    col = applyHaze(col, dist);
  }
  if (uDebug > 0.5) col = uDebug < 1.5 ? vec3(wet) : uDebug < 2.5 ? vec3(fs.r) : vec3(fa, clamp(film*5.0,0.0,1.0), 0.0);
  gl_FragColor = vec4(col, 1.0);
}
`;

// ---------------------------------------------------------------- foam / wetness simulation
export const quadVert = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = position.xy*0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

export const simFrag = (common) => /* glsl */ `
${common}
uniform sampler2D uPrev;
uniform float uDt;
uniform float uFoamGain;
uniform float uShoreFoam;
uniform float uPersist;
uniform float uDryTime;
uniform float uFoamMax;
uniform float uInit;
varying vec2 vUv;
void main(){
  vec2 p = uFDom.xy + vUv/uFDom.zw;
  vec4 gt = groundTex(p);
  SwellS sw = swellField(p, uTime);
  float w = uTide + sw.eta - gt.x;
  vec2 u = sw.flow;
  // backwash: thin receding sheets run down the slope
  if (w > 0.0 && w < 0.7 && sw.detdt < 0.0) {
    vec2 sl = gt.yz;
    float sm = length(sl);
    vec2 down = sm > 1e-3 ? -sl/sm : vec2(0.0, 1.0);
    u += down*min(1.3, sqrt(9.81*max(w, 0.03))*0.9)*smoothstep(0.0, 0.1, w);
  }
  vec2 pp = p - u*uDt;
  vec2 uvp = (pp - uFDom.xy)*uFDom.zw;
  vec4 s = texLin(uPrev, uvp, FSIZE);
  vec2 px = 1.0/FSIZE;
  float nb = 0.25*(texLin(uPrev, vUv + vec2(px.x, 0.0), FSIZE).r + texLin(uPrev, vUv - vec2(px.x, 0.0), FSIZE).r
                 + texLin(uPrev, vUv + vec2(0.0, px.y), FSIZE).r + texLin(uPrev, vUv - vec2(0.0, px.y), FSIZE).r);
  float foam = mix(s.r, nb, clamp(uDt*3.0, 0.0, 0.5));
  float onLand = w <= 0.002 ? 1.0 : 0.0;
  float tauW = mix(1.4, 7.0, uPersist);
  float tauL = mix(2.0, 14.0, uPersist);
  float deep = smoothstep(2.5, 9.0, uTide - gt.x);
  float tau = mix(tauW, tauL, onLand)*mix(1.0, 0.3, deep);
  foam *= exp(-uDt/tau);
  foam -= uDt*0.004;
  // spawn: breaking crests, then bore fronts running up the beach
  float clump = smoothstep(0.3, 0.75, vnoise(p*vec2(0.22, 0.3) + vec2(0.0, uTime*0.03)));
  float sp = sw.brk*uFoamGain*0.9*(0.25 + 1.1*clump)*(0.6 + 0.8*vnoise(p*1.3));
  float front = (w > 0.0 && w < 0.08 && sw.detdt > 0.0) ? (1.0 - w/0.08) : 0.0;
  sp += front*0.6*uShoreFoam*(0.4 + 0.9*vnoise(p*1.7 + vec2(0.0, uTime*0.1)));
  sp += sw.brk*0.0;
  foam += uDt*sp;
  foam = clamp(foam, 0.0, uFoamMax);

  float wetNow = smoothstep(-0.05, 0.02, w);
  float dry = uDt/(uDryTime*mix(0.6, 1.5, vnoise(p*0.18)));
  float wet = max(s.g - dry, wetNow);
  if (uInit > 0.5) {
    float uu = gt.w;
    wet = max(wet, smoothstep(-9.0, -0.5, uu)*0.85);
  }
  gl_FragColor = vec4(foam, wet, 0.0, 1.0);
}
`;
