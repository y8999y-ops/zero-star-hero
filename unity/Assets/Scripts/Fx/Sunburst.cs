// 網頁版 pixelfx/src/fx/holy/sunburst.js 一行一行翻成 C#（純函式迴圈特效）。
// 金色日冕裡的白熱核心；長短光芒慢慢轉、呼吸，亮點沿著光芒往外跑、在尖端眨一下。
using System;
using static PixelFX.Pf;

namespace PixelFX.Fx
{
    public static class Sunburst
    {
        public static readonly FxDef Def = new FxDef
        {
            Name = "Sunburst", W = 128, H = 128, OX = 64, OY = 64, Duration = 4, Loop = true, Fps = 30,
            Options = new FxOptions { Palette = HolyLib.GOLD, Seed = 3 }.Set("rays", 8),
            Pure = new FxImpl { Draw = Draw },
        };

        const double CORE = 4.5, RING = 7.5, R0 = 9, T = 4;
        static double Frac(double x) => x - Math.Floor(x);

        // 一道從半徑 R0 到 R0 + L 的漸細光芒：根部白、往外冷成金色、細成光
        static void Ray(Painter p, uint[] C, double a, double L, double w0, double k)
        {
            double ca = Cos(a), sa = Sin(a), x1 = ca * (R0 + L), y1 = sa * (R0 + L), pad = w0 + 1;
            p.Shade(Math.Min(0, x1) - pad, Math.Min(0, y1) - pad, Math.Max(0, x1) + pad, Math.Max(0, y1) + pad, (double x, double y, ref Painter.Out o) =>
            {
                double along = x * ca + y * sa - R0, u = along / L;
                if (u < 0 || u > 1) return;
                double across = Math.Abs(-x * sa + y * ca), w = (w0 / 2) * (1 - u * 0.85) + 0.25;
                if (across > w) return;
                bool spine = across < 0.5, rim = across > w - 0.6 && w > 0.9;
                o.c = spine ? (u < 0.4 ? Col.WHITE : u < 0.75 ? C[6] : C[5]) : rim && u > 0.15 ? C[3] : u < 0.3 ? C[6] : u < 0.62 ? C[5] : C[4];
                o.a = u < 0.72 ? k : k * (1 - (u - 0.72) / 0.28) * 1.2;
            });
            p.GlowLine(ca * R0, sa * R0, ca * (R0 + L * 0.8), sa * (R0 + L * 0.8), 5, C[5], 0.16 * k);
        }

        public static void Draw(Painter p, double t, FxOptions o)
        {
            uint WHITE = Col.WHITE;
            uint[] C = Col.Fit(o.Palette, 8); double N = o["rays"] * 2, rot = (t / T) * ((2 * TAU) / N);
            p.Glow(0, 0, 62, C[4], 0.3 + 0.06 * Sin((t / T) * TAU * 2));
            // 光芒之間的細光絲
            for (int i = 0; i < N; i++)
            {
                double a = rot + ((i + 0.5) * TAU) / N, L = 14 + 6 * Sin(a * 3 + (t / T) * TAU);
                p.Line(Cos(a) * (R0 + 1), Sin(a) * (R0 + 1), Cos(a) * (R0 + L), Sin(a) * (R0 + L), u => u < 0.3 ? C[6] : C[5], u => 0.7 - u * 0.8);
            }
            // 光芒長短交錯，一道波繞著跑讓它們呼吸
            for (int i = 0; i < N; i++)
            {
                double a = rot + (i * TAU) / N; bool lng = i % 2 == 0; double breathe = 0.86 + 0.14 * Sin(a * 3 - (t / T) * TAU * 2);
                double L = (lng ? 36 : 21) * breathe;
                Ray(p, C, a, L, lng ? 4 : 2.6, 1);
                // 亮點沿每道長光芒往外跑，到尖端眨一下
                if (lng)
                {
                    double g = Frac((t / T) * 2 + (a * 3) / TAU), r = R0 + g * L;
                    if (g < 0.9)
                    {
                        p.Px(Cos(a) * r, Sin(a) * r, WHITE);
                        p.Glow(Cos(a) * r, Sin(a) * r, 5, C[6], 0.45 * (1 - g));
                    }
                    else Sim.Sparkle(p, Cos(a) * (R0 + L), Sin(a) * (R0 + L), 1 + 3 * Sin(((g - 0.9) / 0.1) * Math.PI), WHITE, C[6], 0.5);
                }
            }
            // 日冕和核心
            p.Shade(-RING - 2, -RING - 2, RING + 2, RING + 2, (double x, double y, ref Painter.Out o2) =>
            {
                double d = Hypot(x, y);
                if (d > RING) return;
                double flick = 0.5 + 0.5 * Sin(Atan2(y, x) * 5 + (t / T) * TAU * 3);
                o2.c = d < CORE ? WHITE : d < CORE + 1.5 ? (flick > 0.6 ? WHITE : C[6]) : flick > 0.5 ? C[5] : C[4];
            });
            p.Glow(0, 0, 16, WHITE, 0.28);
            // 周圍的閃爍
            Sim.Cycle(t, T, 10, o.SeedOr0, g => g.Range(0.35, 0.7), (age, life, R, i) =>
            {
                double a = R.Range(0, TAU), d = R.Range(16, 44), k = Sin((age / life) * Math.PI);
                Sim.Sparkle(p, Cos(a) * d, Sin(a) * d, 1 + 2.4 * k * R.Range(0.5, 1), WHITE, C[5], 0.4 * k);
            });
        }
    }
}
