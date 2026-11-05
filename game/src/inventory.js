// 背包畫面：左邊身上裝備＋數值，中間背包格子，右邊選中物品的詳細資料和比較。
// 手機：點一下選取，再點一次同一格就直接穿上。電腦：I / B / Tab 開關，Esc 關閉。
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
  let open = false;

  // ---- 版面：固定 760×360，等比縮放塞進螢幕
  // 手機：三欄改成分頁（裝備／背包／詳細），一次只看一頁，字才不會被縮得太小
  let pane = "invBag", moreStats = false, prevSt = null, prevPw = 0, prevSets = null;
  const setPane = (id) => { pane = id; box.dataset.pane = id; box.querySelectorAll("#invTabs button").forEach((b) => b.classList.toggle("on", b.dataset.pane === id)); };
  box.querySelectorAll("#invTabs button").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); sfx("ui"); setPane(b.dataset.pane); }));
  setPane(pane);
  function fit() {
    const touch = document.body.classList.contains("touch"), bw = touch ? 480 : 760, bh = touch ? 300 : 360;
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
    (["head", "body", "hands", "feet"].includes(s.id) ? dollL : dollR).append(el);
    el.addEventListener("click", () => !dragged && pick({ where: "equip", key: s.id }));
    el.addEventListener("pointerdown", (e) => startDrag(e, { where: "equip", key: s.id }));
    slotEls[s.id] = el;
  }
  // ---- 背包格
  const grid = $("grid"), cells = [];
  for (let i = 0; i < BAG_SIZE; i++) {
    const el = document.createElement("div");
    el.className = "slot";
    el.addEventListener("click", () => !dragged && pick({ where: "bag", key: i }));
    el.addEventListener("pointerdown", (e) => startDrag(e, { where: "bag", key: i }));
    grid.append(el);
    cells.push(el);
  }

  const itemAt = (s) => (!s ? null : s.where === "bag" ? profile.inv[s.key] : profile.equip[s.key]);

  function pick(s) {
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
    if (it && document.body.classList.contains("touch")) setPane("invDetail");   // 手機：點了東西直接看詳細
    render();
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
      const bad = it.rarity <= R.common && !compare(it, profile.equip, profile.lv)?.better;
      if (bad) { n++; scrap += RARITY[it.rarity].scrap; coin += RARITY[it.rarity].coin; }
      return !bad;
    });
    profile.scrap += scrap;
    profile.coins += coin;
    sel = null;
    say(n ? `拆解了 ${n} 件垃圾和普通裝備：星塵 +${scrap}，金幣 +${coin}` : "沒有可以拆的東西（比身上好的不會拆）。");
    changed();
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
  function slotHTML(el, it, extra = "") {
    el.className = "slot" + (it ? " r" + it.rarity : "") + extra;
    el.innerHTML = it ? `<img src="${iconURL(it.icon, 2)}">` : "";
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
    cells.forEach((el, i) => {
      const it = profile.inv[i];
      slotHTML(el, it, sel?.where === "bag" && sel.key === i ? " sel" : "");
      if (it?.new) el.insertAdjacentHTML("beforeend", "<i class='badge new'>!</i>");
      if (it && compare(it, eq, lv)?.better) el.insertAdjacentHTML("beforeend", "<i class='badge up'>▲</i>");
    });
    $("bagN").textContent = `${profile.inv.length} / ${BAG_SIZE}`;
    setNum($("invCoins"), profile.coins);
    setNum($("invScrap"), profile.scrap);
    $("btnAuto").textContent = "自動拆解：" + AUTO[profile.auto];
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
      const S = SETS[id], r = $("portrait").getBoundingClientRect();
      uiFx(burstFx, { palette: ["#1a1430", S.color, S.color, "#ffffff"], light: 0.7, seed: n }, r.left + r.width / 2, r.top + r.height / 2);
      if (hit === 4) setTimeout(() => uiFx(burstFx, { palette: ["#1a1430", S.color, "#fff0a0", "#ffffff"], light: 0.8, seed: 9 }, r.left + r.width / 2, r.top + r.height / 2), 200);
      say(`套裝「${S.name}」${hit} 件效果啟動！`);
      sfx("levelup");
    }
    prevSets = sc;
    renderDetail(st);
    drawPortrait(st);
  }

  function renderDetail(st) {
    const el = $("invDetail"), it = itemAt(sel);
    if (!it) {
      el.innerHTML = `<div class="empty">點一下物品看詳細資料<br>再點一次就穿上<br><br><small>▲ 比身上的好　! 新撿到的</small></div>`;
      return;
    }
    const r = RARITY[it.rarity], junk = it.kind === "junk";
    // 主屬性一行大字（強化等級標在右邊）；副屬性每行前面是層級 T1～T5
    const lines = describe(it).map(([t, id, txt, tag]) => t === "main"
      ? `<div class="ln main">${stIco(id)}${txt}${tag ? `<em>${tag}</em>` : ""}</div>`
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
      cmp = `<div class="cmp"><div class="ch">換掉 ${old ? `<b style="color:${colorOf(old)}">${old.name}</b>` : "（空）"}${c.better ? ' <em class="up">▲ 變強</em>' : c.worse ? ' <em class="down">▼ 變弱</em>' : ""}</div>${rows.join("") || "<div>數值沒有變化</div>"}</div>`;
      btns = `<button class="pbtn" data-act="equip">裝備</button>`;
    } else if (sel.where === "equip") {
      cmp = `<div class="cmp"><div class="ch">已裝備</div></div>`;
      if (sel.key !== "weapon") btns = `<button class="pbtn plain" data-act="unequip">卸下</button>`;
    }
    if (sel.where === "bag") btns += `<button class="pbtn red" data-act="salvage">拆解 <small>+${r.scrap}星塵</small></button>`;
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
      else salvageAt(sel);
    }));
  }

  // 中間的主角小圖：拿著目前的武器
  const pc = $("portrait"), pctx = pc.getContext("2d"), pf = createFrame(48, 64), pimg = new ImageData(48, 64);
  function drawPortrait(st) {
    pf.color.fill(0);
    pf.light.fill(0);
    paintStar(pf, 24, 50, POSES.stand, false, { glow: 0 });
    composite(pf, pimg.data, null, 0.6);
    pctx.putImageData(pimg, 0, 0);
  }

  function show(want) {
    if (want) setPane(want);
    if (open) return;
    open = true;
    sfx("open");
    root.classList.remove("hidden");
    fit();
    render();
    playOpen(box, "bag");   // 第 7 批：背包從下面彈上來
  }
  function close() {
    if (!open) return;
    open = false;
    sfx("close");
    sel = null;
    root.classList.add("hidden");
    onClose?.();
  }
  addEventListener("keydown", (e) => {
    if (e.code === "Escape" && open) close();
  });

  return { show, close, render, get open() { return open; } };
}
