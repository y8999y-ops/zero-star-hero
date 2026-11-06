// 第二批特效用到的共用工具（網頁版 pixelfx/src/fx/*/_lib.js），只翻用得到的：
//   ArcaneLib：arcane/_lib.js（地上的透視圓環、符文、小光點）
//   HolyLib：holy/_lib.js 的 GOLD 色階
//   ImpactLib：impacts/_lib.js（石頭配色、打擊星芒、地裂、衝擊波新月、翻滾的石塊）
using System;
using System.Collections.Generic;
using static PixelFX.Pf;

namespace PixelFX.Fx
{
    public static class ArcaneLib
    {
        /// 光點（跟模擬的 MOTE 一樣畫）：亮頭、暗尾、光。
        public static void Mote(Painter p, double x, double y, double vx, double vy, uint c, double size = 1, double k = 1, double glow = 0.4)
        {
            double sp = Hypot(vx, vy); if (sp == 0 || double.IsNaN(sp)) sp = 1;
            double ux = vx / sp, uy = vy / sp, len = Math.Min(16, 0.5 + sp * 0.026) * size, a = k < 0.35 ? k / 0.35 : 1;
            if (len > 1.2) p.Line(x - ux * len, y - uy * len, x - ux * len * 0.35, y - uy * len * 0.35, Col.Scale(c, 0.55), a);
            p.Line(x - ux * len * 0.4, y - uy * len * 0.4, x, y, c, a);
            if (glow > 0) p.Glow(x, y, 2.5 + size, c, glow * k);
        }

        /// 地上一圈 1px 的透視圓（sy 壓扁）。c(角度) 給顏色；keep(角度) 決定畫哪一段。
        public static void FloorRing(Painter p, double cx, double cy, double r, double sy, Func<double, uint> c, double a = 1, Func<double, bool> keep = null)
        {
            if (r < 0.5) return;
            double ry = r * sy;
            p.Shade(cx - r - 1, cy - ry - 1, cx + r + 1, cy + ry + 1, (double x, double y, ref Painter.Out o) =>
            {
                double nx = (x - cx) / r, ny = (y - cy) / Math.Max(0.3, ry), d = Hypot(nx, ny);
                if (d < 1e-6) return;
                double g = Hypot(nx / r, ny / Math.Max(0.3, ry)) / d;
                if (Math.Abs(d - 1) / g > 0.5) return;
                double ang = Atan2(ny, nx);
                if (keep != null && !keep(ang)) return;
                o.c = c(ang);
                o.a = a;
            });
        }

        /// 自創的符文：3×5 的角形字，1 倍大也看得清。
        public static readonly string[][] GLYPHS =
        {
            new[] { ".#.", "#.#", ".#.", ".#.", "#.#" },
            new[] { "#.#", "#.#", ".#.", "#.#", "#.#" },
            new[] { "##.", "#.#", "##.", "#..", "#.." },
            new[] { "#..", "#.#", "###", "#.#", "..#" },
            new[] { ".##", "#..", ".#.", "..#", "##." },
            new[] { "###", ".#.", "###", ".#.", ".#." },
            new[] { "#.#", "###", "#.#", "..#", "..#" },
            new[] { ".#.", ".##", ".#.", "##.", ".#." },
        };
        // painter.sprite(rows, {}, x, y, { tint, a })：每個非 "." 的格子用 tint 畫
        static void Tinted(Painter p, string[] rows, double x, double y, uint tint, double a)
        {
            if (tint == 0) return;
            for (int r = 0; r < rows.Length; r++)
                for (int q = 0; q < rows[r].Length; q++)
                {
                    char ch = rows[r][q];
                    if (ch == '.' || ch == ' ') continue;
                    p.Dot(x + q, y + r, tint, a);
                }
        }
        /// 符文 i 站在 (x, y)：最下面一列在 y、以 x 置中。under：往下一格的暗色，讓字有一點厚度（0＝沒有）。
        public static void Glyph(Painter p, int i, double x, double y, uint c, double a = 1, uint under = 0)
        {
            int L = GLYPHS.Length; var g = GLYPHS[((i % L) + L) % L];
            double X = Round(x) - 1, Y = Round(y) - g.Length + 1;
            if (under != 0) Tinted(p, g, X, Y + 1, under, a);
            Tinted(p, g, X, Y, c, a);
        }
    }

    public static class HolyLib
    {
        public static readonly string[] GOLD = { "#3b1d2a", "#7a3a2c", "#c4652e", "#f0a040", "#ffd25e", "#fff0a0", "#fffbe0", "#ffffff" };
    }

    public static class ImpactLib
    {
        public static readonly uint SOOT = Col.Hex("#0d0a12");
        public static readonly uint OUTLINE = Col.Hex("#1a1422");
        static readonly double LIGHT = Atan2(-1, -1); // 光從左上來

        /// 一個本體色延伸出的石頭配色：亮、本體、暗、塵（亮一點、灰一點）、斷口（被照亮的碎邊）。
        public class Stone { public uint light, body, shade, dust, lip; }
        public static Stone StoneOf(uint c) => new Stone
        {
            light = Col.Mix(Col.Scale(c, 1.35), Col.WHITE, 0.08), body = c, shade = Col.Scale(c, 0.64),
            dust = Col.Mix(Col.Scale(c, 1.2), Col.Rgb(150, 140, 150), 0.3), lip = Col.Mix(Col.Scale(c, 1.55), Col.WHITE, 0.12),
        };

        public class Spike { public double a, len, w; }
        /// 打擊星芒：尖刺分三次畫（外框、靠根部比較淡的身體、熱核心），圍著熱的中心。sc 拉長，th 變細。
        public static void Star(Painter p, double x, double y, IList<Spike> list, double sc, double th, uint[] cols, double a = 1, double heart = 2.4)
        {
            uint rim = cols[0], body = cols[1], inner = cols[2], core = cols[3];
            for (int pass = 0; pass < 3; pass++)
                foreach (var s in list)
                {
                    double c = Cos(s.a), sn = Sin(s.a), L = s.len * sc;
                    for (double d = 0; d <= L; d += 0.5)
                    {
                        if (pass == 2 && d > L * 0.55) break;
                        double hw0 = s.w * th * (1 - d / L) * Math.Min(1, 0.5 + d / 3);
                        double hw = pass == 0 ? hw0 + 0.8 : pass == 1 ? hw0 : hw0 * 0.45;
                        uint col = pass == 0 ? rim : pass == 1 ? (d < L * 0.35 ? inner : body) : core;
                        for (double o = -hw; o <= hw; o += 0.5) p.Dot(x + c * d - sn * o, y + sn * d + c * o, col, a);
                    }
                }
            double r = heart * sc * Math.Sqrt(th);
            p.Circle(x, y, r + 0.8, inner, a);
            p.Circle(x, y, r, core, a);
        }

        // 從 (x, y) 朝 a 走 L px 的鋸齒線；每個點是 [x, y, 走了多遠]
        static List<double[]> Walk(Rng R, double x, double y, double a, double L, double jit = 0.55, double steer = 0.45, double step0 = 2, double step1 = 4, double maxY = double.PositiveInfinity, double d0 = 0)
        {
            var pts = new List<double[]> { new[] { x, y, d0 } };
            double d = 0, cur = a;
            while (d < L - 0.01)
            {
                double s = Math.Min(L - d, R.Range(step0, step1));
                cur += R.Range(-jit, jit) + (a - cur) * steer;
                x += Cos(cur) * s;
                y = Clamp(y + Sin(cur) * s, 0.5, maxY);
                d += s;
                pts.Add(new[] { x, y, d0 + d });
            }
            return pts;
        }

        public class Crack { public List<double[]> pts; public double len, t0; public List<List<double[]>> kids = new List<List<double[]>>(); }
        /// (0, 0) 下面地面上的裂縫：n 條鋸齒線左右交替，大多淺、少數往下鑽，有些分岔。
        public static List<Crack> MakeCracks(Rng R, int n, double len0 = 14, double len1 = 40, double dive = 0.85, double maxY = 22, double forks = 0.5, double x00 = 1, double x01 = 5)
        {
            var o = new List<Crack>();
            for (int i = 0; i < n; i++)
            {
                double side = i % 2 != 0 ? 1 : -1, dip = 0.06 + Pow(R.Next(), 1.7) * dive, L = R.Range(len0, len1) * (1 - (0.5 * dip) / (dive + 0.06));
                double a = side > 0 ? dip : Math.PI - dip;
                double sx = side * R.Range(x00, x01), sy = R.Range(0.5, 1.5);
                var pts = Walk(R, sx, sy, a, L, maxY: maxY);
                var c = new Crack { pts = pts, len = L, t0 = R.Range(0, 0.035) };
                for (int j = 2; j < pts.Count - 1; j++)
                    if (R.Chance(forks * 0.4))
                    {
                        double fx = pts[j][0], fy = pts[j][1], fd = pts[j][2];
                        double fa = a + R.Sign() * R.Range(0.45, 1), fl = R.Range(3, 9) * (1 - (0.5 * j) / pts.Count);
                        c.kids.Add(Walk(R, fx, fy, fa, fl, jit: 0.7, step0: 1.5, step1: 3, maxY: maxY, d0: fd));
                    }
                o.Add(c);
            }
            return o;
        }

        /// 畫長到 g(c) px 的裂縫。heat(d)：沿裂縫距離 d 處的熱度（0..1），先用熱色階再冷成暗色；lip 下緣亮邊。
        public static void DrawCracks(Painter p, List<Crack> cracks, Func<Crack, double> g, Func<double, double> heat, uint[] hot, uint dark, uint lip, double k = 1)
        {
            if (k <= 0) return;
            Func<double, uint> col = d =>
            {
                double h = heat(d);
                return h > 0.75 ? hot[0] : h > 0.5 ? hot[1] : h > 0.3 ? hot[2] : h > 0.12 ? hot[3] : dark;
            };
            foreach (var c in cracks)
            {
                double G = g(c);
                if (G <= 0) continue;
                var paths = new List<List<double[]>> { c.pts }; paths.AddRange(c.kids);
                foreach (var path in paths)
                {
                    for (int i = 1; i < path.Count; i++)
                    {
                        double x0 = path[i - 1][0], y0 = path[i - 1][1], d0 = path[i - 1][2], x1 = path[i][0], y1 = path[i][1], d1 = path[i][2];
                        if (d0 >= G) break;
                        double f = d1 > G ? (G - d0) / (d1 - d0) : 1, ex = x0 + (x1 - x0) * f, ey = y0 + (y1 - y0) * f;
                        p.Line(x0, y0 + 1, ex, ey + 1, u => lip, u => Rand(ToInt32(Round(x0 + (ex - x0) * u)), ToInt32(Round(y0 + (ey - y0) * u)), 5) < 0.3 ? k * 0.8 : 0);
                        p.Line(x0, y0, ex, ey, u => col(d0 + (d1 - d0) * f * u), u => k);
                        double h = heat(d0);
                        if (h > 0.12) p.Glow((x0 + ex) / 2, (y0 + ey) / 2, 4 + h * 4, hot[2], 0.22 * h * k);
                    }
                }
            }
        }

        /// 站在地上（y = 0）的新月形衝擊波：前緣在 x 貼地，dir 1 往右「)」、-1 往左「(」。h 高、w 最厚處；cols [邊, 身, 背]。
        public static void FrontCrescent(Painter p, double x, double dir, double h, double w, uint[] cols, double k = 1)
        {
            if (h < 1 || w < 0.3 || k <= 0) return;
            double ry = h * 0.8, cy = -h * 0.2, rx = Math.Max(2, h * 0.55);
            double x0 = dir > 0 ? x - rx - w - 1 : x - 1, x1 = dir > 0 ? x + 1 : x + rx + w + 1;
            p.Shade(x0, -h - 1, x1, 0, (double px, double py, ref Painter.Out o) =>
            {
                if (py > 0) return;
                double ey = (py - cy) / ry;
                if (ey <= -1 || ey >= 1) return;
                double e2 = 1 - ey * ey, edge = rx * Math.Sqrt(e2) - rx, wt = w * Pow(e2, 0.45), q = (edge - (px - x) * dir) / Math.Max(0.5, wt);
                if (q < 0 || q > 1) return;
                o.c = q < 0.28 ? cols[0] : q < 0.62 ? cols[1] : cols[2];
                o.a = k * (ey < -0.8 ? 0.7 : 1) * (q > 0.7 ? 1.25 - q * 0.8 : 1);
            });
        }

        /// 石塊外形：n 個頂點半徑。
        public static double[] RockShape(Rng R, int n = 6) { var a = new double[n]; for (int i = 0; i < n; i++) a[i] = R.Range(0.7, 1.12); return a; }

        /// 翻滾的多面石塊：每一面照受光方向上色，頂面亮、暗色外框，最後半秒網點淡出。b.pts＝RockShape。
        public static void Rock(Painter p, Bit b, Stone st)
        {
            double r = 0.75 + b.s * 0.8; int n = b.pts.Length; double fade = Math.Min(1, b.life / 0.5), ca = Cos(b.a), sa = Sin(b.a);
            p.Shade(b.x - r - 2, b.y - r - 2, b.x + r + 2, b.y + r + 2, (double x, double y, ref Painter.Out o) =>
            {
                double dx = x - b.x, dy = y - b.y, u = dx * ca + dy * sa, v = -dx * sa + dy * ca, d = Hypot(u, v);
                double ang = Atan2(v, u);
                if (ang < 0) ang += TAU;
                double f = (ang / TAU) * n; int i = (int)Math.Floor(f) % n; double w = f - Math.Floor(f), edge = r * (b.pts[i] * (1 - w) + b.pts[(i + 1) % n] * w);
                if (d > edge + 0.85) return;
                o.a = fade;
                if (d > edge) { o.c = OUTLINE; return; }
                double lit = Cos(((i + 0.5) / n) * TAU + b.a - LIGHT);
                if (d < edge * 0.42) { o.c = lit > 0.55 ? st.light : st.body; return; }
                o.c = lit > 0.35 ? st.light : lit < -0.4 ? st.shade : st.body;
            });
        }
    }
}
