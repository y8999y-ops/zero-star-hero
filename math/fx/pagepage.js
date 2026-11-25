// 頁頁（《萬題之書》掉出來的一頁，變成會飛的小書精靈）——第一階段「一張紙」。
// 一張飄浮的紙：右上角往下折、下緣捲起來、上面有兩條淡藍色橫線（不寫字）；兩個大眼睛；頭頂一根金色小羽毛。
// 動作：紙的左右兩邊像翅膀一樣上下拍、整張上下飄。
//   idle 待機、talk 說話（嘴巴一開一合）、happy 開心（^^ 眼＋亮點）、worried 擔心（八字眉眼＋汗滴）
// NPC 16 色以內。
//
// pagepageFrame(pose, t) → { w, h, ox, oy, px, colors }（原點＝紙的下緣中央）

import { Grid } from "./_grid.js";

export const W = 32, H = 40, OX = 16, OY = 34;
const C = {
  paper: "#fffaf0", paperS: "#efe3cb", paperD: "#d6c3a0", fold: "#bfa77e",
  line: "#a9c9ec", eye: "#2a2248", white: "#ffffff", blush: "#ff9fae",
  gold: "#ffd35c", goldD: "#c08a2e", sweat: "#8fd0ff", spark: "#fff3a8",
};

function poseOf(pose, t) {
  const D = 1.0, ph = (t % D) / D;
  return {
    bob: Math.round(Math.sin(ph * Math.PI * 2) * 1.5),
    flap: Math.round(Math.sin(ph * Math.PI * 4) * 2),     // 一個循環拍兩下
    mouth: pose === "talk" ? (Math.floor(ph * 6) % 2 ? "open" : "small") : pose === "happy" ? "smile" : pose === "worried" ? "wavy" : "small",
    eyes: pose === "happy" ? "happy" : pose === "worried" ? "worried" : ph > 0.9 && pose === "idle" ? "blink" : "open",
    pose, ph,
  };
}

export function pagepageFrame(pose = "idle", t = 0) {
  const q = poseOf(pose, t);
  const g = new Grid(W, H, OX, OY);
  const y0 = -q.bob;
  const top = -25 + y0, bot = -5 + y0, HW = 7;          // 直式的一張紙：寬 15、高 21
  // 每一欄依離中間多遠往上或往下彎（越外面彎越多）＝像翅膀一樣拍
  const off = (x) => Math.round(q.flap * (Math.abs(x) / HW) ** 2);

  for (let x = -HW; x <= HW; x++) {
    const o = off(x), yt = top + o, yb = bot + o;
    for (let y = yt; y <= yb; y++) {
      let c = x >= HW - 1 ? C.paperS : C.paper;          // 右邊緣背光
      if (y >= yb - 1) c = y === yb ? C.paperD : C.paperS; // 下緣捲起來（兩階）
      g.set(x, y, c);
    }
    // 筆記紙的兩條淡藍線（跟著紙彎）
    if (x > -HW + 1 && x < HW - 1) { g.set(x, yt + 5, C.line); g.set(x, yb - 6, C.line); }
  }
  // 右上角折下來（狗耳朵）：對角線右上那一半被摺掉（透明），左下那一半是摺過來的紙背面，對角線是摺痕
  const fx0 = HW - 4, FS = 4;
  for (let u = 0; u <= FS; u++) {
    const x = fx0 + u, yt = top + off(x);
    for (let v = 0; v <= FS; v++) {
      const y = yt + v;
      if (v < u) g.set(x, y, null);
      else if (v === u) g.set(x, y, C.fold);
      else if (u + v <= FS + 1) g.set(x, y, C.paperD);
    }
  }
  // 眼睛（圓圓的，反光在右上）
  const ey = top + 9, L = -4, R = 1;
  if (q.eyes === "happy") {
    for (const x of [L, R]) { g.set(x, ey + 1, C.eye); g.set(x + 1, ey, C.eye); g.set(x + 2, ey + 1, C.eye); }
  } else if (q.eyes === "blink") {
    for (const x of [L, R]) g.rect(x, ey + 1, 3, 1, C.eye);
  } else {
    for (const x of [L, R]) { g.rect(x, ey - 1, 2, 3, C.eye); g.set(x + 1, ey - 1, C.white); }
    // 擔心：眉毛中間高、外面低
    if (q.eyes === "worried") { g.set(L - 1, ey - 2, C.eye); g.set(L, ey - 3, C.eye); g.set(R + 1, ey - 3, C.eye); g.set(R + 2, ey - 2, C.eye); }
  }
  g.set(L - 1, ey + 3, C.blush); g.set(R + 2, ey + 3, C.blush);

  // 嘴
  const mx = -1, my = ey + 4;
  if (q.mouth === "open") g.rect(mx, my, 2, 2, C.eye);
  else if (q.mouth === "smile") { g.set(mx - 1, my, C.eye); g.rect(mx, my + 1, 2, 1, C.eye); g.set(mx + 2, my, C.eye); }
  else if (q.mouth === "wavy") { g.set(mx - 1, my + 1, C.eye); g.set(mx, my, C.eye); g.set(mx + 1, my + 1, C.eye); g.set(mx + 2, my, C.eye); }
  else g.rect(mx, my, 2, 1, C.eye);

  // 頭頂的金色小羽毛：葉子形的羽片＋中間一根羽軸，往左後方彎，跟著拍動慢半拍晃
  const sway = q.flap > 0 ? -1 : 0, by = top + off(0);
  const vane = [[0, -1], [-1, -2], [-1, -3], [-2, -4], [-2, -5], [-3, -6], [-3, -7]];
  vane.forEach(([dx, dy], i) => {
    const x = dx + (i > 3 ? sway : 0), y = by + dy;
    g.set(x, y, C.goldD);                       // 羽軸
    if (i > 0) { g.set(x - 1, y, C.gold); if (i < 6) g.set(x + 1, y, C.gold); }   // 兩邊的羽片
  });

  g.outline();

  if (q.eyes === "worried") { const sx = HW + 2, sy = top + 7; g.set(sx, sy, C.sweat); g.set(sx, sy + 1, C.sweat); g.set(sx - 1, sy + 1, C.white); }
  if (q.pose === "happy") {
    const k = Math.floor(q.ph * 4) % 2;
    for (const [x, y] of k ? [[-11, top + 2], [11, top - 2]] : [[-10, top - 3], [12, top + 5]]) {
      g.set(x, y, C.spark); g.set(x - 1, y, C.gold); g.set(x + 1, y, C.gold); g.set(x, y - 1, C.gold); g.set(x, y + 1, C.gold);
    }
  }
  return g.pixels();
}
