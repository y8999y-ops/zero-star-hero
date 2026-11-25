// 介面的像素外框（使用者 2026-11-25：介面很醜 → 換成像素風，統一「書頁＋金邊」主題）。
// 開遊戲時用程式畫好幾張小圖（九宮格），變成 CSS 變數，style.css 用 border-image 套在按鈕、面板、對話框上。
//   --f-panel  深藍的書封：黑外框＋金邊＋暗金內線，四角金色鉚釘（選單、面板、上方資訊）
//   --f-paper  米色書頁：咖啡外框＋淡金邊（對話框、說明卡）
//   --b-norm / --b-gold / --b-red（＋ -on 按下去的樣子）：按鈕，上緣亮一條、下緣暗兩條＝立體
// 每個像素畫成 3×3（S），放大時邊緣還是方方的。

const S = 3;

function pixels(w, h, fn) {
  const c = document.createElement("canvas"); c.width = w * S; c.height = h * S;
  const g = c.getContext("2d");
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const col = fn(x, y, w, h);
    if (col) { g.fillStyle = col; g.fillRect(x * S, y * S, S, S); }
  }
  return `url(${c.toDataURL()})`;
}
// 距離外緣幾格（0＝最外面）
const ring = (x, y, w, h) => Math.min(x, y, w - 1 - x, h - 1 - y);
const corner = (x, y, w, h, r) => (x < r || x >= w - r) && (y < r || y >= h - r);

// 書封面板：12×12，邊 4 格
const panel = (fill) => pixels(12, 12, (x, y, w, h) => {
  const k = ring(x, y, w, h);
  if (corner(x, y, w, h, 1)) return null;                         // 圓一點點的角
  if (k === 0) return "#0b0818";
  if (k === 1) return corner(x, y, w, h, 3) ? "#fff0b0" : "#f2c24a";   // 金邊（四角亮一點＝鉚釘）
  if (k === 2) return "#a8761c";
  if (k === 3) return "#17122a";
  return fill;
});
// 書頁：12×12，邊 4 格
const paper = () => pixels(12, 12, (x, y, w, h) => {
  const k = ring(x, y, w, h);
  if (corner(x, y, w, h, 1)) return null;
  if (k === 0) return "#3a2a1a";
  if (k === 1) return "#c9a46a";
  if (k === 2) return "#f6ecd6";
  if (k === 3) return y === 3 || x === 3 ? "#fffaf0" : "#e8d8b8";
  return "#f6ecd6";
});
// 按鈕：10×10，邊 3 格；上亮下暗
const button = (fill, hi, lo, pressed) => pixels(10, 10, (x, y, w, h) => {
  if (corner(x, y, w, h, 1)) return null;
  const k = ring(x, y, w, h);
  if (k === 0) return "#120d22";
  if (!pressed && y >= h - 3) return lo;                           // 下緣兩條暗＝按鈕的厚度
  if (y === 1 || (pressed && y === 2)) return pressed ? lo : hi;   // 上緣一條亮
  return fill;
});

export function installUiArt() {
  const r = document.documentElement.style;
  r.setProperty("--f-panel", panel("#241c3d"));
  r.setProperty("--f-panel2", panel("#2f2550"));
  r.setProperty("--f-paper", paper());
  r.setProperty("--b-norm", button("#4a4266", "#6e6494", "#2c2642", false));
  r.setProperty("--b-norm-on", button("#4a4266", "#6e6494", "#2c2642", true));
  r.setProperty("--b-gold", button("#f2c24a", "#fff0b0", "#a8761c", false));
  r.setProperty("--b-gold-on", button("#f2c24a", "#fff0b0", "#a8761c", true));
  r.setProperty("--b-red", button("#e0565b", "#ff9a9a", "#8e2a32", false));
  r.setProperty("--b-red-on", button("#e0565b", "#ff9a9a", "#8e2a32", true));
  r.setProperty("--b-ok", button("#6fd46a", "#c8f4b0", "#2e7a34", false));
  r.setProperty("--b-bad", button("#e0565b", "#ff9a9a", "#8e2a32", false));
}
