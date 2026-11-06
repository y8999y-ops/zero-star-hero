// 敵人：史萊姆（跳著靠近）、蝙蝠（盤旋後俯衝）、金幣史萊姆（拼命逃跑）。
// 外觀用 PixelFX 的小生物特效（載入時烘焙好），移動跟著牠們自己的動畫節奏走。
import { rand } from "../../pixelfx/src/core/index.js";
import { hitFx, damageFx } from "./combatfx.js";
import { sfx } from "./audio.js";
import { spawn } from "./fx.js";
import * as hitSpark from "../../pixelfx/src/fx/impacts/hit-spark.js";
// 特效補強 7：一次打死一群時，死亡煙霧疊成一大片、把主角和怪都蓋住 → 煙播快一點（1.5 倍）；0.35 秒內、70px 內已經冒過兩團，後面的改成往上噴的小火花
//   （草稿 game/tools/drafts/poofcrowd.mjs：6 隻同時死，被蓋住的像素最高 4022 → 1988、1.3 秒 → 0.9 秒散完；試過收集光爆，4 個白圓環疊在一起像泡泡，不用）
let recentPoofs = [];
const POOF_SPARK = { slime: ["#0b2f2b", "#12594a", "#1f8f4f", "#47c752", "#a6f06a", "#f0ffd2", "#ffffff"], gold: ["#4a2e06", "#8c5a0c", "#d49a14", "#ffd23a", "#fff09a", "#ffffff", "#ffffff"], bat: ["#1f1629", "#382645", "#5b3f66", "#866089", "#b88fb0", "#e8cfe0", "#ffffff"], trash: ["#1f272c", "#313d42", "#485a5c", "#667a78", "#8ea29c", "#c4d4cc", "#ffffff"] };
import { flash } from "./light.js";
import { blit } from "./bake.js";
import { A } from "./assets.js";
import { FLOOR, LEVEL_W, WALL } from "./level.js";
import { groundAt, floorAt, moveX, geo } from "./map.js";
import { applyStatus, drawStatus, statusSnap, slowOf } from "./status.js";
import { drawAlert, ALERT_T } from "./alertfx.js";
let alertSfxT = 0;   // 一次醒很多隻：提示音 0.3 秒內只響一次

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
    dt *= slowOf(this);   // 黏液：動作、移動都變慢
    this.flash -= dt;
    const stunned = this.stun > 0;
    this.stun -= dt;
    if (!stunned) this.t += dt;   // 硬直時動畫停住
    const toward = player.x >= this.x ? 1 : -1;

    this.world = world;
    // 8b：怪物擺在地圖上，主角靠近（左右 160、上下 90 以內；使用者 2026-11-05 鏡頭拉近後 200 → 160，看到怪時牠才剛發現你）或被打到才醒來追；還沒醒的在原地待著（史萊姆原地輕跳、蝙蝠在原地飛）
    if (!this.awake) {
      if (Math.abs(player.x - this.x) < 160 && Math.abs(player.y - this.y) < 90 || this.hp < this.k.hp) {
        this.awake = true; this.alertT = 0;   // 特效補強 2：發現主角，頭上冒「!」
        const now = performance.now(); if (now - alertSfxT > 300) { alertSfxT = now; sfx("chime"); }
      }
      else {
        if (!this.k.fly) { this.vx *= 1 - 8 * dt; this.vy += GRAV * dt; this.land(dt); }
        else { this.homeY ??= this.y; this.y = this.homeY + Math.sin(this.clock * 2.2) * 4; }
        return;
      }
    }
    this.awakeT = (this.awakeT ?? 0) + dt;
    if (this.alertT !== undefined && this.alertT < ALERT_T) this.alertT += dt;   // 狀態傷害打死的時候要用（掉錢、經驗）
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
      this.x = moveX(this.x, this.x + this.vx * dt, this.y + 6, 12, 6);
      this.y += this.vy * dt;
      this.y = Math.min(floorAt(this.x, this.y - 12) - 12, Math.max(12, this.y));   // 8b：不鑽進地裡
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
      this.land(dt);
    } else {
      // 史萊姆：只在自己動畫的「跳起來」那段時間移動
      const t = this.t % this.k.anim.duration;
      if (!stunned && t >= HOP_AIM && t < HOP_UP) this.hopDir = this.kind === "gold" ? -toward : toward;
      const hopping = !stunned && t >= HOP_UP && t < HOP_DOWN;
      if (hopping) this.vx = this.hopDir * this.speed;
      else if (!stunned) this.vx *= 1 - 12 * dt;
      else this.vx *= 1 - 4 * dt;
      this.vy += GRAV * dt;
      this.land(dt);
      this.face = this.hopDir;
    }
  }
  /** 8b：地上的怪移動＋落地＋撞牆（map.js）。撞牆就彈回來 */
  land(dt) {
    const prevY = this.y, want = this.x + this.vx * dt, nx = moveX(this.x, want, this.y, 18, 9);
    if (nx !== want) { this.vx = -this.vx * 0.5; if (this.kind === "gold") this.hopDir = -this.hopDir; }
    this.x = Math.max(9, Math.min(geo.w - 9, nx));
    this.y += this.vy * dt;
    const g = this.vy >= 0 ? groundAt(this.x, prevY, this.y) : null;
    if (g !== null) { this.y = g; this.vy = 0; }
    if (this.y > geo.h + 40) { this.y = floorAt(this.x, 0); this.vy = 0; }   // 掉出地圖：放回最上面的地面
  }

  /** 受到攻擊。roll 是 { dmg, crit }（主角算好的），或單純的數字。 */
  hit(roll, dir, { launch = false, push = 2, elem = null, fling = false } = {}, world) {
    const { dmg, crit } = typeof roll === "number" ? { dmg: roll, crit: false } : roll;
    // 星核「沉重」：被打飛的這隻，0.4 秒內撞到別的敵人時對方也受傷（main.js 判斷）
    if (fling) { this.flungT = 0.4; this.flungDmg = dmg * 0.5; this.flungHit = new Set([this]); }
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
    sfx(crit ? "crit" : heavy ? "hitH" : "hitL");
    flash(this.x, cy, heavy ? 36 : 18, heavy ? 2.2 : 1.1, heavy ? 0.14 : 0.08);   // 命中時照亮周圍一下
    damageFx(this, this.x, b.y0 - 3, d, { crit, heavy });
    if (this.hp <= 0) this.die(world);
    else if (elem) applyStatus(this, elem);
  }

  /** 狀態、反應造成的傷害：不會硬直、不會擊退，只跳數字（small＝持續傷害，數字小一點） */
  tick(dmg, col, small = false) {
    if (this.dead) return;
    const d = Math.max(1, Math.round(dmg));
    this.hp -= d;
    if (!small) this.flash = 0.05;
    const b = this.box();
    damageFx(this, this.x, b.y0 - 3, d, { heavy: !small });
    if (this.hp <= 0 && this.world) this.die(this.world);
  }

  die(world) {
    this.dead = true;
    sfx("kill");
    const b = this.box();
    const now = performance.now();
    recentPoofs = recentPoofs.filter((q) => now - q.t < 350);
    const crowded = recentPoofs.filter((q) => Math.abs(q.x - this.x) < 70 && Math.abs(q.y - this.y) < 60).length >= 2;
    recentPoofs.push({ x: this.x, y: this.y, t: now });
    if (crowded) spawn(hitSpark, { x: Math.round(this.x), y: Math.round((b.y0 + b.y1) / 2), palette: POOF_SPARK[this.kind] ?? POOF_SPARK.slime, angle: -Math.PI / 2, light: 0.35 }, { speed: 1.2 });
    else spawn(this.k.poof, { x: Math.round(this.x), y: Math.round(b.y1) }, { speed: 1.5 });
    const [a, z] = this.k.coins;
    world.dropCoins(this.x, (b.y0 + b.y1) / 2, a + Math.floor(Math.random() * (z - a + 1)));
    world.onKill(this);
  }

  draw(frame) {
    const snap = statusSnap(frame, this);   // 有元素狀態：先記下這塊畫面，畫完比對出身體的形狀（status.js）
    // 受擊閃白
    if (this.biting) blit(frame, this.flash > 0 ? this.k.whiteBite : this.k.bite, this.biteT, this.x, this.y, this.face < 0);
    else blit(frame, this.flash > 0 ? this.k.white : this.k.anim, this.t, this.x, this.y, this.face < 0);
    drawStatus(frame, this, snap);
    if (this.alertT !== undefined && this.alertT < ALERT_T && !this.dead) drawAlert(frame, this.x, this.box().y0 - 3, this.alertT, this.elite);
  }
}
