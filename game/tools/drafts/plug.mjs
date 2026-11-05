// 屋頂破洞被垃圾塞住的草稿：洞（64×48）在兩段屋頂中間；t＝0、0.1、0.2、0.3、0.6、1.2，放大 3 倍
import { writeFileSync } from "node:fs";
import { encodePNG } from "../../../pixelfx/tools/lib/png.mjs";
import { createFrame } from "../../../pixelfx/src/core/index.js";
import { drawPlug } from "../../src/feature-art.js";
const FW = 140, FH = 130, S = 3, ts = [0, 0.1, 0.2, 0.3, 0.6, 1.2];
const W = ts.length * (FW + 2) * S, H = (FH + 2) * S, img = new Uint8Array(W * H * 4);
ts.forEach((t, c) => {
  const f = createFrame(FW, FH);
  drawPlug(f, 38, 60, 64, 48, t);
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
    const roof = y >= 60 && y < 108 && (x < 38 || x >= 102);
    let col = roof ? (y === 60 ? [228, 176, 114] : [90, 62, 78]) : y >= 108 ? [18, 14, 28] : [26, 20, 40];
    const v = f.color[y * FW + x]; if (v >>> 24) col = [v & 255, (v >>> 8) & 255, (v >>> 16) & 255];
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) img.set([...col, 255], ((y * S + j) * W + (c * (FW + 2) + x) * S + i) * 4);
  }
});
writeFileSync(process.argv[2], encodePNG(W, H, img));
