// 對話框（城鎮用）：畫面下方的面板，顯示說話的人、一句一句的台詞、選項按鈕。
// 用法：await talk("波波", ["第一句", "第二句"]);  const v = await ask("波波", "要做什麼？", [["接任務", "quest"], ["離開", null]]);
// 點一下、J、空白鍵、Enter 換下一句；選項可以點，或按 1～9。
const box = document.getElementById("dlg"), nameEl = document.getElementById("dlgName"), textEl = document.getElementById("dlgText"), optEl = document.getElementById("dlgOpts");
export const dialog = { open: false };
let advance = null, pick = null, values = [];

function show(name, text) {
  dialog.open = true;
  box.classList.remove("hidden");
  nameEl.textContent = name;
  textEl.textContent = text;
  optEl.innerHTML = "";
}
function hide() {
  dialog.open = false;
  box.classList.add("hidden");
  box.classList.remove("more");
}
function next() {
  if (!advance) return;
  const a = advance;
  advance = null;
  a();
}
function choosePick(i) {
  if (!pick || i < 0 || i >= values.length) return;
  const r = pick;
  pick = null;
  hide();
  r(values[i]);
}

/** 一句一句講完，講完關掉對話框。 */
export async function talk(name, lines) {
  for (const line of lines) {
    show(name, line);
    box.classList.add("more");
    await new Promise((r) => (advance = r));
  }
  box.classList.remove("more");
  hide();
}

/** 顯示選項，回傳選到的值。options：[[文字, 值], ...] */
export function ask(name, text, options) {
  show(name, text);
  values = options.map((o) => o[1]);
  options.forEach(([label], i) => {
    const b = document.createElement("button");
    b.className = "pbtn";
    b.textContent = `${i + 1}. ${label}`;
    b.addEventListener("click", (e) => { e.stopPropagation(); choosePick(i); });
    optEl.appendChild(b);
  });
  return new Promise((r) => (pick = r));
}

box.addEventListener("pointerdown", (e) => { if (!e.target.closest("button")) next(); });
addEventListener("keydown", (e) => {
  if (!dialog.open) return;
  if (pick && /^Digit[1-9]$/.test(e.code)) { choosePick(+e.code.slice(5) - 1); e.preventDefault(); return; }
  if (advance && ["Space", "KeyJ", "Enter", "KeyX", "KeyZ"].includes(e.code)) { next(); e.preventDefault(); }
}, true);
