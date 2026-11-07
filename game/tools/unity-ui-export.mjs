// Unity 轉移：把網頁版介面用的像素素材（ui-art.js 的 installUiArt 設給 CSS 的每一張圖：面板框、主題外框、按鈕、物品格、觸控按鈕、小圖示）
// 原樣存成 PNG，給 Unity 的 UI Toolkit 當 9 宮格背景用。另外把 icons.js 的每個物品／介面圖示存成 1 倍大的 PNG。
// 這些圖網頁版是在 canvas 上用 fillStyle＋fillRect 畫的，這裡假造一個只會這兩件事的 canvas（半透明的顏色照 source-over 疊）。
// 執行：node game/tools/unity-ui-export.mjs → unity/Assets/Resources/UI/（css 變數名稱.png、icons/名稱.png）
import { installDom } from "./unity/node-dom.mjs";
installDom();
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { encodePNG } from "../../pixelfx/tools/lib/png.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(ROOT, "unity", "Assets", "Resources", "UI");
mkdirSync(join(OUT, "icons"), { recursive: true });

function parseColor(s) {
  s = String(s).trim();
  if (s[0] === "#") {
    let h = s.slice(1);
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
    const n = parseInt(h.slice(0, 6), 16), a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
  }
  const m = s.match(/rgba?\(([^)]*)\)/);
  if (m) { const v = m[1].split(",").map((x) => parseFloat(x)); return [v[0], v[1], v[2], v[3] ?? 1]; }
  throw new Error("看不懂的顏色：" + s);
}
class PixCanvas {
  constructor() { this.width = 0; this.height = 0; this.data = null; }
  getContext() {
    const c = this;
    return {
      fillStyle: "#000",
      fillRect(x, y, w, h) {
        if (!c.data || c.data.length !== c.width * c.height * 4) c.data = new Float64Array(c.width * c.height * 4);
        const [r, g, b, a] = parseColor(this.fillStyle);
        for (let yy = Math.max(0, y); yy < Math.min(c.height, y + h); yy++) for (let xx = Math.max(0, x); xx < Math.min(c.width, x + w); xx++) {
          const i = (yy * c.width + xx) * 4, da = c.data[i + 3], oa = a + da * (1 - a);
          if (oa <= 0) continue;
          c.data[i] = (r * a + c.data[i] * da * (1 - a)) / oa; c.data[i + 1] = (g * a + c.data[i + 1] * da * (1 - a)) / oa; c.data[i + 2] = (b * a + c.data[i + 2] * da * (1 - a)) / oa; c.data[i + 3] = oa;
        }
      },
    };
  }
  png() {
    const o = Buffer.alloc(this.width * this.height * 4);
    if (this.data) for (let i = 0; i < this.width * this.height; i++) { o[i * 4] = Math.round(this.data[i * 4]); o[i * 4 + 1] = Math.round(this.data[i * 4 + 1]); o[i * 4 + 2] = Math.round(this.data[i * 4 + 2]); o[i * 4 + 3] = Math.round(this.data[i * 4 + 3] * 255); }
    return encodePNG(this.width, this.height, o);
  }
  toDataURL() { return "canvas:" + (PixCanvas.reg.push(this) - 1); }
}
PixCanvas.reg = [null];
const mkEl = document.createElement.bind(document);
document.createElement = (tag) => (tag === "canvas" ? new PixCanvas() : mkEl(tag));
// 記下 installUiArt 設的每個 CSS 變數
const vars = {};
document.documentElement ??= {};
document.documentElement.style ??= {};
document.documentElement.style.setProperty = (name, v) => { const m = String(v).match(/canvas:(\d+)/); if (m) vars[name.replace(/^--/, "")] = PixCanvas.reg[+m[1]]; };

const UA = await import("../src/ui-art.js");
UA.installUiArt();
UA.installSysPanel?.();
let n = 0;
for (const [name, cv] of Object.entries(vars)) { writeFileSync(join(OUT, name + ".png"), cv.png()); n++; }
// 物品／介面圖示（1 倍大）
const { ICONS } = await import("../src/icons.js");
let m = 0;
for (const name of Object.keys(ICONS)) { const url = UA.iconURL(name, 1), k = url.match(/canvas:(\d+)/); if (!k) continue; writeFileSync(join(OUT, "icons", name + ".png"), PixCanvas.reg[+k[1]].png()); m++; }
// 系統的臉（system-face.js）：4 種表情 × 8 格，face-表情-格.png（40×40）
const SF = await import("../src/system-face.js");
mkdirSync(join(OUT, "face"), { recursive: true });
for (const ex of ["normal", "smug", "wow", "blink"]) for (let f = 0; f < SF.FRAMES; f++) writeFileSync(join(OUT, "face", `${ex}-${f}.png`), SF.systemFace(ex, f).png());
// 左上的等級徽章（main.js 的 drawMedal）：每個形態一張，medal-形態.png
const { paintStar, POSES } = await import("../src/star.js");
const { createFrame, composite } = await import("../../pixelfx/src/core/index.js");
for (const form of ["star", "slime", "bat", "can", "spike"]) {
  const fw = 40, fh = 34, f = createFrame(fw, fh), d = new Uint8ClampedArray(fw * fh * 4);
  paintStar(f, 20, 31, POSES.stand, false, { glow: 0, form });
  composite(f, d, null);
  const ox = (UA.MEDAL_SIZE - fw) >> 1, oy = (UA.MEDAL_SIZE - fh) >> 1;
  const c = UA.medal(2, (x, y) => { const sx = x - ox, sy = y - oy; if (sx < 0 || sy < 0 || sx >= fw || sy >= fh) return null; const i = (sy * fw + sx) * 4; return d[i + 3] ? `rgb(${d[i]},${d[i + 1]},${d[i + 2]})` : null; });
  writeFileSync(join(OUT, `medal-${form}.png`), c.png());
  // 形態按鈕上的全身像（main.js 的 portrait：40×34）
  writeFileSync(join(OUT, `portrait-${form}.png`), encodePNG(fw, fh, Buffer.from(d)));
}
console.log(`介面素材 ${n} 張、圖示 ${m} 個、系統的臉 32 張、徽章 5 張 → ${OUT}`);
