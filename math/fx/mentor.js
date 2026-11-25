// 五位學系導師（NPC，地圖上站在自己學院門口）：個性跟該屬性的思考方式一樣（世界觀 5）。
//   火・焰燈老師：急性子、講話很快——刺刺的紅髮、額頭綁火焰頭巾、袖子捲起來
//   水・汐流老師：溫和、會換角度想——長長的波浪藍髮、貝殼髮夾、拿著水瓶
//   冰・霜一老師：一個字一個字慢慢講——又高又瘦、圓眼鏡、白色尖帽、手拿筆記本
//   森・苗苗老師：什麼都要畫出來——矮矮圓圓、頭上一頂葉子帽、抱著畫冊
//   雷・雷鳴老師：一直問「為什麼」——白髮全部炸起來、額頭上一副護目鏡、手上一根小閃電
// 動作：idle＝呼吸、眨眼；talk＝嘴巴一張一合、手上的東西晃一下。面向鏡頭。
// NPC 16 色以內。
//
// mentorFrame(id, pose, t) → { w, h, ox, oy, px, colors }（原點＝腳底中央）

import { Grid } from "./_grid.js";

export const W = 40, H = 60, OX = 20, OY = 58;
const SKIN = { skin: "#ffd9b8", skinS: "#e8a98a", eye: "#2a2248", white: "#ffffff", cheek: "#ff9a9a", shoe: "#4a3226" };
export const MENTORS = {
  fire: { name: "焰燈老師", robe: "#c8422e", robeS: "#8a2a24", robeL: "#ee7040", trim: "#ffd35c", hair: "#ff8a3a", hairS: "#c4512a", extra: "#ffe27a", h: 0 },
  water: { name: "汐流老師", robe: "#2f6fc0", robeS: "#1f4a8a", robeL: "#5aa0e8", trim: "#e8f4ff", hair: "#4a8ad8", hairS: "#2a5aa0", extra: "#ffc2d4", h: 0 },
  ice: { name: "霜一老師", robe: "#dfe8f4", robeS: "#a8b8d4", robeL: "#ffffff", trim: "#7cc0f0", hair: "#8a92a8", hairS: "#5a6278", extra: "#3a6aa8", h: 4 },
  forest: { name: "苗苗老師", robe: "#4a9a4a", robeS: "#2e6a34", robeL: "#7cc860", trim: "#f2d58a", hair: "#8a5a3a", hairS: "#5a3a26", extra: "#e8d4b0", h: -5 },
  thunder: { name: "雷鳴老師", robe: "#6a4ab8", robeS: "#43307e", robeL: "#9a7ae8", trim: "#ffd35c", hair: "#f4f0ff", hairS: "#bdb6d8", extra: "#6ad0ff", h: 1 },
};

function poseOf(pose, t) {
  if (pose === "talk") { const n = Math.floor(t * 8) % 2; return { b: 0, mouth: n, blink: false, wave: n }; }
  const ph = (t % 2) / 2;
  return { b: ph < 0.5 ? 0 : 1, mouth: 0, blink: ph > 0.92, wave: 0 };
}

export function mentorFrame(id, pose = "idle", t = 0) {
  const M = MENTORS[id], q = poseOf(pose, t), g = new Grid(W, H, OX, OY);
  const P = { ...SKIN, ...M };
  const tall = M.h, Y = -q.b, wide = id === "forest" ? 2 : id === "ice" ? -1 : 0;
  const top = -24 - tall + Y;                      // 袍子上緣
  // 長頭髮（水）畫在最後面
  // 長長的波浪髮：頭的兩側往下垂，到胸口左右捲起來
  if (id === "water") for (const sd of [-1, 1]) {
    g.ellipse(sd * 6.5, top - 6, 2.6, 4, (nx, ny) => (nx * sd > 0.2 ? P.hairS : P.hair));
    g.ellipse(sd * 7.5, top, 2.4, 3.6, (nx, ny) => (nx * sd > 0.1 ? P.hairS : P.hair));
    g.ellipse(sd * 6.5, top + 5, 2, 2.4, (nx, ny) => (ny > 0.2 ? P.hairS : P.hair));
  }
  // 鞋子、袍子
  g.rect(-6, -2, 5, 2, P.shoe); g.rect(1, -2, 5, 2, P.shoe);
  g.poly([[-7 - wide, top], [7 + wide, top], [10 + wide, -2], [-10 - wide, -2]], (x, y) => (x > 5 + wide + (y - top) * 0.1 ? P.robeS : x < -5 - wide - (y - top) * 0.08 ? P.robeL : P.robe));
  g.rect(-10 - wide, -4, 20 + wide * 2, 2, P.trim);                  // 下襬滾邊
  g.line(0, top + 3, 0, -5, P.robeS);                                  // 前襟
  g.rect(-3, top, 6, 2, P.trim);                                        // 領口
  // 手和手上的東西
  const hy = top + 10, sw = q.wave;
  g.line(-6 - wide, top + 2, -9 - wide, hy, P.robeL); g.line(-5 - wide, top + 3, -8 - wide, hy, P.robe);
  g.line(6 + wide, top + 2, 9 + wide, hy - sw, P.robe); g.line(5 + wide, top + 3, 8 + wide, hy - sw, P.robeS);
  g.rect(-10 - wide, hy, 3, 2, P.skin); g.rect(8 + wide, hy - sw, 3, 2, P.skin);
  if (id === "fire") { g.rect(-11 - wide, top + 4, 4, 2, P.trim); g.rect(7 + wide, top + 4, 4, 2, P.trim); }   // 捲起來的袖口
  if (id === "water") { g.ellipse(11 + wide, hy - 3 - sw, 2.5, 3, (nx, ny) => (ny < -0.3 ? P.trim : nx < 0 ? P.robeL : P.robe)); g.set(11 + wide, hy - 7 - sw, P.trim); }   // 水瓶
  if (id === "ice") { g.rect(8 + wide, hy - 6 - sw, 5, 6, P.extra); g.rect(9 + wide, hy - 5 - sw, 3, 4, P.robeL); }                 // 筆記本
  if (id === "forest") { g.rect(-4, hy - 4, 9, 7, P.extra); g.rect(-3, hy - 3, 7, 5, P.white); g.set(-1, hy - 1, P.robe); g.set(1, hy - 2, P.hair); g.set(2, hy, P.robeL); }  // 抱著畫冊
  if (id === "thunder") { const bx = 11 + wide, by = hy - 8 - sw; g.line(bx, by, bx - 2, by + 3, P.trim); g.line(bx - 2, by + 3, bx + 1, by + 3, P.trim); g.line(bx + 1, by + 3, bx - 1, by + 7, P.trim); }   // 小閃電
  // 頭
  const cy = top - 7;
  g.ellipse(0, cy, 6, 5.8, (nx, ny) => (nx > 0.62 || ny > 0.72 ? P.skinS : P.skin));
  // 臉
  if (q.blink) { g.rect(-3, cy + 1, 2, 1, P.eye); g.rect(1, cy + 1, 2, 1, P.eye); }
  else { g.rect(-3, cy - 0.5, 2, 2, P.eye); g.rect(1, cy - 0.5, 2, 2, P.eye); g.set(-3, cy - 0.5, P.white); g.set(1, cy - 0.5, P.white); }
  g.set(-5, cy + 2, P.cheek); g.set(4, cy + 2, P.cheek);
  if (q.mouth) g.rect(-1, cy + 3, 2, 2, P.skinS); else g.rect(-1, cy + 3, 2, 1, P.skinS);
  // 髮型＋帽子＋配件
  if (id === "fire") {
    // 刺刺的頭髮往上衝，額頭綁火焰頭巾
    for (let i = -6; i <= 6; i += 3) g.poly([[i - 2, cy - 4], [i + 2, cy - 4], [i + 1 + (i > 0 ? 1 : -1), cy - 11 + Math.abs(i) * 0.4]], (x, y) => (y < cy - 8 ? P.hair : P.hairS));
    g.poly([[-6.5, cy - 2], [-6, cy - 6], [6, cy - 6], [6.5, cy - 2]], P.hair);
    g.rect(-6, cy - 4, 13, 2, P.trim); g.set(-7, cy - 3, P.trim); g.set(-8, cy - 2, P.extra); g.set(-8, cy - 4, P.extra);
  } else if (id === "water") {
    g.poly([[-6.5, cy], [-6, cy - 6], [6, cy - 6], [6.5, cy], [3, cy - 3], [0, cy - 2], [-3, cy - 3]], (x, y) => (x < 0 && y < cy - 4 ? P.hair : P.hairS));
    g.ellipse(5, cy - 4, 1.6, 1.6, P.extra);                                                          // 貝殼髮夾
  } else if (id === "ice") {
    g.poly([[-6, cy - 1], [-6, cy - 5], [6, cy - 5], [6, cy - 1], [3, cy - 3], [-3, cy - 3]], P.hair);
    for (const ex of [-2, 2]) { g.set(ex - 1.5, cy - 1, P.extra); g.set(ex + 1.5, cy - 1, P.extra); g.set(ex - 1.5, cy + 1, P.extra); g.set(ex + 1.5, cy + 1, P.extra); }   // 圓眼鏡
    g.ellipse(0, cy - 6, 8, 1.6, (nx, ny) => (ny > 0.2 ? P.robeS : P.robe));
    g.poly([[-5, cy - 6], [5, cy - 6], [1, cy - 18], [-1, cy - 18]], (x) => (x < -1 ? P.robeL : x > 1 ? P.robeS : P.robe));
    g.rect(-5, cy - 8, 10, 2, P.trim); g.set(0, cy - 19, P.trim);
  } else if (id === "forest") {
    g.poly([[-6.5, cy + 1], [-6, cy - 5], [6, cy - 5], [6.5, cy + 1], [3, cy - 2], [-3, cy - 2]], (x, y) => (y < cy - 3 ? P.hair : P.hairS));
    // 葉子帽：兩片大葉子＋一根小芽
    g.oval(-4, cy - 7, 5, 2.4, -0.35, (u, v) => (v < 0 ? P.robeL : P.robe));
    g.oval(4, cy - 7, 5, 2.4, 0.35, (u, v) => (v < 0 ? P.robeL : P.robeS));
    g.line(0, cy - 8, 1, cy - 12, P.robeS); g.ellipse(2, cy - 12, 1.4, 1, P.robeL);
  } else if (id === "thunder") {
    // 白髮全部炸開
    // 一團一團炸開的白髮（像被電到）
    const spikes = [[-10, -3], [-9, -8], [-5, -11], [0, -12], [5, -11], [9, -8], [10, -3]];
    const pts = [[-7, cy]]; spikes.forEach(([dx, dy], i) => { pts.push([dx, cy + dy]); if (i < spikes.length - 1) pts.push([(dx + spikes[i + 1][0]) / 2 * 0.6, cy + (dy + spikes[i + 1][1]) / 2 * 0.55]); }); pts.push([7, cy]);
    g.poly(pts, (x, y) => (x > 2 && y > cy - 6 ? P.hairS : P.hair));
    g.rect(-6, cy - 5, 12, 3, P.robeS); g.ellipse(-3, cy - 4, 2, 1.4, P.extra); g.ellipse(3, cy - 4, 2, 1.4, P.extra);   // 護目鏡
  }
  g.outline();
  return g.pixels();
}
