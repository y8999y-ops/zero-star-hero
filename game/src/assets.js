// 載入時一次烘焙所有常用動畫。只有偶爾出現的大特效（爆炸、傷害數字）才即時運算。
import { bake } from "./bake.js";
import * as slimeFx from "../../pixelfx/src/fx/critters/slime.js";
import * as batFx from "../../pixelfx/src/fx/critters/bat.js";
import * as brazier from "../../pixelfx/src/fx/fire/brazier.js";
import * as swordSlash from "../../pixelfx/src/fx/melee/sword-slash.js";
import * as doubleSlash from "../../pixelfx/src/fx/melee/double-slash.js";
import * as spinSlash from "../../pixelfx/src/fx/melee/spin-slash.js";
import * as hitSpark from "../../pixelfx/src/fx/impacts/hit-spark.js";
import * as poof from "../../pixelfx/src/fx/spawn/poof.js";
import * as trashCan from "../fx/abyss/trash-can.js";
import * as portal from "../../pixelfx/src/fx/arcane/portal.js";

const white = (n) => Array(n).fill("#ffffff");
export const GOLD_SLIME = ["#1a1004", "#4a2e06", "#8c5a0c", "#d49a14", "#ffd23a", "#fff09a", "#ffffff"];
const SLIME_POOF = ["#0b2f2b", "#12594a", "#1f8f4f", "#47c752", "#a6f06a", "#f0ffd2"];
const GOLD_POOF = ["#4a2e06", "#8c5a0c", "#d49a14", "#ffd23a", "#fff09a", "#ffffff"];
const BAT_POOF = ["#1f1629", "#382645", "#5b3f66", "#866089", "#b88fb0", "#e8cfe0"];
const DUST = ["#2a2440", "#3e3758", "#5e5878", "#7d7798", "#9a94b4", "#b8b2cc"];
const RED_SPARK = ["#2a0710", "#8c1420", "#d42a2e", "#ff5a4a", "#ff9a86", "#ffd8cc", "#ffffff"];

// 受擊閃光不用純白，保留一點明暗，比較不刺眼
const flash = (n) => ["#5a5868", "#8a8898", "#b4b2c2", "#d6d4e2", "#ecebf4", "#f6f5fb", "#ffffff"].slice(-n);

// 發光強度（light）：PixelFX 預設是 1，在怪很多的動作遊戲裡會疊得太亮，這裡統一壓低。
// 想整體調亮或調暗，改 GLOW 就好。
export const GLOW = { enemy: 0.26, brazier: 0.52, slash: 0.6, spark: 0.52, poof: 0.4, skill: 0.65 };

export const A = {
  slime: bake(slimeFx, { light: GLOW.enemy }),
  slimeWhite: bake(slimeFx, { palette: flash(7), light: 0 }),
  slimeGold: bake(slimeFx, { palette: GOLD_SLIME, light: GLOW.enemy }),
  bat: bake(batFx, { light: GLOW.enemy }),
  batWhite: bake(batFx, { palette: flash(7), eyes: flash(4), light: 0 }),
  brazier: bake(brazier, { light: GLOW.brazier }),
  slash: [bake(swordSlash, { light: GLOW.slash }), bake(doubleSlash, { light: GLOW.slash }), bake(spinSlash, { light: GLOW.slash })],
  spark: bake(hitSpark, { height: 10, light: GLOW.spark }),
  sparkRed: bake(hitSpark, { palette: RED_SPARK, light: GLOW.spark }),
  poofSlime: bake(poof, { palette: SLIME_POOF, light: GLOW.poof }),
  poofGold: bake(poof, { palette: GOLD_POOF, light: GLOW.poof }),
  poofBat: bake(poof, { palette: BAT_POOF, light: GLOW.poof }),
  dust: bake(poof, { palette: DUST, light: 0 }),
  portal: bake(portal, { light: GLOW.brazier }),
  // 自製：垃圾桶怪
  trashWalk: bake(trashCan, { light: GLOW.enemy * 2 }),
  trashBite: bake(trashCan, { mode: "bite", light: GLOW.enemy * 2 }),
  trashWhite: bake(trashCan, { palette: flash(7), rust: flash(4), light: 0 }),
  trashWhiteBite: bake(trashCan, { mode: "bite", palette: flash(7), rust: flash(4), light: 0 }),
  poofTrash: bake(poof, { palette: ["#1f272c", "#313d42", "#485a5c", "#667a78", "#8ea29c", "#c4d4cc"], light: GLOW.poof }),
};

// 武器招式的刀光：用到才烘焙（換武器時在背包畫面裡烘，戰鬥中不會卡）
const slashCache = new Map([[swordSlash, A.slash[0]], [doubleSlash, A.slash[1]], [spinSlash, A.slash[2]]]);
// 大劍、大錘的衝擊有大片純白，換成暖白，比較不刺眼
const soft = (pal) => pal?.map((c) => (c.toLowerCase() === "#ffffff" ? "#e8dcc4" : c));
export function slashAnim(mod) {
  if (!slashCache.has(mod)) slashCache.set(mod, bake(mod, { light: GLOW.slash * 0.8, palette: soft(mod.meta.options?.palette) }));
  return slashCache.get(mod);
}
