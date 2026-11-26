// 一關的流程（企劃書 7.2～7.5）：出題 → 答題 → 施法或受傷 → 下一隻；王有護盾；結束時結算星星與成長。

import { daily } from "../world/island-life.js";
import { el, show, floatText, wait, mathText } from "../ui.js";
import { Stage, fitWidth } from "./stage.js";
import { withChoices } from "../questions/pool.js";
import { ACADEMIES, MODES, buildPractice, buildArea, buildReview, buildChallenge } from "../practice.js";
import { talk } from "../world/talk.js";
import { speak, stopSpeak, canSpeak } from "../speak.js";
import { BRANCH_MAGIC, learnedMagic } from "./branch-magic.js";
import { ULT } from "./spells.js";
import { UNIT_NAME } from "../data.js";
import { ATTRS, GRADES, spellTier, maxHp, crystalLevel, EXP, STAGE_LEN, RANKS } from "../data.js";
import { recordAnswer, addExp, pagePageLevel } from "../growth.js";
import { writeSave } from "../save.js";
import { trackAnswer, flushCloud } from "../cloud.js";
import { sfx } from "../audio.js";
import { printable } from "./mathmagic-more.js";
import { loadAreaArt, loadBattleHD } from "./areaart.js";

// 題數（2026-11-25 使用者：遊戲裡要有 3、5、10 題的關）：每一區第 1 關 3 題、第 2 關 5 題、第 3 關 10 題；王 5 格護盾
const COUNT = 3;

// 第一場戰鬥（教學，企劃書 3.6）：5 題一年級加減法，頁頁一題教一件事。glow：要發光的地方
const TUT_Q = [[2, 3, "+"], [4, 4, "+"], [6, 3, "+"], [5, 5, "+"], [7, 2, "-"]];
// 2026-11-25 使用者：學系能力取消，五種屬性只差造型和攻擊特效
const TUT_ATTR = (attr) => ({ text: `你是${ATTRS[attr]?.school ?? "赤焰系"}，每次施法都有不同變化喔！`, glow: "combo" });
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
      { text: "墨水怪頭上就是題目，點下面四個答案施法！", glow: "answers" },
      { text: "算式成立就會化作魔法！再來一題！", glow: "answers" },
      { text: "連續答對會累積連擊，魔法會越變越華麗！", glow: "combo" },
      TUT_ATTR(attr),
      { text: "最後一題！算錯也只是咒語散掉，我們再算一次就好。", glow: "answers" },
    ][i];
    return q;
  });
}
// 怪物個性（2026-11-25 使用者：遊戲性不夠 → 照建議做「怪物有個性」）：每種墨水怪打法不一樣，第一次出現時頁頁提醒一句
//   hp：要答對幾題才會散開；combo：要「連續」答對（答錯就黏回去）；shield：第一題只打破盾（shuffle、blot 2026-11-26 取消）
const TRAITS = {
  pages: { hp: 2, combo: true, line: "散頁怪要「連續」答對兩題才會散開，答錯它會黏回去！" },
  shade: { hp: 2, line: "負號影有一個分身，要答對兩題！" },
  bug: { hp: 2, shield: true, line: "碎晶蟲身上有水晶盾，第一題先打破盾！" },
  // 2026-11-26 使用者：選項換位置、選項塗黑會干擾作答 → 取消（亂針鐘、塗鴉蝙蝠只剩外型和台詞）
  tick: { line: "亂針鐘的指針轉個不停，別被滴答聲嚇到，慢慢算！" },
  bat: { line: "塗鴉蝙蝠在亂飛，專心看題目就打得到！" },
};
// 屬性組合技（有副屬性時，連擊每 3 下）：兩個屬性合成一招
const COMBO_NAME = { "fire+water": "沸騰蒸氣", "fire+ice": "冰火交響", "fire+forest": "燎原花火", "fire+thunder": "爆炎雷", "water+ice": "冰晶浪潮",
  "water+forest": "春雨新芽", "water+thunder": "雷雨漩渦", "ice+forest": "霜花森林", "ice+thunder": "冰雷閃光", "forest+thunder": "雷鳴森羅" };
const comboName = (a, b) => COMBO_NAME[`${a}+${b}`] ?? COMBO_NAME[`${b}+${a}`] ?? "雙屬性魔法";
const EXAM = 10;      // 升階考核題數，答對 7 題通過

/**
 * mode："stage"（stage 0～2）、"boss"、"exam"、"practice"（學院練習：practice＝{ academy, branch, level }）。onEnd(result) 回到地圖或重玩。
 */
export async function runBattle(game, gradeId, mode, stageIdx, onEnd, onReady, practice = null) {
  const s = game.save;
  const g = GRADES[gradeId];
  const boss = mode === "boss", exam = mode === "exam", tut = mode === "tutorial", prac = mode === "practice", chal = mode === "challenge";
  const AC = prac ? ACADEMIES[practice.academy] : null;

  // 2026-11-26 使用者：時間限制全部取消（挑戰模式也是）；完美詠唱保留，但不顯示時間條
  let slowNext = false;               // 慢流：下一題完美詠唱時間多一倍
  const limit = 0;
  const sub = s.subAttr && s.subAttr !== s.attr && s.lv >= 20 ? s.subAttr : null;   // 副屬性（Lv20）：只用在組合技的特效

  const shield = boss ? g.boss : 0;
  const prevBossStars = s.stars[`${gradeId}-boss`] ?? 0;          // 第一次打倒這一區的王（最終戰打完要接結局）
  const total = tut ? TUT_Q.length : exam ? EXAM : boss ? shield + 6 : prac ? (practice.count ?? COUNT) : chal ? 60 : (STAGE_LEN[stageIdx] ?? COUNT);   // 王：5 格護盾＝答對 5 題，答錯的會多出一題補上
  const [qs] = await Promise.all([tut ? tutorialQuestions(s.attr) : chal ? buildChallenge(s) : prac ? (practice.review ? buildReview(s, total) : buildPractice(s, practice.branch, practice.level, total)) : buildArea(s, gradeId, stageIdx, total, boss, exam),
    loadBattleHD(gradeId, AC?.area).then((hd) => hd ?? loadAreaArt(gradeId))]);

  // ── 畫面 ──
  const canvas = el("canvas.stage");
  const hud = el("div.hud");
  const bubble = el("div.bubble");
  const wordPanel = el("div.word", { hidden: true });
  const qstack = el("div.qstack", {}, bubble, wordPanel);
  const line = el("div.pagepage");
  const answers = el("div.answers");
  // 2026-11-26 使用者：技能、大招改成自動施放，技能鈕刪掉。左上角愛心旁邊只留 3 顆數晶（集滿＝下一題答對自動放大招）
  const ultPips = el("span.ultpips", { hidden: tut }, el("i"), el("i"), el("i"));
  // 朗讀題目：喇叭按鈕（題目左邊）；設定「自動朗讀」時每題出來就念
  let speakText = "";
  const speakBtn = el("button.btn.small.speak", { hidden: !canSpeak(), "aria-label": "念題目", onclick: () => speak(speakText, s.settings.mute) }, "🔊");
  let aborted = false;
  const leave = tut ? null : el("button.btn.small.leave", { onclick: () => { if (confirm("離開這一關？這關的進度不會保存。")) { aborted = true; running = false; game.go("map"); } } }, "離開");
  const wrap = el("div.battle", {}, el("div.view", {}, canvas, hud, qstack, speakBtn, leave), line, answers);
  show(wrap);
  const app = document.querySelector("#app");
  fitWidth(app.clientWidth / app.clientHeight);          // 戰鬥畫面的寬度跟著螢幕比例
  const stage = new Stage(canvas, gradeId, s.look, s.attr, s.settings, { ...(AC ? { area: AC.area, kinds: [AC.monster] } : {}), ...(chal ? { area: "clock", kinds: ["ink", "flower", "pages", "bat", "tick", "bug", "shade"] } : {}), pageForm: pagePageLevel(s), crystalLv: crystalLevel(s.crystals[s.attr]) });
  onReady?.();   // 戰鬥畫面準備好了（轉場可以打開）
  window.__stage = stage;   // 開發用：在主控台操作戰鬥畫面
  // 這一區的王已經打倒過＝已經恢復色彩；還沒的話是被墨水弄灰的樣子
  stage.gray = prac || s.stars[`${gradeId}-boss`] ? 0 : 1;          // 學院沒有被污染

  const wrongs = [];          // 這場答錯的題目（結算畫面看講解）
  let hp = maxHp(s.lv), combo = 0, best = 0, right = 0, wrong = 0, sparks = 0, shieldLeft = shield, gained = 0;
  // 分支魔法：學會的每一招這場可以用一次
  const magic = tut ? [] : learnedMagic(s), flags = { shield: false };
  let cur = null;          // 現在這一題（分支魔法、副屬性要用）
  // 數晶大招：答對一題集一顆（最多 3 顆），集滿可以按「大招」，下一題答對放終極魔法
  let energy = tut ? 0 : Math.min(3, s.energy ?? 0);      // 數晶跨場保留（一般關卡只有 3 題）
  // 王分階段：護盾剩一半時變身，招式變多（每 2 題一次、多一招「調換選項」）
  let phase = 1, curMove = null;
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

  // 王的血條（2026-11-26 使用者：顯示怪的血條、不寫數字）：固定一條在右上角，護盾少一格就縮短（有動畫）
  const bossFill = el("i"), bossBar = boss ? el("div.bossbar", {}, el("span", {}, "墨水大王"), el("div.bhp", {}, bossFill)) : null;
  const say = (t) => { line.textContent = t; if (t) stage?.setPage("talk", Math.min(2.4, 0.5 + t.length * 0.06)); };
  let lastHp = maxHp(s.lv);
  const drawHud = () => {
    drawSkills();
    hud.replaceChildren(
      el("div.hstack", {}, el("div.hearts", {}, ...Array.from({ length: maxHp(s.lv) }, (_, i) => el(`span.heart${i < hp ? "" : ".empty"}${i >= hp && i < lastHp ? ".lost" : ""}`))), ultPips),
      el("div.combo", {}, combo >= 2 ? `連擊 ×${combo}` : ""),
      boss ? bossBar : el("div.prog", {}, chal ? `連對 ${right}` : exam ? `考核 ${right}/${EXAM}` : `${Math.min(qi + 1, total)}/${total}`),
    );
    lastHp = hp;
    if (boss) bossFill.style.width = `${(100 * Math.max(0, shieldLeft)) / shield}%`;
  };

  // 數晶的樣子
  function drawSkills() {
    [...ultPips.children].forEach((p, k) => p.classList.toggle("on", k < energy));
    ultPips.classList.toggle("full", energy >= 3);
  }
  // 分支魔法自動施放（2026-11-26 使用者）：情況到了就自己發動，每招每場一次（王戰兩次）
  const uses = Object.fromEntries(magic.map((b) => [b, boss ? 2 : 1]));
  function useMagic(fx) {
    const b = magic.find((k) => BRANCH_MAGIC[k].fx === fx && uses[k] > 0);
    if (!b) return false;
    uses[b]--; sfx("combo");
    skillPop(wrap, BRANCH_MAGIC[b].name, fx);
    stage.skillFx(fx);
    return true;
  }

  if (boss) sfx("boss");
  say(chal ? "挑戰：連答到底，答錯就結束" : exam ? "升階考核：答對 7 題通過" : "");

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
  await scene([K("又來了……每個人算到一半，最後還不是說一聲「算了」就走掉。"), PG("才不是！小魔數師一路把花園、書庫、鐘塔、溫室全都算完了！"), K("……那就試試看吧。把我身上幾百年的題目，全都算完！")]);
  let saidHalf = false, saidLast = false;

  const seenTrait = new Set(s.flags?.seenTrait ?? []);
  let curTrait = null;
  let qi = 0;
  for (; qi < qs.length && hp > 0; qi++) {
    if (boss && shieldLeft <= 0) break;
    if (exam && qi >= EXAM) break;
    const q = qs[qi];
    // 上一隻還在散開（die）時也要叫新的一隻出來，不然這題會沒有怪物、沒有題目泡泡
    if (!stage.monster || stage.monster.state === "die") {
      stage.spawn(boss, tut ? "ink" : null);
      const T = !boss && TRAITS[stage.monster.kind];
      if (!boss) {
        // 2026-11-26 使用者：怪不能打一下就死 → 一隻要打 2～3 下（照剩下的題數分配，最後一隻剛好打完）
        const rem = (exam ? EXAM : qs.length) - qi;
        const hits = rem >= 2 ? Math.max(T?.hp ?? 1, hitsFor(rem)) : 1;
        // 2026-11-26 使用者：血量改成數值 → 每一下的份量（unit）照區域和怪物種類；血量＝要打幾下 × unit
        const unit = Math.round((HP_UNIT[gradeId] ?? 50) * (KIND_MUL[stage.monster.kind] ?? 1));
        stage.monster.unit = unit;
        stage.monster.hp = stage.monster.maxHp = hits * unit;
        stage.monster.qLeft = hits;          // 分給這隻的題數：用完還沒打倒就縮回墨水裡（換下一隻）
      }
      if (T && !seenTrait.has(stage.monster.kind)) { seenTrait.add(stage.monster.kind); await talk(wrap, [{ who: "page", name: "頁頁", text: T.line }]); }
    }
    const mon = stage.monster, trait = !boss && mon ? TRAITS[mon.kind] : null;
    curTrait = trait;                    // 答題（askOne）要用：換選項、塗黑
    drawHud();
    // 王變身（第二階段）：護盾剩一半
    if (boss && phase === 1 && shieldLeft <= Math.ceil(shield / 2) && shieldLeft < shield && stage.monster) {
      phase = 2; stage.monster.phase2 = true;
      sfx("boss"); stage.shake = 10; stage.flinch(); stage.flashC = "#b483ff"; stage.flashA = 0.5; stage.flashT = 0.4;
      say("墨水大王變身了！招式變多了，小心！");
      await wait(900);
    }
    if (final && !saidHalf && shieldLeft <= Math.ceil(shield / 2)) { saidHalf = true; await scene([K("明明這麼難、這麼多……你為什麼不放棄？"), PG("不會就去圖書館學，學會了再回來算。我們才不會說「算了」！")]); }
    if (final && !saidLast && shieldLeft === 1) { saidLast = true; await scene([K("最後這一題……是創校以來最早被丟進來的，幾百年都沒人算完。"), PG("小魔數師，一起為它畫下句點吧！")]); }
    // 王的招式（企劃書 E8）：第一階段每三題一次（晃動、墨水霧）；變身後每兩題一次，多一招「調換選項」
    const move = !boss || qi === 0 ? null : phase === 1 ? (qi % 3 === 2 ? (qi % 2 ? "shake" : "ink") : null) : (qi % 2 === 1 ? ["ink", "shake"][Math.floor(qi / 2) % 2] : null);   // 2026-11-26：拿掉「調換選項」
    curMove = move;
    bubble.classList.remove("mv-shake", "mv-ink");
    wordPanel.classList.remove("mv-shake", "mv-ink");
    if (move) { sfx("boss"); stage.flinch(); say(move === "shake" ? "墨水大王使出「搖搖晃晃」！題目在晃……穩住！" : "墨水大王噴出「墨水霧」！等它散開再看清楚。"); }

    wrap.classList.remove("casting");
    // 題目：計算題用大字泡泡；應用題用寬面板（都在 .qstack 裡，完美詠唱條自動排在下方不重疊）
    const isWord = q.kind !== "calc";
    bubble.replaceChildren(...(isWord ? [] : [mathText(q.text)]));
    bubble.classList.toggle("one", !isWord && visLen(q.text) <= 22);     // 真正短的算式不換行（不會在「＝ ？」前面斷開）
    wordPanel.hidden = !isWord;
    wordPanel.replaceChildren(...(isWord ? [el("div.wtext", {}, mathText(q.text))] : []));
    speakText = q.text;
    if (s.settings.voice) setTimeout(() => speak(q.text, s.settings.mute), move ? 1700 : 250);
    const qBox = isWord ? wordPanel : bubble;
    if (move && move !== "swap") { qBox.classList.add(`mv-${move}`); if (move === "ink") setTimeout(() => qBox.classList.remove("mv-ink"), 1600); }
    if (q.tut) { say(q.tut.text); glow(q.tut.glow); }
    else if (move) {}
    else if (qi === 0 && !isWord && !q.prefix) {}             // 第一題：留著開場說明（練習、挑戰、特訓的說明）
    else if (qi > 0) say("");

    // 完美詠唱：計算題 4 秒、應用題 9 秒內答對（2026-11-26 使用者：保留，但不顯示時間條）
    const perfectSec = (isWord ? 9 : 4) * (slowNext ? 2 : 1);   // 慢流發動過：這一題的完美詠唱時間多一倍
    slowNext = false;
    const t0 = performance.now();
    const result = await askOne(q);
    glow(null);
    if (aborted) return;
    const sec = (performance.now() - t0) / 1000;

    const hadReview = !!s.review[q.typeKey];
    const rec = recordAnswer(s, { ...q, targetSec: g.time ? g.time / 2 : 8 }, result.ok, sec);
    trackAnswer({ q, ok: result.ok, pick: result.pick ?? (result.timeout ? "逾時未答" : ""), mode, graduated: hadReview && !s.review[q.typeKey] });
    events.push(...rec.events);
    if (rec.exp) { gained += rec.exp; floatText(wrap, `＋${rec.exp} 經驗`, "exp"); }

    if (result.ok) {
      right++; combo++; best = Math.max(best, combo);
      const perfect = !tut && sec <= perfectSec;
      const ult = !tut && energy >= 3;           // 數晶集滿：這一題答對自動放大招
      const comboTech = !tut && sub && combo % 3 === 0;          // 一般關卡只有 3 題：每連擊 3 下一次
      let tier = ult || comboTech ? 4 : Math.min(4, spellTier(combo) + (perfect ? 1 : 0));
      if (ult) energy = 0;
      else if (!tut) { energy = Math.min(3, energy + 1); if (energy === 3) setTimeout(() => say("數晶集滿了！下一題答對就放大招！"), 1800); }
      if (perfect) { floatText(wrap, "完美詠唱！", "exp"); gained += 5; }
      else if (!tut && !ult && useMagic("slow")) slowNext = true;   // 慢流（2026-11-26 沒有限時了）：答對但不夠快 → 下一題完美詠唱時間多一倍
      if (tier > spellTier(combo - 1)) setTimeout(() => sfx("combo"), 120);   // 連擊升級（魔法變強）
      sparks += 1 + tier;
      // 分身：連擊到 3 自動發動，這一下打兩格（王：多打掉一格護盾）
      const dbl = combo === 3 && !ult && useMagic("double");
      sfx(`cast_${s.attr}`);
      bubble.textContent = "";
      wordPanel.hidden = true;
      wrap.classList.add("casting");          // 施法時題目和答案收起來（2026-11-26 使用者）
      if (q.math) {
        // 數學變魔法：先把算式變成光球（點畫面可以加速）
        canvas.onclick = () => stage.magic?.skip();
        await stage.mathMagic(q.math);
        canvas.onclick = null;
      }
      say(ult || comboTech || perfect ? "" : ["", "咒語成立！", "魔法變強了！", "大魔法！", "終極魔法！！"][tier]);
      if (ult) {
        // 數晶大招：專屬跳字（招式名）＋集氣、轟炸、光爆
        skillPop(wrap, ULT[s.attr]?.name ?? "數晶解放", "ult", "數晶解放");
        sfx("combo"); setTimeout(() => sfx(`cast_${s.attr}`), 900);
        await stage.ultimate(crystalLevel(s.crystals[s.attr]), comboTech ? sub : null);
      } else {
        if (comboTech) { skillPop(wrap, comboName(s.attr, sub), "combo"); stage.flashC = ATTRS[sub].color; stage.flashA = 0.45; stage.flashT = 0.35; }
        await stage.cast(tier, crystalLevel(s.crystals[s.attr]), q.branch, comboTech ? sub : null);
      }
      stage.setPage("happy", 1.6);
      // 答案數字跳出來；選擇題的答案可能是中文（像素字寫不出來），就跳一顆星
      const shown = String(q.answer).replace(/−|－/g, "-");
      stage.popNumber(printable(shown) && shown.length <= 8 ? shown : "!", combo);
      sfx("hit");
      const crit = perfect || tier >= 3 || dbl || ult || comboTech;
      // 多段數字：魔法越強段數越多（第 1 級 2 段 … 第 4 級 5 段；分身多 2 段；組合技 6 段；大招 8 段）
      const segs = ult ? 8 : comboTech ? 6 : Math.min(7, tier + 1 + (dbl ? 2 : 0));
      const roll = (u) => Math.round(u * (TIER_MUL[tier] ?? 1) * (perfect ? 1.25 : 1) * (0.92 + Math.random() * 0.16));
      if (boss) {
        const before = shieldLeft;
        shieldLeft--;
        if ((ult || comboTech) && shieldLeft > 1) shieldLeft--;
        if (dbl && shieldLeft > 1) shieldLeft--;
        // 王的傷害數字：一格護盾＝bossUnit
        const bu = Math.round((HP_UNIT[gradeId] ?? 50) * 2.2);
        stage.damage((before - Math.max(0, shieldLeft)) * roll(bu) * (ult ? 2 : 1), crit ? "crit" : "hit", segs);
        bossBar.classList.remove("hit"); void bossBar.offsetWidth; bossBar.classList.add("hit");
        stage.shake = 6;
        if (shieldLeft > 0) stage.flinch();
        if (shieldLeft <= 0) { stage.purify(); if (!s.stars[`${gradeId}-boss`]) { stage.restoreColor(); setTimeout(() => sfx("restore"), 400); s.flags = { ...(s.flags ?? {}), restore: gradeId }; } }
      } else if (mon) {
        // 傷害＝unit × 魔法等級 × 完美詠唱 × 一點點隨機；分身兩倍；碎晶蟲第一下打在盾上只有一半；
        // 大招、組合技、或這是分給這隻的最後一題：一定打倒（最後一隻剛好打完）
        const unit = mon.unit ?? 50;
        let dmg = roll(unit) * (dbl ? 2 : 1);
        const shieldHit = trait?.shield && mon.hp === mon.maxHp;
        if (shieldHit) dmg = Math.round(dmg * 0.5);
        if (ult || comboTech) dmg = Math.max(Math.round(unit * 3.2), mon.hp);
        else if (mon.qLeft <= 1) dmg = Math.max(dmg, mon.hp);
        mon.hp = Math.max(0, mon.hp - dmg);
        stage.damage(dmg, crit ? "crit" : "hit", segs);
        if (mon.hp <= 0) stage.purify();
        else { stage.flinch(); if (shieldHit) { sfx("shatter"); say("水晶盾碎了！"); } }
      }
      if (stage.monster && stage.monster.state === "die" && (!boss || shieldLeft <= 0)) { const k = stage.monster.kind; s.dex = { ...(s.dex ?? {}), [k]: (s.dex?.[k] ?? 0) + 1 }; }   // 墨水圖鑑
      await wait(ult ? 1400 : 650);        // 大招：等光爆散掉才叫下一隻
    } else {
      wrong++; combo = 0; q.missed = true;
      if (!exam && !tut && flags.shield) { flags.shield = false; sfx("tick"); skillPop(wrap, "護陣擋住了", "block"); stage.skillFx("shield"); }
      else if (!exam && !tut) { hp--; stage.hurt(); sfx("hurt"); }
      else if (tut) sfx("hurt");
      stage.setPage("worried", 3);
      // 2026-11-26 使用者：錯題講解不直接跳出來 → 記下來，戰鬥結束在結算畫面看；這裡只亮出正確答案一下
      wrongs.push({ text: q.text, answer: q.answer, unit: q.unit, explain: q.explain, pick: result.pick ?? null, timeout: result.timeout, branch: q.branch });
      say(result.timeout ? `時間到了！答案是 ${q.answer}${q.unit ? " " + q.unit : ""}` : `答案是 ${q.answer}${q.unit ? " " + q.unit : ""}，戰鬥後可以看講解。`);
      if (!boss && mon && trait?.combo && mon.hp < mon.maxHp) { stage.damage(mon.maxHp - mon.hp, "heal"); mon.hp = mon.maxHp; say("散頁怪又黏回去了……要連續答對！"); }
      await wait(1300);
      // 自動魔法：剩 1 顆心＝回復；答錯過一次＝張開護陣擋下一次
      if (!exam && !tut && hp === 1 && maxHp(s.lv) > 1 && useMagic("heal")) { hp++; drawHud(); await wait(900); }
      if (!exam && !tut && hp > 0 && !flags.shield && useMagic("shield")) { flags.shield = true; await wait(900); }
      bubble.textContent = "";
      wordPanel.hidden = true;
      if (chal) break;                 // 挑戰模式：答錯就結束
    }
    if (!boss && mon && mon.state !== "die" && --mon.qLeft <= 0) { stage.purify(); say("墨水怪縮回墨水裡了。"); }
    drawHud();
  }

  if (aborted) return;
  running = false; stopSpeak();
  s.flags = { ...(s.flags ?? {}), seenTrait: [...seenTrait] };
  if (!tut) s.energy = energy;          // 按了大招但沒用到：數晶還給你
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
  else if (hp > 0 && (!boss || shieldLeft <= 0)) stars = acc >= 0.9 ? 3 : acc >= 0.6 ? 2 : 1;   // 3、5 題要全對才 3 星；10 題可以錯 1 題
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
  const lenMul = boss ? 1.5 : total >= 10 ? 2.5 : total >= 5 ? 1.5 : 1;      // 題目越多、晶幣越多
  const coins = exam ? 0 : chal ? Math.min(40, right * 2) : Math.round((prac ? 5 + stars * 4 : 10 + stars * 7) * lenMul);
  s.coins += coins;
  if (!prac && !chal) s.lastGrade = gradeId;
  writeSave(s);
  flushCloud(false);

  const firstClear = boss && stars > 0 && !(prevBossStars > 0);
  const missed = [...new Set(qs.slice(0, right + wrong).filter((q) => q.missed).map((q) => q.branch))];
  onEnd({ gradeId, mode, stageIdx, practice, missed, wrongs, firstClear, newBest, best2: s.challengeBest, stars, passed, right, wrong, best, hp, sparks, gained, coins, ups, events, gentle: hp <= 0 && (s.mood >= 3 || gradeId === "g1" || gradeId === "g2") });

  // ── 一題：等玩家點答案或時間到 ──
  function askOne(q) {
    return new Promise((resolve) => {
      let done = false;
      let start = performance.now();
      answers.replaceChildren(...q.options.map((o, i) => {
        const txt = q.unit && q.kind === "word" ? `${o} ${q.unit}` : String(o);
        const vl = visLen(txt);
        const cls = vl > 20 ? ".xlong" : vl > 10 ? ".long" : "";
        return el(`button.btn.answer${cls}`, { "data-k": i + 1, "data-v": o, onclick: (e) => pickOpt(o, e.currentTarget) }, mathText(txt));
      }));
      let btns = [...answers.children];
      const key = (e) => { const n = Number(e.key); if (n >= 1 && n <= btns.length) btns[n - 1].click(); };
      addEventListener("keydown", key);
      function zap() {
        const wrongs = btns.filter((b) => b.dataset.v !== q.answer && !b.disabled);
        if (!wrongs.length) return false;
        const b = wrongs[Math.floor(Math.random() * wrongs.length)];
        b.disabled = true; b.classList.add("zapped");
        stage.addFx(stageFxStrike(), { x: 200, y: 206, speed: 3 });
        return true;
      }
      cur = { q, zap, done: () => done };
      drawSkills();
      // 自動魔法：想了 8 秒還沒選＝消去一個錯的選項；再 4 秒＝預知（說出第一步）
      const think = setTimeout(() => { if (!done && !aborted && !q.tut && useMagic("cut")) zap(); }, 8000);
      const think2 = setTimeout(() => { if (!done && !aborted && !q.tut && useMagic("hint")) say(`預知：${hintOf(q)}`); }, 12000);
      let slowed = false;
      const timer = limit ? setInterval(() => {
        if (aborted) { clearInterval(timer); return; }
        let frac = Math.min(1, (performance.now() - start) / 1000 / limit);
        if (frac >= 0.5 && !slowed) { slowed = true; if (useMagic("slow")) { start += limit * 1000; frac = Math.min(1, (performance.now() - start) / 1000 / limit); } }   // 慢流：時間剩一半時，這題多一倍時間
        stage.walkTo(frac);
        if (frac >= 1) finish(false, true);
      }, 100) : null;
      stage.walkTo(limit ? 0 : null);

      function pickOpt(o, b) {
        if (done || b.disabled) return;
        const ok = o === q.answer;
        if (!ok && useMagic("retry")) {
          b.disabled = true; b.classList.add("wrong");
          say("回流！這題可以再選一次。");
          stage.setPage("worried", 1.6);
          sfx("tick");
          return;
        }
        btns.forEach((x) => { if (x.dataset.v === q.answer) x.classList.add("right"); });
        if (!ok) b.classList.add("wrong");
        finish(ok, false, o);
      }
      function finish(ok, timeout, pick = null) {
        if (done) return;
        done = true;
        clearTimeout(think); clearTimeout(think2); drawSkills();
        if (timer) clearInterval(timer);
        removeEventListener("keydown", key);
        btns.forEach((x) => (x.disabled = true));
        resolve({ ok, timeout, pick });
      }
    });
  }

  // 教學：讓要按的地方發光
  function glow(what) {
    for (const n of [answers, hud]) n.classList.remove("tutglow");
    if (what === "answers") answers.classList.add("tutglow");
    else if (what === "combo") hud.classList.add("tutglow");
  }

}

// 怪物血量（數值）：每一下的份量照區域，再乘上怪物種類；魔法等級越高、打越痛
const HP_UNIT = { g1: 40, g2: 55, g34: 70, g56: 85, jh: 100 };
const KIND_MUL = { ink: 1, flower: 1.1, pages: 0.9, bat: 0.95, tick: 1.05, bug: 1.25, shade: 1.15 };
const TIER_MUL = [1, 1, 1.15, 1.35, 1.6];

// 一隻怪要打幾下：照剩下的題數分配（3、5、10 題＝3／3＋2／3＋3＋2＋2），最後一隻剛好打完
const hitsFor = (rem) => (rem === 4 || rem === 2 ? 2 : rem === 1 ? 1 : 3);

// 技能發動的專屬跳字（2026-11-26 使用者：所有技能發動時都要有專屬跳字特效提示）：每種技能自己的顏色、圖示、動畫
const SKILL_ICON = { heal: "✚", shield: "◆", block: "◆", double: "✦", cut: "✕", retry: "↺", slow: "◷", hint: "◉", combo: "✧", ult: "✦" };
function skillPop(parent, name, kind, sub = "") {
  parent.querySelector(`.skpop.k-${kind}`)?.remove();
  const n = el(`div.skpop.k-${kind}`, {}, el("i.sico", {}, SKILL_ICON[kind] ?? "✧"), el("b.sname", {}, ...[...name].map((c, i) => el("span", { style: { animationDelay: `${i * 45}ms` } }, c))), sub ? el("small.ssub", {}, sub) : null);
  parent.append(n);
  setTimeout(() => n.remove(), kind === "ult" ? 2400 : 1700);
}

// 估算視覺字寬（全形＝2、半形＝1），用來決定題目不換行或答案字體縮小
const visLen = (s) => [...String(s ?? "")].reduce((n, c) => n + (c.charCodeAt(0) > 127 ? 2 : 1), 0);

function hintOf(q) {
  // 把詳解裡的最後答案藏起來，只留想法
  const e = String(q.explain);
  const cut = e.lastIndexOf("＝");
  return cut > 0 ? e.slice(0, cut + 1) + "？" : "把題目一句一句畫出來看看。";
}

import * as strikeMod from "../../../pixelfx/src/fx/lightning/chain-lightning.js";
const stageFxStrike = () => strikeMod;
