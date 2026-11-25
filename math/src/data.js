// 遊戲的固定資料：屬性、學年與區域、魔法分支、成長數值。數值來源：docs/企劃書.md 第 5、6、8 節。

export const ATTRS = {
  fire:    { name: "火", school: "赤焰系", type: "直覺速算型", color: "#ff7a2f", spells: "火球、火焰柱、火環、流星", praise: "你的腦袋轉得飛快，答案常常一眼就看出來。速度是你的魔法。" },
  water:   { name: "水", school: "蒼流系", type: "變通型", color: "#3fa7ff", spells: "水柱、水球、噴泉、大浪", praise: "一條路不通，你就換一條。會變通的人，什麼題目都難不倒。" },
  ice:     { name: "冰", school: "白霜系", type: "精確步驟型", color: "#9be3ff", spells: "冰槍、冰刺、凍結、暴風雪", praise: "你一步一步、穩穩地算，最後還會檢查。精確就是你的力量。" },
  forest:  { name: "森", school: "翠森系", type: "圖像型", color: "#6fd46a", spells: "藤蔓、荊棘、大石、地震", praise: "你喜歡畫出來、排排看。看得見的數學，就是你最強的咒語。" },
  thunder: { name: "雷", school: "紫雷系", type: "推理找規律型", color: "#b483ff", spells: "雷球、閃電鏈、雷雲、落雷", praise: "你總想知道「為什麼」，也很會找規律。推理就是你的閃電。" },
};
export const ATTR_IDS = Object.keys(ATTRS);

// 主線五區（2026-11-25 使用者：題目聚焦中年級）：每一區＝中年級的一個學期，最後一區是總複習。id 沿用舊的（存檔的星星用這個 key）。
// time：每題秒數，0＝不限時
export const GRADES = {
  g1:  { name: "三年級上", area: "星芽花園", time: 0,  sky: ["#ffe9c7", "#ffc9d6"], ground: "#6fbf5a", deep: "#3f8a44", boss: 5 },
  g2:  { name: "三年級下", area: "千頁圖書館", time: 0,  sky: ["#f5e2c0", "#d9b98c"], ground: "#9a6a42", deep: "#5e3d27", boss: 5 },
  g34: { name: "四年級上", area: "刻度鐘塔", time: 28, sky: ["#c9d9ff", "#8fa6e6"], ground: "#8a8fa8", deep: "#545a75", boss: 5 },
  g56: { name: "四年級下", area: "分晶溫室", time: 28, sky: ["#d6fff2", "#8ee0c8"], ground: "#5fae9a", deep: "#2f6e62", boss: 5 },
  jh:  { name: "中年級總複習", area: "地下禁書庫", time: 32, sky: ["#3a2a5e", "#1b1433"], ground: "#4a3a6e", deep: "#251a40", boss: 5 },
};
export const GRADE_IDS = Object.keys(GRADES);

// 魔法分支（企劃書 8.5）
export const BRANCHES = {
  big: "大數術", mul: "倍增術", div: "均分術", mix: "併式術", frac: "分晶術",
  dec: "點晶術", shape: "形陣術", measure: "時律術", round: "概數術", seq: "數列術",
};
// 每種魔法對應的中年級單元（給玩家看）
export const UNIT_NAME = {
  big: "大數與加減", mul: "乘法", div: "除法", mix: "四則併式", frac: "分數",
  dec: "小數", shape: "面積、周長與角度", measure: "時間與單位換算", round: "概數與估算", seq: "數量規律",
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
  3: "魔力上限 3 → 4", 5: "數晶點數＋1", 8: "開放練習場", 10: "魔力上限 4 → 5",
  12: "數晶點數＋1", 15: "開放挑戰模式", 20: "開放副屬性", 25: "數晶點數＋1", 30: "大魔數師資格",
};
export const maxHp = (lv) => (lv >= 10 ? 5 : lv >= 3 ? 4 : 3);

// 數晶等級門檻（企劃書 8.7）
export const CRYSTAL_LV = [0, 50, 150, 300, 500];
export const crystalLevel = (pts) => CRYSTAL_LV.filter((n) => pts >= n).length;

// 連擊 → 魔法等級（企劃書 7.3）
export const spellTier = (combo) => (combo >= 10 ? 4 : combo >= 6 ? 3 : combo >= 3 ? 2 : 1);

// 題數（2026-11-25 使用者：遊戲裡要有 3、5、10 題的關）：每一區第 1、2、3 關；學院練習可以選
export const STAGE_LEN = [3, 5, 10];
export const LENGTHS = [3, 5, 10];
