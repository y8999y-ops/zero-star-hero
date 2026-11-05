// 低血量警告（特效補強 3，照 pixelfx skill 畫 → 看 → 修，草稿 game/tools/drafts/lowhpfx.mjs）
//   血量 < 30%：畫面四角往暗紅染（兩階、用抖動網點過渡，不用柔邊漸層，保持像素感），跟著心跳一下一下脈動；
//   血越少，紅得越往中間、跳得越快。心跳的「咚、咚」在 main.js 跟著拍子播。
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const RED = [[160, 18, 26], [86, 6, 14]];   // 外圈、最角落（第 2 輪：原本偏紫紅，不像危險 → 純一點的紅）
/** k＝血量比例（0～0.3 有效）、pulse＝0～1 的脈動（剛跳的瞬間 1，慢慢退） */
export function drawLowHp(frame, k, pulse, zoom = 1, dy0 = 0) {   // zoom：鏡頭拉近時畫布四周會被裁掉，照「看得到的範圍」算四角；dy0：看得到的範圍往下移幾格
  if (k >= 0.3) return;
  const W = frame.w, H = frame.h, C = frame.color, danger = 1 - k / 0.3;   // 0（剛好 30%）～ 1（快死）
  // 第 2 輪：原本 29% 沒跳的時候就紅到整片地面 → 起點往外推，剛到 30% 只有一條細邊；中間永遠不染（不蓋到主角）
  const reach = Math.max(0.6, 0.93 - 0.22 * danger - 0.1 * pulse);   // 紅色從多遠開始（越小越往中間）
  const amt = 0.3 + 0.3 * danger + 0.4 * pulse;
  const cx = W / 2, cy = H / 2 + dy0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = ((x - cx) / cx) * zoom, dy = ((y - cy) / (H / 2)) * zoom, d = Math.sqrt(dx * dx * 0.7 + dy * dy * 1.0) / Math.sqrt(1.7) * 1.3;
    let v = (d - reach) / (1 - reach) * amt;
    if (v <= 0) continue;
    const th = BAYER[((y & 3) << 2) | (x & 3)] / 16;
    // 第 3 輪：原本兩階的交界是一圈清楚的橢圓（像相框）→ 第一階的抖動過渡拉長、第二階只留在最角落
    const step = v > 0.82 + th * 0.18 ? 2 : v > th ? 1 : 0;
    if (!step) continue;
    const i = y * W + x, c = C[i], r = c & 255, g = (c >>> 8) & 255, b = (c >>> 16) & 255, [tr, tg, tb] = RED[step - 1], m = step === 1 ? 0.38 : 0.62;
    C[i] = (0xff000000 | (Math.round(b + (tb - b) * m) << 16) | (Math.round(g + (tg - g) * m) << 8) | Math.round(r + (tr - r) * m)) >>> 0;
  }
}
/** 心跳的脈動曲線：phase 0～1 一拍；兩下（咚、咚）各一個快速上升、慢慢退的尖峰 */
export function beat(phase) {
  const p1 = phase < 0.5 ? Math.exp(-phase * 14) : 0, p2 = phase > 0.18 && phase < 0.7 ? 0.6 * Math.exp(-(phase - 0.18) * 14) : 0;
  return Math.min(1, p1 + p2);
}
