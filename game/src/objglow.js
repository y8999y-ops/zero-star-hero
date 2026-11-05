// 重要物件的發光粒子（使用者 2026-11-05：重要的物件要有發光粒子特效）
// 照 pixelfx skill：參考 pickups/loot-beam（往上飄的光點、偶爾閃一下十字）、ice/ice-crystal（繞著轉、前後分層）、
//   fire/candle（慢慢漂的光點）、arcane/portal（光點被吸進中心）——只學做法。草稿：game/tools/drafts/objglow.mjs
// drawObjGlow(frame, kind, x, y, t, color?)：(x, y)＝物件底部中心（世界座標），t＝秒；已經拿過的東西不要呼叫。
//   ember 金色火星往上竄　fossil 形態色光點繞著轉　stele 淡金色小方塊（字光）慢慢升起
//   altarOff 灰藍微光、稀疏　altarOn 金色、多一點　chest 寶箱周圍一閃一閃的星光
//   portal 紫色旋臂（第 3 輪放進草稿跟真的傳送門比：傳送門本身已經有很多光點，再加只會亂 → 遊戲裡不用，留著備用）
const TAU = Math.PI * 2;
const hash = (i, k) => { let h = (i * 374761393 + k * 668265263) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const hexC = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const pack = ([r, g, b]) => (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
/** 一個顏色 → [暗, 本色, 亮, 白] */
function ramp(hex) { const c = hexC(hex); return [mix([16, 12, 28], c, 0.55), c, mix(c, [255, 255, 255], 0.55), [255, 255, 255]]; }
const CACHE = new Map();
const R = (hex) => { if (!CACHE.has(hex)) { const r = ramp(hex); CACHE.set(hex, { c: r.map(pack), rgb: r }); } return CACHE.get(hex); };
const COL = { ember: "#ffb030", altarOff: "#7a94c8", altarOn: "#ffd060", portal: "#c684ff", chest: "#ffe27a", stele: "#ffe8a0", fossil: "#b878ff" };

/** 粒子循環：n 顆，每顆有自己的壽命和起始相位，回呼 (age, life, i) */
function each(t, n, seed, lo, hi, fn) {
  for (let i = 0; i < n; i++) {
    const life = lo + hash(i, seed) * (hi - lo), off = hash(i, seed + 1) * life;
    const loop = Math.floor((t + off) / life);   // 每一輪換一組隨機值，不會每次都一樣
    fn((t + off) % life, life, i, (k) => hash(i * 131 + loop, seed + 7 + k));
  }
}

export function drawObjGlow(frame, kind, x, y, t, color) {
  const W = frame.w, H = frame.h, Cb = frame.color, L = frame.light, ox = frame.ox | 0, oy = frame.oy | 0;
  if (x - ox < -60 || x - ox > W + 60) return;
  const P = R(color ?? COL[kind]), C = P.c, rgb = P.rgb;
  const put = (px, py, c) => { px = Math.round(px) - ox; py = Math.round(py) - oy; if (px >= 0 && py >= 0 && px < W && py < H) Cb[py * W + px] = c; };
  const glow = (px, py, r, a) => {
    const cx = Math.round(px) - ox, cy = Math.round(py) - oy, [cr, cg, cbb] = rgb[1];
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const X = cx + dx, Y = cy + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      const f = 1 - Math.hypot(dx, dy) / (r + 0.5); if (f <= 0) continue;
      const i = Y * W + X, d = L[i], k = f * f * a;
      L[i] = (0xff000000 | (Math.min(255, ((d >>> 16) & 255) + cbb * k) << 16) | (Math.min(255, ((d >>> 8) & 255) + cg * k) << 8) | Math.min(255, (d & 255) + cr * k)) >>> 0;
    }
  };
  const glint = (px, py, s, a) => { put(px, py, C[3]); for (let k = 1; k <= s; k++) { const c = k === s ? C[1] : C[2]; put(px + k, py, c); put(px - k, py, c); put(px, py + k, c); put(px, py - k, c); } glow(px, py, 3, 0.5 * a); };
  // 第 2 輪：每樣東西身後都有一團會呼吸的柔光（只加在光層），才像「在發光」，不是只有幾顆點
  const AURA = { ember: [12, 16, 0.5], fossil: [8, 14, 0.45], stele: [18, 18, 0.3], altarOff: [16, 14, 0.18], altarOn: [18, 22, 0.4], portal: [34, 22, 0.3], chest: [8, 18, 0.3] }[kind];
  if (AURA) glow(x, y - AURA[0], AURA[1], AURA[2] * (0.8 + 0.2 * Math.sin(t * 2.4)));
  const fade = (age, life, inn = 0.25, out = 0.4) => Math.max(0, Math.min(1, age / inn, (life - age) / out));

  if (kind === "ember") {
    // 火星：從殘火往上竄，左右擺，越上面越暗；三格的小尾巴（白 → 亮 → 本色）
    each(t, 9, 11, 0.7, 1.3, (age, life, i, r) => {
      const k = fade(age, life, 0.1, 0.35), x0 = x + (r(0) - 0.5) * 10, vy = 22 + r(1) * 26;
      const px = x0 + Math.sin(age * (4 + r(2) * 4) + r(3) * TAU) * 2, py = y - 12 - vy * age;
      if (k < 0.2) return;
      if (r(4) < 0.18) { glint(px, py, 1, k); return; }
      put(px, py, k > 0.7 ? C[3] : C[2]); if (k > 0.45) put(px, py + 1, C[1]); if (k > 0.7) put(px, py + 2, C[0]);
      glow(px, py, 3, 0.45 * k);
    });
  } else if (kind === "fossil") {
    // 繞著化石核轉的光點：後面那半圈暗、前面那半圈亮（有前後感），慢慢往上
    each(t, 10, 23, 1.6, 2.6, (age, life, i, r) => {   // 第 2 輪：7 → 10 顆、圈大一點、前面的都帶十字亮點
      const th = r(0) * TAU + age * (1.8 + r(1)), Rr = 11 + r(2) * 7, s = Math.sin(th), k = fade(age, life, 0.3, 0.5);
      const px = x + Math.cos(th) * Rr, py = y - 8 + s * Rr * 0.3 - age * 4 + (r(3) - 0.5) * 6;
      if (s < 0) { put(px, py, C[0]); return; }
      put(px, py, i % 2 === 0 ? C[3] : C[2]);
      if (i % 2 === 0 && k > 0.5) { put(px + 1, py, C[1]); put(px - 1, py, C[1]); put(px, py - 1, C[1]); put(px, py + 1, C[1]); }
      glow(px, py, 3, 0.4 * k);
    });
  } else if (kind === "stele") {
    // 字光：碑面上浮起淡金色的小方塊（像字一筆一筆飄起來），慢慢升、輕輕閃
    each(t, 8, 37, 2.2, 3.4, (age, life, i, r) => {   // 第 2 輪：多兩顆、飄得比較高（飄出碑頂才看得出是「字浮起來」）
      const k = fade(age, life, 0.6, 0.9), px = x + (r(0) - 0.5) * 16, py = y - 12 - r(1) * 18 - age * 11;
      if (k < 0.15) return;
      const tw = 0.6 + 0.4 * Math.sin(age * 5 + r(2) * TAU), c = k * tw > 0.6 ? C[2] : C[1];
      if (r(3) < 0.5) { put(px, py, c); put(px + 1, py, c); } else { put(px, py, c); put(px, py + 1, c); }
      glow(px, py, 3, 0.45 * k * tw);
    });
  } else if (kind === "altarOff" || kind === "altarOn") {
    // 祭壇：沒點亮時零星的灰藍光點慢慢漂；點亮後金色光點從底座往上流，偶爾一顆閃十字
    const on = kind === "altarOn", n = on ? 9 : 6;   // 第 2 輪：沒亮的 4 → 6 顆
    each(t, n, on ? 41 : 43, on ? 1.4 : 2.4, on ? 2.2 : 3.6, (age, life, i, r) => {
      const k = fade(age, life, 0.3, 0.6), side = r(0) < 0.5 ? -1 : 1, x0 = x + side * (3 + r(1) * 9);
      const px = x0 + Math.sin(age * 2 + r(2) * TAU) * 1.5, py = y - 6 - age * (on ? 16 : 7) - r(3) * 6;
      if (k < 0.15) return;
      if (on && r(4) < 0.15) { glint(px, py, 1, k); return; }
      put(px, py, on ? (k > 0.6 ? C[3] : C[2]) : C[2]); if (on && k > 0.5) put(px, py + 1, C[1]);
      glow(px, py, on ? 4 : 3, (on ? 0.4 : 0.35) * k);
    });
  } else if (kind === "portal") {
    // 傳送門（第 2 輪：原本一片散點看不出形狀）→ 兩條旋臂：光點沿著兩條螺旋線被吸進中心，帶 3 格尾巴，越近越亮
    // 第 3 輪：對齊遊戲裡的傳送門（arcane/portal：直立的橢圓，中心在地上 34 格、半寬 17、半高 29）——直的橢圓旋臂
    const cx = x, cy = y - 34;
    each(t, 14, 53, 1.0, 1.4, (age, life, i, r) => {
      const e = age / life, arm = i % 2, rr = 22 * (1 - e) + 2, a = arm * Math.PI + e * 4.2 + (r(1) - 0.5) * 0.5;
      const k = Math.min(1, e * 5) * (e > 0.92 ? (1 - e) / 0.08 : 1);
      const at = (q) => { const aa = a - q * 0.18, r2 = rr + q * 2.2; return [cx + Math.cos(aa) * r2 * 0.75, cy + Math.sin(aa) * r2 * 1.3]; };
      const [px, py] = at(0);
      put(px, py, e > 0.5 ? C[3] : C[2]);
      for (let q = 1; q <= 3; q++) { const [tx, ty] = at(q); put(tx, ty, q === 1 ? C[2] : q === 2 ? C[1] : C[0]); }
      glow(px, py, 3, 0.45 * k);
    });
    if ((t * 1.3) % 1 < 0.1) glint(cx, cy, 2, 1);
  } else if (kind === "chest") {
    // 寶箱：箱子周圍一閃一閃的星光（閃一下就消失），加幾顆慢慢往上的光點
    each(t, 5, 61, 0.9, 1.8, (age, life, i, r) => {
      const e = age / life; if (e > 0.35) return;
      const s = Math.sin((e / 0.35) * Math.PI), px = x + (r(0) - 0.5) * 30, py = y - 4 - r(1) * 22;
      glint(px, py, s > 0.7 ? 2 : 1, s);
    });
    each(t, 4, 67, 1.8, 2.8, (age, life, i, r) => {
      const k = fade(age, life, 0.4, 0.6), px = x + (r(0) - 0.5) * 22, py = y - 8 - age * 8;
      if (k > 0.2) { put(px, py, C[2]); glow(px, py, 3, 0.3 * k); }
    });
  }
}
