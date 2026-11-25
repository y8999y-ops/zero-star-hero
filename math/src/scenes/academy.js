// 學院裡面（企劃書 v1.1）：每座學院教兩種數學魔法，每種三個等級。點等級＝進去練習（打那座學院的墨水怪）；
// 「學一學」＝去圖書館的魔法教室看重點和例題。等級要照順序開（前一級拿到星星才開下一級）。
// 背景：那座學院的原圖放大在左邊，右邊是練習清單。學院內部還沒有專用的美術，先用戰鬥背景原圖（調淡）當底。

import { el, show } from "../ui.js";
import { sfx } from "../audio.js";
import { BRANCHES } from "../data.js";
import { ACADEMIES, LEVELS } from "../practice.js";
import { writeSave } from "../save.js";

const A = (p) => new URL(`../../assets/${p}`, import.meta.url).href;

export function academyScene(game, { academy = "fire" } = {}) {
  const s = game.save, AC = ACADEMIES[academy];
  const stars = (b, l) => s.practice?.[`${b}-${l}`] ?? 0;
  const card = (b) => {
    const lv = LEVELS[b].map((L, i) => {
      const open = i === 0 || stars(b, i - 1) > 0, st = stars(b, i);
      return el("button.btn.aclv" + (open ? "" : ".locked"), {
        disabled: !open,
        onclick: () => { sfx("click"); s.returnTo = { scene: "academy", academy }; writeSave(s); game.go("battle", { grade: L.grade, mode: "practice", practice: { academy, branch: b, level: i } }); },
      }, el("span.acn", {}, `${i + 1}．${L.name}`), el("span.acs", {}, open ? "★".repeat(st) + "☆".repeat(3 - st) : "🔒"));
    });
    return el("div.accard", {},
      el("div.actitle", {}, BRANCHES[b]),
      el("div.aclvs", {}, ...lv),
      el("button.btn.small.aclearn", { onclick: () => { sfx("click"); game.go("lesson", { branch: b, back: { scene: "academy", academy } }); } }, "不會的時候：去圖書館學一學"));
  };
  const root = el("div.screen.acscr", {},
    el("div.acbg", { style: { backgroundImage: `url(${A(`battle-hd/${AC.area}/back.jpg`)})` } }),
    el("img.acbuild", { src: A(`hub/${AC.art}`), alt: AC.name }),
    el("div.acpanel", {},
      el("h2.acname", {}, AC.name, el("span.acschool", {}, AC.school)),
      el("p.acdesc", {}, AC.desc),
      ...AC.branches.map(card)),
    el("button.btn.small.acback", { onclick: () => { sfx("click"); game.go("map", { from: academy }); } }, "回學院"));
  show(root);
}
