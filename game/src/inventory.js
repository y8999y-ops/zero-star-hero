// 背包畫面：左邊身上裝備＋數值，中間背包格子，右邊選中物品的詳細資料和比較。
// 手機：點一下選取，再點一次同一格就直接穿上。電腦：I / B / Tab 開關，Esc 關閉。
// 使用者 2026-11-05（方案 A）：手機電腦一樣三欄同時顯示（左邊只剩 7 個裝備格＋數值，不跳頁）；背包格放大、一排 5 個、100 格；
//   篩選（部位、稀有度）、鎖定（鎖住的任何拆解都會跳過）、批量分解（選取模式打勾，確認才拆）。
import { playOpen } from "./ui-trans.js";
import { setNum, bump } from "./bump.js";
import { uiFx } from "./ui-fx.js";
import * as burstFx from "../../pixelfx/src/fx/pickups/collect-burst.js";
import { createFrame, composite } from "../../pixelfx/src/core/index.js";
import { SLOTS, RARITY, R, UNIQUES, describe, kindLabel, colorOf, SETS, setCounts, MYTHS, AWAKEN, awakenStage } from "./items.js";
import { FORMS } from "./forms.js";
import { computeStats, compare, power, STAT_ROWS, xpNeed, MAX_LV } from "./stats.js";
import { BAG_SIZE } from "./save.js";
import { iconURL } from "./ui-art.js";
import { paintStar, POSES } from "./star.js";
import { sfx } from "./audio.js";
import { drawOrbit, blit2x } from "./heroorbit.js";

const $ = (id) => document.getElementById(id);
const AUTO = ["關", "垃圾", "普通以下"];
const KIND_ORDER = { weapon: 0, head: 1, body: 2, hands: 3, feet: 4, acc: 5, junk: 6 };
// 屬性 id → 圖示（ui-icons.js 的 st_*）；攻擊%／生命% 共用攻擊、生命的圖示
const STAT_ICON = { atk: "st_atk", atkPct: "st_atk", hp: "st_hp", hpPct: "st_hp", maxHp: "st_hp", def: "st_def", crit: "st_crit", critDmg: "st_critDmg", skill: "st_skill", ult: "st_ult", charge: "st_charge", cdr: "st_cdr", leech: "st_leech", move: "st_move", mf: "st_mf" };
const stIco = (id) => (STAT_ICON[id] ? `<img class="sti" src="${iconURL(STAT_ICON[id], 1)}">` : "");
const SLOT_ICON = { weapon: "core_dawn", head: "crown", body: "star", hands: "glove", feet: "boot", acc1: "shard", acc2: "shard" };

/**
 * profile：存檔資料（會直接修改）。onChange()：裝備或背包改變後呼叫（重算數值、存檔）。
 */
export function createInventory(profile, { onChange, onClose }) {
  const root = $("inv"), box = $("invBox");
  let sel = null;   // { where: "bag" | "equip", key }
  let fPart = "all", fRar = -1, batch = false, warned = false;
  const picked = new Set();   // 批量分解選到的物品（物品本身，不是格子編號：篩選、整理之後還是同一件）
  let open = false;

  // ---- 版面：固定 760×360，等比縮放塞進螢幕
  // 手機：三欄改成分頁（裝備／背包／詳細），一次只看一頁，字才不會被縮得太小
  let pane = "invBag", moreStats = false, prevSt = null, prevPw = 0, prevSets = null;
  const setPane = (id) => { pane = id; box.dataset.pane = id; box.querySelectorAll("#invTabs button").forEach((b) => b.classList.toggle("on", b.dataset.pane === id)); };
  box.querySelectorAll("#invTabs button").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); sfx("ui"); setPane(b.dataset.pane); }));
  setPane(pane);
  const detailX = document.createElement("button");
  detailX.id = "invDetailX"; detailX.setAttribute("aria-label", "回背包"); detailX.textContent = "◀ 背包";
  detailX.addEventListener("click", (e) => { e.stopPropagation(); sfx("ui"); sel = null; setPane("invBag"); render(); });
  box.appendChild(detailX);
  // 使用者 2026-11-05：替換對比——選背包裡的東西時，身上同部位那件的資料用半透明視窗蓋在左邊，讓玩家自己對照（不寫各項差距）
  const cmpEl = document.createElement("div");
  cmpEl.id = "invCmp";
  box.appendChild(cmpEl);
  cmpEl.addEventListener("click", (e) => { e.stopPropagation(); sel = null; render(); });   // 點對比視窗＝收起來
  function fit() {
    const bw = 760, bh = 360;   // 方案 A：手機電腦一樣三欄（使用者 2026-11-05）
    const k = Math.min((innerWidth * 0.98) / bw, (innerHeight * 0.98) / bh, 2.2);
    box.style.transform = `translate(-50%, -50%) scale(${k})`;
  }
  addEventListener("resize", fit);

  // ---- 身上裝備格
  const dollL = $("dollL"), dollR = $("dollR");
  const slotEls = {};
  for (const s of SLOTS) {
    const el = document.createElement("div");
    el.className = "slot";
    el.dataset.slot = s.id;
    el.title = s.name;
    $("doll").append(el);   // 使用者 2026-11-05：裝備格在星星外圈的軌道上（位置每幀由 drawHero 算）
    el.addEventListener("click", () => !dragged && pick({ where: "equip", key: s.id }));
    el.addEventListener("pointerdown", (e) => startDrag(e, { where: "equip", key: s.id }));
    slotEls[s.id] = el;
  }
  // ---- 背包格
  const grid = $("grid"), cells = [];
  // 每一格顯示 view[格子] 那一件（篩選後的清單），所以點擊時查 dataset.i（背包裡的編號）
  for (let i = 0; i < BAG_SIZE; i++) {
    const el = document.createElement("div");
    el.className = "slot";
    el.addEventListener("click", () => { if (dragged) return; const k = el.dataset.i ? +el.dataset.i : -1; pick({ where: "bag", key: k }); });
    el.addEventListener("pointerdown", (e) => { if (!batch && el.dataset.i) startDrag(e, { where: "bag", key: +el.dataset.i }); });
    grid.append(el);
    cells.push(el);
  }

  const itemAt = (s) => (!s ? null : s.where === "bag" ? profile.inv[s.key] : profile.equip[s.key]);

  function pick(s) {
    if (batch && s.where === "bag") {   // 批量分解：點一下打勾／取消
      const it = profile.inv[s.key];
      if (!it) return;
      if (it.locked) { sfx("close"); return say("鎖定的不能分解。"); }
      if (picked.has(it)) picked.delete(it); else picked.add(it);
      warned = false; sfx("ui"); render(); return;
    }
    const same = sel && sel.where === s.where && sel.key === s.key;
    const it = itemAt(s);
    if (same && it) {
      // 點同一格第二次：穿上／卸下
      if (s.where === "bag") equip(s.key);
      else unequip(s.key);
      return;
    }
    sel = it ? s : null;
    if (it) it.new = false;
    render();   // 方案 A：詳細資料一直在右邊的側邊欄，不跳頁
  }

  function equip(i, slot) {
    const it = profile.inv[i];
    if (!it || it.kind === "junk") return;
    slot ??= compare(it, profile.equip, profile.lv).slot;
    const old = profile.equip[slot];
    profile.equip[slot] = it;
    if (old) profile.inv[i] = old;
    else profile.inv.splice(i, 1);
    sel = { where: "equip", key: slot };
    sfx("pickup");
    changed();
  }
  /** 這件可以放進哪幾格（碎片兩格都可以） */
  const slotsFor = (it) => (!it || it.kind === "junk" ? [] : it.kind === "acc" ? ["acc1", "acc2"] : [it.kind]);

  // ---- 拖動：從背包拖到身上的格子（對應的格子會亮），或從身上拖回背包＝卸下。滑鼠和手指都可以。
  let drag = null, dragged = false;
  function startDrag(e, from) {
    const it = itemAt(from);
    if (!it || e.button > 0) return;
    drag = { from, it, x0: e.clientX, y0: e.clientY, ghost: null, id: e.pointerId };
  }
  addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.ghost) {
      if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 6) return;
      const k = box.getBoundingClientRect().width / 760;
      drag.ghost = document.createElement("img");
      drag.ghost.className = "drag-ghost";
      drag.ghost.src = iconURL(drag.it.icon, 2);
      drag.ghost.style.width = drag.ghost.style.height = 32 * k + "px";
      document.body.append(drag.ghost);
      // 對應的格子亮起來
      const ok = drag.from.where === "bag" ? slotsFor(drag.it) : [];
      for (const id of ok) slotEls[id].classList.add("drop-ok");
      if (drag.from.where === "equip" && drag.from.key !== "weapon") grid.classList.add("drop-ok");
      root.classList.add("dragging");
    }
    drag.ghost.style.left = e.clientX + "px";
    drag.ghost.style.top = e.clientY + "px";
    const over = document.elementFromPoint(e.clientX, e.clientY)?.closest(".slot, #grid");
    document.querySelectorAll("#inv .drop-hover").forEach((el) => el.classList.remove("drop-hover"));
    if (over && (over.classList.contains("drop-ok") || over.closest("#grid.drop-ok"))) (over.closest("#grid.drop-ok") ?? over).classList.add("drop-hover");
  });
  addEventListener("pointerup", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    if (!d.ghost) return;
    dragged = true;
    setTimeout(() => (dragged = false), 0);
    d.ghost.remove();
    root.classList.remove("dragging");
    document.querySelectorAll("#inv .drop-ok, #inv .drop-hover").forEach((el) => el.classList.remove("drop-ok", "drop-hover"));
    const over = document.elementFromPoint(e.clientX, e.clientY);
    const slotEl = over?.closest(".slot[data-slot]");
    if (d.from.where === "bag" && slotEl && slotsFor(d.it).includes(slotEl.dataset.slot)) equip(d.from.key, slotEl.dataset.slot);
    else if (d.from.where === "equip" && over?.closest("#grid") && d.from.key !== "weapon") unequip(d.from.key);
  });
  function unequip(slot) {
    if (slot === "weapon") return say("星核不能拿出來。那是你的心臟欸。");
    if (profile.inv.length >= BAG_SIZE) return say("背包滿了，卸不下來。");
    profile.inv.push(profile.equip[slot]);
    profile.equip[slot] = null;
    sel = { where: "bag", key: profile.inv.length - 1 };
    changed();
  }
  function salvageAt(s) {
    const it = itemAt(s);
    if (!it || s.where !== "bag") return;
    if (it.locked) return say("鎖定中，先解鎖才能拆。");
    const r = RARITY[it.rarity];
    profile.scrap += r.scrap;
    profile.coins += r.coin;
    profile.inv.splice(s.key, 1);
    sel = null;
    say(`拆解 ${it.name}：星塵 +${r.scrap}，金幣 +${r.coin}`);
    changed();
  }

  $("btnSort").addEventListener("click", () => {
    profile.inv.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || b.rarity - a.rarity || b.ilvl - a.ilvl);
    sel = null;
    changed();
  });
  $("btnSalvageAll").addEventListener("click", () => {
    let n = 0, scrap = 0, coin = 0;
    profile.inv = profile.inv.filter((it) => {
      const bad = !it.locked && it.rarity <= R.common && !compare(it, profile.equip, profile.lv)?.better;
      if (bad) { n++; scrap += RARITY[it.rarity].scrap; coin += RARITY[it.rarity].coin; }
      return !bad;
    });
    profile.scrap += scrap;
    profile.coins += coin;
    sel = null;
    say(n ? `拆解了 ${n} 件垃圾和普通裝備：星塵 +${scrap}，金幣 +${coin}` : "沒有可以拆的東西（比身上好的不會拆）。");
    changed();
  });
  // ---- 篩選：部位、稀有度（兩排小按鈕）
  const PARTS = [["all", null, "全部"], ["weapon", "core_dawn", "星核"], ["head", "crown", "頭"], ["body", "star", "身體"], ["hands", "glove", "手"], ["feet", "boot", "腳"], ["acc", "shard", "碎片"]];
  $("fPart").innerHTML = PARTS.map(([k, ic, n]) => `<button data-p="${k}" title="${n}">${ic ? `<img src="${iconURL(ic, 1)}">` : "全"}</button>`).join("");
  $("fRar").innerHTML = `<button data-r="-1" title="全部">全</button>` + RARITY.map((r, i) => `<button data-r="${i}" title="${r.name}" style="--rc:${r.color}"><i></i></button>`).join("");
  $("fPart").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; e.stopPropagation(); sfx("ui"); fPart = b.dataset.p; render(); });
  $("fRar").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; e.stopPropagation(); sfx("ui"); fRar = +b.dataset.r; render(); });
  const matchF = (it) => (fPart === "all" || it.kind === fPart) && (fRar < 0 || (it.kind !== "junk" && it.rarity === fRar));
  // ---- 批量分解
  const setBatch = (on) => { batch = on; picked.clear(); warned = false; sel = null; box.classList.toggle("batch", on); render(); };
  $("btnBatch").addEventListener("click", (e) => { e.stopPropagation(); sfx("ui"); setBatch(true); say("點要分解的物品打勾，再按「分解」。鎖定的不會被選到。"); });
  $("btnBatchX").addEventListener("click", (e) => { e.stopPropagation(); sfx("ui"); setBatch(false); });
  $("btnPickAll").addEventListener("click", (e) => {
    e.stopPropagation(); sfx("ui");
    const all = profile.inv.filter((it) => matchF(it) && !it.locked);
    if (all.every((it) => picked.has(it))) all.forEach((it) => picked.delete(it)); else all.forEach((it) => picked.add(it));
    warned = false; render();
  });
  $("btnBatchGo").addEventListener("click", (e) => {
    e.stopPropagation();
    if (!picked.size) return say("還沒選東西。");
    const better = [...picked].filter((it) => it.kind !== "junk" && compare(it, profile.equip, profile.lv)?.better).length;
    if (better && !warned) { warned = true; sfx("close"); return say(`選到 ${better} 件比身上好的（▲），確定要拆就再按一次。`); }
    let n = 0, scrap = 0, coin = 0;
    profile.inv = profile.inv.filter((it) => { if (!picked.has(it) || it.locked) return true; n++; scrap += RARITY[it.rarity].scrap; coin += RARITY[it.rarity].coin; return false; });
    profile.scrap += scrap; profile.coins += coin;
    sfx("chime");
    const r = $("btnBatchGo").getBoundingClientRect();
    uiFx(burstFx, { palette: ["#0c2a60", "#3ab8f0", "#9af0ff", "#ffffff"], light: 0.5, seed: n }, r.left + r.width / 2, r.top);
    setBatch(false);
    say(`分解了 ${n} 件：星塵 +${scrap}，金幣 +${coin}`);
    onChange();
  });
  $("btnAuto").addEventListener("click", () => {
    profile.auto = (profile.auto + 1) % AUTO.length;
    changed();
  });
  $("invClose").addEventListener("click", () => close());
  root.addEventListener("click", (e) => { if (e.target === root) close(); });

  let sayT = 0;
  function say(msg) {
    const el = $("invSay");
    el.textContent = msg;
    el.classList.add("on");
    clearTimeout(sayT);
    sayT = setTimeout(() => el.classList.remove("on"), 2600);
  }

  function changed() {
    onChange();
    render();
  }

  // ---- 繪製
  function slotHTML(el, it, extra = "", k = 2) {
    el.className = "slot" + (it ? " r" + it.rarity : "") + extra;
    el.innerHTML = it ? `<img src="${iconURL(it.icon, k)}">` : "";
  }

  function render() {
    const lv = profile.lv, eq = profile.equip, st = computeStats(eq, lv);
    $("invLv").textContent = `Lv ${lv}`;
    $("invXp").style.width = (lv >= MAX_LV ? 100 : (profile.xp / xpNeed(lv)) * 100) + "%";
    $("invXpText").textContent = lv >= MAX_LV ? "MAX" : `${profile.xp} / ${xpNeed(lv)}`;
    for (const s of SLOTS) {
      const el = slotEls[s.id], it = eq[s.id];
      slotHTML(el, it, sel?.where === "equip" && sel.key === s.id ? " sel" : "");
      if (!it) el.innerHTML = `<img class="ghost" src="${iconURL(SLOT_ICON[s.id], 2, "#2a2340")}">`;
    }
    // 篩選後的清單；沒篩選時把空格也畫出來（看得出還剩幾格），有篩選時只補滿最後一排
    const view = profile.inv.map((it, i) => i).filter((i) => matchF(profile.inv[i]));
    const filtering = fPart !== "all" || fRar >= 0, shown = filtering ? Math.max(5, Math.ceil(view.length / 5) * 5) : BAG_SIZE;
    cells.forEach((el, c) => {
      const i = view[c], it = i == null ? null : profile.inv[i];
      el.style.display = c < shown ? "" : "none";
      el.dataset.i = i == null ? "" : i;
      slotHTML(el, it, (sel?.where === "bag" && sel.key === i && it ? " sel" : "") + (it && picked.has(it) ? " picked" : ""), 3);   // 大格子用 3 倍圖（48px，像素整齊）
      if (!it) return;
      if (it.new) el.insertAdjacentHTML("beforeend", "<i class='badge new'>!</i>");
      if (compare(it, eq, lv)?.better) el.insertAdjacentHTML("beforeend", "<i class='badge up'>▲</i>");
      if (it.locked) el.insertAdjacentHTML("beforeend", "<i class='badge lock'></i>");
      if (picked.has(it)) el.insertAdjacentHTML("beforeend", "<i class='badge pick'>✓</i>");
    });
    $("bagN").textContent = `${profile.inv.length} / ${BAG_SIZE}`;
    $("fPart").querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.p === fPart));
    $("fRar").querySelectorAll("button").forEach((b) => b.classList.toggle("on", +b.dataset.r === fRar));
    if (batch) {
      let sc = 0; for (const it of picked) sc += RARITY[it.rarity].scrap;
      $("btnBatchGo").innerHTML = `分解 ${picked.size} 件 <small>+${sc}星塵</small>`;
    }
    setNum($("invCoins"), profile.coins);
    setNum($("invScrap"), profile.scrap);
    $("btnAuto").textContent = "自動：" + AUTO[profile.auto];
    // 數值
    // 左邊數值：圖示＋數字（三欄，滑過去看名稱），沒有的屬性不顯示（前 5 個一定顯示）
    // 只顯示 5 個主要數值，按「更多」才展開其他（有數值的）
    const extra = STAT_ROWS.filter(([k], i) => i >= 5 && st[k]);
    $("invStats").innerHTML = STAT_ROWS.filter(([k], i) => i < 5 || (moreStats && st[k])).map(([k, n, f]) => `<div title="${n}">${stIco(k)}<b data-k="${k}">${f(st[k])}</b></div>`).join("")
      + (extra.length ? `<button class="more" id="statMore">${moreStats ? "收起" : `更多 ＋${extra.length}`}</button>` : "")
      + `<div class="pw"><span>戰力</span><b>${Math.round(power(st) * 10)}</b></div>`;
    $("statMore")?.addEventListener("click", (e) => { e.stopPropagation(); moreStats = !moreStats; render(); });
    // 第 7 批：數值跟上次畫的時候比，有變的跳一下（穿上更好的裝備時一眼看出哪裡變了）
    const pw = Math.round(power(st) * 10);
    if (prevSt) {
      for (const b of $("invStats").querySelectorAll("b[data-k]")) { const k = b.dataset.k; if ((prevSt[k] ?? 0) !== (st[k] ?? 0)) bump(b, (st[k] ?? 0) > (prevSt[k] ?? 0)); }
      if (prevPw !== pw) bump($("invStats").querySelector(".pw b"), pw > prevPw);
    }
    prevSt = { ...st }; prevPw = pw;
    // 第 7 批：套裝湊到 2 件或 4 件的那一下——人像那邊爆一圈套裝顏色的光、背包說一句
    const sc = setCounts(profile.equip);
    if (prevSets) for (const [id, n] of Object.entries(sc)) {
      const was = prevSets[id] ?? 0, hit = [4, 2].find((k) => was < k && n >= k);
      if (!hit) continue;
      const S = SETS[id], r = $("doll").getBoundingClientRect();
      uiFx(burstFx, { palette: ["#1a1430", S.color, S.color, "#ffffff"], light: 0.7, seed: n }, r.left + r.width / 2, r.top + r.height / 2);
      if (hit === 4) setTimeout(() => uiFx(burstFx, { palette: ["#1a1430", S.color, "#fff0a0", "#ffffff"], light: 0.8, seed: 9 }, r.left + r.width / 2, r.top + r.height / 2), 200);
      say(`套裝「${S.name}」${hit} 件效果啟動！`);
      sfx("levelup");
    }
    prevSets = sc;
    renderDetail(st);
    drawPortrait(st);
  }

  /** 一件裝備的資料（名稱、主屬性、副屬性、獨特／套裝說明）：右邊詳細和左邊對比視窗共用 */
  function itemCard(it) {
    const junk = it.kind === "junk";
    const lines = describe(it).map(([t, id, txt, tag]) => t === "main"
      ? `<div class="ln main">${stIco(id)}${txt}${tag ? `<em>${tag}</em>` : ""}</div>`
      : t === "core" ? `<div class="ln core">${txt}<em>${tag}</em></div>`
      : `<div class="ln ${t}">${stIco(id)}${txt}</div>`).join("");
    return `<div class="dhead"><div class="slot r${it.rarity}"><img src="${iconURL(it.icon, 2)}"></div>
      <div class="dname" style="color:${colorOf(it)}">${it.name}${junk ? "" : `<span class="dlv" title="物品等級">${it.ilvl}</span>`}</div></div>
      <div class="dlines">${lines || '<div class="ln">（什麼都沒有）</div>'}</div>`;
  }
  function renderCmp() {
    const it = itemAt(sel);
    const show = !batch && it && sel.where === "bag" && it.kind !== "junk";
    const slot = show ? compare(it, profile.equip, profile.lv).slot : null, old = slot ? profile.equip[slot] : null;
    cmpEl.classList.toggle("on", !!show);
    if (!show) return;
    cmpEl.innerHTML = `<div class="cttl">身上的</div>` + (old ? itemCard(old) + (old.unique ? `<div class="lore">${UNIQUES[old.unique].name}</div>` : "") : `<div class="cempty">這個部位沒有裝備</div>`);
  }
  function renderDetail(st) {
    renderCmp();
    const el = $("invDetail"), it = itemAt(sel);
    if (batch) {
      let sc = 0, co = 0; for (const p of picked) { sc += RARITY[p.rarity].scrap; co += RARITY[p.rarity].coin; }
      el.innerHTML = `<div class="empty">批量分解<br><br>已選 <b>${picked.size}</b> 件<br>星塵 +${sc}　金幣 +${co}<br><br><small>點格子打勾／取消<br>「全選」＝選目前篩選的全部<br>鎖定的不會被選到</small></div>`;
      return;
    }
    if (!it) {
      el.innerHTML = `<div class="empty">點一下物品看詳細資料<br>再點一次就穿上<br><br><small>▲ 比身上的好　! 新撿到的<br>鎖頭＝鎖定（不會被拆）</small></div>`;
      return;
    }
    const r = RARITY[it.rarity], junk = it.kind === "junk";
    // 主屬性一行大字（強化等級標在右邊）；副屬性每行前面是層級 T1～T5
    const lines = describe(it).map(([t, id, txt, tag]) => t === "main"
      ? `<div class="ln main">${stIco(id)}${txt}${tag ? `<em>${tag}</em>` : ""}</div>`
      : t === "core" ? `<div class="ln core">${txt}<em>${tag}</em></div>`   // 8a：星核的核心效果＋第幾階
      : `<div class="ln ${t}">${stIco(id)}${txt}</div>`).join("");
    let cmp = "", btns = "";
    if (sel.where === "bag" && it.kind !== "junk") {
      const c = compare(it, profile.equip, profile.lv);
      const rows = STAT_ROWS.filter(([k]) => c.before[k] !== c.after[k]).map(([k, n, f]) => {
        const d = c.after[k] - c.before[k], good = d > 0;
        return `<div class="${good ? "g" : "b"}"><span>${stIco(k)}${n}</span>${f(c.before[k])} → ${f(c.after[k])}</div>`;
      });
      const old = profile.equip[c.slot];
      if (old?.unique) rows.push(`<div class="b">失去：${UNIQUES[old.unique].name} 的效果</div>`);
      // 使用者 2026-11-05：不寫各項差距，左邊半透明視窗放身上那件讓玩家自己看；這裡只留一句整體變強／變弱
      void rows;
      cmp = "";   // 使用者 2026-11-05：變強／變弱也不寫字（左邊的對比視窗自己看；格子右下的 ▲ 還在）
      btns = `<button class="pbtn" data-act="equip">裝備</button>`;
    } else if (sel.where === "equip") {
      cmp = `<div class="cmp"><div class="ch">已裝備</div></div>`;
      if (sel.key !== "weapon") btns = `<button class="pbtn plain" data-act="unequip">卸下</button>`;
    }
    if (!junk) btns += `<button class="pbtn plain lockb${it.locked ? " on" : ""}" data-act="lock" title="鎖定的不會被任何拆解拆掉"><i class="lk"></i>${it.locked ? "解鎖" : "鎖定"}</button>`;
    if (sel.where === "bag" && !it.locked) btns += `<button class="pbtn red" data-act="salvage">拆解 <small>+${r.scrap}星塵</small></button>`;
    let lore = it.unique ? `<div class="lore">${UNIQUES[it.unique].lore}</div>` : "";
    // 神話：四種形態各自的效果（目前的形態亮）、覺醒階段與進度、解鎖的故事
    if (it.myth) {
      const M = MYTHS[it.myth], st = awakenStage(it), k = it.awaken?.kills ?? 0, next = AWAKEN[st];
      lore += `<div class="mythbox"><div class="mf">${Object.entries(M.forms).map(([f, t]) => `<div class="${profile.forms.cur === f ? "on" : ""}"><b>${FORMS[f].name}</b>${t}</div>`).join("")}</div>`
        + `<div class="aw"><span>覺醒 ${"★".repeat(st)}${"☆".repeat(3 - st)}</span>${next ? `<i><em style="width:${Math.round((k / next) * 100)}%"></em></i><small>${k}/${next}</small>` : "<small>MAX</small>"}</div>`
        + M.lore.slice(0, st).map((l) => `<div class="lore">${l}</div>`).join("") + `</div>`;
    }
    // 套裝：套名＋身上穿了幾件，2 件／4 件效果（達成的亮起來）
    if (it.set) {
      const S = SETS[it.set], n = setCounts(profile.equip)[it.set] ?? 0;
      lore += `<div class="setbox" style="--sc:${S.color}"><div class="sn"><img class="sti" src="${iconURL(S.emblem, 1)}">${S.name}<em>${n}/4</em></div>`
        + `<div class="sb ${n >= 2 ? "on" : ""}"><b>2</b>${S.two}</div><div class="sb ${n >= 4 ? "on" : ""}"><b>4</b>${S.four}</div></div>`;
    }
    el.innerHTML = `<div class="dhead"><div class="slot r${it.rarity}"><img src="${iconURL(it.icon, 2)}"></div>
      <div class="dname" style="color:${colorOf(it)}">${it.name}${junk ? "" : `<span class="dlv" title="物品等級">${it.ilvl}</span>`}</div></div>
      <div class="dlines">${lines || '<div class="ln">（什麼都沒有）</div>'}${lore}</div>${cmp}<div class="dbtns">${btns}</div>`;
    el.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", () => {
      const a = b.dataset.act;
      if (a === "equip") equip(sel.key);
      else if (a === "unequip") unequip(sel.key);
      else if (a === "lock") { it.locked = !it.locked; sfx(it.locked ? "clank" : "ui"); say(it.locked ? `${it.name} 鎖定了：不會被拆掉。` : `${it.name} 解鎖了。`); changed(); }
      else salvageAt(sel);
    }));
  }

  // ---- 左欄：星星站在中間（2 倍大），7 件裝備在外圈的軌道上慢慢繞（90 秒一圈；拖東西的時候停下來）
  const OW = 113, OH = 104, ORB = { cx: 56, cy: 50, rx: 47, ry: 41, feet: 70, slots: [] };
  const oc = $("orbitCv"), octx = oc.getContext("2d"), of = createFrame(OW, OH), oimg = new ImageData(OW, OH), sf = createFrame(48, 64);
  let spin = 0, lastT = 0;
  function drawHero(now) {
    const t = now / 1000, dt = Math.min(0.1, lastT ? t - lastT : 0); lastT = t;
    if (!drag?.ghost) spin += dt * 0.07;
    ORB.slots = SLOTS.map((s, i) => ({ a: -Math.PI / 2 + (i / SLOTS.length) * Math.PI * 2 + spin, col: profile.equip[s.id] ? RARITY[profile.equip[s.id].rarity].color : null, id: s.id }));
    for (const o of ORB.slots) { const el = slotEls[o.id]; el.style.left = (ORB.cx + Math.cos(o.a) * ORB.rx) * 2 + "px"; el.style.top = (ORB.cy + Math.sin(o.a) * ORB.ry) * 2 + "px"; el.style.zIndex = Math.sin(o.a) >= 0 ? 3 : 1; }
    of.color.fill(0); of.light.fill(0); sf.color.fill(0); sf.light.fill(0);
    drawOrbit(of, t, ORB, "back");
    paintStar(sf, 24, 50, POSES.stand, false, { glow: 0 });
    blit2x(of, sf, ORB.cx, ORB.feet + 28 + Math.round(Math.sin(t * 2.5)));
    drawOrbit(of, t, ORB, "front");
    composite(of, oimg.data, null, 0.6);
    octx.putImageData(oimg, 0, 0);
  }
  const loop = (now) => { if (!open) return; drawHero(now); requestAnimationFrame(loop); };
  function drawPortrait() { drawHero(performance.now()); }

  function show(want) {
    if (want) setPane(want);
    if (open) return;
    open = true;
    sfx("open");
    root.classList.remove("hidden");
    fit();
    render();
    requestAnimationFrame(loop);
    playOpen(box, "bag");   // 第 7 批：背包從下面彈上來
  }
  function close() {
    if (!open) return;
    open = false;
    sfx("close");
    sel = null;
    if (batch) setBatch(false);
    root.classList.add("hidden");
    onClose?.();
  }
  addEventListener("keydown", (e) => {
    if (e.code === "Escape" && open) close();
  });

  return { show, close, render, get open() { return open; } };
}
