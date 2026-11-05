// 主題背景圖層（美術需求 B2，特效補強 4；照 pixelfx skill 畫 → 看 → 修三輪，草稿 game/tools/drafts/bgart.mjs）
//   山谷那套（art/approved/valley）是「洞窟＋垃圾」：遠景＝藍色鐘乳石洞、中景＝垃圾堆、近景＝紫岩黃綠苔蘚。
//   垃圾山（1-2、1-4）換掉遠景、近景：遠方的垃圾山剪影（起重機、電線桿、垂下來的鐵鍊）、近景＝壓扁的鏽鐵木箱輪胎堆＋垂下的電線鐵板。
//   洞窟（1-3）換掉中景、近景：中景＝水晶簇與石柱、近景＝青綠苔蘚的濕岩＋鐘乳石水滴。
// 參考（只學做法）：絲之歌／Ori 的「越遠越接近霧色、剪影少細節」、SLYNYRD Pixelblog 23 視差；垃圾山的鏽鐵與木箱沿用 platform-art 的配色。
// 回傳 { w, h: 216, px: Uint32Array（0xAABBGGRR，0＝透明） }，跟 loadArt 的格式一樣，level.js 直接換掉那一層。
const H = 216;
const hash = (a, b = 0, c = 0) => { let h = (a * 374761393 + b * 668265263 + c * 2246822519) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const C = (hx) => { const n = parseInt(hx.slice(1), 16); return (0xff000000 | ((n & 255) << 16) | (n & 0xff00) | (n >>> 16)) >>> 0; };
/** 平滑的一維雜訊（可循環：x 會對 w 取餘數） */
function wave(x, w, seed, period) {
  const n = Math.max(1, Math.round(w / period)), u = (x / w) * n, i = Math.floor(u), f = u - i, s = f * f * (3 - 2 * f);
  return hash(i % n, seed) * (1 - s) + hash((i + 1) % n, seed) * s;
}

export function genLayer(kind, theme) {
  const w = { far: 640, mid: 768, near: 896 }[kind];
  const px = new Uint32Array(w * H);
  const put = (x, y, hx) => { x = ((Math.round(x) % w) + w) % w; y = Math.round(y); if (y >= 0 && y < H) px[y * w + x] = C(hx); };
  const get = (x, y) => px[y * w + (((x % w) + w) % w)];
  if (theme === "junk" && kind === "far") junkFar(put, w);
  else if (theme === "junk" && kind === "near") junkNear(put, w);
  else if (theme === "cave" && kind === "mid") caveMid(put, w);
  else if (theme === "cave" && kind === "near") caveNear(put, w);
  void get;
  return { w, h: H, px };
}
/** 這個主題要換掉哪幾層 */
export const THEME_LAYERS = { junk: ["far", "near"], lair: ["far", "near"], cave: ["mid", "near"] };

// ---------- 垃圾山：遠景（遠方垃圾山剪影） ----------
function junkFar(put, w) {
  const S = ["#1c1428", "#241a34", "#2e2242", "#3a2c52"];   // 剪影三階＋亮邊（越遠越接近霧色）
  // 山的輪廓：兩個頻率疊起來，山頂高度 70～150
  const top = new Array(w);
  for (let x = 0; x < w; x++) top[x] = Math.round(150 - 55 * wave(x, w, 3, 160) - 28 * wave(x, w, 4, 50) - 6 * wave(x, w, 5, 12));
  for (let x = 0; x < w; x++) for (let y = top[x]; y < H; y++) {
    const d = y - top[x];
    let c = d < 1 ? S[3] : d < 4 && top[x - 1] > top[x] ? S[2] : S[1];
    if (d > 6 && hash(x >> 3, y >> 2, 7) < 0.1) c = S[0];   // 一塊塊暗影（垃圾的縫）
    if (d > 6 && hash(x >> 2, y >> 3, 8) < 0.05) c = S[2];   // 一塊塊稍亮（翹起來的板子）
    put(x, y, c);
  }
  // 起重機（一座）、電線桿（幾根）、天線
  const crane = Math.round(w * 0.62), cb = top[crane];
  for (let y = cb - 64; y < cb; y++) { put(crane, y, S[2]); put(crane + 1, y, S[1]); if (y % 6 === 0) put(crane + 2, y, S[2]); }
  for (let x = crane - 30; x < crane + 22; x++) { put(x, cb - 64, S[2]); if (x % 5 === 0) put(x, cb - 63, S[2]); }
  for (let y = cb - 63; y < cb - 36; y++) put(crane - 26, y, S[2]);   // 吊鉤的鋼索
  put(crane - 27, cb - 36, S[3]); put(crane - 26, cb - 36, S[3]); put(crane - 25, cb - 35, S[3]); put(crane - 27, cb - 34, S[3]);
  for (const fx of [0.12, 0.33, 0.83]) {
    const px = Math.round(w * fx), b = top[px], hgt = 26 + Math.round(hash(px, 9) * 18);
    for (let y = b - hgt; y < b; y++) put(px, y, S[2]);
    for (let x = px - 5; x <= px + 5; x++) put(x, b - hgt + 3, S[2]);
    for (let x = px - 3; x <= px + 3; x++) put(x, b - hgt + 7, S[2]);
  }
  // 從洞頂垂下來的鐵鍊（細，接上層背景的鐵鍊）
  for (let k = 0; k < 7; k++) {
    const cx = Math.round((k + hash(k, 11) * 0.6) * w / 7), len = 30 + Math.round(hash(k, 12) * 50);
    for (let y = 0; y < len; y++) put(cx, y, y % 3 === 0 ? S[3] : S[2]);
    put(cx - 1, len, S[3]); put(cx + 1, len, S[3]); put(cx, len + 1, S[3]);
  }
}

// ---------- 垃圾山：近景（壓扁的垃圾堆＋垂下的電線鐵板） ----------
const RUST = ["#2a1418", "#5a2a20", "#8a3e24", "#b05a2a"], IRON = ["#1c1828", "#3c3a4c", "#5c5868", "#7c7884"], WOOD = ["#2a1820", "#4a2830", "#7a4434", "#a06446"], PAINT = ["#1a1226", "#2a2040", "#3c3058", "#56487a"];
// 第 2 輪：原本一列列一樣大的方塊像磚牆 → 每層高 5～11、每塊寬 7～24、每塊上下錯開 0～3、四角挖圓；越往下越暗
function lump(x, y, w, seed) {
  const xx = ((x % w) + w) % w;
  let by = 0, band = 0, h = 8;
  while (true) { h = 5 + Math.floor(hash(band, seed + 5) * 7); if (y < by + h) break; by += h; band++; }
  const off = Math.floor(hash(band, seed) * 23);
  let bx = -off, k = 0;
  while (true) {
    const bw = 7 + Math.floor(hash(band, k, seed + 1) * 18);
    if (xx < bx + bw || bx > w + 30) {
      const id = band * 131 + k, jit = Math.floor(hash(id, seed + 3) * 4), i = xx - bx, j = y - by + jit, hh = h + 1;
      const corner = (i <= 1 || i >= bw - 2) && (j <= 0 || j >= hh - 2) || (i === 0 || i === bw - 1) && (j <= 1 || j >= hh - 3);
      return { id, i, j, bw, hh, gap: i === bw - 1 || j >= hh - 1 || j < 0 || corner };
    }
    bx += bw; k++;
  }
}
function junkColor(x, y, w, seed, depth) {
  const b = lump(x, y, w, seed);
  if (b.gap) return "#120c1a";
  const kind = hash(b.id, seed + 2), M = kind < 0.32 ? RUST : kind < 0.55 ? IRON : kind < 0.8 ? WOOD : PAINT;
  let c;
  if (kind > 0.93) { const cx = b.i - (b.bw - 2) / 2, cy = b.j - (b.hh - 2) / 2, d = Math.hypot(cx * 0.9, cy * 1.4); c = d < 1.4 ? "#120c1a" : d < 2.6 ? IRON[1] : PAINT[1]; }   // 輪胎
  else if (M === WOOD && (b.i === b.j || b.i === b.bw - 2 - b.j)) c = WOOD[1];   // 木箱的 X
  else c = b.j === 0 ? M[3] : b.i >= b.bw - 3 || b.j >= b.hh - 3 ? M[1] : M[2];
  if (depth > 18) { const k = [RUST, IRON, WOOD, PAINT].find((r) => r.includes(c)); if (k) c = k[Math.max(0, k.indexOf(c) - 1)]; }   // 越深越暗一階
  return c;
}
// 第 3 輪：近景一層層排還是像牆 → 改成沿地面堆一顆顆大小不一的橢圓（山谷近景的做法），後面的先畫、前面的蓋上去
function heap(w, seed, n, yTop) {
  const list = [];
  for (let k = 0; k < n; k++) {
    // 第 4 輪：原本太稀，一顆顆浮在空中 → 數量加倍、每顆大一點、互相重疊（底下另外補一片基底）
    const rx = 13 + hash(k, seed) * 18, ry = 8 + hash(k, seed + 1) * 9, cx = (k + hash(k, seed + 2) * 0.9) * w / n;
    const cy = yTop + ry * 0.5 + hash(k, seed + 3) * (H - yTop) * 0.5 + Math.sin((cx / w) * Math.PI * 4 + seed) * 7;
    list.push({ k, cx, cy, rx, ry });
  }
  return list.sort((a, b) => a.cy - b.cy);   // 上面（遠）的先畫
}
/** 畫一顆：fill(i, x, y, u, v)＝這一格的顏色（u、v＝-1～1 的位置，可以用來打光）；邊緣一圈暗色 */
function blob(put, b, edge, fill, w, pw = 2) {
  // pw＝形狀的次方（2＝橢圓、4＝方一點的圓角方塊）；第 5 輪：垃圾團全是橢圓像麵包 → 木箱、鐵板用 4
  for (let y = Math.floor(b.cy - b.ry - 1); y <= Math.ceil(b.cy + b.ry + 1); y++) for (let x = Math.floor(b.cx - b.rx - 1); x <= Math.ceil(b.cx + b.rx + 1); x++) {
    const u = (x - b.cx) / b.rx, v = (y - b.cy) / b.ry, d = Math.abs(u) ** pw + Math.abs(v) ** pw;
    if (d > 1.12) continue;
    put(x, y, d > 0.86 ? edge : fill(b, x, y, u, v));
  }
  void w;
}
function junkNear(put, w) {
  // 第 3 輪：沿地面堆一團團垃圾；第 4 輪：一團只用一種材質（鏽鐵板／鐵皮／木箱／輪胎），各自打光＋一個細節（鉚釘、X、輪胎洞），不再填磚紋；底下補一片暗色基底
  const top = new Array(w).fill(H);
  for (let x = 0; x < w; x++) for (let y = 204; y < H; y++) put(x, y, y === 204 ? PAINT[1] : PAINT[0]);
  for (const b of heap(w, 120, 58, 172)) {
    const kind = hash(b.k, 121), M = kind < 0.3 ? RUST : kind < 0.55 ? IRON : kind < 0.82 ? WOOD : null;
    blob(put, b, "#120c1a", (bb, x, y, u, v) => {
      const lit = -u * 0.5 - v * 0.9;
      if (!M) { const d = Math.hypot(u, v); return d < 0.35 ? "#120c1a" : d < 0.5 ? IRON[1] : lit > 0.3 ? PAINT[3] : lit > -0.3 ? PAINT[2] : PAINT[1]; }   // 輪胎
      if (M === WOOD && (Math.abs(u - v) < 0.09 || Math.abs(u + v) < 0.09)) return WOOD[1];   // 木箱的 X
      if (M !== WOOD && Math.abs(u) > 0.55 && Math.abs(u) < 0.66 && Math.abs(v) < 0.12) return M[3];   // 鉚釘
      return lit > 0.5 ? M[3] : lit > -0.1 ? M[2] : M[1];
    }, w, M === WOOD || M === RUST ? 4 : M === IRON ? 3 : 2);
    for (let x = Math.floor(b.cx - b.rx); x <= b.cx + b.rx; x++) { const xx = ((x % w) + w) % w, u = (x - b.cx) / b.rx; top[xx] = Math.min(top[xx], Math.round(b.cy - b.ry * Math.sqrt(Math.max(0, 1 - u * u)))); }
  }
  for (let k = 0; k < 9; k++) {   // 堆頂上翹出來的水管、木板
    const cx = Math.round((k + hash(k, 23) * 0.7) * w / 9), b = top[cx], len = 8 + Math.round(hash(k, 24) * 10), dir = hash(k, 25) < 0.5 ? -1 : 1, M = hash(k, 26) < 0.5 ? IRON : WOOD;
    if (b >= H) continue;
    for (let t = 0; t < len; t++) { const x = cx + dir * Math.round(t * 0.5), y = b - t + 2; put(x, y, M[3]); put(x + 1, y, M[1]); }
  }
  // 洞頂倒掛的垃圾團（倒過來的小丘）
  for (let k = 0; k < 8; k++) {
    const cx = Math.round((k + hash(k, 36) * 0.6) * w / 8), hw = 10 + Math.round(hash(k, 37) * 16), len = 14 + Math.round(hash(k, 38) * 22);
    for (let i = -hw; i <= hw; i++) { const u = i / hw, bot = Math.round(len * (1 - u * u) ** 0.7 * (0.8 + 0.2 * hash(cx + i, 39))); for (let y = 0; y < bot; y++) put(cx + i, y, junkColor(cx + i, H - 1 - y, w, 77, bot - y)); }
  }
  // 電線（兩點之間垂一個弧）
  for (let k = 0; k < 5; k++) {
    const x0 = Math.round((k + hash(k, 27) * 0.5) * w / 5), span = 70 + Math.round(hash(k, 28) * 80), sag = 14 + hash(k, 29) * 18;
    for (let i = 0; i <= span; i++) { const u = i / span; put(x0 + i, 6 + Math.round(sag * 4 * u * (1 - u)), IRON[2]); }
  }
}

// ---------- 洞窟：中景（水晶簇與石柱） ----------
const ROCK = ["#0a0e1c", "#121c30", "#1a2a44", "#24405a", "#3a5e7a"], CRY = ["#24124a", "#3a2468", "#5a3c94", "#7a5cb8", "#b8a0e8"], TEAL = ["#0e2430", "#1a4448", "#1e6a60", "#2e8a78", "#5ac0a0"];
function crystal(put, cx, by, hgt, wid, lean, R) {
  // 一根水晶：尖頂、左面亮、右面暗、中間一條亮線
  for (let j = 0; j < hgt; j++) {
    const u = j / hgt, hw = u < 0.25 ? Math.round(wid * (u / 0.25)) : wid, x0 = cx + Math.round(lean * (hgt - j) / hgt);
    for (let i = -hw; i <= hw; i++) put(x0 + i, by - hgt + j, i === -hw || i === hw ? R[0] : i < 0 ? R[3] : i === 0 ? R[4] : R[2]);
  }
}
function caveMid(put, w) {
  // 底下的岩床
  const top = new Array(w);
  for (let x = 0; x < w; x++) top[x] = Math.round(192 - 12 * wave(x, w, 41, 90) - 5 * wave(x, w, 42, 22));
  for (let x = 0; x < w; x++) for (let y = top[x]; y < H; y++) put(x, y, y - top[x] < 1 ? ROCK[3] : (y + (x >> 3)) % 9 === 0 ? ROCK[1] : ROCK[2]);
  // 石柱（有的接到洞頂）
  for (let k = 0; k < 4; k++) {
    const cx = Math.round((k + 0.3 + hash(k, 43) * 0.4) * w / 4), hw = 7 + Math.round(hash(k, 44) * 6), full = hash(k, 45) < 0.5, hgt = full ? H : 60 + Math.round(hash(k, 46) * 50);
    for (let y = H - hgt; y < top[cx] + 2; y++) {
      const neck = full ? Math.round(3 * Math.sin((y / H) * Math.PI * 2 + k)) : 0, ww = hw + neck - (y < H - hgt + 6 ? 6 - (y - (H - hgt)) : 0);
      for (let i = -ww; i <= ww; i++) put(cx + i, y, i === -ww ? ROCK[3] : i >= ww - 1 ? ROCK[0] : i < -ww / 3 ? ROCK[2] : ROCK[1]);
    }
  }
  // 水晶簇：每簇 3～5 根，大小不一、往外斜
  // 第 2 輪：水晶簇太小看不出來 → 每簇 3～6 根、高 20～56、寬 3，紫色青色混著
  const CYAN = ["#0c3a4a", "#1a7aa8", "#28aed0", "#4cd8ec", "#a0f2fa"];
  for (let k = 0; k < 6; k++) {
    const cx = Math.round((k + 0.2 + hash(k, 47) * 0.6) * w / 6), by = top[cx] + 3, n = 3 + Math.floor(hash(k, 48) * 4), big = 0.75 + hash(k, 49) * 0.5, R = hash(k, 51) < 0.35 ? CYAN : CRY;
    const order = [...Array(n).keys()].sort((a, b) => Math.abs(b - (n - 1) / 2) - Math.abs(a - (n - 1) / 2));   // 外側的先畫，中間的最高、蓋在前面
    for (const j of order) { const off = (j - (n - 1) / 2) * 7, hgt = Math.round((26 + hash(k, j, 50) * 30) * big * (1 - Math.abs(off) / 34)); crystal(put, cx + off, by, hgt, 3, off * 0.7, R); }
  }
}

// ---------- 洞窟：近景（青綠苔蘚濕岩＋鐘乳石水滴） ----------
function caveNear(put, w) {
  // 第 3 輪：沿地面堆一顆顆圓石（左上亮、右下暗、朝上的面長青綠苔蘚）
  const top = new Array(w).fill(H);
  for (let x = 0; x < w; x++) for (let y = 204; y < H; y++) put(x, y, y === 204 ? ROCK[2] : ROCK[1]);   // 第 4 輪：底下補基底
  for (const b of heap(w, 140, 62, 174)) {
    blob(put, b, ROCK[0], (bb, x, y, u, v) => {
      const lit = -u * 0.5 - v * 0.9;
      if (v < -0.55 && hash(x, bb.k, 141) < 0.85) return v < -0.75 ? TEAL[4] : TEAL[3];   // 苔蘚帽
      if (v < -0.4 && hash(x, 142) < 0.4) return TEAL[2];   // 苔蘚往下垂
      return lit > 0.45 ? ROCK[4] : lit > 0 ? ROCK[3] : lit > -0.5 ? ROCK[2] : ROCK[1];
    }, w);
    for (let x = Math.floor(b.cx - b.rx); x <= b.cx + b.rx; x++) { const xx = ((x % w) + w) % w, u = (x - b.cx) / b.rx; top[xx] = Math.min(top[xx], Math.round(b.cy - b.ry * Math.sqrt(Math.max(0, 1 - u * u)))); }
  }
  // 堆上的小水晶（會被當成光源）
  for (let k = 0; k < 6; k++) { const cx = Math.round((k + 0.4 + hash(k, 65) * 0.5) * w / 6); if (top[cx] >= H) continue; crystal(put, cx, top[cx] + 1, 7 + Math.round(hash(k, 66) * 5), 1, 0, ["#0c3a4a", "#1a7aa8", "#28aed0", "#4cd8ec", "#a0f2fa"]); }
  // 洞頂的鐘乳石（尖朝下，左亮右暗）＋水滴
  let x = 0, k = 0;
  while (x < w) {
    const ww = 4 + Math.floor(hash(k, 67) * 6), len = 8 + Math.floor(hash(k, 68) * 30);
    for (let j = 0; j < len; j++) { const hw = Math.max(0, Math.round(ww * (1 - j / len))); for (let i = -hw; i <= hw; i++) put(x + ww + i, j, i === -hw ? ROCK[3] : i >= hw ? ROCK[0] : i < 0 ? ROCK[2] : ROCK[1]); }
    if (hash(k, 69) < 0.35) { put(x + ww, len + 3, TEAL[4]); put(x + ww, len + 4, "#a0f2fa"); }
    x += ww * 2 + 2 + Math.floor(hash(k, 70) * 10); k++;
  }
  for (let xx = 0; xx < w; xx++) for (let y = 0; y < 3; y++) put(xx, y, ROCK[y === 2 ? 2 : 1]);   // 洞頂的一條邊
}
