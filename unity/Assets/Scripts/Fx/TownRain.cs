// 網頁版 game/src/fx-town-rain.js 一行一行翻成 C#（純函式迴圈特效，有前後兩層）。
// 城鎮的雨：從 pixelfx weather/rain 改來的——拿掉它自己的地板、水窪和整片霧，只留四層深度的斜雨絲、
// 落地的水花和貼地的薄霧；原點放在城鎮地面上。
// 雨的做法（兩色的分層雨絲、遠的在空中就結束、近的落地濺起水珠、貼地的霧）改編自 Sprite Fusion 的開源 rain
// （MIT，Copyright (c) 2026 Hugo Duprez）。
// 選項：Palette（8 階）、Num["density"]（雨量，0～1；每格都可以改）、Seed。
using System;
using static PixelFX.Pf;
using static PixelFX.Fx.WeatherLib;

namespace PixelFX.Fx
{
    public static class TownRain
    {
        public static readonly FxDef Def = MakeDef();
        static FxDef MakeDef()
        {
            var d = new FxDef
            {
                Name = "Rain", W = 320, H = 180, OX = 160, OY = 170, Duration = 8, Loop = true, Fps = 30,
                Options = new FxOptions
                {
                    Palette = new[] { "#0e1322", "#1a2440", "#283a5e", "#3a5482", "#5674a8", "#84a6d6", "#c0dcf8", "#f2f8ff" },
                    Seed = 4,
                }.Set("density", 1),
            };
            d.Pure = new FxImpl { DrawBack = (p, t, o) => DrawBack(d, p, t, o), Draw = (p, t, o) => Draw(d, p, t, o) };
            return d;
        }

        const double D = 8, SLANT = -0.2;
        static readonly double UX = SLANT / Hypot(SLANT, 1), UY = 1 / Hypot(SLANT, 1);
        class Layer { public int n, m0, m1, len; public int[] col; public double[] stop, z, size; public bool near; }
        // 從遠到近的深度：幾滴、一個迴圈落幾次（速度）、雨絲多長、顏色（尾、身、頭）、
        // 在哪裡結束（空中，或落在深度 z 的地上）、水花多大
        static readonly Layer[] LAYERS =
        {
            new Layer { n = 200, m0 = 10, m1 = 13, len = 2, col = new[] { 2, 2, 3 }, stop = new double[] { -80, -6 } },
            new Layer { n = 150, m0 = 14, m1 = 17, len = 4, col = new[] { 2, 3, 4 }, stop = new double[] { -45, -2 } },
            new Layer { n = 96, m0 = 19, m1 = 23, len = 7, col = new[] { 3, 4, 5 }, z = new[] { 0, 1.4 }, size = new[] { 0.15, 0.4 } },
            new Layer { n = 42, m0 = 25, m1 = 29, len = 13, col = new[] { 3, 5, 7 }, z = new[] { 2, 6.5 }, size = new[] { 0.6, 1.0 }, near = true },
        };
        // 城鎮版沒有水窪（地是城鎮的），所以原本「落在水窪裡畫漣漪」那段永遠不會走到，這裡省略

        static void DrawBack(FxDef meta, Painter p, double t, FxOptions o)
        {
            t = Round(t * 3e4) / 3e4;
            var q = Clip(p, meta); int S = o.SeedOr0; uint[] C = Col.Fit(o.Palette, 8);
            // 城鎮版：不畫整片霧和地板（城鎮自己有天空和地面）
            for (int L = 0; L < 3; L++) DrawLayer(q, t, S, C, L, o["density"]);
            Mist(meta, p, t, S, C);
        }

        static void Draw(FxDef meta, Painter p, double t, FxOptions o)
        {
            t = Round(t * 3e4) / 3e4;
            var q = Clip(p, meta); int S = o.SeedOr0; uint[] C = Col.Fit(o.Palette, 8);
            DrawLayer(q, t, S, C, 3, o["density"]);
        }

        static readonly int[] GUST = { 4, 8, 16 }, MIST = { 4, 8, 16, 32 };
        // 一層雨：每格一個迴圈落整數次，每次落在新的地方
        static void DrawLayer(Painter q, double t, int S, uint[] C, int L, double density)
        {
            var Ly = LAYERS[L]; int sd = S * 11 + L; uint c0 = C[Ly.col[0]], c1 = C[Ly.col[1]], c2 = C[Ly.col[2]]; double len = Ly.len;
            int n = (int)Round(Ly.n * density); var G = MakeField(S + 21, 256, 128, GUST); double sweep = (256 * t) / D;
            Trips(t, D, n, sd, Ly.m0, Ly.m1, (u, k, m, i) =>
            {
                int j = ToInt32(Wrap(k, m));
                // 陣風：一片片比較密、比較疏的雨跟著風掃過去
                if (L < 2 && Rand(sd, i, j, 7) > 0.35 + 1.3 * (Sample(G, (-166 + Rand(sd, i, j, 2) * 332) * 0.8 + sweep, 9 + L * 40) - 0.32)) return;
                double end = Ly.z != null ? Ly.z[0] + Rand(sd, i, j, 1) * (Ly.z[1] - Ly.z[0]) : Ly.stop[0] + Rand(sd, i, j, 1) * (Ly.stop[1] - Ly.stop[0]);
                double y0 = -172 - len, y = y0 + (end - y0) * u, x = -166 + Rand(sd, i, j, 2) * 332 - (end - y) * SLANT;
                // 遠的雨滴結束前變淡；近的完整
                double a = Ly.z != null ? 1 : Math.Min(1, (1 - u) * 5);
                if (len <= 2) { q.Dot(x, y, c2, a); q.Dot(x - UX, y - UY, c1, a * 0.8); }
                else
                {
                    q.Line(x - UX * len, y - UY * len, x - UX * len * 0.45, y - UY * len * 0.45, v => c0, v => a * (0.35 + 0.65 * v));
                    q.Line(x - UX * len * 0.45, y - UY * len * 0.45, x - UX, y - UY, c1, a);
                    q.Dot(x, y, c2, a);
                }
                // 近的雨滴反光
                if (Ly.near) q.Glow(x, y - 2, 4, C[5], 0.12);
                if (Ly.z == null) return;
                // 這滴之前落地的幾滴：地上的水花
                double dur = D / m;
                for (int back = 1; back < 4; back++)
                {
                    double age = u * dur + (back - 1) * dur;
                    if (age > 0.7) break;
                    int jp = ToInt32(Wrap(k - back, m)); double z = Ly.z[0] + Rand(sd, i, jp, 1) * (Ly.z[1] - Ly.z[0]), xp = -166 + Rand(sd, i, jp, 2) * 332;
                    if (Rand(sd, i, jp, 5) > (Ly.near ? 1 : 0.7)) continue;
                    double size = Ly.size[0] + ((z - Ly.z[0]) / (Ly.z[1] - Ly.z[0])) * (Ly.size[1] - Ly.size[0]);
                    if (Crown(q, xp, z, age, size, C[6], C[4], Col.WHITE, Rand(sd, i, jp, 4)) && Ly.near && age < 0.1) q.Glow(xp, z - 1, 5, C[5], 0.3 * (1 - age / 0.1));
                }
            });
        }

        // 雨打起來、貼地飄的薄霧：軟軟的幾條，頂上比較亮
        static void Mist(FxDef meta, Painter p, double t, int S, uint[] C)
        {
            var M = MakeField(S + 9, 256, 128, MIST); double drift = (256 * t) / D; uint crest = Col.Mix(C[4], C[5], 0.5);
            double Dens(double x, double y)
            {
                double prof = Smooth(-22, -4, y) * (1 - Smooth(7, 10, y));
                return prof * (0.62 + (Sample(M, x * 0.45 + drift, y * 4 + 30) - 0.5) * 2);
            }
            Pass(p, meta, -20, 9, (double x, double y, ref Out o) =>
            {
                double d = Dens(x, y);
                if (d < 0.28) return;
                double th = Bayer(x, y) * 0.06;
                o.b = 1;
                if (d > 0.46 + th && Dens(x, y - 1) < 0.43) { o.c = crest; o.a = 0.5; }
                else { o.c = d > 0.58 + th ? C[4] : C[3]; o.a = Clamp((d - 0.28) * 1.6) * 0.5; }
                o.l = C[4];
                o.k = (d - 0.3) * 0.1;
            });
        }
    }
}
