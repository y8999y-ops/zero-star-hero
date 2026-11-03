// 素材預覽：把自製素材畫成放大的 PNG，看圖修改用。
//   node game/tools/preview.mjs hero out.png              主角各種姿勢
//   node game/tools/preview.mjs fx game/fx/abyss/trash-can.js out.png [選項JSON]   自製特效的分格圖
import { writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { createFrame, composite } from "../../pixelfx/src/core/index.js";
import { encodePNG } from "../../pixelfx/tools/lib/png.mjs";
import { loadEffect, renderFrames, contactSheet } from "../../pixelfx/tools/lib/fxlib.mjs";
import { paintHero, createScarf, updateScarf, neckOf } from "../src/hero.js";
import * as P from "../src/poses.js";

const [mode, a, b, c] = process.argv.slice(2);

if (mode === "hero") {
  // 移動姿勢＋幾個武器招式的關鍵格（確認衣服在大動作下也貼得對）
  const moves = await Promise.all(["sword-slash", "heavy-cleave", "dagger-flurry", "hammer-smash"].map((n) => import(`../../pixelfx/src/fx/melee/${n}.js`)));
  const keys = moves.flatMap((m) => m.act.poses.filter((_, i, a) => i === 0 || i === Math.floor(a.length / 2)).map(([, q]) => ["atk", q, 0]));
  const list = [["guard", P.GUARD, 0], ...P.RUN_CYCLE.map((q, i) => ["run" + i, q, 128]), ["jump", P.JUMP, 60], ["fall", P.FALL, 30], ["dash", P.DASH, 345], ["hurt", P.HURT, -100], ...keys];
  const CW = 64, CH = 64, K = +(process.env.K ?? 4), cols = +(process.env.COLS ?? 8), W = CW * cols, H = CH * Math.ceil(list.length / cols);
  const f = createFrame(W, H);
  f.color.fill(0xff281e1e);
  list.forEach(([, q, vx], n) => {
    const ox = (n % cols) * CW, oy = Math.floor(n / cols) * CH, x = ox + 30, y = oy + 56, flip = false;
    for (let i = ox; i < ox + CW; i++) f.color[y * W + i] = 0xff5a4650;
    const s = createScarf();
    for (let i = 0; i < 90; i++) { const [nx, ny] = neckOf(x, y, q, flip); updateScarf(s, nx, ny, vx, 1 / 60); }
    paintHero(f, x, y, q, flip, { scarf: s });
  });
  savePng(f, K, a);
} else if (mode === "star") {
  // 新主角（胖星）所有姿勢＋規則v2 檢查
  const { POSES, starPixels } = await import("../src/star.js");
  const list = [];
  for (const [n, v] of Object.entries(POSES)) (Array.isArray(v) ? v : [v]).forEach((q, i) => list.push([Array.isArray(v) ? n + i : n, q]));
  const CW = 48, CH = 48, K = +(process.env.K ?? 4), cols = +(process.env.COLS ?? 8), W = CW * cols, H = CH * Math.ceil(list.length / cols);
  const f = createFrame(W, H);
  f.color.fill(0xff2a2018);
  const OUTC = 0xff361e3a;
  for (const [n, q] of list) {
    const sp = starPixels(q), at = (x, y) => sp.px[y]?.[x] || 0, bad = [];
    for (let y = 0; y < sp.H; y++) for (let x = 0; x < sp.W; x++) {
      const c = at(x, y);
      if (!c) continue;
      const nb = [at(x + 1, y), at(x - 1, y), at(x, y + 1), at(x, y - 1)];
      if (c === OUTC && at(x + 1, y) === OUTC && at(x, y + 1) === OUTC && at(x + 1, y + 1) === OUTC) bad.push(`腫塊(${x},${y})`);
      if (c === OUTC && !nb.some((v) => v && v !== OUTC)) bad.push(`雙層邊(${x},${y})`);
      if (c !== OUTC && !nb.some((v) => v && v !== OUTC)) bad.push(`孤立點(${x},${y})`);
    }
    const colors = new Set(sp.px.flat().filter(Boolean)).size;
    if (bad.length || colors > 16) console.log(n.padEnd(8), "顏色", colors, bad.join(" "));
  }
  list.forEach(([, q], n) => {
    const ox = (n % cols) * CW, oy = Math.floor(n / cols) * CH, x = ox + 24, y = oy + 40;
    for (let i = ox; i < ox + CW; i++) f.color[y * W + i] = 0xff5a4650;
    const sp = starPixels(q);
    sp.px.forEach((row, j) => row.forEach((c, i) => { if (c) f.color[(y + j - sp.ay) * W + x + i - sp.ax] = c; }));
  });
  console.log(list.map(([n]) => n).join(" "));
  savePng(f, K, a);
} else if (mode === "icons") {
  // 所有自製圖示排成一張表
  const { ICONS, ICON_SIZE: S } = await import("../src/icons.js");
  const names = Object.keys(ICONS), cols = 8, K = 6, cell = S + 4, W = cols * cell, H = Math.ceil(names.length / cols) * cell;
  const rgba = new Uint8Array(W * K * H * K * 4);
  const put = (x, y, [r, g, b]) => {
    for (let yy = 0; yy < K; yy++) for (let xx = 0; xx < K; xx++) { const d = ((y * K + yy) * W * K + x * K + xx) * 4; rgba[d] = r; rgba[d + 1] = g; rgba[d + 2] = b; rgba[d + 3] = 255; }
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) put(x, y, ((x / cell | 0) + (y / cell | 0)) % 2 ? [52, 46, 70] : [40, 34, 56]);
  names.forEach((n, i) => {
    const ox = (i % cols) * cell + 2, oy = (i / cols | 0) * cell + 2;
    ICONS[n].forEach((c, j) => c && put(ox + (j % S), oy + (j / S | 0), [1, 3, 5].map((k) => parseInt(c.slice(k, k + 2), 16))));
  });
  writeFileSync(a, encodePNG(W * K, H * K, rgba));
  console.log("wrote", a);
  // 規則檢查（終極版規則v2）：外框 2×2 腫塊、雙層外框、孤立點、顏色數
  const OUT = "#14101c";
  for (const n of names) {
    const g = ICONS[n], at = (x, y) => (x < 0 || y < 0 || x >= S || y >= S ? null : g[y * S + x]);
    const bad = [];
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const c = at(x, y);
      if (!c) continue;
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => at(x + dx, y + dy));
      if (c === OUT && at(x + 1, y) === OUT && at(x, y + 1) === OUT && at(x + 1, y + 1) === OUT) bad.push(`腫塊(${x},${y})`);
      if (c === OUT && !nb.some((v) => v && v !== OUT)) bad.push(`雙層邊(${x},${y})`);
      if (c !== OUT && !nb.some((v) => v && v !== OUT)) bad.push(`孤立點(${x},${y})`);
    }
    const colors = new Set(g.filter(Boolean)).size;
    if (bad.length || colors > 10) console.log(n.padEnd(12), `顏色${colors}`, bad.join(" "));
  }
} else if (mode === "fx") {
  const file = resolve(a), fx = await loadEffect(basename(file, ".js"), dirname(file));
  const r = renderFrames(fx, { options: c ? JSON.parse(c) : {} });
  writeFileSync(b, contactSheet(fx, r, { max: 16, zoom: 4 }));
  console.log("wrote", b);
}

function savePng(f, K, out) {
  const rgba = composite(f, new Uint8ClampedArray(f.w * f.h * 4), null);
  const big = new Uint8Array(f.w * K * f.h * K * 4);
  for (let y = 0; y < f.h * K; y++) for (let x = 0; x < f.w * K; x++) {
    const s = ((y / K | 0) * f.w + (x / K | 0)) * 4, d = (y * f.w * K + x) * 4;
    big[d] = rgba[s]; big[d + 1] = rgba[s + 1]; big[d + 2] = rgba[s + 2]; big[d + 3] = 255;
  }
  writeFileSync(out, encodePNG(f.w * K, f.h * K, big));
  console.log("wrote", out);
}
