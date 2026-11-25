// 戰鬥畫面（canvas）：背景、見習魔數師、墨水怪、魔法特效。只管畫面與動畫，答題規則在 battle.js。
// 解析度 288×240，用 CSS 放大（image-rendering: pixelated）。

import { createFrame, clearFrame, createFx, composite, painterFor, hex as pfHex } from "../../../pixelfx/src/core/index.js";
import { SPELLS, FX, INK, INK_POOF, crystalLight } from "./spells.js";
import { GRADES, ATTRS } from "../data.js";
import { heroFrame } from "../../fx/hero.js";

export const W = 288, H = 240, GROUND = 206;
const PX = 58;               // 玩家腳下 x
const REACH = 112;           // 怪物走到這裡＝撞到玩家
const START = 270;           // 怪物出現的位置
const WAIT = 170;            // 不限時：怪物停在這裡等

export class Stage {
  constructor(canvas, gradeId, look, attr) {
    this.cv = canvas;
    canvas.width = W; canvas.height = H;
    this.ctx = canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;
    this.g = GRADES[gradeId];
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
    this.fx = [];            // { inst, x, y, from, to, delay, t, dur, speed, follow }
    this.monster = null;
    this.t = 0; this.shake = 0; this.hurtT = 0; this.castT = -1;
    this.gray = 1;           // 1＝被墨水弄灰，0＝恢復色彩
    this.dim = 0;            // 施法時畫面暗下來，讓魔法的光更明顯
    this.bg = this.paintBackground();
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

  spawn(boss = false) {
    this.monster = {
      boss, x: START, hp: 1, state: "walk", t: 0, alpha: 1,
      inst: createFx(FX.slime, { palette: INK, seed: 1 + Math.floor(Math.random() * 50), hop: boss ? 14 : 22 }),
    };
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
    const tx = m ? m.x : 200;
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
    if (this.castT >= 0) { this.castT += dt; if (this.castT > 0.6) this.castT = -1; }
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.dimHold = Math.max(0, (this.dimHold ?? 0) - dt);
    const goal = this.dimHold > 0 ? this.dimTo : 0;
    this.dim += (goal - this.dim) * Math.min(1, dt * (goal > this.dim ? 10 : 3));
    this.shake = Math.max(0, this.shake - dt * 18);
    const m = this.monster;
    if (m) {
      m.t += dt;
      m.inst.update(dt);
      if (m.state === "walk" && m.target != null) m.x += (m.target - m.x) * Math.min(1, dt * 3);
      if (m.state === "bump") {
        const u = Math.min(1, m.t / 0.5);
        m.x = m.home ??= m.x;
        m.x = m.home - (m.home - (PX + 26)) * Math.sin(u * Math.PI);
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
    if (m && !m.boss) {
      m.inst.options.x = Math.round(m.x); m.inst.options.y = GROUND;
      m.inst.options.flip = true;
      if (m.alpha > 0) m.inst.draw(frame);
    }

    for (const f of this.fx) if (f.inst) f.inst.draw(frame, "front");

    // 合成：背景 → 王（放大）→ 特效層
    const sx = this.shake ? Math.round((Math.random() - 0.5) * this.shake) : 0;
    const sy = this.shake ? Math.round((Math.random() - 0.5) * this.shake) : 0;
    ctx.drawImage(this.bg, sx, sy);
    if (this.gray > 0) { ctx.fillStyle = `rgba(40,34,60,${0.35 * this.gray})`; ctx.fillRect(0, 0, W, H); }
    if (this.dim > 0.01) { ctx.fillStyle = `rgba(8,6,20,${this.dim})`; ctx.fillRect(0, 0, W, H); }
    if (m && m.boss && m.alpha > 0) {
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
    composite(frame, this.img.data, null);
    this.lctx.putImageData(this.img, 0, 0);
    ctx.drawImage(this.layer, sx, sy);
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
    return { x: m.x / W, y: (m.boss ? GROUND - 110 : GROUND - 42) / H };
  }
}

function hex(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
export function mix(a, b, k) {
  const A = hex(a), B = hex(b);
  return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, "0")).join("");
}
function rampOf(c) { return [mix(c, "#000000", 0.85), mix(c, "#000000", 0.6), mix(c, "#000000", 0.3), c, mix(c, "#ffffff", 0.4), mix(c, "#ffffff", 0.75), "#ffffff"]; }
