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
let C = { enemies: [], atk: () => 10, onReaction: () => {}, burnMul: () => 1, wildR: () => 1, poisonMul: () => 1, poisonDur: () => 1, shockBonus: () => false, chainExtra: () => false };
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
let ALLOW = null;
/** 只允許這幾種狀態（1-1 只有黏液和燃燒）；null＝全部 */
export const setStatusAllow = (ids) => (ALLOW = ids ? new Set(ids) : null);
export function applyStatus(e, id, depth = 0) {
  if (!e || e.dead || e.isBoss || !e.tick) return;
  if (ALLOW && !ALLOW.has(id === "fire" ? "burn" : id)) return;   // 王先不吃狀態（之後再設計王的抗性）
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
  S[id] = Math.max(S[id] ?? 0, STATUS[id].dur * (id === "poison" ? C.poisonDur() : 1));
  if (id === "burn") S.burnDps = C.atk() * 0.3 * C.burnMul();
  if (id === "poison") S.poisonDps = C.atk() * 0.2 * C.poisonMul();
  if (id === "shock") { e.stun = Math.max(e.stun, 0.45); if (C.shockBonus()) { S.shock += 1; e.stun = Math.max(e.stun, 1); } }
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
      if (C.chainExtra()) { const extra = near(e, 90).find((o) => !list.includes(o)); if (extra) list.push(extra); }   // 導電體：多跳一隻
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

// ---- 使用者 2026-11-06：元素狀態要「纏」在敵人身上（像燃燒的史萊姆），不是在頭上顯示。
//   參考 pixelfx status/burning、status/poisoned、lightning/electrified（特效沿著角色輪廓長出來）——只學做法：
//   敵人畫上去之前先記下那一塊畫面（statusSnap），畫完比對就知道哪些像素是牠的身體（遮罩），
//   再從遮罩找出輪廓（上緣、側邊、下緣）：火、電、毒、黏液都沿著輪廓畫（使用者 2026-11-06：純粒子，身體不染色）。
//   在瀏覽器裡看三輪調的（node 草稿載不進怪物圖）
const ANY = ["burn", "poison", "slime", "stuck", "shock", "wet", "oil"];
const MARGIN = 12;   // 遮罩往碰撞框外多看幾格（圖比碰撞框大）
export function statusSnap(frame, e) {
  const S = e.st;
  if (!S || e.dead || !ANY.some((k) => S[k] > 0)) return null;
  const b = e.box(), x0 = Math.max(0, Math.round(b.x0 - MARGIN) - frame.ox), y0 = Math.max(0, Math.round(b.y0 - MARGIN) - frame.oy);
  const x1 = Math.min(frame.w, Math.round(b.x1 + MARGIN) - frame.ox), y1 = Math.min(frame.h, Math.round(b.y1 + 3) - frame.oy);
  if (x1 <= x0 || y1 <= y0) return null;
  const w = x1 - x0, h = y1 - y0, px = new Uint32Array(w * h);
  for (let y = 0; y < h; y++) px.set(frame.color.subarray((y0 + y) * frame.w + x0, (y0 + y) * frame.w + x1), y * w);
  return { x0, y0, w, h, px };
}
const SMOKE = P("#4a4250"), DRIP_EDGE = P("#0c0a14"), DRIP_HI = P("#ffffff");

/** 畫一隻敵人身上的狀態（在敵人之後呼叫）。snap＝statusSnap() 在敵人畫上去之前拍的那塊畫面 */
export function drawStatus(frame, e, snap) {
  const S = e.st;
  if (!S || e.dead || !snap) return;
  const { x0, y0, w, h, px } = snap, W = frame.w, C = frame.color, L = frame.light, t = e.clock, sd = Math.round(e.x * 0.37);
  // 遮罩：畫敵人前後不一樣的像素＝牠的身體
  const m = new Uint8Array(w * h);
  let top = h, bot = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (C[(y0 + y) * W + x0 + x] !== px[y * w + x]) { m[y * w + x] = 1; if (y < top) top = y; if (y > bot) bot = y; }
  if (bot < 0) return;
  const at = (x, y) => x >= 0 && y >= 0 && x < w && y < h && m[y * w + x] === 1;
  const tops = [], sides = [], bots = [], edges = [];
  for (let y = top; y <= bot; y++) for (let x = 0; x < w; x++) {
    if (!at(x, y)) continue;
    const up = !at(x, y - 1), dn = !at(x, y + 1), side = !at(x - 1, y) || !at(x + 1, y);
    if (up) tops.push([x, y]);
    if (dn) bots.push([x, y]);
    if (side && !up) sides.push([x, y]);
    if (up || dn || side) edges.push([x, y]);
  }
  const hgt = Math.max(1, bot - top + 1);
  const P2 = (x, y, c, glow = 0) => put(frame, x + x0 + frame.ox, y + y0 + frame.oy, c, glow);
  const pick = (list, k, salt) => (list.length ? list[Math.floor(hash(k, salt + sd) * list.length) % list.length] : null);

  // ---- 使用者 2026-11-06「元素效果要純粒子」：身體一律不變色，只用粒子表現——
  //   泡到東西（黏液、潮濕、油汙、毒）＝從身體下緣、側邊一滴一滴往下滴；燃燒＝火苗沿輪廓往上舔＋火星；帶電＝閃電沿輪廓竄、橫跨身體
  // drip：從輪廓上挑一個點，拉長 → 斷掉 → 往下掉，落地前消失。life＝一輪幾秒，len＝拉多長，cols＝[亮, 中, 暗]
  // 第 2 輪：從身體兩側（往外一格）滴下來，一路落到腳下的地面再濺開——原本從下緣滴，馬上就掉進地面看不到
  const drip = (list, k, salt, life, len, cols, glowIt = false) => {
    const cyc = Math.floor((t + k * life * 0.37) / life), p = ((t + k * life * 0.37) % life) / life, q = pick(list, k + cyc * 5, salt);
    if (!q) return;
    const front = q.front, out = q[0] < w / 2 ? -1 : 1, x = front ? q[0] : q[0] + out, y0 = q[1];
    // 第 3 輪：水滴放大（原本一顆像素看不到）——掛著＝一條細線＋末端 2×2 的珠；掉下來＝2×3 的水滴形，右下暗一階
    // 第 4 輪：3 高 2 寬、外面一圈暗邊、一顆白色高光（在怪物身上、暗背景上都看得到）
    const bead = (bx, by) => {
      for (const [dx, dy] of [[0, -2], [-1, -1], [2, -1], [-1, 0], [2, 0], [-1, 1], [2, 1], [0, 2], [1, 2]]) P2(bx + dx, by + dy, DRIP_EDGE);
      P2(bx, by - 1, cols[1]); P2(bx + 1, by - 1, cols[0], glowIt); P2(bx, by, cols[0], glowIt); P2(bx + 1, by, cols[1]); P2(bx, by + 1, cols[1]); P2(bx + 1, by + 1, cols[2]);
      P2(bx, by - 1, DRIP_HI);
    };
    if (p < 0.4) {   // 掛在身上、慢慢拉長
      const L = Math.max(1, Math.round((p / 0.4) * len));
      for (let j = 0; j < L; j++) P2(x, y0 + j, cols[1]);
      bead(x, y0 + L);
    } else {         // 斷掉、往下掉（越掉越快），掉到腳下濺開
      const f = (p - 0.4) / 0.6, fy = Math.min(bot, y0 + len + f * f * (bot - y0 + 6));
      if (fy < bot - 1) bead(x, fy);
      else { P2(x - 1, bot, cols[0]); P2(x + 1, bot, cols[0]); P2(x - 2, bot - 1, cols[1]); P2(x + 2, bot - 1, cols[1]); P2(x - 3, bot - 2, cols[2]); P2(x + 3, bot - 2, cols[2]); }
    }
  };
  // 一半從兩側滴下來，一半從身體正面（下半身）往下流
  const lower = sides.filter(([, y]) => (bot - y) / hgt < 0.75), fronts = [];
  for (let k = 0; k < 6; k++) { const yy = Math.round(top + hgt * (0.45 + 0.08 * k)), xs = []; for (let x = 0; x < w; x++) if (at(x, yy) && at(x - 2, yy) && at(x + 3, yy)) xs.push(x); if (xs.length) { const q = [xs[Math.floor(hash(k, sd + 7) * xs.length)], yy]; q.front = true; fronts.push(q); } }
  const drips = [...(lower.length ? lower : sides).filter((_, i) => i % 3 === 0), ...fronts];
  if (S.oil > 0) {
    // 油汙：黑油從下緣一條條慢慢滴，滴下去的油珠上有一點彩虹光；腳邊一小灘
    for (let k = 0; k < 4; k++) drip(drips, k, 51, 1.6, 4, [OIL_P[k % 2 ? 3 : 4], OIL_P[2], OIL_P[1]]);
    for (let x = -4; x <= 4; x++) put(frame, e.x + x, e.box().y1, Math.abs(x) === 4 ? OIL_P[1] : x === -1 ? OIL_P[4] : OIL_P[0]);
  }
  if (S.wet > 0) {
    // 潮濕：水珠從下緣、兩側滴下來（白點＋淺藍＋藍）
    for (let k = 0; k < 5; k++) drip(drips, k, 61, 0.9, 2, [WET_P[3], WET_P[2], WET_P[1]]);
  }
  if (S.slime > 0 || S.stuck > 0) {
    // 黏液：黃綠色的黏液從下緣拉得很長才斷掉，兩側也掛幾條
    for (let k = 0; k < 5; k++) drip(drips, k, 71, 1.4, 5, [GOO_P[2], GOO_P[1], GOO_P[0]], true);
    if (S.stuck > 0) for (let k = 0; k < 3; k++) { const q = pick(edges, Math.floor(t * 14) + k * 7, 81); if (q) P2(q[0], q[1], VOLT_P[3], 1); }
  }
  if (S.poison > 0) {
    // 毒：紫綠色的毒液往下滴，頭頂冒毒泡（圈圈往上飄、破掉），旁邊飄幾顆小毒霧點
    for (let k = 0; k < 4; k++) drip(drips, k, 95, 1.2, 3, [TOX_P[2], TOX_P[1], TOX_P[3]], true);
    for (let k = 0; k < 3; k++) {
      const life = 1.1, cyc = Math.floor((t + k * 0.37) / life), p = ((t + k * 0.37) % life) / life, q = pick(tops, k + cyc * 3, 91); if (!q) continue;
      const bx = q[0], by = q[1] - 1 - p * 9;
      if (p < 0.8) { P2(bx, by, TOX_P[2], 1); P2(bx + 1, by, TOX_P[1]); P2(bx, by - 1, TOX_P[1]); P2(bx + 1, by - 1, TOX_P[3]); }
      else { P2(bx - 1, by, TOX_P[2], 1); P2(bx + 2, by, TOX_P[2], 1); P2(bx, by - 2, TOX_P[1]); }
    }
    for (let k = 0; k < 3; k++) { const p = (t * 0.5 + k * 0.33) % 1, q = pick(edges, k, 96 + Math.floor(t * 0.5 + k * 0.33)); if (q) P2(q[0] + Math.sin(p * 6 + k) * 4, q[1] - p * 10, p < 0.5 ? TOX_P[3] : TOX_P[1]); }
  }
  if (S.burn > 0) {
    // 燃燒：火苗從輪廓上好幾個點往上舔（上緣多、側邊少），上面飄火星和細煙。大火：火苗更多更高（身體不染色）
    const big = !!S.big, slot = Math.floor(t * 3);
    const roots = [...tops.filter(([x]) => hash(x + slot * 7, sd) < (big ? 0.5 : 0.32)), ...sides.filter(([x, y]) => (bot - y) / hgt > 0.3 && hash(y + slot * 5, x + sd) < (big ? 0.25 : 0.12))];
    for (const [x, y] of roots) {
      const flick = Math.floor(t * 14 + hash(x, y) * 9) % 4, hh = 3 + flick + (big ? 4 : 0) + Math.round(hash(y, x + sd) * 2);
      const sway = Math.round(Math.sin(t * 9 + x * 1.3));
      for (let j = 0; j < hh; j++) {
        const q = j / hh, c = q < 0.3 ? FIRE_P[1] : q < 0.7 ? FIRE_P[2] : FIRE_P[3], X = x + (q > 0.5 ? sway : 0);
        P2(X, y - j, c, 1);
        if (j < (big ? 3 : 2)) P2(X + 1, y - j, j === 0 ? FIRE_P[0] : FIRE_P[1], 1);
      }
    }
    for (let k = 0; k < 6; k++) {
      const life = 0.9, cyc = Math.floor((t + k * 0.19) / life), p = ((t + k * 0.19) % life) / life, q = pick(tops, k + cyc * 5, 31); if (!q) continue;
      const x = q[0] + Math.sin(p * 7 + k) * 2, y = q[1] - 4 - p * 16;
      if (k < 4) P2(x, y, p < 0.5 ? FIRE_P[3] : FIRE_P[2], 1);
      else if (p > 0.3) P2(x, y - 4, SMOKE);
    }
  }
  if (S.shock > 0) {
    // 感電：閃電沿著輪廓竄（白芯青光）、常常一條鋸齒閃電橫跨身體、往外劈出一小段，噴火花（身體不變色）
    const f = Math.floor(t * 14);
    for (const [x, y] of edges) {
      const r = hash(x * 7 + f, y * 3 + sd);
      if (r < 0.12) P2(x, y, VOLT_P[3], 1);
      else if (r < 0.22) P2(x, y, VOLT_P[1], 1);
    }
    const bolt = (a, z, n, jag) => {
      let lx = a[0], ly = a[1];
      for (let s2 = 1; s2 <= n; s2++) {
        const q = s2 / n, x = a[0] + (z[0] - a[0]) * q + (s2 < n ? (hash(f + s2, 9) - 0.5) * jag : 0), y = a[1] + (z[1] - a[1]) * q + (s2 < n ? (hash(f + s2, 3) - 0.5) * jag : 0), st2 = Math.max(1, Math.abs(x - lx), Math.abs(y - ly));
        for (let k = 0; k <= st2; k++) { const X = lx + ((x - lx) * k) / st2, Y = ly + ((y - ly) * k) / st2; P2(X, Y, VOLT_P[3], 1); P2(X, Y - 1, VOLT_P[1], 1); }
        lx = x; ly = y;
      }
    };
    if (edges.length > 4) bolt(edges[Math.floor(hash(f, sd) * edges.length)], edges[Math.floor(hash(sd, f) * edges.length)], 6, 6);
    if (edges.length > 4 && f % 3 === 0) {   // 往外劈出去的一小段
      const a = edges[Math.floor(hash(f, sd + 5) * edges.length)], cx0 = w / 2, cy0 = (top + bot) / 2, dx = a[0] - cx0, dy = a[1] - cy0, d = Math.hypot(dx, dy) || 1;
      bolt(a, [a[0] + (dx / d) * 9, a[1] + (dy / d) * 9], 3, 4);
    }
    for (let k = 0; k < 3; k++) { const q = pick(edges, f + k * 11, 41), p = (t * 5 + k * 0.33) % 1; if (q) P2(q[0] + (k ? 1 : -1) * p * 7, q[1] - p * 5 + p * p * 8, VOLT_P[2], 1); }
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
