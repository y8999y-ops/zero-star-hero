// 形態草稿：黏液星（S1～S3）、鐵罐星（C1～C3）。以胖星正面為底，換材質、加零件。
//   node game/tools/drafts/form-drafts.mjs out.png
// 參考（docs/素材參考.md「形態：黏液星、鐵罐星」）：
//   黏液：PixelFX critters/slime（綠色果凍、亮核、白色高光點、腳下黏液）、itch.io Pixelaria 史萊姆 devlog（同色系深淺、上亮下暗、小白點＝濕亮）、
//         Concept Cookie 評語（果凍不只一個高光）。
//   鐵罐：自己畫的垃圾桶怪（縱向亮帶、凸紋一亮一暗、鏽斑、蓋子）、OpenGameArt 金屬圓柱討論（用條紋不用漸層、不抖色、高光沿著圓柱的長邊）。
import { writeFileSync } from "node:fs";
import { encodePNG } from "../../../pixelfx/tools/lib/png.mjs";
import { starPixels } from "../../src/star.js";
import { hex } from "../../../pixelfx/src/core/index.js";

const C = (s) => hex(s) >>> 0;
const OUT = C("#3a1e36");
const SLIME = ["#1f6a3a", "#36a04a", "#6cd45a", "#b8f4a0", "#ffffff"].map(C);
const METAL = ["#2e3440", "#4a5468", "#6e7a90", "#9aa6ba", "#d0d8e6", "#ffffff"].map(C);
const RUST = ["#6e3218", "#a4552a"].map(C);
const GOLD = ["#d08a1c", "#f5c040", "#ffe27a", "#fff4b8", "#ffffff"].map(C);
const TEAL = ["#126068", "#1f8a8c", "#3cc8c0", "#9af0e0"].map(C);
const EYE = [C("#40204a"), C("#ffffff"), C("#ff9a6a")];
const X0 = 11, Y0 = 12;   // 身體座標 (0,0) 在畫布上的位置（正面、不前傾）

function base(q = { view: 0 }) {
  const s = starPixels(q);
  return { ...s, px: s.px.map((r) => r.slice()) };
}
const keep = (c) => EYE.includes(c) || TEAL.includes(c);
// 把身體（金色）換成另一組顏色：用原本是第幾階對應過去
function recolor(s, ramp) {
  for (const row of s.px) for (let i = 0; i < row.length; i++) {
    const k = GOLD.indexOf(row[i]);
    if (k >= 0) row[i] = ramp[Math.min(ramp.length - 1, k)];
  }
}
const set = (s, x, y, c) => { const X = X0 + x, Y = Y0 + y; if (s.px[Y] && X >= 0 && X < s.W) s.px[Y][X] = c; };
const isBody = (s, x, y) => { const c = s.px[Y0 + y]?.[X0 + x]; return c && c !== OUT; };
// 重新描外框（加了零件之後）
function outline(s) {
  for (let y = 0; y < s.H; y++) for (let x = 0; x < s.W; x++) if (s.px[y][x] === OUT) s.px[y][x] = 0;
  const filled = (x, y) => s.px[y]?.[x] && s.px[y][x] !== OUT;
  for (let y = 0; y < s.H; y++) for (let x = 0; x < s.W; x++) {
    if (s.px[y][x]) continue;
    if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) s.px[y][x] = OUT;
  }
}

// ---- 黏液星
function S1() {   // 果凍星＋往下滴的黏液＋兩個高光
  const s = base(); recolor(s, SLIME);
  for (const [x, y, c] of [[2, 11, 2], [2, 12, 1], [2, 13, 1], [26, 11, 2], [26, 12, 2], [26, 13, 1], [26, 14, 1], [11, 19, 2], [11, 20, 1]]) set(s, x, y, SLIME[c]);
  for (const [x, y] of [[20, 14], [21, 15], [9, 3]]) if (isBody(s, x, y)) set(s, x, y, SLIME[4]);
  outline(s); return s;
}
function S2() {   // 腳變成一灘黏液（沒有鞋子），頭頂的角軟軟垂下
  const s = base(); recolor(s, SLIME);
  for (let y = 21; y <= 23; y++) for (let x = -1; x <= 29; x++) if (s.px[Y0 + y]?.[X0 + x]) s.px[Y0 + y][X0 + x] = 0;
  const pud = [[2, 21, 26, 2], [0, 22, 28, 1]];
  for (const [a, y, b, c] of pud) for (let x = a; x <= b; x++) set(s, x, y, SLIME[x < 8 ? c + 1 : c]);
  for (let x = 3; x <= 25; x++) if (!isBody(s, x, 20)) set(s, x, 20, SLIME[2]);
  set(s, 15, 0, SLIME[2]); set(s, 16, 1, SLIME[2]); set(s, 17, 2, SLIME[1]);   // 頭頂垂向一邊
  for (const [x, y] of [[20, 14], [21, 15]]) set(s, x, y, SLIME[4]);
  outline(s); return s;
}
function S3() {   // S1 ＋ 身體裡的氣泡（透明感）
  const s = S1();
  for (const [cx, cy] of [[8, 15], [19, 17], [16, 8]]) for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) if (isBody(s, cx + dx, cy + dy)) set(s, cx + dx, cy + dy, SLIME[3]);
  outline(s); return s;
}

// ---- 鐵罐星
const lid = (s, y0, tilt = 0) => {   // 頭上的蓋子（扁橢圓＋把手），tilt 往右歪
  const rows = ["....##....", "...#..#...", ".44555544.", "3444444443", ".22222221."];
  rows.forEach((r, j) => [...r].forEach((ch, i) => {
    if (ch === ".") return;
    const x = 9 + i + (j < 2 ? tilt : 0), y = y0 + j - (i > 6 ? tilt : 0);
    set(s, x, y, ch === "#" ? METAL[3] : METAL[+ch - 1]);
  }));
};
function band(s, y0, y1) {   // 把身體的某幾列換成圓柱鐵皮：縱向亮帶（左亮右暗）、上下凸紋
  for (let y = y0; y <= y1; y++) {
    const xs = []; for (let x = -2; x <= 30; x++) if (isBody(s, x, y) && !keep(s.px[Y0 + y][X0 + x])) xs.push(x);
    if (!xs.length) continue;
    const a = Math.min(...xs), b = Math.max(...xs), w = b - a + 1;
    for (const x of xs) {
      const u = (x - a) / w;
      let k = u < 0.12 ? 3 : u < 0.3 ? 4 : u < 0.55 ? 3 : u < 0.8 ? 2 : 1;
      if (y === y0) k = Math.min(5, k + 1); else if (y === y0 + 1) k = Math.max(0, k - 1);
      if (y === y1) k = Math.max(0, k - 1);
      set(s, x, y, METAL[k]);
    }
  }
}
function C1() {   // 下半身套著鐵罐，頭上戴蓋子
  const s = base();
  band(s, 13, 20);
  for (const [x, y, k] of [[10, 16, 1], [11, 16, 0], [19, 18, 1]]) set(s, x, y, RUST[k]);
  lid(s, -3, 0);
  outline(s); return s;
}
function C2() {   // 全身鐵皮（眼睛、領巾保留），兩條凸紋＋鏽斑，蓋子歪戴
  const s = base();
  band(s, 0, 20);
  for (const y of [7, 15]) for (let x = 0; x < 29; x++) if (isBody(s, x, y) && !keep(s.px[Y0 + y][X0 + x])) set(s, x, y, METAL[4]);
  for (const [x, y, k] of [[6, 17, 1], [7, 17, 0], [21, 10, 1], [22, 11, 0]]) set(s, x, y, RUST[k]);
  lid(s, -3, 1);
  outline(s); return s;
}
function C3() {   // 星星從鐵罐裡探出來：下半身是圓柱鐵罐（直邊），手從罐子兩側伸出
  const s = base();
  for (let y = 13; y <= 20; y++) for (let x = -2; x <= 30; x++) if (s.px[Y0 + y]?.[X0 + x] && !(y <= 13 && (x < 6 || x > 22))) s.px[Y0 + y][X0 + x] = 0;
  for (let y = 12; y <= 20; y++) for (let x = 6; x <= 22; x++) set(s, x, y, 1);
  band(s, 12, 20);
  for (let y = 12; y <= 20; y++) { set(s, 6, y, METAL[2]); set(s, 22, y, METAL[1]); }
  for (let x = 6; x <= 22; x++) { set(s, x, 16, METAL[x < 12 ? 4 : 3]); set(s, x, 17, METAL[1]); }
  set(s, 9, 18, RUST[1]); set(s, 10, 18, RUST[0]);
  for (let x = 7; x <= 21; x++) set(s, x, 12, METAL[5 - (x > 15 ? 2 : 0)]);
  outline(s); return s;
}

const LIST = [["S1 果凍＋滴落", S1()], ["S2 黏液腳", S2()], ["S3 果凍＋氣泡", S3()], ["C1 下半身鐵罐", C1()], ["C2 全身鐵皮", C2()], ["C3 從罐子探出來", C3()]];

// 規則v2 檢查
for (const [n, s] of LIST) {
  const at = (x, y) => s.px[y]?.[x] || 0, bad = [];
  for (let y = 0; y < s.H; y++) for (let x = 0; x < s.W; x++) {
    const c = at(x, y); if (!c) continue;
    const nb = [at(x + 1, y), at(x - 1, y), at(x, y + 1), at(x, y - 1)];
    if (c === OUT && at(x + 1, y) === OUT && at(x, y + 1) === OUT && at(x + 1, y + 1) === OUT) bad.push(`腫塊(${x},${y})`);
    if (c === OUT && !nb.some((v) => v && v !== OUT)) bad.push(`雙層邊(${x},${y})`);
    if (c !== OUT && !nb.some((v) => v && v !== OUT)) bad.push(`孤立點(${x},${y})`);
  }
  console.log(n.padEnd(12), `顏色 ${new Set(s.px.flat().filter(Boolean)).size}`, bad.length ? bad.join(" ") : "規則檢查通過");
}

// 圖：每個 6 倍放大＋遊戲大小 2 倍
const K = 6, cw = LIST[0][1].W * K + 16, ch = LIST[0][1].H * K + 16, cols = 3, Wt = cw * cols, Ht = ch * 2 + 70;
const img = new Uint8Array(Wt * Ht * 4);
const fill = (x0, y0, w, h, abgr) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const i = (y * Wt + x) * 4; img[i] = abgr & 255; img[i + 1] = (abgr >>> 8) & 255; img[i + 2] = (abgr >>> 16) & 255; img[i + 3] = 255; } };
fill(0, 0, Wt, Ht, C("#1c3438"));
LIST.forEach(([, s], n) => {
  const ox = (n % cols) * cw + 8, oy = Math.floor(n / cols) * ch + 8;
  s.px.forEach((row, y) => row.forEach((c, x) => c && fill(ox + x * K, oy + y * K, K, K, c)));
});
fill(0, ch * 2 + 10, Wt, 60, C("#22383e")); fill(0, ch * 2 + 56, Wt, 14, C("#2a2a3a"));
LIST.forEach(([, s], n) => s.px.forEach((row, y) => row.forEach((c, x) => c && fill(30 + n * 110 + x * 2, ch * 2 + 56 - s.ay * 2 + y * 2, 2, 2, c))));
writeFileSync(process.argv[2], encodePNG(Wt, Ht, img));
console.log("wrote", process.argv[2]);
