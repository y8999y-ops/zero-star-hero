// 網頁版 pixelfx/src/fx/ui/quest-complete.js 一行一行翻成 C#（模擬特效）。
// 有縫線的緞帶從中間攤開，QUEST COMPLETE 一個字一個字打出來，金色印章蓋下去、打勾，星星一顆顆冒出來；最後全部捲走。
// 選項：Palette（8 階金）、Ramps["ribbon"]（7 階緞帶）、Str["text"]（預設 "QUEST COMPLETE"）、Seed、Light。
using System;
using System.Collections.Generic;
using System.Linq;
using static PixelFX.Pf;

namespace PixelFX.Fx
{
    public static class QuestComplete
    {
        public static readonly FxDef Def = new FxDef
        {
            Name = "Quest complete", W = 204, H = 92, OX = 102, OY = 46, Duration = 2.6, Loop = false, Fps = 30,
            Options = new FxOptions { Palette = new[] { "#2a1405", "#5c3008", "#9a5a0e", "#d48e18", "#f5b92c", "#ffde5e", "#fff4bc", "#ffffff" }, Seed = 8 }
                .Set("ribbon", new[] { "#1e0608", "#45101a", "#7a1a26", "#ad2632", "#d8433f", "#f27a5e", "#ffb79a" }).Set("text", "QUEST COMPLETE"),
            Create = Create,
        };

        const double L = 66, BH = 8, OPEN = 0.32, TYPE = 0.2, STEP = 0.036, STAMP = 0.95, SX = 64, SY = 4, POPSEAL = 2.0, ROLL = 2.08;

        // 緞帶：後面兩條剪了 V 口的尾巴、暗的摺痕，然後是上緣亮、有縫線、兩頭捲起來的帶子
        static void Ribbon(Painter p, uint[] Rb, uint[] G, double l, double tails, double t)
        {
            if (l < 1) return;
            if (tails > 0.02)
                foreach (int s in new[] { -1, 1 })
                {
                    double drop = 6 * tails, x0 = s * (l - 8), x1 = s * (l + 16 * tails);
                    p.Shade(Math.Min(x0, x1) - 1, -BH + drop - 1, Math.Max(x0, x1) + 1, BH + drop + 1, (double x, double y, ref Painter.Out o) =>
                    {
                        double u = (x - x0) / (x1 - x0), v = y - drop;
                        if (u < 0 || u > 1 || Math.Abs(v) > BH) return;
                        // 尾端剪一個 V 口
                        if (u > 1 - (0.3 * (BH - Math.Abs(v))) / BH) return;
                        double e = Math.Min(BH - Math.Abs(v), (1 - u) * (x1 - x0) * s);
                        if (e < 1 || u < 0.02) { o.c = Rb[0]; return; }
                        o.c = v < -BH + 2 ? Rb[3] : v < 0 ? Rb[2] : Rb[1];
                    });
                    // 尾巴塞到帶子下面的摺痕
                    p.Tri(s * (l - 8), BH, s * (l - 1), BH, s * (l - 8), BH + drop, Rb[0]);
                }
            p.Shade(-l - 1, -BH - 1, l + 1, BH + 1, (double x, double y, ref Painter.Out o) =>
            {
                double ax = Math.Abs(x), v = y;
                if (ax > l || Math.Abs(v) > BH) return;
                double e = Math.Min(l - ax, BH - Math.Abs(v));
                if (e < 1) { o.c = Rb[0]; return; }
                if (v < -BH + 2) { o.c = Rb[5]; return; }
                if (v > BH - 2) { o.c = Rb[1]; return; }
                // 上下緣內側的金色縫線
                if ((Math.Abs(v + BH - 2.5) < 0.5 || Math.Abs(v - BH + 3.5) < 0.5) && Math.Floor(x + 0.5) % 3 != 0 && ax < l - 3) { o.c = G[3]; return; }
                o.c = v < -1 ? Rb[4] : Rb[3];
            });
            // 攤開的時候，捲起來的兩頭跟著邊走
            if (tails < 0.02)
                foreach (int s in new[] { -1, 1 })
                {
                    double x = s * l;
                    p.Rect(Round(x) - 2, -BH - 2, 4, BH * 2 + 4, Rb[0]);
                    p.Rect(Round(x) - 1, -BH - 1, 1, BH * 2 + 2, Rb[4]);
                    p.Rect(Round(x), -BH - 1, 1, BH * 2 + 2, Rb[2]);
                    p.Px(Round(x) - 1, -BH - 1, Rb[6]);
                }
        }

        // 金色印章：波浪邊、受光的面加一圈內環，勾勾照進度 k 畫上去
        static void Seal(Painter p, uint[] G, double x, double y, double r, double sx, double sy, bool white, double k)
        {
            uint WHITE = Col.WHITE;
            double M = r * 1.25 + 2;
            p.Shade(x - M * sx, y - M * sy, x + M * sx, y + M * sy, (double px, double py, ref Painter.Out o) =>
            {
                double dx = (px - x) / sx, dy = (py - y) / sy, d = Hypot(dx, dy), an = Atan2(dy, dx), edge = r * (1 + 0.09 * Cos(an * 14));
                if (d > edge) return;
                if (white) { o.c = edge - d < 1 ? G[5] : WHITE; return; }
                if (edge - d < 1) { o.c = G[0]; return; }
                double l = -(dx * 0.6 + dy * 0.8) / r;
                if (edge - d < 3) { o.c = l > 0.3 ? G[6] : l > -0.3 ? G[5] : G[3]; return; }
                if (Math.Abs(d - r * 0.66) < 0.5) { o.c = l > 0 ? G[3] : G[2]; return; }
                o.c = l > 0.45 ? G[7] : l > 0.1 ? G[6] : l > -0.35 ? G[5] : G[4];
            });
            if (white || k <= 0) return;
            // 勾勾：短短往下一筆、長長往上一筆，白色加暗邊
            var pts = new[] { new[] { -5.0, 0 }, new[] { -1.5, 3.5 }, new[] { 5.5, -4.5 } }.Select(q => new[] { x + q[0] * sx, y + q[1] * sy }).ToArray();
            double len1 = Hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]), len2 = Hypot(pts[2][0] - pts[1][0], pts[2][1] - pts[1][1]);
            double done = k * (len1 + len2);
            var segs = new[] { (a: pts[0], b: pts[1], u: Math.Min(1, done / len1)), (a: pts[1], b: pts[2], u: Clamp((done - len1) / len2)) };
            foreach (var (w, c) in new[] { (4.2, G[0]), (2.4, WHITE) })
                foreach (var (a, b, u) in segs) if (u > 0) p.Beam(a[0], a[1], a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, w, c);
        }

        class Sat { public double x, y, t0, dur, L; }

        static FxImpl Create(FxOptions o)
        {
            uint WHITE = Col.WHITE;
            uint[] G = Col.Fit(o.Palette, 8), Rb = Col.Fit(o.Ramps["ribbon"], 7); var R = new Rng((uint)o.SeedOr0);
            var ps = new Particles(R, sparks: new[] { G[7], G[6], G[5], G[3] }); var lights = new Lights();
            var word = UiLib.Spell(o.Str["text"], "mini"); const double TS = 2; double TW = word.w * TS, TX = -TW / 2 - 4, TY = -5;
            var glyphs = word.letters.Where(Lt => Lt.g != null).ToList();
            var sats = new List<Sat>();
            for (int i = 0; i < 7; i++)
            {
                var s = new Sat();
                s.x = ((double)i / 6 - 0.5) * 140 + R.Range(-6, 6); s.y = (i % 2 != 0 ? 1 : -1) * R.Range(15, 22); s.t0 = STAMP + 0.12 + i * 0.12 + R.Range(0, 0.04);
                s.dur = R.Range(0.3, 0.45); s.L = R.Range(3, 6);
                sats.Add(s);
            }
            double t = 0; bool stamped = false, popped = false;
            double end = Def.Duration - 0.05;
            int seed = o.SeedOr0;
            return new FxImpl
            {
                Update = (dt, _) =>
                {
                    t += dt;
                    if (!stamped && t >= STAMP)
                    {
                        stamped = true;
                        lights.Add(SX, SY, 40, G[5], 0.7, 0.35);
                        lights.Add(SX, SY, 18, WHITE, 0.7, 0.1);
                        for (int i = 0; i < 12; i++)
                        {
                            double an = ((double)i / 12) * TAU + R.Range(-0.2, 0.2), sp = R.Range(40, 80) * (Cos(an) > 0 ? 0.6 : 1);
                            ps.Spawn(P.STAR, SX + Cos(an) * 11, SY + Sin(an) * 11, Cos(an) * sp, Sin(an) * sp * 0.7, R.Range(0.25, 0.45), R.Pick(new[] { G[7], G[6], G[5] }), i % 3 != 0 ? 0.6 : R.Range(1.2, 1.8));
                        }
                    }
                    // 帶子停著的時候，金色小光點往上飄
                    if (t > STAMP && t < POPSEAL && R.Chance(0.08)) ps.Spawn(P.STAR, R.Range(-L, L), R.Range(-BH, BH), R.Range(-5, 5), -R.Range(8, 20), Math.Min(R.Range(0.4, 0.8), end - t), R.Pick(new[] { G[6], G[5] }), 0.6);
                    if (!popped && t >= POPSEAL + 0.05)
                    {
                        popped = true;
                        lights.Add(SX, SY, 30, G[6], 0.6, 0.2);
                        for (int i = 0; i < 8; i++)
                        {
                            double an = R.Range(0, TAU), sp = R.Range(40, 90);
                            ps.Spawn(P.STAR, SX + Cos(an) * 6, SY + Sin(an) * 6, Cos(an) * sp, Sin(an) * sp, Math.Min(R.Range(0.25, 0.4), end - t), R.Pick(new[] { G[7], G[6] }), i % 2 != 0 ? 0.6 : 1.5);
                        }
                    }
                    ps.Update(dt);
                    lights.Update(dt);
                },

                Draw = (p, _, __) =>
                {
                    UiLib.Shake(t, 2, out double jx, out double jy, STAMP, 0.18, seed);
                    // 帶子從中間攤開，最後再捲回去
                    double l = L * (t < ROLL ? Ease.OutCubic(Seg(t, 0, OPEN)) : 1 - Ease.InCubic(Seg(t, ROLL, ROLL + 0.26)));
                    double tails = Seg(t, OPEN - 0.02, OPEN + 0.12) * (t < ROLL ? 1 : 0);
                    double sh = Seg(t, 1.2, 1.5); double? shine = sh > 0 && sh < 1 ? -L - 10 + (2 * L + 20) * sh : (double?)null;
                    Ribbon(p, Rb, G, l, Ease.OutBack(tails, 2), t);
                    if (shine.HasValue)
                        for (double y = -BH + 1; y < BH; y++)
                        {
                            double x = shine.Value + (y + BH) * 0.6;
                            if (Math.Abs(x) < l - 2) { p.Px(x, y, Rb[6]); p.Px(x + 1, y, Rb[5]); }
                        }
                    // 字一個一個打出來，每個先白閃一下；帶子捲走時被切掉
                    var items = new List<UiLib.WordItem>();
                    for (int i = 0; i < glyphs.Count; i++)
                    {
                        var Lt = glyphs[i];
                        double u = t - (TYPE + i * STEP), x = TX + Lt.x * TS + jx;
                        if (u < 0 || Math.Abs(x + Lt.w) > l - 3) continue;
                        double s = u < 0.035 ? 2.6 : TS;
                        items.Add(new UiLib.WordItem { g = Lt.g, x = x - ((s - TS) * Lt.w) / 2, y = TY + jy - ((s - TS) * 5) / 2, sx = s, sy = s, flash = u < 0.07 ? 1 : 0 });
                    }
                    UiLib.DrawWord(p, items, new UiLib.WordStyle { fill = new[] { G[4], G[5], G[6], G[7] }, edge = WHITE, under = G[3], outline = Rb[0], shadow = Rb[1] });
                    // 印章：大大淡淡地掉下來，蓋下去時壓扁一下、白閃，打勾，最後爆開
                    double dk = Seg(t, STAMP - 0.12, STAMP), pk = t - POPSEAL;
                    if (dk > 0 && pk < 0.08)
                    {
                        double fall = 1 - Ease.InQuad(dk), sq = Exp(-(t - STAMP) * 30) * (t >= STAMP ? 1 : 0);
                        double s = 1 + 0.8 * fall, sx = s * (1 + 0.2 * sq), sy = s * (1 - 0.2 * sq);
                        if (pk > 0) sx = sy = 1 + 0.3 * (pk / 0.08);
                        bool white = (t >= STAMP && t < STAMP + 0.05) || pk > 0;
                        if (dk < 1) p.Ellipse(SX, SY + 12, 10 * (1 - 0.3 * fall), 2, Rb[0], 0.5 * dk);
                        Seal(p, G, SX + jx, SY - 14 * fall + jy, 11, sx, sy, white, Seg(t, STAMP + 0.08, STAMP + 0.24));
                        p.Glow(SX, SY, 22, G[5], 0.3 + (white ? 0.4 : 0));
                    }
                    double rk = (t - STAMP) / 0.3;
                    double rr = 12 + 13 * Ease.OutCubic(rk);
                    if (rk > 0 && rk < 1) { uint rc = rk < 0.3 ? WHITE : G[5]; p.Ellipse(SX, SY, rr * 1.15, rr, (d, g) => rc, (d, g) => d > 1 - 1.4 / rr ? 1.2 - rk : 0); }
                    // 星星一顆接一顆在帶子四周冒出來
                    foreach (var s in sats)
                    {
                        double u = (t - s.t0) / s.dur;
                        if (u > 0 && u < 1) Sim.Sparkle(p, s.x, s.y, s.L * Pow(Sin(u * Math.PI), 0.7), G[6], G[5], 0.5);
                    }
                    ps.Draw(p);
                    p.Glow(0, 0, 76, G[4], 0.2 * Seg(t, 0.2, 0.5) * (1 - Seg(t, ROLL, ROLL + 0.2)));
                    lights.Draw(p);
                },
            };
        }
    }
}
