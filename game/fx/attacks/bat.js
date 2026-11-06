// 蝠翼星的普攻：翅膀爪擊。一套七下：紫色新月形的翼刃一上一下交錯劃過（中間白、兩端收尖、劃過去的方向拖一點殘影），
//   每一下掉一兩片小羽毛（左右飄、慢慢落）；第七下兩片翼刃交叉成 X，加三道爪痕。
// 參考（只學做法）：pixelfx melee/sword-slash（新月刀光：厚的中段、細的兩端、白色前緣）、critters/bat（翅膀的紫色明暗）、
//   本專案 ult-forms 的「月下夜襲」爪痕（三道平行斜線、中間白）。
import { fit, ease, clamp, TAU, WHITE } from "../../../pixelfx/src/core/index.js";

const PAL = ["#160c24", "#2e1a4a", "#5c388c", "#8058b8", "#b48ae8", "#e2d0ff", "#ffffff"];
const HITS = [0.0, 0.06, 0.12, 0.18, 0.24, 0.3, 0.42];

// 新月：圓心 (cx, cy)、半徑 r、從 a0 劃到 a1；prog＝劃到哪（0～1）、k＝亮度
function crescent(p, C, cx, cy, r, a0, a1, prog, k) {
  const span = (a1 - a0) * prog;
  for (let s = 0; s <= 1; s += 0.02) {
    const a = a0 + span * s, w = Math.sin(Math.PI * s) * 4.2 + 0.8;   // 第 3 輪：中段再厚一格   // 中段厚、兩端尖
    for (let q = 0; q <= w; q += 0.5) {
      if (q > w * k + 0.3) break;   // 第 2 輪：淡出改成變細（第 1 輪網點淡出看起來很髒）
      const rr = r - q, x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.8;
      const front = s > 0.75;   // 劃過去的前端比較亮
      p.dot(x, y, q < 0.8 ? (front ? WHITE : C[5]) : q < w * 0.6 ? C[4] : C[3], 1);
    }
  }
  p.glow(cx + Math.cos(a0 + span) * r, cy + Math.sin(a0 + span) * r * 0.8, 7, C[4], 0.4 * k);
}
// 羽毛：3×2 的小葉形，左右擺、慢慢落
function feather(p, C, x, y, a, seed) {
  if (a < 0 || a > 0.5) return;
  const k = 1 - a / 0.5, sx = x + Math.sin(a * 14 + seed) * 4 + (seed % 2 ? 1 : -1) * a * 20, sy = y + a * 34;
  p.dot(sx, sy, C[4], k); p.dot(sx + 1, sy, C[3], k); p.dot(sx - 1, sy + 1, C[3], k); p.dot(sx, sy + 1, C[2], k);
}

export const meta = { name: "Bat wing flurry", desc: "Bat wing flurry", tags: ["melee", "claw", "bat"], size: [150, 90], origin: [40, 70], duration: 0.7, loop: false, fps: 30, bg: "ground", options: { palette: PAL, seed: 1 } };
export const act = { poses: [[-0.3, {}], [0, {}]], hits: HITS.map((t, i) => ({ t, stop: i === 6 ? 0.12 : 0.04, shake: i === 6 ? 0.2 : 0.08, amp: i === 6 ? 3 : 1, push: i === 6 ? 2.6 : 0.8 })) };
export function draw(p, t, o) {
  const C = fit(o.palette, 7);
  HITS.forEach((ht, i) => {
    const a = t - ht + 0.04; if (a < 0 || a > 0.16) return;
    const prog = ease.outCubic(clamp(a / 0.06, 0, 1)), k = 1 - clamp((a - 0.06) / 0.1, 0, 1);
    if (i < 6) {
      const up = i % 2 === 0;   // 一上一下交錯
      crescent(p, C, 18, -13, 13 + (i % 3), up ? -2.3 : 2.3, up ? 0.9 : -0.9, prog, k);
    } else {
      crescent(p, C, 20, -13, 17, -2.4, 1.0, prog, k);
      crescent(p, C, 20, -13, 17, 2.4, -1.0, prog, k);
    }
  });
  // 第七下：三道爪痕
  const a7 = t - HITS[6];
  if (a7 >= 0 && a7 < 0.26) {
    const g = clamp(a7 / 0.05, 0, 1), k = 1 - clamp((a7 - 0.08) / 0.18, 0, 1);
    for (let j = -1; j <= 1; j++) for (let s = -10; s <= -10 + 20 * g; s++) {
      const x = 30 + s * 0.7 + j * 4, y = -13 + s * 0.9 - j * 2, e = 1 - Math.abs(s) / 11;
      if (e < 1 - k) continue;   // 爪痕：從兩端往中間收
      p.dot(x, y, e > 0.55 ? WHITE : e > 0.25 ? C[5] : C[4], 1); p.dot(x + 1, y, C[4], 1); p.dot(x + 1, y + 1, C[3], 1);
    }
  }
  // 羽毛：每一下掉一兩片
  HITS.forEach((ht, i) => { feather(p, C, 22 + (i % 3) * 4, -16 + (i % 2) * 6, t - ht - 0.03, i); if (i % 2) feather(p, C, 14, -20, t - ht - 0.06, i + 3); });
}
export const flurry = { meta, act, draw };
export const STEPS = [flurry];
