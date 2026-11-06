// 碎星鎮（M6，2026-11-04 依世界觀重畫）：建在大隕石坑內側台地上的小鎮，各種族一起住。
// 設計（docs/素材參考.md「碎星鎮（重畫）」）：
//   - 背景：坑底半埋著一顆巨大的墜落星星，往上冒光柱；坑壁上插著發光的水晶碎片；滿天星星會閃（這裡叫碎星鎮）
//   - 中景：坑壁上鑿出來的住家（圓窗亮著燈）、長在台階上的蘑菇屋、屋子之間掛著一串串小燈 → 大坑壁對比小房子（大小對比）
//   - 三棟店各照住的種族蓋：
//       公會：石頭＋木樑的大廳，「繞著第一塊墜落的碎片蓋起來」，碎片從屋頂穿出去發光；門口有任務告示板
//       工坊：魔像自己用巨石鑿出來的圓頂石屋，疊石煙囪、門口的爐火、鐵砧、裝碎片礦石的木箱
//       旅館：一朵巨大的蘑菇——柄是牆（圓窗）、紅色蓋子是屋頂、蓋上長小蘑菇，陽台、杯子招牌
//   - 路燈：插在扭曲木柱上的星星碎片（碎片就是燈）
//   - 前景：比主角近的深色草叢和小蘑菇（遮擋物，增加景深）
// 圖層（視差）：星空（0）→ 遠景坑底（0.12）→ 中景坑壁住家（0.35）→ 街道與店（1）→ 前景（1.3）。
// 光：窗戶、碎片路燈、爐火、公會的碎片、坑底的大星星都是光源（light.js），把牆和地面照成暖色（柔和）。
import { hex, createFx } from "../../pixelfx/src/core/index.js";
import * as townRain from "./fx-town-rain.js";
import { tintOf } from "./light.js";
import { FLOOR, H } from "./level.js";
import { paintNpc } from "./npcs.js";
import { loadArt, cell, baseRow, blit, glows, glowClusters } from "./art.js";

// 美術素材（game/art/approved，Aseprite 重繪稿）：天空、遠景、中景、地面、前景、三棟店、城鎮裝飾、花草
import { createSky, SKY_W as STARSKY_W, SKY_H as STARSKY_H } from "./starsky.js";
const NIGHT = createSky();   // pixelfx 的流星夜空
let skyT = null;
const ART = await loadArt(["town/far", "town/mid", "town/ground", "town/fg", "town/guild", "town/workshop", "town/inn", "props/town-deco", "props/flowers", "props/grass"]);

const C = (s) => hex(s) >>> 0;
export const TOWN_W = 1000;

export const NPCS = [
  { id: "clerk", name: "公會櫃檯・波波", x: 186, place: "guild" },
  { id: "golem", name: "工坊老闆・岩叔", x: 404, place: "workshop" },
  { id: "mushroom", name: "旅館老闆娘・菇媽", x: 752, place: "inn", flip: true },
];
export const SIGNPOST = { x: 924 };
const LAMPS = [42, 330, 560, 836];
const LIGHTS = [];   // [x, y, r, lv, col]：建造時把窗戶、碎片記下來

// ---- 色票
const SKY = ["#0e0a24", "#130e2e", "#181238", "#1e1642", "#261a4c", "#301e56", "#3c225e", "#4c2864", "#5e2e68"].map(C);
const P = (a) => a.map(C);
const STONE = P(["#262230", "#3a3446", "#544c62", "#706680", "#928aa2"]);   // 魔像的石頭
const BLUE = P(["#222a40", "#323c58", "#465470", "#5e6e8c", "#7c8ca8"]);    // 公會石牆
const WOOD = P(["#2a180e", "#46281a", "#683e24", "#8e5a32", "#b27a44"]);
const SLATE = P(["#161a34", "#22284a", "#303a64", "#44508a", "#5c6aa8"]);
const CAP = P(["#4a1020", "#721a2c", "#a02a3a", "#cc3e48", "#ec6a68"]);
const STEM = P(["#6e6048", "#9a8a6a", "#c4b48e", "#e4d8b6", "#f6eed6"]);
const GOLD = P(["#a0600e", "#d8901a", "#f6c03a", "#ffe27a", "#fff8d0"]);
const TEALC = P(["#126068", "#1f8a8c", "#3cc8c0", "#9af0e0", "#e0fff8"]);
const DIRT = P(["#1e1626", "#2a2032", "#382c40", "#463850", "#56465e"]);
const GRASS = P(["#16281e", "#20382a", "#2e4e36", "#3e6844", "#548652"]);
const WARM = C("#ffc864"), WARM_HI = C("#fff0b0"), FRAME = C("#2a1e2a"), MULLION = C("#a06030");

// ---- 緩衝區
const FAR_W = 640, MID_W = 840, FG_W = 256, SKY_W = 480;
const FAR = new Uint32Array(FAR_W * H), MID = new Uint32Array(MID_W * H), MAIN = new Uint32Array(TOWN_W * H), FG = new Uint32Array(FG_W * H);
const EMIT = new Uint8Array(TOWN_W * H);   // 自己會發光的像素（窗戶、碎片、火），光影不改它

// 畫圖工具：每個都畫在指定的緩衝區
function pen(buf, BW) {
  const inb = (x, y) => x >= 0 && y >= 0 && x < BW && y < H;
  const api = {
    px(x, y, c, emit = false) { x = Math.round(x); y = Math.round(y); if (!inb(x, y)) return; buf[y * BW + x] = c; if (emit && buf === MAIN) EMIT[y * BW + x] = 1; },
    rect(x0, y0, x1, y1, c, emit) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) api.px(x, y, c, emit); },
    // 橢圓：shade(u, v) 回傳顏色，u、v 是 -1～1（左上為負）
    ellipse(cx, cy, rx, ry, shade, emit, clipY = H) {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry) && y < clipY; y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const u = (x - cx) / rx, v = (y - cy) / ry;
        if (u * u + v * v <= 1) api.px(x, y, shade(u, v, x, y), emit);
      }
    },
    // 凸多邊形（點的順序不限，用重心排序）
    poly(pts, shade, emit) {
      const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length, my = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      const P2 = pts.slice().sort((a, b) => Math.atan2(a[1] - my, a[0] - mx) - Math.atan2(b[1] - my, b[0] - mx));
      const xs = P2.map((p) => p[0]), ys = P2.map((p) => p[1]);
      for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
        let inside = true;
        for (let i = 0; i < P2.length; i++) {
          const a = P2[i], b = P2[(i + 1) % P2.length];
          if ((b[0] - a[0]) * (y + 0.5 - a[1]) - (b[1] - a[1]) * (x + 0.5 - a[0]) < 0) { inside = false; break; }
        }
        if (inside) api.px(x, y, shade(x, y), emit);
      }
    },
  };
  return api;
}
// 決定性的亂數（同一個位置每次都一樣，不閃）
const rnd = (a, b = 0) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
// 星形碎片（四角菱形，往上長）：左亮右暗兩面＋中間亮線
function shard(p, x, y, h, w, ramp, emit = true) {
  for (let j = 0; j < h; j++) {
    const k = j < h * 0.35 ? j / (h * 0.35) : 1 - (j - h * 0.35) / (h * 0.65) * 0.55;
    const half = Math.max(0, Math.round(w * k));
    for (let i = -half; i <= half; i++) p.px(x + i, y + j, ramp[i < 0 ? 3 : i === 0 ? 4 : i <= half / 2 ? 2 : 1], emit);
  }
}

// 店的位置（左上角 x）：門口對準居民站的地方
const SHOPS = [["town/guild", 58], ["town/workshop", 344], ["town/inn", 620]];
// 裝飾（props/town-deco 的格子：0 木桶 1 疊木箱 2 柵欄 3 路標 4 星星路燈 5 盆栽蘑菇 6 麻袋 7 長椅）的中心 x
const DECO = [[0, 592], [1, 612], [6, 796], [7, 882], [2, 962], [2, 1002]];
const BLOOMS = [[0, 20], [3, 334], [2, 548], [7, 788], [4, 862], [5, 912]];        // 花、蘑菇（props/flowers 的格子）
const TUFTS = [[1, 10], [4, 48], [0, 322], [6, 352], [2, 540], [5, 600], [7, 640], [3, 776], [1, 846], [6, 906], [0, 940]];   // 草叢
function build() {
  if (!ART["town/far"]) return;   // 沒有瀏覽器（預覽工具）時不畫
  blit(FAR, FAR_W, H, ART["town/far"], 0, 0);
  blit(MID, MID_W, H, ART["town/mid"], 0, 0);

  // ================= 主圖層：地面、三棟店、裝飾 =================
  const gt = ART["town/ground"];   // 草皮最上緣在第 9 列 → 對準 FLOOR
  for (let x = 0; x < TOWN_W; x++) for (let y = 0; y < gt.h; y++) {
    const c = gt.px[y * gt.w + (x % gt.w)], wy = FLOOR - 9 + y;
    if (c && wy < H) MAIN[wy * TOWN_W + x] = c;
  }
  for (let x = 0; x < TOWN_W; x++) for (let y = FLOOR - 9 + gt.h; y < H; y++) MAIN[y * TOWN_W + x] = gt.px[(gt.h - 1) * gt.w + (x % gt.w)];
  const p = pen(MAIN, TOWN_W);
  // 鎮的入口拱門（左）
  for (const x of [8, 64]) { p.rect(x, 128, x + 5, FLOOR - 1, WOOD[2]); p.rect(x, 128, x + 1, FLOOR - 1, WOOD[3]); p.rect(x + 5, 128, x + 5, FLOOR - 1, WOOD[1]); }
  for (let x = 4; x <= 74; x++) { const y = 124 - Math.round(Math.sin(((x - 4) / 70) * Math.PI) * 9); p.rect(x, y, x, y + 4, WOOD[x < 30 ? 3 : 2]); p.px(x, y + 5, WOOD[0]); }
  // 三棟店：底部對齊地面；亮的窗戶、水晶、爐火標成自己發光，並變成光源
  const glow = [];
  for (const [name, x0] of SHOPS) {
    const img = ART[name], y0 = FLOOR + 1 - baseRow(img);
    blit(MAIN, TOWN_W, H, img, x0, y0, { onPx: (i, c, x, y) => { if (glows(c)) { EMIT[i] = 1; glow.push([x, y, c]); } } });
  }
  for (const g of glowClusters(glow, 30)) LIGHTS.push([g.x, g.y, Math.min(56, 18 + Math.sqrt(g.n) * 2.2), g.n > 80 ? 1.4 : 0.9, g.col]);
  // 星星路燈（裝飾表第 4 格）：星星是光源
  const deco = (i) => cell(ART["props/town-deco"], i, 48, 72);
  const lamp = deco(4), lampBase = baseRow(lamp);
  for (const x of LAMPS) {
    const x0 = x - 24, y0 = FLOOR + 1 - lampBase;
    blit(MAIN, TOWN_W, H, lamp, x0, y0, { onPx: (i, c) => { if (glows(c)) EMIT[i] = 1; } });
    LIGHTS.push([x0 + 37, y0 + 25, 60, 2.2, "#ffcf6a"]);
  }
  for (const [k, cx] of DECO) { const d = deco(k); blit(MAIN, TOWN_W, H, d, cx - 24, FLOOR + 1 - baseRow(d)); }
  const sign = deco(3);
  blit(MAIN, TOWN_W, H, sign, SIGNPOST.x - 24, FLOOR + 1 - baseRow(sign));
  // 花、蘑菇、草叢（站在街上，在居民後面）
  for (const [k, cx] of BLOOMS) { const d = cell(ART["props/flowers"], k, 32, 32); blit(MAIN, TOWN_W, H, d, cx - 16, FLOOR + 1 - baseRow(d)); }
  for (const [k, cx] of TUFTS) { const d = cell(ART["props/grass"], k, 24, 24); blit(MAIN, TOWN_W, H, d, cx - 12, FLOOR + 1 - baseRow(d)); }

  // ================= 前景：比主角近的草叢與蘑菇（左右循環） =================
  blit(FG, FG_W, H, ART["town/fg"], 0, H - ART["town/fg"].h);
}
build();

// ---- 白天與晚上（使用者 2026-11-06「城鎮中加入白天與夜晚」）
//   用真實時間算：一整天 8 分鐘（白天 4 分、晚上 4 分），日出、日落各約 30 秒慢慢轉。換場景、重新整理都接得上。
//   白天：天空換成藍天（地平線偏暖）、星星和流星淡掉、整個鎮變亮變暖、窗戶和路燈的光變弱、螢火蟲不出來；
//   日出日落：地平線一片橘粉色。
const DAY_LEN = 480, TAU = Math.PI * 2;
let dayOverride = null;
/** 開發用：固定在某個時間（0～1，0＝日出、0.25＝中午、0.5＝日落、0.75＝半夜；null＝照真實時間） */
export const setDayPhase = (p) => (dayOverride = p);
export function dayInfo() {
  const p = dayOverride ?? (Date.now() / 1000 / DAY_LEN) % 1;
  const d = Math.max(0, Math.min(1, 0.5 + Math.sin(p * TAU) * 2.5));
  return { p, d, dusk: 1 - Math.abs(2 * d - 1) };
}
const DAY_SKY = [[74, 138, 216], [104, 164, 228], [146, 194, 238], [190, 220, 242], [232, 226, 206]];   // 天頂 → 地平線
const DUSK_SKY = [[58, 48, 120], [128, 72, 140], [214, 104, 120], [250, 150, 96], [255, 196, 120]];
const ramp = (st, f) => { const k = Math.max(0, Math.min(st.length - 1.001, f * (st.length - 1))), i = Math.floor(k), t = k - i; return st[i].map((v, j) => v + (st[i + 1][j] - v) * t); };

// ---- 天氣（使用者 2026-11-06「也加入天氣變化如雨天」）：晴、陰、雨。照真實時間每 3 分鐘可能換一次（換的時候 25 秒慢慢轉），
//   陰天：天空蓋一層灰雲、星星看不到、整個鎮暗一點；雨天：再暗一點偏藍，四層深度的雨絲（fx-town-rain.js）落地濺水花，沒有螢火蟲
const WX_SLOT = 180, WX_FADE = 25, WX_PICK = ["clear", "clear", "cloudy", "rain", "clear", "rain", "cloudy", "clear", "clear", "rain"];
const wxAt = (slot) => WX_PICK[Math.floor(rnd(slot, 97) * WX_PICK.length)];
let wxOverride = null;
/** 開發用：固定天氣 "clear" / "cloudy" / "rain"，null＝照真實時間 */
export const setWeather = (w) => (wxOverride = w);
export function weatherInfo() {
  if (wxOverride) return { kind: wxOverride, rain: wxOverride === "rain" ? 1 : 0, cloud: wxOverride === "clear" ? 0 : 1 };
  const now = Date.now() / 1000, slot = Math.floor(now / WX_SLOT), k = Math.min(1, (now - slot * WX_SLOT) / WX_FADE), a = wxAt(slot - 1), b = wxAt(slot);
  const v = (w, x) => (w === x ? 1 : 0), lerp = (x, y) => x + (y - x) * k;
  return { kind: b, rain: lerp(v(a, "rain"), v(b, "rain")), cloud: lerp(a === "clear" ? 0 : 1, b === "clear" ? 0 : 1) };
}
const RAIN = [0, 1, 2].map(() => createFx(townRain, { x: 0, y: FLOOR, density: 1 }));
let rainT = null;
/** 雨（在主角、居民之後，前景之前畫）。雨絲固定在世界上（每 332 格一塊接起來），走路時不會跟著畫面跑 */
export function drawTownWeather(frame, time) {
  const { rain } = weatherInfo(), dt = rainT === null ? 0 : Math.max(0, Math.min(0.1, time - rainT));
  rainT = time;
  if (rain < 0.03) return;
  const base = Math.floor((frame.ox | 0) / 332) * 332 + 166;
  RAIN.forEach((fx, k) => { fx.update(dt); fx.options.x = base + k * 332; fx.options.y = FLOOR + 1; fx.options.density = rain; fx.draw(frame); });
}

/** 鎮上的固定光源 */
export function townLights(time) {
  const dl = 1 - 0.75 * dayInfo().d * (1 - 0.5 * weatherInfo().cloud);   // 白天燈光變弱（陰天、雨天沒那麼弱）
  const list = LIGHTS.map(([x, y, r, lv, col]) => ({ x, y, r: r + (r > 50 ? Math.floor(time * 6) % 2 : 0), lv: lv * dl, col }));
  list.push({ x: 106, y: 128, r: 110, lv: 1.6 * dl, par: 0.12, col: "#ffd27a" });   // 坑底的大星星（遠景圖左邊那顆）
  return list;
}

const wrap = (x, w) => ((x % w) + w) % w;
let skyMask = new Uint8Array(0);   // 這一格是不是天空（星星只畫在天空上）
// 星空：固定位置的星星，各自閃
const STARS = Array.from({ length: 120 }, (_, i) => [Math.floor(rnd(i, 31) * 520), Math.floor(rnd(i, 32) * 96), rnd(i, 33)]);

/** 畫鎮的背景＋街道。lv：光的亮度（街道和店被照到時加上光的顏色）。 */
export function drawTown(frame, lv, time) {
  const W = frame.w, cx = frame.ox | 0, cy = frame.oy | 0, out = frame.color, LB = frame.light, [TR, TG, TB] = tintOf();
  const of = Math.floor(cx * 0.12), om = Math.floor(cx * 0.35), os = Math.floor(cx * 0.04), SKYP = NIGHT.px;
  NIGHT.update(skyT === null ? 0 : Math.max(0, Math.min(0.1, time - skyT)));
  const { d: DAY0, dusk: DUSK0 } = dayInfo(), { rain: RAINK, cloud: CLOUD } = weatherInfo();
  // 陰天、雨天：白天沒那麼亮、看不到夕陽；整個鎮再壓暗一點（雨天偏藍）
  const DAY = DAY0 * (1 - 0.45 * CLOUD), DUSK = DUSK0 * (1 - 0.8 * CLOUD), dim = 1 - 0.12 * CLOUD - 0.08 * RAINK;
  // 白天把場景調亮：每個顏色 ×(1＋0.75×白天)＋一點暖色；日落時再偏橘
  // 第 2 輪：原本 ×1.75 太亮（白的地方爆掉、紫色石頭變粉彩）→ 只亮 30% 左右，藍色少加一點（夜景偏紫，白天要往暖、往中性色拉）
  const mR = 1 + 0.32 * DAY + 0.2 * DUSK, mG = 1 + 0.3 * DAY + 0.02 * DUSK, mB = 1 + 0.1 * DAY - 0.12 * DUSK, aR = 12 * DAY + 8 * DUSK, aG = 11 * DAY, aB = 2 * DAY;
  const kR = mR * dim * (1 - 0.06 * RAINK), kG = mG * dim, kB = mB * dim * (1 + 0.04 * RAINK);
  const lift = DAY + DUSK + CLOUD < 0.01 ? (v) => v : (v) => (0xff000000 | (Math.min(255, ((v >>> 16) & 255) * kB + aB) << 16) | (Math.min(255, ((v >>> 8) & 255) * kG + aG) << 8) | Math.min(255, (v & 255) * kR + aR)) >>> 0;
  const skyRow = [];   // 每一列白天／日落的天空顏色
  // 雲：白天灰白、晚上深灰藍（上面暗一點），蓋在天空上
  const cloudCol = (f) => { const day = [150 - 30 * (1 - f), 160 - 30 * (1 - f), 176 - 26 * (1 - f)], night = [34, 36, 52]; return day.map((v, j) => night[j] + (v - night[j]) * DAY0); };
  for (let y = 0; y < H; y++) {
    const f = y / (H * 0.62), a = ramp(DAY_SKY, f), b = ramp(DUSK_SKY, f), w = DUSK / Math.max(0.01, DAY + DUSK), c = cloudCol(Math.min(1, f));
    const clear = a.map((v, j) => v + (b[j] - v) * w), sk = Math.min(1, DAY + DUSK);
    // 先算晴天的顏色（白天藍天 or 夜空保留），再往雲的顏色拉 CLOUD×0.85
    skyRow.push({ clear, sk, cloud: c });
  }
  const skyMix = 1;
  const daySky = (v, wy) => {
    const R = skyRow[Math.max(0, Math.min(H - 1, wy))];
    if (R.sk < 0.01 && CLOUD < 0.01) return v;
    let r = v & 255, g = (v >>> 8) & 255, b = (v >>> 16) & 255;
    r += (R.clear[0] - r) * R.sk; g += (R.clear[1] - g) * R.sk; b += (R.clear[2] - b) * R.sk;
    const ck = CLOUD * 0.85;
    r += (R.cloud[0] - r) * ck; g += (R.cloud[1] - g) * ck; b += (R.cloud[2] - b) * ck;
    return (0xff000000 | (Math.round(b) << 16) | (Math.round(g) << 8) | Math.round(r)) >>> 0;
  };
  skyT = time;
  if (skyMask.length !== W * frame.h) skyMask = new Uint8Array(W * frame.h);
  skyMask.fill(0);
  for (let y = 0; y < H; y++) {
    const wy = y + cy, row = y * W;
    const sky = SKY[Math.max(0, Math.min(SKY.length - 1, Math.floor(wy / 13)))];
    if (wy < 0 || wy >= H) { out.fill(wy < 0 ? daySky(SKYP[0], 0) : lift(sky), row, row + W); continue; }
    const sy = Math.min(STARSKY_H - 1, wy);
    for (let x = 0; x < W; x++) {
      const i = row + x, gx = x + cx;
      let v = gx >= 0 && gx < TOWN_W ? MAIN[wy * TOWN_W + gx] : 0;
      if (v) {
        out[i] = lift(v);
        if (lv[i] > 0.02 && !EMIT[wy * TOWN_W + gx]) LB[i] = 0xff000000 | (Math.min(255, TB[i] * 0.9) << 16) | (Math.min(255, TG[i] * 0.9) << 8) | Math.min(255, TR[i] * 0.9);
        continue;
      }
      const bg = MID[wy * MID_W + wrap(x + om, MID_W)] || FAR[wy * FAR_W + wrap(x + of, FAR_W)];
      if (bg) out[i] = lift(bg);
      else { out[i] = daySky(SKYP[sy * STARSKY_W + wrap(x + os, STARSKY_W)], wy); skyMask[i] = 1; }
    }
  }
  const add = (x, y, r, g, b, k) => { if (x < 0 || y < 0 || x >= W || y >= frame.h) return; const i = y * W + x, d = LB[i]; LB[i] = 0xff000000 | (Math.min(255, ((d >>> 16) & 255) + b * k) << 16) | (Math.min(255, ((d >>> 8) & 255) + g * k) << 8) | Math.min(255, (d & 255) + r * k); };
  // 坑底大星星的光柱（往上，柔和）
  const bx = 106 - of;
  for (let y = 0; y < 66 - cy; y++) for (let x = -16; x <= 16; x++) {
    const k = (1 - Math.abs(x) / 17) ** 2 * (y / 66) * (0.6 + 0.15 * Math.sin(time * 1.3)) * (1 - 0.7 * DAY);
    add(bx + x, y, 255, 210, 120, k * 0.35);
  }
  // 螢火蟲
  for (let n = 0; n < 26; n++) {
    const fx = Math.round(rnd(n, 41) * TOWN_W + Math.sin(time * 0.6 + n) * 14) - cx, fy = Math.round(118 + rnd(n, 42) * 58 + Math.sin(time * 0.9 + n * 2) * 6) - cy;
    const on = (0.5 + 0.5 * Math.sin(time * 2.2 + n * 1.7)) * (1 - DAY0) * (1 - RAINK);   // 螢火蟲只在晚上、沒下雨的時候
    if (on < 0.15 || fx < 0 || fy < 0 || fx >= W || fy >= frame.h) continue;
    out[fy * W + fx] = 0xffa0f4d4;
    for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) { const f = 1 - Math.hypot(x, y) / 4.5; if (f > 0) add(fx + x, fy + y, 200, 255, 140, f * f * on * 0.5); }
  }
  // 工坊煙囪的煙
  for (let n = 0; n < 6; n++) {
    const t = (time * 0.3 + n / 6) % 1, sx = 501 + Math.round(Math.sin(t * 6 + n) * 3 + t * 12) - cx, sy = FLOOR - 128 - Math.round(t * 50) - cy, R = 3 + Math.round(t * 6);
    for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) { const f = 1 - Math.hypot(x, y) / R; if (f > 0) add(sx + x, sy + y, 120, 110, 140, f * (1 - t) * 0.45); }
  }
}
/** 前景（在主角和居民之後畫） */
export function drawTownFg(frame) {
  const W = frame.w, cx = frame.ox | 0, cy = frame.oy | 0, out = frame.color, ofg = Math.floor(cx * 1.3);
  const LIFT = 7;   // 使用者 2026-11-05：前景稍微往上（鏡頭拉近後下緣被裁掉，草叢剪影看不太到）
  for (let y = 0; y < frame.h; y++) {
    const wy = y + cy + LIFT;
    if (wy < 0 || wy >= H) continue;
    for (let x = 0; x < W; x++) { const v = FG[wy * FG_W + wrap(x + ofg, FG_W)]; if (v) out[y * W + x] = v; }
  }
}

/** 居民（待機動畫，烘焙好的，見 npcs.js） */
export function drawTownNpcs(frame, time) {
  for (const n of NPCS) paintNpc(frame, n.id, time, n.x, FLOOR - 1, n.flip);
}
/** 主角附近的居民或路標（可以對話的） */
export function nearby(x) {
  for (const n of NPCS) if (Math.abs(n.x - x) < 26) return n;
  if (Math.abs(SIGNPOST.x - x) < 22) return { id: "sign", name: "路標", x: SIGNPOST.x, place: "sign" };
  return null;
}
