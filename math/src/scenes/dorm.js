// 宿舍・你的房間（企劃書 3.7、8.8）：休息（存檔、頁頁說說今天的進度）、佈置房間。
//   ・六個擺家具的位置，按「佈置房間」之後點位置，就會輪流換成你買過的家具（或空著）；存在 save.room
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
const SLOTS = [[46, 72, 30], [194, 72, 30], [214, 126, 26], [160, 70, 28], [76, 72, 28], [168, 128, 24]];
const TROPHY = ["g1", "g2", "g34", "g56", "jh"];

const imgCache = {};
const loadImg = (art) => (imgCache[art] ??= new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = new URL(`../../assets/hub/p/${art}.png`, import.meta.url).href; }));
const sprite = (f) => { const c = document.createElement("canvas"); c.width = f.w; c.height = f.h; c.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(f.px.buffer.slice(0)), f.w, f.h), 0, 0); return c; };

export async function dormScene(game) {
  const s = game.save;
  const owned = SHOP.furniture.filter((f) => (s.owned ?? []).includes(f.id));
  // 還沒佈置過：照買的順序擺
  if (!Array.isArray(s.room)) s.room = SLOTS.map((_, i) => owned[i]?.id ?? null);
  s.room = s.room.map((id) => (owned.some((f) => f.id === id) ? id : null));

  const cv = el("canvas.dormcv", { width: W * K, height: H * K }), c = cv.getContext("2d");
  const marks = el("div.dormmarks", { hidden: true });
  const editBtn = el("button.btn", { onclick: () => toggleEdit() }, "佈置房間");
  const root = el("div.screen.dorm", {}, el("div.dormtitle", {}, "宿舍・你的房間"),
    el("div.dormroom", {}, cv, marks),
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
    const order = SLOTS.map((p, i) => [p, s.room[i]]).filter(([, id]) => id).sort((a, b) => a[0][1] - b[0][1]);
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
    if (!owned.length) { c.fillStyle = "#3a2a22cc"; c.fillRect(56, 60, 128, 14); c.fillStyle = "#fff"; c.font = "9px sans-serif"; c.fillText("房間空空的……去商店買家具吧", 62, 70); }
  }
  await draw();

  // 佈置：每個位置一個按鈕，點一下換下一件（空著 → 家具 1 → 家具 2 …）
  let editing = false;
  function toggleEdit() {
    if (!owned.length) { talk(root, [{ who: "page", name: "頁頁", text: "還沒有家具耶，先去學院商店買一件吧！" }]); return; }
    editing = !editing; marks.hidden = !editing; editBtn.textContent = editing ? "佈置好了" : "佈置房間";
    if (!editing) { writeSave(s); sfx("good"); return; }
    marks.replaceChildren(...SLOTS.map(([x, y, h], i) => el("button.btn.small.dormslot", {
      style: { left: `${(x / W) * 100}%`, top: `${((y - h / 2) / H) * 100}%` },
      onclick: async () => {
        // 同一件家具只能擺一個地方：別的位置已經擺的跳過
        const list = [null, ...owned.map((f) => f.id).filter((id) => id === s.room[i] || !s.room.includes(id))], k = (list.indexOf(s.room[i]) + 1) % list.length;
        s.room[i] = list[k]; sfx("click"); await draw();
      },
    }, `${i + 1}`)));
  }

  async function rest() {
    sfx("good");
    const d = s.diary?.[new Date().toISOString().slice(0, 10)];
    writeSave(s);
    const cups = TROPHY.filter((g) => (s.stars[`${g}-boss`] ?? 0) > 0).length;
    await talk(root, [
      { who: "page", name: "頁頁", text: "呼～在床上躺一下。（進度已經存好了）" },
      { who: "page", name: "頁頁", text: d ? `今天算了 ${d.n} 題，答對 ${d.ok} 題。${d.ok >= 10 ? "好認真！" : "休息夠了再去算幾題吧！"}` : "今天還沒算題目呢。休息夠了，去學院練習吧！" },
      { who: "page", name: "頁頁", text: cups ? `牆上已經有 ${cups} 個獎盃了！${cups < 5 ? `還差${TROPHY.filter((g) => !(s.stars[`${g}-boss`] > 0)).map((g) => GRADES[g].area).join("、")}。` : "五區全部恢復色彩，你是學院的英雄！"}` : "牆上的獎盃架還空空的。打倒墨水大王，就會多一個獎盃喔。" },
    ]);
  }
}
