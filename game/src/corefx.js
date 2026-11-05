// 星核核心效果的小特效（8a，照 pixelfx skill 畫→看→修）：
//   彗尾：衝刺時身後留下一串星光，新的白、舊的變金再變暗金，邊上灑星屑，0.5 秒散掉（參考 pixelfx arcane/star-fall 的尾巴、setfx 的小流星）
//   暈眩：敵人頭上兩顆小星星繞圈（前面那顆亮、繞到後面變暗），參考常見的暈眩星星
// 草稿：game/tools/drafts/corefx.mjs
import { hex } from "../../pixelfx/src/core/index.js";

const P = (c) => hex(c) >>> 0;
const G = ["#6e3a0c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff"].map(P);
export const TRAIL_T = 0.5;

function put(frame, x, y, c, glow) {
  x = Math.round(x) - frame.ox; y = Math.round(y) - frame.oy;
  if (x < 0 || y < 0 || x >= frame.w || y >= frame.h) return;
  frame.color[y * frame.w + x] = c;
  if (glow) frame.light[y * frame.w + x] = c;
}
const hash = (n) => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };

/** 彗尾：pts = [{ x, y, t, seed }]（照時間順序）。第 2 輪：相鄰兩點之間補滿（衝刺很快，點和點差 4 格會斷成虛線） */
export function drawTrail(frame, pts) {
  for (let n = 0; n < pts.length; n++) {
    const p = pts[n], q = pts[n + 1] ?? p, steps = Math.max(1, Math.round(Math.abs(q.x - p.x)));
    for (let s = 0; s < steps; s++) {
      const f = s / steps, x = p.x + (q.x - p.x) * f, y = p.y + (q.y - p.y) * f, k = (p.t + (q.t - p.t) * f) / TRAIL_T;
      if (k >= 1 || k < 0) continue;
      // 第 3 輪：原本一整條 5 格粗的白條、被光洗成一塊——改成中間 1 格亮芯、上下各 1 格深一階的邊（只有新的有邊），只有芯發光
      const lvl = k < 0.12 ? 5 : k < 0.3 ? 4 : k < 0.55 ? 3 : k < 0.8 ? 2 : 1, h = k < 0.45 ? 1 : 0;
      put(frame, x, y, G[lvl], k < 0.4);
      if (h) { put(frame, x, y - 1, G[Math.max(1, lvl - 2)]); put(frame, x, y + 1, G[Math.max(0, lvl - 3)]); }
    }
    // 星屑：往上下飄開
    const k = p.t / TRAIL_T, r = hash(p.seed), side = r < 0.5 ? -1 : 1;
    if (k < 1 && r < 0.6) {
      const sx = p.x + (hash(p.seed + 1) - 0.5) * 4, sy = p.y + side * (4 + k * 10), c = G[k < 0.4 ? 4 : k < 0.7 ? 3 : 1];
      put(frame, sx, sy, c, k < 0.5);
      if (k < 0.35) { put(frame, sx + 1, sy, G[2]); put(frame, sx - 1, sy, G[2]); put(frame, sx, sy - 1, G[2]); put(frame, sx, sy + 1, G[2]); }
    }
  }
}

/** 暈眩：(x, y) 是頭頂。第 2 輪：星星放大成 5×5 的菱形星＋暗色外框，原本 3×3 的十字太小看不出來 */
const STAR = ["..a..", ".aba.", "abcba", ".aba.", "..a.."];
const OUTC = P("#2a1406");
export function drawDizzy(frame, x, y, t) {
  for (let i = 0; i < 2; i++) {
    const a = t * 7 + i * Math.PI, px = Math.round(x + Math.cos(a) * 8) - 2, py = Math.round(y - 4 + Math.sin(a) * 2) - 2, front = Math.sin(a) > 0;
    const C = front ? { a: G[2], b: G[4], c: G[5] } : { a: G[1], b: G[2], c: G[3] };
    const at = (u, v) => STAR[v]?.[u] && STAR[v][u] !== ".";
    for (let v = -1; v <= 5; v++) for (let u = -1; u <= 5; u++) if (!at(u, v) && (at(u + 1, v) || at(u - 1, v) || at(u, v + 1) || at(u, v - 1))) put(frame, px + u, py + v, OUTC);
    STAR.forEach((row, v) => [...row].forEach((ch, u) => { if (ch !== ".") put(frame, px + u, py + v, C[ch], front && ch !== "a"); }));
  }
}
