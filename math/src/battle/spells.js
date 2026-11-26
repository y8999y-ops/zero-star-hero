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
import * as arcaneOrb from "../../../pixelfx/src/fx/arcane/arcane-orb.js";
import * as arcaneMissiles from "../../../pixelfx/src/fx/arcane/arcane-missiles.js";
import * as arcaneBeam from "../../../pixelfx/src/fx/arcane/arcane-beam.js";
import * as starFall from "../../../pixelfx/src/fx/arcane/star-fall.js";
import * as timeStop from "../../../pixelfx/src/fx/arcane/time-stop.js";
import * as circleCast from "../../../pixelfx/src/fx/arcane/magic-circle-cast.js";
import * as smite from "../../../pixelfx/src/fx/holy/smite.js";
import * as holyPillar from "../../../pixelfx/src/fx/holy/holy-pillar.js";
import * as fireworkBurst from "../../../pixelfx/src/fx/explosions/firework-burst.js";
import * as groundSlam from "../../../pixelfx/src/fx/impacts/ground-slam.js";
import * as fireRing from "../../../pixelfx/src/fx/fire/fire-ring.js";
import * as fireBreath from "../../../pixelfx/src/fx/fire/fire-breath.js";
import * as flamethrower from "../../../pixelfx/src/fx/fire/flamethrower.js";
import * as spiritFlame from "../../../pixelfx/src/fx/fire/spirit-flame.js";
import * as smallExplosion from "../../../pixelfx/src/fx/explosions/small-explosion.js";
import * as waterOrb from "../../../pixelfx/src/fx/water/water-orb.js";
import * as splash from "../../../pixelfx/src/fx/water/splash.js";
import * as ripples from "../../../pixelfx/src/fx/water/ripples.js";
import * as iceCrystal from "../../../pixelfx/src/fx/ice/ice-crystal.js";
import * as iceShatter from "../../../pixelfx/src/fx/ice/ice-shatter.js";
import * as frostBreath from "../../../pixelfx/src/fx/ice/frost-breath.js";
import * as snowBurst from "../../../pixelfx/src/fx/ice/snowflake-burst.js";
import * as freeze from "../../../pixelfx/src/fx/ice/freeze.js";
import * as earthSpike from "../../../pixelfx/src/fx/nature/earth-spike.js";
import * as rootSnare from "../../../pixelfx/src/fx/nature/root-snare.js";
import * as sporeBurst from "../../../pixelfx/src/fx/nature/spore-burst.js";
import * as boulder from "../../../pixelfx/src/fx/nature/boulder.js";
import * as tornado from "../../../pixelfx/src/fx/nature/tornado.js";
import * as quake from "../../../pixelfx/src/fx/nature/quake.js";
import * as plasmaBall from "../../../pixelfx/src/fx/lightning/plasma-ball.js";
import * as sparkArc from "../../../pixelfx/src/fx/lightning/spark-arc.js";
import * as thunderclap from "../../../pixelfx/src/fx/lightning/thunderclap.js";
import * as zapHit from "../../../pixelfx/src/fx/lightning/zap-hit.js";
import * as stormCloud from "../../../pixelfx/src/fx/lightning/storm-cloud.js";
import * as electrified from "../../../pixelfx/src/fx/lightning/electrified.js";
import * as implosion from "../../../pixelfx/src/fx/explosions/implosion.js";
import * as sunburst from "../../../pixelfx/src/fx/holy/sunburst.js";
import * as healFx from "../../../pixelfx/src/fx/holy/heal.js";
import * as divineShield from "../../../pixelfx/src/fx/holy/divine-shield.js";
import * as haste from "../../../pixelfx/src/fx/status/haste.js";
import * as slowed from "../../../pixelfx/src/fx/status/slowed.js";
import * as burning from "../../../pixelfx/src/fx/status/burning.js";
import * as frozenFx from "../../../pixelfx/src/fx/status/frozen.js";
import * as poisoned from "../../../pixelfx/src/fx/status/poisoned.js";
import * as bleeding from "../../../pixelfx/src/fx/status/bleeding.js";
import * as bluntHit from "../../../pixelfx/src/fx/impacts/blunt-hit.js";
import { PAL } from "../../../pixelfx/src/core/index.js";

export const FX = { castCircle, poof, xpOrb, hitFlash, slime, spellCharge, manaBurst, critHit, hitSpark, implosion, sunburst, healFx, divineShield, haste, slowed, circleCast, fireworkBurst, bluntHit };

// 墨水色：深墨藍紫，亮部帶一點紫光（世界觀：被放棄的題目變成的墨水）
export const INK = ["#05040a", "#0f0b1c", "#1c1533", "#2d2350", "#463a78", "#7a6cb0", "#d8d0ff"];
// 墨水散開成光點：從墨色漸漸變亮
export const INK_POOF = ["#1c1533", "#463a78", "#7a6cb0", "#b6a8f0", "#e8e2ff", "#ffffff"];

const S = (mod, at, o = {}) => ({ mod, at, delay: 0, speed: 1, dur: Infinity, ...o });

// 2026-11-25 使用者：學系能力取消，五種法師只差造型和攻擊特效 → 每一級有好幾種招式，每次隨機挑一種（不跟上一次一樣）
// SPELLS[屬性][級數 0～3] ＝ 招式陣列
export const SPELLS = {
  fire: [
    [{ hit: 0.45, parts: [S(fireball, "proj", { dur: 0.5, opts: { radius: 7 } })] },
     { hit: 0.4, parts: [S(flamethrower, "caster", { dur: 0.75, speed: 1.4, y: -20 })] },
     { hit: 0.45, parts: [S(spiritFlame, "target", { dur: 0.9, speed: 2, opts: { palette: PAL.fire } }), S(fireball, "proj", { dur: 0.4, opts: { radius: 5 } })] }],
    [{ hit: 0.55, parts: [S(flamePillar, "target", { speed: 2.6, opts: { height: 120 } })] },
     { hit: 0.45, parts: [S(fireBreath, "caster", { dur: 0.9, speed: 1.4, y: -14 })] },
     { hit: 0.5, parts: [S(fireRing, "target", { speed: 2.6 })] }],
    [{ hit: 0.6, parts: [S(fireTornado, "target", { dur: 1.3, speed: 1.2 }), S(fireball, "proj", { dur: 0.45 })] },
     { hit: 0.6, parts: [S(fireRing, "target", { speed: 2.4 }), S(flamePillar, "target", { delay: 0.25, speed: 2.6, opts: { height: 120 } })] },
     { hit: 0.55, parts: [S(flamethrower, "caster", { dur: 0.9, speed: 1.4, y: -20 }), S(spiritFlame, "target", { delay: 0.3, dur: 0.9, speed: 2, opts: { palette: PAL.fire } })] }],
    [{ hit: 1.0, shake: 6, parts: [S(meteor, "target", { speed: 1.9 })] },
     { hit: 1.0, shake: 7, parts: [S(meteor, "target", { speed: 1.9 }), S(fireRing, "target", { delay: 0.75, speed: 2.4 })] },
     { hit: 0.7, shake: 6, parts: [S(fireTornado, "target", { dur: 1.4, speed: 1.3 }), S(flamePillar, "target", { delay: 0.2, x: -26, speed: 2.6, opts: { height: 110, seed: 3 } }), S(flamePillar, "target", { delay: 0.35, x: 26, speed: 2.6, opts: { height: 110, seed: 7 } })] }],
  ],
  water: [
    [{ hit: 0.3, parts: [S(waterJet, "caster", { dur: 0.6, opts: { length: 0 } })] },
     { hit: 0.45, parts: [S(waterOrb, "proj", { dur: 0.5, speed: 1.6, drop: 40, opts: { radius: 12 } }), S(splash, "target", { delay: 0.4, speed: 2.4 })] },
     { hit: 0.35, parts: [S(splash, "target", { speed: 2.2 }), S(ripples, "target", { dur: 0.9, speed: 1.6, y: 2 })] }],
    [{ hit: 0.45, parts: [S(geyser, "target", { speed: 1.8, dur: 1.4 })] },
     { hit: 0.75, parts: [S(waterOrb, "proj", { dur: 0.45, speed: 1.6, drop: 40, opts: { radius: 13 } }), S(geyser, "target", { delay: 0.4, speed: 2, dur: 1.1 })] },
     { hit: 0.5, parts: [S(waterOrb, "target", { dur: 0.9, speed: 1.8, opts: { radius: 14 } }), S(splash, "target", { delay: 0.35, speed: 2.4 })] }],
    [{ hit: 0.6, parts: [S(whirlpool, "target", { dur: 1.2, speed: 1.4 }), S(geyser, "target", { delay: 0.3, speed: 2, dur: 1.1 })] },
     { hit: 0.8, parts: [S(geyser, "target", { speed: 2, dur: 1.1, x: -24 }), S(geyser, "target", { delay: 0.15, speed: 2, dur: 1.1, x: 24, opts: { seed: 4 } }), S(splash, "target", { delay: 0.4, speed: 2.4 })] }],
    [{ hit: 0.9, shake: 5, parts: [S(waveCrash, "target", { speed: 1.7 })] },
     { hit: 0.85, shake: 6, parts: [S(whirlpool, "target", { dur: 1.3, speed: 1.4 }), S(waveCrash, "target", { delay: 0.2, speed: 1.8 }), S(splash, "target", { delay: 0.7, speed: 2.2 })] }],
  ],
  ice: [
    [{ hit: 0.4, parts: [S(iceLance, "proj", { dur: 0.45 })] },
     { hit: 0.4, parts: [S(frostBreath, "caster", { dur: 0.75, speed: 1.4, y: -20 })] },
     { hit: 0.45, parts: [S(iceCrystal, "target", { dur: 0.6, speed: 2 }), S(iceShatter, "target", { delay: 0.4, speed: 2.4, x: 20 })] }],
    [{ hit: 0.5, parts: [S(iceSpikes, "caster", { speed: 2.4 })] },
     { hit: 0.45, parts: [S(snowBurst, "target", { speed: 2.2 }), S(iceLance, "proj", { dur: 0.4 })] },
     { hit: 0.45, parts: [S(iceLance, "proj", { dur: 0.4, drop: -12 }), S(iceLance, "proj", { dur: 0.4, delay: 0.1, drop: 12 }), S(iceShatter, "target", { delay: 0.45, speed: 2.4, x: 20 })] }],
    [{ hit: 0.6, parts: [S(frostNova, "target", { speed: 2 })] },
     { hit: 0.65, parts: [S(freeze, "target", { speed: 2.2 }), S(snowBurst, "target", { delay: 0.3, speed: 2.2 })] },
     { hit: 0.55, parts: [S(icicleFall, "target", { speed: 1.7 }), S(frostBreath, "caster", { dur: 0.6, speed: 1.4, y: -20 })] }],
    [{ hit: 0.75, shake: 6, parts: [S(frostNova, "target", { speed: 1.7 }), S(icicleFall, "target", { speed: 1.5, delay: 0.1 }), S(blizzard, "target", { dur: 1.4, delay: 0.4, speed: 1.3 })] },
     { hit: 0.8, shake: 7, parts: [S(freeze, "target", { speed: 1.9 }), S(iceSpikes, "caster", { delay: 0.2, speed: 2.4 }), S(iceShatter, "target", { delay: 0.7, speed: 2, x: 20 })] }],
  ],
  forest: [
    [{ hit: 0.45, parts: [S(vineWhip, "caster", { speed: 1.3 })] },
     { hit: 0.5, parts: [S(rootSnare, "target", { speed: 2.2 })] },
     { hit: 0.45, parts: [S(sporeBurst, "target", { speed: 2.4, x: -10, opts: { palette: PAL.leaf } })] }],
    [{ hit: 0.55, parts: [S(thorns, "caster", { speed: 1.7 })] },
     { hit: 0.55, parts: [S(earthSpike, "target", { speed: 2.4, opts: { height: 60 } })] },
     { hit: 0.85, parts: [S(boulder, "caster", { speed: 1.7, x: -10 })] }],
    [{ hit: 0.6, parts: [S(leafStorm, "target", { dur: 1.3, speed: 1.3 }), S(thorns, "caster", { speed: 2 })] },
     { hit: 0.6, parts: [S(tornado, "target", { dur: 1.3, speed: 1.4, opts: { height: 90 } }), S(rootSnare, "target", { delay: 0.2, speed: 2.2 })] },
     { hit: 0.6, parts: [S(rootSnare, "target", { speed: 2.2 }), S(sporeBurst, "target", { delay: 0.3, speed: 2.4, opts: { palette: PAL.leaf } })] }],
    [{ hit: 0.7, shake: 5, parts: [S(thorns, "caster", { speed: 2.2 }), S(vineWhip, "caster", { speed: 1.5, delay: 0.1 }), S(leafStorm, "target", { dur: 1.6, delay: 0.25, speed: 1.4 })] },
     { hit: 0.75, shake: 8, parts: [S(quake, "target", { speed: 2.2, x: -40 }), S(earthSpike, "target", { delay: 0.3, speed: 2.4, opts: { height: 80 } })] }],
  ],
  thunder: [
    [{ hit: 0.45, parts: [S(ballLightning, "proj", { dur: 0.45, speed: 2, drop: 30 })] },
     { hit: 0.4, parts: [S(sparkArc, "target", { dur: 0.8, speed: 2 }), S(zapHit, "target", { delay: 0.3, speed: 1.6, y: -20 })] },
     { hit: 0.4, parts: [S(electrified, "target", { dur: 0.8, speed: 2 }), S(ballLightning, "proj", { dur: 0.4, speed: 2, drop: 30 })] }],
    [{ hit: 0.35, parts: [S(chainLightning, "caster", { speed: 1.8 })] },
     { hit: 0.5, parts: [S(plasmaBall, "target", { dur: 0.9, speed: 1.8 }), S(zapHit, "target", { delay: 0.4, speed: 1.6, y: -20 })] },
     { hit: 0.45, parts: [S(stormCloud, "target", { dur: 0.9, speed: 1.6, y: 24 }), S(zapHit, "target", { delay: 0.35, speed: 1.6, y: -20 })] }],
    [{ hit: 0.55, parts: [S(strike, "target", { speed: 2.2 })] },
     { hit: 0.6, parts: [S(stormCloud, "target", { dur: 1.1, speed: 1.6, y: 24 }), S(strike, "target", { delay: 0.35, speed: 2.2 })] },
     { hit: 0.5, parts: [S(chainLightning, "caster", { speed: 1.8 }), S(electrified, "target", { delay: 0.25, dur: 0.8, speed: 2 })] }],
    [{ hit: 0.7, shake: 7, parts: [S(strike, "target", { speed: 2.2 }), S(strike, "target", { delay: 0.25, speed: 2.4, x: -30, opts: { seed: 3 } }), S(strike, "target", { delay: 0.45, speed: 2.4, x: 30, opts: { seed: 5 } }), S(ballLightning, "target", { dur: 1.2, delay: 0.3 })] },
     { hit: 0.65, shake: 8, parts: [S(stormCloud, "target", { dur: 1.2, speed: 1.6, y: 24 }), S(thunderclap, "target", { delay: 0.3, speed: 1.8 }), S(strike, "target", { delay: 0.35, speed: 2.2 })] }],
  ],
};

// 每種屬性打中時自己的火花（打擊感也跟著屬性變）
export const ATTR_HIT = {
  fire: S(smallExplosion, "target", { speed: 1.8, y: -8 }),
  water: S(splash, "target", { speed: 2.6 }),
  ice: S(iceShatter, "target", { speed: 2.4, x: 18 }),
  forest: S(sporeBurst, "target", { speed: 2.8, dur: 0.8, opts: { palette: PAL.leaf } }),
  thunder: S(zapHit, "target", { speed: 1.6, y: -20 }),
};

// 每一級隨機挑一招，不跟上一次一樣
const lastPick = {};
export function pickSpell(attr, tierIdx) {
  const list = SPELLS[attr]?.[tierIdx] ?? SPELLS.fire[tierIdx];
  const key = `${attr}${tierIdx}`;
  let i = Math.floor(Math.random() * list.length);
  if (list.length > 1 && i === lastPick[key]) i = (i + 1) % list.length;
  lastPick[key] = i;
  return list[i];
}

// 數晶等級讓魔法更亮（企劃書 8.7：外觀進化先用參數做）
export const crystalLight = (lv) => 0.8 + 0.15 * (lv - 1);
export { PAL };


// ── 題目決定招式（2026-11-25 使用者：攻擊特效太單一、變化性太少 → 照建議先做「題目決定招式」）──
// 答對時打出的招式形狀看「這題是哪個單元」，顏色用自己的屬性色（stage.js 會把 palette 換成屬性色階）。
// 連擊到第 3、4 級時，再疊上原本的屬性大招（SPELLS）。tint：true＝這個片段要換成屬性色。
const U = (mod, at, o = {}) => ({ ...S(mod, at, o), tint: true });
export const UNIT_SPELL = {
  // 大數與加減：兩顆光球從上下飛過去，在怪物身上合體
  big: { hit: 0.5, parts: [U(arcaneOrb, "proj", { dur: 0.5, speed: 1.6, drop: 50 }), U(arcaneOrb, "proj", { dur: 0.5, speed: 1.6, drop: 80, delay: 0.05 })] },
  // 乘法：一排魔法飛彈連發（分身）
  mul: { hit: 0.7, parts: [U(arcaneMissiles, "caster", { speed: 1.5 })] },
  // 除法：一道光束把怪物切開
  div: { hit: 0.4, parts: [U(arcaneBeam, "caster", { dur: 0.7, speed: 1.5, opts: { length: 0 } })] },
  // 四則併式：先一顆光球、再一道天降光錘（兩段）
  mix: { hit: 0.75, parts: [U(arcaneOrb, "proj", { dur: 0.45, speed: 1.6, drop: 66 }), U(smite, "target", { delay: 0.3, speed: 2.2 })] },
  // 分數：怪物腳下展開魔法陣（像分成好幾份的圓）
  frac: { hit: 0.6, parts: [U(circleCast, "target", { speed: 1.8 }), U(manaBurst, "target", { speed: 1.9, delay: 0.15 })] },
  // 小數：光點煙火炸開
  dec: { hit: 0.45, parts: [U(fireworkBurst, "target", { speed: 1.9, y: -40 })] },
  // 面積、周長、角度：光柱從地上衝起來
  shape: { hit: 0.6, parts: [U(holyPillar, "target", { speed: 2 })] },
  // 時間與單位：時間停止的鐘環
  measure: { hit: 0.6, parts: [U(timeStop, "target", { speed: 2.2 })] },
  // 概數與估算：重重砸在地上的衝擊波（先抓大概）
  round: { hit: 0.5, parts: [U(groundSlam, "target", { speed: 2.2, x: -20 })] },
  // 數量規律：一串星星接連落下
  seq: { hit: 0.7, parts: [U(starFall, "target", { speed: 1.8 })] },
};


// ── 數晶大招（2026-11-26 使用者：大招特效做的不夠好）──
// 跟連擊的「終極魔法」分開：先集氣（畫面暗下來、杖頭把光吸進來），再一連串屬性大招轟下去，最後一圈光爆。
// name＝跳字顯示的招式名；hit＝從轟炸開始算第幾秒打中。
export const ULT = {
  fire: { name: "流星焚天", hit: 1.05, parts: [
    S(meteor, "target", { speed: 1.9, x: -34, opts: { seed: 2 } }), S(meteor, "target", { delay: 0.18, speed: 1.9 }), S(meteor, "target", { delay: 0.34, speed: 1.9, x: 34, opts: { seed: 5 } }),
    S(fireRing, "target", { delay: 0.85, speed: 2.2 }), S(flamePillar, "target", { delay: 0.9, x: -40, speed: 2.4, opts: { height: 120, seed: 3 } }), S(flamePillar, "target", { delay: 1.0, x: 40, speed: 2.4, opts: { height: 120, seed: 8 } })] },
  water: { name: "萬潮歸海", hit: 0.95, parts: [
    S(whirlpool, "target", { dur: 1.6, speed: 1.4 }), S(geyser, "target", { delay: 0.1, x: -40, speed: 2, dur: 1.2, opts: { seed: 2 } }), S(geyser, "target", { delay: 0.25, x: 40, speed: 2, dur: 1.2, opts: { seed: 6 } }),
    S(waveCrash, "target", { delay: 0.3, speed: 1.8 }), S(splash, "target", { delay: 0.95, speed: 2.2 }), S(splash, "target", { delay: 1.1, x: 30, speed: 2.2, opts: { seed: 4 } })] },
  ice: { name: "千冰封界", hit: 1.0, parts: [
    S(iceSpikes, "caster", { speed: 2.4 }), S(icicleFall, "target", { speed: 1.6, x: -26 }), S(icicleFall, "target", { delay: 0.2, speed: 1.6, x: 26, opts: { seed: 4 } }),
    S(blizzard, "target", { dur: 1.6, delay: 0.3, speed: 1.3 }), S(frostNova, "target", { delay: 0.85, speed: 1.8 }), S(iceShatter, "target", { delay: 1.0, speed: 2, x: 20 })] },
  forest: { name: "萬木參天", hit: 1.0, parts: [
    S(thorns, "caster", { speed: 2.2 }), S(quake, "target", { delay: 0.2, speed: 2.2, x: -40 }),
    S(earthSpike, "target", { delay: 0.45, x: -30, speed: 2.4, opts: { height: 70, seed: 2 } }), S(earthSpike, "target", { delay: 0.6, x: 30, speed: 2.4, opts: { height: 70, seed: 6 } }), S(earthSpike, "target", { delay: 0.8, speed: 2.4, opts: { height: 96 } }),
    S(leafStorm, "target", { dur: 1.6, delay: 0.3, speed: 1.4 })] },
  thunder: { name: "九天雷鳴", hit: 1.0, parts: [
    S(stormCloud, "target", { dur: 1.7, speed: 1.6, y: 24 }),
    S(strike, "target", { delay: 0.3, speed: 2.4, x: -36, opts: { seed: 2 } }), S(strike, "target", { delay: 0.45, speed: 2.4, x: 36, opts: { seed: 4 } }), S(strike, "target", { delay: 0.6, speed: 2.4, x: -14, opts: { seed: 6 } }), S(strike, "target", { delay: 0.75, speed: 2.4, x: 14, opts: { seed: 8 } }),
    S(strike, "target", { delay: 0.95, speed: 2.2 }), S(thunderclap, "target", { delay: 0.95, speed: 1.8 })] },
};

// 怪物被打中的屬性反應（2026-11-26 使用者：怪被打到要有對應特效表現）：火＝燒起來、冰＝結霜、雷＝觸電、水＝濕答答滴水、森＝冒孢子
export const REACT = {
  fire: { mod: burning, dur: 0.9, y: 4, tint: "#ff7a2f" },
  ice: { mod: frozenFx, dur: 1.0, y: 2, tint: "#9be3ff" },
  thunder: { mod: electrified, dur: 0.8, y: 4, tint: "#d8b8ff", jitter: true },
  water: { mod: bleeding, dur: 1.0, y: -6, tint: "#3fa7ff", opts: { palette: PAL.water } },
  forest: { mod: poisoned, dur: 1.0, y: 0, tint: "#6fd46a", opts: { palette: PAL.leaf } },
};
