// 怪物發現主角的「!」（特效補強 2，照 pixelfx skill 畫 → 看 → 修，草稿 game/tools/drafts/alertfx.mjs）
//   一般怪：黃色「!」；菁英：紅色「!!」。冒出來先壓扁 → 往上彈過頭 → 停住 → 最後 0.15 秒閃爍消失。共 0.7 秒。
//   外框是同色系最暗一階（不用純黑），上亮下暗三階。參考：常見動作遊戲的發現提示（只學「彈出、停住、閃掉」的節奏）。
export const ALERT_T = 0.7;
const RAMP = { n: ["#fff6c8", "#ffd84a", "#e08a1a", "#3a1a06", "#ffffff"], e: ["#ffd0c0", "#ff6a52", "#c02030", "#3a0812", "#ffffff"] };
const hexU = (h) => { const n = parseInt(h.slice(1), 16); return (0xff000000 | ((n & 255) << 16) | (n & 0xff00) | (n >>> 16)) >>> 0; };
const COL = Object.fromEntries(Object.entries(RAMP).map(([k, v]) => [k, v.map(hexU)]));
// 「!」的形狀：2 寬、棒子 5 高、空 1、點 2；squash＝壓扁版（棒子 3 高）
// 第 3 輪：頂端左邊一格白高光（v＝4）。試過把棒子底部收成 1 格，2 格寬太窄會看起來歪向一邊，不採用
function glyph(h) { const px = []; for (let y = 0; y < h; y++) for (let x = 0; x < 2; x++) { px.push([x, y, y === 0 && x === 0 ? 4 : y < 1 ? 0 : y < h - 1 ? 1 : 2]); } for (let x = 0; x < 2; x++) { px.push([x, h + 2, 1]); px.push([x, h + 3, 2]); } return px; }   // 第 2 輪：點和棒子之間多空一格（原本讀起來像 8）
const BAR = glyph(5), SQUASH = glyph(3);
/** (x, y)＝「!」底部中心（頭頂上方），t＝冒出來多久了 */
export function drawAlert(frame, x, y, t, elite = false) {
  if (t >= ALERT_T) return;
  if (t > ALERT_T - 0.15 && Math.floor(t * 30) % 2) return;   // 閃爍消失
  const C = frame.color, W = frame.w, H = frame.h, ox = frame.ox | 0, oy = frame.oy | 0, R = COL[elite ? "e" : "n"];
  const shape = t < 0.06 ? SQUASH : BAR, lift = t < 0.06 ? 0 : t < 0.14 ? 3 : t < 0.2 ? 1 : 0;
  const hgt = shape === SQUASH ? 7 : 9, copies = elite ? [-3, 2] : [0];   // 第 2 輪：「!!」拉開（原本外框黏成一團）
  const cells = new Map();
  for (const cx of copies) for (const [gx, gy, v] of shape) cells.set(`${Math.round(x) - 1 + cx + gx},${Math.round(y) - hgt - lift + gy}`, v);
  const put = (px, py, c) => { px -= ox; py -= oy; if (px >= 0 && py >= 0 && px < W && py < H) C[py * W + px] = c; };
  // 外框（上下左右）
  for (const k of cells.keys()) { const [px, py] = k.split(",").map(Number); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!cells.has(`${px + dx},${py + dy}`)) put(px + dx, py + dy, R[3]); }
  for (const [k, v] of cells) { const [px, py] = k.split(",").map(Number); put(px, py, R[v]); }
}
