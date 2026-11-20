// 碎星鎮的雪（Unity 版自己的，不跟網頁版比對）。scene-fx skill §7。
// 參考：Mushreb〈2D游戏中的雪天效果 DEV LOG.05〉（9 張 3×3 雪花隨機選、不受重力、照風向飄、開頭結尾淡入淡出；
//       地面積雪＝雜訊＋門檻，調門檻＝堆積或融化，像素化）、pixelfx weather/snow（三層深度、左右飄、陣風、落地亮一下再消失、近的雪花結晶）。
//  1. 雪花（DrawFlakes，角色之後畫）：遠＝1 格的點；中＝9 種 3×3 形狀隨機挑、會轉；近＝雪花結晶，帶一點光。全部是時間的函式（不用存粒子）。
//  2. 積雪（DrawCover，場景畫完、角色之前畫）：地面和「從天空看下來第一個面」（屋頂、傘蓋、煙囪頂、木桶頂、招牌頂）。
//     平的地方堆得厚、斜的薄、太陡的堆不住；結構圖的擋雨區不積。厚度＝能堆多少 × 雜訊門檻（一塊一塊長出來，雪停慢慢融化）。
//     雪堆厚了會高出原本的輪廓一格，外面補一圈黑色外框（外框只能是黑色）。
// 效能：每一欄能堆多厚、雜訊都在載入時算好；每格只畫畫面內有雪的那幾格。
using System;
using PixelFX;
using static PixelFX.Pf;
using static PixelFX.Fx.WeatherLib;

namespace ZeroStar
{
    public static class TownSnow
    {
        static int FLOOR => TownArt.FLOOR;
        // 城鎮的寬高每次都讀 TownArt（擴大碎星鎮時改成不是固定值也能用；陣列都在 Build 時照當時的大小配）
        static int TOWN_W => TownArt.TOWN_W; static int H => TownArt.H;
        static readonly uint[] C = new[] { "#0c1020", "#161d36", "#24304f", "#3a4a72", "#5f74a3", "#93abd6", "#cfe0fa", "#ffffff" }.Select8();
        const uint OUTLINE = 0xff240c14;   // 專案的黑色外框（#140c24）

        static double cover = -1, lastT = -1;   // 積雪程度 0～1（-1＝剛進場，照現在的雪直接設好）
        /// 開發用（截圖）：進場時的積雪程度
        public static double? CoverStart;
        public static double Cover => Math.Max(0, cover);
        static int[] topY; static byte[] cap; static float[] nCol;
        static byte[] face;   // 結構圖的屋頂面：每一格多早會被雪蓋（0＝不會）
        static uint[] mainRef;
        public static void Reset() { cover = -1; lastT = -1; Melting = false; }
        /// 正在融雪（雪停了、還有積雪）
        public static bool Melting { get; private set; }

        static double Hash(int i, int s) { unchecked { uint h = (uint)(i * 374761393 + s * 668265263); h = (h ^ (h >> 13)) * 1274126177; h ^= h >> 16; return (h & 0xffffff) / 16777216.0; } }
        static double Noise(double x, int s) { int i = (int)Math.Floor(x); double f = x - i; f = f * f * (3 - 2 * f); return Hash(i, s) + (Hash(i + 1, s) - Hash(i, s)) * f; }
        /// 二維雜訊（一維雜訊斜著拉會出現一條條斜直線，所以屋頂面的雪用這個）
        static double Noise2(double x, double y, int s)
        {
            int ix = (int)Math.Floor(x), iy = (int)Math.Floor(y); double fx = x - ix, fy = y - iy;
            fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
            double a = Hash(ix + iy * 7919, s), b = Hash(ix + 1 + iy * 7919, s), c = Hash(ix + (iy + 1) * 7919, s), d = Hash(ix + 1 + (iy + 1) * 7919, s);
            return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
        }

        /// 載入（或重新擺放建築）之後叫一次：每一欄的接雪面與能堆多厚
        public static void Build(uint[] main)
        {
            topY = new int[TOWN_W]; cap = new byte[TOWN_W]; nCol = new float[TOWN_W];
            bool Solid(int x, int y) => x >= 0 && x < TOWN_W && y >= 0 && y < H && main[y * TOWN_W + x] != 0;
            for (int x = 0; x < TOWN_W; x++)
            {
                topY[x] = FLOOR;
                for (int y = 0; y < FLOOR - 2; y++) if (Solid(x, y)) { topY[x] = y; break; }
                // 雜訊（像素化：每 2 格一個值）：雪先在雜訊高的地方長出來
                nCol[x] = (float)(Noise((x >> 1) / 9.0, 7) * 0.65 + Noise((x >> 1) / 2.5, 8) * 0.35);
            }
            for (int x = 0; x < TOWN_W; x++)
            {
                int t = topY[x];
                if (t >= FLOOR - 12) { topY[x] = FLOOR; cap[x] = 0; continue; }   // 頂面就是地面（草葉凸出地面約 9 格）：物件那一層沒有，地面那一層另外畫
                byte c = TownStructure.At(x, t + 1);
                if (c == TownStructure.SHELTER || c == TownStructure.LAND) { cap[x] = 0; continue; }
                int l = x > 0 ? topY[x - 1] : t, r = x < TOWN_W - 1 ? topY[x + 1] : t;
                int slope = Math.Max(Math.Abs(l - t), Math.Abs(r - t));
                cap[x] = (byte)(slope <= 0 ? 6 : slope == 1 ? 5 : slope == 2 ? 4 : slope == 3 ? 2 : slope == 4 ? 1 : 0);   // 平的厚、斜的薄、陡的堆不住
                if (c == TownStructure.ROOF && cap[x] > 3) cap[x] = 3;   // 結構圖的屋頂：整面的雪會蓋，頂面那層薄一點
            }
            if (TownRainHits.DebugLog) { int g = 0, z = 0; var hist = new System.Collections.Generic.SortedDictionary<int, int>(); for (int x = 0; x < TOWN_W; x++) { if (topY[x] >= FLOOR) g++; if (cap[x] == 0) z++; int b = topY[x] / 10 * 10; hist[b] = hist.TryGetValue(b, out int v) ? v + 1 : 1; } UnityEngine.Debug.Log($"[Snow] 地面 {g} 欄、堆不住 {z} 欄、頂面分布 " + string.Join(" ", System.Linq.Enumerable.Select(hist, kv => kv.Key + ":" + kv.Value))); }
            // 屋頂面（結構圖）整面朝天空：越靠近頂端越早被雪蓋，加上雜訊，雪一塊一塊往下長（照影片 05 物件上的積雪）
            mainRef = main; face = new byte[TOWN_W * H];
            // 屋頂表面（算「離天空多遠」用）：跳過繞開的東西（煙囪、水晶），從它後面的屋頂算；表面多陡（陡的面雪少）
            var topR = new int[TOWN_W]; var steep = new double[TOWN_W];
            for (int x = 0; x < TOWN_W; x++)
            {
                topR[x] = FLOOR;
                for (int y = 0; y < FLOOR - 2; y++) { if (!Solid(x, y)) continue; topR[x] = TownStructure.At(x, y) == TownStructure.AVOID ? -1 : y; break; }
            }
            // 頂上是繞開的東西（煙囪、水晶）的那幾欄：屋頂線用左右兩邊連起來補（像屋頂從它後面穿過去）。
            // 從它下面開始算會切出方塊，整段跳過又會讓寬的水晶周圍一大塊沒雪
            for (int x = 0; x < TOWN_W; x++)
            {
                if (topR[x] != -1) continue;
                int l = x - 1; while (l >= 0 && topR[l] == -1) l--;
                int r = x; while (r < TOWN_W && topR[r] == -1) r++;
                bool okL = l >= 0 && topR[l] < FLOOR, okR = r < TOWN_W && topR[r] < FLOOR;
                for (int xx = x; xx < r; xx++)
                    topR[xx] = okL && okR ? (int)Math.Round(topR[l] + (topR[r] - topR[l]) * (xx - l) / (double)(r - l)) : okL ? topR[l] : okR ? topR[r] : FLOOR;
                x = r - 1;
            }
            for (int x = 4; x < TOWN_W - 4; x++)
            {
                // 坡度看左右各 4 欄（只看隔壁一欄的話，青苔一撮撮凸起來會被當成很陡）
                int a2 = topR[x - 4], b2 = topR[x + 4];
                double slope = a2 >= FLOOR || b2 >= FLOOR ? 9 : Math.Abs(b2 - a2) / 8.0;
                steep[x] = Math.Max(0, Math.Min(1, (slope - 0.6) / 1.4));
            }
            for (int y = 0; y < FLOOR - 4; y++) for (int x = 0; x < TOWN_W; x++)
            {
                if (TownStructure.At(x, y) != TownStructure.ROOF || topY[x] >= FLOOR) continue;
                // 離天空多遠：往左右各看 12 欄、斜著算（只看這一欄的頂面的話，煙囪、水晶旁邊頂面突然跳很多，雪會被切出一條垂直線）
                double dist = 1e9, st = 1;
                for (int dx = -12; dx <= 12; dx++) { int xx = x + dx; if (xx < 0 || xx >= TOWN_W || topR[xx] >= FLOOR) continue; double dd = y - topR[xx] + Math.Abs(dx) * 0.7; if (dd < dist) { dist = dd; st = steep[xx]; } }
                if (dist > 1e8) continue;
                double below = Math.Max(0, dist) / 26.0 + st * 0.9, n = Noise2(x / 6.0, y / 4.0, 31) * 0.6 + Noise2(x / 2.5, y / 2.5, 32) * 0.4;   // 陡的面（圓頂兩側）雪少
                double sc = 1 - below * 0.75 + (n - 0.5) * 0.5;
                face[y * TOWN_W + x] = (byte)Math.Max(1, Math.Min(255, sc * 200));
            }
            // 冰柱：長在水路的滴水點（屋簷、傘緣、招牌下角）下面；地面附近的不算。每根最長 2～6 格
            icicles.Clear();
            foreach (var d in TownFlow.Drips)
            {
                if (d.y0 >= FLOOR - 10 || d.y1 - d.y0 < 8) continue;
                bool near = false; foreach (var q in icicles) if (Math.Abs(q.x - d.x) < 3 && Math.Abs(q.y - d.y0) < 4) { near = true; break; }
                if (near) continue;
                icicles.Add((d.x, d.y0, 2 + (int)(Hash(d.x * 13 + d.y0, 41) * 4.99)));
            }
            // 太窄的平面（1～2 格寬的尖端）堆不住
            for (int x = 1; x < TOWN_W - 1; x++) if (cap[x] > 0 && cap[x - 1] == 0 && cap[x + 1] == 0) cap[x] = 0;
        }

        // 地面那一層：每一欄都有（上面有路燈、燈串、招牌、建築也一樣，雪鋪在它們前面的地上），最厚 5 格
        const int GROUND_CAP = 9;   // 蓋滿草皮帶（第 FLOOR～FLOOR+9 列）
        static int GroundDepth(int x)
        {
            double c = cover; if (c <= 0.01) return 0;
            double n = Noise((x >> 1) / 7.0, 17) * 0.65 + Noise((x >> 1) / 2.2, 18) * 0.35;
            double k = c * 1.35 - (1 - n) * 0.55;
            return (int)Math.Floor(Math.Max(0, Math.Min(1, k)) * GROUND_CAP + 0.35);
        }
        /// 這一格每一欄物件頂面的積雪厚度（格）
        static int Depth(int x)
        {
            double c = cover; if (c <= 0.01 || cap[x] == 0) return 0;
            // 門檻：積雪越多門檻越低；雜訊高的地方先長
            double k = (c * 1.35 - (1 - nCol[x]) * 0.55);
            return (int)Math.Floor(Math.Max(0, Math.Min(1, k)) * cap[x] * (0.55 + 0.45 * nCol[x]) + 0.35);   // 厚度隨欄變化：下緣不整齊（每欄一樣厚會變成一條水平線）
        }

        static uint Pack(double r, double g, double b) => unchecked(0xff000000u | ((uint)Math.Min(255, Math.Max(0, b)) << 16) | ((uint)Math.Min(255, Math.Max(0, g)) << 8) | (uint)Math.Min(255, Math.Max(0, r)));
        static uint Lerp(uint a, uint b, double k) => Pack((a & 255) + (((int)(b & 255)) - (int)(a & 255)) * k, ((a >> 8) & 255) + (((int)((b >> 8) & 255)) - (int)((a >> 8) & 255)) * k, ((a >> 16) & 255) + (((int)((b >> 16) & 255)) - (int)((a >> 16) & 255)) * k);

        /// 積雪：場景畫完、角色之前畫。snow＝下雪量 0～1、day＝白天程度
        public static void DrawCover(Frame frame, double time, double snow, double day, double elevated = 1)
        {
            if (topY == null) return;
            double dt = lastT < 0 ? 0 : Math.Max(0, Math.Min(0.1, time - lastT)); lastT = time;
            double prev = cover;
            if (cover < 0) { cover = CoverStart ?? snow; prev = cover; }
            else if (snow > 0.03) cover = Math.Min(1, cover + dt * snow / 60);                       // 下 60 秒積滿
            else cover = Math.Max(0, cover - dt * (1 / 120.0 + TownArt.WeatherInfo().rain / 50));    // 停 120 秒融化；下雨融得更快
            // 融雪：融掉的量變成地上的積水（TownPuddles），也讓屋簷開始滴水
            Melting = snow < 0.03 && cover > 0.01 && cover < prev;
            TownPuddles.MeltIn = Melting && dt > 0 ? (prev - cover) / dt : 0;
            if (cover <= 0.01) return;
            // 雪的顏色：白天白、晚上偏藍（燈光由光的緩衝加上去）
            double dl = Math.Min(1, day * 1.6);   // 陰天的白天也要是白的雪
            uint top = Lerp(C[6], C[7], 0.4 + 0.6 * dl), body = Lerp(C[6], C[7], 0.15 + 0.5 * dl), mid = Lerp(C[5], C[6], 0.5 + 0.5 * dl), shade = Lerp(C[4], C[5], 0.4 + 0.6 * dl);
            if (Melting)
            {
                // 融化中：雪變成灰一點、濕一點的雪泥（越融越明顯）
                double k = 0.45 * (1 - cover); uint slush = Pack(120 + 50 * dl, 130 + 50 * dl, 150 + 45 * dl);
                top = Lerp(top, slush, k * 0.6); body = Lerp(body, slush, k); mid = Lerp(mid, slush, k); shade = Lerp(shade, slush, k * 0.5);
            }
            int W = frame.W, Hh = frame.H, cx = frame.Ox, cy = frame.Oy; var Col = frame.Color;
            void Put(int wx, int wy, uint c) { int x = wx - cx, y = wy - cy; if (x < 0 || y < 0 || x >= W || y >= Hh) return; Col[y * W + x] = c; }
            // 地面：雪鋪在草皮上（第 FLOOR 列往下），厚了高出地面一格；草葉從雪裡冒出來（雪只蓋地面那幾列）
            for (int sx = -1; sx <= W; sx++)
            {
                int wx = sx + cx; if (wx < 1 || wx >= TOWN_W - 1) continue;
                int d = GroundDepth(wx); if (d <= 0) continue;
                int bump = d >= 3 ? 1 : 0, ys = FLOOR - bump, ye = FLOOR + d - 1 - bump;
                if (d >= 6) ye += (int)(Hash(wx >> 1, 23) * 2.99) - 1;   // 下緣不整齊、往下垂
                for (int wy = ys; wy <= ye; wy++) { int row = wy - ys, rows = ye - ys + 1; Put(wx, wy, row == 0 ? top : row >= rows - 1 && rows >= 3 ? shade : row >= rows - 3 && rows >= 6 ? mid : body); }
            }
            // 屋頂面整面：遮罩過門檻的格子換成雪；原本暗的線（瓦片的縫、斑點的邊）留成雪的陰影，屋頂的結構才看得出來
            {
                int T = (int)((1.25 - 0.85 * cover) * 200);   // 積雪最多時門檻 0.4：下半部、邊緣還看得到原本的顏色
                for (int y = 0; y < Hh; y++)
                {
                    int wy = y + cy; if (wy < 0 || wy >= FLOOR - 4) continue;
                    for (int x = 0; x < W; x++)
                    {
                        int wx = x + cx; if (wx < 0 || wx >= TOWN_W) continue;
                        if (!TownArt.WeatherSurfaceVisible(wx, wy, elevated)) continue;
                        int k = wy * TOWN_W + wx; byte f = face[k]; if (f == 0 || f <= T) continue;
                        uint o = mainRef[k]; int lum = (int)(o & 255) + (int)((o >> 8) & 255) + (int)((o >> 16) & 255);
                        if (lum < 120) continue;                                                  // 黑色外框不碰
                        bool edge = wy - 1 >= 0 && (face[k - TOWN_W] <= T);                       // 雪塊的上緣：亮
                        bool bottom = wy + 1 < FLOOR - 4 && face[k + TOWN_W] <= T && mainRef[k + TOWN_W] != 0;   // 雪塊的下緣：一圈陰影（雪是蓋在上面的一層）
                        Col[y * W + x] = lum < 170 ? shade : edge ? top : bottom ? mid : body;   // 只留真的很暗的縫（瓦片縫）；傘蓋外緣那圈暗紅陰影不留，不然雪裡會多一條跟著輪廓的線
                    }
                }
            }
            // 物件的頂面（屋頂、傘蓋、煙囪、木桶、招牌、路燈）
            for (int sx = -1; sx <= W; sx++)
            {
                int wx = sx + cx; if (wx < 1 || wx >= TOWN_W - 1) continue;
                int d = Depth(wx); if (d <= 0) continue;
                int y0 = topY[wx];
                if (!TownArt.WeatherSurfaceVisible(wx, y0, elevated)) continue;
                // 厚了高出原本的輪廓一格（地面的雪堆、屋頂上的雪帽）
                int bump = d >= 3 ? 1 : 0, ys = y0 - bump, ye = y0 + d - 1 - bump;
                for (int wy = ys; wy <= ye; wy++)
                {
                    int row = wy - ys, rows = ye - ys + 1;
                    bool faceBelow = wy + 1 < H && face[(wy + 1) * TOWN_W + wx] > (int)((1.25 - 0.85 * cover) * 200);   // 下面也是雪（屋頂面的雪）就不畫陰影列
                    uint c = row == 0 ? top : row >= rows - 1 && rows >= 3 && !faceBelow ? shade : body;
                    Put(wx, wy, c);
                }
                // 高出去的地方補一圈黑外框：上面一格；左右鄰居的雪比較低的那一側
                if (bump > 0)
                {
                    Put(wx, ys - 1, OUTLINE);
                    for (int s = -1; s <= 1; s += 2)
                    {
                        int nd = Depth(wx + s), nb = nd >= 3 ? 1 : 0, nys = nd > 0 ? topY[wx + s] - nb : topY[wx + s];
                        for (int wy = ys; wy < Math.Min(nys, ye + 1); wy++) Put(wx + s, wy, OUTLINE);
                    }
                }
            }
            DrawIcicles(frame, elevated);
            // 雪面上的閃光：幾個點慢慢閃
            for (int i = 0; i < 26; i++)
            {
                int wx = cx + (int)(Hash(i + (int)Math.Floor(time / 3.1) * 37, 91) * W);
                if (wx < 1 || wx >= TOWN_W - 1) continue;
                int d = Depth(wx); bool onTop = d >= 2; if (!onTop) d = GroundDepth(wx); if (d < 2) continue;
                double tw = Math.Sin(time * 2.3 + i * 1.7); if (tw < 0.6) continue;
                int yy = (onTop ? topY[wx] : FLOOR) - (d >= 3 ? 1 : 0);
                if (onTop && !TownArt.WeatherSurfaceVisible(wx, topY[wx], elevated)) continue;
                Put(wx, yy, C[7]);
                int x = wx - cx, y = yy - cy; if (x >= 0 && y >= 0 && x < W && y < Hh) { var L = frame.Light; uint l = L[y * W + x]; L[y * W + x] = Pack((l & 255) + 50 * tw, ((l >> 8) & 255) + 60 * tw, ((l >> 16) & 255) + 80 * tw); }
            }
        }

        // ---- 冰柱：下雪時就慢慢長，長度跟著積雪程度；上粗下細、左亮右暗、尖端白，外面一格黑外框（外框只能是黑色）
        static readonly System.Collections.Generic.List<(int x, int y, int max)> icicles = new System.Collections.Generic.List<(int, int, int)>();
        public static int IcicleLen(int i) { var ic = icicles[i]; double k = Math.Max(0, Math.Min(1, cover * 1.25 - 0.15)); return (int)Math.Floor(ic.max * k + 0.3); }
        static void DrawIcicles(Frame frame, double elevated)
        {
            int W = frame.W, Hh = frame.H, cx = frame.Ox, cy = frame.Oy; var Col = frame.Color;
            uint hi = Pack(228, 244, 255), lo = Pack(150, 192, 232), tip = Pack(250, 253, 255);
            for (int i = 0; i < icicles.Count; i++)
            {
                var ic = icicles[i]; int len = IcicleLen(i); if (len <= 0) continue;
                if (!TownArt.WeatherSurfaceVisible(ic.x, ic.y - 1, elevated)) continue;
                if (ic.x - cx < -3 || ic.x - cx > W + 3) continue;
                int wide = len >= 4 ? (len + 1) / 2 : 0;   // 上半段兩格寬
                void Put(int wx, int wy, uint c) { int x = wx - cx, y = wy - cy; if (x < 0 || y < 0 || x >= W || y >= Hh) return; Col[y * W + x] = c; }
                for (int r = 0; r < len; r++)
                {
                    int y = ic.y + r; bool two = r < wide;
                    Put(ic.x, y, r == len - 1 ? tip : hi);
                    if (two) Put(ic.x + 1, y, lo);
                    Put(ic.x - 1, y, OUTLINE); Put(ic.x + (two ? 2 : 1), y, OUTLINE);
                }
                Put(ic.x, ic.y + len, OUTLINE);
            }
        }

        // ---- 雪花
        const double D = 12;
        static double Gust(double t) => 10 * Math.Sin(TAU * t / D + 0.6) + 4 * Math.Sin(TAU * 2 * t / D + 2.1);
        // 遠到近：幾片、一個循環落幾次（速度）、左右飄、風
        static readonly (int n, int m0, int m1, double sw0, double sw1, double wind, double gust)[] LAYERS =
        {
            (170, 1, 1, 1, 3, 3, 0.4),
            (95, 1, 2, 3, 7, 6, 0.7),
            (7, 2, 2, 8, 14, 9, 1.0),
        };
        // 9 種 3×3 雪花（影片 05：一張 9×9 的圖切成 9 張，每片隨機挑一張）；1＝身體、2＝亮的中心
        static readonly string[] FLAKES = { "000/020/000", "000/120/000", "000/120/010", "010/120/000", "110/120/000", "010/121/000", "000/121/010", "100/020/000", "000/021/000" };   // 一小團一小團（十字、X 形太像星星）
        static readonly int[][] FL = BuildFlakes();
        static int[][] BuildFlakes()
        {
            var r = new int[FLAKES.Length * 2][];
            for (int k = 0; k < FLAKES.Length; k++)
            {
                var rows = FLAKES[k].Split('/'); var a = new int[9]; var b = new int[9];
                for (int y = 0; y < 3; y++) for (int x = 0; x < 3; x++) { a[y * 3 + x] = rows[y][x] - '0'; b[x * 3 + (2 - y)] = rows[y][x] - '0'; }   // b＝轉 90 度
                r[k * 2] = a; r[k * 2 + 1] = b;
            }
            return r;
        }

        static void Blend(Frame f, int wx, int wy, uint c, double a)
        {
            int x = wx - f.Ox, y = wy - f.Oy;
            if (x < 0 || y < 0 || x >= f.W || y >= f.H || a <= 0.02) return;
            int i = y * f.W + x; f.ExcludeWeather(i);
            f.Color[i] = a >= 0.98 ? c : Lerp(f.Color[i], c, a);
        }

        /// 雪花：角色之後畫。snow＝下雪量 0～1
        public static void DrawFlakes(Frame frame, double time, double snow)
        {
            if (snow < 0.03) return;
            double t = time % (D * 1000);
            int bse = (int)Math.Floor(frame.Ox / 332.0) * 332 + 166;
            for (int tile = 0; tile < 3; tile++)
            {
                int ox = bse + tile * 332;
                for (int L = 0; L < 3; L++)
                {
                    var Ly = LAYERS[L]; int sd = 51 + L * 13 + tile * 101;
                    int n = (int)Math.Round(Ly.n * snow);
                    Trips(t, D, n, sd, Ly.m0, Ly.m1, (u, k, m, i) =>
                    {
                        int j = ToInt32(Wrap(k, m)); double dur = D / m;
                        double R(int q) => Rand(sd, i, j, q);
                        double air = L == 0 ? 1 : 0.86, age = Math.Min(u, air) * dur, tf = air * dur;
                        double sw = Ly.sw0 + R(3) * (Ly.sw1 - Ly.sw0), fq = 0.25 + R(4) * 0.35, ph = R(5) * TAU;
                        double x = ox - 175 + R(2) * 350 + Ly.wind * age + (Gust(t - u * dur + age) - Gust(t - u * dur)) * Ly.gust + sw * Math.Sin(TAU * fq * age + ph);
                        double y0 = -14, y1 = L == 0 ? 40 + R(1) * 130 : FLOOR + 1 + R(1) * 4;
                        double y = y0 + (y1 - y0) * (age / tf);
                        // 開頭淡入、結尾淡出（遠的在空中淡掉；中、近的落地後亮一下再消失）
                        double fadeIn = Math.Min(1, age / 0.6), rest = u * dur - tf;
                        double a = L == 0 ? Math.Min(fadeIn, Math.Min(1, (1 - u) * 5)) : rest > 0 ? 1 - rest / (dur - tf) : fadeIn;
                        int X = (int)Math.Round(x), Y = (int)Math.Round(y);
                        if (L == 0) { Blend(frame, X, Y, R(6) < 0.5 ? C[4] : C[5], a * 0.9); return; }
                        if (L == 1)
                        {
                            if (rest > 0) { Blend(frame, X, Y, C[7], a * 0.9); return; }
                            int shape = (int)(R(6) * FLAKES.Length) * 2 + ((int)Math.Floor(age * (1 + R(7) * 1.5) + R(8) * 2) & 1);   // 轉：在 0 度和 90 度之間換
                            var s = FL[shape];
                            for (int q = 0; q < 9; q++) if (s[q] != 0) Blend(frame, X - 1 + q % 3, Y - 1 + q / 3, s[q] == 2 ? C[7] : C[6], a);
                            return;
                        }
                        // 近：雪花結晶（pixelfx snow 的畫法：長臂、短臂輪流轉，白色中心，一點冷光）
                        if (rest > 0) { Blend(frame, X - 1, Y, C[6], a); Blend(frame, X, Y, C[7], a); Blend(frame, X + 1, Y, C[6], a); return; }
                        int rr = R(6) < 0.6 ? 2 : 3; bool turn = ((int)Math.Floor(age * (1.5 + R(7) * 2) + R(8) * 2) & 1) == 1;
                        int Rl = turn ? rr - 1 : rr;
                        int[] ax = turn ? new[] { 1, -1, 1, -1 } : new[] { 1, -1, 0, 0 }, ay = turn ? new[] { 1, -1, -1, 1 } : new[] { 0, 0, 1, -1 };
                        int[] bx = turn ? new[] { 1, -1, 0, 0 } : new[] { 1, -1, 1, -1 }, by = turn ? new[] { 0, 0, 1, -1 } : new[] { 1, -1, -1, 1 };
                        for (int q = 0; q < 4; q++) for (int dd = 1; dd <= Rl; dd++) Blend(frame, X + ax[q] * dd, Y + ay[q] * dd, dd == Rl ? C[7] : C[6], a);
                        for (int q = 0; q < 4; q++) Blend(frame, X + bx[q], Y + by[q], C[5], a);
                        Blend(frame, X, Y, C[7], a);
                        int lx = X - frame.Ox, ly = Y - frame.Oy;
                        if (lx >= 2 && ly >= 2 && lx < frame.W - 2 && ly < frame.H - 2)
                        {
                            var Lb = frame.Light;
                            for (int yy = -2; yy <= 2; yy++) for (int xx = -2; xx <= 2; xx++)
                            {
                                double f = (1 - Math.Sqrt(xx * xx + yy * yy) / 3) * a * 0.35; if (f <= 0) continue;
                                int ii = (ly + yy) * frame.W + lx + xx; uint l = Lb[ii];
                                Lb[ii] = Pack((l & 255) + 120 * f, ((l >> 8) & 255) + 140 * f, ((l >> 16) & 255) + 170 * f);
                            }
                        }
                    });
                }
            }
        }
    }

    static class SnowColorExt
    {
        public static uint[] Select8(this string[] hex) { var r = new uint[hex.Length]; for (int i = 0; i < hex.Length; i++) r[i] = Col.Hex(hex[i]); return r; }
    }
}
