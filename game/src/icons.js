// 自製像素圖示（16×16）：裝備、垃圾、介面按鈕。
// 每個圖示用幾行「填色」畫出來，最後自動描一圈 1px 深色外框，所以這裡只要管顏色。
// 遊戲畫面（掉落物）和 DOM 介面（背包、按鈕）共用同一份資料。
//
// 繪製規則（終極版規則v2＋參考 Kyrise 16×16 圖示包、16×16 RPG Items DB32）：
// - 物體幾乎填滿格子；光從左上來，每種材質三階：亮（左上）、中、暗（右下）
// - 斜線只用 45°（1-1 階梯）；斜的部件至少 2px 寬，不然外框會變成鋸齒
// - 細節用色塊表現，不在裡面畫黑線；不抖色、不半透明
// 檢查：node game/tools/preview.mjs icons out.png 會畫出總表並列出違規（腫塊、雙層邊、孤立點）

import { UI_ICONS } from "./ui-icons.js";
export const PAL = {
  k: "#14101c",
  // 鋼：亮 → 暗
  w: "#f4f4ff", s: "#c0c6e0", S: "#7e86a8", d: "#474d6b",
  // 金
  h: "#fff2a8", g: "#ffc83a", G: "#c07c18", H: "#6e3c10",
  // 木頭／皮革
  l: "#e8b478", b: "#b07240", B: "#6e4224", j: "#3e2414",
  // 紅
  r: "#ff6a50", R: "#c02c34", q: "#6a1424",
  // 藍
  c: "#7ab0ff", C: "#3a64c8", n: "#1e3070",
  // 綠
  e: "#8ae070", E: "#3a9a48", m: "#1e5a34",
  // 布／骨頭
  y: "#f4ecd0", Y: "#c8b890", z: "#8a7a5a",
  // 橘
  o: "#ffa040", O: "#d0601c", Q: "#7a2e10",
  // 紫
  p: "#c890ff", P: "#8040d0", x: "#40207a",
  // 青（寶特瓶）
  t: "#80e0d8", T: "#2a9a9a", u: "#145a64",
};

const N = 16;
function painter() {
  const g = Array.from({ length: N * N }, () => null);
  const px = (x, y, c) => { if (x >= 0 && y >= 0 && x < N && y < N) g[y * N + x] = c; };
  return {
    g,
    px,
    rect(x0, y0, x1, y1, c) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px(x, y, c); },
    /** 45° 的帶子：每往下一列，往 dir 方向移一格；cols 是橫切面從左到右的顏色。 */
    band(x, y, len, cols, dir = -1) {
      for (let k = 0; k < len; k++) cols.forEach((c, j) => c !== "." && px(x + dir * k + j, y + k, c));
    },
    /** 用字元畫：每個字元是 PAL 的一個顏色，「.」不畫。 */
    art(x, y, rows) { rows.forEach((row, j) => [...row].forEach((ch, i) => ch !== "." && px(x + i, y + j, ch))); },
  };
}

// ---- 星核（寶石）的四種切法。1 亮（左上）、2 中、3 暗（右下）、4 最暗，w 白色高光；中間一顆十字小星光＝星核在發光
// 參考：Kyrise 16×16、DB32 RPG Items 的寶石（面分明、左上亮右下暗、白色高光點）、PixelFX pickups/gem-spin 與 crystal-shard、
// Clip Studio「Coloring Gems and Crystals」（面朝光最亮、稜線分面）。
const GEM = {
  round: [   // 圓形切割（12×12）
    "....1112....",
    "..11111222..",
    ".11w112222 .",
    ".1w1122222 .",
    "11112w2223 3",
    "1112www2233.",
    "122222w2233.",
    "1222222223 4",
    ".22222222 4.",
    ".322222233 .",
    "..33333334..",
    "....3444....",
  ],
  sharp: [   // 菱形（11×11），45° 邊
    ".....1.....",
    "....112....",
    "...11122...",
    "..1w11222..",
    ".1w112w222.",
    "11112www223",
    ".2222w2223.",
    "..2222233..",
    "...22333...",
    "....334....",
    ".....4.....",
  ],
  tall: [    // 長六角（8×13）
    "...12...",
    "..1122..",
    ".111222.",
    "11w12223",
    "1w112223",
    "1112w223",
    "112www23",
    "1112w223",
    "12222223",
    "12222233",
    ".222233.",
    "..2333..",
    "...34...",
  ],
  square: [  // 方形墊切（12×11）
    "..11111222..",
    ".11w111222 .",
    "11w11112222 ",
    "111112w22223",
    "11112www2223",
    "112222w22233",
    "122222222233",
    "122222222333",
    "222222222334",
    ".3222222334.",
    "..33333444..",
  ],
};
function gem(p, shape, x, y, [c1, c2, c3, c4]) {
  const map = { 1: c1, 2: c2, 3: c3, 4: c4, w: "w" };
  p.art(x, y, GEM[shape].map((r) => [...r].map((ch) => (ch === " " ? c3 : map[ch] ?? ".")).join("")));
}

// 劍：刀身從右上斜到左下，護手和刀身垂直
function swordShape(p, { blade = ["w", "s", "S"], len = 8, guard = ["g", "G"], gl = 5, grip = 3 } = {}) {
  const w = blade.length, top = 2;
  p.band(15 - w, top, len, blade);
  p.px(14 - w + 2, top - 1, blade[0]); p.px(15 - w + 2, top - 1, blade[1]); // 刀尖
  const by = top + len;                     // 刀身下一列
  const bx = 15 - w - len + 1;              // 刀身最後一列的最左格
  const gh = (gl - 1) >> 1;
  p.band(bx - gh, by - gh - 1, gl, guard, 1); // 護手（和刀身垂直）
  p.band(bx - 1, by, grip, ["b", "B"]);       // 握把
  p.px(bx - grip - 1, by + grip, "g"); p.px(bx - grip, by + grip, "G"); // 柄頭
}

const DRAW = {
  // ---- 星核：每種一個顏色＋切法
  core_rust(p) { gem(p, "round", 2, 2, ["o", "O", "Q", "j"]); },
  core_dawn(p) { gem(p, "round", 2, 2, ["h", "g", "G", "H"]); },
  core_heavy(p) { gem(p, "square", 2, 3, ["s", "S", "d", "n"]); },
  core_meteor(p) { gem(p, "square", 2, 3, ["p", "P", "x", "n"]); },
  core_sharp(p) { gem(p, "sharp", 3, 3, ["r", "R", "q", "x"]); },
  core_shadow(p) { gem(p, "sharp", 3, 3, ["P", "x", "n", "k"]); },
  core_long(p) { gem(p, "tall", 4, 2, ["t", "T", "u", "n"]); },
  core_comet(p) { gem(p, "tall", 4, 2, ["c", "C", "n", "x"]); },
  core_dull(p) { gem(p, "square", 2, 3, ["e", "E", "m", "j"]); },
  core_rock(p) { gem(p, "square", 2, 3, ["y", "Y", "z", "j"]); },
  // 很吵的星核（傳說）：金色寶石張著嘴在講話
  core_noisy(p) {
    gem(p, "round", 2, 2, ["h", "g", "G", "H"]);
    p.art(5, 6, ["n...n.", "......", ".qqqq.", ".qrrq."]);
  },
  // ---- 魔物核：圓的核心，帶著那種魔物的特徵
  core_slime(p) {
    gem(p, "round", 2, 1, ["e", "E", "m", "m"]);
    p.art(6, 5, ["n..n"]);
    p.px(7, 13, "E"); p.px(7, 14, "m"); p.px(9, 13, "m");   // 從底下往下滴
  },
  core_bat(p) {
    gem(p, "round", 2, 2, ["p", "P", "x", "x"]);
    p.art(6, 6, ["r..r"]);                      // 紅眼睛
    // 兩側小翅膀（翼膜＋下緣缺口）
    p.art(0, 5, [".x", "xP", "xP", "x.", ".x"]);
    p.art(14, 5, ["x.", "Px", "Px", ".x", "x."]);
  },
  core_can(p) {
    gem(p, "round", 2, 2, ["s", "S", "d", "n"]);
    p.rect(3, 5, 12, 5, "w");   // 罐蓋的亮邊
    p.rect(3, 6, 12, 6, "d");
    p.art(6, 4, ["h..h"]);       // 縫裡偷看的眼睛
    p.px(10, 10, "O"); p.px(11, 10, "Q");
  },
  // 回城按鈕：小房子（屋頂、煙囪、亮著的窗）
  home(p) {
    p.art(1, 2, [
      ".........RR...",
      "......rr.RR...",
      ".....rrrrRR...",
      "....rrrrrrR...",
      "...rrrrrrrrR..",
      "..rrrrrrrrrRR.",
      ".rRRRRRRRRRRRq",
      "..llllllllbB..",
      "..llhhllbbbB..",
      "..llhhllbjjB..",
      "..lllllbbjjB..",
      "..bbbbbbbjjB..",
    ]);
  },
  // ---- 空欄位的剪影：星冠（皇冠）、碎片（水晶碎片）
  crown(p) {
    p.art(1, 4, [
      ".h....h....h.",
      ".hg..hgG..gG.",
      ".hgggggggggG.",
      ".hgrgggCgggG.",
      ".hgggggggggG.",
      ".GGGGGGGGGGH.",
    ]);
  },
  shard(p) {
    p.art(4, 2, [
      ".....tT",
      "....ttT",
      "...twTT",
      "..ttTTu",
      "..ttTTu",
      ".twtTTu",
      ".ttTTuu",
      "ttTTTu.",
      "ttTTuu.",
      "tTTuu..",
      "TTuu...",
      ".uu....",
    ]);
  },
  // ---- 武器
  sword(p) { swordShape(p); },
  greatsword(p) { swordShape(p, { blade: ["w", "s", "S", "d"], len: 9, gl: 7, grip: 2 }); },
  dagger(p) {
    // 短刀身、長握把
    p.band(11, 4, 4, ["w", "s", "S"]);
    p.px(12, 3, "w"); p.px(13, 3, "s");
    p.band(5, 5, 5, ["g", "G"], 1);
    p.band(7, 9, 4, ["b", "B"]);
    p.px(3, 13, "g"); p.px(4, 13, "G");
  },
  spear(p) {
    p.art(9, 1, [
      "....ws",
      "...wsS",
      "..wsSd",
      ".wsSd.",
      ".sSd..",
    ]);
    p.band(9, 6, 8, ["b", "B"]);
    p.px(11, 6, "r"); p.px(11, 7, "R"); p.px(12, 7, "R");
  },
  hammer(p) {
    p.art(2, 1, [
      "wwssssssssss",
      "wssssssssssS",
      "sSSSSSSSSSSd",
      "sSSSSSSSSSSd",
      "SddddddddddD",
    ].map((r) => r.replace(/D/g, "d")));
    p.px(4, 3, "w");
    p.rect(7, 6, 7, 14, "b");
    p.rect(8, 6, 8, 14, "B");
    p.rect(7, 10, 8, 11, "j");
  },
  noisysword(p) {
    swordShape(p, { blade: ["p", "s", "S"] });
    p.px(10, 5, "x"); p.px(11, 5, "x");   // 嘴巴
    p.px(12, 3, "P");                     // 眼睛
  },
  // ---- 頭
  bucket(p) {
    p.art(1, 2, [
      "....SSSSSS....",
      "...S......S...",
      "wsssssssssssSd",
      "sSSSSSSSSSSSdd",
      ".sSSSSSSSSSdd.",
      ".sSSSOSSSSSdd.",
      ".sSSSOOSSSSdd.",
      "..sSSSSSSSdd..",
      "..sSSSSSSSdd..",
      "..SSSSSSSddd..",
      "...dddddddd...",
    ]);
  },
  cap(p) {
    p.art(1, 3, [
      ".....llll.....",
      "...llllllbb...",
      "..llbbbbbbbB..",
      "..lbbbbbbbbB..",
      "..bbbbbbbbbB..",
      "..RRRRRRRRRq..",
      "lllbbbbbbbbbBB",
      ".BBBBBBBBBBBj.",
    ]);
  },
  helm(p) {
    p.art(2, 1, [
      "....wsss....",
      "..wssssSSS..",
      ".wsSSSSSSSd.",
      ".sSSSSSSSSd.",
      ".sSSSSSSSSd.",
      ".sSSSSSSSSd.",
      ".skkkkkkkkd.",
      ".sSSSdSSSSd.",
      ".sSSSdSSSdd.",
      ".SSSSdSSSdd.",
      "..dddddddd..",
    ]);
  },
  hardhat(p) {
    p.art(1, 3, [
      ".....hhgg.....",
      "...hhggggGG...",
      "..hggggggggG..",
      "..gggOOggggG..",
      "..ggOOOOgggG..",
      "..gggOOggggG..",
      ".GGGGGGGGGGGG.",
      "hgggggggggggGH",
      ".HHHHHHHHHHHH.",
    ]);
  },
  // ---- 身體
  shirt(p) {
    p.art(1, 2, [
      "..yyyY..Yyyy..",
      ".yyyyyYYyyyyY.",
      "yyyyyyyyyyyyYY",
      "yyYyyyyyyyyYzz",
      "..YyyyyyyyyY..",
      "..YyyyyyyyyY..",
      "..YyyyyYyyyY..",
      "..YyyyyyyyYz..",
      "..YyyyyyyyYz..",
      "..zzzzzzzzzz..",
    ]);
  },
  vest(p) {
    p.art(1, 2, [
      "..bllb..blll..",
      ".bllllbBlllbB.",
      "blllllbBllllBB",
      "blbllllBlllbBj",
      "..bllllBlllB..",
      "..bgllbBlllB..",
      "..bllllBlllB..",
      "..BBBBBBBBBB..",
      "..bllllBlllB..",
      "..BBBBBjBBBB..",
    ]);
  },
  mail(p) {
    p.art(1, 2, [
      "..sSSs..sSSs..",
      ".sSsSsSSsSsSd.",
      "sSsSdSsSdSsSdd",
      "sSdSsSdSsSdSdd",
      "..SsSdSsSdSd..",
      "..sSdSsSdSsd..",
      "..SsSdSsSdSd..",
      "..hggggggggG..",
      "..SsSdSsSdSd..",
      "..dddddddddd..",
    ]);
  },
  // ---- 手
  glove(p) {
    p.art(2, 1, [
      "...yY.yY.yY..",
      "...yY.yY.yY..",
      "...yYyyYyyY..",
      ".yYyyyyyyyY..",
      ".yyyyyyyyyY..",
      "..yyyyyyyyY..",
      "..yyyyyyyYz..",
      "...yyyyyYz...",
      "...cccccCn...",
      "...cccccCn...",
      "...CCCCCnn...",
    ]);
  },
  gauntlet(p) {
    p.art(2, 1, [
      "...lb.lb.lb..",
      "...lb.lb.lb..",
      "...lbllbllb..",
      ".lblllllllb..",
      ".llllllllbB..",
      "..lllllllbB..",
      "..llllllbBB..",
      "...hggggggG..",
      "...bbbbbbbB..",
      "...lblblblB..",
      "...BBBBBBBj..",
    ]);
  },
  // ---- 腳：藍白拖（俯視）
  slipper(p) { slipperShape(p, "y", "Y", "c", "C"); },
  goldslipper(p) { slipperShape(p, "h", "G", "o", "O"); p.px(5, 4, "w"); },
  boot(p) {
    p.art(3, 1, [
      ".lbbbbB...",
      ".lbbbbB...",
      ".lbgbbB...",
      ".lbbbbB...",
      ".lbbbbB...",
      ".lbbbbB...",
      ".lbbbbBB..",
      ".lbbbbbBB.",
      "lbbbbbbbBB",
      "lbbbbbbbbB",
      "jjjjjjjjjj",
    ]);
  },
  ironboot(p) {
    p.art(3, 1, [
      ".wsssSd...",
      ".sSSSSd...",
      ".dddddd...",
      ".sSSSSd...",
      ".sSSSSd...",
      ".sSSSSd...",
      ".sSSSSdd..",
      ".sSSSSSdd.",
      "wsSSSSSSdd",
      "sSSSSSSSSd",
      "dddddddddd",
    ]);
  },
  // ---- 飾品
  pulltab(p) {
    p.art(3, 1, [
      "..ssssss..",
      ".sS....Sd.",
      ".s......d.",
      ".sS....Sd.",
      "..sSSSdd..",
      "...sSSd...",
      "..sSddSd..",
      ".sS....Sd.",
      ".s......d.",
      ".sS....Sd.",
      "..sSSSdd..",
    ]);
  },
  ring(p) {
    p.art(3, 1, [
      "....rr....",
      "...rrRR...",
      "...RRRq...",
      "..hggggG..",
      ".hgG..GgG.",
      ".gG....GG.",
      ".gG....GH.",
      ".gG....GH.",
      ".GgG..GGH.",
      "..GGGGHH..",
    ]);
  },
  amulet(p) {
    // 鍊子用 2px 寬的 45° 帶子
    p.band(2, 1, 5, ["Y", "z"], 1);
    p.band(12, 1, 5, ["Y", "z"], -1);
    p.art(4, 6, [
      "...hg...",
      "..hggG..",
      ".gpppPG.",
      ".gpwpPG.",
      ".gpPPxG.",
      "..GPxG..",
      "...GG...",
    ]);
  },
  paper(p) {
    p.art(2, 1, [
      "yyyyyyyyyY..",
      "yzzzzzzzyY..",
      "yyyyyyyyyY..",
      "yzzzzzyyyY..",
      "yyyyyyyyyY..",
      "yzzzzzzzyY..",
      "yyyyyyyyyY..",
      "yzzzyyyyyY..",
      "yyyyyrrryY..",
      "yyyyrRRRrY..",
      "yyyyrRRRrY..",
      "yyyyyrrryY..",
      "YYYYYYYYYY..",
    ]);
  },
  // ---- 垃圾
  fishbone(p) {
    p.art(1, 3, [
      "..y.y.y.y...yy",
      "..y.y.y.y..yyY",
      "yyyyyyyyyyyyyY",
      "..Y.Y.Y.Y..YYY",
      "..Y.Y.Y.Y...YY",
    ]);
    p.px(13, 4, "k");
  },
  bottle(p) {
    // 空藥水瓶（使用者 2026-11-06：寶特瓶改成異世界的空藥水瓶）：軟木塞、瓶頸、圓肚。
    //   空的＝裡面是透出去的暗灰（不上藥水色），玻璃邊淡青、左上兩道白反光；瓶底剩一小灘綠色殘渣
    p.art(2, 1, [
      ".....bbB....",
      ".....lbB....",
      "....tttT....",
      ".....tdT....",
      ".....tdT....",
      "...ttdddT...",
      "..tdddddTT..",
      ".tdwddddddT.",
      ".twdddddddT.",
      ".twdddddddT.",
      ".tdddddddTT.",
      ".tddddddddT.",
      "..TdEeEEdT..",
      "...TTTTTT...",
    ]);
  },
  sock(p) {
    p.art(3, 1, [
      ".yyyyY...",
      ".RRRRq...",
      ".yyyyY...",
      ".RRRRq...",
      ".yyyyY...",
      ".yyyyY...",
      ".yyyyYY..",
      ".yyyyyYY.",
      ".yyyyyyYz",
      ".yyyyyyYz",
      "..yY.yyYz",
      "..YY.zzz.",
    ]);
  },
  chopsticks(p) {
    // 斷掉的練習魔杖（取代免洗筷）：45° 木杖斷成兩截、明顯錯開（下半截往左下掉）；斷口是淺色木刺；上半截頂端藍寶石
    p.art(11, 1, [".cc", "cwC", "cCn"]);
    p.band(11, 4, 4, ["l", "b"]);
    p.art(7, 7, ["yy"]);
    p.art(5, 9, ["yl", ".lb"]);
    p.band(4, 11, 4, ["l", "b"]);
  },
  bento(p) {
    // 發霉的乾糧（取代便當）：一條圓頂長麵包（頂亮、側暗、底最暗），頂上三道深色割紋；灰綠色毛毛的霉斑
    p.art(1, 3, [
      "....llllll....",
      "..llllllllll..",
      ".llBllBllBllb.",
      "lllBbllBEelBbb",
      "llllllllEmlbbb",
      "lYeelllllllbbB",
      "bbemEbbbbbbbBB",
      "Bbbmbbbbbbbbbj",
      ".BBBBBBBBBBBj.",
    ]);
  },
  scrap(p) {
    // 齒輪：拆解得到的碎屑
    p.art(2, 2, [
      "....wsSd....",
      ".ws.sSSd.Sd.",
      ".sSSSSSSSSd.",
      "..SSSddSSd..",
      "wsSSd..dSSdd",
      "sSSd....dSdd",
      "sSSd....dSdd",
      "wsSSd..dSSdd",
      "..SSSddSSd..",
      ".sSSSSSSSdd.",
      ".Sd.SSSd.dd.",
      "....Sddd....",
    ]);
  },
  // ---- 介面
  bag(p) {
    p.art(2, 1, [
      "....BBBB....",
      "...B....B...",
      "...BbbbbB...",
      "..lbBBBBbb..",
      ".llbbggbbbB.",
      "llbbbGGbbbBB",
      "lbbbbbbbbbBB",
      "lbbbbbbbbbBB",
      "lbbbbbbbbBBj",
      "lbbbbbbbBBBj",
      ".bbbbbbBBBj.",
      "..jjjjjjjj..",
    ]);
  },
  coin(p) {
    p.art(3, 2, [
      "...hhgg...",
      "..hgggGG..",
      ".hghGGgGG.",
      ".ggggGgGH.",
      ".ggggGgGH.",
      ".gggGGgGH.",
      ".GggGGgGH.",
      "..GGGGGH..",
      "...HHHH...",
    ]);
  },
  heart(p) {
    p.art(1, 3, [
      ".rrr...rrRR...",
      "rrwrr.rrrRRq..",
      "rwrrrrrrrRRq..",
      "rrrrrrrrRRRq..",
      ".rrrrrrRRRq...",
      "..rrrrRRRq....",
      "...rrRRRq.....",
      "....RRqq......",
      ".....qq.......",
    ].map((r) => r.padEnd(14, ".")));
  },
  fire(p) {
    p.art(3, 1, [
      ".....o....",
      "....oo....",
      "...ooo..o.",
      "..oooOo.oo",
      ".oohoooooo",
      ".ohhoooOoo",
      "oohhhooOoO",
      "ohhwhhoOoO",
      "ohwwwhhooO",
      "ohhwwhhoOQ",
      ".ohhhhooOQ",
      "..QQQQQQQ.",
    ]);
  },
  dash(p) {
    p.art(1, 3, [
      "........ccc...",
      "......ccwccC..",
      "ccccc.cwcccCn.",
      ".......cccccn.",
      ".cccccc.cccCn.",
      ".......ccCCn..",
      "..cccc..cCn...",
      "........nn....",
    ]);
  },
  close(p) {
    p.band(2, 2, 11, ["r", "R"], 1);
    p.band(12, 2, 11, ["r", "R"], -1);
  },
  star(p) {
    p.art(1, 1, [
      "......hg......",
      ".....hggG.....",
      ".....hwgG.....",
      "hhhhhhwggGGGG.",
      ".hggggggggGG..",
      "..hgggggggG...",
      "...gggggGG....",
      "..ggGG..GGG...",
      ".ggG.....GGH..",
      ".gH.......HH..",
    ]);
  },
  sort(p) {
    // 三條長短不同的橫條，中間隔一格（共用一條外框），隔兩格外框會黏成一整塊
    p.rect(2, 3, 13, 4, "s");
    p.rect(2, 6, 10, 7, "s");
    p.rect(2, 9, 7, 10, "s");
    p.rect(2, 4, 13, 4, "S"); p.rect(2, 7, 10, 7, "S"); p.rect(2, 10, 7, 10, "S");
  },
};

// 藍白拖（俯視）：白色鞋底、藍色帶子
function slipperShape(p, a, A, c, C) {
  p.art(3, 1, [
    "...aaaa...",
    "..aaaaaA..",
    ".ccccccCC.",
    ".cwccccCC.",
    ".ccccccCC.",
    ".aaaaaaAA.",
    ".aaaaaaAA.",
    "..aaaaAA..",
    "..aaaaA...",
    "..aaaaA...",
    "..aaaaA...",
    ".aaaaaAA..",
    ".aaaaaAA..",
    "..AAAAA...",
  ].map((r) => r.replace(/a/g, a).replace(/A/g, A).replace(/c/g, c).replace(/C/g, C)));
}

function outline(g) {
  const out = g.slice();
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (g[y * N + x]) continue;
    const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
      const X = x + dx, Y = y + dy;
      return X >= 0 && Y >= 0 && X < N && Y < N && g[Y * N + X] && g[Y * N + X] !== "k";
    });
    if (near) out[y * N + x] = "k";
  }
  return out;
}

/** 所有圖示：name → 256 格，每格是顏色字串或 null。 */
export const ICONS = {};
for (const [name, fn] of Object.entries(DRAW)) {
  const p = painter();
  fn(p);
  ICONS[name] = outline(p.g).map((ch) => (ch ? PAL[ch] : null));
}
// 介面圖示（照 pixelfx skill 重畫的那一批）蓋過同名的舊圖示
for (const [name, px] of Object.entries(UI_ICONS)) ICONS[name] = px;
export const ICON_SIZE = N;
