// 機關與資源草稿：上排＝機關（裂牆完整／裂開、氣流、黏液菇平常／被踩扁、封印沒亮／亮了／打開一半），
// 下排＝資源（殘火、礦脈 0／2 下、化石核、保險箱關／開、碑文沒讀／讀過），放大 4 倍。執行：node game/tools/drafts/features.mjs out.png
import { writeFileSync } from "node:fs";
import { encodePNG } from "../../../pixelfx/tools/lib/png.mjs";
import { createFrame, composite, hex } from "../../../pixelfx/src/core/index.js";
import * as F from "../../src/feature-art.js";
const W = 400, H = 150, K = 4, frame = createFrame(W, H), t = 0.7;
for (const fy of [70, 140]) for (let x = 0; x < W; x++) for (let y = fy; y < fy + 4; y++) frame.color[y * W + x] = hex(y === fy ? "#4a7a3a" : "#2a2e48") >>> 0;
F.drawCrack(frame, 24, 70, 1, t); F.drawCrack(frame, 64, 70, 0.4, t);
F.drawWind(frame, 110, 70, 28, 64, t);
F.drawShroom(frame, 156, 70, 0, t); F.drawShroom(frame, 190, 70, 1, t);
F.drawSeal(frame, 232, 70, 0, 0, t); F.drawSeal(frame, 266, 70, 1, 0, t); F.drawSeal(frame, 300, 70, 1, 0.5, t);
F.drawEmber(frame, 20, 140, t); F.drawVein(frame, 60, 140, 0, t); F.drawVein(frame, 100, 140, 2, t);
F.drawFossil(frame, 140, 140, t); F.drawSafe(frame, 180, 140, false, t); F.drawSafe(frame, 220, 140, true, t);
F.drawStele(frame, 260, 140, false, t); F.drawStele(frame, 296, 140, true, t);
const out = new Uint8ClampedArray(W * H * 4);
composite(frame, out, new Uint32Array(W * H).fill(hex("#14121e") >>> 0));
const big = new Uint8Array(W * K * H * K * 4);
for (let y = 0; y < H * K; y++) for (let x = 0; x < W * K; x++) { const s = ((y / K | 0) * W + (x / K | 0)) * 4, d = (y * W * K + x) * 4; big[d] = out[s]; big[d + 1] = out[s + 1]; big[d + 2] = out[s + 2]; big[d + 3] = 255; }
writeFileSync(process.argv[2], encodePNG(W * K, H * K, big));
