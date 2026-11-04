// 第一章王＋碎星鎮路人的草稿（M7）。
//   node game/tools/drafts/boss-drafts.mjs boss.png folk.png
// 生物都照規則v2：剪影優先、1px 外框、硬邊、光從左上、精簡色盤、待機只做一個主要動作。
// 參考（docs/素材參考.md「第一章王」「碎星鎮路人」）：
//   大胃王史萊姆：King Slime 類的王（圓頂大身體＋王冠＝一眼看出是王）、企劃書 8.3（吃垃圾長大、身上卡著垃圾和一塊發光碎片）；
//     半透明的身體裡看得到吞進去的垃圾（輪胎、鐵罐、魚骨），一塊木板從身體裡戳出來，頭上歪戴一個鐵罐蓋當王冠。
//   路人：16～24px 的小型居民（RPG Monster Pack、Pixel Mons 的比例），每個都有一個一眼認得的道具。
import { writeFileSync } from "node:fs";
import { encodePNG } from "../../../pixelfx/tools/lib/png.mjs";

const hex = (s) => [1, 3, 5].map((k) => parseInt(s.slice(k, k + 2), 16));
const OUT = "#1a0e16";

function sprite(W, H, paint, ramps, fixed = {}) {
  const m = Array.from({ length: H }, () => Array(W).fill(null));
  const set = (x, y, v) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H) m[y][x] = v; };
  const get = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? m[y][x] : null);
  paint(set, get);
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
    if (t === 2 && (diff(x + 2, y, k) || diff(x, y + 2, k))) t = 1;
    if (t === 3 && diff(x - 1, y - 1, k) && diff(x - 1, y, k) && diff(x, y - 1, k)) t = 4;
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

// ================= 大胃王史萊姆 =================
// pose：idle（f 0～7 身體上下彈）、stretch（跳起來拉長）、squash（壓地）、spit（吸飽氣、嘴張大）
const BODY = ["#0c2410", "#1c4618", "#36761f", "#5ea42c", "#94d046", "#d2f08a"];
const DEEP = ["#0a1c0c", "#143414", "#22521c", "#3c7a26", "#3c7a26"];
const TIN = ["#1e2430", "#3a4656", "#5e6e82", "#8c9cb0", "#c8d4e0"];
const RUST = ["#3a1a0c", "#6a3216", "#9a5024", "#c87a3c", "#e8a466"];
const WOOD = ["#2a1608", "#4e2e14", "#7a4a22", "#a86c36", "#d09a5a"];
const RUBBER = ["#0e0c12", "#1c1a22", "#2c2a36", "#44404e", "#5a5666"];
function boss(pose = "idle", f = 0) {
  const W = 70, H = 56, cx = 34;
  const sq = { idle: [1, 1.015, 1.03, 1.015, 1, 0.985, 0.97, 0.985][f], stretch: 1.22, squash: 0.72, spit: 1.06 }[pose];
  const hgt = Math.round(44 * sq), half = Math.round(31 / Math.sqrt(sq)) + (pose === "spit" ? 3 : 0), bot = H - 1, top = bot - hgt;
  const hw = (y) => { const t = (bot - y) / hgt; if (t > 1) return -1; const u = Math.max(0, t - 0.18) / 0.82; return Math.round(half * Math.sqrt(Math.max(0, 1 - u * u)) * (t < 0.08 ? 0.92 + t : 1)); };
  return sprite(W, H, (set, get) => {
    for (let y = top; y <= bot; y++) { const w = hw(y); for (let x = cx - w; x <= cx + w; x++) set(x, y, "B"); }
    // 身體裡比較深的地方（半透明：看得到裡面的垃圾）
    { const ey0 = bot - hgt * 0.28, ry = hgt * 0.3, rx = half - 7;   // 肚子：橢圓形的深色區（不要變成方框）
      for (let y = Math.floor(ey0 - ry); y <= bot - 3; y++) for (let x = cx - rx; x <= cx + rx; x++) if (((x - cx) / rx) ** 2 + ((y - ey0) / ry) ** 2 <= 1) set(x, y, "D"); }
    const Y = (k) => Math.round(bot - hgt * k);   // 身體高度的比例 → y
    // 吞進去的垃圾：輪胎（左下）、鐵罐（右下）、魚骨（中間）
    for (let y = -5; y <= 5; y++) for (let x = -6; x <= 6; x++) { const d = Math.hypot(x, y * 1.15); if (d <= 6 && d >= 3.2) set(cx - 14 + x, Y(0.2) + y, "T"); }
    for (let y = 0; y < 9; y++) for (let x = 0; x < 6; x++) set(cx + 10 + x, Y(0.26) + y - 4, y === 3 ? "R" : "N");
    for (let x = -6; x <= 5; x++) set(cx + x - 1, Y(0.4), "F");
    for (const x of [-4, -1, 2]) { set(cx + x - 1, Y(0.4) - 1, "F"); set(cx + x - 1, Y(0.4) + 1, "F"); }
    set(cx + 6, Y(0.4) - 1, "F"); set(cx + 6, Y(0.4) + 1, "F"); set(cx + 7, Y(0.4), "F");
    // 從身體右邊戳出來的木板（斜的，超出外框）
    for (let i = 0; i < 16; i++) for (let j = 0; j < 3; j++) set(cx + 18 + i, Y(0.55) - Math.round(i * 0.45) + j, "W");
    // 臉：生氣的眼睛（白底、紅瞳孔、粗眉毛往中間壓）
    const ey = Y(0.68);
    for (const s of [-1, 1]) {
      const ex = cx + s * 9;
      for (let y = -2; y <= 2; y++) for (let x = -3; x <= 3; x++) if (Math.abs(x) + Math.abs(y) < 5 && !(y === -2 && Math.abs(x) === 3)) set(ex + x, ey + y, "E");
      set(ex + s * -1, ey, "P"); set(ex + s * -1, ey + 1, "P"); set(ex, ey, "P"); set(ex, ey + 1, "P");
      // 粗眉毛：2px，從外側往中間往下壓（生氣）
      for (let i = 0; i < 8; i++) { const x = ex + s * (4 - i), y = ey - 6 + Math.floor(i / 2.6); set(x, y, "K"); set(x, y + 1, "K"); }
    }
    // 大嘴巴：寬寬的月牙，上面三顆尖牙；吐的時候張大
    const my = Y(0.48), mw = pose === "spit" ? 12 : 10, mh = pose === "spit" ? 7 : 3;
    for (let x = -mw; x <= mw; x++) { const d = Math.round(mh * Math.sqrt(1 - (x / (mw + 1)) ** 2)); for (let y = 0; y <= d; y++) set(cx + x, my + y, "M"); }
    for (const tx of [-6, 0, 6]) { set(cx + tx, my, "Z"); set(cx + tx + 1, my, "Z"); set(cx + tx, my + 1, "Z"); }
    if (pose !== "spit") { set(cx + 8, my + 3, "L"); set(cx + 8, my + 4, "L"); set(cx + 8, my + 5 + (f % 4 > 1 ? 1 : 0), "L"); }   // 口水
    if (pose === "spit") for (let y = 2; y <= 5; y++) for (let x = -5; x <= 5; x++) if (Math.abs(x) < 6 - y) set(cx + x, my + y + 1, "O");   // 嘴裡的火光
    // 頭上歪戴的鐵罐蓋（王冠），側邊卡著一塊發光的星星碎片
    // 王冠：鐵罐蓋折成的三尖王冠，歪歪地戴在頭頂（往右歪）
    const cy0 = top + 2, crown = ["..#.....#.....#..", ".###...###...###.", ".####.#####.####.", "#################", "#################", "#################"];
    crown.forEach((row, j) => [...row].forEach((v, i) => { if (v === "#") set(cx - 8 + i, cy0 - crown.length + j + Math.round((i - 8) * 0.12), j >= 4 && i % 5 === 2 ? "R" : "C"); }));
    // 發光的星星碎片：卡在身體左上，一半露在外面
    const sx = cx - half + 6, sy = Y(0.62);
    ["...#", "..##", ".###", "####", ".###", "..##", "..#."].forEach((row, j) => [...row].forEach((v, i) => { if (v === "#") set(sx - 3 + i, sy - 3 + j, i < 2 && j < 4 ? "s" : "S"); }));
    // 高光：左上大片的白色反光
    for (const [x, y] of [[-18, 0.86], [-17, 0.86], [-19, 0.82], [-20, 0.78], [-20, 0.74], [-15, 0.9]]) set(cx + x, Y(y), "H");
  }, { B: BODY, D: DEEP, T: RUBBER, N: TIN, R: RUST, W: WOOD, C: TIN, F: ["#8a8070", "#b0a890", "#d8d0b8", "#f0ead8", "#ffffff"] },
  { E: "#f4f0e0", P: "#c81e1e", K: "#14081a", M: "#2a0a14", Z: "#f4ecd8", L: "#a8e070", O: "#ff8a2a", S: "#ffd84a", s: "#fff6c0", H: "#f0ffd8" });
}

// ================= 碎星鎮路人 =================
// 1. 小藍史萊姆（公會波波的弟弟）：跳著走，頭上綁一個小蝴蝶結
function kid(f) {
  const W = 15, H = 13, cx = 7, h = [0, 1, 2, 1][f], sq = [1, 1, 0.9, 1][f];
  return sprite(W, H, (set) => {
    const hgt = Math.round(9 * sq), bot = H - 1 - h, w0 = Math.round(6 / Math.sqrt(sq));
    for (let y = bot - hgt; y <= bot; y++) { const t = (bot - y) / hgt, w = Math.round(w0 * Math.sqrt(Math.max(0, 1 - Math.max(0, t - 0.2) ** 2 / 0.64))); for (let x = cx - w; x <= cx + w; x++) set(x, y, "B"); }
    const ey = bot - Math.round(hgt * 0.5);
    set(cx - 2, ey, "E"); set(cx + 2, ey, "E"); set(cx, ey + 2, "E");
    for (const [x, y] of [[-1, 0], [-2, -1], [-2, 1], [1, 0], [2, -1], [2, 1], [0, 0]]) set(cx + 3 + x, bot - hgt - 1 + y, "R");
    set(cx - 4, ey - 2, "H");
  }, { B: ["#173064", "#244c96", "#3474c8", "#5aa2ec", "#9ad0ff"], R: ["#6a1424", "#a02234", "#d03a44", "#ff6a60", "#ff9a8a"] }, { E: "#1a1030", H: "#ffffff" });
}
// 2. 苔殼龜郵差：殼上長苔、背著郵差包、戴小帽，慢慢走
function turtle(f) {
  const W = 23, H = 17, step = [0, 1, 0, 1][f], bob = [0, 0, 1, 0][f];
  return sprite(W, H, (set) => {
    // 殼：高高的半圓頂，上面有六角格紋和苔蘚
    for (let y = 1; y <= 11; y++) { const w = Math.round(7.5 * Math.sqrt(1 - ((11 - y) / 10.5) ** 2)); for (let x = 9 - w; x <= 9 + w; x++) set(x, y + bob, "S"); }
    for (const [x, y] of [[6, 5], [7, 5], [11, 5], [12, 5], [5, 8], [9, 7], [13, 8], [8, 9], [10, 9]]) set(x, y + bob, "L");
    for (const [x, y] of [[6, 1], [7, 1], [8, 0], [9, 1], [10, 2], [11, 1], [5, 2], [12, 2]]) set(x, y + bob, "M");
    for (let x = 1; x <= 17; x++) set(x, 12 + bob, "U");
    // 郵差包＋背帶
    for (let y = 7; y <= 11; y++) for (let x = 0; x <= 4; x++) set(x, y + bob, "G");
    set(2, 8 + bob, "g");
    for (let i = 0; i < 9; i++) set(4 + i, 7 - Math.round(i * 0.6) + bob, "g");
    // 頭（右邊，比較大）＋郵差帽
    for (let y = 5; y <= 11; y++) for (let x = 16; x <= 22; x++) { const d = Math.hypot(x - 19, (y - 8) * 1.1); if (d <= 3.4) set(x, y + bob, "K"); }
    set(20, 7 + bob, "E"); set(21, 9 + bob, "k");
    for (let x = 16; x <= 21; x++) set(x, 4 + bob, "C");
    for (let x = 17; x <= 20; x++) set(x, 3 + bob, "C");
    set(22, 5 + bob, "C"); set(21, 5 + bob, "C");
    // 短短的腳（前後交替踩）
    for (const [lx, up] of [[3, step], [13, 1 - step]]) for (let y = 13; y <= 15 - up; y++) for (let x = lx; x <= lx + 2; x++) set(x, y + (up ? 0 : 0) + bob * 0, "K");
  }, { S: ["#3a3418", "#5a5224", "#7a7030", "#9c9044", "#c4b868"], L: ["#2a2810", "#3a3418", "#4a4420", "#4a4420", "#4a4420"], M: ["#1a3a1e", "#2a5a2c", "#3a7a38", "#5cb05a", "#86d488"], U: ["#3a2a16", "#5a4024", "#7a5832", "#9a7244", "#9a7244"], K: ["#2e5a36", "#4a8a50", "#6aae66", "#94d084", "#c0ecaa"], G: ["#4a2a14", "#7a4a22", "#a86c36", "#d09a5a", "#ecc890"], C: ["#1a2a5a", "#2a4490", "#3a62c0", "#5a8ae0", "#8ab4f4"] }, { E: "#1a1030", k: "#2a5a30", g: "#5a3416" });
}
// 3. 小石頭（岩叔的學徒）：圓圓的石頭身體、胸口一點小火光、抱著一顆小石子，搖搖擺擺
function pebble(f) {
  const W = 14, H = 16, sway = [0, 1, 0, -1][f];
  return sprite(W, H, (set) => {
    for (let y = 1; y <= 11; y++) { const w = Math.round(5.5 * Math.sqrt(1 - ((6 - y) / 6) ** 2)); for (let x = 6 - w + sway; x <= 6 + w + sway; x++) set(x, y, "S"); }
    set(4 + sway, 5, "E"); set(8 + sway, 5, "E");
    set(6 + sway, 8, "Y"); set(6 + sway, 9, "Y"); set(7 + sway, 8, "Y");
    for (let y = 9; y <= 11; y++) for (let x = 9; x <= 11; x++) if (!(y === 9 && x === 11)) set(x + sway, y, "R");
    for (const [x, y] of [[3, 2], [4, 2], [5, 1], [8, 2]]) set(x + sway, y, "M");
    set(4, 12 + (f === 1 ? 0 : 1), "S"); set(4, 13, "S"); set(8, 12 + (f === 3 ? 0 : 1), "S"); set(8, 13, "S");
  }, { S: ["#3a3240", "#5a4e5e", "#7e7080", "#a89aa4", "#d0c6c8"], R: ["#3a3a46", "#565666", "#787888", "#9a9aac", "#9a9aac"], M: ["#1e5a34", "#3a9a48", "#3a9a48", "#8ae070", "#8ae070"] }, { E: "#ffd84a", Y: "#ff8a2a" });
}
// 4. 菇菇寶寶（菇媽家的小孩）：兩顆小蘑菇一前一後跑，後面那顆慢一格
function shroom(f, lag = 0) {
  const W = 11, H = 13, b = [0, 1, 0, 1][(f + lag) % 4];
  return sprite(W, H, (set) => {
    for (let y = 0; y <= 4; y++) { const w = [2, 4, 5, 5, 5][y]; for (let x = 5 - w; x <= 5 + w; x++) set(x, y + b, "R"); }
    set(3, 1 + b, "P"); set(4, 1 + b, "P"); set(7, 2 + b, "P");
    for (let y = 5; y <= 9; y++) for (let x = 3; x <= 7; x++) set(x, y + b, "Y");
    set(4, 6 + b, "E"); set(6, 6 + b, "E");
    set(3 + (f % 2), 10 + b, "Y"); set(7 - (f % 2), 10 + b, "Y");
  }, { R: ["#6a1424", "#a02234", "#d03a44", "#ff6a50", "#ff9a8a"], Y: ["#8a7a5a", "#c8b890", "#f4ecd0", "#fffaf0", "#fffaf0"] }, { P: "#f4ecd0", E: "#2a1626" });
}

// ---- 排版：放大、深色底、每格之間留白
function sheet(items, k, bg = "#1c1a2a") {
  const pad = 6, rows = items.map((r) => r.map((s) => s));
  const cw = Math.max(...items.flat().map((s) => s.W)) + pad, ch = Math.max(...items.flat().map((s) => s.H)) + pad;
  const cols = Math.max(...rows.map((r) => r.length));
  const W = cols * cw + pad, H = rows.length * ch + pad, img = new Uint8Array(W * k * H * k * 4), B = hex(bg);
  for (let i = 0; i < W * k * H * k; i++) { img.set(B, i * 4); img[i * 4 + 3] = 255; }
  rows.forEach((row, r) => row.forEach((s, c) => {
    const ox = pad + c * cw + ((cw - pad - s.W) >> 1), oy = pad + r * ch + (ch - pad - s.H);
    for (let y = 0; y < s.H; y++) for (let x = 0; x < s.W; x++) {
      const col = s.px[y][x]; if (!col) continue;
      const rgb = hex(col);
      for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) { const i = ((oy + y) * k + b) * W * k + (ox + x) * k + a; img.set(rgb, i * 4); img[i * 4 + 3] = 255; }
    }
  }));
  return encodePNG(W * k, H * k, img);
}

const [bossOut = "boss.png", folkOut = "folk.png"] = process.argv.slice(2);
writeFileSync(bossOut, sheet([[boss("idle", 0), boss("idle", 2), boss("idle", 6)], [boss("stretch"), boss("squash"), boss("spit")]], 4));
writeFileSync(folkOut, sheet([[0, 1, 2, 3].map(kid), [0, 1, 2, 3].map(turtle), [0, 1, 2, 3].map(pebble), [0, 1, 2, 3].map((f) => shroom(f)), [0, 1, 2, 3].map((f) => shroom(f, 1))], 6));
console.log("ok");
