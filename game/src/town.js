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
import { hex } from "../../pixelfx/src/core/index.js";
import { tintOf } from "./light.js";
import { FLOOR, H } from "./level.js";
import { paintNpc } from "./npcs.js";

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
const FAR_W = 640, MID_W = 840, FG_W = 1400;
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

function build() {
  // ================= 遠景：坑底的大星星、坑壁上的水晶 =================
  const f = pen(FAR, FAR_W);
  for (let x = 0; x < FAR_W; x++) {
    const rim = 98 + Math.round(Math.sin(x / 60) * 6 + Math.sin(x / 17) * 2);
    f.rect(x, rim, x, H - 1, C("#2c2048"));
    f.px(x, rim, C("#46306a"));
    // 坑底往中間越亮（大星星照的）
    for (let y = rim + 1; y < H; y++) {
      const d = Math.abs(x - 300) / 300;
      if (d < 0.45 && y > 112 && y < 132) f.px(x, y, C(d < 0.2 ? "#5a3e6a" : "#463058"));
    }
  }
  // 半埋在坑底的大星星（五角星，往右倒）
  const star = (cx, cy, R, rot) => {
    for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {
      const a = Math.atan2(y, x) - rot, d = Math.hypot(x, y), r = R * (0.5 + 0.5 * Math.pow(Math.abs(Math.cos(2.5 * a)), 2.2));
      if (d > r || cy + y > 124) continue;
      const lit = x - y * 0.6 < -R * 0.15 ? 4 : x - y * 0.6 < R * 0.2 ? 3 : 2;
      f.px(cx + x, cy + y, GOLD[d < R * 0.22 ? 4 : lit]);
    }
  };
  star(300, 104, 28, -0.35);
  f.rect(240, 124, 360, 126, C("#2c2048"));
  // 坑壁上插的水晶（青、金）
  for (const [x, y, h, w, t] of [[90, 86, 22, 4, 0], [104, 94, 12, 3, 1], [470, 82, 26, 4, 1], [492, 92, 14, 3, 0], [560, 88, 18, 3, 0], [40, 96, 12, 2, 1]]) shard(f, x, y, h, w, t ? TEALC : GOLD, false);

  // ================= 中景：坑壁、鑿出來的住家、蘑菇屋、一串串小燈 =================
  const m = pen(MID, MID_W);
  const wallTop = (x) => 122 + Math.round(Math.sin(x / 70) * 14 + Math.sin(x / 23 + 2) * 5 + (rnd(Math.floor(x / 9)) - 0.5) * 3);
  for (let x = 0; x < MID_W; x++) {
    const t = wallTop(x);
    for (let y = t; y < H; y++) m.px(x, y, C(y === t ? "#3a2c50" : (x + y * 3) % 23 === 0 ? "#2a2040" : "#22192f"));
  }
  // 台階（一層一層的平台線）
  for (const [x0, x1, y] of [[20, 220, 146], [260, 470, 140], [500, 760, 150], [120, 340, 164], [560, 820, 166]]) {
    m.rect(x0, y, x1, y, C("#3a2c50"));
    m.rect(x0, y + 1, x1, y + 1, C("#2a2040"));
  }
  // 坑壁上鑿的圓窗（亮著燈）＋門
  for (const [x, y] of [[60, 140], [96, 136], [300, 132], [330, 128], [420, 134], [600, 142], [650, 138], [720, 144], [180, 158], [640, 160], [780, 162]]) {
    m.ellipse(x, y, 3, 3, () => C("#1a1228"));
    m.ellipse(x, y, 2, 2, (u, v) => C(v < -0.3 ? "#fff0b0" : "#ffc864"));
  }
  // 台階上的蘑菇屋剪影（小）
  for (const [x, y, s] of [[150, 146, 1], [520, 150, 1.3], [380, 140, 0.9], [740, 150, 1.1]]) {
    m.rect(x - 4 * s, y - 10 * s, x + 4 * s, y - 1, C("#2e2440"));
    m.ellipse(x, y - 10 * s, 11 * s, 6 * s, (u, v) => C(v < -0.4 ? "#6a2a3a" : "#4a1e30"), false, y - 10 * s + 1);
    m.ellipse(x - 1, y - 5 * s, 1.5, 1.5, () => C("#ffc864"));
  }
  // 一串串小燈：兩點之間的下垂弧線，每 6 格一顆燈
  for (const [x0, y0, x1, y1] of [[60, 128, 150, 132], [300, 122, 420, 126], [600, 130, 720, 136], [180, 150, 260, 154]]) {
    for (let k = 0; k <= 1; k += 0.01) {
      const x = Math.round(x0 + (x1 - x0) * k), y = Math.round(y0 + (y1 - y0) * k + Math.sin(k * Math.PI) * 6);
      m.px(x, y, C("#3a3048"));
      if (Math.round(k * 100) % 6 === 0) m.px(x, y + 1, C(Math.round(k * 100) % 12 ? "#ffd27a" : "#9af0e0"));
    }
  }

  // ================= 主圖層：街道與三棟店 =================
  const p = pen(MAIN, TOWN_W);
  // 地面：泥土小路＋石頭＋草邊
  for (let x = 0; x < TOWN_W; x++) {
    for (let y = FLOOR; y < H; y++) {
      const depth = y - FLOOR, r = rnd(x >> 2, y >> 2);
      p.px(x, y, DIRT[depth < 2 ? 3 : depth < 6 ? 2 : r < 0.2 ? 0 : 1]);
    }
    p.px(x, FLOOR, GRASS[3]); p.px(x, FLOOR + 1, GRASS[2]);
    if (rnd(x, 7) < 0.35) p.px(x, FLOOR - 1, GRASS[rnd(x, 9) < 0.5 ? 3 : 4]);
    if (rnd(x, 8) < 0.12) { p.px(x, FLOOR - 1, GRASS[4]); p.px(x, FLOOR - 2, GRASS[3]); }
  }
  for (let k = 0; k < 70; k++) {   // 路上的石頭
    const x = Math.floor(rnd(k, 3) * TOWN_W), y = FLOOR + 5 + Math.floor(rnd(k, 4) * 24), w = 3 + Math.floor(rnd(k, 5) * 4);
    p.rect(x, y, x + w, y + 1, DIRT[3]); p.rect(x, y, x + w, y, DIRT[4]); p.rect(x + 1, y + 2, x + w, y + 2, DIRT[0]);
  }
  const win = (x, y, w, h, round = false) => {
    if (round) {
      p.ellipse(x, y, w + 1, h + 1, () => FRAME);
      p.ellipse(x, y, w, h, (u, v) => (Math.abs(u) < 0.15 || Math.abs(v) < 0.15 ? MULLION : v < -0.45 ? WARM_HI : WARM), true);
      LIGHTS.push([x, y, 30, 1.3, "#ffb050"]);
      return;
    }
    p.rect(x - 1, y - 1, x + w, y + h, FRAME);
    p.rect(x, y, x + w - 1, y + h - 1, WARM, true);
    p.rect(x, y, x + w - 1, y, WARM_HI, true);
    p.rect(x + (w >> 1), y, x + (w >> 1), y + h - 1, MULLION, true);
    p.rect(x, y + (h >> 1), x + w - 1, y + (h >> 1), MULLION, true);
    p.rect(x - 2, y + h + 1, x + w + 1, y + h + 1, WOOD[3]); p.rect(x - 2, y + h + 2, x + w + 1, y + h + 2, WOOD[1]);   // 窗台
    LIGHTS.push([x + w / 2, y + h / 2, 30, 1.3, "#ffb050"]);
  };
  const door = (x, w, top, round = true) => {
    for (let y = top; y < FLOOR; y++) for (let i = -1; i <= w; i++) {
      const dy = y - top, arch = round ? Math.round(w / 2 - Math.sqrt(Math.max(0, (w / 2) ** 2 - (w / 2 - Math.min(w / 2, dy)) ** 2))) : 0;
      if (i < arch - 1 || i > w - arch) continue;
      const edge = i === -1 || i === w || i === arch - 1 || i === w - arch;
      p.px(x + i, y, edge ? FRAME : i < 2 ? WOOD[3] : (i % 5 === 0 ? WOOD[1] : WOOD[2]));
    }
    p.rect(x + w - 4, top + 14, x + w - 3, top + 15, GOLD[2]);
  };

  // ---------- 公會：繞著第一塊碎片蓋的石頭大廳 ----------
  const GX0 = 70, GX1 = 300, GTOP = 104;
  // 石牆：一塊塊石頭（每塊左上亮、右下暗）
  for (let y = GTOP; y < FLOOR; y++) for (let x = GX0; x <= GX1; x++) {
    const row = Math.floor((y - GTOP) / 7), off = (row % 2) * 6, bx = (x - GX0 + off) % 12, by = (y - GTOP) % 7;
    p.px(x, y, bx === 0 || by === 0 ? BLUE[0] : by === 1 || bx === 1 ? BLUE[3] : bx === 11 || by === 6 ? BLUE[1] : rnd(Math.floor((x - GX0 + off) / 12), row) < 0.2 ? BLUE[1] : BLUE[2]);
  }
  for (const x of [GX0, GX0 + 58, GX1 - 58, GX1]) p.rect(x - 3, GTOP - 2, x + 3, FLOOR - 1, WOOD[2]), p.rect(x - 3, GTOP - 2, x - 2, FLOOR - 1, WOOD[3]), p.rect(x + 3, GTOP - 2, x + 3, FLOOR - 1, WOOD[1]);   // 木柱
  p.rect(GX0 - 4, GTOP - 4, GX1 + 4, GTOP - 1, WOOD[2]); p.rect(GX0 - 4, GTOP - 4, GX1 + 4, GTOP - 4, WOOD[3]);   // 橫樑
  // 屋頂：瓦片一排一排（每排下緣暗）
  for (let j = 0; j < 30; j++) {
    const y = GTOP - 5 - j, x0 = GX0 - 12 + Math.round(j * 1.2), x1 = GX1 + 12 - Math.round(j * 1.2);
    for (let x = x0; x <= x1; x++) p.px(x, y, j % 5 === 0 ? SLATE[0] : (x + (Math.floor(j / 5) % 2) * 4) % 8 === 0 ? SLATE[1] : j % 5 === 4 ? SLATE[3] : SLATE[2]);
    p.px(x0, y, SLATE[4]);
  }
  // 屋頂上的第一塊碎片（從屋頂穿出去、發光）
  shard(p, 185, 26, 54, 9, GOLD);
  LIGHTS.push([185, 52, 70, 2, "#ffd27a"]);
  win(88, 122, 16, 18); win(126, 122, 16, 18); win(232, 122, 16, 18); win(270, 122, 16, 18);
  door(174, 24, FLOOR - 34);
  // 門上的招牌：紅底星星盾
  p.rect(170, 132, 202, 142, FRAME); p.rect(171, 133, 201, 141, CAP[2]); p.rect(171, 133, 201, 133, CAP[4]);
  for (const [dx, dy] of [[16, 1], [15, 2], [16, 2], [17, 2], [12, 3], [13, 3], [14, 3], [15, 3], [16, 3], [17, 3], [18, 3], [19, 3], [20, 3], [14, 4], [15, 4], [16, 4], [17, 4], [18, 4], [14, 5], [15, 5], [17, 5], [18, 5], [13, 6], [14, 6], [18, 6], [19, 6]]) p.px(171 + dx, 133 + dy, GOLD[3], true);
  // 任務告示板（門右邊）
  p.rect(214, 150, 246, 174, FRAME); p.rect(215, 151, 245, 173, WOOD[2]); p.rect(215, 151, 245, 151, WOOD[3]);
  for (const [x, y, w, h] of [[218, 154, 8, 9], [229, 153, 7, 7], [238, 155, 6, 10], [222, 165, 9, 6], [234, 163, 8, 8]]) { p.rect(x, y, x + w, y + h, C("#e8dcc0")); p.rect(x, y, x + w, y, C("#fff6e0")); p.px(x + (w >> 1), y, CAP[3]); }
  p.rect(218, 174, 219, FLOOR - 1, WOOD[1]); p.rect(241, 174, 242, FLOOR - 1, WOOD[1]);

  // ---------- 工坊：魔像鑿的巨石圓頂屋 ----------
  const WX = 440, WY = FLOOR + 4;
  p.ellipse(WX, WY, 82, 74, (u, v) => {
    const d = u * 0.7 + v * 0.7, t = d < -0.75 ? 4 : d < -0.25 ? 3 : d < 0.45 ? 2 : 1;
    return STONE[t];
  }, false, FLOOR);
  // 大石塊的接縫（沿著圓頂的弧線）＋兩條裂縫
  for (const k of [0.55, 0.8]) for (let x = WX - 80; x <= WX + 80; x++) { const y = Math.round(WY - 74 * k * Math.sqrt(Math.max(0, 1 - ((x - WX) / (82 * k)) ** 2))); if (y < FLOOR - 2 && Math.abs(x - WX) < 82 * k - 2) { p.px(x, y, STONE[0]); p.px(x, y + 1, STONE[3]); } }
  for (const x of [380, 412, 470, 500]) for (let y = 0; y < 14; y++) { const yy = Math.round(WY - 74 * 0.8 * Math.sqrt(Math.max(0, 1 - ((x - WX) / (82 * 0.8)) ** 2))) + 2 + y; if (yy < Math.round(WY - 74 * 0.55 * Math.sqrt(Math.max(0, 1 - ((x - WX) / (82 * 0.55)) ** 2)))) p.px(x, yy, STONE[0]); }
  for (const [x0, y0, pts] of [[372, 150, [[1, 1], [2, 2], [2, 3], [3, 4], [4, 4], [5, 5]]], [500, 128, [[1, 1], [1, 2], [2, 3], [3, 3], [3, 4]]]]) for (const [dx, dy] of pts) p.px(x0 + dx, y0 + dy, STONE[0]);
  for (let x = WX - 70; x < WX + 70; x++) { const y = Math.round(WY - 74 * Math.sqrt(Math.max(0, 1 - ((x - WX) / 82) ** 2))); if (rnd(x, 11) < 0.7) { p.px(x, y, GRASS[3]); p.px(x, y + 1, GRASS[2]); if (rnd(x, 12) < 0.3) p.px(x, y - 1, GRASS[4]); } }   // 圓頂上的苔
  // 疊石煙囪
  for (const [x, y, w, h] of [[487, 126, 18, 10], [489, 117, 14, 9], [488, 109, 16, 8], [490, 102, 12, 7]]) p.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, (u, v) => STONE[u + v < -0.5 ? 3 : u + v < 0.4 ? 2 : 1]);
  p.rect(493, 99, 499, 102, STONE[0]);
  // 門口的爐火（拱形洞口）
  for (let y = FLOOR - 36; y < FLOOR; y++) for (let x = 426; x <= 470; x++) {
    const dx = (x - 448) / 22, dy = (FLOOR - 36 + 16 - y) / 16;
    if (y < FLOOR - 20 && dx * dx + dy * dy > 1) continue;
    const edge = Math.abs(x - 448) >= 21 || (y < FLOOR - 20 && dx * dx + dy * dy > 0.86);
    p.px(x, y, edge ? STONE[0] : C("#2a120e"));
  }
  p.ellipse(448, FLOOR - 6, 16, 9, (u, v) => C(v < -0.4 ? "#ffd27a" : Math.abs(u) < 0.4 ? "#ffb050" : "#e8601c"), true, FLOOR);
  p.rect(436, FLOOR - 4, 460, FLOOR - 1, C("#5a1a10"));
  LIGHTS.push([448, FLOOR - 8, 54, 2.6, "#ff7a30"]);
  win(394, 136, 7, 7, true);
  // 鐵砧＋碎片礦石箱
  p.rect(476, FLOOR - 12, 500, FLOOR - 8, C("#6e7a90")); p.rect(476, FLOOR - 12, 500, FLOOR - 12, C("#9aa6ba")); p.rect(470, FLOOR - 11, 476, FLOOR - 10, C("#6e7a90"));
  p.rect(482, FLOOR - 7, 494, FLOOR - 5, C("#4a5468")); p.rect(479, FLOOR - 4, 497, FLOOR - 1, C("#2e3440"));
  p.rect(506, FLOOR - 14, 526, FLOOR - 1, FRAME); p.rect(507, FLOOR - 13, 525, FLOOR - 1, WOOD[2]); p.rect(507, FLOOR - 13, 525, FLOOR - 13, WOOD[3]); p.rect(507, FLOOR - 7, 525, FLOOR - 7, WOOD[1]);
  shard(p, 512, FLOOR - 22, 9, 2, TEALC); shard(p, 519, FLOOR - 20, 7, 2, GOLD);
  LIGHTS.push([516, FLOOR - 18, 22, 1.2, "#9af0e0"]);

  // ---------- 旅館：巨大的蘑菇 ----------
  const MX = 700;
  // 柄＝牆（下寬上窄，左亮右暗，有木紋）
  for (let y = 108; y < FLOOR; y++) {
    const half = 60 + Math.round((y - 108) * 0.12);
    for (let x = MX - half; x <= MX + half; x++) { const u = (x - MX) / half; p.px(x, y, STEM[u < -0.8 ? 4 : u < -0.2 ? 3 : u < 0.5 ? 2 : u < 0.85 ? 1 : 0]); }
    if (y === 150) for (let x = MX - half + 2; x <= MX + half - 2; x++) p.px(x, y, STEM[1]);
  }
  // 蓋子＝屋頂（扁半球，左上亮、右下暗，白色斑點，下緣一圈菌褶）
  p.ellipse(MX, 112, 112, 56, (u, v) => { const t = u + v * 1.2; return CAP[t < -1 ? 4 : t < -0.35 ? 3 : t < 0.4 ? 2 : 1]; }, false, 113);
  for (let x = MX - 110; x <= MX + 110; x++) { p.px(x, 112, CAP[0]); if (Math.abs(x - MX) < 100) p.px(x, 113, C("#8a5a5a")); if (Math.abs(x - MX) < 92 && x % 3 === 0) p.px(x, 114, C("#6a4040")); }
  for (const [x, y, r] of [[640, 82, 7], [690, 66, 6], [744, 76, 8], [780, 98, 5], [612, 102, 4], [720, 96, 4]]) p.ellipse(x, y, r, r * 0.7, (u, v) => C(u + v < -0.6 ? "#fffaf0" : "#f0e4c4"));
  // 蓋子上長的小蘑菇
  for (const [x, y] of [[668, 60], [734, 63]]) { p.rect(x - 1, y, x + 1, y + 6, STEM[3]); p.ellipse(x, y, 6, 4, (u, v) => CAP[v < -0.3 ? 4 : 3], false, y + 1); }
  // 圓窗、陽台、門、杯子招牌
  win(646, 132, 6, 6, true); win(756, 132, 6, 6, true); win(632, 158, 5, 5, true); win(772, 158, 5, 5, true);
  p.rect(676, 122, 726, 123, WOOD[3]); p.rect(676, 124, 726, 125, WOOD[1]);
  for (let x = 678; x <= 724; x += 5) p.rect(x, 116, x, 121, WOOD[2]);
  p.rect(676, 115, 726, 115, WOOD[3]);
  door(688, 22, FLOOR - 32);
  p.rect(724, 140, 742, 156, FRAME); p.rect(725, 141, 741, 155, WOOD[3]);
  p.rect(729, 144, 736, 152, C("#ffffff")); p.rect(737, 146, 738, 150, C("#ffffff")); p.rect(729, 144, 736, 144, C("#e8e8f0"));

  // ---------- 碎片路燈：扭曲的木柱＋頂上的碎片 ----------
  LAMPS.forEach((x, li) => {
    for (let y = 138; y < FLOOR; y++) { const s = Math.round(Math.sin(y / 7) * 1); p.px(x + s, y, WOOD[2]); p.px(x + s + 1, y, WOOD[1]); }
    p.rect(x - 4, 136, x + 5, 137, WOOD[3]);
    shard(p, x + 1, 116, 20, 4, li % 2 ? TEALC : GOLD);
    LIGHTS.push([x + 1, 126, 60, 2.2, li % 2 ? "#9af0e0" : "#ffcf6a"]);
  });

  // ---------- 鎮的兩頭：入口拱門（左）、往墜星之谷的路標和柵欄（右） ----------
  for (const x of [8, 64]) { p.rect(x, 128, x + 5, FLOOR - 1, WOOD[2]); p.rect(x, 128, x + 1, FLOOR - 1, WOOD[3]); p.rect(x + 5, 128, x + 5, FLOOR - 1, WOOD[1]); }
  for (let x = 4; x <= 74; x++) { const y = 124 - Math.round(Math.sin(((x - 4) / 70) * Math.PI) * 9); p.rect(x, y, x, y + 4, WOOD[x < 30 ? 3 : 2]); p.px(x, y + 5, WOOD[0]); }
  p.rect(SIGNPOST.x, 148, SIGNPOST.x + 2, FLOOR - 1, WOOD[2]);
  p.poly([[SIGNPOST.x - 12, 148], [SIGNPOST.x + 18, 148], [SIGNPOST.x + 24, 153], [SIGNPOST.x + 18, 158], [SIGNPOST.x - 12, 158]], (x, y) => (y === 148 ? WOOD[4] : y >= 157 ? WOOD[1] : WOOD[3]));
  for (let i = 0; i < 10; i++) p.px(SIGNPOST.x - 6 + i * 2, 153, WOOD[0]);
  for (let x = 944; x < TOWN_W; x += 9) { p.rect(x, 162, x + 2, FLOOR - 1, WOOD[2]); p.px(x + 1, 161, WOOD[3]); }
  p.rect(944, 167, TOWN_W - 1, 168, WOOD[3]); p.rect(944, 175, TOWN_W - 1, 176, WOOD[2]);

  // ================= 前景：深色草叢和小蘑菇（比主角近） =================
  const g = pen(FG, FG_W);
  for (let k = 0; k < 34; k++) {
    const x = Math.floor(rnd(k, 21) * FG_W), w = 10 + Math.floor(rnd(k, 22) * 22), h = 6 + Math.floor(rnd(k, 23) * 10);
    for (let i = -w; i <= w; i++) {
      const hh = Math.round(h * (1 - (i / w) ** 2) + Math.sin(i * 1.7 + k) * 2);
      for (let y = H - hh; y < H; y++) g.px(x + i, y, C(y === H - hh ? "#1a1428" : "#0e0a18"));
    }
    if (rnd(k, 24) < 0.4) { const mx = x + Math.floor((rnd(k, 25) - 0.5) * w); g.rect(mx, H - h - 7, mx + 1, H - h, C("#0e0a18")); g.ellipse(mx, H - h - 7, 4, 3, (u, v) => C(v < -0.3 ? "#3a1a28" : "#24101c"), false, H - h - 6); }
  }
}
build();

/** 鎮上的固定光源 */
export function townLights(time) {
  const list = LIGHTS.map(([x, y, r, lv, col]) => ({ x, y, r: r + (r > 50 ? Math.floor(time * 6) % 2 : 0), lv, col }));
  list.push({ x: 300, y: 104, r: 110, lv: 1.6, par: 0.12, col: "#ffd27a" });   // 坑底的大星星
  return list;
}

const wrap = (x, w) => ((x % w) + w) % w;
// 星空：固定位置的星星，各自閃
const STARS = Array.from({ length: 120 }, (_, i) => [Math.floor(rnd(i, 31) * 520), Math.floor(rnd(i, 32) * 96), rnd(i, 33)]);

/** 畫鎮的背景＋街道。lv：光的亮度（街道和店被照到時加上光的顏色）。 */
export function drawTown(frame, lv, time) {
  const W = frame.w, cx = frame.ox | 0, cy = frame.oy | 0, out = frame.color, LB = frame.light, [TR, TG, TB] = tintOf();
  const of = Math.floor(cx * 0.12), om = Math.floor(cx * 0.35);
  for (let y = 0; y < H; y++) {
    const wy = y + cy, row = y * W;
    const sky = SKY[Math.max(0, Math.min(SKY.length - 1, Math.floor(wy / 13)))];
    if (wy < 0 || wy >= H) { out.fill(sky, row, row + W); continue; }
    for (let x = 0; x < W; x++) {
      const i = row + x, gx = x + cx;
      let v = gx >= 0 && gx < TOWN_W ? MAIN[wy * TOWN_W + gx] : 0;
      if (v) {
        out[i] = v;
        if (lv[i] > 0.02 && !EMIT[wy * TOWN_W + gx]) LB[i] = 0xff000000 | (Math.min(255, TB[i] * 0.9) << 16) | (Math.min(255, TG[i] * 0.9) << 8) | Math.min(255, TR[i] * 0.9);
        continue;
      }
      out[i] = MID[wy * MID_W + wrap(x + om, MID_W)] || FAR[wy * FAR_W + wrap(x + of, FAR_W)] || sky;
    }
  }
  const add = (x, y, r, g, b, k) => { if (x < 0 || y < 0 || x >= W || y >= frame.h) return; const i = y * W + x, d = LB[i]; LB[i] = 0xff000000 | (Math.min(255, ((d >>> 16) & 255) + b * k) << 16) | (Math.min(255, ((d >>> 8) & 255) + g * k) << 8) | Math.min(255, (d & 255) + r * k); };
  // 星星：只畫在天空上，一閃一閃
  const os = Math.floor(cx * 0.04);
  for (const [sx, sy, ph] of STARS) {
    const x = wrap(sx - os, 520), y = sy - cy;
    if (x >= W || y < 0) continue;
    const i = y * W + x;
    if (out[i] !== SKY[Math.min(SKY.length - 1, Math.floor(sy / 13))]) continue;
    const tw = 0.5 + 0.5 * Math.sin(time * (1.5 + ph * 2) + ph * 20);
    out[i] = tw > 0.75 ? 0xffffffff : tw > 0.35 ? 0xffd8c8e0 : 0xff8a7aa0;
    if (ph > 0.85 && tw > 0.6) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) add(x + dx, y + dy, 160, 160, 200, 0.5 * tw);
  }
  // 坑底大星星的光柱（往上，柔和）
  const bx = 300 - of;
  for (let y = 0; y < 98 - cy; y++) for (let x = -16; x <= 16; x++) {
    const k = (1 - Math.abs(x) / 17) ** 2 * (y / 98) * (0.6 + 0.15 * Math.sin(time * 1.3));
    add(bx + x, y, 255, 210, 120, k * 0.35);
  }
  // 螢火蟲
  for (let n = 0; n < 26; n++) {
    const fx = Math.round(rnd(n, 41) * TOWN_W + Math.sin(time * 0.6 + n) * 14) - cx, fy = Math.round(118 + rnd(n, 42) * 58 + Math.sin(time * 0.9 + n * 2) * 6) - cy;
    const on = 0.5 + 0.5 * Math.sin(time * 2.2 + n * 1.7);
    if (on < 0.15 || fx < 0 || fy < 0 || fx >= W || fy >= frame.h) continue;
    out[fy * W + fx] = 0xffa0f4d4;
    for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) { const f = 1 - Math.hypot(x, y) / 4.5; if (f > 0) add(fx + x, fy + y, 200, 255, 140, f * f * on * 0.5); }
  }
  // 工坊煙囪的煙
  for (let n = 0; n < 6; n++) {
    const t = (time * 0.3 + n / 6) % 1, sx = 496 + Math.round(Math.sin(t * 6 + n) * 3 + t * 12) - cx, sy = 96 - Math.round(t * 50) - cy, R = 3 + Math.round(t * 6);
    for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) { const f = 1 - Math.hypot(x, y) / R; if (f > 0) add(sx + x, sy + y, 120, 110, 140, f * (1 - t) * 0.45); }
  }
}
/** 前景（在主角和居民之後畫） */
export function drawTownFg(frame) {
  const W = frame.w, cx = frame.ox | 0, cy = frame.oy | 0, out = frame.color, ofg = Math.floor(cx * 1.3);
  for (let y = 0; y < frame.h; y++) {
    const wy = y + cy;
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
