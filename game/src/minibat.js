// 技能樹「蝙蝠群」的小蝙蝠（蝠翼星）：9×6 的小紫蝙蝠，翅膀上下兩格動畫，一顆紅眼睛，後面拖一點紫色殘光。
// 草稿：game/tools/drafts/minibat.mjs
import { hex } from "../../pixelfx/src/core/index.js";
const P = (c) => hex(c) >>> 0;
const C = { o: P("#160c24"), d: P("#4a2a7a"), m: P("#8058b8"), l: P("#b48ae8"), w: P("#e2d0ff"), e: P("#ff4a5a") };
// 兩格：翅膀張開往上、往下（第 3 輪：兩顆紅眼睛、身體大一點；第 2 輪：加耳朵、兩顆眼睛、翅膀膜的鋸齒邊，外面一圈最暗色的外框）
const FR = [
  ["l.........l", "ll..l.l..ll", ".lm.lml.ml.", ".mmmewemmm.", "..m.mdm.m..", "....ddd....", "..........."],
  ["...........", "....l.l....", "....ewe....", ".lmmmdmmml.", "lm.mdddm.ml", "m.........m", "..........."],
];
function put(frame, x, y, c, glow) {
  x = Math.round(x) - frame.ox; y = Math.round(y) - frame.oy;
  if (x < 0 || y < 0 || x >= frame.w || y >= frame.h) return;
  frame.color[y * frame.w + x] = c;
  if (glow) frame.light[y * frame.w + x] = c;
}
/** m = { x, y, vx, t } */
export function drawMiniBat(frame, m) {
  const f = FR[Math.floor(m.t * 12) % 2], flip = m.vx < 0, H = f.length, Wd = f[0].length;
  const at = (i, j) => j >= 0 && j < H && i >= 0 && i < Wd && f[j][i] !== ".";
  const X = (i) => m.x + (flip ? 5 - i : i - 5), Y = (j) => m.y + j - 3;
  for (let j = -1; j <= H; j++) for (let i = -1; i <= Wd; i++) if (!at(i, j) && (at(i + 1, j) || at(i - 1, j) || at(i, j + 1) || at(i, j - 1))) put(frame, X(i), Y(j), C.o);
  f.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== ".") put(frame, X(i), Y(j), C[ch], ch === "e" || ch === "w"); }));
}
