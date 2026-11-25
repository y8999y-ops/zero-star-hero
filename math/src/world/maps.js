// 大地圖的資料：每張地圖的圖、哪裡能走、物件（照 y 排前後）、NPC、會觸發事情的地方。
// 地圖座標＝地圖圖片的像素（一格 16）。角色位置是「腳底」。
// 圖的來源與版面：art/2-草稿/island-look/build_island.py（out/layout.json）。

const WELL = { x: 372, y: 190, cx: 453, cy: 293, rx: 66, ry: 36 };   // 井的左上角、外圈石板的中心與半徑
const DOCK = { x: 812, y: 203 };
const ISLAND = [40, 40, 860, 560];
const POND = [110, 380, 110, 109];

export const MAPS = {
  island: {
    name: "學院島",
    size: [1024, 640],
    art: { ground: "island/ground.png", well: "island/well.png", dock: "island/dock.png" },
    start: { x: 880, y: 292, dir: "left" },          // 剛下浮空船
    /** 這一點能不能走（腳底） */
    walkable(x, y) {
      const [x0, y0, x1, y1] = ISLAND;
      const onIsland = x > x0 + 8 && x < x1 - 4 && y > y0 + 24 && y < y1 - 12;
      const onDeck = x >= DOCK.x + 30 && x <= DOCK.x + 99 && y >= DOCK.y + 76 && y <= DOCK.y + 102;
      if (!onIsland && !onDeck) return false;
      // 水池
      if (x > POND[0] + 8 && x < POND[0] + POND[2] - 8 && y > POND[1] + 10 && y < POND[1] + POND[3] - 6) return false;
      // 井（外圈石板可以走一點點，井身不能）
      const dx = (x - WELL.cx) / (WELL.rx * 0.72), dy = (y - (WELL.cy - 6)) / (WELL.ry * 0.8);
      if (dx * dx + dy * dy < 1) return false;
      // 碼頭左邊的石牆和樹叢
      // （中間留一條路接到棧橋：路的高度 y 282～305）
      if (x >= DOCK.x && x < DOCK.x + 30 && y >= DOCK.y + 30 && y < DOCK.y + 112 && !(y > DOCK.y + 76 && y < DOCK.y + 103)) return false;
      return true;
    },
    // 物件：畫的位置、照哪一條 y 排前後（角色腳底在這條線上面就畫在物件後面）
    objects: [
      { art: "well", x: WELL.x, y: WELL.y, base: WELL.cy + 6 },
      { art: "dock", x: DOCK.x, y: DOCK.y, base: DOCK.y + 60, ship: { x: 98 } },   // ship：x 以右的浮空船會輕輕上下浮
    ],
    npcs: [
      { id: "dean", x: 360, y: 330, name: "圓周院長" },
    ],
    // 走到附近按「調查」或點一下：觸發事情
    spots: [
      { id: "well", x: WELL.cx, y: WELL.cy + 30, r: 52, label: "共鳴之井" },
      { id: "ship", x: 905, y: 290, r: 26, label: "浮空船" },
      { id: "garden", x: 70, y: 293, r: 34, label: "往星芽花園", auto: true },
      { id: "library", x: 453, y: 78, r: 34, label: "往千頁圖書館", auto: true },
    ],
    // 灑在地圖上的小動態
    ambient: { sparkle: [WELL.cx, WELL.cy - 20], butterflies: [[640, 420], [250, 160]] },
  },
};
