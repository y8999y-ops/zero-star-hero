// 碎星鎮：雨水在建築與物件上「照著弧度」流的路線（Unity 版自己的）。scene-fx skill §3b。載入（或重新擺放建築）時算一次，每格不花 CPU。
//  1. 形狀起伏：每一格離剪影邊緣多遠（距離場）。離邊越遠＝凸起的中間，越近＝往外彎下去的邊。
//  2. 流向＝往下＋往「比較近的那一邊」推一點；越靠近邊推越多（平的牆中間幾乎直直往下，圓頂往兩邊彎）。
//     頂面那一條輪廓：沿著輪廓往低的那邊滑。
//  3. 水路：從受雨的頂面每隔一段放一條，照流向一步一步走；走出物件就停。
//     停下來的地方：下面是一段空的（屋簷、凸出去的邊）＝滴水點；碰到地面附近＝流進地面。碰到別條水路就併過去。
using System;
using System.Collections.Generic;

namespace ZeroStar
{
    public static class TownFlow
    {
        const int FLOOR = TownArt.FLOOR, TOWN_W = TownArt.TOWN_W, H = TownArt.H;
        const int BOTTOM = FLOOR - 4;
        public enum End { Drip, Ground, Merge, Stop }
        public class Path { public readonly List<(int x, int y)> Px = new List<(int, int)>(); public End End; }
        public static readonly List<Path> Paths = new List<Path>();
        public static float[] Dist;      // 離剪影邊緣多遠（格）
        public static float[] FlowX, FlowY;
        static uint[] main;
        /// 水路的種子：換一個就是另一組隨機的水路（同一個種子每次都一樣）
        public static int Seed = 1;
        /// 雜訊讓流向左右偏多少（度）：範圍內隨機
        public static float RangeDeg = 40;
        static double Hash(int i, int s) { unchecked { uint h = (uint)(i * 374761393 + s * 668265263); h = (h ^ (h >> 13)) * 1274126177; h ^= h >> 16; return (h & 0xffffff) / 16777216.0; } }
        static double Noise2(double x, double y, int s)
        {
            int ix = (int)Math.Floor(x), iy = (int)Math.Floor(y); double fx = x - ix, fy = y - iy;
            fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
            double a = Hash(ix + iy * 7919, s), b = Hash(ix + 1 + iy * 7919, s), c = Hash(ix + (iy + 1) * 7919, s), d = Hash(ix + 1 + (iy + 1) * 7919, s);
            return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
        }
        static int[] comp; static readonly List<int> eaveY = new List<int>(); static readonly List<int[]> rowL = new List<int[]>(), rowR = new List<int[]>();
        public static IReadOnlyList<int> EaveRows => eaveY;
        static int eaveAt(int x, int y) { int c = comp[y * TOWN_W + x]; return c < 0 ? int.MaxValue : eaveY[c]; }
        static bool Dark(int x, int y) { uint c = main[y * TOWN_W + x]; return (c & 255) + ((c >> 8) & 255) + ((c >> 16) & 255) < 150; }   // 黑色外框
        static bool Solid(int x, int y) => x >= 0 && x < TOWN_W && y >= 0 && y < BOTTOM && main[y * TOWN_W + x] != 0;

        public static void Build(uint[] mainLayer, int[] topY)
        {
            main = mainLayer; Paths.Clear();
            TownStructure.Build(mainLayer);   // 有結構圖的建築照結構圖流
            int N = TOWN_W * H;
            // ---- 1. 距離場（兩趟掃描，八個方向，斜的算 1.41）
            var D = new float[N];
            const float BIG = 1e4f, DG = 1.41f;
            for (int y = 0; y < H; y++) for (int x = 0; x < TOWN_W; x++) D[y * TOWN_W + x] = Solid(x, y) ? BIG : 0;
            for (int y = 0; y < H; y++) for (int x = 0; x < TOWN_W; x++)
            {
                int i = y * TOWN_W + x; if (D[i] == 0) continue;
                float v = D[i];
                v = Math.Min(v, (x > 0 ? D[i - 1] : 0) + 1);
                v = Math.Min(v, (y > 0 ? D[i - TOWN_W] : 0) + 1);
                v = Math.Min(v, (x > 0 && y > 0 ? D[i - TOWN_W - 1] : 0) + DG);
                v = Math.Min(v, (x < TOWN_W - 1 && y > 0 ? D[i - TOWN_W + 1] : 0) + DG);
                D[i] = v;
            }
            for (int y = H - 1; y >= 0; y--) for (int x = TOWN_W - 1; x >= 0; x--)
            {
                int i = y * TOWN_W + x; if (D[i] == 0) continue;
                float v = D[i];
                v = Math.Min(v, (x < TOWN_W - 1 ? D[i + 1] : 0) + 1);
                v = Math.Min(v, (y < H - 1 ? D[i + TOWN_W] : 0) + 1);
                v = Math.Min(v, (x < TOWN_W - 1 && y < H - 1 ? D[i + TOWN_W + 1] : 0) + DG);
                v = Math.Min(v, (x > 0 && y < H - 1 ? D[i + TOWN_W - 1] : 0) + DG);
                D[i] = v;
            }
            Dist = D;
            // ---- 屋簷：把物件一個個分開（相連的不透明格），看每一列多寬；從上往下，寬度突然往裡縮（任一邊縮 3 格以上）的那一列＝屋簷。
            //   屋頂比牆寬，所以屋頂流下來的水到這一列就滴到地上；圓頂、木桶這種沒有突然變窄的，水順著弧度流到地上。
            comp = new int[N]; for (int i = 0; i < N; i++) comp[i] = -1;
            eaveY.Clear(); rowL.Clear(); rowR.Clear();
            var stack = new Stack<int>();
            for (int y0 = 0; y0 < BOTTOM; y0++) for (int x0 = 0; x0 < TOWN_W; x0++)
            {
                int s0 = y0 * TOWN_W + x0; if (comp[s0] >= 0 || !Solid(x0, y0)) continue;
                int id = eaveY.Count; var L = new int[H]; var R = new int[H];
                for (int y = 0; y < H; y++) { L[y] = int.MaxValue; R[y] = int.MinValue; }
                comp[s0] = id; stack.Push(s0); int top = y0, bot = y0;
                while (stack.Count > 0)
                {
                    int c = stack.Pop(), cx = c % TOWN_W, cy = c / TOWN_W;
                    L[cy] = Math.Min(L[cy], cx); R[cy] = Math.Max(R[cy], cx); bot = Math.Max(bot, cy);
                    for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++)
                    {
                        int nx = cx + dx, ny = cy + dy; if (!Solid(nx, ny)) continue;
                        int n = ny * TOWN_W + nx; if (comp[n] >= 0) continue;
                        comp[n] = id; stack.Push(n);
                    }
                }
                int eave = int.MaxValue;
                for (int y = top + 8; y < bot - 4; y++)
                {
                    if (L[y] == int.MaxValue || L[y + 1] == int.MaxValue) continue;
                    if (L[y + 1] - L[y] >= 3 || R[y] - R[y + 1] >= 3) { eave = y; break; }
                }
                eaveY.Add(eave); rowL.Add(L); rowR.Add(R);
            }
            // ---- 2. 流向：往下＋像圓頂經線一樣往外張開＋靠近邊時順著邊（距離場往外的方向）
            FlowX = new float[N]; FlowY = new float[N];
            for (int y = 1; y < H - 1; y++) for (int x = 1; x < TOWN_W - 1; x++)
            {
                int i = y * TOWN_W + x; if (D[i] == 0) continue;
                // 平滑一點的梯度（3×3）
                float gx = (D[i + 1] - D[i - 1]) * 2 + (D[i - TOWN_W + 1] - D[i - TOWN_W - 1]) + (D[i + TOWN_W + 1] - D[i + TOWN_W - 1]);
                float gy = (D[i + TOWN_W] - D[i - TOWN_W]) * 2 + (D[i + TOWN_W + 1] - D[i - TOWN_W + 1]) + (D[i + TOWN_W - 1] - D[i - TOWN_W - 1]);
                float gl = (float)Math.Sqrt(gx * gx + gy * gy);
                float ox = gl > 1e-4f ? -gx / gl : 0, oy = gl > 1e-4f ? -gy / gl : 0;   // 往外（往邊緣）
                float near = Math.Max(0, 1 - D[i] / 14f);                             // 越靠近邊越彎
                // 像圓頂的經線往外張開：這一列裡偏左就往左、偏右就往右，越靠邊越多
                int ci = comp[i]; float u = 0;
                if (ci >= 0) { int l0 = rowL[ci][y], r0 = rowR[ci][y]; float mid = (l0 + r0) / 2f, half = Math.Max(4f, (r0 - l0) / 2f); u = Math.Max(-1f, Math.Min(1f, (x - mid) / half)); }
                float fx = u * (0.35f + 0.35f * Math.Abs(u)) + ox * near * 0.9f, fy = 1f;
                if (oy < -0.3f) fx += ox * 0.8f;                                        // 頂面附近（往外是朝上）：沿著弧度往兩邊滑
                // 雜訊偏轉：平滑的雜訊（兩層）決定往左或往右偏多少，限制在 ±RangeDeg 內；最後不超過 ±75 度（不會往上、不會橫著跑）
                double n = Noise2(x / 16.0, y / 16.0, Seed * 31 + 1) * 0.7 + Noise2(x / 6.0, y / 6.0, Seed * 31 + 2) * 0.3;
                double ang = Math.Atan2(fx, fy) + (n - 0.5) * 2 * RangeDeg * Math.PI / 180;
                ang = Math.Max(-1.31, Math.Min(1.31, ang));
                FlowX[i] = (float)Math.Sin(ang); FlowY[i] = (float)Math.Cos(ang);
            }
            // ---- 3. 水路：從頂面每隔一段放一條
            var owner = new int[N]; for (int i = 0; i < N; i++) owner[i] = -1;
            int lastX = -99;
            for (int x = 2; x < TOWN_W - 2; x++)
            {
                int t = topY[x];
                if (t < 0 || t >= BOTTOM - 6) { continue; }
                // 每隔 11～15 格一條；平的地方（頂面跟旁邊一樣高）也照放
                if (x - lastX < 9 + (int)(Hash(lastX + 1000, Seed * 31 + 3) * 10)) continue;   // 間隔隨機 9～18 格
                // 起點放在頂面往下 1 格（外框裡面）
                int sy = t + 1; if (!Solid(x, sy)) continue;
                byte sc = TownStructure.At(x, sy); if (sc != TownStructure.NONE && sc != TownStructure.ROOF) { sy = t + 2; sc = TownStructure.At(x, sy); if (sc != TownStructure.ROOF) continue; }
                lastX = x;
                Trace(x + 0.5, sy + 0.5, owner);
            }
            BuildDrips();
        }

        // 結構圖（TownStructure）：有結構圖的建築照它走——屋頂面上照流向流，碰到繞開就從旁邊滑過去，碰到導水線就沿著走，
        // 到滴水線／滴水點就滴下去，碰到擋雨區（流到屋頂最下面了）也從那裡滴。沒有結構圖的物件照自動的做法（屋簷＝寬度突然變窄的那一列）。
        static byte St(int x, int y) => TownStructure.At(x, y);
        static bool Walkable(int x, int y) { byte c = St(x, y); return c == TownStructure.NONE ? Solid(x, y) : c == TownStructure.ROOF || c == TownStructure.GUIDE || c == TownStructure.DRIP || c == TownStructure.POINT; }
        static readonly (int dx, int dy)[] G1 = new (int, int)[4];
        static void Trace(double px, double py, int[] owner)
        {
            var path = new Path(); int id = Paths.Count; Paths.Add(path);
            int lx = -1, ly = -1, side = 0;
            for (int step = 0; step < 900; step++)
            {
                int x = (int)Math.Floor(px), y = (int)Math.Floor(py);
                if (y >= BOTTOM - 1) { path.End = End.Ground; Add(path, owner, id, x, Math.Min(y, BOTTOM - 1)); return; }
                byte c = St(x, y);
                if (c == TownStructure.DRIP || c == TownStructure.POINT) { path.End = End.Drip; Add(path, owner, id, x, y); return; }
                if (c == TownStructure.SHELTER || c == TownStructure.LAND) { path.End = lx >= 0 ? End.Drip : End.Stop; return; }   // 流到屋頂最下面：從上一格滴
                if (c == TownStructure.AVOID)
                {
                    if (lx < 0) { path.End = End.Stop; return; }
                    // 繞開：往旁邊滑（先試流向那一邊，再試另一邊），下一步往下
                    int sd = FlowX[ly * TOWN_W + lx] >= 0 ? 1 : -1; bool moved = false; int mx = lx, my = ly;
                    foreach (int s2 in new[] { sd, -sd })
                    {
                        foreach (var (dx, dy) in new[] { (s2, 1), (s2, 0) })
                            if (!moved && Walkable(lx + dx, ly + dy)) { mx = lx + dx; my = ly + dy; moved = true; }
                        if (moved) break;
                    }
                    if (!moved) { path.End = End.Drip; return; }
                    int oi = my * TOWN_W + mx;
                    if (owner[oi] >= 0 && owner[oi] != id) { path.End = End.Merge; Add(path, owner, id, mx, my); return; }
                    Add(path, owner, id, mx, my); lx = mx; ly = my; px = mx + 0.5; py = my + 0.5;
                    continue;
                }
                if (c == TownStructure.GUIDE)
                {
                    // 導水線：一格一格沿著它往下走（先往下，再斜下，最後橫的；橫的時候維持同一個方向），走完再看下面接什麼
                    if (x != lx || y != ly) { Add(path, owner, id, x, y); lx = x; ly = y; }
                    if (side == 0) side = FlowX[y * TOWN_W + x] >= 0 ? 1 : -1;
                    var seen = new System.Collections.Generic.HashSet<int> { y * TOWN_W + x };
                    int gx = x, gy = y;
                    for (int g = 0; g < 400; g++)
                    {
                        bool next = false;
                        G1[0] = (0, 1); G1[1] = (side, 1); G1[2] = (-side, 1); G1[3] = (side, 0);
                        foreach (var (dx, dy) in G1)
                        {
                            int nx = gx + dx, ny = gy + dy; if (seen.Contains(ny * TOWN_W + nx)) continue;
                            byte nc = St(nx, ny);
                            if (nc == TownStructure.POINT || nc == TownStructure.DRIP) { Add(path, owner, id, nx, ny); path.End = End.Drip; return; }
                            if (nc != TownStructure.GUIDE) continue;
                            seen.Add(ny * TOWN_W + nx); gx = nx; gy = ny; next = true;
                            Add(path, owner, id, gx, gy);
                            if (ny >= BOTTOM - 1) { path.End = End.Ground; return; }
                            break;
                        }
                        if (!next) break;
                    }
                    lx = gx; ly = gy;
                    // 導水線走完：下面是屋頂面就繼續流，不然從這裡滴
                    if (St(gx, gy + 1) == TownStructure.ROOF) { px = gx + 0.5; py = gy + 1.5; continue; }
                    if (St(gx + side, gy + 1) == TownStructure.ROOF) { px = gx + side + 0.5; py = gy + 1.5; continue; }
                    path.End = gy >= BOTTOM - 2 ? End.Ground : End.Drip; return;
                }
                if (!Walkable(x, y))
                {
                    if (lx < 0) { path.End = End.Stop; return; }
                    // 下一步會走出物件：先試著貼著邊往下滑（正下方、往裡面一格的下方），都不行才停
                    int ix = FlowX[ly * TOWN_W + lx] > 0 ? -1 : 1;
                    if (Walkable(lx, ly + 1)) { px = lx + 0.5; py = ly + 1.5; continue; }
                    if (Walkable(lx + ix, ly + 1)) { px = lx + ix + 0.5; py = ly + 1.5; continue; }
                    int gap = 0; while (ly + 1 + gap < BOTTOM && !Solid(lx, ly + 1 + gap)) gap++;
                    path.End = gap >= 6 || ly + 1 + gap >= BOTTOM || St(lx, ly) != TownStructure.NONE ? End.Drip : End.Stop;
                    return;
                }
                if (c == TownStructure.NONE && y >= eaveAt(x, y)) { path.End = End.Drip; Add(path, owner, id, x, y); return; }   // 自動：流到屋簷那一列，從這裡滴到地上
                if (x != lx || y != ly)
                {
                    int i = y * TOWN_W + x;
                    if (owner[i] >= 0 && owner[i] != id) { path.End = End.Merge; Add(path, owner, id, x, y); return; }
                    Add(path, owner, id, x, y); lx = x; ly = y;
                }
                int k = y * TOWN_W + x;
                px += FlowX[k] * 0.6; py += FlowY[k] * 0.6;
            }
            path.End = End.Stop;
        }

        // ---- 滴水：每條滴下去的水路的最後一格＋結構圖的滴水點；往下掉到接水面、屋頂、沒有結構圖的物件或地面
        public struct DripAt { public int x, y0, y1; public bool ground; }
        public static readonly List<DripAt> Drips = new List<DripAt>();
        // 水路每一格：沿著水路走了多遠（給往下流的亮點用）、哪一條（種子 1～255，0＝不是水路）
        public static byte[] PathArc, PathSeed;
        static void BuildDrips()
        {
            Drips.Clear();
            var starts = new List<(int x, int y)>();
            foreach (var p in Paths) if (p.End == End.Drip && p.Px.Count > 0) starts.Add(p.Px[p.Px.Count - 1]);
            for (int y = 0; y < H; y++) for (int x = 0; x < TOWN_W; x++) if (St(x, y) == TownStructure.POINT) starts.Add((x, y));
            foreach (var (x, y) in starts)
            {
                bool near = false;
                foreach (var d in Drips) if (Math.Abs(d.x - x) <= 2 && Math.Abs(d.y0 - 1 - y) <= 3) { near = true; break; }
                if (near) continue;
                int y1 = FLOOR; bool ground = true;
                for (int yy = y + 2; yy < FLOOR; yy++)
                {
                    byte c = St(x, yy);
                    if (c == TownStructure.LAND || c == TownStructure.ROOF || (c == TownStructure.NONE && Solid(x, yy))) { y1 = yy; ground = false; break; }
                }
                if (y1 - y < 4) continue;
                Drips.Add(new DripAt { x = x, y0 = y + 1, y1 = y1, ground = ground });
            }
            PathArc = new byte[TOWN_W * H]; PathSeed = new byte[TOWN_W * H];
            for (int i = 0; i < Paths.Count; i++)
            {
                var p = Paths[i]; byte sd = (byte)(1 + (int)(Hash(i, Seed * 31 + 11) * 254));
                for (int k = 0; k < p.Px.Count; k++)
                {
                    var (x, y) = p.Px[k]; int j = y * TOWN_W + x;
                    if (PathSeed[j] == 0) { PathSeed[j] = sd; PathArc[j] = (byte)(k & 255); }
                }
            }
        }
        static void Add(Path p, int[] owner, int id, int x, int y)
        {
            if (x < 0 || x >= TOWN_W || y < 0 || y >= H) return;
            p.Px.Add((x, y));
            int i = y * TOWN_W + x; if (owner[i] < 0) owner[i] = id;
        }
    }
}
