// 地圖畫面（8e，docs/關卡與星核改版企劃.md 3.5）：按 M（手機在左上選單裡）打開；走過的地方才顯示（每格 32×32，畫面看得到的範圍算走過）。
// 標記：主角、祭壇（亮／暗）、出口、還沒拿的一次性資源（拿過變灰）、還沒開的形態機關。走過的格子記在 profile.mapSeen[關卡]。
// 地圖 1 格＝世界 8 格（地形的 TILE）。renderMap() 是純函式（node 草稿也用），畫成 { w, h, px:"#rrggbb"[] }。
// 標記圖示照 pixelfx skill 畫三輪。草稿：game/tools/drafts/mapview.mjs
const CELL = 32, K = 8;
const THEME = {
  // 實測調整：岩石亮一階（原本跟空地太接近，在遊戲裡看不出地形）
  abyss: { solid: "#3c4466", top: "#a8d42a", edge: "#7480a4" },
  junk: { solid: "#7a4434", top: "#e4b072", edge: "#a06446" },
  cave: { solid: "#24405a", top: "#5ac0a0", edge: "#5a86a0" },
  lair: { solid: "#7a4434", top: "#e4b072", edge: "#a06446" },
};
const AIR = "#100e1c", FOG = "#06050c", FOG2 = "#0c0a16", PLAT = "#c8a040";
// 標記（7×7，'.' 透明）：每個字元一個顏色
const ICON = {
  player: { rows: ["...a...", "..aba..", "aabbbaa", ".abcba.", "..bbb..", ".bb.bb.", "b.....b"], col: { a: "#ffe066", b: "#f0b424", c: "#ffffff" } },
  altarOn: { rows: ["...a...", "..aba..", "..aba..", "..aba..", "..aba..", ".ccccc.", "ccccccc"], col: { a: "#ffe066", b: "#fff6c4", c: "#7c7a98" } },
  altarOff: { rows: ["...a...", "..aba..", "..aba..", "..aba..", "..aba..", ".ccccc.", "ccccccc"], col: { a: "#34405e", b: "#7488aa", c: "#3a3850" } },
  exit: { rows: ["..aaa..", ".abbba.", "ab...ba", "ab.c.ba", "ab...ba", ".abbba.", "..aaa.."], col: { a: "#1a7aa8", b: "#4cd8ec", c: "#ffffff" } },
  ember: { rows: ["...a...", "..aba..", ".abcba.", ".abcba.", "..bcb..", "...b...", "......."], col: { a: "#c48412", b: "#ffe066", c: "#ffffff" } },
  vein: { rows: ["..a....", ".ab.a..", ".ab.ab.", "aab.ab.", "abbaab.", "ccccccc", "......."], col: { a: "#28aed0", b: "#a0f2fa", c: "#3c4466" } },
  fossil: { rows: ["..aaa..", ".abbba.", "abcccba", "abc.cba", "abcccba", ".abbba.", "..aaa.."], col: { a: "#7a6a54", b: "#a8987a", c: "#b878ff" } },
  safe: { rows: ["aaaaaaa", "abbbbba", "abbcbba", "abcccba", "abbcbba", "abbbbba", "aaaaaaa"], col: { a: "#5c5868", b: "#9a968c", c: "#f0b424" } },
  stele: { rows: ["..aaa..", ".abbba.", ".bcbcb.", ".bbbbb.", ".bcbcb.", ".bbbbb.", "aaaaaaa"], col: { a: "#7480a4", b: "#545e84", c: "#ffe066" } },   // 第 2 輪：圓頂石碑（原本跟寶箱一樣是方塊）
  crack: { rows: ["aaaaaaa", "abbcbba", "abcbbba", "abbcbba", "abbbcba", "abbcbba", "aaaaaaa"], col: { a: "#5a2a20", b: "#b05a2a", c: "#140a18" } },
  seal: { rows: ["aaaaaaa", "abbcbba", "abcccba", "acccccа".replace("а", "a"), "abcbcba", "abbbbba", "aaaaaaa"], col: { a: "#2a2e48", b: "#3c4466", c: "#ffe066" } },
  shroom: { rows: [".aaaaa.", "abcbbba", "abbbcba", "aaaaaaa", "..ddd..", "..ddd..", "......."], col: { a: "#2a6a2a", b: "#5ac84a", c: "#e8ffd8", d: "#c8b08a" } },
  wind: { rows: ["...a...", "..aaa..", ".a.a.a.", "...a...", "...a...", "...a...", "...b..."], col: { a: "#7ac8f0", b: "#3a7aa8" } },
  done: { rows: ["......", ".a..a.", "..aa..", "..aa..", ".a..a.", "......"], col: { a: "#5a5274" } },
};
/** 畫一張地圖：solidAt(x, y)（世界座標）、seen（字串，'1'＝走過）、marks [{ icon, x, y, dim }] */
export function renderMap({ w, h, theme, solidAt, platforms, seen, marks }) {
  const mw = Math.ceil(w / K), mh = Math.ceil(h / K), px = new Array(mw * mh).fill(FOG);
  const cw = Math.ceil(w / CELL), T = THEME[theme] ?? THEME.abyss;
  const isSeen = (mx, my) => mx >= 0 && my >= 0 && mx < mw && my < mh && seen[Math.floor((my * K) / CELL) * cw + Math.floor((mx * K) / CELL)] === "1";
  for (let my = 0; my < mh; my++) for (let mx = 0; mx < mw; mx++) {
    const i = my * mw + mx;
    if (!isSeen(mx, my)) {
      // 第 2 輪：迷霧邊緣（旁邊就是走過的地方）一圈淡青色，像地圖的邊界，不會一刀切（第 3 輪：再亮一點，原本看不出來）
      const rim = isSeen(mx - 1, my) || isSeen(mx + 1, my) || isSeen(mx, my - 1) || isSeen(mx, my + 1);
      px[i] = rim ? "#2a7a94" : (mx + my) % 4 === 0 ? FOG2 : FOG;
      continue;
    }
    const s = solidAt(mx * K + 4, my * K + 4);
    if (!s) { px[i] = AIR; continue; }
    const up = !solidAt(mx * K + 4, my * K - 4), side = !solidAt(mx * K - 4, my * K + 4) || !solidAt(mx * K + 12, my * K + 4);
    px[i] = up ? T.top : side ? T.edge : T.solid;
  }
  for (const p of platforms) for (let x = Math.floor(p.x / K); x < Math.ceil((p.x + p.w) / K); x++) { const y = Math.floor(p.y / K); if (isSeen(x, y)) px[y * mw + x] = PLAT; }
  // 標記（只畫走過的地方的；放大後才畫，所以這裡只回傳位置）
  return { w: mw, h: mh, px, marks: marks.filter((m) => m.always || isSeen(Math.floor(m.x / K), Math.floor(m.y / K))).map((m) => ({ ...m, mx: m.x / K, my: m.y / K })) };
}
/** 把一個標記畫進放大 s 倍的像素陣列（put(x, y, "#rrggbb")）。(cx, cy)＝放大後的位置（圖示底部中心） */
export function stampIcon(put, name, cx, cy, s = 1) {
  const I = ICON[name];
  if (!I) return;
  const n = I.rows.length, w = I.rows[0].length, x0 = Math.round(cx - (w * s) / 2), y0 = Math.round(cy - n * s);
  const at = (i, j) => I.rows[j]?.[i] && I.rows[j][i] !== ".";
  for (let j = -1; j <= n; j++) for (let i = -1; i <= w; i++) {
    const c = at(i, j) ? I.col[I.rows[j][i]] : (at(i + 1, j) || at(i - 1, j) || at(i, j + 1) || at(i, j - 1)) ? "#05040a" : null;
    if (!c) continue;
    for (let b = 0; b < s; b++) for (let a = 0; a < s; a++) put(x0 + i * s + a, y0 + j * s + b, c);
  }
}

// ---------- 遊戲裡的地圖視窗 ----------
export function createMapView({ stageId, name, layout, solidAt, platforms, profile, getMarks, onOpen, onClose }) {
  profile.mapSeen ??= {};
  const cw = Math.ceil(layout.w / CELL), ch = Math.ceil(layout.h / CELL);
  let seen = (profile.mapSeen[stageId] ?? "").padEnd(cw * ch, "0").slice(0, cw * ch).split("");
  let dirty = false, open = false;
  const root = document.createElement("div");
  root.id = "mapWin";
  root.className = "win hidden";
  root.innerHTML = `<div class="win-box theme-sys map-box"><div class="win-head"><b class="win-ttl">地圖　${name}</b><span class="map-pct"></span><button class="win-x map-x" aria-label="關閉">✕</button></div><div class="map-wrap"><canvas class="map-cv"></canvas></div><div class="map-legend"></div></div>`;
  document.getElementById("stage").appendChild(root);
  const cv = root.querySelector(".map-cv"), g = cv.getContext("2d");
  root.querySelector(".map-x").addEventListener("click", (e) => { e.stopPropagation(); hide(); });
  root.addEventListener("pointerdown", (e) => { e.stopPropagation(); if (e.target === root) hide(); });
  // 圖例
  const LEG = [["player", "你"], ["altarOn", "祭壇"], ["exit", "出口"], ["ember", "星之殘火"], ["vein", "礦脈"], ["fossil", "化石核"], ["safe", "寶箱"], ["stele", "碑文"], ["crack", "裂牆"], ["seal", "封印"], ["shroom", "黏液菇"], ["wind", "氣流"]];
  const legend = root.querySelector(".map-legend");
  for (const [icon, label] of LEG) {
    const c = document.createElement("canvas"); c.width = 9; c.height = 9;
    const cg = c.getContext("2d"); stampIcon((x, y, col) => { cg.fillStyle = col; cg.fillRect(x, y, 1, 1); }, icon, 4.5, 8, 1);
    const span = document.createElement("span"); span.append(c, label); legend.appendChild(span);
  }

  /** 每幀：鏡頭看得到的範圍算走過 */
  let acc = 0;
  function update(dt, camX, camY, W, H) {
    if ((acc += dt) < 0.25) return;
    acc = 0;
    for (let y = Math.floor(camY / CELL); y <= Math.floor((camY + H) / CELL); y++) for (let x = Math.floor(camX / CELL); x <= Math.floor((camX + W) / CELL); x++) {
      if (x < 0 || y < 0 || x >= cw || y >= ch) continue;
      const i = y * cw + x;
      if (seen[i] !== "1") { seen[i] = "1"; dirty = true; }
    }
    if (dirty) { profile.mapSeen[stageId] = seen.join(""); dirty = false; }
  }
  function render() {
    const m = renderMap({ w: layout.w, h: layout.h, theme: layout.theme, solidAt, platforms, seen: seen.join(""), marks: getMarks() });
    const S = 2;   // 放大 2 倍（地圖 1 格＝畫面 2 px）
    cv.width = m.w * S; cv.height = m.h * S;
    const img = g.createImageData(cv.width, cv.height), d = img.data;
    const put = (x, y, hx) => { if (x < 0 || y < 0 || x >= cv.width || y >= cv.height) return; const i = (y * cv.width + x) * 4; d[i] = parseInt(hx.slice(1, 3), 16); d[i + 1] = parseInt(hx.slice(3, 5), 16); d[i + 2] = parseInt(hx.slice(5, 7), 16); d[i + 3] = 255; };
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) { const c = m.px[y * m.w + x]; for (let b = 0; b < S; b++) for (let a = 0; a < S; a++) put(x * S + a, y * S + b, c); }
    for (const k of m.marks.sort((a, b) => (a.icon === "player") - (b.icon === "player"))) stampIcon(put, k.dim ? "done" : k.icon, k.mx * S, k.my * S, k.icon === "player" ? 2 : 1);
    g.putImageData(img, 0, 0);
    const pct = Math.round((seen.filter((c) => c === "1").length / seen.length) * 100);
    root.querySelector(".map-pct").textContent = `探索 ${pct}%`;
  }
  function show() { if (open) return; open = true; root.classList.remove("hidden"); render(); onOpen?.(root.querySelector(".win-box")); }
  function hide() { if (!open) return; open = false; root.classList.add("hidden"); onClose?.(); }
  return { update, show, hide, toggle: () => (open ? hide() : show()), get open() { return open; } };
}
