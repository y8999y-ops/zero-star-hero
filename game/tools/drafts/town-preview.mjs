// 整個碎星鎮的預覽圖（遊戲裡的畫法：光影、居民、前景）
//   node game/tools/drafts/town-preview.mjs out.png
import { writeFileSync } from "node:fs";
import { encodePNG } from "../../../pixelfx/tools/lib/png.mjs";
import { createFrame, composite } from "../../../pixelfx/src/core/index.js";
import { computeLight } from "../../src/light.js";
import { TOWN_W, townLights, drawTown, drawTownNpcs, drawTownFg } from "../../src/town.js";
import { H } from "../../src/level.js";
const f = createFrame(TOWN_W, H);
f.ox = 0; f.oy = 0;
drawTown(f, computeLight(f, townLights(1)), 1.3);
drawTownNpcs(f, 0.3);
drawTownFg(f);
const rgba = composite(f, new Uint8ClampedArray(TOWN_W * H * 4), null, 0.8), K = 2;
const out = new Uint8Array(TOWN_W * K * H * K * 4);
for (let y = 0; y < H * K; y++) for (let x = 0; x < TOWN_W * K; x++) { const s = ((y / K | 0) * TOWN_W + (x / K | 0)) * 4, d = (y * TOWN_W * K + x) * 4; out[d] = rgba[s]; out[d + 1] = rgba[s + 1]; out[d + 2] = rgba[s + 2]; out[d + 3] = 255; }
writeFileSync(process.argv[2], encodePNG(TOWN_W * K, H * K, out));
console.log("wrote", process.argv[2]);
