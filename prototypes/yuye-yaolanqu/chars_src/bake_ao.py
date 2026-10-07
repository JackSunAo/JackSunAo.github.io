"""Ambient occlusion for a dressed character, part by part: each part's texture darkened where the others (and
itself) shut the light out - under the collar, the armpits, between the fingers, under the hair. Library assets mostly
come without it, and without it they look pasted together.

usage: python bake_ao.py <tag> <work dir>   (after build_real.py ... real; rewrites the parts' colour textures)"""
import sys, json, os, time
import numpy as np
import bpy
from PIL import Image
import bake as BK
from bake import log, select_only

STRENGTH = {'skin': 0.65, 'cloth': 0.8, 'hair': 0.55}


def run(tag, work, res=1024):
    sc = BK.reset(); sc.cycles.samples = 48
    w = bpy.data.worlds.new('w'); sc.world = w; w.light_settings.distance = 0.12   # contact shadow, not a dark room
    d = np.load(f'{work}/{tag}_hi.npz'); names = json.loads(str(d['names']))
    meta = json.load(open(f'{work}/{tag}.mesh.json'))
    obs = []
    for i, (nm, kind, alpha, *_) in enumerate(names):
        ob = BK.mesh_obj('p_' + nm, d[f'P{i}'], d[f'F{i}'])
        uv = ob.data.uv_layers.new(name='uv'); uv.data.foreach_set('uv', d[f'U{i}'][d[f'F{i}'].ravel()].astype(np.float32).ravel())
        mat = bpy.data.materials.new('m_' + nm); mat.use_nodes = True; ob.data.materials.append(mat)
        obs.append((ob, nm, kind))
    bk = sc.render.bake; bk.use_selected_to_active = False; bk.margin = 8
    for ob, nm, kind in obs:
        if kind not in STRENGTH or 'pantyhose' in nm or 'stocking' in nm or 'tights' in nm: continue   # skin-tight sheer layers: the leg under them isn't shadow
        nt = ob.data.materials[0].node_tree
        img = bpy.data.images.new('ao_' + nm, res, res); img.colorspace_settings.name = 'Non-Color'
        n = nt.nodes.new('ShaderNodeTexImage'); n.image = img
        for x in nt.nodes: x.select = False
        n.select = True; nt.nodes.active = n
        select_only(ob); t0 = time.time()
        bpy.ops.object.bake(type='AO')
        ao = np.array(img.pixels[:], dtype=np.float32).reshape(res, res, 4)[::-1, :, 0]
        part = next(p for p in meta['parts'] if p['name'] == nm)
        fn = f'{work}/{part["tex"]["map"]}'
        im = Image.open(fn); mode = im.mode; a = np.asarray(im.convert('RGBA' if mode == 'RGBA' else 'RGB'), np.float32) / 255.0
        A = np.asarray(Image.fromarray((ao * 255).astype(np.uint8)).resize(a.shape[1::-1], Image.BILINEAR), np.float32) / 255.0
        k = STRENGTH[kind]
        a[..., :3] *= (1 - k + k * A)[..., None]
        Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).save(fn, quality=90, method=6)
        log('ao', nm, f'{time.time() - t0:.1f}s')


if __name__ == '__main__':
    run(sys.argv[1], sys.argv[2])
