// 網頁版 pixelfx/src/fx/nature/poison-cloud.js 一行一行翻成 C#（純函式迴圈特效，有前後兩層）。
// 貼地的毒霧：一層層破邊的氣體從內部透出黃綠光、往上褪成紫，氣舌往外爬、尖端捲起；煙柱扭成緞帶往上飄。
using System;
using System.Collections.Generic;
using static PixelFX.Pf;

namespace PixelFX.Fx
{
    public static class PoisonCloud
    {
        public static readonly FxDef Def = new FxDef
        {
            Name = "Poison cloud", W = 256, H = 100, OX = 128, OY = 86, Duration = 4, Loop = true, Fps = 30,
            Options = new FxOptions
            {
                Palette = new[] { "#0e0816", "#24123a", "#3e2056", "#5a3a62", "#6a6a3a", "#96aa30", "#cce040", "#f4ffa0" },
                Seed = 3,
            }.Set("spread", 1),
            Pure = new FxImpl { DrawBack = DrawBack, Draw = Draw },
        };

        const double D = 4;
        class Sheet { public double h, e, a; public int dim; public double flow; public int n; public bool back; }
        // 一層層的氣，從後到前：多高、多寬、多濃、暗幾階、邊緣流多快
        static readonly Sheet[] SHEETS =
        {
            new Sheet { h = 36, e = 0.84, a = 0.46, dim = 2, flow = 4, n = 2, back = true },
            new Sheet { h = 26, e = 0.96, a = 0.5, dim = 1, flow = 8, n = 2, back = true },
            new Sheet { h = 16, e = 1.04, a = 0.56, dim = 0, flow = 8, n = 3, back = false },
        };

        class Tongue { public double s, q, x, h; }
        // 沿地面從中間往外爬的氣舌：前端在哪、多高、爬到哪了
        static List<Tongue> Tongues(Sheet sh, int si, double E, double ph)
        {
            var o = new List<Tongue>();
            foreach (double s in new[] { -1.0, 1.0 })
                for (int i = 0; i < sh.n; i++)
                {
                    double q = (ph + (double)i / sh.n + si * 0.17 + (s > 0 ? 0.5 / sh.n : 0)) % 1;
                    o.Add(new Tongue { s = s, q = q, x = s * E * (0.3 + 0.82 * q), h = sh.h * (0.75 - 0.45 * q) });
                }
            return o;
        }

        // 一層氣在 x 處離地多高：中間平、兩端掉下去，頂部被往外流的雜訊撕碎，每條氣舌前端後面抬高
        static double Height(Sheet sh, int si, double E, double x, double ph, List<Tongue> T, int seed)
        {
            double ax = Math.Abs(x), env = 1 - Smooth(0.5, 1, ax / (E * sh.e)), r = TileNoise(ax * 0.07 - ph * sh.flow, si * 3.7, sh.flow, 0, seed + si);
            double h = sh.h * env * (0.55 + 0.45 * r);
            foreach (var g in T)
            {
                double behind = g.s * (g.x - x);
                if (behind < -1.5 || behind > 30) continue;
                h = Math.Max(h, g.h * Math.Sqrt(Math.Max(0, 1 - behind / 30)) * Smooth(-1.5, 1.5, behind) * (1 - Smooth(0.75, 1, g.q)));
            }
            return h;
        }

        // 一層：貼地最亮（從內部照亮），往破碎的頂變暗變紫，細細分層，邊緣一圈淡色
        static void DrawSheet(Painter p, uint[] C, Sheet sh, int si, double E, double t, int seed)
        {
            double ph = t / D; var T = Tongues(sh, si, E, ph); int d = sh.dim; double X = Math.Ceiling(E * 1.25);
            void Column(double x)
            {
                double H = Height(sh, si, E, x + 0.5, ph, T, seed);
                if (H < 0.6) return;
                double top = -Round(H);
                for (double y = top; y <= 1; y++)
                {
                    double sgn = x != 0 ? Sign(x) : 1;
                    double v = Clamp(-y / H), streak = 0.7 + 0.3 * TileNoise(x * 0.05 - ph * sh.flow * sgn, y * 0.55, sh.flow, 0, seed + 9 + si);
                    double lv = v - (streak - 0.7) * 0.6;
                    uint c = y == top ? C[Math.Max(1, 4 - d)] : lv < 0.16 ? C[6 - d] : lv < 0.42 ? C[5 - d] : lv < 0.68 ? C[4 - d] : C[Math.Max(1, 3 - d)];
                    p.Blend(x, y, c, sh.a * (y == top ? 0.65 : (0.6 + 0.4 * (1 - v)) * streak));
                }
            }
            // 每一欄（整數 x）只畫到畫面上自己那一欄（沒旋轉時），各欄互不影響：切成幾段同時畫，結果跟一欄一欄畫一樣
            int nx = (int)(2 * X) + 1;
            if (!p.Straight) { for (double x = -X; x <= X; x++) Column(x); }
            else
            {
                const int B = 8; int per = (nx + B - 1) / B;
                PixelFX.Par.For(B, b => { for (int i = b * per, e = Math.Min(nx, i + per); i < e; i++) Column(-X + i); });
            }
            // 氣舌前端往前爬時捲起來
            foreach (var g in T)
            {
                double k = Sin(Math.PI * g.q);
                if (k < 0.15 || g.h < 4) continue;
                double r = 1.8 + g.h * 0.22, cx = g.x - g.s * r * 0.6, cy = -g.h * 0.72, spin = -g.s * g.q * TAU * 2.2;
                // 一捲氣：一條厚厚的軟帶往內捲，外緣比較亮
                for (double a = 0; a < 4.6; a += 0.1)
                {
                    double rr = r * (1 - a * 0.12), px = cx + g.s * Cos(spin + a) * rr, py = cy + Sin(spin + a) * rr, w = 1.6 * (1 - a / 6);
                    for (double o = -w; o <= w; o += 0.8)
                    {
                        double qx = px + g.s * Cos(spin + a) * o, qy = py + Sin(spin + a) * o;
                        p.Blend(qx, qy, o > w * 0.4 ? C[5 - d] : C[4 - d], sh.a * 0.75 * k * (1 - a / 5.5));
                    }
                }
            }
        }

        // 煙柱：從氣層升起、扭成緞帶，越高越細
        static void Plumes(Painter p, uint[] C, double E, double t, int seed)
        {
            Sim.Cycle(t, D, 5, seed, g => g.Range(2.4, 3.2), (age, L, R, i) =>
            {
                double u = age / L, x0 = R.Range(-0.55, 0.55) * E, rise = R.Range(13, 19), len = R.Range(34, 48), ph = R.Range(0, TAU), amp = R.Range(3, 5);
                double head = 14 + rise * age, tail = Math.Max(10, head - len), fade = Smooth(0, 0.15, u) * (1 - Smooth(0.5, 1, u));
                for (double h = tail; h <= head; h += 0.7)
                {
                    double s = (h - tail) / Math.Max(1, head - tail), tw = Cos(h * 0.22 + age * 2.4 + ph), w = 0.6 + 2.2 * Math.Abs(tw) * (1 - s * 0.5);
                    double x = x0 + amp * Sin(h * 0.12 + age + ph) * (0.4 + s), a = fade * Sin(Math.PI * Math.Min(1, s * 1.2)) * 0.32;
                    for (double o = -w; o <= w; o += 1) p.Blend(x + o, -h, tw > 0 ? (Math.Abs(o) < w * 0.5 ? C[6] : C[5]) : Math.Abs(o) < w * 0.5 ? C[3] : C[2], a);
                }
            });
        }

        // 跟著氣流往外飄的小亮點，閃爍
        static void Specks(Painter p, uint[] C, double E, double t, int seed)
        {
            Sim.Cycle(t, D, 30, seed, g => g.Range(1.5, 2.6), (age, L, R, i) =>
            {
                double u = age / L, s = R.Sign();
                double x = s * (R.Range(0.05, 0.7) * E + age * R.Range(6, 14));
                double y = -R.Range(2, 20) - Sin(age * R.Range(1.5, 3) + R.Next() * TAU) * 2;
                double a = Math.Min(1, u * 5) * Math.Min(1, (1 - u) * 3) * (0.6 + 0.4 * Sin(age * R.Range(6, 10) + R.Next() * TAU));
                if (a < 0.1) return;
                p.Dot(x, y, a > 0.7 ? C[7] : C[6], a * 1.3);
                p.Glow(x, y, 4, C[6], 0.3 * a);
            });
        }

        public static void DrawBack(Painter p, double t, FxOptions o)
        {
            uint[] C = Col.Fit(o.Palette, 8); double E = 96 * o["spread"], pulse = 0.85 + 0.15 * Sin((TAU * t * 2) / D);
            // 從內部、低處照亮：沿地面一道柔光
            for (double x = -E; x <= E; x += 22) p.Glow(x, -3, 30, C[5], 0.14 * pulse * (1 - Math.Abs(x) / (E * 1.3)));
            // 在裡面低處遊走的光團
            for (int i = 0; i < 6; i++)
            {
                var R = Rng.Of(o.SeedOr0, i, 7);
                double x = Sin((TAU * t) / D + R.Range(0, TAU)) * E * R.Range(0.2, 0.7) + R.Range(-0.3, 0.3) * E, k = 0.6 + 0.4 * Sin((TAU * t * 3) / D + i);
                p.Glow(x, -R.Range(4, 10), R.Range(14, 22), C[6], 0.2 * k);
            }
            for (int i = 0; i < SHEETS.Length; i++) if (SHEETS[i].back) DrawSheet(p, C, SHEETS[i], i, E, t, o.SeedOr0);
        }

        public static void Draw(Painter p, double t, FxOptions o)
        {
            uint[] C = Col.Fit(o.Palette, 8); double E = 96 * o["spread"];
            Plumes(p, C, E, t, o.SeedOr0 * 7 + 2);
            for (int i = 0; i < SHEETS.Length; i++) if (!SHEETS[i].back) DrawSheet(p, C, SHEETS[i], i, E, t, o.SeedOr0);
            Specks(p, C, E, t, o.SeedOr0 * 11 + 5);
            p.Glow(0, -6, E * 0.9, C[5], 0.1);
        }
    }
}
