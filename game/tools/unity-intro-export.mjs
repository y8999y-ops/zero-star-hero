// Unity 轉移：開場動畫（src/intro.js）用到、但 unity-export.mjs 沒匯出的主角姿勢（換了眼睛、手的變化、正面待機），
// 用網頁版的 starPixels 算好匯出成 unity/Assets/Resources/Baked/intro-hero.bytes（格式跟 hero.bytes 一樣：ZHR1，gzip）。
// Unity 那邊 Intro.cs 讀這個檔。改了 star.js 的主角畫法之後重跑一次：node --no-use-std-math-pow game/tools/unity-intro-export.mjs
import { installDom } from "./unity/node-dom.mjs";
installDom();
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(ROOT, "unity", "Assets", "Resources", "Baked", "intro-hero.bytes");
const { POSES, starPixels } = await import("../src/star.js");

// 名字 → 姿勢（照 intro.js 裡 hero(q) 用到的每一種）
const LOOK = { ...POSES.stand, hf: [-2, -2], hb: [2, -2] };
const names = [
  ["fall-hurt", { ...POSES.fall, eyes: "hurt" }],     // B2：往下衝
  ["hurt", { ...POSES.hurt, eyes: "hurt" }],          // D：趴著、跌倒
  ["hurt-blink", { ...POSES.hurt, eyes: "blink" }],
  ["hurt-open", { ...POSES.hurt, eyes: "open" }],
  ["land", POSES.land], ["stand", POSES.stand], ["jump", POSES.jump],
  ["look-open", { ...LOOK, eyes: "open" }],           // 低頭看自己的手
  ["look-blink", { ...LOOK, eyes: "blink" }],
  ...POSES.run.map((q, i) => [`run#${i}`, q]),
  ...POSES.idle.map((q, i) => [`idle#${i}`, { ...q, view: 0 }]),   // 爬起來之後正面待機
];
const parts = [];
const i32 = (v) => { const b = Buffer.alloc(4); b.writeInt32LE(v | 0); parts.push(b); };
const f64 = (v) => { const b = Buffer.alloc(8); b.writeDoubleLE(v); parts.push(b); };
const str = (s) => { const b = Buffer.from(s, "utf8"); i32(b.length); parts.push(b); };
str("ZHR1"); i32(names.length);
for (const [n, q] of names) {
  const s = starPixels(q), px = new Uint32Array(s.W * s.H);
  for (let y = 0; y < s.H; y++) for (let x = 0; x < s.W; x++) px[y * s.W + x] = s.px[y][x] >>> 0;
  str(n); i32(s.W); i32(s.H); i32(s.ax); i32(s.ay); f64(s.core[0]); f64(s.core[1]); f64(s.hand[0]); f64(s.hand[1]);
  i32(px.length); parts.push(Buffer.from(px.buffer));
}
writeFileSync(OUT, gzipSync(Buffer.concat(parts), { level: 9 }));
console.log(`寫出 ${names.length} 個姿勢到 ${OUT}`);
