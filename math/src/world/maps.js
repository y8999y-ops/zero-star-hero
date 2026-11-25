// 大地圖的資料：每張地圖的圖、哪裡能走、物件（照 y 排前後）、NPC、會觸發事情的地方。
// 地圖座標＝地圖圖片的像素（一格 16）。角色位置是「腳底」。
// 版面（物件、小物件的位置）由拼圖的腳本輸出成 assets/map/<地圖>/layout.json：
//   學院島：art/2-草稿/island-look/build_island.py
//   星芽花園：art/2-草稿/garden-map/build_garden.py
// 地圖的規則可以看存檔（s）：例如花園的封印門打完三群墨水怪才會打開。

import { STUDENTS, PAGES, CHESTS, seeded, daily, today } from "./island-life.js";
import { pageFrame, chestFrame } from "../../fx/pickups.js";
import { MENTORS } from "../../fx/mentor.js";

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

export const DEF = {
  // 學院島 v5：三層台地、中軸線、水道（docs/地圖設計.md）。能走的地方是拼圖腳本算好的格子（L.walk），這裡不手寫地形
  island(L, s, dir) {
    const cell = L.cell, grid = L.walk, GW = grid[0].length, GH = grid.length;
    const onGrid = (x, y) => { const i = Math.floor(x / cell), j = Math.floor(y / cell); return i >= 0 && j >= 0 && i < GW && j < GH && grid[j][i] === "1"; };
    const W = L.objects.well.at, WELL = { cx: W[0] + 81, cy: W[1] + 103, rx: 66, ry: 36 };
    const D = L.objects.dock.at, DOCK = { x: D[0], y: D[1] };
    const boxes = propBoxes(L.props);
    const B = Object.fromEntries(L.buildings.map((b) => [b.art, b]));
    const lib = B.library;
    const inBuilding = (x, y) => L.buildings.some((b) => {
      const bottom = b.y + b.h;
      if (!(x > b.x + 6 && x < b.x + b.w - 6 && y > b.y + b.h * 0.3 && y < bottom - 4)) return false;
      return !(Math.abs(x - b.door[0]) < 16 && y > bottom - 22);          // 門口的樓梯可以走上去
    });
    const FXB = [[B.fire.x - 16, B.fire.y + B.fire.h - 6, 12], [B.fire.x + B.fire.w + 16, B.fire.y + B.fire.h - 6, 12],
      [B.ice.x - 14, B.ice.y + B.ice.h - 30, 10], [B.ice.x + B.ice.w + 14, B.ice.y + B.ice.h - 30, 10],
      [B.thunder.x - 18, B.thunder.y + B.thunder.h - 4, 14], [B.thunder.x + B.thunder.w + 26, B.thunder.y + B.thunder.h - 4, 16],
      [B.water.x - 34, B.water.y + B.water.h - 6, 22]];
    const map = {
      id: "island", name: "學院島", size: L.size,
      ground: `${dir}/ground.png`,
      overlay: `${dir}/clouds-front.png`,          // 島南邊蓋在斷崖前面的雲（最上層）
      start: { x: L.start[0], y: L.start[1], dir: "left" },      // 剛下浮空船
      walkable(x, y) {
        if (!onGrid(x, y)) return false;                            // 地形（島、崖、水道、井）
        if (x >= DOCK.x && x < DOCK.x + 30 && y >= DOCK.y + 30 && y < DOCK.y + 112 && !(y > DOCK.y + 76 && y < DOCK.y + 103)) return false;
        if (inBuilding(x, y)) return false;
        for (const f of FXB) if (Math.hypot(x - f[0], (y - f[1]) * 1.6) < f[2]) return false;   // 火盆、冰晶這些特效站的地方
        for (const b of boxes) if (inBox(x, y, b)) return false;
        return true;
      },
      objects: [
        { art: "well", file: `${dir}/well.png`, x: W[0], y: W[1], base: WELL.cy + 6 },
        { art: "dock", file: `${dir}/dock.png`, x: DOCK.x, y: DOCK.y, base: DOCK.y + 60, ship: { x: 98 } },
        ...L.buildings.map((b) => ({ art: b.art, file: `${dir}/${b.art}.png`, x: b.x, y: b.y, base: b.y + b.h - 24 })),
        ...propObjects(dir, L.props),
      ],
      npcs: [
        { id: "dean", x: WELL.cx - 120, y: WELL.cy + 52, name: "圓周院長" },
        // 五位導師：站在自己學院門口的右邊
        ...["fire", "water", "ice", "forest", "thunder"].map((k) => ({ id: `m_${k}`, mentor: k, name: MENTORS[k].name, x: B[k].door[0] + 34, y: B[k].door[1] + 14 })),
        // 同學：散在廣場、商店、宿舍、溫室、鐘塔、圖書館附近
        ...STUDENTS.map((st, i) => {
          const at = [[WELL.cx + 120, WELL.cy + 60], [B.shop.door[0] + 40, B.shop.door[1] + 16], [B.dorm.door[0] - 36, B.dorm.door[1] + 16],
            [B.greenhouse.door[0] - 50, B.greenhouse.door[1] + 18], [B.clock.door[0] - 34, B.clock.door[1] + 16], [lib.door[0] + 70, lib.door[1] + 30]][i];
          return { id: st.id, student: st, name: st.name, x: at[0], y: at[1] };
        }),
      ],
      spots: [
        { id: "well", x: WELL.cx, y: WELL.cy + 30, r: 52, label: "共鳴之井" },
        { id: "ship", x: DOCK.x + 92, y: DOCK.y + 88, r: 26, label: "浮空船" },
        { id: "toGarden", x: L.toGarden[0], y: L.toGarden[1], r: 24, label: "往星芽花園", auto: true },
        { id: "library", x: lib.door[0], y: lib.door[1] - 4, r: 20, label: "千頁圖書館", auto: true },
        ...L.buildings.filter((b) => b.art !== "library").map((b) => ({ id: `b_${b.art}`, x: b.door[0], y: b.door[1] + 4, r: 26, label: BUILDING_NAME[b.art] })),
      ],
      board: L.props.find((p) => p.art === "board"),
      arrive: { garden: { x: L.arriveGarden[0], y: L.arriveGarden[1], dir: "right" }, library: { x: lib.door[0], y: lib.door[1] + 22, dir: "down" } },
      ambient: { sparkle: [WELL.cx, WELL.cy - 20], butterflies: [[640, 900], [300, 500], [980, 500]], zones: L.zones },
      // 學院周圍的特色特效（pixelfx）：火盆、冰晶、電漿球、電弧、噴泉、落葉
      fx: [
        { fx: "brazier", x: B.fire.x - 16, y: B.fire.y + B.fire.h - 6 }, { fx: "brazier", x: B.fire.x + B.fire.w + 16, y: B.fire.y + B.fire.h - 6 },
        { fx: "iceCrystal", x: B.ice.x - 14, y: B.ice.y + B.ice.h - 30 }, { fx: "iceCrystal", x: B.ice.x + B.ice.w + 14, y: B.ice.y + B.ice.h - 30 },
        { fx: "plasmaBall", x: B.thunder.x - 18, y: B.thunder.y + B.thunder.h - 4 }, { fx: "sparkArc", x: B.thunder.x + B.thunder.w + 26, y: B.thunder.y + B.thunder.h - 4 },
        { fx: "fountain", x: B.water.x - 34, y: B.water.y + B.water.h - 6 },
        // 落葉特效拿掉了（會在地上留一堆橘紅色的落葉，看起來很亂）
      ],
    };
    // ── 撿得到、打得開的東西：放在島上能走、離建築遠一點的地方（位置固定，不會每次換） ──
    const spotsFree = (n, seed, used) => {
      const r = seeded(seed), out = [];
      for (let k = 0; k < 4000 && out.length < n; k++) {
        const x = r() * L.size[0], y = r() * L.size[1];
        if (!map.walkable(x, y) || !map.walkable(x - 12, y) || !map.walkable(x + 12, y) || !map.walkable(x, y - 14)) continue;
        if ([...used, ...out].some((p) => Math.hypot(p[0] - x, p[1] - y) < 90)) continue;
        if (L.buildings.some((b) => Math.hypot(b.door[0] - x, b.door[1] - y) < 70)) continue;
        out.push([Math.round(x), Math.round(y)]);
      }
      return out;
    };
    const used = [[WELL.cx, WELL.cy], ...map.npcs.map((n) => [n.x, n.y])];
    // 書頁、寶箱：拼圖腳本選好的角落（L.pageSpots、L.chestSpots）；沒有的話才隨便找空地
    const pagePos = L.pageSpots ?? spotsFree(PAGES.length, "pages", used); used.push(...pagePos);
    const chestPos = L.chestSpots ?? spotsFree(CHESTS.length, "chests", used); used.push(...chestPos);
    const inkPos = spotsFree(3, `ink-${today()}`, used);
    const inkDir = dir.replace("island", "garden");
    s.pages ??= []; s.chests ??= [];
    pagePos.forEach(([x, y], i) => {
      map.objects.push({ art: `page${i}`, frame: () => pageFrame(i * 0.13), x: x - 8, y: y - 16, base: y, hidden: () => s.pages.includes(i) });
      map.spots.push({ id: `page_${i}`, x, y, r: 16, label: "發光的書頁", auto: true, hidden: () => s.pages.includes(i) });
    });
    chestPos.forEach(([x, y], i) => {
      map.objects.push({ art: `chest${i}`, frame: () => chestFrame(false), x: x - 13, y: y - 20, base: y, hidden: () => s.chests.includes(i) });
      map.objects.push({ art: `chestOpen${i}`, frame: () => chestFrame(true), x: x - 13, y: y - 20, base: y, hidden: () => !s.chests.includes(i) });
      map.spots.push({ id: `chest_${i}`, x, y: y + 8, r: 24, label: "數字鎖寶箱", hidden: () => s.chests.includes(i) });
    });
    inkPos.forEach(([x, y], i) => {
      map.objects.push({ art: `inkspot${i}`, file: `${inkDir}/ink${[4, 5, 9][i]}.png`, x: x - 10, y: y - 6, base: -1, hidden: () => daily(s).ink.includes(i) });
      map.spots.push({ id: `ink_${i}`, x, y, r: 14, label: "墨水小點", auto: true, hidden: () => daily(s).ink.includes(i) });
    });
    if (map.board) map.spots.push({ id: "board", x: map.board.x + map.board.w / 2, y: map.board.y + map.board.h + 8, r: 26, label: "布告欄" });
    return map;
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
  const dir = s.settings?.mapArt === "raw" ? `${id}-raw` : id;      // 預設像素（使用者 2026-11-25 決定全部像素）
  if (!cache[dir]) cache[dir] = await (await fetch(new URL(`${dir}/layout.json`, base))).json();
  return DEF[id](cache[dir], s, dir);
}
