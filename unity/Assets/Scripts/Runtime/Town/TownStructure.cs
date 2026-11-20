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
        static int FLOOR => TownArt.FLOOR;
        // 城鎮的寬高每次都讀 TownArt（擴大碎星鎮時改成不是固定值也能用；陣列都在 Build 時照當時的大小配）
        static int TOWN_W => TownArt.TOWN_W; static int H => TownArt.H;

        /// 世界座標每一格的結構類別（城鎮寬×高）
        public static byte[] Cls { get; private set; }
        /// 找到的位置（除錯用）：名稱、左上角
        public static readonly System.Collections.Generic.List<(string name, int x, int y, int w, int h)> Placed = new System.Collections.Generic.List<(string, int, int, int, int)>();

        /// 載入時叫一次。Resources/Art/town/structure/ 裡的每一張結構圖（檔名＝建築名稱）都讀進來，在整個城鎮裡找跟它剪影吻合的地方，
        /// 找到幾處就貼幾處（擴大碎星鎮、多放幾棟、同一棟放兩次都會自動對上）。新的建築只要多放一張結構圖。
        public static void Build(uint[] main, WorldComposition layout = null)
        {
            Cls = new byte[TOWN_W * H]; Placed.Clear();
            foreach (var ta in Resources.LoadAll<TextAsset>("Art/town/structure"))   // 只有這一層（建築原圖放在旁邊的 structure-art）
            {
                string name = ta.name;
                var tex = new Texture2D(2, 2, TextureFormat.RGBA32, false);
                if (!tex.LoadImage(ta.bytes)) { Debug.LogWarning("[TownStructure] 結構圖讀不出來 " + name); UnityEngine.Object.DestroyImmediate(tex); continue; }
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
                // 用建築原圖的像素比對（Resources/Art/town/structure-art/<名稱>）：烘焙進城鎮的是原圖的像素，完全一樣才算，
                // 不會把旅館認到工坊上。原圖跟結構圖要一樣大（換了建築的圖，結構圖要重做）
                var at = Resources.Load<TextAsset>("Art/town/structure-art/" + name);
                if (at == null) { Debug.LogWarning("[TownStructure] 缺建築原圖 structure-art/" + name); continue; }
                var t2 = new Texture2D(2, 2, TextureFormat.RGBA32, false); t2.LoadImage(at.bytes);
                if (t2.width != w || t2.height != h) { Debug.LogWarning($"[TownStructure] {name} 的原圖 {t2.width}×{t2.height} 跟結構圖 {w}×{h} 不一樣大：結構圖要重做"); UnityEngine.Object.DestroyImmediate(t2); continue; }
                var ap = t2.GetPixels32(); UnityEngine.Object.DestroyImmediate(t2);
                var art = new uint[w * h]; var opq = new System.Collections.Generic.List<int>();
                for (int y = 0; y < h; y++) for (int x = 0; x < w; x++)
                {
                    var c = ap[(h - 1 - y) * w + x]; if (c.a < 128) continue;
                    art[y * w + x] = 0xff000000u | ((uint)c.b << 16) | ((uint)c.g << 8) | c.r; opq.Add(y * w + x);
                }
                if (opq.Count == 0) continue;
                // 抽 64 格當快篩，全部吻合（容許 4 格不同）才細看全部
                var probe = new int[Math.Min(64, opq.Count)]; for (int i = 0; i < probe.Length; i++) probe[i] = opq[(int)((long)i * opq.Count / probe.Length)];
                int Match(int ox, int oy, int[] idx)
                {
                    int m = 0;
                    foreach (int k in idx)
                    {
                        int wx = ox + k % w, wy = oy + k / w;
                        if (wx >= 0 && wx < TOWN_W && wy >= 0 && wy < H && (main[wy * TOWN_W + wx] | 0xff000000u) == art[k]) m++;
                    }
                    return m;
                }
                var all = opq.ToArray();
                int ey = FLOOR + 1 - bottom;   // 建築的底部大多對齊地面：上下各找 40 格（擺放工具可能移過）
                var sw = System.Diagnostics.Stopwatch.StartNew();
                bool AlreadyPlaced(int ox, int oy) =>
                    Placed.Exists(p => p.name == name && Math.Abs(p.x - ox) < w / 2 && Math.Abs(p.y - oy) < h / 2);
                void Place(int ox, int oy)
                {
                    if (AlreadyPlaced(ox, oy)) return;
                    for (int y = 0; y < h; y++) for (int x = 0; x < w; x++)
                    {
                        byte v = cls[y * w + x]; if (v == 0) continue;
                        int wx = ox + x, wy = oy + y; if (wx < 0 || wx >= TOWN_W || wy < 0 || wy >= H) continue;
                        Cls[wy * TOWN_W + wx] = v;
                    }
                    Placed.Add((name, ox, oy, w, h));
                }
                // 用擺設的原圖像素比對，可辨認前方被路燈、花草蓋住的店家。
                if (layout != null)
                    foreach (var pos in layout.MatchingTownArt(name, w, h, art, probe)) Place(pos.x, pos.y);
                for (int oy = ey - 40; oy <= ey + 40; oy++) for (int ox = -w + 1; ox < TOWN_W; ox++)
                {
                    if (Match(ox, oy, probe) < probe.Length - 4) continue;
                    int m = Match(ox, oy, all);
                    if (m < all.Length * 0.9) continue;   // 九成以上像素一樣（前面被角色、裝飾擋住一點也找得到）
                    Place(ox, oy);
                }
                if (TownRainHits.DebugLog) Debug.Log($"[TownStructure] 找 {name} 花了 {sw.ElapsedMilliseconds} ms");
                if (!Placed.Exists(p => p.name == name)) Debug.Log("[TownStructure] 城鎮裡找不到 " + name + "（這次沒有擺這棟，或建築的圖換了、結構圖要重做）");
            }
        }
        public static byte At(int x, int y) => Cls == null || x < 0 || x >= TOWN_W || y < 0 || y >= H ? NONE : Cls[y * TOWN_W + x];
    }
}
