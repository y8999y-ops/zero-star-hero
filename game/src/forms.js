// 形態系統（企劃書 3.1、3.2）：打倒狂化魔物有機率掉「魔物核」，撿到就解鎖那個形態；撿到重複的核，形態升級。
// 最多帶 3 個形態，戰鬥中切換。每個形態決定：普攻連段（player.js 的 COMBO_DEF）、形態技能、身體顏色。
// 各形態的外觀畫在 star.js（黏液星、鐵罐星、蝠翼星）。

export const FORMS = {
  star: { name: "星星", combo: "sword", skill: "stardust", skillName: "星屑彈", color: "#ffd84a", desc: "均衡的連段。技能：星屑彈，直線射出、打中會爆開。" },
  slime: { name: "黏液星", combo: "spear", skill: "goo", skillName: "黏液彈", color: "#7ee86a", from: "slime", desc: "角甩出去很遠。技能：黏液彈，爆開範圍大、把怪推開。" },
  bat: { name: "蝠翼星", combo: "dagger", skill: "flight", skillName: "蝠翼飛行", color: "#b48ae8", from: "bat", desc: "快速連續抓擊，空中攻擊時停得更久、按住跳可以滑翔。技能：蝠翼飛行，往前上方飛一小段，撞到的怪都會受傷。" },
  can: { name: "鐵罐星", combo: "hammer", skill: "charge", skillName: "蓋子衝撞", color: "#9aa6ba", from: "trash", desc: "慢、重、全部擊飛。技能：蓋子衝撞，往前衝，衝的時候不會受傷。" },
};
export const FORM_IDS = Object.keys(FORMS);
export const FORM_MAX_LV = 10;
export const CARRY_MAX = 3;
/** 從 lv 升到 lv+1 需要幾顆重複的核 */
export const coresToLevel = (lv) => lv;
/** 形態等級的傷害加成 */
export const formMul = (lv) => 1 + 0.06 * (lv - 1);

/** 掉核機率：還沒有這個形態時比較容易掉（讓玩家早點拿到） */
export function coreChance(enemyKind, forms) {
  const id = FORM_IDS.find((f) => FORMS[f].from === enemyKind);
  if (!id) return [null, 0];
  const owned = !!forms.owned[id];
  const base = enemyKind === "trash" ? (owned ? 0.12 : 0.3) : owned ? 0.03 : 0.08;
  return [id, base];
}

export const freshForms = () => ({ owned: { star: { lv: 1, xp: 0 } }, carry: ["star"], cur: "star" });

/** 吸收一顆核。回傳 { unlocked, leveled, lv }。 */
export function absorbCore(forms, id) {
  const f = forms.owned[id];
  if (!f) {
    forms.owned[id] = { lv: 1, xp: 0 };
    if (forms.carry.length < CARRY_MAX) forms.carry.push(id);
    return { unlocked: true, leveled: false, lv: 1 };
  }
  if (f.lv >= FORM_MAX_LV) return { unlocked: false, leveled: false, lv: f.lv };
  f.xp++;
  if (f.xp >= coresToLevel(f.lv)) { f.xp = 0; f.lv++; return { unlocked: false, leveled: true, lv: f.lv }; }
  return { unlocked: false, leveled: false, lv: f.lv };
}

/** 魔物核這個「掉落物」（不進背包，撿到就吸收） */
let n = 0;
export const makeCore = (id) => ({
  uid: "core" + Date.now().toString(36) + (n++).toString(36), kind: "formcore", form: id,
  name: FORMS[id].name + "的核", icon: "core_" + id, rarity: 3, ilvl: 1, affixes: [], stats: {},
});
