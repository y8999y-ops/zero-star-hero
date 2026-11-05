// 載入動畫草稿：8 個時間點排一排，放大 6 倍。執行：node game/tools/drafts/loading.mjs out.png
import { writeFileSync } from "node:fs";
import { encodePNG } from "../../../pixelfx/tools/lib/png.mjs";
import { drawLoading, W, H, CYCLE } from "../../src/loading-art.js";
const T = [0, 0.04, 0.09, 0.2, 0.35, 0.45, 0.6, 2.0], K = 6, CW = W * T.length, img = new Uint8Array(CW * H * 4);
for (let i = 0; i < CW * H; i++) img.set([16, 12, 28, 255], i * 4);
T.forEach((t, c) => drawLoading((x, y, h, a = 1) => {
  x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * CW + c * W + x) * 4, v = [1, 3, 5].map((o) => parseInt(h.slice(o, o + 2), 16));
  for (let k = 0; k < 3; k++) img[i + k] = img[i + k] * (1 - a) + v[k] * a;
}, t));
const big = new Uint8Array(CW * K * H * K * 4);
for (let y = 0; y < H * K; y++) for (let x = 0; x < CW * K; x++) big.set(img.subarray(((y / K | 0) * CW + (x / K | 0)) * 4, ((y / K | 0) * CW + (x / K | 0)) * 4 + 4), (y * CW * K + x) * 4);
writeFileSync(process.argv[2], encodePNG(CW * K, H * K, big));
