// 選關世界地圖草稿：三種狀態（新玩家、打到 1-3、全通）各畫一張，放大 3 倍直排。執行：node game/tools/drafts/worldmap.mjs out.png
import { writeFileSync } from "node:fs";
import { encodePNG } from "../../../pixelfx/tools/lib/png.mjs";
import { createFrame, composite } from "../../../pixelfx/src/core/index.js";
import { bakeBase, drawWorld, WM_W, WM_H, NODES } from "../../src/worldmap-art.js";
import { paintStar, POSES } from "../../src/star.js";
const base = bakeBase(), f = createFrame(WM_W, WM_H), S = 3;
const mk = (open, cleared, fresh, sel, t) => ({ sel, nodes: Object.fromEntries(Object.keys(NODES).map((id) => [id, { open: id === "town" || open.includes(id), cleared: cleared.includes(id), fresh: fresh === id }])) });
const states = [mk(["1-1"], [], "1-1", "1-1", 0.3), mk(["1-1", "1-2", "1-3", "endless"], ["1-1", "1-2"], "1-3", "1-2", 1.1), mk(["1-1", "1-2", "1-3", "1-4", "endless"], ["1-1", "1-2", "1-3", "1-4"], null, "1-4", 2.0)];
const W = WM_W * S, H = WM_H * S * states.length + 4 * states.length, img = new Uint8Array(W * H * 4), one = new Uint8ClampedArray(WM_W * WM_H * 4);
states.forEach((st, k) => {
  drawWorld(f, st.t ?? [0.3, 1.1, 2][k], base, st);
  const n = NODES[st.sel]; paintStar(f, n.x, n.y + 2, POSES.stand, false, { glow: 0 });
  composite(f, one, null, 1);
  for (let y = 0; y < WM_H; y++) for (let x = 0; x < WM_W; x++) for (let b = 0; b < S; b++) for (let a = 0; a < S; a++) { const o = ((k * (WM_H * S + 4) + y * S + b) * W + x * S + a) * 4, i = (y * WM_W + x) * 4; img[o] = one[i]; img[o + 1] = one[i + 1]; img[o + 2] = one[i + 2]; img[o + 3] = 255; }
});
writeFileSync(process.argv[2], encodePNG(W, H, img));
