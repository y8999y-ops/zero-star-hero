// 碎晶蟲（分晶溫室的墨水怪）：溫室裡的數晶果實碎片被墨水黏成一條毛毛蟲。
// 五節身體一節一節是切面的水晶（青綠色，左上亮、右下暗、中間一道亮的切面），其中兩節被墨水染成深紫；
// 頭在左邊（朝玩家），大眼睛、一對小觸角上掛著小水晶。每節下面兩隻小腳。
// 動作：idle＝一拱一拱往前爬（身體波浪、腳交替、觸角晃）；hurt＝縮成一團、＞＜眼、碎晶噴出來。
// 雜兵 12 色以內。
//
// crystalBugFrame(pose, t) → { w, h, ox, oy, px, colors }（原點＝腳底中央）

import { Grid } from "./_grid.js";

export const W = 76, H = 46, OX = 34, OY = 43;
const C = {
  crysL: "#d4fff6", crys: "#5fe0d0", crysD: "#2f8f9a", crysDD: "#1f5e6e",
  ink2: "#2d2350", ink3: "#55479a", ink1: "#1c1533", white: "#ffffff", leg: "#1f5e6e", blush: "#f7a8c0",
};

function poseOf(pose, t) {
  const D = 1.2, ph = (t % D) / D;
  if (pose === "hurt") return { ph, hurt: true };
  return { ph, hurt: false, blink: ph > 0.9 };
}

// 一節水晶身體：切面的圓（八邊形），左上亮、右下暗，中間一道亮切面
function segment(g, cx, cy, r, inked) {
  const pts = Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.95]; });
  g.poly(pts, (x, y) => {
    const dx = (x - cx) / r, dy = (y - cy) / r, lit = -0.6 * dx - 0.75 * dy;
    if (inked) return lit > 0.35 ? C.ink3 : C.ink2;
    if (Math.abs(dx + dy * 0.3) < 0.14 && dy < 0.3) return C.crysL;           // 亮的切面
    return lit > 0.45 ? C.crysL : lit > -0.1 ? C.crys : lit > -0.6 ? C.crysD : C.crysDD;
  });
}

export function crystalBugFrame(pose = "idle", t = 0) {
  const q = poseOf(pose, t);
  const g = new Grid(W, H, OX, OY);
  const N = 5, inked = [false, true, false, false, true];
  const segs = [];
  for (let i = N - 1; i >= 0; i--) {
    // 一拱一拱：波浪從尾巴傳到頭；受傷時縮成一團
    const wave = q.hurt ? 0 : Math.sin(q.ph * Math.PI * 2 - i * 0.9);
    const x = q.hurt ? -8 + i * 6 : -18 + i * 11 + Math.round(wave * 1.5), y = -11 - Math.max(0, Math.round(wave * 5)) + (q.hurt ? -2 : 0);
    const r = i === 0 ? 10 : 9 - i * 0.5;
    segs.unshift([x, y, r]);
    // 腳：每節兩隻，交替
    if (!q.hurt) { const k = (Math.floor(q.ph * 6) + i) % 2, top = Math.round(y + r * 0.7); g.rect(x - 3 + k, top, 1, -top, C.leg); g.rect(x + 2 - k, top, 1, -top, C.leg); g.set(x - 4 + k, -1, C.leg); g.set(x + 3 - k, -1, C.leg); }
    segment(g, x, y, r, i > 0 && inked[i]);
  }
  // 頭（第 0 節，最上層）：再畫一次蓋在前面
  const [hx, hy] = segs[0];
  segment(g, hx, hy, 10, false);
  // 觸角＋小水晶
  const sway = q.hurt ? 2 : Math.round(Math.sin(q.ph * Math.PI * 2) * 1.5);
  for (const [dx, k] of [[-3, -1], [2, 1]]) {
    g.line(hx + dx, hy - 9, hx + dx + k * 2 + sway, hy - 15, C.crysDD);
    g.rect(hx + dx + k * 2 + sway - 1, hy - 17, 3, 3, C.crysL);
  }
  // 臉：看左邊
  const ey = hy - 1;
  if (q.hurt) {
    for (const [x, k] of [[hx - 6, 0], [hx - 1, 1]]) { const m = (d) => (k === 0 ? x + d : x + 2 - d); g.set(m(0), ey - 1, C.ink1); g.set(m(1), ey, C.ink1); g.set(m(2), ey + 1, C.ink1); g.set(m(1), ey + 2, C.ink1); g.set(m(0), ey + 3, C.ink1); }
    // 碎晶噴出來
    for (let i = 0; i < 4; i++) g.rect(hx + 10 + i * 5, hy - 12 + (i % 2) * 4, 2, 2, i % 2 ? C.crysL : C.crys);
  } else if (q.blink) {
    g.rect(hx - 6, ey + 1, 3, 1, C.ink1); g.rect(hx - 1, ey + 1, 3, 1, C.ink1);
  } else {
    for (const x of [hx - 6, hx - 1]) { g.rect(x, ey - 1, 3, 4, C.ink1); g.set(x, ey - 1, C.white); }
  }
  g.rect(hx - 4, ey + 4, 3, 1, C.ink1);
  g.set(hx - 7, ey + 3, C.blush); g.set(hx + 3, ey + 3, C.blush);
  // 被墨水染到的那幾節在滴墨
  const u = (q.ph * 2) % 1;
  for (const i of [1, 4]) { const [x, y, r] = segs[i]; g.rect(Math.round(x + 1), Math.round(y + r - 1), 1, 1 + Math.floor(u * 3), C.ink2); }

  g.outline();
  return g.pixels();
}
