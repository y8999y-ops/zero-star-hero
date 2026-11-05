// 場景裡的元素來源（裝備改版第 3 批，Noita 式「環境就是武器」）：敵人走進去就沾上狀態，主角不受影響。
// 水窪（scenery 原本就有）＝潮濕、火盆（關卡原本就有）＝燃燒，這裡另外加：
//   黏液池＝黏液、油桶（打破會流一灘油）＝油汙、廚餘堆＝毒、漏電管線＝帶電（每 1.6 秒放一次電）。
//   油灘裡有燃燒的敵人 → 整灘油燒起來 4 秒（燒到的都著火）。
// 外觀全部自己畫（照 pixelfx skill 畫→看→修）；草稿：game/tools/drafts/hazards.mjs
import { hex } from "../../pixelfx/src/core/index.js";
import { applyStatus } from "./status.js";

const P = (c) => hex(c) >>> 0;
const C = {
  goo: ["#2a5a10", "#5a9a18", "#9ad830", "#d8ff70", "#ffffff"].map(P),
  oil: ["#120c1a", "#241a32", "#40325a", "#5af0d0", "#e080ff", "#ffe070", "#6a5a8a"].map(P),   // 第 3 輪：油亮一階，才跟深色背景分得開
  drum: ["#1a0c0c", "#4a1c14", "#7a2e1c", "#b04a26", "#d87a3a", "#f0b070"].map(P),
  stripe: ["#2a2a2a", "#f0c020"].map(P),
  junk: ["#1a1410", "#3a2c20", "#5a4430", "#8a6a48", "#3a5a20", "#6a9a28", "#b8e040", "#e8ff90"].map(P),
  pipe: ["#14161c", "#2a2e38", "#4a5468", "#6e7a90", "#9aa6ba", "#d0d8e6"].map(P),
  volt: ["#1e64b0", "#3ab8f0", "#9af0ff", "#ffffff"].map(P),
  fire: ["#8a1f17", "#f2561d", "#ffc23d", "#fff3a6"].map(P),
};
const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

// 每一關放哪些（x 是地上的位置；跟火盆、出口錯開）
const PLAN = {
  "1-1": [["goo", 760], ["drum", 1240], ["junk", 1720], ["pipe", 2120]],
  "1-2": [["junk", 520], ["drum", 980], ["drum", 1460], ["pipe", 1880], ["junk", 2360]],
  "1-3": [["goo", 620], ["pipe", 1060], ["goo", 1640], ["drum", 2100]],
};

export function createHazards({ stage, floor, torches = [], puddles = [] }) {
  const list = (PLAN[stage] ?? []).map(([type, x]) => ({ type, x, w: type === "goo" ? 30 : type === "junk" ? 26 : 12, hp: 2, shakeT: 0, fireT: 0, spill: 0 }));
  let clock = 0, tickT = 0;
  const zone = (h, e) => Math.abs(e.x - h.x) < h.w / 2 + 6 && e.y > floor - 8;

  function update(dt, enemies) {
    clock += dt;
    // 暫時的（技能樹「黏液地面」）：時間到就消失
    for (let i = list.length - 1; i >= 0; i--) if (list[i].ttl !== undefined && (list[i].ttl -= dt) <= 0) list.splice(i, 1);
    for (const h of list) { h.shakeT = Math.max(0, h.shakeT - dt); if (h.fireT > 0) h.fireT -= dt; if (h.type === "oil" && h.spill < 1) h.spill = Math.min(1, h.spill + dt * 2.5); }
    if ((tickT -= dt) > 0) return;
    tickT = 0.25;
    const ground = enemies.filter((e) => !e.dead && !e.k?.fly);
    for (const e of ground) {
      for (const p of puddles) if (Math.abs(e.x - p.x) < p.w / 2 && !e.st?.wet) applyStatus(e, "wet");
      for (const t of torches) if (Math.abs(e.x - t) < 9) applyStatus(e, "burn");
      for (const h of list) {
        if (!zone(h, e)) continue;
        if (h.type === "goo") applyStatus(e, "slime");
        else if (h.type === "junk") applyStatus(e, "poison");
        else if (h.type === "oil") {
          if (h.fireT > 0) applyStatus(e, "burn");
          else if (e.st?.burn > 0) { h.fireT = 4; applyStatus(e, "oil"); }   // 著火的踩進油灘：整灘燒起來
          else applyStatus(e, "oil");
        } else if (h.type === "pipe" && clock % 1.6 < 0.3) applyStatus(e, "shock");
      }
    }
  }

  /** 攻擊打到：油桶會壞，壞了流出一灘油 */
  function hit(box) {
    for (const h of list) {
      if (h.type !== "drum" || box.x1 < h.x - 6 || box.x0 > h.x + 6 || box.y1 < floor - 16) continue;
      h.shakeT = 0.2;
      if (--h.hp <= 0) Object.assign(h, { type: "oil", w: 44, spill: 0 });
    }
  }

  function put(frame, x, y, c, glow = 0) {
    x = Math.round(x) - frame.ox; y = Math.round(y) - frame.oy;
    if (x < 0 || y < 0 || x >= frame.w || y >= frame.h) return;
    frame.color[y * frame.w + x] = c;
    if (glow) frame.light[y * frame.w + x] = c;
  }

  function draw(frame) {
    for (const h of list) {
      if (h.x < frame.ox - 40 || h.x > frame.ox + frame.w + 40) continue;
      if (h.ttl !== undefined && h.ttl < 0.6 && Math.floor(h.ttl * 12) % 2) continue;   // 快消失時閃
      drawHazard(frame, h, clock, floor, put);
    }
  }
  /** 放一個暫時的元素地面（ttl 秒後消失） */
  const addTemp = (h) => list.push({ shakeT: 0, fireT: 0, spill: 1, hp: 2, ...h });
  return { list, update, hit, draw, addTemp };
}

/** 畫一個場景物件（草稿工具也用） */
export function drawHazard(frame, h, t, floor, put) {
  const x0 = h.x, y = floor;
  const sx = h.shakeT > 0 ? Math.round(Math.sin(h.shakeT * 80)) : 0;
  if (h.type === "goo") {
    // 黏液池：地上一灘 3 排的亮綠黏液，表面一條白亮線，泡泡慢慢鼓起來破掉
    const hw = h.w / 2;
    for (let i = -hw; i <= hw; i++) {
      const a = Math.abs(i) / hw;
      put(frame, x0 + i, y - 1, a > 0.92 ? C.goo[0] : C.goo[1]);
      if (a < 0.9) put(frame, x0 + i, y - 2, a > 0.75 ? C.goo[1] : C.goo[2]);
      if (a < 0.7) put(frame, x0 + i, y - 3, i < -hw * 0.3 && i > -hw * 0.6 ? C.goo[4] : C.goo[3]);
    }
    for (let k = 0; k < 2; k++) {
      const p = (t * 0.5 + k * 0.5) % 1, bx = x0 - hw * 0.4 + k * hw * 0.8, r = p < 0.8 ? Math.round(p * 2.5) : 0;
      if (r) for (let i = -r; i <= r; i++) put(frame, bx + i, y - 3 - r + Math.abs(i), Math.abs(i) === r ? C.goo[2] : C.goo[3]);
      if (p > 0.8 && p < 0.9) { put(frame, bx - 2, y - 5, C.goo[3]); put(frame, bx + 2, y - 6, C.goo[3]); }
    }
  } else if (h.type === "drum") {
    // 油桶：鏽紅色的直筒鐵桶（左亮右暗、上下兩圈箍）、中間黃黑警告條、桶口一點黑油
    for (let j = 0; j < 16; j++) for (let i = -6; i <= 6; i++) {
      const u = (i + 6) / 12, rim = j === 0 || j === 15 || j === 5 || j === 10;
      let c = u < 0.15 ? C.drum[2] : u < 0.35 ? C.drum[4] : u < 0.7 ? C.drum[3] : u < 0.9 ? C.drum[2] : C.drum[1];
      if (rim) c = u < 0.3 ? C.drum[5] : u < 0.8 ? C.drum[4] : C.drum[2];
      if (j >= 6 && j <= 9 && !rim) c = ((i + j) & 3) < 2 ? C.stripe[1] : C.stripe[0];
      if (Math.abs(i) === 6) c = C.drum[0];
      put(frame, x0 + i + sx, y - 1 - j, c);
    }
    for (let i = -5; i <= 5; i++) put(frame, x0 + i + sx, y - 17, i < -2 ? C.drum[4] : C.drum[2]);
    put(frame, x0 + 2 + sx, y - 17, C.oil[1]); put(frame, x0 + 3 + sx, y - 17, C.oil[1]);
    if (h.hp < 2) { put(frame, x0 - 2 + sx, y - 12, C.drum[0]); put(frame, x0 - 1 + sx, y - 11, C.drum[0]); put(frame, x0 + sx, y - 12, C.drum[0]); }   // 被打凹的裂縫
  } else if (h.type === "oil") {
    // 油灘（第 2 輪）：3 排高、邊緣一圈偏紫的亮邊（跟深色背景分開），表面兩三道會流動的彩虹油光（青→紫→黃，各 2～3 格長）
    const hw = Math.round((h.w / 2) * h.spill);
    for (let i = -hw; i <= hw; i++) {
      const a = Math.abs(i) / Math.max(1, hw);
      put(frame, x0 + i, y - 1, a > 0.92 ? C.oil[2] : C.oil[1]);
      if (a < 0.9) put(frame, x0 + i, y - 2, a > 0.8 ? C.oil[2] : C.oil[0]);
      if (a < 0.7) put(frame, x0 + i, y - 3, a > 0.55 ? C.oil[2] : i < 0 && i > -hw * 0.5 ? C.oil[6] : C.oil[2]);   // 頂上一段亮邊
    }
    for (let k = 0; k < 3; k++) {
      const sx0 = Math.round(x0 - hw * 0.6 + ((k * 0.37 + t * 0.15) % 1) * hw * 1.2);
      for (let q = 0; q < 3; q++) if (Math.abs(sx0 + q - x0) < hw * 0.8) put(frame, sx0 + q, y - 2, C.oil[3 + ((q + k) % 3)]);
    }
    if (h.fireT > 0) {
      // 著火（第 2 輪）：火舌粗細高低不一、間距亂，底下一排紅
      for (let i = -hw; i <= hw; i++) put(frame, x0 + i, y - 2, C.fire[0], 1);
      for (let k = 0; k < Math.floor(hw / 2); k++) {   // 第 3 輪：火舌多一倍
        const fx = Math.round(x0 - hw + 2 + hash(k, 3) * (hw * 2 - 4)), f = Math.floor(t * 12 + k * 3);
        const fh = 4 + Math.floor(hash(k, f % 5) * 7) + (h.fireT > 3.5 ? 3 : 0), wide = hash(k, 9) > 0.35;
        for (let j = 0; j < fh; j++) {
          const q = j / fh, c = C.fire[q < 0.3 ? 0 : q < 0.6 ? 1 : q < 0.85 ? 2 : 3], dx = q > 0.6 ? Math.round(Math.sin(t * 9 + k)) : 0;
          put(frame, fx + dx, y - 3 - j, c, 1);
          if (wide && q < 0.55) put(frame, fx + 1, y - 3 - j, C.fire[q < 0.3 ? 0 : 1], 1);
        }
      }
    }
  } else if (h.type === "junk") {
    // 廚餘堆（第 2 輪）：一個綁起來的黑色垃圾袋（有亮面、袋口打結）、旁邊一個罐頭和魚骨頭，底下滲出一灘發光的毒汁，上面冒毒泡
    for (let i = -13; i <= 13; i++) {   // 毒汁
      const a = Math.abs(i) / 13;
      put(frame, x0 + i, y - 1, a > 0.85 ? C.junk[4] : C.junk[5]);
      if (a < 0.6) put(frame, x0 + i, y - 2, (i & 3) === 1 ? C.junk[7] : C.junk[6], 1);
    }
    const bag = [[-6, 6], [-7, 7], [-7, 7], [-8, 7], [-8, 7], [-7, 7], [-7, 6], [-6, 5], [-4, 3], [-2, 1], [-1, 1], [-2, 2]];
    bag.forEach(([l, r], j) => { for (let i = l; i <= r; i++) {
      const u = (i - l) / Math.max(1, r - l), top = j >= 9;
      let c = u < 0.2 ? C.pipe[3] : u < 0.6 ? C.pipe[2] : u < 0.85 ? C.pipe[1] : C.pipe[0];   // 第 3 輪：袋子右半邊不要整塊黑
      if (!top && u > 0.15 && u < 0.3 && j > 2 && j < 7) c = C.pipe[4];   // 塑膠袋的亮面
      if (top) c = j === 11 ? C.pipe[3] : C.pipe[2];
      put(frame, x0 - 2 + i, y - 2 - j, c);
    } });
    for (let j = 0; j < 5; j++) for (let i = 0; i < 4; i++) put(frame, x0 + 8 + i, y - 2 - j, j === 4 ? C.pipe[5] : i === 0 ? C.pipe[4] : i < 3 ? C.pipe[3] : C.pipe[2]);   // 罐頭
    put(frame, x0 + 9, y - 4, C.drum[3]); put(frame, x0 + 10, y - 4, C.drum[3]);
    for (let i = 0; i < 5; i++) put(frame, x0 - 13 + i, y - 3, C.junk[3]);   // 魚骨頭
    for (const i of [1, 2, 3]) { put(frame, x0 - 13 + i, y - 4, C.junk[3]); put(frame, x0 - 13 + i, y - 2, C.junk[3]); }
    put(frame, x0 - 8, y - 4, C.junk[3]); put(frame, x0 - 8, y - 2, C.junk[3]);
    for (let k = 0; k < 3; k++) {
      const p = (t * 0.5 + k / 3) % 1, bx = x0 - 5 + k * 5 + Math.sin(p * 6 + k) * 1.5, by = y - 4 - p * 18;
      if (p < 0.55) { put(frame, bx, by, C.junk[7], 1); put(frame, bx + 1, by, C.junk[6]); put(frame, bx, by + 1, C.junk[5]); put(frame, bx + 1, by + 1, C.junk[4]); }
      else put(frame, bx, by, C.junk[6], 1);
    }
  } else if (h.type === "pipe") {
    // 漏電管線：地上冒出一截斷掉的鐵管（彎頭朝右），斷口每 1.6 秒放一次電（電弧打到地上），平常偶爾冒小火花
    for (let j = 0; j < 12; j++) for (let i = -3; i <= 3; i++) put(frame, x0 + i, y - 1 - j, i === -3 ? C.pipe[1] : i < -1 ? C.pipe[4] : i < 1 ? C.pipe[3] : i < 3 ? C.pipe[2] : C.pipe[0]);
    for (let i = -4; i <= 4; i++) { put(frame, x0 + i, y - 4, C.pipe[i < 0 ? 5 : 2]); put(frame, x0 + i, y - 1, C.pipe[1]); }   // 管箍、底座
    for (let j = 0; j < 5; j++) for (let i = 3; i <= 7; i++) put(frame, x0 + i, y - 13 + j, j === 0 ? C.pipe[4] : j === 4 ? C.pipe[0] : C.pipe[3]);   // 彎頭
    for (let j = 0; j < 5; j++) put(frame, x0 + 8, y - 13 + j, C.pipe[0]);   // 斷口
    const zap = t % 1.6 < 0.3;
    if (zap) {
      const f = Math.floor(t * 30);
      let px = x0 + 9, py = y - 11;
      for (let s = 0; s < 5; s++) {
        const nx = px + (s % 2 ? 0 : 2) + hash(f, s) * 2, ny = py + 1 + hash(s, f) * 2.5;   // 第 2 輪：折得更兇
        for (let q = 0; q <= 3; q++) { put(frame, px + ((nx - px) * q) / 3, py + ((ny - py) * q) / 3, C.volt[3], 1); put(frame, px + ((nx - px) * q) / 3, py + ((ny - py) * q) / 3 - 1, C.volt[1], 1); }
        px = nx; py = Math.min(y - 1, ny);
      }
      put(frame, px, y - 1, C.volt[3], 1); put(frame, px - 1, y - 1, C.volt[2], 1); put(frame, px + 1, y - 1, C.volt[2], 1);
    } else if (Math.floor(t * 8) % 5 === 0) put(frame, x0 + 9, y - 11 + (Math.floor(t * 8) % 3), C.volt[2], 1);
  }
}
