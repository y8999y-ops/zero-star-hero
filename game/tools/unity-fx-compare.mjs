// Unity 轉移的比對工具（pixelfx 即時特效）：逐像素比較 unity/Golden/fx-web 與 unity/Golden/fx-unity 的同名檔。
// 先跑 node --no-use-std-math-pow game/tools/unity-fx-golden.mjs（網頁版）與 Unity 的 PixelFX.Tests.Golden.RunFx，再跑這個。
// 執行：node game/tools/unity-fx-compare.mjs
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const G = join(ROOT, "unity", "Golden"), WEB = join(G, "fx-web"), UNI = join(G, "fx-unity");
const manifest = JSON.parse(readFileSync(join(WEB, "manifest.json"), "utf8"));

let ok = 0, bad = 0, frames = 0, diffs = 0;
for (const c of manifest)
  for (const flip of [0, 1]) {
    const f = `${c.name}-${flip}.bin`, u = join(UNI, f), wh = c.w * c.h;
    if (!existsSync(u)) { console.log(`✗ ${f}  Unity 沒有輸出這個檔`); bad++; continue; }
    const a = new Uint32Array(readFileSync(join(WEB, f)).buffer.slice(0)), b = new Uint32Array(readFileSync(u).buffer.slice(0));
    const n = a.length / (wh * 2);
    frames += n;
    if (a.length !== b.length) { console.log(`✗ ${f}  長度不同：網頁 ${n} 格、Unity ${b.length / (wh * 2)} 格`); bad++; continue; }
    let dc = 0, dl = 0, first = -1;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) {
      if ((Math.floor(i / wh) & 1) === 0) dc++; else dl++;
      if (first < 0) first = Math.floor(i / (wh * 2));
    }
    diffs += dc + dl;
    if (!dc && !dl) { ok++; continue; }
    bad++;
    console.log(`✗ ${f}  ${n} 格中：顏色差 ${dc} 個像素、光差 ${dl} 個像素，第一個不同在第 ${first} 格`);
  }
console.log(`${ok} 個一樣、${bad} 個不一樣（共 ${frames} 格、${diffs} 個像素不同）`);
process.exit(bad ? 1 : 0);
