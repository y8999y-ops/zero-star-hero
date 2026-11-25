// 數學變魔法：其他題型（企劃書 7.8）。由 mathmagic.js 呼叫 installMore(MathMagic) 掛上。
//   frac  分數：魔晶切成等份，亮起幾份；分母不同時兩顆魔晶重新切成同樣的份數再合起來
//   dec   小數：一條魔力條切 10 格，一格一格亮起來，滿一條就閃一下（進位）
//   sadd  正負數加法：直立的光梯，光球往上（正）或往下（負）一階一階走
//   smul  正負數乘法：兩個正負號撞在一起變成答案的符號，再排出方陣
//   eq    方程式：封印鎖上浮著 x，一步一步移項，答案插進鎖孔，封印碎開
//   ratio 比例：前項和後項都乘上同一個倍數
//   mix   四則：先乘（方陣）再加（光球飛進來）
//   word  應用題：題目裡的數字一個一個飛上來排成一列，合起來變成答案
//   seal  選擇題：封印上的「?」變成「!」然後碎開
// 每個 plan_<op>(math, done) 自己設定 this.text（一開始寫的算式）和 this.full（最後完整的算式）。

import { hex as pfHex } from "../../../pixelfx/src/core/index.js";

const INK_D = pfHex("#1c1533"), WHITE = 0xffffffff, DIM = pfHex("#3a3058");
const neg = (n) => (n < 0 ? `-${-n}` : `${n}`);
const par = (n) => (n < 0 ? `(-${-n})` : `${n}`);
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
const fr = (n, d) => { const g = gcd(n, d); return d / g === 1 ? `${n / g}` : `${n / g}/${d / g}`; };
const ascii = (s) => String(s).replace(/−|－/g, "-").replace(/＋/g, "+").replace(/×/g, "×").replace(/[（]/g, "(").replace(/[）]/g, ")");
const printable = (s) => /^[0-9a-zA-Z+\-×÷=/.:%()!? ]+$/.test(s);

export function installMore(MathMagic) {
  const P = MathMagic.prototype;

  // ── 分數：魔晶（圓）切成幾等份 ──
  P.plan_frac = function ({ parts, common }, done) {
    const X = this.extra;
    if (!common) {
      // 同分母：一顆魔晶切 d 份，先亮 a 份、再亮 b 份
      const [[a, d], [b]] = parts;
      this.text = `${a}/${d}+${b}/${d}`; this.full = `${this.text}=${fr(a + b, d)}`;
      X.pies = [{ x: 144, y: 104, r: 24, n: d, lit: [], t0: 0.05 }];
      for (let i = 0; i < a; i++) this.at(0.2 + i * 0.07, () => X.pies[0].lit.push(this.c));
      for (let i = 0; i < b; i++) this.at(0.35 + a * 0.07 + i * 0.07, () => { X.pies[0].lit.push(this.cB); this.flash(144, 104, 4); });
      this.finish(0.6 + (a + b) * 0.07, null, done);
      return;
    }
    // 分母不同：左右兩顆各亮 1 份 → 都重新切成 common 份 → 合到中間那顆
    const [[, d1], [, d2]] = parts, n1 = common / d1, n2 = common / d2;
    this.text = `1/${d1}+1/${d2}`; this.full = `${this.text}=${fr(n1 + n2, common)}`;
    X.pies = [
      { x: 80, y: 104, r: 20, n: d1, lit: [this.c], t0: 0.05 },
      { x: 208, y: 104, r: 20, n: d2, lit: [this.cB], t0: 0.15 },
    ];
    this.at(0.55, () => {
      // 重新切：份數變成 common，亮的份數跟著變多（大小不變）
      X.pies[0].n = common; X.pies[0].lit = Array(n1).fill(this.c);
      X.pies[1].n = common; X.pies[1].lit = Array(n2).fill(this.cB);
      this.flash(80, 104, 14); this.flash(208, 104, 14);
      this.lines.push({ text: `${n1}/${common}+${n2}/${common}`, t0: this.t });
    });
    this.at(0.95, () => {
      X.pies.forEach((p) => { p.tx = 144; });
      X.pies.push({ x: 144, y: 104, r: 24, n: common, lit: [...Array(n1).fill(this.c), ...Array(n2).fill(this.cB)], t0: this.t + 0.25 });
    });
    this.at(1.2, () => { X.pies = X.pies.slice(2); this.flash(144, 104, 18); });
    this.finish(1.35, null, done);
  };

  // ── 小數：魔力條，一條 10 格 ──
  P.plan_dec = function ({ a, b }, done) {
    const X = this.extra, sum = Math.round((a + b) * 100) / 100;
    this.text = `${a}+${b}`; this.full = `${this.text}=${sum}`;
    const units = Math.ceil(sum + 0.0001);
    X.bars = { a, b, sum, shown: 0, rows: units, flashRow: -1 };
    // 先亮到 a，再一格一格加上 b；滿一條就閃
    this.at(0.1, () => { X.bars.target = a; X.bars.speed = a * 2.2; });
    this.at(0.6, () => { X.bars.target = sum; X.bars.speed = Math.max(1.2, b * 1.6); X.bars.phase2 = true; });
    this.finish(0.8 + Math.min(1.2, b / Math.max(1.2, b * 1.6)), null, done);
  };

  // ── 正負數加法：光梯 ──
  P.plan_sadd = function ({ a, b }, done) {
    const X = this.extra, r = a + b;
    this.text = `${par(a)}+${par(b)}`; this.full = `${this.text}=${neg(r)}`;
    const lo = Math.min(0, a, r) - 1, hi = Math.max(0, a, r) + 1, step = Math.min(5, 84 / (hi - lo));
    X.ladder = { x: 144, lo, hi, step, y0: 150, pos: a, start: a, lit: [] };
    const o = this.orb("ten", 144, X.ladder.y0 - (a - lo) * step, this.c, 0.1);
    X.ladder.orb = o;
    // 一階一階走（加正數往上、加負數往下）
    const n = Math.abs(b), dir = Math.sign(b), dt = Math.min(0.09, 0.7 / Math.max(1, n));
    for (let i = 1; i <= n; i++) this.at(0.35 + i * dt, () => {
      X.ladder.pos = a + dir * i;
      X.ladder.lit.push(X.ladder.pos);
      o.ty = X.ladder.y0 - (X.ladder.pos - lo) * step;
    });
    this.finish(0.55 + n * dt, null, done);
  };

  // ── 正負數乘法：符號相撞＋方陣 ──
  P.plan_smul = function ({ a, b }, done) {
    const X = this.extra, r = a * b;
    this.text = `${par(a)}×${par(b)}`; this.full = `${this.text}=${neg(r)}`;
    const sa = a < 0 ? "-" : "+", sb = b < 0 ? "-" : "+", sr = r < 0 ? "-" : "+";
    X.signs = { cards: [{ ch: sa, x: 96, tx: 96 }, { ch: sb, x: 192, tx: 192 }], result: null };
    this.at(0.3, () => { X.signs.cards.forEach((c) => (c.tx = 144)); });
    this.at(0.55, () => { X.signs.cards = []; X.signs.result = sr; this.flash(144, 74, 10); this.lines.push({ text: `${sa}×${sb}=${sr}`, t0: this.t }); });   // 同號得正、異號得負
    // 然後排出 |a|×|b| 的方陣（借用乘法的版面，往下移一點）
    const A = Math.abs(a), B = Math.abs(b), S = 8, x0 = 144 - ((B - 1) * S) / 2, y0 = 98;
    const step = A > 1 ? Math.min(0.08, 0.4 / (A - 1)) : 0;
    for (let i = 0; i < A; i++) this.at(0.75 + i * step, () => {
      for (let j = 0; j < B; j++) { const o = this.orb("one", x0 + j * S, y0 + i * S, r < 0 ? this.cD : this.c, this.t, 3); o.alpha = 1; }
    });
    this.finish(0.95 + A * step, null, done);
  };

  // ── 方程式：封印鎖 ──
  P.plan_eq = function ({ a, b, c, x }, done) {
    const X = this.extra;
    const bs = b < 0 ? `-${-b}` : `+${b}`;
    this.text = `${a}x${bs}=${neg(c)}`; this.full = this.text;
    X.lock = { x: 144, y: 120, open: 0, label: "x", broken: false };
    this.at(0.4, () => this.lines.push({ text: `${a}x=${neg(c)}${b < 0 ? "+" + -b : "-" + b}=${neg(c - b)}`, t0: this.t }));
    this.at(0.85, () => this.lines.push({ text: `x=${neg(c - b)}÷${a}=${neg(x)}`, t0: this.t, hi: true }));
    this.at(1.25, () => { X.lock.label = neg(x); this.flash(144, 120, 8); });
    this.at(1.45, () => { X.lock.broken = true; this.burst(144, 120, 14); });
    this.finish(1.55, null, done, false);
  };

  // ── 比例：前項後項乘同一個數 ──
  P.plan_ratio = function ({ a, b, k }, done) {
    const X = this.extra;
    this.text = `${a}:${b}=${a * k}:x`; this.full = this.text;
    X.arrows = [{ from: `${a}`, to: `${a * k}`, y: 84, t0: 0.3 }, { from: `${b}`, to: "x", y: 112, t0: 0.6 }];
    X.k = k;
    this.at(0.95, () => { X.arrows[1].to = `${b * k}`; this.flash(196, 116, 8); });
    this.at(1.0, () => this.lines.push({ text: `x=${b}×${k}=${b * k}`, t0: this.t, hi: true }));
    this.finish(1.3, null, done, false);
  };

  // ── 四則：先乘再加 ──
  P.plan_mix = function ({ a, b, c }, done) {
    this.text = `${a}+${b}×${c}`; this.full = `${this.text}=${a + b * c}`;
    this.at(0.15, () => this.lines.push({ text: `${b}×${c}=${b * c}`, t0: this.t }));
    const S = 8, x0 = 200 - ((c - 1) * S) / 2, y0 = 96;
    for (let i = 0; i < b; i++) this.at(0.25 + i * 0.06, () => {
      for (let j = 0; j < c; j++) { const o = this.orb("one", x0 + j * S, y0 + i * S, this.c, this.t, 3); o.alpha = 1; }
    });
    // 加上 a：從左邊飛進來
    const extra = [];
    for (let i = 0; i < Math.min(a, 20); i++) extra.push(this.orb("one", 40 + (i % 5) * 8, 96 + Math.floor(i / 5) * 8, this.cB, 0.75 + i * 0.02, 3));
    this.at(1.0, () => extra.forEach((o, i) => { o.tx = x0 + (i % c) * S; o.ty = y0 + b * S + Math.floor(i / c) * S; }));
    this.finish(1.25, null, done);
  };

  // ── 應用題：題目裡的數字飛上來 ──
  P.plan_word = function ({ nums, answer }, done) {
    const X = this.extra;
    const list = nums.slice(0, 5);
    this.text = ""; this.full = printable(answer) ? `=${answer}` : "";
    // 數字越長卡片間隔越大（四位數以上的大數不會疊在一起），但整排不超出畫面
    const longest = Math.max(...list.map((n) => String(n).length)), gap = Math.min(Math.max(46, longest * 12 + 14), list.length > 1 ? 260 / (list.length - 1) : 46), x0 = 144 - ((list.length - 1) * gap) / 2;
    X.cards = list.map((n, i) => ({ text: n, x: 144 + (i - (list.length - 1) / 2) * 14, y: 236, tx: x0 + i * gap, ty: 82, t0: 0.05 + i * 0.12 }));
    this.at(0.9, () => { X.cards.forEach((c) => { c.tx = 144; c.ty = 86; c.fading = true; }); });
    this.at(1.15, () => { X.cards = []; this.burst(144, 86, 12); this.text = this.full; this.textShown = 0; });
    this.finish(1.35, null, done, false);
  };

  // ── 選擇題：封印 ? → ! ──
  P.plan_seal = function (_, done) {
    const X = this.extra;
    this.text = ""; this.full = "";
    X.lock = { x: 144, y: 100, open: 0, label: "?", broken: false };
    this.at(0.45, () => { X.lock.label = "!"; this.flash(144, 100, 10); });
    this.at(0.75, () => { X.lock.broken = true; this.burst(144, 100, 16); });
    this.finish(0.85, null, done, false);
  };

  // 一圈光球往外炸開（封印碎掉、數字合起來時用）
  P.burst = function (x, y, n) {
    this.flash(x, y, 14);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, o = this.orb("one", x, y, i % 2 ? this.c : this.cL, this.t, 2.5);
      o.alpha = 1; o.tx = x + Math.cos(a) * 26; o.ty = y + Math.sin(a) * 18;
    }
  };

  // ── 畫 ──
  // 動態的部分在 update 裡推進（畫面只負責畫），停格截圖和實際播放才會一樣
  P.updateExtra = function (dt) {
    const X = this.extra;
    if (!X) return;
    const k = Math.min(1, dt * 12);
    for (const pie of X.pies ?? []) if (pie.tx != null) pie.x += (pie.tx - pie.x) * k;
    const B = X.bars;
    if (B && B.target != null) B.shown = Math.min(B.target, B.shown + dt * (B.speed ?? 1));
    for (const c of X.signs?.cards ?? []) c.x += (c.tx - c.x) * k;
    for (const c of X.cards ?? []) if (this.t >= c.t0) { c.x += (c.tx - c.x) * Math.min(1, dt * 9); c.y += (c.ty - c.y) * Math.min(1, dt * 9); }
  };

  P.drawExtra = function (p) {
    const X = this.extra;
    if (!X || !this.active) return;

    // 魔晶（圓）：每一份用角度分，亮的份上屬性色，份與份之間有暗線
    for (const pie of X.pies ?? []) {
      if (this.t < pie.t0) continue;
      const { x, y, r, n } = pie;
      for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
        const d = Math.hypot(i, j);
        if (d > r + 0.5) continue;
        let ang = Math.atan2(i, -j); if (ang < 0) ang += Math.PI * 2;   // 從 12 點鐘方向順時針
        const k = (ang / (Math.PI * 2)) * n, idx = Math.floor(k), edge = Math.min(k - idx, idx + 1 - k) * (d * Math.PI * 2 / n);
        let col = idx < pie.lit.length ? pie.lit[idx] : DIM;
        if (d > r - 1.2 || (edge < 0.7 && d > 1.5)) col = this.cD;
        else if (idx < pie.lit.length && i < -r * 0.3 && j < -r * 0.3) col = this.cL;
        p.px(x + i, y + j, col);
      }
      p.glow(x, y, r + 6, this.c, 0.25);
    }

    // 魔力條：一條 10 格，亮到目前的數值
    const B = X.bars;
    if (B) {
      // 超過 6 條就排成好幾欄（一欄 6 條）
      const cols = Math.ceil(B.rows / 6), W = cols > 1 ? Math.min(60, 230 / cols - 8) : 100, H = 9, y0 = 70;
      for (let r = 0; r < B.rows; r++) {
        const col = Math.floor(r / 6), x0 = 144 - (cols * (W + 8) - 8) / 2 + col * (W + 8);
        const y = y0 + (r % 6) * (H + 4), v = Math.max(0, Math.min(1, B.shown - r));
        p.rect(x0 - 1, y - 1, W + 2, H + 2, this.cD);
        p.rect(x0, y, W, H, DIM);
        const fillW = Math.round(W * v);
        // 屬於 a 的格子用主色，後來加上 b 的用亮色
        const aPart = Math.max(0, Math.min(1, B.a - r)) * W;
        p.rect(x0, y, Math.min(fillW, aPart), H, this.c);
        if (fillW > aPart) p.rect(x0 + aPart, y, fillW - aPart, H, this.cB);
        for (let c = 1; c < 10; c++) p.rect(x0 + c * (W / 10), y, 1, H, this.cD, 0.8);
        // 加的時候「新填滿」的那一條才閃一下（進位）
        if (v >= 1 && B.phase2 && r >= Math.floor(B.a) && !B[`f${r}`]) { B[`f${r}`] = 1; this.flash(x0 + W / 2, y + H / 2, 5); }
      }
    }

    // 光梯
    const L = X.ladder;
    if (L) {
      for (let v = L.lo; v <= L.hi; v++) {
        const y = L.y0 - (v - L.lo) * L.step, w = v === 0 ? 30 : v % 5 === 0 ? 20 : 12;
        const lit = L.lit.includes(v) || v === L.start;
        p.rect(L.x - w / 2, y, w, 1, v === 0 ? WHITE : lit ? this.cL : v > 0 ? this.cD : DIM);
        if (v === 0) p.text("0", L.x - 18, y - 3, WHITE, { outline: INK_D });
      }
      p.rect(L.x, L.y0 - (L.hi - L.lo) * L.step, 1, (L.hi - L.lo) * L.step, this.cD, 0.6);
      p.text("+", L.x + 16, L.y0 - (L.hi - L.lo) * L.step - 2, this.cL, { outline: INK_D });
      p.text("-", L.x + 16, L.y0 - 4, this.cL, { outline: INK_D });
    }

    // 正負號卡片
    const SG = X.signs;
    if (SG) {
      for (const c of SG.cards) { p.text(c.ch, c.x, 70, this.cL, { font: "big", scale: 3, align: "center", outline: INK_D }); }
      if (SG.result) p.text(SG.result, 144, 70, WHITE, { font: "big", scale: 3, align: "center", outline: INK_D });
    }

    // 封印鎖
    const K = X.lock;
    if (K && !K.broken) {
      const { x, y } = K;
      p.ring(x, y - 10, 8, 3, this.cD); p.ring(x, y - 10, 7, 1, this.cL);
      p.rect(x - 13, y - 6, 26, 20, this.cD); p.rect(x - 12, y - 5, 24, 18, this.c); p.rect(x - 12, y - 5, 24, 3, this.cL);
      p.text(K.label, x, y - 1, WHITE, { font: "big", scale: 1, align: "center", outline: INK_D });
      p.glow(x, y, 20, this.c, 0.3);
    }

    // 比例的箭頭
    for (const ar of X.arrows ?? []) {
      if (this.t < ar.t0) continue;
      p.text(ar.from, 96, ar.y, this.cL, { font: "big", scale: 2, align: "center", outline: INK_D });
      p.rect(116, ar.y + 6, 56, 2, this.c);
      p.text(`×${X.k}`, 144, ar.y - 9, WHITE, { align: "center", outline: INK_D });
      p.text(ar.to, 196, ar.y, ar.to === "x" ? this.cL : WHITE, { font: "big", scale: 2, align: "center", outline: INK_D });
    }

    // 應用題的數字卡
    for (const c of X.cards ?? []) {
      if (this.t < c.t0) continue;
      p.text(c.text, c.x, c.y, WHITE, { font: "big", scale: 2, align: "center", outline: INK_D, a: c.fading ? 0.7 : 1 });
      p.glow(c.x, c.y + 6, 12, this.c, 0.3);
    }
  };

  // 讓 finish 可以不自動補「=答案」（方程式、比例、應用題的答案已經寫在步驟裡）
  const baseFinish = P.finish;
  P.finish = function (t, result, done, writeFull = true) {
    if (!writeFull) {
      this.at(t, () => this.flash(144, 40, 16));
      this.at(t + 0.3, () => {
        const [mx, my] = this.target;
        const left = this.orbs.filter((o) => !o.gone && !o.fade);
        if (!left.length) for (let i = 0; i < 6; i++) { const o = this.orb("one", 144, 100, this.c, this.t); o.alpha = 1; left.push(o); }
        left.forEach((o, i) => { o.launch = true; o.tx = mx + ((i * 7) % 13) - 6; o.ty = my - 14; o.delay = i * 0.012; });
      });
      this.at(t + 0.55, () => { this.active = false; done(); });
      return;
    }
    return baseFinish.call(this, t, result, done);
  };
}

/** 從題目文字抓出應用題的數字（給 plan_word 用），最多 5 個 */
export function numbersOf(text) {
  return (ascii(text).match(/\d+(\.\d+)?(\/\d+)?/g) ?? []).slice(0, 5);
}
export { ascii, printable };
