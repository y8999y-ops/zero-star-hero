// 開場動畫（企劃書 3.3、待辦 D1）：跟選外觀結合。
//   ① 數律之地：夜空裡數字像星星一樣閃
//   ② 天亮：雲海上浮著一座島——魔數學院（星芽花園戰鬥背景的天空與浮空島）
//   ③ 浮空船從左邊飛進來，停在畫面中間
//   ④ 船上兩位新生的剪影：選「你是哪一位新生？」→ 選到的那位亮起來、另一位淡掉
//   ⑤ 浮空船往學院島飛去 → 淡出 → 大地圖的碼頭
// 重看（設定）：不用選，直接用現在的外觀演完，回設定。全程可以跳過（跳過時還沒選外觀就直接跳到選擇）。
// 畫布 384×216（跟戰鬥一樣的像素大小）。

import { el, show } from "../ui.js";
import { sfx } from "../audio.js";
import { writeSave } from "../save.js";
import { heroWalkFrame } from "../../fx/hero-walk.js";
import { loadAreaArt } from "../battle/areaart.js";
import { FONTS } from "../../../pixelfx/src/core/index.js";

const W = 384, H = 216;
const rand = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const seg = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));
const K = 2, RAIL = 80 * K, SHIP_W = 66 * K;   // 浮空船放大 2 倍（整數倍，像素還是方的）：欄杆高度、船寬

function loadImg(src) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; }); }
function canvasOf(f) {
  const c = document.createElement("canvas"); c.width = f.w; c.height = f.h;
  c.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(f.px.buffer.slice(0)), f.w, f.h), 0, 0);
  return c;
}
function tint(src, col) {
  const c = document.createElement("canvas"); c.width = src.width; c.height = src.height;
  const x = c.getContext("2d"); x.drawImage(src, 0, 0); x.globalCompositeOperation = "source-in"; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height);
  return c;
}
// 剪影：淡紫色的人形＋一圈亮邊（深色的剪影會跟船艙的深色木頭混在一起，看不出是人）
function silhouette(src, col, rim) {
  const c = document.createElement("canvas"); c.width = src.width; c.height = src.height;
  const x = c.getContext("2d"), r = tint(src, rim);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) x.drawImage(r, dx, dy);
  x.drawImage(tint(src, col), 0, 0);
  return c;
}

export async function openingScene(game, { replay = false, back = "title" } = {}) {
  const s = game.save;
  const cv = el("canvas.opening", { width: W, height: H });
  const ctx = cv.getContext("2d"); ctx.imageSmoothingEnabled = false;
  const caption = el("div.ocap");
  const picks = el("div.opicks", { hidden: true });
  const skip = el("button.btn.small.oskip", { onclick: () => skipAll() }, "跳過");
  const root = el("div.screen.openingscr", {}, cv, caption, picks, skip);
  show(root);

  // 素材：花園背景的天空、雲、浮空島（彩色版）；碼頭圖裡的浮空船；兩位新生
  const [art, dock] = await Promise.all([loadAreaArt("g1"), loadImg(new URL("../../assets/map/island/dock.png", import.meta.url).href)]);
  const ship1 = document.createElement("canvas"); ship1.width = 66; ship1.height = dock.height;
  const s1 = ship1.getContext("2d"); s1.drawImage(dock, 104, 0, 66, dock.height, 0, 0, 66, dock.height);
  s1.clearRect(0, 70, 7, 70);                              // 拿掉繫船的繩子
  const ship = document.createElement("canvas"); ship.width = SHIP_W; ship.height = dock.height * K;
  const sx = ship.getContext("2d"); sx.imageSmoothingEnabled = false; sx.drawImage(ship1, 0, 0, SHIP_W, ship.height);
  const hero = { girl: canvasOf(heroWalkFrame("girl", "down", "idle", 0, "#8a7cff")), boy: canvasOf(heroWalkFrame("boy", "down", "idle", 0, "#8a7cff")) };
  const shadowOf = { girl: silhouette(hero.girl, "#cbc2f2", "#fffbe8"), boy: silhouette(hero.boy, "#cbc2f2", "#fffbe8") };

  let t = 0, last = performance.now(), running = true, chosen = replay ? s.look ?? "girl" : null, pickT = null, endT = null;
  const T_SHIP_IN = 9.5, T_STOP = 12.5;                     // 船飛進來、停下來選外觀
  const lines = [
    [0.4, "數律之地。這裡的一切，都照著數字運作。"],
    [4.2, "而數學，就是真正的魔法。"],
    [6.6, "雲海上浮著一座島——魔數學院。"],
    [T_SHIP_IN + 0.3, "今年的新生，搭著浮空船來了。"],
  ];

  function skipAll() {
    if (chosen && endT == null) { endT = t; return; }        // 已經選好：直接收尾
    if (!chosen && t < T_STOP) { t = T_STOP; showPicks(); } // 還沒選：跳到選外觀
  }
  function showPicks() {
    if (replay || chosen || !picks.hidden) return;
    caption.textContent = "你是哪一位新生？（兩位的能力和故事都一樣，只有外觀不同）";
    picks.hidden = false;
    picks.replaceChildren(
      el("button.btn.gold", { onclick: () => choose("girl") }, "女生"),
      el("button.btn.gold", { onclick: () => choose("boy") }, "男生"));
  }
  function choose(look) {
    sfx("good");
    chosen = look; pickT = t; picks.hidden = true;
    s.look = look; writeSave(s);
    caption.textContent = "「歡迎來到魔數學院！」——碼頭那邊，有人在揮手。";
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    // ① 夜空：一條一條的深藍色帶＋閃爍的數字星
    const night = 1 - ease(seg(t, 5, 7));
    if (night < 1 || !art) {
      for (let i = 0; i < 6; i++) { ctx.fillStyle = ["#2a4e86", "#3b6aa8", "#5b8cc8", "#7cb0e6", "#9ccbf2", "#bfe0f8"][i]; ctx.fillRect(0, (i * H) / 6, W, H / 6 + 1); }
    }
    if (art) {
      // ② 白天：天空、雲（慢慢飄）、浮空島（輕輕浮）
      const pan = Math.round(ease(seg(t, 5, 12)) * 0);
      ctx.drawImage(art.base.color, pan, 0);
      for (const [l, sp] of [[art.cloudsLo.color, 3], [art.cloudsHi.color, 7]]) { const o = Math.round((t * sp) % W); ctx.drawImage(l, -o, 0); ctx.drawImage(l, W - o, 0); }
      ctx.drawImage(art.island.color, 0, Math.round(Math.sin((t / 4) * Math.PI * 2) * 1.2));
      // 下面一片雲海（把雲的圖往下多鋪兩層，慢慢飄）
      for (const [y0, c] of [[148, "#dfe8fa"], [164, "#e8effc"], [180, "#f0f5ff"]]) { ctx.fillStyle = c; ctx.fillRect(0, y0, W, H - y0); }
      for (const [dy, sp] of [[70, 5], [104, 9]]) { const o = Math.round((t * sp) % W); ctx.drawImage(art.cloudsLo.color, -o, dy); ctx.drawImage(art.cloudsLo.color, W - o, dy); }
      ctx.fillStyle = "#f4f8ff"; ctx.fillRect(0, 196, W, 20);
    }
    if (night > 0) {
      ctx.globalAlpha = night;
      for (let i = 0; i < 6; i++) { ctx.fillStyle = ["#0b0a22", "#12103a", "#1a1650", "#221c62", "#2a2270", "#33297c"][i]; ctx.fillRect(0, (i * H) / 6, W, H / 6 + 1); }
      // 數字星：一顆一顆淡入、閃爍、慢慢往上飄
      for (let i = 0; i < 46; i++) {
        const x = Math.round(rand(i) * (W - 10)), y = Math.round(((rand(i + 40) * H + 200 - t * (2 + rand(i + 9) * 3)) % H));
        const on = seg(t, rand(i + 3) * 3, rand(i + 3) * 3 + 0.6) * (0.55 + 0.45 * Math.sin(t * 3 + i));
        if (on <= 0.05) continue;
        ctx.globalAlpha = night * on;
        if (i % 3) { ctx.fillStyle = i % 5 ? "#fff3b0" : "#bfe8ff"; ctx.fillRect(x, y, 1, 1); if (i % 7 === 0) { ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); } }
        else glyph(ctx, "0123456789+-=37"[i % 15], x, y, i % 2 ? "#ffd35c" : "#c9b8ff");
      }
      ctx.globalAlpha = 1;
    }

    // ③ 浮空船：從左邊飛進來，停在中間；選完之後往右飛走
    if (t > T_SHIP_IN - 0.5) {
      const inU = ease(seg(t, T_SHIP_IN - 0.5, T_STOP));
      const outU = pickT != null ? ease(seg(t, pickT + 1.4, pickT + 4.2)) : endT != null ? ease(seg(t, endT, endT + 2.4)) : 0;
      const x = Math.round(-SHIP_W + (W / 2 - SHIP_W / 2 + SHIP_W) * inU + (W - 60) * outU);
      const y = Math.round(-70 + Math.sin(t * 1.4) * 2 - outU * 30);
      ctx.drawImage(ship, 0, 0, SHIP_W, RAIL, x, y, SHIP_W, RAIL);           // 欄杆以上（氣球）
      // ④ 兩位新生：從欄杆後面探出上半身
      for (const [look, hx] of [["girl", 34], ["boy", 102]]) {          // 站在船艙左右兩邊
        const lit = chosen === look ? ease(seg(t, (pickT ?? -9) + 0, (pickT ?? -9) + 0.8)) + (replay ? 1 : 0) : 0;
        const fade = chosen && chosen !== look ? ease(seg(t, pickT ?? 0, (pickT ?? 0) + 0.8)) * 0.6 : 0;
        const dx = x + hx - 16, dy = y + RAIL - 58, vis = RAIL - (dy - y) + 4;
        ctx.globalAlpha = 1 - fade;
        ctx.drawImage(shadowOf[look], 0, 0, 32, vis, dx, dy, 32, vis);
        if (lit > 0) { ctx.globalAlpha = Math.min(1, lit) * (1 - fade); ctx.drawImage(hero[look], 0, 0, 32, vis, dx, dy, 32, vis); }
        ctx.globalAlpha = 1;
      }
      ctx.drawImage(ship, 0, RAIL, SHIP_W, ship.height - RAIL, x, y + RAIL, SHIP_W, ship.height - RAIL);   // 欄杆和船身蓋在人前面
    }
    // ⑤ 淡出成白色
    const fin = pickT != null ? seg(t, pickT + 3.4, pickT + 4.4) : endT != null ? seg(t, endT + 1.6, endT + 2.6) : 0;
    if (fin > 0) { ctx.fillStyle = `rgba(255,250,235,${fin})`; ctx.fillRect(0, 0, W, H); }
    return fin >= 1;
  }

  function frame(now) {
    if (!running || !root.isConnected) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (chosen || t < T_STOP) t += dt;
    if (!chosen && t >= T_STOP) showPicks();
    if (replay && endT == null && t >= T_STOP + 1.5) endT = t;
    for (const [at, text] of lines) if (t >= at && t - dt < at) caption.textContent = text;
    if (draw()) { running = false; finish(); return; }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function finish() {
    if (replay) { game.go("settings", { from: back }); return; }
    // 到碼頭了：在大地圖上一步一步走到共鳴之井（入學典禮）
    s.world = null;
    writeSave(s);
    game.go("map", { map: "island" });
  }
}

// 像素小字（pixelfx 的 mini 字型），夜空裡的數字星
function glyph(ctx, ch, x, y, col) {
  const g = FONTS.mini.glyphs[ch];
  ctx.fillStyle = col;
  if (!g) { ctx.fillRect(x, y, 1, 1); return; }
  g.rows.forEach((r, j) => r.forEach((on, i) => { if (on) ctx.fillRect(x + i, y + j, 1, 1); }));
}
