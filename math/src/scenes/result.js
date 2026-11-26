// 結算：星星、經驗、升級、成長事件（企劃書 7.7、8）。

import { el, show, mathText } from "../ui.js";
import { BRANCHES, UNIT_NAME, LEVEL_REWARDS, GRADES } from "../data.js";
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
        r.wrongs?.length ? el("button.btn", { onclick: () => { sfx("click"); wrongPanel(game, r, learn); } }, "錯題講解", el("span.cnt", {}, String(r.wrongs.length))) : null,
        learn ? el("button.btn", { onclick: () => { game.save.returnTo = null; game.go("lesson", { branch: learn }); } }, "去學一學") : null,
        r.firstClear && r.gradeId === "jh"
          ? el("button.btn.gold", { onclick: () => { game.save.returnTo = null; game.go("ending"); } }, "繼續")       // 最終戰打完：接結局
          : el("button.btn.gold", { onclick: () => { if (r.practice?.review) game.save.returnTo = null; game.go(r.practice?.review ? "library" : "map"); } }, r.practice?.review ? "回圖書館" : r.mode === "practice" ? `回${ACADEMIES[r.practice.academy].name}` : "回去"))),
  ));
}

// 錯題講解（2026-11-26 使用者：戰鬥中不直接跳出來，戰鬥結束後可以查看）：這場答錯的每一題＋你選的＋答案＋講解
function wrongPanel(game, r) {
  document.querySelector("#app .panel.wrongs")?.remove();
  const u = (w) => (w.unit ? " " + w.unit : "");
  const p = el("div.panel.wrongs", {},
    el("div.wh", {}, el("b", {}, "錯題講解"), el("button.pclose", { "aria-label": "關閉", onclick: () => { sfx("click"); p.remove(); } }, "✕")),
    ...r.wrongs.map((w) => el("div.wcard", {},
      el("div.wq", {}, mathText(w.text)),
      el("div.wpick", {}, w.timeout || w.pick == null ? "時間到了，沒有選" : mathText(`你選了 ${w.pick}${u(w)}`)),
      el("div.wans", {}, mathText(`答案是 ${w.answer}${u(w)}`)),
      w.explain ? el("div.wexp", {}, mathText(String(w.explain))) : null,
      w.branch && UNIT_NAME[w.branch] ? el("button.btn.small", { onclick: () => { game.save.returnTo = null; game.go("lesson", { branch: w.branch }); } }, "去學一學") : null)));
  document.querySelector("#app").append(p);
}
