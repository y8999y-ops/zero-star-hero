// 城鎮的 RPG 視窗（2026-11-05；同日 UI 改版：少字多圖）：任務（公會／系統兩頁）、鍛造（強化／重鑄／拆解）、旅館（休息／料理）。
// 設計：同一種斜角像素牌子（ui-art.js menuPlate）當外框，依功能換主題色＋左上的徽章圖示：
//   公會＝金（盾牌）、系統＝青（四芒星）、鍛造＝橘紅（鐵砧）、旅館＝暖綠（碗）。
//   文字盡量換成圖：任務種類用圖示、獎勵用「圖示＋數字」小籌碼、強化等級用 10 格亮點、成功率用量條、按鈕是「圖示＋兩個字」。
// 對話當入口，正事在這些面板裡做。視窗打開時遊戲暫停（isWinOpen）。
import { GUILD_MAX, SYSTEM, sysActive, accept, abandon, turnIn, isReady, refreshBoard } from "./quests.js";
import { SLOTS, RARITY, AFFIXES, rerollAffix } from "./items.js";
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
// ---- 強化：成功率隨等級下降，失敗只扣材料、不會降級
export const enhanceRate = (p) => [100, 100, 90, 80, 70, 60, 50, 40, 30, 25][p] ?? 0;
export const enhanceCost = (p) => ({ scrap: 3 + p * 3, coins: 20 + p * 25 });
export const rerollCost = (it) => ({ scrap: 6 + it.rarity * 3, coins: 40 + it.rarity * 40 });

// ---- 任務的短標題＋圖示（從任務資料算，不用長句子）
const ENEMY = { slime: "史萊姆", bat: "蝙蝠", trash: "垃圾桶怪", elite: "菁英魔物" };
export function questLook(q) {
  if (q.kind === "kill") return { icon: "q_kill", label: `${ENEMY[q.enemy]}` };
  if (q.kind === "junk") return { icon: "q_junk", label: "撿垃圾" };
  if (q.kind === "clear") return { icon: q.stage === "1-4" ? "guild" : "q_clear", label: `${q.stage} ${LAYOUTS[q.stage]?.name ?? ""}`, tag: q.nodeath ? "不能死" : null };
  return { icon: "core_slime", label: "吸收魔物核" };
}
const SYS_ICON = { reg: "guild", guild1: "seal", core1: "core_slime", forge2: "hammer", meal1: "bowl", reroll1: "dice", rankE: "guild", forms3: "star", boss1: "q_kill" };

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
let state = null;
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
  root.querySelector(".win-money").innerHTML = chip("coin", P.coins) + chip("scrap", P.scrap);
  const body = root.querySelector(".win-body");
  body.innerHTML = "";
  t.render(body);
}
const msg = (text, good = true) => { const m = root.querySelector(".win-msg"); m.textContent = text; m.className = "win-msg on " + (good ? "good" : "bad"); clearTimeout(msg.t); msg.t = setTimeout(() => (m.className = "win-msg"), 2200); };
function show(title, theme, emblem, tabs, tab) {
  state = { title, theme, emblem, tabs, tab: tab ?? tabs[0].id };
  open = true;
  root.classList.remove("hidden");
  ctx.sfx("open");
  render();
  return new Promise((r) => (resolveClose = r));
}
const bar = (have, need) => `<div class="qbar"><i style="width:${Math.round((have / need) * 100)}%"></i><span>${have}/${need}</span></div>`;
const say = (who, text) => h("div", "wsay", `<b>${who}</b>${text}`);

// ================= 任務 =================
/** 任務視窗。atGuild：在公會（可以接任務、交付、放棄） */
export function openQuests(atGuild = false, tab = "guild") {
  const P = ctx.profile, Q = P.quests;
  if (atGuild) refreshBoard(Q, ctx.unlocked());
  const card = (q, offer) => {
    const L = questLook(q), ready = !offer && isReady(q);
    const c = h("div", "qcard" + (offer ? " offer" : "") + (ready ? " ready" : ""));
    c.title = q.desc;
    c.innerHTML = `<div class="qic">${ico(L.icon, "big")}</div>
      <div class="qmain"><div class="qt">${L.label}${L.tag ? `<em class="tag bad">${L.tag}</em>` : ""}${ready ? '<em class="tag ok">完成</em>' : ""}</div>${offer ? "" : bar(q.have, q.need)}${offer && q.need > 1 ? `<div class="qneed">×${q.need}</div>` : ""}</div>
      <div class="qrw">${chips(q.reward)}</div>`;
    const act = h("div", "qact");
    if (offer) {
      const b = ibtn("check", "接受", () => { if (accept(Q, q.id)) { ctx.sfx("pickup"); msg(`接下了：${L.label}`); ctx.onQuest(); render(); } else msg(`最多同時 ${GUILD_MAX} 個`, false); });
      if (Q.active.length >= GUILD_MAX) b.disabled = true;
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
      <div class="slots">${Array.from({ length: GUILD_MAX }, (_, i) => `<i class="${i < Q.active.length ? "on" : ""}"></i>`).join("")}</div>`;
    body.appendChild(head);
    if (!Q.active.length && !atGuild) body.appendChild(say("系統", "還沒接任務。去公會找波波。"));
    for (const q of Q.active) body.appendChild(card(q, false));
    if (atGuild) {
      body.appendChild(h("div", "qsec", `${ico("paper")}任務板`));
      for (const q of Q.board) body.appendChild(card(q, true));
    }
  };
  const sysTab = (body) => {
    body.appendChild(say("系統", "這是我幫你排的成長路線。照著做。"));
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
  return show(atGuild ? "冒險者公會" : "任務", "guild", "guild", [
    { id: "guild", label: "公會", icon: "guild", render: guildTab },
    { id: "sys", label: "系統", icon: "xp", theme: "sys", emblem: "xp", title: "系統任務", render: sysTab },
  ], tab);
}

// ================= 鍛造 =================
function itemsForForge(P) {
  const eq = SLOTS.map((s) => P.equip[s.id]).filter(Boolean).map((it) => ({ it, eq: true }));
  const bag = P.inv.filter((it) => it.kind !== "junk").map((it) => ({ it, eq: false }));
  return [...eq, ...bag];
}
const itemHead = (it, eq) => `<span class="fimg">${ico(it.icon, "big")}${eq ? '<i class="eqmark">E</i>' : ""}</span><span class="fn" style="color:${RARITY[it.rarity].color}">${it.name}</span>`;
const pips = (p) => `<span class="pips">${Array.from({ length: 10 }, (_, i) => `<i class="${i < p ? "on" : ""}"></i>`).join("")}</span>`;
const gauge = (rate) => `<span class="gauge" title="成功率"><i style="width:${rate}%;background:${rate >= 80 ? "#6ad06a" : rate >= 50 ? "#e8c040" : "#e0603a"}"></i><b>${rate}%</b></span>`;
export function openForge() {
  const P = ctx.profile;
  const enhanceTab = (body) => {
    body.appendChild(say("岩叔", "……越後面越容易失敗。失敗只會少材料。"));
    for (const { it, eq } of itemsForForge(P)) {
      const p = it.plus ?? 0, c = enhanceCost(p), rate = enhanceRate(p);
      const row = h("div", "frow");
      row.innerHTML = `<div class="fhead">${itemHead(it, eq)}</div><div class="fmid">${pips(p)}${p < 10 ? gauge(rate) : '<span class="maxed">MAX</span>'}</div><div class="fcost">${p < 10 ? costChips(c, P) : ""}</div>`;
      if (p < 10) row.appendChild(ibtn("hammer", "強化", () => {
        if (P.scrap < c.scrap || P.coins < c.coins) { ctx.sfx("close"); return msg("材料不夠", false); }
        P.scrap -= c.scrap; P.coins -= c.coins;
        ctx.shake(0.2, 2);
        if (Math.random() * 100 < rate) {
          it.plus = p + 1;
          P.quests.stats.enhanceMax = Math.max(P.quests.stats.enhanceMax, it.plus);
          ctx.sfx("chime"); ctx.flash("#ff9a40");
          msg(`成功！+${it.plus}`);
        } else { ctx.sfx("clank"); msg("失敗……材料沒了", false); }
        ctx.onQuest();
        render();
      }));
      body.appendChild(row);
    }
  };
  const rerollTab = (body) => {
    body.appendChild(say("岩叔", "……選一條不要的，我重打。"));
    const list = itemsForForge(P).filter(({ it }) => it.affixes?.length && !it.unique);
    if (!list.length) body.appendChild(say("岩叔", "……沒有能重打的東西。"));
    for (const { it, eq } of list) {
      const c = rerollCost(it), card = h("div", "fcard");
      card.innerHTML = `<div class="frow top"><div class="fhead">${itemHead(it, eq)}</div><div class="fcost">${costChips(c, P)}</div></div>`;
      it.affixes.forEach((a, i) => {
        const row = h("div", "faff");
        row.innerHTML = `<span class="tier t${a.tier}">T${a.tier}</span><span class="atext">${AFFIXES[a.id].fmt(a.v)}</span>`;
        row.appendChild(ibtn("dice", "重鑄", () => {
          if (P.scrap < c.scrap || P.coins < c.coins) { ctx.sfx("close"); return msg("材料不夠", false); }
          P.scrap -= c.scrap; P.coins -= c.coins;
          const na = rerollAffix(it, i);
          P.quests.stats.rerolls++;
          ctx.sfx("chime"); ctx.flash("#a8f0ff");
          msg(`→ T${na.tier} ${AFFIXES[na.id].fmt(na.v)}`);
          ctx.onQuest();
          render();
        }, "plain"));
        card.appendChild(row);
      });
      body.appendChild(card);
    }
  };
  const salvageTab = (body) => {
    body.appendChild(say("岩叔", "……不要的拆一拆，變碎屑。"));
    const big = h("div", "bigcard");
    big.innerHTML = `${ico("scrap", "huge")}<div class="bign">${P.scrap}</div><small>碎屑＝強化、重鑄的材料</small>`;
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
