// 網頁版 pixelfx/src/fx/impacts/parry.js 一行一行翻成 C#（模擬特效）。
// 兩把刀相碰：刀口閃出一個 X、白色四芒星響一聲、一圈環碎成弧，一扇金色火星往上噴再落下來在地上彈。
// 選項：Palette（7 階）、Num["height"]（離地多高）、Seed、Light。
using System;
using System.Collections.Generic;
using static PixelFX.Pf;

namespace PixelFX.Fx
{
    public static class Parry
    {
        public static readonly FxDef Def = new FxDef
        {
            Name = "Parry", W = 200, H = 112, OX = 100, OY = 96, Duration = 1, Loop = false, Fps = 30,
            Options = new FxOptions { Palette = new[] { "#2a1a08", "#6a4410", "#b07a1a", "#e8b030", "#ffe066", "#fff6c4", "#ffffff" }, Seed = 11 }.Set("height", 30),
            Create = Create,
        };

        static FxImpl Create(FxOptions o)
        {
            uint WHITE = Col.WHITE;
            uint[] C = Col.Fit(o.Palette, 7); var R = new Rng((uint)o.SeedOr0); double X = 0, Y = -o["height"];
            var ps = new Particles(R, sparks: new[] { C[4], C[4], C[3], C[2] }, ground: x => 0);
            var lights = new Lights();
            // 硬的四芒星：軸上的臂長、中間的短
            var sp = new List<ImpactLib.Spike>();
            for (int i = 0; i < 8; i++)
            {
                double a = (i * Math.PI) / 4 + R.Range(-0.04, 0.04);
                double len = i % 2 != 0 ? R.Range(6, 8) : i % 4 == 0 ? R.Range(19, 22) : R.Range(14, 17);
                sp.Add(new ImpactLib.Spike { a = a, len = len, w = i % 2 != 0 ? 1.2 : 2.2 });
            }
            var segs = new List<ImpactLib.RingSeg>();
            for (int i = 0; i < 6; i++)
            {
                var s = new ImpactLib.RingSeg();
                s.a = ((double)i / 6) * TAU + R.Range(-0.1, 0.1); s.gap = R.Range(0.55, 0.8); s.dr = R.Range(0.1, 0.35);
                segs.Add(s);
            }
            // 碰在一起的兩道刀口：交叉成 X 的線
            double e0 = -0.62 + R.Range(-0.08, 0.08), e1 = Math.PI + 0.62 + R.Range(-0.08, 0.08);
            var edges = new[] { e0, e1 };

            lights.Add(X, Y, 60, C[4], 0.65, 0.4);
            lights.Add(X, Y, 22, WHITE, 0.8, 0.08);
            // 扇形火星：往上往兩邊丟，畫弧落下，在地上彈
            for (int i = 0; i < 24; i++)
            {
                double s = i % 2 != 0 ? 1 : -1, a = -Math.PI / 2 + s * R.Range(0.3, 1.3), v = R.Range(130, 290);
                ps.Spawn(P.SPARK, X + s * R.Range(1, 3), Y, Cos(a) * v, Sin(a) * v, R.Range(0.45, 0.85), WHITE, 1, i > 17 ? R.Range(0.02, 0.07) : 0);
            }
            for (int i = 0; i < 8; i++)
            {
                double a = R.Range(0, TAU), v = R.Range(40, 110);
                ps.Spawn(P.MOTE, X, Y, Cos(a) * v, Sin(a) * v - 20, R.Range(0.3, 0.55), R.Pick(new[] { C[5], C[6] }), 0.6, R.Range(0, 0.04));
            }
            for (int i = 0; i < 3; i++)
            {
                double a = R.Range(0, TAU), d = R.Range(12, 26);
                ps.Spawn(P.STAR, X + Cos(a) * d, Y + Sin(a) * d, 0, -3, R.Range(0.22, 0.34), WHITE, R.Range(1.6, 2.6), R.Range(0.1, 0.3));
            }

            double t = 0;
            return new FxImpl
            {
                Update = (dt, _) =>
                {
                    t += dt;
                    ps.Update(dt);
                    lights.Update(dt);
                },
                Draw = (p, _, __) =>
                {
                    // 環：從星芒響出去，碎成弧繼續飛、變冷
                    double u = (t - 0.03) / 0.36;
                    if (u >= 0 && u < 1)
                    {
                        double r = 8 + 24 * Ease.OutCubic(u), brk = Smooth(0.15, 0.6, u); int i = u < 0.15 ? 6 : u < 0.35 ? 5 : u < 0.6 ? 4 : 3;
                        ImpactLib.BrokenRing(p, X, Y, r, Math.Max(1, 2.6 * Pow(1 - u, 1.2)), segs, brk, C[i], C[Math.Max(2, i - 2)], u < 0.6 ? 1 : (1 - u) / 0.4, 1, 0);
                        if (u < 0.5) p.GlowRing(X, Y, r, 5, C[4], 0.3 * (1 - u / 0.5));
                    }
                    ps.Draw(p);
                    // 刀口在碰到的地方閃
                    if (t < 0.058)
                        foreach (double a in edges)
                        {
                            double ca = Cos(a), sa = Sin(a), L = t < 0.025 ? 26 : 32, k = t < 0.025 ? 1 : 0.6;
                            for (double d = -L; d <= L; d += 0.5)
                            {
                                double q = Math.Abs(d) / L;
                                p.Dot(X + ca * d, Y + sa * d, q < 0.4 ? WHITE : q < 0.75 ? C[5] : C[4], q < 0.6 ? 1 : k * (1.3 - q));
                            }
                            p.GlowLine(X - ca * L, Y - sa * L, X + ca * L, Y + sa * L, 4, C[5], 0.35 * k);
                        }
                    // 星芒：先白，再變大變金變細，最後只剩一點亮
                    if (t < 0.025) ImpactLib.Star(p, X, Y, sp, 1, 1, new[] { C[4], WHITE, WHITE, WHITE }, 1, 2.6);
                    else if (t < 0.058) ImpactLib.Star(p, X, Y, sp, 1.25, 0.65, new[] { C[2], C[5], C[6], WHITE }, 1, 2.6);
                    else if (t < 0.092) ImpactLib.Star(p, X, Y, sp, 1.4, 0.3, new[] { C[2], C[4], C[5], C[6] }, 1, 2);
                    double pop = Exp(-t / 0.05);
                    if (pop > 0.02)
                    {
                        p.Glow(X, Y, 30, C[4], 0.5 * pop);
                        p.Glow(X, Y, 10, WHITE, 0.4 * pop);
                    }
                    lights.Draw(p);
                },
            };
        }
    }
}
