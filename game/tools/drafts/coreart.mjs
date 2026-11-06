// 魔物核草稿：每一列一種核（黏液、鐵罐、蝙蝠），前 4 欄＝平常 4 個時間點，後 3 欄＝長按 30%／60%／90%（拉光到右邊的假主角），放大 4 倍。
// 執行：node game/tools/drafts/coreart.mjs out.png
import { writeFileSync } from "node:fs";
import { encodePNG } from "../../../pixelfx/tools/lib/png.mjs";
import { createFrame, composite } from "../../../pixelfx/src/core/index.js";
import { drawCore, drawAbsorbBeams } from "../../src/coreart.js";
const CW = 60, CH = 56, S = 4, forms = ["slime", "can", "bat"], cols = 7, W = CW * cols, H = CH * forms.length, f = createFrame(W, H);
for (let i = 0; i < W * H; i++) f.color[i] = (Math.floor(i / W) % CH) > CH - 8 ? 0xff2a3a3a : 0xff201820;
forms.forEach((form, r) => { for (let c = 0; c < cols; c++) {
  const x = c * CW + 22, y = r * CH + CH - 8, t = c < 4 ? c * 0.4 : 1.3 + c * 0.13, hold = c < 4 ? 0 : [0.3, 0.6, 0.9][c - 4];
  const [cx, cy] = drawCore(f, x, y, t, form, hold);
  if (hold) { drawAbsorbBeams(f, cx, cy, x + 30, y - 12, t, form, hold); for (let j = 0; j < 20; j++) for (let i = -4; i <= 4; i++) f.color[(y - j) * W + x + 30 + i] = 0xff5ad8ff; }
} });
const one = new Uint8ClampedArray(W * H * 4); composite(f, one, null, 0.7);
const img = new Uint8Array(W * S * H * S * 4);
for (let y = 0; y < H * S; y++) for (let x = 0; x < W * S; x++) { const i = (Math.floor(y / S) * W + Math.floor(x / S)) * 4, o = (y * W * S + x) * 4; img[o] = one[i]; img[o + 1] = one[i + 1]; img[o + 2] = one[i + 2]; img[o + 3] = 255; }
writeFileSync(process.argv[2], encodePNG(W * S, H * S, img));
