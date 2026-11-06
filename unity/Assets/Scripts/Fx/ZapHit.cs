// 網頁版 pixelfx/src/fx/lightning/zap-hit.js 一行一行翻成 C#（模擬特效）。
// 電擊命中：電弧從左邊打進來、命中點過載成一團小電弧、一片蕨葉狀的燒痕往外發光、火星亂竄、臭氧小煙。
using System;
using System.Collections.Generic;
using static PixelFX.Pf;

namespace PixelFX.Fx
{
    public static class ZapHit
    {
        public static readonly FxDef Def = new FxDef
        {
            Name = "Zap hit", W = 144, H = 112, OX = 76, OY = 56, Duration = 0.9, Loop = false, Fps = 30,
            Options = new FxOptions { Palette = BoltLib.VOLT, Seed = 3 },
            Create = Create,
        };

        const double SNAP = 0.05;
        static readonly uint ASH = Col.Hex("#6a6680");

        class Branch { public List<double[]> pts; public double w; }
        // 電流在被打的東西上留下的燒痕：利希滕貝格圖形，主枝放射、側枝交錯
        static List<Branch> Fern(Rng R)
        {
            var o = new List<Branch>();
            void Grow(double x, double y, double a, double len, double w, double d, int depth)
            {
                var pts = new List<double[]> { new[] { x, y, d } };
                int side = R.Sign();
                for (double s = 0; s < len; s += 1.4)
                {
                    a += R.Range(-0.3, 0.3);
                    x += Cos(a) * 1.4;
                    y += Sin(a) * 1.4;
                    d += 1.4;
                    pts.Add(new[] { x, y, d });
                    if (depth < 2 && s > 2 && R.Chance(0.24))
                    {
                        side = -side;
                        Grow(x, y, a + side * R.Range(0.55, 1.05), (len - s) * R.Range(0.3, 0.55), w * 0.6, d, depth + 1);
                    }
                }
                o.Add(new Branch { pts = pts, w = w });
            }
            for (int i = 0; i < 6; i++) Grow(0, 0, ((double)i / 6) * TAU + R.Range(-0.35, 0.35), R.Range(18, 32), 1, 0, 0);
            return o;
        }

        class Kink { public double x, y, vx, vy, life, age, next; public List<double[]> trail = new List<double[]>(); }

        static FxImpl Create(FxOptions o)
        {
            uint WHITE = Col.WHITE;
            uint[] C = Col.Fit(o.Palette, 8); var R = new Rng((uint)o.SeedOr0); var ps = new Particles(R); var lights = new Lights();
            var tree = Fern(R); double Y0 = R.Range(-14, 6);
            // 會轉折的火星：飛出去，每零點零幾秒猛轉一次方向
            var kinked = new List<Kink>();
            for (int i = 0; i < 16; i++)
            {
                double a = R.Range(-1.2, 1.2) + (R.Chance(0.7) ? 0 : Math.PI), sp = R.Range(130, 250);
                var k = new Kink { x = 0, y = 0, vx = Cos(a) * sp, vy = Sin(a) * sp - 40 };
                k.life = R.Range(0.2, 0.36); k.age = -SNAP; k.next = R.Range(0.02, 0.05);
                kinked.Add(k);
            }
            double t = 0; bool hit = false;
            return new FxImpl
            {
                Update = (dt, _) =>
                {
                    t += dt;
                    if (!hit && t >= SNAP)
                    {
                        hit = true;
                        lights.Add(0, 0, 60, C[4], 0.7, 0.3);
                        lights.Add(0, 0, 14, WHITE, 0.5, 0.07);
                        for (int i = 0; i < 3; i++) ps.Spawn(P.SMOKE, R.Range(-3, 5), R.Range(-4, 2), R.Range(-5, 8), -R.Range(8, 16), R.Range(0.55, 0.75), Col.Mix(ASH, C[4], 0.3), R.Range(2.5, 3.8), R.Range(0.08, 0.16));
                    }
                    foreach (var s in kinked)
                    {
                        if ((s.age += dt) < 0 || s.age >= s.life) continue;
                        if ((s.next -= dt) <= 0)
                        {
                            s.next = R.Range(0.025, 0.055);
                            double sp = Hypot(s.vx, s.vy), a = Atan2(s.vy, s.vx) + R.Sign() * R.Range(0.6, 1.3);
                            s.vx = Cos(a) * sp;
                            s.vy = Sin(a) * sp;
                            s.trail.Add(new[] { s.x, s.y });
                            if (s.trail.Count > 4) s.trail.RemoveAt(0);
                        }
                        s.vx -= s.vx * 3 * dt;
                        s.vy -= s.vy * 3 * dt - 140 * dt;
                        s.x += s.vx * dt;
                        s.y += s.vy * dt;
                    }
                    ps.Update(dt);
                    lights.Update(dt);
                },
                DrawBack = (p, _, __) =>
                {
                    // 燒痕從命中點往外燒，先白熱，沿色階冷下來，最後淡掉
                    if (t < SNAP) return;
                    double cool = Smooth(0.45, 0.85, t), fade = 1 - Smooth(0.78, 0.88, t);
                    foreach (var br in tree)
                        for (int i = 1; i < br.pts.Count; i++)
                        {
                            double x0 = br.pts[i - 1][0], y0 = br.pts[i - 1][1], x = br.pts[i][0], y = br.pts[i][1], d = br.pts[i][2], age = t - SNAP - d / 260;
                            if (age < 0) break;
                            double k = Exp(-age / 0.22) - cool * 0.3; uint c = k > 0.75 ? WHITE : k > 0.45 ? C[6] : k > 0.25 ? C[5] : k > 0.1 ? C[4] : k > -0.05 ? C[2] : C[1];
                            p.Line(x0, y0, x, y, c, fade);
                            if (br.w >= 1 && d < 9) p.Line(x0 + 1, y0, x + 1, y, k > 0.45 ? C[5] : C[2], fade);
                            if ((i & 3) == 0 && k > 0) p.Glow(x, y, 5, C[5], 0.35 * k * fade);
                        }
                    ps.Draw(p, "back");
                },
                Draw = (p, _, __) =>
                {
                    int f = (int)Math.Floor(t * 30 + 1e-4);
                    // 電弧兩格內從左邊打進來，停住閃爍，然後放開
                    if (t < 0.32)
                    {
                        var r = Rng.Of(o.SeedOr0, 2, f); var b = BoltLib.Zigzag(r, -66, Y0, 0, 0, 0.22, 0.35); double u = Clamp(t / SNAP);
                        double k = t < SNAP ? 1 : t < 0.2 ? (f % 2 != 0 ? 0.7 : 1) : 0.55 * (1 - (t - 0.2) / 0.12);
                        BoltLib.Stroke(p, u < 1 ? new List<BoltPath> { b[0] } : b, k, C, t < SNAP + 0.034 ? 0.95 : 0.7, new BoltLib.StrokeOpts { upTo = u, hero = t >= SNAP && t < SNAP + 0.034 });
                        if (u < 1)
                        {
                            var tp = b[0].pts; var hp = tp[(int)Math.Floor(u * (tp.Count - 1))];
                            p.Circle(hp[0], hp[1], 2, WHITE);
                            p.Glow(hp[0], hp[1], 14, C[5], 0.6);
                        }
                    }
                    // 命中點過載：一小團每格重劈的小之字，圍著白心
                    if (t >= SNAP && t < 0.45)
                    {
                        double a = (t - SNAP) / 0.4; var r = Rng.Of(o.SeedOr0, 5, f); double R0 = 8 * (1 - a * 0.6); int m = (int)Round(11 * (1 - a * 0.5));
                        for (int i = 0; i < m; i++)
                        {
                            double ang = r.Range(0, TAU), d0 = r.Range(0.5, R0 * 0.5), ang2 = ang + r.Range(-1.2, 1.2), d1 = r.Range(R0 * 0.55, R0);
                            BoltLib.Crackle(p, BoltLib.Zigzag(r, Cos(ang) * d0, Sin(ang) * d0, Cos(ang2) * d1, Sin(ang2) * d1, 0.5, 0), 0.75 * (1 - a) + 0.25, C, 0.25);
                        }
                        p.Circle(0, 0, 3 * (1 - a) + 1, C[5]);
                        p.Circle(0, 0, 2 * (1 - a) + 0.5, WHITE);
                        p.Glow(0, 0, 20, C[4], 0.55 * (1 - a));
                        if (t < SNAP + 0.07) p.Glow(0, 0, 9, WHITE, 0.4);
                    }
                    // 火星：亮的頭，後面的之字線冷下來
                    foreach (var s in kinked)
                    {
                        if (s.age < 0 || s.age >= s.life) continue;
                        double k = 1 - s.age / s.life; var path = new List<double[]>(s.trail) { new[] { s.x, s.y } };
                        for (int i = 0; i < path.Count - 1; i++) p.Line(path[i][0], path[i][1], path[i + 1][0], path[i + 1][1], i == path.Count - 2 ? (k > 0.5 ? WHITE : C[6]) : k > 0.5 ? C[5] : C[4], 0.6 + 0.4 * ((double)i / path.Count));
                        p.Px(s.x, s.y, k > 0.4 ? WHITE : C[5]);
                        p.Glow(s.x, s.y, 4, C[5], 0.4 * k);
                    }
                    // 光在熄掉時閃
                    if (t >= SNAP) p.Glow(0, 0, 40 * Math.Max(0, 1 - t / 0.85), C[3], 0.45 * Exp(-(t - SNAP) * 5) * (f % 2 != 0 ? 0.7 : 1));
                    ps.Draw(p, "front");
                    lights.Draw(p);
                },
            };
        }
    }
}
