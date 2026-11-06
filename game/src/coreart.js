// 魔物核（使用者 2026-11-06：要很明顯、大一點，光效和特效分開設計；長按吸收鍵時有特殊特效）
// 照 pixelfx skill：參考 arcane/arcane-orb（漂浮的玻璃球、前後兩半的軌道環、地上的光）、
//   arcane/spell-charge（蓄力：光環一圈圈往內收、光點被吸進來）、pickups/crystal-shard（光從裡面一脈一脈透出來）——只學做法。
//   草稿：game/tools/drafts/coreart.mjs
// 畫法分三層：
//   本體（顏色層）：15×15 的結晶球，外框最暗、左上亮右下暗、白色高光；裡面是那種魔物的記號（史萊姆＝一滴黏液、鐵罐＝螺絲、蝙蝠＝一對翅膀）
//   光效（光層）：球身柔光一呼一吸、地上一圈扁扁的光
//   特效：小光點繞著球轉（繞到後面變暗）、偶爾一顆往上飄；長按時球浮高、記號轉、光環往內收、幾道光從球拉到主角身上
import { hex } from "../../pixelfx/src/core/index.js";

const TAU = Math.PI * 2;
const P = (c) => hex(c) >>> 0;
// 每個形態的色階（暗 → 白），跟吸收時的爆光同一組
export const CORE_PAL = {
  slime: ["#0c2010", "#1a4a20", "#2a8a3a", "#4cc04a", "#8ee86a", "#d4ffb0", "#ffffff"],
  bat: ["#160c24", "#2e1a4a", "#5c388c", "#8058b8", "#b48ae8", "#e2d0ff", "#ffffff"],
  can: ["#0e1626", "#203048", "#3a5a80", "#5a8ab8", "#8ac0e8", "#d0ecff", "#ffffff"],
  star: ["#1e1206", "#4a2c08", "#86520c", "#c48412", "#f0b424", "#ffe066", "#ffffff"],
  spike: ["#2a1206", "#6a3010", "#a85a1c", "#e09a3a", "#ffd890", "#fff2d0", "#ffffff"],
};
const PX = Object.fromEntries(Object.entries(CORE_PAL).map(([k, v]) => [k, v.map(P)]));
const RGB = (c) => [c & 255, (c >>> 8) & 255, (c >>> 16) & 255];
// 記號（7×7，'a'＝暗、'b'＝亮）
const EMBLEM = {
  slime: ["...a...", "...a...", "..aba..", ".abbba.", ".abbba.", "..aaa..", "......."],
  can: ["..aaa..", ".abbba.", "abbabba", "abaaaba", "abbabba", ".abbba.", "..aaa.."],
  bat: ["a.....a", "aa...aa", "abaaaba", "abbabba", ".aabaa.", "...a...", "......."],
  star: ["...a...", "..aba..", "aabbbaa", ".abbba.", ".ab.ba.", "a.....a", "......."],
  spike: ["a..a..a", ".aabaa.", ".abbba.", "aabbbaa", ".abbba.", ".aabaa.", "a..a..a"],
};

function put(frame, x, y, c) {
  x = Math.round(x) - frame.ox; y = Math.round(y) - frame.oy;
  if (x >= 0 && y >= 0 && x < frame.w && y < frame.h) frame.color[y * frame.w + x] = c;
}
/** 只加光（不蓋顏色），越外面越淡 */
function glow(frame, cx, cy, rx, ry, c, k) {
  const [r, g, b] = RGB(c);
  for (let dy = -ry; dy <= ry; dy++) for (let dx = -rx; dx <= rx; dx++) {
    const d = Math.hypot(dx / rx, dy / ry); if (d > 1) continue;
    const X = Math.round(cx + dx) - frame.ox, Y = Math.round(cy + dy) - frame.oy;
    if (X < 0 || Y < 0 || X >= frame.w || Y >= frame.h) continue;
    const i = Y * frame.w + X, o = frame.light[i], f = (1 - d) ** 2 * k;
    frame.light[i] = (0xff000000 | (Math.min(255, ((o >>> 16) & 255) + b * f) << 16) | (Math.min(255, ((o >>> 8) & 255) + g * f) << 8) | Math.min(255, (o & 255) + r * f)) >>> 0;
  }
}

/** 地上的魔物核。(x, y)＝落地點；hold＝長按進度 0～1；回傳球心（給拉光的特效用） */
export function drawCore(frame, x, y, t, form, hold = 0) {
  const C = PX[form] ?? PX.star, bob = Math.sin(t * 2.6) * 1.5;
  const cx = Math.round(x), cy = Math.round(y - 13 - bob - hold * 9);
  const pulse = 0.5 + 0.5 * Math.sin(t * 3.2);
  // ---- 光效：地上的光（離得越高越淡）、球身柔光（一呼一吸，長按時越來越亮）
  glow(frame, x, y - 1, 13, 3, C[4], 0.35 + pulse * 0.15);
  glow(frame, cx, cy, 15 + hold * 6, 15 + hold * 6, C[4], 0.32 + pulse * 0.12 + hold * 0.5);
  // ---- 特效（後半）：繞球轉的光點，在球後面的畫暗一點
  const orbit = (front) => {
    for (let i = 0; i < 5; i++) {
      const a = t * (1.8 + hold * 6) + (i * TAU) / 5, behind = Math.sin(a) < 0;
      if (behind === front) continue;
      const r = 12 - hold * 4, ox = Math.cos(a) * r, oy = Math.sin(a) * r * 0.35 - Math.cos(a) * 2 - 1;   // 第 2 輪：軌道斜一點，看得出是一圈環
      put(frame, cx + ox, cy + oy, front ? C[6] : C[3]);
      if (front) { put(frame, cx + ox - Math.sign(Math.cos(a + 0.3)), cy + oy, C[5]); glow(frame, cx + ox, cy + oy, 2, 2, C[5], 0.5); }
    }
  };
  orbit(false);
  // ---- 本體：15×15 的結晶球
  const R = 8;   // 第 2 輪：再大一點（17×17）
  for (let dy = -R - 1; dy <= R + 1; dy++) for (let dx = -R - 1; dx <= R + 1; dx++) {
    const d = Math.hypot(dx, dy);
    if (d > R + 0.6) continue;
    let c;
    if (d > R - 0.4) c = C[0];
    else {
      const l = (-dx - dy) / (R * 1.4);   // 左上亮
      c = l > 0.55 ? C[5] : l > 0.15 ? C[4] : l > -0.35 ? C[3] : C[2];
      if (d > R - 1.6 && l < -0.2) c = C[1];   // 右下邊緣再暗一階
    }
    put(frame, cx + dx, cy + dy, c);
  }
  // 記號（長按時左右晃，像在轉）
  const E = EMBLEM[form] ?? EMBLEM.star, sx = Math.round(Math.sin(t * (hold > 0 ? 14 : 0)) * hold * 1.5);
  E.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== ".") put(frame, cx - 3 + i + sx, cy - 3 + j, ch === "a" ? C[1] : C[6]); }));
  // 高光：左上一顆白點＋一小條
  put(frame, cx - 4, cy - 4, C[6]); put(frame, cx - 3, cy - 5, C[6]); put(frame, cx - 5, cy - 3, C[5]);
  // 每 1.6 秒一道光從球面掃過（第 2 輪：只寫在光層——原本畫成一條白線，看起來像裂痕）
  const sw = (t % 1.6) / 1.6;
  if (sw < 0.3) { const k = -R + (sw / 0.3) * R * 2; glow(frame, cx + k * 0.8, cy - k * 0.4, 4, 4, C[6], 0.7); }
  orbit(true);
  // 往上飄的小光點
  for (let i = 0; i < 2; i++) { const p = ((t * 0.5 + i * 0.5) % 1); put(frame, cx + Math.sin(p * 7 + i * 3) * 4, cy - 8 - p * 14, p < 0.6 ? C[5] : C[3]); }
  // ---- 長按：光環一圈圈往內收（蓄力）
  if (hold > 0) {
    for (let k = 0; k < 2; k++) {
      const ph = ((t * 2.4 + k * 0.5) % 1), r = 20 * (1 - ph) + 4;
      for (let a = 0; a < TAU; a += 0.05) put(frame, cx + Math.cos(a) * r, cy + Math.sin(a) * r, ph > 0.7 ? C[6] : C[4]);
    }
  }
  return [cx, cy];
}

/** 長按時：幾道光從球拉到主角（波浪的線，上面有光點往主角跑），hold 越大越粗越亮 */
export function drawAbsorbBeams(frame, ax, ay, bx, by, t, form, hold) {
  const C = PX[form] ?? PX.star, n = 3, len = Math.hypot(bx - ax, by - ay), steps = Math.max(8, Math.ceil(len));
  for (let s = 0; s < n; s++) {
    const amp = (4 + s * 2) * (1 - hold * 0.6), ph = t * 9 + s * 2.1;
    for (let i = 0; i <= steps; i++) {
      const q = i / steps, w = Math.sin(q * Math.PI) * Math.sin(q * 6 + ph) * amp;
      const nx = -(by - ay) / len, ny = (bx - ax) / len, x = ax + (bx - ax) * q + nx * w, y = ay + (by - ay) * q + ny * w;
      const run = ((q - t * 2.2 - s * 0.3) % 0.25 + 0.25) % 0.25 < 0.04;
      if (run) { put(frame, x, y, C[6]); put(frame, x, y - 1, C[5]); glow(frame, x, y, 3, 3, C[5], 0.7); }
      else put(frame, x, y, C[3 + Math.min(2, Math.floor(hold * 3))]);   // 第 2 輪：連成實線（原本虛線太弱）
    }
  }
  glow(frame, bx, by, 10, 10, C[4], 0.25 + hold * 0.35);
}
