// 角色／怪物預覽：把某個 fx 檔的 frame 函式依姿勢、時間排成一張放大 PNG，並印出最多用了幾色。
// 用法（在 math/ 底下）：
//   node tools/preview-sprites.mjs fx/ink-drop.js inkDropFrame 12 out.png
//   （第三個參數是色數上限；姿勢清單寫在下面 POSES，可以用環境變數 POSES="idle,hurt" 換）
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { encodePNG } from "../../pixelfx/tools/lib/png.mjs";

const [file, fn, limit = "16", out = "sprites.png"] = process.argv.slice(2);
const mod = await import(pathToFileURL(resolve(file)).href);
const frame = mod[fn];
const K = +(process.env.K ?? 5), N = +(process.env.N ?? 8);
const poses = (process.env.POSES ?? "idle,hurt").split(",");
const BG = (process.env.BG ?? "#6e8e7a").match(/\w\w/g).map((h) => parseInt(h, 16));

// 每個姿勢一列，每列 N 格（時間平均分）
const cells = [];
for (const p of poses) for (let i = 0; i < N; i++) cells.push([p, (i / N) * (+(process.env.D ?? 1.2))]);
const f0 = frame(poses[0], 0), CW = f0.w + 2, CH = f0.h + 2, IW = CW * N * K, IH = CH * poses.length * K;
const img = new Uint8Array(IW * IH * 4);
for (let i = 0; i < IW * IH; i++) { img[i * 4] = BG[0]; img[i * 4 + 1] = BG[1]; img[i * 4 + 2] = BG[2]; img[i * 4 + 3] = 255; }
let max = 0;
cells.forEach(([p, t], n) => {
  const f = frame(p, t);
  max = Math.max(max, f.colors);
  const ox = (n % N) * CW + 1, oy = Math.floor(n / N) * CH + 1;
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
    const c = f.px[y * f.w + x];
    if (!c) continue;
    for (let j = 0; j < K; j++) for (let i = 0; i < K; i++) {
      const d = (((oy + y) * K + j) * IW + (ox + x) * K + i) * 4;
      img[d] = c & 255; img[d + 1] = (c >> 8) & 255; img[d + 2] = (c >> 16) & 255;
    }
  }
});
writeFileSync(out, encodePNG(IW, IH, img));
console.log(`wrote ${out}，單格最多 ${max} 色（上限 ${limit}）${max > +limit ? "  ✗ 超過！" : ""}`);
