// 狂化啄木鳥（第二章的新魔物，使用者 2026-11-09）：狂化的啄木鳥，頭冠裡卡著一塊發光的星星碎片。
// 飛（fly）：原地拍翅膀，往下拍的時候身體往上提，尾巴跟著擺。
// 俯衝（dive）：翅膀往後收、嘴朝斜下方，整隻像一支箭射下來，後面拉出風線。
// 卡住（stuck）：嘴插進地上拔不出來，身體亂晃、翅膀亂拍、腳亂踢、土往外噴（這是打牠的好機會）。
// 參考（只學做法）：pixelfx critters/bird（翅膀的關鍵姿勢內插、往下拍時身體上提、翅膀殘影、尾羽）、critters/_lib 的 Grid、
//   本專案 hedgehog.js（狂化的碎片、紅眼）、
//   OpenGameArt 的 LPC Birds 啄木鳥、Robert Brooks 的 Woodpecker（啄樹、沿樹上下跳）、Room G16 的 Crow（空中攻擊 6 格）。
import { fit, hex, mix, clamp, wrap, lerp, smooth, ease, seg, TAU } from "../../../pixelfx/src/core/index.js";
import { Grid } from "../../../pixelfx/src/fx/critters/_lib.js";

export const meta = {
  name: "Woodpecker",
  desc: "A feral woodpecker with a glowing star shard in its crest: it hovers flapping; it folds its wings and dives beak-first like an arrow; it gets its beak stuck in the ground and flails.",
  tags: ["critter", "monster", "bird", "woodpecker", "forest", "loop"],
  size: [80, 72],
  origin: [40, 64],
  duration: 0.8,
  loop: true,
  fps: 30,
  bg: "ground",
  options: {
    look: "a",     // 定稿用 a 黑白紅（經典啄木鳥，2026-11-09 使用者沒指定，先用最好認的）；b 綠啄木鳥、c 暗紫鑽頭嘴保留可換
    mode: "fly",   // fly | dive | stuck
    shard: ["#7a4a08", "#e0a020", "#ffe27a", "#fffbe0"],
    seed: 1,
  },
};

const LOOKS = {
  a: { body: ["#08080c", "#16161e", "#262632", "#3a3a48", "#5a5a6a", "#e8e8ec", "#ffffff"], belly: ["#9a9488", "#d0cabc", "#f0ece0"], cap: ["#6a0a10", "#c81e28", "#ff5a4a"], beak: ["#5a4a30", "#a8946a", "#e0d0a0"], beakL: 1, crest: 1 },
  b: { body: ["#0e140a", "#1e2a12", "#34461c", "#4e6a26", "#6e8e32", "#a0b84a", "#e8f0b0"], belly: ["#8a8a5a", "#c0c088", "#e8e8c0"], cap: ["#6a0a10", "#d0242a", "#ff6a50"], beak: ["#3a3a3a", "#7a7a72", "#c0c0b0"], beakL: 1.1, crest: 1, rump: "#f0d040" },
  c: { body: ["#0a0612", "#1a1028", "#2c1c44", "#443064", "#644a8a", "#9a80c0", "#e0d4ff"], belly: ["#6a5a7a", "#a898b8", "#d8ccE8"], cap: ["#7a1010", "#e0302a", "#ff7a40"], beak: ["#4a3a28", "#b09060", "#ffe0a0"], beakL: 1.45, crest: 2.2 },
};

const D = meta.duration, SRC = new Grid(-26, -30, 56, 50), OUT = new Grid(-40, -66, 80, 70);
const EYE = hex("#ff3a2a"), INK = hex("#06040a");
const POSE = {
  up: [[0, 0], [-1, -8], [-5, -15], [-8, -13.5], [-10.5, -10.5], [-11, -7], [-9, -3], [-6, 1]],
  mid: [[0, 0], [-3, -2.5], [-9, -2.5], [-10.5, -0.5], [-10, 1.2], [-8.5, 2], [-7, 2.2], [-5, 2]],
  down: [[0, 0], [-1, 6], [-3.5, 12], [-6, 11], [-7.5, 8.5], [-8, 6], [-7, 3], [-5, 2]],
  fold: [[0, 0], [-3, -1.5], [-11, -2], [-13, -0.5], [-12, 1], [-10, 1.8], [-8, 2], [-5, 2]],   // 俯衝：翅膀貼著身體往後收
};
const mixPose = (a, b, u) => a.map(([x, y], i) => [lerp(x, b[i][0], u), lerp(y, b[i][1], u)]);
function wing(ph) {
  const u = wrap(ph, 1);
  if (u < 0.4) { const k = ease.inOutSine(u / 0.4); return { pts: k < 0.5 ? mixPose(POSE.up, POSE.mid, k * 2) : mixPose(POSE.mid, POSE.down, k * 2 - 1), down: true }; }
  const k = ease.inOutSine((u - 0.4) / 0.6); return { pts: k < 0.5 ? mixPose(POSE.down, POSE.mid, k * 2) : mixPose(POSE.mid, POSE.up, k * 2 - 1), down: false };
}
const SH = [1, -2];
const wingPts = (pts, far) => pts.map(([x, y]) => [SH[0] + x - (far ? 1 : 0), SH[1] + y * (far ? 0.85 : 1) - (far ? 1 : 0)]);

// 一隻直立朝右的啄木鳥畫在 g 上（身體中心在原點）；回傳嘴尖、碎片的位置
function bird(g, L, S, wp, t, mode) {
  const C = fit(L.body, 7), Bl = L.belly, B = fit(L.belly.map((c) => c), 3), Cap = L.cap.map(hex), Bk = L.beak.map(hex);
  g.clear();
  g.poly(wingPts(wp, true), C[1]);                                    // 遠的翅膀
  // 尾羽：硬硬的、尖的（啄木鳥用尾巴撐樹），擺動
  const tf = mode === "fly" ? 0.25 + 0.3 * Math.sin((t / D) * TAU * 2) : mode === "stuck" ? 0.5 * Math.sin((t / D) * TAU * 4) : 0.05;
  for (let i = 0; i < 3; i++) {
    const a = Math.PI + (i - 1) * 0.22 + tf * 0.4 + 0.15, Ln = 10 - Math.abs(i - 1) * 1.5;
    g.poly([[-7, -2], [-7 + Math.cos(a) * Ln, -1 + Math.sin(a) * Ln - 0.8], [-7 + Math.cos(a) * (Ln + 1.5), -1 + Math.sin(a) * (Ln + 1.5)], [-7, 0.6]], i === 1 ? C[3] : C[2]);
  }
  if (L.rump) g.ellipse(-6, -1, 2, 1.6, hex(L.rump));
  // 身體＋頭
  const inBody = (x, y) => ((x + 1) / 8.5) ** 2 + (y / 5.2) ** 2 <= 1 || (x - 6.5) ** 2 + (y + 3.5) ** 2 <= 4.8 ** 2;
  g.shade(-10, -10, 12, 6, (x, y) => {
    if (!inBody(x, y)) return 0;
    const top = !inBody(x, y - 2.2), under = !inBody(x + 0.5, y + 1.6);
    if (y > -0.5 && x > -2.5) return under ? hex(Bl[0]) : hex(Bl[x > 3 ? 2 : 1]);       // 胸、肚子
    if (x > 3.5 && y > -4.5 && y < -2) return C[5];                                        // 臉頰白條
    return top ? C[4] : C[3];
  });
  // 頭頂紅帽＋頭冠（翹起來的毛），碎片卡在裡面
  const crest = L.crest;
  // 冠羽：從後腦勺往後上方翹出去的幾根（不要蓋住臉）
  const nCrest = 2 + Math.round(crest * 1.5);
  for (let i = 0; i < nCrest; i++) {
    const a = -Math.PI * 0.62 - i * 0.24, Ln = (1.5 + crest * (1.2 + (i % 2) * 0.8)) * (mode === "stuck" ? 1.3 : 1);
    const bx = 4.5 - i * 0.6, by = -7.6 + i * 0.4;
    for (let k = 0; k <= Ln; k += 0.5) g.set(bx + Math.cos(a) * k, by + Math.sin(a) * k, k > Ln - 1 ? Cap[2] : Cap[1]);
  }
  g.shade(2, -10, 11, -6, (x, y) => ((x - 6.5) ** 2 + (y + 3.5) ** 2 <= 4.8 ** 2 && y < -6.6 && x < 9 ? (x < 6 ? Cap[2] : Cap[1]) : 0));   // 只有頭頂一小片紅
  // 嘴：又長又直的鑿子
  const bl = 6 * L.beakL;
  g.poly([[10.5, -5], [10.5 + bl, -3.4], [10.5 + bl + 0.5, -3], [10.5, -2]], (x, y) => (y < -3.6 ? Bk[2] : y < -2.8 ? Bk[1] : Bk[0]));
  // 眼睛：紅（狂化）、眉壓下來
  g.set(8, -4.5, C[5]); g.set(9, -4.5, EYE); g.set(10, -4.5, C[5]); g.set(9, -3.5, C[5]);   // 紅眼（狂化）外面一圈淺色眼圈，小小的也看得出來
  g.set(9, -5.5, INK); g.set(10, -5.5, INK); g.set(8, -6, INK);                                 // 往前下壓的眉   // 紅眼（狂化）＋往前下壓的眉
  // 近的翅膀：前緣亮、飛羽一條條；黑白的啄木鳥翅膀上有一排白點
  const wpn = wingPts(wp, false);
  g.poly(wpn, (x, y) => (Math.hypot(x - wpn[1][0], y - wpn[1][1]) < 2 ? C[4] : C[2]));
  for (let i = 3; i < 7; i++) g.line(wpn[1][0], wpn[1][1], lerp(wpn[1][0], wpn[i][0], 0.92), lerp(wpn[1][1], wpn[i][1], 0.92), C[1]);
  for (let i = 3; i < 7; i++) g.set(lerp(wpn[1][0], wpn[i][0], 0.6), lerp(wpn[1][1], wpn[i][1], 0.6), C[5]);
  // 腳：卡住的時候亂踢
  const kick = mode === "stuck" ? Math.sin((t / D) * TAU * 6) * 2 : 0;
  g.line(-1, 4.5, -2 + kick, 7.5, hex("#6a5a48")); g.line(1, 4.5, 1 - kick, 7.5, hex("#6a5a48"));
  // 碎片
  const spx = 2, spy = -9;
  ["..3..", ".323.", "32123", ".212.", "..1.."].forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== ".") g.set(spx - 2 + i, spy - 2 + j, S[+ch]); }));
  g.outline(C[0]);
  return { tip: [10.5 + bl + 0.5, -3], shard: [spx, spy] };
}

// 把 src 轉 ang（弧度，正＝順時針）、平移 (ox, oy) 貼到 dst（最近點取樣，像素保持硬邊）
function place(src, dst, ang, ox, oy) {
  dst.clear();
  const cs = Math.cos(ang), sn = Math.sin(ang);
  for (let y = dst.y0; y < dst.y0 + dst.h; y++)
    for (let x = dst.x0; x < dst.x0 + dst.w; x++) {
      const dx = x + 0.5 - ox, dy = y + 0.5 - oy, u = dx * cs + dy * sn, v = -dx * sn + dy * cs;
      const c = src.get(u, v);
      if (c) dst.set(x, y, c);
    }
}
const rotP = ([x, y], ang, ox, oy) => [ox + x * Math.cos(ang) - y * Math.sin(ang), oy + x * Math.sin(ang) + y * Math.cos(ang)];

function state(o, t) {
  if (o.mode === "fly") {
    const w = wing((t / D) * 2); let lift = 0; for (let k = 0; k < 6; k++) if (wing((t - k * 0.02) / D * 2).down) lift -= 0.45;
    return { wp: w.pts, ang: 0, x: 0, y: -34 + lift, down: w.down };
  }
  if (o.mode === "dive") return { wp: POSE.fold, ang: 0.85, x: Math.sin((t / D) * TAU) * 0.5, y: -24, down: false };
  // 卡住：嘴尖插在地上（嘴尖要落在 (0, 1)），身體斜斜地晃
  const wob = Math.sin((t / D) * TAU * 3) * 0.12, w = wing((t / D) * 3);
  return { wp: w.pts, ang: 1.05 + wob, stuck: true, down: w.down };
}

export function draw(p, time, o) {
  const t = wrap(time, D), L = LOOKS[o.look] ?? LOOKS.a, S = fit(o.shard, 4), st = state(o, t);
  const r = bird(SRC, L, S, st.wp, t, o.mode);
  let ox = st.x ?? 0, oy = st.y ?? 0;
  if (st.stuck) { const tp = rotP(r.tip, st.ang, 0, 0); ox = -tp[0] + 1; oy = -tp[1] + 2; }
  place(SRC, OUT, st.ang, ox, oy);
  OUT.draw(p);
  const sh = rotP(r.shard, st.ang, ox, oy);
  p.glow(sh[0], sh[1], 6, S[2], 0.2);
  const C = fit(L.body, 7);
  // 俯衝：身後拉出幾條風線
  if (o.mode === "dive") for (let i = 0; i < 3; i++) {
    const k = wrap(t / D * 3 + i / 3, 1), off = (i - 1) * 4, len = 10 + 8 * (1 - k);
    const bx = ox - Math.cos(st.ang) * (14 + k * 14) - Math.sin(st.ang) * off, by = oy - Math.sin(st.ang) * (14 + k * 14) + Math.cos(st.ang) * off;
    for (let j = 0; j < len; j++) p.dot(bx - Math.cos(st.ang) * j, by - Math.sin(st.ang) * j, hex("#d8d4e8"), (1 - k) * 0.7 * (1 - j / len));
  }
  // 卡住：土往外噴
  if (o.mode === "stuck") for (let i = 0; i < 6; i++) {
    const k = wrap(t / D * 2 + i / 6, 1), s = i % 2 ? 1 : -1;
    p.dot(s * (2 + k * 10) + 1, -k * 8 + k * k * 10, hex(k < 0.5 ? "#8a7a62" : "#5a4a3a"), 1 - k);
  }
}

export function drawBack(p, time, o) {
  const t = wrap(time, D), st = state(o, t);
  if (o.mode === "fly") for (let x = -6; x <= 6; x++) p.dot(x, 0, hex("#000000"), 0.25 * (1 - Math.abs(x) / 7));
}
