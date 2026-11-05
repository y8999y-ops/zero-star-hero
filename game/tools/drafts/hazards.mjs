// 場景元素物件草稿：黏液池、油桶（完好／被打一下）、油灘（流出中／滿／著火）、廚餘堆、漏電管線（平常／放電），每個 3 個時間點，放大 6 倍。
// 執行：node game/tools/drafts/hazards.mjs out.png
import { writeFileSync } from "node:fs";
import { encodePNG } from "../../../pixelfx/tools/lib/png.mjs";
import { createFrame, composite, hex } from "../../../pixelfx/src/core/index.js";
import { drawHazard } from "../../src/hazards.js";

const ROWS = [
  { type: "goo", w: 30 }, { type: "drum", hp: 2 }, { type: "drum", hp: 1 }, { type: "oil", w: 44, spill: 0.5 }, { type: "oil", w: 44, spill: 1 },
  { type: "oil", w: 44, spill: 1, fireT: 3 }, { type: "junk", w: 26 }, { type: "pipe", zapOff: true }, { type: "pipe" },
];
const TIMES = [0.05, 0.4, 0.8], CW = 60, CH = 30, K = 6;
const W = CW * TIMES.length, H = CH * ROWS.length;
const frame = createFrame(W, H);
const ground = hex("#3a3048") >>> 0, grass = hex("#5a8a30") >>> 0;
ROWS.forEach((r, j) => TIMES.forEach((t0, c) => {
  const x = c * CW + CW / 2, floor = j * CH + CH - 4;
  for (let i = -CW / 2; i < CW / 2; i++) { frame.color[floor * W + x + i] = grass; for (let k = 1; k < 4; k++) frame.color[(floor + k) * W + x + i] = ground; }
  const t = r.type === "pipe" ? (r.zapOff ? 0.6 + t0 : t0 * 0.3) : t0;
  const put = (_f, X, Y, col, glow) => { X = Math.round(X); Y = Math.round(Y); if (X >= 0 && Y >= 0 && X < W && Y < H) { frame.color[Y * W + X] = col; if (glow) frame.light[Y * W + X] = col; } };
  drawHazard(frame, { x, shakeT: 0, fireT: 0, spill: 1, hp: 2, ...r }, t, floor, put);
}));
const out = new Uint8ClampedArray(W * H * 4);
composite(frame, out, new Uint32Array(W * H).fill(hex("#1c1830") >>> 0));
const big = new Uint8Array(W * K * H * K * 4);
for (let y = 0; y < H * K; y++) for (let x = 0; x < W * K; x++) { const s = ((y / K | 0) * W + (x / K | 0)) * 4, d = (y * W * K + x) * 4; big[d] = out[s]; big[d + 1] = out[s + 1]; big[d + 2] = out[s + 2]; big[d + 3] = 255; }
writeFileSync(process.argv[2] || "hazards.png", encodePNG(W * K, H * K, big));
