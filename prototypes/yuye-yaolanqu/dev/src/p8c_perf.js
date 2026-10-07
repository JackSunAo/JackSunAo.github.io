/* ===== P8c performance: 60 frames a second on your own machine, without the picture getting any worse =====
   The way games do it: what never moves is drawn in a handful of calls and its shadows are drawn once; every frame only
   what moves is drawn into the shadow maps; characters are skinned meshes (p3); the quality level fits the machine and
   is picked before the fight, not in the middle of it */
renderer.info.autoReset = false;       // counted per frame, across the shadow passes and the post passes
renderer.shadowMap.autoUpdate = false; // three's own shadow step is replaced below

/* ---------------- what never moves ---------------- */
const VIS_ROOTS = new Set([roofG]); wallSets.forEach(w => { VIS_ROOTS.add(w.full); VIS_ROOTS.add(w.cut); });
const CUT_ROOTS = new Set(wallSets.map(w => w.cut)); // the low walls of the cutaway stand inside the full ones: the full wall throws their shadow
const DYNAMIC = new Set([door.pivot, barMesh, rock, mobile, porchRoof, drip, ripple, glass, flame, flame2, trail, beam, moonBeam, clouds,
  ...sheets, ...ripplePool, ...streaks, ...decals, ...sRings.map(s => s.m), ...fogLayers, ...winLeft.boards.map(b => b.m), ...defenders.map(d => d.ring), ...Object.values(postRings).map(r => r.m)]);
const STATIC = [], STATIC_NODES = new Set();
(function findStatic() {
  const walk = (o, vr) => {
    if (DYNAMIC.has(o) || o.userData.human) return;
    if (VIS_ROOTS.has(o)) vr = o;
    if (o.isMesh) { STATIC.push({ m: o, vr, cast: o.castShadow }); for (let a = o; a && a !== scene; a = a.parent) STATIC_NODES.add(a); } // the mesh and the groups holding it, nothing else
    for (const k of o.children) walk(k, vr);
  };
  scene.updateMatrixWorld(true); walk(scene, scene);
})();

// many meshes → one geometry, in the space given by `inv`
const _bm = new THREE.Matrix4(), _bn = new THREE.Matrix3(), _bv = new V3(), IDENT = new THREE.Matrix4();
// sides (shadow batches only): 'front' once, 'double' once each way round, 'back' inside out; one-sided depth then draws them all as three would
function mergeMeshes(list, inv, withNormal, withUV, sides) {
  if (sides) { const l2 = []; for (const m of list) { const sd = sides(m); if (sd !== 'back') l2.push(m); if (sd !== 'front') l2.push({ rev: m }); } list = l2; }
  let nv = 0, ni = 0; for (const it of list) { const g = (it.rev || it).geometry; nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = withNormal ? new Float32Array(nv * 3) : null, uv = withUV ? new Float32Array(nv * 2) : null, ix = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  let v = 0, k = 0;
  for (const it of list) {
    const m = it.rev || it, g = m.geometry, P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, I = g.index;
    _bm.multiplyMatrices(inv, m.matrixWorld); _bn.getNormalMatrix(_bm); const flip = (_bm.determinant() < 0) !== !!it.rev;
    for (let j = 0; j < P.count; j++) {
      const o = v + j; _bv.fromBufferAttribute(P, j).applyMatrix4(_bm); pos[o * 3] = _bv.x; pos[o * 3 + 1] = _bv.y; pos[o * 3 + 2] = _bv.z;
      if (nor) { if (N) _bv.fromBufferAttribute(N, j).applyMatrix3(_bn).normalize(); else _bv.set(0, 1, 0); nor[o * 3] = _bv.x; nor[o * 3 + 1] = _bv.y; nor[o * 3 + 2] = _bv.z; }
      if (uv && U) { uv[o * 2] = U.getX(j); uv[o * 2 + 1] = U.getY(j); }
    }
    const n = I ? I.count : P.count;
    for (let j = 0; j < n; j += 3) { const a = (I ? I.getX(j) : j) + v, b = (I ? I.getX(j + 1) : j + 1) + v, c = (I ? I.getX(j + 2) : j + 2) + v; ix[k++] = a; ix[k++] = flip ? c : b; ix[k++] = flip ? b : c; }
    v += P.count;
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  if (nor) geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); if (uv) geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(ix, 1)); geo.computeBoundingSphere(); return geo;
}
const cellOf = (c, size) => insideCabin(c.x, c.z) ? 'in' : Math.floor(c.x / size) + ',' + Math.floor(c.z / size);
const _cc = new V3();
function worldCenter(m) { const g = m.geometry; if (!g.boundingSphere) g.computeBoundingSphere(); return _cc.copy(g.boundingSphere.center).applyMatrix4(m.matrixWorld); }

// the picture: everything static and opaque, one draw per look per part of the yard
const BATCHES = [], HIDDEN = [];
(function batchStatic() {
  // the same look under another name draws together; plain colours that differ only in colour draw together too, the colour moving into the vertices
  const plain = m => m.type === 'MeshStandardMaterial' && !m.map && !m.bumpMap && m.emissive.getHex() === 0 && !m.transparent && !m.vertexColors;
  const key = m => plain(m) ? ['tint', m.roughness, m.metalness, m.side, m.flatShading, m.fog].join('|') : m.uuid;
  const groups = new Map();
  for (const S of STATIC) {
    const m = S.m, mat = m.material;
    if (Array.isArray(mat) || m.children.length || !m.visible || m.renderOrder) continue;
    if (mat.colorWrite === false) { m.visible = false; HIDDEN.push(m); continue; } // a stand-in that only throws shadow: its shadow is in the static batch
    const cell = mat.transparent ? cellOf(worldCenter(m), 3) : S.vr === scene ? cellOf(worldCenter(m), 10) : 'all'; // see-through things stay where they sort
    const k = S.vr.id + '/' + key(mat) + '/' + m.receiveShadow + '/' + cell;
    let G = groups.get(k); if (!G) groups.set(k, G = { vr: S.vr, mat, recv: m.receiveShadow, list: [], tint: plain(mat) }); G.list.push(m);
  }
  for (const G of groups.values()) {
    if (G.list.length < 2) continue;
    const allUV = G.list.every(m => m.geometry.attributes.uv); if (!allUV && (G.mat.map || G.mat.bumpMap)) continue;
    const colours = new Set(G.list.map(m => m.material.color.getHex()));
    let mat = G.mat, geo = mergeMeshes(G.list, G.vr.matrixWorld.clone().invert(), true, allUV);
    if (G.tint && colours.size > 1) { // white × the vertex colour = the colour it had
      mat = G.mat.clone(); mat.color.set(0xffffff); mat.vertexColors = true;
      const col = new Float32Array(geo.attributes.position.count * 3); let v = 0;
      for (const m of G.list) { const c = m.material.color, n = m.geometry.attributes.position.count; for (let j = 0; j < n; j++, v++) { col[v * 3] = c.r; col[v * 3 + 1] = c.g; col[v * 3 + 2] = c.b; } }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    }
    const b = new THREE.Mesh(geo, mat);
    b.receiveShadow = G.recv; b.matrixAutoUpdate = false; b.userData.batch = G.list.length; G.vr.add(b); b.updateMatrixWorld(true);
    for (const m of G.list) { m.visible = false; HIDDEN.push(m); }
    BATCHES.push(b);
  }
})();

// the shadows: everything static that throws one, whatever it looks like, in a few depth-only batches kept out of the scene
const SHADOW_STATIC = new THREE.Scene(); SHADOW_STATIC.matrixWorldAutoUpdate = false;
const _sideMats = {};
function depthStandIn(side, shadowSide) { const k = side + '/' + shadowSide; return _sideMats[k] || (_sideMats[k] = new THREE.MeshBasicMaterial({ side, shadowSide })); }
(function batchStaticShadows() {
  const groups = new Map();
  for (const S of STATIC) {
    const m = S.m; if (!m.castShadow) continue; m.castShadow = false;
    let cut = false; for (let o = m; o; o = o.parent) if (CUT_ROOTS.has(o)) { cut = true; break; } if (cut) continue;
    const mt = Array.isArray(m.material) ? m.material[0] : m.material, odd = mt.shadowSide !== null; // a material with its own shadow side keeps it
    const k = cellOf(worldCenter(m), 6) + (odd ? '/' + mt.side + '/' + mt.shadowSide : '');
    let G = groups.get(k); if (!G) groups.set(k, G = { odd, side: mt.side, shadowSide: mt.shadowSide, list: [] }); G.list.push(m);
  }
  const sideOf = m => { const sd = (Array.isArray(m.material) ? m.material[0] : m.material).side; return sd === THREE.DoubleSide ? 'double' : sd === THREE.BackSide ? 'back' : 'front'; };
  for (const G of groups.values()) {
    const b = G.odd ? new THREE.Mesh(mergeMeshes(G.list, IDENT, false, false), depthStandIn(G.side, G.shadowSide)) : new THREE.Mesh(mergeMeshes(G.list, IDENT, false, false, sideOf), depthStandIn(THREE.FrontSide, null));
    b.castShadow = true; b.matrixAutoUpdate = false; SHADOW_STATIC.add(b);
  }
  SHADOW_STATIC.updateMatrixWorld(true);
})();
// nothing static needs its matrix worked out again every frame
for (const o of STATIC_NODES) o.matrixAutoUpdate = false;
// and what is drawn through a batch leaves the scene graph altogether: three walks a third of the nodes it used to, every frame
const DETACHED = [];
(function detachDrawnElsewhere() {
  const hid = new Set(HIDDEN);
  const empty = o => (o.isMesh ? hid.has(o) : !o.isLight && !o.isSprite && !o.isPoints && !o.isLine && STATIC_NODES.has(o) && !VIS_ROOTS.has(o)) && o.children.every(empty);
  const walk = o => { for (const k of o.children.slice()) { if (empty(k)) { DETACHED.push({ o: k, p: o }); o.remove(k); } else walk(k); } };
  walk(scene);
})();
// a check for the bench: has anything that was taken for static moved, shown itself or changed since?
const STATIC_SNAP = [...STATIC_NODES].map(o => ({ o, p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() }));
function checkStatic() {
  const bad = [];
  for (const S of STATIC_SNAP) { const o = S.o; if (!o.position.equals(S.p) || !o.quaternion.equals(S.q) || !o.scale.equals(S.s)) bad.push('moved: ' + (o.name || o.type) + ' @' + o.getWorldPosition(new V3()).toArray().map(x => x.toFixed(2)).join(',')); }
  for (const m of HIDDEN) if (m.visible && !PERF.ref) bad.push('shown: ' + m.geometry.type + ' @' + m.getWorldPosition(new V3()).toArray().map(x => x.toFixed(2)).join(','));
  return bad;
}

/* ---------------- what moves, in as few draws as it can ---------------- */
// a rigid group (the door leaf, the rocking chair, the mobile) throws one merged shadow; rebuilt only when its parts change
const PROXIES = [];
function shadowProxy(group, members, sig) { const X = { group, members, sig, key: null, list: [], meshes: [] }; PROXIES.push(X); return X; }
function proxyBegin(X) {
  const k = X.sig();
  if (k !== X.key) { // rebuild: one merged mesh per face rule (one-sided, two-sided), in the group's own space
    X.key = k; for (const m of X.meshes) { X.group.remove(m); m.geometry.dispose(); } X.meshes = [];
    X.list = X.members().filter(m => m.castShadow && !m.userData.proxy && m.geometry.attributes.position);
    const by = new Map(), inv = X.group.matrixWorld.clone().invert();
    for (const m of X.list) { const mt = depthStandIn(m.material.side, m.material.shadowSide); if (!by.has(mt)) by.set(mt, []); by.get(mt).push(m); }
    for (const [mt, list] of by) { const pm = new THREE.Mesh(mergeMeshes(list, inv, false, false), mt); pm.castShadow = true; pm.visible = false; pm.matrixAutoUpdate = false; pm.userData.proxy = true; X.group.add(pm); pm.updateMatrixWorld(true); X.meshes.push(pm); }
  }
  for (const m of X.list) m.castShadow = false; for (const m of X.meshes) m.visible = true;
}
function proxyEnd(X) { for (const m of X.list) m.castShadow = true; for (const m of X.meshes) m.visible = false; }
{
  const broken = new Set();
  shadowProxy(door.leaf, () => { broken.clear(); for (const col of door.segs) for (const s of col) if (s.broken) broken.add(s.m);
      const out = []; door.leaf.traverse(o => { if (!o.isMesh || o.userData.proxy || o.userData.batchMesh) return; for (let a = o; a && a !== door.leaf; a = a.parent) if (broken.has(a)) return; out.push(o); }); return out; },
    () => { let k = door.leaf.children.length; for (const col of door.segs) for (const s of col) k = k * 3 + (s.broken ? 1 : 0) + s.m.children.length * 7; return k; }); // a hole in the door lets the light through
  shadowProxy(rock, () => rock.children.filter(m => m.isMesh), () => 1);
  shadowProxy(mobile, () => mobile.children.filter(m => m.isMesh), () => 1);
}
function rigs() { const a = [P.h, mother.h]; for (const d of defenders) a.push(d.h); for (const e of infected) if (e.h) a.push(e.h); return a; }

/* ---------------- small things that move together: one draw per look, rebuilt only when they change ---------------- */
// the members stay where the game keeps them (it still moves, hides and breaks them); they are just not drawn themselves
const BLAYER = SKIN_LAYER;
function chainVisible(m, root) { for (let o = m; o && o !== root; o = o.parent) if (!o.visible) return false; return true; }
function trsHash(h, m, root) { // the member's place inside the root, folded into 32 bits
  for (let o = m; o && o !== root; o = o.parent) {
    const p = o.position, q = o.quaternion, c = o.scale;
    for (const v of [p.x, p.y, p.z, q.x, q.y, q.z, q.w, c.x, c.y, c.z]) h = Math.imul(h ^ Math.round(v * 8192), 16777619) >>> 0;
  }
  return h;
}
class RigidBatch {
  constructor(root, opts = {}) { this.root = root; this.opts = opts; this.sig = -1; this.meshes = []; this.shadows = []; this.solo = []; }
  members() { const out = [], skip = this.opts.skip; this.root.traverse(o => { if (o.isMesh && !o.isSkinnedMesh && !o.userData.rigNode && !o.userData.proxy && !o.userData.batchMesh && !o.userData.vol && !(skip && skip(o))) out.push(o); }); return out; }
  update() {
    const list = this.members(); let h = 2166136261 ^ list.length;
    for (const m of list) {
      const t = trsHash(2166136261, m, this.root), vis = chainVisible(m, this.root);
      if (m.userData.trs !== undefined && m.userData.trs !== t) { m.userData.moved = (m.userData.moved || 0) + 1; if (m.userData.moved > 2) { m.userData.vol = true; this.sig = -1; } } else m.userData.moved = 0;
      m.userData.trs = t; h = Math.imul(h ^ t ^ (vis ? 1 : 2) ^ m.id, 16777619) >>> 0;
    }
    if (h !== this.sig) { this.sig = h; this.rebuild(list.filter(m => !m.userData.vol)); }
  }
  rebuild(list) {
    for (const m of this.meshes.concat(this.shadows)) { if (m.parent) m.parent.remove(m); m.geometry.dispose(); }
    for (const m of list.concat(this.solo)) if (m.userData.batched) { m.layers.set(0); m.userData.batched = false; }
    this.meshes = []; this.shadows = []; this.solo = [];
    const inv = this.root.matrixWorld.clone().invert(), byMat = new Map(), byFace = new Map();
    for (const m of list) {
      if (!chainVisible(m, this.root)) continue;
      const mt = m.material; if (Array.isArray(mt)) continue;
      if (!byMat.has(mt)) byMat.set(mt, []); byMat.get(mt).push(m);
      if (m.castShadow && this.opts.shadow !== false) { const sm = depthStandIn(mt.side, mt.shadowSide); if (!byFace.has(sm)) byFace.set(sm, []); byFace.get(sm).push(m); }
    }
    for (const [mt, ms] of byMat) {
      if (ms.length < 2) { this.solo.push(...ms); continue; }
      const uv = ms.every(m => m.geometry.attributes.uv); if (!uv && (mt.map || mt.bumpMap)) { this.solo.push(...ms); continue; }
      const b = new THREE.Mesh(mergeMeshes(ms, inv, true, uv), mt); b.receiveShadow = ms[0].receiveShadow; b.renderOrder = ms[0].renderOrder; b.matrixAutoUpdate = false; b.userData.batchMesh = true;
      this.root.add(b); b.updateMatrixWorld(true); this.meshes.push(b);
      for (const m of ms) { m.layers.set(BLAYER); m.userData.batched = true; }
    }
    if (this.opts.shadow !== false) for (const [sm, ms] of byFace) {
      const b = new THREE.Mesh(mergeMeshes(ms, inv, false, false), sm); b.castShadow = true; b.visible = false; b.matrixAutoUpdate = false; b.userData.batchMesh = b.userData.proxy = true;
      this.root.add(b); b.updateMatrixWorld(true); this.shadows.push(b);
    }
  }
  // during the shadow passes: the merged shadows stand in for every member that throws one
  begin() { for (const b of this.shadows) b.visible = true; for (const m of this.solo) if (m.castShadow) { m.userData.cast0 = true; m.castShadow = false; } }
  end() { for (const b of this.shadows) b.visible = false; for (const m of this.solo) if (m.userData.cast0) { m.castShadow = true; m.userData.cast0 = false; } }
}
// what each body carries (weapons, the lantern, the torch, the baby, a shawl, a stump) is found by looking for what isn't part of the rig
function gearOf(h) {
  if (h.gear && PERF.frame - h.gearT < 30) return h.gear;
  const roots = new Set();
  h.root.traverse(o => { if (o.userData.rigNode || o.isSkinnedMesh || o.userData.batchMesh || o.isLight || o.isSprite) return; if (o.parent && o.parent.userData.rigNode) roots.add(o.isMesh ? o.parent : o); });
  h.gear = [...roots].map(r => r.userData.rb || (r.userData.rb = new RigidBatch(r, r.userData.rigNode ? { skip: o => o.parent !== r } : {}))); h.gearT = PERF.frame; return h.gear;
}
// the door: its planks, battens, straps, cuts and splinters, drawn per look; its shadow is the door proxy's (holes count, the cutaway doesn't)
const DOOR_RB = new RigidBatch(door.leaf, { shadow: false });
// the rocking chair and the mobile (their shadows are proxies already), and each board nailed over a window
const MOVERS = [new RigidBatch(rock, { shadow: false, skip: o => { for (let a = o; a && a !== rock; a = a.parent) if (a.userData.human) return true; return false; } }), new RigidBatch(mobile, { shadow: false })];
function boardBatches() { const out = []; for (const w of [winBack, winLeft]) for (const b of w.boards) out.push(b.m.userData.rb || (b.m.userData.rb = new RigidBatch(b.m))); return out; }

/* things that move every frame (blood on the ground, rain on the glass, ripples in the puddles): one geometry, rewritten each frame */
class DynBatch {
  constructor(parent, members, mat, alpha) {
    this.parent = parent; this.members = members; this.alpha = alpha; let nv = 0, ni = 0;
    for (const m of members) { const g = m.geometry; nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
    const geo = new THREE.BufferGeometry(), ix = new Uint16Array(ni);
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nv * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nv * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(nv * 2), 2));
    if (alpha) geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(nv * 4).fill(1), 4).setUsage(THREE.DynamicDrawUsage));
    let v = 0, k = 0; this.offs = [];
    for (const m of members) { const g = m.geometry, P = g.attributes.position, U = g.attributes.uv, I = g.index; this.offs.push(v);
      for (let j = 0; j < P.count; j++) { if (U) { geo.attributes.uv.array[(v + j) * 2] = U.getX(j); geo.attributes.uv.array[(v + j) * 2 + 1] = U.getY(j); } }
      const n = I ? I.count : P.count; for (let j = 0; j < n; j++) ix[k++] = (I ? I.getX(j) : j) + v; v += P.count;
      m.layers.set(BLAYER); m.userData.batched = true; }
    geo.setIndex(new THREE.BufferAttribute(ix, 1));
    this.mesh = new THREE.Mesh(geo, mat); this.mesh.frustumCulled = false; this.mesh.receiveShadow = members[0].receiveShadow; this.mesh.renderOrder = members[0].renderOrder; this.mesh.userData.batchMesh = true; this.mesh.matrixAutoUpdate = false;
    parent.add(this.mesh);
  }
  update() {
    const g = this.mesh.geometry, pos = g.attributes.position.array, nor = g.attributes.normal.array, col = this.alpha ? g.attributes.color.array : null;
    _bm.copy(this.parent.matrixWorld).invert(); const inv = _bm.clone(); let any = false;
    this.members.forEach((m, i) => {
      const P = m.geometry.attributes.position, N = m.geometry.attributes.normal, o = this.offs[i], on = chainVisible(m, this.parent);
      if (!on) { for (let j = 0; j < P.count; j++) { pos[(o + j) * 3] = pos[(o + j) * 3 + 1] = pos[(o + j) * 3 + 2] = 0; } return; }
      any = true; _dynM.multiplyMatrices(inv, m.matrixWorld); _bn.getNormalMatrix(_dynM);
      for (let j = 0; j < P.count; j++) {
        const q = (o + j) * 3; _bv.fromBufferAttribute(P, j).applyMatrix4(_dynM); pos[q] = _bv.x; pos[q + 1] = _bv.y; pos[q + 2] = _bv.z;
        _bv.fromBufferAttribute(N, j).applyMatrix3(_bn).normalize(); nor[q] = _bv.x; nor[q + 1] = _bv.y; nor[q + 2] = _bv.z;
        if (col) col[(o + j) * 4 + 3] = this.alpha(m);
      }
    });
    this.mesh.visible = any; g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true; if (col) g.attributes.color.needsUpdate = true;
  }
}
const _dynM = new THREE.Matrix4();
const DYN = [new DynBatch(scene, decals, decalMat), new DynBatch(win, streaks, streakMat)];
{ const rm = ripplePool[0].material.clone(); rm.vertexColors = true; rm.opacity = 1; DYN.push(new DynBatch(scene, ripplePool, rm, m => m.material.opacity)); }
DYN[0].mesh.renderOrder = DYN[2].mesh.renderOrder = 1; // blood and ripples lie on top of the puddles, whichever is nearer the camera

/* ---------------- shadows: drawn once for what never moves, every frame for what does ---------------- */
// a light that never moves keeps its static shadow in a cache; each frame the cache is copied in and only what moves is drawn on top
const SHADOWS = [
  { key: 'moon', light: moonLight, fixed: true },
  { key: 'flood', light: floodLight, fixed: true, when: () => floodLight.intensity > 0.02 },
  { key: 'candle', light: candleLight, fixed: true },
  { key: 'lantern', light: P.lantern.userData.light, when: () => P.lantern.userData.light.intensity > 0.1 },
  { key: 'torch', light: P.spot, when: () => P.spot.intensity > 0.05 }
];
SHADOWS.forEach((S, i) => { S.every = 1; S.phase = i & 1; S.cache = null; S.cacheOK = false; S.light.userData.key = S.key; });
const CAN_CACHE = renderer.capabilities.isWebGL2, CLEAR = renderer.clear, NO_CLEAR = () => {};
function blitFrom(S) { // stands in for the shadow map's clear: the static shadow, copied in
  const gl = renderer.getContext(), st = renderer.state, props = renderer.properties;
  return () => { const src = S.cache, dst = renderer.getRenderTarget(); st.bindFramebuffer(gl.READ_FRAMEBUFFER, props.get(src).__webglFramebuffer); gl.blitFramebuffer(0, 0, src.width, src.height, 0, 0, dst.width, dst.height, gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT, gl.NEAREST); st.bindFramebuffer(gl.READ_FRAMEBUFFER, null); };
}
SHADOWS.forEach(S => { S.blit = blitFrom(S); });
const SM = renderer.shadowMap, SM_RENDER = SM.render;
function shadowPass(S, root, clear) {
  if (window.__I) window.__I.pass = 'sh-' + S.key; // the bench counts draws per light
  renderer.clear = clear || CLEAR; SM.needsUpdate = true; SM_RENDER.call(SM, [S.light], root, camera); renderer.clear = CLEAR;
  if (window.__I) window.__I.pass = 'main';
}
function refreshCache(S) {
  const sh = S.light.shadow; if (!sh.map) shadowPass(S, SHADOW_STATIC);
  if (!S.cache || S.cache.width !== sh.map.width || S.cache.height !== sh.map.height) { if (S.cache) S.cache.dispose(); S.cache = new THREE.WebGLRenderTarget(sh.map.width, sh.map.height, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter }); }
  const live = sh.map; sh.map = S.cache; shadowPass(S, SHADOW_STATIC); sh.map = live; S.cacheOK = true;
}
// what moves and throws a shadow, gathered once a frame: every shadow pass walks this short list, not the whole scene graph
const CAST = [], CAST_ROOT = { visible: true, layers: camera.layers, isMesh: false, isLine: false, isPoints: false, children: CAST }, NO_KIDS = { value: [] };
function gatherCasters(o) {
  if (!o.visible) return;
  if (o.isMesh && o.castShadow && o.layers.test(camera.layers)) CAST.push(o.userData.shp || (o.userData.shp = Object.create(o, { children: NO_KIDS }))); // its children are gathered on their own
  const ch = o.children; for (let i = 0; i < ch.length; i++) gatherCasters(ch[i]);
}
function renderShadows() {
  const hs = rigs(), fr = renderer.info.render.frame;
  DOOR_RB.update(); for (const M of MOVERS) M.update(); for (const D of DYN) D.update();
  const gear = []; for (const h of hs) for (const rb of gearOf(h)) { rb.update(); rb.begin(); gear.push(rb); }
  for (const rb of boardBatches()) { rb.update(); rb.begin(); gear.push(rb); }
  for (const h of hs) { h.skel.update(); h.skel.frame = fr; for (const m of h.shadows) m.visible = true; } // posed from the parts as they are now, whatever three last saw
  for (const X of PROXIES) proxyBegin(X);
  CAST.length = 0; gatherCasters(scene);
  for (const S of SHADOWS) {
    if (S.when && !S.when()) { S.skipped = true; continue; }
    if (S.every > 1 && (PERF.frame + S.phase) % S.every && !S.skipped) continue;
    S.skipped = false;
    if (S.fixed && CAN_CACHE) { if (!S.cacheOK) refreshCache(S); shadowPass(S, CAST_ROOT, S.blit); }
    else { shadowPass(S, SHADOW_STATIC); shadowPass(S, CAST_ROOT, NO_CLEAR); }
  }
  for (const h of hs) for (const m of h.shadows) m.visible = false;
  for (const X of PROXIES) proxyEnd(X);
  for (const rb of gear) rb.end();
}

// three calls this inside its render, after the scene has been walked (skeletons posed) and before anything is drawn
SM.render = function (lights, sc, cam) { if (PERF.ref) return SM_RENDER.call(SM, lights, sc, cam); if (sc !== scene) return; if (PREWARM) prewarmShadows(); renderShadows(); };

/* ---------------- nothing is compiled, uploaded or allocated in the middle of a fight ---------------- */
// the driver compiles every program side by side instead of the page waiting on each one in turn
renderer.debug.checkShaderErrors = false;
let PREWARM = null;
(function prewarm() {
  const texs = new Set(); // every texture to the GPU now, not the first time it comes into view
  scene.traverse(o => { if (!o.material) return; for (const m of Array.isArray(o.material) ? o.material : [o.material]) for (const k of ['map', 'bumpMap', 'alphaMap', 'emissiveMap']) if (m[k]) texs.add(m[k]); });
  for (const t of texs) renderer.initTexture(t);
  renderer.compile(scene, camera); // every program the picture needs
  // the shadow programs: each kind of light × one-sided, two-sided, inside-out × rigid, skinned; drawn inside the first frame
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint16Array(12), 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(new Float32Array(12), 4));
  const root = new THREE.Group(), bone = new THREE.Bone(); root.add(bone);
  for (const side of [THREE.FrontSide, THREE.DoubleSide, THREE.BackSide]) {
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side })), sm = new THREE.SkinnedMesh(g, m.material);
    for (const x of [m, sm]) { x.castShadow = true; x.frustumCulled = false; root.add(x); } sm.bind(new THREE.Skeleton([bone]));
  }
  root.updateMatrixWorld(true); PREWARM = root;
})();
function prewarmShadows() { for (const S of SHADOWS) shadowPass(S, PREWARM); SHADOWS.forEach(S => { S.cacheOK = false; }); PREWARM = null; } // every shadow map allocated too (the torch's first switch-on stays smooth)

// the next wave is built ahead of time, one body every few frames while there is time to spare, off stage
const POOL = [];
function nextWave() { const need = {}; for (const t of waveTypes(G.wave + 1)) need[t] = (need[t] || 0) + 1; return need; }
function feedPool() {
  const need = nextWave(); for (const e of POOL) need[e.type]--;
  const type = Object.keys(need).find(t => need[t] > 0); if (!type) return false;
  const e = new Infected(type, 0, true); POOL.push(e);
  renderer.initTexture(e.h.atlas ? e.h.atlas.tex : e.h.skinMat.map); e.h.skel.computeBoneTexture(); renderer.initTexture(e.h.skel.boneTexture);
  return true;
}
function takePooled(type, ang) { const i = POOL.findIndex(e => e.type === type); if (i < 0) return null; const e = POOL.splice(i, 1)[0]; e.home = ang; e.h.root.visible = true; infected.push(e); return e; }
function perfIdle(busy) { // busy: this frame's work, in seconds
  if (G.mode !== 'play' || PERF.frame % 4) return;
  if (busy < 0.008 || (G.waveT > 0 && busy < 0.012)) feedPool();
}

/* ---------------- the plain way, for checking that the fast way looks the same ---------------- */
const PERF = { level: 2, auto: true, fps: 60, ms: 16.7, busy: 0, acc: 0, n: 0, busyAcc: 0, lowT: 0, calmT: 0, missN: 0, misses: [], stallN: 0, capLv: 4, settle: 3, show: false,
  frame: 0, calls: 0, tris: 0, samples: 4, hz: 60, probe: [], probeN: 0, ref: false, skip: 0, lastDraw: 0 };
function setReference(on) {
  PERF.ref = on; for (const d of DETACHED) { if (on) d.p.add(d.o); else d.p.remove(d.o); }
  for (const b of BATCHES) b.visible = !on; for (const m of HIDDEN) m.visible = on;
  for (const S of STATIC) S.m.castShadow = on ? S.cast : false;
  for (const h of rigs()) { for (const p of h.parts) if (!p.userData.skinOff) p.layers.set(on ? 0 : SKIN_LAYER); for (const s of h.skinned) s.visible = !on; }
  scene.traverse(o => { if (o.userData.batched) o.layers.set(on ? 0 : BLAYER); if (o.userData.batchMesh && !o.userData.proxy) o.visible = !on; });
  for (const D of DYN) D.mesh.visible = !on;
  SM.autoUpdate = on;
  if (!on) SHADOWS.forEach(S => { S.cacheOK = false; });
}

/* ---------------- quality levels ---------------- */
// shadows are cheap now; what a slower machine pays for is pixels: resolution, multisampling, bloom
// fsr: on a high-density screen, draw at the level's resolution and scale up to the screen's own pixels (EASU + RCAS) instead of letting the browser stretch it
const QUALITY = [
  { name: '最低', pr: 0.75, samples: 0, bloom: false, fsr: false, moon: [1024, 2], flood: [512, 2], candle: [256, 2], lantern: [256, 1], torch: [256, 1], rain: 0.4, cloth: 3 },
  { name: '低', pr: 1.0, samples: 0, bloom: true, fsr: false, moon: [1024, 1], flood: [512, 1], candle: [256, 1], lantern: [256, 1], torch: [512, 1], rain: 0.7, cloth: 2 },
  { name: '中', pr: 1.25, samples: 4, bloom: true, fsr: true, moon: [2048, 1], flood: [1024, 1], candle: [256, 1], lantern: [512, 1], torch: [512, 1], rain: 1, cloth: 1 },
  { name: '高', pr: 1.5, samples: 4, bloom: true, fsr: true, moon: [2048, 1], flood: [1024, 1], candle: [512, 1], lantern: [512, 1], torch: [512, 1], rain: 1, cloth: 1 },
  { name: '极高', pr: 2, samples: 4, bloom: true, fsr: true, moon: [2048, 1], flood: [1024, 1], candle: [512, 1], lantern: [512, 1], torch: [512, 1], rain: 1, cloth: 1 }
];
let QUAL = QUALITY[2];

/* ---------------- FSR 1.0-style upscaling: what a browser has in place of DLSS or MetalFX ---------------- */
// AMD's FidelityFX Super Resolution 1.0, the two passes: EASU scales up along the edges it finds (12 taps, a lanczos-like
// lobe stretched along each edge, clamped to the 4 nearest texels so it never rings), RCAS sharpens what scaling softened
const FS_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const EASU = new THREE.ShaderMaterial({
  uniforms: { tDiffuse: { value: null }, inSize: { value: new THREE.Vector2(1, 1) } }, vertexShader: FS_VERT, depthTest: false, depthWrite: false,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec2 inSize; varying vec2 vUv;
    vec3 T(vec2 p) { return texture2D(tDiffuse, (p + 0.5) / inSize).rgb; }
    float L(vec3 c) { return c.g + 0.5 * (c.r + c.b); }
    void setF(inout vec2 dir, inout float len, float w, float lA, float lB, float lC, float lD, float lE) {
      float lenX = max(abs(lD - lC), abs(lC - lB)), dirX = lD - lB; dir.x += dirX * w;
      lenX = clamp(abs(dirX) / max(lenX, 1e-5), 0.0, 1.0); len += lenX * lenX * w;
      float lenY = max(abs(lE - lC), abs(lC - lA)), dirY = lE - lA; dir.y += dirY * w;
      lenY = clamp(abs(dirY) / max(lenY, 1e-5), 0.0, 1.0); len += lenY * lenY * w;
    }
    void tap(inout vec3 aC, inout float aW, vec2 off, vec2 dir, vec2 len, float lob, float clp, vec3 c) {
      vec2 v = vec2(dot(off, dir), dot(off, vec2(-dir.y, dir.x))) * len;
      float d2 = min(dot(v, v), clp), wB = 0.4 * d2 - 1.0, wA = lob * d2 - 1.0;
      wB *= wB; wA *= wA; wB = 1.5625 * wB - 0.5625; float w = wB * wA; aC += c * w; aW += w;
    }
    void main() {
      vec2 pp = vUv * inSize - 0.5, fp = floor(pp); pp -= fp;
      vec3 bC = T(fp + vec2(0.0, -1.0)), cC = T(fp + vec2(1.0, -1.0));
      vec3 eC = T(fp + vec2(-1.0, 0.0)), fC = T(fp), gC = T(fp + vec2(1.0, 0.0)), hC = T(fp + vec2(2.0, 0.0));
      vec3 iC = T(fp + vec2(-1.0, 1.0)), jC = T(fp + vec2(0.0, 1.0)), kC = T(fp + vec2(1.0, 1.0)), lC = T(fp + vec2(2.0, 1.0));
      vec3 nC = T(fp + vec2(0.0, 2.0)), oC = T(fp + vec2(1.0, 2.0));
      float bL = L(bC), cL = L(cC), eL = L(eC), fL = L(fC), gL = L(gC), hL = L(hC), iL = L(iC), jL = L(jC), kL = L(kC), lL = L(lC), nL = L(nC), oL = L(oC);
      vec2 dir = vec2(0.0); float len = 0.0;
      setF(dir, len, (1.0 - pp.x) * (1.0 - pp.y), bL, eL, fL, gL, jL);
      setF(dir, len, pp.x * (1.0 - pp.y), cL, fL, gL, hL, kL);
      setF(dir, len, (1.0 - pp.x) * pp.y, fL, iL, jL, kL, nL);
      setF(dir, len, pp.x * pp.y, gL, jL, kL, lL, oL);
      float dirR = dot(dir, dir); bool zro = dirR < 1.0 / 32768.0;
      dir = zro ? vec2(1.0, 0.0) : dir * inversesqrt(dirR);
      len = len * 0.5; len *= len;
      float stretch = dot(dir, dir) / max(abs(dir.x), abs(dir.y));
      vec2 len2 = vec2(1.0 + (stretch - 1.0) * len, 1.0 - 0.5 * len);
      float lob = 0.5 - 0.29 * len, clp = 1.0 / lob;
      vec3 mn = min(min(fC, gC), min(jC, kC)), mx = max(max(fC, gC), max(jC, kC)), aC = vec3(0.0); float aW = 0.0;
      tap(aC, aW, vec2(0.0, -1.0) - pp, dir, len2, lob, clp, bC); tap(aC, aW, vec2(1.0, -1.0) - pp, dir, len2, lob, clp, cC);
      tap(aC, aW, vec2(-1.0, 1.0) - pp, dir, len2, lob, clp, iC); tap(aC, aW, vec2(0.0, 1.0) - pp, dir, len2, lob, clp, jC);
      tap(aC, aW, vec2(0.0, 0.0) - pp, dir, len2, lob, clp, fC); tap(aC, aW, vec2(-1.0, 0.0) - pp, dir, len2, lob, clp, eC);
      tap(aC, aW, vec2(1.0, 1.0) - pp, dir, len2, lob, clp, kC); tap(aC, aW, vec2(2.0, 1.0) - pp, dir, len2, lob, clp, lC);
      tap(aC, aW, vec2(2.0, 0.0) - pp, dir, len2, lob, clp, hC); tap(aC, aW, vec2(1.0, 0.0) - pp, dir, len2, lob, clp, gC);
      tap(aC, aW, vec2(1.0, 2.0) - pp, dir, len2, lob, clp, oC); tap(aC, aW, vec2(0.0, 2.0) - pp, dir, len2, lob, clp, nC);
      gl_FragColor = vec4(min(mx, max(mn, aC / aW)), 1.0);
    }`
});
const RCAS = new THREE.ShaderMaterial({
  uniforms: { tDiffuse: { value: null }, texel: { value: new THREE.Vector2(1, 1) }, sharp: { value: 0.8 }, grain: { value: 0.02 }, time: { value: 0 } }, vertexShader: FS_VERT, depthTest: false, depthWrite: false,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec2 texel; uniform float sharp, grain, time; varying vec2 vUv;
    void main() {
      vec3 b = texture2D(tDiffuse, vUv - vec2(0.0, texel.y)).rgb, d = texture2D(tDiffuse, vUv - vec2(texel.x, 0.0)).rgb, e = texture2D(tDiffuse, vUv).rgb;
      vec3 f = texture2D(tDiffuse, vUv + vec2(texel.x, 0.0)).rgb, h = texture2D(tDiffuse, vUv + vec2(0.0, texel.y)).rgb;
      vec3 mn4 = min(min(b, d), min(f, h)), mx4 = max(max(b, d), max(f, h));
      vec3 lobeRGB = max(-mn4 / (4.0 * mx4 + 1e-5), (1.0 - mx4) / (4.0 * mn4 - 4.0 - 1e-5));
      float lobe = max(-0.1875, min(max(lobeRGB.r, max(lobeRGB.g, lobeRGB.b)), 0.0)) * sharp;
      vec3 c = (lobe * (b + d + f + h) + e) / (4.0 * lobe + 1.0);
      // the film grain, at the screen's own pixels, added where the grade added it: in linear light, just before gamma
      float g = fract(sin(dot(gl_FragCoord.xy + fract(time) * 37.0, vec2(12.9898, 78.233))) * 43758.5453);
      vec3 lin = pow(max(c, 0.0), vec3(2.2)) + (g - 0.5) * grain;
      gl_FragColor = vec4(pow(max(lin, 0.0), vec3(1.0 / 2.2)), 1.0);
    }`
});
const FSR = { on: false, rt: null, qE: new THREE.FullScreenQuad(EASU), qR: new THREE.FullScreenQuad(RCAS), inPR: 1, outPR: 1 };
// the frame: the scene and its post at the level's resolution, then (on a dense screen) up to the screen's own
function drawFrame() {
  composer.render();
  if (!FSR.on) return;
  EASU.uniforms.tDiffuse.value = composer.readBuffer.texture; renderer.setRenderTarget(FSR.rt); FSR.qE.render(renderer);
  RCAS.uniforms.tDiffuse.value = FSR.rt.texture; RCAS.uniforms.time.value = G.t; renderer.setRenderTarget(null); FSR.qR.render(renderer);
}
function setQuality(lv, quiet) {
  lv = clamp(Math.round(lv), 0, QUALITY.length - 1); const Q = QUALITY[lv]; PERF.level = lv; QUAL = Q;
  const w = innerWidth, h = innerHeight, dpr = window.devicePixelRatio || 1;
  const outPR = Math.min(dpr, 2, Math.sqrt(5.2e6 / (w * h))), inPR = Math.min(Q.pr, dpr), fsr = Q.fsr && inPR < outPR - 0.05; // the screen's own pixels, up to about 5 megapixels
  FSR.on = fsr; FSR.inPR = inPR; FSR.outPR = fsr ? outPR : inPR;
  renderer.setPixelRatio(FSR.outPR); renderer.setSize(w, h, false);
  if (Q.samples !== PERF.samples || !composer) { PERF.samples = Q.samples; makeComposer(Q.samples); }
  composer.setPixelRatio(inPR); composer.setSize(w, h); composer.renderToScreen = !fsr;
  gradePass.uniforms.grain.value = fsr ? 0 : 0.02; RCAS.uniforms.grain.value = 0.02; // grain moves after the scaling, so it stays fine
  if (fsr) {
    const ow = Math.round(w * outPR), oh = Math.round(h * outPR);
    if (!FSR.rt) FSR.rt = new THREE.WebGLRenderTarget(ow, oh, { depthBuffer: false }); else FSR.rt.setSize(ow, oh);
    EASU.uniforms.inSize.value.set(Math.round(w * inPR), Math.round(h * inPR)); RCAS.uniforms.texel.value.set(1 / ow, 1 / oh);
  }
  bloomPass.enabled = Q.bloom;
  for (const S of SHADOWS) {
    const cfg = Q[S.key]; if (!cfg) continue; S.every = cfg[1]; const sh = S.light.shadow;
    if (sh.mapSize.x !== cfg[0]) { sh.mapSize.set(cfg[0], cfg[0]); if (sh.map) { sh.map.dispose(); sh.map = null; } S.cacheOK = false; S.skipped = true; }
  }
  try { localStorage.setItem('yuye.quality', JSON.stringify({ auto: PERF.auto, level: lv })); } catch (e) { /* private window: just don't remember */ }
  if (!quiet) toast('画质：' + Q.name + (PERF.auto ? '（自动）' : '（手动）'), 1.8);
}
function cycleQuality() { // G: 自动 → 极高 → 高 → 中 → 低 → 最低 → 自动
  if (PERF.auto) { PERF.auto = false; setQuality(4); }
  else if (PERF.level > 0) setQuality(PERF.level - 1);
  else { PERF.auto = true; PERF.lowT = PERF.calmT = 0; PERF.capLv = 4; PERF.misses.length = 0; PERF.settle = 3; setQuality(2); }
}
addEventListener('resize', () => setQuality(PERF.level, true)); // the window changed: every size above follows
(function loadQuality() {
  try { const v = JSON.parse(localStorage.getItem('yuye.quality') || 'null'); if (v && typeof v.level === 'number') { PERF.auto = v.auto !== false; PERF.level = clamp(v.level, 0, QUALITY.length - 1); } } catch (e) { /* no storage: start in the middle */ }
  setQuality(PERF.level, true);
})();

/* ---------------- frame pacing and the governor ---------------- */
// the first frames only measure how fast the screen refreshes (60, 120, or 30 in low-power mode), with nothing drawn
function perfProbe(raw) {
  if (PERF.probeN >= 36) return false;
  if (PERF.probeN > 4) PERF.probe.push(raw); PERF.probeN++;
  if (PERF.probeN === 36) { const a = PERF.probe.slice().sort((x, y) => x - y), hz = 1 / (a[a.length >> 1] || 1 / 60); PERF.hz = hz > 100 ? 120 : hz > 75 ? 90 : hz > 50 ? 60 : hz > 36 ? 45 : 30; }
  return true;
}
// a 120 Hz screen gets every other refresh: an even 60, half the heat, and no stutter from frames that only sometimes fit
function perfSkip(now) {
  if (PERF.hz < 110) return false;
  if (now - PERF.lastDraw < 1000 / 60 - 4) return true;
  PERF.lastDraw = now; return false;
}
// held to an even 60, not an average: a frame that misses the screen's refresh counts. Four of those within two seconds (or a
// second and a half under 48) and it steps down one level, and that level stays off for the session, so it never seesaws;
// twelve seconds without a single miss and it steps up one, as far as 高 (极高 is there to pick by hand, with G)
function perfFrame(raw, busy) {
  PERF.frame++;
  // one long frame is a stall from outside the game (a tab switch, the machine waking) and isn't counted; three in a row is
  // just how fast this machine is, and is
  if (raw > 0.25) { if (++PERF.stallN < 3) return; } else PERF.stallN = 0;
  const target = Math.min(PERF.hz, 60);
  PERF.acc += raw; PERF.n++; PERF.busyAcc += busy; if (raw > 1.5 / target) PERF.missN++;
  if (PERF.acc < 0.5) return;
  PERF.fps = PERF.n / PERF.acc; PERF.ms = 1000 * PERF.acc / PERF.n; PERF.busy = 1000 * PERF.busyAcc / PERF.n;
  const miss = PERF.missN; PERF.misses.push(miss); if (PERF.misses.length > 4) PERF.misses.shift();
  PERF.acc = 0; PERF.n = 0; PERF.busyAcc = 0; PERF.missN = 0;
  if (!PERF.auto || document.hidden) return;
  if ((PERF.settle -= 0.5) > 0) return;
  PERF.lowT = PERF.fps < target * 0.8 ? PERF.lowT + 0.5 : 0;
  const missed2s = PERF.misses.reduce((a, b) => a + b, 0);
  if ((missed2s >= 4 && PERF.fps < target * 0.97) || PERF.lowT >= 1.5) {
    if (PERF.level > 0) { PERF.capLv = PERF.level - 1; setQuality(PERF.level - 1, true); }
    PERF.settle = 3; PERF.misses.length = 0; PERF.calmT = 0; PERF.lowT = 0; return;
  }
  PERF.calmT = miss === 0 && PERF.fps >= target * 0.97 ? PERF.calmT + 0.5 : 0;
  if (PERF.calmT >= 12 && PERF.level < Math.min(PERF.capLv, 3)) { setQuality(PERF.level + 1, true); PERF.settle = 3; PERF.calmT = 0; PERF.misses.length = 0; }
}
function updatePerfHUD() {
  const el = $('perf'); el.classList.toggle('on', PERF.show); if (!PERF.show || PERF.frame % 10) return;
  const c = renderer.domElement, low = PERF.fps < Math.min(PERF.hz, 60) * 0.8;
  const res = FSR.on ? Math.round(innerWidth * FSR.inPR) + '×' + Math.round(innerHeight * FSR.inPR) + ' → FSR ' + c.width + '×' + c.height : c.width + '×' + c.height;
  el.textContent = PERF.fps.toFixed(0) + ' 帧/秒 · ' + PERF.ms.toFixed(1) + ' 毫秒（计算 ' + PERF.busy.toFixed(1) + '）· 画质 ' + QUAL.name + (PERF.auto ? '（自动）' : '（手动）') + ' · 绘制 ' + PERF.calls + ' 次 · ' + (PERF.tris / 1000).toFixed(0) + 'k 三角形 · ' + res + (PERF.hz > 100 ? ' · 120Hz 屏，锁 60' : PERF.hz < 55 ? ' · 屏幕/系统限 ' + PERF.hz + ' 帧' : '');
  el.classList.toggle('low', low);
}
