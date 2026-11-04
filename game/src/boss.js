// 第一章王：大胃王史萊姆（1-4 大胃王的巢穴）。外觀＝ game/fx/abyss/glutton-slime.js（使用者 2026-11-04 確認第二版）。
// 三個階段，每個招式都有預兆（參考王戰設計：預兆 0.4～0.7 秒、階段要改變行為）：
//   第一階段（100～60%）：跳躍壓地（影子＋地面衝擊波）、垃圾彈幕（輪胎彈、鐵罐拋、木板直飛）、黏液衝撞（留下減速黏液）
//   第二階段（60～30%）：生氣（冒蒸氣、預兆變快）＋吐火球（落地燒一陣）、分裂（一次）、天降垃圾（先有落點影子）
//   第三階段（30～0%）：暴食模式（全身金光、招式連發）＋大招「星屑暴食」：跳上高台大吼 → 大口吸（被吸進去會被吐出來）→
//     肚子裡的星星碎片噴出金色光束掃過地面（站平台或閃避躲）→ 累倒 3 秒（受傷 1.5 倍）
// 弱點：左邊那塊發光的星星碎片，打中 1.5 倍。打倒：融化、垃圾彈出來、碎片飛向主角被吸收、掉金幣和寶物。
// 跟一般敵人一樣放在 enemies 裡（box／hit／update／draw），主程式的接觸傷害跳過它（k.dmg = 0），撞人自己處理。
import { createFx, createFrame, clearFrame, hex } from "../../pixelfx/src/core/index.js";
import * as gluttonFx from "../fx/abyss/glutton-slime.js";
import * as fireball from "../../pixelfx/src/fx/fire/fireball.js";
import * as collectBurst from "../../pixelfx/src/fx/pickups/collect-burst.js";
import { PAL } from "../../pixelfx/src/core/index.js";
import { crop } from "./bake.js";
import { spawn, shake, hitStop } from "./fx.js";
import { flash } from "./light.js";
import { hitFx, damageFx, dustFx } from "./combatfx.js";
import { blip } from "./dialog.js";

const C = (s) => hex(s) >>> 0;
const GRAV = 900;
export const BOSS_HP = 2400;
const PHASE2 = 0.6, PHASE3 = 0.3;

// ---- 烘焙每個姿勢（第一次用到時，1-4 一載入就先烘好）
// [姿勢, 張數, 每張的秒數（有就用時間動畫）, k 從 0 到 1（沒有時間動畫時）]
const POSES = { idle: [48, 1 / 30], crouch: [8], air: [6], land: [14], inhale: [8], spit: [8], lean: [6], slide: [1], roar: [12, 1 / 30], split: [8], vacuum: [12, 1 / 30], beam: [12, 1 / 30], dizzy: [32, 1 / 30], melt: [16] };
let BAKED = null;
export function prepareBoss() {
  if (BAKED) return BAKED;
  BAKED = {};
  const [w, h] = gluttonFx.meta.size, [ox, oy] = gluttonFx.meta.origin, frame = createFrame(w, h);
  for (const [pose, [n, dt]] of Object.entries(POSES)) {
    const fx = createFx(gluttonFx, { x: ox, y: oy, pose, k: 0 }), out = [];
    for (let i = 0; i < n; i++) {
      fx.options.k = dt ? 0 : n === 1 ? 0 : i / (n - 1);
      clearFrame(frame);
      fx.draw(frame);
      out.push(crop(frame, ox, oy));
      fx.update(dt ?? 1 / 30);
    }
    BAKED[pose] = { frames: out, dt };
  }
  return BAKED;
}
// 貼一張烘焙好的圖；white＝受傷閃白（保留明暗，只是很亮）
function blitFrame(frame, s, x, y, white = 0) {
  if (!s.w) return;
  const W = frame.w, H = frame.h, Cb = frame.color, L = frame.light, bx = Math.round(x) - (frame.ox | 0), by = Math.round(y) - (frame.oy | 0);
  for (let yy = 0; yy < s.h; yy++) {
    const py = by + s.ly + yy;
    if (py < 0 || py >= H) continue;
    for (let xx = 0; xx < s.w; xx++) {
      const px = bx + s.lx + xx;
      if (px < 0 || px >= W) continue;
      const c = s.color[yy * s.w + xx], j = py * W + px;
      if (c) {
        let r = c & 255, g = (c >>> 8) & 255, b = (c >>> 16) & 255;
        if (white) { r += (255 - r) * white; g += (255 - g) * white; b += (255 - b) * white; }
        const a = (c >>> 24) / 255, d = Cb[j];
        Cb[j] = a >= 0.99 ? (0xff000000 | (b << 16) | (g << 8) | r) >>> 0 : (0xff000000 | ((b * a + ((d >>> 16) & 255) * (1 - a)) << 16) | ((g * a + ((d >>> 8) & 255) * (1 - a)) << 8) | (r * a + (d & 255) * (1 - a))) >>> 0;
      }
      if (s.light) {
        const l = s.light[yy * s.w + xx];
        if (l) { const d = L[j]; L[j] = (0xff000000 | (Math.min(255, ((d >>> 16) & 255) + ((l >>> 16) & 255)) << 16) | (Math.min(255, ((d >>> 8) & 255) + ((l >>> 8) & 255)) << 8) | Math.min(255, (d & 255) + (l & 255))) >>> 0; }
      }
    }
  }
}

// ---- 小圖（垃圾、火、星星）
const RUB = ["#121218", "#2a2a36", "#4a4a5a", "#6e6e80"].map(C), TINC = ["#2a3240", "#5e6e82", "#9aa8b8", "#d0d8e4"].map(C), RUSTC = C("#a4552a");
const WOODC = ["#3a200c", "#7a4a22", "#b07a40", "#e0aa66"].map(C), FIRE = ["#7a1a08", "#d04a10", "#ff8a2a", "#ffd060", "#fff6c0"].map(C);
const GOO = ["#1e3008", "#3a5210", "#5e7c16", "#8aaa22", "#c0dc54", "#eefcb8"].map(C), GOLD = ["#8a5a0c", "#d8a020", "#ffd84a", "#fff6c0", "#ffffff"].map(C);
const STEAM = C("#c8d0c0"), OUTC = C("#120c10");

export class Boss {
  /** api：{ player, hurt(dmg, fromX, launch), say(msg, sec), line(msg, sec), spawnSlime(x), dropCoins(x, y, n), dropLoot(x, y), absorb(x, y), bar(k, phase), ult(name), lock: {l, r}, platforms, floor } */
  constructor(x, floor, api) {
    prepareBoss();
    this.api = api;
    Object.assign(this, { kind: "boss", isBoss: true, elite: false, k: { dmg: 0, w: 26, h: 40, fly: false, coins: [0, 0] }, x, y: -80, vx: 0, vy: 0, hp: BOSS_HP, dead: false, stun: 0, flash: 0 });
    this.floor = floor;
    this.state = "intro"; this.t = 0; this.clock = 0; this.pose = "air"; this.pk = 0.5;
    this.phase = 1; this.split = false; this.ultT = 0; this.lastMove = ""; this.chain = 0;
    this.junk = []; this.fires = []; this.balls = []; this.waves = []; this.trail = []; this.rain = []; this.stars = 0;
    this.shadowX = x; this.shadowOn = true; this.beamX = null; this.dying = 0; this.shardFly = null; this.o = {};
    api.bar(1, 1);
  }
  get tm() { return this.phase === 1 ? 1 : this.phase === 2 ? 0.8 : 0.72; }   // 預兆的長短（越後面越快）
  get groundY() { return this.onTop ? this.api.platforms.top.y : this.floor; }
  box() { return { x0: this.x - 27, x1: this.x + 27, y0: this.y - 40, y1: this.y }; }
  shardPos() { return [this.x - 27, this.y - 28]; }

  // ---- 受傷
  hit(roll, dir, opts = {}, world, box) {
    if (this.state === "intro" || this.dying || this.dead) return;
    let { dmg, crit } = typeof roll === "number" ? { dmg: roll, crit: false } : roll;
    const [sx, sy] = this.shardPos();
    const weak = box && sx >= box.x0 - 3 && sx <= box.x1 + 3 && sy >= box.y0 - 3 && sy <= box.y1 + 3;
    if (weak) { dmg *= 1.5; crit = true; }
    if (this.state === "dizzy") dmg *= 1.5;
    const d = Math.max(1, Math.round(dmg * (0.9 + Math.random() * 0.2)));
    this.hp -= d;
    this.flash = 0.07;
    const b = this.box(), hx = Math.max(b.x0, Math.min(b.x1, this.api.player.x + dir * 6));
    hitFx(weak ? sx : hx, weak ? sy : this.y - 22, dir, weak || opts.launch || crit);
    if (weak) { flash(sx, sy, 40, 2.5, 0.15, "#ffd84a"); blip(2093, "triangle"); }
    damageFx(this, this.x, b.y0 - 4, d, { crit, heavy: opts.launch });
    this.api.bar(Math.max(0, this.hp) / BOSS_HP, this.phase);
    if (this.hp <= 0) this.startDeath();
  }

  // ---- 每一格
  update(dt, player, world) {
    this.clock += dt; this.t += dt; this.flash -= dt;
    const P = this.api.player;
    this.updateHazards(dt, P);
    if (this.dying) return this.updateDeath(dt, P);
    if (this.state !== "intro" && this.state !== "ult") this.ultT += dt;
    // 階段切換
    const k = this.hp / BOSS_HP;
    if (this.phase === 1 && k <= PHASE2 && this.state === "idle") { this.phase = 2; this.api.bar(k, 2); return this.go("roar", { next: "idle", say: "系統：牠生氣了。……你剛剛是不是戳到牠的肚子？" }); }
    if (this.phase === 2 && k <= PHASE3 && this.state === "idle") { this.phase = 3; this.api.bar(k, 3); this.ultT = 99; this.api.say("系統：那個光……牠把星星吃掉了？！小心，你也是星星。", 3); }
    if (!this.split && k <= 0.5 && this.state === "idle") { this.split = true; return this.go("split"); }
    const fn = this["s_" + this.state];
    if (fn) fn.call(this, dt, P);
    // 撞到主角（在地上滑、壓下來的時候比較痛）
    if (this.state !== "intro" && this.state !== "dizzy" && overlap(this.box(), { x0: P.x - 7, x1: P.x + 7, y0: P.y - 20, y1: P.y })) {
      const dmg = this.state === "slide" ? 14 : this.state === "jump" && this.vy > 0 ? 18 : 8;
      this.api.hurt(dmg, this.x);
    }
  }
  go(state, o = {}) { this.state = state; this.t = 0; this.o = o; if (o.say) this.api.say(o.say, 2.6); }

  // 開場：從上面掉下來 → 落地震動 → 大吼 → 嗆聲
  s_intro(dt) {
    if (this.y < this.floor) {
      this.vy += GRAV * dt; this.y += this.vy * dt; this.pose = "air"; this.pk = 0.6;
      if (this.y >= this.floor) { this.y = this.floor; this.landFx(true); this.t = 0; }
      return;
    }
    if (this.t < 0.8) { this.pose = "land"; this.pk = this.t / 1.2; return; }
    if (this.t < 2.2) {
      this.pose = "roar";
      if (!this.roared) { this.roared = true; shake(0.9, 3); blip(110, "sawtooth"); this.api.line("大胃王：一顆小星星也想挑戰本大爺？……正好，飯後甜點。", 3.2); }
      return;
    }
    this.api.say("系統：牠說的沒錯。但你可以讓牠閉嘴。", 2.8);
    this.go("idle", { wait: 0.8 });
  }
  // 換階段時的大吼
  s_roar() { this.pose = "roar"; if (!this.o.shook) { this.o.shook = true; shake(0.9, 3); blip(100, "sawtooth"); } if (this.t > 1.2) this.go("idle", { wait: 0.4 }); }
  // 待機：等一下再出招
  s_idle(dt, P) {
    this.pose = "idle";
    if (this.t < (this.o.wait ?? 0.9 * this.tm)) return;
    if (this.phase === 3 && this.ultT > 25) return this.go("ultJump");
    if (this.chain > 0) { this.chain--; return this.go(this.lastMove === "slam" ? "crouch" : "inhale", { kind: "junk" }); }
    const moves = this.phase === 1 ? ["slam", "barrage", "slide"] : ["slam", "barrage", "slide", "fire", "rain"];
    let m;
    do m = moves[Math.floor(Math.random() * moves.length)]; while (m === this.lastMove && moves.length > 1);
    this.lastMove = m;
    if (this.phase === 3 && (m === "slam" || m === "barrage")) this.chain = m === "slam" ? 2 : 1;   // 暴食模式：連發
    if (m === "slam") this.go("crouch");
    else if (m === "barrage") this.go("inhale", { kind: "junk" });
    else if (m === "fire") this.go("inhale", { kind: "fire" });
    else if (m === "slide") this.go("lean");
    else if (m === "rain") this.go("crouch", { rain: true });
  }

  // ---- 跳躍壓地（天降垃圾也是先壓地）
  s_crouch(dt, P) {
    const T = (this.o.rain ? 0.35 : 0.6) * this.tm;
    this.pose = "crouch"; this.pk = Math.min(1, this.t / T);
    if (!this.o.rain) { this.shadowOn = true; this.shadowX = this.clampX(P.x); }
    if (this.t >= T) {
      const tx = this.o.rain ? this.x : this.clampX(P.x), air = this.o.rain ? 0.45 : 0.8;
      this.vx = (tx - this.x) / air; this.vy = -GRAV * air / 2; this.shadowX = tx;
      this.go("jump", { rain: this.o.rain });
    }
  }
  s_jump(dt) {
    this.vy += GRAV * dt; this.x += this.vx * dt; this.y += this.vy * dt;
    this.pose = "air"; this.pk = Math.min(1, this.t / 0.8);
    if (this.y >= this.groundY && this.vy > 0) {
      this.y = this.groundY; this.vx = 0; this.shadowOn = false;
      this.landFx(true);
      // 地面衝擊波往兩邊跑
      for (const d of [-1, 1]) this.waves.push({ x: this.x + d * 28, d, life: 1.4 });
      if (this.o.rain) this.startRain(this.api.player);
      this.go("land");
    }
  }
  s_land() { this.pose = "land"; this.pk = Math.min(1, this.t / 1.2); if (this.t > 0.8) this.go("idle"); }   // 落地後卡住一下＝攻擊時機

  // ---- 吸氣 → 吐（垃圾彈幕／火球）
  s_inhale(dt) {
    const T = (this.o.kind === "fire" ? 0.6 : 0.7) * this.tm;
    this.pose = "inhale"; this.pk = Math.min(1, this.t / T);
    if (this.t >= T) { this.spitOut(this.o.kind); this.go("spit"); }
  }
  s_spit() { this.pose = "spit"; this.pk = Math.min(1, this.t / 0.5); if (this.t > 0.5) this.go("idle"); }
  spitOut(kind) {
    const P = this.api.player, mx = this.x, my = this.y - 18, dir = P.x >= this.x ? 1 : -1;
    blip(kind === "fire" ? 180 : 140, "square");
    if (kind === "fire") {
      const a0 = Math.atan2(P.y - 12 - my, P.x - mx);
      for (const da of [0, -0.35, 0.35]) {
        const a = a0 + da, sp = 170;
        this.balls.push({ x: mx, y: my, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, fx: spawn(fireball, { x: mx, y: my, flip: Math.cos(a) < 0, palette: PAL.ember, light: 0.6, seed: (Math.random() * 99) | 0 }) });
      }
      return;
    }
    // 垃圾：輪胎（在地上彈）、鐵罐（拋物線）、木板（直直飛）
    const types = ["tire", "can", "plank", "can", "tire"];
    types.forEach((type, i) => {
      const spread = (i - 2) * 0.18;
      const j = type === "tire" ? { vx: dir * (110 + i * 25), vy: -160 } : type === "can" ? { vx: dir * (70 + i * 30), vy: -320 + i * 20 } : { vx: dir * 230, vy: -40 + spread * 60 };
      this.junk.push({ type, x: mx + dir * 10, y: my, ...j, life: 3.5, rot: 0, bounces: type === "tire" ? 3 : 0 });
    });
  }

  // ---- 黏液衝撞：往後縮 → 滑過去
  s_lean(dt, P) {
    const T = 0.5 * this.tm;
    this.pose = "lean"; this.pk = Math.min(1, this.t / T);
    if (this.t >= T) { this.dir = P.x >= this.x ? 1 : -1; this.go("slide"); blip(90, "sawtooth"); }
  }
  s_slide(dt) {
    this.pose = "slide";
    this.x += this.dir * 250 * dt;
    if (Math.floor(this.clock * 30) % 2) this.trail.push({ x: this.x - this.dir * 20, life: 3.5 });
    const { l, r } = this.api.lock;
    if (this.x <= l + 34 || this.x >= r - 34) { this.x = Math.max(l + 34, Math.min(r - 34, this.x)); shake(0.25, 2); this.landFx(false); this.go("land"); }
  }

  // ---- 分裂：身上鼓包 → 吐出 3 隻小史萊姆
  s_split(dt) {
    this.pose = "split"; this.pk = Math.min(1, this.t / 1);
    if (this.t >= 1 && !this.o.done) {
      this.o.done = true;
      for (const d of [-1, 0, 1]) this.api.spawnSlime(this.clampX(this.x + d * 40));
      flash(this.x, this.y - 20, 70, 2, 0.3, "#c0dc54"); shake(0.2, 2);
      this.api.say("系統：分裂了？！……不對，那是牠吃太飽吐出來的。好噁。", 2.6);
    }
    if (this.t > 1.4) this.go("idle");
  }

  // ---- 大招：星屑暴食
  s_ultJump(dt) {
    // 跳上中間的高台
    const top = this.api.platforms.top;
    if (this.t === dt || !this.o.started) {
      this.o.started = true;
      const air = 0.9, tx = top.x + top.w / 2;
      this.vx = (tx - this.x) / air; this.vy = (top.y - this.y) / air - GRAV * air / 2; this.shadowOn = false;
    }
    this.vy += GRAV * dt; this.x += this.vx * dt; this.y += this.vy * dt; this.pose = "air"; this.pk = 0.5;
    if (this.vy > 0 && this.y >= top.y) { this.y = top.y; this.onTop = true; this.vx = 0; this.landFx(true); this.go("ultRoar"); }
  }
  s_ultRoar() {
    this.pose = "roar";
    if (!this.o.shown) { this.o.shown = true; this.api.ult("星屑暴食"); shake(1.2, 3); blip(80, "sawtooth"); flash(this.x, this.y - 20, 120, 3, 0.8, "#ffd84a"); }
    if (this.t > 1.3) this.go("vacuum");
  }
  s_vacuum(dt, P) {
    this.pose = "vacuum";
    const mx = this.x, dx = mx - P.x, dist = Math.abs(dx);
    // 往嘴巴拉：越近拉越大力；閃避中拉不動
    const pull = (70 + Math.max(0, 160 - dist) * 0.6) * (P.state === "dash" ? 0.25 : 1);
    P.x += Math.sign(dx) * pull * dt;
    if (Math.random() < 0.6) this.sucks = (this.sucks ?? 0) + 1;
    if (dist < 16) {
      // 被吸進去 → 吐出來
      if (this.api.hurt(30, mx - Math.sign(dx) * 10, true)) {
        P.vx = (P.x >= mx ? 1 : -1) * 300; P.vy = -340;
        this.api.say("系統：被吸進去了……又被吐出來了。……你被嫌難吃了耶。", 2.8);
        blip(70, "square");
      }
      return this.go("beam");
    }
    if (this.t > 3) this.go("beam");
  }
  s_beam(dt) {
    this.pose = "beam";
    const { l, r } = this.api.lock, T = 2.4, from = this.o.from ?? (this.o.from = this.api.player.x < this.x ? l + 20 : r - 20), to = from < this.x ? r - 20 : l + 20;
    if (this.t < 0.5) { this.beamX = null; return; }   // 肚子先亮 0.5 秒（預兆）
    const k = Math.min(1, (this.t - 0.5) / T);
    this.beamX = from + (to - from) * k;
    const P = this.api.player;
    if (P.y >= this.floor - 2 && Math.abs(P.x - this.beamX) < 9) this.api.hurt(25, this.beamX);
    if (Math.random() < 0.5) shake(0.05, 1);
    if (k >= 1) { this.beamX = null; this.go("ultDown"); }
  }
  s_ultDown(dt) {
    if (!this.o.started) { this.o.started = true; this.onTop = false; this.vx = (this.api.platforms.top.x + this.api.platforms.top.w / 2 + 50 * (Math.random() < 0.5 ? -1 : 1) - this.x) / 0.7; this.vy = -120; }
    this.vy += GRAV * dt; this.x += this.vx * dt; this.y += this.vy * dt; this.pose = "air"; this.pk = 0.8;
    if (this.vy > 0 && this.y >= this.floor) { this.y = this.floor; this.vx = 0; this.landFx(true); this.ultT = 0; this.go("dizzy"); this.api.say("系統：牠累倒了！現在！打牠！", 2.4); }
  }
  s_dizzy() { this.pose = "dizzy"; this.stars += 1; if (this.t > 3) this.go("idle"); }

  // ---- 打倒
  startDeath() {
    this.dying = 0.001; this.state = "dying"; this.t = 0; this.beamX = null; this.onTop = false;
    this.junk.length = 0; this.balls.forEach((b) => b.fx.stop()); this.balls.length = 0; this.rain.length = 0;
    hitStop(0.25); shake(0.8, 4); flash(this.x, this.y - 20, 140, 3.5, 1, "#fff6c0"); blip(60, "sawtooth");
    this.api.say("系統：倒了……牠倒了！", 2.4);
  }
  updateDeath(dt, P) {
    if (this.y < this.floor) { this.vy = (this.vy || 0) + GRAV * dt; this.y = Math.min(this.floor, this.y + this.vy * dt); }
    this.dying += dt;
    this.pose = "melt"; this.pk = Math.min(1, this.dying / 2.4);
    // 肚子裡的垃圾一件一件彈出來、金幣噴出來
    if (this.dying > 0.6 && !this.popped) { this.popped = true; for (let i = 0; i < 6; i++) this.junk.push({ type: ["tire", "can", "plank"][i % 3], x: this.x, y: this.y - 16, vx: (Math.random() - 0.5) * 260, vy: -260 - Math.random() * 120, life: 1.6, rot: 0, bounces: 1, harmless: true }); this.api.dropCoins(this.x, this.y - 20, 40); }
    if (this.dying > 1.4 && !this.dropped) { this.dropped = true; this.api.dropLoot(this.x, this.y - 16); }
    // 碎片飛向主角
    if (this.dying > 2.0 && !this.shardFly) { const [sx, sy] = this.shardPos(); this.shardFly = { x: sx, y: sy, t: 0 }; }
    if (this.shardFly && !this.shardFly.done) {
      const s = this.shardFly; s.t += dt;
      const k = Math.min(1, s.t / 0.9), tx = P.x, ty = P.y - 12;
      s.x += (tx - s.x) * Math.min(1, dt * (2 + k * 10)); s.y += (ty - s.y) * Math.min(1, dt * (2 + k * 10)) - Math.sin(k * Math.PI) * 30 * dt;
      if (Math.hypot(tx - s.x, ty - s.y) < 6 || s.t > 1.6) { s.done = true; spawn(collectBurst, { x: Math.round(tx), y: Math.round(ty), palette: GOLD_P, light: 0.6 }); flash(tx, ty, 90, 3, 0.6, "#ffd84a"); this.api.absorb(); }
    }
    if (this.dying > 4.2) this.dead = true;
  }

  // ---- 天降垃圾
  startRain(P) {
    const { l, r } = this.api.lock, xs = [P.x];
    while (xs.length < 6) { const x = l + 30 + Math.random() * (r - l - 60); if (xs.every((q) => Math.abs(q - x) > 34)) xs.push(x); }
    xs.forEach((x, i) => this.rain.push({ x, t: -i * 0.12, type: ["tire", "can", "plank"][i % 3] }));
    if (!this.rainSaid) this.api.say("系統：上面！天花板的管子在掉垃圾！", 2.2);
    this.rainSaid = true;
  }

  // ---- 飛行物、地上的危險
  updateHazards(dt, P) {
    const fl = this.floor, { l, r } = this.api.lock;
    const hitP = (x, y, rad, dmg) => { if (Math.abs(P.x - x) < rad + 6 && P.y - 20 < y + rad && P.y > y - rad) this.api.hurt(dmg, x); };
    for (const j of this.junk) {
      j.life -= dt; j.vy += GRAV * 0.8 * dt; j.x += j.vx * dt; j.y += j.vy * dt; j.rot += dt * (j.vx > 0 ? 12 : -12);
      if (j.y >= fl - 3) {
        j.y = fl - 3;
        if (j.bounces > 0) { j.vy = -Math.abs(j.vy) * 0.55; j.bounces--; dustFx("land", j.x, fl); }
        else { j.life = Math.min(j.life, 0.25); j.vx *= 0.5; j.vy = 0; }
      }
      if (j.x < l + 4 || j.x > r - 4) j.life = 0;
      if (!j.harmless && j.life > 0.3) hitP(j.x, j.y, 4, 10);
    }
    this.junk = this.junk.filter((j) => j.life > 0);
    for (const b of this.balls) {
      b.vy += 120 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.fx.options.x = Math.round(b.x); b.fx.options.y = Math.round(b.y);
      if (b.y >= fl - 4 || b.x < l || b.x > r) { b.done = true; b.fx.stop(); if (b.y >= fl - 4) this.fires.push({ x: b.x, life: 2 }); flash(b.x, fl - 6, 50, 2, 0.2, "#ff8a2a"); }
      else if (Math.abs(P.x - b.x) < 9 && Math.abs(P.y - 10 - b.y) < 12) { b.done = true; b.fx.stop(); this.api.hurt(12, b.x); }
    }
    this.balls = this.balls.filter((b) => !b.done);
    for (const f of this.fires) { f.life -= dt; if (P.y >= fl - 2 && Math.abs(P.x - f.x) < 9) this.api.hurt(8, f.x); }
    this.fires = this.fires.filter((f) => f.life > 0);
    for (const w of this.waves) { w.life -= dt; w.x += w.d * 170 * dt; if (P.grounded && P.y >= fl - 2 && Math.abs(P.x - w.x) < 6) this.api.hurt(10, w.x - w.d * 10); if (w.x < l + 6 || w.x > r - 6) w.life = 0; }
    this.waves = this.waves.filter((w) => w.life > 0);
    for (const s of this.trail) s.life -= dt;
    this.trail = this.trail.filter((s) => s.life > 0);
    if (P.grounded && this.trail.some((s) => Math.abs(s.x - P.x) < 6)) P.vx *= 0.82;   // 黏液：走起來很慢
    for (const q of this.rain) {
      q.t += dt;
      if (q.t > 0.8 && !q.fell) { const y = -20 + (q.t - 0.8) * 420; if (y >= fl - 4) { q.fell = true; q.land = 0.3; dustFx("land", q.x, fl, true); shake(0.1, 1); } else if (Math.abs(P.x - q.x) < 9 && Math.abs(P.y - 10 - y) < 12) { q.fell = true; q.land = 0.3; this.api.hurt(12, q.x); } }
      if (q.fell) q.land -= dt;
    }
    this.rain = this.rain.filter((q) => !q.fell || q.land > 0);
  }

  landFx(big) {
    dustFx("land", this.x - 20, this.y, true); dustFx("land", this.x + 20, this.y, true);
    shake(big ? 0.35 : 0.2, big ? 3 : 2); hitStop(big ? 0.05 : 0.02);
    flash(this.x, this.y - 10, 60, 1.5, 0.2, "#c0dc54");
    blip(big ? 70 : 100, "triangle");
  }
  clampX(x) { const { l, r } = this.api.lock; return Math.max(l + 36, Math.min(r - 36, x)); }

  // ---- 光
  lights(list) {
    if (this.dead) return;
    const [sx, sy] = this.shardPos();
    if (!this.dying) list.push({ x: sx, y: sy, r: 30, lv: 1.4, col: "#ffd84a" });
    if (this.phase === 3 && !this.dying) list.push({ x: this.x, y: this.y - 20, r: 70, lv: 1.2 + 0.4 * Math.sin(this.clock * 6), col: "#ffd84a" });
    if (this.phase === 2 && !this.dying) list.push({ x: this.x, y: this.y - 20, r: 50, lv: 0.6, col: "#ff6a3a" });
    if (this.beamX != null) { list.push({ x: this.beamX, y: this.floor - 6, r: 60, lv: 3, col: "#ffd84a" }); list.push({ x: this.x, y: this.y - 18, r: 50, lv: 2.4, col: "#fff6c0" }); }
    for (const f of this.fires) list.push({ x: f.x, y: this.floor - 6, r: 30, lv: 1.2 * Math.min(1, f.life), col: "#ff8a2a" });
    if (this.shardFly && !this.shardFly.done) list.push({ x: this.shardFly.x, y: this.shardFly.y, r: 40, lv: 2.5, col: "#ffd84a" });
  }

  // ---- 畫
  draw(frame) {
    if (this.dead) return;
    const W = frame.w, H = frame.h, Cb = frame.color, ox = frame.ox | 0, oy = frame.oy | 0, fl = this.floor;
    const put = (x, y, c) => { const sx = Math.round(x) - ox, sy = Math.round(y) - oy; if (sx >= 0 && sy >= 0 && sx < W && sy < H) Cb[sy * W + sx] = c; };
    const dark = (x, y, k) => { const sx = Math.round(x) - ox, sy = Math.round(y) - oy; if (sx < 0 || sy < 0 || sx >= W || sy >= H) return; const i = sy * W + sx, c = Cb[i]; Cb[i] = (0xff000000 | ((((c >>> 16) & 255) * k) << 16) | ((((c >>> 8) & 255) * k) << 8) | ((c & 255) * k)) >>> 0; };
    const shadow = (x, y, rx, k) => { for (let dx = -rx; dx <= rx; dx++) { const h = Math.round(Math.sqrt(1 - (dx / (rx + 0.5)) ** 2) * 2); for (let dy = -h; dy <= 0; dy++) dark(x + dx, y + dy, k); } };
    // 地上：黏液、火、衝擊波、落點影子、壓地的影子
    for (const s of this.trail) for (let dx = -5; dx <= 5; dx++) { put(s.x + dx, fl - 1, GOO[s.life > 1 ? 3 : 2]); if ((dx + Math.floor(this.clock * 8)) % 7 === 0) put(s.x + dx, fl - 2, GOO[5]); }
    for (const f of this.fires) for (let i = 0; i < 6; i++) { const h = 2 + ((i * 7 + Math.floor(this.clock * 14)) % 4); for (let y = 0; y < h; y++) put(f.x - 3 + i, fl - 1 - y, FIRE[Math.min(4, 4 - y + (i % 2))]); }
    for (const w of this.waves) for (let i = -4; i <= 4; i++) { const h = Math.round(4 * (1 - Math.abs(i) / 5)); for (let y = 0; y < h; y++) put(w.x + i * w.d * -1, fl - 1 - y, GOO[y === h - 1 ? 5 : 3]); }
    for (const q of this.rain) if (!q.fell) shadow(q.x, fl - 1, 6 + Math.round(Math.max(0, q.t) * 3), 0.55);
    if (this.shadowOn && (this.state === "crouch" || this.state === "jump") && !this.o.rain) shadow(this.shadowX, fl - 1, 26, 0.5);
    // 光束（在王後面先畫一條，從嘴到地上）
    if (this.beamX != null) {
      const x0 = this.x, y0 = this.y - 18, x1 = this.beamX, y1 = fl - 2, n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
      for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n; for (let w = -2; w <= 2; w++) put(x + w, y, Math.abs(w) < 1 ? GOLD[4] : Math.abs(w) < 2 ? GOLD[3] : GOLD[2]); }
      for (let i = 0; i < 8; i++) { const a = this.clock * 20 + i, rr = 3 + (i % 3) * 2; put(x1 + Math.cos(a) * rr, y1 - Math.abs(Math.sin(a)) * rr, GOLD[3 + (i % 2)]); }
    }
    // 王本體
    const anim = BAKED[this.pose] ?? BAKED.idle, n = anim.frames.length;
    const i = anim.dt ? Math.floor(this.clock / anim.dt) % n : Math.round(Math.min(1, this.pk) * (n - 1));
    blitFrame(frame, anim.frames[i], this.x, this.y + 1, this.flash > 0 ? 0.7 : this.state === "dizzy" ? 0 : 0);
    // 第二階段：頭頂冒蒸氣；第三階段：身上的金光粒子
    if (!this.dying && this.phase >= 2) for (let k = 0; k < 4; k++) { const a = (this.clock * 0.9 + k * 0.25) % 1, x = this.x - 16 + k * 11 + Math.sin(a * 6 + k) * 2, y = this.y - 44 - a * 18; if (this.phase === 2) { if (a < 0.8) put(x, y, STEAM); } else { put(x, y + 10, GOLD[3]); if (a < 0.5) put(x + 1, y + 10, GOLD[2]); } }
    // 累倒：頭上轉星星
    if (this.state === "dizzy") for (let k = 0; k < 3; k++) { const a = this.clock * 4 + k * 2.1, x = this.x + Math.cos(a) * 16, y = this.y - 50 + Math.sin(a) * 4; put(x, y, GOLD[3]); put(x - 1, y, GOLD[2]); put(x + 1, y, GOLD[2]); put(x, y - 1, GOLD[2]); put(x, y + 1, GOLD[2]); }
    // 吸入：風的線條往嘴巴跑
    if (this.state === "vacuum") for (let k = 0; k < 10; k++) { const a = (this.clock * 1.6 + k * 0.1) % 1, side = k % 2 ? 1 : -1, x = this.x + side * (140 * (1 - a) + 10), y = this.y - 18 + ((k * 13) % 30 - 15) * (1 - a); for (let q = 0; q < 4; q++) put(x - side * q * 2, y, q < 2 ? C("#e8f4e0") : C("#8aa890")); }
    // 飛行的垃圾、落下的垃圾
    for (const j of this.junk) drawJunk(put, j.type, j.x, j.y, j.rot);
    for (const q of this.rain) if (q.t > 0.8 && !q.fell) drawJunk(put, q.type, q.x, -20 + (q.t - 0.8) * 420, q.t * 8);
    // 被吸收的碎片
    if (this.shardFly && !this.shardFly.done) { const s = this.shardFly; for (const [dx, dy, c] of [[0, -3, 4], [-1, -2, 3], [0, -2, 4], [1, -2, 3], [-2, -1, 2], [-1, -1, 3], [0, -1, 4], [1, -1, 3], [2, -1, 2], [-1, 0, 2], [0, 0, 3], [1, 0, 2], [0, 1, 2]]) put(s.x + dx, s.y + dy, GOLD[c]); }
  }
}
const GOLD_P = ["#8a5a0c", "#d8a020", "#ffd84a", "#fff6c0", "#ffffff"];

function overlap(a, b) { return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0; }
// 垃圾小圖：輪胎（轉的時候輻條跟著轉）、鐵罐（翻滾）、木板（旋轉的一條）
function drawJunk(put, type, x, y, rot) {
  x = Math.round(x); y = Math.round(y);
  if (type === "tire") {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.hypot(dx, dy); if (d > 4.3) continue; put(x + dx, y + dy, d > 3.4 ? OUTC : d > 2.2 ? RUB[dx + dy < 0 ? 3 : 2] : d > 1.2 ? RUB[1] : RUB[0]); }
    const a = rot; put(x + Math.round(Math.cos(a) * 2), y + Math.round(Math.sin(a) * 2), RUB[3]);
  } else if (type === "can") {
    const flip = Math.floor(rot * 2) % 2;
    const [w, h] = flip ? [6, 4] : [4, 6];
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) { const edge = dx === 0 || dy === 0 || dx === w - 1 || dy === h - 1; put(x - (w >> 1) + dx, y - (h >> 1) + dy, edge ? OUTC : (flip ? dx === 2 : dy === 2) ? RUSTC : TINC[(flip ? dy : dx) === 1 ? 3 : 2]); }
  } else {
    const c = Math.cos(rot), s = Math.sin(rot);
    for (let i = -5; i <= 5; i++) { put(x + Math.round(i * c), y + Math.round(i * s), WOODC[2]); put(x + Math.round(i * c - s), y + Math.round(i * s + c), WOODC[1]); }
  }
}
