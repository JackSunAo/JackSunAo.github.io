"""High-poly meshes from a character's distance field: the body at one resolution, the head and hands finer (they
carry the detail people look at). Each piece is clipped where the next takes over; overlapping closed pieces are fine
for baking, and the low-poly cage is built from their union."""
import json, sys, time
import numpy as np
from skimage.measure import marching_cubes
import sdf
from body import Char, bounds, NLT as NL


def field(A, GV, lo, hi, h, clip=(-9.0, 9.0)):
    lo, hi = np.asarray(lo, float), np.asarray(hi, float)
    n = np.ceil((hi - lo) / h).astype(int) + 1
    ch = h * 4
    cn = np.ceil((hi - lo) / ch).astype(int) + 2
    empty = np.zeros((1, 1, 1), np.float32)
    coarse = sdf.grid_eval(A, GV, NL, lo[0], lo[1], lo[2], ch, cn[0], cn[1], cn[2], empty, 1.0, 0, 0, 0, 1e9, np.array(clip))
    G = sdf.grid_eval(A, GV, NL, lo[0], lo[1], lo[2], h, n[0], n[1], n[2], coarse, ch, lo[0], lo[1], lo[2], ch * 2.2, np.array(clip))
    return G, lo


def surface(G, lo, h, cut=None):
    v, f, nrm_, _ = marching_cubes(G, 0.0, spacing=(h, h, h), allow_degenerate=False)
    v += lo
    if cut is not None:  # the flat lid a clip leaves is no surface of the body: take it off (bakes and shrinkwrap would find it)
        on = np.abs(v[:, 1] - cut) < h * 0.75
        f = f[~on[f].all(axis=1)]
    return v.astype(np.float32), f.astype(np.int32)


def build(cid, rigs, h_body=0.003, h_fine=0.0016):
    ch = Char(cid, rigs[cid])
    ch.build()
    A = ch.P.array(); GV = ch.P.GV
    lo, hi = bounds(ch)
    neck = ch.J['head'][1] + 0.035 * ch.s     # body below this, head above
    t0 = time.time()
    G, glo = field(A, GV, lo, hi, h_body, clip=(-9, neck + h_body))
    vb, fb = surface(G, glo, h_body, cut=neck + h_body)
    hc = ch.hc
    hlo, hhi = hc - np.array([0.17, 0.0, 0.17]) * ch.s, hc + np.array([0.17, 0.2, 0.25]) * ch.s
    hlo[1] = neck - 0.03 * ch.s
    hhi[1] = min(hhi[1], hi[1])
    if ch.look.get('hairStyle') == 'long':
        hlo[1] = neck - 0.03 * ch.s
    Gh, hglo = field(A, GV, hlo, hhi, h_fine, clip=(neck - h_fine, 9))
    vh, fh = surface(Gh, hglo, h_fine, cut=neck - h_fine)
    # the low-poly cage: the same field a few millimetres fatter at a coarse step, so gaps between layers close up
    # (tunnels there would stop decimation); it is shrinkwrapped back onto the sculpt later
    Gc, clo = field(A, GV, lo, hi, 0.008)
    vc, fc = surface(Gc - 0.0035, clo, 0.008)
    parts = {'body': (vb, fb), 'head': (vh, fh), 'cage': (vc, fc)}
    print(cid, 'body', len(fb), 'head', len(fh), 'tris', f'{time.time() - t0:.1f}s', flush=True)
    return ch, parts


if __name__ == '__main__':
    rigs = json.load(open(sys.argv[1]))
    out = sys.argv[3]
    for cid in sys.argv[2].split(','):
        ch, parts = build(cid, rigs)
        np.savez_compressed(f'{out}/{cid}_hi.npz', **{f'{k}_v': v for k, (v, f) in parts.items()}, **{f'{k}_f': f for k, (v, f) in parts.items()})
