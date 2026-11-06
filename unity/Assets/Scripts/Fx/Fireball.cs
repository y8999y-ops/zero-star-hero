// 網頁版 pixelfx/src/fx/fire/fireball.js 一行一行翻成 C#（純函式迴圈特效：只看時間 t 畫）。
// 火球往右飛：翻滾的白熱頭、一圈火焰、長長的撕裂火尾冷成煙、身後掉餘燼。
using System;
using System.Collections.Generic;
using System.Linq;
using static PixelFX.Pf;
using static PixelFX.Fx.FireLib;

namespace PixelFX.Fx
{
    public static class Fireball
    {
        public static readonly FxDef Def = new FxDef
        {
            Name = "Fireball", W = 136, H = 56, OX = 112, OY = 28, Duration = 1.2, Loop = true, Fps = 30,
            Options = new FxOptions
            {
                Palette = new[] { "#4a1712", "#8a1f17", "#c9281f", "#f2561d", "#ff8a2a", "#ffc23d", "#ffe26b", "#fff3a6", "#ffffff" },
                Seed = 5,
            }.Set("radius", 5).Set("speed", 120),
            Pure = new FxImpl { Draw = Draw },
        };

        const double D = 1.2;
        static readonly LoopNoiseFn NL = NoiseFor(D);
        static readonly uint SMOKE1 = Col.Hex("#5b5566");
        // 彗星身體：從頭往後拖的火舌 [長, 半寬, y 偏移]
        static readonly double[][] BODY = { new[] { 30, 4.2, 0 }, new[] { 23, 4.4, -1.6 }, new[] { 22, 4.4, 1.6 }, new[] { 15, 4.6, 0.0 } };
        // 頭上往後翻的細火舌 [在頭上的角度（0＝鼻尖）, 長, 半寬]
        static readonly double[][] CORONA = { new[] { -1.3, 6, 1.1 }, new[] { -1.8, 8, 1.2 }, new[] { -2.3, 7, 1.1 }, new[] { 1.3, 6, 1.1 }, new[] { 1.8, 8, 1.2 }, new[] { 2.3, 7, 1.1 } };

        // 頭：輪廓翻滾、熱度成螺旋，中心白，往後拖
        static void Head(Painter p, uint[] H, double t, double R0, int S, double hx, double hy)
        {
            double ph = t / D;
            p.Shade(hx - R0 * 2.4, hy - R0 * 1.7, hx + R0 * 1.5, hy + R0 * 1.7, (double x, double y, ref Painter.Out o) =>
            {
                x -= hx;
                y -= hy;
                double d = Hypot(x, y), th = Atan2(y, x), back = Math.Max(0, -Cos(th)), a = th / TAU;
                double bump = 0.55 * PNoise(a * 9 + ph * 9, 9, S) + 0.35 * PNoise(a * 5 - ph * 10, 5, S + 1);
                double rim = R0 * (1 + 0.55 * back * back) + bump;
                if (d > rim) return;
                double swirl = PNoise(a * 5 - ph * 10 + d * 0.45, 5, S + 2);
                double h = 1 - d / rim + 0.26 * swirl + 0.1 * (1 - back);
                // 前緣：切開空氣的那一圈亮邊
                if (rim - d < 1 && back < 0.3) { o.c = h > 0.3 ? H[3] : H[5]; return; }
                o.c = h > 0.74 ? H[0] : h > 0.58 ? H[1] : h > 0.42 ? H[2] : h > 0.27 ? H[4] : h > 0.13 ? H[5] : H[6];
            });
        }

        class Puff { public double x, y, v, vy, fl, sl, s, f, life; public bool sm; }
        class Mote { public double a, v, life; }
        class Emb { public double x, y, v, vy, life, ph; public bool big; }

        public static void Draw(Painter p, double t, FxOptions o)
        {
            uint[] F = Col.Fit(o.Palette, 9), H = HotFirst(F); int S = o.SeedOr0; double R0 = o["radius"], V = o["speed"];
            FrameNoiseFn N = (rate, seed, off) => NL(t, rate, seed, off);
            uint GLOW = Col.Mix(Col.Mix(H[3], H[4], 0.5), Col.WHITE, 0.25), SMOKE = Col.Mix(SMOKE1, H[6], 0.3);
            uint[] SPARKS = { H[1], H[2], H[4], H[5] }, EMB = { H[1], H[2], H[4], H[6] };
            // 頭飛的時候微微上下晃
            double hx = N(3, S + 50) * 0.5, hy = N(2.5, S + 51) * 0.7;

            // 尾巴：從後面甩出去的火團，冷下來、變大、上升，有些燒完變煙。位置相對於頭（頭跑得比它們快）。
            var fire = new List<(double age, double x, double y, Puff q)>(); var smoke = new List<(double sa, double x, double y, Puff q)>();
            Looped(t, D, 130, S + 100, (r, i) =>
            {
                double fl = r.Range(0.22, 0.55); bool sm = r.Chance(0.55); double x = -r.Range(2, 24);
                var q = new Puff { x = x };
                q.y = r.Range(-1, 1) * (R0 - 0.1 * -x); q.v = V * r.Range(0.3, 0.6); q.vy = r.Range(-16, 16); q.fl = fl; q.sm = sm;
                q.sl = r.Range(0.25, 0.45); q.s = r.Range(1.3, 2.9); q.f = r.Next() * 0.5 + 0.5 * (-x / 24); q.life = fl + (sm ? 0.45 : 0);
                return q;
            }, q => q.life, (q, age, i) =>
            {
                double ta = Math.Min(age, q.fl); var dr = Drift(0, q.y, q.v, q.vy, ta, 0, -70, 4.5, 3);
                double wx = dr.x, y = dr.y, wvx = dr.vx, vy = dr.vy;
                double x = q.x + wx - V * ta;
                if (age < q.fl) { fire.Add((age, x, y, q)); return; }
                if (!q.sm || age - q.fl > q.sl) return;
                double sa = age - q.fl; var sd = Drift(x, y, wvx - V, vy * 0.6 - 6, sa, V * 2, -30, 2, 1.2);
                smoke.Add((sa, sd.x, sd.y, q));
            });
            foreach (var (sa, x, y, q) in smoke) SmokePuff(p, x, y, 1 - sa / q.sl, q.s * 0.9, SMOKE);
            // JS 的 sort 是穩定排序：同樣 age 保持原本順序（OrderByDescending 也是穩定的）
            foreach (var (age, x, y, q) in fire.OrderByDescending(e => e.age).ToList())
            {
                double u = age / q.fl;
                FirePuff(p, x, y, 1 - u, q.s * (1 + 1.3 * u), q.f, H, 0.07, -0.86, -0.5);
            }

            // 身體：從頭拖出去的火舌，加上一圈舔著頭的細火
            for (int i = 0; i < BODY.Length; i++)
            {
                double len = BODY[i][0], w = BODY[i][1], dy = BODY[i][2];
                int n = (S * 5 + i) * 17; double L = len * (0.82 + 0.25 * N(4, n)) * (1 + 0.3 * Math.Max(0, N(2.4, n + 3)));
                FlameBlade(p, hx + 1, hy + dy * 0.5, -1, dy * 0.02, L, w * R0 / 5, N(3, n + 5) * 3 + dy, N, n, H, LAYERS, 0.5, 1.1 + L * 0.05);
            }
            for (int i = 0; i < CORONA.Length; i++)
            {
                double a = CORONA[i][0], len = CORONA[i][1], w = CORONA[i][2];
                int n = (S * 5 + i + 20) * 17; double L = len * (0.7 + 0.4 * (0.5 + 0.5 * N(6, n))), ox = Cos(a) * R0 * 0.85, oy = Sin(a) * R0 * 0.85;
                double dx = Cos(a) * 0.55 - 1, dy = Sin(a) * 0.55, l = Hypot(dx, dy);
                FlameBlade(p, hx + ox, hy + oy, dx / l, dy / l, L, w, -Sign(a) * 1.5, N, n, H, LAYERS);
            }
            Head(p, H, t, R0, S, hx, hy);

            // 從頭皮上彈出去的小火點：短短的熱線，馬上消失
            Looped(t, D, 26, S + 200, (r, i) => new Mote { a = r.Range(-2.4, 2.4), v = r.Range(30, 70), life = r.Range(0.08, 0.18) }, q => q.life, (q, age, i) =>
            {
                double ca = Cos(q.a), sa = Sin(q.a), d = R0 * 0.9 + q.v * age, x = hx + ca * d - V * 0.4 * age, y = hy + sa * d;
                double k = 1 - age / q.life, L = 1 + 2 * k;
                p.Line(x - ca * L + V * 0.02, y - sa * L, x, y, k > 0.5 ? H[1] : H[3]);
                p.Glow(x, y, 3, H[2], 0.4 * k);
            });
            // 留在後面的餘燼：頭跑贏它們，冷了往下掉
            Looped(t, D, 30, S + 300, (r, i) =>
            {
                var q = new Emb();
                q.x = -r.Range(2, 16); q.y = r.Range(-3, 3); q.v = V * r.Range(0.3, 0.8); q.vy = r.Range(-20, 20); q.life = r.Range(0.25, 0.55); q.big = r.Chance(0.25); q.ph = r.Range(0, 6.3);
                return q;
            }, q => q.life, (q, age, i) =>
            {
                var dr = Drift(0, q.y, q.v, q.vy, age, 0, 50, 3, 2);
                double x = q.x + dr.x - V * age, k = 1 - age / q.life;
                if (q.big) Ember(p, x, dr.y, k, 2, EMB, age * 40 + q.ph);
                else Spark(p, x, dr.y, dr.vx - V, dr.vy, k, SPARKS);
            });

            // 光：熱的中心、暖的光暈、順著尾巴的光
            double flk = 0.85 + 0.15 * N(9, S + 7);
            p.GlowLine(hx - 6, hy, -50, -2, 12, GLOW, 0.2 * flk);
            p.Glow(hx - 2, hy, 42, GLOW, 0.42 * flk);
            p.Glow(hx, hy, 13, H[1], 0.3 * flk);
        }
    }
}
