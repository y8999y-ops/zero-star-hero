// 形態普攻草稿：把 fx/attacks/<form>.js 的每一段招式畫成逐格總覽（每 1/30 秒一格），主角（star.js）站在原點、依命中時間換姿勢。
// 執行：node game/tools/drafts/attacks.mjs out.png star|slime|bat|can|spike [每幾格取一格=1]
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { createFrame, clearFrame, createFx, composite } from "../../../pixelfx/src/core/index.js";
import { encodePNG } from "../../../pixelfx/tools/lib/png.mjs";
import { paintStar, POSES } from "../../src/star.js";
const [out, form = "star", every = "1"] = process.argv.slice(2);
const M = await import(pathToFileURL(resolve(`game/fx/attacks/${form}.js`)).href);
const STEPS = M.STEPS, FW = 120, FH = 56, OX = 28, OY = 48, K = 4, COLS = 7, EV = +every;
const cells = [];
for (const [si, mod] of STEPS.entries()) {
  const hits = mod.act.hits.map((h) => h.t), t0 = Math.min(...mod.act.poses.map(([t]) => t));
  const fx = createFx(mod, { x: OX, y: OY, form });
  const frame = createFrame(FW, FH);
  for (let n = Math.round(t0 * 30); n / 30 <= mod.meta.duration; n++) {
    const t = n / 30;
    if (t >= 0) { clearFrame(frame); }
    else clearFrame(frame);
    const near = hits.reduce((b, h) => (Math.abs(t - h) < Math.abs(t - b) ? h : b), hits[0]), d = t - near;
    const q = d < -0.05 ? POSES.windF : d < 0 ? POSES.smearF : d < 0.07 ? POSES.hitF : d < 0.15 ? POSES.followF : POSES.land;
    paintStar(frame, OX, OY, q, false, { form });
    if (t >= 0) fx.draw(frame);
    if (t >= -0.07 && (n - Math.round(t0 * 30)) % EV === 0) {
      const img = new Uint8ClampedArray(FW * FH * 4);
      composite(frame, img, [26, 22, 40]);
      for (let x = 0; x < FW; x++) { const i = (OY * FW + x) * 4; img[i] = 70; img[i + 1] = 60; img[i + 2] = 90; }
      cells.push({ img, label: `${si}:${t.toFixed(2)}${hits.some((h) => Math.abs(h - t) < 0.017) ? "*" : ""}` });
    }
    if (t >= 0) fx.update(1 / 30);
  }
}
const rows = Math.ceil(cells.length / COLS), W = COLS * (FW + 2) * K, H = rows * (FH + 2) * K, png = new Uint8Array(W * H * 4);
cells.forEach((c, i) => {
  const bx = (i % COLS) * (FW + 2) * K, by = Math.floor(i / COLS) * (FH + 2) * K;
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) for (let a = 0; a < K; a++) for (let b = 0; b < K; b++) {
    const s = (y * FW + x) * 4, d = ((by + y * K + b) * W + bx + x * K + a) * 4;
    png[d] = c.img[s]; png[d + 1] = c.img[s + 1]; png[d + 2] = c.img[s + 2]; png[d + 3] = 255;
  }
  // 命中的那格：上緣一條白線
  if (c.label.endsWith("*")) for (let x = 0; x < FW * K; x++) { const d = (by * W + bx + x) * 4; png[d] = png[d + 1] = png[d + 2] = 255; }
});
writeFileSync(out, encodePNG(W, H, png));
console.log(form, "格數", cells.length, cells.map((c) => c.label).filter((l) => l.endsWith("*")).join(" "));
