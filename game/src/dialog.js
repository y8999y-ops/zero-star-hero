// 對話框（城鎮用）：畫面下方的半透明面板，像日系遊戲一樣左右站著說話者的立繪（2026-11-05 改版）：
//   左邊是主角（星星，跟著目前形態），右邊是說話的居民；正在說話的那邊亮、另一邊變暗；
//   換人說話時亮的那邊跳一下，打字時輕輕上下晃，打開對話時兩邊從畫面外滑進來。名字牌掛在說話者那一側。
//   「系統」說話時：系統是主角腦中的聲音，所以左邊主角亮起來、對話框換成青藍色。
// 用法：await talk("波波", ["第一句", "第二句"]);  const v = await ask("波波", "要做什麼？", [["接任務", "quest"], ["離開", null]]);
// 點一下、J、空白鍵、Enter：還在打字＝直接顯示整句，打完了＝下一句；選項可以點，或按 1～9。
// 「系統」說話時對話框換成青藍色、沒有頭像。
import { npcFrame } from "./npcs.js";
import { releaseTouch } from "./input.js";
import { playFace, moodOf, FACE_SIZE } from "./system-face.js";
import { starPixels, POSES } from "./star.js";

const box = document.getElementById("dlg"), nameEl = document.getElementById("dlgName"), textEl = document.getElementById("dlgText"), optEl = document.getElementById("dlgOpts");
const porL = document.getElementById("dlgL"), porR = document.getElementById("dlgR"), sysPor = document.getElementById("dlgSys");
let stopSys = null;
// 系統說話時：水晶飄在主角的右上方（主角腦中的聲音），表情照台詞換
function showSys(text) {
  stopSys?.();
  stopSys = playFace(sysPor, moodOf(text));
  const k = Math.max(2, Math.floor((innerHeight * 0.22) / FACE_SIZE)), r = porL.getBoundingClientRect(), st = box.offsetParent.getBoundingClientRect();
  sysPor.style.width = sysPor.style.height = FACE_SIZE * k + "px";
  sysPor.style.left = r.left - st.left + r.width * 0.55 + "px";
  sysPor.style.bottom = st.bottom - r.top - FACE_SIZE * k * 0.35 + "px";
  if (sysPor.classList.contains("hidden")) { sysPor.classList.remove("hidden", "in"); void sysPor.offsetWidth; sysPor.classList.add("in"); }
}
function hideSys() { stopSys?.(); stopSys = null; sysPor.classList.add("hidden"); }
export const dialog = { open: false };
let advance = null, pick = null, values = [];

// 名字 → 頭像用哪個居民、打字音高（波波「啵」高音、岩叔「咚」低音、菇媽「噗」中音）
const SPEAKERS = [
  [/波波/, "clerk", 880, "square"],
  [/岩叔/, "golem", 196, "square"],
  [/菇媽/, "mushroom", 523, "triangle"],
  [/系統/, null, 1320, "sine"],
  [/啵啵/, "kid", 1046, "square"],
  [/慢慢/, "turtle", 147, "triangle"],
  [/碎碎/, "pebble", 330, "square"],
  [/菇菇寶寶/, "shroom", 784, "triangle"],
];
const speaker = (name) => SPEAKERS.find(([re]) => re.test(name)) ?? [null, null, 660, "square"];

// ---- 打字音：走 audio.js（跟著音效音量）
import { blip } from "./audio.js";
export { blip };

/** 一個字一個字把 text 打進 el。遇到「…」「，」「。」停久一點（系統吐槽的節奏靠這個）。回傳 { done, skip() } */
export function typewriter(el, text, freq, wave) {
  let i = 0, timer = 0, finish;
  const done = new Promise((r) => (finish = r));
  const end = () => { clearTimeout(timer); el.textContent = text; finish(); };
  const step = () => {
    if (i >= text.length) return end();
    const ch = text[i++];
    el.textContent = text.slice(0, i);
    if (i % 2 === 1 && !/[\s…，。！？、「」（）]/.test(ch)) blip(freq, wave);
    timer = setTimeout(step, ch === "…" ? 110 : /[，。！？]/.test(ch) ? 160 : 32);
  };
  step();
  return { done, skip: end };
}

// ---- 立繪：居民＝待機 8 格照順序播；主角＝星星的待機 8 格（目前形態）。整數倍放大（像素一樣大），高度約螢幕的 4 成
let faceTimer = 0, faceId = null, frameN = 0;
function paintPortrait(el, s) {
  const cv = el.firstElementChild, g = cv.getContext("2d");
  if (cv.width !== s.W || cv.height !== s.H) { cv.width = s.W; cv.height = s.H; }
  const im = g.createImageData(s.W, s.H), px = new Uint32Array(im.data.buffer);
  for (let y = 0; y < s.H; y++) for (let x = 0; x < s.W; x++) { const c = s.px[y][x]; if (c) px[y * s.W + x] = c; }
  g.putImageData(im, 0, 0);
  const k = Math.max(2, Math.floor((innerHeight * 0.4) / s.H));
  cv.style.width = s.W * k + "px"; cv.style.height = s.H * k + "px";
}
function heroPixels(f) {
  const form = globalThis.__game?.player?.form ?? "star";
  const q = POSES.idle[f % 8], sp = starPixels(form === "star" ? q : { ...q, form });
  return { px: sp.px, W: sp.W, H: sp.H };
}
function drawPortraits() {
  paintPortrait(porL, heroPixels(frameN));
  if (faceId) paintPortrait(porR, npcFrame(faceId, frameN));
  frameN = (frameN + 1) % 8;
}
function setFace(id) {
  faceId = id;
  box.classList.add("noface");
  porR.classList.toggle("hidden", !id);
  porL.classList.remove("hidden");
  if (!faceTimer) faceTimer = setInterval(drawPortraits, 150);
  drawPortraits();
}
// 誰在說話：亮的那邊跳一下、另一邊變暗；立繪站在對話框上緣
function setActive(side) {
  const on = side === "L" ? porL : porR, off = side === "L" ? porR : porL;
  const was = on.classList.contains("on");
  on.classList.add("on"); off.classList.remove("on");
  if (!was) { on.classList.remove("hop"); void on.offsetWidth; on.classList.add("hop"); }
  box.classList.toggle("right", side === "R");
  const top = box.getBoundingClientRect().top, stage = box.offsetParent?.getBoundingClientRect();
  const b = (stage ? stage.bottom : innerHeight) - top - 6;
  porL.style.bottom = porR.style.bottom = b + "px";
}

let typing = null;
function show(name, text) {
  clearTimeout(hideTimer);
  const [, face0, freq, wave] = speaker(name), wasOpen = dialog.open;
  const face = /系統/.test(name) && wasOpen ? faceId : face0;   // 系統插話時，居民留在原地（變暗）
  if (!dialog.open) { box.classList.remove("pop"); void box.offsetWidth; box.classList.add("pop"); }
  dialog.open = true;
  document.body.classList.add("talking");
  box.classList.remove("hidden");
  box.classList.toggle("sys", /系統/.test(name));
  nameEl.textContent = name;
  optEl.innerHTML = "";
  if (!wasOpen) releaseTouch();
  if (!wasOpen) { for (const p of [porL, porR]) { p.classList.remove("enter", "on"); void p.offsetWidth; p.classList.add("enter"); } }
  setFace(face);
  setActive(/系統/.test(name) || !face0 ? "L" : "R");
  if (/系統/.test(name)) showSys(text); else hideSys();
  box.classList.add("typing");
  typing = typewriter(textEl, text, freq, wave);
  // 打字時說話的那邊輕輕上下晃，打完停
  const act = porL.classList.contains("on") ? porL : porR;
  porL.classList.remove("talk"); porR.classList.remove("talk"); act.classList.add("talk");
  typing.done.then(() => { box.classList.remove("typing"); act.classList.remove("talk"); });
}
// 關掉對話：晚一點點才真的關（接著馬上有下一段對話時，例如居民講完換系統吐槽，就不會閃一下、立繪也不會重新滑進來）
let hideTimer = 0;
function hide() {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(hideNow, 150);
}
function hideNow() {
  dialog.open = false;
  document.body.classList.remove("talking");
  box.classList.add("hidden");
  box.classList.remove("more", "typing");
  clearInterval(faceTimer);
  faceTimer = 0;
  porL.classList.add("hidden"); porR.classList.add("hidden");
  hideSys();
}
function next() {
  if (box.classList.contains("typing")) { typing?.skip(); return; }
  if (!advance) return;
  const a = advance;
  advance = null;
  a();
}
function choosePick(i) {
  if (!pick || i < 0 || i >= values.length) return;
  typing?.skip();
  const r = pick;
  pick = null;
  hide();
  r(values[i]);
}

/** 一句一句講完，講完關掉對話框。 */
export async function talk(name, lines) {
  for (const line of lines) {
    show(name, line);
    box.classList.add("more");
    await new Promise((r) => (advance = r));
  }
  box.classList.remove("more");
  hide();
}

/** 顯示選項，回傳選到的值。options：[[文字, 值], ...] */
export function ask(name, text, options) {
  show(name, text);
  box.classList.remove("more");
  values = options.map((o) => o[1]);
  options.forEach(([label], i) => {
    const b = document.createElement("button");
    b.className = "pbtn";
    b.textContent = `${i + 1}. ${label}`;
    b.addEventListener("click", (e) => { e.stopPropagation(); if (b.classList.contains("wait")) return; blip(1200, "square"); choosePick(i); });
    b.classList.add("wait");
    optEl.appendChild(b);
  });
  // 防誤觸（手機回報：點村民、連點跳過對話時會直接點到選項）：字打完再等 0.45 秒，選項才能點
  const t = typing, ready = () => { if (typing === t) for (const b of optEl.children) b.classList.remove("wait"); };
  t.done.then(() => setTimeout(ready, 450));
  return new Promise((r) => (pick = r));
}

box.addEventListener("pointerdown", (e) => { if (!e.target.closest("button")) next(); });
addEventListener("keydown", (e) => {
  if (!dialog.open) return;
  if (pick && /^Digit[1-9]$/.test(e.code)) { if (optEl.querySelector(".wait")) { next(); e.preventDefault(); return; } choosePick(+e.code.slice(5) - 1); e.preventDefault(); return; }
  if (["KeyF", "Space", "KeyJ", "Enter", "KeyX", "KeyZ"].includes(e.code)) { next(); e.preventDefault(); }   // F＝互動鍵（使用者 2026-11-06），也能翻下一句
}, true);
