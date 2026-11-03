// 主角的移動姿勢。攻擊姿勢直接借用 PixelFX 特效裡的 act.poses。
// 座標規則見 pixelfx/src/core/poses.js：腳底在 (0, 0)，y 負值向上，面朝右。
import { READY } from "../../pixelfx/src/core/index.js";

export const GUARD = { ...READY, weapon: "sword", fx: 12, fy: -21, sa: -0.85 };

// 跑步：四張關鍵姿勢循環，劍拖在身後
const RUN = { weapon: "sword", lean: 6, crouch: 2, sa: -2.55, by: -22 };
export const RUN_CYCLE = [
  { ...RUN, fx: -5, fy: -18, bx: 9, ffx: 9, ffy: -4, fbx: -8, fby: -8 },
  { ...RUN, crouch: 0, fx: 0, fy: -19, bx: 5, ffx: 2, ffy: -4, fbx: -1, fby: -11 },
  { ...RUN, fx: 5, fy: -20, sa: -2.4, bx: -2, ffx: -8, ffy: -8, fbx: 9, fby: -4 },
  { ...RUN, crouch: 0, fx: 0, fy: -19, bx: 5, ffx: -1, ffy: -11, fbx: 2, fby: -4 },
];

// y: -1 只是告訴繪製器「人在空中」，腳不會被地面裁掉
export const JUMP = { weapon: "sword", y: -1, lean: 2, fx: 6, fy: -27, sa: -1.9, bx: 10, by: -31, ffx: 5, ffy: -13, fbx: -5, fby: -8 };
export const FALL = { weapon: "sword", y: -1, lean: -2, fx: 9, fy: -30, sa: -0.6, bx: -6, by: -32, ffx: 6, ffy: -4, fbx: -5, fby: -7 };
export const LAND = { ...GUARD, crouch: 7, lean: 4, ffx: 8, fbx: -8 };
export const DASH = { weapon: "sword", lean: 12, crouch: 7, fx: -9, fy: -17, sa: 2.8, bx: -5, by: -19, ffx: 13, fbx: -12, ghost: 1 };
export const HURT = { weapon: "sword", lean: -7, crouch: 3, fx: -3, fy: -27, sa: -2.2, bx: -7, by: -30, ffx: 6, fbx: -9 };
