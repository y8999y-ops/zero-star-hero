// 散頁怪（千頁圖書館的墨水怪）：《萬題之書》散掉的書頁被墨水黏成一團，滾著前進。
// 一顆皺皺的紙球：好幾張書頁疊在一起（每張有字的橫線、被墨水染了一角），正中間一大塊墨漬是臉，兩隻白眼睛看向左邊的玩家。
// 動作：idle＝往左滾（書頁一圈一圈轉、身體一彈一彈、翹起來的頁角一掀一掀）；hurt＝書頁炸開一點、＞＜眼。
// 雜兵 12 色以內。
//
// scatterPageFrame(pose, t) → { w, h, ox, oy, px, colors }（原點＝腳底中央）

import { Grid } from "./_grid.js";

export const W = 44, H = 40, OX = 22, OY = 37;
const C = {
  paperL: "#fffaf0", paper: "#efe0c2", paperD: "#c9a46a", line: "#8a6a48",
  ink1: "#1c1533", ink2: "#2d2350", ink3: "#55479a", white: "#ffffff", blush: "#e8a0a8",
};

function poseOf(pose, t) {
  const D = 1.2, ph = (t % D) / D;
  if (pose === "hurt") return { rot: 0.3, bounce: 0, flare: 3, hurt: true, ph };
  return {
    rot: -ph * Math.PI * 2,                                  // 往左滾＝逆時針
    bounce: Math.abs(Math.sin(ph * Math.PI * 2)) > 0.7 ? -1 : 0,
    flap: Math.floor(ph * 6) % 2,
    flare: 0, hurt: false, blink: ph > 0.9, ph,
  };
}

// 一張書頁：中心 (cx, cy)、轉 ang、寬 w 高 h；有字的橫線、左上亮右下暗、ink＝右下角被墨水染到
function sheet(g, cx, cy, ang, w, h, ink) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const P = (u, v) => [cx + u * c - v * s, cy + u * s + v * c];
  g.poly([P(-w / 2, -h / 2), P(w / 2, -h / 2), P(w / 2, h / 2), P(-w / 2, h / 2)], (x, y) => {
    const dx = x - cx, dy = y - cy, u = dx * c + dy * s, v = -dx * s + dy * c;
    if (ink && u + v > (w + h) * 0.22) return u + v > (w + h) * 0.32 ? C.ink2 : C.ink3;
    const edge = Math.min(w / 2 - Math.abs(u), h / 2 - Math.abs(v));
    if (edge < 1.2) return dx + dy < 0 ? C.paperL : C.paperD;      // 紙邊：左上亮、右下暗
    if (Math.round(v + h) % 3 === 0 && Math.abs(u) < w / 2 - 2) return C.line;   // 字的橫線
    return dx + dy < -2 ? C.paperL : C.paper;
  });
}

export function scatterPageFrame(pose = "idle", t = 0) {
  const q = poseOf(pose, t);
  const g = new Grid(W, H, OX, OY);
  const cx = 0, cy = -15 + q.bounce, R = 12 + q.flare * 0.5;

  // 書頁一張一張疊成一球（後面的先畫），跟著滾的角度轉
  const N = 7;
  for (let i = 0; i < N; i++) {
    const a = q.rot + (i / N) * Math.PI * 2, d = 5 + (i % 2) * 2 + q.flare;
    sheet(g, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.9, a + 0.6 + (i % 3) * 0.3, 13, 10, i % 3 === 1);
  }
  // 中間再壓兩張，讓球是實心的
  sheet(g, cx + 1, cy - 1, q.rot * 0.5 + 0.2, 15, 12, false);
  sheet(g, cx - 1, cy + 1, q.rot * 0.5 + 1.4, 12, 11, false);

  // 翹起來的頁角（左上，一掀一掀）
  if (!q.hurt) {
    const fx = cx - R + 3, fy = cy - R + 4;
    g.poly([[fx, fy + 4], [fx + 6, fy], [fx + 3 - q.flap * 2, fy - 4 - q.flap]], (x, y) => (x + y < fx + fy ? C.paperL : C.paper));
  }

  // 臉：一大塊墨漬，往左偏（看玩家）
  const ex = cx - 5, ey = cy - 1;
  g.ellipse(ex + 3, ey + 1, 7, 5.2, (nx, ny) => (nx + ny < -0.9 ? C.ink3 : C.ink2));
  g.set(ex + 9, ey + 6, C.ink2); g.set(ex + 9, ey + 7, C.ink3);        // 墨漬往下流一點
  if (q.hurt) {
    for (const [x, k] of [[ex - 1, 0], [ex + 4, 1]]) {
      const m = (d) => (k === 0 ? x + d : x + 2 - d);
      g.set(m(0), ey - 1, C.white); g.set(m(1), ey, C.white); g.set(m(2), ey + 1, C.white); g.set(m(1), ey + 2, C.white); g.set(m(0), ey + 3, C.white);
    }
    g.rect(ex + 2, ey + 4, 2, 1, C.white);
  } else if (q.blink) {
    g.rect(ex - 1, ey + 1, 3, 1, C.white); g.rect(ex + 4, ey + 1, 3, 1, C.white);
  } else {
    for (const x of [ex - 1, ex + 4]) { g.rect(x, ey - 1, 3, 4, C.white); g.rect(x, ey + 1, 1, 2, C.ink1); }   // 眼珠靠左
    g.rect(ex + 1, ey + 4, 3, 1, C.white);                              // 歪嘴
    g.set(ex + 4, ey + 3, C.white);
  }
  g.set(ex - 2, ey + 4, C.blush); g.set(ex + 8, ey + 4, C.blush);

  // 地上掉的一小張紙（滾過去留下的）
  if (!q.hurt) { const k = Math.floor(q.ph * 3); g.rect(8 + k * 2, -2, 3, 1, C.paperD); }

  g.outline();
  return g.pixels();
}
