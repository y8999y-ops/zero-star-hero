// 立體多角星（金色水晶）草稿：兩個三角錐交叉的「星形八面體」，從正面斜上方看是一個六角星。
//   node game/tools/drafts/crystal-star.mjs out.png
// 做法：用 3D 頂點算出每個像素屬於哪一個面（轉身時每個面都對得上），頂點先四捨五入到整數格，
// 邊就是兩個整數點之間的直線，階梯規律（符合規則v2）。每個面一個實色（面朝光越亮），
// 凸起的稜線亮一階、凹下去的摺線暗一階，中心最靠近鏡頭的尖點放一顆光點當表情。外框 1px。
// 參考：使用者提供的摺紙立體星照片、Wikimedia Commons 的星形八面體、PixelFX pickups/gem-spin（轉動時亮面移動）、
// pickups/crystal-shard（金色水晶配色、內部透光）、Clip Studio「Coloring Gems and Crystals」（面朝光最亮、稜線高光）。
import { writeFileSync } from "node:fs";
import { encodePNG } from "../../../pixelfx/tools/lib/png.mjs";

const hex = (s) => [1, 3, 5].map((k) => parseInt(s.slice(k, k + 2), 16));
const OUT = "#3a1e36";
const GOLD = ["#6a3a10", "#a0600e", "#d48a1a", "#f2b830", "#ffd85a", "#ffeea0", "#fffbe0"];

// ---- 幾何：立方體的 8 個角，偶數組成第一個三角錐、奇數組成第二個
const CUBE = [];
for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) CUBE.push([x, y, z]);
const parity = (v) => (v[0] * v[1] * v[2] > 0 ? 0 : 1);
const TET = [0, 1].map((p) => CUBE.map((v, i) => [v, i]).filter(([v]) => parity(v) === p).map(([, i]) => i));
const FACES = [];
TET.forEach((t, ti) => {
  for (let k = 0; k < 4; k++) FACES.push({ v: t.filter((_, j) => j !== k), tet: ti, opp: t[k] });
});

// 旋轉：讓 (1,1,1) 朝向鏡頭（+z），再讓某個角朝上
const norm = (a) => { const l = Math.hypot(...a); return a.map((x) => x / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => a.map((x, i) => x - b[i]);
const Z = norm([1, 1, 1]);
const upGuess = [-1, -1, 1];                                        // 這個角會在正上方
const Y = norm(sub(upGuess, Z.map((z) => z * dot(upGuess, Z))));
const X = cross(Y, Z);
// 觀看角度：用 fit-view.mjs 對照片的 7 個尖角位置擬合出來（中心尖點朝鏡頭，左、右、下三個尖角在前面）
const FIT = { a: 5.49349725675392, b: 5.721242392121849, c: 3.1382244304661717 };
const base = (v) => {
  let [x, y, z] = v;
  [x, z] = [x * Math.cos(FIT.a) + z * Math.sin(FIT.a), -x * Math.sin(FIT.a) + z * Math.cos(FIT.a)];
  [y, z] = [y * Math.cos(FIT.b) - z * Math.sin(FIT.b), y * Math.sin(FIT.b) + z * Math.cos(FIT.b)];
  [x, y] = [x * Math.cos(FIT.c) - y * Math.sin(FIT.c), x * Math.sin(FIT.c) + y * Math.cos(FIT.c)];
  return [x, y, z];
};
const CAM = 4.2;   // 透視：鏡頭距離（立方體單位）。前面的尖角大、後面的小，才像照片那樣立體
const LIGHT = norm([-0.6, 0.7, 0.55]);                              // 光從左上前方

/**
 * 算一個姿勢的像素。opt：yaw 轉身（弧度，+ 是臉朝右）、tilt 俯角、size 半徑（像素）、
 * pull：每個角的位移 { top, ul, ur, ll, lr, bottom }（螢幕方向的 [dx, dy]，單位：半徑的比例）、bottomK 下面那個角縮短的比例。
 */
function render(opt = {}) {
  const { yaw = 0, tilt = 0, size = 16, bottomK = 1, eyes = true, armK = 1, pull = {}, core = "#ffffff", coreRing = GOLD[6] } = opt;
  // 先在正面座標裡找出六個外角，套用縮短與位移
  const P = CUBE.map(base);
  const front = P.findIndex((p) => p[2] > 1.7), back = P.findIndex((p) => p[2] < -1.7);
  const outer = P.map((p, i) => [p, i]).filter(([, i]) => i !== front && i !== back);
  const nameOf = (p) => {
    const a = (Math.atan2(p[1], p[0]) * 180) / Math.PI;
    const r = (d) => Math.abs(((a - d + 540) % 360) - 180) < 20;
    return r(90) ? "top" : r(150) ? "ul" : r(30) ? "ur" : r(-150) ? "ll" : r(-30) ? "lr" : "bottom";
  };
  const Q = P.map((p) => p.slice());
  for (const [p, i] of outer) {
    const n = nameOf(p);
    if (n === "bottom") Q[i] = p.map((x) => x * bottomK);
    if (n === "ul" || n === "ur") Q[i] = p.map((x) => x * armK);
    const d = pull[n];
    if (d) { Q[i][0] += d[0]; Q[i][1] += d[1]; }
  }
  // 轉身（繞垂直軸）＋俯角
  const cy = Math.cos(yaw), sy = Math.sin(yaw), ct = Math.cos(tilt), st = Math.sin(tilt);
  const T = Q.map(([x, y, z]) => { const x1 = x * cy + z * sy, z1 = -x * sy + z * cy; return [x1, y * ct - z1 * st, y * st + z1 * ct]; });
  const R = Math.ceil(size * 2.2) + 4, W = R * 2 + 1, H = R * 2 + 1;
  const scr = T.map(([x, y, z]) => { const k = CAM / (CAM - z); return [Math.round(R + x * k * size / 1.7), Math.round(R - y * k * size / 1.7), z]; });
  const fid = new Int16Array(W * H).fill(-1), zb = new Float32Array(W * H).fill(-1e9);
  const faces = FACES.map((f) => {
    let [a, b, c] = f.v.map((i) => T[i]);
    let n = norm(cross(sub(b, a), sub(c, a)));
    const cen = [a, b, c].reduce((s, p) => s.map((x, i) => x + p[i] / 3), [0, 0, 0]);
    if (dot(n, sub(cen, T[f.opp])) < 0) n = n.map((x) => -x);
    return { ...f, n };
  });
  faces.forEach((f, k) => {
    const [a, b, c] = f.v.map((i) => scr[i]);
    const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (Math.abs(area) < 0.5) return;
    const x0 = Math.min(a[0], b[0], c[0]), x1 = Math.max(a[0], b[0], c[0]), y0 = Math.min(a[1], b[1], c[1]), y1 = Math.max(a[1], b[1], c[1]);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5 - 0.5, py = y + 0.5 - 0.5;   // 頂點在格子中心
      const w0 = ((b[0] - px) * (c[1] - py) - (b[1] - py) * (c[0] - px)) / area;
      const w1 = ((c[0] - px) * (a[1] - py) - (c[1] - py) * (a[0] - px)) / area;
      const w2 = 1 - w0 - w1;
      if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
      const z = w0 * a[2] + w1 * b[2] + w2 * c[2];
      const i = y * W + x;
      if (z > zb[i]) { zb[i] = z; fid[i] = k; }
    }
  });
  // 每個面的明暗：面朝光越亮；朝鏡頭越多也稍亮（水晶透光）
  const tone = faces.map((f) => {
    const l = dot(f.n, LIGHT), v = Math.max(0, f.n[2]);
    return Math.max(0, Math.min(5, Math.round(1.7 + l * 2.3 + v * 1.3)));   // 朝下的面也透一點光（水晶）
  });
  const px = new Array(W * H).fill(null);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, k = fid[i];
    if (k < 0) continue;
    let t = tone[k];
    // 稜線與摺線：跟右邊或下面的面不同時
    for (const j of [i + 1, i + W]) {
      const k2 = fid[j];
      if (k2 >= 0 && k2 !== k) {
        const ridge = faces[k].tet === faces[k2].tet;   // 同一個三角錐的兩個面＝凸起的稜；不同的＝凹下去的摺
        t = ridge ? Math.max(t, tone[k2]) + 1 : Math.min(t, tone[k2]) - 1;
        break;
      }
    }
    px[i] = t;
  }
  // 中心光點：最靠近鏡頭的那個尖點；光從裡面透出來，附近的面亮一階（水晶的透明感）
  const [fx, fy] = scr[front];
  for (let i = 0; i < W * H; i++) {
    if (px[i] === null) continue;
    const d = Math.hypot((i % W) - fx, Math.floor(i / W) - fy);
    px[i] = GOLD[Math.max(0, Math.min(6, px[i] + (d < 5.5 ? 1 : 0)))];
  }
  const cpx = [[0, 0, core], [1, 0, coreRing], [-1, 0, coreRing], [0, 1, coreRing], [0, -1, coreRing]];
  for (const [dx, dy, c] of cpx) { const i = (fy + dy) * W + fx + dx; if (px[i]) px[i] = c; }
  // 眼睛：中心尖點左上、右上的兩個大面上（2×3，左上一顆白色高光），跟著轉身偏移
  if (eyes) {
    // 眼睛是貼在 3D 面上的點，跟著轉身一起轉（不是平移）
    const F = Q[front];
    for (const side of [-1, 1]) {
      const e = [F[0] + side * 0.4, F[1] + 0.26, F[2] - 0.12];
      const x1 = e[0] * cy + e[2] * sy, z1 = -e[0] * sy + e[2] * cy, y1 = e[1] * ct - z1 * st, z2 = e[1] * st + z1 * ct;
      const k = CAM / (CAM - z2), ex = Math.round(R + x1 * k * size / 1.7) - 1, ey = Math.round(R - y1 * k * size / 1.7) - 1;
      for (let y = ey; y < ey + 3; y++) for (let x = ex; x < ex + 2; x++) { const i = y * W + x; if (px[i]) px[i] = x === ex && y === ey ? "#ffffff" : "#40204a"; }
    }
  }
  // 外框
  const out = px.slice();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (px[i]) continue;
    if ((x > 0 && px[i - 1]) || (x < W - 1 && px[i + 1]) || (y > 0 && px[i - W]) || (y < H - 1 && px[i + W])) out[i] = OUT;
  }
  return { px: out, W, H, core: [fx, fy] };
}

function lint(name, s) {
  const at = (x, y) => (x < 0 || y < 0 || x >= s.W || y >= s.H ? null : s.px[y * s.W + x]);
  const bad = [];
  for (let y = 0; y < s.H; y++) for (let x = 0; x < s.W; x++) {
    const c = at(x, y);
    if (!c) continue;
    const nb = [at(x + 1, y), at(x - 1, y), at(x, y + 1), at(x, y - 1)];
    if (c === OUT && at(x + 1, y) === OUT && at(x, y + 1) === OUT && at(x + 1, y + 1) === OUT) bad.push(`腫塊(${x},${y})`);
    if (c === OUT && !nb.some((v) => v && v !== OUT)) bad.push(`雙層邊(${x},${y})`);
    if (c !== OUT && !nb.some((v) => v && v !== OUT)) bad.push(`孤立點(${x},${y})`);
  }
  console.log(name.padEnd(14), `顏色 ${new Set(s.px.filter(Boolean)).size}`, bad.length ? bad.join(" ") : "規則檢查通過");
}

const TEAL_CORE = { core: "#ffffff", coreRing: "#5ae8d8" };
const DRAFTS = [
  ["E1 照片比例", {}],
  ["E2 照片比例＋青色光點", { ...TEAL_CORE }],
  ["E3 青色光點＋臉朝右", { yaw: 0.2, ...TEAL_CORE }],
];
const TURN = [0.3, 0.15, 0, -0.15, -0.3].map((yaw) => ({ yaw, ...TEAL_CORE }));

const big = DRAFTS.map(([n, o]) => { const s = render(o); lint(n, s); return s; });
const turn = TURN.map((o, i) => { const s = render(o); lint("轉身" + i, s); return s; });

// ---- 圖：上排三個草稿（放大 7 倍，含柔光），中排剪影，下排轉身五格（放大 4 倍）＋遊戲大小
const K = 7, cell = big[0].W * K + 20, Wt = Math.max(cell * 3, turn.length * (turn[0].W * 4 + 10)) + 20;
const Ht = big[0].H * K + 20 + big[0].H * 3 + 20 + turn[0].H * 4 + 20 + 80;
const img = new Float32Array(Wt * Ht * 3);
const setPx = (x, y, c) => { if (x < 0 || y < 0 || x >= Wt || y >= Ht) return; const i = (y * Wt + x) * 3, [r, g, b] = hex(c); img[i] = r; img[i + 1] = g; img[i + 2] = b; };
const addPx = (x, y, [r, g, b], k) => { if (x < 0 || y < 0 || x >= Wt || y >= Ht) return; const i = (y * Wt + x) * 3; img[i] += r * k; img[i + 1] += g * k; img[i + 2] += b * k; };
const rect = (x0, y0, w, h, c) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) setPx(x, y, c); };
rect(0, 0, Wt, Ht, "#1a2a30");
const draw = (s, x0, y0, k, { sil = false, glow = 0, glowCol = "#ffc850" } = {}) => {
  if (glow) {
    const R = 22 * k, cx = x0 + (s.core[0] + 0.5) * k, cy = y0 + (s.core[1] + 0.5) * k;
    for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) { const f = 1 - Math.hypot(x, y) / R; if (f > 0) addPx(Math.round(cx + x), Math.round(cy + y), hex(glowCol), f * f * 0.4 * glow); }
  }
  for (let y = 0; y < s.H; y++) for (let x = 0; x < s.W; x++) {
    const c = s.px[y * s.W + x];
    if (c) rect(x0 + x * k, y0 + y * k, k, k, sil ? "#0c0a12" : c);
  }
};
big.forEach((s, n) => draw(s, 10 + n * cell, 10, K, { glow: 1, glowCol: n === 2 ? "#7ae8d8" : "#ffc850" }));
const y1 = big[0].H * K + 30;
big.forEach((s, n) => { rect(10 + n * cell, y1 - 4, cell - 20, s.H * 3 + 8, "#8a90a8"); draw(s, 10 + n * cell + (cell - 20 - s.W * 3) / 2, y1, 3, { sil: true }); });
const y2 = y1 + big[0].H * 3 + 20;
turn.forEach((s, n) => draw(s, 10 + n * (s.W * 4 + 10), y2, 4, { glow: 1, glowCol: "#7ae8d8" }));
const y3 = y2 + turn[0].H * 4 + 10;
rect(0, y3, Wt, 70, "#1c3438"); rect(0, y3 + 56, Wt, 14, "#2a2a3a"); rect(0, y3 + 56, Wt, 2, "#4c8a3c");
big.forEach((s, n) => draw(s, 40 + n * cell, y3 + 56 - Math.round(s.H * 2 * 0.82), 2, { glow: 1, glowCol: n === 2 ? "#7ae8d8" : "#ffc850" }));
const out = new Uint8Array(Wt * Ht * 4);
for (let i = 0; i < Wt * Ht; i++) { out[i * 4] = Math.min(255, img[i * 3]); out[i * 4 + 1] = Math.min(255, img[i * 3 + 1]); out[i * 4 + 2] = Math.min(255, img[i * 3 + 2]); out[i * 4 + 3] = 255; }
writeFileSync(process.argv[2], encodePNG(Wt, Ht, out));
console.log("wrote", process.argv[2]);
