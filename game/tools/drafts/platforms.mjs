// A4 單向平台草稿：上排＝整張 128×48（垃圾山、洞窟），下排＝照 level.js 的左半＋右半拼成 56／72／108 寬，放大 3 倍
// 執行：node game/tools/drafts/platforms.mjs out.png
import { writeFileSync } from "node:fs";
import { encodePNG } from "../../../pixelfx/tools/lib/png.mjs";
import { genPlatform } from "../../src/platform-art.js";
const S = 3, WW = 300, HH = 150, img = new Uint8Array(WW * S * HH * S * 4);
const bg = [20, 16, 34];
for (let i = 0; i < WW * HH * S * S; i++) img.set([...bg, 255], i * 4);
const dot = (x, y, c) => { if (!c) return; const r = c & 255, g = (c >>> 8) & 255, b = (c >>> 16) & 255; for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) img.set([r, g, b, 255], ((y * S + j) * WW * S + x * S + i) * 4); };
const themes = ["junk", "cave"].map(genPlatform);
themes.forEach((pl, t) => { for (let y = 0; y < 48; y++) for (let x = 0; x < 128; x++) dot(8 + t * 140 + x, 4 + y, pl.px[y * 128 + x]); });
themes.forEach((pl, t) => {
  let ox = 8;
  for (const w of [56, 72, 108]) {
    const half = Math.floor(w / 2);
    for (let y = 0; y < 48; y++) for (let i = 0; i < w; i++) { const sx = i < half ? 4 + i : 126 - (w - 1 - i); dot(ox + i, 58 + t * 46 + y - 4, pl.px[y * 128 + sx]); }
    ox += w + 14;
  }
});
writeFileSync(process.argv[2], encodePNG(WW * S, HH * S, img));
