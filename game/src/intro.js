// 開場動畫（2026-11-05）：按「開始冒險」（新遊戲，第一次）之後播，播完直接進 1-1；右下角可以跳過，只播一次。
// 不交代上輩子（使用者決定），從系統開機開始：
//   A 全黑，系統水晶第一次開機：「……偵測到靈魂。」「轉生程序，啟動。」
//   B 夜空，星落：一陣流星雨，其中一顆特別亮的金色星星往山谷墜下去
//   C 洞窟（墜星之谷）：碎片從天而降，砸地、閃白、震動、煙塵；煙散開，主角爬起來、眨眼、左右看
//   D 系統：「恭喜轉生成功。」「種族：星星。」「……不，我也是第一次看到。」→ 淡出進遊戲
// 畫面用遊戲解析度（高 216）的像素畫布，美術沿用已通過的城鎮與山谷圖；台詞是 HTML（字要清楚），跟系統框同一套樣式。
import { starPixels, POSES } from "./star.js";
import { systemFace, moodOf } from "./system-face.js";
import { typewriter } from "./dialog.js";
import { sfx } from "./audio.js";

const H = 216;
const ART = new URL("../art/approved/", import.meta.url).href;
const IMG = {};
const load = (k, p) => new Promise((ok) => { const im = new Image(); im.onload = () => { IMG[k] = im; ok(); }; im.onerror = ok; im.src = ART + p; });

const heroCache = new Map();
function hero(q, flip = false) {
  const k = JSON.stringify(q) + flip;
  if (heroCache.has(k)) return heroCache.get(k);
  const sp = starPixels(q), c = document.createElement("canvas");
  c.width = sp.W; c.height = sp.H;
  const g = c.getContext("2d"), im = g.createImageData(sp.W, sp.H), px = new Uint32Array(im.data.buffer);
  for (let y = 0; y < sp.H; y++) for (let x = 0; x < sp.W; x++) { const v = sp.px[y][flip ? sp.W - 1 - x : x]; if (v) px[y * sp.W + x] = v; }
  g.putImageData(im, 0, 0);
  const out = { c, ax: flip ? sp.W - 1 - sp.ax : sp.ax, ay: sp.ay };
  heroCache.set(k, out);
  return out;
}

// 台詞時間表：[開始秒, 文字, 是否系統]
const LINES = [
  [1.1, "……偵測到靈魂。"],
  [3.0, "轉生程序，啟動。"],
  [16.4, "恭喜轉生成功。"],
  [18.2, "種族：星星。"],
  [19.9, "……不，我也是第一次看到。"],
];
const END = 23.2;

/** 播開場。root：放畫布和台詞的容器；canvas：畫布。回傳 Promise（播完或跳過時 resolve）。 */
export async function playIntro(root, canvas) {
  await Promise.all([
    load("sky", "town/sky.png"), load("far", "town/far.png"),
    load("vback", "valley/back.png"), load("vfar", "valley/far.png"), load("vmid", "valley/mid.png"), load("vground", "valley/ground.png"),
  ]);
  const g = canvas.getContext("2d");
  let W = 384;
  const resize = () => {
    const aspect = innerWidth && innerHeight ? innerWidth / innerHeight : 16 / 9;
    W = Math.max(320, Math.min(520, Math.round((H * aspect) / 2) * 2));
    canvas.width = W; canvas.height = H;
    const k = Math.max(innerWidth / W, innerHeight / H);
    canvas.style.width = Math.ceil(W * k) + "px"; canvas.style.height = Math.ceil(H * k) + "px";
    g.imageSmoothingEnabled = false;
  };
  resize();
  addEventListener("resize", resize);

  // 台詞框（系統樣式）＋跳過鍵
  const say = document.createElement("div");
  say.className = "introSay";
  say.innerHTML = '<i class="hfx"></i><canvas width="40" height="40"></canvas><div class="sysHead">SYSTEM // 系統</div><div class="introText"></div>';
  const skip = document.createElement("button");
  skip.className = "introSkip";
  skip.textContent = "跳過 ▶▶";
  root.append(say, skip);
  const faceCv = say.querySelector("canvas"), faceG = faceCv.getContext("2d"), textEl = say.querySelector(".introText");
  let lineI = 0, mood = "normal", typing = null;

  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const stars = Array.from({ length: 80 }, () => ({ x: rnd() * 520, y: rnd() * 150, p: rnd() * 6.28, s: 0.6 + rnd() * 2 }));
  const meteors = Array.from({ length: 14 }, (_, i) => ({ t0: 5.7 + i * 0.22 + rnd() * 0.3, x: 120 + rnd() * 420, y: -10 + rnd() * 40, sp: 140 + rnd() * 80 }));
  const dust = Array.from({ length: 40 }, () => ({ a: rnd() * Math.PI, v: 30 + rnd() * 70, s: rnd() < 0.3 ? 2 : 1 }));
  const glow = (x, y, r, col, a) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  };
  const tile = (im, x, y) => { if (!im) return; const w = im.width; let sx = Math.floor(x % w); if (sx > 0) sx -= w; for (let xx = sx; xx < W; xx += w) g.drawImage(im, xx, Math.round(y)); };
  const fadeTo = (a) => { if (a > 0) { g.fillStyle = `rgba(4,3,10,${Math.min(1, a)})`; g.fillRect(0, 0, W, H); } };
  const played = new Set();
  const once = (k, fn) => { if (!played.has(k)) { played.add(k); fn(); } };

  return new Promise((resolve) => {
    let run = true, t0 = performance.now(), last = 0;
    const finish = () => {
      if (!run) return;
      run = false;
      typing?.skip();
      removeEventListener("resize", resize);
      say.remove(); skip.remove();
      resolve();
    };
    skip.addEventListener("click", (e) => { e.stopPropagation(); sfx("ui"); finish(); });

    const frame = (now) => {
      if (!run) return;
      requestAnimationFrame(frame);
      if (now - last < 1000 / 30) return;
      last = now;
      const t = (now - t0) / 1000;
      if (t >= END) return finish();
      g.fillStyle = "#04030a"; g.fillRect(0, 0, W, H);

      // ---- 台詞
      while (lineI < LINES.length && t >= LINES[lineI][0]) {
        const text = LINES[lineI][1];
        mood = moodOf(text);
        say.classList.add("on");
        say.classList.remove("glitch"); void say.offsetWidth; say.classList.add("glitch");
        typing?.skip();
        typing = typewriter(textEl, text, 1320, "sine");
        lineI++;
      }
      if ((t > 4.7 && t < 16.2) || t > END - 0.9) say.classList.remove("on");
      faceG.clearRect(0, 0, 40, 40);
      faceG.drawImage(systemFace(mood === "normal" && Math.floor(t * 6.6) % 8 === 6 ? "blink" : mood, Math.floor(t * 6.6) % 8), 0, 0);

      // ---- A：開機（全黑＋中間一條全像光線慢慢展開）
      if (t < 5.2) {
        const k = Math.min(1, t / 0.8), w = Math.round(W * 0.4 * k);
        g.fillStyle = `rgba(122,232,255,${0.5 * (1 - Math.max(0, t - 4.2))})`;
        g.fillRect(Math.round(W / 2 - w / 2), Math.round(H * 0.42), w, 1);
        glow(W / 2, H * 0.42, 40 * k, "70,200,255", 0.18 * (1 - Math.max(0, t - 4.2)));
        return;
      }
      // ---- B：夜空、星落（5.2 ～ 10.6）
      if (t < 10.6) {
        const tb = t - 5.2, pan = Math.min(1, tb / 5) ** 2;
        tile(IMG.sky, -tb * 3, -pan * 10);
        for (const s of stars) {
          const x = Math.round(((s.x - tb * 4) % 520 + 520) % 520), b = 0.5 + 0.5 * Math.sin(t * s.s + s.p);
          if (x < W) { g.fillStyle = b > 0.7 ? "#ffffff" : "#8a8ac8"; g.fillRect(x, Math.round(s.y - pan * 10), 1, 1); }
        }
        // 流星雨
        for (const m of meteors) {
          const a = t - m.t0;
          if (a < 0 || a > 0.9) continue;
          const hx = m.x - a * m.sp, hy = m.y + a * m.sp * 0.55;
          for (let i = 0; i < 12; i++) { g.fillStyle = `rgba(200,220,255,${(1 - i / 12) * (1 - a / 0.9) * 0.9})`; g.fillRect(Math.round(hx + i * 2), Math.round(hy - i * 1.1), 1, 1); }
        }
        // 主角那顆：金色、拖著長尾巴往左下的山谷掉
        if (tb > 1.8) {
          const k = Math.min(1, (tb - 1.8) / 3.2), e = k * k;
          const hx = W * 0.85 - e * W * 0.55, hy = 10 + e * 150;
          for (let i = 0; i < 34; i++) { g.fillStyle = `rgba(255,${220 - i * 3},${120 - i * 3},${(1 - i / 34) * 0.9})`; g.fillRect(Math.round(hx + i * 1.6), Math.round(hy - i * 2.6), 2, 1); }
          g.globalCompositeOperation = "lighter";
          glow(hx, hy, 14 + 6 * Math.sin(t * 20), "255,210,110", 0.7);
          g.globalCompositeOperation = "source-over";
          g.fillStyle = "#ffffff"; g.fillRect(Math.round(hx) - 1, Math.round(hy) - 1, 3, 3);
          if (k > 0.2) once("whoosh", () => sfx("dash"));
        }
        tile(IMG.far, -tb * 2 - 260, H - (IMG.far?.height ?? 216) + 40 - pan * 12);
        // 落進山後面：地平線閃一下
        if (tb > 5.0) { g.globalCompositeOperation = "lighter"; glow(W * 0.3, H - 40, 70, "255,220,140", 0.6 * Math.max(0, 1 - (tb - 5.0) * 2)); g.globalCompositeOperation = "source-over"; }
        fadeTo(tb < 0.5 ? 1 - tb * 2 : tb > 4.9 ? (tb - 4.9) * 2 : 0);
        return;
      }
      // ---- C：洞窟，砸下來（10.6 ～ 16.2）、D：爬起來聽系統說話（16.2 ～）
      const tc = t - 10.6, impact = 1.0, shake = tc > impact && tc < impact + 0.5 ? Math.round((Math.random() - 0.5) * 6 * (1 - (tc - impact) / 0.5)) : 0;
      g.save();
      g.translate(shake, shake ? Math.round((Math.random() - 0.5) * 4) : 0);
      tile(IMG.vback, -40, 0); tile(IMG.vfar, -80, 0); tile(IMG.vmid, -140, 0);
      const gy = H - 40;
      tile(IMG.vground, -60, gy - 9);
      const cx = Math.round(W / 2);
      // 掉下來的光
      if (tc < impact) {
        const k = tc / impact, y = -20 + k * k * (gy + 20);
        for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,${230 - i * 3},${140 - i * 3},${(1 - i / 40) * 0.9})`; g.fillRect(cx - 1, Math.round(y - i * 3), 3, 3); }
        g.globalCompositeOperation = "lighter"; glow(cx, y, 22, "255,210,110", 0.8); g.globalCompositeOperation = "source-over";
      } else {
        once("boom", () => { sfx("bossLand"); sfx("boom"); });
        const a = tc - impact;
        // 坑裡的光、煙塵
        g.globalCompositeOperation = "lighter"; glow(cx, gy - 4, 46, "255,200,100", 0.5 * Math.max(0.25, 1 - a / 2.5)); g.globalCompositeOperation = "source-over";
        for (const d of dust) {
          const r = d.v * Math.min(a, 1.4) * (1 - Math.min(a, 1.4) / 2.8), x = cx + Math.cos(d.a) * r * 1.6, y = gy - Math.sin(d.a) * r * 0.7 - a * 4;
          const alpha = Math.max(0, 0.75 - a / 3.2);
          if (alpha <= 0) continue;
          g.fillStyle = `rgba(190,170,200,${alpha})`; g.fillRect(Math.round(x), Math.round(y), d.s * 2, d.s * 2);
        }
        // 主角：趴著 → 爬起來 → 眨眼、左看、右看、面向前
        let q = POSES.hurt, flip = false;
        if (a > 2.1) q = POSES.land;
        if (a > 2.4) q = POSES.stand;
        if (a > 3.0) q = { ...POSES.stand, eyes: a < 3.2 ? "blink" : "open" };
        if (a > 3.5 && a < 4.1) { q = { ...POSES.stand, view: 2 }; flip = true; }
        if (a > 4.1 && a < 4.7) q = { ...POSES.stand, view: 2 };
        if (a > 4.7) q = { ...POSES.idle[Math.floor(t * 6.6) % 8], view: 0 };
        if (a > 2.1) once("up", () => sfx("land"));
        const h = hero(q, flip), hy = a < 2.1 ? gy + 3 : gy;
        g.drawImage(h.c, cx - h.ax, hy - h.ay);
        // 閃白
        if (a < 0.35) { g.fillStyle = `rgba(255,250,235,${1 - a / 0.35})`; g.fillRect(-10, -10, W + 20, H + 20); }
      }
      g.restore();
      // 四周壓暗＋淡入淡出
      const v = g.createRadialGradient(W / 2, H * 0.6, H * 0.2, W / 2, H * 0.6, W * 0.65);
      v.addColorStop(0, "rgba(4,3,10,0)"); v.addColorStop(1, "rgba(4,3,10,.7)");
      g.fillStyle = v; g.fillRect(0, 0, W, H);
      fadeTo(tc < 0.4 ? 1 - tc / 0.4 : t > END - 0.8 ? (t - (END - 0.8)) / 0.8 : 0);
    };
    requestAnimationFrame(frame);
  });
}
