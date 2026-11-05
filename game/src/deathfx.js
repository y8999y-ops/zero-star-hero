// 主角死亡與重生的演出（特效補強 1，照 pixelfx skill：畫 → 看 → 修三輪，草稿 game/tools/drafts/deathfx.mjs）
//   碎掉（shatter）：一格白色亮框 → 星星碎成十幾片碎片往外噴、受重力翻滾、閃一閃消失；一圈光環往外擴。
//   重生（regather）：碎片從四周繞著飛回祭壇的那一點 → 一道光柱打下來 → 地上一圈光點散開，主角在光裡出現。
// 參考（只學做法）：pixelfx spawn/shatter-death（碎片翻滾、落地閃光）、spawn/respawn-beam（光柱打下來、地面光環）、
//   《Celeste》死亡時一圈光點散開、重生時收回的節奏。顏色跟著目前的形態。
const TAU = Math.PI * 2;
const hexC = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const pack = ([r, g, b]) => (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
const mixRGB = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
/** 形態顏色 → 5 階（暗 → 白） */
export function rampOf(hex) {
  const c = hexC(hex), dark = [20, 14, 32];
  return [mixRGB(dark, c, 0.35), mixRGB(dark, c, 0.7), c, mixRGB(c, [255, 255, 255], 0.5), [255, 255, 255]].map(pack);
}
// 碎片的形狀（相對中心的點，值＝明暗：3 亮面、2 本色、1 暗邊），翻滾時輪流換——第 2 輪：原本 1～3px 太小看不到，改成 3～5px 帶亮面
const SHAPES = [
  [[0, -1, 3], [-1, 0, 3], [0, 0, 2], [1, 0, 2], [0, 1, 1]],                          // 菱形
  [[0, -2, 3], [0, -1, 3], [-1, 0, 3], [0, 0, 2], [1, 0, 2], [0, 1, 2], [0, 2, 1]],   // 尖的星角
  [[-1, -1, 3], [0, -1, 3], [-1, 0, 2], [0, 0, 2], [1, 0, 1], [0, 1, 1]],             // 三角片
  [[0, -1, 3], [1, -1, 3], [-1, 0, 2], [0, 0, 2], [1, 0, 2], [-1, 1, 1], [0, 1, 1]],  // 斜的平行四邊
];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const dither = (x, y, a) => a * 16 > BAYER[((y & 3) << 2) | (x & 3)];

export function createDeathFx() {
  const items = [];
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  function shatter(x, y, color) {
    const R = rampOf(color), shards = [];
    for (let i = 0; i < 11; i++) {
      const a = -Math.PI / 2 + ((i + rnd() * 0.6) / 11 - 0.5) * Math.PI * 1.6, sp = 55 + rnd() * 75;
      shards.push({ x: x + Math.cos(a) * 4, y: y - 12 + Math.sin(a) * 4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 70, s: Math.floor(rnd() * 4), spin: 5 + rnd() * 7, life: 0.6 + rnd() * 0.35, floor: y, bounced: 0 });
    }
    items.push({ k: "shatter", x, y: y - 12, t: 0, R, shards, dur: 1 });
  }
  function regather(x, y, color) {
    const R = rampOf(color), motes = [];
    for (let i = 0; i < 12; i++) motes.push({ a: (i / 12) * TAU + rnd() * 0.3, r: 34 + rnd() * 14, d: rnd() * 0.12 });
    items.push({ k: "regather", x, y, t: 0, R, motes, dur: 1.15 });
  }
  function update(dt) {
    for (const it of items) {
      it.t += dt;
      if (it.k === "shatter") for (const s of it.shards) {
        s.vy += 430 * dt; s.vx *= 1 - 1.1 * dt; s.x += s.vx * dt; s.y += s.vy * dt;
        if (s.y > s.floor - 1 && s.vy > 0) { s.y = s.floor - 1; s.vy *= -0.35; s.vx *= 0.6; s.spin *= 0.5; s.bounced++; }   // 落地彈一下
      }
    }
    for (let i = items.length - 1; i >= 0; i--) if (items[i].t >= items[i].dur) items.splice(i, 1);
  }
  function draw(frame) {
    const W = frame.w, H = frame.h, C = frame.color, L = frame.light, ox = frame.ox | 0, oy = frame.oy | 0;
    const put = (x, y, c) => { x = Math.round(x) - ox; y = Math.round(y) - oy; if (x >= 0 && y >= 0 && x < W && y < H) C[y * W + x] = c; };
    const glow = (x, y, v) => { x = Math.round(x) - ox; y = Math.round(y) - oy; if (x < 0 || y < 0 || x >= W || y >= H) return; const i = y * W + x, d = L[i], add = (s) => Math.min(255, ((d >>> s) & 255) + v); L[i] = (0xff000000 | (add(16) << 16) | (add(8) << 8) | add(0)) >>> 0; };
    for (const it of items) {
      const { t, R } = it;
      if (it.k === "shatter") {
        // 第 1～2 格：白色星形亮框＋四道短光芒（hero frame）
        if (t < 0.09) {
          const rr = t < 0.045 ? 9 : 12;
          for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) { const d = Math.abs(dx) + Math.abs(dy); if (d <= rr * 0.75 || (dx === 0 || dy === 0) && Math.abs(dx + dy) <= rr) { put(it.x + dx, it.y + dy, d > rr * 0.55 ? R[3] : R[4]); glow(it.x + dx, it.y + dy, 70); } }
        }
        // 第 3 輪：光環像泡泡的外框 → 改成八道往外射的短光芒（前段白、後段形態色，0.03～0.25 秒）
        if (t > 0.03 && t < 0.25) {
          const k = (t - 0.03) / 0.22, r0 = 5 + 20 * k, len = Math.round(8 * (1 - k)) + 2;
          for (let q = 0; q < 8; q++) { const a = (q / 8) * TAU + 0.2, ca = Math.cos(a), sa = Math.sin(a) * 0.8; for (let d = 0; d < len; d++) { const px = it.x + ca * (r0 + d), py = it.y + sa * (r0 + d); put(px, py, d < len / 2 ? R[4] : R[3]); glow(px, py, 50); } }
        }
        // 碎片
        for (const s of it.shards) {
          if (t > s.life) continue;
          const k = t / s.life, shape = SHAPES[(s.s + Math.floor(t * s.spin)) % SHAPES.length], white = k < 0.12;
          if (k > 0.7 && Math.floor(t * 24 + s.s) % 3 === 0) continue;   // 最後一段閃爍消失
          for (const [dx, dy, v] of shape) put(s.x + dx, s.y + dy, white ? R[4] : R[v]);
          glow(s.x, s.y, 55 * (1 - k));
          if ((Math.floor(t * 16) + s.s) % 9 === 0) { put(s.x - 2, s.y, R[4]); put(s.x + 2, s.y, R[4]); put(s.x, s.y - 2, R[4]); }   // 偶爾閃一下（十字光）
        }
      } else {
        // 光點繞著飛回中心（0～0.5 秒，越近越快）；第 2 輪：2×2 亮點＋三格尾巴
        const cx = it.x, cy = it.y - 12;
        for (const m of it.motes) {
          const k = Math.max(0, Math.min(1, (t - m.d) / 0.48));
          if (k >= 1) continue;
          const e = k * k, r = m.r * (1 - e), a = m.a + e * 2.4;
          const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r * 0.85;
          for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) put(px + dx, py + dy, dx + dy === 0 ? R[4] : R[3]);
          glow(px, py, 80);
          for (let q = 1; q <= 3; q++) { const pa = a - q * 0.12, pr = r + q * 2; put(cx + Math.cos(pa) * pr, cy + Math.sin(pa) * pr * 0.85, q === 1 ? R[3] : R[2]); }
        }
        if (t > 0.5 && t < 0.58) for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if (Math.abs(dx) + Math.abs(dy) <= 4) { put(cx + dx, cy + dy, R[4]); glow(cx + dx, cy + dy, 90); }   // 聚成一點的閃光
        // 光柱：0.42～0.5 先垂下一條細線（預告），0.5 砰地變寬，之後慢慢變細消失
        if (t > 0.42 && t < 1.05) {
          const pre = t < 0.5, k = pre ? 0 : (t - 0.5) / 0.55, half = pre ? 0 : Math.max(0, Math.round(6 * (1 - k) ** 1.5));
          const bottom = it.y, top = pre ? Math.round(bottom - (bottom - oy) * ((t - 0.42) / 0.08)) : oy;
          for (let y = top; y <= bottom; y++) for (let dx = -half - 2; dx <= half + 2; dx++) {
            const ad = Math.abs(dx);
            if (pre) { if (dx === 0) { put(it.x, y, R[3]); glow(it.x, y, 40); } continue; }
            let c, g;
            const band = ((y + Math.floor(t * 90)) & 7) < 2;   // 第 3 輪：往上捲動的掃描帶（光柱裡一條條亮暗）
            if (ad <= Math.max(0, half - 3)) { c = band ? R[3] : R[4]; g = 100; }
            else if (ad <= half - 1) { c = R[3]; g = 60; }
            else if (ad <= half) { c = R[2]; g = 40; }
            else { if (!dither(it.x + dx, y, 0.45 * (1 - k))) continue; c = R[2]; g = 25; }
            put(it.x + dx, y, c); glow(it.x + dx, y, g);
          }
          // 打到地面：一條亮線往兩邊散開＋光點彈起來
          if (!pre) {
            const spread = 6 + k * 30;
            for (let dx = -spread; dx <= spread; dx++) if (dither(Math.round(it.x + dx), bottom, (1 - k) * (1 - Math.abs(dx) / (spread + 1)))) { put(it.x + dx, bottom - 1, R[3]); glow(it.x + dx, bottom - 1, 40); }
            for (const sgn of [-1, 1]) for (let j = 0; j < 3; j++) { const px = it.x + sgn * (8 + j * 7 + k * 18), py = bottom - 2 - Math.round(Math.sin(Math.min(1, k * 2 + j * 0.2) * Math.PI) * (6 + j * 3)); if (k < 0.8) { put(px, py, R[4]); glow(px, py, 50); } }
          }
        }
      }
    }
  }
  const busy = () => items.length > 0;
  return { shatter, regather, update, draw, busy, items };
}
