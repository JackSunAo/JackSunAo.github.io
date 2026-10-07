# 雨夜摇篮曲 · 交接文档（云端会话 → 本地会话）

写于 2026-10-07。读完这份文档就能接着做。设计文档在 Claude Docs：
https://claude.ai/code/artifact/b9933511-3d30-49ac-a504-fd43fe9b7b40 。
可玩版 artifact：https://claude.ai/artifact/MggyqPTSJqNmigkE5cj3xu ，当前发布到 v9，v10 还没发。

## 规矩

- 只在分支 `claude/epic-sagan-c7ztcw` 上开发和推送，不开 PR，除非用户要求。
- 提交信息结尾加两行：
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
  和 `Claude-Session: https://claude.ai/code/session_01Y1dScKS4C6z7xm3LCqbZFQ`
- 代码、注释、提交信息里不写模型名。
- 用户说中文，偏好：先做一两个样品确认方向，再铺开，不要一个方向闷头做很久。

## 项目结构（`prototypes/yuye-yaolanqu/`）

| 路径 | 是什么 |
|---|---|
| `index.html` | 发布用的单文件游戏（由 `dev/build.mjs` 生成，即 `dev/dist/site.html`） |
| `dev/src/p1_core.js … p9_ui.js` | 游戏源码，按顺序拼成一个 IIFE。Three.js r146（CDN） |
| `dev/build.mjs` | `node build.mjs` → `dist/site.html`、`dist/test.html`（本地 three，经 `node_modules`）、`dist/yuye-yaolanqu.html`（CDN），并把 `chars/` 拷到 `dist/chars` |
| `dev/*.cjs` | Playwright 无头测试和截图：`test.cjs`（回归）、`test_*.cjs`、`bench.cjs`（性能）、`vis_one.cjs`、`vis_sheet.cjs`、`vis_compare.cjs`（人物截图） |
| `chars/` | 游戏读取的人物资产（`<id>.mesh.json/.bin` 加贴图 webp）。`.gitignore` 排除了样品（`*_real*`、`*_lp*` 等） |
| `chars_src/` | 离线人物管线（Python + Blender bpy），见下 |
| `art/`、`docs/style/` | 原画页面源文件；风格对比截图 |

本地运行：`cd dev && npm i three@0.146.0 && node build.mjs`，然后用浏览器打开 `dist/test.html`。读取 `chars/` 需要本地服务器（例如 `npx http-server dist`），或者 Chromium 加 `--allow-file-access-from-files`。测试脚本里写死了 Chromium 路径 `/opt/pw-browsers/...`，在 Mac 上要改成 Playwright 自带的浏览器（删掉 `executablePath` 即可）。

## 已完成（本次会话）

- **音频**（`p4_audio.js` 全部重写）：物理建模的音效库，在 Worker 里合成，HRTF 空间化、距离空气吸收、墙体遮挡、木屋和森林两种混响。感染者叫声分男女声线（`T.voice`）。测试脚本：`dev/test_audio.cjs`。
- **痛觉切断**：轻伤不退缩，骨折、断肢不暴怒（`p7_ai.js` 里的 `unfeeling()`）。设计文档已写“痛觉切断与宿主选择”一节。
- **感染者名单**：16 种女性职业装，加衣冠不整变体 `undiesF`、`lingerie`、`tornF`、`nudeF`、`undiesM`、`nudeM`（`p7_ai.js` 里的 `INF_CIV`，按权重出现在 `waveTypes`）。
- **步态**：脚步 IK，滑步已基本消除。
- **运行时多部件人物**（`p3_human.js` 里的 `loadChar`、`fleshParts`）：每个部件一个 SkinnedMesh，共用一套骨骼；雨水湿润着色（`FLESH_WET` 跟着 `G.rain` 变化）；皮肤贴图共享，伤口画在每个角色自己的 256 像素遮罩上。旧的单网格格式仍然兼容。
- **调色**：`p1_core.js` 的 grade pass 不再把高光推黄，色差也减弱了。

## 人物方向：进行到一半，需要和用户继续确认

用户的目标是《消逝的光芒》那种：低面数但好看，人多也流畅。用户否定过的方向：
- SDF 陶瓷感；
- MakeHuman 照片贴图“写实但粗糙”；
- 插画感低模（脸像娃娃）；
- 最新反馈是“模糊、发黄”。

**当前管线**（`chars_src/`）：
1. `mh.py`：MakeHuman 基础网格加形体目标（东亚、男女、年龄、胖瘦），用 LBS 拟合到游戏骨骼关节（`rigs.json`，由 `dev/dump_rigs.cjs` 从游戏导出）。
2. `mhkit.py`：读取 `.proxy` / `.mhclo`，把素材贴合到拟合后的身体上；权重从参考顶点继承；`raster_positions` 是 UV 光栅化工具。
3. `build_real.py <outfit> rigs.json <out> real`：组装一个角色（皮肤、眼、眉、睫毛、发片、衣服），包括：
   - 衣服整体重上色、锐化；
   - 按位置画泥水和血迹（`weather`）；
   - 逐层遮挡删面（`covered`）；
   - 导出多部件 `.mesh.json`。
   样品：`mei2`（幸存者小美）、`nurse2`（感染者护士）。
4. `bake_ao.py <tag> <out>`：逐部件烘焙环境光遮蔽，乘进贴图（用 Blender）。
5. `bake_lp.py` 加 `lp_color.py`：把整个人烘焙成约 6000 面加一张贴图（用作远处的模型级别）。
6. 旧管线（`body.py`、`sdf.py`、`mesh_hi.py`、`bake.py`、`color.py`、`build_char.sh`）生成了 `chars/` 里现有的 30 个角色。游戏目前还在用这批旧资产。

**还没解决的问题**：
- **素材上限**：素材库所有皮肤贴图最高只有 2048 像素，脸部五官区域只有约 300 像素，近景会糊。
- **皮肤法线太强**：`build_real.py` 里 `skin_normal` 生成的毛孔法线太强，要减弱（strength 4、pores 0.008，这次改动没来得及跑）。
- **连裤袜发黑**：护士的连裤袜被环境光遮蔽压黑，`bake_ao.py` 应该跳过 pantyhose（已写，未验证）。
- **头发太亮**：淋湿时头发过亮，`WET_KIND.hair` 改成 `[0.25, 0.35]`（未改）。
- **其余小问题**：小美腰侧露出两段裤腰；护士的血痕偏淡。

**下一步（用户最近的要求）**：用户的 Mac 上有 Codex 做的人物：`~/…/outputs/female-infected-model.zip`（GLB、Blender 源文件、贴图，34,948 面、53 骨骼、3 个精度级别），还有几张原画和对比图。在本地会话里：
1. 打开看这个模型和那几张 png（它们是美术目标）。
2. 把 GLB 绑到游戏骨骼上，放进游戏雨夜场景，和 `mei2_real`、`nurse2_real` 做对比（`dev/vis_compare.cjs` 的参数是 `look:asset,look:asset`）。
3. 把对比图给用户看，决定以哪个为基础。确认后再做 3 级远近模型和性能实测（同屏 30 人，60 帧），然后铺开到全部名单。

## 素材（不在仓库里，需要重新下载）

- **MakeHuman 基础网格和形体目标（CC0）**：https://download.tuxfamily.org/makehuman/releases/mpfb-2.0.0-a2.zip ，取里面的 `mpfb/data/{3dobjs,targets,rigs}`，放到 `MH_DATA` 目录（默认 `/tmp/claude-0/mhd`，用环境变量覆盖）。
- **社区素材包（CC0）**：https://static.makehumancommunity.org/assets/assetpacks.html 。用到的包：
  - `makehuman_system_assets_cc0.zip`：身体代理网格、眼、眉、睫毛。请用这个替换 `MH_ASSETS`（默认 `/tmp/claude-0/mha`）里带 AGPL 文件头的 1.1 旧文件。
  - `skins01`（`onlytheghosts_young_eurasian_female`）
  - `skins03`（`sohh_female_zombie_skin` 等僵尸皮肤）
  - `shirts01`、`pants01`、`shoes01`、`dress01`、`underwear01`、`hair01`
  解压后的目录设为 `MH_COMMUNITY`（默认 `/tmp/claude-0/mhc/x`），结构是 `clothes/<名字>/`、`skins/<名字>/`、`hair/<名字>/`。
- **Python 环境**：Python 3.11，`pip install bpy==5.0.1 numpy==1.26.4 numba scipy scikit-image pillow libigl`（bpy 就是无头 Blender）。在 Mac 上也可以直接用 Blender 应用的 Python。
- **CC-BY 素材**：用了的话，要在游戏里加署名。

## 常用命令

```
cd prototypes/yuye-yaolanqu/dev && node build.mjs           # 构建
node test.cjs                                                # 回归测试
node bench.cjs                                               # 性能（会打出各场景 fps 和绘制调用数）
node vis_compare.cjs mei:mei2_real,nurse:nurse2_real out.png # 人物对比截图（干燥棚灯、雨夜、游戏视距）
cd ../chars_src
python build_real.py mei2 rigs.json OUT real && python bake_ao.py mei2_real OUT && cp OUT/mei2_real* ../chars/
```
