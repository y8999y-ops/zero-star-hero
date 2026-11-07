// 網頁版 pixelfx/src/fx/weather/shooting-stars.js 一行一行翻成 C#（純函式迴圈特效，城鎮的夜空）。
// 星空：淡淡的銀河光帶、暗暗的小點、穩定的星、幾顆會閃出十字光芒；流星白頭拖著金到玫瑰色的尾巴劃過，
// 大的會爆開、碎片飛散，每顆都留下一道會扭動、慢慢散掉的光痕。
// 星芒（光芒十字、白心、柔光、周圍閃的小星）改編自 Sprite Fusion 的開源 sparkle（MIT，Copyright (c) 2026 Hugo Duprez）。
// 選項：Palette（6 階流星）、Ramps["sky"]（5 階星空）、Seed。
using System;
using static PixelFX.Pf;
using static PixelFX.Fx.WeatherLib;

namespace PixelFX.Fx
{
    public static class ShootingStars
    {
        public static readonly FxDef Def = MakeDef();
        static FxDef MakeDef()
        {
            var d = new FxDef
            {
                Name = "Shooting stars", W = 320, H = 180, OX = 160, OY = 180, Duration = 10, Loop = true, Fps = 30,
                Options = new FxOptions
                {
                    Palette = new[] { "#3a1e5a", "#7a3a8a", "#e0607a", "#ffa86a", "#ffe6a8", "#ffffff" },
                    Seed = 4,
                }.Set("sky", new[] { "#141428", "#2a2a4a", "#4c4c7c", "#8e8ec4", "#dcdcff" }),
            };
            d.Pure = new FxImpl { Draw = (p, t, o) => Draw(d, p, t, o) };
            return d;
        }

        const double D = 10, TRAIN = 1.6;
        class Meteor { public double t0, x, y, a, v, life, s; public bool flare; }
        // 流星：什麼時候、從哪裡、往哪個方向、多快、燒多久、多大；最後一個參數＝會爆開
        static readonly Meteor[] METEORS =
        {
            new Meteor { t0 = 0.5, x = 60, y = -170, a = 2.45, v = 260, life = 0.55, s = 0.6 },
            new Meteor { t0 = 1.9, x = -40, y = -176, a = 2.2, v = 220, life = 0.7, s = 0.8 },
            new Meteor { t0 = 3.4, x = 150, y = -150, a = 2.62, v = 300, life = 0.45, s = 0.5 },
            new Meteor { t0 = 4.6, x = 130, y = -178, a = 2.35, v = 240, life = 1.05, s = 1.4, flare = true },
            new Meteor { t0 = 6.7, x = -90, y = -168, a = 2.05, v = 200, life = 0.6, s = 0.7 },
            new Meteor { t0 = 7.9, x = 20, y = -160, a = 2.5, v = 280, life = 0.5, s = 0.6 },
            new Meteor { t0 = 9.2, x = -10, y = -176, a = 2.28, v = 230, life = 0.8, s = 1, flare = true },
        };

        static void Draw(FxDef meta, Painter p, double t, FxOptions o)
        {
            var q = Clip(p, meta); int S = o.SeedOr0; uint[] C = Col.Fit(o.Palette, 6), K = Col.Fit(o.Ramps["sky"], 5);
            Sky(meta, p, q, t, S, K);
            for (int i = 0; i < METEORS.Length; i++) DrawMeteor(q, Wrap(t - METEORS[i].t0, D), METEORS[i], i, S, C);
        }

        // 星空：斜斜的淡銀河帶、暗點、穩定的星、幾顆閃出光芒
        static void Sky(FxDef meta, Painter p, Painter q, double t, int S, uint[] K)
        {
            RowsPar(p, meta, -180, -1, (y, R) =>   // 每一列各算各的：切段同時算（結果一樣）
            {
                int fy = ToInt32(Math.Floor(y));
                for (int i = 0; i < 320; i++)
                {
                    double x = i - 160 + 0.5, d = Math.Abs((y + 110) - (x * -0.32)) / 36;
                    if (d >= 1) continue;
                    double k = (1 - d) * (1 - d);
                    R.l[i] = K[2];
                    R.k[i] = (float)(0.1 * k);
                    if (Rand(i, fy, S, 5) < 0.05 * k) { R.c[i] = K[2]; R.a[i] = 0.7f; }
                }
            });
            for (int i = 0; i < 130; i++)
            {
                double x = -160 + Rand(S, i, 1) * 320, y = -180 + Rand(S, i, 2) * 178, r = Rand(S, i, 3), c = 1 + Math.Floor(Rand(S, i, 4) * 4);
                double tw = 0.5 + 0.5 * Sin((TAU * c * t) / D + Rand(S, i, 5) * TAU);
                if (r < 0.6) q.Dot(x, y, K[3], 0.35 + 0.5 * tw);
                else if (r < 0.94) { q.Px(x, y, r < 0.8 ? K[4] : Col.WHITE); q.Glow(x + 0.5, y + 0.5, 3, K[3], 0.22 * tw); }
                else Sim.Sparkle(q, x, y, 1 + Round(tw * 2), K[4], K[3], 0.3 * tw);
            }
        }

        // 一顆流星，亮起 age 秒後：頭變亮再燒完，尾巴沿色階冷下來；大的爆開、碎片飛散；留下的光痕扭動、散掉
        static void DrawMeteor(Painter q, double age, Meteor m, int i, int S, uint[] C)
        {
            double ca = Cos(m.a), sa = Sin(m.a), end = m.life + (m.flare ? 0.5 : 0) + TRAIN;
            if (age > end) return;
            double burn = Math.Min(age, m.life), hx = m.x + ca * m.v * burn, hy = m.y + sa * m.v * burn;
            // 光痕：燒過的整條路徑留著，變寬、飄走、扭動
            double trainK = age < m.life ? 1 : 1 - (age - m.life) / (TRAIN + (m.flare ? 0.5 : 0));
            if (trainK > 0)
            {
                double len = m.v * burn, nx = -sa, ny = ca;
                for (double d = 0; d < len; d += 1)
                {
                    double passed = age - d / m.v;
                    if (passed < 0.08) continue;
                    double g = trainK * Math.Min(1, (passed - 0.08) * 4) * (0.35 + 0.65 * Sin((Math.PI * d) / len)) * m.s, tw = Sin(d * 0.09 + passed * 1.7) * Math.Min(4, passed * 3);
                    double x = m.x + ca * d + nx * tw + passed * 4, y = m.y + sa * d + ny * tw;
                    q.Dot(x, y, passed < 0.6 ? C[2] : C[1], g * 0.75);
                    if (d % 6 == 0) q.Glow(x, y, 6 + passed * 4, C[1], 0.12 * g);
                }
            }
            if (age > m.life + (m.flare ? 0.5 : 0)) return;
            // 頭：很快變亮、撐住、燒完；大的一邊走一邊閃
            double u = age / m.life, k = age < m.life ? Math.Min(1, u * 6) * (u > 0.75 ? 1 - (u - 0.75) / 0.25 : 1) : 0;
            if (k > 0)
            {
                double L = (24 + 40 * m.s) * Math.Min(1, u * 3);
                uint[] tail = { C[5], C[4], C[3], C[2], C[1] };   // C.slice(1).reverse()
                for (double d = 0; d <= L; d += 0.5)
                {
                    double v = d / L, x = hx - ca * d, y = hy - sa * d;
                    q.Dot(x, y, v < 0.08 ? Col.WHITE : Col.At(tail, v * 0.95), k * (v < 0.6 ? 1 : (1 - v) / 0.4));
                    if (m.s > 0.9 && v < 0.4) q.Dot(x - sa * 0.9, y + ca * 0.9, v < 0.15 ? C[4] : C[3], k * (1 - v / 0.4));
                }
                q.Px(hx, hy, Col.WHITE);
                if (m.s > 0.9) { q.Px(hx + 1, hy, Col.WHITE); q.Px(hx, hy + 1, C[4]); }
                q.Glow(hx, hy, 8 + 10 * m.s, C[4], 0.45 * k);
                q.Glow(hx - ca * L * 0.3, hy - sa * L * 0.3, 10 + 8 * m.s, C[3], 0.2 * k);
            }
            if (!m.flare || age < m.life * 0.82) return;
            // 爆開：一團光和光芒，碎片繼續往前飛、淡掉
            double tf = m.life * 0.86, f = (age - m.life * 0.82) / (m.life * 0.18 + 0.5), fx = m.x + ca * m.v * tf, fy = m.y + sa * m.v * tf;
            if (f < 0.35)
            {
                Sim.Sparkle(q, fx, fy, 9 * Sin((Math.PI * f) / 0.35) + 2, C[4], C[3], 0.6);
                q.Glow(fx, fy, 40, C[3], 0.5 * (1 - f / 0.35));
            }
            // 爆點周圍散開的小星，各閃一次就沒了
            for (int j = 0; j < 7; j++)
            {
                double ang = Rand(S, i, j, 5) * TAU, r = 5 + Rand(S, i, j, 6) * 16, d0 = Rand(S, i, j, 7) * 0.3, g = (f - d0) / 0.45;
                if (g <= 0 || g >= 1) continue;
                double sx = fx + Cos(ang) * r * (0.6 + g * 0.5), sy = fy + Sin(ang) * r * (0.6 + g * 0.5) - g * 3, arm = Round(2.5 * Sin(Math.PI * g));
                if (arm >= 1) Sim.Sparkle(q, sx, sy, arm, j % 3 != 0 ? C[4] : Col.WHITE, C[3], 0.3 * (1 - g));
                else q.Px(sx, sy, C[4]);
            }
            for (int j = 0; j < 4; j++)
            {
                double da = (Rand(S, i, j, 1) - 0.5) * 0.5, sp = m.v * (0.5 + Rand(S, i, j, 2) * 0.4), tt = f * (m.life * 0.18 + 0.5), g = 1 - f;
                double x = fx + Cos(m.a + da) * sp * tt, y = fy + Sin(m.a + da) * sp * tt;
                if (g <= 0) continue;
                q.Line(x - Cos(m.a + da) * 5 * g, y - Sin(m.a + da) * 5 * g, x, y, C[3], g);
                q.Px(x, y, g > 0.5 ? Col.WHITE : C[4]);
                q.Glow(x, y, 5, C[3], 0.35 * g);
            }
        }
    }
}
