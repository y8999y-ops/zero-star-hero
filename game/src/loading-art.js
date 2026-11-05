// 載入畫面的小動畫（第 7 批，使用者要求「可愛的 loading 動畫」；照 pixelfx skill 畫→看→修）：
// 主角（星星碎片）在原地蹦蹦跳：落地壓扁、彈起拉長，眼睛會眨、臉頰紅紅；底下影子跟著縮放；旁邊三顆小星光輪流閃。
// 參考：pixelfx ui/level-up 的星光十字閃、critters 的蹦跳節奏（快起慢落、落地壓扁一下）。
// drawLoading(set, t)：set(x, y, "#rrggbb") 畫一格，畫布 W×H。草稿：game/tools/drafts/loading.mjs
export const W = 48, H = 40, CYCLE = 0.7;
const OUT = "#2a1406", G = ["#8a4c10", "#d8962a", "#f6c843", "#ffe98a", "#fffbe0"], EYE = "#2a1406", BLUSH = "#ff8a9a", SH = "#000000";

function inStar(x, y, r, rot) {
  // 五角星：極座標下外點 r、內點 r*0.5 之間線性插值（每 72° 一個角）
  const a = Math.atan2(y, x) - rot, d = Math.hypot(x, y), seg = Math.PI / 5;
  let f = ((a % (2 * seg)) + 2 * seg) % (2 * seg);
  f = Math.abs(f - seg) / seg;   // 0＝內凹點、1＝尖角
  const R = r * (0.52 + 0.48 * f);
  return d <= R;
}
export function drawLoading(set, t) {
  const p = (t % CYCLE) / CYCLE;
  // 跳：0～0.12 壓扁（落地）、0.12～1 在空中（拋物線）
  let hy = 0, sx = 1, sy = 1;
  if (p < 0.12) { const k = Math.sin((p / 0.12) * Math.PI); sx = 1 + 0.25 * k; sy = 1 - 0.22 * k; }
  else { const q = (p - 0.12) / 0.88; hy = 4 * q * (1 - q) * 11; const s = 1 - Math.abs(q - 0.5) * 2; sx = 1 - 0.08 * (1 - s); sy = 1 + 0.1 * (1 - s); }
  const ground = 34, r = 11, cx = 24, cy = ground - r * sy * 0.82 - hy, rot = -Math.PI / 2 + Math.sin(t * 4) * 0.04;
  // 影子
  const sw = Math.round(9 - hy * 0.35);
  for (let x = -sw; x <= sw; x++) { set(cx + x, ground + 1, SH, 0.55); if (Math.abs(x) < sw - 2) set(cx + x, ground + 2, SH, 0.3); }
  // 身體：先算形狀，再畫外框和明暗（左上亮、右下暗）
  const inside = (x, y) => inStar((x - cx) / sx, (y - cy) / sy, r, rot);
  for (let y = Math.floor(cy - 14); y <= ground; y++) for (let x = cx - 15; x <= cx + 15; x++) {
    const px = x + 0.5, py = y + 0.5;
    if (inside(px, py)) {
      const lx = (px - cx) / (r * sx), ly = (py - cy) / (r * sy), l = -lx * 0.6 - ly * 0.8;
      const edge = !inside(px + 1, py) || !inside(px, py + 1);
      // 第 2 輪：明暗太碎，改成大塊——身體一個顏色、左上一塊亮、右下邊緣一圈暗
      set(x, y, edge ? G[1] : l > 0.62 ? G[4] : l > 0.3 ? G[3] : G[2]);
    } else if (inside(px + 1, py) || inside(px - 1, py) || inside(px, py + 1) || inside(px, py - 1)) set(x, y, OUT);
  }
  // 臉：眼睛（每 2.1 秒眨一次）、臉頰
  const ey = Math.round(cy) - 1, blink = (t % 2.1) > 1.98;
  for (const dx of [-4, 2]) {   // 第 2 輪：眼睛 2×2、右上一格白色反光，比較有神
    if (blink) { set(cx + dx, ey + 1, EYE); set(cx + dx + 1, ey + 1, EYE); }
    else { set(cx + dx, ey, EYE); set(cx + dx + 1, ey, "#ffffff"); set(cx + dx, ey + 1, EYE); set(cx + dx + 1, ey + 1, EYE); }
    set(cx + dx + (dx < 0 ? -1 : 2), ey + 2, BLUSH);
  }
  // 第 3 輪：嘴巴原本一條線看起來像在生氣，改成上揚的小笑嘴
  set(cx - 2, ey + 3, EYE); set(cx - 1, ey + 4, EYE); set(cx, ey + 4, EYE); set(cx + 1, ey + 3, EYE);
  // 三顆小星光，輪流閃（十字，中心白）
  [[7, 12], [41, 9], [38, 26]].forEach(([x, y], i) => {
    const k = Math.sin((t * 2.4 + i * 0.33) * Math.PI * 2);
    if (k < 0.1) return;
    set(x, y, "#ffffff");
    const c = k > 0.6 ? G[3] : G[2];
    set(x - 1, y, c); set(x + 1, y, c); set(x, y - 1, c); set(x, y + 1, c);
    if (k > 0.75) { set(x - 2, y, G[1]); set(x + 2, y, G[1]); set(x, y - 2, G[1]); set(x, y + 2, G[1]); }
  });
}
