// 特效管理：產生、更新、畫在角色前面或後面，加上命中停頓（hit-stop）和畫面震動。
import { createFx, PAL } from "../../pixelfx/src/core/index.js";
import { play } from "./bake.js";

const MAX = 70;
const list = [];

/**
 * 放一個特效。o 是 PixelFX 的選項（x, y, flip, palette...）；layer: "front"（預設）或 "back"。
 * keep: true 表示是持續存在的（火把），不受數量上限影響。
 */
export function spawn(mod, o = {}, { layer = "front", keep = false, speed = 1 } = {}) {
  // 烘焙好的動畫（有 frames）用播放器，其他即時運算
  const fx = mod.frames ? play(mod, o) : createFx(mod, o);
  const e = { fx, layer, keep, speed };
  list.push(e);
  if (list.length > MAX) {
    const i = list.findIndex((q) => !q.keep);
    if (i >= 0) list.splice(i, 1);
  }
  return fx;
}

export function updateFx(dt) {
  for (const e of list) e.fx.update(dt * e.speed);
  for (let i = list.length - 1; i >= 0; i--) if (list[i].fx.done()) list.splice(i, 1);
}
/** layer: "back" 只畫背景層，"front" 只畫前景層。 */
export function drawFx(frame, layer) {
  const mid = frame.ox + frame.w / 2;
  for (const e of list) {
    // 畫面外太遠的不畫（特效最大約 400px 寬）
    if (e.layer === layer && Math.abs((e.fx.options.x ?? mid) - mid) < frame.w / 2 + 220) e.fx.draw(frame);
  }
}
export const fxCount = () => list.length;

// ---- 命中停頓與震動
export const juice = { freeze: 0, shakeT: 0, shake0: 0, amp: 0 };
export function hitStop(sec) {
  juice.freeze = Math.max(juice.freeze, sec);
}
export function shake(sec, amp, keep = false) {   // keep：王的吼叫、大招這類大震動不減半
  if (amp < 4 && !keep) amp *= 0.5;   // 使用者 2026-11-05「鏡頭太晃」：一般打擊的震動減半，只留大招、王戰的大震動
  if (amp >= juice.amp * (juice.shakeT / (juice.shake0 || 1))) {
    juice.shakeT = juice.shake0 = sec;
    juice.amp = amp;
  }
}
export function shakeOffset() {
  if (juice.shakeT <= 0) return [0, 0];
  const k = juice.amp * (juice.shakeT / juice.shake0), f = Math.floor(juice.shakeT * 60);
  return [Math.round(Math.sin(f * 2.4) * k), Math.round(Math.cos(f * 3.7) * k * 0.7)];
}

export { PAL };
