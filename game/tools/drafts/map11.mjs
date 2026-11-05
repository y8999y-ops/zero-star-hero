// 大地圖總覽（第二個參數＝關卡，預設 1-1）：地形（terrain-art）、單向平台（黃線）、祭壇（金）、怪物（紅＝地上、紫＝飛的、橘＝菁英）、出口（青）、起點（白），原尺寸 1 倍。
// 執行：node game/tools/drafts/map11.mjs out.png [1-1|1-2|1-3]
import { writeFileSync } from "node:fs";
import { encodePNG } from "../../../pixelfx/tools/lib/png.mjs";
import { paintTerrain } from "../../src/terrain-art.js";
import { paintLair } from "../../src/lair-art.js";
globalThis.location = { search: "" };
const { LAYOUTS } = await import("../../src/stages.js");
const { STAGES } = await import("../../src/stage.js");
const ID = process.argv[3] || "1-1", L = LAYOUTS[ID], S = STAGES[ID], W = L.w, H = L.h, img = new Uint8Array(W * H * 4);
for (let i = 0; i < W * H; i++) img.set([14, 12, 26, 255], i * 4);
const snap = (v) => Math.floor(v / 8) * 8;
const solid = (x, y) => L.solids.some((r) => x >= snap(r.x) && x < Math.ceil((r.x + r.w) / 8) * 8 && y >= snap(r.y) && y < Math.ceil((r.y + r.h) / 8) * 8);
const put = (x, y, hx) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return; img.set([1, 3, 5].map((o) => parseInt(hx.slice(o, o + 2), 16)).concat(255), (y * W + x) * 4); };
paintTerrain(solid, W, H, put, () => {}, L.theme === "lair" ? "junk" : L.theme);
if (L.theme === "lair") paintLair(solid, W, H, put, L.arena);
const box = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(x + i, y + j, c); };
for (const p of L.platforms) box(p.x, p.y, p.w, 3, "#e8c040");
for (const a of S.altars) box(a.x - 5, a.y - 16, 10, 16, "#ffd84a");
for (const sp of S.spawns) { const fly = sp.k.startsWith("bat"), y = typeof sp.y === "number" ? sp.y : 500; box(sp.x - 4, y - (fly ? 4 : 12), 8, fly ? 6 : 12, sp.k.endsWith("E") ? "#ff8a2a" : fly ? "#b878ff" : "#ff4a5a"); }
box(S.exitX + 20, S.exitY - 30, 12, 30, "#4cd8ec");
box(S.start.x - 4, Math.max(0, S.start.y - 8), 8, 8, "#ffffff");
for (const c of S.caches) box(c.x - 3, c.y - 3, 6, 6, "#ffe066");
writeFileSync(process.argv[2], encodePNG(W, H, img));
