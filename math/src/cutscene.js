// 劇情動畫播放器（2026-11-25 使用者：所有的劇情都做動畫演出）。
// 一段劇情＝一個 async 函式，拿到導演 D，照順序下指令：
//   D.bg(圖, { filter, fade })             換背景（原圖，鋪滿；可以變灰 filter）
//   D.img(圖, { x, y, h, z, ... })          放一張原圖（建築、浮空船…）→ 回傳演員
//   D.sprite(fn, { x, y, scale, z, ... })   放一個像素角色（fn(t) → 畫面，每秒 10 格）→ 回傳演員
//   演員.to({ x, y, scale, alpha, rot }, 秒數, 緩動)   走位／縮放／淡入淡出（await 等它做完）
//   演員.bob(幅度, 速度)  一直上下浮；演員.remove()
//   D.caption(字)         下方的旁白字幕（不用點，會自己換）
//   D.say(對話)           對話框（有頭像，要點一下才繼續；用 world/talk.js）
//   D.wait(秒)            等一下
//   D.fx(種類, x, y, n)   粒子：sparkle 閃光點、ink 墨水噴濺、burst 光點炸開、rise 光點往上飄
//   D.flash(顏色, 秒)、D.shake(幅度, 秒)、D.cam({ zoom, x, y }, 秒)、D.filter(css, 秒)（整個背景）
// 座標：舞台 384×216 格（跟戰鬥一樣），畫面比較寬時左右多看到一點背景；1 格＝畫面高 / 216。
// 右上角「跳過」：整段劇情直接結束（腳本裡 await 的地方會丟出 SKIP，播放器接住）。

import { el, show } from "./ui.js";
import { talk } from "./world/talk.js";
import { sfx } from "./audio.js";

export const SKIP = Symbol("skip");
const A = (p) => (p.startsWith("http") || p.startsWith("data:") ? p : new URL(`../assets/${p}`, import.meta.url).href);
const EASE = { linear: (u) => u, inout: (u) => u * u * (3 - 2 * u), out: (u) => 1 - (1 - u) ** 3, in: (u) => u ** 3, back: (u) => 1 + 2.7 * (u - 1) ** 3 + 1.7 * (u - 1) ** 2 };
const rand = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function frameCanvas(f, cv) {
  if (cv.width !== f.w || cv.height !== f.h) { cv.width = f.w; cv.height = f.h; }
  cv.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(f.px.buffer.slice(0)), f.w, f.h), 0, 0);
}

/** 播一段劇情。opts.skippable（預設 true）。回傳 true＝看完、false＝跳過 */
export async function playCutscene(script, { skippable = true, className = "" } = {}) {
  const bgs = el("div.csbgs"), stage = el("div.csstage"), fxc = el("canvas.csfx"), cap = el("div.cscap", { hidden: true });
  const flashEl = el("div.csflash");
  let skipRes; const skipP = new Promise((r) => (skipRes = r));
  const skipBtn = el("button.btn.small.csskip", { hidden: !skippable, onclick: () => { skipped = true; skipRes(); sfx("click"); } }, "跳過");
  const root = el(`div.screen.csscr${className ? "." + className : ""}`, {}, el("div.cscam", {}, bgs, stage), fxc, flashEl, cap, skipBtn);
  show(root);
  let skipped = false, alive = true, t = 0, last = performance.now(), u = 1, ox = 0;
  const actors = [], parts = [], grounds = [];
  const cam = { zoom: 1, x: 192, y: 108 }, camEl = root.querySelector(".cscam");
  let shakeA = 0, shakeT = 0;

  const check = () => { if (skipped) throw SKIP; };
  const sleep = (sec) => new Promise((res) => { const end = t + sec; const w = () => (skipped || t >= end || !alive ? res() : requestAnimationFrame(w)); w(); }).then(check);

  function layout() {
    const h = root.clientHeight || 1, w = root.clientWidth;
    u = h / 216; ox = (w - 384 * u) / 2;
    fxc.width = Math.round(w); fxc.height = Math.round(h);
    for (const a of actors) a.place();
    for (const g of grounds) Object.assign(g.style, { top: `${Number(g.dataset.y) * u}px`, backgroundSize: `auto ${Number(g.dataset.tile) * u}px` });
  }
  // ── 演員 ──
  function actor(node, o, natural) {
    const a = { node, x: o.x ?? 192, y: o.y ?? 108, scale: o.scale ?? 1, alpha: o.alpha ?? 1, rot: o.rot ?? 0, flip: !!o.flip, bobA: 0, bobS: 1, bobP: rand(actors.length) * 6, z: o.z ?? 1, h: o.h, anchor: o.anchor ?? "bottom", tweens: [] };
    node.style.zIndex = a.z;
    a.size = () => { const nat = natural(); const H = (a.h ?? nat[1]) * u, W = (nat[0] / nat[1]) * H; return [W, H]; };
    a.place = () => {
      const [W, H] = a.size(), bob = Math.sin(t * a.bobS + a.bobP) * a.bobA * u;
      const left = ox + a.x * u - W / 2, top = a.y * u - (a.anchor === "bottom" ? H : H / 2) + bob;
      Object.assign(node.style, { left: `${left}px`, top: `${top}px`, width: `${W}px`, height: `${H}px`, opacity: a.alpha,
        transform: `rotate(${a.rot}deg) scale(${a.scale * (a.flip ? -1 : 1)}, ${a.scale})`, transformOrigin: a.anchor === "bottom" ? "50% 100%" : "50% 50%" });
    };
    a.to = (p, sec = 1, ease = "inout") => new Promise((res) => {
      const from = {}; for (const k in p) from[k] = a[k];
      a.tweens.push({ p, from, t0: t, sec: Math.max(0.001, sec), ease: EASE[ease] ?? EASE.inout, res });
    }).then(check);
    a.set = (p) => { Object.assign(a, p); a.place(); return a; };
    a.bob = (amp = 1.5, speed = 2) => { a.bobA = amp; a.bobS = speed; return a; };
    a.remove = () => { node.remove(); actors.splice(actors.indexOf(a), 1); };
    stage.append(node); actors.push(a); a.place();
    return a;
  }

  const D = {
    get t() { return t; }, get skipped() { return skipped; },
    async bg(src, { filter = "", fade = 0.6, pos = "center" } = {}) {
      const im = el("div.csbg", { style: { backgroundImage: `url(${A(src)})`, filter, opacity: 0, backgroundPosition: pos } });
      bgs.append(im);
      requestAnimationFrame(() => { im.style.transition = `opacity ${fade}s, filter 1.2s`; im.style.opacity = 1; });
      const olds = [...bgs.querySelectorAll(".csbg")].slice(0, -1);
      setTimeout(() => olds.forEach((o) => o.remove()), fade * 1000 + 100);
      await sleep(fade * 0.5);
    },
    // 地面：一條鋪滿寬度的地板（原圖重複鋪），上緣在 y 格；跟背景一起變灰
    ground(src, y, tile = 30) {
      const g = el("div.csground", { style: { backgroundImage: `url(${A(src)})` } });
      g.dataset.y = y; g.dataset.tile = tile; bgs.append(g); grounds.push(g); layout();
    },
    filter(css, sec = 1.2) { for (const b of [...bgs.querySelectorAll(".csbg"), ...grounds]) if (b) { b.style.transition = `filter ${sec}s`; b.style.filter = css; } for (const a of actors) if (a.tint !== false) { a.node.style.transition = `filter ${sec}s`; a.node.style.filter = css; } return sleep(0); },
    img(src, o = {}) {
      const im = el("img.csimg", { src: A(src), alt: "", draggable: false });
      if (o.clip) im.style.clipPath = o.clip;
      const a = actor(im, o, () => [im.naturalWidth || 100, im.naturalHeight || 100]);
      if (!im.complete) im.onload = () => a.place();
      a.tint = o.tint;
      return a;
    },
    sprite(fn, o = {}) {
      const cv = el("canvas.cssp"), f0 = fn(0);
      frameCanvas(f0, cv);
      const a = actor(cv, { ...o, h: (o.h ?? f0.h) * (o.px ?? 1.5) }, () => [cv.width, cv.height]);
      a.fn = fn; a.tint = o.tint ?? false;
      return a;
    },
    caption(text) { cap.hidden = !text; cap.textContent = text ?? ""; },
    async say(lines, choices) { check(); const r = await Promise.race([talk(root, lines, choices), skipP]); check(); return r; },
    wait: sleep,
    fx(kind, x, y, n = 20, color) {
      for (let i = 0; i < n; i++) {
        const a = rand(i + parts.length) * Math.PI * 2, sp = 20 + rand(i * 3 + parts.length) * 60;
        const p = { kind, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7, life: 0.6 + rand(i + 7) * 0.9, t: 0, c: color, s: 1 + Math.floor(rand(i + 2) * 2) };
        if (kind === "rise") { p.vx = (rand(i) - 0.5) * 12; p.vy = -10 - rand(i + 1) * 25; p.x = x + (rand(i + 5) - 0.5) * 120; p.y = y + rand(i + 6) * 40; p.life = 1.2 + rand(i) * 1.5; }
        if (kind === "sparkle") { p.vx *= 0.15; p.vy *= 0.15; p.x = x + (rand(i + 5) - 0.5) * 300; p.y = y + (rand(i + 6) - 0.5) * 160; p.life = 0.8 + rand(i) * 1.6; }
        if (kind === "ink") { p.vx *= 2.2; p.vy = p.vy * 1.6 - 70; p.g = 110; p.s = 3 + Math.floor(rand(i) * 4); p.life += 0.6; }
        parts.push(p);
      }
    },
    flash(color = "#fff", sec = 0.4) { flashEl.style.transition = "none"; flashEl.style.background = color; flashEl.style.opacity = 1; requestAnimationFrame(() => { flashEl.style.transition = `opacity ${sec}s`; flashEl.style.opacity = 0; }); },
    shake(a = 4, sec = 0.4) { shakeA = a; shakeT = sec; },
    cam(p, sec = 1.5) {
      const from = { ...cam };
      return new Promise((res) => { const t0 = t; const step = () => { const k = EASE.inout(Math.min(1, (t - t0) / sec)); for (const key in p) cam[key] = from[key] + (p[key] - from[key]) * k; if (k >= 1 || skipped || !alive) res(); else requestAnimationFrame(step); }; step(); }).then(check);
    },
    fadeOut(color = "#fffaeb", sec = 1) { flashEl.style.transition = `opacity ${sec}s`; flashEl.style.background = color; flashEl.style.opacity = 1; return sleep(sec); },
  };

  // ── 每一格 ──
  let acc = 0;
  const fctx = fxc.getContext("2d");
  function frame(now) {
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt; acc += dt;
    for (const a of actors) {
      for (const tw of [...a.tweens]) {
        const k = Math.min(1, (t - tw.t0) / tw.sec), e = tw.ease(k);
        for (const key in tw.p) a[key] = tw.from[key] + (tw.p[key] - tw.from[key]) * e;
        if (k >= 1 || skipped) { a.tweens.splice(a.tweens.indexOf(tw), 1); tw.res(); }
      }
      if (a.fn && acc > 0.1) frameCanvas(a.fn(t), a.node);
      a.place();
    }
    if (acc > 0.1) acc = 0;
    // 鏡頭＋晃動
    let sx = 0, sy = 0;
    if (shakeT > 0) { shakeT -= dt; sx = (Math.random() - 0.5) * shakeA * u * 2; sy = (Math.random() - 0.5) * shakeA * u * 2; }
    camEl.style.transform = `translate(${sx}px, ${sy}px) scale(${cam.zoom})`;
    camEl.style.transformOrigin = `${ox + cam.x * u}px ${cam.y * u}px`;
    // 粒子
    fctx.clearRect(0, 0, fxc.width, fxc.height);
    for (const p of parts) {
      p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.g) p.vy += p.g * dt;
      const k = p.t / p.life; if (k >= 1) continue;
      const X = Math.round(ox + p.x * u), Y = Math.round(p.y * u), S = Math.max(2, Math.round(p.s * u));
      fctx.globalAlpha = p.kind === "sparkle" ? Math.sin(k * Math.PI) : 1 - k;
      fctx.fillStyle = p.c ?? (p.kind === "ink" ? (p.s > 3 ? "#2d2350" : "#463a78") : p.kind === "rise" ? "#ffe9a0" : "#fff6d0");
      fctx.fillRect(X, Y, S, S);
      if (p.kind === "sparkle" || p.kind === "burst") { fctx.fillRect(X - S, Y, S * 3, Math.max(1, S / 2)); fctx.fillRect(X, Y - S, Math.max(1, S / 2), S * 3); }
    }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].t >= parts[i].life) parts.splice(i, 1);
    fctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }
  const ro = new ResizeObserver(layout); ro.observe(root);
  layout(); requestAnimationFrame(frame);
  let done = true;
  try { await script(D); } catch (e) { if (e !== SKIP) throw e; done = false; }
  alive = false; ro.disconnect();
  root.querySelector(".talk")?.remove();
  return { done, root, D };
}
