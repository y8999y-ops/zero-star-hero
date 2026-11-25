// 戰鬥場景的動態（讓背景活起來，不用重畫美術）：
//   雲：高的雲每秒飄 7 格、低的雲 3 格，左右接起來一直飄
//   浮空島：每 4 秒輕輕上下浮 1 格
//   花瓣：粉紅、白色的花瓣從左上往右下飄，邊飄邊左右晃
//   花粉：金色小光點從地面慢慢往上飄、一閃一閃
//   蝴蝶：兩隻小蝴蝶在花叢上方飛，翅膀一開一合
//   星星花：中景的金色星星花偶爾閃一下光
// 室內的區域換別的小動態：
//   千頁圖書館：陽光裡飄的金色灰塵、幾張書頁慢慢飄落翻面
//   刻度鐘塔：藍色的時間光點往上飄、每秒「滴答」一次，金色細節閃一下
// 被墨水弄灰時（gray 接近 1）：沒有蝴蝶和閃光，花瓣變成慢慢落下的墨點，花粉不見。恢復色彩後全部回來。
// 全部畫在整數格上（384×216 的畫布，放大後一樣是方方的像素）。

const W = 384, H = 216;
const PETAL = ["#eb88a0", "#f5eddd", "#f7b6c4"], POLLEN = "#ffe9a0", INK = ["#463a78", "#2d2350"];
const BUTTERFLY = [["#c3a3db", "#8f6fc0"], ["#fac85e", "#c08a2e"]];

// 固定的亂數，讓每次進戰鬥都一樣（不會閃爍）
const rand = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const wrap = (v, m) => ((v % m) + m) % m;

export class Ambience {
  constructor(art) {
    this.art = art;
    this.t = 0;
    this.petals = Array.from({ length: 18 }, (_, i) => ({ x: rand(i) * W, y: rand(i + 50) * 130, sp: 9 + rand(i + 9) * 8, ph: rand(i + 3) * 6, c: PETAL[i % 3], big: i % 3 !== 0 }));
    this.pollen = Array.from({ length: 10 }, (_, i) => ({ x: 20 + rand(i + 70) * (W - 40), y: 100 + rand(i + 90) * 40, sp: 2 + rand(i + 11) * 3, ph: rand(i + 13) * 6 }));
    this.butterflies = BUTTERFLY.map((c, i) => ({ c, cx: 120 + i * 150, cy: 92 + i * 6, ph: i * 2.1 }));
  }

  update(dt) { this.t += dt; }

  /** 背景：天空、雲、浮空島、中景＋地面、場景裡的小動態。gray：0 彩色～1 墨水灰 */
  draw(ctx, sx, sy, gray) {
    const A = this.art, t = this.t;
    const layer = (l, x, y) => {
      ctx.drawImage(l.color, x, y);
      if (gray > 0.001) { ctx.globalAlpha = gray; ctx.drawImage(l.gray, x, y); ctx.globalAlpha = 1; }
    };
    if (!A.hd) layer(A.base, sx, sy);
    if (!A.hd && (!A.kind || A.kind === "garden")) {
    // 雲：往左飄，畫兩次接起來
    for (const [l, sp] of [[A.cloudsLo, 3], [A.cloudsHi, 7]]) {
      const o = Math.round(wrap(t * sp, W));
      layer(l, sx - o, sy); layer(l, sx - o + W, sy);
    }
    // 浮空島：輕輕上下浮
    layer(A.island, sx, sy + Math.round(Math.sin((t / 4) * Math.PI * 2) * 1.2));
    }
    if (!A.hd) layer(A.front, sx, sy);

    const live = 1 - gray;   // 彩色的程度
    ctx.save();
    ctx.translate(sx, sy);
    // 星星花偶爾閃一下（四角星）
    if (live > 0.3) A.stars.forEach(([x, y], i) => {
      const k = wrap(t * 0.6 + rand(i + 30) * 7, 3.5);
      if (k > 0.45) return;
      const s = k < 0.15 || k > 0.3 ? 1 : 2;
      ctx.globalAlpha = live;
      ctx.fillStyle = "#fffbe0"; ctx.fillRect(x, y - 1, 1, 1);
      ctx.fillStyle = "#ffe27a";
      ctx.fillRect(x - s, y - 1, s, 1); ctx.fillRect(x + 1, y - 1, s, 1); ctx.fillRect(x, y - 1 - s, 1, s); ctx.fillRect(x, y, 1, s);
    });
    if (A.kind === "library" || A.kind === "clock") { this.indoor(ctx, live, gray); ctx.restore(); ctx.globalAlpha = 1; return; }
    // 花粉：金色小光點往上飄、一閃一閃
    if (live > 0.3) for (const p of this.pollen) {
      const y = wrap(p.y - t * p.sp, 60) + 85, x = p.x + Math.round(Math.sin(t * 0.8 + p.ph) * 3);
      if (Math.sin(t * 3 + p.ph) < -0.2) continue;
      ctx.globalAlpha = live * 0.9; ctx.fillStyle = POLLEN; ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    // 花瓣（灰的時候變成慢慢落下的墨點）
    const n = gray > 0.5 ? 8 : this.petals.length;
    for (let i = 0; i < n; i++) {
      const p = this.petals[i], slow = gray > 0.5 ? 0.45 : 1;
      const x = wrap(p.x + t * p.sp * slow + Math.sin(t * 1.3 + p.ph) * 6, W + 20) - 10;
      const y = wrap(p.y + t * p.sp * 0.55 * slow, 150) - 6;
      const flip = Math.floor(t * 4 + p.ph) % 2;
      ctx.globalAlpha = 1;
      ctx.fillStyle = gray > 0.5 ? INK[i % 2] : p.c;
      if (p.big && gray <= 0.5) { ctx.fillRect(Math.round(x), Math.round(y), flip ? 2 : 1, flip ? 1 : 2); }
      else ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    // 蝴蝶：繞著八字飛，翅膀一開一合
    if (live > 0.3) for (const b of this.butterflies) {
      const u = t * 0.5 + b.ph;
      const x = Math.round(b.cx + Math.sin(u) * 46), y = Math.round(b.cy + Math.sin(u * 2) * 10 + Math.sin(t * 6 + b.ph) * 1.5);
      const open = Math.floor(t * 9 + b.ph * 3) % 2 === 0;
      ctx.globalAlpha = live;
      ctx.fillStyle = b.c[1]; ctx.fillRect(x, y, 1, 2);                // 身體
      ctx.fillStyle = b.c[0];
      if (open) { ctx.fillRect(x - 2, y - 1, 2, 2); ctx.fillRect(x + 1, y - 1, 2, 2); }
      else { ctx.fillRect(x - 1, y - 1, 1, 2); ctx.fillRect(x + 1, y - 1, 1, 2); }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // 室內的小動態（ctx 已經移到背景左上角）
  indoor(ctx, live, gray) {
    const t = this.t, lib = this.art.kind === "library";
    // 灰塵／時間光點：圖書館往右下慢慢飄（陽光的方向），鐘塔往上飄
    for (let i = 0; i < 22; i++) {
      const sp = 2 + rand(i + 20) * 4, ph = rand(i + 40) * 6;
      const x = lib ? wrap(rand(i) * W + t * sp, W) : wrap(rand(i) * W + Math.sin(t * 0.7 + ph) * 4, W);
      const y = lib ? wrap(rand(i + 60) * 120 + t * sp * 0.6, 130) : wrap(rand(i + 60) * 130 - t * sp, 130);
      if (Math.sin(t * 2.5 + ph) < -0.3) continue;
      ctx.globalAlpha = live * 0.85 + gray * 0.3;
      ctx.fillStyle = gray > 0.5 ? INK[i % 2] : lib ? (i % 3 ? "#ffe9a0" : "#fff6d8") : (i % 3 ? "#9fe6f2" : "#ffe9a0");
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    if (lib) {
      // 書頁：慢慢飄落、左右晃、翻面（白一下、米色一下）
      for (let i = 0; i < 5; i++) {
        const sp = 6 + rand(i + 80) * 5, ph = rand(i + 90) * 6;
        const x = Math.round(wrap(rand(i + 100) * W + Math.sin(t * 0.9 + ph) * 10 + t * 2, W + 10) - 5);
        const y = Math.round(wrap(rand(i + 110) * 140 + t * sp, 150) - 8);
        const f = Math.floor(t * 3 + ph) % 3;
        ctx.globalAlpha = 1;
        ctx.fillStyle = gray > 0.5 ? "#6a6488" : f === 0 ? "#fffaf0" : "#e8d8b8";
        if (f === 2) ctx.fillRect(x, y, 1, 2); else ctx.fillRect(x, y, 3, 2);
        ctx.fillStyle = gray > 0.5 ? "#463a78" : "#c9a46a"; if (f !== 2) ctx.fillRect(x, y + 2, 3, 1);
      }
    } else if (live > 0.3) {
      // 滴答：每秒一次，金色細節（星星位置）輪流亮一下
      const k = t % 1, s = this.art.stars;
      if (s.length && k < 0.18) {
        const [x, y] = s[Math.floor(t) % s.length];
        ctx.globalAlpha = live; ctx.fillStyle = "#fffbe0";
        ctx.fillRect(x - 1, y - 1, 3, 1); ctx.fillRect(x, y - 2, 1, 3);
      }
    }
  }
}
