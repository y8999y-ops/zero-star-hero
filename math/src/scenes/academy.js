// 學院裡面（企劃書 v1.2）：每座學院教中年級的兩個單元，每個單元有簡單、困難兩種模式。點模式＝進去練習（打那座學院的墨水怪）；
// 「學一學」＝去圖書館的魔法教室看重點和例題。
// 背景：那座學院的原圖放大在左邊，右邊是練習清單。學院內部還沒有專用的美術，先用戰鬥背景原圖（調淡）當底。

import { el, show } from "../ui.js";
import { sfx } from "../audio.js";
import { UNIT_NAME, LENGTHS, LEN_NAME } from "../data.js";
import { ACADEMIES, unitStars } from "../practice.js";
import { writeSave } from "../save.js";

const A = (p) => new URL(`../../assets/${p}`, import.meta.url).href;

export function academyScene(game, { academy = "fire" } = {}) {
  const s = game.save, AC = ACADEMIES[academy];

  // 題數：3、5、10 題（2026-11-25 使用者），記住上次選的
  let len = LENGTHS.includes(s.pracLen) ? s.pracLen : 3;
  const lenRow = el("div.aclen", {}, el("span", {}, "訓練"), ...LENGTHS.map((n) => el("button.btn.small" + (n === len ? ".on" : ""), {
    onclick: (e) => { sfx("click"); len = s.pracLen = n; writeSave(s); lenRow.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === e.currentTarget)); } }, LEN_NAME[n])));
  const card = (b) => {
    // 2026-11-26 使用者：簡單與困難合併成一關（題目由易到難）
    const st = unitStars(s, b);
    const lv = [el("button.btn.aclv", {
      onclick: () => { sfx("click"); s.returnTo = { scene: "academy", academy }; writeSave(s); game.go("battle", { grade: "g1", mode: "practice", practice: { academy, branch: b, level: 0, count: len } }); },
    }, el("span.acn", {}, "開始訓練"), el("span.acs", {}, "★".repeat(st) + "☆".repeat(3 - st)))];
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
