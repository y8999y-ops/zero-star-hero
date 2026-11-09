// 狂化松鼠（第二章 2-3 巨木樹頂的新魔物，使用者 2026-11-09）：狂化的森林松鼠，大尾巴裡卡著一塊發光的星星碎片。
// 跳（hop）：蹲 → 彈出去（身體拉長、尾巴晚一拍甩）→ 落地壓扁。
// 丟（throw）：站起來、手舉松果到頭後面、尾巴捲高（預兆）→ 手往前甩把松果丟出去 → 回來。
// 松果（acorn）：丟出去在空中轉的那顆（遊戲裡另外當彈道畫）。
// 參考（只學做法）：pixelfx critters/frog（蹲下預備、跳的拋物線、落地壓扁揚塵）、critters/_lib 的 Grid（tube 畫毛茸茸的尾巴）、
//   本專案 game/fx/forest/hedgehog.js（同一章的狂化魔物：碎片、紅眼）、
//   itch.io 上的松鼠（Elthen 的 Squirrel：側面、尾巴 S 形快跟身體一樣大；janna98 的爬樹松鼠：拿松果當武器；Noiryt 的 Quirky pack：丟東西 4 格）。
import { fit, hex, mix, lerp, ease, seg, TAU } from "../../../pixelfx/src/core/index.js";
import { Grid, shadow } from "../../../pixelfx/src/fx/critters/_lib.js";

export const meta = {
  name: "Squirrel",
  desc: "A feral squirrel with a glowing star shard caught in its huge tail: bounds along in springy hops; to attack it rears up, winds an acorn back over its head and hurls it.",
  tags: ["critter", "monster", "squirrel", "forest", "loop"],
  size: [64, 52],
  origin: [32, 44],
  duration: 1,
  loop: true,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#140604", "#3a1208", "#6a220c", "#9a3a12", "#c85a1c", "#ec8a34", "#ffc070"],   // 毛：深紅褐→橘（森林是藍綠，紅橘一眼分得出來）
    belly: ["#7a5a3a", "#c8a47a", "#ecd6b0", "#fff4e0"],
    acorn: ["#2a1608", "#5a3414", "#8a5a26", "#c08a44", "#e8c07a"],
    shard: ["#7a4a08", "#e0a020", "#ffe27a", "#fffbe0"],
    mode: "hop",  // hop | throw | acorn
    seed: 1,
  },
};

const G = new Grid(-26, -40, 52, 44);
const D = meta.duration;
const EYE = hex("#ff3a2a"), INK = hex("#120604");

// 造型（使用者 2026-11-09 選了「圓滾滾大捲尾」）：身體半寬、半高、頭半徑、尾巴最粗的半徑
const L = { brx: 6.5, bry: 5, hr: 4, tail: 4.2 };
// 尾巴的路徑（尾巴根部為原點，朝右的松鼠）：往後、往上翻過背，尾端往前捲
const PATH = [[0, 1], [-3, -0.5], [-5.5, -5], [-6.5, -11], [-5, -16], [-1.5, -18.5], [1.5, -17.5], [2.5, -14.5]];
// 光從左上前方來（x 右、y 下、z 朝向看的人）
const LX = -0.5, LY = -0.75, LZ = 0.45;

// Catmull-Rom：把幾個控制點連成平滑的曲線，取 n 個點
function smooth(pts, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const f = (i / (n - 1)) * (pts.length - 1), k = Math.min(pts.length - 2, Math.floor(f)), t = f - k;
    const p0 = pts[Math.max(0, k - 1)], p1 = pts[k], p2 = pts[k + 1], p3 = pts[Math.min(pts.length - 1, k + 2)];
    const c = (a, b, c2, d) => 0.5 * (2 * b + (-a + c2) * t + (2 * a - 5 * b + 4 * c2 - d) * t * t + (-a + 3 * b - 3 * c2 + d) * t * t * t);
    out.push([c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])]);
  }
  return out;
}

// 有體積的蓬鬆尾巴：沿著曲線一顆一顆畫圓（根部先、尾端後蓋上去），每一格照「圓柱＋球」的法線打光：
//   左上亮、右下暗，受光那側最外圈一條亮毛邊，背光那側深色；每隔一段一撮毛（邊緣鋸齒＋後緣一道暗縫），貼著身體的地方加陰影
function fluffyTail(g, pts, R, C, body) {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1), [x, y] = pts[i];
    const [ax, ay] = pts[Math.max(0, i - 1)], [bx2, by2] = pts[Math.min(n - 1, i + 1)];
    let tx = bx2 - ax, ty = by2 - ay; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    const r = R(u), clump = (i % 7) / 7;                       // 一撮毛：一段裡從後往前 0→1
    g.shade(x - r - 2, y - r - 2, x + r + 2, y + r + 2, (px, py) => {
      const dx = px - x, dy = py - y, d = Math.hypot(dx, dy);
      const ang = Math.atan2(dy, dx);
      const tuft = 0.78 + 0.22 * Math.pow(Math.abs(Math.sin(ang * 3 + i * 0.9)), 0.6);   // 邊緣一撮一撮（毛尖翹出來）
      if (d > r * tuft + 0.3) return 0;
      const side = (dx * -ty + dy * tx) / r;                 // 橫過尾巴：-1～1
      const along = (dx * tx + dy * ty) / r;                 // 順著尾巴
      const nz = Math.sqrt(Math.max(0, 1 - side * side * 0.85 - along * along * 0.3));
      const nx = -ty * side + tx * along * 0.4, ny = tx * side + ty * along * 0.4;
      let lit = nx * LX + ny * LY + nz * LZ;
      if (clump < 0.2 && d > r * 0.4) lit -= 0.5;            // 一撮毛跟下一撮之間的暗縫
      if (Math.abs(Math.sin(ang * 5 + i * 1.7)) > 0.975 && d > r * 0.45 && d < r * 0.8) lit -= 0.25;   // 順著毛的短細紋（少少幾條）
      const edge = d / (r * tuft);
      if (body && body(px, py) < 1.45) lit -= 0.35;           // 貼著身體：陰影
      if (edge > 0.86 && nx * LX + ny * LY > 0.35) return C[6];   // 受光那側最外圈：一條亮毛邊
      if (edge > 0.84 && nx * LX + ny * LY < -0.15) return C[2];  // 背光那側
      return lit > 0.8 ? C[6] : lit > 0.5 ? C[5] : lit > 0.18 ? C[4] : lit > -0.15 ? C[3] : C[2];
    });
  }
}

function pose(o, t) {
  let y = 0, sq = 0, tilt = 0, arm = 0, tailLag = 0, holding = false, stretch = 0;
  if (o.mode === "hop") {
    const p = ((t / D) * 2) % 1;
    if (p < 0.22) { sq = 0.25 * Math.sin((p / 0.22) * Math.PI * 0.5); }
    else if (p < 0.72) { const q = (p - 0.22) / 0.5; y = -14 * 4 * q * (1 - q); stretch = q < 0.5 ? 0.18 * (1 - q * 2) : 0; tilt = lerp(-0.35, 0.3, q); tailLag = Math.sin(q * Math.PI) * -0.5; }
    else { const q = (p - 0.72) / 0.28; sq = 0.28 * Math.exp(-q * 4) * Math.cos(q * 6); tailLag = 0.35 * Math.exp(-q * 3); }
  } else if (o.mode === "throw") {
    if (t < 0.42) { const k = ease.outQuad(seg(t, 0, 0.42)); tilt = -0.55 * k; arm = -1 * k; holding = true; tailLag = -0.4 * k; sq = 0.1 * k; }
    else if (t < 0.52) { const k = ease.outExpo(seg(t, 0.42, 0.52)); tilt = lerp(-0.55, 0.25, k); arm = lerp(-1, 1, k); holding = t < 0.47; tailLag = lerp(-0.4, 0.22, k); }
    else { const k = ease.inOutSine(seg(t, 0.52, 1)); tilt = lerp(0.25, 0, k); arm = lerp(1, 0, k); tailLag = lerp(0.22, 0, k); }
  }
  return { y, sq, tilt, arm, tailLag, holding, stretch };
}

function acornSprite(g, x, y, rot, A) {
  // 松果：上面一頂殼帽（深）、下面圓圓的果實（亮），轉
  const cs = Math.cos(rot), sn = Math.sin(rot);
  g.shade(x - 4, y - 4, x + 4, y + 4, (px, py) => {
    const dx = px - x, dy = py - y, u = dx * cs + dy * sn, v = -dx * sn + dy * cs;
    if (v < -0.4) { if (u * u / 9 + (v + 1) * (v + 1) / 3.2 > 1) return 0; return Math.floor(u + 3) % 2 === 0 ? A[1] : A[2]; }
    if (u * u / 5.3 + (v + 0.2) * (v + 0.2) / 7 > 1) return 0;
    return u < -0.6 ? A[4] : u < 0.8 ? A[3] : A[2];
  });
  g.set(x - sn * 3.4, y - cs * 3.4, A[0]);   // 蒂
}

function squirrel(g, o, t) {
  const C = fit(o.palette, 7), B = fit(o.belly, 4), A = fit(o.acorn, 5), S = fit(o.shard, 4);
  g.clear();
  if (o.mode === "acorn") { acornSprite(g, 0, -5, (t / D) * TAU * 3, A); g.outline(INK); return null; }
  const q = pose(o, t);
  const sy = (1 - q.sq) * (1 + q.stretch), sx = (1 + q.sq * 0.7) * (1 - q.stretch * 0.5);
  const bx = 0, by = q.y - L.bry * sy - 1, rx = L.brx * sx, ry = L.bry * sy;
  const tilt = q.tilt, ct = Math.cos(tilt), st = Math.sin(tilt);
  const rot = (x, y) => [bx + x * ct - y * st, by + x * st + y * ct];

  // 尾巴：跟身體一起轉一半，再晚一拍甩（tailLag 繞著尾巴根部轉，越尾端轉越多）
  const tl = q.tailLag;
  const base = rot(-rx * 0.85, ry * 0.15), tt = tilt * 0.5;
  const pts = smooth(PATH.map(([px, py], i) => {
    const u = i / (PATH.length - 1), ang = tt + tl * u * u * 1.4;
    const c2 = Math.cos(ang), s2 = Math.sin(ang);
    return [base[0] + px * c2 - py * s2, base[1] + px * s2 + py * c2];
  }), 36);
  const bodyD = (x, y) => { const dx = x - bx, dy = y - by, u = (dx * ct + dy * st) / rx, v = (-dx * st + dy * ct) / ry; return Math.sqrt(u * u + v * v); };
  fluffyTail(g, pts, (u) => 1.8 + L.tail * Math.sin(Math.min(1, u / 0.88) * Math.PI * 0.86) * (u > 0.9 ? 0.8 : 1), C, bodyD);
  const tip = pts[pts.length - 2];
  // 身體：橢圓（左上亮），淺色肚子在前下
  g.shade(bx - rx - 3, by - ry - 3, bx + rx + 3, by + ry + 3, (x, y) => {
    const dx = x - bx, dy = y - by, u = (dx * ct + dy * st) / rx, v = (-dx * st + dy * ct) / ry;
    if (u * u + v * v > 1) return 0;
    if (u > 0.15 && v > 0.05) return v > 0.6 ? B[1] : B[2];
    const lit = -u * 0.45 - v * 0.85 - (u < -0.55 ? 0.35 : 0);   // 尾巴根部那一側被尾巴擋到光
    return lit > 0.6 ? C[6] : lit > 0.2 ? C[5] : lit > -0.3 ? C[4] : C[3];
  });
  // 頭：身體前上方的圓；尖嘴、耳朵（一撮毛）、紅眼
  const [hx, hy] = rot(rx * 0.75, -ry * 0.75);
  const hr = L.hr;
  g.shade(hx - hr - 3, hy - hr - 3, hx + hr + 4, hy + hr + 2, (x, y) => {
    const dx = x - hx, dy = y - hy;
    const snout = dx > 0 ? Math.max(0, 1 - Math.abs(dy - 1) / 2.2) * 2.4 : 0;     // 往前凸的嘴
    if (dx * dx + dy * dy > (hr + (dx > 0 ? snout * (dx / (hr + 2)) : 0)) ** 2 && !(dx > 0 && dx < hr + snout && Math.abs(dy - 1) < 1.6 - dx * 0.12)) return 0;
    if (dy > 0.8 && dx > -1) return B[2];
    const lit = -dx * 0.12 - dy * 0.4;
    return lit > 0.6 ? C[6] : lit > -0.2 ? C[5] : C[4];
  });
  g.set(hx - 1, hy - hr - 1, C[4]); g.set(hx - 1, hy - hr - 2, C[2]); g.set(hx, hy - hr - 1, C[3]); g.set(hx - 2, hy - hr - 3, C[6]);   // 耳朵＋一撮毛
  g.set(hx + 1, hy - 1, EYE); g.set(hx + 2, hy - 1, EYE); g.set(hx + 1, hy - 2, INK); g.set(hx + 2, hy - 2.6, INK);   // 凶的紅眼＋壓下來的眉
  g.set(hx + hr + 2, hy + 0.6, INK);   // 鼻子
  g.set(hx + hr + 0.5, hy + 2, hex("#fff4e0")); g.set(hx + hr, hy + 2, hex("#fff4e0"));   // 大門牙
  // 腳：後腳（大、折起來）、前手（拿松果）
  const [fx, fy] = rot(-rx * 0.2, ry * 0.9);
  g.set(fx - 1, fy, C[2]); g.set(fx, fy, C[3]); g.set(fx + 1, fy, C[3]); g.set(fx + 2, fy, C[2]);
  let acorn = null;
  // 手：舉到頭後上方（q.arm＝-1）→ 甩到嘴巴前面（q.arm＝1）；兩格粗、拿松果
  const sh = rot(rx * 0.5, ry * 0.05);
  const back = [hx - 3, hy - hr - 3], front = [hx + hr + 4, hy + 2], mid = [sh[0] + 3, sh[1] - 1];
  const k = q.arm, hand = k < 0 ? [lerp(mid[0], back[0], -k), lerp(mid[1], back[1], -k)] : [lerp(mid[0], front[0], k), lerp(mid[1], front[1], k)];
  g.line(sh[0], sh[1], hand[0], hand[1], C[3]); g.line(sh[0], sh[1] + 1, hand[0], hand[1] + 1, C[2]);
  if (q.holding) { acornSprite(g, hand[0], hand[1] - 3, 0.3, A); acorn = [hand[0], hand[1] - 3]; }
  // 星星碎片：卡在尾巴最粗的地方
  const sp = pts[14];
  const SH = ["..3..", ".323.", "32123", ".212.", "..1.."];
  SH.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== ".") g.set(sp[0] - 2 + i, sp[1] - 2 + j, S[+ch]); }));
  g.outline((x, y, nx, ny) => (ny > 0 ? C[0] : mix(C[0], C[1], 0.5)));
  return { sx: sp[0], sy: sp[1], acorn, tip };
}

export function draw(p, time, o) {
  const t = time % D;
  const r = squirrel(G, o, t);
  G.draw(p);
  if (!r) return;
  const S = fit(o.shard, 4);
  p.glow(r.sx, r.sy, 7, S[2], 0.18);
}

export function drawBack(p, time, o) {
  if (o.mode === "acorn") return;
  const C = fit(o.palette, 7);
  shadow(p, 0, -0.2, 8, 1.4, C[0], 0.5);
}
