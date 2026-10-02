#!/bin/bash
# Full pipeline: fonts → 4K60 motion-blurred frames → score → finishing + encode.
# Needs: node 18+, python3 (numpy, scipy, fonttools), ffmpeg built with libzimg + libx264.
set -e
cd "$(dirname "$0")"
[ -d node_modules ] || npm install
./fetch-fonts.sh
node make.mjs 2 60 "${WORKERS:-4}" out/master 60          # 1800 frames, lossless chunks
python3 audio.py out/score_raw.wav
J=$(ffmpeg -hide_banner -nostats -i out/score_raw.wav -af loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
read ii itp ilra ith off <<< "$(echo "$J" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['input_i'],d['input_tp'],d['input_lra'],d['input_thresh'],d['target_offset'])")"
ffmpeg -y -hide_banner -loglevel error -i out/score_raw.wav \
  -af "loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=$ii:measured_TP=$itp:measured_LRA=$ilra:measured_thresh=$ith:offset=$off:linear=true,aresample=48000" \
  -c:a pcm_s16le out/score_norm.wav
./encode.sh both
