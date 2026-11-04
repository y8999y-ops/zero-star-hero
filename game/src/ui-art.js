// 自製介面素材：面板框、物品格、按鈕、觸控按鈕、圖示，全部在載入時用程式畫成像素圖，
// 再放大成 data URL 交給 CSS 用（border-image / background）。改顏色或形狀就改這裡。
import { ICONS, ICON_SIZE } from "./icons.js";
import { RARITY } from "./items.js";

const OUT = "#0a0810";

/** 畫一張 w×h 的像素圖，放大 k 倍，回傳 canvas。draw(px) 裡用 px(x, y, color) 畫點。 */
function pixels(w, h, k, draw) {
  const c = document.createElement("canvas");
  c.width = w * k;
  c.height = h * k;
  const g = c.getContext("2d");
  draw((x, y, col) => {
    if (!col || x < 0 || y < 0 || x >= w || y >= h) return;
    g.fillStyle = col;
    g.fillRect(x * k, y * k, k, k);
  });
  return c;
}
const url = (c) => c.toDataURL();

// ghost：只畫剪影（空裝備欄的提示），用實色不用半透明
function stampIcon(px, name, ox, oy, ghost = null) {
  ICONS[name].forEach((c, i) => c && px(ox + (i % ICON_SIZE), oy + ((i / ICON_SIZE) | 0), ghost ?? c));
}

/** 圖示 → data URL（有快取）。ghost 給顏色就畫成那個顏色的剪影。 */
const iconCache = new Map();
export function iconURL(name, k = 2, ghost = null) {
  const key = name + k + ghost;
  if (!iconCache.has(key)) iconCache.set(key, url(pixels(ICON_SIZE, ICON_SIZE, k, (px) => stampIcon(px, name, 0, 0, ghost))));
  return iconCache.get(key);
}

// 兩個顏色混合（取代半透明：直接算出混好的實色）
function mixHex(a, b, t) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const A = p(a), B = p(b);
  return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("");
}

// 面板（參考 Golden UI）：外框 1px、金色斜面（左上亮、右下暗）、內框 1px、深紫底。
// 外角用 1-1 階梯修圓。16×16，九宮格切 4。
const GOLD_PANEL = ["#f0c060", "#8a5a1c", "#c08a30", "#1d1730"];
const SYS_PANEL = ["#a8f0ff", "#1e5a8c", "#4ab0e0", "#0c1a30"];   // 系統視窗：青藍色全像框
function panel(k, [hi, lo, mid, bg] = GOLD_PANEL) {
  return pixels(16, 16, k, (px) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const dx = Math.min(x, 15 - x), dy = Math.min(y, 15 - y);
      if (dx + dy < 2) continue;                       // 圓角外面
      if (dx + dy === 2 && dx < 2 && dy < 2) { px(x, y, OUT); continue; }
      const d = Math.min(dx, dy), tl = x + y < 15;
      px(x, y, d === 0 ? OUT : d === 1 ? (tl ? hi : lo) : d === 2 ? mid : d === 3 ? OUT : bg);
    }
  });
}

// 小框（詳細欄、統計欄）：內凹，左上暗、右下亮（10×10，切 3）
function inset(k) {
  return pixels(10, 10, k, (px) => {
    for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) {
      const d = Math.min(x, y, 9 - x, 9 - y), tl = x + y < 9;
      if ((x === 0 || x === 9) && (y === 0 || y === 9)) continue;
      px(x, y, d === 0 ? OUT : d === 1 ? (tl ? "#0e0b16" : "#3a2f52") : "#141020");
    }
  });
}

// 物品格（參考 Golden UI 的內凹格子）：外框顏色代表稀有度，魔法以上內圈再加一層較暗的同色（20×20）
function slot(k, ring, glow) {
  const inner = glow ? mixHex(ring, "#120e1c", 0.6) : null;
  return pixels(20, 20, k, (px) => {
    for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
      const d = Math.min(x, y, 19 - x, 19 - y);
      if ((x === 0 || x === 19) && (y === 0 || y === 19)) continue;
      let c = d === 0 ? OUT : d === 1 ? ring : "#120e1c";
      if (d === 2) c = inner ?? (x === 2 || y === 2 ? "#0a0812" : "#120e1c");   // 內陰影在左上
      px(x, y, c);
    }
  });
}

// 一般按鈕（參考 Kenney Pixel UI）：左上亮邊，下緣兩列深色「厚度」；按下去時厚度消失、整顆變暗（12×12，切 4）
function button(k, pressed, base = ["#f0c050", "#c89030", "#8a5a1c", "#4a2c0c"]) {
  const [hi, mid, lo, dk] = base;
  return pixels(12, 12, k, (px) => {
    for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) {
      const d = Math.min(x, y, 11 - x, 11 - y);
      if ((x === 0 || x === 11) && (y === 0 || y === 11)) continue;
      let c;
      if (d === 0) c = OUT;
      else if (pressed) c = y === 1 ? dk : lo;
      else if (y >= 9) c = y === 10 ? dk : lo;          // 下緣厚度
      else if (y === 1 || x === 1) c = hi;
      else if (x === 10) c = lo;
      else c = mid;
      px(x, y, c);
    }
  });
}

// 圓形：用 4 鄰格「一圈一圈往內剝」算出每格在第幾層，外框、色環、內框都剛好 1px，階梯一致
function discLayers(size) {
  const c = (size - 1) / 2, r2 = (size / 2) * (size / 2) - 0.5;
  return peel(size, (x, y) => (x - c) ** 2 + (y - c) ** 2 <= r2);
}
function peel(size, inside) {
  let cur = new Set();
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (inside(x, y)) cur.add(y * size + x);
  const layer = new Map();
  for (let n = 1; cur.size; n++) {
    const edge = [...cur].filter((i) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
      const x = (i % size) + dx, y = ((i / size) | 0) + dy;
      return x < 0 || y < 0 || x >= size || y >= size || !cur.has(y * size + x);
    }));
    for (const i of edge) { layer.set(i, n); cur.delete(i); }
  }
  return layer;
}

// 觸控圓形按鈕：外框、上亮下暗的色環、內框、實色深底、中間圖示
function roundButton(size, k, ringA, ringB, iconName, on) {
  const layer = discLayers(size), half = size / 2;
  return pixels(size, size, k, (px) => {
    for (const [i, n] of layer) {
      const x = i % size, y = (i / size) | 0;
      px(x, y, n === 1 ? OUT : n <= 3 ? (y < half ? ringA : ringB) : n === 4 ? OUT : on ? "#4a3a14" : "#181426");
    }
    const o = Math.round((size - ICON_SIZE) / 2);
    stampIcon(px, iconName, o, o);
  });
}

// 血條外框（9×9，切 3）
function barFrame(k) {
  return pixels(9, 9, k, (px) => {
    for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) {
      const d = Math.min(x, y, 8 - x, 8 - y);
      if ((x === 0 || x === 8) && (y === 0 || y === 8)) continue;
      px(x, y, d === 0 ? OUT : d === 1 ? (y < 4 ? "#f0c060" : "#8a5a1c") : d === 2 ? OUT : null);
    }
  });
}

// 主角徽章（HUD 左上）：圓盤加五個星芒，外框 1px、金環 2px（左上亮）、內框 1px、深底。
// face(x, y) 回傳內圈要畫的顏色（目前形態的主角），超出內圈的會被切掉。
const MEDAL = 38;
const medalLayers = (() => {
  const c = (MEDAL - 1) / 2, Ro = 18.9, Ri = 10;
  const inStar = (x, y) => {
    const dx = x - c, dy = y - c, r = Math.hypot(dx, dy);
    let a = Math.atan2(dx, -dy) / (Math.PI * 2 / 5);   // 0 在正上方，一個尖角一單位
    a = Math.abs(a - Math.round(a));                      // 離最近的尖角多遠（0～0.5）
    return r <= Ri + (Ro - Ri) * Math.max(0, 1 - a * 3.6);
  };
  return peel(MEDAL, (x, y) => (x - c) ** 2 + (y - c) ** 2 <= 13.6 ** 2 || inStar(x, y));
})();
export function medal(k, face, ring = ["#fff2a8", "#f0c050", "#c08a30", "#8a5a1c"]) {
  return pixels(MEDAL, MEDAL, k, (px) => {
    for (const [i, n] of medalLayers) {
      const x = i % MEDAL, y = (i / MEDAL) | 0, tl = x + y < MEDAL - 1;
      if (n === 1) px(x, y, OUT);
      else if (n <= 3) px(x, y, n === 2 ? (tl ? ring[0] : ring[3]) : (tl ? ring[1] : ring[2]));
      else if (n === 4) px(x, y, OUT);
      else px(x, y, face(x, y) ?? (y < MEDAL / 2 ? "#2a2148" : "#1d1730"));
    }
  });
}
export const MEDAL_SIZE = MEDAL;

// 對話泡泡（路人用）：白底、1px 外框、圓角（12×12，切 4）；尾巴另外一張 7×5
function bubble(k) {
  return pixels(12, 12, k, (px) => {
    for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) {
      const dx = Math.min(x, 11 - x), dy = Math.min(y, 11 - y);
      if (dx + dy < 2) continue;
      const edge = dx === 0 || dy === 0 || (dx + dy === 2 && dx < 2 && dy < 2);
      px(x, y, edge ? OUT : y >= 10 ? "#c8c0dc" : "#fbf8ff");
    }
  });
}
function bubbleTail(k) {
  const rows = ["o#####o", ".o###o.", "..o#o..", "...o..."];   // 第一列蓋住泡泡的下框
  return pixels(7, 4, k, (px) => rows.forEach((r, y) => [...r].forEach((ch, x) => ch !== "." && px(x, y, ch === "o" ? OUT : "#c8c0dc"))));
}

/** 把所有介面素材設成 CSS 變數。在遊戲一開始呼叫一次。 */
export function installUiArt() {
  const root = document.documentElement.style;
  const set = (name, c) => root.setProperty(name, `url(${url(c)})`);
  set("--panel", panel(3));
  set("--panel-sys", panel(3, SYS_PANEL));
  set("--panel-sys2", panel(2, SYS_PANEL));
  set("--tab", button(2, false));
  set("--bubble", bubble(2));
  set("--bubble-tail", bubbleTail(2));
  set("--inset", inset(2));
  set("--btn", button(3, false));
  set("--btn-down", button(3, true));
  set("--bar", barFrame(2));
  // 小按鈕（背包裡用）
  const RED = ["#ff8a7a", "#d84a3c", "#8c2030", "#4a0c14"];
  set("--sbtn", button(2, false));
  set("--sbtn-down", button(2, true));
  set("--sbtn-red", button(2, false, RED));
  set("--sbtn-red-down", button(2, true, RED));
  set("--slot-empty", slot(2, "#3a2f52"));
  RARITY.forEach((r, i) => set(`--slot-${i}`, slot(2, r.color, i >= 2)));
  set("--slot-sel", slot(2, "#ffffff", true));
  // 觸控按鈕：大小都是 3 的倍數，放大後像素一樣大
  setAttackIcon("sword");
  set("--tb-dash", roundButton(24, 3, "#8ab8ff", "#2c4a8c", "dash"));
  set("--tb-dash-on", roundButton(24, 3, "#d0e4ff", "#5a8ae0", "dash", true));
  set("--tb-skill", roundButton(22, 3, "#ffb060", "#b04a14", "fire"));
  set("--tb-ult", roundButton(22, 3, "#fff09a", "#c48412", "star"));
  set("--tb-ult-on", roundButton(22, 3, "#ffffff", "#ffd84a", "star", true));
  set("--tb-skill-on", roundButton(22, 3, "#ffe0a0", "#ff8a2a", "fire", true));
  set("--tb-bag", roundButton(22, 2, "#d8a878", "#6a4426", "bag"));
  set("--ic-heart", pixels(16, 16, 2, (px) => stampIcon(px, "heart", 0, 0)));
  set("--ic-coin", pixels(16, 16, 2, (px) => stampIcon(px, "coin", 0, 0)));
  set("--ic-scrap", pixels(16, 16, 2, (px) => stampIcon(px, "scrap", 0, 0)));
  set("--ic-close", pixels(16, 16, 2, (px) => stampIcon(px, "close", 0, 0)));
  set("--ic-sort", pixels(16, 16, 2, (px) => stampIcon(px, "sort", 0, 0)));
}

/** 攻擊按鈕上的圖示跟著目前的武器換。 */
const atkCache = {};
export function setAttackIcon(icon) {
  atkCache[icon] ??= [roundButton(32, 3, "#ffd84a", "#b07c1c", icon), roundButton(32, 3, "#fff2a0", "#ffd84a", icon, true)].map(url);
  document.documentElement.style.setProperty("--tb-atk", `url(${atkCache[icon][0]})`);
  document.documentElement.style.setProperty("--tb-atk-on", `url(${atkCache[icon][1]})`);
}
