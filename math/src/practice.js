// 學院練習（企劃書 v1.1，2026-11-25 使用者：導師、同學的對話取消；每個學院代表一項數學練習，進去練數學和打怪；
// 遇到不會的題目可以去圖書館學）。
//   ACADEMIES：五座學院，各教兩種數學魔法（照學系的個性分：火＝速算、水＝換個方式看同一個數、冰＝一步一步、森＝看得見的、雷＝找規律）
//   LEVELS：每種魔法三個等級（出哪些題型、用哪些學年的題庫、限時看哪個學年）
//   buildPractice()：一場練習的題目
//   LESSONS：圖書館「魔法教室」每種魔法的重點（給不會的時候學）

import { generate } from "./questions/gen.js";
import { loadBank, seeded, withChoices } from "./questions/pool.js";
import { numbersOf } from "./battle/mathmagic-more.js";

export const ACADEMIES = {
  fire: { name: "赤焰塔", school: "赤焰系", branches: ["addsub", "muldiv"], monster: "ink", area: "clock", art: "fire.png", desc: "紅磚高塔，屋頂的火盆從來沒熄過。這裡練的是「算得又快又準」。" },
  water: { name: "蒼流館", school: "蒼流系", branches: ["frac", "dec"], monster: "flower", area: "garden", art: "water.png", desc: "水道繞著館流。同一個數可以寫成分數、也可以寫成小數——換個樣子看看。" },
  ice: { name: "白霜堂", school: "白霜系", branches: ["eq", "signed"], monster: "tick", area: "library", art: "ice.png", desc: "屋簷掛著冰晶。一步一步、穩穩地算，最後再檢查。" },
  forest: { name: "翠森苑", school: "翠森系", branches: ["shape", "time"], monster: "pages", area: "garden", art: "forest.png", desc: "蓋在大樹裡的學院。把圖形和時間畫出來看，就看懂了。" },
  thunder: { name: "紫雷閣", school: "紫雷系", branches: ["ratio", "seq"], monster: "bat", area: "clock", art: "thunder.png", desc: "避雷針上劈啪閃著電光。數字排在一起，一定藏著規律。" },
};
export const ACADEMY_OF = Object.fromEntries(Object.entries(ACADEMIES).flatMap(([k, a]) => a.branches.map((b) => [b, k])));

// 每種魔法的三個等級：grade＝限時、難度看哪個學年；types＝程式出的計算題（[題型, 難度]）；bank＝用哪些學年題庫裡這種魔法的題目
export const LEVELS = {
  addsub: [
    { name: "20 以內", grade: "g1", types: [["add20", 0], ["sub20", 1], ["make10", 1]], bank: ["g1"] },
    { name: "100 以內", grade: "g2", types: [["add100", 1], ["sub100", 1]], bank: ["g2"] },
    { name: "進位、借位", grade: "g2", types: [["add100", 2], ["sub100", 2]], bank: ["g2", "g34"] },
  ],
  muldiv: [
    { name: "九九乘法", grade: "g34", types: [["times", 0], ["divide", 0]], bank: [] },
    { name: "乘除互換", grade: "g34", types: [["missingFactor", 1], ["divide", 1], ["mul2x1", 1]], bank: ["g34"] },
    { name: "先乘除後加減", grade: "g56", types: [["mixedOps", 2], ["mul2x1", 2]], bank: ["g56", "jh"] },
  ],
  frac: [
    { name: "同分母", grade: "g56", types: [["fracAdd", 0]], bank: [] },
    { name: "通分", grade: "g56", types: [["fracAdd", 1]], bank: ["g56"] },
    { name: "分數應用", grade: "g56", types: [["fracAdd", 2]], bank: ["g56", "jh"] },
  ],
  dec: [
    { name: "小數加法", grade: "g56", types: [["decAdd", 0]], bank: [] },
    { name: "小數點對齊", grade: "g56", types: [["decAdd", 1]], bank: ["g56"] },
    { name: "小數應用", grade: "g56", types: [["decAdd", 2]], bank: ["g34", "g56", "jh"] },
  ],
  eq: [
    { name: "一步解 x", grade: "jh", types: [["linearEq", 0]], bank: [] },
    { name: "移項", grade: "jh", types: [["linearEq", 1]], bank: ["jh"] },
    { name: "方程式應用", grade: "jh", types: [["linearEq", 2]], bank: ["g34", "g56", "jh"] },
  ],
  signed: [
    { name: "正負數加法", grade: "jh", types: [["signedAdd", 0]], bank: [] },
    { name: "正負數乘法", grade: "jh", types: [["signedAdd", 1], ["signedMul", 1]], bank: [] },
    { name: "混合", grade: "jh", types: [["signedAdd", 2], ["signedMul", 2]], bank: ["g56", "jh"] },
  ],
  shape: [
    { name: "圖形入門", grade: "g34", types: [], bank: ["g34"] },
    { name: "面積、周長", grade: "g56", types: [], bank: ["g56"] },
    { name: "圖形挑戰", grade: "g56", types: [], bank: ["g34", "g56", "jh"] },
  ],
  time: [
    { name: "看時鐘", grade: "g2", types: [], bank: ["g2"] },
    { name: "經過多久", grade: "g34", types: [], bank: ["g34"] },
    { name: "時間應用", grade: "g56", types: [], bank: ["g56", "jh"] },
  ],
  ratio: [
    { name: "比例式", grade: "g56", types: [["proportion", 0]], bank: [] },
    { name: "比和比值", grade: "g56", types: [["proportion", 1]], bank: ["g34", "g56"] },
    { name: "比例應用", grade: "jh", types: [["proportion", 2]], bank: ["jh"] },
  ],
  seq: [
    { name: "每次加一樣多", grade: "g2", types: [["seqNext", 0]], bank: [] },
    { name: "加減的規律", grade: "g34", types: [["seqNext", 1]], bank: [] },
    { name: "乘的規律", grade: "g56", types: [["seqNext", 2]], bank: ["jh"] },
  ],
};
export const PRACTICE_COUNT = 8;

function bankQ(b, grade) {
  return {
    kind: b.choices ? "choice" : "word", id: b.id, branch: b.branch, typeKey: `bank:${b.branch}`, grade,
    text: b.text, explain: b.explain, unit: b.unit ?? "",
    answer: b.choices ? b.choices["ABCD".indexOf(b.answer)] : String(b.answer),
    choices: b.choices ?? null, wrong: [],
    math: b.choices ? { op: "seal" } : { op: "word", nums: numbersOf(b.text), answer: String(b.answer) },
  };
}

/** 一場練習：count 題。有計算題產生器的魔法，大約 1/4 是題庫的應用題；只有題庫的（圖形、時間）全部用題庫 */
export async function buildPractice(save, branch, level, count = PRACTICE_COUNT) {
  const L = LEVELS[branch][level], rnd = seeded(Date.now());
  const banks = (await Promise.all(L.bank.map(async (g) => (await loadBank(g)).filter((q) => q.branch === branch).map((q) => [q, g])))).flat();
  const order = banks.map((x) => [rnd(), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  const nBank = L.types.length ? Math.min(order.length, Math.round(count / 4)) : Math.min(order.length, count);
  const list = [];
  for (let i = 0; i < nBank; i++) list.push(bankQ(order[i][0], order[i][1]));
  while (list.length < count && L.types.length) {
    const [t, d] = L.types[Math.floor(rnd() * L.types.length)];
    list.push({ kind: "calc", grade: L.grade, prefix: "", ...generate(t, rnd, d) });
  }
  // 題庫題排進中間（不要第一題就是長長的應用題）
  const calc = list.filter((q) => q.kind === "calc"), word = list.filter((q) => q.kind !== "calc");
  const out = [...calc];
  word.forEach((q, i) => out.splice(Math.min(out.length, 1 + Math.floor(((i + 1) * out.length) / (word.length + 1))), 0, q));
  return out.map((q) => { q.fromReview = !!save.review[q.typeKey]; return withChoices(q, rnd); });
}

// 圖書館・魔法教室：每種魔法 3 個重點＋程式出的例題（用第 1 級）
export const LESSONS = {
  addsub: { points: ["加法是把兩堆合起來，減法是拿走或比較差多少。", "湊 10：8＋5，先把 5 分成 2 和 3，8＋2＝10，再加 3＝13。", "直式要個位對個位；個位不夠減，向十位借 1 當 10。"] },
  muldiv: { points: ["乘法是「好幾個一樣多」：3×4＝3 個 4 相加。", "除法想乘法：12÷3，問「3 乘多少是 12」，答案是 4。", "一個算式裡有加減也有乘除：先算乘除，再算加減。"] },
  frac: { points: ["分數＝把一個東西平分：3/4 是分成 4 份、拿 3 份。", "分母一樣，分子直接相加，分母不變。", "分母不一樣，先通分（找一樣的分母），再相加，最後約分。"] },
  dec: { points: ["小數點右邊第一位是「十分之幾」，第二位是「百分之幾」。", "小數加減：小數點對齊，位數不夠補 0。", "0.5＝5/10＝1/2：小數和分數可以互換。"] },
  eq: { points: ["x 是一個不知道的數，等號兩邊要一樣重（像天平）。", "移項：從一邊搬到另一邊，加變減、減變加。", "最後兩邊同除以 x 前面的數，算完把答案代回去檢查。"] },
  signed: { points: ["負數比 0 還小，數線上在 0 的左邊。", "加上一個負數，就是減掉它：5＋（−3）＝5－3。", "乘法：同號得正、異號得負；負負得正。"] },
  shape: { points: ["周長是繞一圈的長度，面積是裡面有多大（幾個小方格）。", "長方形面積＝長×寬；三角形面積＝底×高÷2。", "看不懂的時候把圖畫出來，標上已知的長度。"] },
  time: { points: ["1 小時＝60 分鐘，1 分鐘＝60 秒，1 天＝24 小時。", "算經過多久：先算到整點，再加剩下的分鐘。", "下午 3 點＝15 點（24 小時制要加 12）。"] },
  ratio: { points: ["比是兩個數的關係，3：4 讀作「三比四」。", "比的前項、後項同時乘或除以同一個數，比不變。", "比例式 a：b＝c：x，看前項放大幾倍，後項也放大一樣倍。"] },
  seq: { points: ["數列是一排有規律的數，先看相鄰兩個差多少。", "每次加（或減）一樣多：照同樣的差往下算。", "差不一樣的話，看看是不是每次乘一樣的數。"] },
};

/** 魔法教室的例題（第 1 級，題庫題或計算題都可以） */
export async function lessonExamples(branch, n = 3) {
  const out = [];
  for (let lv = 0; lv < 3 && out.length < n; lv++) out.push(...(await buildPractice({ review: {} }, branch, lv, n - out.length)));
  return out.slice(0, n);
}
