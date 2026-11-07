// Unity 存檔測試的另一半：網頁版的存檔（A）和 Unity 讀進去再存出來的（B），每個欄位比對。
// 用法：node game/tools/unity-save-compare.mjs <網頁版存檔.json> <Unity 存出來的.json>
// Unity 不存的欄位（網頁版才有的暫存值）列在 SKIP；數字容許 1e-9 的誤差。
import { readFileSync } from "node:fs";
const [a, b] = process.argv.slice(2).map((p) => JSON.parse(readFileSync(p, "utf8")));
const SKIP = new Set(["guild.quest", "forms.fresh"]);
let bad = 0, n = 0;
function cmp(x, y, path) {
  if (SKIP.has(path) || /\.cores$/.test(path)) return;   // 舊存檔的 cores（沒換掉的核）讀進來時已經併進 pts
  if (x && typeof x === "object" && !Array.isArray(x)) {
    for (const k of Object.keys(x)) { if (x[k] === undefined || x[k] === null && y?.[k] == null) continue; cmp(x[k], y?.[k], path ? path + "." + k : k); }
    return;
  }
  if (Array.isArray(x)) { if (!Array.isArray(y) || y.length !== x.length) { bad++; console.log("✗", path, "長度", x.length, Array.isArray(y) ? y.length : y); return; } x.forEach((v, i) => cmp(v, y[i], `${path}[${i}]`)); return; }
  n++;
  const same = typeof x === "number" && typeof y === "number" ? Math.abs(x - y) < 1e-9 : (x === true && y === 1) || (x === 1 && y === true) || x === y;
  if (!same) { bad++; if (bad < 30) console.log("✗", path, JSON.stringify(x), "→", JSON.stringify(y)); }
}
cmp(a, b, "");
console.log(bad ? `✗ ${bad} 個欄位不一樣（共比 ${n} 個）` : `✓ 網頁版存檔的 ${n} 個欄位，Unity 讀進去再存出來全部一樣`);
process.exit(bad ? 1 : 0);
