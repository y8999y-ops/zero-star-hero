// 大招「零星墜落」：起承轉合。
//   起（0～0.65 秒）：全場停住變暗，腳下展開金色法陣，四周的光點被吸進主角手中，聚成一顆星核。
//   承（0.65～1.28 秒）：主角跳上半空、劍指天，星核長大；畫面下方橫過一條特寫帶（主角的臉＋招式名）。
//   轉（1.28～1.46 秒）：星核往上射出畫面，一顆巨大的星星從天上斜斜砸下；落地瞬間黑白反轉兩拍（衝擊定格）、全場大亮、震動。
//   合（1.46～2.7 秒）：衝擊波沿著地面往兩邊掃開（掃到的怪都被打飛），星屑落下，光慢慢退回去，主角落地收招。
// 現成素材（PixelFX）：arcane/rune-circle（法陣）、holy/sunburst（星核的放射光）、impacts/ground-slam（落地衝擊）、
// arcane/star-fall（星屑）。自己做的：集光粒子、星核與墜落的星星、特寫帶、黑白衝擊定格、地面衝擊波、暗場。
import { createFrame, hex, PAL } from "../../pixelfx/src/core/index.js";
import * as runeCircle from "../../pixelfx/src/fx/arcane/rune-circle.js";
import * as sunburst from "../../pixelfx/src/fx/holy/sunburst.js";
import * as groundSlam from "../../pixelfx/src/fx/impacts/ground-slam.js";
import * as starFall from "../../pixelfx/src/fx/arcane/star-fall.js";
import { spawn, hitStop, shake } from "./fx.js";
import { flash, global as globalLight } from "./light.js";
import { paintStar, POSES } from "./star.js";
import { FLOOR, LEVEL_W, WALL } from "./level.js";

export const ULT_MAX = 100;
export const ULT_MULT = 9;   // 傷害倍率（× 攻擊力，再乘技能傷害加成）
const T = { rise: 0.65, top: 1.0, cut0: 0.7, cut1: 1.15, throw: 1.15, drop: 1.28, hit: 1.46, land: 1.64, end: 2.7 };

// 主角的大招姿勢（star.js）
const CHARGE = POSES.charge, RISE = POSES.rise, THROW = POSES.throw, FINISH = POSES.finish;
const PORTRAIT = { eyes: "squint", look: 1, core: 2 };   // 特寫用：眼神認真

export const ult = { on: false, t: 0, charge: 0, hitSet: new Set(), post: 0 };

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const outCubic = (p) => 1 - (1 - p) ** 3;
const inQuad = (p) => p * p;
const rgb = (s) => { const v = parseInt(s.slice(1), 16); return [v >> 16, (v >> 8) & 255, v & 255]; };
const GOLD = ["#f0a020", "#ffd84a", "#fff09a", "#ffffff"].map(rgb);
const LIGHT_GOLD = rgb("#ffcf6a");

// 集光粒子：開始時排好（固定的亂數，不用 Math.random，每次看起來一樣）
const rnd = (i, k) => { const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return s - Math.floor(s); };
const MOTES = Array.from({ length: 56 }, (_, i) => ({
  a: rnd(i, 1) * Math.PI * 2, r0: 46 + rnd(i, 2) * 70, d: rnd(i, 3) * 0.5, dur: 0.22 + rnd(i, 4) * 0.2, spin: 1.2 + rnd(i, 5) * 1.6, big: rnd(i, 6) < 0.3,
}));
// 特寫帶裡的速度線
const LINES = Array.from({ length: 34 }, (_, i) => ({ y: rnd(i, 7), x: rnd(i, 8), len: 18 + rnd(i, 9) * 60, sp: 0.7 + rnd(i, 10) * 0.8, hot: rnd(i, 11) < 0.25 }));

export function startUlt(player, lock) {
  Object.assign(ult, { on: true, t: 0, charge: 0, post: 0, x0: player.x, y0: player.y, face: player.face, impacted: false, landed: false });
  ult.hitSet.clear();
  const l = lock ? lock.l + 24 : WALL + 24, r = lock ? lock.r - 24 : LEVEL_W - WALL - 24;
  ult.tx = Math.max(l, Math.min(r, player.x + player.face * 72));
  ult.circle = spawn(runeCircle, { x: Math.round(player.x), y: Math.round(player.y), palette: PAL.gold, light: 0.6, seed: 4 }, { layer: "back", speed: 1.4 });
  ult.burst = null;
  ult.core = { x: player.x, y: player.y - 22, r: 0, rot: 0 };
  ult.star = null;
  showName(true);
}

/** 每一步更新。hooks.wave(x0, x1, tx)：衝擊波目前掃到的範圍；hooks.dust(x, y)。 */
export function updateUlt(dt, player, hooks) {
  if (!ult.on) return;
  const t = (ult.t += dt), side = ult.face, c = ult.core;
  player.invuln = Math.max(player.invuln, 0.6);

  // ---- 主角的位置和姿勢
  let q = CHARGE, y = ult.y0;
  if (t >= T.rise && t < T.hit) {
    y = ult.y0 - 46 * outCubic(clamp01((t - T.rise) / (T.top - T.rise))) + (t > T.top ? Math.round(Math.sin((t - T.top) * 12)) : 0);
    q = t < T.throw ? RISE : THROW;
  } else if (t >= T.hit && t < T.land) {
    y = ult.y0 - 46 * (1 - inQuad(clamp01((t - T.hit) / (T.land - T.hit))));
    q = THROW;
  } else if (t >= T.land) {
    q = FINISH;
    if (!ult.landed) { ult.landed = true; hooks.dust(player.x, ult.y0); shake(0.15, 2); }
  }
  player.y = y;
  player.face = side;
  player.ultPose(q, dt);

  // ---- 星核：起的時候在胸前，承的時候在劍尖上方
  if (t < T.throw) {
    // 起：星核在肚子前面；承：兩手舉高，星核在頭頂上
    const tx = t < T.rise ? player.x + side * 2 : player.x, ty = t < T.rise ? y - 12 : y - 36;
    c.x += (tx - c.x) * Math.min(1, dt * 18);
    c.y += (ty - c.y) * Math.min(1, dt * 18);
    c.r = 2 + 9 * outCubic(clamp01((t - 0.15) / (T.throw - 0.15)));
    if (!ult.burst && t >= T.rise) ult.burst = spawn(sunburst, { x: Math.round(c.x), y: Math.round(c.y), rays: 10, light: 0.5, seed: 7 });
  } else if (t < T.drop) {
    // 往上射出畫面
    c.y -= 900 * dt * (0.4 + clamp01((t - T.throw) / (T.drop - T.throw)));
    c.r = 7;
  } else c.r = 0;
  c.rot += dt * (t < T.throw ? 2 + t * 4 : 10);
  if (ult.burst) {
    ult.burst.options.x = Math.round(c.x);
    ult.burst.options.y = Math.round(c.y);
    if (t >= T.throw && !ult.burst.stopped) { ult.burst.stop(); ult.burst.stopped = true; }
  }
  if (t >= T.rise && ult.circle && !ult.circle.stopped) { ult.circle.stop(); ult.circle.stopped = true; }

  // ---- 巨大的星星從天上斜斜砸下
  if (t >= T.drop && t < T.hit) {
    const p = clamp01((t - T.drop) / (T.hit - T.drop)) ** 1.6;
    const sx = ult.tx - side * 120, sy = -24;
    ult.star = { x: sx + (ult.tx - sx) * p, y: sy + (FLOOR - 8 - sy) * p, dx: ult.tx - sx, dy: FLOOR - 8 - sy };
  } else ult.star = null;

  // ---- 落地
  if (t >= T.hit && !ult.impacted) {
    ult.impacted = true;
    const tx = Math.round(ult.tx);
    spawn(groundSlam, { x: tx, y: FLOOR, reach: 150, light: 0.7, seed: 9 }, { layer: "back" });
    spawn(starFall, { x: tx, y: FLOOR, palette: PAL.holy, light: 0.6, seed: 21 }, { speed: 1.2 });
    spawn(starFall, { x: tx + side * 90, y: FLOOR, palette: PAL.gold, light: 0.5, seed: 5 }, { speed: 1.3 });
    flash(tx, FLOOR - 24, 260, 4, 1.1, "#ffe08a");
    hitStop(0.16);
    shake(0.7, 6);
    ult.post = 1;   // 黑白衝擊定格
    navigator.vibrate?.([30, 40, 60]);
  }
  // 衝擊波往兩邊掃
  if (t >= T.hit) {
    ult.wave = (t - T.hit) * 330;
    if (t < T.hit + 0.95) hooks.wave(ult.tx - ult.wave - 8, ult.tx + ult.wave + 8, ult.tx);
  }
  // 整個畫面亮起來再退去
  globalLight.lv = t >= T.hit ? 0.6 * (1 - clamp01((t - T.hit) / 0.6)) ** 2 : 0;

  if (t >= T.end) {
    ult.on = false;
    globalLight.lv = 0;
    player.y = ult.y0;
    player.endUlt();
    showName(false);
  }
}

/** 暗場的程度 0～1 */
function dimK() {
  const t = ult.t;
  if (!ult.on) return 0;
  if (t < 0.25) return t / 0.25;
  if (t < T.hit) return 1;
  return 1 - clamp01((t - T.hit) / 0.6);
}

/** 大招的光源（星核、墜落的星星、主角） */
export function ultLights(list) {
  if (!ult.on) return;
  const c = ult.core;
  if (c.r > 0) list.push({ x: c.x, y: c.y, r: 30 + c.r * 6, lv: 1.2 + c.r * 0.18, col: "#ffd27a" });
  if (ult.star) list.push({ x: ult.star.x, y: ult.star.y, r: 110, lv: 3.5, col: "#fff0b0" });
}

/** 暗場：畫完場景和怪之後、畫主角之前呼叫，只留主角和特效是亮的 */
export function dimScene(frame) {
  const d = dimK();
  if (d <= 0) return;
  const kc = 1 - 0.62 * d, kl = 1 - 0.75 * d, C = frame.color, L = frame.light, n = frame.w * frame.h;
  for (let i = 0; i < n; i++) {
    const c = C[i];
    C[i] = (c & 0xff000000) | ((((c >>> 16) & 255) * kc) << 16) | ((((c >>> 8) & 255) * kc) << 8) | ((c & 255) * kc);
    const l = L[i];
    if (l & 0xffffff) L[i] = (l & 0xff000000) | ((((l >>> 16) & 255) * kl) << 16) | ((((l >>> 8) & 255) * kl) << 8) | ((l & 255) * kl);
  }
}

// ---- 畫素的小工具（世界座標）
function painter(frame) {
  const W = frame.w, Hh = frame.h, C = frame.color, L = frame.light, ox = frame.ox | 0, oy = frame.oy | 0;
  const idx = (x, y) => { x = Math.round(x) - ox; y = Math.round(y) - oy; return x < 0 || y < 0 || x >= W || y >= Hh ? -1 : y * W + x; };
  return {
    blend(x, y, [r, g, b], a) {
      const i = idx(x, y);
      if (i < 0 || a <= 0) return;
      if (a >= 1) { C[i] = 0xff000000 | (b << 16) | (g << 8) | r; return; }
      const c = C[i], q = 1 - a;
      C[i] = 0xff000000 | ((((c >>> 16) & 255) * q + b * a) << 16) | ((((c >>> 8) & 255) * q + g * a) << 8) | ((c & 255) * q + r * a);
    },
    glow(x, y, [r, g, b], k) {
      const i = idx(x, y);
      if (i < 0 || k <= 0) return;
      const l = L[i];
      L[i] = 0xff000000 | (Math.min(255, ((l >>> 16) & 255) + b * k) << 16) | (Math.min(255, ((l >>> 8) & 255) + g * k) << 8) | Math.min(255, (l & 255) + r * k);
    },
  };
}

// 星星：四個長尖角＋四個短尖角（斜向），中心一顆亮核，外面一圈柔和的光
function drawStar(P, cx, cy, R, rot, glow = 1) {
  if (R <= 0) return;
  const ca = Math.cos(rot), sa = Math.sin(rot), ext = Math.ceil(R * 2.4), sR = Math.sqrt(R), sR2 = Math.sqrt(R * 0.55);
  for (let y = -ext; y <= ext; y++) for (let x = -ext; x <= ext; x++) {
    const u = Math.abs(x * ca + y * sa), v = Math.abs(-x * sa + y * ca);
    const u2 = Math.abs((u - v) * Math.SQRT1_2), v2 = Math.abs((u + v) * Math.SQRT1_2);
    const d = Math.hypot(x, y);
    let val = Math.max(1 - (Math.sqrt(u) + Math.sqrt(v)) / sR, 0.8 * (1 - (Math.sqrt(u2) + Math.sqrt(v2)) / sR2), 1 - d / (R * 0.32));
    if (val > 0) {
      const col = val > 0.55 ? GOLD[3] : val > 0.32 ? GOLD[2] : val > 0.14 ? GOLD[1] : GOLD[0];
      P.blend(cx + x, cy + y, col, Math.min(1, val * 5));
    }
    const h = 1 - d / ext;
    if (h > 0) P.glow(cx + x, cy + y, LIGHT_GOLD, h * h * 0.55 * glow);
  }
}

/** 主角之後畫：集光粒子、星核、墜落的星星和尾巴、地面衝擊波 */
export function drawUlt(frame) {
  if (!ult.on) return;
  const P = painter(frame), t = ult.t, c = ult.core;
  // 集光粒子：從四周轉著被吸進星核，越靠近越亮
  if (t < T.throw) for (const m of MOTES) {
    const p = (t - m.d) / m.dur;
    if (p < 0 || p >= 1) continue;
    const r = m.r0 * (1 - inQuad(p)), a = m.a + m.spin * p, dx = Math.cos(a), dy = Math.sin(a);
    const len = 3 + Math.round(7 * p), col = m.big ? GOLD[3] : GOLD[2];
    for (let k = 0; k < len; k++) {
      const x = c.x + dx * (r + k), y = c.y + dy * (r + k), fade = 1 - k / len;
      P.blend(x, y, k === 0 ? GOLD[3] : col, fade * (0.5 + 0.5 * p));
      P.glow(x, y, LIGHT_GOLD, fade * 0.35);
    }
  }
  // 星核往上射的時候，拖一條光
  if (t >= T.throw && t < T.drop) for (let k = 0; k < 30; k++) {
    const a = 1 - k / 30;
    P.blend(c.x, c.y + k * 2, k < 4 ? GOLD[3] : GOLD[2], a);
    P.glow(c.x, c.y + k * 2, LIGHT_GOLD, a * 0.8);
  }
  drawStar(P, c.x, c.y, c.r, c.rot, 1);

  // 墜落的星星：長長的尾巴（越後面越細越暗），前面一顆大星星
  if (ult.star) {
    const s = ult.star, len = Math.hypot(s.dx, s.dy), ux = s.dx / len, uy = s.dy / len;
    for (let k = 0; k < 90; k++) {
      const a = 1 - k / 90, w = Math.max(0, Math.round(11 * a)), bx = s.x - ux * k * 1.6, by = s.y - uy * k * 1.6;
      for (let j = -w; j <= w; j++) {
        const e = 1 - Math.abs(j) / (w + 1);
        P.blend(bx - uy * j, by + ux * j, e > 0.6 ? GOLD[3] : e > 0.3 ? GOLD[2] : GOLD[1], a * e * 1.4);
        P.glow(bx - uy * j, by + ux * j, LIGHT_GOLD, a * e * 0.7);
      }
    }
    drawStar(P, s.x, s.y, 22, c.rot * 1.5, 2);
  }

  // 地面衝擊波：兩道往外跑的光牆，越遠越矮越淡；地上一圈扁扁的光環
  if (t >= T.hit && t < T.hit + 1.1) {
    const w = ult.wave, fade = 1 - clamp01((t - T.hit) / 1.1);
    for (const dir of [-1, 1]) {
      const fx = ult.tx + dir * w, hgt = Math.round(46 * fade + 6);
      for (let k = 0; k < 10; k++) {
        const x = fx - dir * k, a = (1 - k / 10) * fade;
        for (let yy = 0; yy < hgt; yy++) {
          const up = 1 - yy / hgt;
          P.blend(x, FLOOR - 1 - yy, k < 2 ? GOLD[3] : GOLD[2], a * up * (k < 2 ? 1 : 0.5));
          P.glow(x, FLOOR - 1 - yy, LIGHT_GOLD, a * up * 0.6);
        }
      }
    }
    for (let x = -w; x <= w; x += 1) {
      const e = Math.abs(x) / (w || 1), y = Math.round(Math.sqrt(Math.max(0, 1 - e * e)) * Math.min(10, w * 0.08));
      P.glow(ult.tx + x, FLOOR + 2 + y, LIGHT_GOLD, 0.5 * fade * e);
      P.glow(ult.tx + x, FLOOR - 1 - y * 0.4, LIGHT_GOLD, 0.35 * fade * e);
    }
  }
}

// 特寫帶用的小畫布（畫主角，放大 3 倍）
const portrait = createFrame(48, 52);
const NAVY = rgb("#140c26"), EDGE_HI = rgb("#fff09a"), EDGE_LO = rgb("#c48412"), SLASH = rgb("#2a1a4a");
/** 最上層：特寫帶（承的時候橫過畫面中間） */
export function drawCutIn(frame) {
  if (!ult.on) return;
  const t = ult.t;
  if (t < T.cut0 || t > T.cut1) return;
  const W = frame.w, C = frame.color, L = frame.light;
  const open = Math.min(clamp01((t - T.cut0) / 0.07), clamp01((T.cut1 - t) / 0.07)), half = Math.round(24 * outCubic(open));
  if (half <= 0) return;
  const cy = frame.h - 46, local = t - T.cut0;   // 放在下方，上面的主角和星核才看得到
  const put = (x, y, [r, g, b], a = 1) => {
    if (x < 0 || y < 0 || x >= W || y >= frame.h) return;
    const i = y * W + x, c = C[i], q = 1 - a;
    C[i] = 0xff000000 | ((((c >>> 16) & 255) * q + b * a) << 16) | ((((c >>> 8) & 255) * q + g * a) << 8) | ((c & 255) * q + r * a);
    L[i] = 0;
  };
  // 底色＋一道斜的亮帶
  for (let y = cy - half; y < cy + half; y++) for (let x = 0; x < W; x++) {
    const s = x - (y - cy) * 0.6 - W * 0.55 + local * 60;
    put(x, y, s > 0 && s < 46 ? SLASH : NAVY);
  }
  // 速度線：往左飛
  for (const l of LINES) {
    const y = Math.round(cy - half + 3 + l.y * (half * 2 - 6));
    const x0 = Math.round((((l.x * (W + 120) - local * 900 * l.sp) % (W + 120)) + (W + 120)) % (W + 120)) - 60;
    for (let k = 0; k < l.len; k++) put(x0 + k, y, l.hot ? GOLD[2] : GOLD[1], (1 - k / l.len) * (l.hot ? 0.9 : 0.45));
  }
  // 主角的臉：畫到小畫布再放大 4 倍（最近鄰，不做模糊）
  portrait.color.fill(0);
  portrait.light.fill(0);
  paintStar(portrait, 24, 50, PORTRAIT, ult.face < 0, { glow: 0 });
  let top = 52;
  for (let i = 0; i < portrait.color.length; i++) if (portrait.color[i] >>> 24) { top = Math.floor(i / 48); break; }
  const S = 4, rows = Math.ceil((half * 2) / S) + 1, px0 = Math.round(W * 0.56 + 40 * (1 - outCubic(clamp01(local / 0.12))) - local * 14);
  for (let r = 0; r < rows; r++) for (let x = 0; x < 48; x++) {
    const c = portrait.color[(top + 3 + r) * 48 + x];   // 從頭頂往下 3 格開始：領巾、眼睛、肚子的光都在帶子裡
    if (!(c >>> 24)) continue;
    const col = [c & 255, (c >>> 8) & 255, (c >>> 16) & 255];
    for (let a = 0; a < S; a++) for (let b = 0; b < S; b++) {
      const yy = cy - half + r * S + a;
      if (yy < cy + half) put(px0 + x * S + b, yy, col);
    }
  }
  // 上下兩條金邊
  for (let x = 0; x < W; x++) { put(x, cy - half - 1, EDGE_HI); put(x, cy - half - 2, EDGE_LO); put(x, cy + half, EDGE_HI); put(x, cy + half + 1, EDGE_LO); }
}

/** 合成之後：落地瞬間黑白反轉兩拍（每拍 2 幀） */
export function postUlt(data) {
  if (!ult.post) return;
  const step = ult.post++;
  if (step > 4) { ult.post = 0; return; }
  const invert = step > 2;
  for (let j = 0; j < data.length; j += 4) {
    const lum = data[j] * 0.3 + data[j + 1] * 0.59 + data[j + 2] * 0.11;
    const v = (lum > 120) !== invert ? 255 : 0;
    data[j] = data[j + 1] = data[j + 2] = v;
  }
}

// 招式名（HTML 文字，跟特寫帶一起出現）
function showName(on) {
  const el = document.getElementById("ultName");
  if (!el) return;
  el.classList.remove("on");
  if (on) setTimeout(() => { if (ult.on) { void el.offsetWidth; el.classList.add("on"); } }, T.cut0 * 1000);
}
