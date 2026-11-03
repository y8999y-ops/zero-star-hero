// 星星主角 B「胖星」重畫（放大到約 25px 高）＋光感與透明感。
//   node game/tools/drafts/star-hero-b.mjs out.png
// 透明感的做法（參考玻璃、果凍、水晶的像素畫）：
//   1. 外緣內側一圈亮邊（光穿過去在邊上折射），左上最亮、右下也亮（背光邊）
//   2. 亮邊裡面一圈暗一點的帶子（厚度感）
//   3. 中間偏下有一顆很亮的核心（星星自己在發光，從裡面透出來）
//   4. 左上一道白色斜高光＋一顆小閃光
// 兩種版本：
//   B1 不透明：全部用實色畫出透明「感」（完全符合規則v2）
//   B2 真半透明：只有身體內部（亮邊以內、核心以外）是 70% 不透明，外框和亮邊保持實色，所以邊緣仍是硬邊
// 發光：身體四周一圈柔和的光（特效層，不受規則v2限制）。
import { writeFileSync } from "node:fs";
import { encodePNG } from "../../../pixelfx/tools/lib/png.mjs";

// 左半邊（最後一格是中線），# 身體、h 手套、s 鞋子
const HALF = [
  "............###", "...........####", "...........####", "..........#####", "..........#####", ".........######",
  "....###########", "..hh###########", ".hhh###########", ".hhh###########", "..hh###########", "....###########",
  "......#########", ".......########", ".......########", ".......########", "......#########", ".....##########",
  "....###########", "...#########...", "...########....", "...sssss.......", "..ssssss.......",
];
const W0 = 29, C0 = 14;
const OUT = "#3a1e36";
const GLASS = ["#d08a1c", "#f5c040", "#ffe27a", "#fff4b8", "#ffffff"];   // 暗帶 → 亮邊 → 核心
const MITT = ["#d08a1c", "#f5c040", "#ffe27a", "#fff4b8"];
const SHOE = ["#1c2448", "#2c3c78", "#4a62b0", "#7a96e0"];
const TEAL = ["#126068", "#1f8a8c", "#3cc8c0", "#9af0e0"];
const EYE = "#40204a", WHITE = "#ffffff", BLUSH = "#ff9a6a";
const hex = (s) => [1, 3, 5].map((k) => parseInt(s.slice(k, k + 2), 16));

function build() {
  const H = HALF.length, P = 1, W = W0 + 2 * P, Hh = H + 2 * P;
  const mat = Array.from({ length: Hh }, () => Array(W).fill("."));
  HALF.forEach((row, y) => [...row].forEach((ch, x) => { mat[y + P][x + P] = ch; mat[y + P][W0 - 1 - x + P] = ch; }));
  const empty = (x, y) => x < 0 || y < 0 || x >= W || y >= Hh || mat[y][x] === ".";
  // 到外緣的距離（四方向 BFS），用來分亮邊、暗帶、內部
  const dist = Array.from({ length: Hh }, () => Array(W).fill(0));
  let q = [];
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) if (mat[y][x] !== "." && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => empty(x + a, y + b))) { dist[y][x] = 1; q.push([x, y]); }
  while (q.length) {
    const nq = [];
    for (const [x, y] of q) for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + a, ny = y + b;
      if (!empty(nx, ny) && !dist[ny][nx]) { dist[ny][nx] = dist[y][x] + 1; nq.push([nx, ny]); }
    }
    q = nq;
  }
  const cx = C0 + P, cy = 15 + P;   // 核心位置（肚子，眼睛下面隔開幾格）
  const px = Array.from({ length: Hh }, () => Array(W).fill(null));   // [顏色, 透明度]
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
    const m = mat[y][x];
    if (m === ".") continue;
    const tl = empty(x - 1, y) || empty(x, y - 1), br = empty(x + 1, y) || empty(x, y + 1);
    if (m === "s") { px[y][x] = [SHOE[tl ? 3 : br ? 1 : 2], 1]; continue; }
    if (m === "h") { px[y][x] = [MITT[tl ? 3 : br ? 1 : 2], 1]; continue; }
    const d = dist[y][x], side = (x - cx) + (y - cy) > 2;   // 右下半
    const core = Math.hypot((x - cx) * 0.9, y - cy);
    let c, a = 1;
    const plus = (x === cx && Math.abs(y - cy) <= 1) || (y === cy && Math.abs(x - cx) <= 1);
    if (plus) c = GLASS[4];                                         // 核心：十字形的小閃光
    else if (core < 2.6) c = GLASS[3];
    else if (d === 1) c = tl ? GLASS[3] : GLASS[2];            // 亮邊：左上最亮，右下（背光）也亮
    else if (d === 2) { c = side ? GLASS[1] : GLASS[2]; a = 0.88; }   // 亮邊內側的帶子
    else if (core < 4.6) { c = GLASS[2]; a = 0.85; }             // 核心外圍的光暈
    else { c = side ? GLASS[0] : GLASS[1]; a = 0.78; }            // 內部：較暗、透明
    px[y][x] = [c, a];
  }
  const put = (x, y, c, a = 1) => (px[y + P][x + P] = [c, a]);
  // 眼睛（2×3）＋白色高光、腮紅
  for (const ex of [10, 17]) for (let y = 9; y < 12; y++) for (let x = ex; x < ex + 2; x++) put(x, y, EYE);
  put(10, 9, WHITE); put(17, 9, WHITE);
  put(9, 12, BLUSH); put(19, 12, BLUSH);
  // 青色領巾：一圈＋前面垂下的三角
  for (let x = 9; x <= 19; x++) put(x, 5, TEAL[x < 13 ? 3 : x > 16 ? 1 : 2]);
  for (let x = 13; x <= 15; x++) put(x, 6, TEAL[x === 13 ? 2 : 1]);
  put(14, 7, TEAL[1]);
  // 左上的斜高光（玻璃反光）＋一顆小閃光
  for (const [x, y] of [[6, 7], [7, 7], [7, 8]]) put(x, y, WHITE);
  put(13, 2, WHITE);
  // 外框
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
    if (px[y][x]) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => !empty(x + a, y + b))) px[y][x] = [OUT, 1];
  }
  return { px, W, H: Hh, core: [cx, cy] };
}

function lint(s) {
  const at = (x, y) => (x < 0 || y < 0 || x >= s.W || y >= s.H || !s.px[y][x] ? null : s.px[y][x][0]);
  const bad = [];
  for (let y = 0; y < s.H; y++) for (let x = 0; x < s.W; x++) {
    const c = at(x, y);
    if (!c) continue;
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => at(x + a, y + b));
    if (c === OUT && at(x + 1, y) === OUT && at(x, y + 1) === OUT && at(x + 1, y + 1) === OUT) bad.push(`腫塊(${x},${y})`);
    if (c === OUT && !nb.some((v) => v && v !== OUT)) bad.push(`雙層邊(${x},${y})`);
    if (c !== OUT && !nb.some((v) => v && v !== OUT)) bad.push(`孤立點(${x},${y})`);
  }
  // 規則v2：外緣（外框＋亮邊）不能半透明
  let edgeAlpha = 0;
  for (let y = 0; y < s.H; y++) for (let x = 0; x < s.W; x++) {
    const p = s.px[y][x];
    if (p && p[1] < 1 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => at(x + a, y + b) === OUT)) edgeAlpha++;
  }
  const colors = new Set(s.px.flat().filter(Boolean).map((p) => p[0])).size;
  console.log(`B 胖星 ${s.W}×${s.H} 顏色 ${colors}`, bad.length ? bad.join(" ") : "規則檢查通過", edgeAlpha ? `邊緣半透明 ${edgeAlpha}` : "邊緣全實色");
}

// ---- 比較圖：B1 不透明、B2 真半透明，各放在有花紋的洞窟背景上（看得出透明），加上發光
const s = build();
lint(s);
const K = 8, panelW = 40 * K, panelH = 34 * K, gap = 16, Wt = panelW * 3 + gap * 4, Ht = panelH + gap * 2 + 30 + 96;
const img = new Float32Array(Wt * Ht * 3);
const setPx = (x, y, [r, g, b], a = 1) => { if (x < 0 || y < 0 || x >= Wt || y >= Ht) return; const i = (y * Wt + x) * 3; img[i] = img[i] * (1 - a) + r * a; img[i + 1] = img[i + 1] * (1 - a) + g * a; img[i + 2] = img[i + 2] * (1 - a) + b * a; };
const addPx = (x, y, [r, g, b], k) => { if (x < 0 || y < 0 || x >= Wt || y >= Ht) return; const i = (y * Wt + x) * 3; img[i] += r * k; img[i + 1] += g * k; img[i + 2] += b * k; };
const rect = (x0, y0, w, h, c) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) setPx(x, y, hex(c)); };
rect(0, 0, Wt, Ht, "#14121c");

// 洞窟背景：磚牆＋直條，讓半透明看得出來
function cave(x0, y0, w, h, k) {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const gx = Math.floor(x / k), gy = Math.floor(y / k);
    const brick = (gy % 6 === 0) || ((gx + (Math.floor(gy / 6) % 2) * 4) % 8 === 0);
    const stripe = Math.floor(gx / 3) % 2 === 0;
    setPx(x0 + x, y0 + y, hex(brick ? "#16262a" : stripe ? "#2a4a50" : "#22383e"));
  }
}
function drawStar(x0, y0, k, translucent, glow) {
  const [gcx, gcy] = s.core;
  if (glow) {
    // 柔和的光：從核心往外，半徑約 20px
    const R = 20 * k, cx = x0 + (gcx + 0.5) * k, cy = y0 + (gcy + 0.5) * k;
    for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {
      const f = 1 - Math.hypot(x, y) / R;
      if (f > 0) addPx(Math.round(cx + x), Math.round(cy + y), hex("#ffc850"), f * f * 0.45);
    }
  }
  s.px.forEach((row, y) => row.forEach((p, x) => {
    if (!p) return;
    const a = translucent ? p[1] : 1;
    for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) setPx(x0 + x * k + i, y0 + y * k + j, hex(p[0]), a);
  }));
}
const labels = ["B1 不透明＋發光", "B2 真半透明（內部 70%）", "B2＋發光"];
[[false, false], [true, false], [true, true]].forEach(([tr, gl], n) => {
  const x0 = gap + n * (panelW + gap), y0 = gap;
  cave(x0, y0, panelW, panelH, K);
  if (!tr && n === 0) drawStar(x0 + (panelW - s.W * K) / 2, y0 + (panelH - s.H * K) / 2, K, false, true);
  else drawStar(x0 + (panelW - s.W * K) / 2, y0 + (panelH - s.H * K) / 2, K, tr, gl);
});
// 下面一排：遊戲中原寸放大 3 倍
const y1 = gap + panelH + 30;
[[false, true], [true, false], [true, true]].forEach(([tr, gl], n) => {
  const x0 = gap + n * (panelW + gap);
  cave(x0, y1, panelW, 90, 3);
  rect(x0, y1 + 70, panelW, 20, "#2a2a3a");
  rect(x0, y1 + 70, panelW, 3, "#4c8a3c");
  drawStar(Math.round(x0 + panelW / 2 - s.W * 1.5), y1 + 70 - s.H * 3 + 3, 3, tr, gl);
});
const out = new Uint8Array(Wt * Ht * 4);
for (let i = 0; i < Wt * Ht; i++) { out[i * 4] = Math.min(255, img[i * 3]); out[i * 4 + 1] = Math.min(255, img[i * 3 + 1]); out[i * 4 + 2] = Math.min(255, img[i * 3 + 2]); out[i * 4 + 3] = 255; }
writeFileSync(process.argv[2], encodePNG(Wt, Ht, out));
console.log("wrote", process.argv[2], labels.join(" / "));
