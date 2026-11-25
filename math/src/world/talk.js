// NPC 對話框：頭像、名字、一個字一個字跑出來的台詞、最後可以有選項。
// talk(container, lines, choices) → Promise：沒有選項時 resolve(null)，有選項時 resolve(選到第幾個)。
// lines：[{ who: "dean" | "page" | null, name, text }]

import { el } from "../ui.js";
import { sfx } from "../audio.js";
import { deanFrame } from "../../fx/dean.js";
import { pagepageFrame } from "../../fx/pagepage.js";
import { mentorFrame } from "../../fx/mentor.js";
import { heroWalkFrame } from "../../fx/hero-walk.js";
import { STUDENTS } from "./island-life.js";

// 頭像：角色圖上半身放大 3 倍
const FACE = {
  dean: { fn: () => deanFrame("talk", 0), box: [4, 0, 32, 32] },
  page: { fn: () => pagepageFrame("talk", 0), box: [0, 0, 32, 32] },
  ...Object.fromEntries(["fire", "water", "ice", "forest", "thunder"].map((k) => [`m_${k}`, { fn: () => mentorFrame(k, "talk", 0), box: [4, 0, 32, 34] }])),
  ...Object.fromEntries(STUDENTS.map((st) => [st.id, { fn: () => heroWalkFrame(st.look, "down", "idle", 0, st.attr, st.hair), box: [0, 0, 32, 32] }])),
};
const faceCache = {};
function portrait(id) {
  const F = FACE[id];
  if (!F) return null;
  if (!faceCache[id]) {
    const f = F.fn(), src = document.createElement("canvas"); src.width = f.w; src.height = f.h;
    src.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(f.px.buffer.slice(0)), f.w, f.h), 0, 0);
    const [x, y, w, h] = F.box, c = document.createElement("canvas"); c.width = w; c.height = h;
    c.getContext("2d").drawImage(src, x, y, w, h, 0, 0, w, h);
    faceCache[id] = c;
  }
  const c = document.createElement("canvas"); c.width = faceCache[id].width; c.height = faceCache[id].height;
  c.getContext("2d").drawImage(faceCache[id], 0, 0); c.className = "face";
  return c;
}

export function talk(container, lines, choices = null, { onLine } = {}) {
  return new Promise((done) => {
    let i = -1, shown = 0, full = "", timer = null;
    const faceBox = el("div.facebox"), name = el("div.who"), text = el("div.text"), hint = el("div.next", {}, "▼");
    const opts = el("div.choices");
    const box = el("div.talk", { onclick: () => advance() }, faceBox, el("div.tbody", {}, name, text, opts), hint);
    container.append(box);
    const typing = () => shown < full.length;
    function tick() {
      shown = Math.min(full.length, shown + 1);
      text.textContent = full.slice(0, shown);
      if (shown % 3 === 1) sfx("blip");
      if (typing()) timer = setTimeout(tick, 28);
      else if (i === lines.length - 1 && choices) showChoices();
    }
    function next() {
      i++;
      if (i >= lines.length) { box.remove(); done(null); return; }
      const L = lines[i];
      faceBox.replaceChildren(...[portrait(L.who)].filter(Boolean));
      faceBox.hidden = !FACE[L.who];
      name.textContent = L.name ?? "";
      full = L.text; shown = 0; text.textContent = "";
      hint.hidden = !!(choices && i === lines.length - 1);
      onLine?.(L);
      clearTimeout(timer); tick();
    }
    function showChoices() {
      opts.replaceChildren(...choices.map((c, k) => el("button.btn.small" + (k === 0 ? ".gold" : ""), { onclick: (e) => { e.stopPropagation(); sfx("click"); box.remove(); done(k); } }, c)));
    }
    function advance() {
      if (typing()) { clearTimeout(timer); shown = full.length - 1; tick(); return; }
      if (choices && i === lines.length - 1) return;      // 要選一個
      next();
    }
    next();
  });
}
