"""Render high-poly (or finished low-poly) characters with Cycles for a look: front three-quarter and close on the face.
usage: preview.py <npz or .glb dir> <out.png> [ids...]"""
import sys, math
import numpy as np
import bpy


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 24
    sc.cycles.use_denoising = True
    sc.render.film_transparent = False
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (0.05, 0.055, 0.065, 1)
    w.node_tree.nodes['Background'].inputs[1].default_value = 1.0
    return sc


def mesh_from(name, v, f, mat):
    me = bpy.data.meshes.new(name)
    me.vertices.add(len(v)); me.vertices.foreach_set('co', v.astype(np.float32).ravel())
    me.loops.add(len(f) * 3); me.loops.foreach_set('vertex_index', f.astype(np.int32).ravel())
    me.polygons.add(len(f)); me.polygons.foreach_set('loop_start', np.arange(0, len(f) * 3, 3, dtype=np.int32)); me.polygons.foreach_set('loop_total', np.full(len(f), 3, np.int32))
    me.update(); me.validate()
    me.shade_smooth()
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    # body space is y-up facing +z; Blender is z-up facing -y
    ob.rotation_euler = (math.pi / 2, 0, 0)
    if mat: ob.data.materials.append(mat)
    return ob


def clay():
    m = bpy.data.materials.new('clay'); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value = (0.62, 0.58, 0.54, 1); b.inputs['Roughness'].default_value = 0.6
    return m


def lights_camera(sc, target, dist, height, yaw, lens=50, size=(700, 1000)):
    for name, loc, en, col in (('key', (-2.5, -3.0, 3.2), 900, (1, 0.92, 0.82)), ('rim', (2.8, 3.0, 2.5), 700, (0.7, 0.8, 1.0)), ('fill', (2.5, -3.5, 1.0), 200, (1, 1, 1))):
        L = bpy.data.lights.new(name, 'AREA'); L.energy = en; L.size = 2.0; L.color = col
        o = bpy.data.objects.new(name, L); sc.collection.objects.link(o); o.location = loc
        d = np.array(target) - np.array(loc); o.rotation_euler = (math.atan2(math.hypot(d[0], d[1]), -d[2]), 0, math.atan2(d[1], d[0]) - math.pi / 2)
    cam = bpy.data.cameras.new('cam'); cam.lens = lens; co = bpy.data.objects.new('cam', cam); sc.collection.objects.link(co); sc.camera = co
    co.location = (target[0] + math.sin(yaw) * dist, target[1] - math.cos(yaw) * dist, height)
    d = np.array(target) - np.array(co.location)
    co.rotation_euler = (math.atan2(math.hypot(d[0], d[1]), -d[2]), 0, math.atan2(d[1], d[0]) - math.pi / 2)
    sc.render.resolution_x, sc.render.resolution_y = size


if __name__ == '__main__':
    src, out = sys.argv[1], sys.argv[2]
    mode = sys.argv[3] if len(sys.argv) > 3 else 'body'
    sc = reset()
    d = np.load(src)
    m = clay()
    for k in ('body', 'head'):
        if f'{k}_v' in d: mesh_from(k, d[f'{k}_v'], d[f'{k}_f'], m)
    if mode == 'face':
        hv = d['head_v']; c = hv.mean(axis=0)
        lights_camera(sc, (c[0], -c[2], c[1] - 0.01), 0.75, c[1] + 0.02, 0.45, lens=85, size=(700, 700))
    elif mode == 'side':
        lights_camera(sc, (0, 0, 0.9), 4.6, 1.15, 1.9, lens=50, size=(600, 1000))
    elif mode == 'back':
        lights_camera(sc, (0, 0, 0.9), 4.6, 1.15, 3.0, lens=50, size=(600, 1000))
    else:
        lights_camera(sc, (0, 0, 0.9), 4.6, 1.15, 0.5, lens=50, size=(600, 1000))
    sc.render.filepath = out
    bpy.ops.render.render(write_still=True)
