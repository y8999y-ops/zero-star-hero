// 戰鬥小特效（自製，取代原本太誇張的 PixelFX 命中火花、CRIT 爆字、跳躍 poof）：
//   命中：輕擊＝小小的十字閃光＋幾顆火花；重擊（最後一段、擊飛、爆擊、技能）＝白色菱形閃一下、八角星芒、擴散的環、拖尾火花
//   跳躍／二段跳／落地：腳邊的小灰塵團往兩邊散，二段跳是腳下一圈星屑
//   傷害跳字：同一隻怪短時間內的傷害合併成一個數字（每加一次跳一下），畫在最上層、不會被前景或別的東西擋住
// 參考：輕重攻擊的火花大小、數量、停頓要拉開差距（輕擊克制，重擊才有份量）；跳字要有深色外框、彼此不重疊。
import { hex } from "../../pixelfx/src/core/index.js";

const C = (s) => hex(s) >>> 0;
const OUT = C("#120c1a");
// 形態的火花顏色（亮 → 暗）
const SPARK = {
  star: ["#ffffff", "#fff6cf", "#ffe27a", "#f0b42e", "#b8701a"],
  slime: ["#f0fff0", "#d4ffb0", "#8ee86a", "#4cc04a", "#2a8a3a"],
  can: ["#ffffff", "#fff3a6", "#ffc23d", "#ff8a2a", "#c44a1a"],
};
const SPARK_C = Object.fromEntries(Object.entries(SPARK).map(([k, v]) => [k, v.map(C)]));
const DUST = ["#d0c8dc", "#a49cb4", "#7a7290", "#4e486a"].map(C);
const NUM = { normal: [C("#fff8e8"), C("#c8b8a0")], heavy: [C("#ffe27a"), C("#d08a1c")], crit: [C("#ffb060"), C("#e0401c")] };

export const fxState = { form: "star" };
const flashes = [], parts = [], puffs = [], nums = [];

/** 命中特效。dir：攻擊方向（1 往右）。heavy：重擊。 */
export function hitFx(x, y, dir, heavy) {
  const pal = SPARK_C[fxState.form] ?? SPARK_C.star;
  flashes.push({ x: Math.round(x), y: Math.round(y), t: 0, heavy, pal, dir });
  const n = heavy ? 7 : 3;
  for (let i = 0; i < n; i++) {
    const a = (Math.random() - 0.5) * (heavy ? 2.2 : 1.6) + (dir < 0 ? Math.PI : 0), sp = (heavy ? 140 : 90) + Math.random() * (heavy ? 120 : 60);
    parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, life: (heavy ? 0.28 : 0.18) * (0.7 + Math.random() * 0.6), col: pal[1 + (i % 3)], trail: heavy, g: 300 });
  }
}

/** 灰塵：kind＝"jump"（起跳）、"double"（二段跳）、"land"（落地，hard＝重落地） */
export function dustFx(kind, x, y, hard = false, dir = 1) {
  x = Math.round(x); y = Math.round(y);
  // 特效補強 6：腳步（很小的一團、往後飄）、急轉身（往原本跑的方向揚起兩三團）
  if (kind === "step") { puffs.push({ x, y, vx: 0, r0: 0.5, r1: 1.5, t: 0, life: 0.2 }); return; }
  if (kind === "skid") { for (let i = 0; i < 3; i++) puffs.push({ x: x + dir * (3 + i * 3), y, vx: dir * (40 - i * 10), r0: 1, r1: 2.5 - i * 0.4, t: 0, life: 0.3 + i * 0.05 }); return; }
  if (kind === "double") {
    // 腳下一圈星屑往外擴散（星星主角的二段跳）
    const pal = SPARK_C[fxState.form] ?? SPARK_C.star;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      parts.push({ x, y: y + 1, vx: Math.cos(a) * 46, vy: Math.sin(a) * 18 + 8, life: 0.26, col: pal[i % 2 ? 2 : 1], trail: false, g: 0 });
    }
    puffs.push({ x, y: y + 1, vx: 0, r0: 2, r1: 4, t: 0, life: 0.18 });
    return;
  }
  const n = kind === "land" ? (hard ? 3 : 2) : 1, sp = kind === "land" ? (hard ? 46 : 30) : 22;
  for (const s of [-1, 1]) for (let i = 0; i < n; i++) {
    puffs.push({ x: x + s * (2 + i * 2), y, vx: s * sp * (1 - i * 0.25), r0: 1, r1: (kind === "land" && hard ? 3 : 2) + (i === 0 ? 0 : -0.5), t: 0, life: 0.28 + i * 0.06 });
  }
}

/** 傷害跳字：同一隻（target）0.5 秒內再被打，就加到同一個數字上 */
export function damageFx(target, x, y, d, { crit = false, heavy = false } = {}) {
  const old = nums.find((q) => q.target === target && q.since < 0.5 && !q.fading);
  if (old) {
    old.total += d; old.since = 0; old.bump = 0.1; old.crit ||= crit; old.heavy ||= heavy; old.hits++;
    return;
  }
  nums.push({ target, x, y, total: d, since: 0, age: 0, bump: 0.1, crit, heavy, hits: 1, rise: 0, fading: false });
}

export function updateCombatFx(dt) {
  for (let i = flashes.length - 1; i >= 0; i--) if ((flashes[i].t += dt) > (flashes[i].heavy ? 0.2 : 0.12)) flashes.splice(i, 1);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    if ((p.life -= dt) <= 0) { parts.splice(i, 1); continue; }
    p.px = p.x; p.py = p.y;
    p.vx *= 1 - 5 * dt; p.vy = p.vy * (1 - 5 * dt) + p.g * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
  }
  for (let i = puffs.length - 1; i >= 0; i--) {
    const p = puffs[i];
    if ((p.t += dt) >= p.life) { puffs.splice(i, 1); continue; }
    p.x += p.vx * dt; p.vx *= 1 - 6 * dt;
  }
  for (let i = nums.length - 1; i >= 0; i--) {
    const q = nums[i];
    q.since += dt; q.age += dt; q.bump -= dt;
    // 怪還活著就跟著怪走；最後一下之後 0.5 秒開始往上飄、0.45 秒後消失
    if (q.target && !q.target.dead && q.since < 0.5) { const b = q.target.box(); q.x += (q.target.x - q.x) * Math.min(1, dt * 12); q.y = b.y0 - 3; }
    if (q.since > 0.5) { q.fading = true; q.rise += 26 * dt; }
    if (q.since > 0.95) nums.splice(i, 1);
  }
}

// ---- 畫
function plot(frame, x, y, c) {
  const sx = x - (frame.ox | 0), sy = y - (frame.oy | 0);
  if (sx < 0 || sy < 0 || sx >= frame.w || sy >= frame.h) return;
  frame.color[sy * frame.w + sx] = c;
}
/** 命中閃光、火花、灰塵（畫在角色和特效上面） */
export function drawCombatFx(frame) {
  for (const p of puffs) {
    const k = p.t / p.life, r = p.r0 + (p.r1 - p.r0) * Math.min(1, k * 1.6), shade = DUST[Math.min(3, Math.floor(k * 4))];
    const cx = Math.round(p.x), cy = Math.round(p.y - r * 0.6 - k * 2);
    for (let y = -Math.ceil(r); y <= Math.ceil(r); y++) for (let x = -Math.ceil(r); x <= Math.ceil(r); x++) {
      if (x * x + y * y > r * r + 0.3) continue;
      if (k > 0.6 && (x + y + Math.floor(p.t * 30)) % 2) continue;   // 快消失時變稀
      plot(frame, cx + x, cy + y, y < 0 && x < 0 ? DUST[Math.max(0, Math.floor(k * 4) - 1)] : shade);
    }
  }
  for (const f of flashes) {
    const { x, y, pal } = f, step = Math.floor(f.t * 60 / (f.heavy ? 3 : 2));   // 每 2～3 格換一張
    if (!f.heavy) {
      // 輕擊：十字閃光 3 張（小 → 大 → 只剩尖端）
      const R = [2, 4, 4][step] ?? 0, core = step < 2;
      for (let i = -R; i <= R; i++) {
        const c = Math.abs(i) <= 1 && core ? pal[0] : pal[Math.abs(i) > R - 2 ? 3 : 1];
        if (step === 2 && Math.abs(i) < 3) continue;
        plot(frame, x + i, y, c); plot(frame, x, y + i, c);
      }
      if (step === 1) for (const [a, b] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) plot(frame, x + a, y + b, pal[2]);
    } else {
      // 重擊：白色菱形 → 八角星芒＋環 → 斷開的環
      if (step === 0) {
        for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) if (Math.abs(i) + Math.abs(j) <= 4) plot(frame, x + i, y + j, Math.abs(i) + Math.abs(j) <= 2 ? pal[0] : pal[1]);
      } else if (step <= 2) {
        const R = step === 1 ? 7 : 9;
        for (let i = -R; i <= R; i++) { const c = pal[Math.abs(i) < 3 ? 0 : Math.abs(i) > R - 3 ? 3 : 1]; plot(frame, x + i, y, c); plot(frame, x, y + i, c); }
        const D = Math.round(R * 0.6);
        for (let i = -D; i <= D; i++) { const c = pal[Math.abs(i) > D - 2 ? 3 : 2]; plot(frame, x + i, y + i, c); plot(frame, x + i, y - i, c); }
        const rr = step === 1 ? 6 : 8;
        for (let a = 0; a < 32; a++) { if (step === 2 && a % 3 === 0) continue; plot(frame, x + Math.round(Math.cos(a / 32 * Math.PI * 2) * rr), y + Math.round(Math.sin(a / 32 * Math.PI * 2) * rr * 0.8), pal[step === 1 ? 2 : 3]); }
      } else {
        for (let a = 0; a < 12; a++) if (a % 2 === 0) plot(frame, x + Math.round(Math.cos(a / 12 * Math.PI * 2) * 11), y + Math.round(Math.sin(a / 12 * Math.PI * 2) * 9), pal[3]);
      }
    }
  }
  for (const p of parts) {
    const x = Math.round(p.x), y = Math.round(p.y);
    if (p.trail && p.px !== undefined) plot(frame, Math.round((p.x + p.px) / 2), Math.round((p.y + p.py) / 2), p.col);
    plot(frame, x, y, p.life < 0.06 ? DUST[1] : p.col);
  }
}

// 像素數字 3×5（0～9、!）
const GLYPH = {
  0: ["111", "101", "101", "101", "111"], 1: ["010", "110", "010", "010", "111"], 2: ["111", "001", "111", "100", "111"],
  3: ["111", "001", "011", "001", "111"], 4: ["101", "101", "111", "001", "001"], 5: ["111", "100", "111", "001", "111"],
  6: ["111", "100", "111", "101", "111"], 7: ["111", "001", "001", "010", "010"], 8: ["111", "101", "111", "101", "111"],
  9: ["111", "101", "111", "001", "111"], "!": ["1", "1", "1", "0", "1"],
};
/** 傷害數字：最後畫（在前景之上），不會超出畫面，彼此不重疊 */
export function drawDamageNumbers(frame) {
  const W = frame.w, H = frame.h, ox = frame.ox | 0, oy = frame.oy | 0;
  const placed = [];
  const list = nums.slice().sort((a, b) => a.age - b.age);   // 新的先放（在下面），舊的被往上推
  for (const q of list) {
    const text = String(q.total) + (q.crit ? "!" : "");
    const big = q.crit || q.heavy || q.hits >= 3;
    const s = big ? 2 : 1, gap = 1;
    const wpx = [...text].reduce((n, ch) => n + GLYPH[ch][0].length * s + gap, -gap), hpx = 5 * s;
    // 跳一下：剛加上去的那 0.1 秒往上 2 格
    let x = Math.round(q.x - ox - wpx / 2), y = Math.round(q.y - oy - hpx - q.rise - (q.bump > 0 ? 2 : 0));
    x = Math.max(2, Math.min(W - wpx - 2, x));
    y = Math.max(2, Math.min(H - hpx - 2, y));
    for (const p of placed) if (x < p.x + p.w + 2 && x + wpx + 2 > p.x && y < p.y + p.h + 2 && y + hpx + 2 > p.y) y = p.y - hpx - 3;
    y = Math.max(2, y);
    placed.push({ x, y, w: wpx, h: hpx });
    const [fill, low] = q.crit ? NUM.crit : q.heavy || q.hits >= 3 ? NUM.heavy : NUM.normal;
    // 先畫外框（四周＋右下多一格當陰影），再畫字；字的下半部用較深的顏色
    const pixels = [];
    let cx = x;
    for (const ch of text) {
      const g = GLYPH[ch];
      g.forEach((row, j) => [...row].forEach((v, i) => { if (v === "1") for (let a = 0; a < s; a++) for (let b = 0; b < s; b++) pixels.push([cx + i * s + a, y + j * s + b, j >= 3]); }));
      cx += g[0].length * s + gap;
    }
    const Cb = frame.color, put = (px, py, c) => { if (px >= 0 && py >= 0 && px < W && py < H) Cb[py * W + px] = c; };
    if (q.since > 0.8 && Math.floor(q.since * 30) % 2) continue;   // 消失前閃兩下
    for (const [px, py] of pixels) for (const [a, b] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) put(px + a, py + b, OUT);
    for (const [px, py, lowRow] of pixels) put(px, py, lowRow ? low : fill);
  }
}
