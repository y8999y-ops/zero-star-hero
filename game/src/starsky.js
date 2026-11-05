// 自己畫的星空（2026-11-05，取代 town/sky.png）：城鎮、主畫面、開場共用。
// 底色：由上往下的深藍→紫漸層（場景的光可以是柔和的），一條斜斜的淡紫銀河（低頻雜訊），地平線附近一點暖光。
// 星星三層：很多暗的小星、會閃的中星、少數有十字光芒的亮星（白、淡藍、暖黃三種顏色）。
// 流星：每 5 秒一個時段，七成機率出一顆，從右上往左下劃過 0.8 秒，拖著漸淡的尾巴（時間決定，不用存狀態）。
export const SKY_W = 640;
const rnd = (a, b = 0) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
const lerp = (a, b, t) => a + (b - a) * t;
// 漸層的關鍵色（0＝頂端、1＝底端）
const GRAD = [[0, [8, 6, 24]], [0.35, [18, 12, 46]], [0.7, [44, 22, 78]], [1, [92, 44, 104]]];
function gradAt(t) {
  for (let i = 1; i < GRAD.length; i++) if (t <= GRAD[i][0]) { const [a, ca] = GRAD[i - 1], [b, cb] = GRAD[i], k = (t - a) / (b - a); return ca.map((v, j) => lerp(v, cb[j], k)); }
  return GRAD[GRAD.length - 1][1];
}
// 低頻雜訊（銀河用）
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, s = (t) => t * t * (3 - 2 * t);
  const a = rnd(xi, yi), b = rnd(xi + 1, yi), c = rnd(xi, yi + 1), d = rnd(xi + 1, yi + 1);
  return lerp(lerp(a, b, s(xf)), lerp(c, d, s(xf)), s(yf));
}
const cache = new Map();
/** 天空底色（Uint32 0xAABBGGRR，寬 SKY_W、高 H），左右可以循環 */
export function skyPixels(H) {
  if (cache.has(H)) return cache.get(H);
  const px = new Uint32Array(SKY_W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < SKY_W; x++) {
    let [r, g, b] = gradAt(y / (H - 1));
    // 銀河：沿著一條斜線，寬度跟亮度用雜訊抖動；左右接得起來（x 用 SKY_W 週期）
    const u = x / SKY_W, band = y - (H * 0.15 + Math.sin(u * Math.PI * 2) * H * 0.12 + u * 0), d = Math.abs(band) / (H * 0.16);
    const ca = Math.cos(u * Math.PI * 2), sa = Math.sin(u * Math.PI * 2);   // 繞一圈取樣，左右接縫看不出來
    const n = vnoise(ca * 3 + 10, sa * 3 + y / 18) * 0.6 + vnoise(ca * 9 + 40, sa * 9 + y / 7) * 0.4;
    const m = Math.max(0, 1 - d) ** 2 * n;
    r += m * 46; g += m * 30; b += m * 62;
    const i = y * SKY_W + x;
    px[i] = 0xff000000 | (Math.min(255, Math.round(b)) << 16) | (Math.min(255, Math.round(g)) << 8) | Math.min(255, Math.round(r));
  }
  cache.set(H, px);
  return px;
}
/** 天空底色畫成 canvas（2D 畫布用） */
export function skyCanvas(H) {
  const px = skyPixels(H), c = document.createElement("canvas");
  c.width = SKY_W; c.height = H;
  const im = new ImageData(new Uint8ClampedArray(px.buffer.slice(0)), SKY_W, H);
  c.getContext("2d").putImageData(im, 0, 0);
  return c;
}
// 星星：kind 0 暗小星、1 會閃的中星、2 十字亮星；col 0 白、1 淡藍、2 暖黃
export const STARS = [];
for (let i = 0; i < 260; i++) {
  const k = rnd(i, 7), kind = k < 0.72 ? 0 : k < 0.95 ? 1 : 2;
  STARS.push({ x: Math.floor(rnd(i, 1) * SKY_W), y: Math.floor(rnd(i, 2) ** 1.4 * 150), ph: rnd(i, 3) * 6.28, sp: 0.8 + rnd(i, 4) * 2.4, kind, col: Math.floor(rnd(i, 5) * 3) });
}
const COLS = [[255, 255, 255], [190, 220, 255], [255, 230, 170]];
/** 一顆星這一刻的顏色與亮度：回傳 [r, g, b, a] */
export function starLook(s, time) {
  const tw = 0.5 + 0.5 * Math.sin(time * s.sp + s.ph), c = COLS[s.col];
  const a = s.kind === 0 ? 0.35 + 0.25 * tw : s.kind === 1 ? 0.45 + 0.55 * tw : 0.75 + 0.25 * tw;
  return [c[0], c[1], c[2], a];
}
/** 這一刻有沒有流星：回傳 { x, y, k（0～1 進度）, len } 或 null。x、y 是天空座標（寬 SKY_W） */
export function meteorAt(time) {
  const slot = Math.floor(time / 5);
  if (rnd(slot, 91) > 0.7) return null;
  const start = slot * 5 + rnd(slot, 92) * 3.5, k = (time - start) / 0.8;
  if (k < 0 || k > 1) return null;
  const x0 = rnd(slot, 93) * SKY_W, y0 = 4 + rnd(slot, 94) * 40;
  return { x: x0 - k * 110, y: y0 + k * 55, k, len: 16 + Math.floor(rnd(slot, 95) * 10) };
}
