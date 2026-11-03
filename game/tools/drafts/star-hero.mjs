// 星星主角草稿：三種造型，畫成一張比較圖（放大彩色、黑色剪影、遊戲中實際大小），並跑規則v2 檢查。
//   node game/tools/drafts/star-hero.mjs out.png
// 每個草稿只畫左半邊（最後一格是中線），程式鏡像成完整剪影；五官、圍巾等不對稱的部分另外用座標放。
// 明暗：光從左上來。身體右下半整體暗一階；貼著上／左外緣的像素亮一階，貼著下／右外緣的暗一階。外框最後自動描 1px。
import { writeFileSync } from "node:fs";
import { encodePNG } from "../../../pixelfx/tools/lib/png.mjs";

const OUT = "#2a1626";
const RAMP = {
  "#": ["#b06a10", "#f0b424", "#ffd84a", "#fff2a0"],   // 身體：淡金色
  h: ["#c47a12", "#f0b424", "#ffd84a", "#fff2a0"],     // 手（圓手套），跟身體同色系
  s: ["#1c2448", "#2c3c78", "#4a62b0", "#7a96e0"],     // 鞋子：深藍
  t: ["#126068", "#1f8a8c", "#3cc8c0", "#9af0e0"],     // 識別色：青色布
  r: ["#c47a12", "#ffd84a", "#fff2a0", "#ffffff"],     // 頭頂的小星星（比身體亮）
};
const FIXED = { e: "#40204a", w: "#ffffff", p: "#ff9a6a" };

const DRAFTS = {
  // A：星星本身就是身體，五個角＝頭、雙手、雙腳
  A: {
    name: "A 星人",
    half: [
      "..........##", ".........###", ".........###", "........####", "........####", ".......#####",
      "...#########", ".h##########", "hh##########", ".h##########", "...#########", ".....#######",
      "......######", "......######", ".....#######", ".....#######", "....######..", "....#####...",
      "...#####....", "...####.....", "..ssss......", ".sssss......",
    ],
    feat: [
      ...[[9, 9], [9, 10], [13, 9], [13, 10]].map(([x, y]) => [x, y, "e"]),
      [8, 11, "p"], [14, 11, "p"],
      ...[8, 9, 10, 11, 12, 13, 14].map((x) => [x, 3, "t"]), [7, 4, "t"], [6, 4, "t"], [5, 5, "t"], [4, 5, "t"],
    ],
  },
  // B：胖胖的圓角星，角比較短，手是圓手套、腳穿鞋
  B: {
    name: "B 胖星",
    half: [
      ".........###", "........####", "........####", ".......#####", ".......#####", "..hh########",
      ".hhh########", ".hh#########", "..##########", "....########", ".....#######", ".....#######",
      ".....#######", "....########", "...#######..", "...sssss....", "..ssssss....",
    ],
    feat: [
      ...[[8, 7], [9, 7], [8, 8], [9, 8], [8, 9], [9, 9], [13, 7], [14, 7], [13, 8], [14, 8], [13, 9], [14, 9]].map(([x, y]) => [x, y, "e"]),
      [8, 7, "w"], [13, 7, "w"], [7, 10, "p"], [15, 10, "p"],
      ...[8, 9, 10, 11, 12, 13, 14].map((x) => [x, 4, "t"]), [15, 5, "t"], [16, 5, "t"], [16, 6, "t"], [17, 6, "t"],
    ],
  },
  // C：圓圓的星之精靈，頭頂一顆小星星，短手短腳分開長
  C: {
    name: "C 星之精靈",
    half: [
      "...........r", "..........rr", ".........rrr", "..........rr", "..........r.", "........####",
      "......######", ".....#######", "....########", "....########", "..hh########", "..hh########",
      "....########", "....########", ".....#######", "......######", ".......#####", ".......ss...",
      "......sss...",
    ],
    feat: [
      ...[[8, 9], [9, 9], [8, 10], [9, 10], [8, 11], [9, 11], [13, 9], [14, 9], [13, 10], [14, 10], [13, 11], [14, 11]].map(([x, y]) => [x, y, "e"]),
      [8, 9, "w"], [13, 9, "w"], [7, 12, "p"], [15, 12, "p"],
      ...[6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map((x) => [x, 15, "t"]), [17, 15, "t"], [18, 16, "t"], [19, 16, "t"],
    ],
  },
};

const hex = (s) => [1, 3, 5].map((k) => parseInt(s.slice(k, k + 2), 16));

function build(d) {
  const H = d.half.length, W = 23, g = Array.from({ length: H }, () => Array(W).fill("."));
  d.half.forEach((row, y) => [...row].forEach((ch, x) => { g[y][x] = ch; g[y][22 - x] = ch; }));
  for (const [x, y, m] of d.feat) if (y < H && x < W) g[y][x] = m;
  // 上下左右各留 1 格給外框
  const P = 1, GW = W + 2 * P, GH = H + 2 * P, mat = Array.from({ length: GH }, () => Array(GW).fill("."));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) mat[y + P][x + P] = g[y][x];
  const empty = (x, y) => x < 0 || y < 0 || x >= GW || y >= GH || mat[y][x] === ".";
  const px = Array.from({ length: GH }, () => Array(GW).fill(null));
  const cx = GW / 2, cy = GH / 2;
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const m = mat[y][x];
    if (m === ".") continue;
    if (FIXED[m]) { px[y][x] = FIXED[m]; continue; }
    let t = (x - cx) + (y - cy) > 4 ? 1 : 2;
    if (empty(x - 1, y) || empty(x, y - 1)) t++;
    if (empty(x + 1, y) || empty(x, y + 1)) t--;
    px[y][x] = RAMP[m][Math.max(0, Math.min(3, t))];
  }
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    if (px[y][x]) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !empty(x + dx, y + dy))) px[y][x] = OUT;
  }
  return { px, W: GW, H: GH };
}

function lint(name, { px, W, H }) {
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? null : px[y][x]);
  const bad = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = at(x, y);
    if (!c) continue;
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => at(x + dx, y + dy));
    if (c === OUT && at(x + 1, y) === OUT && at(x, y + 1) === OUT && at(x + 1, y + 1) === OUT) bad.push(`腫塊(${x},${y})`);
    if (c === OUT && !nb.some((v) => v && v !== OUT)) bad.push(`雙層邊(${x},${y})`);
    if (c !== OUT && !nb.some((v) => v && v !== OUT)) bad.push(`孤立點(${x},${y})`);
  }
  const colors = new Set(px.flat().filter(Boolean)).size;
  console.log(name.padEnd(10), `${W}×${H}`, `顏色 ${colors}`, bad.length ? bad.join(" ") : "規則檢查通過");
}

// ---- 比較圖：每個草稿一欄：放大 8 倍彩色、放大 4 倍黑剪影、實際大小放大 2 倍站在洞窟地面上
const sprites = Object.values(DRAFTS).map((d) => ({ d, s: build(d) }));
sprites.forEach(({ d, s }) => lint(d.name, s));
const K = 8, colW = 25 * K + 24, Wt = colW * sprites.length, Ht = 26 * K + 26 * 4 + 60 + 40;
const img = new Uint8Array(Wt * Ht * 4);
const fill = (x0, y0, w, h, c) => { const [r, g, b] = hex(c); for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const i = (y * Wt + x) * 4; img[i] = r; img[i + 1] = g; img[i + 2] = b; img[i + 3] = 255; } };
fill(0, 0, Wt, Ht, "#1e1a2a");
sprites.forEach(({ s }, n) => {
  const ox = n * colW + 12;
  fill(ox - 4, 4, 25 * K + 8, 26 * K + 8, n % 2 ? "#2c2640" : "#262036");
  const draw = (x0, y0, k, sil) => s.px.forEach((row, y) => row.forEach((c, x) => c && fill(x0 + x * k, y0 + y * k, k, k, sil ? "#0c0a12" : c)));
  draw(ox + (25 - s.W) * K / 2, 8 + (26 - s.H) * K, K, false);
  const y1 = 26 * K + 24;
  fill(ox - 4, y1 - 4, 25 * K + 8, 26 * 4 + 8, "#8a90a8");
  draw(ox + (25 * K - s.W * 4) / 2, y1 + (26 - s.H) * 4, 4, true);
  // 遊戲裡：洞窟背景＋地面，主角原寸放大 2 倍（跟遊戲畫面差不多大）
  const y2 = y1 + 26 * 4 + 16;
  fill(ox - 4, y2, 25 * K + 8, 60, "#1c3438");
  fill(ox - 4, y2 + 60 - 14, 25 * K + 8, 14, "#2a2a3a");
  fill(ox - 4, y2 + 60 - 14, 25 * K + 8, 2, "#4c8a3c");
  draw(ox + 60, y2 + 60 - 14 - s.H * 2 + 2, 2, false);
});
writeFileSync(process.argv[2], encodePNG(Wt, Ht, img));
console.log("wrote", process.argv[2]);
