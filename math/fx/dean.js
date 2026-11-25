// 圓周院長（NPC）：又圓又矮的老魔數師。整個人是「圓」——圓滾滾的身體、圓眼鏡、圓帽頂、杖頭一個金環。
// 長長的白鬍子，講話停不下來（「三點一四一五九……」）。面向鏡頭（地圖上站在廣場）。
// 動作：idle＝慢慢呼吸、鬍子尖晃、偶爾眨眼；talk＝鬍子一上一下（嘴在鬍子裡動）、杖頭金環亮一下。
// NPC 16 色以內。
//
// deanFrame(pose, t) → { w, h, ox, oy, px, colors }（原點＝腳底中央）

import { Grid } from "./_grid.js";

export const W = 40, H = 52, OX = 20, OY = 50;
const C = {
  robe: "#3b3f8f", robeS: "#262a63", robeL: "#5a5fb8",
  gold: "#ffd35c", goldS: "#b9822e",
  beard: "#f4f0ff", beardS: "#bdb6d8",
  skin: "#ffd9b8", skinS: "#e8a98a", cheek: "#ff9a9a",
  eye: "#2a2248", glass: "#cfe8ff", wood: "#8a5a3a", shoe: "#4a3226",
};

function poseOf(pose, t) {
  if (pose === "talk") { const n = Math.floor(t * 8) % 2; return { breath: 0, wag: n, blink: false, talk: true }; }
  const ph = (t % 2) / 2;
  return { breath: ph < 0.5 ? 0 : 1, wag: Math.round(Math.sin(ph * Math.PI * 2)), blink: ph > 0.9, talk: false };
}

export function deanFrame(pose = "idle", t = 0) {
  const q = poseOf(pose, t), g = new Grid(W, H, OX, OY);
  const Y = -q.breath;
  // 鞋子
  g.rect(-7, -2, 5, 2, C.shoe); g.rect(2, -2, 5, 2, C.shoe);
  // 圓滾滾的身體（袍子）：大圓，左上亮、右下暗
  g.ellipse(0, -11 + Y * 0.5, 11, 10 - Y * 0.5, (nx, ny) => {
    const d = -0.6 * nx - 0.7 * ny;
    return d > 0.45 ? C.robeL : d > -0.35 ? C.robe : C.robeS;
  });
  // 袍子上的金色圓圈滾邊（下襬一圈）＋胸前一個圓徽章
  for (let x = -9; x <= 9; x++) { const y = Math.round(-2.5 - Math.sqrt(Math.max(0, 1 - (x / 10.5) ** 2)) * 1.5); g.set(x, y, x < -3 ? C.gold : C.goldS); }
  // 杖（左手拿，杖頭一個金環）
  const sx = -13;
  g.rect(sx, -30 + Y, 1, 29, C.wood); g.rect(sx + 1, -30 + Y, 1, 29, C.goldS);
  g.ellipse(sx + 0.5, -33 + Y, 3, 3, (nx, ny) => (nx * nx + ny * ny < 0.25 ? null : nx + ny < 0 ? C.gold : C.goldS));
  if (q.talk) g.set(sx - 1, -35 + Y, C.beard);
  // 兩隻手：左手握杖、右手在肚子上
  g.ellipse(sx + 1.5, -13 + Y, 2, 2, (nx) => (nx < 0 ? C.skin : C.skinS));
  g.ellipse(6, -12 + Y, 2, 1.8, (nx) => (nx < 0 ? C.skin : C.skinS));
  // 頭
  const cy = -25 + Y;
  g.ellipse(0, cy, 6.5, 6, (nx, ny) => (nx > 0.6 || ny > 0.7 ? C.skinS : C.skin));
  // 鬍子：從臉頰往下垂成一個水滴形，尖端左右晃（講話時一上一下）
  const by = cy + 3 + (q.talk ? q.wag : 0), tip = q.talk ? 0 : q.wag;
  g.poly([[-6, cy + 1], [6, cy + 1], [5, by + 6], [2 + tip, by + 11], [tip, by + 13], [-2 + tip, by + 11], [-5, by + 6]],
    (x, y) => (x > 2 + (y - cy) * 0.1 ? C.beardS : C.beard));
  g.line(-1, by + 4, tip, by + 10, C.beardS);          // 鬍子中間一道
  g.rect(-4, cy + 1, 3, 2, C.beard); g.rect(1, cy + 1, 3, 2, C.beard);   // 八字鬍
  if (q.talk) g.rect(-1, cy + 3 + q.wag, 2, 1, C.skinS);  // 嘴在鬍子裡動
  // 鼻子、臉頰
  g.rect(-1, cy, 2, 2, C.skinS); g.set(-1, cy, C.skin);
  g.set(-5, cy + 1, C.cheek); g.set(5, cy + 1, C.cheek);
  // 圓眼鏡
  for (const ex of [-3, 3]) {
    g.ellipse(ex, cy - 2, 2.2, 2.2, (nx, ny) => (nx * nx + ny * ny > 0.45 ? C.goldS : C.glass));
    if (q.blink) g.rect(ex - 1, cy - 2, 2, 1, C.eye); else { g.rect(ex - 0.5, cy - 2.5, 1, 2, C.eye); }
  }
  g.set(-4, cy - 3, "#ffffff");                         // 鏡片反光
  // 眉毛（白、長長的往外垂）
  g.line(-6, cy - 5, -2, cy - 5, C.beard); g.line(2, cy - 5, 6, cy - 5, C.beard); g.set(-7, cy - 4, C.beard); g.set(7, cy - 4, C.beardS);
  // 帽子：矮矮的圓頂帽，頂上一顆金球；帽帶金色
  const hy = cy - 7;
  g.ellipse(0, hy, 9, 1.8, (nx, ny) => (ny > 0.2 ? C.robeS : nx < -0.4 ? C.robeL : C.robe));
  g.ellipse(0, hy - 3, 6.5, 4.5, (nx, ny) => (ny > 0.75 ? null : -0.6 * nx - 0.7 * ny > 0.3 ? C.robeL : nx > 0.5 ? C.robeS : C.robe));
  g.rect(-6, hy - 2, 12, 2, C.gold); g.rect(2, hy - 2, 4, 2, C.goldS);
  g.ellipse(0, hy - 8.5, 1.6, 1.6, (nx, ny) => (nx + ny < 0 ? C.gold : C.goldS));
  g.outline();
  return g.pixels();
}
