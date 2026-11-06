// pixelfx core 的 painter.js 與 fx.js（畫布、合成）翻成 C#。
// 畫筆畫進畫布的兩個緩衝：Color（不透明像素，淡出用 4×4 網點，不混色）與 Light（加法光，最後疊上去）。
// 特效用自己的座標（原點＝角色腳底、面向右）畫，畫筆負責放置、鏡像、旋轉。
// 顏色和透明度可以是常數或函式：常數版的多載直接轉成函式版。
using System;

namespace PixelFX
{
    public delegate uint ColorFn(double u, double v);
    public delegate double AlphaFn(double u, double v);

    /// 一張畫布：W×H 像素，左上角在世界座標 (Ox, Oy)。
    public class Frame
    {
        public readonly int W, H;
        public int Ox, Oy;
        public readonly uint[] Color, Light;
        public Frame(int w, int h, int ox = 0, int oy = 0) { W = w; H = h; Ox = ox; Oy = oy; Color = new uint[w * h]; Light = new uint[w * h]; }
        public Frame Clear() { Array.Clear(Color, 0, Color.Length); Array.Clear(Light, 0, Light.Length); return this; }

        /// Color 疊在背景上再加光，輸出 RGBA 位元組。bg：null＝透明。照 fx.js 的 composite。
        /// 畫面切成幾條同時算（每個像素各算各的，結果跟一條一條算完全一樣）。
        public byte[] Composite(byte[] o = null, uint? bg = null, double lightK = 1)
        {
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
                uint c = Color[i], l = Light[i] & 0xffffff;
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
            var f = Frame; w = f.W; h = f.H; ox = f.Ox; oy = f.Oy; C = f.Color; L = f.Light;
            tx = 0; ty = 0; fx = 1; cs = 1; sn = 0; Fade = 1; LightK = 1; Layer = "front";
            return this;
        }
        /// 把特效原點放在畫布座標 (x, y)；flip 左右鏡像；angle 旋轉（弧度）。
        public Painter Place(double x, double y, bool flip = false, double angle = 0)
        {
            tx = x; ty = y; fx = flip ? -1 : 1; cs = Pf.Cos(angle); sn = Pf.Sin(angle);
            return this;
        }

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
            int x = sx - ox, y = sy - oy;
            if (x < 0 || y < 0 || x >= w || y >= h) return;
            int i = y * w + x; uint d = L[i];
            int r = Pf.ToInt32(Math.Min(255, (d & 255) + (c & 255) * k));
            int g = Pf.ToInt32(Math.Min(255, ((d >> 8) & 255) + ((c >> 8) & 255) * k));
            int b = Pf.ToInt32(Math.Min(255, ((d >> 16) & 255) + ((c >> 16) & 255) * k));
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
        public void Disc(double cx, double cy, double r, uint c, double a) => Disc(cx, cy, r, (d, g) => c, (d, g) => a);
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
            Each(x0, y0, x1, y1, (lx, ly, sx, sy) =>
            {
                var o = new Out { c = 0, a = 1, l = 0, k = 0 };
                fn(lx, ly, ref o);
                if (o.c != 0) Put(sx, sy, o.c, o.a);
                if (o.k > 0) Add(sx, sy, o.l != 0 ? o.l : o.c, o.k);
            });
        }

        // ---- 形狀
        public void Line(double x0, double y0, double x1, double y1, uint c, double a = 1) => Line(x0, y0, x1, y1, u => c, u => a);
        public void Line(double x0, double y0, double x1, double y1, Func<double, uint> c, Func<double, double> a)
        {
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
        }
        public void Beam(double x0, double y0, double x1, double y1, double width, uint c, double a = 1) => Beam(x0, y0, x1, y1, width, (u, v) => c, (u, v) => a);
        public void Beam(double x0, double y0, double x1, double y1, double width, ColorFn c, AlphaFn a)
        {
            double r = width / 2, dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy; if (L2 == 0) L2 = 1e-9;
            Shade(Math.Min(x0, x1) - r, Math.Min(y0, y1) - r, Math.Max(x0, x1) + r, Math.Max(y0, y1) + r, (double x, double y, ref Out o) =>
            {
                double u = Pf.Clamp(((x - x0) * dx + (y - y0) * dy) / L2), px = x0 + dx * u - x, py = y0 + dy * u - y;
                double d2 = px * px + py * py;
                if (d2 > r * r) return;
                double v = Math.Sqrt(d2) / r;
                o.c = c(u, v); o.a = a(u, v);
            });
        }
        public void Circle(double cx, double cy, double r, uint c, double a = 1) => Circle(cx, cy, r, (d, g) => c, (d, g) => a);
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
        public void Ring(double cx, double cy, double r, double wd, uint c, double a = 1) => Ring(cx, cy, r, wd, (v, g) => c, (v, g) => a);
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
        }
        public void Tri(double x0, double y0, double x1, double y1, double x2, double y2, uint c, double a = 1) =>
            Poly(new[] { new[] { x0, y0 }, new[] { x1, y1 }, new[] { x2, y2 } }, c, a);

        // ---- 光
        public void Glow(double x, double y, double r, uint c, double k = 0.5)
        {
            if (r < 1 || k <= 0.004) return;
            double cx = ToX(x, y), cy = ToY(x, y);
            int x0 = (int)Math.Floor(cx - r), x1 = (int)Math.Ceiling(cx + r), y0 = (int)Math.Floor(cy - r), y1 = (int)Math.Ceiling(cy + r);
            for (int sy = y0; sy <= y1; sy++)
            {
                double dy = (sy + 0.5 - cy) / r;
                for (int sx = x0; sx <= x1; sx++)
                {
                    double dx = (sx + 0.5 - cx) / r, d = dx * dx + dy * dy;
                    if (d >= 1) continue;
                    double f = 1 - Math.Sqrt(d);
                    Add(sx, sy, c, f * f * k);
                }
            }
        }
        public void GlowLine(double x0, double y0, double x1, double y1, double r, uint c, double k = 0.5)
        {
            if (r < 1 || k <= 0.004) return;
            double ax = ToX(x0, y0), ay = ToY(x0, y0), bx = ToX(x1, y1), by = ToY(x1, y1);
            double dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy; if (L2 == 0) L2 = 1e-9;
            int X0 = (int)Math.Floor(Math.Min(ax, bx) - r), X1 = (int)Math.Ceiling(Math.Max(ax, bx) + r);
            int Y0 = (int)Math.Floor(Math.Min(ay, by) - r), Y1 = (int)Math.Ceiling(Math.Max(ay, by) + r);
            for (int sy = Y0; sy <= Y1; sy++)
                for (int sx = X0; sx <= X1; sx++)
                {
                    double px = sx + 0.5, py = sy + 0.5, u = Pf.Clamp(((px - ax) * dx + (py - ay) * dy) / L2);
                    double ex = ax + dx * u - px, ey = ay + dy * u - py, d = Math.Sqrt(ex * ex + ey * ey) / r;
                    if (d >= 1) continue;
                    double f = 1 - d;
                    Add(sx, sy, c, f * f * k);
                }
        }
        public void GlowRing(double x, double y, double R, double r, uint c, double k = 0.5)
        {
            if (r < 1 || k <= 0.004) return;
            double cx = ToX(x, y), cy = ToY(x, y), E = R + r;
            for (int sy = (int)Math.Floor(cy - E); sy <= (int)Math.Ceiling(cy + E); sy++)
                for (int sx = (int)Math.Floor(cx - E); sx <= (int)Math.Ceiling(cx + E); sx++)
                {
                    double d = Math.Abs(Pf.Hypot(sx + 0.5 - cx, sy + 0.5 - cy) - R) / r;
                    if (d >= 1) continue;
                    double f = 1 - d;
                    Add(sx, sy, c, f * f * k);
                }
        }
    }
}
