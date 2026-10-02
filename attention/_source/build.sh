#!/bin/bash
# Full pipeline for BOTH cuts. Needs: node 18+, python3 (numpy, scipy, fonttools), ffmpeg with libzimg + libx264.
set -e
cd "$(dirname "$0")"
[ -d node_modules ] || npm install
./fetch-fonts.sh

norm() {  # $1 raw wav, $2 target LUFS, $3 out wav
  J=$(ffmpeg -hide_banner -nostats -i "$1" -af loudnorm=I=$2:TP=-1.0:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
  read ii itp ilra ith off <<< "$(echo "$J" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['input_i'],d['input_tp'],d['input_lra'],d['input_thresh'],d['target_offset'])")"
  ffmpeg -y -hide_banner -loglevel error -i "$1" -af "loudnorm=I=$2:TP=-1.0:LRA=11:measured_I=$ii:measured_TP=$itp:measured_LRA=$ilra:measured_thresh=$ith:offset=$off:linear=true,aresample=48000" -c:a pcm_s16le "$3"
}

# ---- 2-minute cut (120 BPM grid): MUSIC=/path/to/your/own.wav replaces the generated score
SCENE=./scene-long.mjs node make.mjs 2 60 "${WORKERS:-4}" out/long 60
if [ -n "$MUSIC" ]; then ffmpeg -y -hide_banner -loglevel error -i "$MUSIC" -t 120 -ar 48000 -ac 2 out/long_norm.wav
else python3 audio_long.py out/long_raw.wav && norm out/long_raw.wav -14 out/long_norm.wav; fi
./encode-long.sh 1080
[ "$4K" = "1" ] && ./encode-long.sh 4k

# ---- 30-second teaser
node make.mjs 2 60 "${WORKERS:-4}" out/master 60
python3 audio.py out/score_raw.wav && norm out/score_raw.wav -16 out/score_norm.wav
./encode.sh both
