// 主角數值：等級＋身上裝備 → 戰鬥用的數值。背包比較裝備也用這裡算。
// 2026-11-05 裝備改版第 1 批：滿級 100、成長緩和、暴擊率基礎 0%／暴擊傷害基礎 +10%、14 種屬性（docs/裝備系統企劃.md）。
import { mainValue, setCounts, coreOf } from "./items.js";

export const MAX_LV = 100;
/** 升到下一級需要的經驗。 */
export const xpNeed = (lv) => Math.round(24 + lv * 16 + lv * lv * 1.2);

export function computeStats(equip, lv) {
  const sum = {};
  const uniques = new Set();
  const add = (id, v) => (sum[id] = (sum[id] ?? 0) + v);
  for (const it of Object.values(equip)) {
    if (!it) continue;
    if (it.main) add(it.main.id, mainValue(it));
    for (const a of it.affixes) add(a.id, a.v);
    if (it.unique) uniques.add(it.unique);
  }
  // 套裝 2 件：流星獵手 暴擊率 +8、星辰共鳴 充能 +15、夜宴 吸血 +2；4 件效果另外判斷（sets）
  const sets = setCounts(equip);
  if (sets.meteor >= 2) sum.crit = (sum.crit ?? 0) + 8;
  if (sets.reson >= 2) sum.charge = (sum.charge ?? 0) + 15;
  if (sets.feast >= 2) sum.leech = (sum.leech ?? 0) + 2;
  const g = (k) => sum[k] ?? 0;
  return {
    uniques,
    sets,
    core: coreOf(equip.weapon),   // 8a：星核的核心效果 { id, tier, x }
    // 攻擊 ＝（角色每級 +0.3 ＋ 星核、星爪等固定攻擊）×（1＋攻擊%）
    atk: Math.round((0.3 * (lv - 1) + g("atk")) * (1 + g("atkPct") / 100)),
    maxHp: Math.round((100 + 3 * (lv - 1) + g("hp")) * (1 + g("hpPct") / 100)),
    def: g("def"),
    crit: g("crit"),
    critDmg: 10 + g("critDmg"),
    skill: g("skill"),
    ult: g("ult"),
    charge: g("charge"),
    cdr: Math.min(40, g("cdr")),
    leech: Number(g("leech").toFixed(1)),
    move: g("move"),
    mf: g("mf"),
  };
}

/** 防禦換算成減傷比例。 */
export const reduction = (def) => def / (def + 60);

// 背包裡顯示的數值列：[key, 名稱, 格式, 圖示]
export const STAT_ROWS = [
  ["atk", "攻擊力", (v) => v, "st_atk"],
  ["maxHp", "生命", (v) => v, "st_hp"],
  ["def", "防禦", (v) => `${v}<small> -${Math.round(reduction(v) * 100)}%</small>`, "st_def"],
  ["crit", "暴擊率", (v) => v + "%", "st_crit"],
  ["critDmg", "暴擊傷害", (v) => "+" + v + "%", "st_critDmg"],
  ["skill", "技能傷害", (v) => "+" + v + "%", "st_skill"],
  ["ult", "大招傷害", (v) => "+" + v + "%", "st_ult"],
  ["charge", "充能效率", (v) => "+" + v + "%", "st_charge"],
  ["cdr", "技能冷卻", (v) => "-" + v + "%", "st_cdr"],
  ["leech", "吸血", (v) => v + "%", "st_leech"],
  ["move", "移速", (v) => "+" + v + "%", "st_move"],
  ["mf", "掉寶率", (v) => "+" + v + "%", "st_mf"],
];

/** 綜合戰力：用來判斷「這件比身上的好嗎」（綠色箭頭）。 */
export function power(s) {
  const crit = 1 + (Math.min(100, s.crit) / 100) * (s.critDmg / 100);
  const off = s.atk * crit * (1 + s.skill / 300 + s.ult / 500 + s.charge / 400 + s.cdr / 150);
  const surv = s.maxHp / (1 - reduction(s.def)) * (1 + s.leech / 25);
  const util = 1 + (s.move + s.mf / 3) / 400;
  const four = Object.values(s.sets ?? {}).filter((n) => n >= 4).length;
  return Math.sqrt(off) * Math.pow(surv, 0.35) * util * (1 + 0.12 * s.uniques.size) * (1 + 0.15 * four) * (1 + 0.03 * (s.core?.tier ?? 0));   // 星核每一階 +3%
}

/** 把 item 穿上後會換掉哪一格（碎片挑空的，或比較弱的那個）。 */
export function targetSlot(item, equip, lv) {
  if (item.kind === "junk") return null;
  if (item.kind !== "acc") return item.kind;
  if (!equip.acc1) return "acc1";
  if (!equip.acc2) return "acc2";
  const p1 = power(computeStats({ ...equip, acc1: item }, lv)), p2 = power(computeStats({ ...equip, acc2: item }, lv));
  return p1 >= p2 ? "acc1" : "acc2";
}

/** 比較：穿上 item 之後的數值變化。回傳 { slot, before, after, better }。 */
export function compare(item, equip, lv) {
  const slot = targetSlot(item, equip, lv);
  if (!slot) return null;
  const before = computeStats(equip, lv), after = computeStats({ ...equip, [slot]: item }, lv);
  return { slot, before, after, better: power(after) > power(before) * 1.005, worse: power(after) < power(before) * 0.995 };
}
