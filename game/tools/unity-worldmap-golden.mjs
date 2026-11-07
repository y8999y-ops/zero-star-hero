// Unity 轉移的比對工具（選關世界地圖，網頁版這一邊）：用真正的 worldmap-art.js（bakeBase、drawWorld）、
// worldmap.js（route、stepHero）、star.js（paintStar）照 openWorldMap 的規則跑幾種進度、選幾個地點，每 EVERY 格存一張合成好的畫面。
// Unity 那邊（ZeroStar.Tests.WorldMapTest.Run）照同一份 unity-worldmap-cases.json 跑一次，再用 unity-trace-compare.mjs 的畫面比對方式逐像素比。
// 執行：node --no-use-std-math-pow game/tools/unity-worldmap-golden.mjs
import { installDom } from "./unity/node-dom.mjs";
installDom();
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = join(HERE, "..", "..");
const OUT = join(ROOT, "unity", "Golden", "web");
mkdirSync(OUT, { recursive: true });
const { createFrame, composite } = await import("../../pixelfx/src/core/index.js");
const { bakeBase, drawWorld, WM_W, WM_H, NODES } = await import("../src/worldmap-art.js");
const { route, stepHero } = await import("../src/worldmap.js");
const { paintStar, POSES } = await import("../src/star.js");

const CASES = JSON.parse(readFileSync(join(HERE, "unity-worldmap-cases.json"), "utf8"));
// compare：比對網頁版和 Unity 的畫面（每張逐像素）
if (process.argv[2] === "compare") {
  let bad = 0;
  for (const c of CASES.cases) {
    const a = readFileSync(join(OUT, `worldmap-${c.name}.bin`)), b = readFileSync(join(ROOT, "unity", "Golden", "unity", `worldmap-${c.name}.bin`)), sz = WM_W * WM_H * 4;
    let diff = [];
    if (a.length !== b.length) { console.log(`✗ ${c.name}：張數不同（網頁 ${a.length / sz}、Unity ${b.length / sz}）`); bad++; continue; }
    for (let i = 0; i < a.length / sz; i++) { let n = 0; for (let j = i * sz; j < (i + 1) * sz; j++) if (a[j] !== b[j]) n++; if (n) diff.push(`${i}（${n}）`); }
    if (diff.length) { bad++; console.log(`✗ ${c.name}：${diff.length} 張不一樣：${diff.slice(0, 8).join(" ")}`); } else console.log(`✓ ${c.name}：${a.length / sz} 張，每個像素完全一樣`);
  }
  process.exit(bad ? 1 : 0);
}
const ORDER = ["town", "1-1", "1-2", "1-3", "1-4", "endless", "ch2"];
const base = bakeBase();
for (const c of CASES.cases) {
  const cleared = Object.fromEntries(c.cleared.map((id) => [id, true]));
  const STAGES = ["1-1", "1-2", "1-3", "1-4"], unlocked = STAGES.filter((id, i) => i === 0 || cleared[STAGES[i - 1]]);
  const open = new Set(["town", "endless", ...unlocked]);
  const st = { sel: null, nodes: {} };
  for (const id of ORDER) st.nodes[id] = { open: open.has(id) || id === "ch2", cleared: !!cleared[id], fresh: unlocked.includes(id) && !cleared[id] };
  st.nodes.ch2.open = false;
  const first = [...unlocked].reverse().find((id) => !cleared[id]) ?? unlocked[unlocked.length - 1] ?? "1-1";
  const hero = { x: NODES.town.x, y: NODES.town.y, at: "town", path: [], face: 1, dist: 0 };
  const select = (id) => {   // worldmap.js 的 select（walk＝true；再點一次同一個＝出發，這裡不會發生）
    if (!id || st.sel === id) return;
    st.sel = id;
    if (st.nodes[id].open) { hero.path = route(hero.at, id); hero.at = id; }
  };
  const frame = createFrame(WM_W, WM_H), img = new Uint8ClampedArray(WM_W * WM_H * 4), frames = [];
  let t = 0;
  select(first);
  for (let n = 0; n < c.ticks; n++) {
    for (const [at, id] of c.select) if (at === n) select(id);
    const dt = 1 / 60; t += dt;
    const moving = stepHero(hero, dt);
    drawWorld(frame, t, base, st);
    paintStar(frame, hero.x, hero.y + 3, moving ? POSES.run[Math.floor(hero.dist / 6) % 4] : POSES.stand, hero.face < 0, { glow: 0 });
    if (n % CASES.every === 0) { composite(frame, img, null, 1); frames.push(Buffer.from(img)); }
  }
  writeFileSync(join(OUT, `worldmap-${c.name}.bin`), Buffer.concat(frames));
  console.log(`  ${c.name}：${frames.length} 張（開了 ${[...open].join(" ")}，一開始選 ${first}）`);
}
console.log("網頁版世界地圖 → " + OUT);
