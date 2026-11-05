// 高地圖的上層背景（8c，深淵，照 pixelfx skill 畫→看→修）：地圖往上延伸時，原本只有一個畫面高的遠景、中景接到這兩張上面。
//   far：遠方的崖壁——兩側往上長的大岩柱，邊緣被上面的光照亮一條（#4c5590），裡面零星的青色水晶點
//   mid：近一點的垂掛岩塊和斷掉的岩橋剪影（紫黑），往下垂的尖
// 顏色取自 valley/far（#1e2048、#2a2e5e、#4c5590）和 valley/mid（#1a1030、#2a1a48），所以接縫看不出來。
// 參考：Ori 的多層剪影（越遠越亮越藍、越近越暗）、SLYNYRD 視差教學（遠景低對比、近景高對比）。
// genUpper(kind, w, h) → { w, h, px }，px 是 "#rrggbb" 或 null（透明）。最下面一列要接原本圖層的最上面。草稿：game/tools/drafts/upper.mjs
const hash = (a, b, c = 0) => { let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
// 平滑的一維雜訊（可左右接：週期 w）
const n1 = (x, period, seed, step) => {
  const i = Math.floor(x / step), f = x / step - i, n = Math.round(period / step);
  const a = hash(((i % n) + n) % n, seed), b = hash((((i + 1) % n) + n) % n, seed), t = f * f * (3 - 2 * f);
  return a + (b - a) * t;
};

export function genUpper(kind, w, h) {
  const px = new Array(w * h).fill(null);
  const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < w && y < h) px[y * w + x] = c; };
  if (kind === "far") {
    const C = ["#141432", "#1e2048", "#2a2e5e", "#4c5590"];
    // 第 2 輪：原本遠景最上面就是下層洞穴的洞頂（實心 #1e2048＋鐘乳石），所以這張的最下面要是一層厚岩接住它；
    // 厚岩上面是上一層洞穴：地面一條被光照亮的邊、往上長的石筍，再上面是岩柱。岩柱改暗（大多 #1e2048）、加橫向岩層紋，水晶點變少、成群。
    const floorY = (x) => h - 46 - Math.round(n1(x, w, 30, 34) * 14 + n1(x, w, 31, 9) * 5);
    for (let x = 0; x < w; x++) {
      const fy = floorY(x);
      for (let y = fy; y < h; y++) set(x, y, y === fy ? C[3] : y === fy + 1 ? C[2] : (y - fy) % 11 === 5 && n1(x, w, 32, 7) > 0.5 ? C[2] : C[1]);
      // 石筍
      const sp = n1(x, w, 33, 5);
      if (sp > 0.72) for (let y = 0; y < (sp - 0.72) * 60; y++) set(x, fy - 1 - y, y < 2 ? C[2] : C[1]);
      // 岩柱
      // 第 3 輪：原本柱子連成一整面牆、橫紋太規律像水面——門檻提高（柱子變細、分開），橫紋改成短短的斷續裂縫
      const B = (xx) => n1(xx, w, 1, 64) * 0.55 + n1(xx, w, 2, 18) * 0.45, TH = 0.6;
      const base = B(x);
      if (base < TH) continue;
      const lit = B(x - 2) < TH, dark = B(x + 2) < TH;
      for (let y = 0; y < fy; y++) {
        const v = base - (1 - y / fy) * 0.08;
        if (v < TH) continue;
        const crack = hash(x >> 3, y, 35) < 0.04 && hash(x, y, 37) < 0.8;
        let c = lit ? C[3] : dark ? C[0] : crack ? C[0] : C[1];
        if (lit && hash(x, y >> 1, 36) < 0.3) c = C[2];
        set(x, y, c);
      }
    }
    // 水晶：幾群，每群 3～5 顆
    for (let n = 0; n < 6; n++) {
      const gx = Math.floor(hash(n, 40) * w), gy = Math.floor(h * 0.2 + hash(n, 41) * h * 0.55);
      for (let k = 0; k < 4; k++) { const x = gx + Math.round((hash(n, k, 42) - 0.5) * 10), y = gy + Math.round((hash(n, k, 43) - 0.5) * 8); if (px[y * w + x]) set(x, y, k ? "#46b4c8" : "#a0eef4"); }
    }
  } else {
    const C = ["#120a22", "#1a1030", "#2a1a48"];
    // 垂掛岩塊：從上面往下垂的尖，每隔一段一個，長短不一
    for (let x = 0; x < w; x++) {
      const k = n1(x, w, 11, 48), len = k > 0.5 ? (k - 0.5) * 2 * h * 0.55 + n1(x, w, 12, 6) * 10 : n1(x, w, 13, 9) * 8;
      for (let y = 0; y < len && y < h; y++) set(x, y, y > len - 3 ? C[2] : x % 9 === 0 && y > 6 ? C[0] : C[1]);
    }
    // 斷掉的岩橋：水平的一條，中間有缺口
    for (const [y0, seed] of [[Math.round(h * 0.55), 21], [Math.round(h * 0.82), 22]]) for (let x = 0; x < w; x++) {
      if (n1(x, w, seed, 60) < 0.42) continue;
      const th = 4 + Math.round(n1(x, w, seed + 1, 12) * 5);
      for (let y = 0; y < th; y++) set(x, y0 + y, y === 0 ? C[2] : C[1]);
      const tip = Math.round(n1(x, w, seed + 2, 5) * 6);
      for (let y = th; y < th + tip; y++) if (n1(x, w, seed + 3, 3) > 0.55) set(x, y0 + y, C[1]);
    }
  }
  return { w, h, px };
}
