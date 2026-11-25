// 結算：星星、經驗、升級、成長事件（企劃書 7.7、8）。

import { el, show } from "../ui.js";
import { BRANCHES, LEVEL_REWARDS, GRADES } from "../data.js";
import { sfx } from "../audio.js";
import { ACADEMIES } from "../practice.js";

export function resultScene(game, r) {
  const g = GRADES[r.gradeId];
  const title = r.mode === "exam"
    ? (r.passed ? "升階考核通過！" : "這次差一點點！")
    : r.hp <= 0 ? (r.gentle ? "休息一下" : "魔力耗盡") : r.mode === "boss" ? `${g.area}恢復色彩了！` : r.mode === "practice" ? `${BRANCHES[r.practice.branch]}練習完成！` : "過關！";
  const lines = [];
  if (r.mode === "exam") lines.push(`答對 ${r.right} 題（要 7 題）`, r.passed ? "你的徽章換新了！" : "沒關係，隨時可以再考。");
  else {
    lines.push(`答對 ${r.right} 題、答錯 ${r.wrong} 題、最高連擊 ${r.best}`);
    if (r.hp <= 0) lines.push(r.gentle ? "頁頁：「我們換簡單一點的再試一次吧！」" : "頁頁：「沒關係，再試一次就好，進度都還在！」");
  }
  lines.push(`＋${r.gained} 經驗、＋${r.coins} 晶幣、靈感星 ${r.sparks} 顆`);
  for (const lv of r.ups) lines.push(`升到 Lv${lv}！${LEVEL_REWARDS[lv] ? "獲得：" + LEVEL_REWARDS[lv] : "＋20 晶幣"}`);
  for (const e of r.events) {
    if (e.kind === "branchStar") lines.push(`${BRANCHES[e.branch]} 熟練度 ${"★".repeat(e.stars)}${e.stars === 3 ? "：學會分支魔法！" : e.stars === 5 ? "：精通！萬題之書恢復一章！" : ""}`);
    if (e.kind === "crystal") lines.push(`數晶升到 Lv${e.lv}，魔法變得更亮了！`);
  }
  if (r.ups.length) sfx("level"); else sfx("good");

  // 答錯的題目：可以去圖書館的魔法教室學（企劃書 v1.1）
  if (r.missed?.length) lines.push(`不太會的：${r.missed.map((b) => BRANCHES[b]).join("、")}——可以去千頁圖書館的「魔法教室」學一學。`);
  const again = r.mode === "practice" ? { grade: r.gradeId, mode: "practice", practice: r.practice } : r.mode === "boss" ? { grade: r.gradeId, mode: "boss" } : r.mode === "exam" ? { grade: r.gradeId, mode: "exam" } : { grade: r.gradeId, mode: "stage", stage: r.stageIdx };
  show(el("div.screen.result", {},
    el("h2", {}, title),
    r.mode !== "exam" && r.hp > 0 ? el("div.bigstars", {}, "★".repeat(r.stars) + "☆".repeat(3 - r.stars)) : null,
    el("ul.list", {}, ...lines.map((t) => el("li", {}, t))),
    el("div.row", {},
      el("button.btn", { onclick: () => game.go("battle", again) }, "再一次"),
      r.missed?.length ? el("button.btn", { onclick: () => { game.save.returnTo = null; game.go("lesson", { branch: r.missed[0] }); } }, "去圖書館學") : null,
      el("button.btn.gold", { onclick: () => game.go("map") }, r.mode === "practice" ? `回${ACADEMIES[r.practice.academy].name}` : "回去")),
  ));
}
