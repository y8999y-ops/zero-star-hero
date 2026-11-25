// 墨水圖鑑（企劃書 E5）：淨化過的墨水怪會記下來（save.dex：種類 → 淨化幾次）。
// 還沒遇過的顯示黑影和「？？？」；遇過的顯示像素圖、名字、在哪一區、一句介紹、淨化次數。從圖書館大廳打開。

import { el, show } from "../ui.js";
import { inkDropFrame } from "../../fx/ink-drop.js";
import { crookedFlowerFrame } from "../../fx/crooked-flower.js";
import { scatterPageFrame } from "../../fx/scatter-page.js";
import { doodleBatFrame } from "../../fx/doodle-bat.js";
import { chaosClockFrame } from "../../fx/chaos-clock.js";
import { crystalBugFrame } from "../../fx/crystal-bug.js";
import { minusShadeFrame } from "../../fx/minus-shade.js";
import { inkKingBabyFrame } from "../../fx/ink-king-baby.js";
import { inkKingPageFrame, inkKingGearFrame, inkKingCrystalFrame, inkKingTrueFrame } from "../../fx/ink-king-forms.js";

export const DEX = [
  { id: "ink", fn: inkDropFrame, name: "墨水滴", where: "星芽花園", text: "爆炸後第一隻成形的墨水怪。身上掛的是最簡單的題目。" },
  { id: "flower", fn: crookedFlowerFrame, name: "歪瓣花", where: "星芽花園", text: "被墨水染到的花，瓣數不對，還有兩瓣歪掉了。" },
  { id: "pages", fn: scatterPageFrame, name: "散頁怪", where: "千頁圖書館", text: "散掉的書頁被墨水黏成一團，滾著前進。" },
  { id: "bat", fn: doodleBatFrame, name: "塗鴉蝙蝠", where: "書庫、鐘塔、禁書庫", text: "書頁空白處的亂畫活了過來，飛出書外。" },
  { id: "tick", fn: chaosClockFrame, name: "亂針鐘", where: "刻度鐘塔", text: "指針亂轉的懷錶，時間一下快一下慢。" },
  { id: "bug", fn: crystalBugFrame, name: "碎晶蟲", where: "分晶溫室", text: "數晶果實的碎片被墨水黏成毛毛蟲，一拱一拱地爬。" },
  { id: "shade", fn: minusShadeFrame, name: "負號影", where: "地下禁書庫", text: "「−」形狀的影子，總是倒著走，偶爾回頭偷看你。" },
  { id: "king", fn: inkKingBabyFrame, name: "墨水大王・幼體", where: "星芽花園", text: "頭上插著歪花的大墨水滴，生氣中帶點委屈。", boss: true },
  { id: "kingPage", fn: inkKingPageFrame, name: "墨水大王・書頁鎧甲", where: "千頁圖書館", text: "戴著攤開的厚書當頭盔，拿著羽毛筆。", boss: true },
  { id: "kingGear", fn: inkKingGearFrame, name: "墨水大王・齒輪型", where: "刻度鐘塔", text: "背上的大齒輪一直轉，右眼戴著鐘面眼鏡。", boss: true },
  { id: "kingCrystal", fn: inkKingCrystalFrame, name: "墨水大王・晶刺型", where: "分晶溫室", text: "背上長滿會閃光的水晶刺。", boss: true },
  { id: "kingTrue", fn: inkKingTrueFrame, name: "墨水大王・真身", where: "地下禁書庫", text: "《無解之書》的心。其實很怕沒有人會回來把題目算完。", boss: true },
];

function canvasOf(fn, dark) {
  const f = fn("idle", 0.3), c = el("canvas.dexsp", { width: f.w, height: f.h }), g = c.getContext("2d");
  g.putImageData(new ImageData(new Uint8ClampedArray(f.px.buffer.slice(0)), f.w, f.h), 0, 0);
  if (dark) { g.globalCompositeOperation = "source-in"; g.fillStyle = "#1c1533"; g.fillRect(0, 0, f.w, f.h); }
  return c;
}

export function dexScene(game) {
  const s = game.save, dex = s.dex ?? {};
  const seen = DEX.filter((d) => dex[d.id]).length;
  show(el("div.screen.dex", {},
    el("h2", {}, "墨水圖鑑", el("span.dexn", {}, `${seen} / ${DEX.length}`)),
    el("div.dexgrid", {}, ...DEX.map((d) => {
      const n = dex[d.id] ?? 0;
      return el("div.dexcard" + (d.boss ? ".boss" : "") + (n ? "" : ".unknown"), {},
        canvasOf(d.fn, !n),
        el("div.dexname", {}, n ? d.name : "？？？"),
        el("div.dexwhere", {}, d.where),
        el("div.dextext", {}, n ? d.text : "還沒有遇過。"),
        n ? el("div.dexcount", {}, `淨化 ${n} 次`) : null);
    })),
    el("button.btn.gold", { onclick: () => game.go("library") }, "回圖書館大廳")));
}
