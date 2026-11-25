// 見習魔數師：大地圖用的四方向走路圖（女生／男生）。跟戰鬥圖（hero.js）同一個人、同一套色票、同樣大小。
// 方向：down（面向鏡頭）、up（背面）、right（側面，left 由遊戲左右翻）。
// 動作：idle＝站著呼吸、帽尖晃；walk＝4 格（腳交替、身體一上一下、帽尖慢半拍、手前後擺）。
// 全身 16 色以內（黑外框＋15 色），色票和戰鬥圖共用。
//
// heroWalkFrame(look, dir, pose, t, attrHex) → { w, h, ox, oy, px, colors }（原點＝腳底中央）

import { Grid } from "./_grid.js";
import { palette } from "./hero.js";

export const W = 32, H = 50, OX = 16, OY = 48;
export const WALK_LOOP = 0.6;    // 走一輪 4 格（0.6 秒）

function poseOf(pose, t) {
  if (pose === "walk") {
    const n = Math.floor(((t % WALK_LOOP) / WALK_LOOP) * 4);   // 0 左腳前、1 併攏、2 右腳前、3 併攏
    return { step: [1, 0, -1, 0][n], bob: n % 2 ? 0 : 1, tip: [1, 0, -1, 0][(n + 3) % 4], swing: [1, 0, -1, 0][n] };
  }
  const ph = (t % 1.6) / 1.6;
  return { step: 0, bob: ph < 0.5 ? 0 : 1, tip: Math.round(Math.sin(ph * Math.PI * 2 - 0.8)), swing: 0, blink: ph > 0.86 && ph < 0.93 };
}

// ── 正面（down）、背面（up）：左右對稱的身體 ──
function frontBack(g, P, q, girl, back) {
  const Y = -q.bob;                          // 身體往上 1 格＝踏出去那一步
  // 後面的頭髮：雙馬尾（左右各一束）／男生沒有
  const cy = -20 + Y;
  if (girl) for (const s of [-1, 1]) {
    g.ellipse(s * 7.5, cy - 1, 2, 2.2, (nx, ny) => (nx * s < 0.1 && ny < 0.2 ? P.hair : P.hairS));
    g.ellipse(s * 8.5, cy + 4, 1.8, 2.6, (nx, ny) => (ny < 0 ? P.hair : P.hairS));
    g.rect(s > 0 ? 7 : -9, cy + 1, 2, 1, P.hat);
  }
  // 鞋子：踏出去的那隻往下 1 格、另一隻收回
  const fl = q.step < 0 ? -2 : 0, fr = q.step > 0 ? -2 : 0;   // 抬起來的那隻腳往上縮 2 格
  g.rect(-5, -2 + fl, 4, 2, P.hairS); g.rect(-5, -2 + fl, 2, 1, P.hair);
  g.rect(1, -2 + fr, 4, 2, P.hairS); g.rect(1, -2 + fr, 2, 1, P.hair);
  // 袍子：梯形，右側暗（光從左上）
  const top = -13 + Y;
  g.poly([[-5, top], [5, top], [7, -2], [-7, -2]], (x, y) => (x >= 4 + (y - top) * 0.15 ? P.robeS : P.robe));
  if (!back) g.line(0, top + 2, 0, -4, P.robeS);          // 前襟
  g.rect(-7, -3, 14, 1, P.hat); g.rect(-7, -3, 3, 1, P.hatL);
  // 披肩／斗篷領
  if (girl) {
    g.ellipse(0, -12 + Y, 6.5, 2.6, (nx, ny) => (ny > 0.35 ? P.hatS : nx < -0.2 ? P.hatL : P.hat));
    if (!back) { g.rect(-1, -10 + Y, 2, 2, P.gold); g.set(0, -10 + Y, P.goldS); }
  } else {
    g.poly([[-6, -14 + Y], [6, -14 + Y], [6, -10 + Y], [-6, -9 + Y]], (x) => (x < -3 ? P.hatL : x > 3 ? P.hatS : P.hat));
    if (!back) g.rect(-2, -13 + Y, 4, 1, P.collar);
  }
  // 兩隻手（袖子＋小手），走路時前後擺：正面看是上下 1 格
  for (const s of [-1, 1]) {
    const dy = q.swing * s;
    const hx = s * 7, hyH = -7 + Y + dy;
    g.line(s * 5, -12 + Y, hx, hyH - 1, s < 0 ? P.hatL : P.hat); g.line(s * 5, -11 + Y, hx, hyH, P.hatS);
    g.rect(s < 0 ? hx - 1 : hx, hyH, 2, 2, P.skin); g.set(s < 0 ? hx : hx + 1, hyH + 1, P.skinS);
  }
  // 魔杖：揹在右手（畫面右邊），杖頭數晶
  const wx = 8, wy = -7 + Y + q.swing;
  g.line(wx + 1, wy, wx + 3, wy - 7, P.goldS);
  g.rect(wx + 2, wy - 9, 2, 2, P.hatL); g.set(wx + 3, wy - 9, P.white);

  // 頭
  g.ellipse(0, cy, 6, 5.6, (nx, ny) => (nx > 0.62 || ny > 0.72 ? P.skinS : P.skin));
  if (back) {
    // 後腦勺全是頭髮
    g.ellipse(0, cy - 0.5, 6, 5.4, (nx, ny) => (nx < 0.2 && ny < 0.1 ? P.hair : P.hairS));
    if (girl) g.rect(-1, cy + 3, 2, 2, P.hairS);
  } else {
    if (q.blink) { g.rect(-3, cy + 1, 2, 1, P.eye); g.rect(1, cy + 1, 2, 1, P.eye); }
    else {
      g.rect(-3, cy - 0.5, 2, 2, P.eye); g.rect(1, cy - 0.5, 2, 2, P.eye);
      g.set(-3, cy - 0.5, P.white); g.set(1, cy - 0.5, P.white);
    }
    g.set(-5, cy + 2, P.cheek); g.set(4, cy + 2, P.cheek);
    g.set(0, cy + 3, P.skinS);
    // 瀏海
    const bang = girl
      ? [[-6, cy - 1], [-5, cy - 5.5], [5, cy - 5.5], [6.5, cy - 1], [4, cy - 2.5], [2, cy - 1.5], [0, cy - 2.5], [-2, cy - 1.5], [-4, cy - 2.5]]
      : [[-6, cy - 1], [-5.5, cy - 5.5], [5.5, cy - 5.5], [6.5, cy - 1.5], [4, cy - 2.5], [1.5, cy - 1.5], [-1, cy - 3], [-3.5, cy - 2]];
    g.poly(bang, (x, y) => (y < cy - 4 && x < 2 ? P.hair : P.hairS));
    if (girl) for (const s of [-1, 1]) g.ellipse(s * 5.5, cy + 1, 1.2, 2.2, P.hairS);
    else { g.line(-5, cy - 4, -7, cy - 6, P.hair); }
  }
  hat(g, P, q, girl, 0, cy, back);
}

// ── 帽子（正面、背面、側面共用） ──
function hat(g, P, q, girl, cx, cy, back, side = false) {
  const by = cy - 5;
  g.ellipse(cx, by, 9, 1.6, (nx, ny) => (ny > 0.2 ? P.hatS : nx < -0.4 ? P.hatL : P.hat));
  const shade = (x, y) => (x < cx - 2.5 + (by - y) * 0.2 ? P.hatL : x > cx + 2.5 - (by - y) * 0.1 ? P.hatS : P.hat);
  if (girl) {
    g.poly([[cx - 6, by - 1], [cx + 6, by - 1], [cx + 4.5, by - 6], [cx + 1.5, by - 9], [cx - 2.5, by - 9], [cx - 5, by - 6]], shade);
    // 帽尖往後垂：正面、背面看是往左右其中一邊歪
    const tx = (side ? cx - 6.5 : cx + 6) - q.tip * 0.7;
    g.poly([[cx - 1, by - 8.5], [cx + 2, by - 9], [cx + 1, by - 11], [tx, by - 10], [tx + (side ? -0.5 : 0.5), by - 8.5]], (x, y) => (y < by - 10 ? P.hatL : P.hat));
    g.rect(cx - 5.5, by - 2, 11, 2, P.gold); g.rect(cx + 2.5, by - 2, 3, 2, P.goldS);
    if (!back) { const sx = side ? cx + 2 : cx; g.set(sx, by - 6, P.gold); g.set(sx - 1, by - 5, P.gold); g.set(sx + 1, by - 5, P.gold); g.set(sx, by - 4, P.gold); }
  } else {
    const tipX = (side ? cx - 5 : cx + 1) - q.tip, tipY = by - 15;
    g.poly([[cx - 5.5, by - 1], [cx + 5.5, by - 1], [cx + 2.5, by - 9], [tipX, tipY], [cx - 2.5, by - 8.5]],
      (x, y) => (x < cx - 2 + (by - y) * 0.15 ? P.hatL : x > cx + 2.5 - (by - y) * 0.25 ? P.hatS : P.hat));
    g.rect(cx - 5, by - 3, 10, 2, P.gold); g.rect(cx + 2, by - 3, 3, 2, P.goldS);
    g.set(tipX, tipY, P.hatL);
  }
}

// ── 側面（面向右）：跟戰鬥圖一樣的臉，腳前後跨 ──
function sideView(g, P, q, girl) {
  const Y = -q.bob, cx = 0.5, cy = -20 + Y;
  if (girl) {
    g.ellipse(-7, cy - 1, 2, 2.2, (nx, ny) => (nx < 0.1 && ny < 0.2 ? P.hair : P.hairS));
    g.ellipse(-8.5, cy + 4, 1.8, 2.6, (nx, ny) => (nx < 0 && ny < 0 ? P.hair : P.hairS));
    g.rect(-8, cy + 1, 2, 1, P.hat);
  }
  // 後面那隻手（暗一點，往反方向擺）
  const bx = -4 - q.swing * 2, byH = -7 + Y;
  g.line(-2, -12 + Y, bx, byH, P.hatS); g.rect(bx - 1, byH, 2, 2, P.skinS);
  // 腳：前後跨（step=±1 時兩腳分開 3 格）
  const a = q.step * 3;
  g.rect(-3 - a, -2, 4, 2, P.hairS); g.rect(-3 - a, -2, 2, 1, P.hair);
  g.rect(-1 + a, -2, 4, 2, P.hairS); g.rect(1 + a, -2, 2, 1, P.hair);
  const top = -13 + Y;
  g.poly([[-5, top], [5, top], [6, -2], [-6, -2]], (x, y) => (x >= 3 + (y - top) * 0.15 ? P.robeS : P.robe));
  g.line(1, top + 2, 1, -4, P.robeS);
  g.rect(-6, -3, 12, 1, P.hat); g.rect(-6, -3, 3, 1, P.hatL);
  if (girl) { g.ellipse(0, -12 + Y, 6, 2.6, (nx, ny) => (ny > 0.35 ? P.hatS : nx < -0.2 ? P.hatL : P.hat)); g.rect(3, -11 + Y, 2, 2, P.gold); }
  else { g.poly([[-6, -14 + Y], [6, -14 + Y], [5, -10 + Y], [-7, -9 + Y]], (x) => (x < -3 ? P.hatL : x > 3 ? P.hatS : P.hat)); g.rect(1, -13 + Y, 4, 1, P.collar); }
  // 前面那隻手＋魔杖（往前擺）
  const hx = 4 + q.swing * 2, hyH = -7 + Y;
  g.line(3, -12 + Y, hx - 1, hyH - 1, P.hat); g.line(3, -11 + Y, hx - 1, hyH, P.hatS);
  g.line(hx, hyH, hx + 4, hyH - 6, P.goldS);
  g.rect(hx - 1, hyH - 1, 2, 2, P.skin); g.set(hx, hyH, P.skinS);
  g.rect(hx + 3, hyH - 8, 2, 2, P.hatL); g.set(hx + 4, hyH - 8, P.white);
  // 頭（五官偏右）
  g.ellipse(cx, cy, 6, 5.6, (nx, ny) => (nx > 0.62 || ny > 0.72 ? P.skinS : P.skin));
  if (q.blink) g.rect(cx + 2.5, cy + 1, 2, 1, P.eye);
  else { g.rect(cx + 2.5, cy - 0.5, 2, 2, P.eye); g.set(cx + 2.5, cy - 0.5, P.white); }
  g.set(cx + 4.5, cy + 2, P.cheek);
  g.set(cx + 4, cy + 3, P.skinS);
  const bang = girl
    ? [[cx - 6, cy + 2], [cx - 5, cy - 5.5], [cx + 6, cy - 5.5], [cx + 6.5, cy - 3], [cx + 3, cy - 2.5], [cx + 1.5, cy - 1.5], [cx - 1, cy - 2.5], [cx - 1, cy + 2]]
    : [[cx - 6, cy + 1.5], [cx - 5.5, cy - 5.5], [cx + 6, cy - 5.5], [cx + 6.5, cy - 2.5], [cx + 4, cy - 3.5], [cx + 2, cy - 2.6], [cx, cy - 3.5], [cx - 1.5, cy + 1.5]];
  g.poly(bang, (x, y) => (y < cy - 4 && x < cx + 2 ? P.hair : P.hairS));
  if (!girl) { g.line(cx - 6, cy - 3, cx - 8.5, cy - 4.5, P.hair); g.set(cx - 8.5, cy - 5, P.hairS); }
  hat(g, P, q, girl, cx, cy, false, true);
}

export function heroWalkFrame(look, dir = "down", pose = "idle", t = 0, attrHex = "#8a7cff", hairPair = null) {
  const P = palette(look, attrHex, hairPair), q = poseOf(pose, t), girl = look === "girl";
  const g = new Grid(W, H, OX, OY);
  if (dir === "right" || dir === "left") sideView(g, P, q, girl);
  else frontBack(g, P, q, girl, dir === "up");
  g.outline();
  const f = g.pixels();
  if (dir === "left") {          // 左＝右翻過來
    const px = new Uint32Array(f.px.length);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) px[y * W + x] = f.px[y * W + (W - 1 - x)];
    f.px = px; f.ox = W - 1 - OX;
  }
  return f;
}
