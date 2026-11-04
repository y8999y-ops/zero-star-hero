// 場景互動第二階段（參考絲之歌／Ori）：
//   小生物：城鎮的小鳥、洞窟的光蛾停在地上，主角靠近或打到附近就受驚飛走，過一陣子再飛回來
//           螢火蟲一群一群繞著飛，主角經過會散開，之後慢慢聚回來
//   垂掛物：平台底下的藤蔓（碰到、打到會晃）、從洞頂吊下來的燈（打到會盪，光跟著晃）
//   水窪：走過去濺水花、落地有大水花，洞頂偶爾滴水，水面一圈一圈的漣漪
// 小鳥和光蛾是我畫的生物，照規則v2：1px 外框、硬邊、光從左上；水花、光點這些是特效。
import { hex } from "../../pixelfx/src/core/index.js";
import * as splashFx from "../../pixelfx/src/fx/water/splash.js";
import { spawn } from "./fx.js";

const C = (s) => hex(s) >>> 0;
const ramp = (a) => a.map(C);
const OUT = C("#120c1a");
const WATER = ramp(["#08121e", "#0e2034", "#16324e", "#20486c", "#2e6690", "#4a8cb4", "#7ab8d8", "#c8ecf8"]);
const DROP = ramp(["#2a7fc4", "#45a9e3", "#86d3f5", "#cdf1ff"]);
const VINE = ramp(["#07120e", "#0e2219", "#163626", "#1f4d35", "#2c6a46", "#3f8c58", "#5cb06c", "#86d488"]);
const CHAIN = ramp(["#14141c", "#262632", "#3a3a4a", "#565668", "#7a7a8e", "#a0a0b4"]);
const LAMP = ramp(["#3a1a06", "#7a3a0c", "#c06a14", "#f0a030", "#ffd060", "#fff2b0"]);
const FLY = [C("#9ad02a"), C("#d6ff5a"), C("#f4ffb8")], FLY_LIGHT = C("#5a7a1a");
const BULB = C("#a0eef4"), BULB_LIGHT = C("#1e7080");
const rnd = (a, b = 0) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

// ---- 生物的小圖：材質格 → 上色（左上亮、右下暗）→ 1px 外框（跟 npcs.js 同一套）
function sprite(rows, mats) {
  const H = rows.length, W = rows[0].length, m = rows.map((r) => [...r]);
  const empty = (x, y) => x < 0 || y < 0 || x >= W || y >= H || m[y][x] === ".";
  const px = Array.from({ length: H + 2 }, () => Array(W + 2).fill(0));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = m[y][x];
    if (k === ".") continue;
    const R = mats[k];
    if (typeof R === "number") { px[y + 1][x + 1] = R; continue; }
    const diff = (a, b) => empty(a, b) || m[b][a] !== k;
    let t = 1;
    if (diff(x - 1, y) || diff(x, y - 1)) t = 2;
    else if (diff(x + 1, y) || diff(x, y + 1)) t = 0;
    px[y + 1][x + 1] = R[t];
  }
  for (let y = 0; y < H + 2; y++) for (let x = 0; x < W + 2; x++) {
    if (px[y][x]) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => px[y + b]?.[x + a] && px[y + b][x + a] !== OUT)) px[y][x] = OUT;
  }
  return { px, W: W + 2, H: H + 2 };
}
// 小鳥（面向右）：b 身體、r 胸口、k 嘴、e 眼睛、l 腳、w 翅膀
const BIRD_M = { b: ramp(["#5a3a22", "#8a5a32", "#b88452"]), r: ramp(["#a8441c", "#e8783a", "#ffb070"]), w: ramp(["#4a2e1a", "#6e4626", "#9a6a3e"]), k: C("#ffc040"), e: C("#120c1a"), l: C("#3a2418") };
const BIRD = {
  sit: sprite(["...bb..", "..bbbek", ".bbbbb.", "bbwwrr.", ".bwwrr.", "..l.l.."], BIRD_M),
  peck: sprite([".......", "..bb...", ".bbbb..", "bbwwbbe", ".bwwrrk", "..l.l.."], BIRD_M),
  up: sprite([".ww....", "..ww...", "..wbbb.", ".bbbbek", "bbbrrr.", "..rr..."], BIRD_M),
  down: sprite(["...bbb.", "..bbbek", "bbbbrr.", "..wwr..", ".ww....", "ww....."], BIRD_M),
};
// 光蛾：g 發光的翅膀、d 身體
const MOTH_M = { g: ramp(["#2e8fa8", "#6ad4e0", "#c8f8ff"]), d: ramp(["#2a2440", "#3e3660", "#5a5088"]) };
const MOTH = {
  sit: sprite([".g.g.", "ggdgg", ".gdg.", "..d.."], MOTH_M),
  open: sprite(["gg.gg", "ggdgg", "gg.gg"], MOTH_M),
  shut: sprite(["..d..", ".gdg.", ".gdg.", "..d.."], MOTH_M),
};

export function createScenery({ floor, w, platforms = [], town = false }) {
  const critters = [], swarms = [], hangs = [], puddles = [], drops = [], rings = [];

  // ---- 水窪（關卡）：x 是中心
  if (!town) for (const [x, pw] of [[470, 30], [1010, 34], [1360, 26], [1800, 32], [2075, 28]]) if (x < w - 30) puddles.push({ x, w: pw, y: floor, stepD: 0, dripT: 1 + rnd(x) * 3 });

  // ---- 小生物
  const homes = town ? [118, 282, 640, 870, 960] : [350, 905, 1235, 1490, 1955, 2190];
  homes.forEach((x, i) => { if (x < w - 20) critters.push({ kind: town ? "bird" : "moth", hx: x, x, y: floor, vx: 0, vy: 0, face: i % 2 ? -1 : 1, state: "sit", t: rnd(i, 3) * 3, gone: 0, flap: 0 }); });
  // 螢火蟲群
  const swarmAt = town ? [[300, 150], [720, 140], [930, 156]] : [[700, 156], [1180, 150], [1660, 160], [2150, 150]];
  for (const [x, y] of swarmAt) if (x < w - 20) {
    const flies = [];
    for (let i = 0; i < 7; i++) flies.push({ ox: (rnd(x, i) - 0.5) * 36, oy: (rnd(x, i + 9) - 0.5) * 22, x: x + (rnd(x, i) - 0.5) * 36, y: y + (rnd(x, i + 9) - 0.5) * 22, vx: 0, vy: 0, ph: rnd(x, i + 20) * 6, sp: 0.6 + rnd(x, i + 30) * 0.8 });
    swarms.push({ x, y, flies });
  }

  // ---- 垂掛物：藤蔓（平台底下）、吊燈（洞頂）
  platforms.forEach((p, j) => {
    for (let x = p.x + 6; x < p.x + p.w - 4; x += 11 + Math.floor(rnd(j, x) * 14)) {
      hangs.push({ kind: "vine", x, y: p.y + 9, len: 6 + Math.floor(rnd(j, x + 1) * 11), a: 0, av: 0, bulb: rnd(j, x + 2) < 0.35, ph: rnd(j, x + 3) * 6 });
    }
  });
  if (!town) for (const x of [820, 1560, 2120]) if (x < w - 30) hangs.push({ kind: "lamp", x, y: -4, len: 92 + (x % 3) * 6, a: 0, av: 0, ph: x });

  // ---- 粒子：水滴
  const splash = (x, y, n, dir = 0, up = 90) => {
    for (let i = 0; i < n; i++) drops.push({ x: x + (Math.random() - 0.5) * 4, y: y - 1, vx: dir * 30 + (Math.random() - 0.5) * 70, vy: -up * (0.5 + Math.random() * 0.7), life: 0.8, col: DROP[1 + Math.floor(Math.random() * 3)] });
  };
  const ripple = (pd, x, big = false) => rings.push({ pd, x, r: 0, life: big ? 1.4 : 1, max: big ? pd.w / 2 : pd.w / 3 });
  const puddleAt = (x, y) => puddles.find((p) => Math.abs(p.x - x) < p.w / 2 && Math.abs(p.y - y) < 2);

  const scare = (c, fromX) => {
    if (c.state !== "sit") return;
    c.state = "fly";
    c.face = c.x >= fromX ? 1 : -1;
    c.vx = c.face * (60 + Math.random() * 40);
    c.vy = -(70 + Math.random() * 40);
    c.t = 0;
  };

  function update(dt, player, view) {
    const px = player.x, py = player.y, fast = Math.abs(player.vx) > 70 || player.state === "dash";
    // 小生物
    for (const c of critters) {
      c.t += dt; c.flap += dt;
      if (c.state === "sit") {
        const d = Math.abs(px - c.x);
        if ((d < 34 && Math.abs(py - c.y) < 40) || (fast && d < 60)) scare(c, px);
        // 停著的時候：小鳥偶爾啄地、跳一下；光蛾翅膀偶爾開合
        if (c.kind === "bird" && c.t > 2.2) { c.t = 0; if (Math.random() < 0.35) { c.face = -c.face; } }
      } else if (c.state === "fly") {
        c.vy -= 30 * dt; c.vx *= 1 + 0.4 * dt;
        if (c.kind === "moth") c.x += Math.sin(c.t * 9) * 30 * dt;   // 光蛾飛得歪歪扭扭
        c.x += c.vx * dt; c.y += c.vy * dt;
        if (c.y < -20 || c.x < view.x0 - 60 || c.x > view.x1 + 60) { c.state = "gone"; c.gone = 9 + Math.random() * 8; }
      } else if (c.state === "gone") {
        // 主角走遠了才回來，從上面斜斜飛下來停回原位
        if ((c.gone -= dt) <= 0 && Math.abs(px - c.hx) > 90) { c.state = "back"; c.x = c.hx + (Math.random() < 0.5 ? -60 : 60); c.y = c.hy ?? floor - 90; c.face = c.x < c.hx ? 1 : -1; }
      } else if (c.state === "back") {
        const dx = c.hx - c.x, dy = floor - c.y, d = Math.hypot(dx, dy);
        if (d < 2) { c.state = "sit"; c.x = c.hx; c.y = floor; c.t = 0; continue; }
        const sp = Math.min(70, d * 2.2);
        c.x += (dx / d) * sp * dt; c.y += (dy / d) * sp * dt;
        if (Math.abs(px - c.x) < 40) scare(Object.assign(c, { state: "sit" }), px);
      }
    }
    // 螢火蟲：跟著自己的「家」繞，被主角推開
    for (const s of swarms) for (const f of s.flies) {
      f.ph += dt * f.sp;
      const tx = s.x + f.ox + Math.sin(f.ph * 1.3) * 10, ty = s.y + f.oy + Math.cos(f.ph) * 6;
      f.vx += (tx - f.x) * 1.6 * dt; f.vy += (ty - f.y) * 1.6 * dt;
      const dx = f.x - px, dy = f.y - (py - 12), d = Math.hypot(dx, dy);
      if (d < 34) { const k = (34 - d) * (fast ? 90 : 55) * dt / Math.max(4, d); f.vx += dx * k; f.vy += dy * k; }
      f.vx *= 1 - 1.4 * dt; f.vy *= 1 - 1.4 * dt;
      f.x += f.vx * dt; f.y += f.vy * dt;
    }
    // 垂掛物：鐘擺；主角穿過藤蔓、身體碰到吊燈都會推一下
    for (const h of hangs) {
      const L = h.kind === "lamp" ? h.len : h.len * 3;   // 藤蔓擺得比較快（看起來比較輕）
      h.av += (-(900 / L) * Math.sin(h.a) - h.av * (h.kind === "lamp" ? 0.5 : 2.2)) * dt;
      h.av += Math.sin(performance.now() / 900 + h.ph) * (h.kind === "lamp" ? 0.02 : 0.15) * dt;   // 一點點風
      h.a += h.av * dt;
      const tipY = h.y + h.len, tipX = h.x + Math.sin(h.a) * h.len;
      if (Math.abs(px - tipX) < 7 && py - 24 < tipY && py > h.y + (h.kind === "lamp" ? h.len - 8 : 0)) h.av += (player.vx / 60 + (px < tipX ? 0.4 : -0.4)) * (h.kind === "lamp" ? 1.2 : 3) * dt * 10;
    }
    // 水窪：走路踩水、滴水
    const pd = player.grounded && puddleAt(px, py);
    if (pd && Math.abs(player.vx) > 20) {
      pd.stepD += Math.abs(player.vx) * dt;
      if (pd.stepD > 10) { pd.stepD = 0; splash(px, pd.y, 3, Math.sign(player.vx) * 0.5, 70); ripple(pd, px); }
    }
    for (const p of puddles) {
      if (p.x < view.x0 - 40 || p.x > view.x1 + 40) continue;
      if ((p.dripT -= dt) <= 0) { p.dripT = 2.5 + Math.random() * 3; drops.push({ x: p.x + (Math.random() - 0.5) * p.w * 0.6, y: 30, vx: 0, vy: 0, life: 3, col: DROP[2], drip: p }); }
    }
    for (let i = drops.length - 1; i >= 0; i--) {
      const q = drops[i];
      q.vy += 520 * dt; q.x += q.vx * dt; q.y += q.vy * dt;
      if ((q.life -= dt) <= 0) { drops.splice(i, 1); continue; }
      if (q.drip && q.y >= q.drip.y) { ripple(q.drip, q.x); splash(q.x, q.drip.y, 2, 0, 50); drops.splice(i, 1); continue; }
      if (!q.drip && q.vy > 0 && q.y >= floor) drops.splice(i, 1);
    }
    for (let i = rings.length - 1; i >= 0; i--) { const r = rings[i]; r.r += 16 * dt; if ((r.life -= dt) <= 0 || r.r > r.max) rings.splice(i, 1); }
  }

  /** 攻擊打到附近：小生物嚇跑、垂掛物被打得盪起來 */
  function hit(box, dir) {
    const cx = (box.x0 + box.x1) / 2;
    for (const c of critters) if (c.state === "sit" && Math.abs(c.x - cx) < 50) scare(c, cx);
    for (const h of hangs) {
      const tipX = h.x + Math.sin(h.a) * h.len, top = h.kind === "lamp" ? h.y + h.len - 10 : h.y, bot = h.y + h.len + (h.kind === "lamp" ? 10 : 0);
      if (tipX >= box.x0 - 4 && tipX <= box.x1 + 4 && bot >= box.y0 && top <= box.y1) h.av += dir * (h.kind === "lamp" ? 0.8 : 2.5);
    }
  }
  /** 落地：落在水窪裡是大水花 */
  function landing(x, y, hard) {
    const pd = puddleAt(x, y);
    if (!pd) return;
    splash(x, pd.y, hard ? 10 : 6, 0, hard ? 150 : 100);
    ripple(pd, x, true);
    if (hard) spawn(splashFx, { x: Math.round(x), y: pd.y + 1, stone: false, light: 0.2, seed: (Math.random() * 99) | 0 }, { speed: 2.2 });
  }
  function lights(list) {
    for (const h of hangs) if (h.kind === "lamp") list.push({ x: h.x + Math.sin(h.a) * (h.len + 4), y: h.y + Math.cos(h.a) * (h.len + 4), r: 64, lv: 2.2, col: "#ffb050" });
    for (const s of swarms) list.push({ x: s.x, y: s.y, r: 30, lv: 0.35, col: "#9ad02a" });
  }

  function draw(frame, lv, time) {
    const Wf = frame.w, Hf = frame.h, Cb = frame.color, LB = frame.light, ox = frame.ox | 0, oy = frame.oy | 0;
    const idx = (x, y) => { const sx = Math.round(x) - ox, sy = Math.round(y) - oy; return sx < 0 || sy < 0 || sx >= Wf || sy >= Hf ? -1 : sy * Wf + sx; };
    const put = (x, y, c, glow = 0) => { const i = idx(x, y); if (i < 0) return; Cb[i] = c; if (glow) LB[i] = glow; };
    const shade = (x, y, pal, t) => { const i = idx(x, y); if (i < 0) return; Cb[i] = pal[Math.max(0, Math.min(pal.length - 1, Math.round(t + Math.min(2, lv[i]) * 0.9)))]; };
    const x0 = ox - 40, x1 = ox + Wf + 40;
    // 水窪：表面一排亮的、下面兩排暗的；左右兩端收窄；漣漪是表面上往外跑的亮點
    for (const p of puddles) {
      if (p.x < x0 || p.x > x1) continue;
      const L = Math.round(p.x - p.w / 2), R = Math.round(p.x + p.w / 2);
      for (let x = L; x <= R; x++) {
        const edge = Math.min(x - L, R - x);
        for (let r = 0; r < 3; r++) {
          if (edge < r) continue;
          const tw = r === 0 ? 4 + ((x + Math.floor(time * 3)) % 9 === 0 ? 2 : 0) : 2 - r * 0.5;
          shade(x, p.y + r, WATER, tw);
        }
      }
    }
    for (const r of rings) {
      const k = r.life > 0.5 ? 7 : 6;
      for (const s of [-1, 1]) { const x = r.x + s * r.r; if (Math.abs(x - r.pd.x) < r.pd.w / 2 - 1) put(x, r.pd.y, WATER[k]); }
    }
    // 垂掛物
    for (const h of hangs) {
      if (h.x < x0 || h.x > x1) continue;
      const s = Math.sin(h.a), c = Math.cos(h.a);
      if (h.kind === "vine") {
        for (let i = 0; i <= h.len; i++) {
          const k = i / h.len, bend = Math.sin(h.a * (0.6 + 0.8 * k));   // 越下面晃越多，像軟的
          const x = h.x + bend * i, y = h.y + i * Math.cos(h.a * 0.7);
          shade(x, y, VINE, i < 2 ? 2 : 3 + (i % 3 === 0 ? 1 : 0));
          if (i % 4 === 2) shade(x + (i % 8 === 2 ? 1 : -1), y, VINE, 2);   // 小葉子
        }
        if (h.bulb) { const bx = h.x + Math.sin(h.a * 1.4) * h.len, by = h.y + h.len + 1; put(bx, by, BULB, BULB_LIGHT); put(bx, by + 1, OUT); }
      } else {
        for (let i = 0; i < h.len; i++) { const x = h.x + s * i, y = h.y + c * i; shade(x, y, CHAIN, Math.floor(i / 2) % 2 ? 2 : 3); }
        // 燈：蓋子、發光的燈罩、底座（跟著角度歪）
        const lx = h.x + s * h.len, ly = h.y + c * h.len;
        const LAMP_ROWS = ["..ooo..", ".occco.", "oglllgo", "ogllLgo", "ogllLgo", "oglllgo", ".occco.", "..ooo.."];
        LAMP_ROWS.forEach((row, j) => [...row].forEach((ch, i) => {
          if (ch === ".") return;
          const dx = i - 3, dy = j, x = lx + dx * c + dy * s, y = ly - dx * s + dy * c;
          const col = ch === "o" ? OUT : ch === "c" ? CHAIN[3] : ch === "g" ? LAMP[2] : ch === "L" ? LAMP[5] : LAMP[4];
          put(x, y, col, ch === "l" || ch === "L" ? C("#7a3a0c") : 0);
        }));
      }
    }
    // 螢火蟲：亮度一閃一閃，亮的時候寫進光的緩衝（會發光暈）
    for (const sw of swarms) for (const f of sw.flies) {
      if (f.x < x0 || f.x > x1) continue;
      const b = 0.5 + 0.5 * Math.sin(f.ph * 3 + f.ox);
      if (b < 0.2) continue;
      put(f.x, f.y, FLY[b > 0.75 ? 2 : b > 0.45 ? 1 : 0], FLY_LIGHT);
    }
    // 小生物
    for (const c of critters) {
      if (c.state === "gone" || c.x < x0 || c.x > x1) continue;
      let s;
      if (c.kind === "bird") s = c.state === "sit" ? (Math.floor(time * 1.3 + c.hx) % 4 === 0 ? BIRD.peck : BIRD.sit) : Math.floor(c.flap * 14) % 2 ? BIRD.up : BIRD.down;
      else s = c.state === "sit" ? (Math.floor(time * 0.8 + c.hx) % 5 === 0 ? MOTH.open : MOTH.sit) : Math.floor(c.flap * 18) % 2 ? MOTH.open : MOTH.shut;
      const bx = Math.round(c.x) - (s.W >> 1), by = Math.round(c.y) - s.H + 1, flip = c.face < 0;
      for (let y = 0; y < s.H; y++) for (let x = 0; x < s.W; x++) {
        const col = s.px[y][flip ? s.W - 1 - x : x];
        if (col) put(bx + x, by + y, col, c.kind === "moth" && col !== OUT ? BULB_LIGHT : 0);
      }
    }
    for (const q of drops) put(q.x, q.y, q.col, q.drip ? 0 : 0);
  }

  return { update, hit, landing, lights, draw, puddles, critters, swarms, hangs, drops, rings };
}
