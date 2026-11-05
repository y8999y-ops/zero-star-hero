// 外框草稿：每個主題畫一個 150×80 的九宮格視窗（裡面放兩張卡片），放大 4 倍。node game/tools/drafts/ui-frames.mjs out.png
import { writeFileSync } from "node:fs";
import { encodePNG } from "../../../pixelfx/tools/lib/png.mjs";
import { frameArt, THEMES } from "../../src/frame-art.js";

const K = 4, WW = 150, WH = 80, PAD = 6, names = Object.keys(THEMES);
const W = (WW + PAD * 2) * 2, H = (WH + PAD * 2) * Math.ceil(names.length / 2);
const buf = new Float32Array(W * H * 3);
// 背景：暗紫夜空的漸層（像遊戲裡的場景）
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 3; buf[i] = 30 + (x % 40 < 20 ? 6 : 0); buf[i + 1] = 22; buf[i + 2] = 52 + y % 30; }
const parse = (c) => {
  if (c.startsWith("#")) return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16), 1];
  const m = c.match(/[\d.]+/g).map(Number);
  return [m[0], m[1], m[2], m[3] ?? 1];
};
const put = (x, y, c) => { if (!c || x < 0 || y < 0 || x >= W || y >= H) return; const [r, g, b, a] = parse(c), i = (y * W + x) * 3; buf[i] = buf[i] * (1 - a) + r * a; buf[i + 1] = buf[i + 1] * (1 - a) + g * a; buf[i + 2] = buf[i + 2] * (1 - a) + b * a; };
// 九宮格：角 S×S 原樣，邊和中間重複中間那一格
function nine(art, x0, y0, w, h, S) {
  const N = art.w, M = N - S * 2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = x < S ? x : x >= w - S ? N - (w - x) : S + ((x - S) % M);
    const sy = y < S ? y : y >= h - S ? N - (h - y) : S + ((y - S) % M);
    put(x0 + x, y0 + y, art.px[sy * N + sx]);
  }
}
names.forEach((n, i) => {
  const x0 = (i % 2) * (WW + PAD * 2) + PAD, y0 = Math.floor(i / 2) * (WH + PAD * 2) + PAD;
  nine(frameArt(n), x0, y0, WW, WH, 8);
  nine(frameArt(n, true), x0 + 10, y0 + 14, WW - 20, 24, 6);
  nine(frameArt(n, true), x0 + 10, y0 + 42, WW - 20, 24, 6);
});
const out = new Uint8Array(W * K * H * K * 4);
for (let y = 0; y < H * K; y++) for (let x = 0; x < W * K; x++) {
  const i = ((y / K | 0) * W + (x / K | 0)) * 3, o = (y * W * K + x) * 4;
  out[o] = buf[i]; out[o + 1] = buf[i + 1]; out[o + 2] = buf[i + 2]; out[o + 3] = 255;
}
writeFileSync(process.argv[2], encodePNG(W * K, H * K, out));
console.log("wrote", process.argv[2]);
