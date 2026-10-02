#!/bin/bash
# Finishing + encode for the 2-minute cut: soft halation glow (float pipeline), BT.709, error-diffusion dither.
# Size-capped so the 1080p file stays small enough to host and share (<~30 MB).
# Usage: ./encode-long.sh [1080|4k]   (needs out/long/list.txt from make.mjs and out/long_norm.wav from audio_long.py)
set -e
cd "$(dirname "$0")"
GLOW="[0:v]format=gbrpf32le,split=2[base][hl];[hl]zscale=w=960:h=540:filter=bilinear,curves=all='0/0 0.32/0 0.75/0.55 1/1',gblur=sigma=7:steps=3,colorchannelmixer=rr=1.0:gg=0.80:bb=0.62,zscale=w=3840:h=2160:filter=bicubic[glow];[base][glow]blend=all_mode=screen:all_opacity=0.32"
META="-color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv -movflags +faststart -metadata title=Attention_Is_All_You_Need"
AUDIO="${AUDIO:-out/long_norm.wav}"
if [ "${1:-1080}" = "4k" ]; then
  ffmpeg -y -hide_banner -loglevel error -f concat -safe 0 -i out/long/list.txt -i "$AUDIO" \
    -filter_complex "$GLOW,zscale=matrix=709:range=limited:dither=error_diffusion,format=yuv420p[v]" -map "[v]" -map 1:a \
    -c:v libx264 -preset slow -crf 20 -maxrate 7M -bufsize 14M -tune film -profile:v high -level:v 5.2 -x264-params aq-mode=3 -pix_fmt yuv420p \
    -c:a aac -b:a 192k -ar 48000 $META out/attention-2min-4k.mp4
else
  ffmpeg -y -hide_banner -loglevel error -f concat -safe 0 -i out/long/list.txt -i "$AUDIO" \
    -filter_complex "$GLOW,zscale=w=1920:h=1080:filter=lanczos,zscale=matrix=709:range=limited:dither=error_diffusion,format=yuv420p[v]" -map "[v]" -map 1:a \
    -c:v libx264 -preset slower -crf 20 -maxrate 2.4M -bufsize 6M -tune film -profile:v high -level:v 4.2 -x264-params aq-mode=3 -pix_fmt yuv420p \
    -c:a aac -b:a 160k -ar 48000 $META out/attention-2min-1080p.mp4
fi
ls -la out/attention-2min-*.mp4
