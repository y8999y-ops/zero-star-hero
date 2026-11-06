// 任務系統（2026-11-05）：公會任務＋系統任務。
// 公會任務：在公會的任務板接（沒有上限），做完回公會找波波交付，拿獎勵、公會等級往上（G.done＋1）。
//   任務板一次 4 張，在旅館休息（睡一晚）或全部接完時換新。
//   種類：kill 討伐指定魔物、junk 拾荒（撿垃圾）、clear 通關指定關卡（可能要求不死）、core 吸收魔物核。
// 系統任務：系統主動派的成長引導（也當成就），一次顯示 3 個，條件達成就自動完成、直接給獎勵（系統會吐槽一句）。
// 進度事件由 main.js 丟進來：questEvent(profile, "kill", { kind, elite }) 等。
import { LAYOUTS, STAGE_ORDER } from "./stages.js";

export const GUILD_MAX = Infinity;   // 使用者 2026-11-06：接取沒有上限（追蹤一次只能一個，townui.js）
const ENEMY_NAME = { slime: "狂化史萊姆", bat: "蝙蝠", trash: "垃圾桶怪", elite: "菁英（紅色）魔物" };
// 各關會出現的魔物（決定討伐任務能出哪些）
const STAGE_ENEMIES = { "1-1": ["slime", "bat", "trash"], "1-2": ["slime", "trash", "elite"], "1-3": ["bat", "elite", "trash"], "1-4": ["slime"] };

const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
let n = 0;
const qid = () => "q" + Date.now().toString(36) + (n++).toString(36);

export function freshQuests() {
  return { active: [], board: [], sysDone: {}, stats: { enhanceMax: 0, meals: 0, rerolls: 0 } };
}

/** 依照已解鎖的關卡產生一張任務 */
function makeOffer(unlocked) {
  const stage = pick(unlocked), k = Math.random();
  if (k < 0.45) {
    const enemy = pick(STAGE_ENEMIES[stage] ?? ["slime"]), need = enemy === "elite" ? rint(2, 3) : enemy === "trash" ? rint(5, 8) : rint(10, 18);
    return { id: qid(), kind: "kill", enemy, need, have: 0, title: `討伐：${ENEMY_NAME[enemy]}`, desc: `打倒 ${need} 隻${ENEMY_NAME[enemy]}（${stage} ${LAYOUTS[stage].name}比較多）`, reward: { coins: need * (enemy === "elite" ? 30 : 6), scrap: Math.ceil(need / 3), xp: need * (enemy === "elite" ? 20 : 4) } };
  }
  if (k < 0.65) {
    const need = rint(4, 8);
    return { id: qid(), kind: "junk", need, have: 0, title: "拾荒：回收委託", desc: `撿 ${need} 件垃圾回來。……對，就是垃圾。`, reward: { coins: need * 10, scrap: need, xp: need * 5 } };
  }
  if (k < 0.9 || stage === "1-4") {
    const nodeath = Math.random() < 0.35 && stage !== "1-4";
    return { id: qid(), kind: "clear", stage, nodeath, need: 1, have: 0, title: `${stage === "1-4" ? "討伐王" : "探索"}：${LAYOUTS[stage].name}`, desc: `通關 ${stage} ${LAYOUTS[stage].name}${nodeath ? "，而且一次都不能死" : ""}`, reward: { coins: (nodeath ? 120 : 70) + STAGE_ORDER.indexOf(stage) * 40, scrap: 6, xp: 60 + STAGE_ORDER.indexOf(stage) * 30 } };
  }
  return { id: qid(), kind: "core", need: 1, have: 0, title: "研究：魔物核", desc: "吸收 1 個魔物核（史萊姆、垃圾桶怪、蝙蝠都會掉）", reward: { coins: 90, scrap: 8, xp: 50 } };
}
/** 任務板沒了或要換新時：補到 4 張 */
export function refreshBoard(Q, unlocked, force = false) {
  if (force) Q.board = [];
  while (Q.board.length < 4) Q.board.push(makeOffer(unlocked));
}
export const accept = (Q, id) => {
  if (Q.active.length >= GUILD_MAX) return false;
  const i = Q.board.findIndex((q) => q.id === id);
  if (i < 0) return false;
  Q.active.push(Q.board.splice(i, 1)[0]);
  return true;
};
export const isReady = (q) => q.have >= q.need;
export function abandon(Q, id) { Q.active = Q.active.filter((q) => q.id !== id); }
/** 交付：回傳獎勵（呼叫的人負責發） */
export function turnIn(Q, id) {
  const i = Q.active.findIndex((q) => q.id === id && isReady(q));
  if (i < 0) return null;
  return Q.active.splice(i, 1)[0].reward;
}

// ---- 系統任務：照順序，一次開 3 個
// 使用者 2026-11-06：系統任務＝大主線（一次 1 個、照順序，一開始就有）；公會任務＝支線（跟波波說話登記後才出現）。兩種在同一個任務視窗
export const SYSTEM = [
  { id: "out11", title: "離開墜落之底", desc: "找到出口，走出這個洞窟。", check: (p) => !!p.cleared?.["1-1"], reward: { xp: 30 }, say: "出來了。……外面比我想的還亮。" },
  { id: "reg", title: "登記冒險者", desc: "去公會找波波登記。沒有冒險者證，哪裡都去不了。", check: (p) => p.guild.registered, reward: { coins: 50 }, say: "登記好了。F 級。……從谷底開始，很適合你。" },
  { id: "guild1", title: "第一份工作", desc: "完成並交付 1 個公會任務。", check: (p) => p.guild.done >= 1, reward: { coins: 60, xp: 40 }, say: "第一份薪水。我建議你存起來。……你不會聽的。" },
  { id: "core1", title: "吸收的滋味", desc: "吸收 1 個魔物核，解鎖新形態。", check: (p) => Object.keys(p.forms.owned).length >= 2, reward: { scrap: 10 }, say: "你把魔物的核吃掉了。……我是說吸收。差不多啦。" },
  { id: "forge2", title: "叮叮噹噹", desc: "在岩叔的工坊把任何一件裝備強化到 +2。", check: (p) => p.quests.stats.enhanceMax >= 2, reward: { coins: 80 }, say: "強化成功。岩叔的手還沒裂，很好。" },
  { id: "meal1", title: "吃飽才有力氣", desc: "在菇媽的旅館吃一道料理。", check: (p) => p.quests.stats.meals >= 1, reward: { scrap: 8 }, say: "星星需要吃東西嗎？……我也不知道，但你吃得很開心。" },
  { id: "reroll1", title: "不滿意就重來", desc: "在工坊重鑄 1 條詞綴。", check: (p) => p.quests.stats.rerolls >= 1, reward: { coins: 100 }, say: "重鑄是一種賭博。我什麼都沒說。" },
  { id: "rankE", title: "脫離 F 級", desc: "公會等級升到 E（交付 3 個公會任務）。", check: (p) => p.guild.done >= 3, reward: { xp: 120, coins: 80 }, say: "E 級了。波波推眼鏡的次數好像變少了。" },
  { id: "forms3", title: "百變星星", desc: "同時帶著 3 個形態。", check: (p) => p.forms.carry.length >= 3, reward: { scrap: 20 }, say: "三個形態。你現在是一顆很忙的星星。" },
  { id: "boss1", title: "大胃王", desc: "通關 1-4，打倒大胃王史萊姆。", check: (p) => !!p.cleared?.["1-4"], reward: { coins: 300, scrap: 30, xp: 200 }, say: "第一章的王倒了。……我開始覺得你有點東西了。" },
];
/** 目前顯示中的系統任務（還沒完成的前 3 個） */
/** 目前的主線（還沒完成的第一個；條件看目前狀態，之前就做到的一輪到它就完成） */
export const sysActive = (p) => SYSTEM.filter((s) => !p.quests.sysDone[s.id]).slice(0, 1);

/**
 * 進度事件。回傳 { guild: [剛做完的公會任務], sys: [剛完成的系統任務] }。系統任務的獎勵由呼叫的人發。
 * ev："kill" {kind, elite}、"junk"、"clear" {stage, deaths}、"core"、"tick"（只檢查系統任務）
 */
export function questEvent(p, ev, d = {}) {
  const Q = p.quests, doneG = [];
  for (const q of Q.active) {
    if (isReady(q)) continue;
    let add = 0;
    if (ev === "kill" && q.kind === "kill" && (q.enemy === "elite" ? d.elite : q.enemy === d.kind)) add = 1;
    else if (ev === "junk" && q.kind === "junk") add = 1;
    else if (ev === "core" && q.kind === "core") add = 1;
    else if (ev === "clear" && q.kind === "clear" && q.stage === d.stage && (!q.nodeath || d.deaths === 0)) add = 1;
    if (add) { q.have = Math.min(q.need, q.have + add); if (isReady(q)) doneG.push(q); }
  }
  const doneS = [];
  for (const s of sysActive(p)) if (s.check(p)) { Q.sysDone[s.id] = true; doneS.push(s); }
  return { guild: doneG, sys: doneS };
}
/** 獎勵寫成一行字 */
export const rewardText = (r) => [r.coins && `${r.coins} 金幣`, r.scrap && `${r.scrap} 星塵`, r.xp && `${r.xp} 經驗`].filter(Boolean).join("、");
