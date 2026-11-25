// 中年級（國小三、四年級）十個單元的出題（2026-11-25 使用者：題目聚焦中年級的不同單元，要有簡單和困難模式）。
// 每個單元一個函式 (rnd, hard) → 題目；hard＝false 是「簡單」（三年級程度）、true 是「困難」（四年級程度）。
// 題目格式跟 gen.js 一樣：{ branch, text, answer, wrong: [常見錯法…], explain, math? }
// 數字大的題目不用「光球」演出（會畫出幾百顆），改用 { op: "word" }：題目裡的數字飛上去變魔法。

const ri = (rnd, a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (rnd, list) => list[Math.floor(rnd() * list.length)];
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
const fmt = (n) => n.toLocaleString("en-US");                   // 1,234
const dec = (n, p) => String(Math.round(n * 10 ** p) / 10 ** p);
const fly = (nums, answer) => ({ op: "word", nums: nums.map(String), answer: String(answer) });
const uniq = (ans, list) => [...new Set(list.map(String))].filter((w) => w !== String(ans) && w !== "NaN" && !w.startsWith("-"));
const mixed = (n, d) => { const w = Math.floor(n / d), r = n % d; return w === 0 ? `${r}/${d}` : r === 0 ? `${w}` : `${w}又${r}/${d}`; };

export const MID = {
  // ① 大數與加減：簡單＝一萬以內的加減直式；困難＝一億以內（五、六位數）的加減，或認識位值
  big(rnd, hard) {
    if (hard && rnd() < 0.35) {
      const n = ri(rnd, 100000, 9999999), places = ["個", "十", "百", "千", "萬", "十萬", "百萬"];
      const k = ri(rnd, 2, String(n).length - 1), digit = Math.floor(n / 10 ** k) % 10;
      const others = [...String(n)].map(Number).filter((d) => d !== digit);
      return { branch: "big", text: `${fmt(n)} 的「${places[k]}位」數字是幾？`, answer: `${digit}`, wrong: uniq(digit, [...others.slice(0, 3), (digit + 1) % 10, (digit + 9) % 10]), explain: `從右邊數：個、十、百、千、萬、十萬、百萬。${fmt(n)} 的${places[k]}位是 ${digit}。` };
    }
    const [lo, hi] = hard ? [10000, 899999] : [1000, 8999];
    let a = ri(rnd, lo, hi), b = ri(rnd, Math.floor(lo / 10), Math.floor(hi / 2));
    if (rnd() < 0.5) {
      if (a + b >= (hard ? 1000000 : 10000)) b = Math.floor(b / 3);
      const s = a + b, noCarry = [...String(a).padStart(7, "0")].map((d, i) => (Number(d) + Number(String(b).padStart(7, "0")[i])) % 10).join("").replace(/^0+/, "");
      return { branch: "big", text: `${fmt(a)} ＋ ${fmt(b)} ＝ ？`, answer: fmt(s), wrong: uniq(fmt(s), [fmt(Number(noCarry)), fmt(s + 10), fmt(s - 100), fmt(s + 1000)]), explain: `直式：個位對個位，從個位開始加，滿 10 就往前一位進 1。${fmt(a)}＋${fmt(b)}＝${fmt(s)}`, math: fly([a, b], s) };
    }
    if (b > a) [a, b] = [b, a];
    const r = a - b;
    return { branch: "big", text: `${fmt(a)} － ${fmt(b)} ＝ ？`, answer: fmt(r), wrong: uniq(fmt(r), [fmt(r + 10), fmt(r - 100), fmt(r + 1000), fmt(a + b)]), explain: `直式：個位對個位，從個位開始減，不夠減就向前一位借 1 當 10。${fmt(a)}－${fmt(b)}＝${fmt(r)}`, math: fly([a, b], r) };
  },
  // ② 乘法：簡單＝二、三位數 × 一位數；困難＝二、三位數 × 二位數
  mul(rnd, hard) {
    const a = hard ? ri(rnd, 12, 389) : ri(rnd, 12, 489), b = hard ? ri(rnd, 11, 59) : ri(rnd, 2, 9), p = a * b;
    const slip = hard ? a * (b % 10) + a * Math.floor(b / 10) : (a % 10) * b + Math.floor(a / 10) * 10 * 1;
    return { branch: "mul", text: `${a} × ${b} ＝ ？`, answer: `${p}`, wrong: uniq(p, [slip, p + a, p - b * 10, p + 10]),
      explain: hard ? `拆開乘：${a}×${b % 10}＝${a * (b % 10)}，${a}×${Math.floor(b / 10) * 10}＝${a * Math.floor(b / 10) * 10}，加起來 ${p}` : `拆開乘：${a}＝${Math.floor(a / 10) * 10}＋${a % 10}，${Math.floor(a / 10) * 10}×${b}＝${Math.floor(a / 10) * 10 * b}，${a % 10}×${b}＝${(a % 10) * b}，加起來 ${p}`,
      math: a < 100 && b < 10 ? { op: "×", a, b } : fly([a, b], p) };
  },
  // ③ 除法：簡單＝二位數 ÷ 一位數（可能有餘數）；困難＝三位數 ÷ 一位數，或 ÷ 二位數（整除）
  div(rnd, hard) {
    let b, q, r;
    if (!hard) { b = ri(rnd, 2, 9); q = ri(rnd, 3, Math.floor(99 / b)); r = rnd() < 0.6 ? ri(rnd, 1, b - 1) : 0; }
    else if (rnd() < 0.5) { b = ri(rnd, 3, 9); q = ri(rnd, 21, Math.floor(999 / b)); r = rnd() < 0.5 ? ri(rnd, 1, b - 1) : 0; }
    else { b = ri(rnd, 12, 35); q = ri(rnd, 4, Math.floor(999 / b)); r = 0; }
    const a = b * q + r, ans = r ? `${q} 餘 ${r}` : `${q}`;
    const wrong = r ? [`${q + 1} 餘 ${r}`, `${q} 餘 ${r + b > a ? r : (r + 1) % b || 1}`, `${q - 1} 餘 ${r + b}`, `${q}`] : [`${q + 1}`, `${q - 1}`, `${q} 餘 1`, `${q * 10}`];
    return { branch: "div", text: `${a} ÷ ${b} ＝ ？`, answer: ans, wrong: uniq(ans, wrong), explain: `想乘法：${b}×${q}＝${b * q}${r ? `，${a}－${b * q}＝${r}，餘數 ${r} 要比除數 ${b} 小` : ""}，答案 ${ans}`, math: r ? fly([a, b], q) : { op: "÷", a, b } };
  },
  // ④ 四則併式：簡單＝兩步驟（先乘除後加減、有括號先算）；困難＝三步驟、有除法
  mix(rnd, hard) {
    if (!hard) {
      const b = ri(rnd, 2, 9), c = ri(rnd, 2, 9), a = ri(rnd, 5, 60), kind = ri(rnd, 0, 2);
      if (kind === 0) return { branch: "mix", text: `${a} ＋ ${b} × ${c} ＝ ？`, answer: `${a + b * c}`, wrong: uniq(a + b * c, [(a + b) * c, a + b + c, a + b * c + 1]), explain: `先乘後加：${b}×${c}＝${b * c}，${a}＋${b * c}＝${a + b * c}`, math: fly([a, b, c], a + b * c) };
      if (kind === 1) { const A = Math.max(a, b * c + 3); return { branch: "mix", text: `${A} － ${b} × ${c} ＝ ？`, answer: `${A - b * c}`, wrong: uniq(A - b * c, [(A - b) * c, A - b - c, A - b * c + 10]), explain: `先乘後減：${b}×${c}＝${b * c}，${A}－${b * c}＝${A - b * c}`, math: fly([A, b, c], A - b * c) }; }
      return { branch: "mix", text: `（${a} ＋ ${b}）× ${c} ＝ ？`, answer: `${(a + b) * c}`, wrong: uniq((a + b) * c, [a + b * c, a + b + c, (a + b) * c + c]), explain: `有括號先算括號：${a}＋${b}＝${a + b}，再乘 ${c}：${a + b}×${c}＝${(a + b) * c}`, math: fly([a, b, c], (a + b) * c) };
    }
    const c = ri(rnd, 2, 9), d = ri(rnd, 2, 9), q = ri(rnd, 2, 12), a = ri(rnd, 3, 12), b = ri(rnd, 2, 9);
    if (rnd() < 0.5) {
      const A = Math.max(a, Math.ceil((q + 1) / b)), val = A * b - q;   // A×b 一定比 q 大，答案不會是負的
      return { branch: "mix", text: `${A} × ${b} － ${c * q} ÷ ${c} ＝ ？`, answer: `${val}`, wrong: uniq(val, [A * b + q, (A * b - c * q) > 0 ? A * b - c * q : val + 10, val + c, A * b]), explain: `先乘除後加減，從左到右：${A}×${b}＝${A * b}，${c * q}÷${c}＝${q}，${A * b}－${q}＝${val}`, math: fly([A, b, c * q, c], val) };
    }
    const val = (a + b) * c - q;                       // d×q ÷ d ＝ q
    const ok = val > 0 ? val : (a + b) * c + q;
    const sign = val > 0 ? "－" : "＋";
    return { branch: "mix", text: `（${a} ＋ ${b}）× ${c} ${sign} ${d * q} ÷ ${d} ＝ ？`, answer: `${ok}`, wrong: uniq(ok, [a + b * c + (val > 0 ? -q : q), ok + d, ok - c]), explain: `先算括號 ${a}＋${b}＝${a + b}，再乘除：${a + b}×${c}＝${(a + b) * c}、${d * q}÷${d}＝${q}，最後${sign === "－" ? "減" : "加"}：${ok}`, math: fly([a, b, c, d * q, d], ok) };
  },
  // ⑤ 分數：簡單＝同分母的加減（真分數）；困難＝帶分數加減、假分數換帶分數
  frac(rnd, hard) {
    const d = ri(rnd, 3, 12);
    if (!hard) {
      if (rnd() < 0.5) { const a = ri(rnd, 1, d - 2), b = ri(rnd, 1, d - 1 - a); return { branch: "frac", text: `${a}/${d} ＋ ${b}/${d} ＝ ？`, answer: `${a + b}/${d}`, wrong: uniq(`${a + b}/${d}`, [`${a + b}/${d * 2}`, `${a + b + 1}/${d}`, `${Math.abs(a - b) || 1}/${d}`]), explain: `分母一樣（都分成 ${d} 份），分子相加：${a}＋${b}＝${a + b}，答案 ${a + b}/${d}`, math: { op: "frac", parts: [[a, d], [b, d]] } }; }
      const a = ri(rnd, 2, d - 1), b = ri(rnd, 1, a - 1);
      if (rnd() < 0.4) return { branch: "frac", text: `1 － ${b}/${d} ＝ ？`, answer: `${d - b}/${d}`, wrong: uniq(`${d - b}/${d}`, [`${b}/${d}`, `${1 - 0}/${d - b}`, `${d - b - 1}/${d}`]), explain: `1 個整體＝${d}/${d}，${d}/${d}－${b}/${d}＝${d - b}/${d}` };
      return { branch: "frac", text: `${a}/${d} － ${b}/${d} ＝ ？`, answer: `${a - b}/${d}`, wrong: uniq(`${a - b}/${d}`, [`${a - b}/0`.replace("/0", `/${d * 2}`), `${a + b}/${d}`, `${a - b + 1}/${d}`]), explain: `分母一樣，分子相減：${a}－${b}＝${a - b}，答案 ${a - b}/${d}` };
    }
    if (rnd() < 0.4) { const n = ri(rnd, d + 1, d * 4 - 1); if (n % d === 0) return MID.frac(rnd, hard); return { branch: "frac", text: `${n}/${d} 寫成帶分數是？`, answer: mixed(n, d), wrong: uniq(mixed(n, d), [mixed(n + d, d), `${n % d}又${Math.floor(n / d)}/${d}`, mixed(n - 1, d)]), explain: `${n}÷${d}＝${Math.floor(n / d)} 餘 ${n % d}：${Math.floor(n / d)} 個整體，還剩 ${n % d}/${d}，寫成 ${mixed(n, d)}` }; }
    const A = ri(rnd, d + 1, d * 3), B = ri(rnd, 1, d * 2), add = rnd() < 0.6;
    const [x, y] = add ? [A, B] : [Math.max(A, B) + d, Math.min(A, B)];
    const r = add ? x + y : x - y;
    return { branch: "frac", text: `${mixed(x, d)} ${add ? "＋" : "－"} ${mixed(y, d)} ＝ ？`, answer: mixed(r, d), wrong: uniq(mixed(r, d), [mixed(r + d, d), mixed(r - 1, d), mixed(r + 1, d)]), explain: `整數和整數${add ? "加" : "減"}、分數和分數${add ? "加" : "減"}；分數部分${add ? "滿" : "不夠"} ${d}/${d} 就${add ? "進 1" : "向整數借 1"}。答案 ${mixed(r, d)}` };
  },
  // ⑥ 小數：簡單＝一位小數的加減；困難＝二位小數的加減、小數 × 整數
  dec(rnd, hard) {
    const p = hard ? 2 : 1, k = 10 ** p;
    if (hard && rnd() < 0.35) { const a = ri(rnd, 11, 399) / 100, n = ri(rnd, 2, 9), r = dec(a * n, 2); return { branch: "dec", text: `${a} × ${n} ＝ ？`, answer: r, wrong: uniq(r, [dec(a * n * 10, 2), dec(a * n / 10, 3), dec(a * n + 0.1, 2)]), explain: `先當整數算：${Math.round(a * 100)}×${n}＝${Math.round(a * 100) * n}，原來有兩位小數，答案也點兩位：${r}` }; }
    const a = ri(rnd, k + 1, k * 50) / k, b = ri(rnd, 1, k * 30) / k, add = rnd() < 0.55;
    const [x, y] = add || a >= b ? [a, b] : [b, a];
    const r = dec(add ? x + y : x - y, p);
    return { branch: "dec", text: `${x} ${add ? "＋" : "－"} ${y} ＝ ？`, answer: r, wrong: uniq(r, [dec(Number(r) + 1 / k, p), dec(Number(r) - 1, p), dec(add ? x + y * 10 : x - y / 10, p), dec(Number(r) + 1, p)]), explain: `小數點對齊再${add ? "加" : "減"}（位數不夠補 0）：${x}${add ? "＋" : "－"}${y}＝${r}`, math: add ? { op: "dec", a: x, b: y } : fly([x, y], r) };
  },
  // ⑦ 面積、周長與角度：簡單＝長方形、正方形的周長和面積；困難＝反推邊長、三角形的角、平方公尺換平方公分
  shape(rnd, hard) {
    const L = ri(rnd, 3, hard ? 25 : 12), Wd = ri(rnd, 2, Math.max(2, L - 1)), kind = ri(rnd, 0, hard ? 3 : 2);
    if (!hard) {
      if (kind === 0) return { branch: "shape", text: `長 ${L} 公分、寬 ${Wd} 公分的長方形，面積是幾平方公分？`, answer: `${L * Wd}`, wrong: uniq(L * Wd, [2 * (L + Wd), L + Wd, L * Wd + L]), explain: `長方形面積＝長×寬：${L}×${Wd}＝${L * Wd}（平方公分）` };
      if (kind === 1) return { branch: "shape", text: `長 ${L} 公分、寬 ${Wd} 公分的長方形，周長是幾公分？`, answer: `${2 * (L + Wd)}`, wrong: uniq(2 * (L + Wd), [L * Wd, L + Wd, 2 * L + Wd]), explain: `周長＝繞一圈：(長＋寬)×2＝(${L}＋${Wd})×2＝${2 * (L + Wd)}（公分）` };
      return { branch: "shape", text: `邊長 ${L} 公分的正方形，周長是幾公分？`, answer: `${4 * L}`, wrong: uniq(4 * L, [L * L, 2 * L, 4 * L + 4]), explain: `正方形四邊一樣長：${L}×4＝${4 * L}（公分）` };
    }
    if (kind === 0) return { branch: "shape", text: `一個長方形面積 ${L * Wd} 平方公分，長 ${L} 公分，寬是幾公分？`, answer: `${Wd}`, wrong: uniq(Wd, [L * Wd - L, Wd + 1, L * Wd / 2]), explain: `面積＝長×寬，所以寬＝面積÷長：${L * Wd}÷${L}＝${Wd}（公分）` };
    if (kind === 1) { const a = ri(rnd, 30, 80), b = ri(rnd, 30, 150 - a - 10); return { branch: "shape", text: `三角形的兩個角是 ${a} 度和 ${b} 度，第三個角是幾度？`, answer: `${180 - a - b}`, wrong: uniq(180 - a - b, [360 - a - b, a + b, 90 - Math.min(a, b)]), explain: `三角形三個角加起來是 180 度：180－${a}－${b}＝${180 - a - b}（度）` }; }
    if (kind === 2) { const m = ri(rnd, 2, 9); return { branch: "shape", text: `${m} 平方公尺 ＝ ？平方公分`, answer: fmt(m * 10000), wrong: uniq(fmt(m * 10000), [fmt(m * 100), fmt(m * 1000), fmt(m * 100000)]), explain: `1 平方公尺＝100 公分×100 公分＝10,000 平方公分，所以 ${m} 平方公尺＝${fmt(m * 10000)} 平方公分` }; }
    const a = ri(rnd, 20, 160);
    return { branch: "shape", text: `一個直角被分成兩個角，其中一個是 ${a % 80 + 5} 度，另一個是幾度？`, answer: `${90 - (a % 80 + 5)}`, wrong: uniq(90 - (a % 80 + 5), [180 - (a % 80 + 5), a % 80 + 5, 100 - (a % 80 + 5)]), explain: `直角是 90 度：90－${a % 80 + 5}＝${90 - (a % 80 + 5)}（度）` };
  },
  // ⑧ 時間與單位換算：簡單＝公尺公分、時和分、經過多久；困難＝公斤公克、公升毫升、時間的加法、24 時制
  measure(rnd, hard) {
    const kind = ri(rnd, 0, 2);
    if (!hard) {
      if (kind === 0) { const m = ri(rnd, 1, 9), c = ri(rnd, 1, 99); return { branch: "measure", text: `${m} 公尺 ${c} 公分 ＝ ？公分`, answer: `${m * 100 + c}`, wrong: uniq(m * 100 + c, [m * 10 + c, m * 1000 + c, m + c]), explain: `1 公尺＝100 公分：${m}×100＋${c}＝${m * 100 + c}（公分）` }; }
      if (kind === 1) { const h = ri(rnd, 1, 4), mm = ri(rnd, 0, 5) * 10; return { branch: "measure", text: `${h} 小時 ${mm} 分鐘 ＝ ？分鐘`, answer: `${h * 60 + mm}`, wrong: uniq(h * 60 + mm, [h * 100 + mm, h * 10 + mm, h * 60]), explain: `1 小時＝60 分鐘：${h}×60＋${mm}＝${h * 60 + mm}（分鐘）` }; }
      const h = ri(rnd, 7, 10), m1 = ri(rnd, 0, 5) * 10, dur = ri(rnd, 3, 9) * 5, end = h * 60 + m1 + dur;
      const t = (x) => `${Math.floor(x / 60)}:${String(x % 60).padStart(2, "0")}`;
      return { branch: "measure", text: `上午 ${t(h * 60 + m1)} 到 ${t(end)}，經過幾分鐘？`, answer: `${dur}`, wrong: uniq(dur, [dur + 40, Math.abs((end % 60) - m1), dur + 10]), explain: `先數到整點再加：${t(h * 60 + m1)} 到 ${t(end)} 共 ${dur} 分鐘` };
    }
    if (kind === 0) { const unit = pick(rnd, [["公斤", "公克"], ["公升", "毫升"]]), a = ri(rnd, 1, 9), b = ri(rnd, 5, 995); return { branch: "measure", text: `${a} ${unit[0]} ${b} ${unit[1]} ＝ ？${unit[1]}`, answer: `${a * 1000 + b}`, wrong: uniq(a * 1000 + b, [a * 100 + b, a + b, a * 10000 + b]), explain: `1 ${unit[0]}＝1000 ${unit[1]}：${a}×1000＋${b}＝${a * 1000 + b}（${unit[1]}）` }; }
    if (kind === 1) { const h1 = ri(rnd, 1, 3), m1 = ri(rnd, 15, 55), h2 = ri(rnd, 1, 3), m2 = ri(rnd, Math.max(15, 61 - m1), 59), tot = (h1 + h2) * 60 + m1 + m2; const ans = `${Math.floor(tot / 60)} 時 ${tot % 60} 分`; return { branch: "measure", text: `${h1} 時 ${m1} 分 ＋ ${h2} 時 ${m2} 分 ＝ ？`, answer: ans, wrong: uniq(ans, [`${h1 + h2} 時 ${m1 + m2} 分`, `${Math.floor(tot / 60) + 1} 時 ${tot % 60} 分`, `${Math.floor(tot / 60)} 時 ${(tot % 60) + 10} 分`, `${Math.floor(tot / 60) - 1} 時 ${tot % 60} 分`]), explain: `時加時、分加分：${h1 + h2} 時 ${m1 + m2} 分；${m1 + m2} 分超過 60 分就進 1 時，答案 ${ans}` }; }
    const h = ri(rnd, 1, 11), m = ri(rnd, 0, 11) * 5, pm = rnd() < 0.6, ans = `${pm ? h + 12 : h}:${String(m).padStart(2, "0")}`;
    return { branch: "measure", text: `${pm ? "下午" : "上午"} ${h} 點 ${m} 分，用 24 時制寫是？`, answer: ans, wrong: uniq(ans, [`${h}:${String(m).padStart(2, "0")}`, `${pm ? h + 10 : h + 12}:${String(m).padStart(2, "0")}`, `${pm ? h + 12 : h}:${String((m + 30) % 60).padStart(2, "0")}`, `${pm ? h + 11 : h + 1}:${String(m).padStart(2, "0")}`]), explain: `24 時制：${pm ? `下午要加 12，${h}＋12＝${h + 12}` : "上午照寫"}，答案 ${ans}` };
  },
  // ⑨ 概數與估算：簡單＝四捨五入到十位、百位；困難＝到千位、萬位，先估再算
  round(rnd, hard) {
    if (hard && rnd() < 0.4) { const a = ri(rnd, 120, 980), b = ri(rnd, 120, 980), ra = Math.round(a / 100) * 100, rb = Math.round(b / 100) * 100; return { branch: "round", text: `${a} ＋ ${b} 先四捨五入到百位再估算，大約是多少？`, answer: `${ra + rb}`, wrong: uniq(ra + rb, [a + b, ra + rb + 100, Math.floor(a / 100) * 100 + Math.floor(b / 100) * 100 === ra + rb ? ra + rb - 100 : Math.floor(a / 100) * 100 + Math.floor(b / 100) * 100]), explain: `${a}≈${ra}、${b}≈${rb}，${ra}＋${rb}＝${ra + rb}` }; }
    const [place, k, n] = hard ? pick(rnd, [["千位", 1000, ri(rnd, 10000, 99999)], ["萬位", 10000, ri(rnd, 100000, 999999)]]) : pick(rnd, [["十位", 10, ri(rnd, 101, 999)], ["百位", 100, ri(rnd, 1001, 9999)]]);
    const r = Math.round(n / k) * k, down = Math.floor(n / k) * k, up = down + k;
    return { branch: "round", text: `${fmt(n)} 四捨五入到${place}是？`, answer: fmt(r), wrong: uniq(fmt(r), [fmt(r === down ? up : down), fmt(Math.round(n / (k * 10)) * k * 10), fmt(r + k)]), explain: `看${place}的下一位：${Math.floor(n / (k / 10)) % 10}${Math.floor(n / (k / 10)) % 10 >= 5 ? " 是 5 以上，進 1" : " 比 5 小，捨去"}，答案 ${fmt(r)}` };
  },
  // ⑩ 數量規律：簡單＝每次加（減）一樣多；困難＝每次乘一樣多、加的數越來越多
  seq(rnd, hard) {
    let list, ans, rule;
    if (!hard) {
      const k = ri(rnd, 2, 12), a = ri(rnd, 1, 30), downward = rnd() < 0.35;
      list = [0, 1, 2, 3].map((i) => (downward ? a + 4 * k - i * k : a + i * k)); ans = downward ? a : a + 4 * k; rule = downward ? `每次都少 ${k}` : `每次都多 ${k}`;
    } else if (rnd() < 0.5) { const a = ri(rnd, 1, 5), r = pick(rnd, [2, 3]); list = [a, a * r, a * r * r, a * r ** 3]; ans = a * r ** 4; rule = `每次都乘 ${r}`; }
    else { const a = ri(rnd, 1, 10), k = ri(rnd, 1, 4); list = [a, a + k, a + 3 * k, a + 6 * k]; ans = a + 10 * k; rule = `加的數一次多 ${k}（＋${k}、＋${2 * k}、＋${3 * k}，下一次＋${4 * k}）`; }
    const d = list[3] - list[2];
    return { branch: "seq", text: `${list.join("，")}，下一個是？`, answer: `${ans}`, wrong: uniq(ans, [list[3] + d, ans + 1, ans - 1, ans + d]), explain: `${rule}：${list[3]} 的下一個是 ${ans}` };
  },
};

// 題庫（g34 為主）的舊分類 → 中年級單元
export function bankBranch(q) {
  const t = q.text ?? "";
  switch (q.branch) {
    case "addsub": return "big";
    case "muldiv": return /平分|平均|每.{0,6}分給|除|分成|幾份|幾組|裝成/.test(t) ? "div" : "mul";
    case "time": return "measure";
    case "shape": return "shape";
    case "dec": return "dec";
    case "frac": return "frac";
    case "eq": return "mix";
    default: return null;
  }
}
