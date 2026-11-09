// 食人藤（第二章的新魔物，使用者 2026-11-09）：長在地上不會走的狂化食人植物，靠近就伸長脖子咬，咬到會把你拖過去。
// 造型（使用者 2026-11-09 從三個草稿選了「紫花」）：平常是一朵紫花，張嘴時五片花瓣大大展開、中間一圈牙。
// 待機（idle）：莖慢慢搖、嘴一開一合在喘氣、口水往下滴。
// 咬（bite）：莖往後縮成一團、嘴張到最大（預兆）→ 一口氣往前伸長、合嘴咬住 → 拖回來。
// 參考（只學做法）：pixelfx nature/vine-whip（往後捲起蓄力→往前甩、藤上的刺和葉子）、nature/root-snare（抓住、勒緊、拖）、
//   critters/_lib 的 Grid（tube 畫莖、零件分階上色＋外框）、本專案 squirrel.js（有體積的圓柱打光）、
//   itch.io 上的食人植物（rainydey 的 Forest Foes：咬的節奏；Free Game Assets 的 Predator Plant：發光的毒苞；Spooky Monsters：4 格咬）。
// 刻意避開：紅底白點、從水管裡冒出來（太像別的遊戲的食人花）。
import { fit, hex, mix, lerp, ease, seg, TAU } from "../../../pixelfx/src/core/index.js";
import { Grid, shadow } from "../../../pixelfx/src/fx/critters/_lib.js";

export const meta = {
  name: "Vine maw",
  desc: "A feral man-eating vine rooted in the floor with a star shard in its jaw: it sways and pants, drooling; to bite it coils back with its jaws gaping, then lunges out, snaps shut and drags back.",
  tags: ["critter", "monster", "plant", "vine", "forest", "loop"],
  size: [96, 64],
  origin: [32, 56],
  duration: 1.4,
  loop: true,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#0a1206", "#1a2e0e", "#2e4a16", "#4a6e1e", "#6e9428", "#9cbc3a", "#d4e878"],   // 莖、外皮：深綠→黃綠
    mouth: ["#1a0410", "#4a0c26", "#8a1840", "#c8325a", "#f07090"],                          // 嘴裡：深紫紅
    tooth: ["#8a8268", "#d8d0b0", "#fffbe8"],
    petal: ["#1c0a2a", "#3e1658", "#6a2a8e", "#9a4ac0", "#c88ae8"],                          // b 的花瓣：紫
    shard: ["#7a4a08", "#e0a020", "#ffe27a", "#fffbe0"],
    mode: "idle",  // idle | bite
    seed: 1,
  },
};

const G = new Grid(-30, -54, 92, 58);
const D = meta.duration;
const INK = hex("#08040a"), EYE = hex("#ffd23a");
const LX = -0.5, LY = -0.75, LZ = 0.45;

function pose(o, t) {
  // hx, hy：頭的位置；open：嘴張開 0～1；coil：莖往後縮
  const ph = (t / D) * TAU;
  let hx = 7 + Math.sin(ph) * 1.5, hy = -24 + Math.sin(ph * 2) * 1, open = 0.25 + 0.15 * Math.sin(ph * 2), coil = 0, ang = 0.1 * Math.sin(ph);
  if (o.mode === "bite") {
    if (t < 0.5) { const k = ease.outQuad(seg(t, 0, 0.5)); hx = lerp(7, -4, k); hy = lerp(-24, -28, k); open = lerp(0.3, 1, k); coil = k; ang = -0.5 * k; }
    else if (t < 0.62) { const k = ease.outExpo(seg(t, 0.5, 0.62)); hx = lerp(-4, 40, k); hy = lerp(-28, -12, k); open = k < 0.7 ? 1 : lerp(1, 0, (k - 0.7) / 0.3); ang = lerp(-0.5, 0.35, k); }
    else if (t < 0.78) { hx = 40; hy = -12; open = 0; ang = 0.35; }
    else { const k = ease.inOutSine(seg(t, 0.78, 1.4)); hx = lerp(40, 7, k); hy = lerp(-12, -24, k); open = lerp(0, 0.3, k); ang = lerp(0.35, 0, k); }
  }
  return { hx, hy, open, coil, ang };
}

// 莖：從地上（0,0）彎上去到頭；蓄力時往後捲成 S
function stemPts(q, n) {
  const pts = [];
  const c1 = [-6 - q.coil * 8, -10 - q.coil * 2], c2 = [q.hx - 10 - q.coil * 6, q.hy + 6 + q.coil * 4];
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = (1 - t) ** 3, b = 3 * (1 - t) ** 2 * t, c = 3 * (1 - t) * t * t, d = t ** 3;
    pts.push([b * c1[0] + c * c2[0] + d * q.hx, b * c1[1] + c * c2[1] + d * q.hy]);
  }
  return pts;
}

// 有體積的圓柱（莖）：沿路畫圓、法線打光（左上亮）
function stem(g, pts, R, C, thorns) {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1), [x, y] = pts[i], [ax, ay] = pts[Math.max(0, i - 1)], [bx, by] = pts[Math.min(n - 1, i + 1)];
    let tx = bx - ax, ty = by - ay; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    const r = R(u);
    g.shade(x - r - 1, y - r - 1, x + r + 1, y + r + 1, (px, py) => {
      const dx = px - x, dy = py - y; if (Math.hypot(dx, dy) > r + 0.3) return 0;
      const side = (dx * -ty + dy * tx) / Math.max(1, r), nz = Math.sqrt(Math.max(0, 1 - side * side));
      const lit = -ty * side * LX + tx * side * LY + nz * LZ - (i % 5 === 0 ? 0.15 : 0);   // 一節一節
      return lit > 0.75 ? C[5] : lit > 0.42 ? C[4] : lit > 0.05 ? C[3] : C[2];   // 莖比頭暗一階，頭才是主角
    });
    // 刺：往外斜的小三角
    if (thorns && i % 4 === 2 && u > 0.1 && u < 0.92) {
      const s = i % 8 === 2 ? 1 : -1, ox = -ty * s, oy = tx * s;
      for (let k = 0; k <= 2.5; k += 0.5) g.set(x + ox * (r + k) - tx * k * 0.5, y + oy * (r + k) - ty * k * 0.5, k > 1.6 ? C[6] : C[2]);
    }
  }
}

function leaf(g, x, y, a, L, C) {
  // 一片葉子：細長水滴形，中間一條葉脈
  const ca = Math.cos(a), sa = Math.sin(a);
  g.shade(x - L - 2, y - L - 2, x + L + 2, y + L + 2, (px, py) => {
    const dx = px - x, dy = py - y, u = (dx * ca + dy * sa) / L, v = (-dx * sa + dy * ca);
    if (u < 0 || u > 1) return 0;
    const w = Math.sin(u * Math.PI) * L * 0.32;
    if (Math.abs(v) > w) return 0;
    if (Math.abs(v) < 0.5 && u < 0.9) return C[3];
    return v < 0 ? C[5] : C[4];
  });
}

function vine(g, o, t) {
  const C = fit(o.palette, 7), M = fit(o.mouth, 5), T = fit(o.tooth, 3), Pt = fit(o.petal, 5), S = fit(o.shard, 4);
  const q = pose(o, t);
  g.clear();
  // 根部的葉子（左右各兩片，晃）
  const sw = Math.sin((t / D) * TAU) * 0.08;
  leaf(g, -2, -1, Math.PI + 0.5 + sw, 11, C); leaf(g, 1, -1, -0.45 + sw, 10, C);
  leaf(g, -1, -2, Math.PI + 0.95 + sw, 8, C); leaf(g, 2, -2, -0.9 + sw, 7, C);
  // 莖
  const pts = stemPts(q, 28);
  stem(g, pts, (u) => lerp(2.7, 1.8, u), C, false);
  // 頭
  const { hx, hy, open, ang } = q;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const W = (x, y) => [hx + x * ca - y * sa, hy + x * sa + y * ca];
  let shardAt;
  {
    // 紫花苞：五片花瓣張開，中間是一圈牙的圓嘴
    const bloom = 0.25 + open * 0.75, R = 8 + bloom * 4;
    for (let k = 0; k < 5; k++) {
      const a = ang + Math.PI * 0.5 * 0 + (k / 5) * TAU + (t / D) * 0.3, L = R * (0.9 + bloom * 0.5);
      const ex = hx + Math.cos(a) * L * (0.4 + bloom * 0.6), ey = hy + Math.sin(a) * L * 0.6 * (0.4 + bloom * 0.6);
      const pr = Math.hypot(ex - hx, ey - hy) / 2 + 3, ma = Math.atan2(ey - hy, ex - hx), mcx = (hx + ex) / 2, mcy = (hy + ey) / 2;
      g.shade(mcx - pr - 1, mcy - pr - 1, mcx + pr + 1, mcy + pr + 1, (px, py) => {   // 一片花瓣：沿著方向的長橢圓，尖端亮
        const dx = px - mcx, dy = py - mcy, u = (dx * Math.cos(ma) + dy * Math.sin(ma)) / pr, v = (-dx * Math.sin(ma) + dy * Math.cos(ma)) / 4;
        if (u * u + v * v > 1) return 0;
        return u > 0.45 ? Pt[4] : v < -0.3 ? Pt[3] : v > 0.4 ? Pt[1] : Pt[2];
      });
    }
    g.ellipse(hx + 1, hy, 6 * bloom + 1.5, 4.5 * bloom + 1.2, (nx, ny) => (Math.hypot(nx, ny) > 0.72 ? (Math.floor((Math.atan2(ny, nx) / TAU) * 12 + 12) % 2 === 0 ? T[2] : T[1]) : Math.hypot(nx, ny) > 0.4 ? M[2] : M[0]));
    shardAt = [hx - 1, hy - R * 0.7];
  }
  // 星星碎片（狂化）
  const SH = [".3.", "323", ".3."];
  SH.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== ".") g.set(shardAt[0] - 1 + i, shardAt[1] - 1 + j, S[+ch]); }));
  g.outline((x, y, nx, ny) => (ny > 0 ? C[0] : mix(C[0], C[1], 0.5)));
  // 口水：張嘴的時候從下面滴下來
  const drool = (t * 2.5) % 1;
  if (o.mode === "idle") { const [dx0, dy0] = [hx + 1, hy + 4]; for (let k = 0; k < 2 + drool * 4; k++) g.set(dx0, dy0 + k, k > 1 + drool * 3 ? M[4] : M[3], 0.8); }
  return { shardAt, hx, hy, open };
}

export function draw(p, time, o) {
  const t = time % D;
  const r = vine(G, o, t);
  G.draw(p);
  const S = fit(o.shard, 4), M = fit(o.mouth, 5);
  p.glow(r.shardAt[0], r.shardAt[1], 6, S[2], 0.2);
  if (r.open > 0.6) p.glow(r.hx + 3, r.hy, 9, M[3], 0.15 * r.open);
}

export function drawBack(p, time, o) {
  const C = fit(o.palette, 7);
  shadow(p, 0, -0.2, 11, 1.6, C[0], 0.55);
}
