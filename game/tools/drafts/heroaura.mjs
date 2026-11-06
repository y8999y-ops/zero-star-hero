// 裝備頁星星周圍的形態粒子草稿：每一列吸收的種類多一種（只有黏液 → 黏液＋鐵罐 → 三種 → 三種都吸很多），每列 5 個時間點，放大 4 倍
// 執行：node game/tools/drafts/heroaura.mjs out.png
import { writeFileSync } from "node:fs";
import { encodePNG } from "../../../pixelfx/tools/lib/png.mjs";
import { createFrame, composite } from "../../../pixelfx/src/core/index.js";
import { drawAura } from "../../src/heroaura.js";
const CW = 113, CH = 104, S = 3, cols = 5;
const rows = [[{ id: "slime", n: 1 }], [{ id: "slime", n: 2 }, { id: "can", n: 1 }], [{ id: "slime", n: 2 }, { id: "can", n: 2 }, { id: "bat", n: 1 }], [{ id: "slime", n: 6 }, { id: "can", n: 6 }, { id: "bat", n: 6 }]];
const W = CW * cols, H = CH * rows.length, f = createFrame(W, H);
for (let i = 0; i < W * H; i++) f.color[i] = 0xff1a1018;
rows.forEach((forms, r) => { for (let c = 0; c < cols; c++) {
  const sub = createFrame(CW, CH), t = c * 0.37, o = { cx: 56, cy: 50 };
  drawAura(sub, t, o, forms, "back");
  // 假星星：金色五角形剪影（實際遊戲裡是 paintStar）
  for (let y = -22; y <= 22; y++) for (let x = -20; x <= 20; x++) { const a = Math.atan2(y, x), rr = Math.hypot(x, y), k = 12 + 10 * Math.max(0, Math.cos(2.5 * (a + Math.PI / 2))); if (rr < k) sub.color[(50 + y) * CW + 56 + x] = rr < k - 2 ? 0xff4ad8ff : 0xff1a5a8a; }
  drawAura(sub, t, o, forms, "front");
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) { const i = y * CW + x, j = (r * CH + y) * W + c * CW + x; if (sub.color[i]) f.color[j] = sub.color[i]; f.light[j] = sub.light[i]; }
} });
const one = new Uint8ClampedArray(W * H * 4); composite(f, one, null, 0.6);
const img = new Uint8Array(W * S * H * S * 4);
for (let y = 0; y < H * S; y++) for (let x = 0; x < W * S; x++) { const i = (Math.floor(y / S) * W + Math.floor(x / S)) * 4, o = (y * W * S + x) * 4; img[o] = one[i]; img[o + 1] = one[i + 1]; img[o + 2] = one[i + 2]; img[o + 3] = 255; }
writeFileSync(process.argv[2], encodePNG(W * S, H * S, img));
