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
    el("div.looks", {},
      el("button.btn.card", { onclick: () => pickLook("girl") }, heroCanvas("girl"), "女生"),
      el("button.btn.card", { onclick: () => pickLook("boy") }, heroCanvas("boy"), "男生")),
  ));
}

export async function introScene(game, { replay = false, back = "title" } = {}) {
  const root = el("div.screen.story", {}, el("div.storybg"));
  show(root);
  await dialog(root, [
    { who: "", text: "數律之地——萬物都照著數字運轉，而數學就是真正的魔法。" },
    { who: "圓周院長", text: "歡迎來到魔數學院！我是圓周院長，圓周率是三點一四一五九二六五三五八……" },
    { who: "", text: "院長講了很久很久……" },
    { who: "圓周院長", text: "咳！總之，新生請先站上「共鳴之井」，讓井水看看你喜歡怎麼想。" },
  ]);
  // 從設定重看時，看完回設定，不重做入學流程
  if (replay) game.go("settings", { from: back });
  else game.go("resonance");
}

// 典禮後、第一場戰鬥後的劇情：改成動畫演出，在 scenes/story.js

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
