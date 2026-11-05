// 元素狀態與反應（裝備改版第 3 批，參考 Noita：狀態像「沾到東西」，狀態之間會互相作用，場景也會參與）。
// 只作用在敵人身上（使用者決定：主角不會被反應傷到）。docs/裝備系統企劃.md 第 6 章。
//
// 狀態：燃燒 burn、黏液 slime、帶電 shock、毒 poison、潮濕 wet、油汙 oil
// 來源：形態（星星＝燃燒、黏液星＝黏液、鐵罐星＝帶電、蝠翼星＝毒；連段最後一下和形態技能會沾上）＋場景物件
// 反應：黏液／油汙＋燃燒＝大火、潮濕＋帶電＝感電連鎖、潮濕＋燃燒＝蒸氣、毒＋燃燒＝毒氣爆炸、黏液＋帶電＝麻痺黏住
import { hex } from "../../pixelfx/src/core/index.js";
import * as plasmaFx from "../../pixelfx/src/fx/explosions/plasma-explosion.js";
import * as zapFx from "../../pixelfx/src/fx/lightning/zap-hit.js";
import * as cloudFx from "../../pixelfx/src/fx/nature/poison-cloud.js";
import * as acidFx from "../../pixelfx/src/fx/nature/acid-splash.js";
import { spawn, shake } from "./fx.js";
import { flash } from "./light.js";
import { sfx } from "./audio.js";

export const ELEM = { star: "burn", slime: "slime", can: "shock", bat: "poison" };
export const STATUS = {
  burn: { name: "燃燒", dur: 3 },
  slime: { name: "黏液", dur: 4 },
  shock: { name: "帶電", dur: 1.5 },
  poison: { name: "毒", dur: 5 },
  wet: { name: "潮濕", dur: 6 },
  oil: { name: "油汙", dur: 8 },
};
export const REACTION = {
  wildfire: { name: "大火", col: "#ff8a2a" },
  chain: { name: "感電連鎖", col: "#9af0ff" },
  steam: { name: "蒸氣", col: "#e8f0ff" },
  toxic: { name: "毒氣爆炸", col: "#8ae060" },
  stuck: { name: "麻痺黏住", col: "#b4f890" },
};

// 主程式給的東西：敵人清單、目前攻擊力、第一次觸發反應時的提示
let C = { enemies: [], atk: () => 10, onReaction: () => {}, burnMul: () => 1, wildR: () => 1 };
export const setStatusContext = (c) => (C = { ...C, ...c });

const FIRE = ["#4a1712", "#c9281f", "#f2561d", "#ff8a2a", "#ffc23d", "#ffe26b", "#fff3a6", "#ffffff"];
const STEAM = ["#2a3040", "#4a5468", "#7a8498", "#a8b2c4", "#d0d8e6", "#eef2fa", "#ffffff", "#ffffff"];
const TOXIC = ["#0e1d14", "#173320", "#23552e", "#318232", "#55b92f", "#8eea3f", "#cfff63", "#f6ffc2"];
const GOO = ["#0c2010", "#1a4a20", "#2a8a3a", "#4cc04a", "#8ee86a", "#d4ffb0", "#ffffff"];

const st = (e) => (e.st ??= {});
const has = (e, id) => (e.st?.[id] ?? 0) > 0;
const center = (e) => { const b = e.box(); return [e.x, (b.y0 + b.y1) / 2, b]; };
const near = (e, r) => C.enemies.filter((o) => o !== e && !o.dead && Math.abs(o.x - e.x) < r && Math.abs(o.y - e.y) < r * 0.8);

/** 沾上一個狀態（會先檢查反應）。power：持續傷害的強度（攻擊力倍率）。depth：連鎖深度（避免無限連鎖）。 */
export function applyStatus(e, id, depth = 0) {
  if (!e || e.dead || e.isBoss || !e.tick) return;   // 王先不吃狀態（之後再設計王的抗性）
  const S = st(e);
  // ---- 反應
  if (id === "burn" || id === "fire") {
    if (has(e, "wet")) return react(e, "steam", depth);
    if (has(e, "slime") || has(e, "oil")) return react(e, "wildfire", depth);
    if (has(e, "poison")) return react(e, "toxic", depth);
  }
  if (id === "shock") {
    if (has(e, "wet")) return react(e, "chain", depth);
    if (has(e, "slime")) return react(e, "stuck", depth);
  }
  if ((id === "slime" || id === "oil") && has(e, "burn")) return react(e, "wildfire", depth);
  if (id === "wet" && has(e, "burn")) return react(e, "steam", depth);
  if (id === "wet" && has(e, "shock")) return react(e, "chain", depth);
  if (id === "poison" && has(e, "burn")) return react(e, "toxic", depth);
  // ---- 普通沾上
  S[id] = Math.max(S[id] ?? 0, STATUS[id].dur);
  if (id === "burn") S.burnDps = C.atk() * 0.3 * C.burnMul();
  if (id === "poison") S.poisonDps = C.atk() * 0.2;
  if (id === "shock") e.stun = Math.max(e.stun, 0.45);
}

function react(e, kind, depth) {
  const S = st(e), [x, y, b] = center(e), atk = C.atk();
  C.onReaction(kind, e);
  switch (kind) {
    case "wildfire": {
      // 大火：燒得更久更痛，往旁邊 40px 擴散（只連 2 層）
      S.slime = 0; S.oil = 0;
      S.burn = STATUS.burn.dur * 2; S.burnDps = atk * 0.6 * C.burnMul(); S.big = 1;
      e.tick(atk * 0.8, "#ff8a2a");
      spawn(plasmaFx, { x: Math.round(x), y: Math.round(b.y1), palette: FIRE, light: 0.6, seed: (Math.random() * 99) | 0 }, { speed: 1.6 });
      flash(x, y, 70, 3, 0.35, "#ff8a30");
      shake(0.18, 2);
      sfx("hitH");
      if (depth < 2) for (const o of near(e, 46 * C.wildR())) setTimeout(() => applyStatus(o, "burn", depth + 1), 120 + Math.random() * 120);
      break;
    }
    case "chain": {
      // 感電連鎖：電流跳到附近所有潮濕的敵人（和牠自己），一起被電
      S.wet = 0;
      const list = [e, ...near(e, 90).filter((o) => has(o, "wet"))];
      let prev = e;
      list.forEach((o, i) => {
        setTimeout(() => {
          if (o.dead) return;
          const [ox, oy, ob] = center(o);
          bolts.push({ x0: prev.x, y0: center(prev)[1], x1: ox, y1: oy, t: 0 });
          prev = o;
          o.st.wet = 0;
          o.stun = Math.max(o.stun, 0.8);
          o.tick(atk * 1.1, "#9af0ff");
          spawn(zapFx, { x: Math.round(ox), y: Math.round(oy), light: 0.5, seed: i + 3 });
          flash(ox, oy, 46, 2.5, 0.2, "#9af0ff");
        }, i * 70);
      });
      sfx("crit");
      break;
    }
    case "steam": {
      // 蒸氣：火熄掉、潮濕蒸發，冒出一團白霧，霧裡的敵人持續受傷 1.5 秒
      S.burn = 0; S.wet = 0;
      const fx = spawn(cloudFx, { x: Math.round(x), y: Math.round(b.y1), palette: STEAM, light: 0.1, seed: (Math.random() * 99) | 0 }, { speed: 1.4 });
      setTimeout(() => fx.stop(), 1300);
      clouds.push({ x, y: b.y1, t: 1.5, dps: atk * 0.5 });
      sfx("hitL");
      break;
    }
    case "toxic": {
      // 毒氣爆炸：範圍爆炸，毒用掉
      S.poison = 0;
      spawn(acidFx, { x: Math.round(x), y: Math.round(b.y1), palette: TOXIC, light: 0.4, seed: (Math.random() * 99) | 0 }, { speed: 1.5 });
      flash(x, y, 64, 2.5, 0.3, "#8ae060");
      shake(0.2, 2);
      sfx("hitH");
      for (const o of [e, ...near(e, 44)]) o.tick(atk * (o === e ? 1.6 : 1.2), "#8ae060");
      break;
    }
    case "stuck": {
      // 麻痺黏住：黏液導電，長時間定身
      S.slime = 0; S.shock = 0; S.stuck = 2.5;
      e.stun = Math.max(e.stun, 2.5);
      e.tick(atk * 0.6, "#b4f890");
      spawn(zapFx, { x: Math.round(x), y: Math.round(y), palette: GOO, light: 0.4, seed: 7 });
      flash(x, y, 40, 2, 0.25, "#b4f890");
      sfx("hitL");
      break;
    }
  }
}

// ---- 每格更新：持續傷害、倒數；蒸氣霧；電流的閃線
const bolts = [], clouds = [];
let dotClock = 0;
export function updateStatus(dt, enemies) {
  dotClock += dt;
  const pulse = dotClock >= 0.5;   // 持續傷害每 0.5 秒跳一次數字
  if (pulse) dotClock -= 0.5;
  for (const e of enemies) {
    const S = e.st;
    if (!S || e.dead) continue;
    for (const id of ["burn", "slime", "shock", "poison", "wet", "oil", "stuck"]) if (S[id] > 0) S[id] -= dt;
    if (S.burn <= 0) S.big = 0;
    if (pulse) {
      const d = (S.burn > 0 ? S.burnDps : 0) * 0.5 + (S.poison > 0 ? S.poisonDps : 0) * 0.5;
      if (d > 0) e.tick(d, S.burn > 0 ? "#ff8a2a" : "#8ae060", true);
    }
  }
  for (const c of clouds) {
    c.t -= dt;
    if (pulse) for (const e of enemies) if (!e.dead && Math.abs(e.x - c.x) < 34 && Math.abs(e.y - c.y) < 40) e.tick(c.dps * 0.5, "#e8f0ff", true);
  }
  for (let i = clouds.length - 1; i >= 0; i--) if (clouds[i].t <= 0) clouds.splice(i, 1);
  for (const b of bolts) b.t += dt;
  for (let i = bolts.length - 1; i >= 0; i--) if (bolts[i].t > 0.22) bolts.splice(i, 1);
}
/** 敵人移動、動畫的速度倍率（黏液＝變慢） */
export const slowOf = (e) => (e.st?.slime > 0 ? 0.5 : 1);

// ---- 畫：每個狀態一種小特效，貼在敵人身上（自己畫的像素，不用 pixelfx 的角色狀態特效，因為那些要套在 pixelfx 的標準角色上）
const P = (c) => hex(c) >>> 0;
const FIRE_P = ["#8a1f17", "#f2561d", "#ffc23d", "#fff3a6"].map(P);
const GOO_P = ["#5a8a10", "#c8f048", "#f0ffa0", "#ffffff"].map(P);
const VOLT_P = ["#1e64b0", "#3ab8f0", "#9af0ff", "#ffffff"].map(P);
const TOX_P = ["#1a3a1a", "#8ae040", "#e8ff70", "#7a2a9a", "#ffffff"].map(P);
const WET_P = ["#1e64b0", "#3a8cf0", "#9ad8ff", "#ffffff"].map(P);
const OIL_P = ["#0a060c", "#2a1a2a", "#3a2a48", "#5af0d0", "#e080ff"].map(P);
const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

function put(frame, x, y, c, glow = 0) {
  x = Math.round(x) - frame.ox; y = Math.round(y) - frame.oy;
  if (x < 0 || y < 0 || x >= frame.w || y >= frame.h) return;
  const i = y * frame.w + x;
  frame.color[i] = c;
  if (glow) frame.light[i] = c;
}

/** 畫一隻敵人身上的狀態（在敵人之後呼叫，蓋在牠身上）。第 2 輪：全部放大、跟綠色魔物拉開對比 */
export function drawStatus(frame, e) {
  const S = e.st;
  if (!S || e.dead) return;
  const b = e.box(), t = e.clock, w = b.x1 - b.x0, h = b.y1 - b.y0, sd = e.x * 0.37;
  if (S.burn > 0) {
    // 燃燒：沿著頭頂一排火舌（底 3 格寬、往上收尖，深紅→橘→黃→白尖），每條自己閃；大火更多更高；上面飄火星
    const n = S.big ? 5 : 4;
    for (let k = 0; k < n; k++) {
      const fx = Math.round(b.x0 + 3 + ((k + 0.5) / n) * (w - 6)), flick = (Math.floor(t * 14 + k * 2.3) % 4), hh = (S.big ? 9 : 6) + flick - (k % 2) * 2;
      const by = b.y0 + 3, sway = Math.round(Math.sin(t * 8 + k * 1.7));
      for (let j = 0; j < hh; j++) {
        const q = j / hh, half = q < 0.6 ? 1 : 0, dx = q > 0.55 ? sway : 0;   // 第 3 輪：下面 6 成都是 3 格寬，火舌比較飽
        const c = q < 0.25 ? FIRE_P[0] : q < 0.55 ? FIRE_P[1] : q < 0.85 ? FIRE_P[2] : FIRE_P[3];
        for (let i = -half; i <= half; i++) put(frame, fx + i + dx, by - j, i ? FIRE_P[Math.max(0, FIRE_P.indexOf(c) - 1)] : c, 1);
      }
    }
    for (let k = 0; k < 4; k++) {
      const p = (t * 0.9 + hash(sd, k)) % 1;
      put(frame, b.x0 + hash(k, sd) * w + Math.sin(p * 6 + k) * 2, b.y0 - 2 - p * 16, p < 0.5 ? FIRE_P[3] : FIRE_P[2], 1);
    }
  }
  if (S.poison > 0) {
    // 毒：身上兩塊紫斑＋往上飄的毒泡（亮黃綠的圈、深色外框），對比綠色魔物
    for (let k = 0; k < 2; k++) {
      const px = b.x0 + 4 + hash(sd, k + 4) * (w - 8), py = b.y0 + 5 + hash(k, sd + 4) * (h - 10);
      put(frame, px, py, TOX_P[3]); put(frame, px + 1, py, TOX_P[3]); put(frame, px, py + 1, TOX_P[3]);
    }
    for (let k = 0; k < 3; k++) {
      const p = (t * 0.6 + hash(k, sd + 1)) % 1, bx = Math.round(b.x0 + 3 + hash(sd, k + 9) * (w - 6)), by = Math.round(b.y0 + h * 0.4 - p * 20);
      const r = p < 0.7 ? 2 : 1;
      if (r === 2) {
        for (const [dx, dy] of [[-1, -2], [0, -2], [1, -2], [-2, -1], [2, -1], [-2, 0], [2, 0], [-2, 1], [2, 1], [-1, 2], [0, 2], [1, 2]]) put(frame, bx + dx, by + dy, dy > 0 || dx > 1 ? TOX_P[0] : TOX_P[2], dy < 0 ? 1 : 0);
        put(frame, bx - 1, by - 1, TOX_P[4] ?? 0xffffffff);
      } else { put(frame, bx, by, TOX_P[2], 1); put(frame, bx + 1, by, TOX_P[1]); }
    }
  }
  if (S.slime > 0 || S.stuck > 0) {
    // 黏液：頭頂蓋一層淡黃綠的黏液（2 格厚、往兩邊流下），三條粗黏液往下滴，兩顆白亮點
    for (let x = b.x0 + 2; x <= b.x1 - 2; x++) {
      const dd = Math.round(1 + Math.max(0, Math.sin(x * 0.9 + sd)) * 2);
      for (let j = 0; j < dd; j++) put(frame, x, b.y0 + 2 + j, j === 0 ? GOO_P[2] : GOO_P[1]);
    }
    for (let k = 0; k < 3; k++) {
      const p = (t * 0.7 + k * 0.33 + hash(sd, k)) % 1, dx = Math.round(b.x0 + 3 + k * ((w - 6) / 2));
      const len = Math.min(5, Math.floor(p * 8));
      for (let j = 0; j < len; j++) { put(frame, dx, b.y1 - 3 + j, j === len - 1 ? GOO_P[2] : GOO_P[1]); put(frame, dx + 1, b.y1 - 3 + j, GOO_P[0]); }
      if (p > 0.62) { const fy = b.y1 + 3 + (p - 0.62) * 26; put(frame, dx, fy, GOO_P[2]); put(frame, dx, fy + 1, GOO_P[1]); }
    }
    put(frame, b.x0 + w * 0.3, b.y0 + 2, GOO_P[3]); put(frame, b.x0 + w * 0.65, b.y0 + 3, GOO_P[3]);
    if (S.stuck > 0) for (let k = 0; k < 2; k++) { const f = Math.floor(t * 14) + k * 7; put(frame, b.x0 + hash(f, 3) * w, b.y0 + hash(f, 4) * h, VOLT_P[3], 1); put(frame, b.x0 + hash(f, 3) * w + 1, b.y0 + hash(f, 4) * h, VOLT_P[2], 1); }
  }
  if (S.shock > 0) {
    // 帶電：兩條在身上亂跳的電弧（白芯、青色外暈），每 0.08 秒換一次
    for (let a = 0; a < 2; a++) {
      const f = Math.floor(t * 12.5) + a * 31;
      let x = b.x0 + hash(f, sd) * w * 0.3, y = b.y0 + 2 + hash(sd, f) * (h - 4);
      for (let s = 0; s < 6; s++) {
        const nx = x + 2 + hash(f + s, 7) * 3, ny = Math.max(b.y0, Math.min(b.y1 - 1, y + (hash(f, s + 3) - 0.5) * 8));
        for (let q = 0; q <= 4; q++) {
          const X = x + ((nx - x) * q) / 4, Y = y + ((ny - y) * q) / 4;
          put(frame, X, Y - 1, VOLT_P[1], 1); put(frame, X, Y + 1, VOLT_P[1], 1);
          put(frame, X, Y, VOLT_P[3], 1);
        }
        x = nx; y = ny;
      }
    }
  }
  if (S.wet > 0) {
    // 潮濕：身上一條藍白反光、三顆水滴（2 格高）往下滴、腳下濺一點
    for (let x = b.x0 + 3; x < b.x0 + 3 + Math.min(6, w - 6); x++) put(frame, x, b.y0 + 3, x % 2 ? WET_P[3] : WET_P[2]);
    // 第 3 輪：水滴改 2 格寬（白點＋淺藍＋藍），4 顆
    for (let k = 0; k < 4; k++) {
      const p = (t * 1.0 + k * 0.25 + hash(k, sd + 3)) % 1, dx = Math.round(b.x0 + 2 + hash(sd, k + 2) * (w - 5)), dy = Math.round(b.y0 + 5 + p * (h + 2));
      put(frame, dx, dy - 1, WET_P[3]); put(frame, dx + 1, dy - 1, WET_P[2]);
      put(frame, dx, dy, WET_P[2]); put(frame, dx + 1, dy, WET_P[1]);
      put(frame, dx, dy + 1, WET_P[1]); put(frame, dx + 1, dy + 1, WET_P[0]);
    }
  }
  if (S.oil > 0) {
    // 油汙：身上一道會流動的彩虹油光（青→紫→黃），兩條黑油往下滴、腳邊一小灘
    for (let x = b.x0 + 2; x <= b.x1 - 2; x++) {
      const y = Math.round(b.y0 + h * 0.45 + Math.sin(x * 0.6 + t * 2) * 1.5), c = OIL_P[3 + (Math.floor(x * 0.5 + t * 4) % 2)];
      put(frame, x, y, c); put(frame, x, y + 1, OIL_P[2]);
    }
    for (let k = 0; k < 2; k++) {
      const p = (t * 0.5 + hash(k, sd + 5)) % 1, dx = Math.round(b.x0 + 4 + k * (w - 9));
      for (let j = 0; j < 2 + p * 3; j++) { put(frame, dx, b.y1 - 4 + j, OIL_P[0]); put(frame, dx + 1, b.y1 - 4 + j, OIL_P[1]); }
    }
    for (let x = -3; x <= 3; x++) put(frame, e.x + x, b.y1, Math.abs(x) === 3 ? OIL_P[1] : x === -1 ? OIL_P[4] : OIL_P[0]);
  }
}
/** 畫電流連鎖的閃線（折線，0.22 秒） */
export function drawBolts(frame) {
  for (const bl of bolts) {
    const n = 7, f = Math.floor(bl.t * 30);
    let px = bl.x0, py = bl.y0;
    for (let s = 1; s <= n; s++) {
      const q = s / n, x = bl.x0 + (bl.x1 - bl.x0) * q, y = bl.y0 + (bl.y1 - bl.y0) * q + (s < n ? (hash(f + s, bl.x0) - 0.5) * 10 : 0);
      const steps = Math.max(Math.abs(x - px), Math.abs(y - py));
      for (let k = 0; k <= steps; k++) put(frame, px + ((x - px) * k) / steps, py + ((y - py) * k) / steps, bl.t < 0.08 ? VOLT_P[3] : VOLT_P[2], 1);
      px = x; py = y;
    }
  }
}
