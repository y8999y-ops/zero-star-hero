// 戰鬥轉場（企劃書 3.1）：魔法的感覺，對應玩家屬性。
// 進入戰鬥（約 1.1 秒）：
//   ① 墨水從畫面四邊往內湧（敵人的墨水）
//   ② 畫面中央展開屬性色的魔法陣，數字和 ＋－×÷ 繞著轉、往中心收攏（王戰：封印環碎裂）
//   ③ 屬性魔法蓋滿畫面：火＝火焰從下往上竄、水＝浪從左邊捲過來、冰＝霜從四角結過來、森＝葉子旋轉填滿、雷＝閃電劈開
//   ④ 換成戰鬥畫面，從中央圓形打開，邊緣灑出屬性色的光點
// 打贏離開（約 0.7 秒）：光點爆開、圓形收起來 → 換畫面 → 打開。
// 畫在一張蓋住 #app 的低解析度畫布上（每 3 個螢幕像素＝1 格），放大後是像素感。

import { FONTS } from "../../pixelfx/src/core/index.js";
import { ATTRS } from "./data.js";

const PX = 3;
const INK = ["#05040a", "#0f0b1c", "#1c1533", "#2d2350", "#463a78"];
const SYMBOLS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "+", "-", "x", "/", "="];

const hex = (c) => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mix = (a, b, k) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(",")})`; };
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const easeOut = (u) => 1 - (1 - u) ** 3;
// 固定的亂數（每次轉場長得一樣，不會閃爍）
const rand = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function overlay() {
  const app = document.querySelector("#app");
  const c = document.createElement("canvas");
  c.className = "transition";
  // 放在 #app 外面（換畫面會清空 #app），用 fixed 疊在 #app 正上方
  const r = app.getBoundingClientRect();
  Object.assign(c.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  const W = Math.ceil(r.width / PX), H = Math.ceil(r.height / PX);
  c.width = W; c.height = H;
  document.body.append(c);
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  return { c, g, W, H };
}

function glyph(g, ch, x, y, color, k = 1) {
  const gl = FONTS.big.glyphs[ch];
  if (!gl) return;
  g.fillStyle = color;
  gl.rows.forEach((row, j) => row.forEach((on, i) => on && g.fillRect(Math.round(x + i * k), Math.round(y + j * k), k, k)));
}

function ring(g, cx, cy, r, w, color, a0 = 0, a1 = Math.PI * 2) {
  g.fillStyle = color;
  const n = Math.max(24, Math.round(r * 6));
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    for (let k = 0; k < w; k++) g.fillRect(Math.round(cx + Math.cos(a) * (r - k)), Math.round(cy + Math.sin(a) * (r - k)), 1, 1);
  }
}

// ① 墨水：從四邊往內，邊緣是一團一團的墨滴
function drawInk(g, W, H, u) {
  if (u <= 0) return;
  const depth = easeOut(u) * Math.max(W, H) * 0.42;
  for (let layer = 0; layer < 3; layer++) {
    g.fillStyle = INK[2 - layer];
    const d = depth - layer * 5;
    if (d <= 0) continue;
    for (let i = 0; i < 40; i++) {
      const r = 4 + rand(i + layer * 50) * 7;
      const s = i / 40;
      const blob = (x, y) => { g.beginPath(); g.arc(Math.round(x), Math.round(y), r + d * 0.15, 0, 7); g.fill(); };
      blob(s * W, d * (0.6 + rand(i) * 0.5) - r);           // 上
      blob(s * W, H - d * (0.6 + rand(i + 9) * 0.5) + r);   // 下
      blob(d * (0.5 + rand(i + 3) * 0.5) - r, s * H);       // 左
      blob(W - d * (0.5 + rand(i + 7) * 0.5) + r, s * H);   // 右
    }
    g.fillRect(0, 0, W, d * 0.6); g.fillRect(0, H - d * 0.6, W, d * 0.6);
    if (layer === 0) {
      // 墨滴的亮邊（光澤），在暗的畫面上也看得出墨水在湧進來
      g.fillStyle = INK[4];
      for (let i = 0; i < 40; i++) {
        const s2 = i / 40, r = 4 + rand(i) * 7;
        g.fillRect(Math.round(s2 * W), Math.round(d * (0.6 + rand(i) * 0.5) + d * 0.15 - 2), 3, 1);
        g.fillRect(Math.round(s2 * W), Math.round(H - d * (0.6 + rand(i + 9) * 0.5) - d * 0.15 + r * 0.2), 3, 1);
      }
    }
    g.fillRect(0, 0, d * 0.5, H); g.fillRect(W - d * 0.5, 0, d * 0.5, H);
  }
}

// ② 魔法陣：兩圈環＋刻度＋繞著轉的數字符號，數字往中心收攏
function drawCircle(g, W, H, t, col, colL, boss) {
  const u = seg(t, 0.12, 0.45), close = seg(t, 0.4, 0.62);
  if (u <= 0 || close >= 1) return;
  const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.34 * easeOut(u) * (1 - close * 0.6);
  const spin = t * 3;
  ring(g, cx, cy, R, 2, col, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * u);
  ring(g, cx, cy, R * 0.72, 1, colL, Math.PI / 2, Math.PI / 2 + Math.PI * 2 * u);
  // 刻度
  g.fillStyle = colL;
  for (let i = 0; i < 24 * u; i++) {
    const a = (i / 24) * Math.PI * 2 + spin * 0.3;
    g.fillRect(Math.round(cx + Math.cos(a) * R * 0.86), Math.round(cy + Math.sin(a) * R * 0.86), 1, 2);
  }
  // 中間的星形（兩個三角形）
  if (u > 0.5) {
    g.strokeStyle = col; g.lineWidth = 1;
    for (const off of [0, Math.PI]) {
      g.beginPath();
      for (let k = 0; k <= 3; k++) {
        const a = off - Math.PI / 2 + (k * Math.PI * 2) / 3 - spin * 0.2;
        const x = Math.round(cx + Math.cos(a) * R * 0.62) + 0.5, y = Math.round(cy + Math.sin(a) * R * 0.62) + 0.5;
        k ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
    }
  }
  // 數字與符號：沿外圈轉，最後往中心收
  SYMBOLS.forEach((ch, i) => {
    const a = (i / SYMBOLS.length) * Math.PI * 2 + spin;
    const rr = R * (1.12 - close * 1.1);
    if (i / SYMBOLS.length > u + 0.1) return;
    glyph(g, ch, cx + Math.cos(a) * rr - 2, cy + Math.sin(a) * rr - 3, i % 3 ? colL : "#ffffff");
  });
  // 王戰：外面多一圈封印環，裂成一段一段往外飛、翻轉
  if (boss) {
    const k = seg(t, 0.32, 0.62), R2 = R * 1.3 + 6;
    for (let i = 0; i < 12; i++) {
      const a0 = (i / 12) * Math.PI * 2 + 0.05, a1 = a0 + (Math.PI * 2) / 12 - 0.12;
      const mid = (a0 + a1) / 2, push = k * (30 + rand(i) * 40), spinA = k * (rand(i + 3) - 0.5) * 2;
      ring(g, cx + Math.cos(mid) * push, cy + Math.sin(mid) * push, R2, 3, k > 0 ? mix("#d8d0ff", "#463a78", k) : "#b6a8f0", a0 + spinA, a1 + spinA);
    }
    if (k > 0 && k < 0.25) { g.fillStyle = "#ffffff"; g.globalAlpha = 1 - k * 4; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
  }
  // 中心的光
  g.fillStyle = "#ffffff";
  const core = 1 + close * 6;
  g.fillRect(Math.round(cx - core / 2), Math.round(cy - core / 2), Math.round(core), Math.round(core));
}

// ③ 屬性魔法蓋滿畫面。cover：0～1 蓋住的程度
function drawWipe(g, W, H, attr, cover, t, pal) {
  if (cover <= 0) return;
  const [c0, c1, c2, c3] = pal;
  if (attr === "fire") {
    // 火焰從下往上竄：一根根火舌，越上面越亮
    const top = H * (1 - cover * 1.25);
    for (let x = 0; x < W; x += 2) {
      const h = top + Math.sin(x * 0.35 + t * 18) * 6 + rand(x) * 10;
      g.fillStyle = c0; g.fillRect(x, h, 2, H - h);
      g.fillStyle = c1; g.fillRect(x, h + 6, 2, H - h);
      g.fillStyle = c2; g.fillRect(x, h + 16, 2, H - h);
      g.fillStyle = c3; g.fillRect(x, h + 30, 2, H - h);
    }
    g.fillStyle = c3;
    for (let i = 0; i < 30; i++) g.fillRect(Math.round(rand(i) * W), Math.round(top - 10 - ((t * 120 + rand(i + 5) * 60) % 60)), 1, 2);
  } else if (attr === "water") {
    // 浪從左邊捲過來，浪頭有白色浪花
    const front = W * cover * 1.25;
    for (let y = 0; y < H; y += 2) {
      const x = front + Math.sin(y * 0.12 + t * 10) * 8 + Math.sin(y * 0.31) * 3;
      g.fillStyle = c0; g.fillRect(0, y, x, 2);
      g.fillStyle = c1; g.fillRect(0, y, x - 6, 2);
      g.fillStyle = c2; g.fillRect(0, y, x - 18, 2);
      g.fillStyle = "#ffffff"; g.fillRect(x - 2, y, 2, 2);
    }
    g.fillStyle = "#e8f6ff";
    for (let i = 0; i < 24; i++) { const y = rand(i) * H; g.fillRect(Math.round(front + 4 + rand(i + 2) * 12), Math.round(y), 2, 2); }
  } else if (attr === "ice") {
    // 霜從四角往中間結：一片片尖尖的冰晶，越裡面越亮，最後結滿整個畫面
    const reach = Math.hypot(W, H) * 0.75 * cover;
    const corners = [[0, 0], [W, 0], [0, H], [W, H]];
    for (const [cx, cy] of corners) {
      const base = Math.atan2(H / 2 - cy, W / 2 - cx);
      for (let layer = 0; layer < 3; layer++) {
        g.fillStyle = [c1, c0, c3][layer];
        for (let i = 0; i < 22; i++) {
          const a = base + (rand(i * 7 + cx + layer) - 0.5) * 2.0;
          const len = reach * (0.3 + rand(i * 3 + cy + layer * 11) * 0.45) * (1 - layer * 0.2);
          const w = 0.16 + rand(i + layer) * 0.12;
          g.beginPath();
          g.moveTo(cx + Math.cos(a - w) * len * 0.35, cy + Math.sin(a - w) * len * 0.35);
          g.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
          g.lineTo(cx + Math.cos(a + w) * len * 0.35, cy + Math.sin(a + w) * len * 0.35);
          g.lineTo(cx, cy);
          g.fill();
        }
      }
    }
    g.fillStyle = "#ffffff";
    for (let i = 0; i < 26; i++) {
      const x = rand(i + 40) * W, y = rand(i + 80) * H;
      if (Math.min(Math.hypot(x, y), Math.hypot(W - x, y), Math.hypot(x, H - y), Math.hypot(W - x, H - y)) < reach * 0.8) {
        g.fillRect(Math.round(x) - 1, Math.round(y), 3, 1); g.fillRect(Math.round(x), Math.round(y) - 1, 1, 3);
      }
    }
    if (cover > 0.82) { g.globalAlpha = (cover - 0.82) * 5.5; g.fillStyle = c0; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
  } else if (attr === "forest") {
    // 葉子旋轉著填滿畫面
    const n = Math.round(300 * cover);
    for (let i = 0; i < n; i++) {
      const a = rand(i) * Math.PI * 2 + t * 4 * (rand(i + 1) > 0.5 ? 1 : -1);
      const d = (1 - cover) * Math.max(W, H) * 0.7 + rand(i + 2) * Math.max(W, H) * 0.65;
      const x = W / 2 + Math.cos(a) * d * 0.6, y = H / 2 + Math.sin(a) * d;
      g.fillStyle = [c0, c1, c2][i % 3];
      g.beginPath(); g.ellipse(Math.round(x), Math.round(y), 12, 6, a, 0, 7); g.fill();
      g.fillStyle = [c1, c2, c0][i % 3]; g.fillRect(Math.round(x - Math.cos(a) * 8), Math.round(y - Math.sin(a) * 8), Math.round(Math.cos(a) * 16) || 1, 1);
      g.fillStyle = c3; g.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    if (cover > 0.75) { g.globalAlpha = (cover - 0.75) * 4; g.fillStyle = c0; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
  } else {
    // 雷：一道閃電斜劈，畫面從閃電兩邊白光漲滿
    const k = cover;
    g.fillStyle = c0; g.globalAlpha = clamp(k * 1.4); g.fillRect(0, 0, W, H); g.globalAlpha = 1;
    // 主閃電：鋸齒很尖、每一段方向亂跳；再分出兩條支線；閃電會閃爍
    const flick = Math.floor(t * 30) % 3;
    const bolt = (x, y, steps, dx, seed, w) => {
      const pts = [[x, y]];
      for (let i = 0; i < steps; i++) { x += (rand(i + seed) - 0.5) * 34 + dx; y += H / 10; pts.push([x, y]); }
      for (const [lw, col] of [[w + 6 * k, c1], [w, "#ffffff"]]) {
        g.strokeStyle = col; g.lineWidth = lw; g.lineJoin = "miter";
        g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.stroke();
      }
      return pts;
    };
    const main = bolt(W * 0.62, -4, 11, -3, 20 + flick, 3 + k * 6);
    bolt(main[3][0], main[3][1], 4, -9, 50 + flick, 2);
    bolt(main[6][0], main[6][1], 4, 8, 80 + flick, 2);
    if (k > 0.6) { g.globalAlpha = (k - 0.6) * 2.5; g.fillStyle = c1; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
  }
}

// ④ 從中央圓形打開，邊緣灑光點
function drawIris(g, W, H, open, col, colL) {
  const R = Math.hypot(W, H) * 0.6 * easeOut(open);
  const cx = W / 2, cy = H / 2;
  g.save();
  g.beginPath(); g.rect(0, 0, W, H); g.arc(cx, cy, R, 0, Math.PI * 2, true);
  g.fillStyle = INK[1]; g.fill("evenodd");
  g.restore();
  ring(g, cx, cy, R, 2, col);
  g.fillStyle = colL;
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2 + open * 2;
    const d = R + 3 + rand(i) * 10 * (1 - open);
    g.fillRect(Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d), 2, 2);
  }
}

const PALETTES = {
  fire: ["#8c1d1c", "#e0561e", "#ffae35", "#ffe27a"],
  water: ["#0e2e5a", "#1c76bc", "#78ccf4", "#c4ecff"],
  ice: ["#cfeeff", "#9bdcff", "#f4fbff", "#ffffff"],
  forest: ["#225224", "#4f9a3a", "#7cc048", "#e4ffb0"],
  thunder: ["#2b1a5e", "#7c6cff", "#c8f0ff", "#ffffff"],
};

function run(duration, drawFrame) {
  return new Promise((res) => {
    const o = overlay();
    const t0 = performance.now();
    const loop = (now) => {
      const t = (now - t0) / 1000;
      o.g.clearRect(0, 0, o.W, o.H);
      const keep = drawFrame(o, Math.min(t, duration));
      if (t < duration || keep) requestAnimationFrame(loop);
      else { o.c.remove(); res(); }
    };
    requestAnimationFrame(loop);
  });
}

/**
 * 進入戰鬥的轉場。swap()：畫面全蓋住時呼叫（在這裡建立戰鬥畫面）。
 * attr：玩家屬性；boss：王戰多一段封印碎裂。
 */
export async function battleIn(attr, swap, { boss = false } = {}) {
  const col = ATTRS[attr]?.color ?? "#8a7cff", colL = mix(col, "#ffffff", 0.5);
  const pal = PALETTES[attr] ?? PALETTES.thunder;
  const T_COVER = boss ? 0.95 : 0.78, T_END = T_COVER + 0.42;
  let swapped = false, swapDone = null;
  await run(T_END, ({ g, W, H }, t) => {
    if (t < T_COVER) {
      drawInk(g, W, H, seg(t, 0, 0.3));
      drawCircle(g, W, H, t * (0.78 / T_COVER), col, colL, boss);
      drawWipe(g, W, H, attr, seg(t, T_COVER - 0.3, T_COVER), t, pal);
      return false;
    }
    if (!swapped) { swapped = true; swapDone = Promise.resolve(swap()).then(() => (swapDone = true)); }
    if (swapDone !== true) { g.fillStyle = pal[0]; g.fillRect(0, 0, W, H); return true; }   // 等戰鬥畫面準備好
    drawIris(g, W, H, seg(t, T_COVER, T_END), col, colL);
    return false;
  });
}

/** 離開戰鬥（打贏或結束）：光點爆開、圓形收起 → swap() → 打開 */
export async function battleOut(attr, swap) {
  const col = ATTRS[attr]?.color ?? "#8a7cff", colL = mix(col, "#ffffff", 0.5);
  let swapped = false;
  await run(0.75, ({ g, W, H }, t) => {
    if (t < 0.35) {
      // 光點從中央爆開，圓形收起來
      const u = seg(t, 0, 0.35);
      g.fillStyle = colL;
      for (let i = 0; i < 50; i++) {
        const a = rand(i) * Math.PI * 2, d = easeOut(u) * Math.max(W, H) * (0.3 + rand(i + 1) * 0.5);
        g.fillRect(Math.round(W / 2 + Math.cos(a) * d), Math.round(H / 2 + Math.sin(a) * d), 2, 2);
      }
      drawIris(g, W, H, 1 - u, col, colL);
    } else {
      if (!swapped) { swapped = true; swap(); }
      drawIris(g, W, H, seg(t, 0.35, 0.75), col, colL);
    }
    return false;
  });
}
