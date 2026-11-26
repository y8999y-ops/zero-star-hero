// 戰鬥畫面（canvas）：背景、見習魔數師、墨水怪、魔法特效。只管畫面與動畫，答題規則在 battle.js。
// 解析度 384×216（橫版 16:9），用 CSS 放大（image-rendering: pixelated）。
// 下方 22% 會被答案按鈕蓋住，所以角色站在 y = 144（不是畫面最底）。

import { createFrame, clearFrame, createFx, composite, painterFor, hex as pfHex } from "../../../pixelfx/src/core/index.js";
import { pickSpell, ATTR_HIT, UNIT_SPELL, ULT, REACT, FX, INK, INK_POOF, crystalLight } from "./spells.js";
import { GRADES, ATTRS } from "../data.js";
import { heroFrame } from "../../fx/hero.js";
import { inkDropFrame } from "../../fx/ink-drop.js";
import { pagepageFrame } from "../../fx/pagepage.js";
import { crookedFlowerFrame } from "../../fx/crooked-flower.js";
import { inkKingBabyFrame } from "../../fx/ink-king-baby.js";
import { scatterPageFrame } from "../../fx/scatter-page.js";
import { doodleBatFrame } from "../../fx/doodle-bat.js";
import { chaosClockFrame } from "../../fx/chaos-clock.js";
import { inkKingPageFrame, inkKingGearFrame, inkKingCrystalFrame, inkKingTrueFrame } from "../../fx/ink-king-forms.js";
import { crystalBugFrame } from "../../fx/crystal-bug.js";
import { minusShadeFrame } from "../../fx/minus-shade.js";

// 程式畫的角色、怪物：每個姿勢一個循環多長（秒），每秒畫 12 格，畫過就快取
const SPRITES = {
  ink: { fn: inkDropFrame, loop: 1.2 }, page: { fn: pagepageFrame, loop: 1.0 },
  flower: { fn: crookedFlowerFrame, loop: 1.2 }, king: { fn: inkKingBabyFrame, loop: 2.0 },
  pages: { fn: scatterPageFrame, loop: 1.2 }, bat: { fn: doodleBatFrame, loop: 1.0 }, tick: { fn: chaosClockFrame, loop: 1.2 },
  kingPage: { fn: inkKingPageFrame, loop: 2.0 }, kingGear: { fn: inkKingGearFrame, loop: 2.0 },
  bug: { fn: crystalBugFrame, loop: 1.2 }, shade: { fn: minusShadeFrame, loop: 1.6 },
  kingCrystal: { fn: inkKingCrystalFrame, loop: 2.0 }, kingTrue: { fn: inkKingTrueFrame, loop: 2.0 },
};
// 每個區域會出現的雜兵、王（還沒畫的區域先用墨水滴）
const MINIONS = { g1: ["ink", "flower"], g2: ["pages", "bat"], g34: ["tick", "bat"], g56: ["bug", "flower"], jh: ["shade", "bat"] };
const BOSS = { g1: "king", g2: "kingPage", g34: "kingGear", g56: "kingCrystal", jh: "kingTrue" };
const HEAD = { ink: 42, flower: 50, king: 96, slime: 110, pages: 34, bat: 48, tick: 44, kingPage: 104, kingGear: 102, bug: 36, shade: 36, kingCrystal: 100, kingTrue: 104 };   // 頭頂離腳底幾格（題目、答案數字掛在這裡）
import { MathMagic, PopNumber } from "./mathmagic.js";
import { areaArtNow, battleHDNow } from "./areaart.js";
import { Ambience } from "./ambience.js";

// 高度固定 216；寬度跟著螢幕比例（手機比較寬、平板比較方），背景圖 384 寬放在中間，兩邊不夠就鏡射補上
export let W = 384;
export const H = 216, GROUND = 144;
const ART_W = 384;
const PX = 76;               // 玩家腳下 x
const REACH = 146;           // 怪物走到這裡＝撞到玩家
// 人物放大 1.5 倍（使用者 2026-11-25）：畫布內部解析度是 2 倍（R），人物畫成 3 倍＝看起來 1.5 倍，像素還是整整齊齊的方塊。
// 其他東西（特效、背景、數字）照原本 384×216 的格子畫，只是整個放大 2 倍。
const R = 2, CS = 1.5;
// 王本來就快 100 格高，放大 1.5 倍頭會超出畫面上緣：王只放大 1.25 倍
const scaleOf = (kind) => (kind?.startsWith("king") ? 1.25 : CS);
let START = 356;             // 怪物出現的位置（離右邊 28）
let WAIT = 262;              // 不限時：怪物停在這裡等（離右邊 122）
// 數學變魔法的版面原本以 288 寬設計，整塊往右、往上移到畫面中央偏上
let MAGIC_OX = W / 2 - 144; const MAGIC_OY = -26;
/** 依畫面比例設定戰鬥畫面的寬度（每次開新戰鬥時） */
export function fitWidth(aspect) {
  W = Math.max(288, Math.min(480, Math.round((H * aspect) / 2) * 2));
  START = W - 28; WAIT = W - 122; MAGIC_OX = W / 2 - 144;
  return W;
}

export class Stage {
  constructor(canvas, gradeId, look, attr, settings = {}, extra = {}) {
    this.extra = extra;          // 學院練習：{ area：用哪一區的背景, kinds：出哪種墨水怪 }
    this.opt = { shake: settings.shake !== false, softFlash: settings.flash === "soft", shortMagic: settings.magic === "short" };
    this.cv = canvas;
    canvas.width = W * R; canvas.height = H * R;
    this.ctx = canvas.getContext("2d");
    this.ctx.setTransform(R, 0, 0, R, 0, 0);
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
    // 背景：有 AI 原圖版就用原圖（DOM 圖片疊在畫布後面）；沒有的話用像素版；都沒有用暫用色塊
    const hd = battleHDNow(gradeId, extra.area);
    this.art = hd ?? areaArtNow(gradeId);
    if (hd) this.mountHD(hd);
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

  /** 原圖背景：在畫布後面放 back／mid／ground 三張圖，版面照像素版的數字（1 格＝畫面高 / 216） */
  mountHD(A) {
    const host = this.cv.parentElement;
    const box = document.createElement("div"); box.className = "bghd";
    const back = A.back.cloneNode(); back.className = "b";
    const art = document.createElement("div"); art.className = "art";
    const mid = A.mid.cloneNode(); mid.className = "m";
    const gr = document.createElement("div"); gr.className = "g"; gr.style.backgroundImage = `url(${A.ground.src})`;
    const fill = document.createElement("div"); fill.className = "gf"; fill.style.backgroundImage = `url(${A.ground.src})`;
    const tint = document.createElement("div"); tint.className = "tint";
    art.append(mid); box.append(back, art, gr, fill, tint);
    host.insertBefore(box, this.cv);
    const layout = () => {
      const h = box.clientHeight || 1, w = box.clientWidth, u = h / 216, k = A.k;
      const mw = (A.mid.naturalWidth / k) * u, mh = (A.mid.naturalHeight / k) * u, gw = (A.ground.naturalWidth / k) * u, gh = (A.ground.naturalHeight / k) * u;
      Object.assign(mid.style, { width: `${mw}px`, height: `${mh}px`, left: `${(w - mw) / 2}px`, top: `${(A.groundTop + A.midSink) * u - mh}px` });
      Object.assign(gr.style, { top: `${A.groundTop * u}px`, height: `${gh}px`, backgroundSize: `${gw}px ${gh}px`, backgroundPosition: `${(w - gw) / 2}px 0` });
      Object.assign(fill.style, { top: `${A.groundTop * u + gh}px`, backgroundSize: `${gw}px ${gh}px`, backgroundPosition: `${(w - gw) / 2}px ${-gh * 0.6}px` });
      this.hdU = u;
    };
    layout();
    this.hdBox = box; this.hdTint = tint; this.hdGray = -1;
    this.hdResize = new ResizeObserver(layout); this.hdResize.observe(box);
  }

  spawn(boss = false, force = null) {   // force：指定哪一種（教學固定是墨水滴）
    // 雜兵：這個區域的幾種輪流隨機出現；王：這個區域的王（還沒畫的區域先用放大的 pixelfx 史萊姆）
    const id = this.gradeId;
    const pool = this.extra.kinds ?? MINIONS[id] ?? ["ink"];
    const kind = force ?? (boss ? BOSS[id] ?? "slime" : pool[Math.floor(Math.random() * pool.length)]);
    this.monster = kind === "slime"
      ? { boss, kind, x: START, hp: 1, state: "walk", t: 0, alpha: 1, inst: createFx(FX.slime, { palette: INK, seed: 1 + Math.floor(Math.random() * 50), hop: 14 }) }
      : { boss, kind, x: boss ? W - 70 : START, hp: 1, state: "walk", t: 0, alpha: 1, phase: Math.random() * 2, flinch: 0 };
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
    if (m.boss) m.target = Math.min(m.target, W - 70);         // 王比較大：站太右邊身體會被切掉
  }

  /** 施法。回傳 Promise：打中時 resolve。 */
  cast(tier, crystalLv = 1, branch = null, extraAttr = null) {
    // 題目決定招式：有單元的題目打那個單元的招式（屬性色）；連擊第 3、4 級再疊上屬性大招
    // 2026-11-25：五種法師只差造型和攻擊特效 → 每一級都打自己屬性的招式（好幾種隨機挑）；第 2 級起再疊上單元的招式（屬性色）
    const base = pickSpell(this.attr, tier - 1), us = branch && UNIT_SPELL[branch];
    const spell = !us || tier < 2 ? { ...base, parts: [...base.parts] }
      : { hit: Math.max(us.hit + 0.1, base.hit + 0.2), shake: base.shake ?? tier, parts: [...us.parts, ...base.parts.map((p) => ({ ...p, delay: p.delay + 0.2 }))] };
    // 屬性組合技：再疊上副屬性的大魔法（它自己的顏色）
    if (extraAttr) {
      const ex = pickSpell(extraAttr, 2);
      spell.parts = [...spell.parts, ...ex.parts.map((p) => ({ ...p, delay: p.delay + 0.2 }))];
      spell.hit = Math.max(spell.hit, ex.hit + 0.2); spell.shake = (spell.shake ?? 2) + 3;
    }
    const m = this.monster;
    const tx = m ? m.x : 270;
    this.castT = 0;
    this.dimTo = [0, 0.25, 0.35, 0.45, 0.6][tier];
    this.dimHold = 0.15 + spell.hit + 0.5;
    const ramp = rampOf(ATTRS[this.attr].color);
    this.addFx(FX.castCircle, { x: PX, y: GROUND + 2, speed: 1.6, dur: 0.8, opts: { palette: ramp } });
    // 集氣：杖頭先聚一團光（越強的魔法聚越久、越大）
    this.addFx(FX.spellCharge, { x: PX + 6, y: GROUND - 20, speed: 1.4 + tier * 0.2, dur: 0.15 + spell.hit * 0.5, opts: { palette: ramp } });
    for (const p of spell.parts) {
      const o = { ...(p.opts ?? {}), light: crystalLight(crystalLv), ...(p.tint ? { palette: ramp } : {}) };
      let x = 0, y = GROUND, from = null, to = null;
      if (p.at === "caster") { x = PX + 15 + (p.x ?? 0); y = GROUND + (p.y ?? -(p.mod.meta.origin[1] < 40 ? 24 : 0)); if ("length" in (p.mod.meta.options ?? {})) o.length = Math.max(40, tx - PX - 15); }
      else if (p.at === "target") { x = tx + (p.x ?? 0); y = GROUND + (p.y ?? 0); }
      else { const dy = p.drop ?? 0; from = [PX + 18, GROUND - 27 + dy]; to = [tx - 6, GROUND - 21 + dy]; x = from[0]; y = from[1]; }
      this.addFx(p.mod, { x, y, from, to, delay: 0.15 + p.delay, speed: p.speed, dur: p.dur, opts: o });
    }
    this.crystalLv = crystalLv;
    return new Promise((res) => setTimeout(() => { this.shake = (spell.shake ?? 2) + tier + (crystalLv >= 5 ? 2 : 0); this.impact(tier); res(); }, (0.15 + spell.hit) * 1000));
  }

  /** 數晶大招：① 集氣 0.9 秒（畫面很暗、腳下大魔法陣、杖頭把光吸進來）② 一連串屬性大招 ③ 光爆＋長停頓＋大晃動。回傳 Promise：打中時 resolve */
  ultimate(crystalLv = 1, extraAttr = null) {
    const U = ULT[this.attr] ?? ULT.fire, ramp = rampOf(ATTRS[this.attr].color), m = this.monster, tx = m ? m.x : 270;
    const CH = 0.9;                         // 集氣多久
    this.castT = 0; this.castHold = CH + U.hit + 0.3; this.dimTo = 0.72; this.dimHold = CH + U.hit + 0.9;   // 主角整段都維持施法姿勢
    this.addFx(FX.circleCast, { x: PX, y: GROUND + 4, speed: 2.2, dur: CH + U.hit, opts: { palette: ramp } });
    this.addFx(FX.implosion, { x: PX + 8, y: GROUND - 30, speed: 1.25, opts: { palette: ramp } });    // 光被吸進杖頭，0.88 秒時炸開＝出手
    this.addFx(FX.spellCharge, { x: PX + 6, y: GROUND - 20, speed: 1.6, dur: CH, opts: { palette: ramp } });
    const o = { light: crystalLight(crystalLv) + 0.2 };
    for (const p of U.parts) {
      let x = p.at === "caster" ? PX + 15 + (p.x ?? 0) : tx + (p.x ?? 0), y = GROUND + (p.y ?? (p.at === "caster" && p.mod.meta.origin[1] < 40 ? -24 : 0));
      const opts = { ...(p.opts ?? {}), ...o };
      if (p.at === "caster" && "length" in (p.mod.meta.options ?? {})) opts.length = Math.max(40, tx - PX - 15);
      this.addFx(p.mod, { x, y, delay: CH + p.delay, speed: p.speed, dur: p.dur, opts });
    }
    if (extraAttr) { const ex = pickSpell(extraAttr, 3); for (const p of ex.parts) if (p.at === "target") this.addFx(p.mod, { x: tx + (p.x ?? 0), y: GROUND + (p.y ?? 0), delay: CH + 0.2 + p.delay, speed: p.speed, dur: p.dur, opts: p.opts ?? {} }); }
    this.crystalLv = crystalLv;
    // 出手那一下：畫面閃屬性色、小晃
    setTimeout(() => { this.flashT = 0.16; this.flashA = this.opt.softFlash ? 0.2 : 0.4; this.flashC = ramp[5]; this.shake = 4; }, CH * 1000);
    return new Promise((res) => setTimeout(() => {
      this.impact(4);
      // 大招才有的收尾：光芒四射＋兩圈魔力爆發＋煙火、打擊停頓拉長、畫面晃很大、閃白
      this.addFx(FX.sunburst, { x: tx, y: GROUND - 28, speed: 2, dur: 0.75, opts: { palette: [...ramp, "#ffffff"].slice(-8), rays: 12 } });
      this.addFx(FX.manaBurst, { x: tx, y: GROUND + 4, speed: 1.4, delay: 0.12, opts: { palette: [...ramp].reverse(), seed: 4 } });
      this.addFx(FX.fireworkBurst, { x: tx, y: GROUND - 50, speed: 1.8, delay: 0.1, opts: { palette: ramp } });
      this.freezeT = 0.22; this.shake = 14 + (crystalLv >= 5 ? 3 : 0);
      this.flashT = 0.16; this.flashA = this.opt.softFlash ? 0.3 : 0.75; this.flashC = "#ffffff";
      res();
    }, (CH + U.hit) * 1000));
  }

  /** 技能發動時角色身上的小特效（回復、護陣、慢流、分身…） */
  skillFx(kind) {
    const at = { x: PX, y: GROUND };
    if (kind === "heal") this.addFx(FX.healFx, { ...at, speed: 1.4 });
    else if (kind === "shield") this.addFx(FX.divineShield, { x: PX, y: GROUND - 4, speed: 1.2, dur: 1.4, opts: { palette: ["#0a1838", "#14306a", "#2456a8", "#3f86e0", "#7ab8ff", "#bfe0ff", "#eaf6ff", "#ffffff"] } });
    else if (kind === "slow") { const m = this.monster; this.addFx(FX.slowed, { x: m ? m.x : 270, y: GROUND, speed: 1, dur: 1.6 }); }
    else if (kind === "double") this.addFx(FX.haste, { x: PX + 10, y: GROUND, speed: 1, dur: 1.2 });
    else this.addFx(FX.castCircle, { x: PX, y: GROUND + 2, speed: 1.8, dur: 0.8, opts: { palette: rampOf(ATTRS[this.attr].color) } });
  }

  /** 打中的那一下（2026-11-25 使用者：攻擊動畫要更華麗）：
   *  打擊火花（第 3、4 級是爆擊火花）、第 4 級多一圈魔力爆發、畫面閃一下屬性色、打擊停頓、怪物被擊退並閃白 */
  impact(tier) {
    const m = this.monster, x = m ? m.x : 270, ramp = rampOf(ATTRS[this.attr].color), soft = this.opt.softFlash;
    // 屬性自己的打擊火花
    const H = ATTR_HIT[this.attr];
    if (H) this.addFx(H.mod, { x: x + (H.x ?? 0), y: GROUND + (H.y ?? 0), speed: H.speed, dur: H.dur, opts: { light: 0.8, ...(H.opts ?? {}) } });
    this.addFx(tier >= 2 ? FX.critHit : FX.hitSpark, { x: x - 6, y: GROUND - 18, speed: 1.3, opts: { palette: [...ramp, "#ffffff"], height: 18 + tier * 5 } });
    this.addFx(FX.hitFlash, { x, y: GROUND - 20, speed: 1.2, opts: { palette: ramp } });
    // 2026-11-26 使用者：普通攻擊要更華麗、打怪反饋更強 → 每一下都有：墨水被打飛的碎屑、屬性反應、怪物被壓扁再彈回、打擊停頓加長
    this.addFx(FX.bluntHit, { x: x + 4, y: GROUND, speed: 1.4, opts: { palette: INK, warm: ramp[4], dust: "#7a6cb0", clod: "#2d2350", height: 16 + tier * 3, seed: 3 + tier } });
    if (tier >= 3) this.addFx(FX.manaBurst, { x, y: GROUND + 4, speed: 1.9, opts: { palette: ramp } });
    const R0 = REACT[this.attr];
    if (R0 && m) { this.addFx(R0.mod, { x, y: GROUND + R0.y, speed: 1.2, dur: R0.dur, opts: { ...(R0.opts ?? {}) } }); m.tintC = R0.tint; m.tintT = 0.55; m.jitter = R0.jitter ? 0.45 : 0; }
    if (tier >= 4) this.addFx(FX.manaBurst, { x, y: GROUND + 4, speed: 1.6, delay: 0.1, opts: { palette: [...ramp].reverse() } });
    // 數晶外觀進化（企劃書 8.7）：數晶等級越高，打中時多一層——Lv2 多一道閃光、Lv3 多一圈反方向的火花、
    // Lv4 第 3 級魔法也有魔力爆發、Lv5 終極魔法換成第二型態（兩圈魔力爆發、畫面晃更大）
    const lv = this.crystalLv ?? 1;
    if (lv >= 2) this.addFx(FX.hitFlash, { x: x + 4, y: GROUND - 30, speed: 1.4, delay: 0.06, opts: { palette: ramp } });
    if (lv >= 3) this.addFx(FX.hitSpark, { x: x + 6, y: GROUND - 10, speed: 1.2, delay: 0.08, opts: { palette: [...ramp, "#ffffff"], height: 16, seed: 9, flip: true } });
    if (lv >= 4 && tier === 3) this.addFx(FX.manaBurst, { x, y: GROUND + 4, speed: 1.9, opts: { palette: ramp } });
    if (lv >= 5 && tier >= 4) this.addFx(FX.manaBurst, { x, y: GROUND + 4, speed: 1.3, delay: 0.25, opts: { palette: [...ramp].reverse(), seed: 4 } });
    this.flashT = 0.16; this.flashA = (soft ? 0.12 : 0.22) + tier * (soft ? 0.03 : 0.06); this.flashC = ramp[5];
    this.freezeT = 0.07 + tier * 0.035;                // 打擊停頓：畫面頓一下，打下去比較有重量
    if (m) { m.kb = 10 + tier * 5; m.whiteT = 0.16; m.squash = 1; }
    this.punch = 0.12 + tier * 0.03;                    // 畫面往前推一下（CSS 放大一點點再回來）
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
      this.addFx(FX.hitFlash, { x: PX + 6, y: GROUND - 9, flip: true, opts: { palette: INK_POOF } });
    }, 220);
  }

  update(dt) {
    // 打擊停頓：怪物和特效停住一下（數字、晃動照走）
    if (this.freezeT > 0) { this.freezeT -= dt; this.shake = Math.max(0, this.shake - dt * 6); return; }
    this.t += dt;
    if (this.flashT > 0) this.flashT -= dt;
    if (this.castT >= 0) { this.castT += dt; if (this.castT > (this.castHold ?? 0.6) && !this.magic?.active) { this.castT = -1; this.castHold = 0.6; } }
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
      if (m.kb > 0) m.kb = Math.max(0, m.kb - dt * 40);
      if (m.whiteT > 0) m.whiteT -= dt;
      if (m.squash > 0) m.squash = Math.max(0, m.squash - dt * 4);
      if (m.tintT > 0) m.tintT -= dt;
      if (m.jitter > 0) m.jitter -= dt;
      if (m.barHit > 0) m.barHit -= dt;
      // 血條：紅色很快縮到目前的血、後面白色那段慢慢跟上
      m.hpShow = m.hpShow == null ? m.hp : m.hpShow + (m.hp - m.hpShow) * Math.min(1, dt * 10);
      m.hpLag = m.hpLag == null ? m.hp : m.hpLag > m.hpShow ? Math.max(m.hpShow, m.hpLag - dt * 0.9 * (m.maxHp ?? 1)) : m.hpShow;
      if (m.state === "walk" && m.target != null) m.x += (m.target - m.x) * Math.min(1, dt * 3);
      if (m.state === "bump") {
        const u = Math.min(1, m.t / 0.5);
        m.x = m.home ??= m.x;
        m.x = m.home - (m.home - (PX + 38 + (m.kind.startsWith("king") ? 50 : 0))) * Math.sin(u * Math.PI);
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
    if (this.punch > 0) { this.punch = Math.max(0, this.punch - dt); this.cv.style.transform = this.opt.shake && this.punch > 0.01 ? `scale(${1 + this.punch * 0.12})` : ""; }
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
      p.glow(PX + (gx - this.hero.ox) * CS, GROUND + (gy - this.hero.oy) * CS, (this.castT >= 0 ? 7 : 4) + Math.max(0, (this.extra.crystalLv ?? 1) - 1), pfHex(ATTRS[this.attr]?.color ?? "#8a7cff"), this.castT >= 0 ? 0.7 : 0.35);
    }

    const m = this.monster;

    for (const f of this.fx) if (f.inst) f.inst.draw(frame, "front");
    this.magic?.draw(p);
    for (const n of this.pops) n.draw(p);

    // 合成：背景 → 王（放大）→ 特效層
    const sk = this.opt.shake ? this.shake : 0;
    const sx = sk ? Math.round((Math.random() - 0.5) * sk) : 0;
    const sy = sk ? Math.round((Math.random() - 0.5) * sk) : 0;
    if (this.art?.hd) {
      // 原圖背景在畫布後面：畫布清空成透明；灰色用 CSS 濾鏡、晃動用位移
      ctx.clearRect(0, 0, W, H);
      if (Math.abs(this.hdGray - this.gray) > 0.004) {
        this.hdGray = this.gray;
        this.hdBox.style.filter = this.gray > 0.004 ? `grayscale(${0.85 * this.gray}) brightness(${1 - 0.22 * this.gray})` : "";
        this.hdTint.style.opacity = this.gray;
      }
      const u = this.hdU ?? 1;
      this.hdBox.style.transform = sx || sy ? `translate(${sx * u}px, ${sy * u}px)` : "";
      this.ambience.draw(ctx, sx, sy, this.gray);
    } else if (this.ambience) {
      // 正式背景＋動態；每一層都是彩色版上疊灰色版，gray 從 1 漸變到 0 就是「恢復色彩」
      const bx = Math.round((W - ART_W) / 2);
      this.ambience.draw(ctx, sx + bx, sy, this.gray);
      // 畫面比背景寬：兩邊用鏡射補滿
      if (bx > 0) {
        ctx.save(); ctx.scale(-1, 1);
        ctx.drawImage(this.cv, bx * R, 0, bx * R, H * R, -bx, 0, bx, H);
        ctx.drawImage(this.cv, (W - bx * 2) * R, 0, bx * R, H * R, -W, 0, bx, H);
        ctx.restore();
      }
    } else {
      ctx.drawImage(this.bg, sx, sy);
      if (this.gray > 0) { ctx.fillStyle = `rgba(40,34,60,${0.35 * this.gray})`; ctx.fillRect(0, 0, W, H); }
    }
    if (this.dim > 0.01) { ctx.fillStyle = `rgba(8,6,20,${this.dim})`; ctx.fillRect(0, 0, W, H); }
    // 角色腳下的影子：讓角色從背景裡浮出來（尤其是跟草地同色系的）
    const shadow = (x, rx) => { ctx.fillStyle = "rgba(20,14,40,0.32)"; ctx.fillRect(Math.round(x - rx) + sx, GROUND - 1 + sy, rx * 2, 2); ctx.fillRect(Math.round(x - rx + 2) + sx, GROUND + 1 + sy, rx * 2 - 4, 1); };
    if (this.hero) shadow(PX, 12);
    if (m && m.alpha > 0 && !m.kind.startsWith("king")) shadow(m.x, m.kind === "slime" ? 20 : 13);
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
    const big = (c, x, y, ox, oy, k = CS) => ctx.drawImage(c, x - ox * k + sx, y - oy * k + sy, c.width * k, c.height * k);
    if (this.hero) big(this.hero.canvas, PX, GROUND, this.hero.ox, this.hero.oy);
    // 頁頁：浮在主角左上方，表情跟著戰鬥變
    const pg = this.sprite("page", this.t > this.pageUntil ? "idle" : this.pagePose, this.t);
    big(pg.canvas, PX - 42, GROUND - 38, pg.ox, pg.oy);
    // 程式畫的怪物（墨水滴、歪瓣花、墨水大王）：被淨化、被打中時是 hurt 姿勢
    if (m && SPRITES[m.kind] && m.alpha > 0) {
      const sp = this.sprite(m.kind, m.state === "die" || m.flinch > 0 ? "hurt" : "idle", m.t + m.phase);
      ctx.globalAlpha = m.alpha;
      const mx = Math.round(m.x + (m.kb ?? 0) + (m.jitter > 0 ? (Math.random() - 0.5) * 4 : 0));
      // 王變身（第二階段）：身體變大一點，外面一圈一閃一閃的紫色光暈
      const k = scaleOf(m.kind) * (m.phase2 ? 1.12 : 1);
      if (m.phase2) {
        ctx.globalAlpha = (0.35 + 0.25 * Math.sin(this.t * 6)) * m.alpha;
        for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) big(tintOf(sp.canvas, "#b483ff"), mx + dx, GROUND + dy, sp.ox, sp.oy, k);
        ctx.globalAlpha = m.alpha;
      }
      // 被打中：先壓扁再彈回（腳下不動）
      const sq = m.squash > 0 ? Math.sin(m.squash * Math.PI) * 0.22 * m.squash : 0;
      const drawM = (c) => ctx.drawImage(c, mx - sp.ox * k * (1 + sq) + sx, GROUND - sp.oy * k * (1 - sq) + sy, c.width * k * (1 + sq), c.height * k * (1 - sq));
      drawM(sp.canvas);
      if (m.whiteT > 0) {        // 被打中閃白
        ctx.globalAlpha = Math.min(1, m.whiteT / 0.14) * 0.85 * m.alpha;
        drawM(whiteOf(sp.canvas));
      } else if (m.tintT > 0 && m.tintC) {   // 接著染上屬性色（燒紅、結霜、觸電…）慢慢退掉
        ctx.globalAlpha = Math.min(1, m.tintT / 0.55) * 0.5 * m.alpha;
        drawM(tintOf(sp.canvas, m.tintC));
      }
      ctx.globalAlpha = 1;
      // 怪物血條（2026-11-26 使用者：顯示血條、不寫數字）：頭上一條像素小血條；王的血條在畫面右上角（HTML）
      if (!m.boss && m.maxHp) this.hpBar(mx, Math.round(GROUND - (HEAD[m.kind] ?? 42) * scaleOf(m.kind) - 9), m);
    }
    composite(frame, this.img.data, null, this.opt.softFlash ? 0.55 : 1);
    this.lctx.putImageData(this.img, 0, 0);
    ctx.drawImage(this.layer, sx, sy);
    if (this.flashT > 0) { ctx.globalAlpha = (this.flashT / 0.16) * this.flashA; ctx.fillStyle = this.flashC; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  }

  hpBar(cx, y, m) {
    // 2026-11-26 使用者：血量改成數值、掉血要有特效 → 血條不寫數字；被打時血條抖一下、閃白，紅色很快縮、白色那段慢慢跟上；剩不到三成會一閃一閃
    const ctx = this.ctx, w = 34, hit = Math.max(0, m.barHit ?? 0);
    const x = Math.round(cx - w / 2 + (hit > 0 ? (Math.random() - 0.5) * 4 * hit / 0.35 : 0)), yy = y + (hit > 0.2 ? -1 : 0);
    const k = Math.max(0, m.hpShow ?? m.hp) / m.maxHp, lag = Math.max(0, m.hpLag ?? m.hp) / m.maxHp;
    const low = k < 0.3 && Math.floor(this.t * 6) % 2 === 0;
    ctx.globalAlpha = m.alpha;
    ctx.fillStyle = "#11102e"; ctx.fillRect(x - 1, yy - 1, w + 2, 7);
    ctx.fillStyle = "#3a3058"; ctx.fillRect(x, yy, w, 5);
    ctx.fillStyle = "#fff4e0"; ctx.fillRect(x, yy, Math.round(w * lag), 5);
    const fw = Math.round(w * k);
    ctx.fillStyle = low ? "#ff9a3c" : "#e8405e"; ctx.fillRect(x, yy, fw, 5);
    ctx.fillStyle = low ? "#ffd08a" : "#ff8aa0"; ctx.fillRect(x, yy, fw, 2);
    ctx.fillStyle = "#b02848"; ctx.fillRect(x, yy + 4, fw, 1);
    if (hit > 0.22) { ctx.globalAlpha = m.alpha * 0.8; ctx.fillStyle = "#ffffff"; ctx.fillRect(x - 1, yy - 1, w + 2, 7); }
    ctx.globalAlpha = 1;
  }

  /** 傷害數字（從怪物身上彈出來、往旁邊落下）。kind：hit 一般、crit 暴擊、heal 補血、block 擋住 */
  damage(n, kind = "hit") {
    const m = this.monster;
    const x = (m ? m.x : 270) + 18, y = GROUND - Math.min(60, (HEAD[m?.kind] ?? 42) * scaleOf(m?.kind)) * 0.45;
    if (m && kind !== "heal") m.barHit = 0.35;
    this.pops.push(new DmgNumber(kind === "heal" ? `+${n}` : String(n), x, y, kind));
  }

  /** 恢復色彩：灰色慢慢退掉（打倒王時） */
  restoreColor() { this.grayTo = 0; }

  /** 數學變魔法：算式變成光球、光球飛向怪物。回傳 Promise（光球出手時 resolve） */
  mathMagic(math) {
    const m = this.monster;
    // 目標座標換成演出版面自己的座標（版面整塊位移了 MAGIC_OX、MAGIC_OY）
    this.magic = new MathMagic(ATTRS[this.attr]?.color ?? "#8a7cff", [(m ? m.x : 270) - MAGIC_OX, GROUND - 15 - MAGIC_OY], [MAGIC_OX, MAGIC_OY]);
    this.castT = 0;
    this.dimTo = 0.3; this.dimHold = 9;
    const run = this.magic.start(math);
    if (this.opt.shortMagic) this.magic.speed = 2.5;   // 設定：簡短演出
    return run.then(() => { this.dimHold = 0; });
  }

  /** 打中時在怪物頭上跳出答案數字 */
  popNumber(text, combo) {
    const m = this.monster;
    this.pops.push(new PopNumber(String(text).replace("−", "-"), m ? m.x : 270, GROUND - (HEAD[m?.kind] ?? 42) * scaleOf(m?.kind) - 24, ATTRS[this.attr]?.color ?? "#8a7cff", combo >= 10 ? 4 : combo >= 6 ? 3 : 2));
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
    const form = name === "page" ? this.extra.pageForm ?? 0 : 0;      // 頁頁的樣子（萬題之書恢復幾章）
    const key = `${name}:${pose}:${n}:${form}`;
    let c = this.heroCache.get(key);
    if (!c) {
      const f = S.fn(pose, n / 12, form);
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
    return { x: m.x / W, y: Math.max(26, GROUND - (HEAD[m.kind] ?? 42) * scaleOf(m.kind)) / H };
  }
}

function hex(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
export function mix(a, b, k) {
  const A = hex(a), B = hex(b);
  return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, "0")).join("");
}
// 一張角色圖的白色剪影（被打中閃白用），畫過就記起來
const whiteCache = new WeakMap();
function whiteOf(c) {
  let w = whiteCache.get(c);
  if (!w) { w = document.createElement("canvas"); w.width = c.width; w.height = c.height; const x = w.getContext("2d"); x.drawImage(c, 0, 0); x.globalCompositeOperation = "source-in"; x.fillStyle = "#ffffff"; x.fillRect(0, 0, w.width, w.height); whiteCache.set(c, w); }
  return w;
}
const tintCache = new Map();
function tintOf(c, col) {
  let byCol = tintCache.get(c); if (!byCol) { byCol = {}; tintCache.set(c, byCol); }
  if (!byCol[col]) { const w = document.createElement("canvas"); w.width = c.width; w.height = c.height; const x = w.getContext("2d"); x.drawImage(c, 0, 0); x.globalCompositeOperation = "source-in"; x.fillStyle = col; x.fillRect(0, 0, w.width, w.height); byCol[col] = w; }
  return byCol[col];
}
function rampOf(c) { return [mix(c, "#000000", 0.85), mix(c, "#000000", 0.6), mix(c, "#000000", 0.3), c, mix(c, "#ffffff", 0.4), mix(c, "#ffffff", 0.75), "#ffffff"]; }

// 傷害數字：先放大彈出、往右上跳再落下、最後淡掉；暴擊是金色、比較大，補血是綠色往上飄
const DMG_COLOR = { hit: ["#ffd23f", "#5a1a08"], crit: ["#ff6a3c", "#2a0800"], heal: ["#9df0b0", "#0e4a22"], block: ["#bfe0ff", "#14306a"] };   // 跟答案數字（白色、頭上）分開：傷害是黃／橘紅、在身體旁邊
class DmgNumber {
  constructor(text, x, y, kind) { Object.assign(this, { text, x, y, kind, t: 0, vx: 18 + Math.random() * 14 }); }
  update(dt) { this.t += dt; }
  get done() { return this.t > 1.0; }
  draw(p) {
    p.place(0, 0, false, 0);
    const u = this.t, crit = this.kind === "crit", heal = this.kind === "heal";
    const pop = u < 0.1 ? 1.8 - u * 8 : 1;
    const x = this.x + (heal ? 0 : this.vx * u);
    const y = heal ? this.y - 26 * u : this.y - 34 * u + 60 * u * u;
    const a = u > 0.7 ? Math.max(0, 1 - (u - 0.7) / 0.3) : 1;
    const [c, o] = DMG_COLOR[this.kind] ?? DMG_COLOR.hit;
    p.text(this.text, x, y, pfHex(c), { font: "big", scale: Math.max(1, Math.round((crit ? 3 : 2) * pop)), align: "center", outline: pfHex(o), a });
    if (crit) p.glow(x, y + 6, 18, pfHex("#ff7a2f"), 0.6 * a);
  }
}
