// 地上的掉落物：噴出來、落地、依稀有度冒光柱，主角走過去自動撿。
// 另外有左側的「撿到了什麼」訊息列。
import { hex } from "../../pixelfx/src/core/index.js";
import { ICONS, ICON_SIZE as S } from "./icons.js";
import { RARITY, R } from "./items.js";
import { groundAt, LEVEL_W, WALL } from "./level.js";
import { iconURL } from "./ui-art.js";

const OUTLINE = hex("#1a1424") >>> 0;
// 每個圖示轉成 frame 用的顏色（0 = 透明）
const iconPx = {};
for (const [name, cells] of Object.entries(ICONS)) iconPx[name] = Uint32Array.from(cells, (c) => (c ? hex(c) >>> 0 : 0));

// 光柱：顏色（暗、中、亮）和高度
const BEAM = {
  [R.magic]: { c: ["#1c3a80", "#3a78e0", "#b8dcff"], h: 42, w: 1 },
  [R.rare]: { c: ["#6a4a08", "#d0a020", "#fff0a0"], h: 70, w: 1 },
  [R.legend]: { c: ["#6a2008", "#e06010", "#ffe0b0"], h: 130, w: 2 },
};
for (const b of Object.values(BEAM)) { b.px = b.c.map((c) => hex(c) >>> 0); b.light = hex(b.c[0]) >>> 0; }
const RING = RARITY.map((r) => hex(r.color) >>> 0);

export class Drops {
  constructor() { this.list = []; this.clock = 0; }

  /** 噴出一件物品。dir 決定往哪邊噴（不給就隨機）。 */
  add(item, x, y, dir) {
    const vx = (dir ?? (Math.random() < 0.5 ? -1 : 1)) * (25 + Math.random() * 55);
    this.list.push({ item, x, y, vx, vy: -210 - Math.random() * 70, t: 0, landed: false });
  }

  /** onPick(drop) 回傳 true 代表撿起來了（背包滿就回傳 false，東西留在地上）。 */
  update(dt, player, radius, onPick) {
    this.clock += dt;
    for (const d of this.list) {
      d.t += dt;
      if (!d.landed) {
        d.vy = Math.min(420, d.vy + 820 * dt);
        const prevY = d.y;
        d.x = Math.max(WALL + 8, Math.min(LEVEL_W - WALL - 8, d.x + d.vx * dt));
        d.y += d.vy * dt;
        const g = d.vy >= 0 ? groundAt(d.x, prevY, d.y, false) : null;
        if (g !== null) { d.y = g; d.landed = true; }
      }
      if (d.t > 0.45 && Math.abs(player.x - d.x) < radius && Math.abs(player.y - 10 - d.y) < radius + 14 && onPick(d)) d.got = true;
    }
    for (let i = this.list.length - 1; i >= 0; i--) if (this.list[i].got) this.list.splice(i, 1);
  }

  draw(frame) {
    for (const d of this.list) {
      const r = d.item.rarity, bob = d.landed ? Math.round(Math.sin(this.clock * 3 + d.x) * 1.5) : 0;
      const x = Math.round(d.x), y = Math.round(d.y);
      if (BEAM[r] && d.landed) beam(frame, x, y - 4, BEAM[r], this.clock + d.x * 0.1);
      icon(frame, d.item.icon, x - S / 2, y - S - 2 + bob, r >= R.magic ? RING[r] : 0);
    }
  }
}

function icon(frame, name, x0, y0, ring) {
  const C = frame.color, src = iconPx[name], W = frame.w, H = frame.h;
  const bx = x0 - frame.ox, by = y0 - frame.oy;
  for (let j = 0; j < S; j++) {
    const y = by + j;
    if (y < 0 || y >= H) continue;
    for (let i = 0; i < S; i++) {
      const x = bx + i;
      let c = src[j * S + i];
      if (!c || x < 0 || x >= W) continue;
      if (c === OUTLINE && ring) c = ring;   // 魔法以上：外框換成稀有度的顏色
      C[y * W + x] = c;
    }
  }
  if (ring) {
    const lx = bx + S / 2, ly = by + S / 2;
    if (lx >= 0 && ly >= 0 && lx < W && ly < H) frame.light[ly * W + lx] = ring;
  }
}

// 光柱（參考 PixelFX 的 loot-beam）：實心亮芯、兩側同色，上段斷成越來越短的線段收尾，不用抖色；
// 光暈交給 light 層。腳下一圈扁扁的光環會一縮一放。
function beam(frame, x, y, b, t) {
  const C = frame.color, L = frame.light, W = frame.w, H = frame.h;
  const bx = x - frame.ox, by = y - frame.oy;
  const put = (px, py, c, light) => {
    if (px < 0 || py < 0 || px >= W || py >= H) return;
    C[py * W + px] = c;
    if (light) L[py * W + px] = b.light;
  };
  const solid = Math.round(b.h * 0.55), shift = Math.floor(t * 12);
  for (let k = 0; k < b.h; k++) {
    if (k >= solid) {
      // 上段：週期 6 格，亮的長度從 5 縮到 1，整段慢慢往上流動
      const u = (k - solid) / (b.h - solid), on = Math.max(1, Math.round(5 * (1 - u)));
      if ((k + shift) % 6 >= on) continue;
    }
    const py = by - k;
    put(bx, py, b.px[2], true);
    for (let s = 1; s <= b.w; s++) { put(bx - s, py, b.px[1]); put(bx + s, py, b.px[1]); }
    if (k < solid * 0.6) { put(bx - b.w - 1, py, b.px[0]); put(bx + b.w + 1, py, b.px[0]); }
  }
  // 腳下的光環：扁橢圓，半徑 4 和 5 交替
  const rr = b.w + 3 + (Math.floor(t * 3) & 1);
  for (let dx = -rr + 2; dx <= rr - 2; dx++) { put(bx + dx, by + 2, b.px[0]); put(bx + dx, by + 4, b.px[0]); }
  put(bx - rr + 1, by + 3, b.px[1]); put(bx + rr - 1, by + 3, b.px[1]);
  // 往上飄的光點
  for (let n = 0; n < 3; n++) {
    const k = Math.floor((t * 22 + (n * b.h) / 3) % b.h), px = bx + (n - 1) * (b.w + 3);
    put(px, by - k, b.px[2], true);
  }
}

// ---- 撿到東西的訊息列（畫面左側）
const feedEl = document.getElementById("feed");
export function feed(item, note = "", better = false) {
  const row = document.createElement("div");
  row.className = "feed-row";
  const r = RARITY[item.rarity];
  row.innerHTML = `<img src="${iconURL(item.icon, 2)}"><b style="color:${r.color}">${item.name}</b>${better ? '<em class="up">▲</em>' : ""}${note ? `<span>${note}</span>` : ""}`;
  feedEl.prepend(row);
  while (feedEl.children.length > 5) feedEl.lastChild.remove();
  setTimeout(() => row.classList.add("out"), 3200);
  setTimeout(() => row.remove(), 3800);
}
