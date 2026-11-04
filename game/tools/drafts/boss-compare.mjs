// 比較圖：原本的史萊姆（PixelFX critters/slime）和王草稿，放大到同樣倍數排在一起。
//   node game/tools/drafts/boss-compare.mjs docs/王草稿-比較.png
import { writeFileSync } from "node:fs";
import { encodePNG } from "../../../pixelfx/tools/lib/png.mjs";
import { loadEffect, renderFrames } from "../../../pixelfx/tools/lib/fxlib.mjs";
import { boss } from "./boss-drafts.mjs";

const K = 5, BG = [28, 26, 42];
const fx = await loadEffect("critters/slime");
const r = renderFrames(fx, { bg: "none", fps: 30 });
const pick = (t) => r.frames[Math.round(t * 30) % r.n].clear;
// 剪出史萊姆的範圍
function crop(rgba, w, h) {
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (rgba[(y * w + x) * 4 + 3] > 200) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1, at: (x, y) => rgba.subarray(((y + y0) * w + x + x0) * 4, ((y + y0) * w + x + x0) * 4 + 4) };
}
const slimes = [0.3, 1.0, 1.5].map((t) => crop(pick(t), r.w, r.h));
const b = boss("idle", 0);
const hex = (s) => [1, 3, 5].map((k) => parseInt(s.slice(k, k + 2), 16));

const W = 6 + slimes.reduce((n, s) => n + s.w + 6, 0) + b.W + 6, H = Math.max(b.H, ...slimes.map((s) => s.h)) + 12;
const img = new Uint8Array(W * K * H * K * 4);
for (let i = 0; i < W * K * H * K; i++) { img.set(BG, i * 4); img[i * 4 + 3] = 255; }
const put = (x, y, rgb, a = 255) => {
  for (let i = 0; i < K; i++) for (let j = 0; j < K; j++) {
    const o = ((y * K + j) * W * K + x * K + i) * 4, k = a / 255;
    for (let c = 0; c < 3; c++) img[o + c] = Math.round(img[o + c] * (1 - k) + rgb[c] * k);
  }
};
let ox = 6;
for (const s of slimes) {
  const oy = H - 6 - s.h;
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) { const p = s.at(x, y); if (p[3]) put(ox + x, oy + y, [p[0], p[1], p[2]], p[3]); }
  ox += s.w + 6;
}
const oy = H - 6 - b.H;
for (let y = 0; y < b.H; y++) for (let x = 0; x < b.W; x++) if (b.px[y][x]) put(ox + x, oy + y, hex(b.px[y][x]));
writeFileSync(process.argv[2] ?? "compare.png", encodePNG(W * K, H * K, img));
console.log("ok", slimes.map((s) => s.w + "x" + s.h).join(" "));
