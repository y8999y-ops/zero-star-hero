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

// 9 批：theme＝abyss（岩柱）／junk（堆到天上的垃圾山＋垂下來的鐵鍊、水管）／cave（岩柱帶紫水晶＋大鐘乳石）。
// 最下面那層厚岩三個主題都一樣（接原本的 valley/far 洞頂）。
export function genUpper(kind, w, h, theme = "abyss") {
  const px = new Array(w * h).fill(null);
  const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < w && y < h) px[y * w + x] = c; };
  if (kind === "far") {
    // 第 3 輪：洞窟的岩柱改偏青（原本跟深淵一模一樣）；最下面那層厚岩照舊（要接原本的遠景）
    const C = ["#141432", "#1e2048", "#2a2e5e", "#4c5590"], PC = theme === "cave" ? ["#0a1220", "#122436", "#1e3a50", "#3a6a80"] : C;
    // 第 2 輪：原本遠景最上面就是下層洞穴的洞頂（實心 #1e2048＋鐘乳石），所以這張的最下面要是一層厚岩接住它；
    // 厚岩上面是上一層洞穴：地面一條被光照亮的邊、往上長的石筍，再上面是岩柱。岩柱改暗（大多 #1e2048）、加橫向岩層紋，水晶點變少、成群。
    const floorY = (x) => h - 46 - Math.round(n1(x, w, 30, 34) * 14 + n1(x, w, 31, 9) * 5);
    for (let x = 0; x < w; x++) {
      const fy = floorY(x);
      for (let y = fy; y < h; y++) set(x, y, y === fy ? C[3] : y === fy + 1 ? C[2] : (y - fy) % 11 === 5 && n1(x, w, 32, 7) > 0.5 ? C[2] : C[1]);
      // 石筍
      const sp = n1(x, w, 33, 5);
      if (sp > 0.72) for (let y = 0; y < (sp - 0.72) * 60; y++) set(x, fy - 1 - y, y < 2 ? C[2] : C[1]);
      if (theme === "junk") {   // 垃圾山：一座座往上堆的山，邊緣是方方正正的垃圾剪影（箱子、桶子、鐵板），頂邊被光照到一條鏽色
        const J = ["#140a18", "#24182e", "#342646", "#8a5a46"];
        // 第 2 輪：原本只有一座大山、輪廓太平滑——山多一點（週期短），頂邊每 6 格一段、高低差 4 的方塊階梯（像堆起來的箱子）
        const xs = Math.floor(x / 6) * 6, peak = n1(xs, w, 50, 70) * 0.6 + n1(xs, w, 51, 18) * 0.4;
        let top = Math.round(fy - Math.max(0, peak - 0.25) * fy * 1.1);
        top = Math.floor(top / 4) * 4 + Math.round((hash(x >> 3, 52) - 0.5) * 6);
        top = Math.max(0, Math.min(fy, top));
        for (let y = top; y < fy; y++) set(x, y, y === top ? J[3] : y === top + 1 ? J[2] : hash(x >> 2, y >> 2, 53) < 0.08 ? J[2] : (x >> 3) % 3 === 0 && (y >> 2) % 5 === 0 ? J[0] : J[1]);
        continue;
      }
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
        let c = lit ? PC[3] : dark ? PC[0] : crack ? PC[0] : PC[1];
        if (lit && hash(x, y >> 1, 36) < 0.3) c = PC[2];
        set(x, y, c);
      }
    }
    // 水晶：幾群，每群 3～5 顆（洞窟多一倍、紫色；垃圾山沒有）
    // 第 2 輪：洞窟的紫水晶改成一根根 2×4 的晶柱（原本是單點，看不到），長在岩柱上
    if (theme === "cave") for (let n = 0; n < 70; n++) {   // 第 3 輪：多一點、大一點（3 格寬、5～9 格長）
      const x0 = Math.floor(hash(n, 70) * w), y0 = Math.floor(h * 0.1 + hash(n, 71) * h * 0.7);
      if (!px[y0 * w + x0]) continue;
      const len = 5 + Math.floor(hash(n, 72) * 5), lean = hash(n, 73) < 0.5 ? -1 : 1;
      for (let k = 0; k < len; k++) { const xx = x0 + Math.round(lean * k * 0.4), tip = k >= len - 2; set(xx - 1, y0 - k, tip ? "#9a80d0" : "#3a2468"); set(xx, y0 - k, k === len - 1 ? "#e4ffff" : "#9a80d0"); if (!tip) set(xx + 1, y0 - k, "#5a3c94"); }
    }
    if (theme !== "junk") for (let n = 0; n < (theme === "cave" ? 14 : 6); n++) {
      const gx = Math.floor(hash(n, 40) * w), gy = Math.floor(h * 0.2 + hash(n, 41) * h * 0.55), [c0, c1] = theme === "cave" ? ["#7a5cb8", "#e4ffff"] : ["#46b4c8", "#a0eef4"];
      for (let k = 0; k < 4; k++) { const x = gx + Math.round((hash(n, k, 42) - 0.5) * 10), y = gy + Math.round((hash(n, k, 43) - 0.5) * 8); if (px[y * w + x]) set(x, y, k ? c0 : c1); }
    }
  } else if (theme === "junk") {
    // 垃圾山的中景：從上面垂下來的鐵鍊（一格亮一格暗、末端一個鉤子）、彎來彎去的水管
    const C = ["#120a22", "#1a1030", "#2a1a48", "#8a5a46"];   // 第 3 輪：鏽色反光亮一點（原本太暗看不到）
    for (let n = 0; n < Math.round(w / 40); n++) {
      const x = Math.floor(hash(n, 60) * w), len = Math.round(h * (0.2 + hash(n, 61) * 0.5));
      if (hash(n, 62) < 0.6) {   // 鐵鍊
        for (let y = 0; y < len; y++) { const ring = y % 4; set(x, y, ring === 3 ? C[0] : C[2]); set(x + 1, y, ring === 1 || ring === 2 ? C[2] : C[1]); }   // 第 2 輪：2 格寬的鏈環
        for (const [dx, dy] of [[0, 0], [1, 1], [1, 2], [0, 3], [-1, 2]]) set(x + dx, len + dy, C[3]);
      } else {                   // 水管：往下、轉彎往旁邊、再往下
        const t = 5, turn = Math.round(len * 0.6), dir = hash(n, 63) < 0.5 ? -1 : 1, run = 10 + Math.round(hash(n, 64) * 20);
        const pc = (k) => (k === 1 ? C[3] : k === 0 || k === t - 1 ? C[0] : C[1]);   // 兩邊暗、左邊一條鏽色反光
        for (let y = 0; y < turn; y++) for (let k = 0; k < t; k++) set(x + k, y, y % 24 === 20 ? C[2] : pc(k));
        for (let i = 0; i < run; i++) for (let k = 0; k < t; k++) set(x + dir * i, turn + k, pc(k));
        for (let y = turn; y < len; y++) for (let k = 0; k < t; k++) set(x + dir * run + k, y, pc(k));
      }
    }
  } else {
    const C = theme === "cave" ? ["#0a0c1a", "#121a2c", "#24405a"] : ["#120a22", "#1a1030", "#2a1a48"];
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
