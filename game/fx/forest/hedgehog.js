// 刺蝟（第二章 2-1 的新魔物，使用者 2026-11-06）：狂化的森林刺蝟，背上卡著一塊發光的星星碎片。
// 走路：短腿快步、身體一上一下、刺跟著晚一拍抖。
// 縮球（curl）：先蹲低、刺全部豎起來（預兆）→ 頭縮進去、捲成一顆刺球。遊戲裡倒著播＝展開。
// 滾（roll）：一顆刺球往前滾，刺一圈一圈轉，米色的肚子縫跟著轉（看得出在滾）。
// 參考（只學做法）：pixelfx critters/frog（_lib 的 Grid：零件分階上色、選擇性外框、蹲下預備）、
//   critters/snake（地上移動的小生物）、nature/boulder（滾動的球加速度線與塵土）、itch.io 上的像素刺蝟（尖嘴往前、刺是一層層往後梳）。
import { fit, hex, mix, lerp, ease, seg, TAU } from "../../../pixelfx/src/core/index.js";
import { Grid, shadow } from "../../../pixelfx/src/fx/critters/_lib.js";

export const meta = {
  name: "Hedgehog",
  desc: "A feral hedgehog with a glowing star shard stuck in its quills: scurries on stubby legs; to attack it crouches, bristles and curls into a spiky ball that rolls.",
  tags: ["critter", "monster", "hedgehog", "forest", "loop"],
  size: [56, 40],
  origin: [28, 34],
  duration: 0.8,
  loop: true,
  fps: 30,
  bg: "ground",
  options: {
    // 刺：深褐→淺褐，尖端米色（森林背景是藍綠，怪用暖褐色一眼分得出來）
    palette: ["#120806", "#2c160c", "#4a2814", "#6e4020", "#965a2e", "#c4864a", "#f0c890"],
    face: ["#5a3a26", "#b88a62", "#ecd2aa", "#fff4dc"],
    shard: ["#7a4a08", "#e0a020", "#ffe27a", "#fffbe0"],
    mode: "walk",   // walk | curl | roll
    seed: 1,
  },
};

const G = new Grid(-20, -28, 40, 32);
const D = meta.duration;

// 一根刺：從 (x, y) 往 a 方向長 len，根部暗、尖端亮
function quill(g, x, y, a, len, C, lit) {
  const dx = Math.cos(a), dy = Math.sin(a), px = -dy, py = dx;
  for (let s = 0; s <= len; s += 0.4) {
    const u = s / len, w = (1 - u) * 1.3;   // 三角形：根部寬、尖端 1 格
    const c = u > 0.7 ? C[lit ? 6 : 4] : u > 0.35 ? C[lit ? 5 : 3] : C[lit ? 4 : 2];
    for (let q = -w; q <= w; q += 0.5) g.set(x + dx * s + px * q, y + dy * s + py * q, q > 0.3 ? C[2] : c);
  }
}

function hog(g, o, t) {
  const C = fit(o.palette, 7), F = fit(o.face, 4), S = fit(o.shard, 4), mode = o.mode;
  g.clear();
  // k：0＝刺蝟、1＝球；bri：刺豎起來的程度；sq：蹲低
  let k = 0, bri = 0, sq = 0, spin = 0, bob = 0, step = 0;
  if (mode === "walk") { step = Math.floor((t / D) * 8) % 8; bob = step % 4 < 2 ? 0 : -1; }
  else if (mode === "curl") {
    bri = ease.outQuad(seg(t, 0, 0.22));
    sq = Math.sin(Math.PI * seg(t, 0, 0.3)) * 0.18;
    k = ease.inOutSine(seg(t, 0.22, 0.5));
  } else { k = 1; bri = 1; spin = (t / D) * TAU * 2; }
  // 身體（刺的團）：刺蝟時是後背半圓（橢圓），球的時候是正圓
  const cx = lerp(-1, 0, k), cy = lerp(-6, -10, k) + bob + sq * 4, rx = lerp(9, 7, k) * (1 + sq * 0.5), ry = lerp(6.5, 7, k) * (1 - sq);
  // 刺：沿著外緣一圈；刺蝟時只長在背上（從後下方到頭頂），球的時候整圈
  const N = Math.round(lerp(9, 11, k));
  const a0 = lerp(Math.PI * 0.92, 0, k), a1 = lerp(Math.PI * 2.08, TAU, k);   // 角度（0＝右、往下為正）
  for (let i = 0; i < N; i++) {
    const a = a0 + ((a1 - a0) * (i + 0.5)) / N + spin;
    const ex = cx + Math.cos(a) * rx * 0.85, ey = cy + Math.sin(a) * ry * 0.85;
    // 刺往外、往後梳（刺蝟時尾巴方向＝左），豎起來的時候比較直、比較長
    const back = (1 - k) * (1 - bri) * 0.85;
    const da = a + back * (Math.cos(a) > 0 ? 1 : -1) * -1;
    const len = lerp(4.5, 3.6, k) + bri * (1 - k) * 1.5 + (i % 2) * 0.7;
    quill(g, ex, ey, da, len, C, i % 2 === 0 && Math.sin(a) < 0.3);
  }
  // 刺團的身體：上亮下暗，裡面有往外的淺色條紋（一根根的刺）
  g.shade(cx - rx, cy - ry, cx + rx, cy + ry, (x, y) => {
    const nx = (x - cx) / rx, ny = (y - cy) / ry, d = nx * nx + ny * ny;
    if (d > 1) return 0;
    if (k < 0.5 && y > -2 + bob) return 0;   // 刺蝟：底部平的（腿和肚子在下面）
    const ang = Math.atan2(ny, nx) - spin, stripe = Math.floor((ang / TAU) * 22 + 22) % 3 === 0;
    const lit = -nx * 0.5 - ny * 0.85;
    if (stripe && d > 0.25) return lit > 0.2 ? C[5] : C[4];
    return lit > 0.45 ? C[4] : lit > -0.1 ? C[3] : d > 0.7 ? C[1] : C[2];
  });
  // 頭（米色尖嘴，朝右）；縮球的時候縮進去
  const hk = 1 - k;
  if (hk > 0.05) {
    const hx = lerp(4, 6.5, hk), hy = -3.8 + bob + sq * 3, hr = 3.6 * hk, hry = 3.4 * hk;
    g.shade(hx - hr, hy - hry, hx + hr + 3.2 * hk, hy + hry, (x, y) => {
      const u = (x - hx) / (hr + 3.5 * hk * Math.max(0, (x - hx) / (hr + 4 * hk))), v = (y - hy) / hry;
      // 水滴形：後面圓（臉頰）、前面收尖（鼻子往下彎一點）
      const w = x > hx ? Math.pow(1 - (x - hx) / (hr + 3.2 * hk), 0.8) : 1;
      if (Math.abs(v) > w * 1.05 || u * u + v * v > 1.6) return 0;
      if (x < hx - hr * 0.9 && Math.abs(v) > 0.6) return 0;
      return v < -0.3 ? F[2] : v > 0.45 ? F[0] : F[1];
    });
    if (hk > 0.5) { g.set(Math.round(hx - 1), Math.round(hy - hry), F[0]); g.set(Math.round(hx), Math.round(hy - hry - 0.6), F[0]); }   // 小耳朵
    // 鼻子、眼睛（紅色＝狂化）
    const nxp = Math.round(hx + hr + 2.6 * hk), nyp = Math.round(hy + 0.6);
    g.set(nxp, nyp, C[0]); g.set(nxp + 1, nyp, C[0]); g.set(nxp, nyp - 1, C[0]);
    if (hk > 0.4) { g.set(Math.round(hx + 0.5), Math.round(hy - 1.6), hex("#e8303a")); g.set(Math.round(hx + 1.5), Math.round(hy - 1.6), hex("#3a0a10")); }
    // 腿：兩隻看得到的短腿，走路時一前一後
    if (mode === "walk" || k < 0.3) {
      const st = mode === "walk" ? [0, 1, 1, 0, 0, -1, -1, 0][step] : 0;
      for (const [lx, ph] of [[-5, st], [2, -st]]) { g.set(lx + ph * 0.5, -1.5 + bob, C[1]); g.set(lx + ph * 0.5 + 1, -1.5 + bob, C[2]); g.set(lx + ph, -0.5, F[1]); g.set(lx + ph + 1, -0.5, F[1]); }
    }
  }
  // 球的時候：一條米色的肚子縫跟著轉（看得出在滾）
  if (k > 0.6) {
    for (let s = -0.7; s <= 0.7; s += 0.06) for (const r of [0.45, 0.6]) {
      const a = Math.PI * 0.5 + s + spin;
      g.set(cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r, r < 0.5 ? F[2] : F[1]);
    }
  }
  // 星星碎片（狂化）：卡在背上，跟著轉
  const sa = lerp(-Math.PI * 0.62, -Math.PI * 0.62, k) + spin, sx = cx + Math.cos(sa) * rx * 0.55, sy = cy + Math.sin(sa) * ry * 0.55;
  const SH = ["..3..", ".323.", "32123", ".212.", "..1.."];
  SH.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== ".") g.set(sx - 2 + i, sy - 3 + j, S[+ch]); }));
  g.outline((x, y, nx, ny) => (ny > 0 ? C[0] : mix(C[0], C[1], 0.5)));
  return { cx, cy, k, sx, sy };
}

export function draw(p, time, o) {
  const t = time % D;
  const r = hog(G, o, t);
  G.draw(p);
  // 星星碎片的光
  const S = fit(o.shard, 4);
  p.glow(r.sx, r.sy, 7, S[2], 0.18);
}

export function drawBack(p, time, o) {
  const C = fit(o.palette, 7);
  shadow(p, 0, -0.2, 10, 1.5, C[0], 0.55);
}
