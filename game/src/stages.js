// 第一章的關卡清單：每一關的地形（寬、平台、火把、主題）。流程（事件、怪物波次）在 stage.js。
// 換場景會重新載入頁面；載入時先決定這次是哪一關，level.js 照這一關的地形烘焙。
// 開發用：網址加 ?stage=1-2 直接進那一關。
export const STAGE_KEY = "zero-hero-stage";
export const STAGE_ORDER = ["1-1", "1-2", "1-3", "1-4"];

export const LAYOUTS = {
  // 1-1 墜落之底：原本的深淵垃圾山
  "1-1": {
    name: "墜落之底", theme: "abyss", w: 2400,
    platforms: [
      { x: 330, y: 138, w: 96 }, { x: 520, y: 104, w: 72 }, { x: 700, y: 140, w: 120 },
      { x: 1000, y: 122, w: 88 }, { x: 1180, y: 92, w: 64 }, { x: 1340, y: 138, w: 112 },
      { x: 1640, y: 116, w: 96 }, { x: 1840, y: 142, w: 80 }, { x: 2040, y: 108, w: 104 },
    ],
    torches: [180, 620, 1090, 1520, 1960, 2260],
  },
  // 1-2 垃圾山：上面的世界丟下來的垃圾堆成山，平台是木板和鐵架，到處都是垃圾堆
  "1-2": {
    name: "垃圾山", theme: "junk", w: 2800,
    platforms: [
      { x: 280, y: 146, w: 80 }, { x: 400, y: 118, w: 64 }, { x: 520, y: 92, w: 80 }, { x: 700, y: 136, w: 112 },
      { x: 930, y: 112, w: 72 }, { x: 1060, y: 146, w: 96 }, { x: 1260, y: 120, w: 80 }, { x: 1400, y: 94, w: 64 },
      { x: 1540, y: 132, w: 120 }, { x: 1800, y: 110, w: 88 }, { x: 1960, y: 144, w: 72 }, { x: 2120, y: 116, w: 96 },
      { x: 2300, y: 92, w: 72 }, { x: 2440, y: 138, w: 96 },
    ],
    torches: [160, 860, 1700, 2580],
  },
  // 1-3 蝙蝠洞窟：更深更暗，只靠水晶發光；平台一層一層往上，蝙蝠很多
  "1-3": {
    name: "蝙蝠洞窟", theme: "cave", w: 2600,
    platforms: [
      { x: 300, y: 142, w: 88 }, { x: 440, y: 112, w: 72 }, { x: 580, y: 84, w: 96 }, { x: 760, y: 120, w: 80 },
      { x: 960, y: 140, w: 120 }, { x: 1150, y: 106, w: 72 }, { x: 1300, y: 78, w: 88 }, { x: 1480, y: 116, w: 96 },
      { x: 1700, y: 140, w: 80 }, { x: 1840, y: 104, w: 104 }, { x: 2040, y: 132, w: 88 }, { x: 2220, y: 96, w: 80 },
    ],
    torches: [180, 1260, 2380],
  },
  // 1-4 大胃王的巢穴：一個畫面多一點的封閉場地，兩側矮平台、中間高平台（王放大招時站上去）
  "1-4": {
    name: "大胃王的巢穴", theme: "lair", w: 560,
    platforms: [{ x: 40, y: 140, w: 72 }, { x: 448, y: 140, w: 72 }, { x: 226, y: 96, w: 108 }],
    torches: [34, 526],
  },
};

const QS = typeof location !== "undefined" ? new URLSearchParams(location.search) : new URLSearchParams();
/** 這次載入要玩哪一關（無限模式固定用 1-1 的地形） */
export function currentStageId() {
  const next = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("zero-hero-next") : null;
  if (next === "endless" || (!next && QS.has("endless"))) return "1-1";
  const q = QS.get("stage");
  if (q && LAYOUTS[q]) return q;
  const s = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(STAGE_KEY) : null;
  return LAYOUTS[s] ? s : "1-1";
}
export const STAGE_ID = currentStageId();
export const LAYOUT = LAYOUTS[STAGE_ID];
