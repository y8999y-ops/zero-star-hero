// 背包畫面：左邊身上裝備＋數值，中間背包格子，右邊選中物品的詳細資料和比較。
// 手機：點一下選取，再點一次同一格就直接穿上。電腦：I / B / Tab 開關，Esc 關閉。
import { createFrame, composite } from "../../pixelfx/src/core/index.js";
import { SLOTS, RARITY, R, UNIQUES, describe, kindLabel } from "./items.js";
import { computeStats, compare, power, STAT_ROWS, xpNeed, MAX_LV } from "./stats.js";
import { BAG_SIZE } from "./save.js";
import { iconURL } from "./ui-art.js";
import { paintStar, POSES } from "./star.js";

const $ = (id) => document.getElementById(id);
const AUTO = ["關", "垃圾", "普通以下"];
const KIND_ORDER = { weapon: 0, head: 1, body: 2, hands: 3, feet: 4, acc: 5, junk: 6 };
const SLOT_ICON = { weapon: "core_dawn", head: "crown", body: "star", hands: "glove", feet: "boot", acc1: "shard", acc2: "shard" };

/**
 * profile：存檔資料（會直接修改）。onChange()：裝備或背包改變後呼叫（重算數值、存檔）。
 */
export function createInventory(profile, { onChange, onClose }) {
  const root = $("inv"), box = $("invBox");
  let sel = null;   // { where: "bag" | "equip", key }
  let open = false;

  // ---- 版面：固定 760×360，等比縮放塞進螢幕
  function fit() {
    const k = Math.min((innerWidth * 0.98) / 760, (innerHeight * 0.98) / 360, 2.2);
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
    el.addEventListener("click", () => pick({ where: "equip", key: s.id }));
    slotEls[s.id] = el;
  }
  // ---- 背包格
  const grid = $("grid"), cells = [];
  for (let i = 0; i < BAG_SIZE; i++) {
    const el = document.createElement("div");
    el.className = "slot";
    el.addEventListener("click", () => pick({ where: "bag", key: i }));
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
    render();
  }

  function equip(i) {
    const it = profile.inv[i];
    if (!it || it.kind === "junk") return;
    const c = compare(it, profile.equip, profile.lv);
    const old = profile.equip[c.slot];
    profile.equip[c.slot] = it;
    if (old) profile.inv[i] = old;
    else profile.inv.splice(i, 1);
    sel = { where: "equip", key: c.slot };
    changed();
  }
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
    say(`拆解 ${it.name}：碎屑 +${r.scrap}，金幣 +${r.coin}`);
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
    say(n ? `拆解了 ${n} 件垃圾和普通裝備：碎屑 +${scrap}，金幣 +${coin}` : "沒有可以拆的東西（比身上好的不會拆）。");
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
    $("invCoins").textContent = profile.coins;
    $("invScrap").textContent = profile.scrap;
    $("btnAuto").textContent = "自動拆解：" + AUTO[profile.auto];
    // 數值
    $("invStats").innerHTML = STAT_ROWS.filter(([k], i) => i < 5 || st[k]).map(([k, n, f]) => `<div><span>${n}</span><b>${f(st[k])}</b></div>`).join("")
      + `<div class="pw"><span>戰力</span><b>${Math.round(power(st) * 10)}</b></div>`;
    renderDetail(st);
    drawPortrait(st);
  }

  function renderDetail(st) {
    const el = $("invDetail"), it = itemAt(sel);
    if (!it) {
      el.innerHTML = `<div class="empty">點一下物品看詳細資料<br>再點一次就穿上<br><br><small>▲ 比身上的好　! 新撿到的</small></div>`;
      return;
    }
    const r = RARITY[it.rarity];
    const lines = describe(it).map(([t, txt, tag]) => `<div class="ln ${t}">${tag ? `<i>${tag}</i>` : ""}${txt}</div>`).join("");
    let cmp = "", btns = "";
    if (sel.where === "bag" && it.kind !== "junk") {
      const c = compare(it, profile.equip, profile.lv);
      const rows = STAT_ROWS.filter(([k]) => c.before[k] !== c.after[k]).map(([k, n, f]) => {
        const d = c.after[k] - c.before[k], good = d > 0;
        return `<div class="${good ? "g" : "b"}"><span>${n}</span>${f(c.before[k])} → ${f(c.after[k])}</div>`;
      });
      const old = profile.equip[c.slot];
      if (old?.unique) rows.push(`<div class="b">失去：${UNIQUES[old.unique].name} 的效果</div>`);
      cmp = `<div class="cmp"><div class="ch">換掉 ${old ? `<b style="color:${RARITY[old.rarity].color}">${old.name}</b>` : "（空）"}${c.better ? ' <em class="up">▲ 變強</em>' : c.worse ? ' <em class="down">▼ 變弱</em>' : ""}</div>${rows.join("") || "<div>數值沒有變化</div>"}</div>`;
      btns = `<button class="pbtn" data-act="equip">裝備</button>`;
    } else if (sel.where === "equip") {
      cmp = `<div class="cmp"><div class="ch">已裝備</div></div>`;
      if (sel.key !== "weapon") btns = `<button class="pbtn" data-act="unequip">卸下</button>`;
    }
    if (sel.where === "bag") btns += `<button class="pbtn red" data-act="salvage">拆解 <small>+${r.scrap}碎屑</small></button>`;
    const lore = it.unique ? `<div class="lore">${UNIQUES[it.unique].lore}</div>` : "";
    el.innerHTML = `<div class="dhead"><div class="slot r${it.rarity}"><img src="${iconURL(it.icon, 2)}"></div>
      <div><div class="dname" style="color:${r.color}">${it.name}${it.plus ? " +" + it.plus : ""}</div><div class="dsub">${r.name}・${kindLabel(it)}・物品等級 ${it.ilvl}</div></div></div>
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

  function show() {
    if (open) return;
    open = true;
    root.classList.remove("hidden");
    fit();
    render();
  }
  function close() {
    if (!open) return;
    open = false;
    sel = null;
    root.classList.add("hidden");
    onClose?.();
  }
  addEventListener("keydown", (e) => {
    if (e.code === "Escape" && open) close();
  });

  return { show, close, render, get open() { return open; } };
}
