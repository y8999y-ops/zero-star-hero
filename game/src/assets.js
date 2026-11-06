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
import * as hedgehog from "../fx/forest/hedgehog.js";
import * as portal from "../../pixelfx/src/fx/arcane/portal.js";

const white = (n) => Array(n).fill("#ffffff");
const HOG_RED = ["#14060a", "#3a0a14", "#6e1220", "#a01c2a", "#d03a34", "#ff7a5a", "#ffd0b0"], HOG_RED_FACE = ["#5a2a26", "#c08070", "#f0c8b8", "#fff0e8"];
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
  // 菁英（紅色）
  slimeElite: bake(slimeFx, { palette: ["#14060a", "#3a0a14", "#6e1220", "#b01e2a", "#e84a3a", "#ff9a70", "#ffe0c8"], light: GLOW.enemy * 1.6 }),
  batElite: bake(batFx, { palette: ["#14060a", "#2e0a18", "#5a1228", "#8e1e3a", "#c83a4a", "#ff7a6a", "#ffd0c0"], eyes: ["#5a2a00", "#ffd84a", "#fff3a6", "#ffffff"], light: GLOW.enemy * 1.6 }),
  trashEliteWalk: bake(trashCan, { palette: ["#16060a", "#320c14", "#561420", "#7e1c2a", "#b02a34", "#e0504a", "#ffa08a"], rust: ["#4a0e0e", "#8c1a18", "#c8362a", "#ff6a4a"], eyes: ["#5a0a00", "#e0301a", "#ff8a4a", "#ffe0c0"], light: GLOW.enemy * 3 }),
  trashEliteBite: bake(trashCan, { mode: "bite", palette: ["#16060a", "#320c14", "#561420", "#7e1c2a", "#b02a34", "#e0504a", "#ffa08a"], rust: ["#4a0e0e", "#8c1a18", "#c8362a", "#ff6a4a"], eyes: ["#5a0a00", "#e0301a", "#ff8a4a", "#ffe0c0"], light: GLOW.enemy * 3 }),
  // 第二章：刺蝟（走／縮球／滾，各一份閃白；菁英紅色）
  hogWalk: bake(hedgehog, { light: GLOW.enemy * 2 }),
  hogCurl: bake(hedgehog, { mode: "curl", light: GLOW.enemy * 2 }),
  hogRoll: bake(hedgehog, { mode: "roll", light: GLOW.enemy * 2 }),
  hogWhite: bake(hedgehog, { palette: flash(7), face: flash(4), shard: flash(4), light: 0 }),
  hogWhiteCurl: bake(hedgehog, { mode: "curl", palette: flash(7), face: flash(4), shard: flash(4), light: 0 }),
  hogWhiteRoll: bake(hedgehog, { mode: "roll", palette: flash(7), face: flash(4), shard: flash(4), light: 0 }),
  hogEliteWalk: bake(hedgehog, { palette: HOG_RED, face: HOG_RED_FACE, light: GLOW.enemy * 3 }),
  hogEliteCurl: bake(hedgehog, { mode: "curl", palette: HOG_RED, face: HOG_RED_FACE, light: GLOW.enemy * 3 }),
  hogEliteRoll: bake(hedgehog, { mode: "roll", palette: HOG_RED, face: HOG_RED_FACE, light: GLOW.enemy * 3 }),
  poofHog: bake(poof, { palette: ["#2c160c", "#4a2814", "#6e4020", "#965a2e", "#c4864a", "#f0c890"], light: GLOW.poof }),
  // 尖刺星的刺球衝刺：刺蝟的滾動畫換成琥珀色，背上的碎片換成星星的金
  spikeBall: bake(hedgehog, { mode: "roll", palette: ["#2a1206", "#6a3010", "#a85a1c", "#c87a2c", "#e09a3a", "#ffd890", "#fff2d0"], face: ["#a85a1c", "#ffd890", "#fff2d0", "#ffffff"], shard: ["#d08a1c", "#f5c040", "#ffe27a", "#ffffff"], light: GLOW.enemy * 2 }),
  poofTrash: bake(poof, { palette: ["#1f272c", "#313d42", "#485a5c", "#667a78", "#8ea29c", "#c4d4cc"], light: GLOW.poof }),
};

// 武器招式的刀光：用到才烘焙（換武器時在背包畫面裡烘，戰鬥中不會卡）
const slashCache = new Map([[swordSlash, A.slash[0]], [doubleSlash, A.slash[1]], [spinSlash, A.slash[2]]]);
// 大劍、大錘的衝擊有大片純白，換成暖白，比較不刺眼
const soft = (pal) => pal?.map((c) => (c.toLowerCase() === "#ffffff" ? "#e8dcc4" : c));
// 形態的招式顏色：星星＝金色星光、黏液星＝綠色黏液、鐵罐星＝鐵灰色＋橘色火花（取代原本各武器的顏色）
const FORM_SLASH = {
  star: { ramp: ["#2a1608", "#6b3c10", "#b8701a", "#f0b42e", "#ffe27a", "#fff6cf", "#ffffff"], sparks: ["#fff6cf", "#ffe27a", "#f0b42e", "#b8701a"] },
  slime: { ramp: ["#0c2010", "#1a4a20", "#2a8a3a", "#4cc04a", "#8ee86a", "#d4ffb0", "#f0fff0"], sparks: ["#d4ffb0", "#8ee86a", "#4cc04a", "#2a8a3a"] },
  bat: { ramp: ["#160c24", "#2e1a4a", "#5c388c", "#8058b8", "#b48ae8", "#e2d0ff", "#ffffff"], sparks: ["#e2d0ff", "#b48ae8", "#8058b8", "#5c388c"] },
  can: { ramp: ["#14161c", "#2a2e38", "#4a5468", "#6e7a90", "#9aa6ba", "#d0d8e6", "#eef2f8"], sparks: ["#fff3a6", "#ffc23d", "#ff8a2a", "#c44a1a"] },
  spike: { ramp: ["#2a1206", "#6a3010", "#a85a1c", "#e09a3a", "#ffd890", "#fff2d0", "#ffffff"], sparks: ["#fff2d0", "#ffd890", "#e09a3a", "#a85a1c"] },
};
// 把 7 色的 ramp 換成特效要的長度
const fit = (ramp, n) => Array.from({ length: n }, (_, i) => ramp[Math.round((i * (ramp.length - 1)) / Math.max(1, n - 1))]);
const formCache = new Map();
export function slashAnim(mod, form = null) {
  if (form && FORM_SLASH[form]) {
    const key = form + ":" + mod.meta.name;
    if (!formCache.has(key)) {
      const F = FORM_SLASH[form], o = mod.meta.options ?? {};
      formCache.set(key, bake(mod, { light: GLOW.slash * 0.8, palette: fit(F.ramp, o.palette?.length ?? 7), ...(o.sparks ? { sparks: F.sparks } : {}) }));
    }
    return formCache.get(key);
  }
  if (!slashCache.has(mod)) slashCache.set(mod, bake(mod, { light: GLOW.slash * 0.8, palette: soft(mod.meta.options?.palette) }));
  return slashCache.get(mod);
}
