// UI 圖示草稿（照 pixelfx skill 的畫→看→修）：16×16、左上光、每種顏色 4～5 階硬邊、
// 「選擇性外框」（外框顏色＝旁邊那塊顏色的最暗一階，不是一律黑色，參考 pixelfx pickups 的做法）、一顆白色高光。
// 執行：node game/tools/drafts/ui-icons.mjs out.png [只畫這些,逗號分隔]
// 輸出：每個圖示放大 8 倍，放在深、中、淺三種底色上各一次，下面標名字。
import { writeFileSync } from "node:fs";
import { encodePNG } from "../../../pixelfx/tools/lib/png.mjs";
import { ICON_DEFS, pixelsOf } from "../../src/ui-icons.js";

const N = 16, K = 8;
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function lint(px) {
  const bad = [];
  const at = (x, y) => (x >= 0 && y >= 0 && x < N && y < N ? px[y * N + x] : null);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const c = at(x, y);
    if (!c) continue;
    const nb = [at(x + 1, y), at(x - 1, y), at(x, y + 1), at(x, y - 1)].filter(Boolean);
    if (!nb.length) bad.push(`孤立點(${x},${y})`);
  }
  return bad;
}

if (process.argv[2]) {
  const only = process.argv[3]?.split(",");
  const list = Object.entries(ICON_DEFS).filter(([n]) => !only || only.includes(n));
  const BG = [[18, 12, 30], [52, 40, 72], [168, 150, 128]];
  const cell = N * K + 8, cols = Math.min(8, list.length), W = cols * cell, rowsN = Math.ceil(list.length / cols), H = rowsN * (cell * 3 + 6);
  const img = new Uint8Array(W * H * 4);
  for (let i = 0; i < img.length; i += 4) { img[i] = 10; img[i + 1] = 8; img[i + 2] = 16; img[i + 3] = 255; }
  list.forEach(([name, def], i) => {
    const px = pixelsOf(def), bad = lint(px);
    if (bad.length) console.log(name.padEnd(10), bad.join(" "));
    const cx = (i % cols) * cell, cy0 = Math.floor(i / cols) * (cell * 3 + 6);
    BG.forEach((bg, b) => {
      const cy = cy0 + b * cell;
      for (let y = 0; y < N * K + 8; y++) for (let x = 0; x < N * K + 8; x++) {
        const o = ((cy + y) * W + cx + x) * 4;
        const v = x >= 4 && y >= 4 && x < N * K + 4 && y < N * K + 4 ? px[Math.floor((y - 4) / K) * N + Math.floor((x - 4) / K)] : null;
        const c = v ? hex(v) : bg;
        img[o] = c[0]; img[o + 1] = c[1]; img[o + 2] = c[2];
      }
    });
  });
  writeFileSync(process.argv[2], encodePNG(W, H, img));
  console.log("wrote", process.argv[2], list.map(([n]) => n).join(" "));
}
