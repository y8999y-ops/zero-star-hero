// 共鳴儀式（企劃書第 4 節）：10 題情境題 → 屬性；同分補問一題；心情題決定照顧程度。

import { el, show } from "../ui.js";
import { ATTRS, ATTR_IDS } from "../data.js";
import { writeSave } from "../save.js";
import { sfx } from "../audio.js";
import { Stage, fitWidth } from "../battle/stage.js";

let data = null;
async function load() {
  data ??= await (await fetch(new URL("../../data/quiz/resonance.json", import.meta.url))).json();
  return data;
}

export async function resonanceScene(game, { retest = false } = {}) {
  const d = await load();
  const score = Object.fromEntries(ATTR_IDS.map((a) => [a, 0]));
  let mood = 0;
  const root = el("div.screen.well");
  show(root);

  for (let i = 0; i < d.questions.length; i++) {
    const q = d.questions[i];
    // 屬性題的選項每次打亂順序：不然固定第一個是火、最後一個是雷，習慣選第一個的小朋友幾乎都會變成火（tools/sim-resonance.mjs）
    const order = q.kind === "style" ? shuffle(q.options.map((_, k) => k)) : q.options.map((_, k) => k);
    const pick = order[await ask(root, `${i + 1} / ${d.questions.length}`, q.q, order.map((k) => q.options[k].t))];
    const o = q.options[pick];
    if (q.kind === "style") for (const a of o.attrs) score[a] += 2;
    else mood = Math.max(mood, o.level);
  }

  const top = Math.max(...Object.values(score));
  let tied = ATTR_IDS.filter((a) => score[a] === top);
  if (tied.length > 1) {
    shuffle(tied);
    const pick = await ask(root, "最後一題", d.tiebreak.q, tied.map((a) => d.tiebreak.options[a]));
    tied = [tied[pick]];
  }
  const attr = tied[0];
  game.save.attr = attr;
  game.save.mood = mood;
  writeSave(game.save);
  await reveal(root, attr, mood);
  if (retest || game.save.seenIntro) game.go("map");
  else game.go("afterResonance");
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function ask(root, step, question, options) {
  return new Promise((res) => {
    root.replaceChildren(
      el("div.wellhead", {}, "共鳴之井"),
      el("div.step", {}, step),
      el("div.wq", {}, question),
      el("div.hintline", {}, "頁頁：「沒有對錯，選你真的會做的就好。」"),
      el("div.wopts", {}, ...options.map((t, i) => el("button.btn.opt", { onclick: () => { sfx("click"); res(i); } }, t))),
    );
  });
}

function reveal(root, attr, mood) {
  const a = ATTRS[attr];
  return new Promise((res) => {
    const canvas = el("canvas.stage.small");
    root.replaceChildren(...[
      el("div.wellhead", {}, "數晶亮了！"),
      el("div.crystal", { style: { "--c": a.color } }),
      el("h2", { style: { color: a.color } }, `${a.name}屬性・${a.school}`),
      el("div.type", {}, `你是「${a.type}」`),
      el("p", {}, a.praise),
      el("p.ability", {}, `學系能力：${a.ability}——${a.abilityDesc}`),
      canvas,
      el("p.note", {}, "每一種屬性都是好的數學腦。想換的話，之後可以回共鳴之井重新測。"),
      mood >= 2 ? el("p.note", {}, "頁頁：「放輕鬆，我們慢慢來。」（已幫你把限時調寬鬆）") : null,
      el("button.btn.gold.big", { onclick: () => { running = false; res(); } }, "好！"),
    ].filter(Boolean));
    // 示範一次第二級魔法
    fitWidth(16 / 9);
    const st = new Stage(canvas, "g1", "girl", attr);
    st.gray = 0;
    st.spawn();
    st.monster.x = 270;
    let running = true, last = performance.now(), next = 0.6;
    const loop = (now) => {
      if (!running) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      next -= dt;
      if (next <= 0) {
        next = 3.2;
        if (!st.monster) { st.spawn(); st.monster.x = 270; }
        st.cast(2).then(() => st.purify());
      }
      st.update(dt); st.draw();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
}
