// 視窗開啟轉場用的門板（第 7 批，照 pixelfx skill 畫→看→修）：整片門一次畫出來（不是重複貼的磚，第 1 輪貼磚太像壁紙），放大 2 倍。
//   iron：工坊的鐵門（左右兩扇對開）——橫向鐵板、接縫一條暗線＋亮線、鉚釘只沿著接縫和門邊排、燒紅的門閂。
//   wood：旅館的木門（一扇往旁邊推開）——直向木板寬窄不一、板縫深、斷續木紋、上下兩條橫木＋一條斜撐、鐵門把。
// 參考：frame-art.js 的鍛造／旅館配色（門跟視窗外框是同一套顏色）。
// doorArt(kind, w, h, side)：side＝"L"/"R"（鐵門哪一扇，門閂畫在中間那側）。回傳 { w, h, px }，px 是 "#rrggbb"。
// 草稿：game/tools/drafts/doors.mjs
const IRON = { base: "#5a5e74", hi: "#9aa0b4", lo: "#3a3c4e", dk: "#1e1e2a", rv: "#d8dce8", rvd: "#26263a", hot: "#ff8a3a", hot2: "#ffd070" };
const WOOD = { base: "#9a6434", b2: "#8a5a2c", hi: "#c89058", lo: "#6a4020", dk: "#2e1808", knot: "#4a2a10", iron: "#3a3c4e", ironHi: "#9aa0b4" };
const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

export function doorArt(kind, w, h, side = "L") {
  const px = new Array(w * h).fill(null);
  const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < w && y < h) px[y * w + x] = c; };
  const rivet = (x, y, C) => { set(x, y, C.rv); set(x + 1, y, C.hi); set(x, y + 1, C.hi); set(x + 1, y + 1, C.rvd); set(x + 2, y + 1, C.dk); set(x + 1, y + 2, C.dk); };
  if (kind === "iron") {
    const C = IRON, PL = 18;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const r = y % PL, edge = x < 2 || x >= w - 2 || y < 2 || y >= h - 2;
      let c = r === 0 ? C.dk : r === 1 ? C.hi : r === PL - 1 ? C.lo : C.base;
      if (!edge && r > 2 && r < PL - 2 && hash(x >> 3, y >> 2) < 0.025) c = C.lo;   // 第 2 輪：髒污改成 4×2 的小塊，不是一顆顆雜點
      if (edge) c = x === 0 || y === 0 || x === w - 1 || y === h - 1 ? C.dk : x === 1 || y === 1 ? C.hi : C.lo;
      set(x, y, c);
    }
    for (let y = PL; y < h - 4; y += PL) for (let x = 6; x < w - 6; x += 14) rivet(x, y + 3, C);   // 鉚釘沿接縫
    for (let y = 8; y < h - 6; y += 22) { rivet(4, y, C); rivet(w - 7, y, C); }                   // 門邊
    // 門閂：靠中間那側一條燒紅的橫桿
    const by = (h / 2) | 0, bx0 = side === "L" ? w - 22 : 0, bx1 = side === "L" ? w : 22;
    for (let x = bx0; x < bx1; x++) { set(x, by - 3, C.dk); set(x, by - 2, C.hot2); set(x, by - 1, C.hot); set(x, by, C.hot); set(x, by + 1, "#a83a14"); set(x, by + 2, C.dk); }
    // 第 3 輪：門閂穿過的鐵扣（深色方框＋上緣亮線），門閂看起來是插在門上的
    const kx = side === "L" ? w - 16 : 8;
    for (let y = by - 6; y <= by + 5; y++) for (let x = kx; x < kx + 8; x++) {
      if (y >= by - 3 && y <= by + 2 && x > kx && x < kx + 7) continue;
      set(x, y, x === kx || x === kx + 7 || y === by + 5 ? C.dk : y === by - 6 ? C.hi : C.lo);
    }
  } else {
    const C = WOOD;
    // 木板寬 9～13 格不等
    const seams = [0];
    for (let x = 0; x < w; ) { x += 9 + Math.floor(hash(x, 7) * 5); seams.push(x); }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = seams.findIndex((s) => s > x) - 1, s0 = seams[i], s1 = seams[i + 1], u = x - s0;
      let c = u === 0 ? C.dk : u === 1 ? C.hi : x === s1 - 1 ? C.lo : i % 2 ? C.b2 : C.base;
      // 木紋：每片板 2 條，長度隨機的斷續深線
      if (u > 2 && x < s1 - 2 && (u === 3 + (i % 3) || u === s1 - s0 - 3) && hash(x, y >> 3) < 0.55) c = C.lo;
      set(x, y, c);
    }
    // 上下兩條橫木＋斜撐（Z 字）
    const bar = (y0) => { for (let y = y0; y < y0 + 8; y++) for (let x = 2; x < w - 2; x++) set(x, y, y === y0 ? C.hi : y === y0 + 7 ? C.dk : y === y0 + 6 ? C.lo : C.base); };
    const t = 12, b = h - 20;
    bar(t); bar(b);
    for (let k = 0; ; k++) {
      const x = 4 + k, y = b - 1 - Math.round((k * (b - t - 8)) / (w - 8));
      if (x >= w - 4) break;
      for (let d = 0; d < 9; d++) set(x, y - d, d === 0 ? C.dk : d === 1 ? C.lo : d === 8 ? C.hi : C.base);   // 第 3 輪：斜撐加粗
    }
    // 鐵釘（橫木兩端）、木節
    for (const y of [t + 3, b + 3]) for (const x of [5, w - 8]) { set(x, y, C.ironHi); set(x + 1, y, C.iron); set(x, y + 1, C.iron); set(x + 1, y + 1, C.dk); }
    for (const [kx, ky] of [[Math.round(w * 0.3), Math.round(h * 0.35)], [Math.round(w * 0.7), Math.round(h * 0.68)]]) {
      set(kx, ky, C.knot); set(kx + 1, ky, C.knot); set(kx, ky + 1, C.dk); set(kx + 1, ky + 1, C.knot); set(kx - 1, ky, C.lo); set(kx + 2, ky + 1, C.lo);
    }
    // 門把（右邊中間）：鐵環
    const hx = w - 14, hy = (h / 2) | 0;
    // 第 3 輪：門把放大成 7×7 的鐵環＋釘座
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const d = Math.hypot(dx, dy);
      if (d > 2.6 && d < 4.4) set(hx + dx, hy + dy, d > 3.6 ? C.dk : dx + dy < 0 ? C.ironHi : C.iron);
    }
    for (const [dx, dy, c] of [[-1, -1, C.ironHi], [0, -1, C.ironHi], [-1, 0, C.iron], [0, 0, C.dk]]) set(hx + dx, hy + dy, c);
    // 門邊框
    for (let x = 0; x < w; x++) { set(x, 0, C.dk); set(x, h - 1, C.dk); }
    for (let y = 0; y < h; y++) { set(0, y, C.dk); set(w - 1, y, C.dk); }
  }
  return { w, h, px };
}
