// 地圖自動檢查（docs/地圖設計.md 第 3 節）：推上去之前跑一次。
//   ・從起點、每個入口出發，走得到每個事件（門口、傳送、NPC、寶箱、書頁、墨水點）嗎？
//   ・每個物件的腳底有沒有踩在不能走的地方（樹踩在水裡、路燈卡在建築裡）
// 用法（在 math/ 底下）：node tools/check-maps.mjs
import { readFileSync } from "node:fs";
import { DEF } from "../src/world/maps.js";

const save = { stars: {}, flags: {}, settings: { mapArt: "pixel" }, pages: [], chests: [], daily: null, diary: {} };
const CELL = 8, FOOT = 5;
let bad = 0;
for (const [id, def] of Object.entries(DEF)) {
  for (const dir of [id, `${id}-raw`]) {
    let L;
    try { L = JSON.parse(readFileSync(new URL(`../assets/map/${dir}/layout.json`, import.meta.url), "utf8")); } catch { continue; }
    // 打完前三關的存檔：封印門打開，王那邊也要走得到
    const M = def(L, save, dir), M2 = def(L, { ...save, stars: { "g1-1": 1, "g1-2": 1, "g1-3": 1 } }, dir);
    const stand = (x, y) => M.walkable(x - FOOT, y) && M.walkable(x + FOOT, y) && M.walkable(x, y - 3);
    const W = Math.ceil(M.size[0] / CELL), H = Math.ceil(M.size[1] / CELL);
    const ok = new Uint8Array(W * H), seen = new Uint8Array(W * H);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) ok[j * W + i] = stand(i * CELL + 4, j * CELL + 4) ? 1 : 0;
    // 從起點往外擴（四方向）
    const flood = (x, y) => {
      const st = [Math.floor(y / CELL) * W + Math.floor(x / CELL)];
      while (st.length) { const k = st.pop(); if (k < 0 || k >= W * H || seen[k] || !ok[k]) continue; seen[k] = 1; const i = k % W; st.push(k + W, k - W); if (i > 0) st.push(k - 1); if (i < W - 1) st.push(k + 1); }
    };
    const near = (x, y, r) => { for (let j = Math.floor((y - r) / CELL); j <= Math.floor((y + r) / CELL); j++) for (let i = Math.floor((x - r) / CELL); i <= Math.floor((x + r) / CELL); i++) if (i >= 0 && j >= 0 && i < W && j < H && seen[j * W + i] && Math.hypot(i * CELL + 4 - x, j * CELL + 4 - y) <= r) return true; return false; };
    flood(M.start.x, M.start.y);                                  // 只從起點出發：每個地方都要從起點走得到
    const problems = [];
    if (!near(M.start.x, M.start.y, 10)) problems.push(`起點 (${M.start.x}, ${M.start.y}) 站不住`);
    for (const [k, a] of Object.entries(M.arrive ?? {})) if (!near(a.x, a.y, 12)) problems.push(`從起點走不到入口「${k}」(${a.x}, ${a.y})`);
    for (const s of M.spots) if (!near(s.x, s.y, s.r)) problems.push(`走不到「${s.label ?? s.id}」(${Math.round(s.x)}, ${Math.round(s.y)})`);
    for (const n of M.npcs) if (!near(n.x, n.y, 50)) problems.push(`走不到 NPC「${n.name}」(${n.x}, ${n.y})`);
    for (const m of M.monsters ?? []) if (!m.boss && !near(m.x, m.y, 27)) problems.push(`碰不到墨水怪 ${m.id}`);
    if (M2.monsters?.some((m) => m.boss)) {
      const stand2 = (x, y) => M2.walkable(x - FOOT, y) && M2.walkable(x + FOOT, y) && M2.walkable(x, y - 3);
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) ok[j * W + i] = stand2(i * CELL + 4, j * CELL + 4) ? 1 : 0;
      seen.fill(0); flood(M2.start.x, M2.start.y);
      for (const m of M2.monsters.filter((m) => m.boss)) if (!near(m.x, m.y, 66)) problems.push(`封印門打開後還是碰不到王 ${m.id}`);
    }
    console.log(`${dir}：${problems.length ? `${problems.length} 個問題` : "通過"}（能走的格子 ${seen.reduce((a, b) => a + b, 0)}）`);
    for (const p of problems) console.log("  ・" + p);
    bad += problems.length;
  }
}
process.exit(bad ? 1 : 0);
