// 戰鬥畫面（canvas）：背景、見習魔數師、墨水怪、魔法特效。只管畫面與動畫，答題規則在 battle.js。
// 解析度 384×216（橫版 16:9），用 CSS 放大（image-rendering: pixelated）。
// 下方 22% 會被答案按鈕蓋住，所以角色站在 y = 144（不是畫面最底）。

import { createFrame, clearFrame, createFx, composite, painterFor, hex as pfHex } from "../../../pixelfx/src/core/index.js";
import { SPELLS, FX, INK, INK_POOF, crystalLight } from "./spells.js";
import { GRADES, ATTRS } from "../data.js";
import { heroFrame } from "../../fx/hero.js";
import { inkDropFrame } from "../../fx/ink-drop.js";
import { pagepageFrame } from "../../fx/pagepage.js";
import { crookedFlowerFrame } from "../../fx/crooked-flower.js";
import { inkKingBabyFrame } from "../../fx/ink-king-baby.js";

// 程式畫的角色、怪物：每個姿勢一個循環多長（秒），每秒畫 12 格，畫過就快取
const SPRITES = {
  ink: { fn: inkDropFrame, loop: 1.2 }, page: { fn: pagepageFrame, loop: 1.0 },
  flower: { fn: crookedFlowerFrame, loop: 1.2 }, king: { fn: inkKingBabyFrame, loop: 2.0 },
};
// 每個區域會出現的雜兵、王（還沒畫的區域先用墨水滴）
const MINIONS = { g1: ["ink", "flower"] };
const BOSS = { g1: "king" };
const HEAD = { ink: 42, flower: 50, king: 96, slime: 110 };   // 頭頂離腳底幾格（題目、答案數字掛在這裡）
import { MathMagic, PopNumber } from "./mathmagic.js";
import { areaArtNow } from "./areaart.js";
import { Ambience } from "./ambience.js";

export const W = 384, H = 216, GROUND = 144;
const PX = 76;               // 玩家腳下 x
const REACH = 132;           // 怪物走到這裡＝撞到玩家
const START = 356;           // 怪物出現的位置
const WAIT = 262;            // 不限時：怪物停在這裡等
// 數學變魔法的版面原本以 288 寬設計，整塊往右、往上移到畫面中央偏上
const MAGIC_OX = W / 2 - 144, MAGIC_OY = -26;

export class Stage {
  constructor(canvas, gradeId, look, attr, settings = {}) {
    this.opt = { shake: settings.shake !== false, softFlash: settings.flash === "soft", shortMagic: settings.magic === "short" };
    this.cv = canvas;
    canvas.width = W; canvas.height = H;
    this.ctx = canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;
    this.g = GRADES[gradeId]; this.gradeId = gradeId;
    this.look = look; this.attr = attr;
    this.frame = createFrame(W, H);
    this.img = new ImageData(W, H);
    this.layer = document.createElement("canvas");
    this.layer.width = W; this.layer.height = H;
    this.lctx = this.layer.getContext("2d");
    // 王：另一張小畫布畫好再放大兩倍
    this.bossFrame = createFrame(112, 88);
    this.bossImg = new ImageData(112, 88);
    this.bossLayer = document.createElement("canvas");
    this.bossLayer.width = 112; this.bossLayer.height = 88;
    // 見習魔數師（fx/hero.js），每個姿勢的每一格畫好就快取起來
    this.heroCache = new Map();
    this.pagePose = "idle"; this.pageUntil = 0;
    this.magic = null;        // 數學變魔法（mathmagic.js）
    this.pops = [];           // 打中時跳出的答案數字
    this.fx = [];            // { inst, x, y, from, to, delay, t, dur, speed, follow }
    this.monster = null;
    this.t = 0; this.shake = 0; this.hurtT = 0; this.castT = -1;
    this.gray = 1;           // 1＝被墨水弄灰，0＝恢復色彩
    this.dim = 0;            // 施法時畫面暗下來，讓魔法的光更明顯
    this.art = areaArtNow(gradeId);          // 有正式背景圖就用（要先 await loadAreaArt）
    this.bg = this.art ? null : this.paintBackground();
    this.ambience = this.art ? new Ambience(this.art) : null;   // 場景的動態（雲、浮空島、花瓣、蝴蝶…）
    this.grayTo = null;
  }

  // ── 背景：天空漸層（硬色階）＋遠方剪影＋地面。之後換成 pixel-redraw 的正式場景圖 ──
  paintBackground() {
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const x = c.getContext("2d");
    const [top, bot] = this.g.sky;
    const steps = 6;
    for (let i = 0; i < steps; i++) {
      x.fillStyle = mix(top, bot, i / (steps - 1));
      x.fillRect(0, Math.floor((GROUND * i) / steps), W, Math.ceil(GROUND / steps) + 1);
    }
    // 遠方剪影：起伏的丘陵
    x.fillStyle = mix(bot, this.g.deep, 0.45);
    for (let i = 0; i < W; i++) {
      const h = 26 + 10 * Math.sin(i * 0.035) + 6 * Math.sin(i * 0.11 + 1);
      x.fillRect(i, GROUND - h, 1, h);
    }
    x.fillStyle = this.g.ground; x.fillRect(0, GROUND, W, H - GROUND);
    x.fillStyle = this.g.deep; x.fillRect(0, GROUND, W, 2);
    for (let i = 0; i < W; i += 7) x.fillRect(i + ((i * 13) % 5), GROUND + 6 + ((i * 7) % 20), 2, 1);
    return c;
  }

  spawn(boss = false, force = null) {   // force：指定哪一種（教學固定是墨水滴）
    // 雜兵：這個區域的幾種輪流隨機出現；王：這個區域的王（還沒畫的區域先用放大的 pixelfx 史萊姆）
    const id = this.gradeId;
    const pool = MINIONS[id] ?? ["ink"];
    const kind = force ?? (boss ? BOSS[id] ?? "slime" : pool[Math.floor(Math.random() * pool.length)]);
    this.monster = kind === "slime"
      ? { boss, kind, x: START, hp: 1, state: "walk", t: 0, alpha: 1, inst: createFx(FX.slime, { palette: INK, seed: 1 + Math.floor(Math.random() * 50), hop: 14 }) }
      : { boss, kind, x: START, hp: 1, state: "walk", t: 0, alpha: 1, phase: Math.random() * 2, flinch: 0 };
  }

  /** 王被打掉一格護盾：縮一下（hurt 姿勢） */
  flinch() {
    if (this.monster) this.monster.flinch = 0.45;
  }

  /** 怪物往前走；timeFrac：0～1 已經過的時間比例（限時），null＝不限時 */
  walkTo(timeFrac) {
    const m = this.monster;
    if (!m || m.state !== "walk") return;
    m.target = timeFrac == null ? WAIT : START - (START - REACH) * timeFrac;
  }

  /** 施法。回傳 Promise：打中時 resolve。 */
  cast(tier, crystalLv = 1) {
    const spell = SPELLS[this.attr][tier - 1];
    const m = this.monster;
    const tx = m ? m.x : 270;
    this.castT = 0;
    this.dimTo = [0, 0.25, 0.35, 0.45, 0.6][tier];
    this.dimHold = 0.15 + spell.hit + 0.5;
    this.addFx(FX.castCircle, { x: PX, y: GROUND + 2, speed: 1.6, dur: 0.8, opts: { palette: rampOf(ATTRS[this.attr].color) } });
    for (const p of spell.parts) {
      const o = { ...(p.opts ?? {}), light: crystalLight(crystalLv) };
      let x = 0, y = GROUND, from = null, to = null;
      if (p.at === "caster") { x = PX + 10; y = GROUND - (p.mod.meta.origin[1] < 40 ? 16 : 0); if ("length" in (p.mod.meta.options ?? {})) o.length = Math.max(40, tx - PX - 10); }
      else if (p.at === "target") { x = tx + (p.x ?? 0); }
      else { const dy = p.drop ?? 0; from = [PX + 12, GROUND - 18 + dy]; to = [tx - 4, GROUND - 14 + dy]; x = from[0]; y = from[1]; }
      this.addFx(p.mod, { x, y, from, to, delay: 0.15 + p.delay, speed: p.speed, dur: p.dur, opts: o });
    }
    return new Promise((res) => setTimeout(() => { this.shake = spell.shake ?? 2; res(); }, (0.15 + spell.hit) * 1000));
  }

  addFx(mod, { x, y, from = null, to = null, delay = 0, speed = 1, dur = Infinity, opts = {} }) {
    this.fx.push({ mod, x, y, from, to, delay, speed, dur, opts, inst: null, t: 0 });
  }

  /** 怪物被淨化：散成光點，掉出靈感星 */
  purify() {
    const m = this.monster;
    if (!m) return;
    m.state = "die"; m.t = 0;
    this.addFx(FX.poof, { x: m.x, y: GROUND, speed: 1.4, opts: { palette: INK_POOF } });
    this.addFx(FX.xpOrb, { x: m.x, y: GROUND - 6, delay: 0.25, dur: 0.9, speed: 1.3 });
  }

  /** 答錯：怪物衝過來撞一下，墨水濺到玩家 */
  hurt() {
    const m = this.monster;
    if (m) { m.state = "bump"; m.t = 0; }
    setTimeout(() => {
      this.hurtT = 0.6; this.shake = 4;
      this.addFx(FX.hitFlash, { x: PX + 4, y: GROUND - 6, flip: true, opts: { palette: INK_POOF } });
    }, 220);
  }

  update(dt) {
    this.t += dt;
    if (this.castT >= 0) { this.castT += dt; if (this.castT > 0.6 && !this.magic?.active) this.castT = -1; }
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.ambience?.update(dt);
    if (this.grayTo != null) { this.gray += (this.grayTo - this.gray) * Math.min(1, dt * 1.6); if (Math.abs(this.gray - this.grayTo) < 0.002) { this.gray = this.grayTo; this.grayTo = null; } }
    this.dimHold = Math.max(0, (this.dimHold ?? 0) - dt);
    const goal = this.dimHold > 0 ? this.dimTo : 0;
    this.dim += (goal - this.dim) * Math.min(1, dt * (goal > this.dim ? 10 : 3));
    this.shake = Math.max(0, this.shake - dt * 18);
    const m = this.monster;
    if (m) {
      m.t += dt;
      m.inst?.update(dt);
      if (m.flinch > 0) m.flinch = Math.max(0, m.flinch - dt);
      if (m.state === "walk" && m.target != null) m.x += (m.target - m.x) * Math.min(1, dt * 3);
      if (m.state === "bump") {
        const u = Math.min(1, m.t / 0.5);
        m.x = m.home ??= m.x;
        m.x = m.home - (m.home - (PX + 26 + (m.kind === "king" ? 34 : 0))) * Math.sin(u * Math.PI);
        if (u >= 1) { m.state = "walk"; m.home = undefined; }
      }
      if (m.state === "die") { m.alpha = Math.max(0, 1 - m.t / 0.25); if (m.t > 0.3) this.monster = null; }
    }
    for (const f of this.fx) {
      if (f.delay > 0) { f.delay -= dt; continue; }
      if (!f.inst) f.inst = createFx(f.mod, { ...f.opts, x: f.x, y: f.y });
      f.t += dt;
      f.inst.update(dt * f.speed);
      if (f.from) {
        const u = Math.min(1, f.t / f.dur);
        f.inst.options.x = f.from[0] + (f.to[0] - f.from[0]) * u;
        f.inst.options.y = f.from[1] + (f.to[1] - f.from[1]) * u - Math.sin(u * Math.PI) * 10;
      }
      if (f.t >= f.dur) f.inst.stop();
    }
    this.fx = this.fx.filter((f) => !f.inst || !f.inst.done());
    this.magic?.update(dt);
    for (const n of this.pops) n.update(dt);
    this.pops = this.pops.filter((n) => !n.done);
  }

  draw() {
    const { ctx, frame } = this;
    clearFrame(frame);
    const p = painterFor(frame);

    for (const f of this.fx) if (f.inst) f.inst.draw(frame, "back");

    // 見習魔數師（暫用 pixelfx 的標準角色＋帽子，M2 換正式圖）
    const blink = this.hurtT > 0 && Math.floor(this.hurtT * 20) % 2 === 0;
    const pose = this.hurtT > 0 ? "hurt" : this.castT >= 0 ? "cast" : this.win ? "win" : "idle";
    this.hero = blink ? null : this.heroSprite(pose, this.t);
    if (this.hero) {
      // 杖頭數晶的光
      p.place(0, 0, false, 0);
      const [gx, gy] = this.hero.glow;
      p.glow(PX - this.hero.ox + gx, GROUND - this.hero.oy + gy, this.castT >= 0 ? 7 : 4, pfHex(ATTRS[this.attr]?.color ?? "#8a7cff"), this.castT >= 0 ? 0.7 : 0.35);
    }

    const m = this.monster;

    for (const f of this.fx) if (f.inst) f.inst.draw(frame, "front");
    this.magic?.draw(p);
    for (const n of this.pops) n.draw(p);

    // 合成：背景 → 王（放大）→ 特效層
    const sk = this.opt.shake ? this.shake : 0;
    const sx = sk ? Math.round((Math.random() - 0.5) * sk) : 0;
    const sy = sk ? Math.round((Math.random() - 0.5) * sk) : 0;
    if (this.ambience) {
      // 正式背景＋動態；每一層都是彩色版上疊灰色版，gray 從 1 漸變到 0 就是「恢復色彩」
      this.ambience.draw(ctx, sx, sy, this.gray);
    } else {
      ctx.drawImage(this.bg, sx, sy);
      if (this.gray > 0) { ctx.fillStyle = `rgba(40,34,60,${0.35 * this.gray})`; ctx.fillRect(0, 0, W, H); }
    }
    if (this.dim > 0.01) { ctx.fillStyle = `rgba(8,6,20,${this.dim})`; ctx.fillRect(0, 0, W, H); }
    // 角色腳下的影子：讓角色從背景裡浮出來（尤其是跟草地同色系的）
    const shadow = (x, rx) => { ctx.fillStyle = "rgba(20,14,40,0.32)"; ctx.fillRect(Math.round(x - rx) + sx, GROUND - 1 + sy, rx * 2, 2); ctx.fillRect(Math.round(x - rx + 2) + sx, GROUND + 1 + sy, rx * 2 - 4, 1); };
    if (this.hero) shadow(PX, 8);
    if (m && m.alpha > 0 && m.kind !== "king") shadow(m.x, m.kind === "slime" ? 20 : 9);
    if (m && m.kind === "slime" && m.alpha > 0) {
      clearFrame(this.bossFrame);
      m.inst.options.x = 56; m.inst.options.y = 72; m.inst.options.flip = true;
      m.inst.draw(this.bossFrame);
      composite(this.bossFrame, this.bossImg.data, null);
      this.bossLayer.getContext("2d").putImageData(this.bossImg, 0, 0);
      ctx.globalAlpha = m.alpha;
      ctx.drawImage(this.bossLayer, Math.round(m.x) - 112 + sx, GROUND - 144 + sy, 224, 176);
      ctx.globalAlpha = 1;
    }
    if (this.hero) ctx.drawImage(this.hero.canvas, PX - this.hero.ox + sx, GROUND - this.hero.oy + sy);
    // 頁頁：浮在主角左上方，表情跟著戰鬥變
    const pg = this.sprite("page", this.t > this.pageUntil ? "idle" : this.pagePose, this.t);
    ctx.drawImage(pg.canvas, PX - 30 - pg.ox + sx, GROUND - 26 - pg.oy + sy);
    // 程式畫的怪物（墨水滴、歪瓣花、墨水大王）：被淨化、被打中時是 hurt 姿勢
    if (m && SPRITES[m.kind] && m.alpha > 0) {
      const sp = this.sprite(m.kind, m.state === "die" || m.flinch > 0 ? "hurt" : "idle", m.t + m.phase);
      ctx.globalAlpha = m.alpha;
      ctx.drawImage(sp.canvas, Math.round(m.x) - sp.ox + sx, GROUND - sp.oy + sy);
      ctx.globalAlpha = 1;
    }
    composite(frame, this.img.data, null, this.opt.softFlash ? 0.55 : 1);
    this.lctx.putImageData(this.img, 0, 0);
    ctx.drawImage(this.layer, sx, sy);
  }

  /** 恢復色彩：灰色慢慢退掉（打倒王時） */
  restoreColor() { this.grayTo = 0; }

  /** 數學變魔法：算式變成光球、光球飛向怪物。回傳 Promise（光球出手時 resolve） */
  mathMagic(math) {
    const m = this.monster;
    // 目標座標換成演出版面自己的座標（版面整塊位移了 MAGIC_OX、MAGIC_OY）
    this.magic = new MathMagic(ATTRS[this.attr]?.color ?? "#8a7cff", [(m ? m.x : 270) - MAGIC_OX, GROUND - 10 - MAGIC_OY], [MAGIC_OX, MAGIC_OY]);
    this.castT = 0;
    this.dimTo = 0.3; this.dimHold = 9;
    const run = this.magic.start(math);
    if (this.opt.shortMagic) this.magic.speed = 2.5;   // 設定：簡短演出
    return run.then(() => { this.dimHold = 0; });
  }

  /** 打中時在怪物頭上跳出答案數字 */
  popNumber(text, combo) {
    const m = this.monster;
    this.pops.push(new PopNumber(String(text).replace("−", "-"), m ? m.x : 270, GROUND - (HEAD[m?.kind] ?? 42) - 8, ATTRS[this.attr]?.color ?? "#8a7cff", combo >= 10 ? 4 : combo >= 6 ? 3 : 2));
  }

  /** 頁頁的表情：talk 說話、happy 開心、worried 擔心，維持 sec 秒後回到待機 */
  setPage(pose, sec = 1.2) {
    // 開心、擔心的表情還在的時候，說話不蓋掉它（頁頁會帶著那個表情說話）
    if (pose === "talk" && this.t < this.pageUntil && (this.pagePose === "happy" || this.pagePose === "worried")) return;
    this.pagePose = pose; this.pageUntil = this.t + sec;
  }

  /** 程式畫的角色、怪物某個姿勢、某一格的圖（快取） */
  sprite(name, pose, t) {
    const S = SPRITES[name], n = Math.floor((((t % S.loop) + S.loop) % S.loop) * 12);
    const key = `${name}:${pose}:${n}`;
    let c = this.heroCache.get(key);
    if (!c) {
      const f = S.fn(pose, n / 12);
      const canvas = document.createElement("canvas");
      canvas.width = f.w; canvas.height = f.h;
      canvas.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(f.px.buffer.slice(0)), f.w, f.h), 0, 0);
      c = { canvas, ox: f.ox, oy: f.oy };
      this.heroCache.set(key, c);
    }
    return c;
  }

  /** 主角某個姿勢、某一格的圖（12 格／秒，畫過就快取） */
  heroSprite(pose, t) {
    const n = pose === "idle" || pose === "win" ? Math.floor((t % 1.6) * 12) : 0;
    const key = `${pose}:${n}`;
    let c = this.heroCache.get(key);
    if (!c) {
      const f = heroFrame(this.look ?? "girl", pose, n / 12, ATTRS[this.attr]?.color ?? "#8a7cff");
      const canvas = document.createElement("canvas");
      canvas.width = f.w; canvas.height = f.h;
      const img = new ImageData(new Uint8ClampedArray(f.px.buffer.slice(0)), f.w, f.h);
      canvas.getContext("2d").putImageData(img, 0, 0);
      c = { canvas, ox: f.ox, oy: f.oy, glow: f.glow };
      this.heroCache.set(key, c);
    }
    return c;
  }

  /** 題目要掛在怪物頭上：回傳怪物頭頂在畫布上的位置（0～1） */
  monsterHead() {
    const m = this.monster;
    if (!m) return null;
    return { x: m.x / W, y: (GROUND - (HEAD[m.kind] ?? 42)) / H };
  }
}

function hex(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
export function mix(a, b, k) {
  const A = hex(a), B = hex(b);
  return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, "0")).join("");
}
function rampOf(c) { return [mix(c, "#000000", 0.85), mix(c, "#000000", 0.6), mix(c, "#000000", 0.3), c, mix(c, "#ffffff", 0.4), mix(c, "#ffffff", 0.75), "#ffffff"]; }
