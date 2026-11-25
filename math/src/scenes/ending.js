// 結局（世界觀第 7 節第 4 點、企劃書 D5）：最終戰打完（第一次打倒地下禁書庫的墨水大王・真身）才會播。
// 一頁一頁的畫面（點一下下一頁）：墨水大王縮成一滴墨 → 《無解之書》變乾淨 → 跟《萬題之書》合成一本 →
// 院長宣布新規定（＝錯題本的由來）→ 頁頁道謝 → 學院全部恢復色彩、「完」。看完回到學院全景（遊戲可以繼續玩）。
// 背景用星芽花園的天空原圖（漸漸從灰變彩色），中間是千頁圖書館的原圖；頁頁、墨水滴是像素畫布。

import { el, show } from "../ui.js";
import { sfx } from "../audio.js";
import { writeSave } from "../save.js";
import { pagepageFrame } from "../../fx/pagepage.js";
import { inkDropFrame } from "../../fx/ink-drop.js";

const A = (p) => new URL(`../../assets/${p}`, import.meta.url).href;
const D = (text) => ({ who: "院長", text }), P = (text) => ({ who: "頁頁", text }), N = (text) => ({ who: "", text });

const PAGES = [
  { gray: 1, ink: true, lines: [N("最後一題算完的那一刻，墨水大王一圈一圈縮小……"), N("最後變成一滴小小的墨水，安安靜靜地躺在禁書庫的地上。")] },
  { gray: 0.7, ink: true, lines: [N("那滴墨水小聲地說：「原來……真的有人會回來，把我算完。」"), P("我們一直都會回來的！")] },
  { gray: 0.4, book: true, lines: [N("《無解之書》的每一頁都變乾淨了。它慢慢飛起來，飛到千頁圖書館的大廳——"), N("跟《萬題之書》疊在一起，合成了一本。")] },
  { gray: 0.15, book: true, lines: [D("從今天起，學院多一條新規定："), D("「算不完的題目可以先放著，但一定要有人回來算完。」"), N("——這就是「錯題本」的由來。")] },
  { gray: 0, page: true, lines: [P("學院所有的顏色都回來了！花開對了瓣數，鐘塔走對了時間。"), P("謝謝你，見習魔數師。以後也一起來學院練習吧！")] },
  { gray: 0, end: true, lines: [N("完"), N("《魔數學院》")] },
];

export function endingScene(game) {
  const s = game.save;
  s.flags = { ...(s.flags ?? {}), ending: true }; writeSave(s);
  const bg = el("div.endbg", { style: { backgroundImage: `url(${A("battle-hd/garden/back.jpg")})` } });
  const lib = el("img.endlib", { src: A("hub/library.png"), alt: "" });
  const glow = el("div.endglow");
  const cv = el("canvas.endsp", { width: 40, height: 50 });
  const box = el("div.endtext");
  const hint = el("div.endhint", {}, "點一下繼續");
  const root = el("div.screen.endscr", {}, bg, lib, glow, cv, box, hint);
  show(root);

  let i = -1, t = 0, alive = true;
  const g = cv.getContext("2d");
  const tick = () => {
    if (!alive || !root.isConnected) return;
    t += 1 / 10;
    const P = PAGES[Math.max(0, i)], f = P.ink ? inkDropFrame("idle", t % 1.2) : pagepageFrame(P.page || P.end ? "happy" : "idle", t % 1);
    cv.width = f.w; cv.height = f.h;
    g.putImageData(new ImageData(new Uint8ClampedArray(f.px.buffer.slice(0)), f.w, f.h), 0, 0);
    setTimeout(tick, 100);
  };
  function next() {
    if (i >= PAGES.length - 1) { alive = false; game.go("map", { from: "library" }); return; }
    i++;
    const P = PAGES[i];
    sfx(i === PAGES.length - 1 ? "level" : i === 2 ? "restore" : "click");
    bg.style.filter = `grayscale(${P.gray}) brightness(${1 - 0.25 * P.gray})`;
    lib.style.filter = bg.style.filter;
    glow.classList.toggle("on", !!P.book);
    root.classList.toggle("last", !!P.end);
    box.replaceChildren(...P.lines.map((L) => el("p", {}, L.who ? el("b", {}, `${L.who}：`) : null, L.text)));
    hint.textContent = P.end ? "點一下回到學院（還可以繼續玩）" : "點一下繼續";
  }
  root.addEventListener("click", next);
  next(); tick();
}
