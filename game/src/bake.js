// 預先烘焙：把 PixelFX 特效在載入時畫成一格一格的畫面，遊戲中只要貼上去。
// 即時運算一隻史萊姆每幀約 0.5ms，烘焙後幾乎不花時間，畫面上可以同時有很多敵人。
import { createFx, createFrame, clearFrame } from "../../pixelfx/src/core/index.js";

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

/** 把特效（含選項，例如 palette）烘焙成動畫。fps 30 對像素特效已經夠順。 */
export function bake(mod, o = {}, fps = 30) {
  const meta = mod.meta, [w, h] = meta.size, [ox, oy] = meta.origin;
  const fx = createFx(mod, { ...o, x: ox, y: oy, flip: false });
  const frame = createFrame(w, h);
  const n = Math.max(1, Math.round((meta.duration ?? 1) * fps));
  const frames = [];
  for (let i = 0; i < n; i++) {
    clearFrame(frame);
    fx.draw(frame);
    frames.push(crop(frame, ox, oy));
    fx.update(1 / fps);
  }
  return { frames, fps, loop: !!meta.loop, duration: meta.duration ?? 1, meta };
}

// 只留下有畫東西的範圍
function crop(f, ox, oy) {
  let x0 = f.w, y0 = f.h, x1 = -1, y1 = -1;
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
    const i = y * f.w + x;
    if (f.color[i] || f.light[i]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) return { w: 0, h: 0, lx: 0, ly: 0, color: null, light: null, hasLight: false };
  const w = x1 - x0 + 1, h = y1 - y0 + 1, color = new Uint32Array(w * h), light = new Uint32Array(w * h);
  let hasLight = false;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y + y0) * f.w + x + x0;
    color[y * w + x] = f.color[i];
    if ((light[y * w + x] = f.light[i] & 0xffffff)) hasLight = true;
  }
  return { w, h, lx: x0 - ox, ly: y0 - oy, color, light: hasLight ? light : null };
}

/** 把動畫的第 t 秒貼到 frame 上，(x, y) 是特效原點的世界座標。alpha < 1 用抖動淡出。 */
export function blit(frame, anim, t, x, y, flip = false, alpha = 1) {
  const n = anim.frames.length;
  let i = Math.floor(t * anim.fps);
  i = anim.loop ? ((i % n) + n) % n : Math.min(n - 1, Math.max(0, i));
  const s = anim.frames[i];
  if (!s.w) return;
  const W = frame.w, H = frame.h, C = frame.color, L = frame.light;
  const bx = Math.round(x) - (frame.ox | 0), by = Math.round(y) - (frame.oy | 0);
  for (let yy = 0; yy < s.h; yy++) {
    const py = by + s.ly + yy;
    if (py < 0 || py >= H) continue;
    const row = yy * s.w, out = py * W;
    for (let xx = 0; xx < s.w; xx++) {
      const lx = s.lx + xx, px = flip ? bx - lx - 1 : bx + lx;
      if (px < 0 || px >= W) continue;
      if (alpha < 1 && alpha <= BAYER[((py & 3) << 2) | (px & 3)]) continue;
      const c = s.color[row + xx], j = out + px;
      if (c) {
        const a = c >>> 24;
        if (a === 255) C[j] = c;
        else {
          // 半透明（煙、霧）：跟底下的顏色混合
          const d = C[j], k = a / 255, m = 1 - k;
          C[j] = (255 << 24) | ((((c >>> 16) & 255) * k + ((d >>> 16) & 255) * m) << 16) | ((((c >>> 8) & 255) * k + ((d >>> 8) & 255) * m) << 8) | (((c & 255) * k + (d & 255) * m) | 0);
        }
      }
      if (s.light) {
        const l = s.light[row + xx];
        if (l) {
          const d = L[j];
          L[j] = (255 << 24) | (Math.min(255, ((d >>> 16) & 255) + ((l >>> 16) & 255)) << 16) | (Math.min(255, ((d >>> 8) & 255) + ((l >>> 8) & 255)) << 8) | Math.min(255, (d & 255) + (l & 255));
        }
      }
    }
  }
}

/** 烘焙動畫的播放器，介面跟 PixelFX 的 createFx 一樣，可以直接丟進特效管理。 */
export function play(anim, o = {}) {
  let t = 0, stopAt = Infinity;
  return {
    options: o,
    meta: anim.meta,
    get t() { return t; },
    update(dt) { t += dt; },
    draw(frame) {
      const a = stopAt === Infinity ? 1 : 1 - (t - stopAt) / 0.3;
      if (a > 0) blit(frame, anim, t, o.x ?? 0, o.y ?? 0, !!o.flip, a);
    },
    stop() { if (stopAt === Infinity) stopAt = t; },
    done() { return t - stopAt >= 0.3 || (!anim.loop && t >= anim.duration); },
  };
}
