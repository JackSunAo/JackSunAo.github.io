// Shared timeline, captions and chrome for the 2-minute cut.
// Everything is locked to a 120 BPM grid: 1 beat = 0.5 s, 1 bar = 2 s, 1 phrase (4 bars) = 8 s.
import {
  clamp, lerp, prog, easeOutCubic, easeInCubic, easeInOutCubic, easeOutExpo, win, COL, rgba, font, text, reveal,
} from './lib.mjs';

export const W = 1920, H = 1080, DURATION = 120, BPM = 120, BEAT = 60 / BPM, BAR = BEAT * 4;
export const beat = (n) => n * BEAT;

export const F = {
  mono11: font('Mono400', 11),
  mono12: font('Mono400', 12),
  mono13: font('Mono400', 13),
  monoL12: font('Mono300', 12),
  head: font('SerifSC500', 44),
  sub: font('SansSC400', 20),
};

// ---------------------------------------------------------------- the sentence
export const WORDS = ['The', 'animal', "didn't", 'cross', 'the', 'street', 'because', 'it', 'was', 'too', 'tired'];
export const N = 11, IT = 7;
export const W_TIRED = [0.02, 0.58, 0.03, 0.02, 0.01, 0.12, 0.04, 0.06, 0.03, 0.03, 0.06];
export const W_WIDE = [0.02, 0.10, 0.03, 0.02, 0.04, 0.60, 0.04, 0.06, 0.02, 0.02, 0.05];

// ---------------------------------------------------------------- chapters & captions
export const CH = [
  { n: '01', tag: 'RECURRENCE', t0: 10, t1: 20 },
  { n: '02', tag: 'SELF-ATTENTION', t0: 20, t1: 32 },
  { n: '03', tag: 'QUERY · KEY · VALUE', t0: 32, t1: 52 },
  { n: '04', tag: 'SCALING', t0: 52, t1: 60 },
  { n: '05', tag: 'MULTI-HEAD ATTENTION', t0: 60, t1: 70 },
  { n: '06', tag: 'POSITIONAL ENCODING', t0: 70, t1: 78 },
  { n: '07', tag: 'THE TRANSFORMER', t0: 78, t1: 94 },
  { n: '08', tag: 'WHY SELF-ATTENTION', t0: 94, t1: 102 },
  { n: '09', tag: 'RESULTS', t0: 102, t1: 110 },
  { n: '10', tag: 'LEGACY', t0: 110, t1: 116 },
];

export const BEATS = [
  [10.2, 15.8, '过去：循环网络逐词阅读', '第 t 个词必须等第 t−1 个词算完，所以无法并行'],
  [16.0, 19.8, '距离越远，信息越容易丢失', 'it 想知道指代谁，要把 animal 的信息传 6 步——既慢，又会丢'],
  [20.2, 23.8, '只用注意力', '每个词直接看向所有的词，任意两个词之间只隔一步'],
  [24.2, 27.8, 'it 该看谁？', '注意力权重：it 对 animal 的关注最高，达 0.58'],
  [28.2, 31.8, '上下文变了，答案也变', '把 tired 换成 wide，it 就转而指向 street'],
  [32.4, 37.8, '每个词变成三个向量', 'Q 是检索词，K 是索引标签，V 是正文内容——像查资料一样'],
  [38.2, 43.8, 'Q 与每个 K 做点积', '越匹配，分数越高：it 的 Q 与 street 的 K 最匹配'],
  [44.2, 47.8, '缩放，再 softmax', '除以 √dk 后归一化成权重，总和为 1'],
  [48.2, 51.8, '按权重汇总 V', 'it 的新向量里，融入了 street 的信息——这就是「注意」'],
  [52.2, 59.6, '为什么要除以 √dk', '维度越大，点积越大，softmax 会挤成尖峰、梯度趋近于零；缩放让它保持平稳'],
  [60.2, 69.6, '多头注意力：8 个视角并行', '512 维切成 8 × 64，每个头学习一种关系，最后拼接、线性变换'],
  [70.2, 73.8, '注意力不知道谁在前、谁在后', '把词序打乱，每个词得到的权重一模一样'],
  [74.2, 77.8, '给每个位置加一组正弦波', '不同频率的正弦、余弦，让每个位置都有独一无二的“指纹”'],
  [78.2, 83.8, '编码器：注意力 + 前馈网络', '每个子层外套残差连接与层归一化，堆叠 6 层'],
  [84.2, 89.8, '解码器：遮罩自注意力', '生成第 i 个词时只能看已生成的部分，不能偷看答案'],
  [90.2, 93.8, '交叉注意力：边译边回看原文', '解码器的 Q 去查编码器的 K、V——译 es 时，它在看 it 和 animal'],
  [94.2, 101.8, '为什么偏偏是注意力？', '任意两个位置之间的最长路径：自注意力 1 步，卷积 log n，循环 n'],
  [102.2, 109.8, '更准，也更省', '英德翻译 28.4 BLEU，比此前最好成绩（含集成）高出 2 分以上；训练只要 3.5 天'],
  [110.2, 115.8, '此后的大模型，几乎都由此出发', '从 GPT、BERT 到今天的大语言模型，都是 Transformer 的后代'],
];

// fade a whole shot: returns the alpha and (optionally) leaves it to the caller to setFade
export const shot = (t, a, b, fin = 0.5, fout = 0.5) => win(t, a, b, fin, fout, easeOutCubic, easeInOutCubic);

// ---------------------------------------------------------------- beat pulse (drives a subtle camera kick)
export function kick(t) {
  const ramp = clamp((t - 8) / 2);
  if (ramp <= 0) return 0;
  let e = 0;
  const k = Math.floor(t / BEAT);
  for (let j = k - 2; j <= k; j++) {
    const bt = j * BEAT;
    if (bt > t || bt < 8) continue;
    const m = j % 4;
    const amp = m === 0 ? 1 : m === 2 ? 0.45 : 0.14;
    e += amp * Math.exp(-(t - bt) / 0.1);
  }
  return e * ramp;
}

// ---------------------------------------------------------------- chrome (header + chapter progress)
export function chrome(ctx, t) {
  const a = win(t, 10.0, 115.4, 0.8, 0.5);
  if (a <= 0) return;
  text(ctx, 'ATTENTION IS ALL YOU NEED', 96, 76, { f: F.mono12, tracking: 2.6, alpha: 0.5 * a });
  text(ctx, 'VASWANI ET AL.  ·  NIPS 2017', 1824, 76, { f: F.mono12, tracking: 2.6, alpha: 0.38 * a, align: 'right' });
  const x0 = 96, x1 = 1824, y = 1016, gap = 8;
  const segW = (x1 - x0 - gap * (CH.length - 1)) / CH.length;
  ctx.lineCap = 'butt';
  CH.forEach((s, i) => {
    const sx = x0 + i * (segW + gap);
    ctx.strokeStyle = rgba(COL.ink, 0.12 * a);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(sx, y); ctx.lineTo(sx + segW, y); ctx.stroke();
    const p = prog(t, s.t0, s.t1);
    if (p > 0) {
      ctx.strokeStyle = rgba(COL.ink, (p < 1 ? 0.62 : 0.3) * a);
      ctx.beginPath(); ctx.moveTo(sx, y); ctx.lineTo(sx + segW * p, y); ctx.stroke();
    }
  });
  ctx.lineCap = 'round';
}

export function captions(ctx, t) {
  for (const s of CH) {
    if (t < s.t0 || t > s.t1 + 0.6) continue;
    const ty = 846;
    const bar = easeOutExpo(prog(t, s.t0 + 0.1, s.t0 + 0.8)) * (1 - easeInCubic(prog(t, s.t1 - 0.4, s.t1)));
    ctx.fillStyle = rgba(COL.q, bar);
    ctx.fillRect(96, ty - 9, 18 * bar, 2);
    reveal(ctx, s.n + ' / 10', 128, ty, t, { f: F.mono12, size: 12, tracking: 2.6, color: COL.q, tIn: s.t0 + 0.15, tOut: s.t1 - 0.3, stagger: 0.015, durIn: 0.6, durOut: 0.35 });
    reveal(ctx, s.tag, 128 + 92, ty, t, { f: F.mono12, size: 12, tracking: 2.6, alpha: 0.55, tIn: s.t0 + 0.2, tOut: s.t1 - 0.3, stagger: 0.008, durIn: 0.6, durOut: 0.35 });
  }
  for (const [t0, t1, head, sub] of BEATS) {
    if (t < t0 || t > t1 + 0.6) continue;
    reveal(ctx, head, 94, 914, t, { f: F.head, size: 44, tIn: t0, tOut: t1 - 0.32, stagger: 0.022, durIn: 0.75, durOut: 0.38 });
    reveal(ctx, sub, 96, 962, t, { f: F.sub, size: 20, alpha: 0.62, tIn: t0 + 0.18, tOut: t1 - 0.36, stagger: 0.009, durIn: 0.7, durOut: 0.34 });
  }
}

// ---------------------------------------------------------------- small shared drawing helpers
// one word centred at cx (cheap: no layout cache)
export function word(ctx, str, cx, y, size, color, alpha, fam = 'ISR') {
  if (alpha <= 0.002) return;
  ctx.font = font(fam, size);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = Array.isArray(color) ? rgba(color, 1) : color;
  ctx.globalAlpha = alpha;
  ctx.fillText(str, cx, y);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

// a short vector drawn as a strip of cells; vals in roughly [-1,1]
export function strip(ctx, x, y, vals, color, alpha = 1, cw = 10, ch = 16, gap = 2) {
  for (let i = 0; i < vals.length; i++) {
    const b = 0.5 + 0.5 * Math.tanh(vals[i] / 1.4);
    ctx.fillStyle = rgba(color, (0.1 + 0.9 * b) * alpha);
    ctx.fillRect(x + i * (cw + gap), y, cw, ch);
  }
}
export const stripWidth = (n, cw = 10, gap = 2) => n * cw + (n - 1) * gap;
