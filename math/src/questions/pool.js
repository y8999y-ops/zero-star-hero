// 出題：把程式產生的計算題和題庫的應用題、選擇題混在一起，並照錯題本加權（企劃書 6.2、7.6）。

import { PLAN, generate } from "./gen.js";

const cache = {};
export async function loadBank(grade) {
  if (!cache[grade]) {
    try {
      const res = await fetch(new URL(`../../data/questions/built/${grade}.json`, import.meta.url));
      cache[grade] = res.ok ? await res.json() : [];
    } catch { cache[grade] = []; }
  }
  return cache[grade];
}

export function seeded(seed) {
  let s = (seed >>> 0) || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// 題庫題：一關幾題（低年級題庫少，以計算題為主）
const BANK_PER_STAGE = { g1: 1, g2: 2, g34: 3, g56: 3, jh: 4 };
const AREA_PREFIX = { g1: "花園的小精靈問你：", g2: "書頁上浮出一道咒語：", g34: "鐘面上轉出一道算式：", g56: "水晶果實上刻著：", jh: "解開這道封印算式：" };

/** 一關的題目：count 題，stage 0～2，boss 時題目稍難且最後一題用題庫的「大招題」。 */
export async function buildStage(save, grade, stage, count, boss = false) {
  const rnd = seeded(Date.now());
  const bank = await loadBank(grade);
  const types = PLAN[grade][Math.min(stage, 2)];
  const reviewTypes = Object.entries(save.review).filter(([k, r]) => r.grade === grade && types.includes(k)).map(([k]) => k);
  const used = new Set();
  const list = [];

  const bankPick = () => {
    const fresh = bank.filter((q) => !used.has(q.id));
    if (!fresh.length) return null;
    const b = fresh[Math.floor(rnd() * fresh.length)];
    used.add(b.id);
    return {
      kind: b.choices ? "choice" : "word", id: b.id, branch: b.branch, typeKey: `bank:${b.branch}`, grade,
      text: b.text, explain: b.explain, unit: b.unit ?? "",
      answer: b.choices ? b.choices["ABCD".indexOf(b.answer)] : String(b.answer),
      choices: b.choices ?? null, wrong: [],
    };
  };

  const nBank = Math.min(BANK_PER_STAGE[grade], bank.length);
  const bankSlots = new Set();
  while (bankSlots.size < nBank) bankSlots.add(1 + Math.floor(rnd() * (count - 1)));
  for (let i = 0; i < count; i++) {
    let q = null;
    if (bankSlots.has(i) || (boss && i === count - 1)) q = bankPick();
    if (!q) {
      const t = reviewTypes.length && rnd() < 0.5 ? reviewTypes[Math.floor(rnd() * reviewTypes.length)] : types[Math.floor(rnd() * types.length)];
      q = { kind: "calc", grade, prefix: AREA_PREFIX[grade], ...generate(t, rnd, boss ? 2 : stage) };
    }
    q.fromReview = !!save.review[q.typeKey];
    list.push(withChoices(q, rnd));
  }
  return list;
}

// ── 四個選項 ──
const num = (s) => Number(String(s).replace("−", "-"));
function nearMisses(ans) {
  const v = num(ans);
  if (!Number.isFinite(v)) return [];
  const dec = String(ans).includes(".") ? (String(ans).split(".")[1].length) : 0;
  const f = (x) => { const r = Math.round(x * 10 ** dec) / 10 ** dec; return r < 0 ? `−${-r}` : `${r}`; };
  const step = dec ? 10 ** -dec : 1;
  // 常見錯法優先：差 10、算成兩倍或一半，再來才是差一點點
  const out = [f(v + 10 * step), f(v - 10 * step), f(v * 2), f(v + step), f(v / 2), f(v - step), f(v + 2 * step)];
  return v >= 0 ? out.filter((x) => num(x) >= 0) : out;
}

export function withChoices(q, rnd) {
  if (q.choices) {
    // 選擇題：保留原本四個選項，打亂順序
    q.options = shuffle([...q.choices], rnd);
    return q;
  }
  const opts = [q.answer];
  for (const w of [...(q.wrong ?? []), ...nearMisses(q.answer)]) {
    if (opts.length >= 4) break;
    if (w && !opts.includes(w) && w !== "NaN" && num(w) !== num(q.answer)) opts.push(w);
  }
  q.options = shuffle(opts, rnd);
  return q;
}

function shuffle(a, rnd) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
