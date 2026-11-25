// 檢查題目情境改寫表（data/questions/rewrite/*.json）。
// 用法：在 math/ 底下執行 npm run check
// 有錯誤時結束碼是 1；提醒（不一定是錯）只印出來。

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const WORK = ROOT + "data/questions/work/";
const REWRITE = ROOT + "data/questions/rewrite/";
const GRADES = new Set(["g1", "g2", "g34", "g56", "jh"]);

// 原題
const originals = new Map();
for (const f of readdirSync(WORK).filter((f) => f.endsWith(".json"))) {
  for (const q of JSON.parse(readFileSync(WORK + f, "utf8"))) originals.set(q.id, q);
}

// 只有簡體才會出現的常用字（繁體文章裡不該出現）
const SIMPLIFIED = "们这个为来说时会对过还没发现买卖钱运车边进远组间问题么样从两种几块条张轮场园书机关开门长东笔级师学读写纸图画乐欢节价应该给让请认识让谁谢带专业产务尽经结续总际难颗鸡鸭鱼鸟龙马猪饭汤粮红绿蓝灯网电话脑观视听讲课习练称厂户队农贸艺术"
  .split("").filter((c, i, a) => a.indexOf(c) === i);
// 不用的中國用語、或違反世界觀的用詞
const BANNED = [
  [/千克/, "千克 → 公斤"], [/厘米/, "厘米 → 公分"], [/分米/, "分米 → 公寸或改單位"], [/毫米/, "毫米 → 毫米請改公釐"],
  [/\d\s*米/, "米 → 公尺"], [/(?<![公毫])升(?![級起高])/, "升 → 公升（若是升級等意思請忽略）"],
  [/\d\s*克(?!服)/, "克 → 公克"], [/\d\s*[元角]/, "元、角 → 晶幣"], [/成活率/, "成活率 → 存活率"],
  [/巫師/, "巫師 → 魔數師"], [/露米|索爾/, "主角不取名"],
];

const numsOf = (s) => (String(s).match(/\d+(\.\d+)?/g) ?? []).map((n) => String(Number(n)));
function multisetMissing(need, have) {
  const pool = [...have];
  return need.filter((n) => {
    const i = pool.indexOf(n);
    if (i < 0) return true;
    pool.splice(i, 1);
    return false;
  });
}

let errors = 0, warns = 0, kept = 0, dropped = 0;
const seen = new Set();
const byGrade = {};
const err = (id, m) => { errors++; console.log(`✗ ${id}：${m}`); };
const warn = (id, m) => { warns++; console.log(`△ ${id}：${m}`); };

for (const f of readdirSync(REWRITE).filter((f) => f.endsWith(".json")).sort()) {
  let list;
  try { list = JSON.parse(readFileSync(REWRITE + f, "utf8")); }
  catch (e) { err(f, `JSON 格式錯誤：${e.message}`); continue; }
  for (const r of list) {
    const id = r.id ?? `${f}（沒有 id）`;
    const o = originals.get(r.id);
    if (!o) { err(id, "原題找不到"); continue; }
    if (seen.has(r.id)) err(id, "重複改寫");
    seen.add(r.id);
    if (r.keep === false) {
      dropped++;
      if (!r.why) err(id, "不收的題目要寫 why");
      continue;
    }
    if (r.keep !== true) { err(id, "keep 要是 true 或 false"); continue; }
    kept++;
    if (!GRADES.has(r.grade)) err(id, `grade 不對：${r.grade}`);
    byGrade[r.grade] = (byGrade[r.grade] ?? 0) + 1;
    if (!r.text) err(id, "沒有 text");
    if (!r.explain) err(id, "沒有 explain");

    const all = [r.text, r.explain, ...(r.choices ?? []), r.unit ?? ""].join(" ");
    const simp = SIMPLIFIED.filter((c) => all.includes(c));
    if (simp.length) err(id, `有簡體字：${simp.join("")}`);
    for (const [re, m] of BANNED) if (re.test(all)) err(id, `用語：${m}`);

    if (o.source === "tmmluplus") {
      if (!["A", "B", "C", "D"].includes(r.answer)) err(id, "選擇題 answer 要是 A～D");
      else if (r.answer !== o.answer) err(id, `答案跟原題不同（原題 ${o.answer}）`);
      if (!Array.isArray(r.choices) || r.choices.length !== 4) err(id, "選擇題要有 4 個 choices");
    } else {
      const want = r.unit === "%" ? o.answer * 100 : o.answer;
      if (typeof r.answer !== "number") err(id, "answer 要是數字");
      else if (Math.abs(r.answer - want) > 1e-6) err(id, `答案 ${r.answer} 跟原題 ${want} 不同`);
      if (r.unit === undefined) err(id, "應用題要寫 unit（沒有單位就寫空字串）");
    }

    // 原題的數字都要出現在改寫裡（除非 numsNote 說明了原因）
    const origText = [o.original, ...(o.choices ?? [])].join(" ");
    const newText = [r.text, ...(r.choices ?? [])].join(" ");
    const missing = multisetMissing(numsOf(origText), numsOf(newText));
    if (missing.length && !r.numsNote) err(id, `原題的數字不見了：${missing.join("、")}（若是故意的請寫 numsNote）`);
    const extra = multisetMissing(numsOf(newText), numsOf(origText));
    if (extra.length && !r.numsNote) warn(id, `多了原題沒有的數字：${extra.join("、")}（確認沒有改變題意）`);

    if (r.grade === "g1" && r.text.length > 60) warn(id, `一年級題目偏長（${r.text.length} 字）`);
  }
}

console.log(`\n收 ${kept} 題、不收 ${dropped} 題，各學年：${JSON.stringify(byGrade)}`);
console.log(`錯誤 ${errors}、提醒 ${warns}`);
process.exit(errors ? 1 : 0);
