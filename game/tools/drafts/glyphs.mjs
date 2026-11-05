// 互動鍵圖示草稿：門（傳送門）、手（撿起來／點祭壇）跟原本的對話、寶箱並排，放大 8 倍看
// 執行：node game/tools/drafts/glyphs.mjs out.png
import { writeFileSync } from "node:fs";
import { encodePNG } from "../../../pixelfx/tools/lib/png.mjs";
const G = JSON.parse(process.env.GLYPHS);
const S = 29, K = 8, names = Object.keys(G), W = names.length * (S + 4) + 4, H = S + 8;
const img = new Uint8Array(W * H * 4);
for (let i = 0; i < W * H; i++) img.set([40, 34, 60, 255], i * 4);
const put = (x, y, c) => img.set(c, (y * W + x) * 4);
names.forEach((n, j) => {
  const g = G[n], ox = 4 + j * (S + 4), oy = 4, o = 8, c = (S - 1) / 2;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const d = Math.hypot(x - c, y - c); if (d < c) put(ox + x, oy + y, d > c - 1.5 ? [230, 236, 255, 255] : [22, 18, 40, 255]); }
  const at = (x, y) => g[y]?.[x] === "#";
  for (let y = -1; y <= 13; y++) for (let x = -1; x <= 13; x++) {
    if (at(x, y)) put(ox + o + x, oy + o + y, x + y < 12 ? [255, 255, 255, 255] : [200, 212, 232, 255]);
    else if (at(x + 1, y) || at(x - 1, y) || at(x, y + 1) || at(x, y - 1)) put(ox + o + x, oy + o + y, [10, 8, 20, 255]);
  }
});
const big = new Uint8Array(W * K * H * K * 4);
for (let y = 0; y < H * K; y++) for (let x = 0; x < W * K; x++) { const s = ((y / K | 0) * W + (x / K | 0)) * 4; big.set(img.subarray(s, s + 4), (y * W * K + x) * 4); }
writeFileSync(process.argv[2], encodePNG(W * K, H * K, big));
