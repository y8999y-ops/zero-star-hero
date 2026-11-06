// game/src/coreart.js 翻成 C#：地上的魔物核（結晶球、光、繞著轉的光點）與長按吸收時拉到主角身上的光。
using System;
using System.Collections.Generic;
using System.Linq;
using PixelFX;

namespace ZeroStar
{
    public static class CoreArt
    {
        const double TAU = Math.PI * 2;
        static readonly Dictionary<string, uint[]> PX = new Dictionary<string, string[]>
        {
            ["slime"] = new[] { "#0c2010", "#1a4a20", "#2a8a3a", "#4cc04a", "#8ee86a", "#d4ffb0", "#ffffff" },
            ["bat"] = new[] { "#160c24", "#2e1a4a", "#5c388c", "#8058b8", "#b48ae8", "#e2d0ff", "#ffffff" },
            ["can"] = new[] { "#0e1626", "#203048", "#3a5a80", "#5a8ab8", "#8ac0e8", "#d0ecff", "#ffffff" },
            ["star"] = new[] { "#1e1206", "#4a2c08", "#86520c", "#c48412", "#f0b424", "#ffe066", "#ffffff" },
            ["spike"] = new[] { "#2a1206", "#6a3010", "#a85a1c", "#e09a3a", "#ffd890", "#fff2d0", "#ffffff" },
        }.ToDictionary(kv => kv.Key, kv => kv.Value.Select(Col.Hex).ToArray());
        static readonly Dictionary<string, string[]> EMBLEM = new Dictionary<string, string[]>
        {
            ["slime"] = new[] { "...a...", "...a...", "..aba..", ".abbba.", ".abbba.", "..aaa..", "......." },
            ["can"] = new[] { "..aaa..", ".abbba.", "abbabba", "abaaaba", "abbabba", ".abbba.", "..aaa.." },
            ["bat"] = new[] { "a.....a", "aa...aa", "abaaaba", "abbabba", ".aabaa.", "...a...", "......." },
            ["star"] = new[] { "...a...", "..aba..", "aabbbaa", ".abbba.", ".ab.ba.", "a.....a", "......." },
            ["spike"] = new[] { "a..a..a", ".aabaa.", ".abbba.", "aabbbaa", ".abbba.", ".aabaa.", "a..a..a" },
        };
        static void Put(Frame f, double x, double y, uint c)
        {
            int X = (int)Pf.Round(x) - f.Ox, Y = (int)Pf.Round(y) - f.Oy;
            if (X >= 0 && Y >= 0 && X < f.W && Y < f.H) f.Color[Y * f.W + X] = c;
        }
        /// 只加光（不蓋顏色），越外面越淡
        static void Glow(Frame f, double cx, double cy, double rx, double ry, uint c, double k)
        {
            uint r = c & 255, g = (c >> 8) & 255, b = (c >> 16) & 255;
            for (double dy = -ry; dy <= ry; dy++) for (double dx = -rx; dx <= rx; dx++)
            {
                double d = Pf.Hypot(dx / rx, dy / ry); if (d > 1) continue;
                int X = (int)Pf.Round(cx + dx) - f.Ox, Y = (int)Pf.Round(cy + dy) - f.Oy;
                if (X < 0 || Y < 0 || X >= f.W || Y >= f.H) continue;
                int i = Y * f.W + X; uint o = f.Light[i]; double fk = Pf.Pow(1 - d, 2) * k;
                f.Light[i] = (uint)(unchecked((int)0xff000000) | (Pf.ToInt32(Math.Min(255, ((o >> 16) & 255) + b * fk)) << 16) | (Pf.ToInt32(Math.Min(255, ((o >> 8) & 255) + g * fk)) << 8) | Pf.ToInt32(Math.Min(255, (o & 255) + r * fk)));
            }
        }

        /// 地上的魔物核：(x, y)＝落地點；hold＝長按進度 0～1；回傳球心
        public static (double, double) Draw(Frame f, double x, double y, double t, string form, double hold)
        {
            var C = PX.TryGetValue(form, out var cc) ? cc : PX["star"]; double bob = Pf.Sin(t * 2.6) * 1.5;
            double cx = Pf.Round(x), cy = Pf.Round(y - 13 - bob - hold * 9);
            double pulse = 0.5 + 0.5 * Pf.Sin(t * 3.2);
            Glow(f, x, y - 1, 13, 3, C[4], 0.35 + pulse * 0.15);
            Glow(f, cx, cy, 15 + hold * 6, 15 + hold * 6, C[4], 0.32 + pulse * 0.12 + hold * 0.5);
            void Orbit(bool front)
            {
                for (int i = 0; i < 5; i++)
                {
                    double a = t * (1.8 + hold * 6) + (i * TAU) / 5; bool behind = Pf.Sin(a) < 0;
                    if (behind == front) continue;
                    double r = 12 - hold * 4, ox = Pf.Cos(a) * r, oy = Pf.Sin(a) * r * 0.35 - Pf.Cos(a) * 2 - 1;
                    Put(f, cx + ox, cy + oy, front ? C[6] : C[3]);
                    if (front) { Put(f, cx + ox - Math.Sign(Pf.Cos(a + 0.3)), cy + oy, C[5]); Glow(f, cx + ox, cy + oy, 2, 2, C[5], 0.5); }
                }
            }
            Orbit(false);
            const int R = 8;
            for (int dy = -R - 1; dy <= R + 1; dy++) for (int dx = -R - 1; dx <= R + 1; dx++)
            {
                double d = Pf.Hypot(dx, dy);
                if (d > R + 0.6) continue;
                uint c;
                if (d > R - 0.4) c = C[0];
                else
                {
                    double l = (-dx - dy) / (R * 1.4);
                    c = l > 0.55 ? C[5] : l > 0.15 ? C[4] : l > -0.35 ? C[3] : C[2];
                    if (d > R - 1.6 && l < -0.2) c = C[1];
                }
                Put(f, cx + dx, cy + dy, c);
            }
            var E = EMBLEM.TryGetValue(form, out var ee) ? ee : EMBLEM["star"]; double sx = Pf.Round(Pf.Sin(t * (hold > 0 ? 14 : 0)) * hold * 1.5);
            for (int j = 0; j < E.Length; j++) for (int i = 0; i < E[j].Length; i++) { char ch = E[j][i]; if (ch != '.') Put(f, cx - 3 + i + sx, cy - 3 + j, ch == 'a' ? C[1] : C[6]); }
            Put(f, cx - 4, cy - 4, C[6]); Put(f, cx - 3, cy - 5, C[6]); Put(f, cx - 5, cy - 3, C[5]);
            double sw = (t % 1.6) / 1.6;
            if (sw < 0.3) { double k = -R + (sw / 0.3) * R * 2; Glow(f, cx + k * 0.8, cy - k * 0.4, 4, 4, C[6], 0.7); }
            Orbit(true);
            for (int i = 0; i < 2; i++) { double p = (t * 0.5 + i * 0.5) % 1; Put(f, cx + Pf.Sin(p * 7 + i * 3) * 4, cy - 8 - p * 14, p < 0.6 ? C[5] : C[3]); }
            if (hold > 0)
            {
                for (int k = 0; k < 2; k++)
                {
                    double ph = (t * 2.4 + k * 0.5) % 1, r = 20 * (1 - ph) + 4;
                    for (double a = 0; a < TAU; a += 0.05) Put(f, cx + Pf.Cos(a) * r, cy + Pf.Sin(a) * r, ph > 0.7 ? C[6] : C[4]);
                }
            }
            return (cx, cy);
        }

        /// 長按時：幾道光從球拉到主角
        public static void DrawBeams(Frame f, double ax, double ay, double bx, double by, double t, string form, double hold)
        {
            var C = PX.TryGetValue(form, out var cc) ? cc : PX["star"]; int n = 3; double len = Pf.Hypot(bx - ax, by - ay), steps = Math.Max(8, Math.Ceiling(len));
            for (int s = 0; s < n; s++)
            {
                double amp = (4 + s * 2) * (1 - hold * 0.6), ph = t * 9 + s * 2.1;
                for (int i = 0; i <= steps; i++)
                {
                    double q = i / steps, w = Pf.Sin(q * Math.PI) * Pf.Sin(q * 6 + ph) * amp;
                    double nx = -(by - ay) / len, ny = (bx - ax) / len, x = ax + (bx - ax) * q + nx * w, y = ay + (by - ay) * q + ny * w;
                    bool run = ((q - t * 2.2 - s * 0.3) % 0.25 + 0.25) % 0.25 < 0.04;
                    if (run) { Put(f, x, y, C[6]); Put(f, x, y - 1, C[5]); Glow(f, x, y, 3, 3, C[5], 0.7); }
                    else Put(f, x, y, C[3 + Math.Min(2, (int)Math.Floor(hold * 3))]);
                }
            }
            Glow(f, bx, by, 10, 10, C[4], 0.25 + hold * 0.35);
        }
    }
}
