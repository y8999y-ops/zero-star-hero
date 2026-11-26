// 出題的總表（企劃書 v1.2，2026-11-25 使用者：題目聚焦中年級的不同單元，要有簡單和困難模式）。
//   ACADEMIES：五座學院，各教中年級的兩個單元（照學系的個性分：火＝算得快、水＝換個樣子看、冰＝一步一步、森＝畫出來看、雷＝找規律）
//   MODES：每個單元兩種模式——簡單（三年級程度、不限時）、困難（四年級程度、限時看設定）
//   buildPractice()：學院練習一場的題目
//   AREA_UNITS／buildArea()：主線五區（三上、三下、四上、四下、總複習）每一關出哪些單元
//   LESSONS：圖書館「魔法教室」每個單元的重點（不會的時候學）
// 題目來源：src/questions/mid.js 的產生器（每個單元簡單／困難）＋題庫（以三～四年級題庫為主）裡同單元的應用題。

import { MID, bankBranch } from "./questions/mid.js";
import { loadBank, seeded, withChoices } from "./questions/pool.js";
import { numbersOf } from "./battle/mathmagic-more.js";

// 2026-11-26 使用者：五座學院改成「課程訓練」，名字用課程（像大數運算）；place＝原本的建築名
export const ACADEMIES = {
  fire: { name: "大數運算", place: "赤焰塔", school: "赤焰系", branches: ["big", "mul"], monster: "ink", area: "clock", art: "fire.png", desc: "紅磚高塔，屋頂的火盆從來沒熄過。這裡練的是「算得又快又準」：大數的加減、乘法。" },
  water: { name: "分數與小數", place: "蒼流館", school: "蒼流系", branches: ["frac", "dec"], monster: "flower", area: "garden", art: "water.png", desc: "水道繞著館流。同一個數可以寫成分數、也可以寫成小數——換個樣子看看。" },
  ice: { name: "除法與四則", place: "白霜堂", school: "白霜系", branches: ["div", "mix"], monster: "tick", area: "library", art: "ice.png", desc: "屋簷掛著冰晶。除法和併式都要一步一步、穩穩地算，最後再檢查。" },
  forest: { name: "圖形與測量", place: "翠森苑", school: "翠森系", branches: ["shape", "measure"], monster: "pages", area: "garden", art: "forest.png", desc: "蓋在大樹裡的學院。圖形、時間和單位，畫出來看就懂了。" },
  thunder: { name: "估算與規律", place: "紫雷閣", school: "紫雷系", branches: ["round", "seq"], monster: "bat", area: "clock", art: "thunder.png", desc: "避雷針上劈啪閃著電光。估算要抓住重點，數字排在一起一定藏著規律。" },
};
export const ACADEMY_OF = Object.fromEntries(Object.entries(ACADEMIES).flatMap(([k, a]) => a.branches.map((b) => [b, k])));

// 兩種模式：grade＝限時看哪一區的設定（g1 不限時、g34 有限時）；bank＝用哪些學年題庫裡同單元的應用題
export const MODES = [
  { name: "簡單", desc: "三年級程度・不限時", hard: false, grade: "g1", bank: ["g2", "g34"] },
  { name: "困難", desc: "四年級程度", hard: true, grade: "g34", bank: ["g34"] },
];
export const PRACTICE_COUNT = 3;
// 2026-11-26 使用者：簡單與困難合併成一關 → 每個單元只有一關，題目由易到難（前一半簡單、後一半困難），星星記在「單元-0」
/** 一個單元的訓練星星（舊存檔的簡單、困難取比較高的） */
export const unitStars = (s, b) => Math.min(3, Math.max(s.practice?.[`${b}-0`] ?? 0, s.practice?.[`${b}-1`] ?? 0));

function bankQ(b, grade, branch) {
  return {
    kind: b.choices ? "choice" : "word", id: b.id, branch, typeKey: `bank:${branch}`, grade,
    text: b.text, explain: b.explain, unit: b.unit ?? "",
    answer: b.choices ? b.choices["ABCD".indexOf(b.answer)] : String(b.answer),
    choices: b.choices ?? null, wrong: [],
    math: b.choices ? { op: "seal" } : { op: "word", nums: numbersOf(b.text), answer: String(b.answer) },
  };
}
async function bankOf(branch, grades) {
  return (await Promise.all(grades.map(async (g) => (await loadBank(g)).filter((q) => bankBranch(q) === branch).map((q) => [q, g])))).flat();
}
// 選項不到四個時補上：分數改分子、有千分位逗號的數改最後幾位（pool.js 的補選項只認得一般數字）
function pad(q) {
  const ans = String(q.answer), w = new Set((q.wrong ?? []).map(String));
  const add = (x) => { if (x && x !== ans && !x.startsWith("-") && !x.startsWith("0/")) w.add(x); };
  const m = ans.match(/^(\d+又)?(\d+)\/(\d+)$/);
  for (let k = 1; w.size < 3 && k < 6; k++) {
    if (m) { add(`${m[1] ?? ""}${Number(m[2]) + k}/${m[3]}`); add(`${m[1] ?? ""}${Math.max(1, Number(m[2]) - k)}/${m[3]}`); }
    else if (/^[\d,]+$/.test(ans)) { const n = Number(ans.replace(/,/g, "")), step = ans.includes(",") ? 10 ** Math.max(1, String(n).length - 2) : 1; add((n + k * step).toLocaleString("en-US")); add((n - k * step).toLocaleString("en-US")); }
    else break;
  }
  q.wrong = [...w];
  return q;
}
const calcQ = (branch, hard, rnd, grade) => pad({ kind: "calc", grade, prefix: "", ...MID[branch](rnd, hard), typeKey: `${branch}-${hard ? "h" : "e"}` });

/** 一串題目：units＝[[單元, 困難嗎], …] 輪流出；大約 1/4 是題庫的應用題（排在中間，不會第一題就是長長的應用題） */
async function build(save, units, count, bankGrades, grade, prefix = "", ordered = false) {
  const rnd = seeded(Date.now());
  const pools = await Promise.all(units.map(([b]) => bankOf(b, bankGrades)));
  const bankAll = pools.flatMap((p, i) => p.map(([q, g]) => ({ q, g, b: units[i][0] }))).map((x) => [rnd(), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  const nBank = Math.min(bankAll.length, Math.round(count / 4));
  const word = bankAll.slice(0, nBank).map(({ q, g, b }) => bankQ(q, g, b));
  const calc = [];
  const nCalc = count - word.length;
  for (let i = 0; calc.length < nCalc; i++) { const [b, hard] = ordered ? units[Math.floor((i * units.length) / nCalc)] : units[i % units.length]; calc.push({ ...calcQ(b, hard, rnd, grade), prefix }); }
  // 打散順序（同一個單元不要連續太多）
  if (!ordered) calc.sort(() => rnd() - 0.5);
  const out = [...calc];
  word.forEach((q, i) => out.splice(Math.min(out.length, 1 + Math.floor(((i + 1) * out.length) / (word.length + 1))), 0, q));
  return out.map((q) => { q.fromReview = !!save.review[q.typeKey]; return withChoices(q, rnd); });
}

/** 學院練習一場：一個單元，由易到難（前一半簡單、後一半困難；題庫應用題用三下＋四上） */
export function buildPractice(save, branch, mode, count = PRACTICE_COUNT) {
  const easy = Math.ceil(count / 2);
  const units = Array.from({ length: count }, (_, i) => [branch, i >= easy]);
  return build(save, units, count, ["g2", "g34"], "g1", "", true);
}

// 主線五區：每一區＝一個學期的單元。第 1～3 關各練一個（或兩個）單元，王把這一區全部混在一起、用困難的
export const AREA_UNITS = {
  g1: { stages: [[["big", false]], [["mul", false]], [["measure", false]]], boss: ["big", "mul", "measure"] },
  g2: { stages: [[["div", false]], [["frac", false]], [["dec", false], ["shape", false]]], boss: ["div", "frac", "dec", "shape"] },
  g34: { stages: [[["big", true]], [["mul", true]], [["div", true], ["round", false]]], boss: ["big", "mul", "div", "round"] },
  g56: { stages: [[["frac", true]], [["dec", true]], [["shape", true], ["mix", false]]], boss: ["frac", "dec", "shape", "mix"] },
  jh: { stages: [[["mix", true], ["measure", true]], [["round", true], ["seq", true]], [["frac", true], ["dec", true], ["div", true]]], boss: ["big", "mul", "div", "mix", "frac", "dec", "shape", "measure", "round", "seq"] },
};
const AREA_PREFIX = {};          // 2026-11-25 使用者：刪掉多餘的補充（原本每區題目前有一句情境話）
/** 主線一關（stage 0～2）或王（boss）或升階考核（exam：這一區全部單元、簡單困難各半） */
export function buildArea(save, grade, stage, count, boss = false, exam = false) {
  const A = AREA_UNITS[grade] ?? AREA_UNITS.g1;
  const units = boss ? A.boss.map((b) => [b, true]) : exam ? A.boss.flatMap((b) => [[b, false], [b, true]]) : A.stages[Math.min(stage, 2)];
  const anyHard = units.some((u) => u[1]);
  return build(save, units, count, anyHard ? ["g34"] : ["g2", "g34"], grade, AREA_PREFIX[grade] ?? "");
}

// 圖書館・魔法教室：每個單元 3 個重點＋例題（簡單模式出 1 題例題、困難模式出 3 題練習）
export const LESSONS = {
  big: { points: ["位值：從右邊數是個、十、百、千、萬、十萬、百萬、千萬；每往左一位就大 10 倍。", "直式加法：個位對個位，從個位加起，滿 10 往前一位進 1。", "直式減法：從個位減起，不夠減就向前一位借 1 當 10；算完用加法驗算。"] },
  mul: { points: ["乘法是「好幾個一樣多」：237×4 是 4 個 237。", "拆開乘：237×4＝200×4＋30×4＋7×4＝800＋120＋28＝948。", "乘二位數：46×23＝46×3＋46×20，兩個加起來；乘 20 就是乘 2 再補一個 0。"] },
  div: { points: ["除法是平分或包裝：47÷5，問「5 個一包，可以包幾包、剩幾個」。", "想乘法：5×9＝45，47－45＝2，所以 47÷5＝9 餘 2。", "餘數一定比除數小；驗算：商×除數＋餘數＝被除數。"] },
  mix: { points: ["一個算式裡有加減也有乘除：先算乘除，再算加減。", "有括號的先算括號裡面。", "只有加減、或只有乘除的時候，從左算到右。"] },
  frac: { points: ["分數＝把一個整體平分：3/5 是分成 5 份、拿 3 份。", "分母一樣，分子直接加減，分母不變；1＝5/5。", "分子比分母大的叫假分數，可以寫成帶分數：7/5＝1又2/5。"] },
  dec: { points: ["0.1 是 1/10，0.01 是 1/100；小數點右邊第一位是十分位、第二位是百分位。", "小數加減：小數點對齊，位數不夠補 0。", "小數×整數：先當整數乘，原來有幾位小數，答案就點幾位。"] },
  shape: { points: ["周長是繞一圈的長度；長方形周長＝(長＋寬)×2，正方形周長＝邊長×4。", "面積是裡面有幾個 1 平方公分；長方形面積＝長×寬。1 平方公尺＝10,000 平方公分。", "直角是 90 度，平角是 180 度；三角形三個角加起來是 180 度。"] },
  measure: { points: ["1 公尺＝100 公分，1 公斤＝1000 公克，1 公升＝1000 毫升。", "1 小時＝60 分，1 分＝60 秒；算經過多久，先數到整點再加。", "24 時制：下午幾點就加 12，下午 3 點＝15 點。"] },
  round: { points: ["四捨五入：看要取的那一位的「下一位」，5 以上進 1，比 5 小捨去。", "到百位：4,672 看十位的 7，進 1 變 4,700。", "估算：先把數變成概數再算，可以很快知道答案大概多少。"] },
  seq: { points: ["數量規律：先看相鄰兩個數差多少。", "每次加或減一樣多：照同樣的差往下算。", "差不一樣的話，看看是不是每次乘一樣的數，或加的數越來越多。"] },
};

/** 魔法教室的例題：簡單 1 題當例題＋簡單、困難各一題「試試看」＋再一題困難 */
export async function lessonExamples(branch) {
  const save = { review: {} };
  const [e1, e2] = await buildPractice(save, branch, 0, 2);
  const [h1, h2] = await buildPractice(save, branch, 1, 2);
  return [e1, e2, h1, h2].filter(Boolean);
}

// 舊存檔錯題本裡的題型（舊的出題器）→ 中年級單元
const OLD_TYPE = { add20: "big", sub20: "big", make10: "big", add100: "big", sub100: "big", add10: "big", sub10: "big", addsub: "big",
  times: "mul", mul2x1: "mul", missingFactor: "mul", muldiv: "mul", divide: "div", mixedOps: "mix", eq: "mix", linearEq: "mix",
  fracAdd: "frac", decAdd: "dec", seqNext: "seq", time: "measure" };
/** 錯題本特訓（企劃書 E4）：錯題本裡的單元和模式，各出幾題（題庫的應用題換成同單元的計算題）。舊分類的錯題跳過 */
export function reviewUnits(save) {
  const out = [];
  for (const k of Object.keys(save.review ?? {})) {
    const m = k.match(/^(\w+)-(e|h)$/), b = k.startsWith("bank:") ? k.slice(5) : m?.[1] ?? OLD_TYPE[k];
    const unit = MID[b] ? b : OLD_TYPE[b];
    if (unit && !out.some(([u]) => u === unit)) out.push([unit, m ? m[2] === "h" : false]);
  }
  return out;
}
export function buildReview(save, count = PRACTICE_COUNT) {
  const units = reviewUnits(save);
  return build(save, units.length ? units : [["big", false]], count, ["g34"], "g1");
}

/** 挑戰模式（企劃書 8.3：Lv15 開放）：十個單元輪流出、先簡單後困難，一直答到答錯為止（先出 60 題夠用） */
export function buildChallenge(save) {
  const ids = Object.keys(MID), units = [...ids.map((b) => [b, false]), ...ids.map((b) => [b, true])];
  return build(save, units, 60, ["g34"], "g34").then((qs) => qs.filter((q) => q.kind === "calc").concat(qs.filter((q) => q.kind !== "calc")));
}
