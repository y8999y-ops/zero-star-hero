// 主題背景草稿：照 level.js 的方式疊 back → far → mid → near（各層變暗一點、視差位移），截 320×216 的畫面
// 每個主題兩個位置；最上面一排是原本的山谷（對照）。放大 2 倍。執行：node game/tools/drafts/bgart.mjs out.png
import { writeFileSync } from "node:fs";
import { encodePNG } from "../../../pixelfx/tools/lib/png.mjs";
import { readPNG } from "./pngread.mjs";
import { genLayer, THEME_LAYERS } from "../../src/bg-art.js";
const load = (n) => { const p = readPNG(new URL(`../../art/approved/valley/${n}.png`, import.meta.url)); const px = new Uint32Array(p.w * p.h); for (let i = 0; i < px.length; i++) { const a = p.rgba[i * 4 + 3]; px[i] = a ? ((a << 24) | (p.rgba[i * 4 + 2] << 16) | (p.rgba[i * 4 + 1] << 8) | p.rgba[i * 4]) >>> 0 : 0; } return { w: p.w, h: p.h, px }; };
const V = { back: load("back"), far: load("far"), mid: load("mid"), near: load("near") };
const DIM = { far: 0.78, mid: 0.66, near: 0.6 }, PAR = { back: 0.05, far: 0.12, mid: 0.3, near: 0.6 };
const themes = ["valley", "junk", "cave"], cams = [0, 700], FW = 320, FH = 216, S = 2;
const W = cams.length * (FW + 4) * S, H = themes.length * (FH + 4) * S, img = new Uint8Array(W * H * 4);
themes.forEach((th, r) => {
  const L = { ...V }; for (const k of THEME_LAYERS[th] ?? []) L[k] = genLayer(k, th);
  cams.forEach((cx, c) => {
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
      let v = 0, k = 1;
      for (const [name, dk] of [["near", DIM.near], ["mid", DIM.mid], ["far", DIM.far]]) { const Lr = L[name], o = Math.floor(cx * PAR[name]); const q = Lr.px[y * Lr.w + (((x + o) % Lr.w) + Lr.w) % Lr.w]; if (q) { v = q; k = dk; break; } }
      if (!v) { const B = L.back; v = B.px[y * B.w + ((x + Math.floor(cx * PAR.back)) % B.w)] || 0xff0f0707; }
      const col = [v & 255, (v >>> 8) & 255, (v >>> 16) & 255].map((q) => Math.round(q * k));
      for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) img.set([...col, 255], (((r * (FH + 4) + y) * S + j) * W + (c * (FW + 4) + x) * S + i) * 4);
    }
  });
});
writeFileSync(process.argv[2], encodePNG(W, H, img));
