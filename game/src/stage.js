// 關卡流程：照 x 位置觸發提示、對話；怪物一開始就擺在地圖上（8b）；王的房間封住、一波一波出；最後走到出口過關。
// 關卡內容全部是資料（STAGE_1_1），之後的關卡照同樣格式寫就好。

// side: 1 從畫面右邊出現、-1 從左邊、0 從上面掉下來（蝙蝠）
export const STAGE_1_1 = {
  name: "1-1 墜落之底",
  paced: true,
  start: { x: 84, y: -40 },
  exitX: 3180, exitY: 384,
  // 使用者 2026-11-06：1-1 重新設計——一次只教一件事。菁英、金幣史萊姆、形態機關、元素物件都移到後面的關卡。
  // 怪物共 14 隻；每段的提示要等前面幾段的怪清掉（quiet）才講，最多等 8 秒；系統上一句還沒講完也先等。teach＝講到時那顆按鈕才出現。
  features: [{ t: "stele", x: 2680, y: 384, i: 0 }],
  hazards: [],
  altars: [{ x: 1440, y: 384 }, { x: 2820, y: 384 }],
  spawns: [
    { k: "slime", x: 1230, y: 384, core: "slime" },                                           // 段 4：一隻睡著的（必掉史萊姆核，教吸收）
    { k: "slime", x: 1720, y: 384 }, { k: "slime", x: 1770, y: 384 }, { k: "slime", x: 1820, y: 384 },   // 段 6：連擊
    { k: "bat", x: 2020, y: 310 }, { k: "bat", x: 2070, y: 316 },                             // 段 7：閃避
    { k: "slime", x: 2270, y: 384 }, { k: "slime", x: 2286, y: 384 }, { k: "slime", x: 2302, y: 384 }, { k: "slime", x: 2318, y: 384 }, { k: "slime", x: 2334, y: 384 },   // 段 8：擠成一團
    { k: "slime", x: 2920, y: 384 }, { k: "trash", x: 2970, y: 384 }, { k: "slime", x: 3010, y: 384 },   // 段 10：最後一場
  ],
  intro: ["系統：……你從天上掉下來了。恭喜，你還活著。", "系統：轉生成功。種族：星靈。……不，我也是第一次看到。"],
  caches: [{ x: 888, y: 288, n: 5 }, { x: 1552, y: 296, n: 6 }, { x: 2600, y: 376, n: 10 }],
  events: [
    // 教學寫成系統的台詞（tip），【】裡是按鍵／按鈕，focus＝講到時哪個按鈕會閃
    { x: 90, tip: { touch: "先活動一下。左手在【螢幕左半邊】左右拖——這樣就能走了。", key: "先活動一下。【A】【D】或方向鍵——走路。星星也是要走路的。" } },
    { x: 320, tip: { touch: "前面有個小台階。左手【往上快滑】——跳。", key: "前面有個小台階。【空白鍵】或【↑】——跳。" } },
    { x: 690, tip: { touch: "這個太高了。跳起來之後，在空中再滑一次——二段跳。別問我星星為什麼會二段跳。", key: "這個太高了。跳起來之後在空中再按一次——二段跳。別問我星星為什麼會二段跳。" } },
    { x: 1030, tip: { touch: "前面那隻史萊姆還在睡，深淵最弱的魔物。按住右下角的【攻擊】，會自己打出三連段。我設計的。", key: "前面那隻史萊姆還在睡，深淵最弱的魔物。按住【滑鼠左鍵】，會自己打出三連段。我設計的。", focus: "atk" } },
    // 使用者 2026-11-06：這隻必掉核——教「按住吸收鍵」；核還沒吸之前，下一段（祭壇）先不講
    { x: 1250, quiet: true, tip: { touch: "牠掉了一顆核——魔物的力量。站過去，按住右下亮起來的【吸收】。這就是你變強的方法。", key: "牠掉了一顆核——魔物的力量。站過去，按住【F】吸收。這就是你變強的方法。" } },
    { x: 1270, quiet: true, waitCore: true, say: "系統：前面那個是星之祭壇。走過去點亮它——死掉的話會從這裡重來。" },   // 怎麼按：第一次站到旁邊時 main.js 會教（tipUse）
    { x: 1500, say: "系統：前面三隻。按住攻擊不要停——連擊每滿 10 下，魔力 +10。" },
    { x: 1850, quiet: true, teach: "dash", tip: { touch: "上面有翅膀的聲音——蝙蝠會俯衝。按【閃避】閃開，閃的那一瞬間不會受傷。", key: "上面有翅膀的聲音——蝙蝠會俯衝。按【滑鼠右鍵】衝刺閃開，閃的那一瞬間不會受傷。", focus: "dash" } },
    { x: 2090, quiet: true, teach: "skill", tip: { touch: "一整團擠在一起，一隻一隻打太慢了。用【技能】——星屑彈打中會爆炸，一整群一起送走。", key: "一整團擠在一起，一隻一隻打太慢了。按【E】放星屑彈——打中會爆炸，一整群一起送走。", focus: "skill" } },
    { x: 2530, quiet: true, tip: { touch: "前面被岩壁擋住了，路在下面。左手【往下快滑】——從平台穿下去。", key: "前面被岩壁擋住了，路在下面。按【S】或【↓】——從平台穿下去。" } },
    { x: 2780, quiet: true, ult: true, say: "系統：又一座祭壇。……前面那個垃圾桶是不是在動？" },   // ult：從這裡開始才會教大招
    { x: 3030, quiet: true, say: "系統：寶箱！還有傳送門……通往更深的地方。我就知道。" },
  ],
};

// 1-2 垃圾山：垃圾桶怪變多，第一次碰到菁英（紅色、很硬、掉的東西比較好）
export const STAGE_1_2 = {
  name: "1-2 垃圾山",
  start: { x: 80, y: 600 },
  exitX: 2720, exitY: 520,
  // 9 批：大地圖的祭壇、怪物（約 50 隻，垃圾桶多）
  // 8d：山頂右邊一朵黏液菇（黏液星彈上去拿星之殘火）；山腹密道後段一面裂牆（後面是化石核）
  features: [
    { t: "shroom", x: 1520, y: 240 }, { t: "ember", x: 1532, y: 112 },
    { t: "crack", x: 1720, y: 600, h: 112 }, { t: "fossil", x: 1790, y: 600, form: "can" }, { t: "safe", x: 1860, y: 600 },
    { t: "stele", x: 1340, y: 240, i: 1 }, { t: "vein", x: 2648, y: 520 },
  ],
  hazards: [["junk", 300, 600], ["drum", 1100, 376], ["pipe", 1500, 600], ["junk", 2300, 520], ["drum", 2480, 520]],
  altars: [{ x: 460, y: 600 }, { x: 1424, y: 240 }, { x: 2220, y: 520 }],
  spawns: [
    { k: "slime", x: 300, y: 600 }, { k: "slime", x: 420, y: 600 }, { k: "slime", x: 520, y: 600 }, { k: "trash", x: 620, y: 552 }, { k: "slime", x: 780, y: 504 }, { k: "bat", x: 450, y: "air" }, { k: "trash", x: 900, y: 440 }, { k: "slime", x: 960, y: 440 }, { k: "slime", x: 1060, y: 376 }, { k: "trash", x: 1120, y: 376 }, { k: "slime", x: 1230, y: 312 }, { k: "bat", x: 1100, y: 280 }, { k: "slimeE", x: 1360, y: 240 }, { k: "trash", x: 1450, y: 240 }, { k: "slime", x: 1500, y: 240 }, { k: "bat", x: 1420, y: 150 }, { k: "bat", x: 1300, y: 190 }, { k: "slime", x: 1590, y: 312 }, { k: "trash", x: 1720, y: 392 }, { k: "slime", x: 1780, y: 392 }, { k: "slime", x: 1900, y: 456 }, { k: "bat", x: 1800, y: 330 }, { k: "slime", x: 900, y: 600 }, { k: "trash", x: 1100, y: 600 }, { k: "slime", x: 1250, y: 600 }, { k: "gold", x: 1320, y: 600 }, { k: "trash", x: 1520, y: 600 }, { k: "slime", x: 1650, y: 600 }, { k: "slime", x: 1760, y: 600 }, { k: "trashE", x: 1900, y: 600 }, { k: "trash", x: 2100, y: 520 }, { k: "slime", x: 2180, y: 520 }, { k: "slime", x: 2260, y: 520 }, { k: "trashE", x: 2380, y: 520 }, { k: "slime", x: 2440, y: 520 }, { k: "trash", x: 2560, y: 520 }, { k: "slime", x: 2640, y: 520 }, { k: "bat", x: 2250, y: 420 }, { k: "bat", x: 2500, y: 400 }, { k: "slime", x: 2380, y: 360 }, { k: "bat", x: 2650, y: 440 }, { k: "slime", x: 160, y: 600 }, { k: "bat", x: 700, y: "air" }, { k: "trash", x: 2700, y: 520 },
  ],

  intro: ["系統：這裡是垃圾山。上面的世界把不要的東西，全部丟到這裡。", "系統：……包括你。開玩笑的。大概。"],
  caches: [{ x: 272, y: 440, n: 7 }, { x: 1400, y: 152, n: 9 }, { x: 1620, y: 512, n: 10 }, { x: 2400, y: 344, n: 8 }],
  events: [
    { x: 260, tip: { touch: "撿到的東西都在右上角的【背包】。穿裝備、比較、拆垃圾……垃圾的部分你應該很熟。", key: "撿到的東西按【I】打開背包看。穿裝備、比較、拆垃圾……垃圾的部分你應該很熟。", focus: "bag" } },
    { x: 620, say: "系統：歡迎委員會來了。", waves: [[["slime", 1], ["slime", -1], ["trash", 1]], [["slime", 1], ["slime", 1], ["slime", -1], ["bat", 0]]] },
    { x: 1150, say: "系統：垃圾桶……越來越多了。打倒它們，有機會吸收鐵罐星的核。", waves: [[["trash", 1], ["trash", -1]], [["trash", 1], ["slime", -1], ["slime", -1], ["bat", 0]]] },
    { x: 1680, say: "系統：那隻史萊姆的顏色不太對。是菁英，很硬。打贏的話掉的東西比較好。", waves: [[["slimeE", 1], ["slime", -1], ["slime", -1]], [["slime", 1], ["trash", -1], ["bat", 0], ["bat", 0]]] },
    { x: 2260, say: "系統：最後一段。我看到很多垃圾桶在發抖。", waves: [[["trash", 1], ["trash", -1], ["slime", 1], ["bat", 0]], [["trashE", 1], ["slime", -1], ["bat", 0], ["gold", -1]]] },
    { x: 2560, say: "系統：再往下……是蝙蝠的地盤了。" },
  ],
};

// 1-3 蝙蝠洞窟：很暗、蝙蝠一大群，菁英蝙蝠＋菁英垃圾桶；最後預告王
export const STAGE_1_3 = {
  name: "1-3 蝙蝠洞窟",
  start: { x: 80, y: 160 },
  exitX: 2500, exitY: 600,
  // 9 批：大地圖的祭壇、怪物（約 50 隻，蝙蝠多）
  // 8d：第一面牆頂的縫被星光封印擋住（後面的藏寶處有化石核）；第三洞窟有一道往上吹的氣流（蝠翼星滑翔上去拿星之殘火）
  features: [
    { t: "seal", x: 736, y: 96, h: 64 }, { t: "fossil", x: 860, y: 136, form: "bat" },
    { t: "wind", x: 1876, y: 600, w: 40, h: 440 }, { t: "ember", x: 1980, y: 240 },
    { t: "safe", x: 1150, y: 400 }, { t: "vein", x: 1300, y: 600 }, { t: "stele", x: 2420, y: 600, i: 2 },
  ],
  hazards: [["goo", 500, 600], ["pipe", 1000, 600], ["goo", 1680, 600], ["drum", 2280, 600], ["goo", 1000, 400]],
  altars: [{ x: 600, y: 600 }, { x: 1300, y: 600 }, { x: 2060, y: 600 }],
  spawns: [
    { k: "bat", x: 200, y: 260 }, { k: "bat", x: 400, y: 320 }, { k: "bat", x: 560, y: 420 }, { k: "bat", x: 300, y: 500 }, { k: "slime", x: 400, y: 600 }, { k: "slime", x: 520, y: 600 }, { k: "slime", x: 640, y: 600 }, { k: "bat", x: 600, y: 280 }, { k: "slime", x: 420, y: 224 }, { k: "slime", x: 560, y: 224 }, { k: "slime", x: 840, y: 136 }, { k: "bat", x: 860, y: 80 }, { k: "bat", x: 900, y: 500 }, { k: "bat", x: 1000, y: 460 }, { k: "bat", x: 1200, y: 300 }, { k: "batE", x: 1300, y: 350 }, { k: "slime", x: 960, y: 400 }, { k: "slime", x: 1100, y: 400 }, { k: "trash", x: 1000, y: 600 }, { k: "slime", x: 1200, y: 600 }, { k: "slime", x: 1400, y: 600 }, { k: "bat", x: 1400, y: 380 }, { k: "bat", x: 1050, y: 250 }, { k: "bat", x: 1650, y: 260 }, { k: "bat", x: 1700, y: 400 }, { k: "slime", x: 1680, y: 320 }, { k: "slime", x: 1780, y: 320 }, { k: "bat", x: 1950, y: 180 }, { k: "trash", x: 1960, y: 240 }, { k: "slime", x: 2050, y: 240 }, { k: "batE", x: 2000, y: 330 }, { k: "slime", x: 1620, y: 600 }, { k: "trash", x: 1760, y: 600 }, { k: "slime", x: 1880, y: 600 }, { k: "trashE", x: 2000, y: 600 }, { k: "gold", x: 2220, y: 600 }, { k: "slime", x: 2300, y: 600 }, { k: "trash", x: 2400, y: 600 }, { k: "bat", x: 2250, y: 300 }, { k: "bat", x: 2350, y: 420 }, { k: "slime", x: 2260, y: 392 }, { k: "slime", x: 2340, y: 392 }, { k: "bat", x: 2450, y: 460 }, { k: "bat", x: 2500, y: 350 },
  ],
  intro: ["系統：好暗。……你會發光這件事，第一次派上用場了。", "系統：聽到翅膀的聲音了嗎？我聽到了。很多。"],
  caches: [{ x: 856, y: 120, n: 10 }, { x: 1036, y: 296, n: 8 }, { x: 2000, y: 224, n: 9 }, { x: 2300, y: 376, n: 8 }],
  events: [
    { x: 420, say: "系統：來了。", waves: [[["bat", 0], ["bat", 0], ["bat", 0]], [["bat", 0], ["bat", 0], ["slime", 1], ["slime", -1]]] },
    { x: 900, say: "系統：蝙蝠會俯衝。閃避有無敵時間，看準了再按。", waves: [[["bat", 0], ["bat", 0], ["trash", 1]], [["bat", 0], ["bat", 0], ["bat", 0], ["slime", -1]]] },
    { x: 1420, say: "系統：那隻……體型不太對。菁英蝙蝠，衝得特別快。", waves: [[["batE", 0], ["bat", 0], ["bat", 0]], [["bat", 0], ["slime", 1], ["slime", -1], ["bat", 0]]] },
    { x: 1960, say: "系統：垃圾桶怪也跑進洞裡了？這裡到底是誰在管。", waves: [[["trashE", 1], ["bat", 0], ["bat", 0]], [["batE", 0], ["trash", -1], ["bat", 0], ["gold", 1]]] },
    { x: 2300, say: "系統：前面……我聞到很臭的味道。像是吃了一百年垃圾的那種。" },
  ],
};
// 1-4 大胃王的巢穴（10 批：大地圖）：一路往下走到王房的屋頂，從破洞跳下去，王房封住、王從上面掉下來。
// 打倒王（融化演出結束）＝通關。arena＝王房（左右界線、地面、王放大招時站的中間平台）。
export const STAGE_1_4 = {
  name: "1-4 大胃王的巢穴",
  start: { x: 60, y: 160 },
  exitX: 0,
  arena: { l: 1256, r: 1784, floor: 600, top: { x: 1466, y: 512, w: 108 }, hole: { x: 1312, y: 352, w: 64, h: 48 } },   // hole＝屋頂的破洞（王出場時被垃圾塞住）   // top＝王放大招時跳上去的中間高平台（stages.js 也有同一塊）
  features: [
    { t: "crack", x: 1624, y: 352, h: 120 }, { t: "fossil", x: 1690, y: 352, form: "star" }, { t: "ember", x: 1748, y: 352 },
    { t: "safe", x: 1180, y: 600 }, { t: "vein", x: 140, y: 600 }, { t: "stele", x: 1060, y: 352, i: 3 },
  ],
  hazards: [["goo", 450, 232], ["drum", 820, 296], ["pipe", 700, 600], ["junk", 900, 600], ["goo", 1480, 352]],
  altars: [{ x: 720, y: 296 }, { x: 320, y: 600 }, { x: 1200, y: 352 }],
  spawns: [
    { k: "slime", x: 220, y: 160 }, { k: "bat", x: 260, y: 100 },
    { k: "slime", x: 400, y: 232 }, { k: "trash", x: 480, y: 232 }, { k: "bat", x: 450, y: 180 },
    { k: "slime", x: 650, y: 296 }, { k: "slime", x: 780, y: 296 }, { k: "trash", x: 840, y: 296 }, { k: "bat", x: 700, y: 236 },
    { k: "slime", x: 900, y: 352 }, { k: "trash", x: 980, y: 352 }, { k: "slimeE", x: 1110, y: 352 }, { k: "slime", x: 1160, y: 352 }, { k: "bat", x: 1020, y: 300 },
    { k: "bat", x: 950, y: 230 }, { k: "bat", x: 1080, y: 170 }, { k: "batE", x: 1180, y: 220 }, { k: "slime", x: 1030, y: 216 }, { k: "slime", x: 1150, y: 160 },
    { k: "slime", x: 1420, y: 352 }, { k: "trash", x: 1520, y: 352 }, { k: "trashE", x: 1580, y: 352 }, { k: "bat", x: 1460, y: 290 },
    { k: "slime", x: 80, y: 600 }, { k: "slime", x: 220, y: 600 }, { k: "trash", x: 420, y: 600 }, { k: "bat", x: 300, y: 500 }, { k: "batE", x: 600, y: 450 },
    { k: "slime", x: 620, y: 600 }, { k: "slime", x: 690, y: 600 }, { k: "trashE", x: 860, y: 600 }, { k: "bat", x: 820, y: 500 },
    { k: "slime", x: 950, y: 600 }, { k: "gold", x: 1080, y: 600 }, { k: "trash", x: 1130, y: 600 }, { k: "bat", x: 1150, y: 480 }, { k: "slime", x: 470, y: 544 },
  ],
  intro: ["系統：……這裡就是巢穴。好臭。", "系統：我聞到了。牠就在附近。……不，是在下面。"],
  caches: [{ x: 1150, y: 144, n: 9 }, { x: 560, y: 344, n: 7 }, { x: 228, y: 504, n: 8 }],
  events: [
    { x: 300, say: "系統：牆上黏黏的……這整座山，都是牠吃剩的東西。" },
    { x: 860, say: "系統：底下有東西在打呼。……地板在震。先把祭壇點亮再說。" },
    { x: 1250, say: "系統：屋頂破了個洞。下面就是牠的房間。跳下去就回不來了喔。" },
    { x: 1300, y: 540, lock: [1256, 1784], waves: [[["boss", 0]]] },
  ],
};
// 8b 測試地圖：怪擺在各層、兩座祭壇、出口在最上層
export const STAGE_TEST = {
  name: "測試：大地圖", start: { x: 60, y: 600 }, exitX: 1140, exitY: 300, intro: ["系統：這是測試用的大地圖。往上爬。"], caches: [], events: [],
  altars: [{ x: 300 }, { x: 640, y: 420 }],
  spawns: [
    { k: "slime", x: 600, y: 600 }, { k: "slime", x: 700, y: 600 }, { k: "trash", x: 900, y: 600 }, { k: "bat", x: 800, y: 540 },
    { k: "slime", x: 200, y: 420 }, { k: "slime", x: 800, y: 420 }, { k: "slimeE", x: 900, y: 420 }, { k: "bat", x: 500, y: 380 },
    { k: "trash", x: 400, y: 220 }, { k: "slime", x: 600, y: 220 }, { k: "bat", x: 1100, y: 250 },
  ],
};
// 無限模式：用原本的 1-1（一個畫面高），只有起點和出口會用到
export const STAGE_ENDLESS = { ...STAGE_1_1, start: { x: 200, y: 184 }, exitX: 2318, exitY: 0, altars: [], spawns: [], caches: [], features: [], events: [] };
export const STAGES = { endless: STAGE_ENDLESS, "1-1": STAGE_1_1, "1-2": STAGE_1_2, "1-3": STAGE_1_3, "1-4": STAGE_1_4, test: STAGE_TEST };

const SAY_TIME = 3.2, HINT_TIME = 5;

export class Director {
  /** api: { spawnEnemy(kind, x, y), say(msg, sec), hint(msg, sec), alive(), dropCache(x, y, n), clear() } */
  constructor(stage, api, isTouch) {
    Object.assign(this, { stage, api, isTouch, next: 0, lock: null, waves: null, wave: 0, waveDelay: 0, done: false, time: 0, holdT: 0 });
    for (const m of stage.intro) api.say(m, SAY_TIME);
    for (const c of stage.caches) api.dropCache(c.x, c.y, c.n);
    // 8b（使用者 2026-11-05：不要隱形牆和遭遇戰，參考 Ori）：怪物一開始就擺在地圖上。
    // 有 spawns 的關卡照 spawns 擺；還沒重新設計的舊關卡，把原本每個事件的波次攤開，擺在事件位置前面一段路上。
    // 重生規則 2：打死就不見，重進關卡才會再出現（重進＝重新載入頁面，自然又是一整批）。
    if (stage.spawns) for (const sp of stage.spawns) { const e = api.spawnEnemy(sp.k, sp.x, sp.y); if (e && sp.core) e.core = sp.core; }
    else for (const ev of stage.events) {
      if (!ev.waves || ev.lock) continue;
      const all = ev.waves.flat();
      all.forEach(([kind], i) => {
        const x = ev.x + 150 + i * 34 + (i % 2) * 9;
        this.api.spawnEnemy(kind, x, kind.startsWith("bat") ? "air" : undefined);
      });
    }
  }

  update(dt, player, camX, W) {
    if (this.done) return;
    this.time += dt;
    if ((this.holdT -= dt) > 0) return;   // 大檢查：王戰中死掉，淡出、送回祭壇的這段時間不要又觸發王房
    // 戰鬥中：等這一波清完，再出下一波
    if (this.lock) {
      if (this.api.alive(this.lock) === 0 && (this.waveDelay -= dt) <= 0) {
        if (this.wave < this.waves.length) this.spawnWave(this.waves[this.wave++]);
        else {
          this.lock = null;
          if (!this.stage.events.some((e) => e.lock)) this.api.say("系統：清除！……哼，還算可以。", 2);
        }
      } else if (this.api.alive(this.lock) > 0) this.waveDelay = 0.6;
      return;
    }
    // 走到下一個事件的位置就觸發
    const ev = this.stage.events[this.next];
    // 使用者 2026-11-06：一段一段來——系統上一句還沒講完就先等；quiet＝還要等前面幾段（擺在這個位置以前）醒著的怪清掉才講（最多等 8 秒）
    const reached = ev && player.x >= ev.x && (ev.y == null || player.y >= ev.y);   // 10 批：y＝要在這個高度以下才算（王房在屋頂底下）
    if (!reached) this.waitT = 0;
    else if ((this.waitT = (this.waitT ?? 0) + dt) < 8 && ((ev.quiet && this.api.busy?.(player.x, player.y, ev.x)) || (ev.waitCore && this.api.coreLeft?.()) || (this.stage.paced && this.api.talking?.()))) { /* 等一下 */ }
    else {
      this.next++; this.waitT = 0;
      if (this.stage.paced && (ev.say || ev.tip)) this.api.cut?.();
      if (ev.ult) this.ultOK = true;
      if (ev.teach) this.api.teach?.(ev.teach);
      if (ev.say) this.api.say(ev.say, SAY_TIME);
      if (ev.hint) this.api.hint(this.isTouch ? ev.hint.touch : ev.hint.key, HINT_TIME);
      if (ev.tip) this.api.say("系統：" + (this.isTouch ? ev.tip.touch : ev.tip.key), HINT_TIME, ev.tip.focus);
      if (ev.waves && ev.lock) {   // 只剩王的房間會封住（真的牆圍起來的場地）
        this.lock = ev.lock ? { l: ev.lock[0], r: ev.lock[1] } : { l: Math.round(camX), r: Math.round(camX) + W };
        this.waves = ev.waves;
        this.wave = 0;
        this.waveDelay = 0.4;
      }
    }
    if (!this.lock && this.next >= this.stage.events.length && player.x >= this.stage.exitX && (!this.stage.exitY || Math.abs(player.y - this.stage.exitY) < 40)) {
      this.done = true;
      this.api.clear();
    }
  }

  /** 10 批：王戰中死掉 → 解除封鎖，下次走進王房重新開打 */
  resetLock() {
    if (!this.lock) return;
    this.lock = null; this.waves = null;
    this.next = this.stage.events.findIndex((e) => e.lock);
    this.holdT = 1;
  }

  spawnWave(list) {
    const { l, r } = this.lock;
    list.forEach(([kind, side], i) => {
      const x = side > 0 ? r - 24 - i * 14 : side < 0 ? l + 24 + i * 14 : l + 60 + Math.random() * (r - l - 120);
      this.api.spawnEnemy(kind, x, kind.startsWith("bat") ? 40 + Math.random() * 30 : undefined);
    });
  }
}
