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
  const again = r.mode === "challenge" ? { grade: "g34", mode: "challenge" } : r.mode === "practice" ? { grade: r.gradeId, mode: "practice", practice: r.practice } : r.mode === "boss" ? { grade: r.gradeId, mode: "boss" } : r.mode === "exam" ? { grade: r.gradeId, mode: "exam" } : { grade: r.gradeId, mode: "stage", stage: r.stageIdx };
  show(el("div.screen.result", {},
    el("div.rescard", {},
      el("h2.restitle", {}, title),
      r.mode !== "exam" && r.mode !== "challenge" && r.hp > 0 ? el("div.bigstars", {}, "★".repeat(r.stars) + "☆".repeat(3 - r.stars)) : null,
      el("div.resstats", {}, ...stats.map(([v, k]) => el("div.resstat", {}, el("b", {}, String(v)), el("span", {}, k)))),
      tags.length ? el("div.restags", {}, ...tags.slice(0, 3).map((t) => el("span", {}, t))) : null,
      el("div.resbtns", {},
        r.wrongs?.length ? el("button.btn", { onclick: () => { sfx("click"); wrongPanel(game, r); } }, "錯題講解", el("span.cnt", {}, String(r.wrongs.length))) : null,
        ...endButtons(game, r, again))),
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

// 結算的按鈕（2026-11-26 使用者：改成「完成」與「下一關」）
//   完成＝回到進來的地方（區域、學院；錯題特訓回圖書館）
//   下一關：主線＝同一區的下一關 → 王 → 下一區第 1 關；學院＝同一座學院的下一個單元 → 下一座學院；沒過關（或挑戰、考核沒通過）就變成「再挑戰」
const ORDER = Object.keys(GRADES);
function nextOf(game, r) {
  const s = game.save, failed = r.hp <= 0 || (r.mode !== "challenge" && r.mode !== "exam" && !r.stars) || (r.mode === "exam" && !r.passed);
  if (r.mode === "challenge" || failed) return { label: "再挑戰" };
  if (r.mode === "practice") {
    if (r.practice.review) return null;
    const all = Object.entries(ACADEMIES).flatMap(([id, A]) => A.branches.map((b) => [id, b]));
    const k = all.findIndex(([, b]) => b === r.practice.branch), nx = all[k + 1];
    if (!nx) return null;
    return { label: "下一關", go: () => { s.returnTo = { scene: "academy", academy: nx[0] }; game.go("battle", { grade: r.gradeId, mode: "practice", practice: { ...r.practice, academy: nx[0], branch: nx[1] } }); } };
  }
  if (r.mode === "exam") return null;
  const g = r.gradeId, cleared = [1, 2, 3].map((n) => s.stars[`${g}-${n}`] ?? 0);
  const othersLeft = g === "jh" ? ["g1", "g2", "g34", "g56"].filter((x) => !(s.stars[`${x}-boss`] > 0)) : [];
  const stageGo = (grade, stage) => () => { s.returnTo = { scene: "area", grade }; game.go("battle", { grade, mode: "stage", stage }); };
  if (r.mode === "stage") {
    const todo = [0, 1, 2].find((i) => i > r.stageIdx && !cleared[i]) ?? [0, 1, 2].find((i) => !cleared[i]);
    if (todo != null) return { label: "下一關", go: stageGo(g, todo) };
    if (r.stageIdx < 2) return { label: "下一關", go: stageGo(g, r.stageIdx + 1) };
    if (othersLeft.length) return null;           // 總複習的王：要先打倒其他區域的王
    return { label: "下一關", go: () => { s.returnTo = { scene: "area", grade: g }; game.go("battle", { grade: g, mode: "boss" }); } };
  }
  // 打倒王：下一區第 1 關（最後一區沒有下一區）
  const ng = ORDER[ORDER.indexOf(g) + 1];
  return ng ? { label: "下一關", go: stageGo(ng, 0) } : null;
}
function endButtons(game, r, again) {
  if (r.firstClear && r.gradeId === "jh") return [el("button.btn.gold", { onclick: () => { game.save.returnTo = null; game.go("ending"); } }, "繼續")];   // 最終戰打完：接結局
  const finish = () => { sfx("click"); if (r.practice?.review) game.save.returnTo = null; game.go(r.practice?.review ? "library" : "map"); };
  const nx = nextOf(game, r);
  if (!nx) return [el("button.btn.gold", { onclick: finish }, "完成")];
  return [el("button.btn", { onclick: finish }, "完成"), el("button.btn.gold", { onclick: () => { sfx("click"); (nx.go ?? (() => game.go("battle", again)))(); } }, nx.label)];
}
