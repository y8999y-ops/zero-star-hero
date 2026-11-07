// Unity 轉移的「操作錄影」比對（網頁版這一邊，階段 3 起）：直接跑網頁版真正的 main.js（整個 1-1：關卡流程、祭壇、寶箱、場景物件、機關……），
// 不再自己抄一份 main.js 的子集。瀏覽器的東西（DOM、canvas、聲音、存檔）用假的頂替；畫面從 #screen 的 putImageData 接下來。
// 亂數換成固定種子（兩邊同一個順序取亂數）；performance.now、setTimeout 換成遊戲時間。
// 執行：[TRACE_VARIANT=A] node --no-use-std-math-pow game/tools/unity-trace-full.mjs   → unity/Golden/web/trace*.txt、trace-frames*.bin
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { decodePNG } from "./unity/node-dom.mjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(ROOT, "unity", "Golden", "web");
mkdirSync(OUT, { recursive: true });

// ---- 遊戲時間
let simMs = 0;
performance.now = () => simMs;
Date.now = () => 1767225600000 + simMs;   // 固定的日期（城鎮的日夜用；關卡裡不影響）
const timers = []; let timerSeq = 0;
globalThis.setTimeout = (fn, ms = 0) => { timers.push({ due: simMs + (+ms || 0), seq: timerSeq++, fn }); return timerSeq; };
globalThis.clearTimeout = (id) => { const i = timers.findIndex((t) => t.seq === id - 1); if (i >= 0) timers.splice(i, 1); };
globalThis.setInterval = () => 0; globalThis.clearInterval = () => {};
globalThis.requestAnimationFrame = () => 0; globalThis.cancelAnimationFrame = () => {};
function runTimers() {
  for (;;) {
    let best = -1;
    for (let i = 0; i < timers.length; i++) if (timers[i].due <= simMs && (best < 0 || timers[i].due < timers[best].due || (timers[i].due === timers[best].due && timers[i].seq < timers[best].seq))) best = i;
    if (best < 0) return;
    const [t] = timers.splice(best, 1);
    t.fn();
  }
}
// 固定種子的亂數（mulberry32，跟 Unity 的 Rnd 一樣）
let rs = 12345;
Math.random = () => { rs = (rs + 0x6d2b79f5) | 0; let t = rs; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
let rndCount = 0;
{ const r = Math.random; Math.random = () => { rndCount++; if (process.env.RND_STACK && rndCount <= +process.env.RND_STACK) console.log("亂數 #" + rndCount, new Error().stack.split("\n").slice(2, 5).map((l) => l.trim().replace(/.*\/(game|pixelfx)\//, "$1/")).join(" ← ")); return r(); }; }

// ---- 假的瀏覽器
const handlers = {};
globalThis.window = globalThis;
globalThis.addEventListener = (type, fn) => { (handlers[type] ??= []).push(fn); };
globalThis.removeEventListener = () => {};
globalThis.innerWidth = 1152; globalThis.innerHeight = 648;
globalThis.location = { search: "", pathname: "/", origin: "http://localhost", href: "http://localhost/", replace() {}, reload() {} };
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
Object.defineProperty(globalThis, "navigator", { value: { vibrate() {}, userAgent: "node", maxTouchPoints: 0 }, configurable: true });
globalThis.top = globalThis; globalThis.parent = globalThis; globalThis.postMessage = () => {};
class Store { constructor(o = {}) { this.m = new Map(Object.entries(o)); } getItem(k) { return this.m.has(k) ? this.m.get(k) : null; } setItem(k, v) { this.m.set(k, String(v)); } removeItem(k) { this.m.delete(k); } }
globalThis.ImageData = class { constructor(a, b, c) { if (typeof a === "number") { this.width = a; this.height = b; this.data = new Uint8ClampedArray(a * b * 4); } else { this.data = a; this.width = b; this.height = c ?? a.length / 4 / b; } } };
let screenImg = null;
function ctx2d(canvas) {
  return new Proxy({
    canvas,
    createImageData: (w, h) => new ImageData(typeof w === "number" ? w : w.width, h ?? w.height),
    getImageData: (x, y, w, h) => canvas._img ? { data: canvas._img.data, width: canvas._img.w, height: canvas._img.h } : new ImageData(w, h),
    putImageData: (im) => { if (canvas._id === "screen") screenImg = im; },
    drawImage: (i) => { if (i?._img) canvas._img = i._img; },
    measureText: () => ({ width: 0 }),
  }, { get: (t, k) => (k in t ? t[k] : fake()), set: (t, k, v) => ((t[k] = v), true) });
}
const FAKE = Symbol("fake");
function fake(id) {
  const store = { _id: id, [FAKE]: true };
  const cls = new Set();
  const f = function () {};
  return new Proxy(f, {
    get(t, k) {
      if (k === Symbol.toPrimitive) return (hint) => (hint === "number" ? 0 : "");
      if (k === Symbol.iterator) return function* () {};
      if (k === "then") return undefined;
      if (k in store) return store[k];
      if (k === "classList") return (store.classList = { add: (...a) => a.forEach((c) => cls.add(c)), remove: (...a) => a.forEach((c) => cls.delete(c)), toggle: (c, on) => { const v = on ?? !cls.has(c); v ? cls.add(c) : cls.delete(c); return v; }, contains: (c) => cls.has(c) });
      if (k === "getContext") return (store.getContext = () => (store._ctx ??= ctx2d(store)));
      if (k === "length" || k === "width" || k === "height" || k === "offsetWidth" || k === "offsetHeight" || k === "clientWidth" || k === "clientHeight" || k === "offsetLeft" || k === "offsetTop" || k === "scrollTop") return store[k] ?? 0;
      if (k === "querySelectorAll" || k === "getElementsByClassName" || k === "getElementsByTagName") return () => [];
      if (k === "querySelector") return () => fake();
      if (k === "closest" || k === "elementFromPoint") return () => null;
      if (k === "getBoundingClientRect") return () => ({ left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0, x: 0, y: 0 });
      if (k === "contains" || k === "hasAttribute" || k === "matches") return () => false;
      if (k === "getAttribute") return () => null;
      if (k === "dataset" || k === "style") return (store[k] = new Proxy({ setProperty() {}, removeProperty() {}, getPropertyValue: () => "" }, { get: (o, kk) => o[kk] ?? "", set: (o, kk, v) => ((o[kk] = v), true) }));
      if (k === "children" || k === "childNodes") return [];
      return (store[k] = fake());
    },
    set(t, k, v) { store[k] = v; return true; },
    apply() { return fake(); },
    construct() { return fake(); },
  });
}
// index.html 裡每個元素一開始的 class（例如 setPanel 一開始是 hidden：遊戲照這個判斷暫停）
const HTML = readFileSync(join(ROOT, "game", "index.html"), "utf8"), initCls = new Map();
for (const m of HTML.matchAll(/<[a-zA-Z]+\s([^>]*)>/g)) {
  const id = /(?:^|\s)id="([^"]+)"/.exec(m[1])?.[1], c = /(?:^|\s)class="([^"]+)"/.exec(m[1])?.[1];
  if (id && c) initCls.set(id, c.split(/\s+/));
}
const els = new Map();
const byId = (id) => { if (!els.has(id)) { const e = fake(id); els.set(id, e); for (const c of initCls.get(id) ?? []) e.classList.add(c); } return els.get(id); };
globalThis.document = new Proxy({}, {
  get(t, k) {
    if (k === "getElementById") return byId;
    if (k === "createElement") return (tag) => fake();
    if (k === "body" || k === "documentElement" || k === "head") return byId("__" + k);
    if (k === "fullscreenElement" || k === "pointerLockElement") return null;
    if (k === "addEventListener") return () => {};
    if (k === "querySelectorAll") return () => [];
    if (k === "querySelector") return () => fake();
    if (k === "elementFromPoint") return () => null;
    if (k === "visibilityState") return "visible";
    if (k === "hidden") return false;
    return byId("__doc_" + String(k));
  },
});
// PNG（level.js 的美術圖）：Image 從檔案讀
globalThis.Image = class {
  set src(u) {
    this._src = u;
    queueMicrotask(() => {
      try { const img = decodePNG(readFileSync(fileURLToPath(u))); this.naturalWidth = this.width = img.w; this.naturalHeight = this.height = img.h; this._img = img; this.onload?.(); }
      catch (e) { this.onerror?.(e); }
    });
  }
  get src() { return this._src; }
  decode() { return Promise.resolve(); }
};
globalThis.AudioContext = function () { return fake(); };
globalThis.fetch = async () => ({ ok: false, json: async () => ({}), text: async () => "", arrayBuffer: async () => new ArrayBuffer(0) });

// ---- 存檔：照比對腳本的穿搭、技能樹（max＝每個形態每個節點點滿）、帶著的形態
const SCRIPT_FILE = process.env.TRACE_SCRIPT ?? "unity-trace-script.json", TAG = SCRIPT_FILE.replace(/^unity-trace-script/, "").replace(/.json$/, "");   // 例如 unity-trace-script-full.json → 檔名加「-full」
const SC = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), SCRIPT_FILE), "utf8"));
const SCRIPT = SC.events.slice().sort((a, b) => a[0] - b[0]), FRAME_EVERY = SC.frameEvery;
// BOT=步數：照原本的腳本跑完之後，讓機器人接著玩到通關（看狀態決定按鍵），按過的鍵記下來存成 BOT_OUT（兩邊之後都照這份重播）
const BOT = +(process.env.BOT ?? 0), TICKS = SC.ticks + BOT;
const VARIANT = process.env.TRACE_VARIANT ?? "";
const V = VARIANT ? SC.variants[VARIANT] : SC.starter ?? null;
const IT = await import("../src/items.js");
const { TREES } = await import("../src/skilltree.js");
function specItem(sp) {
  const kind = sp.base ? IT.BASES[sp.base].kind : sp.unique ? IT.UNIQUES[sp.unique].kind : IT.MYTHS[sp.myth].kind;
  const it = { uid: "x", kind, rarity: sp.rarity, ilvl: sp.ilvl, plus: sp.plus ?? 0, main: { id: sp.main[0], v: sp.main[1] }, affixes: (sp.affixes ?? []).map(([id, tier, v]) => ({ id, tier, v })), name: sp.name ?? "x", icon: "x" };
  if (sp.base) it.base = sp.base;
  if (sp.unique) it.unique = sp.unique;
  if (sp.myth) { it.myth = sp.myth; it.awaken = { kills: sp.kills ?? 0 }; }
  if (sp.set) it.set = sp.set;
  return it;
}
const equip = { weapon: null, head: null, body: null, hands: null, feet: null, acc1: null, acc2: null };
if (V) for (const [slot, sp] of Object.entries(V.equip)) equip[slot] = specItem(sp);
const owned = {};
for (const f of Object.keys(TREES)) owned[f] = { pts: 0, cores: 0, tree: SC.tree === "max" ? Object.fromEntries(TREES[f].map((n) => [n.id, n.max])) : {} };
if (!owned.star) owned.star = { pts: 0, tree: {} };
const profile = {
  ver: 3, lv: V?.lv ?? 1, xp: 0, coins: 0, scrap: 0, inv: [], equip, auto: 0, clears: 0,
  forms: { owned, carry: SC.carry ?? ["star", "slime", "bat"], cur: "star" },
  guild: { registered: false, done: 0, quest: null }, meal: null,
  seenIntro: true, tipUse: SC.tipUse ?? 0, cleared: {}, taught: {},
};
// 哪一關（腳本的 stage，沒寫＝1-1）；前面的關卡算打過了（正常玩到這一關的存檔）
const STAGE = SC.stage ?? "1-1", ORDER = ["1-1", "1-2", "1-3", "1-4"];
for (const id of ORDER.slice(0, ORDER.indexOf(STAGE))) profile.cleared[id] = true;
globalThis.localStorage = new Store({ "zero-hero-save-v1": JSON.stringify(profile) });
// 碎星鎮（stage: "town"）：前面的關卡算打過了照 SC.cleared；SC.profile 可以再蓋存檔的欄位（例如公會登記、引導進度）
if (STAGE === "town") for (const id of SC.cleared ?? []) profile.cleared[id] = true;
if (SC.profile) Object.assign(profile, SC.profile);
localStorage.setItem("zero-hero-save-v1", JSON.stringify(profile));
globalThis.sessionStorage = new Store({ "zero-hero-next": STAGE === "town" ? "town" : "stage", "zero-hero-stage": STAGE === "town" ? "1-1" : STAGE, "zero-hero-auto": "1" });

// ---- 載入網頁版（載入時取的亂數也算在同一串裡）
await import("../src/main.js");
const G = window.__game;
// 城鎮的白天晚上、天氣：腳本可以固定（day＝0～1、weather＝"clear"／"cloudy"／"rain"），兩邊載入完才設
if (SC.day != null) G.day(SC.day);
if (SC.weather != null) G.weather(SC.weather);
console.log("載入完成；載入時用掉的亂數：", rndCount, "director", !!G.director, "setPanel", byId("setPanel").classList.contains("hidden"));
const { POSES } = await import("../src/star.js");
const { juice } = await import("../src/fx.js");
const { ult } = await import("../src/ult.js");
const poseName = new Map();
for (const [k, v] of Object.entries(POSES)) { if (Array.isArray(v)) v.forEach((q, i) => poseName.set(q, `${k}#${i}`)); else poseName.set(v, k); }
const ev = (type, code) => { for (const fn of handlers[type] ?? []) fn({ code, key: code, repeat: false, preventDefault() {}, stopPropagation() {}, target: null }); };
const f = (v) => String(v);
const lines = [], frames = [];
let si = 0;
const held = new Set(), botEv = [], later = [];
let stuckN = 0, lastX = 0, jumps = 0, leg = 0, legWait = 0, lastForced = -999, coastAt = -1, gliding = false;
// 路線（腳本的 route，只給機器人用）：依序走到每個 x（有寫 y 就要到那個高度附近），jumps＝經過 [x, y] 時二段跳
const ROUTE = SC.route ?? [];
function botTick(n) {
  const out = [], p = G.player, E = G.enemies.filter((e) => !e.dead);
  const hold = (code, on) => { if (on !== held.has(code)) { out.push([n, on ? "d" : "u", code]); on ? held.add(code) : held.delete(code); } };
  const tap = (code, len = 3) => { if (held.has(code)) return; out.push([n, "d", code]); held.add(code); later.push([n + len, "u", code]); };
  for (let i = later.length - 1; i >= 0; i--) if (later[i][0] === n) {
    const [, t, c] = later.splice(i, 1)[0];
    if (t === "u" && held.has(c)) { out.push([n, "u", c]); held.delete(c); }
    if (t === "d2") { if (held.has(c)) { out.push([n, "u", c]); held.delete(c); } out.push([n, "d", c]); held.add(c); later.push([n + 16, "u", c]); }
  }
  const P = G.portal;
  if (P.leaving) { for (const c of [...held]) hold(c, false); return out; }
  const near = E.filter((e) => Math.abs(e.y - p.y) < 50 && Math.abs(e.x - p.x) < 70 && e.kind !== "gold");
  const ahead = near.filter((e) => e.x - p.x > -24);
  // 互動：祭壇、寶箱、傳送門（站在旁邊按 F）
  const altar = G.altars.find((a) => !a.lit && Math.abs(a.x - p.x) < 10 && Math.abs(a.y - p.y) < 20);
  const ch = G.chest, chestOk = ch && !ch.opened && Math.abs(ch.x - p.x) < 12 && Math.abs(ch.y - p.y) < 16 && !E.some((e) => e.kind !== "gold" && Math.abs(e.x - ch.x) < 160 && Math.abs(e.y - ch.y) < 80);
  const portalOk = P.stageDone && Math.abs(P.x - p.x) < 8 && Math.abs(P.y - p.y) < 16;
  const feat = (G.features?.usable?.() ?? []).length > 0;
  if ((altar || chestOk || portalOk || feat) && p.grounded) { hold("KeyD", false); hold("KeyA", false); hold("KeyJ", false); if (n % 8 === 0) tap("KeyF"); return out; }
  // 往右走；祭壇、寶箱、傳送門在前面就走到它旁邊停下
  let target = 1e9;
  const R = ROUTE[leg];
  if (R && Math.abs(p.x - R.x) < 8 && (R.y == null || (Math.abs(p.y - R.y) < 16 && (p.grounded || R.air)))) leg++;
  else if (R && Math.abs(p.x - R.x) < 8 && ++legWait > (R.glide ? 900 : 120)) { leg++; legWait = 0; }   // 到了那個 x 卻不在那個高度（掉下去了）：放棄這一段
  const BK = ROUTE[leg]?.back;   // back＝[x0, x1, y]：在 x0～x1 之間掉到 y 以下＝這一段失敗了，回上一段重來
  if (BK && p.x > BK[0] && p.x < BK[1] && p.y >= BK[2] && p.grounded) leg--;
  if (ROUTE[leg]) target = ROUTE[leg].x;
  else if (ch && !ch.opened && (ch.x > p.x - 8 || SC.stage === "1-4") && Math.abs(ch.y - p.y) < 40) target = ch.x;   // 1-4：王掉的星箱可能在背後
  else if (P.stageDone) target = P.x;
  for (const [jx, jy, run] of ROUTE[leg]?.jumps ?? []) if (p.grounded && Math.abs(p.x - jx) < 10 && Math.abs(p.y - jy) < 3 && n - lastForced > 60) { lastForced = n; coastAt = run != null ? n + run : -1; tap("Space", 14); later.push([n + 16, "d2", "Space"]); }
  if (coastAt >= 0 && n >= coastAt) { if (p.grounded && n > coastAt + 4) coastAt = -1; else target = p.x; }   // 二段跳只往前按 run 步，之後放開，落在平台上
  const goal = G.altars.find((a) => !a.lit && a.x > p.x - 8 && a.x < p.x + 60 && Math.abs(a.y - p.y) < 40);
  if (goal) target = Math.min(target, goal.x);
  hold("KeyA", target < p.x - 3);
  hold("KeyD", target > p.x + 3 && !(ahead.length && Math.abs(ahead[0].x - p.x) < 26));
  const vein = (G.features?.items ?? []).some((f) => f.t === "vein" && !f.done && Math.abs(f.x - p.x) < 18 && Math.abs(f.y - p.y) < 20);
  hold("KeyJ", near.length > 0 || vein);
  if (ahead.length >= 3 && p.mp >= 25 && n % 30 === 0) tap("KeyE");
  if ((near.length >= 2 || near.some((e) => e.isBoss)) && p.mp >= 100 && n % 45 === 0) tap("KeyQ");
  if (!ROUTE[leg]?.nodash && E.some((e) => e.mode === "swoop" && Math.abs(e.x - p.x) < 60 && Math.abs(e.y - p.y) < 50) && n % 20 === 0) tap("KeyK");
  // 機關：裂牆（換鐵罐星衝撞）、封印（換星星射星屑彈）；魔力不夠就補滿（m）
  const FI = G.features?.items ?? [];
  const crack = FI.find((f) => f.t === "crack" && !f.done && f.x - p.x > 0 && f.x - p.x < 44 && Math.abs(f.y - p.y) < 30);
  const seal = FI.find((f) => f.t === "seal" && !f.done && !(f.lit > 0) && f.x - p.x > 0 && f.x - p.x < 120 && p.y > f.y - (f.h ?? 48) - 10 && p.y <= f.y + 30);
  const want = crack ? "can" : seal ? "star" : null;
  if (want && !near.length) {
    hold("KeyJ", false);
    if (p.form !== want) { if (n % 20 === 0) out.push([n, "f", want]); }
    else if (p.mp < 25) { if (n % 20 === 0) out.push([n, "m", ""]); }
    else if (p.grounded && n % 40 === 0) tap("KeyE");
    return out;
  }
  // 路段指定的形態（黏液菇要黏液星、氣流要蝠翼星）；沒指定就換回星星
  const RL = ROUTE[leg], close = RL && Math.abs(p.x - RL.x) < (RL.near ?? 120);   // 接近那一段的目標才換形態、才滑翔
  const legForm = (close && RL.form) || "star";
  if (p.form !== legForm && !near.length && n % 20 === 0) out.push([n, "f", legForm]);
  // 滑翔路段：在空中一直按住跳；站在氣流裡就先跳起來
  if (close && RL.glide) { if (!p.grounded) hold("Space", true); else if (held.has("Space")) hold("Space", false); else if (n % 20 === 0) tap("Space"); return out; }
  else if (gliding && held.has("Space")) hold("Space", false);
  gliding = !!(close && RL.glide);
  // 卡住：先跳、空中再跳；跳不過去就往下穿平台
  if ((held.has("KeyD") || held.has("KeyA")) && !near.length && Math.abs(p.x - lastX) < 0.3) stuckN++; else stuckN = 0;
  lastX = p.x;
  if (stuckN > 12 && p.grounded) {
    stuckN = 0; jumps++;
    if (jumps % 2 === 0) { hold("Space", false); hold("KeyS", true); tap("Space"); later.push([n + 8, "u", "KeyS"]); }
    else { tap("Space", 14); later.push([n + 16, "d2", "Space"]); }
  }
  return out;
}
for (let n = 0; n < TICKS; n++) {
  if (BOT && n === SC.ticks) for (const e of SCRIPT) if (e[1] === "d") held.add(e[2]); else if (e[1] === "u") held.delete(e[2]);
  if (BOT && n >= SC.ticks) { const evs = botTick(n); SCRIPT.splice(si, 0, ...evs); botEv.push(...evs); }
  while (si < SCRIPT.length && SCRIPT[si][0] === n) {
    const [, type, code] = SCRIPT[si++];
    const p = G.player;
    if (type === "f") G.switchForm(code);
    else if (type === "m") p.mp = p.maxMp;
    else if (type === "h") p.hp = +code;   // 測試用：把血設成這個數（測王戰中死掉）
    else if (type === "x") G.gainXp(+code);
    else if (type === "i") G.dropItem(p.x + 40 * p.face, p.y - 12, +code);
    else ev(type === "d" ? "keydown" : "keyup", code);
  }
  runTimers();
  const img = G.step();
  simMs += 1000 / 60;
  const p = G.player, E = G.enemies;
  const row = [n, p.x, p.y, p.vx, p.vy, p.state, p.hp, p.face, p.grounded ? 1 : 0, poseName.get(p.pose) ?? "?", G.camX, G.camY, juice.freeze, juice.shakeT, p.form, p.mp, G.stats.combo, ult.on ? "U" + ult.t : "-", (G.director?.next ?? -1) + (G.portal.stageDone ? "d" : "") + (G.portal.leaving ? "l" : ""), E.length];   // 關卡事件（d＝通關、l＝進傳送門）
  for (const e of E) { const S = e.st ?? {}; row.push(e.kind[0] + (e.elite ? "E" : ""), e.x, e.y, e.vx, e.vy, e.hp, e.awake ? 1 : 0, ["burn", "slime", "shock", "poison", "stuck"].map((k) => (S[k] > 0 ? k[0] : "")).join("") || "-"); }
  lines.push(row.map(f).join(" "));
  if (n % FRAME_EVERY === 0) frames.push(Buffer.from(img.buffer.slice(0)));
}
const SUF = TAG + (VARIANT ? "-" + VARIANT : "");
writeFileSync(join(OUT, `trace${SUF}.txt`), lines.join("\n") + "\n");
writeFileSync(join(OUT, `trace-frames${SUF}.bin`), Buffer.concat(frames));
if (BOT && process.env.BOT_OUT) { writeFileSync(join(dirname(fileURLToPath(import.meta.url)), process.env.BOT_OUT), JSON.stringify({ ...SC, note: SC.note + "（後半段是機器人玩到通關時按的鍵）", ticks: TICKS, events: [...SC.events, ...botEv] }, null, 1)); console.log("存了機器人的按鍵：", process.env.BOT_OUT, botEv.length, "個"); }
console.log("機關：", (G.features?.items ?? []).map((f) => f.t + (f.done ? "✓" : "✗")).join(" ")); console.log("關卡：事件", G.director?.next, "祭壇", G.altars.map((a) => a.lit ? 1 : 0).join(""), "寶箱", G.chest ? (G.chest.opened ? "開" : "沒開") + "@" + G.chest.x + "," + G.chest.y : "無", "傳送門", JSON.stringify(G.portal), "擊殺", G.stats.kills, "死亡", G.stats.deaths);
console.log(`網頁版（完整 main.js）：${TICKS} 步、${frames.length} 張畫面 → ${OUT}`);
console.log("最後：", lines[lines.length - 1].split(" ").slice(0, 12).join(" "));
