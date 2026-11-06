// 形態技能樹（裝備改版第 4 批，docs/裝備系統企劃.md 第 7 章）：形態不再有等級；吸收重複的魔物核＝那個形態 +1 技能點。
// 每個形態一棵樹：三條路線（0 技能、1 普攻、2 體質）＋最終節點（三條路線各至少 3 點才能點）。點滿 21 點。城鎮裡可以免費洗點。
// 4a：星星、黏液星；4b：鐵罐星、蝠翼星。
// 節點效果寫在用到的地方（main.js 的技能彈、player.js 的連段、status.js 的反應），用 rank(form, id) 查點了幾級。

export const PATHS = ["技能", "普攻", "體質"];
export const TREES = {
  star: [
    { id: "s_big", path: 0, max: 3, cost: 1, icon: "n_s_big", name: "星屑增量", desc: (r) => `星屑彈爆炸範圍 +${15 * r}%` },
    { id: "s_pierce", path: 0, max: 1, cost: 2, icon: "n_s_pierce", name: "貫穿", desc: () => "星屑彈穿過第一隻敵人，打到第二隻才爆開" },
    { id: "s_fire", path: 0, max: 1, cost: 2, icon: "n_s_fire", name: "星火", desc: () => "燃燒的傷害 +60%" },
    { id: "s_edge", path: 1, max: 3, cost: 1, icon: "n_s_edge", name: "銳角", desc: (r) => `普攻傷害 +${5 * r}%` },
    { id: "s_wave", path: 1, max: 1, cost: 2, icon: "n_s_wave", name: "星光斬", desc: () => "連段最後一下射出一道短距離的星光斬" },
    { id: "s_light", path: 1, max: 1, cost: 2, icon: "n_s_light", name: "收招輕盈", desc: () => "打完一套連段後 2 秒內，移速 +20%" },
    { id: "s_origin", path: 2, max: 1, cost: 2, icon: "n_s_origin", name: "星之本源", desc: () => "切換成星星時，魔力 +10（3 秒一次）" },
    { id: "s_return", path: 2, max: 1, cost: 2, icon: "n_s_return", name: "回歸", desc: () => "切回星星時，技能冷卻減半" },
    { id: "s_rain", path: 3, max: 1, cost: 3, icon: "n_s_rain", name: "星雨", desc: () => "星屑彈爆開 1 秒後，天上落下一陣小星屑" },
  ],
  slime: [
    { id: "g_big", path: 0, max: 3, cost: 1, icon: "n_g_big", name: "大顆黏液", desc: (r) => `黏液彈爆炸範圍 +${15 * r}%` },
    { id: "g_bounce", path: 0, max: 1, cost: 2, icon: "n_g_bounce", name: "彈跳", desc: () => "黏液彈爆開後再往前彈一次（傷害 60%）" },
    { id: "g_ground", path: 0, max: 1, cost: 2, icon: "n_g_ground", name: "黏液地面", desc: () => "爆開的地方留下黏液 3 秒，踩到的敵人沾黏液" },
    { id: "g_horn", path: 1, max: 3, cost: 1, icon: "n_g_horn", name: "長角", desc: (r) => `普攻距離 +${8 * r}%` },
    { id: "g_coat", path: 1, max: 1, cost: 2, icon: "n_g_coat", name: "黏液角", desc: () => "連段的每一下都會讓敵人沾黏液" },
    { id: "g_spring", path: 1, max: 1, cost: 2, icon: "n_g_spring", name: "彈性", desc: () => "被打時有 20% 機率把旁邊的敵人彈開" },
    { id: "g_fuel", path: 2, max: 1, cost: 2, icon: "n_g_fuel", name: "易燃體質", desc: () => "大火的擴散範圍 +30%" },
    { id: "g_film", path: 2, max: 1, cost: 2, icon: "n_g_film", name: "黏液護膜", desc: () => "切換成黏液星後 3 秒內，受到的傷害 -25%" },
    { id: "g_split", path: 3, max: 1, cost: 3, icon: "n_g_split", name: "分裂", desc: () => "黏液彈爆開後分裂成 3 顆小黏液彈" },
  ],
  can: [
    { id: "c_long", path: 0, max: 3, cost: 1, icon: "n_c_long", name: "加長", desc: (r) => `衝撞距離 +${12 * r}%` },
    { id: "c_volt", path: 0, max: 1, cost: 2, icon: "n_c_volt", name: "帶電衝撞", desc: () => "撞到的敵人帶電時間 +1 秒，而且會麻痺" },
    { id: "c_brake", path: 0, max: 1, cost: 2, icon: "n_c_brake", name: "急停震地", desc: () => "衝撞結束時重重踩地，震傷周圍的敵人" },
    { id: "c_weight", path: 1, max: 3, cost: 1, icon: "n_c_weight", name: "重量", desc: (r) => `普攻擊退距離 +${10 * r}%` },
    { id: "c_quake", path: 1, max: 1, cost: 2, icon: "n_c_quake", name: "震波", desc: () => "連段最後一下錘地，往兩邊送出一道小震波" },
    { id: "c_iron", path: 1, max: 1, cost: 2, icon: "n_c_iron", name: "鐵皮", desc: () => "攻擊時被打不會中斷（霸體）" },
    { id: "c_conduct", path: 2, max: 1, cost: 2, icon: "n_c_conduct", name: "導電體", desc: () => "感電連鎖多跳 1 隻（不潮濕的也會被電到）" },
    { id: "c_dent", path: 2, max: 1, cost: 2, icon: "n_c_dent", name: "凹痕記憶", desc: () => "切換成鐵罐星後 3 秒內，防禦 +50%" },
    { id: "c_truck", path: 3, max: 1, cost: 3, icon: "n_c_truck", name: "回收車", desc: () => "衝撞時把路上的小怪推著走，衝完一起砸出去" },
  ],
  bat: [
    { id: "b_far", path: 0, max: 3, cost: 1, icon: "n_b_far", name: "遠飛", desc: (r) => `飛行距離 +${12 * r}%` },
    { id: "b_fang", path: 0, max: 1, cost: 2, icon: "n_b_fang", name: "毒牙", desc: () => "毒的傷害 +60%" },
    { id: "b_double", path: 0, max: 1, cost: 2, icon: "n_b_double", name: "二段飛", desc: () => "飛完 1.2 秒內可以再飛一次（不用等冷卻）" },
    { id: "b_claw", path: 1, max: 3, cost: 1, icon: "n_b_claw", name: "快爪", desc: (r) => `普攻傷害 +${4 * r}%` },
    { id: "b_hover", path: 1, max: 1, cost: 2, icon: "n_b_hover", name: "懸停", desc: () => "空中攻擊時停留更久" },
    { id: "b_blood", path: 1, max: 1, cost: 2, icon: "n_b_blood", name: "嗜血爪", desc: () => "打中毒的敵人時，回復傷害的 3%" },
    { id: "b_toxic", path: 2, max: 1, cost: 2, icon: "n_b_toxic", name: "劇毒", desc: () => "毒的持續時間 +40%" },
    { id: "b_night", path: 2, max: 1, cost: 2, icon: "n_b_night", name: "夜行", desc: () => "切換成蝠翼星後 3 秒內，移速 +30%、衝刺冷卻 -30%" },
    { id: "b_swarm", path: 3, max: 1, cost: 3, icon: "n_b_swarm", name: "蝙蝠群", desc: () => "滑翔時放出 3 隻小蝙蝠，自動去咬附近的敵人" },
  ],
};
// 使用者 2026-11-06：每個形態一個「形態被動」（路線 4，在樹的最上面）——只有變成那個形態時有效，最高 10 級，越後面越貴（點滿 22 點），
//   不算進三條路線，也不影響最終節點的條件。效果寫在用到的地方：星星＝main.js 大招、其他＝player.js
export const PASSIVE_COSTS = [1, 1, 1, 2, 2, 2, 3, 3, 3, 4];
const pas = (form, id, icon, name, desc) => ({ id, path: 4, max: 10, costs: PASSIVE_COSTS, cost: 1, icon, name, desc });
TREES.star.push(pas("star", "p_star", "st_ult", "星之光輝", (r) => `（星星時）大招傷害 +${4 * r}%`));
TREES.slime.push(pas("slime", "p_slime", "st_hp", "黏液再生", (r) => `（黏液星時）每秒回復 ${(0.9 + 0.1 * r).toFixed(1)}% 生命`));
TREES.bat.push(pas("bat", "p_bat", "st_move", "夜翼", (r) => `（蝠翼星時）移動速度 +${2 * r}%、跳躍高度 +${(1.5 * r).toFixed(1)}%`));
TREES.can.push(pas("can", "p_can", "st_def", "鐵底盤", (r) => `（鐵罐星時）被打時的擊退距離和硬直時間 -${5 * r}%`));
/** 下一級要幾點（被動越後面越貴） */
export const costOf = (n, r) => (n.costs ? n.costs[Math.min(r, n.costs.length - 1)] : n.cost);
const nodeSpent = (n, r) => (n.costs ? n.costs.slice(0, r).reduce((s, c) => s + c, 0) : r * n.cost);
export const CAP_NEED = 3;   // 最終節點：三條路線各要幾點

let forms = null;
/** 主程式載入存檔後呼叫，之後 rank() 直接查 */
export function bindForms(f) { forms = f; }
/** 這個形態的這個節點點了幾級 */
export const rank = (form, id) => forms?.owned?.[form]?.tree?.[id] ?? 0;
const nodeOf = (form, id) => TREES[form]?.find((n) => n.id === id);
/** 某條路線花了幾點 */
export function pathSpent(form, path) {
  const t = forms?.owned?.[form]?.tree ?? {};
  return (TREES[form] ?? []).filter((n) => n.path === path).reduce((s, n) => s + nodeSpent(n, t[n.id] ?? 0), 0);
}
export const spent = (form) => [0, 1, 2, 3, 4].reduce((s, p) => s + pathSpent(form, p), 0);
export const freePts = (form) => (forms?.owned?.[form]?.pts ?? 0) - spent(form);
/** 能不能再點一級：點數夠、沒滿、最終節點要三條路線各 3 點 */
export function canBuy(form, id) {
  const n = nodeOf(form, id);
  if (!n || rank(form, id) >= n.max || freePts(form) < costOf(n, rank(form, id))) return false;
  if (n.path === 3 && [0, 1, 2].some((p) => pathSpent(form, p) < CAP_NEED)) return false;
  return true;
}
export function buy(form, id) {
  if (!canBuy(form, id)) return false;
  const f = forms.owned[form];
  f.tree ??= {};
  f.tree[id] = (f.tree[id] ?? 0) + 1;
  return true;
}
// 使用者 2026-11-06：取消洗點（點下去就固定了）
