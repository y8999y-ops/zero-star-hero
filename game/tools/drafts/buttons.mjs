// 按鈕草稿：3 種顏色（主要金、危險紅、一般紫灰）× 4 狀態（平常、停留、按下、停用），九宮格拉成 44×15（像遊戲裡一顆按鈕的大小，2 倍後約 88×30），中間用一條字色當作文字，放大 6 倍。
// 執行：node game/tools/drafts/buttons.mjs out.png
import { writeFileSync } from "node:fs";
import { encodePNG } from "../../../pixelfx/tools/lib/png.mjs";
import { btnArt, N, SLICE } from "../../src/btn-art.js";

const KS = ["go", "bad", "plain"], SS = ["n", "h", "d", "x"], BW = 44, BH = 15, GAP = 6, K = 6;
const W = SS.length * (BW + GAP) + GAP, H = KS.length * (BH + GAP) + GAP;
const img = new Uint8Array(W * H * 4);
const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
for (let i = 0; i < W * H; i++) img.set([28, 24, 48, 255], i * 4);
const put = (x, y, h) => { if (h) img.set([...rgb(h), 255], (y * W + x) * 4); };
const map = (v, len) => (v < SLICE ? v : v >= len - SLICE ? N - (len - v) : SLICE + ((v - SLICE) % (N - 2 * SLICE)));
import { KINDS } from "../../src/btn-art.js";
KS.forEach((k, r) => SS.forEach((s, c) => {
  const a = btnArt(k, s), ox = GAP + c * (BW + GAP), oy = GAP + r * (BH + GAP);
  for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) put(ox + x, oy + y, a.px[map(y, BH) * N + map(x, BW)]);
  const ink = (KINDS[s === "x" ? "off" : k]).ink, ty = oy + (s === "d" ? 7 : 5);
  for (let x = 12; x < BW - 12; x++) if ((x - 12) % 5 !== 4) { put(ox + x, ty, ink); put(ox + x, ty + 1, ink); put(ox + x, ty + 2, ink); }
}));
const big = new Uint8Array(W * K * H * K * 4);
for (let y = 0; y < H * K; y++) for (let x = 0; x < W * K; x++) big.set(img.subarray(((y / K | 0) * W + (x / K | 0)) * 4, ((y / K | 0) * W + (x / K | 0)) * 4 + 4), (y * W * K + x) * 4);
writeFileSync(process.argv[2] || "buttons.png", encodePNG(W * K, H * K, big));
