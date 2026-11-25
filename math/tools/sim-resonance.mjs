// 共鳴儀式模擬（待辦 G1）：亂數作答很多次，看五種屬性各出現幾成。目標：每種 15～25%。
// 也模擬「喜歡選第一個」「喜歡選最後一個」的小朋友，看選項順序會不會讓某個屬性特別多。
// 用法（在 math/ 底下）：node tools/sim-resonance.mjs [次數]
import { readFileSync } from "node:fs";

const d = JSON.parse(readFileSync(new URL("../data/quiz/resonance.json", import.meta.url), "utf8"));
const ATTRS = ["fire", "water", "ice", "forest", "thunder"];
const N = +(process.argv[2] ?? 100000);

function play(choose) {
  const score = Object.fromEntries(ATTRS.map((a) => [a, 0]));
  for (const q of d.questions) {
    // 跟遊戲一樣：屬性題的選項順序打亂（resonance.js）
    const order = q.options.map((_, k) => k);
    if (q.kind === "style") for (let k = order.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [order[k], order[j]] = [order[j], order[k]]; }
    const i = order[choose(q.options.length)];
    if (q.kind === "style") for (const a of q.options[i].attrs) score[a] += 2;
  }
  const top = Math.max(...Object.values(score)), tied = ATTRS.filter((a) => score[a] === top);
  for (let k = tied.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [tied[k], tied[j]] = [tied[j], tied[k]]; }   // 同分補問的選項也打亂
  return tied.length > 1 ? tied[choose(tied.length)] : tied[0];
}

const kinds = {
  "亂選": (n) => Math.floor(Math.random() * n),
  "比較常選第一個（40%）": (n) => (Math.random() < 0.4 ? 0 : Math.floor(Math.random() * n)),
  "比較常選最後一個（40%）": (n) => (Math.random() < 0.4 ? n - 1 : Math.floor(Math.random() * n)),
};
let ok = true;
for (const [name, choose] of Object.entries(kinds)) {
  const cnt = Object.fromEntries(ATTRS.map((a) => [a, 0]));
  for (let i = 0; i < N; i++) cnt[play(choose)]++;
  const row = ATTRS.map((a) => { const p = (100 * cnt[a]) / N; if (p < 15 || p > 25) ok = false; return `${a} ${p.toFixed(1)}%`; });
  console.log(`${name.padEnd(14)}  ${row.join("  ")}`);
}
console.log(ok ? "通過：三種作答習慣，每種屬性都在 15～25%" : "沒通過：有屬性不在 15～25%");
process.exit(ok ? 0 : 1);
