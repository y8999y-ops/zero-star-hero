// 套裝特效草稿：流星記號、小流星（4 個時間點）、護盾（滿／一半）、共鳴光點，放大 6 倍，中間放一個假主角（黃色星形方塊）
import { writeFileSync } from "node:fs";
import { encodePNG } from "../../../pixelfx/tools/lib/png.mjs";
import { createFrame, composite, hex } from "../../../pixelfx/src/core/index.js";
import { drawMark, drawStrike, drawShield, drawReson, drawKingBack, drawKingFront, STRIKE_T } from "../../src/setfx.js";
const CW = 50, CH = 70, K = 6, W = CW * 4, H = CH * 4;
const frame = createFrame(W, H);
const hero = (x, y) => { for (let j = -10; j <= 10; j++) for (let i = -7; i <= 7; i++) if (Math.abs(i) + Math.abs(j) * 0.6 < 8) frame.color[(y + j) * W + x + i] = hex("#f0b424") >>> 0; };
[0, 0.15, 0.3, 0.45].forEach((t, c) => { const x = c * CW + 25, y = 30; hero(x, y + 10); drawMark(frame, x, y - 6, t); });
[0, 0.07, 0.14, 0.21].forEach((t, c) => drawStrike(frame, { x: c * CW + 20, y: CH + 64, t: Math.min(t, STRIKE_T) }));
[[1, 0], [0.5, 0.5], [1, 1.2], [0, 0.3]].forEach(([k, t], c) => { const x = c * CW + 25, y = CH * 2 + 35; hero(x, y); if (c < 3) drawShield(frame, x, y, k, t); else drawReson(frame, x, y, t); });
[0, 0.3, 0.6, 0.9].forEach((t, c) => { const x = c * CW + 25, y = CH * 3 + 40; drawKingBack(frame, x, y, t); hero(x, y); drawKingFront(frame, x, y, t); });
const out = new Uint8ClampedArray(W * H * 4);
composite(frame, out, new Uint32Array(W * H).fill(hex("#1c1830") >>> 0));
const big = new Uint8Array(W * K * H * K * 4);
for (let y = 0; y < H * K; y++) for (let x = 0; x < W * K; x++) { const s = ((y / K | 0) * W + (x / K | 0)) * 4, d = (y * W * K + x) * 4; big[d] = out[s]; big[d + 1] = out[s + 1]; big[d + 2] = out[s + 2]; big[d + 3] = 255; }
writeFileSync(process.argv[2], encodePNG(W * K, H * K, big));
