// 星之祭壇草稿：沒點亮 1 個＋點亮 3 個時間點，放大 6 倍。執行：node game/tools/drafts/altar.mjs out.png
import { writeFileSync } from "node:fs";
import { encodePNG } from "../../../pixelfx/tools/lib/png.mjs";
import { createFrame, composite, hex } from "../../../pixelfx/src/core/index.js";
import { drawAltar } from "../../src/altar-art.js";
const CW = 48, CH = 56, K = 6, W = CW * 4, H = CH, frame = createFrame(W, H);
for (let x = 0; x < W; x++) for (let y = CH - 6; y < CH; y++) frame.color[y * W + x] = hex(y === CH - 6 ? "#4a7a3a" : "#3a2a1e") >>> 0;
drawAltar(frame, CW / 2, CH - 6, false, 0);
[0.3, 0.9, 1.6].forEach((t, i) => drawAltar(frame, CW * (i + 1) + CW / 2, CH - 6, true, t));
const out = new Uint8ClampedArray(W * H * 4);
composite(frame, out, new Uint32Array(W * H).fill(hex("#14121e") >>> 0));
const big = new Uint8Array(W * K * H * K * 4);
for (let y = 0; y < H * K; y++) for (let x = 0; x < W * K; x++) { const s = ((y / K | 0) * W + (x / K | 0)) * 4, d = (y * W * K + x) * 4; big[d] = out[s]; big[d + 1] = out[s + 1]; big[d + 2] = out[s + 2]; big[d + 3] = 255; }
writeFileSync(process.argv[2], encodePNG(W * K, H * K, big));
