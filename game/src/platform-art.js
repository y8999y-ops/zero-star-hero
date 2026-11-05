// 單向平台的主題圖（美術需求 A4）：128×48，跟 art/approved/valley/platform 同規格——
//   左端從第 4 欄開始、右端到第 125 欄；頂面（可以站的那一列）在第 4 列。level.js 把左半＋右半拼成平台的寬度，
//   所以中間任何一欄切開都要接得起來（重複的木板、重複的岩塊）。
//   junk＝垃圾山：木板平台＋底下的鐵架三角托架、垂下來的鐵鍊和破罐子
//   cave＝洞窟：濕苔蘚頂的岩架，底下往下收尖，垂著紫水晶和水滴
// 參考（只學做法）：OpenGameArt Castle tileset（木平台與鐵件）、Glint Games Cute Caves、Joel Sleppy Crystal Cave tileset（岩架與水晶）。
const W = 128, H = 48, L = 5, R = 124, TOP = 4;   // 形狀在 5～124，外框落在第 4、125 欄
const hash = (a, b = 0, c = 0) => { let h = (a * 374761393 + b * 668265263 + c * 2246822519) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const C = (hx) => { const n = parseInt(hx.slice(1), 16); return (0xff000000 | ((n & 255) << 16) | (n & 0xff00) | (n >>> 16)) >>> 0; };

export function genPlatform(theme) {
  const px = new Uint32Array(W * H);
  const put = (x, y, hx) => { if (x >= 0 && y >= 0 && x < W && y < H) px[y * W + x] = C(hx); };
  const get = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? px[y * W + x] : 0);
  if (theme === "junk") junk(put); else cave(put);
  // 外框：透明的鄰格補一圈最暗色
  const ol = theme === "junk" ? "#140a18" : "#0a0c1a", add = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!get(x, y) && (get(x - 1, y) || get(x + 1, y) || get(x, y - 1) || get(x, y + 1)) && !(y < TOP)) add.push([x, y]);
  for (const [x, y] of add) put(x, y, ol);
  void get;
  return { w: W, h: H, px };
}

// 下緣的形狀：中間一段一段往下凸，兩端收尖（切開拼起來也連得上）
function profile(seed, dMin, dMax, tip) {
  const depth = new Array(W).fill(0);
  let x = L, k = 0;
  while (x <= R) {
    const w = 12 + Math.floor(hash(k, seed) * 7), d = dMin + Math.floor(hash(k, seed + 1) * (dMax - dMin + 1));
    for (let i = 0; i < w && x + i <= R; i++) { const u = (i + 0.5) / w; depth[x + i] = Math.round(d * (0.75 + 0.25 * Math.sin(u * Math.PI))); }
    x += w; k++;
  }
  for (let xx = L; xx <= R; xx++) { const e = Math.min(xx - L, R - xx); if (e < tip) depth[xx] = Math.min(depth[xx], 2 + Math.round(e * 0.8)); }
  return depth;
}
// 把岩體／垃圾堆分成一塊一塊（每一層 5～6 列，每塊 7～13 寬，錯開排）；回傳 (x, y) 屬於哪一塊、在塊裡的位置
function blocks(x, y, seed) {
  // 每一層高 5～7（不一樣高，才不會像砌磚），每塊 6～15 寬、錯開；塊的四個角挖掉（圓角）
  let by = 0, band = 0, h = 6;
  while (true) { h = 5 + Math.floor(hash(band, seed + 5) * 3); if (y < by + h) break; by += h; band++; }
  const off = Math.floor(hash(band, seed) * 11);
  let bx = -off, k = 0;
  while (true) {
    const w = 6 + Math.floor(hash(band, k, seed + 1) * 10);
    if (x < bx + w) {
      const i = x - bx, j = y - by, corner = (i === 0 || i === w - 2) && (j === 0 || j === h - 2);
      return { id: band * 97 + k, i, w, j, h, gap: i === w - 1 || j === h - 1 || corner };
    }
    bx += w; k++;
  }
}

// ---- 垃圾山：各種木板拼成的頂面，底下是壓扁的垃圾（鐵板、木箱、輪胎），兩端收尖；樑下掛一條鐵鍊和罐子
function junk(put) {
  const WOOD = ["#4a2830", "#7a4434", "#a06446", "#c08454", "#e4b072"], IRON = ["#24182e", "#5c5868", "#7c7884", "#9a968c", "#c4bca2"], RUST = ["#5a2a20", "#8a3e24", "#b05a2a", "#d27c3c"];
  const PAINT = ["#24182e", "#342646", "#463c5e", "#5a5274", "#8a7ab4"];   // 掉漆的紫灰板子
  // 頂面：木板／鐵板／掉漆板，每塊 9～15 寬；頂邊亮、底邊暗，板縫最暗；有幾塊翹起來
  let x = L, k = 0;
  while (x <= R) {
    const w = 9 + Math.floor(hash(k, 1) * 7), kind = hash(k, 3), M = kind < 0.6 ? WOOD : kind < 0.8 ? IRON : PAINT, dy = hash(k, 2) < 0.25 ? 1 : 0;
    for (let i = 0; i < w && x + i <= R; i++) {
      const xx = x + i, seam = i === w - 1;
      for (let y = TOP + dy; y <= TOP + 4; y++) {
        const r = y - TOP;
        let c = seam ? M[0] : r === dy ? M[4] : r === 4 ? M[1] : M === WOOD && r === 2 && hash(xx, 4) < 0.25 ? M[2] : M[3];
        put(xx, y, c);
      }
      if (M !== WOOD && (i === 1 || i === w - 3)) put(xx, TOP + 2 + dy, M[4]);   // 鉚釘
      else if (M === WOOD && (i === 2 || i === w - 3)) put(xx, TOP + 2, IRON[2]);   // 釘子
    }
    x += w; k++;
  }
  // 底下的垃圾堆
  const depth = profile(20, 11, 17, 16);
  for (let xx = L; xx <= R; xx++) for (let y = TOP + 5; y <= TOP + 5 + depth[xx]; y++) {
    const b = blocks(xx, y, 30), kind = hash(b.id, 31), fromBot = TOP + 5 + depth[xx] - y;
    if (b.gap) { put(xx, y, "#140a18"); continue; }   // 塊和塊之間的縫（圓角）
    let c;
    if (kind < 0.3) c = b.j === 0 ? RUST[3] : b.i === b.w - 2 || b.j === b.h - 2 ? RUST[0] : RUST[hash(xx, y, 32) < 0.15 ? 2 : 1];        // 生鏽鐵板
    else if (kind < 0.5) c = b.j === 0 ? IRON[4] : b.i === b.w - 2 || b.j === b.h - 2 ? IRON[1] : IRON[2];                                // 鐵皮
    else if (kind < 0.75) c = (b.i === b.j || b.i === b.w - 2 - b.j) ? WOOD[1] : b.j === 0 ? WOOD[3] : b.j === b.h - 2 ? WOOD[0] : WOOD[2];   // 木箱（X 型木條）
    else { const cx = b.i - (b.w - 2) / 2, cy = b.j - 2.5, d = Math.hypot(cx * 1.2, cy); c = d < 1.2 ? "#140a18" : d < 2.2 ? IRON[1] : cx + cy < -1 ? PAINT[2] : PAINT[1]; }   // 輪胎
    if (fromBot <= 1) c = fromBot ? PAINT[2] : PAINT[1];   // 最底下兩列暗（背光，也不會有零星的亮點）
    put(xx, y, c);
  }
  // 鐵鍊＋罐子：只放在左半中段（拼寬平台時才看得到，不會左右重複兩個）
  for (const [cx, len] of [[L + 40, 7]]) {
    const y0 = TOP + 6 + depth[cx];
    for (let y = 0; y < len; y++) put(cx, y0 + y, y % 2 ? IRON[1] : IRON[3]);
    const by = y0 + len;
    for (let y = 0; y < 5; y++) for (let i = -2; i <= 2; i++) put(cx + i, by + y, i === -2 ? RUST[3] : i === 2 ? RUST[0] : y === 0 ? RUST[3] : RUST[i < 0 ? 2 : 1]);
  }
}

// ---- 洞窟：濕苔蘚頂的岩架，岩塊有亮的上緣；底下垂著一叢一叢的紫水晶、水滴
function cave(put) {
  const TOPC = ["#0e2430", "#1a4448", "#1e6a60", "#2e8a78", "#5ac0a0"], ST = ["#0a0c1a", "#121a2c", "#1a2a40", "#24405a", "#3a5e7a", "#5a86a0"], CRY = ["#2a1640", "#3a2468", "#7a5cb8", "#9a80d0", "#e4ffff"];
  const depth = profile(9, 10, 16, 14);
  for (let xx = L; xx <= R; xx++) {
    const d = depth[xx];
    for (let y = TOP; y <= TOP + 3 + d; y++) {
      const r = y - TOP, fromBot = TOP + 3 + d - y;
      let c;
      if (r === 0) c = TOPC[hash(xx, 11) < 0.3 ? 3 : 4];
      else if (r === 1) c = TOPC[3];
      else if (r === 2) c = TOPC[hash(xx, 12) < 0.6 ? 2 : 1];
      else {
        const b = blocks(xx, y, 40);
        c = b.gap ? ST[1] : b.j === 0 ? ST[5] : b.j === 1 && b.i < b.w - 3 ? ST[4] : b.i >= b.w - 3 || b.j >= b.h - 2 ? ST[2] : ST[3];
        if (fromBot === 0) c = ST[1];
      }
      put(xx, y, c);
    }
    if (hash(xx, 15) < 0.2) { const len = 1 + Math.floor(hash(xx, 16) * 3); for (let j = 0; j < len; j++) put(xx, TOP + 3 + j, TOPC[j === len - 1 ? 1 : 2]); }   // 苔蘚垂下來
  }
  // 紫水晶叢（2～3 根，尖朝下、往外斜；左面亮、右面暗、中間一條最亮）
  const shard = (cx, y0, len, lean) => {
    for (let j = 0; j < len; j++) {
      const hw = j < len - 3 ? 1 : j < len - 1 ? 0.5 : 0, sx = cx + Math.round(lean * j / 3);
      put(sx - 1 * (hw >= 1), y0 + j, CRY[3]); put(sx, y0 + j, j < 2 ? CRY[4] : CRY[2]); if (hw >= 0.5) put(sx + 1, y0 + j, CRY[1]);
    }
  };
  for (const [cx, n] of [[L + 18, 3], [R - 20, 2], [L + 44, 2]]) {
    const y0 = TOP + 2 + depth[cx];
    shard(cx, y0, 9, 0); shard(cx - 3, y0 - 1, 6, -1); if (n > 2) shard(cx + 3, y0 - 1, 5, 1);
  }
  for (const cx of [L + 30, R - 34]) { const y0 = TOP + 4 + depth[cx]; put(cx, y0, "#5ac0a0"); put(cx, y0 + 2, "#a0f2fa"); }   // 水滴
}
