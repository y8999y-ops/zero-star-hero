// 系統的形象草稿：三個方向 × 三個表情（平常、得意、吃驚）。node game/tools/drafts/system-persona.mjs out.png
import { writeFileSync } from "node:fs";
import { encodePNG } from "../../../pixelfx/tools/lib/png.mjs";

const S = 40, K = 8, COLS = 3, ROWS = 3;
const W = S * COLS, H = S * ROWS + 0;
const img = new Uint8Array(W * K * H * K * 4);
const hexc = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const P = { O: "#06202e", D: "#14587a", M: "#2a9cc4", L: "#7ae8ff", W: "#e6ffff", S: "#081824", s: "#0e2c40", P: "#ff7ad8", Y: "#ffe27a" };
let grid;
const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < S && y < S) grid[y][x] = c; };
const get = (x, y) => (x >= 0 && y >= 0 && x < S && y < S ? grid[y][x] : null);
function outline() {
  const add = [];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (!get(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => get(x + a, y + b) && get(x + a, y + b) !== "O")) add.push([x, y]);
  for (const [x, y] of add) set(x, y, "O");
}
const FACES = {
  normal: ["#....#", "#....#", "......", ".####."],
  smug: ["##..##", "......", "......", "..###."],
  wow: ["##..##", "##..##", "......", "..##..", "..##.."],
};
function face(cx, cy, f, c = "W") { const A = FACES[f]; A.forEach((r, j) => [...r].forEach((ch, i) => ch === "#" && set(cx - 3 + i, cy - 2 + j, c))); }

// A：全像小螢幕（漂浮的小電視、天線、螢幕上是表情）
function monitor(f, bob) {
  const x0 = 9, y0 = 12 + bob, w = 22, h = 17;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const corner = (x === 0 || x === w - 1) && (y === 0 || y === h - 1);
    if (corner) continue;
    const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
    set(x0 + x, y0 + y, edge ? (y < h / 2 && x < w / 2 ? "L" : "M") : x < 2 || y < 2 || x > w - 3 || y > h - 3 ? (x < 2 || y < 2 ? "M" : "D") : "S");
  }
  for (let y = 3; y < h - 3; y += 2) for (let x = 3; x < w - 3; x++) set(x0 + x, y0 + y, "s");   // 螢幕掃描線
  set(x0 + 4, y0 + 3, "L"); set(x0 + 5, y0 + 3, "L"); set(x0 + 4, y0 + 4, "L");                     // 螢幕反光
  for (let i = 1; i <= 5; i++) set(x0 + 14 + (i >> 1), y0 - i, "M");                              // 天線
  set(x0 + 17, y0 - 6, "Y"); set(x0 + 16, y0 - 6, "Y"); set(x0 + 17, y0 - 7, "Y");
  face(x0 + 11, y0 + 9, f);
  if (f === "smug") { set(x0 + 5, y0 + 11, "P"); set(x0 + 16, y0 + 11, "P"); }
  // 底下的投影光錐（像全像投影出來的）
  for (let y = 0; y < 5; y++) for (let x = -2 - y; x <= 2 + y; x++) if ((x + y) % 2 === 0 && y > 1) set(20 + x, y0 + h + 2 + y, "D");
}
// B：星盤水晶（一顆會飄的菱形水晶，中間一塊暗的臉，外面一圈軌道環）
function crystal(f, bob) {
  const cx = 20, cy = 18 + bob;
  for (let y = -13; y <= 13; y++) for (let x = -10; x <= 10; x++) {
    if (Math.abs(x) / 10 + Math.abs(y) / 13 > 1) continue;
    const t = x < 0 ? (y < 0 ? "L" : "M") : y < 0 ? "M" : "D";
    set(cx + x, cy + y, t);
  }
  for (let y = -4; y <= 4; y++) for (let x = -6; x <= 6; x++) if ((x / 6.5) ** 2 + (y / 4.5) ** 2 <= 1) set(cx + x, cy + y, "S");
  face(cx, cy + 1, f);
  for (let a = 0; a < 360; a += 3) { const r = (a * Math.PI) / 180, x = Math.round(cx + Math.cos(r) * 17), y = Math.round(cy + 6 + Math.sin(r) * 4); if (Math.sin(r) > 0 || !get(x, y)) set(x, y, Math.sin(r) > 0 ? "L" : "D"); }
  set(cx - 4, cy - 8, "W"); set(cx - 3, cy - 9, "W");
  if (f === "smug") { set(cx - 6, cy + 3, "P"); set(cx + 6, cy + 3, "P"); }
}
// C：方塊小機器人（螢幕臉的方塊，兩隻漂浮的「[ ]」括號手）
function cube(f, bob) {
  const x0 = 11, y0 = 11 + bob, w = 18, h = 18;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = Math.min(x, y, w - 1 - x, h - 1 - y);
    if ((x < 2 || x > w - 3) && (y < 2 || y > h - 3) && d === 0) continue;
    set(x0 + x, y0 + y, d === 0 ? (x + y < w ? "L" : "M") : y < 4 ? "M" : d < 3 ? "D" : "S");
  }
  face(x0 + 9, y0 + 10, f);
  for (const s of [-1, 1]) {   // 括號手
    const hx = s < 0 ? x0 - 5 : x0 + w + 3, hy = y0 + 8 + (s < 0 ? 0 : -bob);
    for (let j = 0; j < 6; j++) set(hx + (s < 0 ? 0 : 1), hy + j, "L");
    set(hx + (s < 0 ? 1 : 0), hy, "L"); set(hx + (s < 0 ? 1 : 0), hy + 5, "L");
  }
  set(x0 + 9, y0 - 2, "Y"); set(x0 + 9, y0 - 1, "M");
  if (f === "smug") { set(x0 + 4, y0 + 12, "P"); set(x0 + 14, y0 + 12, "P"); }
}
const DRAW = [monitor, crystal, cube], F = ["normal", "smug", "wow"];
for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
  grid = Array.from({ length: S }, () => new Array(S).fill(null));
  DRAW[r](F[c], c === 2 ? -1 : 0);
  outline();
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const ch = grid[y][x], col = ch ? hexc(P[ch]) : (x + y) % 2 ? [24, 20, 36] : [28, 24, 42];
    for (let j = 0; j < K; j++) for (let i = 0; i < K; i++) { const X = (c * S + x) * K + i, Y = (r * S + y) * K + j, o = (Y * W * K + X) * 4; img[o] = col[0]; img[o + 1] = col[1]; img[o + 2] = col[2]; img[o + 3] = 255; }
  }
}
writeFileSync(process.argv[2], encodePNG(W * K, H * K, img));
console.log("wrote", process.argv[2]);
