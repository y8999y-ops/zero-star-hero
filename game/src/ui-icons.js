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
  // 選單（2026-11-05 介面減量：背包、任務、技能樹收進這顆）：三條金色橫條，左邊一顆星星小點
  menu: { ox: 1, oy: 2, rows: [
    "..GGGGGGGGGH..", "..HHHHHHHHIJ..", "..............", "..............", "..............", "..GGGGGGGGGH..",
    "..HHHHHHHHIJ..", "..............", "..............", "..............", "..GGGGGGGGGH..", "..HHHHHHHHIJ..",
  ] },
  // 使用者 2026-11-05：選單改成往右展開的小三角箭頭（金色、左上亮右下暗）
  arrowR: { ox: 4, oy: 2, rows: [
    "G.......", "GG......", "GHG.....", "GHHG....", "GHHHG...", "GHHHIJ..", "GHHIJ...", "GHIJ....", "GIJ.....", "IJ......", "J.......",
  ] },
  // 8e：地圖（摺三折的紙，紅色虛線路線，終點一個 X）
  map: { ox: 2, oy: 3, rows: [
    "AAAACCCCAAAA", "ABBBCDDDABBB", "ABgBCDDDAhBh", "ABBgCDDDABhB", "ABBBgDDDAhBh", "ABBBCggDABBB", "ABBBCDDgABBB", "ABBBCDDDgBBB", "ABBBCDDDABBB", "BBBBDDDDBBBB",
  ] },
  // ---- 10 批：一次性資源（美術需求 E6，撿到的提示、地圖標記）與魔力（G1）
  res_ember: { ox: 3, oy: 1, rows: [
    "....g.....", "....gh....", "...ghI.g..", "...gIIh...", "..gIHIhg..", "..gIHHIh..", ".gIHGHIhh.",
    ".gIHGGHIh.", "gIHGGGGHIh", "gIHGGGGHIh", ".gIHGGHIh.", "..hIIIIhh.", "...hhhhh..",
  ] },
  res_vein: { ox: 1, oy: 1, rows: [
    ".......p......", "......pq...p..", "......pqr.pqr.", "...p..qqr.pqr.", "..pqr.qrr.qrr.", ".cpqrcqrrcqrd.",
    "ccqrrccrccrddd", "cbqrdccddcrdde", "cbcdccdcdddddee", "cdcccdddddddde", ".dddddddddeee.", "..eeeeeeeeee..",
  ] },
  res_fossil: { ox: 1, oy: 2, rows: [   // 跟遊戲裡的一樣：石板上凸出一顆發紫光的圓核，旁邊刻一圈螺紋
    ".....OOOO.....", "....OMMMNO....", "...OMLAMMNO...", "..COMLMMMNOC..", ".CBOMMMMNNOBC.", "CBBDONNNNOODBC",
    "CBDBBOOOOBBDBC", "CBDBBBBBBBDBBC", "CBBDDBBBDDBBCD", "DCBBBDDDBBCCDD", ".DDCCCCCCCDDD.",
  ] },
  res_safe: { ox: 2, oy: 2, rows: [
    ".aaaaaaaaaa.", "abbbbbbbbbcd", "abcccccccccd", "abccbbbbccHd", "abcbbaabbcId", "abcbacccbcId",
    "abcbacdcbccd", "abcbbddbbccd", "abccbbbbcccd", "abcccccccccd", "bcddddddddde", ".ee......ee.",
  ] },
  res_stele: { ox: 3, oy: 1, rows: [
    "...bbbbb..", "..baaabbc.", ".babbbbbcc", ".babbHbbcd", ".babHGHbcd", ".babbHbbcd", ".babbbbbcd",
    ".baIIIIbcd", ".babbbbbcd", ".baIIIbbcd", ".babbbbbcd", "ccccccccdd", "dddddddddd",
  ] },
  mana: { ox: 3, oy: 1, rows: [
    ".....r....", ".....r....", "....qrs...", "....qrs...", "...qqrrs..", "...pqrrs..", "..pqqrrrs.",
    ".qpqqqrrs.", ".qpqqqrrrs", ".qqqqqrrrs", ".qqqqrrrss", "..rrrrrss.", "...ssss...",
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

  // ---- 形態技能樹節點（第 4 批）：星星 n_s_*、黏液星 n_g_*
  n_s_big: { ox: 1, oy: 1, rows: [
    "......G.......", "..G...G...G...", "...G..H..G....", "......H.......", ".....GHI......", "GGGGGHaHIIIIJ.",
    ".....HII......", "......I.......", "...I..I..J....", "..I...I...J...", "......J.......",
  ] },
  n_s_pierce: { ox: 1, oy: 2, rows: [
    ".......hhh....", "......h...h...", "G....h.....h..", "HG...h.....h..", "aHGGGGGGGGGGGJ", "HG...h.....h..",
    "G....h.....h..", "......h...h...", ".......hhh....",
  ] },
  n_s_fire: { ox: 1, oy: 1, rows: [
    "......h.......", ".....hgh......", ".....gfg..h...", "....hgfgh.g...", "......G..hgh..", ".....GHI......",
    "GGGGGHaHIIIIJ.", ".GHHHHHIIIIJ..", "..HHHHIIIIJ...", "..HHJ...IIJ...", ".HJ.......IJ..",
  ] },
  n_s_edge: { ox: 2, oy: 1, rows: [
    "..........a", ".........ab", "........abc", ".......abc.", "......abc..", ".....abc...", "....GHc....",
    "...GHI.....", "..GHIJ.....", ".GHIJ......", "GHIJ.......", "IJ.........",
  ] },
  n_s_wave: { ox: 2, oy: 1, rows: [
    "....J..aaG..", "...J...aHHG.", "..J.....aHHG", "..J.....aHHG", ".J.......aHG", ".J.......aHG", ".J.......aHG",
    "..J.....aHHG", "..J.....aHHG", "...J...aHHG.", "....J..aaG..",
  ].map((r) => r.replace(/J/g, ".")).map((r, i) => (i === 3 || i === 7 ? "IJJ" + r.slice(3) : i === 5 ? "HIJJ" + r.slice(4) : r)) },   // 第 3 輪：左邊三條速度線
  n_s_light: { ox: 1, oy: 2, rows: [
    "........G.....", "........H.....", ".......GaI....", "pppp..GHHHIJ..", "..qqq..HaI....", "pppppp..I.....",
    "..qqq...J.....", "pppp..........", "..............",
  ] },
  n_s_origin: { ox: 1, oy: 1, rows: [
    "....GGGGcc....", "..GG......cc..", ".G....G.....c.", ".G...GHI....c.", "G..GGHaHIJ...c", "G...HHHII....c",
    "G...HJ.IJ....c", ".G..........c.", ".G..........c.", "..GG......cc..", "....GGcccc....",
  ] },
  n_s_return: { ox: 1, oy: 1, rows: [
    "....qqqqq.....", "..qq.....qq...", ".q.........q..", "q.....G....qqq", "q....GHI....q.", "q..GGHaHIJ....",
    "q...HHHII.....", ".q..HJ.IJ.....", "..q...........", "...qq.........", ".....qqq......",
  ] },
  n_s_rain: { ox: 1, oy: 1, rows: [
    "B.............", ".B......B.....", "..B......B....", "...G......B...", "..GaH......G..", "...HI.....GaH.",
    "....I......HI.", "......B......", ".......B......", "........G.....", ".......GaH....", "........HI....",
  ] },
  n_g_big: { ox: 2, oy: 2, rows: [
    "k....lll....k", ".k.llmmmmn.k.", "..lkkllmmmn..", "..lkalllmmn..", ".llklllllmnn.", ".lllllllmmnn.",
    "..mllllmmmnn.", "..mmmmmmnnn..", ".k.nmmnnnn.k.", "k...nnnnn...k",
  ] },
  n_g_bounce: { ox: 1, oy: 1, rows: [
    "......aaa.....", ".....a...a....", "....a.....a...", "...a.......a..", "..a.........a.", ".llm.........a",
    "lkaml......llm", "lllmm.....lkam", "lllmm.....lllm", ".mmn......lmmn", "...........nn.",
  ] },
  n_g_ground: { ox: 1, oy: 3, rows: [
    "....l....l....", "....l....m....", "...lkl...m....", "...lam.........", "....m.........", "..............",
    ".lllllllmmmmn.", "lkkallllmmmmnn", "nnnnnnnnnnnnnn",
  ] },
  n_g_horn: { ox: 1, oy: 2, rows: [
    "....l.........", "...lml........", "...lml......k.", "..lkalmmmmmmkk", "lllkllllllllmko", ".mllllmmmmmm.k.",
    "..mlllmo......", "..mmn.mmo.....", ".mn.....mo....", ".n.......o....",
  ] },
  n_g_coat: { ox: 2, oy: 1, rows: [
    ".........ab", "........abc", ".......abc.", "......klm..", ".....kllm...", "....klmm....", "...GHmm.....",
    "..GHI.l.....", ".GHIJ.l.....", "GHIJ..m.....", "IJ....l.....", "......m.....",
  ] },
  n_g_spring: { ox: 2, oy: 1, rows: [
    "...lllll...", "..lkallmm..", "..lllllmn..", "...nnnnn...", "..abbbbbc..", "....bbc....", "..abbbbbc..", "....bbc....",
    "..abbbbbc..", "....bbc....", ".abbbbbbbc.", ".ccccccccd.",
  ] },
  n_g_fuel: { ox: 2, oy: 1, rows: [
    "....h......", "...hgh.....", "...gfg.....", "..hgfgh....", "...hgh.....", "....l......", "...lkl.....", "..lkall....",
    ".lklllmm...", ".lllllmn...", ".mllmmmn...", "..mmmnn....",
  ] },
  n_g_film: { ox: 1, oy: 1, rows: [
    "....kkkkkk....", "..kk......ll..", ".k...........l", ".k.....G.....l", "k.....GHI....m", "k...GGHaHIJ..m",
    "k....HHHII...m", ".l...HJ.IJ..m.", ".l..........m.", "..ll......mm..", "....mmmmmm....",
  ] },
  n_g_split: { ox: 1, oy: 1, rows: [
    "..........lm..", ".........lam..", "..........mn..", "...lll........", "..lkalm...lm..", "..llllmn.lamn.",
    "..lllmmn..mn..", "...mmnn.......", "..........lm..", ".........lam..", "..........mn..",
  ] },
  // ---- 形態技能樹節點（第 4b 批）：鐵罐星 n_c_*、蝠翼星 n_b_*
  n_c_long: { ox: 1, oy: 2, rows: [
    "........aaa...", ".......abbbc..", "ccc...abbbbcd.", "......abbbbcd.", "cccc..abbbbcd.", "......abbbbcd.",
    "ccc...abbbbcd.", ".......bbbcd..", "........cdd...",
  ] },
  n_c_volt: { ox: 1, oy: 1, rows: [
    "....aaaaaa....", "..abbbbbGHbc..", ".abbbbbGaIbcd.", ".abbbbGaIbbcd.", ".abbbGaHHHIcd.", ".abbbHHHaIbcd.",
    ".abbbbbGaIbcd.", ".abbbbGaIbbcd.", "..bccHIccccd..", "....dddddd....",
  ] },
  n_c_brake: { ox: 1, oy: 1, rows: [
    "....abbbc.....", "....abbbc.....", "....abbbc.....", "...abbbbbc....", "..abbbbbbbc...", "..ccccccccd...",
    "G............G", ".H..........H.", "uuuuuu.uuuuuuu", "vvvvv.v.vvvvvv", "wwww.www.wwwww",
  ] },
  n_c_weight: { ox: 2, oy: 1, rows: [
    "...bbbbb...", "..b.....b..", "..b.....b..", "...b...b...", ".abbbbbbbc.", "abbbbbbbbcd", "abbbbbbbbcd",
    "abbbbbbbbcd", "abbbbbbbccd", ".bccccccdd.", "..dddddd...",
  ] },
  n_c_quake: { ox: 1, oy: 1, rows: [
    "..aabbbc......", "..abbbbcc.....", "..bbbbccd.....", "....uv........", "....uv........", "....uv........",
    "G...uv....G...", ".H..uw...H....", "uuuuuuuuuuuuuu", "vvv.vvvvvv.vvv", "ww.wwwwwwww.ww",
  ] },
  n_c_iron: { ox: 2, oy: 1, rows: [
    "abbbbbbbbbc", "aGbbbbbbbGd", "abbbbbbbbcd", "abbbbbbbbcd", "abbbbbbbbcd", "aGbbbbbbbGd", "abbbbbbbbcd",
    ".abbbbbbcd.", "..abbbbcd..", "...abbcd...", "....acd....",
  ] },
  n_c_conduct: { ox: 1, oy: 2, rows: [
    ".p............", "pqr...........", "qaq.G.........", "rqrGaH....p...", ".r...GaH.pqr..", "......HIGqaq..",
    "........rqrG..", ".........r.GaH", "............Hp", "...........pqr", "...........qaq", "............r.",
  ] },
  n_c_dent: { ox: 3, oy: 1, rows: [
    "..aabbcc..", ".abbbbbccd", ".cccccccdd", ".abbbbbbcd", ".abdbbbbcd", ".ab.ddbbcd", ".abd..dbcd", ".abbddbbcd",
    ".cccccccdd", ".abbbbbbcd", ".abbbbbbcd", "..cccccdd.",
  ] },
  n_c_truck: { ox: 1, oy: 2, rows: [
    "lllllllll.....", "lkkkkkkkm.....", "lkkkkkkkmppq..", "lkkkkkkkmpaqr.", "lllllllllpqqr.", "mmmmmmmmmmmmmn",
    "mmbbmmmmmmbbmn", "..bab.....bab.", "...b.......b..",
  ] },
  n_b_far: { ox: 1, oy: 2, rows: [
    "L.............", "LM...........", "LMM..........", "LMMMN....OOO..", ".LMMNN.....OOP", "..LMNNN..OOO..",
    "...LMNN.......", "....LMN.......", ".....LN.......",
  ] },
  n_b_fang: { ox: 2, oy: 1, rows: [
    "LLLLLLLLLLL", "LMMMMMMMMMN", ".NNNNNNNNN.", "..A.....A..", "..AB...AB..", "..AB...AB..", "...B....B..",
    "...k....k..", "...l....l..", "...m.....m.", "..........m",
  ] },
  n_b_double: { ox: 1, oy: 1, rows: [
    "L...........L.", "LM..L.L....ML.", ".LMMMfMfMMML..", "..NNMMMMMNN...", "....NNNNN.....", "..............",
    "L...........L.", "LM..L.L....ML.", ".LMMMfMfMMML..", "..NNMMMMMNN...", "....NNNNN.....",
  ] },
  n_b_claw: { ox: 2, oy: 1, rows: [
    "A....A....A", ".A....A....A", ".BA...BA...BA", "..BA...BA...B", "...BA...BA...", "....BA...BA..",
    ".....BA...BA.", "......BA...B.", ".......B.....",
  ] },
  n_b_hover: { ox: 1, oy: 1, rows: [
    "L...........L.", "LM...L.L...ML.", ".LMMMMfMfMMML.", "..NNMMMMMMNN..", "....NNNNNN....", "..............",
    "....p.p.p.p...", "..............", ".....p.p.p....", "..............", "......p.p.....",
  ] },
  n_b_blood: { ox: 3, oy: 1, rows: [
    "LLLLLLLLL.", "LMMMMMMMN.", ".A.....A..", ".AB...AB..", "..B...B...", "....h.....", "...hgh....", "...ggh....",
    "..hgfghh..", "..hggghh..", "...hhhh...",
  ] },
  n_b_toxic: { ox: 3, oy: 1, rows: [
    "...bbb....", "...aac....", "...bbc....", "..LMMMN...", ".LkllmNN..", "LkallmmNO.", "LllllmmNO.", "LllmmmmNO.",
    ".NmmmmNO..", "..NNNNO...",
  ] },
  n_b_night: { ox: 1, oy: 1, rows: [
    "......LLLL....", "....LMM.......", "...LMM........", "..LMN.....p...", "..LMN.........", "..LMN....pp...",
    "..LMMN........", "...LMNN...p...", "....LMMNNN....", "......NNNN....",
  ] },
  n_b_swarm: { ox: 1, oy: 1, rows: [
    "L.L.L.........", "LMMfML........", ".NNMN.........", "........L.L.L.", "........LMMfML", ".........NNMN.",
    "..L.L.L.......", "..LMMfML......", "...NNMN.......",
  ] },
  // ---- 史詩套裝（第 5 批）：徽章 set_*、各部位 set_<套>_<部位>
  // 流星獵手：金＋紅，彗星尾巴
  set_meteor: { ox: 1, oy: 1, rows: [
    "f.............", ".fg...........", "..fgh.........", "...ghh........", "....hhG.......", ".....hGH......",
    "....GGaHHI....", ".....HHHI.....", "....GHIIIJ....", "....HJ..IJ....", "...HJ....IJ...",
  ] },
  set_meteor_weapon: { ox: 1, oy: 1, rows: [
    "f.............", ".gf...........", "..hgf.........", "...hg.GGG.....", "....hGaHHI....", "....GaHHHIJ...",
    "....GHHHIIJ...", "....GHHIIJJ...", ".....HIIJJ....", "......JJJ.....",
  ] },
  set_meteor_head: { ox: 1, oy: 1, rows: [
    "..........ff..", ".........fgh..", "....GGGGfgh...", "...GaHHHHhh...", "..GaHHHHHHII..", "..GHHHHHHHIJ..",
    "..GHHHHHHHIJ..", "..GJJJJJJJJJ..", "..GH.hhhh.IJ..", "..GHHHHHHHIJ..", "...HI....IJ...",
  ] },
  set_meteor_body: { ox: 2, oy: 1, rows: [
    ".GG.....GG.", "GaHGGGGGHIJ", "GHHHHHHHHIJ", ".GHHHfHHHI.", ".GHHfgfHHI.", ".GHHHfHHHI.", ".GHHHHHHII.",
    ".GHHHHHHII.", ".hhhhhhhhh.", ".HHHHHHHIJ.", "..IIIIIIJ..",
  ] },
  set_meteor_hands: { ox: 2, oy: 1, rows: [
    "f..f..f....", "g..g..g....", "GH.GH.GH...", "GH.GH.GH.G.", "GHHHHHHHGH.", "GaHHHHHHHI.", "GHHHHHHHIJ.",
    ".GHHHHHIIJ.", ".hhhhhhhh..", ".HHHHHHIJ..", "..IIIIIJ...",
  ] },
  set_meteor_feet: { ox: 2, oy: 1, rows: [
    "f.....GGG..", "gf....GaH..", ".hf...GHH..", "..hg..GHH..", "...hg.GHH..", "......GHHI.", ".....GHHHII",
    "....GHHHHIJ", "...GHHHHHIJ", "..hhhhhhhhh", "..JJJJJJJJJ",
  ] },
  set_meteor_acc: { ox: 3, oy: 1, rows: [
    "...hhh....", "..h...h...", "..h...h...", "...h.h....", "....G.....", "...GaH....", "GGGHaHIII.", ".GHHHHIJ..",
    "..HHHIJ...", "..HI.IJ...", ".HJ...IJ..",
  ] },
  // 星辰共鳴：青＋銀，繞圈的軌道環
  set_reson: { ox: 1, oy: 1, rows: [
    "....pppppp....", "..pp......pp..", ".p....p.....p.", "p....pqr.....p", "p...pqaqr....p", "pqqqqaaaqqqqqp",
    "p...rqaqr....p", "p....rqr.....p", ".p....r.....p.", "..pp......pp..", "....pppppp....",
  ] },
  set_reson_weapon: { ox: 1, oy: 1, rows: [
    "......p.......", ".....pqr......", "....pqaqr.....", "pppppqaqrrrrr.", "p..pqaqqqr..r.", ".pppqqqqqrrrr.",
    "....rqqqr.....", ".....rqr......", "......r.......",
  ] },
  set_reson_head: { ox: 1, oy: 1, rows: [
    "......p.......", ".....pqr......", "....pqaqr.....", ".....rqr......", "......r.......", "..a.......c...",
    ".abbbbpbbbbc..", "abbbbpaqbbbcd.", ".bcc..r...ccd.", "..c........d..",
  ] },
  set_reson_body: { ox: 2, oy: 1, rows: [
    ".pp.....pp.", "pqqpppppqrr", "pqqqqqqqqrr", ".pqqqaqqqr.", ".pqqa.aqqr.", ".pqqqaqqqr.", ".pqqqqqqrr.",
    ".bbbbbbbbb.", ".pqqqqqqrr.", "..rrrrrrr..",
  ] },
  set_reson_hands: { ox: 2, oy: 1, rows: [
    "p..p..p....", "q..q..q....", "ab.ab.ab...", "ab.ab.ab.a.", "abbbbbbbab.", "abbbbbbbbc.", "pqqqaqqqrr.",
    "pqqaaaqqrr.", ".pqqaqqrr..", ".abbbbbbc..", "..cccccd...",
  ] },
  set_reson_feet: { ox: 2, oy: 1, rows: [
    "......pqr..", "......qar..", "......pqq..", "......bbbc.", "......bbbc.", ".....pqqqr.", "....pqqqqrr",
    "...pqqqqqrs", "..pqqqqqqrs", "..bbbbbbbbc", "..cccccccdd",
  ] },
  set_reson_acc: { ox: 2, oy: 1, rows: [
    "....aaa....", "...a...c...", "...a...c...", "....bbc....", "....pqr....", "...pqaqr...", "..pqaqqqr..",
    "...pqqqr...", "....rqr.....", ".....r.....",
  ] },
  // 夜宴：深紅＋紫黑，蝙蝠翅膀、獠牙、高腳杯
  set_feast: { ox: 2, oy: 1, rows: [
    ".OOOOOOOOO.", "Ofgggggghi.", "Ofggggghhi.", ".Ogggghhi..", "..Ohhhhi...", "...OPPO....", "....PO.....",
    "....PO.....", "..OOPPOO...", ".OPPPPPPO..",
  ] },
  set_feast_weapon: { ox: 1, oy: 1, rows: [
    "L...........L.", "LM..........ML", ".LMM..hh..MML.", "..LMMfgghMML..", "...MfgffghM...", "....gffgghh...",
    "....hgghhii...", ".....hhiii....", "......iii.....",
  ] },
  set_feast_head: { ox: 1, oy: 1, rows: [
    ".O.........O..", ".OM.......PO..", ".OMP.....PPO..", ".OMPOOOOOPPO..", ".OMMMPPPPPPO..", ".OMPPPPPPPPO..",
    ".OPPfPPPfPPO..", ".OPPPPPPPPPO..", "..hhhhhhhhh...", "..OP.....PO...", "..O.......O...",
  ] },
  set_feast_body: { ox: 2, oy: 1, rows: [
    "..OO...OO..", ".OPPOOOPPO.", ".OPPfPfPPO.", "OPPPfPfPPPO", "OPPPgPgPPPO", "OPPPgPgPPPO", "OPPPhPhPPPO",
    "OPPPhPhPPPO", "OPPhhPhhPPO", "OPh..P..hPO", "Oh...P...hO",
  ] },
  set_feast_hands: { ox: 2, oy: 1, rows: [
    "A..A..A....", "BA.BA.BA...", "OP.OP.OP...", "OP.OP.OP.O.", "OPPPPPPPOP.", "OPfPPPPPPP.", "OPPPPPPPPO.",
    ".OPPPPPPO..", ".hhhhhhhh..", ".OPPPPPPO..", "..OOOOOO...",
  ] },
  set_feast_feet: { ox: 2, oy: 1, rows: [
    "......OOO..", "......OPP..", "......OPP..", "......OfP..", "......OPP..", ".....OPPPO.", "....OPPPPPO",
    "...OPPPPPPO", "O.OPPPPPPPO", "OOhhhhhhhhh", ".OOOOOOOOOO",
  ] },
  set_feast_acc: { ox: 3, oy: 1, rows: [
    "...OOOO...", "..O....O..", "..O....O..", "...O..O...", "...OPPO...", "..OPfgPO..", "..OPgiPO..",
    "...A..A...", "...AB.AB..", "....B..B..",
  ] },
  // ---- 神話（第 6 批）
  myth_crown: { ox: 1, oy: 1, rows: [
    "......a.......", ".....aba......", "......a.......", "..G...G...G...", "..GH.GHH.GH...", ".GHHGHaHHGHI..",
    ".GHHHHHHHHHI..", ".GfHHHpHHHfI..", ".GHHHHHHHHHI..", "..IIIIIIIIIJ..", "..JJJJJJJJJJ..",
  ] },
  myth_heart: { ox: 1, oy: 1, rows: [
    "..QQQ...QQQ...", ".QRaRQ.QRaRQ..", "QRRaRRQRRRSSQ.", "QRRRRRGRRRSST.", "QRRRRGaHRRSST.", "QRRGGaaaHHSST.",
    ".QRRRHaHRRST..", "..QRRRHRRRT...", "...QRRRRST....", "....QRRST.....", ".....QST......", "......T.......",
  ] },
  // ---- 傳說（第 6 批重畫，照 pixelfx skill）
  leg_slipper: { ox: 3, oy: 1, rows: [
    ".AAAAA....", "ABBBBBC...", "ABBBBBBC..", "ABBBBBBC..", "pApApApq..", "qaqAqAqr..", "ABBBBBBC..", ".ABBBBBC..",
    "..ABBBC...", "..ABBBC...", "..ABBBC...", "...CCC..G.", ".......GaH",
  ] },
  leg_overtime: { ox: 2, oy: 1, rows: [
    "AAAAAAAAA..", "ABBBBBBBBC.", "ABDDDDDDBC.", "ABBBBBBBBC.", "ABDDDDDBBC.", "ABBBBhhhBC.", "ABDDhBBBhC.",
    "ABBBhBhBhC.", "ABBBBhhhBC.", "ABBBBBBBBC.", ".CCCCCCCCC.",
  ] },
  leg_noisy: { ox: 1, oy: 1, rows: [
    "........AAAAA.", ".......ABBhBBC", ".......ABBhBBC", "..GGG..ABBBBBC", ".GaHHI..ABhBC.", "GaHHHHI..AC...",
    "GHHHHHI.......", "GHjjjHI.......", "GHHjHHIJ......", ".HIIIIJ.......", "..JJJJ........",
  ] },
  leg_hardhat: { ox: 1, oy: 1, rows: [
    "......h.......", "..f...g..h....", "...g..H.g.....", "....GGGGG.....", "...GaAHHHI....", "..GHHAHHHII...",
    ".GHHHAHHHHIJ..", ".GHHHAHHHHIJ..", "GGGGGGGGGGGIJ.", "IIIIIIIIIIIJJ.",
  ] },
  // ---- 元素狀態圖示（第 4 批，技能樹說明用）
  el_burn: { ox: 3, oy: 1, rows: [
    "....f.....", "...fg.....", "...fgh....", "..fggh..f.", "..fgGgh.gh", ".fgGHGghgh", ".fgHaHGggh", "fgGHHHGghi",
    "fgGHHHGghi", ".gGGHGGhi.", "..hhhhhi..", "...iiii...",
  ] },
  el_slime: { ox: 3, oy: 1, rows: [
    "....kk....", "...kkl....", "...kll....", "..kkllm...", "..kallmm..", ".kklllmm..", ".klllllmn.", ".llllllmn.",
    ".lllllmmn.", "..llmmmn..", "...mnnn...", "......n...",
  ] },
  el_shock: { ox: 3, oy: 1, rows: [
    "......GH..", ".....GaI..", "....GaI...", "...GaI....", "..GaHHHI..", ".GHHHHaI..", "....GaI...", "...GaI....",
    "..GaI.....", ".GaI......", ".HI.......", ".I........",
  ] },
  el_poison: { ox: 2, oy: 1, rows: [
    "........kk..", ".......kalm.", ".......lllm.", "..kk....mm..", ".kalm.......", ".llmm..kkl..", "..mm..kallm.",
    "......lllmm.", "...M..mmmm..", "..MNM..nn...", "...N........", "............",
  ] },
  el_wet: { ox: 3, oy: 1, rows: [
    "....p.....", "....q.....", "...pqr....", "...pqr....", "..pqqqr...", "..paqqrr..", ".pqaqqqrs.", ".pqqqqqrs.",
    ".qqqqqrrs.", "..qqrrrs..", "...rsss...", "..........",
  ] },
  el_oil: { ox: 3, oy: 1, rows: [
    "....d.....", "....d.....", "...dde....", "...dde....", "..ddeee...", "..dpQeee..", ".ddqddeee.", ".dQddpqee.",
    ".dddeeeee.", "..deeeee..", "...eeee...", "..........",
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
