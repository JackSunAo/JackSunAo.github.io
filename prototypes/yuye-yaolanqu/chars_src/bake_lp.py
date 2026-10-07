"""The dressed high model (build_real.py, 'real') baked down to one light mesh and one texture: the look of a
hand-made game character rather than a photo-scan. Colour (with the strands of the hair), occlusion, a world-space
normal for painting light in, a mask of what is skin / hair / eye, and the texel positions, all from the high model.

usage: python bake_lp.py <tag> <work dir> [tris] [tex]   ->  <tag>_lp.mesh.json/.bin, <tag>_lp_{col,ao,wn,mask}.png, <tag>_lp_pos.npy"""
import sys, json, time
import numpy as np
import bpy, bmesh
import bake as BK
from bake import log, select_only, apply_mod

KIND_MASK = {'skin': (1, 0, 0), 'eye': (0, 0, 1), 'hair': (0, 1, 0), 'cloth': (0, 0, 0)}


def hi_object(name, P, F, U, png, alpha_png):
    ob = BK.mesh_obj('hi_' + name, P, F)
    uv = ob.data.uv_layers.new(name='uv')
    uv.data.foreach_set('uv', U[F.ravel()].astype(np.float32).ravel())
    mat = bpy.data.materials.new('m_' + name); mat.use_nodes = True; nt = mat.node_tree
    for n in list(nt.nodes):
        if n.type != 'OUTPUT_MATERIAL': nt.nodes.remove(n)
    out = nt.nodes['Material Output']
    tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = bpy.data.images.load(alpha_png or png)
    em = nt.nodes.new('ShaderNodeEmission'); nt.links.new(tx.outputs['Color'], em.inputs['Color'])
    if alpha_png:  # strands: the gaps let the ray through to whatever is under them
        tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mx = nt.nodes.new('ShaderNodeMixShader')
        nt.links.new(tx.outputs['Alpha'], mx.inputs['Fac']); nt.links.new(tr.outputs['BSDF'], mx.inputs[1]); nt.links.new(em.outputs['Emission'], mx.inputs[2])
        nt.links.new(mx.outputs['Shader'], out.inputs['Surface'])
    else:
        nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    ob.data.materials.append(mat)
    ob['emit'] = em.name
    return ob, mat, em


def run(tag, work, tris, tex):
    sc = BK.reset()
    d = np.load(f'{work}/{tag}_hi.npz')
    names = json.loads(str(d['names'])); joints = json.loads(str(d['joints']))
    his, mats = [], []
    for i, (nm, kind, alpha, *_) in enumerate(names):
        if kind in ('brow', 'lash'):
            continue  # painted onto the face afterwards: as cards they'd bake their empty corners onto the skin
        ob, mat, em = hi_object(nm, d[f'P{i}'], d[f'F{i}'], d[f'U{i}'], f'{work}/{tag}_hi_{nm}.png', f'{work}/{tag}_hi_{nm}_a.png' if alpha else None)
        his.append(ob); mats.append((mat, em, kind))
    # the low mesh: everything merged into one closed skin (voxels), decimated, pulled back onto the high model
    cps = []
    for h in his:
        c = h.copy(); c.data = h.data.copy(); sc.collection.objects.link(c); cps.append(c)
    select_only(*cps, active=cps[0]); bpy.ops.object.join(); cage = bpy.context.view_layer.objects.active
    apply_mod(cage, 'REMESH', mode='VOXEL', voxel_size=0.007, adaptivity=0.0)
    BK.drop_islands(cage, 400)
    face = [x for x in his if x.name == 'hi_eyes']
    fc = (np.array(face[0].data.vertices[0].co) if face else np.array(joints['head']) + [0, 0.12, 0.08]).tolist()
    low = BK.make_low(his, tris // 2, cage, keep=(fc, 0.085))
    BK.unwrap(low, joints['head'][1] + 0.02, head_scale=2.2)
    # bakes
    bk = sc.render.bake
    lm = bpy.data.materials.new('bake'); lm.use_nodes = True; low.data.materials.clear(); low.data.materials.append(lm); lnt = lm.node_tree
    def target(name, srgb=False, float_buf=False):
        img = bpy.data.images.new(name, tex, tex, alpha=True, float_buffer=float_buf)
        img.colorspace_settings.name = 'sRGB' if srgb else 'Non-Color'
        n = lnt.nodes.new('ShaderNodeTexImage'); n.image = img
        for x in lnt.nodes: x.select = False
        n.select = True; lnt.nodes.active = n
        return img
    def save(img, fn):
        img.filepath_raw = f'{work}/{fn}'; img.file_format = 'PNG'; img.save()
    for h in his: h.hide_render = False
    select_only(*his, low, active=low)
    bk.use_selected_to_active = True; bk.cage_extrusion = 0.014; bk.max_ray_distance = 0.04; bk.margin = 8
    sc.cycles.samples = 4
    t0 = time.time(); img = target('col', srgb=True); bpy.ops.object.bake(type='EMIT'); save(img, f'{tag}_lp_col.png'); log('colour', f'{time.time() - t0:.1f}s')
    for mat, em, kind in mats:  # what each texel is made of
        nt = mat.node_tree
        for l in list(em.inputs['Color'].links): nt.links.remove(l)
        em.inputs['Color'].default_value = (*KIND_MASK.get(kind, (0, 0, 0)), 1)
    t0 = time.time(); img = target('mask'); bpy.ops.object.bake(type='EMIT'); save(img, f'{tag}_lp_mask.png'); log('mask', f'{time.time() - t0:.1f}s')
    for (mat, em, kind), nm in zip(mats, [n[0] for n in names if n[1] not in ('brow', 'lash')]):  # which piece of clothing
        nt = mat.node_tree; it = nt.nodes.new('ShaderNodeTexImage'); it.image = bpy.data.images.load(f'{work}/{tag}_hi_{nm}_id.png'); it.interpolation = 'Closest'
        it.image.colorspace_settings.name = 'Non-Color'
        nt.links.new(it.outputs['Color'], em.inputs['Color'])
    t0 = time.time(); img = target('id'); bpy.ops.object.bake(type='EMIT'); save(img, f'{tag}_lp_id.png'); log('id', f'{time.time() - t0:.1f}s')
    t0 = time.time(); img = target('nrm'); bpy.ops.object.bake(type='NORMAL', normal_space='TANGENT'); save(img, f'{tag}_lp_nrm.png'); log('normal', f'{time.time() - t0:.1f}s')
    t0 = time.time(); img = target('wn'); bpy.ops.object.bake(type='NORMAL', normal_space='OBJECT'); save(img, f'{tag}_lp_wn.png'); log('world normal', f'{time.time() - t0:.1f}s')
    sc.cycles.samples = 48
    t0 = time.time(); img = target('ao'); bpy.ops.object.bake(type='AO'); save(img, f'{tag}_lp_ao.png'); log('ao', f'{time.time() - t0:.1f}s')
    bk.use_selected_to_active = False; sc.cycles.samples = 1
    geo = lnt.nodes.new('ShaderNodeNewGeometry'); em = lnt.nodes.new('ShaderNodeEmission'); out = lnt.nodes['Material Output']
    lnt.links.new(geo.outputs['Position'], em.inputs['Color']); lnt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    img = target('pos', float_buf=True); select_only(low); bpy.ops.object.bake(type='EMIT')
    np.save(f'{work}/{tag}_lp_pos.npy', np.array(img.pixels[:], dtype=np.float32).reshape(tex, tex, 4))
    # skin: bones at the game's joints, weights from the bare body underneath
    BK.rig_and_weights(low, joints, float(d['s']))
    BK.transfer_weights(low, d['mh_v'], d['mh_f'], d['mh_w'])
    lod0 = BK.gather(low)
    l1 = low.copy(); l1.data = low.data.copy(); sc.collection.objects.link(l1)
    for m in list(l1.modifiers): l1.modifiers.remove(m)
    apply_mod(l1, 'DECIMATE', ratio=0.35)
    lod1 = BK.gather(l1)
    BK.export([lod0, lod1], work, f'{tag}_lp', joints)


if __name__ == '__main__':
    tag, work = sys.argv[1], sys.argv[2]
    run(tag, work, int(sys.argv[3]) if len(sys.argv) > 3 else 6000, int(sys.argv[4]) if len(sys.argv) > 4 else 1024)
