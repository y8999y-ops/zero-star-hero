// 石頭魔像：工坊老闆「岩叔」（kind: boss）和學徒「碎碎」（kind: pupil）。
// 方塊改成圓滾滾的大石頭疊起來（照 PixelFX critters 的圓形受光），胸口熔爐核心會發光、一明一暗像在呼吸；
// 石頭頂上長一點苔。碎碎是一顆圓石頭，胸口一點小火光、抱著一顆小石子，走路左右搖擺。
// 動作：岩叔 idle＝核心呼吸、身體跟著微微起伏；碎碎 walk＝左右搖擺＋上下彈，兩隻短腳交替。
import { fit, wrap, TAU } from "../../../pixelfx/src/core/index.js";
import { Grid } from "../../../pixelfx/src/fx/critters/_lib.js";
import { ramp, ball, limb, outline, lightN } from "./_town.js";

export const meta = {
  name: "Stone golem",
  desc: "A stone golem made of round boulders with a forge core glowing in its chest; the big blacksmith breathes slowly, the little apprentice waddles carrying a pebble.",
  tags: ["critter", "golem", "stone", "npc", "town", "loop"],
  size: [96, 72],
  origin: [48, 64],
  duration: 1.6,
  loop: true,
  fps: 30,
  bg: "ground",
  options: { palette: ["#140e18", "#2a2230", "#463a4a", "#665868", "#8a7c8a", "#b4a8b0", "#e0d8dc"], kind: "boss", mode: "idle", seed: 1 },
};
const GRID = new Grid(-40, -60, 80, 64);
const MOSS = ramp(["#0e2a16", "#1e5a34", "#2e7a40", "#3a9a48", "#5cba58", "#8ae070", "#c0f4a0"]);
const CORE = ramp(["#3a1206", "#7a2e10", "#d0601c", "#ffa040", "#ffd27a", "#fff2a8", "#ffffff"]);
const PEB = ramp(["#141420", "#262636", "#3a3a4c", "#565668", "#787888", "#9a9aac", "#c8c8d8"]);

// 苔蘚：石頭最上面受光的一圈改成苔色
function mossCap(g, cx, cy, rx, ry, k = 0.55) {
  g.shade(cx - rx, cy - ry, cx + rx, cy - ry * k, (x, y) => {
    const nx = (x - cx) / rx, ny = (y - cy) / ry;
    if (nx * nx + ny * ny > 1 || ny > -k || Math.abs(nx) > 0.7) return 0;
    return lightN(MOSS, nx, ny);
  });
}

function boss(g, C, t, D) {
  const br = Math.sin((t / D) * TAU), lift = br > 0.3 ? -1 : 0, glow = 0.5 + 0.5 * br;
  // 腳（兩顆矮石頭）
  ball(g, -7, -4, 5.5, 4.2, C, { spec: false });
  ball(g, 7, -4, 5.5, 4.2, C, { spec: false });
  // 手（畫在身體後面，往外張開才看得到）：上臂一顆長石、前臂一條粗管子、拳頭一顆石頭
  for (const s of [-1, 1]) {
    ball(g, s * 19, -22 + lift, 4.6, 6.5, C, { bias: -0.08 });
    limb(g, [[s * 20, -18 + lift], [s * 22, -12 + lift]], 3.4, C);
    ball(g, s * 22, -9 + lift, 5.4, 4.8, C, { spec: false });
  }
  // 身體：一顆大圓石；肩膀各一顆石頭蓋在手臂上面
  ball(g, 0, -20 + lift, 14, 12, C);
  for (const s of [-1, 1]) ball(g, s * 14, -29 + lift, 6.5, 5.5, C);
  // 手臂和身體之間的縫（深色），分得出前後
  for (const s of [-1, 1]) for (let y = -24; y <= -12; y++) { const x = s * Math.round(14 * Math.sqrt(Math.max(0, 1 - ((y + 20) / 12) ** 2))); g.set(x + s, y + lift, C[1]); }
  // 頭：小一點的圓石，坐在身體上
  ball(g, 0, -37 + lift, 8, 6.5, C);
  mossCap(g, 0, -37 + lift, 8, 6.5);
  mossCap(g, -14, -29 + lift, 6.5, 5.5, 0.4);
  mossCap(g, 14, -29 + lift, 6.5, 5.5, 0.6);
  // 眼睛：兩條發光的細縫（核心亮的時候也跟著亮）
  const eye = glow > 0.5 ? CORE[5] : CORE[4];
  for (const x of [-4, -3, 2, 3]) g.set(x, -37 + lift, eye);
  // 胸口的熔爐核心：一圈深色石框，裡面是火
  g.ellipse(0, -20 + lift, 6, 5, C[1]);
  g.ellipse(0, -20 + lift, 4.8, 3.8, (nx, ny) => CORE[Math.min(6, Math.round(5.6 - (nx * nx + ny * ny) * 3 + glow * 1.2 - (ny > 0.3 ? 1 : 0)))]);
  outline(g, C[0], C[1]);
  return { cx: 0, cy: -20 + lift, glow };
}

function pupil(g, C, t, walk) {
  const ph = walk ? wrap(t, 0.7) / 0.7 : 0, sway = walk ? Math.round(Math.sin(ph * TAU) * 1.2) : 0, bob = walk ? Math.round(Math.abs(Math.sin(ph * TAU)) * 1) : 0;
  // 兩隻短腳交替
  const step = walk ? (ph < 0.5 ? 1 : 0) : 0;
  ball(g, -3, -2 - step, 2.6, 2.2, C, { spec: false });
  ball(g, 3, -2 - (1 - step) * (walk ? 1 : 0), 2.6, 2.2, C, { spec: false });
  // 身體＝一顆圓石頭
  const by = -10 - bob;
  ball(g, sway, by, 8, 7.5, C);
  mossCap(g, sway, by, 8, 7.5, 0.6);
  // 眼睛、胸口的小火光
  for (const x of [-3, 2]) { g.set(sway + x, by - 2, CORE[5]); g.set(sway + x + 1, by - 2, CORE[4]); }
  g.set(sway, by + 2, CORE[4]); g.set(sway + 1, by + 2, CORE[3]); g.set(sway, by + 3, CORE[3]);
  // 抱著的小石子（右手前面）
  limb(g, [[sway + 6, by], [sway + 8, by + 3]], 1.3, C);
  ball(g, sway + 8, by + 4, 3, 2.6, PEB, { spec: false });
  outline(g, C[0], C[1]);
  return { cx: sway, cy: by + 2, glow: 0.5 };
}

export function draw(p, time, o) {
  const C = fit(o.palette, 7), D = meta.duration, t = wrap(time, D), g = GRID;
  g.clear();
  const L = o.kind === "pupil" ? pupil(g, C, time, o.mode === "walk") : boss(g, C, t, D);
  g.draw(p);
  // 光：核心照亮胸口周圍
  p.glow(L.cx, L.cy, o.kind === "pupil" ? 10 : 22, CORE[3], (o.kind === "pupil" ? 0.25 : 0.35) * (0.6 + 0.4 * L.glow));
}
