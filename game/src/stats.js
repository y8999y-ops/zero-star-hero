// 主角數值：等級＋身上裝備 → 戰鬥用的數值。背包比較裝備也用這裡算。
import { WTYPES } from "./items.js";

export const MAX_LV = 50;
/** 升到下一級需要的經驗。 */
export const xpNeed = (lv) => Math.round(24 + lv * 16 + lv * lv * 1.2);

export function computeStats(equip, lv) {
  const sum = {};
  const uniques = new Set();
  let wAtk = 4, def = 0, hpBase = 0;
  for (const it of Object.values(equip)) {
    if (!it) continue;
    if (it.kind === "weapon") wAtk = it.stats.atk ?? wAtk;
    def += it.stats.def ?? 0;
    hpBase += it.stats.hp ?? 0;
    for (const a of it.affixes) sum[a.id] = (sum[a.id] ?? 0) + a.v;
    if (it.unique) uniques.add(it.unique);
  }
  const g = (k) => sum[k] ?? 0;
  const wtype = equip.weapon?.wtype ?? "sword";
  return {
    wtype,
    uniques,
    atk: Math.round((wAtk + (lv - 1) * 1.2) * (1 + g("atk") / 100)),
    maxHp: Math.round(100 + (lv - 1) * 8 + hpBase + g("hp")),
    def: def + g("def"),
    spd: g("spd"),
    move: g("move"),
    crit: 8 + (WTYPES[wtype].crit ?? 0) + g("crit"),
    critDmg: 60 + g("critDmg"),
    fire: g("fire"),
    skill: g("skill"),
    cdr: Math.min(60, g("cdr")),
    life: g("life"),
    boom: g("boom") + (uniques.has("hardhat") ? 25 : 0),
    gold: g("gold"),
    mf: g("mf"),
    magnet: g("magnet"),
  };
}

/** 防禦換算成減傷比例。 */
export const reduction = (def) => def / (def + 60);

// 背包裡顯示的數值列：[key, 名稱, 格式]
export const STAT_ROWS = [
  ["atk", "攻擊力", (v) => v],
  ["maxHp", "生命", (v) => v],
  ["def", "防禦", (v) => `${v}（減傷 ${Math.round(reduction(v) * 100)}%）`],
  ["crit", "暴擊率", (v) => v + "%"],
  ["critDmg", "暴擊傷害", (v) => "+" + v + "%"],
  ["spd", "攻速", (v) => "+" + v + "%"],
  ["move", "移速", (v) => "+" + v + "%"],
  ["fire", "火焰傷害", (v) => "+" + v],
  ["skill", "火球傷害", (v) => "+" + v + "%"],
  ["cdr", "火球冷卻", (v) => "-" + v + "%"],
  ["life", "擊殺回復", (v) => v],
  ["boom", "擊殺爆炸", (v) => v + "%"],
  ["gold", "金幣", (v) => "+" + v + "%"],
  ["mf", "掉寶率", (v) => "+" + v + "%"],
  ["magnet", "吸物範圍", (v) => "+" + v + "%"],
];

/** 綜合戰力：用來判斷「這件比身上的好嗎」（綠色箭頭）。 */
export function power(s) {
  const off = (s.atk + s.fire * 0.8) * (1 + s.spd / 100) * (1 + (Math.min(100, s.crit) / 100) * (s.critDmg / 100)) * (1 + s.boom / 250) * (1 + s.skill / 400);
  const surv = s.maxHp / (1 - reduction(s.def)) + s.life * 12;
  const util = 1 + (s.move + s.gold / 4 + s.mf / 3 + s.magnet / 8 + s.cdr / 2) / 400;
  return Math.sqrt(off) * Math.pow(surv, 0.35) * util * (1 + 0.12 * s.uniques.size);
}

/** 把 item 穿上後會換掉哪一格（飾品挑空的，或比較弱的那個）。 */
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
