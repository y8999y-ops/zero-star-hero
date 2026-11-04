// 第一章的關卡場景：深淵·垃圾山（層次＋光影版）。地形照 stages.js 的這一關（寬、平台、火把、主題）烘焙：
//   abyss＝1-1 墜落之底、junk＝1-2 垃圾山（垃圾更多、平台是木板鐵架、偏鏽色）、cave＝1-3 蝙蝠洞窟（更暗、水晶更多）
// 參考絲之歌、Ori 的「技法」（不是畫面）＋ SLYNYRD 的像素視差教學，見 docs/素材參考.md：
//   6 層：天空霧光（逆光，中下段最亮）→ 遠景 → 中遠景（巨大垃圾剪影）→ 中景（鎖鏈、水晶）→ 遊玩層 → 前景剪影
//   越遠越接近霧色、越近越暗；遊玩層對比最高；前景幾乎全黑，框住畫面。
// 每個環境像素存「色票編號＋明暗階」，畫的時候依光源（light.js）把明暗階往上加，所以場景會被火把、
// 水晶、火球、爆炸照亮，而且顏色永遠是色票裡的顏色（規則v2：不漸層、不柔邊）。
import { hex, rand } from "../../pixelfx/src/core/index.js";
import { tintOf } from "./light.js";
import { LAYOUT, STAGE_ID } from "./stages.js";

export const H = 216;
export const LEVEL_W = LAYOUT.w;
export const THEME = LAYOUT.theme;
export { STAGE_ID };
const S = { abyss: 0, junk: 100, cave: 200, lair: 300 }[THEME] ?? 0;
const JUNKY = THEME === "junk" || THEME === "lair";   // 巢穴＝垃圾山的最深處   // 亂數種子錯開，每關長得不一樣
export const FLOOR = 184;
export const WALL = 16;
/** 單向平台：從下面可以跳上來，往下滑可以穿過去。 */
export const PLATFORMS = LAYOUT.platforms;
/** 火把位置（插在地上）。 */
export const TORCHES = LAYOUT.torches;

// ---- 色票：每條 8 階，0 最暗 → 7 最亮
const C = (s) => hex(s) >>> 0;
const mixHex = (a, b, t) => {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const A = p(a), B = p(b);
  return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("");
};
const BASE = {
  rock: ["#07060d", "#100e1c", "#1a172c", "#26223e", "#353052", "#474268", "#5d5982", "#7a789e"],
  moss: ["#07120e", "#0e2219", "#163626", "#1f4d35", "#2c6a46", "#3f8c58", "#5cb06c", "#86d488"],
  rust: ["#0e0806", "#1c100a", "#2e1a10", "#432616", "#5c3420", "#7a462c", "#9c5c3a", "#c27a4e"],
  metal: ["#08090d", "#11141b", "#1c212b", "#2a313e", "#3b4455", "#505b6e", "#6a768a", "#8e9aac"],
  wood: ["#0d0906", "#1a120b", "#2b1e12", "#3e2b1a", "#543a23", "#6e4d2e", "#8c643c", "#ae7e4c"],
  bone: ["#0f0e0b", "#1e1b15", "#302c22", "#464031", "#605843", "#7e7458", "#a09572", "#c8bc96"],
  tire: ["#060508", "#0d0b10", "#16131b", "#211d28", "#2d2836", "#3b3546", "#4b4458", "#5e576c"],
};
const RAMPS = [], EMISSIVE = [];
function ramp(hexes, emissive = false) { RAMPS.push(hexes.map(C)); EMISSIVE.push(emissive); return RAMPS.length - 1; }
const R = {};
for (const k of Object.keys(BASE)) R[k] = ramp(BASE[k]);
R.ink = ramp(Array(8).fill("#07050c"));
R.crystal = ramp(["#0e3440", "#14505e", "#1e7080", "#2e8fa8", "#46b4c8", "#6ad4e0", "#a0eef4", "#e0ffff"], true);
// 霧化的色票：遠景、中遠景、中景各往自己的霧色混一些（越遠混越多、霧越亮）
const FOG = {
  abyss: { 1: ["#1c4a56", 0.75], 2: ["#163a46", 0.55], 3: ["#10262f", 0.3] },
  junk: { 1: ["#4a3a30", 0.72], 2: ["#3a2c26", 0.52], 3: ["#261c18", 0.3] },
  cave: { 1: ["#12243e", 0.78], 2: ["#0e1c32", 0.58], 3: ["#0a1424", 0.32] },
  lair: { 1: ["#3a3422", 0.72], 2: ["#2e2a1c", 0.52], 3: ["#1e1c14", 0.3] },
}[THEME];
for (const [layer, [fog, t]] of Object.entries(FOG)) for (const k of ["rock", "rust", "metal", "tire", "wood"]) R[k + layer] = ramp(BASE[k].map((c) => mixHex(c, fog, t)));
const code = (r, t) => r * 8 + Math.max(0, Math.min(7, t)) + 1;

// 天空（逆光霧）：實色帶，中下段最亮
const SKY = ({
  abyss: [[0, "#060c12"], [30, "#08111a"], [58, "#0c1a24"], [82, "#11242e"], [102, "#173039"], [122, "#1f3d46"], [146, "#183540"], [170, "#122a34"]],
  junk: [[0, "#0e0a0a"], [30, "#160f0e"], [58, "#201614"], [82, "#2c1e1a"], [102, "#3a2820"], [122, "#4a3426"], [146, "#3c2a22"], [170, "#2a1e1a"]],
  cave: [[0, "#04060c"], [30, "#050812"], [58, "#070b18"], [82, "#0a1020"], [102, "#0d1528"], [122, "#111a30"], [146, "#0e162a"], [170, "#0a1020"]],
  lair: [[0, "#0a0a06"], [30, "#12120a"], [58, "#1a1a0e"], [82, "#242214"], [102, "#2e2c18"], [122, "#3a361e"], [146, "#2e2a18"], [170, "#201e12"]],
}[THEME]).map(([y, c]) => [y, C(c)]);
const skyRow = new Uint32Array(H);
for (let y = 0; y < H; y++) for (const [y0, c] of SKY) if (y >= y0) skyRow[y] = c;

// ---- 圖層
const W1 = 960, W2 = 1200, W3 = 1440, WF = 1800;
const PAR = { 1: 0.12, 2: 0.3, 3: 0.6, F: 1.35 };
const L1 = new Uint16Array(W1 * H), L2 = new Uint16Array(W2 * H), L3 = new Uint16Array(W3 * H), L4 = new Uint16Array(LEVEL_W * H), LF = new Uint16Array(WF * H);
const RIM = new Uint8Array(LEVEL_W * H);   // 遊玩層：頂邊（被光照到時再亮一階）
/** 中景水晶的光（座標在中景圖層裡，會跟著畫面循環） */
const CRYSTAL_LIGHTS = [];

const wrap = (x, w) => ((x % w) + w) % w;
const setL = (buf, bw, x, y, v) => { if (y >= 0 && y < H) buf[y * bw + wrap(x, bw)] = v; };

// 鐘乳石（dir 1 往下尖）或石筍（dir -1 往上尖）：半寬用 1.6 次方縮小，邊緣是漸變的階梯；兩側邊緣用 rim 色（逆光）
function spike(buf, bw, cx, base, len, w, dir, body, rim) {
  for (let k = 0; k < len; k++) {
    const hw = Math.round((w / 2) * (1 - Math.pow(k / len, 1.6)));
    if (hw <= 0) break;
    for (let dx = -hw; dx < hw; dx++) setL(buf, bw, cx + dx, base + dir * k, dx === -hw || dx === hw - 1 ? rim : body);
  }
}

// 遊玩層用的小垃圾圖章：字元 → [色票, 明暗階]
const JP = {
  k: [R.ink, 0], r: [R.rust, 5], R: [R.rust, 3], m: [R.metal, 6], M: [R.metal, 4], n: [R.metal, 2],
  w: [R.wood, 5], W: [R.wood, 3], v: [R.wood, 2], b: [R.bone, 6], B: [R.bone, 4], t: [R.tire, 4], T: [R.tire, 2],
};
const JUNK = {
  tire: [".kkkkkk.", "kttTTttk", "ktk..kTk", "ktk..kTk", "kttTTTTk", ".kkkkkk."],
  crate: ["kkkkkkkkk", "kwwwwwwWk", "kwkkkkkWk", "kwwWwwwWk", "kwkkkkkWk", "kWWWWWWvk", "kkkkkkkkk"],
  pipe: ["kkkkkkkkkkk.", "kmmmmmmmmMMk", "kMMMMMMMMnnk", "kkkkkkkkkkk."],
  bone: [".kk.....kk.", "kbbkkkkkbBk", ".kbbbbbbBk.", "kbBkkkkkbBk", ".kk.....kk."],
  can: [".kkkk.", "kmmMnk", "krrRRk", "kmmMnk", "kMMnnk", ".kkkk."],
  plank: ["kkkkkkkkkkkkkk", "kwwwwWwwwwwWWk", "kWWvWWWWWvWWvk", "kkkkkkkkkkkkkk"],
};
const PILES = [
  [["tire", -12, 0], ["crate", -2, 0], ["can", 7, 0], ["plank", -8, 6]],
  [["pipe", -6, 0], ["bone", -4, 4], ["can", 6, 0]],
  [["crate", -10, 0], ["crate", -1, 0], ["tire", -6, 7], ["bone", 7, 0]],
  [["plank", -7, 0], ["can", -4, 4], ["tire", 4, 0]],
];
// 水晶群圖章（數字是水晶色票的明暗階）
const CRYSTALS = [
  ["..6.", ".64.", ".53.", "353.", "3532", "3332"],
  ["...6....", "..64..6.", "..53.64.", ".353.53.", ".3533532", "33333332"],
  ["....6.......", "...64...6...", "...53..64...", "..353..53.6.", "..353.353.4.", ".3533.353342", "333333333332"],
];

function build() {
  // ---- 遠景（0.12）：鐘乳石、石筍，幾乎融進霧裡
  for (let k = 0; k < 12; k++) {
    const cx = Math.floor((k + rand(k + S, 1) * 0.6) * (W1 / 12));
    spike(L1, W1, cx, 0, 50 + Math.floor(rand(k + S, 2) * 50), 26 + Math.floor(rand(k + S, 3) * 30), 1, code(R.rock1, 3), code(R.rock1, 5));
    spike(L1, W1, cx + 40, H - 1, 80 + Math.floor(rand(k + S, 4) * 50), 40 + Math.floor(rand(k + S, 5) * 40), -1, code(R.rock1, 3), code(R.rock1, 5));
  }

  // ---- 中遠景（0.3）：岩柱＋巨大的垃圾剪影（輪胎、木箱、鐵管）＝「垃圾山」
  const N2 = JUNKY ? 9 : 6;
  for (let k = 0; k < N2; k++) {
    const cx = Math.floor((k + 0.3 + rand(k + S, 11) * 0.4) * (W2 / N2)), w = (THEME === "cave" ? 44 : 30) + Math.floor(rand(k + S, 12) * 16);
    for (let y = 0; y < H; y++) {
      const u = Math.abs(y - H * 0.4) / (H * 0.6), hw = Math.round((w / 2) * (0.5 + 0.5 * u * u));
      for (let dx = -hw; dx < hw; dx++) setL(L2, W2, cx + dx, y, code(R.rock2, dx === -hw || dx === hw - 1 ? 5 : dx > hw - 6 ? 2 : 3));
    }
    const jx = cx + 90, kind = THEME === "cave" ? -1 : k % 3;
    if (kind === -1) {          // 洞窟：巨大的石筍
      spike(L2, W2, jx, H - 1, 90 + Math.floor(rand(k + S, 13) * 50), 34 + Math.floor(rand(k + S, 14) * 20), -1, code(R.rock2, 3), code(R.rock2, 5));
    } else if (kind === 0) {           // 半埋的巨大輪胎
      const r0 = 26, r1 = 16, cy = 170;
      for (let y = cy - r0; y <= cy + r0; y++) for (let x = -r0; x <= r0; x++) {
        const d = Math.hypot(x, y - cy);
        if (d <= r0 && d >= r1) setL(L2, W2, jx + x, y, code(R.tire2, d > r0 - 1.5 || d < r1 + 1.5 ? 5 : y < cy ? 4 : 3));
      }
    } else if (kind === 1) {    // 斜靠的巨大木箱
      for (let y = 0; y < 34; y++) for (let x = 0; x < 44; x++) {
        const edge = x === 0 || y === 0 || x === 43, plank = y % 9 === 0 || x === 22;
        setL(L2, W2, jx + x, 150 + y, code(R.wood2, edge ? 5 : plank ? 2 : 4));
      }
    } else {                    // 橫躺的巨大鐵管
      for (let y = 0; y < 16; y++) for (let x = 0; x < 80; x++) {
        const ring = x % 20 < 2, t = y === 0 ? 6 : y < 4 ? 5 : y > 12 ? 2 : 4;
        setL(L2, W2, jx + x, 156 + y, code(R.metal2, ring ? t - 1 : t));
      }
    }
  }

  // ---- 中景（0.6）：從天花板垂下的岩塊和鐵鍊，岩架上的發光水晶
  const N3 = THEME === "cave" ? 13 : 9;
  for (let k = 0; k < N3; k++) {
    const cx = Math.floor((k + 0.2 + rand(k + S, 21) * 0.5) * (W3 / N3));
    spike(L3, W3, cx, 0, 34 + Math.floor(rand(k + S, 22) * 30), 30 + Math.floor(rand(k + S, 23) * 20), 1, code(R.rock3, 2), code(R.rock3, 4));
    // 鐵鍊：一節亮一節暗，2px 寬
    const chainX = cx + 40, len = THEME === "cave" ? 0 : 40 + Math.floor(rand(k + S, 24) * 50);
    for (let y = 0; y < len; y++) {
      const link = Math.floor(y / 3) % 2;
      setL(L3, W3, chainX, y, code(R.metal3, link ? 4 : 3));
      setL(L3, W3, chainX + 1, y, code(R.metal3, link ? 2 : 3));
    }
    // 地上的石塊岩架＋水晶
    const lx = cx + 100, ly = 172 - Math.floor(rand(k + S, 25) * 10), lw = 40;
    for (let y = ly; y < H; y++) for (let x = 0; x < lw; x++) {
      const inset = Math.max(0, 4 - (y - ly));        // 頂端兩角修圓（階梯）
      if (x < inset || x >= lw - inset) continue;
      setL(L3, W3, lx + x, y, code(R.rock3, y === ly ? 4 : x < 2 ? 3 : 2));
    }
    const rows = CRYSTALS[k % 3], ox = lx + 10;
    rows.forEach((row, j) => [...row].forEach((ch, i) => ch !== "." && setL(L3, W3, ox + i, ly - rows.length + j, code(R.crystal, +ch))));
    CRYSTAL_LIGHTS.push({ x: ox + (rows[0].length >> 1), y: ly - (rows.length >> 1), r: 34, lv: 2 });
  }

  // ---- 遊玩層：地面、牆、平台、苔蘚、垃圾堆
  const put = (x, y, v) => { if (x >= 0 && y >= 0 && x < LEVEL_W && y < H) L4[y * LEVEL_W + x] = v; };
  const brick = (x, y, top) => {
    const row = Math.floor((y - top) / 8), off = (row & 1) * 8, bx = (x + off) % 16, by = (y - top) % 8;
    if (bx === 0 || by === 0) return code(R.ink, 0);
    const id = Math.floor((x + off) / 16), shade = rand(id + S, row, 9) < 0.25 ? 1 : 0;
    return code(R.rock, (by === 1 ? 4 : by === 7 ? 2 : 3) - shade);
  };
  const CRACK = [[3, 2], [4, 3], [4, 4], [5, 5], [6, 5]];
  const mossTop = (x, y0) => {
    put(x, y0, code(R.moss, 5)); put(x, y0 + 1, code(R.moss, 3));
    if (x % 23 === 0) for (let j = 2; j < 4 + (x % 3); j++) put(x, y0 + j, code(R.moss, 2));
    const tuft = x % 11;
    if (tuft === 3 || tuft === 5) put(x, y0 - 1, code(R.moss, 5));
    if (tuft === 4) { put(x, y0 - 1, code(R.moss, 6)); put(x, y0 - 2, code(R.moss, 5)); }
  };
  for (let x = 0; x < LEVEL_W; x++) {
    for (let y = FLOOR; y < H; y++) put(x, y, brick(x, y, FLOOR));
    mossTop(x, FLOOR);
  }
  for (let k = 0; k < LEVEL_W / 16; k += 7) for (const [dx, dy] of CRACK) put(k * 16 + dx, FLOOR + 8 + dy, code(R.ink, 0));
  for (const side of [0, LEVEL_W - WALL]) for (let x = side; x < side + WALL; x++) for (let y = 0; y < FLOOR; y++) put(x, y, brick(x, y, 0));
  const plank = (x, y, p) => {
    const by = y - p.y, bx = x - p.x;
    if (by === 0 || by === 8 || bx === 0 || bx === p.w - 1) return code(R.ink, 0);
    if ((bx % 24 === 3 || bx % 24 === 4) && by > 1) return code(R.metal, bx % 24 === 3 ? 5 : 3);   // 鐵架
    if (by === 4) return code(R.wood, 2);                                                         // 兩片木板的縫
    return code(R.wood, (by === 1 || by === 5 ? 5 : by === 3 || by === 7 ? 3 : 4) - (rand(Math.floor(bx / 12) + S, by > 4 ? 1 : 0, 7) < 0.3 ? 1 : 0));
  };
  for (const p of PLATFORMS) for (let x = p.x; x < p.x + p.w; x++) {
    const edge = x === p.x || x === p.x + p.w - 1;
    for (let y = p.y; y < p.y + 9; y++) put(x, y, JUNKY ? plank(x, y, p) : edge || y === p.y + 8 ? code(R.ink, 0) : brick(x, y, p.y));
    if (!JUNKY) mossTop(x, p.y);
  }
  const PILE_GAP = { abyss: 96, junk: 52, cave: 240, lair: 44 }[THEME];
  for (let k = 0; k < LEVEL_W / PILE_GAP - 1; k++) {
    const cx = 100 + k * PILE_GAP + Math.floor(rand(k + S, 51) * 30);
    if (cx > LEVEL_W - 60) break;
    if (TORCHES.some((t) => Math.abs(t - cx) < 30)) continue;
    for (const [name, dx, dy] of PILES[k % PILES.length]) {
      const rows = JUNK[name];
      rows.forEach((row, j) => [...row].forEach((ch, i) => ch !== "." && put(cx + dx + i, FLOOR - dy - rows.length + j, code(...JP[ch]))));
    }
  }
  for (let y = 1; y < H; y++) for (let x = 0; x < LEVEL_W; x++) {
    const i = y * LEVEL_W + x;
    if (L4[i] && !L4[i - LEVEL_W]) RIM[i] = 1;
  }

  // ---- 前景剪影（1.35）：上方垂下的岩塊、下方的碎石堆，幾乎全黑，只有靠光那側一條邊
  for (let k = 0; k < 5; k++) {
    const cx = Math.floor((k + 0.5) * (WF / 5)) + Math.floor(rand(k + S, 61) * 80);
    spike(LF, WF, cx, 0, 22 + Math.floor(rand(k + S, 62) * 22), 30 + Math.floor(rand(k + S, 63) * 24), 1, code(R.rock, 0), code(R.rock, 1));
    spike(LF, WF, cx + 180, H - 1, 16 + Math.floor(rand(k + S, 64) * 10), 60 + Math.floor(rand(k + S, 65) * 30), -1, code(R.rock, 0), code(R.rock, 1));
  }
  for (let y = 1; y < H; y++) for (let x = 0; x < WF; x++) {
    const i = y * WF + x;
    if (LF[i] && !LF[i - WF]) LF[i] = code(R.rock, 2);   // 頂邊：微弱的逆光邊
  }
}
build();

// 四角暗角：每個畫面大小算一次（0～2 階，平滑）
let vig = new Float32Array(0), vigW = 0;
function vignette(W) {
  if (vigW === W) return vig;
  vigW = W;
  vig = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (x - W / 2) / (W / 2), dy = (y - H / 2) / (H / 2), d = dx * dx * 0.6 + dy * dy;
    vig[y * W + x] = Math.max(0, Math.min(2, (d - 0.55) * 2.6));
  }
  return vig;
}

// 色票兩階之間平滑混合（柔和光影用）
const mix = (a, b, k) => {
  const q = 1 - k;
  return 0xff000000 | ((((a >>> 16) & 255) * q + ((b >>> 16) & 255) * k) << 16) | ((((a >>> 8) & 255) * q + ((b >>> 8) & 255) * k) << 8) | ((a & 255) * q + (b & 255) * k);
};

/** 畫背景＋遊玩層。lv 是 light.js 算出來的亮度（螢幕座標，小數）。 */
export function drawLevel(frame, lv) {
  const W = frame.w, cx = frame.ox | 0, cy = frame.oy | 0, out = frame.color, V = vignette(W), [TR, TG, TB] = tintOf(), LB = frame.light;
  const o1 = Math.floor(cx * PAR[1]), o2 = Math.floor(cx * PAR[2]), o3 = Math.floor(cx * PAR[3]);
  for (let y = 0; y < H; y++) {
    const wy = y + cy, row = y * W;
    if (wy < 0 || wy >= H) { out.fill(skyRow[0], row, row + W); continue; }
    const r1 = wy * W1, r2 = wy * W2, r3 = wy * W3, r4 = wy * LEVEL_W;
    for (let x = 0; x < W; x++) {
      const i = row + x, gx = x + cx;
      let v = gx >= 0 && gx < LEVEL_W ? L4[r4 + gx] : 0, layer = 4;
      if (!v) { v = L3[r3 + wrap(x + o3, W3)]; layer = 3; }
      if (!v) { v = L2[r2 + wrap(x + o2, W2)]; layer = 2; }
      if (!v) { v = L1[r1 + wrap(x + o1, W1)]; layer = 1; }
      if (!v) { out[i] = skyRow[wy]; continue; }
      const rp = (v - 1) >> 3, ramp = RAMPS[rp];
      let t = (v - 1) & 7;
      if (EMISSIVE[rp]) { out[i] = ramp[t]; continue; }
      const l = lv[i];
      let tt = t;
      if (layer === 4) tt += l + (RIM[r4 + gx] ? Math.min(1, l) : 0) - V[i];
      else if (layer === 3) tt += l * 0.5 - V[i] * 0.5;
      else tt += l * 0.15;
      const top = ramp.length - 1;
      if (tt <= 0) out[i] = ramp[0];
      else if (tt >= top) out[i] = ramp[top];
      else { const t0 = tt | 0, k = tt - t0; out[i] = k < 0.02 ? ramp[t0] : mix(ramp[t0], ramp[t0 + 1], k); }
      // 光的顏色：照到的地方再加上光源的色調（平滑變淡）
      if (l > 0.02 && layer >= 3) {
        const s3 = layer === 4 ? 1 : 0.5;
        LB[i] = 0xff000000 | (Math.min(255, TB[i] * s3) << 16) | (Math.min(255, TG[i] * s3) << 8) | Math.min(255, TR[i] * s3);
      }
    }
  }
}

/** 前景剪影：在角色和特效之後畫，蓋在最上面。 */
export function drawForeground(frame) {
  const W = frame.w, cy = frame.oy | 0, out = frame.color, of = Math.floor((frame.ox | 0) * PAR.F);
  for (let y = 0; y < H; y++) {
    const wy = y + cy;
    if (wy < 0 || wy >= H) continue;
    const r = wy * WF, row = y * W;
    for (let x = 0; x < W; x++) {
      const v = LF[r + wrap(x + of, WF)];
      if (v) out[row + x] = RAMPS[(v - 1) >> 3][(v - 1) & 7];
    }
  }
}

// ---- 大氣：光束（硬邊、分段亮度）＋漂浮光點，都寫進 light 層（加亮）
const SHAFTS = [{ x: 140, w: 14 }, { x: 520, w: 22 }, { x: 860, w: 10 }, { x: 1180, w: 18 }];
const SHAFT_W = 1400, SHAFT_PAR = 0.8;
const SHAFT_C = [[6, 14, 16], [10, 22, 26]];     // 兩段亮度（r, g, b 加量）
const MOTE = [C("#a0eef4"), C("#46b4c8")];
export function drawAtmosphere(frame, time) {
  const W = frame.w, Hh = frame.h, Lb = frame.light, Cb = frame.color, os = Math.floor((frame.ox | 0) * SHAFT_PAR);
  const add = (i, [r, g, b]) => {
    const d = Lb[i];
    Lb[i] = (255 << 24) | (Math.min(255, ((d >>> 16) & 255) + b) << 16) | (Math.min(255, ((d >>> 8) & 255) + g) << 8) | Math.min(255, (d & 255) + r);
  };
  const flicker = 0.75 + 0.25 * Math.sin(time * 1.3);   // 慢慢明暗呼吸，像有東西飄過光源
  for (const s of SHAFTS) for (let rep = -1; rep <= 1; rep++) {
    const base = s.x + rep * SHAFT_W - os;
    for (let y = 0; y < FLOOR - 10 && y < Hh; y++) {
      const fall = 1 - y / 150;                                    // 往下慢慢淡掉
      if (fall <= 0) break;
      const x0 = base + y * 0.45, half = s.w * 0.5 + 3, mid = x0 + s.w * 0.5;
      for (let x = Math.max(0, Math.floor(mid - half)); x < Math.min(W, Math.ceil(mid + half)); x++) {
        const across = 1 - Math.abs(x + 0.5 - mid) / half;        // 中間亮、兩邊柔和
        if (across <= 0) continue;
        const k = across * across * fall * flicker;
        add(y * W + x, [SHAFT_C[1][0] * k, SHAFT_C[1][1] * k, SHAFT_C[1][2] * k]);
      }
    }
  }
  // 光點：慢慢往上飄，跟著中景的視差
  const om = Math.floor((frame.ox | 0) * 0.6);
  for (let n = 0; n < 36; n++) {
    const x = wrap(Math.floor(rand(n, 71) * 1440) + Math.round(Math.sin(time * 0.8 + n) * 3) - om, 1440);
    if (x >= W) continue;
    const y = FLOOR - 4 - Math.floor((time * (6 + rand(n, 72) * 8) + rand(n, 73) * 170) % 170);
    if (y < 0 || y >= Hh) continue;
    const i = y * W + x;
    Cb[i] = MOTE[n & 1];
    add(i, [20, 50, 56]);
    // 光點旁邊一圈淡淡的光暈
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && xx < W && yy >= 0 && yy < Hh) add(yy * W + xx, [6, 16, 18]);
    }
  }
}

/** 這一幀要算的固定光源：火把（遊玩層）＋中景水晶（會循環，挑畫面附近的）。 */
export function sceneLights(camX, W, time) {
  const list = [];
  for (const x of TORCHES) list.push({ x, y: FLOOR - 26, r: 74 + (Math.floor(time * 8) % 3), lv: 3, col: "#ff8a3a" });
  const o = camX * PAR[3];
  for (const c of CRYSTAL_LIGHTS) {
    const k = Math.round((o - c.x + W / 2) / W3);
    list.push({ x: c.x + k * W3, y: c.y, r: c.r, lv: c.lv, par: PAR[3], col: "#46d4e8" });
  }
  return list;
}

/** 腳下的地面高度：先找平台（只有從上方落下時），再退回地板。 */
// 目前地圖的平台與寬度（城鎮會換成沒有平台、比較窄）
export const geo = { platforms: PLATFORMS, w: LEVEL_W };
export function groundAt(x, prevY, y, dropping) {
  if (!dropping) for (const p of geo.platforms) if (x >= p.x - 2 && x <= p.x + p.w + 2 && prevY <= p.y + 0.5 && y >= p.y) return p.y;
  return y >= FLOOR ? FLOOR : null;
}
/** 是否站在平台上（不是地板）。 */
export const onPlatform = (x, y) => geo.platforms.some((p) => Math.abs(y - p.y) < 0.5 && x >= p.x - 2 && x <= p.x + p.w + 2);
