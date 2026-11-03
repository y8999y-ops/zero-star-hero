// 碎星鎮（M6）：可以走動的橫向小鎮，不能戰鬥。構圖＝ docs/城鎮草稿-構圖.png（使用者 2026-11-04 確認）。
// 圖層（視差）：天空色帶（不動）→ 遠景：隕石坑邊緣＋坑裡發光的大星星碎片（0.15）→ 中景山丘（0.4）→ 街道與建築（1）。
// 光：窗戶、路燈、工坊爐火、大星星碎片都是光源（light.js），會把附近的牆和地面照成暖色（柔和）。
// 參考見 docs/素材參考.md「碎星鎮」：模組化的門窗屋頂、冷色牆面配暖色窗光、門邊的暖色燈。
import { hex } from "../../pixelfx/src/core/index.js";
import { tintOf } from "./light.js";
import { FLOOR, H } from "./level.js";
import { paintNpc } from "./npcs.js";

const C = (s) => hex(s) >>> 0;
export const TOWN_W = 1000;

// ---- 鎮上的東西（世界座標）
export const NPCS = [
  { id: "clerk", name: "公會櫃檯・波波", x: 186, place: "guild" },
  { id: "golem", name: "工坊老闆・岩叔", x: 412, place: "workshop", flip: false },
  { id: "mushroom", name: "旅館老闆娘・菇媽", x: 752, place: "inn", flip: true },
];
const LAMPS = [328, 560, 822];
const WINDOWS = [];        // [x, y, w, h]（建造時填）
const FORGE = { x: 448, y: FLOOR - 12 };
export const SIGNPOST = { x: 930 };

// ---- 圖層緩衝區
const SKY = ["#241c48", "#30225a", "#46306a", "#6a3c74", "#9a5070", "#c86e6a", "#e8946a"].map(C);
const skyRow = new Uint32Array(H);
for (let y = 0; y < H; y++) skyRow[y] = SKY[Math.min(SKY.length - 1, Math.floor(y / 18))];
const FAR_W = 700, MID_W = 900;
const FAR = new Uint32Array(FAR_W * H), MID = new Uint32Array(MID_W * H), MAIN = new Uint32Array(TOWN_W * H);
const EMIT = new Uint8Array(TOWN_W * H);   // 自己會發光的像素（窗戶、燈），不被光影改色

function build() {
  const rect = (buf, BW, x0, y0, x1, y1, c, emit = false) => {
    for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(BW - 1, x1); x++) { buf[y * BW + x] = c; if (emit && buf === MAIN) EMIT[y * BW + x] = 1; }
  };
  // 遠景：隕石坑邊緣（起伏的稜線）＋坑中央的大星星碎片
  for (let x = 0; x < FAR_W; x++) {
    const h = 104 + Math.round(Math.sin(x / 42) * 7 + Math.sin(x / 13) * 2);
    rect(FAR, FAR_W, x, h, x, H - 1, C("#3a2a50"));
    rect(FAR, FAR_W, x, h, x, h, C("#5a3e68"));
  }
  const crystal = (cx, top, hgt) => {
    for (let y = 0; y < hgt; y++) {
      const w = Math.round(y * 0.42), Y = top + y;
      for (let x = -w; x <= w; x++) FAR[Y * FAR_W + cx + x] = C(x < -w / 3 ? "#fff2a8" : x < w / 3 ? (y < hgt * 0.4 ? "#ffe27a" : "#f0b424") : "#c48412");
    }
  };
  crystal(420, 54, 54);
  crystal(452, 82, 26);
  // 中景：近一點的山丘（深紫）
  for (let x = 0; x < MID_W; x++) {
    const h = 124 + Math.round(Math.sin(x / 31 + 1) * 5 + Math.sin(x / 9) * 1);
    rect(MID, MID_W, x, h, x, H - 1, C("#2a2040"));
    rect(MID, MID_W, x, h, x, h, C("#3e2e56"));
  }
  // ---- 街道
  for (let y = FLOOR; y < H; y++) for (let x = 0; x < TOWN_W; x++) {
    const row = Math.floor((y - FLOOR) / 8), off = (row & 1) * 6, bx = (x + off) % 12, by = (y - FLOOR) % 8;
    MAIN[y * TOWN_W + x] = C(y === FLOOR ? "#7a7090" : y === FLOOR + 1 ? "#5a5270" : bx === 0 || by === 0 ? "#2e2a3c" : by === 1 ? "#4e4862" : "#3e3850");
  }
  // ---- 建築的零件（模組）
  const roof = (x0, x1, top, c, hi) => { for (let y = 0; y < 14; y++) rect(MAIN, TOWN_W, x0 - 7 + y, top - 14 + y, x1 + 7 - y, top - 14 + y, C(y < 2 ? hi : y === 13 ? "#1e1830" : c)); };
  const win = (x, y, w, h) => {
    rect(MAIN, TOWN_W, x - 1, y - 1, x + w, y + h, C("#2a1e2a"));
    rect(MAIN, TOWN_W, x, y, x + w - 1, y + h - 1, C("#ffc864"), true);
    rect(MAIN, TOWN_W, x, y, x + w - 1, y, C("#fff0b0"), true);
    rect(MAIN, TOWN_W, x + (w >> 1), y, x + (w >> 1), y + h - 1, C("#a06030"), true);
    rect(MAIN, TOWN_W, x, y + (h >> 1), x + w - 1, y + (h >> 1), C("#a06030"), true);
    rect(MAIN, TOWN_W, x - 2, y + h + 1, x + w + 1, y + h + 2, C("#5a4e5e"));   // 窗台
    WINDOWS.push([x + w / 2, y + h / 2]);
  };
  const door = (x, w, top = FLOOR - 26) => {
    rect(MAIN, TOWN_W, x - 1, top - 1, x + w, FLOOR - 1, C("#2a1e2a"));
    rect(MAIN, TOWN_W, x, top, x + w - 1, FLOOR - 1, C("#6e4224"));
    rect(MAIN, TOWN_W, x, top, x + 1, FLOOR - 1, C("#8e5a34"));
    for (let y = top + 4; y < FLOOR; y += 6) rect(MAIN, TOWN_W, x + 2, y, x + w - 1, y, C("#5a3418"));
    rect(MAIN, TOWN_W, x + w - 4, top + 13, x + w - 3, top + 14, C("#ffc83a"));   // 門把
  };
  const wall = (x0, x1, top, base, line, step, vertical) => {
    rect(MAIN, TOWN_W, x0, top, x1, FLOOR - 1, C(base));
    if (vertical) for (let x = x0 + 3; x < x1; x += step) rect(MAIN, TOWN_W, x, top, x, FLOOR - 1, C(line));
    else for (let y = top + step; y < FLOOR; y += step) { rect(MAIN, TOWN_W, x0, y, x1, y, C(line)); for (let x = x0 + ((y / step) % 2) * 8; x < x1; x += 16) rect(MAIN, TOWN_W, x, y - step + 1, x, y - 1, C(line)); }
    rect(MAIN, TOWN_W, x0, FLOOR - 4, x1, FLOOR - 1, C("#2e2838"));   // 牆腳
  };
  // 公會：藍灰石牆、最大棟、旗子、門上的星星盾牌招牌
  wall(60, 300, 96, "#4a5470", "#3c4460", 8, false);
  roof(60, 300, 96, "#2a3a6a", "#4a6aa8");
  win(78, 116, 16, 18); win(122, 116, 16, 18); win(230, 116, 16, 18); win(270, 116, 16, 18);
  door(172, 26, FLOOR - 30);
  rect(MAIN, TOWN_W, 174, 128, 196, 146, C("#2a1e2a")); rect(MAIN, TOWN_W, 175, 129, 195, 145, C("#c03a44"));   // 盾牌招牌
  for (const [dx, dy] of [[10, 2], [9, 3], [10, 3], [11, 3], [5, 6], [6, 6], [7, 6], [8, 6], [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6], [15, 6], [7, 7], [8, 7], [9, 7], [10, 7], [11, 7], [12, 7], [13, 7], [8, 8], [9, 8], [10, 8], [11, 8], [12, 8], [8, 9], [9, 9], [11, 9], [12, 9], [7, 10], [8, 10], [12, 10], [13, 10]]) MAIN[(129 + dy) * TOWN_W + 175 + dx] = C("#ffd84a");
  rect(MAIN, TOWN_W, 128, 56, 129, 82, C("#3a3040"));
  rect(MAIN, TOWN_W, 130, 58, 148, 70, C("#c03a44")); rect(MAIN, TOWN_W, 130, 58, 148, 59, C("#ff6a60"));
  rect(MAIN, TOWN_W, 136, 62, 142, 66, C("#ffd84a"));
  // 工坊：灰泥牆＋木樑、煙囪、門口爐火、鐵砧招牌
  wall(370, 520, 118, "#6a5e66", "#4a3e4e", 22, true);
  for (const y of [118, 150]) rect(MAIN, TOWN_W, 370, y, 520, y + 2, C("#4a3226"));
  roof(370, 520, 118, "#4a2e2a", "#7a4a3a");
  rect(MAIN, TOWN_W, 486, 80, 498, 104, C("#4a3e4e")); rect(MAIN, TOWN_W, 484, 78, 500, 81, C("#5a4e5e"));
  win(382, 130, 20, 14);
  rect(MAIN, TOWN_W, 433, FLOOR - 32, 465, FLOOR - 1, C("#2a1e2a"));
  rect(MAIN, TOWN_W, 434, FLOOR - 31, 464, FLOOR - 1, C("#3a1a14"));
  rect(MAIN, TOWN_W, 440, FLOOR - 14, 458, FLOOR - 1, C("#ff7a30"), true);   // 爐火
  rect(MAIN, TOWN_W, 444, FLOOR - 10, 454, FLOOR - 1, C("#ffd27a"), true);
  rect(MAIN, TOWN_W, 476, 150, 498, 160, C("#2a1e2a")); rect(MAIN, TOWN_W, 477, 151, 497, 154, C("#9aa6ba")); rect(MAIN, TOWN_W, 482, 155, 492, 159, C("#6e7a90"));   // 鐵砧招牌
  // 旅館：木板牆、兩層、杯子招牌、陽台
  wall(600, 790, 98, "#6e4a3a", "#5a3a2e", 6, false);
  roof(600, 790, 98, "#3a2a5a", "#5a4a8a");
  win(616, 112, 14, 14); win(654, 112, 14, 14); win(722, 112, 14, 14); win(760, 112, 14, 14);
  rect(MAIN, TOWN_W, 600, 134, 790, 136, C("#4a3226"));
  win(616, 146, 14, 14); win(760, 146, 14, 14);
  door(684, 22);
  rect(MAIN, TOWN_W, 716, 142, 734, 158, C("#2a1e2a")); rect(MAIN, TOWN_W, 717, 143, 733, 157, C("#e8b478"));   // 杯子招牌
  rect(MAIN, TOWN_W, 721, 146, 728, 154, C("#ffffff")); rect(MAIN, TOWN_W, 729, 148, 730, 152, C("#ffffff"));
  // 路燈
  for (const x of LAMPS) {
    rect(MAIN, TOWN_W, x, 142, x + 1, FLOOR - 1, C("#2a2440"));
    rect(MAIN, TOWN_W, x - 3, 132, x + 4, 133, C("#2a2440"));
    rect(MAIN, TOWN_W, x - 2, 134, x + 3, 141, C("#ffd27a"), true);
    rect(MAIN, TOWN_W, x - 2, 134, x + 3, 134, C("#fff2a8"), true);
  }
  // 右邊：往墜星之谷的路標＋木柵欄；左邊：鎮的入口拱門
  rect(MAIN, TOWN_W, SIGNPOST.x, 150, SIGNPOST.x + 1, FLOOR - 1, C("#6e4224"));
  rect(MAIN, TOWN_W, SIGNPOST.x - 10, 150, SIGNPOST.x + 18, 158, C("#2a1e2a")); rect(MAIN, TOWN_W, SIGNPOST.x - 9, 151, SIGNPOST.x + 17, 157, C("#b07240"));
  for (let i = 0; i < 6; i++) MAIN[(154) * TOWN_W + SIGNPOST.x + 6 + i] = C("#3e2414");
  MAIN[153 * TOWN_W + SIGNPOST.x + 10] = C("#3e2414"); MAIN[155 * TOWN_W + SIGNPOST.x + 10] = C("#3e2414");
  for (let x = 950; x < TOWN_W; x += 8) { rect(MAIN, TOWN_W, x, 166, x + 2, FLOOR - 1, C("#6e4224")); }
  rect(MAIN, TOWN_W, 950, 170, TOWN_W - 1, 171, C("#8e5a34"));
  rect(MAIN, TOWN_W, 8, 120, 14, FLOOR - 1, C("#4a4258")); rect(MAIN, TOWN_W, 40, 120, 46, FLOOR - 1, C("#4a4258"));
  for (let x = 6; x <= 48; x++) { const y = 116 - Math.round(Math.sin(((x - 6) / 42) * Math.PI) * 8); rect(MAIN, TOWN_W, x, y, x, y + 3, C("#5a5270")); }
}
build();

/** 鎮上的固定光源（每幀傳給 computeLight） */
export function townLights(time) {
  const list = [];
  for (const [x, y] of WINDOWS) list.push({ x, y, r: 30, lv: 1.3, col: "#ffb050" });
  for (const x of LAMPS) list.push({ x: x + 0.5, y: 137, r: 58 + (Math.floor(time * 6) % 2), lv: 2.2, col: "#ffb860" });
  list.push({ x: FORGE.x, y: FORGE.y, r: 52 + (Math.floor(time * 9) % 3) * 2, lv: 2.6, col: "#ff7a30" });
  list.push({ x: 420 + 60, y: 90, r: 90, lv: 1.2, par: 0.15, col: "#ffd27a" });   // 大星星碎片（遠景）
  return list;
}

const wrap = (x, w) => ((x % w) + w) % w;
/** 畫鎮的背景＋街道。lv：light.js 算出來的亮度（遠景不受光；街道和牆被照到時變亮並加上光的顏色）。 */
export function drawTown(frame, lv, time) {
  const W = frame.w, cx = frame.ox | 0, cy = frame.oy | 0, out = frame.color, LB = frame.light, [TR, TG, TB] = tintOf();
  const of = Math.floor(cx * 0.15), om = Math.floor(cx * 0.4);
  for (let y = 0; y < H; y++) {
    const wy = y + cy, row = y * W;
    if (wy < 0 || wy >= H) { out.fill(skyRow[0], row, row + W); continue; }
    for (let x = 0; x < W; x++) {
      const i = row + x, gx = x + cx;
      let v = gx >= 0 && gx < TOWN_W ? MAIN[wy * TOWN_W + gx] : 0;
      if (v) {
        out[i] = v;
        const l = lv[i];
        if (l > 0.02 && !EMIT[wy * TOWN_W + gx]) LB[i] = 0xff000000 | (Math.min(255, TB[i] * 0.9) << 16) | (Math.min(255, TG[i] * 0.9) << 8) | Math.min(255, TR[i] * 0.9);
        continue;
      }
      v = MID[wy * MID_W + wrap(x + om, MID_W)] || FAR[wy * FAR_W + wrap(x + of, FAR_W)];
      out[i] = v || skyRow[wy];
    }
  }
  const add = (x, y, r, g, b, k) => { x -= cx; y -= cy; if (x < 0 || y < 0 || x >= W || y >= frame.h) return; const i = y * W + x, d = LB[i]; LB[i] = 0xff000000 | (Math.min(255, ((d >>> 16) & 255) + b * k) << 16) | (Math.min(255, ((d >>> 8) & 255) + g * k) << 8) | Math.min(255, (d & 255) + r * k); };
  // 螢火蟲：慢慢飄，一閃一閃（特效層，柔和的光點）
  for (let n = 0; n < 26; n++) {
    const r1 = Math.sin(n * 91.7) * 43758.5, r2 = Math.sin(n * 37.1) * 12345.6, f1 = r1 - Math.floor(r1), f2 = r2 - Math.floor(r2);
    const fx = Math.round(f1 * TOWN_W + Math.sin(time * 0.6 + n) * 14), fy = Math.round(120 + f2 * 56 + Math.sin(time * 0.9 + n * 2) * 6);
    const on = 0.5 + 0.5 * Math.sin(time * 2.2 + n * 1.7);
    if (on < 0.15) continue;
    const X = fx - cx, Y = fy - cy;
    if (X >= 0 && Y >= 0 && X < W && Y < frame.h) out[Y * W + X] = 0xffa0f4d4;
    for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) { const f = 1 - Math.hypot(x, y) / 4.5; if (f > 0) add(fx + x, fy + y, 200, 255, 140, f * f * on * 0.5); }
  }
  // 工坊煙囪的煙、星星碎片的光點（特效層，柔和）
  for (let n = 0; n < 5; n++) {
    const t = (time * 0.35 + n / 5) % 1, sx = 492 + Math.round(Math.sin(t * 6 + n) * 3 + t * 10), sy = 78 - Math.round(t * 50), R = 3 + Math.round(t * 5);
    for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) { const f = 1 - Math.hypot(x, y) / R; if (f > 0) add(sx + x, sy + y, 120, 110, 130, f * (1 - t) * 0.5); }
  }
}

/** 居民（待機 8 格，每格 1/8 秒） */
export function drawTownNpcs(frame, time) {
  const f = Math.floor(time * 8) % 8;
  for (const n of NPCS) paintNpc(frame, n.id, f, n.x, FLOOR - 1, n.flip);
}
/** 主角附近的居民或路標（可以對話的） */
export function nearby(x) {
  for (const n of NPCS) if (Math.abs(n.x - x) < 26) return n;
  if (Math.abs(SIGNPOST.x - x) < 22) return { id: "sign", name: "路標", x: SIGNPOST.x, place: "sign" };
  return null;
}
