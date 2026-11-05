// 地圖畫面草稿：1-1 走過一半（左半＋最底層）的樣子，放大 2 倍，加上各種標記；右下角排一排所有圖示放大 6 倍。
// 執行：node game/tools/drafts/mapview.mjs out.png
import { writeFileSync } from "node:fs";
import { encodePNG } from "../../../pixelfx/tools/lib/png.mjs";
import { renderMap, stampIcon } from "../../src/mapview.js";
globalThis.location = { search: "" };
const { LAYOUTS } = await import("../../src/stages.js");
const { STAGES } = await import("../../src/stage.js");
const L = LAYOUTS["1-1"], S = STAGES["1-1"], snap = (v) => Math.floor(v / 8) * 8;
const solidAt = (x, y) => x < 0 || x >= L.w || y >= L.h || L.solids.some((r) => x >= snap(r.x) && x < Math.ceil((r.x + r.w) / 8) * 8 && y >= snap(r.y) && y < Math.ceil((r.y + r.h) / 8) * 8);
const cw = Math.ceil(L.w / 32), ch = Math.ceil(L.h / 32);
let seen = ""; for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) seen += x < cw * 0.55 || y > ch * 0.7 ? "1" : "0";
const marks = [{ icon: "player", x: 1000, y: 432 }, ...S.altars.map((a, i) => ({ icon: i ? "altarOff" : "altarOn", x: a.x, y: a.y })), { icon: "exit", x: S.exitX + 26, y: S.exitY, always: true },
  ...S.features.filter((f) => f.t !== "wind").map((f, i) => ({ icon: f.t, x: f.x, y: f.y, dim: i === 1 }))];
const m = renderMap({ w: L.w, h: L.h, theme: L.theme, solidAt, platforms: L.platforms, seen, marks });
const SC = 2, W = m.w * SC, H = m.h * SC + 70, img = new Uint8Array(W * H * 4);
for (let i = 0; i < W * H; i++) img.set([20, 18, 34, 255], i * 4);
const put = (x, y, hx) => { if (x < 0 || y < 0 || x >= W || y >= H) return; img.set([1, 3, 5].map((o) => parseInt(hx.slice(o, o + 2), 16)).concat(255), (y * W + x) * 4); };
for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) for (let b = 0; b < SC; b++) for (let a = 0; a < SC; a++) put(x * SC + a, y * SC + b, m.px[y * m.w + x]);
for (const k of m.marks) stampIcon(put, k.dim ? "done" : k.icon, k.mx * SC, k.my * SC, k.icon === "player" ? 2 : 1);
["player", "altarOn", "altarOff", "exit", "ember", "vein", "fossil", "safe", "stele", "crack", "seal", "shroom", "wind", "done"].forEach((n, i) => stampIcon(put, n, 30 + i * 40, m.h * SC + 60, 6));
writeFileSync(process.argv[2], encodePNG(W, H, img));
