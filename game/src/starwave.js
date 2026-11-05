// 技能樹「星光斬」（星星）：連段最後一下往前射出一道短距離的月牙形星光（參考 pixelfx melee/sword-slash 的月牙：白芯→金→暗金，
// 往後拖兩道殘影，邊上掉星屑）。飛 0.32 秒、穿過敵人（每隻打一次）。草稿：game/tools/drafts/starwave.mjs
import { hex } from "../../pixelfx/src/core/index.js";

const P = (c) => hex(c) >>> 0;
const G = ["#6e3a0c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff"].map(P);
export const WAVE_T = 0.32, WAVE_V = 300;

function put(frame, x, y, c, glow) {
  x = Math.round(x) - frame.ox; y = Math.round(y) - frame.oy;
  if (x < 0 || y < 0 || x >= frame.w || y >= frame.h) return;
  frame.color[y * frame.w + x] = c;
  if (glow) frame.light[y * frame.w + x] = c;
}
/** 月牙（第 2 輪）：實心的上弦月形——外弧和內弧之間填滿，前緣白、往後金→暗金；殘影只畫外弧 1～2 格、不發光 */
function crescent(frame, cx, cy, dir, k, ghost) {
  const R = ghost ? 10 : 12;   // 第 3 輪：殘影短一點，看起來是拖出來的、不是另外兩道
  for (let j = -R; j <= R; j++) {
    const q = Math.abs(j) / R, outer = Math.sqrt(1 - q * q) * 6, inner = Math.sqrt(Math.max(0, 1 - (q * 1.15) ** 2)) * 6 - (ghost ? 1.5 : 4.5) * (1 - k * 0.5);
    const w = Math.max(1, Math.round(outer - inner));
    for (let i = 0; i < w; i++) {
      const x = cx + dir * (outer - i), f = i / w;
      const lvl = ghost ? (i === 0 ? 1 : 0) : f < 0.2 ? (q < 0.6 ? 5 : 4) : f < 0.45 ? 4 : f < 0.7 ? 3 : 2;
      put(frame, x, cy + j, G[Math.max(0, lvl - (k > 0.75 ? 1 : 0))], !ghost && f < 0.5);
    }
  }
}
/** 畫一道星光斬：w = { x, y, dir, t } */
export function drawWave(frame, w) {
  const k = w.t / WAVE_T;
  crescent(frame, w.x - w.dir * 16, w.y, w.dir, k, true);
  crescent(frame, w.x - w.dir * 8, w.y, w.dir, k, true);
  crescent(frame, w.x, w.y, w.dir, k, false);
  // 邊上掉的星屑
  for (let s = 0; s < 4; s++) {
    const a = (s * 1.7 + w.seed) % 1, px = w.x - w.dir * (6 + a * 18), py = w.y + (s % 2 ? -1 : 1) * (6 + ((s * 3 + Math.floor(w.t * 20)) % 5));
    put(frame, px, py, G[s % 2 ? 4 : 3], true);
  }
}
