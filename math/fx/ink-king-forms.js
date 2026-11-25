// 墨水大王的兩個型態（企劃書：每區的王是墨水大王把那一區的東西黏在身上）。身體、臉跟幼體（ink-king-baby.js）同一套，
// 讓玩家認得「又是牠」，但身上的裝備不一樣：
//   書頁鎧甲（千頁圖書館）：頭上戴一本攤開的厚書當頭盔、肚子圍一圈書頁當胸甲（金鉚釘）、兩肩疊著書、手上拿一根大羽毛筆當劍。
//   齒輪型（刻度鐘塔）：背後一個大齒輪一直轉、身上黏著小齒輪（反著轉）、頭上插一根鐘的指針當角、右眼戴一個鐘面單片眼鏡。
// 面向左（朝玩家）。動作：idle＝呼吸、手揮、裝備跟著晃或轉；hurt＝壓扁、＞＜眼、裝備被打歪。王 24 色以內。
//
// inkKingPageFrame / inkKingGearFrame(pose, t) → { w, h, ox, oy, px, colors }（原點＝腳底中央）

import { Grid } from "./_grid.js";

export const W = 110, H = 104, OX = 55, OY = 98;
const C = {
  ink0: "#0b0816", ink1: "#16112b", ink2: "#251c45", ink3: "#3a2e6b", ink4: "#584a9a", ink5: "#8274c8",
  shine: "#d6ceff", white: "#ffffff", iris: "#b483ff", blush: "#9a6fd6",
  paperL: "#fffaf0", paper: "#efe0c2", paperD: "#c9a46a", line: "#8a6a48",
  navy: "#34407e", navyD: "#1f2856", goldL: "#ffe9a0", gold: "#e8b04a", goldD: "#a8761c", red: "#c0475a", green: "#4f9a62",
  steelL: "#c8cde0", steel: "#8a8fa8", steelD: "#545a75", blue: "#35c3da",
};

function shadeAt(nx, ny) {
  const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
  const d = -0.55 * nx - 0.65 * ny + 0.5 * nz;
  return d > 0.75 ? C.ink5 : d > 0.5 ? C.ink4 : d > 0.2 ? C.ink3 : d > -0.15 ? C.ink2 : C.ink1;
}

function poseOf(pose, t) {
  const D = 2.0, ph = (t % D) / D;
  if (pose === "hurt") return { s: -0.3, arm: 0.8, tilt: 0.9, hurt: true, ph, blink: false };
  return { s: Math.sin(ph * Math.PI * 2) * 0.06, arm: Math.sin(ph * Math.PI * 4) * 0.5, tilt: Math.sin(ph * Math.PI * 2 - 1.2) * 0.25, hurt: false, ph, blink: ph > 0.9 };
}

// 身體（墨水攤、兩隻手、水滴身體、光澤），回傳位置給裝備用
function body(g, q, { hand } = {}) {
  const rx = 31 * (1 - q.s * 0.5), ry = 27 * (1 + q.s * 0.6);
  const by = -ry - 2, top = by - ry, tipH = 14, lean = 7;
  g.ellipse(0, -2, 42 - q.s * 30, 3.2, (nx, ny) => (ny < -0.3 ? C.ink3 : ny < 0.3 ? C.ink2 : C.ink1));
  const arms = [];
  for (const side of [-1, 1]) {
    const ax = side * (rx + 2), ay = by + 6 - side * q.arm * 4;
    arms.push([ax, ay]);
    g.oval(ax, ay, 6, 4, side * (0.6 + q.arm * 0.4), (u, v) => (v < -0.2 ? C.ink4 : C.ink3));
  }
  g.ellipse(0, by, rx, ry, shadeAt);
  g.poly([[-rx * 0.6, by - ry * 0.55], [rx * 0.6, by - ry * 0.55], [lean + 5, top - tipH * 0.45], [lean + 6, top - tipH], [lean, top - tipH * 0.7]],
    (x, y) => shadeAt((x - lean * 0.5) / (rx * 0.75), Math.max(-1, (y - by) / (ry + tipH))));
  for (let i = 0; i <= 40; i++) {
    const a = Math.PI * (1.06 + i * 0.012);
    g.set(Math.cos(a) * rx * 0.8, by + Math.sin(a) * ry * 0.8, C.shine);
    if (i > 8 && i < 32) g.set(Math.cos(a) * rx * 0.74, by + Math.sin(a) * ry * 0.74, C.ink5);
  }
  if (hand) { hand(arms[0]); const [ax, ay] = arms[0]; g.oval(ax, ay, 6, 4, -0.6 - q.arm * 0.4, (u, v) => (v < -0.2 ? C.ink4 : C.ink3)); }
  return { rx, ry, by, top, tipH, lean, arms };
}

// 臉：跟幼體一樣（大眼睛、生氣又委屈的眉毛、嘟嘴＋小虎牙）
function face(g, q, b) {
  const ey = b.by - 4, L = -15, R = 2;
  if (q.hurt) {
    for (const [x, k] of [[L, 0], [R, 1]]) {
      const m = (d) => (k === 0 ? x + d : x + 8 - d);
      for (let i = 0; i < 4; i++) { g.rect(m(i * 2), ey - 3 + i, 2, 2, C.white); g.rect(m(i * 2), ey + 5 - i, 2, 2, C.white); }
    }
  } else if (q.blink) {
    for (const x of [L, R]) g.rect(x, ey + 2, 10, 2, C.white);
  } else {
    for (const x of [L, R]) {
      g.ellipse(x + 5, ey + 1, 5, 6, C.white);
      g.ellipse(x + 3, ey + 2, 3.2, 4.2, C.ink1);
      g.ellipse(x + 3, ey + 3, 1.6, 2, C.iris);
      g.rect(x + 1, ey - 1, 2, 2, C.white);
    }
    g.line(L - 1, ey - 9, L + 9, ey - 6, C.ink0); g.line(L - 1, ey - 8, L + 9, ey - 5, C.ink0);
    g.line(R + 1, ey - 6, R + 11, ey - 9, C.ink0); g.line(R + 1, ey - 5, R + 11, ey - 8, C.ink0);
  }
  g.rect(L - 2, ey + 9, 4, 2, C.blush); g.rect(R + 9, ey + 9, 4, 2, C.blush);
  const mx = -4, my = ey + 12;
  if (q.hurt) g.ellipse(mx + 2, my + 1, 4, 2.5, C.ink0);
  else { g.rect(mx, my, 7, 2, C.ink0); g.rect(mx + 1, my + 2, 5, 1, C.ink0); g.set(mx + 5, my + 2, C.white); }
  return { ey, L, R };
}

function drips(g, q, b, spots) {
  spots.forEach(([nx, ny], i) => {
    const x = Math.round(nx * b.rx), y = Math.round(b.by + ny * b.ry);
    const u = (q.ph * 1.5 + i * 0.29) % 1, len = 2 + Math.floor(u * 5);
    g.ellipse(x, y, 1.4, 1.4, C.ink3);
    g.rect(x - 1, y + 1, 2, len, C.ink3); g.set(x - 1, y + 1, C.ink4);
    if (u > 0.75) g.rect(x - 1, y + len + 3, 2, 2, C.ink4);
  });
}

// ───────── 書頁鎧甲 ─────────
function pageRect(g, x, y, w, h, ang = 0) {
  const c = Math.cos(ang), s = Math.sin(ang), cx = x + w / 2, cy = y + h / 2;
  const P = (u, v) => [cx + u * c - v * s, cy + u * s + v * c];
  g.poly([P(-w / 2, -h / 2), P(w / 2, -h / 2), P(w / 2, h / 2), P(-w / 2, h / 2)], (px, py) => {
    const dx = px - cx, dy = py - cy, u = dx * c + dy * s, v = -dx * s + dy * c;
    if (h / 2 - Math.abs(v) < 1 || w / 2 - Math.abs(u) < 1) return dx + dy < 0 ? C.paperL : C.paperD;
    if (Math.round(v + h) % 3 === 0 && Math.abs(u) < w / 2 - 2) return C.line;
    return C.paper;
  });
}

export function inkKingPageFrame(pose = "idle", t = 0) {
  const q = poseOf(pose, t);
  const g = new Grid(W, H, OX, OY);
  // 羽毛筆（左手拿著，筆尖朝前下方；在身體後面先畫）
  const b = body(g, q, {
    hand: ([ax, ay]) => {
      const a = -2.25 + q.arm * 0.2 + (q.hurt ? 0.5 : 0);   // 往左上舉（朝玩家）
      const ex = ax + Math.cos(a) * 30, ey = ay + Math.sin(a) * 30;
      // 羽毛：從握的地方往上長，兩邊一排一排的羽枝
      for (let i = 4; i <= 30; i++) {
        const x = ax + Math.cos(a) * i, y = ay + Math.sin(a) * i, w = i < 8 ? 0 : Math.min(5, (i - 6) * 0.5) * (i > 26 ? (31 - i) / 5 : 1);
        for (let k = -w; k <= w; k++) g.set(x + Math.cos(a + Math.PI / 2) * k, y + Math.sin(a + Math.PI / 2) * k, k < 0 ? C.paperL : (i + Math.round(k)) % 4 === 0 ? C.paperD : C.paper);
        g.set(x, y, C.line);
      }
      // 筆尖（金屬，往下沾著墨）
      for (let i = 0; i < 7; i++) g.set(ax - Math.cos(a) * i, ay - Math.sin(a) * i, i > 4 ? C.ink1 : C.gold);
      void ex; void ey;
    },
  });
  // 胸甲：肚子一圈書頁（左右稍微斜），中間一顆金鉚釘
  const cy0 = b.by + 12;
  pageRect(g, -26, cy0, 16, 12, 0.25);
  pageRect(g, 10, cy0, 16, 12, -0.25);
  pageRect(g, -10, cy0 + 1, 20, 13, 0);
  for (const x of [-18, 0, 18]) { g.rect(x - 1, cy0 + 4, 2, 2, C.gold); g.set(x - 1, cy0 + 4, C.goldL); }
  // 兩肩疊著書（紅、藍、綠書背＋金色書背線）
  const books = [[C.red, 14], [C.navy, 12], [C.green, 13]];
  for (const side of [-1, 1]) {
    const sx = side * (b.rx - 4), sy = b.by - 6 + (side < 0 ? 0 : 1) - Math.round(side * q.arm * 2);
    books.forEach(([col, w], i) => {
      const x = Math.round(sx - w / 2 + side * i), y = sy - i * 4;
      g.rect(x, y, w, 4, col); g.rect(x, y, w, 1, C.goldL); g.rect(x + 2, y + 1, 1, 2, C.gold); g.rect(x + w - 3, y + 1, 1, 2, C.gold);
      g.rect(x, y + 3, w, 1, C.navyD);
    });
  }
  face(g, q, b);
  drips(g, q, b, [[-0.97, 0.12], [0.97, 0.02], [0.9, 0.3]]);
  // 頭盔：一本攤開的厚書倒蓋在頭上（書脊在上面），跟著晃
  const hx = b.lean - 2 + Math.round(q.tilt * 4), hy = b.top - 6 + (q.hurt ? 3 : 0), tilt = q.tilt * 0.3 + (q.hurt ? 0.35 : 0);
  const R = (x, y) => [hx + x * Math.cos(tilt) - y * Math.sin(tilt), hy + x * Math.sin(tilt) + y * Math.cos(tilt)];
  // 書頁（米色，一層一層）
  g.poly([R(-2, -8), R(2, -8), R(24, 8), R(-24, 8)], (x, y) => (Math.round(y - hy) % 2 ? C.paper : C.paperL));
  // 封面（深藍＋金邊）
  g.poly([R(-1, -11), R(-26, 6), R(-24, 9), R(0, -7)], (x, y) => (x < hx - 22 ? C.gold : C.navy));
  g.poly([R(1, -11), R(26, 6), R(24, 9), R(0, -7)], (x, y) => (x > hx + 22 ? C.goldD : C.navyD));
  g.rect(Math.round(R(0, -11)[0]) - 1, Math.round(R(0, -11)[1]) - 1, 3, 3, C.gold);   // 書脊上的金扣
  g.set(Math.round(R(0, -11)[0]), Math.round(R(0, -11)[1]) - 1, C.goldL);
  // 書籤絲帶垂下來
  const bx = R(10, 8);
  g.rect(Math.round(bx[0]), Math.round(bx[1]), 2, 6 + Math.round(q.tilt * 3), C.red);
  g.outline();
  return g.pixels();
}

// ───────── 齒輪型 ─────────
function gear(g, cx, cy, r, teeth, rot, pal) {
  const R = r + 2;
  for (let y = Math.floor(cy - R); y <= Math.ceil(cy + R); y++)
    for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++) {
      const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      const tooth = Math.cos(teeth * (a - rot)) > 0.2;
      if (d > (tooth ? R : r) + 0.3) continue;
      if (d < Math.max(1.2, r * 0.28)) continue;                                         // 中間的洞
      const spoke = r >= 10 && d < r * 0.72 && d > r * 0.32 && Math.cos(4 * (a - rot)) < 0.55;
      if (spoke) continue;                                                // 輻條之間挖空
      const lit = (-0.6 * dx - 0.7 * dy) / R;
      g.set(x, y, d > r - 1.2 && d <= r + 0.3 ? (lit > 0 ? pal[0] : pal[2]) : lit > 0.25 ? pal[0] : lit > -0.3 ? pal[1] : pal[2]);
    }
}

export function inkKingGearFrame(pose = "idle", t = 0) {
  const q = poseOf(pose, t);
  const g = new Grid(W, H, OX, OY);
  const turn = (t / 4) * Math.PI * 2 / 10;    // 大齒輪慢慢轉（10 齒，4 秒轉一齒）
  const gold = [C.goldL, C.gold, C.goldD], steel = [C.steelL, C.steel, C.steelD];
  // 背後的大齒輪（在身體後面先畫，只露出右上半）
  gear(g, 20, -62, 22, 10, q.hurt ? 0.2 : turn * 4, gold);
  const b = body(g, q);
  // 身上黏著的小齒輪（反著轉）
  gear(g, -20, b.by + 16, 7, 8, -turn * 9, steel);
  gear(g, 14, b.by + 19, 5, 6, turn * 12, gold);
  g.set(14, b.by + 19, C.blue);
  // 頭上插一根鐘的指針（箭頭朝上，當角）
  const hx = b.lean - 10, hy = b.top - 2, a = -1.9 + q.tilt * 0.4 + (q.hurt ? 0.5 : 0);
  for (let i = 0; i < 20; i++) { g.set(hx + Math.cos(a) * i, hy + Math.sin(a) * i, C.gold); g.set(hx + 1 + Math.cos(a) * i, hy + Math.sin(a) * i, C.goldD); }
  const tx = hx + Math.cos(a) * 21, ty = hy + Math.sin(a) * 21;
  g.poly([[tx + Math.cos(a) * 5, ty + Math.sin(a) * 5], [tx + Math.cos(a + 1.6) * 4, ty + Math.sin(a + 1.6) * 4], [tx + Math.cos(a - 1.6) * 4, ty + Math.sin(a - 1.6) * 4]], C.goldL);
  g.rect(hx - 1, hy - 1, 3, 3, C.steel);
  const f = face(g, q, b);
  // 右眼戴的鐘面單片眼鏡（金框＋刻度），鏈子垂到身體
  if (!q.hurt) {
    const mx = f.R + 5, my = f.ey + 1;
    for (let i = 0; i < 40; i++) { const an = (i / 40) * Math.PI * 2; g.set(mx + Math.cos(an) * 7, my + Math.sin(an) * 7, an > 2.4 && an < 5.5 ? C.goldL : C.gold); }
    for (let i = 0; i < 12; i += 3) { const an = (i / 12) * Math.PI * 2; g.set(mx + Math.cos(an) * 8, my + Math.sin(an) * 8, C.goldD); }
    for (let i = 0; i < 10; i++) g.set(mx + 7 + Math.round(i * 0.4), my + 2 + i, i % 2 ? C.gold : C.goldD);
  }
  drips(g, q, b, [[-0.97, 0.12], [-0.86, 0.42], [0.97, 0.02]]);
  g.outline();
  return g.pixels();
}
