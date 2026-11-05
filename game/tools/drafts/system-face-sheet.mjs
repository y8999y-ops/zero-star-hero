// 系統水晶：4 種表情 × 8 格，放大 6 倍。需要 canvas，所以在瀏覽器外用假的 document：直接重做 drawCrystal 的網格輸出太麻煩，
// 改成在 node 裡模擬一個最小的 canvas（只支援 fillRect 1×1）。node game/tools/drafts/system-face-sheet.mjs out.png
import { writeFileSync } from "node:fs";
import { encodePNG } from "../../../pixelfx/tools/lib/png.mjs";
const S = 40;
globalThis.document = { createElement: () => { const px = new Map(); let fs = ""; return { width: 0, height: 0, px, getContext: () => ({ set fillStyle(v) { fs = v; }, fillRect(x, y) { px.set(x + "," + y, fs); }, clearRect() {}, drawImage() {} }) }; } };
const { systemFace } = await import("../../src/system-face.js");
const EX = ["normal", "smug", "wow", "blink"], K = 6, W = S * 8, H = S * EX.length;
const img = new Uint8Array(W * K * H * K * 4);
const hx = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
EX.forEach((e, r) => { for (let f = 0; f < 8; f++) { const cv = systemFace(e, f);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const c = cv.px.get(x + "," + y), rgb = c ? hx(c) : (x + y) % 2 ? [20, 16, 34] : [24, 20, 40];
    for (let j = 0; j < K; j++) for (let i = 0; i < K; i++) { const o = (((r * S + y) * K + j) * W * K + (f * S + x) * K + i) * 4; img[o] = rgb[0]; img[o + 1] = rgb[1]; img[o + 2] = rgb[2]; img[o + 3] = 255; } } } });
writeFileSync(process.argv[2], encodePNG(W * K, H * K, img));
console.log("wrote", process.argv[2]);
