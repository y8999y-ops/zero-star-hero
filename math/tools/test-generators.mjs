// 檢查計算題產生器：每個題型、每個難度各產生 2000 題，確認有 4 個不重複的選項、包含正確答案、
// 而且答案能從算式算回來（能算的題型）。用法：node tools/test-generators.mjs
import { TYPES, generate } from "../src/questions/gen.js";
import { withChoices, seeded } from "../src/questions/pool.js";

const val = (s) => { s = String(s).replace(/−/g, "-"); if (s.includes("/")) { const [a, b] = s.split("/").map(Number); return a / b; } return Number(s); };
function evalText(t) {
  if (/□|x|：/.test(t)) return null;
  let e = t.replace(/＝.*$/, "").replace(/（/g, "(").replace(/）/g, ")").replace(/−/g, "-").replace(/＋/g, "+").replace(/－/g, "-").replace(/×/g, "*").replace(/÷/g, "/");
  e = e.replace(/(\d+)\/(\d+)/g, "($1/$2)");
  try { return Function(`return (${e})`)(); } catch { return NaN; }
}
let bad = 0;
for (const type of Object.keys(TYPES)) for (let d = 0; d < 3; d++) {
  const rnd = seeded(1234 + d);
  for (let i = 0; i < 2000; i++) {
    const q = withChoices({ kind: "calc", ...generate(type, rnd, d) }, rnd);
    const o = q.options;
    const why = o.length !== 4 ? "選項不足 4 個" : new Set(o).size !== 4 ? "選項重複" : !o.includes(q.answer) ? "沒有正確答案" : o.some((x) => /NaN|Infinity|undefined/.test(x)) ? "選項壞掉" : null;
    const ev = evalText(q.text);
    const why2 = ev != null && Math.abs(ev - val(q.answer)) > 1e-6 ? `答案算錯（${ev}）` : null;
    if (why || why2) { if (bad++ < 15) console.log(type, d, q.text, q.answer, o.join(" | "), why ?? why2); }
  }
}
console.log(bad ? `有 ${bad} 題有問題` : "全部通過");
process.exit(bad ? 1 : 0);
