// 王：大胃王史萊姆（吃垃圾長大的狂化巨型史萊姆）。
// 畫法照 PixelFX 的 critters/slime 改寫（果凍明暗、左上反光、身體發光、地上一灘黏液、甩出水滴），那支是
// MIT 授權、改編自 Sprite Fusion 的 poison puddle（Hugo Duprez）。這裡把身體放大到 64×46，再加上王的特徵：
//   肚子裡泡著吞下去的垃圾（染上果凍色、不加外框）、右邊戳出一塊木板、頭上歪戴鐵罐蓋王冠、左邊卡著發光的星星碎片、
//   生氣的眼睛（上緣往內斜切）、平常小嘴，吐東西時張大（裡面有火光）。
// 動作由遊戲控制（options.pose＋options.k）：idle 待機晃、crouch 蹲下蓄力、air 在空中、land 壓地、inhale 吸氣鼓起、spit 吐、
//   lean 往後縮（衝撞前）、slide 往前滑、roar 大吼、split 身上鼓包（分裂）、vacuum 往前傾大口吸、beam 張嘴噴光（肚子發亮）、
//   dizzy 累倒（眼睛變叉叉）、melt 融化（被打倒）。
import { fit, clamp, wrap, smooth, seg, ease, lerp, rng, cycle, hex, TAU } from "../../../pixelfx/src/core/index.js";
import { Grid, spring, toss, lnoise } from "../../../pixelfx/src/fx/critters/_lib.js";

export const meta = {
  name: "Glutton slime",
  desc: "A giant berserk slime swollen on junk: a tin-lid crown askew, a glowing star shard stuck in its side, junk floating in its belly, angry eyes; it wobbles, crouches, leaps, slams and puffs up to spit.",
  tags: ["critter", "slime", "boss", "monster", "goo"],
  size: [176, 120],
  origin: [88, 104],
  duration: 1.6,
  loop: true,
  fps: 30,
  bg: "ground",
  options: {
    // 狂化：偏黃綠、比較毒的顏色，跟野外的綠色史萊姆分得開
    palette: ["#0e1404", "#22300a", "#3a5210", "#5e7c16", "#8aaa22", "#c0dc54", "#eefcb8"],
    pose: "idle", k: 0, seed: 1,
  },
};

const GRID = new Grid(-56, -96, 112, 100);
const W0 = 64, H0 = 46, VC = 0.4, NDROP = 16, G = 640;
const TIN = ["#1e2430", "#3a4656", "#5e6e82", "#8c9cb0", "#c8d4e0"].map(hex);
const WOOD = ["#2a1608", "#4e2e14", "#7a4a22", "#a86c36", "#d09a5a"].map(hex);
const SHARD = ["#8a5a0c", "#d8a020", "#ffd84a", "#fff6c0", "#ffffff"].map(hex);
const RUSTC = hex("#9a5024"), CANRUST = hex("#7a5a1c"), FIRE = hex("#ff8a2a");

// 身體的形狀：s > 0 拉長、s < 0 壓扁；puff 吸氣時變胖
function pose(o, time) {
  const k = clamp(o.k ?? 0), D = meta.duration, t = wrap(time, D);
  let s = 0, lean = 0, round = 0.1, puff = 0, age = 9, air = false, sx = 1, open, bright = 0, bumps = 0, dizzy = false, shake = 0, melt = 0;
  switch (o.pose) {
    case "crouch": s = -0.32 * ease.inOutSine(k) + 0.02 * Math.sin(time * TAU * 14) * k; break;
    case "air": air = true; s = lerp(0.3, 0.05, ease.outCubic(k)); round = 0.1 + 0.7 * smooth(0, 0.3, k); break;
    case "land": age = k * 1.2; s = age < 0.06 ? -0.48 : -0.48 * spring(age - 0.06, 2.1, 4.6); lean = 0.06 * Math.exp(-age * 4) * Math.sin(age * TAU * 1.9); break;
    case "inhale": puff = ease.outCubic(k) * 0.16; s = 0.06 * k + 0.015 * Math.sin(time * TAU * 9); break;
    case "spit": puff = 0.16 * (1 - ease.outCubic(k)); s = -0.08 * Math.exp(-k * 6); break;
    case "lean": s = -0.12 * ease.outCubic(k); lean = -0.22 * ease.outCubic(k); break;
    case "slide": s = -0.18; lean = 0.22; sx = 1.12; break;
    case "roar": s = 0.1 + 0.03 * Math.sin(time * TAU * 11); open = 1.15; shake = Math.sin(time * TAU * 17) * 1.5; break;
    case "split": s = 0.05 * Math.sin(k * TAU * 3); bumps = k; break;
    case "vacuum": lean = 0.12; s = 0.05 + 0.02 * Math.sin(time * TAU * 8); open = 1.3; puff = 0.05; break;
    case "beam": s = 0.04; open = 1; bright = 1; shake = Math.sin(time * TAU * 20) * 0.8; break;
    case "dizzy": s = -0.08 + 0.02 * Math.sin(time * TAU * 2); lean = 0.05 * Math.sin(time * TAU * 1.2); dizzy = true; break;
    case "melt": melt = k; s = -0.8 * ease.inQuad(k); round = 0.1 + 0.8 * k; sx = 1 + 0.7 * k; break;
    default: s = 0.025 * Math.sin((t / D) * TAU) ; lean = 0.03 * Math.sin((t / D) * TAU + 1);
  }
  const W = (W0 / Math.sqrt(1 + s)) * (1 + puff) * sx, H = H0 * (1 + s) * (1 + puff * 0.4);
  return { s, lean, round, puff, age, air, W, H, by: 0, k, open, bright, bumps, dizzy, shake, melt };
}
function halfW(v, P) {
  if (v < 0 || v > 1) return -1;
  const { W, H, round } = P;
  if (v >= VC) { const q = (v - VC) / (1 - VC); return (W / 2) * Math.sqrt(1 - q * q); }
  const q = (VC - v) / VC, hb = v * H, rc = 5;
  let hw = (W / 2) * Math.sqrt(Math.max(0, 1 - round * q * q));
  if (hb < rc) hw -= rc - Math.sqrt(rc * rc - (rc - hb) ** 2);
  return hw;
}
const BUMPS = [[-0.5, 0.86], [0.1, 1.0], [0.56, 0.8]];
const inside = (P, x, y) => {
  const v = (P.by - 1 - y) / P.H, hw = halfW(v, P);
  if (hw >= 0 && Math.abs(x - P.lean * v * P.H) <= hw) return true;
  if (P.bumps > 0) for (const [u, w] of BUMPS) { const bx = P.lean * w * P.H + (u * P.W) / 2, by = P.by - 1 - w * P.H; if (Math.hypot(x - bx, y - by) < P.bumps * 7) return true; }
  return false;
};
// 身體上的位置：u（-1 左 ～ 1 右）、v（0 底 ～ 1 頂）→ 座標，跟著身體擠壓和傾斜
const at = (P, u, v) => [Math.round(P.lean * v * P.H + u * P.W / 2), Math.round(P.by - 1 - v * P.H)];

// 果凍明暗（照原本史萊姆）：頂部偏暗、光聚在下半部裡面、右下一道陰影月牙、左上貼著輪廓的反光＋小亮點、地面反上來的光
function body(g, C, P) {
  const yb = P.by - 1, half = P.W / 2 + 3;
  const cx = P.lean * 0.45 * P.H, cy = yb - P.H * 0.5, lx = cx - P.W * 0.24, ly = cy - P.H * 0.36;
  const lit = (x, y, k) => inside(P, lx + (x - lx) / k, ly + (y - ly) / k);
  g.clear();
  g.shade(-half, yb - P.H - 1, half, yb, (x, y, o) => {
    if (!inside(P, x, y)) return 0;
    o.t = 1; o.a = 0.94;
    let i = (lit(x, y, 0.34) ? 5 : lit(x, y, 0.58) ? 4 : 3) + (P.bright ? 1 : 0);
    const v = (yb - y) / P.H;
    if (v < 0.28 && inside(P, x, y + 2)) i = !inside(P, x, y + 3.4) ? 5 : v < 0.18 ? 4 : i;
    if (!inside(P, x + 3, y + 3.4)) (i = 2), (o.a = 1);
    const ang = Math.atan2(y - cy, (x - cx) * (P.H / P.W));
    if (!inside(P, x - 2.2, y - 2.2) && inside(P, x - 1, y - 1) && ang > -2.75 && ang < -1.55) (i = ang > -2.45 && ang < -1.8 ? 6 : 5), (o.a = 1);
    if (i === 2 && inside(P, x + 1, y + 1.4) && !inside(P, x + 3, y + 3.4) && ang > 0.3 && ang < 1.5) i = 4;
    return C[Math.min(6, i)];
  });
  const hx = Math.round(cx - P.W * 0.27), hy = Math.round(cy - P.H * 0.12);
  for (const [dx, dy, c] of [[0, 0, 6], [1, 0, 6], [0, 1, 5], [1, 1, 5], [0, 2, 5]]) if (inside(P, hx + dx, hy + dy)) g.set(hx + dx, hy + dy, C[c], 1, 1);
}

// 肚子裡泡著的垃圾：顏色混進果凍（深色＝C[1]～C[2]，亮的地方＝C[4]），沒有外框，看起來在裡面
function junk(g, C, P) {
  const put = (x, y, c) => { if (inside(P, x, y) && inside(P, x + 2, y + 2) && inside(P, x - 2, y)) g.set(x, y, c, 1, 1); };
  // 輪胎（左下）
  const [tx, ty] = at(P, -0.46, 0.24), rx = Math.round(P.W * 0.11), ry = Math.round(P.H * 0.15);
  for (let y = -ry - 1; y <= ry + 1; y++) for (let x = -rx - 1; x <= rx + 1; x++) {
    const d = Math.hypot(x / rx, y / ry);
    if (d <= 1 && d >= 0.55) put(tx + x, ty + y, d > 0.85 || d < 0.65 ? C[1] : y < 0 ? C[2] : C[1]);
  }
  // 鐵罐（右下，斜躺）
  const [cx, cy] = at(P, 0.34, 0.22);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 6; x++) put(cx + x + Math.floor(y / 3), cy + y - 4, y === 2 ? CANRUST : x === 0 ? C[4] : x === 5 ? C[1] : C[2]);
  // 魚骨（中間偏上，亮色）
  const [fx, fy] = at(P, -0.08, 0.38);
  for (let x = -6; x <= 5; x++) put(fx + x, fy, C[4]);
  for (const x of [-4, -1, 2]) { put(fx + x, fy - 1, C[4]); put(fx + x, fy + 1, C[4]); put(fx + x - 1, fy - 2, C[4]); put(fx + x - 1, fy + 2, C[4]); }
  put(fx + 6, fy - 1, C[4]); put(fx + 6, fy + 1, C[4]); put(fx + 7, fy, C[4]);
  // 幾顆氣泡
  for (const [u, v] of [[0.1, 0.18], [-0.2, 0.55], [0.22, 0.48]]) { const [x, y] = at(P, u, v); put(x, y, C[5]); put(x + 1, y, C[4]); put(x, y + 1, C[4]); }
}

// 身體外面的東西（會被外框包起來）：戳出來的木板、王冠、星星碎片
function props(g, C, P) {
  // 木板：從身體右邊斜斜戳出去，在身體裡的那段染色
  const [px, py] = at(P, 0.55, 0.58);
  for (let i = 0; i < 26; i++) for (let j = 0; j < 3; j++) {
    const x = px + i, y = py - Math.round(i * 0.42) + j, inBody = inside(P, x, y);
    g.set(x, y, inBody ? C[j === 0 ? 3 : 2] : WOOD[j === 0 ? 4 : j === 1 ? 3 : 2], 1, inBody ? 1 : 3);
  }
  for (const i of [20, 22]) g.set(px + i, py - Math.round(i * 0.42) + 1, WOOD[1], 1, 3);   // 木紋
  // 王冠：鐵罐蓋折成三個尖，歪戴（往右斜）
  let [kx, ky] = at(P, 0.08, 1);
  if (P.melt > 0) { kx += Math.round(P.melt * 26); ky += Math.round(P.melt * P.melt * 30); }
  const crown = ["..#......#......#..", ".###....###....###.", ".####..#####..####.", "###################", "###################", "#####R#########R###"];
  crown.forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch === ".") return;
    const x = kx - 9 + i, y = ky - crown.length + j + 3 + Math.round((i - 9) * 0.14);
    const c = ch === "R" ? RUSTC : j === 3 ? TIN[4] : i < 2 || j < 2 ? TIN[3] : i > 16 ? TIN[1] : TIN[2];
    g.set(x, y, c, 1, 4);
  }));
  // 星星碎片：卡在左上，一半露在外面（全身最亮）
  const [sx, sy] = at(P, -0.86, 0.6);
  ["....#", "...##", "..###", ".####", "#####", ".####", "..###", "...#."].forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch === "#") g.set(sx - 4 + i, sy - 4 + j, SHARD[i < 2 && j < 4 ? 4 : i < 3 ? 3 : j > 5 ? 1 : 2], 1, 5);
  }));
}

// 臉：原本史萊姆的黑眼睛放大，內側上緣斜切＝生氣；嘴巴平常小小一條，吸氣時閉緊鼓頰，吐的時候張大
function face(g, C, P, time) {
  const ev = 0.6, xc = Math.round(P.lean * ev * P.H), ey = Math.round(P.by - 1 - P.H * ev), ex = Math.round(P.W * 0.15);
  if (P.melt > 0.55) return;
  const blink = P.pose === "idle" && wrap(time, 3.2) < 0.12, eh = clamp(Math.round(7 * (1 + P.s * 0.7)), 2, 9);
  if (P.dizzy) {
    for (const side of [-1, 1]) { const x0 = xc + side * ex; for (let i = -2; i <= 2; i++) { g.set(x0 + i, ey - 3 + i, C[0], 1, 2); g.set(x0 + i, ey - 3 - i, C[0], 1, 2); } }
    const my2 = Math.round(P.by - 1 - P.H * 0.4);
    for (let x = -4; x <= 4; x++) g.set(xc + x, my2 + (x % 2 ? 1 : 0), C[0], 1, 2);   // 歪歪扭扭的嘴
    return;
  }
  for (const side of [-1, 1]) {
    const x0 = xc + side * ex - 1;
    for (let i = 0; i < 4; i++) {
      const inner = side < 0 ? i : 3 - i;   // 越靠中間，上緣切掉越多
      const cut = blink ? eh - 2 : Math.round(inner * 0.9);
      for (let k = cut; k < eh; k++) g.set(x0 + i, ey - eh + 1 + k, C[0], 1, 2);
    }
    if (!blink) { g.set(x0 + (side < 0 ? 0 : 3), ey - eh + 3, C[6], 1, 2); g.set(x0 + (side < 0 ? 0 : 3), ey - eh + 4, C[5], 1, 2); }
    // 眉頭：兩眼中間往下壓的一點皺褶
    g.set(xc + side * 3, ey - eh - 1, C[1], 1, 2);
  }
  const my = Math.round(P.by - 1 - P.H * 0.4);
  const open = P.open ?? (P.pose === "spit" ? 1 - ease.inQuad(P.k) * 0.6 : P.pose === "inhale" ? 0 : 0.12);
  const mw = Math.round(5 + open * 8), mh = Math.round(open * 9);
  if (P.pose === "inhale") { for (let x = -3; x <= 3; x++) g.set(xc + x, my, C[0], 1, 2); }
  else {
    for (let x = -mw; x <= mw; x++) {
      const d = Math.round(mh * Math.sqrt(Math.max(0, 1 - (x / (mw + 0.5)) ** 2)));
      g.set(xc + x, my, C[0], 1, 2);
      for (let y = 1; y <= d; y++) g.set(xc + x, my + y, y > d - 2 && open > 0.5 && Math.abs(x) < mw - 2 ? FIRE : C[0], 1, 2);
    }
    g.set(xc - mw + 2, my + 1, C[6], 1, 2); g.set(xc + mw - 2, my + 1, C[6], 1, 2);   // 兩顆小尖牙
    if (open < 0.3) g.set(xc + mw, my - 1, C[0], 1, 2);   // 嘴角往上：得意的冷笑
  }
}

function droplet(i, o, age) {
  const r = rng(o.seed ?? 1, i, 7), a = -Math.PI / 2 + r.range(-1.25, 1.25), sp = r.range(80, 160), size = r.chance(0.35) ? 2 : r.chance(0.7) ? 3 : 2;
  const fa = a + Math.PI / 2, x0 = Math.sin(fa) * 40, y0 = -1 - Math.cos(fa) * 22;
  const f = toss(x0, y0, Math.cos(a) * sp * 0.8, Math.sin(a) * sp, age, G, -1);
  f.size = size;
  return f;
}

export function draw(p, time, o) {
  const C = fit(o.palette, 7), P = { ...pose(o, time), pose: o.pose }, g = GRID, yb = P.by - 1;
  body(g, C, P);
  junk(g, C, P);
  props(g, C, P);
  face(g, C, P, time);
  // 外框：亮面那側用深的身體色，其他用最暗色（原本史萊姆的做法）
  g.outline((x, y, nx, ny) => (ny < 0 && nx <= 0 && y < yb - P.H * 0.5 ? C[1] : C[0]));
  g.draw(p, 1, P.shake);
  // 甩出去的水滴（壓地的時候）
  if (o.pose === "land") for (let i = 0; i < NDROP; i++) {
    const f = droplet(i, o, P.age);
    if (f.landed || inside(P, f.x, f.y)) continue;
    p.px(f.x, f.y, C[6]); p.px(f.x - 1, f.y, C[4]); if (f.size > 2) p.px(f.x, f.y + 1, C[3]);
    p.glow(f.x, f.y, 6, C[4], 0.3);
  }
  // 孢子往上飄
  cycle(time, 2.4, 9, (o.seed ?? 1) * 13 + 1, (r) => r.range(1.4, 2.2), (ag, L, r, i) => {
    const k = ag / L, x = r.range(-40, 40) + Math.sin(ag * 2.1 + i * 1.7) * 4, y = -2 - r.range(14, 30) * ag - 6 * ag * ag;
    const a = Math.min(1, k * 4) * Math.min(1, (1 - k) * 2.5), tw = 0.6 + 0.4 * Math.sin(ag * 7 + i * 2.3);
    p.dot(x, y, tw > 0.8 ? C[6] : C[5], a);
    p.glow(x, y, 7, C[5], 0.34 * a * tw);
  });
  // 光：身體透出來的光、碎片的金光、壓地時的閃光
  const cx = P.lean * P.H * 0.4, cy = yb - P.H * 0.45, [sx, sy] = at(P, -0.86, 0.6);
  p.glow(cx * 0.5, -20, 96, C[3], 0.26);
  p.glow(cx, cy, 46 + P.W * 0.3, C[4], 0.18);
  p.glow(sx, sy, 22, SHARD[2], 0.45 + 0.1 * Math.sin(time * 5));
  if (o.pose === "land") p.glow(0, -4, 64, C[5], 0.5 * Math.exp(-P.age * 7));
  if (o.pose === "beam") { p.glow(cx, cy, 70, SHARD[2], 0.55); p.glow(cx, yb - P.H * 0.36, 26, SHARD[3], 0.7); }
  if (o.pose === "spit" || o.pose === "inhale") p.glow(cx, yb - P.H * 0.36, 20, "#ff8a2a", o.pose === "spit" ? 0.5 * (1 - P.k) : 0.25 * P.k);
}

// 地上的一灘黏液（畫在角色後面）
export function drawBack(p, time, o) {
  const C = fit(o.palette, 7), P = pose(o, time);
  if (P.air) return;
  const R = P.W / 2 + 6 + (o.pose === "land" ? 14 * Math.exp(-P.age * 5) * (1 - Math.exp(-P.age * 40)) : 0), hp = Math.min(3, 1 + R * 0.05);
  for (let x = Math.floor(-R); x <= Math.ceil(R); x++) {
    const d = Math.abs(x + 0.5) / R;
    if (d > 1) continue;
    const top = -1 - Math.round(Math.sqrt(1 - d * d) * hp);
    for (let y = top; y <= 0; y++) {
      let c = y === top ? C[5] : y === 0 ? C[2] : C[4];
      if (d > 0.88) c = y === top ? C[4] : C[3];
      if (y === top && d < 0.88 && lnoise(time, 3.2, 7, x * 0.12, 3) > 0.55) c = C[6];
      p.px(x, y, c);
    }
    if (d > 0.96) p.px(x, top - 1, C[1]);
  }
  p.glow(0, -2, R * 1.2 + 8, C[4], 0.16);
}
