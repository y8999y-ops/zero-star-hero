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
import { ELEM } from "./status.js";
import { rank } from "./skilltree.js";
import { reduction } from "./stats.js";
import { spawn, hitStop, shake } from "./fx.js";
import { sfx } from "./audio.js";
import { groundAt, onPlatform, geo, WALL } from "./level.js";
import { moveX, ceilingAt, solidAt, floorAt } from "./map.js";

const RUN = 128, ACC_GROUND = 1500, ACC_AIR = 950, GRAV = 1000, MAX_FALL = 430;
const JUMP_V = -335, JUMP2_V = -295, COYOTE = 0.15;   // 郊狼時間（走出平台邊緣後還能起跳的時間）：使用者 2026-11-05 要好跳一點，0.08 → 0.15 秒
const DASH_T = 0.19, DASH_V = 345, DASH_CD = 0.32;
const SKILL_CD = 1.1;
// 魔力（使用者 2026-11-05：技能改成消耗魔力，冷卻保留）：每次技能 25，每秒回 8；最大魔力基礎 100，星之殘火加上限
// 使用者 2026-11-05：魔力自然回復降到原本的 10%（8 → 0.8／秒），主要靠連擊補（main.js addCombo：每 10 連擊 +COMBO_MP）
export const MP_COST = 25, MP_REGEN = 0.8, COMBO_MP = 10;

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
const FLY_T = 0.34, FLY_VX = 290, FLY_VY = -170;   // 蝠翼星的蝠翼飛行：往前上方飛
const GLIDE_FALL = 90;                            // 蝠翼星按住跳：慢慢滑翔

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
    this.setStats({ uniques: new Set(), atk: 12, maxHp: 100, def: 0, move: 0, crit: 0, critDmg: 10, skill: 0, ult: 0, charge: 0, cdr: 0, leech: 0, mf: 0 });
    this.leechBudget = 0;
  }

  /** 套用裝備算出來的數值（stats.js 的 computeStats）。 */
  setStats(s) {
    const grow = s.maxHp - (this.stats?.maxHp ?? s.maxHp);
    this.stats = s;
    this.maxHp = s.maxHp;
    this.hp = Math.max(1, Math.min(this.maxHp, this.hp + Math.max(0, grow)));
    this.skillMax = SKILL_CD * (1 - s.cdr / 100);
    this.maxMp = s.maxMp ?? 100;
    this.mp = Math.min(this.maxMp, this.mp ?? this.maxMp);
    if (this.state === "attack") { this.state = "move"; this.atk = null; }
    this.step = 0;
  }

  has(u) { return this.stats.uniques.has(u); }
  /** 8a：身上星核的核心效果是 id 的話回傳數值，不是回傳 0 */
  core(id) { return this.stats.core?.id === id ? this.stats.core.x : 0; }

  /** 換形態：連段、技能、身體顏色一起換。 */
  setForm(id, lv) {
    this.form = id;
    this.combo = comboFor(FORMS[id].combo, id);
    this.step = 0;
    if (this.state === "attack") { this.state = "move"; this.atk = null; }
  }

  /** 一下攻擊的傷害：攻擊力 × 倍率，再算暴擊（暴擊時 ×（1＋暴擊傷害%））。force 是必定暴擊。
   *  吸血：傷害的 leech% 回復生命，每秒最多回最大生命的 5%（leechBudget）。 */
  roll(mult, force = false) {
    const s = this.stats, crit = force || Math.random() * 100 < s.crit;
    // 星核：晨光（生命 80% 以上）、暗影（閃避後 2 秒）
    const coreMul = (this.hp >= this.maxHp * 0.8 ? 1 + this.core("dawn") / 100 : 1) * (this.shadowT > 0 ? 1 + this.core("shadow") / 100 : 1);
    const dmg = s.atk * mult * (1 + this.buff.atk) * this.dmgMul * formMul(this.formLv) * (crit ? 1 + s.critDmg / 100 : 1) * (this.kingT > 0 ? 1.2 : 1) * coreMul;
    if (s.leech > 0 && this.hp > 0) {
      // 夜宴 4 件：生命低於 30% 吸血加倍；生命滿了，多吸的變成護盾（最多最大生命的 20%）
      const feast = this.set4("feast"), k = feast && this.hp < this.maxHp * 0.3 ? 2 : 1;
      const h = Math.min(this.leechBudget, (dmg * s.leech * k) / 100);
      this.leechBudget -= h;
      const over = this.hp + h - this.maxHp;
      this.hp = Math.min(this.maxHp, this.hp + h);
      if (feast && over > 0) this.shield = Math.min(this.maxHp * 0.2, (this.shield ?? 0) + over);
    }
    return { dmg, crit };
  }

  /** 技能傷害倍率：技能傷害% ×（星辰共鳴 4 件：大招後 10 秒 +25%） */
  skillMul() { return (1 + this.stats.skill / 100) * (this.resonT > 0 ? 1.25 : 1); }
  /** 某一套穿滿 4 件了嗎 */
  set4(id) { return (this.stats.sets?.[id] ?? 0) >= 4; }

  update(dt, world) {
    this.clock += dt;
    // 特效補強 1：死掉碎成碎片到重生之間，主角藏起來、不能動
    if (this.hideT > 0) { this.hideT -= dt; this.vx = this.vy = 0; this.ghosts.length = 0; return; }
    if (this.resonT > 0) this.resonT -= dt;
    if (this.kingT > 0) this.kingT -= dt;   // 星王化（神話「星王之冠」）
    if (this.lightT > 0) this.lightT -= dt;
    if (this.filmT > 0) this.filmT -= dt;
    if (this.dentT > 0) this.dentT -= dt;
    if (this.nightT > 0) this.nightT -= dt;
    if (this.shadowT > 0) this.shadowT -= dt;
    this.meteorT = (this.meteorT ?? 0) + dt;   // 星核「隕鐵」：每 N 秒下一次技能多一顆小隕石
    if (this.doubleT > 0) this.doubleT -= dt;
    this.leechBudget = Math.min(this.maxHp * 0.05, (this.leechBudget ?? 0) + this.maxHp * 0.05 * dt);
    this.t += dt;
    this.lastAtk += dt;
    this.dashCd -= dt;
    this.skillCd -= dt;
    this.mp = Math.min(this.maxMp, this.mp + MP_REGEN * dt * (1 + (this.stats.charge ?? 0) / 100));   // 「魔力回復」（原本的充能效率）加快回魔
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
      sfx("dash");
      this.t = 0;
      this.atk = null;
      this.vx = dir * DASH_V * (this.has("slipper") ? 1.5 : 1);
      if (this.has("slipper")) this.critNext = true;
      if (this.core("shadow")) this.shadowT = 2;          // 星核「暗影」
      if (this.core("comet")) world.cometStart?.();        // 星核「彗尾」：開始留尾巴
      this.vy = 0;
      if (!this.grounded) this.airDash = false;
      this.invuln = Math.max(this.invuln, DASH_T + 0.06);
      this.dashCd = DASH_CD * (this.nightT > 0 ? 0.7 : 1);   // 夜行：衝刺冷卻 -30%
    }
    // 魔力不夠：按了沒反應，魔力條閃一下（二段飛不用魔力）
    if (input.skill && this.skillCd <= 0 && !(this.doubleT > 0) && this.mp < MP_COST && this.state !== "hurt" && this.state !== "dash") { consume("skill"); world.noMana?.(); }
    if (input.skill && (this.skillCd <= 0 || this.doubleT > 0) && this.state !== "hurt" && this.state !== "dash") {
      consume("skill");
      if (!(this.doubleT > 0)) this.mp -= MP_COST;
      this.aim(world);
      this.state = "cast";
      this.t = 0;
      this.atk = null;
      this.cast = false;
      this.skillCd = this.skillMax * (this.resonT > 0 ? 0.7 : 1);   // 星辰共鳴 4 件：冷卻 -30%
      const mt = this.core("meteor");
      if (mt && this.meteorT >= mt) { this.meteorT = 0; world.coreMeteor?.(); }
    }
    if (input.attack && (this.state === "move" || (this.state === "attack" && this.atk.time >= this.atk.s.cancel))) this.startAttack(world);
    if ((this.buff.t -= dt) <= 0) Object.assign(this.buff, { atk: 0, spd: 0, move: 0 });
    // 形態被動「黏液再生」：黏液星每秒回復 (0.9＋0.1×級)% 生命（1 級 1%、10 級 1.9%）
    if (this.form === "slime" && this.hp > 0 && this.hp < this.maxHp) { const pr = rank("slime", "p_slime"); if (pr) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * (0.009 + 0.001 * pr) * dt); }

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
        // 技能樹：加長（鐵罐星衝撞 +12%／級）、遠飛（蝠翼星飛行 +12%／級）、二段飛
        this.chargeDur = CHARGE_T * (1 + 0.12 * rank("can", "c_long"));
        this.flyDur = FLY_T * (1 + 0.12 * rank("bat", "b_far"));
        if (FORMS[this.form].skill === "charge") { this.state = "charge"; this.t = 0; this.chargeHit = new Set(); this.truck = new Set(); this.invuln = Math.max(this.invuln, this.chargeDur + 0.05); }
        else if (FORMS[this.form].skill === "flight") {
          this.state = "fly"; this.t = 0; this.chargeHit = new Set(); this.grounded = false; this.invuln = Math.max(this.invuln, this.flyDur + 0.05); sfx("dash");
          if (this.doubleT > 0) this.doubleT = 0; else this.doubleReady = !!rank("bat", "b_double");
        }
        else {
          world.spawnFireball(this.x + this.face * 18, this.y - 14, this.face, this.form);
          // 星王化＋星星：一次射 3 發（上、中、下）
          if (this.kingT > 0 && this.form === "star") for (const vy of [-70, 70]) world.spawnFireball(this.x + this.face * 18, this.y - 14, this.face, this.form, vy);
        }
      }
      if (this.state === "cast" && this.t >= 0.28) this.state = "move";
    } else if (this.state === "charge") {
      // 鐵罐星：往前衝，路上的怪每隻打一次、擊飛
      this.vx = this.face * CHARGE_V;
      this.ghostAcc += dt;
      if (this.ghostAcc > 1 / 30) { this.ghostAcc = 0; this.ghosts.push({ x: this.x, y: this.y, q: this.pose, flip: this.drawFlip(), age: 0 }); }
      world.hitOnce({ x0: this.x - 12, x1: this.x + 12, y0: this.y - 26, y1: this.y + 2 }, this.chargeHit, () => this.roll(2.2 * this.skillMul()), this.face, { launch: true, push: 4, elem: "shock" });
      // 技能樹「回收車」：路上的小怪被推著走
      if (rank("can", "c_truck")) for (const e of world.enemiesIn({ x0: this.x - 4, x1: this.x + this.face * 26, y0: this.y - 30, y1: this.y + 4 })) {
        if (e.isBoss) continue;
        this.truck.add(e); e.x = this.x + this.face * (16 + this.truck.size * 3); e.vx = this.vx; e.stun = Math.max(e.stun, 0.3);
      }
      if (this.t >= (this.chargeDur ?? CHARGE_T)) {
        this.state = "move"; this.vx *= 0.3;
        if (this.kingT > 0) this.skillCd = Math.min(this.skillCd, 0.15);   // 星王化＋鐵罐星：衝撞沒有冷卻
        if (this.truck?.size) { for (const e of this.truck) if (!e.dead) e.hit(this.roll(1.2 * this.skillMul()), this.face, { launch: true, push: 6, elem: "shock" }, world); this.truck.clear(); }
        if (rank("can", "c_brake")) world.groundSlam?.(this.x, this.y, 46, 1.2);   // 急停震地
      }
    } else if (this.state === "fly") {
      // 蝠翼星：往前上方飛，越飛越平；路上的怪每隻打一次。飛完可以再跳一次。
      this.vx = this.face * FLY_VX;
      this.vy = FLY_VY * (1 - this.t / FLY_T);
      this.ghostAcc += dt;
      if (this.ghostAcc > 1 / 30) { this.ghostAcc = 0; this.ghosts.push({ x: this.x, y: this.y, q: this.pose, flip: this.drawFlip(), age: 0 }); }
      world.hitOnce({ x0: this.x - 14, x1: this.x + 14, y0: this.y - 28, y1: this.y + 2 }, this.chargeHit, () => this.roll(1.8 * this.skillMul()), this.face, { push: 3, elem: "poison" });
      if (this.t >= (this.flyDur ?? FLY_T)) {
        this.state = "move"; this.vx *= 0.5; this.jumps = Math.min(this.jumps, 1);
        if (this.kingT > 0) this.skillCd = Math.min(this.skillCd, 0.15);   // 星王化＋蝠翼星：飛行沒有冷卻
        if (this.doubleReady) { this.doubleReady = false; this.doubleT = 1.2; }   // 二段飛：1.2 秒內可以再飛一次
      }
    } else if (this.state === "hurt") {
      if (this.t >= 0.32 * (this.hurtK ?? 1)) this.state = "move";
    }

    // ---- 水平移動
    if (this.state !== "dash" && this.state !== "hurt" && this.state !== "charge" && this.state !== "fly") {
      const target = input.move * RUN * (1 + this.stats.move / 100 + this.buff.move + (this.lightT > 0 ? 0.2 : 0) + (this.nightT > 0 ? 0.3 : 0) + (this.form === "bat" ? 0.02 * rank("bat", "p_bat") : 0)) * ctl;   // 形態被動「夜翼」：移速 +2%／級
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
        // 形態被動「夜翼」：蝠翼星跳躍高度 +1.5%／級（高度跟初速平方成正比，所以初速乘開根號）
        const jk = this.form === "bat" ? Math.sqrt(1 + 0.015 * rank("bat", "p_bat")) : 1;
        this.vy = (first ? JUMP_V : JUMP2_V) * jk;
        this.jumps = first ? 1 : 2;
        this.grounded = false;
        this.coyote = 0;
        if (this.state === "attack") { this.state = "move"; this.atk = null; }
        world.jumpDust?.(this.x, this.y, first);
        sfx(first ? "jump" : "jump2");
      }
    }
    if (this.boostT > 0) this.boostT -= dt;   // 8d：黏液菇彈起來的時候，不套用「短按跳得低」
    else if (!input.jumpHeld && this.vy < -150 && this.state === "move") this.vy = -150; // 短按跳得低

    // ---- 重力
    if (this.state !== "dash" && this.state !== "fly") {
      // 空中攻擊時懸停一下，比較好打空中的敵人（蝠翼星停得更久）
      const bat = this.form === "bat";
      const g = this.state === "attack" && !this.grounded && this.vy > -40 ? GRAV * (bat ? (rank("bat", "b_hover") ? 0.03 : 0.08) : 0.25) : GRAV;   // 懸停：停更久
      // 蝠翼星按住跳往下掉時：滑翔
      const gliding = bat && input.jumpHeld && this.state === "move" && !this.grounded && this.vy > 0;
      const cap = gliding ? (this.kingT > 0 ? 0 : GLIDE_FALL) : MAX_FALL;   // 星王化＋蝠翼星：滑翔不會往下掉
      if (gliding) world.onGlide?.(dt);   // 技能樹「蝙蝠群」
      this.vy = Math.min(cap, this.vy + g * dt);
    }
    const prevY = this.y;
    // 8b：撞牆、撞天花板（map.js）。身高 24、半寬 7
    const nx = moveX(this.x, this.x + this.vx * dt, this.y, 24, 7);
    if (nx !== this.x + this.vx * dt && this.state !== "dash") this.vx = 0;
    this.x = Math.max(7, Math.min(geo.w - 7, nx));
    this.y += this.vy * dt;
    if (this.vy < 0) { const cy = ceilingAt(this.x, prevY, this.y, 24); if (cy !== null) { this.y = cy; this.vy = 0; } }
    const wasGrounded = this.grounded;
    const gy = this.vy >= 0 ? groundAt(this.x, prevY, this.y, this.dropT > 0) : null;
    if (gy !== null) {
      if (!wasGrounded && this.vy > 260) this.landT = 0.1;
      if (!wasGrounded && this.vy > 80) world.land?.(this.x, gy, this.vy > 260);   // 草屑
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
    input.air = !this.grounded && this.jumps < 2;   // 手機：還能二段跳，點一下左半邊就跳
    this.unstick();

    // ---- 動畫
    // 轉身：臉朝的方向一改，先轉到正面一下再轉過去
    if (this.face !== this.lastFace) {
      if (this.lastFace) { this.turnT = 0.09; if (this.grounded && Math.abs(this.vx) > 40 && this.state === "move") world.skidDust?.(this.x, this.y, this.lastFace); }   // 特效補強 6：急轉身揚起灰塵（往原本跑的方向）
      this.lastFace = this.face;
    }
    // 特效補強 6：跑步時每 18px 腳後跟冒一小團灰塵
    if (this.grounded && this.state === "move" && Math.abs(this.vx) > 90) { this.stepAcc = (this.stepAcc ?? 0) + Math.abs(this.vx) * dt; if (this.stepAcc > 18) { this.stepAcc = 0; world.stepDust?.(this.x - Math.sign(this.vx) * 4, this.y); } }
    this.pose = this.poseNow();
    for (const g of this.ghosts) g.age += dt;
    while (this.ghosts.length && this.ghosts[0].age > 0.22) this.ghosts.shift();
  }

  // 自動瞄準：有推方向時優先打前面；前面打不到、但背後很近有敵人，就轉身打背後
  /** 使用者 2026-11-06「1-1 二段跳那邊掉出地圖外」：大招（黏黏大海嘯等）會直接把主角放到某個位置，
   *  放在牆邊的話身體會卡進地形裡，腳底找不到地面就一路掉出地圖。卡進去的時候推回最近的空位（先左右、再往上） */
  unstick() {
    const inside = (x, y) => solidAt(x, y - 3) || solidAt(x, y - 12);
    if (!inside(this.x, this.y) && this.y <= geo.h) return;
    for (let d = 1; d <= 40; d++) for (const s of [-1, 1]) {
      const x = this.x + s * d;
      if (x > 7 && x < geo.w - 7 && !inside(x, this.y) && !solidAt(x + s * 6, this.y - 6) && this.y <= geo.h) { this.x = x; return; }
    }
    for (let up = 8; up <= 96; up += 8) if (!inside(this.x, this.y - up)) { this.y = floorAt(this.x, this.y - up); this.vy = 0; return; }
    this.y = floorAt(this.x, 0); this.vy = 0;   // 真的找不到：放到這一欄最上面的地面
  }
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
    const a = this.atk, s = a.s, spd = 1 + this.buff.spd;
    a.time += dt * spd;
    this.lastAtk = 0;
    if (!a.spawned && a.time >= 0) {
      a.spawned = true;
      spawn(s.anim, { x: Math.round(this.x), y: Math.round(this.y), flip: a.flip }, { speed: spd });
      sfx("swing", this.form);
      // 往前踏一步
      if (this.grounded) this.vx = this.face * 70;
    }
    for (; a.nh < s.hits.length && s.hits[a.nh].t <= a.time; a.nh++) {
      const h = s.hits[a.nh], d = this.face;
      // 技能樹：長角（黏液星，普攻距離每級 +8%）、銳角（星星，普攻傷害每級 +5%）
      const reach = s.reach * (this.form === "slime" ? 1 + 0.08 * rank("slime", "g_horn") : 1) * (1 + this.core("long") / 100);   // 星核「細長」
      const box = { x0: this.x - d * s.back, x1: this.x + d * reach, y0: this.y - 44, y1: this.y + 4 };
      if (box.x0 > box.x1) [box.x0, box.x1] = [box.x1, box.x0];
      const mult = (s.dmg[a.nh] ?? s.dmg[0]) * (this.form === "star" ? 1 + 0.05 * rank("star", "s_edge") : this.form === "bat" ? 1 + 0.04 * rank("bat", "b_claw") : 1), force = a.crit && a.nh === 0;
      // 連段最後一下會沾上形態的元素（星星燃燒、黏液星黏液、鐵罐星帶電、蝠翼星毒）；黏液角：黏液星每一下都沾
      const fin = s.launch && a.nh === s.hits.length - 1;
      const finMul = fin ? 1 + this.core("rust") / 100 : 1;   // 星核「鏽蝕終擊」
      const coat = fin || (this.form === "slime" && rank("slime", "g_coat"));
      const push = (h.push ?? 2) * (this.form === "can" ? 1 + 0.1 * rank("can", "c_weight") : 1) * (1 + this.core("heavy") / 100);   // 重量、星核「沉重」
      const n = world.hitArea(box, () => this.roll(mult * finMul, force), d, { launch: fin, push, elem: coat ? ELEM[this.form] : null, fling: this.core("heavy") > 0 });
      if (fin && this.form === "can" && rank("can", "c_quake")) world.groundSlam?.(this.x + d * 18, this.y, 54, 0.6);   // 震波
      if (fin && this.form === "star") {
        if (rank("star", "s_wave")) world.spawnWave?.(this.x + d * 10, this.y - 16, d);   // 星光斬
        if (rank("star", "s_light")) this.lightT = 2;                                     // 收招輕盈
      }
      if (n) {
        hitStop(Math.min(s.big ? 0.14 : 0.11, (h.stop ?? 0.06) * (n > 3 ? 0.7 : 1)));
        shake(h.shake ?? 0.15, Math.min(s.big ? 4 : 3, (h.amp ?? 2) + (n > 4 ? 1 : 0)));
      } else if (s.big) shake(0.2, 2);   // 大錘砸空也要震
    }
    if (a.time >= s.end) { this.state = "move"; this.atk = null; }
  }

  hurt(dmg, fromX, world) {
    if (this.invuln > 0 || this.state === "dash") return false;
    if (this.invuln > 0 || this.state === "dash") return false;
    // 夜宴的護盾先擋
    if (this.shield > 0) { const a = Math.min(this.shield, dmg); this.shield -= a; dmg -= a; if (dmg <= 0) { this.invuln = 0.5; this.flash = 0.06; sfx("hitL"); return true; } }
    const def = this.stats.def * (this.dentT > 0 ? 1.5 : 1) * (this.hp < this.maxHp * 0.4 ? 1 + this.core("rock") / 100 : 1);   // 凹痕記憶：防禦 +50%；星核「巨岩」
    // 星核「鈍光」：一定機率讓攻擊你的敵人暈 1 秒
    if (this.core("dull") && Math.random() * 100 < this.core("dull")) world.coreStun?.(fromX, this.y);
    dmg = Math.max(1, Math.round(dmg * (1 - reduction(def)) * (this.filmT > 0 ? 0.75 : 1)));   // 黏液護膜：-25%
    // 鐵皮（鐵罐星）：攻擊中被打不會中斷，只扣血
    if (this.form === "can" && this.state === "attack" && rank("can", "c_iron")) {
      this.hp = Math.max(0, this.hp - dmg); this.invuln = 0.4; this.flash = 0.08; sfx("hurt"); world.onPlayerHurt?.(dmg);
      return true;
    }
    this.hp = Math.max(0, this.hp - dmg);
    this.invuln = 0.9;
    this.flash = 0.08;
    this.state = "hurt";
    this.t = 0;
    this.atk = null;
    // 形態被動「鐵底盤」：鐵罐星被打時擊退距離、硬直時間 -5%／級
    this.hurtK = this.form === "can" ? 1 - 0.05 * rank("can", "p_can") : 1;
    this.vx = (this.x >= fromX ? 1 : -1) * 170 * this.hurtK;
    this.vy = -170 * this.hurtK;
    this.grounded = false;
    hitStop(0.07);
    shake(0.25, 3);
    sfx("hurt");
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
      case "fly": return POSES.jump;
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
    if (this.hideT > 0) return;
    // 殘影
    // 閃避殘影：用實色剪影，越舊顏色越暗（不用半透明）
    for (const g of this.ghosts) paintStar(frame, g.x, g.y, g.q, g.flip, { form: this.form, tint: GHOST[Math.min(GHOST.length - 1, Math.floor((g.age / 0.22) * GHOST.length))] });
    if (this.invuln > 0 && this.state !== "dash" && this.state !== "ult" && Math.floor(this.clock * 20) % 2 === 0) return;
    paintStar(frame, this.x, this.y, this.pose, this.drawFlip(), { tint: this.flash > 0 ? WHITE : 0, form: this.form });
  }
}
