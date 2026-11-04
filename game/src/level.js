// 第一章的關卡場景：深淵·垃圾山（層次＋光影版）。地形照 stages.js 的這一關（寬、平台、火把、主題）烘焙：
//   abyss＝1-1 墜落之底、junk＝1-2 垃圾山（垃圾更多、平台是木板鐵架、偏鏽色）、cave＝1-3 蝙蝠洞窟（更暗、水晶更多）
// 參考絲之歌、Ori 的「技法」（不是畫面）＋ SLYNYRD 的像素視差教學，見 docs/素材參考.md：
//   6 層：天空霧光（逆光，中下段最亮）→ 遠景 → 中遠景（巨大垃圾剪影）→ 中景（鎖鏈、水晶）→ 遊玩層 → 前景剪影
//   越遠越接近霧色、越近越暗；遊玩層對比最高；前景幾乎全黑，框住畫面。
// 每個環境像素存「色票編號＋明暗階」，畫的時候依光源（light.js）把明暗階往上加，所以場景會被火把、
// 水晶、火球、爆炸照亮，而且顏色永遠是色票裡的顏色（規則v2：不漸層、不柔邊）。
import { hex, rand } from "../../pixelfx/src/core/index.js";
import { tintOf } from "./light.js";
import { loadArt, cell, baseRow, blit, glows, glowClusters } from "./art.js";
import { LAYOUT, STAGE_ID } from "./stages.js";

export const H = 216;
export const LEVEL_W = LAYOUT.w;
export const THEME = LAYOUT.theme;
export { STAGE_ID };
const S = { abyss: 0, junk: 100, cave: 200, lair: 300 }[THEME] ?? 0;
const JUNKY = THEME === "junk" || THEME === "lair";   // 巢穴＝垃圾山的最深處   // 亂數種子錯開，每關長得不一樣
export const FLOOR = 184;
export const WALL = 16;
/** 單向平台：從下面可以跳上來，往下滑可以穿過去。 */
export const PLATFORMS = LAYOUT.platforms;
/** 火把位置（插在地上）。 */
export const TORCHES = LAYOUT.torches;

// ---- 美術素材（game/art/approved/valley＋道具，Aseprite 重繪稿）
// 圖層（視差）：最遠背景 back（0.05）→ 遠景 far（0.12）→ 中景 mid（0.3）→ 近景 near（0.6）→ 遊玩層（1）→ 前景 fg（1.35）
const ART = await loadArt(["valley/back", "valley/far", "valley/mid", "valley/near", "valley/fg", "valley/ground", "valley/platform",
  "props/rocks", "props/junk", "props/crystals", "props/grass", "props/flowers", "props/moss"]);
const C = (s) => hex(s) >>> 0;
const PAR = { 0: 0.05, 1: 0.12, 2: 0.3, 3: 0.6, F: 1.35 };
const BACK_COLOR = C("#07070f");
const PF = new Uint32Array(LEVEL_W * H);     // 遊玩層（地面、牆、平台、地上的道具）
const PFE = new Uint8Array(LEVEL_W * H);     // 自己會發光的像素（水晶），光影不改它
const FG_DROP = 26;                          // 前景往上收：垂掛的岩塊只露出下半，不擋到平台
/** 近景水晶的光（座標在近景圖層裡，會跟著畫面循環） */
const CRYSTAL_LIGHTS = [];
/** 地上道具水晶的光（遊玩層座標） */
const PROP_LIGHTS = [];
const wrap = (x, w) => ((x % w) + w) % w;

// 每關放在地上的道具（主題不同，放的東西不同）：[素材表, 格寬, 格高, 可用的格子]
const KIT = {
  rocks: ["props/rocks", 64, 64, [0, 1, 2, 3]], bigRocks: ["props/rocks", 64, 64, [4, 5, 6]],
  junk: ["props/junk", 48, 40, [0, 1, 2, 3, 4, 6, 7]], gold: ["props/crystals", 52, 52, [0, 1]], cyan: ["props/crystals", 52, 52, [3, 4]],
  grass: ["props/grass", 24, 24, [0, 1, 2, 3, 4, 5, 6, 7]], shrooms: ["props/flowers", 32, 32, [4, 5, 6]],
};
const MIX = {
  abyss: { gap: 70, pick: ["rocks", "grass", "grass", "shrooms", "junk", "cyan", "rocks", "grass"] },
  junk: { gap: 54, pick: ["junk", "junk", "grass", "rocks", "junk", "gold", "junk", "grass"] },
  cave: { gap: 64, pick: ["cyan", "rocks", "grass", "cyan", "bigRocks", "shrooms", "cyan", "grass"] },
  lair: { gap: 90, pick: ["junk", "rocks", "grass", "junk"] },
}[THEME];

function build() {
  if (!ART["valley/ground"]) return;
  const gt = ART["valley/ground"];
  const put = (x, y, c) => { if (x >= 0 && y >= 0 && x < LEVEL_W && y < H && c) PF[y * LEVEL_W + x] = c; };
  // 地面：草皮最上緣在第 9 列 → 對準 FLOOR；超出圖塊的部分用最下面那列補
  for (let x = 0; x < LEVEL_W; x++) for (let y = FLOOR - 9; y < H; y++) put(x, y, gt.px[Math.min(gt.h - 1, y - FLOOR + 9) * gt.w + (x % gt.w)]);
  // 兩側的牆：用地面圖塊的石頭部分（第 16 列以下）往上疊，內側一條暗邊
  for (const side of [0, LEVEL_W - WALL]) for (let x = side; x < side + WALL; x++) for (let y = 0; y < FLOOR - 9; y++) {
    const inner = side === 0 ? x === WALL - 1 : x === side;
    put(x, y, inner ? C("#12122a") : gt.px[(16 + (y % 30)) * gt.w + 86 + (x % 30)]);   // 地面圖塊 86～115 欄只有石頭
  }
  // 地上的道具：照主題輪流挑，避開火把；水晶標成自己發光
  const glow = [];
  let k = 0;
  for (let cx = 70; cx < LEVEL_W - 50; cx += MIX.gap + Math.floor(rand(k + S, 51) * MIX.gap * 0.6)) {
    k++;
    if (TORCHES.some((t) => Math.abs(t - cx) < 34)) continue;
    const [sheet, cw, ch, cells] = KIT[MIX.pick[k % MIX.pick.length]];
    const img = cell(ART[sheet], cells[Math.floor(rand(k + S, 52) * cells.length)], cw, ch);
    blit(PF, LEVEL_W, H, img, Math.round(cx - cw / 2), FLOOR + 1 - baseRow(img), { onPx: (i, c, x, y) => { if (glows(c)) { PFE[i] = 1; glow.push([x, y, c]); } } });
  }
  for (const g of glowClusters(glow, 24)) PROP_LIGHTS.push({ x: g.x, y: g.y, r: 30, lv: 1.6, col: g.col });
  // 平台：浮空岩台的左半＋右半拼成平台的寬度；苔蘚頂面（第 4 列）對準平台的高度
  const pl = ART["valley/platform"];
  for (const p of PLATFORMS) {
    const half = Math.floor(p.w / 2), x0 = p.x;
    for (let y = 0; y < pl.h; y++) for (let i = 0; i < p.w; i++) {
      const sx = i < half ? 4 + i : 126 - (p.w - 1 - i);
      put(x0 + i, p.y - 4 + y, pl.px[y * pl.w + sx]);
    }
  }
  // 近景的水晶：找亮青色的像素群，當光源
  const nr = ART["valley/near"], pts = [];
  for (let y = 0; y < nr.h; y++) for (let x = 0; x < nr.w; x++) { const c = nr.px[y * nr.w + x]; if (c && glows(c)) pts.push([x, y, c]); }
  for (const g of glowClusters(pts, 28)) CRYSTAL_LIGHTS.push({ x: g.x, y: g.y, r: 34, lv: 2 });
}
build();

// 四角暗角：每個畫面大小算一次（0～1，平滑）
let vig = new Float32Array(0), vigW = 0;
function vignette(W) {
  if (vigW === W) return vig;
  vigW = W;
  vig = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (x - W / 2) / (W / 2), dy = (y - H / 2) / (H / 2), d = dx * dx * 0.6 + dy * dy;
    vig[y * W + x] = Math.max(0, Math.min(1, (d - 0.55) * 1.3));
  }
  return vig;
}
const LAYER_DIM = { 1: 0.78, 2: 0.66, 3: 0.6, 4: 1 };
const dim = (c, k) => 0xff000000 | ((((c >>> 16) & 255) * k) << 16) | ((((c >>> 8) & 255) * k) << 8) | ((c & 255) * k);

/** 畫背景＋遊玩層。lv 是 light.js 算出來的亮度（螢幕座標，小數）：照到的地方加上光源的顏色。 */
export function drawLevel(frame, lv) {
  const W = frame.w, cx = frame.ox | 0, cy = frame.oy | 0, out = frame.color, V = vignette(W), [TR, TG, TB] = tintOf(), LB = frame.light;
  const B = ART["valley/back"], F1 = ART["valley/far"], M2 = ART["valley/mid"], N3 = ART["valley/near"];
  const o0 = Math.floor(cx * PAR[0]), o1 = Math.floor(cx * PAR[1]), o2 = Math.floor(cx * PAR[2]), o3 = Math.floor(cx * PAR[3]);
  for (let y = 0; y < H; y++) {
    const wy = y + cy, row = y * W;
    if (wy < 0 || wy >= H) { out.fill(BACK_COLOR, row, row + W); continue; }
    for (let x = 0; x < W; x++) {
      const i = row + x, gx = x + cx;
      let v = gx >= 0 && gx < LEVEL_W ? PF[wy * LEVEL_W + gx] : 0, layer = 4;
      if (!v) { v = N3.px[wy * N3.w + wrap(x + o3, N3.w)]; layer = 3; }
      if (!v) { v = M2.px[wy * M2.w + wrap(x + o2, M2.w)]; layer = 2; }
      if (!v) { v = F1.px[wy * F1.w + wrap(x + o1, F1.w)]; layer = 1; }
      if (!v) { out[i] = B.px[wy * B.w + wrap(x + o0, B.w)] || BACK_COLOR; continue; }
      if (layer === 4 && PFE[wy * LEVEL_W + gx]) { out[i] = v; continue; }
      // 越遠越暗（近景、中景退後一步，遊玩層最清楚），再加四角暗角
      const k = LAYER_DIM[layer] * (1 - V[i] * (layer >= 3 ? 0.35 : 0.15));
      out[i] = k < 0.99 ? dim(v, k) : v;
      // 光的顏色：遊玩層和近景被火把、水晶、火球照到時加上光源的色調
      const l = lv[i];
      if (l > 0.02 && layer >= 3) {
        const s3 = layer === 4 ? 1 : 0.5;
        LB[i] = 0xff000000 | (Math.min(255, TB[i] * s3) << 16) | (Math.min(255, TG[i] * s3) << 8) | Math.min(255, TR[i] * s3);
      }
    }
  }
}

/** 前景：在角色和特效之後畫，蓋在最上面（往上收 FG_DROP 格，只露出垂掛岩塊的下半和地上的剪影）。 */
export function drawForeground(frame) {
  const FGI = ART["valley/fg"];
  if (!FGI) return;
  const W = frame.w, cy = frame.oy | 0, out = frame.color, of = Math.floor((frame.ox | 0) * PAR.F);
  for (let y = 0; y < H; y++) {
    const wy = y + cy, sy = wy < 110 ? wy + FG_DROP : wy;   // 上半（垂掛的岩塊）往上收，下半（地上剪影）不動
    if (wy < 0 || sy >= H) continue;
    const r = sy * FGI.w, row = y * W;
    for (let x = 0; x < W; x++) {
      const v = FGI.px[r + wrap(x + of, FGI.w)];
      if (v) out[row + x] = v;
    }
  }
}

// ---- 大氣：光束（硬邊、分段亮度）＋漂浮光點，都寫進 light 層（加亮）
const SHAFTS = [{ x: 140, w: 14 }, { x: 520, w: 22 }, { x: 860, w: 10 }, { x: 1180, w: 18 }];
const SHAFT_W = 1400, SHAFT_PAR = 0.8;
const SHAFT_C = [[6, 14, 16], [10, 22, 26]];     // 兩段亮度（r, g, b 加量）
const MOTE = [C("#a0eef4"), C("#46b4c8")];
export function drawAtmosphere(frame, time) {
  const W = frame.w, Hh = frame.h, Lb = frame.light, Cb = frame.color, os = Math.floor((frame.ox | 0) * SHAFT_PAR);
  const add = (i, [r, g, b]) => {
    const d = Lb[i];
    Lb[i] = (255 << 24) | (Math.min(255, ((d >>> 16) & 255) + b) << 16) | (Math.min(255, ((d >>> 8) & 255) + g) << 8) | Math.min(255, (d & 255) + r);
  };
  const flicker = 0.75 + 0.25 * Math.sin(time * 1.3);   // 慢慢明暗呼吸，像有東西飄過光源
  for (const s of SHAFTS) for (let rep = -1; rep <= 1; rep++) {
    const base = s.x + rep * SHAFT_W - os;
    for (let y = 0; y < FLOOR - 10 && y < Hh; y++) {
      const fall = 1 - y / 150;                                    // 往下慢慢淡掉
      if (fall <= 0) break;
      const x0 = base + y * 0.45, half = s.w * 0.5 + 3, mid = x0 + s.w * 0.5;
      for (let x = Math.max(0, Math.floor(mid - half)); x < Math.min(W, Math.ceil(mid + half)); x++) {
        const across = 1 - Math.abs(x + 0.5 - mid) / half;        // 中間亮、兩邊柔和
        if (across <= 0) continue;
        const k = across * across * fall * flicker;
        add(y * W + x, [SHAFT_C[1][0] * k, SHAFT_C[1][1] * k, SHAFT_C[1][2] * k]);
      }
    }
  }
  // 光點：慢慢往上飄，跟著中景的視差
  const om = Math.floor((frame.ox | 0) * 0.6);
  for (let n = 0; n < 36; n++) {
    const x = wrap(Math.floor(rand(n, 71) * 1440) + Math.round(Math.sin(time * 0.8 + n) * 3) - om, 1440);
    if (x >= W) continue;
    const y = FLOOR - 4 - Math.floor((time * (6 + rand(n, 72) * 8) + rand(n, 73) * 170) % 170);
    if (y < 0 || y >= Hh) continue;
    const i = y * W + x;
    Cb[i] = MOTE[n & 1];
    add(i, [20, 50, 56]);
    // 光點旁邊一圈淡淡的光暈
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && xx < W && yy >= 0 && yy < Hh) add(yy * W + xx, [6, 16, 18]);
    }
  }
}

/** 這一幀要算的固定光源：火把（遊玩層）＋中景水晶（會循環，挑畫面附近的）。 */
export function sceneLights(camX, W, time) {
  const list = [];
  for (const x of TORCHES) list.push({ x, y: FLOOR - 26, r: 74 + (Math.floor(time * 8) % 3), lv: 3, col: "#ff8a3a" });
  const o = camX * PAR[3], W3 = ART["valley/near"]?.w || 896;
  for (const c of CRYSTAL_LIGHTS) {
    const k = Math.round((o - c.x + W / 2) / W3);
    list.push({ x: c.x + k * W3, y: c.y, r: c.r, lv: c.lv, par: PAR[3], col: "#46d4e8" });
  }
  for (const c of PROP_LIGHTS) list.push(c);
  return list;
}

/** 腳下的地面高度：先找平台（只有從上方落下時），再退回地板。 */
// 目前地圖的平台與寬度（城鎮會換成沒有平台、比較窄）
export const geo = { platforms: PLATFORMS, w: LEVEL_W };
export function groundAt(x, prevY, y, dropping) {
  if (!dropping) for (const p of geo.platforms) if (x >= p.x - 2 && x <= p.x + p.w + 2 && prevY <= p.y + 0.5 && y >= p.y) return p.y;
  return y >= FLOOR ? FLOOR : null;
}
/** 是否站在平台上（不是地板）。 */
export const onPlatform = (x, y) => geo.platforms.some((p) => Math.abs(y - p.y) < 0.5 && x >= p.x - 2 && x <= p.x + p.w + 2);
