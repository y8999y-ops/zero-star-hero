// 功能視窗的外框（2026-11-05，照 pixelfx skill 的畫→看→修重做）：視窗 24×24、卡片 16×16 九宮格（切 8／6）。
// 層次（由外往內）：四角斜切 → 1px 最暗外框 → 3 階斜面框（左上亮、右下暗）→ 1px 內陰影 → 底色（最上一列反光、最下兩列壓暗）。
// 四個角各蓋一個主題角飾（第 2 輪：放大到 7×7，第 1 輪太小看不到；第 3 輪：公會改成整顆菱形金座＋白色亮點的紅寶石、旅館葉子放大）：
//   公會＝金色菱形底座＋紅寶石、鍛造＝鐵板＋四顆鉚釘＋燒紅的螺栓、旅館＝木頭圓結＋兩片葉子、系統＝2px 粗的發光 L 形括號。
// 回傳 { w, h, px }，px 是 "#rrggbb"、"rgba(...)" 或 null；ui-art.js 畫成 canvas，草稿工具畫成 PNG。
export const THEMES = {
  guild: { out: "#1a0c06", t: ["#fff2b0", "#f0b840", "#c07a2a", "#8a4c1a", "#5a2c10"], line: "#140a1a", fill: "rgba(34,20,46,.95)", deep: "rgba(20,10,30,.95)", sheen: "rgba(255,226,150,.16)" },
  forge: { out: "#100606", t: ["#d8dce8", "#9aa0b4", "#6a6e84", "#46485c", "#2a2a3a"], line: "#160606", fill: "rgba(40,18,14,.95)", deep: "rgba(26,10,8,.95)", sheen: "rgba(255,160,90,.14)" },
  inn: { out: "#140c06", t: ["#f4d0a0", "#c89058", "#9a6434", "#6a4020", "#42260e"], line: "#0a140c", fill: "rgba(22,32,24,.95)", deep: "rgba(12,22,14,.95)", sheen: "rgba(220,255,180,.13)" },
  sys: { out: "#04101a", t: ["#c8fbff", "#6ad8ff", "#2a9ad0", "#18688e", "#0c3a54"], line: "#030c16", fill: "rgba(8,22,38,.94)", deep: "rgba(4,12,24,.94)", sheen: "rgba(140,240,255,.16)" },
};
// 角飾（左上角，7×7，'.' 不畫）：字元 → 顏色
const DECO = {
  guild: { rows: ["...a...", "..abb..", ".abrRc.", "abrwRRc", ".bRRRc.", "..bcc..", "...c..."], col: { a: "#fff6c8", b: "#f0b840", c: "#a85a1a", r: "#ff8a7a", R: "#c8202a", w: "#ffffff" } },
  forge: { rows: ["oooooo.", "oaxxxbo", "oxxxxxo", "oxxhxxo", "oxxxxxo", "obxxxbo", "ooooooo"], col: { o: "#100606", a: "#e8ecf4", b: "#9aa0b4", x: "#46485c", h: "#ff8a3a" } },
  inn: { rows: [".gg....", "gGGg...", ".gGwww.", "..wWWWw", "..wWxWw", "..wWWWw", "...www."], col: { g: "#a8e070", G: "#4a9a3a", w: "#c89058", W: "#8a5a2c", x: "#42260e" } },
  sys: { rows: ["aaaaaa.", "abbbbb.", "ab.....", "ab.....", "ab.....", "ab.....", "......."], col: { a: "#ffffff", b: "#6ad8ff" } },
};
export function frameArt(theme, card = false) {
  const T = THEMES[theme], N = card ? 16 : 24, cut = card ? 2 : 3, rings = card ? 2 : 3, px = new Array(N * N).fill(null);
  const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < N && y < N) px[y * N + x] = c; };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const cx = Math.min(x, N - 1 - x), cy = Math.min(y, N - 1 - y), c = cx + cy, d = Math.min(cx, cy), tl = x + y < N - 1;
    if (c < cut) continue;
    const ring = Math.min(d, c - cut);   // 斜切的地方沿著斜邊算層數
    if (ring === 0) set(x, y, T.out);
    else if (ring <= rings) set(x, y, tl ? T.t[ring - 1] : T.t[ring + 1]);
    else if (ring === rings + 1) set(x, y, T.line);
    else set(x, y, y === rings + 2 ? T.sheen : y >= N - rings - 4 ? T.deep : T.fill);
  }
  if (card) return { w: N, h: N, px };
  const D = DECO[theme];
  D.rows.forEach((r, y) => [...r].forEach((ch, x) => {
    if (ch === ".") return;
    const c = D.col[ch];
    set(x, y, c); set(N - 1 - x, y, c); set(x, N - 1 - y, c); set(N - 1 - x, N - 1 - y, c);
  }));
  return { w: N, h: N, px };
}
