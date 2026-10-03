# 湖景豪宅 3D 模型

外观参照 AI 效果图和视频，配色取自 AI 图。整套模型全部由 Python 脚本在 Blender 里程序化生成，所有尺寸都是参数，改参数后重新运行脚本即可。

## 目录

| 路径 | 内容 |
|---|---|
| `design/siteplan.py` → `site-plan.svg` | 总平面：主屋、花园、泳池、酒吧屋、船屋、码头、车库、机库、停机坪 |
| `design/lowerlevel.py` → `lower-level.svg` | 负一层平面 + 从街道到湖的剖面 |
| `design/barhouse.py` → `bar-house.svg` | 泳池边酒吧屋放大平面 |
| `model/build_massing.py` | 第一步：白模（体块、地形、湖、船屋、直升机等） |
| `model/materials.py` | 程序化材质：砖、石灰岩、横挂板、沥青瓦、金属屋面、窗框、水面等 |
| `model/landscape.py` | 后院景观：六个主题花园、被围合的活动草坪（秋千、野餐、儿童游乐、烧烤亭、火坑、沙滩）、湖岸、码头、野花草地 |
| `model/details.py` | 第二步：立面细节，包括窗框和格条、窗套和窗头、壁灯、菱形砖纹、绿篱、植物 |
| `model/build_detailed.py` | 第二步总入口：白模 + 细节 + 材质 + 黄昏灯光，输出效果图 |
| `renders/massing/` | 白模渲染图 |
| `renders/detail/` | 细节和材质阶段的渲染图 |

## 坐标约定（所有脚本统一）

- X：从地块左边线往右，单位米
- Y：从街道往湖的方向，单位米；湖岸线在 Y = 100（主屋后墙到湖岸约 70 m）
- Z：以主层地面为 ±0；地下层 −3.3；湖常水位 −5.0
- 层高：一层 4.0 m，二层 3.4 m

## 运行

需要 Blender 4.2 的 Python 模块（`pip install bpy==4.2.0`，要求 Python 3.11），也可以用 Blender 自带的 Python。

```bash
cd house/model
python build_massing.py             # 白模：生成 massing.blend 和 renders/massing/*.png
python build_detailed.py            # 细节和材质：生成 detailed.blend 和 renders/detail/*.png
python build_detailed.py --preview  # 快速预览（半分辨率、低采样）
python build_detailed.py --views front,lake   # 只渲染指定视角
```

用 Blender 程序本身运行也可以：`blender -b -P build_detailed.py -- --views front`

视角：`front`（正面，对应 AI 图机位）、`lake`（从湖面回看）、`pool`（从泳池看湖）、`lawn`（从湖边火坑回看草坪和主屋）、`garden`（宿根花境看向睡莲池凉亭）、`aerial`（鸟瞰）。

在有 NVIDIA 显卡的电脑上，可以在 Blender 偏好设置里打开 GPU（CUDA/OptiX）渲染，同样的画面会快 10–50 倍。
