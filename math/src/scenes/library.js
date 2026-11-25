// 千頁圖書館・大廳（企劃書 C3、C6）：《萬題之書》和頁頁的家，沒有被墨水污染。
// 這裡放錯題本、成長日記、萬題之書（看頁頁的樣子和找回的章數）、往上層書庫（二年級區域）。
// 室內地磚還沒有參考圖（待辦 A9），先用暫用的畫面：暖色木頭背景＋書架色塊。

import { el, show } from "../ui.js";
import { sfx } from "../audio.js";
import { GRADES } from "../data.js";
import { bookChapters, pagePageForm } from "../growth.js";
import { reviewPanel, growthPanel } from "./map.js";
import { talk } from "../world/talk.js";
import { pagepageFrame } from "../../fx/pagepage.js";

export function libraryScene(game) {
  const s = game.save;
  const page = el("canvas.libpage", { width: 32, height: 40 });
  const ctx = page.getContext("2d");
  let t = 0, alive = true;
  const tick = () => {
    if (!alive || !page.isConnected && t > 0.2) return;
    const f = pagepageFrame("idle", t % 1);
    ctx.clearRect(0, 0, 32, 40);
    ctx.putImageData(new ImageData(new Uint8ClampedArray(f.px.buffer.slice(0)), f.w, f.h), 0, 0);
    t += 1 / 12; setTimeout(tick, 1000 / 12);
  };
  tick();
  const review = Object.keys(s.review).length;
  const spot = (icon, name, desc, onclick) => el("button.btn.libspot", { onclick: () => { sfx("click"); onclick(); } }, el("span.icon", {}, icon), el("span.lname", {}, name), el("span.ldesc", {}, desc));
  const root = el("div.screen.library", {},
    el("div.libtitle", {}, "千頁圖書館・大廳"),
    el("div.shelves"),
    el("div.librow", {},
      spot("📕", "錯題本", review ? `還有 ${review} 種題目沒算完` : "目前沒有", () => reviewPanel(game)),
      spot("📔", "成長日記", "熟練度星星、最近 7 天", () => growthPanel(game)),
      spot("📖", "萬題之書", `找回 ${bookChapters(s)} 章`, () => bookTalk()),
      spot("🪜", "上層書庫", `${GRADES.g2.name}的區域`, () => upstairs())),
    el("div.libfoot", {}, page, el("button.btn.gold", { onclick: () => { alive = false; game.go("map", { map: "island", from: "library" }); } }, "離開圖書館")),
  );
  show(root);

  async function bookTalk() {
    await talk(root, [
      { who: "page", name: "頁頁", text: `這就是《萬題之書》！我是從裡面掉出來的那一頁。現在我是「${pagePageForm(s)}」的樣子。` },
      { who: "page", name: "頁頁", text: "每當你把一門數學魔法練到精通（成長日記裡的 ★★★），那一章的書頁就會飛回來，我也會跟著長大喔！" },
    ]);
  }
  async function upstairs() {
    const r = await talk(root, [{ who: "page", name: "頁頁", text: "上層書庫的書架高到看不見頂，書都被墨水弄亂了。二年級的題目在那裡，要去嗎？（區域地圖還在整理，先從關卡選單進去）" }], ["打開學院選單", "先不要"]);
    if (r === 0) { alive = false; game.go("menu"); }
  }
}
