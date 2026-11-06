// 城鎮的 RPG 視窗（2026-11-05；同日 UI 改版：少字多圖）：任務（公會／系統兩頁）、鍛造（強化／重鑄／拆解）、旅館（休息／料理）。
// 設計：同一種斜角像素牌子（ui-art.js menuPlate）當外框，依功能換主題色＋左上的徽章圖示：
//   公會＝金（盾牌）、系統＝青（四芒星）、鍛造＝橘紅（鐵砧）、旅館＝暖綠（碗）。
//   文字盡量換成圖：任務種類用圖示、獎勵用「圖示＋數字」小籌碼、強化等級用 10 格亮點、成功率用量條、按鈕是「圖示＋兩個字」。
// 對話當入口，正事在這些面板裡做。視窗打開時遊戲暫停（isWinOpen）。
import { playOpen } from "./ui-trans.js";
import { bump } from "./bump.js";
import { GUILD_MAX, SYSTEM, sysActive, accept, abandon, turnIn, isReady, refreshBoard } from "./quests.js";
import { isCore, subStep, coreTier, coreOf, CORES } from "./items.js";
import { SLOTS, RARITY, AFFIXES, rerollAffix, maxPlus, enhanceRate, enhanceCost, enhanceUp, fmtStat, mainValue } from "./items.js";
import { uiFx } from "./ui-fx.js";
import { TREES, PATHS, rank as treeRank, canBuy, buy, refund, freePts, pathSpent, CAP_NEED, costOf } from "./skilltree.js";
import { FORMS, CORE_STAT, CORE_COST, CARRY_MAX } from "./forms.js";
import * as parryFx from "../../pixelfx/src/fx/impacts/parry.js";
import * as burstFx from "../../pixelfx/src/fx/pickups/collect-burst.js";
import * as questFx from "../../pixelfx/src/fx/ui/quest-complete.js";
import * as coinFx from "../../pixelfx/src/fx/ui/coin-collect.js";
// 第 7 批：在某個元素中心播介面特效
const fxAt = (el, mod, opts) => { if (!el) return; const r = el.getBoundingClientRect(); uiFx(mod, opts, r.left + r.width / 2, r.top + r.height / 2); };
import { LAYOUTS } from "./stages.js";
import { iconURL } from "./ui-art.js";

// ---- 料理：吃了下一趟冒險有效（回到城鎮時用掉），一次只能一道
export const MEALS = {
  stew: { name: "星光燉肉", icon: "stew", buff: ["q_kill", "攻擊 +10%"], cost: 80, apply: (s) => { s.atk = Math.round(s.atk * 1.1); } },
  soup: { name: "菇菇濃湯", icon: "soup", buff: ["heart", "生命 +20%"], cost: 60, apply: (s) => { s.maxHp = Math.round(s.maxHp * 1.2); } },
  pie: { name: "幸運蘋果派", icon: "pie", buff: ["coin", "掉寶 +25%"], cost: 100, apply: (s) => { s.mf += 25; } },
};
// 舊程式用的說明文字
for (const m of Object.values(MEALS)) m.desc = m.buff[1];
// ---- 強化：規則在 items.js（上限看稀有度、每 +5 開副屬性、+11 以後可能失敗）
export const rerollCost = (it) => ({ scrap: 6 + it.rarity * 3, coins: 40 + it.rarity * 40 });

// ---- 任務的短標題＋圖示（從任務資料算，不用長句子）
const ENEMY = { slime: "史萊姆", bat: "蝙蝠", trash: "垃圾桶怪", elite: "菁英魔物" };
export function questLook(q) {
  if (q.kind === "kill") return { icon: "q_kill", label: `${ENEMY[q.enemy]}` };
  if (q.kind === "junk") return { icon: "q_junk", label: "撿垃圾" };
  if (q.kind === "clear") return { icon: q.stage === "1-4" ? "guild" : "q_clear", label: `${q.stage} ${LAYOUTS[q.stage]?.name ?? ""}`, tag: q.nodeath ? "不能死" : null };
  return { icon: "core_slime", label: "吸收魔物核" };
}
const SYS_ICON = { out11: "star", reg: "guild", guild1: "seal", core1: "core_slime", forge2: "hammer", meal1: "bowl", reroll1: "dice", rankE: "guild", forms3: "star", boss1: "q_kill" };

let ctx = null, root = null, open = false, resolveClose = null;
export const isWinOpen = () => open;

const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const ico = (name, cls = "ico") => `<img class="${cls}" src="${iconURL(name, 2)}" alt="">`;
const chip = (icon, n, cls = "") => `<span class="chip ${cls}">${ico(icon)}${n}</span>`;
const chips = (r) => [r.coins && chip("coin", r.coins), r.scrap && chip("scrap", r.scrap), r.xp && chip("xp", r.xp)].filter(Boolean).join("");
const costChips = (c, P) => chip("scrap", c.scrap, P.scrap < c.scrap ? "lack" : "") + chip("coin", c.coins, P.coins < c.coins ? "lack" : "");
/** 圖示按鈕（圖示＋兩個字），kind：go 主要、bad 危險、plain 一般 */
const ibtn = (icon, label, onClick, kind = "go") => {
  const b = h("button", `ibtn ${kind}`, `${ico(icon)}<span>${label}</span>`);
  b.addEventListener("click", (e) => { e.stopPropagation(); onClick(); });
  return b;
};

/** ctx：{ profile, sfx, grant(reward), unlocked(), afterChange(), openBag(), onQuest(), RANK(), flash(col), shake(t, a) } */
export function initTownUI(c) {
  ctx = c;
  root = h("div", "win hidden");
  root.innerHTML = '<div class="win-box"><div class="win-head"><span class="win-emb"></span><b class="win-ttl"></b><div class="win-tabs"></div><span class="win-money"></span><button class="win-x" aria-label="關閉"></button></div><div class="win-body"></div><div class="win-msg"></div></div>';
  document.getElementById("stage").appendChild(root);
  const x = root.querySelector(".win-x");
  x.innerHTML = ico("close");
  x.addEventListener("click", (e) => { e.stopPropagation(); close(); });
  root.addEventListener("pointerdown", (e) => e.stopPropagation());
}
function close() {
  if (!open) return;
  open = false;
  root.classList.add("hidden");
  ctx.sfx("close");
  ctx.afterChange();
  resolveClose?.();
}
let state = null, lastMoney = [];
function render() {
  const { title, tabs, tab } = state, t = tabs.find((x) => x.id === tab);
  const box = root.querySelector(".win-box");
  box.className = "win-box theme-" + (t.theme ?? state.theme);
  root.querySelector(".win-emb").innerHTML = ico(t.emblem ?? state.emblem, "emb");
  root.querySelector(".win-ttl").textContent = t.title ?? title;
  const tb = root.querySelector(".win-tabs");
  tb.innerHTML = "";
  if (tabs.length > 1) for (const x of tabs) {
    const b = h("button", "win-tab" + (x.id === tab ? " on" : ""), `${ico(x.icon)}<span>${x.label}</span>`);
    b.addEventListener("click", (e) => { e.stopPropagation(); state.tab = x.id; ctx.sfx("ui"); render(); });
    tb.appendChild(b);
  }
  const P = ctx.profile;
  const mEl = root.querySelector(".win-money");
  mEl.innerHTML = chip("coin", P.coins) + chip("scrap", P.scrap);
  // 第 7 批：金幣、星塵有變就跳一下
  const chipsEl = mEl.querySelectorAll(".chip");
  [P.coins, P.scrap].forEach((v, i) => { if (lastMoney[i] != null && lastMoney[i] !== v) bump(chipsEl[i], v > lastMoney[i]); lastMoney[i] = v; });
  const body = root.querySelector(".win-body");
  body.innerHTML = "";
  t.render(body);
}
const msg = (text, good = true) => { const m = root.querySelector(".win-msg"); m.textContent = text; m.className = "win-msg on " + (good ? "good" : "bad"); clearTimeout(msg.t); msg.t = setTimeout(() => (m.className = "win-msg"), 2200); };
function show(title, theme, emblem, tabs, tab) {
  // 使用者 2026-11-05 回報：打完王回城鎮方向鍵不能動——已經有視窗開著時又開一個，前一個「等關閉」的人會永遠等不到（busy 卡住）。先把它送出去
  if (open) { const r = resolveClose; resolveClose = null; r?.(); }
  state = { title, theme, emblem, tabs, tab: tab ?? tabs[0].id };
  open = true;
  root.classList.remove("hidden");
  ctx.sfx("open");
  render();
  // 第 7 批：開啟轉場依照視窗主題（公會卷軸、工坊鐵門、旅館木門、系統全息）
  playOpen(root.querySelector(".win-box"), tabs.find((x) => x.id === state.tab).theme ?? theme);
  return new Promise((r) => (resolveClose = r));
}
const bar = (have, need) => `<div class="qbar"><i style="width:${Math.round((have / need) * 100)}%"></i><span>${have}/${need}</span></div>`;
const say = (who, text) => h("div", "wsay", `<b>${who}</b>${text}`);

// ================= 任務 =================
/** 任務視窗。atGuild：在公會（可以接任務、交付、放棄） */
// 使用者 2026-11-05：追蹤任務——每張任務卡右邊一顆星，亮＝追蹤中，顯示在左上角頭像下方
// 使用者 2026-11-06：主線（系統任務）固定顯示、不佔名額；支線（公會任務）一次只能追蹤 1 個——點別張的星星就換過去；
//   沒有追蹤中的支線時，新接的自動追蹤。Q.tracked：["公會任務 id"]（最多 1 個）
export const TRACK_MAX = 1;
export function openQuests(atGuild = false, tab = "guild") {
  const P = ctx.profile, Q = P.quests;
  if (atGuild) refreshBoard(Q, ctx.unlocked());
  const tracked = (Q.tracked ??= []);
  const trackBtn = (key) => {
    const on = tracked.includes(key), b = ibtn("star", "", () => {
      const i = tracked.indexOf(key);
      if (i >= 0) tracked.splice(i, 1);
      else { tracked.length = 0; tracked.push(key); msg("改追蹤這個任務"); }
      ctx.sfx("ui"); ctx.onQuest(); render();
    }, "trk mini" + (on ? " on" : ""));
    b.title = on ? "取消追蹤" : "追蹤（顯示在左上角）";
    return b;
  };
  const card = (q, offer) => {
    const L = questLook(q), ready = !offer && isReady(q);
    const c = h("div", "qcard" + (offer ? " offer" : "") + (ready ? " ready" : ""));
    c.title = q.desc;
    c.innerHTML = `<div class="qic">${ico(L.icon, "big")}</div>
      <div class="qmain"><div class="qt">${L.label}${L.tag ? `<em class="tag bad">${L.tag}</em>` : ""}${ready ? '<em class="tag ok">完成</em>' : ""}</div>${offer ? "" : bar(q.have, q.need)}${offer && q.need > 1 ? `<div class="qneed">×${q.need}</div>` : ""}</div>
      <div class="qrw">${chips(q.reward)}</div>`;
    const act = h("div", "qact");
    if (!offer) act.appendChild(trackBtn(q.id));
    if (offer) {
      const b = ibtn("check", "接受", () => { if (accept(Q, q.id)) { if (tracked.length < TRACK_MAX && !tracked.includes(q.id)) tracked.push(q.id); ctx.sfx("pickup"); msg(`接下了：${L.label}`); ctx.onQuest(); render(); } }); 
      act.appendChild(b);
    } else if (atGuild && ready) act.appendChild(ibtn("seal", "交付", () => {
      const r = turnIn(Q, q.id);
      if (!r) return;
      P.guild.done++;
      ctx.grant(r);
      ctx.sfx("levelup");
      msg("交付完成！");
      ctx.onQuest();
      render();
      // 第 7 批：交付特效——視窗中間蓋一條「QUEST COMPLETE」緞帶，金幣飛向右上的錢
      fxAt(root.querySelector(".win-box"), questFx, { seed: P.guild.done });
      if (r.coins) fxAt(root.querySelector(".win-money .chip"), coinFx, { count: 8, seed: P.guild.done });
    }));
    else if (atGuild) act.appendChild(ibtn("close", "", () => { abandon(Q, q.id); ctx.sfx("close"); msg("放棄了任務", false); render(); }, "bad mini"));
    else if (ready) act.appendChild(h("span", "qgo", `${ico("guild")}回公會`));
    c.appendChild(act);
    return c;
  };
  const guildTab = (body) => {
    const G = P.guild, [rank, next] = ctx.RANK();
    const prev = [0, 3, 8, 15, 25, 40, 60].filter((n) => n <= G.done).pop() ?? 0;
    const head = h("div", "rankbar");
    head.innerHTML = `<div class="rank">${ico("guild", "big")}<b>${rank}</b></div>
      <div class="rankp">${next ? bar(G.done - prev, next[1] - prev) : bar(1, 1)}<small>${next ? `下一級 ${next[0]}` : "最高級"}</small></div>
      <div class="slots"><small>進行中 ${Q.active.length}</small></div>`;
    body.appendChild(head);
    if (!Q.active.length && !atGuild) body.appendChild(say("系統", "還沒接任務。去公會找波波。"));
    for (const q of Q.active) body.appendChild(card(q, false));
    if (atGuild) {
      body.appendChild(h("div", "qsec", `${ico("paper")}任務板`));
      for (const q of Q.board) body.appendChild(card(q, true));
    }
  };
  const sysTab = (body) => {
    body.appendChild(say("系統", "這是你的主線。一次一件，做完我再告訴你下一件。"));
    for (const s of sysActive(P)) {
      const c = h("div", "qcard sys");
      c.title = s.desc;
      c.innerHTML = `<div class="qic">${ico(SYS_ICON[s.id] ?? "xp", "big")}</div><div class="qmain"><div class="qt">${s.title}</div><div class="qd">${s.desc}</div></div><div class="qrw">${chips(s.reward)}</div>`;
      body.appendChild(c);
    }
    const done = SYSTEM.filter((s) => Q.sysDone[s.id]);
    const grid = h("div", "sysdone");
    grid.innerHTML = `<small>已完成 ${done.length}/${SYSTEM.length}</small>` + SYSTEM.map((s) => `<span class="${Q.sysDone[s.id] ? "on" : ""}" title="${s.title}">${ico(SYS_ICON[s.id] ?? "xp")}</span>`).join("");
    body.appendChild(grid);
  };
  // 主線一開始就有；支線（公會）要跟波波說話登記之後才出現
  const tabs = [{ id: "sys", label: "主線", icon: "xp", theme: "sys", emblem: "xp", title: "主線任務", render: sysTab }];
  if (P.guild.registered) tabs.push({ id: "guild", label: "支線", icon: "guild", title: atGuild ? "冒險者公會" : "支線任務", render: guildTab });
  return show(atGuild ? "冒險者公會" : "任務", "guild", "guild", tabs, P.guild.registered ? tab : "sys");
}

// ================= 鍛造 =================
// 使用者 2026-11-05：強化、重鑄只能用在「身上穿著的」裝備（背包裡的要先穿上）
function itemsForForge(P) {
  return SLOTS.map((s) => P.equip[s.id]).filter(Boolean).map((it) => ({ it, eq: true }));
}
const itemHead = (it, eq) => `<span class="fimg">${ico(it.icon, "big")}${eq ? '<i class="eqmark">E</i>' : ""}</span><span class="fn" style="color:${RARITY[it.rarity].color}">${it.name}</span>`;
/** 強化進度：+p／上限，下面每 +5 一顆菱形（亮＝已經開過副屬性） */
const pips = (p, max, step = 5) => `<span class="plv"><b>+${p}</b>/${max}</span><span class="pips">${Array.from({ length: max / step }, (_, i) => `<i class="${p >= (i + 1) * step ? "on" : ""}"></i>`).join("")}</span>`;
// 特效顏色：打鐵火花（金）、失敗（灰）、開副屬性（看稀有度）
const SPARK = ["#3a1a06", "#8a4a10", "#e0901c", "#ffc83a", "#ffe98a", "#fff8d8", "#ffffff"];
const DULL = ["#141018", "#2a2430", "#463e4c", "#6a6070", "#8a8090", "#a8a0ae", "#c0bac4"];
const gauge = (rate) => `<span class="gauge" title="成功率"><i style="width:${rate}%;background:${rate >= 80 ? "#6ad06a" : rate >= 50 ? "#e8c040" : "#e0603a"}"></i><b>${rate}%</b></span>`;
export function openForge() {
  const P = ctx.profile;
  const enhanceTab = (body) => {
    body.appendChild(say("岩叔", "……只打你身上穿著的。每 +5 會多一條能力，星核是每 +10，但能打到兩倍高、核心效果會升階。+10 以後會失敗，失敗只會少材料。"));
    if (!itemsForForge(P).length) body.appendChild(say("岩叔", "……你身上什麼都沒穿。先去背包把裝備穿上。"));
    for (const { it, eq } of itemsForForge(P)) {
      const p = it.plus ?? 0, max = maxPlus(it), c = enhanceCost(p, it), rate = enhanceRate(p), top = p >= max;
      const row = h("div", "frow");
      row.innerHTML = `<div class="fhead">${itemHead(it, eq)}</div><div class="fmid">${pips(p, max, subStep(it))}${isCore(it) ? `<span class="ctier">第 ${coreTier(it)} 階</span>` : ""}${top ? '<span class="maxed">MAX</span>' : gauge(rate)}</div><div class="fcost">${top ? "" : costChips(c, P)}</div>`;
      if (!top) row.appendChild(ibtn("hammer", "強化", () => {
        if (P.scrap < c.scrap || P.coins < c.coins) { ctx.sfx("close"); return msg("材料不夠", false); }
        P.scrap -= c.scrap; P.coins -= c.coins;
        const r = row.querySelector(".fimg").getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
        ctx.shake(0.2, 2);
        if (Math.random() * 100 < rate) {
          const before = mainValue(it), up = enhanceUp(it);
          P.quests.stats.enhanceMax = Math.max(P.quests.stats.enhanceMax, it.plus);
          ctx.sfx("chime"); ctx.flash("#ff9a40");
          uiFx(parryFx, { palette: SPARK, light: 0.5, seed: it.plus }, x, y);
          // 8a：星核升階（+10、+20…）——核心效果變強
          if (isCore(it) && it.plus % 10 === 0) { const c = coreOf(it); setTimeout(() => msg(`核心效果升到第 ${c.tier} 階：${CORES[c.id].text(c.x)}`), 1300); }
          if (up) {
            // 每 +5：開副屬性（新增一條，或提升一條）
            const col = RARITY[it.rarity].color;
            setTimeout(() => { uiFx(burstFx, { palette: ["#1a1430", col, col, "#ffffff"], light: 0.6, seed: it.plus }, x, y); ctx.sfx("levelup"); }, 180);
            msg(up.kind === "add" ? `+${it.plus}！新增 ${fmtStat(up.id, up.after)}` : `+${it.plus}！${AFFIXES[up.id].name} ${fmtStat(up.id, up.before).split(" ")[1]} → ${fmtStat(up.id, up.after).split(" ")[1]}`);
          } else msg(before === mainValue(it) ? `成功！+${it.plus}` : `成功！+${it.plus}　${AFFIXES[it.main.id].name} ${before} → ${mainValue(it)}`);
        } else {
          ctx.sfx("clank");
          uiFx(parryFx, { palette: DULL, light: 0.1, seed: p }, x, y);
          row.classList.add("fail");
          msg("失敗……材料沒了", false);
        }
        ctx.onQuest();
        if (row.classList.contains("fail")) setTimeout(render, 380); else render();
      }));
      body.appendChild(row);
    }
  };
  const rerollTab = (body) => {
    body.appendChild(say("岩叔", "……選一條不要的，我重打。"));
    const list = itemsForForge(P).filter(({ it }) => it.affixes?.length && !it.unique);
    if (!list.length) body.appendChild(say("岩叔", "……你身上沒有能重打的東西。背包裡的要先穿上。"));
    for (const { it, eq } of list) {
      const c = rerollCost(it), card = h("div", "fcard");
      card.innerHTML = `<div class="frow top"><div class="fhead">${itemHead(it, eq)}</div><div class="fcost">${costChips(c, P)}</div></div>`;
      it.affixes.forEach((a, i) => {
        const row = h("div", "faff");
        row.innerHTML = `<span class="atext">${AFFIXES[a.id].fmt(a.v)}</span>`;
        row.appendChild(ibtn("dice", "重鑄", () => {
          if (P.scrap < c.scrap || P.coins < c.coins) { ctx.sfx("close"); return msg("材料不夠", false); }
          P.scrap -= c.scrap; P.coins -= c.coins;
          const na = rerollAffix(it, i);
          P.quests.stats.rerolls++;
          ctx.sfx("chime"); ctx.flash("#a8f0ff");
          msg(`→ ${AFFIXES[na.id].fmt(na.v)}`);
          ctx.onQuest();
          const rr = row.getBoundingClientRect();
          render();
          // 第 7 批：重鑄特效——那一行爆一圈青色光點，新的副屬性閃一下
          uiFx(burstFx, { palette: ["#0c2a60", "#3ab8f0", "#9af0ff", "#ffffff"], light: 0.5, seed: P.quests.stats.rerolls }, rr.left + rr.width * 0.3, rr.top + rr.height / 2);
          const nr = [...root.querySelectorAll(".faff")].find((x) => Math.abs(x.getBoundingClientRect().top - rr.top) < 4);
          nr?.querySelector(".atext")?.classList.add("newaff");
        }, "plain"));
        card.appendChild(row);
      });
      body.appendChild(card);
    }
  };
  const salvageTab = (body) => {
    body.appendChild(say("岩叔", "……不要的拆一拆，變星塵。"));
    const big = h("div", "bigcard");
    big.innerHTML = `${ico("scrap", "huge")}<div class="bign">${P.scrap}</div><small>星塵＝強化、重鑄的材料</small>`;
    big.appendChild(ibtn("bag", "去背包拆", () => { close(); ctx.openBag(); }));
    body.appendChild(big);
  };
  return show("岩叔的工坊", "forge", "anvil", [
    { id: "up", label: "強化", icon: "hammer", render: enhanceTab },
    { id: "re", label: "重鑄", icon: "dice", render: rerollTab },
    { id: "sal", label: "拆解", icon: "scrap", render: salvageTab },
  ]);
}

// ================= 旅館 =================
export function openInn({ rest }) {
  const P = ctx.profile;
  const restTab = (body) => {
    body.appendChild(say("菇媽", "累了就睡一晚吧～"));
    const big = h("div", "bigcard");
    big.innerHTML = `${ico("moon", "huge")}<div class="perks"><span>${ico("heart")}生命全滿</span><span>${ico("check")}存檔</span><span>${ico("paper")}任務板換新</span></div>`;
    big.appendChild(ibtn("moon", "睡一晚", async () => { close(); await rest(); }));
    body.appendChild(big);
  };
  const foodTab = (body) => {
    body.appendChild(say("菇媽", "一次吃一道，效果到下一趟冒險結束～"));
    const grid = h("div", "foods");
    for (const [id, m] of Object.entries(MEALS)) {
      const c = h("div", "food" + (P.meal === id ? " on" : ""));
      c.innerHTML = `${ico(m.icon, "huge")}<b>${m.name}</b><span class="chip buff">${ico(m.buff[0])}${m.buff[1]}</span>${chip("coin", m.cost, P.coins < m.cost ? "lack" : "")}`;
      c.appendChild(P.meal === id ? h("span", "eaten", `${ico("check")}吃了`) : ibtn("bowl", "吃", () => {
        if (P.coins < m.cost) { ctx.sfx("close"); return msg("金幣不夠喔～", false); }
        P.coins -= m.cost;
        P.meal = id;
        P.quests.stats.meals++;
        ctx.sfx("pickup");
        msg(`${m.name}：${m.buff[1]}`);
        ctx.onQuest();
        render();
      }));
      grid.appendChild(c);
    }
    body.appendChild(grid);
  };
  return show("菇媽的旅館", "inn", "bowl", [
    { id: "rest", label: "休息", icon: "moon", render: restTab },
    { id: "food", label: "料理", icon: "stew", render: foodTab },
  ]);
}

// ================= 形態（使用者 2026-11-06「另外做一個專門切換形態的介面」） =================
/** 「形態」分頁（在技能樹視窗裡，第一頁）：上面帶在身上的 3 格，下面每個形態一張卡。
 *  使用者 2026-11-06：這一頁只能換帶哪幾個（城鎮裡【帶上】／【放下】），不能在這裡變身 */
function carryPage(body, render) {
  const P = ctx.profile, F = P.forms;
  const cur = ctx.curForm?.(), owned = Object.keys(FORMS).filter((id) => F.owned[id]);
  const top = h("div", "fm-carry", `<div class="fm-ttl">帶在身上 <em>${F.carry.length}/${CARRY_MAX}</em>${ctx.inTown ? "" : '<small>（回城鎮才能換帶哪幾個）</small>'}</div>`);
  const row = h("div", "fm-slots");
  for (let i = 0; i < CARRY_MAX; i++) {
    const id = F.carry[i], s = h("div", "fm-slot" + (id === cur ? " on" : "") + (id ? "" : " empty"));
    if (id) { s.appendChild(ctx.portrait(id, 1)); s.appendChild(h("b", "", `${i + 1}`)); s.style.setProperty("--fc", FORMS[id].color); }
    else s.innerHTML = "<i>空</i>";
    row.appendChild(s);
  }
  top.appendChild(row);
  body.appendChild(top);
  const grid = h("div", "fm-grid");
  for (const id of owned) {
    const D = FORMS[id], carried = F.carry.includes(id), card = h("div", "fm-card" + (id === cur ? " on" : "") + (carried ? " carried" : ""));
    card.style.setProperty("--fc", D.color);
    const pic = h("div", "fm-pic"); pic.appendChild(ctx.portrait(id, 2)); card.appendChild(pic);
    card.appendChild(h("div", "fm-info", `<div class="fm-name">${D.name}${id === cur ? '<span class="fm-tag">目前</span>' : carried ? '<span class="fm-tag dim">帶著</span>' : ""}</div><div class="fm-desc">${D.desc}</div>`));
    const btns = h("div", "fm-btns");
    if (ctx.inTown) {
      if (carried) {
        const b = ibtn("close", "放下", () => {
          if (id === cur) return msg("正在用的形態不能放下", false);
          if (F.carry.length <= 1) return msg("至少要帶一個", false);
          F.carry.splice(F.carry.indexOf(id), 1); ctx.sfx("ui"); ctx.onCarry?.(); render();
        }, "plain");
        if (id === cur) b.classList.add("off");
        btns.appendChild(b);
      } else {
        const b = ibtn("check", "帶上", () => {
          if (F.carry.length >= CARRY_MAX) return msg(`最多帶 ${CARRY_MAX} 個，先放下一個`, false);
          F.carry.push(id); ctx.sfx("pickup"); ctx.onCarry?.(); msg(`帶上${D.name}`); render();
        }, "plain");
        if (F.carry.length >= CARRY_MAX) b.classList.add("off");
        btns.appendChild(b);
      }
    }
    card.appendChild(btns);
    grid.appendChild(card);
  }
  body.appendChild(grid);
}

// ================= 形態技能樹（第 4 批） =================
/** 技能樹視窗：每個形態一頁；三條路線一欄一欄往下，最終節點在最下面。點節點看說明、投入點數。城鎮裡可以洗點。 */
export function openTree(form, tab) {
  const P = ctx.profile, owned = Object.keys(FORMS).filter((id) => P.forms.owned[id]);
  let sel = null;
  const page = (id) => (body) => {
    if (!TREES[id]) { body.appendChild(say("系統", `${FORMS[id].name}的技能樹下一批開放。點數先幫你存著：${freePts(id)} 點。`)); return; }
    // 使用者 2026-11-05「技能點要往下翻才能點」：左邊技能樹、右邊說明＋投入鍵，同一個畫面不用捲；點已選的節點再點一下＝直接投入
    const wrap = h("div", "tree-wrap"), left = h("div", "tree-left");
    const head = h("div", "tree-head", `<span class="tpts">${ico("star")}<b>${freePts(id)}</b> 點</span>`);
    // 使用者 2026-11-06：魔物核 2 顆換 1 點——那個形態的技能點，或那種核的屬性
    const cs = CORE_STAT[id];
    if (cs) {
      const f = P.forms.owned[id], have = f.cores ?? 0, row = h("span", "tcores", `${ico("core_" + id)}<b>${have}</b> 顆核`);
      const ok = have >= CORE_COST;
      const b1 = ibtn("star", `技能點（${CORE_COST} 顆）`, () => { if ((f.cores ?? 0) < CORE_COST) return msg("核不夠", false); f.cores -= CORE_COST; f.pts = (f.pts ?? 0) + 1; ctx.sfx("pickup"); msg("技能點 +1"); ctx.onTree?.(); ctx.afterChange?.(); render(); }, "plain mini2");
      const b2 = ibtn(cs.id === "hp" ? "st_hp" : cs.id === "def" ? "st_def" : "st_crit", `${cs.label}（${CORE_COST} 顆）`, () => { if ((f.cores ?? 0) < CORE_COST) return msg("核不夠", false); f.cores -= CORE_COST; P.coreBonus[cs.id] = Number(((P.coreBonus[cs.id] ?? 0) + cs.v).toFixed(2)); ctx.sfx("pickup"); msg(cs.label); ctx.onTree?.(); ctx.afterChange?.(); render(); }, "plain mini2");
      if (!ok) { b1.classList.add("off"); b2.classList.add("off"); }
      row.append(b1, b2);
      head.appendChild(row);
    }
    if (ctx.inTown) head.appendChild(ibtn("dice", "洗點", () => { refund(id); sel = null; ctx.sfx("ui"); msg("點數全部拿回來了"); ctx.onTree?.(); render(); }, "plain"));
    left.appendChild(head);
    const grid = h("div", "tree-grid");
    for (let p = 0; p < 3; p++) {
      const col = h("div", "tree-col", `<div class="tree-path">${PATHS[p]}<em>${pathSpent(id, p)}</em></div>`);
      for (const n of TREES[id].filter((x) => x.path === p)) col.appendChild(nodeEl(id, n));
      grid.appendChild(col);
    }
    // 使用者 2026-11-06：形態被動＝路線旁邊一顆節點（只有這個形態時有效，最高 10 級、越後面越貴），點它右邊看說明
    const pn = TREES[id].find((x) => x.path === 4);
    if (pn) {
      const col = h("div", "tree-col pas", `<div class="tree-path">被動</div>`);
      col.appendChild(nodeEl(id, pn));
      grid.appendChild(col);
    }
    left.appendChild(grid);
    const cap = TREES[id].find((x) => x.path === 3), capRow = h("div", "tree-cap");
    capRow.appendChild(nodeEl(id, cap));
    capRow.appendChild(h("small", "", `三條路線各 ${CAP_NEED} 點解鎖`));
    left.appendChild(capRow);
    wrap.appendChild(left);
    // 選中的節點：說明＋投入
    const n = sel && TREES[id].find((x) => x.id === sel);
    const info = h("div", "tree-info");
    if (n) {
      const r = treeRank(id, n.id);
      info.innerHTML = `<div class="tn">${ico(n.icon, "big")}<b>${n.name}</b><span>${r}/${n.max}</span></div><div class="td">${n.desc(Math.max(1, r))}</div>`;
      if (r < n.max) {
        const b = ibtn("check", `投入 ${costOf(n, r)} 點`, () => invest(id, n));
        if (!canBuy(id, n.id)) b.classList.add("off");
        info.appendChild(b);
      } else info.appendChild(h("span", "maxed", "MAX"));
    } else info.innerHTML = '<div class="td dim">點一個節點看說明</div>';
    wrap.appendChild(info);
    body.appendChild(wrap);
  };
  function invest(id, n) {
    const el = document.querySelector(`[data-node="${n.id}"]`)?.getBoundingClientRect();
    if (treeRank(id, n.id) >= n.max) return;
    if (!buy(id, n.id)) { ctx.sfx("close"); return msg(n.path === 3 ? `三條路線各要 ${CAP_NEED} 點` : "點數不夠", false); }
    ctx.sfx("levelup");
    if (el) uiFx(burstFx, { palette: ["#1a1430", FORMS[id].color, FORMS[id].color, "#ffffff"], light: 0.6 }, el.left + el.width / 2, el.top + el.height / 2);
    msg(`${n.name} ${treeRank(id, n.id)}/${n.max}`);
    ctx.onTree?.();
    render();
  }
  function nodeEl(id, n) {
    const r = treeRank(id, n.id), el = h("button", "tnode" + (r ? " on" : "") + (r >= n.max ? " full" : "") + (canBuy(id, n.id) ? " can" : "") + (sel === n.id ? " sel" : ""));
    el.dataset.node = n.id;
    el.innerHTML = `${ico(n.icon, "big")}<span class="tpip">${n.max > 1 ? `${r}/${n.max}` : r ? "✓" : n.cost}</span>`;
    el.title = n.name;
    el.addEventListener("click", (e) => { e.stopPropagation(); if (sel === n.id && canBuy(id, n.id)) return invest(id, n); sel = n.id; ctx.sfx("ui"); render(); });
    return el;
  }
  const tabs = [{ id: "carry", label: "形態", icon: "core_slime", render: (body) => carryPage(body, render) },
    ...owned.map((id) => ({ id, label: FORMS[id].name, icon: id === "star" ? "star" : "core_" + id, render: page(id) }))];
  return show("形態技能樹", "sys", "star", tabs, tab === "carry" ? "carry" : form && owned.includes(form) ? form : owned[0]);
}
