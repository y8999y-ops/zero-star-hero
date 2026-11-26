// 宿舍・你的房間（企劃書 3.7、8.8）：休息（存檔、頁頁說說今天的進度）、佈置房間。
//   ・每件家具都有預設好的位置（2026-11-26 使用者：改成自動放）：按「佈置房間」打開家具清單，按「擺放」就放到它的位置、「收起」拿掉；存在 save.room（擺出來的家具 id）
//   ・牆上的獎盃架：打倒哪一區的墨水大王，那一格就放一個金獎盃（沒打倒的是灰色的空位）
//   ・頁頁也住在房間裡，樣子跟著《萬題之書》恢復的章數變（一張紙 → 小冊子 → 精裝書 → 魔導書）
// 房間是畫布：牆、地板用程式畫（放大 4 倍、方方的），家具是原圖（跟學院全景同一套，平滑縮小），人物是像素。

import { el, show } from "../ui.js";
import { sfx } from "../audio.js";
import { writeSave } from "../save.js";
import { SHOP } from "./shop.js";
import { talk } from "../world/talk.js";
import { heroWalkFrame } from "../../fx/hero-walk.js";
import { pagepageFrame } from "../../fx/pagepage.js";
import { ATTRS, GRADES } from "../data.js";
import { pagePageLevel } from "../growth.js";

const W = 240, H = 135, K = 4;          // 房間的格子 240×135，畫布放大 4 倍（原圖家具才不會糊）
// 擺家具的位置（房間格子的座標，腳底）、家具大概多高
const SPOT = { f_urn: [46, 72, 30], f_books: [76, 72, 28], f_crystal: [160, 70, 28], f_scope: [194, 72, 30], f_lamp: [214, 126, 26], f_planter: [168, 128, 24] };
const TROPHY = ["g1", "g2", "g34", "g56", "jh"];

const imgCache = {};
const loadImg = (art) => (imgCache[art] ??= new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = new URL(`../../assets/hub/p/${art}.png`, import.meta.url).href; }));
const sprite = (f) => { const c = document.createElement("canvas"); c.width = f.w; c.height = f.h; c.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(f.px.buffer.slice(0)), f.w, f.h), 0, 0); return c; };

export async function dormScene(game) {
  const s = game.save;
  const owned = SHOP.furniture.filter((f) => (s.owned ?? []).includes(f.id));
  // 還沒佈置過：買過的全部擺出來（舊存檔是「位置 → 家具」的陣列，空位是 null）
  if (!Array.isArray(s.room)) s.room = owned.map((f) => f.id);
  s.room = [...new Set(s.room.filter((id) => owned.some((f) => f.id === id)))];

  const cv = el("canvas.dormcv", { width: W * K, height: H * K }), c = cv.getContext("2d");
  const marks = el("div.dormlist", { hidden: true });
  const editBtn = el("button.btn", { onclick: () => toggleEdit() }, "佈置房間");
  const root = el("div.screen.dorm", {}, el("div.dormtitle", {}, "宿舍・你的房間"),
    el("div.dormroom", {}, cv), marks,
    el("div.dormbtns", {},
      el("button.btn", { onclick: () => rest() }, "休息一下"),
      editBtn,
      el("button.btn", { onclick: () => game.go("shop", { tab: "furniture" }) }, "去商店買家具"),
      el("button.btn.gold", { onclick: () => { writeSave(s); game.go("map", { from: "dorm" }); } }, "離開")));
  show(root);

  async function draw() {
    c.setTransform(K, 0, 0, K, 0, 0); c.imageSmoothingEnabled = false;
    // 牆、木地板、窗戶、床
    c.fillStyle = "#e8d8b8"; c.fillRect(0, 0, W, 54);
    c.fillStyle = "#6e4a2e"; c.fillRect(0, 50, W, 6);
    for (let y = 56; y < H; y += 10) { c.fillStyle = (y / 10) % 2 ? "#b07a4a" : "#a26e42"; c.fillRect(0, y, W, 10); c.fillStyle = "#8a5a36"; c.fillRect(0, y, W, 1); }
    c.fillStyle = "#5a3a26"; c.fillRect(96, 10, 48, 32); c.fillStyle = "#9cd6f8"; c.fillRect(99, 13, 42, 26); c.fillStyle = "#fff"; c.fillRect(100, 14, 8, 3);
    c.fillStyle = "#5a3a26"; c.fillRect(119, 13, 2, 26); c.fillRect(99, 25, 42, 2);
    c.fillStyle = "#3b4a9a"; c.fillRect(18, 96, 70, 30); c.fillStyle = "#f2c24a"; c.fillRect(18, 96, 70, 2); c.fillRect(18, 124, 70, 2);
    c.fillStyle = "#fffaf0"; c.fillRect(20, 98, 18, 12);
    // 獎盃架（窗戶右邊的牆上）：打倒的王＝金獎盃
    c.fillStyle = "#6e4a2e"; c.fillRect(156, 34, 62, 3);
    TROPHY.forEach((g, i) => {
      const x = 160 + i * 12, won = (s.stars[`${g}-boss`] ?? 0) > 0;
      c.fillStyle = won ? "#f2c24a" : "#c9b89a"; c.fillRect(x, 24, 7, 5); c.fillRect(x + 2, 29, 3, 3); c.fillRect(x + 1, 32, 5, 2);
      if (won) { c.fillStyle = "#fff0b0"; c.fillRect(x + 1, 25, 2, 2); c.fillStyle = "#a8761c"; c.fillRect(x + 6, 25, 1, 4); }
    });
    // 家具（原圖，平滑縮小）：照腳底的 y 由後往前畫
    const order = s.room.filter((id) => SPOT[id]).map((id) => [SPOT[id], id]).sort((a, b) => a[0][1] - b[0][1]);
    c.imageSmoothingEnabled = true;
    for (const [[x, y, h], id] of order) {
      const im = await loadImg(SHOP.furniture.find((f) => f.id === id).art);
      if (im) { const w = (im.width / im.height) * h; c.drawImage(im, x - w / 2, y - h, w, h); }
    }
    c.imageSmoothingEnabled = false;
    // 主角、頁頁（像素）
    const hc = sprite(heroWalkFrame(s.look ?? "girl", "down", "idle", 0, ATTRS[s.attr]?.color ?? "#8a7cff"));
    c.drawImage(hc, 120 - 16, 112 - 48);
    const pf = pagepageFrame("happy", 0.3, pagePageLevel(s)), pc = sprite(pf);
    c.drawImage(pc, 98 - pf.ox, 96 - pf.oy);
  }
  await draw();

  // 佈置：下面打開一排家具卡，每件按「擺放」就自動放到預設的位置，再按「收起」拿掉
  let editing = false;
  function toggleEdit() {
    if (!owned.length) { talk(root, [{ who: "page", name: "頁頁", text: "還沒有家具耶，先去學院商店買一件吧！" }]); return; }
    editing = !editing; marks.hidden = !editing; editBtn.textContent = editing ? "佈置好了" : "佈置房間";
    if (!editing) { writeSave(s); sfx("good"); return; }
    drawList();
  }
  function drawList() {
    const all = owned.every((f) => s.room.includes(f.id));
    marks.replaceChildren(...[
      ...owned.map((f) => {
        const on = s.room.includes(f.id);
        return el("div.dormcard" + (on ? ".on" : ""), {},
          el("img", { src: new URL(`../../assets/hub/p/${f.art}.png`, import.meta.url).href, alt: "" }),
          el("span", {}, f.name),
          el(`button.btn.small${on ? "" : ".gold"}`, { onclick: () => place(f.id, !on) }, on ? "收起" : "擺放"));
      }),
      all ? null : el("button.btn.small.gold.dormall", { onclick: () => { s.room = owned.map((f) => f.id); sfx("good"); writeSave(s); draw(); drawList(); } }, "全部擺放")].filter(Boolean));
  }
  async function place(id, on) {
    s.room = on ? [...s.room, id] : s.room.filter((x) => x !== id);
    sfx(on ? "good" : "click"); writeSave(s);
    await draw(); drawList();
  }

  async function rest() {
    sfx("good");
    const d = s.diary?.[new Date().toISOString().slice(0, 10)];
    writeSave(s);
    const cups = TROPHY.filter((g) => (s.stars[`${g}-boss`] ?? 0) > 0).length;
    const todayMsg = d ? `今天已經答對 ${d.ok} 題${d.ok >= 10 ? "，超認真！" : "！"}` : "休息夠了再去練幾題吧！";
    const cupMsg = cups === 5 ? "五座獎盃全集齊了！" : cups ? `獎盃架上已經有 ${cups} 座獎盃囉。` : "";
    await talk(root, [{ who: "page", name: "頁頁", text: `呼～躺一下好舒服。${todayMsg}${cupMsg}` }]);
  }
}
