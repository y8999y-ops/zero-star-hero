// 網頁版 pixelfx/src/fx/ui/coin-collect.js 一行一行翻成 C#（模擬特效）。
// 一枚金幣爆成一泉轉個不停的金幣，停在空中，再一枚接一枚飛進右上角的計數器；計數器每收一枚就彈一下、加一，閃一道光後收起來。
// 選項：Palette（8 階金）、Num["count"]（金幣數，1～12）、Num["from"]（計數器起始數字）、Seed、Light。
using System;
using System.Collections.Generic;
using System.Linq;
using static PixelFX.Pf;

namespace PixelFX.Fx
{
    public static class CoinCollect
    {
        public static readonly FxDef Def = new FxDef
        {
            Name = "Coin collect", W = 176, H = 116, OX = 60, OY = 102, Duration = 2.45, Loop = false, Fps = 30,
            Options = new FxOptions { Palette = new[] { "#2a1405", "#5c3008", "#9a5a0e", "#d48e18", "#f5b92c", "#ffde5e", "#fff4bc", "#ffffff" }, Seed = 4 }
                .Set("count", 10).Set("from", 12),
            Create = Create,
        };

        const double POP = 0.3, FLY0 = 0.58, GAP = 0.075, FLY = 0.28, FOLD = 2.0, CY = -16;
        // 計數器：右上角一塊底板，左邊一枚金幣圖示、右邊數字
        const double HX = 50, HY = -88, HW = 60, HH = 22, IX = HX + 12, IY = HY + 11;
        static readonly UiLib.Ink INK = new UiLib.Ink { outline = Col.Hex("#0d0a14"), rim = Col.Hex("#4a4060"), top = Col.Hex("#2a2338"), body = Col.Hex("#1e1929"), low = Col.Hex("#141019") };

        // 一枚 r px 的金幣，轉到正面寬 w（0～1）：暗邊、左上受光的邊框、左上照亮的面加一條浮雕槓，閃的時候全白
        static void Coin(Painter p, uint[] C, double x, double y, double r, double w, bool white = false)
        {
            uint WHITE = Col.WHITE;
            double rx = Math.Max(0.7, r * w), ry = r;
            p.Shade(x - rx - 1, y - ry - 1, x + rx + 1, y + ry + 1, (double px, double py, ref Painter.Out o) =>
            {
                double u = (px - x) / rx, v = (py - y) / ry, d = Hypot(u, v);
                if (d > 1) return;
                double e = (1 - d) * Math.Min(rx * 1.6, ry);
                if (white) { o.c = e < 1 ? C[6] : WHITE; return; }
                if (e < 1) { o.c = C[1]; return; }
                if (rx < 2) { o.c = v < -0.2 ? C[6] : v < 0.4 ? C[4] : C[3]; return; }
                if (e < 2) { o.c = u + v < -0.2 ? C[6] : C[3]; return; }
                if (Math.Abs(px - x) < 0.55 && Math.Abs(v) < 0.5) { o.c = C[3]; return; }
                if (px - x >= 0.55 && px - x < 1.55 && Math.Abs(v) < 0.5) { o.c = C[7]; return; }
                double l = -(u * 0.6 + v * 0.8);
                o.c = l > 0.4 ? C[7] : l > 0.05 ? C[6] : l > -0.35 ? C[5] : C[4];
            });
        }

        class CoinS { public double x, y, vx, vy, ph, spin, t0, fx, fy, bob; public int state; public List<double[]> trail = new List<double[]>(); }

        static FxImpl Create(FxOptions o)
        {
            uint WHITE = Col.WHITE;
            uint[] C = Col.Fit(o.Palette, 8); var R = new Rng((uint)o.SeedOr0); int N = (int)Clamp(Round(o["count"]), 1, 12);
            var ps = new Particles(R, sparks: new[] { C[7], C[6], C[5], C[3] }, ground: x => 0); var lights = new Lights();
            double end = Def.Duration - 0.05;
            var coins = new List<CoinS>();
            for (int i = 0; i < N; i++)
            {
                double s = ((double)i / Math.Max(1, N - 1)) * 2 - 1;
                var c = new CoinS { x = 0, y = CY };
                c.vx = s * R.Range(55, 90) + R.Range(-12, 12); c.vy = -R.Range(170, 285); c.ph = R.Range(0, TAU); c.spin = R.Range(9, 14) * R.Sign();
                c.state = 0; c.t0 = FLY0 + i * GAP; c.fx = 0; c.fy = 0; c.bob = R.Range(0, TAU);
                coins.Add(c);
            }
            double t = 0, bump = 0, flash = 0; bool popped = false; int count = (int)Round(o["from"]);

            return new FxImpl
            {
                Update = (dt, _) =>
                {
                    t += dt;
                    if (!popped && t >= POP)
                    {
                        popped = true;
                        lights.Add(0, CY, 46, WHITE, 0.8, 0.14);
                        lights.Add(0, CY, 48, C[5], 0.6, 0.5);
                        for (int i = 0; i < 14; i++)
                        {
                            double an = ((double)i / 14) * TAU + R.Range(-0.2, 0.2), sp = R.Range(80, 170);
                            ps.Spawn(P.SPARK, Cos(an) * 3, CY + Sin(an) * 3, Cos(an) * sp, Sin(an) * sp - 30, R.Range(0.15, 0.35));
                        }
                        for (int i = 0; i < 4; i++) ps.Spawn(P.DUST, R.Range(-6, 6), -1, R.Sign() * R.Range(15, 40), -R.Range(2, 8), R.Range(0.3, 0.5), Col.Hex("#5a4f6e"), R.Range(1.5, 2.5));
                        // 從爆開的地方甩出一圈星星
                        for (int i = 0; i < 10; i++)
                        {
                            double an = ((double)i / 10) * TAU + R.Range(-0.2, 0.2), sp = R.Range(70, 130), down = Sin(an) > 0 ? 0.25 : 1;
                            ps.Spawn(P.STAR, Cos(an) * 6, CY + Sin(an) * 6, Cos(an) * sp, Sin(an) * sp * down, R.Range(0.35, 0.6), R.Pick(new[] { C[7], C[6], C[5] }), i % 3 != 0 ? 0.6 : R.Range(1.2, 2));
                        }
                    }
                    foreach (var c in coins)
                    {
                        if (!popped || c.state == 3) continue;
                        c.ph += c.spin * dt;
                        if (c.state < 2)
                        {
                            // 噴泉：往上丟、被空氣減速，然後停在空中上下晃
                            if (c.state == 0)
                            {
                                c.vy += 640 * dt;
                                c.vx -= c.vx * 2.2 * dt;
                                if (c.vy > 0) c.state = 1;
                            }
                            else { c.vy -= c.vy * 7 * dt; c.vx -= c.vx * 4 * dt; }
                            c.x += c.vx * dt;
                            c.y += c.vy * dt;
                            if (t >= c.t0) { c.state = 2; c.fx = c.x; c.fy = c.y + Sin(t * 6 + c.bob) * 1.5; }
                        }
                        if (c.state == 2)
                        {
                            // 飛行：往上畫弧飛進計數器的金幣，越飛越快
                            double u = Clamp((t - c.t0) / FLY), e = u * u, mx = c.fx + (IX - c.fx) * 0.35, my = Math.Min(c.fy, IY) - 26;
                            c.x = (1 - e) * (1 - e) * c.fx + 2 * (1 - e) * e * mx + e * e * IX;
                            c.y = (1 - e) * (1 - e) * c.fy + 2 * (1 - e) * e * my + e * e * IY;
                            c.trail.Insert(0, new[] { c.x, c.y });
                            if (c.trail.Count > 7) c.trail.RemoveAt(c.trail.Count - 1);
                            // 一路掉小亮光
                            if (R.Chance(0.25)) ps.Spawn(P.STAR, c.x + R.Range(-2, 2), c.y + R.Range(-2, 2), R.Range(-8, 8), R.Range(-4, 10), R.Range(0.2, 0.4), R.Pick(new[] { C[7], C[6] }), 0.6);
                            if (u >= 1)
                            {
                                c.state = 3;
                                count++;
                                bump = 1;
                                flash = 1;
                                lights.Add(IX, IY, 26, C[5], 0.6, 0.25);
                                for (int i = 0; i < 3; i++)
                                {
                                    double an = R.Range(0, TAU), sp = R.Range(18, 40);
                                    ps.Spawn(P.STAR, IX + Cos(an) * 5, IY + Sin(an) * 5, Cos(an) * sp, Sin(an) * sp, Math.Min(R.Range(0.25, 0.45), end - t), R.Pick(new[] { C[7], C[6] }), i != 0 ? 0.6 : R.Range(1.2, 1.8));
                                }
                            }
                        }
                    }
                    bump = Math.Max(0, bump - dt / 0.14);
                    flash = Math.Max(0, flash - dt / 0.07);
                    ps.Update(dt);
                    lights.Update(dt);
                },

                DrawBack = (p, _, __) =>
                {
                    // 金幣爆開的地上一圈環
                    double k = (t - POP) / 0.45;
                    if (k > 0 && k < 1) Sim.Band(p, 0, 0, 4 + 34 * Ease.OutCubic(k), 0.22, Math.Max(1, 3 * (1 - k)), 1.15 - k, C, g => Sin(g) < 0);
                    ps.Draw(p, "back");
                },

                Draw = (p, _, __) =>
                {
                    double k = (t - POP) / 0.45;
                    if (k > 0 && k < 1) Sim.Band(p, 0, 0, 4 + 34 * Ease.OutCubic(k), 0.22, Math.Max(1, 3 * (1 - k)), 1.15 - k, C, g => Sin(g) >= 0);
                    // 大金幣：在影子上面晃、轉，然後爆成一個白圓
                    if (t < POP + 0.02)
                    {
                        double y = CY + Sin(t * 9) * 1.5, w = Math.Abs(Cos(t * 7));
                        p.Ellipse(0, 0.5, 6 - 0.5 * Sin(t * 9), 1.3, Col.Hex("#0d0a14"), 0.6);
                        // 兩顆小光點繞著它轉，一下在後面一下在前面
                        for (int i = 0; i < 2; i++)
                        {
                            double an = t * 7 + i * Math.PI, ox = Cos(an) * 11, oy = Sin(an) * 3;
                            if (Sin(an) < 0) p.Px(ox, y + oy, C[4]);
                        }
                        Coin(p, C, 0, y, 7, Math.Max(0.12, w), t > POP - 0.04);
                        for (int i = 0; i < 2; i++)
                        {
                            double an = t * 7 + i * Math.PI, ox = Cos(an) * 11, oy = Sin(an) * 3;
                            if (Sin(an) >= 0) { p.Px(ox, y + oy, C[7]); p.Glow(ox, y + oy, 4, C[5], 0.4); }
                        }
                        p.Glow(0, y, 20, C[5], 0.45 + 0.4 * Seg(t, POP - 0.15, POP));
                        if (t > 0.06 && t < 0.2) Sim.Sparkle(p, -3, y - 3, 3.5 * Sin(((t - 0.06) / 0.14) * Math.PI), C[7], C[6], 0.4);
                    }
                    double pk = (t - POP) / 0.1;
                    if (pk > 0 && pk < 1) p.Circle(0, CY, 13 * (1 - pk) + 1, pk < 0.5 ? WHITE : C[6]);
                    double fk = (t - POP) / 0.2;
                    if (fk > 0 && fk < 1) Sim.Flare(p, 0, CY, 26 * Pow(1 - fk, 1.5), 1 - fk, C);
                    double rk = (t - POP - 0.03) / 0.35;
                    if (rk > 0 && rk < 1) p.Ring(0, CY, 6 + 22 * Ease.OutCubic(rk), Math.Max(1, 2 * (1 - rk)), rk < 0.3 ? WHITE : C[6], 1.2 - rk);
                    // 金幣和它們的尾巴
                    foreach (var c in coins)
                    {
                        if (!popped || c.state == 3) continue;
                        for (int i = 1; i < c.trail.Count; i++) p.Line(c.trail[i - 1][0], c.trail[i - 1][1], c.trail[i][0], c.trail[i][1], i < 3 ? C[6] : C[4], 1.2 - i / 7.0);
                        double hover = c.state == 1 ? Sin(t * 6 + c.bob) * 1.5 : 0, w = Math.Abs(Cos(c.ph));
                        Coin(p, C, c.x, c.y + hover, 5, Math.Max(0.15, w));
                        p.Glow(c.x, c.y + hover, 10, C[5], c.state == 2 ? 0.5 : 0.32);
                        // 停在空中的金幣不時閃一下光
                        double gl = (t * 1.7 + c.bob) % 1;
                        if (c.state == 1 && gl < 0.12 && w > 0.5) Sim.Sparkle(p, c.x - 1, c.y + hover - 2, 3 * Sin((gl / 0.12) * Math.PI), C[7], C[6], 0.4);
                    }
                    // 計數器：攤開，每收一枚彈一下、加一，閃一道光，收起來
                    double open = Ease.OutBack(Seg(t, 0.06, 0.26), 2.2) * (1 - Ease.InBack(Seg(t, FOLD, FOLD + 0.2), 2));
                    if (open > 0.04)
                    {
                        double h = HH * open, y0 = HY + (HH - h) / 2, sh = Seg(t, 1.5, 1.76);
                        UiLib.Panel(p, HX, y0, HW, h, INK, Math.Min(4, h / 2), 1, sh > 0 && sh < 1 ? HX - 6 + (HW + 16) * sh : (double?)null);
                        if (open > 0.7)
                        {
                            Coin(p, C, IX, IY, 5.5 * (1 + 0.3 * bump), 1, flash > 0.5);
                            p.Glow(IX, IY, 14, C[5], 0.25 + 0.4 * bump);
                            if (bump > 0) p.Ring(IX, IY, 7 + 8 * (1 - bump), 1, bump > 0.6 ? WHITE : C[6], bump * 1.3);
                            double s = 2 * (1 + 0.22 * bump); string str = "x" + count; var word = UiLib.Spell(str); double W = word.w * s, H = 7 * s, x0 = IX + 9, ty = IY - H / 2;
                            var items = word.letters.Where(Lt => Lt.g != null).Select(Lt => new UiLib.WordItem { g = Lt.g, x = x0 + Lt.x * s, y = ty, sx = s, sy = s, flash = flash > 0.5 ? 1 : 0 }).ToList();
                            UiLib.DrawWord(p, items, new UiLib.WordStyle { fill = new[] { C[4], C[5], C[6], C[7] }, edge = WHITE, under = C[3], outline = INK.outline, shadow = 0 });
                            if (bump > 0) p.Glow(x0 + W / 2, IY, 16, C[5], 0.3 * bump);
                        }
                    }
                    ps.Draw(p, "front");
                    lights.Draw(p);
                },
            };
        }
    }
}
