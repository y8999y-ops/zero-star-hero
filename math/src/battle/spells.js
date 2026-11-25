// 五個屬性 × 四級魔法（企劃書 5、7.3），全部用 pixelfx 現成特效組合。
// 每一招是幾個「片段」：at＝出現在哪裡（caster 施法者腳下、target 怪物腳下、proj 從施法者飛向怪物），
// delay＝第幾秒出現，speed＝播放速度倍率，dur＝最多播幾秒（loop 特效到時間就淡出），opts＝pixelfx 選項。
// drop＝飛行路線往下移幾格（球心離腳下比較高的特效用）。hit＝第幾秒打中（怪物散開、數字跳出）。

import * as fireball from "../../../pixelfx/src/fx/fire/fireball.js";
import * as flamePillar from "../../../pixelfx/src/fx/fire/flame-pillar.js";
import * as fireTornado from "../../../pixelfx/src/fx/fire/fire-tornado.js";
import * as meteor from "../../../pixelfx/src/fx/fire/meteor.js";
import * as waterJet from "../../../pixelfx/src/fx/water/water-jet.js";
import * as geyser from "../../../pixelfx/src/fx/water/geyser.js";
import * as whirlpool from "../../../pixelfx/src/fx/water/whirlpool.js";
import * as waveCrash from "../../../pixelfx/src/fx/water/wave-crash.js";
import * as iceLance from "../../../pixelfx/src/fx/ice/ice-lance.js";
import * as iceSpikes from "../../../pixelfx/src/fx/ice/ice-spikes.js";
import * as frostNova from "../../../pixelfx/src/fx/ice/frost-nova.js";
import * as blizzard from "../../../pixelfx/src/fx/ice/blizzard-vortex.js";
import * as icicleFall from "../../../pixelfx/src/fx/ice/icicle-fall.js";
import * as vineWhip from "../../../pixelfx/src/fx/nature/vine-whip.js";
import * as thorns from "../../../pixelfx/src/fx/nature/thorns.js";
import * as leafStorm from "../../../pixelfx/src/fx/nature/leaf-storm.js";
import * as ballLightning from "../../../pixelfx/src/fx/lightning/ball-lightning.js";
import * as chainLightning from "../../../pixelfx/src/fx/lightning/chain-lightning.js";
import * as strike from "../../../pixelfx/src/fx/lightning/lightning-strike.js";
import * as castCircle from "../../../pixelfx/src/fx/arcane/rune-circle.js";
import * as poof from "../../../pixelfx/src/fx/spawn/poof.js";
import * as xpOrb from "../../../pixelfx/src/fx/pickups/xp-orb.js";
import * as hitFlash from "../../../pixelfx/src/fx/impacts/hit-flash.js";
import * as slime from "../../../pixelfx/src/fx/critters/slime.js";
import * as spellCharge from "../../../pixelfx/src/fx/arcane/spell-charge.js";
import * as manaBurst from "../../../pixelfx/src/fx/arcane/mana-burst.js";
import * as critHit from "../../../pixelfx/src/fx/impacts/crit-hit.js";
import * as hitSpark from "../../../pixelfx/src/fx/impacts/hit-spark.js";
import { PAL } from "../../../pixelfx/src/core/index.js";

export const FX = { castCircle, poof, xpOrb, hitFlash, slime, spellCharge, manaBurst, critHit, hitSpark };

// 墨水色：深墨藍紫，亮部帶一點紫光（世界觀：被放棄的題目變成的墨水）
export const INK = ["#05040a", "#0f0b1c", "#1c1533", "#2d2350", "#463a78", "#7a6cb0", "#d8d0ff"];
// 墨水散開成光點：從墨色漸漸變亮
export const INK_POOF = ["#1c1533", "#463a78", "#7a6cb0", "#b6a8f0", "#e8e2ff", "#ffffff"];

const S = (mod, at, o = {}) => ({ mod, at, delay: 0, speed: 1, dur: Infinity, ...o });

export const SPELLS = {
  fire: [
    { hit: 0.45, parts: [S(fireball, "proj", { dur: 0.5, opts: { radius: 7 } })] },
    { hit: 0.55, parts: [S(flamePillar, "target", { speed: 2.6, opts: { height: 120 } })] },
    { hit: 0.6, parts: [S(fireTornado, "target", { dur: 1.3, speed: 1.2 }), S(fireball, "proj", { dur: 0.45 })] },
    { hit: 1.0, shake: 6, parts: [S(meteor, "target", { speed: 1.9 })] },
  ],
  water: [
    { hit: 0.3, parts: [S(waterJet, "caster", { dur: 0.6, opts: { length: 0 } })] },
    { hit: 0.45, parts: [S(geyser, "target", { speed: 1.8, dur: 1.4 })] },
    { hit: 0.6, parts: [S(whirlpool, "target", { dur: 1.2, speed: 1.4 }), S(geyser, "target", { delay: 0.3, speed: 2, dur: 1.1 })] },
    { hit: 0.9, shake: 5, parts: [S(waveCrash, "target", { speed: 1.7 })] },
  ],
  ice: [
    { hit: 0.4, parts: [S(iceLance, "proj", { dur: 0.45 })] },
    { hit: 0.5, parts: [S(iceSpikes, "caster", { speed: 2.4 })] },
    { hit: 0.6, parts: [S(frostNova, "target", { speed: 2 })] },
    { hit: 0.75, shake: 6, parts: [S(frostNova, "target", { speed: 1.7 }), S(icicleFall, "target", { speed: 1.5, delay: 0.1 }), S(blizzard, "target", { dur: 1.4, delay: 0.4, speed: 1.3 })] },
  ],
  forest: [
    { hit: 0.45, parts: [S(vineWhip, "caster", { speed: 1.3 })] },
    { hit: 0.55, parts: [S(thorns, "caster", { speed: 1.7 })] },
    { hit: 0.6, parts: [S(leafStorm, "target", { dur: 1.3, speed: 1.3 }), S(thorns, "caster", { speed: 2 })] },
    { hit: 0.7, shake: 5, parts: [S(thorns, "caster", { speed: 2.2 }), S(vineWhip, "caster", { speed: 1.5, delay: 0.1 }), S(leafStorm, "target", { dur: 1.6, delay: 0.25, speed: 1.4 })] },
  ],
  thunder: [
    { hit: 0.45, parts: [S(ballLightning, "proj", { dur: 0.45, speed: 2, drop: 30 })] },
    { hit: 0.35, parts: [S(chainLightning, "caster", { speed: 1.8 })] },
    { hit: 0.55, parts: [S(strike, "target", { speed: 2.2 })] },
    { hit: 0.7, shake: 7, parts: [S(strike, "target", { speed: 2.2 }), S(strike, "target", { delay: 0.25, speed: 2.4, x: -30, opts: { seed: 3 } }), S(strike, "target", { delay: 0.45, speed: 2.4, x: 30, opts: { seed: 5 } }), S(ballLightning, "target", { dur: 1.2, delay: 0.3 })] },
  ],
};

// 數晶等級讓魔法更亮（企劃書 8.7：外觀進化先用參數做）
export const crystalLight = (lv) => 0.8 + 0.15 * (lv - 1);
export { PAL };
