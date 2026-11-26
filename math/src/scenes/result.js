// 結算：星星、經驗、升級、成長事件（企劃書 7.7、8）。

import { el, show } from "../ui.js";
import { BRANCHES, UNIT_NAME, LEVEL_REWARDS, GRADES } from "../data.js";
import { MODES } from "../practice.js";
import { BRANCH_MAGIC } from "../battle/branch-magic.js";
import { sfx } from "../audio.js";
import { ACADEMIES } from "../practice.js";

export function resultScene(game, r) {
  const g = GRADES[r.gradeId];
  const title = r.mode === "challenge" ? `挑戰模式：連對 ${r.right} 題！` : r.mode === "exam"
    ? (r.passed ? "升階考核通過！" : "這次差一點點！")
    : r.hp <= 0 ? (r.gentle ? "休息一下" : "魔力耗盡") : r.mode === "boss" ? `${g.area}恢復色彩了！` : r.mode === "practice" ? (r.practice.review ? "錯題本特訓完成！" : `${UNIT_NAME[r.practice.branch]}練習完成！`) : "過關！";
  // 2026-11-25 使用者：結算要精簡乾淨、一頁看完不用上下翻 → 一張卡：標題、星星、一排數字、一排小標籤、按鈕
  const stats = r.mode === "challenge" ? [[r.right, "連對"], [r.newBest ? "新紀錄" : r.best2, "最高"]]
    : r.mode === "exam" ? [[`${r.right}/7`, "答對"]]
    : [[`${r.right}/${r.right + r.wrong}`, "答對"], [r.best, "連擊"]];
  stats.push([`＋${r.gained}`, "經驗"], [`＋${r.coins}`, "晶幣"]);
  const tags = [];
  if (r.ups.length) { const rw = r.ups.map((lv) => LEVEL_REWARDS[lv]).filter(Boolean); tags.push(`升到 Lv${r.ups.at(-1)}${rw.length ? "・" + rw.join("、") : ""}`); }
  for (const e of r.events) {
    if (e.kind === "branchStar" && e.stars === 3) tags.push(`學會「${BRANCH_MAGIC[e.branch]?.name ?? ""}」`);
    else if (e.kind === "branchStar" && e.stars === 5) tags.push(`${UNIT_NAME[e.branch] ?? BRANCHES[e.branch] ?? ""}精通`);
    if (e.kind === "crystal") tags.push(`數晶 Lv${e.lv}`);
  }
  if (r.mode === "exam" && r.passed) tags.push("升階！");
  if (r.ups.length) sfx("level"); else sfx("good");
  const learn = r.missed?.find((b) => UNIT_NAME[b]);
  const again = r.mode === "challenge" ? { grade: "g34", mode: "challenge" } : r.mode === "practice" ? { grade: r.gradeId, mode: "practice", practice: r.practice } : r.mode === "boss" ? { grade: r.gradeId, mode: "boss" } : r.mode === "exam" ? { grade: r.gradeId, mode: "exam" } : { grade: r.gradeId, mode: "stage", stage: r.stageIdx };
  show(el("div.screen.result", {},
    el("div.rescard", {},
      el("h2.restitle", {}, title),
      r.mode !== "exam" && r.mode !== "challenge" && r.hp > 0 ? el("div.bigstars", {}, "★".repeat(r.stars) + "☆".repeat(3 - r.stars)) : null,
      el("div.resstats", {}, ...stats.map(([v, k]) => el("div.resstat", {}, el("b", {}, String(v)), el("span", {}, k)))),
      tags.length ? el("div.restags", {}, ...tags.slice(0, 3).map((t) => el("span", {}, t))) : null,
      el("div.resbtns", {},
        el("button.btn", { onclick: () => game.go("battle", again) }, "再一次"),
        learn ? el("button.btn", { onclick: () => { game.save.returnTo = null; game.go("lesson", { branch: learn }); } }, `去學${UNIT_NAME[learn]}`) : null,
        r.firstClear && r.gradeId === "jh"
          ? el("button.btn.gold", { onclick: () => { game.save.returnTo = null; game.go("ending"); } }, "繼續")       // 最終戰打完：接結局
          : el("button.btn.gold", { onclick: () => { if (r.practice?.review) game.save.returnTo = null; game.go(r.practice?.review ? "library" : "map"); } }, r.practice?.review ? "回圖書館" : r.mode === "practice" ? `回${ACADEMIES[r.practice.academy].name}` : "回去"))),
  ));
}
