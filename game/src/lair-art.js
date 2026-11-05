// 1-4 大胃王的巢穴的痕跡（特效補強 5，照 pixelfx skill 畫 → 看 → 修，草稿：game/tools/drafts/map11.mjs 1-4）
//   地形借垃圾山的，再疊一層「這是牠的窩」：
//   黏液：天花板、岩架底面垂下黏液滴；地面頂層一塊塊綠色黏液漬
//   抓痕：王房（arena）的牆面上，三道平行的斜抓痕
//   啃痕：地面邊緣偶爾缺一小口（露出底下的暗色）
// paintLair(solid(x, y), w, h, put(x, y, "#hex"), arena)：solid＝這一格是不是實心；在 paintTerrain 之後呼叫
const hash = (a, b = 0, c = 0) => { let h = (a * 374761393 + b * 668265263 + c * 2246822519) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const GOO = ["#0c2010", "#1a4a20", "#2a8a3a", "#4cc04a", "#8ee86a", "#d4ffb0"];
const SCAR = ["#140a18", "#24182e", "#8a7ab4"];

export function paintLair(solid, w, h, put, arena) {
  const air = (x, y) => !solid(x, y);
  // ---- 地面頂層的黏液漬：沿著每一段地表，隨機挑幾段 6～20 寬，頂上兩列換成黏液
  for (let y = 1; y < h; y++) {
    let x = 0;
    while (x < w) {
      if (!(solid(x, y) && air(x, y - 1))) { x++; continue; }
      let x1 = x; while (x1 < w && solid(x1, y) && air(x1, y - 1)) x1++;   // 一段地表 [x, x1)
      for (let s = x; s < x1; s += 40) {
        // 第 2 輪：原本太淡（細細一條綠線）→ 更常出現、長 10～30、厚 2～3 列、王房地面整片斷斷續續鋪滿
        const inArena = arena && y === arena.floor && s > arena.l && s < arena.r;
        if (!inArena && hash(s >> 3, y >> 3, 1) > 0.7) continue;
        const len = (inArena ? 24 : 10) + Math.floor(hash(s, y, 2) * 20), s0 = s + Math.floor(hash(s, y, 3) * 14);
        for (let i = s0; i < Math.min(x1, s0 + len); i++) {
          const e = Math.min(i - s0, s0 + len - 1 - i);   // 兩端薄、中間厚
          // 第 3 輪：原本看起來像一排草 → 做成「濕的」一攤：中間鼓起、頂面亮綠＋白綠反光點、底下往地裡滲暗綠
          const dome = e >= 5 ? 2 : e >= 2 ? 1 : 0;
          put(i, y, dome ? GOO[2] : GOO[1]);
          for (let d = 1; d <= dome; d++) put(i, y - d, d === dome ? GOO[4] : GOO[3]);
          if (dome && (i + y) % 6 === 0) put(i, y - dome, GOO[5]);   // 反光點
          put(i, y + 1, GOO[1]); if (e >= 3) put(i, y + 2, GOO[0]);
          if (e >= 3 && hash(i, y, 11) < 0.06) { put(i, y - 3, GOO[5]); put(i + 1, y - 3, GOO[4]); put(i, y - 4, GOO[4]); }   // 泡泡
        }
      }
      x = x1;
    }
  }
  // ---- 天花板、岩架底面垂下黏液滴（2～9 長，尖端一顆亮點）
  for (let y = 1; y < h - 1; y++) for (let x = 0; x < w; x++) {
    if (!(solid(x, y) && air(x, y + 1)) || hash(x, y, 5) > 0.11) continue;
    const len = 3 + Math.floor(hash(x, y, 6) * 12);   // 第 2 輪：更常出現、更長、2 格寬
    let k = 0;
    for (; k < len && air(x, y + 1 + k); k++) { put(x, y + 1 + k, k === len - 1 ? GOO[5] : k < 2 ? GOO[2] : GOO[3]); if (k < len - 2 && air(x + 1, y + 1 + k)) put(x + 1, y + 1 + k, GOO[2]); }
  }
  // ---- 啃痕：地面邊緣偶爾缺一小口（半圓形的缺口）
  for (let y = 1; y < h; y++) for (let x = 0; x < w; x++) {
    if (!(solid(x, y) && air(x, y - 1)) || hash(x, y, 8) > 0.012) continue;
    for (let dy = 0; dy < 3; dy++) for (let dx = -3; dx <= 3; dx++) if (dx * dx + dy * dy * 3 <= 9 && solid(x + dx, y + dy)) put(x + dx, y + dy, dy === 2 || Math.abs(dx) === 3 ? SCAR[1] : SCAR[0]);
  }
  // ---- 王房牆上的抓痕：牆面（實心、旁邊是空氣）每隔一段刻三道平行的斜線
  if (arena) for (let y = arena.floor - 140; y < arena.floor - 20; y += 34) for (const side of [1, -1]) {
    const wx = side > 0 ? arena.l : arena.r;   // 左牆的面朝右、右牆的面朝左
    if (hash(y, side, 9) < 0.25) continue;
    for (let k = 0; k < 3; k++) for (let s = 0; s < 14; s++) {
      const x = wx - side * (2 + s * 0.5 + k * 3), yy = y + s + k;
      if (!solid(Math.round(x), yy)) continue;
      put(Math.round(x), yy, s === 0 || s === 13 ? SCAR[1] : SCAR[0]);
      if (s > 1 && s < 12) put(Math.round(x) - side, yy, SCAR[2]);   // 抓痕下緣反光
    }
  }
  // ---- 第 2 輪：地上散落被啃過的鐵罐（缺一角、齒痕）——王房裡多一點、其他地方少一點
  const CAN = ["#24182e", "#5c5868", "#9aa6ba", "#c4bca2"];
  for (let y = 1; y < h; y++) for (let x = 2; x < w - 8; x++) {
    if (!(solid(x, y) && air(x, y - 1) && solid(x + 8, y) && air(x + 8, y - 1))) continue;
    const inArena = arena && x > arena.l && x < arena.r;
    if (hash(x, y, 12) > (inArena ? 0.02 : 0.004)) continue;
    // 第 3 輪：放大到 9×7、罐身一條亮的反光帶、右上角咬掉一口（齒痕鋸齒）
    for (let j = 0; j < 7; j++) for (let i = 0; i < 9; i++) {
      const bite = i >= 5 && j <= (i - 5) + 1 - ((i + j) % 2);
      if (bite) continue;
      const edge = i === 0 || j === 6 || i === 8 || j === 0;
      put(x + i, y - 7 + j, edge ? CAN[0] : j === 1 || j === 5 ? CAN[1] : i === 2 ? CAN[3] : i < 4 ? CAN[2] : CAN[1]);
    }
  }
}
