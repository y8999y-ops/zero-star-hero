// 遊戲的固定資料：屬性、學年與區域、魔法分支、成長數值。數值來源：docs/企劃書.md 第 5、6、8 節。

export const ATTRS = {
  fire:    { name: "火", school: "赤焰系", type: "直覺速算型", color: "#ff7a2f", ability: "連擊加成", abilityDesc: "連擊分數加成 ×1.5（自動）", praise: "你的腦袋轉得飛快，答案常常一眼就看出來。速度是你的魔法。" },
  water:   { name: "水", school: "蒼流系", type: "變通型", color: "#3fa7ff", ability: "回流", abilityDesc: "答錯可以收回重選，不扣魔力", uses: 2, praise: "一條路不通，你就換一條。會變通的人，什麼題目都難不倒。" },
  ice:     { name: "冰", school: "白霜系", type: "精確步驟型", color: "#9be3ff", ability: "凍結時間", abilityDesc: "限時變長 ×1.5（自動）", praise: "你一步一步、穩穩地算，最後還會檢查。精確就是你的力量。" },
  forest:  { name: "森", school: "翠森系", type: "圖像型", color: "#6fd46a", ability: "萌芽提示", abilityDesc: "叫出提示，幫你想一想", uses: 3, praise: "你喜歡畫出來、排排看。看得見的數學，就是你最強的咒語。" },
  thunder: { name: "雷", school: "紫雷系", type: "推理找規律型", color: "#b483ff", ability: "消去", abilityDesc: "劈掉一個錯誤選項", uses: 3, praise: "你總想知道「為什麼」，也很會找規律。推理就是你的閃電。" },
};
export const ATTR_IDS = Object.keys(ATTRS);

// 學年＝區域（企劃書 6.1）。time：每題秒數，0＝不限時
export const GRADES = {
  g1:  { name: "一年級", area: "星芽花園", time: 0,  sky: ["#ffe9c7", "#ffc9d6"], ground: "#6fbf5a", deep: "#3f8a44", boss: 3 },
  g2:  { name: "二年級", area: "千頁圖書館", time: 0,  sky: ["#f5e2c0", "#d9b98c"], ground: "#9a6a42", deep: "#5e3d27", boss: 4 },
  g34: { name: "三～四年級", area: "刻度鐘塔", time: 12, sky: ["#c9d9ff", "#8fa6e6"], ground: "#8a8fa8", deep: "#545a75", boss: 4 },
  g56: { name: "五～六年級", area: "分晶溫室", time: 15, sky: ["#d6fff2", "#8ee0c8"], ground: "#5fae9a", deep: "#2f6e62", boss: 5 },
  jh:  { name: "國中", area: "地下禁書庫", time: 20, sky: ["#3a2a5e", "#1b1433"], ground: "#4a3a6e", deep: "#251a40", boss: 6 },
};
export const GRADE_IDS = Object.keys(GRADES);

// 魔法分支（企劃書 8.5）
export const BRANCHES = {
  addsub: "增減術", muldiv: "倍分術", time: "時律術", shape: "形陣術", frac: "分晶術",
  dec: "點晶術", ratio: "比率術", signed: "正負術", eq: "解謎術", seq: "數列術",
};

// 階級（企劃書 8.4）
export const RANKS = [
  { name: "見習魔數師", lv: 1 }, { name: "初級魔數師", lv: 6 }, { name: "中級魔數師", lv: 12 },
  { name: "高級魔數師", lv: 20 }, { name: "大魔數師", lv: 30 },
];

export const MAX_LV = 30;
export const expToNext = (lv) => 100 + 20 * (lv - 1);
export const EXP = { correct: 10, firstType: 20, review: 15, star: 20, rankUp: 100 };

// 升級獎勵（企劃書 8.3）
export const LEVEL_REWARDS = {
  3: "魔力上限 3 → 4", 5: "學系能力次數＋1", 8: "開放練習場", 10: "魔力上限 4 → 5",
  12: "學系能力次數＋1", 15: "開放挑戰模式", 20: "開放副屬性", 25: "學系能力次數＋1", 30: "大魔數師資格",
};
export const maxHp = (lv) => (lv >= 10 ? 5 : lv >= 3 ? 4 : 3);
export const abilityBonus = (lv) => (lv >= 25 ? 3 : lv >= 12 ? 2 : lv >= 5 ? 1 : 0);

// 數晶等級門檻（企劃書 8.7）
export const CRYSTAL_LV = [0, 50, 150, 300, 500];
export const crystalLevel = (pts) => CRYSTAL_LV.filter((n) => pts >= n).length;

// 連擊 → 魔法等級（企劃書 7.3）
export const spellTier = (combo) => (combo >= 10 ? 4 : combo >= 6 ? 3 : combo >= 3 ? 2 : 1);
