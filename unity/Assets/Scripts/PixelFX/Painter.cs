// pixelfx core 的 painter.js 與 fx.js（畫布、合成）翻成 C#。
// 畫筆畫進畫布的兩個緩衝：Color（不透明像素，淡出用 4×4 網點，不混色）與 Light（加法光，最後疊上去）。
// 特效用自己的座標（原點＝角色腳底、面向右）畫，畫筆負責放置、鏡像、旋轉。
// 顏色和透明度可以是常數或函式：常數版的多載直接轉成函式版。
using System;

namespace PixelFX
{
    /// 開發用：量畫筆函式各花多少時間（On＝true 才量；巢狀呼叫會重複算）
    public static class PfProf
    {
        public static bool On;
        public static readonly System.Collections.Generic.Dictionary<string, double> Ms = new System.Collections.Generic.Dictionary<string, double>();
        public static long T0() => On ? System.Diagnostics.Stopwatch.GetTimestamp() : 0;
        public static void T1(string k, long t0) { if (!On) return; double ms = (System.Diagnostics.Stopwatch.GetTimestamp() - t0) * 1000.0 / System.Diagnostics.Stopwatch.Frequency; Ms.TryGetValue(k, out var v); Ms[k] = v + ms; }
    }
    public delegate uint ColorFn(double u, double v);
    public delegate double AlphaFn(double u, double v);

    /// 一張畫布：W×H 像素，左上角在世界座標 (Ox, Oy)。
    public class Frame
    {
        public readonly int W, H;
        public int Ox, Oy;
        public readonly uint[] Color;
        readonly uint[] light;
        /// 光的緩衝。拿之前先把還沒畫的光暈畫完（見 Defer）。
        public uint[] Light { get { if (Q.Count > 0) Flush(); return light; } }
        public uint[] LightRaw => light;   // 不先 Flush（只給會自己顧好順序的地方用）
        public Frame(int w, int h, int ox = 0, int oy = 0) { W = w; H = h; Ox = ox; Oy = oy; Color = new uint[w * h]; light = new uint[w * h]; }
        public Frame Clear() { Q.Clear(); Array.Clear(Color, 0, Color.Length); Array.Clear(light, 0, light.Length); return this; }

        // ---- 光暈先記下來、晚點一起畫（Defer＝true 時）
        // 光暈只加到 Light，不碰 Color。記下來的光暈照原本的順序，在 Flush 時把畫面切成幾條同時畫：
        // 每一條只畫自己那幾列，每個像素被加光的先後順序跟一個一個畫完全一樣，所以結果一樣。
        // 任何人要讀寫 Light（Light 屬性、畫筆的 Add、ShadePar）之前都會先 Flush。
        public bool Defer;
        public struct GlowCmd
        {
            public int kind;              // 0＝圓光暈 1＝線光暈 2＝環光暈 3＝烘焙動畫的光（Run 傳進來）
            public Action<int, int> rows; // kind 3：畫第 ya～yb 列（畫布座標）
            public int x0, x1, y0, y1;    // 畫布座標，已夾在畫布內
            public double a, b, c, d, e, r, k, fl, cut;
            public uint cr, cg, cb;
        }
        public readonly System.Collections.Generic.List<GlowCmd> Q = new System.Collections.Generic.List<GlowCmd>();
        long qWork;
        public void Push(GlowCmd q)
        {
            if (!Defer) { if (Q.Count > 0) Flush(); Run(q); return; }
            Q.Add(q); qWork += (long)(q.x1 - q.x0 + 1) * (q.y1 - q.y0 + 1);
        }
        /// 不延後時：直接畫；大的切成 4 條同時畫（跟原本一樣）
        void Run(GlowCmd q)
        {
            int n = q.y1 - q.y0 + 1;
            if (n * (q.x1 - q.x0 + 1) < 2500) { ExecRows(ref q, q.y0, q.y1); return; }
            const int B = 4; int per = (n + B - 1) / B;
            System.Threading.Tasks.Parallel.For(0, B, b => { int ya = q.y0 + b * per, yb = Math.Min(q.y1, ya + per - 1); if (ya <= yb) ExecRows(ref q, ya, yb); });
        }
        public void Flush()
        {
            int nq = Q.Count; if (nq == 0) return;
            long __t = PfProf.T0(); try {
            var arr = Q.ToArray(); Q.Clear(); long work = qWork; qWork = 0;
            if (work < 4000) { for (int i = 0; i < nq; i++) ExecRows(ref arr[i], arr[i].y0, arr[i].y1); return; }
            // 切條：照每一列要算的格數平均分給幾條（光暈常常擠在畫面同一塊）
            int B = Math.Max(1, Math.Min(8, Environment.ProcessorCount));
            var acc = new long[H + 1];
            for (int i = 0; i < nq; i++) { long wd = arr[i].x1 - arr[i].x0 + 1; acc[arr[i].y0 - Oy] += wd; acc[arr[i].y1 - Oy + 1] -= wd; }
            long run = 0, tot = 0; for (int y = 0; y < H; y++) { run += acc[y]; tot += run; acc[y] = tot; }   // acc[y]＝第 0～y 列加起來
            var cut = new int[B + 1]; cut[B] = H;
            for (int b = 1, y = 0; b < B; b++) { long want = tot * b / B; while (y < H - 1 && acc[y] < want) y++; cut[b] = y; }
            System.Threading.Tasks.Parallel.For(0, B, b =>
            {
                int ya = Oy + cut[b], yb = Oy + cut[b + 1] - 1;
                if (ya > yb) return;
                for (int i = 0; i < nq; i++)
                {
                    int a0 = Math.Max(ya, arr[i].y0), a1 = Math.Min(yb, arr[i].y1);
                    if (a0 <= a1) ExecRows(ref arr[i], a0, a1);
                }
            });
            } finally { PfProf.T1("Flush", __t); }
        }
        [ThreadStatic] static double[] dxBuf;
        // 這一格加光（跟 Add 同一個算法；kk > 0.004，值都是 0～255 的正數，直接截成整數）
        static void AddPx(uint[] Lb, int i, uint cr, uint cg, uint cb, double kk)
        {
            uint dd = Lb[i];
            int rr = (int)Math.Min(255, (dd & 255) + cr * kk);
            int gg = (int)Math.Min(255, ((dd >> 8) & 255) + cg * kk);
            int bb = (int)Math.Min(255, ((dd >> 16) & 255) + cb * kk);
            Lb[i] = unchecked((uint)((255 << 24) | (bb << 16) | (gg << 8) | rr));
        }
        // 畫一個光暈的第 ya～yb 列（畫布座標）。每一格的算式和原本逐格算的一模一樣；
        // 只跳過一定照不到的格子（離中心、線、環超過半徑再多 1 格的地方，原本算出來也是不加）
        void ExecRows(ref GlowCmd q, int ya, int yb)
        {
            if (q.kind == 3) { q.rows(ya, yb); return; }
            uint[] Lb = light; int W_ = W, OX = Ox, OY = Oy;
            uint cr = q.cr, cg = q.cg, cb = q.cb; double k = q.k, fl = q.fl, r = q.r;
            int X0 = q.x0, X1 = q.x1;
            if (q.kind == 0)
            {
                double cx = q.a, cy = q.b, dcut = q.cut;
                // dx 只跟哪一欄有關：先算好每一欄的 dx*dx（同一個算式，值一樣）
                int nx = X1 - X0 + 1;
                var dx2 = dxBuf; if (dx2 == null || dx2.Length < nx) dxBuf = dx2 = new double[Math.Max(nx, 512)];
                for (int sx = X0; sx <= X1; sx++) { double dx = (sx + 0.5 - cx) / r; dx2[sx - X0] = dx * dx; }
                for (int sy = ya; sy <= yb; sy++)
                {
                    double dy = (sy + 0.5 - cy) / r; int row = (sy - OY) * W_ - OX;
                    double m = dcut - dy * dy;
                    if (m < 0) continue;
                    double half = r * Math.Sqrt(m), dy2 = dy * dy;
                    int xa = Math.Max(X0, (int)Math.Floor(cx - 0.5 - half) - 1), xb = Math.Min(X1, (int)Math.Ceiling(cx - 0.5 + half) + 1);
                    for (int sx = xa; sx <= xb; sx++)
                    {
                        double d = dx2[sx - X0] + dy2;
                        if (d >= 1) continue;
                        double f = 1 - Math.Sqrt(d), kk = f * f * k * fl;
                        if (kk <= 0.004) continue;
                        AddPx(Lb, row + sx, cr, cg, cb, kk);
                    }
                }
                return;
            }
            if (q.kind == 1)
            {
                double ax = q.a, ay = q.b, dx = q.c, dy = q.d, L2 = q.e;
                double len = Math.Sqrt(dx * dx + dy * dy), reach = r * len;
                for (int sy = ya; sy <= yb; sy++)
                {
                    int row = (sy - OY) * W_ - OX; double py = sy + 0.5;
                    int xa = X0, xb = X1;
                    // 離整條直線 ≥ r 的格子，離線段也 ≥ r：只看直線兩旁的那一段
                    if (Math.Abs(dy) > 1e-6)
                    {
                        double m0 = (py - ay) * dx, lo = ax + (m0 - reach) / dy, hi = ax + (m0 + reach) / dy;
                        if (lo > hi) { double tt = lo; lo = hi; hi = tt; }
                        if (!(lo > -1e9 && hi < 1e9)) { lo = X0; hi = X1; }
                        xa = Math.Max(X0, (int)Math.Floor(lo - 0.5) - 1); xb = Math.Min(X1, (int)Math.Ceiling(hi - 0.5) + 1);
                    }
                    for (int sx = xa; sx <= xb; sx++)
                    {
                        double px = sx + 0.5, u = Pf.Clamp(((px - ax) * dx + (py - ay) * dy) / L2);
                        double ex = ax + dx * u - px, ey = ay + dy * u - py, d = Math.Sqrt(ex * ex + ey * ey) / r;
                        if (d >= 1) continue;
                        double f = 1 - d, k0 = f * f * k;
                        if (double.IsNaN(k0)) continue;
                        double kk = k0 * fl;
                        if (kk <= 0.004) continue;
                        AddPx(Lb, row + sx, cr, cg, cb, kk);
                    }
                }
                return;
            }
            {
                double cx = q.a, cy = q.b, R = q.c, Ro = R + r + 1, Ri = R - r - 1;
                for (int sy = ya; sy <= yb; sy++)
                {
                    int row = (sy - OY) * W_ - OX; double ddy = sy + 0.5 - cy, m = Ro * Ro - ddy * ddy;
                    if (m < 0) continue;
                    // 環的外圈以外、內圈以內，離環都 ≥ r：只看左右兩段
                    double ho = Math.Sqrt(m), hi = Ri > 0 && Math.Abs(ddy) < Ri ? Math.Sqrt(Ri * Ri - ddy * ddy) : -1;
                    int la = Math.Max(X0, (int)Math.Floor(cx - ho - 0.5) - 1), rb = Math.Min(X1, (int)Math.Ceiling(cx + ho - 0.5) + 1);
                    int lb = rb, ra = rb + 1;
                    if (hi > 2) { lb = Math.Min(rb, (int)Math.Ceiling(cx - hi - 0.5) + 1); ra = Math.Max(lb + 1, (int)Math.Floor(cx + hi - 0.5) - 1); }
                    for (int pass = 0; pass < 2; pass++)
                    {
                        int s0 = pass == 0 ? la : ra, s1 = pass == 0 ? lb : rb;
                        for (int sx = s0; sx <= s1; sx++)
                        {
                            double d = Math.Abs(Pf.Hypot(sx + 0.5 - cx, sy + 0.5 - cy) - R) / r;
                            if (d >= 1) continue;
                            double f = 1 - d, k0 = f * f * k;
                            if (double.IsNaN(k0)) continue;
                            double kk = k0 * fl;
                            if (kk <= 0.004) continue;
                            AddPx(Lb, row + sx, cr, cg, cb, kk);
                        }
                    }
                }
            }
        }

        /// Color 疊在背景上再加光，輸出 RGBA 位元組。bg：null＝透明。照 fx.js 的 composite。
        /// 畫面切成幾條同時算（每個像素各算各的，結果跟一條一條算完全一樣）。
        public byte[] Composite(byte[] o = null, uint? bg = null, double lightK = 1)
        {
            Flush();
            int n = W * H; o = o ?? new byte[n * 4];
            const int BANDS = 8;
            int per = (H + BANDS - 1) / BANDS;
            var outp = o;
            System.Threading.Tasks.Parallel.For(0, BANDS, k =>
            {
                int a = k * per * W, b = Math.Min(n, (k + 1) * per * W);
                if (a < b) CompositeRange(outp, a, b, bg, lightK);
            });
            return o;
        }
        void CompositeRange(byte[] o, int from, int to, uint? bg, double lightK)
        {
            for (int i = from; i < to; i++)
            {
                uint c = Color[i], l = light[i] & 0xffffff;
                uint ca = c >> 24;
                int j = i * 4;
                if (ca == 255)
                {
                    // 最常見：不透明。沒有光直接複製；有光＝加上去（上限 255）再四捨五入（剛好 .5 取偶數）
                    if (l == 0) { o[j] = (byte)c; o[j + 1] = (byte)(c >> 8); o[j + 2] = (byte)(c >> 16); o[j + 3] = 255; continue; }
                    o[j] = AddRound(c & 255, (l & 255) * lightK); o[j + 1] = AddRound((c >> 8) & 255, ((l >> 8) & 255) * lightK);
                    o[j + 2] = AddRound((c >> 16) & 255, ((l >> 16) & 255) * lightK); o[j + 3] = 255;
                    continue;
                }
                double r, g, b, a;
                if (bg == null) { r = c & 255; g = (c >> 8) & 255; b = (c >> 16) & 255; a = ca; }
                else
                {
                    uint k = bg.Value; double f = ca / 255.0;
                    r = (c & 255) * f + (k & 255) * (1 - f); g = ((c >> 8) & 255) * f + ((k >> 8) & 255) * (1 - f);
                    b = ((c >> 16) & 255) * f + ((k >> 16) & 255) * (1 - f); a = 255;
                }
                if (l != 0)
                {
                    double lr = (l & 255) * lightK, lg = ((l >> 8) & 255) * lightK, lb = ((l >> 16) & 255) * lightK;
                    if (a < 255)
                    {
                        double pa = a / 255, pr = r * pa + lr, pg = g * pa + lg, pb = b * pa + lb;
                        double na = Math.Min(1, Math.Max(pa, Math.Max(lr, Math.Max(lg, lb)) / 255));
                        if (na > 0) { r = Math.Min(255, pr / na); g = Math.Min(255, pg / na); b = Math.Min(255, pb / na); a = na * 255; }
                    }
                    else { r = Math.Min(255, r + lr); g = Math.Min(255, g + lg); b = Math.Min(255, b + lb); }
                }
                o[j] = Clamp8(r); o[j + 1] = Clamp8(g); o[j + 2] = Clamp8(b); o[j + 3] = Clamp8(a);
            }
        }
        static byte AddRound(uint v0, double add)
        {
            double v = v0 + add;
            if (v >= 255) return 255;
            int f = (int)v; double d = v - f;
            return (byte)(d > 0.5 ? f + 1 : d < 0.5 ? f : (f & 1) == 0 ? f : f + 1);
        }
        /// 跟網頁 Uint8ClampedArray 一樣：夾在 0～255，四捨五入、剛好 .5 取偶數。
        static byte Clamp8(double v) => v <= 0 || double.IsNaN(v) ? (byte)0 : v >= 255 ? (byte)255 : (byte)Math.Round(v, MidpointRounding.ToEven);
    }

    public class Painter
    {
        // 4×4 網點門檻：透明度 a 的像素，只有 a 大於該格門檻才畫。
        static readonly double[] BAYER = Bayer();
        static double[] Bayer() { int[] v = { 0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5 }; var o = new double[16]; for (int i = 0; i < 16; i++) o[i] = (v[i] + 0.5) / 16; return o; }

        public Frame Frame;
        int w, h, ox, oy; uint[] C, L;
        double tx, ty, fx = 1, cs = 1, sn = 0;
        public double Fade = 1, LightK = 1;
        public string Layer = "front";

        public Painter(Frame f) { Frame = f; Reset(); }
        public Painter Reset()
        {
            var f = Frame; w = f.W; h = f.H; ox = f.Ox; oy = f.Oy; C = f.Color; L = f.LightRaw;
            tx = 0; ty = 0; fx = 1; cs = 1; sn = 0; Fade = 1; LightK = 1; Layer = "front";
            return this;
        }
        /// 把特效原點放在畫布座標 (x, y)；flip 左右鏡像；angle 旋轉（弧度）。
        public Painter Place(double x, double y, bool flip = false, double angle = 0)
        {
            tx = x; ty = y; fx = flip ? -1 : 1; cs = Pf.Cos(angle); sn = Pf.Sin(angle);
            return this;
        }

        /// 沒有旋轉（只可能左右鏡像）：本地的不同整數 x 一定落在畫面上不同的欄
        public bool Straight => sn == 0 && (cs == 1 || cs == -1);
        // ---- 座標轉換
        public double ToX(double x, double y) => tx + x * fx * cs - y * sn;
        public double ToY(double x, double y) => ty + x * fx * sn + y * cs;
        public double FromX(double sx, double sy) { double dx = sx - tx, dy = sy - ty; return (dx * cs + dy * sn) * fx; }
        public double FromY(double sx, double sy) { double dx = sx - tx, dy = sy - ty; return -dx * sn + dy * cs; }
        public int CellX(double x, double y) => (int)Math.Floor(ToX(Math.Floor(x) + 0.5, Math.Floor(y) + 0.5));
        public int CellY(double x, double y) => (int)Math.Floor(ToY(Math.Floor(x) + 0.5, Math.Floor(y) + 0.5));

        // ---- 直接寫入（畫布座標、整數像素）。顏色 0＝什麼都不畫。
        public void Put(int sx, int sy, uint c, double a = 1)
        {
            if (c == 0) return;
            a *= Fade;
            if (a < 1 && a <= BAYER[((sy & 3) << 2) | (sx & 3)]) return;
            int x = sx - ox, y = sy - oy;
            if (x < 0 || y < 0 || x >= w || y >= h) return;
            C[y * w + x] = c;
        }
        public void Add(int sx, int sy, uint c, double k = 1)
        {
            k *= Fade * LightK;
            if (k <= 0.004) return;
            if (Frame.Q.Count > 0) Frame.Flush();
            int x = sx - ox, y = sy - oy;
            if (x < 0 || y < 0 || x >= w || y >= h) return;
            int i = y * w + x; uint d = L[i];
            // 這裡 k > 0.004，值都是 0～255 的正數：直接截成整數（跟 ToInt32 一樣，比較快）
            int r = (int)Math.Min(255, (d & 255) + (c & 255) * k);
            int g = (int)Math.Min(255, ((d >> 8) & 255) + ((c >> 8) & 255) * k);
            int b = (int)Math.Min(255, ((d >> 16) & 255) + ((c >> 16) & 255) * k);
            L[i] = unchecked((uint)((255 << 24) | (b << 16) | (g << 8) | r));
        }
        /// 半透明混色（煙、霧、塵）：保留結果的透明度。
        public void BlendPx(int sx, int sy, uint c, double a)
        {
            a *= Fade;
            if (c == 0 || a <= 0.004) return;
            int x = sx - ox, y = sy - oy;
            if (x < 0 || y < 0 || x >= w || y >= h) return;
            int i = y * w + x; uint d = C[i];
            double da = (d >> 24) / 255.0, oa = a + da * (1 - a), k = a / oa;
            int Ch(int s) => Pf.ToInt32(((c >> s) & 255) * k + ((d >> s) & 255) * (1 - k)) & 255;
            C[i] = unchecked((uint)(((Pf.ToInt32(oa * 255) & 255) << 24) | (Ch(16) << 16) | (Ch(8) << 8) | Ch(0)));
        }
        public void Blend(double x, double y, uint c, double a) => BlendPx(CellX(x, y), CellY(x, y), c, a);
        // 顏色、透明度是固定值的快速版（粒子的煙、塵大多是這種）：不用每格算距離和角度（它們只是傳給顏色函式用），畫到的像素一樣
        void Bounds(double x0, double y0, double x1, double y1, out int sx0, out int sx1, out int sy0, out int sy1)
        {
            double ax = double.PositiveInfinity, bx = double.NegativeInfinity, ay = double.PositiveInfinity, by = double.NegativeInfinity;
            for (int k = 0; k < 4; k++)
            {
                double x = (k & 1) != 0 ? x1 : x0, y = (k & 2) != 0 ? y1 : y0, sx = ToX(x, y), sy = ToY(x, y);
                if (sx < ax) ax = sx; if (sx > bx) bx = sx; if (sy < ay) ay = sy; if (sy > by) by = sy;
            }
            sx0 = (int)Math.Max(Math.Floor(ax), ox); sx1 = (int)Math.Min(Math.Ceiling(bx), ox + w - 1);
            sy0 = (int)Math.Max(Math.Floor(ay), oy); sy1 = (int)Math.Min(Math.Ceiling(by), oy + h - 1);
        }
        public void Disc(double cx, double cy, double r, uint c, double a)
        {
            long __t = PfProf.T0(); try {
            if (r < 0.5) { Blend(cx, cy, c, a); return; }
            Bounds(cx - r, cy - r, cx + r, cy + r, out int sx0, out int sx1, out int sy0, out int sy1);
            double r2 = r * r;
            for (int sy = sy0; sy <= sy1; sy++)
                for (int sx = sx0; sx <= sx1; sx++)
                {
                    double px = sx + 0.5, py = sy + 0.5, dx = FromX(px, py) - cx, dy = FromY(px, py) - cy;
                    if (dx * dx + dy * dy > r2) continue;
                    BlendPx(sx, sy, c, a);
                }
        } finally { PfProf.T1("Disc", __t); }
        }
        public void Disc(double cx, double cy, double r, ColorFn c, AlphaFn a)
        {
            if (r < 0.5) { Blend(cx, cy, c(0, 0), a(0, 0)); return; }
            Each(cx - r, cy - r, cx + r, cy + r, (x, y, sx, sy) =>
            {
                double dx = x - cx, dy = y - cy, d2 = dx * dx + dy * dy;
                if (d2 > r * r) return;
                double d = Math.Sqrt(d2) / r, ang = Pf.Atan2(dy, dx);
                BlendPx(sx, sy, c(d, ang), a(d, ang));
            });
        }
        public uint Get(double x, double y)
        {
            int sx = CellX(x, y) - ox, sy = CellY(x, y) - oy;
            return sx < 0 || sy < 0 || sx >= w || sy >= h ? 0 : C[sy * w + sx];
        }

        // ---- 像素
        public void Px(double x, double y, uint c) => Put(CellX(x, y), CellY(x, y), c, 1);
        public void Dot(double x, double y, uint c, double a = 1) { if (a > 0) Put(CellX(x, y), CellY(x, y), c, a); }
        public void LightAt(double x, double y, uint c, double k = 1) => Add(CellX(x, y), CellY(x, y), c, k);

        public delegate void EachFn(double lx, double ly, int sx, int sy);
        /// 走過中心落在本地方框裡的每個畫布像素。
        public void Each(double x0, double y0, double x1, double y1, EachFn fn)
        {
            double ax = double.PositiveInfinity, bx = double.NegativeInfinity, ay = double.PositiveInfinity, by = double.NegativeInfinity;
            for (int k = 0; k < 4; k++)
            {
                double x = (k & 1) != 0 ? x1 : x0, y = (k & 2) != 0 ? y1 : y0, sx = ToX(x, y), sy = ToY(x, y);
                if (sx < ax) ax = sx; if (sx > bx) bx = sx; if (sy < ay) ay = sy; if (sy > by) by = sy;
            }
            int sx0 = (int)Math.Max(Math.Floor(ax), ox), sx1 = (int)Math.Min(Math.Ceiling(bx), ox + w - 1);
            int sy0 = (int)Math.Max(Math.Floor(ay), oy), sy1 = (int)Math.Min(Math.Ceiling(by), oy + h - 1);
            for (int sy = sy0; sy <= sy1; sy++)
                for (int sx = sx0; sx <= sx1; sx++)
                {
                    double cx = sx + 0.5, cy = sy + 0.5;
                    fn(FromX(cx, cy), FromY(cx, cy), sx, sy);
                }
        }

        /// 像素著色器：fn 回傳 (顏色, 透明度, 光色, 光量)；顏色 0＝不畫。
        public struct Out { public uint c; public double a; public uint l; public double k; }
        public delegate void ShadeFn(double x, double y, ref Out o);
        public void Shade(double x0, double y0, double x1, double y1, ShadeFn fn)
        {
            long __t = PfProf.T0(); try {
            Each(x0, y0, x1, y1, (lx, ly, sx, sy) =>
            {
                var o = new Out { c = 0, a = 1, l = 0, k = 0 };
                fn(lx, ly, ref o);
                if (o.c != 0) Put(sx, sy, o.c, o.a);
                if (o.k > 0) Add(sx, sy, o.l != 0 ? o.l : o.c, o.k);
            });
        } finally { PfProf.T1("Shade", __t); }
        }

        // ---- 形狀
        public void Line(double x0, double y0, double x1, double y1, uint c, double a = 1) => Line(x0, y0, x1, y1, u => c, u => a);
        public void Line(double x0, double y0, double x1, double y1, Func<double, uint> c, Func<double, double> a)
        {
            long __t = PfProf.T0(); try {
            int sx = CellX(x0, y0), sy = CellY(x0, y0), ex = CellX(x1, y1), ey = CellY(x1, y1);
            int dx = Math.Abs(ex - sx), dy = -Math.Abs(ey - sy), stepx = sx < ex ? 1 : -1, stepy = sy < ey ? 1 : -1;
            int n = Math.Max(dx, -dy); if (n == 0) n = 1;
            int err = dx + dy, i = 0;
            for (; ; )
            {
                double u = i++ / (double)n;
                Put(sx, sy, c(u), a(u));
                if (sx == ex && sy == ey) break;
                int e2 = 2 * err;
                if (e2 >= dy) { err += dy; sx += stepx; }
                if (e2 <= dx) { err += dx; sy += stepy; }
            }
        } finally { PfProf.T1("Line", __t); }
        }
        public void Beam(double x0, double y0, double x1, double y1, double width, uint c, double a = 1) => Beam(x0, y0, x1, y1, width, (u, v) => c, (u, v) => a);
        public void Beam(double x0, double y0, double x1, double y1, double width, ColorFn c, AlphaFn a)
        {
            long __t = PfProf.T0(); try {
            double r = width / 2, dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy; if (L2 == 0) L2 = 1e-9;
            Shade(Math.Min(x0, x1) - r, Math.Min(y0, y1) - r, Math.Max(x0, x1) + r, Math.Max(y0, y1) + r, (double x, double y, ref Out o) =>
            {
                double u = Pf.Clamp(((x - x0) * dx + (y - y0) * dy) / L2), px = x0 + dx * u - x, py = y0 + dy * u - y;
                double d2 = px * px + py * py;
                if (d2 > r * r) return;
                double v = Math.Sqrt(d2) / r;
                o.c = c(u, v); o.a = a(u, v);
            });
        } finally { PfProf.T1("Beam", __t); }
        }
        public void Circle(double cx, double cy, double r, uint c, double a = 1)
        {
            if (r < 0.6) { Dot(cx, cy, c, a); return; }
            Bounds(cx - r, cy - r, cx + r, cy + r, out int sx0, out int sx1, out int sy0, out int sy1);
            double r2 = r * r;
            for (int sy = sy0; sy <= sy1; sy++)
                for (int sx = sx0; sx <= sx1; sx++)
                {
                    double px = sx + 0.5, py = sy + 0.5, dx = FromX(px, py) - cx, dy = FromY(px, py) - cy;
                    if (dx * dx + dy * dy > r2) continue;
                    Put(sx, sy, c, a);
                }
        }
        public void Circle(double cx, double cy, double r, ColorFn c, AlphaFn a)
        {
            if (r < 0.6) { Dot(cx, cy, c(0, 0), a(0, 0)); return; }
            Shade(cx - r, cy - r, cx + r, cy + r, (double x, double y, ref Out o) =>
            {
                double dx = x - cx, dy = y - cy, d2 = dx * dx + dy * dy;
                if (d2 > r * r) return;
                double d = Math.Sqrt(d2) / r, ang = Pf.Atan2(dy, dx);
                o.c = c(d, ang); o.a = a(d, ang);
            });
        }
        public void Ellipse(double cx, double cy, double rx, double ry, uint c, double a = 1) => Ellipse(cx, cy, rx, ry, (d, g) => c, (d, g) => a);
        public void Ellipse(double cx, double cy, double rx, double ry, ColorFn c, AlphaFn a)
        {
            if (rx <= 0 || ry <= 0) return;
            Shade(cx - rx, cy - ry, cx + rx, cy + ry, (double x, double y, ref Out o) =>
            {
                double dx = (x - cx) / rx, dy = (y - cy) / ry, d2 = dx * dx + dy * dy;
                if (d2 > 1) return;
                double d = Math.Sqrt(d2), ang = Pf.Atan2(dy, dx);
                o.c = c(d, ang); o.a = a(d, ang);
            });
        }
        /// 跟 Shade 一樣，但切成幾條同時算。只能用在 fn 只看自己那一格（不改外面的東西）的地方：每個像素只寫一次，結果一樣
        public void ShadePar(double x0, double y0, double x1, double y1, ShadeFn fn)
        {
            Bounds(x0, y0, x1, y1, out int sx0, out int sx1, out int sy0, out int sy1);
            if (sx1 < sx0 || sy1 < sy0) return;
            long __t = PfProf.T0(); try {
            // 顏色直接畫；光先記在自己的格子裡（第一次有光才開），畫完再交給畫布照順序加（跟 Add 同一個算法）
            int nx = sx1 - sx0 + 1, ny = sy1 - sy0 + 1;
            var lb = new LBuf();
            void Rows(int ya, int yb)
            {
                for (int sy = ya; sy <= yb; sy++)
                    for (int sx = sx0; sx <= sx1; sx++)
                    {
                        double px = sx + 0.5, py = sy + 0.5;
                        var o = new Out { c = 0, a = 1, l = 0, k = 0 };
                        fn(FromX(px, py), FromY(px, py), ref o);
                        if (o.c != 0) Put(sx, sy, o.c, o.a);
                        if (o.k > 0)
                        {
                            if (lb.k == null) lock (lb) if (lb.k == null) { lb.c = new uint[nx * ny]; lb.k = new double[nx * ny]; }
                            int j = (sy - sy0) * nx + sx - sx0; lb.c[j] = o.l != 0 ? o.l : o.c; lb.k[j] = o.k;
                        }
                    }
            }
            if (nx * ny < 2000) Rows(sy0, sy1);
            else
            {
                int B = Math.Max(1, Math.Min(8, Environment.ProcessorCount)); int per = (ny + B - 1) / B;
                System.Threading.Tasks.Parallel.For(0, B, b => { int ya = sy0 + b * per, yb = Math.Min(sy1, ya + per - 1); if (ya <= yb) Rows(ya, yb); });
            }
            if (lb.k == null) return;
            double fl = Fade * LightK; uint[] Lb = L; int W_ = w, H_ = h, OX = ox, OY = oy;
            int cy0 = Math.Max(sy0, oy), cy1 = Math.Min(sy1, oy + h - 1);
            if (cy0 > cy1) return;
            uint[] LC = lb.c; double[] LK = lb.k;
            Frame.Push(new Frame.GlowCmd { kind = 3, x0 = sx0, x1 = sx1, y0 = cy0, y1 = cy1, rows = (ya, yb) =>
            {
                for (int sy = ya; sy <= yb; sy++)
                {
                    int y = sy - OY, j0 = (sy - sy0) * nx - sx0;
                    for (int sx = sx0; sx <= sx1; sx++)
                    {
                        double k0 = LK[j0 + sx];
                        if (!(k0 > 0)) continue;
                        double k = k0 * fl;
                        if (k <= 0.004) continue;
                        int x = sx - OX;
                        if (x < 0 || x >= W_) continue;
                        uint c = LC[j0 + sx];
                        int i = y * W_ + x; uint d = Lb[i];
                        int r = (int)Math.Min(255, (d & 255) + (c & 255) * k);
                        int g = (int)Math.Min(255, ((d >> 8) & 255) + ((c >> 8) & 255) * k);
                        int bb = (int)Math.Min(255, ((d >> 16) & 255) + ((c >> 16) & 255) * k);
                        Lb[i] = unchecked((uint)((255 << 24) | (bb << 16) | (g << 8) | r));
                    }
                }
            } });
            } finally { PfProf.T1("ShadePar", __t); }
        }
        class LBuf { public uint[] c; public double[] k; }
        /// 顏色、透明度固定的環：不用每格算角度和距離（只傳給顏色函式用），切條同時算；畫到的像素一樣
        public void Ring(double cx, double cy, double r, double wd, uint c, double a = 1)
        {
            double r0 = Math.Max(0, r - wd);
            ShadePar(cx - r, cy - r, cx + r, cy + r, (double x, double y, ref Out o) =>
            {
                double dx = x - cx, dy = y - cy, d2 = dx * dx + dy * dy;
                if (d2 > r * r || d2 < r0 * r0) return;
                o.c = c; o.a = a;
            });
        }
        public void Ring(double cx, double cy, double r, double wd, ColorFn c, AlphaFn a)
        {
            double r0 = Math.Max(0, r - wd);
            Shade(cx - r, cy - r, cx + r, cy + r, (double x, double y, ref Out o) =>
            {
                double dx = x - cx, dy = y - cy, d2 = dx * dx + dy * dy;
                if (d2 > r * r || d2 < r0 * r0) return;
                double den = r - r0; if (den == 0) den = 1;
                double v = wd > 0 ? (Math.Sqrt(d2) - r0) / den : 1, ang = Pf.Atan2(dy, dx);
                o.c = c(v, ang); o.a = a(v, ang);
            });
        }
        public void Arc(double cx, double cy, double r, double wd, double a0, double a1, uint c, double a = 1) => Arc(cx, cy, r, u => wd, a0, a1, (u, v) => c, (u, v) => a);
        public void Arc(double cx, double cy, double r, Func<double, double> wf, double a0, double a1, ColorFn c, AlphaFn a)
        {
            double span = a1 - a0;
            Shade(cx - r, cy - r, cx + r, cy + r, (double x, double y, ref Out o) =>
            {
                double dx = x - cx, dy = y - cy, d = Math.Sqrt(dx * dx + dy * dy);
                if (d > r) return;
                double ang = Pf.Atan2(dy, dx) - a0;
                ang -= Math.Floor(ang / (Math.PI * 2)) * Math.PI * 2;
                if (ang > span) return;
                double u = ang / span, ww = wf(u);
                if (ww <= 0 || d < r - ww) return;
                double v = (d - (r - ww)) / ww;
                o.c = c(u, v); o.a = a(u, v);
            });
        }
        public void Rect(double x, double y, double rw, double rh, uint c, double a = 1)
        {
            if (sn == 0)
            {
                int X0 = (int)Pf.Round(x), Y0 = (int)Pf.Round(y), X1 = (int)Pf.Round(x + rw), Y1 = (int)Pf.Round(y + rh);
                for (int yy = Y0; yy < Y1; yy++) for (int xx = X0; xx < X1; xx++) Put(CellX(xx, yy), CellY(xx, yy), c, a);
                return;
            }
            Shade(x, y, x + rw, y + rh, (double lx, double ly, ref Out o) =>
            {
                if (lx < x || ly < y || lx >= x + rw || ly >= y + rh) return;
                o.c = c; o.a = a;
            });
        }
        public void Poly(double[][] pts, uint c, double a = 1) => Poly(pts, (x, y) => c, (x, y) => a);
        public void Poly(double[][] pts, ColorFn c, AlphaFn a)
        {
            long __t = PfProf.T0(); try {
            double x0 = double.PositiveInfinity, y0 = double.PositiveInfinity, x1 = double.NegativeInfinity, y1 = double.NegativeInfinity;
            foreach (var q in pts) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; }
            int n = pts.Length;
            Shade(x0, y0, x1, y1, (double x, double y, ref Out o) =>
            {
                bool inside = false;
                for (int i = 0, j = n - 1; i < n; j = i++)
                {
                    double xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
                    if ((yi > y) != (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
                }
                if (!inside) return;
                o.c = c(x, y); o.a = a(x, y);
            });
        } finally { PfProf.T1("Poly", __t); }
        }
        public void Tri(double x0, double y0, double x1, double y1, double x2, double y2, uint c, double a = 1) =>
            Poly(new[] { new[] { x0, y0 }, new[] { x1, y1 }, new[] { x2, y2 } }, c, a);

        // ---- 光
        // 光暈的迴圈範圍先夾在畫布內（畫布外的格子 Add 本來就會丟掉，結果一樣，少算很多）
        int ClipX0(int v) => Math.Max(v, ox); int ClipX1(int v) => Math.Min(v, ox + w - 1);
        int ClipY0(int v) => Math.Max(v, oy); int ClipY1(int v) => Math.Min(v, oy + h - 1);
        public void Glow(double x, double y, double r, uint c, double k = 0.5)
        {
            long __t = PfProf.T0(); try {
            if (r < 1 || k <= 0.004) return;
            double cx = ToX(x, y), cy = ToY(x, y);
            int x0 = ClipX0((int)Math.Floor(cx - r)), x1 = ClipX1((int)Math.Ceiling(cx + r)), y0 = ClipY0((int)Math.Floor(cy - r)), y1 = ClipY1((int)Math.Ceiling(cy + r));
            if (x1 < x0 || y1 < y0) return;
            double fl = Fade * LightK;
            // 有效半徑：離中心越遠光越弱，弱到 ≤ 0.004 的格子 Add 本來就不加。先算出那個距離（留安全邊界），
            // 每一列只算那個距離以內的格子（邊界內照原本逐格精確計算，結果一樣）
            double kf = k * fl;
            if (kf <= 0.004) return;
            double fmin = Math.Sqrt(0.004 / kf), rc = 1 - fmin, dcut = rc * rc * (1 + 1e-6) + 1e-9;
            Frame.Push(new Frame.GlowCmd { kind = 0, x0 = x0, x1 = x1, y0 = y0, y1 = y1, a = cx, b = cy, r = r, k = k, fl = fl, cut = dcut, cr = c & 255, cg = (c >> 8) & 255, cb = (c >> 16) & 255 });
            } finally { PfProf.T1("Glow", __t); }
        }
        public void GlowLine(double x0, double y0, double x1, double y1, double r, uint c, double k = 0.5)
        {
            long __t = PfProf.T0(); try {
            if (r < 1 || k <= 0.004) return;
            double ax = ToX(x0, y0), ay = ToY(x0, y0), bx = ToX(x1, y1), by = ToY(x1, y1);
            double dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy; if (L2 == 0) L2 = 1e-9;
            // 有效半徑：離線越遠光越弱，弱到 ≤ 0.004 的格子本來就不加；範圍只取到那裡（留 1 格邊界，裡面照原本逐格算）
            double kf = k * Fade * LightK;
            if (kf <= 0.004) return;
            double re = r * (1 - Math.Sqrt(0.004 / kf)) + 1;
            if (re > r) re = r;
            int X0 = ClipX0((int)Math.Floor(Math.Min(ax, bx) - re)), X1 = ClipX1((int)Math.Ceiling(Math.Max(ax, bx) + re));
            int Y0 = ClipY0((int)Math.Floor(Math.Min(ay, by) - re)), Y1 = ClipY1((int)Math.Ceiling(Math.Max(ay, by) + re));
            if (X1 < X0 || Y1 < Y0) return;
            Frame.Push(new Frame.GlowCmd { kind = 1, x0 = X0, x1 = X1, y0 = Y0, y1 = Y1, a = ax, b = ay, c = dx, d = dy, e = L2, r = r, k = k, fl = Fade * LightK, cr = c & 255, cg = (c >> 8) & 255, cb = (c >> 16) & 255 });
            } finally { PfProf.T1("GlowLine", __t); }
        }
        public void GlowRing(double x, double y, double R, double r, uint c, double k = 0.5)
        {
            long __t = PfProf.T0(); try {
            if (r < 1 || k <= 0.004) return;
            double cx = ToX(x, y), cy = ToY(x, y), E = R + r;
            int X0 = ClipX0((int)Math.Floor(cx - E)), X1 = ClipX1((int)Math.Ceiling(cx + E)), Y0 = ClipY0((int)Math.Floor(cy - E)), Y1 = ClipY1((int)Math.Ceiling(cy + E));
            if (X1 < X0 || Y1 < Y0) return;
            Frame.Push(new Frame.GlowCmd { kind = 2, x0 = X0, x1 = X1, y0 = Y0, y1 = Y1, a = cx, b = cy, c = R, r = r, k = k, fl = Fade * LightK, cr = c & 255, cg = (c >> 8) & 255, cb = (c >> 16) & 255 });
            } finally { PfProf.T1("GlowRing", __t); }
        }
    }
}
