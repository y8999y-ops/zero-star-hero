// 主角外型（重畫版）：一張自己畫的 24×38 站姿原圖，貼到 PixelFX 骨架上。
// 骨架每畫一個像素，都會告訴我們它對應原圖的哪一格（posed().src），所以跑、跳、各種武器招式
// 都會自動穿上這套衣服；明暗則用骨架算出來的光影（4 階），光源固定在左上。
// 參考：Classic Hero、MV Platformer Male、Ars Notoria hero（見 docs/素材參考.md）。
// 不依賴瀏覽器，node 的預覽工具也能用：node game/tools/preview.mjs hero out.png
import { posed, skeleton, hex, DUMMY_PAL } from "../../pixelfx/src/core/index.js";

const C = (s) => hex(s) >>> 0;

// ---- 原圖：每格是一種「材質」，對齊骨架的站姿（面朝右，近手在左、遠手在右）
// H 頭髮　F 皮膚　E 眼睛　K 帽兜邊　J 帽T　j 袖子　T 帽繩　t 繩頭　Q 口袋　R 羅紋（下襬、袖口）
// （手掌不畫在原圖上：站姿時手和大腿重疊，會貼錯；改成在手的關節附近塗皮膚色）
// L 牛仔褲　S 球鞋　X 鞋子紅線　O 鞋底
const SPRITE = [
  "...........HHH..........",
  "..........HHHHH.........",
  ".........HHHHHHH........",
  ".........HHHHFEF........",
  ".........HHFFFFFF.......",
  ".........HHKFFFFF.......",
  ".........KKKJTJTJ.......",
  ".......jjJJJTJTJJj......",
  "......jjJJJJTJTJJjj.....",
  "......jjJJJJtJtJJJjj....",
  "......jJJJJJJJJJJJjj....",
  "......jjJJJJJJJJJJj.....",
  ".....jjjJJJJJJJJJj......",
  ".....jjjJJJJJJJJJj......",
  ".....jjjJJJJJJJJJj......",
  "....jjjjJJJJJJJJJ.......",
  "....jjjjJJQQQQQJJ.......",
  "....jjjjJQJJJJJQJ.......",
  ".....jjjJQQQQQQJJj......",
  ".....jjjJJJJJJJJJj......",
  ".....jjjjRRRRRRRjjj.....",
  "......jjjjRRRRRjjjj.....",
  ".......RRRRLLLjjjjjL....",
  ".......RRRRRLLLjjjRR....",
  ".......LRRRLLLLLRRRL....",
  "........LRLLLLLLLRL.....",
  "........LLLLLLLLLLLL....",
  "........LLLLLLLLLLLL....",
  ".........LLLLLLLLLLL....",
  "........LLLLLLLLLLLL....",
  "........LLLLLLLLLLLL....",
  "........LLLLLLLLLLL.....",
  "........LLLLLLLLLLL.....",
  "........LLLLLLLLLLL.....",
  "........LLLLLLLLLLL.....",
  ".......SLLLLLSSLLLSSS...",
  ".......SSXSSSSSSSSXSSS..",
  "........OOOOOOOOOOOOO...",
];
// 每種材質的 4 階：亮 → 暗（骨架的光影決定用哪一階）
const RAMP = {
  H: ["#4a4468", "#2e2a48", "#1e1a32", "#120f20"],
  F: ["#ffe0c0", "#f2b48a", "#c47e5c", "#8a4e3a"],
  K: ["#2a8a7a", "#1e6a60", "#14504a", "#0c3432"],
  J: ["#6ad8b8", "#3aa88e", "#24806e", "#165a50"],
  R: ["#3aa88e", "#24806e", "#165a50", "#0e3e38"],
  Q: ["#24806e", "#1e6e5e", "#165a50", "#0e3e38"],
  L: ["#6a7ec8", "#3e52a0", "#2c3a78", "#1c2450"],
  S: ["#ffffff", "#e2e0ea", "#a8a6b8", "#6e6c80"],
  O: ["#5a5470", "#3e3a52", "#2a2638", "#1a1724"],
};
RAMP.j = RAMP.J;
const FIXED = { E: C("#14101c"), T: C("#f4f4ff"), t: C("#c0c6e0"), X: C("#d8343a") };
const RAMP_C = Object.fromEntries(Object.entries(RAMP).map(([k, v]) => [k, v.map(C)]));
const OUTLINE = C("#120e1a");

// 骨架的假人色 → 第幾階（A..D 外殼、E..G 關節、J 接縫、m 胸口記號）
const TONE = new Map(Object.entries({ A: 0, B: 1, C: 2, D: 3, E: 1, F: 2, G: 3, J: 3, m: 1 }).map(([k, t]) => [hex(DUMMY_PAL[k]) >>> 0, t]));

// 原圖每一格（含空格）對到最近的「有畫東西」的格子，骨架偶爾會指到身體外一點點
const MAT = SPRITE.join("").split("").map((ch) => (ch === "." ? null : ch));
const NEAREST = new Int16Array(24 * 38).fill(-1);
for (let r = 0; r < 38; r++) for (let c = 0; c < 24; c++) {
  let best = -1, bd = 1e9;
  for (let y = Math.max(0, r - 7); y < Math.min(38, r + 8); y++) for (let x = Math.max(0, c - 7); x < Math.min(24, c + 8); x++) {
    const d = (x - c) ** 2 + (y - r) ** 2;
    if (MAT[y * 24 + x] && d < bd) { bd = d; best = y * 24 + x; }
  }
  NEAREST[r * 24 + c] = best;
}

// 圍巾：紅色，3 階；結打在脖子前面
const SCARF = ["#ff7a60", "#d8343a", "#9c1a2a", "#5c0f1e"].map(C);
// 圍在脖子上的一圈（從身體前面看到的部分）
const KNOT = [
  ".kkkk.",
  "kaabbk",
  ".kkkk.",
];

// skeleton() 會解一次骨架，同一個姿勢重複算很浪費，記下來
const SK = new Map();
function joints(q) {
  const key = JSON.stringify(q);
  let j = SK.get(key);
  if (!j) {
    if (SK.size > 3000) SK.clear();
    const s = skeleton(q).joints;
    j = { head: s.head, neck: s.neck, hands: [s.handN, s.handF] };
    SK.set(key, j);
  }
  return j;
}

/** 圍巾：幾個點用簡單的繩子物理跟著脖子跑（跑越快越往後飄，停下來會慢慢垂下）。 */
export function createScarf(n = 6) {
  return { pts: Array.from({ length: n }, () => ({ x: 0, y: 0, px: 0, py: 0 })), init: false, clock: 0 };
}
const SEG = 2.6;
export function updateScarf(s, ax, ay, vx, dt) {
  s.clock += dt;
  if (!s.init) {
    s.pts.forEach((p, i) => { p.x = p.px = ax - i * SEG; p.y = p.py = ay + i * 0.5; });
    s.init = true;
  }
  const P = s.pts;
  P[0].x = P[0].px = ax;
  P[0].y = P[0].py = ay;
  for (let i = 1; i < P.length; i++) {
    const p = P[i], nx = p.x + (p.x - p.px) * 0.86, ny = p.y + (p.y - p.py) * 0.86;
    p.px = p.x;
    p.py = p.y;
    p.x = nx - vx * 0.0009 * i;
    p.y = ny + 20 * dt * dt * 60 + Math.sin(s.clock * 9 + i * 0.9) * 0.05 * i;
  }
  for (let k = 0; k < 3; k++) for (let i = 1; i < P.length; i++) {
    const a = P[i - 1], b = P[i], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, f = (d - SEG) / d;
    if (i === 1) { b.x -= dx * f; b.y -= dy * f; }
    else { a.x += dx * f * 0.5; a.y += dy * f * 0.5; b.x -= dx * f * 0.5; b.y -= dy * f * 0.5; }
  }
}

/** 脖子在世界座標的位置（給圍巾當錨點）。 */
export function neckOf(x, y, q, flip) {
  const j = joints(q), n = j.neck, side = flip ? -1 : 1;
  return [x + side * ((q.x ?? 0) + n[0] - 1) - (flip ? 1 : 0), y + (q.y ?? 0) + n[1] + 3];
}

/**
 * 把主角畫進 frame：圍巾（身體後面）、身體、圍巾結。
 * tint 非 0 時整個人塗成那個實色（受擊閃光、閃避殘影），不用半透明。
 */
export function paintHero(frame, x, y, q, flip, { tint = 0, scarf = null } = {}) {
  const W = frame.w, H = frame.h, Cc = frame.color, fox = frame.ox | 0, foy = frame.oy | 0;
  const put = (px, py, c) => {
    px -= fox; py -= foy;
    if (px < 0 || py < 0 || px >= W || py >= H) return;
    Cc[py * W + px] = tint || c;
  };
  const side = flip ? -1 : 1, bx = Math.round(x + side * (q.x ?? 0)), by = Math.round(y + (q.y ?? 0));
  const wx = (lx) => (flip ? bx - lx - 1 : bx + lx);

  if (scarf && scarf.init && !tint) drawScarf(scarf, put);

  const r = posed(q), hands = joints(q).hands;
  for (let i = 0; i < r.n; i++) {
    const c = r.color[i] >>> 0;
    let col;
    if (r.ink[i]) col = OUTLINE;
    else {
      const t = TONE.get(c);
      if (t === undefined) col = c;   // 武器：用武器自己的顏色
      else {
        const s = r.src[i], hx = r.xs[i] + 0.5, hy = r.ys[i] + 0.5;
        const m = hands.some((h) => (hx - h[0]) ** 2 + (hy - h[1]) ** 2 < 4.5) ? "F" : s >= 0 && NEAREST[s] >= 0 ? MAT[NEAREST[s]] : "J";
        col = FIXED[m] ?? RAMP_C[m][t];
      }
    }
    put(wx(r.xs[i]), by + r.ys[i], col);
  }

  // 圍巾結（在身體前面）
  if (!tint) {
    const [nx, ny] = neckOf(x, y, q, flip), kx = Math.round(nx) - 2 + (flip ? -1 : 1), ky = Math.round(ny) - 2;
    const K = { k: OUTLINE, a: SCARF[0], b: SCARF[1], c: SCARF[2] };
    KNOT.forEach((row, j) => [...row].forEach((ch, i) => ch !== "." && put(kx + (flip ? 5 - i : i), ky + j, K[ch])));
  }
}

// 圍巾：沿著物理點畫一條 2px 寬的布（上亮下暗），尾巴兩條短鬚，最後外面描一圈 1px 外框
function drawScarf(s, put) {
  const P = s.pts, cells = new Map(), key = (x, y) => x + "," + y;
  const set = (x, y, c) => cells.set(key(x, y), [x, y, c]);
  for (let i = 1; i < P.length; i++) {
    let x0 = Math.round(P[i - 1].x), y0 = Math.round(P[i - 1].y);
    const x1 = Math.round(P[i].x), y1 = Math.round(P[i].y);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    const tone = i >= P.length - 2 ? 2 : 1;
    for (;;) {
      set(x0, y0 - 1, SCARF[tone - 1]);
      set(x0, y0, SCARF[tone]);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  const t = P[P.length - 1], tx = Math.round(t.x), ty = Math.round(t.y);
  set(tx, ty + 1, SCARF[2]);   // 尾端一小段垂下來的布邊
  for (const [x, y] of [...cells.values()]) for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (!cells.has(key(x + ox, y + oy))) put(x + ox, y + oy, OUTLINE);
  }
  for (const [x, y, c] of cells.values()) put(x, y, c);
}
