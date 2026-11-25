// 介面小工具：建立元素、切換畫面、頁頁的台詞框、飄字。

export const $ = (sel, root = document) => root.querySelector(sel);

/** el("button.btn.gold", { onclick }, "文字", child…) */
export function el(spec, props = {}, ...kids) {
  const [tag, ...cls] = spec.split(".");
  const n = document.createElement(tag || "div");
  if (cls.length) n.className = cls.join(" ");
  for (const [k, v] of Object.entries(props ?? {})) {
    if (k === "style" && typeof v === "object") for (const [sk, sv] of Object.entries(v)) sk.startsWith("--") ? n.style.setProperty(sk, sv) : (n.style[sk] = sv);
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) n.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) n.append(k.nodeType ? k : String(k));
  return n;
}

/** 換畫面：清空 #app 放進新的內容 */
export function show(node) {
  const app = $("#app");
  app.replaceChildren(node);
  app.scrollTop = 0;
}

/** 一句一句播放的對話。lines：[{ who, text }]；全部播完 resolve。 */
export function dialog(container, lines) {
  return new Promise((done) => {
    let i = 0;
    const who = el("div.who"), text = el("div.text"), hint = el("div.next", {}, "點一下繼續 ▼");
    const box = el("div.dialog", { onclick: next }, who, text, hint);
    const skip = el("button.btn.small.skip", { onclick: (e) => { e.stopPropagation(); box.remove(); skip.remove(); done(); } }, "跳過");
    container.append(box, skip);
    function next() {
      if (i >= lines.length) { box.remove(); skip.remove(); done(); return; }
      who.textContent = lines[i].who ?? "";
      text.textContent = lines[i].text;
      i++;
    }
    next();
  });
}

/** 在某個元素上方飄出一段字（＋10 經驗之類） */
export function floatText(parent, text, cls = "") {
  const n = el(`div.float.${cls}`, {}, text);
  parent.append(n);
  setTimeout(() => n.remove(), 1400);
}

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
