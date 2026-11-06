// 鐵罐星的普攻：蓋子咬。前面浮出一個半透明的大罐蓋＋下顎（鐵灰、鋸齒牙），張開 →「喀」一聲咬合（白閃＋橘色火花往外噴）；
//   第三下：跳起來整個罐子往下砸地——地上一圈塵土往兩邊滾、鐵片和火花彈起來、一顆白色衝擊星。
// 參考（只學做法）：本專案 fx/abyss/trash-can.js（垃圾桶怪咬人：蓋子往後翻、牙、啪地闔上）、pixelfx impacts/heavy-landing（落地塵土兩圈往外滾、小石頭彈開）、
//   pixelfx melee/heavy-cleave（白色重擊、火星往上飄）。
import { fit, hex, ease, clamp, TAU, WHITE } from "../../../pixelfx/src/core/index.js";

const PAL = ["#14161c", "#2a2e38", "#4a5468", "#6e7a90", "#9aa6ba", "#d0d8e6", "#eef2f8"];
const SPARK = ["#fff3a6", "#ffc23d", "#ff8a2a", "#c44a1a"];
const mk = (name, act, duration, draw) => ({
  meta: { name, desc: name, tags: ["melee", "bite", "can"], size: [170, 100], origin: [50, 80], duration, loop: false, fps: 30, bg: "ground", options: { palette: PAL, sparks: SPARK, seed: 1 } },
  act, draw,
});
const SK = SPARK.map((c) => hex(c));

// 一片顎：上顎（罐蓋，厚、圓頭）或下顎（薄一點），open＝張開角度（0 闔上）
// 第 2 輪：第 1 輪是 1～2 格的細線，看起來像鉗子 → 改成厚實的罐蓋（6 格、前端圓、上緣亮邊、底下一排白牙），張開時中間一塊暗的嘴巴
function jaw(p, C, cx, cy, open, upper, k) {
  if (k <= 0.05) return;
  // 第 3 輪：再大一號（27 長、上顎 8 厚），咬的份量才出來
  const W = 27, ang = (upper ? -1 : 1) * open, ca = Math.cos(ang), sa = Math.sin(ang);
  const put = (lx, ly, c) => p.dot(cx + lx * ca - ly * sa, cy + lx * sa + ly * ca, c, 1);
  for (let lx = 0; lx <= W * k; lx += 0.5) {
    const th = (upper ? 8 : 5) * (lx > W - 4 ? Math.sqrt(Math.max(0, 1 - ((lx - (W - 4)) / 4) ** 2)) : 1);   // 前端圓頭
    for (let ly = 0; ly <= th; ly += 0.5) {
      const y = upper ? -ly : ly, rim = ly > th - 1.2, edge = ly < 1;
      put(lx, y, rim ? C[0] : upper && ly > th - 2.5 ? C[5] : edge ? C[2] : lx < 4 ? C[3] : C[4]);
    }
    if (Math.floor(lx) % 4 === 1 && lx < W - 2) { put(lx, upper ? 1 : -1, WHITE); put(lx + 1, upper ? 1 : -1, C[5]); }   // 鋸齒牙
  }
  if (upper) for (const lx of [W - 11, W - 10, W - 9]) put(lx, -9.5, C[4]);   // 罐蓋的把手
}
function mouth(p, C, cx, cy, open, k) {   // 張開時兩顎之間的暗色嘴巴（三角形）
  if (open < 0.08 || k < 0.3) return;
  for (let lx = 1; lx < 25; lx++) { const h = Math.tan(open) * lx * 0.9; for (let y = -h; y <= h; y++) p.dot(cx + lx, cy + y, Math.abs(y) > h - 1 ? C[1] : C[0], 1); }
}
function sparks(p, x, y, a, n, spread, seed) {
  if (a < 0 || a > 0.3) return;
  for (let i = 0; i < n; i++) {
    const ang = -Math.PI / 2 + ((i * 2.399 + seed) % spread) - spread / 2, v = 90 + ((i * 53) % 60);
    const sx = x + Math.cos(ang) * v * a, sy = y + Math.sin(ang) * v * a + 300 * a * a;
    const c = SK[Math.min(3, Math.floor(a / 0.08))];
    p.dot(sx, sy, c, 1); p.dot(sx - Math.cos(ang) * 2, sy - Math.sin(ang) * 2, SK[Math.min(3, Math.floor(a / 0.08) + 1)], 0.7);
    p.glow(sx, sy, 3, c, 0.3);
  }
}
function bite(cy, seed) {
  const SNAP = 0.07;
  return (p, t, o) => {
    const C = fit(o.palette, 7), cx = 14, k = t < 0.03 ? t / 0.03 : 1 - clamp((t - 0.2) / 0.1, 0, 1);
    const open = t < SNAP ? 0.75 * (1 - ease.inQuad(t / SNAP)) + 0.05 : 0;
    mouth(p, C, cx, cy, open, k); jaw(p, C, cx, cy, open, true, k); jaw(p, C, cx, cy, open, false, k);
    const a = t - SNAP;
    if (a >= 0 && a < 0.04) { p.circle(cx + 25, cy, 5, WHITE); p.glow(cx + 25, cy, 14, WHITE, 0.6); }
    sparks(p, cx + 25, cy, a, 10, 2.6, seed);
  };
}
function smash() {
  const HIT = 0.14;
  return (p, t, o) => {
    const C = fit(o.palette, 7), X = 26, a = t - HIT;
    // 往下砸的殘影：砸之前，一條從上往下的寬亮帶
    // 第 2 輪：往下砸改成三條實心的速度線（第 1 輪網點帶子很髒）
    if (t < HIT) { const u = ease.inQuad(t / HIT); for (const [dx, l, c] of [[-6, 16, C[3]], [0, 26, C[5]], [6, 14, C[3]]]) for (let i = 0; i < l; i++) { const y = -46 + 44 * u - i; if (y < -46) break; p.dot(X + dx, y, i < 4 ? WHITE : c, 1); } }
    if (a < 0) return;
    // 白色衝擊星（十字長星）
    if (a < 0.1) { const L = 22 * (1 - a / 0.1); for (const [dx, dy, f] of [[1, 0, 1], [-1, 0, 1], [0, -1, 0.6]]) for (let d = 0; d < L * f; d++) p.dot(X + dx * d, -2 + dy * d, d < L * f * 0.4 ? WHITE : C[5], 1 - d / (L * f)); p.glow(X, -2, 18, WHITE, 0.6 * (1 - a / 0.1)); }
    // 塵土：兩圈往兩邊滾
    for (const [delay, sz] of [[0, 1], [0.06, 0.7]]) {
      const b = a - delay; if (b < 0 || b > 0.45) continue;
      for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
        const d = (30 + i * 9) * (1 - Math.exp(-b * 6)) * sz, r = (3.5 - i * 0.5) * (1 - b / 0.45) * sz + 1;
        p.disc(X + s * d, -r * 0.8, r, C[3], 0.55 * (1 - b / 0.45));
      }
    }
    // 鐵片＋火花往上彈
    for (let i = 0; i < 6; i++) {
      const vx = (i - 2.5) * 34, vy = -120 - (i % 3) * 30, px = X + vx * a, py = -2 + vy * a + 420 * a * a;
      if (a < 0.45 && py < 0) { p.dot(px, py, C[4], 1); p.dot(px + 1, py, C[2], 1); }
    }
    sparks(p, X, -3, a, 10, 2.2, 7);
  };
}
const READY = {};
export const biteA = mk("Can bite A", { poses: [[-0.26, READY], [0, READY]], hits: [{ t: 0.07, stop: 0.08, shake: 0.14, amp: 2, push: 2.6 }] }, 0.34, bite(-13, 1));
export const biteB = mk("Can bite B", { poses: [[-0.24, READY], [0, READY]], hits: [{ t: 0.07, stop: 0.08, shake: 0.14, amp: 2, push: 2.6 }] }, 0.34, bite(-11, 3));
export const smashDown = mk("Can smash", { poses: [[-0.4, READY], [0, READY]], hits: [{ t: 0.14, stop: 0.14, shake: 0.3, amp: 4, push: 3.2 }] }, 0.6, smash());
export const STEPS = [biteA, biteB, smashDown];
