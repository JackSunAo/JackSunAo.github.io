# 雨夜摇篮曲 · 角色原画任务（交给 Codex）

> 这份说明可以整份粘贴给 Codex。角色的数值、颜色、道具都取自游戏代码（`prototypes/yuye-yaolanqu/src/`），原画画出来要能直接拿去改游戏里的模型。

## 0. 要交付什么

一共 9 个角色：幸存者 5 个（你、母亲+婴儿、小赵、老周、阿梅），感染者 4 个（屠夫、学生·原发型、白领、消防员）。

**每个角色交 4 样：**

| 文件 | 内容 | 规格 |
|---|---|---|
| `<id>_hero.png` | 主视觉立绘：全身、3/4 侧身、在游戏场景的光里 | 竖版 1536×2048 |
| `<id>_turnaround.png` | 三视图：正面、侧面、背面，A-pose，中性灰底，平光 | 横版 3072×1536。三个视图同一比例：1.75 m 身高 = 1300 px |
| `<id>_poses.png` | 3 个关键动作的剪影（纯色剪影，再加一版线稿） | 横版 2048×768 |
| `<id>_palette.json` | 色板：`{"部位": "#hex"}` | 改了下文给的颜色就在这里写明 |

**另外 2 张总图：**
- `lineup.png`：全员并排，带米制身高刻度。
- `no_pain_sheet.png`：感染者“痛觉切断”设定图，要求见第 3 节。

**放置位置：** 全部放进 `art/concept/<id>/`。可以顺手做一个 `art/concept/index.html` 画廊，把图和设计说明排在一起。

## 1. 世界观与美术方向

- **场景：** 雨夜，林中的一间木屋。你守着生病的母亲和她怀里的婴儿（“摇篮曲”），和三个同伴分守门、窗。外面是一波波感染者，由一个领头的用嘶吼指挥。屋外有一盏泛光灯，屋里只有提灯。
- **气质：** 冷雨、湿木头、泥地、疲惫、护犊。写实偏风格化，克制，不卡通，也不靠血浆猎奇。
- **光的语言：**
  - 幸存者：暖色提灯主光 `#ffc27a`，加冷蓝月光轮廓光 `#8fb0dc`。
  - 感染者：冷白泛光灯 `#cfdcf0`。皮肤去饱和、偏灰绿，眼睛像动物一样反光（eyeshine）。
- **可读性第一：** 游戏用第三人称/俯视镜头，远处也要认得出谁是谁。靠大块剪影、头肩轮廓、道具和**一个**强调色区分角色，不要只有近看才看得出的细节。
- **建模约束（很重要）：** 游戏模型是轻量低模，由刚性部件挂在骨骼上：头（含头发/帽）、脖子、躯干、骨盆、上臂、前臂、手、大腿、小腿、脚（靴）。
  - 衣服做成简单外壳；外套下摆、披肩、围巾尾巴可以是单独垂片。
  - 道具是独立模型，挂在手或胸前。
  - 设计时用大形，少飘带、少碎挂件，避免多层贴身褶皱。
- **原创：** 不得像任何真人或现有游戏、影视角色（例如《最后生还者》《行尸走肉》）。

## 2. 角色设定

> 身高、体型、颜色是游戏现有数值，请保持一致；确实画得更好需要改的，写进 palette.json。下文的“近手”指左手，“远手”指右手。

### 你（玩家）`you`
- **体型与配色：**
  - 1.76 m，结实（体型系数 1.06），肤色 `#c38f6e`，胡茬。
  - 旧工装夹克 `#4a4434`，内衬 `#59503f`，裤 `#2b3035`，靴 `#1b1612`。
  - 短黑发 `#1d140e`，布帽 `#6a3b2c`，围巾 `#8a6638`，背包 `#3b382e`。
- **装备：**
  - 右手钉头球棍：木 `#7a5a3a`，握把缠胶布，头部钉了几颗钉子。可换成消防斧（见消防员）。
  - 左手提灯：暖光源，会投影。
  - 胸前背带上一支手电，冷光 `#d6e6ff`。
  - 一把短刀，只在暗杀时拔出。
- **机制关联：** 体力、肾上腺素；能抱起婴儿转移；能“附身”同伴操控他们的身体。
- **姿势：** ①提灯警戒、球棍半举；②挥棍击中瞬间；③抱婴儿撤离（婴儿在左臂，提灯还在左手）。
- **要点：** 普通人，不是特种兵。装备都是捡来改的，人看着累，但很稳。

### 母亲 `mother`（与婴儿）
- **体型与配色：**
  - 女，1.62 m，瘦（0.92）。肤色 `#d9b49b`，偏苍白，总是低着头。
  - 旧毛衣 `#76604e`，长裙 `#3b4656`，鞋 `#2a201a`，盘发 `#2a1c12`，披肩 `#6e5a4a`。
  - 左前臂缠着绷带 `#d8d0c0`。她会咳嗽，原因先留白。
- **婴儿：** 襁褓 `#e3d7c0`，小帽 `#b98c6a`。
- **摇椅：** 深木 `#5a3d27`，她几乎不离开它。
- **机制关联：** 婴儿哭声会把感染者引来，她会哼摇篮曲安抚。
- **姿势：** ①坐摇椅抱婴儿、低头哼歌；②站起来把婴儿护在身后；③把婴儿递出去（交给你）。
- **要点：** 全作情感核心，柔软、脆弱、坚韧。光要暖。

### 小赵 `zhao`（盾牌·铁管，守正门）
- **体型与配色：**
  - 1.78 m，偏瘦（0.98），体重 72 kg。肤色 `#c99a78`。
  - 藏青上衣 `#2f3c52`，外套 `#30394a`，裤 `#2a2d33`，靴 `#1c1915`，乱发 `#120c09`。
- **装备：**
  - 木板盾：4 块木板 `#5a4630`，两道铁箍，上面有爪痕和血。盾挂在胸前，由左前臂撑着。
  - 右手钢管 `#5a5d60`，一端带管接头。
- **性格：** 年轻，胆量一般（nerve 0.5），硬顶。台词“门我顶着。”
- **姿势：** ①用肩膀顶住门；②钢管举过头砸下；③盾牌猛推。

### 老周 `zhou`（长矛，守后窗）
- **体型与配色：**
  - 1.72 m，敦实（1.1），体重 80 kg。肤色 `#b88a68`，胡茬。
  - 橄榄上衣 `#4a5240`，外套 `#3f4637`，裤 `#2e2c28`，旧布帽 `#3a3f33`，稀疏灰发 `#6b6660`。
- **装备：** 长矛，2.1 m 白蜡木杆 `#8a6a46`，头上绑着一把菜刀。
- **性格：** 年长，沉稳（nerve 0.85），话少。台词“后窗我看着。”
- **姿势：** ①双手低位持矛戒备；②前刺；③靠窗监视。

### 阿梅 `mei`（砍刀·护士，屋中）
- **体型与配色：**
  - 女，1.63 m，偏瘦（0.9）。肤色 `#d4a98a`。
  - 灰蓝护士服/开衫 `#6e7f84`，裤 `#2b2f36`，鞋 `#211a15`，盘发 `#1a120c`，红围巾 `#8a3a3a`（全队最显眼的强调色）。
- **装备：** 砍刀（甘蔗刀式，截尖）；斜挎急救包，红十字已褪色。
- **性格：** 声音高，干脆。台词“谁伤了喊我。”
- **姿势：** ①砍刀横斩；②跪地给人包扎；③回头喊人。

### 屠夫 `butcher`（感染者）
- **体型与配色：**
  - 1.80 m，巨胖（1.5），体重 125 kg，大肚子。皮肤 `#b9937c`，感染后偏灰绿。
  - 灰衬衫 `#6d6658`，裤 `#2b2825`，稀疏发 `#3a2e25`。
  - 血浸硬了的屠夫围裙，从胸口垂到膝。
  - 肩上还卡着一把剁肉刀，他自己毫无察觉（痛觉切断的标志性画面）。
- **机制：** 慢（2.1 m/s），极难撞倒，头和四肢都很耐打，怕光（在光里会犹豫约 4 秒），嗓音低沉。
- **姿势：** ①沉重地蹒跚前进；②扑抱、压倒猎物；③仰头低吼。

### 学生·原发型 `student`（感染者）
- **体型与配色：**
  - 1.60 m，瘦小（0.82），体重 52 kg。肤色 `#c7a48c`。
  - 藏青校服 `#273250`，白领 `#d7d7d0`，红领带 `#7a2a2a`，乱发 `#120c09`。
  - 红棕书包 `#7a3b2e`，膝盖处裤子破了。
- **机制：** “原发型”是第一代感染者。像野兽一样四肢着地狂奔，最快（3.3 m/s），几乎不怕光，从不犹豫，嗓音尖。
- **姿势：** ①四肢着地冲刺；②扑跳；③伏低潜行。
- **要点：** 最让人不安的一个：小小的身体做野兽动作。

### 白领 `office`（感染者，通常是领头的）
- **体型与配色：**
  - 1.74 m，普通（1.0）。肤色 `#c9a084`。
  - 白衬衫 `#c9ccd0`，深色领带 `#2b3340`，挂着工牌，黑裤 `#1f2226`，短发 `#2a1f17`。
  - 左臂肘部断了，反向耷拉着，还照样拿来挥。
- **机制：** 最聪明（smart 0.9），一般由他当头领，用嘶吼指挥同类。嘶吼分几种：
  - 发现猎物
  - 包抄
  - 同伴倒下时的哀嚎
  - 灯灭了，围上去（长嚎）
  - 撤
- **姿势：** ①仰头长嚎、指挥；②弓身潜行；③用断臂挥打。
- **加画：** 一张嘶吼表情小图，画出“发现、包抄、围上、撤”4 种。

### 消防员 `fireman`（感染者）
- **体型与配色：**
  - 1.82 m，高壮（1.18），体重 92 kg。肤色 `#c29a80`。
  - 消防外套与裤 `#3a3a30`/`#33322a`，带反光条。
  - 头盔 `#8a6a22`，黄铜土黄色，后沿很长。靴 `#1a1714`，短发。
- **装备：** 消防斧：红色斧头 `#8e1f18`，钢刃，背面带尖镐。能劈开门和木板。
- **机制：** 怕光（在光里会犹豫约 3 秒）；会举斧蓄力，然后劈下（axeWind → axeSwing）。
- **姿势：** ①拖着斧头走；②举斧过头蓄力；③劈门。

## 3. 感染者设定：痛觉切断（要单独出 `no_pain_sheet.png`）

这是游戏机制，原画要让人一眼看懂：

1. **挨打只有物理反应，没有痛苦反应：** 不缩手、不惨叫、不因伤后退。被打中只会被冲量推开，或者失去平衡踉跄、摔倒。
2. **伤了照样用：**
   - 断臂耷拉着照样挥。
   - 腿断了就拖着走、爬着来。
   - 刀卡在身上也不管。
   - 迎着刀刃往前压。
3. **只有三种方式能让它停下：** 破坏大脑（打头）、失血、结构上动不了（腿毁了只能爬，脊柱断了才算完）。
4. **视觉特征：**
   - 脸是松弛的，没有痛苦表情，下巴耷拉着。
   - 眼睛不眨，会反光。
   - 受伤的部位没有任何保护性姿态。
   - 肢体角度明显不对，但动作很流畅。
5. **对照：** 人类会缩、会捂伤口、会龇牙、会瘸。
6. **声音：** 感染者被打不叫，它们的声音只用来通信（嘶吼就是信号）。

**这张图画 4 格：**
1. 同一记重击，人与感染者的反应对比。
2. 断臂照样挥打。
3. 肩上卡着刀继续走（屠夫）。
4. 没有腿的爬行者仍在逼近。

## 4. 风格统一规则

- 所有图用同一种画法：厚涂或半厚涂数字绘画，暗部压低，轮廓光清楚。
- 主视觉统一：略低于眼平的机位，雨夜，地面湿反光。幸存者用暖光，感染者用冷光。
- 三视图统一：平光、中性灰底、正交视角、同一比例，脚底对齐在同一条线。
- 剪影统一：同一画布高度，脚底对齐。

## 5. 生图提示词（英文，供能出图的模型直接用）

**通用前缀**（每张主视觉都加）：
```
original character concept art for a grim survival game, painterly digital painting, full body, three-quarter view,
standing on wet muddy ground at night in heavy rain, muted desaturated palette with a single accent color,
realistic proportions, restrained and gritty, strong readable silhouette, cold blue moonlight rim light,
dark simple background, detailed face and hands, no text, no watermark
```
- 幸存者追加：`warm lantern key light from the left, inside a rough plank cabin, boarded window leaking moonlight`
- 感染者追加：`cold white floodlight from the upper right, fog between dark tree trunks, eyes reflecting light like an animal, slack expressionless face, grey-green desaturated skin`

**各角色（接在前缀后面）：**
```
you: tired 30-something man, 1.76m sturdy build, stubble, faded rust cloth cap, mustard wool scarf, worn olive-brown work jacket over a brown shirt, dark trousers, heavy boots, small canvas backpack, a baseball bat with nails driven through the head and taped grip in his right hand, an old kerosene lantern glowing in his left hand, a small flashlight clipped to the chest strap
mother: frail pale woman, 1.62m, hair in a low bun, worn brown knit sweater, long slate-blue skirt, fringed brown shawl, a cloth bandage on her left forearm, sitting in a wooden rocking chair cradling a swaddled baby in cream cloth with a small brown knit cap, head bowed, humming
zhao: lanky young man, 1.78m, messy black hair, navy jacket over a navy shirt, a shield made of four nailed wooden planks with two iron straps and claw gouges held on his left forearm in front of his chest, a steel pipe with a coupling end raised in his right hand, nervous but determined
zhou: stocky older man, 1.72m, thin grey hair under a faded olive cap, stubble, olive field jacket, dark trousers, a 2-meter ash pole spear with a kitchen knife lashed to the tip with cord, held low in both hands, calm watchful eyes
mei: slim woman, 1.63m, hair in a tight bun, a deep red scarf, grey-blue nurse cardigan over scrubs, dark trousers, a machete with a clipped point in her right hand, a canvas medic satchel with a faded red cross worn across the body
butcher (infected): huge obese man, 1.80m 125kg, thinning hair, grey shirt, a butcher's apron stiff with old blood from chest to knees, a meat cleaver stuck deep in his left shoulder that he ignores, hunched, jaw hanging open, glowing pale eyes
student (infected): small thin teenager, 1.60m, navy school uniform jacket and trousers, white collar, red tie, torn trouser knee, rust-red school backpack, crouched low on all fours like a feral animal, head raised, mouth open
office worker (infected, pack leader): 1.74m, blood-stained white dress shirt, dark tie, lanyard with an ID card, black trousers, left forearm broken and hanging backwards at the elbow with bone showing, still swinging it, head thrown back mid-howl, commanding
fireman (infected): tall heavy man, 1.82m, dark olive turnout coat and trousers with pale reflective stripes, brass-ochre firefighter helmet with a long back brim, heavy boots, a red fire axe with a steel edge dragging in his right hand, blood on the coat, slack face
```

**三视图：**
```
character turnaround model sheet of the same character, front view, side view, back view, A-pose, full body,
neutral grey background, orthographic, flat even lighting, consistent proportions and scale, clean shapes
suitable for a low-poly 3D model, no background, no text
```

**负面词：**
```
anime, chibi, cartoon, 3d render, plastic skin, oversaturated, extra limbs, extra fingers, deformed hands,
close-up gore, text, logo, watermark, frame, multiple characters
```

## 6. 如果 Codex 不能直接出图

1. 按第 5 节的提示词，给每张图写好最终版提示词，存成 `art/concept/prompts.md`。用户可以拿去其他生图工具出图。
2. 用 HTML 加 SVG/Canvas 做 `art/concept/index.html` 画廊，图位先放占位。至少画出两样：
   - 按第 2 节数值的身高对比剪影；
   - 色板。
3. 用户把出好的图放进对应文件夹后，画廊自动显示。

## 7. 交回时请附

- 所有 PNG，以及每个角色的 `palette.json`。
- 一张表：哪些颜色或设计相对上文改了、为什么改。
- 三视图里有哪些部件需要单独建模，例如外套下摆、披肩、头盔后沿。我会据此改游戏里的低模，保持动画骨骼不变。
