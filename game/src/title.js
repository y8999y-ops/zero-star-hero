// 主畫面（2026-11-05 重做）：遊戲解析度（高 216）的像素場景，整數格繪製、放大到全螢幕。
// 構圖：星空（城鎮的天空圖）慢慢往左飄 → 遠景的山與「墜落的巨大星星」（far.png，世界觀：星落）＋柔和的星光 →
// 中景碎星鎮（mid.png）→ 前景草地，主角（星星）站在右下方，肚子的光一閃一閃、領巾被風吹。
// 偶爾有流星劃過、星屑往上飄。標題字（art/ui/logo.png，tools/make-logo.py 產生）在上方中間輕輕浮動，
// 每隔幾秒一道斜光掃過字，字的邊上有十字星光一閃一閃。選單是 HTML（字要清楚），在標題下面置中。
// 參考：大標題＋簡短選單置中、背景動作要慢（標題畫面要安靜不要吵）、標題字深色底配亮字＋反光（見 docs/素材參考.md）。
import { starPixels, POSES } from "./star.js";

const H = 216;
const IMG = {};
const load = (k, src) => new Promise((ok) => { const im = new Image(); im.onload = () => { IMG[k] = im; ok(); }; im.onerror = ok; im.src = src; });
const ART = new URL("../art/", import.meta.url).href;

// 主角的待機（目前形態）畫成小 canvas，快取
const heroCache = new Map();
function heroFrame(form, f) {
  const k = form + f;
  if (heroCache.has(k)) return heroCache.get(k);
  const q = { ...POSES.idle[f % 8], scarf: 1 }, sp = starPixels(form === "star" ? q : { ...q, form });
  const c = document.createElement("canvas");
  c.width = sp.W; c.height = sp.H;
  const g = c.getContext("2d"), im = g.createImageData(sp.W, sp.H), px = new Uint32Array(im.data.buffer);
  for (let y = 0; y < sp.H; y++) for (let x = 0; x < sp.W; x++) if (sp.px[y][x]) px[y * sp.W + x] = sp.px[y][x];
  g.putImageData(im, 0, 0);
  const out = { c, ax: sp.ax, ay: sp.ay };
  heroCache.set(k, out);
  return out;
}

/** 開始播主畫面。canvas：要畫的 <canvas>；form：主角目前的形態。回傳 stop()。 */
export async function startTitle(canvas, { form = "star" } = {}) {
  await Promise.all([
    load("sky", ART + "approved/town/sky.png"), load("far", ART + "approved/town/far.png"), load("mid", ART + "approved/town/mid.png"),
    load("ground", ART + "approved/town/ground.png"), load("fg", ART + "approved/town/fg.png"), load("logo", ART + "ui/logo.png"),
  ]);
  const g = canvas.getContext("2d");
  let W = 384, run = true, t0 = performance.now(), last = 0;
  const resize = () => {
    const aspect = innerWidth && innerHeight ? innerWidth / innerHeight : 16 / 9;
    W = Math.max(320, Math.min(520, Math.round((H * aspect) / 2) * 2));
    canvas.width = W; canvas.height = H;
    const k = Math.max(innerWidth / W, innerHeight / H);   // 蓋滿整個畫面（多的切掉一點點）
    canvas.style.width = Math.ceil(W * k) + "px"; canvas.style.height = Math.ceil(H * k) + "px";
    g.imageSmoothingEnabled = false;
  };
  resize();
  addEventListener("resize", resize);

  // 天上的星星（位置固定、各自閃）
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const stars = Array.from({ length: 70 }, () => ({ x: rnd() * 520, y: rnd() * 120, p: rnd() * 6.28, s: 0.6 + rnd() * 1.8, big: rnd() < 0.12 }));
  const dust = Array.from({ length: 26 }, () => ({ x: rnd() * 520, y: 120 + rnd() * 100, v: 4 + rnd() * 8, p: rnd() * 6.28 }));
  let shoot = null, nextShoot = 2.5;

  const tile = (im, x, y) => { if (!im) return; const w = im.width; let sx = Math.floor(x % w); if (sx > 0) sx -= w; for (let xx = sx; xx < W; xx += w) g.drawImage(im, xx, Math.round(y)); };
  const glow = (x, y, r, col, a) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, col.replace("A", a)); gr.addColorStop(1, col.replace("A", 0));
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  };

  const frame = (now) => {
    if (!run) return;
    requestAnimationFrame(frame);
    if (now - last < 1000 / 30) return;   // 30 fps 就夠，手機省電
    last = now;
    const t = (now - t0) / 1000;
    g.clearRect(0, 0, W, H);
    // 1. 天空（慢慢飄）
    tile(IMG.sky, -t * 2, 0);
    // 2. 星星
    for (const s of stars) {
      const x = Math.round(((s.x - t * 3) % 520 + 520) % 520), y = Math.round(s.y), b = 0.5 + 0.5 * Math.sin(t * s.s + s.p);
      if (x >= W) continue;
      g.fillStyle = b > 0.8 ? "#ffffff" : b > 0.4 ? "#bfc8ff" : "#6a6aa8";
      g.fillRect(x, y, 1, 1);
      if (s.big && b > 0.75) { g.fillStyle = "rgba(220,230,255,.7)"; g.fillRect(x - 1, y, 1, 1); g.fillRect(x + 1, y, 1, 1); g.fillRect(x, y - 1, 1, 1); g.fillRect(x, y + 1, 1, 1); }
    }
    // 3. 流星
    if ((nextShoot -= 1 / 30) <= 0 && !shoot) { shoot = { x: 60 + rnd() * (W - 60), y: 6 + rnd() * 40, a: 0 }; nextShoot = 3 + rnd() * 4; }
    if (shoot) {
      shoot.a += 1 / 30;
      const L = 22, k = shoot.a / 0.7, hx = Math.round(shoot.x - k * 90), hy = Math.round(shoot.y + k * 45);
      for (let i = 0; i < L; i++) { g.fillStyle = `rgba(255,${240 - i * 4},${200 - i * 6},${(1 - i / L) * (1 - k)})`; g.fillRect(hx + i * 2, hy - i, 2, 1); }
      g.fillStyle = "#ffffff"; g.fillRect(hx, hy, 1, 1);
      if (k >= 1) shoot = null;
    }
    // 4. 遠景＋墜落的巨星（星光柔和地呼吸）
    // 遠景不動：墜落的巨星固定在左邊三分之一（far.png 裡巨星在 x≈100），中間留給選單
    const farX = Math.round(W * 0.2) - 100, farY = H - (IMG.far?.height ?? 216) + 30;
    g.globalCompositeOperation = "lighter";
    const sw = IMG.far?.width ?? 640;
    for (let k = -1; k <= 1; k++) { const sx = ((farX % sw) + sw) % sw - sw + k * sw + 100; if (sx > -60 && sx < W + 60) glow(sx, farY + 110, 70, "rgba(255,200,90,A)", 0.22 + 0.08 * Math.sin(t * 1.3)); }
    g.globalCompositeOperation = "source-over";
    tile(IMG.far, farX, farY);
    // 5. 中景碎星鎮
    tile(IMG.mid, -t * 5, H - (IMG.mid?.height ?? 216) + 40);
    // 6. 前景草地＋主角
    const gy = H - 30;
    tile(IMG.ground, -t * 14, gy);
    const hx = Math.round(W * 0.8), f = Math.floor(t * 6.6) % 8, hf = heroFrame(form, f);
    g.globalCompositeOperation = "lighter";
    glow(hx, gy - 12, 34, "rgba(255,220,120,A)", 0.28 + 0.1 * Math.sin(t * 3));
    g.globalCompositeOperation = "source-over";
    g.drawImage(hf.c, hx - hf.ax, gy + 9 - hf.ay);
    tile(IMG.fg, -t * 22, H - 26);
    // 7. 星屑往上飄
    for (const d of dust) {
      const y = ((d.y - t * d.v) % 120 + 120) % 120 + 96, x = Math.round((d.x + Math.sin(t + d.p) * 6 - t * 6) % 520 + 520) % 520;
      if (x >= W) continue;
      const a = Math.min(1, (y - 96) / 30) * (0.5 + 0.5 * Math.sin(t * 3 + d.p));
      g.fillStyle = `rgba(255,230,140,${a})`; g.fillRect(x, Math.round(y), 1, 1);
    }
    // 8. 四周壓暗，讓視線集中在中間
    const v = g.createRadialGradient(W / 2, H * 0.42, H * 0.3, W / 2, H * 0.42, W * 0.7);
    v.addColorStop(0, "rgba(6,4,16,0)"); v.addColorStop(1, "rgba(6,4,16,.55)");
    g.fillStyle = v; g.fillRect(0, 0, W, H);
    // 選單後面一塊淡淡的暗區，字比較清楚
    const m = g.createRadialGradient(W / 2, H * 0.6, 8, W / 2, H * 0.6, 90);
    m.addColorStop(0, "rgba(8,6,20,.45)"); m.addColorStop(1, "rgba(8,6,20,0)");
    g.fillStyle = m; g.fillRect(0, 0, W, H);
    // 9. 標題字：浮動、斜光掃過、邊上十字星光
    const L = IMG.logo;
    if (L) {
      const lx = Math.round((W - L.width) / 2), ly = 16 + Math.round(Math.sin(t * 1.4) * 1.5);
      g.globalCompositeOperation = "lighter";
      glow(W / 2, ly + L.height / 2, 110, "rgba(120,90,255,A)", 0.12);
      g.globalCompositeOperation = "source-over";
      g.drawImage(L, lx, ly);
      // 斜光：每 4 秒掃一次，只亮在字上（硬邊兩條斜線）
      const sweep = (t % 4) / 1.1;
      if (sweep < 1) {
        const sx = lx - 20 + sweep * (L.width + 40);
        g.save();
        g.beginPath();
        for (const [o, w] of [[0, 3], [6, 1]]) { g.moveTo(sx + o, ly); g.lineTo(sx + o + w, ly); g.lineTo(sx + o + w - 14, ly + L.height); g.lineTo(sx + o - 14, ly + L.height); g.closePath(); }
        g.clip();
        g.globalAlpha = 0.75;   // 白色剪影只有字的形狀，所以只會亮在字上
        g.drawImage(whiteLogo(L), lx, ly);
        g.restore();
      }
      // 十字星光（三個位置輪流閃）
      for (const [i, px, py] of [[0, 0.04, 0.12], [1, 0.97, 0.05], [2, 0.62, 0.02]]) {
        const ph = (t * 0.9 + i * 0.33) % 1, a = ph < 0.25 ? Math.sin((ph / 0.25) * Math.PI) : 0;
        if (a <= 0) continue;
        const x = Math.round(lx + L.width * px), y = Math.round(ly + L.height * py), r = Math.round(1 + a * 3);
        g.fillStyle = `rgba(255,255,255,${a})`;
        g.fillRect(x - r, y, r * 2 + 1, 1); g.fillRect(x, y - r, 1, r * 2 + 1);
        g.fillStyle = `rgba(255,240,180,${a})`; g.fillRect(x - 1, y - 1, 3, 3);
      }
    }
  };
  requestAnimationFrame(frame);
  return () => { run = false; removeEventListener("resize", resize); };
}

// 標題字的白色剪影（斜光用）
let whiteCache = null;
function whiteLogo(L) {
  if (whiteCache) return whiteCache;
  const c = document.createElement("canvas");
  c.width = L.width; c.height = L.height;
  const g = c.getContext("2d");
  g.drawImage(L, 0, 0);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = "#fffbe8"; g.fillRect(0, 0, c.width, c.height);
  return (whiteCache = c);
}
