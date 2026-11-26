// 共鳴儀式（企劃書第 4 節）。2026-11-25 使用者：改成五題、做動畫和介面融入（原本直接跳出一頁字太生硬）。
// 在共鳴之井前演出（用劇情播放器 src/cutscene.js）：
//   新生站上井邊、鏡頭推近 → 每一題：井水冒出光點、題目從井裡浮上來（對話框＋選項）→ 選了之後光點落進井裡、上面的五顆小光亮一顆
//   → 五題答完：井水旋轉發光 → 數晶從井裡升起、閃出屬性色 → 告訴你是什麼屬性、會打出哪些魔法
// 題目：data/quiz/resonance.json 的 use（4 題思考方式＋1 題心情）；同分補問一題。tools/sim-resonance.mjs 確認五種屬性各約 20%。

import { el } from "../ui.js";
import { ATTRS, ATTR_IDS } from "../data.js";
import { writeSave } from "../save.js";
import { sfx } from "../audio.js";
import { playCutscene } from "../cutscene.js";
import { plaza, GY } from "./story.js";
import { heroWalkFrame } from "../../fx/hero-walk.js";
import { pagepageFrame } from "../../fx/pagepage.js";

let data = null;
async function load() {
  data ??= await (await fetch(new URL("../../data/quiz/resonance.json", import.meta.url))).json();
  return data;
}
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export async function resonanceScene(game, { retest = false } = {}) {
  const d = await load(), s = game.save;
  const qs = (d.use ?? d.questions.map((_, i) => i)).map((i) => d.questions[i]);
  const score = Object.fromEntries(ATTR_IDS.map((a) => [a, 0]));
  let mood = 0, attr = null;
  await playCutscene(async (D) => {
    const root = document.querySelector(".csscr");
    await plaza(D);
    const me = D.sprite((t) => heroWalkFrame(s.look ?? "girl", "down", "idle", t, "#8a7cff"), { x: 150, y: GY + 14, z: 6, px: 1.3 });
    const page = retest ? null : D.sprite((t) => pagepageFrame("idle", t), { x: 120, y: GY - 34, z: 7, px: 1.5 }).bob(2, 3);
    await me.to({ x: 192, y: GY + 12 }, 1.2);
    await D.wait(0.4);
    // 上面的五顆小光（進度）
    const lights = el("div.resprog", {}, ...qs.map(() => el("span")));
    root.append(lights);
    if (page) await D.say([{ who: "page", name: "頁頁", text: "井水會問你五個問題。沒有對錯，選你真的會做的就好！" }]);
    for (let i = 0; i < qs.length; i++) {
      const q = qs[i];
      sfx("blip"); D.fx("rise", 192, GY - 10, 24, "#bfe8ff");
      // 屬性題的選項每次打亂（不然固定第一個是火，習慣選第一個的小朋友都會變成火）
      const order = q.kind === "style" ? shuffle(q.options.map((_, k) => k)) : q.options.map((_, k) => k);
      const r = await D.say([{ who: null, name: `共鳴之井　${i + 1} / ${qs.length}`, text: q.q }], order.map((k) => q.options[k].t));
      const o = q.options[order[r ?? 0]];
      if (q.kind === "style") for (const a of o.attrs) score[a] += 2; else mood = Math.max(mood, o.level);
      // 選了：光點落進井裡，亮一顆小光
      sfx("good"); D.fx("burst", 192, GY - 24, 14, "#fff3b0");
      lights.children[i].classList.add("on");
      await D.wait(0.5);
    }
    // 同分：再問一題
    const top = Math.max(...Object.values(score));
    let tied = ATTR_IDS.filter((a) => score[a] === top);
    if (tied.length > 1) {
      shuffle(tied);
      const r = await D.say([{ who: null, name: "共鳴之井　最後一題", text: d.tiebreak.q }], tied.map((a) => d.tiebreak.options[a]));
      tied = [tied[r ?? 0]];
    }
    attr = tied[0];
    const A = ATTRS[attr];
    s.attr = attr; s.mood = mood; writeSave(s);
    // 井水旋轉發光 → 數晶升起、閃出屬性色
    lights.remove();
    sfx("restore");
    for (let k = 0; k < 3; k++) { D.fx("rise", 192, GY - 10, 30, A.color); D.shake(2, 0.3); await D.wait(0.4); }
    const crystal = D.img("hub/p/crystal.png", { x: 192, y: GY - 20, h: 30, z: 8, scale: 0.3, alpha: 0 });
    crystal.node.style.filter = `drop-shadow(0 0 8px ${A.color}) drop-shadow(0 0 16px ${A.color})`;
    await crystal.to({ y: GY - 70, scale: 1.4, alpha: 1 }, 1.2, "out");
    crystal.bob(2, 2.5);
    sfx("level"); D.flash(A.color, 0.9); D.fx("burst", 192, GY - 90, 40, A.color); D.fx("sparkle", 192, GY - 80, 30);
    me.node.style.filter = `drop-shadow(0 0 6px ${A.color})`;
    await D.wait(0.8);
    await D.say([{ who: null, name: `${A.name}屬性・${A.school}`, text: `你是「${A.type}」。${A.praise}` },
      { who: null, name: `${A.school}的魔法`, text: `${A.spells}……每次答對都不太一樣，連擊越高越華麗！` },
      ...(mood >= 2 ? [{ who: "page", name: "頁頁", text: "放輕鬆，我們慢慢來。" }] : [])]);
    void page;
  }, { skippable: false });
  if (retest || s.seenIntro) game.go("map", { from: "well" });
  else game.go("afterResonance");
}
