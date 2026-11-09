// 霧中鬼火（第二章 2-2 濃霧深林的新魔物，使用者 2026-11-09）：狂化的鬼火，藍紫色的冷火，心裡是一塊發光的星星碎片。
// 平常躲在霧裡，靠近才現身；碰到會被燒。
// 飄（float）：上下飄，火舌往上舔、甩出小火團和火星。
// 現身（appear）：從霧裡一點一點亮起來（網點淡入）、變大，最後火「轟」一下竄高。
// 衝（charge）：往前衝撞，火被風往後吹成長長的尾巴、眼睛瞪大。
// 參考（只學做法）：pixelfx critters/wisp（火團的頭＋三條火舌＋火團、火星、冷光；改編自 Sprite Fusion 開源的 fire，MIT）、
//   critters/ghost（飄的節奏、下襬波動）、critters/flying-skull（頭骨＋火冠）、fire/candle（藍色火根的穩定火焰）、
//   itch.io 上的鬼火（Ramen 的 Fire Wisp：可愛的火球幽靈；TDAT 的 Will O The Wisp、Penzilla 的 Ghost Forest：小小一團藍色冷火）。
import { fit, hex, clamp, wrap, lerp, cycle, fly, ease, seg, P, TAU } from "../../../pixelfx/src/core/index.js";
import { Swarm, lnoise, tongue, firePuff, shadow } from "../../../pixelfx/src/fx/critters/_lib.js";

export const meta = {
  name: "Ghost fire",
  desc: "A feral will-o'-the-wisp of cold blue-violet fire with a glowing star shard at its heart: it bobs in the fog licking flame upward; it flickers into view out of the fog and flares; it charges with its fire streaming back.",
  tags: ["critter", "monster", "wisp", "ghost", "fire", "forest", "loop"],
  size: [80, 80],
  origin: [40, 72],
  duration: 1.6,
  loop: true,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#0a0820", "#1c1450", "#33308e", "#4a62d0", "#7aa4ff", "#c8e2ff", "#ffffff"],   // 冷火：深藍紫→淡藍→白（霧是灰藍，火要亮得出來）
    shard: ["#7a4a08", "#e0a020", "#ffe27a", "#fffbe0"],
    mode: "float", // float | appear | charge
    hover: 22,
    seed: 1,
  },
};

const D = meta.duration, SWARM = new Swarm();
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bay = (x, y) => BAYER[((Math.floor(y) & 3) << 2) | (Math.floor(x) & 3)];
const INK = hex("#0a0418");

function state(o, t) {
  // vis：現身的程度（0 看不到～1）；flare：火竄高；lean：火往後吹（-1＝往左吹，朝右衝）；sc：大小
  let vis = 1, flare = 0, lean = 0, sc = 1, x = 0, y = -o.hover + Math.sin((t / D) * TAU) * 2.5, wide = 0;
  if (o.mode === "appear") {
    const k = seg(t, 0, 1.0);
    vis = ease.inQuad(k); sc = lerp(0.55, 1, ease.outQuad(k));
    flare = t > 0.85 ? Math.exp(-(t - 0.85) * 8) * 0.8 : 0;
    if (t > 1.0) vis = 1, sc = 1;
  } else if (o.mode === "charge") {
    lean = -1; x = Math.sin((t / D) * TAU * 2) * 1.5; wide = 1;
  }
  return { vis, flare, lean, sc, x, y, wide };
}

export function draw(p, time, o) {
  const t = wrap(time, D), C = fit(o.palette, 7), S = fit(o.shard, 4);
  // 造型（使用者 2026-11-09 交給我搭配）：火做的幽靈身體（三個尖下襬）＋有臉的火團那張凶臉＋心口的星星碎片
  const st = state(o, t), X = st.x, Y = st.y, R = 7 * st.sc;
  const heat = [C[6], C[5], C[5], C[4], C[4], C[4], C[3], C[3], C[2]];   // 火舌：只有尖端最熱的一點是白的
  const keep = (x, y) => st.vis >= 1 || bay(x, y) < st.vis;   // 現身中：網點淡入
  const pp = st.vis >= 1 ? p : { ...p, __proto__: p, dot: (x, y, c, a) => keep(x, y) && p.dot(x, y, c, a), px: (x, y, c) => keep(x, y) && p.px(x, y, c), set: (x, y, c) => keep(x, y) && p.set(x, y, c) };

  // 甩出去的小火團（往上飄、冷卻）
  cycle(t, D, 18, o.seed * 7 + 1, (r) => r.range(0.3, 0.55), (age, L, r) => {
    const [x, y] = fly(X + r.range(-4, 4) + st.lean * -age * 30, Y - r.range(0, 5), r.range(-8, 8) + st.lean * 30, -r.range(8, 18), age, -40, 2.5);
    if (st.vis < 1 && r.next() > st.vis) return;
    firePuff(p, x, y, 1 - age / L, r.range(1.1, 2.4) * st.sc, r.next() * 100, heat);
  });
  // 火舌：從頭頂往上舔；衝的時候被風往後吹長
  const tails = [[-4, 11, 2.4, 3], [4, 12, 2.4, 7], [0, 16, 3, 11]];
  for (let li = 0; li < 4; li++)
    for (const [dx, h, w, n] of tails) {
      const hh = (h + 0.25 * h * lnoise(t, D, 9, n, 5)) * st.sc * (1 + st.flare) * (st.wide ? 1.3 : 1);
      tongue(pp, X + dx * st.sc, Y - 2, hh, w * st.sc, lnoise(t, D, 6, n, 40) * 1.5 + st.lean * hh * 1.1, t, D, n, heat, li);
    }
  // 身體：火做的幽靈，圓頭往下變成三個尖尖、往後流動的火下襬
  p.shade(X - R - 3, Y - R - 2, X + R + 3, Y + R + 8, (x, y) => {
    if (!keep(x, y)) return 0;
    const dx = x - X, dy = y - Y;
    const ph = ((dx + R) / ((2 * R) / 3) + (t / D) * 1.5) % 1;
    const hem = R + 1.5 + 4 * (1 - Math.abs(ph * 2 - 1));
    const halfW = dy < 0 ? 0 : R * (1 - Math.max(0, dy) * 0.03);
    if (dy < 0 ? Math.hypot(dx, dy) > R + 0.6 * lnoise(t, D, 16, Math.atan2(dy, dx) * 1.6 + 10, 3) : (Math.abs(dx) > halfW || dy > hem)) return 0;
    const d = dy < 0 ? Math.hypot(dx, dy) / R : Math.max(Math.abs(dx) / Math.max(1, halfW), dy / hem);
    return d < 0.22 ? C[6] : d < 0.5 ? C[5] : d < 0.78 ? C[4] : d < 0.93 ? C[3] : C[2];
  });
  // 臉：往中間壓的凶眉、深色斜眼、鋸齒嘴；心口透出星星碎片
  const cx = Math.round(X), cy = Math.round(Y), wide = st.wide;
  for (const s of [-1, 1]) {
    const ex = cx + s * 2 - (s > 0 ? 0 : 1), ey = cy - 2;
    for (let k = 0; k < (wide ? 3 : 2); k++) { pp.px(ex, ey + k, INK); pp.px(ex + 1, ey + k, INK); }
    pp.px(s > 0 ? ex + 1 : ex, ey, C[1]);                                     // 外側上角缺一格：眼睛斜斜的、凶
    pp.px(s > 0 ? ex - 1 : ex + 2, ey - 1, INK);                              // 眉頭往中間往下壓
  }
  for (let i = -2; i <= 1; i++) pp.px(cx + i, cy + 2 + (i % 2 === 0 ? 0 : 1) + (wide ? 1 : 0), INK);
  [".3.", "323", ".3."].forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== ".") pp.px(cx - 1 + i, cy + 4 + j, S[+ch]); }));
  // 火星：往上飄
  const sw = SWARM.begin(t);
  sw.ps.sparks = [C[6], C[5], C[4], C[3]];
  cycle(t, D, 18, o.seed * 7 + 2, (r) => r.range(0.7, 1.4), (age, L, r) => {
    if (r.next() > st.vis) return;
    const s = r.next() * 100, [x, y] = fly(X + r.range(-5, 5), Y - r.range(4, 10), r.range(-18, 18) + st.lean * 40, -r.range(18, 40), age, -15, 1.6);
    sw.add(P.EMBER, x + Math.sin(age * 2.3 + s) * 3 * Math.min(1, age), y, 0, 0, age, L, C[4], r.chance(0.3) ? 2 : 1, 0, s);
  });
  sw.draw(p);
  // 冷光
  const fl = 0.85 + 0.15 * lnoise(t, D, 22, 0, 9);
  p.glow(X + st.lean * 4, Y - 5, 36 * fl * st.sc, C[3], 0.26 * st.vis * (1 + st.flare));
  p.glow(X, Y, 10 * st.sc, C[4], 0.22 * fl * st.vis);
  p.glow(X, Y + 5, 5, S[2], 0.3 * st.vis);
}

export function drawBack(p, time, o) {
  const t = wrap(time, D), C = fit(o.palette, 7), st = state(o, t);
  shadow(p, st.x, 0, 6, 1.1, C[0], 0.35 * st.vis);
  for (let x = -18; x <= 18; x += 6) p.glow(st.x + x, -1, 14, C[4], 0.1 * st.vis * (1 - Math.abs(x) / 26));
}
