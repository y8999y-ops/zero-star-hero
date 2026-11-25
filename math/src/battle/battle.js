// 一關的流程（企劃書 7.2～7.5）：出題 → 答題 → 施法或受傷 → 下一隻；王有護盾；結束時結算星星與成長。

import { el, show, floatText, wait } from "../ui.js";
import { Stage, fitWidth } from "./stage.js";
import { buildStage, withChoices } from "../questions/pool.js";
import { ATTRS, GRADES, spellTier, maxHp, abilityBonus, crystalLevel, EXP, RANKS } from "../data.js";
import { recordAnswer, addExp } from "../growth.js";
import { writeSave } from "../save.js";
import { sfx } from "../audio.js";
import { TIMER_EASE } from "../settings.js";
import { printable } from "./mathmagic-more.js";
import { loadAreaArt } from "./areaart.js";

const COUNT = 10;     // 一般小關的題數

// 第一場戰鬥（教學，企劃書 3.6）：5 題一年級加減法，頁頁一題教一件事。glow：要發光的地方
const TUT_Q = [[2, 3, "+"], [4, 4, "+"], [6, 3, "+"], [5, 5, "+"], [7, 2, "-"]];
const TUT_ABILITY = {
  thunder: { text: "你是紫雷系！右下角的「消去」可以劈掉一個錯的答案。按按看！", glow: "ability" },
  forest: { text: "你是翠森系！右下角的「萌芽提示」會幫你想一想。按按看！", glow: "ability" },
  water: { text: "你是蒼流系！選錯的時候會自動「回流」，可以收回重選一次，不扣魔力。", glow: null },
  fire: { text: "你是赤焰系！連擊的時候，分數會多加成 1.5 倍。越算越快、越算越強！", glow: "combo" },
  ice: { text: "你是白霜系！題目的時間會變長 1.5 倍，可以一步一步穩穩地算。", glow: null },
};
function tutorialQuestions(attr) {
  const rnd = Math.random;
  return TUT_Q.map(([a, b, op], i) => {
    const r = op === "+" ? a + b : a - b;
    const q = withChoices({
      kind: "calc", grade: "g1", branch: "addsub", type: op === "+" ? "add10" : "sub10", typeKey: op === "+" ? "add10" : "sub10",
      text: `${a} ${op === "+" ? "＋" : "－"} ${b} ＝ ？`, answer: `${r}`, wrong: [`${r + 1}`, `${Math.max(0, r - 1)}`, `${r + 2}`],
      explain: `${a}${op === "+" ? "＋" : "－"}${b}＝${r}`, math: { op: op === "+" ? "+" : "-", a, b },
    }, rnd);
    q.tut = [
      { text: "看！墨水怪頭上的泡泡就是題目。從下面四個答案選一個！", glow: "answers" },
      { text: "答對了，算式就會變成魔法打出去！演出的時候點畫面可以快一點。再一題！", glow: "answers" },
      { text: "連續答對叫「連擊」，魔法會越來越強喔！看左上角的連擊數字。", glow: "combo" },
      TUT_ABILITY[attr] ?? TUT_ABILITY.fire,
      { text: "最後一題！就算算錯也沒關係，我會陪你一起算一次。", glow: "answers" },
    ][i];
    return q;
  });
}
const EXAM = 10;      // 升階考核題數，答對 7 題通過

/**
 * mode："stage"（stage 0～2）、"boss"、"exam"。onEnd(result) 回到地圖或重玩。
 */
export async function runBattle(game, gradeId, mode, stageIdx, onEnd, onReady) {
  const s = game.save;
  const g = GRADES[gradeId];
  const attr = ATTRS[s.attr];
  const boss = mode === "boss", exam = mode === "exam", tut = mode === "tutorial";

  // 限時：學年規則 × 心情題 × 冰系能力（企劃書 4.3、5）
  let limit = s.settings.timer ? g.time : 0;
  if (s.mood >= 3) limit = 0;
  else if (s.mood >= 2) limit *= 1.3;
  if (s.attr === "ice") limit *= 1.5;
  limit *= TIMER_EASE[s.settings.timerEase] ?? 1;
  if (tut) limit = 0;                       // 教學不限時

  const shield = boss ? g.boss : 0;
  const total = tut ? TUT_Q.length : exam ? EXAM : boss ? shield + 6 : COUNT;
  const [qs] = await Promise.all([tut ? tutorialQuestions(s.attr) : buildStage(s, gradeId, boss ? 2 : exam ? 1 : stageIdx, total, boss), loadAreaArt(gradeId)]);

  // ── 畫面 ──
  const canvas = el("canvas.stage");
  const hud = el("div.hud");
  const bubble = el("div.bubble");
  const wordPanel = el("div.word");
  const line = el("div.pagepage");
  const answers = el("div.answers");
  const abilityBtn = el("button.btn.ability");
  let aborted = false;
  const leave = tut ? null : el("button.btn.small.leave", { onclick: () => { if (confirm("離開這一關？這關的進度不會保存。")) { aborted = true; running = false; game.go("map"); } } }, "離開");
  const wrap = el("div.battle", {}, el("div.view", {}, canvas, hud, bubble, leave), wordPanel, line, answers, abilityBtn);
  show(wrap);
  const app = document.querySelector("#app");
  fitWidth(app.clientWidth / app.clientHeight);          // 戰鬥畫面的寬度跟著螢幕比例
  const stage = new Stage(canvas, gradeId, s.look, s.attr, s.settings);
  onReady?.();   // 戰鬥畫面準備好了（轉場可以打開）
  window.__stage = stage;   // 開發用：在主控台操作戰鬥畫面
  // 這一區的王已經打倒過＝已經恢復色彩；還沒的話是被墨水弄灰的樣子
  stage.gray = s.stars[`${gradeId}-boss`] ? 0 : 1;

  let hp = maxHp(s.lv), combo = 0, best = 0, right = 0, wrong = 0, sparks = 0, shieldLeft = shield, gained = 0;
  let uses = (attr.uses ?? 0) + (attr.uses ? abilityBonus(s.lv) : 0);
  const events = [];
  let running = true;

  // 遊戲迴圈：只負責畫面
  let last = performance.now();
  const loop = (now) => {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    stage.update(dt); stage.draw();
    const head = stage.monsterHead();
    if (head && bubble.textContent) {
      // 題目泡泡跟著怪物頭頂，但不能超出畫面左右
      bubble.hidden = false;
      const vw = canvas.clientWidth, bw = bubble.offsetWidth;
      const x = Math.max(bw / 2 + 4, Math.min(vw - bw / 2 - 4, head.x * vw));
      bubble.style.left = `${x}px`; bubble.style.top = `${head.y * 100}%`;
    }
    else bubble.hidden = true;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  const say = (t) => { line.textContent = t; if (t) stage?.setPage("talk", Math.min(2.4, 0.5 + t.length * 0.06)); };
  const drawHud = () => {
    hud.replaceChildren(
      el("div.hearts", {}, ...Array.from({ length: maxHp(s.lv) }, (_, i) => el(`span.heart${i < hp ? "" : ".empty"}`))),
      el("div.combo", {}, combo >= 2 ? `連擊 ×${combo}` : ""),
      el("div.prog", {}, boss ? `護盾 ${"◆".repeat(shieldLeft)}${"◇".repeat(shield - shieldLeft)}` : exam ? `考核 ${right}/${EXAM}` : `${Math.min(qi + 1, total)}/${total}`),
    );
  };

  abilityBtn.hidden = !attr.uses;
  const drawAbility = () => { abilityBtn.textContent = `${attr.ability}（${uses}）`; abilityBtn.disabled = uses <= 0; };
  drawAbility();

  if (boss) sfx("boss");
  say(tut ? "" : exam ? "升階考核開始！答對 7 題就通過，不限時也沒關係，慢慢來。" : boss ? "墨水大王來了！每答對一題，就能打掉一格護盾。" : "墨水怪出現了！把它身上的題目算完，就能淨化它。");

  let qi = 0;
  for (; qi < qs.length && hp > 0; qi++) {
    if (boss && shieldLeft <= 0) break;
    if (exam && qi >= EXAM) break;
    const q = qs[qi];
    // 上一隻還在散開（die）時也要叫新的一隻出來，不然這題會沒有怪物、沒有題目泡泡
    if (!stage.monster || stage.monster.state === "die") stage.spawn(boss, tut ? "ink" : null);
    drawHud();

    // 題目：計算題掛在怪物頭上；應用題放在下方面板
    const isWord = q.kind !== "calc";
    bubble.textContent = isWord ? "？" : q.text.replace(" ＝ ？", " ＝ ？");
    wordPanel.hidden = !isWord;
    wordPanel.replaceChildren(...(isWord ? [el("div.wtext", {}, q.text)] : []));
    if (q.tut) { say(q.tut.text); glow(q.tut.glow); }
    else if (qi > 0 || !isWord) say(isWord ? "仔細讀題目，一句一句來。" : q.prefix ?? "");

    const t0 = performance.now();
    const result = await askOne(q);
    glow(null);
    if (aborted) return;
    const sec = (performance.now() - t0) / 1000;

    const rec = recordAnswer(s, { ...q, targetSec: limit || 8 }, result.ok, sec);
    events.push(...rec.events);
    if (rec.exp) { gained += rec.exp; floatText(wrap, `＋${rec.exp} 經驗`, "exp"); }

    if (result.ok) {
      right++; combo++; best = Math.max(best, combo);
      const tier = spellTier(combo);
      if (tier > spellTier(combo - 1)) setTimeout(() => sfx("combo"), 120);   // 連擊升級（魔法變強）
      sparks += Math.round((1 + tier) * (s.attr === "fire" ? 1.5 : 1));
      sfx(`cast_${s.attr}`);
      bubble.textContent = "";
      if (q.math) {
        // 數學變魔法：先把算式變成光球（點畫面可以加速）
        say("把算式寫出來……");
        canvas.onclick = () => stage.magic?.skip();
        await stage.mathMagic(q.math);
        canvas.onclick = null;
      }
      say(["", "咒語成立！", "魔法變強了！", "大魔法！", "終極魔法！！"][tier]);
      await stage.cast(tier, crystalLevel(s.crystals[s.attr]));
      stage.setPage("happy", 1.6);
      // 答案數字跳出來；選擇題的答案可能是中文（像素字寫不出來），就跳一顆星
      const shown = String(q.answer).replace(/−|－/g, "-");
      stage.popNumber(printable(shown) && shown.length <= 8 ? shown : "!", combo);
      sfx("hit");
      if (boss) {
        shieldLeft--;
        stage.shake = 6;
        if (shieldLeft > 0) stage.flinch();
        if (shieldLeft <= 0) { stage.purify(); if (!s.stars[`${gradeId}-boss`]) { stage.restoreColor(); setTimeout(() => sfx("restore"), 400); s.flags = { ...(s.flags ?? {}), restore: gradeId }; } }
      } else stage.purify();
      await wait(650);
    } else {
      wrong++; combo = 0;
      if (!exam && !tut) { hp--; stage.hurt(); sfx("hurt"); }
      else if (tut) sfx("hurt");
      stage.setPage("worried", 3);
      bubble.textContent = "";
      await showExplain(q, result.timeout);
      if (!boss) stage.purify();
      await wait(300);
    }
    drawHud();
  }

  if (aborted) return;
  running = false;
  if (tut) {
    // 教學：經驗照算、錯題本照記；不給星星和晶幣，直接接劇情
    const ups = addExp(s, gained);
    s.flags = { ...(s.flags ?? {}), tutorial: true };
    writeSave(s);
    onEnd({ gradeId, mode, right, wrong, gained, ups, events });
    return;
  }
  // ── 結算 ──
  const asked = right + wrong;
  const acc = asked ? right / asked : 0;
  let stars = 0, passed = false;
  if (exam) passed = right >= 7;
  else if (hp > 0 && (!boss || shieldLeft <= 0)) stars = acc >= 1 ? 3 : acc >= 0.9 ? 2 : acc >= 0.7 ? 1 : 0;
  if (stars === 0 && !exam && hp > 0 && (!boss || shieldLeft <= 0)) stars = 1;   // 有打完就至少一顆星
  const key = `${gradeId}-${boss ? "boss" : stageIdx + 1}`;
  if (!exam) s.stars[key] = Math.max(s.stars[key] ?? 0, stars);
  let bonus = stars * EXP.star;
  if (exam && passed) { s.rank++; bonus += EXP.rankUp; }
  gained += bonus;
  const ups = addExp(s, gained);
  const coins = exam ? 0 : 10 + stars * 7;
  s.coins += coins;
  s.lastGrade = gradeId;
  writeSave(s);

  onEnd({ gradeId, mode, stageIdx, stars, passed, right, wrong, best, hp, sparks, gained, coins, ups, events, gentle: hp <= 0 && (s.mood >= 3 || gradeId === "g1" || gradeId === "g2") });

  // ── 一題：等玩家點答案或時間到 ──
  function askOne(q) {
    return new Promise((resolve) => {
      let done = false, retry = s.attr === "water" && uses > 0;
      const start = performance.now();
      answers.replaceChildren(...q.options.map((o, i) => el("button.btn.answer", { "data-k": i + 1, onclick: () => pickOpt(o, btns[i]) }, q.unit && q.kind === "word" ? `${o} ${q.unit}` : o)));
      const btns = [...answers.children];
      const key = (e) => { const n = Number(e.key); if (n >= 1 && n <= btns.length) btns[n - 1].click(); };
      addEventListener("keydown", key);
      abilityBtn.onclick = () => {
        if (uses <= 0 || done) return;
        if (s.attr === "thunder") {
          const wrongs = btns.filter((b, i) => q.options[i] !== q.answer && !b.disabled);
          if (!wrongs.length) return;
          const b = wrongs[Math.floor(Math.random() * wrongs.length)];
          b.disabled = true; b.classList.add("zapped");
          stage.addFx(stageFxStrike(), { x: 200, y: 206, speed: 3 });
          uses--; drawAbility(); say("紫雷劈掉了一個錯的選項！");
        } else if (s.attr === "forest") {
          uses--; drawAbility(); say(`萌芽提示：${hintOf(q)}`);
        }
      };
      abilityBtn.hidden = !(s.attr === "thunder" || s.attr === "forest");
      const timer = limit ? setInterval(() => {
        if (aborted) { clearInterval(timer); return; }
        const frac = Math.min(1, (performance.now() - start) / 1000 / limit);
        stage.walkTo(frac);
        if (frac >= 1) finish(false, true);
      }, 100) : null;
      stage.walkTo(limit ? 0 : null);

      function pickOpt(o, b) {
        if (done || b.disabled) return;
        const ok = o === q.answer;
        if (!ok && retry) {
          retry = false; uses--; drawAbility();
          b.disabled = true; b.classList.add("wrong");
          say("回流！這題可以再選一次，不扣魔力。");
          stage.setPage("worried", 1.6);
          sfx("tick");
          return;
        }
        btns.forEach((x, i) => { if (q.options[i] === q.answer) x.classList.add("right"); });
        if (!ok) b.classList.add("wrong");
        finish(ok, false);
      }
      function finish(ok, timeout) {
        if (done) return;
        done = true;
        if (timer) clearInterval(timer);
        removeEventListener("keydown", key);
        btns.forEach((x) => (x.disabled = true));
        resolve({ ok, timeout });
      }
    });
  }

  // 教學：讓要按的地方發光
  function glow(what) {
    for (const n of [answers, abilityBtn, hud]) n.classList.remove("tutglow");
    if (what === "answers") answers.classList.add("tutglow");
    else if (what === "ability") abilityBtn.classList.add("tutglow");
    else if (what === "combo") hud.classList.add("tutglow");
  }

  function showExplain(q, timeout) {
    return new Promise((resolve) => {
      const card = el("div.explain", {},
        el("div.etitle", {}, timeout ? "時間到了，沒關係！" : "沒關係，我們一起算一次！"),
        el("div.ebody", {}, q.explain),
        el("div.eans", {}, `答案是 ${q.answer}${q.unit ? " " + q.unit : ""}`),
        el("button.btn.gold", { onclick: () => { card.remove(); resolve(); } }, "知道了"));
      say("這題我先記進錯題本，之後再一起複習。");
      wrap.append(card);
    });
  }
}

function hintOf(q) {
  // 把詳解裡的最後答案藏起來，只留想法
  const e = String(q.explain);
  const cut = e.lastIndexOf("＝");
  return cut > 0 ? e.slice(0, cut + 1) + "？" : "把題目一句一句畫出來看看。";
}

import * as strikeMod from "../../../pixelfx/src/fx/lightning/chain-lightning.js";
const stageFxStrike = () => strikeMod;
