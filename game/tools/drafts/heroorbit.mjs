// 背包左欄「星星＋裝備軌道」草稿：幾個時間點並排，裝備格用色塊代替（實際是 DOM 格子蓋在上面），放大 3 倍。
// 執行：node game/tools/drafts/heroorbit.mjs out.png
import { writeFileSync } from "node:fs";
import { encodePNG } from "../../../pixelfx/tools/lib/png.mjs";
import { createFrame, composite, hex } from "../../../pixelfx/src/core/index.js";
import { paintStar, POSES } from "../../src/star.js";
import { drawOrbit, blit2x } from "../../src/heroorbit.js";
const CW = 113, CH = 104, TS = [0, 0.7, 1.4, 2.1], K = 3, W = CW * TS.length, H = CH;
const cols = ["#5aa6ff", "#b878ff", "#e8e6f2", null, "#5ad06a", "#ff8a2a", "#5aa6ff"];
const out = new Uint8ClampedArray(W * H * 4);
TS.forEach((t, c) => {
  const f = createFrame(CW, CH), o = { cx: 56, cy: 50, rx: 47, ry: 41, feet: 50 + 20, slots: cols.map((col, i) => ({ a: (i / 7) * Math.PI * 2 - Math.PI / 2 + t * 0.07, col })) };
  drawOrbit(f, t, o, "back");
  const sf = createFrame(48, 64); paintStar(sf, 24, 50, POSES.stand, false, { glow: 0 });
  blit2x(f, sf, 56, 50 + 20 + 28 + Math.round(Math.sin(t * 2.5)));
  drawOrbit(f, t, o, "front");
  for (const s of o.slots) { const x = Math.round(o.cx + Math.cos(s.a) * o.rx), y = Math.round(o.cy + Math.sin(s.a) * o.ry); for (let dy = -10; dy < 10; dy++) for (let dx = -10; dx < 10; dx++) if (Math.abs(dx) > 8 || Math.abs(dy) > 8) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < CW && Y < CH) f.color[Y * CW + X] = hex(s.col ?? "#3a2f52") >>> 0; } }
  const o2 = new Uint8ClampedArray(CW * CH * 4);
  composite(f, o2, new Uint32Array(CW * CH).fill(hex("#1a1430") >>> 0));
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) for (let k = 0; k < 4; k++) out[(y * W + c * CW + x) * 4 + k] = o2[(y * CW + x) * 4 + k];
});
const big = new Uint8Array(W * K * H * K * 4);
for (let y = 0; y < H * K; y++) for (let x = 0; x < W * K; x++) { const s = ((y / K | 0) * W + (x / K | 0)) * 4, d = (y * W * K + x) * 4; big[d] = out[s]; big[d + 1] = out[s + 1]; big[d + 2] = out[s + 2]; big[d + 3] = 255; }
writeFileSync(process.argv[2], encodePNG(W * K, H * K, big));
