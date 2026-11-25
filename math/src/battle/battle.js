// 一關的流程（企劃書 7.2～7.5）：出題 → 答題 → 施法或受傷 → 下一隻；王有護盾；結束時結算星星與成長。

import { daily } from "../world/island-life.js";
import { el, show, floatText, wait, mathText } from "../ui.js";
import { Stage, fitWidth } from "./stage.js";
import { withChoices } from "../questions/pool.js";
import { ACADEMIES, MODES, buildPractice, buildArea, buildReview, buildChallenge } from "../practice.js";
import { talk } from "../world/talk.js";
import { speak, stopSpeak, canSpeak } from "../speak.js";
import { BRANCH_MAGIC, learnedMagic } from "./branch-magic.js";
import { UNIT_NAME } from "../data.js";
import { ATTRS, GRADES, spellTier, maxHp, abilityBonus, crystalLevel, EXP, RANKS } from "../data.js";
import { recordAnswer, addExp, pagePageLevel } from "../growth.js";
import { writeSave } from "../save.js";
import { sfx } from "../audio.js";
import { TIMER_EASE } from "../settings.js";
import { printable } from "./mathmagic-more.js";
import { loadAreaArt, loadBattleHD } from "./areaart.js";

const COUNT = 3;      // 一般小關的題數（2026-11-25 使用者：每一關三題就好；王關 5 題）

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
      kind: "calc", grade: "g1", branch: "big", type: op === "+" ? "add10" : "sub10", typeKey: op === "+" ? "add10" : "sub10",
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
 * mode："stage"（stage 0～2）、"boss"、"exam"、"practice"（學院練習：practice＝{ academy, branch, level }）。onEnd(result) 回到地圖或重玩。
 */
export async function runBattle(game, gradeId, mode, stageIdx, onEnd, onReady, practice = null) {
  const s = game.save;
  const g = GRADES[gradeId];
  const attr = ATTRS[s.attr];
  const boss = mode === "boss", exam = mode === "exam", tut = mode === "tutorial", prac = mode === "practice", chal = mode === "challenge";
  const AC = prac ? ACADEMIES[practice.academy] : null;

  // 限時：學年規則 × 心情題 × 冰系能力（企劃書 4.3、5）
  let limit = s.settings.timer ? g.time : 0;
  if (s.mood >= 3) limit = 0;
  else if (s.mood >= 2) limit *= 1.3;
  const sub = s.subAttr && s.subAttr !== s.attr && s.lv >= 20 ? s.subAttr : null;   // 副屬性（Lv20，企劃書 8.3：效果減半）
  if (s.attr === "ice") limit *= 1.5;
  else if (sub === "ice") limit *= 1.25;
  limit *= TIMER_EASE[s.settings.timerEase] ?? 1;
  if (tut) limit = 0;                       // 教學不限時
  if (chal) limit = 10 * (s.attr === "ice" ? 1.5 : sub === "ice" ? 1.25 : 1);   // 挑戰模式：一定限時 10 秒

  const shield = boss ? g.boss : 0;
  const prevBossStars = s.stars[`${gradeId}-boss`] ?? 0;          // 第一次打倒這一區的王（最終戰打完要接結局）
  const total = tut ? TUT_Q.length : exam ? EXAM : boss ? shield + 6 : prac ? COUNT : chal ? 60 : COUNT;   // 王：5 格護盾＝答對 5 題，答錯的會多出一題補上
  const [qs] = await Promise.all([tut ? tutorialQuestions(s.attr) : chal ? buildChallenge(s) : prac ? (practice.review ? buildReview(s, total) : buildPractice(s, practice.branch, practice.level, total)) : buildArea(s, gradeId, stageIdx, total, boss, exam),
    loadBattleHD(gradeId, AC?.area).then((hd) => hd ?? loadAreaArt(gradeId))]);

  // ── 畫面 ──
  const canvas = el("canvas.stage");
  const hud = el("div.hud");
  const bubble = el("div.bubble");
  const wordPanel = el("div.word", { hidden: true });
  const line = el("div.pagepage");
  const answers = el("div.answers");
  const abilityBtn = el("button.btn.ability");
  const subBtn = el("button.btn.ability.subab", { hidden: true });
  const magicBtn = el("button.btn.bmagic", { hidden: true }, "分支魔法");
  // 朗讀題目：喇叭按鈕（題目左邊）；設定「自動朗讀」時每題出來就念
  let speakText = "";
  const speakBtn = el("button.btn.small.speak", { hidden: !canSpeak(), "aria-label": "念題目", onclick: () => speak(speakText, s.settings.mute) }, "🔊");
  let aborted = false;
  const leave = tut ? null : el("button.btn.small.leave", { onclick: () => { if (confirm("離開這一關？這關的進度不會保存。")) { aborted = true; running = false; game.go("map"); } } }, "離開");
  const wrap = el("div.battle", {}, el("div.view", {}, canvas, hud, bubble, speakBtn, leave), wordPanel, line, answers, abilityBtn, subBtn, magicBtn);
  show(wrap);
  const app = document.querySelector("#app");
  fitWidth(app.clientWidth / app.clientHeight);          // 戰鬥畫面的寬度跟著螢幕比例
  const stage = new Stage(canvas, gradeId, s.look, s.attr, s.settings, { ...(AC ? { area: AC.area, kinds: [AC.monster] } : {}), ...(chal ? { area: "clock", kinds: ["ink", "flower", "pages", "bat", "tick", "bug", "shade"] } : {}), pageForm: pagePageLevel(s), crystalLv: crystalLevel(s.crystals[s.attr]) });
  onReady?.();   // 戰鬥畫面準備好了（轉場可以打開）
  window.__stage = stage;   // 開發用：在主控台操作戰鬥畫面
  // 這一區的王已經打倒過＝已經恢復色彩；還沒的話是被墨水弄灰的樣子
  stage.gray = prac || s.stars[`${gradeId}-boss`] ? 0 : 1;          // 學院沒有被污染

  let hp = maxHp(s.lv), combo = 0, best = 0, right = 0, wrong = 0, sparks = 0, shieldLeft = shield, gained = 0;
  let uses = (attr.uses ?? 0) + (attr.uses ? abilityBonus(s.lv) : 0);
  const SA = sub ? ATTRS[sub] : null;
  let uses2 = SA?.uses ? Math.max(1, Math.floor((SA.uses + abilityBonus(s.lv)) / 2)) : 0;
  // 分支魔法：學會的每一招這場可以用一次
  const magic = tut ? [] : learnedMagic(s), usedMagic = new Set(), flags = { shield: false, retry: false, double: false };
  let cur = null;          // 現在這一題（分支魔法、副屬性要用）
  const events = [];
  let running = true;

  // 遊戲迴圈：只負責畫面
  let last = performance.now();
  const loop = (now) => {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    stage.update(dt); stage.draw();
    // 題目固定在畫面上方中間（2026-11-25 使用者：跟著怪物晃不好讀、會擋住攻擊動畫）；施法的時候收起來
    bubble.hidden = !bubble.textContent || !stage.monster;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  const say = (t) => { line.textContent = t; if (t) stage?.setPage("talk", Math.min(2.4, 0.5 + t.length * 0.06)); };
  const drawHud = () => {
    hud.replaceChildren(
      el("div.hearts", {}, ...Array.from({ length: maxHp(s.lv) }, (_, i) => el(`span.heart${i < hp ? "" : ".empty"}`))),
      el("div.combo", {}, combo >= 2 ? `連擊 ×${combo}` : ""),
      el("div.prog", {}, chal ? `連對 ${right}` : boss ? `護盾 ${"◆".repeat(shieldLeft)}${"◇".repeat(shield - shieldLeft)}` : exam ? `考核 ${right}/${EXAM}` : `${Math.min(qi + 1, total)}/${total}`),
    );
  };

  abilityBtn.hidden = !attr.uses;
  const drawAbility = () => { abilityBtn.textContent = `${attr.ability}（${uses}）`; abilityBtn.disabled = uses <= 0; };
  drawAbility();
  // 分支魔法的選單：點按鈕打開，列出還沒用過的招式
  magicBtn.hidden = !magic.length;
  magicBtn.onclick = () => {
    if (!cur || cur.done() || wrap.querySelector(".bmenu")) return;
    const left = magic.filter((b) => !usedMagic.has(b));
    const menu = el("div.bmenu", {}, el("div.bmt", {}, "分支魔法（每招一場一次）"),
      ...magic.map((b) => el("button.btn.small", { disabled: usedMagic.has(b), onclick: () => { menu.remove(); castMagic(b); } }, `${BRANCH_MAGIC[b].name}・${UNIT_NAME[b]}`, el("span.bmd", {}, BRANCH_MAGIC[b].desc))),
      el("button.btn.small", { onclick: () => menu.remove() }, "不用了"));
    if (!left.length) { say("分支魔法這場都用過了。"); return; }
    wrap.append(menu);
  };
  function castMagic(b) {
    const M = BRANCH_MAGIC[b];
    usedMagic.add(b); sfx("combo");
    magicBtn.disabled = usedMagic.size >= magic.length;
    if (M.fx === "heal") { hp = Math.min(maxHp(s.lv), hp + 1); drawHud(); say("回復！魔力＋1。"); }
    else if (M.fx === "shield") { flags.shield = true; say("護陣張開了：下一次答錯不扣魔力。"); }
    else if (M.fx === "double") { flags.double = true; say("分身！下一題答對，威力加倍。"); }
    else if (M.fx === "retry") { flags.retry = true; say("回流：這一題答錯可以再選一次。"); }
    else if (M.fx === "cut") { if (!cur.zap()) { usedMagic.delete(b); magicBtn.disabled = false; say("已經沒有可以劈掉的選項了。"); } else say("消去！劈掉了一個錯的選項。"); }
    else if (M.fx === "slow") { if (limit) { cur.slow(); say("慢流：這一題的時間多一倍。"); } else { usedMagic.delete(b); magicBtn.disabled = false; say("這一題本來就不限時喔。"); } }
    else if (M.fx === "hint") say(`預知：${hintOf(cur.q)}`);
  }

  if (boss) sfx("boss");
  say(tut ? "" : chal ? `挑戰：每題 ${Math.round(limit)} 秒，答錯就結束` : prac && practice.review ? "錯題本特訓" : prac ? `${UNIT_NAME[practice.branch]}・${MODES[practice.level].name}` : exam ? "升階考核：答對 7 題通過" : boss ? "墨水大王！答對一題打掉一格護盾" : "");

  // 最終戰（地下禁書庫的墨水大王・真身，世界觀第 7 節第 4 點）：開打前、打到一半、最後一題都有對話
  const final = boss && gradeId === "jh";
  const K = (text) => ({ who: null, name: "墨水大王", text }), PG = (text) => ({ who: "page", name: "頁頁", text });
  // 對話時角色會動：墨水大王說話＝抖一下、畫面晃；頁頁說話＝張嘴
  const scene = async (lines) => {
    if (!final || aborted) return;
    await talk(wrap, lines, null, { onLine: (L) => { if (L.name === "墨水大王") { stage.flinch(); stage.shake = 5; sfx("boss"); } else stage.setPage("talk", 2.5); } });
  };
  wordPanel.hidden = true;
  if (final) {
    // 真身從墨水裡慢慢浮現（淡入），然後才說話
    stage.spawn(true); stage.monster.x = 262; stage.monster.target = 262; stage.monster.alpha = 0;
    sfx("boss"); stage.shake = 6;
    for (let i = 1; i <= 20; i++) { stage.monster.alpha = i / 20; await wait(60); }
  }
  await scene([K("又來了……反正沒有人會算完我。每個人算到一半，就說「算了」。"), PG("才不是！見習魔數師一路把花園、書庫、鐘塔、溫室都算完了！"), K("那就算算看吧——把我身上所有的題目都算完！")]);
  let saidHalf = false, saidLast = false;

  let qi = 0;
  for (; qi < qs.length && hp > 0; qi++) {
    if (boss && shieldLeft <= 0) break;
    if (exam && qi >= EXAM) break;
    const q = qs[qi];
    // 上一隻還在散開（die）時也要叫新的一隻出來，不然這題會沒有怪物、沒有題目泡泡
    if (!stage.monster || stage.monster.state === "die") stage.spawn(boss, tut ? "ink" : null);
    drawHud();
    if (final && !saidHalf && shieldLeft <= Math.ceil(shield / 2)) { saidHalf = true; await scene([K("……你真的一直算下去？明明那麼多題。"), PG("不會的就去圖書館學，學會了再回來算！我們不會說「算了」。")]); }
    if (final && !saidLast && shieldLeft === 1) { saidLast = true; await scene([K("最後一題……是最早被丟進來的那一題。幾百年來，從來沒有人算完它。"), PG("見習魔數師，就是這一題！")]); }
    // 王的招式（企劃書 E8）：每三題一次，讓題目變難讀一下——晃動、或被墨水噴到（過一下就散開）
    const move = boss && qi > 0 && qi % 3 === 2 ? (qi % 2 ? "shake" : "ink") : null;
    bubble.classList.remove("mv-shake", "mv-ink");
    if (move) { sfx("boss"); stage.flinch(); say(move === "shake" ? "墨水大王使出「搖搖晃晃」！題目在晃……穩住！" : "墨水大王噴出「墨水霧」！等它散開再看清楚。"); }

    // 題目：計算題掛在怪物頭上；應用題放在下方面板
    const isWord = q.kind !== "calc";
    bubble.replaceChildren(isWord ? "？" : mathText(q.text));
    bubble.classList.toggle("one", isWord || q.text.length <= 26);     // 短的算式不換行（不會在「＝ ？」前面斷開）
    wordPanel.hidden = !isWord;
    wordPanel.replaceChildren(...(isWord ? [el("div.wtext", {}, mathText(q.text))] : []));
    speakText = q.text;
    if (s.settings.voice) setTimeout(() => speak(q.text, s.settings.mute), move ? 1700 : 250);
    if (move) { bubble.classList.add(`mv-${move}`); if (move === "ink") setTimeout(() => bubble.classList.remove("mv-ink"), 1600); }
    if (q.tut) { say(q.tut.text); glow(q.tut.glow); }
    else if (move) {}
    else if (qi === 0 && !isWord && !q.prefix) {}             // 第一題：留著開場說明（練習、挑戰、特訓的說明）
    else if (qi > 0) say("");

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
      sparks += Math.round((1 + tier) * (s.attr === "fire" ? 1.5 : sub === "fire" ? 1.25 : 1));
      if (flags.double && !boss) { combo++; flags.double = false; say("分身！連擊多加一！"); }
      sfx(`cast_${s.attr}`);
      bubble.textContent = "";
      if (q.math) {
        // 數學變魔法：先把算式變成光球（點畫面可以加速）
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
        if (flags.double && shieldLeft > 1) { shieldLeft--; flags.double = false; floatText(wrap, "分身！多打掉一格護盾", "exp"); }
        stage.shake = 6;
        if (shieldLeft > 0) stage.flinch();
        if (shieldLeft <= 0) { stage.purify(); if (!s.stars[`${gradeId}-boss`]) { stage.restoreColor(); setTimeout(() => sfx("restore"), 400); s.flags = { ...(s.flags ?? {}), restore: gradeId }; } }
      } else stage.purify();
      if (stage.monster && (!boss || shieldLeft <= 0)) { const k = stage.monster.kind; s.dex = { ...(s.dex ?? {}), [k]: (s.dex?.[k] ?? 0) + 1 }; }   // 墨水圖鑑
      await wait(650);
    } else {
      wrong++; combo = 0; q.missed = true;
      if (!exam && !tut && flags.shield) { flags.shield = false; sfx("tick"); say("護陣擋住了！這次不扣魔力。"); }
      else if (!exam && !tut) { hp--; stage.hurt(); sfx("hurt"); }
      else if (tut) sfx("hurt");
      stage.setPage("worried", 3);
      bubble.textContent = "";
      await showExplain(q, result.timeout);
      if (!boss) stage.purify();
      await wait(300);
      if (chal) break;                 // 挑戰模式：答錯就結束
    }
    drawHud();
  }

  if (aborted) return;
  running = false; stopSpeak();
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
  else if (hp > 0 && (!boss || shieldLeft <= 0)) stars = acc >= 1 ? 3 : acc >= 0.66 ? 2 : 1;   // 3 題：全對 3 星、錯 1 題 2 星
  if (stars === 0 && !exam && hp > 0 && (!boss || shieldLeft <= 0)) stars = 1;   // 有打完就至少一顆星
  const key = `${gradeId}-${boss ? "boss" : stageIdx + 1}`;
  let newBest = false;
  if (chal) { newBest = right > (s.challengeBest ?? 0); s.challengeBest = Math.max(s.challengeBest ?? 0, right); stars = 0; }
  else if (prac) {
    // 學院練習：星星記在練習紀錄（不影響主線區域的進度）；每日委託「練習一次」
    const pk = `${practice.branch}-${practice.level}`;
    if (!practice.review) s.practice = { ...(s.practice ?? {}), [pk]: Math.max(s.practice?.[pk] ?? 0, stars) };
    const d = daily(s); d.practice = (d.practice ?? 0) + 1;
  } else if (!exam) s.stars[key] = Math.max(s.stars[key] ?? 0, stars);
  let bonus = stars * EXP.star;
  if (exam && passed) { s.rank++; bonus += EXP.rankUp; }
  gained += bonus;
  const ups = addExp(s, gained);
  const coins = exam ? 0 : chal ? Math.min(40, right * 2) : prac ? 5 + stars * 4 : 10 + stars * 7;
  s.coins += coins;
  if (!prac && !chal) s.lastGrade = gradeId;
  writeSave(s);

  const firstClear = boss && stars > 0 && !(prevBossStars > 0);
  const missed = [...new Set(qs.slice(0, right + wrong).filter((q) => q.missed).map((q) => q.branch))];
  onEnd({ gradeId, mode, stageIdx, practice, missed, firstClear, newBest, best2: s.challengeBest, stars, passed, right, wrong, best, hp, sparks, gained, coins, ups, events, gentle: hp <= 0 && (s.mood >= 3 || gradeId === "g1" || gradeId === "g2") });

  // ── 一題：等玩家點答案或時間到 ──
  function askOne(q) {
    return new Promise((resolve) => {
      let done = false, retry = s.attr === "water" && uses > 0, retry2 = sub === "water" && uses2 > 0;
      let start = performance.now();
      answers.replaceChildren(...q.options.map((o, i) => el("button.btn.answer", { "data-k": i + 1, onclick: () => pickOpt(o, btns[i]) }, mathText(q.unit && q.kind === "word" ? `${o} ${q.unit}` : o))));
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
      // 副屬性的按鈕（雷：劈掉一個、森：提示；水是自動的回流；冰、火是自動的加成）
      subBtn.hidden = !(sub === "thunder" || sub === "forest");
      subBtn.textContent = SA ? `副・${SA.ability}（${uses2}）` : ""; subBtn.disabled = uses2 <= 0;
      subBtn.onclick = () => {
        if (uses2 <= 0 || done) return;
        if (sub === "thunder") { if (!zap()) return; say("副屬性・紫雷劈掉了一個錯的選項！"); }
        else say(`副屬性・萌芽提示：${hintOf(q)}`);
        uses2--; subBtn.textContent = `副・${SA.ability}（${uses2}）`; subBtn.disabled = uses2 <= 0;
      };
      function zap() {
        const wrongs = btns.filter((b, i) => q.options[i] !== q.answer && !b.disabled);
        if (!wrongs.length) return false;
        const b = wrongs[Math.floor(Math.random() * wrongs.length)];
        b.disabled = true; b.classList.add("zapped");
        stage.addFx(stageFxStrike(), { x: 200, y: 206, speed: 3 });
        return true;
      }
      cur = { q, zap, slow: () => { if (limit) start += limit * 1000; }, done: () => done };
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
        if (!ok && (retry || retry2 || flags.retry)) {
          if (flags.retry) flags.retry = false;
          else if (retry) { retry = false; uses--; drawAbility(); }
          else { retry2 = false; uses2--; }
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
        el("div.ebody", {}, mathText(q.explain)),
        el("div.eans", {}, mathText(`答案是 ${q.answer}${q.unit ? " " + q.unit : ""}`)),
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
