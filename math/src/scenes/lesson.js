// 千頁圖書館・魔法教室（企劃書 v1.1：遇到不會的題目，可以到圖書館學）。
// lessonList：十種數學魔法，答錯過的（錯題本裡有的）排前面、標「要複習」。
// lessonScene：一種魔法的 3 個重點 → 例題（先自己想，再按「看算法」）→ 試三題（答錯會跳出算法）。
// 學完一課算每日委託「在圖書館學一課」。

import { daily } from "../world/island-life.js";
import { el, show, mathText } from "../ui.js";
import { sfx } from "../audio.js";
import { UNIT_NAME } from "../data.js";
import { LESSONS, lessonExamples, ACADEMIES, ACADEMY_OF } from "../practice.js";
import { writeSave } from "../save.js";

const backTo = (game, back) => (back?.scene === "academy" ? game.go("academy", { academy: back.academy }) : game.go("library"));

export function lessonList(game) {
  const s = game.save;
  const weak = new Set(Object.values(s.review ?? {}).map((r) => r.branch).filter(Boolean));
  const ids = Object.keys(UNIT_NAME).sort((a, b) => weak.has(b) - weak.has(a));
  show(el("div.screen.lessons", {},
    el("h2", {}, "魔法教室"),
    el("div.lgrid", {}, ...ids.map((b) => el("button.btn.lbtn", { onclick: () => { sfx("click"); game.go("lesson", { branch: b }); } },
      el("span.ln", {}, UNIT_NAME[b]), el("span.la", {}, ACADEMIES[ACADEMY_OF[b]].name), weak.has(b) ? el("span.lweak", {}, "要複習") : null))),
    el("button.btn.gold", { onclick: () => game.go("library") }, "回圖書館大廳")));
}

export async function lessonScene(game, { branch = "big", back = null } = {}) {
  if (!LESSONS[branch]) branch = "big";             // 舊存檔的錯題本可能是舊的分類
  const s = game.save, L = LESSONS[branch];
  const qs = await lessonExamples(branch);
  const [ex, ...tries] = qs;
  const body = el("div.lbody");
  const root = el("div.screen.lesson", {},
    el("h2", {}, `魔法教室・${UNIT_NAME[branch]}`),
    el("ol.lpoints", {}, ...L.points.map((t) => el("li", {}, mathText(t)))),
    body,
    el("div.row", {},
      el("button.btn", { onclick: () => game.go("lesson", { branch, back }) }, "換一組題目"),
      el("button.btn.gold", { onclick: () => backTo(game, back) }, back?.scene === "academy" ? `回${ACADEMIES[back.academy].name}` : "回圖書館")));
  show(root);

  // 例題：先自己想，再看算法
  if (ex) {
    const how = el("div.lhow", { hidden: true }, mathText(`答案：${ex.answer}${ex.unit ? " " + ex.unit : ""}`), el("br"), mathText(ex.explain ?? ""));
    body.append(el("div.lsec", {}, el("div.lsub", {}, "例題"), el("div.lq", {}, mathText(ex.text)),
      el("button.btn.small", { onclick: (e) => { how.hidden = false; e.target.remove(); sfx("good"); } }, "看算法"), how));
  }
  // 試三題
  let done = 0, ok = 0;
  const tryBox = el("div.lsec", {}, el("div.lsub", {}, "試試看"));
  body.append(tryBox);
  tries.forEach((q, i) => {
    const fb = el("div.lfb");
    const opts = q.options.map((o) => el("button.btn.lopt", { "data-v": o, onclick: () => pick(o, i, q, fb, opts) }, mathText(q.unit && q.kind === "word" ? `${o} ${q.unit}` : o)));
    tryBox.append(el("div.ltry", {}, el("div.lq", {}, mathText(`${i + 1}．${q.text}`)), el("div.lopts", {}, ...opts), fb));
  });
  function pick(o, i, q, fb, opts) {
    opts.forEach((b) => (b.disabled = true));
    const right = o === q.answer;
    opts.forEach((b) => { if (b.dataset.v === q.answer) b.classList.add("ok"); else if (b.dataset.v === o) b.classList.add("bad"); });
    fb.replaceChildren(right ? "答對了！" : mathText(`再看一次算法：${q.explain ?? `答案是 ${q.answer}`}`));
    sfx(right ? "good" : "hurt");
    done++; if (right) ok++;
    if (done === tries.length) {
      const d = daily(s); d.lesson = (d.lesson ?? 0) + 1;
      writeSave(s);
      tryBox.append(el("div.lend", {}, ok === tries.length ? "全對！這招你已經掌握了！" : `答對 ${ok} 題，再練一次會更順手！`));
    }
  }
}
