// 遊戲主程式：第一章的關卡（1-1～1-3）、碎星鎮。網址加 ?endless 是無限出怪的測試模式，?stage=1-2 直接進那一關。
import { createFrame, composite, hex, PAL } from "../../pixelfx/src/core/index.js";
import * as fireball from "../../pixelfx/src/fx/fire/fireball.js";
import * as explosion from "../../pixelfx/src/fx/explosions/plasma-explosion.js";
import { A, GLOW } from "./assets.js";
import { input, tickInput, initTouch, consume } from "./input.js";
import { drawLevel, drawForeground, drawAtmosphere, sceneLights, LEVEL_W, FLOOR, H, TORCHES, WALL, geo } from "./level.js";
import { TOWN_W, NPCS, townLights, drawTown, drawTownNpcs, drawTownFg, nearby } from "./town.js";
import { talk, ask, dialog, typewriter } from "./dialog.js";
import * as frogFx from "../../pixelfx/src/fx/critters/frog.js";
import { computeLight, flash, updateLight } from "./light.js";
import { spawn, updateFx, drawFx, juice, hitStop, shake, shakeOffset, fxCount } from "./fx.js";
import { Player } from "./player.js";
import { Enemy } from "./enemies.js";
import { Director, STAGES } from "./stage.js";
import { STAGE_KEY, STAGE_ORDER, STAGE_ID, LAYOUTS } from "./stages.js";
import * as levelUpFx from "../../pixelfx/src/fx/ui/level-up.js";
import * as chestOpen from "../../pixelfx/src/fx/pickups/chest-open.js";
import * as collectBurst from "../../pixelfx/src/fx/pickups/collect-burst.js";
import { createFx } from "../../pixelfx/src/core/index.js";
import { load, save, BAG_SIZE } from "./save.js";
import { computeStats, compare, xpNeed, MAX_LV } from "./stats.js";
import { makeItem, rollRarity, R, RARITY, JUNK } from "./items.js";
import { Drops, feed } from "./loot.js";
import { createInventory } from "./inventory.js";
import { installUiArt, iconURL, setAttackIcon, medal, MEDAL_SIZE } from "./ui-art.js";
import { FORMS, CARRY_MAX, coreChance, absorbCore, makeCore, coresToLevel } from "./forms.js";
import { createFrame as makeFrame } from "../../pixelfx/src/core/index.js";
import { paintStar, POSES } from "./star.js";
import { npcSize } from "./npcs.js";
import { createFolk, FOLK_INFO } from "./folk.js";
import { createProps } from "./props.js";
import { createScenery } from "./scenery.js";
import { Boss, prepareBoss } from "./boss.js";
import { createComboArt } from "./combo-art.js";
import { unlock as unlockAudio, sfx, music, jingle, vol as audioVol, setVolume } from "./audio.js";
import { fxState, dustFx, updateCombatFx, drawCombatFx, drawDamageNumbers } from "./combatfx.js";
import { PLATFORMS } from "./level.js";
import { ult, ULT_MAX, ULT_MULT, startUlt, updateUlt, ultLights, dimScene, drawUlt, drawCutIn, postUlt } from "./ult.js";

installUiArt();
// 場景：城鎮（碎星鎮）或關卡。換場景＝存檔後重新載入頁面（下一個場景記在 sessionStorage）。
// ?endless 直接進無限模式、?stage 直接進 1-1（開發用）。第一次玩（還沒通關、還沒登記）先從 1-1 開始。
const NEXT_KEY = "zero-hero-next", QS = new URLSearchParams(location.search);
const nextScene = sessionStorage.getItem(NEXT_KEY);
sessionStorage.removeItem(NEXT_KEY);
const profile = load();
const ENDLESS = nextScene ? nextScene === "endless" : QS.has("endless");
const TOWN = nextScene ? nextScene === "town" : !QS.has("endless") && !QS.has("stage") && (profile.clears > 0 || profile.guild.registered);
const STAGE = STAGES[STAGE_ID];
// 關卡進度：哪幾關打過（舊存檔：通關過＝1-1 打過）
profile.cleared ??= profile.clears > 0 ? { "1-1": true } : {};
const unlocked = () => STAGE_ORDER.filter((id, i) => i === 0 || profile.cleared[STAGE_ORDER[i - 1]]);
const nextStage = () => STAGE_ORDER[STAGE_ORDER.indexOf(STAGE_ID) + 1];

const STEP = 1 / 60;
const canvas = document.getElementById("screen");
const ctx = canvas.getContext("2d");
let W = 384, frame, img;

// ---- 畫面大小：高度固定 216，寬度跟著螢幕比例走（手機長螢幕不會有黑邊）
function resize() {
  const aspect = innerWidth && innerHeight ? innerWidth / innerHeight : 16 / 9;   // 視窗還沒顯示時是 0
  W = Math.max(320, Math.min(480, Math.round((H * aspect) / 2) * 2));
  canvas.width = W;
  canvas.height = H;
  const k = Math.min(innerWidth / W, innerHeight / H);
  canvas.style.width = Math.floor(W * k) + "px";
  canvas.style.height = Math.floor(H * k) + "px";
  frame = createFrame(W, H);
  img = new ImageData(W, H);
}
addEventListener("resize", resize);
resize();

// ---- 世界
if (TOWN) { geo.platforms = []; geo.w = TOWN_W; }
const player = TOWN ? new Player(120, FLOOR) : ENDLESS ? new Player(200, FLOOR) : new Player(STAGE.start.x, STAGE.start.y);
const enemies = [];
const coins = [];
const shots = [];
const stats = { coins: 0, kills: 0, combo: 0, comboT: 0, best: 0, time: 0, deaths: 0 };
let camX = 0, started = false, director = null, cleared = false;

// ---- 存檔與刷寶
const drops = new Drops();
const runLoot = [];   // 這一趟撿到的東西（通關畫面顯示）
let slowT = 0;        // 傳說掉落時的慢動作
function refreshStats() {
  player.setStats(computeStats(profile.equip, profile.lv));
  save(profile);
  updateBagDot();
}
player.setStats(computeStats(profile.equip, profile.lv));
setAttackIcon("star");
player.setForm(profile.forms.cur, profile.forms.owned[profile.forms.cur]?.lv ?? 1);
player.hp = player.maxHp;
const inv = createInventory(profile, { onChange: refreshStats });
window.__game = { player, enemies, stats, profile, drops, inv, get director() { return director; }, get camX() { return camX; } };   // 開發用：在主控台檢查狀態

// 每種敵人的經驗值、掉寶率
const KILL_XP = { slime: 5, bat: 5, trash: 12, gold: 20 };
const DROP_RATE = { slime: 0.1, bat: 0.1, trash: 0.35, gold: 1 };
const ilvlNow = (bonus = 0) => profile.lv + bonus + Math.floor(Math.random() * 2);

function gainXp(n) {
  if (profile.lv >= MAX_LV) return;
  profile.xp += n;
  let up = false;
  while (profile.lv < MAX_LV && profile.xp >= xpNeed(profile.lv)) {
    profile.xp -= xpNeed(profile.lv);
    profile.lv++;
    up = true;
  }
  if (!up) return;
  sfx("levelup");
  refreshStats();
  player.hp = player.maxHp;
  spawn(levelUpFx, { x: Math.round(player.x), y: Math.round(player.y), light: 0.45, seed: profile.lv });
  flash(player.x, player.y - 12, 90, 3, 0.8, "#ffd84a");
  sayQueue.unshift([`升級！Lv ${profile.lv}　生命全滿`, 2.2]);
}

/** 在 (x, y) 掉一件東西。minR 是保底稀有度。 */
function dropItem(x, y, minR = 0, opts = {}) {
  const s = player.stats;
  const r = opts.rarity ?? rollRarity(s.mf, minR);
  const item = makeItem(opts.ilvl ?? ilvlNow(), r, opts);
  drops.add(item, x, y, opts.dir);
  if (item.rarity === R.legend) {
    // 傳說：時間變慢、畫面一閃
    slowT = 0.9;
    flash(x, y, 110, 4, 1, "#ff8a2a");
    hitStop(0.12);
    shake(0.4, 3);
    flashEl.classList.remove("on");
    void flashEl.offsetWidth;
    flashEl.classList.add("on");
    sayQueue.unshift(["系統：……等等，那個橘色的光是怎樣？！", 2.6]);
  } else if (item.rarity === R.rare) shake(0.15, 2);
}

/** 撿起來。背包滿了回傳 false。 */
function pickUp(d) {
  if (d.item.kind === "formcore") return absorb(d.item);
  const it = d.item, better = compare(it, profile.equip, profile.lv)?.better;
  const autoMax = [-1, R.junk, R.common][profile.auto];
  if (it.rarity <= autoMax && !better) {
    const r = RARITY[it.rarity];
    profile.scrap += r.scrap;
    profile.coins += r.coin;
    feed(it, `自動拆解 +${r.scrap} 碎屑`);
    save(profile);
    return true;
  }
  if (profile.inv.length >= BAG_SIZE) {
    if (!d.warned) { d.warned = true; toast("系統：背包滿了！按右上角的背包整理一下。", 2.5); }
    return false;
  }
  it.new = true;
  profile.inv.push(it);
  runLoot.push(it);
  feed(it, "", better);
  if (it.kind === "junk" && Math.random() < 0.4) sayQueue.push([JUNK.find((j) => j.id === it.junk).say, 2.4]);
  sfx(it.rarity >= R.rare ? "rare" : "pickup");
  if (it.rarity >= R.rare) spawn(collectBurst, { x: Math.round(player.x), y: Math.round(player.y) - 10, palette: it.rarity === R.legend ? PAL.ember : ["#1e1206", "#4a2c08", "#86520c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff"], light: 0.4 });
  save(profile);
  updateBagDot();
  return true;
}

// ---- 形態：吸收魔物核、切換
const FORM_BURST = {
  star: ["#1e1206", "#4a2c08", "#86520c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff"],
  slime: ["#0c2010", "#1a4a20", "#2a8a3a", "#4cc04a", "#8ee86a", "#d4ffb0", "#ffffff"],
  can: ["#14161c", "#2a2e38", "#4a5468", "#6e7a90", "#9aa6ba", "#d0d8e6", "#ffffff"],
};
function absorb(it) {
  const F = FORMS[it.form], res = absorbCore(profile.forms, it.form);
  sfx("absorb");
  spawn(collectBurst, { x: Math.round(player.x), y: Math.round(player.y) - 12, palette: FORM_BURST[it.form], light: 0.5 });
  flash(player.x, player.y - 12, 80, 3, 0.6, F.color);
  if (res.unlocked) {
    toast(`系統：吸收了${F.name}的核！新形態「${F.name}」${profile.forms.carry.includes(it.form) ? "（按 O 或右上角切換）" : "（已滿 3 個，回城鎮再換）"}`, 3.2);
    sayQueue.unshift([`系統：你把${F.from === "slime" ? "史萊姆" : "垃圾桶"}的核吃掉了？不對，是吸收。好吧，差不多。`, 2.8]);
  } else if (res.leveled) {
    toast(`系統：${F.name}升到 Lv ${res.lv}！`, 2.2);
    if (player.form === it.form) player.setForm(it.form, res.lv);
  } else {
    const f = profile.forms.owned[it.form];
    feed({ name: it.name, icon: it.icon, rarity: 3 }, `${F.name} ${f.xp}/${coresToLevel(f.lv)}`);
  }
  save(profile);
  buildFormHud();
  return true;
}
function switchForm(id) {
  if (!id || id === player.form || !profile.forms.owned[id] || ult.on) return;
  sfx("form");
  profile.forms.cur = id;
  player.setForm(id, profile.forms.owned[id].lv);
  player.turnT = 0.09;
  player.invuln = Math.max(player.invuln, 0.15);
  spawn(collectBurst, { x: Math.round(player.x), y: Math.round(player.y) - 12, palette: FORM_BURST[id], light: 0.4 });
  flash(player.x, player.y - 12, 60, 2, 0.3, FORMS[id].color);
  save(profile);
  buildFormHud();
}
const $ = (id) => document.getElementById(id);
// 右上角的形態按鈕（電腦也能點）：每格畫一個小星星，目前的形態有亮框
const formHud = document.getElementById("forms");
function buildFormHud() {
  formHud.innerHTML = "";
  profile.forms.carry.forEach((id, i) => {
    const b = document.createElement("button");
    b.className = "fslot" + (id === player.form ? " on" : "");
    b.title = `${FORMS[id].name}（${i + 1}）`;
    const f = makeFrame(40, 34), c = document.createElement("canvas");
    c.width = 40; c.height = 34;
    paintStar(f, 20, 31, POSES.stand, false, { glow: 0, form: id });
    const im = new ImageData(40, 34);
    composite(f, im.data, null);
    c.getContext("2d").putImageData(im, 0, 0);
    b.appendChild(c);
    const lv = document.createElement("i");
    lv.textContent = "Lv" + profile.forms.owned[id].lv;
    b.appendChild(lv);
    b.addEventListener("pointerdown", (e) => { e.stopPropagation(); switchForm(id); });
    formHud.appendChild(b);
  });
  drawMedal();
}
// 左上徽章：把目前形態的主角畫進星芒圓盤
function drawMedal() {
  const fw = 40, fh = 34, f = makeFrame(fw, fh), im = new ImageData(fw, fh);
  paintStar(f, 20, 31, POSES.stand, false, { glow: 0, form: player?.form ?? profile.forms.cur });
  composite(f, im.data, null);
  const d = im.data, ox = ((MEDAL_SIZE - fw) >> 1), oy = ((MEDAL_SIZE - fh) >> 1);
  const c = medal(2, (x, y) => {
    const sx = x - ox, sy = y - oy;
    if (sx < 0 || sy < 0 || sx >= fw || sy >= fh) return null;
    const i = (sy * fw + sx) * 4;
    return d[i + 3] ? `rgb(${d[i]},${d[i + 1]},${d[i + 2]})` : null;
  });
  const cv = $("medalCv");
  cv.width = c.width; cv.height = c.height;
  cv.getContext("2d").drawImage(c, 0, 0);
}
buildFormHud();

// ---- 傳說效果：很吵的劍、加班證明
const NOISY = [
  ["系統（劍）：拜託你認真打好嗎。給你攻擊 +30%。", { atk: 0.3 }],
  ["系統（劍）：太慢了啦！攻速 +30%，快點！", { spd: 0.3 }],
  ["系統（劍）：跑起來！移速 +30%！", { move: 0.3 }],
  ["系統（劍）：……我不想講話。攻擊 +30%，自己看著辦。", { atk: 0.3 }],
];
let noisyT = 4, combatT = 0, idleT = 0;
function updateUniques(dt) {
  if (player.has("noisy") && (noisyT -= dt) <= 0) {
    noisyT = 10;
    const [line, buff] = NOISY[Math.floor(Math.random() * NOISY.length)];
    Object.assign(player.buff, { atk: 0, spd: 0, move: 0, ...buff, t: 5 });
    sayQueue.unshift([line, 2.4]);
  }
  const fighting = stageApi.alive() > 0;
  idleT = fighting ? 0 : idleT + dt;
  combatT = fighting ? combatT + dt : idleT > 3 ? 0 : combatT;
  player.dmgMul = player.has("overtime") ? 1 + Math.min(1, Math.floor(combatT / 10) * 0.05) : 1;
}

// ---- 終點前的寶箱：打完最後一場才能開
const chest = ENDLESS || TOWN || STAGE_ID === "1-4" ? null : { x: STAGE.exitX - 120, opened: false, fx: createFx(chestOpen, { x: STAGE.exitX - 120, y: FLOOR, light: 0.3 }), t: 0 };
function updateChest(dt) {
  if (!chest) return;
  if (!chest.opened) {
    if (Math.abs(player.x - chest.x) < 22 && player.grounded && !director?.lock && stageApi.alive() === 0) {
      chest.opened = true;
      chest.t = 0;
      spawn(chestOpen, { x: chest.x, y: FLOOR, light: 0.3 }, { layer: "back" });
      sfx("chest");
      flash(chest.x, FLOOR - 16, 80, 3, 1.4, "#ffd84a");
      sayQueue.unshift([profile.clears ? "系統：寶箱！……裡面應該不是垃圾吧。" : "系統：第一次通關的寶箱。我偷偷放了好東西進去。", 2.6]);
    }
    return;
  }
  const before = chest.t;
  chest.t += dt;
  // 蓋子打開後噴出三件：第一件保底稀有（第一次通關保底傳說）
  if (before < 0.7 && chest.t >= 0.7) {
    dropItem(chest.x, FLOOR - 12, R.rare, { rarity: profile.clears ? undefined : R.legend, ilvl: ilvlNow(2), dir: -1 });
    dropItem(chest.x, FLOOR - 12, R.magic, { ilvl: ilvlNow(1), dir: 1 });
    dropItem(chest.x, FLOOR - 12, R.common, { ilvl: ilvlNow(1) });
    world.dropCoins(chest.x, FLOOR - 12, 12);
  }
}

// 場景互動物件：草叢、木箱、垃圾堆、水晶（props）；小生物、垂掛物、水窪（scenery）
const scenery = createScenery({ floor: FLOOR, w: geo.w, platforms: TOWN ? [] : PLATFORMS, town: TOWN });
const props = createProps({
  floor: FLOOR, w: geo.w, platforms: TOWN ? [] : PLATFORMS, town: TOWN,
  avoid: TOWN ? [...NPCS.map((n) => n.x), 924] : [...TORCHES, STAGE.exitX - 120, STAGE.exitX + 26, STAGE.start.x, ...scenery.puddles.flatMap((p) => [p.x - p.w / 4, p.x, p.x + p.w / 4])],
});
props.onBreak = (o) => {
  world.dropCoins(o.x, o.y - 10, o.type ? 2 + Math.floor(Math.random() * 3) : 1 + Math.floor(Math.random() * 3));
  if (o.type === "crate" && Math.random() < 0.12) dropItem(o.x, o.y - 10, R.common, { ilvl: ilvlNow(0) });
};
const propMovers = () => {
  const list = [{ x: player.x, y: player.y, vx: player.vx, dash: player.state === "dash" }];
  for (const e of enemies) if (!e.dead && !e.k.fly) list.push({ x: e.x, y: e.y, vx: e.vx ?? 0 });
  return list;
};
const propView = () => ({ x0: camX, x1: camX + W });
window.__game.props = props;
window.__game.scenery = scenery;

if (!TOWN) for (const x of TORCHES) spawn(A.brazier, { x, y: FLOOR }, { layer: "back", keep: true }).update(Math.random() * 3);
if (!ENDLESS && !TOWN && STAGE_ID !== "1-4") spawn(A.portal, { x: STAGE.exitX + 26, y: FLOOR }, { layer: "back", keep: true });

// 關卡流程需要的操作
const stageApi = {
  spawnEnemy(kind, x, y) {
    const e = kind === "boss" ? new Boss(x, FLOOR, bossApi) : new Enemy(kind, x, y ?? FLOOR);
    enemies.push(e);
    world.dust(e.x, e.k.fly ? e.y + 8 : e.y, 4);
  },
  say: (msg, sec) => sayQueue.push([msg, sec]),
  hint: (msg, sec) => showHint(msg, sec),
  // 金幣史萊姆只會逃跑，不算在「清光這一波」裡
  alive: () => enemies.reduce((n, e) => n + (e.dead || e.kind === "gold" ? 0 : 1), 0),
  dropCache(x, y, n) {
    for (let i = 0; i < n; i++) coins.push({ x: x + (i - (n - 1) / 2) * 6, y: y - (i % 2) * 4, vx: 0, vy: 0, t: 0, still: true });
  },
  clear: showClear,
};

const overlaps = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
const world = {
  /** 最近的敵人；dir 給 1 或 -1 時只找那一邊的。 */
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
    props.hit(box, dir);
    scenery.hit(box, dir);
    for (const e of enemies) if (!e.dead && overlaps(box, e.box())) { e.hit(typeof dmg === "function" ? dmg() : dmg, dir, opts, world, box); n++; }
    if (n) { addCombo(n); chargeUlt(n * 0.8); }
    return n;
  },
  /** 跟 hitArea 一樣，但同一隻只打一次（hit 是記錄打過的 Set） */
  hitOnce(box, hit, dmg, dir, opts) {
    let n = 0;
    props.hit(box, dir);
    scenery.hit(box, dir);
    for (const e of enemies) if (!e.dead && !hit.has(e) && overlaps(box, e.box())) { hit.add(e); e.hit(dmg(), dir, opts, world, box); n++; }
    if (n) { addCombo(n); chargeUlt(n * 0.8); hitStop(0.05); shake(0.15, 2); }
    return n;
  },
  // 形態技能的投射物：星星＝金色星屑彈，黏液星＝綠色黏液彈（爆開範圍大、推得遠）
  spawnFireball(x, y, dir, form = "star") {
    sfx("shot", form);
    const pal = SHOT_PAL[form] ?? SHOT_PAL.star;
    shots.push({ x, y, dir, form, life: 1.1, fx: spawn(fireball, { x, y, flip: dir < 0, palette: pal.fx, light: GLOW.skill, seed: (Math.random() * 99) | 0 }) });
  },
  dropCoins(x, y, n) {
    n = Math.round(n * (1 + player.stats.gold / 100));
    for (let i = 0; i < n; i++) coins.push({ x, y, vx: (Math.random() - 0.5) * 160, vy: -120 - Math.random() * 140, t: 0 });
  },
  land(x, y, hard) { sfx("land", hard); dustFx("land", x, y, hard); props.landing(x, y, hard); scenery.landing(x, y, hard); },
  jumpDust(x, y, first) { dustFx(first ? "jump" : "double", x, y); },
  dust(x, y, n) {
    spawn(A.dust, { x: Math.round(x), y: Math.round(y), flip: Math.random() < 0.5 }, { speed: 1.8 });
  },
  onKill(e) {
    stats.kills++;
    if (stats.kills === 30) toast("系統：……你真的是零星嗎？");
    if (stats.kills === 100) toast("系統：好啦，我承認你有一點點厲害。");
    if (e.kind === "gold") toast("系統：金幣史萊姆！今晚加菜！");
    const s = player.stats;
    gainXp((KILL_XP[e.kind] ?? 5) * (e.elite ? 4 : 1));
    chargeUlt(2);
    const [coreId, coreP] = coreChance(e.kind, profile.forms);
    if (coreId && Math.random() < (e.elite ? Math.min(1, coreP * 4) : coreP)) { const b = e.box(); drops.add(makeCore(coreId), e.x, (b.y0 + b.y1) / 2); }
    if (s.life) player.hp = Math.min(player.maxHp, player.hp + s.life);
    const b = e.box(), cy = (b.y0 + b.y1) / 2;
    if (e.elite || Math.random() < (DROP_RATE[e.kind] ?? 0.1) * (1 + s.mf / 200)) dropItem(e.x, cy, e.kind === "gold" || e.elite ? R.magic : 0, { ilvl: ilvlNow(e.kind === "trash" || e.elite ? 1 : 0) });
    // 擊殺爆炸（詞綴／爆炸頭安全帽）：會連鎖，最多連 6 次
    if (s.boom && boomDepth < 6 && Math.random() * 100 < s.boom) {
      const big = player.has("hardhat") ? 1.5 : 1, rx = 34 * big;
      boomDepth++;
      spawn(explosion, { x: Math.round(e.x), y: Math.round(cy), palette: PAL.ember, accent: PAL.lava, light: GLOW.skill * 0.7, seed: (Math.random() * 99) | 0 }, { speed: 1.6 });
      flash(e.x, cy, 70, 3, 0.3, "#ff8a30");
      world.hitArea({ x0: e.x - rx, x1: e.x + rx, y0: cy - rx, y1: cy + rx }, () => player.roll(1.2), e.x < player.x ? -1 : 1, { launch: true, push: 2 });
      shake(0.2, 2);
      boomDepth--;
    }
  },
  onPlayerHurt() {
    stats.combo = 0;
    if (player.hp <= 0) {
      player.hp = player.maxHp;
      stats.deaths++;
      toast("系統：你死了。……算了，當我沒看到，再給你一次機會。");
    }
  },
};

let boomDepth = 0;

// ---- 王（1-4）：給 boss.js 用的操作、畫面下方的血條、大招橫幅
if (STAGE_ID === "1-4") prepareBoss();   // 先把王的動畫烘好，開打時才不會卡
const bossBar = $("bossBar"), bossFill = $("bossFill"), bossLag = $("bossLag");
const bossApi = {
  player,
  get lock() { return director?.lock ?? { l: WALL, r: LEVEL_W - WALL }; },
  platforms: { top: PLATFORMS[2] },
  hurt: (dmg, fromX) => player.hurt(dmg, fromX, world),
  say: (msg, sec) => sayQueue.unshift([msg, sec]),
  line: (msg, sec) => toast(msg, sec),
  spawnSlime: (x) => stageApi.spawnEnemy("slime", x),
  dropCoins: (x, y, n) => world.dropCoins(x, y, n),
  dropLoot(x, y) {
    spawn(chestOpen, { x: Math.round(x), y: FLOOR, light: 0.3 }, { layer: "back" });
    dropItem(x, y, R.rare, { rarity: profile.cleared["1-4"] ? undefined : R.legend, ilvl: ilvlNow(3), dir: -1 });
    dropItem(x, y, R.rare, { ilvl: ilvlNow(2), dir: 1 });
    dropItem(x, y, R.magic, { ilvl: ilvlNow(2) });
  },
  absorb() {
    gainXp(160);
    sayQueue.unshift(["系統：吸收了大胃王吞下去的星星碎片！……你又亮了一點點。", 3]);
  },
  bar(k, phase) {
    bossBar.classList.add("on");
    bossFill.style.width = k * 100 + "%";
    bossLag.style.width = k * 100 + "%";
    bossBar.dataset.phase = phase;
    if (k <= 0) setTimeout(() => bossBar.classList.remove("on"), 1200);
  },
  ult(name) {
    const el = $("bossUlt");
    el.textContent = name;
    el.classList.remove("on"); void el.offsetWidth; el.classList.add("on");
    $("bossDim").classList.remove("on"); void $("bossDim").offsetWidth; $("bossDim").classList.add("on");
  },
};

// ================= 城鎮：碎星鎮 =================
// 公會等級：完成的任務數
const RANKS = [["F", 0], ["E", 3], ["D", 8], ["C", 15], ["B", 25], ["A", 40], ["S", 60]];
function rankOf(done) { let r = "F"; for (const [n, need] of RANKS) if (done >= need) r = n; return r; }
const nextRank = (done) => RANKS.find(([, need]) => need > done);

/** 換場景：存檔、淡出、重新載入 */
const AUTO_KEY = "zero-hero-auto";
function goScene(next, stageId) {
  save(profile, true);
  sessionStorage.setItem(NEXT_KEY, next);
  if (stageId) sessionStorage.setItem(STAGE_KEY, stageId);
  sessionStorage.setItem(AUTO_KEY, "1");   // 下一個場景直接開始，不再顯示「點擊開始」
  $("fade").classList.add("on");
  setTimeout(() => location.replace(location.pathname), 380);   // 拿掉網址上的開發用參數
}

let prevAtk = false, near = null, busy = false;
const folk = TOWN ? createFolk(FLOOR) : null;   // 路人
window.__game.folk = folk;
if (TOWN) {
  spawn(frogFx, { x: 548, y: FLOOR, seed: 3, light: 0.2 }, { keep: true, layer: "back" });
}
function townArrive() {
  if (profile.guild.rankUp) {
    toast(`系統：公會等級升到 ${profile.guild.rankUp} 級！`, 3);
    delete profile.guild.rankUp;
    save(profile);
  } else toast("碎星鎮", 2);
  if (!profile.guild.registered) sayQueue.push(["系統：這裡是碎星鎮。先去左邊的冒險者公會登記吧。", 3.2]);
}
function townTick(dt) {
  updateLight(dt);
  if (!dialog.open && !busy) {
    // 城鎮不能戰鬥：攻擊鍵＝對話，技能、大招不能用
    const atk = input.attack;
    input.attack = false;
    consume("skill"); consume("ult");
    player.update(dt, world);
    player.x = Math.max(20, Math.min(TOWN_W - 20, player.x));
    props.update(dt, propMovers(), propView());
  scenery.update(dt, player, propView());
    folk.update(dt, player.x);
    near = nearby(player.x) ?? folk.nearby(player.x);
    if (atk && !prevAtk && near && player.grounded) interact(near);
    prevAtk = atk;
  } else { player.vx = 0; prevAtk = true; }
  drops.update(dt, player, 16, pickUp);
  updateFx(dt);
  const want = player.x - W / 2 + player.face * 30;
  camX += (want - camX) * Math.min(1, 5 * dt);
  camX = Math.max(0, Math.min(TOWN_W - W, camX));
  updateSay(dt);
  updateBubble(dt);
}
// 路人泡泡：畫面裡的居民偶爾自言自語（不能是正在旁邊可以對話的那個，頭上已經有「！」）
const AMBIENT = {
  clerk: ["（推眼鏡）今天的委託也很多呢。", "請排隊……啊，只有你一個。", "公會的茶，是我泡的。……喝嗎？"],
  golem: ["……（鏘）", "……碎屑。越多越好。", "……爐子，今天很旺。"],
  mushroom: ["今天的湯是蘑菇湯～不是親戚喔。", "累了就來休息吧～", "頭上的孩子們又長高了呢～"],
};
const bubbleEl = $("bubble"), bubbleText = $("bubbleText");
let bubbleWho = null, bubbleT = 0, bubbleWait = 3;
function updateBubble(dt) {
  if (dialog.open || busy) { bubbleEl.classList.remove("on"); bubbleWho = null; return; }
  if (bubbleWho) {
    if ((bubbleT -= dt) <= 0 || bubbleWho === near || bubbleWho === near?.folk) { bubbleEl.classList.remove("on"); bubbleWho = null; bubbleWait = 5 + Math.random() * 4; }
  } else if ((bubbleWait -= dt) <= 0) {
    const seen = [...NPCS, ...folk.list.filter((o) => !o.follow)].filter((n) => n !== near && n !== near?.folk && n.x > camX + 20 && n.x < camX + W - 20);
    if (seen.length) {
      bubbleWho = seen[Math.floor(Math.random() * seen.length)];
      const L = AMBIENT[bubbleWho.id] ?? FOLK_INFO[bubbleWho.id].ambient;
      bubbleText.textContent = L[Math.floor(Math.random() * L.length)];
      bubbleEl.classList.add("on");
      bubbleT = 3.2;
    } else bubbleWait = 2;
  }
  if (bubbleWho) {
    // 世界座標 → 螢幕座標（畫布有放大）
    const r = canvas.getBoundingClientRect(), k = r.width / W, sr = $("stage").getBoundingClientRect();
    const head = FLOOR - npcSize(bubbleWho.id)[1] - 4;
    bubbleEl.style.left = r.left - sr.left + (bubbleWho.x - camX) * k + "px";
    bubbleEl.style.top = r.top - sr.top + head * k + "px";
  }
}
// 可以對話時，頭上出現一個跳動的「！」
function drawPrompt() {
  if (!near || dialog.open) return;
  const bob = Math.floor(sceneClock * 4) % 2, x0 = Math.round(near.x) - frame.ox - 1, y0 = (near.place === "sign" ? 140 : FLOOR - (near.h ?? npcSize(near.id)[1]) - 12) - bob - frame.oy;
  const C1 = hex("#ffd84a") >>> 0, C0 = hex("#2a1626") >>> 0;
  for (let y = -1; y <= 9; y++) for (let x = -1; x <= 3; x++) {
    const on = x >= 0 && x <= 2 && ((y >= 0 && y <= 5) || (y >= 7 && y <= 8)) && (x === 1 || y <= 5);
    const px = x0 + x, py = y0 + y;
    if (px < 0 || py < 0 || px >= frame.w || py >= frame.h) continue;
    if (on) frame.color[py * frame.w + px] = C1;
  }
  for (let y = 0; y <= 8; y++) if (y !== 6) { const px = x0 + 1, py = y0 + y; if (px >= 0 && py >= 0 && px < frame.w && py < frame.h) frame.color[py * frame.w + px] = C1; }
  void C0;
  showHint(document.body.classList.contains("touch") ? `點「攻擊」和${near.name}說話` : `J＝和${near.name}說話`, 0.2);
}
async function interact(n) {
  busy = true;
  try {
    if (n.folk) { n.folk.talking = true; await talk(n.name, folk.lines(n.folk)); n.folk.talking = false; }
    else if (n.place === "guild") await guild(n.name);
    else if (n.place === "workshop") await workshop(n.name);
    else if (n.place === "inn") await inn(n.name);
    else await talk("路標", ["「往 墜星之谷 →」", "系統：要出發的話，先去公會接任務。……沒有任務就跑去打怪，公會不給錢的。"]);
  } finally { busy = false; }
}
async function guild(name) {
  const G = profile.guild;
  if (!G.registered) {
    await talk(name, ["歡迎來到冒險者公會碎星鎮分部。我是櫃檯的波波。", "要登記冒險者嗎？請在這裡填寫……種族？"]);
    await talk("系統", ["填「發光的五角形」應該就好。"]);
    await talk(name, ["……好的，星星族。", "這是你的冒險者證，等級 F。完成任務就會升級喔。", "（推眼鏡）別擔心，大家一開始都是 F。……大部分的人啦。"]);
    G.registered = true;
    save(profile, true);
  }
  const rank = rankOf(G.done), nr = nextRank(G.done);
  const QUEST_NOTE = { "1-1": "清光狂化魔物", "1-2": "垃圾桶怪大量出沒", "1-3": "蝙蝠群、菁英出沒", "1-4": "王：大胃王史萊姆" };
  const v = await ask(name, `冒險者等級 ${rank}　已完成任務 ${G.done} 個。今天要接什麼任務？`, [
    ...unlocked().reverse().map((id) => [`討伐：${id} ${LAYOUTS[id].name}（${QUEST_NOTE[id]}）${profile.cleared[id] ? "" : "　NEW"}`, "stage:" + id]),
    ["練功：無限討伐（打到你手痠為止）", "endless"],
    ["問問升級的事", "rank"],
    ["先不用", null],
  ]);
  if (v?.startsWith?.("stage:")) {
    const id = v.slice(6);
    G.quest = id;
    await talk(name, [{ "1-1": "任務受理。墜星之谷的狂化魔物越來越多了，請小心。", "1-2": "垃圾山……那裡的垃圾桶會咬人喔。真的。", "1-3": "蝙蝠洞窟很暗。……啊，你會發光，那沒事了。", "1-4": "……大胃王。牠把墜星之谷的垃圾全吃光了，還在變大。拜託你了。" }[id]]);
    goScene("stage", id);
  }
  else if (v === "endless") { await talk(name, ["無限討伐不算正式任務，不過掉的東西都歸你。"]); goScene("endless"); }
  else if (v === "rank") await talk(name, [nr ? `再完成 ${nr[1] - G.done} 個任務就能升到 ${nr[0]} 級。` : "你已經是 S 級了。……公會的天花板，就是你。", "升級後能接更難的任務，去更遠的地方。"]);
}
async function workshop(name) {
  const core = profile.equip.weapon, p = core.plus ?? 0, scrap = 3 + p * 3, gold = 20 + p * 25;
  const opts = [["整理背包、拆解裝備", "bag"]];
  if (p < 10) opts.push([`強化星核 +${p} → +${p + 1}（${scrap} 碎屑、${gold} 金幣）`, "up"]);
  opts.push(["沒事", null]);
  const v = await ask(name, `……要打什麼？（身上：${profile.scrap} 碎屑、${profile.coins} 金幣）`, opts);
  if (v === "bag") inv.show();
  else if (v === "up") {
    if (profile.scrap < scrap || profile.coins < gold) return talk(name, ["……材料不夠。去打點垃圾回來拆。"]);
    profile.scrap -= scrap;
    profile.coins -= gold;
    core.plus = p + 1;
    refreshStats();
    flash(404, FLOOR - 20, 70, 3, 0.6, "#ff9a40");
    shake(0.2, 2);
    await talk(name, [`（鏘、鏘、鏘）……好了。星核 +${p + 1}。`, p + 1 >= 7 ? "……再敲下去，我的手會裂開。" : "下次再來。"]);
  }
}
const INN_CHAT = [
  "以前這裡只是隕石坑旁邊的小村子。星星掉下來以後，冒險者就變多了。",
  "野外的史萊姆會咬人？哎呀，我家隔壁的史萊姆很乖的。是那些碎片害的啦。",
  "岩叔看起來很兇，其實他會偷偷幫小孩修玩具喔。",
  "波波每天都推眼鏡推一千次。我數過。",
  "你是星星族？那你晚上會發光嗎？省電耶。",
];
async function inn(name) {
  const v = await ask(name, "哎呀，歡迎光臨～要休息一下嗎？", [["休息（回滿血、存檔）", "rest"], ["聊天", "chat"], ["不用了", null]]);
  if (v === "rest") {
    player.hp = player.maxHp;
    save(profile, true);
    $("fade").classList.add("on");
    await new Promise((r) => setTimeout(r, 500));
    $("fade").classList.remove("on");
    await talk(name, ["睡得好嗎？生命全滿，也幫你存好檔了。"]);
  } else if (v === "chat") await talk(name, [INN_CHAT[Math.floor(Math.random() * INN_CHAT.length)]]);
}
const SHOT_PAL = {
  star: { fx: PAL.gold, boom: PAL.gold, accent: PAL.holy, light: "#ffd27a", r: 46, push: 3 },
  slime: { fx: PAL.poison, boom: PAL.poison, accent: PAL.leaf, light: "#7ee86a", r: 62, push: 5 },
};
// ---- 大招：打中怪會累積能量，滿了才能放
function chargeUlt(n) {
  if (ult.on || cleared) return;
  const was = ult.charge;
  ult.charge = Math.min(ULT_MAX, ult.charge + n);
  if (was < ULT_MAX && ult.charge >= ULT_MAX) toast("系統：大招集滿了！按 L（手機：星星按鈕）。", 2.2);
}
const ultHooks = {
  // 衝擊波掃到的怪：每隻只打一次
  wave(x0, x1, tx) {
    let n = 0;
    for (const e of enemies) {
      if (e.dead || ult.hitSet.has(e) || e.x < x0 || e.x > x1) continue;
      ult.hitSet.add(e);
      e.hit(player.roll(ULT_MULT * (1 + player.stats.skill / 100)), e.x < tx ? -1 : 1, { launch: true, push: 4 }, world);
      n++;
    }
    if (n) addCombo(n);
  },
  dust: (x, y) => { world.dust(x, y, 6); sfx("ultHit"); },
};
window.__game.ultFull = () => (ult.charge = ULT_MAX);
window.__game.giveCore = (id) => absorb(makeCore(id));
function addCombo(n) {
  stats.combo += n;
  stats.comboT = 2.2;
  stats.best = Math.max(stats.best, stats.combo);
  if (stats.combo >= 50 && stats.combo - n < 50) toast("系統：50 連擊！……我開始有點興奮了。");
  if (stats.combo >= 100 && stats.combo - n < 100) toast("系統：100 連擊！這不科學！");
}

// ---- 敵人生成：越打越多
let spawnT = 0, maxEnemies = 28;
window.__game.setMax = (n) => { maxEnemies = n; stats.time = 999; };
function spawnEnemies(dt) {
  stats.time += dt;
  const target = Math.min(maxEnemies, 8 + Math.floor(stats.time / 5));
  const alive = enemies.filter((e) => !e.dead).length;
  if ((spawnT -= dt) > 0 || alive >= target) return;
  spawnT = 0.35;
  let x = 0;
  for (let tries = 0; tries < 10; tries++) {
    x = camX + Math.random() * (W + 240) - 120;
    if (Math.abs(x - player.x) > 110) break;
  }
  x = Math.max(WALL + 20, Math.min(LEVEL_W - WALL - 20, x));
  const r = Math.random();
  const e = r < 0.04 ? new Enemy("gold", x, FLOOR) : r < 0.36 ? new Enemy("bat", x, 50 + Math.random() * 60) : new Enemy("slime", x, FLOOR);
  enemies.push(e);
  world.dust(e.x, e.k.fly ? e.y + 8 : e.y, 4);
}

// 同類敵人互相推開，不要疊成一坨
function separate(dt) {
  for (let i = 0; i < enemies.length; i++) {
    const a = enemies[i];
    for (let j = i + 1; j < enemies.length; j++) {
      const b = enemies[j];
      if (a.k.fly !== b.k.fly || a.isBoss || b.isBoss) continue;
      const dx = b.x - a.x, dy = b.y - a.y, min = a.k.w + b.k.w - 4;
      if (Math.abs(dx) < min && Math.abs(dy) < (a.k.fly ? 16 : 6)) {
        const push = (min - Math.abs(dx)) * 0.5 * Math.min(1, 10 * dt) * (dx >= 0 ? 1 : -1) || 0.5;
        a.x -= push;
        b.x += push;
      }
    }
  }
}

// ---- 每一步更新
function tick(dt) {
  tickInput(dt);
  if (juice.shakeT > 0) juice.shakeT -= dt;
  if (juice.freeze > 0) { juice.freeze -= dt; return; }   // 命中停頓：整個世界停住
  if (!started || inv.open) return;
  updateCombatFx(dt);
  if (TOWN) { townTick(dt); return; }

  updateLight(dt);
  if (cleared) { updateFx(dt); return; }
  // 大招進行中：世界停住，只有主角、特效和攝影機在動
  if (ult.on) {
    updateUlt(dt, player, ultHooks);
    for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].dead) enemies.splice(i, 1);
    updateFx(dt);
    followCam(dt);
    updateSay(dt);
    return;
  }
  if (input.form) { consume("form"); const c = profile.forms.carry; switchForm(c[(c.indexOf(player.form) + 1) % c.length]); }
  for (let i = 0; i < CARRY_MAX; i++) if (input["form" + (i + 1)]) { consume("form" + (i + 1)); switchForm(profile.forms.carry[i]); }
  if (input.ult && ult.charge >= ULT_MAX && player.state !== "hurt") {
    consume("ult");
    startUlt(player, director?.lock);
    sfx("ultCharge");
    return;
  }
  player.update(dt, world);
  props.update(dt, propMovers(), propView());
  scenery.update(dt, player, propView());
  updateUniques(dt);
  updateChest(dt);
  drops.update(dt, player, 16 * (1 + player.stats.magnet / 100), pickUp);
  if (ENDLESS) spawnEnemies(dt);
  else {
    stats.time += dt;
    director.update(dt, player, camX, W);
    // 戰鬥區封鎖：主角出不去
    if (director.lock) player.x = Math.max(director.lock.l + 10, Math.min(director.lock.r - 10, player.x));
  }
  for (const e of enemies) {
    if (e.dead) continue;
    e.update(dt, player, world);
    if (e.k.dmg && e.stun <= 0 && overlaps(e.box(), { x0: player.x - 8, x1: player.x + 8, y0: player.y - 22, y1: player.y }) && player.hurt(e.k.dmg, e.x, world)) {
      // 撞到人之後自己也彈開，不會黏在主角身上
      e.vx = (e.x >= player.x ? 1 : -1) * 120;
      e.stun = 0.4;
    }
  }
  separate(dt);
  for (const e of enemies) {
    if (e.dead) continue;
    // 戰鬥區封鎖時，敵人也出不去
    const lock = director?.lock;
    if (lock && (e.x < lock.l + 12 || e.x > lock.r - 12)) {
      e.x = Math.max(lock.l + 12, Math.min(lock.r - 12, e.x));
      if (e.kind === "gold") e.hopDir = -e.hopDir;
    }
    // 金幣史萊姆 10 秒沒抓到就逃走
    if (e.kind === "gold" && e.clock > 10) {
      e.dead = true;
      spawn(A.poofGold, { x: Math.round(e.x), y: Math.round(e.y) });
      sayQueue.unshift(["系統：金幣史萊姆逃走了……我的晚餐……", 2.5]);
    }
  }
  for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].dead) enemies.splice(i, 1);

  // 火球
  for (const s of shots) {
    s.x += s.dir * 290 * dt;
    s.life -= dt;
    s.fx.options.x = Math.round(s.x);
    let hit = s.life <= 0 || s.x < WALL || s.x > LEVEL_W - WALL;
    if (!hit) for (const e of enemies) if (!e.dead && overlaps(e.box(), { x0: s.x - 8, x1: s.x + 8, y0: s.y - 8, y1: s.y + 8 })) { hit = true; break; }
    if (hit) {
      s.done = true;
      s.fx.stop();
      const P = SHOT_PAL[s.form] ?? SHOT_PAL.star;
      sfx("boom");
      spawn(explosion, { x: Math.round(s.x), y: Math.round(s.y), palette: P.boom, accent: P.accent, light: GLOW.skill, seed: (Math.random() * 99) | 0 }, { speed: 1.3 });
      flash(s.x, s.y, 100, 4, 0.4, P.light);
      world.hitArea({ x0: s.x - P.r, x1: s.x + P.r, y0: s.y - 40, y1: s.y + 40 }, () => player.roll(2.4 * (1 + player.stats.skill / 100)), s.dir, { launch: true, push: P.push });
      hitStop(0.06);
      shake(0.3, 3);
    }
  }
  for (let i = shots.length - 1; i >= 0; i--) if (shots[i].done) shots.splice(i, 1);

  // 金幣：先噴出去，再被吸過來
  for (const c of coins) {
    c.t += dt;
    if (c.still) {
      // 高處的金幣：主角靠近才吸過去
      const m = 34 * (1 + player.stats.magnet / 100);
      if (Math.abs(player.x - c.x) < m && Math.abs(player.y - 12 - c.y) < m) { c.still = false; c.t = 0.45; }
      continue;
    }
    if (c.t < 0.45) {
      c.vy += 700 * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      if (c.y > FLOOR - 2) { c.y = FLOOR - 2; c.vy *= -0.45; c.vx *= 0.6; }
    } else {
      const dx = player.x - c.x, dy = player.y - 12 - c.y, d = Math.hypot(dx, dy) || 1, sp = 120 + (c.t - 0.45) * 900;
      c.x += (dx / d) * sp * dt;
      c.y += (dy / d) * sp * dt;
      if (d < 10) { c.got = true; stats.coins++; profile.coins++; if (coinSndT <= 0) { sfx("coin"); coinSndT = 0.05; } }
    }
  }
  for (let i = coins.length - 1; i >= 0; i--) if (coins[i].got) coins.splice(i, 1);

  updateFx(dt);
  if ((stats.comboT -= dt) <= 0 && stats.combo) stats.combo = 0;

  followCam(dt);
  updateSay(dt);
}
// 攝影機：跟著主角，稍微往面對的方向看
function followCam(dt) {
  const want = player.x - W / 2 + player.face * 36;
  camX += (want - camX) * Math.min(1, 5 * dt);
  camX = Math.max(0, Math.min(LEVEL_W - W, camX));
  if (director?.lock) camX = Math.max(director.lock.l, Math.min(director.lock.r - W, camX));
}

// ---- 繪製
let sceneClock = 0;
function render() {
  const [sx, sy] = shakeOffset();
  frame.ox = Math.round(camX) + sx;
  frame.oy = sy;
  frame.light.fill(0);
  // 場景光影：火把、水晶、主角、飛行中的火球、稀有以上的掉寶光柱都是光源
  sceneClock += 1 / 60;
  const lights = TOWN ? townLights(sceneClock) : sceneLights(camX, W, sceneClock);
  lights.push({ x: player.x, y: player.y - 10, r: 46, lv: 1.3, col: "#ffcf6a" });   // 星星主角自己會發光
  for (const e of enemies) e.lights?.(lights);
  for (const e of enemies) if (e.elite && !e.dead) lights.push({ x: e.x, y: e.y - 10, r: 36, lv: 1.2, col: "#ff4a3a" });
  for (const s of shots) lights.push({ x: s.x, y: s.y, r: 64, lv: 3, col: (SHOT_PAL[s.form] ?? SHOT_PAL.star).light });
  for (const d of drops.list) if (d.landed && d.item.rarity >= R.rare) lights.push({ x: d.x, y: d.y - 10, r: d.item.rarity === R.legend ? 48 : 30, lv: 2, col: RARITY[d.item.rarity].color });
  ultLights(lights);
  props.lights(lights);
  scenery.lights(lights);
  const lv = computeLight(frame, lights);
  if (TOWN) drawTown(frame, lv, sceneClock);
  else { drawLevel(frame, lv); drawAtmosphere(frame, sceneClock); }
  props.draw(frame, lv);
  scenery.draw(frame, lv, sceneClock);
  if (TOWN) { drawTownNpcs(frame, sceneClock); folk.draw(frame); drawPrompt(); }
  if (chest && !chest.opened && Math.abs(chest.x - camX - W / 2) < W) chest.fx.draw(frame);
  // 大招時：先畫怪再暗場，法陣這些背景特效畫在暗場之後才會亮
  if (!ult.on) drawFx(frame, "back");
  drops.draw(frame);
  for (const e of enemies) e.draw(frame);
  drawCoins();
  if (ult.on) { dimScene(frame); drawFx(frame, "back"); }
  player.draw(frame);
  drawFx(frame, "front");
  fxState.form = player.form;
  drawCombatFx(frame);
  drawUlt(frame);
  if (TOWN) drawTownFg(frame);
  if (director?.lock) drawBarrier(director.lock);
  if (!TOWN) drawForeground(frame);
  drawDamageNumbers(frame);   // 跳字畫在最上面，不會被前景擋住
  drawCutIn(frame);
  composite(frame, img.data, null, 0.8);   // 最後再整體壓一點發光
  postUlt(img.data);
  ctx.putImageData(img, 0, 0);
}
// 戰鬥區的邊界（重畫版）：兩道能量牆。參考 PixelFX 的 force-field、shield-block：
// 規則的菱形格紋（45° 的 1-1 階梯）慢慢往上流，內側一條實心亮邊，光點沿著亮邊往下跑。
const BAR = ["#2a1258", "#5a24a8", "#9a5af0", "#e8c8ff"].map((c) => hex(c) >>> 0), BAR_LIGHT = hex("#5a24a8") >>> 0;
let barClock = 0;
function drawBarrier(lock) {
  barClock += 1 / 60;
  const C = frame.color, L = frame.light, Wf = frame.w, scroll = Math.floor(barClock * 16);
  const put = (x, y, c, light) => {
    if (x < 0 || y < 0 || x >= Wf || y >= frame.h) return;
    C[y * Wf + x] = c;
    if (light) L[y * Wf + x] = BAR_LIGHT;
  };
  for (const [wx, side] of [[lock.l, 1], [lock.r - 1, -1]]) {
    const x0 = wx - frame.ox;
    if (x0 < -8 || x0 >= Wf + 8) continue;
    const bottom = FLOOR - frame.oy;
    for (let y = 0; y < bottom; y++) {
      const wy = y + frame.oy + scroll;
      for (let i = 0; i < 6; i++) {
        // 菱形格紋：兩組 45° 斜線交錯
        const on = (wy + i) % 6 === 0 || (wy - i + 60) % 6 === 0;
        if (on) put(x0 + side * i, y, BAR[i < 2 ? 2 : 1]);
      }
      put(x0 + side * 6, y, BAR[3], (y & 1) === 0);     // 內側亮邊
      put(x0 + side * 7, y, BAR[0]);                    // 亮邊外的一條暗邊，讓它從背景浮出來
    }
    for (let n = 0; n < 3; n++) {                       // 光點沿著亮邊往下跑
      const y = Math.floor((barClock * 70 + n * 61) % bottom);
      put(x0 + side * 5, y, BAR[3], true);
      put(x0 + side * 5, y - 1, BAR[2]);
    }
  }
}
// 金幣（重畫版）：參考 Animated Coins、Star Coin、PixelFX coin-spin。旋轉四格：正面 → 橢圓 → 側邊 → 橢圓。
// 左上亮、右下暗，外框是深棕色；正中間一道刻痕。
const COIN_PAL = { k: "#3a1e08", h: "#fff2a8", g: "#ffc83a", G: "#c07c18", H: "#6e3c10" };
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
    const x = Math.round(c.x) - frame.ox - (w >> 1), y = Math.round(c.y + (c.still ? Math.sin(stats.time * 4 + c.x) * 1.5 : 0)) - frame.oy - 3;
    spr.forEach((row, j) => row.forEach((col, i) => {
      const px = x + i, py = y + j;
      if (col && px >= 0 && py >= 0 && px < Wf && py < frame.h) Cc[py * Wf + px] = col;
    }));
    const lx = x + (w >> 1), ly = y + 3;
    if (lx >= 0 && ly >= 0 && lx < Wf && ly < frame.h) L[ly * Wf + lx] = COIN_LIGHT;
  }
}

// ---- HUD
const flashEl = $("flash"), bagDot = $("bagDot"), lvEl = $("lvText"), xpFill = $("xpFill");
function updateBagDot() {
  const up = profile.inv.some((it) => compare(it, profile.equip, profile.lv)?.better), nw = profile.inv.some((it) => it.new);
  bagDot.className = "dot" + (up ? " on" : nw ? " on new" : "");
  bagDot.textContent = up ? "▲" : nw ? "!" : "";
}
const comboEl = $("combo"), comboArt = createComboArt(comboEl), hpFill = $("hpFill"), hpText = $("hpText"), coinsEl = $("coins"), killsEl = $("kills"), fpsEl = $("fps"), cdEl = $("skillCd"), toastEl = $("toast");
const ubFill = $("ubFill"), ubBar = $("ubBar"), ultFill = $("ultFill"), btnUlt = $("btnUlt");
let toastT = 0;
const sysEl = $("sys"), sysText = $("sysTyped"), sysGhost = $("sysGhost");
let sysT = 0, sysTyping = null;
function toast(msg, sec = 3) {
  if (msg.startsWith("系統：")) {
    const text = msg.slice(3);
    sysTyping?.skip();
    sysEl.classList.remove("glitch");
    void sysEl.offsetWidth;
    sysEl.classList.add("on", "glitch");
    sysGhost.textContent = text;   // 隱形的整句先撐開大小，打字時框不會一直變寬
    sysTyping = typewriter(sysText, text, 1320, "sine");
    sysT = toastT = sec + text.length * 0.035;   // 打字的時間另外加上去，看得完
    return;
  }
  toastEl.textContent = msg;
  toastEl.classList.add("on");
  toastT = sec;
}
// 系統台詞排隊一句一句講，不會互相蓋掉
const sayQueue = [];
function updateSay() {
  if (toastT <= 0.2 && sayQueue.length) { const [m, s] = sayQueue.shift(); toast(m, s); }
}
const hintEl = $("hint");
let hintTimer = 0;
function showHint(msg, sec) {
  hintEl.textContent = msg;
  hintEl.classList.add("on");
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => hintEl.classList.remove("on"), sec * 1000);
}
function showClear() {
  cleared = true;
  const t = Math.round(stats.time), mm = Math.floor(t / 60), ss = String(t % 60).padStart(2, "0");
  $("clearStats").innerHTML = [
    ["通關時間", `${mm}:${ss}`], ["擊倒", stats.kills], ["金幣", stats.coins], ["最高連擊", stats.best], ["死亡次數", stats.deaths], ["撿到", runLoot.length + " 件"],
  ].map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join("");
  profile.clears++;
  profile.cleared[STAGE_ID] = true;
  // 公會的任務：通關＝完成
  if (profile.guild.quest) {
    const before = rankOf(profile.guild.done);
    profile.guild.done++;
    profile.guild.quest = null;
    if (rankOf(profile.guild.done) !== before) profile.guild.rankUp = rankOf(profile.guild.done);
  }
  save(profile, true);
  const got = runLoot.filter((it) => it.rarity >= R.magic).sort((a, b) => b.rarity - a.rarity);
  $("clearLoot").innerHTML = got.length
    ? got.map((it) => `<div class="slot r${it.rarity}" title="${it.name}"><img src="${iconURL(it.icon, 2)}"></div>`).join("")
    : '<span style="color:var(--dim)">這趟沒撿到魔法以上的裝備。再刷一次吧！</span>';
  if (STAGE_ID === "1-4") { $("clearLine").textContent = "第一章　墜星之谷　完。……走出洞窟，前面就是碎星鎮了。"; $("homeBtn").textContent = "走出洞窟，回碎星鎮"; }
  else $("clearLine").textContent = stats.deaths === 0 ? "系統：一次都沒死？……我收回「零星」那句話。一半。" : "系統：過是過了。死了幾次這件事，我會幫你保密的。";
  $("nextBtn").classList.toggle("hidden", ENDLESS || !nextStage());
  if (nextStage()) $("nextBtn").textContent = `下一關：${nextStage()} ${LAYOUTS[nextStage()].name}`;
  jingle("clear");
  $("clear").classList.remove("hidden");
}
$("againBtn").addEventListener("click", () => goScene(ENDLESS ? "endless" : "stage", STAGE_ID));
$("nextBtn").addEventListener("click", () => nextStage() && goScene("stage", nextStage()));
$("homeBtn").addEventListener("click", () => goScene("town"));
$("btnHome").addEventListener("click", async () => {
  if (TOWN || dialog.open || !started) return;
  if (await ask("系統", "要回碎星鎮嗎？這趟撿到的東西都會留著。", [["回城鎮", true], ["繼續打", false]])) goScene("town");
});
addEventListener("keydown", (e) => { if (e.code === "KeyH" && !TOWN && started && !dialog.open) $("btnHome").click(); });
// 聲音設定
{
  const panel = $("setPanel"), m = $("volMusic"), s = $("volSfx"), mute = $("btnMute");
  const sync = () => { m.value = Math.round(audioVol.music * 100); s.value = Math.round(audioVol.sfx * 100); $("volMusicV").textContent = m.value; $("volSfxV").textContent = s.value; mute.textContent = "全部靜音：" + (audioVol.mute ? "開" : "關"); };
  $("btnSet").addEventListener("click", () => { unlockAudio(); panel.classList.toggle("hidden"); sync(); sfx("ui"); });
  $("setClose").addEventListener("click", () => { panel.classList.add("hidden"); sfx("close"); });
  m.addEventListener("input", () => { setVolume("music", m.value / 100); sync(); });
  s.addEventListener("input", () => { setVolume("sfx", s.value / 100); sync(); sfx("coin"); });
  mute.addEventListener("click", () => { setVolume("mute", !audioVol.mute); sync(); sfx("ui"); });
  for (const el of [panel, $("btnSet")]) el.addEventListener("pointerdown", (e) => e.stopPropagation());
}
$("bagBtn2").addEventListener("click", () => inv.show());
$("btnBag").addEventListener("click", () => inv.show());
addEventListener("keydown", (e) => {
  if (!started || !["KeyI", "KeyB", "Tab"].includes(e.code)) return;
  e.preventDefault();
  if (inv.open) inv.close();
  else inv.show();
});
addEventListener("pagehide", () => save(profile, true));
const hpLag = $("hpLag"), medalEl = $("medal"), xpBar = $("xpBar"), xpText = $("xpText"), killBox = $("killBox");
let lastHp = -1, lastXp = -1, xpShowT = 0, lastKills = 0, killShowT = 0;
let coinSndT = 0;
function hud(dt) {
  coinSndT -= dt;
  const hpK = player.hp / player.maxHp;
  hpFill.style.width = hpK * 100 + "%";
  hpLag.style.width = hpK * 100 + "%";
  if (lastHp >= 0 && player.hp < lastHp - 0.5) { medalEl.classList.remove("hit"); void medalEl.offsetWidth; medalEl.classList.add("hit"); }
  lastHp = player.hp;
  medalEl.classList.toggle("low", hpK < 0.3 && player.hp > 0);
  // 經驗：有變化才浮出來 2.5 秒
  const xpKey = profile.lv * 1e6 + profile.xp;
  if (lastXp >= 0 && xpKey !== lastXp) xpShowT = 2.5;
  lastXp = xpKey;
  xpBar.classList.toggle("show", (xpShowT -= dt) > 0 || inv.open);
  xpText.textContent = profile.lv >= MAX_LV ? "MAX" : `${profile.xp}/${xpNeed(profile.lv)}`;
  // 擊倒數：打倒東西才出現幾秒
  if (stats.kills !== lastKills) { lastKills = stats.kills; killShowT = 3; }
  killBox.classList.toggle("on", (killShowT -= dt) > 0);
  hpText.textContent = Math.ceil(player.hp);
  coinsEl.textContent = profile.coins;
  lvEl.textContent = "Lv " + profile.lv;
  xpFill.style.width = (profile.lv >= MAX_LV ? 100 : (profile.xp / xpNeed(profile.lv)) * 100) + "%";
  killsEl.textContent = stats.kills;
  comboArt.update(stats.combo, stats.comboT / 2.2, dt);
  cdEl.style.height = Math.max(0, player.skillCd / player.skillMax) * 100 + "%";
  const uk = ult.charge / ULT_MAX, ready = uk >= 1 && !ult.on;
  ubFill.style.width = uk * 100 + "%";
  ultFill.style.height = (1 - uk) * 100 + "%";
  ubBar.classList.toggle("ready", ready);
  btnUlt.classList.toggle("ready", ready);
  if ((toastT -= dt) <= 0) toastEl.classList.remove("on");
  if ((sysT -= dt) <= 0) sysEl.classList.remove("on");
}

// ---- 主迴圈
let last = performance.now(), acc = 0, fpsN = 0, fpsT = 0, costMs = 0;
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  acc += dt;
  const t0 = performance.now();
  while (acc >= STEP) {
    tick(slowT > 0 ? STEP * 0.35 : STEP);
    if (!inv.open) slowT -= STEP;
    acc -= STEP;
  }
  render();
  costMs += performance.now() - t0;
  hud(dt);
  fpsN++;
  if ((fpsT += dt) >= 0.5) {
    fpsEl.textContent = `${Math.round(fpsN / fpsT)} fps · 每幀 ${(costMs / fpsN).toFixed(1)}ms · 敵人 ${enemies.length} · 特效 ${fxCount()}`;
    costMs = 0;
    fpsN = 0;
    fpsT = 0;
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
// 開發用效能測試：直接跑 n 幀（不受瀏覽器節流影響），回傳每幀平均毫秒數
window.__game.bench = (n = 300) => {
  const t0 = performance.now();
  for (let i = 0; i < n; i++) { tick(STEP); render(); }
  return +((performance.now() - t0) / n).toFixed(2);
};

// ---- 開始畫面
$("startName").textContent = ENDLESS ? "無限討伐" : `第一章　${STAGE.name}`;
$("clearName").textContent = ENDLESS ? "無限討伐" : STAGE.name;
const isTouch = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
if (isTouch) document.body.classList.add("touch");
addEventListener("touchstart", () => document.body.classList.add("touch"), { once: true });
initTouch();
function start() {
  if (started) return;
  started = true;
  unlockAudio();
  music(TOWN ? "town" : STAGE_ID === "1-4" ? null : "stage");   // 1-4 王出場大吼時才開始王戰音樂
  if (!TOWN) { $("btnHome").classList.remove("hidden"); $("btnHome").style.backgroundImage = `url(${iconURL("home", 3)})`; }
  $("start").classList.add("hidden");
  document.body.classList.add("playing");
  document.body.classList.toggle("town", TOWN);
  updateBagDot();
  const touch = document.body.classList.contains("touch");
  if (touch) {
    // 放在外框頁（iframe）裡時，全螢幕開在外框頁，換場景重新載入時就不會跳出全螢幕
    let top = window;
    try { if (window.top !== window && window.top.document) top = window.top; } catch {}
    if (!top.document.fullscreenElement) top.document.documentElement.requestFullscreen?.().then(() => top.screen.orientation?.lock?.("landscape")).catch(() => {});
  }
  if (TOWN) townArrive();
  else if (ENDLESS) toast("系統：無限模式。打到你手痠為止。");
  else director = new Director(STAGE, stageApi, touch);
}
$("startBtn").addEventListener("click", start);
// 換場景過來的：黑幕淡入、直接開始；聲音等第一次操作再解鎖（瀏覽器規定）
if (sessionStorage.getItem(AUTO_KEY)) {
  sessionStorage.removeItem(AUTO_KEY);
  const fade = $("fade");
  fade.style.transition = "none"; fade.classList.add("on");
  start();
  document.documentElement.classList.remove("auto");
  void fade.offsetWidth;   // 先讓全黑生效，再開動畫淡掉
  fade.style.transition = ""; fade.classList.remove("on");
}
for (const ev of ["pointerdown", "keydown", "touchstart"]) addEventListener(ev, unlockAudio, { capture: true, passive: true });
addEventListener("keydown", (e) => { if (!started && (e.code === "Enter" || e.code === "Space")) start(); });
// 開發用：主控台直接掉寶、加經驗
Object.assign(window.__game, { dropItem, gainXp, R });
