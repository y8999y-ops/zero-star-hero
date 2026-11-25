// 亂針鐘（刻度鐘塔的墨水怪）：鐘塔裡的小懷錶被墨水弄壞了，指針亂轉、時間亂跳。
// 圓圓的金色懷錶（上面有轉鈕和吊環），錶面只有刻度沒有數字（鐘塔的設定），一道墨水裂痕從錶面流下來。
// 錶面上半是一雙大眼睛（看向左邊），兩根指針從中心亂轉（長針快、短針倒著轉），兩隻小腳蹦蹦跳。
// 動作：idle＝蹦蹦跳＋指針亂轉＋吊環晃；hurt＝指針垂下、＞＜眼、彈簧從頂上跳出來。
// 雜兵 12 色以內。
//
// chaosClockFrame(pose, t) → { w, h, ox, oy, px, colors }（原點＝腳底中央）

import { Grid } from "./_grid.js";

export const W = 40, H = 46, OX = 20, OY = 43;
const C = {
  goldL: "#ffe9a0", gold: "#e8b04a", goldD: "#a8761c",
  face: "#f6ecd6", faceD: "#c8bfd8", tick: "#545a75",
  ink1: "#1c1533", ink2: "#2d2350", ink3: "#55479a", white: "#ffffff", blue: "#35c3da",
};

function poseOf(pose, t) {
  const D = 1.2, ph = (t % D) / D;
  if (pose === "hurt") return { hop: 0, long: Math.PI * 0.55, short: Math.PI * 0.45, step: 0, hurt: true, ph };
  const k = Math.floor(ph * 4);
  return {
    hop: k % 2 ? -2 : 0, step: k % 2,
    long: ph * Math.PI * 2 * 3 + (k === 2 ? 0.8 : 0),          // 長針一圈轉三次，還會突然跳一格
    short: -ph * Math.PI * 2,                                   // 短針倒著轉
    swing: Math.round(Math.sin(ph * Math.PI * 2) * 1.5),
    hurt: false, blink: ph > 0.9, ph,
  };
}

export function chaosClockFrame(pose = "idle", t = 0) {
  const q = poseOf(pose, t);
  const g = new Grid(W, H, OX, OY);
  const cx = 0, cy = -17 + q.hop, R = 12;

  // 小腳（交替）
  const lf = q.step ? 1 : 0;
  g.rect(-5, -4 - lf, 2, 4 + lf, C.goldD); g.rect(-7, -1, 4, 1, C.goldD);
  g.rect(3, -4 - (1 - lf), 2, 4 + (1 - lf), C.goldD); g.rect(3, -1, 4, 1, C.goldD);

  // 頂上的轉鈕＋吊環（跟著晃）
  g.rect(cx - 2, cy - R - 3, 4, 3, C.gold); g.rect(cx - 2, cy - R - 3, 1, 3, C.goldL);
  g.ellipse(cx + (q.swing ?? 0), cy - R - 7, 3.5, 3, (nx, ny) => (nx * nx + ny * ny < 0.35 ? null : ny < 0 ? C.goldL : C.gold));
  // 受傷時彈簧跳出來
  if (q.hurt) for (let i = 0; i < 4; i++) g.rect(cx + 2 + (i % 2) * 2, cy - R - 4 - i * 2, 3, 1, C.goldL);

  // 錶殼：金色一圈（左上亮、右下暗）
  g.ellipse(cx, cy, R, R, (nx, ny) => (-0.6 * nx - 0.7 * ny > 0.45 ? C.goldL : -0.6 * nx - 0.7 * ny > -0.35 ? C.gold : C.goldD));
  // 錶面
  g.ellipse(cx, cy, R - 3, R - 3, (nx, ny) => (nx + ny > 0.95 ? C.faceD : C.face));
  // 刻度（12 個，沒有數字；3、6、9、12 長一點）
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2, r0 = R - 4, long = i % 3 === 0;
    g.set(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, C.tick);
    if (long) g.set(cx + Math.cos(a) * (r0 - 1), cy + Math.sin(a) * (r0 - 1), C.tick);
  }
  // 墨水裂痕：從右上往下流到錶殼外
  g.line(cx + 5, cy + 2, cx + 7, cy + 5, C.ink2); g.line(cx + 7, cy + 5, cx + 7, cy + 8, C.ink2);
  g.set(cx + 6, cy + 5, C.ink3);
  const u = (q.ph * 1.5) % 1;
  g.rect(cx + 8, cy + 5, 1, 1 + Math.floor(u * 4), C.ink2);
  if (u > 0.75) g.set(cx + 8, cy + 10, C.ink3);

  // 指針（中心往外）：長針、短針
  const hand = (a, len, col) => { for (let r = 1; r <= len; r++) g.set(cx + Math.cos(a - Math.PI / 2) * r, cy + 3 + Math.sin(a - Math.PI / 2) * r, col); };
  hand(q.short, 3, C.ink2);
  hand(q.long, 5, C.ink3);
  g.rect(cx, cy + 3, 1, 1, C.blue);                                    // 中心的藍寶石

  // 眼睛（錶面上半，靠左看玩家）
  const ey = cy - 5;
  if (q.hurt) {
    for (const [x, k] of [[-6, 0], [1, 1]]) {
      const m = (d) => (k === 0 ? x + d : x + 2 - d);
      g.set(m(0), ey - 1, C.ink1); g.set(m(1), ey, C.ink1); g.set(m(2), ey + 1, C.ink1); g.set(m(1), ey + 2, C.ink1); g.set(m(0), ey + 3, C.ink1);
    }
  } else if (q.blink) {
    g.rect(-6, ey + 1, 3, 1, C.ink1); g.rect(1, ey + 1, 3, 1, C.ink1);
  } else {
    for (const x of [-6, 1]) { g.rect(x, ey - 1, 3, 4, C.ink1); g.set(x, ey - 1, C.white); }
  }

  g.outline();
  return g.pixels();
}
