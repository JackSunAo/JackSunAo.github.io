"""Blender stage: from the high-poly pieces of one character to a game mesh.

  low poly   union of the pieces -> voxel remesh -> QuadriFlow quads (~LOD0 tris) -> shrinkwrapped onto the high poly
  UVs        smart projection, the head's islands enlarged so the face gets more of the texture, packed
  bakes      tangent-space normals and ambient occlusion from the high poly; texel positions (for colouring later)
  skin       an armature at the game's own joints, automatic (bone heat) weights, four per vertex
  LOD1       a decimated copy keeping UVs and weights
  export     <id>.mesh.json (meta) + <id>.mesh.bin (LOD0 and LOD1, quantised), <id>_nrm.png, <id>_ao.png, <id>_pos.npy

usage: python bake.py <id> <rigs.json> <work dir> [lod0_quads] [tex]
"""
import sys, json, math, time
import numpy as np
import bpy, bmesh
from mathutils import Vector

BONES = ['pelvis', 'spine', 'chest', 'head', 'hipL', 'kneeL', 'ankleL', 'hipR', 'kneeR', 'ankleR', 'shL', 'elL', 'handL', 'shR', 'elR', 'handR']
PARENT = {'spine': 'pelvis', 'chest': 'spine', 'head': 'chest', 'hipL': 'pelvis', 'kneeL': 'hipL', 'ankleL': 'kneeL', 'hipR': 'pelvis', 'kneeR': 'hipR', 'ankleR': 'kneeR',
          'shL': 'chest', 'elL': 'shL', 'handL': 'elL', 'shR': 'chest', 'elR': 'shR', 'handR': 'elR'}


def log(*a):
    print('[bake]', *a, flush=True)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 16
    return sc


def mesh_obj(name, v, f):
    me = bpy.data.meshes.new(name)
    me.vertices.add(len(v)); me.vertices.foreach_set('co', v.astype(np.float32).ravel())
    me.loops.add(len(f) * 3); me.loops.foreach_set('vertex_index', f.astype(np.int32).ravel())
    me.polygons.add(len(f)); me.polygons.foreach_set('loop_start', np.arange(0, len(f) * 3, 3, dtype=np.int32)); me.polygons.foreach_set('loop_total', np.full(len(f), 3, np.int32))
    me.update(); me.validate()
    me.shade_smooth()
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    return ob


def select_only(*obs, active=None):
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs: o.select_set(True)
    bpy.context.view_layer.objects.active = active or obs[0]


def apply_mod(ob, kind, **kw):
    select_only(ob)
    m = ob.modifiers.new(kind.lower(), kind)
    for k, v in kw.items(): setattr(m, k, v)
    bpy.ops.object.modifier_apply(modifier=m.name)


def drop_islands(ob, keep_min):
    bm = bmesh.new(); bm.from_mesh(ob.data); bm.faces.ensure_lookup_table()
    seen, kill = set(), []
    for f in bm.faces:
        if f.index in seen: continue
        st, comp = [f], [f]; seen.add(f.index)
        while st:
            x = st.pop()
            for e in x.edges:
                for g in e.link_faces:
                    if g.index not in seen: seen.add(g.index); st.append(g); comp.append(g)
        if len(comp) < keep_min: kill += comp
    bmesh.ops.delete(bm, geom=kill, context='FACES')
    bm.to_mesh(ob.data); bm.free()


def make_low(his, quads, cage, keep=None):
    """keep: (centre, radius) of a region (the face) that keeps more of its triangles"""
    t0 = time.time()
    low = cage; low.name = 'low'
    drop_islands(low, 600)  # voids trapped between layers come out as little inner shells: nobody sees them
    me = low.data; log('cage', len(me.polygons), 'genus', (2 - (len(me.vertices) - len(me.edges) + len(me.polygons))) // 2, f'{time.time() - t0:.1f}s')
    apply_mod(low, 'TRIANGULATE')
    if keep is not None:
        c, r = Vector(keep[0]), keep[1]
        vg = low.vertex_groups.new(name='keep')
        for v in low.data.vertices:
            vg.add([v.index], 1.0 if (v.co - c).length > r else 0.12, 'REPLACE')   # low weight: collapsed last
        apply_mod(low, 'DECIMATE', ratio=quads * 2 / len(low.data.polygons), use_collapse_triangulate=True, vertex_group='keep', vertex_group_factor=1.0)
        if 'keep' in low.vertex_groups: low.vertex_groups.remove(low.vertex_groups['keep'])
    else:
        apply_mod(low, 'DECIMATE', ratio=quads * 2 / len(low.data.polygons), use_collapse_triangulate=True)
    log('decimated', len(low.data.polygons), f'{time.time() - t0:.1f}s')
    # fit it back onto the sculpt: union of the high pieces as the target
    tg = []
    for h in his:
        c = h.copy(); c.data = h.data.copy(); bpy.context.scene.collection.objects.link(c); tg.append(c)
    select_only(*tg, active=tg[0]); bpy.ops.object.join(); tgt = bpy.context.view_layer.objects.active; tgt.name = 'hi_all'; tgt.hide_render = True
    sw = low.modifiers.new('sw', 'SHRINKWRAP'); sw.target = tgt; sw.wrap_method = 'NEAREST_SURFACEPOINT'
    select_only(low)
    for m in list(low.modifiers): bpy.ops.object.modifier_apply(modifier=m.name)
    # snapping to the nearest point can fold a triangle onto the wrong surface (a lip, an ear, a strand): relax and snap again, gently
    for _ in range(2):
        apply_mod(low, 'SMOOTH', factor=0.5, iterations=3)
        sw = low.modifiers.new('sw', 'SHRINKWRAP'); sw.target = tgt; sw.wrap_method = 'NEAREST_SURFACEPOINT'
        select_only(low); bpy.ops.object.modifier_apply(modifier=sw.name)
    low.data.shade_smooth()
    return low


def uv_islands(bm, uvl):
    """face islands joined through edges whose two sides share UVs"""
    parent = list(range(len(bm.faces)))
    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]; i = parent[i]
        return i
    for e in bm.edges:
        if len(e.link_faces) != 2: continue
        f0, f1 = e.link_faces
        def uvs(f):
            d = {}
            for l in f.loops: d[l.vert.index] = l[uvl].uv.copy()
            return d
        a, b = uvs(f0), uvs(f1)
        if all((a[v.index] - b[v.index]).length < 1e-5 for v in e.verts):
            parent[find(f0.index)] = find(f1.index)
    isl = {}
    for f in bm.faces: isl.setdefault(find(f.index), []).append(f)
    return list(isl.values())


def unwrap(low, head_y, head_scale=1.9):
    select_only(low)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(58), island_margin=0.003, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    bm = bmesh.new(); bm.from_mesh(low.data); bm.faces.ensure_lookup_table(); uvl = bm.loops.layers.uv.active
    for faces in uv_islands(bm, uvl):  # the face and head get more texels
        cy = sum(f.calc_center_median().y for f in faces) / len(faces)
        if cy < head_y: continue
        uv = [l[uvl].uv for f in faces for l in f.loops]
        c = sum(uv, Vector((0, 0))) / len(uv)
        for f in faces:
            for l in f.loops: l[uvl].uv = c + (l[uvl].uv - c) * head_scale
    bm.to_mesh(low.data); bm.free()
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.pack_islands(rotate=True, margin=0.004)
    bpy.ops.object.mode_set(mode='OBJECT')


def bake_maps(low, his, tex, work, cid):
    sc = bpy.context.scene
    mat = bpy.data.materials.new('bake'); mat.use_nodes = True; low.data.materials.clear(); low.data.materials.append(mat)
    nt = mat.node_tree; bsdf = nt.nodes['Principled BSDF']
    def target(name, float_buf=False):
        img = bpy.data.images.new(name, tex, tex, alpha=True, float_buffer=float_buf)
        img.generated_color = (0, 0, 0, 0)
        if not float_buf: img.colorspace_settings.name = 'Non-Color'
        n = nt.nodes.new('ShaderNodeTexImage'); n.image = img
        for x in nt.nodes: x.select = False
        n.select = True; nt.nodes.active = n
        return img, n
    bk = sc.render.bake
    # normals and occlusion from the sculpt
    for h in his: h.hide_render = False
    select_only(*his, low, active=low)
    bk.use_selected_to_active = True; bk.cage_extrusion = 0.012; bk.max_ray_distance = 0.03; bk.margin = 6
    img, n = target('nrm'); t0 = time.time()
    bpy.ops.object.bake(type='NORMAL', normal_space='TANGENT')
    img.filepath_raw = f'{work}/{cid}_nrm.png'; img.file_format = 'PNG'; img.save(); log('normal', f'{time.time() - t0:.1f}s')
    sc.cycles.samples = 48
    img, n = target('ao'); t0 = time.time()
    bpy.ops.object.bake(type='AO')
    img.filepath_raw = f'{work}/{cid}_ao.png'; img.file_format = 'PNG'; img.save(); log('ao', f'{time.time() - t0:.1f}s')
    # where every texel is on the body (for the colour pass)
    bk.use_selected_to_active = False
    sc.cycles.samples = 1
    geo = nt.nodes.new('ShaderNodeNewGeometry'); em = nt.nodes.new('ShaderNodeEmission'); out = nt.nodes['Material Output']
    nt.links.new(geo.outputs['Position'], em.inputs['Color']); nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    img, n = target('pos', float_buf=True); select_only(low); t0 = time.time()
    bpy.ops.object.bake(type='EMIT')
    px = np.array(img.pixels[:], dtype=np.float32).reshape(tex, tex, 4)
    np.save(f'{work}/{cid}_pos.npy', px); log('position', f'{time.time() - t0:.1f}s')
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])


def rig_and_weights(low, joints, s):
    J = {k: Vector(v) for k, v in joints.items()}
    arm = bpy.data.armatures.new('rig'); ao = bpy.data.objects.new('rig', arm); bpy.context.scene.collection.objects.link(ao)
    select_only(ao); bpy.ops.object.mode_set(mode='EDIT')
    tails = {'pelvis': J['spine'], 'spine': J['chest'], 'chest': J['head'], 'head': J['head'] + Vector((0, 0.2 * s, 0)),
             'hipL': J['kneeL'], 'kneeL': J['ankleL'], 'ankleL': J['ankleL'] + Vector((0, -0.03, 0.15 * s)),
             'hipR': J['kneeR'], 'kneeR': J['ankleR'], 'ankleR': J['ankleR'] + Vector((0, -0.03, 0.15 * s)),
             'shL': J['elL'], 'elL': J['handL'], 'handL': J['handL'] + (J['handL'] - J['elL']).normalized() * 0.1 * s,
             'shR': J['elR'], 'elR': J['handR'], 'handR': J['handR'] + (J['handR'] - J['elR']).normalized() * 0.1 * s}
    eb = {}
    for b in BONES: SEGS[b] = (J[b].copy(), tails[b].copy())
    for b in BONES:
        e = arm.edit_bones.new(b); e.head = J[b]; e.tail = tails[b]; eb[b] = e
    for b, p in PARENT.items(): eb[b].parent = eb[p]
    bpy.ops.object.mode_set(mode='OBJECT')
    select_only(low, ao, active=ao)
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    select_only(low)
    bpy.ops.object.vertex_group_limit_total(group_select_mode='ALL', limit=4)
    bpy.ops.object.vertex_group_normalize_all(group_select_mode='ALL', lock_active=False)
    return ao


def transfer_weights(low, mv, mf, mw):
    """skin weights from the body underneath: each vertex takes the weights of the nearest point on the bare body (where it
    is close to it); what hangs off the body (skirt falls, long hair, packs) keeps the bone-heat weights"""
    import igl
    me = low.data
    P = np.array([v.co[:] for v in me.vertices])
    d2, fi, C = igl.point_mesh_squared_distance(P, mv.astype(np.float64), mf.astype(np.int64))
    tri = mv[mf[fi]]
    v0, v1, v2 = tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0], C - tri[:, 0]
    d00, d01, d11 = (v0 * v0).sum(1), (v0 * v1).sum(1), (v1 * v1).sum(1); d20, d21 = (v2 * v0).sum(1), (v2 * v1).sum(1)
    den = np.maximum(d00 * d11 - d01 * d01, 1e-12); b1 = (d11 * d20 - d01 * d21) / den; b2 = (d00 * d21 - d01 * d20) / den; b0 = 1 - b1 - b2
    Wt = mw[mf[fi, 0]] * b0[:, None] + mw[mf[fi, 1]] * b1[:, None] + mw[mf[fi, 2]] * b2[:, None]
    d = np.sqrt(d2); k = np.clip((0.05 - d) / 0.03, 0, 1)
    gi = {g.name: g for g in low.vertex_groups}
    for b in BONES:
        if b not in gi: gi[b] = low.vertex_groups.new(name=b)
    for i, v in enumerate(me.vertices):
        if k[i] <= 0: continue
        auto = np.zeros(len(BONES))
        for g in v.groups:
            nm = low.vertex_groups[g.group].name
            if nm in BONES: auto[BONES.index(nm)] = g.weight
        if auto.sum() > 0: auto /= auto.sum()
        w = auto * (1 - k[i]) + Wt[i] * k[i]
        for j, b in enumerate(BONES):
            if w[j] > 0.002: gi[b].add([i], float(w[j]), 'REPLACE')
            elif auto[j] > 0: gi[b].remove([i])
    select_only(low)
    bpy.ops.object.vertex_group_limit_total(group_select_mode='ALL', limit=4)
    bpy.ops.object.vertex_group_normalize_all(group_select_mode='ALL', lock_active=False)


SEGS = {}
def nearest_bone(co):
    best, bi = 1e9, 0
    for i, b in enumerate(BONES):
        a, t = SEGS[b]; ab = t - a; h = max(0.0, min(1.0, (co - a).dot(ab) / max(ab.length_squared, 1e-9)))
        d = (co - (a + ab * h)).length
        if d < best: best, bi = d, i
    return bi


def gather(ob):
    """per-corner data welded into game vertices: position, normal, uv, tangent, four bone weights"""
    me = ob.data
    if any(len(p.vertices) != 3 for p in me.polygons):
        bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.triangulate(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    me.calc_tangents()
    gi = {g.index: g.name for g in ob.vertex_groups}
    vw = []
    for v in me.vertices:
        ws = sorted(((g.weight, BONES.index(gi[g.group])) for g in v.groups if gi.get(g.group) in BONES and g.weight > 0.001), reverse=True)[:4]
        if not ws: ws = [(1.0, nearest_bone(v.co))]  # bone heat missed it: the closest bone takes it
        tot = sum(w for w, _ in ws); ws = [(w / tot, i) for w, i in ws] + [(0.0, 0)] * (4 - len(ws))
        vw.append(ws)
    uvl = me.uv_layers.active.data
    key, P, N, U, T, SI, SW, idx = {}, [], [], [], [], [], [], []
    for poly in me.polygons:
        for li in poly.loop_indices:
            l = me.loops[li]; v = me.vertices[l.vertex_index]; uv = uvl[li].uv
            k = (l.vertex_index, round(uv[0], 5), round(uv[1], 5), round(l.normal[0], 3), round(l.normal[1], 3), round(l.normal[2], 3))
            j = key.get(k)
            if j is None:
                j = len(P); key[k] = j
                P.append(tuple(v.co)); N.append(tuple(l.normal)); U.append((uv[0], uv[1])); T.append((*l.tangent, l.bitangent_sign))
                SI.append([i for _, i in vw[l.vertex_index]]); SW.append([w for w, _ in vw[l.vertex_index]])
            idx.append(j)
    return {k: np.array(v, dtype=np.float32) for k, v in (('P', P), ('N', N), ('U', U), ('T', T), ('SW', SW))} | {'SI': np.array(SI, dtype=np.uint8), 'I': np.array(idx, dtype=np.uint32)}


def quantise(d):
    lo, hi = d['P'].min(0), d['P'].max(0)
    q = lambda a, lo, hi: np.round((a - lo) / np.maximum(hi - lo, 1e-9) * 65535).astype(np.uint16)
    sw = d['SW']; swq = np.round(sw * 255).astype(np.int32); swq[:, 0] += 255 - swq.sum(1)  # weights sum to exactly 255
    parts = {
        'pos': q(d['P'], lo, hi), 'nrm': np.round(d['N'] * 127).astype(np.int8), 'uv': q(d['U'], 0.0, 1.0),
        'tan': np.round(d['T'] * 127).astype(np.int8), 'si': d['SI'], 'sw': swq.clip(0, 255).astype(np.uint8),
        'idx': d['I'].astype(np.uint16 if len(d['P']) < 65536 else np.uint32)}
    return parts, lo.tolist(), hi.tolist()


def export(lods, work, cid, joints):
    meta = {'id': cid, 'bones': BONES, 'joints': joints, 'lods': []}
    blob = bytearray()
    for d in lods:
        parts, lo, hi = quantise(d)
        L = {'nv': int(len(d['P'])), 'ni': int(len(d['I'])), 'lo': lo, 'hi': hi, 'buf': {}}
        for k in ('pos', 'nrm', 'uv', 'tan', 'si', 'sw', 'idx'):
            a = parts[k]
            while len(blob) % 4: blob.append(0)
            L['buf'][k] = [len(blob), str(a.dtype), int(a.size)]
            blob += a.tobytes()
        meta['lods'].append(L)
    open(f'{work}/{cid}.mesh.bin', 'wb').write(bytes(blob))
    json.dump(meta, open(f'{work}/{cid}.mesh.json', 'w'))
    log('export', [(L['nv'], L['ni'] // 3) for L in meta['lods']], len(blob) // 1024, 'KB')


if __name__ == '__main__':
    cid, rigs_path, work = sys.argv[1], sys.argv[2], sys.argv[3]
    quads = int(sys.argv[4]) if len(sys.argv) > 4 else 3800
    tex = int(sys.argv[5]) if len(sys.argv) > 5 else 1024
    rig = json.load(open(rigs_path))[cid]
    reset()
    d = np.load(f'{work}/{cid}_hi.npz')
    his = [mesh_obj('hi_' + k, d[f'{k}_v'], d[f'{k}_f']) for k in ('body', 'head')]
    low = make_low(his, quads, mesh_obj('cage', d['cage_v'], d['cage_f']))
    neck = rig['joints']['head'][1] + 0.02
    unwrap(low, neck)
    bake_maps(low, his, tex, work, cid)
    ao = rig_and_weights(low, rig['joints'], rig['s'])
    if 'mh_w' in d: transfer_weights(low, d['mh_v'], d['mh_f'], d['mh_w'])
    lod0 = gather(low)
    l1 = low.copy(); l1.data = low.data.copy(); bpy.context.scene.collection.objects.link(l1)
    for m in list(l1.modifiers): l1.modifiers.remove(m)
    apply_mod(l1, 'DECIMATE', ratio=0.3)
    lod1 = gather(l1)
    export([lod0, lod1], work, cid, rig['joints'])
