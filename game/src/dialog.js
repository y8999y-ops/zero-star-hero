// 對話框（城鎮用）：畫面下方的面板，左邊大頭像、名字牌掛在框上、一個字一個字打出來、選項在右邊。
// 用法：await talk("波波", ["第一句", "第二句"]);  const v = await ask("波波", "要做什麼？", [["接任務", "quest"], ["離開", null]]);
// 點一下、J、空白鍵、Enter：還在打字＝直接顯示整句，打完了＝下一句；選項可以點，或按 1～9。
// 「系統」說話時對話框換成青藍色、沒有頭像。
import { npcFrame } from "./npcs.js";

const box = document.getElementById("dlg"), nameEl = document.getElementById("dlgName"), textEl = document.getElementById("dlgText"), optEl = document.getElementById("dlgOpts");
const faceCv = document.getElementById("dlgFaceCv");
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

// ---- 打字音：很短的嗶聲（第一次有聲音前要先有使用者操作，開始畫面那一下就夠了）
let ac = null;
export function blip(freq, type = "square") {
  try {
    ac ??= new (window.AudioContext || window.webkitAudioContext)();
    const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq * (0.96 + Math.random() * 0.08), t);
    g.gain.setValueAtTime(0.035, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g).connect(ac.destination);
    o.start(t);
    o.stop(t + 0.06);
  } catch {}
}

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

// ---- 頭像：居民的待機 8 格照順序播（眨眼、反光、晃動都會動），放大後把下半身切掉一點
let faceTimer = 0;
function setFace(id) {
  clearInterval(faceTimer);
  box.classList.toggle("noface", !id);
  if (!id) return;
  const g = faceCv.getContext("2d");
  let f = 0;
  const draw = () => {
    const s = npcFrame(id, f);
    const Hv = Math.round(s.H * 0.8), S = Math.max(s.W, Hv) + 2;   // 只看上面 8 成（臉），正方形畫布置中
    faceCv.width = S; faceCv.height = S;
    const im = g.createImageData(S, S), px = new Uint32Array(im.data.buffer);
    const ox = (S - s.W) >> 1, oy = Math.round((S - Hv) / 2);
    for (let y = 0; y < s.H; y++) for (let x = 0; x < s.W; x++) {
      const c = s.px[y][x], py = y + oy;
      if (c && py >= 0 && py < S) px[py * S + x + ox] = c;
    }
    g.putImageData(im, 0, 0);
    f = (f + 1) % 8;
  };
  draw();
  faceTimer = setInterval(draw, 150);
}

let typing = null;
function show(name, text) {
  const [, face, freq, wave] = speaker(name);
  if (!dialog.open) { box.classList.remove("pop"); void box.offsetWidth; box.classList.add("pop"); }
  dialog.open = true;
  document.body.classList.add("talking");
  box.classList.remove("hidden");
  box.classList.toggle("sys", /系統/.test(name));
  nameEl.textContent = name;
  optEl.innerHTML = "";
  setFace(face);
  box.classList.add("typing");
  typing = typewriter(textEl, text, freq, wave);
  typing.done.then(() => box.classList.remove("typing"));
}
function hide() {
  dialog.open = false;
  document.body.classList.remove("talking");
  box.classList.add("hidden");
  box.classList.remove("more", "typing");
  clearInterval(faceTimer);
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
    b.addEventListener("click", (e) => { e.stopPropagation(); choosePick(i); });
    optEl.appendChild(b);
  });
  return new Promise((r) => (pick = r));
}

box.addEventListener("pointerdown", (e) => { if (!e.target.closest("button")) next(); });
addEventListener("keydown", (e) => {
  if (!dialog.open) return;
  if (pick && /^Digit[1-9]$/.test(e.code)) { choosePick(+e.code.slice(5) - 1); e.preventDefault(); return; }
  if (["Space", "KeyJ", "Enter", "KeyX", "KeyZ"].includes(e.code)) { next(); e.preventDefault(); }
}, true);
