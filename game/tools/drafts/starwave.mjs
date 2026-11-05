// 星光斬草稿：朝右、朝左各 4 個時間點，放大 6 倍
import { writeFileSync } from "node:fs";
import { encodePNG } from "../../../pixelfx/tools/lib/png.mjs";
import { createFrame, composite, hex } from "../../../pixelfx/src/core/index.js";
import { drawWave, WAVE_T } from "../../src/starwave.js";
const TS = [0, 0.1, 0.2, 0.3], CW = 50, CH = 36, K = 6, W = CW * TS.length, H = CH * 2;
const frame = createFrame(W, H);
TS.forEach((t, c) => [1, -1].forEach((dir, r) => drawWave(frame, { x: c * CW + CW / 2, y: r * CH + CH / 2, dir, t: Math.min(t, WAVE_T), seed: 0.3 })));
const out = new Uint8ClampedArray(W * H * 4);
composite(frame, out, new Uint32Array(W * H).fill(hex("#1c1830") >>> 0));
const big = new Uint8Array(W * K * H * K * 4);
for (let y = 0; y < H * K; y++) for (let x = 0; x < W * K; x++) { const s = ((y / K | 0) * W + (x / K | 0)) * 4, d = (y * W * K + x) * 4; big[d] = out[s]; big[d + 1] = out[s + 1]; big[d + 2] = out[s + 2]; big[d + 3] = 255; }
writeFileSync(process.argv[2], encodePNG(W * K, H * K, big));
