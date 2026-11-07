// 碎星鎮的居民（第二版，使用者 2026-11-04 確認＝docs/NPC草稿-v2.png）：照 PixelFX 小生物的畫法重做，
// 程式在 game/fx/town/（town-slime、golem、mushroom、turtle）。這裡把它們烘焙成動畫，給城鎮、路人、對話框頭像用。
//   店家：波波（公會櫃檯）、岩叔（工坊）、菇媽（旅館）——待機動畫
//   路人：啵啵、慢慢、碎碎、菇菇寶寶（兩顆）——走路／停下來兩種動畫
// 第一次用到才烘焙（只有城鎮會用），之後直接貼。
import { bake, blit } from "./bake.js";
import * as townSlime from "../fx/town/town-slime.js";
import * as golem from "../fx/town/golem.js";
import * as mushroom from "../fx/town/mushroom.js";
import * as turtle from "../fx/town/turtle.js";

// id → [特效, 待機的選項, 走路的選項]
const DEFS = {
  clerk: [townSlime, { kind: "clerk", mode: "idle" }],
  golem: [golem, { kind: "boss", mode: "idle" }],
  mushroom: [mushroom, { kind: "mom", mode: "idle" }],
  kid: [townSlime, { kind: "kid", mode: "idle" }, { kind: "kid", mode: "walk" }],
  turtle: [turtle, { mode: "idle" }, { mode: "walk" }],
  pebble: [golem, { kind: "pupil", mode: "idle" }, { kind: "pupil", mode: "walk" }],
  shroom: [mushroom, { kind: "kid", mode: "idle" }, { kind: "kid", mode: "walk" }],
  shroom2: [mushroom, { kind: "kid", mode: "idle" }, { kind: "kid", mode: "walk", lag: 0.25 }],   // 後面那顆慢一點
};
const cache = {};
function anim(id, walk) {
  const k = id + (walk ? ":walk" : "");
  if (!cache[k]) { const [mod, idle, w] = DEFS[id]; cache[k] = bake(mod, walk && w ? w : idle); }
  return cache[k];
}

/** Unity 轉移用：烘焙好的動畫（待機或走路） */
export const npcAnim = (id, walk = false) => anim(id, walk);
export const NPC_IDS = Object.keys(DEFS);
/** 畫到 frame：x 是腳底中間、y 是腳底（世界座標），t 是動畫時間（秒），flip 面朝左，walk 走路中 */
export function paintNpc(frame, id, t, x, y, flip = false, walk = false) {
  blit(frame, anim(id, walk), t, x, y + 1, flip);
}
/** 大小 [寬, 高]（高＝腳底到頭頂） */
export function npcSize(id) {
  const s = anim(id, false).frames[0];
  return [s.w, -s.ly];
}
/** 對話框頭像用：第 f 格（0～7，待機動畫平均分成 8 格）→ { px: 顏色（ABGR 數字）的二維陣列, W, H } */
const faceCache = {};
export function npcFrame(id, f) {
  const k = id + f;
  if (faceCache[k]) return faceCache[k];
  const a = anim(id, false), s = a.frames[Math.floor(((f % 8) * a.frames.length) / 8)];
  const px = Array.from({ length: s.h }, (_, y) => Array.from({ length: s.w }, (_, x) => { const c = s.color[y * s.w + x]; return c >>> 24 > 160 ? (c | 0xff000000) >>> 0 : 0; }));
  return (faceCache[k] = { px, W: s.w, H: s.h });
}
