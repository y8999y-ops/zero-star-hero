// 蘑菇：旅館老闆娘「菇媽」（kind: mom）和她家的小孩「菇菇寶寶」（kind: kid）。
// 蓋子是立體的圓頂（照 PixelFX critters 的受光分階），白色斑點貼著圓頂的弧度，蓋子下緣一圈暗色菌褶；
// 柄是圓柱（左亮右暗），臉在柄上；菇媽繫一條圍裙、頭上長兩顆小蘑菇（會晃，第二顆慢半拍）。
// 動作：菇媽 idle＝身體微微呼吸、頭上的小蘑菇晃；菇菇寶寶 walk＝小跑步，著地時壓扁、離地時拉長。
import { fit, wrap, TAU } from "../../../pixelfx/src/core/index.js";
import { Grid, spring } from "../../../pixelfx/src/fx/critters/_lib.js";
import { ramp, dome, cylinder, ball, limb, outline } from "./_town.js";

export const meta = {
  name: "Mushroom folk",
  desc: "A mushroom villager: the innkeeper with an apron and two little mushrooms sprouting from her cap that sway a beat apart, or one of her children scampering along.",
  tags: ["critter", "mushroom", "npc", "town", "loop"],
  size: [80, 72],
  origin: [40, 64],
  duration: 1.6,
  loop: true,
  fps: 30,
  bg: "ground",
  options: { kind: "mom", mode: "idle", seed: 1 },
};
const GRID = new Grid(-34, -62, 68, 66);
const CAP = ramp(["#2a0a12", "#5a1222", "#8c1c2e", "#c42e3c", "#ec4e4c", "#ff8a78", "#ffd0c0"]);
const STEM = ramp(["#2a1a14", "#6a5a46", "#a8987a", "#d4c6a4", "#f0e6cc", "#fff8e8", "#ffffff"]);
const GILL = ramp(["#2a1a14", "#5a3a2e", "#7a5244", "#9a6a58", "#9a6a58", "#9a6a58", "#9a6a58"]);
const APRON = ramp(["#1a1a2a", "#7a8098", "#a8b0c8", "#d0d6e8", "#eef0f8", "#ffffff", "#ffffff"]);
const SHOE = ramp(["#1a0e08", "#3e2414", "#6e4224", "#8e5a34", "#b07240", "#b07240", "#d09a5a"]);
const SPOT = ramp(["#8a7a6a", "#c8bca8", "#e8e0d0", "#f8f4ea", "#ffffff", "#ffffff", "#ffffff"]);
const EYE = ramp(["#1a0e16"])[0], BLUSH = ramp(["#ff9a8a"])[0];

// 一顆蘑菇：cx、by＝蓋子底邊中間；R＝蓋子半寬、h＝蓋子高；sy＝上下伸縮
function cap(g, cx, by, R, h, spots) {
  dome(g, cx, by, R, h, CAP);
  // 斑點：沿著圓頂的位置放，越靠邊越扁
  for (const [u, v, r] of spots) {
    const x = cx + u * R, y = by - v * h, flat = Math.sqrt(Math.max(0.2, 1 - u * u));
    g.ellipse(x, y, r * flat, r * 0.75, (nx, ny) => SPOT[nx + ny < -0.3 ? 4 : 3]);
  }
  // 下緣一圈菌褶（暗色）
  for (let x = Math.ceil(cx - R + 1); x <= cx + R - 1; x++) g.set(x, by, GILL[x % 2 ? 2 : 3]);
}

function mom(g, t, D) {
  const br = Math.sin((t / D) * TAU), up = br > 0.4 ? -1 : 0;
  // 腳
  ball(g, -5, -2, 3.6, 2.4, SHOE, { spec: false });
  ball(g, 5, -2, 3.6, 2.4, SHOE, { spec: false });
  // 柄（身體）：圓柱，往下稍微變粗
  cylinder(g, 0, -22 + up, -3, 9, STEM, 0, 0.12);
  // 圍裙：下半截，口袋一條線
  g.shade(-7, -13 + up, 7, -4, (x, y) => (Math.abs(x) <= 7 - Math.max(0, y + 6) * 0.3 ? APRON[x < -3 ? 4 : x > 3 ? 2 : 3] : 0));
  for (let x = -3; x <= 2; x++) g.set(x, -9 + up, APRON[1]);
  // 手（拿著湯杓）
  limb(g, [[-8, -18 + up], [-11, -12 + up]], 1.6, STEM);
  limb(g, [[8, -18 + up], [11, -14 + up], [13, -16 + up]], 1.6, STEM);
  g.line(13, -16 + up, 14, -24 + up, SHOE[4]); g.ellipse(14, -25 + up, 1.6, 1.2, SHOE[3]);
  // 臉
  for (const x of [-4, 3]) { g.set(x, -18 + up, EYE); g.set(x, -17 + up, EYE); }
  g.set(-6, -15 + up, BLUSH); g.set(5, -15 + up, BLUSH);
  g.set(-1, -15 + up, EYE); g.set(0, -14 + up, EYE); g.set(1, -15 + up, EYE);
  // 蓋子（大），頭上兩顆小蘑菇會晃，第二顆慢半拍
  cap(g, 0, -23 + up, 18, 13, [[-0.55, 0.45, 2.6], [0.1, 0.72, 2.2], [0.6, 0.35, 2.4], [-0.15, 0.25, 1.6]]);
  for (const [x0, lag, s] of [[-7, 0, 1], [6, 0.25, 0.8]]) {
    const sw = Math.round(Math.sin(((t / D) - lag) * TAU) * 1.4);
    const base = -23 + up - 13 * Math.sqrt(1 - (x0 / 18) ** 2) + 1;
    cylinder(g, x0 + sw * 0.4, base - 4 * s, base, 1.4 * s, STEM);
    cap(g, x0 + sw, base - 4 * s, 3.6 * s, 3 * s, []);
  }
  outline(g, CAP[0], CAP[1]);
}

function kid(g, t, walk) {
  const ph = walk ? wrap(t, 0.5) / 0.5 : 0, land = walk && ph > 0.5;
  const sq = walk ? (land ? -0.06 : 0.04) : 0, hop = walk && !land ? -Math.round(Math.sin((ph / 0.5) * Math.PI) * 2) : 0;
  const leg = walk ? (ph < 0.5 ? 1 : -1) : 0;
  ball(g, -2 - leg, -1, 1.8, 1.4, SHOE, { spec: false });
  ball(g, 2 + leg, -1, 1.8, 1.4, SHOE, { spec: false });
  const top = -8 + hop - Math.round(sq * 4);
  cylinder(g, 0, top, -2 + hop, 3.6 * (1 - sq * 0.5), STEM);
  g.set(-2, top + 2, EYE); g.set(1, top + 2, EYE);
  cap(g, 0, top, 7 * (1 - sq * 0.4), 5 * (1 + sq), [[-0.45, 0.45, 1.4], [0.45, 0.6, 1.2]]);
  outline(g, CAP[0], CAP[1]);
}

export function draw(p, time, o) {
  const D = meta.duration, t = wrap(time, D), g = GRID;
  g.clear();
  if (o.kind === "kid") kid(g, time + (o.lag ?? 0), o.mode === "walk");
  else mom(g, t, D);
  g.draw(p);
  // 孢子：菇媽身邊偶爾飄起一兩顆
  if (o.kind !== "kid") for (let i = 0; i < 3; i++) {
    const a = wrap(time * 0.4 + i * 0.33, 1), x = -14 + i * 13 + Math.sin(a * 6 + i) * 2, y = -30 - a * 26;
    p.dot(x, y, SPOT[3], Math.min(1, a * 4) * (1 - a));
    p.glow(x, y, 5, CAP[5], 0.2 * (1 - a));
  }
}
