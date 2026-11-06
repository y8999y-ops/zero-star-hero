// 黏液星的普攻：黏液鞭。角甩出去拉長成一條黏液（根粗尖細、上緣濕亮、下緣暗），末端「啪」一聲拍開、濺出黏液滴，然後縮回來。
//   第一、二下：一條往前甩（一條略往上、一條略往下）；第三下：兩手一起甩、往下拍在地上，地上濺開一灘、大範圍。
// 參考（只學做法）：pixelfx melee/whip-crack（鞭子的波從手往尖端跑、尖端翻過去啪一聲）、nature/vine-whip（往前甩、噴汁）、critters/slime（濕亮高光、黏液滴）。
import { fit, ease, clamp, TAU, WHITE } from "../../../pixelfx/src/core/index.js";

const PAL = ["#0c2010", "#1a4a20", "#2a8a3a", "#4cc04a", "#8ee86a", "#d4ffb0", "#f0fff0"];
const mk = (name, act, duration, draw) => ({
  meta: { name, desc: name, tags: ["melee", "whip", "slime"], size: [190, 90], origin: [40, 70], duration, loop: false, fps: 30, bg: "ground", options: { palette: PAL, seed: 1 } },
  act, draw,
});

// 一條鞭：從 (x0, y0) 出去，ext＝伸出去的比例（0～1），reach 長度、bend 彎曲（+ 往下）、wave 波的相位
function lash(p, C, x0, y0, reach, ext, bend, wave, thick = 1) {
  const L = reach * ext;
  if (L < 2) return null;
  const pts = [];
  for (let s = 0; s <= L; s += 0.5) {
    const u = s / reach, x = x0 + s, y = y0 + bend * u * u * reach * 0.35 + Math.sin(u * 7 - wave) * 2.2 * u * (1 - u) * 4;
    pts.push([x, y, s / L]);
  }
  // 粗細：根 3、尖 1；先畫暗的外框（往下多 1 格），再畫身體、上緣亮線
  // 第 2 輪：加粗（根 4.5、尖 2），尖端一顆黏液球（第 1 輪細得像麵條）
  for (const [x, y, v] of pts) { const w = (4.5 - 2.5 * v) * thick; for (let q = -w - 1; q <= w + 1; q += 0.5) p.dot(x, y + q, C[0], 1); }
  for (const [x, y, v] of pts) {
    const w = (4.5 - 2.5 * v) * thick;
    for (let q = -w; q <= w; q += 0.5) p.dot(x, y + q, q < -w + 1 ? C[5] : q > w - 1.2 ? C[2] : C[3], 1);
    if (v > 0.2 && v < 0.8 && ((x | 0) % 5 === 0)) p.dot(x, y - w + 1, WHITE, 1);   // 濕亮的小高光
  }
  const tip = pts[pts.length - 1], br = 3.2 * thick;
  p.circle(tip[0], tip[1], br + 1, C[0]); p.circle(tip[0], tip[1], br, C[3]); p.circle(tip[0] - 1, tip[1] - 1, br * 0.55, C[4]); p.dot(tip[0] - 1.5, tip[1] - 1.5, WHITE, 1);
  return { x: tip[0], y: tip[1] };
}
// 啪：尖端一圈白→亮綠的小爆開＋往外甩的黏液滴（拋物線、落地變成小點）
function splat(p, C, x, y, a, big = 1, floor = null) {
  if (a < 0 || a > 0.32) return;
  const k = 1 - a / 0.32;
  if (a < 0.034) { p.circle(x, y, 4 * big, WHITE); p.glow(x, y, 12 * big, C[5], 0.6); }
  else if (a < 0.12) p.ring(x, y, 3 + a * 70 * big, 1.2, C[4], 1 - a / 0.12);
  for (let i = 0; i < 7 * big; i++) {
    const ang = -Math.PI / 2 + (i / (7 * big) - 0.5) * 2.6, v = (60 + (i * 37) % 50) * big;
    let px = x + Math.cos(ang) * v * a, py = y + Math.sin(ang) * v * a + 260 * a * a;
    if (floor !== null && py > floor) py = floor;
    const r = i % 3 === 0 ? 1.5 : 1;
    if (k < 0.15) continue;
    p.circle(px, py, r + 0.5, i % 2 ? C[4] : C[3]);
    if (r > 1) p.dot(px - 0.5, py - 0.5, C[5], 1);
  }
  p.glow(x, y, 10 * big, C[4], 0.3 * k);
}

function whip(bend, wave0) {
  const OUT = 0.08, BACK = 0.24;
  return (p, t, o) => {
    const C = fit(o.palette, 7);
    const ext = t < OUT ? ease.outCubic(t / OUT) : 1 - ease.inQuad(clamp((t - OUT - 0.04) / (BACK - OUT - 0.04), 0, 1));
    const tip = lash(p, C, 10, -13, 78, ext, bend, wave0 + t * 30, 1 - clamp((t - OUT) / BACK, 0, 0.5));
    if (tip && t < OUT + 0.02) p.glow(tip.x, tip.y, 6, C[5], 0.4);
    splat(p, C, 10 + 78, -13 + bend * 78 * 0.35, t - OUT, 1);
  };
}
function slam() {
  const OUT = 0.12, BACK = 0.34;
  return (p, t, o) => {
    const C = fit(o.palette, 7);
    const ext = t < OUT ? ease.outCubic(t / OUT) : 1 - ease.inQuad(clamp((t - OUT - 0.08) / (BACK - OUT - 0.08), 0, 1));
    // 兩條一起甩：一條高、一條往下拍到地上
    lash(p, C, 8, -17, 70, ext, 1.2, t * 26, 1.2);
    lash(p, C, 10, -10, 74, ext, 1.55, t * 30 + 1, 1.3);
    const a = t - OUT;
    splat(p, C, 10 + 74, -1, a, 1.6, 0);
    // 地上一灘：往兩邊攤開、慢慢縮
    if (a > 0) {
      const w = Math.min(22, a * 300) * (1 - clamp((a - 0.2) / 0.2, 0, 1));
      for (let x = -w; x <= w; x++) { const e = Math.abs(x) / Math.max(1, w); p.dot(84 + x, 0, e > 0.8 ? C[1] : C[3], 1); if (e < 0.6) p.dot(84 + x, -1, e < 0.3 ? C[5] : C[4], 1); }
    }
  };
}
const READY = {};
export const whipA = mk("Slime whip A", { poses: [[-0.24, READY], [0, READY]], hits: [{ t: 0.08, stop: 0.07, shake: 0.12, amp: 2, push: 2.4 }] }, 0.36, whip(-0.3, 0));
export const whipB = mk("Slime whip B", { poses: [[-0.22, READY], [0, READY]], hits: [{ t: 0.08, stop: 0.07, shake: 0.12, amp: 2, push: 2.4 }] }, 0.36, whip(0.45, 1.5));
export const whipSlam = mk("Slime whip slam", { poses: [[-0.3, READY], [0, READY]], hits: [{ t: 0.12, stop: 0.12, shake: 0.22, amp: 3, push: 3 }] }, 0.5, slam());
export const STEPS = [whipA, whipB, whipSlam];
