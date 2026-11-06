// 網頁版 pixelfx/src/fx/pickups/collect-burst.js 一行一行翻成 C#（模擬特效）。
// 撿到東西的瞬間：白閃加十字光、細環搶先彈出、軟環跟上，小星星沿彎曲路線甩出去、煞住、停一下、眨眼消失。
using System;
using System.Collections.Generic;
using static PixelFX.Pf;

namespace PixelFX.Fx
{
    public static class CollectBurst
    {
        public static readonly FxDef Def = new FxDef
        {
            Name = "Collect burst", W = 112, H = 108, OX = 56, OY = 94, Duration = 1.35, Loop = false, Fps = 30,
            Options = new FxOptions { Palette = new[] { "#1a0516", "#3d0a33", "#701560", "#b0228f", "#f53cd1", "#ff86e6", "#ffd2f6", "#ffffff" }, Seed = 3 },
            Create = Create,
        };

        const double CY = -30;
        class Star { public double x, y, a, sp, turn, life, age, size, ph; public uint c; public List<double[]> tr = new List<double[]>(); }
        class Mote { public double x, y, vy, life, d, w; }

        static FxImpl Create(FxOptions o)
        {
            uint WHITE = Col.WHITE;
            uint[] C = Col.Fit(o.Palette, 8); var R = new Rng((uint)o.SeedOr0); var lights = new Lights();
            lights.Add(0, CY, 36, C[5], 0.85, 0.32);
            lights.Add(0, CY, 14, WHITE, 0.75, 0.08);
            // 沿彎曲路線甩出去的小星星：飛的時候方向一直轉，阻力讓它煞住
            var stars = new List<Star>();
            for (int i = 0; i < 14; i++)
            {
                double a = ((double)i / 14) * TAU + R.Range(-0.2, 0.2), sp = R.Range(145, 225) * (i % 3 == 0 ? 1.12 : 0.85);
                var s = new Star { x = 0, y = CY, a = a, sp = sp };
                s.turn = (i % 2 != 0 ? 1 : -1) * R.Range(2.5, 5); s.life = R.Range(0.75, 1.15); s.age = 0;
                s.size = i % 3 == 0 ? 2.6 : R.Range(1.2, 2); s.c = i % 4 == 0 ? WHITE : i % 2 != 0 ? C[6] : C[5]; s.ph = R.Range(0, TAU);
                stars.Add(s);
            }
            var motes = new List<Mote>();
            for (int i = 0; i < 7; i++)
            {
                var m = new Mote(); m.x = R.Range(-8, 8); m.y = CY + R.Range(-4, 6); m.vy = -R.Range(12, 30); m.life = R.Range(0.5, 0.9); m.d = R.Range(0.05, 0.25); m.w = R.Range(0, TAU);
                motes.Add(m);
            }
            double t = 0;
            return new FxImpl
            {
                Update = (dt, _) =>
                {
                    t += dt;
                    foreach (var s in stars)
                    {
                        if (s.age > s.life) continue;
                        s.age += dt;
                        s.tr.Insert(0, new[] { s.x, s.y });
                        if (s.tr.Count > 4) s.tr.RemoveAt(s.tr.Count - 1);
                        s.a += s.turn * dt * Math.Max(0, 1 - s.age * 1.5);
                        s.sp -= s.sp * 4.3 * dt;
                        s.x += Cos(s.a) * s.sp * dt;
                        s.y += Sin(s.a) * s.sp * dt + 6 * s.age * dt;
                        // 地板把它們彈回上面
                        if (s.y > -2) { s.y = -2; s.a = -Math.Abs(s.a); s.sp *= 0.5; }
                    }
                    lights.Update(dt);
                },
                Draw = (p, _, __) =>
                {
                    // 閃光：白圓加十字光，幾格就沒
                    if (t < 0.07) p.Circle(0, CY, 5.5 * (1 - t / 0.07) + 1, WHITE);
                    if (t < 0.16)
                    {
                        double k = 1 - t / 0.16, L = 26 * Ease.OutCubic(Math.Min(1, t / 0.03 + 0.4)) * k;
                        foreach (var q in new[] { new[] { 1, 0, 1.0 }, new[] { -1, 0, 1.0 }, new[] { 0, 1, 0.6 }, new[] { 0, -1, 0.6 } })
                            p.Line(0, CY, q[0] * L * q[2], CY + q[1] * L * q[2], u => u < 0.3 ? WHITE : u < 0.65 ? C[6] : C[5], u => (u < 0.5 ? 1 : (1 - u) * 2) * (0.5 + k));
                        p.Glow(0, CY, 20 * k + 4, C[5], 0.6 * k);
                    }
                    // 細環快速彈出，軟環跟在後面
                    double u1 = t / 0.32;
                    if (u1 < 1)
                    {
                        double r = 3 + 23 * Ease.OutExpo(u1);
                        p.Ring(0, CY, r, 1, u1 < 0.3 ? WHITE : C[6], 1.3 - u1 * 1.2);
                        p.GlowRing(0, CY, r, 4, C[5], 0.4 * (1 - u1));
                    }
                    double u2 = (t - 0.04) / 0.5;
                    if (u2 > 0 && u2 < 1)
                    {
                        double r = 2 + 16 * Ease.OutCubic(u2);
                        p.Ring(0, CY, r, Math.Max(1, 2.6 * (1 - u2)), C[5], 1 - u2);
                    }
                    // 小星星帶短尾巴，停住時閃爍、眨眼消失
                    foreach (var s in stars)
                    {
                        if (s.age > s.life) continue;
                        double k = 1 - s.age / s.life, tw = 0.65 + 0.35 * Sin(s.age * 26 + s.ph);
                        for (int i = 0; i < s.tr.Count; i++) if (i > 0) p.Dot(s.tr[i][0], s.tr[i][1], i < 2 ? C[5] : C[4], (1 - i / 4.0) * k * 1.4);
                        if (k < 0.3 && Sin(s.age * 40 + s.ph) < 0) continue;
                        PickupLib.Glint(p, s.x, s.y, Round(s.size * tw * Math.Min(1, k * 2.5)), s.c, 0.45 * k);
                    }
                    // 之後往上飄的小光點
                    foreach (var m in motes)
                    {
                        double a = t - m.d;
                        if (a < 0 || a > m.life) continue;
                        double k = 1 - a / m.life, x = m.x + Sin(a * 6 + m.w) * 1.5, y = m.y + m.vy * a;
                        p.Dot(x, y, k > 0.5 ? C[6] : C[5], k * 1.5);
                        p.Glow(x + 0.5, y + 0.5, 3, C[5], 0.3 * k);
                    }
                    lights.Draw(p);
                },
            };
        }
    }
}
