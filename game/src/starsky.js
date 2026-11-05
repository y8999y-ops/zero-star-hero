// 夜空（2026-11-05 第二版，照 pixelfx skill：能用庫裡現成的就用）：直接用 pixelfx 的 weather/shooting-stars
// （銀河的光帶、會閃的星星、偶爾有亮星的十字光芒、流星白頭拖著金色到玫瑰色的尾巴，大的會爆開、留下會扭動慢慢散掉的光痕），
// 底下墊一層由上往下深藍→紫的漸層。城鎮、主畫面、開場共用。第一版（自己畫的星星和流星）不用了。
import * as shootingStars from "../../pixelfx/src/fx/weather/shooting-stars.js";
import { createFrame, clearFrame, createFx, composite } from "../../pixelfx/src/core/index.js";

export const SKY_W = 320, SKY_H = 180;
// 星空的顏色換成遊戲的紫色夜晚（原本偏灰藍）
const OPTS = { sky: ["#120c26", "#2a1e4a", "#4a3878", "#9a88d0", "#e8e0ff"], seed: 4 };
const GRAD = [[0, [8, 6, 24]], [0.4, [20, 13, 48]], [0.75, [44, 22, 78]], [1, [86, 40, 100]]];
const lerp = (a, b, t) => a + (b - a) * t;
function gradAt(t) {
  for (let i = 1; i < GRAD.length; i++) if (t <= GRAD[i][0]) { const [a, ca] = GRAD[i - 1], [b, cb] = GRAD[i], k = (t - a) / (b - a); return ca.map((v, j) => Math.round(lerp(v, cb[j], k))); }
  return GRAD[GRAD.length - 1][1];
}

/** 建一片夜空：update(dt) 之後，px（Uint32 0xAABBGGRR，寬 SKY_W×高 SKY_H）就是這一刻的天空 */
export function createSky() {
  const f = createFrame(SKY_W, SKY_H), fx = createFx(shootingStars, { x: SKY_W / 2, y: SKY_H, ...OPTS });
  const bg = new Uint32Array(SKY_W * SKY_H);
  for (let y = 0; y < SKY_H; y++) { const [r, g, b] = gradAt(y / (SKY_H - 1)); bg.fill((0xff000000 | (b << 16) | (g << 8) | r) >>> 0, y * SKY_W, (y + 1) * SKY_W); }
  const rgba = new Uint8ClampedArray(SKY_W * SKY_H * 4), px = new Uint32Array(rgba.buffer);
  let canvas = null;
  const sky = {
    px, rgba, bottom: bg[(SKY_H - 1) * SKY_W],
    update(dt) {
      fx.update(dt);
      clearFrame(f);
      fx.draw(f);
      composite(f, rgba, bg);
      if (canvas) canvas.getContext("2d").putImageData(new ImageData(rgba, SKY_W, SKY_H), 0, 0);
    },
    /** 2D 畫布用：回傳一張會跟著 update 更新的 canvas */
    canvas() {
      if (!canvas) { canvas = document.createElement("canvas"); canvas.width = SKY_W; canvas.height = SKY_H; }
      return canvas;
    },
  };
  sky.update(0);
  return sky;
}
