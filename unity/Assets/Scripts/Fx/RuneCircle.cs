// 網頁版 pixelfx/src/fx/arcane/rune-circle.js 一行一行翻成 C#（純函式迴圈特效，有前後兩層）。
// 地上透視的符文圈在轉：一圈被追逐的光照亮的符文、反方向轉的方框、刻度、往上飄的光點。
using System;
using System.Collections.Generic;
using System.Linq;
using static PixelFX.Pf;
using static PixelFX.Fx.ArcaneLib;

namespace PixelFX.Fx
{
    public static class RuneCircle
    {
        static readonly string[] ARCANE = { "#140a26", "#2b1252", "#481c88", "#6b2cc0", "#9a48ec", "#c684ff", "#ecc8ff", "#ffffff" };
        // 一圈轉四分之一剛好讓每個部分無縫：16 個刻度、一個方框、12 個符文以三個一組
        const double D = 4, R = 46, RR = 39, RI = 23, RC = 7, SY = 0.3; const int NR = 12;

        public static readonly FxDef Def = new FxDef
        {
            Name = "Rune circle", W = 136, H = 100, OX = 68, OY = 80, Duration = D, Loop = true, Fps = 30,
            Options = new FxOptions { Palette = ARCANE, Seed = 8 },
            Pure = new FxImpl { DrawBack = DrawBack, Draw = Draw },
        };

        static double AtX(double g, double r) => Cos(g) * r;
        static double AtY(double g, double r) => Sin(g) * r * SY;
        static double Gap(double a, double b) => Math.Abs(Atan2(Sin(a - b), Cos(a - b)));

        static void Circle(Painter p, uint[] C, double t, bool far)
        {
            uint WHITE = Col.WHITE;
            double ph = t / D, spin = (ph * TAU) / 4;
            Func<double, bool> keep = far ? (Func<double, bool>)(g => Sin(g) < 0) : g => Sin(g) >= 0;
            // 兩點光沿外圈追著跑，一圈兩次
            double chase = ph * TAU * 2;
            Func<double, double, bool> lit = (g, w) => Gap(g, chase) < w || Gap(g, chase + Math.PI) < w;
            Func<double, uint, uint, uint> tone = (g, hi, lo) => Sin(g) < 0 ? lo : hi;
            FloorRing(p, 0, 0, R, SY, g => lit(g, 0.22) ? WHITE : lit(g, 0.5) ? C[6] : tone(g, C[6], C[5]), 1, keep);
            FloorRing(p, 0, 0, RI, SY, g => tone(g, C[5], C[4]), 1, keep);
            FloorRing(p, 0, 0, RC, SY, g => tone(g, C[6], C[5]), 1, keep);
            // 圈外的刻度，跟著轉
            for (int j = 0; j < 16; j++)
            {
                double g = spin + ((j + 0.5) * TAU) / 16;
                if ((Sin(g) < 0) != far) continue;
                double x = AtX(g, R + 3.5), y = AtY(g, R + 3.5); bool hot = lit(g, 0.3);
                p.Px(x, y, hot ? WHITE : tone(g, j % 2 != 0 ? C[5] : C[6], C[4]));
                if (j % 2 == 0) foreach (int dx in new[] { 1, -1 }) p.Px(x + dx, y, hot ? C[6] : tone(g, C[4], C[3]));
            }
            // 內圈裡反方向轉的方框，四角碰到內圈
            var pts = new double[4][];
            for (int k = 0; k < 4; k++) { double g = -spin + (k * TAU) / 4 + Math.PI / 4; pts[k] = new[] { AtX(g, RI), AtY(g, RI) }; }
            for (int k = 0; k < 4; k++)
            {
                double ax = pts[k][0], ay = pts[k][1], bx = pts[(k + 1) % 4][0], by = pts[(k + 1) % 4][1];
                if ((ay < 0) != (by < 0))
                {
                    double u = ay / (ay - by), mx = ax + (bx - ax) * u;
                    if ((ay < 0) == far) { bx = mx; by = 0; }
                    else { ax = mx; ay = 0; }
                }
                else if ((ay < 0) != far) continue;
                p.Line(ax, ay, bx, by, far ? C[4] : C[5]);
            }
            // 符文站在帶子裡繞著轉；前面亮、後面暗，光經過時發亮
            var gs = Enumerable.Range(0, NR).Select(k => (k, g: spin + ((k + 0.5) * TAU) / NR)).Where(e => (Sin(e.g) < 0) == far).OrderBy(e => Sin(e.g)).ToList();
            foreach (var (k, g) in gs)
            {
                double x = AtX(g, RR), y = AtY(g, RR); bool hot = lit(g, 0.2); double bob = Sin(ph * TAU * 4 + 4 * g) * 0.5;
                Glyph(p, new[] { 0, 3, 5 }[k % 3], x, y - 1 + bob, hot ? WHITE : far ? C[5] : C[6], 1, hot ? C[5] : far ? C[2] : C[3]);
                p.Glow(x, y - 3, hot ? 10 : 6, C[5], hot ? 0.5 : far ? 0.12 : 0.22);
                p.Glow(x, y, 5, C[4], 0.15);
            }
        }

        // 光點沿慢慢的螺旋從圈上升起、往中間靠；上方掛著閃爍的星點
        static void Motes(Painter p, uint[] C, double t, int S, bool far)
        {
            uint WHITE = Col.WHITE;
            Sim.Cycle(t, D, 76, S * 5 + 1, g => g.Range(1.1, 1.9), (age, life, r, i) =>
            {
                double g0 = r.Range(0, TAU), r0 = r.Pick(new[] { R, R, RR, RR, RI }), q = age / life, g = g0 + q * r.Range(0.6, 1.4);
                if ((Sin(g) < 0) != far) return;
                double rr = r0 * (1 - 0.35 * q), h = 2 + Ease.OutQuad(q) * r.Range(26, 52), x = Cos(g) * rr, y = Sin(g) * rr * SY - h;
                double a = Math.Min(1, q * 5) * (1 - Smooth(0.65, 1, q)); bool big = r.Chance(0.2);
                uint c = r.Chance(0.3) ? WHITE : r.Chance(0.6) ? C[6] : C[5];
                Mote(p, x, y, -Sin(g) * rr * 0.8, -36 * (1 - q) - 10, c, big ? 1.1 : r.Range(0.55, 0.9), a, big ? 0.5 : 0.3);
            });
            Sim.Cycle(t, D, 14, S * 5 + 2, 0.45, (age, life, r, i) =>
            {
                double g = r.Range(0, TAU);
                if ((Sin(g) < 0) != far) return;
                double rr = r.Range(8, R), x = Cos(g) * rr, y = Sin(g) * rr * SY - r.Range(6, 34), k = Sin((age / life) * Math.PI);
                Sim.Sparkle(p, x, y, 1 + 2.4 * k, C[6], C[5], 0.35 * k);
            });
        }

        public static void DrawBack(Painter p, double t, FxOptions o)
        {
            uint[] C = Col.Fit(o.Palette, 8); double pulse = 0.85 + 0.15 * Sin((t / D) * TAU * 4);
            // 圈下的地面發光，上方站著一道柔光
            p.Glow(0, 0, R * 1.4, C[4], 0.24 * pulse);
            foreach (double s in new[] { -1.0, 1.0 }) p.Glow(s * R * 0.55, 1, R * 0.7, C[5], 0.12 * pulse);
            // 一柱往上淡掉的柔光
            for (double h = 0; h < 66; h += 6) p.Glow(0, -h, 26, C[4], 0.11 * pulse * (1 - h / 80));
            Circle(p, C, t, true);
            Motes(p, C, t, o.SeedOr0, true);
        }

        public static void Draw(Painter p, double t, FxOptions o)
        {
            uint[] C = Col.Fit(o.Palette, 8); double chase = (t / D) * TAU * 2;
            Circle(p, C, t, false);
            Motes(p, C, t, o.SeedOr0, false);
            // 沿圈跑的兩點光
            foreach (double g in new[] { chase, chase + Math.PI })
            {
                double x = AtX(g, R), y = AtY(g, R);
                Sim.Sparkle(p, x, y, 2.5 + Sin(t * 30) * 0.8, C[6], C[5], 0.5);
                p.Glow(x, y, 14, C[5], 0.4);
            }
        }
    }
}
