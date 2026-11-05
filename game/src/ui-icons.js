// UI 圖示（2026-11-05，照 pixelfx skill 的畫→看→修重畫，三輪）：16×16、左上光、每種顏色 5 階硬邊、
// 選擇性外框（外框顏色＝旁邊那塊顏色的最暗一階）、一顆白色高光。草稿與預覽：game/tools/drafts/ui-icons.mjs
const remap = (rows, map) => rows.map((r) => [...r].map((c) => (c === "." ? "." : map[c] ?? c)).join(""));
export const ICON_DEFS = {
  xp: { ox: 1, oy: 1, rows: [
    "......q......", "......q......", ".....pqr.....", ".....pqr.....", "....ppqrr....", "..pppaaqrrr..",
    "qqqpaaaaqrrss", "..qqqaqrrrs..", "....qqrrs....", ".....qrs.....", ".....rrs.....", "......s......", "......s......",
  ] },
  q_kill: { ox: 1, oy: 2, rows: remap([
    "ws..........sw", ".wS........Sw.", "..wS......Sw..", "...wS....Sw...", "....wS..Sw....", ".....wSSw.....",
    "......SS......", ".....sSSs.....", "..gGsS..SsgG..", "..Gg......gG..", ".gbG......Gbg.", "gb..........bg",
  ], { w: "a", s: "b", S: "c", g: "H", G: "J", b: "w" }) },
  q_junk: { ox: 3, oy: 1, rows: [
    "...nmmn...", "....xw....", "...mlln...", "..mkllmn..", ".mkkllmmn.", "mlkllllmmn", "mllllllmmn", "mlllllmmnn",
    "mmllllmmnn", ".mmmmmmnn.", "..nnnnnn..",
  ] },
  q_clear: { ox: 2, oy: 1, rows: remap([
    "y.........", "yrrrrr....", "yrwrrrRR..", "yrrrrrRRR.", "yrrrrRRRq.", "yrRRRq....", "y.........", "y.........",
    "Y.........", "Y.........", "Y.........", "zzz.......",
  ], { y: "B", r: "g", w: "f", R: "h", q: "i", Y: "C", z: "D" }) },
  guild: { ox: 1, oy: 1, rows: remap([
    "..hgggggggG...", ".hgrrrrrrrrG..", ".grrrrhrrrRG..", ".grrrhhhrrRG..", ".grhhhhhhhRG..", ".grrhhhhhRRG..",
    ".grrhhRhhRRG..", ".gRrhRRRhRRG..", "..gRRRRRRRG...", "..gGRRRRRGG...", "...gGRRRGG....", "....gGGGG.....", ".....GGG......",
  ], { h: "H", g: "I", G: "J", r: "g", R: "h" }) },
  anvil: { ox: 1, oy: 1, rows: [
    "......G.......", ".....GaG..H...", "......G..HaH..", "..........H...", "aabbbbbbbbbbc.", ".aabbbbbbbbccd",
    "...cbbbbbbccd.", ".....cccccdd..", ".....bcccccd..", "....bbcccccdd.", "...ddddddddddd",
  ] },
  bowl: { ox: 1, oy: 1, rows: [
    "...a....a.....", "...ba...ba....", "....b....b....", "...ab...ab....", "...b....b.....", "AAAAAAAAAAABC.",
    "AIIIHIIIIIJBC.", ".AJJJJJJJJBC..", ".ABBBBBBBBCD..", "..BCCCCCCCD...", "...DDDDDDD....", "....CCCCC.....",
  ] },
  stew: { ox: 1, oy: 1, rows: [
    "..a....a......", "..ba...ba.....", "...b....b.....", "..ab...ab.....", "wwwwwwwwwwwwx.", "wJJHIJJJIJJxx.",
    "xwJIIJJJJJIwx.", ".wJJJJHIJJJx..", ".xwwwwwwwwwx..", "..xxxxxxxxx...", "...yyyyyyy....",
  ] },
  soup: { ox: 1, oy: 1, rows: [
    "....ggh.......", "...gaghh......", "...gghhh......", ".....A........", "AAAAAAAAAAABC.", "ABBgBBBBBBgBC.",
    ".ABBBBBBBBBCD.", ".BCCCCCCCCCDD.", "..CCCCCCCCDD..", "...DDDDDDDD...",
  ] },
  pie: { ox: 1, oy: 2, rows: [
    "...........uu.", ".........uuvv.", ".......uuvfgw.", ".....uufgvvvw.", "...uuvvvvfgww.", ".uufgvvvvvvwx.",
    "uvvvvvfgvvvwx.", "fgggfgggfgghx.", "vwwwwwwwwwwxx.", ".xxxxxxxxxxxy.",
  ] },
  moon: { ox: 1, oy: 1, rows: [
    "..........G...", ".........GaG..", "....HH....G...", "..HHI.........", ".HHI..........", ".HI...........",
    "HHI...........", "HHI.......HH..", "HHII.....HHI..", ".HIIJJJJHHI...", ".HHIIIIJII....", "..HHHIIII.....",
  ] },
  dice: { ox: 2, oy: 2, rows: remap([
    "..wwwwwww.", ".wssssssSd", "wsksssskSd", "wssssssSSd", "wssskssSSd", "wssssssSSd", "wsksssskSd", "wssssssSSd",
    ".SSSSSSSd.", "..dddddd..",
  ], { w: "a", s: "b", S: "c", d: "d", k: "e" }) },
  hammer: { ox: 1, oy: 1, rows: remap([
    "...wsss.......", "..wsssSd......", ".wsssSSdd.....", ".ssSSSddd.....", "..SSddd.l.....", "...dd...lb....",
    ".........lb...", "..........lb..", "...........lb.", "............bB",
  ], { w: "a", s: "b", S: "c", d: "d", l: "v", b: "w", B: "x" }) },
  check: { ox: 1, oy: 2, rows: remap([
    "...........ee.", "..........eeE.", ".........eeE..", "ee......eeE...", "eEe....eeE....", ".eEe..eeE.....",
    "..eEeeeE......", "...eEeE.......", "....eE........",
  ], { e: "l", E: "m" }) },
  seal: { ox: 2, oy: 1, rows: [
    "...IIII...", ".IIJHHJII.", ".IJHIIJJI.", "IJHIggIJJI", "IJIggggIJI", "IJIgghhIJI", "IJJIhhIJJI", ".IJJJJJJI.",
    ".IIJJJJII.", "...IIII...", "..gh..hg..", ".gh....hi.", ".h......i.",
  ] },
  close: { ox: 2, oy: 2, rows: [
    "fg........gh", "gfg......ggh", ".gfg....ggh.", "..gfg..ggh..", "...gfgggh...", "....gggh....",
    "....gghh....", "...gghhhh...", "..gghh.hhh..", ".gghh...hhi.", "gghh.....hhi", "ghh.......hi",
  ] },
  // 星塵（2026-11-05 強化改版：拆解得到的材料，取代舊的齒輪碎屑）：一顆十字星＋一顆小閃光＋一小堆會發光的紫色星砂
  scrap: { ox: 1, oy: 2, rows: [
    "....p.........", "....p......a..", "...pqr....aba.", ".ppqaqrr...a..", "...rqr........", "....r.........",
    "..............", ".....L........", "....MLqMN.....", "..MaLMMqNNO...", ".MLLMqLNaNOO..", "MMNqNNNNOOqOO.",
  ] },
  // ---- 屬性圖示（2026-11-05 裝備改版第 1 批）：背包數值列、裝備說明用
  st_atk: { ox: 2, oy: 2, rows: [
    "..........ab", ".........abc", "........abc.", ".......abc..", "......abc...", ".....abc....",
    ".G..abc.....", "..HIbc......", "..wHIJ......", ".wx..J......", "wx..........", "I...........",
  ] },
  st_hp: { ox: 2, oy: 3, rows: [
    ".ggg...ggh.", "gafgg.ggghh", "gffgggggghh", "gggggggghhh", ".ggggggghh.", "..ggggghh..", "...ggghh...", "....ghh....", ".....h.....",
  ] },
  st_def: { ox: 3, oy: 2, rows: [
    "bbbbbbbbbc", "baabbbbbcd", "babbqbbbcd", "babqpqbbcd", "baqpppqbcd", "babqpqbbcd", ".babqbbcd.", ".bbbbbccd.", "..bbbccd..", "...bccd...", "....cd....",
  ] },
  st_crit: { ox: 2, oy: 2, rows: [
    ".....g.....", "...hhghh...", "..h..g..h..", ".h.......h.", ".h.......h.", "ggg..f..ggg", ".h.......h.", ".h.......h.", "..h..g..h..", "...hhghh...", ".....g.....",
  ] },
  st_critDmg: { ox: 2, oy: 2, rows: [
    ".....G.....", ".G..GHG..G.", "..GGHHHII..", "..GHgfgHI..", ".GHgffggIJ.", "GHHgfgggIJJ", ".GIgggghIJ.", "..IIhhhIJ..", "..IIJJIJJ..", ".I..JIJ..J.", ".....J.....",
  ] },
  st_skill: { ox: 2, oy: 1, rows: [
    "..........a.", "....MMMM.aaa", "..MLLMMMNNa.", "..LaLMMMNN..", ".MLLMaMMNNO.", ".MMMaaaMNNO.", ".MMMMaMNNOO.", ".NMMMNNNOOO.", "..NNNNNOOO..", "..ONNOOOOO..", "....OOOO....",
  ] },
  st_ult: { ox: 2, oy: 2, rows: [
    ".....G.....", ".....G.....", "....GHH....", "....GHI....", "GGGGGHIIIIJ", ".GHHHHIIIJ.", "..HHHHIIJ..", "..HHHJIIJ..", ".HHJ...IIJ.", ".HJ.....IJ.",
  ] },
  st_charge: { ox: 4, oy: 2, rows: [
    "......pq", ".....pqr", "....pqr.", "...pqr..", "..pqqqqr", ".pqqqqr.", "....qr..", "...qr...", "..qr....", ".qr.....", "qr......",
  ] },
  st_cdr: { ox: 3, oy: 2, rows: [
    "uuuuuuuuuu", ".A......D.", ".Apppppq D".replace(" ", ""), "..Apppq D.".replace(" ", ""), "...ApqD...", "....AD....", "...A.pD...", "..A..q.D..", ".A.pppq.D.", ".AppppqqD.", "wwwwwwwwww",
  ] },
  st_leech: { ox: 4, oy: 2, rows: [
    "...h....", "...h....", "..hhi...", "..ghi...", ".gahhi..", ".ghhhii.", "ghhhhiij", "hghhhiij", "hhhhiiij", ".hhiiij.", "..ijjj..",
  ] },
  st_move: { ox: 1, oy: 3, rows: [
    ".......uuuv...", ".......xxxx...", "aab....uvw....", ".abb...uvw....", "aaabb..uvw....", ".aabbbuuvwwv..", "...bbbuvvvwwwx", "......uvvvvwwx", "......yyyyyyyy",
  ] },
  st_mf: { ox: 2, oy: 2, rows: [
    "..kkl..kll..", ".kkllm.klmm.", ".klllmklmmm.", "..lllmmmmm..", "...llmmmn...", ".kkllm.mmmn.", "klllmm.mmnnn", ".llmm...mnn.", "..m.....n...", ".....m......", "....m.......",
  ] },
};

const N = 16;
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
// 色階：每個字母一個顏色，同一列是同一個色系（亮→暗）；外框用該色系最暗的一階
export const RAMPS = {
  gold: ["#fff6c8", "#ffe27a", "#f4b02a", "#c8761a", "#7a3a10"],
  silver: ["#ffffff", "#d8e0f0", "#9aa6c0", "#5e6a86", "#2e3248"],
  red: ["#ffc0b0", "#ff6a52", "#d42e36", "#8a1a2a", "#4a0a18"],
  green: ["#e0ffb8", "#8ae060", "#3aa848", "#1e6a34", "#0c3420"],
  cyan: ["#f0ffff", "#9af0ff", "#3ab8f0", "#1e64b0", "#0c2a60"],
  brown: ["#ffe0b0", "#e0a060", "#a8642c", "#683818", "#381c0c"],
  cream: ["#fffaf0", "#f0e2c4", "#c8b08a", "#8a7454", "#4a3a28"],
  purple: ["#e8d0ff", "#b08af0", "#7a4ad0", "#4a2a8a", "#24124a"],
  pink: ["#ffe0f0", "#ff9ad0", "#e05aa0", "#9a2a6a", "#4a0e34"],
};
// 字元 → [色系, 第幾階]
const CH = {};
const LET = { gold: "GHIJK", silver: "abcde", red: "fghij", green: "klmno", cyan: "pqrst", brown: "uvwxy", cream: "ABCDE", purple: "LMNOP", pink: "QRSTU" };
for (const [ramp, ls] of Object.entries(LET)) [...ls].forEach((c, i) => (CH[c] = [ramp, i]));
export function pixelsOf(def) {
  const g = Array.from({ length: N * N }, () => null);
  def.rows.forEach((r, y) => [...r].forEach((c, x) => { if (c !== "." && CH[c]) g[(y + (def.oy ?? 0)) * N + x + (def.ox ?? 0)] = CH[c]; }));
  // 選擇性外框：空格旁邊有東西 → 用旁邊那塊色系的最暗一階（上下左右；多個鄰居取最暗的那個色系）
  const out = g.map((v) => (v ? RAMPS[v[0]][v[1]] : null));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (g[y * N + x]) continue;
    let best = null;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const X = x + dx, Y = y + dy, v = X >= 0 && Y >= 0 && X < N && Y < N ? g[Y * N + X] : null;
      if (v) { const c = RAMPS[v[0]][4]; if (!best || hex(c).reduce((a, b) => a + b) < hex(best).reduce((a, b) => a + b)) best = c; }
    }
    if (best) out[y * N + x] = def.outline ?? best;
  }
  return out;
}

/** 全部轉成 icons.js 的格式（16×16 的顏色陣列） */
export const UI_ICONS = Object.fromEntries(Object.entries(ICON_DEFS).map(([n, d]) => [n, pixelsOf(d)]));
