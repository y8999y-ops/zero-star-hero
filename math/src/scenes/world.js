// 大地圖畫面：學院島。左下角虛擬搖桿、點地自動走過去、右下角「調查」鍵；跟 NPC 說話、走到路口換地方。
// 鍵盤也可以：方向鍵／WASD 走路，空白鍵或 Enter 調查。
// 還沒做好的地方（圖書館、星芽花園地圖）先用對話選項直接進戰鬥或打開學院選單。

import { el, show } from "../ui.js";
import { sfx } from "../audio.js";
import { ATTRS, GRADES, RANKS } from "../data.js";
import { writeSave } from "../save.js";
import { MAPS } from "../world/maps.js";
import { World, VW, VH } from "../world/world.js";
import { talk } from "../world/talk.js";

let current = null;        // 同時只跑一個地圖畫面

export async function worldScene(game, { map = "island" } = {}) {
  current?.stop();
  const s = game.save;
  const M = MAPS[map];
  const pos = s.world?.map === map ? s.world : null;
  const W = new World(M, { look: s.look ?? "girl", attrHex: ATTRS[s.attr]?.color ?? "#8a7cff", pos });

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

  let busy = false, running = true, last = performance.now(), saveT = 0, stepT = 0;
  const keys = new Set();
  const joy = { id: null, ox: 0, oy: 0, vx: 0, vy: 0 };
  let pending = null;        // 點了 NPC／東西：走到旁邊再觸發
  let autoLock = null;       // 自動觸發的地方：離開以前不再觸發
  { const n = W.nearby(); if (n?.auto) autoLock = n; }   // 從戰鬥回來時就站在路口：先不觸發

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
    try { await (EVENTS[t.id] ?? (() => {}))(t); } finally { busy = false; }
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
    garden: async () => {
      const g = GRADES.g1, st = [1, 2, 3].map((k) => s.stars[`g1-${k}`] ?? 0);
      const opts = [1, 2, 3].map((k) => `第 ${k} 關 ${"★".repeat(st[k - 1])}`).filter((_, k) => k === 0 || st[k - 1] > 0);
      if (st[2] > 0) opts.push(`墨水大王 ${"★".repeat(s.stars["g1-boss"] ?? 0)}`);
      opts.push("先不要");
      const r = await say([{ who: null, name: g.area, text: s.stars["g1-boss"] ? "花園已經恢復色彩了，花香飄過來。要再進去練習嗎？" : "前面是星芽花園。花都被墨水染灰了，裡面有墨水怪在遊蕩……" }], opts);
      if (r == null || r === opts.length - 1) { backOff(); return; }
      leave();
      if (st[2] > 0 && r === opts.length - 2) game.go("battle", { grade: "g1", mode: "boss" });
      else game.go("battle", { grade: "g1", mode: "stage", stage: r });
    },
    library: async () => {
      const r = await say([{ who: null, name: "千頁圖書館", text: "北邊是千頁圖書館。館裡的書還在整理中，暫時進不去。要先打開學院選單，去其他學年的區域嗎？" }], ["打開學院選單", "先不要"]);
      if (r === 0) { leave(); game.go("menu"); } else backOff();
    },
  };
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
  function stop() { running = false; window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKey); if (current === api) current = null; }
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
    // 點了 NPC／東西：走到了就觸發
    const near = W.nearby();
    if (!busy && pending && !W.path && near && near.id === pending.id) interact(near);
    else if (!busy && pending && !W.path) pending = null;
    // 走到路口：自動觸發（離開範圍才會再觸發）
    if (autoLock && Math.hypot(W.hero.x - autoLock.x, W.hero.y - autoLock.y) > autoLock.r + 6) autoLock = null;
    if (!busy && near?.auto && !autoLock) { autoLock = near; interact(near); }
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
}
