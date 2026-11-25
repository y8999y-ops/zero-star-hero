// 學系小遊戲（企劃書 3.7）：每座學院一個，玩法跟該屬性的思考方式一樣。
//   fire    赤焰塔「60 秒速算」：60 秒內答對越多越好
//   water   蒼流館「一題多解」：點出所有「算出來等於目標」的算式
//   ice     白霜堂「步驟排排看」：把算式的步驟照順序點好
//   forest  翠森苑「看圖數數」：數圖上的星星（一排一排、一堆一堆）
//   thunder 紫雷閣「找規律」：數列的下一個是什麼
// 難度跟著你最近玩的學年（save.lastGrade）。玩完給晶幣和經驗，記最佳成績，回到地圖上導師旁邊。

import { el, show } from "../ui.js";
import { sfx } from "../audio.js";
import { writeSave } from "../save.js";
import { addExp } from "../growth.js";
import { MENTORS } from "../../fx/mentor.js";

export const GAMES = {
  fire: { title: "60 秒速算", desc: "60 秒內答對越多越好！答錯不扣分，但會浪費時間。" },
  water: { title: "一題多解", desc: "目標數字只有一個，算法卻有很多種。把所有算得出目標的算式都點起來，再按「施法」。" },
  ice: { title: "步驟排排看", desc: "一步一步來。照正確的順序點算式的步驟。" },
  forest: { title: "看圖數數", desc: "圖上有幾顆星星？一排一排、一堆一堆地數，不用一顆一顆算。" },
  thunder: { title: "找規律", desc: "這串數字藏著規律。下一個是什麼？" },
};
const ROUNDS = 6;
const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const LV = { g1: 1, g2: 2, g34: 3, g56: 4, jh: 5 };
function options(ans, spread = 3) {
  const o = new Set([ans]);
  while (o.size < 4) { const d = R(-spread, spread) || 1; if (ans + d >= 0) o.add(ans + d); }
  return shuffle([...o]);
}

// ── 出題 ──
function calc(lv) {
  if (lv <= 1) { const a = R(1, 9), b = R(1, 9); return Math.random() < 0.6 ? [`${a} ＋ ${b}`, a + b] : [`${Math.max(a, b)} － ${Math.min(a, b)}`, Math.abs(a - b)]; }
  if (lv === 2) { const a = R(10, 60), b = R(5, 39); return Math.random() < 0.5 ? [`${a} ＋ ${b}`, a + b] : [`${a + b} － ${b}`, a]; }
  const a = R(2, 9), b = R(2, 9);
  if (lv === 3 || Math.random() < 0.5) return Math.random() < 0.5 ? [`${a} × ${b}`, a * b] : [`${a * b} ÷ ${a}`, b];
  const c = R(2, 20); return [`${a} × ${b} ＋ ${c}`, a * b + c];
}
function exprsFor(T, lv, ok) {
  // 回傳一個算式字串：ok＝算出來等於 T
  const v = ok ? T : T + (R(1, 3) * (Math.random() < 0.5 ? -1 : 1));
  const kind = R(0, lv >= 3 ? 3 : 1);
  if (kind === 0) { const a = R(0, v); return `${a} ＋ ${v - a}`; }
  if (kind === 1) { const b = R(1, 9); return `${v + b} － ${b}`; }
  if (kind === 2) { const ds = [2, 3, 4, 5].filter((d) => v % d === 0); if (ds.length) { const d = ds[R(0, ds.length - 1)]; return `${d} × ${v / d}`; } }
  const d = R(2, 4); return `${v * d} ÷ ${d}`;
}
function steps(lv) {
  // 兩～三步的算式，每一步「算的東西」
  const a = R(2, 9), b = R(2, 9), c = R(2, 9), d = R(1, 9);
  if (lv <= 2) { const s = a + b; return [`${a} ＋ ${b} － ${Math.min(c, s)}`, [`${a} ＋ ${b} ＝ ${s}`, `${s} － ${Math.min(c, s)} ＝ ${s - Math.min(c, s)}`]]; }
  const p = b * c, q = a + p;
  return [`${a} ＋ ${b} × ${c} － ${Math.min(d, q)}`, [`${b} × ${c} ＝ ${p}`, `${a} ＋ ${p} ＝ ${q}`, `${q} － ${Math.min(d, q)} ＝ ${q - Math.min(d, q)}`]];
}
function pattern(lv) {
  const kind = R(0, lv <= 1 ? 1 : lv <= 3 ? 2 : 3);
  let seq;
  if (kind === 0) { const s = R(1, 9), d = R(1, lv <= 1 ? 3 : 9); seq = Array.from({ length: 5 }, (_, i) => s + d * i); }
  else if (kind === 1) { const s = R(30, 60), d = R(2, 5); seq = Array.from({ length: 5 }, (_, i) => s - d * i); }
  else if (kind === 2) { const s = R(1, 4), k = R(2, 3); seq = Array.from({ length: 5 }, (_, i) => s * k ** i); }
  else { const s = R(1, 5), a = R(1, 4), b = R(5, 9); seq = [s]; for (let i = 1; i < 5; i++) seq.push(seq[i - 1] + (i % 2 ? a : b)); }
  return [seq.slice(0, 4), seq[4]];
}

export function minigameScene(game, { id }) {
  const s = game.save, lv = LV[s.lastGrade ?? "g1"] ?? 1, G = GAMES[id], M = MENTORS[id];
  const root = el("div.screen.minigame", { style: { "--mc": M.robe } });
  show(root);
  let score = 0, round = 0, timer = null, timeLeft = 60;

  const head = el("div.mghead", {}, el("span.mgname", {}, `${M.name}的「${G.title}」`), el("span.mgscore"));
  const body = el("div.mgbody");
  root.append(head, body);
  const setScore = () => (head.querySelector(".mgscore").textContent = id === "fire" ? `答對 ${score}　剩 ${Math.ceil(timeLeft)} 秒` : `第 ${Math.min(round + 1, ROUNDS)} / ${ROUNDS} 題　答對 ${score}`);

  // 開始前：說明
  body.replaceChildren(el("p.mgdesc", {}, G.desc), el("button.btn.gold.big", { onclick: start }, "開始"));
  function start() { sfx("click"); if (id === "fire") { const t0 = performance.now(); timer = setInterval(() => { timeLeft = 60 - (performance.now() - t0) / 1000; setScore(); if (timeLeft <= 0) end(); }, 200); } next(); }

  function next() {
    if (id !== "fire" && round >= ROUNDS) return end();
    setScore();
    ({ fire: playCalc, water: playMulti, ice: playSteps, forest: playCount, thunder: playPattern })[id]();
  }
  const right = () => { score++; sfx("good"); };
  const wrong = () => sfx("hurt");
  const advance = (ms = 500) => { round++; setTimeout(() => { if (root.isConnected && !(id === "fire" && timeLeft <= 0)) next(); }, ms); };
  const choice = (q, ans, opts, extra = null) => {
    body.replaceChildren(...[extra, el("div.mgq", {}, q), el("div.answers.mgopts", {}, ...opts.map((o) => el("button.btn.answer", { onclick: (e) => {
      const ok = o === ans; ok ? right() : wrong();
      e.currentTarget.classList.add(ok ? "right" : "wrong");
      [...e.currentTarget.parentNode.children].forEach((b) => { b.disabled = true; if (Number(b.textContent) === ans) b.classList.add("right"); });
      advance(ok ? 250 : 700);
    } }, String(o))))].filter(Boolean));
  };

  function playCalc() { const [q, a] = calc(lv); choice(`${q} ＝ ？`, a, options(a, lv <= 1 ? 3 : 6)); }
  function playPattern() { const [seq, a] = pattern(lv); choice(`${seq.join("，")}，？`, a, options(a, Math.max(3, Math.round(a * 0.2)))); }
  function playCount() {
    // 一堆一堆的星星：rows × cols 再加幾顆
    const rows = R(2, lv <= 1 ? 3 : 5), cols = R(2, lv <= 1 ? 4 : 6), more = lv <= 1 ? 0 : R(0, 4), total = rows * cols + more;
    const cv = el("canvas.mgcanvas", { width: 140, height: 64 }), c = cv.getContext("2d");
    const star = (x, y) => { c.fillStyle = "#ffd35c"; c.fillRect(x, y - 3, 1, 7); c.fillRect(x - 3, y, 7, 1); c.fillRect(x - 1, y - 1, 3, 3); c.fillStyle = "#fff8d0"; c.fillRect(x, y, 1, 1); };
    c.fillStyle = "#241c3d"; c.fillRect(0, 0, 140, 64);
    const ox = 10, oy = 9, gx = Math.min(14, 92 / cols), gy = Math.min(11, 50 / rows);
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) star(ox + k * gx, oy + r * gy);
    for (let i = 0; i < more; i++) star(114 + (i % 2) * 12, 14 + Math.floor(i / 2) * 12);
    choice("一共有幾顆星星？", total, options(total, 4), cv);
  }
  function playMulti() {
    const T = R(lv <= 1 ? 6 : 12, lv <= 1 ? 15 : 40);
    const cards = shuffle([...Array.from({ length: 3 }, () => [exprsFor(T, lv, true), true]), ...Array.from({ length: 3 }, () => [exprsFor(T, lv, false), false])]);
    const picked = new Set();
    const grid = el("div.mgcards", {}, ...cards.map(([t], i) => el("button.btn.mgcard", { onclick: (e) => { picked.has(i) ? picked.delete(i) : picked.add(i); e.currentTarget.classList.toggle("on"); sfx("click"); } }, t)));
    const go = el("button.btn.gold", { onclick: () => {
      const ok = cards.every(([, good], i) => good === picked.has(i));
      [...grid.children].forEach((b, i) => { b.disabled = true; b.classList.add(cards[i][1] ? "right" : picked.has(i) ? "wrong" : "dim"); });
      ok ? right() : wrong(); go.disabled = true; advance(ok ? 600 : 1300);
    } }, "施法");
    body.replaceChildren(el("div.mgq", {}, `目標：${T}`), grid, go);
  }
  function playSteps() {
    const [q, st] = steps(lv), order = shuffle(st.map((_, i) => i));
    let at = 0, bad = false;
    const grid = el("div.mgcards", {}, ...order.map((i) => el("button.btn.mgcard", { onclick: (e) => {
      if (i === at) { e.currentTarget.classList.add("right"); e.currentTarget.disabled = true; e.currentTarget.dataset.n = at + 1; at++; sfx("tick"); if (at === st.length) { bad ? wrong() : right(); advance(700); } }
      else { bad = true; e.currentTarget.classList.add("wrong"); sfx("hurt"); setTimeout(() => e.currentTarget.classList.remove("wrong"), 400); }
    } }, st[i])));
    body.replaceChildren(el("div.mgq", {}, `${q} ＝ ？`), el("p.mgdesc", {}, "先算哪一步？照順序點。"), grid);
  }

  function end() {
    if (timer) { clearInterval(timer); timer = null; }
    if (!root.isConnected || body.querySelector(".mgend")) return;
    const coins = Math.min(30, score * (id === "fire" ? 1 : 3)), exp = score * 4;
    s.mini = s.mini ?? {}; const best = Math.max(s.mini[id] ?? 0, score), isBest = score > (s.mini[id] ?? 0); s.mini[id] = best;
    s.coins += coins; const ups = addExp(s, exp);
    const today = new Date().toISOString().slice(0, 10);
    s.daily = s.daily?.date === today ? s.daily : { date: today }; s.daily.mini = (s.daily.mini ?? 0) + 1;
    writeSave(s); sfx("level");
    body.replaceChildren(el("div.mgend", {},
      el("div.mgbig", {}, id === "fire" ? `答對 ${score} 題！` : `${ROUNDS} 題答對 ${score} 題`),
      el("div", {}, isBest ? "新紀錄！" : `最佳紀錄：${best}`),
      el("div", {}, `＋${coins} 晶幣　＋${exp} 經驗${ups?.length ? "　升級了！" : ""}`),
      el("div.mgbtns", {}, el("button.btn", { onclick: () => minigameScene(game, { id }) }, "再玩一次"), el("button.btn.gold", { onclick: () => game.go("map") }, "回學院"))));
  }
}
