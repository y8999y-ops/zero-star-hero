// 網頁版 pixelfx/src/fx/explosions/plasma-explosion.js 一行一行翻成 C#（模擬特效）。
// 藍紫能量爆炸：白閃、膨脹後變空殼的電漿球、進出景深的衝擊環、從球上劈出去的電弧。
using System;
using System.Collections.Generic;
using static PixelFX.Pf;

namespace PixelFX.Fx
{
    public static class PlasmaExplosion
    {
        public static readonly FxDef Def = new FxDef
        {
            Name = "Plasma explosion", W = 224, H = 200, OX = 112, OY = 100, Duration = 1.7, Loop = false, Fps = 30,
            Options = new FxOptions
            {
                Palette = new[] { "#0a0828", "#1a1c6e", "#2c3cc0", "#4a7cf0", "#7cc0ff", "#c8ecff", "#ffffff" },
                Accent = new[] { "#1c0a30", "#4a1a8c", "#8a3ce0", "#c48cff", "#f0d8ff" },
                Seed = 7,
            },
            Create = Create,
        };

        const double BALL = 0.55;

        static FxImpl Create(FxOptions o)
        {
            uint WHITE = Col.WHITE;
            uint[] C = Col.Fit(o.Palette, 7), V = Col.Fit(o.Accent, 5); var R = new Rng((uint)o.SeedOr0);
            var ps = new Particles(R, sparks: new[] { C[6], C[5], C[4], V[3] }); var lights = new Lights();
            lights.Add(0, 0, 96, C[4], 1, 0.6);
            lights.Add(0, 0, 40, WHITE, 0.9, 0.1);
            lights.Add(0, 0, 70, V[2], 0.5, 1.1);
            for (int i = 0; i < 46; i++)
            {
                double a = R.Range(0, TAU), sp = R.Range(140, 360);
                ps.Spawn(P.MOTE, Cos(a) * 4, Sin(a) * 4, Cos(a) * sp, Sin(a) * sp, R.Range(0.2, 0.42), R.Pick(new[] { C[6], C[5], C[4], V[3] }), R.Range(0.7, 1.1));
            }
            for (int i = 0; i < 26; i++)
            {
                double a = R.Range(0, TAU), sp = R.Range(40, 140);
                ps.Spawn(P.FLAKE, Cos(a) * 10, Sin(a) * 10, Cos(a) * sp, Sin(a) * sp, R.Range(0.8, 1.5), R.Pick(new[] { C[5], V[3], V[4] }), R.Range(0.6, 1.6));
            }
            double t = 0;
            return new FxImpl
            {
                Update = (dt, _) =>
                {
                    t += dt;
                    // 殼變薄時甩出星點
                    if (t > 0.12 && t < 0.9 && R.Chance(30 * dt))
                    {
                        double a = R.Range(0, TAU), r = Shell(t);
                        ps.Spawn(P.STAR, Cos(a) * r, Sin(a) * r, Cos(a) * R.Range(10, 40), Sin(a) * R.Range(10, 40), R.Range(0.3, 0.6), R.Chance(0.5) ? C[5] : V[4], R.Range(0.5, 1.8));
                    }
                    ps.Update(dt);
                    BoomLib.Cull(ps, -112 + 3, -100 + 3, 224 - 112 - 3, 200 - 100 - 3);
                    lights.Update(dt);
                },
                // 斜環的遠半邊，在球後面
                DrawBack = (p, _, __) => Tilted(p, t, C, V, true),
                Draw = (p, _, __) =>
                {
                    // 球：白心、青藍帶、邊緣翻騰的紫邊；先膨脹，再掏空
                    if (t < BALL)
                    {
                        double u = t / BALL, r = Shell(t), hollow = Smooth(0.35, 1, u), boil = Math.Floor(t * 20);
                        p.Shade(-r - 3, -r - 3, r + 3, r + 3, (double x, double y, ref Painter.Out o2) =>
                        {
                            double d = Hypot(x, y), a = Atan2(y, x), edge = r * (1 + 0.1 * Noise(a * 3 + boil * 0.7, 3));
                            if (d > edge) return;
                            double v = d / edge;
                            if (v < hollow * 0.92) return;
                            // 繞著中心的亂流帶，和穿過它們的亮絲
                            double n = Noise(a * 4 + d * 0.25 + boil * 0.5, 5), w = v + n * 0.14;
                            bool fil = Math.Abs(Sin(a * 5 + d * 0.32 - t * 14 + n * 2.5)) < 0.1;
                            o2.k = 0.25 * (1 - u);
                            if (v > 0.9) { o2.c = V[2]; return; }
                            if (fil && v > 0.3) { o2.c = u < 0.5 ? WHITE : C[5]; return; }
                            o2.c = w < 0.32 - u * 0.25 ? WHITE : w < 0.52 ? C[5] : w < 0.72 ? C[4] : w < 0.86 ? (u < 0.5 ? C[3] : V[3]) : V[2];
                        });
                        p.Glow(0, 0, r * 1.6 + 6, C[4], 0.6 * (1 - u));
                    }
                    if (t < 0.07) p.Circle(0, 0, 9 - t * 60, WHITE);
                    if (t < 0.25) Sim.Flare(p, 0, 0, 52 * Pow(1 - t / 0.25, 1.3), 1 - t / 0.25, C);
                    // 衝擊環：快的亮環、慢一點的紫環
                    double u1 = t / 0.42;
                    if (u1 < 1)
                    {
                        p.Ring(0, 0, 8 + 84 * Ease.OutCubic(u1), Math.Max(1, 3 * (1 - u1)), u1 < 0.25 ? WHITE : C[5], 1.15 - u1);
                        p.GlowRing(0, 0, 8 + 84 * Ease.OutCubic(u1), 5, C[4], 0.35 * (1 - u1));
                    }
                    double u2 = (t - 0.06) / 0.6;
                    if (u2 > 0 && u2 < 1) p.Ring(0, 0, 6 + 60 * Ease.OutCubic(u2), Math.Max(1, 2 * (1 - u2)), V[3], 1.1 - u2);
                    // 電弧：從中心劈出去，每幾格重劈一次，電量用完就變短
                    double left = 1 - Smooth(0.15, 0.85, t); int strike = (int)Math.Floor(t * 18);
                    if (left > 0)
                    {
                        var r = Rng.Of(o.SeedOr0, strike, 17); int n = 2 + (int)Round(4 * left);
                        for (int i = 0; i < n; i++)
                        {
                            double a = r.Range(0, TAU), L = r.Range(26, 58) * (0.45 + 0.55 * left);
                            var path = Sim.Bolt(r, 0, 0, Cos(a) * L, Sin(a) * L, 0.28, 4);
                            Arc(p, path, C, V, 0.8 * left);
                            if (r.Chance(0.5)) foreach (var f in Sim.Forks(r, path, 1, 14, 0.35)) Arc(p, f, C, V, 0.5 * left);
                        }
                        // 還有在殼上爬的小電弧
                        double rs = Shell(t);
                        for (int i = 0; i < 3; i++)
                        {
                            double a = r.Range(0, TAU), b = a + r.Range(0.3, 0.6);
                            Arc(p, Sim.Bolt(r, Cos(a) * rs, Sin(a) * rs, Cos(b) * rs, Sin(b) * rs, 0.4, 3), C, V, 0.6 * left);
                        }
                    }
                    Tilted(p, t, C, V, false);
                    ps.Draw(p);
                    lights.Draw(p);
                },
            };
        }

        // 球的半徑：先猛衝出去，再慢下來
        static double Shell(double t) => 5 + 30 * Ease.OutCubic(Clamp(t / BALL));

        // 斜面上的環往外衝：遠半邊在後、近半邊在前
        static void Tilted(Painter p, double t, uint[] C, uint[] V, bool back)
        {
            double u = (t - 0.03) / 0.5;
            if (u <= 0 || u >= 1) return;
            Sim.Band(p, 0, 4, 12 + 86 * Ease.OutCubic(u), 0.28, Math.Max(1, 4 * (1 - u)), 1.15 - u, new[] { V[1], V[2], C[4], C[5] }, g => (Sin(g) < 0) == back, u < 0.15);
        }

        // 一道電弧：沿線的柔光、青色外線、白色核心
        static void Arc(Painter p, List<double[]> path, uint[] C, uint[] V, double k)
        {
            if (k <= 0.05) return;
            for (int i = 1; i < path.Count; i++)
            {
                double ax = path[i - 1][0], ay = path[i - 1][1], bx = path[i][0], by = path[i][1];
                p.GlowLine(ax, ay, bx, by, 5, V[2], 0.18 * k);
                p.Line(ax + 1, ay, bx + 1, by, C[4], k * 0.8);
                p.Line(ax, ay, bx, by, i < path.Count * 0.6 ? Col.WHITE : C[5], Math.Min(1, k * 1.4));
            }
        }
    }
}
