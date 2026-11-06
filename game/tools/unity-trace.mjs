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
const { floorAt, solidAt, moveX, groundAt } = await import("../src/map.js");
const { STAGE_1_1 } = await import("../src/stage.js");
const { PAL, createFx } = await import("../../pixelfx/src/core/index.js");
const { GLOW } = await import("../src/assets.js");
const fireball = await import("../../pixelfx/src/fx/fire/fireball.js");
const explosion = await import("../../pixelfx/src/fx/explosions/plasma-explosion.js");
const collectBurst = await import("../../pixelfx/src/fx/pickups/collect-burst.js");
const { flash } = await import("../src/light.js");
const { ELEM, setStatusContext, updateStatus, drawBolts, setStatusAllow } = await import("../src/status.js");
const { FORMS } = await import("../src/forms.js");
const { TREES, bindForms, rank } = await import("../src/skilltree.js");
const { drawWave, WAVE_T, WAVE_V } = await import("../src/starwave.js");
const { drawMiniBat } = await import("../src/minibat.js");
const IT = await import("../src/items.js");
const { computeStats } = await import("../src/stats.js");
const { drawMark, drawStrike, drawShield, drawReson, drawKingBack, drawKingFront, STRIKE_T } = await import("../src/setfx.js");
const { drawTrail, drawDizzy, TRAIL_T } = await import("../src/corefx.js");
const sparkFx = await import("../../pixelfx/src/fx/impacts/hit-spark.js");
const levelUpFx = await import("../../pixelfx/src/fx/ui/level-up.js");
const { Drops } = await import("../src/loot.js");
const { drawCore, drawAbsorbBeams } = await import("../src/coreart.js");
const { makeCore } = await import("../src/forms.js");
const { xpNeed, MAX_LV, compare } = await import("../src/stats.js");
const collectBurstFx = await import("../../pixelfx/src/fx/pickups/collect-burst.js");
const starFallFx = await import("../../pixelfx/src/fx/arcane/star-fall.js");
const slamFx = await import("../../pixelfx/src/fx/impacts/ground-slam.js");
const { COMBO_MP } = await import("../src/player.js");
const { ult, ULT_MP, ULT_MULT, startUlt, updateUlt, ultLights, dimScene, drawUlt, drawCutIn, postUlt, bindUltHooks } = await import("../src/ult.js");
const { global: globalLight } = await import("../src/light.js");
const SC = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "unity-trace-script.json"), "utf8"));
const SCRIPT = SC.events.slice().sort((a, b) => a[0] - b[0]), TICKS = SC.ticks, FRAME_EVERY = SC.frameEvery;
// 技能樹："max"＝每個形態的每個節點都點滿（每個效果都會用到）
const treeOwned = {};
for (const f of Object.keys(TREES)) treeOwned[f] = { pts: 0, tree: SC.tree === "max" ? Object.fromEntries(TREES[f].map((n) => [n.id, n.max])) : {} };
bindForms({ owned: treeOwned });
// 穿搭（環境變數 TRACE_VARIANT 選 SC.variants 裡的一組；沒有＝沒穿裝備）
const VARIANT = process.env.TRACE_VARIANT ?? "";
const V = VARIANT ? SC.variants[VARIANT] : SC.starter ?? null;   // 沒選穿搭＝新存檔的初始裝備（生鏽星核＋麻布衣）
const equip = { weapon: null, head: null, body: null, hands: null, feet: null, acc1: null, acc2: null };
function specItem(sp) {
  const kind = sp.base ? IT.BASES[sp.base].kind : sp.unique ? IT.UNIQUES[sp.unique].kind : IT.MYTHS[sp.myth].kind;
  const it = { uid: "x", kind, rarity: sp.rarity, ilvl: sp.ilvl, plus: sp.plus ?? 0, main: { id: sp.main[0], v: sp.main[1] }, affixes: (sp.affixes ?? []).map(([id, tier, v]) => ({ id, tier, v })), name: sp.name ?? "x", icon: "x" };
  if (sp.base) it.base = sp.base;
  if (sp.unique) it.unique = sp.unique;
  if (sp.myth) { it.myth = sp.myth; it.awaken = { kills: sp.kills ?? 0 }; }
  if (sp.set) it.set = sp.set;
  return it;
}
if (V) for (const [slot, sp] of Object.entries(V.equip)) equip[slot] = specItem(sp);

const W = 384, H = 216, ZOOM = 1.38, STEP = 1 / 60, LEVEL_W = L.LEVEL_W, MAP_H = L.MAP_H;
const VIEW_DY = Math.round(0.05 * H / ZOOM);
const viewRect = () => { const vw = W / ZOOM, vh = H / ZOOM, my = (H - vh) / 2; return { x0: (W - vw) / 2, y0: my + Math.min(VIEW_DY, my), w: vw, h: vh }; };
const overlaps = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

// ---- 世界（main.js 的子集：只有地形、主角、史萊姆、火把、戰鬥特效）
const player = new Player(STAGE_1_1.start.x, STAGE_1_1.start.y);
const enemies = [];
if (V) player.setStats(computeStats(equip, V.lv ?? 1));
const profile = { lv: V?.lv ?? 1, xp: 0, coins: 0, inv: [], forms: { owned: { star: {} } } };
const drops = new Drops(), coins = [];
const KILL_XP = { slime: 5, bat: 5, trash: 12, gold: 20, hog: 9 }, DROP_RATE = { slime: 0.1, bat: 0.1, trash: 0.35, gold: 1, hog: 0.2 };
const ilvlNow = (bonus = 0) => profile.lv + bonus + Math.floor(Math.random() * 2);
function gainXp(n) {
  if (profile.lv >= MAX_LV) return;
  profile.xp += n;
  let up = false;
  while (profile.lv < MAX_LV && profile.xp >= xpNeed(profile.lv)) { profile.xp -= xpNeed(profile.lv); profile.lv++; up = true; }
  if (!up) return;
  player.setStats(computeStats(equip, profile.lv));
  player.hp = player.maxHp;
  spawn(levelUpFx, { x: Math.round(player.x), y: Math.round(player.y), light: 0.45, seed: profile.lv });
  flash(player.x, player.y - 12, 90, 3, 0.8, "#ffd84a");
}
function dropItem(x, y, minR = 0, opts = {}) {
  const r = opts.rarity ?? IT.rollRarity(player.stats.mf, minR);
  const item = IT.makeItem(opts.ilvl ?? ilvlNow(), r, opts);
  drops.add(item, x, y, opts.dir);
  if (item.rarity === IT.R.legend) { flash(x, y, 110, 4, 1, "#ff8a2a"); hitStop(0.12); shake(0.4, 3); }
  else if (item.rarity === IT.R.epic) { flash(x, y, 90, 3, 0.6, "#b878ff"); shake(0.25, 2); hitStop(0.06); }
  else if (item.rarity === IT.R.rare) shake(0.15, 2);
}
function pickUp(d) {
  if (d.item.kind === "formcore") return false;
  const it = d.item, better = compare(it, equip, profile.lv)?.better;
  if (profile.inv.length >= 100) return false;
  it.new = true;
  profile.inv.push(it);
  if (it.kind === "junk" && Math.random() < 0.4) {}
  if (it.rarity >= IT.R.rare) spawn(collectBurstFx, { x: Math.round(player.x), y: Math.round(player.y) - 10, palette: it.rarity === IT.R.legend ? PAL.ember : ["#1e1206", "#4a2c08", "#86520c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff"], light: 0.4 });
  return true;
}
let absorbHp = null;
function updateAbsorb(dt) {
  const cores = drops.list.filter((d) => d.item.kind === "formcore" && d.landed && d.t > 0.45 && !d.got);
  let near = null;
  for (const d of cores) if (Math.abs(d.x - player.x) < 26 && Math.abs(d.y - player.y) < 30 && (!near || Math.abs(d.x - player.x) < Math.abs(near.x - player.x))) near = d;
  const hit = absorbHp !== null && player.hp < absorbHp;
  absorbHp = player.hp;
  for (const d of cores) if (d !== near && d.hold) d.hold = Math.max(0, d.hold - dt * 3);
  if (!near) return;
  if (hit && near.hold > 0) { near.hold = 0; return; }
  if (input.absorb && !ult.on) {
    near.hold = Math.min(1, (near.hold ?? 0) + dt / 1);
    if (near.hold >= 1) { near.got = true; absorbIt(near.item); }
  } else near.hold = Math.max(0, (near.hold ?? 0) - dt * 3);
}
function absorbIt(it) {
  spawn(collectBurstFx, { x: Math.round(player.x), y: Math.round(player.y) - 12, palette: FORM_BURST[it.form], light: 0.7 });
  spawn(collectBurstFx, { x: Math.round(player.x), y: Math.round(player.y) - 12, palette: FORM_BURST[it.form], light: 0.4, seed: 7 }, { speed: 0.7 });
  flash(player.x, player.y - 12, 120, 4, 0.9, FORMS[it.form].color);
  shake(0.18, 2.5);
}
const mythOn = (id) => Object.values(equip).find((it) => it?.myth === id);
const strikes = [], trail = [];
let comet = null, noisyT = 4, combatT = 0, idleT = 0, boomDepth = 0;
const NOISY = [["a", { atk: 0.3 }], ["b", { spd: 0.3 }], ["c", { move: 0.3 }], ["d", { atk: 0.3 }]];
function updateUniques(dt) {
  if (player.has("noisy") && (noisyT -= dt) <= 0) {
    noisyT = 10;
    const [line, buff] = NOISY[Math.floor(Math.random() * NOISY.length)];
    Object.assign(player.buff, { atk: 0, spd: 0, move: 0, ...buff, t: player.core("noisy") || 5 });
  }
  const fighting = enemies.some((e) => !e.dead && e.kind !== "gold" && Math.abs(e.x - player.x) < 220 && Math.abs(e.y - player.y) < 140);
  idleT = fighting ? 0 : idleT + dt;
  combatT = fighting ? combatT + dt : idleT > 3 ? 0 : combatT;
  player.dmgMul = player.has("overtime") ? 1 + Math.min(1, Math.floor(combatT / 10) * 0.05) : 1;
}
function updateCoreFx(dt) {
  for (const e of enemies) {
    if (e.dizzyT > 0) e.dizzyT -= dt;
    if (!(e.flungT > 0) || e.dead) continue;
    e.flungT -= dt;
    if (Math.abs(e.vx) < 40) continue;
    for (const o of enemies) if (!o.dead && !e.flungHit.has(o) && overlaps(e.box(), o.box())) { e.flungHit.add(o); o.hit({ dmg: e.flungDmg, crit: false }, Math.sign(e.vx), { push: 3 }, world); }
  }
  const x = player.core("comet");
  if (comet && player.state === "dash" && x) trail.push({ x: player.x, y: player.y - 10, t: 0, seed: trail.length * 7 + (sceneClock * 60 | 0) });
  else if (player.state !== "dash") comet = null;
  for (const p of trail) {
    p.t += dt;
    if (!comet || p.t > 0.45) continue;
    for (const e of enemies) if (!e.dead && !comet.hit.has(e) && overlaps({ x0: p.x - 6, x1: p.x + 6, y0: p.y - 14, y1: p.y + 10 }, e.box())) { comet.hit.add(e); e.hit(player.roll(x / 100), player.face, { push: 1 }, world); }
  }
  for (let i = trail.length - 1; i >= 0; i--) if (trail[i].t > TRAIL_T) trail.splice(i, 1);
}
function onCritHit(e, r) {
  if (r?.crit && player.core("sharp") && !e.dead) e.hit({ dmg: r.dmg * player.core("sharp") / 100, crit: false }, player.face, { push: 0 }, world);
  if (!r?.crit || !player.set4("meteor") || !e.box) return;
  if (e.meteorMark > 0) { e.meteorMark = 0; strikes.push({ x: e.x, y: (e.box().y0 + e.box().y1) / 2, t: 0, e }); }
  else e.meteorMark = 5;
}
function heartBurst(from) {
  const it = mythOn("fallheart");
  if (!it) return;
  const st = IT.awakenStage(it), r = st >= 2 ? 60 : 40, mult = st >= 3 ? 1.6 : 0.8, el = ELEM[from] ?? null;
  const pal = { burn: ["#4a1712", "#c9281f", "#f2561d", "#ff8a2a", "#ffc23d", "#ffe26b", "#fff3a6", "#ffffff"], slime: PAL.poison, shock: ["#0c2a60", "#1e64b0", "#3ab8f0", "#9af0ff", "#f0ffff", "#ffffff"], poison: ["#1a0a2a", "#3e1466", "#6a28a8", "#8ae040", "#e8ff70", "#ffffff"] }[el] ?? PAL.gold;
  spawn(explosion, { x: Math.round(player.x), y: Math.round(player.y - 10), palette: pal, accent: pal, light: 0.6, seed: (Math.random() * 99) | 0 }, { speed: 1.6 });
  flash(player.x, player.y - 10, r * 2, 3, 0.3, pal[4]);
  world.hitArea({ x0: player.x - r, x1: player.x + r, y0: player.y - r, y1: player.y + 10 }, () => player.roll(mult), player.face, { push: 3, elem: el });
}
function mythKill() {
  for (const it of Object.values(equip)) {
    if (!it?.myth) continue;
    const before = IT.awakenStage(it);
    it.awaken.kills++;
    const after = IT.awakenStage(it);
    if (after > before) {
      flash(player.x, player.y - 14, 120, 4, 0.6, "#fff0a0"); shake(0.3, 3);
      spawn(levelUpFx, { x: Math.round(player.x), y: Math.round(player.y), light: 0.55, seed: after * 7, text: "AWAKEN!", palette: ["#2a1405", "#5c3008", "#9a5a0e", "#d48e18", "#f5b92c", "#ffde5e", "#fff4bc", "#ffffff"] });
      player.setStats(computeStats(equip, V?.lv ?? 1));
    }
  }
}
for (const t of L.TORCH_POS) spawn(A.brazier, { x: t.x, y: t.y }, { layer: "back", keep: true }).update(Math.random() * 3);
for (const sp of STAGE_1_1.spawns) {
  if (sp.k !== "slime" || sp.x > 1900) continue;   // 第一段：睡著的那隻＋三隻
  const e = new Enemy(sp.k, sp.x, sp.y);
  e.x0 = sp.x; if (sp.core) e.core = sp.core; if (sp.deep) e.deepSleep = true;
  enemies.push(e);
}
const shots = [], waves = [], minis = [];
let swarmT = 0, originT = -9;
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
  const prevForm = player.form;
  player.setForm(id);
  player.turnT = 0.09;
  if (id === "star" && rank("star", "s_origin") && sceneClock - originT > 3) { originT = sceneClock; player.mp = Math.min(player.maxMp, player.mp + 10); }
  if (id === "star" && rank("star", "s_return")) player.skillCd *= 0.5;
  if (id === "slime" && rank("slime", "g_film")) player.filmT = 3;
  if (id === "can" && rank("can", "c_dent")) player.dentT = 3;
  heartBurst(prevForm);
  if (id === "bat" && rank("bat", "b_night")) player.nightT = 3;
  if (id === "spike" && rank("spike", "k_curl")) player.curlT = 3;
  player.invuln = Math.max(player.invuln, 0.15);
  spawn(collectBurst, { x: Math.round(player.x), y: Math.round(player.y) - 12, palette: FORM_BURST[id], light: 0.4 });
  flash(player.x, player.y - 12, 60, 2, 0.3, FORMS[id].color);
}
setStatusContext({
  enemies, atk: () => player.stats.atk,
  burnMul: () => 1 + 0.6 * rank("star", "s_fire"), poisonMul: () => 1 + 0.6 * rank("bat", "b_fang"), poisonDur: () => 1 + 0.4 * rank("bat", "b_toxic"),
  shockBonus: () => player.form === "can" && rank("can", "c_volt") > 0, chainExtra: () => rank("can", "c_conduct") > 0, wildR: () => 1 + 0.3 * rank("slime", "g_fuel"),
});
setStatusAllow(["burn", "slime"]);   // 1-1 只有燃燒和黏液（main.js 同一個設定）
let ultCd = 0;
const ultPassive = () => (player.form === "star" ? 1 + 0.04 * rank("star", "p_star") : 1);
const ultHooks = {
  wave(x0, x1, tx) {
    let n = 0;
    for (const e of enemies) {
      if (e.dead || ult.hitSet.has(e) || e.x < x0 || e.x > x1 || Math.abs(e.y - (ult.fy ?? e.y)) > 130) continue;
      ult.hitSet.add(e);
      e.hit(player.roll(ULT_MULT * (1 + player.stats.ult / 100) * ultPassive()), e.x < tx ? -1 : 1, { launch: true, push: 4 }, world);
      n++;
    }
    if (n) addCombo(n);
  },
  dust: (x, y) => { world.dust(x, y, 6); },
  enemies: () => enemies.filter((e) => !e.dead),
  hit(e, mult, dir, opts) { if (e.dead) return; e.hit(player.roll(mult * (1 + player.stats.ult / 100) * ultPassive()), dir, opts, world); addCombo(1); },
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
  enemiesIn(box) { return enemies.filter((e) => !e.dead && overlaps(box, e.box())); },
  groundSlam(x, y, r, mult) {
    const fy = floorAt(x, y - 8);
    spawn(slamFx, { x: Math.round(x), y: Math.round(fy), palette: ["#14161c", "#2a2e38", "#4a5468", "#6e7a90", "#9aa6ba", "#d0d8e6", "#ffffff"], light: 0.4, seed: (Math.random() * 99) | 0 }, { speed: 1.8 });
    shake(0.25, 3);
    world.hitArea({ x0: x - r, x1: x + r, y0: fy - 30, y1: fy + 2 }, () => player.roll(mult * player.skillMul()), player.face, { launch: true, push: 3 });
  },
  spikeBurst(x, y) {
    spawn(A.spark, { x: Math.round(x), y: Math.round(y) });
    flash(x, y, 70, 2.5, 0.25, "#ffd890");
    world.hitArea({ x0: x - 48, x1: x + 48, y0: y - 40, y1: y + 18 }, () => player.roll(1.2 * player.skillMul()), player.face, { push: 3 });
  },
  thorns(fromX, y) {
    const e = world.nearestEnemy(fromX, y, 40);
    if (!e) return;
    e.hit(player.roll(0.8), e.x >= player.x ? 1 : -1, { push: 2 }, world);
    spawn(A.spark, { x: Math.round(e.x), y: Math.round(y - 12) });
  },
  onGlide(dt) {
    if (!rank("bat", "b_swarm")) return;
    if ((swarmT = swarmT - dt) > 0 || minis.length >= 3) return;
    swarmT = 0.5;
    minis.push({ x: player.x, y: player.y - 16, vx: 0, vy: -40, t: 0, life: 4, cd: 0, seed: Math.random() * 9 });
  },
  spawnWave(x, y, dir) { waves.push({ x, y, dir, t: 0, hit: new Set(), seed: Math.random() }); },
  spawnShotlet(x, y, dir, form, { vy = 0, mult = 0.6, life = 0.35, gen = 1 } = {}) {
    const pal = SHOT_PAL[form] ?? SHOT_PAL.star;
    shots.push({ x, y, dir, vy, form, life, mult, gen, small: true, fx: spawn(fireball, { x, y, flip: dir < 0, palette: pal.fx, light: GLOW.skill * 0.6, seed: (Math.random() * 99) | 0 }) });
  },
  hitArea(box, dmg, dir, opts) {
    let n = 0;
    for (const e of enemies) if (!e.dead && overlaps(box, e.box())) {
      const r = typeof dmg === "function" ? dmg() : dmg, poisoned = e.st?.poison > 0;
      e.hit(r, dir, opts, world, box); n++;
      onCritHit(e, r);
      if (poisoned && player.form === "bat" && rank("bat", "b_blood")) player.hp = Math.min(player.maxHp, player.hp + (r.dmg ?? r) * 0.03);
    }
    if (n) addCombo(n);
    return n;
  },
  hitOnce(box, hit, dmg, dir, opts) {
    let n = 0;
    for (const e of enemies) if (!e.dead && !hit.has(e) && overlaps(box, e.box())) { hit.add(e); const r = dmg(); e.hit(r, dir, opts, world, box); onCritHit(e, r); n++; }
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
  dropCoins(x, y, n) { for (let i = 0; i < n; i++) coins.push({ x, y, vx: (Math.random() - 0.5) * 160, vy: -120 - Math.random() * 140, t: 0 }); },
  onPlayerHurt() {
    if (player.form === "slime" && rank("slime", "g_spring") && Math.random() < 0.2) {
      for (const e of enemies) if (!e.dead && Math.abs(e.x - player.x) < 44 && Math.abs(e.y - player.y) < 40) { e.vx = (e.x >= player.x ? 1 : -1) * 260; e.vy = -160; e.stun = Math.max(e.stun, 0.5); }
      flash(player.x, player.y - 12, 60, 2, 0.25, "#b4f890");
    }
  },
  onKill(e) {
    stats.kills++; if (e.sqT > 0) hitStop(0.08);
    mythKill();
    gainXp((KILL_XP[e.kind] ?? 5) * (e.elite ? 4 : 1));
    if (e.core) { const b = e.box(); drops.add(makeCore(e.core), e.x, (b.y0 + b.y1) / 2, 1); }
    const b = e.box(), cy = (b.y0 + b.y1) / 2;
    if (e.elite || Math.random() < (DROP_RATE[e.kind] ?? 0.1) * (1 + player.stats.mf / 200)) dropItem(e.x, cy, 0, { ilvl: ilvlNow(0) });
    if (player.has("hardhat") && boomDepth < 6 && Math.random() * 100 < 25) {
      const big = player.has("hardhat") ? 1.5 : 1, rx = 34 * big;
      boomDepth++;
      spawn(explosion, { x: Math.round(e.x), y: Math.round(cy), palette: PAL.ember, accent: PAL.lava, light: GLOW.skill * 0.7, seed: (Math.random() * 99) | 0 }, { speed: 1.6 });
      flash(e.x, cy, 70, 3, 0.3, "#ff8a30");
      world.hitArea({ x0: e.x - rx, x1: e.x + rx, y0: cy - rx, y1: cy + rx }, () => player.roll(1.2), e.x < player.x ? -1 : 1, { launch: true, push: 2 });
      shake(0.2, 2);
      boomDepth--;
    }
  },
  cometStart() { comet = { hit: new Set() }; },
  coreMeteor() {
    const e = world.nearestEnemy(player.x, player.y, 320, player.face) ?? world.nearestEnemy(player.x, player.y, 320);
    if (e) strikes.push({ x: e.x, y: (e.box().y0 + e.box().y1) / 2, t: 0, e, mult: 1.2 });
  },
  coreStun(fromX, y) {
    let best = null, bd = 48;
    for (const e of enemies) { if (e.dead) continue; const d = Math.abs(e.x - fromX) + Math.abs(e.y - y) * 0.3; if (d < bd) { bd = d; best = e; } }
    if (best) { best.stun = Math.max(best.stun, 1); best.dizzyT = 1; }
  },
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
function skillTreeBoom(s) {
  const x = s.x, y = s.y;
  if (s.form === "star" && rank("star", "s_rain")) {
    const fy = floorAt(x, y - 8);
    setTimeout(() => {
      spawn(starFallFx, { x: Math.round(x), y: fy, palette: PAL.gold, light: 0.4, seed: (Math.random() * 99) | 0 }, { speed: 1.2 });
      for (let k = 0; k < 4; k++) setTimeout(() => world.hitArea({ x0: x - 50, x1: x + 50, y0: fy - 60, y1: fy }, () => player.roll(0.6 * player.skillMul()), s.dir, { push: 1 }), 150 + k * 180);
    }, 1000);
  }
  if (s.form === "slime") {
    if (rank("slime", "g_bounce")) world.spawnShotlet(x, y, s.dir, "slime", { mult: 0.6, life: 0.3 });
    if (rank("slime", "g_split")) for (const vy of [-140, 0, 140]) world.spawnShotlet(x, y, vy ? s.dir : -s.dir, "slime", { vy, mult: 0.5, life: 0.28 });
  }
}
const COIN_PAL = { k: "#3a1e08", h: "#fff2a8", g: "#ffc83a", G: "#c07c18", H: "#6e3c10" };
const { hex } = await import("../../pixelfx/src/core/index.js");
const COIN_FRAMES = [
  [".kkkk.", "khhgGk", "khgGGk", "kggGGk", "kggGHk", "kgGGHk", ".kkkk."],
  [".kk.", "khgk", "khGk", "kgGk", "kgGk", "kGHk", ".kk."],
  [".k.", "kGk", "kGk", "kGk", "kGk", "kHk", ".k."],
  [".kk.", "kgGk", "kgGk", "kgGk", "kGHk", "kGHk", ".kk."],
].map((rows) => rows.map((r) => [...r].map((ch) => (ch === "." ? 0 : hex(COIN_PAL[ch]) >>> 0))));
const COIN_LIGHT = hex("#8a5a10") >>> 0;
function drawCoins() {
  const Cc = frame.color, L = frame.light, Wf = frame.w;
  for (const c of coins) {
    const spr = COIN_FRAMES[Math.floor(c.t * 10 + c.x * 0.1) & 3], w = spr[0].length;
    const x = Math.round(c.x) - frame.ox - (w >> 1), y = Math.round(c.y) - frame.oy - 3;
    spr.forEach((row, j) => row.forEach((col, i) => { const px = x + i, py = y + j; if (col && px >= 0 && py >= 0 && px < Wf && py < frame.h) Cc[py * Wf + px] = col; }));
    const lx = x + (w >> 1), ly = y + 3;
    if (lx >= 0 && ly >= 0 && lx < Wf && ly < frame.h) L[ly * Wf + lx] = COIN_LIGHT;
  }
}
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
  if (input.ult && ultReady && player.state !== "hurt") { consume("ult"); player.mp -= ULT_MP; ultCd = 1; startUlt(player, null);
    if (player.set4("reson")) player.resonT = 10;
    const crown = mythOn("starking");
    if (crown) { const st = IT.awakenStage(crown); player.kingT = st >= 2 ? 12 : 8; if (st >= 3) player.mp = Math.min(player.maxMp, player.mp + ULT_MP / 2); }
    return; }
  player.update(dt, world);
  updateUniques(dt);
  drops.update(dt, player, 16, pickUp);
  updateAbsorb(dt);
  for (const e of enemies) {
    if (e.dead) continue;
    e.update(dt, player, world);
    if (e.k.dmg && e.stun <= 0 && overlaps(e.box(), { x0: player.x - 8, x1: player.x + 8, y0: player.y - 22, y1: player.y }) && player.hurt(e.k.dmg, e.x, world)) {
      e.vx = (e.x >= player.x ? 1 : -1) * 120;
      e.stun = 0.4;
    }
  }
  separate(dt);
  updateCoreFx(dt);
  for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].dead) enemies.splice(i, 1);
  // 技能彈（main.js 的「火球」段）
  for (const s of shots) {
    s.x += s.dir * 290 * dt;
    if (s.vy) s.y = Math.min(floorAt(s.x, s.y) - 6, s.y + s.vy * dt);
    s.life -= dt;
    s.fx.options.x = Math.round(s.x);
    s.fx.options.y = Math.round(s.y);
    let hit = s.life <= 0 || solidAt(s.x, s.y);
    if (!hit) for (const e of enemies) if (!e.dead && e !== s.skip && overlaps(e.box(), { x0: s.x - 8, x1: s.x + 8, y0: s.y - 8, y1: s.y + 8 })) {
      if (s.form === "star" && !s.small && rank("star", "s_pierce") && !s.skip) { s.skip = e; e.hit(player.roll(1.2 * player.skillMul()), s.dir, { push: 2 }, world); continue; }
      hit = true; break;
    }
    if (hit) {
      s.done = true;
      s.fx.stop();
      const P = SHOT_PAL[s.form] ?? SHOT_PAL.star;
      const big = 1 + 0.15 * (s.form === "slime" ? rank("slime", "g_big") : rank("star", "s_big")), R = P.r * big * (s.small ? 0.55 : 1);
      spawn(explosion, { x: Math.round(s.x), y: Math.round(s.y), palette: P.boom, accent: P.accent, light: GLOW.skill * (s.small ? 0.5 : 1), seed: (Math.random() * 99) | 0 }, { speed: s.small ? 1.8 : 1.3 });
      flash(s.x, s.y, s.small ? 50 : 100, 4, 0.4, P.light);
      world.hitArea({ x0: s.x - R, x1: s.x + R, y0: s.y - 40, y1: s.y + 40 }, () => player.roll(2.4 * s.mult * player.skillMul()), s.dir, { launch: true, push: P.push, elem: ELEM[s.form] ?? "burn" });
      hitStop(s.small ? 0.03 : 0.06);
      shake(s.small ? 0.12 : 0.3, s.small ? 1 : 3);
      if (!s.small) skillTreeBoom(s);
    }
  }
  for (let i = shots.length - 1; i >= 0; i--) if (shots[i].done) shots.splice(i, 1);
  for (const w of waves) {
    w.t += dt; w.x += w.dir * WAVE_V * dt;
    world.hitOnce({ x0: w.x - 8, x1: w.x + 8, y0: w.y - 14, y1: w.y + 14 }, w.hit, () => player.roll(1.0), w.dir, { push: 2 });
  }
  for (let i = waves.length - 1; i >= 0; i--) if (waves[i].t >= WAVE_T) waves.splice(i, 1);
  for (const m of minis) {
    m.t += dt; m.life -= dt; m.cd -= dt;
    const tgt = world.nearestEnemy(m.x, m.y, 160);
    const tx = tgt ? tgt.x : player.x + Math.sin(m.t * 3 + m.seed) * 20, ty = tgt ? (tgt.box().y0 + tgt.box().y1) / 2 : player.y - 30;
    m.vx += Math.sign(tx - m.x) * 600 * dt; m.vy += Math.sign(ty - m.y) * 600 * dt;
    m.vx *= 1 - 3 * dt; m.vy *= 1 - 3 * dt;
    m.x += m.vx * dt; m.y += m.vy * dt;
    if (tgt && m.cd <= 0 && Math.abs(tgt.x - m.x) < 10 && Math.abs(ty - m.y) < 12) { m.cd = 0.6; tgt.hit(player.roll(0.4), m.vx >= 0 ? 1 : -1, { push: 1, elem: "poison" }, world); }
  }
  for (let i = minis.length - 1; i >= 0; i--) if (minis[i].life <= 0) minis.splice(i, 1);
  for (const e of enemies) if (e.meteorMark > 0) e.meteorMark -= dt;
  for (const s of strikes) {
    s.t += dt;
    if (s.t >= STRIKE_T && !s.done) {
      s.done = true;
      spawn(sparkFx, { x: Math.round(s.x), y: Math.round(s.y), palette: ["#6e3a0c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff"], light: 0.6 });
      flash(s.x, s.y, 50, 2.5, 0.2, "#ffe066"); shake(0.12, 2);
      if (!s.e.dead) s.e.hit(player.roll(s.mult ?? 0.8), player.face, { push: 2 }, world);
    }
  }
  for (let i = strikes.length - 1; i >= 0; i--) if (strikes[i].done) strikes.splice(i, 1);
  for (const c of coins) {
    c.t += dt;
    if (c.t < 0.45) {
      c.vy += 700 * dt;
      const py = c.y + 2;
      c.x = moveX(c.x, c.x + c.vx * dt, c.y + 2, 4, 3);
      c.y += c.vy * dt;
      const gy = c.vy >= 0 ? groundAt(c.x, py, c.y + 2) : null;
      if (gy !== null) { c.y = gy - 2; c.vy *= -0.45; c.vx *= 0.6; }
    } else {
      const dx = player.x - c.x, dy = player.y - 12 - c.y, d = Math.hypot(dx, dy) || 1, sp = 120 + (c.t - 0.45) * 900;
      c.x += (dx / d) * sp * dt;
      c.y += (dy / d) * sp * dt;
      if (d < 10) { c.got = true; profile.coins++; }
    }
  }
  for (let i = coins.length - 1; i >= 0; i--) if (coins[i].got) coins.splice(i, 1);
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
  drops.draw(frame);
  for (const d of drops.list) if (d.item.kind === "formcore" && d.hold > 0 && d.cx !== undefined) drawAbsorbBeams(frame, d.cx, d.cy, player.x, player.y - 12, sceneClock, d.item.form, d.hold);
  PROBE("3");
  for (const e of enemies) e.draw(frame);
  PROBE("4");
  drawBolts(frame);
  for (const w of waves) drawWave(frame, w);
  for (const m of minis) drawMiniBat(frame, m);
  for (const e of enemies) if (e.meteorMark > 0 && !e.dead) drawMark(frame, e.x, e.box().y0 - 7, sceneClock);
  for (const s of strikes) drawStrike(frame, s);
  drawTrail(frame, trail);
  for (const e of enemies) if (e.dizzyT > 0 && !e.dead) drawDizzy(frame, e.x, e.box().y0 - 4, sceneClock);
  if (player.shield > 0) drawShield(frame, player.x, player.y - 12, player.shield / (player.maxHp * 0.2), sceneClock);
  if (player.resonT > 0) drawReson(frame, player.x, player.y - 12, sceneClock);
  drawCoins();
  if (ult.on) { dimScene(frame); drawFx(frame, "back"); }
  PROBE("5");
  if (player.kingT > 0) drawKingBack(frame, player.x, player.y - 12, sceneClock);
  player.draw(frame);
  if (player.kingT > 0) drawKingFront(frame, player.x, player.y - 12, sceneClock);
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
  while (si < SCRIPT.length && SCRIPT[si][0] === n) { const [, type, code] = SCRIPT[si++]; if (type === "f") pendingForm = code; else if (type === "m") player.mp = player.maxMp; else if (type === "x") gainXp(+code); else if (type === "i") dropItem(player.x + 40 * player.face, player.y - 12, +code); else ev(type === "d" ? "keydown" : "keyup", code); }
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
writeFileSync(join(OUT, `trace${VARIANT ? "-" + VARIANT : ""}.txt`), lines.join("\n") + "\n");
writeFileSync(join(OUT, `trace-frames${VARIANT ? "-" + VARIANT : ""}.bin`), Buffer.concat(frames));
console.log(`網頁版：${TICKS} 步、${frames.length} 張畫面 → ${OUT}`);
console.log("最後：", lines[lines.length - 1].split(" ").slice(0, 10).join(" "));
