// Unity 轉移的比對工具（pixelfx 特效，網頁版這一邊）：用真正的 createFx 播特效，每步 update(1/60 × 速度)
// 再畫進一張新的畫布，存成原始像素檔；C# 那邊（FxRun）用同樣的規則播一次，逐位元組比對。
//
// 規則（兩邊要一樣）：畫布＝meta.size；選項 x、y＝原點（翻轉時 x 改成 W - origin.x）；
//   每步 update(dt × speed)，第 stopAt 步（從 0 算）update 之後呼叫 stop()；
//   沒指定步數就一直跑到 done()（每步畫完再檢查）。
// 檔案：<輸出資料夾>/<名稱>-<0|1>.bin ＝ 每一格先 color（W×H 個 uint32，little-endian）再 light；
//   <輸出資料夾>/manifest.json ＝ 每個案例的參數與格數（C# 那邊照著播）。
//
// 執行：node --no-use-std-math-pow game/tools/unity-fx-golden.mjs [輸出資料夾]
//   （Node 預設的 Math.pow 用平台的 C 函式庫，各平台最後一位會不同；加這個旗標改用 V8 自己的 fdlibm 版，
//    跟 C# 的 Pf.Pow 一樣。不加也能跑，用來量平台 pow 的差異。）
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createFrame, clearFrame, createFx, PAL } from "../../pixelfx/src/core/index.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = process.argv[2] ?? join(ROOT, "unity", "Golden", "fx-web");
mkdirSync(OUT, { recursive: true });

const FX = {
  fireball: "fire/fireball.js",
  "plasma-explosion": "explosions/plasma-explosion.js",
  "hit-spark": "impacts/hit-spark.js",
  "zap-hit": "lightning/zap-hit.js",
  "poison-cloud": "nature/poison-cloud.js",
  "acid-splash": "nature/acid-splash.js",
  "collect-burst": "pickups/collect-burst.js",
  "rune-circle": "arcane/rune-circle.js",
  sunburst: "holy/sunburst.js",
  "ground-slam": "impacts/ground-slam.js",
  "star-fall": "arcane/star-fall.js",
  "level-up": "ui/level-up.js",
  poof: "spawn/poof.js",
  splash: "water/splash.js",
  "treasure-chest": "../../../game/fx/loot/treasure-chest.js",
  "shooting-stars": "weather/shooting-stars.js",
  frog: "critters/frog.js",
  "town-rain": "../../../game/src/fx-town-rain.js",
  parry: "impacts/parry.js",
  "quest-complete": "ui/quest-complete.js",
  "coin-collect": "ui/coin-collect.js",
  meteor: "fire/meteor.js",
  "star-meteor": "../../../game/fx/fire/star-meteor.js",
  slime: "critters/slime.js",
};

const STAR_BOOM = ["#3a1608", "#6e3a0c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff"];
const CASES = [
  { name: "fireball", fx: "fireball", opts: { palette: STAR_BOOM, light: 0.65, seed: 37 }, speed: 1, steps: 90 },
  { name: "plasma-star", fx: "plasma-explosion", opts: { palette: ["#3a1608", "#6e3a0c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff"], accent: ["#2a1608", "#8a4a10", "#e8892a", "#ffc764", "#fff0b4"], light: 0.65, seed: 12 }, speed: 1.3, steps: 80 },
  { name: "plasma-fire8", fx: "plasma-explosion", opts: { palette: ["#4a1712", "#c9281f", "#f2561d", "#ff8a2a", "#ffc23d", "#ffe26b", "#fff3a6", "#ffffff"], light: 0.6, seed: 40 }, speed: 1.6 },
  { name: "hit-spark", fx: "hit-spark", opts: { palette: ["#2a1608", "#8a4a10", "#e8892a", "#ffc764", "#ffe066", "#fff6c4", "#ffffff"], angle: -Math.PI / 2, light: 0.35 }, speed: 1.2 },
  { name: "zap-hit", fx: "zap-hit", opts: { light: 0.5, seed: 3 }, speed: 1 },
  { name: "zap-hit-slime", fx: "zap-hit", opts: { palette: ["#0c2010", "#1a4a20", "#2a8a3a", "#4cc04a", "#8ee86a", "#d4ffb0", "#ffffff"], light: 0.4, seed: 7 }, speed: 1 },
  { name: "poison-cloud", fx: "poison-cloud", opts: { palette: ["#2a3040", "#4a5468", "#7a8498", "#a8b2c4", "#d0d8e6", "#eef2fa", "#ffffff", "#ffffff"], light: 0.1, seed: 20 }, speed: 1.4, stopAt: 70 },
  { name: "acid-splash", fx: "acid-splash", opts: { palette: ["#0e1d14", "#173320", "#23552e", "#318232", "#55b92f", "#8eea3f", "#cfff63", "#f6ffc2"], light: 0.4, seed: 9 }, speed: 1.5 },
  { name: "collect-burst", fx: "collect-burst", opts: { palette: ["#160c24", "#2e1a4a", "#5c388c", "#8058b8", "#b48ae8", "#e2d0ff", "#ffffff"], light: 0.4 }, speed: 1 },
];
CASES.push(
  { name: "level-up", fx: "level-up", opts: { light: 0.45, seed: 3 }, speed: 1 },
  { name: "level-up-awaken", fx: "level-up", opts: { light: 0.55, seed: 14, text: "AWAKEN!", palette: ["#2a1405", "#5c3008", "#9a5a0e", "#d48e18", "#f5b92c", "#ffde5e", "#fff4bc", "#ffffff"] }, speed: 1 },
);
// 第 3a 批：props 的 poof、scenery 的 splash、main.js chestOpts(tier) 的寶箱
const CHEST_TIERS = (await import("../src/chest-tiers.js")).CHEST_TIERS;
const chestOpts = (tier) => { const T = CHEST_TIERS[tier]; return { tier, wood: T.wood, palette: T.palette, coins: 0, gems: 0, light: 0.3 + tier * 0.08 }; };
CASES.push(
  { name: "poof-crate", fx: "poof", opts: { light: 0.2, seed: 42, palette: ["#1a1420", "#3a3040", "#5e5466", "#857a8a", "#aaa0ac", "#d0c8d0"] }, speed: 1.8 },
  { name: "poof", fx: "poof", opts: {}, speed: 1 },
  { name: "splash-land", fx: "splash", opts: { stone: false, light: 0.2, seed: 57 }, speed: 2.2 },
  { name: "splash", fx: "splash", opts: {}, speed: 1 },
  ...[0, 1, 2, 3].map((tier) => ({ name: "chest-" + tier, fx: "treasure-chest", opts: { seed: 3, ...chestOpts(tier) }, speed: 1 })),
  { name: "chest-loot", fx: "treasure-chest", opts: { tier: 2, light: 0.5 }, speed: 1 },
  { name: "chest-loot3", fx: "treasure-chest", opts: { tier: 3, coins: 8, gems: 6, seed: 9 }, speed: 1 },
);
// 第二批：預設選項，加上金色色階 light 0.5 seed 11 速度 1.2；迴圈的第 60 步 stop()
const ONLY = (process.env.FX_ONLY ?? "").split(",").filter(Boolean);
for (const fx of ["rune-circle", "sunburst", "ground-slam", "star-fall"]) {
  CASES.push({ name: fx, fx, opts: {}, speed: 1, loopStop: 60 });
  CASES.push({ name: fx + "-gold", fx, opts: { palette: PAL.gold, light: 0.5, seed: 11 }, speed: 1.2, loopStop: 60 });
}

// 第 3e 批：城鎮的夜空（starsky.js）、青蛙、雨（town.js 的選項）。都是迴圈，固定步數；速度加快讓步數涵蓋大半個迴圈
CASES.push(
  { name: "shooting-stars", fx: "shooting-stars", opts: { sky: ["#120c26", "#2a1e4a", "#4a3878", "#9a88d0", "#e8e0ff"], seed: 4 }, speed: 2.5, steps: 240 },
  { name: "frog", fx: "frog", opts: { seed: 3, light: 0.2 }, speed: 1, steps: 300 },
  { name: "town-rain", fx: "town-rain", opts: { density: 1 }, speed: 2, steps: 240 },
  { name: "town-rain-light", fx: "town-rain", opts: { density: 0.45 }, speed: 1.3, steps: 150 },
);

// 第 4b 批：格擋（金色、灰色鈍刀）、任務完成橫幅、撿金幣
CASES.push(
  { name: "parry-gold", fx: "parry", opts: { palette: ["#3a1a06", "#8a4a10", "#e0901c", "#ffc83a", "#ffe98a", "#fff8d8", "#ffffff"], light: 0.5, seed: 5 }, speed: 1 },
  { name: "parry-dull", fx: "parry", opts: { palette: ["#16161a", "#2e2e34", "#4e4e56", "#74747c", "#9c9ca4", "#c8c8ce", "#ececf0"], light: 0.1, seed: 23, height: 24 }, speed: 1.3 },
  { name: "quest-complete", fx: "quest-complete", opts: {}, speed: 1 },
  { name: "quest-complete-alt", fx: "quest-complete", opts: { text: "Stage Clear!", seed: 31, light: 0.4, ribbon: ["#06121e", "#0e2a45", "#1a4a7a", "#2a6aad", "#4390d8", "#7ab8f2", "#b7dcff"] }, speed: 1.2 },
  { name: "coin-collect", fx: "coin-collect", opts: { count: 8, light: 0.4 }, speed: 1 },
  { name: "coin-collect-12", fx: "coin-collect", opts: { count: 12, from: 95, seed: 17 }, speed: 1.1 },
);

// 開場動畫（intro.js）：C 幕撞進洞窟的金色流星、B 幕遠方不冒煙的那顆（clean）、E 幕探頭的史萊姆
const INTRO_GOLD = ["#3a1a06", "#6e3a0c", "#a8601a", "#d8902a", "#f4c040", "#ffe27a", "#fff2b0", "#fffbe8", "#ffffff"];
CASES.push(
  { name: "meteor", fx: "meteor", opts: {}, speed: 1.6 },
  { name: "meteor-intro", fx: "meteor", opts: { palette: INTRO_GOLD, light: 0.6, seed: 5 }, speed: 1.3 },
  { name: "star-meteor", fx: "star-meteor", opts: {}, speed: 1.7 },
  { name: "star-meteor-clean", fx: "star-meteor", opts: { palette: INTRO_GOLD, light: 0.5, clean: true }, speed: 1.2 },
  { name: "slime", fx: "slime", opts: {}, speed: 1, steps: 120 },
  { name: "slime-intro", fx: "slime", opts: { light: 0.3, seed: 4, hop: 18 }, speed: 0.8, steps: 160 },
);

const manifest = [];
let files = 0;
for (const c of CASES) {
  if (ONLY.length && !ONLY.includes(c.fx)) continue;
  let mod;
  try {
    mod = await import(`../../pixelfx/src/fx/${FX[c.fx]}`);
  } catch (e) {
    console.log(`略過 ${c.name}：${e.message}`);
    continue;
  }
  const meta = mod.meta, [W, H] = meta.size, [OX, OY] = meta.origin;
  const stopAt = c.stopAt ?? (meta.loop && c.loopStop !== undefined ? c.loopStop : -1);
  const entry = { name: c.name, fx: c.fx, opts: c.opts, speed: c.speed, steps: c.steps ?? 0, stopAt, w: W, h: H, frames: {} };
  for (const flip of [false, true]) {
    const fx = createFx(mod, { ...c.opts, x: flip ? W - OX : OX, y: OY, flip });
    const frames = [];
    for (let i = 0; c.steps ? i < c.steps : i < 1200; i++) {
      fx.update((1 / 60) * c.speed);
      if (i === stopAt) fx.stop();
      const f = createFrame(W, H);
      clearFrame(f);
      fx.draw(f);
      const b = new Uint32Array(W * H * 2);
      b.set(f.color, 0);
      b.set(f.light, W * H);
      frames.push(b);
      if (!c.steps && fx.done()) break;
    }
    const buf = new Uint32Array(frames.length * W * H * 2);
    frames.forEach((b, i) => buf.set(b, i * W * H * 2));
    writeFileSync(join(OUT, `${c.name}-${flip ? 1 : 0}.bin`), Buffer.from(buf.buffer));
    entry.frames[flip ? 1 : 0] = frames.length;
    files++;
  }
  manifest.push(entry);
}
writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 1));
console.log(`寫出 ${files} 個比對檔到 ${OUT}（std pow：${process.execArgv.includes("--no-use-std-math-pow") ? "關" : "開"}）`);
