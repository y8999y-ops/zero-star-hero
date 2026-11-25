// 區域畫面（使用者 2026-11-25：不要大地圖、點選就好）：受污染的區域是一張橫的場景（那一區的戰鬥背景原圖），
// 見習魔數師站在左邊，往右排著三群墨水怪（第 1～3 關）和墨水封印門後面的王。
//   ・第 n 關要先打過第 n−1 關（還不能打的怪物是半透明、上面一個鎖）
//   ・三群都淨化，封印門才消失、王才出來
//   ・王打倒前整區是墨水灰；剛打倒王回來會演「恢復色彩」＋頁頁的話
// 點怪物就開打；打完回到這裡（save.returnTo）。

import { el, show } from "../ui.js";
import { sfx } from "../audio.js";
import { GRADES, ATTRS } from "../data.js";
import { writeSave } from "../save.js";
import { talk } from "../world/talk.js";
import { heroFrame } from "../../fx/hero.js";
import { inkDropFrame } from "../../fx/ink-drop.js";
import { crookedFlowerFrame } from "../../fx/crooked-flower.js";
import { inkKingBabyFrame } from "../../fx/ink-king-baby.js";
import { scatterPageFrame } from "../../fx/scatter-page.js";
import { doodleBatFrame } from "../../fx/doodle-bat.js";
import { chaosClockFrame } from "../../fx/chaos-clock.js";
import { inkKingPageFrame, inkKingGearFrame, inkKingCrystalFrame, inkKingTrueFrame } from "../../fx/ink-king-forms.js";
import { crystalBugFrame } from "../../fx/crystal-bug.js";
import { minusShadeFrame } from "../../fx/minus-shade.js";

const HD = { g1: "garden", g2: "library", g34: "clock", g56: "greenhouse", jh: "vault" };
const FRAMES = { ink: inkDropFrame, flower: crookedFlowerFrame, king: inkKingBabyFrame, pages: scatterPageFrame, bat: doodleBatFrame, tick: chaosClockFrame, kingPage: inkKingPageFrame, kingGear: inkKingGearFrame, bug: crystalBugFrame, shade: minusShadeFrame, kingCrystal: inkKingCrystalFrame, kingTrue: inkKingTrueFrame };
const KINDS = { g1: ["ink", "flower", "ink"], g2: ["pages", "bat", "pages"], g34: ["tick", "bat", "tick"], g56: ["bug", "flower", "bug"], jh: ["shade", "bat", "shade"] };
const BOSS = { g1: "king", g2: "kingPage", g34: "kingGear", g56: "kingCrystal", jh: "kingTrue" };
const BACK = { g2: { name: "回圖書館大廳", go: ["library"] }, jh: { name: "回圖書館大廳", go: ["library"] } };
// 站的位置（戰鬥畫面的格子：寬 384、地面 y＝144）
const PX = 52, MX = [128, 196, 262], BX = 334, GROUND = 144;
const A = (p) => new URL(`../../assets/${p}`, import.meta.url).href;
const RESTORE = {
  g1: ["哇……花園的顏色回來了！花瓣又是五瓣、六瓣，數得清清楚楚！", "墨水大王縮回地下禁書庫去了。可是它說的那句「反正沒有人會算完我」……我有點在意。", "下一個是千頁圖書館的上層書庫（二年級），從圖書館大廳上樓。我們一區一區，把學院的顏色找回來吧！"],
  g2: ["書頁全部飛回書架上了！每一本都排得整整齊齊，頁碼一頁接一頁。", "墨水大王把書頁鎧甲丟下就跑了……它一邊跑一邊喊「題目那麼多，誰算得完」。", "下一個是刻度鐘塔（三～四年級），在學院的右邊。"],
  g34: ["鐘塔又開始滴答滴答地走了！指針指著刻度，一格都不差。", "墨水大王身上的齒輪掉了一地。它好像越來越生氣，又好像……有點寂寞？", "接下來是分晶溫室的深處（四年級下）。從學院右邊的溫室進去！"],
  g56: ["溫室的水晶果實又亮起來了，一顆一顆整整齊齊，分成幾份都數得清清楚楚。", "墨水大王身上的水晶刺碎掉了。它往圖書館的地下逃走了……", "最後是地下禁書庫（中年級總複習），從圖書館大廳下樓。把學過的全部用出來吧！"],
  jh: ["禁書庫的封印……變成一頁一頁發光的書頁了！", "墨水大王縮得好小好小，小聲地說：「原來……真的有人會把我算完。」", "學院所有的顏色都回來了！謝謝你，見習魔數師。之後也要繼續來學院練習喔！"],
};

export function areaScene(game, { grade = "g1" } = {}) {
  const s = game.save, G = GRADES[grade];
  const star = (k) => s.stars[`${grade}-${k}`] ?? 0;
  const cleared = [1, 2, 3].map(star);
  // 地下禁書庫（最後一區）：其他四區的墨水大王都淨化了，真身才會出來（世界觀：清完五區才看得到結局）
  const othersLeft = grade === "jh" ? ["g1", "g2", "g34", "g56"].filter((g) => !(s.stars[`${g}-boss`] > 0)) : [];
  const gateOpen = cleared.every((v) => v > 0) && othersLeft.length === 0, bossDone = star("boss") > 0;
  const restoring = s.flags?.restore === grade;
  const area = HD[grade];

  const bg = el("div.bghd.areabg");
  if (area) {
    bg.append(el("img.b", { src: A(`battle-hd/${area}/back.jpg`), alt: "" }));
    bg.append(el("div.art"));                      // 遠景上的一層霧（樣式在 .bghd .art::before）
    bg.append(el("img.m", { src: A(`battle-hd/${area}/mid.png`), alt: "" }));
    bg.append(el("div.g", { style: { backgroundImage: `url(${A(`battle-hd/${area}/ground.png`)})` } }));
    bg.append(el("div.gf", { style: { backgroundImage: `url(${A(`battle-hd/${area}/ground.png`)})` } }));
  } else bg.style.background = `linear-gradient(${G.sky[0]}, ${G.sky[1]} 60%, ${G.ground} 61%, ${G.deep})`;
  const tint = el("div.tint"); bg.append(tint);
  const stage = el("div.areastage");
  const back = BACK[grade] ?? { name: "回學院", go: ["map", { from: { clock: "clock", garden: "garden", greenhouse: "greenhouse" }[area] ?? null }] };
  const title = el("div.areatitle", {}, el("span", {}, G.area), el("span.agrade", {}, G.name), bossDone ? el("span.clear", {}, "已恢復色彩") : null);
  const root = el("div.screen.areascr", {}, bg, stage, title,
    el("button.btn.small.areaback", { onclick: () => { stop(); s.returnTo = null; writeSave(s); game.go(...back.go); } }, back.name));
  show(root);
  const ink = !bossDone && !restoring;
  setGray(ink ? 1 : 0);

  // 角色（像素，放大）
  const sprites = [];
  const sprite = (fn, x, opts = {}) => {
    const f0 = fn(0), cv = el("canvas.areasp", { width: f0.w, height: f0.h });
    const n = el(opts.onTap ? "button.areaunit" : "div.areaunit", {}, cv, opts.tag ? el("span.areatag", {}, opts.tag) : null);
    if (opts.onTap) n.addEventListener("click", opts.onTap);
    if (opts.locked) n.classList.add("locked");
    stage.append(n);
    sprites.push({ fn, cv, f0, x, n });
  };
  sprite((t) => heroFrame(s.look ?? "girl", "idle", t, ATTRS[s.attr]?.color ?? "#8a7cff"), PX);
  const kinds = KINDS[grade] ?? ["ink", "ink", "ink"];
  [0, 1, 2].forEach((i) => {
    if (cleared[i]) { const d = el("div.areaunit.done", {}, el("span.areatag", {}, "★".repeat(cleared[i]) + "☆".repeat(3 - cleared[i]))); d.dataset.x = MX[i]; stage.append(d); return; }
    const open = i === 0 || cleared[i - 1] > 0;
    sprite((t) => FRAMES[kinds[i]]("idle", t + i * 0.37), MX[i], { tag: open ? `第 ${i + 1} 關` : "🔒", locked: !open, onTap: open ? () => fight("stage", i) : () => say([{ who: "page", name: "頁頁", text: `先淨化前面那一群墨水怪（第 ${i} 關）吧！` }]) });
  });
  if (!gateOpen) {
    const gate = el("button.areaunit.gate", {}, el("img", { src: A("hub/p/ink-18.png"), alt: "墨水封印門" }));
    gate.addEventListener("click", () => say([{ who: "page", name: "頁頁", text: cleared.some((v) => !v)
      ? `墨水把門封住了……裡面有好濃的墨水味，是墨水大王！還有 ${cleared.filter((v) => !v).length} 群墨水怪，先把它們淨化，封印就會變弱。`
      : `封印裡面是墨水大王的真身……可是封印還連著其他區域的墨水。先去淨化${othersLeft.map((g) => GRADES[g].area).join("、")}的墨水大王！` }]));
    gate.dataset.x = BX; stage.append(gate);
  } else if (!bossDone) {
    sprite((t) => (FRAMES[BOSS[grade]] ?? inkKingBabyFrame)("idle", t), BX, { tag: "墨水大王", onTap: () => fight("boss") });
  } else {
    const done = el("div.areaunit.done", {}, el("span.areatag", {}, `王 ${"★".repeat(star("boss"))}${"☆".repeat(3 - star("boss"))}`));
    done.dataset.x = BX; stage.append(done);
    sprite((t) => (FRAMES[BOSS[grade]] ?? inkKingBabyFrame)("idle", t), BX, { tag: `再挑戰王`, onTap: () => fight("boss") });
    sprites.at(-1).n.classList.add("again");
  }

  // 版面：跟戰鬥畫面同一套格子（高 216），寬度置中
  function layout() {
    const h = root.clientHeight, w = root.clientWidth, u = h / 216, ox = (w - 384 * u) / 2;
    const mid = bg.querySelector(".m"), gr = bg.querySelector(".g"), gf = bg.querySelector(".gf");
    if (mid?.naturalWidth) {
      const mw = (mid.naturalWidth / 3) * u, mh = (mid.naturalHeight / 3) * u;
      Object.assign(mid.style, { width: `${mw}px`, height: `${mh}px`, left: `${(w - mw) / 2}px`, top: `${138 * u - mh}px` });
    }
    const gimg = new Image(); gimg.src = gr?.style.backgroundImage.slice(5, -2) ?? "";
    if (gr && gimg.naturalWidth) {
      const gw = (gimg.naturalWidth / 3) * u, gh = (gimg.naturalHeight / 3) * u;
      Object.assign(gr.style, { top: `${132 * u}px`, height: `${gh}px`, backgroundSize: `${gw}px ${gh}px`, backgroundPosition: `${(w - gw) / 2}px 0` });
      Object.assign(gf.style, { top: `${132 * u + gh}px`, backgroundSize: `${gw}px ${gh}px`, backgroundPosition: `${(w - gw) / 2}px ${-gh * 0.6}px` });
    }
    for (const sp of sprites) {
      const sc = u * (sp.f0.w > 80 ? 1.25 : 1.5);   // 跟戰鬥一樣：人物 1.5 倍、王 1.25 倍
      Object.assign(sp.cv.style, { width: `${sp.f0.w * sc}px`, height: `${sp.f0.h * sc}px` });
      Object.assign(sp.n.style, { left: `${ox + sp.x * u - sp.f0.ox * sc}px`, top: `${GROUND * u - sp.f0.oy * sc}px` });
    }
    stage.querySelectorAll(".areaunit.done, .areaunit.gate").forEach((n) => {
      const x = Number(n.dataset.x);
      if (n.classList.contains("gate")) { const gh = 70 * u, im = n.querySelector("img"); im.style.height = `${gh}px`; Object.assign(n.style, { left: `${ox + x * u - gh * 0.55}px`, top: `${GROUND * u - gh + 4 * u}px` }); }
      else Object.assign(n.style, { left: `${ox + x * u - 30}px`, top: `${(GROUND - 30) * u}px` });
    });
  }
  root.querySelectorAll("img").forEach((im) => { if (!im.complete) im.addEventListener("load", layout, { once: true }); });
  const gpre = new Image(); if (area) { gpre.onload = layout; gpre.src = A(`battle-hd/${area}/ground.png`); }
  layout();
  const ro = new ResizeObserver(layout); ro.observe(root);

  let running = true, t = 0, last = performance.now(), acc = 0;
  const draw = (sp) => { const f = sp.fn(t), c = sp.cv.getContext("2d"); c.clearRect(0, 0, sp.cv.width, sp.cv.height); c.putImageData(new ImageData(new Uint8ClampedArray(f.px.buffer.slice(0)), f.w, f.h), 0, 0); };
  sprites.forEach(draw);
  function frame(now) {
    if (!running || !root.isConnected) { stop(); return; }
    const dt = Math.min(0.1, (now - last) / 1000); last = now; t += dt; acc += dt;
    if (acc > 1 / 10) { acc = 0; sprites.forEach(draw); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  function stop() { running = false; ro.disconnect(); }

  function setGray(g) {
    bg.style.filter = g > 0.004 ? `grayscale(${0.85 * g}) brightness(${1 - 0.22 * g})` : "";
    tint.style.opacity = g;
  }
  let busy = false;
  async function say(lines, choices) { if (busy) return null; busy = true; try { return await talk(root, lines, choices); } finally { busy = false; } }
  function fight(mode, i = 0) {
    if (busy) return;
    sfx("tick"); stop();
    s.returnTo = { scene: "area", grade }; writeSave(s);
    game.go("battle", mode === "boss" ? { grade, mode: "boss" } : { grade, mode: "stage", stage: i });
  }
  // 剛打倒王：墨水灰慢慢退掉（CSS 漸變），頁頁說話
  if (restoring) {
    s.flags = { ...s.flags, restore: null }; writeSave(s);
    setGray(1);
    // 恢復色彩的演出：王（被打歪的樣子）在原地一抖一抖、縮小、往上飛走 → 到處冒出金色光點往上飄 → 顏色慢慢回來 → 頁頁說話
    const kingSp = sprites.find((sp) => sp.x === BX);
    if (kingSp) kingSp.n.style.display = "none";
    const ghost = el("canvas.areasp.restoreking");
    const kf = (FRAMES[BOSS[grade]] ?? inkKingBabyFrame)("hurt", 0.3);
    ghost.width = kf.w; ghost.height = kf.h;
    ghost.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(kf.px.buffer.slice(0)), kf.w, kf.h), 0, 0);
    const h = root.clientHeight, u = h / 216, ox = (root.clientWidth - 384 * u) / 2, sc = u * 1.25;
    Object.assign(ghost.style, { position: "absolute", left: `${ox + BX * u - kf.ox * sc}px`, top: `${144 * u - kf.oy * sc}px`, width: `${kf.w * sc}px`, height: `${kf.h * sc}px`, zIndex: 3, transformOrigin: "50% 100%" });
    stage.append(ghost);
    sfx("boss");
    ghost.animate([{ transform: "translateX(0)" }, { transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "translateX(0)" }], { duration: 180, iterations: 4 });
    setTimeout(() => {
      sfx("whoosh");
      ghost.animate([{ transform: "scale(1)", opacity: 1 }, { transform: `translateY(-${60 * u}px) scale(0.5)`, opacity: 0.9 }, { transform: `translate(${80 * u}px, -${200 * u}px) scale(0.1)`, opacity: 0 }], { duration: 1400, easing: "ease-in", fill: "forwards" });
    }, 800);
    // 金色光點從地上冒出來往上飄
    setTimeout(() => {
      for (let i = 0; i < 40; i++) {
        const d = el("div.restorespark"), x = Math.random() * root.clientWidth, y = (110 + Math.random() * 40) * u;
        Object.assign(d.style, { left: `${x}px`, top: `${y}px` });
        root.append(d);
        d.animate([{ transform: "translateY(0) scale(1)", opacity: 0 }, { opacity: 1, offset: 0.2 }, { transform: `translateY(-${(60 + Math.random() * 80) * u}px) scale(.6)`, opacity: 0 }], { duration: 1600 + Math.random() * 1400, delay: Math.random() * 1200, fill: "forwards" }).onfinish = () => d.remove();
      }
      bg.style.transition = "filter 2.6s ease"; tint.style.transition = "opacity 2.6s ease"; setGray(0); sfx("restore");
    }, 1900);
    setTimeout(() => { if (kingSp && bossDone) kingSp.n.style.display = ""; say((RESTORE[grade] ?? []).map((text) => ({ who: "page", name: "頁頁", text }))); }, 4800);
  } else if (!cleared[0] && !s.flags?.[`areaHint_${grade}`]) {
    s.flags = { ...(s.flags ?? {}), [`areaHint_${grade}`]: true }; writeSave(s);
    say([{ who: "page", name: "頁頁", text: `這裡就是${G.area}……顏色都被墨水吸走了。點墨水怪就可以開始淨化！一群一群來，最後是封印門後面的墨水大王。` }]);
  }
}
