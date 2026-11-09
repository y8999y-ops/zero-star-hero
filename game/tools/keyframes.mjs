// 關鍵格比較圖：把自製特效在指定的幾個時間點畫出來，一列一個選項組合，排成一張放大的 PNG（比較草稿用）。
//   node game/tools/keyframes.mjs <特效檔> <輸出.png> '<JSON>'
//   JSON：{ "rows": [ [ {選項}, 時間1, 時間2, … ], … ], "zoom": 3, "crop": [x0, y0, x1, y1] }
//   或 { "cells": [ [ {選項}, 時間 ], … ], "cols": 3 }：每格各自的選項，排成 cols 欄。
//   crop 是特效畫布座標（不給就整張）；每格之間空 4 格。
import { writeFileSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { loadEffect, renderFrames } from "../../pixelfx/tools/lib/fxlib.mjs";
import { encodePNG } from "../../pixelfx/tools/lib/png.mjs";

const [file, out, spec] = process.argv.slice(2);
const S = JSON.parse(spec), zoom = S.zoom ?? 3, gap = 4;
const fx = await loadEffect(basename(file, ".js"), dirname(resolve(file)));
if (S.cells) { const c = S.cols ?? 3; S.rows = []; for (let i = 0; i < S.cells.length; i += c) S.rows.push(S.cells.slice(i, i + c)); }
const one = (opts, t) => { const r = renderFrames(fx, { options: opts }); return { f: r.frames[Math.min(r.n - 1, Math.round(t * r.fps))], w: r.w, h: r.h }; };
const cells = S.cells ? S.rows.map((row) => row.map(([o, t]) => one(o, t))) : S.rows.map(([opts, ...times]) => {
  const r = renderFrames(fx, { options: opts });
  return times.map((t) => r.frames[Math.min(r.n - 1, Math.round(t * r.fps))]).map((f) => ({ f, w: r.w, h: r.h }));
});
const [cx0, cy0, cx1, cy1] = S.crop ?? [0, 0, cells[0][0].w, cells[0][0].h];
const cw = cx1 - cx0, ch = cy1 - cy0, cols = Math.max(...cells.map((r) => r.length)), rows = cells.length;
const W = (cw + gap) * cols * zoom, H = (ch + gap) * rows * zoom;
const img = new Uint8ClampedArray(W * H * 4);
for (let i = 0; i < W * H; i++) { img[i * 4] = 18; img[i * 4 + 1] = 16; img[i * 4 + 2] = 26; img[i * 4 + 3] = 255; }
cells.forEach((row, ri) => row.forEach(({ f, w }, ci) => {
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const s = ((y + cy0) * w + x + cx0) * 4;
    for (let dy = 0; dy < zoom; dy++) for (let dx = 0; dx < zoom; dx++) {
      const X = (ci * (cw + gap) + x) * zoom + dx, Y = (ri * (ch + gap) + y) * zoom + dy, d = (Y * W + X) * 4;
      img[d] = f.color[s]; img[d + 1] = f.color[s + 1]; img[d + 2] = f.color[s + 2]; img[d + 3] = 255;
    }
  }
}));
writeFileSync(out, encodePNG(W, H, img));
console.log("wrote", out, W + "x" + H);
