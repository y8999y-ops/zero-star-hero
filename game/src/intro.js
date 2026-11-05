// 開場動畫（2026-11-05 第三版，使用者：「能更精采」，選了 2、3、4、5、6，「長一點沒關係」）。約 46 秒，右下角隨時可以跳過，只播一次。
// 不交代上輩子（使用者決定），從系統開機開始：
//   A  0 ～ 8   系統開機：掃描線、開機紀錄一行行跑出來、畫面雜訊；紅色警告「種族不在資料庫」閃爍震動 → 變金色「強制寫入：星星」＋進度條 → 像舊電視關機縮成一條線
//   B  8 ～ 14  夜空流星雨，一顆特別亮的金色碎片往下墜（沿用第二版）
//   B2 14 ～ 21 鏡頭跟著碎片往下衝：星空往上飛走、穿過三層雲、速度線；經過碎星鎮上空（燈火），衝進山谷
//   C  21 ～ 24 洞窟：撞地前慢動作 → 閃白、大震動、一圈衝擊波、碎石噴飛、煙塵
//   T  24 ～ 28.5 標題「轉生成星星碎片的我」從上面砸下來（彈一下、震一下），副標淡入
//   D  28.5 ～ 39 主角醒來的表演：趴著 → 睜眼眨眼 → 爬起來 → 低頭看自己的手 → 嚇一跳原地彈起來（頭上「！」）→ 想走路跌個狗吃屎 → 爬起來
//   E  39 ～ 46.5 洞窟深處：黑暗裡一雙雙發光的眼睛、史萊姆從右邊探頭；系統：「這裡的魔物，你可以吃掉。」→ 淡出進遊戲
// 參考（只學做法）：pixelfx arcane/star-fall、fire/meteor（金色）、critters/slime；鏡頭跟拍與慢動作撞擊參考動作遊戲開場的剪法（快 → 慢 → 砰 → 標題）。
// 畫面用遊戲解析度（高 216）的像素畫布，美術沿用已通過的城鎮與山谷圖；台詞是 HTML（字要清楚），跟系統框同一套樣式。
import { starPixels, POSES } from "./star.js";
import { systemFace, moodOf } from "./system-face.js";
import { typewriter } from "./dialog.js";
import { sfx, introMusic, music, musicNow } from "./audio.js";
import { createSky } from "./starsky.js";
import { createFrame, clearFrame, createFx, composite } from "../../pixelfx/src/core/index.js";
import * as starFall from "../../pixelfx/src/fx/arcane/star-fall.js";
import * as meteorFx from "../../pixelfx/src/fx/fire/meteor.js";
import * as slimeFx from "../../pixelfx/src/fx/critters/slime.js";
import * as starMeteor from "../fx/fire/star-meteor.js";   // 同一顆流星的「不冒煙」版（B 幕遠景）
const GOLD = ["#3a1a06", "#6e3a0c", "#a8601a", "#d8902a", "#f4c040", "#ffe27a", "#fff2b0", "#fffbe8", "#ffffff"];

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

// 各幕的開始時間
const T_SKY = 8, T_DIVE = 14, T_CAVE = 21, T_TITLE = 24, T_WAKE = 28.5, T_DEEP = 39, END = 46.5;
// 台詞時間表：[開始秒, 文字]
const LINES = [
  [1.0, "……偵測到靈魂。"],
  [2.8, "轉生程序，啟動。"],
  [4.7, "錯誤：種族不在資料庫！"],
  [6.3, "……算了，強制寫入。"],
  [T_WAKE + 0.6, "恭喜轉生成功。"],
  [T_WAKE + 2.6, "種族：星星。"],
  [T_WAKE + 4.6, "……不，我也是第一次看到。"],
  [T_WAKE + 7.4, "連路都不會走？……這下麻煩了。"],
  [T_DEEP + 1.0, "對了，順帶一提——"],
  [T_DEEP + 3.0, "這裡的魔物，你可以吃掉。"],
  [T_DEEP + 5.4, "……祝你好運。"],
];
// 系統框要藏起來的時段（開機紀錄和砸下來、標題的時候不要擋畫面）
const sayHidden = (t) => (t > 7.6 && t < T_WAKE + 0.4) || (t > T_WAKE + 9.6 && t < T_DEEP + 0.8) || t > END - 0.9;
// 開機紀錄（畫在畫布上，一行一行跑出來）
const BOOT = [
  [0.7, "STAR-SYS v0.0.1  BOOT"],
  [1.2, "MEMORY ............ OK"],
  [1.7, "SOUL SIGNAL ....... 1"],
  [2.3, "REINCARNATE.EXE ... LOAD"],
  [3.0, "RACE LOOKUP ......."],
];

/** 播開場。root：放畫布和台詞的容器；canvas：畫布。回傳 Promise（播完或跳過時 resolve）。 */
export async function playIntro(root, canvas) {
  await Promise.all([
    load("far", "town/far.png"), load("tmid", "town/mid.png"), new Promise((ok) => { const im = new Image(); im.onload = () => { IMG.logo = im; ok(); }; im.onerror = ok; im.src = new URL("../art/ui/logo.png", import.meta.url).href; }),
    load("vback", "valley/back.png"), load("vfar", "valley/far.png"), load("vmid", "valley/mid.png"), load("vground", "valley/ground.png"),
  ]);
  const SKY = createSky();
  IMG.sky = SKY.canvas();
  let skyLast = 0;
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
  // 雲（三層，越近越大越快）、速度線、碎石、發光的眼睛
  const clouds = Array.from({ length: 18 }, (_, i) => ({ layer: i % 3, x: rnd() * 560 - 20, y: rnd() * 900, w: 40 + rnd() * 70, h: 10 + rnd() * 10 }));
  const lines = Array.from({ length: 26 }, () => ({ x: rnd() * 520, y: rnd() * 400, len: 10 + rnd() * 30, sp: 500 + rnd() * 500, hot: rnd() < 0.25 }));
  const rocks = Array.from({ length: 22 }, () => ({ a: -Math.PI * (0.08 + rnd() * 0.84), v: 90 + rnd() * 170, s: rnd() < 0.3 ? 3 : 2, spin: rnd() }));
  const eyes = Array.from({ length: 7 }, (_, i) => ({ x: i < 4 ? 30 + rnd() * 90 : -30 - rnd() * 90, y: 70 + rnd() * 70, t0: 0.6 + i * 0.45 + rnd() * 0.3, red: rnd() < 0.5, blink: rnd() * 3 }));
  const glow = (x, y, r, col, a) => {
    if (r <= 0 || a <= 0) return;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  };
  const tile = (im, x, y) => { if (!im) return; const w = im.width; let sx = Math.floor(x % w); if (sx > 0) sx -= w; for (let xx = sx; xx < W; xx += w) g.drawImage(im, xx, Math.round(y)); };
  const fadeTo = (a, col = "4,3,10") => { if (a > 0) { g.fillStyle = `rgba(${col},${Math.min(1, a)})`; g.fillRect(0, 0, W, H); } };
  let fxF = null, fxImg = null, fxCv = null;
  const drawFx = (list) => {
    if (!fxF || fxF.w !== W) { fxF = createFrame(W, H); fxImg = new Uint8ClampedArray(W * H * 4); fxCv = document.createElement("canvas"); fxCv.width = W; fxCv.height = H; }
    clearFrame(fxF);
    for (const f of list) f && f.draw(fxF);
    composite(fxF, fxImg, null);
    fxCv.getContext("2d").putImageData(new ImageData(fxImg, W, H), 0, 0);
    g.drawImage(fxCv, 0, 0);
  };
  // 像素字（開機紀錄、警告）：等寬小字，畫在遊戲解析度的畫布上放大，像舊螢幕
  const text = (s, x, y, col, size = 8, align = "left") => { g.font = `${size}px monospace`; g.textAlign = align; g.textBaseline = "top"; g.fillStyle = col; g.fillText(s, Math.round(x), Math.round(y)); };
  // 雜訊：把幾條橫的畫面切片左右錯開
  const glitch = (n, amp) => { for (let i = 0; i < n; i++) { const y = Math.floor(rnd() * H), h = 1 + Math.floor(rnd() * 6), dx = Math.round((rnd() - 0.5) * amp); if (dx) g.drawImage(canvas, 0, y, W, h, dx, y, W, h); } };
  // 「！」：主角嚇一跳時頭上冒出來
  const bang = (x, y) => { g.fillStyle = "#2a1626"; g.fillRect(x - 2, y - 1, 5, 11); g.fillStyle = "#ffd84a"; g.fillRect(x - 1, y, 3, 6); g.fillRect(x - 1, y + 7, 3, 2); };

  let fallFx = null, heroFx = null, crashFx = null, slime = null, fxLast = 0, crashT = 0;
  const played = new Set();
  const once = (k, fn) => { if (!played.has(k)) { played.add(k); fn(); } };

  /** 畫第 t 秒（dt＝跟上一格差多少秒）。開發用：window.__introAt 可以一格一格往前畫 */
  function draw(t, dt) {
    g.fillStyle = "#04030a"; g.fillRect(0, 0, W, H);
    // ---- 台詞
    while (lineI < LINES.length && t >= LINES[lineI][0]) {
      const s = LINES[lineI][1];
      mood = /錯誤/.test(s) ? "wow" : moodOf(s);
      say.classList.add("on");
      say.classList.toggle("err", /錯誤/.test(s));
      say.classList.remove("glitch"); void say.offsetWidth; say.classList.add("glitch");
      typing?.skip();
      typing = typewriter(textEl, s, 1320, "sine");
      lineI++;
    }
    if (sayHidden(t)) say.classList.remove("on");
    faceG.clearRect(0, 0, 40, 40);
    faceG.drawImage(systemFace(mood === "normal" && Math.floor(t * 6.6) % 8 === 6 ? "blink" : mood, Math.floor(t * 6.6) % 8), 0, 0);

    if (t < T_SKY) return drawBoot(t);
    if (t < T_DIVE) return drawSky(t, dt);
    if (t < T_CAVE) return drawDive(t, dt);
    return drawCave(t, dt);
  }

  // ================= A：系統開機 =================
  function drawBoot(t) {
    const cx = W / 2, cy = H * 0.42;
    // 0 ～ 0.7：中間一條全像光線展開
    const open = Math.min(1, t / 0.7), w = Math.round(W * 0.5 * open);
    if (t < 7.4) {
      g.fillStyle = "rgba(122,232,255,.5)"; g.fillRect(Math.round(cx - w / 2), Math.round(cy), w, 1);
      glow(cx, cy, 50 * open, "70,200,255", 0.14);
    }
    // 開機紀錄
    const err = t > 4.6 && t < 6.2, ok = t >= 6.2;
    for (let i = 0; i < BOOT.length; i++) {
      const [t0, s] = BOOT[i];
      if (t < t0) break;
      const n = Math.min(s.length, Math.floor((t - t0) * 40));
      text(s.slice(0, n) + ((t * 3) % 1 < 0.5 && n < s.length ? "_" : ""), 18, 14 + i * 13, err ? "#ff8a7a" : "#7ae8ff", 11);   // 第 3 輪：8px 看不清楚 → 11px
    }
    if (t > 3.4 && t < 4.6) text("?".repeat(Math.floor((t - 3.4) * 6) % 6), 150, 14 + 4 * 13, "#7ae8ff", 11);
    // 紅色警告：閃爍、震動、整片泛紅
    if (err) {
      const k = t - 4.6, fl = Math.floor(k * 8) % 2 === 0, sh = Math.round((rnd() - 0.5) * 6 * Math.max(0, 1 - k / 1.2));
      fadeTo(0.25 + (fl ? 0.12 : 0), "120,10,20");
      g.save(); g.translate(sh, 0);
      const bw = 190, bh = 46, bx = Math.round(cx - bw / 2), by = Math.round(cy - bh / 2 + 18);
      g.fillStyle = "#1a0408"; g.fillRect(bx, by, bw, bh);
      g.fillStyle = fl ? "#ff3a4a" : "#a8141e"; g.fillRect(bx, by, bw, 2); g.fillRect(bx, by + bh - 2, bw, 2); g.fillRect(bx, by, 2, bh); g.fillRect(bx + bw - 2, by, 2, bh);
      text("!! ERROR 0x5741 !!", cx, by + 8, fl ? "#ffffff" : "#ff8a7a", 8, "center");
      text("種族不在資料庫", cx, by + 23, "#ffd0c8", 12, "center");
      g.restore();
      once("err", () => { sfx("hurt"); sfx("close"); });
    }
    // 強制寫入：金色框＋進度條
    if (ok && t < 7.4) {
      const k = Math.min(1, (t - 6.2) / 1.0);
      const bw = 190, bh = 46, bx = Math.round(cx - bw / 2), by = Math.round(cy - bh / 2 + 18);
      g.fillStyle = "#140c02"; g.fillRect(bx, by, bw, bh);
      g.fillStyle = "#ffd84a"; g.fillRect(bx, by, bw, 2); g.fillRect(bx, by + bh - 2, bw, 2); g.fillRect(bx, by, 2, bh); g.fillRect(bx + bw - 2, by, 2, bh);
      text("強制寫入：種族＝星星", cx, by + 8, "#ffe9a0", 12, "center");
      g.fillStyle = "#3a2a10"; g.fillRect(bx + 16, by + 30, bw - 32, 6);
      g.fillStyle = "#ffd84a"; g.fillRect(bx + 16, by + 30, Math.round((bw - 32) * k), 6);
      if (k >= 1) once("okb", () => sfx("levelup"));
    }
    // 掃描線：一條亮線往下掃，加上淡淡的橫紋
    const sy = ((t * 70) % (H + 40)) - 20;
    g.fillStyle = "rgba(122,232,255,.08)"; g.fillRect(0, Math.round(sy), W, 6);
    g.fillStyle = "rgba(0,0,0,.18)"; for (let y = 0; y < H; y += 2) g.fillRect(0, y, W, 1);
    // 雜訊：警告時很多
    glitch(err ? 10 : t > 4.2 && t < 4.6 ? 4 : (t * 7) % 1 < 0.08 ? 2 : 0, err ? 24 : 10);
    // 7.4 ～ 8：像舊電視關機——畫面壓成一條白線再縮成一點
    if (t > 7.4) {
      const k = (t - 7.4) / 0.6, lw = Math.round(W * Math.max(0, 1 - k * 1.6)), lh = Math.max(1, Math.round(H * Math.max(0, 0.4 - k)));
      g.fillStyle = "#04030a"; g.fillRect(0, 0, W, H);
      g.fillStyle = "#e8fbff"; g.fillRect(Math.round(cx - lw / 2), Math.round(cy - lh / 2), Math.max(2, lw), lh);
      glow(cx, cy, 30 * (1 - k), "122,232,255", 0.5);
      once("off", () => sfx("dash"));
    }
    fadeTo(t < 0.3 ? 1 - t / 0.3 : 0);
  }

  // ================= B：夜空流星雨 =================
  function drawSky(t, dt) {
    const tb = t - T_SKY, pan = Math.min(1, tb / 5) ** 2;
    SKY.update(Math.min(0.1, tb - skyLast)); skyLast = tb;
    g.fillStyle = "#2c1a48"; g.fillRect(0, 0, W, H);
    tile(IMG.sky, -tb * 3, -pan * 10);
    if (tb > 0.4 && !fallFx) fallFx = createFx(starFall, { x: Math.round(W * 0.55), y: H - 52, palette: GOLD.slice(1, 9), seed: 13, light: 0.6 });
    if (tb > 2.0 && !heroFx) { heroFx = createFx(starMeteor, { x: Math.round(W * 0.32), y: H - 46, palette: GOLD, flip: true, light: 0.5, clean: true }); sfx("dash"); }
    fallFx?.update(dt); heroFx?.update(dt);
    drawFx([fallFx, heroFx]);
    tile(IMG.far, -tb * 2 - 260, H - (IMG.far?.height ?? 216) + 40 - pan * 12);
    // 最後 0.8 秒：鏡頭猛地往那顆碎片推過去（白光蓋過來，接下一幕的跟拍）
    if (tb > 5.2) { const k = (tb - 5.2) / 0.8; glow(W * 0.32, H * 0.55, 40 + k * 300, "255,236,170", Math.min(1, k * 1.3)); }
    fadeTo(tb < 0.5 ? 1 - tb * 2 : 0);
  }

  // ================= B2：跟拍往下衝 =================
  function drawDive(t, dt) {
    const td = t - T_DIVE, D = T_CAVE - T_DIVE;
    // 往下掉的速度：一開始快、穿雲最快、看到城鎮時慢一點（讓人看清楚）、最後衝進山谷再加速
    const fall = td * 160 + (td > 3 ? (td - 3) * -60 : 0) + (td > 5 ? (td - 5) ** 2 * 260 : 0);
    // 天空：越往下越亮的藍紫 → 城鎮那段是夜色
    const sk = g.createLinearGradient(0, 0, 0, H);
    sk.addColorStop(0, "#140c2a"); sk.addColorStop(1, td < 3 ? "#3a2860" : "#241a40");
    g.fillStyle = sk; g.fillRect(0, 0, W, H);
    // 星空往上飛走
    tile(IMG.sky, -td * 4, -((fall * 0.25) % 216));
    tile(IMG.sky, -td * 4, 216 - ((fall * 0.25) % 216));
    // 雲：三層，遠的慢、近的快（穿過去的時候整片白一下）
    const cloudLayer = (L, front) => {
      for (const c of clouds) {
        if (c.layer !== L || td > 3.6) continue;
        const sp = [0.5, 0.9, 1.6][L], y = ((c.y - fall * sp) % 900 + 900) % 900 - 120, s = 1 + L * 0.6;
        if (y > H + 20 || y < -40) continue;
        const col = front ? "rgba(214,206,240,.85)" : L === 0 ? "rgba(90,72,140,.6)" : "rgba(150,132,200,.7)";
        g.fillStyle = col;
        for (let r = 0; r < c.h * s; r += 2) { const ww = c.w * s * Math.sqrt(1 - ((r - (c.h * s) / 2) / ((c.h * s) / 2)) ** 2); g.fillRect(Math.round(c.x - ww / 2), Math.round(y + r), Math.round(ww), 2); }
      }
    };
    cloudLayer(0, false); cloudLayer(1, false);
    // 城鎮：從下面升上來（3 ～ 5.4 秒），燈火一閃一閃
    if (td > 2.6 && td < 6) {
      const k = (td - 2.6) / 3.4, ty = H + 20 - k * 420;   // 第 3 輪：原本升得不夠高，城鎮的房子一直在畫面外
      tile(IMG.tmid ?? IMG.far, -60 - td * 6, ty);
      for (let i = 0; i < 9; i++) { const lx = ((i * 57 + 30) % W), ly = ty + 60 + ((i * 23) % 40); glow(lx, ly, 6 + (Math.sin(t * 5 + i) > 0 ? 2 : 0), "255,190,90", 0.7); }
    }
    // 山谷：最後衝進去（5 秒後，山從下面湧上來、畫面變暗）
    if (td > 4.8) {
      const k = Math.min(1, (td - 4.8) / 2.2), vy = H - k * 260;
      tile(IMG.vfar, -td * 10, vy - 20); tile(IMG.vmid, -td * 18, vy + 40);
    }
    // 速度線：往上飛
    for (const l of lines) {
      const y = ((l.y - fall * (l.sp / 300)) % 400 + 400) % 400 - 100;
      g.fillStyle = l.hot ? "rgba(255,230,150,.55)" : "rgba(200,210,255,.3)";
      g.fillRect(Math.round(l.x % W), Math.round(y), 1, Math.round(l.len * (1 + Math.min(1, td / 2))));
    }
    // 主角那顆碎片：畫面中間偏上，蜷著身體往下掉（2 倍大），拖一條金色尾巴往上
    const hx = W / 2 + Math.sin(td * 2.3) * 8, hy = H * 0.46 + Math.sin(td * 3.1) * 3;
    for (let i = 14; i > 0; i--) glow(hx + Math.sin((td - i * 0.03) * 2.3) * 8 * 0.9, hy - i * 7, 10 - i * 0.5, "255,210,90", 0.12);
    glow(hx, hy, 34, "255,226,140", 0.45);
    const h = hero({ ...POSES.fall, eyes: "hurt" }), S = 2;
    g.drawImage(h.c, Math.round(hx - h.ax * S), Math.round(hy - h.ay * S + 18), h.c.width * S, h.c.height * S);
    glow(hx, hy, 14, "255,255,230", 0.5);
    cloudLayer(2, true);   // 最近的雲蓋在主角前面
    // 穿雲的白閃、城鎮段的音效
    if (td > 0.9 && td < 1.05) fadeTo(0.5, "230,226,255");
    once("dive", () => sfx("dash"));
    if (td > 3) once("town", () => sfx("chime", 1318));
    // 最後 0.5 秒：全黑（下一幕從洞窟裡看它砸下來）
    fadeTo(td < 0.25 ? 1 - td / 0.25 : td > D - 0.5 ? (td - (D - 0.5)) * 2 : 0);
  }

  // ================= C、T、D、E：洞窟 =================
  function drawCave(t, dt) {
    const tc = t - T_CAVE;
    // 撞擊特效的時間：撞地前 0.35 秒放慢到 0.18 倍（慢動作），撞到之後恢復
    const IMPACT = 0.67, slow = crashT > IMPACT - 0.35 && crashT < IMPACT ? 0.18 : 1;
    crashT += dt * slow;
    const a = crashT - IMPACT;   // 撞地後幾秒（負的＝還沒撞）
    const quake = a > 0 && a < 0.8 ? (1 - a / 0.8) * 9 : t > T_DEEP + 3.2 && t < T_DEEP + 3.6 ? 2 : 0;
    const sx = quake ? Math.round((rnd() - 0.5) * quake) : 0, sy = quake ? Math.round((rnd() - 0.5) * quake * 0.7) : 0;
    g.save(); g.translate(sx, sy);
    const deep = t > T_DEEP ? Math.min(1, (t - T_DEEP) / 2) : 0;   // E：鏡頭往右邊（洞窟深處）挪一點
    // 第 2 輪：主角 1 倍大，醒來的表演看不清楚 → D 段鏡頭推近到 2 倍（對準主角），E 段拉回 1.5 倍（看得到右邊的史萊姆）
    const zIn = t > T_WAKE ? Math.min(1, (t - T_WAKE) / 1.2) : 0, ease = zIn * zIn * (3 - 2 * zIn);
    const zoom = 1 + ease * (1 - deep * 0.5), focusX = W / 2 + 12 + deep * 40, focusY = H - 52;
    g.translate(focusX, focusY); g.scale(zoom, zoom); g.translate(-focusX, -focusY);
    const camX = deep * 40;
    tile(IMG.vback, -40 - camX * 0.2, 0); tile(IMG.vfar, -80 - camX * 0.4, 0); tile(IMG.vmid, -140 - camX * 0.7, 0);
    const gy = H - 40;
    tile(IMG.vground, -60 - camX, gy - 9);
    const cx = Math.round(W / 2 - camX);
    if (!crashFx) crashFx = createFx(meteorFx, { x: Math.round(W / 2), y: gy, palette: GOLD, light: 0.6, seed: 5 });
    crashFx.update(dt * slow);
    // 慢動作時四周壓暗、中間一圈光（聚焦）
    if (slow < 1) fadeTo(0.35);
    // ---- 撞擊：衝擊波、碎石
    if (a > 0) {
      once("boom", () => { sfx("bossLand"); sfx("boom"); });
      if (a < 0.7) {
        const r = 10 + a * 260, al = 1 - a / 0.7;
        g.strokeStyle = `rgba(255,236,170,${al})`; g.lineWidth = 3;
        g.beginPath(); g.ellipse(W / 2, gy, r, r * 0.28, 0, 0, Math.PI * 2); g.stroke();
        g.strokeStyle = `rgba(255,255,255,${al * 0.8})`; g.lineWidth = 1;
        g.beginPath(); g.ellipse(W / 2, gy, r * 0.7, r * 0.2, 0, 0, Math.PI * 2); g.stroke();
      }
      for (const r of rocks) {
        const tt = Math.min(a, 1.6), x = W / 2 + Math.cos(r.a) * r.v * tt, y = gy - 4 + Math.sin(r.a) * r.v * tt + 220 * tt * tt;
        if (y > gy + 2) continue;
        g.fillStyle = r.spin < 0.5 ? "#6a5a7a" : "#3a2f4a"; g.fillRect(Math.round(x), Math.round(y), r.s, r.s);
        g.fillStyle = "#a898b8"; g.fillRect(Math.round(x), Math.round(y), 1, 1);
      }
    }
    // ---- 主角（撞地之後）
    if (a > 0) {
      const w = t - T_WAKE;   // 醒來的表演（負的＝還在煙裡）
      let q = { ...POSES.hurt, eyes: "hurt" }, flip = false, hx = cx, hy = gy + 3, mark = false;
      if (w > 0.9) q = { ...POSES.hurt, eyes: w < 1.1 || (w > 1.5 && w < 1.62) ? "blink" : "open" };    // 睜眼、眨一下
      if (w > 2.2) { q = POSES.land; hy = gy; }                                                         // 爬起來
      if (w > 2.6) q = POSES.stand;
      if (w > 3.2) q = { ...POSES.stand, hf: [-2, -2], hb: [2, -2], eyes: "open" };                      // 低頭看自己的手
      if (w > 3.8 && w < 4.4) q = { ...POSES.stand, hf: [-2, -2], hb: [2, -2], eyes: Math.floor(w * 8) % 2 ? "open" : "blink" };
      if (w > 4.4 && w < 5.2) {                                                                         // 嚇一跳：原地彈起來
        const k = (w - 4.4) / 0.8; q = POSES.jump; hy = gy - Math.round(Math.sin(k * Math.PI) * 22); mark = true;
        once("jump", () => sfx("chime", 2093));
      }
      if (w >= 5.2 && w < 5.5) { q = POSES.land; once("land1", () => sfx("land")); }
      if (w >= 5.5 && w < 6.6) { const k = w - 5.5; q = POSES.run[Math.floor(k * 10) % 4]; hx = cx + Math.round(k * 22); }   // 想走路
      if (w >= 6.6 && w < 7.9) { hx = cx + 24; hy = gy + 3; q = { ...POSES.hurt, eyes: "hurt" }; once("trip", () => { sfx("land", true); sfx("squish"); }); }   // 跌個狗吃屎
      if (w >= 7.9) { hx = cx + 24; q = w < 8.2 ? POSES.land : { ...POSES.idle[Math.floor(t * 6.6) % 8], view: 0 }; }
      if (w > 2.2) once("up", () => sfx("land"));
      // E：轉頭看右邊的史萊姆
      if (t > T_DEEP + 3.4) flip = false;
      if (t > T_DEEP + 2.6 && t < T_DEEP + 3.4) { flip = true; }
      const hh = hero(q, flip);
      // 星星自己會發光（E 段黑暗裡更明顯）
      if (w > 0.9) glow(hx, hy - 10, 26 + deep * 10, "255,216,120", 0.18 + deep * 0.12);
      g.drawImage(hh.c, Math.round(hx - hh.ax), Math.round(hy - hh.ay));
      if (mark) bang(hx, hy - 34);
      if (w >= 6.6 && w < 7.3) { g.fillStyle = "rgba(200,190,220,.6)"; for (let i = 0; i < 6; i++) g.fillRect(Math.round(hx - 10 + i * 4), Math.round(gy - 2 - ((w - 6.6) * 30 * (i % 3)) % 8), 2, 2); }   // 跌倒揚起的灰
    }
    drawFx([crashFx]);
    if (a > 0 && a < 0.14) { g.fillStyle = `rgba(255,250,235,${1 - a / 0.14})`; g.fillRect(-10, -10, W + 20, H + 20); }
    // ---- E：洞窟深處——黑暗裡一雙雙眼睛、史萊姆從右邊探頭
    if (deep > 0) {
      fadeTo(deep * 0.45);
      const te = t - T_DEEP;
      if (te > 2.4) {
        if (!slime) { slime = createFx(slimeFx, { x: W + 30, y: gy, flip: true, light: 0.3 }); sfx("squish"); }
        const k = Math.min(1, (te - 2.4) / 1.2);
        slime.options.x = Math.round(W + 30 - k * 140);   // 第 3 輪：鏡頭推近 1.5 倍，原本停的位置在畫面外
        slime.update(dt);
      }
    }
    if (slime) drawFx([slime]);
    g.restore();
    // 黑暗裡的眼睛：畫在螢幕座標（第 3 輪：原本畫在場景裡，鏡頭推近後被推到畫面外）
    if (deep > 0) {
      const te = t - T_DEEP;
      for (const e of eyes) {
        if (te < e.t0) continue;
        const k = Math.min(1, (te - e.t0) / 0.4), bl = (te + e.blink) % 3.2 < 0.12;
        if (bl) continue;
        const ex = e.x > 0 ? e.x : W + e.x, col = e.red ? "#ff4a3a" : "#ffd84a", gl = e.red ? "255,80,60" : "255,216,74";
        glow(ex + 3, e.y + 1, 7, gl, 0.55 * k);
        g.globalAlpha = k; g.fillStyle = col; g.fillRect(Math.round(ex), Math.round(e.y), 3, 2); g.fillRect(Math.round(ex + 6), Math.round(e.y), 3, 2); g.globalAlpha = 1;
      }
    }
    // ---- 標題：「轉生成星星碎片的我」砸下來
    const tt = t - T_TITLE;
    if (tt > 0 && tt < T_WAKE - T_TITLE + 0.3) {
      const drop = Math.min(1, tt / 0.28), bounce = tt > 0.28 && tt < 0.5 ? Math.sin(((tt - 0.28) / 0.22) * Math.PI) * 4 : 0;
      const s = 1 + (1 - drop) * 1.6, al = Math.min(1, tt / 0.15) * (tt > 4 ? Math.max(0, 1 - (tt - 4) / 0.6) : 1);
      if (tt > 0.28) once("title", () => { sfx("bossLand"); sfx("levelup"); });
      g.save(); g.globalAlpha = al;
      g.translate(W / 2, H * 0.36 - bounce + (tt > 0.28 && tt < 0.6 ? Math.round((rnd() - 0.5) * 4) : 0)); g.scale(s, s);
      // 第 2 輪：用標題畫面那張正式的標題字（art/ui/logo.png），沒有的話才用文字
      const L = IMG.logo;
      if (L) { const k = Math.min((W * 0.86) / L.width, (H * 0.42) / L.height); g.drawImage(L, Math.round((-L.width * k) / 2), Math.round((-L.height * k) / 2), Math.round(L.width * k), Math.round(L.height * k)); }
      else {
        g.font = "bold 22px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
        g.fillStyle = "#1a0c02"; for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 3], [-2, 2], [2, 2]]) g.fillText("轉生成星星碎片的我", dx, dy);
        const gr = g.createLinearGradient(0, -12, 0, 12); gr.addColorStop(0, "#fff6c8"); gr.addColorStop(0.5, "#ffd84a"); gr.addColorStop(1, "#c8761a");
        g.fillStyle = gr; g.fillText("轉生成星星碎片的我", 0, 0);
      }
      g.restore();
      if (tt > 0.28 && tt < 0.5) glow(W / 2, H * 0.36, 120, "255,226,140", 0.5 * (1 - (tt - 0.28) / 0.22));
      if (tt > 1.0 && !IMG.logo) {
        g.save(); g.globalAlpha = Math.min(1, (tt - 1) / 0.6) * al;
        g.font = "bold 11px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
        g.fillStyle = "#0a0614"; g.fillText("～靠吸收魔物變成最強～", W / 2 + 1, H * 0.36 + 22);
        g.fillStyle = "#e8e0ff"; g.fillText("～靠吸收魔物變成最強～", W / 2, H * 0.36 + 21);
        g.restore();
      }
    }
    // 四周壓暗（越深越暗）＋淡入淡出
    const v = g.createRadialGradient(W / 2, H * 0.6, H * 0.2, W / 2, H * 0.6, W * 0.65);
    v.addColorStop(0, "rgba(4,3,10,0)"); v.addColorStop(1, `rgba(4,3,10,${0.7 + deep * 0.2})`);
    g.fillStyle = v; g.fillRect(0, 0, W, H);
    fadeTo(tc < 0.3 ? 1 - tc / 0.3 : t > END - 0.8 ? (t - (END - 0.8)) / 0.8 : 0);
  }

  return new Promise((resolve) => {
    let run = true, t0 = performance.now(), last = 0, lastT = 0;
    // 配樂（audio.js introMusic，跟這裡的時間表對齊）：原本在放的音樂先停，播完／跳過再接回去
    const prevSong = musicNow(); music(null);
    const score = introMusic();
    const finish = () => {
      if (!run) return;
      run = false;
      score.stop();
      if (prevSong) music(prevSong);
      typing?.skip();
      removeEventListener("resize", resize);
      say.remove(); skip.remove();
      delete window.__introAt;
      resolve();
    };
    skip.addEventListener("click", (e) => { e.stopPropagation(); sfx("ui"); finish(); });
    // 開發用：一格一格往前畫到第 t 秒（測試時 requestAnimationFrame 不會跑）
    window.__introAt = (t) => { run = false; score.stop(); while (fxLast < t) { const n = Math.min(t, fxLast + 1 / 30); draw(n, n - fxLast); fxLast = n; } };
    const frame = (now) => {
      if (!run) return;
      requestAnimationFrame(frame);
      if (now - last < 1000 / 30) return;
      last = now;
      const t = (now - t0) / 1000;
      if (t >= END) return finish();
      draw(t, Math.min(0.1, t - lastT));
      lastT = t;
    };
    requestAnimationFrame(frame);
  });
}
