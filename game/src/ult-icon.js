// 大招鍵的專用圖示（照 pixelfx skill：參考 ui/countdown 的分段計時環＋亮頭、ui/achievement 的金星獎章＋掃光＋閃光）
// 29×29：玻璃圓底；外圈 20 段能量環從正上方順時針亮起（最前面那段是白的亮頭）；
// 中間一顆有稜面的五角星，能量像金色液體從下往上灌滿（液面一條亮線、會輕輕晃）；
// 集滿：整顆星亮一階、白色星心、斜斜的掃光、星角輪流閃十字光、外環有一段白光在繞。
// 純函式（不碰 DOM），草稿工具 game/tools/drafts/ult-icon.mjs 也用同一份。
export const ULT_S = 29;
const S = ULT_S, C = 14;
const GOLD = ["#3a1a06", "#7a3c0c", "#b8661a", "#e8a028", "#ffd24a", "#ffee98", "#fffbe6"];
const EMPTY = ["#0c0818", "#2a2248", "#3a3062", "#5c5090"];   // 第 3 輪：空的星亮一點，形狀才看得出來
const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const G = GOLD.map(rgb), E = EMPTY.map(rgb), WHITE = [255, 255, 255];

// 五角星（外徑 10、內徑 4.3，中心稍微往下一點，看起來比較穩）
const SX = C, SY = C + 0.6, RO = 10.2, RI = 4.3;
const PTS = Array.from({ length: 10 }, (_, i) => {
  const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? RI : RO;
  return [SX + Math.cos(a) * r, SY + Math.sin(a) * r];
});
function inStar(x, y) {
  let ins = false;
  for (let i = 0, j = 9; i < 10; j = i++) {
    const [xi, yi] = PTS[i], [xj, yj] = PTS[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}
// 每一格屬於哪一個稜面：離它最近的星角，在角的左邊還是右邊；稜面朝左上＝亮
const FACET = new Float32Array(S * S), STAR = new Uint8Array(S * S);
let TOP = S, BOT = 0;
for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
  if (!inStar(x + 0.5, y + 0.5)) continue;
  const i = y * S + x;
  STAR[i] = 1;
  TOP = Math.min(TOP, y); BOT = Math.max(BOT, y);
  const a = Math.atan2(y + 0.5 - SY, x + 0.5 - SX);
  const arm = Math.round((a + Math.PI / 2) / ((2 * Math.PI) / 5)) * ((2 * Math.PI) / 5) - Math.PI / 2;
  let d = a - arm;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  const fa = arm + (d >= 0 ? 0.55 : -0.55);   // 稜面的朝向
  FACET[i] = Math.cos(fa) * -0.6 + Math.sin(fa) * -0.8;   // 跟左上光的夾角（-1 背光 ～ 1 朝光）
}
const OUT = new Uint8Array(S * S);   // 星星的外框（星星外面一圈）
for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
  const i = y * S + x;
  if (STAR[i]) continue;
  if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => STAR[(y + dy) * S + x + dx] && x + dx >= 0 && x + dx < S)) OUT[i] = 1;
}
// 圓底的層：1 外緣、2 能量環、3+ 裡面
const RING = new Uint8Array(S * S);
for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
  const r = Math.hypot(x - C, y - C);
  RING[y * S + x] = r > 14.4 ? 0 : r > 13.4 ? 1 : r > 11.6 ? 2 : 3;
}
const TIPS = PTS.filter((_, i) => i % 2 === 0).map(([x, y]) => [Math.round(x - 0.5 + (x - SX) * 0.02), Math.round(y - 0.5)]);

/**
 * 畫一格。k：能量 0～1；t：秒（動畫用）。回傳 RGBA（Uint8ClampedArray，S×S×4）。
 */
export function ultPixels(k, t) {
  const out = new Uint8ClampedArray(S * S * 4);
  const put = (i, c, a = 255) => { out[i * 4] = c[0]; out[i * 4 + 1] = c[1]; out[i * 4 + 2] = c[2]; out[i * 4 + 3] = a; };
  const full = k >= 1;
  k = Math.max(0, Math.min(1, k));
  const segs = 20, headF = k;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x, L = RING[i];
    if (!L) continue;
    if (L === 1) {   // 外緣：左上亮、右下暗；集滿變金色（第 2 輪：原本灰白一圈太搶眼）
      const tl = x + y < S - 1;
      if (full) put(i, tl ? G[4] : G[2]); else put(i, tl ? [150, 140, 200] : [70, 60, 110], tl ? 200 : 170);
      continue;
    }
    if (L === 2) {
      // 能量環：從正上方順時針；每段之間留一格縫
      const f = (Math.atan2(x - C, -(y - C)) / (Math.PI * 2) + 1) % 1, seg = f * segs, gap = seg % 1 > 0.82;
      if (gap) { put(i, E[0], 200); continue; }
      if (full) {
        const run = (((f - t * 0.6) % 1) + 1) % 1;   // 集滿：一段白光繞著跑
        put(i, run < 0.06 ? WHITE : run < 0.14 ? G[5] : x + y < S ? G[3] : G[2]);   // 第 3 輪：底色壓暗一階，跟外緣分開
      } else if (f < headF) put(i, headF - f < 0.04 ? WHITE : headF - f < 0.09 ? G[5] : x + y < S ? G[4] : G[3]);
      else put(i, E[2], 230);
      continue;
    }
    if (full) { const r = Math.hypot(x - SX, y - SY); put(i, r < 8 ? [70, 40, 12] : [40, 22, 14], 190); }   // 集滿：圓底裡面暖起來（星星在發光）
    else put(i, [14, 10, 28], 120);   // 圓底裡面：半透明深色
  }
  // 液面高度（從星星底部往上），輕輕晃
  const H = BOT - TOP + 1, level = BOT + 1 - k * H;
  const sweep = ((t * 0.8) % 1.6) * 40 - 12;   // 集滿時的斜掃光位置（x + y）
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x;
    if (OUT[i]) {
      const filledHere = full || (k > 0 && y + 0.5 > level);
      put(i, filledHere ? G[0] : E[0]);
      continue;
    }
    if (!STAR[i]) continue;
    const f = FACET[i], step = f > 0.55 ? 2 : f > 0 ? 1 : f > -0.5 ? 0 : -1;   // 稜面明暗 4 階
    const wob = full ? 0 : Math.sin(x * 0.9 + t * 6) * 0.6;
    const yl = level + wob;
    if (full || (k > 0 && y + 0.5 > yl)) {
      let s = 3 + step;
      if (!full && y + 0.5 - yl < 1) s = 6;   // 液面：一條亮線
      if (full) {
        const r = Math.hypot(x + 0.5 - SX, y + 0.5 - SY);
        if (r < 1.6) s = 7; else if (r < 2.7) s = Math.max(s, 6);   // 白色星心＋一圈亮金
        if (Math.abs(x + y - sweep) < 1.2) s = Math.max(s, 6);   // 掃光
      }
      put(i, s >= 7 ? WHITE : G[Math.max(1, Math.min(6, s))]);
    } else {
      // 空的星：暗紫，靠外框的那一圈亮一階（左上那半邊），形狀才看得出來
      const rim = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => OUT[(y + dy) * S + x + dx]);
      put(i, rim && f > -0.2 ? E[3] : E[Math.max(1, Math.min(2, 1 + step))]);
    }
  }
  if (full) {
    // 星角輪流閃十字光（第 2 輪：放在星角外面一點、大一點，前一個角留一顆小的在收）
    const n = Math.floor(t / 0.22), ph = (t / 0.22) % 1;
    const cross = (tip, arm) => {
      const [px, py] = TIPS[tip], dx = px - SX, dy = py - SY, l = Math.hypot(dx, dy);
      const tx = Math.round(px + (dx / l) * 1.5), ty = Math.round(py + (dy / l) * 1.5);
      for (let d = -arm; d <= arm; d++) for (const [x, y] of [[tx + d, ty], [tx, ty + d]]) {
        if (x < 0 || y < 0 || x >= S || y >= S) continue;
        const a = Math.abs(d);
        put(y * S + x, a === 0 ? WHITE : a === 1 ? G[6] : G[4]);
      }
    };
    cross((n * 2) % 5, ph < 0.6 ? 3 : 2);
    if (ph < 0.5) cross(((n - 1) * 2 + 5 * 4) % 5, 1);
  }
  if (!full && k > 0.05) {
    // 灌能量中：液面上偶爾冒一顆小泡泡往上飄
    const p = (t * 0.9) % 1, bx = Math.round(SX - 2 + Math.sin(t * 1.7) * 3), by = Math.round(level - 1 - p * 4);
    if (by >= 0 && STAR[by * S + bx] && p < 0.8) put(by * S + bx, G[5]);
  }
  return out;
}
