// 學院地圖：選區域（學年）和小關、看成長（企劃書 3、8）、錯題本、成長日記、設定。

import { el, show, mathText } from "../ui.js";
import { ATTRS, GRADES, GRADE_IDS, RANKS, BRANCHES, UNIT_NAME, expToNext, MAX_LV, LEVEL_REWARDS, crystalLevel, maxHp } from "../data.js";
import { rankExamReady, bookChapters, pagePageForm } from "../growth.js";
import { reviewUnits, ACADEMY_OF } from "../practice.js";

export function mapScene(game) {
  const s = game.save;
  const a = ATTRS[s.attr];
  const rank = RANKS[s.rank];
  const need = expToNext(s.lv);
  const nextReward = Object.entries(LEVEL_REWARDS).find(([lv]) => Number(lv) > s.lv);

  const profile = el("div.profile", {},
    el("div.prow", {},
      el("span.rank", {}, rank.name),
      el("span.lv", {}, `Lv ${s.lv}`),
      el("span.attr", { style: { color: a.color } }, `${a.name}・${a.school}`),
      el("span.coins", {}, `${s.coins} 晶幣`)),
    el("div.expbar", {}, el("div.fill", { style: { width: s.lv >= MAX_LV ? "100%" : `${(100 * s.exp) / need}%` } }), el("span", {}, s.lv >= MAX_LV ? "MAX" : `${s.exp} / ${need}`)),
    el("div.prow.small", {},
      el("span", {}, `魔力 ${maxHp(s.lv)}`),
      el("span", {}, `數晶 Lv${crystalLevel(s.crystals[s.attr])}`),
      el("span", {}, `頁頁：${pagePageForm(s)}（萬題之書 ${bookChapters(s)} 章）`)),
    nextReward ? el("div.next", {}, `下一個獎勵：Lv${nextReward[0]} ${nextReward[1]}`) : null,
  );

  const exam = rankExamReady(s)
    ? el("button.btn.gold.examBtn", { onclick: () => game.go("battle", { grade: s.lastGrade ?? "g1", mode: "exam" }) }, `鐘塔亮了！參加升階考核（→ ${RANKS[s.rank + 1].name}）`)
    : null;

  const areas = el("div.areas", {}, ...GRADE_IDS.map((gid) => {
    const g = GRADES[gid];
    const st = [1, 2, 3].map((n) => s.stars[`${gid}-${n}`] ?? 0);
    const bossStars = s.stars[`${gid}-boss`] ?? 0;
    const stageBtn = (n) => {
      const open = n === 1 || st[n - 2] > 0;
      return el("button.btn.stagebtn", { disabled: !open, onclick: () => game.go("battle", { grade: gid, mode: "stage", stage: n - 1 }) },
        `${n}`, el("span.st", {}, "★".repeat(st[n - 1]) + "☆".repeat(3 - st[n - 1])));
    };
    return el("div.area", { style: { "--a": g.sky[1], "--b": g.deep } },
      el("div.aname", {}, g.area, el("span.agrade", {}, g.name), bossStars ? el("span.clear", {}, "已恢復色彩") : null),
      el("div.stages", {}, stageBtn(1), stageBtn(2), stageBtn(3),
        el("button.btn.stagebtn.boss", { disabled: !(st[2] > 0), onclick: () => game.go("battle", { grade: gid, mode: "boss" }) }, "王", el("span.st", {}, "★".repeat(bossStars) + "☆".repeat(3 - bossStars)))),
    );
  }));

  const tools = el("div.tools", {},
    el("button.btn", { onclick: () => reviewPanel(game) }, `錯題本（${Object.keys(s.review).length}）`),
    el("button.btn", { onclick: () => growthPanel(game) }, "成長日記"),
    el("button.btn", { onclick: () => { if (confirm("回共鳴之井重新測驗？等級、星星、錯題本都會保留。")) game.go("resonance", { retest: true }); } }, "共鳴之井"),
    el("button.btn", { onclick: () => game.go("settings", { from: "map" }) }, "設定"),
  );

  show(el("div.screen.map", {}, el("h2.maptitle", {}, "魔數學院"), profile, exam, areas, tools));
}

function panel(title, ...body) {
  const p = el("div.panel", {}, el("div.ptitle", {}, title), ...body, el("button.btn.gold", { onclick: () => p.remove() }, "關閉"));
  document.querySelector("#app").append(p);
}

export function reviewPanel(game) {
  const r = Object.entries(game.save.review);
  panel("錯題本：還沒算完的題目",
    r.length ? el("ul.list", {}, ...r.map(([k, v]) => el("li", {}, mathText(`${GRADES[v.grade]?.area ?? ""}｜${v.sample}`), el("span.left", {}, `再連對 ${v.left} 次就畢業`),
      v.branch && v.branch in UNIT_NAME ? el("button.btn.small", { onclick: () => { document.querySelector(".panel")?.remove(); game.go("lesson", { branch: v.branch }); } }, "學一學") : null))) : el("p", {}, "目前沒有。太厲害了！"),
    reviewUnits(game.save).length ? el("button.btn.gold", { onclick: () => { document.querySelector(".panel")?.remove(); const [b] = reviewUnits(game.save)[0]; game.go("battle", { grade: "g1", mode: "practice", practice: { academy: ACADEMY_OF[b] ?? "ice", branch: b, level: 0, review: true } }); } }, "特訓") : null);
}

export function growthPanel(game) {
  const s = game.save;
  // 最近 30 天（企劃書 E7）：沒玩的日子也排出來（空的一格），一眼看出有沒有每天練
  const days = Array.from({ length: 30 }, (_, i) => { const d = new Date(Date.now() - (29 - i) * 864e5).toISOString().slice(0, 10); return [d, s.diary[d] ?? { n: 0, ok: 0 }]; });
  const played = days.filter(([, v]) => v.n).length, total = days.reduce((a, [, v]) => a + v.ok, 0);
  const most = Math.max(1, ...days.map(([, v]) => v.n));
  panel("成長日記",
    el("div.sub", {}, "魔法分支熟練度（看最近 20 題）"),
    el("ul.list", {}, ...Object.entries(BRANCHES).map(([k, name]) => {
      const b = s.branches[k];
      return el("li", {}, name, el("span.left", {}, b.recent.length ? `${"★".repeat(b.best)}${"☆".repeat(5 - b.best)}（${b.recent.length} 題）` : "還沒練過"));
    })),
    el("div.sub", {}, `最近 30 天：練了 ${played} 天、答對 ${total} 題`),
    el("div.bars.b30", {}, ...days.map(([d, v], i) => el("div.bar", { title: `${d}：答對 ${v.ok}／${v.n} 題` },
      el("div.b", { style: { height: `${v.n ? Math.max(8, (100 * v.n) / most) : 0}%` } }, el("div.bok", { style: { height: v.n ? `${(100 * v.ok) / v.n}%` : "0" } })),
      el("span", {}, i % 5 === 4 || i === 29 ? d.slice(8) : "")))),
    );
}
