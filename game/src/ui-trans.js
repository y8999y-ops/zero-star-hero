// 視窗開啟轉場（第 7 批）：依照功能不同風格——
//   guild 公會＝金色卷軸從中間往上下展開（上下兩根卷軸桿往外滾）
//   forge 工坊＝兩扇鐵門往左右拉開（門閂先彈開、門震一下）
//   inn 旅館＝一扇木門往左推開（以左邊為軸轉開）
//   sys 系統＝全息投影：先一條亮線，再往上下展開，掃描線閃一下淡掉
//   bag 背包＝從下面彈上來（小小過衝）
// 門板圖在 door-art.js（照 pixelfx skill 畫三輪），卷軸桿在這裡畫。
import { doorArt } from "./door-art.js";

const K = 2;   // 像素放大倍數，跟介面其他像素圖一樣
function canvasOf(art) {
  const c = document.createElement("canvas");
  c.width = art.w; c.height = art.h;
  const g = c.getContext("2d");
  art.px.forEach((col, i) => { if (col) { g.fillStyle = col; g.fillRect(i % art.w, (i / art.w) | 0, 1, 1); } });
  c.style.width = art.w * K + "px"; c.style.height = art.h * K + "px";
  return c;
}
// 卷軸桿：木棒＋兩端金色圓頭
function rodArt(w) {
  const h = 7, px = new Array(w * h).fill(null), set = (x, y, c) => (px[y * w + x] = c);
  const WOOD = ["#2e1808", "#c89058", "#9a6434", "#6a4020", "#2e1808"], GOLD = ["#1a0c06", "#fff2b0", "#f0b840", "#c07a2a", "#1a0c06"];
  for (let x = 0; x < w; x++) {
    const cap = x < 6 || x >= w - 6, R = cap ? GOLD : WOOD;
    for (let y = cap ? 0 : 1; y < (cap ? h : h - 1); y++) {
      const t = cap ? y : y - 1, n = cap ? h : h - 2;
      set(x, y, x === 0 || x === w - 1 || t === 0 || t === n - 1 ? R[0] : t === 1 ? R[1] : t >= n - 2 ? R[3] : R[2]);
    }
  }
  return { w, h, px };
}

const cache = new Map();
function cached(key, make) { if (!cache.has(key)) cache.set(key, canvasOf(make())); return cloneCanvas(cache.get(key)); }
function cloneCanvas(src) { const c = document.createElement("canvas"); c.width = src.width; c.height = src.height; c.getContext("2d").drawImage(src, 0, 0); c.style.cssText = src.style.cssText; return c; }

/** 在 box（視窗本體）上播開啟轉場。theme：guild / forge / inn / sys / bag */
export function playOpen(box, theme) {
  box.querySelector(":scope > .tfx")?.remove();
  box.classList.remove("t-guild", "t-forge", "t-inn", "t-sys", "t-bag");
  void box.offsetWidth;
  box.classList.add("t-" + theme);
  const w = Math.ceil(box.offsetWidth / K), h = Math.ceil(box.offsetHeight / K);
  const fx = document.createElement("div");
  fx.className = "tfx tfx-" + theme;
  if (theme === "forge") {
    const hw = Math.ceil(w / 2);
    for (const side of ["L", "R"]) { const c = cached(`iron${side}${hw}x${h}`, () => doorArt("iron", hw, h, side)); c.className = "door d" + side; fx.appendChild(c); }
  } else if (theme === "inn") {
    const c = cached(`wood${w}x${h}`, () => doorArt("wood", w, h)); c.className = "door dW"; fx.appendChild(c);
  } else if (theme === "guild") {
    for (const s of ["T", "B"]) { const c = cached(`rod${w + 8}`, () => rodArt(w + 8)); c.className = "rod r" + s; fx.appendChild(c); }
  } else if (theme === "sys") {
    fx.innerHTML = '<i class="scan"></i><i class="beam"></i>';
  }
  if (fx.childNodes.length) box.appendChild(fx);
  setTimeout(() => { fx.remove(); box.classList.remove("t-" + theme); }, 700);
}
