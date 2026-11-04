// 連段計數器（像素風）：粗體斜字的數字、階級配色、COMBO 字樣＋小星星、會慢慢縮短的倒數條。
// 階級：1～9 白、10～24 金、25～49 火紅、50～99 星藍、100 以上彩虹。到 10／25／50／100 會閃一下、冒星星。
// 畫在一張小 canvas 上（邏輯像素 1 格＝螢幕 2px），每一格都重畫，很小所以不耗效能。
const LW = 76, LH = 32;
const BIG = {
  0: [".###.", "##.##", "##.##", "##.##", "##.##", "##.##", ".###."], 1: [".##..", "###..", ".##..", ".##..", ".##..", ".##..", "####."],
  2: [".###.", "##.##", "...##", "..##.", ".##..", "##...", "#####"], 3: ["####.", "...##", "...##", ".###.", "...##", "...##", "####."],
  4: ["##.##", "##.##", "##.##", "#####", "...##", "...##", "...##"], 5: ["#####", "##...", "####.", "...##", "...##", "##.##", ".###."],
  6: [".###.", "##...", "##...", "####.", "##.##", "##.##", ".###."], 7: ["#####", "...##", "...##", "..##.", "..##.", ".##..", ".##.."],
  8: [".###.", "##.##", "##.##", ".###.", "##.##", "##.##", ".###."], 9: [".###.", "##.##", "##.##", ".####", "...##", "...##", ".###."],
};
const SMALL = { C: ["111", "100", "100", "100", "111"], O: ["111", "101", "101", "101", "111"], M: ["101", "111", "111", "101", "101"], B: ["110", "101", "110", "101", "110"] };
const STAR = ["...#...", "..###..", "#######", ".#####.", "..###..", ".##.##.", "##...##"];
// [亮, 中, 暗, 外框]
const TIERS = [
  [1, ["#ffffff", "#fff0c8", "#c8b08a", "#2a1626"]],
  [10, ["#fffbe0", "#ffd24a", "#c07a14", "#2a1206"]],
  [25, ["#fff0a0", "#ff9a2a", "#c02a10", "#2a0806"]],
  [50, ["#ffffff", "#7ae8ff", "#2a7ad0", "#08142a"]],
  [100, null],   // 彩虹：每格換色
];
const RAINBOW = ["#ff6a6a", "#ffb03a", "#ffe85a", "#6af07a", "#5ad0ff", "#a88aff"];
const MILES = [10, 25, 50, 100, 200, 300];

export function createComboArt(el) {
  const cv = el.querySelector("canvas"), g = cv.getContext("2d");
  cv.width = LW; cv.height = LH;
  let shown = 0, endT = 0, mileT = 0, clock = 0, sparks = [];
  const px = (x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };

  function palette(n) {
    if (n >= 100) {
      const i = Math.floor(clock * 8);
      return ["#ffffff", RAINBOW[i % 6], RAINBOW[(i + 2) % 6], "#140a24"];
    }
    let p = TIERS[0][1];
    for (const [min, q] of TIERS) if (q && n >= min) p = q;
    return p;
  }
  function draw(n, k) {
    g.clearRect(0, 0, LW, LH);
    const [hi, mid, low, out] = palette(n), text = String(n), s = 2, dw = 5 * s, gap = 2;
    const tw = text.length * dw + (text.length - 1) * gap;
    const x0 = LW - 4 - tw, y0 = 2;
    // 數字：先畫影子（右下 1 格）＋外框，再填色；越上面的列往右偏一點＝斜體
    const cells = [];
    [...text].forEach((ch, ci) => BIG[ch].forEach((row, j) => [...row].forEach((v, i) => {
      if (v !== "#") return;
      for (let a = 0; a < s; a++) for (let b = 0; b < s; b++) {
        const yy = j * s + b, slant = Math.floor((7 * s - 1 - yy) / 5);
        cells.push([x0 + ci * (dw + gap) + i * s + a + slant, y0 + yy, yy]);
      }
    })));
    for (const [x, y] of cells) for (const [a, b] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1], [2, 2], [1, 2], [2, 1]]) px(x + a, y + b, out);
    for (const [x, y, yy] of cells) px(x, y, yy < 4 ? hi : yy < 9 ? mid : low);
    // 每個數字左上角一點白光
    [...text].forEach((ch, ci) => { const bx = x0 + ci * (dw + gap) + 2 + Math.floor((7 * s - 2) / 5); if (BIG[ch][0][1] === "#") px(bx, y0 + 1, "#ffffff"); });
    // COMBO 字樣＋左邊的小星星
    const ly = y0 + 7 * s + 4, label = "COMBO", lw = label.length * 4 - 1, lx = LW - 4 - lw;
    [...label].forEach((ch, ci) => SMALL[ch].forEach((row, j) => [...row].forEach((v, i) => {
      if (v !== "1") return;
      const x = lx + ci * 4 + i, y = ly + j;
      for (const [a, b] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) px(x + a, y + b, out);
    })));
    [...label].forEach((ch, ci) => SMALL[ch].forEach((row, j) => [...row].forEach((v, i) => { if (v === "1") px(lx + ci * 4 + i, ly + j, j < 2 ? hi : mid); })));
    const sx = lx - 10, sy = ly - 1, spin = Math.floor(clock * 6) % 2;
    STAR.forEach((row, j) => [...row].forEach((v, i) => { if (v === "#") { for (const [a, b] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) px(sx + i + a, sy + j + b, out); } }));
    STAR.forEach((row, j) => [...row].forEach((v, i) => { if (v === "#") px(sx + i, sy + j, j < 3 ? hi : spin && j === 3 ? hi : mid); }));
    // 倒數條：連段還剩多少時間
    const bw = 34, bx = LW - 4 - bw, by = ly + 7;
    for (let x = -1; x <= bw; x++) { px(bx + x, by - 1, out); px(bx + x, by + 2, out); }
    px(bx - 1, by, out); px(bx - 1, by + 1, out); px(bx + bw, by, out); px(bx + bw, by + 1, out);
    const fill = Math.round(bw * Math.max(0, Math.min(1, k)));
    for (let x = 0; x < bw; x++) { px(bx + x, by, x < fill ? hi : out); px(bx + x, by + 1, x < fill ? (k < 0.3 && Math.floor(clock * 8) % 2 ? out : mid) : out); }
    // 里程碑的星星火花
    for (const p of sparks) {
      const r = p.t < 0.15 ? 1 : p.t < 0.3 ? 2 : 1, c = p.t < 0.2 ? "#ffffff" : mid;
      for (let i = -r; i <= r; i++) { px(Math.round(p.x) + i, Math.round(p.y), c); px(Math.round(p.x), Math.round(p.y) + i, c); }
    }
  }

  return {
    /** 每一格叫：n＝目前連段、k＝倒數剩多少（0～1） */
    update(n, k, dt) {
      clock += dt;
      if (n > 0 && el.classList.contains("end")) { el.classList.remove("end"); shown = 0; }   // 斷掉後馬上又開始新的連段
      mileT -= dt;
      for (const p of sparks) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; }
      sparks = sparks.filter((p) => p.t < 0.45);
      if (n > shown) {
        // 加連段：跳一下；跨過里程碑就閃、冒星星
        if (MILES.some((m) => shown < m && n >= m)) {
          el.classList.remove("mile"); void el.offsetWidth; el.classList.add("mile");
          for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; sparks.push({ x: LW - 22 + Math.cos(a) * 8, y: 9 + Math.sin(a) * 5, vx: Math.cos(a) * 60, vy: Math.sin(a) * 30, t: 0 }); }
        }
        el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump");
        el.classList.add("on"); el.classList.remove("end");
        endT = 0;
      } else if (n === 0 && shown > 0) {
        // 斷掉：最後的數字留一下、往下掉著淡出
        el.classList.add("end");
        endT = 0.6;
      }
      if (n > 0) shown = n;
      else if (endT > 0 && (endT -= dt) <= 0) { el.classList.remove("on", "end"); shown = 0; }
      if (el.classList.contains("on")) draw(shown, n > 0 ? k : 0);
    },
  };
}
