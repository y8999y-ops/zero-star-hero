// 貓頭鷹鎮長（2026-11-20，使用者：「pixelfx skill 畫貓頭鷹看看」；設計沿用 codeart2d 通過的那版：藍紫色、魔法帽）。
// 照 PixelFX critters 的畫法（跟 town-slime、golem、mushroom、turtle 同一套 _town.js）：
//   身體一顆受光的圓球、兩邊翅膀在後面、淡紫肚子上一排排小 V 字羽紋；眼睛周圍一圈淺色的臉盤（貓頭鷹的特徵）；
//   金框圓眼鏡（鏡片反光從左掃到右）、白色濃眉、橘色小嘴、橘腳；
//   魔法帽：扁的帽簷＋往右彎的尖頂，尖頂跟著呼吸慢半拍晃，金帶上一顆會閃的小星星；帽尖偶爾飄出魔法星點（特效層）。
// 動作：idle＝慢慢呼吸、帽尖晃、偶爾眨眼；talk＝嘴巴一開一合、右翅膀舉起來揮。
import { wrap, TAU } from "../../../pixelfx/src/core/index.js";
import { Grid } from "../../../pixelfx/src/fx/critters/_lib.js";
import { ramp, ball, limb, outline, lightN } from "./_town.js";

export const meta = {
  name: "Owl mayor",
  desc: "The town mayor: a round blue-violet owl with gold spectacles, bushy white brows and a bent wizard hat whose tip sways a beat behind its breathing; it blinks now and then, or talks while waving a wing.",
  tags: ["critter", "owl", "npc", "town", "loop"],
  size: [80, 72],
  origin: [40, 64],
  duration: 3.2,
  loop: true,
  fps: 30,
  bg: "ground",
  options: { mode: "idle", seed: 1 },
};
const GRID = new Grid(-24, -52, 48, 54);
const FEATHER = ramp(["#100c28", "#1e1a48", "#2e2c6e", "#43449a", "#6268c4", "#8e96e6", "#c8d0ff"]);
const WING = ramp(["#100c28", "#16133a", "#22205a", "#33357e", "#4a4fa8", "#6a72cc", "#9aa4f0"]);
const BELLY = ramp(["#2a2448", "#7a72a8", "#a49cd0", "#c8c2ea", "#e6e2fa", "#f6f4ff", "#ffffff"]);
const GOLD = ramp(["#3a2408", "#7a4a10", "#b07818", "#e0a830", "#ffd25a", "#ffe890", "#fffbe0"]);
const BEAK = ramp(["#3a1a08", "#8a4a14", "#c06a1e", "#f09a3a", "#ffc070", "#ffc070", "#ffe0b0"]);
const HAT = ramp(["#0c0820", "#1a1240", "#2a1e5c", "#3e2e86", "#5a46b0", "#7a66d0", "#b4a8f0"]);
const FEATHER_UP = [...FEATHER.slice(1), FEATHER[6]];   // 舉起來的翅膀：亮一階，才不會變成一根暗色棒子
const EYE = ramp(["#140e28"])[0], LENS = ramp(["#f4f0ff"])[0];

// 揮手（2026-11-20 使用者：原本「揮手的方式怪」，上下抖像抽動）：
// 跟收著時同一顆橢圓翅膀，從肩膀舉起來，以肩膀為軸左右擺一個弧（約 0.6 秒來回一次），翅膀尖端畫出揮手的弧線
function wavingWing(g, t, up) {
  const px0 = 10, py0 = -14 + up;
  const sw = Math.sin((t / 0.6) * TAU);
  const ang = (-62 + sw * 22) * Math.PI / 180;                        // 往右上舉，以肩膀為軸左右各擺 22 度（不蓋到臉）
  const ca = Math.cos(ang), sa = Math.sin(ang), cx = px0 + ca * 6.5, cy = py0 + sa * 6.5;
  const RA = 7.6, RB = 3.4;                                           // 沿著翅膀的半長、橫切的半寬
  g.shade(cx - 9, cy - 9, cx + 9, cy + 9, (x, y) => {
    const dx = x - cx, dy = y - cy, u = (dx * ca + dy * sa) / RA, v = (-dx * sa + dy * ca) / RB;
    if (u * u + v * v > 1) return 0;
    const nx = u * ca - v * sa, ny = u * sa + v * ca;                 // 轉回畫面方向算受光
    return lightN(WING, nx * 0.8, ny * 0.8, 0.05);
  });
}

function owl(g, t, D, talk) {
  const ph = t / D, br = Math.sin(ph * TAU * 2), up = br > 0.35 ? -1 : 0;          // 一個循環呼吸兩次
  const lag = Math.sin((ph - 0.08) * TAU * 2);                                     // 帽尖慢半拍
  const blink = !talk && ((ph > 0.62 && ph < 0.655) || (ph > 0.7 && ph < 0.725));  // 眨兩下
  const say = talk && Math.floor(t / 0.18) % 2 === 0;                              // 說話：嘴一開一合
  // 腳、翅膀（在身體後面）
  ball(g, -4, -1, 2.6, 1.6, BEAK, { spec: false });
  ball(g, 4, -1, 2.6, 1.6, BEAK, { spec: false });
  ball(g, -10.5, -12 + up, 3.4, 7.5, WING, { spec: false, bias: -0.1 });
  if (!talk) ball(g, 10.5, -12 + up, 3.4, 7.5, WING, { spec: false, bias: -0.25 });
  // 身體
  ball(g, 0, -13 + up, 10.5, 12.5, FEATHER);
  // 肚子：淡紫，一排排 V 字羽紋貼著肚子的弧度
  g.ellipse(0, -7 + up, 6.8, 7.2, (nx, ny) => lightN(BELLY, nx, ny, -0.12));
  for (const [x, y] of [[-2, -11], [2, -11], [-4, -7], [0, -7], [4, -7], [-2, -3], [2, -3]]) {
    g.set(x - 1, y + up - 1, BELLY[1]); g.set(x, y + up, BELLY[1]); g.set(x + 1, y + up - 1, BELLY[1]);
  }
  // 臉盤：眼睛周圍一圈淺色
  const ey = -18 + up;
  for (const ex of [-4.5, 4.5]) g.ellipse(ex, ey + 0.5, 4.3, 3.8, (nx, ny) => lightN(BELLY, nx, ny, -0.2));
  // 金框眼鏡＋鏡片反光（從左掃到右）
  const glint = wrap(t * 0.9, 1);
  for (const ex of [-4.5, 4.5]) {
    g.ellipse(ex, ey, 3.4, 3.4, (nx, ny) => GOLD[nx + ny < -0.4 ? 5 : nx + ny > 0.6 ? 2 : 4]);
    g.ellipse(ex, ey, 2.4, 2.4, blink ? BELLY[3] : LENS);
    if (blink) g.line(ex - 2, ey, ex + 1, ey, FEATHER[2]);
    else { g.set(ex, ey, EYE); g.set(ex - 1, ey, EYE); g.set(ex, ey - 1, EYE); g.set(ex - 1, ey - 1, EYE); }
    if (!blink && glint < 0.3) g.set(ex - 2 + Math.round(glint / 0.3 * 3), ey - 2 + Math.round(glint / 0.3 * 1), GOLD[6]);
  }
  g.set(-1, ey - 1, GOLD[3]); g.set(0, ey - 1, GOLD[3]);
  // 白色濃眉：外端往上翹
  for (const sgn of [-1, 1]) {
    const bx = sgn * 4.5;
    g.set(bx - sgn * 2, ey - 4, BELLY[4]); g.set(bx - sgn, ey - 4, BELLY[5]); g.set(bx, ey - 5, BELLY[5]);
    g.set(bx + sgn, ey - 5, BELLY[5]); g.set(bx + sgn * 2, ey - 6, BELLY[6]); g.set(bx + sgn * 3, ey - 7, BELLY[5]);
  }
  // 嘴
  g.set(-1, ey + 3, BEAK[4]); g.set(0, ey + 3, BEAK[3]); g.set(-1, ey + 4, BEAK[2]);
  if (say) { g.set(0, ey + 4, EYE); g.set(-1, ey + 5, BEAK[2]); }
  // 說話：右翅膀舉起來揮
  if (talk) {
    wavingWing(g, t, up);
  }
  // 魔法帽：帽簷＋往右彎、會晃的尖頂
  const hb = -25 + up;
  for (let i = 0; i < 16; i++) {
    const y = hb - 1 - i, half = 6 * (1 - i / 16.5);
    const bend = i < 8 ? 0 : Math.pow(i - 7, 1.35) * 0.55 * (1 + lag * 0.35);
    g.shade(Math.floor(-half + bend) - 1, y, Math.ceil(half + bend) + 1, y, (x) => {
      const nx = (x - bend) / Math.max(1, half);
      return Math.abs(nx) > 1 ? 0 : lightN(HAT, nx, -0.15);
    });
  }
  ball(g, 0, hb, 10, 2.6, HAT, { spec: false, bias: 0.1 });
  for (let x = -5; x <= 5; x++) { g.set(x, hb - 3, GOLD[x < -2 ? 5 : x > 2 ? 3 : 4]); g.set(x, hb - 2, GOLD[x < -2 ? 4 : 3]); }
  const tw = Math.sin(t * 3.1) > 0.7;                                              // 帽子上的小星星會閃
  const sx = 1, sy = hb - 8;
  g.set(sx, sy, GOLD[tw ? 6 : 5]); g.set(sx - 1, sy, GOLD[4]); g.set(sx + 1, sy, GOLD[4]); g.set(sx, sy - 1, GOLD[4]); g.set(sx, sy + 1, GOLD[4]);
  outline(g, FEATHER[0], FEATHER[1]);
  return { tipX: Math.pow(8, 1.35) * 0.55 * (1 + lag * 0.35), tipY: hb - 17, tw, sx, sy };
}

export function draw(p, time, o) {
  const D = meta.duration, t = wrap(time, D), g = GRID;
  g.clear();
  const h = owl(g, t, D, o.mode === "talk");
  g.draw(p);
  if (h.tw) p.glow(h.sx, h.sy, 4, GOLD[5], 0.35);
  // 魔法星點：從帽尖慢慢往上飄、淡出（特效層，不算進角色的色數）
  for (let i = 0; i < 3; i++) {
    const a = wrap(time * 0.32 + i * 0.33, 1), x = h.tipX + Math.sin(a * 5 + i * 2) * 3, y = h.tipY - 2 - a * 18;
    p.dot(x, y, GOLD[5], Math.min(1, a * 5) * (1 - a));
    p.glow(x, y, 4, GOLD[4], 0.25 * (1 - a));
  }
}
