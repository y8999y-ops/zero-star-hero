// 大地圖引擎：走路、碰撞、鏡頭、點地自動找路、照 y 排前後、角色與小動態。
// 畫布 768×432（地圖用比戰鬥細一倍的像素：角色和美術都是 1:1，不縮放）。
// 只管畫面和移動；對話、觸發事情交給 scenes/world.js。

import { heroWalkFrame, WALK_LOOP } from "../../fx/hero-walk.js";
import { deanFrame } from "../../fx/dean.js";

export const VW = 768, VH = 432;
const SPEED = 110;           // 每秒走幾格（像素）
const CELL = 8;              // 找路用的格子
const FOOT = 5;              // 腳底左右各算幾格寬（碰撞）

const NPC_ART = { dean: deanFrame };
const imgCache = {};
function loadImg(src) {
  return (imgCache[src] ??= new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; }));
}
function toCanvas(f) {
  const c = document.createElement("canvas"); c.width = f.w; c.height = f.h;
  c.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(f.px.buffer.slice(0)), f.w, f.h), 0, 0);
  return { canvas: c, ox: f.ox, oy: f.oy };
}
const rand = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export class World {
  constructor(map, { look, attrHex, pos }) {
    this.map = map; this.look = look; this.attrHex = attrHex;
    const p = pos ?? map.start;
    this.hero = { x: p.x, y: p.y, dir: p.dir ?? "down", moving: false, t: 0 };
    this.path = null;        // 點地移動的路線
    this.cam = { x: 0, y: 0 };
    this.t = 0;
    this.cache = new Map();
    this.npcs = map.npcs.map((n) => ({ ...n, talking: 0 }));
    this.marker = null;      // 點地時的小圈圈
  }

  async load() {
    const base = new URL("../../assets/map/", import.meta.url);
    const entries = await Promise.all(Object.entries(this.map.art).map(async ([k, f]) => [k, await loadImg(new URL(f, base).href)]));
    this.img = Object.fromEntries(entries);
    // 碼頭的浮空船切出來，讓它輕輕浮
    for (const o of this.map.objects) if (o.ship) {
      const im = this.img[o.art], c = document.createElement("canvas"); c.width = im.width; c.height = im.height;
      const x = c.getContext("2d"); x.drawImage(im, 0, 0);
      const ship = document.createElement("canvas"); ship.width = im.width - o.ship.x; ship.height = im.height;
      ship.getContext("2d").drawImage(c, o.ship.x, 0, ship.width, im.height, 0, 0, ship.width, im.height);
      x.clearRect(o.ship.x, 0, ship.width, im.height);
      o.body = c; o.shipImg = ship;
    }
    this.snapCam();
  }

  // ── 碰撞 ──
  canStand(x, y) { const w = this.map.walkable.bind(this.map); return w(x - FOOT, y) && w(x + FOOT, y) && w(x, y - 3); }

  /** 搖桿：vx、vy 是 -1～1 */
  steer(vx, vy, dt) {
    const len = Math.hypot(vx, vy);
    if (len < 0.15) return false;
    this.path = null; this.marker = null;
    const k = Math.min(1, len), sp = SPEED * k * dt;
    this.moveBy((vx / len) * sp, (vy / len) * sp);
    this.face(vx, vy);
    return true;
  }
  face(vx, vy) { this.hero.dir = Math.abs(vx) > Math.abs(vy) * 0.9 ? (vx > 0 ? "right" : "left") : vy > 0 ? "down" : "up"; }
  moveBy(dx, dy) {
    const h = this.hero;
    // 先走 x 再走 y：撞牆時可以沿著牆滑
    if (this.canStand(h.x + dx, h.y)) h.x += dx;
    if (this.canStand(h.x, h.y + dy)) h.y += dy;
  }

  // ── 點地移動：A* 在 8 格的格子上找路 ──
  walkTo(tx, ty) {
    const W = Math.ceil(this.map.size[0] / CELL), H = Math.ceil(this.map.size[1] / CELL);
    const ok = (i, j) => i >= 0 && j >= 0 && i < W && j < H && this.canStand(i * CELL + CELL / 2, j * CELL + CELL / 2);
    let gi = Math.floor(tx / CELL), gj = Math.floor(ty / CELL);
    // 點到不能走的地方：找最近能走的格子
    if (!ok(gi, gj)) {
      let best = null;
      for (let r = 1; r < 12 && !best; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++)
        if ((Math.abs(di) === r || Math.abs(dj) === r) && ok(gi + di, gj + dj) && (!best || Math.hypot(di, dj) < best[2])) best = [gi + di, gj + dj, Math.hypot(di, dj)];
      if (!best) return false;
      [gi, gj] = best;
    }
    const si = Math.floor(this.hero.x / CELL), sj = Math.floor(this.hero.y / CELL);
    const key = (i, j) => j * W + i, goal = key(gi, gj);
    const open = [[0, si, sj]], g = new Map([[key(si, sj), 0]]), from = new Map();
    let found = false, steps = 0;
    while (open.length && steps++ < 6000) {
      let bi = 0; for (let k = 1; k < open.length; k++) if (open[k][0] < open[bi][0]) bi = k;
      const [, i, j] = open.splice(bi, 1)[0], kk = key(i, j);
      if (kk === goal) { found = true; break; }
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const ni = i + di, nj = j + dj;
        if (!ok(ni, nj) || (di && dj && (!ok(i + di, j) || !ok(i, j + dj)))) continue;
        const nk = key(ni, nj), ng = g.get(kk) + (di && dj ? 1.414 : 1);
        if (ng < (g.get(nk) ?? Infinity)) { g.set(nk, ng); from.set(nk, kk); open.push([ng + Math.hypot(gi - ni, gj - nj), ni, nj]); }
      }
    }
    if (!found) return false;
    const pts = []; let k = goal;
    while (k !== undefined && k !== key(si, sj)) { pts.unshift([(k % W) * CELL + CELL / 2, Math.floor(k / W) * CELL + CELL / 2]); k = from.get(k); }
    // 路線拉直：看得到的點就直接走過去（不會一格一格轉彎）
    const straight = [], clear = (a, b) => { const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 4); for (let s = 1; s <= n; s++) if (!this.canStand(a[0] + ((b[0] - a[0]) * s) / n, a[1] + ((b[1] - a[1]) * s) / n)) return false; return true; };
    let cur = [this.hero.x, this.hero.y], idx = 0;
    while (idx < pts.length) {
      let far = idx; for (let q = pts.length - 1; q > idx; q--) if (clear(cur, pts[q])) { far = q; break; }
      straight.push(pts[far]); cur = pts[far]; idx = far + 1;
    }
    // 最後一點：點的地方能站就停在點的位置（不是格子中心）
    if (straight.length && this.canStand(tx, ty) && Math.hypot(tx - straight.at(-1)[0], ty - straight.at(-1)[1]) < CELL * 1.5) straight[straight.length - 1] = [tx, ty];
    this.path = straight;
    this.marker = { x: straight.at(-1)?.[0] ?? tx, y: straight.at(-1)?.[1] ?? ty, t: 0 };
    return true;
  }

  update(dt, moved) {
    this.t += dt;
    const h = this.hero;
    let walking = moved;
    if (!moved && this.path?.length) {
      const [px, py] = this.path[0], dx = px - h.x, dy = py - h.y, d = Math.hypot(dx, dy), sp = SPEED * dt;
      if (d <= sp) { h.x = px; h.y = py; this.path.shift(); if (!this.path.length) { this.path = null; this.marker = null; } }
      else { this.moveBy((dx / d) * sp, (dy / d) * sp); this.face(dx, dy); }
      walking = true;
    }
    h.moving = walking;
    h.t = walking ? h.t + dt : 0;
    if (this.marker) this.marker.t += dt;
    for (const n of this.npcs) n.talking = Math.max(0, n.talking - dt);
    // 鏡頭跟著主角（慢慢跟上），不超出地圖
    const tx = this.clampX(h.x - VW / 2), ty = this.clampY(h.y - 20 - VH / 2);
    this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 8); this.cam.y += (ty - this.cam.y) * Math.min(1, dt * 8);
  }
  clampX(x) { return Math.max(0, Math.min(this.map.size[0] - VW, x)); }
  clampY(y) { return Math.max(0, Math.min(this.map.size[1] - VH, y)); }
  snapCam() { this.cam.x = this.clampX(this.hero.x - VW / 2); this.cam.y = this.clampY(this.hero.y - 20 - VH / 2); }

  /** 畫面上的點 → 地圖座標 */
  toWorld(sx, sy) { return [sx + Math.round(this.cam.x), sy + Math.round(this.cam.y)]; }

  sprite(key, make) { let c = this.cache.get(key); if (!c) { c = toCanvas(make()); this.cache.set(key, c); } return c; }
  heroSprite() {
    const h = this.hero, pose = h.moving ? "walk" : "idle";
    const n = pose === "walk" ? Math.floor(((h.t % WALK_LOOP) / WALK_LOOP) * 4) : Math.floor((this.t % 1.6) * 12);
    return this.sprite(`hero:${h.dir}:${pose}:${n}`, () => heroWalkFrame(this.look, h.dir, pose, pose === "walk" ? (n / 4) * WALK_LOOP + 0.01 : n / 12, this.attrHex));
  }
  npcSprite(n) {
    const pose = n.talking > 0 ? "talk" : "idle", f = Math.floor((this.t % 2) * 12);
    return this.sprite(`${n.id}:${pose}:${f}`, () => NPC_ART[n.id](pose, f / 12));
  }

  draw(ctx) {
    const cx = Math.round(this.cam.x), cy = Math.round(this.cam.y), t = this.t;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.img.ground, -cx, -cy);
    // 點地的小圈圈
    if (this.marker) {
      const r = 3 + Math.floor((this.marker.t * 6) % 3);
      ctx.fillStyle = "rgba(255,240,180,0.85)";
      for (const [dx, dy] of [[-r, 0], [r, 0], [0, -1], [0, 1]]) ctx.fillRect(Math.round(this.marker.x) - cx + dx, Math.round(this.marker.y) - cy + dy, 1, 1);
    }
    // 照 y 排：物件、NPC、主角
    const list = [];
    for (const o of this.map.objects) list.push({ y: o.base, draw: () => {
      if (o.body) {
        ctx.drawImage(o.body, o.x - cx, o.y - cy);
        ctx.drawImage(o.shipImg, o.x + o.ship.x - cx, o.y - cy + Math.round(Math.sin(t * 1.4) * 1.5));
      } else ctx.drawImage(this.img[o.art], o.x - cx, o.y - cy);
    } });
    const shadow = (x, y, w) => { ctx.fillStyle = "rgba(20,40,20,0.28)"; ctx.fillRect(Math.round(x - w) - cx, Math.round(y) - 1 - cy, w * 2, 2); ctx.fillRect(Math.round(x - w + 2) - cx, Math.round(y) + 1 - cy, w * 2 - 4, 1); };
    for (const n of this.npcs) list.push({ y: n.y, draw: () => { const s = this.npcSprite(n); shadow(n.x, n.y, 10); ctx.drawImage(s.canvas, Math.round(n.x) - s.ox - cx, Math.round(n.y) - s.oy - cy); } });
    const h = this.hero;
    list.push({ y: h.y, draw: () => { const s = this.heroSprite(); shadow(h.x, h.y, 7); ctx.drawImage(s.canvas, Math.round(h.x) - s.ox - cx, Math.round(h.y) - s.oy - cy); } });
    list.sort((a, b) => a.y - b.y).forEach((d) => d.draw());
    this.drawAmbient(ctx, cx, cy);
  }

  // 小動態：井上的光點慢慢往上飄、蝴蝶
  drawAmbient(ctx, cx, cy) {
    const A = this.map.ambient, t = this.t;
    if (A.sparkle) for (let i = 0; i < 10; i++) {
      const u = (t * 0.35 + rand(i)) % 1, x = A.sparkle[0] + (rand(i + 9) - 0.5) * 60 + Math.sin(t * 2 + i) * 2, y = A.sparkle[1] + 10 - u * 46;
      if (Math.sin(t * 4 + i * 2) < -0.3) continue;
      ctx.globalAlpha = 1 - u; ctx.fillStyle = i % 3 ? "#bfe8ff" : "#fff3b0";
      ctx.fillRect(Math.round(x) - cx, Math.round(y) - cy, 1, 1);
      if (u < 0.3 && i % 3 === 0) { ctx.fillRect(Math.round(x) - cx - 1, Math.round(y) - cy, 3, 1); ctx.fillRect(Math.round(x) - cx, Math.round(y) - cy - 1, 1, 3); }
    }
    ctx.globalAlpha = 1;
    (A.butterflies ?? []).forEach(([bx, by], i) => {
      const u = t * 0.5 + i * 2.1, x = Math.round(bx + Math.sin(u) * 50) - cx, y = Math.round(by + Math.sin(u * 2) * 14 + Math.sin(t * 6 + i) * 1.5) - cy;
      const open = Math.floor(t * 9 + i * 3) % 2 === 0, c = i ? ["#fac85e", "#c08a2e"] : ["#c3a3db", "#8f6fc0"];
      ctx.fillStyle = c[1]; ctx.fillRect(x, y, 1, 2); ctx.fillStyle = c[0];
      if (open) { ctx.fillRect(x - 2, y - 1, 2, 2); ctx.fillRect(x + 1, y - 1, 2, 2); } else { ctx.fillRect(x - 1, y - 1, 1, 2); ctx.fillRect(x + 1, y - 1, 1, 2); }
    });
  }

  /** 主角附近能互動的東西（NPC 或觸發點），沒有就 null */
  nearby() {
    const h = this.hero;
    let best = null, bd = Infinity;
    for (const n of this.npcs) { const d = Math.hypot(n.x - h.x, (n.y - h.y) * 1.3); if (d < 34 && d < bd) { best = { kind: "npc", ...n, ref: n }; bd = d; } }
    for (const s of this.map.spots) { const d = Math.hypot(s.x - h.x, s.y - h.y); if (d < s.r && d < bd) { best = { kind: "spot", ...s }; bd = d; } }
    return best;
  }

  /** 點到的東西（NPC：點身上；觸發點：點附近） */
  hit(wx, wy) {
    for (const n of this.npcs) if (Math.abs(wx - n.x) < 14 && wy < n.y + 4 && wy > n.y - 46) return { kind: "npc", ...n, ref: n };
    for (const s of this.map.spots) if (!s.auto && Math.hypot(wx - s.x, wy - s.y) < s.r * 0.8) return { kind: "spot", ...s };
    return null;
  }
}
