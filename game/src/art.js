// 美術素材（game/art/approved 的 PNG）：載入成 Uint32 像素陣列，格式跟畫面緩衝區一樣（0xAABBGGRR），
// 可以直接一格一格貼進城鎮、關卡的圖層。透明的像素是 0（alpha 0），貼的時候跳過。
const BASE = new URL("../art/approved/", import.meta.url);

function decode(img) {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height);
  const px = new Uint32Array(d.data.buffer.slice(0));
  for (let i = 0; i < px.length; i++) if (px[i] >>> 24 === 0) px[i] = 0;
  return { w: c.width, h: c.height, px };
}
function loadOne(name) {
  return new Promise((ok, bad) => {
    const img = new Image();
    img.onload = () => ok(decode(img));
    img.onerror = () => bad(new Error("art: " + name));
    img.src = new URL(name + ".png", BASE).href;
  });
}
/** 載入好幾張：回傳 { 名稱: {w, h, px} }。沒有瀏覽器（node 預覽工具）時回傳空的。 */
export async function loadArt(names) {
  if (typeof document === "undefined") return {};
  const list = await Promise.all(names.map(loadOne));
  return Object.fromEntries(names.map((n, i) => [n, list[i]]));
}
/** 素材表裡的一格（cw x ch，第 i 格） */
export function cell(sheet, i, cw, ch) {
  const px = new Uint32Array(cw * ch);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) px[y * cw + x] = sheet.px[y * sheet.w + i * cw + x];
  return { w: cw, h: ch, px };
}
/** 底部有內容的最後一列（物件站在地上時，用它對齊地面） */
export function baseRow(img) {
  for (let y = img.h - 1; y >= 0; y--) for (let x = 0; x < img.w; x++) if (img.px[y * img.w + x]) return y;
  return img.h - 1;
}
/**
 * 把圖貼進緩衝區（x, y 是圖的左上角）。wrap：左右循環的圖層。onPx(i, c)：每貼一格呼叫（標記發光之類）。
 */
export function blit(buf, BW, BH, img, x0, y0, { wrap = false, onPx } = {}) {
  for (let y = 0; y < img.h; y++) {
    const by = y0 + y;
    if (by < 0 || by >= BH) continue;
    for (let x = 0; x < img.w; x++) {
      const c = img.px[y * img.w + x];
      if (!c) continue;
      let bx = x0 + x;
      if (wrap) bx = ((bx % BW) + BW) % BW; else if (bx < 0 || bx >= BW) continue;
      const i = by * BW + bx;
      buf[i] = c;
      if (onPx) onPx(i, c, bx, by);
    }
  }
}
/** 自己會發光的顏色：亮的青色（窗戶、水晶）、亮的金橘色（燈、爐火、碎片） */
export function glows(c) {
  const r = c & 255, g = (c >>> 8) & 255, b = (c >>> 16) & 255;
  return (g >= 170 && b >= 200 && r < 140) || (r >= 230 && g >= 150 && b < 130);
}
/**
 * 從發光像素找光源：每 cell 格一組，回傳 [{x, y, n, col}]（n＝像素數，col＝平均色 #rrggbb）。
 */
export function glowClusters(points, cellSize = 20) {
  const groups = new Map();
  for (const [x, y, c] of points) {
    const k = Math.floor(x / cellSize) + "," + Math.floor(y / cellSize);
    let g = groups.get(k);
    if (!g) groups.set(k, (g = { sx: 0, sy: 0, n: 0, r: 0, g: 0, b: 0 }));
    g.sx += x; g.sy += y; g.n++; g.r += c & 255; g.g += (c >>> 8) & 255; g.b += (c >>> 16) & 255;
  }
  const hx = (v) => Math.round(v).toString(16).padStart(2, "0");
  return [...groups.values()].filter((g) => g.n >= 4).map((g) => ({ x: g.sx / g.n, y: g.sy / g.n, n: g.n, col: "#" + hx(g.r / g.n) + hx(g.g / g.n) + hx(g.b / g.n) }));
}
