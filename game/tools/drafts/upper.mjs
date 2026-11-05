// 上層背景草稿：上面 2 個畫面＝新畫的 far、mid，最下面 1 個畫面＝原本的 valley back/far/mid（看接縫），放大 2 倍。
// 執行：node game/tools/drafts/upper.mjs out.png
import { writeFileSync } from "node:fs";
import { encodePNG } from "../../../pixelfx/tools/lib/png.mjs";
import { readPNG } from "./pngread.mjs";
import { genUpper } from "../../src/upper-art.js";
const W = 480, UH = 432, H = UH + 216, K = 2, img = new Uint8Array(W * H * 4);
for (let i = 0; i < W * H; i++) img.set([7, 7, 15, 255], i * 4);
const rgb = (hx) => [1, 3, 5].map((o) => parseInt(hx.slice(o, o + 2), 16));
const blitGen = (a) => { for (let y = 0; y < a.h; y++) for (let x = 0; x < W; x++) { const c = a.px[y * a.w + (x % a.w)]; if (c) img.set([...rgb(c), 255], (y * W + x) * 4); } };
const blitPng = (p) => { for (let y = 0; y < p.h; y++) for (let x = 0; x < W; x++) { const i = (y * p.w + (x % p.w)) * 4; if (p.rgba[i + 3] > 128) img.set([p.rgba[i], p.rgba[i + 1], p.rgba[i + 2], 255], ((UH + y) * W + x) * 4); } };
const TH = process.argv[3] || "abyss";
blitGen(genUpper("far", 640, UH, TH)); blitPng(readPNG("game/art/approved/valley/far.png"));
blitGen(genUpper("mid", 768, UH, TH)); blitPng(readPNG("game/art/approved/valley/mid.png"));
const big = new Uint8Array(W * K * H * K * 4);
for (let y = 0; y < H * K; y++) for (let x = 0; x < W * K; x++) big.set(img.subarray(((y / K | 0) * W + (x / K | 0)) * 4, ((y / K | 0) * W + (x / K | 0)) * 4 + 4), (y * W * K + x) * 4);
writeFileSync(process.argv[2], encodePNG(W * K, H * K, big));
