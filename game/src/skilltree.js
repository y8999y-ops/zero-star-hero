// 形態技能樹（裝備改版第 4 批，docs/裝備系統企劃.md 第 7 章）：形態不再有等級；吸收重複的魔物核＝那個形態 +1 技能點。
// 每個形態一棵樹：三條路線（0 技能、1 普攻、2 體質）＋最終節點（三條路線各至少 3 點才能點）。點滿 21 點。城鎮裡可以免費洗點。
// 4a：星星、黏液星；4b（下一批）：鐵罐星、蝠翼星。
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
    { id: "s_origin", path: 2, max: 1, cost: 2, icon: "n_s_origin", name: "星之本源", desc: () => "切換成星星時，大招能量 +5（3 秒一次）" },
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
};
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
  return (TREES[form] ?? []).filter((n) => n.path === path).reduce((s, n) => s + (t[n.id] ?? 0) * n.cost, 0);
}
export const spent = (form) => [0, 1, 2, 3].reduce((s, p) => s + pathSpent(form, p), 0);
export const freePts = (form) => (forms?.owned?.[form]?.pts ?? 0) - spent(form);
/** 能不能再點一級：點數夠、沒滿、最終節點要三條路線各 3 點 */
export function canBuy(form, id) {
  const n = nodeOf(form, id);
  if (!n || rank(form, id) >= n.max || freePts(form) < n.cost) return false;
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
/** 洗點（城鎮裡免費） */
export function refund(form) { const f = forms?.owned?.[form]; if (f) f.tree = {}; }
