// 深淵地形草稿：一小張測試地形（地面、台階、浮空塊、天花板、豎井、柱子），放大 4 倍。
// 執行：node game/tools/drafts/terrain.mjs out.png [abyss|junk|cave]
import { writeFileSync } from "node:fs";
import { encodePNG } from "../../../pixelfx/tools/lib/png.mjs";
import { paintTerrain } from "../../src/terrain-art.js";
const W = 200, H = 120, K = 4;
const R = [[0, 96, 200, 24], [0, 0, 8, 120], [192, 0, 8, 120], [40, 72, 48, 24], [100, 40, 56, 16], [120, 0, 40, 16], [168, 56, 24, 40], [20, 32, 32, 8]];
const solid = (x, y) => R.some(([a, b, c, d]) => x >= a && x < a + c && y >= b && y < b + d);
const img = new Uint8Array(W * H * 4);
for (let i = 0; i < W * H; i++) img.set([20, 18, 34, 255], i * 4);
const put = (x, y, hx) => { if (x < 0 || y < 0 || x >= W || y >= H) return; img.set([1, 3, 5].map((o) => parseInt(hx.slice(o, o + 2), 16)).concat(255), (y * W + x) * 4); };
paintTerrain(solid, W, H, put, () => {}, process.argv[3] || "abyss");
const big = new Uint8Array(W * K * H * K * 4);
for (let y = 0; y < H * K; y++) for (let x = 0; x < W * K; x++) big.set(img.subarray(((y / K | 0) * W + (x / K | 0)) * 4, ((y / K | 0) * W + (x / K | 0)) * 4 + 4), (y * W * K + x) * 4);
writeFileSync(process.argv[2], encodePNG(W * K, H * K, big));
