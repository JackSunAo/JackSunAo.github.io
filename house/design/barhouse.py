# Enlarged plan of the standalone pool bar house (7 x 8.5 m), lake at the top.
FONT = 'font-family="PingFang SC,Microsoft YaHei,WenQuanYi Zen Hei,sans-serif"'
S, OX, OY = 50, 120, 180          # px per m; origin = building's south-west corner offset
BW, BD = 7.0, 8.5                 # width (x), depth (d, toward the lake)
out = []
def P(x, d): return OX + x * S, OY + (BD - d) * S
def R(x1, d1, x2, d2, fill, stroke="#444", sw=1, extra=""):
    (a, b), (c, e) = P(x1, d2), P(x2, d1)
    out.append(f'<rect x="{a:.1f}" y="{b:.1f}" width="{c-a:.1f}" height="{e-b:.1f}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" {extra}/>')
def T(x, d, s, size=12, color="#222", weight="normal", anchor="middle", dy=0):
    a, b = P(x, d)
    out.append(f'<text x="{a:.1f}" y="{b+dy:.1f}" font-size="{size}" fill="{color}" font-weight="{weight}" text-anchor="{anchor}" {FONT}>{s}</text>')
def C(x, d, r, fill, stroke="#444"):
    a, b = P(x, d); out.append(f'<circle cx="{a:.1f}" cy="{b:.1f}" r="{r*S:.1f}" fill="{fill}" stroke="{stroke}"/>')

out.append(f'<text x="40" y="40" font-size="20" font-weight="bold" {FONT}>泳池边酒吧屋 · 放大平面（7 × 8.5 m ≈ 60 m²）</text>')
out.append(f'<text x="40" y="64" font-size="12" fill="#666" {FONT}>上 = 湖　左 = 泳池　外观同主屋：奶油砖墙 · 炭黑屋面 · 黑框窗 · 深古铜金属雨篷</text>')
# context: lake-side terrace (top), pool + swim-up alcove (left), deck
R(-2.2, -0.8, BW + 1.6, BD + 1.6, "#ece4d4", "none")
R(-2.2, 1.0, -0.6, 7.6, "#3fa7c4", "#1f6f87", 1.5)
R(-0.6, 4.2, 0, 7.6, "#3fa7c4", "#1f6f87", 1.5)
T(-1.4, 2.6, "泳池", 12, "#fff", "bold")
for d in (4.8, 5.8, 6.8): C(-0.3, d, 0.22, "#e9f7fb", "#1f6f87")
T(-1.4, 3.6, "水下吧凳", 9, "#e9f7fb")
R(0.6, BD, BW - 0.4, BD + 1.6, "#e3d8c4", "#a89a82")
T(BW / 2, BD + 0.8, "朝湖露台 · 吧台椅 · 遮阳伞", 11, "#5a3e22", dy=4)
# building shell
R(0, 0, BW, BD, "#f6efe2", "#222", 4)
# glass folding wall to the lake (north) and lift-up service window to the pool (west)
a, b = P(0.4, BD); c, _ = P(BW - 0.4, BD)
out.append(f'<line x1="{a}" y1="{b}" x2="{c}" y2="{b}" stroke="#7fc6e0" stroke-width="7"/>')
T(BW / 2, BD, "整面玻璃折叠门 · 全开后室内外连通", 10, "#1f6f87", dy=-8)
a, b = P(0, 7.6); _, e = P(0, 4.2)
out.append(f'<line x1="{a}" y1="{b}" x2="{a}" y2="{e}" stroke="#7fc6e0" stroke-width="7"/>')
# double-sided bar: bartender works between the pool-side counter and the room-side counter;
# lit back-bar shelving closes the north end so it is seen through the lake glass
R(0.15, 4.2, 0.85, 7.6, "#5a3e22", "none")
R(0.85, 7.0, 2.6, 7.6, "#3a2a1c", "none")
R(2.2, 3.4, 2.6, 7.0, "#5a3e22", "none")
T(1.1, 3.2, "双面吧台", 12, "#8a3b12", "bold"); T(1.1, 3.2, "左：上翻窗朝泳池", 9, "#8a3b12", dy=14)
T(1.7, 7.3, "背光酒架", 9, "#f3e6c8", dy=4)
T(1.5, 5.6, "调酒区", 9, "#8a3b12")
T(1.5, 5.6, "制冰 · 生啤", 8, "#8a3b12", dy=12)
T(3.5, 4.0, "室内吧台 + 吧凳", 9, "#8a3b12", anchor="start")
for d in (4.4, 5.3, 6.2): C(3.0, d, 0.2, "#d7c2a2")
# lounge
R(3.4, 6.2, 6.6, 7.9, "#d8cbb5", "#8a7a62"); T(5.0, 7.05, "沙发卡座", 10, dy=4)
R(4.4, 4.6, 5.8, 5.6, "#b99a74", "#8a7a62"); T(5.1, 5.1, "茶几", 9, dy=4)
a, b = P(BW, 7.6); _, e = P(BW, 4.4)
out.append(f'<line x1="{a-4}" y1="{b}" x2="{a-4}" y2="{e}" stroke="#222" stroke-width="5"/>')
T(BW - 0.15, 7.2, "电视", 9, anchor="end", dy=4)
# service core along the south wall: changing, shower, WC, storage, stair to roof deck
R(0, 0, 2.2, 2.6, "#e6dccb", "#888"); T(1.1, 1.3, "更衣", 11, dy=4)
R(2.2, 0, 3.6, 2.6, "#d9e8ee", "#888"); T(2.9, 1.3, "淋浴", 11, dy=4)
R(3.6, 0, 5.0, 2.6, "#e6dccb", "#888"); T(4.3, 1.3, "卫生间", 11, dy=4)
R(5.0, 0, BW, 2.6, "#e9e2d3", "#888"); T(6.0, 1.7, "储藏/毛巾", 10, dy=4); T(6.0, 0.9, "泳池玩具", 9, "#666", dy=4)
# exterior stair to the roof deck (east side)
R(BW, 0.2, BW + 1.2, 5.2, "#d8d2c6", "#777")
for i in range(1, 12):
    a, b = P(BW, 0.2 + i * 0.42); c, _ = P(BW + 1.2, 0)
    out.append(f'<line x1="{a}" y1="{b}" x2="{c}" y2="{b}" stroke="#999"/>')
T(BW + 0.6, 5.4, "↑ 屋顶观景台", 10, "#5a3e22", dy=-6)
T(BW / 2, -0.4, "南侧（朝主屋）：实墙 · 门 → 泳池平台", 10, "#666", dy=14)
# scale bar
a, b = P(-2.2, -1.4)
out.append(f'<line x1="{a}" y1="{b+20}" x2="{a + 2*S}" y2="{b+20}" stroke="#333" stroke-width="3"/>')
out.append(f'<text x="{a + S}" y="{b+38}" font-size="11" text-anchor="middle" {FONT}>2 m</text>')

W, H = OX + (BW + 2.2) * S + 40, OY + (BD + 2.6) * S + 60
svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{W:.0f}" height="{H:.0f}" viewBox="0 0 {W:.0f} {H:.0f}"><rect width="100%" height="100%" fill="#fbfaf7"/>' + "".join(out) + "</svg>"
open(__file__.rsplit("/", 1)[0] + "/bar-house.svg", "w").write(svg)
print(W, H)
