// 學院裡面（企劃書 v1.2）：每座學院教中年級的兩個單元，每個單元有簡單、困難兩種模式。點模式＝進去練習（打那座學院的墨水怪）；
// 「學一學」＝去圖書館的魔法教室看重點和例題。
// 背景：那座學院的原圖放大在左邊，右邊是練習清單。學院內部還沒有專用的美術，先用戰鬥背景原圖（調淡）當底。

import { el, show } from "../ui.js";
import { sfx } from "../audio.js";
import { UNIT_NAME, LENGTHS } from "../data.js";
import { ACADEMIES, MODES } from "../practice.js";
import { writeSave } from "../save.js";

const A = (p) => new URL(`../../assets/${p}`, import.meta.url).href;

export function academyScene(game, { academy = "fire" } = {}) {
  const s = game.save, AC = ACADEMIES[academy];
  const stars = (b, l) => s.practice?.[`${b}-${l}`] ?? 0;
  // 題數：3、5、10 題（2026-11-25 使用者），記住上次選的
  let len = LENGTHS.includes(s.pracLen) ? s.pracLen : 3;
  const lenRow = el("div.aclen", {}, el("span", {}, "題數"), ...LENGTHS.map((n) => el("button.btn.small" + (n === len ? ".on" : ""), {
    onclick: (e) => { sfx("click"); len = s.pracLen = n; writeSave(s); lenRow.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === e.currentTarget)); } }, `${n} 題`)));
  const card = (b) => {
    // 簡單、困難兩種模式都可以直接選
    const lv = MODES.map((M, i) => {
      const st = stars(b, i);
      return el("button.btn.aclv" + (M.hard ? ".hard" : ""), {
        onclick: () => { sfx("click"); s.returnTo = { scene: "academy", academy }; writeSave(s); game.go("battle", { grade: M.grade, mode: "practice", practice: { academy, branch: b, level: i, count: len } }); },
      }, el("span.acn", {}, M.name), el("span.acs", {}, "★".repeat(st) + "☆".repeat(3 - st)));
    });
    return el("div.accard", {},
      el("div.actitle", {}, UNIT_NAME[b]),
      el("div.aclvs", {}, ...lv),
      el("button.btn.small.aclearn", { onclick: () => { sfx("click"); game.go("lesson", { branch: b, back: { scene: "academy", academy } }); } }, "學一學"));
  };
  const root = el("div.screen.acscr", {},
    el("div.acbg", { style: { backgroundImage: `url(${A(`battle-hd/${AC.area}/back.jpg`)})` } }),
    el("img.acbuild", { src: A(`hub/${AC.art}`), alt: AC.name }),
    el("div.acpanel", {},
      el("h2.acname", {}, AC.name, el("span.acschool", {}, AC.place)),
      lenRow,
      ...AC.branches.map(card)),
    el("button.btn.small.acback", { onclick: () => { sfx("click"); game.go("map", { from: academy }); } }, "回學院大廳"));
  show(root);
}
