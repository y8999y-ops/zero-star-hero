// Unity 轉移的「操作錄影」比對（網頁版這一邊）：用網頁版真正的 player.js、enemies.js、地形、光影、特效，
// 照一串固定的按鍵（SCRIPT）跑 1-1 第一段，每一步記下主角、怪、鏡頭的數值，每 20 步存一張合成好的畫面。
// Unity 那邊（零星工具／比對測試：操作錄影）用同一串按鍵跑一次，再用 node game/tools/unity-trace-compare.mjs 逐步比對。
// 亂數換成固定種子（兩邊同一個順序取亂數）；音效關掉；performance.now 換成遊戲時間。
// 執行：node --no-use-std-math-pow game/tools/unity-trace.mjs   → unity/Golden/web/trace.txt、trace-frames.bin
import { installDom } from "./unity/node-dom.mjs";
// 收集 input.js 掛的鍵盤事件，等一下自己觸發
const handlers = {};
globalThis.addEventListener = (type, fn) => { (handlers[type] ??= []).push(fn); };
installDom();
let simMs = 0;
performance.now = () => simMs;
// setTimeout 換成遊戲時間：每一步開始前，把到時間的依序執行（Unity 那邊是 Game.After，同一個規則）
const timers = []; let timerSeq = 0;
globalThis.setTimeout = (fn, ms = 0) => { timers.push({ due: simMs + ms, seq: timerSeq++, fn }); return 0; };
globalThis.clearTimeout = () => {};
function runTimers() {
  for (;;) {
    let best = -1;
    for (let i = 0; i < timers.length; i++) if (timers[i].due <= simMs && (best < 0 || timers[i].due < timers[best].due || (timers[i].due === timers[best].due && timers[i].seq < timers[best].seq))) best = i;
    if (best < 0) return;
    const [t] = timers.splice(best, 1);
    t.fn();
  }
}
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
const { tickInput, input, consume } = await import("../src/input.js");
const { Player } = await import("../src/player.js");
const { Enemy } = await import("../src/enemies.js");
const { POSES } = await import("../src/star.js");
const { spawn, updateFx, drawFx, juice, shakeOffset, hitStop, shake } = await import("../src/fx.js");
const { updateCombatFx, drawCombatFx, drawDamageNumbers, dustFx, fxState } = await import("../src/combatfx.js");
const { updateLight, computeLight } = await import("../src/light.js");
const L = await import("../src/level.js");
const { A } = await import("../src/assets.js");
const { floorAt, solidAt } = await import("../src/map.js");
const { STAGE_1_1 } = await import("../src/stage.js");
const { PAL, createFx } = await import("../../pixelfx/src/core/index.js");
const { GLOW } = await import("../src/assets.js");
const fireball = await import("../../pixelfx/src/fx/fire/fireball.js");
const explosion = await import("../../pixelfx/src/fx/explosions/plasma-explosion.js");
const collectBurst = await import("../../pixelfx/src/fx/pickups/collect-burst.js");
const { flash } = await import("../src/light.js");
const { ELEM, setStatusContext, updateStatus, drawBolts, setStatusAllow } = await import("../src/status.js");
const { FORMS } = await import("../src/forms.js");
const { COMBO_MP } = await import("../src/player.js");
const { ult, ULT_MP, ULT_MULT, startUlt, updateUlt, ultLights, dimScene, drawUlt, drawCutIn, postUlt, bindUltHooks } = await import("../src/ult.js");
const { global: globalLight } = await import("../src/light.js");
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
const shots = [];
const stats = { combo: 0, comboT: 0, kills: 0 };
const SHOT_PAL = {
  star: { fx: PAL.gold, boom: PAL.gold, accent: PAL.holy, light: "#ffd27a", r: 46, push: 3 },
  slime: { fx: PAL.poison, boom: PAL.poison, accent: PAL.leaf, light: "#7ee86a", r: 62, push: 5 },
};
const FORM_BURST = {
  star: ["#1e1206", "#4a2c08", "#86520c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff"],
  slime: ["#0c2010", "#1a4a20", "#2a8a3a", "#4cc04a", "#8ee86a", "#d4ffb0", "#ffffff"],
  bat: ["#160c24", "#2e1a4a", "#5c388c", "#8058b8", "#b48ae8", "#e2d0ff", "#ffffff"],
  can: ["#14161c", "#2a2e38", "#4a5468", "#6e7a90", "#9aa6ba", "#d0d8e6", "#ffffff"],
  spike: ["#2a1206", "#6a3010", "#a85a1c", "#e09a3a", "#ffd890", "#fff2d0", "#ffffff"],
};
const COMBO_T = 4.4, FORM_CD = 1;
function addCombo(n) {
  const gain = Math.floor((stats.combo + n) / 10) - Math.floor(stats.combo / 10);
  if (gain > 0 && player.mp < player.maxMp) player.mp = Math.min(player.maxMp, player.mp + gain * COMBO_MP);
  stats.combo += n;
  stats.comboT = COMBO_T;
}
let formCdUntil = -9;
function switchForm(id) {
  if (!id || id === player.form) return;
  if (sceneClock < formCdUntil) return;
  formCdUntil = sceneClock + FORM_CD;
  player.setForm(id);
  player.turnT = 0.09;
  player.invuln = Math.max(player.invuln, 0.15);
  spawn(collectBurst, { x: Math.round(player.x), y: Math.round(player.y) - 12, palette: FORM_BURST[id], light: 0.4 });
  flash(player.x, player.y - 12, 60, 2, 0.3, FORMS[id].color);
}
setStatusContext({ enemies, atk: () => player.stats.atk });
setStatusAllow(["burn", "slime"]);   // 1-1 只有燃燒和黏液（main.js 同一個設定）
let ultCd = 0;
const ultHooks = {
  wave(x0, x1, tx) {
    let n = 0;
    for (const e of enemies) {
      if (e.dead || ult.hitSet.has(e) || e.x < x0 || e.x > x1 || Math.abs(e.y - (ult.fy ?? e.y)) > 130) continue;
      ult.hitSet.add(e);
      e.hit(player.roll(ULT_MULT * (1 + player.stats.ult / 100) * 1), e.x < tx ? -1 : 1, { launch: true, push: 4 }, world);
      n++;
    }
    if (n) addCombo(n);
  },
  dust: (x, y) => { world.dust(x, y, 6); },
  enemies: () => enemies.filter((e) => !e.dead),
  hit(e, mult, dir, opts) { if (e.dead) return; e.hit(player.roll(mult * (1 + player.stats.ult / 100) * 1), dir, opts, world); addCombo(1); },
  view: () => { const v = viewRect(); return { l: camX + v.x0, r: camX + v.x0 + v.w, top: camY + v.y0 }; },
  puddle: () => {},   // 黏液灘（hazards.js）兩邊都還沒搬
  heal: (k) => { player.hp = Math.min(player.maxHp, player.hp + player.maxHp * k); },
};
bindUltHooks(ultHooks);
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
  hitArea(box, dmg, dir, opts) {
    let n = 0;
    for (const e of enemies) if (!e.dead && overlaps(box, e.box())) { const r = typeof dmg === "function" ? dmg() : dmg; e.hit(r, dir, opts, world, box); n++; }
    if (n) addCombo(n);
    return n;
  },
  hitOnce(box, hit, dmg, dir, opts) {
    let n = 0;
    for (const e of enemies) if (!e.dead && !hit.has(e) && overlaps(box, e.box())) { hit.add(e); const r = dmg(); e.hit(r, dir, opts, world, box); n++; }
    if (n) { addCombo(n); hitStop(0.05); shake(0.15, 2); }
    return n;
  },
  spawnFireball(x, y, dir, form = "star", vy = 0) {
    const pal = SHOT_PAL[form] ?? SHOT_PAL.star;
    shots.push({ x, y, dir, vy, form, life: 1.1, mult: 1, gen: 0, fx: spawn(fireball, { x, y, flip: dir < 0, palette: pal.fx, light: GLOW.skill, seed: (Math.random() * 99) | 0 }) });
  },
  noMana() {},
  land(x, y, hard) { dustFx("land", x, y, hard); },
  jumpDust(x, y, first) { dustFx(first ? "jump" : "double", x, y); },
  stepDust(x, y) { dustFx("step", x, y); },
  skidDust(x, y, dir) { dustFx("skid", x, y, false, dir); },
  dust(x, y, n) { spawn(A.dust, { x: Math.round(x), y: Math.round(y), flip: Math.random() < 0.5 }, { speed: 1.8 }); },
  dropCoins() {}, onPlayerHurt() {},
  onKill(e) { stats.kills++; if (e.sqT > 0) hitStop(0.08); },
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
let pendingForm = null;   // 操作錄影的「換形態」（網頁版是按 1～3／O，這裡直接指定形態）
function tick(dt) {
  tickInput(dt);
  if (juice.shakeT > 0) juice.shakeT -= dt;
  if (juice.freeze > 0) { juice.freeze -= dt; return; }
  updateCombatFx(dt);
  updateLight(dt);
  updateStatus(dt, enemies);
  if (ult.on) {
    updateUlt(dt, player, ultHooks);
    for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].dead) enemies.splice(i, 1);
    updateFx(dt);
    followCam(dt);
    return;
  }
  if (pendingForm) { switchForm(pendingForm); pendingForm = null; }
  ultCd -= dt;
  const ultReady = player.mp >= ULT_MP && !ult.on && ultCd <= 0;
  if (input.ult && !ultReady && !ult.on) consume("ult");
  if (input.ult && ultReady && player.state !== "hurt") { consume("ult"); player.mp -= ULT_MP; ultCd = 1; startUlt(player, null); return; }
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
  // 技能彈（main.js 的「火球」段）
  for (const s of shots) {
    s.x += s.dir * 290 * dt;
    if (s.vy) s.y = Math.min(floorAt(s.x, s.y) - 6, s.y + s.vy * dt);
    s.life -= dt;
    s.fx.options.x = Math.round(s.x);
    s.fx.options.y = Math.round(s.y);
    let hit = s.life <= 0 || solidAt(s.x, s.y);
    if (!hit) for (const e of enemies) if (!e.dead && e !== s.skip && overlaps(e.box(), { x0: s.x - 8, x1: s.x + 8, y0: s.y - 8, y1: s.y + 8 })) { hit = true; break; }
    if (hit) {
      s.done = true;
      s.fx.stop();
      const P = SHOT_PAL[s.form] ?? SHOT_PAL.star;
      const big = 1 + 0.15 * 0, R = P.r * big * (s.small ? 0.55 : 1);
      spawn(explosion, { x: Math.round(s.x), y: Math.round(s.y), palette: P.boom, accent: P.accent, light: GLOW.skill * (s.small ? 0.5 : 1), seed: (Math.random() * 99) | 0 }, { speed: s.small ? 1.8 : 1.3 });
      flash(s.x, s.y, s.small ? 50 : 100, 4, 0.4, P.light);
      world.hitArea({ x0: s.x - R, x1: s.x + R, y0: s.y - 40, y1: s.y + 40 }, () => player.roll(2.4 * s.mult * player.skillMul()), s.dir, { launch: true, push: P.push, elem: ELEM[s.form] ?? "burn" });
      hitStop(s.small ? 0.03 : 0.06);
      shake(s.small ? 0.12 : 0.3, s.small ? 1 : 3);
    }
  }
  for (let i = shots.length - 1; i >= 0; i--) if (shots[i].done) shots.splice(i, 1);
  updateFx(dt);
  if ((stats.comboT -= dt) <= 0 && stats.combo) stats.combo = 0;
  followCam(dt);
}
// ---- 畫（main.js 的 render 子集）
const frame = createFrame(W, H), img = new Uint8ClampedArray(W * H * 4);
frame.view = viewRect();   // 看得到的範圍（main.js 的 applyZoom 設的；跳字會推回這個範圍裡）
let sceneClock = 0;
const PROBE = (k) => { if (process.env.DUMP_TICK && +process.env.DUMP_TICK === curTick) console.log("PROBE", k, (frame.color[145 * 384 + 144] >>> 0).toString(16)); };
let curTick = 0;
globalThis.__probe = (k) => PROBE(k);
function render() {
  const [sx, sy] = shakeOffset();
  frame.ox = Math.round(camX) + sx;
  frame.oy = Math.round(camY) + sy;
  frame.light.fill(0);
  sceneClock += 1 / 60;
  const lights = L.sceneLights(camX, W, sceneClock);
  lights.push({ x: player.x, y: player.y - 10, r: 64, lv: 1.6, col: "#ffcf6a" });
  for (const s of shots) lights.push({ x: s.x, y: s.y, r: 64, lv: 3, col: (SHOT_PAL[s.form] ?? SHOT_PAL.star).light });
  ultLights(lights);
  const lv = computeLight(frame, lights);
  L.drawLevel(frame, lv);
  PROBE("1");
  L.drawAtmosphere(frame, sceneClock);
  PROBE("2");
  if (!ult.on) drawFx(frame, "back");
  PROBE("3");
  for (const e of enemies) e.draw(frame);
  PROBE("4");
  drawBolts(frame);
  if (ult.on) { dimScene(frame); drawFx(frame, "back"); }
  PROBE("5");
  player.draw(frame);
  PROBE("6");
  drawFx(frame, "front");
  PROBE("7");
  fxState.form = player.form;
  drawCombatFx(frame);
  drawUlt(frame);
  PROBE("8");
  L.drawForeground(frame);
  PROBE("9");
  drawDamageNumbers(frame);
  drawCutIn(frame);
  PROBE("10");
  composite(frame, img, null, 0.8);
  postUlt(img);
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
  while (si < SCRIPT.length && SCRIPT[si][0] === n) { const [, type, code] = SCRIPT[si++]; if (type === "f") pendingForm = code; else if (type === "m") player.mp = player.maxMp; else ev(type === "d" ? "keydown" : "keyup", code); }
  runTimers();
  curTick = n;
  tick(STEP);
  simMs += 1000 / 60;
  render();
  const p = player;
  const row = [n, p.x, p.y, p.vx, p.vy, p.state, p.hp, p.face, p.grounded ? 1 : 0, poseName.get(p.pose) ?? "?", camX, camY, juice.freeze, juice.shakeT, p.form, p.mp, stats.combo, ult.on ? "U" + ult.t : "-", shots.length, enemies.length];
  for (const e of enemies) { const S = e.st ?? {}; row.push(e.x, e.y, e.vx, e.vy, e.hp, e.awake ? 1 : 0, ["burn", "slime", "shock", "poison", "stuck"].map((k) => (S[k] > 0 ? k[0] : "")).join("") || "-"); }
  lines.push(row.map(f).join(" "));
  if (n % FRAME_EVERY === 0) frames.push(Buffer.from(img.buffer.slice(0)));
  if (process.env.DUMP_TICK && +process.env.DUMP_TICK === n) writeFileSync(join(OUT, "dump.bin"), Buffer.concat([Buffer.from(frame.color.buffer.slice(0)), Buffer.from(frame.light.buffer.slice(0))]));
}
writeFileSync(join(OUT, "trace.txt"), lines.join("\n") + "\n");
writeFileSync(join(OUT, "trace-frames.bin"), Buffer.concat(frames));
console.log(`網頁版：${TICKS} 步、${frames.length} 張畫面 → ${OUT}`);
console.log("最後：", lines[lines.length - 1].split(" ").slice(0, 10).join(" "));
