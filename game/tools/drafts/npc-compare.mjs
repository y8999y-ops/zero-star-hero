// 比較圖：現在的居民＋路人（npcs.js）和 PixelFX 的小生物（frog、slime、ghost、eyeball），同樣倍數排在一起。
//   node game/tools/drafts/npc-compare.mjs docs/NPC-比較.png
import { writeFileSync } from "node:fs";
import { encodePNG } from "../../../pixelfx/tools/lib/png.mjs";
import { loadEffect, renderFrames } from "../../../pixelfx/tools/lib/fxlib.mjs";
import { npcFrame } from "../../src/npcs.js";

const K = 5, BG = [28, 26, 42];
const fromNpc = (id, f) => { const s = npcFrame(id, f), rgba = new Uint8ClampedArray(s.W * s.H * 4); for (let y = 0; y < s.H; y++) for (let x = 0; x < s.W; x++) { const c = s.px[y][x]; if (!c) continue; const i = (y * s.W + x) * 4; rgba[i] = c & 255; rgba[i + 1] = (c >>> 8) & 255; rgba[i + 2] = (c >>> 16) & 255; rgba[i + 3] = 255; } return { w: s.W, h: s.H, rgba }; };
async function fromFx(id, t) {
  const r = renderFrames(await loadEffect(id), { bg: "none", fps: 30 }), f = r.frames[Math.round(t * 30) % r.n].clear;
  let x0 = r.w, y0 = r.h, x1 = 0, y1 = 0;
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) if (f[(y * r.w + x) * 4 + 3] > 200) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const w = x1 - x0 + 3, h = y1 - y0 + 3, rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const sx = x + x0 - 1, sy = y + y0 - 1; if (sx < 0 || sy < 0 || sx >= r.w || sy >= r.h) continue; rgba.set(f.subarray((sy * r.w + sx) * 4, (sy * r.w + sx) * 4 + 4), (y * w + x) * 4); }
  return { w, h, rgba };
}
const rows = [
  ["clerk", "golem", "mushroom"].map((id) => fromNpc(id, 0)),
  ["kid", "turtle", "pebble", "shroom"].map((id) => fromNpc(id, 1)),
  [await fromFx("critters/frog", 0.4), await fromFx("critters/slime", 0.3), await fromFx("critters/ghost", 0.5), await fromFx("critters/eyeball", 0.5)],
];
const gap = 6, rw = rows.map((r) => r.reduce((n, s) => n + s.w + gap, gap)), rh = rows.map((r) => Math.max(...r.map((s) => s.h)) + gap);
const W = Math.max(...rw), H = rh.reduce((a, b) => a + b, gap);
const img = new Uint8Array(W * K * H * K * 4);
for (let i = 0; i < W * K * H * K; i++) { img.set(BG, i * 4); img[i * 4 + 3] = 255; }
let oy = gap;
rows.forEach((row, ri) => {
  let ox = gap;
  for (const s of row) {
    const dy = oy + rh[ri] - gap - s.h;
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
      const i = (y * s.w + x) * 4, a = s.rgba[i + 3] / 255; if (!a) continue;
      for (let p = 0; p < K; p++) for (let q = 0; q < K; q++) { const d = (((dy + y) * K + q) * W * K + (ox + x) * K + p) * 4; for (let c = 0; c < 3; c++) img[d + c] = Math.round(img[d + c] * (1 - a) + s.rgba[i + c] * a); }
    }
    ox += s.w + gap;
  }
  oy += rh[ri];
});
writeFileSync(process.argv[2] ?? "npc-compare.png", encodePNG(W * K, H * K, img));
console.log("ok");
