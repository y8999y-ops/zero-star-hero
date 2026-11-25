// 學院全景（使用者 2026-11-25：改成 2D 橫版、不要大地圖、點選就好；背景、建築、小物件用 AI 原圖）。
// 一張可以左右滑的學院橫幅：天空（會比前景慢一點，有遠近感）→ 樹籬 → 建築一排 → 石板路。
// 點建築、點人、點地上的東西就觸發；原本大地圖上的事情都搬到這裡（許願、院長、導師小遊戲、同學的小問題、書頁、寶箱、墨水小點、布告欄、溫室盆栽）。
// 版面單位：畫面高 270 格（跟以前的地圖畫面一樣），1 格＝畫面高 / 270。建築和小物件是原圖平滑縮小；人物、怪物是程式畫的像素（放大、方方的）。

import { el, show } from "../ui.js";
import { sfx } from "../audio.js";
import { ATTRS, RANKS } from "../data.js";
import { rankExamReady, addExp } from "../growth.js";
import { MENTORS, mentorFrame } from "../../fx/mentor.js";
import { deanFrame } from "../../fx/dean.js";
import { heroWalkFrame } from "../../fx/hero-walk.js";
import { pageFrame } from "../../fx/pickups.js";
import { GAMES } from "./minigame.js";
import { STUDENTS, PAGES, CHESTS, QUESTS, riddleFor, daily } from "../world/island-life.js";
import { writeSave } from "../save.js";
import { talk } from "../world/talk.js";

const U = 270;                 // 畫面高幾格
const GY = 214;                // 建築站的線（石板路上緣）
const A = (n) => new URL(`../../assets/hub/${n}`, import.meta.url).href;
const BHD = (n) => new URL(`../../assets/battle-hd/garden/${n}`, import.meta.url).href;

// 建築：由左到右（浮空船碼頭上岸 → 生活區 → 廣場 → 千頁圖書館 → 五座學院 → 溫室 → 鐘塔 → 花園入口）
// x：建築中心；h：高幾格；dy：往下沉幾格（圖的底部有地基、草地）
const BUILDINGS = [
  { id: "ship", art: "dock.png", name: "浮空船碼頭", x: 150, h: 118, dy: 14 },
  { id: "b_dorm", art: "dorm.png", name: "宿舍", x: 380, h: 112, dy: 8 },
  { id: "b_shop", art: "shop.png", name: "學院商店", x: 560, h: 98, dy: 8 },
  { id: "well", art: "well.png", name: "共鳴之井", x: 790, h: 100, dy: 16 },
  { id: "library", art: "library.png", name: "千頁圖書館", x: 1080, h: 186, dy: 10 },
  { id: "b_fire", art: "fire.png", name: "赤焰塔", x: 1340, h: 136, dy: 8 },
  { id: "b_water", art: "water.png", name: "蒼流館", x: 1540, h: 110, dy: 10 },
  { id: "b_ice", art: "ice.png", name: "白霜堂", x: 1740, h: 110, dy: 10 },
  { id: "b_forest", art: "forest.png", name: "翠森苑", x: 1950, h: 118, dy: 10 },
  { id: "b_thunder", art: "thunder.png", name: "紫雷閣", x: 2150, h: 136, dy: 8 },
  { id: "b_greenhouse", art: "greenhouse.png", name: "分晶溫室", x: 2370, h: 108, dy: 10 },
  { id: "b_clock", art: "clock.png", name: "刻度鐘塔", x: 2580, h: 196, dy: 8 },
  { id: "toGarden", art: "p/rosearch.png", name: "星芽花園", x: 2780, h: 84, dy: 4 },
];
const PW = 2900;               // 橫幅全長（格）
// 小物件：每個都有理由（碼頭邊的貨、商店前的攤車、井旁的長椅、學院門口的特色……）。front＝擺在建築前面一點
const DECOR = [
  ["p/crate.png", 250, 26], ["p/barrel.png", 278, 24], ["p/lamp.png", 300, 52],
  ["p/tree.png", 470, 70], ["p/cart.png", 650, 46, 1], ["p/lamp.png", 700, 52],
  ["p/bench.png", 900, 30, 1], ["p/bed_pink.png", 690, 26, 1], ["p/tree2.png", 940, 64],
  ["p/scope.png", 1210, 40, 1], ["p/statue.png", 950, 60],
  ["p/target.png", 1440, 40, 1], ["p/flag.png", 1240, 50],
  ["p/fountain.png", 1640, 42, 1], ["p/pine.png", 1845, 74], ["p/bed_white.png", 1820, 24, 1],
  ["p/bush.png", 2050, 32, 1], ["p/chalkboard.png", 2250, 42, 1], ["p/tree.png", 2265, 70],
  ["p/can.png", 2470, 18, 1], ["p/planter.png", 2440, 28, 1],
  ["p/lamp2.png", 2690, 48], ["p/bed_yellow.png", 2840, 26, 1], ["p/hedge.png", 2860, 34],
];
// 人：院長在井旁；導師站在自己學院門口右邊；同學散在各處
const NPCS = [
  { id: "dean", name: "圓周院長", x: 700, fn: (t) => deanFrame("idle", t) },
  ...["fire", "water", "ice", "forest", "thunder"].map((k) => {
    const b = BUILDINGS.find((x) => x.id === `b_${k}`);
    return { id: `m_${k}`, mentor: k, name: MENTORS[k].name, x: b.x + 64, fn: (t) => mentorFrame(k, "idle", t) };
  }),
  ...STUDENTS.map((st, i) => ({ id: st.id, student: st, name: st.name, x: [860, 610, 300, 2300, 2500, 1180][i], fn: (t) => heroWalkFrame(st.look, "down", "idle", t, st.attr, st.hair) })),
];
// 書頁、寶箱、墨水小點藏的地方（有理由：書頁卡在樹下、長椅底下、攤車旁……）
const PAGE_AT = [470, 935, 1215, 1640, 1845, 2050, 2265, 2690, 300, 1440, 2440, 650];
const CHEST_AT = [235, 1990, 2830];
const INK_AT = [[1000, "p/ink-3.png"], [1700, "p/ink-1.png"], [2400, "p/ink-0.png"]];

let current = null;

export function hubScene(game, { from } = {}) {
  current?.stop();
  const s = game.save;
  const app = document.querySelector("#app");
  const rank = RANKS[s.rank];
  const pan = el("div.hubpan");
  const world = el("div.hubworld");
  const sky = el("div.hubsky", { style: { backgroundImage: `url(${BHD("back.jpg")})` } });
  const hedge = el("div.hubhedge", { style: { backgroundImage: `url(${BHD("mid.png")})` } });
  const road = el("div.hubroad", { style: { backgroundImage: `url(${BHD("ground.png")})` } });
  const label = el("div.hublabel", { hidden: true });
  const hud = el("div.whud", {},
    el("div.wprof", {}, el("span", {}, rank.name), el("span", {}, `Lv ${s.lv}`), el("span", { style: { color: ATTRS[s.attr]?.color } }, ATTRS[s.attr]?.name ?? ""), el("span.coins", {}, `${s.coins} 晶幣`)),
    el("button.btn.small.menuBtn", { onclick: () => menu() }, "選單"));
  world.append(hedge, road);
  pan.append(world);
  const root = el("div.screen.hubscr", {}, sky, pan, hud, label);
  show(root);

  // ── 擺東西（位置都用「格」，換成 CSS 像素在 layout()） ──
  const items = [];          // { node, x, y（底部）, h, w? }
  const put = (node, x, h, yBottom, z) => { node.style.zIndex = z; world.append(node); items.push({ node, x, h, y: yBottom }); return node; };
  const img = (src, cls = "") => el(`img${cls}`, { src: A(src), alt: "", draggable: false });
  for (const b of BUILDINGS) {
    const n = el("button.hubb", { "aria-label": b.name }, img(b.art), el("span.hubname", {}, b.name));
    n.addEventListener("click", (e) => tap(e, b));
    put(n, b.x, b.h, GY + b.dy, 10);
  }
  for (const [src, x, h, front] of DECOR) put(img(src, ".hubd"), x, h, GY + (front ? 16 : 2), front ? 30 : 5);

  // 像素人物、書頁：畫布放大（方方的像素），每秒 8 格的待機動畫
  const sprites = [];
  const sprite = (fn, x, scale, yBottom, z, onTap, name) => {
    const f0 = fn(0), cv = el("canvas.hubs", { width: f0.w, height: f0.h });
    const n = el("button.hubp", { "aria-label": name ?? "" }, cv);
    if (onTap) n.addEventListener("click", (e) => tap(e, onTap));
    const it = put(n, x, f0.h * scale, yBottom + (f0.h - f0.oy), z);
    sprites.push({ fn, cv, f0, it });
    return n;
  };
  const drawSprite = (sp, t) => {
    const f = sp.fn(t), c = sp.cv.getContext("2d");
    c.clearRect(0, 0, sp.cv.width, sp.cv.height);
    c.putImageData(new ImageData(new Uint8ClampedArray(f.px.buffer.slice(0)), f.w, f.h), 0, 0);
  };
  for (const n of NPCS) sprite(n.fn, n.x, 1.5, GY + 24, 40, { ...n, kind: "npc" }, n.name);
  s.pages ??= []; s.chests ??= [];
  PAGES.forEach((_, i) => { if (!s.pages.includes(i)) sprite((t) => pageFrame(t + i * 0.13), PAGE_AT[i % PAGE_AT.length] + (i >= PAGE_AT.length ? 30 : 0) + 22, 1.5, GY + 30, 35, { id: `page_${i}`, name: "發光的書頁" }, "發光的書頁"); });
  CHESTS.forEach((_, i) => { if (!s.chests.includes(i)) { const n = img("p/chest.png", ".hubd.hubtap"); n.addEventListener("click", (e) => tap(e, { id: `chest_${i}`, name: "數字鎖寶箱" })); put(n, CHEST_AT[i], 30, GY + 20, 35); } });
  INK_AT.forEach(([x, src], i) => { if (!daily(s).ink.includes(i)) { const n = img(src, ".hubd.hubtap"); n.addEventListener("click", (e) => tap(e, { id: `ink_${i}`, name: "墨水小點" })); put(n, x, 16, GY + 26, 34); } });
  { const n = img("p/board.png", ".hubd.hubtap"); n.addEventListener("click", (e) => tap(e, { id: "board", name: "布告欄・今日委託" })); put(n, 640, 46, GY + 4, 12); }

  // ── 版面：依畫面高算 1 格多大 ──
  let u = 1;
  function layout() {
    u = app.clientHeight / U;
    world.style.width = `${PW * u}px`;
    hedge.style.cssText += `;top:${(GY - 70) * u}px;height:${76 * u}px;background-size:auto ${76 * u}px`;
    road.style.cssText += `;top:${(GY - 6) * u}px;background-size:auto ${44 * u}px`;
    for (const it of items) {
      const n = it.node, im = n.tagName === "IMG" ? n : n.querySelector("img, canvas");
      const ratio = im.tagName === "CANVAS" ? im.width / im.height : (im.naturalWidth || 1) / (im.naturalHeight || 1);
      const h = it.h * u, w = h * ratio;
      Object.assign(n.style, { left: `${it.x * u - w / 2}px`, top: `${it.y * u - h}px`, width: `${w}px`, height: `${h}px` });
    }
    parallax();
  }
  // 天空比前景慢（遠近感）
  function parallax() { sky.style.backgroundPosition = `${-pan.scrollLeft * 0.35}px 0`; }
  pan.addEventListener("scroll", () => { parallax(); s.hub = { x: Math.round(pan.scrollLeft / u) }; }, { passive: true });
  root.querySelectorAll("img").forEach((im) => { if (!im.complete) im.addEventListener("load", layout, { once: true }); });
  layout();
  // 一開始看哪裡：從哪裡回來就看哪裡；沒有的話是上次的位置；新生是碼頭
  const focus = { library: 1080, garden: 2780, clock: 2580, shop: 560, dorm: 380, minigame: null }[from];
  const startX = focus ?? s.hub?.x ?? (s.attr ? 790 : 150);
  pan.scrollLeft = startX * u - app.clientWidth / 2;

  // 滑鼠拖曳也能捲（手機是原生捲動）；拖過就不算點
  let drag = null, dragged = false;
  pan.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") return; drag = { x: e.clientX, l: pan.scrollLeft }; dragged = false; });
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  function onMove(e) { if (!drag) return; const d = e.clientX - drag.x; if (Math.abs(d) > 6) dragged = true; pan.scrollLeft = drag.l - d; }
  function onUp() { drag = null; setTimeout(() => (dragged = false), 0); }

  // ── 動畫 ──
  let running = true, t = 0, last = performance.now(), acc = 0;
  const onResize = () => layout();
  window.addEventListener("resize", onResize);
  function frame(now) {
    if (!running || !root.isConnected) { stop(); return; }
    const dt = Math.min(0.1, (now - last) / 1000); last = now; t += dt; acc += dt;
    if (acc > 1 / 8) { acc = 0; for (const sp of sprites) drawSprite(sp, t); }
    requestAnimationFrame(frame);
  }
  for (const sp of sprites) drawSprite(sp, 0);
  requestAnimationFrame(frame);
  function stop() { running = false; window.removeEventListener("resize", onResize); window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); if (current === api) current = null; }
  const api = { stop };
  current = api;
  function leave() { writeSave(s); stop(); }

  // ── 點東西 ──
  let busy = false;
  async function tap(e, t) {
    if (dragged || busy) return;
    e.stopPropagation();
    t = { ...t, node: e.currentTarget };          // 撿到、打開的東西要從畫面上拿掉
    busy = true; sfx("click");
    label.hidden = false; label.textContent = t.name;
    const fn = !s.attr ? (t.id === "well" || t.id === "dean" ? ceremony : remind) : EVENTS[t.id] ?? PREFIX[t.id.split("_")[0]] ?? (t.student ? student : null);
    try { await (fn ?? (() => {}))(t); } finally { busy = false; label.hidden = true; refreshCoins(); }
  }
  function refreshCoins() { const c = hud.querySelector(".coins"); if (c) c.textContent = `${s.coins} 晶幣`; }
  const say = (lines, choices) => talk(root, lines, choices);
  const D = (text) => ({ who: "dean", name: "圓周院長", text });
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  const EVENTS = {
    dean: async () => {
      const first = !s.flags?.metDean;
      s.flags = { ...(s.flags ?? {}), metDean: true }; writeSave(s);
      if (first) await say([D("喔喔，是新來的見習魔數師！歡迎來到魔數學院。"), D("我是院長，大家叫我圓周院長。圓周率是三點一四一五九二六五三五八九七九三二三八四六……"), { who: null, name: "", text: "（院長停不下來了。你輕輕咳了一聲。）" }, D("……咳，總之！往右邊走是千頁圖書館、五座學院、溫室、鐘塔，最右邊是星芽花園，都可以去看看。")]);
      const r = await say([D(pick(["今天也要好好算喔。圓周率的下一位是……二六四三三八三二七九……", "墨水大王把學院的顏色吸走了。你算完的每一題，都會讓學院亮一點點。", "累了就去共鳴之井旁邊坐坐。人會成長，想法也會變喔。"]))], ["好的院長！", "院長，圓周率背到哪了？"]);
      if (r === 1) await say([D("五〇二八八四一九七一六九三九九三七五一〇五八二〇九七四九四四五九二三〇七八一六四〇六二八六二〇八九九八六二八〇三四八二五三四二一一七〇六七……"), { who: null, name: "", text: "（你決定先去別的地方逛逛。）" }]);
    },
    well: async () => {
      const d = daily(s);
      const opts = [d.wish ? "今天已經許過願了" : "投一枚晶幣許願（每天一次）", "重新做共鳴儀式", "看著井水發呆一下", "離開"];
      const r = await say([{ who: null, name: "共鳴之井", text: `井水輕輕發著光。你的數晶跟著閃了一下——${ATTRS[s.attr]?.school ?? ""}的顏色。` }], opts);
      if (r === 0 && !d.wish && s.coins >= 1) {
        s.coins -= 1; d.wish = true;
        const luck = [["井水亮了起來，湧出 15 枚晶幣！", () => (s.coins += 15)], ["一道光鑽進你的數晶：經驗＋20！", () => addExp(s, 20)], ["水面浮出一顆小數晶：數晶點數＋1！", () => (s.crystals[s.attr] = (s.crystals[s.attr] ?? 0) + 1)], ["井水映出你算題目的樣子。頁頁說：「你今天也很棒喔！」", () => (s.coins += 3)]];
        const [text, fn] = pick(luck); fn(); writeSave(s); sfx("restore");
        await say([{ who: null, name: "共鳴之井", text: `叮咚——${text}` }]);
      } else if (r === 0 && !d.wish) await say([{ who: null, name: "", text: "身上沒有晶幣……" }]);
      if (r === 1) { if (confirm("重新做共鳴儀式？等級、星星、錯題本都會保留。")) { leave(); game.go("resonance", { retest: true }); } }
      else if (r === 2) await say([{ who: null, name: "", text: "水面映出一串一串的數字，轉呀轉的，又變回星星。" }]);
    },
    ship: async () => { await say([{ who: null, name: "浮空船", text: "載你來學院的浮空船。船長說，等你更厲害一點，可以載你去其他浮空島看看。" }]); },
    library: async () => { leave(); game.go("library"); },
    toGarden: async () => { leave(); game.go("area", { grade: "g1" }); },
    board: async () => {
      const d = daily(s);
      const lines = QUESTS.map((q) => `${d.claimed.includes(q.id) ? "✔" : q.done(s) ? "★" : "・"} ${q.text}（${q.coins} 晶幣）`);
      const ready = QUESTS.filter((q) => q.done(s) && !d.claimed.includes(q.id));
      const r = await say([{ who: null, name: "布告欄・今日委託", text: lines.join("　") }], ready.length ? [`領取獎勵（${ready.reduce((a, q) => a + q.coins, 0)} 晶幣）`, "離開"] : ["離開"]);
      if (ready.length && r === 0) { ready.forEach((q) => { d.claimed.push(q.id); s.coins += q.coins; }); writeSave(s); sfx("level"); }
    },
  };
  const BLURB = {
    fire: "赤焰塔：紅磚高塔，屋頂的火盆從來沒熄過。火系導師最喜歡速算比賽。",
    water: "蒼流館：水道繞著館流。水系導師常說：「一條路不通，就換一條。」",
    ice: "白霜堂：屋簷掛著冰晶。冰系導師講話一個字、一個字，慢、慢、地、講。",
    forest: "翠森苑：蓋在一棵大樹裡的學院，旁邊連著小溫室。森系導師什麼都要畫出來看。",
    thunder: "紫雷閣：避雷針上常常劈啪閃著電光。雷系導師總是在問「為什麼」。",
    clock: "刻度鐘塔：鐘面只有刻度沒有數字。",
  };
  const MENTOR_TALK = {
    fire: ["快快快！算數就是要快！", "腦袋轉得快，魔法就放得快。來比一場？"],
    water: ["這條路不通的時候，就換一條路。", "同一個答案，可以有好多種算法喔。"],
    ice: ["慢……慢……來。", "一……步……一……步……，最……後……再……檢……查。"],
    forest: ["看不懂的時候，就把它畫出來！", "一排一排數，比一顆一顆數快多了。"],
    thunder: ["為什麼？為什麼？為什麼？", "數字排在一起，一定藏著規律。找到它！"],
  };
  async function mentor(k) {
    const M = MENTORS[k], mine = s.attr === k, who = `m_${k}`;
    const r = await say([{ who, name: M.name, text: (mine ? "喔！是我們學系的新生。" : "") + pick(MENTOR_TALK[k]) },
      { who, name: M.name, text: `要挑戰「${GAMES[k].title}」嗎？${s.mini?.[k] ? `你的最佳紀錄是 ${s.mini[k]}。` : ""}` }], [`挑戰「${GAMES[k].title}」`, "下次再說"]);
    if (r === 0) { leave(); game.go("minigame", { id: k }); }
  }
  const PREFIX = {
    b: async (t) => {
      const key = t.id.slice(2);
      if (key === "shop") { leave(); game.go("shop"); return; }
      if (key === "dorm") { leave(); game.go("dorm"); return; }
      if (key === "greenhouse") { await planter(); return; }
      if (key === "clock") {
        const exam = rankExamReady(s);
        const opts = ["進去鐘塔（三～四年級）", ...(exam ? ["參加升階考核"] : []), "先不要"];
        const r = await say([{ who: null, name: "刻度鐘塔", text: BLURB.clock + (exam ? `鐘塔亮了！你可以參加升階考核（→ ${RANKS[s.rank + 1].name}）。` : "裡面的機芯大廳被墨水弄亂了，三～四年級的墨水怪在裡面。") }], opts);
        if (r === 0) { leave(); game.go("area", { grade: "g34" }); }
        else if (exam && r === 1) { leave(); game.go("battle", { grade: s.lastGrade ?? "g1", mode: "exam" }); }
        return;
      }
      // 學院：先介紹，再找導師
      const r = await say([{ who: null, name: t.name, text: BLURB[key] ?? "" }], ["找導師", "離開"]);
      if (r === 0) await mentor(key);
    },
    m: async (t) => mentor(t.mentor),
    page: async (t) => {
      const i = Number(t.id.split("_")[1]); s.pages = [...new Set([...(s.pages ?? []), i])]; s.coins += 5; writeSave(s); sfx("good");
      tapped(t.node);
      await say([{ who: "page", name: "頁頁", text: `找到《萬題之書》的書頁了！（${s.pages.length} / ${PAGES.length}）上面寫著：` }, { who: null, name: "書頁", text: PAGES[i] }]);
      if (s.pages.length === PAGES.length) await say([{ who: "page", name: "頁頁", text: "全部的書頁都找到了！你真是最會找東西的魔數師！" }]);
    },
    chest: async (t) => {
      const i = Number(t.id.split("_")[1]), C = CHESTS[i];
      const r = await say([{ who: null, name: "數字鎖寶箱", text: C.q }], [...C.o.map(String), "先不要"]);
      if (r == null || r === C.o.length) return;
      if (C.o[r] === C.a) { s.chests = [...(s.chests ?? []), i]; s.coins += 20; addExp(s, 20); writeSave(s); sfx("level"); tapped(t.node); await say([{ who: null, name: "", text: "喀啦——鎖打開了！裡面有 20 晶幣。" }]); }
      else { sfx("hurt"); await say([{ who: null, name: "", text: "轉盤卡住了……再想想看？" }]); }
    },
    ink: async (t) => {
      const i = Number(t.id.split("_")[1]), q = riddleFor(s, { id: `ink${i}` });
      const r = await say([{ who: "page", name: "頁頁", text: "學院裡也冒出墨水了！這灘墨水上浮著一題，算完它就會散掉：" }, { who: null, name: "墨水小點", text: q.text }], q.options.map(String));
      daily(s).ink.push(i); writeSave(s); tapped(t.node);
      if (q.options[r] === q.answer) { s.coins += 3; addExp(s, 6); writeSave(s); sfx(`cast_${s.attr}`); await say([{ who: "page", name: "頁頁", text: "淨化！地面又乾淨了。（＋3 晶幣）" }]); }
      else { sfx("hurt"); await say([{ who: "page", name: "頁頁", text: `答案是 ${q.answer}。沒關係，明天它還會再冒出來給你練習。` }]); }
    },
  };
  function tapped(node) { if (node) { node.style.transition = "opacity .4s"; node.style.opacity = 0; setTimeout(() => node.remove(), 400); } }
  async function student(t) {
    const st = t.student, d = daily(s);
    if (d.riddles.includes(st.id)) { await say([{ who: st.id, name: st.name, text: st.line }]); return; }
    const q = riddleFor(s, st);
    const r = await say([{ who: st.id, name: st.name, text: st.line }, { who: st.id, name: st.name, text: `對了，可以幫我算一下嗎？${q.text}` }], q.options.map(String));
    if (q.options[r] === q.answer) { d.riddles.push(st.id); s.coins += 5; writeSave(s); sfx("good"); await say([{ who: st.id, name: st.name, text: "對耶！謝謝你～這個給你。（＋5 晶幣）" }]); }
    else { sfx("hurt"); await say([{ who: st.id, name: st.name, text: "嗯……好像不太對。我們再想想看？" }]); }
  }
  // 分晶溫室：數晶盆栽（每答對 15 題長大一階，第 4 階收成）；深處通往五～六年級的區域
  async function planter() {
    const okTotal = Object.values(s.diary ?? {}).reduce((a, d) => a + (d.ok ?? 0), 0);
    const r0 = await say([{ who: null, name: "分晶溫室", text: "玻璃裡長著會發光的數晶果實。深處的溫室被墨水弄亂了，是五～六年級的區域。" }], ["看看數晶盆栽", "往溫室深處（五～六年級）", "離開"]);
    if (r0 === 1) { leave(); game.go("area", { grade: "g56" }); return; }
    if (r0 !== 0) return;
    if (!s.plant) {
      const r = await say([{ who: null, name: "分晶溫室", text: "溫室裡有一個空的盆栽。管理員說：「種下數晶種子，你每答對題目，它就會長大喔。」" }], ["種下種子", "先不要"]);
      if (r === 0) { s.plant = { base: okTotal }; writeSave(s); sfx("good"); await say([{ who: null, name: "", text: "你種下了一顆亮晶晶的種子。" }]); }
      return;
    }
    const grown = okTotal - s.plant.base, stage = Math.min(4, Math.floor(grown / 15));
    const LOOK = ["一顆發光的種子埋在土裡。", "冒出一根小小的嫩芽！", "長出兩片葉子，葉子上有細細的光點。", "長成一棵小苗，頂端有一顆小花苞在發光。", "開花了！花心結出一顆閃亮的數晶果實！"];
    if (stage < 4) { await say([{ who: null, name: "數晶盆栽", text: `${LOOK[stage]}（再答對 ${15 * (stage + 1) - grown} 題會再長大）` }]); return; }
    const r = await say([{ who: null, name: "數晶盆栽", text: LOOK[4] }], ["收成", "先放著"]);
    if (r === 0) { s.crystals[s.attr] = (s.crystals[s.attr] ?? 0) + 3; s.plant = { base: okTotal }; writeSave(s); sfx("level"); await say([{ who: "page", name: "頁頁", text: "你的數晶多了 3 點！魔法會更亮喔。盆栽裡又冒出新的種子了。" }]); }
  }
  // 入學典禮：院長講話 → 共鳴儀式
  async function ceremony() {
    await say([
      D("喔喔，新生到了！歡迎來到魔數學院，我是院長，大家叫我圓周院長。"),
      D("入學典禮開始！首先，院長致詞：圓周率是三點一四一五九二六五三五八九七九三二三八四六二六四三……"),
      { who: null, name: "", text: "（院長講了很久很久。旁邊的老師輕輕咳了一聲。）" },
      D("……咳，總之！每位新生都要站上「共鳴之井」。井水會問你幾個問題——不是問你會不會算，是問你「喜歡怎麼想」。"),
      D("沒有對錯，照你真的會做的選就好。來，站上去吧！"),
    ]);
    leave(); game.go("resonance");
  }
  async function remind() { await say([D("新生！新生！先到共鳴之井來（往右滑一點，那個發光的井），入學典禮要開始囉！")]); }

  function menu() {
    if (busy) return;
    busy = true;
    const p = el("div.panel.wmenu", {},
      el("div.ptitle", {}, "選單"),
      el("button.btn", { onclick: () => { leave(); game.go("menu"); } }, "學院選單（所有區域、錯題本、成長日記）"),
      el("button.btn", { onclick: () => { leave(); game.go("settings", { from: "map" }); } }, "設定"),
      el("button.btn", { onclick: () => { leave(); game.go("title"); } }, "回標題"),
      el("button.btn.gold", { onclick: () => { p.remove(); busy = false; } }, "關閉"));
    root.append(p);
  }

  // 剛下浮空船的新生：提示怎麼操作
  if (!s.attr && !s.flags?.hubHint) {
    s.flags = { ...(s.flags ?? {}), hubHint: true }; writeSave(s);
    busy = true;
    say([{ who: null, name: "魔數學院", text: "浮空船靠岸了。左右滑動可以看整個學院，點建築、點人就能進去或說話。先去找共鳴之井吧！" }]).finally(() => (busy = false));
  }
}
