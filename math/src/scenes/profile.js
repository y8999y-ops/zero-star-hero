// 個人資料面板（2026-11-26 使用者：左上角的面板看不清楚 → 點了打開，看各種個人資訊，錯題本也放在裡面）
// 三頁：我的資料／錯題本／成長日記。大廳左上角的個人卡、學院選單都打開這個。

import { el, mathText } from "../ui.js";
import { sfx } from "../audio.js";
import { ATTRS, GRADES, RANKS, UNIT_NAME, expToNext, MAX_LV, LEVEL_REWARDS, crystalLevel, maxHp } from "../data.js";
import { bookChapters, pagePageForm } from "../growth.js";
import { reviewUnits, ACADEMY_OF, ACADEMIES } from "../practice.js";

const TABS = [["me", "我的資料"], ["review", "錯題本"], ["diary", "成長日記"]];

/** 打開個人資料面板。tab：me／review／diary；onClose：關掉時呼叫（大廳要解除「忙碌」） */
export function profilePanel(game, tab = "me", onClose) {
  document.querySelector("#app .panel.prof")?.remove();
  const s = game.save;
  const body = el("div.pbody");
  const tabBtns = TABS.map(([id, name]) => el("button.ptab", { onclick: () => { sfx("click"); go(id); } },
    name, id === "review" && Object.keys(s.review).length ? el("span.cnt", {}, `${Object.keys(s.review).length}`) : null));
  const close = () => { p.remove(); onClose?.(); };
  const p = el("div.panel.prof", {},
    el("div.ptabs", {}, ...tabBtns, el("button.pclose", { "aria-label": "關閉", onclick: () => { sfx("click"); close(); } }, "✕")),
    body);
  const leaveTo = (scene, arg) => { p.remove(); onClose?.(true); game.go(scene, arg); };
  function go(id) {
    TABS.forEach(([t], i) => tabBtns[i].classList.toggle("on", t === id));
    body.replaceChildren(...(id === "review" ? reviewBody(s, leaveTo) : id === "diary" ? diaryBody(s) : meBody(s)));
    body.scrollTop = 0;
    if (id === "diary") animateBars(body);
  }
  go(tab);
  document.querySelector("#app").append(p);
  return p;
}

// ── 我的資料 ──
function meBody(s) {
  const a = ATTRS[s.attr], rank = RANKS[s.rank], need = expToNext(s.lv), max = s.lv >= MAX_LV;
  const next = Object.entries(LEVEL_REWARDS).find(([lv]) => Number(lv) > s.lv);
  const starsAll = Object.values(s.stars ?? {}).reduce((x, n) => x + n, 0);
  const cleared = Object.keys(GRADES).filter((g) => (s.stars[`${g}-boss`] ?? 0) > 0).length;
  const tile = (k, v, color) => el("div.ptile", {}, el("span.pk", {}, k), el("b.pv", color ? { style: { color } } : {}, v));
  return [
    el("div.phead", {},
      el("div.pbadge", { style: { "--c": a?.color ?? "#ccc" } }, a?.name ?? "？"),
      el("div.pmain", {},
        el("div.pname", {}, rank.name, el("span.plv", {}, `Lv ${s.lv}`)),
        el("div.pschool", { style: { color: a?.color } }, a ? `${a.school}・${a.type}` : "還沒共鳴"),
        el("div.expbar", {}, el("div.fill", { style: { width: max ? "100%" : `${(100 * s.exp) / need}%` } }), el("span", {}, max ? "MAX" : `經驗 ${s.exp} / ${need}`)))),
    el("div.ptiles", {},
      tile("晶幣", `${s.coins}`, "#ffd76a"),
      tile("魔力", `${maxHp(s.lv)} 顆心`, "#ff8aa0"),
      tile("數晶", `Lv ${crystalLevel(s.crystals[s.attr])}`, a?.color),
      tile("副屬性", s.subAttr ? ATTRS[s.subAttr].name : s.lv >= 20 ? "還沒選" : "Lv20 開放", s.subAttr ? ATTRS[s.subAttr].color : null),
      tile("頁頁", pagePageForm(s)),
      tile("萬題之書", `${bookChapters(s)} 章`),
      tile("淨化區域", `${cleared} / ${Object.keys(GRADES).length}`),
      tile("星星", `${starsAll} ★`, "#ffd76a"),
      tile("挑戰最佳", `連對 ${s.challengeBest ?? 0}`),
      tile("墨水圖鑑", `${Object.keys(s.dex ?? {}).length} 種`)),
    next ? el("div.pnote", {}, `下一個等級獎勵：Lv${next[0]} ${next[1]}`) : null,
  ];
}

// ── 錯題本 ──
export function reviewBody(s, leaveTo) {
  const r = Object.entries(s.review);
  const units = reviewUnits(s);
  return [
    r.length ? el("ul.list", {}, ...r.map(([, v]) => el("li", {}, el("span.rq", {}, el("span.rarea", {}, GRADES[v.grade]?.area ?? ""), mathText(v.sample)), el("span.left", {}, `再連對 ${v.left} 次`),
      v.branch && v.branch in UNIT_NAME ? el("button.btn.small", { onclick: () => leaveTo("lesson", { branch: v.branch }) }, "學一學") : null)))
      : el("p.pempty", {}, "目前沒有錯題！"),
    units.length ? el("button.btn.gold", { onclick: () => { const [b] = units[0]; leaveTo("battle", { grade: "g1", mode: "practice", practice: { academy: ACADEMY_OF[b] ?? "ice", branch: b, level: 0, review: true } }); } }, "錯題特訓") : null,
  ];
}

// ── 成長日記 ──
// 2026-11-26 使用者：用動態進度條顯示，全部通過就是 100%。
//   每個單元的進度＝學院練習簡單＋困難的星星（各 3 顆，共 6 顆）；兩種模式都 3 星＝通過。總進度＝全部單元加起來。
export function diaryBody(s) {
  const st = (b, l) => Math.min(3, s.practice?.[`${b}-${l}`] ?? 0);
  const unitPct = (b) => (st(b, 0) + st(b, 1)) / 6;
  const all = Object.values(ACADEMIES).flatMap((A) => A.branches);
  const total = all.reduce((x, b) => x + unitPct(b), 0) / all.length;
  const passed = all.filter((b) => unitPct(b) >= 1).length;
  const bar = (pct, cls = "") => el(`div.gbar${cls}`, {}, el("i", { "data-w": String(Math.round(pct * 100)) }));
  // 最近 30 天（企劃書 E7）：沒玩的日子也排出來（空的一格）
  const days = Array.from({ length: 30 }, (_, i) => { const d = new Date(Date.now() - (29 - i) * 864e5).toISOString().slice(0, 10); return [d, s.diary[d] ?? { n: 0, ok: 0 }]; });
  const played = days.filter(([, v]) => v.n).length, okAll = days.reduce((a, [, v]) => a + v.ok, 0);
  const most = Math.max(1, ...days.map(([, v]) => v.n));
  return [
    el("div.gtotal", {},
      el("div.gtl", {}, el("b", {}, "課程總進度"), el("span.gnum", { "data-to": String(Math.round(total * 100)) }, "0%"), el("span.gsub", {}, `通過 ${passed} / ${all.length} 個單元`)),
      bar(total, ".big")),
    ...Object.entries(ACADEMIES).map(([, A]) => el("div.gcourse", {},
      el("div.gch", {}, A.name, el("span", {}, `${Math.round((A.branches.reduce((x, b) => x + unitPct(b), 0) / A.branches.length) * 100)}%`)),
      ...A.branches.map((b) => {
        const p = unitPct(b), m = s.branches[b];
        return el("div.gunit" + (p >= 1 ? ".done" : ""), {},
          el("span.gun", {}, UNIT_NAME[b]),
          bar(p),
          el("span.gup", {}, p >= 1 ? "通過 ✓" : `${Math.round(p * 100)}%`),
          el("span.gum", { title: "熟練度" }, m?.recent?.length ? "★".repeat(m.best) + "☆".repeat(5 - m.best) : "還沒練"));
      }))),
    el("div.sub", {}, `最近 30 天：練了 ${played} 天、答對 ${okAll} 題`),
    el("div.bars.b30", {}, ...days.map(([d, v], i) => el("div.bar", { title: `${d}：答對 ${v.ok}／${v.n} 題` },
      el("div.b", { "data-h": String(v.n ? Math.max(8, (100 * v.n) / most) : 0) }, el("div.bok", { style: { height: v.n ? `${(100 * v.ok) / v.n}%` : "0" } })),
      el("span", {}, i % 5 === 4 || i === 29 ? d.slice(8) : "")))),
  ];
}

// 進度條從 0 長到目標（一條一條錯開），總進度的數字跟著跳
export function animateBars(root) {
  const fills = [...root.querySelectorAll(".gbar i")], cols = [...root.querySelectorAll(".bars.b30 .b")];
  fills.forEach((f) => (f.style.width = "0%")); cols.forEach((c) => (c.style.height = "0%"));
  requestAnimationFrame(() => requestAnimationFrame(() => {
    fills.forEach((f, i) => { f.style.transitionDelay = `${i * 60}ms`; f.style.width = `${f.dataset.w}%`; });
    cols.forEach((c, i) => { c.style.transitionDelay = `${400 + i * 15}ms`; c.style.height = `${c.dataset.h}%`; });
  }));
  for (const n of root.querySelectorAll(".gnum")) {
    const to = Number(n.dataset.to), t0 = performance.now(), ms = 1100;
    const step = (now) => { const k = Math.min(1, (now - t0) / ms), e = 1 - (1 - k) ** 3; n.textContent = `${Math.round(to * e)}%`; if (k < 1 && n.isConnected) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
}
