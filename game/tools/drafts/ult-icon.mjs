// 大招圖示草稿：能量 0、25、50、75、95% 和集滿的 4 格動畫，放大 8 倍，深色和遊戲畫面色兩種底
// 執行：node game/tools/drafts/ult-icon.mjs out.png
import { writeFileSync } from "node:fs";
import { encodePNG } from "../../../pixelfx/tools/lib/png.mjs";
import { ultPixels, ULT_S } from "../../src/ult-icon.js";

const K = 8, S = ULT_S, cell = S * K + 12;
const shots = [[0, 0], [0.25, 0.3], [0.5, 0.6], [0.75, 0.9], [0.95, 1.2], [1, 0], [1, 0.2], [1, 0.45], [1, 0.7]];
const BG = [[18, 12, 30], [60, 46, 84]];
const W = shots.length * cell, H = BG.length * cell;
const img = new Uint8Array(W * H * 4);
BG.forEach((bg, r) => {
  for (let y = r * cell; y < (r + 1) * cell; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; img[i] = bg[0]; img[i + 1] = bg[1]; img[i + 2] = bg[2]; img[i + 3] = 255; }
  shots.forEach(([k, t], c) => {
    const px = ultPixels(k, t);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const s = (y * S + x) * 4, a = px[s + 3] / 255;
      if (!a) continue;
      for (let dy = 0; dy < K; dy++) for (let dx = 0; dx < K; dx++) {
        const i = ((r * cell + 6 + y * K + dy) * W + c * cell + 6 + x * K + dx) * 4;
        for (let q = 0; q < 3; q++) img[i + q] = img[i + q] * (1 - a) + px[s + q] * a;
      }
    }
  });
});
writeFileSync(process.argv[2] || "ult-icon.png", encodePNG(W, H, img));
