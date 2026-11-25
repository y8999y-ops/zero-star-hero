// 學院島上的日常（企劃書 3.7）：導師、同學、布告欄委託、散落的書頁、數字鎖寶箱、墨水小點。
// 這裡只放資料和出題；地圖上的位置在 maps.js，對話和事件在 scenes/world.js。

export const today = () => new Date().toISOString().slice(0, 10);
export function seeded(seed) {
  let h = 2166136261; for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => { h += 0x6d2b79f5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** 今天的日常進度（每天換新） */
export function daily(s) {
  if (s.daily?.date !== today()) s.daily = { date: today(), mini: 0, riddles: [], ink: [], claimed: [], wish: false };
  s.daily.riddles ??= []; s.daily.ink ??= []; s.daily.claimed ??= [];
  return s.daily;
}

// ── 同學：每人每天一題生活數學小問題 ──
export const STUDENTS = [
  { id: "s1", name: "小圓", look: "girl", attr: "#ff7a2f", hair: ["#2a2230", "#16121c"], line: "我是赤焰系的！算數比賽我從來沒輸過……好啦，輸過一次。" },
  { id: "s2", name: "阿方", look: "boy", attr: "#3fa7ff", hair: ["#c8a060", "#8a6a3a"], line: "蒼流館的水道會唱歌喔，你仔細聽，是二拍子。" },
  { id: "s3", name: "晴晴", look: "girl", attr: "#9be3ff", hair: ["#e8d8b0", "#b8a070"], line: "冰系的作業要寫三遍：算一遍、檢查一遍、再檢查一遍。" },
  { id: "s4", name: "小葉", look: "boy", attr: "#6fd46a", hair: ["#5a3f33", "#3a2822"], line: "翠森苑的大樹有幾片葉子？我數到一半就睡著了。" },
  { id: "s5", name: "閃閃", look: "girl", attr: "#b483ff", hair: ["#f0f0ff", "#b8b8d8"], line: "為什麼 0 不能當除數？我問了雷鳴老師三天。" },
  { id: "s6", name: "大頭", look: "boy", attr: "#ffd35c", hair: ["#a5563a", "#6e3326"], line: "我是一年級的！聽說上層書庫的書會自己飛。" },
];
const LV = { g1: 1, g2: 2, g34: 3, g56: 4, jh: 5 };
/** 同學今天的題目：{ text, answer, options } */
export function riddleFor(s, st) {
  const r = seeded(`${today()}-${st.id}`), R = (a, b) => a + Math.floor(r() * (b - a + 1));
  const lv = LV[s.lastGrade ?? "g1"] ?? 1;
  const T = [
    () => { const a = R(3, 9), b = R(2, 8); return [`我有 ${a} 顆星星糖，晴晴又給我 ${b} 顆。我現在有幾顆？`, a + b]; },
    () => { const a = R(8, 18), b = R(2, 7); return [`商店有 ${a} 頂帽子，賣掉 ${b} 頂，還剩幾頂？`, a - b]; },
    () => { const a = R(2, lv <= 1 ? 4 : 9), b = R(2, lv <= 1 ? 5 : 9); return [`每排種 ${b} 朵花，種了 ${a} 排，一共幾朵？`, a * b]; },
    () => { const b = R(2, 6), q = R(2, 8); return [`${b * q} 塊餅乾平分給 ${b} 個人，每人幾塊？`, q]; },
    () => { const s0 = R(1, 5), d = R(2, 4); return [`鐘塔的鐘響了 ${s0}、${s0 + d}、${s0 + 2 * d} 下……下一次會響幾下？`, s0 + 3 * d]; },
  ];
  const pick = lv <= 1 ? T.slice(0, 3) : T;
  const [text, answer] = pick[R(0, pick.length - 1)]();
  const o = new Set([answer]); while (o.size < 4) { const v = answer + R(-4, 4); if (v >= 0) o.add(v); }
  return { text, answer, options: [...o].sort(() => r() - 0.5) };
}

// ── 布告欄：每日委託 ──
export const QUESTS = [
  { id: "q1", text: "今天答對 10 題", done: (s) => (s.diary?.[today()]?.ok ?? 0) >= 10, coins: 15 },
  { id: "q2", text: "玩一次學系小遊戲", done: (s) => (s.daily?.mini ?? 0) >= 1, coins: 10 },
  { id: "q3", text: "解開 2 位同學的小問題", done: (s) => (s.daily?.riddles?.length ?? 0) >= 2, coins: 10 },
];

// ── 散落的書頁：每一張是一則數學小知識 ──
export const PAGES = [
  "0 是印度的數學家發明的符號。沒有 0，就寫不出 10、100、1000。",
  "3.14159……圓周率永遠算不完，難怪院長講不完。",
  "九九乘法表裡，9 的倍數各位數加起來都是 9：18、27、36……",
  "任何數乘以 1 都不變，所以 1 叫做「乘法的單位元素」。",
  "一個正方形切成 4 塊一樣大的，每一塊就是 1/4。",
  "蜜蜂的巢是正六邊形，因為這樣最省材料、又排得最密。",
  "1＋2＋3＋……＋100＝5050，高斯小時候一下子就算出來了。",
  "負數可以想成「欠」：欠 3 顆糖，就是 −3。",
  "兩個奇數相加，一定是偶數。不信你試試看！",
  "雪花幾乎都是六個角，因為水結冰時會排成六角形。",
];

// ── 數字鎖寶箱 ──
export const CHESTS = [
  { q: "轉盤上寫著：「我是兩位數，十位和個位一樣，加起來是 8。」我是幾？", a: 44, o: [44, 26, 35, 88] },
  { q: "轉盤上寫著：「□ × □ ＝ 49」，□ 是幾？", a: 7, o: [6, 7, 8, 9] },
  { q: "轉盤上寫著：「1、1、2、3、5、8、？」", a: 13, o: [11, 12, 13, 16] },
];
