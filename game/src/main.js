// 遊戲主程式：關卡 1-1（教學、四場戰鬥、出口）。網址加 ?endless 是無限出怪的測試模式。
import { createFrame, composite, hex, PAL } from "../../pixelfx/src/core/index.js";
import * as fireball from "../../pixelfx/src/fx/fire/fireball.js";
import * as explosion from "../../pixelfx/src/fx/explosions/plasma-explosion.js";
import { A, GLOW } from "./assets.js";
import { input, tickInput, initTouch, consume } from "./input.js";
import { drawLevel, drawForeground, drawAtmosphere, sceneLights, LEVEL_W, FLOOR, H, TORCHES, WALL } from "./level.js";
import { computeLight, flash, updateLight } from "./light.js";
import { spawn, updateFx, drawFx, juice, hitStop, shake, shakeOffset, fxCount } from "./fx.js";
import { Player } from "./player.js";
import { Enemy } from "./enemies.js";
import { Director, STAGE_1_1 } from "./stage.js";
import * as levelUpFx from "../../pixelfx/src/fx/ui/level-up.js";
import * as chestOpen from "../../pixelfx/src/fx/pickups/chest-open.js";
import * as collectBurst from "../../pixelfx/src/fx/pickups/collect-burst.js";
import { createFx } from "../../pixelfx/src/core/index.js";
import { load, save, BAG_SIZE } from "./save.js";
import { computeStats, compare, xpNeed, MAX_LV } from "./stats.js";
import { makeItem, rollRarity, R, RARITY, JUNK } from "./items.js";
import { Drops, feed } from "./loot.js";
import { createInventory } from "./inventory.js";
import { installUiArt, iconURL, setAttackIcon } from "./ui-art.js";
import { ult, ULT_MAX, ULT_MULT, startUlt, updateUlt, ultLights, dimScene, drawUlt, drawCutIn, postUlt } from "./ult.js";

installUiArt();
const ENDLESS = new URLSearchParams(location.search).has("endless");
const STAGE = STAGE_1_1;

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
const player = ENDLESS ? new Player(200, FLOOR) : new Player(STAGE.start.x, STAGE.start.y);
const enemies = [];
const coins = [];
const shots = [];
const stats = { coins: 0, kills: 0, combo: 0, comboT: 0, best: 0, time: 0, deaths: 0 };
let camX = 0, started = false, director = null, cleared = false;

// ---- 存檔與刷寶
const profile = load();
const drops = new Drops();
const runLoot = [];   // 這一趟撿到的東西（通關畫面顯示）
let slowT = 0;        // 傳說掉落時的慢動作
function refreshStats() {
  player.setStats(computeStats(profile.equip, profile.lv));
  setAttackIcon(profile.equip.weapon.icon);
  save(profile);
  updateBagDot();
}
player.setStats(computeStats(profile.equip, profile.lv));
setAttackIcon(profile.equip.weapon.icon);
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
  const item = makeItem(opts.ilvl ?? ilvlNow(), r, { prefer: s.wtype, ...opts });
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
  if (it.rarity >= R.rare) spawn(collectBurst, { x: Math.round(player.x), y: Math.round(player.y) - 10, palette: it.rarity === R.legend ? PAL.ember : ["#1e1206", "#4a2c08", "#86520c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff"], light: 0.4 });
  save(profile);
  updateBagDot();
  return true;
}

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
const chest = ENDLESS ? null : { x: STAGE.exitX - 120, opened: false, fx: createFx(chestOpen, { x: STAGE.exitX - 120, y: FLOOR, light: 0.3 }), t: 0 };
function updateChest(dt) {
  if (!chest) return;
  if (!chest.opened) {
    if (Math.abs(player.x - chest.x) < 22 && player.grounded && !director?.lock && stageApi.alive() === 0) {
      chest.opened = true;
      chest.t = 0;
      spawn(chestOpen, { x: chest.x, y: FLOOR, light: 0.3 }, { layer: "back" });
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

for (const x of TORCHES) spawn(A.brazier, { x, y: FLOOR }, { layer: "back", keep: true }).update(Math.random() * 3);
if (!ENDLESS) spawn(A.portal, { x: STAGE.exitX + 26, y: FLOOR }, { layer: "back", keep: true });

// 關卡流程需要的操作
const stageApi = {
  spawnEnemy(kind, x, y) {
    const e = new Enemy(kind, x, y ?? FLOOR);
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
    for (const e of enemies) if (!e.dead && overlaps(box, e.box())) { e.hit(typeof dmg === "function" ? dmg() : dmg, dir, opts, world); n++; }
    if (n) { addCombo(n); chargeUlt(n * 0.8); }
    return n;
  },
  spawnFireball(x, y, dir) {
    shots.push({ x, y, dir, life: 1.1, fx: spawn(fireball, { x, y, flip: dir < 0, light: GLOW.skill, seed: (Math.random() * 99) | 0 }) });
  },
  dropCoins(x, y, n) {
    n = Math.round(n * (1 + player.stats.gold / 100));
    for (let i = 0; i < n; i++) coins.push({ x, y, vx: (Math.random() - 0.5) * 160, vy: -120 - Math.random() * 140, t: 0 });
  },
  dust(x, y, n) {
    spawn(A.dust, { x: Math.round(x), y: Math.round(y), flip: Math.random() < 0.5 }, { speed: 1.8 });
  },
  onKill(e) {
    stats.kills++;
    if (stats.kills === 30) toast("系統：……你真的是零星嗎？");
    if (stats.kills === 100) toast("系統：好啦，我承認你有一點點厲害。");
    if (e.kind === "gold") toast("系統：金幣史萊姆！今晚加菜！");
    const s = player.stats;
    gainXp(KILL_XP[e.kind] ?? 5);
    chargeUlt(2);
    if (s.life) player.hp = Math.min(player.maxHp, player.hp + s.life);
    const b = e.box(), cy = (b.y0 + b.y1) / 2;
    if (Math.random() < (DROP_RATE[e.kind] ?? 0.1) * (1 + s.mf / 200)) dropItem(e.x, cy, e.kind === "gold" ? R.magic : 0, { ilvl: ilvlNow(e.kind === "trash" ? 1 : 0) });
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
    comboEl.classList.remove("on");
    if (player.hp <= 0) {
      player.hp = player.maxHp;
      stats.deaths++;
      toast("系統：你死了。……算了，當我沒看到，再給你一次機會。");
    }
  },
};

let boomDepth = 0;
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
  dust: (x, y) => world.dust(x, y, 6),
};
window.__game.ultFull = () => (ult.charge = ULT_MAX);
function addCombo(n) {
  stats.combo += n;
  stats.comboT = 2.2;
  stats.best = Math.max(stats.best, stats.combo);
  if (stats.combo >= 50 && stats.combo - n < 50) toast("系統：50 連擊！……我開始有點興奮了。");
  if (stats.combo >= 100 && stats.combo - n < 100) toast("系統：100 連擊！這不科學！");
  comboEl.classList.add("on");
  comboEl.classList.remove("bump");
  void comboEl.offsetWidth;
  comboEl.classList.add("bump");
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
      if (a.k.fly !== b.k.fly) continue;
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
  if (input.ult && ult.charge >= ULT_MAX && player.state !== "hurt") {
    consume("ult");
    startUlt(player, director?.lock);
    return;
  }
  player.update(dt, world);
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
      // 用不含純白的火焰色，爆炸才不會整片白光
      spawn(explosion, { x: Math.round(s.x), y: Math.round(s.y), palette: PAL.ember, accent: PAL.lava, light: GLOW.skill, seed: (Math.random() * 99) | 0 }, { speed: 1.3 });
      flash(s.x, s.y, 100, 4, 0.4, "#ff8a30");
      world.hitArea({ x0: s.x - 46, x1: s.x + 46, y0: s.y - 40, y1: s.y + 40 }, () => player.roll(2.4 * (1 + player.stats.skill / 100)), s.dir, { launch: true, push: 3 });
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
      if (d < 10) { c.got = true; stats.coins++; profile.coins++; }
    }
  }
  for (let i = coins.length - 1; i >= 0; i--) if (coins[i].got) coins.splice(i, 1);

  updateFx(dt);
  if ((stats.comboT -= dt) <= 0 && stats.combo) { stats.combo = 0; comboEl.classList.remove("on"); }

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
  const lights = sceneLights(camX, W, sceneClock);
  lights.push({ x: player.x, y: player.y - 10, r: 46, lv: 1.3, col: "#ffcf6a" });   // 星星主角自己會發光
  for (const s of shots) lights.push({ x: s.x, y: s.y, r: 64, lv: 3, col: "#ff6a20" });
  for (const d of drops.list) if (d.landed && d.item.rarity >= R.rare) lights.push({ x: d.x, y: d.y - 10, r: d.item.rarity === R.legend ? 48 : 30, lv: 2, col: RARITY[d.item.rarity].color });
  ultLights(lights);
  drawLevel(frame, computeLight(frame, lights));
  drawAtmosphere(frame, sceneClock);
  if (chest && !chest.opened && Math.abs(chest.x - camX - W / 2) < W) chest.fx.draw(frame);
  // 大招時：先畫怪再暗場，法陣這些背景特效畫在暗場之後才會亮
  if (!ult.on) drawFx(frame, "back");
  drops.draw(frame);
  for (const e of enemies) e.draw(frame);
  drawCoins();
  if (ult.on) { dimScene(frame); drawFx(frame, "back"); }
  player.draw(frame);
  drawFx(frame, "front");
  drawUlt(frame);
  if (director?.lock) drawBarrier(director.lock);
  drawForeground(frame);
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
const $ = (id) => document.getElementById(id);
const flashEl = $("flash"), bagDot = $("bagDot"), lvEl = $("lvText"), xpFill = $("xpFill");
function updateBagDot() {
  const up = profile.inv.some((it) => compare(it, profile.equip, profile.lv)?.better), nw = profile.inv.some((it) => it.new);
  bagDot.className = "dot" + (up ? " on" : nw ? " on new" : "");
  bagDot.textContent = up ? "▲" : nw ? "!" : "";
}
const comboEl = $("combo"), hpFill = $("hpFill"), hpText = $("hpText"), coinsEl = $("coins"), killsEl = $("kills"), fpsEl = $("fps"), cdEl = $("skillCd"), toastEl = $("toast");
const ubFill = $("ubFill"), ubBar = $("ubBar"), ultFill = $("ultFill"), btnUlt = $("btnUlt");
let toastT = 0;
function toast(msg, sec = 3) {
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
  save(profile, true);
  const got = runLoot.filter((it) => it.rarity >= R.magic).sort((a, b) => b.rarity - a.rarity);
  $("clearLoot").innerHTML = got.length
    ? got.map((it) => `<div class="slot r${it.rarity}" title="${it.name}"><img src="${iconURL(it.icon, 2)}"></div>`).join("")
    : '<span style="color:var(--dim)">這趟沒撿到魔法以上的裝備。再刷一次吧！</span>';
  $("clearLine").textContent = stats.deaths === 0 ? "系統：一次都沒死？……我收回「零星」那句話。一半。" : "系統：過是過了。死了幾次這件事，我會幫你保密的。";
  $("clear").classList.remove("hidden");
}
$("againBtn").addEventListener("click", () => { save(profile, true); location.reload(); });
$("bagBtn2").addEventListener("click", () => inv.show());
$("btnBag").addEventListener("click", () => inv.show());
addEventListener("keydown", (e) => {
  if (!started || !["KeyI", "KeyB", "Tab"].includes(e.code)) return;
  e.preventDefault();
  if (inv.open) inv.close();
  else inv.show();
});
addEventListener("pagehide", () => save(profile, true));
function hud(dt) {
  hpFill.style.width = (player.hp / player.maxHp) * 100 + "%";
  hpText.textContent = Math.ceil(player.hp);
  coinsEl.textContent = profile.coins;
  lvEl.textContent = "Lv " + profile.lv;
  xpFill.style.width = (profile.lv >= MAX_LV ? 100 : (profile.xp / xpNeed(profile.lv)) * 100) + "%";
  killsEl.textContent = stats.kills;
  $("comboN").textContent = stats.combo;
  cdEl.style.height = Math.max(0, player.skillCd / player.skillMax) * 100 + "%";
  const uk = ult.charge / ULT_MAX, ready = uk >= 1 && !ult.on;
  ubFill.style.width = uk * 100 + "%";
  ultFill.style.height = (1 - uk) * 100 + "%";
  ubBar.classList.toggle("ready", ready);
  btnUlt.classList.toggle("ready", ready);
  if ((toastT -= dt) <= 0) toastEl.classList.remove("on");
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
const isTouch = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
if (isTouch) document.body.classList.add("touch");
addEventListener("touchstart", () => document.body.classList.add("touch"), { once: true });
initTouch();
function start() {
  if (started) return;
  started = true;
  $("start").classList.add("hidden");
  document.body.classList.add("playing");
  updateBagDot();
  const touch = document.body.classList.contains("touch");
  if (touch) {
    document.documentElement.requestFullscreen?.().then(() => screen.orientation?.lock?.("landscape")).catch(() => {});
  }
  if (ENDLESS) toast("系統：無限模式。打到你手痠為止。");
  else director = new Director(STAGE, stageApi, touch);
}
$("startBtn").addEventListener("click", start);
addEventListener("keydown", (e) => { if (!started && (e.code === "Enter" || e.code === "Space")) start(); });
// 開發用：主控台直接掉寶、加經驗
Object.assign(window.__game, { dropItem, gainXp, R });
