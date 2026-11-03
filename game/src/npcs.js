// 碎星鎮的居民（M6）：公會櫃檯史萊姆「波波」、工坊老闆石頭魔像「岩叔」、旅館老闆娘大蘑菇「菇媽」。
// 造型＝ docs/城鎮草稿-NPC.png（使用者 2026-11-04 確認）。遵守規則v2：1px 外框、硬邊、光從左上、精簡色盤。
// 待機 8 格，每個只做一個主要動作（規則v2 第五章）：
//   波波：鏡片上的反光從左掃到右，第 6 格眨眼（身體不動，史萊姆很冷靜）
//   岩叔：胸口的熔爐核心一明一暗（像在呼吸的爐火），眼睛的光跟著變
//   菇媽：頭頂兩顆小蘑菇輕輕晃，第二顆慢一格（跟隨與延遲）
import { hex } from "../../pixelfx/src/core/index.js";

const C = (s) => hex(s) >>> 0;
const OUT = "#2a1626";

// 材質格子 → 上色（左上亮、右下暗）→ 外框。回傳 { px: 顏色（ABGR 數字）的二維陣列, W, H }
function sprite(W, H, paint, ramps, fixed = {}) {
  const m = Array.from({ length: H }, () => Array(W).fill(null));
  const set = (x, y, v) => { if (x >= 0 && y >= 0 && x < W && y < H) m[y][x] = v; };
  paint(set);
  const empty = (x, y) => x < 0 || y < 0 || x >= W || y >= H || !m[y][x];
  const diff = (x, y, k) => empty(x, y) || m[y][x] !== k;
  const px = Array.from({ length: H + 2 }, () => Array(W + 2).fill(0));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = m[y][x];
    if (!k) continue;
    if (fixed[k]) { px[y + 1][x + 1] = C(fixed[k]); continue; }
    const R = ramps[k];
    let t = 2;
    if (diff(x - 1, y, k) || diff(x, y - 1, k)) t = 3;
    else if (diff(x + 1, y, k) || diff(x, y + 1, k)) t = 1;
    if (t === 2 && (diff(x + 2, y, k) || diff(x, y + 2, k))) t = 1;
    if (t === 3 && diff(x - 1, y - 1, k) && diff(x - 1, y, k) && diff(x, y - 1, k)) t = 4;
    px[y + 1][x + 1] = C(R[Math.min(R.length - 1, t)]);
  }
  const o = C(OUT);
  for (let y = 0; y < H + 2; y++) for (let x = 0; x < W + 2; x++) {
    if (px[y][x]) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => px[y + b]?.[x + a] && px[y + b][x + a] !== o)) px[y][x] = o;
  }
  return { px, W: W + 2, H: H + 2 };
}
const halfRows = (widths, cx, set, v, dy = 0) => widths.forEach((w, y) => { for (let x = cx - w + 1; x <= cx + w - 1; x++) set(x, y + dy, v); });

function slimeClerk(f) {
  const W = 31, H = 25, cx = 15, glint = [0, 0, 1, 2, 3, 4, 0, 0][f], blink = f === 6;
  return sprite(W, H, (set) => {
    halfRows([5, 8, 10, 11, 12, 13, 13, 14, 14, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 16, 16], cx, set, "B");
    for (const ex of [cx - 5, cx + 5]) {
      for (const [dx, dy] of [[-1, -2], [0, -2], [1, -2], [-2, -1], [2, -1], [-2, 0], [2, 0], [-2, 1], [2, 1], [-1, 2], [0, 2], [1, 2]]) set(ex + dx, 10 + dy, "F");
      for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) set(ex + dx, 10 + dy, "L");
      if (!blink) set(ex, 10, "E");
      // 鏡片反光：左上 → 右下掃過去
      const g = [[-1, -1], [-1, -1], [0, -1], [0, 0], [1, 0], [1, 1]][glint];
      set(ex + g[0], 10 + g[1], "W");
    }
    for (let x = cx - 2; x <= cx + 2; x++) set(x, 9, "F");
    set(cx - 1, 15, "E"); set(cx, 16, "E"); set(cx + 1, 15, "E");
    for (const [x0, x1, y] of [[cx - 1, cx + 1, 18], [cx, cx, 19], [cx - 1, cx + 1, 20], [cx - 1, cx + 1, 21], [cx - 1, cx + 1, 22]]) for (let x = x0; x <= x1; x++) set(x, y, "T");
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) set(cx - 8 + dx, 18 + dy, "G");
    for (const [x, y] of [[cx - 9, 4], [cx - 10, 5], [cx - 10, 6], [cx + 9, 16]]) set(x, y, "W");
  }, { B: ["#173064", "#244c96", "#3474c8", "#5aa2ec", "#9ad0ff"], T: ["#6a1424", "#a02234", "#d03a44", "#ff6a60", "#ff9a8a"], G: ["#6e3c10", "#c07c18", "#ffc83a", "#fff2a8", "#fff2a8"] },
  { F: "#2a2440", L: "#c8ecff", E: "#1a1030", W: "#ffffff" });
}

const CORE = [["#7a2e10", "#d0601c", "#ffa040", "#ffd27a", "#fff2a8"], ["#8a3410", "#e0701c", "#ffb050", "#ffe08a", "#fff6c0"], ["#9a3c12", "#f0802a", "#ffc070", "#fff0a8", "#ffffff"]];
function golem(f) {
  const W = 34, H = 36, glow = [0, 1, 2, 2, 1, 0, 0, 0][f];
  return sprite(W, H, (set) => {
    const box = (x0, y0, x1, y1, v, cut = 1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (!((x - x0 < cut || x1 - x < cut) && (y - y0 < cut || y1 - y < cut))) set(x, y, v); };
    box(12, 1, 21, 8, "S");
    box(5, 8, 28, 22, "S", 2);
    box(8, 23, 25, 27, "S");
    box(9, 28, 14, 34, "S"); box(19, 28, 24, 34, "S");
    box(0, 13, 6, 27, "S"); box(27, 13, 33, 27, "S");
    box(0, 26, 7, 33, "S"); box(26, 26, 33, 33, "S");
    for (let y = 19; y <= 27; y++) for (let x = 10; x <= 23; x++) if (y > 19 || (x > 11 && x < 22)) set(x, y, "A");
    for (const [x0, x1, y] of [[14, 19, 13], [13, 20, 14], [13, 20, 15], [14, 19, 16]]) for (let x = x0; x <= x1; x++) set(x, y, "C");
    set(15, 14, "Y"); set(16, 14, "Y"); set(15, 15, "Y");
    for (const [x, y] of [[6, 8], [7, 8], [8, 8], [5, 9], [6, 9], [26, 8], [27, 8], [28, 9], [25, 8]]) set(x, y, "M");
    for (const x of [14, 15, 18, 19]) set(x, 4, glow ? "Y" : "Z");
    for (const [x, y] of [[10, 11], [11, 12], [22, 17], [23, 18], [3, 20], [30, 22]]) set(x, y, "D");
  }, { S: ["#3a3240", "#5a4e5e", "#7e7080", "#a89aa4", "#d0c6c8"], A: ["#3e2414", "#6e4224", "#b07240", "#e8b478", "#e8b478"], C: CORE[glow], M: ["#1e5a34", "#3a9a48", "#3a9a48", "#8ae070", "#8ae070"] },
  { Y: "#ffd84a", Z: "#c89a2a", D: "#3a3240" });
}

function mushroom(f) {
  const W = 31, H = 33, cx = 15, s1 = [0, 0, 1, 1, 1, 0, 0, 0][f], s2 = [0, 0, 0, 1, 1, 1, 0, 0][f];   // 第二顆慢一格
  return sprite(W, H, (set) => {
    for (const [x0, y0, s] of [[9, 1, s1], [19, 2, s2]]) {
      for (let x = x0 + 1; x < x0 + 3; x++) set(x + s, y0 - 1, "R");
      for (let x = x0; x < x0 + 4; x++) set(x + s, y0, "R");
      for (const [dx, dy] of [[1, 1], [2, 1], [1, 2], [2, 2]]) set(x0 + dx + s, y0 + dy, "Y");   // 柄跟著蓋子一起晃
    }
    halfRows([6, 9, 11, 13, 14, 15, 15, 16, 16, 16], cx, set, "R", 4);
    for (let x = cx - 14; x <= cx + 14; x++) set(x, 14, "U");
    for (const [x, y] of [[cx - 7, 7], [cx - 6, 7], [cx - 7, 8], [cx + 4, 6], [cx + 5, 6], [cx + 9, 10], [cx + 10, 10], [cx - 11, 11], [cx - 1, 9], [cx, 9]]) set(x, y, "P");
    halfRows([7, 8, 8, 8, 8, 8, 8, 9, 9, 9, 9, 9, 9, 10, 10, 10], cx, set, "Y", 15);
    set(cx - 3, 18, "E"); set(cx - 3, 19, "E"); set(cx + 3, 18, "E"); set(cx + 3, 19, "E");
    set(cx - 5, 20, "K"); set(cx + 5, 20, "K");
    set(cx - 1, 21, "E"); set(cx, 22, "E"); set(cx + 1, 21, "E");
    for (let y = 24; y <= 30; y++) for (let x = cx - 6; x <= cx + 6; x++) if (y > 24 || Math.abs(x - cx) < 5) set(x, y, "A");
    for (let x = cx - 2; x <= cx + 2; x++) set(x, 27, "B");
    for (let y = 22; y <= 25; y++) for (let x = cx + 10; x <= cx + 13; x++) set(x, y, "M");
    set(cx + 14, 23, "M"); set(cx + 14, 24, "M");
    for (let y = 31; y <= 32; y++) for (const x0 of [cx - 7, cx + 3]) for (let x = x0; x < x0 + 5; x++) set(x, y, "F");
  }, { R: ["#6a1424", "#a02234", "#d03a44", "#ff6a50", "#ff9a8a"], Y: ["#8a7a5a", "#c8b890", "#f4ecd0", "#fffaf0", "#fffaf0"], A: ["#8a90a8", "#c8ccdc", "#eef0f8", "#ffffff", "#ffffff"], M: ["#6e4224", "#b07240", "#e8b478", "#f4d4a0", "#f4d4a0"], F: ["#3e2414", "#6e4224", "#8e5a34", "#b07240", "#b07240"] },
  { P: "#f4ecd0", U: "#8a5a5a", E: "#2a1626", K: "#ff9a8a", B: "#c8ccdc" });
}

const BUILD = { clerk: slimeClerk, golem, mushroom };
const cache = {};
/** 某個居民第 f 格（0～7）的像素 */
export function npcFrame(id, f) {
  const k = id + f;
  return (cache[k] ??= BUILD[id](f));
}
/** 畫到 frame：x 是腳底中間、y 是腳底（世界座標），flip 面朝左 */
export function paintNpc(frame, id, f, x, y, flip = false) {
  const s = npcFrame(id, f), Wf = frame.w, Hf = frame.h, Cc = frame.color;
  const ox = Math.round(x) - (frame.ox | 0) - (s.W >> 1), oy = Math.round(y) - (frame.oy | 0) - s.H + 1;
  for (let j = 0; j < s.H; j++) {
    const py = oy + j;
    if (py < 0 || py >= Hf) continue;
    for (let i = 0; i < s.W; i++) {
      const c = s.px[j][flip ? s.W - 1 - i : i];
      if (!c) continue;
      const px = ox + i;
      if (px >= 0 && px < Wf) Cc[py * Wf + px] = c;
    }
  }
}
export const npcSize = (id) => { const s = npcFrame(id, 0); return [s.W, s.H]; };
