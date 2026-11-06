// game/src/light.js 翻成 C#：所有光源 → 每個螢幕像素的亮度（0～4）＋光的顏色。
// 網頁版用 Float32Array 存，這裡用 float[]，每次存進去都先轉成 float（小數的捨入跟網頁版一樣）。
using System;
using System.Collections.Generic;
using PixelFX;

namespace ZeroStar
{
    public static class SceneLight
    {
        public static float[] Buf = new float[0], Tr = new float[0], Tg = new float[0], Tb = new float[0];
        const string DEFAULT = "#ffa060";
        static readonly Dictionary<string, double[]> rgbCache = new Dictionary<string, double[]>();
        static double[] RgbOf(string col)
        {
            if (!rgbCache.TryGetValue(col, out var v))
            {
                int n = Convert.ToInt32(col.Substring(1), 16);
                v = new[] { (n >> 16) * 0.1, ((n >> 8) & 255) * 0.1, (n & 255) * 0.1 };
                rgbCache[col] = v;
            }
            return v;
        }
        class Flash { public double X, Y, R, Lv, Ttl, Life; public string Col; }
        static readonly List<Flash> flashes = new List<Flash>();

        public static void Reset() { flashes.Clear(); }

        /// 一道會慢慢縮小的閃光（世界座標）
        public static void AddFlash(double x, double y, double r, double lv, double sec = 0.25, string col = "#ffd890")
        {
            flashes.Add(new Flash { X = x, Y = y, R = r, Lv = lv, Ttl = sec, Life = sec, Col = col });
            if (flashes.Count > 40) flashes.RemoveAt(0);
        }
        public static void Update(double dt)
        {
            foreach (var f in flashes) f.Ttl -= dt;
            for (int i = flashes.Count - 1; i >= 0; i--) if (flashes[i].Ttl <= 0) flashes.RemoveAt(i);
        }

        public static float[] Compute(Frame frame, List<LightSrc> list)
        {
            int W = frame.W, H = frame.H, n = W * H;
            if (Buf.Length < n) { Buf = new float[n]; Tr = new float[n]; Tg = new float[n]; Tb = new float[n]; }
            Array.Clear(Buf, 0, n); Array.Clear(Tr, 0, n); Array.Clear(Tg, 0, n); Array.Clear(Tb, 0, n);
            var all = new List<LightSrc>(list);
            foreach (var f in flashes)
            {
                double k = f.Ttl / f.Life;
                all.Add(new LightSrc(f.X, f.Y, f.R * (0.5 + 0.5 * k), f.Lv * k, f.Col));
            }
            // 先算好每個光源的範圍，再把畫面切成幾條同時算：每個像素還是照光源的順序一個一個加（小數捨入跟網頁版一樣）
            var Ls = new List<(double sx, double sy, double r, double lv, double cr, double cg, double cb, double r2, double ir, int x0, int x1, int y0, int y1)>();
            foreach (var L in all)
            {
                double sx = L.X - frame.Ox * L.Par, sy = L.Y - frame.Oy, r = L.R, lv = L.Lv;
                if (sx + r < 0 || sx - r >= W || sy + r < 0 || sy - r >= H || lv <= 0) continue;
                var c = RgbOf(L.Col ?? DEFAULT);
                Ls.Add((sx, sy, r, lv, c[0], c[1], c[2], r * r, 1 / r,
                    (int)Math.Max(0, Math.Floor(sx - r)), (int)Math.Min(W - 1, Math.Ceiling(sx + r)), (int)Math.Max(0, Math.Floor(sy - r)), (int)Math.Min(H - 1, Math.Ceiling(sy + r))));
            }
            const int BANDS = 8;
            int per = (H + BANDS - 1) / BANDS;
            float[] buf = Buf, tr = Tr, tg = Tg, tb = Tb;
            System.Threading.Tasks.Parallel.For(0, BANDS, band =>
            {
                int ya = band * per, yb = Math.Min(H, (band + 1) * per);
                foreach (var L in Ls)
                {
                    int y0 = Math.Max(ya, L.y0), y1 = Math.Min(yb - 1, L.y1);
                    for (int y = y0; y <= y1; y++)
                    {
                        double ey = y - L.sy, dy2 = ey * ey; int row = y * W;
                        for (int x = L.x0; x <= L.x1; x++)
                        {
                            double ex = x - L.sx, d2 = ex * ex + dy2;
                            if (d2 >= L.r2) continue;
                            double f = 1 - Math.Sqrt(d2) * L.ir, k = L.lv * f * f * (3 - 2 * f);
                            int i = row + x;
                            buf[i] = (float)Math.Min(4, buf[i] + k);
                            tr[i] = (float)(tr[i] + L.cr * k); tg[i] = (float)(tg[i] + L.cg * k); tb[i] = (float)(tb[i] + L.cb * k);
                        }
                    }
                }
            });
            return Buf;
        }
    }
}
