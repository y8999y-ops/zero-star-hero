// 背景上下兩段的檢查：每個主題在鏡頭 cy＝432（地圖底部）、216、0（地圖頂端）各截一張 320×216（照 level.js 的 layerRow／前景邏輯）
// 執行：node game/tools/drafts/bgheight.mjs out.png
import { writeFileSync } from "node:fs";
import { encodePNG } from "../../../pixelfx/tools/lib/png.mjs";
import { readPNG } from "./pngread.mjs";
import { genLayer, THEME_LAYERS } from "../../src/bg-art.js";
import { genUpper } from "../../src/upper-art.js";
const load = (n) => { const p = readPNG(new URL(`../../art/approved/valley/${n}.png`, import.meta.url)); const px = new Uint32Array(p.w * p.h); for (let i = 0; i < px.length; i++) { const a = p.rgba[i * 4 + 3]; px[i] = a ? ((a << 24) | (p.rgba[i * 4 + 2] << 16) | (p.rgba[i * 4 + 1] << 8) | p.rgba[i * 4]) >>> 0 : 0; } return { w: p.w, h: p.h, px }; };
const hx = (s) => { const n = parseInt(s.slice(1), 16); return (0xff000000 | ((n & 255) << 16) | (n & 0xff00) | (n >>> 16)) >>> 0; };
const toPx = (a) => { const out = new Uint32Array(a.w * a.h); a.px.forEach((c, i) => { if (c) out[i] = hx(c); }); return { w: a.w, h: a.h, px: out }; };
const H = 216, MAP_H = 648, FW = 320, S = 2, VPAR = { 1: 0.7, 2: 0.85, 3: 1 }, PIN = 100, UH = Math.ceil((MAP_H - H) * 0.75) + 16, FG_DROP = 26;
const layerRow = (y, cy, k) => { const top = y + Math.round(cy * VPAR[k]); if (top < PIN) return top; const bot = y + Math.round((cy - (MAP_H - H)) * VPAR[k]); if (bot >= PIN || bot < 0) return bot; return H; };
const V = { back: load("back"), far: load("far"), mid: load("mid"), near: load("near"), fg: load("fg") };
const themes = ["abyss", "junk", "cave"], cams = [432, 216, 0];
const W = cams.length * (FW + 4) * S, IH = themes.length * (H + 4) * S, img = new Uint8Array(W * IH * 4);
themes.forEach((th, r) => {
  const L = { ...V }; for (const k of THEME_LAYERS[th] ?? []) L[k] = genLayer(k, th);
  const UP = { 1: toPx(genUpper("far", 640, UH, th)), 2: toPx(genUpper("mid", 768, UH, th)) };
  cams.forEach((cy, c) => {
    for (let y = 0; y < H; y++) for (let x = 0; x < FW; x++) {
      let v = 0, k = 1;
      const pick = (lay, kk, dimk) => { if (v) return; const Lr = L[lay], t = y + Math.round(cy * VPAR[kk]), b = y + Math.round((cy - (MAP_H - H)) * VPAR[kk]); let q = 0;
        if (t >= 0 && t < PIN) q = Lr.px[t * Lr.w + (x % Lr.w)];
        if (!q && b >= PIN && b < H) q = Lr.px[b * Lr.w + (x % Lr.w)];
        if (!q && b < 0 && kk < 3 && UH + b >= 0) { const U = UP[kk]; q = U.px[(UH + b) * U.w + (x % U.w)]; }
        if (q) { v = q; k = dimk; } };
      pick("near", 3, 0.6); pick("mid", 2, 0.66); pick("far", 1, 0.78);
      if (!v) { const B = L.back; v = B.px[y * B.w + (x % B.w)] || 0xff0f0707; k = 1; }
      // 前景
      const FG = L.fg; let sy = -1; const top = y + cy; if (top < 110 - FG_DROP) sy = top + FG_DROP; else { const bot = y + cy - (MAP_H - H); if (bot >= 110 && bot < H) sy = bot; }
      if (sy >= 0) { const q = FG.px[sy * FG.w + (x % FG.w)]; if (q) { v = q; k = 1; } }
      const col = [v & 255, (v >>> 8) & 255, (v >>> 16) & 255].map((q) => Math.round(q * k));
      for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) img.set([...col, 255], (((r * (H + 4) + y) * S + j) * W + (c * (FW + 4) + x) * S + i) * 4);
    }
  });
});
writeFileSync(process.argv[2], encodePNG(W, IH, img));
