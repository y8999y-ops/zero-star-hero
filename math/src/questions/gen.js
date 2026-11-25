// 計算題產生器（企劃書 6.2）。每個題型一個函式：(rnd, d) → 題目。
// d：難度 0～2（同一學年的第 1～3 小關）。題目格式：
//   { type, branch, text, answer, wrong: [常見錯法…], explain }
// answer 和 wrong 都是字串（分數、負數也能顯示）；choices.js 會補滿四個選項。

const ri = (rnd, a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (rnd, list) => list[Math.floor(rnd() * list.length)];
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
const neg = (n) => (n < 0 ? `−${-n}` : `${n}`);
const par = (n) => (n < 0 ? `（−${-n}）` : `${n}`);
const frac = (n, d) => { const g = gcd(n, d); n /= g; d /= g; return d === 1 ? `${n}` : `${n}/${d}`; };

export const TYPES = {
  // ── 一年級 ──
  add20(rnd, d) {
    const max = [10, 18, 20][d];
    const a = ri(rnd, 1, max - 1), b = ri(rnd, 1, max - a);
    const s = a + b;
    const explain = a < 10 && s > 10 ? `先湊 10：${a}＋${10 - a}＝10，再加 ${b - (10 - a)}＝${s}` : `${a}＋${b}＝${s}`;
    return { branch: "addsub", text: `${a} ＋ ${b} ＝ ？`, answer: `${s}`, wrong: [`${s - 1}`, `${s + 1}`, `${Math.abs(a - b)}`], explain, math: { op: "+", a, b } };
  },
  sub20(rnd, d) {
    const max = [10, 18, 20][d];
    const a = ri(rnd, 2, max), b = ri(rnd, 1, a - 1);
    const r = a - b;
    const explain = a > 10 && b > a - 10 ? `先減到 10：${a}－${a - 10}＝10，再減 ${b - (a - 10)}＝${r}` : `${a}－${b}＝${r}`;
    return { branch: "addsub", text: `${a} － ${b} ＝ ？`, answer: `${r}`, wrong: [`${r + 1}`, `${r - 1}`, `${a + b}`], explain, math: { op: "-", a, b } };
  },
  make10(rnd, d) {
    const total = d === 0 ? 10 : ri(rnd, 10, 20);
    const a = ri(rnd, 1, total - 1), b = total - a;
    return { branch: "addsub", text: `□ ＋ ${a} ＝ ${total}，□ ＝ ？`, answer: `${b}`, wrong: [`${total + a}`, `${b + 1}`, `${b - 1}`], explain: `${total}－${a}＝${b}`, math: { op: "-", a: total, b: a } };
  },
  // ── 二年級 ──
  add100(rnd, d) {
    const a = ri(rnd, 11, [49, 79, 89][d]), b = ri(rnd, d ? 11 : 1, 99 - a);
    const s = a + b, noCarry = (Math.floor(a / 10) + Math.floor(b / 10)) * 10 + ((a % 10) + (b % 10)) % 10;
    return { branch: "addsub", text: `${a} ＋ ${b} ＝ ？`, answer: `${s}`, wrong: [`${noCarry}`, `${s + 10}`, `${s - 1}`], explain: `個位 ${a % 10}＋${b % 10}＝${(a % 10) + (b % 10)}${(a % 10) + (b % 10) >= 10 ? "，進 1" : ""}；${a}＋${b}＝${s}`, math: { op: "+", a, b } };
  },
  sub100(rnd, d) {
    const a = ri(rnd, [20, 40, 60][d], 99), b = ri(rnd, 2, a - 1);
    const r = a - b, borrowSlip = Math.abs((Math.floor(a / 10) - Math.floor(b / 10)) * 10 + Math.abs((a % 10) - (b % 10)));
    return { branch: "addsub", text: `${a} － ${b} ＝ ？`, answer: `${r}`, wrong: [`${borrowSlip}`, `${r + 10}`, `${r + 1}`], explain: `${a}－${b}＝${r}${a % 10 < b % 10 ? "（個位不夠減，向十位借 1）" : ""}`, math: { op: "-", a, b } };
  },
  // ── 三～四年級 ──
  times(rnd, d) {
    const a = ri(rnd, 2, 9), b = ri(rnd, d ? 2 : 1, 9);
    return { branch: "muldiv", text: `${a} × ${b} ＝ ？`, answer: `${a * b}`, wrong: [`${a * b + a}`, `${a * b - b}`, `${a + b}`], explain: `${a} 個 ${b} 相加，九九乘法 ${a}×${b}＝${a * b}` };
  },
  divide(rnd, d) {
    const b = ri(rnd, 2, 9), q = ri(rnd, 2, [9, 9, 12][d]), a = b * q;
    return { branch: "muldiv", text: `${a} ÷ ${b} ＝ ？`, answer: `${q}`, wrong: [`${q + 1}`, `${q - 1}`, `${a - b}`], explain: `想乘法：${b}×${q}＝${a}，所以 ${a}÷${b}＝${q}` };
  },
  missingFactor(rnd) {
    const a = ri(rnd, 2, 9), b = ri(rnd, 2, 9);
    return { branch: "muldiv", text: `□ × ${a} ＝ ${a * b}，□ ＝ ？`, answer: `${b}`, wrong: [`${b + 1}`, `${a * b - a}`, `${b - 1}`], explain: `${a * b}÷${a}＝${b}` };
  },
  mul2x1(rnd, d) {
    const a = ri(rnd, 12, [39, 69, 99][d]), b = ri(rnd, 2, 9);
    return { branch: "muldiv", text: `${a} × ${b} ＝ ？`, answer: `${a * b}`, wrong: [`${(a % 10) * b + Math.floor(a / 10) * 10}`, `${a * b + 10}`, `${a * b - b}`], explain: `${Math.floor(a / 10) * 10}×${b}＝${Math.floor(a / 10) * 10 * b}，${a % 10}×${b}＝${(a % 10) * b}，合起來 ${a * b}` };
  },
  // ── 五～六年級 ──
  fracAdd(rnd, d) {
    const den = ri(rnd, 3, [9, 12, 12][d]);
    if (d < 2) {
      const a = ri(rnd, 1, den - 2), b = ri(rnd, 1, den - 1 - a);
      return { branch: "frac", text: `${a}/${den} ＋ ${b}/${den} ＝ ？`, answer: frac(a + b, den), wrong: [`${a + b}/${den * 2}`, frac(a + b + 1, den), frac(Math.abs(a - b) || 1, den)], explain: `分母一樣，分子相加：${a}＋${b}＝${a + b}，答案 ${frac(a + b, den)}` };
    }
    const d1 = pick(rnd, [2, 3, 4]), d2 = pick(rnd, [3, 5, 6].filter((x) => x !== d1));
    const n = d1 * d2 / gcd(d1, d2);
    return { branch: "frac", text: `1/${d1} ＋ 1/${d2} ＝ ？`, answer: frac(n / d1 + n / d2, n), wrong: [`2/${d1 + d2}`, frac(1, n), frac(n / d1 + n / d2 + 1, n)], explain: `通分成分母 ${n}：${n / d1}/${n}＋${n / d2}/${n}＝${frac(n / d1 + n / d2, n)}` };
  },
  decAdd(rnd, d) {
    const a = ri(rnd, 11, 99) / 10, b = ri(rnd, d ? 101 : 11, d ? 999 : 99) / (d ? 100 : 10);
    const s = Math.round((a + b) * 100) / 100;
    return { branch: "dec", text: `${a} ＋ ${b} ＝ ？`, answer: `${s}`, wrong: [`${Math.round((a * 10 + b) * 100) / 100}`, `${Math.round((s + 0.1) * 100) / 100}`, `${Math.round((s - 1) * 100) / 100}`], explain: `小數點對齊再相加：${a}＋${b}＝${s}` };
  },
  mixedOps(rnd, d) {
    const a = ri(rnd, 2, 20), b = ri(rnd, 2, 9), c = ri(rnd, 2, 9);
    return { branch: "muldiv", text: `${a} ＋ ${b} × ${c} ＝ ？`, answer: `${a + b * c}`, wrong: [`${(a + b) * c}`, `${a + b + c}`, `${a + b * c + 1}`], explain: `先乘除後加減：${b}×${c}＝${b * c}，${a}＋${b * c}＝${a + b * c}` };
  },
  // ── 國中 ──
  signedAdd(rnd, d) {
    const a = ri(rnd, -15, 15) || 3, b = ri(rnd, -15, -1);
    return { branch: "signed", text: `${par(a)} ＋ ${par(b)} ＝ ？`, answer: neg(a + b), wrong: [neg(a - b), neg(-(a + b)), neg(a + b + 1)], explain: `加上負數就是減：${neg(a)}－${-b}＝${neg(a + b)}` };
  },
  signedMul(rnd) {
    const a = ri(rnd, 2, 9) * pick(rnd, [1, -1]), b = -ri(rnd, 2, 9);
    return { branch: "signed", text: `${par(a)} × ${par(b)} ＝ ？`, answer: neg(a * b), wrong: [neg(-a * b), neg(a + b), neg(a * b + 1)], explain: `${a * b > 0 ? "負負得正" : "正負得負"}：${Math.abs(a)}×${Math.abs(b)}＝${Math.abs(a * b)}，答案 ${neg(a * b)}` };
  },
  linearEq(rnd, d) {
    const x = ri(rnd, -6 * (d > 1), 9) || 2, a = ri(rnd, 2, 7), b = ri(rnd, -9, 12) || 1, c = a * x + b;
    const bs = b < 0 ? `－ ${-b}` : `＋ ${b}`;
    return { branch: "eq", text: `${a}x ${bs} ＝ ${neg(c)}，x ＝ ？`, answer: neg(x), wrong: [neg(c - b), neg((c + b) / a === Math.trunc((c + b) / a) ? (c + b) / a : x + 1), neg(-x || x + 2)], explain: `移項：${a}x＝${neg(c)}${b < 0 ? "＋" + -b : "－" + b}＝${neg(c - b)}，x＝${neg(c - b)}÷${a}＝${neg(x)}` };
  },
  proportion(rnd) {
    const a = ri(rnd, 2, 9), b = ri(rnd, 2, 9), k = ri(rnd, 2, 6);
    return { branch: "ratio", text: `${a}：${b} ＝ ${a * k}：x，x ＝ ？`, answer: `${b * k}`, wrong: [`${b + k}`, `${a * k + b - a}`, `${b * k + b}`], explain: `前項放大 ${k} 倍（${a}×${k}＝${a * k}），後項也要放大：${b}×${k}＝${b * k}` };
  },
};

// 每個學年、每個難度出哪些題型
export const PLAN = {
  g1:  [["add20", "sub20"], ["add20", "sub20", "make10"], ["add20", "sub20", "make10"]],
  g2:  [["add100", "sub100"], ["add100", "sub100"], ["add100", "sub100", "make10"]],
  g34: [["times", "divide"], ["times", "divide", "missingFactor"], ["mul2x1", "divide", "missingFactor"]],
  g56: [["fracAdd", "decAdd"], ["fracAdd", "decAdd", "mixedOps"], ["fracAdd", "mixedOps", "decAdd"]],
  jh:  [["signedAdd", "signedMul"], ["signedAdd", "linearEq", "proportion"], ["linearEq", "signedMul", "proportion"]],
};

export function generate(type, rnd, d) {
  const q = TYPES[type](rnd, d);
  return { ...q, type, typeKey: type };
}
