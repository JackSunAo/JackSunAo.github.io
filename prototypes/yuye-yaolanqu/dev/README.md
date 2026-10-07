# 雨夜摇篮曲 · 源码

`../index.html` 是构建产物，所有修改都改 `src/` 里的分块文件，再重新构建。

## 构建

```
node build.mjs
```

生成三个文件：
- `dist/site.html`：复制到 `../index.html` 发布。
- `dist/yuye-yaolanqu.html`：从 CDN 加载 three，用于 artifact 页面。
- `dist/test.html`：使用本地 `node_modules/three`，供测试使用。

## 源码分块

`build.mjs` 按以下顺序拼接成一个 IIFE：

| 文件 | 内容 |
|---|---|
| p1_core | 渲染器、后处理、材质与纹理工具 |
| p2_world | 地形、木屋、雨、灯 |
| p3_human | 人物刚性部件骨骼、蒙皮图集、姿势 |
| p4_audio | 音效 |
| p5_state | 玩家、母亲与婴儿 |
| p6_fx | 血、伤口、断肢 |
| p6b_camp | 门窗、木板 |
| p7_ai | 感染者与群体指挥、嘶吼 |
| p7b_defenders | 同伴 |
| p8_player | 玩家操作与战斗 |
| p8c_perf | 合批、阴影缓存、FSR 放大、画质自动调节、对象池 |
| p9_ui | 主循环、界面、按键 |

## 测试

测试用 Playwright 跑 headless Chromium，脚本是 `test*.cjs`、`smoke.cjs`、`soak.cjs`，性能基准是 `bench*.cjs`、`hitch.cjs`。

运行步骤：
1. `npm install` 安装 three。
2. 把脚本里的 `executablePath` 改成本机 Chromium 的路径。
3. 运行 `node test.cjs`。
