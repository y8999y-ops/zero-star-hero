// 死亡／重生演出草稿：上兩排＝碎掉（每 0.05 秒一格），下兩排＝重生，放大 3 倍，顏色＋光（加法）合成
// 執行：node game/tools/drafts/deathfx.mjs out.png [形態顏色]
import { writeFileSync } from "node:fs";
import { encodePNG } from "../../../pixelfx/tools/lib/png.mjs";
import { createDeathFx } from "../../src/deathfx.js";
const col = process.argv[3] || "#ffd84a", FW = 96, FH = 84, S = 3, COLS = 12;
const runs = [["shatter", 1.3], ["regather", 1.15]];
const cells = [];
for (const [k, dur] of runs) {
  const fx = createDeathFx(); fx[k](48, 70, col);
  for (let t = 0; t <= dur + 0.001; t += 0.05) {
    const frame = { w: FW, h: FH, ox: 0, oy: 0, color: new Uint32Array(FW * FH), light: new Uint32Array(FW * FH) };
    fx.draw(frame); cells.push(frame); fx.update(0.05);
  }
  while (cells.length % COLS) cells.push(null);
}
const rows = cells.length / COLS, W = COLS * (FW + 2) * S, H = rows * (FH + 2) * S, img = new Uint8Array(W * H * 4);
for (let i = 0; i < W * H; i++) img.set([8, 6, 14, 255], i * 4);
cells.forEach((f, n) => {
  const bx = (n % COLS) * (FW + 2), by = Math.floor(n / COLS) * (FH + 2);
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
    let r = 22, g = 18, b = 36;
    if (y >= 70) { r = 40; g = 34; b = 58; }   // 地面
    if (f) { const c = f.color[y * FW + x]; if (c) { r = c & 255; g = (c >>> 8) & 255; b = (c >>> 16) & 255; } const l = f.light[y * FW + x]; if (l) { r = Math.min(255, r + (l & 255) * 0.5); g = Math.min(255, g + ((l >>> 8) & 255) * 0.5); b = Math.min(255, b + ((l >>> 16) & 255) * 0.5); } }
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) img.set([r, g, b, 255], (((by + y) * S + j) * W + (bx + x) * S + i) * 4);
  }
});
writeFileSync(process.argv[2], encodePNG(W, H, img));
