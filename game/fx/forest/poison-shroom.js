// 毒菇怪（第二章 2-2 的新魔物，使用者 2026-11-09）：狂化的森林毒菇，蓋子上卡著一塊發光的星星碎片。
// 跟碎星鎮的菇媽、菇菇寶寶同種族，但一眼要分得出來：紫色病懨懨的蓋子、發光的黃綠毒斑、凶的紅眼睛。
// 走路（walk）：短短的根腳搖搖擺擺地走，蓋子晚一拍晃。
// 噴毒（puff）：蹲低、蓋子鼓起來發抖、菌褶越來越亮（預兆）→ 用力一壓，孢子從蓋子底下噴出來 → 回復。
// 參考（只學做法）：pixelfx nature/spore-burst（蓋子鼓起發抖、菌褶發光再噴孢子）、critters/_lib 的 Grid（零件分階上色＋外框）、
//   本專案 game/fx/town/mushroom.js（菇媽：圓頂受光、斑點貼著弧度、菌褶一圈暗色）、game/fx/forest/hedgehog.js（狂化的碎片、紅眼）、
//   itch.io 上的蘑菇怪（Elthen 的 Fungal Monster：蓋子往前傾像頭；TheSpriteShop 的毒菇：紫色蓋子；OpenGameArt 的 Mushroom Monster：柄當身體）。
import { fit, hex, mix, lerp, ease, seg, TAU } from "../../../pixelfx/src/core/index.js";
import { Grid, shadow } from "../../../pixelfx/src/fx/critters/_lib.js";

export const meta = {
  name: "Poison shroom",
  desc: "A feral poison toadstool with a glowing star shard in its cap: waddles on root feet; to attack it squats, its cap swells and trembles as the gills glow, then it squashes and puffs a burst of toxic spores.",
  tags: ["critter", "monster", "mushroom", "poison", "forest", "loop"],
  size: [64, 48],
  origin: [32, 40],
  duration: 1,
  loop: true,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#10061a", "#2a0e3a", "#4a1a5e", "#6c2a82", "#9242a6", "#b86ac6", "#e2a6ee"],   // 蓋子：深紫→淡紫
    stem: ["#1c1624", "#463c54", "#766c86", "#a69cb4", "#d2cadc"],                           // 柄：灰紫（病懨懨，不是菇媽的米白）
    spot: ["#2e4a0a", "#7ac030", "#c8f05a", "#f4ffc0"],                                       // 毒斑、孢子：黃綠
    shard: ["#7a4a08", "#e0a020", "#ffe27a", "#fffbe0"],
    mode: "walk", // walk | puff
    seed: 1,
  },
};

const G = new Grid(-24, -36, 48, 40);
const D = meta.duration;
const EYE0 = hex("#ff5a2a"), EYE_HI0 = hex("#ffd08a"), INK0 = hex("#12060e");
let EYE = EYE0, EYE_HI = EYE_HI0, INK = INK0, EYE_LO = hex("#b0201a");

// 小雜湊（固定亂數）
const h1 = (n, s = 0) => { const v = Math.sin(n * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };

// 造型（使用者 2026-11-09 從三個草稿選了「圓蓋矮胖」）：柄寬、柄高；蓋子半寬、蓋子高
const L = { rw: 5, sh: 11, R: 10.5, ch: 8.5 };

function pose(o, t) {
  // sq：蹲低（0～0.3）；sw：蓋子鼓起（0～0.2）；glow：菌褶發亮；jit：發抖；pop：噴的那一下往上彈；step：走路第幾步
  let sq = 0, sw = 0, glow = 0, jit = 0, pop = 0, step = 0, lean = 0, bob = 0, puffAge = -1;
  if (o.mode === "walk") {
    const ph = ((t / D) * 2) % 1;            // 一秒兩步循環
    step = Math.floor(ph * 8) % 8;
    lean = Math.sin(ph * TAU) * 1.8;         // 左右搖
    bob = step % 4 < 2 ? 0 : -1;
  } else {
    const wind = seg(t, 0, 0.55), rel = seg(t, 0.55, 0.64), back = seg(t, 0.64, 1);
    if (t < 0.55) { sq = 0.22 * ease.inOutSine(wind); sw = 0.16 * ease.inQuad(wind); glow = ease.inQuad(wind); jit = t > 0.25 ? (Math.floor(t * 40) % 2 ? 0.6 : -0.6) * wind : 0; }
    else if (t < 0.64) { sq = lerp(0.3, -0.12, ease.outQuad(rel)); sw = lerp(0.2, -0.06, rel); glow = 1; pop = rel; puffAge = t - 0.55; }
    else { const k = ease.outQuad(back); sq = lerp(-0.12, 0, k); sw = lerp(-0.06, 0, k); glow = 1 - k; puffAge = t - 0.55; }
  }
  return { sq, sw, glow, jit, pop, step, lean, bob, puffAge };
}

function shroom(g, o, t) {
  const C = fit(o.palette, 7), S = fit(o.stem, 5), P = fit(o.spot, 4);
  const q = pose(o, t);
  // 被打到的白閃（o.white）：眼睛、墨線也一起變亮
  if (o.white) { EYE = EYE_HI = EYE_LO = hex("#ffffff"); INK = hex("#8a8898"); } else { EYE = EYE0; EYE_HI = EYE_HI0; INK = INK0; EYE_LO = hex("#b0201a"); }
  g.clear();
  const sy = 1 - q.sq, sx = 1 + q.sq * 0.6;
  const stemTop = -L.sh * sy - 1 + q.bob;
  const capX = (o.mode === "walk" ? Math.sin((((t / D) * 2) % 1) * TAU - 0.9) * 1.8 * 0.6 : 0) + q.jit, capY = stemTop + 1;
  const R = L.R * (1 + q.sw) * sx, H = L.ch * (1 + q.sw * 0.8) * (1 - q.sq * 0.4);

  // 根腳：兩隻短短的，走路時一前一後抬起來
  const st = o.mode === "walk" ? [0, 1, 1, 0, 0, -1, -1, 0][q.step] : 0;
  for (const [fx, ph] of [[-3, st], [2, -st]]) {
    const lift = ph > 0 ? 1 : 0;
    g.set(fx + ph * 0.5, -1 - lift, S[1]); g.set(fx + ph * 0.5 + 1, -1 - lift, S[2]);
    g.set(fx + ph * 0.5 - 0.5, 0 - lift, S[1]); g.set(fx + ph * 0.5 + 1.5, 0 - lift, S[1]);
  }
  // 柄：圓柱（左亮右暗），往上微微變細；高柄的版本往前駝
  const rw = L.rw * sx;
  g.shade(-rw - 3, stemTop, rw + 3, -1 + q.bob * 0, (x, y) => {
    const u = (y - stemTop) / Math.max(1, -1 - stemTop);          // 0 上 1 下
    // 根部鼓起一顆球根（毒菇的特徵），往上收細
    const bulb = u > 0.72 ? 1 + 0.32 * Math.sin(((u - 0.72) / 0.28) * Math.PI * 0.85) : 1;
    const cx = q.lean * 0.35 * (1 - u), w = rw * lerp(0.78, 0.95, u) * bulb;
    const nx = (x - cx) / w;
    if (Math.abs(nx) > 1) return 0;
    if (u > 0.94) return S[1];
    if (u > 0.72 && nx > 0.35) return S[1];
    return nx < -0.45 ? S[4] : nx < 0.2 ? S[3] : nx < 0.7 ? S[2] : S[1];
  });
  // 菌環：柄上部一圈往下垂的裙邊（破破的）
  {
    const ry = stemTop + 4.5, rcx = q.lean * 0.3, rr = rw * 1.25;
    for (let x = Math.floor(rcx - rr); x <= Math.ceil(rcx + rr); x++) {
      const nx = (x + 0.5 - rcx) / rr; if (Math.abs(nx) > 1) continue;
      const len = 1 + ((x * 7) % 3 === 0 ? 1 : 0);
      for (let j = 0; j < len; j++) g.set(x, ry + j, j === 0 ? (nx < 0 ? S[4] : S[3]) : S[2]);
    }
  }
  // 蓋子：圓頂（左上受光），下緣一圈菌褶
  const brim = capY;
  g.shade(capX - R - 1, brim - H - 1, capX + R + 1, brim + 2, (x, y) => {
    const nx = (x - capX) / R;
    if (y > brim) {
      // 菌褶（蓋子底下一排）：預兆時越來越亮
      if (y > brim + 1.6 || Math.abs(nx) > 0.92) return 0;
      const lit = q.glow > 0.05 && Math.floor(x) % 2 === 0;
      return lit ? (q.glow > 0.6 ? P[3] : q.glow > 0.25 ? P[2] : P[1]) : q.glow > 0.5 ? P[1] : C[1];
    }
    const ny = (brim - y) / H;                     // 0 下緣 1 頂
    if (nx * nx + ny * ny > 1) return 0;
    const lit = -nx * 0.55 + ny * 0.85;            // 左上亮
    return lit > 0.95 ? C[6] : lit > 0.62 ? C[5] : lit > 0.25 ? C[4] : lit > -0.15 ? C[3] : C[2];
  });
  // 毒斑：貼著圓頂的弧度，大小不一（發光）
  const spots = [[-0.5, 0.5, 2.0], [0.15, 0.82, 1.4], [0.6, 0.38, 1.5], [-0.1, 0.22, 0.8]];
  const spotPts = [];
  for (const [ax, ay, r] of spots) {
    const x = capX + ax * R, y = brim - ay * H, rr = r * (1 + q.sw);
    g.shade(x - rr - 1, y - rr - 1, x + rr + 1, y + rr + 1, (px, py) => {
      const d = Math.hypot((px - x) / (rr * 1.25), (py - y) / rr);
      if (d > 1 || !g.get(px, py)) return 0;
      return d < 0.35 ? P[3] : d < 0.7 ? P[2] : d < 0.88 ? P[1] : P[0];
    });
    spotPts.push([x, y, rr]);
  }
  // 臉：凶的斜眉＋紅眼（狂化），一張歪嘴
  // 眼睛在菌環下面（不會被蓋子的影子吃掉）：2×2 紅眼、往中間壓的眉、亮點
  const fy = stemTop + 6.5, fx = q.lean * 0.3 + 1.5;
  for (const [ex, side] of [[fx - 3, -1], [fx + 1, 1]]) {
    g.set(ex, fy, EYE); g.set(ex + 1, fy, EYE); g.set(ex, fy + 1, EYE); g.set(ex + 1, fy + 1, EYE_LO);
    g.set(side < 0 ? ex + 1 : ex, fy, EYE_HI);
    g.set(ex, fy - 1, INK); g.set(ex + 1, fy - 1, INK);
    g.set(side < 0 ? ex + 2 : ex - 1, fy, INK);                    // 眉頭往中間、往下壓：凶
  }
  const my = fy + 2.6, mo = q.glow > 0.3 || q.puffAge >= 0 ? 1 : 0;   // 噴的時候嘴張開
  if (!mo) { for (let i = -2; i <= 1; i++) g.set(fx + i, my + (i % 2 === 0 ? 0 : 1), INK); }   // 鋸齒歪嘴
  else { for (let i = -2; i <= 1; i++) { g.set(fx + i, my, INK); g.set(fx + i, my + 2, INK); g.set(fx + i, my + 1, i === -1 || i === 0 ? P[2] : INK); } }
  // 星星碎片（狂化）：斜斜卡在蓋子右上
  const sxp = capX + R * 0.42, syp = brim - H * 0.82;
  const SH = ["..3..", ".323.", "32123", ".212.", "..1.."], SC = fit(o.shard, 4);
  SH.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== ".") g.set(sxp - 2 + i, syp - 3 + j, SC[+ch]); }));
  g.outline((x, y, nx, ny) => (ny > 0 ? C[0] : mix(C[0], C[1], 0.5)));
  return { capX, brim, R, H, glow: q.glow, puffAge: q.puffAge, sxp, syp, spotPts };
}

export function draw(p, time, o) {
  const t = time % D;
  const r = shroom(G, o, t);
  G.draw(p);
  const P = fit(o.spot, 4), SC = fit(o.shard, 4);
  // 毒斑和菌褶的光
  for (const [x, y, rr] of r.spotPts) p.glow(x, y, 3 + rr * 2, P[2], 0.08);
  if (r.glow > 0) p.glow(r.capX, r.brim + 1, r.R * 1.4, P[2], 0.35 * r.glow);
  p.glow(r.sxp, r.syp, 7, SC[2], 0.18);
  // 噴出來的孢子：從菌褶往外、往上散開（遊戲裡另外放一團毒雲，這裡只是噴的那一下）
  if (r.puffAge >= 0) {
    for (let i = 0; i < 18; i++) {
      const a = Math.PI * (1.05 + 0.9 * h1(i, o.seed)), sp = 30 + 40 * h1(i, 7 + o.seed), life = 0.25 + 0.2 * h1(i, 3);
      const age = r.puffAge - h1(i, 5) * 0.05; if (age < 0 || age > life) continue;
      const k = age / life, d = sp * age * (1 - k * 0.45);
      const x = r.capX + Math.cos(a) * (r.R * 0.6 + d), y = r.brim + 1 + Math.sin(a) * d * 0.7 - age * 12;
      const c = k < 0.4 ? P[3] : k < 0.75 ? P[2] : P[1];
      p.dot(x, y, c, 1 - k * 0.6);
      if (i % 3 === 0) p.glow(x, y, 3, P[2], 0.25 * (1 - k));
    }
  }
}

export function drawBack(p, time, o) {
  const C = fit(o.palette, 7);
  shadow(p, 0, -0.2, 9, 1.5, C[0], 0.55);
}
