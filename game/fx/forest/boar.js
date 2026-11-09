// 衝撞野豬（第二章的新魔物，使用者 2026-11-09）：狂化的森林野豬，肩膀上卡著一塊發光的星星碎片。
// 走（walk）：四隻短腿小跑，頭一點一點。
// 刨地（paw）：低頭、後腳往後刨地揚起土、鼻子噴氣（預兆）。
// 衝（charge）：身體拉長、四腳一收一伸地狂奔，耳朵往後貼，腳下一路揚塵。
// 參考（只學做法）：pixelfx critters/_lib 的 Grid（零件分階上色＋外框）、critters/frog（蹲低預備）、critters/snake（著地揚塵）、
//   impacts/heavy-landing（土塵）、本專案 hedgehog.js（同一章的四腳狂化魔物：碎片、紅眼、短腿快步）、
//   itch.io 上的野豬（Dead Pixels 的 Boar：側面跑 8 格、兩種攻擊；Elthen、PixelMotion 的 Boar：待機、跑、攻擊、受傷）。
import { fit, hex, mix, lerp, ease, seg, TAU } from "../../../pixelfx/src/core/index.js";
import { Grid, shadow } from "../../../pixelfx/src/fx/critters/_lib.js";

export const meta = {
  name: "Boar",
  desc: "A feral forest boar with a glowing star shard lodged in its shoulder: it trots on short legs; it lowers its head and paws the dirt, snorting; then charges flat out in a cloud of dust.",
  tags: ["critter", "monster", "boar", "forest", "loop"],
  size: [80, 52],
  origin: [36, 44],
  duration: 1,
  loop: true,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#0c0806", "#22160e", "#3a2618", "#563a24", "#765234", "#9a6e48", "#c49a6e"],   // 毛：深灰褐→褐
    tusk: ["#8a7e62", "#d8ceac", "#fffbe8"],
    moss: ["#1a2a0e", "#34501a", "#5a7a28", "#8aaa3a"],
    dust: ["#3a3028", "#6a5a48", "#9a8a72"],
    shard: ["#7a4a08", "#e0a020", "#ffe27a", "#fffbe0"],
    mode: "walk",  // walk | paw | charge
    seed: 1,
  },
};

const G = new Grid(-34, -40, 76, 44);
const D = meta.duration;
const EYE = hex("#ff3a2a"), INK = hex("#0a0604");
// 造型（使用者 2026-11-09 選了 A＋C）：大肩膀大獠牙的身形，背上長著幾塊長苔的樹皮
const L = { len: 1.0, hump: 1.25, tusk: 1.3, mane: 0.5, armor: 1 };
const h1 = (n, s = 0) => { const v = Math.sin(n * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };

function pose(o, t) {
  // dip：低頭；sq：蹲；stretch：身體拉長；legs：四隻腳的相位；bob：上下
  let dip = 0, sq = 0, stretch = 0, bob = 0, ph = 0, stride = 1, paw = 0, ears = 0, snort = 0;
  if (o.mode === "walk") { ph = (t / D) * 2; bob = Math.abs(Math.sin(ph * Math.PI)) * -0.8; }
  else if (o.mode === "paw") {
    dip = 1; sq = 0.12; ph = 0; stride = 0;
    paw = Math.sin((t / D) * TAU * 3);                    // 後腳往後刨三下
    snort = ((t / D) * 3) % 1;
  } else { ph = (t / D) * 4; stride = 1.8; stretch = 0.16; dip = 0.9; ears = 1; bob = -Math.abs(Math.sin(ph * Math.PI)) * 3; }
  return { dip, sq, stretch, bob, ph, stride, paw, ears, snort };
}

function boar(g, o, t) {
  const C = fit(o.palette, 7), Tk = fit(o.tusk, 3), Ms = fit(o.moss, 4), S = fit(o.shard, 4);
  const q = pose(o, t);
  g.clear();
  const sx = (1 + q.stretch) * L.len, sy = 1 - q.sq;
  const by = -11 * sy + q.bob - 2;                         // 身體中心高度
  // 腳：前兩隻、後兩隻（遠的那隻暗一階、先畫）；走路一前一後，衝的時候前後腳一起收一起伸（奔跑）
  const legs = [[9 * sx, 0.5, true], [-8 * sx, 0, true], [10.5 * sx, 0, false], [-6.5 * sx, 0.5, false]];
  const drawLeg = ([lx, off, far]) => {
    let a = Math.sin((q.ph + off) * Math.PI * 2) * 0.45 * q.stride;
    if (o.mode === "charge") { const w = Math.sin((q.ph + (lx > 0 ? 0 : 0.5)) * Math.PI * 2); a = lx > 0 ? lerp(-0.5, 1.0, (w + 1) / 2) : lerp(-1.0, 0.5, (w + 1) / 2); }   // 奔跑：前腳一起往前伸、後腳一起往後蹬
    if (o.mode === "paw" && lx < 0 && !far) a = 0.5 + q.paw * 0.6;   // 刨地的後腳
    const top = [lx, by + 4], len = 10 * sy;
    const knee = [lx + Math.sin(a) * len * 0.5, by + 4 + Math.cos(a) * len * 0.5], foot = [lx + Math.sin(a) * len * 0.9 + (a > 0 ? -1 : 1) * 0.5, Math.min(0, by + 4 + Math.cos(a) * len)];
    g.tube([top, knee, foot], (u) => lerp(2.6, 1.3, u), (u, v) => (far ? (v > 0.5 ? C[0] : C[1]) : v > 0.7 ? C[0] : v > 0.35 ? C[1] : C[2]));   // 腿比身體深兩階（野豬的腿本來就黑），蓋在身體上也看得出來
    g.set(foot[0], foot[1], C[0]); g.set(foot[0] + 1, foot[1], C[0]);   // 蹄
  };
  legs.filter((l) => l[2]).forEach(drawLeg);   // 遠的兩隻在身體後面
  // 身體：肩膀一團（大）＋屁股一團，左上亮
  const shoulder = [6 * sx, by - 1 - L.hump], hip = [-8 * sx, by + 0.5];
  const part = (cx, cy, rx, ry) => g.shade(cx - rx - 1, cy - ry - 1, cx + rx + 1, cy + ry + 1, (x, y) => {
    const nx = (x - cx) / rx, ny = (y - cy) / ry; if (nx * nx + ny * ny > 1) return 0;
    const lit = -nx * 0.35 - ny * 0.85;
    if (ny > 0.5) return ny > 0.8 ? C[1] : C[2];                                  // 肚子：暗
    if (ny < -0.55 && h1(Math.floor(x), Math.floor(y)) < 0.35) return C[5];       // 背上一層灰白的硬毛（雜色）
    return lit > 0.7 ? C[5] : lit > 0.32 ? C[4] : lit > -0.05 ? C[3] : lit > -0.45 ? C[2] : C[1];   // 明暗拉開：上亮、側面暗下去
  });
  part(hip[0], hip[1], 8 * sx, 6.5 * sy);
  part((shoulder[0] + hip[0]) / 2, by, 9 * sx, 6.5 * sy);
  part(shoulder[0], shoulder[1], 8 * sx, (7 + L.hump) * sy);
  legs.filter((l) => !l[2]).forEach(drawLeg);   // 近的兩隻蓋在身體前面（衝的時候腳伸出去才看得到）
  // 背上的鬃毛：一排往後梳的硬毛，豎起來的程度看造型（衝的時候也豎起來）
  const maneUp = L.mane * (1 + (o.mode !== "walk" ? 0.6 : 0));
  for (let i = 0; i < 9; i++) {
    const u = i / 8, x = lerp(hip[0] - 2, shoulder[0] + 4, u), yTop = lerp(hip[1] - 6.5 * sy, shoulder[1] - (7 + L.hump) * sy, Math.min(1, u * 1.3));
    const h = (1.5 + maneUp * (1.2 + Math.sin(u * Math.PI) * 1.5)) * (0.8 + 0.4 * h1(i, 3));
    for (let k = 0; k <= h; k += 0.5) g.set(x - k * 0.6, yTop - k, k > h - 1 ? C[6] : C[1]);
  }
  // 苔蘚樹皮盔甲（c）：背上幾塊不規則的樹皮板，上面長苔蘚
  if (L.armor) {
    for (let i = 0; i < 4; i++) {
      const u = (i + 0.5) / 4, x = lerp(hip[0] - 1, shoulder[0] + 1, u), y = lerp(hip[1] - 5.5 * sy, shoulder[1] - 6 * sy, u) + 1;
      g.shade(x - 4, y - 3, x + 4, y + 2, (px, py) => {
        const nx = (px - x) / 3.8, ny = (py - y) / 2.6; if (nx * nx + ny * ny > 1) return 0;
        return ny < -0.3 ? (h1(Math.floor(px), Math.floor(py)) < 0.5 ? Ms[3] : Ms[2]) : ny < 0.3 ? C[3] : C[1];
      });
    }
  }
  // 頭：楔形往前下，低頭時再往下；豬鼻、獠牙、耳朵、紅眼
  const hx = shoulder[0] + 7 * sx, hy = shoulder[1] + 2 + q.dip * 4;
  const snout = [hx + 8, hy + 3 + q.dip * 1.5];
  g.poly([[hx - 4, hy - 5], [hx + 3, hy - 3], [snout[0], snout[1] - 2], [snout[0] + 0.5, snout[1] + 2], [hx + 2, hy + 4], [hx - 4, hy + 3]], (x, y) => {
    const lit = -(y - hy) * 0.15 - (x - hx) * 0.02;
    return lit > 0.5 ? C[5] : lit > -0.2 ? C[4] : C[3];
  });
  g.ellipse(hx - 1, hy + 1.5, 2.6, 1.8, (nx, ny) => (ny < 0 ? C[5] : C[4]));   // 臉頰一塊淺色的毛
  g.ellipse(snout[0], snout[1], 1.6, 2.2, (nx, ny) => (nx > 0.2 ? C[1] : C[5]));   // 豬鼻頭
  g.set(snout[0] + 0.6, snout[1] - 0.6, C[0]); g.set(snout[0] + 0.6, snout[1] + 0.8, C[0]);
  // 獠牙：從嘴角往上彎
  const tl = 4.2 * L.tusk;
  for (let k = 0; k <= tl; k += 0.35) {
    const a = -0.2 - (k / tl) * 1.6, x = snout[0] - 2.5 + Math.cos(a) * k, y = snout[1] + 2.5 + Math.sin(a) * k;
    g.set(x, y, k > tl - 1.2 ? Tk[2] : Tk[1]); if (k < tl * 0.55) g.set(x, y + 1, Tk[0]);   // 根部粗兩格
  }
  for (let x = hx - 1; x <= snout[0] - 2; x++) g.set(x, snout[1] + 2.5, C[1]);   // 嘴角線
  // 耳朵：豎起來；衝的時候往後貼
  const ex = hx - 2, ey = hy - 5, ea = lerp(-1.2, -2.6, q.ears);
  for (let k = 0; k <= 4; k += 0.5) { g.set(ex + Math.cos(ea) * k, ey + Math.sin(ea) * k, C[k > 3 ? 5 : 3]); g.set(ex + 1 + Math.cos(ea) * k, ey + Math.sin(ea) * k, C[2]); }
  // 眼睛：紅、眉壓下來
  g.set(hx + 1, hy - 2, EYE); g.set(hx + 2, hy - 2, EYE); g.set(hx + 1, hy - 3, INK); g.set(hx + 2, hy - 2.6, INK); g.set(hx + 3, hy - 2.2, INK);
  // 尾巴：一小撮，往上捲
  g.set(hip[0] - 8 * sx, hip[1] - 2, C[3]); g.set(hip[0] - 9 * sx, hip[1] - 3, C[3]); g.set(hip[0] - 9 * sx, hip[1] - 4, C[4]);
  // 星星碎片：卡在肩膀
  const spx = shoulder[0] - 1, spy = shoulder[1] - 2;
  const SH = ["..3..", ".323.", "32123", ".212.", "..1.."];
  SH.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== ".") g.set(spx - 2 + i, spy - 2 + j, S[+ch]); }));
  g.outline((x, y, nx, ny) => (ny > 0 ? C[0] : mix(C[0], C[1], 0.5)));
  return { spx, spy, snout, by, sx };
}

export function draw(p, time, o) {
  const t = time % D;
  const r = boar(G, o, t);
  G.draw(p);
  const S = fit(o.shard, 4), Du = fit(o.dust, 3);
  p.glow(r.spx, r.spy, 7, S[2], 0.18);
  // 塵土：刨地時從後腳往後噴；衝的時候腳下一路揚起
  if (o.mode !== "walk") {
    const n = o.mode === "charge" ? 10 : 7;
    for (let i = 0; i < n; i++) {
      const life = 0.45, age = ((t / D) * 3 + i / n) % 1 * life, k = age / life;
      const x0 = o.mode === "charge" ? -10 * r.sx : -9 * r.sx, vx = o.mode === "charge" ? -40 - 30 * h1(i, 2) : -25 - 25 * h1(i, 2);
      const x = x0 + vx * age, y = -1 - (12 + 10 * h1(i, 4)) * age + 18 * age * age;
      const rr = 1 + k * 2.5 * h1(i, 6);
      p.disc ? p.disc(x, y, rr, k < 0.4 ? Du[2] : Du[1], 0.55 * (1 - k)) : p.dot(x, y, Du[1], 1 - k);
    }
  }
  // 鼻子噴氣（刨地）
  if (o.mode === "paw") {
    const k = ((t / D) * 3) % 1;
    if (k < 0.5) for (let j = 0; j < 3; j++) p.dot(r.snout[0] + 2 + k * 10 + j, r.snout[1] + 1 - j * 0.5 - k * 3, hex("#c8c0b8"), (1 - k * 2) * 0.8);
  }
}

export function drawBack(p, time, o) {
  const C = fit(o.palette, 7);
  shadow(p, 0, -0.2, 16, 1.8, C[0], 0.55);
}
