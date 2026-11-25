// 大地圖畫面：學院島。左下角虛擬搖桿、點地自動走過去、右下角「調查」鍵；跟 NPC 說話、走到路口換地方。
// 鍵盤也可以：方向鍵／WASD 走路，空白鍵或 Enter 調查。
// 還沒做好的地方（圖書館、星芽花園地圖）先用對話選項直接進戰鬥或打開學院選單。

import { el, show } from "../ui.js";
import { sfx } from "../audio.js";
import { ATTRS, GRADES, RANKS } from "../data.js";
import { rankExamReady, addExp } from "../growth.js";
import { MENTORS } from "../../fx/mentor.js";
import { GAMES } from "./minigame.js";
import { STUDENTS, PAGES, CHESTS, QUESTS, riddleFor, daily } from "../world/island-life.js";
import { writeSave } from "../save.js";
import { loadMap } from "../world/maps.js";
import { World, VW, VH, fitView } from "../world/world.js";
import { talk } from "../world/talk.js";

let current = null;        // 同時只跑一個地圖畫面

export async function worldScene(game, { map, from } = {}) {
  current?.stop();
  const s = game.save;
  map ??= s.world?.map ?? "island";
  const M = await loadMap(map, s);
  // 站的位置：從別張地圖走過來＝那個入口；不然用存檔的位置
  const pos = from ? M.arrive[from] : s.world?.map === map ? s.world : null;
  const W = new World(M, { look: s.look ?? "girl", attrHex: ATTRS[s.attr]?.color ?? "#8a7cff", pos });
  // 存檔裡的位置在新版地圖上站不住（例如地圖改版了）：回到起點
  if (!W.canStand(W.hero.x, W.hero.y)) Object.assign(W.hero, { x: M.start.x, y: M.start.y, dir: M.start.dir });
  const restoring = M.grade && s.flags?.restore === M.grade;   // 剛打倒這一區的王：回到地圖時演「恢復色彩」
  if (restoring) W.gray = 1;

  const app = document.querySelector("#app");
  fitView(app.clientWidth / app.clientHeight);
  const cv = el("canvas.world", { width: VW, height: VH });
  const ctx = cv.getContext("2d");
  const stick = el("div.stick", {}, el("div.knob"));
  const act = el("button.btn.gold.act", { hidden: true }, "調查");
  const label = el("div.spotlabel", { hidden: true });
  const rank = RANKS[s.rank];
  const hud = el("div.whud", {},
    el("div.wprof", {}, el("span", {}, rank.name), el("span", {}, `Lv ${s.lv}`), el("span", { style: { color: ATTRS[s.attr]?.color } }, ATTRS[s.attr]?.name ?? ""), el("span", {}, `${s.coins} 晶幣`)),
    el("button.btn.small.menuBtn", { onclick: () => menu() }, "選單"));
  const root = el("div.screen.worldscr", {}, cv, label, hud, stick, act);
  show(root);
  await W.load();
  if (W.gray > 0 && !W.grayImg) { W.gray = 0; }

  let busy = false, running = true, last = performance.now(), saveT = 0, stepT = 0;
  const keys = new Set();
  const joy = { id: null, ox: 0, oy: 0, vx: 0, vy: 0 };
  let pending = null;        // 點了 NPC／東西：走到旁邊再觸發
  let autoLock = null;       // 自動觸發的地方：離開以前不再觸發
  { const n = W.nearby(); if (n?.auto) autoLock = n; }
  let touchLock = W.touching();   // 從戰鬥回來時就站在路口：先不觸發

  // ── 輸入 ──
  const toCanvas = (e) => { const r = cv.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * VW, ((e.clientY - r.top) / r.height) * VH]; };
  const lefty = () => document.querySelector("#app")?.classList.contains("lefty");
  root.addEventListener("pointerdown", (e) => {
    if (busy || e.target.closest("button, .talk, .panel")) return;
    const r = root.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    const inStickZone = (lefty() ? fx > 0.62 : fx < 0.38) && fy > 0.42;
    if (inStickZone && joy.id == null) {
      joy.id = e.pointerId; joy.ox = e.clientX; joy.oy = e.clientY; joy.vx = joy.vy = 0;
      stick.style.left = `${e.clientX - r.left}px`; stick.style.top = `${e.clientY - r.top}px`; stick.classList.add("on");
      root.setPointerCapture?.(e.pointerId);
      return;
    }
    const [sx, sy] = toCanvas(e), [wx, wy] = W.toWorld(sx, sy);
    const hit = W.hit(wx, wy);
    pending = hit;
    if (hit) W.walkTo(hit.kind === "npc" ? hit.x + (W.hero.x < hit.x ? -20 : 20) : hit.x, hit.kind === "npc" ? hit.y + 2 : hit.y);
    else W.walkTo(wx, wy);
  });
  root.addEventListener("pointermove", (e) => {
    if (e.pointerId !== joy.id) return;
    const R = 34, dx = e.clientX - joy.ox, dy = e.clientY - joy.oy, d = Math.hypot(dx, dy), k = d > R ? R / d : 1;
    joy.vx = (dx * k) / R; joy.vy = (dy * k) / R;
    stick.firstChild.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  });
  const endJoy = (e) => { if (e.pointerId !== joy.id) return; joy.id = null; joy.vx = joy.vy = 0; stick.classList.remove("on"); stick.firstChild.style.transform = ""; };
  root.addEventListener("pointerup", endJoy); root.addEventListener("pointercancel", endJoy);
  const onKey = (e) => {
    if (e.type === "keydown") { keys.add(e.key.toLowerCase()); if ((e.key === " " || e.key === "Enter") && !busy) { e.preventDefault(); interact(W.nearby()); } }
    else keys.delete(e.key.toLowerCase());
  };
  window.addEventListener("keydown", onKey); window.addEventListener("keyup", onKey);
  act.onclick = (e) => { e.stopPropagation(); interact(W.nearby()); };

  // ── 事情 ──
  async function interact(t) {
    if (!t || busy) return;
    busy = true; act.hidden = true; W.path = null; pending = null;
    sfx("click");
    // 剛下船的新生（還沒做共鳴儀式）：只能去共鳴之井、跟院長說話
    const fn = !s.attr ? (t.id === "well" || t.id === "dean" ? ceremony : remind) : EVENTS[t.id] ?? PREFIX[t.id.split("_")[0]] ?? (STUDENTS.some((x) => x.id === t.id) ? student : null);
    try { await (fn ?? (() => {}))(t); } finally { busy = false; }
  }
  const say = (lines, choices) => talk(root, lines, choices, { onLine: (L) => { const n = W.npcs.find((x) => x.id === L.who); if (n) n.talking = 9; } }).then((r) => { W.npcs.forEach((n) => (n.talking = 0)); return r; });
  const D = (text) => ({ who: "dean", name: "圓周院長", text });
  const EVENTS = {
    dean: async (n) => {
      // 院長面向你
      const first = !s.flags?.metDean;
      s.flags = { ...(s.flags ?? {}), metDean: true }; writeSave(s);
      if (first) await say([D("喔喔，是新來的見習魔數師！歡迎來到魔數學院。"), D("我是院長，大家叫我圓周院長。圓周率是三點一四一五九二六五三五八九七九三二三八四六……"), { who: null, name: "", text: "（院長停不下來了。你輕輕咳了一聲。）" }, D("……咳，總之！島中間的共鳴之井、北邊的千頁圖書館、西邊的星芽花園，都可以去看看。")]);
      const r = await say([D(pick(["今天也要好好算喔。圓周率的下一位是……二六四三三八三二七九……", "墨水大王把學院的顏色吸走了。你算完的每一題，都會讓學院亮一點點。", "累了就去共鳴之井旁邊坐坐。人會成長，想法也會變喔。"]))], ["好的院長！", "院長，圓周率背到哪了？"]);
      if (r === 1) await say([D("五〇二八八四一九七一六九三九九三七五一〇五八二〇九七四九四四五九二三〇七八一六四〇六二八六二〇八九九八六二八〇三四八二五三四二一一七〇六七……"), { who: null, name: "", text: "（你決定先去別的地方逛逛。）" }]);
    },
    well: async () => {
      const r = await say([{ who: null, name: "共鳴之井", text: `井水輕輕發著光。你的數晶跟著閃了一下——${ATTRS[s.attr]?.school ?? ""}的顏色。` }], ["重新做共鳴儀式", "看著井水發呆一下", "離開"]);
      if (r === 0) { if (confirm("重新做共鳴儀式？等級、星星、錯題本都會保留。")) { leave(); game.go("resonance", { retest: true }); } }
      else if (r === 1) await say([{ who: null, name: "", text: "水面映出一串一串的數字，轉呀轉的，又變回星星。" }]);
    },
    ship: async () => {
      await say([{ who: null, name: "浮空船", text: "載你來學院的浮空船。船長說，等你更厲害一點，可以載你去其他浮空島看看。" }]);
    },
    toGarden: async () => { go("garden", "island"); },
    toIsland: async () => { go("island", "garden"); },
    gate: async () => {
      const left = [1, 2, 3].filter((k) => !(s.stars[`g1-${k}`] > 0)).length;
      await say([{ who: "page", name: "頁頁", text: `墨水把門封住了……裡面有好濃的墨水味，是墨水大王！花園裡還有 ${left} 群墨水怪，先把它們淨化，封印就會變弱。` }]);
    },
    gardenSign: async () => { await say([{ who: null, name: "路牌", text: "← 花園深處　　→ 學院島（共鳴之井）" }]); },
    library: async () => { leave(); game.go("library"); },
  };
  // 換地圖：存好位置再換
  function go(to, fromMap) { leave(); s.world = null; game.go("map", { map: to, from: fromMap }); }
  // 碰到墨水怪：直接開打（明雷遇敵）
  function fight(m) {
    busy = true; leave();
    sfx("tick");
    if (m.boss) game.go("battle", { grade: M.grade, mode: "boss" });
    else game.go("battle", { grade: M.grade, mode: "stage", stage: m.stage });
  }
  // 建築門口：先放各棟的介紹（導師、學系小遊戲、商店……是第 6 批）
  const BLURB = {
    fire: "赤焰塔：紅磚高塔，屋頂的火盆從來沒熄過。火系導師最喜歡速算比賽。",
    water: "蒼流館：水道繞著館流。水系導師常說：「一條路不通，就換一條。」",
    ice: "白霜堂：屋簷掛著冰晶。冰系導師講話一個字、一個字，慢、慢、地、講。",
    forest: "翠森苑：蓋在一棵大樹裡的學院，旁邊連著小溫室。森系導師什麼都要畫出來看。",
    thunder: "紫雷閣：避雷針上常常劈啪閃著電光。雷系導師總是在問「為什麼」。",
    dorm: "宿舍：新生住的地方。之後可以在這裡休息、佈置自己的房間。",
    shop: "學院商店：櫥窗裡擺著帽子、斗篷和小家具。店長說貨還在路上。",
    greenhouse: "分晶溫室：玻璃裡長著會發光的數晶果實。深處通往五～六年級的區域。",
    clock: "刻度鐘塔：鐘面只有刻度沒有數字。準備好的魔數師可以在這裡參加升階考核。",
  };
  async function building(t) {
    const key = t.id.slice(2);
    if (key === "clock" && rankExamReady(s)) {
      const r = await say([{ who: null, name: "刻度鐘塔", text: `鐘塔亮了！你可以參加升階考核（→ ${RANKS[s.rank + 1].name}）。` }], ["參加考核", "先不要"]);
      if (r === 0) { leave(); game.go("battle", { grade: s.lastGrade ?? "g1", mode: "exam" }); }
      return;
    }
    await say([{ who: null, name: t.label, text: BLURB[key] ?? "" }]);
  }

  // ── 學院島的日常（企劃書 3.7） ──
  const MENTOR_TALK = {
    fire: ["快快快！算數就是要快！", "腦袋轉得快，魔法就放得快。來比一場？"],
    water: ["這條路不通的時候，就換一條路。", "同一個答案，可以有好多種算法喔。"],
    ice: ["慢……慢……來。", "一……步……一……步……，最……後……再……檢……查。"],
    forest: ["看不懂的時候，就把它畫出來！", "一排一排數，比一顆一顆數快多了。"],
    thunder: ["為什麼？為什麼？為什麼？", "數字排在一起，一定藏著規律。找到它！"],
  };
  const PREFIX = {
    b: building,
    m: async (t) => {
      const k = t.mentor ?? t.id.slice(2), M = MENTORS[k], mine = s.attr === k;
      const who = `m_${k}`;
      const r = await say([{ who, name: M.name, text: (mine ? "喔！是我們學系的新生。" : "") + MENTOR_TALK[k][Math.floor(Math.random() * 2)] },
        { who, name: M.name, text: `要挑戰「${GAMES[k].title}」嗎？${s.mini?.[k] ? `你的最佳紀錄是 ${s.mini[k]}。` : ""}` }], [`挑戰「${GAMES[k].title}」`, "下次再說"]);
      if (r === 0) { leave(); game.go("minigame", { id: k }); }
    },
    page: async (t) => {
      const i = Number(t.id.split("_")[1]); s.pages = [...new Set([...(s.pages ?? []), i])]; s.coins += 5; writeSave(s); sfx("good");
      await say([{ who: "page", name: "頁頁", text: `找到《萬題之書》的書頁了！（${s.pages.length} / ${PAGES.length}）上面寫著：` }, { who: null, name: "書頁", text: PAGES[i] }]);
      if (s.pages.length === PAGES.length) await say([{ who: "page", name: "頁頁", text: "十張書頁全部找到了！你真是最會找東西的魔數師！" }]);
    },
    chest: async (t) => {
      const i = Number(t.id.split("_")[1]), C = CHESTS[i];
      const r = await say([{ who: null, name: "數字鎖寶箱", text: C.q }], [...C.o.map(String), "先不要"]);
      if (r == null || r === C.o.length) return;
      if (C.o[r] === C.a) { s.chests = [...(s.chests ?? []), i]; s.coins += 20; addExp(s, 20); writeSave(s); sfx("level"); await say([{ who: null, name: "", text: "喀啦——鎖打開了！裡面有 20 晶幣。" }]); }
      else { sfx("hurt"); await say([{ who: null, name: "", text: "轉盤卡住了……再想想看？" }]); }
    },
    ink: async (t) => {
      const i = Number(t.id.split("_")[1]), q = riddleFor(s, { id: `ink${i}` });
      const r = await say([{ who: "page", name: "頁頁", text: "島上也冒出墨水了！這灘墨水上浮著一題，算完它就會散掉：" }, { who: null, name: "墨水小點", text: q.text }], q.options.map(String));
      if (q.options[r] === q.answer) { daily(s).ink.push(i); s.coins += 3; addExp(s, 6); writeSave(s); sfx(`cast_${s.attr}`); await say([{ who: "page", name: "頁頁", text: "淨化！地面又乾淨了。（＋3 晶幣）" }]); }
      else { sfx("hurt"); await say([{ who: "page", name: "頁頁", text: `答案是 ${q.answer}。沒關係，明天它還會再冒出來給你練習。` }]); daily(s).ink.push(i); writeSave(s); }
    },
  };
  async function student(t) {
    const st = t.student, d = daily(s);
    if (d.riddles.includes(st.id)) { await say([{ who: st.id, name: st.name, text: st.line }]); return; }
    const q = riddleFor(s, st);
    const r = await say([{ who: st.id, name: st.name, text: st.line }, { who: st.id, name: st.name, text: `對了，可以幫我算一下嗎？${q.text}` }], q.options.map(String));
    if (q.options[r] === q.answer) { d.riddles.push(st.id); s.coins += 5; writeSave(s); sfx("good"); await say([{ who: st.id, name: st.name, text: "對耶！謝謝你～這個給你。（＋5 晶幣）" }]); }
    else { sfx("hurt"); await say([{ who: st.id, name: st.name, text: "嗯……好像不太對。我們再想想看？" }]); }
  }
  EVENTS.board = async () => {
    const d = daily(s);
    const lines = QUESTS.map((q) => `${d.claimed.includes(q.id) ? "✔" : q.done(s) ? "★" : "・"} ${q.text}（${q.coins} 晶幣）`);
    const ready = QUESTS.filter((q) => q.done(s) && !d.claimed.includes(q.id));
    const r = await say([{ who: null, name: "布告欄・今日委託", text: lines.join("　") }], ready.length ? [`領取獎勵（${ready.reduce((a, q) => a + q.coins, 0)} 晶幣）`, "離開"] : ["離開"]);
    if (ready.length && r === 0) { ready.forEach((q) => { d.claimed.push(q.id); s.coins += q.coins; }); writeSave(s); sfx("level"); }
  };

  // 入學典禮（待辦 D2）：在共鳴之井旁，院長講話 → 共鳴儀式
  async function ceremony() {
    const n = W.npcs.find((x) => x.id === "dean");
    await say([
      D("喔喔，新生到了！歡迎來到魔數學院，我是院長，大家叫我圓周院長。"),
      D("入學典禮開始！首先，院長致詞：圓周率是三點一四一五九二六五三五八九七九三二三八四六二六四三……"),
      { who: null, name: "", text: "（院長講了很久很久。旁邊的老師輕輕咳了一聲。）" },
      D("……咳，總之！每位新生都要站上「共鳴之井」。井水會問你幾個問題——不是問你會不會算，是問你「喜歡怎麼想」。"),
      D("沒有對錯，照你真的會做的選就好。來，站上去吧！"),
    ]);
    if (n) n.talking = 0;
    leave(); game.go("resonance");
  }
  async function remind() {
    await say([D("新生！新生！先到島中間的共鳴之井來，入學典禮要開始囉！")]);
    backOff();
  }
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  // 自動觸發後不進去：往回退幾步，免得一直跳出來
  function backOff() { const sp = autoLock; if (sp) W.walkTo(W.hero.x + Math.sign(M.size[0] / 2 - sp.x) * 40, W.hero.y + Math.sign(M.size[1] / 2 - sp.y) * 40); }

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

  function savePos() { s.world = { map, x: Math.round(W.hero.x), y: Math.round(W.hero.y), dir: W.hero.dir }; writeSave(s); }
  function leave() { savePos(); stop(); }
  // 轉螢幕、進出全螢幕：畫面比例變了就重算寬度
  const onResize = () => { fitView(app.clientWidth / app.clientHeight); cv.width = VW; W.snapCam(); };
  window.addEventListener("resize", onResize);
  function stop() { window.removeEventListener("resize", onResize); running = false; window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKey); if (current === api) current = null; }
  const api = { stop };
  current = api;

  // ── 迴圈 ──
  function frame(now) {
    if (!running || !root.isConnected) { stop(); return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    let moved = false;
    if (!busy) {
      let vx = joy.vx, vy = joy.vy;
      if (keys.has("arrowleft") || keys.has("a")) vx -= 1;
      if (keys.has("arrowright") || keys.has("d")) vx += 1;
      if (keys.has("arrowup") || keys.has("w")) vy -= 1;
      if (keys.has("arrowdown") || keys.has("s")) vy += 1;
      moved = W.steer(vx, vy, dt);
      if (moved) pending = null;
    }
    W.update(dt, moved);
    if (W.hero.moving) { stepT += dt; if (stepT > 0.3) { stepT = 0; sfx("step"); } } else stepT = 0.25;
    // 碰到墨水怪就開打；從戰鬥回來時（輸了）還站在牠旁邊，要先走開才會再碰到
    const touch = !busy && W.touching();
    if (touchLock && touch !== touchLock) touchLock = null;
    if (touch && !touchLock) { fight(touch); return; }
    // 點了 NPC／東西：走到了就觸發
    const near = W.nearby();
    if (!busy && pending && !W.path && near && near.id === pending.id) interact(near);
    else if (!busy && pending && !W.path) pending = null;
    // 走到路口：自動觸發（離開範圍才會再觸發）
    if (autoLock && Math.hypot(W.hero.x - autoLock.x, W.hero.y - autoLock.y) > autoLock.r + 6) autoLock = null;
    // 還沒入學（沒有屬性）時，走到共鳴之井或院長旁邊就自動開始入學典禮
    const autoNow = near && (near.auto || (!s.attr && (near.id === "well" || near.id === "dean")));
    if (!busy && autoNow && !autoLock) { autoLock = near; interact(near); }
    act.hidden = busy || !near || near.auto;
    if (near && !near.auto) act.textContent = near.kind === "npc" ? "說話" : "調查";
    label.hidden = busy || !near;
    if (near) label.textContent = near.label ?? near.name;
    if ((saveT += dt) > 3) { saveT = 0; savePos(); }
    W.draw(ctx);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.__world = W;       // 開發用
  if (restoring) restoreEvent();
  // 剛下浮空船：教走路
  if (!s.attr && !s.flags?.walkHint) {
    s.flags = { ...(s.flags ?? {}), walkHint: true }; writeSave(s);
    interactLines([{ who: null, name: "學院島", text: "浮空船靠岸了。按住畫面左下角拖動（搖桿），或直接點地面，就能走過去。先走到島中間的共鳴之井吧！" }]);
  }

  // 恢復色彩：灰色慢慢退掉、墨水水窪消失（企劃書 D4）
  async function restoreEvent() {
    busy = true;
    s.flags = { ...s.flags, restore: null }; writeSave(s);
    await new Promise((r) => setTimeout(r, 600));
    sfx("restore"); W.restoreColor();
    await new Promise((r) => setTimeout(r, 2600));
    busy = false;
    await interactLines([
      { who: "page", name: "頁頁", text: "哇……花園的顏色回來了！花瓣又是五瓣、六瓣，數得清清楚楚！" },
      { who: "page", name: "頁頁", text: "墨水大王縮回地下禁書庫去了。可是它說的那句「反正沒有人會算完我」……我有點在意。" },
      { who: "page", name: "頁頁", text: "下一個是千頁圖書館的上層書庫（二年級）。我們一區一區，把學院的顏色找回來吧！" },
    ]);
  }
  async function interactLines(lines) { busy = true; try { await say(lines); } finally { busy = false; } }
}
