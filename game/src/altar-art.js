// 星之祭壇（8b 存檔點，照 pixelfx skill 畫→看→修）：墜落的星星碎片斜插在一座小石台上。
//   沒點亮：碎片是暗灰藍、石台冷色；點亮：碎片變金色發光，周圍往上飄星屑，石台上的刻紋也亮起來。
// 參考：pixelfx holy/blessing（往上飄的光點）、ui/level-up（十字星光）、frame-art 的石頭明暗（左上亮右下暗）。
// drawAltar(frame, x, y, lit, t)：(x, y)＝石台底部中心（貼地）。草稿：game/tools/drafts/altar.mjs
import { hex } from "../../pixelfx/src/core/index.js";

const P = (c) => hex(c) >>> 0;
const STONE = ["#1a1828", "#3a3850", "#5a5874", "#7c7a98", "#a8a6c0"].map(P);
const DULL = ["#1c2236", "#34405e", "#506488", "#7488aa"].map(P);
const GOLD = ["#6e3a0c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff"].map(P);
const OUT = P("#0c0a14");

function put(frame, x, y, c, glow) {
  x = Math.round(x) - frame.ox; y = Math.round(y) - frame.oy;
  if (x < 0 || y < 0 || x >= frame.w || y >= frame.h) return;
  frame.color[y * frame.w + x] = c;
  if (glow) frame.light[y * frame.w + x] = c;
}
// 石台：三層（底座寬 20、中段 14、頂面一圈邊），字元 a～d＝明暗；第 2 輪：中段正中間刻一顆星（r，點亮會發光）
const BASE = [
  "..bccccccccccccccb..",
  ".bdddddddddddddddcb.",
  ".abbbbbbbbbbbbbbbba.",
  "...bcccccrcccccba...",
  "...bccccrrrcccba....",
  "...bcccccrcccccba...",
  "..bccccccccccccccb..",
  ".bdddddddddddddddcba",
  "abbbbbbbbbbbbbbbbbba",
].map((r) => r.padEnd(20, "."));
// 碎片（第 2 輪：原本細長像羽毛——改成一個斷掉的星星尖角：上尖下寬、左亮右暗兩個切面、底部斷口參差）
// 第 3 輪：放大到 15 列、尖端加一格高光 w
const SHARD = [
  ".....w.....",
  ".....sm....",
  "....ssm....",
  "....ssmd...",
  "...sssmd...",
  "...sssmdd..",
  "..ssssmdd..",
  "..ssssmddd.",
  ".sssssmddd.",
  ".sssssmdddd",
  "ssssssmdddd",
  "ssssssmdddd",
  ".ssss.mdd.d",
  "..ss..md...",
  "...s.......",
];
export function drawAltar(frame, x, y, lit, t = 0) {
  const W = BASE[0].length, bx = Math.round(x - W / 2), by = Math.round(y - BASE.length);
  const SC = { a: STONE[1], b: STONE[2], c: STONE[3], d: STONE[4], r: lit ? GOLD[3] : STONE[1] };
  const cells = (rows, ox, oy, map, glowKeys = "") => rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== ".") put(frame, ox + i, oy + j, map[ch], glowKeys.includes(ch)); }));
  // 外框
  const outline = (rows, ox, oy) => {
    const at = (i, j) => rows[j]?.[i] && rows[j][i] !== ".";
    for (let j = -1; j <= rows.length; j++) for (let i = -1; i <= rows[0].length; i++) if (!at(i, j) && (at(i + 1, j) || at(i - 1, j) || at(i, j + 1) || at(i, j - 1))) put(frame, ox + i, oy + j, OUT);
  };
  // 碎片插在石台頂上（底部埋進去 2 格）
  const sx = Math.round(x - 6), sy = by - SHARD.length + 3, bob = lit ? Math.round(Math.sin(t * 2) * 0.6) : 0;
  // 第 3 輪：先畫石台再畫碎片（原本石台蓋掉碎片下半），點亮的顏色降一階、只有尖端和中線發光（原本整片被光洗成白色）
  outline(BASE, bx, by);
  cells(BASE, bx, by, SC, lit ? "r" : "");
  outline(SHARD, sx, sy + bob);
  const MC = lit ? { w: GOLD[5], s: GOLD[3], m: GOLD[4], d: GOLD[1] } : { w: DULL[3], s: DULL[3], m: DULL[2], d: DULL[1] };
  cells(SHARD, sx, sy + bob, MC, lit ? "wm" : "");
  if (!lit) return;
  // 點亮：碎片尖端的十字星光一閃一閃、往上飄的星屑
  const k = Math.sin(t * 3.1) * 0.5 + 0.5, tx = sx + 5, ty = sy + bob;
  put(frame, tx, ty - 1, GOLD[5], true);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(frame, tx + dx, ty - 1 + dy, GOLD[k > 0.5 ? 4 : 3], true);
  if (k > 0.7) for (const [dx, dy] of [[2, 0], [-2, 0], [0, -2], [0, 2]]) put(frame, tx + dx, ty - 1 + dy, GOLD[2], true);
  for (let n = 0; n < 6; n++) {
    const p = (t * 0.45 + n / 6) % 1, px = x - 9 + ((n * 7) % 18) + Math.sin(p * 6 + n) * 2, py = by - 2 - p * 30;
    put(frame, px, py, p < 0.4 ? GOLD[5] : p < 0.75 ? GOLD[3] : GOLD[1], p < 0.75);
  }
}
