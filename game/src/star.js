// 主角「胖星」（B1 不透明版）：轉生成星星碎片的勇者。遵守規則v2：整數網格、1px 外框、硬邊、精簡色盤。
// 參考與做法見 docs/素材參考.md「新主角：星星碎片」。
//
// 組成：身體（胖胖的圓角星）＋兩隻鞋子＋青色領巾＋眼睛＋肚子裡的閃光。兩個側角本身就是手（使用者指定：不另外伸手出來）。
// 手＝角：每個側角是「身體上的底邊＋尖端」圍成的凸多邊形，尖端可以移動，角就跟著變長、變尖、往上翹（出拳＝角往前刺）。
// 鞋子是分開的零件，抬腳時用身體色的連接段接回下角。
// 姿勢（pose）是一組參數，不是骨架：
//   body: 0 普通、-1 壓扁（少一列）、1 拉長（多一列）    lean: 上半身往前（+）或往後（-）偏 1px
//   hf, hb: 前角／後角尖端的位移 [dx, dy]（往臉朝的方向為 +x）   ff, fb: 前腳／後腳鞋子的位移
//   eyes: "open" | "blink" | "squint"（用力）| "hurt"（><）
//   view: 身體轉到哪個角度（繞垂直軸）：0 正面、1 斜前（平常）、2 側面、3 斜後、4 背面
//         轉得越側，臉朝的那半邊拿掉越多欄（看起來越窄）；轉到背面時看不到臉，看到領巾的結；
//         肚子的光在身體裡面，從背面只透出一點點。換方向＝ 1 → 0 → 翻面 → 1；另一隻手出拳＝ 1 → 2 → 3（背面出拳）→ 2 → 1
//   core: 肚子閃光大小 0～2    scarf: 0 垂下、1 被風往後吹
// 明暗：光從左上。外緣內側一圈亮邊（左上最亮、右下背光邊也亮），裡面一圈暗帶，肚子閃光從裡面透出來 → 透明感。
import { hex } from "../../pixelfx/src/core/index.js";

const C = (s) => hex(s) >>> 0;
const OUT = C("#3a1e36");
const GLASS = ["#d08a1c", "#f5c040", "#ffe27a", "#fff4b8", "#ffffff"].map(C);
// 形態的身體顏色（暗帶 → 亮邊 → 核心）。鐵罐星的上半身還是金色，下半身另外套鐵罐（見 build 的「形態的外觀」）。
// 造型：黏液星＝草稿 S3（果凍＋滴落＋氣泡），鐵罐星＝草稿 C1（下半身鐵罐＋罐蓋），使用者 2026-11-04 選定。
const FORM_RAMPS = {
  slime: ["#1f6a3a", "#36a04a", "#6cd45a", "#b8f4a0", "#ffffff"].map(C),
};
const METAL = ["#2e3440", "#4a5468", "#6e7a90", "#9aa6ba", "#d0d8e6", "#ffffff"].map(C);
const RUST = ["#6e3218", "#a4552a"].map(C);
// 罐蓋（頭上）：# 把手、數字＝METAL 的第幾階＋1
const LID = ["....##....", "...#..#...", ".44555544.", "3444444443", ".22222221."];
const SHOE = ["#1c2448", "#2c3c78", "#4a62b0", "#7a96e0"].map(C);
const TEAL = ["#126068", "#1f8a8c", "#3cc8c0", "#9af0e0"].map(C);
const EYE = C("#40204a"), WHITE = C("#ffffff"), BLUSH = C("#ff9a6a");

// 身體左半邊（最後一格是中線）。側角的尖端留給手套，下角的底下留給鞋子。
const HALF = [
  "............###", "...........####", "...........####", "..........#####", "..........#####", ".........######",
  "....###########", "....###########", "....###########", "....###########", "....###########", "....###########",
  "......#########", ".......########", ".......########", ".......########", "......#########", ".....##########",
  "....###########", "...#########...", "...########....",
];
const BW = 29, MID = 14, WAIST = 14;          // 身體寬、中線、壓扁／拉長時增減的那一列
const SHOE_S = [".#####", "######"];          // 左鞋
const PAD = 11;                               // 畫布四周留給伸長的角和腳
// 左側角：底邊在身體上（第 4、5 欄），尖端四點；右側角左右鏡像
const ARM_BASE = [[4, 6], [5, 6], [4, 11], [5, 11]], ARM_TIP = [[2, 7], [1, 8], [1, 9], [2, 10]];
// 各角度拿掉的欄（臉朝的那半邊；避開眼睛和中線），越側越窄
const VIEW_CUT = { 1: [15, 22], 2: [5, 6, 7, 21, 22, 23], 3: [15, 22] };   // 側面避開頭頂的角（12～16 欄），兩邊各拿 3 欄
export const STAR_H = 23;                     // 腳底到頭頂（不含外框）

export const POSES = {
  stand: {},
  run: [
    { lean: 1, hf: [-2, 1], hb: [2, -1], ff: [2, 0], fb: [-2, -1], scarf: 1 },
    { lean: 1, body: -1, hf: [-1, 1], hb: [1, 0], ff: [1, -1], fb: [-1, 0], scarf: 1 },
    { lean: 1, hf: [2, -1], hb: [-2, 1], ff: [-2, -1], fb: [2, 0], scarf: 1 },
    { lean: 1, body: -1, hf: [1, 0], hb: [-1, 1], ff: [-1, 0], fb: [1, -1], scarf: 1 },
  ],
  jump: { body: 1, hf: [0, -3], hb: [0, -3], ff: [1, -2], fb: [-1, -2], scarf: 1 },
  fall: { hf: [-1, -4], hb: [1, -4], ff: [0, 1], fb: [0, 1], scarf: 1, eyes: "open" },
  land: { body: -1, hf: [-1, 2], hb: [1, 2], ff: [-1, 0], fb: [1, 0] },
  dash: { body: -1, lean: 1, hf: [-3, 0], hb: [-3, 1], ff: [-2, -1], fb: [-3, -1], scarf: 1, eyes: "squint" },
  hurt: { body: -1, lean: -1, hf: [-1, -3], hb: [1, -3], ff: [1, 0], fb: [-1, 0], eyes: "hurt", core: 0 },
  cast: { lean: 1, hf: [5, -1], hb: [-2, 1], ff: [1, 0], fb: [-1, 0], eyes: "squint", core: 2 },
  // 攻擊：前搖（手往後拉）→ 出拳（手伸長）→ 收手
  windF: { lean: -1, hf: [-3, 0], hb: [1, 1], ff: [0, 0], fb: [0, 0], eyes: "squint" },
  punchF: { lean: 1, hf: [7, 0], hb: [-2, 1], ff: [2, 0], fb: [-1, 0], eyes: "squint", scarf: 1, core: 1 },
  punchB: { lean: 1, hf: [6, -3], hb: [-2, 2], ff: [2, 0], fb: [-1, 0], eyes: "squint", scarf: 1, core: 1 },
  punchUp: { body: 1, lean: 1, hf: [5, -6], hb: [3, -5], ff: [1, -1], fb: [-1, 0], eyes: "squint", scarf: 1, core: 2 },
  // 動畫 12 原則補的格子
  // 攻擊：預備（往反方向拉、身體後仰）→ 拖影格（角拉到最長、身體拉長，誇張）→ 命中（身體壓扁、停住）→ 跟隨（角回彈過頭）→ 收
  smearF: { body: 1, lean: 1, hf: [11, -1], hb: [-3, 1], ff: [2, -1], fb: [-2, 0], eyes: "squint", scarf: 1, core: 2 },
  hitF: { body: -1, lean: 1, hf: [8, 0], hb: [-2, 2], ff: [2, 0], fb: [-2, 0], eyes: "squint", scarf: 1, core: 2 },
  followF: { lean: 0, hf: [2, 1], hb: [0, 0], ff: [1, 0], fb: [-1, 0], eyes: "squint", core: 1 },
  // 另一隻手出拳：身體扭轉，側面蓄力 → 轉到斜後方、拳（角）甩出去 → 命中時背對鏡頭 → 轉回側面 → 回到平常
  windB: { view: 2, lean: -1, hf: [-3, 1], hb: [-2, -1], ff: [1, 0], fb: [-1, 0], eyes: "squint" },
  smearB: { view: 3, body: 1, lean: 1, hf: [11, -2], hb: [-3, 1], ff: [2, -1], fb: [-2, 0], scarf: 1 },
  hitB: { view: 3, body: -1, lean: 1, hf: [8, -1], hb: [-2, 2], ff: [2, 0], fb: [-2, 0], scarf: 1 },
  followB: { view: 2, hf: [3, 0], hb: [0, 1], ff: [1, 0], fb: [-1, 0], eyes: "squint" },
  back: { view: 4 },
  smearUp: { body: 1, lean: 1, hf: [4, -9], hb: [2, -6], ff: [1, -2], fb: [-1, -1], eyes: "squint", scarf: 1, core: 2 },
  // 跳：起跳拉長 → 最高點放鬆（漸慢）→ 下落越快越拉長；落地壓扁 → 回彈
  apex: { hf: [-1, -2], hb: [1, -2], ff: [1, -1], fb: [-1, -1], scarf: 1 },
  fallFast: { body: 1, hf: [-1, -5], hb: [1, -5], ff: [0, 1], fb: [0, 1], scarf: 1, eyes: "squint" },
  landUp: { body: 1, hf: [0, -1], hb: [0, -1], ff: [0, 0], fb: [0, 0] },
  // 轉身中間那一格（正面）
  turn: { view: 0, body: -1, hf: [0, -1], hb: [0, -1] },
  // 大招
  charge: { body: -1, view: 0, hf: [-2, 3], hb: [2, 3], ff: [-1, 0], fb: [1, 0], eyes: "squint", core: 2 },
  rise: { body: 1, view: 0, hf: [-1, -7], hb: [1, -7], ff: [0, -1], fb: [0, -1], scarf: 1, core: 2 },
  throw: { lean: 1, hf: [6, 3], hb: [-3, -2], ff: [1, -1], fb: [-2, -2], eyes: "squint", scarf: 1, core: 1 },
  finish: { body: -1, lean: 1, hf: [5, 4], hb: [-3, 0], ff: [2, 0], fb: [-2, 0], eyes: "squint", core: 2 },
};
// 待機 8 格：主要動作是肚子的閃光一閃一亮（星星的個性），第 6 格眨眼；身體不動、腳不滑。
POSES.idle = [0, 1, 2, 2, 1, 0, 0, 0].map((core, i) => ({ core, eyes: i === 6 ? "blink" : "open", hf: [0, i >= 2 && i <= 4 ? -1 : 0], hb: [0, i >= 3 && i <= 5 ? -1 : 0] }));

// 凸多邊形：包住所有點的外殼，再判斷格子中心在不在裡面
function convexHull(p) {
  p = p.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
function inHull(h, x, y) {
  for (let i = 0; i < h.length; i++) {
    const a = h[i], b = h[(i + 1) % h.length];
    if ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]) < -0.01 * Math.hypot(b[0] - a[0], b[1] - a[1])) return false;
  }
  return true;
}

// ---- 組一個姿勢的像素（快取）
const cache = new Map();
function build(q) {
  const key = JSON.stringify(q);
  if (cache.has(key)) return cache.get(key);
  const body = q.body ?? 0, lean = q.lean ?? 0, G = FORM_RAMPS[q.form] ?? GLASS;
  const rows = HALF.slice();
  if (body < 0) rows.splice(WAIST, 1);
  if (body > 0) rows.splice(WAIST, 0, HALF[WAIST]);
  const BH = rows.length, W = BW + PAD * 2, H = BH + 2 + PAD * 2, top = PAD + 1 + (HALF.length - BH);   // 腳底固定
  const mat = Array.from({ length: H }, () => new Array(W).fill(0));   // 0 空、1 身體、2 手套、3 鞋子
  const shift = (r) => (r < WAIST ? lean : 0);                          // 上半身前傾
  rows.forEach((row, r) => [...row].forEach((ch, i) => {
    if (ch !== "#") return;
    const y = top + r, s = shift(r);
    mat[y][PAD + i + s] = 1;
    mat[y][PAD + BW - 1 - i + s] = 1;
  }));
  const rowOf = (y) => (y < WAIST ? y : y + body);   // 原圖的第幾列 → 這個姿勢的第幾列
  const at = (x, y, v) => { if (x >= 0 && y >= 0 && x < W && y < H && !mat[y][x]) mat[y][x] = v; };
  // 連接段：兩點之間畫 3px 粗的身體色線
  const bridge = (x0, y0, x1, y1) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let k = 0; k <= n; k++) {
      const x = Math.round(x0 + ((x1 - x0) * k) / (n || 1)), y = Math.round(y0 + ((y1 - y0) * k) / (n || 1));
      at(x, y - 1, 1); at(x, y, 1); at(x, y + 1, 1);
    }
  };
  // 側角＝手：底邊＋（移動後的）尖端圍成凸多邊形，整塊填成身體。前角在右（臉朝右時）；dx 往右為 +
  const arm = (side, [dx, dy]) => {
    const mx = (x) => (side < 0 ? x : BW - 1 - x);
    let pts = [...ARM_BASE, ...ARM_TIP].map(([x, y]) => [mx(x), y]);
    if (dx || dy) {
      // 伸出去的角：從肩膀（底邊中心）到尖端是一個漸細的楔形。保持體積（立體感）：
      // 底邊寬 6，尖端寬隨長度變細，但最細 3 格，不會變成細線；尖端多一點圓頭。
      const bx = mx(4.5), by = 8.5, tx = mx(1.5) + dx, ty = 8.5 + dy;
      const len = Math.hypot(tx - bx, ty - by) || 1, ux = (tx - bx) / len, uy = (ty - by) / len, nx = -uy, ny = ux;
      const hb = 3, ht = Math.max(1.5, 2.2 - (len - 3) * 0.08);
      pts = [[bx + nx * hb, by + ny * hb], [bx - nx * hb, by - ny * hb], [tx + nx * ht, ty + ny * ht], [tx - nx * ht, ty - ny * ht],
        [tx + ux * 0.9 + nx * ht * 0.5, ty + uy * 0.9 + ny * ht * 0.5], [tx + ux * 0.9 - nx * ht * 0.5, ty + uy * 0.9 - ny * ht * 0.5],
        ...ARM_BASE.map(([x, y]) => [mx(x), y])];
    }
    pts = pts.map(([x, y]) => [PAD + x + lean, top + y]);
    const hull = convexHull(pts);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
      if (inHull(hull, x, y)) mat[y][x] = 1;
    }
  };
  arm(-1, q.hb ?? [0, 0]);
  arm(1, q.hf ?? [0, 0]);
  // 鞋子：前腳在右
  const shoe = (side, [dx, dy]) => {
    const bx = side < 0 ? PAD + 2 : PAD + BW - 8, by = top + BH + dy, ox = bx + dx;
    const rootX = side < 0 ? PAD + 6 : PAD + BW - 7, rootY = top + BH - 1;
    if (dy < 0 || Math.abs(dx) > 1) bridge(rootX, rootY, ox + 3, by);
    SHOE_S.forEach((r, j) => [...r].forEach((ch, i) => {
      if (ch !== "#") return;
      const x = side < 0 ? ox + i : ox + 5 - i;
      mat[by + j][x] = 3;
    }));
  };
  shoe(-1, q.fb ?? [0, 0]);
  shoe(1, q.ff ?? [0, 0]);

  // 到外緣的距離（亮邊、暗帶用）
  const empty = (x, y) => x < 0 || y < 0 || x >= W || y >= H || !mat[y][x];
  const dist = Array.from({ length: H }, () => new Array(W).fill(0));
  let qq = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (mat[y][x] === 1 && (empty(x - 1, y) || empty(x + 1, y) || empty(x, y - 1) || empty(x, y + 1) || mat[y][x - 1] > 1 || mat[y][x + 1] > 1 || mat[y - 1]?.[x] > 1 || mat[y + 1]?.[x] > 1)) { dist[y][x] = 1; qq.push([x, y]); }
  while (qq.length) {
    const nq = [];
    for (const [x, y] of qq) for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + a, ny = y + b;
      if (mat[ny]?.[nx] === 1 && !dist[ny][nx]) { dist[ny][nx] = dist[y][x] + 1; nq.push([nx, ny]); }
    }
    qq = nq;
  }
  const view = q.view ?? 1, back = view >= 3;
  const cx = PAD + MID, cy = top + rowOf(15), core = back ? 0 : q.core ?? 1;
  const px = Array.from({ length: H }, () => new Array(W).fill(0));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const m = mat[y][x];
    if (!m) continue;
    const tl = empty(x - 1, y) || empty(x, y - 1), br = empty(x + 1, y) || empty(x, y + 1);
    if (m === 3) { px[y][x] = SHOE[tl ? 3 : br ? 1 : 2]; continue; }
    const d = dist[y][x], side = (x - cx) + (y - cy) > 2, r = Math.hypot((x - cx) * 0.9, y - cy);
    const arm = core === 0 ? 0 : core;
    const plus = (x === cx && Math.abs(y - cy) <= arm) || (y === cy && Math.abs(x - cx) <= arm);
    let c;
    if (plus) c = back ? G[3] : G[4];   // 背面：光隔著身體，只透出淡淡一點
    else if (r < 1.6 + core * 0.6) c = G[3];
    else if (d === 1) c = tl ? G[3] : G[2];
    else if (d === 2) c = side ? G[1] : G[2];
    else if (r < 3.4 + core * 0.6) c = G[2];
    else c = side ? G[0] : G[1];
    px[y][x] = c;
  }
  const put = (x, y, c) => { const X = PAD + x + (y < WAIST ? lean : 0), Y = top + rowOf(y); if (mat[Y]?.[X]) px[Y][X] = c; };
  // 眼睛
  const lk = view === 1 ? 1 : 0, eyes = back ? "none" : q.eyes ?? "open";
  // 側面只看得到前面那隻眼睛
  for (const ex of view === 2 ? [18] : [10 + lk, 17 + lk]) {
    if (eyes === "open") { for (let y = 9; y < 12; y++) { put(ex, y, EYE); put(ex + 1, y, EYE); } put(ex, 9, WHITE); }
    else if (eyes === "squint") { for (let y = 10; y < 12; y++) { put(ex, y, EYE); put(ex + 1, y, EYE); } put(ex, 10, WHITE); }
    else if (eyes === "blink") { put(ex, 11, EYE); put(ex + 1, 11, EYE); }
  }
  if (eyes === "hurt") { for (const [x, y] of view === 2 ? [[19, 9], [18, 10], [19, 11]] : [[10, 9], [11, 10], [10, 11], [18, 9], [17, 10], [18, 11]]) put(x, y, EYE); }
  if (!back) { if (view !== 2) put(9 + lk, 12, BLUSH); put(view === 2 ? 20 : 19 + lk, 12, BLUSH); }
  // 青色領巾：一圈＋前面的三角；被風吹時三角往後、尾巴飄出身體
  for (let x = 9; x <= 19; x++) put(x, 5, TEAL[x < 13 ? 3 : x > 16 ? 1 : 2]);
  if (back) {
    // 背面：領巾在後面打結，兩條尾巴垂下（被風吹時往後飄）
    const kx = view === 4 ? 14 : 12;
    put(kx - 1, 5, TEAL[3]); put(kx, 5, TEAL[2]); put(kx + 1, 5, TEAL[3]); put(kx, 6, TEAL[1]);
    if (q.scarf) { put(kx - 1, 7, TEAL[2]); put(kx - 2, 7, TEAL[1]); put(kx + 1, 7, TEAL[2]); put(kx - 2, 8, TEAL[1]); }
    else { put(kx - 1, 7, TEAL[2]); put(kx - 1, 8, TEAL[1]); put(kx + 1, 7, TEAL[2]); put(kx + 1, 8, TEAL[1]); }
  } else if (view === 2) { put(18, 6, TEAL[2]); put(19, 6, TEAL[1]); put(19, 7, TEAL[1]); }   // 側面：領巾的三角在前緣
  else if (q.scarf) { put(12, 6, TEAL[2]); put(13, 6, TEAL[1]); put(11, 6, TEAL[1]); }
  else { put(13, 6, TEAL[2]); put(14, 6, TEAL[1]); put(15, 6, TEAL[1]); put(14, 7, TEAL[1]); }
  // 左上的玻璃反光
  for (const [x, y] of [[6, 7], [7, 7], [7, 8]]) put(x, y, WHITE);
  put(13, 2, WHITE);
  // 領巾尾巴（身體外，往後飄）
  if (q.scarf) {
    const X = PAD + 8 + lean, Y = top + 5;
    for (const [dx, dy, t] of [[0, 0, 2], [-1, 0, 2], [-2, 1, 1], [-3, 1, 1]]) if (!mat[Y + dy][X + dx]) { mat[Y + dy][X + dx] = 4; px[Y + dy][X + dx] = TEAL[t]; }
  }
  // ---- 形態的外觀
  const putX = (x, y, c, upper = false) => {   // 可以畫在身體外面（滴落、罐蓋），會一起描外框；upper：跟著上半身前傾
    const X = PAD + Math.round(x) + (upper || y < WAIST ? lean : 0), Y = top + (upper ? Math.round(y) : rowOf(Math.round(y)));
    if (Y < 0 || Y >= H || X < 0 || X >= W) return;
    if (!mat[Y][X]) mat[Y][X] = 4;
    px[Y][X] = c;
  };
  const onBody = (x, y) => mat[top + rowOf(y)]?.[PAD + x + (y < WAIST ? lean : 0)] === 1;
  if (q.form === "slime") {
    // 兩隻手的尖端往下滴（跟著角移動）、肚子下面一滴、身體裡三個氣泡、兩個濕亮的高光
    for (const [side, [dx, dy]] of [[-1, q.hb ?? [0, 0]], [1, q.hf ?? [0, 0]]]) {
      const tx = (side < 0 ? 1.5 : BW - 2.5) + dx, ty = Math.round(8.5 + dy);
      const drip = side < 0 ? [[0, 2, 2], [0, 3, 1], [0, 4, 1]] : [[0, 2, 2], [0, 3, 2], [0, 4, 1], [0, 5, 1]];
      // 只在角的尖端正下方是空的時候滴；碰到別的東西（腳、地面附近）就停，不黏成一團
      if (view === 2 || dy > 2 || mat[top + ty + 1]?.[PAD + Math.round(tx) + lean] !== 1) continue;   // 側面時兩隻手重疊，不滴
      for (const [ox, oy, k] of drip) {
        const X = PAD + Math.round(tx + ox) + lean, Y = top + ty + oy;
        if (mat[Y]?.[X] || mat[Y]?.[X - 1] || mat[Y]?.[X + 1] || mat[Y + 1]?.[X] || mat[Y + 2]?.[X]) break;
        putX(tx + ox, ty + oy, G[k], true);
      }
    }
    if (!back) for (const [x, y, k] of [[11, 19, 2], [11, 20, 1]]) if (!onBody(x, y)) putX(x, y, G[k]);
    for (const [cx2, cy2] of [[8, 15], [19, 17], [16, 8]]) for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) if (onBody(cx2 + dx, cy2 + dy) && px[top + rowOf(cy2 + dy)][PAD + cx2 + dx + (cy2 + dy < WAIST ? lean : 0)] !== EYE) put(cx2 + dx, cy2 + dy, G[3]);
    if (!back) for (const [x, y] of [[20, 14], [21, 15], [9, 3]]) put(x, y, G[4]);
  }
  if (q.form === "can") {
    // 下半身套著鐵罐：每一列左亮右暗的縱向亮帶，上緣凸紋一亮一暗，底下暗一階；肚子的光、眼睛、領巾不蓋
    const skip = new Set([EYE, WHITE, BLUSH, ...TEAL, G[4]]);
    for (let y = 13; y <= 20; y++) {
      const Y = top + rowOf(y), xs = [];
      for (let X = 0; X < W; X++) if (mat[Y][X] === 1 && !skip.has(px[Y][X])) xs.push(X);
      if (!xs.length) continue;
      const a = Math.min(...xs), w = Math.max(...xs) - a + 1;
      for (const X of xs) {
        const u = (X - a) / w;
        let k = u < 0.12 ? 3 : u < 0.3 ? 4 : u < 0.55 ? 3 : u < 0.8 ? 2 : 1;
        if (y === 13) k = Math.min(5, k + 1); else if (y === 14) k = Math.max(0, k - 1); else if (y === 20) k = Math.max(0, k - 1);
        px[Y][X] = METAL[k];
      }
    }
    for (const [x, y, k] of back ? [[17, 16, 1], [18, 16, 0]] : [[10, 16, 1], [11, 16, 0], [19, 18, 1]]) if (onBody(x, y)) put(x, y, RUST[k]);
    LID.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== ".") putX(9 + i, j - 3, ch === "#" ? METAL[3] : METAL[+ch - 1]); }));
  }
  // 側身：臉朝的那半邊往後轉，拿掉兩欄（看起來比正面窄）
  for (const c of (VIEW_CUT[view] ?? []).map((c) => PAD + c + lean).sort((a, b) => b - a)) {
    for (let y = 0; y < H; y++) { mat[y].splice(c, 1); mat[y].push(0); px[y].splice(c, 1); px[y].push(0); }
  }
  // 外框
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (mat[y][x]) continue;
    if (!empty(x - 1, y) || !empty(x + 1, y) || !empty(x, y - 1) || !empty(x, y + 1)) px[y][x] = OUT;
  }
  const hfq = q.hf ?? [0, 0];
  // 拿掉中線左邊的欄時，中線也跟著左移，腳底的基準點要一起移（不然身體會跳）
  const cuts = VIEW_CUT[view] ?? [], nl = cuts.filter((c) => c < MID).length, nr = cuts.length - nl;
  const out = { px, W, H, ax: PAD + MID - nl, ay: top + BH + 1, core: [0, cy - (top + BH + 1)], hand: [BW - 2 - MID + hfq[0] - nr, 8.5 + hfq[1] - BH - 1] };
  cache.set(key, out);
  return out;
}
export const starPixels = build;

/**
 * 把主角畫到 frame。x, y 是腳底（世界座標），flip 是臉朝左。
 * tint：整個剪影換成單色（受擊閃白、閃避殘影）。glow：身體四周柔和的光（特效層）。
 */
export function paintStar(frame, x, y, q, flip, { tint = 0, glow = 1, form = null } = {}) {
  const s = build(form && form !== "star" ? { ...q, form } : q), Wf = frame.w, Hf = frame.h, Cc = frame.color, L = frame.light;
  const ox = Math.round(x) - (frame.ox | 0), oy = Math.round(y) - (frame.oy | 0);
  for (let j = 0; j < s.H; j++) {
    const py = oy + j - s.ay;
    if (py < 0 || py >= Hf) continue;
    for (let i = 0; i < s.W; i++) {
      const c = s.px[j][i];
      if (!c) continue;
      const px = ox + (flip ? s.ax - i : i - s.ax);
      if (px < 0 || px >= Wf) continue;
      Cc[py * Wf + px] = tint || c;
    }
  }
  if (glow > 0 && !tint) {
    // 柔光：以肚子閃光為中心，半徑約 18px
    const gx = ox + (flip ? -s.core[0] : s.core[0]), gy = oy + s.core[1], R = 18;
    for (let j = -R; j <= R; j++) {
      const py = gy + j;
      if (py < 0 || py >= Hf) continue;
      for (let i = -R; i <= R; i++) {
        const px = gx + i;
        if (px < 0 || px >= Wf) continue;
        const f = 1 - Math.hypot(i, j) / R;
        if (f <= 0) continue;
        // 光只灑在主角周圍，不蓋在自己身上（身體的明暗要保留）
        const sx = flip ? s.ax - (px - ox) : px - ox + s.ax, sy = py - oy + s.ay;
        if (s.px[sy]?.[sx]) continue;
        const k = f * f * 48 * glow, l = L[py * Wf + px];
        L[py * Wf + px] = 0xff000000 | (Math.min(255, ((l >>> 16) & 255) + k * 0.35) << 16) | (Math.min(255, ((l >>> 8) & 255) + k * 0.8) << 8) | Math.min(255, (l & 255) + k);
      }
    }
  }
}
/** 前手套目前的位置（相對腳底，臉朝右），給特效（火球、大招星核）對位用 */
export const handOf = (q) => build(q).hand;
