// 裂牆碎塊草稿：撞破後每 0.08 秒一格（往右撞），放大 3 倍。執行：node game/tools/drafts/debris.mjs out.png
import { writeFileSync } from "node:fs";
import { encodePNG } from "../../../pixelfx/tools/lib/png.mjs";
import { createFrame } from "../../../pixelfx/src/core/index.js";
import { crackDebris, updateDebris, drawDebris, drawCrack } from "../../src/feature-art.js";
const FW = 200, FH = 120, S = 3, COLS = 6, N = 18, list = crackDebris(60, 100, 120 > 0 ? 64 : 48, 1), cells = [];
for (let n = 0; n < N; n++) {
  const f = createFrame(FW, FH);
  if (n === 0) drawCrack(f, 60, 100, 0.4, 0, 64); else drawDebris(f, list);
  cells.push(f); if (n > 0) for (let k = 0; k < 5; k++) updateDebris(list, 0.016);
}
const W = COLS * (FW + 2) * S, H = Math.ceil(N / COLS) * (FH + 2) * S, img = new Uint8Array(W * H * 4);
cells.forEach((f, n) => { const bx = (n % COLS) * (FW + 2), by = Math.floor(n / COLS) * (FH + 2); for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) { const v = f.color[y * FW + x], col = v >>> 24 ? [v & 255, (v >>> 8) & 255, (v >>> 16) & 255] : y >= 100 ? [56, 46, 72] : [24, 18, 36]; for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) img.set([...col, 255], (((by + y) * S + j) * W + (bx + x) * S + i) * 4); } });
writeFileSync(process.argv[2], encodePNG(W, H, img));
