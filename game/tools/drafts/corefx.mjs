// 星核小特效草稿：上排＝彗尾（一次衝刺留下的星光，4 個時間點），下排＝暈眩星星（4 個時間點，畫在一隻假的史萊姆頭上），放大 6 倍。
// 執行：node game/tools/drafts/corefx.mjs out.png
import { writeFileSync } from "node:fs";
import { encodePNG } from "../../../pixelfx/tools/lib/png.mjs";
import { createFrame, composite, hex } from "../../../pixelfx/src/core/index.js";
import { drawTrail, drawDizzy } from "../../src/corefx.js";
const CW = 70, CH = 40, K = 6, W = CW * 4, H = CH * 2, frame = createFrame(W, H);
[0.05, 0.15, 0.3, 0.45].forEach((T, c) => {
  // 衝刺 0.2 秒、每 1/60 秒一點，從左往右
  const pts = [];
  for (let i = 0; i * (1 / 60) < Math.min(T, 0.2); i++) { const born = i / 60; pts.push({ x: c * CW + 8 + i * 4, y: 22, t: T - born, seed: i * 7 }); }
  drawTrail(frame, pts);
  const x = c * CW + 35, y = CH + 34;
  for (let j = 0; j < 14; j++) for (let i = -10; i <= 10; i++) if (i * i / 100 + ((j - 14) ** 2) / 196 <= 1) frame.color[(y - j) * W + x + i] = hex(i > 3 ? "#2a8a3a" : "#4cc04a") >>> 0;
  drawDizzy(frame, x, y - 16, T * 2);
});
const out = new Uint8ClampedArray(W * H * 4);
composite(frame, out, new Uint32Array(W * H).fill(hex("#1c1830") >>> 0));
const big = new Uint8Array(W * K * H * K * 4);
for (let y = 0; y < H * K; y++) for (let x = 0; x < W * K; x++) { const s = ((y / K | 0) * W + (x / K | 0)) * 4, d = (y * W * K + x) * 4; big[d] = out[s]; big[d + 1] = out[s + 1]; big[d + 2] = out[s + 2]; big[d + 3] = 255; }
writeFileSync(process.argv[2], encodePNG(W * K, H * K, big));
