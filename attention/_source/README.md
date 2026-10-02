# Attention Is All You Need · 30 秒 —— 生成源码

`attention/` 页面里的视频完全由代码逐帧生成：画面用 Canvas（Skia）按时间函数绘制，配乐用 Python 合成。
本目录以下划线开头，Jekyll 不会把它发布到网站上，只保存在仓库里，方便以后改文案或重新渲染。

## 一键重建

```bash
cd attention/_source
./build.sh          # 约 10–20 分钟，取决于 CPU
```

产物在 `out/`：`attention-is-all-you-need-4k.mp4`、`attention-is-all-you-need-1080p.mp4`。

依赖：Node 18+、Python 3（`numpy` `scipy` `fonttools`）、带 `libzimg` 和 `libx264` 的 ffmpeg。

## 文件

| 文件 | 作用 |
| --- | --- |
| `scene.mjs` | 全部画面与时间线（1920×1080 设计坐标，时间单位为秒） |
| `lib.mjs` | 缓动、配色、字体、文字遮罩动画、曲线等工具 |
| `render.mjs` | 渲染静帧（`stills`）或一段视频（`video`），快速运动处用 8 次、其余用 4 次子帧做运动模糊 |
| `make.mjs` | 把 1800 帧切块并行渲染成无损分段 |
| `audio.py` | 合成配乐与音效，事件时间与画面一一对应 |
| `encode.sh` | 高光柔光、BT.709、误差扩散抖动，编码 4K / 1080p 成片 |
| `fetch-fonts.sh` | 下载字体（均为 SIL OFL）并生成静态字重 |

## 修改与预览

- 字幕文案：`scene.mjs` 里的 `CAPS` 和 `SECTIONS`。
- 渲染几张静帧检查：`node render.mjs stills 1 out/stills 5.4 10.8 16.9`（第二个参数是缩放，1 = 1080p，2 = 4K）。
- 配色：`lib.mjs` 里的 `COL`。

## 字体

Instrument Serif、IBM Plex Mono、Noto Serif SC、Noto Sans SC，均来自 [google/fonts](https://github.com/google/fonts)，SIL Open Font License。
