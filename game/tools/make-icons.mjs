// 手機「加到主畫面」的圖示（192、512）：深色底＋主角星星（放大成整數倍、像素清楚）＋一圈金色柔光。執行：node game/tools/make-icons.mjs
import { writeFileSync } from "node:fs";
import { encodePNG } from "../../pixelfx/tools/lib/png.mjs";
import { createFrame, composite } from "../../pixelfx/src/core/index.js";
import { paintStar, POSES } from "../src/star.js";
const f = createFrame(48, 48);
paintStar(f, 24, 37, POSES.stand, false, { glow: 0 });
const one = new Uint8ClampedArray(48 * 48 * 4); composite(f, one, null, 1);
for (const size of [192, 512]) {
  const S = Math.floor(size / 48), off = Math.floor((size - 48 * S) / 2), img = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const d = Math.hypot(x - size / 2, y - size / 2) / (size / 2), k = Math.max(0, 1 - d) ** 2 * 0.55, o = (y * size + x) * 4;
    img.set([13 + 255 * k * 0.9, 11 + 216 * k * 0.9, 20 + 96 * k * 0.6, 255].map((v) => Math.min(255, Math.round(v))), o);
    const sx = Math.floor((x - off) / S), sy = Math.floor((y - off) / S);
    if (sx >= 0 && sy >= 0 && sx < 48 && sy < 48) { const i = (sy * 48 + sx) * 4; if (one[i + 3] > 0) img.set([one[i], one[i + 1], one[i + 2], 255], o); }
  }
  writeFileSync(`icon-${size}.png`, encodePNG(size, size, img));
}
console.log("ok");
