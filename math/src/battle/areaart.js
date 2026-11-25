// 戰鬥背景（正式美術）：每個區域三層 back／mid／ground，合成一張 384×216，再做一張「被墨水弄灰」的版本。
// 圖放在 assets/battle/<區域>/，版面數字見 art/2-草稿/<區域>/通過-日期/接進遊戲.md。
// 還沒有正式圖的區域回傳 null，戰鬥畫面就用暫用色塊。

const AREA_OF = { g1: "garden" };          // 之後每做完一區就加上去：g2 library、g34 clock、g56 greenhouse、jh vault
const GROUND_TOP = 132;                     // ground 上緣（角色腳下 y＝144 在踏腳石那排）
const MID_SINK = 6;                         // mid 底部壓進 ground 上緣幾格
const MID_DIM = 0.9, MID_SAT = 0.85;        // 中景稍微調暗、降一點彩度，角色和怪物比較清楚
const W = 384, H = 216;

const cache = {};

function loadImg(src) {
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
}

// 每個像素：調亮度、彩度（不用 canvas filter，Safari 舊版不支援）
function adjust(ctx, w, h, fn) {
  const d = ctx.getImageData(0, 0, w, h), a = d.data;
  for (let i = 0; i < a.length; i += 4) if (a[i + 3]) fn(a, i);
  ctx.putImageData(d, 0, 0);
}

export async function loadAreaArt(gradeId) {
  const area = AREA_OF[gradeId];
  if (!area) return null;
  if (cache[area] !== undefined) return cache[area];
  try {
    const base = new URL(`../../assets/battle/${area}/`, import.meta.url);
    const [back, mid, ground] = await Promise.all(["back", "mid", "ground"].map((n) => loadImg(new URL(`${n}.png`, base))));

    // 中景先調暗
    const mc = document.createElement("canvas"); mc.width = mid.width; mc.height = mid.height;
    const mx = mc.getContext("2d"); mx.drawImage(mid, 0, 0);
    adjust(mx, mid.width, mid.height, (a, i) => {
      const l = 0.3 * a[i] + 0.59 * a[i + 1] + 0.11 * a[i + 2];
      for (let k = 0; k < 3; k++) a[i + k] = (l + (a[i + k] - l) * MID_SAT) * MID_DIM;
    });

    // 合成彩色版
    const color = document.createElement("canvas"); color.width = W; color.height = H;
    const c = color.getContext("2d"); c.imageSmoothingEnabled = false;
    c.drawImage(back, 0, 0);
    c.drawImage(mc, Math.round((W - mid.width) / 2), GROUND_TOP + MID_SINK - mid.height);
    const gx = Math.round((W - ground.width) / 2);
    c.drawImage(ground, gx, GROUND_TOP);
    // ground 以下（被答案按鈕蓋住的地方）用最下面 16 列往下補滿
    for (let y = GROUND_TOP + ground.height; y < H; y += 16) c.drawImage(ground, 0, ground.height - 16, ground.width, 16, gx, y, ground.width, 16);

    // 被墨水弄灰的版本：去掉大部分顏色、壓暗、帶一點墨水的藍紫
    const gray = document.createElement("canvas"); gray.width = W; gray.height = H;
    const g = gray.getContext("2d"); g.drawImage(color, 0, 0);
    adjust(g, W, H, (a, i) => {
      const l = 0.3 * a[i] + 0.59 * a[i + 1] + 0.11 * a[i + 2];
      const ink = [l * 0.78 + 10, l * 0.74 + 8, l * 0.9 + 22];
      for (let k = 0; k < 3; k++) a[i + k] = (a[i + k] * 0.2 + ink[k] * 0.8) * 0.82;
    });
    cache[area] = { color, gray };
  } catch {
    cache[area] = null;
  }
  return cache[area];
}

/** 已經載入過的（給 Stage 同步取用） */
export const areaArtNow = (gradeId) => cache[AREA_OF[gradeId]] ?? null;
