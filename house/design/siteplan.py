# Site plan generator: x = meters from left lot line, d = meters from street.
S, M, W, D = 12, 50, 82, 80
LOT = 62  # lot depth; lake beyond
TOP = 0
out = []
def Y(d): return TOP + M + (D - d) * S
def X(x): return M + x * S
def rect(x1, d1, x2, d2, fill, stroke="#555", sw=1, rx=0, extra=""):
    out.append(f'<rect x="{X(x1)}" y="{Y(d2)}" width="{(x2-x1)*S}" height="{(d2-d1)*S}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" rx="{rx}" {extra}/>')
def text(x, d, s, size=13, color="#222", weight="normal", anchor="middle"):
    out.append(f'<text x="{X(x)}" y="{Y(d)}" font-size="{size}" fill="{color}" font-weight="{weight}" text-anchor="{anchor}" font-family="PingFang SC,Microsoft YaHei,WenQuanYi Zen Hei,sans-serif">{s}</text>')
def circle(x, d, r, fill, stroke="#555"):
    out.append(f'<circle cx="{X(x)}" cy="{Y(d)}" r="{r*S}" fill="{fill}" stroke="{stroke}"/>')

# lot + lawn
rect(0, 0, W, LOT, "#b9d99a", "#333", 2)
# lake
rect(-4, LOT, W + 4, D, "#6fa8c8", "none")
for i, d in enumerate(range(66, 80, 3)):
  for xo in (0, 54):
    out.append(f'<path d="M {X(xo + 2 + i % 2 * 3)} {Y(d)} q 12 -5 24 0 t 24 0" fill="none" stroke="#9cc6dc" stroke-width="1.5"/>')
text(10, 74, "大  湖", 22, "#fff", "bold")
text(10, 71.6, "湖景正对后立面", 11, "#eaf4f9")
# shoreline bulkhead
out.append(f'<line x1="{X(0)}" y1="{Y(LOT)}" x2="{X(W)}" y2="{Y(LOT)}" stroke="#a89a82" stroke-width="5"/>')
# street
out.append(f'<rect x="{M-20}" y="{Y(0)}" width="{W*S+40}" height="34" fill="#9a9a9a"/>')
text(W/2, -2.0, "街 道", 15, "#fff", "bold")
# right side buffer (rear kept open for lake view)
# tree screen hiding the hangar from the street
for x in range(52, 81, 3):
    for d in (4, 8, 12): circle(x + (1.5 if d == 8 else 0), d, 1.3, "#5f8f4e", "#4a7a3b")
for d in range(18, 34, 3): circle(80.8, d, 1.0, "#5f8f4e", "#4a7a3b")

# driveway, motor court
rect(45, 0, 49, 17, "#d8d2c6", "#999")
rect(41.5, 17, 49.5, 31, "#d8d2c6", "#999")
text(47, 8, "车道", 13)
text(45.5, 24, "回车坪", 13)
out.append(f'<text x="{X(47)}" y="{Y(5)}" font-size="16" text-anchor="middle">↑</text>')

# front walkway (curved) + front beds
out.append(f'<path d="M {X(17)} {Y(0)} C {X(10)} {Y(5)}, {X(30)} {Y(9)}, {X(18.5)} {Y(14)}" fill="none" stroke="#e3dacb" stroke-width="{2.6*S}"/>')
out.append(f'<path d="M {X(17)} {Y(0)} C {X(10)} {Y(5)}, {X(30)} {Y(9)}, {X(18.5)} {Y(14)}" fill="none" stroke="#cbbda7" stroke-width="{2.2*S}"/>')
rect(8, 12.5, 34, 14, "#7fa86a", "#5f8f4e")
text(30, 6, "前院草坪", 13, "#3d5e2f")
text(9, 9, "龙舌兰/黄杨", 11, "#3d5e2f")

# house
rect(8, 16.5, 34, 29, "#f1e9d8", "#333", 2)
rect(10, 14, 24, 16.5, "#c9c0b0", "#555")
text(17, 14.8, "前廊", 11)
# rooms (1F)
rect(8, 16.5, 15, 22, "#efe4cf", "#888"); text(11.5, 19, "书房", 12)
rect(8, 22, 16, 29, "#efe4cf", "#888"); text(12, 26, "主卧套房", 12); text(12, 24.3, "(朝花园)", 10, "#666")
rect(15, 16.5, 22, 22, "#f6efe0", "#888"); text(17.5, 20, "门厅", 12); text(17.5, 18.4, "弧形楼梯", 10, "#666")
circle(20.5, 17.6, 0.9, "none", "#8a6d4a")
rect(16, 22, 27, 29, "#fbf5e8", "#888"); text(21.5, 25.8, "两层通高大客厅", 12, weight="bold"); text(21.5, 24.2, "+ 餐厅", 11, "#666")
rect(22, 16.5, 34, 22, "#efe4cf", "#888"); text(28, 19.6, "客卧套房 / 正式餐厅", 11)
rect(27, 22, 34, 29, "#efe4cf", "#888"); text(30.5, 26, "厨房+岛台", 12); text(30.5, 24.3, "储藏间/换鞋间", 10, "#666")
# garage
rect(34, 20, 41.5, 28.5, "#d9d3c7", "#333", 2)
text(37.75, 25, "2车位车库", 12, weight="bold"); text(37.75, 23.3, "7×8 m", 10, "#666")
out.append(f'<line x1="{X(41.5)}" y1="{Y(27.5)}" x2="{X(41.5)}" y2="{Y(21)}" stroke="#8a5a2b" stroke-width="5"/>')
text(43.5, 19.2, "车库门侧开", 10, "#8a5a2b", anchor="start")

# covered patio + pool
rect(15, 29, 29, 33.5, "#c9c0b0", "#555"); text(22, 30.8, "有顶露台 · 壁炉 · 户外厨房", 11)
rect(13, 33.5, 34, 46, "#ece4d4", "#aaa")
rect(17, 36, 29, 41, "#3fa7c4", "#1f6f87", 2, 4)
rect(17, 36, 19, 41, "#7fcfe0", "none")
text(23.5, 38.1, "泳池 12×5 m", 12, "#fff", "bold"); text(18, 37.6, "浅台", 9, "#1f6f87")
circle(31, 38.5, 1.3, "#5ec2da", "#1f6f87"); text(31, 38.2, "SPA", 9, "#fff")
text(23.5, 43.5, "石灰岩泳池平台 · 躺椅", 11, "#666")
rect(35, 29.5, 40, 32, "#bbb", "#777"); text(37.5, 30.3, "泳池设备", 9)

# garden (left/rear)
rect(0, 29, 12.5, 59.5, "#cfe3b4", "#6a8f55", 1.5)
rect(0.8, 16.5, 7.2, 29, "#cfe3b4", "#6a8f55")
text(4, 23, "侧院花径", 11, "#3d5e2f"); text(4, 21.4, "绣球/鼠尾草", 9, "#3d5e2f")
rect(1.5, 15.5, 6.5, 16.5, "#8a6d4a", "none"); text(4, 14.2, "拱门入口", 9, "#3d5e2f")
for (x, d) in [(1.5, 30.5), (7, 30.5), (1.5, 35.5), (7, 35.5)]:
    rect(x, d, x+4, d+3.5, "#9fc38a", "#4a7a3b", 1, 3)
circle(6.25, 34.75, 0.9, "#7fcfe0", "#1f6f87")
text(6.25, 39.8, "玫瑰花园 · 喷泉", 11, "#3d5e2f", "bold")
rect(1, 41, 11.5, 44.5, "none", "#8a6d4a", 2); 
for x in range(1, 12, 2): out.append(f'<line x1="{X(x+0.5)}" y1="{Y(44.5)}" x2="{X(x+0.5)}" y2="{Y(41)}" stroke="#8a6d4a"/>')
text(6.25, 42.3, "紫藤廊架 · 座椅", 10, "#5a3e22")
for i, d in enumerate([46, 49.5, 53]):
    rect(1.5, d, 5.5, d+2.2, "#b08a5a", "#6b4f2e"); rect(7, d, 11, d+2.2, "#b08a5a", "#6b4f2e")
text(6.25, 55.8, "菜园 · 6个抬高种植床", 10, "#3d5e2f")
rect(2, 56.8, 8, 59, "#e8f3f6", "#6b8a95"); text(5, 57.5, "温室/工具房", 9)
circle(11, 57.5, 0.9, "#7fa86a", "#4a7a3b"); circle(11, 50, 0.9, "#7fa86a", "#4a7a3b")
text(10.6, 47.3, "果树", 9, "#3d5e2f")
# hedge opening between garden and pool deck
out.append(f'<line x1="{X(12.5)}" y1="{Y(46)}" x2="{X(12.5)}" y2="{Y(33.5)}" stroke="#4a7a3b" stroke-width="5" stroke-dasharray="40,18"/>')

# rear lawn + fire pit
text(29, 53, "缓坡草坪 → 湖岸", 13, "#3d5e2f")
text(29, 51.4, "（活动/儿童/观景）", 10, "#3d5e2f")
circle(20, 57.5, 1.6, "#d9c3a0", "#8a6d4a"); circle(20, 57.5, 0.6, "#e07b39", "none")
text(20, 54.9, "湖边火坑", 10, "#5a3e22")


# infinity edge facing the lake
out.append(f'<line x1="{X(17)}" y1="{Y(41)}" x2="{X(29)}" y2="{Y(41)}" stroke="#e9f7fb" stroke-width="4" stroke-dasharray="6,3"/>')
text(23.5, 41.6, "无边际边 → 望湖", 9, "#1f6f87", anchor="middle")

# path from motor court down to the boathouse
rect(44.5, 31, 47.5, LOT, "#e3dacb", "#b8ab95")
text(46, 46, "船屋步道", 11, "#5a3e22"); text(46, 44.4, "(可走高尔夫车)", 9, "#5a3e22")

# boathouse over the water: yacht slip + jet-ski lifts, sun deck on top
rect(36, 63, 50, 77, "#e9dfcb", "#333", 2)
rect(37, 64, 44, 76, "#4f8fb3", "#1f5f7f")
out.append(f'<path d="M {X(40.5)} {Y(75.4)} L {X(43.2)} {Y(72.5)} L {X(43.2)} {Y(64.6)} L {X(37.8)} {Y(64.6)} L {X(37.8)} {Y(72.5)} Z" fill="#fafafa" stroke="#555"/>')
rect(39, 66, 42, 70, "#cfd8dc", "#777")
text(40.5, 67.6, "游艇", 10, "#222", "bold")
rect(45, 64, 49, 68.5, "#4f8fb3", "#1f5f7f")
for x in (46, 48): out.append(f'<ellipse cx="{X(x)}" cy="{Y(66.2)}" rx="{0.6*S}" ry="{1.4*S}" fill="#f0c040" stroke="#555"/>')
text(47, 69.2, "摩托艇升降架", 8, "#333")
text(47, 74.6, "船屋", 12, "#222", "bold"); text(47, 73.0, "顶层观景台", 9, "#555"); text(47, 71.7, "+ 吧台", 9, "#555")
text(40.5, 77.6, "约 11 m 日间巡航艇 · 船坞升降机", 9, "#fff")

# main pier with T-head (swim ladder, seating)
rect(22.5, LOT, 24.5, 70, "#b08a5a", "#6b4f2e")
rect(18, 70, 29, 72, "#b08a5a", "#6b4f2e")
text(23.5, 72.8, "T 型码头 · 下水梯", 10, "#fff")


# helicopter zone (right strip): hangar + tow path + helipad, approach over the lake
rect(49.5, 17, 53, 31, "#d8d2c6", "#999")
rect(53, 17, 69, 31, "#e9dfcb", "#333", 2)
out.append(f'<line x1="{X(54)}" y1="{Y(31)}" x2="{X(68)}" y2="{Y(31)}" stroke="#8a5a2b" stroke-width="5"/>')
# helicopter parked in the hangar (top view): fuselage, tail boom, rotor disc
out.append(f'<circle cx="{X(61)}" cy="{Y(26.5)}" r="{5.35*S}" fill="none" stroke="#999" stroke-dasharray="4,3"/>')
out.append(f'<ellipse cx="{X(61)}" cy="{Y(27.2)}" rx="{1.2*S}" ry="{2.2*S}" fill="#f3ead8" stroke="#333"/>')
out.append(f'<line x1="{X(61)}" y1="{Y(25)}" x2="{X(61)}" y2="{Y(20.6)}" stroke="#333" stroke-width="3"/>')
out.append(f'<line x1="{X(57)}" y1="{Y(30.2)}" x2="{X(65)}" y2="{Y(22.8)}" stroke="#555" stroke-width="2"/>')
out.append(f'<line x1="{X(57)}" y1="{Y(22.8)}" x2="{X(65)}" y2="{Y(30.2)}" stroke="#555" stroke-width="2"/>')
text(66.5, 27.5, "直升机", 11, "#222", "bold", "start"); text(66.5, 26.0, "单发轻型", 9, "#666", "start"); text(66.5, 24.8, "5–7 座", 9, "#666", "start")
text(55.5, 29.2, "机库", 11, "#222", "bold", "start")
text(61, 18.2, "16×14 m · 外观同主屋", 9, "#666")
rect(59.5, 31, 62.5, 41, "#d8d2c6", "#999"); text(61, 35.5, "牵引道", 9, "#555")
out.append(f'<circle cx="{X(66)}" cy="{Y(51)}" r="{15*S}" fill="none" stroke="#c0392b" stroke-width="1.5" stroke-dasharray="8,5"/>')
circle(66, 51, 10, "#a9c98f", "#7a9a63")
rect(60, 45, 72, 57, "#c8c4bc", "#666", 1.5)
out.append(f'<circle cx="{X(66)}" cy="{Y(51)}" r="{5.2*S}" fill="none" stroke="#f4f4f4" stroke-width="3"/>')
text(66, 49.2, "H", 46, "#f4f4f4", "bold")
for a in range(0, 360, 30):
    import math
    out.append(f'<circle cx="{X(66 + 6.6*math.cos(math.radians(a)))}" cy="{Y(51 + 6.6*math.sin(math.radians(a)))}" r="3" fill="#7CFC00" stroke="#333" stroke-width="0.5"/>')
text(66, 58.2, "停机坪 TLOF 12×12 m · 周边灯", 10, "#222", "bold")
text(66, 40.4, "安全区 Ø30 m（红虚线）", 9, "#c0392b")
out.append(f'<line x1="{X(77)}" y1="{Y(42)}" x2="{X(77)}" y2="{Y(45)}" stroke="#333" stroke-width="2"/>')
out.append(f'<polygon points="{X(77)},{Y(45)} {X(79.5)},{Y(44.6)} {X(79.5)},{Y(44.0)} {X(77)},{Y(43.7)}" fill="#ff7f27"/>')
text(78, 41, "风向袋", 9)
out.append(f'<path d="M {X(66)} {Y(66)} L {X(66)} {Y(78)}" stroke="#c0392b" stroke-width="2" stroke-dasharray="6,4" marker-end="url(#arr)"/>')
text(70, 74, "进近/离场", 10, "#fff", "bold"); text(70, 72.5, "走湖面上空", 10, "#fff")

# title, scale, north
out.insert(0, f'<text x="{M}" y="32" font-size="20" font-weight="bold" font-family="PingFang SC,Microsoft YaHei,WenQuanYi Zen Hei,sans-serif">总平面布局 · 湖景版 · 地块约 82 × 62 m（≈5100 m²）+ 湖岸 · 含停机坪</text>')
out.append(f'<line x1="{X(0)}" y1="{Y(-4.2)}" x2="{X(10)}" y2="{Y(-4.2)}" stroke="#333" stroke-width="3"/>')
text(5, -5.6, "10 m", 11)
text(46, -5.6, "前 = 公共展示　右 = 车 · 船 · 直升机（全部交通集中一侧）　左 = 花园（安静私密）　后 = 泳池 · 湖", 12, "#444")

H = TOP + M + D*S + 120
svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{W*S+2*M}" height="{H}" viewBox="0 0 {W*S+2*M} {H}"><defs><marker id="arr" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#c0392b"/></marker></defs><rect width="100%" height="100%" fill="#fbfaf7"/>' + "".join(out) + "</svg>"
open(__file__.rsplit("/", 1)[0] + "/site-plan.svg", "w").write(svg)
