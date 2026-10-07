#!/bin/bash
# one character, sculpt to game files: high poly -> Blender low poly, bakes, weights -> colour -> ../chars
set -e
cd "$(dirname "$0")"
PY=/tmp/claude-0/bvenv/bin/python; W=${WORK:-/tmp/claude-0/cb}; mkdir -p $W ../chars
for c in ${1//,/ }; do
  $PY mesh_hi.py rigs.json $c $W | tail -1
  $PY bake.py $c rigs.json $W ${QUADS:-4000} ${TEX:-1024} 2>&1 | grep "\[bake\]" | tail -1
  $PY color.py $c rigs.json $W | tail -1
  cp $W/$c.mesh.json $W/$c.mesh.bin $W/${c}_albedo.webp $W/${c}_nrm.webp $W/${c}_mr.webp ../chars/
done
