// 星星的普攻（使用者 2026-11-06「每個形態都要獨立設計一個普通攻擊模組」）：用星角出拳。
//   左拳、右拳兩下快拳：拳頭後面三條速度線，打中的地方爆出一顆金色五角小星（先白一格、再撐開、往外丟幾顆小星屑）；
//   第三下全身轉一圈撞出去：身體周圍一圈金色星光軌跡（越舊越暗、斷斷續續），轉完在前面爆一顆大星。
// 參考（只學做法）：pixelfx melee/thrust（命中點的十字長星＋速度線）、pickups 的星形閃光（五角星、白心）、melee/spin-slash（一圈軌跡）。
// 原點＝主角腳底，臉朝右。手的高度約 y = -13（star.js 的側角）。
import { fit, ease, clamp, TAU, WHITE } from "../../../pixelfx/src/core/index.js";

const PAL = ["#2a1608", "#6b3c10", "#b8701a", "#f0b42e", "#ffe27a", "#fff6cf", "#ffffff"];
const mk = (name, act, duration, draw) => ({
  meta: { name, desc: name, tags: ["melee", "punch", "star"], size: [150, 80], origin: [40, 60], duration, loop: false, fps: 30, bg: "ground", options: { palette: PAL, seed: 1 } },
  act, draw,
});

// 五角星：中心 (x, y)、外徑 R、轉角 rot；k＝亮度（1 新 → 0 淡掉）。外圈暗、裡面亮、中心白
function star5(p, x, y, R, rot, C, k) {
  if (R < 1) return;
  const ri = R * 0.45;
  const inside = (px, py) => {
    const a = Math.atan2(py - y, px - x) - rot, d = Math.hypot(px - x, py - y);
    const seg = ((a % (TAU / 5)) + TAU / 5) % (TAU / 5), u = Math.abs(seg - TAU / 10) / (TAU / 10);   // 0＝角尖方向、1＝凹處
    return d <= R * (1 - u) + ri * u;
  };
  for (let py = Math.floor(y - R); py <= Math.ceil(y + R); py++) for (let px = Math.floor(x - R); px <= Math.ceil(x + R); px++) {
    if (!inside(px + 0.5, py + 0.5)) continue;
    const d = Math.hypot(px + 0.5 - x, py + 0.5 - y) / R, edge = !inside(px + 1.5, py + 0.5) || !inside(px - 0.5, py + 0.5) || !inside(px + 0.5, py + 1.5) || !inside(px + 0.5, py - 0.5);
    p.dot(px, py, edge ? C[3] : d < 0.25 ? WHITE : d < 0.5 ? C[5] : C[4], k > 0.5 ? 1 : k * 2);
  }
  p.glow(x, y, R * 2.2, C[4], 0.5 * k);
}
// 一顆小星屑（十字）
const mote = (p, x, y, C, k) => { p.dot(x, y, k > 0.6 ? WHITE : C[5], 1); if (k > 0.4) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.dot(x + dx, y + dy, C[4], k); };

// 拳：hy＝出拳高度
function jab(hy, flip) {
  const HIT = 0.05;
  return (p, t, o) => {
    const C = fit(o.palette, 7), IX = 24, IY = hy;
    // 速度線：出拳那一下，手前面三條往前的線
    if (t < HIT + 0.04) {
      const k = 1 - clamp((t - HIT) / 0.04, 0, 1);
      for (const [dy, l] of [[-3, 14], [0, 18], [3, 12]]) for (let i = 0; i < l; i++) { const x = IX - 4 - l + i + ease.outCubic(clamp(t / HIT, 0, 1)) * 4; p.dot(x, IY + dy, i > l - 4 ? C[5] : C[3], k * (i / l)); }
    }
    // 命中的星：第一格白、然後撐開轉一點、再縮小淡掉
    const a = t - HIT;
    if (a >= 0 && a < 0.2) {
      const grow = a < 0.03 ? 0.6 : ease.outBack(clamp((a - 0.03) / 0.06, 0, 1)), k = 1 - clamp((a - 0.08) / 0.12, 0, 1);
      if (a < 0.034) { p.circle(IX, IY, 5, WHITE); p.glow(IX, IY, 14, WHITE, 0.6); }
      else star5(p, IX, IY, 7 * grow * (0.6 + 0.4 * k), (flip ? -1 : 1) * (0.3 + a * 4), C, k);
      // 往外丟的小星屑
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * TAU + (flip ? 0.6 : 0), v = 70 + i * 9, d = v * a - 160 * a * a;
        if (a > 0.03) mote(p, Math.round(IX + Math.cos(ang) * d * 0.9), Math.round(IY + Math.sin(ang) * d * 0.6), C, 1 - a / 0.2);
      }
    }
  };
}

// 旋轉撞擊：0～0.12 身體周圍轉一圈（軌跡），0.12 前面爆大星
function spin() {
  const T1 = 0.12;
  return (p, t, o) => {
    const C = fit(o.palette, 7), CX = 0, CY = -12, R = 17;
    // 軌跡：頭在 ang(t)，往後拖 1.2 弧度，越後面越暗；斷成小段
    const head = ease.outCubic(clamp(t / T1, 0, 1)) * TAU * 1.05, fade = 1 - clamp((t - T1) / 0.15, 0, 1);
    for (let s = 0; s < 2.8; s += 0.03) {   // 第 3 輪：拖得更長（2.8 弧度），轉完留一整圈慢慢淡掉
      const ang = head - s - Math.PI / 2, u = s / 2.8;
      if (head - s < 0 || ((s * 20) | 0) % 5 === 4) continue;
      const x = CX + Math.cos(ang) * R, y = CY + Math.sin(ang) * R * 0.75;
      // 第 2 輪：軌跡加粗成 3 格（內亮外暗），第 1 輪 1～2 格在畫面上幾乎看不到
      for (const [dr, c] of [[-1, u < 0.2 ? WHITE : C[5]], [0, u < 0.15 ? WHITE : u < 0.55 ? C[5] : C[4]], [1, C[3]]]) p.dot(CX + Math.cos(ang) * (R + dr), CY + Math.sin(ang) * (R + dr) * 0.75, c, (1 - u) * fade);
    }
    if (t < T1) p.glow(CX + Math.cos(head - Math.PI / 2) * R, CY + Math.sin(head - Math.PI / 2) * R * 0.75, 8, C[5], 0.4);
    // 第一下（轉到前面）小星、最後大星
    for (const [ht, X, Rr] of [[0.05, 22, 5], [T1, 28, 10]]) {
      const a = t - ht; if (a < 0 || a >= 0.24) continue;
      const k = 1 - clamp((a - 0.06) / 0.18, 0, 1);
      if (a < 0.034) { p.circle(X, CY, Rr * 0.7, WHITE); p.glow(X, CY, Rr * 2.5, WHITE, 0.6); }
      else star5(p, X, CY, Rr * ease.outBack(clamp((a - 0.03) / 0.07, 0, 1)) * (0.7 + 0.3 * k), a * 5, C, k);
      for (let i = 0; i < (Rr > 6 ? 8 : 4); i++) {
        const ang = (i / 8) * TAU + 0.3, d = (90 + i * 7) * a - 170 * a * a;
        if (a > 0.03) mote(p, Math.round(X + Math.cos(ang) * d), Math.round(CY + Math.sin(ang) * d * 0.7), C, 1 - a / 0.24);
      }
    }
  };
}

const READY = {};
export const jabA = mk("Star jab A", { poses: [[-0.2, READY], [0, READY]], hits: [{ t: 0.05, stop: 0.07, shake: 0.12, amp: 2, push: 2 }] }, 0.3, jab(-14, false));
export const jabB = mk("Star jab B", { poses: [[-0.2, READY], [0, READY]], hits: [{ t: 0.05, stop: 0.07, shake: 0.12, amp: 2, push: 2 }] }, 0.3, jab(-11, true));
export const spinRam = mk("Star spin ram", { poses: [[-0.28, READY], [0, READY]], hits: [{ t: 0.05, stop: 0.05, shake: 0.12, amp: 2, push: 2 }, { t: 0.12, stop: 0.12, shake: 0.2, amp: 3, push: 3 }] }, 0.4, spin());
export const STEPS = [jabA, jabB, spinRam];
