// 苔殼龜郵差「慢慢」：高高的圓殼（受光分階＋殼上的格紋＋頂上長苔）、戴藍色郵差帽的大頭、背著郵差包。
// 照 PixelFX critters 的畫法：殼是圓頂、腳和脖子是管子、頭是一顆球。
// 動作：walk＝四隻短腳兩兩交替、殼跟著上下晃、郵差包慢一拍甩；idle＝慢慢眨眼、頭往前伸一下。
import { wrap, TAU } from "../../../pixelfx/src/core/index.js";
import { Grid } from "../../../pixelfx/src/fx/critters/_lib.js";
import { ramp, dome, ball, limb, outline, lightN } from "./_town.js";

export const meta = {
  name: "Mail turtle",
  desc: "A slow mail-carrier turtle with a mossy domed shell, a blue postman's cap and a satchel; it plods along on stubby legs, the satchel swinging a beat late.",
  tags: ["critter", "turtle", "npc", "town", "loop"],
  size: [72, 52],
  origin: [36, 46],
  duration: 1.6,
  loop: true,
  fps: 30,
  bg: "ground",
  options: { mode: "walk", seed: 1 },
};
const GRID = new Grid(-26, -36, 52, 40);
const SHELL = ramp(["#1a1608", "#3a3214", "#5a4e1e", "#7a6c2a", "#9e8e3c", "#c4b462", "#ecdc98"]);
const SKIN = ramp(["#14281a", "#2e5a36", "#4a8a50", "#6aae66", "#94d084", "#c0ecaa", "#e8ffd8"]);
const MOSS = ramp(["#0e2a16", "#1e5a34", "#2e7a40", "#3a9a48", "#5cba58", "#8ae070", "#c0f4a0"]);
const CAP = ramp(["#0e1430", "#1a2a5a", "#2a4490", "#3a62c0", "#5a8ae0", "#8ab4f4", "#d0e4ff"]);
const BAG = ramp(["#1a0e06", "#4a2a14", "#7a4a22", "#a86c36", "#d09a5a", "#ecc890", "#fff0d0"]);
const EYE = ramp(["#120c1a"])[0];

export function draw(p, time, o) {
  const g = GRID, walk = o.mode !== "idle", ph = walk ? wrap(time, 1.2) / 1.2 : 0;
  const bob = walk ? Math.round(Math.abs(Math.sin(ph * TAU)) * 1) : 0, stepA = walk ? Math.sin(ph * TAU) : 0;
  const nod = !walk ? (wrap(time, 3.2) > 2.6 ? 1 : 0) : Math.round(Math.max(0, Math.sin(ph * TAU)) * 1);
  g.clear();
  // 腳：四隻短管子，前後兩組交替抬起
  for (const [x, s] of [[-9, 1], [-3, -1], [4, 1], [10, -1]]) {
    const lift = Math.max(0, stepA * s) > 0.3 ? 1 : 0;
    limb(g, [[x, -6 - bob], [x + s * 0.5, -1 - lift]], 1.6, SKIN);
  }
  // 脖子＋頭（右邊）
  limb(g, [[11, -10 - bob], [15 + nod, -12 - bob]], 2.4, SKIN);
  ball(g, 18 + nod, -13 - bob, 4.6, 4, SKIN);
  g.set(20 + nod, -14 - bob, EYE); g.set(20 + nod, -13 - bob, EYE);
  g.set(21 + nod, -11 - bob, SKIN[1]);
  // 郵差帽：帽頂＋往前的帽簷
  g.ellipse(17.5 + nod, -17 - bob, 4.2, 2.2, (nx, ny) => lightN(CAP, nx, ny));
  for (let x = 18; x <= 23; x++) g.set(x + nod, -16 - bob, CAP[2]);
  g.set(17 + nod, -18 - bob, CAP[5]);
  // 殼：高圓頂，格紋（較暗的線）跟著圓頂彎，頂上長苔，下緣一圈殼邊
  const by = -6 - bob;
  dome(g, 0, by, 12, 13, SHELL);
  g.shade(-12, by - 13, 12, by, (x, y) => {
    const nx = x / 12, ny = (y - by) / 13;
    if (nx * nx + ny * ny > 0.9) return 0;
    const u = Math.asin(Math.max(-1, Math.min(1, nx))) * 3.2, v = ny * 3.4;
    const line = Math.abs(v - Math.round(v)) < 0.12 || (Math.abs(u + (Math.round(v) % 2) * 0.5 - Math.round(u + (Math.round(v) % 2) * 0.5)) < 0.1 && v > -3.2);
    return line ? SHELL[2] : 0;
  });
  g.shade(-8, by - 13, 8, by - 9, (x, y) => { const nx = x / 12, ny = (y - by) / 13; return nx * nx + ny * ny <= 1 && ny < -0.72 ? lightN(MOSS, nx, ny) : 0; });
  for (let x = -12; x <= 12; x++) g.set(x, by, SHELL[x < 0 ? 4 : 3]);
  for (let x = -11; x <= 11; x++) g.set(x, by + 1, SHELL[1]);
  // 郵差包（左邊，慢一拍甩）＋背帶
  const sw = walk ? Math.round(Math.sin(ph * TAU - 1.2) * 1) : 0;
  ball(g, -12 + sw, by - 3, 4.2, 3.8, BAG, { spec: false });
  g.set(-13 + sw, by - 4, BAG[5]); g.set(-12 + sw, by - 2, BAG[1]);
  g.line(-10 + sw, by - 6, 4, by - 12, BAG[2]);
  outline(g, SHELL[0], SHELL[1]);
  g.draw(p);
}
