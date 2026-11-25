// 標題、選外觀、入學劇情（世界觀第 7 節 1～2）。

import { el, show, dialog } from "../ui.js";
import { sfx } from "../audio.js";
import { resetSave, writeSave } from "../save.js";
import { heroFrame } from "../../fx/hero.js";

export function titleScene(game) {
  const s = game.save;
  const started = !!s.attr;
  show(el("div.screen.title", {},
    el("div.logo", {}, el("span.l1", {}, "魔數"), el("span.l2", {}, "學院")),
    el("div.tag", {}, "數學是一種魔法"),
    el("button.btn.gold.big", { onclick: () => { sfx("click"); started ? game.go("map") : game.go("look"); } }, started ? "繼續冒險" : "開始入學"),
    started ? el("button.btn.red.small", { onclick: () => { if (confirm("確定要重新入學嗎？所有進度都會清除。")) { game.save = resetSave(); game.go("look"); } } }, "重新入學") : null,
    el("div.foot", {}, "題庫：TMMLU+（MIT）、Calc-ape210k（MIT），已改寫成學院情境"),
  ));
}

export function lookScene(game) {
  const pickLook = (look) => { sfx("click"); game.save.look = look; writeSave(game.save); game.go("intro"); };
  show(el("div.screen.look", {},
    el("h2", {}, "你是哪一位新生？"),
    el("p.sub", {}, "兩位的能力和故事都一樣，只有外觀不同。"),
    el("div.looks", {},
      el("button.btn.card", { onclick: () => pickLook("girl") }, heroCanvas("girl"), "女生"),
      el("button.btn.card", { onclick: () => pickLook("boy") }, heroCanvas("boy"), "男生")),
  ));
}

export async function introScene(game) {
  const root = el("div.screen.story", {}, el("div.storybg"));
  show(root);
  await dialog(root, [
    { who: "", text: "數律之地。這裡的一切都照數字運作，而數學，就是真正的魔法。" },
    { who: "圓周院長", text: "歡迎來到魔數學院！我是院長。圓周率是三點一四一五九二六五三五八……" },
    { who: "", text: "（院長講了很久很久。）" },
    { who: "圓周院長", text: "咳。總之，新生要先到「共鳴之井」，讓井水看看你喜歡怎麼想。" },
  ]);
  game.go("resonance");
}

export async function afterResonance(game) {
  const root = el("div.screen.story", {}, el("div.storybg.ink"));
  show(root);
  await dialog(root, [
    { who: "", text: "砰！——典禮結束的那一刻，地下禁書庫傳來巨響。" },
    { who: "", text: "收留「被放棄的題目」的《無解之書》裝不下了。墨水噴滿整座學院，變成一隻隻墨水怪。" },
    { who: "頁頁", text: "哇啊——！你、你好！我是《萬題之書》掉出來的一頁，叫我頁頁！" },
    { who: "頁頁", text: "墨水怪身上掛著當年沒人算完的題目。只要親手把它算完，墨水就會散開！" },
    { who: "頁頁", text: "別怕算錯，算錯只是咒語還沒成形，再寫一次就好。我們走吧，小魔數師！" },
  ]);
  game.save.seenIntro = true;
  writeSave(game.save);
  game.go("map");
}

// 選外觀用的小預覽：待機動畫，屬性還沒決定，先用學院紫
function heroCanvas(look) {
  const c = el("canvas.heroPreview");
  c.width = 32; c.height = 50;
  const ctx = c.getContext("2d");
  let t = 0;
  const tick = () => {
    if (!c.isConnected && t > 0) return;
    const f = heroFrame(look, "idle", t, "#8a7cff");
    ctx.clearRect(0, 0, 32, 50);
    ctx.putImageData(new ImageData(new Uint8ClampedArray(f.px.buffer.slice(0)), f.w, f.h), 0, 0);
    t += 1 / 12;
    setTimeout(tick, 1000 / 12);
  };
  tick();
  return c;
}
