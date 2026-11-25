// 大地圖的資料：每張地圖的圖、哪裡能走、物件（照 y 排前後）、NPC、會觸發事情的地方。
// 地圖座標＝地圖圖片的像素（一格 16）。角色位置是「腳底」。
// 版面（物件、小物件的位置）由拼圖的腳本輸出成 assets/map/<地圖>/layout.json：
//   學院島：art/2-草稿/island-look/build_island.py
//   星芽花園：art/2-草稿/garden-map/build_garden.py
// 地圖的規則可以看存檔（s）：例如花園的封印門打完三群墨水怪才會打開。

const base = new URL("../../assets/map/", import.meta.url);
const cache = {};

/** 小物件的碰撞：腳底一小塊（樹只有樹幹） [寬的比例, 高幾格] */
const FOOTPRINT = { tree: [0.25, 8], pine: [0.25, 8], tree_s: [0.3, 7], bush: [0.8, 9], lamp: [0.3, 5], sign: [0.3, 5], bench: [0.85, 10], urn: [0.6, 8], planter: [0.9, 10], scope: [0.5, 6], crystal: [0.7, 10], board: [0.9, 6], barrel: [0.85, 10], crate: [0.9, 12], fountain: [0.9, 26] };
function propBoxes(props) {
  return props.map((p) => {
    const [kw, kh] = FOOTPRINT[p.art] ?? [0.7, 8];
    const w = p.w * kw, fx = p.x + p.w / 2, fy = p.y + p.h - 2;
    return [fx - w / 2, fy - kh, fx + w / 2, fy + 1];
  });
}
const inBox = (x, y, b) => x > b[0] && x < b[2] && y > b[1] && y < b[3];
const propObjects = (dir, props) => props.map((p) => ({ art: p.art, file: `${dir}/${p.art}.png`, x: p.x, y: p.y, base: p.y + p.h - 4 }));

const DEF = {
  island(L) {
    const [x0, y0, x1, y1] = L.island;
    const W = L.objects.well.at, WELL = { cx: W[0] + 81, cy: W[1] + 103, rx: 66, ry: 36 };
    const D = L.objects.dock.at, DOCK = { x: D[0], y: D[1] };
    const LB = L.objects.library, LIB = { x: LB.at[0], y: LB.at[1], w: LB.size[0], h: LB.size[1] };
    const P = [L.pond.at[0], L.pond.at[1], L.pond.size[0], L.pond.size[1]];
    const boxes = propBoxes(L.props);
    const door = { x: LIB.x + LIB.w / 2, y: LIB.y + LIB.h - 6 };
    return {
      id: "island", name: "學院島", size: L.size,
      ground: "island/ground.png",
      start: { x: 880, y: WELL.cy - 1, dir: "left" },      // 剛下浮空船
      walkable(x, y) {
        const onIsland = x > x0 + 8 && x < x1 - 4 && y > y0 + 24 && y < y1 - 12;
        const onDeck = x >= DOCK.x + 30 && x <= DOCK.x + 99 && y >= DOCK.y + 76 && y <= DOCK.y + 102;
        const westRoad = x > x0 - 2 && x <= x0 + 10 && Math.abs(y - WELL.cy) < 10;   // 往西的路接到島的邊緣（花園入口）
        if (!onIsland && !onDeck && !westRoad) return false;
        if (x > P[0] + 8 && x < P[0] + P[2] - 8 && y > P[1] + 10 && y < P[1] + P[3] - 6) return false;
        const dx = (x - WELL.cx) / (WELL.rx * 0.72), dy = (y - (WELL.cy - 6)) / (WELL.ry * 0.8);
        if (dx * dx + dy * dy < 1) return false;
        if (x >= DOCK.x && x < DOCK.x + 30 && y >= DOCK.y + 30 && y < DOCK.y + 112 && !(y > DOCK.y + 76 && y < DOCK.y + 103)) return false;
        // 圖書館：整棟不能走，只有正門前的樓梯可以走到門口
        if (x > LIB.x + 6 && x < LIB.x + LIB.w - 6 && y > LIB.y + 60 && y < LIB.y + LIB.h - 8 && !(Math.abs(x - door.x) < 26 && y > LIB.y + LIB.h - 36)) return false;
        for (const b of boxes) if (inBox(x, y, b)) return false;
        return true;
      },
      objects: [
        { art: "well", file: "island/well.png", x: W[0], y: W[1], base: WELL.cy + 6 },
        { art: "dock", file: "island/dock.png", x: DOCK.x, y: DOCK.y, base: DOCK.y + 60, ship: { x: 98 } },   // ship：x 以右的浮空船會輕輕上下浮
        { art: "library", file: "island/library.png", x: LIB.x, y: LIB.y, base: LIB.y + LIB.h - 30 },
        ...propObjects("island", L.props),
      ],
      npcs: [{ id: "dean", x: WELL.cx - 95, y: WELL.cy + 36, name: "圓周院長" }],
      spots: [
        { id: "well", x: WELL.cx, y: WELL.cy + 30, r: 52, label: "共鳴之井" },
        { id: "ship", x: DOCK.x + 92, y: DOCK.y + 88, r: 26, label: "浮空船" },
        { id: "toGarden", x: x0 + 2, y: WELL.cy, r: 26, label: "往星芽花園", auto: true },
        { id: "library", x: door.x, y: door.y, r: 22, label: "千頁圖書館", auto: true },
      ],
      // 從別的地方回來時站的位置
      arrive: { garden: { x: x0 + 34, y: WELL.cy, dir: "right" }, library: { x: door.x, y: door.y + 26, dir: "down" } },
      ambient: { sparkle: [WELL.cx, WELL.cy - 20], butterflies: [[640, 620], [250, 360], [560, 180]] },
    };
  },

  garden(L, s) {
    const boxes = propBoxes(L.props);
    const G = L.gate, gateOpen = () => [0, 1, 2].every((k) => (s.stars[`g1-${k + 1}`] ?? 0) > 0);
    const roads = L.roads.map(([k, a, b, c]) => (k === "h" ? [a - 2, c - 13, b + 2, c + 13] : [c - 13, a - 2, c + 13, b + 2]));
    const clearing = [36, 266, 194, 404];
    return {
      id: "garden", name: "星芽花園", size: L.size,
      ground: "garden/ground.png",
      grade: "g1",
      gray: () => !s.stars["g1-boss"],                     // 王打倒前整片花園是墨水灰
      start: { x: L.entry.x - 10, y: L.entry.y, dir: "left" },
      walkable(x, y) {
        if (x < 30 || x > L.size[0] - 2 || y < 70 || y > L.size[1] - 20) return false;
        // 封印門：還沒打開就擋住往王那邊的路
        if (!gateOpen() && x > G.x - 4 && x < G.x + G.w + 4 && y > G.y + 10 && y < G.y + G.h + 6) return false;
        if (!gateOpen() && x < G.x) return false;
        for (const b of boxes) if (inBox(x, y, b)) return false;
        return true;
      },
      objects: [
        ...L.inks.map((p) => ({ art: p.art, file: `garden/${p.art}.png`, x: p.x, y: p.y, base: -1, ink: true })),   // 墨水水窪：平平貼在地上，恢復色彩後消失
        { art: "gate", file: "garden/gate.png", x: G.x, y: G.y, base: G.y + G.h - 6, gate: true, hidden: gateOpen },
        ...propObjects("garden", L.props),
      ],
      npcs: [],
      // 地圖上遊蕩的墨水怪（第 1～3 關）＋王。打過的不見（王打倒後全部不見）
      monsters: [
        ...L.groups.map((g, i) => ({ id: `m${i}`, kind: i === 1 ? "flower" : "ink", stage: g.stage, x: g.x, y: g.y, home: [g.x, g.y], gone: () => (s.stars[`g1-${g.stage + 1}`] ?? 0) > 0 })),
        { id: "boss", kind: "king", boss: true, x: L.boss.x, y: L.boss.y, home: [L.boss.x, L.boss.y], gone: () => (s.stars["g1-boss"] ?? 0) > 0, still: true, face: 1 },
      ],
      spots: [
        { id: "toIsland", x: L.size[0] - 4, y: L.entry.y, r: 22, label: "回學院島", auto: true },
        { id: "gate", x: G.x + G.w / 2 + 14, y: G.y + G.h + 4, r: 30, label: "墨水封印門", hidden: gateOpen },
        { id: "gardenSign", x: 960, y: 318, r: 24, label: "路牌" },
      ],
      arrive: { island: { x: L.size[0] - 30, y: L.entry.y, dir: "left" } },
      ambient: { butterflies: [[700, 200], [300, 560]], petals: true },
      roads, clearing,
    };
  },
};

/** 讀一張地圖（layout.json＋規則）。s：存檔（規則會看進度） */
export async function loadMap(id, s) {
  if (!cache[id]) cache[id] = await (await fetch(new URL(`${id}/layout.json`, base))).json();
  return DEF[id](cache[id], s);
}
