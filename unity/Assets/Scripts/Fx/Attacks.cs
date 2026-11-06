// 五個形態的普攻特效（網頁版 game/fx/attacks/*.js）一行一行翻成 C#。
// 迴圈、運算順序、數字都照原本，網頁版改了這裡也要跟著改（比對測試會抓出來）。
using System;
using static PixelFX.Pf;

namespace PixelFX.Fx
{
    public static class Attacks
    {
        static readonly uint WHITE = Col.WHITE;
        static FxMeta M(string name, int w, int h, int ox, int oy, double dur, string[] pal) =>
            new FxMeta { Name = name, W = w, H = h, OX = ox, OY = oy, Duration = dur, Fps = 30, Palette = pal };

        // ================================================================ 星星：星角拳
        static readonly string[] STAR_PAL = { "#2a1608", "#6b3c10", "#b8701a", "#f0b42e", "#ffe27a", "#fff6cf", "#ffffff" };

        static void Star5(Painter p, double x, double y, double R, double rot, uint[] C, double k)
        {
            if (R < 1) return;
            double ri = R * 0.45;
            bool Inside(double px, double py)
            {
                double a = Math.Atan2(py - y, px - x) - rot, d = Hypot(px - x, py - y);
                double seg = ((a % (TAU / 5)) + TAU / 5) % (TAU / 5), u = Math.Abs(seg - TAU / 10) / (TAU / 10);
                return d <= R * (1 - u) + ri * u;
            }
            for (double py = Math.Floor(y - R); py <= Math.Ceiling(y + R); py++)
                for (double px = Math.Floor(x - R); px <= Math.Ceiling(x + R); px++)
                {
                    if (!Inside(px + 0.5, py + 0.5)) continue;
                    double d = Hypot(px + 0.5 - x, py + 0.5 - y) / R;
                    bool edge = !Inside(px + 1.5, py + 0.5) || !Inside(px - 0.5, py + 0.5) || !Inside(px + 0.5, py + 1.5) || !Inside(px + 0.5, py - 0.5);
                    p.Dot(px, py, edge ? C[3] : d < 0.25 ? WHITE : d < 0.5 ? C[5] : C[4], k > 0.5 ? 1 : k * 2);
                }
            p.Glow(x, y, R * 2.2, C[4], 0.5 * k);
        }
        static void Mote(Painter p, double x, double y, uint[] C, double k)
        {
            p.Dot(x, y, k > 0.6 ? WHITE : C[5], 1);
            if (k > 0.4) { p.Dot(x + 1, y, C[4], k); p.Dot(x - 1, y, C[4], k); p.Dot(x, y + 1, C[4], k); p.Dot(x, y - 1, C[4], k); }
        }
        static Action<Painter, double, string[]> Jab(double hy, bool flip) => (p, t, pal) =>
        {
            const double HIT = 0.05;
            uint[] C = Col.Fit(pal, 7); double IX = 24, IY = hy;
            if (t < HIT + 0.04)
            {
                double k = 1 - Clamp((t - HIT) / 0.04, 0, 1);
                foreach (var (dy, l) in new[] { (-3.0, 14), (0.0, 18), (3.0, 12) })
                    for (int i = 0; i < l; i++)
                    {
                        double x = IX - 4 - l + i + Ease.OutCubic(Clamp(t / HIT, 0, 1)) * 4;
                        p.Dot(x, IY + dy, i > l - 4 ? C[5] : C[3], k * ((double)i / l));
                    }
            }
            double a = t - HIT;
            if (a >= 0 && a < 0.2)
            {
                double grow = a < 0.03 ? 0.6 : Ease.OutBack(Clamp((a - 0.03) / 0.06, 0, 1)), k = 1 - Clamp((a - 0.08) / 0.12, 0, 1);
                if (a < 0.034) { p.Circle(IX, IY, 5, WHITE); p.Glow(IX, IY, 14, WHITE, 0.6); }
                else Star5(p, IX, IY, 7 * grow * (0.6 + 0.4 * k), (flip ? -1 : 1) * (0.3 + a * 4), C, k);
                for (int i = 0; i < 5; i++)
                {
                    double ang = ((double)i / 5) * TAU + (flip ? 0.6 : 0), v = 70 + i * 9, d = v * a - 160 * a * a;
                    if (a > 0.03) Mote(p, Pf.Round(IX + Math.Cos(ang) * d * 0.9), Pf.Round(IY + Math.Sin(ang) * d * 0.6), C, 1 - a / 0.2);
                }
            }
        };
        static void Spin(Painter p, double t, string[] pal)
        {
            const double T1 = 0.12;
            uint[] C = Col.Fit(pal, 7); double CX = 0, CY = -12, R = 17;
            double head = Ease.OutCubic(Clamp(t / T1, 0, 1)) * TAU * 1.05, fade = 1 - Clamp((t - T1) / 0.15, 0, 1);
            for (double s = 0; s < 2.8; s += 0.03)
            {
                double ang = head - s - Math.PI / 2, u = s / 2.8;
                if (head - s < 0 || ToInt32(s * 20) % 5 == 4) continue;
                foreach (var (dr, c) in new[] { (-1.0, u < 0.2 ? WHITE : C[5]), (0.0, u < 0.15 ? WHITE : u < 0.55 ? C[5] : C[4]), (1.0, C[3]) })
                    p.Dot(CX + Math.Cos(ang) * (R + dr), CY + Math.Sin(ang) * (R + dr) * 0.75, c, (1 - u) * fade);
            }
            if (t < T1) p.Glow(CX + Math.Cos(head - Math.PI / 2) * R, CY + Math.Sin(head - Math.PI / 2) * R * 0.75, 8, C[5], 0.4);
            foreach (var (ht, X, Rr) in new[] { (0.05, 22.0, 5.0), (T1, 28.0, 10.0) })
            {
                double a = t - ht; if (a < 0 || a >= 0.24) continue;
                double k = 1 - Clamp((a - 0.06) / 0.18, 0, 1);
                if (a < 0.034) { p.Circle(X, CY, Rr * 0.7, WHITE); p.Glow(X, CY, Rr * 2.5, WHITE, 0.6); }
                else Star5(p, X, CY, Rr * Ease.OutBack(Clamp((a - 0.03) / 0.07, 0, 1)) * (0.7 + 0.3 * k), a * 5, C, k);
                for (int i = 0; i < (Rr > 6 ? 8 : 4); i++)
                {
                    double ang = ((double)i / 8) * TAU + 0.3, d = (90 + i * 7) * a - 170 * a * a;
                    if (a > 0.03) Mote(p, Pf.Round(X + Math.Cos(ang) * d), Pf.Round(CY + Math.Sin(ang) * d * 0.7), C, 1 - a / 0.24);
                }
            }
        }
        public static readonly FxModule[] STAR =
        {
            new FxModule(M("Star jab A", 150, 80, 40, 60, 0.3, STAR_PAL), Jab(-14, false)),
            new FxModule(M("Star jab B", 150, 80, 40, 60, 0.3, STAR_PAL), Jab(-11, true)),
            new FxModule(M("Star spin ram", 150, 80, 40, 60, 0.4, STAR_PAL), Spin),
        };

        // ================================================================ 黏液星：黏液鞭
        static readonly string[] SLIME_PAL = { "#0c2010", "#1a4a20", "#2a8a3a", "#4cc04a", "#8ee86a", "#d4ffb0", "#f0fff0" };

        static (double x, double y)? Lash(Painter p, uint[] C, double x0, double y0, double reach, double ext, double bend, double wave, double thick = 1)
        {
            double L = reach * ext;
            if (L < 2) return null;
            var pts = new System.Collections.Generic.List<(double x, double y, double v)>();
            for (double s = 0; s <= L; s += 0.5)
            {
                double u = s / reach, x = x0 + s, y = y0 + bend * u * u * reach * 0.35 + Math.Sin(u * 7 - wave) * 2.2 * u * (1 - u) * 4;
                pts.Add((x, y, s / L));
            }
            foreach (var (x, y, v) in pts) { double w = (4.5 - 2.5 * v) * thick; for (double q = -w - 1; q <= w + 1; q += 0.5) p.Dot(x, y + q, C[0], 1); }
            foreach (var (x, y, v) in pts)
            {
                double w = (4.5 - 2.5 * v) * thick;
                for (double q = -w; q <= w; q += 0.5) p.Dot(x, y + q, q < -w + 1 ? C[5] : q > w - 1.2 ? C[2] : C[3], 1);
                if (v > 0.2 && v < 0.8 && (ToInt32(x) % 5 == 0)) p.Dot(x, y - w + 1, WHITE, 1);
            }
            var tip = pts[pts.Count - 1]; double br = 3.2 * thick;
            p.Circle(tip.x, tip.y, br + 1, C[0]); p.Circle(tip.x, tip.y, br, C[3]); p.Circle(tip.x - 1, tip.y - 1, br * 0.55, C[4]); p.Dot(tip.x - 1.5, tip.y - 1.5, WHITE, 1);
            return (tip.x, tip.y);
        }
        static void Splat(Painter p, uint[] C, double x, double y, double a, double big = 1, double? floor = null)
        {
            if (a < 0 || a > 0.32) return;
            double k = 1 - a / 0.32;
            if (a < 0.034) { p.Circle(x, y, 4 * big, WHITE); p.Glow(x, y, 12 * big, C[5], 0.6); }
            else if (a < 0.12) p.Ring(x, y, 3 + a * 70 * big, 1.2, C[4], 1 - a / 0.12);
            for (int i = 0; i < 7 * big; i++)
            {
                double ang = -Math.PI / 2 + (i / (7 * big) - 0.5) * 2.6, v = (60 + (i * 37) % 50) * big;
                double px = x + Math.Cos(ang) * v * a, py = y + Math.Sin(ang) * v * a + 260 * a * a;
                if (floor != null && py > floor.Value) py = floor.Value;
                double r = i % 3 == 0 ? 1.5 : 1;
                if (k < 0.15) continue;
                p.Circle(px, py, r + 0.5, i % 2 != 0 ? C[4] : C[3]);
                if (r > 1) p.Dot(px - 0.5, py - 0.5, C[5], 1);
            }
            p.Glow(x, y, 10 * big, C[4], 0.3 * k);
        }
        static Action<Painter, double, string[]> Whip(double bend, double wave0) => (p, t, pal) =>
        {
            const double OUT = 0.08, BACK = 0.24;
            uint[] C = Col.Fit(pal, 7);
            double ext = t < OUT ? Ease.OutCubic(t / OUT) : 1 - Ease.InQuad(Clamp((t - OUT - 0.04) / (BACK - OUT - 0.04), 0, 1));
            var tip = Lash(p, C, 10, -13, 78, ext, bend, wave0 + t * 30, 1 - Clamp((t - OUT) / BACK, 0, 0.5));
            if (tip != null && t < OUT + 0.02) p.Glow(tip.Value.x, tip.Value.y, 6, C[5], 0.4);
            Splat(p, C, 10 + 78, -13 + bend * 78 * 0.35, t - OUT, 1);
        };
        static void Slam(Painter p, double t, string[] pal)
        {
            const double OUT = 0.12, BACK = 0.34;
            uint[] C = Col.Fit(pal, 7);
            double ext = t < OUT ? Ease.OutCubic(t / OUT) : 1 - Ease.InQuad(Clamp((t - OUT - 0.08) / (BACK - OUT - 0.08), 0, 1));
            Lash(p, C, 8, -17, 70, ext, 1.2, t * 26, 1.2);
            Lash(p, C, 10, -10, 74, ext, 1.55, t * 30 + 1, 1.3);
            double a = t - OUT;
            Splat(p, C, 10 + 74, -1, a, 1.6, 0);
            if (a > 0)
            {
                double w = Math.Min(22, a * 300) * (1 - Clamp((a - 0.2) / 0.2, 0, 1));
                for (double x = -w; x <= w; x++)
                {
                    double e = Math.Abs(x) / Math.Max(1, w);
                    p.Dot(84 + x, 0, e > 0.8 ? C[1] : C[3], 1);
                    if (e < 0.6) p.Dot(84 + x, -1, e < 0.3 ? C[5] : C[4], 1);
                }
            }
        }
        public static readonly FxModule[] SLIME =
        {
            new FxModule(M("Slime whip A", 190, 90, 40, 70, 0.36, SLIME_PAL), Whip(-0.3, 0)),
            new FxModule(M("Slime whip B", 190, 90, 40, 70, 0.36, SLIME_PAL), Whip(0.45, 1.5)),
            new FxModule(M("Slime whip slam", 190, 90, 40, 70, 0.5, SLIME_PAL), Slam),
        };

        // ================================================================ 蝠翼星：翼刃
        static readonly string[] BAT_PAL = { "#160c24", "#2e1a4a", "#5c388c", "#8058b8", "#b48ae8", "#e2d0ff", "#ffffff" };
        static readonly double[] BAT_HITS = { 0.0, 0.11, 0.22, 0.36 };

        static void Crescent(Painter p, uint[] C, double cx, double cy, double r, double a0, double a1, double prog, double k)
        {
            double span = (a1 - a0) * prog;
            for (double s = 0; s <= 1; s += 0.02)
            {
                double a = a0 + span * s, w = Math.Sin(Math.PI * s) * 4.2 + 0.8;
                for (double q = 0; q <= w; q += 0.5)
                {
                    if (q > w * k + 0.3) break;
                    double rr = r - q, x = cx + Math.Cos(a) * rr, y = cy + Math.Sin(a) * rr * 0.8;
                    bool front = s > 0.75;
                    p.Dot(x, y, q < 0.8 ? (front ? WHITE : C[5]) : q < w * 0.6 ? C[4] : C[3], 1);
                }
            }
            p.Glow(cx + Math.Cos(a0 + span) * r, cy + Math.Sin(a0 + span) * r * 0.8, 7, C[4], 0.4 * k);
        }
        static void Feather(Painter p, uint[] C, double x, double y, double a, int seed)
        {
            if (a < 0 || a > 0.5) return;
            double k = 1 - a / 0.5, sx = x + Math.Sin(a * 14 + seed) * 4 + (seed % 2 != 0 ? 1 : -1) * a * 20, sy = y + a * 34;
            p.Dot(sx, sy, C[4], k); p.Dot(sx + 1, sy, C[3], k); p.Dot(sx - 1, sy + 1, C[3], k); p.Dot(sx, sy + 1, C[2], k);
        }
        static void Flurry(Painter p, double t, string[] pal)
        {
            uint[] C = Col.Fit(pal, 7); int LAST = BAT_HITS.Length - 1;
            for (int i = 0; i < BAT_HITS.Length; i++)
            {
                double a = t - BAT_HITS[i] + 0.04; if (a < 0 || a > 0.16) continue;
                double prog = Ease.OutCubic(Clamp(a / 0.06, 0, 1)), k = 1 - Clamp((a - 0.06) / 0.1, 0, 1);
                if (i < LAST)
                {
                    bool up = i % 2 == 0;
                    Crescent(p, C, 18, -13, 13 + (i % 3), up ? -2.3 : 2.3, up ? 0.9 : -0.9, prog, k);
                }
                else
                {
                    Crescent(p, C, 20, -13, 17, -2.4, 1.0, prog, k);
                    Crescent(p, C, 20, -13, 17, 2.4, -1.0, prog, k);
                }
            }
            double a7 = t - BAT_HITS[LAST];
            if (a7 >= 0 && a7 < 0.26)
            {
                double g = Clamp(a7 / 0.05, 0, 1), k = 1 - Clamp((a7 - 0.08) / 0.18, 0, 1);
                for (int j = -1; j <= 1; j++)
                    for (double s = -10; s <= -10 + 20 * g; s++)
                    {
                        double x = 30 + s * 0.7 + j * 4, y = -13 + s * 0.9 - j * 2, e = 1 - Math.Abs(s) / 11;
                        if (e < 1 - k) continue;
                        p.Dot(x, y, e > 0.55 ? WHITE : e > 0.25 ? C[5] : C[4], 1); p.Dot(x + 1, y, C[4], 1); p.Dot(x + 1, y + 1, C[3], 1);
                    }
            }
            for (int i = 0; i < BAT_HITS.Length; i++)
            {
                double ht = BAT_HITS[i];
                Feather(p, C, 22 + (i % 3) * 4, -16 + (i % 2) * 6, t - ht - 0.03, i);
                if (i % 2 != 0) Feather(p, C, 14, -20, t - ht - 0.06, i + 3);
            }
        }
        public static readonly FxModule[] BAT =
        {
            new FxModule(M("Bat wing flurry", 150, 90, 40, 70, 0.64, BAT_PAL), Flurry),
        };

        // ================================================================ 鐵罐星：蓋子咬
        static readonly string[] CAN_PAL = { "#14161c", "#2a2e38", "#4a5468", "#6e7a90", "#9aa6ba", "#d0d8e6", "#eef2f8" };
        static readonly uint[] SK = Col.Ramp(new[] { "#fff3a6", "#ffc23d", "#ff8a2a", "#c44a1a" });

        static void Jaw(Painter p, uint[] C, double cx, double cy, double open, bool upper, double k)
        {
            if (k <= 0.05) return;
            double W = 27, ang = (upper ? -1 : 1) * open, ca = Math.Cos(ang), sa = Math.Sin(ang);
            void Put(double lx, double ly, uint c) => p.Dot(cx + lx * ca - ly * sa, cy + lx * sa + ly * ca, c, 1);
            for (double lx = 0; lx <= W * k; lx += 0.5)
            {
                double z = (lx - (W - 4)) / 4;
                double th = (upper ? 8 : 5) * (lx > W - 4 ? Math.Sqrt(Math.Max(0, 1 - Math.Pow(z, 2))) : 1);
                for (double ly = 0; ly <= th; ly += 0.5)
                {
                    double y = upper ? -ly : ly; bool rim = ly > th - 1.2, edge = ly < 1;
                    Put(lx, y, rim ? C[0] : upper && ly > th - 2.5 ? C[5] : edge ? C[2] : lx < 4 ? C[3] : C[4]);
                }
                if (Math.Floor(lx) % 4 == 1 && lx < W - 2) { Put(lx, upper ? 1 : -1, WHITE); Put(lx + 1, upper ? 1 : -1, C[5]); }
            }
            if (upper) foreach (double lx in new[] { W - 11, W - 10, W - 9 }) Put(lx, -9.5, C[4]);
        }
        static void Mouth(Painter p, uint[] C, double cx, double cy, double open, double k)
        {
            if (open < 0.08 || k < 0.3) return;
            for (int lx = 1; lx < 25; lx++)
            {
                double h = Math.Tan(open) * lx * 0.9;
                for (double y = -h; y <= h; y++) p.Dot(cx + lx, cy + y, Math.Abs(y) > h - 1 ? C[1] : C[0], 1);
            }
        }
        static void Sparks(Painter p, double x, double y, double a, int n, double spread, double seed)
        {
            if (a < 0 || a > 0.3) return;
            for (int i = 0; i < n; i++)
            {
                double ang = -Math.PI / 2 + ((i * 2.399 + seed) % spread) - spread / 2, v = 90 + ((i * 53) % 60);
                double sx = x + Math.Cos(ang) * v * a, sy = y + Math.Sin(ang) * v * a + 300 * a * a;
                uint c = SK[(int)Math.Min(3, Math.Floor(a / 0.08))];
                p.Dot(sx, sy, c, 1); p.Dot(sx - Math.Cos(ang) * 2, sy - Math.Sin(ang) * 2, SK[(int)Math.Min(3, Math.Floor(a / 0.08) + 1)], 0.7);
                p.Glow(sx, sy, 3, c, 0.3);
            }
        }
        static Action<Painter, double, string[]> Bite(double cy, double seed) => (p, t, pal) =>
        {
            const double SNAP = 0.07;
            uint[] C = Col.Fit(pal, 7); double cx = 14, k = t < 0.03 ? t / 0.03 : 1 - Clamp((t - 0.2) / 0.1, 0, 1);
            double open = t < SNAP ? 0.75 * (1 - Ease.InQuad(t / SNAP)) + 0.05 : 0;
            Mouth(p, C, cx, cy, open, k); Jaw(p, C, cx, cy, open, true, k); Jaw(p, C, cx, cy, open, false, k);
            double a = t - SNAP;
            if (a >= 0 && a < 0.04) { p.Circle(cx + 25, cy, 5, WHITE); p.Glow(cx + 25, cy, 14, WHITE, 0.6); }
            Sparks(p, cx + 25, cy, a, 10, 2.6, seed);
        };
        static void Smash(Painter p, double t, string[] pal)
        {
            const double HIT = 0.14;
            uint[] C = Col.Fit(pal, 7); double X = 26, a = t - HIT;
            if (t < HIT)
            {
                double u = Ease.InQuad(t / HIT);
                foreach (var (dx, l, c) in new[] { (-6.0, 16, C[3]), (0.0, 26, C[5]), (6.0, 14, C[3]) })
                    for (int i = 0; i < l; i++) { double y = -46 + 44 * u - i; if (y < -46) break; p.Dot(X + dx, y, i < 4 ? WHITE : c, 1); }
            }
            if (a < 0) return;
            if (a < 0.1)
            {
                double L = 22 * (1 - a / 0.1);
                foreach (var (dx, dy, f) in new[] { (1.0, 0.0, 1.0), (-1.0, 0.0, 1.0), (0.0, -1.0, 0.6) })
                    for (double d = 0; d < L * f; d++) p.Dot(X + dx * d, -2 + dy * d, d < L * f * 0.4 ? WHITE : C[5], 1 - d / (L * f));
                p.Glow(X, -2, 18, WHITE, 0.6 * (1 - a / 0.1));
            }
            foreach (var (delay, sz) in new[] { (0.0, 1.0), (0.06, 0.7) })
            {
                double b = a - delay; if (b < 0 || b > 0.45) continue;
                foreach (double s in new[] { -1.0, 1.0 })
                    for (int i = 0; i < 4; i++)
                    {
                        double d = (30 + i * 9) * (1 - Math.Exp(-b * 6)) * sz, r = (3.5 - i * 0.5) * (1 - b / 0.45) * sz + 1;
                        p.Disc(X + s * d, -r * 0.8, r, C[3], 0.55 * (1 - b / 0.45));
                    }
            }
            for (int i = 0; i < 6; i++)
            {
                double vx = (i - 2.5) * 34, vy = -120 - (i % 3) * 30, px = X + vx * a, py = -2 + vy * a + 420 * a * a;
                if (a < 0.45 && py < 0) { p.Dot(px, py, C[4], 1); p.Dot(px + 1, py, C[2], 1); }
            }
            Sparks(p, X, -3, a, 10, 2.2, 7);
        }
        public static readonly FxModule[] CAN =
        {
            new FxModule(M("Can bite A", 170, 100, 50, 80, 0.34, CAN_PAL), Bite(-13, 1)),
            new FxModule(M("Can bite B", 170, 100, 50, 80, 0.34, CAN_PAL), Bite(-11, 3)),
            new FxModule(M("Can smash", 170, 100, 50, 80, 0.6, CAN_PAL), Smash),
        };

        // ================================================================ 尖刺星：刺擊
        static readonly string[] SPIKE_PAL = { "#2a1206", "#6a3010", "#a85a1c", "#e09a3a", "#ffd890", "#fff2d0", "#ffffff" };

        static void Needle(Painter p, uint[] C, double x0, double y0, double ang, double L, double w0, double k)
        {
            double ux = Math.Cos(ang), uy = Math.Sin(ang), nx = -uy, ny = ux;
            for (double s = 0; s <= L; s += 0.5)
            {
                double u = s / L, w = w0 * (1 - u) + 0.3;
                for (double q = -w; q <= w; q += 0.5)
                    p.Dot(x0 + ux * s + nx * q, y0 + uy * s + ny * q, u > 0.88 ? WHITE : q < 0 ? (u > 0.5 ? C[5] : C[4]) : u > 0.5 ? C[4] : C[3], k);
            }
        }
        static void Cross(Painter p, uint[] C, double x, double y, double r, double k)
        {
            for (double d = -r; d <= r; d++) { p.Dot(x + d, y, Math.Abs(d) < 2 ? WHITE : C[5], k); p.Dot(x, y + d * 0.7, Math.Abs(d) < 2 ? WHITE : C[4], k); }
            p.Glow(x, y, r * 2, C[4], 0.5 * k);
        }
        static Action<Painter, double, string[]> Stab(double y, double reach) => (p, t, pal) =>
        {
            const double OUT = 0.05;
            uint[] C = Col.Fit(pal, 7); double x0 = 12;
            double L = reach * (t < OUT ? Ease.OutExpo(t / OUT) : 1), k = 1 - Clamp((t - OUT - 0.04) / 0.12, 0, 1);
            if (k <= 0) return;
            double cut = L * (1 - k);
            Needle(p, C, x0 + cut, y, 0, L - cut, 2.4 * k + 0.4, 1);
            if (k > 0.5) foreach (double dy in new[] { -3.0, 3.0 }) for (double s = 6; s < L * 0.8; s += 2) p.Dot(x0 + s, y + dy, C[3], 1);
            if (t >= OUT && k > 0.3) Cross(p, C, x0 + L, y, 5 * (1 - Clamp((t - OUT) / 0.1, 0, 0.6)), 1);
        };
        static void Fan(Painter p, double t, string[] pal)
        {
            const double OUT = 0.08;
            uint[] C = Col.Fit(pal, 7); double k = 1 - Clamp((t - OUT - 0.08) / 0.16, 0, 1);
            if (k <= 0) return;
            double g = t < OUT ? Ease.OutExpo(t / OUT) : 1;
            if (t < OUT + 0.06) { p.Circle(12, -13, 5 * (1 - t / (OUT + 0.06)) + 1, t < 0.04 ? WHITE : C[5]); p.Glow(12, -13, 14, C[4], 0.5); }
            for (int i = 0; i < 5; i++)
            {
                double ang = -0.5 + i * 0.25, L = (62 + (i == 2 ? 14 : 0)) * g;
                double cut = L * (1 - k);
                Needle(p, C, 12 + Math.Cos(ang) * cut, -13 + Math.Sin(ang) * cut, ang, L - cut, (i == 2 ? 2.6 : 1.8) * k + 0.4, 1);
                if (t >= OUT && k > 0.3) Cross(p, C, 12 + Math.Cos(ang) * L, -13 + Math.Sin(ang) * L, i == 2 ? 5 : 3, 1);
            }
        }
        public static readonly FxModule[] SPIKE =
        {
            new FxModule(M("Spike stab A", 180, 90, 40, 70, 0.24, SPIKE_PAL), Stab(-14, 54)),
            new FxModule(M("Spike stab B", 180, 90, 40, 70, 0.24, SPIKE_PAL), Stab(-11, 54)),
            new FxModule(M("Spike stab C", 180, 90, 40, 70, 0.24, SPIKE_PAL), Stab(-16, 56)),
            new FxModule(M("Spike fan burst", 180, 90, 40, 70, 0.36, SPIKE_PAL), Fan),
        };

        public static FxModule[] Group(string g) => g switch
        {
            "star" => STAR, "slime" => SLIME, "bat" => BAT, "can" => CAN, "spike" => SPIKE, _ => null,
        };
    }
}
