// 見習魔數師（玩家）：女生／男生兩種外觀，面向右（怪物在右邊）。
// 一格一格畫在小格子上：先填色（色票索引），最後自動描外框——外框只用黑色，內線用同色系的暗色（專案規則）。
// 光從左上來：左上亮、右下暗。帽子、披肩滾邊、魔杖水晶跟著屬性換色，其他顏色固定。
// 全身 16 色以內（黑外框＋15 色）。
//
// heroFrame(look, pose, t, attrHex) → { w, h, ox, oy, px: Uint32Array（0xAABBGGRR，0＝透明） , glow: [x, y]（水晶位置） }
// pose：idle 待機（呼吸、帽尖晃、眨眼）、cast 施法（舉杖往前）、hurt 受傷（往後仰、閉眼）、win 勝利（舉杖跳）

export const W = 32, H = 50, OX = 15, OY = 48;   // 格子大小與腳底原點

// ── 色票 ──
const FIXED = {
  skin: "#ffd9b8", skinS: "#e8a98a", eye: "#2a2248", white: "#ffffff", cheek: "#ff9a9a",
  robe: "#323a72", robeS: "#1f2550", collar: "#f4f0ff",
  gold: "#ffd35c", goldS: "#b9822e",          // 帽帶；goldS 也拿來當魔杖木頭
};
const HAIR = { girl: ["#a5563a", "#6e3326"], boy: ["#5a3f33", "#3a2822"] };   // 暗色也當鞋子

const hex = (c) => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mixHex = (a, b, k) => { const A = hex(a), B = hex(b); return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, "0")).join(""); };
const toU32 = (c) => { const [r, g, b] = hex(c); return (0xff << 24) | (b << 16) | (g << 8) | r; };

export function palette(look, attrHex) {
  const [hair, hairS] = HAIR[look];
  return {
    ...FIXED, hair, hairS,
    hat: attrHex, hatS: mixHex(attrHex, "#1a1030", 0.45), hatL: mixHex(attrHex, "#ffffff", 0.4),
  };
}

// ── 小格子畫筆 ──
class Grid {
  constructor() { this.c = new Array(W * H).fill(null); }
  set(x, y, col) { x = Math.round(x) + OX; y = Math.round(y) + OY; if (x >= 0 && y >= 0 && x < W && y < H && col) this.c[y * W + x] = col; }
  get(x, y) { x += OX; y += OY; return x >= 0 && y >= 0 && x < W && y < H ? this.c[y * W + x] : null; }
  rect(x, y, w, h, col) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, col); }
  // 實心橢圓，fn(nx, ny) 回傳顏色（nx、ny 是 -1～1 的位置，拿來分明暗）
  ellipse(cx, cy, rx, ry, fn) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x - cx) / (rx + 0.5), ny = (y - cy) / (ry + 0.5);
        if (nx * nx + ny * ny <= 1) this.set(x, y, typeof fn === "function" ? fn(nx, ny) : fn);
      }
  }
  // 多邊形（掃描線），fn(x, y) 回傳顏色
  poly(pts, fn) {
    const ys = pts.map((p) => p[1]), y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
    for (let y = y0; y <= y1; y++) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
        if ((ay <= y + 0.5 && by > y + 0.5) || (by <= y + 0.5 && ay > y + 0.5)) xs.push(ax + ((y + 0.5 - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2)
        for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) this.set(x, y, typeof fn === "function" ? fn(x, y) : fn);
    }
  }
  line(x0, y0, x1, y1, col) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) this.set(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, col);
  }
  // 外框：透明格子只要上下左右碰到有顏色的格子，就塗黑（外輪廓一律黑色）
  outline() {
    const out = this.c.slice();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (this.c[y * W + x]) continue;
      const n = (dx, dy) => { const X = x + dx, Y = y + dy; return X >= 0 && Y >= 0 && X < W && Y < H && this.c[Y * W + X] && this.c[Y * W + X] !== "#000000"; };
      if (n(1, 0) || n(-1, 0) || n(0, 1) || n(0, -1)) out[y * W + x] = "#000000";
    }
    this.c = out;
  }
}

// ── 姿勢參數 ──
function poseOf(pose, t) {
  const ph = (t % 1.6) / 1.6;
  const q = { bob: 0, lean: 0, tip: 0, blink: false, eyesClosed: false, wand: "low", hop: 0, mouth: "smile" };
  if (pose === "idle") {
    q.bob = ph < 0.5 ? 0 : 1;                       // 吸氣時頭和帽子往上 1 格
    q.tip = Math.round(Math.sin(ph * Math.PI * 2 - 0.8));   // 帽尖慢半拍晃
    q.blink = ph > 0.86 && ph < 0.93;
  } else if (pose === "cast") {
    q.lean = 1; q.tip = -1; q.wand = "forward"; q.mouth = "open";
  } else if (pose === "hurt") {
    q.lean = -2; q.tip = 2; q.bob = -1; q.eyesClosed = true; q.wand = "low"; q.mouth = "ouch";
  } else if (pose === "win") {
    q.hop = ph < 0.5 ? -2 : 0; q.wand = "up"; q.tip = ph < 0.5 ? 1 : 0; q.mouth = "open";
  }
  return q;
}

export function heroFrame(look, pose = "idle", t = 0, attrHex = "#8a7cff") {
  const P = palette(look, attrHex);
  const q = poseOf(pose, t);
  const g = new Grid();
  const L = q.lean, Y = q.hop;          // 整個上半身往前／往後、跳起
  const hy = -q.bob + Y;                // 頭與帽子的上下
  const girl = look === "girl";

  // ── 後面的頭髮（雙馬尾／翹髮），畫在最底層 ──
  if (girl) {
    // 雙馬尾：上下兩束，中間用屬性色髮圈隔開
    g.ellipse(-7 + L, -21 + hy, 2, 2.2, (nx, ny) => (nx < 0.1 && ny < 0.2 ? P.hair : P.hairS));
    g.ellipse(-8.5 + L, -16 + hy, 1.8, 2.6, (nx, ny) => (nx < 0 && ny < 0 ? P.hair : P.hairS));
    g.rect(-8 + L, -19 + hy, 2, 1, P.hat);
  }

  // ── 鞋子、袍子 ──
  g.rect(-5, -2 + Y, 4, 2, P.hairS);
  g.rect(1, -2 + Y, 4, 2, P.hairS);
  g.rect(-5, -2 + Y, 2, 1, P.hair);          // 鞋面受光
  g.rect(1, -2 + Y, 2, 1, P.hair);
  const top = -13 + Y;
  g.poly([[-5 + L, top], [5 + L, top], [7, -2 + Y], [-7, -2 + Y]], (x, y) => (x >= 4 + (y - top) * 0.15 ? P.robeS : P.robe));
  g.line(1 + L, top + 2, 1, -4 + Y, P.robeS);           // 前襟（內線用暗色，不用黑）
  g.rect(-7, -3 + Y, 14, 1, P.hat);                     // 袍子下襬滾邊＝屬性色
  g.rect(-7, -3 + Y, 3, 1, P.hatL);

  // ── 披肩（女生）／斗篷領（男生） ──
  if (girl) {
    g.ellipse(L, -12 + Y, 6.5, 2.6, (nx, ny) => (ny > 0.35 ? P.hatS : nx < -0.2 ? P.hatL : P.hat));
    g.rect(-1 + L, -10 + Y, 2, 2, P.gold);                // 胸前蝴蝶結
    g.set(L, -10 + Y, P.goldS);
  } else {
    g.poly([[-6 + L, -14 + Y], [6 + L, -14 + Y], [5 + L, -10 + Y], [-7 + L, -9 + Y]], (x) => (x < -3 + L ? P.hatL : x > 3 + L ? P.hatS : P.hat));
    g.rect(-2 + L, -13 + Y, 4, 1, P.collar);
  }

  // ── 手與魔杖（在身體前面那隻手） ──
  let hx = 5 + L, hyHand = -7 + Y, tip;
  if (q.wand === "forward") { hx = 7 + L; hyHand = -10 + Y; tip = [13 + L, -12 + Y]; }
  else if (q.wand === "up") { hx = 6 + L; hyHand = -13 + Y; tip = [9 + L, -21 + Y]; }
  else tip = [9 + L, -13 + Y];
  // 袖子：從肩膀接到手，手才不會飄在空中
  const sx = 3 + L, sy = -12 + Y;
  // 袖子用屬性色（跟披肩、斗篷同一塊布），在深色袍子上才看得到
  g.line(sx, sy, hx - 1, hyHand - 1, P.hat); g.line(sx, sy + 1, hx - 1, hyHand, P.hat);
  g.line(sx, sy + 2, hx - 1, hyHand + 1, P.hatS);
  g.set(hx - 1, hyHand - 1, P.hatL);
  g.line(hx, hyHand, tip[0], tip[1], P.goldS);          // 木杖
  g.rect(hx - 1, hyHand - 1, 2, 2, P.skin);             // 小手
  g.set(hx, hyHand, P.skinS);
  g.rect(tip[0] - 1, tip[1] - 1, 2, 2, P.hatL);         // 杖頭數晶
  g.set(tip[0], tip[1] - 1, P.white);

  // ── 頭 ──
  const cx = 0.5 + L, cy = -20 + hy;
  g.ellipse(cx, cy, 6, 5.6, (nx, ny) => (nx > 0.62 || ny > 0.72 ? P.skinS : P.skin));
  // 臉（面向右，五官偏右）
  if (q.eyesClosed) { // ＞＜ 閉眼
    g.set(cx - 0.5, cy - 0.5, P.eye); g.set(cx + 0.5, cy + 0.5, P.eye); g.set(cx - 0.5, cy + 1.5, P.eye);
    g.set(cx + 3.5, cy - 0.5, P.eye); g.set(cx + 2.5, cy + 0.5, P.eye); g.set(cx + 3.5, cy + 1.5, P.eye);
  } else if (q.blink) { g.rect(cx - 0.5, cy + 1, 2, 1, P.eye); g.rect(cx + 2.5, cy + 1, 2, 1, P.eye); }
  else {
    // 大眼睛：2×2，左上一格反光
    g.rect(cx - 0.5, cy - 0.5, 2, 2, P.eye); g.rect(cx + 2.5, cy - 0.5, 2, 2, P.eye);
    g.set(cx - 0.5, cy - 0.5, P.white); g.set(cx + 2.5, cy - 0.5, P.white);
  }
  g.set(cx - 2, cy + 2, P.cheek); g.set(cx + 4.5, cy + 2, P.cheek);
  if (q.mouth === "open") g.rect(cx + 1, cy + 3, 2, 1, P.cheek);
  else if (q.mouth === "ouch") g.rect(cx + 1, cy + 3, 2, 1, P.eye);
  else g.set(cx + 1.5, cy + 3, P.skinS);

  // ── 頭髮（瀏海） ──
  if (girl) {
    g.poly([[cx - 6, cy - 2], [cx - 5, cy - 5.5], [cx + 6, cy - 5.5], [cx + 6.5, cy - 3], [cx + 3, cy - 2.5], [cx + 1.5, cy - 1.5], [cx - 1, cy - 2.5], [cx - 5, cy + 2]],
      (x, y) => (y < cy - 4 && x < cx + 2 ? P.hair : P.hairS));
    g.ellipse(cx - 5.5, cy + 1, 1.2, 2.2, P.hairS);      // 鬢角
  } else {
    g.poly([[cx - 6, cy - 1], [cx - 5.5, cy - 5.5], [cx + 6, cy - 5.5], [cx + 6.5, cy - 2.5], [cx + 4, cy - 3], [cx + 2, cy - 1.8], [cx, cy - 3], [cx - 4, cy + 1.5]],
      (x, y) => (y < cy - 4 && x < cx + 2 ? P.hair : P.hairS));
    g.line(cx - 6, cy - 3, cx - 8.5, cy - 4.5, P.hair); // 翹髮
    g.set(cx - 8.5, cy - 5, P.hairS);
  }

  // ── 帽子 ──
  const by = cy - 5;                                    // 帽簷高度
  g.ellipse(cx, by, 9, 1.6, (nx, ny) => (ny > 0.2 ? P.hatS : nx < -0.4 ? P.hatL : P.hat));
  if (girl) {
    // 圓頂大帽，帽尖短短往後勾
    // 圓圓的大帽子：寬帽冠，上面軟軟地往後垂下一個帽尖
    const shade = (x, y) => (x < cx - 2.5 + (by - y) * 0.2 ? P.hatL : x > cx + 2.5 - (by - y) * 0.1 ? P.hatS : P.hat);
    g.poly([[cx - 6, by - 1], [cx + 6, by - 1], [cx + 4.5, by - 6], [cx + 1.5, by - 9], [cx - 2.5, by - 9], [cx - 5, by - 6]], shade);
    // 帽尖：從帽冠頂端往左後方垂下，越往尖端越細
    const tx = cx - 6.5 - q.tip * 0.7;
    g.poly([[cx - 3, by - 8.5], [cx + 1.5, by - 9], [cx - 1, by - 11], [tx, by - 10], [tx - 0.5, by - 8.5]], (x, y) => (y < by - 10 ? P.hatL : P.hat));
    g.set(tx - 0.5, by - 8, P.hatS);
    g.rect(cx - 5.5, by - 2, 11, 2, P.gold);               // 帽帶
    g.rect(cx + 2.5, by - 2, 3, 2, P.goldS);
    g.set(cx + 2, by - 6, P.gold);                         // 帽子上的星
    g.set(cx + 1, by - 5, P.gold); g.set(cx + 3, by - 5, P.gold); g.set(cx + 2, by - 4, P.gold);
  } else {
    // 尖頂帽：往上收尖、帽尖往後歪
    const tipX = cx - 5 - q.tip, tipY = by - 15;
    g.poly([[cx - 5.5, by - 1], [cx + 5.5, by - 1], [cx + 1.5, by - 9], [tipX, tipY], [cx - 2.5, by - 8]],
      (x, y) => (x < cx - 2 + (by - y) * 0.15 ? P.hatL : x > cx + 2.5 - (by - y) * 0.25 ? P.hatS : P.hat));
    g.rect(cx - 5, by - 3, 10, 2, P.gold);
    g.rect(cx + 2, by - 3, 3, 2, P.goldS);
    g.set(tipX, tipY, P.hatL);
  }

  g.outline();
  const px = new Uint32Array(W * H);
  for (let i = 0; i < px.length; i++) if (g.c[i]) px[i] = toU32(g.c[i]);
  return { w: W, h: H, ox: OX, oy: OY, px, glow: [tip[0] + OX, tip[1] + OY], colors: new Set(g.c.filter(Boolean)).size };
}
