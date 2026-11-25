// 把改寫表合併成遊戲讀的題庫：data/questions/built/<學年>.json
// 用法：在 math/ 底下執行 npm run build（會先跑 check，有錯就不產生）
// 只收 keep: true 的題目；每題標上魔法分支（branch）。

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const REWRITE = ROOT + "data/questions/rewrite/";
const OUT = ROOT + "data/questions/built/";
const GRADES = ["g1", "g2", "g34", "g56", "jh"];

try {
  execFileSync(process.execPath, [ROOT + "tools/check-rewrites.mjs"], { stdio: ["ignore", "ignore", "inherit"] });
} catch {
  console.error("改寫表檢查沒過，先跑 npm run check 修好再 build");
  process.exit(1);
}

// 依題目內容猜魔法分支（企劃書 8.5）。猜不到就依學年給預設分支。
const BRANCH_RULES = [
  ["seq", /數列|等差|等比|規律/],
  ["eq", /方程式|未知數|x|□|解謎/],
  ["signed", /−\d|－\d|-\d|負數|正負/],
  ["ratio", /%|百分|比是|：\d|比例|折/],
  ["shape", /面積|體積|周長|表面積|長方|正方|三角|圓/],
  ["time", /小時|分鐘|秒|每小時|速度|公里/],
  ["frac", /\d\/\d|分之|分數/],
  ["dec", /\d\.\d/],
  ["muldiv", /倍|平均|每|乘|除|分給/],
];
const DEFAULT_BRANCH = { g1: "addsub", g2: "addsub", g34: "muldiv", g56: "frac", jh: "eq" };
const branchOf = (q) => BRANCH_RULES.find(([, re]) => re.test(q.text))?.[0] ?? DEFAULT_BRANCH[q.grade];

const built = Object.fromEntries(GRADES.map((g) => [g, []]));
for (const f of readdirSync(REWRITE).filter((f) => f.endsWith(".json")).sort()) {
  for (const r of JSON.parse(readFileSync(REWRITE + f, "utf8"))) {
    if (!r.keep) continue;
    const q = { id: r.id, grade: r.grade, text: r.text, answer: r.answer, explain: r.explain };
    if (r.choices) q.choices = r.choices;
    else q.unit = r.unit ?? "";
    q.branch = branchOf(r);
    built[r.grade].push(q);
  }
}

mkdirSync(OUT, { recursive: true });
for (const g of GRADES) writeFileSync(OUT + `${g}.json`, JSON.stringify(built[g]));
console.log(Object.fromEntries(GRADES.map((g) => [g, built[g].length])));
