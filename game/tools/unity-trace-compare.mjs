// Unity 轉移的「操作錄影」比對：逐步比較 unity/Golden/web 與 unity/Golden/unity 的 trace.txt（數值）和 trace-frames.bin（畫面）。
// 先跑 node game/tools/unity-trace-full.mjs（網頁版，跑真正的 main.js）與 Unity 的 ZeroStar.Tests.TraceTest.Run，再跑這個。
// 數值：每一欄都要完全一樣（小數也是）；有不一樣的就印出第一步、哪一欄。畫面：每張逐像素比對，不一樣的存 diff-trace-<張>.png。
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { encodePNG } from "../../pixelfx/tools/lib/png.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const G = join(ROOT, "unity", "Golden");
const COLS = ["步", "主角x", "主角y", "vx", "vy", "狀態", "血", "面向", "著地", "姿勢", "鏡頭x", "鏡頭y", "停頓", "震動", "形態", "魔力", "連擊", "大招", "關卡事件", "怪數"];
const EC = ["種類", "x", "y", "vx", "vy", "血", "醒", "狀態"];
const name = (i) => (i < COLS.length ? COLS[i] : `怪${Math.floor((i - COLS.length) / 8)}.${EC[(i - COLS.length) % 8]}`);

const VAR = process.argv[2] ? "-" + process.argv[2] : "";   // 穿搭：node unity-trace-compare.mjs A
const A = readFileSync(join(G, "web", `trace${VAR}.txt`), "utf8").trim().split("\n"), B = readFileSync(join(G, "unity", `trace${VAR}.txt`), "utf8").trim().split("\n");
let bad = 0;
if (A.length !== B.length) { console.log(`✗ 步數不同：網頁 ${A.length}、Unity ${B.length}`); bad++; }
for (let n = 0; n < Math.min(A.length, B.length); n++) {
  const a = A[n].split(" "), b = B[n].split(" ");
  const diff = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i], y = b[i];
    const num = (v) => (v !== undefined && /^U/.test(v) ? v.slice(1) : v);   // 大招欄「U時間」
    const nx = num(x), ny = num(y);
    const same = x === y || (nx !== undefined && ny !== undefined && !isNaN(+nx) && !isNaN(+ny) && +nx === +ny && (x[0] === "U") === (y[0] === "U"));
    if (!same) diff.push(`${name(i)}：網頁 ${x}、Unity ${y}`);
  }
  if (diff.length) {
    bad++;
    console.log(`✗ 第 ${n} 步開始不一樣（${diff.length} 欄）：\n  ` + diff.slice(0, 8).join("\n  "));
    if (n > 0) console.log("  前一步：網頁 " + A[n - 1].split(" ").slice(0, 10).join(" ") + "\n         Unity " + B[n - 1].split(" ").slice(0, 10).join(" "));
    break;
  }
}
if (!bad) console.log(`✓ 數值：${A.length} 步，每一步、每一欄完全一樣`);

// 畫面
const fa = readFileSync(join(G, "web", `trace-frames${VAR}.bin`)), fb = readFileSync(join(G, "unity", `trace-frames${VAR}.bin`));
const W = 384, H = 216, sz = W * H * 4, nf = Math.min(fa.length, fb.length) / sz;
let fbad = 0, shown = 0;
if (fa.length !== fb.length) { console.log(`✗ 畫面張數不同：網頁 ${fa.length / sz}、Unity ${fb.length / sz}`); fbad++; }
for (let f = 0; f < nf; f++) {
  let d = 0;
  for (let i = 0; i < sz; i += 4) if (fa[f * sz + i] !== fb[f * sz + i] || fa[f * sz + i + 1] !== fb[f * sz + i + 1] || fa[f * sz + i + 2] !== fb[f * sz + i + 2]) d++;
  if (!d) continue;
  fbad++;
  if (shown < 3) {
    shown++;
    console.log(`✗ 第 ${f} 張畫面（第 ${f * 20} 步）：${d} 個像素不一樣`);
    const out = new Uint8Array(W * 3 * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const s = f * sz + (y * W + x) * 4, o = (y * W * 3 + x) * 4;
      for (let c = 0; c < 3; c++) { out[o + c] = fa[s + c]; out[o + W * 4 + c] = fb[s + c]; }
      out[o + 3] = out[o + W * 4 + 3] = out[o + W * 8 + 3] = 255;
      const df = fa[s] !== fb[s] || fa[s + 1] !== fb[s + 1] || fa[s + 2] !== fb[s + 2];
      out[o + W * 8] = df ? 255 : 40; out[o + W * 8 + 1] = df ? 32 : 40; out[o + W * 8 + 2] = df ? 32 : 48;
    }
    writeFileSync(join(G, `diff-trace-${f}.png`), encodePNG(W * 3, H, out));
  }
}
if (!fbad) console.log(`✓ 畫面：${nf} 張，每個像素完全一樣`);
else console.log(`畫面：${nf} 張中 ${fbad} 張不一樣（差異圖在 unity/Golden/diff-trace-*.png：左網頁、中 Unity、右紅色＝不一樣）`);
process.exit(bad || fbad ? 1 : 0);
