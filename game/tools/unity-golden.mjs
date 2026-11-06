// Unity 轉移的比對工具（網頁版這一邊）：把指定的特效模組一格一格畫出來，存成原始像素檔，
// Unity 那邊用同樣的規則畫一次（PixelFX.Tests.Golden），再用 unity-compare.mjs 逐像素比對。
//
// 規則（兩邊要一樣）：畫布＝meta.size，原點＝meta.origin（翻轉時 x 改成 W - origin.x），
//   第 i 格的時間 t = i / fps（fps＝meta.fps），共 round(duration × fps) + 1 格；
//   選項＝meta.options（調色盤等）；畫筆 place(原點, flip)。
// 檔案：unity/Golden/web/<組>-<步>-<0|1>.bin ＝ 每一格先 color（W×H 個 uint32，little-endian）再 light。
//
// 執行：node game/tools/unity-golden.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createFrame, clearFrame, painterFor, resolveOptions } from "../../pixelfx/src/core/index.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(ROOT, "unity", "Golden", "web");
mkdirSync(OUT, { recursive: true });

// 要比對的模組：五個形態的普攻（game/fx/attacks）
const GROUPS = ["star", "slime", "bat", "can", "spike"];

let files = 0;
for (const g of GROUPS) {
  const mod = await import(`../fx/attacks/${g}.js`);
  mod.STEPS.forEach((step, si) => {
    const meta = step.meta, [W, H] = meta.size, [OX, OY] = meta.origin;
    const n = Math.round(meta.duration * meta.fps) + 1;
    for (const flip of [false, true]) {
      const opts = resolveOptions(meta, {});
      const f = createFrame(W, H);
      const buf = new Uint32Array(n * W * H * 2);
      for (let i = 0; i < n; i++) {
        clearFrame(f);
        const p = painterFor(f).place(flip ? W - OX : OX, OY, flip, 0);
        step.draw(p, i / meta.fps, opts);
        buf.set(f.color, i * W * H * 2);
        buf.set(f.light, i * W * H * 2 + W * H);
      }
      writeFileSync(join(OUT, `${g}-${si}-${flip ? 1 : 0}.bin`), Buffer.from(buf.buffer));
      files++;
    }
  });
}
console.log(`寫出 ${files} 個比對檔到 ${OUT}`);
