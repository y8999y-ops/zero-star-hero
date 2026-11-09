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

// 姿勢（畫面座標，地面 y＝0、往右是前面）：lean＝上身繞屁股往前（右）轉幾度（弧度）；hip＝屁股離地多高；
//   nH/fH＝近手／遠手要放的位置（手肘自己算，nB/fB＝手肘往哪邊彎）；stepN/stepF＝兩腳往前後跨；
//   jaw＝嘴張開；up＝抬頭；dip＝低頭；sit＝坐地；prop＝拿什麼
// 透視（三分之二朝右）：遠的腳踩在比較後面（畫面上高 3 格）、遠的手腳細一點暗一點。
const L2 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
function pose(o, t) {
  const m = o.mode, b = Math.sin((t / D) * TAU);
  let P = { lean: 0.06, hip: 22 + b * 0.8, nH: [40, -76 + b * 1.2], fH: [-36, -79 + b * 1.2], nB: 1, fB: -1, stepN: 0, stepF: 0, jaw: 0.3 + 0.08 * b, up: 0, dip: 0.4, sit: 0, prop: null };
  if (m === "rear") {
    const k = ease.outQuad(seg(t, 0, 0.6));
    P = { ...P, lean: lerp(0.06, -0.2, k), hip: 22 + k * 2, nH: L2(P.nH, [24, -92], k), fH: L2(P.fH, [-34, -86], k), jaw: 0.3 + 0.7 * k, up: k, dip: lerp(0.4, 0, k), stepN: 3 * k, stepF: -2 * k };
  } else if (m === "slam") {
    // 單掌重拍：近手整個砸到地上、遠手往後甩平衡、身體往前蹲
    const k = ease.inQuad(seg(t, 0, 0.16));
    P = { ...P, lean: lerp(-0.2, 0.7, k), hip: lerp(24, 11, k), nH: L2([24, -92], [48, -6], k), fH: L2([-34, -86], [-8, -66], k), jaw: lerp(1, 0.8, k), up: lerp(1, 0, k), dip: 0, stepN: lerp(3, 10, k), stepF: lerp(-2, -6, k) };
  } else if (m === "charge") {
    // 往前撲：頭在最前面帶路、上身壓低、大步跑
    const w = Math.sin((t / D) * 3 * TAU);
    P = { ...P, lean: 0.75, hip: 18 - Math.abs(w) * 2, nH: [52 + 9 * w, -14 - Math.abs(w) * 3], fH: [30 - 9 * w, -40], nB: -1, fB: -1, stepN: 9 * w, stepF: -9 * w, jaw: 0.6, dip: 0 };
  } else if (m === "throw") {
    if (t < 0.6) { const k = ease.outQuad(seg(t, 0, 0.6)); P = { ...P, lean: lerp(0.06, -0.2, k), nH: L2(P.nH, [-2, -88], k), fH: L2(P.fH, [-40, -50], k), jaw: 0.3 + 0.4 * k, dip: lerp(0.4, 0, k), prop: "hive", stepF: -4 * k }; }
    else if (t < 0.72) { const k = ease.outExpo(seg(t, 0.6, 0.72)); P = { ...P, lean: lerp(-0.2, 0.45, k), hip: 22 - 2 * k, nH: L2([-2, -88], [58, -56], k), fH: L2([-40, -50], [-6, -42], k), jaw: 0.9, dip: 0.2, prop: t < 0.66 ? "hive" : null, stepN: 6 * k, stepF: -4 }; }
    else { const k = ease.inOutSine(seg(t, 0.72, 1.2)); P = { ...P, lean: lerp(0.45, 0.06, k), hip: 20 + 2 * k, nH: L2([58, -56], P.nH, k), fH: L2([-6, -42], P.fH, k), jaw: lerp(0.9, 0.3, k), stepN: lerp(6, 0, k), stepF: lerp(-4, 0, k) }; }
  } else if (m === "eat") {
    const g = Math.sin((t / D) * TAU * 2);
    P = { ...P, lean: -0.18, hip: 9, sit: 1, jaw: 0.75 + 0.2 * g, dip: 0, up: 0.8 + 0.1 * g, prop: "pot" };
  }
  return P;
}

// 毛的畫法（使用者 2026-11-10：紋理太雜亂）：不用亂數雜點，改成有規律的「一撮一撮」：
//   亮暗交界做成鋸齒（一撮約 4 格寬），外框只在側面和下面有毛尖、頭頂和肩膀上面保持乾淨。
const tri = (v, P) => Math.abs((((v % P) + P) % P) - P / 2) / (P / 2);   // 0..1 的三角波
// 有體積、會收細的肢體（r0 → r1）
function seg3(g, a, b, r0, r1, far) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, n = Math.max(2, Math.ceil(len * 2));
  const tx = (b[0] - a[0]) / len, ty = (b[1] - a[1]) / len;
  for (let i = 0; i <= n; i++) {
    const u = i / n, x = lerp(a[0], b[0], u), y = lerp(a[1], b[1], u), r = lerp(r0, r1, u);
    g.shade(x - r - 1, y - r - 1, x + r + 1, y + r + 1, (px, py) => {
      const dx = px - x, dy = py - y;
      if (Math.hypot(dx, dy) > r + 0.3) return 0;
      const side = (dx * -ty + dy * tx) / Math.max(1, r), nz = Math.sqrt(Math.max(0, 1 - side * side));
      const lit = -ty * side * LX + tx * side * LY + nz * LZ - (far ? 0.4 : 0);
      return lit > 0.72 ? FUR[6] : lit > 0.42 ? FUR[5] : lit > 0.08 ? FUR[4] : lit > -0.28 ? FUR[3] : FUR[2];
    });
  }
}
// 毛茸茸的大球（肚子、胸口、頭）：左上亮
function ball(g, cx, cy, rx, ry, C, dark = 0, tufts = true) {
  const R = Math.max(rx, ry), X = Math.round(cx);
  g.shade(cx - rx - 2, cy - ry - 2, cx + rx + 2, cy + ry + 3, (x, y) => {
    const nx = (x - cx) / rx, ny = (y - cy) / ry, d = Math.hypot(nx, ny);
    const tuft = tufts && ny > -0.35 ? (tri(Math.round((Math.atan2(ny, nx) + 4) * R), 4) - 0.35) * 2.4 / R : 0;
    if (d > 1 + tuft) return 0;
    const lit = -nx * 0.42 - ny * 0.78 - dark - (d > 0.92 ? 0.12 : 0);
    return lit > 0.74 ? C[6] : lit > 0.4 ? C[5] : lit > 0.02 ? C[4] : lit > -0.38 ? C[3] : C[2];
  });
}
const DARKER = FUR.map((c, i) => FUR[Math.max(0, i - 1)]);
function paw(g, x, y, ang, r, far) {
  ball(g, x, y, r, r * 0.88, far ? DARKER : FUR, 0, false);
  for (let i = -1; i <= 1; i++) {                       // 三根彎爪，朝手臂伸出去的方向
    const a = ang + i * 0.45;
    for (let k = 0; k < 3.6; k += 0.6) { const c = k > 2.4 ? CLAW : far ? CLAW2 : CLAW; g.set(x + Math.sin(a) * (r + k) + Math.cos(a) * k * 0.15, y + Math.cos(a) * (r + k) - Math.sin(a) * k * 0.15, c); }
  }
}
// 兩段手腳的關節：給根部 a、末端 h、兩段長度，算出手肘／膝蓋（side 決定往哪邊彎）
function ik(a, h, l1, l2, side) {
  let dx = h[0] - a[0], dy = h[1] - a[1], d = Math.hypot(dx, dy) || 1;
  if (d > l1 + l2 - 0.5) { const k = (l1 + l2 - 0.5) / d; dx *= k; dy *= k; d = l1 + l2 - 0.5; h = [a[0] + dx, a[1] + dy]; }
  const c = Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))), ang = Math.atan2(dy, dx) + side * Math.acos(c);
  return [[a[0] + Math.cos(ang) * l1, a[1] + Math.sin(ang) * l1], h];
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
  const hx = 0, hy = -q.hip, ca = Math.cos(q.lean), sa = Math.sin(q.lean);
  const at = (dx, dy) => [hx + dx * ca - dy * sa, hy + dx * sa + dy * ca];   // 上身的點：整個上身繞屁股轉
  const bc = at(3, -17), ch = at(0, -37);
  const shN = at(21, -41), shF = at(-17, -43);
  const head = at(4, -58 + q.dip * 4 - q.up * 2);
  const [hX, hY] = [Math.round(head[0]), Math.round(head[1])];
  const jo = q.jaw * 5.5, mx = hX + 11, my = hY + 4;
  // 吃蜂蜜：罐子舉到頭頂、兩手抓在罐子兩邊
  const potC = [hX + 9, hY - 24];
  const nT = q.prop === "pot" ? [potC[0] + 12, potC[1] + 2] : q.nH, fT = q.prop === "pot" ? [potC[0] - 12, potC[1] + 2] : q.fH;
  const arm = (sh, T, side) => { const [el, hand] = ik(sh, T, 14, 13, side); return [sh, el, hand, Math.atan2(hand[0] - el[0], hand[1] - el[1])]; };
  const aF = arm(shF, fT, q.prop === "pot" ? -1 : q.fB), aN = arm(shN, nT, q.prop === "pot" ? 1 : q.nB);
  const leg = (dx, step, far) => {
    const top = [hx + dx, hy + 2], sole = far ? -3 : 0;
    let ankle = [hx + dx * 1.45 + step, sole - 3.5];
    if (q.sit) ankle = [hx + (far ? 20 : 30), sole - 5];
    const [knee, an] = ik(top, ankle, 9.5, 8.5, -1), k = far ? 0.88 : 1;
    seg3(g, top, knee, 12 * k, 10 * k, far);
    seg3(g, knee, an, 10 * k, 8.5 * k, far);
    if (q.sit) {                                             // 坐著：腳底板朝前、看得到肉球
      g.ellipse(an[0] + 3, an[1] - 1, 4, 6.5 * k, (nx, ny) => (nx < -0.3 ? FUR[far ? 2 : 3] : far ? BELLY[1] : BELLY[2]));
      return;
    }
    g.ellipse(an[0] + 4, sole - 2.6, 8.5 * k, 3.6, (nx, ny) => (ny < -0.25 ? FUR[far ? 3 : 5] : ny < 0.35 ? FUR[far ? 2 : 3] : FUR[1]));   // 大腳掌，朝右
    for (let i = 0; i < 3; i++) { g.set(an[0] + 12.5 * k, sole - 4.5 + i * 1.5, far ? CLAW2 : CLAW); g.set(an[0] + 13.5 * k, sole - 4 + i * 1.5, CLAW2); }
  };
  const drawArm = (pts, far, withPaw = true) => {
    ball(g, pts[0][0], pts[0][1], far ? 9 : 10, far ? 8 : 9, far ? DARKER : FUR, 0, false);   // 圓圓的大肩膀
    seg3(g, pts[0], pts[1], far ? 8.5 : 9.5, far ? 7.5 : 8.5, far);
    seg3(g, pts[1], pts[2], far ? 7.5 : 8.5, far ? 5.6 : 6.2, far);
    if (withPaw) paw(g, pts[2][0], pts[2][1], pts[3], far ? 6.3 : 7, far);
  };
  const pot = q.prop === "pot";
  // 遠的手、兩隻腳（大肚子會垂下來蓋住大腿上半）
  drawArm(aF, true, !pot);
  leg(-13, q.stepF, true);
  leg(13, q.stepN, false);
  // 胸口（肩膀那一圈厚毛）、大肚子
  ball(g, ch[0], ch[1], 22, 14, FUR);
  ball(g, bc[0], bc[1], 26, 24, FUR);
  // 淺色的肚皮：偏右（三分之二朝前），邊緣一撮一撮
  const pc = [Math.round(bc[0] + 6), Math.round(bc[1] + 1)];
  g.shade(pc[0] - 18, pc[1] - 22, pc[0] + 18, pc[1] + 22, (x, y) => {
    if (!g.get(x, y)) return 0;
    const nx = (x - pc[0]) / 15.5, ny = (y - pc[1]) / 19.5, d = Math.hypot(nx, ny);
    if (d > 1 + (tri(Math.round((Math.atan2(ny, nx) + 4) * 12), 5) - 0.4) * 0.07) return 0;
    const lit = -nx * 0.45 - ny * 0.7 - (d > 0.86 ? 0.3 : 0);
    return lit > 0.5 ? BELLY[4] : lit > 0.1 ? BELLY[3] : lit > -0.35 ? BELLY[2] : BELLY[1];
  });
  // 吞下去的星星碎片：卡在肚子上，四周的毛裂開發光
  const sx = pc[0] - 3, sy = pc[1] - 3;
  for (const [ax, ay, L] of [[-1, -0.7, 9], [1, -0.4, 8], [0.4, 1, 9], [-0.9, 0.6, 7], [0.2, -1, 6]]) {
    let x = sx, y = sy;
    for (let k = 0; k < L; k++) { x += ax + (h1(k, ax * 9) - 0.5) * 0.9; y += ay + (h1(k, ay * 7) - 0.5) * 0.9; if (g.get(x, y)) g.set(x, y, k < 3 ? S[2] : S[1]); }
  }
  ["....3....", "...323...", "..32123..", ".3211123.", "321101123", ".3211123.", "..32123..", "...323...", "....3...."]
    .forEach((row, j) => [...row].forEach((c2, i) => { if (c2 !== ".") g.set(sx - 4 + i, sy - 4 + j, c2 === "0" ? S[3] : S[+c2]); }));
  // 肚皮上沾到的蜂蜜（貪吃）
  for (const [dx, dy, L] of [[9, -12, 4], [12, -9, 3], [4, -14, 2]]) for (let j = 0; j < L; j++) g.set(pc[0] + dx, pc[1] + dy + j, j === 0 ? HONEY[3] : HONEY[2]);
  // 腰間的繩子＋蜂蜜罐（坐下來吃的時候拿在手上）：繩子跟著上身轉
  for (let x = -26; x <= 28; x += 0.5) { const [X, Y] = at(x + 3, 2 + x * x * 0.004 - x * 0.06); if (g.get(X, Y)) { g.set(X, Y, ROPE[1]); g.set(X, Y - 1, (Math.round(x) & 3) === 0 ? ROPE[2] : ROPE[0]); } }
  if (!pot) honeyPot(g, ...at(-22, -2), t, 0.6);
  // 手舉得比肩膀高 → 手（和蜂窩、罐子）畫在頭的後面，臉永遠看得到
  const behind = pot || aN[2][1] < shN[1] - 4;
  const drawHive = () => {
    const [x, y] = aN[2];
    g.shade(x - 8, y - 13, x + 8, y + 4, (px, py) => { const nx = (px - x) / 7, ny = (py - y + 5) / 8.5; if (nx * nx + ny * ny > 1) return 0; const band = Math.floor((py - y + 20) / 2.6) % 2; return band ? HIVE[3] : nx < -0.2 ? HIVE[2] : HIVE[1]; });
    g.ellipse(x + 1, y - 3, 1.8, 1.4, INK);
  };
  if (behind) { drawArm(aN, false, !pot); if (q.prop === "hive") drawHive(); }
  // 頭：大、三分之二朝右，兩隻小眼睛、凶眉、嘴筒在右邊
  ball(g, hX - 10, hY - 11, 5, 4.6, FUR, 0.35, false); g.ellipse(hX - 10, hY - 10.5, 2.4, 2.2, FUR[1]);
  ball(g, hX + 6, hY - 13, 5, 4.6, FUR, 0, false); g.ellipse(hX + 6, hY - 12.5, 2.4, 2.2, FUR[2]);
  ball(g, hX, hY, 15, 13.5, FUR);
  for (const s2 of [-1, 1]) ball(g, hX + (s2 < 0 ? -11 : 9), hY + 6, 5.5, 4.5, FUR, s2 < 0 ? 0.3 : 0);   // 鼓鼓的臉頰毛
  ball(g, mx - 1, my + 3.5 + jo * 0.6, 7.5, 3.6, FUR, 0.1, false);                           // 下巴
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
  if (!behind) { drawArm(aN, false); if (q.prop === "hive") drawHive(); }
  let potAt = null;
  if (q.prop === "pot") {                                   // 兩手抱著蜂蜜罐舉到嘴邊、往嘴裡倒
    const [x, y] = potC, ang = 2.7, ca = Math.cos(ang), sa = Math.sin(ang);
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
    paw(g, aF[2][0], aF[2][1], aF[3], 6.3, true); paw(g, aN[2][0], aN[2][1], aN[3], 7, false);
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
