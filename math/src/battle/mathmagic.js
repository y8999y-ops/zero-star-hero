// 數學變魔法（企劃書 7.8）：答對後，把算式變成看得見的光球，再化成魔法。
// 加法：兩堆光球合在一起，個位湊滿 10 顆就融成一顆「十」的大光球（進位）。
// 減法：不夠減時先把一顆大光球拆成 10 顆小光球（借位），再讓要減掉的光球飄走熄滅。
// 乘法：一列光球往下複製成 a 列，排成 a×b 的方陣；數字太大時改用面積模型（十位和個位分開算再相加）。
// 除法：光球像發牌一樣一顆一顆平分成 b 束，每束框起來就是答案。
// 光球排成「十格板」（上下兩排、一排 5 格），跟課本一樣，一眼看得出湊十。
//
// 用法：const m = new MathMagic(colorHex); m.start({ op: "+", a: 7, b: 5 }) → Promise（光球飛出去時 resolve）
//      每格 m.update(dt)、m.draw(painter)；m.skip() 加速（點一下畫面）。

import { hex as pfHex, FONTS } from "../../../pixelfx/src/core/index.js";

// pixelfx 的大字沒有 × 和 ÷，在這裡補上（不改函式庫本身）
const glyph = (src) => { const rows = src.split("|"); return { w: rows[0].length, rows: rows.map((r) => [...r].map((c) => c === "#")) }; };
FONTS.big.glyphs["×"] ??= glyph(".....|.....|#...#|.#.#.|..#..|.#.#.|#...#");
FONTS.big.glyphs["÷"] ??= glyph(".....|..#..|.....|#####|.....|..#..|.....");

const ONE_R = 4, TEN_R = 7;
const SLOT = 11;                // 十格板一格的間距
const TEN_GAP = 17;             // 大光球的間距
const Y0 = 84;                  // 光球區的上緣
const INK = pfHex("#463a78"), INK_D = pfHex("#1c1533");
const WHITE = 0xffffffff;

function mix(a, b, k) {
  const A = [(a >> 16) & 255, (a >> 8) & 255, a & 255], B = [(b >> 16) & 255, (b >> 8) & 255, b & 255];
  return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, "0")).join("");
}
const num = (h) => parseInt(h.slice(1), 16);

export class MathMagic {
  constructor(colorHex, target = [200, 180]) {
    this.c = pfHex(colorHex);
    this.cL = pfHex(mix(num(colorHex), 0xffffff, 0.55));
    this.cD = pfHex(mix(num(colorHex), 0x000000, 0.55));
    this.cB = pfHex(mix(num(colorHex), 0xffffff, 0.25));   // 第二堆光球（加數）用亮一點的顏色區分
    this.target = target;
    this.orbs = [];
    this.flashes = [];
    this.text = "";
    this.textShown = 0;
    this.t = 0; this.speed = 1; this.events = []; this.active = false;
  }

  skip() { this.speed = 4; }

  // ── 位置 ──
  // 一組數字的版面：左邊是「十」的大光球（一排 5 顆），右邊是個位的十格板
  tenPos(gx, i) { return [gx + (i % 5) * TEN_GAP, Y0 + Math.floor(i / 5) * TEN_GAP]; }
  onePos(gx, i) {
    const frame = Math.floor(i / 10), k = i % 10;
    return [gx + (k % 5) * SLOT, Y0 + Math.floor(k / 5) * SLOT + frame * (SLOT * 2 + 6)];
  }

  orb(kind, x, y, color, born, r) {
    const o = { kind, x, y, tx: x, ty: y, color, born, alpha: 0, gone: false, fade: false, launch: false, vy: 0, r };
    this.orbs.push(o);
    return o;
  }
  at(t, fn) { this.events.push({ t, fn }); }
  flash(x, y, r) { this.flashes.push({ x, y, r, t: 0 }); }

  start({ op, a, b }) {
    this.active = true; this.t = 0; this.speed = 1; this.orbs = []; this.events = []; this.flashes = []; this.boards = []; this.groups = []; this.blocks = [];
    const result = op === "+" ? a + b : op === "-" ? a - b : op === "×" ? a * b : a / b;
    this.text = `${a}${op}${b}`;
    this.full = `${a}${op}${b}=${result}`;
    this.textShown = 0;
    let done;
    const promise = new Promise((r) => (done = r));
    if (op === "+") this.planAdd(a, b, result, done);
    else if (op === "-") this.planSub(a, b, result, done);
    else if (op === "×") (a * b <= 60 ? this.planMul(a, b, result, done) : this.planArea(a, b, result, done));
    else this.planDiv(a, b, result, done);
    return promise;
  }

  // ── 加法 ──
  planAdd(a, b, result, done) {
    const tA = Math.floor(a / 10), oA = a % 10, tB = Math.floor(b / 10), oB = b % 10;
    const AX_T = 24, AX_O = AX_T + (tA + tB > 0 ? Math.min(5, tA + tB + 1) * TEN_GAP : 0) + 4;   // 第一堆
    const BX = 168;                                                                        // 第二堆在右邊
    const tensA = [], onesA = [], tensB = [], onesB = [];
    for (let i = 0; i < tA; i++) tensA.push(this.orb("ten", ...this.tenPos(AX_T, i), this.c, 0.05 + i * 0.03));
    for (let i = 0; i < oA; i++) onesA.push(this.orb("one", ...this.onePos(AX_O, i), this.c, 0.05 + i * 0.025));
    const bxT = BX, bxO = BX + (tB ? Math.min(5, tB) * TEN_GAP + 4 : 0);
    for (let i = 0; i < tB; i++) tensB.push(this.orb("ten", ...this.tenPos(bxT, i), this.cB, 0.2 + i * 0.03));
    for (let i = 0; i < oB; i++) onesB.push(this.orb("one", ...this.onePos(bxO, i), this.cB, 0.2 + i * 0.025));
    // 十格板：第一堆一個，加起來超過 10 顆時多一個
    this.boards = [{ x: AX_O, f: 0 }, ...(oB ? [{ x: bxO, f: 0, until: 0.6 }] : [])];
    if (oA + oB > 10) this.at(0.55, () => this.boards.push({ x: AX_O, f: 1, until: 1.1 }));

    // 第二堆飛進第一堆：十的接在十後面，個位填進十格板的空格
    this.at(0.55, () => {
      tensB.forEach((o, i) => { [o.tx, o.ty] = this.tenPos(AX_T, tA + i); });
      onesB.forEach((o, i) => { [o.tx, o.ty] = this.onePos(AX_O, oA + i); });
    });
    const ones = [...onesA, ...onesB];
    let tensCount = tA + tB;
    if (ones.length >= 10) {
      // 湊滿 10 顆：往中間收攏、閃光、變成一顆大光球（進位）
      const ten = ones.slice(0, 10), cx = AX_O + 2 * SLOT, cy = Y0 + SLOT / 2;
      this.at(0.9, () => ten.forEach((o) => { o.tx = cx; o.ty = cy; }));
      this.at(1.05, () => {
        ten.forEach((o) => (o.gone = true));
        this.flash(cx, cy, 10);
        const big = this.orb("ten", cx, cy, this.cL, this.t);
        big.alpha = 1;
        [big.tx, big.ty] = this.tenPos(AX_T, tensCount++);
        ones.slice(10).forEach((o, i) => { [o.tx, o.ty] = this.onePos(AX_O, i); });
      });
    }
    this.finish(ones.length >= 10 ? 1.3 : 0.95, result, done);
  }

  // ── 減法 ──
  planSub(a, b, result, done) {
    const tA = Math.floor(a / 10), oA = a % 10, tB = Math.floor(b / 10), oB = b % 10;
    const AX_T = 40, AX_O = AX_T + (tA > 0 ? Math.min(5, tA) * TEN_GAP + 4 : 0);
    const tens = [], ones = [];
    for (let i = 0; i < tA; i++) tens.push(this.orb("ten", ...this.tenPos(AX_T, i), this.c, 0.05 + i * 0.03));
    for (let i = 0; i < oA; i++) ones.push(this.orb("one", ...this.onePos(AX_O, i), this.c, 0.05 + i * 0.025));
    this.boards = [{ x: AX_O, f: 0 }];
    let t = 0.55;
    if (oB > oA) {
      // 不夠減：最後一顆大光球裂開成 10 顆小光球（借位），排進下一個十格板
      const big = tens.pop();
      this.at(t, () => {
        this.boards.push({ x: AX_O, f: 1 });
        big.gone = true;
        this.flash(big.x, big.y, 9);
        for (let i = 0; i < 10; i++) {
          const o = this.orb("one", big.x, big.y, this.cL, this.t);
          o.alpha = 1;
          [o.tx, o.ty] = this.onePos(AX_O, oA + i);
          ones.push(o);
        }
      });
      t += 0.35;
    }
    // 要減掉的光球：個位從最後面拿掉，十從最後面拿掉；它們變成墨色飄走熄滅
    this.at(t, () => {
      ones.slice(ones.length - oB).forEach((o, i) => { o.fade = true; o.color = INK; o.vy = -40 - i * 4; });
      tens.slice(tens.length - tB).forEach((o, i) => { o.fade = true; o.color = INK; o.vy = -36 - i * 5; });
    });
    this.at(t + 0.35, () => {
      // 剩下的往前補齊
      ones.filter((o) => !o.fade && !o.gone).forEach((o, i) => { [o.tx, o.ty] = this.onePos(AX_O, i); });
      tens.filter((o) => !o.fade && !o.gone).forEach((o, i) => { [o.tx, o.ty] = this.tenPos(AX_T, i); });
    });
    this.finish(t + 0.5, result, done);
  }

  // ── 乘法：方陣 ──
  planMul(a, b, result, done) {
    const S = a > 6 || b > 6 ? 8 : 10, r = S > 8 ? 3.5 : 3;
    const x0 = 144 - ((b - 1) * S) / 2, y0 = 70;
    // 第一列先出現
    const first = [];
    for (let j = 0; j < b; j++) first.push(this.orb("one", x0 + j * S, y0, this.c, 0.1 + j * 0.04, r));
    // 一列一列往下複製（每複製一列閃一下）
    const step = a > 1 ? Math.min(0.14, 0.6 / (a - 1)) : 0;
    for (let i = 1; i < a; i++) {
      this.at(0.4 + i * step, () => {
        this.flash(x0 - 8, y0 + i * S, 4);
        for (let j = 0; j < b; j++) {
          const o = this.orb("one", x0 + j * S, y0 + (i - 1) * S, i % 2 ? this.cB : this.c, this.t, r);
          o.alpha = 1; o.ty = y0 + i * S;
        }
      });
    }
    // 方陣外框
    this.at(0.5 + a * step, () => this.groups.push({ x0: x0 - S / 2, y0: y0 - S / 2, x1: x0 + (b - 0.5) * S, y1: y0 + (a - 0.5) * S }));
    this.finish(0.75 + a * step, result, done);
  }

  // ── 乘法（大數）：面積模型，十位那塊＋個位那塊 ──
  planArea(a, b, result, done) {
    const tens = Math.floor(a / 10) * 10, ones = a % 10;
    const u = Math.min(2.4, 190 / a), h = Math.max(18, b * 5), x0 = 144 - (a * u) / 2, y0 = 72;
    const A = { x: x0, y: y0, w: tens * u, h, color: this.c, t0: 0.1, label: `${tens}×${b}=${tens * b}` };
    const B = { x: x0 + tens * u + 2, y: y0, w: Math.max(2, ones * u), h, color: this.cB, t0: 0.45, label: ones ? `${ones}×${b}=${ones * b}` : "" };
    this.blocks = ones ? [A, B] : [A];
    this.at(0.95, () => { for (const k of this.blocks) k.sum = true; });
    this.at(1.25, () => {
      // 兩塊變成光球飛出去
      for (const k of this.blocks) {
        const n = Math.max(2, Math.round(k.w / 12));
        for (let i = 0; i < n; i++) {
          const o = this.orb(i % 3 ? "one" : "ten", k.x + ((i + 0.5) * k.w) / n, k.y + k.h / 2, k.color, this.t);
          o.alpha = 1;
        }
        k.gone = true;
      }
    });
    this.finish(1.3, result, done);
  }

  // ── 除法：平分成 b 束 ──
  planDiv(a, b, result, done) {
    const q = result, perRow = a > 60 ? 12 : 10, S = a > 60 ? 7 : 9, r = a > 60 ? 2.5 : 3;
    const x0 = 144 - ((Math.min(a, perRow) - 1) * S) / 2, y0 = 70;
    const orbs = [];
    for (let i = 0; i < a; i++) orbs.push(this.orb("one", x0 + (i % perRow) * S, y0 + Math.floor(i / perRow) * S, this.c, 0.05 + i * 0.008, r));
    // 發牌：第 i 顆分到第 (i % b) 束
    const GW = Math.min(34, 256 / b), rowsIn = Math.min(q, 4), colsIn = Math.ceil(q / 4), gS = q > 8 ? 6 : 7;
    const gx = (g) => 144 + (g - (b - 1) / 2) * GW;
    this.at(0.55, () => orbs.forEach((o, i) => {
      const g = i % b, k = Math.floor(i / b);
      o.tx = gx(g) + ((k % colsIn) - (colsIn - 1) / 2) * gS;
      o.ty = 72 + Math.floor(k / colsIn) * gS;
      o.color = g % 2 ? this.cB : this.c;
    }));
    // 每束框起來，第一束特別亮（那就是答案）
    this.at(1.0, () => {
      for (let g = 0; g < b; g++) {
        const w = colsIn * gS, hh = Math.ceil(q / colsIn) * gS;
        this.groups.push({ x0: gx(g) - w / 2 - 1, y0: 72 - gS / 2 - 1, x1: gx(g) + w / 2 + 1, y1: 72 - gS / 2 + hh + 1, hi: g === 0 });
      }
      this.flash(gx(0), 80, 8);
    });
    void rowsIn;
    this.finish(1.15, result, done);
  }

  // 寫出「＝答案」，然後所有光球朝怪物飛出去
  finish(t, result, done) {
    this.at(t, () => { this.text = this.full; this.flash(144, 40, 16); });
    this.at(t + 0.3, () => {
      const [mx, my] = this.target;
      this.orbs.filter((o) => !o.gone && !o.fade).forEach((o, i) => {
        o.launch = true; o.tx = mx + ((i * 7) % 13) - 6; o.ty = my - 14 + ((i * 5) % 11) - 5; o.delay = i * 0.012;
      });
    });
    this.at(t + 0.55, () => { this.active = false; done(); });
  }

  update(dt) {
    if (!this.active && !this.orbs.length) return;
    dt *= this.speed;
    this.t += dt;
    for (const e of this.events) if (!e.done && this.t >= e.t) { e.done = true; e.fn(); }
    // 算式一個字一個字寫出來
    this.textShown = Math.min(this.text.length, this.textShown + dt * 14);
    for (const o of this.orbs) {
      if (this.t < o.born) continue;
      if (!o.fade) o.alpha = Math.min(1, o.alpha + dt * 8);
      if (o.fade) { o.y += o.vy * dt; o.alpha -= dt * 2.2; if (o.alpha <= 0) o.gone = true; continue; }
      if (o.launch && (o.delay -= dt) > 0) continue;
      const k = Math.min(1, dt * (o.launch ? 14 : 10));
      o.x += (o.tx - o.x) * k; o.y += (o.ty - o.y) * k;
      if (o.launch && Math.abs(o.tx - o.x) < 3) o.gone = true;
    }
    this.orbs = this.orbs.filter((o) => !o.gone);
    for (const f of this.flashes) f.t += dt;
    this.flashes = this.flashes.filter((f) => f.t < 0.35);
    if (!this.active) this.orbs = this.orbs.filter((o) => o.launch);
  }

  draw(p) {
    if (!this.active && !this.orbs.length) return;
    p.place(0, 0, false, 0);
    // 算式（大號像素字，深色外框，屬性亮色＋光暈）
    const shown = this.text.slice(0, Math.ceil(this.textShown));
    if (shown && this.active) {
      p.text(shown, 144, 30, this.cL, { font: "big", scale: 3, align: "center", outline: INK_D });
      p.glow(144, 40, 36, this.c, 0.25);
    }
    // 十格板的淡框（上下兩排、一排 5 格）
    if (this.active) for (const b of this.boards) {
      if (b.until && this.t > b.until) continue;
      const x0 = b.x - SLOT / 2, y0 = Y0 - SLOT / 2 + b.f * (SLOT * 2 + 6);
      for (let i = 0; i <= 5; i++) p.rect(x0 + i * SLOT, y0, 1, SLOT * 2 + 1, this.cD, 0.55);
      for (let j = 0; j <= 2; j++) p.rect(x0, y0 + j * SLOT, SLOT * 5 + 1, 1, this.cD, 0.55);
    }
    for (const o of this.orbs) {
      if (this.t < o.born || o.alpha <= 0) continue;
      const r = o.r ?? (o.kind === "ten" ? TEN_R : ONE_R);
      p.disc(o.x, o.y, r + 1, o.fade ? INK_D : this.cD, o.alpha);
      p.disc(o.x, o.y, r, o.color, o.alpha);
      p.disc(o.x - r * 0.35, o.y - r * 0.35, Math.max(1, r * 0.4), o.fade ? INK : WHITE, o.alpha);
      if (o.kind === "ten") p.ring(o.x, o.y, r + 2, 1, this.cL, o.alpha * 0.8);
      if (!o.fade) p.glow(o.x, o.y, r + 4, o.color, 0.35 * o.alpha);
    }
    // 方陣、平分的框
    if (this.active) for (const g of this.groups) {
      const c = g.hi ? WHITE : this.cL, a = g.hi ? 0.9 : 0.6;
      p.rect(g.x0, g.y0, g.x1 - g.x0, 1, c, a); p.rect(g.x0, g.y1, g.x1 - g.x0 + 1, 1, c, a);
      p.rect(g.x0, g.y0, 1, g.y1 - g.y0, c, a); p.rect(g.x1, g.y0, 1, g.y1 - g.y0, c, a);
    }
    // 面積模型的方塊：從左往右長出來，上面寫部分積
    for (const k of this.blocks) {
      if (k.gone || this.t < k.t0) continue;
      const u = Math.min(1, (this.t - k.t0) / 0.3);
      p.rect(k.x - 1, k.y - 1, k.w * u + 2, k.h + 2, this.cD);
      p.rect(k.x, k.y, k.w * u, k.h, k.color);
      p.rect(k.x, k.y, k.w * u, 2, this.cL);
      p.glow(k.x + (k.w * u) / 2, k.y + k.h / 2, Math.max(8, k.w * u * 0.4), k.color, 0.25);
      if (u >= 1 && k.label) p.text(k.sum ? k.label.split("=")[1] : k.label, k.x + k.w / 2, k.y + k.h + 4, this.cL, { align: "center", outline: INK_D, scale: k.sum ? 2 : 1 });
    }
    for (const f of this.flashes) {
      const k = 1 - f.t / 0.35;
      p.ring(f.x, f.y, f.r * (1 + f.t * 3), 2, WHITE, k);
      p.glow(f.x, f.y, f.r * 1.5, this.cL, 0.8 * k);
    }
  }
}

/** 打中時跳出的答案數字（像 RPG 的傷害數字）；連擊越高越大 */
export class PopNumber {
  constructor(text, x, y, colorHex, scale) {
    Object.assign(this, { text, x, y, scale, t: 0, c: pfHex(colorHex) });
  }
  update(dt) { this.t += dt; }
  get done() { return this.t > 1.1; }
  draw(p) {
    p.place(0, 0, false, 0);
    const u = this.t, pop = u < 0.12 ? 1 + (0.12 - u) * 4 : 1;
    const y = this.y - 18 * Math.min(1, u * 2) + Math.max(0, u - 0.7) * -20;
    const a = u > 0.75 ? Math.max(0, 1 - (u - 0.75) / 0.35) : 1;
    p.text(this.text, this.x, y, WHITE, { font: "big", scale: Math.round(this.scale * pop), align: "center", outline: INK_D, a });
    p.glow(this.x, y + 6, 14, this.c, 0.4 * a);
  }
}
