// 遊戲內介面按鈕（第 7 批，照 pixelfx skill 畫→看→修）：12×12 九宮格（四邊各切 4 格），放大 2 倍。
// 參考：pixelfx ui/achievement、quest-complete 的金框（1px 最暗外框、上緣反光、下緣壓暗），
//       一般像素 RPG 的「有厚度」按鈕：底下 2 格是按鈕側面（唇），按下去唇不見、內容往下沉。
// 種類（使用者要求少量顏色分功能）：go 主要（金）、bad 危險（紅）、plain 一般（紫灰）；sys 保留沒用；狀態：n 平常、h 停留、d 按下、x 停用。
// 回傳 { w, h, px }，px 是 "#rrggbb" 或 null。
export const KINDS = {
  go: { o: "#1a0c04", w: "#fffbe0", hi: "#ffeb9a", gl: "#ffd870", mid: "#f0c050", lo: "#c8862a", dk: "#7a4410", ink: "#3a1c04" },
  bad: { o: "#1a0408", w: "#ffe8e0", hi: "#ffb4a0", gl: "#ff8068", mid: "#e85a48", lo: "#b02e32", dk: "#5a0c1a", ink: "#fff2ec" },
  plain: { o: "#0a0612", w: "#e8e0ff", hi: "#a898d0", gl: "#8070ae", mid: "#6a5a96", lo: "#4a3c72", dk: "#261c44", ink: "#f4eeff" },
  sys: { o: "#020c16", w: "#f0ffff", hi: "#9af0ff", gl: "#5ac8f0", mid: "#3aa8d8", lo: "#1e6a9a", dk: "#0c3454", ink: "#f0ffff" },
  off: { o: "#0a0810", w: "#8a8496", hi: "#6e6880", gl: "#58546c", mid: "#4c4860", lo: "#3c384c", dk: "#24202e", ink: "#8a8496" },
};
export const N = 12, SLICE = 4;
export function btnArt(kind, state = "n") {
  const K = KINDS[state === "x" ? "off" : kind], px = new Array(N * N).fill(null);
  const set = (x, y, c) => (px[y * N + x] = c);
  const down = state === "d", lip = down ? 0 : state === "x" ? 1 : 2, top = down ? 2 : 0;   // 按下去整顆往下沉 2 格
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const yy = y - top, bottom = N - 1, edgeX = x === 0 || x === N - 1;
    if (y < top) continue;
    // 四角斜切 1 格
    if ((x === 0 || x === N - 1) && (y === top || y === bottom)) continue;
    if (edgeX || y === top || y === bottom) { set(x, y, K.o); continue; }
    // 唇（按鈕側面）：最下面 lip 格，比身體深兩階
    // 第 3 輪：唇的左右兩端深一階，側面看起來是圓的
    if (y >= bottom - lip) { set(x, y, y === bottom - 1 || x === 1 || x === N - 2 ? K.dk : K.lo); continue; }
    const by = bottom - lip - 1;   // 身體最下一列
    let c;
    const hv = state === "h";                                                // 停留：身體整顆亮一階
    if (down) c = yy === 1 ? K.dk : y === by ? K.lo : x === N - 2 ? K.lo : K.mid;   // 按下：上緣一條陰影
    else if (yy === 1) c = x <= 2 && state !== "x" ? K.w : K.hi;            // 上緣反光（左上 2 格白）
    else if (x === 1) c = y === by ? K.mid : K.hi;
    else if (x === N - 2 || y === by) c = K.lo;                             // 右緣、下緣壓暗
    else if (yy === 2) c = hv ? K.hi : K.gl;                                 // 第 2 輪：上緣下面多一條過渡色，有光澤
    else c = hv ? K.gl : K.mid;
    set(x, y, c);
  }
  return { w: N, h: N, px };
}
