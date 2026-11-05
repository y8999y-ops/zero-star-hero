// 元素狀態特效草稿：一隻假的史萊姆（綠色半圓）和一隻假的垃圾桶（直筒），身上分別掛 6 種狀態，每種 4 個時間點，放大 6 倍。
// 執行：node game/tools/drafts/status-overlay.mjs out.png
import { writeFileSync } from "node:fs";
import { encodePNG } from "../../../pixelfx/tools/lib/png.mjs";
import { createFrame, composite, hex } from "../../../pixelfx/src/core/index.js";
import { drawStatus } from "../../src/status.js";

const IDS = ["burn", "poison", "slime", "shock", "wet", "oil", "stuck"], TIMES = [0, 0.27, 0.53, 0.81];
const CW = 40, CH = 44, K = 6;
const W = CW * TIMES.length * 2, H = CH * IDS.length;
const frame = createFrame(W, H);
const body = (x, y, kind) => {
  const c1 = hex(kind === "slime" ? "#4cc04a" : "#5a9a6a") >>> 0, c2 = hex(kind === "slime" ? "#2a8a3a" : "#3a6a4a") >>> 0;
  for (let j = 0; j < (kind === "slime" ? 20 : 30); j++) for (let i = -12; i <= 12; i++) {
    const inside = kind === "slime" ? (i * i) / 144 + ((j - 20) ** 2) / 400 <= 1 : Math.abs(i) <= 9;
    if (inside) frame.color[(y - j) * W + x + i] = i > 3 ? c2 : c1;
  }
};
IDS.forEach((id, r) => TIMES.forEach((t, c) => ["slime", "trash"].forEach((kind, q) => {
  const x = (c * 2 + q) * CW + CW / 2, y = r * CH + CH - 6;
  body(x, y, kind);
  const e = { x, y, dead: false, clock: t + x * 0.01, st: { [id]: 5, big: 0 }, box: () => (kind === "slime" ? { x0: x - 15, x1: x + 15, y0: y - 22, y1: y } : { x0: x - 11, x1: x + 11, y0: y - 30, y1: y }) };
  drawStatus(frame, e);
})));
const out = new Uint8ClampedArray(W * H * 4);
const bg = new Uint32Array(W * H).fill(hex("#1c1830") >>> 0);
composite(frame, out, bg);
const big = new Uint8Array(W * K * H * K * 4);
for (let y = 0; y < H * K; y++) for (let x = 0; x < W * K; x++) { const s = ((y / K | 0) * W + (x / K | 0)) * 4, d = (y * W * K + x) * 4; big[d] = out[s]; big[d + 1] = out[s + 1]; big[d + 2] = out[s + 2]; big[d + 3] = 255; }
writeFileSync(process.argv[2] || "status.png", encodePNG(W * K, H * K, big));
