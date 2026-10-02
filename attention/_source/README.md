# Attention Is All You Need · 动画源码（2 分钟版 + 30 秒预告版）

`attention/` 页面里的视频完全由代码逐帧生成：画面用 Canvas（Skia）按时间函数绘制，配乐用 Python 合成。
本目录以下划线开头，Jekyll 不会把它发布到网站上，只保存在仓库里，方便以后改文案或重新渲染。

## 一键重建

```bash
cd attention/_source
./build.sh                 # 两个版本都生成，2 分钟版约 20 分钟（4 核）
FOURK=1 ./build.sh         # 另外输出 2 分钟版的 4K（约 100 MB）
MUSIC=/path/to/your.wav ./build.sh   # 用你自己的音频替换配乐
```

产物在 `out/`：`attention-2min-1080p.mp4`（2 分钟版）、`attention-is-all-you-need-4k.mp4` / `-1080p.mp4`（30 秒版）。

依赖：Node 18+、Python 3（`numpy` `scipy` `fonttools`）、带 `libzimg` 和 `libx264` 的 ffmpeg。

## 文件

| 文件 | 作用 |
| --- | --- |
| `scene-long.mjs` + `long_*.mjs` | 2 分钟版：整条时间线锁定在 120 BPM 网格（1 拍 = 0.5 s，1 小节 = 2 s）。`long_common.mjs` 放章节、字幕与节拍镜头抖动，`long_open.mjs` 是开场的论文第一页，其余按章节拆分 |
| `audio_long.py` | 2 分钟版的原创配乐：鼓、贝斯、钩子旋律 + 每个画面事件对应的音效，全部在同一个节拍网格上 |
| `encode-long.sh` | 2 分钟版的高光柔光 / BT.709 / 抖动 / 控制体积的编码 |
| `scene.mjs` | 30 秒版的全部画面与时间线（1920×1080 设计坐标，时间单位为秒） |
| `lib.mjs` | 缓动、配色、字体、文字遮罩动画、曲线等工具 |
| `render.mjs` | 渲染静帧（`stills`）或一段视频（`video`），快速运动处用 8 次、其余用 4 次子帧做运动模糊 |
| `make.mjs` | 把 1800 帧切块并行渲染成无损分段 |
| `audio.py` | 合成配乐与音效，事件时间与画面一一对应 |
| `encode.sh` | 高光柔光、BT.709、误差扩散抖动，编码 4K / 1080p 成片 |
| `fetch-fonts.sh` | 下载字体（均为 SIL OFL）并生成静态字重 |

## 修改与预览

- 字幕文案：30 秒版在 `scene.mjs` 的 `CAPS` 和 `SECTIONS`；2 分钟版在 `long_common.mjs` 的 `CH` 和 `BEATS`。
- 渲染 2 分钟版的静帧：`SCENE=./scene-long.mjs node render.mjs stills 1 out/stills 3.6 38.9 90.8`。
- 想对着别的歌重新卡点：改 `long_common.mjs` 里的 `BPM`，并按新的拍子调整各章节起止时间。
- 渲染几张静帧检查：`node render.mjs stills 1 out/stills 5.4 10.8 16.9`（第二个参数是缩放，1 = 1080p，2 = 4K）。
- 配色：`lib.mjs` 里的 `COL`。

## 字体

Instrument Serif、IBM Plex Mono、Noto Serif SC、Noto Sans SC，均来自 [google/fonts](https://github.com/google/fonts)，SIL Open Font License。
