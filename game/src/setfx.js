// 史詩套裝 4 件效果的小特效（第 5 批，自己畫的像素；參考 pixelfx arcane/star-fall 的流星頭＋尾、holy/divine-shield 的光圈）
//   流星記號：敵人頭上一顆會轉的金色十字小星（5 秒）
//   小流星：從右上斜斜砸下來（0.22 秒），白頭金尾，落地交給 pixelfx impacts/hit-spark
//   夜宴護盾：主角身邊一圈紅色的光圈（有護盾時），上緣亮、下緣暗，慢慢轉的亮點
//   星辰共鳴：主角身邊繞圈的青色小光點（大招後 10 秒）
// 草稿：game/tools/drafts/setfx.mjs
import { hex } from "../../pixelfx/src/core/index.js";

const P = (c) => hex(c) >>> 0;
const GOLD = ["#6e3a0c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff"].map(P);
const RED = ["#4a0a18", "#8a1a2a", "#d42e36", "#ff6a52", "#ffc0b0"].map(P);
const CY = ["#0c2a60", "#1e64b0", "#3ab8f0", "#9af0ff", "#f0ffff"].map(P);
export const STRIKE_T = 0.22;

function put(frame, x, y, c, glow) {
  x = Math.round(x) - frame.ox; y = Math.round(y) - frame.oy;
  if (x < 0 || y < 0 || x >= frame.w || y >= frame.h) return;
  frame.color[y * frame.w + x] = c;
  if (glow) frame.light[y * frame.w + x] = c;
}

/** 流星記號（第 2 輪：加深色外框，在魔物身上也看得到）：中心 (x, y)，t 秒 */
export function drawMark(frame, x, y, t) {
  const big = Math.floor(t * 6) % 2 === 0, r = big ? 3 : 2, cells = [[0, 0, 5]];
  for (let k = 1; k <= r; k++) { const c = k === 1 ? 4 : k === 2 ? 3 : 2; cells.push([k, 0, c], [-k, 0, c], [0, k, c], [0, -k, c]); }
  if (big) for (const [dx, dy] of [[1, 1], [-1, -1], [1, -1], [-1, 1]]) cells.push([dx, dy, 2]);
  const has = new Set(cells.map(([a, b]) => a + "," + b));
  for (const [dx, dy] of cells) for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!has.has(dx + ox + "," + (dy + oy))) put(frame, x + dx + ox, y + dy + oy, GOLD[0]);
  for (const [dx, dy, c] of cells) put(frame, x + dx, y + dy, GOLD[c], 1);
}

/** 小流星（第 2 輪：頭 3×3、尾巴 2 格粗 20 格長）：s = { x, y（落點）, t } — 從右上 (x+30, y-60) 砸到 (x, y) */
export function drawStrike(frame, s) {
  const k = Math.min(1, s.t / STRIKE_T), hx = s.x + 30 * (1 - k), hy = s.y - 60 * (1 - k);
  for (let i = 0; i < 20; i++) {
    const tx = hx + i * 0.5, ty = hy - i, c = i < 3 ? GOLD[4] : i < 7 ? GOLD[3] : i < 12 ? GOLD[2] : GOLD[1];
    put(frame, tx, ty, c, i < 12);
    if (i < 12) put(frame, tx + 1, ty, i < 5 ? GOLD[3] : GOLD[1], i < 8);
  }
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) put(frame, hx + dx, hy + dy, dx === 0 && dy === 0 ? GOLD[5] : GOLD[4], 1);
  for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) put(frame, hx + dx, hy + dy, GOLD[3], 1);
}

/** 夜宴護盾（第 2 輪：實線圓圈、上半亮下半暗、一段亮光在轉；護盾少時圈變短）：中心 (x, y)，k＝護盾量 0～1 */
export function drawShield(frame, x, y, k, t) {
  const R = 15, n = 140, spin = t * 2, len = Math.max(0.3, k);
  for (let i = 0; i < n; i++) {
    const f = i / n;
    if (f > len) continue;
    const a = f * Math.PI * 2 - Math.PI / 2 + spin * 0.3, px = x + Math.cos(a) * R, py = y + Math.sin(a) * R * 1.15;
    const top = Math.sin(a) < 0, d = Math.abs(((a - spin) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
    // 第 3 輪：上半不發光（不然被光洗成粉白），只有轉的那段亮光發光；內圈多一圈暗紅，看起來有厚度
    put(frame, px, py, d < 0.3 ? RED[4] : top ? RED[3] : RED[2], d < 0.3);
    put(frame, x + Math.cos(a) * (R - 1), y + Math.sin(a) * (R - 1) * 1.15, top ? RED[2] : RED[1]);
  }
}

/** 星辰共鳴（第 2 輪：光點 2×2、尾巴 4 格）：中心 (x, y)，三顆繞圈的青色光點 */
export function drawReson(frame, x, y, t) {
  for (let k = 0; k < 3; k++) {
    const a = t * 4 + (k * Math.PI * 2) / 3;
    for (let q = 4; q >= 0; q--) {
      const b = a - q * 0.16, px = x + Math.cos(b) * 14, py = y + Math.sin(b) * 6 - 4, c = q === 0 ? CY[4] : q < 2 ? CY[3] : q < 4 ? CY[2] : CY[1];
      put(frame, px, py, c, 1);
      if (q === 0) { put(frame, px + 1, py, CY[3], 1); put(frame, px, py + 1, CY[3], 1); put(frame, px + 1, py + 1, CY[2], 1); }
    }
  }
}

/** 星王化（神話「星王之冠」，第 2 輪：光芒改成畫在主角後面、根部 2 格寬往外變細變暗；王冠放大、只有寶石發光）
 *  drawKingBack 在主角之前畫（光芒、星屑），drawKingFront 在主角之後畫（王冠）。中心 (x, y)＝主角身體中心 */
const CROWN = [
  ".G....G....G.", ".GH...GH...GH", ".GHG.GHHG.GHI", ".GHHGHHHHGHHI", ".GrHHHbHHHrHI", "..GHHHHHHHHI.", "..IJJJJJJJJI.",
];
const J = P("#6e3a0c");
export function drawKingBack(frame, x, y, t) {
  for (let k = 0; k < 8; k++) {
    const a = t * 0.6 + (k * Math.PI) / 4, len = k % 2 ? 16 : 22, nx = -Math.sin(a), ny = Math.cos(a);
    for (let r = 8; r < len; r++) {
      const f = (r - 8) / (len - 8), c = f < 0.3 ? GOLD[3] : f < 0.65 ? GOLD[2] : GOLD[1];
      put(frame, x + Math.cos(a) * r, y + Math.sin(a) * r, c, f < 0.5);
      if (f < 0.4) put(frame, x + Math.cos(a) * r + nx, y + Math.sin(a) * r + ny, GOLD[2]);
    }
  }
  for (let k = 0; k < 5; k++) {
    const p = (t * 0.7 + k / 5) % 1, sx = x - 12 + ((k * 7) % 24) + Math.sin(p * 6 + k) * 2, sy = y + 12 - p * 34;
    put(frame, sx, sy, p < 0.5 ? GOLD[5] : GOLD[3], 1);
  }
}
export function drawKingFront(frame, x, y, t) {
  const cy = Math.round(y - 28 + Math.sin(t * 3)), cx = x - 6;
  const C = { G: GOLD[2], H: GOLD[3], I: GOLD[1], J, r: P("#ff4a5a"), b: P("#5ab8ff") };   // 第 3 輪：深一階，不然太淡
  const at = (i, j) => CROWN[j]?.[i] && CROWN[j][i] !== ".";
  for (let j = -1; j <= CROWN.length; j++) for (let i = -1; i <= 13; i++) if (!at(i, j) && (at(i + 1, j) || at(i - 1, j) || at(i, j + 1) || at(i, j - 1))) put(frame, cx + i, cy + j, J);
  CROWN.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== ".") put(frame, cx + i, cy + j, C[ch], ch === "r" || ch === "b"); }));
}
