#!/bin/bash
# Downloads the fonts (all SIL OFL) from github.com/google/fonts and makes static weights,
# because the canvas library cannot select weights from variable fonts.
set -e
cd "$(dirname "$0")"
mkdir -p fonts && cd fonts
base=https://raw.githubusercontent.com/google/fonts/main/ofl
get() { [ -f "$2" ] || curl -sSfL -o "$2" "$base/$1"; }
get instrumentserif/InstrumentSerif-Regular.ttf InstrumentSerif-Regular.ttf
get instrumentserif/InstrumentSerif-Italic.ttf InstrumentSerif-Italic.ttf
get ibmplexmono/IBMPlexMono-Light.ttf IBMPlexMono-Light.ttf
get ibmplexmono/IBMPlexMono-Regular.ttf IBMPlexMono-Regular.ttf
get ibmplexmono/IBMPlexMono-Medium.ttf IBMPlexMono-Medium.ttf
get "notoserifsc/NotoSerifSC%5Bwght%5D.ttf" "NotoSerifSC[wght].ttf"
get "notosanssc/NotoSansSC%5Bwght%5D.ttf" "NotoSansSC[wght].ttf"
python3 - <<'PY'
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
import os
for src, name, weights in [("NotoSerifSC[wght].ttf", "NotoSerifSC", [400, 500, 600]),
                           ("NotoSansSC[wght].ttf", "NotoSansSC", [300, 400, 500])]:
    for w in weights:
        out = f"{name}-{w}.ttf"
        if os.path.exists(out):
            continue
        f = instancer.instantiateVariableFont(TTFont(src), {"wght": w}, updateFontNames=False)
        f["OS/2"].usWeightClass = w
        f.save(out)
        print("wrote", out)
PY
