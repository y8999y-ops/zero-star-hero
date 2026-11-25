// 負號影（地下禁書庫的墨水怪）：一條「−」形狀的影子，從禁書裡爬出來，總是倒著走。
// 身體是一根橫的圓角長條（像負號），深墨紫、邊緣一圈紫光；下面拖著一排飄動的影子鬚。
// 「倒著走」：牠往左邊（玩家）移動，可是眼睛看著右邊，偶爾回頭偷看一下玩家。
// 動作：idle＝飄浮上下、影子鬚波動、每隔一段時間回頭看；hurt＝長條彎掉、＞＜眼。
// 雜兵 12 色以內。
//
// minusShadeFrame(pose, t) → { w, h, ox, oy, px, colors }（原點＝影子的位置，地上）

import { Grid } from "./_grid.js";

export const W = 56, H = 44, OX = 28, OY = 41;
const C = {
  ink0: "#0b0816", ink1: "#16112b", ink2: "#251c45", ink3: "#3a2e6b", ink4: "#584a9a",
  glow: "#b483ff", glowL: "#e2d0ff", white: "#ffffff", eye: "#ffe27a", eyeD: "#d7a43b",
};

function poseOf(pose, t) {
  const D = 1.6, ph = (t % D) / D;
  if (pose === "hurt") return { ph, hurt: true, bob: 0, look: 0 };
  return { ph, hurt: false, bob: Math.round(Math.sin(ph * Math.PI * 2) * 2), look: ph > 0.62 && ph < 0.82 ? -1 : 1, blink: ph > 0.92 };
}

export function minusShadeFrame(pose = "idle", t = 0) {
  const q = poseOf(pose, t);
  const g = new Grid(W, H, OX, OY);
  const cy = -20 + q.bob, half = 18, th = 6;
  // 影子鬚：長條下面一排往下飄的鬚（波動）
  for (let x = -half + 2; x <= half - 2; x += 3) {
    const len = 4 + Math.round((Math.sin(q.ph * Math.PI * 4 + x * 0.5) + 1) * 2);
    for (let k = 0; k < len; k++) g.set(x + Math.round(Math.sin(q.ph * Math.PI * 2 + k * 0.6) * 0.8), cy + th + k, k < len - 2 ? C.ink2 : C.ink3);
  }
  // 身體：「−」形狀的圓角長條；受傷時中間凹下去（彎掉）
  for (let x = -half; x <= half; x++) {
    const bend = q.hurt ? Math.round((1 - (x / half) ** 2) * 4) : 0;
    const end = Math.abs(x) > half - 3 ? (half - Math.abs(x)) : 3;         // 兩端收圓
    for (let y = -th + (3 - Math.min(3, end)); y <= th - (3 - Math.min(3, end)); y++) {
      const edge = Math.abs(y) >= th - 1 - (3 - Math.min(3, end)) || Math.abs(x) >= half - 1;
      const lit = -0.4 * (x / half) - (y / th);
      g.set(x, cy + y + bend, edge ? (y < 0 ? C.glowL : C.glow) : lit > 0.6 ? C.ink4 : lit > 0 ? C.ink3 : C.ink2);
    }
  }
  // 眼睛：平常看右邊（倒著走），偶爾回頭看左邊的玩家
  const ex = q.look > 0 ? 6 : -12, ey = cy - 2 + (q.hurt ? 3 : 0);
  if (q.hurt) {
    for (const [x, k] of [[ex, 0], [ex + 6, 1]]) { const m = (d) => (k === 0 ? x + d : x + 2 - d); g.set(m(0), ey - 1, C.white); g.set(m(1), ey, C.white); g.set(m(2), ey + 1, C.white); g.set(m(1), ey + 2, C.white); g.set(m(0), ey + 3, C.white); }
  } else if (q.blink) {
    g.rect(ex, ey + 1, 3, 1, C.eye); g.rect(ex + 6, ey + 1, 3, 1, C.eye);
  } else {
    for (const x of [ex, ex + 6]) { g.rect(x, ey - 1, 3, 4, C.eye); g.rect(x + (q.look > 0 ? 2 : 0), ey, 1, 2, C.ink0); g.set(x + (q.look > 0 ? 0 : 2), ey - 1, C.white); }
  }
  // 身邊飄的紫色小光點（禁書的魔力）
  const u = q.ph;
  for (let i = 0; i < 3; i++) { const a = u * Math.PI * 2 + i * 2.1; g.set(Math.round(Math.cos(a) * (half + 4)), cy - 10 + Math.round(Math.sin(a) * 4), i % 2 ? C.glow : C.glowL); }

  g.outline();
  return g.pixels();
}
