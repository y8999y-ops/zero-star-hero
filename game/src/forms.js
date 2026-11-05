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
export const CARRY_MAX = 3;
// 2026-11-05 裝備改版第 4 批：形態不分等級（原本 Lv1～10、每級傷害 +6%，拿掉）；重複的核改成那個形態 +1 技能點（skilltree.js）
export const formMul = () => 1;

/** 掉核機率：還沒有這個形態時比較容易掉（讓玩家早點拿到） */
export function coreChance(enemyKind, forms) {
  const id = FORM_IDS.find((f) => FORMS[f].from === enemyKind);
  if (!id) return [null, 0];
  const owned = !!forms.owned[id];
  const base = enemyKind === "trash" ? (owned ? 0.12 : 0.3) : owned ? 0.03 : 0.08;
  return [id, base];
}

export const freshForms = () => ({ owned: { star: { pts: 0, tree: {} } }, carry: ["star"], cur: "star" });
/** 舊存檔（有 lv、xp）→ 技能點：以前吸收過的重複核全部換成點數（Lv n 用掉 1+2+…+(n-1) 顆，加上 xp） */
export function migrateForms(forms) {
  for (const f of Object.values(forms.owned)) {
    if (f.lv === undefined) { f.pts ??= 0; f.tree ??= {}; continue; }
    f.pts = ((f.lv - 1) * f.lv) / 2 + (f.xp ?? 0);
    f.tree = {};
    delete f.lv; delete f.xp;
  }
  return forms;
}

/** 吸收一顆核。回傳 { unlocked, point }：第一顆解鎖形態，之後每顆＋1 技能點。 */
export function absorbCore(forms, id) {
  const f = forms.owned[id];
  if (!f) {
    forms.owned[id] = { pts: 0, tree: {} };
    if (forms.carry.length < CARRY_MAX) forms.carry.push(id);
    return { unlocked: true, point: false };
  }
  f.pts = (f.pts ?? 0) + 1;
  return { unlocked: false, point: true, pts: f.pts };
}

/** 魔物核這個「掉落物」（不進背包，撿到就吸收） */
let n = 0;
export const makeCore = (id) => ({
  uid: "core" + Date.now().toString(36) + (n++).toString(36), kind: "formcore", form: id,
  name: FORMS[id].name + "的核", icon: "core_" + id, rarity: 3, ilvl: 1, affixes: [], stats: {},
});
