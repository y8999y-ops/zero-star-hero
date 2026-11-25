// 戰鬥背景（正式美術）：每個區域三層 back／mid／ground（圖在 assets/battle/<區域>/）。
// 為了讓場景有動態，載入時把最遠層再拆開：
//   base     天空（只剩一條一條的天空色帶）
//   cloudsHi 高的雲（飄得快一點）、cloudsLo 低的雲（飄得慢）
//   island   浮空島＋城堡（輕輕上下浮）
//   front    中景＋地面合成一張（中景稍微調暗，角色比較清楚）
// 每一層都有彩色版和「被墨水弄灰」的版本；另外找出中景裡的金色星星花位置，給閃光用。
// 版面數字見 art/2-草稿/<區域>/通過-日期/接進遊戲.md。還沒有正式圖的區域回傳 null（用暫用色塊）。

const AREA_OF = { g1: "garden" };          // 像素版只剩花園（開場動畫、標題用）；戰鬥背景改用 AI 原圖（下面 loadBattleHD）
// 室內的區域（圖書館、鐘塔）：最遠層是整間房間，不拆天空和雲
const INDOOR = new Set(["library", "clock"]);
const GROUND_TOP = 132;                     // ground 上緣（角色腳下 y＝144 在踏腳石那排）
const MID_SINK = 6;                         // mid 底部壓進 ground 上緣幾格
const MID_DIM = 0.9, MID_SAT = 0.85;        // 中景稍微調暗、降一點彩度
const CLOUD_SPLIT = 75;                     // 這條線以上的雲算「高的雲」
const SKY_BOTTOM = 140;                     // 這條線以下會被中景擋住，不拆
const STAR_GOLD = [250, 200, 94];           // 星星花的金色（#fac85e）
const W = 384, H = 216;

const cache = {};

function loadImg(src) {
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
}
const canvas = (w = W, h = H) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };

// 被墨水弄灰：去掉大部分顏色、壓暗、帶一點墨水的藍紫
export function grayOf(src) {
  const c = canvas(src.width, src.height), x = c.getContext("2d");
  x.drawImage(src, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height), a = d.data;
  for (let i = 0; i < a.length; i += 4) {
    if (!a[i + 3]) continue;
    const l = 0.3 * a[i] + 0.59 * a[i + 1] + 0.11 * a[i + 2];
    const ink = [l * 0.78 + 10, l * 0.74 + 8, l * 0.9 + 22];
    for (let k = 0; k < 3; k++) a[i + k] = (a[i + k] * 0.2 + ink[k] * 0.8) * 0.82;
  }
  x.putImageData(d, 0, 0);
  return c;
}
const both = (c) => ({ color: c, gray: grayOf(c) });

// 把最遠層拆成：天空色帶、高的雲、低的雲、浮空島
function splitBack(back) {
  const src = canvas(); const sx = src.getContext("2d"); sx.drawImage(back, 0, 0);
  const d = sx.getImageData(0, 0, W, H), a = d.data;
  const key = (i) => (a[i] << 16) | (a[i + 1] << 8) | a[i + 2];
  // 每一列最多的顏色＝那一列的天空色
  const band = [];
  for (let y = 0; y < H; y++) {
    const n = new Map();
    for (let x = 0; x < W; x++) { const k = key((y * W + x) * 4); n.set(k, (n.get(k) ?? 0) + 1); }
    band[y] = [...n].sort((p, q) => q[1] - p[1])[0][0];
  }
  // 不是天空色的格子分成一塊一塊
  const notSky = new Uint8Array(W * H), lab = new Int32Array(W * H);
  for (let y = 0; y < SKY_BOTTOM; y++) for (let x = 0; x < W; x++) notSky[y * W + x] = key((y * W + x) * 4) !== band[y] ? 1 : 0;
  let n = 0; const size = [0];
  for (let i = 0; i < W * H; i++) {
    if (!notSky[i] || lab[i]) continue;
    n++; size[n] = 0; const st = [i]; lab[i] = n;
    while (st.length) {
      const j = st.pop(); size[n]++;
      const x = j % W, y = (j / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy, k = Y * W + X;
        if (X >= 0 && Y >= 0 && X < W && Y < H && notSky[k] && !lab[k]) { lab[k] = n; st.push(k); }
      }
    }
  }
  // 一塊是「雲」：裡面幾乎都是雲的顏色（白、淡藍）。其他的（城堡尖塔、十字架、
  // 小浮石……）都跟著浮空島一起動，不然細的尖塔會被當成雲飄走
  const cloudish = new Array(n + 1).fill(0);
  for (let j = 0; j < W * H; j++) if (lab[j]) {
    const i = j * 4, mx = Math.max(a[i], a[i + 1], a[i + 2]), mn = Math.min(a[i], a[i + 1], a[i + 2]);
    if (mx > 200 && mx - mn < 90 && a[i + 1] >= a[i] - 12) cloudish[lab[j]]++;   // 白、淡藍（淡紫的岩石 g 比 r 低很多，不算）
  }
  const isCloud = (k) => cloudish[k] / size[k] >= 0.9;

  const base = canvas(), hi = canvas(), lo = canvas(), isl = canvas();
  const out = { base: base.getContext("2d").createImageData(W, H), hi: hi.getContext("2d").createImageData(W, H), lo: lo.getContext("2d").createImageData(W, H), isl: isl.getContext("2d").createImageData(W, H) };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const j = y * W + x, i = j * 4;
    let tgt = null;
    if (notSky[j]) tgt = !isCloud(lab[j]) ? out.isl : y < CLOUD_SPLIT ? out.hi : out.lo;
    const b = band[y];
    // 天空：拆走的地方補上那一列的天空色
    out.base.data.set(tgt ? [(b >> 16) & 255, (b >> 8) & 255, b & 255, 255] : [a[i], a[i + 1], a[i + 2], 255], i);
    if (tgt) tgt.data.set([a[i], a[i + 1], a[i + 2], 255], i);
  }
  base.getContext("2d").putImageData(out.base, 0, 0);
  hi.getContext("2d").putImageData(out.hi, 0, 0);
  lo.getContext("2d").putImageData(out.lo, 0, 0);
  isl.getContext("2d").putImageData(out.isl, 0, 0);
  return { base, hi, lo, isl };
}

// 中景裡金色星星花的位置（每一叢金色格子取最上面那格）
function findStars(front) {
  const x = front.getContext("2d"), d = x.getImageData(0, 0, W, H).data, seen = new Uint8Array(W * H), out = [];
  const gold = (j) => Math.abs(d[j * 4] - STAR_GOLD[0]) < 12 && Math.abs(d[j * 4 + 1] - STAR_GOLD[1]) < 12 && Math.abs(d[j * 4 + 2] - STAR_GOLD[2]) < 14;
  for (let j = 0; j < W * H; j++) {
    if (seen[j] || !gold(j)) continue;
    const st = [j]; seen[j] = 1; let cnt = 0, top = j;
    while (st.length) {
      const k = st.pop(); cnt++; if (k < top) top = k;
      const px = k % W, py = (k / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = px + dx, Y = py + dy, m = Y * W + X;
        if (X >= 0 && Y >= 0 && X < W && Y < H && !seen[m] && gold(m)) { seen[m] = 1; st.push(m); }
      }
    }
    if (cnt >= 6) out.push([top % W, (top / W) | 0]);
  }
  return out;
}

export async function loadAreaArt(gradeId) {
  const area = AREA_OF[gradeId];
  if (!area) return null;
  if (cache[area] !== undefined) return cache[area];
  try {
    const base = new URL(`../../assets/battle/${area}/`, import.meta.url);
    const [back, mid, ground] = await Promise.all(["back", "mid", "ground"].map((n) => loadImg(new URL(`${n}.png`, base))));

    // 中景先調暗
    const mc = canvas(mid.width, mid.height), mx = mc.getContext("2d");
    mx.drawImage(mid, 0, 0);
    const md = mx.getImageData(0, 0, mid.width, mid.height), ma = md.data;
    for (let i = 0; i < ma.length; i += 4) {
      if (!ma[i + 3]) continue;
      const l = 0.3 * ma[i] + 0.59 * ma[i + 1] + 0.11 * ma[i + 2];
      for (let k = 0; k < 3; k++) ma[i + k] = (l + (ma[i + k] - l) * MID_SAT) * MID_DIM;
    }
    mx.putImageData(md, 0, 0);

    // 前面一張：中景＋地面；地面以下（被答案按鈕蓋住）用最下面 16 列往下補滿
    const front = canvas(), f = front.getContext("2d");
    f.drawImage(mc, Math.round((W - mid.width) / 2), GROUND_TOP + MID_SINK - mid.height);
    const gx = Math.round((W - ground.width) / 2);
    f.drawImage(ground, gx, GROUND_TOP);
    for (let y = GROUND_TOP + ground.height; y < H; y += 16) f.drawImage(ground, 0, ground.height - 16, ground.width, 16, gx, y, ground.width, 16);

    const parts = INDOOR.has(area) ? { base: (() => { const c = canvas(); c.getContext("2d").drawImage(back, 0, 0); return c; })(), hi: canvas(), lo: canvas(), isl: canvas() } : splitBack(back);
    cache[area] = {
      kind: area,
      base: both(parts.base), cloudsHi: both(parts.hi), cloudsLo: both(parts.lo), island: both(parts.isl), front: both(front),
      stars: findStars(front),
    };
  } catch (e) {
    console.warn("戰鬥背景載入失敗", e);
    cache[area] = null;
  }
  return cache[area];
}

/** 已經載入過的（給 Stage 同步取用） */
export const areaArtNow = (gradeId) => cache[AREA_OF[gradeId]] ?? null;

// ── AI 原圖版的戰鬥背景（使用者 2026-11-25：背景改用 AI 原圖，不重畫成像素）──
// 圖在 assets/battle-hd/<區域>/（art/2-草稿/hd/make_hd.py 做的）：back.jpg 1152×648、mid／ground 是同一個 3 倍比例，
// 版面數字跟像素版一樣（ground 上緣 132、mid 底部壓進 ground 6 格，都水平置中）。用 DOM 圖片疊在戰鬥畫布後面，畫布只畫角色和特效。
const HD_AREA = { g1: "garden", g2: "library", g34: "clock", g56: "greenhouse", jh: "vault" };
const hdCache = {};
export async function loadBattleHD(gradeId, areaOverride = null) {
  const area = areaOverride ?? HD_AREA[gradeId];
  if (!area) return null;
  if (hdCache[area] !== undefined) return hdCache[area];
  try {
    const base = new URL(`../../assets/battle-hd/${area}/`, import.meta.url);
    const [back, mid, ground] = await Promise.all([["back", "jpg"], ["mid", "png"], ["ground", "png"]].map(([n, e]) => loadImg(new URL(`${n}.${e}`, base).href)));
    hdCache[area] = { hd: true, kind: area, back, mid, ground, stars: [], groundTop: GROUND_TOP, midSink: MID_SINK, k: 3 };
  } catch (e) { console.warn("戰鬥背景（原圖）載入失敗", e); hdCache[area] = null; }
  return hdCache[area];
}
export const battleHDNow = (gradeId, areaOverride = null) => hdCache[areaOverride ?? HD_AREA[gradeId]] ?? null;
