// Unity 轉移的比對工具：逐像素比較 unity/Golden/web 與 unity/Golden/unity 的同名檔。
// 先跑 node game/tools/unity-golden.mjs（網頁版）與 Unity 的 PixelFX.Tests.Golden.Run，再跑這個。
// 有不一樣的檔案時，把第一個不一樣的格子存成 unity/Golden/diff-<檔名>.png（左網頁、中 Unity、右差異標紅）。
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { encodePNG } from "../../pixelfx/tools/lib/png.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const G = join(ROOT, "unity", "Golden"), WEB = join(G, "web"), UNI = join(G, "unity");
// 每組的畫布大小（跟 meta.size 一樣）
const SIZE = { star: [150, 80], slime: [190, 90], bat: [150, 90], can: [170, 100], spike: [180, 90] };

let ok = 0, bad = 0;
for (const f of readdirSync(WEB).filter((n) => n.endsWith(".bin")).sort()) {
  const u = join(UNI, f);
  if (!existsSync(u)) { console.log(`✗ ${f}  Unity 沒有輸出這個檔`); bad++; continue; }
  const a = new Uint32Array(readFileSync(join(WEB, f)).buffer.slice(0)), b = new Uint32Array(readFileSync(u).buffer.slice(0));
  const [W, H] = SIZE[f.split("-")[0]], wh = W * H, n = a.length / (wh * 2);
  if (a.length !== b.length) { console.log(`✗ ${f}  長度不同：網頁 ${a.length / (wh * 2)} 格、Unity ${b.length / (wh * 2)} 格`); bad++; continue; }
  let dc = 0, dl = 0, first = -1;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) {
    if ((Math.floor(i / wh) & 1) === 0) dc++; else dl++;
    if (first < 0) first = Math.floor(i / (wh * 2));
  }
  if (!dc && !dl) { ok++; continue; }
  bad++;
  console.log(`✗ ${f}  ${n} 格中：顏色差 ${dc} 個像素、光差 ${dl} 個像素，第一個不同在第 ${first} 格`);
  // 差異圖：第 first 格的 color，左網頁、中 Unity、右差異（紅）
  const K = 3, out = new Uint8Array(W * 3 * K * H * K * 4);
  const put = (x, y, c) => { for (let dy = 0; dy < K; dy++) for (let dx = 0; dx < K; dx++) { const j = ((y * K + dy) * W * 3 * K + x * K + dx) * 4; out[j] = c & 255; out[j + 1] = (c >>> 8) & 255; out[j + 2] = (c >>> 16) & 255; out[j + 3] = 255; } };
  const base = first * wh * 2;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = base + y * W + x, ca = a[i] || 0xff201820, cb = b[i] || 0xff201820;
    put(x, y, ca); put(x + W, y, cb);
    put(x + 2 * W, y, a[i] !== b[i] || a[i + wh] !== b[i + wh] ? 0xff2020ff : 0xff302828);
  }
  writeFileSync(join(G, `diff-${f.replace(".bin", "")}.png`), encodePNG(W * 3 * K, H * K, out));
}
console.log(`\n比對結果：${ok} 個檔完全一樣、${bad} 個有差異`);
process.exit(bad ? 1 : 0);
