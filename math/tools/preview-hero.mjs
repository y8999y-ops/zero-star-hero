// 見習魔數師預覽：女生／男生 × 各姿勢 × 五個屬性色，放大輸出 PNG，並檢查色數。
// 用法（在 math/ 底下）：node tools/preview-hero.mjs out.png
import { writeFileSync } from "node:fs";
import { heroFrame, W, H } from "../fx/hero.js";
import { encodePNG } from "../../pixelfx/tools/lib/png.mjs";

const out = process.argv[2] ?? "hero.png";
const K = +(process.env.K ?? 5);
const ATTR = { fire: "#ff7a2f", water: "#3fa7ff", ice: "#9be3ff", forest: "#6fd46a", thunder: "#b483ff" };
// 第一列：女生 idle 4 格＋cast、hurt、win；第二列：男生；之後兩列：五個屬性換色
const cells = [];
for (const look of ["girl", "boy"]) {
  for (const t of [0, 0.5, 0.9, 1.4]) cells.push([look, "idle", t, ATTR.thunder]);
  for (const pose of ["cast", "hurt", "win"]) cells.push([look, pose, 0.2, ATTR.thunder]);
}
for (const look of ["girl", "boy"]) for (const a of Object.values(ATTR)) cells.push([look, "idle", 0, a]);
const COLS = 7, rows = Math.ceil(cells.length / COLS);
const CW = W + 4, CH = H + 4, IW = CW * COLS * K, IH = CH * rows * K;
const img = new Uint8Array(IW * IH * 4);
for (let i = 0; i < IW * IH; i++) { img[i * 4] = 0x6e; img[i * 4 + 1] = 0x8e; img[i * 4 + 2] = 0x7a; img[i * 4 + 3] = 255; }
let maxColors = 0;
cells.forEach(([look, pose, t, a], n) => {
  const f = heroFrame(look, pose, t, a);
  maxColors = Math.max(maxColors, f.colors);
  const ox = (n % COLS) * CW + 2, oy = Math.floor(n / COLS) * CH + 2;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = f.px[y * W + x];
    if (!c) continue;
    for (let j = 0; j < K; j++) for (let i = 0; i < K; i++) {
      const d = (((oy + y) * K + j) * IW + (ox + x) * K + i) * 4;
      img[d] = c & 255; img[d + 1] = (c >> 8) & 255; img[d + 2] = (c >> 16) & 255;
    }
  }
});
writeFileSync(out, encodePNG(IW, IH, img));
console.log(`wrote ${out}，單張最多 ${maxColors} 色（上限 16）`);
