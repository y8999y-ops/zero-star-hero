// 形態大招草稿：在假的場景（地面 y＝150、5 隻假怪）跑一招，每 0.1 秒一格（主角＝黃點、怪＝紅框、受傷時閃白），顏色＋光合成
// 執行：node game/tools/drafts/ultforms.mjs out.png slime|can|bat
import { writeFileSync } from "node:fs";
import { encodePNG } from "../../../pixelfx/tools/lib/png.mjs";
import { FORM_ULTS } from "../../src/ult-forms.js";
const which = process.argv[3] || "slime", M = FORM_ULTS[which], FW = 320, FH = 170, FLOOR = 150, COLS = 6;
const JUNK = { can: [[154, 166, 186], [94, 110, 130]], tire: [[74, 74, 90], [30, 30, 40]], plank: [[168, 100, 44], [104, 56, 24]] };
const kit = {
  POSES: {}, floorAt: () => FLOOR, solidAt: () => false, spawn: () => {}, fx: {}, flash: () => {}, hitStop: () => {}, shake: () => {}, sfx: () => {}, bounds: () => [8, FW - 8],
  drawJunk: (put, type, x, y) => { const [a, b] = JUNK[type]; for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) put(x + dx, y + dy, (0xff000000 | ((dx + dy < 0 ? a : b)[2] << 16) | ((dx + dy < 0 ? a : b)[1] << 8) | (dx + dy < 0 ? a : b)[0]) >>> 0); },
};
const enemies = [70, 150, 190, 235, 290].map((x, i) => ({ x, y: i === 2 ? 110 : FLOOR, hp: 9, dead: false, flash: 0, vx: 0, vy: 0, hit() { this.flash = 0.08; } }));
const H = { enemies: () => enemies.filter((e) => !e.dead), hit: (e) => e.hit(), view: () => ({ l: 0, r: FW, top: 0 }), puddle: (x) => puddles.push(x), heal: () => {}, dust: () => {} };
const puddles = [];
const player = { x: 110, y: FLOOR, face: 1, ultPose() {} };
const U = { t: 0, post: 0 };
M.start(U, player, kit, H);
const cells = [];
for (let n = 0; U.t <= M.dur + 0.001; n++) {
  if (n % 6 === 0) {
    const f = { w: FW, h: FH, color: new Uint32Array(FW * FH), light: new Uint32Array(FW * FH) };
    const P = {
      blend(x, y, [r, g, b], a) { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= FW || y >= FH || a <= 0) return; const i = y * FW + x, c = f.color[i] || 0xff241a30, q = 1 - Math.min(1, a); f.color[i] = (0xff000000 | (((c >>> 16) & 255) * q + b * Math.min(1, a)) << 16 | (((c >>> 8) & 255) * q + g * Math.min(1, a)) << 8 | ((c & 255) * q + r * Math.min(1, a))) >>> 0; },
      glow(x, y, [r, g, b], k) { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= FW || y >= FH) return; const i = y * FW + x, l = f.light[i]; f.light[i] = (0xff000000 | Math.min(255, ((l >>> 16) & 255) + b * k) << 16 | Math.min(255, ((l >>> 8) & 255) + g * k) << 8 | Math.min(255, (l & 255) + r * k)) >>> 0; },
    };
    M.draw(P, U, kit, H);
    cells.push({ f, t: U.t, px: player.x, py: player.y, en: enemies.map((e) => ({ x: e.x, y: e.y, fl: e.flash > 0, dead: e.dead })), dim: M.dim(U) });
  }
  const dt = 1 / 60; U.t += dt; M.update(U, dt, player, kit, H); M.tick?.(U, dt); for (const e of enemies) e.flash -= dt;
}
const rows = Math.ceil(cells.length / COLS), W = COLS * (FW + 2), IH = rows * (FH + 2), img = new Uint8Array(W * IH * 4);
cells.forEach((c, n) => {
  const bx = (n % COLS) * (FW + 2), by = Math.floor(n / COLS) * (FH + 2), k = 1 - 0.55 * Math.min(1, c.dim);
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
    let col = y >= FLOOR ? [56, 46, 72] : [30, 24, 44];
    col = M.tint ? col.map((v, i) => v * k + M.tint[i] * (1 - k) * 0.9) : col.map((v) => v * k);
    for (const e of c.en) if (!e.dead && Math.abs(x - e.x) <= 5 && y <= e.y && y >= e.y - 12) col = e.fl ? [255, 255, 255] : (Math.abs(x - e.x) === 5 || y === e.y - 12) ? [255, 70, 90] : col;
    if (Math.abs(x - c.px) + Math.abs(y - (c.py - 8)) <= 5) col = [255, 216, 74];
    const v = c.f.color[y * FW + x]; if (v) col = [v & 255, (v >>> 8) & 255, (v >>> 16) & 255];
    const l = c.f.light[y * FW + x]; if (l) col = col.map((q, i) => Math.min(255, q + ((l >>> (i * 8)) & 255) * 0.5));
    img.set([...col, 255], ((by + y) * W + bx + x) * 4);
  }
});
writeFileSync(process.argv[2], encodePNG(W, IH, img));
console.log(which, "格數", cells.length, "黏液灘", puddles.length);
