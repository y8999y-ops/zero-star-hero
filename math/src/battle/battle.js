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
import { ATTRS, GRADES, spellTier, maxHp, crystalLevel, EXP, STAGE_LEN, RANKS } from "../data.js";
import { recordAnswer, addExp, pagePageLevel } from "../growth.js";
import { writeSave } from "../save.js";
import { sfx } from "../audio.js";
import { TIMER_EASE } from "../settings.js";
import { printable } from "./mathmagic-more.js";
import { loadAreaArt, loadBattleHD } from "./areaart.js";

// 題數（2026-11-25 使用者：遊戲裡要有 3、5、10 題的關）：每一區第 1 關 3 題、第 2 關 5 題、第 3 關 10 題；王 5 格護盾
const COUNT = 3;

// 第一場戰鬥（教學，企劃書 3.6）：5 題一年級加減法，頁頁一題教一件事。glow：要發光的地方
const TUT_Q = [[2, 3, "+"], [4, 4, "+"], [6, 3, "+"], [5, 5, "+"], [7, 2, "-"]];
// 2026-11-25 使用者：學系能力取消，五種屬性只差造型和攻擊特效
const TUT_ATTR = (attr) => ({ text: `你是${ATTRS[attr]?.school ?? "赤焰系"}！每次答對的魔法都會有點不一樣，連擊越高越華麗！`, glow: "combo" });
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
      TUT_ATTR(attr),
      { text: "最後一題！就算算錯也沒關係，我會陪你一起算一次。", glow: "answers" },
    ][i];
    return q;
  });
}
// 怪物個性（2026-11-25 使用者：遊戲性不夠 → 照建議做「怪物有個性」）：每種墨水怪打法不一樣，第一次出現時頁頁提醒一句
//   hp：要答對幾題才會散開；combo：要「連續」答對（答錯就黏回去）；shield：第一題只打破盾；shuffle：出題後選項換位置；blot：一個選項被塗黑一下
const TRAITS = {
  pages: { hp: 2, combo: true, line: "散頁怪要「連續」答對兩題才會散開，答錯它會黏回去！" },
  shade: { hp: 2, line: "負號影有一個分身，要答對兩題！" },
  bug: { hp: 2, shield: true, line: "碎晶蟲身上有水晶盾，第一題先打破盾！" },
  tick: { shuffle: true, line: "亂針鐘會把選項換位置，看清楚再按！" },
  bat: { blot: true, line: "塗鴉蝙蝠會把一個選項塗黑，等墨水散開再看！" },
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

  // 限時：學年規則 × 心情題（企劃書 4.3、5）
  let limit = s.settings.timer ? g.time : 0;
  if (s.mood >= 3) limit = 0;
  else if (s.mood >= 2) limit *= 1.3;
  const sub = s.subAttr && s.subAttr !== s.attr && s.lv >= 20 ? s.subAttr : null;   // 副屬性（Lv20）：只用在組合技的特效
  limit *= TIMER_EASE[s.settings.timerEase] ?? 1;
  if (tut) limit = 0;                       // 教學不限時
  if (chal) limit = 20;                      // 挑戰模式：一定限時 20 秒（2026-11-25 使用者：限時給兩倍）

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
  const line = el("div.pagepage");
  const answers = el("div.answers");
  // 技能列（2026-11-25 使用者：技能和大招位置不一樣、不好操作 → 重新設計）：
  //   右邊固定一排兩顆一樣大的圓鈕，一直都在同一個地方，只是狀態不同（暗＝還不能用、亮＝可以用、發光＝準備好了）
  //   大招：按鈕裡面就是 3 顆數晶（集滿才亮）；魔法：右上角數字＝這場還剩幾招
  const ultPips = el("span.skpips", {}, el("i"), el("i"), el("i"));
  const ultBtn = el("button.skb.ult", { onclick: () => {
    if (!cur || cur.done()) return;
    if (armed) return;
    if (energy < 3) { say(`數晶 ${energy}／3：再答對 ${3 - energy} 題就可以放大招！`); return; }
    armed = true; energy = 0; drawHud(); sfx("combo");
    say("大招準備！答對這一題就放出去！");
  } }, el("span.skico", {}, "✦"), el("span.skl", {}, "大招"), ultPips);
  const magicBadge = el("span.skbadge");
  const magicBtn = el("button.skb.mag", {}, el("span.skico", {}, "✧"), el("span.skl", {}, "魔法"), magicBadge);
  const skdock = el("div.skdock", { hidden: tut }, magicBtn, ultBtn);
  // 朗讀題目：喇叭按鈕（題目左邊）；設定「自動朗讀」時每題出來就念
  let speakText = "";
  const speakBtn = el("button.btn.small.speak", { hidden: !canSpeak(), "aria-label": "念題目", onclick: () => speak(speakText, s.settings.mute) }, "🔊");
  let aborted = false;
  const leave = tut ? null : el("button.btn.small.leave", { onclick: () => { if (confirm("離開這一關？這關的進度不會保存。")) { aborted = true; running = false; game.go("map"); } } }, "離開");
  const wrap = el("div.battle", {}, el("div.view", {}, canvas, hud, bubble, speakBtn, leave), wordPanel, line, answers, skdock);
  show(wrap);
  const app = document.querySelector("#app");
  fitWidth(app.clientWidth / app.clientHeight);          // 戰鬥畫面的寬度跟著螢幕比例
  const stage = new Stage(canvas, gradeId, s.look, s.attr, s.settings, { ...(AC ? { area: AC.area, kinds: [AC.monster] } : {}), ...(chal ? { area: "clock", kinds: ["ink", "flower", "pages", "bat", "tick", "bug", "shade"] } : {}), pageForm: pagePageLevel(s), crystalLv: crystalLevel(s.crystals[s.attr]) });
  onReady?.();   // 戰鬥畫面準備好了（轉場可以打開）
  window.__stage = stage;   // 開發用：在主控台操作戰鬥畫面
  // 這一區的王已經打倒過＝已經恢復色彩；還沒的話是被墨水弄灰的樣子
  stage.gray = prac || s.stars[`${gradeId}-boss`] ? 0 : 1;          // 學院沒有被污染

  let hp = maxHp(s.lv), combo = 0, best = 0, right = 0, wrong = 0, sparks = 0, shieldLeft = shield, gained = 0;
  // 分支魔法：學會的每一招這場可以用一次
  const magic = tut ? [] : learnedMagic(s), usedMagic = new Set(), flags = { shield: false, retry: false, double: false };
  let cur = null;          // 現在這一題（分支魔法、副屬性要用）
  // 數晶大招：答對一題集一顆（最多 3 顆），集滿可以按「大招」，下一題答對放終極魔法
  let energy = tut ? 0 : Math.min(3, s.energy ?? 0), armed = false;      // 數晶跨場保留（一般關卡只有 3 題）
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

  const say = (t) => { line.textContent = t; if (t) stage?.setPage("talk", Math.min(2.4, 0.5 + t.length * 0.06)); };
  const drawHud = () => {
    drawSkills();
    hud.replaceChildren(
      el("div.hearts", {}, ...Array.from({ length: maxHp(s.lv) }, (_, i) => el(`span.heart${i < hp ? "" : ".empty"}`))),
      el("div.combo", {}, combo >= 2 ? `連擊 ×${combo}` : ""),
      el("div.prog", {}, chal ? `連對 ${right}` : boss ? `護盾 ${"◆".repeat(shieldLeft)}${"◇".repeat(shield - shieldLeft)}` : exam ? `考核 ${right}/${EXAM}` : `${Math.min(qi + 1, total)}/${total}`),
    );
  };

  // 技能列的樣子：每次數晶、魔法用量、能不能按改變時都重畫
  function drawSkills() {
    const left = magic.filter((b) => !usedMagic.has(b)).length, asking = !!cur && !cur.done();
    [...ultPips.children].forEach((p, k) => p.classList.toggle("on", armed || k < energy));
    ultBtn.classList.toggle("ready", energy >= 3 && !armed);
    ultBtn.classList.toggle("armed", armed);
    ultBtn.classList.toggle("off", !asking || (energy < 3 && !armed));
    magicBadge.textContent = magic.length ? String(left) : "🔒";
    magicBtn.classList.toggle("off", !asking || !left);
  }
  // 分支魔法的選單：在技能列旁邊打開，一招一張大卡片；再按一次「魔法」或「不用了」關起來
  magicBtn.onclick = () => {
    const open = wrap.querySelector(".bmenu");
    if (open) { open.remove(); return; }
    if (!magic.length) { say("在學院把一個單元練到 3 星，就會學會那個單元的分支魔法！"); return; }
    if (!cur || cur.done()) return;
    if (!magic.some((b) => !usedMagic.has(b))) { say("分支魔法這場都用過了。"); return; }
    const menu = el("div.bmenu", {},
      ...magic.map((b) => el("button.bmcard", { disabled: usedMagic.has(b), onclick: () => { menu.remove(); castMagic(b); } },
        el("b", {}, BRANCH_MAGIC[b].name), el("span.bmd", {}, BRANCH_MAGIC[b].desc))),
      el("button.bmcard.bmclose", { onclick: () => menu.remove() }, "不用了"));
    wrap.append(menu);
  };
  function castMagic(b) {
    const M = BRANCH_MAGIC[b];
    usedMagic.add(b); sfx("combo");
    if (M.fx === "heal") { hp = Math.min(maxHp(s.lv), hp + 1); drawHud(); say("回復！魔力＋1。"); }
    else if (M.fx === "shield") { flags.shield = true; say("護陣張開了：下一次答錯不扣魔力。"); }
    else if (M.fx === "double") { flags.double = true; say("分身！下一題答對，威力加倍。"); }
    else if (M.fx === "retry") { flags.retry = true; say("回流：這一題答錯可以再選一次。"); }
    else if (M.fx === "cut") { if (!cur.zap()) { usedMagic.delete(b); say("已經沒有可以劈掉的選項了。"); } else say("消去！劈掉了一個錯的選項。"); }
    else if (M.fx === "slow") { if (limit) { cur.slow(); say("慢流：這一題的時間多一倍。"); } else { usedMagic.delete(b); say("這一題本來就不限時喔。"); } }
    else if (M.fx === "hint") say(`預知：${hintOf(cur.q)}`);
    drawSkills();
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
      if (T) {
        stage.monster.hp = stage.monster.maxHp = T.hp ?? 1;
        if (!seenTrait.has(stage.monster.kind)) { seenTrait.add(stage.monster.kind); await talk(wrap, [{ who: "page", name: "頁頁", text: T.line }]); }
      }
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
    if (final && !saidHalf && shieldLeft <= Math.ceil(shield / 2)) { saidHalf = true; await scene([K("……你真的一直算下去？明明那麼多題。"), PG("不會的就去圖書館學，學會了再回來算！我們不會說「算了」。")]); }
    if (final && !saidLast && shieldLeft === 1) { saidLast = true; await scene([K("最後一題……是最早被丟進來的那一題。幾百年來，從來沒有人算完它。"), PG("見習魔數師，就是這一題！")]); }
    // 王的招式（企劃書 E8）：第一階段每三題一次（晃動、墨水霧）；變身後每兩題一次，多一招「調換選項」
    const move = !boss || qi === 0 ? null : phase === 1 ? (qi % 3 === 2 ? (qi % 2 ? "shake" : "ink") : null) : (qi % 2 === 1 ? ["swap", "ink", "shake"][Math.floor(qi / 2) % 3] : null);
    curMove = move;
    bubble.classList.remove("mv-shake", "mv-ink");
    if (move) { sfx("boss"); stage.flinch(); say(move === "shake" ? "墨水大王使出「搖搖晃晃」！題目在晃……穩住！" : move === "swap" ? "墨水大王使出「調換」！選項要換位置了！" : "墨水大王噴出「墨水霧」！等它散開再看清楚。"); }

    wrap.classList.remove("casting");
    // 題目：計算題掛在怪物頭上；應用題放在下方面板
    const isWord = q.kind !== "calc";
    bubble.replaceChildren(isWord ? "？" : mathText(q.text));
    bubble.classList.toggle("one", isWord || q.text.length <= 26);     // 短的算式不換行（不會在「＝ ？」前面斷開）
    wordPanel.hidden = !isWord;
    wordPanel.replaceChildren(...(isWord ? [el("div.wtext", {}, mathText(q.text))] : []));
    speakText = q.text;
    if (s.settings.voice) setTimeout(() => speak(q.text, s.settings.mute), move ? 1700 : 250);
    if (move && move !== "swap") { bubble.classList.add(`mv-${move}`); if (move === "ink") setTimeout(() => bubble.classList.remove("mv-ink"), 1600); }
    if (q.tut) { say(q.tut.text); glow(q.tut.glow); }
    else if (move) {}
    else if (qi === 0 && !isWord && !q.prefix) {}             // 第一題：留著開場說明（練習、挑戰、特訓的說明）
    else if (qi > 0) say("");

    // 完美詠唱：計算題 4 秒、應用題 9 秒內答對（時間條在題目下面）
    const perfectSec = isWord ? 9 : 4;
    const pbar = tut ? null : el("div.pbar", {}, el("div.pfill", { style: { animationDuration: `${perfectSec}s` } }));
    if (pbar) wrap.querySelector(".view").append(pbar);
    const t0 = performance.now();
    const result = await askOne(q);
    pbar?.remove();
    glow(null);
    if (aborted) return;
    const sec = (performance.now() - t0) / 1000;

    const rec = recordAnswer(s, { ...q, targetSec: limit ? limit / 2 : 8 }, result.ok, sec);
    events.push(...rec.events);
    if (rec.exp) { gained += rec.exp; floatText(wrap, `＋${rec.exp} 經驗`, "exp"); }

    if (result.ok) {
      right++; combo++; best = Math.max(best, combo);
      const perfect = !tut && sec <= perfectSec;
      const ult = armed; armed = false;
      const comboTech = !tut && sub && combo % 3 === 0;          // 一般關卡只有 3 題：每連擊 3 下一次
      let tier = ult || comboTech ? 4 : Math.min(4, spellTier(combo) + (perfect ? 1 : 0));
      if (!ult) energy = Math.min(3, energy + 1);
      if (perfect) { floatText(wrap, "完美詠唱！", "exp"); gained += 5; }
      if (tier > spellTier(combo - 1)) setTimeout(() => sfx("combo"), 120);   // 連擊升級（魔法變強）
      sparks += 1 + tier;
      if (flags.double && !boss) { combo++; flags.double = false; say("分身！連擊多加一！"); }
      sfx(`cast_${s.attr}`);
      bubble.textContent = "";
      wrap.classList.add("casting");          // 施法時題目和答案收起來（2026-11-26 使用者）
      if (q.math) {
        // 數學變魔法：先把算式變成光球（點畫面可以加速）
        canvas.onclick = () => stage.magic?.skip();
        await stage.mathMagic(q.math);
        canvas.onclick = null;
      }
      say(ult ? "大招！數晶全部放出去！" : comboTech ? `組合技「${comboName(s.attr, sub)}」！` : perfect ? "完美詠唱！魔法升一級！" : ["", "咒語成立！", "魔法變強了！", "大魔法！", "終極魔法！！"][tier]);
      if (ult || comboTech) { stage.flashC = ATTRS[comboTech ? sub : s.attr].color; stage.flashA = 0.45; stage.flashT = 0.35; }
      await stage.cast(tier, crystalLevel(s.crystals[s.attr]), q.branch, comboTech ? sub : null);
      stage.setPage("happy", 1.6);
      // 答案數字跳出來；選擇題的答案可能是中文（像素字寫不出來），就跳一顆星
      const shown = String(q.answer).replace(/−|－/g, "-");
      stage.popNumber(printable(shown) && shown.length <= 8 ? shown : "!", combo);
      sfx("hit");
      if (boss) {
        shieldLeft--;
        if ((ult || comboTech) && shieldLeft > 1) { shieldLeft--; floatText(wrap, ult ? "大招！多打掉一格護盾" : "組合技！多打掉一格護盾", "exp"); }
        if (flags.double && shieldLeft > 1) { shieldLeft--; flags.double = false; floatText(wrap, "分身！多打掉一格護盾", "exp"); }
        stage.shake = 6;
        if (shieldLeft > 0) stage.flinch();
        if (shieldLeft <= 0) { stage.purify(); if (!s.stars[`${gradeId}-boss`]) { stage.restoreColor(); setTimeout(() => sfx("restore"), 400); s.flags = { ...(s.flags ?? {}), restore: gradeId }; } }
      } else if (mon && mon.hp > 1 && (ult || comboTech)) { mon.hp = 1; stage.purify();        // 大招、組合技：有兩格的怪也一次散開
      } else if (mon && mon.hp > 1) {
        // 還沒散開：答對打掉一格（碎晶蟲＝打破盾）
        mon.hp--; stage.flinch();
        if (trait?.shield && mon.hp === mon.maxHp - 1) { sfx("shatter"); say("水晶盾碎了！再一題！"); } else say(`還要 ${mon.hp} 題！`);
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
      if (!boss && mon && mon.hp > 1) { if (trait?.combo && mon.hp < mon.maxHp) { mon.hp = mon.maxHp; say("散頁怪又黏回去了……再連對兩題！"); } }
      else if (!boss) stage.purify();
      await wait(300);
      if (chal) break;                 // 挑戰模式：答錯就結束
    }
    drawHud();
  }

  if (aborted) return;
  running = false; stopSpeak();
  s.flags = { ...(s.flags ?? {}), seenTrait: [...seenTrait] };
  if (!tut) s.energy = armed ? 3 : energy;          // 按了大招但沒用到：數晶還給你
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

  const firstClear = boss && stars > 0 && !(prevBossStars > 0);
  const missed = [...new Set(qs.slice(0, right + wrong).filter((q) => q.missed).map((q) => q.branch))];
  onEnd({ gradeId, mode, stageIdx, practice, missed, firstClear, newBest, best2: s.challengeBest, stars, passed, right, wrong, best, hp, sparks, gained, coins, ups, events, gentle: hp <= 0 && (s.mood >= 3 || gradeId === "g1" || gradeId === "g2") });

  // ── 一題：等玩家點答案或時間到 ──
  function askOne(q) {
    return new Promise((resolve) => {
      let done = false;
      let start = performance.now();
      answers.replaceChildren(...q.options.map((o, i) => el("button.btn.answer", { "data-k": i + 1, "data-v": o, onclick: (e) => pickOpt(o, e.currentTarget) }, mathText(q.unit && q.kind === "word" ? `${o} ${q.unit}` : o))));
      let btns = [...answers.children];
      // 怪物個性：亂針鐘把選項換位置、塗鴉蝙蝠把一個選項塗黑一下
      if (curTrait?.shuffle || curMove === "swap") setTimeout(() => {
        if (done) return;
        const order = btns.map((b) => [Math.random(), b]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
        if (order.every((b, k) => b === btns[k])) order.push(order.shift());
        answers.classList.add("shuffling"); sfx("tick");
        setTimeout(() => { answers.replaceChildren(...order); btns = order; btns.forEach((b, k) => b.setAttribute("data-k", k + 1)); answers.classList.remove("shuffling"); }, 180);
      }, 1600);
      if (curTrait?.blot) setTimeout(() => {
        if (done) return;
        const b = btns[Math.floor(Math.random() * btns.length)];
        b.classList.add("blot"); sfx("hurt");
        setTimeout(() => b.classList.remove("blot"), 1800);
      }, 900);
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
      cur = { q, zap, slow: () => { if (limit) start += limit * 1000; }, done: () => done };
      drawSkills();
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
        if (!ok && flags.retry) {
          flags.retry = false;
          b.disabled = true; b.classList.add("wrong");
          say("回流！這題可以再選一次，不扣魔力。");
          stage.setPage("worried", 1.6);
          sfx("tick");
          return;
        }
        btns.forEach((x) => { if (x.dataset.v === q.answer) x.classList.add("right"); });
        if (!ok) b.classList.add("wrong");
        finish(ok, false);
      }
      function finish(ok, timeout) {
        if (done) return;
        done = true;
        wrap.querySelector(".bmenu")?.remove(); drawSkills();
        if (timer) clearInterval(timer);
        removeEventListener("keydown", key);
        btns.forEach((x) => (x.disabled = true));
        resolve({ ok, timeout });
      }
    });
  }

  // 教學：讓要按的地方發光
  function glow(what) {
    for (const n of [answers, hud]) n.classList.remove("tutglow");
    if (what === "answers") answers.classList.add("tutglow");
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
