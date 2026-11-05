// 重要物件發光粒子草稿：每一列一種東西（殘火、化石核、碑文、祭壇沒亮／亮、傳送門位置、寶箱位置），每一欄一個時間點，放大 3 倍。
// 執行：node game/tools/drafts/objglow.mjs out.png
import { writeFileSync } from "node:fs";
import { encodePNG } from "../../../pixelfx/tools/lib/png.mjs";
import { createFrame, composite, hex, createFx } from "../../../pixelfx/src/core/index.js";
import * as portalFx from "../../../pixelfx/src/fx/arcane/portal.js";
import { drawEmber, drawFossil, drawSafe, drawStele } from "../../src/feature-art.js";
import { drawAltar } from "../../src/altar-art.js";
import { drawObjGlow } from "../../src/objglow.js";
const ROWS = [
  ["ember", (f, x, y, t) => drawEmber(f, x, y, t)],
  ["fossil", (f, x, y, t) => drawFossil(f, x, y, t, "#b878ff")],
  ["stele", (f, x, y, t) => drawStele(f, x, y, false, t)],
  ["altarOff", (f, x, y, t) => drawAltar(f, x, y, false, t, 0)],
  ["altarOn", (f, x, y, t) => drawAltar(f, x, y, true, t, 0)],
  ["portal", (f, x, y, t) => { const p = createFx(portalFx, { x, y }); p.update(t); p.draw(f); }],
  ["chest", (f, x, y, t) => drawSafe(f, x, y, false, t)],
];
const TS = [0.1, 0.35, 0.6, 0.85, 1.1, 1.6], CW = 72, CH = 84, K = 3, W = CW * TS.length, H = CH * ROWS.length;
const frame = createFrame(W, H);
ROWS.forEach(([k, art], r) => TS.forEach((t, c) => {
  const x = c * CW + CW / 2, y = r * CH + CH - 8;
  for (let xx = c * CW; xx < (c + 1) * CW; xx++) for (let yy = y; yy < y + 8; yy++) frame.color[yy * W + xx] = hex(yy === y ? "#4a5a3a" : "#2a221e") >>> 0;
  art(frame, x, y, t);
  drawObjGlow(frame, k, x, y, t + r * 0.37, k === "fossil" ? "#b878ff" : undefined);
}));
const out = new Uint8ClampedArray(W * H * 4);
composite(frame, out, new Uint32Array(W * H).fill(hex("#14121e") >>> 0));
const big = new Uint8Array(W * K * H * K * 4);
for (let y = 0; y < H * K; y++) for (let x = 0; x < W * K; x++) { const s = ((y / K | 0) * W + (x / K | 0)) * 4, d = (y * W * K + x) * 4; big[d] = out[s]; big[d + 1] = out[s + 1]; big[d + 2] = out[s + 2]; big[d + 3] = 255; }
writeFileSync(process.argv[2], encodePNG(W * K, H * K, big));
