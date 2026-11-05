// 系統的形象（使用者 2026-11-05 選定草稿 B「星盤水晶」；同日第二版照 pixelfx ice/ice-crystal 改成六角柱水晶）：一顆漂浮的青色菱形水晶，中間一塊暗的螢幕臉，
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
  // 第二版（照 pixelfx ice/ice-crystal）：六角柱水晶，上下兩端尖；正面看到三個面——左面亮、中面中、右面暗，
  // 頭尾的斜面比柱身亮一階（左上光），面和面之間有一條亮的稜線；1/4 的時候光掃過中面（跟著 f 轉）
  // 第 2 輪：瘦高一點（第 1 輪像一個六角盒子），下端拉長；面的明暗拉開
  const halfW = (y) => (y < -6 ? Math.round(7 * (14 + y) / 8) : y > 5 ? Math.round(7 * (15 - y) / 10) : 7);
  const sweep = ((f + 2) % 8) / 8;   // 掃過去的光（每 8 格一次）
  for (let y = -14; y <= 15; y++) {
    const hw = halfW(y);
    if (hw < 0) continue;
    for (let x = -hw; x <= hw; x++) {
      const u = (x + hw + 0.5) / (2 * hw + 1);   // 0 左～1 右
      const face = u < 0.3 ? 0 : u < 0.7 ? 1 : 2, cap = y < -6 ? -1 : y > 5 ? 1 : 0;
      let c = ["L", "M", "D"][face];
      if (cap < 0) c = face === 2 ? "M" : "G";          // 上面的斜面朝光，亮
      if (cap > 0) c = face === 0 ? "M" : "D";          // 下面的斜面背光，暗
      if (face === 0 && cap === 0) c = "G";                // 左面最亮（第 2 輪：拉開明暗）
      if (face === 1 && Math.abs(u - 0.3) < 0.08) c = "W";  // 左稜線：一條白線
      if (face === 1 && cap === 0 && Math.abs((y + 13) / 26 - sweep) < 0.06) c = "G";   // 光掃過中面
      set(cx + x, cy + y, c);
    }
  }
  for (let y = -4; y <= 4; y++) for (let x = -5; x <= 5; x++) if (Math.abs(x) + Math.max(0, Math.abs(y) - 2) * 1.5 <= 5.5) set(cx + x, cy + y, "S");
  FACES[expr].forEach((r, j) => [...r].forEach((ch, i) => ch === "#" && set(cx - 3 + i, cy - 1 + j, "W")));
  if (expr === "smug") { set(cx - 6, cy + 3, "P"); set(cx + 6, cy + 3, "P"); }
  set(cx - 5, cy - 8, "W"); set(cx - 4, cy - 9, "W"); set(cx - 5, cy - 9, "W");   // 左上反光（一小塊）
  // 身邊繞著三顆霜屑（pixelfx 冰晶的做法），照 f 轉位置
  for (let k = 0; k < 3; k++) { const a = phase * 1.5 + k * 2.1, x = Math.round(cx + Math.cos(a) * 13), y = Math.round(cy - 4 + Math.sin(a) * 9); if (!get(x, y)) set(x, y, k === 0 ? "W" : "G"); }
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
