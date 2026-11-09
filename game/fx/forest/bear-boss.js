// 熊老闆（第二章 2-4 的王）：貪吃的蜂蜜大王。偷吃蜂蜜時把一塊星星碎片也吞了下去，碎片卡在大肚子上發光、讓牠狂化。
// 使用者 2026-11-09：「熊老闆應該是人形的那種感覺」「站姿參考寶可夢的圈圈熊」（只學站姿、不抄設計）。
// 使用者 2026-11-10：整個重新設計、站姿保持：貪吃的蜂蜜大王，肚子大、有點滑稽，被碎片狂化；
//   像熊、不穿衣服，只加一兩個小配件（疤、碎片、腰間的蜂蜜罐）；比之前更大。
// 招式（照企劃書）：衝撞（低頭、地上揚灰當預兆）、熊掌拍地（兩側震波）、丟木頭和蜂窩；剩半血坐下來吃蜂蜜補血（破綻）。
// 姿勢（造型草稿用）：
//   待機（idle）：挺直站著喘，兩手往外撐開舉在肩膀附近、爪子朝上，嘴角滴蜂蜜。
//   舉拳吼（rear）：往後仰、兩隻熊掌舉過頭、張嘴吼（拍地的預兆）。
//   拍地（slam）：往前蹲下去兩掌拍地，土和震波往兩邊炸開。
//   衝撞（charge）：身體往前壓、用肩膀撞過去，兩腳狂奔。
//   丟蜂窩（throw）：一手把蜂窩往後拉到頭後面（預兆），甩出去。
//   吃蜂蜜（eat）：一屁股坐在地上，抱起腰間的蜂蜜罐往嘴裡倒（破綻）。
// 造型重點：洋梨形（肚子又大又低、幾乎垂到大腿）、頭大、短粗腿；手臂肩膀最粗、到手腕收細、熊掌大；
//   毛：外框一撮一撮不平、亮暗交界有往下的毛流，不用平滑漸層；暗森林裡要讀得出來 → 深色外框＋亮面高光。
// 參考（只學做法）：本專案 glutton-slime.js（第一章王：一樣是貪吃的王、碎片發光）、golem.js（大塊頭比例）、boar.js（腳比身體深）、
//   pixie.haus 的站姿棕熊（矮胖身體＋大頭）、Summer Engine 的胖壯漢（肚子要有重量、不是健美身材）、
//   畫熊教學（毛順著毛流、暗面在肚子下面和皺摺裡）。
import { fit, hex, mix, lerp, ease, seg, wrap, TAU } from "../../../pixelfx/src/core/index.js";
import { Grid, shadow } from "../../../pixelfx/src/fx/critters/_lib.js";

export const meta = {
  name: "Bear boss",
  desc: "The forest boss: a greedy honey-king bear standing on two legs, pear-shaped with a huge low belly where a swallowed star shard glows through cracks, a scar over one eye and a honey pot on a rope at his hip. He pants and drools honey; rears back roaring; slams the ground; charges; hurls a beehive; plops down to guzzle his honey pot.",
  tags: ["critter", "boss", "bear", "forest", "monster"],
  size: [184, 140],
  origin: [84, 130],
  duration: 1.2,
  loop: true,
  fps: 30,
  bg: "ground",
  options: {
    mode: "idle",  // idle | rear | slam | charge | throw | eat
    shard: ["#7a4a08", "#e0a020", "#ffe27a", "#fffbe0"],
    seed: 1,
  },
};

const FUR = ["#0c0705", "#22130a", "#3c2312", "#5a361b", "#7c4e27", "#a26b38", "#c8955a"].map(hex);
const BELLY = ["#4a2e1a", "#7a5434", "#a8825a", "#cfae80", "#e8d0a4"].map(hex);
const EYE = hex("#ff3a2a"), EYE2 = hex("#9a1a12"), INK = hex("#0a0604"), CLAW = hex("#efe6cc"), CLAW2 = hex("#a89a7a");
const TOOTH = hex("#f4eedc"), MOUTH = hex("#4a0c14"), TONGUE = hex("#c84a5a"), SCAR = hex("#d8a08a");
const HONEY = ["#7a3e06", "#c87a12", "#f0b030", "#ffe07a"].map(hex), POT = ["#3a140e", "#7a2e1c", "#b4502a", "#e08848"].map(hex);
const CLOTH = ["#3a2a3a", "#6a5070", "#9a80a0"].map(hex), ROPE = ["#4a3a22", "#8a7448", "#b8a070"].map(hex);
const HIVE = ["#4a2a08", "#8a5a14", "#c89030", "#f0c860"].map(hex);
const G = new Grid(-76, -126, 172, 130);
const D = meta.duration;
const h1 = (n, s = 0) => { const v = Math.sin(n * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const LX = -0.5, LY = -0.75, LZ = 0.45;

// 姿勢（畫面方向）：lean＝上身往前（右）壓多少；hip＝屁股離地多高；n/f＝近手（右邊、在前）／遠手（左邊、在後）
//   的肩膀角度 s、手肘再彎 e（0＝往下垂、正＝往右、π＝往上、負＝往左）；stepN/stepF＝兩腳往前後跨；
//   jaw＝嘴張開；up＝抬頭；dip＝低頭；sit＝坐地；prop＝拿什麼
function pose(o, t) {
  const m = o.mode, b = Math.sin((t / D) * TAU);
  let P = { lean: 0.04, hip: 22 + b * 0.7, nS: 2.1 + b * 0.06, nE: 0.7, fS: -2.05 - b * 0.06, fE: -0.7, stepN: 0, stepF: 0, jaw: 0.3 + 0.08 * b, up: 0, dip: 0.3, sit: 0, prop: null };
  if (m === "rear") {
    const k = ease.outQuad(seg(t, 0, 0.6));
    P = { ...P, lean: lerp(0.04, -0.1, k), hip: 22 + k * 2, nS: lerp(2.1, 2.8, k), nE: lerp(0.7, 0.15, k), fS: lerp(-2.05, -2.8, k), fE: lerp(-0.7, -0.15, k), jaw: 0.3 + 0.7 * k, up: k, dip: 0 };
  } else if (m === "slam") {
    const k = ease.inQuad(seg(t, 0, 0.16));
    P = { ...P, lean: lerp(-0.1, 0.38, k), hip: lerp(24, 14, k), nS: lerp(2.8, 0.75, k), nE: lerp(0.15, -0.35, k), fS: lerp(-2.8, 0.35, k), fE: lerp(-0.15, -0.1, k), jaw: lerp(1, 0.7, k), up: lerp(1, 0.3, k), dip: 0 };
  } else if (m === "charge") {
    const w = Math.sin((t / D) * 3 * TAU);
    P = { ...P, lean: 0.5, hip: 19 - Math.abs(w) * 2, nS: -0.2 + 0.35 * w, nE: 1.1, fS: 1.0 - 0.35 * w, fE: 0.7, stepN: 8 * w, stepF: -8 * w, jaw: 0.5, dip: 0.4 };
  } else if (m === "throw") {
    if (t < 0.6) { const k = ease.outQuad(seg(t, 0, 0.6)); P = { ...P, lean: lerp(0.04, -0.12, k), nS: lerp(2.1, 3.4, k), nE: lerp(0.7, 0.05, k), fS: lerp(-2.05, 1.2, k), fE: lerp(-0.7, 0.4, k), jaw: 0.3 + 0.4 * k, dip: 0, prop: "hive" }; }
    else if (t < 0.72) { const k = ease.outExpo(seg(t, 0.6, 0.72)); P = { ...P, lean: lerp(-0.12, 0.32, k), nS: lerp(3.4, 1.3, k), nE: lerp(0.05, 0.1, k), fS: lerp(1.2, -0.6, k), fE: 0.4, jaw: 0.9, dip: 0.4, prop: t < 0.66 ? "hive" : null, stepN: 5 }; }
    else { const k = ease.inOutSine(seg(t, 0.72, 1.2)); P = { ...P, lean: lerp(0.32, 0.04, k), nS: lerp(1.3, 2.1, k), nE: lerp(0.1, 0.7, k), fS: lerp(-0.6, -2.05, k), fE: lerp(0.4, -0.7, k), jaw: lerp(0.9, 0.3, k), stepN: lerp(5, 0, k) }; }
  } else if (m === "eat") {
    const g = Math.sin((t / D) * TAU * 2);
    P = { ...P, lean: -0.06, hip: 9, sit: 1, jaw: 0.75 + 0.2 * g, dip: 0, up: 0.8 + 0.1 * g, prop: "pot" };
  }
  return P;
}

// 毛流雜訊：用部位自己的座標算，部位移動時毛不會亂閃
const strand = (u, v, id) => { const c = Math.round(u / 2); return h1(c + id * 13, Math.floor((v + h1(c, id) * 4) / 4)) - 0.5; };
// 有體積、會收細的肢體（r0 → r1），亮暗交界有毛流
function seg3(g, a, b, r0, r1, far, id) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, n = Math.max(2, Math.ceil(len * 2));
  const tx = (b[0] - a[0]) / len, ty = (b[1] - a[1]) / len;
  for (let i = 0; i <= n; i++) {
    const u = i / n, x = lerp(a[0], b[0], u), y = lerp(a[1], b[1], u), r = lerp(r0, r1, u);
    g.shade(x - r - 1, y - r - 1, x + r + 1, y + r + 1, (px, py) => {
      const dx = px - x, dy = py - y, d = Math.hypot(dx, dy);
      const lx = px - a[0], ly = py - a[1], al = lx * tx + ly * ty, ac = -lx * ty + ly * tx;
      if (d > r + 0.3 + (d > r - 1 ? strand(ac, al, id + 5) * 1.6 : 0)) return 0;
      const side = (dx * -ty + dy * tx) / Math.max(1, r), nz = Math.sqrt(Math.max(0, 1 - side * side));
      const lit = -ty * side * LX + tx * side * LY + nz * LZ - (far ? 0.42 : 0) + strand(ac, al, id) * 0.2;
      return lit > 0.7 ? FUR[6] : lit > 0.4 ? FUR[5] : lit > 0.08 ? FUR[4] : lit > -0.25 ? FUR[3] : FUR[2];
    });
  }
}
// 毛茸茸的大球（肚子、胸口、頭）：外框一撮一撮、左上亮
function ball(g, cx, cy, rx, ry, C, id, dark = 0) {
  const R = Math.max(rx, ry);
  g.shade(cx - rx - 2, cy - ry - 2, cx + rx + 2, cy + ry + 3, (x, y) => {
    const nx = (x - cx) / rx, ny = (y - cy) / ry, d = Math.hypot(nx, ny);
    const ang = Math.atan2(ny, nx), tuft = h1(Math.floor((ang + 4) * R / 2.6), id) - 0.5;
    if (d > 1 + tuft * (3.2 / R) + (ny > 0 ? 1.2 / R : 0)) return 0;
    const lit = -nx * 0.42 - ny * 0.78 - dark + strand(x - cx, y - cy, id) * 0.2 - (d > 0.9 ? 0.15 : 0);
    return lit > 0.72 ? C[6] : lit > 0.38 ? C[5] : lit > 0.02 ? C[4] : lit > -0.38 ? C[3] : C[2];
  });
}
function paw(g, x, y, ang, r, far, id) {
  ball(g, x, y, r, r * 0.88, far ? FUR.map((c, i) => FUR[Math.max(0, i - 1)]) : FUR, id);
  for (let i = -1; i <= 1; i++) {                       // 三根彎爪，朝手臂伸出去的方向
    const a = ang + i * 0.45;
    for (let k = 0; k < 3.6; k += 0.6) { const c = k > 2.4 ? CLAW : far ? CLAW2 : CLAW; g.set(x + Math.sin(a) * (r + k) + Math.cos(a) * k * 0.15, y + Math.cos(a) * (r + k) - Math.sin(a) * k * 0.15, c); }
  }
}
// 腰間的蜂蜜罐：布蓋子綁繩、蜂蜜從罐口溢出來
function honeyPot(g, x, y, t, tilt = 0, sc = 1) {
  g.shade(x - 9, y - 11, x + 9, y + 10, (px, py) => {
    const nx = (px - x) / (6.5 * sc), ny = (py - y - 0.5) / (7.5 * sc); if (nx * nx + ny * ny > 1) return 0;
    const lit = -nx * 0.5 - ny * 0.4;
    return lit > 0.45 ? POT[3] : lit > 0 ? POT[2] : lit > -0.4 ? POT[1] : POT[0];
  });
  for (let k = -5; k <= 5; k++) g.set(x + k, y - 1 + tilt * k * 0.2, ROPE[1]);
  g.ellipse(x, y - 7.5, 5.5, 2.4, (nx, ny) => (ny < -0.2 ? CLOTH[2] : nx > 0.3 ? CLOTH[0] : CLOTH[1]));
  for (let k = -4; k <= 4; k++) g.set(x + k, y - 6, ROPE[2]);
  const dk = wrap(t / D * 1.5, 1);                     // 溢出來往下流的蜂蜜
  for (let j = 0; j < 5; j++) g.set(x + 4, y - 6 + j, j < 4 ? HONEY[2] : HONEY[1]);
  for (let j = 0; j < 3 + Math.floor(dk * 3); j++) g.set(x + 5, y - 5 + j, HONEY[j === 0 ? 3 : 2]);
  g.set(x + 4, y - 6, HONEY[3]);
}

function bear(g, o, t, S) {
  const q = pose(o, t);
  g.clear();
  const hx = 0, hy = -q.hip, ln = q.lean;
  const at = (dx, dy) => [hx + dx - dy * ln, hy + dy];          // 上身的點：越高越往前壓
  const bc = at(3, -17), ch = at(0, -37);
  const shN = at(21, -41), shF = at(-18, -43);
  const head = at(4, -58 + q.dip * 5 - q.up * 2);
  const arm = (s, e, base) => {
    const el = [base[0] + Math.sin(s) * 13, base[1] + Math.cos(s) * 13];
    const hand = [el[0] + Math.sin(s + e) * 12, el[1] + Math.cos(s + e) * 12];
    if (q.sit === 0 && hand[1] > -5) hand[1] = -5;
    return [base, el, hand, s + e];
  };
  const leg = (dx, step, far) => {
    const top = [hx + dx, hy + 2];
    let foot = [hx + dx * 1.35 + step, -1], knee = [(top[0] + foot[0]) / 2 + dx * 0.2, (top[1] + foot[1]) / 2];
    if (q.sit) { foot = [hx + dx * 0.7 + 18, -4]; knee = [hx + dx * 0.9 + 12, hy - 4]; }
    seg3(g, top, knee, 12, 10, far, far ? 31 : 41);
    seg3(g, knee, foot, 10, 8.5, far, far ? 32 : 42);
    g.ellipse(foot[0] + 4, foot[1] - 2.6, 8.5, 3.6, (nx, ny) => (ny < -0.25 ? FUR[far ? 3 : 5] : ny < 0.35 ? FUR[far ? 2 : 3] : FUR[1]));   // 大腳掌，朝右
    for (let i = 0; i < 3; i++) { g.set(foot[0] + 12.5, foot[1] - 4.5 + i * 1.5, CLAW); g.set(foot[0] + 13.5, foot[1] - 4 + i * 1.5, CLAW2); }
  };
  const drawArm = (pts, far, id) => {
    ball(g, pts[0][0], pts[0][1], 10, 9, far ? FUR.map((c, i) => FUR[Math.max(0, i - 1)]) : FUR, id + 3, 0);   // 圓圓的大肩膀
    seg3(g, pts[0], pts[1], 9.5, 8.5, far, id);
    seg3(g, pts[1], pts[2], 8.5, 6.2, far, id + 1);
    if (q.prop !== "pot") paw(g, pts[2][0], pts[2][1], pts[3], 7, far, id + 2);
  };
  // 遠的手、兩隻腳（大肚子會垂下來蓋住大腿上半）
  let aF = arm(q.fS, q.fE, shF);
  if (q.prop !== "pot") drawArm(aF, true, 10);
  leg(-11, q.stepF, true);
  leg(11, q.stepN, false);
  // 胸口（肩膀那一圈厚毛）、大肚子
  ball(g, ch[0], ch[1], 22, 14, FUR, 51);
  ball(g, bc[0], bc[1], 26, 24, FUR, 52);
  // 淺色的肚皮：偏右（三分之二朝前），邊緣是一撮一撮的毛
  const pc = [bc[0] + 6, bc[1] + 1];
  g.shade(pc[0] - 18, pc[1] - 22, pc[0] + 18, pc[1] + 22, (x, y) => {
    if (!g.get(x, y)) return 0;
    const nx = (x - pc[0]) / 15.5, ny = (y - pc[1]) / 19.5, d = Math.hypot(nx, ny);
    const tuft = h1(Math.floor((Math.atan2(ny, nx) + 4) * 6), 7) - 0.5;
    if (d > 1 + tuft * 0.16) return 0;
    const lit = -nx * 0.45 - ny * 0.7 + strand(x - pc[0], y - pc[1], 9) * 0.15 - (d > 0.88 ? 0.25 : 0);
    return lit > 0.5 ? BELLY[4] : lit > 0.1 ? BELLY[3] : lit > -0.35 ? BELLY[2] : BELLY[1];
  });
  // 吞下去的星星碎片：卡在肚子上，四周的毛裂開發光
  const sx = Math.round(pc[0] - 3), sy = Math.round(pc[1] - 3);
  for (const [ax, ay, L] of [[-1, -0.7, 9], [1, -0.4, 8], [0.4, 1, 9], [-0.9, 0.6, 7], [0.2, -1, 6]]) {
    let x = sx, y = sy;
    for (let k = 0; k < L; k++) { x += ax + (h1(k, ax * 9) - 0.5) * 0.9; y += ay + (h1(k, ay * 7) - 0.5) * 0.9; if (g.get(x, y)) g.set(x, y, k < 3 ? S[2] : S[1]); }
  }
  ["....3....", "...323...", "..32123..", ".3211123.", "321101123", ".3211123.", "..32123..", "...323...", "....3...."]
    .forEach((row, j) => [...row].forEach((c2, i) => { if (c2 !== ".") g.set(sx - 4 + i, sy - 4 + j, c2 === "0" ? S[3] : S[+c2]); }));
  // 肚皮上沾到的蜂蜜（貪吃）
  for (const [dx, dy, L] of [[9, -12, 4], [12, -9, 3], [4, -14, 2]]) for (let j = 0; j < L; j++) g.set(pc[0] + dx, pc[1] + dy + j, j === 0 ? HONEY[3] : HONEY[2]);
  // 腰間的繩子＋蜂蜜罐（坐下來吃的時候拿在手上）
  for (let x = -24; x <= 26; x++) { const y = bc[1] + 19 + (x * x) * 0.004 - x * 0.06; if (g.get(hx + x, y)) { g.set(hx + x, y, ROPE[1]); g.set(hx + x, y - 1, (x & 3) === 0 ? ROPE[2] : ROPE[0]); } }
  if (q.prop !== "pot") honeyPot(g, ...at(-22, -2), t, 0.6);
  // 近手舉到頭後面（丟蜂窩的預兆）：手和蜂窩在頭的後面，先畫
  let aN = arm(q.nS, q.nE, shN), aF2 = null;
  const behind = q.prop !== "pot" && aN[2][1] < shN[1] - 4;
  const drawHive = () => {
    const [x, y] = aN[2];
    g.shade(x - 8, y - 13, x + 8, y + 4, (px, py) => { const nx = (px - x) / 7, ny = (py - y + 5) / 8.5; if (nx * nx + ny * ny > 1) return 0; const band = Math.floor((py - y + 20) / 2.6) % 2; return band ? HIVE[3] : nx < -0.2 ? HIVE[2] : HIVE[1]; });
    g.ellipse(x + 1, y - 3, 1.8, 1.4, INK);
  };
  if (behind) { drawArm(aN, false, 20); if (q.prop === "hive") drawHive(); }
  if (q.prop === "pot") {                                   // 兩手捧罐子：手先畫，頭再畫
    const hd = head, px = hd[0] + 9, py = hd[1] - 24;      // 罐子舉到頭頂上、倒過來
    aF = [shF, [shF[0] - 7, shF[1] - 11], [px - 12, py + 2], 3.6];
    aN = [shN, [shN[0] + 9, shN[1] - 9], [px + 12, py + 2], 2.6];
    for (const [pts, far] of [[aF, true], [aN, false]]) { seg3(g, pts[0], pts[1], 9.5, 8.5, far, far ? 10 : 20); seg3(g, pts[1], pts[2], 8.5, 6.2, far, far ? 11 : 21); }
  }
  // 頭：大、三分之二朝右，兩隻小眼睛、凶眉、嘴筒在右邊
  const [hX, hY] = head;
  ball(g, hX - 10, hY - 11, 5, 4.6, FUR, 61, 0.35); g.ellipse(hX - 10, hY - 10.5, 2.4, 2.2, FUR[1]);
  ball(g, hX + 6, hY - 13, 5, 4.6, FUR, 62); g.ellipse(hX + 6, hY - 12.5, 2.4, 2.2, FUR[2]);
  ball(g, hX, hY, 15, 13.5, FUR, 63);
  for (const s2 of [-1, 1]) ball(g, hX + (s2 < 0 ? -11 : 9), hY + 6, 5.5, 4.5, FUR, 64 + s2, s2 < 0 ? 0.3 : 0);   // 鼓鼓的臉頰毛
  const jo = q.jaw * 5.5, mx = hX + 11, my = hY + 4;
  ball(g, mx - 1, my + 3.5 + jo * 0.6, 7.5, 3.6, FUR, 66, 0.1);                           // 下巴
  if (q.jaw > 0.2) {
    g.ellipse(mx - 1, my + 1.6 + jo * 0.3, 7, 0.9 + jo * 0.5, MOUTH);
    if (jo > 3) g.ellipse(mx - 2, my + 1.6 + jo * 0.55, 4, 1.4, TONGUE);
    for (let i = 0; i < 4; i++) { g.set(mx - 5 + i * 3, my - 0.4, TOOTH); if (jo > 2) g.set(mx - 5 + i * 3, my + 2 + jo * 0.65, TOOTH); }
    g.set(mx - 6, my - 0.2, TOOTH); g.set(mx - 6, my + 0.8, TOOTH);                        // 獠牙
  }
  g.ellipse(mx, my - 1.8, 8.5, 5, (nx, ny) => (ny < -0.35 ? BELLY[4] : ny < 0.35 ? BELLY[3] : BELLY[2]));   // 嘴筒（淺色）
  g.ellipse(mx + 5, my - 5, 3.4, 2.4, INK); g.set(mx + 4, my - 6, hex("#5a4a44"));                           // 大鼻頭
  for (const [ex, near] of [[hX - 3, 0], [hX + 6, 1]]) {                                                       // 兩隻小紅眼、粗眉往中間壓
    g.set(ex, hY - 2, EYE); g.set(ex + 1, hY - 2, EYE); g.set(ex, hY - 1, EYE2); g.set(ex + 1, hY - 1, EYE2);
    for (let k = -1; k <= 3; k++) { const y = hY - 5 + (near ? k * 0.45 : -k * 0.45) + (near ? -1 : 1); g.set(ex - 1 + k, y, INK); g.set(ex - 1 + k, y - 1, FUR[2]); }
  }
  g.line(hX + 3, hY - 9, hX + 10, hY + 1, SCAR); g.line(hX + 4, hY - 9, hX + 11, hY + 1, FUR[2]);              // 近眼上的一道疤
  for (let k = 0; k < 3; k++) g.set(hX + 5 + k * 2, hY - 6 + k * 3 - 1, SCAR);
  // 嘴角滴蜂蜜（口水）
  if (q.prop !== "pot") { const dk = wrap(t / D * 1.5, 1), L = 2 + Math.floor(dk * 5); for (let j = 0; j < L; j++) g.set(mx - 7, my + 2 + j, j === L - 1 ? HONEY[3] : HONEY[2]); }
  // 近的手（右邊、在最前面）
  if (!behind && q.prop !== "pot") { drawArm(aN, false, 20); if (q.prop === "hive") drawHive(); }
  let potAt = null;
  if (q.prop === "pot") {                                   // 兩手抱著蜂蜜罐舉到嘴邊、往嘴裡倒
    const x = hX + 9, y = hY - 24, ang = 2.7, ca = Math.cos(ang), sa = Math.sin(ang);
    const rim = [x - sa * 11.5, y + ca * 11.5];                 // 罐口：往下、朝著嘴
    // 蜂蜜一條粗粗地從罐口流進張開的嘴
    const dk = (t / D) * 6;
    for (let j = 0; j <= 1; j += 0.05) { const X = lerp(rim[0], mx - 1, j) + Math.sin(j * 6 + dk) * 0.8, Y = lerp(rim[1], my + 1, j); g.set(X, Y, HONEY[2]); g.set(X + 1, Y, (Math.floor(j * 20 + dk * 2) % 4) ? HONEY[1] : HONEY[3]); }
    g.shade(x - 12, y - 12, x + 12, y + 12, (px, py) => {      // 斜著的罐身
      const dx = px - x, dy = py - y, u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
      const nu = u / 9.5, nv = v / 10.5; if (nu * nu + nv * nv > 1 && !(Math.abs(u) < 5 && v > 7 && v < 12)) return 0;
      if (v > 10) return Math.abs(u) < 3 ? HONEY[2] : POT[0];                  // 罐口一圈，裡面是蜂蜜
      const lit = -dx / 9.5 * 0.5 - dy / 10.5 * 0.5;
      return Math.abs(v + 1) < 0.8 ? ROPE[1] : lit > 0.35 ? POT[3] : lit > 0 ? POT[2] : lit > -0.4 ? POT[1] : POT[0];
    });
    paw(g, aF[2][0], aF[2][1], aF[3], 6.5, true, 72); paw(g, aN[2][0], aN[2][1], aN[3], 6.5, false, 71);
    potAt = rim;
  }
  g.outline((x, y, nx, ny) => (ny > 0 ? FUR[0] : mix(FUR[0], FUR[1], 0.5)));
  return { shard: [sx, sy], hands: [aN[2], aF[2]], potAt, eyes: [[hX - 2.5, hY - 1.5], [hX + 6.5, hY - 1.5]] };
}

export function draw(p, time, o) {
  const t = wrap(time, D), S = fit(o.shard, 4);
  const r = bear(G, o, t, S);
  G.draw(p);
  for (const e of r.eyes) p.glow(e[0], e[1], 4, hex("#ff3a2a"), 0.35);
  p.glow(r.shard[0], r.shard[1], 14, S[2], 0.3 + 0.06 * Math.sin((t / D) * TAU * 2));
  if (o.mode === "slam" && t > 0.16) {
    const k = (t - 0.16) / (D - 0.16), gx = (r.hands[0][0] + r.hands[1][0]) / 2, quake = Math.exp(-(t - 0.16) * 6);
    for (const s of [-1, 1]) {
      const wx = gx + s * (8 + k * 70);
      for (let x = -5; x <= 5; x++) p.dot(wx + x, -1 - Math.max(0, 3.5 - Math.abs(x)) * (1 - k), hex(k < 0.3 ? "#fff4d0" : "#c8a878"), (1 - k) * 0.9);
      for (let i = 0; i < 7; i++) { const a = 0.5 + h1(i, s) * 0.9, sp = 55 + 45 * h1(i, 7), age = k * 0.8; p.dot(gx + s * (4 + Math.cos(a) * sp * age), -Math.sin(a) * sp * age + 90 * age * age, hex("#6a5236"), 1 - k); }
    }
    p.glow(gx, -2, 34, hex("#ffd890"), 0.4 * quake);
  }
  if (o.mode === "charge") for (let i = 0; i < 9; i++) { const k = wrap(t / D * 3 + i / 9, 1); p.dot(-20 - k * 34 - h1(i, 2) * 6, -1 - k * 12 + k * k * 12, hex(k < 0.5 ? "#9a8a72" : "#6a5a48"), (1 - k) * 0.8); }
  if (r.potAt) { const dk = wrap(t / D * 2, 1); for (let j = 0; j < 5; j++) p.dot(r.potAt[0] - j * 0.6, r.potAt[1] - j + dk * 3, HONEY[2], 0.9); p.glow(r.potAt[0], r.potAt[1], 9, HONEY[2], 0.15); }
}

export function drawBack(p, time, o) {
  shadow(p, 4, -0.3, 30, 3, hex("#0a0604"), 0.6);
}
