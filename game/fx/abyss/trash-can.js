// 垃圾桶怪（重畫版）：有凸紋的街頭鐵垃圾桶，兩隻短腳穿著不成對的靴子，眼睛從蓋子縫裡偷看。
// 走路：8 格循環，身體上下彈，蓋子慢一格才跟著喀喀跳（跟隨與延遲）。
// 咬人：蹲低蓄力 → 蓋子往後翻開露出牙齒和舌頭 → 停住 → 啪一聲闔上 → 回原位。
// 參考：Recycle Items 的鐵罐、Spidrbot 與 Space Merc 圓桶的金屬明暗、Animated Slime 的眼睛（docs/素材參考.md）。
// 規則：整數格、1px 外框、圓柱用縱向亮帶表現、鏽斑固定位置（不用隨機雜訊）、不抖色。
import { hex } from "../../../pixelfx/src/core/index.js";

export const meta = {
  name: "Trash can mimic",
  desc: "A ribbed street trash can on two stubby legs in odd boots: eyes peek from under the lid as it waddles and the lid chatters a beat late; to bite it crouches, flips the lid back on teeth and a tongue, and snaps shut.",
  tags: ["critter", "monster", "trash", "mimic", "loop"],
  size: [72, 64],
  origin: [34, 58],
  duration: 0.8,
  loop: true,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#101318", "#1f272c", "#313d42", "#485a5c", "#667a78", "#8ea29c", "#c4d4cc"],
    rust: ["#3a1a10", "#6e3218", "#a4552a", "#cf7c3c"],
    eyes: ["#5a2a00", "#c07a10", "#ffd84a", "#fff6c0"],
    mode: "walk",
    seed: 3,
  },
};

// ---- 零件（數字是 palette 的第幾階，r0..r3 用 rust，'.' 空白；外框最後自動描）
// 桶身每一欄的明暗：左邊亮帶，右邊暗邊（圓柱）
const COL = [3, 4, 6, 6, 5, 5, 4, 4, 4, 4, 4, 4, 3, 3, 3, 2, 2, 1];
const BODY_H = 22, BODY_W = 18;
const RIBS = [5, 13];                                  // 凸紋：這一列亮、下一列暗
const RUST = [[13, 8, 1], [14, 8, 2], [14, 9, 1], [12, 16, 2], [13, 16, 1], [13, 17, 1], [5, 15, 1], [5, 16, 1], [5, 17, 0]];

// 蓋子（20 寬，比桶身左右各多 1）
const LID = [
  ".......4444.........",
  ".......4..4.........",
  "....556666555544....",
  "..55666666555544433.",
  "33444444444443333221",
];
// 蓋子往後翻開（咬人時）：立在桶身後緣，看到的是內側（暗）
const LID_UP = [
  ".43.",
  "4432",
  "4322",
  "4322",
  "4322",
  "4322",
  "4322",
  "4322",
  "4322",
  "4322",
  "4322",
  "4322",
  "4322",
  ".432",
  "..32",
];
// 鞋子：近腳是生鏽的靴子，遠腳是暗色的靴子
const BOOT_N = ["r2r2..", "r2r2r1", "r1r1r1"].map((s) => s.match(/r\d|\d|\./g));
const SHOE = (k) => [[k + 2, k + 2, null, null], [k + 2, k + 2, k + 1, k + 1], [k + 1, k + 1, k + 1, k]];

// 走路 8 格：身體高度、蓋子抬起（晚一格）、兩隻腳的前後與抬腳
const WALK = [
  { bob: 0, lid: 0, n: [1, 0], f: [-1, 0] },
  { bob: -1, lid: 0, n: [1, -1], f: [-1, 0] },
  { bob: -1, lid: 1, n: [0, -1], f: [0, 0] },
  { bob: 0, lid: 2, n: [-1, 0], f: [1, 0] },
  { bob: 0, lid: 0, n: [-1, 0], f: [1, 0] },
  { bob: -1, lid: 0, n: [-1, 0], f: [1, -1] },
  { bob: -1, lid: 1, n: [0, 0], f: [0, -1] },
  { bob: 0, lid: 2, n: [1, 0], f: [-1, 0] },
];

// 咬人（秒）：對應 enemies.js 的 BITE_LUNGE 0.3、命中 0.38–0.48、結束 0.8
function biteState(t) {
  if (t < 0.12) return { bob: 1, lid: 1, lean: 0, open: 0 };
  if (t < 0.3) return { bob: 2, lid: Math.floor(t * 20) % 2 ? 1 : 2, lean: -1, open: 0 }; // 蹲低蓄力，蓋子格格抖
  if (t < 0.36) return { bob: 0, lid: 0, lean: 2, open: 1 };                               // 衝出去，蓋子翻開一半
  if (t < 0.5) return { bob: -1, lid: 0, lean: 3, open: 2 };                               // 張到最大，停住
  if (t < 0.56) return { bob: 1, lid: 0, lean: 2, open: 0, snap: true };                   // 啪！闔上
  if (t < 0.68) return { bob: 0, lid: 1, lean: 1, open: 0 };
  return { bob: 0, lid: 0, lean: 0, open: 0 };
}

export function draw(p, t, o) {
  const P = o.palette.map(hex), Rr = o.rust.map(hex), Ey = o.eyes.map(hex);
  const grid = new Map();
  const set = (x, y, c) => c != null && grid.set(x + "," + y, [x, y, c]);
  const tone = (k) => (typeof k === "string" ? Rr[+k[1]] : P[k]);

  const bite = o.mode === "bite";
  const st = bite ? biteState(t) : WALK[Math.floor((t / meta.duration) * 8) % 8];
  const lean = st.lean ?? 0;
  const top = -6 - BODY_H + st.bob;          // 桶身頂端（含彈跳）
  const x0 = -9 + lean;

  // 腳和鞋
  const legs = bite ? { n: [0, 0], f: [0, 0] } : st;
  const leg = (lx, [dx, lift], shoe) => {
    const fx = lx + dx, fy = lift;
    for (let y = -6 + st.bob; y < -2 + fy; y++) { set(fx + 1, y, P[2]); set(fx + 2, y, P[1]); }
    shoe.forEach((row, j) => row.forEach((k, i) => set(fx + i, -3 + j + fy, k == null || k === "." ? null : tone(k))));
  };
  leg(x0 + 10, legs.f, SHOE(1).map((r) => r.map((k) => k)));   // 遠腳（後面，先畫）
  leg(x0 + 3, legs.n, BOOT_N.map((r) => r.map((k) => (k === "." ? null : k[0] === "r" ? k : +k))));

  // 桶身：上寬下窄（下半部左右各縮 1 格）
  for (let r = 0; r < BODY_H; r++) {
    const narrow = r >= 12 ? 1 : 0;
    for (let c = narrow; c < BODY_W - narrow; c++) {
      let k = COL[c];
      if (RIBS.includes(r)) k = Math.min(6, k + 1);
      if (RIBS.includes(r - 1)) k = Math.max(1, k - 2);
      if (r === BODY_H - 1) k = Math.max(1, k - 1);
      set(x0 + c, top + r, P[k]);
    }
  }
  for (const [c, r, k] of RUST) set(x0 + c, top + r, Rr[k]);

  // 嘴巴：開口內部（暗）、牙齒、舌頭、眼睛
  const open = st.open ?? 0;
  if (open) {
    const h = open === 2 ? 10 : 5, mx = x0 + 1, my = top - h, mw = 16;
    for (let y = my; y < top; y++) for (let x = mx; x < mx + mw; x++) set(x, y, P[0]);
    // 牙齒：上下兩排鋸齒（一整列＋隔一格往內一格）
    for (let x = mx; x < mx + mw; x++) {
      set(x, my, P[6]); set(x, top - 1, P[5]);
      if ((x - mx) % 2 === 0) { set(x, my + 1, P[5]); set(x, top - 2, P[6]); }
    }
    if (open === 2) {
      for (let x = mx + 4; x < mx + 11; x++) set(x, top - 3, Rr[2]);   // 舌頭
      for (let x = mx + 5; x < mx + 10; x++) set(x, top - 4, Rr[3]);
    }
    const ey = my + (open === 2 ? 3 : 2);
    set(mx + 9, ey, Ey[2]); set(mx + 10, ey, Ey[3]); set(mx + 12, ey, Ey[2]); set(mx + 13, ey, Ey[3]);
    // 蓋子翻到後面立著
    LID_UP.forEach((row, j) => [...row].forEach((ch, i) => ch !== "." && set(x0 - 2 + i, my - LID_UP.length + 4 + j + (open === 1 ? 3 : 0), P[+ch])));
    p.light(mx + 11, ey, o.eyes[2], 0.5);
  } else {
    // 蓋子蓋著：前半段依 st.lid 抬起，縫裡露出眼睛
    const lift = st.lid;
    for (let x = x0 + 9; x < x0 + 17; x++) set(x, top - 1, P[0]);   // 蓋子和桶身之間的縫
    if (lift) for (let x = x0 + 8; x < x0 + 18; x++) for (let k = 0; k < lift; k++) set(x, top - 2 - k, P[0]);
    const ey = top - 1 - Math.max(0, lift - 1);
    set(x0 + 11, ey, Ey[2]); set(x0 + 12, ey, Ey[3]); set(x0 + 14, ey, Ey[2]); set(x0 + 15, ey, Ey[3]);
    LID.forEach((row, j) => [...row].forEach((ch, i) => {
      if (ch === ".") return;
      const up = i >= 10 ? lift : i >= 6 && lift === 2 ? 1 : 0;   // 前半抬起，越前面抬越高
      set(x0 - 1 + i, top - 1 - LID.length + j - up - (lift ? 1 : 0), P[+ch]);
    }));
    if (st.snap) { set(x0 + 19, top - 7, P[6]); set(x0 + 20, top - 8, P[6]); set(x0 + 19, top - 9, P[6]); }  // 闔上的「喀」
    p.light(x0 + 13, ey, o.eyes[1], 0.25);
  }

  // 外框：所有空格只要旁邊有東西，就描成最暗的一階
  const key = (x, y) => x + "," + y;
  for (const [x, y] of [...grid.values()]) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (!grid.has(key(x + dx, y + dy))) p.px(x + dx, y + dy, P[0]);
  }
  for (const [x, y, c] of grid.values()) p.px(x, y, c);
}
