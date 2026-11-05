// 一次打死 6 隻：舊（6 團煙、原速）vs 新（2 團煙＋4 個小星點、1.5 倍速）——逐格數被蓋住的像素，並輸出對照圖
import { writeFileSync } from "node:fs";
import { encodePNG } from "../../../pixelfx/tools/lib/png.mjs";
import { createFrame, createFx } from "../../../pixelfx/src/core/index.js";
import * as poof from "../../../pixelfx/src/fx/spawn/poof.js";
import * as burst from "../../../pixelfx/src/fx/impacts/hit-spark.js";
const PAL = ["#0b2f2b", "#12594a", "#1f8f4f", "#47c752", "#a6f06a", "#f0ffd2"], SP = [...PAL, "#ffffff"];
const W = 200, H = 90, xs = [60, 72, 84, 96, 108, 120];
const setups = {
  old: xs.map((x, i) => ({ fx: createFx(poof, { x, y: 80, palette: PAL, seed: i + 1 }), sp: 1 })),
  new: xs.map((x, i) => i < 2 ? { fx: createFx(poof, { x, y: 80, palette: PAL, seed: i + 1 }), sp: 1.5 } : { fx: createFx(burst, { x, y: 69, palette: SP, seed: i + 1, angle: -Math.PI / 2 }), sp: 1.2 }),
};
const S = 3, ts = [0.05, 0.15, 0.3, 0.5, 0.7, 0.9, 1.1, 1.3], rows = Object.keys(setups);
const img = new Uint8Array(ts.length * (W + 2) * S * rows.length * (H + 2) * S * 4), IW = ts.length * (W + 2) * S;
const report = {};
rows.forEach((name, r) => {
  let t = 0; report[name] = [];
  ts.forEach((tt, c) => {
    while (t < tt - 1e-6) { for (const e of setups[name]) e.fx.update((1 / 60) * e.sp); t += 1 / 60; }
    const f = createFrame(W, H); for (const e of setups[name]) e.fx.draw(f);
    let n = 0; for (let i = 0; i < W * H; i++) if (f.color[i] >>> 24) n++;
    report[name].push(n);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = f.color[y * W + x], a = (v >>> 24) / 255, bg = y >= 80 ? [40, 34, 58] : [20, 16, 32], col = [v & 255, (v >>> 8) & 255, (v >>> 16) & 255].map((q, k) => Math.round(bg[k] + (q - bg[k]) * a)); for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) img.set([...col, 255], (((r * (H + 2) + y) * S + j) * IW + (c * (W + 2) + x) * S + i) * 4); }
  });
});
writeFileSync(process.argv[2], encodePNG(IW, rows.length * (H + 2) * S, img));
console.log("時間", ts.join(" / ")); for (const k of rows) console.log(k, report[k].join(" / "));
