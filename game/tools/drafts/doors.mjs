// 門板草稿：鐵門兩扇（各 80×100）、木門一扇（160×100），放大 4 倍。執行：node game/tools/drafts/doors.mjs out.png
import { writeFileSync } from "node:fs";
import { encodePNG } from "../../../pixelfx/tools/lib/png.mjs";
import { doorArt } from "../../src/door-art.js";
const K = 4, W = 160 * 2 + 10, H = 100, img = new Uint8Array(W * H * 4);
const blit = (a, ox) => { for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) { const c = a.px[y * a.w + x]; if (c) img.set([1, 3, 5].map((o) => parseInt(c.slice(o, o + 2), 16)).concat(255), (y * W + ox + x) * 4); } };
blit(doorArt("iron", 80, 100, "L"), 0); blit(doorArt("iron", 80, 100, "R"), 80); blit(doorArt("wood", 160, 100), 170);
const big = new Uint8Array(W * K * H * K * 4);
for (let y = 0; y < H * K; y++) for (let x = 0; x < W * K; x++) big.set(img.subarray(((y / K | 0) * W + (x / K | 0)) * 4, ((y / K | 0) * W + (x / K | 0)) * 4 + 4), (y * W * K + x) * 4);
writeFileSync(process.argv[2], encodePNG(W * K, H * K, big));
