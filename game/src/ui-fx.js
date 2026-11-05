// 介面上的像素特效（pixelfx）：蓋在整個畫面上的一張透明畫布，每 2 個螢幕像素＝1 個特效像素。
// 用法：uiFx(特效模組, 選項, 螢幕 x, 螢幕 y)。特效播完自己消失，沒有特效時不跑迴圈。
// 工坊強化（打鐵火花、開副屬性、失敗）用。
import { createFrame, clearFrame, createFx, composite } from "../../pixelfx/src/core/index.js";

const K = 2;   // 每 2 個螢幕像素＝1 個特效像素（3 太大，蓋過整列）
let cv = null, g = null, frame = null, img = null, list = [], last = 0, running = false;

function ensure() {
  const w = Math.ceil(innerWidth / K), h = Math.ceil(innerHeight / K);
  if (!cv) {
    cv = document.createElement("canvas");
    cv.id = "uiFx";
    Object.assign(cv.style, { position: "fixed", inset: "0", width: "100vw", height: "100vh", pointerEvents: "none", zIndex: 60, imageRendering: "pixelated" });
    document.body.appendChild(cv);
    g = cv.getContext("2d");
  }
  if (!frame || frame.w !== w || frame.h !== h) {
    cv.width = w; cv.height = h;
    frame = createFrame(w, h);
    img = new ImageData(w, h);
  }
}
function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  clearFrame(frame);
  for (const f of list) { f.update(dt); f.draw(frame); }
  list = list.filter((f) => !f.done());
  composite(frame, img.data, null);
  g.putImageData(img, 0, 0);
  if (list.length) requestAnimationFrame(tick);
  else { running = false; g.clearRect(0, 0, cv.width, cv.height); }
}
/** 在螢幕座標 (x, y) 播一個特效 */
export function uiFx(mod, opts, x, y) {
  ensure();
  // 特效的原點多半在「地面」（下緣），介面上要的是畫面中心對準 (x, y)：照 meta 的 size／origin 往下移
  const m = mod.meta ?? {}, dy = m.size && m.origin ? m.origin[1] - m.size[1] / 2 : 0;
  list.push(createFx(mod, { ...opts, x: Math.round(x / K), y: Math.round(y / K + dy) }));
  if (!running) { running = true; last = performance.now(); requestAnimationFrame(tick); }
}
