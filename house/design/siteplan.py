import math
# Site plan generator: x = meters from left lot line, d = meters from street.
S, M, W, D = 12, 50, 82, 118
LOT = 100  # lot depth; lake beyond
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

def flowers(x1, d1, x2, d2, colors, n, seed=1, r=0.35):
    import random
    rnd = random.Random(seed)
    for _ in range(n):
        circle(rnd.uniform(x1 + r, x2 - r), rnd.uniform(d1 + r, d2 - r), r * rnd.uniform(0.7, 1.2), rnd.choice(colors), "none")

# lot + lawn
rect(0, 0, W, LOT, "#b9d99a", "#333", 2)
# lake
rect(-4, LOT, W + 4, D, "#6fa8c8", "none")
for i, d in enumerate(range(104, 118, 3)):
  for xo in (0, 54):
    out.append(f'<path d="M {X(xo + 2 + i % 2 * 3)} {Y(d)} q 12 -5 24 0 t 24 0" fill="none" stroke="#9cc6dc" stroke-width="1.5"/>')
text(10, 112, "大  湖", 22, "#fff", "bold")
text(10, 109.6, "湖景正对后立面", 11, "#eaf4f9")
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
out.append(f'<path d="M {X(17)} {Y(0)} C {X(10)} {Y(5)}, {X(30)} {Y(9)}, {X(19.5)} {Y(10.3)}" fill="none" stroke="#e3dacb" stroke-width="{2.6*S}"/>')
out.append(f'<path d="M {X(17)} {Y(0)} C {X(10)} {Y(5)}, {X(30)} {Y(9)}, {X(19.5)} {Y(10.3)}" fill="none" stroke="#cbbda7" stroke-width="{2.2*S}"/>')
rect(8.2, 8.8, 18.2, 10.3, "#7fa86a", "#5f8f4e"); rect(22, 8.7, 28.5, 10.5, "#7fa86a", "#5f8f4e"); rect(28.5, 7.4, 34, 9, "#7fa86a", "#5f8f4e")
text(30, 6, "前院草坪", 13, "#3d5e2f")
text(6, 6.5, "龙舌兰/黄杨", 11, "#3d5e2f")

# house: west wing + stone gable at d 13.5, brick wing forward to 10.5, east gable to 9.0
out.append(f'<polygon points="{X(8)},{Y(13.5)} {X(22)},{Y(13.5)} {X(22)},{Y(10.5)} {X(28.5)},{Y(10.5)} {X(28.5)},{Y(9)} {X(34)},{Y(9)} {X(34)},{Y(29)} {X(8)},{Y(29)}" fill="#f1e9d8" stroke="#333" stroke-width="2"/>')
rect(8.2, 10.3, 22, 13.5, "#c9c0b0", "#555")
text(13, 11.4, "前廊", 11)
# rooms (1F)
rect(8, 13.5, 15, 19, "#efe4cf", "#888"); text(11.5, 16.4, "书房", 12)
# armory / safe room: windowless core, entered through a hidden bookcase door from the study
rect(8, 19, 13, 23, "#4a3d32", "#222", 2); text(10.5, 21.2, "武器库", 11, "#f3e6c8", "bold"); text(10.5, 19.8, "兼避难室", 9, "#d9c9a8")
out.append(f'<line x1="{X(9)}" y1="{Y(19)}" x2="{X(11.5)}" y2="{Y(19)}" stroke="#d4a017" stroke-width="4"/>')
rect(13, 19, 16, 23, "#efe4cf", "#888"); text(14.5, 20.6, "衣帽间", 9)
rect(8, 23, 16, 29, "#efe4cf", "#888"); text(12, 26.4, "主卧套房", 12); text(12, 24.8, "(朝花园/湖)", 10, "#666")
rect(15, 13.5, 22, 21, "#f6efe0", "#888"); text(17.6, 18.2, "门厅", 12); text(17.6, 16.6, "弧形楼梯", 10, "#666")
circle(20.2, 15.4, 0.9, "none", "#8a6d4a")
rect(16, 21, 25.5, 29, "#fbf5e8", "#888"); text(20.75, 25.4, "两层通高大客厅", 12, weight="bold"); text(20.75, 23.8, "+ 餐厅", 11, "#666")
rect(22, 10.5, 28.5, 19, "#efe4cf", "#888"); text(25.25, 15.2, "正式餐厅", 12); text(25.25, 13.6, "(砖砌翼)", 10, "#666")
rect(28.5, 9, 34, 19, "#efe4cf", "#888"); text(31.25, 14.6, "客卧套房", 11); text(31.25, 13.0, "(右侧山墙)", 9, "#666")
rect(25.5, 19, 34, 29, "#efe4cf", "#888"); text(29.75, 25, "厨房+岛台", 12); text(29.75, 23.3, "储藏间/换鞋间", 10, "#666")
text(29.75, 21.2, "楼上：游戏室", 9, "#8a6d4a")
rect(22, 19, 25.5, 21, "#efe4cf", "#888"); text(23.75, 19.7, "客卫", 9)
# garage
rect(34, 20, 41.5, 28.5, "#d9d3c7", "#333", 2)
text(37.75, 25, "2车位车库", 12, weight="bold"); text(37.75, 23.3, "7×8 m", 10, "#666")
out.append(f'<line x1="{X(41.5)}" y1="{Y(27.5)}" x2="{X(41.5)}" y2="{Y(21)}" stroke="#8a5a2b" stroke-width="5"/>')
text(43.5, 19.2, "车库门侧开", 10, "#8a5a2b", anchor="start")

# covered patio + pool deck (main-floor level, built up over the lower level)
rect(15, 29, 29, 33.5, "#c9c0b0", "#555"); text(22, 30.8, "有顶露台 · 壁炉 · 户外厨房", 11)
rect(13, 33.5, 38, 46.5, "#ece4d4", "#aaa")
# standalone pool bar house on the deck: swim-up bar on the pool side, glass wall to the lake
rect(29.5, 37, 36.5, 45.5, "#f1e9d8", "#333", 2)
rect(29.5, 41.2, 30.3, 44.8, "#5a3e22", "none")            # bar counter on the pool wall
out.append(f'<line x1="{X(29.8)}" y1="{Y(45.5)}" x2="{X(36.2)}" y2="{Y(45.5)}" stroke="#7fc6e0" stroke-width="4"/>')
rect(34, 37, 36.5, 40.5, "#e6dccb", "#888")                 # bath / shower / changing
text(35.25, 38.4, "卫浴", 8, "#555")
text(32.6, 43.4, "酒吧屋", 12, "#8a3b12", "bold"); text(32.6, 42.0, "屋顶观景台", 9, "#8a3b12")
text(32.0, 38.4, "更衣淋浴", 8, "#555")
rect(16, 40.5, 28, 45.5, "#3fa7c4", "#1f6f87", 2, 4)
rect(27.5, 41.4, 29.5, 44.6, "#3fa7c4", "#1f6f87", 1.5)   # swim-up bar alcove
for dd in (42.0, 43.0, 44.0): circle(28.9, dd, 0.3, "#e9f7fb", "#1f6f87")
text(28.4, 40.0, "池中吧台", 9, "#1f6f87")
rect(16, 40.5, 18, 45.5, "#7fcfe0", "none")
text(22.5, 42.6, "泳池 12×5 m", 12, "#fff", "bold"); text(17, 42.1, "浅台", 9, "#1f6f87")
circle(14.4, 43, 1.25, "#5ec2da", "#1f6f87"); text(14.4, 42.7, "SPA", 9, "#fff")
text(22.5, 37.2, "石灰岩泳池平台 · 躺椅", 11, "#666")
# lower lake terrace (basement level) + stairs down from the deck
rect(16, 46.5, 36, 50, "#e3d8c4", "#a89a82"); text(26, 47.8, "下沉湖景露台（地下层标高 · 火盆）", 10, "#5a3e22")
for i in range(5): out.append(f'<line x1="{X(36.2 + i*0.4)}" y1="{Y(46.5)}" x2="{X(36 + i*0.4)}" y2="{Y(49.5)}" stroke="#8a7a62"/>')
rect(35, 29.5, 40, 32, "#bbb", "#777"); text(37.5, 30.3, "泳池设备", 9)

# ---------------- garden (west): a sequence of garden rooms from the house toward the lake
PINK, PURPLE, WHITE, YELLOW, RED, BLUE = "#e58fb3", "#9b7fd1", "#f7f3ea", "#f2c94c", "#d9534f", "#5b7fd6"
rect(0, 29, 15, 98, "#cfe3b4", "#6a8f55", 1.5)
rect(0.8, 13.5, 7.2, 29, "#cfe3b4", "#6a8f55")
flowers(0.9, 14.5, 2.0, 28.5, [PURPLE, WHITE, PINK], 18, 3, 0.3); flowers(6.0, 14.5, 7.1, 28.5, [PURPLE, WHITE, PINK], 18, 4, 0.3)
text(4, 22, "侧院花径", 11, "#3d5e2f"); text(4, 20.4, "绣球 · 鼠尾草", 9, "#3d5e2f")
rect(1.5, 12.5, 6.5, 13.5, "#8a6d4a", "none"); text(4, 11.2, "拱门入口", 9, "#3d5e2f")
# 1 formal garden: four boxwood-edged beds of roses, lavender, hydrangea around a fountain
for (x, d) in [(1, 30), (8.5, 30), (1, 35.5), (8.5, 35.5)]:
    rect(x, d, x + 5.5, d + 3.8, "#9fc38a", "#2f5a24", 2, 3)
    flowers(x + 0.3, d + 0.3, x + 5.2, d + 3.5, [PINK, RED, WHITE, PURPLE], 26, int(x * 10 + d))
circle(7.5, 35, 1.1, "#7fcfe0", "#1f6f87")
text(7.5, 40.1, "① 规则式花园 · 玫瑰 / 薰衣草 / 绣球 · 喷泉", 9, "#2f4a22", "bold")
# 2 wisteria pergola walk
rect(1, 41.5, 14, 44.5, "none", "#8a6d4a", 2)
for x in range(1, 14, 2): out.append(f'<line x1="{X(x + 0.5)}" y1="{Y(44.5)}" x2="{X(x + 0.5)}" y2="{Y(41.5)}" stroke="#8a6d4a"/>')
flowers(1.2, 41.7, 13.8, 44.3, [PURPLE, "#b9a3e3"], 30, 9, 0.28)
text(7.5, 42.6, "② 紫藤廊架 · 长椅", 9, "#5a3e22", "bold")
# 3 double perennial border along a gravel walk, ending at a bench
rect(5.5, 46, 9.5, 60, "#e8dfcf", "#b8ab95")
rect(1, 46, 5.5, 60, "#a9cc8e", "#6a8f55"); rect(9.5, 46, 14, 60, "#a9cc8e", "#6a8f55")
flowers(1.1, 46.1, 5.4, 59.9, [PURPLE, PINK, YELLOW, WHITE, BLUE, "#e8833a"], 70, 11)
flowers(9.6, 46.1, 13.9, 59.9, [PURPLE, PINK, YELLOW, WHITE, BLUE, "#e8833a"], 70, 12)
rect(6.3, 60.2, 8.7, 60.9, "#8a6d4a", "none")
text(7.5, 52.5, "③ 宿根花境", 10, "#2f4a22", "bold"); text(7.5, 51.0, "松果菊·鼠尾草", 8, "#2f4a22"); text(7.5, 49.9, "猫薄荷·观赏草", 8, "#2f4a22")
# 4 lily pond with a gazebo and a weeping willow
out.append(f'<ellipse cx="{X(6.5)}" cy="{Y(68)}" rx="{4.6*S}" ry="{4.2*S}" fill="#6fb3c9" stroke="#3d7f95" stroke-width="2"/>')
for (x, d) in [(5, 69), (7.5, 66.5), (8.2, 70), (4.5, 66.2), (6.6, 68.4)]:
    circle(x, d, 0.45, "#5f9a4e", "none"); circle(x + 0.15, d + 0.1, 0.15, "#f6b6cf", "none")
out.append(f'<polygon points="' + " ".join(f"{X(12.6 + 1.9 * math.cos(math.radians(a)))},{Y(71 + 1.9 * math.sin(math.radians(a)))}" for a in range(0, 360, 45)) + '" fill="#f1e9d8" stroke="#333" stroke-width="1.5"/>')
text(12.6, 70.6, "凉亭", 9)
circle(2.6, 73.4, 2.4, "#8fbf6a", "#5a8a40"); text(2.6, 73.1, "垂柳", 8, "#2f4a22")
text(6.5, 62.6, "④ 睡莲池 · 凉亭", 10, "#2f4a22", "bold")
# 5 kitchen + herb garden with greenhouse
for d in (76, 79, 82):
    rect(1.5, d, 6, d + 2.2, "#b08a5a", "#6b4f2e"); rect(8.5, d, 13, d + 2.2, "#b08a5a", "#6b4f2e")
    flowers(1.7, d + 0.2, 5.8, d + 2.0, ["#5f9a4e", "#7fbf5a", RED], 8, int(d), 0.3)
    flowers(8.7, d + 0.2, 12.8, d + 2.0, ["#5f9a4e", "#7fbf5a", YELLOW], 8, int(d) + 1, 0.3)
circle(4, 87.3, 1.5, "#9fc38a", "#6b4f2e"); text(4, 87.0, "香草螺旋", 8, "#2f4a22")
rect(8.5, 85.5, 14, 89, "#e8f3f6", "#6b8a95"); text(11.25, 86.9, "温室/工具房", 9)
text(7.25, 75.1, "⑤ 菜园 · 香草园", 10, "#2f4a22", "bold")
# 6 small orchard in a bluebonnet meadow
rect(0.5, 90, 14.5, 97.5, "#c9dcb0", "none")
flowers(0.6, 90.1, 14.4, 97.4, [BLUE, "#7d9ae0", WHITE], 60, 21, 0.25)
for x in (2.5, 7.5, 12.5):
    for d in (91.8, 95.6): circle(x, d, 1.3, "#7fa86a", "#4a7a3b")
text(7.5, 89.0, "⑥ 果园（桃 · 无花果 · 柑橘）+ 蓝帽花草地", 9, "#2f4a22", "bold")
# garden hedge with openings to the lawn
out.append(f'<line x1="{X(12.8)}" y1="{Y(46)}" x2="{X(12.8)}" y2="{Y(33.5)}" stroke="#4a7a3b" stroke-width="5" stroke-dasharray="40,18"/>')
out.append(f'<line x1="{X(15)}" y1="{Y(98)}" x2="{X(15)}" y2="{Y(50)}" stroke="#2f5a24" stroke-width="5" stroke-dasharray="70,24"/>')

# ---------------- activity lawn (centre): an outdoor room framed by trees and borders
def ellipse(cx, cd, rx, rd, fill, stroke="none", sw=1, extra=""):
    out.append(f'<ellipse cx="{X(cx)}" cy="{Y(cd)}" rx="{rx*S}" ry="{rd*S}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" {extra}/>')
def tree(x, d, r, fill="#6f9c58", stroke="#4a7a3b"):
    circle(x, d, r, fill, stroke); out[-1] = out[-1].replace("/>", ' fill-opacity="0.85"/>')
# planted frame (shrub + perennial borders) around the lawn
rect(15.5, 50.5, 47.5, 97, "#9cc27f", "none")
flowers(15.6, 50.6, 47.4, 96.9, [PURPLE, PINK, WHITE, YELLOW], 130, 41, 0.3)
# DG walking loop, then the open lawn inside it (kept clear on the house-to-lake view axis)
ellipse(30, 74, 15.2, 21.2, "#e3d6bd", "#c4b394", 1)
ellipse(30, 74, 13.4, 19.4, "#b9d99a", "none")
text(30, 78.5, "活动草坪", 16, "#2f4a22", "bold")
text(30, 76.6, "约 25 × 38 m · 踢球 · 草地游戏 · 派对", 10, "#2f4a22")
for (x, d) in [(26.5, 70), (26.5, 66)]: rect(x - 0.3, d - 0.5, x + 0.3, d + 0.5, "#c0392b", "none")
text(29.5, 68.4, "玉米袋 · 槌球", 8, "#2f4a22")
text(30, 54.3, "环形步道（碎石）串起各个活动点", 9, "#6b5a3a")
# west grove: crape myrtles + redbuds, hammock
for (x, d, r) in [(17.5, 56, 2.2), (16.8, 62, 2.0), (17.4, 68, 2.3), (16.9, 74.5, 2.0), (17.6, 80, 2.2)]:
    tree(x, d, r, "#c27ba0", "#8a4f6f")
out.append(f'<line x1="{X(17.6)}" y1="{Y(62.3)}" x2="{X(17.4)}" y2="{Y(67.7)}" stroke="#e8c27a" stroke-width="4"/>')
text(19.6, 64.9, "吊床", 9, "#5a3e22", anchor="start"); text(19.6, 59.0, "紫薇树丛", 8, "#5a3e22", anchor="start")
# east: great live oak with a rope swing, picnic tables in its shade
tree(43.5, 66.5, 6.5)
circle(43.5, 66.5, 0.7, "#6b4f2e", "none")
out.append(f'<line x1="{X(41.0)}" y1="{Y(63.0)}" x2="{X(42.6)}" y2="{Y(63.0)}" stroke="#5a3e22" stroke-width="4"/>')
text(41.8, 61.5, "橡树秋千", 10, "#5a3e22", "bold")
for (x, d) in [(44.2, 69.8), (45.3, 65.6), (41.8, 68.6)]:
    rect(x - 1.0, d - 0.45, x + 1.0, d + 0.45, "#b08a5a", "#6b4f2e")
text(44.6, 71.6, "野餐区", 10, "#5a3e22", "bold")
tree(45.5, 56.5, 3.2); tree(44.8, 78.5, 3.4)
# north-west corner, in the shade: children's play area
for (x, d, r) in [(17.2, 87.5, 2.6), (24.5, 94.8, 2.2)]: tree(x, d, r)
rect(18.2, 84.2, 25.5, 91.2, "#d9c3a0", "#a88b5f", 1.5, 6)
rect(18.8, 87.4, 22.4, 88.2, "#8a6d4a", "none")
for x in (19.6, 20.6, 21.6): circle(x, 87.0, 0.25, "#c0392b", "none")
rect(22.9, 86.0, 25.0, 89.6, "#e8a33a", "#8a6d4a"); circle(20.0, 90.2, 0.8, "#f3e2b5", "#a88b5f")
text(21.8, 85.0, "儿童游乐 · 秋千/滑梯/沙坑", 8, "#5a3e22", "bold")
# north-east corner: barbecue pavilion with a small dining terrace, framed by trees
rect(36.5, 88.5, 44.5, 94.5, "#f1e9d8", "#333", 2)
rect(37.1, 93.0, 41.0, 93.9, "#5a3e22", "none")
rect(38.5, 89.7, 42.5, 91.2, "#b08a5a", "#6b4f2e")
text(40.5, 91.9, "烧烤亭", 11, "#8a3b12", "bold"); text(40.5, 88.9, "烧烤台 · 10 人餐桌 · 串灯", 7, "#8a3b12")
tree(46.0, 90.0, 2.6); tree(35.2, 96.4, 1.8)
# end of the view axis: lakeside fire-pit circle, sand beach and pier
circle(30, 95.4, 2.6, "#e3d8c4", "#8a6d4a"); circle(30, 95.4, 0.7, "#e07b39", "none")
text(30, 92.0, "湖边火坑（视线尽头）", 9, "#5a3e22", "bold")
rect(15.5, 97.2, 26.5, 100, "#f1e2b8", "#d6c08a"); text(19.0, 98.3, "小沙滩", 10, "#8a6d4a", "bold")
# shoreline: bald cypress + native grasses, open at the beach, fire pit and pier
for x in (34, 38.5, 43, 47):
    tree(x, 98.6, 1.4, "#5f8f4e")
for x in (2.5, 7.5, 12.5): pass
text(41, 100.9, "落羽杉 · 本地观赏草护岸", 8, "#2f4a22")

# ---------------- east: wildflower meadow kept low (helicopter approach path)
rect(52, 66, 81.5, 100, "#c9dcb0", "none")
flowers(52.2, 66.2, 81.3, 99.8, [BLUE, YELLOW, "#e8833a", WHITE, PINK], 160, 31, 0.28)
for d in (70, 77, 84, 91):
    tree(54.6, d, 2.1); tree(79.4, d + 3, 2.3)
tree(57.5, 96.5, 1.6); tree(77.0, 70.0, 1.8)
text(66.5, 84, "野花草地", 13, "#2f4a22", "bold"); text(66.5, 82.3, "低矮植被 · 直升机进近净空区", 9, "#2f4a22")
out.append(f'<line x1="{X(51.2)}" y1="{Y(100)}" x2="{X(51.2)}" y2="{Y(33)}" stroke="#4a7a3b" stroke-width="3" stroke-dasharray="10,6"/>')

# infinity edge facing the lake
out.append(f'<line x1="{X(16)}" y1="{Y(45.5)}" x2="{X(28)}" y2="{Y(45.5)}" stroke="#e9f7fb" stroke-width="4" stroke-dasharray="6,3"/>')
text(22.5, 44.0, "无边际边 → 望湖", 9, "#1f6f87", anchor="middle")

# path from motor court down to the boathouse
rect(48, 31, 50.5, LOT, "#e3dacb", "#b8ab95")
text(49.25, 47, "船屋步道", 9, "#5a3e22", anchor="middle"); text(49.25, 45.6, "高尔夫车", 8, "#5a3e22")

# boathouse over the water: yacht slip + jet-ski lifts, sun deck on top
B = LOT - 62   # boathouse / pier were laid out against a shore at 62
rect(36, 63 + B, 50, 77 + B, "#e9dfcb", "#333", 2)
rect(37, 64 + B, 44, 76 + B, "#4f8fb3", "#1f5f7f")
out.append(f'<path d="M {X(40.5)} {Y(75.4 + B)} L {X(43.2)} {Y(72.5 + B)} L {X(43.2)} {Y(64.6 + B)} L {X(37.8)} {Y(64.6 + B)} L {X(37.8)} {Y(72.5 + B)} Z" fill="#fafafa" stroke="#555"/>')
rect(39, 66 + B, 42, 70 + B, "#cfd8dc", "#777")
text(40.5, 67.6 + B, "游艇", 10, "#222", "bold")
rect(45, 64 + B, 49, 68.5 + B, "#4f8fb3", "#1f5f7f")
for x in (46, 48): out.append(f'<ellipse cx="{X(x)}" cy="{Y(66.2 + B)}" rx="{0.6*S}" ry="{1.4*S}" fill="#f0c040" stroke="#555"/>')
text(47, 69.2 + B, "摩托艇升降架", 8, "#333")
text(47, 74.6 + B, "船屋", 12, "#222", "bold"); text(47, 73.0 + B, "顶层观景台", 9, "#555"); text(47, 71.7 + B, "+ 吧台", 9, "#555")
text(40.5, 77.6 + B, "约 11 m 日间巡航艇 · 船坞升降机", 9, "#fff")

# main pier with T-head (swim ladder, seating)
rect(22.5, LOT, 24.5, 70 + B, "#b08a5a", "#6b4f2e")
rect(18, 70 + B, 29, 72 + B, "#b08a5a", "#6b4f2e")
text(23.5, 72.8 + B, "T 型码头 · 下水梯", 10, "#fff")


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
    out.append(f'<circle cx="{X(66 + 6.6*math.cos(math.radians(a)))}" cy="{Y(51 + 6.6*math.sin(math.radians(a)))}" r="3" fill="#7CFC00" stroke="#333" stroke-width="0.5"/>')
text(66, 58.2, "停机坪 TLOF 12×12 m · 周边灯", 10, "#222", "bold")
text(66, 40.4, "安全区 Ø30 m（红虚线）", 9, "#c0392b")
out.append(f'<line x1="{X(77)}" y1="{Y(42)}" x2="{X(77)}" y2="{Y(45)}" stroke="#333" stroke-width="2"/>')
out.append(f'<polygon points="{X(77)},{Y(45)} {X(79.5)},{Y(44.6)} {X(79.5)},{Y(44.0)} {X(77)},{Y(43.7)}" fill="#ff7f27"/>')
text(78, 41, "风向袋", 9)
out.append(f'<path d="M {X(66)} {Y(66)} L {X(66)} {Y(116)}" stroke="#c0392b" stroke-width="2" stroke-dasharray="6,4" marker-end="url(#arr)"/>')
text(70.5, 112, "进近/离场", 10, "#fff", "bold"); text(70.5, 110.5, "经草地 → 湖面上空", 10, "#fff")

# title, scale, north
out.insert(0, f'<text x="{M}" y="32" font-size="20" font-weight="bold" font-family="PingFang SC,Microsoft YaHei,WenQuanYi Zen Hei,sans-serif">总平面布局 · 湖景版 · 地块约 82 × 100 m（≈8200 m²，约 2 英亩）+ 湖岸</text>')
out.append(f'<line x1="{X(0)}" y1="{Y(-4.2)}" x2="{X(10)}" y2="{Y(-4.2)}" stroke="#333" stroke-width="3"/>')
text(5, -5.6, "10 m", 11)
text(46, -5.6, "前 = 公共展示　右 = 车 · 船 · 直升机（全部交通集中一侧）　左 = 主题花园　中 = 活动草坪　后 = 泳池 · 湖", 12, "#444")

H = TOP + M + D*S + 120
svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{W*S+2*M}" height="{H}" viewBox="0 0 {W*S+2*M} {H}"><defs><marker id="arr" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#c0392b"/></marker></defs><rect width="100%" height="100%" fill="#fbfaf7"/>' + "".join(out) + "</svg>"
open(__file__.rsplit("/", 1)[0] + "/site-plan.svg", "w").write(svg)
