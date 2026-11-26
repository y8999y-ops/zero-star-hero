// 學院全景（使用者 2026-11-25：改成 2D 橫版、不要大地圖、點選就好；背景、建築、小物件用 AI 原圖）。
// 一張可以左右滑的學院橫幅：天空（會比前景慢一點，有遠近感）→ 樹籬 → 建築一排 → 石板路。
// 點建築、點人、點地上的東西就觸發：許願、院長、書頁、寶箱、墨水小點、布告欄、溫室盆栽；五座學院點了直接進去練數學（scenes/academy.js）。
// 版面單位：畫面高 270 格（跟以前的地圖畫面一樣），1 格＝畫面高 / 270。建築和小物件是原圖平滑縮小；人物、怪物是程式畫的像素（放大、方方的）。

import { el, show } from "../ui.js";
import { sfx } from "../audio.js";
import { ATTRS, RANKS, GRADES, MAX_LV, expToNext } from "../data.js";
import { profilePanel } from "./profile.js";
import { rankExamReady, addExp } from "../growth.js";
import { deanFrame } from "../../fx/dean.js";
import { pageFrame } from "../../fx/pickups.js";
import { PAGES, CHESTS, QUESTS, riddleFor, daily } from "../world/island-life.js";
import { writeSave } from "../save.js";
import { talk } from "../world/talk.js";

const U = 270;                 // 畫面高幾格
const GY = 232;                // 建築站的線（石板廣場的後緣）；下面一直到畫面底都是地面（石板廣場→草地），不會空
// 2026-11-26 使用者：建築往下 15%（192 → 232，畫面高 270 的 15%），建築之間的間隔加 15%（所有東西的 x 乘 SP）
const SP = 1.15;
const A = (n) => new URL(`../../assets/hub/${n}`, import.meta.url).href;
const BHD = (n) => new URL(`../../assets/battle-hd/garden/${n}`, import.meta.url).href;

// 建築：由左到右（浮空船碼頭上岸 → 生活區 → 廣場 → 千頁圖書館 → 五座學院 → 溫室 → 鐘塔 → 花園入口）
// 2026-11-25 使用者：太擠 → 建築之間留 60～110 格的空地，小物件減少，只放有理由的
// x：建築中心；h：高幾格；dy：往下沉幾格（圖的底部有地基、草地）
const BUILDINGS = [
  { id: "ship", art: "dock.png", name: "浮空船碼頭", x: 100, h: 112, dy: 14 },
  { id: "b_dorm", art: "dorm.png", name: "宿舍", x: 257, h: 106, dy: 8 },
  { id: "b_shop", art: "shop.png", name: "學院商店", x: 385, h: 92, dy: 8 },
  { id: "well", art: "well.png", name: "共鳴之井", x: 520, h: 96, dy: 16 },
  { id: "library", art: "library.png", name: "千頁圖書館", x: 750, h: 178, dy: 10 },
  { id: "b_fire", art: "fire.png", name: "大數運算", x: 935, h: 130, dy: 8 },
  { id: "b_water", art: "water.png", name: "分數與小數", x: 1070, h: 104, dy: 10 },
  { id: "b_ice", art: "ice.png", name: "除法與四則", x: 1222, h: 104, dy: 10 },
  { id: "b_forest", art: "forest.png", name: "圖形與測量", x: 1380, h: 112, dy: 10 },
  { id: "b_thunder", art: "thunder.png", name: "估算與規律", x: 1530, h: 130, dy: 8 },
  { id: "b_greenhouse", art: "greenhouse.png", name: "分晶溫室", x: 1670, h: 102, dy: 10 },
  { id: "b_clock", art: "clock.png", name: "刻度鐘塔", x: 1810, h: 188, dy: 8 },
  { id: "toGarden", art: "p/rosearch.png", name: "星芽花園", x: 1930, h: 80, dy: 4 },
];
const PW = 2010;               // 橫幅全長（格）。2026-11-25 使用者：房子靠近一點、無關的小裝飾拿掉
const DECOR = [];
// 人：只有院長在井旁（2026-11-25 使用者：導師、同學的對話全部取消；學院點了直接進去練習）
const NPCS = [
  { id: "dean", name: "圓周院長", x: 452, fn: (t) => deanFrame("idle", t) },
];
// 書頁、寶箱、墨水小點藏的地方（有理由：書頁卡在樹下、長椅底下、攤車旁……）
const PAGE_AT = [182, 322, 600, 868, 1002, 1146, 1300, 1458, 1600, 1742, 1872, 1990];
const CHEST_AT = [20, 1455, 1985];
const INK_AT = [[985, "p/ink-3.png"], [1300, "p/ink-1.png"], [1745, "p/ink-0.png"]];

// 主線任務（2026-11-25 使用者：主線任務太不明顯）：照順序淨化五區；還沒入學時是「到共鳴之井」
const MAIN = [["g1", "toGarden"], ["g2", "library"], ["g34", "b_clock"], ["g56", "b_greenhouse"], ["jh", "library"]];
export function mainQuest(s) {
  if (!s.attr) return { text: "到共鳴之井參加入學典禮", target: "well" };
  for (const [g, target] of MAIN) {
    if ((s.stars[`${g}-boss`] ?? 0) > 0) continue;
    const n = [1, 2, 3].filter((k) => (s.stars[`${g}-${k}`] ?? 0) > 0).length;
    return { text: `淨化${GRADES[g].area}${n < 3 ? `：墨水怪 ${n}/3` : "：打倒墨水大王"}`, target };
  }
  return { text: "主線完成！到學院練習、挑戰更難的題目吧", target: null };
}

let current = null;

export function hubScene(game, { from } = {}) {
  current?.stop();
  const s = game.save;
  const app = document.querySelector("#app");
  const rank = RANKS[s.rank];
  const pan = el("div.hubpan");
  const world = el("div.hubworld");
  const sky = el("div.hubsky", { style: { backgroundImage: `url(${BHD("back.jpg")})` } });
  // 遠近：天空（最慢、最淡）→ 遠處的花園樹籬（慢、淡、霧）→ 霧 → 建築和人（正常）→ 石板廣場 → 最前面的草地
  const far = el("div.hubfar", { style: { backgroundImage: `url(${BHD("mid.png")})` } });
  const haze = el("div.hubhaze");
  const floor = el("div.hubfloor", { style: { backgroundImage: `url(${A("floor.jpg")})` } });
  const lawn = el("div.hublawn", { style: { backgroundImage: `url(${A("lawn.jpg")})` } });
  const label = el("div.hublabel", { hidden: true });
  const hud = el("div.whud", {},
    // 個人卡（2026-11-26 使用者：看不清楚 → 字放大、底色實一點；點了打開個人資料，錯題本也在裡面）
    el("button.wprof", { "aria-label": "個人資料", onclick: () => { if (busy) return; busy = true; sfx("click"); profilePanel(game, "me", (left) => { if (left) leave(); busy = false; }); } },
      el("span.wpbadge", { style: { "--c": ATTRS[s.attr]?.color ?? "#ccc" } }, ATTRS[s.attr]?.name ?? "？"),
      el("span.wpmain", {},
        el("span.wpname", {}, rank.name, el("b", {}, ` Lv${s.lv}`)),
        el("span.wpexp", {}, el("i", { style: { width: s.lv >= MAX_LV ? "100%" : `${(100 * s.exp) / expToNext(s.lv)}%` } }))),
      el("span.wpcoin", {}, `${s.coins}`, el("small", {}, "晶幣")),
      Object.keys(s.review).length ? el("span.wpdot", {}, `${Object.keys(s.review).length}`) : null),
    el("button.btn.small.menuBtn", { onclick: () => menu() }, "選單"));
  world.append(floor, lawn);
  pan.append(world);
  // 左右兩邊的半透明大箭頭：提示可以左右滑（2026-11-26 使用者）；點了也會滑一段；滑到底那一邊就淡掉
  const arrowL = el("button.hubarrow.l", { "aria-label": "往左看", onclick: () => smoothScroll(pan.scrollLeft - app.clientWidth * 0.6, 500) });
  const arrowR = el("button.hubarrow.r", { "aria-label": "往右看", onclick: () => smoothScroll(pan.scrollLeft + app.clientWidth * 0.6, 500) });
  const root = el("div.screen.hubscr", {}, sky, far, haze, pan, arrowL, arrowR, hud, label);
  show(root);

  // ── 擺東西（位置都用「格」，換成 CSS 像素在 layout()） ──
  const items = [];          // { node, x, y（底部）, h, w? }
  const put = (node, x, h, yBottom, z) => { node.style.zIndex = z; world.append(node); items.push({ node, x: x * SP, h, y: yBottom }); return node; };
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
    const sh = el("div.hubshadow"); put(sh, x, 5, yBottom + 2, z - 1); sh.dataset.w = f0.w * scale * 0.55;   // 腳下的影子（不然像浮在空中）
    const it = put(n, x, f0.h * scale, yBottom + (f0.h - f0.oy) * scale, z);
    sprites.push({ fn, cv, f0, it });
    return n;
  };
  const drawSprite = (sp, t) => {
    const f = sp.fn(t), c = sp.cv.getContext("2d");
    c.clearRect(0, 0, sp.cv.width, sp.cv.height);
    c.putImageData(new ImageData(new Uint8ClampedArray(f.px.buffer.slice(0)), f.w, f.h), 0, 0);
  };
  for (const n of NPCS) sprite(n.fn, n.x, 1, GY + 12, 40, { ...n, kind: "npc" }, n.name);
  s.pages ??= []; s.chests ??= [];
  PAGES.forEach((_, i) => { if (!s.pages.includes(i)) sprite((t) => pageFrame(t + i * 0.13), PAGE_AT[i % PAGE_AT.length] + (i >= PAGE_AT.length ? 30 : 0) + 22, 1, GY + 24, 35, { id: `page_${i}`, name: "發光的書頁" }, "發光的書頁"); });
  CHESTS.forEach((_, i) => { if (!s.chests.includes(i)) { const n = img("p/chest.png", ".hubd.hubtap"); n.addEventListener("click", (e) => tap(e, { id: `chest_${i}`, name: "數字鎖寶箱" })); put(n, CHEST_AT[i], 26, GY + 22, 35); } });
  INK_AT.forEach(([x, src], i) => { if (!daily(s).ink.includes(i)) { const n = img(src, ".hubd.hubtap"); n.addEventListener("click", (e) => tap(e, { id: `ink_${i}`, name: "墨水小點" })); put(n, x, 16, GY + 30, 34); } });
  { const n = img("p/board.png", ".hubd.hubtap"); n.addEventListener("click", (e) => tap(e, { id: "board", name: "布告欄・今日委託" })); put(n, 596, 44, GY + 4, 12); }

  // ── 版面：依畫面高算 1 格多大 ──
  let u = 1;
  function layout() {
    u = app.clientHeight / U;
    world.style.width = `${PW * SP * u}px`;
    Object.assign(far.style, { top: `${(GY - 58) * u}px`, height: `${56 * u}px`, backgroundSize: `auto ${56 * u}px` });
    // 地板是平的（2026-11-25 使用者：3D 透視會讓地板變形）；遠近感改用顏色：後面亮、前面暗一點（樣式在 .hubfloor::after）
    Object.assign(floor.style, { top: `${(GY - 6) * u}px`, height: `${(U - GY - 4) * u}px`, backgroundSize: `auto ${22 * u}px` });
    Object.assign(lawn.style, { top: `${(U - 10) * u}px`, bottom: "0", backgroundSize: `auto ${30 * u}px` });
    for (const it of items) {
      const n = it.node, im = n.tagName === "IMG" ? n : n.querySelector("img, canvas");
      if (!im) { const w = Number(n.dataset.w) * u, h = it.h * u; Object.assign(n.style, { left: `${it.x * u - w / 2}px`, top: `${it.y * u - h}px`, width: `${w}px`, height: `${h}px` }); continue; }
      const ratio = im.tagName === "CANVAS" ? im.width / im.height : (im.naturalWidth || 1) / (im.naturalHeight || 1);
      const h = it.h * u, w = h * ratio;
      Object.assign(n.style, { left: `${it.x * u - w / 2}px`, top: `${it.y * u - h}px`, width: `${w}px`, height: `${h}px` });
    }
    parallax();
  }
  // 天空比前景慢（遠近感）
  function arrows() {
    const max = pan.scrollWidth - pan.clientWidth, locked = pan.classList.contains("locked");
    arrowL.classList.toggle("off", locked || pan.scrollLeft <= 4);
    arrowR.classList.toggle("off", locked || pan.scrollLeft >= max - 4);
  }
  function parallax() {
    arrows(); sky.style.backgroundPosition = `${-pan.scrollLeft * 0.15}px 0`; far.style.backgroundPosition = `${-pan.scrollLeft * 0.45}px 0`; }
  pan.addEventListener("scroll", () => { parallax(); s.hub = { x: Math.round(pan.scrollLeft / u) }; }, { passive: true });
  root.querySelectorAll("img").forEach((im) => { if (!im.complete) im.addEventListener("load", layout, { once: true }); });
  layout();
  // 一開始看哪裡：從哪裡回來就看哪裡；沒有的話是上次的位置；新生是碼頭
  const focus = { library: 750, garden: 1930, clock: 1810, shop: 385, dorm: 257, well: 520 }[from] ?? BUILDINGS.find((b) => b.id === `b_${from}`)?.x;
  const startX = !s.attr ? 100 * SP : focus != null ? focus * SP : s.hub?.x ?? 520 * SP;
  pan.scrollLeft = startX * u - app.clientWidth / 2;

  // ── 主線任務：上方的任務列＋目標建築頭上的箭頭、建築發光 ──
  const Q = mainQuest(s);
  const goTarget = (smooth = true) => { const b = BUILDINGS.find((x) => x.id === Q.target); if (b) smoothScroll(b.x * SP * u - app.clientWidth / 2, smooth ? 900 : 0); };
  hud.append(el("div.questbar", {}, el("span.qlabel", {}, "主線"), el("span.qtext", {}, Q.text), Q.target ? el("button.btn.small.gold.qgo", { onclick: () => { sfx("click"); goTarget(); } }, "前往") : null));
  const tb = BUILDINGS.find((x) => x.id === Q.target);
  if (tb) {
    const arrow = el("div.qarrow", {}, "▼");
    put(arrow, tb.x, 16, GY + tb.dy - tb.h - 2, 45);
    arrow.dataset.w = 16;
    world.querySelector(`.hubb[aria-label="${tb.name}"]`)?.classList.add("qtarget");
    layout();
  }
  function smoothScroll(to, ms) {
    const from = pan.scrollLeft, t0 = performance.now();
    if (!ms) { pan.scrollLeft = to; return; }
    const step = (now) => { const k = Math.min(1, (now - t0) / ms), e = k * k * (3 - 2 * k); pan.scrollLeft = from + (to - from) * e; if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  // 還沒入學：強制引導——不能左右滑，鏡頭從碼頭自動移到共鳴之井
  if (!s.attr) { pan.classList.add("locked"); setTimeout(() => goTarget(true), 900); }
  arrows();

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
  function leave() { writeSave(s); stop(); sfx("door"); }

  // ── 點東西 ──
  let busy = false;
  async function tap(e, t) {
    if (dragged || busy) return;
    e.stopPropagation();
    t = { ...t, node: e.currentTarget };          // 撿到、打開的東西要從畫面上拿掉
    busy = true; sfx("click");
    label.hidden = false; label.textContent = t.name;
    const fn = !s.attr ? (t.id === "well" || t.id === "dean" ? ceremony : remind) : EVENTS[t.id] ?? PREFIX[t.id.split("_")[0]];
    try { await (fn ?? (() => {}))(t); } finally { busy = false; label.hidden = true; refreshCoins(); }
  }
  function refreshCoins() { const c = hud.querySelector(".wpcoin"); if (c) c.firstChild.textContent = `${s.coins}`; }
  const say = (lines, choices) => talk(root, lines, choices);
  const D = (text) => ({ who: "dean", name: "圓周院長", text });
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  const EVENTS = {
    dean: async () => {
      const first = !s.flags?.metDean;
      s.flags = { ...(s.flags ?? {}), metDean: true }; writeSave(s);
      if (first) await say([D("喔喔，是新來的見習魔數師！歡迎來到魔數學院。"), D("我是院長，大家叫我圓周院長。圓周率是三點一四一五九二六五三五八九七九三二三八四六……"), { who: null, name: "", text: "院長停不下來了。你輕輕咳了一聲。" }, D("……咳，總之！往右邊走是千頁圖書館、五座學院、溫室、鐘塔，最右邊是星芽花園，都可以去看看。")]);
      const r = await say([D(pick(["今天也要好好算喔。圓周率的下一位是……二六四三三八三二七九……", "墨水大王把學院的顏色吸走了。你算完的每一題，都會讓學院亮一點點。", "累了就去共鳴之井旁邊坐坐。人會成長，想法也會變喔。"]))], ["好的院長！", "院長，圓周率背到哪了？"]);
      if (r === 1) await say([D("五〇二八八四一九七一六九三九九三七五一〇五八二〇九七四九四四五九二三〇七八一六四〇六二八六二〇八九九八六二八〇三四八二五三四二一一七〇六七……"), { who: null, name: "", text: "你決定先去別的地方逛逛。" }]);
    },
    well: async () => {
      const d = daily(s);
      const opts = [d.wish ? "今天已許過願" : "許願", "重新共鳴儀式", "副屬性", "離開"];
      const r = await say([{ who: null, name: "共鳴之井", text: "要做什麼？" }], opts);
      if (r === 0 && !d.wish && s.coins >= 1) {
        s.coins -= 1; d.wish = true;
        const luck = [["井水亮了起來，湧出 15 枚晶幣！", () => (s.coins += 15)], ["一道光鑽進你的數晶：經驗＋20！", () => addExp(s, 20)], ["水面浮出一顆小數晶：數晶點數＋1！", () => (s.crystals[s.attr] = (s.crystals[s.attr] ?? 0) + 1)], ["井水映出你算題目的樣子。頁頁說：「你今天也很棒喔！」", () => (s.coins += 3)]];
        const [text, fn] = pick(luck); fn(); writeSave(s); sfx("restore");
        await say([{ who: null, name: "共鳴之井", text: `叮咚——${text}` }]);
      } else if (r === 0 && !d.wish) await say([{ who: null, name: "", text: "身上沒有晶幣……" }]);
      if (r === 1) { if (confirm("重新做共鳴儀式？等級、星星、錯題本都會保留。")) { leave(); game.go("resonance", { retest: true }); } }
      else if (r === 2) {
        // 副屬性（Lv20 開放）：2026-11-25 學系能力取消後，副屬性只用在組合技（連擊每 3 下合成一招）
        if (s.lv < 20) { await say([{ who: null, name: "共鳴之井", text: `等你到 Lv20，井水就會讓你的數晶再多共鳴一種顏色。` }]); return; }
        const others = Object.keys(ATTRS).filter((k) => k !== s.attr);
        const c = await say([{ who: null, name: "共鳴之井", text: "選一種副屬性。連擊每 3 下，會跟它合成「組合技」，隨時可以回來換。" }], [...others.map((k) => `${ATTRS[k].name}・${ATTRS[k].school}`), "不要副屬性"]);
        if (c == null) return;
        s.subAttr = c < others.length ? others[c] : null; writeSave(s); sfx("restore");
        await say([{ who: null, name: "共鳴之井", text: s.subAttr ? `你的數晶多了一道${ATTRS[s.subAttr].name}色的光。` : "數晶的光回到一種顏色了。" }]);
      }
    },
    ship: async () => { await say([{ who: null, name: "浮空船", text: "載你來學院的浮空船。船長說，等你更厲害一點，可以載你去其他浮空島看看。" }]); },
    library: async () => { leave(); game.go("library"); },
    toGarden: async () => { leave(); game.go("area", { grade: "g1" }); },
    board: async () => {
      const d = daily(s);
      const lines = QUESTS.map((q) => `${d.claimed.includes(q.id) ? "✔" : q.done(s) ? "★" : "・"} ${q.text}`);
      const ready = QUESTS.filter((q) => q.done(s) && !d.claimed.includes(q.id));
      const r = await say([{ who: null, name: "布告欄・今日委託", text: lines.join("　") }], ready.length ? ["領取獎勵", "離開"] : ["離開"]);
      if (ready.length && r === 0) { ready.forEach((q) => { d.claimed.push(q.id); s.coins += q.coins; }); writeSave(s); sfx("level"); }
    },
  };
  const BLURB = { clock: "刻度鐘塔：鐘面只有刻度沒有數字。" };

  const PREFIX = {
    b: async (t) => {
      const key = t.id.slice(2);
      if (key === "shop") { leave(); game.go("shop"); return; }
      if (key === "dorm") { leave(); game.go("dorm"); return; }
      if (key === "greenhouse") { await planter(); return; }
      if (key === "clock") {
        const exam = rankExamReady(s);
        const opts = ["進去", ...(exam ? ["參加升階考核"] : []), "挑戰模式", "先不要"];
        const r = await say([{ who: null, name: "刻度鐘塔", text: exam ? "可以參加升階考核" : "要做什麼？" }], opts);
        if (r === 0) { leave(); game.go("area", { grade: "g34" }); }
        else if (exam && r === 1) { leave(); game.go("battle", { grade: s.lastGrade ?? "g1", mode: "exam" }); }
        else if (r === (exam ? 2 : 1)) {
          if (s.lv < 15) { await say([{ who: null, name: "刻度鐘塔", text: `挑戰模式：每題 20 秒、一直連答，答錯就結束。等你到 Lv15 再來挑戰！` }]); return; }
          leave(); game.go("battle", { grade: "g34", mode: "challenge" });
        }
        return;
      }
      // 學院：直接進去練習（每座學院兩種數學魔法）
      leave(); game.go("academy", { academy: key });
    },
    page: async (t) => {
      const i = Number(t.id.split("_")[1]); s.pages = [...new Set([...(s.pages ?? []), i])]; s.coins += 5; writeSave(s); sfx("good");
      tapped(t.node);
      await say([{ who: "page", name: "頁頁", text: "找到《萬題之書》的書頁了！上面寫著：" }, { who: null, name: "書頁", text: PAGES[i] }]);
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
      if (q.options[r] === q.answer) { s.coins += 3; addExp(s, 6); writeSave(s); sfx(`cast_${s.attr}`); await say([{ who: "page", name: "頁頁", text: "淨化！地面又乾淨了。" }]); }
      else { sfx("hurt"); await say([{ who: "page", name: "頁頁", text: `答案是 ${q.answer}。沒關係，明天它還會再冒出來給你練習。` }]); }
    },
  };
  function tapped(node) { if (node) { node.style.transition = "opacity .4s"; node.style.opacity = 0; setTimeout(() => node.remove(), 400); } }
  // 分晶溫室：數晶盆栽（每答對 15 題長大一階，第 4 階收成）；深處通往五～六年級的區域
  async function planter() {
    const okTotal = Object.values(s.diary ?? {}).reduce((a, d) => a + (d.ok ?? 0), 0);
    const r0 = await say([{ who: null, name: "分晶溫室", text: "要做什麼？" }], ["數晶盆栽", "溫室深處", "離開"]);
    if (r0 === 1) { leave(); game.go("area", { grade: "g56" }); return; }
    if (r0 !== 0) return;
    if (!s.plant) {
      const r = await say([{ who: null, name: "分晶溫室", text: "溫室裡有一個空的盆栽。管理員說：「種下數晶種子，你每答對題目，它就會長大喔。」" }], ["種下種子", "先不要"]);
      if (r === 0) { s.plant = { base: okTotal }; writeSave(s); sfx("good"); await say([{ who: null, name: "", text: "你種下了一顆亮晶晶的種子。" }]); }
      return;
    }
    const grown = okTotal - s.plant.base, stage = Math.min(4, Math.floor(grown / 15));
    const LOOK = ["一顆發光的種子埋在土裡。", "冒出一根小小的嫩芽！", "長出兩片葉子，葉子上有細細的光點。", "長成一棵小苗，頂端有一顆小花苞在發光。", "開花了！花心結出一顆閃亮的數晶果實！"];
    if (stage < 4) { await say([{ who: null, name: "數晶盆栽", text: LOOK[stage] }]); return; }
    const r = await say([{ who: null, name: "數晶盆栽", text: LOOK[4] }], ["收成", "先放著"]);
    if (r === 0) { s.crystals[s.attr] = (s.crystals[s.attr] ?? 0) + 3; s.plant = { base: okTotal }; writeSave(s); sfx("level"); await say([{ who: "page", name: "頁頁", text: "你的數晶多了 3 點！魔法會更亮喔。盆栽裡又冒出新的種子了。" }]); }
  }
  // 入學典禮：劇情動畫（scenes/story.js）→ 共鳴儀式
  async function ceremony() { leave(); game.go("ceremony"); }
  async function remind() { await say([D("新生！新生！先到共鳴之井來，入學典禮要開始囉！")]); }

  function menu() {
    if (busy) return;
    busy = true;
    const p = el("div.panel.wmenu", {},
      el("div.ptitle", {}, "選單"),
      el("button.btn", { onclick: () => { leave(); game.go("menu"); } }, "學院選單"),
      el("button.btn", { onclick: () => { leave(); game.go("settings", { from: "map" }); } }, "設定"),
      el("button.btn", { onclick: () => { leave(); game.go("title"); } }, "回標題"),
      el("button.btn.gold", { onclick: () => { p.remove(); busy = false; } }, "關閉"));
    root.append(p);
  }

  // 剛下浮空船的新生：提示怎麼操作
  if (!s.attr) {
    // 剛下船：先說明，再點發光的共鳴之井（其他地方點了院長會叫你先去井那邊）
    busy = true;
    setTimeout(() => say([{ who: "dean", name: "圓周院長", text: "新生到了！入學典禮在共鳴之井，就是那個發光的井。點它開始吧！" }]).finally(() => (busy = false)), 1900);
  } else if (!s.flags?.hubHint) {
    s.flags = { ...(s.flags ?? {}), hubHint: true }; writeSave(s);
    busy = true;
    say([{ who: null, name: "魔數學院", text: "左右滑動可以看整個學院。上面的「主線」告訴你下一步去哪裡。" }]).finally(() => (busy = false));
  }
}
