// 背包左欄：星星站在中間，身上的 7 件裝備在外圈的軌道上慢慢繞（使用者 2026-11-05：想像原神那樣，看得到自己、有動態特效）
// 照 pixelfx skill：參考 arcane/rune-circle（軌道分前後兩半、兩顆追逐的亮點）、holy/divine-shield（轉動的經線）、
//   ice/ice-crystal（光點繞著轉）——只學做法。草稿：game/tools/drafts/heroorbit.mjs
// 畫布是 CSS 的一半大（放大 2 倍顯示，像素跟其他 UI 一樣大）。
// drawOrbit(frame, t, o, half)：o = { cx, cy, rx, ry, slots: [{ a(角度), col(稀有度顏色或 null) }] }，half = "back" | "front"
const TAU = Math.PI * 2;
const hexC = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const pack = ([r, g, b]) => (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const hash = (i, k) => { let h = (i * 374761393 + k * 668265263) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
// 軌道的顏色：星星的金色（暗 → 白）
const GOLD = ["#3a2a5a", "#7a5a9a", "#c8a050", "#ffd860", "#fff2b0", "#ffffff"].map((h) => pack(hexC(h)));
const GOLD_RGB = hexC("#ffd860");

export function drawOrbit(frame, t, o, half) {
  const W = frame.w, H = frame.h, C = frame.color, L = frame.light;
  const put = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H) C[y * W + x] = c; };
  const glow = (x, y, r, rgb, a) => {
    const cx = Math.round(x), cy = Math.round(y);
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const X = cx + dx, Y = cy + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      const f = 1 - Math.hypot(dx, dy) / (r + 0.5); if (f <= 0) continue;
      const i = Y * W + X, d = L[i], k = f * f * a;
      L[i] = (0xff000000 | (Math.min(255, ((d >>> 16) & 255) + rgb[2] * k) << 16) | (Math.min(255, ((d >>> 8) & 255) + rgb[1] * k) << 8) | Math.min(255, (d & 255) + rgb[0] * k)) >>> 0;
    }
  };
  const { cx, cy, rx, ry } = o, front = half === "front";
  const isFront = (g) => Math.sin(g) >= 0;   // 下半圈（離我們近）畫在星星前面
  const at = (g, r = 1) => [cx + Math.cos(g) * rx * r, cy + Math.sin(g) * ry * r];
  const gap = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  if (!front) glow(cx, cy, 30, GOLD_RGB, 0.22 + 0.06 * Math.sin(t * 2));   // 星星身後一團柔光

  // ---- 外圈軌道：細的點線，兩顆追逐的亮點拖著尾巴（rune-circle 的做法）；遠的那半暗一階
  const chase = t * 0.9, N = Math.round((rx + ry) * 3.2);
  for (let i = 0; i < N; i++) {
    const g = (i / N) * TAU;
    if (isFront(g) !== front) continue;
    const d = Math.min(gap(g, chase), gap(g, chase + Math.PI)), behind = ((chase - g) % TAU + TAU) % TAU;
    const [x, y] = at(g);
    if (d < 0.05) { put(x, y, GOLD[5]); glow(x, y, 3, GOLD_RGB, 0.6); continue; }
    const TL = 0.6, tail = behind < TL || (behind > Math.PI && behind < Math.PI + TL);   // 亮點後面那一段（第 2 輪：尾巴 0.9 → 0.6，比較俐落）
    if (tail) { const k = 1 - (behind % Math.PI) / TL; put(x, y, k > 0.6 ? GOLD[4] : k > 0.3 ? GOLD[3] : GOLD[2]); if (k > 0.5) glow(x, y, 2, GOLD_RGB, 0.25 * k); continue; }
    if (i % 3 === 0) put(x, y, front ? GOLD[2] : GOLD[1]);
  }
  // ---- 內圈：腳下一個斜的小光環（地面感），慢慢轉的四個亮點
  const fx = cx, fy = o.feet ?? cy + 22, frx = 20, fry = 5;   // 第 2 輪：對齊放大後星星的腳
  for (let i = 0; i < 48; i++) {
    const g = (i / 48) * TAU;
    if (isFront(g) !== front) continue;
    const x = fx + Math.cos(g) * frx, y = fy + Math.sin(g) * fry, lit = [0, 1, 2, 3].some((q) => gap(g, t * 1.6 + (q * TAU) / 4) < 0.18);
    put(x, y, lit ? GOLD[4] : front ? GOLD[2] : GOLD[1]);
    if (lit) glow(x, y, 2, GOLD_RGB, 0.3);
  }
  // ---- 每個裝備格背後一圈光（稀有度顏色，慢慢呼吸）；空格沒有
  if (!front) for (const s of o.slots) {
    if (!s.col) continue;
    const [x, y] = at(s.a), rgb = hexC(s.col);
    glow(x, y, 13, rgb, 0.28 + 0.1 * Math.sin(t * 2.2 + s.a * 3));
  }
  // ---- 光點：從星星腳下往上飄，繞著星星轉（前後分層）
  for (let i = 0; i < 10; i++) {
    const life = 2.2 + hash(i, 3) * 1.4, age = (t + hash(i, 4) * life) % life, e = age / life;
    const g = hash(i, 5) * TAU + age * (1.2 + hash(i, 6)), r = 10 + hash(i, 7) * 10;
    if (isFront(g) !== front) continue;
    const x = cx + Math.cos(g) * r, y = fy - age * 14 + Math.sin(g) * 3, k = Math.min(1, e * 5, (1 - e) * 3);
    if (k < 0.2) continue;
    put(x, y, front ? (k > 0.6 ? GOLD[5] : GOLD[4]) : GOLD[2]);
    if (front) glow(x, y, 2, GOLD_RGB, 0.35 * k);
  }
}

/** 第 2 輪：星星畫 2 倍大（原本跟裝備格差不多大，不像主角）——把小畫布的像素放大 2 倍貼上去，腳底對齊 (cx, bottom) */
export function blit2x(frame, src, cx, bottom) {
  const W = frame.w, H = frame.h, ox = Math.round(cx - src.w), oy = Math.round(bottom - src.h * 2);
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
    const c = src.color[y * src.w + x];
    if (!(c >>> 24)) continue;
    for (let b = 0; b < 2; b++) for (let a = 0; a < 2; a++) { const X = ox + x * 2 + a, Y = oy + y * 2 + b; if (X >= 0 && Y >= 0 && X < W && Y < H) frame.color[Y * W + X] = c; }
  }
}
