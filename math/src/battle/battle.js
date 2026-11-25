// 一關的流程（企劃書 7.2～7.5）：出題 → 答題 → 施法或受傷 → 下一隻；王有護盾；結束時結算星星與成長。

import { el, show, floatText, wait } from "../ui.js";
import { Stage, W, H } from "./stage.js";
import { buildStage } from "../questions/pool.js";
import { ATTRS, GRADES, spellTier, maxHp, abilityBonus, crystalLevel, EXP, RANKS } from "../data.js";
import { recordAnswer, addExp } from "../growth.js";
import { writeSave } from "../save.js";
import { sfx } from "../audio.js";
import { TIMER_EASE } from "../settings.js";

const COUNT = 10;     // 一般小關的題數
const EXAM = 10;      // 升階考核題數，答對 7 題通過

/**
 * mode："stage"（stage 0～2）、"boss"、"exam"。onEnd(result) 回到地圖或重玩。
 */
export async function runBattle(game, gradeId, mode, stageIdx, onEnd, onReady) {
  const s = game.save;
  const g = GRADES[gradeId];
  const attr = ATTRS[s.attr];
  const boss = mode === "boss", exam = mode === "exam";

  // 限時：學年規則 × 心情題 × 冰系能力（企劃書 4.3、5）
  let limit = s.settings.timer ? g.time : 0;
  if (s.mood >= 3) limit = 0;
  else if (s.mood >= 2) limit *= 1.3;
  if (s.attr === "ice") limit *= 1.5;
  limit *= TIMER_EASE[s.settings.timerEase] ?? 1;

  const shield = boss ? g.boss : 0;
  const total = exam ? EXAM : boss ? shield + 6 : COUNT;
  const qs = await buildStage(s, gradeId, boss ? 2 : exam ? 1 : stageIdx, total, boss);

  // ── 畫面 ──
  const canvas = el("canvas.stage");
  const hud = el("div.hud");
  const bubble = el("div.bubble");
  const wordPanel = el("div.word");
  const line = el("div.pagepage");
  const answers = el("div.answers");
  const abilityBtn = el("button.btn.ability");
  let aborted = false;
  const leave = el("button.btn.small.leave", { onclick: () => { if (confirm("離開這一關？這關的進度不會保存。")) { aborted = true; running = false; game.go("map"); } } }, "離開");
  const wrap = el("div.battle", {}, el("div.view", {}, canvas, hud, bubble, leave), wordPanel, line, answers, abilityBtn);
  show(wrap);
  const stage = new Stage(canvas, gradeId, s.look, s.attr, s.settings);
  onReady?.();   // 戰鬥畫面準備好了（轉場可以打開）
  stage.gray = 1;

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

  const say = (t) => { line.textContent = t; };
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

  say(exam ? "升階考核開始！答對 7 題就通過，不限時也沒關係，慢慢來。" : boss ? "墨水大王來了！每答對一題，就能打掉一格護盾。" : "墨水怪出現了！把它身上的題目算完，就能淨化它。");

  let qi = 0;
  for (; qi < qs.length && hp > 0; qi++) {
    if (boss && shieldLeft <= 0) break;
    if (exam && qi >= EXAM) break;
    const q = qs[qi];
    if (!stage.monster) stage.spawn(boss);
    drawHud();

    // 題目：計算題掛在怪物頭上；應用題放在下方面板
    const isWord = q.kind !== "calc";
    bubble.textContent = isWord ? "？" : q.text.replace(" ＝ ？", " ＝ ？");
    wordPanel.hidden = !isWord;
    wordPanel.replaceChildren(...(isWord ? [el("div.wtext", {}, q.text)] : []));
    if (qi > 0 || !isWord) say(isWord ? "仔細讀題目，一句一句來。" : q.prefix ?? "");

    const t0 = performance.now();
    const result = await askOne(q);
    if (aborted) return;
    const sec = (performance.now() - t0) / 1000;

    const rec = recordAnswer(s, { ...q, targetSec: limit || 8 }, result.ok, sec);
    events.push(...rec.events);
    if (rec.exp) { gained += rec.exp; floatText(wrap, `＋${rec.exp} 經驗`, "exp"); }

    if (result.ok) {
      right++; combo++; best = Math.max(best, combo);
      const tier = spellTier(combo);
      sparks += Math.round((1 + tier) * (s.attr === "fire" ? 1.5 : 1));
      sfx("cast");
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
      stage.popNumber(q.answer, combo);
      sfx("hit");
      if (boss) {
        shieldLeft--;
        stage.shake = 6;
        if (shieldLeft <= 0) { stage.purify(); stage.gray = 0; }
      } else stage.purify();
      await wait(650);
    } else {
      wrong++; combo = 0;
      if (!exam) { hp--; stage.hurt(); sfx("hurt"); }
      bubble.textContent = "";
      await showExplain(q, result.timeout);
      if (!boss) stage.purify();
      await wait(300);
    }
    drawHud();
  }

  if (aborted) return;
  running = false;
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
