// 碎星鎮的藍色史萊姆：公會櫃檯「波波」（kind: clerk，戴圓眼鏡、紅領帶）和弟弟「啵啵」（kind: kid，頭上紅蝴蝶結）。
// 身體照 PixelFX critters/slime 的果凍畫法（MIT，改編自 Sprite Fusion 的 poison puddle）：頂部偏暗、光聚在下半部、
// 左上一道貼著輪廓的反光、右下一道陰影月牙。藍色＝城裡的居民，跟野外綠色的狂化史萊姆分開。
// 動作：idle＝慢慢晃＋眨眼（波波：鏡片反光從左掃到右）；walk＝一跳一跳往前（蹲→彈起→落地壓扁）。
import { fit, clamp, wrap, ease, lerp, TAU } from "../../../pixelfx/src/core/index.js";
import { Grid, spring } from "../../../pixelfx/src/fx/critters/_lib.js";
import { ramp } from "./_town.js";

export const meta = {
  name: "Town slime",
  desc: "A blue town slime: the guild clerk with round glasses and a red tie, or his little brother with a red bow; it wobbles and blinks, or hops along.",
  tags: ["critter", "slime", "npc", "town", "loop"],
  size: [80, 64],
  origin: [40, 56],
  duration: 1.6,
  loop: true,
  fps: 30,
  bg: "ground",
  options: { palette: ["#0a1430", "#16285c", "#22428e", "#3266c0", "#5296e6", "#90c8ff", "#e8f6ff"], kind: "clerk", mode: "idle", seed: 1 },
};
const GRID = new Grid(-30, -50, 60, 54);
const SIZE = { clerk: [30, 24], kid: [17, 13] };
const RED = ramp(["#3a0a14", "#6a1424", "#a02234", "#d03a44", "#ff6a60", "#ff9a8a", "#ffd0c8"]);
const LENS = ramp(["#2a2440", "#c8ecff", "#e8f8ff", "#ffffff"]);

function pose(o, time) {
  const D = meta.duration, t = wrap(time, D);
  let s = 0, by = 0, lean = 0;
  if (o.mode === "walk") {
    // 一跳 0.8 秒：蹲（0～0.25）→ 彈起在空中（0.25～0.65）→ 落地壓扁再回彈
    const q = wrap(time, 0.8) / 0.8;
    if (q < 0.25) s = -0.22 * ease.inOutSine(q / 0.25);
    else if (q < 0.65) { const a = (q - 0.25) / 0.4; s = lerp(0.2, 0.02, a); by = -Math.round((o.kind === "kid" ? 7 : 5) * 4 * a * (1 - a)); lean = 0.08; }
    else s = -0.3 * spring((q - 0.65) * 0.8, 2.4, 6);
  } else { s = 0.03 * Math.sin((t / D) * TAU); lean = 0.03 * Math.sin((t / D) * TAU + 1.2); }
  const [W0, H0] = SIZE[o.kind] ?? SIZE.clerk;
  return { s, by, lean, W: W0 / Math.sqrt(1 + s), H: H0 * (1 + s), t };
}
function halfW(v, P) {
  if (v < 0 || v > 1) return -1;
  if (v >= 0.4) { const q = (v - 0.4) / 0.6; return (P.W / 2) * Math.sqrt(1 - q * q); }
  const hb = v * P.H, rc = 3;
  let hw = P.W / 2;
  if (hb < rc) hw -= rc - Math.sqrt(rc * rc - (rc - hb) ** 2);
  return hw;
}
const inside = (P, x, y) => { const v = (P.by - 1 - y) / P.H, hw = halfW(v, P); return hw >= 0 && Math.abs(x - P.lean * v * P.H) <= hw; };
const at = (P, u, v) => [Math.round(P.lean * v * P.H + (u * P.W) / 2), Math.round(P.by - 1 - v * P.H)];

export function draw(p, time, o) {
  const C = fit(o.palette, 7), P = pose(o, time), g = GRID, yb = P.by - 1, kid = o.kind === "kid";
  const cx = P.lean * 0.45 * P.H, cy = yb - P.H * 0.5, lx = cx - P.W * 0.24, ly = cy - P.H * 0.36;
  const lit = (x, y, k) => inside(P, lx + (x - lx) / k, ly + (y - ly) / k);
  g.clear();
  g.shade(-P.W / 2 - 3, yb - P.H - 1, P.W / 2 + 3, yb, (x, y, q) => {
    if (!inside(P, x, y)) return 0;
    q.a = 1;
    let i = lit(x, y, 0.42) ? 5 : lit(x, y, 0.7) ? 4 : 3;
    const v = (yb - y) / P.H;
    if (v < 0.3 && inside(P, x, y + 1.4)) i = !inside(P, x, y + 2.4) ? 5 : v < 0.2 ? 4 : i;
    if (!inside(P, x + 2, y + 2.4)) i = 2;
    const ang = Math.atan2(y - cy, (x - cx) * (P.H / P.W));
    if (!inside(P, x - 1.6, y - 1.6) && inside(P, x - 0.7, y - 0.7) && ang > -2.75 && ang < -1.55) i = ang > -2.45 && ang < -1.8 ? 6 : 5;
    return C[i];
  });
  const hx = Math.round(cx - P.W * 0.27), hy = Math.round(cy - P.H * 0.14);
  if (inside(P, hx, hy)) { g.set(hx, hy, C[6]); g.set(hx, hy + 1, C[5]); }

  // 臉
  const blink = o.mode === "idle" && wrap(time, 2.6) < 0.12;
  const [ex0, ey] = at(P, 0, kid ? 0.5 : 0.56), ex = Math.max(3, Math.round(P.W * (kid ? 0.2 : 0.19)));
  for (const side of [-1, 1]) {
    const x = ex0 + side * ex - (side > 0 ? 1 : 0);
    if (!kid) {
      // 圓眼鏡：深色鏡框、淺藍鏡片、反光從左上掃到右下
      g.ellipse(x + 0.5, ey, 3.6, 3.2, (nx, ny) => (nx * nx + ny * ny > 0.5 ? LENS[0] : LENS[1]));
      const sweep = Math.floor(wrap(time, 3.2) / 3.2 * 10);
      if (sweep < 4) g.set(x - 1 + sweep * 0.7, ey - 1 + sweep * 0.4, LENS[3]);
    }
    const eh = blink ? 1 : kid ? 3 : 2;
    for (let k = 0; k < eh; k++) { g.set(x, ey - 1 + k + (blink ? 1 : 0), C[0]); g.set(x + 1, ey - 1 + k + (blink ? 1 : 0), C[0]); }
    if (!blink && kid) g.set(x, ey - 1, C[6]);
  }
  if (!kid) for (let x = ex0 - 2; x <= ex0 + 1; x++) g.set(x, ey - 1, LENS[0]);   // 鼻樑
  const [mx, my] = at(P, 0, kid ? 0.3 : 0.36);
  g.set(mx - 1, my, C[0]); g.set(mx, my + 1, C[0]); g.set(mx + 1, my, C[0]);   // 小小的笑
  if (!kid) {
    // 紅領帶
    const [tx, ty] = at(P, 0, 0.2);
    for (const [dx, dy, c] of [[-1, 0, 4], [0, 0, 4], [1, 0, 3], [0, 1, 3], [-1, 2, 4], [0, 2, 3], [1, 2, 2], [-1, 3, 3], [0, 3, 3], [1, 3, 2], [0, 4, 2]]) g.set(tx + dx, ty + dy, RED[c]);
  } else {
    // 紅蝴蝶結（頭頂）
    const [bx, by] = at(P, 0.25, 1);
    for (const [dx, dy, c] of [[-3, -1, 4], [-2, -1, 5], [-3, 0, 3], [-2, 0, 4], [-1, 0, 3], [0, 0, 5], [1, 0, 3], [2, 0, 4], [3, 0, 3], [2, -1, 5], [3, -1, 4], [-3, 1, 2], [3, 1, 2]]) g.set(bx + dx, by + dy, RED[c]);
  }
  g.outline((x, y, nx, ny) => (ny < 0 && nx <= 0 && y < yb - P.H * 0.5 ? C[1] : C[0]));
  g.draw(p);
  p.glow(cx, cy, P.W * 0.9, C[4], 0.12);
}
// 腳下的一小灘水光（在空中時沒有）
export function drawBack(p, time, o) {
  const C = fit(o.palette, 7), P = pose(o, time);
  if (P.by < 0) return;
  const R = P.W / 2 + 2;
  for (let x = Math.floor(-R); x <= Math.ceil(R); x++) { const d = Math.abs(x + 0.5) / R; if (d <= 1) p.px(x, 0, d > 0.85 ? C[2] : C[3]); }
}
