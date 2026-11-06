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
// ---------- 特效補強 8：裂牆被撞破——牆上的每一塊垃圾各自變成一塊碎片，往衝撞的方向噴飛、落地彈一下、網點淡出 ----------
// 參考（只學做法）：pixelfx impacts/ground-slam、spawn/shatter-death 的碎片翻滾落地；碎片保留牆上那一塊的材質顏色
/** 撞破的瞬間產生碎片：(x, y)＝牆底部中心、H＝牆高、dir＝衝撞的方向 */
export function crackDebris(x, y, H = 48, dir = 1) {
  const W = 32, x0 = x - W / 2, y0 = y - H, out = [];
  for (let row = 0; row < Math.ceil(H / 8); row++) {
    const off = row % 2 ? 5 : 0;
    for (let bx = 0; bx <= 3; bx++) {
      const l = Math.max(0, bx * 10 - off), r = Math.min(W, bx * 10 + 10 - off);
      if (r - l < 3) continue;
      const M = JUNK[Math.floor(hash(bx, row, 3) * JUNK.length)], k = hash(bx, row, 9);
      const cx = x0 + (l + r) / 2, cy = y0 + row * 8 + 4, up = 1 - row / (H / 8);   // 上面的飛得高、下面的滾得遠
      // 第 2 輪：原本整面牆像格子網慢慢散開、又往上飛出畫面 → 一開始就錯開位置、速度差異拉大，靠衝撞那側飛得最快、主要往前噴
      const near = dir > 0 ? (cx - x0) / W : 1 - (cx - x0) / W, j1 = hash(bx, row, 12) - 0.5, j2 = hash(bx, row, 13) - 0.5;
      out.push({ x: cx + j1 * 4, y: cy + j2 * 3, w: r - l - 1, h: 7, M, vx: dir * (70 + near * 170 + k * 150) * (hash(bx, row, 14) < 0.15 ? -0.35 : 1) + j1 * 90, vy: -40 - up * 120 - k * 70 + j2 * 70,   /* 第 3 輪：前兩格還看得出格子 → 初速加大、差異拉大、少數往後彈 */ floor: y, life: 1.2 + k * 0.5, age: 0, bounced: 0, spin: k });
    }
  }
  return out;
}
export function updateDebris(list, dt) {
  for (const d of list) {
    d.age += dt; d.vy += 700 * dt; d.x += d.vx * dt; d.y += d.vy * dt;
    if (d.y > d.floor - 2 && d.vy > 0) { d.y = d.floor - 2; d.vy *= -0.3; d.vx *= 0.5; d.bounced++; if (d.bounced > 2) { d.vy = 0; d.vx *= 0.6; } }
  }
}
/** 碎片：越飛越小（翻滾的感覺）、落地之後最後 0.4 秒用網點淡出 */
const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export function drawDebris(frame, list) {
  for (const d of list) {
    if (d.age > d.life) continue;
    const fade = Math.min(1, (d.life - d.age) / 0.4), shrink = d.bounced ? 0.75 : 1 - Math.min(0.25, d.age * 0.5);   // 第 2 輪：原本一下就縮成小點
    const w = Math.max(2, Math.round(d.w * shrink * (0.7 + 0.3 * Math.abs(Math.cos(d.age * 9 + d.spin * 6))))), h = Math.max(2, Math.round(d.h * shrink));
    const x0 = Math.round(d.x - w / 2), y0 = Math.round(d.y - h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const X = x0 + i, Y = y0 + j;
      if (fade < 1 && fade * 16 <= BAY[((Y & 3) << 2) | (X & 3)]) continue;
      const edge = i === 0 || j === 0 || i === w - 1 || j === h - 1;
      put(frame, X, Y, edge ? OUT : j === 1 || i === 1 ? d.M[2] : j === h - 2 ? d.M[0] : d.M[1]);
    }
  }
}

// ---------- 特效補強 11：王出場時，屋頂的破洞被一團垃圾塞住（從上面砸下來），底下滴著王的黏液 ----------
// (x, y, w, h)＝破洞（實心的範圍），t＝塞住之後過了幾秒（0～0.3 從上面掉下來）
const GOO_D = ["#1a4a20", "#2a8a3a", "#4cc04a", "#8ee86a"].map(P);
export function drawPlug(frame, x, y, w, h, t) {
  const drop = Math.max(0, 1 - t / 0.3), oy = -Math.round(70 * drop * drop);
  // 第 2 輪：原本像一塊砌好的磚牆 → 上緣隆起一坨（凸出屋頂 6～10 格）、垃圾塊大小不一、圓角錯開，混木箱 X 和輪胎；底面一層黏液
  for (let i = -3; i < w + 3; i++) {
    const gooH = 1 + Math.round(hash(Math.floor((i + 3) / 3), 71) * 2);   // 第 3 輪：黏液層厚度 1～3 不等（原本一條直線）
    const u = (i + 3) / (w + 6), top = -Math.round(10 * Math.sin(u * Math.PI) ** 0.6 + hash(Math.floor(i / 4), 51) * 3) + (i < 0 || i >= w ? 6 : 0);
    for (let j = top; j < h + gooH; j++) {
      // 不規則的塊：每層高 5～9、每塊寬 7～15、上下錯開 0～2
      let by = top, band = 0, bh = 6;
      while (true) { bh = 6 + Math.floor(hash(band, 61) * 5); if (j < by + bh) break; by += bh; band++; }   // 第 3 輪：塊放大一點（原本太碎太雜）
      const off = Math.floor(hash(band, 62) * 11);
      let bx = -3 - off, k = 0, bw = 0; while (true) { bw = 9 + Math.floor(hash(band, k, 63) * 10); if (i < bx + bw) break; bx += bw; k++; }
      const lx = i - bx, ly = j - by, id = band * 37 + k, kind = hash(id, 64), M = JUNK[Math.floor(hash(id, 65) * JUNK.length)];
      const gap = lx === bw - 1 || ly === bh - 1 || ((lx === 0 || lx === bw - 2) && (ly === 0 || ly === bh - 2));
      let c = gap ? OUT : ly === 0 ? M[2] : lx >= bw - 3 || ly >= bh - 2 ? M[0] : M[1];
      if (!gap && kind < 0.2 && (lx === ly || lx === bw - 2 - ly)) c = JUNK[2][0];   // 木箱的 X
      if (!gap && kind > 0.9) { const d = Math.hypot(lx - (bw - 2) / 2, (ly - (bh - 2) / 2) * 1.4); c = d < 1.3 ? OUT : d < 2.4 ? JUNK[1][0] : JUNK[3][1]; }   // 輪胎
      if (j >= h - 1) c = j === h - 1 ? GOO_D[3] : j === h ? GOO_D[2] : GOO_D[1];   // 底面的黏液
      put(frame, x + i, y + j + oy, c);
    }
  }
  // 落定之後：底面滴下黏液（2 格寬，慢慢往下拉長、尖端一顆亮點）
  if (t > 0.3) for (let q = 0; q < 5; q++) {
    const dx = Math.round((q + 0.5) * w / 5 + (hash(q, 41) - 0.5) * 6), len = 2 + Math.round(((t * (0.6 + hash(q, 42)) + hash(q, 43)) % 1.6) * 6);
    for (let k = 0; k < len; k++) { put(frame, x + dx, y + h + 2 + k, k === len - 1 ? GOO_D[3] : GOO_D[2]); if (k < len - 2) put(frame, x + dx + 1, y + h + 2 + k, GOO_D[1]); }
  }
}

// 使用者 2026-11-06「上升氣流再明顯一點」：多一層淡淡的青色光柱（只進光層，下面亮上面淡）、兩側一條閃動的氣流邊、
//   一個個往上飄的「︿」箭頭、出風口一排亮起來的光
const lit = (frame, x, y, c) => { x = Math.round(x) - frame.ox; y = Math.round(y) - frame.oy; if (x >= 0 && y >= 0 && x < frame.w && y < frame.h && !frame.light[y * frame.w + x]) frame.light[y * frame.w + x] = c; };
const WIND_LIT = [0x200e0904, 0x28140c06, 0x301c1208, 0x3826180a];   // 光層：由淡到亮（AABBGGRR）；第 2 輪：原本太亮，整根變成一塊亮藍色方塊
export function drawWind(frame, x, y, w, h, t) {
  const x0 = Math.round(x - w / 2);
  // 光柱：從出風口往上越來越淡（4 階，網點交錯，不是平滑漸層）
  for (let j = 0; j < h; j++) {
    const f = 1 - j / h, lv = f > 0.8 ? 3 : f > 0.55 ? 2 : f > 0.3 ? 1 : 0;
    if (lv === 0 && (j & 1)) continue;
    // 中間亮、兩邊淡（越靠邊越稀的網點），不是一整塊
    for (let i = 1; i < w - 1; i++) {
      const e = Math.min(i, w - 1 - i) / (w / 2), l2 = Math.max(0, lv - (e < 0.25 ? 2 : e < 0.5 ? 1 : 0));
      if (((i + j) & 1) || (e > 0.6 && lv >= 2)) lit(frame, x0 + i, y - j, WIND_LIT[l2]);
    }
  }
  // 兩側的氣流邊：一段段亮線往上爬
  for (const ex of [x0, x0 + w - 1]) for (let j = 0; j < h; j++) {
    const ph = (j + t * 120 + (ex === x0 ? 0 : 17)) % 34;
    if (ph < 9) put(frame, ex + Math.round(Math.sin((j + t * 40) * 0.2)), y - j, ph < 3 ? WIND[3] : WIND[2], true);
  }
  // 往上飄的箭頭（︿），下面出來、上面淡掉
  for (let n = 0; n < Math.max(2, Math.round(h / 70)); n++) {
    const p = (t * 0.55 + n / Math.max(2, Math.round(h / 70))) % 1, cy = y - 10 - p * (h - 20), cx = x0 + w / 2 + Math.sin(p * 8 + n) * (w / 6);
    const c = p < 0.7 ? WIND[3] : WIND[2];
    for (let k = -4; k <= 4; k++) { put(frame, cx + k, cy + Math.abs(k), c, true); if (p < 0.5) put(frame, cx + k, cy + Math.abs(k) + 1, WIND[1], true); }
  }
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
    else put(frame, x0 + i, y - 1, Math.sin(t * 6 + i * 0.5) > 0 ? WIND[2] : WIND[1], true);   // 出風口亮光，一閃一閃
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

// ---------- 一次性資源（使用者 2026-11-06 重畫：原本太小、不明顯也不好看 → 都比主角大約 30%，各有自己的主色和一圈會動的光）
// 參考 pixelfx fire/brazier（殘火：石台＋火）、ice/ice-crystal（礦脈：晶面左亮右暗、白尖、閃光）、
//       pickups/chest-open（寶箱：縫隙漏金光）、arcane/rune-circle（碑文：符文亮起來）——只學做法。草稿：game/tools/drafts/features.mjs
const STONE = { a: P("#1e2236"), b: P("#2e3450"), c: P("#454e72"), d: P("#6a7498"), e: P("#9aa4c4") };
// 柔光：只寫在光層（不蓋顏色），越外面越淡（第 2 輪：原本用點狀抖色，一圈雜點蓋住細節）
const glowRing = (frame, cx, cy, r, c, k = 0.45) => {
  const cr = c & 255, cg = (c >>> 8) & 255, cb = (c >>> 16) & 255;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const d = Math.hypot(dx, dy); if (d > r) continue;
    const gx = Math.round(cx + dx) - frame.ox, gy = Math.round(cy + dy) - frame.oy;
    if (gx < 0 || gy < 0 || gx >= frame.w || gy >= frame.h) continue;
    const i = gy * frame.w + gx, f = (1 - d / r) ** 2 * k, o = frame.light[i];
    frame.light[i] = (0xff000000 | (Math.min(255, ((o >>> 16) & 255) + cb * f) << 16) | (Math.min(255, ((o >>> 8) & 255) + cg * f) << 8) | Math.min(255, (o & 255) + cr * f)) >>> 0;
  }
};

// ---------- 星之殘火：30 高。刻花的石台（碗＋柱＋底座）上浮著一團星形的火，火舌往上舔，火星往上飄
export function drawEmber(frame, x, y, t) {
  const F = [P("#6e2a0c"), P("#d8641a"), P("#f0b424"), P("#ffe066"), P("#fff6c4"), P("#ffffff"), P("#5ac8ff")];
  const ped = [
    ".eeeeeeeeeeeeeeee.",
    "edddddddddddddddcb",
    ".cccccccccccccccb.",
    "..bcccccccccccbb..",
    "...abbbbbbbbbba...",
    ".....bccccbbb.....",
    ".....bccccbbb.....",
    "...dcccccccccbb...",
    "..ddccccccccccbba.",
    "..aaaaaaaaaaaaaaa.",
  ];
  const px0 = Math.round(x - 9), py0 = Math.round(y - ped.length);
  // 碗裡的炭火（碗口那排）
  sprite(frame, ped, px0, py0, STONE);
  for (let i = 2; i < 16; i++) put(frame, px0 + i, py0 + 1, hash(i, Math.floor(t * 8)) < 0.5 ? F[1] : F[2], true);
  const cx = Math.round(x), cy = Math.round(py0 - 7 + Math.sin(t * 2.4) * 1.5);
  // 火舌（畫在星的後面）：5 條，中間最長，長度一直晃
  for (let k = -2; k <= 2; k++) {
    const len = 13 - Math.abs(k) * 3 + Math.round(Math.sin(t * 8 + k * 1.9) * 2);
    for (let j = 0; j < len; j++) {
      const f = j / len, sway = Math.round(Math.sin(t * 6 + j * 0.7 + k) * f * 1.8), fx = cx + k * 2 + sway, fy = cy - 4 - j;
      const c = f < 0.35 ? F[4] : f < 0.6 ? F[3] : f < 0.85 ? F[2] : F[1];
      put(frame, fx, fy, c, true);
      if (f < 0.5) put(frame, fx + (k <= 0 ? -1 : 1), fy, f < 0.25 ? F[3] : F[2], true);
    }
  }
  // 星形的芯：9×9 五角星（外框暗橘、金、白芯），底下一點藍根
  for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
    // 第 3 輪：星再大一點、外框一圈暗橘（原本被火舌蓋住看不出是星）
    const a = Math.atan2(dy, dx) + Math.PI / 2, d = Math.hypot(dx, dy), R = 2.4 + 3 * Math.max(0, Math.cos(a * 5)) ** 3;
    if (d > R + 0.9) continue;
    put(frame, cx + dx, cy + dy, d > R - 0.1 ? F[0] : d < 1.5 ? F[5] : d < 2.5 ? F[4] : F[3], d <= R - 0.1);
  }
  put(frame, cx - 1, cy + 5, F[6], true); put(frame, cx, cy + 6, F[6], true); put(frame, cx + 1, cy + 5, F[6], true);
  // 火星：往上飄、左右晃，越高越暗
  for (let k = 0; k < 5; k++) {
    const life = 1.4, p = ((t + k * 0.29) % life) / life, sx = cx + Math.round(Math.sin(p * 9 + k * 2) * 3 + (hash(k, Math.floor((t + k * 0.29) / life)) - 0.5) * 8), sy = cy - 6 - p * 20;
    put(frame, sx, sy, p < 0.4 ? F[4] : p < 0.75 ? F[2] : F[1], true);
  }
  glowRing(frame, cx, cy - 3, 11, F[2]);
}

// ---------- 星塵礦脈：28 高。一塊圓圓的岩石上斜插 5 根大水晶（左亮、中、右暗、白尖）；hits 0～2：岩石多一道裂縫、水晶少一根
export function drawVein(frame, x, y, hits = 0, t = 0) {
  const CR = [P("#0e3a5a"), P("#1a7aa8"), P("#4cd8ec"), P("#a0f2fa"), P("#ffffff")];
  const W = 30, X0 = Math.round(x - 15), shake = hits > 0 && Math.sin(t * 40) > 0.75 ? 1 : 0;
  // 水晶（先畫，岩石蓋在根部）：[根部 x, 長度, 傾斜]
  const XT = [[-9, 13, -0.45], [-3, 20, -0.12], [3, 17, 0.18], [9, 12, 0.5], [-6, 9, -0.8]];
  XT.forEach(([dx, len, lean], k) => {
    if (k >= XT.length - hits * 2) return;
    for (let j = 0; j < len; j++) {
      const cx = Math.round(x + dx + lean * j + shake), cy = Math.round(y - 6 - j), tip = len - j;
      const half = tip <= 1 ? 0 : tip <= 3 ? 1 : 2;
      for (let i = -half - 1; i <= half + 1; i++) {
        const edge = Math.abs(i) === half + 1;
        put(frame, cx + i, cy, edge ? OUT : tip <= 2 ? CR[4] : i < 0 ? CR[3] : i === 0 ? CR[2] : CR[1], !edge && (tip <= 3 || i < 0));
      }
    }
    put(frame, Math.round(x + dx + lean * len + shake), Math.round(y - 6 - len), OUT);
  });
  // 岩石：半圓的一塊，左上亮、右下暗、頂上一圈亮邊
  for (let i = 0; i < W; i++) {
    const u = (i - W / 2 + 0.5) / (W / 2), hh = Math.round(9 * Math.sqrt(Math.max(0, 1 - u * u)) + (hash(i, 7) < 0.3 ? 1 : 0));
    for (let j = 0; j < hh; j++) {
      const yy = y - 1 - j, top = j === hh - 1, lit = u < -0.2 && j > hh * 0.4;
      put(frame, X0 + i, yy, top ? STONE.e : lit ? STONE.d : u > 0.45 || j < 2 ? STONE.b : STONE.c);
    }
    put(frame, X0 + i, y - 1 - hh, OUT);
  }
  put(frame, X0 - 1, y - 1, OUT); put(frame, X0 + W, y - 1, OUT);
  // 裂縫：敲一下多一條
  const cracks = [[[0, 0], [1, 1], [1, 2], [2, 3], [2, 4], [3, 5]], [[0, 0], [-1, 1], [-1, 2], [-2, 3], [-3, 4], [-3, 5], [-4, 6]]];
  for (let c = 0; c < Math.min(hits, 2); c++) for (const [dx, dy] of cracks[c]) put(frame, x + (c ? -4 : 3) + dx, y - 9 + dy, OUT);
  // 閃光：每 2 秒一根水晶的尖端閃一下
  const g = Math.floor(t / 2) % 5, gp = (t % 2) / 2;
  if (gp < 0.18 && g < XT.length - hits * 2) {
    const [dx, len, lean] = XT[g], gx = Math.round(x + dx + lean * (len - 2)), gy = Math.round(y - 6 - (len - 2)), r = gp < 0.09 ? 2 : 1;
    for (let i = -r; i <= r; i++) { put(frame, gx + i, gy, CR[4], true); put(frame, gx, gy + i, CR[4], true); }
  }
  glowRing(frame, x, y - 14, 13, CR[1]);
}

// ---------- 魔物化石核：28 高。半埋在土堆裡的大魔物頭骨，眼窩裡嵌著一顆發光的核（形態的顏色），後面翹著兩根肋骨
export function drawFossil(frame, x, y, t, color = "#b878ff") {
  const BONE = [P("#4a3a2e"), P("#8a7a60"), P("#c8b896"), P("#efe4c8")], DIRT = [P("#2a1c14"), P("#4a3424"), P("#6a4c32")];
  const k = Math.sin(t * 2) * 0.5 + 0.5, GL = P(color), WH = P("#ffffff");
  const cx = Math.round(x), base = Math.round(y);
  // 肋骨：右後方兩根彎彎的骨頭
  for (const [ox, h, bend] of [[5, 22, 0.55], [10, 17, 0.7]]) {
    for (let j = 0; j < h; j++) {
      const q = j / h, bx = Math.round(cx + ox + Math.sin(q * 1.6) * bend * 9), by = base - 4 - j;
      put(frame, bx - 1, by, OUT); put(frame, bx, by, BONE[3]); put(frame, bx + 1, by, BONE[2]); put(frame, bx + 2, by, BONE[1]); put(frame, bx + 3, by, OUT);   // 第 3 輪：肋骨 3 格粗
    }
    const tx = Math.round(cx + ox + Math.sin(1.6) * bend * 9), ty = base - 4 - h;
    put(frame, tx, ty, BONE[3]); put(frame, tx + 1, ty, BONE[2]); put(frame, tx, ty - 1, OUT); put(frame, tx + 1, ty - 1, OUT);
  }
  // 頭骨：大圓頂（下半埋在土裡）
  const sx = cx - 4, sy = base - 9, rx = 11, ry = 9;
  for (let dy = -ry - 1; dy <= 4; dy++) for (let dx = -rx - 1; dx <= rx + 1; dx++) {
    const d = Math.hypot(dx / rx, dy / ry);
    if (d > 1.08) continue;
    const X = sx + dx, Y = sy + dy;
    if (d > 0.95) { put(frame, X, Y, OUT); continue; }
    put(frame, X, Y, dx + dy < -8 ? BONE[3] : dx + dy < 0 ? BONE[2] : dx + dy < 6 ? BONE[1] : BONE[0]);   // 第 3 輪：右下多一階暗，比較立體
  }
  // 頭骨上的裂紋、鼻孔、牙
  for (const [dx, dy] of [[2, -7], [3, -6], [3, -5], [4, -4]]) put(frame, sx + dx, sy + dy, BONE[0]);
  put(frame, sx + 3, sy + 1, OUT); put(frame, sx + 4, sy + 1, OUT);
  for (let i = -6; i <= 4; i += 2) { put(frame, sx + i, sy + 4, BONE[3]); put(frame, sx + i + 1, sy + 4, OUT); }
  // 眼窩（右邊小的空著）＋左邊大的嵌著核
  for (const [dx, dy] of [[6, -2], [7, -2], [6, -1], [7, -1]]) put(frame, sx + dx, sy + dy, OUT);
  const ex = sx - 4, ey = sy - 2;
  for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
    const d = Math.hypot(dx, dy);
    if (d > 5.2) continue;
    if (d > 3.3) put(frame, ex + dx, ey + dy, d > 4.4 ? OUT : P("#141018"));
  }
  // 核：會呼吸的光球（暗邊、本色、亮、白點），外面一圈光
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    const d = Math.hypot(dx, dy); if (d > 3.3) continue;
    put(frame, ex + dx, ey + dy, d < 1.2 ? WH : dx + dy < -1 ? P(lighten(color)) : GL, d < 3);
  }
  put(frame, ex - 1, ey - 2, WH, true);
  glowRing(frame, ex, ey, 8 + Math.round(k * 3), GL, 0.3);
  // 光點：從核往上飄
  for (let m = 0; m < 3; m++) { const p = ((t * 0.6 + m * 0.33) % 1); put(frame, ex + Math.round(Math.sin(p * 8 + m) * 3), ey - 6 - p * 14, p < 0.6 ? GL : P(lighten(color)), true); }
  // 土堆：把頭骨下半部埋起來
  for (let i = -16; i <= 16; i++) {
    const u = i / 16, hh = Math.round(5 * Math.sqrt(Math.max(0, 1 - u * u)) + (hash(i, 9) < 0.35 ? 1 : 0));
    for (let j = 0; j < hh; j++) put(frame, cx + i, base - 1 - j, j === hh - 1 ? DIRT[2] : hash(i, j, 4) < 0.2 ? DIRT[0] : DIRT[1]);
    put(frame, cx + i, base - 1 - hh, OUT);
  }
}
function lighten(hexStr) { const n = parseInt(hexStr.slice(1), 16), f = (v) => Math.min(255, v + Math.round((255 - v) * 0.55)); return "#" + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, "0")).join(""); }

// ---------- 被丟下來的寶箱：26 高。從天上掉下來、歪歪斜斜插在一圈焦黑的坑裡的鐵箍木箱，蓋子的縫漏出金光、冒一點煙；opened＝蓋子往後翻開、裡面暗掉
export function drawSafe(frame, x, y, opened = false, t = 0) {
  const WD = [P("#3a1a14"), P("#6a2e1e"), P("#8e4428"), P("#b0603a")], FE = [P("#2a2a36"), P("#5c5a6a"), P("#8a8898"), P("#b8b6c4")], GD = [P("#8a5a10"), P("#f0b424"), P("#ffe066"), P("#fff6c4")];
  const cx = Math.round(x), base = Math.round(y);
  // 焦黑的坑
  // 使用者 2026-11-06「所有寶箱尺寸調大 30%」：箱子 24×13 → 31×17、蓋子 8 → 10、坑 18 → 23（照比例畫大，線條還是 1 格）
  for (let i = -23; i <= 23; i++) { const u = Math.abs(i) / 23; put(frame, cx + i, base - 1, u > 0.85 ? P("#3a2a20") : P("#140c0c")); if (u < 0.7) put(frame, cx + i, base - 2, P("#241818")); }
  // 箱子（往右歪：每往上一排往右推一點）
  const BW = 31, BH = 17, LH = 10, x0 = cx - 16, y0 = base - 2 - BH;
  const sh = (j) => Math.round((BH - j) * 0.18);
  for (let j = 0; j < BH; j++) for (let i = -1; i <= BW; i++) {
    const X = x0 + i + sh(j), Y = y0 + j;
    if (i === -1 || i === BW || j === BH - 1) { put(frame, X, Y, OUT); continue; }
    const band = i === 2 || i === 3 || i === BW - 4 || i === BW - 3;
    put(frame, X, Y, band ? (i % 2 ? FE[2] : FE[1]) : (j + (i >> 2)) % 4 === 0 ? WD[0] : i < 6 ? WD[3] : WD[2]);
  }
  // 鎖片（金）
  const lx = x0 + 13 + sh(2);
  for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) put(frame, lx + i, y0 + j, j === 0 || i === 0 ? GD[2] : j === 4 || i === 4 ? GD[0] : GD[1]);
  put(frame, lx + 2, y0 + 2, OUT); put(frame, lx + 2, y0 + 3, OUT);
  const ly0 = y0 - LH, lsh = sh(0) + 1;
  if (!opened) {
    // 蓋子：半圓拱頂，鐵箍
    for (let j = 0; j < LH; j++) for (let i = -1; i <= BW; i++) {
      const u = (i - BW / 2 + 0.5) / (BW / 2 + 1), top = LH - Math.round(LH * Math.sqrt(Math.max(0, 1 - u * u)) * 0.95);
      if (j < top - 1) continue;
      const X = x0 + i + lsh + Math.round((LH - j) * 0.18), Y = ly0 + j;
      if (j === top - 1 || i === -1 || i === BW) { put(frame, X, Y, OUT); continue; }
      const band = i === 2 || i === 3 || i === BW - 4 || i === BW - 3;
      put(frame, X, Y, band ? FE[3 - (j > 4 ? 1 : 0)] : j === top ? WD[3] : i < 7 ? WD[3] : WD[2]);
    }
    // 縫：一排金光一閃一閃，往上漏幾道光
    for (let i = 0; i < BW; i++) put(frame, x0 + i + sh(0), y0 - 1, hash(i, Math.floor(t * 10)) < 0.65 ? GD[3] : GD[2], true);
    for (let r = 0; r < 3; r++) { const rx = x0 + 6 + r * 9 + sh(0), len = 4 + Math.round((Math.sin(t * 3 + r * 2) * 0.5 + 0.5) * 5); for (let j = 1; j <= len; j++) { const gi = (rx - frame.ox) + (y0 - 1 - j - frame.oy) * frame.w; if (gi >= 0 && gi < frame.light.length && !frame.light[gi]) frame.light[gi] = GD[1]; } }
    // 從天上掉下來還在冒的細煙
    for (let m = 0; m < 3; m++) { const p = ((t * 0.4 + m * 0.33) % 1); put(frame, x0 + BW + sh(0) - 2 + Math.round(Math.sin(p * 6 + m) * 2), ly0 - 2 - p * 18, p < 0.5 ? P("#6a6070") : P("#463e4c")); }
    glowRing(frame, cx, y0 - 2, 16, GD[1]);
  } else {
    // 打開：箱子裡面黑掉、只剩幾點金屑；蓋子往後翻（畫在箱子上方、往左倒）
    for (let i = 0; i < BW; i++) put(frame, x0 + i + sh(0), y0, i < 2 || i > BW - 3 ? OUT : P("#120a0a"));
    for (let i = 4; i < BW - 4; i += 6) put(frame, x0 + i + sh(0), y0, GD[0]);
    // 第 3 輪：蓋子直直地立在箱子後面（往後翻開），看得到蓋子的內側（暗）
    for (let j = 0; j < 12; j++) for (let i = -1; i <= BW; i++) {
      const X = x0 + i + sh(0) + 1 - Math.round(j * 0.25), Y = y0 - 2 - j;
      put(frame, X, Y, i === -1 || i === BW || j === 11 ? OUT : (i === 2 || i === 3 || i === BW - 4 || i === BW - 3) ? FE[1] : j < 2 ? WD[0] : WD[1]);
    }
  }
}

// ---------- 星王的碑文：36 高。拱頂的石碑（右上角缺一塊），頂上刻一顆星，下面四排符文，底座長青苔；
//   沒讀：符文是刻痕、隔一陣子淡淡地亮一次紫光（告訴你可以讀）；讀過：符文全部變金色、一排一排亮
export function drawStele(frame, x, y, read = false, t = 0) {
  const W = 22, H = 32, x0 = Math.round(x - W / 2), y0 = Math.round(y - H - 4);
  // 底座
  for (let j = 0; j < 4; j++) for (let i = -3; i < W + 3; i++) put(frame, x0 + i, y0 + H + j, j === 0 ? STONE.e : i < 2 ? STONE.c : j === 3 ? STONE.a : STONE.b);
  // 碑身：拱頂、右上角缺角；左邊亮、右邊暗
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const u = (i - W / 2 + 0.5) / (W / 2), arch = j < 6 ? 6 - Math.round(6 * Math.sqrt(Math.max(0, 1 - u * u))) : 0;
    const chip = i > W - 6 && j < 9 && i - (W - 6) > j - 3;
    if (j < arch || chip) continue;
    const edgeL = i === 0 || j === arch, edgeR = i === W - 1;
    put(frame, x0 + i, y0 + j, edgeL ? STONE.e : edgeR ? STONE.a : i < 4 ? STONE.d : i > W - 5 ? STONE.b : STONE.c);
  }
  // 外框
  for (let j = -1; j <= H; j++) for (let i = -1; i <= W; i++) {
    const inside = (ii, jj) => { if (ii < 0 || jj < 0 || ii >= W || jj >= H) return false; const u = (ii - W / 2 + 0.5) / (W / 2), arch = jj < 6 ? 6 - Math.round(6 * Math.sqrt(Math.max(0, 1 - u * u))) : 0; const chip = ii > W - 6 && jj < 9 && ii - (W - 6) > jj - 3; return jj >= arch && !chip; };
    if (!inside(i, j) && (inside(i + 1, j) || inside(i - 1, j) || inside(i, j + 1) || inside(i, j - 1))) put(frame, x0 + i, y0 + j, OUT);
  }
  // 裂紋
  for (const [dx, dy] of [[4, 20], [5, 21], [5, 22], [6, 23], [6, 24]]) put(frame, x0 + dx, y0 + dy, STONE.a);
  // 符文：沒讀＝暗刻痕＋每 3 秒淡淡亮一次紫；讀過＝金色，由上往下一排一排亮
  const pulse = (t % 3) / 3, RUNE_D = P("#1a1830"), V = [P("#4a3a8a"), P("#8a6ae0")], G = [P("#c8861a"), P("#ffe066")];
  const glyph = [[[0, 0], [1, 0], [-1, 0], [0, -1], [0, 1]], [[-1, 1], [0, 0], [1, -1], [1, 1]], [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], [[-1, 0], [0, 0], [1, 0], [0, 1]]];
  for (let line = 0; line < 4; line++) for (let i = 0; i < 5; i++) {
    const gx = x0 + 3 + i * 4, gy = y0 + 13 + line * 4, kind = Math.floor(hash(line, i, 5) * 4);
    let c = RUNE_D, glow = false;
    if (read) { const on = Math.sin(t * 2.2 - line * 0.8) > -0.2; c = on ? G[1] : G[0]; glow = on; }
    else if (pulse < 0.25) { const k = Math.sin((pulse / 0.25) * Math.PI); c = k > 0.5 ? V[1] : V[0]; glow = k > 0.3; }
    for (const [dx, dy] of glyph[kind]) put(frame, gx + dx, gy + dy, c, glow);
  }
  // 頂上的星（刻在拱頂裡）
  const sc = read ? P("#fff6c4") : pulse < 0.25 ? V[1] : STONE.e, scx = x0 + W / 2 - 1, scy = y0 + 7;
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const a = Math.atan2(dy, dx) + Math.PI / 2, d = Math.hypot(dx, dy), R = 1.2 + 2 * Math.max(0, Math.cos(a * 5)) ** 2; if (d <= R + 0.4) put(frame, scx + dx, scy + dy, sc, read || pulse < 0.25); }
  // 底部的青苔
  for (let i = 0; i < W; i++) { const h = Math.round(hash(i, 3) * 3); for (let j = 0; j < h; j++) put(frame, x0 + i, y0 + H - 1 - j, j === h - 1 ? P("#5a9a3a") : P("#2a5a2a")); }
  if (read) glowRing(frame, x0 + W / 2, y0 + 18, 14, G[0]);
  else if (pulse < 0.25) glowRing(frame, x0 + W / 2, y0 + 18, 12, V[0]);
}
