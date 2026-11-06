// 網頁版 pixelfx/src/fx/impacts/ground-slam.js 一行一行翻成 C#（模擬特效）。
// 重重落地：地面閃光、裂開，兩道新月衝擊波沿地面衝出去，塵浪和高高的塵雲升起，石塊噴出、彈跳、停下。
using System;
using System.Collections.Generic;
using static PixelFX.Pf;
using static PixelFX.Fx.ImpactLib;

namespace PixelFX.Fx
{
    public static class GroundSlam
    {
        public static readonly FxDef Def = new FxDef
        {
            Name = "Ground slam", W = 288, H = 208, OX = 144, OY = 164, Duration = 3.2, Loop = false, Fps = 30,
            Options = new FxOptions { Palette = new[] { "#2a1712", "#5e2c1c", "#a4502a", "#e8893a", "#ffc764", "#fff0b4", "#ffffff" }, Seed = 5 }
                .Set("stone", "#4a3f69").Set("reach", 104),
            Create = Create,
        };

        const double WAVE = 0.6; // 衝擊波跑出去要幾秒

        // 凹痕：地面邊緣凹成淺碟，熱的時候底部發光，兩邊翻起唇邊
        static void Crater(Painter p, Stone st, double hot, uint[] C, double k)
        {
            for (int x = -12; x <= 11; x++)
            {
                double q = Math.Abs(x + 0.5) / 12, dep = Round(2.6 * (1 - q * q));
                if (q < 0.84)
                {
                    for (double y = 0; y < dep; y++) p.Dot(x, y, SOOT, k);
                    p.Dot(x, dep, hot > 0.5 ? C[5] : hot > 0.2 ? C[4] : st.lip, k);
                }
                else
                {
                    p.Dot(x, -1, q > 0.93 ? st.light : st.lip, k);
                    if (q < 0.9) p.Dot(x, -2, st.light, k * 0.8);
                }
            }
        }

        class Emb { public double x, y, d, life, ph; }

        static FxImpl Create(FxOptions o)
        {
            uint WHITE = Col.WHITE;
            uint[] C = Col.Fit(o.Palette, 7); var st = StoneOf(Col.Hex(o.Str["stone"])); double REACH = o["reach"]; var R = new Rng((uint)o.SeedOr0); Func<double, double> floor = x => 0; const double D = 3.2;
            var ps = new Particles(R, sparks: new[] { C[6], C[5], C[4], C[3] }, ground: floor);
            var bits = new Bits(floor); var lights = new Lights(); uint[] HOT = { WHITE, C[5], C[4], C[3] };
            uint dustLit = Col.Mix(st.dust, WHITE, 0.2); var cracks = MakeCracks(R, 10, 22, 58, 0.55, 22, 0.7, 2, 9);
            Func<double, double> front = t => 7 + (REACH - 7) * Ease.OutCubic(Clamp((t - 0.015) / WAVE));
            Func<double, double> heat = t => Pow(Clamp(1 - t / 0.8), 1.4);
            Func<double, double> crestH = u => 6 + 28 * Pow(1 - u, 0.75); // 衝擊波的高
            Func<double, double> crestW = u => 1.5 + 5 * Pow(1 - u, 0.9);  // 衝擊波的厚
            // 閃光：貼地的半個星芒，沿地面的長，往上的短
            var burst = new List<Spike>();
            burst.Add(new Spike { a = -0.07, len = R.Range(34, 40), w = 1.9 });
            burst.Add(new Spike { a = Math.PI + 0.07, len = R.Range(34, 40), w = 1.9 });
            { double a = -0.42 + R.Range(-0.08, 0.08); burst.Add(new Spike { a = a, len = R.Range(15, 20), w = 1.5 }); }
            { double a = -Math.PI + 0.42 + R.Range(-0.08, 0.08); burst.Add(new Spike { a = a, len = R.Range(15, 20), w = 1.5 }); }
            { double a = -Math.PI / 2 + R.Range(-0.15, 0.15); burst.Add(new Spike { a = a, len = R.Range(18, 24), w = 1.7 }); }
            { double a = -1.05 + R.Range(-0.1, 0.1); burst.Add(new Spike { a = a, len = R.Range(10, 14), w = 1.2 }); }
            { double a = -Math.PI + 1.05 + R.Range(-0.1, 0.1); burst.Add(new Spike { a = a, len = R.Range(10, 14), w = 1.2 }); }
            // 卡在裂縫裡的餘燼，冷下來時閃爍
            var embers = new List<Emb>();
            foreach (var c in cracks)
                foreach (var pt in c.pts)
                {
                    double x = pt[0], y = pt[1], d = pt[2];
                    if (d > 3 && d < 32 && R.Chance(0.25)) { var e = new Emb { x = x, y = y, d = d }; e.life = R.Range(0.8, 2.2); e.ph = R.Range(0, TAU); embers.Add(e); }
                }

            // 接觸：光湧出來，火星從石頭上飛出、沿地面擦過去
            lights.Add(0, -12, 96, C[4], 0.6, 0.6);
            lights.Add(0, -4, 50, WHITE, 0.9, 0.14);
            for (int i = 0; i < 56; i++)
            {
                bool low = i < 14; int s = R.Sign(); double a = low ? (s > 0 ? -R.Range(0.04, 0.6) : Math.PI + R.Range(0.04, 0.6)) : -Math.PI / 2 + R.Range(-1.15, 1.15);
                double sp = low ? R.Range(150, 380) : R.Range(200, 500);
                ps.Spawn(P.SPARK, R.Range(-4, 4), -1, Cos(a) * sp, Sin(a) * sp, low ? R.Range(0.2, 0.5) : R.Range(0.25, 0.65), WHITE, 1, low ? 0 : R.Range(0, 0.05));
            }
            // 石塊從凹痕噴出：三塊重的勉強跳出來，其他的拋得很高
            for (int i = 0; i < 20; i++)
            {
                int s = i < 3 ? 4 : R.Int(1, 3); double a = -Math.PI / 2 + R.Range(-0.5, 0.5), sp = s > 3 ? R.Range(110, 190) : R.Range(170, 380) * (s > 2 ? 0.8 : 1);
                var b = new Bit { kind = BKind.CHUNK };
                b.x = R.Range(-7, 7); b.y = -2; b.vx = Cos(a) * sp; b.vy = Sin(a) * sp; b.g = 1; b.drag = 0.4; b.bounce = 0.38;
                b.life = R.Range(1.9, 2.7); b.a = R.Range(0, TAU); b.va = R.Range(-14, 14); b.s = s; b.pts = RockShape(R); b.pvy = 0;
                bits.Add(b);
            }
            // 碎屑：一扇地面碎片，彈一次就停
            for (int i = 0; i < 110; i++)
            {
                double u = R.Range(-1, 1), a = -Math.PI / 2 + u * 0.65, sp = R.Range(110, 380) * (1 - 0.35 * Math.Abs(u));
                ps.Spawn(P.GRIT, u * 6, -1, Cos(a) * sp, Sin(a) * sp, R.Range(1, 2.2), R.Pick(new[] { st.light, st.body, st.body, st.shade, st.shade, st.lip }), R.Chance(0.35) ? 2 : 1);
            }
            // 塵雲：一柱往上衝、頂端散開、頂上亮的塵，腳下一堆厚塵
            for (int i = 0; i < 28; i++)
            {
                bool core = i < 14; int s = R.Sign();
                ps.Spawn(P.SMOKE, core ? R.Range(-5, 5) : s * R.Range(4, 12), -R.Range(2, 10), core ? R.Range(-12, 12) : s * R.Range(14, 38), -R.Range(50, 130) * (core ? 1 : R.Range(0.3, 0.6)), R.Range(1.9, 2.7), R.Chance(0.35) ? dustLit : st.dust, core ? R.Range(4.5, 9) : R.Range(4, 7.5), R.Range(0.02, 0.22), PFlag.BIG);
            }
            for (int i = 0; i < 10; i++)
            {
                int s = R.Sign();
                ps.Spawn(P.SMOKE, s * R.Range(2, 14), -R.Range(2, 6), s * R.Range(20, 70), -R.Range(4, 20), R.Range(1.4, 2.3), st.dust, R.Range(6, 9), R.Range(0, 0.08), PFlag.BIG);
            }
            // 塵雲懸著時慢慢落下的細塵
            for (int i = 0; i < 26; i++)
                ps.Spawn(P.FLAKE, R.Range(-22, 22), -R.Range(14, 80), R.Range(-12, 12), R.Range(-10, 4), R.Range(1.2, 2), R.Chance(0.5) ? st.lip : dustLit, R.Range(0.5, 1.2), R.Range(0.25, 1));

            double tt = 0;
            double[] acc = { R.Next(), R.Next() };
            Action<Painter, bool> ring = (p, back) =>
            {
                double u = Clamp((tt - 0.015) / (WAVE + 0.1));
                if (tt < 0.015 || u >= 0.9) return;
                Sim.Band(p, 0, 0.5, front(tt) + 1, 0.16, Math.Max(1, 4 * Pow(1 - u, 0.8)), u < 0.55 ? 1.1 : (0.9 - u) / 0.35,
                    u < 0.35 ? new[] { C[3], C[4], C[5], C[6] } : new[] { st.body, st.light, C[4], C[5] }, g => (Sin(g) < 0) == back, tt < 0.09);
            };
            Action<Painter> fronts = p =>
            {
                double u = Clamp((tt - 0.03) / (WAVE + 0.16));
                if (tt < 0.03 || u >= 1) return;
                double fr = front(tt), h = crestH(u), w = crestW(u), k = u < 0.7 ? 1 : (1 - u) / 0.3;
                uint[] cols = u < 0.14 ? new[] { WHITE, C[6], C[5] } : u < 0.34 ? new[] { C[6], C[5], C[4] } : u < 0.55 ? new[] { C[5], C[4], st.lip } : new[] { st.lip, st.light, st.dust };
                foreach (double s in new[] { -1.0, 1.0 })
                {
                    FrontCrescent(p, s * fr, s, h, w, cols, k);
                    p.Glow(s * fr, -h * 0.3, 8 + h * 0.7, C[4], 0.5 * (1 - u) * k);
                }
            };

            return new FxImpl
            {
                Update = (dt, _) =>
                {
                    tt += dt;
                    // 衝擊波後面揚起的塵，和浪頭上的飛沫
                    double u = Clamp((tt - 0.015) / WAVE);
                    if (u > 0 && u < 1)
                    {
                        double fr = front(tt), h = crestH(u);
                        for (int k = 0; k < 2; k++)
                        {
                            double s = k != 0 ? 1 : -1;
                            for (acc[k] += dt * 120 * (1 - u * 0.7); acc[k] > 1; acc[k]--)
                            {
                                ps.Spawn(P.SMOKE, s * (fr - R.Range(1, 7)), -R.Range(0.5, 3), s * R.Range(15, 70) * (1 - u), -R.Range(2, 12), R.Range(1, 2.1), R.Chance(0.3) ? dustLit : st.dust, R.Range(2.5, 6.5) * (1 - 0.4 * u), 0, PFlag.BIG);
                                if (R.Chance(0.5)) ps.Spawn(P.DUST, s * (fr - R.Range(0, 3)), -R.Range(0.3, 0.9) * h, s * R.Range(-15, 25), -R.Range(8, 35), R.Range(0.3, 0.6), R.Chance(0.5) ? dustLit : st.dust, R.Range(1.2, 2.4));
                                if (R.Chance(0.4)) ps.Spawn(P.GRIT, s * fr, -1, s * R.Range(10, 60), -R.Range(40, 140) * (1 - u), R.Range(0.5, 1), R.Pick(new[] { st.light, st.body, st.lip }), 1);
                                if (u < 0.45 && R.Chance(0.2)) ps.Spawn(P.SPARK, s * fr, -1, s * R.Range(60, 200), -R.Range(30, 160), R.Range(0.12, 0.3));
                            }
                        }
                    }
                    foreach (var b in bits.List) b.pvy = b.vy;
                    bits.Update(dt);
                    // 重重落地的石塊揚起塵
                    foreach (var b in bits.List)
                        if (b.pvy > 70 && b.vy <= 0)
                        {
                            int n = b.pvy > 200 ? 3 : 2;
                            for (int i = 0; i < n; i++) ps.Spawn(P.DUST, b.x + R.Range(-1.5, 1.5), -0.5, R.Sign() * R.Range(8, 35), -R.Range(2, 16), R.Range(0.3, 0.65), st.dust, R.Range(1.3, 2.4) * (0.7 + b.s * 0.25));
                            b.pvy = 0;
                        }
                    ps.Update(dt);
                    lights.Update(dt);
                },
                DrawBack = (p, _, __) =>
                {
                    double fade = 1 - Smooth(D - 0.9, D - 0.15, tt), H = heat(tt);
                    if (tt > 0.02) Crater(p, st, H, C, fade);
                    DrawCracks(p, cracks, c => c.len * Ease.OutCubic(Clamp((tt - c.t0) / 0.1)), d => H * Clamp(1.2 - d / 40), HOT, SOOT, st.light, fade);
                    foreach (var e in embers)
                    {
                        double k = 1 - (tt - 0.1) / e.life;
                        if (tt < 0.1 || k <= 0) continue;
                        double f = 0.6 + 0.4 * Sin(tt * 23 + e.ph);
                        p.Px(e.x, e.y, k * f > 0.55 ? C[5] : k * f > 0.25 ? C[4] : C[3]);
                        p.Glow(e.x, e.y, 4, C[4], 0.35 * k * f);
                    }
                    ring(p, true);
                    ps.Draw(p, "back");
                },
                Draw = (p, _, __) =>
                {
                    ring(p, false);
                    fronts(p);
                    foreach (var b in bits.List) Rock(p, b, st);
                    ps.Draw(p, "front");
                    if (tt < 0.035)
                    {
                        p.Ellipse(0, 0, 30, 4.5, (d, g) => d > 0.8 ? C[4] : d > 0.5 ? C[6] : WHITE, (d, g) => 1);
                        Star(p, 0, -1, burst, 1, 1, new[] { C[4], C[6], WHITE, WHITE });
                    }
                    else if (tt < 0.07) Star(p, 0, -1, burst, 1.25, 0.5, new[] { C[3], C[5], C[6], WHITE });
                    // 地面整條閃一下，之後裂縫熱的時候凹痕發光
                    if (tt < 0.14) p.GlowLine(-80, 0, 80, 0, 10, C[5], 0.55 * (1 - tt / 0.14));
                    double H = heat(tt);
                    if (H > 0) p.Glow(0, 1, 46, C[4], 0.35 * H);
                    lights.Draw(p);
                },
            };
        }
    }
}
