// 場景光影：所有光源 → 每個螢幕像素的「亮度」（0～4 的小數）＋光的顏色。
// level.js 畫場景時，環境像素在色票的相鄰兩階之間平滑混合，所以被照亮的地方是柔和的漸亮；
// 光的顏色另外加到 light 層，從光源中心往外平滑變淡。
// 光源：持續的（火把、水晶、主角、火球）每幀傳進來；暫時的（爆炸、命中、開寶箱）用 flash()。

let buf = new Float32Array(0);
let tr = new Float32Array(0), tg = new Float32Array(0), tb = new Float32Array(0);
/** 這一幀每個像素的光色加量（r, g, b 三個陣列），給 level.js 加到 light 層 */
export const tintOf = () => [tr, tg, tb];
const DEFAULT = "#ffa060";
const rgbCache = new Map();
function rgbOf(col) {
  if (!rgbCache.has(col)) {
    const v = parseInt(col.slice(1), 16);
    rgbCache.set(col, [(v >> 16) * 0.1, ((v >> 8) & 255) * 0.1, (v & 255) * 0.1]);
  }
  return rgbCache.get(col);
}
const flashes = [];

/** 加一道會慢慢縮小的閃光。x, y 是世界座標，r 半徑，lv 最亮多少，sec 持續秒數。 */
export function flash(x, y, r, lv, sec = 0.25, col = "#ffd890") {
  flashes.push({ x, y, r, lv, ttl: sec, life: sec, col });
  if (flashes.length > 40) flashes.shift();
}
export function updateLight(dt) {
  for (const f of flashes) f.ttl -= dt;
  for (let i = flashes.length - 1; i >= 0; i--) if (flashes[i].ttl <= 0) flashes.splice(i, 1);
}

/** 整個畫面一起變亮（大招爆發用），0～1，每幀由外部設定 */
export const global = { lv: 0, col: "#fff0c0" };

/**
 * 算出這一幀的亮度。list：[{ x, y, r, lv, par, col }]，col 是光的顏色，par 是光源所在圖層的視差（遊玩層 1）。
 * 回傳 Float32Array（W×H）。重疊的光會相加（上限 4），亮度從中心平滑往外衰減。
 */
export function computeLight(frame, list) {
  const W = frame.w, H = frame.h, n = W * H;
  if (buf.length < n) { buf = new Float32Array(n); tr = new Float32Array(n); tg = new Float32Array(n); tb = new Float32Array(n); }
  const g = global.lv;
  if (g > 0) {
    const [gr, gg, gb] = rgbOf(global.col);
    buf.fill(g * 4, 0, n); tr.fill(gr * g * 3, 0, n); tg.fill(gg * g * 3, 0, n); tb.fill(gb * g * 3, 0, n);
  } else { buf.fill(0, 0, n); tr.fill(0, 0, n); tg.fill(0, 0, n); tb.fill(0, 0, n); }
  const all = list.slice();
  for (const f of flashes) {
    const k = f.ttl / f.life;
    all.push({ x: f.x, y: f.y, r: f.r * (0.5 + 0.5 * k), lv: f.lv * k, col: f.col });
  }
  for (const L of all) {
    const sx = L.x - frame.ox * (L.par ?? 1), sy = L.y - frame.oy, r = L.r, lv = L.lv;
    if (sx + r < 0 || sx - r >= W || sy + r < 0 || sy - r >= H || lv <= 0) continue;
    const [cr, cg, cb] = rgbOf(L.col ?? DEFAULT), r2 = r * r, ir = 1 / r;
    const y0 = Math.max(0, Math.floor(sy - r)), y1 = Math.min(H - 1, Math.ceil(sy + r));
    const x0 = Math.max(0, Math.floor(sx - r)), x1 = Math.min(W - 1, Math.ceil(sx + r));
    for (let y = y0; y <= y1; y++) {
      const dy2 = (y - sy) ** 2, row = y * W;
      for (let x = x0; x <= x1; x++) {
        const d2 = (x - sx) ** 2 + dy2;
        if (d2 >= r2) continue;
        const f = 1 - Math.sqrt(d2) * ir, k = lv * f * f * (3 - 2 * f);   // 平滑衰減：中心亮、邊緣柔和地淡掉
        const i = row + x;
        buf[i] = Math.min(4, buf[i] + k);
        tr[i] += cr * k; tg[i] += cg * k; tb[i] += cb * k;
      }
    }
  }
  return buf;
}
