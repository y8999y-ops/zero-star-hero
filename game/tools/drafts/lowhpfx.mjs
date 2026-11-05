// 低血量草稿：一張假的遊戲畫面（格紋地面＋天空），橫排＝脈動 0 / 0.5 / 1，直排＝血量 29% / 15% / 3%，放大 2 倍
import { writeFileSync } from "node:fs";
import { encodePNG } from "../../../pixelfx/tools/lib/png.mjs";
import { drawLowHp } from "../../src/lowhpfx.js";
const FW = 320, FH = 216, S = 2, pulses = [0, 0.5, 1], hps = [0.29, 0.15, 0.03];
const W = pulses.length * (FW + 4) * S, H = hps.length * (FH + 4) * S, img = new Uint8Array(W * H * 4);
hps.forEach((k, r) => pulses.forEach((p, c) => {
  const f = { w: FW, h: FH, color: new Uint32Array(FW * FH) };
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) { const g = y > 170 ? (((x >> 3) + (y >> 3)) % 2 ? [70, 60, 96] : [56, 48, 80]) : [30 + y / 8, 26 + y / 8, 52 + y / 6].map(Math.round); f.color[y * FW + x] = (0xff000000 | (g[2] << 16) | (g[1] << 8) | g[0]) >>> 0; }
  for (let y = 150; y < 170; y++) for (let x = 150; x < 166; x++) f.color[y * FW + x] = 0xff4ad8ff;   // 假主角
  drawLowHp(f, k, p);
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) { const v = f.color[y * FW + x]; for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) img.set([v & 255, (v >>> 8) & 255, (v >>> 16) & 255, 255], (((r * (FH + 4) + y) * S + j) * W + (c * (FW + 4) + x) * S + i) * 4); }
}));
writeFileSync(process.argv[2], encodePNG(W, H, img));
