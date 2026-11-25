// 角色、怪物共用的小格子畫筆（hero.js、ink-drop.js、pagepage.js…）。
// 一格一格畫在小格子上：先填顏色，最後 outline() 自動描外框——外框只用黑色，內線用同色系的暗色（專案規則）。
// 座標以「原點」(ox, oy) 為準，通常是腳底或身體中心。

export const hex = (c) => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const mixHex = (a, b, k) => { const A = hex(a), B = hex(b); return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, "0")).join(""); };
export const toU32 = (c) => { const [r, g, b] = hex(c); return (0xff << 24) | (b << 16) | (g << 8) | r; };
export const OUTLINE = "#000000";

export class Grid {
  constructor(w, h, ox, oy) { Object.assign(this, { W: w, H: h, OX: ox, OY: oy }); this.c = new Array(w * h).fill(null); }
  // col 是 null 時把那一格清成透明（用來挖洞、摺角）
  set(x, y, col) { x = Math.round(x) + this.OX; y = Math.round(y) + this.OY; if (x >= 0 && y >= 0 && x < this.W && y < this.H && col !== undefined) this.c[y * this.W + x] = col || null; }
  get(x, y) { x = Math.round(x) + this.OX; y = Math.round(y) + this.OY; return x >= 0 && y >= 0 && x < this.W && y < this.H ? this.c[y * this.W + x] : null; }
  rect(x, y, w, h, col) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, col); }
  // 實心橢圓，fn(nx, ny) 回傳顏色（nx、ny 是 -1～1 的位置，拿來分明暗）
  ellipse(cx, cy, rx, ry, fn) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x - cx) / (rx + 0.5), ny = (y - cy) / (ry + 0.5);
        if (nx * nx + ny * ny <= 1) this.set(x, y, typeof fn === "function" ? fn(nx, ny) : fn);
      }
  }
  // 多邊形（掃描線），fn(x, y) 回傳顏色
  poly(pts, fn) {
    const ys = pts.map((p) => p[1]), y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
    for (let y = y0; y <= y1; y++) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
        if ((ay <= y + 0.5 && by > y + 0.5) || (by <= y + 0.5 && ay > y + 0.5)) xs.push(ax + ((y + 0.5 - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2)
        for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) this.set(x, y, typeof fn === "function" ? fn(x, y) : fn);
    }
  }
  line(x0, y0, x1, y1, col) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) this.set(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, col);
  }
  // 外框：透明格子只要上下左右碰到有顏色的格子，就塗黑（外輪廓一律黑色）
  outline() {
    const { W, H } = this, out = this.c.slice();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (this.c[y * W + x]) continue;
      const n = (dx, dy) => { const X = x + dx, Y = y + dy; return X >= 0 && Y >= 0 && X < W && Y < H && this.c[Y * W + X] && this.c[Y * W + X] !== OUTLINE; };
      if (n(1, 0) || n(-1, 0) || n(0, 1) || n(0, -1)) out[y * W + x] = OUTLINE;
    }
    this.c = out;
  }
  /** 轉成像素（0xAABBGGRR，0＝透明），順便數用了幾色 */
  pixels() {
    const px = new Uint32Array(this.W * this.H);
    for (let i = 0; i < px.length; i++) if (this.c[i]) px[i] = toU32(this.c[i]);
    return { w: this.W, h: this.H, ox: this.OX, oy: this.OY, px, colors: new Set(this.c.filter(Boolean)).size };
  }
}
