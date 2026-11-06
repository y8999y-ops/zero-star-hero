// 網頁版 pixelfx/src/fx/impacts/hit-spark.js 一行一行翻成 C#（模擬特效）。
// 一般打擊：歪一邊的十字閃光（沿打擊方向一道長光）圍著白色菱形核心，然後一錐火星和熱碎屑落地彈跳。
using System;
using static PixelFX.Pf;

namespace PixelFX.Fx
{
    public static class HitSpark
    {
        public static readonly FxDef Def = new FxDef
        {
            Name = "Hit spark", W = 136, H = 80, OX = 44, OY = 64, Duration = 0.5, Loop = false, Fps = 30,
            Options = new FxOptions
            {
                Palette = new[] { "#4a1712", "#c9281f", "#f2561d", "#ff8a2a", "#ffe26b", "#fff3a6", "#ffffff" },
                Seed = 4,
            }.Set("height", 20).Set("aim", 0.1),
            Create = Create,
        };

        // 十字的一道光：根部粗、尖端細，越外越冷；from..1 只畫一段
        static void Ray(Painter p, double x, double y, double a, double L, double w, uint[] C, double from = 0)
        {
            double c = Cos(a), s = Sin(a);
            for (double d = from * L; d <= L; d += 0.5)
            {
                double u = d / L, hw = w * Pow(1 - u, 1.6);
                uint col = u < 0.3 ? Col.WHITE : u < 0.62 ? C[5] : u < 0.88 ? C[4] : C[3];
                p.Px(x + c * d, y + s * d, col);
                if (hw > 0.45)
                    for (double o = 0.5; o <= hw; o += 0.5)
                        foreach (double e in new[] { -o, o }) p.Px(x + c * d - s * e, y + s * d + c * e, u < 0.3 && o < 1 ? C[5] : C[4]);
            }
        }

        // 核心：清楚的白色菱形、淡色邊
        static void Diamond(Painter p, double x, double y, int r, uint[] C)
        {
            for (int dy = -r - 1; dy <= r + 1; dy++)
                for (int dx = -r - 1; dx <= r + 1; dx++)
                {
                    int m = Math.Abs(dx) + Math.Abs(dy);
                    if (m <= r) p.Px(x + dx, y + dy, Col.WHITE);
                    else if (m == r + 1) p.Px(x + dx, y + dy, C[3]);
                }
        }

        class RayDef { public double a, L, w; }

        static FxImpl Create(FxOptions o)
        {
            uint WHITE = Col.WHITE;
            uint[] C = Col.Fit(o.Palette, 7); var R = new Rng((uint)o.SeedOr0); double X = 0, Y = -o["height"], A = o["aim"];
            var ps = new Particles(R, sparks: new[] { C[6], C[5], C[4], C[2] }, ground: x => 0);
            var lights = new Lights();
            // 十字：沿打擊方向一道細長光、後面一小截、兩條不等長的橫臂、中間一道閃
            double tilt = R.Range(-0.08, 0.08);
            var rays = new[]
            {
                new RayDef { a = A + tilt, L = R.Range(33, 37), w = 2.2 },
                new RayDef { a = A + Math.PI + tilt, L = R.Range(8, 10), w = 2.2 },
                new RayDef { a = A - Math.PI / 2 + tilt, L = R.Range(15, 18), w = 2.6 },
                new RayDef { a = A + Math.PI / 2 + tilt, L = R.Range(10, 12), w = 2.3 },
                new RayDef { a = A - Math.PI / 4 + tilt, L = R.Range(5, 7), w = 1 },
            };

            lights.Add(X, Y, 38, C[4], 0.35, 0.18);
            lights.Add(X + Cos(A) * 10, Y + Sin(A) * 10, 22, C[5], 0.45, 0.1);
            lights.Add(X, -2, 26, C[3], 0.22, 0.22);
            // 沿打擊方向噴出的一錐火星：落下、在地上彈、熄掉
            for (int i = 0; i < 9; i++)
            {
                double a = A + R.Range(-0.6, 0.6) - 0.15, v = R.Range(170, 360);
                ps.Spawn(P.SPARK, X + 1, Y, Cos(a) * v, Sin(a) * v - 40, R.Range(0.25, 0.45), WHITE, 1, i > 6 ? R.Range(0.01, 0.03) : 0);
            }
            // 敲下來的熱碎屑，翻滾落地
            for (int i = 0; i < 6; i++)
            {
                double a = A + R.Range(-1.1, 0.5) - 0.3, v = R.Range(70, 170);
                ps.Spawn(P.GRIT, X + 1, Y, Cos(a) * v, Sin(a) * v - R.Range(30, 80), R.Range(0.35, 0.45), R.Pick(new[] { C[5], C[4], C[4], C[3] }), 1);
            }

            double t = 0;
            return new FxImpl
            {
                Update = (dt, _) => { t += dt; ps.Update(dt); lights.Update(dt); },
                Draw = (p, _, __) =>
                {
                    ps.Draw(p);
                    if (t < 0.025)
                    {
                        // 閃光：整個十字圍著菱形
                        foreach (var r in rays) Ray(p, X, Y, r.a, r.L, r.w, C);
                        Diamond(p, X, Y, 4, C);
                    }
                    else if (t < 0.058)
                    {
                        // 伸更遠、變細，菱形還在
                        foreach (var r in rays) Ray(p, X, Y, r.a, r.L * 1.2, r.w * 0.55, C, 0.12);
                        Diamond(p, X, Y, 3, C);
                    }
                    else if (t < 0.092)
                    {
                        // 只剩長的那道，根部燒掉
                        var r = rays[0];
                        Ray(p, X, Y, r.a, r.L * 1.3, 0.6, new[] { C[0], C[1], C[2], C[3], C[3], C[4] }, 0.4);
                    }
                    double pop = Exp(-t / 0.045);
                    if (pop > 0.02)
                    {
                        p.Glow(X, Y, 22, C[4], 0.3 * pop);
                        p.Glow(X, Y, 7, WHITE, 0.15 * pop);
                        p.GlowLine(X, Y, X + Cos(A) * 26, Y + Sin(A) * 26, 4, C[5], 0.25 * pop);
                    }
                    lights.Draw(p);
                },
            };
        }
    }
}
