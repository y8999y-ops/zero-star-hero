// 千頁圖書館・大廳（企劃書 C3、C6）：《萬題之書》和頁頁的家，沒有被墨水污染。
// 這裡放魔法教室（不會的題目來學，scenes/lesson.js）、錯題本、成長日記、萬題之書（看頁頁的樣子和找回的章數）、往上層書庫（二年級的區域）。
// 室內地磚還沒有參考圖（待辦 A9），先用暫用的畫面：暖色木頭背景＋書架色塊。

import { el, show } from "../ui.js";
import { sfx } from "../audio.js";
import { GRADES } from "../data.js";
import { bookChapters, pagePageForm, pagePageLevel } from "../growth.js";
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
    const f = pagepageFrame("idle", t % 1, pagePageLevel(s));
    ctx.clearRect(0, 0, 32, 40);
    ctx.putImageData(new ImageData(new Uint8ClampedArray(f.px.buffer.slice(0)), f.w, f.h), 0, 0);
    t += 1 / 12; setTimeout(tick, 1000 / 12);
  };
  tick();
  const review = Object.keys(s.review).length;
  // 圖示用學院島的小物件圖（像素），不用表情符號
  const icon = (art) => el("img.libicon", { src: new URL(`../../assets/hub/p/${art}.png`, import.meta.url).href, alt: "" });
  const spot = (art, name, desc, onclick) => el("button.btn.libspot", { onclick: () => { sfx("click"); onclick(); } }, icon(art), el("span.lname", {}, name), desc ? el("span.ldesc", {}, desc) : null);
  const root = el("div.screen.library", {},
    el("div.libtitle", {}, "千頁圖書館・大廳"),
    el("div.shelves"),
    el("div.librow", {},
      spot("scroll", "魔法教室", "", () => { alive = false; game.go("lessons"); }),
      spot("books", "錯題本", review ? `${review}` : "", () => reviewPanel(game)),
      spot("board", "成長日記", "", () => growthPanel(game)),
      spot("flag", "墨水圖鑑", `${Object.keys(s.dex ?? {}).length} / 12`, () => { alive = false; game.go("dex"); }),
      spot("crystal", "萬題之書", `${bookChapters(s)} 章`, () => bookTalk()),
      spot("sign", "上層書庫", GRADES.g2.name, () => { alive = false; game.go("area", { grade: "g2" }); }),
      spot("chest", "地下禁書庫", GRADES.jh.name, () => { alive = false; game.go("area", { grade: "jh" }); })),
    el("div.libfoot", {}, page, el("button.btn.gold", { onclick: () => { alive = false; game.go("map", { map: "island", from: "library" }); } }, "離開圖書館")),
  );
  show(root);

  async function bookTalk() {
    await talk(root, [
      { who: "page", name: "頁頁", text: `這就是《萬題之書》！現在的我已經是「${pagePageForm(s)}」了。每精通一個單元，散落的書頁就會飛回來，我也會跟著長大喔！` },
    ]);
  }
}
