// 熊老闆（第二章 2-4 的王）：狂化的森林熊老大，人形（兩隻腳站著、像一個壯碩的大叔），額頭上卡著一大塊發光的星星碎片。
// 使用者 2026-11-09：「熊老闆應該是人形的那種感覺」。
// 招式（照企劃書）：衝撞（低頭、地上揚灰當預兆）、熊掌拍地（兩側震波）、丟木頭和蜂窩；剩半血坐下來吃蜂蜜補血（破綻）。
// 姿勢（造型草稿用）：
//   待機（idle）：挺直站著喘，兩手往外撐開舉在肩膀附近、爪子朝上。
//   舉拳吼（rear）：往後仰、兩隻熊掌舉過頭、張嘴吼（拍地的預兆）。
//   拍地（slam）：往前蹲下去兩掌拍地，土和震波往兩邊炸開。
//   衝撞（charge）：身體往前壓、用肩膀撞過去，兩腳狂奔。
//   丟蜂窩（throw）：一手把蜂窩往後拉到頭後面（預兆），甩出去。
//   吃蜂蜜（eat）：一屁股坐在地上，抱著蜂蜜罐往嘴裡倒（破綻）。
// 畫法：自己的骨架（屁股、腰、肩膀、手肘、膝蓋），每一段畫成有體積的圓柱、受光分階；遠的手腳先畫、身體、頭、近的手腳最後畫。
// 參考（只學做法）：本專案 glutton-slime.js（第一章王的大小、受光分階、碎片）、golem.js（大塊頭站著的比例）、boar.js（腳比身體深）、
//   pixelfx 的 stock actor（人形骨架、手臂往前是 +、手肘彎的角度、近手在前）、
//   itch.io 上的王：Forest Golem（重重砸地）、Joycat 的 Bear Warrior（站著的熊戰士）、Azdner 的 Bear。
import { fit, hex, mix, lerp, ease, seg, wrap, TAU } from "../../../pixelfx/src/core/index.js";
import { Grid, shadow } from "../../../pixelfx/src/fx/critters/_lib.js";

export const meta = {
  name: "Bear boss",
  desc: "The forest boss: a burly feral bear-man standing on two legs with a big glowing star shard in his forehead. He pants; rears back roaring with both paws high; squats and slams the ground; charges shoulder-first; winds a beehive back and hurls it; plops down to guzzle honey.",
  tags: ["critter", "boss", "bear", "forest", "monster"],
  size: [144, 112],
  origin: [64, 104],
  duration: 1.2,
  loop: true,
  fps: 30,
  bg: "ground",
  options: {
    look: "a",     // a 山賊老大（赤膊、大皮帶、紅頭巾、疤）| b 伐木工（紅格子背心、吊帶褲）| c 森林大王（樹皮護肩、樹葉披風、樹葉王冠）
    mode: "idle",  // idle | rear | slam | charge | throw | eat
    shard: ["#7a4a08", "#e0a020", "#ffe27a", "#fffbe0"],
    seed: 1,
  },
};

const FUR = ["#0e0806", "#24140c", "#3e2414", "#5c361c", "#7e4e28", "#a46c3a", "#cc9a62"].map(hex);
const BELLY = ["#5a3a22", "#8a6040", "#b08a62", "#d0b088"].map(hex);
const EYE = hex("#ff3a2a"), INK = hex("#0a0604"), CLAW = hex("#efe6cc"), TOOTH = hex("#f4eedc"), MOUTH = hex("#5a1018");
const HONEY = ["#7a3e06", "#c87a12", "#f0b030", "#ffe07a"].map(hex), POT = ["#3a1e10", "#6a3a1e", "#a0602e", "#d09050"].map(hex);
const HIVE = ["#4a2a08", "#8a5a14", "#c89030", "#f0c860"].map(hex);
const RED = ["#3a080c", "#7a1418", "#b82a26", "#e85a44"].map(hex), PLAID = ["#3a080c", "#8a1a1e", "#c8302a", "#1a0a0a"].map(hex);
const LEATHER = ["#1a0e08", "#3a2214", "#5a3820", "#7a5030"].map(hex), GOLD = ["#6a4a08", "#c8961e", "#ffe070"].map(hex);
const DENIM = ["#0e1428", "#1e2c50", "#30467a", "#4a66a0"].map(hex);
const BARK = ["#1a120c", "#3a2a1c", "#5a4430", "#7a6046"].map(hex), LEAF = ["#132a0c", "#24481a", "#3a6e26", "#5a9a34", "#90c850"].map(hex);
const G = new Grid(-56, -100, 136, 104);
const D = meta.duration;
const h1 = (n, s = 0) => { const v = Math.sin(n * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const LX = -0.5, LY = -0.75, LZ = 0.45;

// 姿勢（畫面方向）：lean＝上身往前（右）壓多少；hip＝屁股離地多高；n/f＝近手（右邊、在前）／遠手（左邊、在後）
//   的肩膀角度 s、手肘再彎 e（0＝往下垂、正＝往右、π＝往上、負＝往左）；stepN/stepF＝兩腳往前後跨；
//   jaw＝嘴張開；up＝抬頭；dip＝低頭；sit＝坐地；prop＝拿什麼
// 站姿（使用者 2026-11-09：參考寶可夢的圈圈熊，只學站姿、不抄設計）：整隻挺直、身體三分之二朝向畫面、兩腳張開踩穩、
//   兩手往外撐開舉在肩膀附近、爪子朝上，頭在最上面微微往前低。
function pose(o, t) {
  const m = o.mode, b = Math.sin((t / D) * TAU);
  let P = { lean: 0.05, hip: 20 + b * 0.6, nS: 2.05 + b * 0.06, nE: 0.75, fS: -2.0 - b * 0.06, fE: -0.75, stepN: 0, stepF: 0, jaw: 0.15 + 0.05 * b, up: 0, dip: 0.3, sit: 0, prop: null };
  if (m === "rear") {
    const k = ease.outQuad(seg(t, 0, 0.6));
    P = { ...P, lean: lerp(0.05, -0.08, k), hip: 20 + k * 1.5, nS: lerp(2.05, 2.75, k), nE: lerp(0.75, 0.15, k), fS: lerp(-2.0, -2.75, k), fE: lerp(-0.75, -0.15, k), jaw: 0.2 + 0.8 * k, up: k, dip: 0 };
  } else if (m === "slam") {
    const k = ease.inQuad(seg(t, 0, 0.16));
    P = { ...P, lean: lerp(-0.08, 0.4, k), hip: lerp(21.5, 12, k), nS: lerp(2.75, 0.85, k), nE: lerp(0.15, -0.2, k), fS: lerp(-2.75, 0.2, k), fE: lerp(-0.15, 0.1, k), jaw: lerp(1, 0.6, k), up: lerp(1, 0, k), dip: lerp(0, 0.8, k) };
  } else if (m === "charge") {
    const w = Math.sin((t / D) * 3 * TAU);
    P = { ...P, lean: 0.55, hip: 17 - Math.abs(w) * 2, nS: -0.3 + 0.3 * w, nE: 1.0, fS: 0.9 - 0.3 * w, fE: 0.6, stepN: 7 * w, stepF: -7 * w, jaw: 0.4, dip: 1 };
  } else if (m === "throw") {
    if (t < 0.6) { const k = ease.outQuad(seg(t, 0, 0.6)); P = { ...P, lean: lerp(0.05, -0.12, k), nS: lerp(2.05, 3.45, k), nE: lerp(0.75, 0.05, k), fS: lerp(-2.0, 1.3, k), fE: lerp(-0.75, 0.3, k), jaw: 0.3 + 0.4 * k, dip: 0, prop: "hive" }; }
    else if (t < 0.72) { const k = ease.outExpo(seg(t, 0.6, 0.72)); P = { ...P, lean: lerp(-0.12, 0.35, k), nS: lerp(3.45, 1.3, k), nE: lerp(0.05, 0.1, k), fS: lerp(1.3, -0.6, k), fE: 0.4, jaw: 0.8, dip: 0.4, prop: t < 0.66 ? "hive" : null, stepN: 4 }; }
    else { const k = ease.inOutSine(seg(t, 0.72, 1.2)); P = { ...P, lean: lerp(0.35, 0.05, k), nS: lerp(1.3, 2.05, k), nE: lerp(0.1, 0.75, k), fS: lerp(-0.6, -2.0, k), fE: lerp(0.4, -0.75, k), jaw: lerp(0.8, 0.15, k), stepN: lerp(4, 0, k) }; }
  } else if (m === "eat") {
    P = { ...P, lean: -0.02, hip: 8, sit: 1, nS: 2.3 + 0.06 * b, nE: 1.5, fS: 1.6, fE: 1.4, jaw: 0.5 + 0.25 * Math.sin((t / D) * TAU * 2), dip: 0, up: 0.3, prop: "pot" };
  }
  return P;
}

// 有體積的圓柱（手腳）：沿路畫圓、法線打光
function seg3(g, a, b, r0, r1, C, far, cloth) {
  const n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2));
  let tx = b[0] - a[0], ty = b[1] - a[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
  for (let i = 0; i <= n; i++) {
    const u = i / n, x = lerp(a[0], b[0], u), y = lerp(a[1], b[1], u), r = lerp(r0, r1, u);
    g.shade(x - r - 1, y - r - 1, x + r + 1, y + r + 1, (px, py) => {
      const dx = px - x, dy = py - y; if (Math.hypot(dx, dy) > r + 0.3) return 0;
      const side = (dx * -ty + dy * tx) / Math.max(1, r), nz = Math.sqrt(Math.max(0, 1 - side * side));
      let lit = -ty * side * LX + tx * side * LY + nz * LZ - (far ? 0.45 : 0);
      const P = cloth ?? C;
      return lit > 0.72 ? P[Math.min(P.length - 1, 5)] ?? P[P.length - 1] : lit > 0.4 ? P[Math.min(P.length - 1, 4)] : lit > 0.08 ? P[Math.min(P.length - 1, 3)] : lit > -0.25 ? P[2] : P[1];
    });
  }
}
// 圓球（身體、頭）：左上亮
function ball(g, cx, cy, rx, ry, C, fur = true) {
  g.shade(cx - rx - 1, cy - ry - 1, cx + rx + 1, cy + ry + 1, (x, y) => {
    const nx = (x - cx) / rx, ny = (y - cy) / ry, d = nx * nx + ny * ny; if (d > 1) return 0;
    const lit = -nx * 0.42 - ny * 0.78;
    if (fur && d > 0.84 && h1(Math.floor(x * 0.7), Math.floor(y * 0.7)) < 0.3) return lit > 0.3 ? C[5] : C[2];
    return lit > 0.72 ? C[6] ?? C[C.length - 1] : lit > 0.38 ? C[5] ?? C[C.length - 1] : lit > 0.02 ? C[4] ?? C[C.length - 2] : lit > -0.38 ? C[3] : C[2];
  });
}
function paw(g, x, y, ang, r, far) {
  // 大熊掌：一顆圓＋三根白爪，爪朝手臂伸出去的方向
  ball(g, x, y, r, r * 0.9, far ? FUR.map((c, i) => FUR[Math.max(0, i - 1)]) : FUR);
  for (let i = -1; i <= 1; i++) { const a = ang + i * 0.42; for (let k = 0; k < 2.6; k += 0.7) g.set(x + Math.sin(a) * (r + k), y + Math.cos(a) * (r + k), CLAW); }
}

function bear(g, o, t, S) {
  const L = o.look, q = pose(o, t);
  g.clear();
  const hx = 0, hy = -q.hip, ln = q.lean;
  const at = (dx, dy) => [hx + dx - dy * ln, hy + dy];          // 上身的點：越高越往前壓（dy 往上是負的）
  const bc = at(1, -14), ch = at(1, -24);
  const shN = at(14, -27), shF = at(-13, -28);
  const head = at(4, -39 + q.dip * 4 - q.up * 1.5);
  const arm = (s, e, base) => {
    const el = [base[0] + Math.sin(s) * 10, base[1] + Math.cos(s) * 10];
    const hand = [el[0] + Math.sin(s + e) * 10, el[1] + Math.cos(s + e) * 10];
    if (q.sit === 0 && hand[1] > -3) hand[1] = -3;
    return [base, el, hand, s + e];
  };
  const pants = L === "b" ? [DENIM[0], DENIM[1], DENIM[2], DENIM[3], DENIM[3], DENIM[3]] : null;
  const leg = (dx, step, far) => {
    const top = [hx + dx, hy + 3];
    let foot = [hx + dx * 1.45 + step, 0], knee = [(top[0] + foot[0]) / 2 + dx * 0.15, (top[1] + foot[1]) / 2];
    if (q.sit) { foot = [hx + dx * 0.8 + 12, -2.5]; knee = [hx + dx * 1.1 + 8, hy - 3]; }
    seg3(g, top, knee, 9, 7.5, FUR, far, pants);
    seg3(g, knee, foot, 7.5, 6.5, FUR, far, pants);
    g.ellipse(foot[0] + 3, foot[1] - 2, 6.5, 2.8, (nx, ny) => (ny < -0.2 ? FUR[far ? 3 : 4] : FUR[far ? 1 : 2]));   // 大腳掌，朝右
    for (let i = 0; i < 3; i++) g.set(foot[0] + 9, foot[1] - 3.5 + i * 1.3, CLAW);
  };
  const drawArm = (pts, far) => {
    seg3(g, pts[0], pts[1], far ? 7 : 7.5, 6.5, FUR, far);
    seg3(g, pts[1], pts[2], 6.5, 6, FUR, far);
    if (q.prop !== "pot") paw(g, pts[2][0], pts[2][1], pts[3], 5.6, far);
  };
  // 森林大王：樹葉披風在最後面
  if (L === "c") {
    const fl = Math.sin((t / D) * TAU * 2) * 2;
    g.poly([[shF[0] - 3, shF[1] - 1], [shN[0] - 4, shN[1] - 2], [hx + 4, hy + 10 + fl], [hx - 22 - ln * 10, hy + 8 + fl * 1.5]], (x, y) => (h1(Math.floor(x / 2), Math.floor(y / 2)) < 0.3 ? LEAF[3] : Math.floor(x + y) % 5 === 0 ? LEAF[1] : LEAF[2]));
  }
  // 遠的手、遠的腳（左邊、在身體後面）
  const aF = arm(q.fS, q.fE, shF);
  drawArm(aF, true);
  leg(-8, q.stepF, true);
  // 身體：大肚子、寬胸口（三分之二朝前），肚子淺色在中間偏右
  ball(g, bc[0], bc[1], 17, 17, FUR);
  ball(g, ch[0], ch[1], 18, 12, FUR);
  g.shade(bc[0] - 10, bc[1] - 14, bc[0] + 14, bc[1] + 16, (x, y) => {
    const nx = (x - bc[0] - 3) / 10.5, ny = (y - bc[1] - 2) / 13.5; if (nx * nx + ny * ny > 1 || !g.get(x, y)) return 0;
    const lit = -nx * 0.4 - ny * 0.7;
    return lit > 0.35 ? BELLY[3] : lit > -0.2 ? BELLY[2] : BELLY[1];
  });
  // 衣服
  if (L === "a") {
    const by = bc[1] + 10;
    for (let x = -18; x <= 18; x++) for (let k = 0; k < 5; k++) { const px = bc[0] + x, py = by + k + Math.abs(x) * 0.08; if (g.get(px, py)) g.set(px, py, k === 0 ? LEATHER[3] : k === 4 ? LEATHER[0] : LEATHER[2]); }
    g.shade(bc[0] - 1, by - 1, bc[0] + 7, by + 5.5, (x, y) => (Math.abs(x - bc[0] - 3) < 1.5 && Math.abs(y - by - 2.2) < 1 ? GOLD[0] : x < bc[0] + 1 || y < by + 1 ? GOLD[2] : GOLD[1]));   // 金色大皮帶扣
  } else if (L === "b") {
    g.recolor((x, y, c) => {
      if (BELLY.includes(c)) return c;
      const d = Math.hypot(x - ch[0], (y - ch[1] - 6) * 0.9); if (d > 19 || y > hy + 2) return c;
      if (x > bc[0] - 4 && x < bc[0] + 9 && y > ch[1] - 2) return c;   // 敞開的前襟
      const chk = (Math.floor((x + 40) / 3) + Math.floor((y + 40) / 3)) % 2, dark = FUR.indexOf(c) < 3;
      return chk ? (dark ? PLAID[1] : PLAID[2]) : dark ? PLAID[3] : PLAID[1];
    });
  } else {
    for (const s2 of [shN, shF]) ball(g, s2[0], s2[1] - 1, 7, 5, [BARK[0], BARK[0], BARK[1], BARK[2], BARK[3], BARK[3], BARK[3]], false);
  }
  // 近手舉到頭後面（丟蜂窩的預兆）：手和蜂窩要在頭的後面，先畫
  const behind = q.nS > 3.2, aN = arm(q.nS, q.nE, shN);
  const drawHive = () => {
    const [x, y] = aN[2];
    g.shade(x - 7, y - 11, x + 7, y + 4, (px, py) => { const nx = (px - x) / 6, ny = (py - y + 4) / 7.5; if (nx * nx + ny * ny > 1) return 0; const band = Math.floor((py - y + 20) / 2.4) % 2; return band ? HIVE[3] : nx < -0.2 ? HIVE[2] : HIVE[1]; });
    g.ellipse(x + 1, y - 2, 1.6, 1.2, INK);
  };
  if (behind) { drawArm(aN, false); if (q.prop === "hive") drawHive(); }
  // 頭：三分之二朝右，兩隻眼睛都看得到，嘴筒在右邊
  const [hX, hY] = head;
  g.ellipse(hX - 7, hY - 9, 3.6, 3.4, (nx, ny) => (Math.hypot(nx, ny) < 0.5 ? FUR[1] : FUR[3]));
  g.ellipse(hX + 5, hY - 10, 3.6, 3.4, (nx, ny) => (Math.hypot(nx, ny) < 0.5 ? FUR[2] : FUR[4]));
  ball(g, hX, hY, 11, 10.5, FUR);
  const jo = q.jaw * 5, mx = hX + 7, my = hY + 3;
  ball(g, mx, my + 2.5 + jo * 0.6, 6.5, 3, FUR);                                        // 下巴
  if (q.jaw > 0.25) {
    g.ellipse(mx, my + 1 + jo * 0.3, 6, 0.9 + jo * 0.45, MOUTH);
    for (let i = 0; i < 4; i++) { g.set(mx - 4 + i * 2.6, my - 0.3, TOOTH); g.set(mx - 4 + i * 2.6, my + 1.6 + jo * 0.6, TOOTH); }
  }
  g.ellipse(mx, my - 1.5, 7, 4, (nx, ny) => (ny < -0.3 ? BELLY[3] : ny < 0.4 ? BELLY[2] : BELLY[1]));   // 嘴筒（淺色）
  g.ellipse(mx + 3, my - 4, 2.6, 1.9, INK);                                                               // 鼻頭
  for (const [ex, side] of [[hX - 3, -1], [hX + 4, 1]]) {                                                   // 兩隻紅眼、粗眉往中間壓
    g.set(ex, hY - 3, EYE); g.set(ex + 1, hY - 3, EYE); g.set(ex, hY - 2, hex("#9a1a12"));
    if (side > 0) g.line(ex - 1, hY - 6, ex + 2, hY - 5, INK); else g.line(ex - 1, hY - 5, ex + 2, hY - 6, INK);
  }
  if (L === "a") {
    g.line(hX + 3, hY - 8, hX + 7, hY - 1, hex("#c89a8a"));
    for (let x = hX - 11; x <= hX + 10; x++) { g.set(x, hY - 7 + Math.abs(x - hX) * 0.05, RED[2]); g.set(x, hY - 6 + Math.abs(x - hX) * 0.05, RED[1]); }
    const fl = Math.sin((t / D) * TAU * 2) * 1.5;
    g.poly([[hX - 10, hY - 7], [hX - 17, hY - 9 + fl], [hX - 16, hY - 4 + fl], [hX - 10, hY - 5]], RED[2]);
  }
  if (L === "b") for (let x = hX - 6; x <= hX + 8; x++) g.set(x, hY + 10, RED[2]);
  if (L === "c") for (let i = 0; i < 7; i++) { const bx = hX - 7 + i * 2.2, by = hY - 9.5; for (let k = 0; k < 4 + (i % 2) * 2; k++) g.set(bx + (i - 3) * k * 0.15, by - k, k > 3 ? LEAF[4] : LEAF[3]); }
  const sx = hX, sy = hY - 6;
  ["...3...", "..323..", ".32123.", "3211123", ".32123.", "..323..", "...3..."].forEach((row, j) => [...row].forEach((ch2, i) => { if (ch2 !== ".") g.set(sx - 3 + i, sy - 3 + j, S[+ch2]); }));
  // 近的腳、近的手（右邊、在最前面）
  leg(8, q.stepN, false);
  if (!behind) { drawArm(aN, false); if (q.prop === "hive") drawHive(); }
  let potAt = null;
  if (q.prop === "pot") {
    const x = hX + 6, y = hY + 12;
    g.ellipse(x, y, 6, 7, (nx, ny) => (ny < -0.65 ? POT[3] : nx < -0.3 ? POT[3] : nx < 0.4 ? POT[2] : POT[1]));
    g.ellipse(x - 1, y - 7, 4, 1.5, HONEY[2]);
    for (let k = -4; k <= 4; k++) g.set(x + k, y - 1, POT[0]);
    paw(g, x - 7, y + 1, 1.6, 5, false); paw(g, x + 6, y + 2, -1.2, 5, true);
    potAt = [x - 1, y - 8];
  }
  g.outline((x, y, nx, ny) => (ny > 0 ? FUR[0] : mix(FUR[0], FUR[1], 0.5)));
  return { shard: [sx, sy], hands: [aN[2], aF[2]], potAt };
}

export function draw(p, time, o) {
  const t = wrap(time, D), S = fit(o.shard, 4);
  const r = bear(G, o, t, S);
  G.draw(p);
  p.glow(r.shard[0], r.shard[1], 10, S[2], 0.26);
  if (o.mode === "slam" && t > 0.16) {
    const k = (t - 0.16) / (D - 0.16), gx = (r.hands[0][0] + r.hands[1][0]) / 2, quake = Math.exp(-(t - 0.16) * 6);
    for (const s of [-1, 1]) {
      const wx = gx + s * (6 + k * 60);
      for (let x = -4; x <= 4; x++) p.dot(wx + x, -1 - Math.max(0, 3 - Math.abs(x)) * (1 - k), hex(k < 0.3 ? "#fff4d0" : "#c8a878"), (1 - k) * 0.9);
      for (let i = 0; i < 6; i++) { const a = 0.5 + h1(i, s) * 0.9, sp = 50 + 40 * h1(i, 7), age = k * 0.8; p.dot(gx + s * (4 + Math.cos(a) * sp * age), -Math.sin(a) * sp * age + 90 * age * age, hex("#6a5236"), 1 - k); }
    }
    p.glow(gx, -2, 30, hex("#ffd890"), 0.4 * quake);
  }
  if (o.mode === "charge") for (let i = 0; i < 8; i++) { const k = wrap(t / D * 3 + i / 8, 1); p.dot(-14 - k * 30 - h1(i, 2) * 6, -1 - k * 10 + k * k * 10, hex(k < 0.5 ? "#9a8a72" : "#6a5a48"), (1 - k) * 0.8); }
  if (r.potAt) { const dk = wrap(t / D * 2, 1); for (let j = 0; j < 4; j++) p.dot(r.potAt[0], r.potAt[1] - j + dk * 4, HONEY[2], 0.9); p.glow(r.potAt[0], r.potAt[1], 8, HONEY[2], 0.15); }
}

export function drawBack(p, time, o) {
  shadow(p, 2, -0.3, 22, 2.6, hex("#0a0604"), 0.6);
}
