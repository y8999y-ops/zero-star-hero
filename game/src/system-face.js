// 系統的形象（使用者 2026-11-05 選定草稿 B「星盤水晶」）：一顆漂浮的青色菱形水晶，中間一塊暗的螢幕臉，
// 外面繞一圈軌道環。環上有一段亮光在繞（前半圈蓋在水晶前面、後半圈在後面），水晶輕輕上下飄。
// 表情：normal 平常、smug 得意（臉頰泛紅、瞇眼）、wow 吃驚、blink 眨眼。草稿：game/tools/drafts/system-persona.mjs
const S = 40;
const PAL = { O: "#06202e", D: "#14587a", M: "#2a9cc4", L: "#7ae8ff", W: "#e6ffff", S: "#081824", P: "#ff7ad8", G: "#c8fbff" };
const FACES = {
  normal: ["#....#", "#....#", "......", ".####."],
  smug: ["##..##", "......", "......", "..###."],
  wow: ["##..##", "##..##", "......", "..##..", "..##.."],
  blink: ["......", "##..##", "......", ".####."],
};
export const FRAMES = 8;

function drawCrystal(expr, f) {
  const grid = Array.from({ length: S }, () => new Array(S).fill(null));
  const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < S && y < S) grid[y][x] = c; };
  const get = (x, y) => (x >= 0 && y >= 0 && x < S && y < S ? grid[y][x] : null);
  const bob = [0, 0, -1, -1, -1, 0, 0, 0][f % 8];          // 慢慢上下飄（停在上面久一點）
  const cx = 20, cy = 18 + bob, phase = (f / FRAMES) * Math.PI * 2;
  const ring = (front) => {
    for (let a = 0; a < 360; a += 3) {
      const r = (a * Math.PI) / 180, isFront = Math.sin(r) > 0;
      if (isFront !== front) continue;
      const x = Math.round(cx + Math.cos(r) * 17), y = Math.round(cy + 6 + Math.sin(r) * 4);
      // 繞圈的亮光：離 phase 越近越亮
      let d = Math.abs(((r - phase + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      set(x, y, d < 0.35 ? "W" : d < 0.8 ? "G" : front ? "L" : "D");
    }
  };
  ring(false);
  for (let y = -13; y <= 13; y++) for (let x = -10; x <= 10; x++) {
    if (Math.abs(x) / 10 + Math.abs(y) / 13 > 1) continue;
    set(cx + x, cy + y, x < 0 ? (y < 0 ? "L" : "M") : y < 0 ? "M" : "D");
  }
  for (let y = -4; y <= 4; y++) for (let x = -6; x <= 6; x++) if ((x / 6.5) ** 2 + (y / 4.5) ** 2 <= 1) set(cx + x, cy + y, "S");
  FACES[expr].forEach((r, j) => [...r].forEach((ch, i) => ch === "#" && set(cx - 3 + i, cy - 1 + j, "W")));
  if (expr === "smug") { set(cx - 6, cy + 3, "P"); set(cx + 6, cy + 3, "P"); }
  set(cx - 4, cy - 8, "W"); set(cx - 3, cy - 9, "W");      // 左上反光
  ring(true);
  // 1px 外框
  const add = [];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (!get(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => get(x + a, y + b) && get(x + a, y + b) !== "O")) add.push([x, y]);
  for (const [x, y] of add) set(x, y, "O");
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const g = cv.getContext("2d");
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (grid[y][x]) { g.fillStyle = PAL[grid[y][x]]; g.fillRect(x, y, 1, 1); }
  return cv;
}
const cache = new Map();
/** 第 f 格的系統（canvas 40×40） */
export function systemFace(expr = "normal", f = 0) {
  const k = expr + f;
  if (!cache.has(k)) cache.set(k, drawCrystal(expr, f));
  return cache.get(k);
}
/** 從台詞猜表情：驚嘆／問號＝吃驚；「哼」「……」「我設計的」「開玩笑」「大概」＝得意；其他＝平常 */
export function moodOf(text) {
  if (/哼|我設計的|開玩笑|大概|算了|還算|厲害/.test(text)) return "smug";
  if (/[！？!?]/.test(text)) return "wow";
  return "normal";
}
/** 在 canvas 元素上播放系統動畫（每 150ms 一格，第 6 格眨眼）。回傳 stop()。 */
export function playFace(cv, expr) {
  let f = 0;
  const g = cv.getContext("2d");
  cv.width = cv.height = S;
  const draw = () => {
    g.clearRect(0, 0, S, S);
    g.drawImage(systemFace(expr === "normal" && f === 6 ? "blink" : expr, f), 0, 0);
    f = (f + 1) % FRAMES;
  };
  draw();
  const id = setInterval(draw, 150);
  return () => clearInterval(id);
}
export const FACE_SIZE = S;
