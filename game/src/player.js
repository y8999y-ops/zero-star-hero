// 主角：移動、跳（二段跳、可穿平台）、三連段、閃避、火球。
// 外型用 PixelFX 的骨架角色（posed），攻擊動作直接借用近戰特效的 act。
import { hex } from "../../pixelfx/src/core/index.js";
import { paintStar, POSES } from "./star.js";
import * as swordSlash from "../../pixelfx/src/fx/melee/sword-slash.js";
import * as doubleSlash from "../../pixelfx/src/fx/melee/double-slash.js";
import * as spinSlash from "../../pixelfx/src/fx/melee/spin-slash.js";
import * as heavyCleave from "../../pixelfx/src/fx/melee/heavy-cleave.js";
import * as daggerFlurry from "../../pixelfx/src/fx/melee/dagger-flurry.js";
import * as thrust from "../../pixelfx/src/fx/melee/thrust.js";
import * as spearSweep from "../../pixelfx/src/fx/melee/spear-sweep.js";
import * as hammerSmash from "../../pixelfx/src/fx/melee/hammer-smash.js";
import { input, consume } from "./input.js";
import { A, slashAnim } from "./assets.js";
import { FORMS, formMul } from "./forms.js";
import { reduction } from "./stats.js";
import { spawn, hitStop, shake } from "./fx.js";
import { groundAt, onPlatform, LEVEL_W, WALL } from "./level.js";

const RUN = 128, ACC_GROUND = 1500, ACC_AIR = 950, GRAV = 1000, MAX_FALL = 430;
const JUMP_V = -335, JUMP2_V = -295, COYOTE = 0.08;
const DASH_T = 0.19, DASH_V = 345, DASH_CD = 0.32;
const SKILL_CD = 1.1;

// 連段。每一段：特效、前搖壓縮比例、何時可以接下一段、何時結束、各下傷害（攻擊力的倍數）、攻擊範圍。
// 換形態＝換這一整組（forms.js 的 combo 指到這裡的 key；key 沿用舊的武器名）。
const COMBO_DEF = {
  sword: [
    { mod: swordSlash, wind: 0.3, cancel: 0.15, end: 0.34, dmg: [1.3], reach: 58, back: 10 },
    { mod: doubleSlash, wind: 0.3, cancel: 0.25, end: 0.42, dmg: [0.75, 1.2], reach: 64, back: 10 },
    { mod: spinSlash, wind: 0.32, cancel: 0.32, end: 0.5, dmg: [2.2], reach: 62, back: 46, launch: true },
  ],
  // 大劍：慢、重、範圍大
  greatsword: [
    { mod: swordSlash, wind: 0.6, cancel: 0.22, end: 0.42, dmg: [1.15], reach: 68, back: 16 },
    { mod: heavyCleave, wind: 0.45, cancel: 0.5, end: 0.66, dmg: [2.4], reach: 78, back: 34, launch: true },
  ],
  // 雙匕首：一套七連刺，暴擊高
  dagger: [
    { mod: daggerFlurry, wind: 0.35, cancel: 0.44, end: 0.56, dmg: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1.2], reach: 54, back: 8 },
  ],
  // 長槍：距離長，最後一下大範圍橫掃
  spear: [
    { mod: thrust, wind: 0.3, cancel: 0.16, end: 0.32, dmg: [1.25], reach: 92, back: 0 },
    { mod: thrust, wind: 0.25, cancel: 0.16, end: 0.32, dmg: [1.25], reach: 92, back: 0 },
    { mod: spearSweep, wind: 0.35, cancel: 0.3, end: 0.5, dmg: [2.1], reach: 84, back: 70, launch: true },
  ],
  // 大錘：一下砸地，全部擊飛
  hammer: [
    { mod: hammerSmash, wind: 0.4, cancel: 0.42, end: 0.62, dmg: [2.5], reach: 74, back: 36, launch: true, big: true },
  ],
};
const comboCache = {};
function comboFor(key, form = "star") {
  const ck = key + ":" + form;
  if (!comboCache[ck]) {
    comboCache[ck] = COMBO_DEF[key].map((s) => ({
      ...s,
      anim: slashAnim(s.mod, form),
      start: Math.min(0, ...s.mod.act.poses.map(([t]) => (t < 0 ? t * s.wind : 0))),   // 前搖從幾秒前開始
      hits: s.mod.act.hits,
    }));
  }
  return comboCache[ck];
}
const CHARGE_T = 0.3, CHARGE_V = 330;   // 鐵罐星的蓋子衝撞

const WHITE = hex("#f0ecff") >>> 0, GHOST = ["#8ae8ff", "#4ab0d8", "#2a6ea0", "#1c3e6a"].map((c) => hex(c) >>> 0);

export class Player {
  constructor(x, y) {
    Object.assign(this, {
      x, y, vx: 0, vy: 0, face: 1, grounded: false, coyote: 0, jumps: 0, airDash: true, dropT: 0,
      state: "move", t: 0, atk: null, step: 0, lastAtk: 9, dashCd: 0, skillCd: 0,
      hp: 100, maxHp: 100, invuln: 0, flash: 0, landT: 0, runDist: 0, clock: 0, ghosts: [], ghostAcc: 0,
      pose: POSES.stand, turnT: 0, lastFace: 0,
      critNext: false, buff: { atk: 0, spd: 0, move: 0, t: 0 }, dmgMul: 1, form: "star", formLv: 1,
    });
    this.combo = comboFor("sword", "star");
    this.setStats({ uniques: new Set(), atk: 12, maxHp: 100, def: 0, spd: 0, move: 0, crit: 8, critDmg: 60, fire: 0, skill: 0, cdr: 0 });
  }

  /** 套用裝備算出來的數值（stats.js 的 computeStats）。 */
  setStats(s) {
    const grow = s.maxHp - (this.stats?.maxHp ?? s.maxHp);
    this.stats = s;
    this.maxHp = s.maxHp;
    this.hp = Math.max(1, Math.min(this.maxHp, this.hp + Math.max(0, grow)));
    this.skillMax = SKILL_CD * (1 - s.cdr / 100);
    if (this.state === "attack") { this.state = "move"; this.atk = null; }
    this.step = 0;
  }

  has(u) { return this.stats.uniques.has(u); }

  /** 換形態：連段、技能、身體顏色一起換。 */
  setForm(id, lv) {
    this.form = id;
    this.formLv = lv;
    this.combo = comboFor(FORMS[id].combo, id);
    this.step = 0;
    if (this.state === "attack") { this.state = "move"; this.atk = null; }
  }

  /** 一下攻擊的傷害：攻擊力 × 倍率 ＋ 火焰，再算暴擊。force 是必定暴擊。 */
  roll(mult, force = false) {
    const s = this.stats, crit = force || Math.random() * 100 < s.crit;
    const dmg = (s.atk * mult * (1 + this.buff.atk) + s.fire) * this.dmgMul * formMul(this.formLv) * (crit ? 1 + s.critDmg / 100 : 1);
    return { dmg, crit };
  }

  update(dt, world) {
    this.clock += dt;
    this.t += dt;
    this.lastAtk += dt;
    this.dashCd -= dt;
    this.skillCd -= dt;
    this.invuln -= dt;
    this.flash -= dt;
    this.landT -= dt;
    this.dropT -= dt;
    this.coyote -= dt;
    this.turnT -= dt;

    // ---- 狀態切換：閃避和技能隨時可以取消攻擊
    if (input.dash && this.dashCd <= 0 && this.state !== "hurt" && (this.grounded || this.airDash)) {
      consume("dash");
      let dir = Math.sign(input.move);
      if (!dir) {
        // 沒推方向：往遠離最近敵人的方向閃
        const e = world.nearestEnemy(this.x, this.y, 140);
        dir = e ? (e.x > this.x ? -1 : 1) : this.face;
      }
      this.state = "dash";
      this.t = 0;
      this.atk = null;
      this.vx = dir * DASH_V * (this.has("slipper") ? 1.5 : 1);
      if (this.has("slipper")) this.critNext = true;
      this.vy = 0;
      if (!this.grounded) this.airDash = false;
      this.invuln = Math.max(this.invuln, DASH_T + 0.06);
      this.dashCd = DASH_CD;
    }
    if (input.skill && this.skillCd <= 0 && this.state !== "hurt" && this.state !== "dash") {
      consume("skill");
      this.aim(world);
      this.state = "cast";
      this.t = 0;
      this.atk = null;
      this.cast = false;
      this.skillCd = this.skillMax;
    }
    if (input.attack && (this.state === "move" || (this.state === "attack" && this.atk.time >= this.atk.s.cancel))) this.startAttack(world);
    if ((this.buff.t -= dt) <= 0) Object.assign(this.buff, { atk: 0, spd: 0, move: 0 });

    // ---- 各狀態
    const ctl = this.state === "move" ? 1 : this.state === "attack" ? 0.25 : 0;
    if (this.state === "dash") {
      this.vy = 0;
      if (this.t >= DASH_T) { this.state = "move"; this.vx *= 0.35; }
      this.ghostAcc += dt;
      if (this.ghostAcc > 1 / 40) { this.ghostAcc = 0; this.ghosts.push({ x: this.x, y: this.y, q: this.pose, flip: this.drawFlip(), age: 0 }); }
    } else if (this.state === "attack") {
      this.updateAttack(dt, world);
    } else if (this.state === "cast") {
      if (!this.cast && this.t >= 0.1) {
        this.cast = true;
        if (FORMS[this.form].skill === "charge") { this.state = "charge"; this.t = 0; this.chargeHit = new Set(); this.invuln = Math.max(this.invuln, CHARGE_T + 0.05); }
        else world.spawnFireball(this.x + this.face * 18, this.y - 14, this.face, this.form);
      }
      if (this.state === "cast" && this.t >= 0.28) this.state = "move";
    } else if (this.state === "charge") {
      // 鐵罐星：往前衝，路上的怪每隻打一次、擊飛
      this.vx = this.face * CHARGE_V;
      this.ghostAcc += dt;
      if (this.ghostAcc > 1 / 30) { this.ghostAcc = 0; this.ghosts.push({ x: this.x, y: this.y, q: this.pose, flip: this.drawFlip(), age: 0 }); }
      world.hitOnce({ x0: this.x - 12, x1: this.x + 12, y0: this.y - 26, y1: this.y + 2 }, this.chargeHit, () => this.roll(2.2 * (1 + this.stats.skill / 100)), this.face, { launch: true, push: 4 });
      if (this.t >= CHARGE_T) { this.state = "move"; this.vx *= 0.3; }
    } else if (this.state === "hurt") {
      if (this.t >= 0.32) this.state = "move";
    }

    // ---- 水平移動
    if (this.state !== "dash" && this.state !== "hurt" && this.state !== "charge") {
      const target = input.move * RUN * (1 + this.stats.move / 100 + this.buff.move) * ctl;
      const acc = (this.grounded ? ACC_GROUND : ACC_AIR) * dt;
      this.vx += Math.max(-acc, Math.min(acc, target - this.vx));
      if (this.state === "move" && input.move) this.face = Math.sign(input.move);
    } else if (this.state === "hurt") this.vx *= 1 - 4 * dt;

    // ---- 跳、穿平台
    if (this.state === "move" || this.state === "attack") {
      if (input.drop && this.grounded && onPlatform(this.x, this.y)) {
        consume("drop");
        this.dropT = 0.22;
        this.grounded = false;
        this.y += 1;
      } else if (input.jump && (this.grounded || this.coyote > 0 || this.jumps < 2)) {
        consume("jump");
        const first = this.grounded || this.coyote > 0;
        this.vy = first ? JUMP_V : JUMP2_V;
        this.jumps = first ? 1 : 2;
        this.grounded = false;
        this.coyote = 0;
        if (this.state === "attack") { this.state = "move"; this.atk = null; }
        world.dust(this.x, this.y, first ? 5 : 8);
      }
    }
    if (!input.jumpHeld && this.vy < -150 && this.state === "move") this.vy = -150; // 短按跳得低

    // ---- 重力
    if (this.state !== "dash") {
      // 空中攻擊時懸停一下，比較好打空中的敵人
      const g = this.state === "attack" && !this.grounded && this.vy > -40 ? GRAV * 0.25 : GRAV;
      this.vy = Math.min(MAX_FALL, this.vy + g * dt);
    }
    const prevY = this.y;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.x = Math.max(WALL + 7, Math.min(LEVEL_W - WALL - 7, this.x));
    const wasGrounded = this.grounded;
    const gy = this.vy >= 0 ? groundAt(this.x, prevY, this.y, this.dropT > 0) : null;
    if (gy !== null) {
      if (!wasGrounded && this.vy > 260) { this.landT = 0.1; world.dust(this.x, gy, 6); }
      this.y = gy;
      this.vy = 0;
      this.grounded = true;
      this.jumps = 0;
      this.airDash = true;
    } else if (wasGrounded) {
      // 走出平台邊緣：給一點點時間還能起跳
      this.grounded = false;
      if (this.vy >= 0) { this.coyote = COYOTE; this.jumps = 1; }
    }

    // ---- 動畫
    // 轉身：臉朝的方向一改，先轉到正面一下再轉過去
    if (this.face !== this.lastFace) { if (this.lastFace) this.turnT = 0.09; this.lastFace = this.face; }
    this.pose = this.poseNow();
    for (const g of this.ghosts) g.age += dt;
    while (this.ghosts.length && this.ghosts[0].age > 0.22) this.ghosts.shift();
  }

  // 自動瞄準：有推方向時優先打前面；前面打不到、但背後很近有敵人，就轉身打背後
  aim(world) {
    const held = Math.abs(input.move) > 0.3 ? Math.sign(input.move) : 0;
    if (held && world.nearestEnemy(this.x, this.y - 16, 80, held)) { this.face = held; return; }
    const e = world.nearestEnemy(this.x, this.y - 16, held ? 70 : 150);
    if (e) this.face = e.x >= this.x ? 1 : -1;
    else if (held) this.face = held;
  }

  startAttack(world) {
    if (this.state !== "attack" && this.lastAtk > 0.45) this.step = 0;
    const C = this.combo, s = C[this.step % C.length];
    this.step = (this.step + 1) % C.length;
    this.aim(world);
    this.state = "attack";
    this.t = 0;
    this.atk = { s, time: s.start, spawned: false, nh: 0, flip: this.face < 0, crit: this.critNext };
    this.critNext = false;
    this.lastAtk = 0;
  }

  updateAttack(dt, world) {
    const a = this.atk, s = a.s, spd = 1 + this.stats.spd / 100 + this.buff.spd;
    a.time += dt * spd;
    this.lastAtk = 0;
    if (!a.spawned && a.time >= 0) {
      a.spawned = true;
      spawn(s.anim, { x: Math.round(this.x), y: Math.round(this.y), flip: a.flip }, { speed: spd });
      // 往前踏一步
      if (this.grounded) this.vx = this.face * 70;
    }
    for (; a.nh < s.hits.length && s.hits[a.nh].t <= a.time; a.nh++) {
      const h = s.hits[a.nh], d = this.face;
      const box = { x0: this.x - d * s.back, x1: this.x + d * s.reach, y0: this.y - 44, y1: this.y + 4 };
      if (box.x0 > box.x1) [box.x0, box.x1] = [box.x1, box.x0];
      const mult = s.dmg[a.nh] ?? s.dmg[0], force = a.crit && a.nh === 0;
      const n = world.hitArea(box, () => this.roll(mult, force), d, { launch: s.launch && a.nh === s.hits.length - 1, push: h.push ?? 2 });
      if (n) {
        hitStop(Math.min(s.big ? 0.14 : 0.11, (h.stop ?? 0.06) * (n > 3 ? 0.7 : 1)));
        shake(h.shake ?? 0.15, Math.min(s.big ? 4 : 3, (h.amp ?? 2) + (n > 4 ? 1 : 0)));
      } else if (s.big) shake(0.2, 2);   // 大錘砸空也要震
    }
    if (a.time >= s.end) { this.state = "move"; this.atk = null; }
  }

  hurt(dmg, fromX, world) {
    if (this.invuln > 0 || this.state === "dash") return false;
    dmg = Math.max(1, Math.round(dmg * (1 - reduction(this.stats.def))));
    this.hp = Math.max(0, this.hp - dmg);
    this.invuln = 0.9;
    this.flash = 0.08;
    this.state = "hurt";
    this.t = 0;
    this.atk = null;
    this.vx = (this.x >= fromX ? 1 : -1) * 170;
    this.vy = -170;
    this.grounded = false;
    hitStop(0.07);
    shake(0.25, 3);
    spawn(A.sparkRed, { x: Math.round(this.x), y: Math.round(this.y) - 6, flip: this.x < fromX });
    world.onPlayerHurt?.(dmg);
    return true;
  }

  /** 大招期間：位置由 ult.js 控制，這裡只換姿勢、讓圍巾繼續飄 */
  ultPose(q, dt) {
    this.state = "ult";
    this.atk = null;
    this.vx = this.vy = 0;
    this.clock += dt;
    this.pose = q;
  }
  endUlt() {
    this.state = "move";
    this.grounded = true;
    this.invuln = Math.max(this.invuln, 0.5);
  }

  // 星星主角的姿勢（star.js 的 POSES）
  poseNow() {
    switch (this.state) {
      case "attack": return this.attackPose();
      case "dash": case "charge": return POSES.dash;
      case "cast": return POSES.cast;
      case "hurt": return POSES.hurt;
    }
    if (this.turnT > 0 && this.state === "move") return POSES.turn;
    // 空中：上升拉長、最高點放鬆、下落越快越拉長（漸快漸慢＋擠壓伸展）
    if (!this.grounded) return this.vy < -120 ? POSES.jump : this.vy < 90 ? POSES.apex : this.vy < 300 ? POSES.fall : POSES.fallFast;
    // 落地：先壓扁，再回彈一下（跟隨）
    if (this.landT > 0) return this.landT > 0.05 ? POSES.land : POSES.landUp;
    if (Math.abs(this.vx) > 20) {
      this.runDist += Math.abs(this.vx) / 60;
      return POSES.run[Math.floor(this.runDist / 9) % 4];
    }
    return POSES.idle[Math.floor(this.clock * 8) % 8];
  }

  // 攻擊（動畫 12 原則）：預備 → 拖影格（誇張、拉長）→ 命中（壓扁，配合命中停頓）→ 跟隨（回彈過頭）→ 收。
  // 每一下用招式自己的命中時間；左右兩種刺法輪流，最後一下會擊飛的改成往上刺。
  attackPose() {
    const a = this.atk, s = a.s, hits = s.hits, t = a.time;
    const kind = (k) => (s.launch && k === hits.length - 1 ? "Up" : (this.step + k) % 2 === 0 ? "F" : "B");
    let k = 0;
    while (k + 1 < hits.length && hits[k + 1].t - 0.05 <= t) k++;
    const d = t - hits[k].t, K = kind(k);
    if (d < -0.05) return K === "B" ? POSES.windB : POSES.windF;
    if (d < 0) return POSES["smear" + K];
    if (d < 0.07) return K === "Up" ? POSES.punchUp : POSES["hit" + K];
    if (d < 0.15) return K === "B" ? POSES.followB : POSES.followF;
    return POSES.land;
  }

  drawFlip() {
    return this.atk ? this.atk.flip : this.face < 0;
  }

  draw(frame) {
    // 殘影
    // 閃避殘影：用實色剪影，越舊顏色越暗（不用半透明）
    for (const g of this.ghosts) paintStar(frame, g.x, g.y, g.q, g.flip, { form: this.form, tint: GHOST[Math.min(GHOST.length - 1, Math.floor((g.age / 0.22) * GHOST.length))] });
    if (this.invuln > 0 && this.state !== "dash" && this.state !== "ult" && Math.floor(this.clock * 20) % 2 === 0) return;
    paintStar(frame, this.x, this.y, this.pose, this.drawFlip(), { tint: this.flash > 0 ? WHITE : 0, form: this.form });
  }
}
