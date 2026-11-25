// 成長系統（企劃書第 8 節）：經驗與等級、魔法分支熟練度、數晶、晶幣、錯題本、成長日記。
// 只改存檔資料，畫面由呼叫的人處理；回傳「發生了什麼事」讓畫面去演出。

import { EXP, MAX_LV, expToNext, RANKS, crystalLevel } from "./data.js";

const today = () => new Date().toISOString().slice(0, 10);

/** 加經驗；回傳升了哪些級。 */
export function addExp(s, n) {
  const ups = [];
  s.exp += n;
  while (s.lv < MAX_LV && s.exp >= expToNext(s.lv)) {
    s.exp -= expToNext(s.lv);
    s.lv++;
    ups.push(s.lv);
    s.coins += 20;
  }
  if (s.lv >= MAX_LV) s.exp = 0;
  return ups;
}

/** 下一個階級需要的等級到了沒（到了就可以去考升階考核）。 */
export function rankExamReady(s) {
  const next = RANKS[s.rank + 1];
  return !!next && s.lv >= next.lv;
}

/** 分支星星：看最近 20 題（企劃書 8.5）。只記最好的一次。 */
export function branchStars(recent, targetSec) {
  if (recent.length < 5) return 0;
  const ok = recent.filter((r) => r.ok).length / recent.length;
  const avg = recent.reduce((a, r) => a + r.sec, 0) / recent.length;
  let stars = 0;
  if (ok >= 0.9 && avg <= targetSec) stars = 5;
  else if (ok >= 0.9) stars = 4;
  else if (ok >= 0.8) stars = 3;
  else if (ok >= 0.7) stars = 2;
  else if (ok >= 0.6) stars = 1;
  // 題數不夠時星星有上限：不到 10 題最多 ★2、不到 20 題最多 ★4，精通要滿 20 題
  const cap = recent.length < 10 ? 2 : recent.length < 20 ? 4 : 5;
  return Math.min(stars, cap);
}

/**
 * 記一題的結果。q：{ branch, typeKey, fromReview }；回傳 { exp, events }。
 * events 裡可能有：{ kind: "firstType" } { kind: "branchStar", branch, stars } { kind: "crystal", lv }
 */
export function recordAnswer(s, q, ok, sec) {
  const events = [];
  let exp = 0;
  const d = (s.diary[today()] ??= { n: 0, ok: 0 });
  d.n++;
  if (ok) d.ok++;

  const b = s.branches[q.branch];
  if (b) {
    b.recent.push({ ok, sec: Math.round(sec * 10) / 10 });
    if (b.recent.length > 20) b.recent.shift();
    const stars = branchStars(b.recent, q.targetSec ?? 8);
    if (stars > b.best) { b.best = stars; events.push({ kind: "branchStar", branch: q.branch, stars }); }
  }

  if (ok) {
    exp += EXP.correct;
    if (!s.seenTypes[q.typeKey]) { s.seenTypes[q.typeKey] = 1; exp += EXP.firstType; events.push({ kind: "firstType" }); }
    const r = s.review[q.typeKey];
    if (r) {
      exp += EXP.review;
      if (--r.left <= 0) delete s.review[q.typeKey];
    }
    const before = crystalLevel(s.crystals[s.attr]);
    s.crystals[s.attr]++;
    const after = crystalLevel(s.crystals[s.attr]);
    if (after > before) events.push({ kind: "crystal", lv: after });
  } else {
    // 錯題本：同題型連續答對 3 次才移出（企劃書 7.6）
    s.review[q.typeKey] = { left: 3, sample: q.text, grade: q.grade, branch: q.branch };
  }
  return { exp, events };
}

/** 《萬題之書》恢復的章數＝精通（★5）的分支數；頁頁的樣子跟著變（企劃書 8.6）。 */
export function bookChapters(s) {
  return Object.values(s.branches).filter((b) => b.best >= 5).length;
}
/** 頁頁的樣子是第幾種（0 一張紙、1 小冊子、2 精裝書、3 魔導書），給畫圖用 */
export function pagePageLevel(s) {
  const n = bookChapters(s);
  return n >= 6 ? 3 : n >= 3 ? 2 : n >= 1 ? 1 : 0;
}
export function pagePageForm(s) {
  const n = bookChapters(s);
  return n >= 6 ? "魔導書" : n >= 3 ? "精裝書" : n >= 1 ? "小冊子" : "一張紙";
}
