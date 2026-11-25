// 宿舍・你的房間（企劃書 3.7）：休息（存檔、頁頁說說今天的進度）、擺在商店買的家具。
// 室內地磚還沒有參考圖（提示詞 5b），房間先用木地板色塊；家具是學院島小物件的圖（照原圖／像素重繪的設定）。

import { el, show } from "../ui.js";
import { sfx } from "../audio.js";
import { writeSave } from "../save.js";
import { SHOP } from "./shop.js";
import { talk } from "../world/talk.js";
import { heroWalkFrame } from "../../fx/hero-walk.js";
import { ATTRS } from "../data.js";

const W = 240, H = 135;
// 家具放的位置（房間畫布的座標，腳底）：照買的順序一個一個擺
const SLOTS = [[46, 70], [194, 70], [214, 124], [160, 68], [76, 70], [168, 126]];   // 避開左下角的床、中間的主角

export async function dormScene(game) {
  const s = game.save;
  const cv = el("canvas.dormcv", { width: W, height: H }), c = cv.getContext("2d");
  c.imageSmoothingEnabled = false;
  const root = el("div.screen.dorm", {}, el("div.dormtitle", {}, "宿舍・你的房間"), cv,
    el("div.dormbtns", {},
      el("button.btn", { onclick: () => rest() }, "休息一下"),
      el("button.btn", { onclick: () => game.go("shop", { tab: "furniture" }) }, "去商店買家具"),
      el("button.btn.gold", { onclick: () => game.go("map") }, "離開")));
  show(root);
  // 房間：牆、木地板、窗戶
  c.fillStyle = "#e8d8b8"; c.fillRect(0, 0, W, 54);
  c.fillStyle = "#6e4a2e"; c.fillRect(0, 50, W, 6);
  for (let y = 56; y < H; y += 10) { c.fillStyle = (y / 10) % 2 ? "#b07a4a" : "#a26e42"; c.fillRect(0, y, W, 10); c.fillStyle = "#8a5a36"; c.fillRect(0, y, W, 1); }
  c.fillStyle = "#5a3a26"; c.fillRect(96, 10, 48, 32); c.fillStyle = "#9cd6f8"; c.fillRect(99, 13, 42, 26); c.fillStyle = "#fff"; c.fillRect(100, 14, 8, 3);
  c.fillStyle = "#5a3a26"; c.fillRect(119, 13, 2, 26); c.fillRect(99, 25, 42, 2);
  c.fillStyle = "#3b4a9a"; c.fillRect(18, 96, 70, 30); c.fillStyle = "#f2c24a"; c.fillRect(18, 96, 70, 2); c.fillRect(18, 124, 70, 2);   // 床
  c.fillStyle = "#fffaf0"; c.fillRect(20, 98, 18, 12);
  // 家具
  const dir = s.settings?.art === "pixel" ? "island" : "island-raw";
  const mine = SHOP.furniture.filter((f) => (s.owned ?? []).includes(f.id));
  await Promise.all(mine.map((f, i) => new Promise((res) => {
    const im = new Image(); im.onload = () => { const [x, y] = SLOTS[i % SLOTS.length]; c.drawImage(im, Math.round(x - im.width / 2), y - im.height); res(); }; im.onerror = res;
    im.src = new URL(`../../assets/map/${dir}/${f.art}.png`, import.meta.url).href;
  })));
  // 主角站在房間中間
  const f = heroWalkFrame(s.look ?? "girl", "down", "idle", 0, ATTRS[s.attr]?.color ?? "#8a7cff");
  const hc = document.createElement("canvas"); hc.width = f.w; hc.height = f.h;
  hc.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(f.px.buffer.slice(0)), f.w, f.h), 0, 0);
  c.drawImage(hc, 120 - f.ox, 112 - f.oy);
  if (!mine.length) { c.fillStyle = "#3a2a22cc"; c.fillRect(56, 60, 128, 14); c.fillStyle = "#fff"; c.font = "9px sans-serif"; c.fillText("房間空空的……去商店買家具吧", 62, 70); }

  async function rest() {
    sfx("good");
    const d = s.diary?.[new Date().toISOString().slice(0, 10)];
    writeSave(s);
    await talk(root, [
      { who: "page", name: "頁頁", text: "呼～在床上躺一下。（進度已經存好了）" },
      { who: "page", name: "頁頁", text: d ? `今天算了 ${d.n} 題，答對 ${d.ok} 題。${d.ok >= 10 ? "好認真！" : "休息夠了再去算幾題吧！"}` : "今天還沒算題目呢。休息夠了，去花園看看吧！" },
    ]);
  }
}
