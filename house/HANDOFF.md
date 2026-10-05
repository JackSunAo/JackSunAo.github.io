# 交接文档：湖景豪宅照片级建模（给 Codex）

> 仓库：`JackSunAo/JackSunAo.github.io`，分支 `claude/trusting-ride-4hfhsb`。所有项目文件都在 `house/` 下。
> 本文档写于 2026-10-05，是接手时的唯一入口；`PROGRESS.md` 是逐日进度日志，`README.md` 是对外说明。

---

## 1. 用户是谁、要什么

- 用户用中文交流，**聊天回复必须用中文**。
- 最终目标：**一个浏览器里可自由探索、照片级逼真的 3D 别墅场景**（第一人称走动、房间传送、昼夜切换），发布到 GitHub Pages（`jacksunao.github.io/house/`）。
- 用户定下的工作流程（必须遵守）：**先出效果图 → 用户逐个确认 → 再做 3D 可探索场景**。每个房间（包括每间卧室、每个卫生间）都要有效果图给用户看过。
- 用户反感：效果图出得慢、空等没有进度、房间“摆样子”不真实。选型类对比（颜色、材质）尽量用快速方法出图（见 §6 “快速换色”）。
- 用户的硬性需求清单：
  - 外观配色照 AI 图 `design/reference/ai_front.webp`（奶油砖、石灰岩山墙、灰褐横挂板、炭灰沥青瓦、黑窗框、深古铜金属门廊屋面）；室内照两段看房视频（截图在 `design/reference/video_*.jpg`）。
  - 泳池；两车位侧入车库；湖景（房后大湖、湖离房子要远）；船屋 + 游艇；停机坪 + 直升机 + 机库（机库已降低）；
  - 书房书柜暗门后的武器库（通用造型的手枪、步枪、工具）；
  - 地下室（影院、酒窖、健身房 + 桑拿、湖景休闲厅）；独立泳池边酒吧屋（不在地下室）；
  - 真正的多主题花园（不只是玫瑰）；大活动草坪（野餐、玩耍、秋千、烧烤），要真实、比例协调、不空；
  - 室内软装风格：**方案 5「经典深色对比」+ 原墨绿色丝绒沙发**（用户已确认，见 `renders/style/`）；
  - 房间要像真实生活：游戏室要有 PS5 Pro、Switch 等主机和大屏幕，健身房器械要齐全，以此类推；
  - 卧室 2 的床上整齐摆放 5 只 BabaDoll「小眠羊」毛绒玩偶（参考图 `design/reference/lamb/`，详见 §5）。

---

## 2. 当前进度

| 阶段 | 状态 |
|---|---|
| 白模、真实构造、PBR 外立面、前后院植物、户外设施（M1–M5） | 完成 |
| 室内第一轮 + 地下室 + 武器库 + 车辆（M6） | 完成 |
| 第一轮全套效果图 20 张（M7）`renders/final/*.jpg` + 总览 `sheet_exterior.jpg` / `sheet_interior.jpg` | 完成 |
| S1 软装风格选型（5 个方案 + 方案 5 的 6 种沙发色） | 完成，用户选：方案 5 + 墨绿沙发 |
| S2 全屋按方案 5 重新布置 + 补齐卫生间/衣帽间等（`rich.py`） | 完成 |
| S3 全部房间效果图（25 个房间）`renders/rooms/*.jpg` + 总览 `sheet_rooms1~4.jpg` | 已出图，**等用户逐个确认**；我自检发现的问题见 §7 |
| 小眠羊 5 只玩偶建模（`lamb.py`）并放到卧室 2 床上 | 模型完成；高清特写 `int_lambs` 交接时正在渲染（可能没渲完，重渲见 §4） |
| S4 浏览器可探索 3D 场景 | **未开始**（等 S3 确认） |

还没做的房间：洗衣房、车库内部（S2 计划里有，未建）。

---

## 3. 环境（每次新机器都要做）

```bash
# Blender 4.2 的 Python 模块，需要 Python 3.11
python3.11 -m venv venv && venv/bin/pip install bpy==4.2.0 pillow
cd house/model
../../venv/bin/python build_final.py --views front --preview     # 第一次运行会自动下载 Poly Haven 资源到 house/assets/
```

- `house/assets/`（HDRI、贴图、模型，约 80 个 Poly Haven CC0 资源）不进 git，`assets.py` 会自动重新下载。
- `house/model/final.blend`（约 260 MB，超过 GitHub 上限）不进 git，每次 `build_final.py` 运行都会重新生成。
- 渲染机器只有 4 核 CPU、15 GB 内存：一张 1600×1100、128 采样的室内图约 7–15 分钟；整套几小时。**有 GPU 就开 OptiX/CUDA**。
- 中文字体（拼总览图用）：`/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc`；拼图用 ImageMagick `montage`。

---

## 4. 怎么出图

```bash
cd house/model
# 预览（半分辨率、32 采样）
python build_final.py --views int_lambs,int_master --preview
# 正式图到指定目录，已存在的跳过
RENDER_OUT=$(pwd)/../renders/rooms NOISE=0.03 python build_final.py --views int_kitchen,int_gym --samples 40 --scale 0.7 --skip-existing
# 外景正式图（第一轮用的参数）
NOISE=0.02 python build_final.py --views front,lake --samples 128
```

- 参数：`--views a,b`、`--preview`、`--samples N`、`--scale 0.7`、`--skip-existing`、`--no-interior`、`--no-plants`。
- 环境变量：`RENDER_OUT`（输出目录）、`NOISE`（自适应采样阈值，默认 0.015）、`STYLE`（软装方案，默认 `moody`）、`SOFA=velvet:#1e2b45`（覆盖沙发面料）、`DUSK_EXPOSURE`、`INSIDE_EXPOSURE`、`INSIDE_RL`、`SUN_E`、`ROOM_W`。
- 所有视角：外景在 `build_massing.py` 的 `VIEWS`（front、lake、pool、lawn、garden、aerial），其余在 `build_final.py` 的 `EXTRA_VIEWS`（front_close、heli、dock、int_*）。灯光模式在 `build_final.py` 的 `LIGHT`：`dusk` 黄昏、`day` 白天、`inside` 白天 HDRI + 室内补光（第三个数是曝光）。
- `CLOSEUPS = {"int_lambs"}`：这些镜头渲染时会隐藏前后院植物和远景树林，否则毛发 + 植被会爆内存（OOM）。
- 交接时：`int_lambs` 高清版可能没渲完。重渲：`RENDER_OUT=$(pwd)/../renders/rooms NOISE=0.02 python build_final.py --views int_lambs --samples 96`。

---

## 5. 代码地图（`house/model/`）

| 文件 | 内容 |
|---|---|
| `build_final.py` | **总入口**：搭场景（调用下面所有模块）、灯光、相机、渲染。`EXTRA_VIEWS` / `LIGHT` / `CLOSEUPS` 在这里 |
| `build_massing.py` | 地形 `ground(x,y)`、湖、泳池平台、船屋、停机坪、机库体块，外景相机 `VIEWS`，基础工具函数 |
| `house_real.py` | 主屋真实构造：`FOOTPRINT`、`WINDOWS`、`ROOMS`（房间表）、`PARTITIONS`（内隔墙 + 门洞）、楼板开洞、屋顶 |
| `facade.py` | 窗框、格条、拱窗、前门、窗套、檐沟；`interior_trim()` 室内窗套窗台 |
| `materials_pbr.py`, `materials.py` | PBR 贴图材质（按 AI 图配色调色）和旧版程序化材质 |
| `assets.py` | Poly Haven 下载缓存（HDRI、贴图、模型） |
| `props.py` | Poly Haven 家具导入（.blend 读不了时自动退回 glTF）和摆放 |
| `interiors.py` | 第一轮室内：弧形楼梯 + 叠环吊灯、书房、餐厅、大客厅、厨房、游戏室结构、主卧、筒灯、踢脚线 |
| `furnish.py` | 五种软装方案调色板 + 程序化现代家具（沙发、单椅、茶几、抱枕） |
| `rich.py` | **第二轮“真实生活”布置**：游戏室（85 寸电视、PS5 Pro、Xbox、Switch、街机、台球）、健身房全套、主卧套间（主卫、衣帽间）、各卧室、4 个卫生间 + 公共卫生间、厨房/餐厅/书房/影音室摆件 |
| `armory.py` | 武器库 + 书房暗门（程序化通用枪械和工具） |
| `lowerlevel.py` | 地下室：影院、拱顶酒窖 + 品酒室、健身房 + 桑拿、湖景休闲厅 |
| `lamb.py` | **5 只小眠羊毛绒玩偶**：粒子毛发羊羔绒、兜帽 + 蕾丝花边 + 小角、垂耳、刺绣眼睛、格子围兜、蝴蝶结；`on_bed()` 排成一排 |
| `front_yard.py`, `rear_yard.py`, `vegetation.py`, `landscape.py` | 前后院植物、六个主题花园、草坪、湖岸、树林；植物实例化和程序化植物 |
| `outdoor.py`, `outdoor2.py` | 泳池水和马赛克、户外家具、酒吧屋、游乐设施、烧烤亭、花园石板路、邻地树林、远岸森林、停机坪 |
| `vehicles.py` | 直升机、游艇、摩托艇 |

坐标约定：X 向右，Y 从街道指向湖（湖岸 Y=100），Z 主层地面 ±0；一层层高 4.0 m，二层 3.4 m（`EAVE=7.4`），地下层 −3.9。

### 小眠羊（`lamb.py`）

| 键 | 名称 | 坐高 | 要点 |
|---|---|---|---|
| `palm` | 小眠羊 掌心小偶 | ~15 cm（尺寸图看不清，估计） | 白，粉色脚掌，格子围兜 |
| `doll` | 小眠羊 玩偶 | 25 cm | 白，格子围兜 + 蕾丝边 + 白蝴蝶结 |
| `night` | 小眠羊特别版 夜话 | 25 cm | 白身白兜帽，黑脸、黑耳、黑手脚 |
| `hug` | 小眠羊 抱偶 | 37 cm | 大号白色 |
| `messenger` | 小眠羊特别版 信使 | ~31 cm（估计） | 粉色，白脸白角，大白缎带蝴蝶结，棕色眼睛 |

用户给的 10 张参考图里只有这 5 只，其余是重复视角（已核对）。摆放：卧室 2 床上（床头 `B2Bed`，x 12.7，y 20.92，二楼），一排，最高的在中间，面向床尾。相机 `int_lambs`。
已知差距：毛发比产品图的羊羔绒卷更松软、不够“颗粒”；脸周蕾丝花边偏粗、像一圈环。

---

## 6. 坑和技巧（踩过的）

- **bpy 退出时段错误（exit 139）**：渲染已经写盘后 Blender 在退出时崩，不影响结果；以日志里的 `rendered <路径>` 为准。
- **粒子毛发**：Blender 4.2 里 `hair_length = 4 × normal_factor`，所以长度用 `normal_factor = length / 4` 设；粒子材质用 `settings.material = 槽位序号(从 1 开始)`，不要用 `material_slot`；没有 `child_nbr`，用 `child_percent`。
- **内存**：全场景约 7 GB；再加毛发会 OOM（被 cgroup 杀掉）。特写镜头放进 `CLOSEUPS`。
- **长时间渲染要被会话跟踪**：nohup 出去的进程在会话空闲后会被系统清掉，曾经因此白等两小时。用能被跟踪的后台任务跑，并且每出一张就提交。
- **不要 `pkill -f <模式>`** 去匹配会出现在自己命令行里的字符串（会把自己的 shell 也杀了）。
- **重叠共面的面会渲出黑斑**（柜门框、窗套曾出现）：拼装零件时让它们错开 1–2 mm 或不重叠。
- **布尔挖洞**：浴缸、台盆用 `rich.hollow()`（EXACT 布尔）挖出真空腔；房屋开洞用 `house_real._boolean`。
- **快速换色（选型用）**：不用整张重渲。先用 Blender 渲一张物体 ID 遮罩（对象 `pass_index` + 合成器 ID Mask），再用浅色版本的渲染作光照参考按通道换色。脚本思路在 PROGRESS 日志里；几分钟出 6 个颜色方案。
- 几个 Poly Haven 模型 .blend 读不了（`classic_laptop`、`bananas`、`stationery_supplies`），会自动退回 glTF，日志里的 “not a blend file” 报错可以忽略。

---

## 7. 交接时已知要改的地方（S3 自检）

1. **卧室 4、一楼客卧**：房间 13 m 长又窄，现在的机位像走廊、家具在镜头背后；需要重新取景或用隔断/衣帽间把房间分成两段。
2. **卫生间**偏素：加挂画、绿植、毛巾、台面小物。
3. **书房**的笔记本是老式米白模型，换成现代款。
4. **主卧衣帽间**的衣服是简单条块，近看不真实。
5. **游戏室**（`int_game2`）和**主卧**、**卧室 2** 仍可再丰富。
6. 洗衣房、车库内部还没建。
7. 小眠羊：毛发卷曲度、脸周花边（见 §5）。

用户还没对 S3 的 25 张图逐个表态——接手后先把 `renders/rooms/sheet_rooms1~4.jpg` 和 `int_lambs` 发给用户确认，再按反馈改。

---

## 8. 下一大步：S4 浏览器可探索场景（建议方案）

1. 用户确认全部房间后，从 `final.blend` 导出 glTF（Draco 压缩）；植被、家具按距离做 LOD；毛绒玩偶用简化毛发卡片或烘焙法线。
2. 在 Blender 里烘焙光照贴图（lightmap，第二套 UV），网页里实时走动时保留效果图的明暗质感；昼夜各烘一套或用环境贴图切换。
3. three.js 漫游器：第一人称 WASD + 鼠标、碰撞（墙、楼梯坡道）、俯瞰模式、房间传送按钮（门厅、大客厅、厨房、游戏室、武器库、影院、酒窖、泳池、花园、湖边、停机坪……）、白天/黄昏切换。
4. 发布到 `jacksunao.github.io/house/`（本仓库就是 GitHub Pages 站点）。

---

## 9. 文件和产出位置

- 效果图：`renders/final/`（第一轮外景 + 室内，JPG 进 git，PNG 不进）、`renders/rooms/`（第二轮 25 个房间 + 总览）、`renders/style/`（风格和沙发色选型）、`renders/massing/`、`renders/detail/`（早期阶段）。
- 设计资料：`design/`（总平面 `site-plan.svg/png`、负一层平面和剖面、酒吧屋平面、植物选型页 `plant-catalog/`、参考图 `reference/`）。
- 进度日志：`PROGRESS.md`（按日期追加，接手后继续在末尾追加）。
- 提交规范：在分支 `claude/trusting-ride-4hfhsb` 上提交并推送；不要提交 `*.blend`、`house/assets/`、渲染 PNG（`.gitignore` 已配置）。
