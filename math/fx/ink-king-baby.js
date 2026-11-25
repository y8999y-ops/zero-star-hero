// 墨水大王・幼體（星芽花園的王）：一顆圓滾滾的大墨水滴，頭上插著一朵歪掉的花。
// 世界觀：墨水大王是《無解之書》的情緒，一直在鬧彆扭「反正沒有人會算完我」——所以是生氣中帶點委屈的表情，凶但可愛。
// 有兩隻小小的墨水手會揮、身體周圍一直在滴墨、坐在一大攤墨水上。面向左（朝玩家）。
// 動作：idle＝慢慢呼吸（一縮一脹）、手揮、頭上的花跟著晃、偶爾眨眼；hurt＝被打中壓扁、＞＜眼、花被打歪。
// 王 24 色以內。
//
// inkKingBabyFrame(pose, t) → { w, h, ox, oy, px, colors }（原點＝腳底中央）

import { Grid } from "./_grid.js";

export const W = 100, H = 96, OX = 50, OY = 90;
const C = {
  ink0: "#0b0816", ink1: "#16112b", ink2: "#251c45", ink3: "#3a2e6b", ink4: "#584a9a", ink5: "#8274c8",
  shine: "#d6ceff", white: "#ffffff", eye: "#16112b", iris: "#b483ff", blush: "#9a6fd6",
  pinkL: "#ffc2d4", pink: "#f27fa3", pinkD: "#b8456f", face: "#ffe27a", faceD: "#d7a43b", leaf: "#6fbf4a", leafD: "#3d7a35",
};

function shadeAt(nx, ny) {
  const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
  const d = -0.55 * nx - 0.65 * ny + 0.5 * nz;
  return d > 0.75 ? C.ink5 : d > 0.5 ? C.ink4 : d > 0.2 ? C.ink3 : d > -0.15 ? C.ink2 : C.ink1;
}

function poseOf(pose, t) {
  const D = 2.0, ph = (t % D) / D;
  if (pose === "hurt") return { s: -0.3, arm: 0.8, tilt: 0.9, hurt: true, ph, blink: false };
  return {
    s: Math.sin(ph * Math.PI * 2) * 0.06,                       // 慢慢呼吸
    arm: Math.sin(ph * Math.PI * 4) * 0.5,                       // 手揮
    tilt: Math.sin(ph * Math.PI * 2 - 1.2) * 0.25,               // 花慢半拍晃
    hurt: false, ph, blink: ph > 0.9,
  };
}

export function inkKingBabyFrame(pose = "idle", t = 0) {
  const q = poseOf(pose, t);
  const g = new Grid(W, H, OX, OY);
  const rx = 30 * (1 - q.s * 0.5), ry = 26 * (1 + q.s * 0.6);
  const by = -ry - 2, top = by - ry;

  // 一大攤墨水
  g.ellipse(0, -2, 40 - q.s * 30, 3.2, (nx, ny) => (ny < -0.3 ? C.ink3 : ny < 0.3 ? C.ink2 : C.ink1));

  // 墨水手（身體兩側，揮動）
  for (const side of [-1, 1]) {
    const ax = side * (rx + 2), ay = by + 6 - side * q.arm * 4;
    g.oval(ax, ay, 6, 4, side * (0.6 + q.arm * 0.4), (u, v) => (v < -0.2 ? C.ink4 : C.ink3));
  }

  // 身體＋往後勾的水滴尖
  g.ellipse(0, by, rx, ry, shadeAt);
  const tipH = 16, lean = 7;
  g.poly([[-rx * 0.6, by - ry * 0.55], [rx * 0.6, by - ry * 0.55], [lean + 5, top - tipH * 0.45], [lean + 6, top - tipH], [lean, top - tipH * 0.7]],
    (x, y) => shadeAt((x - lean * 0.5) / (rx * 0.75), Math.max(-1, (y - by) / (ry + tipH))));

  // 光澤：左上一道大的彎光＋幾個亮點
  // 連續的一道彎光（不是一顆一顆的點，不然像星星）
  for (let i = 0; i <= 40; i++) {
    const a = Math.PI * (1.06 + i * 0.012);
    g.set(Math.cos(a) * rx * 0.8, by + Math.sin(a) * ry * 0.8, C.shine);
    if (i > 8 && i < 32) g.set(Math.cos(a) * rx * 0.74, by + Math.sin(a) * ry * 0.74, C.ink5);
  }
  g.rect(-rx * 0.35, by - ry * 0.75, 2, 2, C.white);
  g.set(lean + 3, top - tipH * 0.55, C.shine);

  // 臉：看向左邊。大眼睛＋生氣又委屈的眉毛＋嘟嘴、一顆小虎牙
  const ey = by - 4, L = -15, R = 2;
  if (q.hurt) {
    for (const [x, k] of [[L, 0], [R, 1]]) {
      const m = (d) => (k === 0 ? x + d : x + 8 - d);
      for (let i = 0; i < 4; i++) { g.rect(m(i * 2), ey - 3 + i, 2, 2, C.white); g.rect(m(i * 2), ey + 5 - i, 2, 2, C.white); }
    }
  } else if (q.blink) {
    for (const x of [L, R]) g.rect(x, ey + 2, 10, 2, C.white);
  } else {
    for (const x of [L, R]) {
      g.ellipse(x + 5, ey + 1, 5, 6, C.white);
      g.ellipse(x + 3, ey + 2, 3.2, 4.2, C.eye);           // 眼珠靠左（看玩家）
      g.ellipse(x + 3, ey + 3, 1.6, 2, C.iris);
      g.rect(x + 1, ey - 1, 2, 2, C.white);                  // 反光
    }
  }
  // 眉毛：中間低、外面高（生氣），用最暗的墨色
  if (!q.hurt) {
    g.line(L - 1, ey - 9, L + 9, ey - 6, C.ink0); g.line(L - 1, ey - 8, L + 9, ey - 5, C.ink0);
    g.line(R + 1, ey - 6, R + 11, ey - 9, C.ink0); g.line(R + 1, ey - 5, R + 11, ey - 8, C.ink0);
  }
  // 臉頰
  g.rect(L - 2, ey + 9, 4, 2, C.blush); g.rect(R + 9, ey + 9, 4, 2, C.blush);
  // 嘴：嘟起來的小嘴（受傷時張大），右邊一顆小虎牙
  const mx = -4, my = ey + 12;
  if (q.hurt) { g.ellipse(mx + 2, my + 1, 4, 2.5, C.ink0); }
  else { g.rect(mx, my, 7, 2, C.ink0); g.rect(mx + 1, my + 2, 5, 1, C.ink0); g.set(mx + 5, my + 2, C.white); }

  // 身體周圍的墨滴（各自慢慢拉長再滴落）
  // 從身體下半邊緣往下垂的墨滴：先畫一個小鼓包，再往下拉長，最後斷掉一滴
  // 位置選在身體兩側（下面是空的），看得到墨滴垂下來、斷掉；底下那一圈會被墨水攤擋住所以不放
  [[-0.97, 0.12], [-0.86, 0.42], [0.9, 0.3], [0.97, 0.02]].forEach(([nx, ny], i) => {
    const x = Math.round(nx * rx), y = Math.round(by + ny * ry);
    const u = (q.ph * 1.5 + i * 0.29) % 1, len = 2 + Math.floor(u * 5);
    g.ellipse(x, y, 1.4, 1.4, C.ink3);
    g.rect(x - 1, y + 1, 2, len, C.ink3); g.set(x - 1, y + 1, C.ink4);
    if (u > 0.75) g.rect(x - 1, y + len + 3, 2, 2, C.ink4);
  });

  // 頭上插的歪花（插在水滴尖旁邊，跟著晃）
  // 花大一點（這是牠的招牌）；有一瓣被墨水染到、整朵歪一邊
  const fx = lean - 9, fy = top - 4, tilt = -0.45 + q.tilt;
  g.line(fx, fy + 6, fx + Math.sin(tilt) * 9, fy + 6 - 10, C.leaf);
  g.line(fx + 1, fy + 6, fx + 1 + Math.sin(tilt) * 9, fy + 6 - 10, C.leafD);
  g.oval(fx - 4, fy + 2, 4.5, 2, Math.PI + 0.6, (u, v) => (v < 0 ? C.leaf : C.leafD));
  const hx = fx + Math.sin(tilt) * 10, hy = fy - 6;
  [0, 1.2, 2.5, 3.7, 5.0].forEach((a, i) => {
    const ang = a + tilt;
    g.oval(hx + Math.cos(ang) * 6, hy + Math.sin(ang) * 6, 4.5, 2.8, ang, (u, v) => (i === 2 ? (v < 0 ? C.ink4 : C.ink3) : u < -0.2 ? C.pinkL : v > 0.3 ? C.pinkD : C.pink));
  });
  g.ellipse(hx, hy, 3.2, 3.2, (nx, ny) => (nx + ny < 0 ? C.face : C.faceD));

  g.outline();
  return g.pixels();
}
