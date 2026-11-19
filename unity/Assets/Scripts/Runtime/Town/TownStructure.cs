// 碎星鎮建築的結構圖（Unity 版自己的）。scene-fx skill §4b。
// 結構圖是手畫的資料（art/工具/場景/structure-maps.py 產生，使用者確認過），每棟一張、跟建築原圖一樣大，標出：
//   屋頂面、擋雨區、繞開、導水線、滴水線、滴水點、接水面（顏色見 COLORS）。
// 遊戲裡建築已經烘焙進城鎮主圖層（MAIN），而且可能被擺放工具移動過，所以載入時用剪影在 MAIN 裡找出每棟的位置，
// 再把結構圖貼到世界座標（Cls：每一格一個類別，0＝沒有結構圖，照自動的做法）。
// 檔案：Resources/Art/town/structure/<名稱>.bytes（其實是 PNG，用 .bytes 才能當 TextAsset 讀進來）。
using System;
using UnityEngine;

namespace ZeroStar
{
    public static class TownStructure
    {
        public const byte NONE = 0, ROOF = 1, SHELTER = 2, AVOID = 3, GUIDE = 4, DRIP = 5, POINT = 6, LAND = 7;
        static readonly (byte r, byte g, byte b, byte cls)[] COLORS =
        {
            (70, 140, 255, ROOF), (110, 110, 120, SHELTER), (255, 150, 40, AVOID), (255, 230, 40, GUIDE),
            (255, 40, 40, DRIP), (255, 0, 255, POINT), (40, 230, 120, LAND),
        };
        // 建築原本擺的左上角 x（game/src/town.js 的 SHOPS）：在附近找
        static readonly (string name, int x0)[] SHOPS = { ("guild", 70), ("workshop", 459), ("inn", 807) };
        const int FLOOR = TownArt.FLOOR, TOWN_W = TownArt.TOWN_W, H = TownArt.H;

        /// 世界座標每一格的結構類別（城鎮寬×高）
        public static byte[] Cls { get; private set; }
        /// 找到的位置（除錯用）：名稱、左上角
        public static readonly System.Collections.Generic.List<(string name, int x, int y, int w, int h)> Placed = new System.Collections.Generic.List<(string, int, int, int, int)>();

        public static void Build(uint[] main)
        {
            Cls = new byte[TOWN_W * H]; Placed.Clear();
            foreach (var (name, x0) in SHOPS)
            {
                var ta = Resources.Load<TextAsset>("Art/town/structure/" + name);
                if (ta == null) { Debug.LogWarning("[TownStructure] 找不到結構圖 " + name); continue; }
                var tex = new Texture2D(2, 2, TextureFormat.RGBA32, false);
                if (!tex.LoadImage(ta.bytes)) { Debug.LogWarning("[TownStructure] 結構圖讀不出來 " + name); continue; }
                int w = tex.width, h = tex.height; var px = tex.GetPixels32();   // GetPixels32 第 0 列在最下面
                UnityEngine.Object.DestroyImmediate(tex);
                var cls = new byte[w * h];
                int bottom = 0;
                for (int y = 0; y < h; y++) for (int x = 0; x < w; x++)
                {
                    var c = px[(h - 1 - y) * w + x]; if (c.a < 128) continue;
                    byte v = ROOF; int best = int.MaxValue;
                    foreach (var k in COLORS) { int d = Math.Abs(c.r - k.r) + Math.Abs(c.g - k.g) + Math.Abs(c.b - k.b); if (d < best) { best = d; v = k.cls; } }
                    cls[y * w + x] = v; bottom = Math.Max(bottom, y);
                }
                // 原本的位置：底部對齊地面（town.js：y0 = FLOOR + 1 - baseRow）；在附近找剪影最吻合的地方（擺放工具可能移動過）
                int ey = FLOOR + 1 - bottom, bx = x0, by = ey; long bestScore = long.MinValue;
                long Score(int ox, int oy, int step)
                {
                    long s = 0;
                    for (int y = 0; y < h; y += step) for (int x = 0; x < w; x += step)
                    {
                        int wx = ox + x, wy = oy + y; bool inMain = wx >= 0 && wx < TOWN_W && wy >= 0 && wy < H && main[wy * TOWN_W + wx] != 0;
                        bool mine = cls[y * w + x] != 0;
                        if (mine) s += inMain ? 2 : -3; else if (inMain && wy < FLOOR - 4) s -= 1;
                    }
                    return s;
                }
                for (int oy = ey - 24; oy <= ey + 24; oy += 2) for (int ox = x0 - 80; ox <= x0 + 80; ox += 2)
                {
                    long s = Score(ox, oy, 3); if (s > bestScore) { bestScore = s; bx = ox; by = oy; }
                }
                int cx0 = bx, cy0 = by; bestScore = long.MinValue;
                for (int oy = cy0 - 2; oy <= cy0 + 2; oy++) for (int ox = cx0 - 2; ox <= cx0 + 2; ox++)
                {
                    long s = Score(ox, oy, 1); if (s > bestScore) { bestScore = s; bx = ox; by = oy; }
                }
                for (int y = 0; y < h; y++) for (int x = 0; x < w; x++)
                {
                    byte v = cls[y * w + x]; if (v == 0) continue;
                    int wx = bx + x, wy = by + y; if (wx < 0 || wx >= TOWN_W || wy < 0 || wy >= H) continue;
                    Cls[wy * TOWN_W + wx] = v;
                }
                Placed.Add((name, bx, by, w, h));
            }
        }
        public static byte At(int x, int y) => Cls == null || x < 0 || x >= TOWN_W || y < 0 || y >= H ? NONE : Cls[y * TOWN_W + x];
    }
}
