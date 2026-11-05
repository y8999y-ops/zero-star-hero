// 地形（8c 深淵、9 批垃圾山與洞窟，照 pixelfx skill 畫→看→修）：實心方塊照「離空氣多遠」自動畫成地表、牆面、天花板、轉角，不用手排圖塊。
// 色盤取自山谷地面素材（art/approved/valley/ground）：草 #d4ec60～#2a4a10、石頭 #12122a～#7480a4、水晶青。
// 參考：3×3 自動拼接圖塊的邊角做法（Bluematt platform autotiles、GrimeGrass 16×16 的草邊與轉角、RottingPixels 洞窟圖塊），
//       Ori 的「靠近邊緣的地方細節多、深處暗下去」。光從左上來：朝左／朝上的面亮，朝右／朝下的面暗。
// paintTerrain(solid, w, h, put, glow)：solid(x, y) 這一格是不是實心；put(x, y, "#rrggbb") 畫一格；glow(x, y, c) 自己發光的格子（水晶）
// 草稿：game/tools/drafts/terrain.mjs
// 9 批：三個主題（色盤取自 art/approved 的山谷地面、垃圾、水晶、苔蘚素材）
//   top＝地表那層（5 階，暗→亮）、stone＝外框／縫／明暗（6 階）、mats＝石塊的材質（每塊隨機挑一種，6 階）、
//   crys＝水晶（null＝沒有）、blade＝地表上方長的東西、hang＝天花板垂下來的東西
export const TERRAIN = {
  abyss: {
    top: ["#2a4a10", "#4a7a10", "#7cb01a", "#a8d42a", "#d4ec60"], stone: ["#12122a", "#1a1a30", "#2a2e48", "#3c4466", "#545e84", "#7480a4"],
    crys: ["#1a7aa8", "#28aed0", "#4cd8ec", "#a0f2fa"], blade: "grass", hang: "roots", cell: [11, 9],
  },
  // 垃圾山：壓扁的垃圾堆成的地——鏽鐵、灰鐵板、木板、紫灰色的塑膠，石塊小一點；地表是一層鏽土，上面插著釘子、瓶口；天花板垂電線和鐵鍊
  junk: {
    top: ["#4a2830", "#7a4434", "#a06446", "#c08454", "#e4b072"], stone: ["#140a18", "#24182e", "#342646", "#463c5e", "#5a5274", "#8a7ab4"],
    mats: [
      ["#140a18", "#24182e", "#5a2a20", "#8a3e24", "#b05a2a", "#d27c3c"],
      ["#140a18", "#24182e", "#5c5868", "#7c7884", "#9a968c", "#c4bca2"],
      ["#140a18", "#24182e", "#4a2830", "#7a4434", "#a06446", "#c08454"],
      ["#140a18", "#24182e", "#342646", "#463c5e", "#5a5274", "#8a7ab4"],
    ],
    crys: null, blade: "junk", hang: "wires", cell: [8, 6],
  },
  // 洞窟：濕的藍黑岩石，夾著紫色水晶岩；地表是暗綠的苔，偶爾冒出水晶；天花板是長長的鐘乳石
  cave: {
    top: ["#0e2430", "#1a4448", "#1e6a60", "#2e8a78", "#5ac0a0"], stone: ["#0a0c1a", "#121a2c", "#1a2a40", "#24405a", "#3a5e7a", "#5a86a0"],
    mats: [
      ["#0a0c1a", "#121a2c", "#1a2a40", "#24405a", "#3a5e7a", "#5a86a0"],
      ["#0a0c1a", "#121a2c", "#1a2a40", "#24405a", "#3a5e7a", "#5a86a0"],
      ["#0a0c1a", "#1a1030", "#2a1640", "#3a2468", "#5a3c94", "#7a5cb8"],
    ],
    crys: ["#3a2468", "#7a5cb8", "#9a80d0", "#e4ffff"], blade: "moss", hang: "stalactite", cell: [13, 10],
  },
};
const hash = (a, b, c = 0) => { let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

export function paintTerrain(solid, w, h, put, glow = () => {}, theme = "abyss") {
  const T = TERRAIN[theme] ?? TERRAIN.abyss, GRASS = T.top, STONE = T.stone, CRYS = T.crys, [CW, CH] = T.cell;
  const S = (x, y) => (x < 0 || x >= w ? true : y >= h ? true : y < 0 ? false : solid(x, y));
  // 每格到上下左右空氣的距離（最多 24）
  const up = new Uint8Array(w * h), dn = new Uint8Array(w * h), lf = new Uint8Array(w * h), rt = new Uint8Array(w * h);
  for (let x = 0; x < w; x++) {
    let d = 0;
    for (let y = 0; y < h; y++) { d = S(x, y) ? Math.min(24, d + 1) : 0; up[y * w + x] = d; }
    d = 0;
    for (let y = h - 1; y >= 0; y--) { d = S(x, y) ? Math.min(24, d + 1) : 0; dn[y * w + x] = d; }
  }
  for (let y = 0; y < h; y++) {
    let d = 0;
    for (let x = 0; x < w; x++) { d = S(x, y) ? Math.min(24, d + 1) : 0; lf[y * w + x] = d; }
    d = 0;
    for (let x = w - 1; x >= 0; x--) { d = S(x, y) ? Math.min(24, d + 1) : 0; rt[y * w + x] = d; }
  }
  // 地表有沒有接到上面（d=1 是最上面那格）；y=0 那一列的「頂」不算地表（地圖頂端外面）
  const top = (x, y) => up[y * w + x] + (y - up[y * w + x] + 1 <= 0 ? 99 : 0);   // 第 2 輪：原本寫成減，碰到地圖頂的牆整片變成草
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!S(x, y)) continue;
    const u = top(x, y), d = dn[i] + (y + dn[i] >= h ? 99 : 0), l = lf[i] + (x - lf[i] + 1 <= 0 ? 99 : 0), r = rt[i] + (x + rt[i] >= w ? 99 : 0);
    const edge = Math.min(u, d, l, r);
    // 外角：上＋左、上＋右、下＋左、下＋右兩邊都貼著空氣的那一格切掉（圓角）
    if ((u === 1 || d === 1) && (l === 1 || r === 1)) continue;
    // 草皮：地表往下 3～6 格（每欄長度不一），最上面兩列最亮
    // 第 3 輪：垃圾山的鏽土薄一點、有的地方只剩一層（垃圾直接露出地表），不然像一條整齊的土帶
    const gl = T.mats && !CRYS ? (hash(x >> 2, 15) < 0.35 ? 1 : 2 + Math.floor(hash(x >> 1, 7) * 2)) : 3 + Math.floor(hash(x >> 1, 7) * 4);
    if (u <= gl && u < 50) {
      const c = u === 1 ? (hash(x, 11) < 0.7 ? GRASS[4] : GRASS[3]) : u === 2 ? GRASS[3] : u === gl ? GRASS[1] : GRASS[2];
      let cc = l <= 1 || r <= 1 ? GRASS[1] : c;
      // 第 2 輪：垃圾山的鏽土裡夾著碎屑（原本一整片太平）
      if (T.mats && u >= 2 && hash(x, y, 12) < 0.2) cc = T.mats[Math.floor(hash(x, y, 13) * T.mats.length)][hash(x, y, 14) < 0.5 ? 4 : 3];
      put(x, y, cc);
      continue;
    }
    // 外框：貼著空氣的那一格最暗
    if (edge === 1) { put(x, y, STONE[0]); continue; }
    // 第 2 輪：原本是整齊的磚（像城堡），改成大小不一的圓石塊——抖動格點的最近點（Voronoi），
    // 每塊照「離自己中心的方向」打光（左上亮、右下暗），兩塊之間的縫最暗；離邊緣 14 格以上越來越暗
    const deep = edge > 14 ? 2 : edge > 8 ? 1 : 0;
    const gx = Math.floor(x / CW), gy = Math.floor(y / CH);
    let b1 = 1e9, b2 = 1e9, cx = 0, cy = 0, id = 0;
    for (let j = gy - 1; j <= gy + 1; j++) for (let i2 = gx - 1; i2 <= gx + 1; i2++) {
      const px = i2 * CW + hash(i2, j, 1) * CW, py = j * CH + hash(i2, j, 2) * CH, dd = (x - px) ** 2 * 0.8 + (y - py) ** 2;
      if (dd < b1) { b2 = b1; b1 = dd; cx = px; cy = py; id = i2 * 73 + j; } else if (dd < b2) b2 = dd;
    }
    const gap = Math.sqrt(b2) - Math.sqrt(b1);
    let c;
    if (gap < 1.2) c = STONE[deep ? 0 : 1];
    else {
      const M = T.mats ? T.mats[Math.floor(hash(id, 7) * T.mats.length)] : STONE;   // 這一塊的材質
      const lx = (x - cx) / (CW * 0.55), ly = (y - cy) / (CH * 0.55), lit = -lx * 0.6 - ly * 0.8 + (hash(id, 6) - 0.5) * 0.4;
      c = gap < 2.2 && lit < 0 ? M[2 - Math.min(1, deep)] : lit > 0.75 ? M[5 - deep] : lit > 0.1 ? M[4 - deep] : M[3 - deep];
      if (deep === 2) c = hash(id, 8) < 0.7 ? STONE[1] : STONE[2];
    }
    // 牆的受光：朝左的牆面（左邊是空氣）亮一條、朝右的暗一條；天花板（下面是空氣）壓暗
    if (l === 2 && deep === 0 && c !== STONE[1]) c = STONE[5];
    else if (r === 2) c = STONE[1];
    if (d <= 3) c = d === 2 ? STONE[1] : STONE[2];
    put(x, y, c);
    // 水晶礦脈：靠近邊緣、隨機幾處
    if (CRYS && edge >= 3 && edge <= 6 && hash(x >> 3, y >> 3, 9) < (theme === "cave" ? 0.06 : 0.03)) {
      const k = hash(x >> 1, y >> 1, 4);   // 第 3 輪：2×2 一塊，不然是碎點
      put(x, y, k < 0.3 ? CRYS[3] : k < 0.65 ? CRYS[2] : CRYS[1]);
      if (k < 0.65) glow(x, y, k < 0.3 ? CRYS[3] : CRYS[2]);
    }
  }
  // 地表上方的草葉、牆邊垂下來的草、天花板垂下來的根和石牙（畫在空氣格）
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    if (S(x, y)) continue;
    // 草葉：下面是地表
    if (S(x, y + 1) && up[(y + 1) * w + x] === 1 && !(lf[(y + 1) * w + x] === 1 || rt[(y + 1) * w + x] === 1)) {
      // 第 3 輪：原本每欄都有、一樣高，像地毯——改成一叢一叢（每 6 格一區，有的區沒草），高度 1～4、顏色分深淺
      if (T.blade === "junk") {   // 垃圾山：稀疏地插著釘子、瓶口、鐵片（1～3 格），灰或鏽色
        if (hash(x, 26) < 0.12) { const hgt = 1 + Math.floor(hash(x, 27) * 3), c = hash(x, 28) < 0.5 ? "#9a968c" : "#b05a2a"; for (let k = 0; k < hgt; k++) if (!S(x, y - k)) put(x, y - k, k === hgt - 1 && hgt > 1 ? "#c4bca2" : c); }
      } else if (T.blade === "moss" && CRYS && hash(x, 29) < 0.03) {   // 洞窟：苔上偶爾冒出一小根水晶
        for (let k = 0; k < 3; k++) if (!S(x, y - k)) { const c = k === 2 ? CRYS[3] : CRYS[2]; put(x, y - k, c); glow(x, y - k, c); }
      } else {
      const clump = hash(x >> 3, 22) < (T.blade === "moss" ? 0.4 : 0.65), hgt = clump ? 1 + Math.floor(hash(x, 21) * (hash(x >> 3, 23) < 0.4 ? 4 : 2)) : hash(x, 24) < 0.2 ? 1 : 0;
      const dark = hash(x, 25) < 0.35, hg2 = T.blade === "moss" ? Math.min(hgt, 2) : hgt;
      for (let k = 0; k < hg2; k++) if (!S(x, y - k)) put(x, y - k, k === hg2 - 1 ? (dark ? GRASS[3] : GRASS[4]) : dark ? GRASS[2] : GRASS[3]);
      }
    }
    // 第 3 輪：牆頂的草沿著牆邊往下垂 1～4 格（外角不會一刀切）
    for (const sx of [-1, 1]) if (S(x + sx, y) && up[y * w + x + sx] <= 3 && up[y * w + x + sx] >= 1 && y - up[y * w + x + sx] + 1 > 0 && hash(x, y, 41) < 0.6) {
      const len = 1 + Math.floor(hash(x + sx, 42) * 4);
      for (let k = 0; k < len && !S(x, y + k) && S(x + sx, y + k); k++) put(x, y + k, k === len - 1 ? GRASS[1] : GRASS[2]);
    }
    // 牆上的水晶（C1）：牆面（左或右是實心、離牆頂超過 6 格）偶爾長出一小叢，往外斜上；會發光
    if (CRYS) for (const sx of [-1, 1]) if (S(x + sx, y) && !S(x - sx, y) && up[y * w + x + sx] > 6 && dn[y * w + x + sx] > 4 && hash(x >> 4, y >> 4, 51 + sx) < 0.18 && y % 16 === 8) {   // 第 2 輪：原本太少看不到，改成每 16 格高的牆面約 2 成機率長一叢
      // 第 3 輪：原本一根 1 格細線看不出是水晶——改成 3 根晶柱成扇形（往外、斜上、往上），每根 2 格粗、長短不一，暗邊＋亮芯＋白尖
      const out = -sx;
      [[1, 0, 4], [1, -1, 6], [0.4, -1, 4]].forEach(([dx, dy, n0], s2) => {
        const n = n0 + Math.floor(hash(x, y, 53 + s2) * 2);
        for (let k = 0; k < n; k++) {
          const cx2 = Math.round(x + out * dx * k * (dy ? 0.6 : 1)), cy2 = Math.round(y + dy * k) - s2;
          if (S(cx2, cy2)) break;
          const tip = k === n - 1, c = tip ? CRYS[3] : k >= n - 3 ? CRYS[2] : CRYS[1];
          put(cx2, cy2, c); glow(cx2, cy2, c);
          const ex = cx2 - out * (dy ? 0 : 0), ey = cy2 + 1;
          if (!tip && !S(ex, ey)) put(ex, ey, CRYS[0]);
          if (!tip && !S(cx2 + out, cy2) && k < n - 2) put(cx2 + out * (dy ? 1 : 0), cy2 - (dy ? 0 : 1), CRYS[1]);
        }
      });
    }
    // 天花板：上面是實心、這格是空氣 → 偶爾垂下根（綠）或石牙（灰），2～6 格
    if (S(x, y - 1) && T.hang === "roots" && hash(x, 31) < 0.22) {
      const len = 2 + Math.floor(hash(x, 32) * 5), root = hash(x, 33) < 0.5;
      for (let k = 0; k < len && !S(x, y + k); k++) put(x, y + k, root ? (k === len - 1 ? GRASS[2] : GRASS[1]) : (k === 0 ? STONE[2] : k === len - 1 ? STONE[0] : STONE[1]));
    }
    // 垃圾山：電線（細長、末端掛一小塊垃圾）和鐵鍊（一格亮一格暗）
    if (S(x, y - 1) && T.hang === "wires" && hash(x, 34) < 0.07) {
      const len = 4 + Math.floor(hash(x, 35) * 12), chain = hash(x, 36) < 0.4;
      let k = 0;
      for (; k < len && !S(x, y + k); k++) put(x, y + k, chain ? (k % 2 ? "#5c5868" : "#9a968c") : "#24182e");
      if (!chain && !S(x, y + k)) { put(x, y + k, "#b05a2a"); put(x + 1, y + k, "#8a3e24"); put(x, y + k + 1, "#8a3e24"); }
    }
    // 洞窟：鐘乳石（往下變尖，4～14 格長），每隔一段一根
    if (S(x, y - 1) && T.hang === "stalactite" && x % 5 === 0 && hash(x >> 2, 37) < 0.45) {   // 第 2 輪：粗一點、多一點
      const len = 5 + Math.floor(hash(x >> 2, 38) * 12);
      for (let k = 0; k < len; k++) {
        const half = Math.max(0, Math.round(2.4 * (1 - k / len)));
        for (let dx = -half; dx <= half; dx++) if (!S(x + dx, y + k)) put(x + dx, y + k, dx === -half && half ? STONE[4] : dx === half && half ? STONE[1] : STONE[3]);
      }
    }
  }
}
