// 墨水滴（最基本的墨水怪，全部區域都會出現）：面向左（朝玩家）。
// 水滴形的身體，尖端圓圓地往後勾；坐在一小攤墨水上；左上有亮亮的光澤；大白眼睛看著玩家，可愛不嚇人。
// 動作：idle＝縮一下蓄力 → 跳起來（拉長）→ 落地壓扁「啪」→ 回彈；hurt＝被打中壓扁、＞＜眼。
// 雜兵 12 色以內（黑外框＋墨色五階＋光澤＋白＋眼睛）。
//
// inkDropFrame(pose, t) → { w, h, ox, oy, px, colors }（原點＝腳底中央）

import { Grid } from "./_grid.js";

export const W = 44, H = 48, OX = 22, OY = 44;
const C = {
  ink0: "#0f0b1c", ink1: "#1c1533", ink2: "#2d2350", ink3: "#463a78", ink4: "#6e5fb0",
  shine: "#cfc6ff", white: "#ffffff", eye: "#1c1533", blush: "#9a7ce0",
};

// 受光：光從左上前方來；回傳墨色的第幾階
function shadeAt(nx, ny) {
  const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
  const d = -0.55 * nx - 0.65 * ny + 0.5 * nz;
  return d > 0.62 ? C.ink4 : d > 0.3 ? C.ink3 : d > -0.05 ? C.ink2 : C.ink1;
}

function poseOf(pose, t) {
  const D = 1.2, ph = (t % D) / D;
  // s：>0 拉長、<0 壓扁；lift：離地高度
  let s = 0, lift = 0, look = 0;
  if (pose === "hurt") return { s: -0.45, lift: 0, hurt: true, look: 0, drip: 0.5 };
  if (ph < 0.25) s = -0.25 * Math.sin((ph / 0.25) * Math.PI * 0.5);                 // 縮一下蓄力
  else if (ph < 0.6) { const u = (ph - 0.25) / 0.35; lift = Math.sin(u * Math.PI) * 9; s = 0.3 * (1 - u * 1.3); }   // 跳起來
  else if (ph < 0.68) s = -0.4;                                                         // 落地壓扁
  else { const u = (ph - 0.68) / 0.32; s = -0.4 * Math.exp(-u * 4) * Math.cos(u * 9); } // 回彈晃動
  look = ph > 0.85 ? 1 : 0;   // 偶爾眨眼
  return { s, lift: Math.round(lift), hurt: false, blink: look, drip: ph };
}

export function inkDropFrame(pose = "idle", t = 0) {
  const q = poseOf(pose, t);
  const g = new Grid(W, H, OX, OY);
  const rx = 11 * (1 - q.s * 0.35), ry = 9.5 * (1 + q.s * 0.45);
  const by = -ry - q.lift;                       // 身體中心
  const top = by - ry;

  // 地上的一小攤墨水（跳起來時變小）
  const pr = q.lift ? 7 : 12 - q.s * 4;
  g.ellipse(0, -1, pr, 1.6, (nx, ny) => (ny < -0.2 ? C.ink2 : C.ink1));

  // 身體：圓的下半＋往上收的水滴尖，尖端往後（右邊）彎
  g.ellipse(0, by, rx, ry, shadeAt);
  // 水滴尖：短一點、粗一點，尖端圓圓地往後勾（拉長時也不會變成刺）
  const tipH = 6.5 * (1 + q.s * 0.35), lean = 2.5 + q.s * 1.5;
  g.poly([[-rx * 0.7, by - ry * 0.4], [rx * 0.7, by - ry * 0.4], [lean + 2.5, top - tipH * 0.5], [lean + 2, top - tipH], [lean - 0.5, top - tipH * 0.75]],
    (x, y) => shadeAt((x - lean * 0.5) / (rx * 0.8), Math.max(-1, (y - by) / (ry + tipH))));

  // 光澤：左上一道彎的亮光＋兩個亮點（墨水是濕的）
  g.line(-rx * 0.82, by - ry * 0.05, -rx * 0.55, by - ry * 0.62, C.shine);
  g.set(-rx * 0.85, by + ry * 0.25, C.ink4);
  g.set(lean, top - tipH * 0.6, C.shine);
  g.set(-rx * 0.2, by - ry * 0.82, C.white);

  // 眼睛：看向左邊（玩家），大白眼＋黑眼珠＋小亮點
  // 大眼睛：3×4 白眼，眼珠 2×2 靠左下（看著玩家），右上一格反光
  const ex = -4, ey = by - 2;
  const eyes = [ex, ex + 6];
  if (q.hurt) {
    // ＞＜（兩格寬的斜線）
    eyes.forEach((x, k) => {
      // 左眼「＞」、右眼「＜」
      const m = (dx) => (k === 0 ? x + dx : x + 2 - dx);
      g.set(m(0), ey, C.white); g.set(m(1), ey + 1, C.white); g.set(m(2), ey + 2, C.white); g.set(m(1), ey + 3, C.white); g.set(m(0), ey + 4, C.white);
    });
  } else if (q.blink) {
    for (const x of eyes) g.rect(x, ey + 2, 3, 1, C.white);
  } else {
    for (const x of eyes) {
      // 圓圓的白眼（四角留給身體色）＋大眼珠靠左下，眼珠左上一格反光
      g.rect(x, ey, 3, 4, C.white);
      g.rect(x, ey + 1, 2, 3, C.eye);
      g.set(x, ey + 1, C.white);
      g.set(x + 2, ey + 3, C.ink3);
    }
  }
  g.rect(ex - 1, ey + 5, 2, 1, C.blush); g.rect(ex + 8, ey + 5, 2, 1, C.blush);
  // 嘴：平常是小小的 ω，跳起來時張開
  const mx = ex + 3, my = ey + 5;
  if (q.hurt) g.rect(mx, my, 3, 2, C.ink0);
  else if (q.lift > 2) { g.rect(mx, my, 3, 2, C.ink0); g.set(mx + 1, my + 1, C.blush); }
  else { g.set(mx, my, C.ink0); g.set(mx + 1, my + 1, C.ink0); g.set(mx + 2, my, C.ink0); }

  // 身體下面垂著的墨滴（隨時間慢慢拉長再滴落）
  if (!q.lift) {
    const k = (q.drip * 2) % 1, dl = Math.round(1 + k * 3);
    g.rect(rx * 0.45, -2, 1, dl, C.ink2);
    if (k > 0.7) g.set(rx * 0.45, -2 + dl + 1, C.ink3);
  }

  g.outline();

  return g.pixels();
}
