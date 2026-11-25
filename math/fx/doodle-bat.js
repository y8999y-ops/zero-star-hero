// 塗鴉蝙蝠（千頁圖書館的墨水怪）：書頁空白處被墨水亂畫出來的蝙蝠，活了過來飛出書外。
// 「塗鴉」的樣子：翅膀是紙色的膜、邊緣和骨架是墨水線、膜上有幾條斜斜的鉛筆塗線；圓滾滾的墨水身體、大白眼、一顆小尖牙。
// 一直浮在半空中（腳下離地 22 格），慢慢上下飄。面向左（朝玩家）。
// 動作：idle＝拍翅膀（上、中、下三格）、身體跟著一上一下；hurt＝翅膀縮起來、＞＜眼、往下掉一點。
// 雜兵 12 色以內。
//
// doodleBatFrame(pose, t) → { w, h, ox, oy, px, colors }（原點＝影子的位置，地上）

import { Grid } from "./_grid.js";

export const W = 60, H = 56, OX = 30, OY = 53;
const C = {
  ink1: "#1c1533", ink2: "#2d2350", ink3: "#55479a", ink4: "#8274c8",
  paper: "#efe0c2", paperD: "#c9a46a", hatch: "#a99ad6", white: "#ffffff", red: "#e0565b",
};

function poseOf(pose, t) {
  const D = 1.0, ph = (t % D) / D;
  if (pose === "hurt") return { wing: 2, y: -18, hurt: true, ph };
  const f = Math.floor(ph * 6) % 4;                    // 上 → 中 → 下 → 中
  return { wing: [0, 1, 2, 1][f], y: -24 + Math.round(Math.sin(ph * Math.PI * 2) * 2) + (f === 2 ? 1 : 0), hurt: false, blink: ph > 0.88, ph };
}

// 一邊的翅膀：side −1 左、1 右；up 0 往上張、1 平、2 往下拍
function wing(g, bx, by, side, up, folded) {
  const span = folded ? 12 : 22, lift = [-12, -3, 7][up];
  const tip = [bx + side * span, by + lift];
  const elbow = [bx + side * span * 0.5, by + lift * 0.6 - 4];
  // 膜：從肩膀到翅尖，下緣是三個弧（蝙蝠的扇形）
  const pts = [[bx + side * 2, by - 3], elbow, tip];
  const scal = 3;
  for (let k = scal; k >= 0; k--) {
    const u = k / scal, x = bx + side * (2 + (span - 2) * u), y = by + lift * u + 6 - (k % 2 ? 0 : 3) * (1 - Math.abs(u - 0.5));
    pts.push([x, y + (k === 0 ? 0 : 2)]);
  }
  g.poly(pts, (x, y) => ((x * 2 + y) % 5 === 0 && Math.abs(x - bx) > 4 ? C.hatch : y < by + lift * Math.abs(x - bx) / span - 1 ? C.paper : C.paperD));
  // 骨架：肩 → 手肘 → 翅尖，再從手肘拉兩根指骨到下緣
  g.line(bx + side * 2, by - 3, elbow[0], elbow[1], C.ink2);
  g.line(elbow[0], elbow[1], tip[0], tip[1], C.ink2);
  g.line(elbow[0], elbow[1], bx + side * span * 0.4, by + lift * 0.4 + 7, C.ink3);
  g.line(elbow[0], elbow[1], bx + side * span * 0.75, by + lift * 0.75 + 6, C.ink3);
  g.set(tip[0], tip[1] - 1, C.ink2);                     // 翅尖的小爪
}

export function doodleBatFrame(pose = "idle", t = 0) {
  const q = poseOf(pose, t);
  const g = new Grid(W, H, OX, OY);
  const bx = 0, by = q.y;

  wing(g, bx, by, -1, q.wing, q.hurt);
  wing(g, bx, by, 1, q.wing, q.hurt);

  // 身體：圓滾滾的墨水球＋兩隻尖耳朵
  g.poly([[-6, by - 6], [-5, by - 13], [-2, by - 8]], C.ink2);
  g.poly([[2, by - 8], [5, by - 13], [6, by - 6]], C.ink2);
  g.ellipse(bx, by, 7, 6.5, (nx, ny) => (-0.6 * nx - 0.7 * ny > 0.55 ? C.ink4 : -0.6 * nx - 0.7 * ny > 0 ? C.ink3 : C.ink2));
  g.set(-4, by - 4, C.white);
  // 腳：兩隻小爪縮在肚子下
  g.rect(-2, by + 6, 1, 2, C.ink2); g.rect(2, by + 6, 1, 2, C.ink2);

  // 臉：眼睛靠左看玩家
  const ey = by - 2;
  if (q.hurt) {
    for (const [x, k] of [[-5, 0], [1, 1]]) {
      const m = (d) => (k === 0 ? x + d : x + 2 - d);
      g.set(m(0), ey - 1, C.white); g.set(m(1), ey, C.white); g.set(m(2), ey + 1, C.white); g.set(m(1), ey + 2, C.white); g.set(m(0), ey + 3, C.white);
    }
  } else if (q.blink) {
    g.rect(-5, ey + 1, 3, 1, C.white); g.rect(1, ey + 1, 3, 1, C.white);
  } else {
    for (const x of [-5, 1]) { g.rect(x, ey - 1, 3, 3, C.white); g.rect(x, ey, 1, 2, C.ink1); }
  }
  // 嘴＋一顆小尖牙
  g.rect(-3, ey + 4, 4, 1, C.ink1); g.set(-1, ey + 5, C.white);
  if (!q.hurt) g.set(1, ey + 4, C.red);

  // 掉下來的墨點（從身體下面一滴一滴往下）
  const u = (q.ph * 2) % 1, dy = Math.floor(u * 14);
  if (!q.hurt) g.set(1, by + 9 + dy, u < 0.8 ? C.ink3 : C.ink4);

  g.outline();
  return g.pixels();
}
