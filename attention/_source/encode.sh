#!/bin/bash
# Final finishing + encode: soft halation glow (float pipeline), BT.709, error-diffusion dither, AAC audio.
set -e
cd "$(dirname "$0")"
GLOW="[0:v]format=gbrpf32le,split=2[base][hl];[hl]zscale=w=960:h=540:filter=bilinear,curves=all='0/0 0.32/0 0.75/0.55 1/1',gblur=sigma=7:steps=3,colorchannelmixer=rr=1.0:gg=0.80:bb=0.62,zscale=w=3840:h=2160:filter=bicubic[glow];[base][glow]blend=all_mode=screen:all_opacity=0.32"
COMMON="-pix_fmt yuv420p -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv -c:a aac -b:a 256k -ar 48000 -movflags +faststart -metadata title=Attention_Is_All_You_Need"
which=${1:-both}
if [ "$which" = "4k" ] || [ "$which" = "both" ]; then
ffmpeg -y -hide_banner -loglevel error -f concat -safe 0 -i out/master/list.txt -i out/score_norm.wav \
  -filter_complex "$GLOW,zscale=matrix=709:range=limited:dither=error_diffusion,format=yuv420p[v]" -map "[v]" -map 1:a \
  -c:v libx264 -preset slow -crf 17 -tune film -profile:v high -level:v 5.2 -x264-params aq-mode=3 $COMMON out/attention-is-all-you-need-4k.mp4 &
fi
if [ "$which" = "1080" ] || [ "$which" = "both" ]; then
ffmpeg -y -hide_banner -loglevel error -f concat -safe 0 -i out/master/list.txt -i out/score_norm.wav \
  -filter_complex "$GLOW,zscale=w=1920:h=1080:filter=lanczos,zscale=matrix=709:range=limited:dither=error_diffusion,format=yuv420p[v]" -map "[v]" -map 1:a \
  -c:v libx264 -preset slower -crf 17 -tune film -profile:v high -level:v 4.2 -x264-params aq-mode=3 $COMMON out/attention-is-all-you-need-1080p.mp4 &
fi
wait
ls -la out/attention-is-all-you-need-*.mp4
