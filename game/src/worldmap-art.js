// 選關世界地圖「墜星之谷」的畫（使用者 2026-11-06：選地圖要有地圖介面與圖片，不能是文字）
// 斜俯視的像素風景地圖，320×180，程式畫（照 pixelfx skill：參考 → 畫 → 看 → 修，草稿 game/tools/drafts/worldmap.mjs）。
//   bakeBase()：不會動的地形＋地標，畫一次存起來
//   drawWorld(frame, t, st)：每幀把底圖貼上，再畫會動的：路上的光點、旗子、NEW 光圈、霧、蝙蝠、星洞、主角
// 光從左上來：坡面朝左上亮一階、朝右下暗一階。顏色都是一階一階的，柔和的只有光（frame.light）跟霧。
export const WM_W = 320, WM_H = 180;
export const LMY = 20;   // 地標畫在地點上方多高（主角站在地點上，不會擋住地標）
const TAU = Math.PI * 2;
const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const pk = (h) => { const [r, g, b] = hex(h); return (0xff000000 | (b << 16) | (g << 8) | r) >>> 0; };
const hash = (x, y, k = 0) => { let h = (x * 374761393 + y * 668265263 + k * 2147483647) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const smooth = (t) => t * t * (3 - 2 * t);
function vnoise(x, y, k) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = smooth(x - xi), fy = smooth(y - yi);
  const a = hash(xi, yi, k), b = hash(xi + 1, yi, k), c = hash(xi, yi + 1, k), d = hash(xi + 1, yi + 1, k);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
const fbm = (x, y, k) => vnoise(x / 40, y / 40, k) * 0.55 + vnoise(x / 18, y / 18, k + 1) * 0.3 + vnoise(x / 7, y / 7, k + 2) * 0.15;

// ---- 地點（地圖座標）：碎星鎮在左上隕石坑邊，一條路往右下彎過四關；右上是還沒開的迷霧森林（第 2 章）
export const NODES = {
  town: { x: 56, y: 50, name: "碎星鎮" },
  "1-1": { x: 70, y: 124 },
  "1-2": { x: 140, y: 140 },
  "1-3": { x: 196, y: 96 },
  "1-4": { x: 262, y: 134 },
  endless: { x: 136, y: 58 },
  ch2: { x: 284, y: 40 },
};
// 路（依序經過的點）：town → 1-1 → 1-2 → 1-3 → 1-4 → ch2；endless 另外一條小岔路
export const ROUTE = ["town", "1-1", "1-2", "1-3", "1-4", "ch2"];
const BENDS = { "town>1-1": [[44, 82], [58, 104]], "1-1>1-2": [[96, 136], [118, 146]], "1-2>1-3": [[160, 128], [170, 104]], "1-3>1-4": [[224, 98], [246, 118]], "1-4>ch2": [[282, 110], [292, 72]], "town>endless": [[92, 50], [114, 60]] };
/** 兩個地點之間的路：一串 1 px 間隔的點（Catmull-Rom 曲線） */
export function segment(a, b) {
  const pts = [[NODES[a].x, NODES[a].y], ...(BENDS[a + ">" + b] ?? []), [NODES[b].x, NODES[b].y]], out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const n = Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * 1.5);
    for (let s = 0; s < n; s++) {
      const t = s / n, t2 = t * t, t3 = t2 * t;
      const f = (k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
      const x = f(0), y = f(1), q = out[out.length - 1];
      if (!q || Math.hypot(x - q[0], y - q[1]) >= 1) out.push([x, y]);
    }
  }
  out.push([NODES[b].x, NODES[b].y]);
  return out;
}
const SEGS = [...ROUTE.slice(1).map((b, i) => [ROUTE[i], b]), ["town", "endless"]].map(([a, b]) => ({ a, b, pts: segment(a, b) }));
export const segs = SEGS;

// ---- 調色盤
const GRASS = ["#141c26", "#1c2a2c", "#253a30", "#304a34", "#3e5c38", "#56763e"].map(pk);
const ROCK = ["#1a1828", "#262438", "#363650", "#4a4c6a", "#646888", "#8a8eaa"].map(pk);
const DIRT = ["#3a2c2a", "#5a4434", "#7a5e42", "#9a7a52"].map(pk);
const TREE = ["#0e1418", "#16242a", "#1e3430", "#2a4836", "#3a6040"].map(pk);
const FOG_TREE = ["#141626", "#1e2234", "#2a3044"].map(pk);
const WATER = ["#14203a", "#1c3050", "#2a4870", "#4a78a0"].map(pk);
const C = (h) => pk(h);
const OUT = C("#0a0810");

/** 高度：基本起伏，路經過的地方是谷底（低），隕石坑是一圈高的坑緣＋中間凹下去 */
function height(x, y) {
  let h = fbm(x, y, 7) * 0.9 + (y / WM_H) * -0.12 + 0.06;
  let dmin = 99;
  for (const s of SEGS) for (let i = 0; i < s.pts.length; i += 3) { const d = Math.hypot(s.pts[i][0] - x, (s.pts[i][1] - y) * 1.2); if (d < dmin) dmin = d; }
  h -= 0.22 * Math.exp(-(dmin * dmin) / 160);
  const cd = Math.hypot((x - 50) / 34, (y - 34) / 20);   // 隕石坑
  h += 0.32 * Math.exp(-((cd - 1) ** 2) * 18) - 0.28 * Math.exp(-(cd * cd) * 2.4);
  return { h, dmin };
}

export function bakeBase() {
  const W = WM_W, H = WM_H, px = new Uint32Array(W * H), hm = new Float32Array(W * H), dm = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const { h, dmin } = height(x, y); hm[y * W + x] = h; dm[y * W + x] = dmin; }
  const at = (x, y) => hm[Math.max(0, Math.min(H - 1, y)) * W + Math.max(0, Math.min(W - 1, x))];
  // ---- 地面：高度分成幾階，高的是岩石；坡面朝左上亮一階、朝右下暗一階
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, h = hm[i], slope = h - at(x - 2, y - 2);
    const lit = slope > 0.03 ? 1 : slope < -0.03 ? -1 : 0, lit2 = slope > 0.09 ? 1 : slope < -0.09 ? -1 : 0;
    let c;
    if (h > 0.66) c = ROCK[Math.max(0, Math.min(5, 2 + lit + lit2 + (h > 0.76 ? 1 : 0)))];
    else if (h > 0.58) c = ROCK[Math.max(0, Math.min(5, 2 + lit))];
    else { const band = h < 0.2 ? 1 : h < 0.34 ? 2 : h < 0.46 ? 3 : 4; c = GRASS[Math.max(0, Math.min(5, band + lit))]; }
    // 岩石跟草的交界畫一條暗線（像崖邊）
    if (h > 0.58 && at(x, y + 1) <= 0.58) c = ROCK[0];
    px[i] = c;
  }
  // ---- 小溪：從隕石坑流出來，往下彎到地圖底
  for (let s = 0; s < 1; s += 0.002) {
    const x = 92 + s * 40 + Math.sin(s * 9) * 10, y = 40 + s * 150, w = 1.2 + s * 1.6;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -3; dx <= 3; dx++) {
      const X = Math.round(x + dx), Y = Math.round(y + dy); if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      const d = Math.hypot(dx, dy * 1.4); if (d > w + 0.6) continue;
      px[Y * W + X] = d > w - 0.2 ? WATER[1] : (dx < 0 && dy < 0) ? WATER[3] : WATER[2];
    }
  }
  // ---- 樹：一團一團（大小不一），路上跟坑裡不長；右上迷霧森林特別密、顏色偏紫灰
  const trees = [];
  for (let y = 4; y < H; y += 3) for (let x = 2; x < W; x += 3) {
    const i = y * W + x, h = hm[i], r = hash(x, y, 11), forest = x > 236 && y < 86;
    if (dm[i] < 9 || h > 0.58 || h < 0.18) continue;
    const dens = forest ? 0.6 : fbm(x, y, 21) > 0.56 ? 0.34 : 0.035;
    if (r < dens) trees.push({ x: x + Math.floor(hash(x, y, 12) * 3), y: y + Math.floor(hash(x, y, 13) * 3), r: forest ? 2 + (hash(x, y, 14) * 2 | 0) : 1 + (hash(x, y, 14) * 2.4 | 0), forest });
  }
  trees.sort((a, b) => a.y - b.y);
  for (const t of trees) {
    const P = t.forest ? FOG_TREE : TREE;
    for (let dy = -t.r - 1; dy <= 1; dy++) for (let dx = -t.r - 1; dx <= t.r + 1; dx++) {
      const X = t.x + dx, Y = t.y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      const d = Math.hypot(dx, (dy + t.r * 0.4) * 1.1);
      if (dy === 1 && Math.abs(dx) <= Math.max(0, t.r - 1)) { px[Y * W + X] = P[0]; continue; }   // 樹影
      if (d > t.r + 0.5) continue;
      const lit = dx + dy < -t.r * 0.6 ? 2 : dx + dy > t.r * 0.5 ? 0 : 1;
      px[Y * W + X] = d > t.r - 0.4 ? P[0] : P[Math.min(P.length - 1, lit + (t.forest ? 0 : 1))];
    }
  }
  // ---- 路：土色 3 px 寬（中間亮、兩邊暗），路面上偶爾一顆小石頭
  for (const s of SEGS) for (const [x, y] of s.pts) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const X = Math.round(x + dx), Y = Math.round(y + dy); if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
    const edge = Math.abs(dx) + Math.abs(dy) >= 2;
    if (edge && px[Y * W + X] !== DIRT[2] && px[Y * W + X] !== DIRT[3]) px[Y * W + X] = DIRT[1];
    else if (!edge) px[Y * W + X] = dy < 0 ? DIRT[3] : DIRT[2];
  }
  // ---- 地標
  const put = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H) px[y * W + x] = c; };
  const ell = (cx, cy, rx, ry, fn) => { for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) { const d = Math.hypot((x - cx) / rx, (y - cy) / ry); if (d <= 1) fn(x, y, d, x - cx, y - cy); } };
  // 碎星鎮：隕石坑中間有一塊發光的星星碎片，房子排在坑的南緣
  ell(50, 34, 20, 10, (x, y, d, dx, dy) => put(x, y, d > 0.85 ? (dy < 0 ? ROCK[1] : ROCK[3]) : dy < -2 ? ROCK[1] : ROCK[2]));
  for (const [x, y, c] of [[50, 31, "#ffe066"], [49, 32, "#f0b424"], [51, 32, "#f0b424"], [50, 32, "#fff6c4"], [50, 33, "#c48412"], [48, 33, "#c48412"], [52, 33, "#7a5a2a"]]) put(x, y, C(c));
  const HOUSE = [[34, 48, "#a04a3a"], [42, 52, "#5a6aa0"], [52, 54, "#a04a3a"], [62, 52, "#6a8a4a"], [70, 47, "#5a6aa0"], [27, 42, "#6a8a4a"]];
  for (const [hx, hy, roof] of HOUSE) {
    const R = hex(roof), dark = C("#" + R.map((v) => Math.round(v * 0.6).toString(16).padStart(2, "0")).join("")), lite = C("#" + R.map((v) => Math.min(255, Math.round(v * 1.3)).toString(16).padStart(2, "0")).join(""));
    for (let y = -4; y <= 2; y++) for (let x = -4; x <= 4; x++) {
      let c = null;
      if (y < -1) { const w = 4 + y + 1 + 2; if (Math.abs(x) <= w) c = Math.abs(x) === w ? OUT : x < 0 ? lite : C(roof); }   // 屋頂（斜的）
      else if (Math.abs(x) <= 3) c = Math.abs(x) === 3 || y === 2 ? OUT : C("#c8b08a");                                         // 牆
      if (y === 0 && (x === -1 || x === 1)) c = C("#ffd860");                                                                  // 窗（亮）
      if (c != null) put(hx + x, hy + y, c);
    }
    put(hx + 3, hy + 3, dark);
  }
  // 地標畫在地點的上方（LM），主角站在地點上＝地標前面
  const at2 = (id) => [NODES[id].x, NODES[id].y - LMY];
  { // 1-1 墜落之底：地上一個大深坑（坑緣亮、裡面黑紫、往下看得到一圈圈岩層），坑邊插著一根斷樹
    const [cx, cy] = at2("1-1");
    ell(cx, cy, 15, 8, (x, y, d, dx, dy) => put(x, y, d > 0.86 ? (dy < 0 ? ROCK[4] : ROCK[2]) : d > 0.7 ? (dy < 0 ? ROCK[1] : ROCK[3]) : d > 0.5 ? C("#141024") : C("#06040c")));
    for (let y = -7; y <= 0; y++) put(cx + 12, cy - 4 + y, y === -7 ? TREE[3] : C("#4a3424"));
    put(cx + 11, cy - 9, TREE[3]); put(cx + 13, cy - 10, TREE[2]); put(cx + 12, cy - 12, TREE[2]);
  }
  { // 1-2 垃圾山：咖啡色的小山，上面卡著罐子、輪胎、一根木板
    const [cx, cy] = at2("1-2");
    ell(cx, cy, 17, 11, (x, y, d, dx, dy) => { if (dy > 5) return; const n = hash(x, y, 31); put(x, y, d > 0.9 ? C("#2a1810") : dx + dy < -6 ? (n < 0.35 ? C("#d8aa70") : C("#b07c46")) : dx + dy < 4 ? (n < 0.3 ? C("#8a5a32") : C("#7a4c2c")) : n < 0.3 ? C("#4a2e1c") : C("#5a3a24")); });
    for (const [x, y] of [[-7, -3], [5, -5], [-1, -8], [-11, 1], [9, 1], [2, 0]]) { put(cx + x, cy + y, C("#c8d0dc")); put(cx + x + 1, cy + y, C("#7c8494")); put(cx + x, cy + y + 1, C("#5c6474")); put(cx + x + 1, cy + y + 1, C("#3c4454")); }
    ell(cx + 6, cy + 2, 3, 2, (x, y, d) => put(x, y, d > 0.5 ? C("#141418") : C("#3a3a44")));
    for (let i = 0; i < 9; i++) put(cx - 4 + i, cy - 10 + (i >> 2), i === 0 ? OUT : C("#a0784a"));
  }
  { // 1-3 蝙蝠洞窟：一座岩山，前面一個黑色拱形洞口，洞口兩邊有鐘乳石
    const [cx, cy] = at2("1-3");
    ell(cx, cy - 2, 20, 15, (x, y, d, dx, dy) => { if (dy > 9) return; put(x, y, d > 0.92 ? ROCK[0] : dx + dy * 1.4 < -9 ? ROCK[5] : dx + dy < 0 ? ROCK[4] : dx + dy < 10 ? ROCK[3] : ROCK[2]); });
    for (let y = cy - 6; y <= cy + 7; y++) for (let x = cx - 9; x <= cx + 9; x++) { const d = Math.hypot((x - cx) / 8, (y - cy - 7) / 13); if (d <= 1) put(x, y, d > 0.86 ? ROCK[1] : d > 0.7 ? C("#100c18") : C("#05040a")); }
    for (const x of [-4, 0, 3]) for (let y = 0; y < (x === 0 ? 3 : 2); y++) put(cx + x, cy - 5 + y, ROCK[2]);
  }
  { // 1-4 大胃王的巢穴：垃圾坑中間一隻大史萊姆（綠色圓頂），戴著王冠
    const [cx, cy] = at2("1-4");
    ell(cx, cy + 4, 20, 9, (x, y, d) => put(x, y, d > 0.9 ? C("#2a1810") : d > 0.68 ? (hash(x, y, 41) < 0.4 ? C("#6a4428") : C("#4a2c1a")) : C("#100a10")));
    ell(cx, cy, 12, 10, (x, y, d, dx, dy) => { if (dy > 5) return; put(x, y, d > 0.88 ? C("#143014") : dx + dy < -8 ? C("#c8ff8a") : dx + dy < -3 ? C("#9ae85a") : dx + dy < 4 ? C("#5ac84a") : C("#3a8a3a")); });
    const crown = ["a.a.a", "abbba", "bcbcb"], CC = { a: "#ffd84a", b: "#f0b424", c: "#ff4a5a" };
    crown.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== ".") put(cx - 2 + i, cy - 13 + j, C(CC[ch])); }));
    for (const x of [-5, 4]) { put(cx + x, cy - 2, C("#ffffff")); put(cx + x + 1, cy - 2, C("#ff4a5a")); }
    for (let x = -3; x <= 3; x++) put(cx + x, cy + 2 + (Math.abs(x) === 3 ? -1 : 0), C("#143014"));
  }
  { // 無限討伐：地上一道紫色的星之裂縫
    const [cx, cy] = at2("endless");
    for (let i = -11; i <= 11; i++) { const x = cx + i, y = cy + 6 + Math.round(Math.sin(i * 0.9) * 1.5 + i * 0.25), w = Math.abs(i) < 5 ? 2 : Math.abs(i) < 9 ? 1 : 0; for (let k = -w; k <= w; k++) put(x, y + k, Math.abs(k) === w ? C("#2a0a40") : k < 0 ? C("#c88aff") : C("#7a3ac8")); }
  }
  return px;
}

// ---- 會動的部分
const GOLD = ["#7a5a2a", "#c8961a", "#ffd84a", "#fff2a0", "#ffffff"].map(pk);
const GOLD_RGB = hex("#ffd860");
function glow(L, W, H, x, y, r, rgb, a) {
  const cx = Math.round(x), cy = Math.round(y);
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const X = cx + dx, Y = cy + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
    const f = 1 - Math.hypot(dx, dy) / (r + 0.5); if (f <= 0) continue;
    const i = Y * W + X, d = L[i], k = f * f * a;
    L[i] = (0xff000000 | (Math.min(255, ((d >>> 16) & 255) + rgb[2] * k) << 16) | (Math.min(255, ((d >>> 8) & 255) + rgb[1] * k) << 8) | Math.min(255, (d & 255) + rgb[0] * k)) >>> 0;
  }
}
/** 一個地點的狀態：open（開了）、cleared（打過）、fresh（新開的）、sel（選中） */
export function drawWorld(frame, t, base, st) {
  const W = frame.w, H = frame.h, Cc = frame.color, L = frame.light;
  Cc.set(base); L.fill(0);
  const put = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H) Cc[y * W + x] = c; };
  const blend = (x, y, rgb, a) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return; const i = y * W + x, c = Cc[i]; const r = (c & 255) * (1 - a) + rgb[0] * a, g = ((c >>> 8) & 255) * (1 - a) + rgb[1] * a, b = ((c >>> 16) & 255) * (1 - a) + rgb[2] * a; Cc[i] = (0xff000000 | (b << 16) | (g << 8) | r) >>> 0; };
  const open = (id) => st.nodes[id]?.open;
  // 路上的光點：開了的路上，金色小點一顆顆往前流（越過選中的那段越亮）
  for (const s of SEGS) {
    if (!open(s.b) || !open(s.a)) continue;
    for (let i = 0; i < s.pts.length; i += 4) {
      const k = (i / 4 - t * 6) % 6, [x, y] = s.pts[i];
      if (((k % 6) + 6) % 6 < 1) { put(x, y, GOLD[3]); glow(L, W, H, x, y, 2, GOLD_RGB, 0.35); } else put(x, y, GOLD[1]);
    }
  }
  // 營火般的鎮上燈光（窗戶一閃一閃）
  glow(L, W, H, 50, 32, 9, GOLD_RGB, 0.28 + 0.06 * Math.sin(t * 2));
  for (const [x, y] of [[33, 48], [35, 48], [41, 52], [43, 52], [51, 54], [53, 54], [61, 52], [63, 52], [69, 47], [71, 47], [26, 42], [28, 42]]) glow(L, W, H, x, y, 2, GOLD_RGB, 0.16 + 0.08 * Math.sin(t * 3 + x));
  // 1-1：坑底有一點星光在呼吸（主角掉下來的地方）
  glow(L, W, H, NODES["1-1"].x, NODES["1-1"].y - LMY, 7, hex("#a0c8ff"), 0.25 + 0.15 * Math.sin(t * 1.7));
  // 1-3：洞口飛出兩隻小蝙蝠（繞小圈）
  if (open("1-3")) for (let b = 0; b < 2; b++) {
    const a = t * (1.6 + b * 0.4) + b * 3, x = 196 + Math.cos(a) * (10 + b * 5), y = 96 - LMY - 16 + Math.sin(a) * 4 - b * 4, flap = Math.floor(t * 8 + b) % 2;
    put(x, y, C("#1a1428")); put(x - 1, y - flap, C("#2a2440")); put(x + 1, y - flap, C("#2a2440")); put(x - 2, y - 1 + flap, C("#2a2440")); put(x + 2, y - 1 + flap, C("#2a2440"));
  }
  // 1-4：黏液一鼓一鼓、眼睛發紅光
  if (open("1-4")) { const ly = NODES["1-4"].y - LMY; glow(L, W, H, 258, ly - 2, 2, hex("#ff4a5a"), 0.45); glow(L, W, H, 267, ly - 2, 2, hex("#ff4a5a"), 0.45); glow(L, W, H, 262, ly - 12, 3, GOLD_RGB, 0.3); }
  // 無限討伐的裂縫：紫光＋往上飄的小星
  if (open("endless")) {
    glow(L, W, H, 136, 58 - LMY + 6, 9, hex("#a060ff"), 0.25 + 0.08 * Math.sin(t * 2.3));
    for (let i = 0; i < 5; i++) { const life = 1.6, age = (t + i * 0.37) % life, x = 130 + i * 3 + Math.sin(age * 3 + i) * 1.5, y = 58 - LMY + 4 - age * 10; if (age / life < 0.85) put(x, y, i % 2 ? C("#c88aff") : C("#fff2ff")); }
  }
  // 地點標記：打過＝金色小旗；新開的＝金色光圈一直擴散；選中的＝腳下一圈亮框
  for (const id of ["1-1", "1-2", "1-3", "1-4", "endless", "town"]) {
    const n = NODES[id], s = st.nodes[id]; if (!s?.open) continue;
    const fx = n.x + (id === "town" ? 12 : 13), fy = n.y + (id === "town" ? -10 : -LMY - 9);
    if (s.cleared) {   // 旗子
      for (let y = 0; y < 8; y++) put(fx, fy + y, y === 7 ? OUT : C("#c8b08a"));
      const wave = Math.round(Math.sin(t * 5 + n.x) * 0.8);
      for (let y = 0; y < 3; y++) for (let x = 1; x <= 4; x++) put(fx + x, fy + y + (x > 2 ? wave : 0), y === 0 || x === 1 ? GOLD[3] : GOLD[2]);
    }
    if (s.fresh) {     // 擴散光圈
      const k = (t * 0.8) % 1, r = 4 + k * 10;
      for (let a = 0; a < TAU; a += 0.12) blend(n.x + Math.cos(a) * r, n.y + Math.sin(a) * r * 0.55, hex("#ffe066"), (1 - k) * 0.9);
      glow(L, W, H, n.x, n.y, 6, GOLD_RGB, 0.3 * (1 - k));
    }
    if (st.sel === id) {
      const r = 9 + Math.sin(t * 4) * 0.6;
      for (let a = 0; a < TAU; a += 0.06) { const x = n.x + Math.cos(a) * r, y = n.y + 4 + Math.sin(a) * r * 0.42; put(x, y, (a / TAU * 16 + t * 4) % 2 < 1 ? GOLD[3] : GOLD[1]); }
    }
  }
  // 迷霧：沒開的地方蓋一團雲（第 2 章的森林整片在霧裡）。雲的邊緣用雜訊切成一塊一塊，上面亮下面暗，慢慢飄
  const FOGC = [hex("#3a3a58"), hex("#5a5a7a"), hex("#8a8aaa"), hex("#b4b4cc")];
  const zones = [{ ...NODES.ch2, rx: 62, ry: 48 }, ...["1-1", "1-2", "1-3", "1-4", "endless"].filter((id) => !open(id)).map((id) => ({ x: NODES[id].x, y: NODES[id].y - LMY + 4, rx: 24, ry: 20 }))];
  for (const z of zones) for (let y = Math.max(0, Math.floor(z.y - z.ry)); y < Math.min(H, z.y + z.ry); y++) for (let x = Math.max(0, Math.floor(z.x - z.rx)); x < Math.min(W, z.x + z.rx); x++) {
    const d = Math.hypot((x - z.x) / z.rx, (y - z.y) / z.ry); if (d >= 1) continue;
    const n = vnoise(x / 9 + t * 0.12, y / 6, 51) * 0.65 + vnoise(x / 4 - t * 0.2, y / 3, 52) * 0.35;
    const v = (1 - d) * 1.6 + n - 0.75;   // 雲的厚度
    if (v < 0) continue;
    const up = vnoise((x) / 9 + t * 0.12, (y - 2) / 6, 51) * 0.65 + vnoise(x / 4 - t * 0.2, (y - 2) / 3, 52) * 0.35;
    const lit = up < n - 0.02 ? 1 : 0;   // 雲的上緣亮一階
    const k = v > 0.55 ? 3 : v > 0.3 ? 2 : v > 0.12 ? 1 : 0;
    blend(x, y, FOGC[Math.min(3, k + lit)], k === 0 ? 0.35 : k === 1 ? 0.6 : 0.85);
  }
  // 第 2 章的木牌：霧裡露出來（之後才會開）
  { const cx = NODES.ch2.x, cy = NODES.ch2.y + 4;
    for (let y = 0; y < 8; y++) put(cx, cy + y, C("#5a4434"));
    for (let y = -7; y < 0; y++) for (let x = -7; x <= 7; x++) put(cx + x, cy + y, Math.abs(x) === 7 || y === -7 || y === -1 ? C("#2a1c18") : y === -6 ? C("#b8946a") : C("#9a7a52"));
    for (const [x, y] of [[-1, -5], [0, -6], [1, -5], [1, -4], [0, -3], [0, -1]]) if (y > -7 && y < -1) put(cx + x, cy + y, C("#2a1c18")); }
}
