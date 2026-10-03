# Lower level (basement) plan + schematic section. Same coordinates as siteplan.py:
# x = meters from left lot line, d = meters from street, z = meters relative to main floor.
FONT = 'font-family="PingFang SC,Microsoft YaHei,WenQuanYi Zen Hei,sans-serif"'
out = []
def T(px, py, s, size=12, color="#222", weight="normal", anchor="middle"):
    out.append(f'<text x="{px:.1f}" y="{py:.1f}" font-size="{size}" fill="{color}" font-weight="{weight}" text-anchor="{anchor}" {FONT}>{s}</text>')
def poly(pts, fill, stroke="#444", sw=1, extra=""):
    out.append(f'<polygon points="{" ".join(f"{a:.1f},{b:.1f}" for a, b in pts)}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" {extra}/>')
def R(x1, y1, x2, y2, fill, stroke="#444", sw=1, extra=""):
    out.append(f'<rect x="{min(x1,x2):.1f}" y="{min(y1,y2):.1f}" width="{abs(x2-x1):.1f}" height="{abs(y2-y1):.1f}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" {extra}/>')

# ---------------- section ----------------
SS, SX0, SY0 = 14, 40, 70          # px per m, left margin, top margin
D0, ZTOP = 6, 17                  # first d shown, highest z shown
def sx(d): return SX0 + (d - D0) * SS
def sy(z): return SY0 + (ZTOP - z) * SS
T(SX0, 34, "示意剖面（从街道到湖，竖向不夸张，真实比例）", 18, weight="bold", anchor="start")
T(SX0, 54, "← 街道　　标高：±0.0 主层 · −3.3 地下层/湖景露台 · −5.0 湖常水位", 11, "#666", anchor="start"); T(sx(80), 54, "湖 →", 11, "#666", anchor="end")
# sky / lake / ground
R(sx(D0), sy(ZTOP), sx(80), sy(-9), "#f4f8fb", "none")
lake = [(sx(60), sy(-5.0)), (sx(80), sy(-5.0)), (sx(80), sy(-9)), (sx(64), sy(-9)), (sx(62), sy(-7.5)), (sx(62), sy(-5.0))]
poly(lake, "#6fa8c8", "none")
ground = [(sx(D0), sy(-0.7)), (sx(13.5), sy(-0.4)), (sx(13.5), sy(-3.6)), (sx(46.6), sy(-3.6)),
          (sx(50), sy(-3.2)), (sx(62), sy(-4.4)), (sx(62), sy(-7.5)), (sx(64), sy(-9)), (sx(D0), sy(-9))]
poly(ground, "#cdbb9a", "#8a7a62")
# lawn slope surface
out.append(f'<polyline points="{sx(50)},{sy(-3.0)} {sx(62)},{sy(-4.2)}" fill="none" stroke="#6a9a4f" stroke-width="4"/>')
out.append(f'<polyline points="{sx(D0)},{sy(-0.5)} {sx(13.5)},{sy(-0.3)}" fill="none" stroke="#6a9a4f" stroke-width="4"/>')
# basement under house + corridor + bar (lower level, floor z = -3.3)
R(sx(13.5), sy(0), sx(29), sy(-3.3), "#efe4cf", "#333", 2)
T(sx(22.75), sy(-1.4), "地下室  层高 3.0 m", 11, weight="bold")
T(sx(22.75), sy(-2.6), "影院 · 酒窖 · 健身SPA · 休闲厅", 9, "#555")
R(sx(29), sy(-0.4), sx(36), sy(-3.3), "#efe4cf", "#333", 1.5)
T(sx(32.5), sy(-2.2), "连廊", 10)
R(sx(36), sy(-0.4), sx(46.2), sy(-3.3), "#f6dcc4", "#8a3b12", 2)
T(sx(38.2), sy(-1.6), "湖景休闲厅", 11, "#8a3b12", "bold"); T(sx(38.2), sy(-2.7), "小吧台", 9, "#8a3b12")
# standalone bar house sitting on the deck, roof deck on top
R(sx(37), sy(3.2), sx(45.5), sy(0), "#f1e9d8", "#333", 2)
R(sx(36.6), sy(3.4), sx(45.9), sy(3.2), "#3a3632", "none")
out.append(f'<polyline points="{sx(37)},{sy(4.3)} {sx(45.5)},{sy(4.3)}" fill="none" stroke="#1a1a1a" stroke-width="1.5"/>')
out.append(f'<line x1="{sx(45.5)}" y1="{sy(0.1)}" x2="{sx(45.5)}" y2="{sy(2.9)}" stroke="#7fc6e0" stroke-width="4"/>')
T(sx(41.2), sy(1.9), "泳池边酒吧屋", 12, "#8a3b12", "bold"); T(sx(41.2), sy(0.8), "玻璃折叠门 → 湖", 9, "#8a3b12")
T(sx(41.2), sy(4.7), "屋顶观景台", 9, "#555")
# glass wall
out.append(f'<line x1="{sx(46.2)}" y1="{sy(-0.4)}" x2="{sx(46.2)}" y2="{sy(-3.3)}" stroke="#7fc6e0" stroke-width="4"/>')
# lower terrace
R(sx(46.2), sy(-3.3), sx(50), sy(-3.6), "#e3d8c4", "#8a7a62")
T(sx(48.1), sy(-4.4), "下沉露台", 9, "#5a3e22")
# main floor house
R(sx(13.5), sy(4.0), sx(29), sy(0), "#fbf5e8", "#333", 2)
R(sx(13.5), sy(7.4), sx(29), sy(4.0), "#fbf5e8", "#333", 2)
R(sx(21), sy(7.4), sx(29), sy(0.1), "#fffaf0", "none")  # double-height great room void
out.append(f'<line x1="{sx(21)}" y1="{sy(4.0)}" x2="{sx(21)}" y2="{sy(7.4)}" stroke="#333" stroke-width="1"/>')
T(sx(25), sy(3.4), "两层通高大客厅 ~7.4 m", 10)
T(sx(17.2), sy(1.8), "门厅 · 层高 4.0 m", 9); T(sx(17.2), sy(5.6), "二层 · 层高 3.4 m", 9)
poly([(sx(13.0), sy(7.4)), (sx(21.25), sy(16.4)), (sx(29.5), sy(7.4))], "#3a3a3c", "#222")
# arched windows to the lake
out.append(f'<line x1="{sx(29)}" y1="{sy(0.3)}" x2="{sx(29)}" y2="{sy(6.8)}" stroke="#7fc6e0" stroke-width="4"/>')
# curved stair continues down
out.append(f'<polyline points="{sx(17.2)},{sy(0)} {sx(18.6)},{sy(-1.6)} {sx(17.2)},{sy(-3.3)}" fill="none" stroke="#8a6d4a" stroke-width="3"/>')
# covered patio + pool deck (built over the lower level)
R(sx(29), sy(3.6), sx(33.5), sy(3.4), "#3a3632", "none")
out.append(f'<line x1="{sx(33.3)}" y1="{sy(3.4)}" x2="{sx(33.3)}" y2="{sy(0)}" stroke="#7d7466" stroke-width="3"/>')
T(sx(31.2), sy(4.1), "有顶露台", 9)
R(sx(29), sy(0), sx(46.6), sy(-0.4), "#e8dfcf", "#8a7a62")
# pool (drawn in front of the bar: they sit side by side in plan)
R(sx(40.5), sy(-0.05), sx(45.5), sy(-2.4), "#3fa7c4", "#1f6f87", 1.5, 'fill-opacity="0.35" stroke-dasharray="5,3"')
T(sx(43), sy(-1.0), "泳池(在旁侧)", 9, "#1f6f87", "bold")
T(sx(43), sy(-2.0), "水下窗→休闲厅", 8, "#1f6f87")
out.append(f'<line x1="{sx(45.5)}" y1="{sy(-0.05)}" x2="{sx(46.6)}" y2="{sy(-2.9)}" stroke="#7fcfe0" stroke-width="3"/>')
R(sx(46.2), sy(-2.9), sx(47.0), sy(-3.3), "#5ec2da", "#1f6f87")
T(sx(48.6), sy(-1.0), "无边际溢流", 9, "#1f6f87", anchor="start"); T(sx(48.6), sy(-1.9), "→ 集水槽", 9, "#1f6f87", anchor="start")
# bulkhead, boathouse, yacht
R(sx(61.6), sy(-4.2), sx(62.2), sy(-7.5), "#a89a82", "none")
R(sx(63), sy(-1.0), sx(77), sy(-5.0), "none", "#555", 1.5)
poly([(sx(62.5), sy(-0.9)), (sx(70), sy(1.6)), (sx(77.5), sy(-0.9))], "#3a3a3c", "#222")
R(sx(63), sy(-0.9), sx(77), sy(-1.2), "#e9dfcb", "#555")
T(sx(70), sy(-1.9), "船屋 · 顶层观景台", 10)
poly([(sx(64.5), sy(-4.6)), (sx(75.5), sy(-4.6)), (sx(74.5), sy(-5.5)), (sx(65.5), sy(-5.4))], "#fafafa", "#444")
poly([(sx(67), sy(-4.6)), (sx(68.5), sy(-3.6)), (sx(72), sy(-3.6)), (sx(72.5), sy(-4.6))], "#2c3e50", "#444")
T(sx(70), sy(-6.4), "游艇（升降机吊起）", 9, "#fff")
T(sx(70), sy(-8.2), "湖", 14, "#fff", "bold")
# levels
for z, lab in [(0, "±0.0"), (-3.3, "−3.3"), (-5.0, "−5.0")]:
    out.append(f'<line x1="{sx(D0)}" y1="{sy(z)}" x2="{sx(D0)+14}" y2="{sy(z)}" stroke="#c0392b" stroke-width="1.5"/>')
    T(sx(D0) + 2, sy(z) - 4, lab, 9, "#c0392b", anchor="start")
SECTION_BOTTOM = sy(-9)

# ---------------- lower-level plan ----------------
PS, PX0 = 16, 40
PY0 = SECTION_BOTTOM + 70
XA, DA, DB = 6, 11, 52              # shown range: x from XA, d from DA to DB
def px(x): return PX0 + (x - XA) * PS
def py(d): return PY0 + (DB - d) * PS
def room(x1, d1, x2, d2, name, sub="", fill="#efe4cf", color="#222", stroke="#555", sw=1.2, subc="#666"):
    R(px(x1), py(d2), px(x2), py(d1), fill, stroke, sw)
    cx, cy = px((x1 + x2) / 2), py((d1 + d2) / 2)
    T(cx, cy - (2 if sub else -4), name, 13, color, "bold")
    for i, line in enumerate(sub.split("|") if sub else []): T(cx, cy + 14 + i * 12, line, 9, subc)
T(PX0, PY0 - 34, "负一层平面（地下室 + 湖景休闲厅）", 18, weight="bold", anchor="start")
T(PX0, PY0 - 14, "上 = 湖　（原地下酒吧改为朝湖休闲厅，酒吧移到地面独立酒吧屋）", 11, "#666", anchor="start")
# earth around
R(px(XA), py(DB), px(40), py(DA), "#e9e2d3", "none")
# lower terrace + lawn toward lake (open side)
R(px(16), py(50), px(38), py(46.2), "#e3d8c4", "#a89a82"); T(px(27), py(48.3), "下沉湖景露台 · 火盆 · 躺椅", 11, "#5a3e22")
R(px(XA), py(DB), px(40), py(50), "#b9d99a", "none"); T(px(27), py(51), "缓坡草坪 → 湖岸 / 码头", 11, "#3d5e2f")
# pool shell (above, shown dashed) and the underwater window
R(px(16), py(45.5), px(28), py(40.5), "#3fa7c4", "#1f6f87", 1.5, 'fill-opacity="0.35" stroke-dasharray="6,4"')
T(px(22), py(42.4), "泳池（上方主层）", 11, "#1f6f87")
# bar house
room(28.6, 36, 35, 46.2, "湖景休闲厅", "", "#f6dcc4", "#8a3b12", "#8a3b12", 2)
R(px(34.1), py(42.6), px(34.8), py(39.8), "#5a3e22", "none")  # wet bar
T(px(31.4), py(39.6), "小吧台", 9, "#8a3b12"); T(px(31.4), py(38.7), "沙发 · 大屏看球", 9, "#8a3b12"); T(px(31.4), py(37.8), "台球 · 飞镖", 9, "#8a3b12")
T(px(22), py(38.2), "上方平台：独立的泳池边酒吧屋", 10, "#8a3b12")
out.append(f'<line x1="{px(28.6)}" y1="{py(44.8)}" x2="{px(28.6)}" y2="{py(41.2)}" stroke="#7fe0f0" stroke-width="6"/>')
T(px(28.2), py(44.4), "水下观景窗 →", 10, "#1f6f87", anchor="end")
out.append(f'<line x1="{px(28.6)}" y1="{py(46.2)}" x2="{px(35)}" y2="{py(46.2)}" stroke="#7fc6e0" stroke-width="5"/>')
T(px(31.8), py(46.0) - 4, "玻璃折叠门", 9, "#1f6f87")
room(35, 36, 38, 40, "卫", "", "#efe4cf")
T(px(36.5), py(41.4), "户外淋浴", 9, "#666")
# corridor under patio
room(29, 29, 33, 36, "连廊", "", "#f3ece0")
# basement under the house (x 8–34, d 13.5–29)
R(px(8), py(29), px(34), py(13.5), "#efe4cf", "#333", 2.5)
room(8, 13.5, 16, 24, "家庭影院", "10 座 · 两级阶梯", "#3b3346", "#f3e6c8", subc="#cfc3d8")
room(8, 24, 16, 29, "设备间 / 储藏", "发电机 · 净水 · 新风")
room(16, 13.5, 21, 22.5, "楼梯厅", "")
out.append(f'<circle cx="{px(18.5)}" cy="{py(19.2)}" r="{1.6*PS}" fill="none" stroke="#8a6d4a" stroke-width="2"/>')
R(px(16.2), py(22.3), px(17.8), py(20.7), "#ccc", "#555"); T(px(17), py(21.3), "电梯", 8)
room(21, 13.5, 27, 22.5, "酒窖", "恒温 13°C|玻璃墙 · 品酒桌", "#4a2c2a", "#f3e6c8", subc="#e0c9b8")
out.append(f'<line x1="{px(21)}" y1="{py(22.3)}" x2="{px(21)}" y2="{py(17)}" stroke="#7fc6e0" stroke-width="4"/>')
room(27, 13.5, 34, 23, "健身房", "")
room(27, 23, 34, 29, "SPA", "桑拿 · 蒸汽 · 冷水池")
room(16, 22.5, 27, 29, "休闲厅", "高尔夫模拟器 · 沙狐球")
out.append(f'<line x1="{px(29)}" y1="{py(29)}" x2="{px(33)}" y2="{py(29)}" stroke="#efe4cf" stroke-width="3"/>')
# scale bar
yb = py(DA) + 26
out.append(f'<line x1="{PX0}" y1="{yb}" x2="{PX0 + 5*PS}" y2="{yb}" stroke="#333" stroke-width="3"/>')
T(PX0 + 2.5*PS, yb + 16, "5 m", 11)

W = max(sx(80), px(40)) + 40
H = yb + 40
svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{W:.0f}" height="{H:.0f}" viewBox="0 0 {W:.0f} {H:.0f}"><rect width="100%" height="100%" fill="#fbfaf7"/>' + "".join(out) + "</svg>"
open(__file__.rsplit("/", 1)[0] + "/lower-level.svg", "w").write(svg)
print(W, H)
