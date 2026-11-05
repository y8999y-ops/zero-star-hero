// 形態機關＋一次性資源（8d，照 pixelfx skill 畫→看→修）：
//   機關：crack 裂開的垃圾牆（鐵罐星撞破）、wind 深淵氣流（蝠翼星滑翔往上）、shroom 黏液菇（黏液星彈很高）、seal 星光封印（星星的星屑彈打亮）
//   資源：ember 星之殘火（最大魔力）、vein 星塵礦脈（敲三下）、fossil 魔物化石核（技能點）、safe 被丟下來的寶箱、stele 星王的碑文
// 參考：pixelfx critters/wisp（鬼火的火舌與臉）、fire/candle（焰形：藍根白芯）、ice/frost-breath（風紋一條條往前竄）、
//       critters/slime（史萊姆的光澤和壓扁）、frame-art 的石頭明暗（左上亮右下暗）。
// 每個 drawXxx(frame, x, y, ..., t)：(x, y)＝底部中心（貼地）。草稿：game/tools/drafts/features.mjs
import { hex } from "../../pixelfx/src/core/index.js";

const P = (c) => hex(c) >>> 0;
const OUT = P("#0c0a14");
function put(frame, x, y, c, glow) {
  x = Math.round(x) - frame.ox; y = Math.round(y) - frame.oy;
  if (x < 0 || y < 0 || x >= frame.w || y >= frame.h) return;
  frame.color[y * frame.w + x] = c;
  if (glow) frame.light[y * frame.w + x] = c;
}
const hash = (a, b, c = 0) => { let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
/** 字元圖：rows（'.' 透明），map 字元→顏色，glow 字串裡的字元會發光；自動加 1px 外框 */
function sprite(frame, rows, x0, y0, map, glow = "", outline = true) {
  const at = (i, j) => rows[j]?.[i] && rows[j][i] !== ".";
  if (outline) for (let j = -1; j <= rows.length; j++) for (let i = -1; i <= rows[0].length; i++) if (!at(i, j) && (at(i + 1, j) || at(i - 1, j) || at(i, j + 1) || at(i, j - 1))) put(frame, x0 + i, y0 + j, OUT);
  rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== ".") put(frame, x0 + i, y0 + j, map[ch], glow.includes(ch)); }));
}

// ---------- 裂開的垃圾牆：32×48，壓扁的垃圾一塊塊疊起來，裂縫照受傷程度變多（hp 0～1） ----------
// 第 2 輪：原本顏色忘了轉成像素值，整面牆變黑
const JUNK = [["#5a2a20", "#8a3e24", "#b05a2a"], ["#5c5868", "#7c7884", "#9a968c"], ["#4a2830", "#7a4434", "#a06446"], ["#342646", "#463c5e", "#5a5274"]].map((r) => r.map(P));
export function drawCrack(frame, x, y, hp = 1, t = 0, H = 48) {
  const W = 32, x0 = Math.round(x - W / 2), y0 = Math.round(y - H), shake = hp < 1 && Math.sin(t * 60) > 0.6 ? 1 : 0;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const edge = i === 0 || j === 0 || i === W - 1 || j === H - 1;
    // 每塊 10×8 左右的垃圾塊，錯開排
    const row = Math.floor(j / 8), off = row % 2 ? 5 : 0, bx = Math.floor((i + off) / 10), lx = (i + off) % 10, ly = j % 8;
    const M = JUNK[Math.floor(hash(bx, row, 3) * JUNK.length)];
    let c = edge || lx === 0 || ly === 0 ? OUT : ly === 1 || lx === 1 ? M[2] : ly === 7 || lx === 9 ? M[0] : M[1];
    put(frame, x0 + i + shake, y0 + j, c);
  }
  // 裂縫：從中間往外的鋸齒線，傷越重越多條；裂縫裡透出一點暗紅
  const n = hp >= 1 ? 1 : hp > 0.5 ? 2 : 3;
  // 受傷時：右上角缺一塊（露出後面的黑）
  if (hp < 1) for (let j = 1; j < 9; j++) for (let i = W - 10 + Math.floor(j / 2); i < W - 1; i++) put(frame, x0 + i + shake, y0 + j, P("#0a0810"));
  for (let k = 0; k < n; k++) {
    let cx = W / 2 + (k - 1) * 6, cy = 6 + k * 12;
    for (let s = 0; s < (hp >= 1 ? 14 : 30); s++) {
      // 第 3 輪：裂縫加粗成 2 格（原本 1 格細線，完整和裂開分不出來），受傷越重裂縫越長
      put(frame, x0 + cx + shake, y0 + cy, OUT); put(frame, x0 + cx + 1 + shake, y0 + cy, s % 4 ? OUT : P("#2a0a10"));
      cx += hash(k, s, 4) < 0.5 ? -1 : 1; cy += 1;
      if (cy >= H - 1) break;
    }
  }
}

// ---------- 深淵氣流：寬 w、高 h 的往上吹的風（一條條淡淡的風紋往上竄、捲起小碎屑），迴圈 ----------
const WIND = [P("#1a3a5a"), P("#3a7aa8"), P("#7ac8f0"), P("#c8f0ff")];
export function drawWind(frame, x, y, w, h, t) {
  const x0 = Math.round(x - w / 2);
  for (let n = 0; n < Math.round(w / 1.6); n++) {   // 第 2 輪：風紋多一倍
    const sx = x0 + Math.floor(hash(n, 1) * w), speed = 90 + hash(n, 2) * 80, len = 6 + Math.floor(hash(n, 3) * 10);
    const head = y - ((t * speed + hash(n, 4) * h) % h);
    for (let k = 0; k < len; k++) {
      const yy = head + k, f = k / len, wob = Math.round(Math.sin((yy + n * 7) * 0.12) * 1.5);
      if (yy > y || yy < y - h) continue;
      const lv = f < 0.15 ? 3 : f < 0.45 ? 2 : f < 0.8 ? 1 : 0;
      put(frame, sx + wob, yy, WIND[lv], lv >= 2);
    }
  }
  // 第 2 輪：被吹起來的小碎屑，一邊往上一邊左右晃
  for (let n = 0; n < Math.round(w / 6); n++) {
    const p = (t * (0.5 + hash(n, 11) * 0.4) + hash(n, 12)) % 1, px = x0 + hash(n, 13) * w + Math.sin(p * 9 + n) * 3, py = y - p * h;
    put(frame, px, py, p < 0.6 ? WIND[3] : WIND[2], true);
  }
  // 地面的出風口：一排暗色的裂縫
  for (let i = 0; i < w; i++) if (hash(i, 9) < 0.5) put(frame, x0 + i, y - 1, P("#0a1a2a"));
}

// ---------- 黏液菇：24×16，半透明感的綠色傘、白點、粗短的柄；squash 0～1＝被踩扁的程度 ----------
const SHROOM = [
  "......aaaaaaaaaa......",
  "....aabbbbbbbbbbaa....",
  "...abbbwwbbbbbbbbba...",
  "..abbbwwwbbbbsbbbbba..",
  ".abbbbbwbbbbbsssbbbba.",
  ".abbsbbbbbbbbbsbbbbba.",
  "abbsssbbbbbbbbbbbbcbba",
  "abbbsbbbbbbbbbbbbccbba",
  "accbbbbbbbbbbbbbccccca",
  ".acccccccccccccccccca.",
  "......dddddddddd......",
  "......deeeeeeeed......",
  "......deeeeeeeed......",
  "......deeeeeeefd......",
  ".....ddeeeeeeffdd.....",
  ".....dddddddddddd.....",
];
export function drawShroom(frame, x, y, squash = 0, t = 0) {
  const sy = 1 - squash * 0.35, wob = Math.sin(t * 3) * 0.04, rows = SHROOM.length, w = SHROOM[0].length;
  const map = { a: P("#2a6a2a"), b: P("#5ac84a"), c: P("#3a9a3a"), w: P("#e8ffd8"), s: P("#b4f890"), d: P("#3a2a1e"), e: P("#c8b08a"), f: P("#8a7454") };
  // 第 2 輪：原本壓扁沒效果——改成照 squash 把傘中間幾列拿掉（最多拿 4 列）、柄也縮短 2 列
  const drop = Math.round(squash * 4), stemDrop = Math.round(squash * 2);
  const scaled = [...SHROOM.slice(0, 2), ...SHROOM.slice(2 + drop, 10), ...SHROOM.slice(10, 11), ...SHROOM.slice(11 + stemDrop)];
  sprite(frame, scaled, Math.round(x - w / 2), Math.round(y - scaled.length), map, "ws");
}

// ---------- 星光封印：24×48 的石門，中間一顆星的刻紋；lit 0～1＝被打亮的程度，open 0～1＝往上收進去 ----------
export function drawSeal(frame, x, y, lit = 0, open = 0, t = 0, H = 48) {
  const W = 24, x0 = Math.round(x - W / 2), y0 = Math.round(y - H), lift = Math.round(open * H);
  const ST = [P("#141428"), P("#2a2e48"), P("#3c4466"), P("#545e84")], GOLD = [P("#6e3a0c"), P("#f0b424"), P("#ffe066"), P("#fff6c4")];
  for (let j = lift; j < H; j++) for (let i = 0; i < W; i++) {
    const yy = y0 + j - lift;
    const edge = i === 0 || i === W - 1 || j === lift;
    let c = edge ? OUT : i === 1 || j === lift + 1 ? ST[3] : i === W - 2 ? ST[1] : (j % 12 === 0 ? ST[1] : ST[2]);
    put(frame, x0 + i, yy, c);
  }
  if (open >= 1) return;
  // 中間的星：5 個尖的星形刻紋，沒亮是暗藍、亮了是金色發光（從中心往外亮）
  const cx = x0 + W / 2, cy = y0 + H / 2 - lift;
  // 第 2 輪：原本是 5 條線（像米字），改成真的五角星輪廓：外點 8、內點 3.5 連起來；亮的時候沿著輪廓一點一點亮起來
  const pts = [];
  for (let a = 0; a < 10; a++) { const ang = -Math.PI / 2 + (a * Math.PI) / 5, r = a % 2 ? 3.5 : 8.5; pts.push([cx + Math.cos(ang) * r, cy + Math.sin(ang) * r]); }
  for (let a = 0; a < 10; a++) {
    const [x1, y1] = pts[a], [x2, y2] = pts[(a + 1) % 10];
    for (let k = 0; k <= 8; k++) { const f = k / 8, on = lit > (a + f) / 10; put(frame, x1 + (x2 - x1) * f, y1 + (y2 - y1) * f, on ? GOLD[2] : ST[0], on); }
  }
  if (lit > 0) put(frame, cx, cy, GOLD[3], true);
  // 門縫透出的光（打亮之後）
  if (lit >= 1) for (let j = 2; j < H - 2; j += 3) put(frame, x0 + W - 1, y0 + j - lift, GOLD[1], true);
}

// ---------- 星之殘火：10×14 的小火苗（星星形狀的芯），上下飄、火舌晃 ----------
// 第 2 輪：原本太小看不到——火舌加長、芯改成 5×5 的星、外面一圈淡淡的光暈
export function drawEmber(frame, x, y, t) {
  const by = Math.round(y - 9 + Math.sin(t * 2.4) * 2), C = [P("#6e3a0c"), P("#f0b424"), P("#ffe066"), P("#fff6c4"), P("#ffffff"), P("#5ac8ff")];
  // 火舌：三條往上的尖，長度隨時間晃
  for (let k = -1; k <= 1; k++) {
    const len = 12 + Math.round(Math.sin(t * 7 + k * 2) * 2) - Math.abs(k) * 4;   // 第 3 輪：再加長
    for (let j = 0; j < len; j++) { const f = j / len, fx = x + k * 2 + Math.round(Math.sin(t * 5 + j) * (f * 1.6)), c = f < 0.4 ? C[3] : f < 0.75 ? C[2] : C[1]; put(frame, fx, by - 3 - j, c, true); if (f < 0.5) put(frame, fx + 1, by - 3 - j, C[2], true); }
  }
  // 芯：一顆小星（十字＋中心白），底部一點藍根
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const d = Math.abs(dx) + Math.abs(dy); if (d === 3 && !(dx && dy)) put(frame, x + dx, by + dy, C[2], true); else if (d <= 2) put(frame, x + dx, by + dy, d === 0 ? C[4] : d === 1 ? C[3] : C[2], true); }
  put(frame, x, by + 4, C[5], true); put(frame, x - 1, by + 4, C[5]); put(frame, x + 1, by + 4, C[5]);
  // 第 3 輪：外面一圈光暈（只寫光，不蓋顏色）
  for (let a = 0; a < 24; a++) { const ang = (a / 24) * Math.PI * 2, gx = Math.round(x + Math.cos(ang) * 6) - frame.ox, gy = Math.round(by + Math.sin(ang) * 6) - frame.oy; if (gx >= 0 && gy >= 0 && gx < frame.w && gy < frame.h && (a + Math.floor(t * 8)) % 3 === 0) frame.light[gy * frame.w + gx] = C[1]; }
}

// ---------- 星塵礦脈：28×20，嵌在地上的岩塊裡長出青白色結晶；hits 0～3（敲了幾下，裂開） ----------
export function drawVein(frame, x, y, hits = 0, t = 0) {
  const ROCK = { a: P("#2a2e48"), b: P("#3c4466"), c: P("#545e84") }, CR = [P("#1a7aa8"), P("#4cd8ec"), P("#a0f2fa"), P("#ffffff")];
  const rows = [
    "......bbbbbbbbbbbbb.......",
    "....bbccccccccccccbbb.....",
    "..bbcccccccccccccccbbbb...",
    ".bbccccccccccccccccccbbb..",
    "bbccccccccccccccccccccbbb.",
    "bcccccccccccccccccccccccbb",
    "baaaaaaaaaaaaaaaaaaaaaaaab",
  ];
  sprite(frame, rows, Math.round(x - 13), Math.round(y - rows.length), ROCK);
  // 結晶：5 根往上斜的晶柱，敲過的會少一根
  const sh = Math.sin(t * 40) > 0.7 && hits > 0 ? 1 : 0;
  [[-8, 7, -1], [-3, 11, 0], [2, 9, 1], [7, 6, 1], [-5, 5, -1]].forEach(([dx, len, lean], k) => {
    if (k >= 5 - hits) return;
    for (let j = 0; j < len; j++) {
      const xx = x + dx + Math.round(lean * j * 0.3) + sh, yy = y - 6 - j, tip = j >= len - 2;
      put(frame, xx - 1, yy, tip ? CR[1] : CR[0], false); put(frame, xx, yy, tip ? CR[3] : CR[2], true); put(frame, xx + 1, yy, CR[1], j > len - 4);
    }
  });
}

// ---------- 魔物化石核：22×14，一塊平平的石板裡埋著一顆螺旋狀的核，慢慢一亮一暗 ----------
export function drawFossil(frame, x, y, t, color = "#b878ff") {
  const k = Math.sin(t * 2) * 0.5 + 0.5, GL = P(color);
  const rows = [
    "...ccccccccccccccc....",
    ".cccbbbbbbbbbbbbbccc..",
    "ccbbbbbbbbbbbbbbbbbcc.",
    "cbbbbbbbbbbbbbbbbbbbcc",
    "cbbbbbbbbbbbbbbbbbbbbc",
    "abbbbbbbbbbbbbbbbbbbba",
    ".aaaaaaaaaaaaaaaaaaaa.",
  ];
  sprite(frame, rows, Math.round(x - 11), Math.round(y - rows.length), { a: P("#3a2a1e"), b: P("#7a6a54"), c: P("#a8987a") });
  // 螺旋核（嵌在石板中間，凸出一點）
  // 第 2 輪：原本螺旋太細看不出——改成凸出石板的一顆圓核（7×7，外圈暗、內圈發光、白點），旁邊刻一圈化石的螺紋
  const cx = Math.round(x), cy = Math.round(y - 9);
  for (let a = 0; a < 28; a++) { const r = 3.5 + a * 0.16, ang = a * 0.55; put(frame, cx + Math.cos(ang) * r, cy + 1 + Math.sin(ang) * r * 0.6, P("#5a4a3e")); }
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const d = dx * dx + dy * dy; if (d > 10) continue; put(frame, cx + dx, cy + dy, d > 6 ? OUT : d > 2 ? GL : P("#ffffff"), d <= 6 && k > 0.25); }
}

// ---------- 被丟下來的寶箱：24×20 的保險箱，關著／打開（門往右邊開、裡面發光） ----------
export function drawSafe(frame, x, y, opened = false, t = 0) {
  const M = { a: P("#2a2a3a"), b: P("#5c5868"), c: P("#7c7884"), d: P("#9a968c"), r: P("#b05a2a"), g: P("#f0b424"), k: P("#1a1a24") };
  const body = [
    "cccccccccccccccccccccc",
    "cdddddddddddddddddddbc",
    "cdbbbbbbbbbbbbbbbbbbbc",
    "cdbbbbbbbbbbbbbbbbbbbc",
    "cdbbbbbbbbbbbbbbbbbbbc",
    "cdbbbbbbbbbbbbbbbbbbbc",
    "cdbbbbbbbbbbbbbbbbbbbc",
    "cdbbbbbbbbbbbbbbbbbbbc",
    "cdbbbbbbbbbbbbbbbbbbbc",
    "cdbbbbbbbbbbbbbbbbbbbc",
    "cdbbbbbbbbbbbbbbbbbbbc",
    "cdbbbbbbbbbbbbbbbbbbbc",
    "cbbbbbbbbbbbbbbbbbbbbc",
    "aaaaaaaaaaaaaaaaaaaaaa",
    ".aa................aa.",
  ];
  const x0 = Math.round(x - 11), y0 = Math.round(y - body.length);
  if (!opened) {
    sprite(frame, body, x0, y0, M);
    // 門上的轉盤＋把手、鏽斑
    const cx = x0 + 11, cy = y0 + 7;
    for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, -1], [-1, 1], [1, 1]]) put(frame, cx + dx, cy + dy, M.d);
    put(frame, cx, cy, M.k); put(frame, cx + Math.round(Math.cos(t) * 1), cy + Math.round(Math.sin(t)), M.d);
    for (let j = 5; j < 10; j++) put(frame, x0 + 17, y0 + j, M.d);
    for (const [dx, dy] of [[4, 3], [5, 3], [14, 10], [15, 11], [3, 11]]) put(frame, x0 + dx, y0 + dy, M.r);
  } else {
    // 打開：箱子裡面是黑的、發金光，門板斜開在右邊
    const inner = body.map((r, j) => (j >= 2 && j <= 11 ? r.slice(0, 2) + "k".repeat(18) + r.slice(20) : r));
    sprite(frame, inner, x0, y0, M);
    for (let j = 4; j < 11; j++) for (let i = 4; i < 18; i++) if (hash(i, j, Math.floor(t * 6)) < 0.08) put(frame, x0 + i, y0 + j, M.g, true);
    for (let j = 0; j < 13; j++) for (let i = 0; i < 4; i++) put(frame, x0 + 22 + i, y0 + 1 + j + Math.round(i * 0.6), i === 0 ? M.c : i === 3 ? M.a : M.b);
  }
}

// ---------- 星王的碑文：20×32 的石碑，上面刻著星形符文；read＝讀過了（符文發金光） ----------
export function drawStele(frame, x, y, read = false, t = 0) {
  const ST = { a: P("#2a2e48"), b: P("#3c4466"), c: P("#545e84"), d: P("#7480a4") };
  const rows = [];
  for (let j = 0; j < 32; j++) {
    const w = j < 3 ? 14 - (3 - j) * 2 : j > 28 ? 20 : 16, pad = Math.floor((20 - w) / 2);
    rows.push(".".repeat(pad) + [...Array(w)].map((_, i) => (j > 28 ? "a" : i === 0 ? "d" : i === w - 1 ? "a" : j < 3 ? "c" : "b")).join("") + ".".repeat(20 - w - pad));
  }
  const x0 = Math.round(x - 10), y0 = Math.round(y - 32);
  sprite(frame, rows, x0, y0, ST);
  // 符文：三行，每行幾個小星和短線
  const k = Math.sin(t * 2.2) * 0.5 + 0.5, RC = read ? (k > 0.5 ? P("#ffe066") : P("#f0b424")) : P("#1a1a30");
  for (let line = 0; line < 4; line++) for (let i = 0; i < 4; i++) {
    const gx = x0 + 5 + i * 3, gy = y0 + 7 + line * 5;
    // 第 3 輪：符文改成三種形狀輪流（原本一排排像箭頭）：小星、斜線、點點
    const kind = Math.floor(hash(line, i, 5) * 3);
    if (kind === 0) for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, -1], [0, 1]]) put(frame, gx + dx, gy + dy, RC, read);
    else if (kind === 1) for (const [dx, dy] of [[-1, 1], [0, 0], [1, -1]]) put(frame, gx + dx, gy + dy, RC, read);
    else for (const [dx, dy] of [[-1, 0], [1, 0], [0, 1]]) put(frame, gx + dx, gy + dy, RC, read);
  }
  // 頂上的一顆星
  for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, -1], [0, 1]]) put(frame, x0 + 10 + dx, y0 + 4 + dy, read ? P("#fff6c4") : P("#545e84"), read);
}
