// 場景互動物件（第一階段，參考絲之歌／Ori）：
//   草叢：主角或怪經過會往兩邊倒、像彈簧一樣晃回來；衝刺穿過會飛草屑；在關卡可以砍斷，離開畫面一陣子後長回來
//   木箱、垃圾堆：打 2～3 下會碎，碎片四散，掉幾枚金幣
//   水晶：主角靠近會亮起來、「叮」一聲；在關卡可以打碎
//   落地：踩到地面會揚起一點草屑
// 物件本身是場景（不受規則v2），畫的時候跟遊玩層一樣用色階＋光照上色；碎片、草屑這些是特效，用 PixelFX 加自己的粒子。
import { hex } from "../../pixelfx/src/core/index.js";
import * as poof from "../../pixelfx/src/fx/spawn/poof.js";
import { hitFx } from "./combatfx.js";
import { spawn, shake } from "./fx.js";
import { flash } from "./light.js";
import { blip } from "./dialog.js";

const ramp = (a) => a.map((c) => hex(c) >>> 0);
const GRASS = ramp(["#07120e", "#0e2219", "#163626", "#1f4d35", "#2c6a46", "#3f8c58", "#5cb06c", "#86d488"]);
const TOWN_GRASS = ramp(["#0a160e", "#13281a", "#1c3c24", "#285430", "#386e3c", "#4e8c48", "#6eae5c", "#9ad27a"]);
const WOOD = ramp(["#1a0e08", "#2e1a0e", "#4a2a16", "#6a3e20", "#8e5a30", "#b07a44", "#d0a066", "#ecc890"]);
const TIN = ramp(["#10141c", "#1e2632", "#323e4e", "#4a5868", "#687888", "#8a9aaa", "#b0bece", "#dce6f0"]);
const RUST = ramp(["#1a0c08", "#34160c", "#5a2412", "#84361a", "#a84e24", "#c86e36", "#e0905a", "#f0b888"]);
const RUBBER = ramp(["#08080c", "#121218", "#1c1c24", "#282832", "#363642", "#484856", "#5e5e6e", "#7a7a8a"]);
const CYAN = ramp(["#0e3440", "#14505e", "#1e7080", "#2e8fa8", "#46b4c8", "#6ad4e0", "#a0eef4", "#e0ffff"]);
const GOLD = ramp(["#3a2408", "#6a420e", "#9a6414", "#c88a1c", "#f0b02a", "#ffd04a", "#fff08a", "#fffbe0"]);

const rnd = (a, b = 0) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

/**
 * 建立一個場景的互動物件。
 * opts: { floor, w, platforms, town, avoid: [x...] }
 */
export function createProps({ floor, w, platforms = [], town = false, avoid = [] }) {
  const grassPal = town ? TOWN_GRASS : GRASS;
  const tufts = [], boxes = [], crystals = [], bits = [];
  const clear = (x, r) => avoid.every((a) => Math.abs(a - x) > r);

  // ---- 草叢：每叢 3～6 根草，高低不一
  const addTuft = (x, y, k) => {
    const n = 3 + Math.floor(rnd(k, 1) * 4), blades = [];
    for (let i = 0; i < n; i++) blades.push({ dx: i * 2 - n + 1 + Math.round(rnd(k, i + 10) - 0.5), h: 4 + Math.floor(rnd(k, i + 20) * (town ? 5 : 7)), lean: rnd(k, i + 30) * 2 - 1, t: 4 + Math.floor(rnd(k, i + 40) * 3) });
    tufts.push({ x, y, blades, bend: 0, vel: 0, cut: false, cutT: 0, near: false });
  };
  for (let x = 30, k = 0; x < w - 30; k++) {
    if (clear(x, 14)) addTuft(x, floor, k);
    x += 14 + Math.floor(rnd(k, 2) * 30);
  }
  platforms.forEach((p, j) => { for (let x = p.x + 8; x < p.x + p.w - 8; x += 18 + Math.floor(rnd(j, x) * 14)) addTuft(x, p.y, 900 + j * 31 + x); });

  // ---- 可以打破的東西、水晶（城鎮不能打，只放草）
  if (!town) {
    [[262, "crate"], [404, "junk"], [770, "crate"], [962, "junk"], [1150, "crate"], [1432, "junk"], [1604, "crate"], [1876, "junk"], [2010, "crate"], [2140, "junk"]].forEach(([x, type]) => {
      if (x < w - 40 && clear(x, 20)) boxes.push({ x, y: floor, type, hp: type === "crate" ? 2 : 3, cool: 0, shakeT: 0, broken: false, seed: x });
    });
    [[560, "cyan", 1], [1280, "gold", 1], [1720, "cyan", 0], [2240, "cyan", 1], [880, "gold", 0]].forEach(([x, col, big]) => {
      if (x < w - 30 && clear(x, 16)) crystals.push({ x, y: floor, col, big, glow: 0, broken: false, cool: 0, hp: 2, chimed: false });
    });
  }

  // ---- 粒子（草屑、木片、碎片）：自己的小系統，有重力、會在地上彈一下
  const emit = (x, y, n, pal, { vx = 0, spread = 90, up = 110, leaf = false, big = false, life = 0.9 } = {}) => {
    for (let i = 0; i < n; i++) bits.push({
      x, y, vx: vx + (Math.random() - 0.5) * spread, vy: -up * (0.4 + Math.random() * 0.8), life: life * (0.6 + Math.random() * 0.6),
      col: pal[3 + Math.floor(Math.random() * 4)], dark: pal[2], leaf, big, ph: Math.random() * 6, rest: false,
    });
  };

  // ---- 每一格更新：movers = [{ x, y, vx, dash }]（主角、怪）
  function update(dt, movers, view) {
    for (const t of tufts) {
      // 經過的東西把草往外推：越近、跑越快推越多
      let force = 0;
      for (const m of movers) {
        const dx = t.x - m.x;
        if (Math.abs(dx) > 14 || Math.abs(m.y - t.y) > 6) continue;
        force += Math.sign(dx || m.vx || 1) * (1 - Math.abs(dx) / 14) * (3 + Math.min(3, Math.abs(m.vx) / 50));
        if (m.dash && !t.cut && Math.random() < 0.3) emit(t.x, t.y - 4, 1, grassPal, { vx: m.vx * 0.4, leaf: true, up: 60, life: 1.4 });
      }
      // 彈簧：被推開，再晃回來（阻尼讓它晃兩三下就停）
      t.vel += (force * 440 - t.bend * 260 - t.vel * 14) * dt;
      t.bend = Math.max(-6, Math.min(6, t.bend + t.vel * dt));
      if (t.cut && (t.cutT -= dt) <= 0 && (t.x < view.x0 - 20 || t.x > view.x1 + 20)) t.cut = false;   // 離開畫面才長回來
    }
    for (const b of boxes) { b.cool -= dt; b.shakeT -= dt; }
    for (const c of crystals) {
      if (c.broken) continue;
      c.cool -= dt;
      const p = movers[0], near = p && Math.abs(p.x - c.x) < 40 && Math.abs(p.y - c.y) < 40;
      c.glow += ((near ? 1 : 0) - c.glow) * Math.min(1, dt * (near ? 5 : 1.5));
      if (near && !c.chimed && c.glow > 0.5) { c.chimed = true; blip(c.col === "gold" ? 1568 : 1976, "sine"); setTimeout(() => blip(c.col === "gold" ? 2093 : 2637, "sine"), 70); }
      if (!near && c.glow < 0.15) c.chimed = false;
    }
    for (let i = bits.length - 1; i >= 0; i--) {
      const q = bits[i];
      if ((q.life -= dt) <= 0) { bits.splice(i, 1); continue; }
      if (q.rest) continue;
      q.ph += dt * 9;
      if (q.leaf) { q.vy += 260 * dt; q.vy = Math.min(q.vy, 40); q.vx *= 1 - 2.5 * dt; q.x += (q.vx + Math.sin(q.ph) * 22) * dt; }   // 葉子飄著掉
      else { q.vy += 520 * dt; q.x += q.vx * dt; }
      q.y += q.vy * dt;
      const g = groundY(q.x, q.y);
      if (g !== null && q.vy > 0 && q.y >= g) { q.y = g; if (q.leaf || Math.abs(q.vy) < 60) q.rest = true; else { q.vy *= -0.3; q.vx *= 0.5; } }
    }
  }
  const groundY = (x, y) => {
    let best = floor;
    for (const p of platforms) if (x >= p.x && x <= p.x + p.w && y <= p.y + 2 && p.y < best) best = p.y;
    return best;
  };

  // ---- 攻擊打到：box 是攻擊範圍，dir 是方向。回傳打到幾個（不算怪）
  function hit(box, dir) {
    if (town) return 0;
    let n = 0;
    const inBox = (x, y0, y1) => x >= box.x0 - 2 && x <= box.x1 + 2 && y1 >= box.y0 && y0 <= box.y1;
    for (const t of tufts) {
      if (t.cut || !inBox(t.x, t.y - 10, t.y)) continue;
      t.cut = true; t.cutT = 6; t.vel += dir * 60;
      emit(t.x, t.y - 4, 7, grassPal, { vx: dir * 50, leaf: true, up: 90, life: 1.6 });
      emit(t.x, t.y - 2, 3, grassPal, { vx: dir * 80, up: 120 });
    }
    for (const b of boxes) {
      if (b.broken || b.cool > 0) continue;
      const hgt = b.type === "crate" ? 13 : 11;
      if (!inBox(b.x, b.y - hgt, b.y)) continue;
      b.cool = 0.2; b.shakeT = 0.16; b.hp--; n++;
      const pal = b.type === "crate" ? WOOD : RUST;
      hitFx(b.x - dir * 4, b.y - 7, dir, b.hp <= 0);
      emit(b.x, b.y - 8, 4, pal, { vx: dir * 60, up: 100 });
      if (b.hp <= 0) {
        b.broken = true;
        spawn(poof, { x: Math.round(b.x), y: b.y, light: 0.2, seed: (Math.random() * 99) | 0, palette: ["#1a1420", "#3a3040", "#5e5466", "#857a8a", "#aaa0ac", "#d0c8d0"] }, { speed: 1.8, layer: "back" });
        emit(b.x, b.y - 8, 10, pal, { vx: dir * 70, spread: 160, up: 180, big: true, life: 2.2 });
        if (b.type === "junk") { emit(b.x, b.y - 6, 5, TIN, { vx: dir * 40, spread: 140, up: 160, big: true, life: 2 }); emit(b.x, b.y - 6, 3, RUBBER, { spread: 120, up: 120, big: true, life: 2 }); }
        shake(0.12, 1.5);
        api.onBreak?.(b);
      }
    }
    for (const c of crystals) {
      if (c.broken || c.cool > 0) continue;
      const hgt = c.big ? 16 : 11;
      if (!inBox(c.x, c.y - hgt, c.y)) continue;
      c.cool = 0.2; c.hp--; c.glow = 1; n++;
      const pal = c.col === "gold" ? GOLD : CYAN, light = c.col === "gold" ? "#ffd84a" : "#46d4e8";
      blip(c.col === "gold" ? 1760 : 2349, "triangle");
      flash(c.x, c.y - 8, 50, 2, 0.25, light);
      emit(c.x, c.y - 8, 3, pal, { vx: dir * 60, up: 100 });
      if (c.hp <= 0) {
        c.broken = true;
        flash(c.x, c.y - 8, 90, 3.5, 0.6, light);
        emit(c.x, c.y - 8, 14, pal, { vx: dir * 50, spread: 200, up: 200, big: true, life: 2.4 });
        emit(c.x, c.y - 10, 8, pal, { spread: 120, up: 140, life: 1.2 });
        [0, 90, 180].forEach((ms, i) => setTimeout(() => blip([2637, 2093, 3136][i], "sine"), ms));
        shake(0.15, 2);
        api.onBreak?.(c);
      }
    }
    return n;
  }

  /** 落地：腳下揚起草屑（有草的地方多一點） */
  function landing(x, y, hard) {
    const near = tufts.some((t) => !t.cut && Math.abs(t.x - x) < 10 && Math.abs(t.y - y) < 3);
    emit(x, y - 1, (near ? 5 : 2) + (hard ? 3 : 0), grassPal, { spread: 120, up: 70, leaf: near, life: near ? 1.2 : 0.6 });
    for (const t of tufts) if (Math.abs(t.x - x) < 16 && Math.abs(t.y - y) < 3) t.vel += Math.sign(t.x - x || 1) * (hard ? 50 : 25);
  }

  /** 水晶的光（靠近時變亮） */
  function lights(list) {
    for (const c of crystals) if (!c.broken) list.push({ x: c.x, y: c.y - (c.big ? 8 : 5), r: 22 + c.glow * 26, lv: 0.5 + c.glow * 1.8, col: c.col === "gold" ? "#ffd27a" : "#46d4e8" });
  }

  // ---- 畫：跟遊玩層一樣，色階位置加上光照（lv 是螢幕座標的亮度）
  function draw(frame, lv) {
    const Wf = frame.w, Hf = frame.h, C = frame.color, ox = frame.ox | 0, oy = frame.oy | 0;
    const put = (x, y, pal, t, emissive = 0) => {
      const sx = Math.round(x) - ox, sy = Math.round(y) - oy;
      if (sx < 0 || sy < 0 || sx >= Wf || sy >= Hf) return;
      const i = sy * Wf + sx, l = lv ? lv[i] : 1;
      C[i] = pal[Math.max(0, Math.min(7, Math.round(t + Math.min(2.5, l) * (emissive ? 0.4 : 0.9) + emissive)))];
    };
    const x0 = ox - 30, x1 = ox + Wf + 30;
    for (const t of tufts) {
      if (t.x < x0 || t.x > x1) continue;
      for (const b of t.blades) {
        const h = t.cut ? 2 : b.h;
        for (let r = 0; r < h; r++) {
          const k = r / Math.max(1, b.h - 1);   // 越上面彎越多（根部不動）
          const off = Math.round((t.bend + b.lean * 1.2) * k * k);
          const tone = r === h - 1 && !t.cut ? b.t + 1 : r < 2 ? b.t - 2 : b.t - (r < h / 2 ? 1 : 0);
          put(t.x + b.dx + off, t.y - 1 - r, grassPal, tone - 2);
        }
      }
    }
    for (const b of boxes) {
      if (b.broken || b.x < x0 || b.x > x1) continue;
      const sx = b.shakeT > 0 ? (Math.floor(b.shakeT * 60) % 2 ? 1 : -1) : 0;
      if (b.type === "crate") drawCrate(put, b.x + sx, b.y, b.hp);
      else drawJunk(put, b.x + sx, b.y, b.hp, b.seed);
    }
    for (const c of crystals) {
      if (c.broken || c.x < x0 || c.x > x1) continue;
      drawCrystal(put, c.x, c.y, c.big, c.col === "gold" ? GOLD : CYAN, c.glow, c.hp);
    }
    for (const q of bits) {
      const blink = q.life < 0.3 && Math.floor(q.life * 20) % 2;   // 快消失時閃一下
      if (blink) continue;
      put(q.x, q.y, [q.col, q.col, q.col, q.col, q.col, q.col, q.col, q.col], 0);
      if (q.big) put(q.x + 1, q.y, [q.dark, q.dark, q.dark, q.dark, q.dark, q.dark, q.dark, q.dark], 0);
    }
  }

  const api = { update, hit, landing, lights, draw, onBreak: null, tufts, boxes, crystals, bits };
  return api;
}

// 木箱 14×13：外框深、木板一條一條、斜撐，左上亮右下暗；被打過會多裂痕
function drawCrate(put, cx, by, hp) {
  const L = Math.round(cx) - 7, T = by - 13;
  for (let y = 0; y < 13; y++) for (let x = 0; x < 14; x++) {
    const edge = x === 0 || y === 0 || x === 13 || y === 12;
    const frameBand = x <= 1 || x >= 12 || y <= 1 || y >= 11;
    const diag = Math.abs((x - 1) - (y - 1) * 11 / 10) < 1;
    let t = edge ? 1 : frameBand || diag ? 4 : (y % 4 === 3 ? 2 : 3);
    if (!edge && (x === 1 || y === 1)) t += 1;
    if (!edge && (x === 12 || y === 11)) t -= 1;
    if (hp < 2 && !edge && ((x === 8 && y > 3 && y < 9) || (x === 9 && y > 5 && y < 8))) t = 0;   // 裂痕
    put(L + x, T + y, WOOD, t - 1);
  }
}
// 垃圾堆 20×11：鐵罐、輪胎、木板疊成一小堆
function drawJunk(put, cx, by, hp, seed) {
  const L = Math.round(cx) - 10;
  // 底下的土堆
  for (let x = 0; x < 20; x++) { const h = Math.round(4 - Math.abs(x - 9.5) / 3); for (let y = 0; y < h; y++) put(L + x, by - 1 - y, RUST, y === h - 1 ? 2 : 1); }
  // 輪胎（左）
  for (let y = 0; y < 7; y++) for (let x = 0; x < 8; x++) {
    const dx = x - 3.5, dy = y - 3, d = Math.hypot(dx, dy * 1.1);
    if (d > 3.8 || d < 1.6) continue;
    put(L + 1 + x, by - 9 + y, RUBBER, d > 3.1 ? 1 : dx + dy < 0 ? 5 : 3);
  }
  // 鐵罐（中，被打過會凹）
  for (let y = 0; y < 8; y++) for (let x = 0; x < 5; x++) {
    if (hp < 3 && x === 4 && y > 2 && y < 6) continue;
    put(L + 9 + x, by - 10 + y, TIN, x === 0 ? 5 : x === 4 || y === 7 ? 2 : y === 0 ? 6 : y === 3 ? 2 : 4);
  }
  // 木板（右，斜靠）
  for (let i = 0; i < 9; i++) { put(L + 14 + Math.floor(i / 2), by - 2 - i, WOOD, 4); put(L + 15 + Math.floor(i / 2), by - 2 - i, WOOD, 2); }
  if (hp < 2) put(L + 11, by - 6, TIN, 0);
  void seed;
}
// 水晶：三根尖柱，中間最高；靠近時整個變亮（emissive）
function drawCrystal(put, cx, by, big, pal, glow, hp) {
  const S = big ? 1 : 0.7, cols = [[-4, 9, 2], [0, 15, 3], [4, 10, 2]];
  for (const [dx, h0, wd] of cols) {
    const h = Math.round(h0 * S);
    for (let r = 0; r < h; r++) {
      const w = Math.max(0, Math.round(wd * (1 - r / h) + (r < h - 2 ? 0.6 : 0)));
      for (let x = -w; x <= w; x++) {
        const t = x < 0 ? 5 : x === 0 ? 6 : 3;
        if (hp < 2 && dx === 0 && r === Math.round(h * 0.5) && x === 0) continue;   // 裂一條
        put(cx + dx + x, by - 1 - r, pal, t - 2, 0.3 + glow * 1.1);
      }
    }
  }
}
