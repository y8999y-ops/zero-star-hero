// 四種寶箱並排（關著、剛打開、打開後），放大看造型差異。node game/tools/drafts/chest-tiers.mjs out.png
import { writeFileSync } from "node:fs";
import { createFrame, createFx, composite, clearFrame } from "../../../pixelfx/src/core/index.js";
import { encodePNG } from "../../../pixelfx/tools/lib/png.mjs";
import * as chest from "../../fx/loot/treasure-chest.js";
import { CHEST_TIERS } from "../../src/chest-tiers.js";

const CW = 64, CH = 60, K = 5, TIMES = [0, 1.0, 2.0];
const W = CW * CHEST_TIERS.length, H = CH * TIMES.length;
const out = new Uint8ClampedArray(W * K * H * K * 4);
CHEST_TIERS.forEach((T, i) => TIMES.forEach((tt, j) => {
  const f = createFrame(CW, CH);
  clearFrame(f);
  const fx = createFx(chest, { x: CW / 2, y: CH - 6, tier: i, wood: T.wood, palette: T.palette, coins: 0, gems: 0, seed: 3 });
  for (let t = 0; t < tt; t += 1 / 60) fx.update(1 / 60);
  fx.draw(f);
  const rgba = composite(f, new Uint8ClampedArray(CW * CH * 4), [24, 18, 36]);
  for (let y = 0; y < CH * K; y++) for (let x = 0; x < CW * K; x++) {
    const s = ((y / K | 0) * CW + (x / K | 0)) * 4, d = ((j * CH * K + y) * W * K + i * CW * K + x) * 4;
    out[d] = rgba[s]; out[d + 1] = rgba[s + 1]; out[d + 2] = rgba[s + 2]; out[d + 3] = 255;
  }
}));
writeFileSync(process.argv[2], encodePNG(W * K, H * K, out));
console.log("wrote", process.argv[2]);
