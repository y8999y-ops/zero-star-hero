// 標題、選外觀、入學劇情（世界觀第 7 節 1～2）。

import { el, show, dialog } from "../ui.js";
import { sfx } from "../audio.js";
import { resetSave, writeSave } from "../save.js";
import { heroFrame } from "../../fx/hero.js";
import { ATTRS } from "../data.js";
import { loadAreaArt } from "../battle/areaart.js";

export function titleScene(game) {
  const s = game.save;
  const started = !!s.attr;
  const bg = el("canvas.titlebg", { width: 384, height: 216 });
  show(el("div.screen.title", {}, bg,
    el("div.logo", {}, el("span.l1", {}, "魔數"), el("span.l2", {}, "學院")),
    el("div.tag", {}, "數學是一種魔法"),
    el("button.btn.gold.big", { onclick: () => { sfx("click"); game.go("map"); } }, started ? "繼續冒險" : "開始入學"),
    el("button.btn", { onclick: () => game.go("settings", { from: "title" }) }, "設定"),
    started ? el("button.btn.red.small", { onclick: () => { if (confirm("確定要重新入學嗎？所有進度都會清除。")) { game.save = resetSave(); game.go("opening"); } } }, "重新入學") : null,
    el("div.foot", {}, "題庫：TMMLU+（MIT）、Calc-ape210k（MIT），已改寫成學院情境　字型：俐方體 11 號（OFL）"),
  ));
  titleBackground(bg);
}

// 標題背景：星芽花園背景圖的天空、雲（慢慢飄）、浮在空中的學院（輕輕浮），還有往上飄的光點
async function titleBackground(cv) {
  const art = await loadAreaArt("g1");
  if (!art || !cv.isConnected) return;
  const g = cv.getContext("2d"); g.imageSmoothingEnabled = false;
  let t = 0, last = performance.now();
  const rand = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const frame = (now) => {
    if (!cv.isConnected) return;
    t += Math.min(0.05, (now - last) / 1000); last = now;
    g.drawImage(art.base.color, 0, 0);
    for (const [l, sp] of [[art.cloudsLo.color, 3], [art.cloudsHi.color, 7]]) { const o = Math.round((t * sp) % 384); g.drawImage(l, -o, 0); g.drawImage(l, 384 - o, 0); }
    g.drawImage(art.island.color, 0, Math.round(Math.sin((t / 4) * Math.PI * 2) * 1.5) + 10);
    for (const [dy, sp] of [[80, 5], [110, 9]]) { const o = Math.round((t * sp) % 384); g.drawImage(art.cloudsLo.color, -o, dy); g.drawImage(art.cloudsLo.color, 384 - o, dy); }
    g.fillStyle = "rgba(23,18,42,0.35)"; g.fillRect(0, 0, 384, 216);                         // 壓暗一點，字比較清楚
    for (let i = 0; i < 30; i++) {
      const u = (t * (0.05 + rand(i) * 0.08) + rand(i + 7)) % 1, x = Math.round(rand(i + 3) * 384 + Math.sin(t + i) * 4), y = Math.round(216 - u * 230);
      if (Math.sin(t * 3 + i) < -0.4) continue;
      g.fillStyle = i % 3 ? "#fff3b0" : "#c9b8ff"; g.fillRect(x, y, 1, 1);
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
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

export async function introScene(game, { replay = false, back = "title" } = {}) {
  const root = el("div.screen.story", {}, el("div.storybg"));
  show(root);
  await dialog(root, [
    { who: "", text: "數律之地。這裡的一切都照數字運作，而數學，就是真正的魔法。" },
    { who: "圓周院長", text: "歡迎來到魔數學院！我是院長。圓周率是三點一四一五九二六五三五八……" },
    { who: "", text: "（院長講了很久很久。）" },
    { who: "圓周院長", text: "咳。總之，新生要先到「共鳴之井」，讓井水看看你喜歡怎麼想。" },
  ]);
  // 從設定重看時，看完回設定，不重做入學流程
  if (replay) game.go("settings", { from: back });
  else game.go("resonance");
}

export async function afterResonance(game) {
  const root = el("div.screen.story", {}, el("div.storybg.ink"));
  show(root);
  await dialog(root, [
    { who: "", text: "砰！——典禮結束的那一刻，地下禁書庫傳來巨響。" },
    { who: "", text: "收留「被放棄的題目」的《無解之書》裝不下了。墨水噴滿整座學院，變成一隻隻墨水怪。" },
    { who: "頁頁", text: "哇啊——！你、你好！我是《萬題之書》掉出來的一頁，叫我頁頁！" },
    { who: "頁頁", text: "墨水怪身上掛著當年沒人算完的題目。只要親手把它算完，墨水就會散開！" },
    { who: "", text: "咕嘟、咕嘟……共鳴之井旁邊的墨水聚成一團，冒出了兩隻圓圓的眼睛。" },
    { who: "頁頁", text: "第一隻墨水怪！別怕，我一步一步教你。用你剛亮起來的數晶，把它身上的題目算完！" },
  ]);
  writeSave(game.save);
  game.go("battle", { grade: "g1", mode: "tutorial" });
}

/** 第一場戰鬥打完：頁頁稱讚、院長跑來，然後回到共鳴之井旁邊（企劃書 3.6） */
export async function afterTutorial(game, r) {
  const root = el("div.screen.story", {}, el("div.storybg"));
  show(root);
  const a = ATTRS[game.save.attr];
  await dialog(root, [
    { who: "頁頁", text: "成功了！墨水散開了！你看，地上那一塊又有顏色了。" },
    { who: "頁頁", text: r.wrong ? `有 ${r.wrong} 題我先記進錯題本了，之後再回來算完它就好。算不完可以先放著，但一定要回來喔！` : "五題全對！你天生就是魔數師耶！" },
    { who: "圓周院長", text: `呼、呼……我跑來了！剛剛那道${a?.school ?? ""}的光是你嗎？太好了，學院有救了！` },
    { who: "圓周院長", text: "墨水跑到學院各處去了，最近的是西邊的星芽花園。先在廣場四處看看，準備好就出發吧！" },
  ]);
  const s = game.save;
  s.seenIntro = true;
  s.flags = { ...(s.flags ?? {}), metDean: true };
  s.world = { map: "island", x: 430, y: 345, dir: "down" };   // 共鳴之井旁邊
  writeSave(s);
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
