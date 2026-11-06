// 網頁版 pixelfx/src/fx/spawn/poof.js 一行一行翻成 C#（模擬特效）。
// 卡通的「噗」：白色一爆，一圈軟軟的圓煙球夾著速度線往外衝，小星星轉出去，煙雲往上飄、變淡。
// 選項：Palette（6 階）、Ramps["stars"]（3 階）、Seed、Light。
using System;
using System.Collections.Generic;
using System.Linq;
using static PixelFX.Pf;

namespace PixelFX.Fx
{
    public static class Poof
    {
        public static readonly FxDef Def = new FxDef
        {
            Name = "Poof", W = 112, H = 92, OX = 56, OY = 80, Duration = 1.6, Loop = false, Fps = 30,
            Options = new FxOptions { Palette = new[] { "#2a2440", "#5e5878", "#9a94b4", "#cdc8e0", "#f2f0fa", "#ffffff" }, Seed = 21 }
                .Set("stars", new[] { "#ffd84a", "#fff3a6", "#ffffff" }),
            Create = Create,
        };

        const double CY = -17;
        class Ball { public double x, y, vx, vy, r0, r1, life, delay, max; }
        class SLine { public double a, r1, d; }

        static FxImpl Create(FxOptions o)
        {
            uint WHITE = Col.WHITE;
            uint[] C = Col.Fit(o.Palette, 6), S = Col.Fit(o.Ramps["stars"], 3); var R = new Rng((uint)o.SeedOr0);
            var ps = new Particles(R, sparks: new[] { WHITE, S[1], S[0], C[2] }, ground: x => 0); var lights = new Lights();
            var balls = new List<Ball>(); var lines = new List<SLine>();
            // 一圈胖煙球圍著胖核心，快速丟出去、被阻力停住，慢下來時鼓起來
            const int ring = 9;
            for (int i = 0; i < ring; i++)
            {
                double a = ((double)i / ring) * TAU + R.Range(-0.2, 0.2), sp = R.Range(95, 140), r = R.Range(5, 7);
                var b = new Ball { x = Cos(a) * 3, y = CY + Sin(a) * 3, vx = Cos(a) * sp, vy = Sin(a) * sp * 0.8 - 12, r0 = r * 0.5, r1 = r };
                b.life = R.Range(0.7, 1.05); b.delay = R.Range(0, 0.03); balls.Add(b);
            }
            for (int i = 0; i < 5; i++)
            {
                double a = R.Range(0, TAU), sp = R.Range(20, 60);
                var b = new Ball { x = Cos(a) * 2, y = CY + Sin(a) * 2, vx = Cos(a) * sp, vy = Sin(a) * sp - 16, r0 = 4 };
                b.r1 = R.Range(6.5, 8.5); b.life = R.Range(0.85, 1.2); b.delay = R.Range(0.02, 0.06); balls.Add(b);
            }
            // 幾小團甩得比較遠、很快就散，煙雲的邊才會破破的
            for (int i = 0; i < 7; i++)
            {
                double a = R.Range(0, TAU), sp = R.Range(170, 240), r = R.Range(2.2, 3.6);
                var b = new Ball { x = Cos(a) * 4, y = CY + Sin(a) * 4, vx = Cos(a) * sp, vy = Sin(a) * sp * 0.75 - 10, r0 = r * 0.6, r1 = r };
                b.life = R.Range(0.32, 0.5); b.delay = R.Range(0.01, 0.04); balls.Add(b);
            }
            foreach (var b in balls) b.max = b.life;
            // 煙球之間的速度線，彈出去幾格就沒了
            for (int i = 0; i < 12; i++)
            {
                double a = ((double)i / 12) * TAU + R.Range(-0.12, 0.12) + 0.13, sa = Sin(a);
                // 朝下的停在地上
                lines.Add(new SLine { a = a, r1 = Math.Min(R.Range(24, 34), sa > 0.1 ? (-2 - CY) / sa : 99), d = R.Range(0, 0.04) });
            }
            // 爆開時轉出去的小星星
            for (int i = 0; i < 7; i++)
            {
                double a = R.Range(-Math.PI, 0.3), sp = R.Range(70, 125);
                ps.Spawn(P.STAR, Cos(a) * 6, CY + Sin(a) * 6, Cos(a) * sp, Sin(a) * sp - 30, R.Range(0.55, 0.95), R.Pick(new[] { S[2], S[1], S[1], S[0] }), R.Range(1.3, 2.4), R.Range(0.02, 0.1));
            }
            for (int i = 0; i < 10; i++)
            {
                double a = R.Range(0, TAU), sp = R.Range(40, 110);
                ps.Spawn(P.STAR, Cos(a) * 5, CY + Sin(a) * 5, Cos(a) * sp, Sin(a) * sp - 20, R.Range(0.3, 0.6), R.Pick(new[] { WHITE, S[1] }), 0.6, R.Range(0, 0.08));
            }
            // 腳也沒了：沿地面一抹灰
            for (int i = 0; i < 6; i++)
            {
                int s = R.Sign();
                ps.Spawn(P.DUST, s * R.Range(1, 6), -1, s * R.Range(25, 70), -R.Range(2, 10), R.Range(0.4, 0.7), C[2], R.Range(1.6, 3), R.Range(0.02, 0.08));
            }
            lights.Add(0, CY, 46, C[4], 0.8, 0.4);
            lights.Add(0, CY, 22, WHITE, 0.8, 0.1);
            double t = 0;

            // 煙球鼓起、呼吸，然後縮到沒有（卡通的煙是一顆一顆消失，不是淡掉）
            Func<Ball, double> radius = b =>
            {
                double age = b.max - b.life, u = age / b.max;
                double grow = b.r0 + (b.r1 - b.r0) * Ease.OutBack(Clamp(age / 0.22), 2), breathe = 1 + 0.06 * Sin(age * 14 + b.r1);
                return grow * breathe * (u < 0.62 ? 1 : 1 - Ease.InBack(Clamp((u - 0.62) / 0.38), 1.4));
            };
            Action<Painter, Ball, string> drawBall = (p, b, layer) =>
            {
                double age = b.max - b.life, r = radius(b), a = Math.Min(1, age * 20); bool lit = age < 0.12;
                if (r < 0.6) return;
                // 整團煙從上面照亮：下面的球暗一階
                double hy = (b.y - CY + 6) / 14; bool lo = hy > 0.4, hi = hy < -0.3;
                if (layer == "shade") p.Disc(b.x + r * 0.16, b.y + r * 0.2, r, lit ? C[3] : lo ? C[1] : C[2], 0.8 * a);
                else if (layer == "body") p.Disc(b.x - r * 0.06, b.y - r * 0.08, r * 0.86, lit ? C[4] : lo ? C[2] : C[3], 0.88 * a);
                else if (!lo || lit)
                {
                    p.Disc(b.x - r * 0.28, b.y - r * 0.34, r * 0.42, lit || hi ? WHITE : C[4], 0.85 * a);
                    if (age < 0.25) p.Disc(b.x - r * 0.3, b.y - r * 0.38, r * 0.2, WHITE, 0.9 * a * (1 - age / 0.25));
                }
            };

            return new FxImpl
            {
                Update = (dt, _) =>
                {
                    t += dt;
                    for (int i = balls.Count - 1; i >= 0; i--)
                    {
                        var b = balls[i];
                        if (b.delay > 0) { b.delay -= dt; continue; }
                        if ((b.life -= dt) <= 0)
                        {
                            // 每顆球消失時一點光
                            if (b.r1 > 4) ps.Spawn(P.STAR, b.x, b.y, 0, -8, 0.22, WHITE, 0.6);
                            balls.RemoveAt(i);
                            continue;
                        }
                        // 快速爆開、強阻力，然後慢慢上升
                        b.vx -= b.vx * 7 * dt;
                        b.vy -= b.vy * 7 * dt + 30 * dt;
                        b.x += b.vx * dt;
                        b.y = Math.Min(b.y + b.vy * dt, -radius(b) * 0.7);
                    }
                    ps.Update(dt);
                    lights.Update(dt);
                },
                DrawBack = (p, _, __) =>
                {
                    // 身體站的地方一團軟影子，地上爆開的光
                    double s = 1 - Smooth(0.1, 0.9, t);
                    if (s > 0) p.Glow(0, -1, 26, C[4], 0.25 * s);
                    ps.Draw(p, "back");
                },
                Draw = (p, _, __) =>
                {
                    // 煙雲：先畫暗面、再身體、再頂，相鄰的球才會黏成一團
                    var live = balls.Where(b => b.delay <= 0).ToList();
                    foreach (var layer in new[] { "shade", "body", "cap" }) foreach (var b in live) drawBall(p, b, layer);
                    // 爆開：白球加八道光兩格，然後一圈環
                    if (t < 0.07)
                    {
                        double k = t / 0.07;
                        p.Circle(0, CY, 9 + 3 * k, C[4]);
                        p.Circle(0, CY, 7 + 3 * k, WHITE);
                        Sim.Flare(p, 0, CY, 20 * (1 - k * 0.5), 1 - k, C);
                    }
                    double rk = (t - 0.03) / 0.2;
                    if (rk > 0 && rk < 1) p.Ring(0, CY, 8 + 18 * Ease.OutCubic(rk), Math.Max(1, 2.5 * (1 - rk)), rk < 0.3 ? WHITE : C[4], 1.1 - rk);
                    foreach (var l in lines)
                    {
                        double u = (t - l.d) / 0.2;
                        if (u <= 0 || u >= 1) continue;
                        double head = 8 + (l.r1 - 8) * Ease.OutExpo(Clamp(u / 0.6)), tail = 8 + (l.r1 - 8) * Ease.InCubic(u), ca = Cos(l.a), sa = Sin(l.a);
                        p.Line(ca * tail, CY + sa * tail, ca * head, CY + sa * head, v => v > 0.6 ? WHITE : C[4], v => 1);
                        p.GlowLine(ca * tail, CY + sa * tail, ca * head, CY + sa * head, 3, C[4], 0.25);
                    }
                    ps.Draw(p, "front");
                    lights.Draw(p);
                },
            };
        }
    }
}
