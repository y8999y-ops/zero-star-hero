// 碎星鎮居民共用的畫法（照 PixelFX critters 的做法）：用圓、橢圓、管子組成身體，
// 每一格依「表面朝哪裡」算受光（光從左上前方來），分成 5 階；最亮的地方點一個高光；外框亮面那側用深色、背光側用最暗色。
// 規則v2：硬邊、1px 外框、精簡色盤；光暈、孢子這些是特效層。
import { hex } from "../../../pixelfx/src/core/index.js";

const LX = -0.52, LY = -0.68, LZ = 0.52;
/** 色票：[外框, 最暗, 暗, 中, 亮, 最亮, 高光]（7 個 hex）→ 數字 */
export const ramp = (a) => a.map((c) => hex(c));
/** 表面法線（nx, ny 在 -1～1，nz 自動算）→ 色票裡的顏色 */
export function lightN(R, nx, ny, bias = 0) {
  const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)), d = LX * nx + LY * ny + LZ * nz + bias;
  return R[d > 0.8 ? 5 : d > 0.5 ? 4 : d > 0.18 ? 3 : d > -0.2 ? 2 : 1];
}
/** 立體的橢圓（球）：受光分階＋左上一點高光 */
export function ball(g, cx, cy, rx, ry, R, { spec = true, bias = 0, a = 1 } = {}) {
  g.ellipse(cx, cy, rx, ry, (nx, ny) => lightN(R, nx, ny, bias), a);
  if (spec && rx >= 3 && ry >= 3) g.set(cx - rx * 0.42, cy - ry * 0.5, R[6]);
}
/** 上半圓頂（蘑菇蓋、龜殼）：底邊是平的 */
export function dome(g, cx, by, rx, ry, R, bias = 0) {
  g.shade(cx - rx, by - ry, cx + rx, by, (x, y) => {
    const nx = (x - cx) / rx, ny = (y - by) / ry;
    if (nx * nx + ny * ny > 1 || y > by) return 0;
    return lightN(R, nx, ny, bias);
  });
}
/** 直立的圓柱（蘑菇柄）：左右受光不同，上下一樣 */
export function cylinder(g, cx, y0, y1, rx, R, bias = 0, taper = 0) {
  g.shade(cx - rx - 1, y0, cx + rx + 1, y1, (x, y) => {
    const k = (y - y0) / Math.max(1, y1 - y0), r = rx * (1 - taper * (1 - k));
    const nx = (x - cx) / r;
    if (Math.abs(nx) > 1) return 0;
    return lightN(R, nx, -0.1, bias);
  });
}
/** 管子（手、腳、脖子）：沿著管子的上緣受光 */
export function limb(g, pts, r, R) {
  g.tube(pts, r, (u, v) => (v < 0.45 ? R[4] : v < 0.8 ? R[3] : R[2]));
}
/** 外框：亮面（左上）那側用 lit 色，其他用 dark 色 */
export function outline(g, dark, lit) {
  g.outline((x, y, nx, ny) => (nx <= 0 && ny <= 0 ? lit : dark));
}
/** 走路用的上下彈：0～1 的相位 → 位移 */
export const bobOf = (ph, amp = 1) => Math.round(Math.abs(Math.sin(ph * Math.PI)) * amp);
