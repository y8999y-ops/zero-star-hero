// 歪瓣花（星芽花園的墨水怪）：被墨水染到的花，「瓣數不對」——正下方少一瓣、兩瓣被墨水染黑還在滴、兩瓣歪掉。
// 花心是臉（看向左邊的玩家），下面一根莖、兩片葉子，用兩隻小根腳搖搖擺擺地走。
// 動作：idle＝走路（莖左右晃、花瓣慢半拍、根腳交替）；hurt＝花瓣垂下、＞＜眼。
// 雜兵 12 色以內。
//
// crookedFlowerFrame(pose, t) → { w, h, ox, oy, px, colors }（原點＝腳底中央）

import { Grid } from "./_grid.js";

export const W = 44, H = 52, OX = 22, OY = 48;
const C = {
  pinkL: "#ffc2d4", pink: "#f27fa3", pinkD: "#b8456f",
  ink1: "#1c1533", ink2: "#2d2350", ink3: "#55479a",
  face: "#ffe27a", faceD: "#d7a43b", white: "#ffffff",
  leaf: "#6fbf4a", leafD: "#3d7a35",
};

function poseOf(pose, t) {
  const D = 1.2, ph = (t % D) / D;
  if (pose === "hurt") return { sway: -2, step: 0, droop: 1, hurt: true, ph };
  return {
    sway: Math.round(Math.sin(ph * Math.PI * 2) * 3),          // 莖左右晃
    step: Math.floor(ph * 4) % 2,                               // 根腳交替
    bounce: Math.floor(ph * 4) % 2 ? 0 : -1,
    droop: 0, hurt: false, blink: ph > 0.88, ph,
  };
}

// 花瓣：從花心往 ang 方向長出去的長橢圓；ink＝被墨水染到。回傳花瓣尖端的位置
function petal(g, cx, cy, ang, len, wid, inked, droop) {
  const a = ang + droop * 0.45 * (Math.cos(ang) >= 0 ? 1 : -1);
  const mx = cx + Math.cos(a) * len * 0.55, my = cy + Math.sin(a) * len * 0.55;
  g.oval(mx, my, len * 0.5, wid, a, (u, v, dx, dy) => {
    const lit = -0.6 * (dx / len) - 0.75 * (dy / len) + (1 - Math.abs(v)) * 0.25;   // 左上亮、中間脊亮一點
    if (inked) return lit > 0.25 ? C.ink3 : C.ink2;
    return lit > 0.3 ? C.pinkL : lit > -0.15 ? C.pink : C.pinkD;
  });
  return [cx + Math.cos(a) * len, cy + Math.sin(a) * len];
}

export function crookedFlowerFrame(pose = "idle", t = 0) {
  const q = poseOf(pose, t);
  const g = new Grid(W, H, OX, OY);
  const fx = q.sway, fy = -30 + (q.bounce ?? 0);          // 花心位置

  // 根腳（兩隻，交替往前）
  const lf = q.step ? -1 : 1;
  g.rect(-4 + lf, -3, 3, 3, C.leafD); g.rect(-5 + lf, -1, 2, 1, C.leafD);
  g.rect(2 - lf, -3, 3, 3, C.leafD); g.rect(4 - lf, -1, 2, 1, C.leafD);
  // 莖（從腳到花心，隨 sway 彎）
  for (let y = -3; y >= fy + 6; y--) {
    const k = (y + 3) / (fy + 9), x = Math.round(fx * k * k);
    g.set(x, y, C.leaf); g.set(x + 1, y, C.leafD);
  }
  // 兩片葉子：斜斜往上翹的長橢圓，上半亮、下半暗，中間一條葉脈
  const leafy = (x, y, ang) => g.oval(x, y, 4, 1.8, ang, (u, v) => (Math.abs(v) < 0.25 && Math.abs(u) < 0.8 ? C.leafD : v < 0 ? C.leaf : C.leafD));
  leafy(-4 + Math.round(fx * 0.3), -12, Math.PI + 0.5);
  leafy(5 + Math.round(fx * 0.45), -17, -0.45);

  const droop = q.droop + (q.hurt ? 0 : Math.sin(q.ph * Math.PI * 2 - 1) * 0.15);
  // 花瓣：本來 6 瓣，少了正下方那一瓣（瓣數不對，莖從缺口露出來）；右上、左下兩瓣被墨水染到，還有兩瓣歪掉（角度偏了）
  const T = Math.PI * 2 / 6;
  const dirs = [-Math.PI / 2, -Math.PI / 2 + T + 0.2, -Math.PI / 2 + 2 * T, -Math.PI / 2 + 4 * T, -Math.PI / 2 + 5 * T - 0.25];
  const inked = [false, true, false, true, false];
  const tips = dirs.map((a, i) => petal(g, fx, fy, a, 13, 3.3, inked[i], droop));

  // 花心＝臉（大一點）
  g.ellipse(fx, fy, 6, 5.5, (nx, ny) => (-0.6 * nx - 0.7 * ny > -0.3 ? C.face : C.faceD));
  const ex = fx - 4, ey = fy - 1;
  if (q.hurt) {
    for (const [x, k] of [[ex, 0], [ex + 4, 1]]) {
      const m = (d) => (k === 0 ? x + d : x + 1 - d);
      g.set(m(0), ey - 1, C.ink1); g.set(m(1), ey, C.ink1); g.set(m(0), ey + 1, C.ink1);
    }
    g.rect(ex + 1, ey + 3, 2, 1, C.ink1);
  } else if (q.blink) {
    g.rect(ex, ey + 1, 2, 1, C.ink1); g.rect(ex + 4, ey + 1, 2, 1, C.ink1);
    g.set(ex + 2, ey + 3, C.ink1);
  } else {
    for (const x of [ex, ex + 5]) { g.rect(x, ey - 1, 2, 3, C.ink1); g.set(x, ey - 1, C.white); }
    g.set(ex + 3, ey + 3, C.ink1); g.set(ex + 4, ey + 3, C.ink1);
  }
  g.set(ex - 1, ey + 2, C.pink); g.set(ex + 7, ey + 2, C.pink);

  // 被染黑的花瓣在滴墨水
  // 從染黑那瓣的下緣往下滴（慢慢拉長再斷掉）
  [1, 3].forEach((i, k) => {
    const [px, py] = tips[i], u = (q.ph * 2 + k * 0.5) % 1, len = 1 + Math.floor(u * 3);
    g.rect(Math.round(px), Math.round(py) + 1, 1, len, C.ink2);
    if (u > 0.75) g.set(Math.round(px), Math.round(py) + len + 3, C.ink3);
  });

  g.outline();
  return g.pixels();
}
