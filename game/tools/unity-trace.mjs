// Unity 轉移的「操作錄影」比對（網頁版這一邊）：用網頁版真正的 player.js、enemies.js、地形、光影、特效，
// 照一串固定的按鍵（SCRIPT）跑 1-1 第一段，每一步記下主角、怪、鏡頭的數值，每 20 步存一張合成好的畫面。
// Unity 那邊（零星工具／比對測試：操作錄影）用同一串按鍵跑一次，再用 node game/tools/unity-trace-compare.mjs 逐步比對。
// 亂數換成固定種子（兩邊同一個順序取亂數）；音效關掉；performance.now 換成遊戲時間。
// 執行：node game/tools/unity-trace.mjs   → unity/Golden/web/trace.txt、trace-frames.bin
import { installDom } from "./unity/node-dom.mjs";
// 收集 input.js 掛的鍵盤事件，等一下自己觸發
const handlers = {};
globalThis.addEventListener = (type, fn) => { (handlers[type] ??= []).push(fn); };
installDom();
let simMs = 0;
performance.now = () => simMs;
// 固定種子的亂數（mulberry32，跟 Unity 的 PixelFX.Rng 一樣）
let rs = 12345;
Math.random = () => { rs = (rs + 0x6d2b79f5) | 0; let t = rs; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(ROOT, "unity", "Golden", "web");
mkdirSync(OUT, { recursive: true });

const { createFrame, clearFrame, composite } = await import("../../pixelfx/src/core/index.js");
const { tickInput } = await import("../src/input.js");
const { Player } = await import("../src/player.js");
const { Enemy } = await import("../src/enemies.js");
const { POSES } = await import("../src/star.js");
const { spawn, updateFx, drawFx, juice, shakeOffset } = await import("../src/fx.js");
const { updateCombatFx, drawCombatFx, drawDamageNumbers, dustFx, fxState } = await import("../src/combatfx.js");
const { updateLight, computeLight } = await import("../src/light.js");
const L = await import("../src/level.js");
const { A } = await import("../src/assets.js");
const { floorAt } = await import("../src/map.js");
const { STAGE_1_1 } = await import("../src/stage.js");
const SC = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "unity-trace-script.json"), "utf8"));
const SCRIPT = SC.events.slice().sort((a, b) => a[0] - b[0]), TICKS = SC.ticks, FRAME_EVERY = SC.frameEvery;

const W = 384, H = 216, ZOOM = 1.38, STEP = 1 / 60, LEVEL_W = L.LEVEL_W, MAP_H = L.MAP_H;
const VIEW_DY = Math.round(0.05 * H / ZOOM);
const viewRect = () => { const vw = W / ZOOM, vh = H / ZOOM, my = (H - vh) / 2; return { x0: (W - vw) / 2, y0: my + Math.min(VIEW_DY, my), w: vw, h: vh }; };
const overlaps = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

// ---- 世界（main.js 的子集：只有地形、主角、史萊姆、火把、戰鬥特效）
const player = new Player(STAGE_1_1.start.x, STAGE_1_1.start.y);
const enemies = [];
for (const t of L.TORCH_POS) spawn(A.brazier, { x: t.x, y: t.y }, { layer: "back", keep: true }).update(Math.random() * 3);
for (const sp of STAGE_1_1.spawns) {
  if (sp.k !== "slime" || sp.x > 1900) continue;   // 第一段：睡著的那隻＋三隻
  const e = new Enemy(sp.k, sp.x, sp.y);
  e.x0 = sp.x; if (sp.deep) e.deepSleep = true;
  enemies.push(e);
}
const world = {
  nearestEnemy(x, y, range, dir = 0) {
    let best = null, bd = range;
    for (const e of enemies) {
      if (e.dead || (dir && Math.sign(e.x - x) !== dir)) continue;
      const d = Math.abs(e.x - x) + Math.abs(e.y - y) * 0.5;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  },
  // 元素狀態（燃燒）還沒搬：兩邊都先不沾
  hitArea(box, dmg, dir, opts) {
    let n = 0;
    for (const e of enemies) if (!e.dead && overlaps(box, e.box())) { const r = typeof dmg === "function" ? dmg() : dmg; e.hit(r, dir, { ...opts, elem: null }, world, box); n++; }
    return n;
  },
  land(x, y, hard) { dustFx("land", x, y, hard); },
  jumpDust(x, y, first) { dustFx(first ? "jump" : "double", x, y); },
  stepDust(x, y) { dustFx("step", x, y); },
  skidDust(x, y, dir) { dustFx("skid", x, y, false, dir); },
  dust(x, y, n) { spawn(A.dust, { x: Math.round(x), y: Math.round(y), flip: Math.random() < 0.5 }, { speed: 1.8 }); },
  dropCoins() {}, onKill() {}, onPlayerHurt() {},
};

// ---- 鏡頭（main.js 的 snapCam、followCam）
let camX = 0, camY = Math.max(0, MAP_H - H), lookX = 0, camRefY = null, camLand = null;
function snapCam() {
  const v = viewRect(), gy = floorAt(player.x, Math.max(0, player.y));
  camLand = player.grounded ? null : gy; camRefY = gy; lookX = player.face * 36;
  camX = Math.max(-v.x0, Math.min(LEVEL_W - v.x0 - v.w, player.x - W / 2));
  if (MAP_H > H) camY = Math.max(-v.y0, Math.min(MAP_H - v.y0 - v.h, gy - H * 0.62));
}
const lookAhead = (dt, dist) => { lookX += (player.face * dist - lookX) * Math.min(1, 2.2 * dt); return lookX; };
const deadFollow = (c, target, dz, rate, dt) => { const d = target - c; if (Math.abs(d) <= dz) return c; return c + (d - Math.sign(d) * dz) * Math.min(1, rate * dt); };
function followCam(dt) {
  const v = viewRect();
  camX = deadFollow(camX + W / 2, player.x + lookAhead(dt, 36), 14, 5, dt) - W / 2;
  camX = Math.max(-v.x0, Math.min(LEVEL_W - v.x0 - v.w, camX));
  if (MAP_H > H) {
    if (camLand !== null && player.grounded) camLand = null;
    if (camLand !== null) camRefY = camLand;
    else if (player.grounded || camRefY === null) camRefY = player.y;
    else if (player.y > camRefY) camRefY = player.y;
    else if (player.y < camRefY - 72) camRefY = player.y + 72;
    const wy = camRefY - H * 0.62, rate = 3 + Math.min(4, Math.max(0, player.vy) / 100);
    camY += (wy - camY) * Math.min(1, rate * dt);
    camY = Math.max(-v.y0, Math.min(MAP_H - v.y0 - v.h, camY));
  }
}
function separate(dt) {
  for (let i = 0; i < enemies.length; i++) {
    const a = enemies[i];
    for (let j = i + 1; j < enemies.length; j++) {
      const b = enemies[j];
      if (a.k.fly !== b.k.fly) continue;
      const dx = b.x - a.x, dy = b.y - a.y, min = a.k.w + b.k.w - 4;
      if (Math.abs(dx) < min && Math.abs(dy) < (a.k.fly ? 16 : 6)) {
        const push = (min - Math.abs(dx)) * 0.5 * Math.min(1, 10 * dt) * (dx >= 0 ? 1 : -1) || 0.5;
        a.x -= push; b.x += push;
      }
    }
  }
}
function tick(dt) {
  tickInput(dt);
  if (juice.shakeT > 0) juice.shakeT -= dt;
  if (juice.freeze > 0) { juice.freeze -= dt; return; }
  updateCombatFx(dt);
  updateLight(dt);
  player.update(dt, world);
  for (const e of enemies) {
    if (e.dead) continue;
    e.update(dt, player, world);
    if (e.k.dmg && e.stun <= 0 && overlaps(e.box(), { x0: player.x - 8, x1: player.x + 8, y0: player.y - 22, y1: player.y }) && player.hurt(e.k.dmg, e.x, world)) {
      e.vx = (e.x >= player.x ? 1 : -1) * 120;
      e.stun = 0.4;
    }
  }
  separate(dt);
  for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].dead) enemies.splice(i, 1);
  updateFx(dt);
  followCam(dt);
}
// ---- 畫（main.js 的 render 子集）
const frame = createFrame(W, H), img = new Uint8ClampedArray(W * H * 4);
let sceneClock = 0;
function render() {
  const [sx, sy] = shakeOffset();
  frame.ox = Math.round(camX) + sx;
  frame.oy = Math.round(camY) + sy;
  frame.light.fill(0);
  sceneClock += 1 / 60;
  const lights = L.sceneLights(camX, W, sceneClock);
  lights.push({ x: player.x, y: player.y - 10, r: 64, lv: 1.6, col: "#ffcf6a" });
  const lv = computeLight(frame, lights);
  L.drawLevel(frame, lv);
  L.drawAtmosphere(frame, sceneClock);
  drawFx(frame, "back");
  for (const e of enemies) e.draw(frame);
  player.draw(frame);
  drawFx(frame, "front");
  fxState.form = player.form;
  drawCombatFx(frame);
  L.drawForeground(frame);
  drawDamageNumbers(frame);
  composite(frame, img, null, 0.8);
}

// ---- 跑
const poseName = new Map();
for (const [k, v] of Object.entries(POSES)) { if (Array.isArray(v)) v.forEach((q, i) => poseName.set(q, `${k}#${i}`)); else poseName.set(v, k); }
const ev = (type, code) => { for (const fn of handlers[type] ?? []) fn({ code, repeat: false, preventDefault() {} }); };
const f = (v) => (typeof v === "number" ? String(v) : String(v));
const lines = [], frames = [];
snapCam();
let si = 0;
for (let n = 0; n < TICKS; n++) {
  while (si < SCRIPT.length && SCRIPT[si][0] === n) { const [, type, code] = SCRIPT[si++]; ev(type === "d" ? "keydown" : "keyup", code); }
  tick(STEP);
  simMs += 1000 / 60;
  render();
  const p = player;
  const row = [n, p.x, p.y, p.vx, p.vy, p.state, p.hp, p.face, p.grounded ? 1 : 0, poseName.get(p.pose) ?? "?", camX, camY, juice.freeze, juice.shakeT, enemies.length];
  for (const e of enemies) row.push(e.x, e.y, e.vx, e.vy, e.hp, e.awake ? 1 : 0);
  lines.push(row.map(f).join(" "));
  if (n % FRAME_EVERY === 0) frames.push(Buffer.from(img.buffer.slice(0)));
}
writeFileSync(join(OUT, "trace.txt"), lines.join("\n") + "\n");
writeFileSync(join(OUT, "trace-frames.bin"), Buffer.concat(frames));
console.log(`網頁版：${TICKS} 步、${frames.length} 張畫面 → ${OUT}`);
console.log("最後：", lines[lines.length - 1].split(" ").slice(0, 10).join(" "));
