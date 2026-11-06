// 網頁版 pixelfx/src/fx/arcane/star-fall.js 一行一行翻成 C#（模擬特效）。
// 星星拖著長尾巴斜斜落下，散在一片範圍裡，每顆落地有白閃、一圈貼地的光環、踢起一把火星。
using System;
using System.Collections.Generic;
using static PixelFX.Pf;

namespace PixelFX.Fx
{
    public static class StarFall
    {
        static readonly string[] ARCANE = { "#140a26", "#2b1252", "#481c88", "#6b2cc0", "#9a48ec", "#c684ff", "#ecc8ff", "#ffffff" };
        const int N = 11; const double SPREAD = 46, HH = 124, SLANT = 0.38, TRAIL = 0.17;

        public static readonly FxDef Def = new FxDef
        {
            Name = "Star fall", W = 232, H = 172, OX = 124, OY = 150, Duration = 2.5, Loop = false, Fps = 30,
            Options = new FxOptions { Palette = ARCANE, Seed = 13 },
            Create = Create,
        };

        class Star { public double x, y, sx, sy, t0, T, ph; public bool landed, big; }
        class Hit { public double x, y, t; public bool big; }

        static FxImpl Create(FxOptions o)
        {
            uint WHITE = Col.WHITE;
            uint[] C = Col.Fit(o.Palette, 8); var R = new Rng((uint)o.SeedOr0);
            var ps = new Particles(R, sparks: new[] { WHITE, C[6], C[5], C[4] }, ground: x => 0); var lights = new Lights();
            // 落點：打散順序分佈在範圍裡，前後稍微錯開
            var xs = new double[N];
            for (int i = 0; i < N; i++) xs[i] = -SPREAD + ((i + R.Range(0.2, 0.8)) * 2 * SPREAD) / N;
            for (int i = N - 1; i > 0; i--)
            {
                int j = R.Int(0, i);
                double tmp = xs[i]; xs[i] = xs[j]; xs[j] = tmp;
            }
            var stars = new List<Star>();
            for (int i = 0; i < N; i++)
            {
                double x = xs[i], y = R.Range(-3, 2), h = HH * R.Range(0.85, 1);
                var s = new Star { x = x, y = y, sx = x - h * SLANT, sy = y - h };
                s.t0 = 0.04 + i * 0.105 + R.Range(0, 0.05); s.T = R.Range(0.3, 0.4); s.landed = false; s.big = R.Chance(0.35); s.ph = R.Range(0, TAU);
                stars.Add(s);
            }
            var hits = new List<Hit>();
            double t = 0;
            Func<Star, double, (double x, double y, double q)> at = (s, tt) =>
            {
                double q = Clamp((tt - s.t0) / s.T), e = q * (0.35 + 0.65 * q);
                return (s.sx + (s.x - s.sx) * e, s.sy + (s.y - s.sy) * e, q);
            };

            Func<Painter, Star, double> star = (p, s) =>
            {
                var (x, y, q) = at(s, t);
                // 尾巴：沿路徑往上的漸細長線，頭白、往後細成紫
                const int n = 20;
                for (int k = n; k >= 1; k--)
                {
                    var A = at(s, t - (k * TRAIL) / n); var B = at(s, t - ((k - 1) * TRAIL) / n); double u = (double)k / n;
                    if (t - (k * TRAIL) / n < s.t0) continue;
                    uint c = u < 0.15 ? WHITE : u < 0.4 ? C[6] : u < 0.7 ? C[5] : C[4];
                    // 靠近頭的地方旁邊再一條線讓它有厚度；尾巴細成網點線
                    if (u < (s.big ? 0.55 : 0.35)) p.Line(A.x + 1, A.y, B.x + 1, B.y, u < 0.2 ? C[6] : C[5], 1.1 - u * 1.4);
                    p.Line(A.x, A.y, B.x, B.y, c, 1.3 - u);
                    if (k % 3 == 0) p.Glow(A.x, A.y, 7 * (1 - u) + 2, C[5], 0.3 * (1 - u));
                }
                // 頭：閃爍的四角星
                if (s.big) Sim.Flare(p, x, y, 7 + 1.5 * Sin(t * 40 + s.ph), 0.8, C);
                else Sim.Sparkle(p, x, y, 3.5 + Sin(t * 40 + s.ph), C[6], C[5], 0.6);
                p.Circle(x, y, s.big ? 1.6 : 1.1, WHITE);
                p.Glow(x, y, s.big ? 18 : 13, C[5], 0.6);
                p.Glow(x, y, 5, WHITE, 0.35);
                return q;
            };

            Action<Painter, Hit, bool> hit = (p, h, far) =>
            {
                double k = (t - h.t) / 0.45;
                if (k < 0 || k >= 1) return;
                Sim.Band(p, h.x, h.y, 3 + (h.big ? 22 : 16) * Ease.OutCubic(k), 0.26, Math.Max(1, 2.5 * (1 - k)), 1.15 - k, new[] { C[3], C[5], C[6], WHITE }, g => (Sin(g) < 0) == far, k < 0.2);
            };

            return new FxImpl
            {
                Update = (dt, _) =>
                {
                    t += dt;
                    foreach (var s in stars)
                    {
                        if (t < s.t0 || s.landed) continue;
                        var (x, y, q) = at(s, t);
                        if (R.Chance(0.55)) ps.Spawn(P.STAR, x + R.Range(-1.5, 1.5), y + R.Range(-1.5, 1.5), R.Range(-12, 12), R.Range(-8, 4), R.Range(0.35, 0.7), R.Pick(new[] { WHITE, C[6], C[5] }), R.Chance(0.7) ? R.Range(0.4, 0.9) : R.Range(1.2, 1.8));
                        if (q >= 1)
                        {
                            s.landed = true;
                            hits.Add(new Hit { x = s.x, y = s.y, t = t, big = s.big });
                            lights.Add(s.x, s.y - 12, s.big ? 46 : 38, C[5], 0.9, 0.32);
                            lights.Add(s.x, s.y - 3, 16, WHITE, 0.8, 0.08);
                            for (int i = 0; i < (s.big ? 14 : 9); i++)
                            {
                                double a = -Math.PI / 2 + R.Range(-1.35, 1.35), sp = R.Range(50, 150);
                                ps.Spawn(P.SPARK, s.x, Math.Min(-1, s.y - 1), Cos(a) * sp, Sin(a) * sp, R.Range(0.2, 0.5));
                            }
                            for (int i = 0; i < 4; i++) ps.Spawn(P.STAR, s.x + R.Range(-4, 4), s.y - R.Range(2, 8), R.Range(-15, 15), -R.Range(10, 35), R.Range(0.4, 0.8), R.Pick(new[] { WHITE, C[6] }), R.Range(0.8, 2));
                        }
                    }
                    ps.Update(dt);
                    lights.Update(dt);
                },
                DrawBack = (p, _, __) =>
                {
                    // 星星落下時下面那片地亮起來
                    double k = Clamp(t / 0.3) * (1 - Clamp((t - 1.7) / 0.7));
                    if (k > 0) foreach (double x in new[] { -36.0, 0, 36 }) p.Glow(x, -1, 40, C[4], 0.14 * k);
                    foreach (var h in hits) hit(p, h, true);
                    // 每個落點留下發光的印記，慢慢冷掉
                    foreach (var h in hits)
                    {
                        double k2 = 1 - (t - h.t) / 0.7;
                        if (k2 <= 0) continue;
                        p.Dot(h.x, h.y, k2 > 0.6 ? WHITE : C[6], k2 * 1.5);
                        foreach (double dx in new[] { -1.0, 1.0 }) p.Dot(h.x + dx, h.y, C[5], k2 * 1.2);
                        p.Glow(h.x, h.y - 1, 10, C[5], 0.35 * k2);
                    }
                    ps.Draw(p, "back");
                },
                Draw = (p, _, __) =>
                {
                    foreach (var s in stars) if (t >= s.t0 && !s.landed) star(p, s);
                    foreach (var h in hits)
                    {
                        hit(p, h, false);
                        double k = (t - h.t) / 0.22;
                        if (k < 0 || k >= 1) continue;
                        if (k < 0.35) p.Circle(h.x, h.y - 2, 5 * (1 - k / 0.35) + 1, WHITE);
                        Sim.Flare(p, h.x, h.y - 2, (h.big ? 16 : 12) * Pow(1 - k, 1.5) + 2, 1 - k, C);
                    }
                    ps.Draw(p, "front");
                    lights.Draw(p);
                },
            };
        }
    }
}
