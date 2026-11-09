// pixelfx 的 fx/weather/_lib.js（clip、rows、pass、field、sample、trips、crown、bayer）與
// fx/critters/_lib.js（shift、spring、toss、Grid、Swarm、shadow）翻成 C#：天氣和小動物共用的工具。
// 運算順序、亂數取用順序照原本；JS 用 Float32Array 的地方（Grid 的透明度、rows 的 a/k、field）這裡也用 float。
using System;
using System.Collections.Generic;
using static PixelFX.Pf;

namespace PixelFX.Fx
{
    public static class WeatherLib
    {
        static readonly double[] BAYER = MakeBayer();
        static double[] MakeBayer() { int[] v = { 0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5 }; var o = new double[16]; for (int i = 0; i < 16; i++) o[i] = (v[i] + 0.5) / 16; return o; }

        /// 畫布在本地座標的範圍：x0 ≤ x < x1、y0 ≤ y < y1
        public struct Box { public double x0, y0, x1, y1; public int w, h; }
        public static Box BoxOf(FxDef m) => new Box { x0 = -m.OX, y0 = -m.OY, x1 = m.W - m.OX, y1 = m.H - m.OY, w = m.W, h = m.H };
        /// 只畫在特效畫布裡的畫筆（框外的顏色、混色、光都丟掉）
        public static Painter Clip(Painter p, FxDef m) { var B = BoxOf(m); return p.Clip(B.x0, B.y0, B.x1, B.y1); }

        /// 本地像素的網點門檻（0～1）：a > Bayer(x, y) 就畫
        public static double Bayer(double x, double y) => BAYER[((ToInt32(Math.Floor(y)) & 3) << 2) | (ToInt32(Math.Floor(x)) & 3)];

        // ---- pass：整片畫布的逐像素著色器（第 y0～y1 列）
        public struct Out { public uint c; public double a; public int b; public uint l; public double k; }
        public delegate void PassFn(double x, double y, ref Out o);
        public static void Pass(Painter p, FxDef meta, double y0, double y1, PassFn fn)
        {
            var B = BoxOf(meta);
            y0 = Math.Max(B.y0, Math.Floor(y0));
            y1 = Math.Min(B.y1 - 1, Math.Ceiling(y1));
            if (y0 > y1) return;
            var o = new Out();
            if (p.SN != 0)
            {
                var q = Clip(p, meta);
                for (double y = y0; y <= y1; y++)
                    for (double x = B.x0; x < B.x1; x++)
                    {
                        o.c = 0; o.a = 1; o.b = 0; o.l = 0; o.k = 0;
                        fn(x + 0.5, y + 0.5, ref o);
                        if (o.c != 0) { if (o.b != 0) q.Blend(x, y, o.c, o.a); else q.Dot(x, y, o.c, o.a); }
                        if (o.k > 0) q.LightAt(x, y, o.l != 0 ? o.l : o.c, o.k);
                    }
                return;
            }
            // 沒旋轉：直接算畫布座標（照原本一格一格加 fx），經過畫筆的 Put／BlendPx／Add（判斷跟原本的直寫一樣）
            int W = p.Frame.W, Hh = p.Frame.H, OX = p.Frame.Ox, OY = p.Frame.Oy; double fx = p.FX, tx = p.TX;
            for (double y = y0; y <= y1; y++)
            {
                int sy = (int)Math.Floor(p.TY + y + 0.5), ry = sy - OY;
                if (ry < 0 || ry >= Hh) continue;
                double sxf = tx + (B.x0 + 0.5) * fx;
                for (double x = B.x0; x < B.x1; x++, sxf += fx)
                {
                    int sx = (int)Math.Floor(sxf), rx = sx - OX;
                    if (rx < 0 || rx >= W) continue;
                    o.c = 0; o.a = 1; o.b = 0; o.l = 0; o.k = 0;
                    fn(x + 0.5, y + 0.5, ref o);
                    if (o.c != 0) { if (o.b != 0) p.BlendPx(sx, sy, o.c, o.a); else p.Put(sx, sy, o.c, o.a); }
                    if (o.k > 0) p.Add(sx, sy, o.l != 0 ? o.l : o.c, o.k);
                }
            }
        }

        // ---- rows：一次填一整列（R.c 顏色、R.a 透明度、R.b 1＝混色、R.l／R.k 光），i＝x - box.x0
        public class Row { public int w = -1; public uint[] c, l; public float[] a, k; public byte[] b; }
        static readonly Row ROW = new Row();   // 跟原本一樣共用一份（R.l 不會每列清掉）
        public static void Rows(Painter p, FxDef meta, double y0, double y1, Action<double, Row> fn)
        {
            var B = BoxOf(meta); int w = B.w; var R = ROW;
            if (R.w != w) { R.w = w; R.c = new uint[w]; R.a = new float[w]; R.b = new byte[w]; R.l = new uint[w]; R.k = new float[w]; }
            y0 = Math.Max(B.y0, Math.Floor(y0));
            y1 = Math.Min(B.y1 - 1, Math.Ceiling(y1));
            bool rot = p.SN != 0; var q = rot ? Clip(p, meta) : null;
            int W = p.Frame.W, Hh = p.Frame.H, OX = p.Frame.Ox, OY = p.Frame.Oy; double fx = p.FX;
            for (double y = y0; y <= y1; y++)
            {
                Array.Clear(R.c, 0, w); Array.Clear(R.k, 0, w); Array.Clear(R.b, 0, w);
                for (int i = 0; i < w; i++) R.a[i] = 1;
                fn(y + 0.5, R);
                if (rot)
                {
                    for (int i = 0; i < w; i++)
                    {
                        if (R.c[i] != 0) { if (R.b[i] != 0) q.Blend(B.x0 + i, y, R.c[i], R.a[i]); else q.Dot(B.x0 + i, y, R.c[i], R.a[i]); }
                        if (R.k[i] > 0) q.LightAt(B.x0 + i, y, R.l[i] != 0 ? R.l[i] : R.c[i], R.k[i]);
                    }
                    continue;
                }
                int sy = (int)Math.Floor(p.TY + y + 0.5), ry = sy - OY;
                if (ry < 0 || ry >= Hh) continue;
                double sxf = p.TX + (B.x0 + 0.5) * fx;
                for (int i = 0; i < w; i++, sxf += fx)
                {
                    uint c = R.c[i]; double kk = R.k[i];
                    if (c == 0 && !(kk > 0)) continue;
                    int sx = (int)Math.Floor(sxf), rx = sx - OX;
                    if (rx < 0 || rx >= W) continue;
                    if (c != 0) { if (R.b[i] != 0) p.BlendPx(sx, sy, c, R.a[i]); else p.Put(sx, sy, c, R.a[i]); }
                    if (kk > 0) p.Add(sx, sy, R.l[i] != 0 ? R.l[i] : c, kk);
                }
            }
        }

        /// 跟 Rows 一樣，但切成幾段同時算（只能用在 fn 只填 R、每一列只寫自己那一列的地方；R.l 每段各一份，fn 每列都會自己設好用到的 R.l）
        static readonly Row[] rowPool = new Row[8];
        public static void RowsPar(Painter p, FxDef meta, double y0, double y1, Action<double, Row> fn)
        {
            if (p.SN != 0) { Rows(p, meta, y0, y1, fn); return; }
            var B = BoxOf(meta); int w = B.w;
            y0 = Math.Max(B.y0, Math.Floor(y0));
            y1 = Math.Min(B.y1 - 1, Math.Ceiling(y1));
            if (y0 > y1) return;
            int W = p.Frame.W, Hh = p.Frame.H, OX = p.Frame.Ox, OY = p.Frame.Oy; double fx = p.FX;
            int nRows = (int)(y1 - y0) + 1, per = (nRows + 7) / 8;
            PixelFX.Par.For(8, band =>
            {
                // 每段一份、重複用（每格不產生新的）；R.l 在每段開始清掉，跟原本每次新做一份一樣
                var R = rowPool[band]; if (R == null || R.w != w) R = rowPool[band] = new Row { w = w, c = new uint[w], a = new float[w], b = new byte[w], l = new uint[w], k = new float[w] };
                else Array.Clear(R.l, 0, w);
                for (int r = band * per, e = Math.Min(nRows, r + per); r < e; r++)
                {
                    double y = y0 + r;
                    Array.Clear(R.c, 0, w); Array.Clear(R.k, 0, w); Array.Clear(R.b, 0, w);
                    for (int i = 0; i < w; i++) R.a[i] = 1;
                    fn(y + 0.5, R);
                    int sy = (int)Math.Floor(p.TY + y + 0.5), ry = sy - OY;
                    if (ry < 0 || ry >= Hh) continue;
                    double sxf = p.TX + (B.x0 + 0.5) * fx;
                    for (int i = 0; i < w; i++, sxf += fx)
                    {
                        uint c = R.c[i]; double kk = R.k[i];
                        if (c == 0 && !(kk > 0)) continue;
                        int sx = (int)Math.Floor(sxf), rx = sx - OX;
                        if (rx < 0 || rx >= W) continue;
                        if (c != 0) { if (R.b[i] != 0) p.BlendPx(sx, sy, c, R.a[i]); else p.Put(sx, sy, c, R.a[i]); }
                        if (kk > 0) p.Add(sx, sy, R.l[i] != 0 ? R.l[i] : c, kk);
                    }
                }
            });
        }

        // ---- field：會接起來的碎形雜訊（w×h 格，值 0～1），算一次記住
        public class Field { public int w, h; public float[] d; }
        static readonly Dictionary<string, Field> FIELDS = new Dictionary<string, Field>();
        public static Field MakeField(int seed, int w, int h, int[] cells)
        {
            string key = seed + "|" + w + "|" + h + "|" + string.Join(",", cells);
            lock (FIELDS) if (FIELDS.TryGetValue(key, out var F0)) return F0;
            var d = new float[w * h];
            double amp = 0.5, total = 0;
            foreach (int n in cells)
            {
                double cs = (double)w / n; int rows = (int)Math.Max(1, Round(h / cs));
                double At(double a, double b) => Rand(ToInt32(Wrap(a, n)), ToInt32(Wrap(b, rows)), seed, n);
                for (int y = 0; y < h; y++)
                    for (int x = 0; x < w; x++)
                    {
                        double gx = x / cs, gy = ((double)y / h) * rows, ix = Math.Floor(gx), iy = Math.Floor(gy), u = gx - ix, v = gy - iy;
                        double su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
                        double top = At(ix, iy) + (At(ix + 1, iy) - At(ix, iy)) * su, bot = At(ix, iy + 1) + (At(ix + 1, iy + 1) - At(ix, iy + 1)) * su;
                        d[y * w + x] = (float)(d[y * w + x] + (top + (bot - top) * sv) * amp);
                    }
                total += amp;
                amp *= 0.5;
            }
            for (int i = 0; i < d.Length; i++) d[i] = (float)(d[i] / total);
            var F = new Field { w = w, h = h, d = d };
            lock (FIELDS) FIELDS[key] = F;
            return F;
        }
        /// field 在 (u, v)（以格為單位，會繞回來，格與格之間平滑）
        public static double Sample(Field F, double u, double v)
        {
            double x = Math.Floor(u), y = Math.Floor(v), fx = u - x, fy = v - y; int m = F.w - 1, n = F.h - 1; var D = F.d;
            int x0 = ToInt32(x) & m, x1 = ToInt32(x + 1) & m, y0 = (ToInt32(y) & n) * F.w, y1 = (ToInt32(y + 1) & n) * F.w;
            double a = D[y0 + x0], b = D[y0 + x1], c = D[y1 + x0], e = D[y1 + x1];
            return a + (b - a) * fx + (c - a + (a - b - c + e) * fx) * fy;
        }

        /// 一個迴圈 D 秒裡落下的粒子：n 格，每格一個迴圈落 m 次（m0～m1），fn(u, k, m, i)
        public static void Trips(double t, double D, int n, int seed, int m0, int m1, Action<double, double, int, int> fn)
        {
            for (int i = 0; i < n; i++)
            {
                int m = m0 + (int)Math.Floor(Rand(seed, i, 72) * (m1 - m0 + 1));
                double s = (t / D) * m + Rand(seed, i, 71), k = Math.Floor(s);
                fn(s - k, k, m, i);
            }
        }

        /// 雨滴落在地上 age 秒後的水花：白點、往上的兩臂、攤開斷成兩段的水線、彈起的水珠。結束了回傳 false
        public static bool Crown(Painter q, double x, double z, double age, double size, uint hot, uint cool, uint white, double h)
        {
            double L = 0.22 + 0.14 * size, u = age / L, X = Round(x), Z = Round(z);
            if (u >= 1) return false;
            if (age < 0.1)
            {
                double up = age < 0.033 ? 1 : age < 0.067 ? 2 : 2 + (size > 0.5 ? 1 : 0);
                q.Px(X, Z - 1, age < 0.05 ? white : hot);
                for (double d = 1; d <= Math.Min(up, size > 0.5 ? 3 : 1); d++)
                {
                    q.Px(X - d, Z - 1 - (d > 1 ? d - 1 : 0), d == 1 ? hot : cool);
                    q.Px(X + d, Z - 1 - (d > 1 ? d - 1 : 0), d == 1 ? hot : cool);
                }
            }
            if (u > 0.15)
            {
                double w = Round(1 + (1.5 + 3.5 * size) * Math.Sqrt(u)), gap = u > 0.55 ? Math.Max(0, w - 2) : -1;
                for (double d = -w; d <= w; d++) if (Math.Abs(d) > gap) q.Px(X + d, Z, Math.Abs(d) >= w - 1 && u < 0.6 ? hot : cool);
            }
            int nd = size > 0.5 ? 2 : 1, H = ToInt32(Math.Floor(h * 1e6));
            for (int d = 0; d < nd; d++)
            {
                double vx = (Rand(H, d, 1) - 0.5) * 2 * (20 + 30 * size), vy = -(50 + Rand(H, d, 2) * 60 * (0.4 + size)), y = Z - 1 + vy * age + 475 * age * age;
                if (y < Z - 0.5 && age < 0.3) q.Px(x + vx * age, y, age < 0.1 ? white : hot);
            }
            return true;
        }
    }

    public static class CritterLib
    {
        /// 這隻的迴圈時間：種子不是 1 的從迴圈別的地方開始，一群同樣的才不會同步
        public static double Shift(double t, double D, int seed = 1) => Wrap(t + (seed - 1) * 0.618 * D, D);
        /// 彈簧被踢一下之後的擺動：age 0 時 1，hz 的頻率振、damp 的速度停
        public static double Spring(double age, double hz, double damp) => age < 0 ? 0 : Exp(-age * damp) * Cos(age * hz * TAU);

        public struct Tossed { public double x, y, vx, vy, at, lx; public bool landed; }
        /// 從 (x, y) 以 (vx, vy) 拋出、重力 g、落在地板 y = floor 停住
        public static Tossed Toss(double x, double y, double vx, double vy, double age, double g, double floor = 0)
        {
            double tl = g > 0 ? (-vy + Math.Sqrt(Math.Max(0, vy * vy + 2 * g * (floor - y)))) / g : double.PositiveInfinity;
            if (age < tl) return new Tossed { x = x + vx * age, y = y + vy * age + 0.5 * g * age * age, vx = vx, vy = vy + g * age, landed = false, at = tl, lx = x + vx * tl };
            return new Tossed { x = x + vx * tl, y = floor, vx = 0, vy = 0, landed = true, at = tl, lx = x + vx * tl };
        }

        /// 軟影子：混色的橢圓，中心 a、往邊緣淡掉
        public static void Shadow(Painter p, double cx, double cy, double rx, double ry, uint c, double a)
        {
            if (rx <= 0 || ry <= 0 || a <= 0) return;
            for (double y = Math.Floor(cy - ry); y <= Math.Ceiling(cy + ry); y++)
                for (double x = Math.Floor(cx - rx); x <= Math.Ceiling(cx + rx); x++)
                {
                    double d = Pow((x + 0.5 - cx) / rx, 2) + Pow((y + 0.5 - cy) / ry, 2);
                    if (d < 1) p.Blend(x, y, c, a * Pow(1 - d, 0.7));
                }
        }
    }

    /// 小動物大小的畫布（本地座標 [x0, x0 + w) × [y0, y0 + h)），每格一個顏色和透明度
    public class Grid
    {
        public readonly int x0, y0, w, h;
        public readonly uint[] c; public readonly float[] a; public readonly byte[] tag;
        public struct GOut { public double a; public int t; }
        public delegate uint ShadeFn(double x, double y, ref GOut o);
        public Grid(double x0, double y0, int w, int h)
        {
            this.x0 = (int)Math.Floor(x0); this.y0 = (int)Math.Floor(y0); this.w = w; this.h = h;
            c = new uint[w * h]; a = new float[w * h]; tag = new byte[w * h];
        }
        public int Idx(double x, double y)
        {
            double ix = Math.Floor(x) - x0, iy = Math.Floor(y) - y0;
            return ix < 0 || iy < 0 || ix >= w || iy >= h ? -1 : (int)(iy * w + ix);
        }
        public void Set(double x, double y, uint col, double al = 1, int tg = 0)
        {
            int i = Idx(x, y);
            if (i >= 0 && col != 0) { c[i] = col; a[i] = (float)al; tag[i] = (byte)tg; }
        }
        public uint Get(double x, double y) { int i = Idx(x, y); return i < 0 ? 0 : c[i]; }
        public void Shade(double x0_, double y0_, double x1_, double y1_, ShadeFn fn)
        {
            var o = new GOut();
            for (double y = Math.Floor(y0_); y <= Math.Floor(y1_); y++)
                for (double x = Math.Floor(x0_); x <= Math.Floor(x1_); x++)
                {
                    o.a = 1; o.t = 0;
                    uint col = fn(x + 0.5, y + 0.5, ref o);
                    if (col != 0) Set(x, y, col, o.a, o.t);
                }
        }
        /// 填滿的橢圓；c(nx, ny) 用標準化的位移（-1～1）決定顏色
        public void Ellipse(double cx, double cy, double rx, double ry, Func<double, double, uint> col, double al = 1)
        {
            if (rx <= 0 || ry <= 0) return;
            Shade(cx - rx, cy - ry, cx + rx, cy + ry, (double x, double y, ref GOut o) =>
            {
                double nx = (x - cx) / rx, ny = (y - cy) / ry;
                if (nx * nx + ny * ny > 1) return 0;
                o.a = al;
                return col(nx, ny);
            });
        }
        public void Line(double x0_, double y0_, double x1_, double y1_, uint col, double al = 1)
        {
            double n = Math.Max(1, Math.Ceiling(Math.Max(Math.Abs(x1_ - x0_), Math.Abs(y1_ - y0_))));
            for (double i = 0; i <= n; i++) Set(x0_ + ((x1_ - x0_) * i) / n, y0_ + ((y1_ - y0_) * i) / n, col, al);
        }
        /// 一串圓連成的管子（腿、尾巴）：r(u) 粗細，c(u, v) 顏色（v 0 中心～1 邊）
        public void Tube(double[][] pts, Func<double, double> r, Func<double, double, uint> col, double al = 1)
        {
            for (int k = 1; k < pts.Length; k++)
            {
                double ax = pts[k - 1][0], ay = pts[k - 1][1], bx = pts[k][0], by = pts[k][1], L = Math.Max(1, Hypot(bx - ax, by - ay));
                for (double s = 0; s <= L; s += 0.5)
                {
                    double u = (k - 1 + s / L) / (pts.Length - 1), rr = r(u);
                    double x = ax + ((bx - ax) * s) / L, y = ay + ((by - ay) * s) / L;
                    if (rr < 0.75) { Set(x, y, col(u, 0), al); continue; }
                    Shade(x - rr, y - rr, x + rr, y + rr, (double px, double py, ref GOut o) =>
                    {
                        double d = Hypot(px - x, py - y) / rr;
                        o.a = al;
                        return d > 1 ? 0 : col(u, d);
                    });
                }
            }
        }
        /// 目前畫的東西外面包一圈 1 px 的外框（四鄰）
        public void Outline(uint col, double al = 1)
        {
            var src = (uint[])c.Clone();
            for (int y = 0; y < h; y++)
                for (int x = 0; x < w; x++)
                {
                    int i = y * w + x;
                    if (src[i] != 0) continue;
                    bool l = x > 0 && src[i - 1] != 0, r = x < w - 1 && src[i + 1] != 0, u = y > 0 && src[i - w] != 0, d = y < h - 1 && src[i + w] != 0;
                    if (!(l || r || u || d)) continue;
                    if (col != 0) { c[i] = col; a[i] = (float)al; tag[i] = 255; }
                }
        }
        /// 外框（每一邊自己選顏色）：fn(x, y, nx, ny) 用本地座標和朝外的方向（四鄰加起來）決定顏色，回傳 0＝留空（史萊姆用）
        public void Outline(Func<double, double, int, int, uint> fn, double al = 1)
        {
            var src = (uint[])c.Clone();
            for (int y = 0; y < h; y++)
                for (int x = 0; x < w; x++)
                {
                    int i = y * w + x;
                    if (src[i] != 0) continue;
                    bool l = x > 0 && src[i - 1] != 0, r = x < w - 1 && src[i + 1] != 0, u = y > 0 && src[i - w] != 0, d = y < h - 1 && src[i + w] != 0;
                    if (!(l || r || u || d)) continue;
                    uint col = fn(x0 + x, y0 + y, (l ? 1 : 0) - (r ? 1 : 0), (u ? 1 : 0) - (d ? 1 : 0));
                    if (col != 0) { c[i] = col; a[i] = (float)al; tag[i] = 255; }
                }
        }
        /// 放到畫筆上，移動 (dx, dy)：不透明的照 fade 打網點，半透明的混色
        public void Draw(Painter p, double fade = 1, double dx = 0, double dy = 0)
        {
            double X = x0 + Round(dx), Y = y0 + Round(dy);
            for (int y = 0; y < h; y++)
                for (int x = 0; x < w; x++)
                {
                    int i = y * w + x; uint col = c[i];
                    if (col == 0) continue;
                    double al = a[i];
                    if (al >= 0.999) p.Dot(X + x, Y + y, col, fade);
                    else p.Blend(X + x, Y + y, col, al * fade);
                }
        }
        public Grid Clear() { Array.Clear(c, 0, c.Length); Array.Clear(tag, 0, tag.Length); return this; }
    }

    /// 狀態只看時間的粒子（純函式迴圈）用工具組的粒子樣子畫：Begin(t)，每個現在活著的 Add，再 Draw
    public class Swarm
    {
        public readonly Particles ps = new Particles(new Rng(1));
        public Swarm Begin(double t) { ps.List.Clear(); ps.t = t; return this; }
        public void Add(int k, double x, double y, double vx, double vy, double age, double life, uint col, double size = 1, int flag = 0, double seed = 0)
        {
            if (age < 0 || age >= life) return;
            ps.List.Add(new Particle { k = k, x = x, y = y, vx = vx, vy = vy, life = life - age, max = life, col = col, size = size, seed = seed, delay = 0, flag = flag });
        }
        public void Draw(Painter p, string layer = null) => ps.Draw(p, layer);
    }
}
