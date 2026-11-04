// 敵人：史萊姆（跳著靠近）、蝙蝠（盤旋後俯衝）、金幣史萊姆（拼命逃跑）。
// 外觀用 PixelFX 的小生物特效（載入時烘焙好），移動跟著牠們自己的動畫節奏走。
import { rand } from "../../pixelfx/src/core/index.js";
import { hitFx, damageFx } from "./combatfx.js";
import { spawn } from "./fx.js";
import { flash } from "./light.js";
import { blit } from "./bake.js";
import { A } from "./assets.js";
import { FLOOR, LEVEL_W, WALL } from "./level.js";

const GRAV = 900;
// 史萊姆動畫裡「跳起來」到「落地」的時間（見 pixelfx/src/fx/critters/slime.js）
const HOP_AIM = 0.84, HOP_UP = 0.9, HOP_DOWN = 1.44;
const KINDS = {
  slime: { anim: A.slime, white: A.slimeWhite, hp: 34, dmg: 8, w: 15, h: 22, coins: [1, 3], poof: A.poofSlime },
  gold: { anim: A.slimeGold, white: A.slimeWhite, hp: 60, dmg: 0, w: 15, h: 22, coins: [14, 20], poof: A.poofGold },
  bat: { anim: A.bat, white: A.batWhite, hp: 22, dmg: 7, w: 10, h: 9, coins: [1, 2], fly: true, poof: A.poofBat },
  // 自製敵人：慢慢走過來，靠近就蓄力撲咬
  trash: { anim: A.trashWalk, white: A.trashWhite, bite: A.trashBite, whiteBite: A.trashWhiteBite, hp: 70, dmg: 5, biteDmg: 13, w: 11, h: 30, coins: [3, 6], poof: A.poofTrash },
};
// 菁英：紅色、血 3～4 倍、比較痛、比較快；行為跟原本的一樣（kind 用 base）
KINDS.slimeE = { ...KINDS.slime, anim: A.slimeElite, hp: 130, dmg: 12, coins: [6, 10], base: "slime", elite: true };
KINDS.batE = { ...KINDS.bat, anim: A.batElite, hp: 80, dmg: 11, coins: [5, 8], base: "bat", elite: true };
KINDS.trashE = { ...KINDS.trash, anim: A.trashEliteWalk, bite: A.trashEliteBite, hp: 220, dmg: 8, biteDmg: 20, coins: [10, 16], base: "trash", elite: true };
// 垃圾桶怪咬人的節奏（秒，對應 trash-can.js 的 bite 動畫：0.8 秒一輪）
const BITE_LUNGE = 0.3, BITE_HIT0 = 0.38, BITE_HIT1 = 0.48, BITE_END = 0.8;

let seed = 1;
export class Enemy {
  constructor(kind, x, y) {
    const k = KINDS[kind];
    seed++;
    Object.assign(this, { kind: k.base ?? kind, elite: !!k.elite, k, x, y, vx: 0, vy: 0, hp: k.hp, stun: 0, flash: 0, dead: false, face: 1, clock: 0, hopDir: 1 });
    this.t = rand(seed, 3) * k.anim.duration; // 錯開動畫，不要大家一起跳
    this.speed = kind === "gold" ? 120 : (52 + rand(seed, 4) * 30) * (k.elite ? 1.25 : 1);
    if (k.fly) { this.mode = "hover"; this.modeT = 1 + rand(seed, 5) * 2; this.side = rand(seed, 6) < 0.5 ? -1 : 1; }
  }

  /** 身體的碰撞框（世界座標）。 */
  box() {
    const { w, h } = this.k;
    return this.k.fly ? { x0: this.x - w, x1: this.x + w, y0: this.y - h, y1: this.y + h } : { x0: this.x - w, x1: this.x + w, y0: this.y - h, y1: this.y };
  }

  update(dt, player, world) {
    this.clock += dt;
    this.flash -= dt;
    const stunned = this.stun > 0;
    this.stun -= dt;
    if (!stunned) this.t += dt;   // 硬直時動畫停住
    const toward = player.x >= this.x ? 1 : -1;

    if (this.k.fly) {
      if (stunned) {
        this.vx *= 1 - 5 * dt;
        this.vy += (this.vy < 0 ? GRAV * 0.6 : 0) * dt;
        this.vy *= 1 - 3 * dt;
      } else if (this.mode === "hover") {
        const tx = player.x + this.side * 70, ty = player.y - 64 + Math.sin(this.clock * 3) * 10;
        this.vx += Math.sign(tx - this.x) * Math.min(1, Math.abs(tx - this.x) / 40) * 400 * dt;
        this.vy += Math.sign(ty - this.y) * Math.min(1, Math.abs(ty - this.y) / 30) * 400 * dt;
        this.vx *= 1 - 2.2 * dt;
        this.vy *= 1 - 2.2 * dt;
        if ((this.modeT -= dt) <= 0) { this.mode = "wind"; this.modeT = 0.35; }
      } else if (this.mode === "wind") {
        this.vx *= 1 - 8 * dt;
        this.vy = -30;
        if ((this.modeT -= dt) <= 0) {
          const dx = player.x - this.x, dy = player.y - 12 - this.y, d = Math.hypot(dx, dy) || 1;
          this.vx = (dx / d) * 230;
          this.vy = (dy / d) * 230;
          this.mode = "swoop";
          this.modeT = 0.75;
        }
      } else if (this.mode === "swoop") {
        if ((this.modeT -= dt) <= 0) { this.mode = "hover"; this.modeT = 1.6 + rand(this.clock, 7) * 1.8; this.side = -this.side; }
      }
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.y = Math.min(FLOOR - 12, Math.max(20, this.y));
      if (Math.abs(this.vx) > 10) this.face = Math.sign(this.vx);
    } else if (this.kind === "trash") {
      this.biteCd = (this.biteCd ?? 1) - dt;
      if (this.biting) {
        const bt = (this.biteT += stunned ? 0 : dt);
        if (!stunned) {
          this.vx = bt > BITE_LUNGE && bt < BITE_HIT1 ? this.face * 160 : this.vx * (1 - 10 * dt);
          // 咬到了沒
          if (bt > BITE_HIT0 && bt < BITE_HIT1 && !this.bitDone) {
            const x0 = this.face > 0 ? this.x : this.x - 30, x1 = this.face > 0 ? this.x + 30 : this.x;
            if (player.x + 6 > x0 && player.x - 6 < x1 && Math.abs(player.y - this.y) < 30 && player.hurt(this.k.biteDmg, this.x, world)) this.bitDone = true;
          }
        }
        if (bt >= BITE_END) { this.biting = false; this.biteCd = 1.1 + rand(this.clock, 9) * 0.8; }
      } else if (!stunned) {
        this.face = toward;
        this.vx = toward * 34;
        if (Math.abs(player.x - this.x) < 50 && Math.abs(player.y - this.y) < 30 && this.biteCd <= 0) {
          this.biting = true; this.biteT = 0; this.bitDone = false; this.vx = 0;
        }
      } else this.vx *= 1 - 4 * dt;
      this.vy += GRAV * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.y >= FLOOR) { this.y = FLOOR; this.vy = 0; }
    } else {
      // 史萊姆：只在自己動畫的「跳起來」那段時間移動
      const t = this.t % this.k.anim.duration;
      if (!stunned && t >= HOP_AIM && t < HOP_UP) this.hopDir = this.kind === "gold" ? -toward : toward;
      const hopping = !stunned && t >= HOP_UP && t < HOP_DOWN;
      if (hopping) this.vx = this.hopDir * this.speed;
      else if (!stunned) this.vx *= 1 - 12 * dt;
      else this.vx *= 1 - 4 * dt;
      this.vy += GRAV * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.y >= FLOOR) { this.y = FLOOR; this.vy = 0; }
      this.face = this.hopDir;
    }
    // 牆壁
    if (this.x < WALL + 10 || this.x > LEVEL_W - WALL - 10) {
      this.x = Math.max(WALL + 10, Math.min(LEVEL_W - WALL - 10, this.x));
      this.vx = -this.vx * 0.5;
      if (this.kind === "gold") this.hopDir = -this.hopDir;
    }
  }

  /** 受到攻擊。roll 是 { dmg, crit }（主角算好的），或單純的數字。 */
  hit(roll, dir, { launch = false, push = 2 } = {}, world) {
    const { dmg, crit } = typeof roll === "number" ? { dmg: roll, crit: false } : roll;
    const d = Math.max(1, Math.round(dmg * (0.9 + Math.random() * 0.2)));
    this.hp -= d;
    this.flash = 0.07;
    this.stun = this.kind === "gold" ? 0.1 : 0.3;
    this.vx = dir * push * (this.k.fly ? 55 : 42);
    if (launch || crit) this.vy = this.k.fly ? -120 : -230;
    const b = this.box(), cy = Math.round((b.y0 + b.y1) / 2);
    // 重擊：最後一段／擊飛、爆擊、推得遠的（技能、衝撞）。輕擊的光和火花都收小
    const heavy = launch || crit || push >= 3;
    hitFx(this.x - dir * 3, cy, dir, heavy);
    flash(this.x, cy, heavy ? 36 : 18, heavy ? 2.2 : 1.1, heavy ? 0.14 : 0.08);   // 命中時照亮周圍一下
    damageFx(this, this.x, b.y0 - 3, d, { crit, heavy });
    if (this.hp <= 0) this.die(world);
  }

  die(world) {
    this.dead = true;
    const b = this.box();
    spawn(this.k.poof, { x: Math.round(this.x), y: Math.round(b.y1) });
    const [a, z] = this.k.coins;
    world.dropCoins(this.x, (b.y0 + b.y1) / 2, a + Math.floor(Math.random() * (z - a + 1)));
    world.onKill(this);
  }

  draw(frame) {
    // 受擊閃白
    if (this.biting) blit(frame, this.flash > 0 ? this.k.whiteBite : this.k.bite, this.biteT, this.x, this.y, this.face < 0);
    else blit(frame, this.flash > 0 ? this.k.white : this.k.anim, this.t, this.x, this.y, this.face < 0);
  }
}
