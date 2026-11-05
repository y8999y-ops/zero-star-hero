// 「!」草稿：上排一般、下排菁英，每 0.05 秒一格，深底／中間底各一次，放大 6 倍
import { writeFileSync } from "node:fs";
import { encodePNG } from "../../../pixelfx/tools/lib/png.mjs";
import { drawAlert, ALERT_T } from "../../src/alertfx.js";
const FW = 16, FH = 18, S = 6, ts = []; for (let t = 0; t < ALERT_T; t += 0.05) ts.push(t);
const BGS = [[16, 12, 28], [70, 60, 96]], rows = [];
for (const bg of BGS) for (const el of [false, true]) rows.push([bg, el]);
const W = ts.length * (FW + 1) * S, H = rows.length * (FH + 1) * S, img = new Uint8Array(W * H * 4);
rows.forEach(([bg, el], r) => ts.forEach((t, c) => {
  const f = { w: FW, h: FH, ox: 0, oy: 0, color: new Uint32Array(FW * FH) };
  drawAlert(f, 8, 16, t, el);
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) { const v = f.color[y * FW + x], col = v ? [v & 255, (v >>> 8) & 255, (v >>> 16) & 255] : bg; for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) img.set([...col, 255], (((r * (FH + 1) + y) * S + j) * W + (c * (FW + 1) + x) * S + i) * 4); }
}));
writeFileSync(process.argv[2], encodePNG(W, H, img));
