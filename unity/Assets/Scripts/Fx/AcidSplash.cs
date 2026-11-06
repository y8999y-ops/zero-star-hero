// 網頁版 pixelfx/src/fx/nature/acid-splash.js 一行一行翻成 C#（模擬特效）。
// 一團酸液落地炸成皇冠、四濺；在地上蝕出發光冒煙的坑、沸騰著沉下去，噴出亮珠，飄起淡淡蒸氣。
using System;
using System.Collections.Generic;
using static PixelFX.Pf;

namespace PixelFX.Fx
{
    public static class AcidSplash
    {
        public static readonly FxDef Def = new FxDef
        {
            Name = "Acid splash", W = 184, H = 116, OX = 92, OY = 100, Duration = 2.8, Loop = false, Fps = 30,
            Options = new FxOptions { Palette = new[] { "#0e140a", "#1c3010", "#2c5214", "#457e18", "#6aae1c", "#a0dc2a", "#dcff6a", "#f8ffd0" }, Seed = 6 },
            Create = Create,
        };

        const double HIT = 0.3, Y0 = -62, V0 = 60, SPREAD = 0.4, DRY = 0.7, GONE = 2.2, W = 30, PIT = 5, DUR = 2.8;

        class Wisp { public double x, y, t0, life, rise, len, amp, k, ph, drift; }
        class Spike { public double a, h, r; public bool shed; }
        class Stain { public double x, t0, w; }
        class Pop { public double x, y, t0; }

        // 一縷蒸氣：細、淡、快，邊走邊淡
        static void DrawWisp(Painter p, Wisp q, double t, uint col)
        {
            double age = t - q.t0, u = age / q.life;
            if (u < 0 || u >= 1) return;
            double head = q.rise * age, tail = Math.Max(0, head - q.len), fade = Smooth(0, 0.15, u) * (1 - Smooth(0.4, 1, u));
            for (double h = tail; h <= head; h += 0.5)
            {
                double s = (h - tail) / Math.Max(1, head - tail), x = q.x + q.amp * Sin(h * q.k + q.ph) * (0.2 + s) + q.drift * age;
                p.Blend(x, q.y - h, col, fade * Sin(Math.PI * s) * 0.42);
            }
        }

        static FxImpl Create(FxOptions o)
        {
            uint WHITE = Col.WHITE;
            uint[] C = Col.Fit(o.Palette, 8); var R = new Rng((uint)o.SeedOr0); Func<double, double> floor = x => 0;
            uint SCORCH = Col.Mix(C[0], Col.Hex("#140f0c"), 0.6), BURNT = Col.Mix(C[1], Col.Hex("#2a1a10"), 0.6), STEAM = Col.Mix(C[7], Col.Hex("#e8ece6"), 0.75);
            var ps = new Particles(R, sparks: new[] { C[7], C[6], C[5], C[4] }, ground: floor);
            var drops = new Drops(floor); var lights = new Lights(); var stains = new List<Stain>(); var wisps = new List<Wisp>(); var pops = new List<Pop>();
            var spikes = new Spike[13];
            for (int i = 0; i < 13; i++) { var s = new Spike(); s.a = ((double)i / 13) * TAU + R.Range(-0.18, 0.18); s.h = R.Range(4, 10); s.r = R.Range(0.85, 1.12); spikes[i] = s; }
            var rag = new double[80];
            for (int i = 0; i < 80; i++) rag[i] = Rand(i, o.SeedOr0, 5) - 0.5;
            double t = 0; bool hit = false;
            // 蝕出來的坑：越擴越寬、越蝕越深；酸液面隨著沸騰蒸發沉進去
            Func<double> pw = () => W * Ease.OutCubic(Clamp((t - HIT) / SPREAD)) * 1.02;
            Func<double> pitD = () => PIT * Ease.OutCubic(Clamp((t - HIT) / 1.1));
            Func<double, double> depth = x =>
            {
                double w = pw(), d = Math.Abs(x) / Math.Max(1, w);
                return d >= 1 ? -1 : pitD() * Math.Sqrt(1 - d * d) + rag[(int)((Round(x) + 200) % 80)] * 0.9;
            };
            Func<double> level = () => t < HIT ? 0 : -1.6 + (PIT + 1.6) * Ease.InQuad(Smooth(DRY, GONE, t));
            Func<double> width = () =>
            {
                double L = level(), w = pw();
                if (L <= 0) return w;
                double q = L / Math.Max(0.1, pitD());
                return w * Math.Sqrt(Math.Max(0, 1 - q * q));
            };
            Func<double> heat = () => Smooth(HIT, HIT + 0.3, t) * (1 - Smooth(GONE - 0.3, GONE + 0.25, t));
            Func<double> gobY = () => Y0 + V0 * t + 0.5 * 950 * t * t;
            Func<double> crownR = () => 4 + 11 * Ease.OutCubic(Clamp((t - HIT) / 0.16));
            Func<double> crownH = () => 5 * Sin(Math.PI * Clamp((t - HIT) / 0.26));
            Func<double> spikeK = () =>
            {
                double u = Clamp((t - HIT - 0.015) / 0.26);
                return Sin(Math.PI * Pow(u, 0.6));
            };
            Func<Spike, double[]> tipOf = s =>
            {
                double r = crownR() * s.r, h = crownH(), sn = Sin(s.a), sh = s.h * spikeK();
                double bx = Cos(s.a) * r, by = sn * r * 0.3 - h * (0.75 + 0.25 * Math.Abs(sn));
                return new[] { bx, by, bx + Cos(s.a) * sh * 0.55, by - sh };
            };
            Action<double, double, bool> steam = (x, y, big) =>
            {
                var q = new Wisp { x = x, y = y, t0 = t };
                q.life = Math.Min(R.Range(0.5, 0.9) * (big ? 1.3 : 1), DUR - 0.05 - t); q.rise = R.Range(22, 32); q.len = R.Range(5, 10) * (big ? 1.4 : 1);
                q.amp = R.Range(1, 2.5); q.k = R.Range(0.35, 0.6); q.ph = R.Range(0, TAU); q.drift = R.Range(-4, 4);
                wisps.Add(q);
            };
            // 皇冠：撞擊點周圍升起的薄杯壁、亮邊，杯緣上的尖刺頂著水珠
            Action<Painter, bool> crown = (p, back) =>
            {
                if (t < HIT || t > HIT + 0.27) return;
                double r = crownR(), h = crownH(), ry = r * 0.3;
                for (double x = Math.Floor(-r); x <= Math.Ceiling(r); x++)
                {
                    double c = (x + 0.5) / r;
                    if (Math.Abs(c) > 1) continue;
                    double e = Math.Sqrt(1 - c * c), yb = (back ? -ry : ry) * e, hh = h * (0.75 + 0.25 * e);
                    for (double y = Math.Floor(yb - hh); y <= Round(yb); y++)
                    {
                        bool rim = y == Math.Floor(yb - hh);
                        if (rim) p.Px(x, y, back ? C[5] : c < 0.1 ? C[7] : C[6]);
                        else p.Blend(x, y, C[(c < -0.25 ? 5 : c > 0.45 ? 3 : 4) - (back ? 1 : 0)], back ? 0.55 : 0.7);
                    }
                }
                foreach (var s in spikes)
                {
                    if ((Sin(s.a) < 0) != back) continue;
                    var tp = tipOf(s); double bx = tp[0], by = tp[1], tx = tp[2], ty = tp[3];
                    p.Line(bx, by, tx, ty, back ? C[4] : C[6]);
                    p.Line(bx + 1, by, (bx + tx) / 2 + 0.5, (by + ty) / 2, back ? C[3] : C[5]);
                    if (!s.shed) { p.Px(tx, ty - 1, back ? C[5] : C[7]); p.Px(tx + 1, ty - 1, C[5]); }
                }
            };

            return new FxImpl
            {
                Update = (dt, _) =>
                {
                    t += dt;
                    double f = Math.Min(1, dt * 120), w = width();
                    if (!hit && t >= HIT)
                    {
                        hit = true;
                        lights.Add(0, -4, 28, WHITE, 0.6, 0.08);
                        lights.Add(0, -10, 56, C[5], 0.5, 0.6);
                        for (int i = 0; i < 26; i++)
                        {
                            double a = -Math.PI / 2 + R.Range(-1.35, 1.35), sp = R.Range(60, 250);
                            drops.Add(R.Range(-3, 3), -2, Cos(a) * sp, Sin(a) * sp, R.Chance(0.3) ? 2 : 1);
                        }
                        for (int i = 0; i < 10; i++)
                        {
                            double a = -Math.PI / 2 + R.Range(-1.2, 1.2), sp = R.Range(120, 260);
                            ps.Spawn(P.SPARK, 0, -2, Cos(a) * sp, Sin(a) * sp, R.Range(0.12, 0.3));
                        }
                        for (int i = 0; i < 5; i++) steam(R.Range(-10, 10), -R.Range(2, 6), true);
                    }
                    // 皇冠尖刺到頂時甩出水珠
                    if (hit)
                        foreach (var s in spikes)
                            if (!s.shed && t > HIT + 0.09)
                            {
                                s.shed = true;
                                var tp = tipOf(s);
                                drops.Add(tp[2], tp[3] - 1, Cos(s.a) * R.Range(30, 80), -R.Range(50, 130), R.Chance(0.4) ? 2 : 1);
                            }
                    drops.Update(dt, (d, g) =>
                    {
                        // 落地的液滴在地上蝕一個小點、嘶嘶冒煙
                        if (Math.Abs(d.x) > pw()) { var st = new Stain { x = d.x, t0 = t }; st.w = d.s * 0.8 + R.Range(0.3, 1.2); stains.Add(st); }
                        if (t < GONE) steam(d.x, -1, false);
                    });
                    // 酸在嘶嘶作響：噴出小亮珠、表面閃小星、蒸氣從液面和坑裡捲起
                    double lv = level(), w2 = width();
                    if (t > HIT + 0.15 && t < GONE && w2 > 2)
                    {
                        if (R.Chance(0.3 * f))
                        {
                            double x = R.Range(-0.85, 0.85) * w2, y = Math.Min(lv, depth(x)) - 1;
                            pops.Add(new Pop { x = x, y = y, t0 = t });
                            for (int j = 0; j < R.Int(1, 3); j++) drops.Add(x, Math.Min(y - 1, -1), R.Range(-40, 40), -R.Range(50, 110), 1);
                        }
                        if (R.Chance(0.14 * f)) steam(R.Range(-0.9, 0.9) * w2, Math.Min(lv, 0) - 1, R.Chance(0.25));
                    }
                    // 酸乾了之後坑還冒一陣子煙
                    if (t > GONE - 0.2 && t < DUR - 0.5 && R.Chance(0.08 * f)) steam(R.Range(-0.7, 0.7) * pw(), 0, false);
                    for (int i = pops.Count - 1; i >= 0; i--) if (t - pops[i].t0 > 0.1) pops.RemoveAt(i);
                    for (int i = wisps.Count - 1; i >= 0; i--) if (t - wisps[i].t0 > wisps[i].life) wisps.RemoveAt(i);
                    ps.Update(dt);
                    lights.Update(dt);
                },
                DrawBack = (p, _, __) =>
                {
                    double fade = 1 - Smooth(DUR - 0.6, DUR - 0.08, t), hk = heat(), w = pw(), lv = level();
                    // 周圍蝕出的濺點
                    foreach (var s in stains)
                    {
                        double age = t - s.t0, k = 1 - Smooth(1, 1.8, age); uint c = age < 0.15 ? C[7] : age < 0.5 ? C[6] : age < 0.9 ? C[4] : BURNT;
                        for (double x = Math.Floor(s.x - s.w); x <= Math.Ceiling(s.x + s.w); x++) p.Dot(x, 0, Math.Abs(x - s.x) < s.w * 0.5 ? SCORCH : c, k * fade);
                        if (age < 0.5) p.Glow(s.x, -1, 5, C[5], 0.3 * (1 - age / 0.5));
                    }
                    crown(p, true);
                    if (t > HIT && w > 1)
                    {
                        // 坑：地上蝕出的碗，邊緣還在蝕的地方發光，冷了變焦邊
                        for (double x = Math.Floor(-w) - 1; x <= Math.Ceiling(w) + 1; x++)
                        {
                            double dp = depth(x + 0.5);
                            if (dp < 0) continue;
                            double bottom = Math.Max(0, Round(dp)); bool edge = Math.Abs(x + 0.5) / w > 0.88;
                            for (double y = 0; y <= bottom; y++) p.Dot(x, y, y == bottom ? (hk > 0.5 ? C[6] : hk > 0.15 ? C[4] : BURNT) : SCORCH, fade);
                            p.Dot(x, bottom + 1, hk > 0.5 ? C[5] : hk > 0.15 ? C[3] : SCORCH, fade * 0.8);
                            if (edge) p.Dot(x, -1, hk > 0.4 ? C[7] : hk > 0.1 ? C[5] : BURNT, fade);
                        }
                        foreach (double sd in new[] { -1.0, 1.0 }) p.Glow(sd * w, -1, 8, C[6], 0.45 * hk);
                        // 坑裡的酸：表面一層亮皮閃爍，越深越暗，沸騰蒸發時往下沉
                        if (t < GONE)
                            for (double x = Math.Floor(-w); x <= Math.Ceiling(w); x++)
                            {
                                double dp = depth(x + 0.5);
                                if (dp < 0) continue;
                                double d = Math.Abs(x + 0.5) / w, dome = lv < 0 ? Round(lv * Math.Sqrt(Math.Max(0, 1 - d * d))) : Round(lv), bottom = Round(dp);
                                if (dome > bottom) continue;
                                double n = Noise(x * 0.25 - t * 2.4, 3) + Noise(x * 0.1 + t * 1.4, 5) * 0.6;
                                for (double y = dome; y <= bottom; y++) p.Px(x, y, y == dome ? (n > 0.7 ? C[7] : C[6]) : y == dome + 1 ? (n > 0.2 ? C[5] : C[4]) : y >= bottom ? C[3] : C[4]);
                            }
                        p.Glow(0, -6, w * 1.4 + 10, C[4], 0.3 * hk * (0.85 + 0.15 * Sin(t * 9)));
                        p.Glow(0, 1, w * 0.9, C[6], 0.2 * hk);
                    }
                    ps.Draw(p, "back");
                },
                Draw = (p, _, __) =>
                {
                    // 酸團：被下墜拉長的水滴形，左上亮，上面拖一串小珠
                    if (t < HIT)
                    {
                        double y = gobY(), v = V0 + 950 * t, st = 1 + v * 0.0022, rx = 2.6 / Math.Sqrt(st), ry = 2.8 * st;
                        p.Shade(-rx - 1, y - ry - 4, rx + 1, y + ry + 1, (double x, double yy, ref Painter.Out o2) =>
                        {
                            double dx = x / rx, dy = (yy - y) / ry; bool tail = dy < 0 && Math.Abs(x) < rx * (1 + dy * 0.9) + 0.4 && dy > -1.7;
                            double d = dx * dx + dy * dy;
                            if (d > 1.25 && !tail) return;
                            o2.c = d > 1 && !tail ? C[2] : dx < -0.2 && dy < -0.1 ? C[7] : dy > 0.45 ? C[4] : C[5];
                        });
                        p.Px(-1, y - ry * 0.3, WHITE);
                        for (int i = 1; i <= 3; i++) p.Dot(0, y - ry - 2 - i * 4, C[5], 1 - i * 0.25);
                        p.Glow(0, y, 10, C[5], 0.45);
                    }
                    crown(p, false);
                    // 英雄格：落地那一下白色爆開
                    double e = t - HIT;
                    if (e >= 0 && e < 0.07)
                    {
                        double k = 1 - e / 0.07;
                        p.Ellipse(0, -2, 6 + 6 * (1 - k), 2.5, k > 0.5 ? WHITE : C[7]);
                        Sim.Sparkle(p, 0, -4, 8 * k, C[7], C[6], 0.6);
                    }
                    // 嘶嘶：珠子噴出的地方閃小星
                    foreach (var q in pops)
                    {
                        double k = (t - q.t0) / 0.1;
                        p.Px(q.x, q.y, WHITE);
                        foreach (var dd in new[] { new[] { 1, 0 }, new[] { -1, 0 }, new[] { 0, -1 } }) p.Dot(q.x + dd[0] * (1 + k * 2), q.y + dd[1] * (1 + k * 2), C[7], 1 - k);
                        p.Glow(q.x, q.y, 4, C[6], 0.4 * (1 - k));
                    }
                    foreach (var q in wisps) DrawWisp(p, q, t, STEAM);
                    drops.Draw(p, C);
                    ps.Draw(p, "front");
                    lights.Draw(p);
                },
            };
        }
    }
}
