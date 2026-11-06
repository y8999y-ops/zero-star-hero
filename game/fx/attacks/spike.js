// 尖刺星的普攻：刺擊。角刺出去，前面留一道針形殘光（手邊粗、往前收尖、尖端白），旁邊兩條細的平行殘影；尖端一顆小十字閃光；
//   第四下：全身的刺往前扇形炸開——五根長針從胸前散出去，每根尖端一顆閃光，根部一圈琥珀色的爆光。
// 參考（只學做法）：pixelfx melee/thrust（一束細線在手邊散開、在尖端收攏，尖端長十字星）、本專案 ult-forms「千針風暴」的尖針畫法。
import { fit, ease, clamp, WHITE } from "../../../pixelfx/src/core/index.js";

const PAL = ["#2a1206", "#6a3010", "#a85a1c", "#e09a3a", "#ffd890", "#fff2d0", "#ffffff"];
const mk = (name, act, duration, draw) => ({
  meta: { name, desc: name, tags: ["melee", "thrust", "spike"], size: [180, 90], origin: [40, 70], duration, loop: false, fps: 30, bg: "ground", options: { palette: PAL, seed: 1 } },
  act, draw,
});
// 一根針（從 (x0,y0) 往角度 ang 長 L），根部寬 w0，k 亮度
function needle(p, C, x0, y0, ang, L, w0, k) {
  const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
  for (let s = 0; s <= L; s += 0.5) {
    const u = s / L, w = w0 * (1 - u) + 0.3;
    for (let q = -w; q <= w; q += 0.5) p.dot(x0 + ux * s + nx * q, y0 + uy * s + ny * q, u > 0.88 ? WHITE : q < 0 ? (u > 0.5 ? C[5] : C[4]) : u > 0.5 ? C[4] : C[3], k);
  }
}
const cross = (p, C, x, y, r, k) => { for (let d = -r; d <= r; d++) { p.dot(x + d, y, Math.abs(d) < 2 ? WHITE : C[5], k); p.dot(x, y + d * 0.7, Math.abs(d) < 2 ? WHITE : C[4], k); } p.glow(x, y, r * 2, C[4], 0.5 * k); };

function stab(y, reach) {
  const OUT = 0.05;
  return (p, t, o) => {
    const C = fit(o.palette, 7), x0 = 12;
    const L = reach * (t < OUT ? ease.outExpo(t / OUT) : 1), k = 1 - clamp((t - OUT - 0.04) / 0.12, 0, 1);
    if (k <= 0) return;
    // 第 2 輪：收回去改成從根部往前縮（第 1 輪網點淡出很髒）
    const cut = L * (1 - k);
    needle(p, C, x0 + cut, y, 0, L - cut, 2.4 * k + 0.4, 1);
    if (k > 0.5) for (const dy of [-3, 3]) for (let s = 6; s < L * 0.8; s += 2) p.dot(x0 + s, y + dy, C[3], 1);   // 兩條細殘影（虛線）
    if (t >= OUT && k > 0.3) cross(p, C, x0 + L, y, 5 * (1 - clamp((t - OUT) / 0.1, 0, 0.6)), 1);
  };
}
function fan() {
  const OUT = 0.08;
  return (p, t, o) => {
    const C = fit(o.palette, 7), k = 1 - clamp((t - OUT - 0.08) / 0.16, 0, 1);
    if (k <= 0) return;
    const g = t < OUT ? ease.outExpo(t / OUT) : 1;
    // 根部爆光
    if (t < OUT + 0.06) { p.circle(12, -13, 5 * (1 - t / (OUT + 0.06)) + 1, t < 0.04 ? WHITE : C[5]); p.glow(12, -13, 14, C[4], 0.5); }
    for (let i = 0; i < 5; i++) {
      const ang = -0.5 + i * 0.25, L = (62 + (i === 2 ? 14 : 0)) * g;
      const cut = L * (1 - k);
      needle(p, C, 12 + Math.cos(ang) * cut, -13 + Math.sin(ang) * cut, ang, L - cut, (i === 2 ? 2.6 : 1.8) * k + 0.4, 1);
      if (t >= OUT && k > 0.3) cross(p, C, 12 + Math.cos(ang) * L, -13 + Math.sin(ang) * L, i === 2 ? 5 : 3, 1);
    }
  };
}
const READY = {};
export const stabA = mk("Spike stab A", { poses: [[-0.18, READY], [0, READY]], hits: [{ t: 0.05, stop: 0.05, shake: 0.08, amp: 1, push: 1.6 }] }, 0.24, stab(-14, 54));
export const stabB = mk("Spike stab B", { poses: [[-0.16, READY], [0, READY]], hits: [{ t: 0.05, stop: 0.05, shake: 0.08, amp: 1, push: 1.6 }] }, 0.24, stab(-11, 54));
export const stabC = mk("Spike stab C", { poses: [[-0.16, READY], [0, READY]], hits: [{ t: 0.05, stop: 0.05, shake: 0.08, amp: 1, push: 1.8 }] }, 0.24, stab(-16, 56));
export const spikeFan = mk("Spike fan burst", { poses: [[-0.32, READY], [0, READY]], hits: [{ t: 0.08, stop: 0.12, shake: 0.2, amp: 3, push: 3 }] }, 0.36, fan());
export const STEPS = [stabA, stabB, stabC, spikeFan];
