// 選關世界地圖（使用者 2026-11-06：選地圖要有地圖介面與圖片，不能是文字；方案：斜俯視像素地圖＋真實關卡縮圖＋霧裡預留第 2 章）
// 走到碎星鎮右邊的路標打開。點地圖上的地點 → 小星靈沿著路走過去、旁邊跳出資訊卡（關卡畫面縮圖、名稱、狀態）→ 按「出發」（或再點一次同一個地點）。
// 鍵盤：← → 換地點、Enter 出發、Esc 關掉。
// openWorldMap({ ... }) 回傳 Promise："stage:1-2" / "endless" / null（不出發）
import { createFrame, composite } from "../../pixelfx/src/core/index.js";
import { bakeBase, drawWorld, WM_W, WM_H, NODES, segs, LMY } from "./worldmap-art.js";
import { paintStar, POSES } from "./star.js";
import { playOpen } from "./ui-trans.js";

const ORDER = ["town", "1-1", "1-2", "1-3", "1-4", "endless", "ch2"];   // 鍵盤 ← → 的順序
let base = null;

/** 地點之間的路（沿著畫好的路走）：回傳一串點 */
function route(from, to) {
  if (from === to) return [[NODES[to].x, NODES[to].y]];
  const adj = {};
  for (const s of segs) { (adj[s.a] ??= []).push([s.b, s.pts]); (adj[s.b] ??= []).push([s.a, [...s.pts].reverse()]); }
  const prev = { [from]: null }, q = [from];
  while (q.length) { const n = q.shift(); if (n === to) break; for (const [m, pts] of adj[n] ?? []) if (!(m in prev)) { prev[m] = [n, pts]; q.push(m); } }
  if (!(to in prev)) return [[NODES[to].x, NODES[to].y]];
  const parts = [];
  for (let n = to; prev[n]; n = prev[n][0]) parts.unshift(prev[n][1]);
  return parts.flat();
}

export function openWorldMap({ profile, unlocked, layouts, notes, sfx, thumbs = "art/thumbs/" }) {
  base ??= bakeBase();
  const open = new Set(["town", "endless", ...unlocked]);
  const st = { sel: null, nodes: {} };
  for (const id of ORDER) st.nodes[id] = { open: open.has(id) || id === "ch2", cleared: !!profile.cleared?.[id], fresh: unlocked.includes(id) && !profile.cleared?.[id] };
  st.nodes.ch2.open = false;
  // 一開始選：還沒打過的最新一關，都打過就選最後一關
  const first = [...unlocked].reverse().find((id) => !profile.cleared?.[id]) ?? unlocked[unlocked.length - 1] ?? "1-1";

  const root = document.createElement("div");
  root.id = "worldWin";
  root.className = "win";
  root.innerHTML = `<div class="win-box wm-box"><div class="win-head"><b class="win-ttl">墜星之谷</b><span class="wm-tip">點地圖上的地方</span><button class="win-x wm-x" aria-label="關閉">✕</button></div>
    <div class="wm-wrap"><canvas class="wm-cv" width="${WM_W}" height="${WM_H}"></canvas><div class="wm-card hidden"></div></div></div>`;
  document.getElementById("stage").appendChild(root);
  const box = root.querySelector(".wm-box"), cv = root.querySelector(".wm-cv"), g = cv.getContext("2d"), card = root.querySelector(".wm-card");
  const frame = createFrame(WM_W, WM_H), img = new ImageData(WM_W, WM_H);
  sfx?.("open");
  playOpen(box, "guild");

  // 主角（小星靈）在地圖上的位置：從碎星鎮出發
  const hero = { x: NODES.town.x, y: NODES.town.y, at: "town", path: [], face: 1, dist: 0 };
  let done = null, alive = true, last = performance.now(), t = 0;
  const result = new Promise((r) => (done = r));
  function close(v) {
    if (!alive) return;
    alive = false;
    sfx?.(v ? "ui" : "close");
    removeEventListener("keydown", onKey, true);
    root.remove();
    done(v);
  }
  function go(id) {
    if (id === "town") return close(null);
    if (id === "endless") return close("endless");
    if (/^\d-\d$/.test(id) && open.has(id)) close("stage:" + id);
  }

  function select(id, walk = true) {
    if (!id) return;
    if (st.sel === id) { if (id !== "ch2") go(id); return; }
    st.sel = id;
    sfx?.("ui");
    if (walk && st.nodes[id].open) { hero.path = route(hero.at, id); hero.at = id; }   // 第 2 章還沒開：只看資訊，不走過去
    renderCard(id);
  }
  function renderCard(id) {
    const n = st.nodes[id], stage = /^\d-\d$/.test(id);
    let html = "";
    if (stage) {
      html = `<img class="wm-thumb" src="${thumbs}${id}.png" alt="">
        <div class="wm-name"><b>${id}</b> ${layouts[id].name}${n.cleared ? '<em class="ok">已通關</em>' : n.fresh ? '<em class="new">NEW</em>' : ""}</div>
        <div class="wm-note">${notes[id] ?? ""}</div>`;
    } else if (id === "endless") {
      html = `<img class="wm-thumb" src="${thumbs}endless.png" alt=""><div class="wm-name">無限討伐</div><div class="wm-note">怪一直出，打到你手痠為止</div>`;
    } else if (id === "town") {
      html = `<div class="wm-name">碎星鎮</div><div class="wm-note">先不出發，留在鎮上</div>`;
    } else {
      html = `<canvas class="wm-fog" width="116" height="78"></canvas><div class="wm-name">第 2 章　迷霧森林</div><div class="wm-note">霧太濃了，現在還過不去</div>`;
    }
    card.innerHTML = html + (id === "ch2" ? "" : `<button class="pbtn ${id === "town" ? "plain" : ""} wm-go">${id === "town" ? "留在鎮上" : "出發"}</button>`);
    card.querySelector(".wm-go")?.addEventListener("click", (e) => { e.stopPropagation(); go(id); });
    card.classList.remove("hidden");
    // 卡片放在地點的另一邊，不要蓋住
    card.classList.toggle("left", NODES[id].x > WM_W * 0.55);
    const fog = card.querySelector("canvas.wm-fog");   // 第 2 章沒有關卡畫面：直接截地圖上那團霧
    if (fog) fog.getContext("2d").drawImage(cv, NODES.ch2.x - 58, NODES.ch2.y - 30, 116, 78, 0, 0, 116, 78);
    card.classList.remove("pop"); void card.offsetWidth; card.classList.add("pop");
  }

  // 點地圖：找最近的地點（地點本身或上面的地標都算）
  cv.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    const r = cv.getBoundingClientRect(), mx = ((e.clientX - r.left) / r.width) * WM_W, my = ((e.clientY - r.top) / r.height) * WM_H;
    let best = null, bd = 26;
    for (const id of ORDER) {
      const n = NODES[id], d = Math.min(Math.hypot(mx - n.x, my - n.y), Math.hypot(mx - n.x, my - (n.y - LMY)));
      if (d < bd && (st.nodes[id].open || id === "ch2")) { bd = d; best = id; }
    }
    select(best);
  });
  root.querySelector(".wm-x").addEventListener("click", (e) => { e.stopPropagation(); close(null); });
  root.addEventListener("pointerdown", (e) => { e.stopPropagation(); if (e.target === root) close(null); });
  function onKey(e) {
    if (!alive) return;
    const list = ORDER.filter((id) => st.nodes[id].open);
    if (e.code === "Escape") close(null);
    else if (e.code === "Enter" || e.code === "Space" || e.code === "KeyF") go(st.sel);
    else if (e.code === "ArrowRight" || e.code === "KeyD" || e.code === "ArrowLeft" || e.code === "KeyA") {
      const k = list.indexOf(st.sel), d = e.code === "ArrowRight" || e.code === "KeyD" ? 1 : -1;
      select(list[(k + d + list.length) % list.length]);
    } else return;
    e.preventDefault(); e.stopImmediatePropagation();
  }
  addEventListener("keydown", onKey, true);

  function frameLoop(now) {
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    // 沿著路走（每秒 80 格）
    let move = 80 * dt, moving = false;
    while (move > 0 && hero.path.length) {
      const [px, py] = hero.path[0], dx = px - hero.x, dy = py - hero.y, d = Math.hypot(dx, dy);
      if (d <= move) { hero.x = px; hero.y = py; hero.path.shift(); move -= d; }
      else { hero.x += (dx / d) * move; hero.y += (dy / d) * move; move = 0; }
      if (Math.abs(dx) > 0.3) hero.face = Math.sign(dx);
      moving = true;
    }
    if (moving) hero.dist += 80 * dt;
    drawWorld(frame, t, base, st);
    paintStar(frame, hero.x, hero.y + 3, moving ? POSES.run[Math.floor(hero.dist / 6) % 4] : POSES.stand, hero.face < 0, { glow: 0 });
    composite(frame, img.data, null, 1);
    g.putImageData(img, 0, 0);
    requestAnimationFrame(frameLoop);
  }
  requestAnimationFrame(frameLoop);
  select(first);
  return result;
}
