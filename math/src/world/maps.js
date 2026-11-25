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
export const BUILDING_NAME = { forest: "翠森苑", thunder: "紫雷閣", water: "蒼流館", ice: "白霜堂", fire: "赤焰塔", dorm: "宿舍", shop: "學院商店", greenhouse: "分晶溫室", clock: "刻度鐘塔", library: "千頁圖書館" };
const inBox = (x, y, b) => x > b[0] && x < b[2] && y > b[1] && y < b[3];
const propObjects = (dir, props) => props.map((p) => ({ art: p.art, file: `${dir}/${p.art}.png`, x: p.x, y: p.y, base: p.y + p.h - 4 }));

const DEF = {
  // 學院島 v3：同心圓（世界觀 3.0、企劃書 3.7）
  island(L, s, dir) {
    const [icx, icy, irx, iry] = L.island;
    const W = L.objects.well.at, WELL = { cx: W[0] + 81, cy: W[1] + 103, rx: 66, ry: 36 };
    const D = L.objects.dock.at, DOCK = { x: D[0], y: D[1] };
    const boxes = propBoxes(L.props);
    const B = Object.fromEntries(L.buildings.map((b) => [b.art, b]));
    const lib = B.library;
    const westX = icx - irx;
    const inBuilding = (x, y) => L.buildings.some((b) => {
      const bottom = b.y + b.h;
      if (!(x > b.x + 6 && x < b.x + b.w - 6 && y > b.y + b.h * 0.3 && y < bottom - 4)) return false;
      return !(Math.abs(x - b.door[0]) < 16 && y > bottom - 22);          // 門口的樓梯可以走上去
    });
    return {
      id: "island", name: "學院島", size: L.size,
      ground: `${dir}/ground.png`,
      start: { x: DOCK.x + 70, y: DOCK.y + 90, dir: "left" },      // 剛下浮空船
      walkable(x, y) {
        const k = ((x - icx) / (irx - 10)) ** 2 + ((y - icy) / (iry - 16)) ** 2;
        const onDeck = x >= DOCK.x + 30 && x <= DOCK.x + 99 && y >= DOCK.y + 76 && y <= DOCK.y + 102;
        const westRoad = x > westX - 2 && x < westX + 110 && Math.abs(y - L.ewY) < 10;   // 往花園的路接到島的邊緣
        const eastRoad = x > icx + irx - 80 && x < DOCK.x + 40 && Math.abs(y - L.ewY) < 10;   // 碼頭的棧橋接到島上
        if (k >= 1 && !onDeck && !westRoad && !eastRoad) return false;
        const dx = (x - WELL.cx) / (WELL.rx * 0.72), dy = (y - (WELL.cy - 6)) / (WELL.ry * 0.8);
        if (dx * dx + dy * dy < 1) return false;
        if (x >= DOCK.x && x < DOCK.x + 30 && y >= DOCK.y + 30 && y < DOCK.y + 112 && !(y > DOCK.y + 76 && y < DOCK.y + 103)) return false;
        if (inBuilding(x, y)) return false;
        for (const b of boxes) if (inBox(x, y, b)) return false;
        return true;
      },
      objects: [
        { art: "well", file: `${dir}/well.png`, x: W[0], y: W[1], base: WELL.cy + 6 },
        { art: "dock", file: `${dir}/dock.png`, x: DOCK.x, y: DOCK.y, base: DOCK.y + 60, ship: { x: 98 } },
        ...L.buildings.map((b) => ({ art: b.art, file: `${dir}/${b.art}.png`, x: b.x, y: b.y, base: b.y + b.h - 24 })),
        ...propObjects(dir, L.props),
      ],
      npcs: [{ id: "dean", x: WELL.cx - 120, y: WELL.cy + 52, name: "圓周院長" }],
      spots: [
        { id: "well", x: WELL.cx, y: WELL.cy + 30, r: 52, label: "共鳴之井" },
        { id: "ship", x: DOCK.x + 92, y: DOCK.y + 88, r: 26, label: "浮空船" },
        { id: "toGarden", x: westX + 4, y: L.ewY, r: 24, label: "往星芽花園", auto: true },
        { id: "library", x: lib.door[0], y: lib.door[1] - 4, r: 20, label: "千頁圖書館", auto: true },
        ...L.buildings.filter((b) => b.art !== "library").map((b) => ({ id: `b_${b.art}`, x: b.door[0], y: b.door[1] + 4, r: 26, label: BUILDING_NAME[b.art] })),
      ],
      arrive: { garden: { x: westX + 60, y: L.ewY, dir: "right" }, library: { x: lib.door[0], y: lib.door[1] + 22, dir: "down" } },
      ambient: { sparkle: [WELL.cx, WELL.cy - 20], butterflies: [[640, 900], [300, 500], [980, 500]] },
    };
  },

  garden(L, s, dir) {
    const boxes = propBoxes(L.props);
    const G = L.gate, gateOpen = () => [0, 1, 2].every((k) => (s.stars[`g1-${k + 1}`] ?? 0) > 0);
    const roads = L.roads.map(([k, a, b, c]) => (k === "h" ? [a - 2, c - 13, b + 2, c + 13] : [c - 13, a - 2, c + 13, b + 2]));
    const clearing = [36, 266, 194, 404];
    return {
      id: "garden", name: "星芽花園", size: L.size,
      ground: `${dir}/ground.png`,
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
        ...L.inks.map((p) => ({ art: p.art, file: `${dir}/${p.art}.png`, x: p.x, y: p.y, base: -1, ink: true })),   // 墨水水窪：平平貼在地上，恢復色彩後消失
        { art: "gate", file: `${dir}/gate.png`, x: G.x, y: G.y, base: G.y + G.h - 6, gate: true, hidden: gateOpen },
        ...propObjects(dir, L.props),
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

/** 讀一張地圖（layout.json＋規則）。s：存檔（規則會看進度；設定的「地圖美術」決定用原圖版還是像素重繪版） */
export async function loadMap(id, s) {
  const dir = s.settings?.art === "pixel" ? id : `${id}-raw`;
  if (!cache[dir]) cache[dir] = await (await fetch(new URL(`${dir}/layout.json`, base))).json();
  return DEF[id](cache[dir], s, dir);
}
