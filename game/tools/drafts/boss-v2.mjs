// 王（第二版，照原本史萊姆的畫法）：各個姿勢排一張，左邊放一隻野外史萊姆比大小。
//   node game/tools/drafts/boss-v2.mjs docs/王草稿-v2.png
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { encodePNG } from "../../../pixelfx/tools/lib/png.mjs";
import { loadEffect, renderFrames } from "../../../pixelfx/tools/lib/fxlib.mjs";

const K = 4, BG = [28, 26, 42];
const bossFx = await loadEffect("glutton-slime", fileURLToPath(new URL("../../fx/abyss/", import.meta.url)));
const slimeFx = await loadEffect("critters/slime");
const frameOf = (fx, options, t = 0) => { const r = renderFrames(fx, { bg: "none", fps: 30, options }); return { w: r.w, h: r.h, rgba: r.frames[Math.min(r.n - 1, Math.round(t * 30))].color }; };
const shots = [
  [slimeFx, {}, 0.3, "野外史萊姆"],
  [bossFx, { pose: "idle" }, 0, "待機"], [bossFx, { pose: "idle" }, 0.8, "待機"],
  [bossFx, { pose: "crouch", k: 1 }, 0, "蹲下蓄力"], [bossFx, { pose: "air", k: 0.15 }, 0, "跳起來"],
  [bossFx, { pose: "land", k: 0.04 }, 0, "壓地"], [bossFx, { pose: "land", k: 0.3 }, 0, "壓地後晃"],
  [bossFx, { pose: "inhale", k: 1 }, 0, "吸氣"], [bossFx, { pose: "spit", k: 0.05 }, 0, "吐"],
].map(([fx, o, t]) => frameOf(fx, o, t));

// 每張用不透明的像素算出範圍，排成兩列，底部對齊
const box = (f) => { let x0 = f.w, y0 = f.h, x1 = 0, y1 = 0; for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (f.rgba[(y * f.w + x) * 4 + 3] > 200) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return { x0: x0 - 8, y0: y0 - 8, x1: x1 + 8, y1: y1 + 4 }; };
const cells = shots.map((f) => ({ f, b: box(f) }));
const rows = [cells.slice(0, 5), cells.slice(5)];
const cw = rows.map((r) => r.reduce((n, c) => n + c.b.x1 - c.b.x0 + 1, 0)), ch = rows.map((r) => Math.max(...r.map((c) => c.b.y1 - c.b.y0 + 1)));
const W = Math.max(...cw), H = ch[0] + ch[1];
const img = new Uint8Array(W * K * H * K * 4);
for (let i = 0; i < W * K * H * K; i++) { img.set(BG, i * 4); img[i * 4 + 3] = 255; }
let oy = 0;
rows.forEach((row, ri) => {
  let ox = 0;
  for (const { f, b } of row) {
    const bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1, dy = oy + ch[ri] - bh;
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
      const sx = x + b.x0, sy = y + b.y0; if (sx < 0 || sy < 0 || sx >= f.w || sy >= f.h) continue;
      const s = (sy * f.w + sx) * 4, a = f.rgba[s + 3] / 255; if (!a) continue;
      for (let i = 0; i < K; i++) for (let j = 0; j < K; j++) { const d = (((dy + y) * K + j) * W * K + (ox + x) * K + i) * 4; for (let c = 0; c < 3; c++) img[d + c] = Math.round(img[d + c] * (1 - a) + f.rgba[s + c] * a); }
    }
    ox += bw;
  }
  oy += ch[ri];
});
writeFileSync(process.argv[2] ?? "boss-v2.png", encodePNG(W * K, H * K, img));
console.log("ok");
