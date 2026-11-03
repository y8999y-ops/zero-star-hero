// 碎星鎮草稿：三個主要 NPC＋城鎮構圖（M6）。
//   node game/tools/drafts/town-drafts.mjs npc.png town.png
// NPC 遵守規則v2（1px 外框、硬邊、光從左上、精簡色盤）；城鎮的光暈是特效層，可以柔和。
// 參考（docs/素材參考.md「碎星鎮」）：
//   史萊姆櫃檯：PixelFX critters/slime（圓頂、白色高光）、城裡的居民用藍色和野外的綠色狂化史萊姆區分。
//   石頭魔像：OpenGameArt「[LPC] Golem」「16×16 golem」（方塊身體、肩膀最寬、大拳頭、胸口發光的核心）。
//   蘑菇老闆娘：OpenGameArt「Mushroom G…」「Micro World」「Animated Mushroom」（蓋子佔一半高、蓋上斑點、臉在柄上、蓋子下緣一圈暗色菌褶）。
//   城鎮：OpenGameArt「House sets」（模組化的門窗屋頂）、冷色牆面配暖色窗光（像素雪村、中世紀工坊範例）、門邊的暖色燈籠。
import { writeFileSync } from "node:fs";
import { encodePNG } from "../../../pixelfx/tools/lib/png.mjs";

const hex = (s) => [1, 3, 5].map((k) => parseInt(s.slice(k, k + 2), 16));
const OUT = "#2a1626";

// ---- 通用：材質格子 → 上色（左上亮、右下暗、離邊緣越遠越平）→ 外框
function sprite(W, H, paint, ramps, fixed = {}) {
  const m = Array.from({ length: H }, () => Array(W).fill(null));
  const set = (x, y, v) => { if (x >= 0 && y >= 0 && x < W && y < H) m[y][x] = v; };
  paint(set, m);
  const empty = (x, y) => x < 0 || y < 0 || x >= W || y >= H || !m[y][x];
  const diff = (x, y, k) => empty(x, y) || m[y][x] !== k;
  const px = Array.from({ length: H }, () => Array(W).fill(null));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = m[y][x]; if (!k) continue;
    if (fixed[k]) { px[y][x] = fixed[k]; continue; }
    const R = ramps[k]; if (!R) continue;
    let t = 2;
    if (diff(x - 1, y, k) || diff(x, y - 1, k)) t = 3;
    else if (diff(x + 1, y, k) || diff(x, y + 1, k)) t = 1;
    if (t === 2 && (diff(x + 2, y, k) || diff(x, y + 2, k))) t = 1;    // 右下兩格內都算暗面
    if (t === 3 && (diff(x - 1, y - 1, k)) && (diff(x - 1, y, k) && diff(x, y - 1, k))) t = 4;   // 左上角最亮
    px[y][x] = R[Math.min(R.length - 1, t)];
  }
  const out = Array.from({ length: H + 2 }, () => Array(W + 2).fill(null));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) out[y + 1][x + 1] = px[y][x];
  for (let y = 0; y < H + 2; y++) for (let x = 0; x < W + 2; x++) {
    if (out[y][x]) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => out[y + b]?.[x + a] && out[y + b][x + a] !== OUT)) out[y][x] = OUT;
  }
  return { px: out, W: W + 2, H: H + 2 };
}
const lint = (name, s) => {
  const at = (x, y) => s.px[y]?.[x] ?? null, bad = [];
  for (let y = 0; y < s.H; y++) for (let x = 0; x < s.W; x++) {
    const c = at(x, y); if (!c) continue;
    const nb = [at(x + 1, y), at(x - 1, y), at(x, y + 1), at(x, y - 1)];
    if (c === OUT && at(x + 1, y) === OUT && at(x, y + 1) === OUT && at(x + 1, y + 1) === OUT) bad.push(`腫塊(${x},${y})`);
    if (c === OUT && !nb.some((v) => v && v !== OUT)) bad.push(`雙層邊(${x},${y})`);
    if (c !== OUT && !nb.some((v) => v && v !== OUT)) bad.push(`孤立點(${x},${y})`);
  }
  console.log(name.padEnd(10), `${s.W}×${s.H}`, `顏色 ${new Set(s.px.flat().filter(Boolean)).size}`, bad.length ? bad.join(" ") : "規則檢查通過");
};
const halfRows = (widths, cx) => (set, v) => widths.forEach((w, y) => { for (let x = cx - w + 1; x <= cx + w - 1; x++) set(x, y, v); });

// ---- 史萊姆櫃檯：冷靜的藍色大史萊姆，圓眼鏡、紅色領帶、公會徽章
function slimeClerk() {
  const W = 31, H = 25, cx = 15;
  const prof = [5, 8, 10, 11, 12, 13, 13, 14, 14, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 16, 16];
  return sprite(W, H, (set) => {
    halfRows(prof, cx)(set, "B");
    // 眼鏡：兩個圓框（鏡片淡藍）＋鼻樑
    for (const ex of [cx - 5, cx + 5]) {
      for (const [dx, dy] of [[-1, -2], [0, -2], [1, -2], [-2, -1], [2, -1], [-2, 0], [2, 0], [-2, 1], [2, 1], [-1, 2], [0, 2], [1, 2]]) set(ex + dx, 10 + dy, "F");
      for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) set(ex + dx, 10 + dy, "L");
      set(ex, 10, "E"); set(ex - 1, 9, "W");
    }
    for (let x = cx - 2; x <= cx + 2; x++) set(x, 9, "F");
    set(cx - 1, 15, "E"); set(cx, 16, "E"); set(cx + 1, 15, "E");   // 微笑
    // 領帶
    for (const [x0, x1, y] of [[cx - 1, cx + 1, 18], [cx, cx, 19], [cx - 1, cx + 1, 20], [cx - 1, cx + 1, 21], [cx - 1, cx + 1, 22]]) for (let x = x0; x <= x1; x++) set(x, y, "T");
    // 徽章（左胸）
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) set(cx - 8 + dx, 18 + dy, "G");
    // 濕亮高光
    for (const [x, y] of [[cx - 9, 4], [cx - 10, 5], [cx - 10, 6], [cx + 9, 16]]) set(x, y, "W");
  }, { B: ["#173064", "#244c96", "#3474c8", "#5aa2ec", "#9ad0ff"], T: ["#6a1424", "#a02234", "#d03a44", "#ff6a60", "#ff9a8a"], G: ["#6e3c10", "#c07c18", "#ffc83a", "#fff2a8", "#fff2a8"] },
  { F: "#2a2440", L: "#c8ecff", E: "#1a1030", W: "#ffffff" });
}

// ---- 石頭魔像：肩膀最寬的石塊身體、大拳頭、胸口橘色熔爐核心、皮圍裙、肩上長苔
function golem() {
  const W = 34, H = 36;
  return sprite(W, H, (set) => {
    const box = (x0, y0, x1, y1, v, cut = 1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const c = Math.min(x - x0, x1 - x, y - y0, y1 - y); if (c >= 0 && !(cut && (x - x0 < cut || x1 - x < cut) && (y - y0 < cut || y1 - y < cut))) set(x, y, v); } };
    box(12, 1, 21, 8, "S");                 // 頭
    box(5, 8, 28, 22, "S", 2);              // 身體（肩膀最寬）
    box(8, 23, 25, 27, "S");                // 腰
    box(9, 28, 14, 34, "S"); box(19, 28, 24, 34, "S");   // 腿
    box(0, 13, 6, 27, "S"); box(27, 13, 33, 27, "S");    // 手臂
    box(0, 26, 7, 33, "S"); box(26, 26, 33, 33, "S");    // 大拳頭
    for (let y = 19; y <= 27; y++) for (let x = 10; x <= 23; x++) if (y > 19 || (x > 11 && x < 22)) set(x, y, "A");   // 皮圍裙
    for (const [x0, x1, y] of [[14, 19, 13], [13, 20, 14], [13, 20, 15], [14, 19, 16]]) for (let x = x0; x <= x1; x++) set(x, y, "C");   // 熔爐核心
    set(15, 14, "Y"); set(16, 14, "Y"); set(15, 15, "Y");
    for (const [x, y] of [[6, 8], [7, 8], [8, 8], [5, 9], [6, 9], [26, 8], [27, 8], [28, 9], [25, 8]]) set(x, y, "M");   // 苔
    set(14, 4, "Y"); set(15, 4, "Y"); set(18, 4, "Y"); set(19, 4, "Y");   // 眼睛（發光的縫）
    for (const [x, y] of [[10, 11], [11, 12], [22, 17], [23, 18], [3, 20], [30, 22]]) set(x, y, "D");   // 裂紋
  }, { S: ["#3a3240", "#5a4e5e", "#7e7080", "#a89aa4", "#d0c6c8"], A: ["#3e2414", "#6e4224", "#b07240", "#e8b478", "#e8b478"], C: ["#7a2e10", "#d0601c", "#ffa040", "#ffd27a", "#fff2a8"], M: ["#1e5a34", "#3a9a48", "#3a9a48", "#8ae070", "#8ae070"] },
  { Y: "#ffd84a", D: "#3a3240" });
}

// ---- 蘑菇老闆娘：大紅蓋子（米色斑點）、頭頂兩顆小蘑菇、臉在柄上、白圍裙、手上一杯熱飲
function mushroom() {
  const W = 31, H = 33, cx = 15;
  return sprite(W, H, (set) => {
    // 頭頂的小蘑菇
    for (const [x0, y0] of [[9, 1], [19, 2]]) { for (let x = x0 + 1; x < x0 + 3; x++) set(x, y0 - 1, "R"); for (let x = x0; x < x0 + 4; x++) set(x, y0, "R"); set(x0 + 1, y0 + 1, "Y"); set(x0 + 2, y0 + 1, "Y"); set(x0 + 1, y0 + 2, "Y"); set(x0 + 2, y0 + 2, "Y"); }
    // 大蓋子
    halfRows([6, 9, 11, 13, 14, 15, 15, 16, 16, 16], cx)((x, y, v) => set(x, y + 4, v), "R");
    for (let x = cx - 14; x <= cx + 14; x++) set(x, 14, "U");   // 菌褶（蓋子下緣）
    for (const [x, y] of [[cx - 7, 7], [cx - 6, 7], [cx - 7, 8], [cx + 4, 6], [cx + 5, 6], [cx + 9, 10], [cx + 10, 10], [cx - 11, 11], [cx - 1, 9], [cx, 9]]) set(x, y, "P");   // 斑點
    // 柄＝身體
    halfRows([7, 8, 8, 8, 8, 8, 8, 9, 9, 9, 9, 9, 9, 10, 10, 10], cx)((x, y, v) => set(x, y + 15, v), "Y");
    set(cx - 3, 18, "E"); set(cx - 3, 19, "E"); set(cx + 3, 18, "E"); set(cx + 3, 19, "E");   // 眼睛
    set(cx - 5, 20, "K"); set(cx + 5, 20, "K");                                             // 腮紅
    set(cx - 1, 21, "E"); set(cx, 22, "E"); set(cx + 1, 21, "E");                           // 笑
    for (let y = 24; y <= 30; y++) for (let x = cx - 6; x <= cx + 6; x++) if (y > 24 || Math.abs(x - cx) < 5) set(x, y, "A");   // 圍裙
    for (let x = cx - 2; x <= cx + 2; x++) set(x, 27, "B");                                  // 圍裙口袋
    // 熱飲（右手）
    for (let y = 22; y <= 25; y++) for (let x = cx + 10; x <= cx + 13; x++) set(x, y, "M");
    set(cx + 14, 23, "M"); set(cx + 14, 24, "M");
    for (let y = 31; y <= 32; y++) for (const x0 of [cx - 7, cx + 3]) for (let x = x0; x < x0 + 5; x++) set(x, y, "F");   // 腳
  }, { R: ["#6a1424", "#a02234", "#d03a44", "#ff6a50", "#ff9a8a"], Y: ["#8a7a5a", "#c8b890", "#f4ecd0", "#fffaf0", "#fffaf0"], A: ["#8a90a8", "#c8ccdc", "#eef0f8", "#ffffff", "#ffffff"], M: ["#6e4224", "#b07240", "#e8b478", "#f4d4a0", "#f4d4a0"], F: ["#3e2414", "#6e4224", "#8e5a34", "#b07240", "#b07240"] },
  { P: "#f4ecd0", U: "#8a5a5a", E: "#2a1626", K: "#ff9a8a", B: "#c8ccdc" });
}

// ---- 輸出 NPC 表
const npcs = [["史萊姆櫃檯", slimeClerk()], ["石頭魔像", golem()], ["蘑菇老闆娘", mushroom()]];
npcs.forEach(([n, s]) => lint(n, s));
const K = 6, cw = 38 * K, ch = 40 * K;
{
  const Wt = cw * 3, Ht = ch + 40 * 2 + 20;
  const img = new Uint8Array(Wt * Ht * 4);
  const fill = (x0, y0, w, h, c) => { const [r, g, b] = hex(c); for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const i = (y * Wt + x) * 4; img[i] = r; img[i + 1] = g; img[i + 2] = b; img[i + 3] = 255; } };
  fill(0, 0, Wt, Ht, "#262036");
  npcs.forEach(([, s], n) => {
    const ox = n * cw + (cw - s.W * K) / 2, oy = ch - s.H * K - 6;
    s.px.forEach((row, y) => row.forEach((c, x) => c && fill(ox + x * K, oy + y * K, K, K, c)));
    // 遊戲大小（2 倍）
    const gx = n * cw + cw / 2 - s.W, gy = Ht - 20 - s.H * 2;
    s.px.forEach((row, y) => row.forEach((c, x) => c && fill(gx + x * 2, gy + y * 2, 2, 2, c)));
  });
  fill(0, Ht - 20, Wt, 20, "#3a2e3e");
  writeFileSync(process.argv[2], encodePNG(Wt, Ht, img));
  console.log("wrote", process.argv[2]);
}

// ---- 城鎮構圖（384×216，放大 3 倍）：黃昏、隕石坑邊緣、三棟建築、路燈、NPC 站在門口
{
  const SW = 384, SH = 216, K3 = 3, img = new Float32Array(SW * SH * 3);
  const put = (x, y, c, a = 1) => { if (x < 0 || y < 0 || x >= SW || y >= SH) return; const i = (y * SW + x) * 3, [r, g, b] = hex(c); img[i] = img[i] * (1 - a) + r * a; img[i + 1] = img[i + 1] * (1 - a) + g * a; img[i + 2] = img[i + 2] * (1 - a) + b * a; };
  const add = (x, y, c, k) => { if (x < 0 || y < 0 || x >= SW || y >= SH) return; const i = (y * SW + x) * 3, [r, g, b] = hex(c); img[i] += r * k; img[i + 1] += g * k; img[i + 2] += b * k; };
  const rect = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(x, y, c); };
  const glow = (cx, cy, R, c, k) => { for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) { const f = 1 - Math.hypot(x, y) / R; if (f > 0) add(cx + x, cy + y, c, f * f * k); } };
  // 天空：黃昏色帶（分階）
  const SKY = ["#2a2050", "#3a2a60", "#5a3a70", "#8a4a70", "#c06a6a", "#e8946a"];
  for (let y = 0; y < 120; y++) rect(0, y, SW - 1, y, SKY[Math.min(5, Math.floor(y / 20))]);
  // 遠景：隕石坑的邊緣＋坑中央的大星星碎片（發光）
  for (let x = 0; x < SW; x++) { const h = 96 + Math.round(Math.sin(x / 40) * 6 + Math.sin(x / 13) * 2); rect(x, h, x, 140, "#3a2a50"); }
  for (let y = 60; y < 110; y++) { const w = Math.round((y - 60) * 0.45); rect(300 - w, y, 300 + w, y, y < 80 ? "#ffe27a" : y < 95 ? "#f0b424" : "#c48412"); }
  glow(300, 82, 46, "#ffd27a", 0.5);
  for (let x = 0; x < SW; x++) { const h = 118 + Math.round(Math.sin(x / 25 + 1) * 4); rect(x, h, x, 150, "#2a2040"); }
  rect(0, 140, SW - 1, 175, "#221a34");
  // 地面：石板路
  rect(0, 176, SW - 1, 215, "#3a3448");
  for (let x = 0; x < SW; x += 12) for (let y = 178; y < 216; y += 8) rect(x + ((y / 8) % 2) * 6, y, x + ((y / 8) % 2) * 6 + 10, y + 6, "#4a4258");
  rect(0, 176, SW - 1, 177, "#6a6078");
  // 建築：冷色牆＋暖色窗
  const house = (x0, x1, top, wall, roof, roofHi) => {
    rect(x0, top, x1, 175, wall);
    for (let y = 0; y < 14; y++) rect(x0 - 6 + y, top - 14 + y, x1 + 6 - y, top - 14 + y, y < 2 ? roofHi : roof);
    rect(x0, top, x1, top + 1, "#1e1830");
  };
  const win = (x, y, w, h) => { rect(x - 1, y - 1, x + w, y + h, "#2a1e2a"); rect(x, y, x + w - 1, y + h - 1, "#ffc864"); rect(x, y, x + w - 1, y, "#fff0b0"); rect(x + (w >> 1), y, x + (w >> 1), y + h - 1, "#a06030"); glow(x + w / 2, y + h / 2, 22, "#ffa040", 0.35); };
  const door = (x, w) => { rect(x - 1, 150, x + w, 175, "#2a1e2a"); rect(x, 151, x + w - 1, 175, "#6e4224"); rect(x, 151, x + 1, 175, "#8e5a34"); };
  // 公會（最大，石牆藍灰、旗子）
  house(20, 140, 100, "#4a5470", "#2a3a6a", "#4a6aa8");
  for (let x = 24; x < 140; x += 8) rect(x, 100, x, 175, "#424a64");
  win(30, 118, 14, 16); win(112, 118, 14, 16); door(70, 22);
  rect(60, 70, 61, 100, "#3a3040"); rect(62, 72, 76, 84, "#c03a44"); rect(66, 76, 70, 80, "#ffd84a");   // 旗子（星星徽章）
  // 工坊（煙囱、鐵砧招牌、爐火）
  house(170, 250, 120, "#5a4e5e", "#4a2e2a", "#7a4a3a");
  rect(232, 90, 242, 108, "#4a3e4e"); for (let i = 0; i < 4; i++) glow(238 + i * 3, 82 - i * 9, 6 + i, "#b0a8b8", 0.25);
  win(180, 134, 18, 12); door(214, 18); glow(223, 165, 26, "#ff7a30", 0.45);
  rect(196, 150, 208, 154, "#7e86a8"); rect(199, 155, 205, 158, "#474d6b");   // 鐵砧招牌
  // 旅館（木頭、兩排窗、掛著杯子招牌）
  house(275, 370, 104, "#6e4a3a", "#3a2a5a", "#5a4a8a");
  for (let y = 108; y < 176; y += 6) rect(275, y, 370, y, "#5e3e30");
  win(285, 116, 12, 12); win(346, 116, 12, 12); win(285, 140, 12, 12); door(318, 20);
  rect(300, 136, 312, 146, "#e8b478"); rect(302, 138, 310, 144, "#ffffff");   // 杯子招牌
  // 路燈
  for (const x of [155, 262]) { rect(x, 140, x + 1, 175, "#2a2440"); rect(x - 2, 134, x + 3, 140, "#ffd27a"); glow(x, 137, 30, "#ffb050", 0.6); }
  // NPC 站在門口＋主角
  const stamp = (s, x, y) => s.px.forEach((row, j) => row.forEach((c, i) => c && put(x + i, y + j, c)));
  stamp(npcs[0][1], 65, 175 - npcs[0][1].H + 1);
  stamp(npcs[1][1], 192, 175 - npcs[1][1].H + 1);
  stamp(npcs[2][1], 330, 175 - npcs[2][1].H + 1);
  const out = new Uint8Array(SW * K3 * SH * K3 * 4);
  for (let y = 0; y < SH * K3; y++) for (let x = 0; x < SW * K3; x++) { const i = ((y / K3 | 0) * SW + (x / K3 | 0)) * 3, d = (y * SW * K3 + x) * 4; out[d] = Math.min(255, img[i]); out[d + 1] = Math.min(255, img[i + 1]); out[d + 2] = Math.min(255, img[i + 2]); out[d + 3] = 255; }
  writeFileSync(process.argv[3], encodePNG(SW * K3, SH * K3, out));
  console.log("wrote", process.argv[3]);
}
