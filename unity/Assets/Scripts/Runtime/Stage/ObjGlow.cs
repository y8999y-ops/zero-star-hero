// game/src/objglow.js 一行一行翻成 C#：重要物件的發光粒子（drawObjGlow）。
//   ember 金色火星往上竄　fossil 形態色光點繞著轉　stele 淡金色小方塊（字光）慢慢升起
//   altarOff 灰藍微光、稀疏　altarOn 金色、多一點　chest 寶箱周圍一閃一閃的星光　portal 紫色旋臂（遊戲裡沒用）
// (x, y)＝物件底部中心（世界座標），t＝秒；已經拿過的東西不要呼叫。
using System;
using System.Collections.Generic;
using PixelFX;

namespace ZeroStar
{
    public static class ObjGlow
    {
        const double TAU = Math.PI * 2;
        static double Hash(double i, double k)
        {
            uint h = unchecked((uint)Pf.ToInt32(i * 374761393 + k * 668265263));
            h = unchecked((uint)(((int)h ^ (int)(h >> 13)) * 1274126177));
            return (h ^ (h >> 16)) / 4294967296.0;
        }
        static int[] HexC(string h) { int n = Convert.ToInt32(h.Substring(1), 16); return new[] { (n >> 16) & 255, (n >> 8) & 255, n & 255 }; }
        static uint Pack(int[] c) => 0xff000000u | ((uint)c[2] << 16) | ((uint)c[1] << 8) | (uint)c[0];
        static int[] Mix(int[] a, int[] b, double t) => new[] { (int)Pf.Round(a[0] + (b[0] - a[0]) * t), (int)Pf.Round(a[1] + (b[1] - a[1]) * t), (int)Pf.Round(a[2] + (b[2] - a[2]) * t) };
        /// 一個顏色 → [暗, 本色, 亮, 白]
        static int[][] RampOf(string hex) { var c = HexC(hex); return new[] { Mix(new[] { 16, 12, 28 }, c, 0.55), c, Mix(c, new[] { 255, 255, 255 }, 0.55), new[] { 255, 255, 255 } }; }
        class Pal { public uint[] c; public int[][] rgb; }
        static readonly Dictionary<string, Pal> CACHE = new Dictionary<string, Pal>();
        static Pal R(string hex)
        {
            if (!CACHE.TryGetValue(hex, out var p)) { var r = RampOf(hex); p = new Pal { c = Array.ConvertAll(r, Pack), rgb = r }; CACHE[hex] = p; }
            return p;
        }
        static readonly Dictionary<string, string> COL = new Dictionary<string, string> { ["ember"] = "#ffb030", ["altarOff"] = "#7a94c8", ["altarOn"] = "#ffd060", ["portal"] = "#c684ff", ["chest"] = "#ffe27a", ["stele"] = "#ffe8a0", ["fossil"] = "#b878ff" };
        static readonly Dictionary<string, double[]> AURA = new Dictionary<string, double[]> { ["ember"] = new double[] { 12, 16, 0.5 }, ["fossil"] = new double[] { 8, 14, 0.45 }, ["stele"] = new double[] { 18, 18, 0.3 }, ["altarOff"] = new double[] { 16, 14, 0.18 }, ["altarOn"] = new double[] { 18, 22, 0.4 }, ["portal"] = new double[] { 34, 22, 0.3 }, ["chest"] = new double[] { 8, 18, 0.3 } };

        /// 粒子循環：n 顆，每顆有自己的壽命和起始相位，回呼 (age, life, i, r)；r(k) 是這一輪的亂數
        static void Each(double t, int n, int seed, double lo, double hi, Action<double, double, int, Func<int, double>> fn)
        {
            for (int i = 0; i < n; i++)
            {
                double life = lo + Hash(i, seed) * (hi - lo), off = Hash(i, seed + 1) * life;
                double loop = Math.Floor((t + off) / life);   // 每一輪換一組隨機值
                int ii = i;
                fn((t + off) % life, life, i, k => Hash(ii * 131 + loop, seed + 7 + k));
            }
        }

        public static void Draw(Frame frame, string kind, double x, double y, double t, string color = null)
        {
            int W = frame.W, H = frame.H; var Cb = frame.Color; var L = frame.Light; int ox = frame.Ox, oy = frame.Oy;
            if (x - ox < -60 || x - ox > W + 60) return;
            var P = R(color ?? COL[kind]); var C = P.c; var rgb = P.rgb;
            void Put(double px, double py, uint c) { int X = (int)Pf.Round(px) - ox, Y = (int)Pf.Round(py) - oy; if (X >= 0 && Y >= 0 && X < W && Y < H) Cb[Y * W + X] = c; }
            void Glow(double px, double py, int r, double a)
            {
                int cx = (int)Pf.Round(px) - ox, cy = (int)Pf.Round(py) - oy; int cr = rgb[1][0], cg = rgb[1][1], cbb = rgb[1][2];
                for (int dy = -r; dy <= r; dy++) for (int dx = -r; dx <= r; dx++)
                    {
                        int X = cx + dx, Y = cy + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
                        double f = 1 - Pf.Hypot(dx, dy) / (r + 0.5); if (f <= 0) continue;
                        int i = Y * W + X; uint d = L[i]; double k = f * f * a;
                        L[i] = 0xff000000u | ((uint)Pf.ToInt32(Math.Min(255, ((d >> 16) & 255) + cbb * k)) << 16) | ((uint)Pf.ToInt32(Math.Min(255, ((d >> 8) & 255) + cg * k)) << 8) | (uint)Pf.ToInt32(Math.Min(255, (d & 255) + cr * k));
                    }
            }
            void Glint(double px, double py, int s, double a) { Put(px, py, C[3]); for (int k = 1; k <= s; k++) { uint c = k == s ? C[1] : C[2]; Put(px + k, py, c); Put(px - k, py, c); Put(px, py + k, c); Put(px, py - k, c); } Glow(px, py, 3, 0.5 * a); }
            // 每樣東西身後都有一團會呼吸的柔光（只加在光層）
            if (AURA.TryGetValue(kind, out var au)) Glow(x, y - au[0], (int)au[1], au[2] * (0.8 + 0.2 * Pf.Sin(t * 2.4)));
            double Fade(double age, double life, double inn = 0.25, double outT = 0.4) => Math.Max(0, Math.Min(Math.Min(1, age / inn), (life - age) / outT));

            if (kind == "ember")
            {
                // 火星：從殘火往上竄，左右擺，越上面越暗；三格的小尾巴
                Each(t, 9, 11, 0.7, 1.3, (age, life, i, r) =>
                {
                    double k = Fade(age, life, 0.1, 0.35), x0 = x + (r(0) - 0.5) * 10, vy = 22 + r(1) * 26;
                    double px = x0 + Pf.Sin(age * (4 + r(2) * 4) + r(3) * TAU) * 2, py = y - 12 - vy * age;
                    if (k < 0.2) return;
                    if (r(4) < 0.18) { Glint(px, py, 1, k); return; }
                    Put(px, py, k > 0.7 ? C[3] : C[2]); if (k > 0.45) Put(px, py + 1, C[1]); if (k > 0.7) Put(px, py + 2, C[0]);
                    Glow(px, py, 3, 0.45 * k);
                });
            }
            else if (kind == "fossil")
            {
                // 繞著化石核轉的光點：後面那半圈暗、前面那半圈亮，慢慢往上
                Each(t, 10, 23, 1.6, 2.6, (age, life, i, r) =>
                {
                    double th = r(0) * TAU + age * (1.8 + r(1)), Rr = 11 + r(2) * 7, s = Pf.Sin(th), k = Fade(age, life, 0.3, 0.5);
                    double px = x + Pf.Cos(th) * Rr, py = y - 8 + s * Rr * 0.3 - age * 4 + (r(3) - 0.5) * 6;
                    if (s < 0) { Put(px, py, C[0]); return; }
                    Put(px, py, i % 2 == 0 ? C[3] : C[2]);
                    if (i % 2 == 0 && k > 0.5) { Put(px + 1, py, C[1]); Put(px - 1, py, C[1]); Put(px, py - 1, C[1]); Put(px, py + 1, C[1]); }
                    Glow(px, py, 3, 0.4 * k);
                });
            }
            else if (kind == "stele")
            {
                // 字光：碑面上浮起淡金色的小方塊，慢慢升、輕輕閃
                Each(t, 8, 37, 2.2, 3.4, (age, life, i, r) =>
                {
                    double k = Fade(age, life, 0.6, 0.9), px = x + (r(0) - 0.5) * 16, py = y - 12 - r(1) * 18 - age * 11;
                    if (k < 0.15) return;
                    double tw = 0.6 + 0.4 * Pf.Sin(age * 5 + r(2) * TAU); uint c = k * tw > 0.6 ? C[2] : C[1];
                    if (r(3) < 0.5) { Put(px, py, c); Put(px + 1, py, c); } else { Put(px, py, c); Put(px, py + 1, c); }
                    Glow(px, py, 3, 0.45 * k * tw);
                });
            }
            else if (kind == "altarOff" || kind == "altarOn")
            {
                // 祭壇：沒點亮時零星的灰藍光點慢慢漂；點亮後金色光點從底座往上流，偶爾一顆閃十字
                bool on = kind == "altarOn"; int n = on ? 9 : 6;
                Each(t, n, on ? 41 : 43, on ? 1.4 : 2.4, on ? 2.2 : 3.6, (age, life, i, r) =>
                {
                    double k = Fade(age, life, 0.3, 0.6), side = r(0) < 0.5 ? -1 : 1, x0 = x + side * (3 + r(1) * 9);
                    double px = x0 + Pf.Sin(age * 2 + r(2) * TAU) * 1.5, py = y - 6 - age * (on ? 16 : 7) - r(3) * 6;
                    if (k < 0.15) return;
                    if (on && r(4) < 0.15) { Glint(px, py, 1, k); return; }
                    Put(px, py, on ? (k > 0.6 ? C[3] : C[2]) : C[2]); if (on && k > 0.5) Put(px, py + 1, C[1]);
                    Glow(px, py, on ? 4 : 3, (on ? 0.4 : 0.35) * k);
                });
            }
            else if (kind == "portal")
            {
                // 傳送門：兩條旋臂，光點沿著螺旋線被吸進中心，帶 3 格尾巴
                double cx = x, cy = y - 34;
                Each(t, 14, 53, 1.0, 1.4, (age, life, i, r) =>
                {
                    double e = age / life; int arm = i % 2; double rr = 22 * (1 - e) + 2, a = arm * Math.PI + e * 4.2 + (r(1) - 0.5) * 0.5;
                    double k = Math.Min(1, e * 5) * (e > 0.92 ? (1 - e) / 0.08 : 1);
                    (double, double) At(int q) { double aa = a - q * 0.18, r2 = rr + q * 2.2; return (cx + Pf.Cos(aa) * r2 * 0.75, cy + Pf.Sin(aa) * r2 * 1.3); }
                    var (px, py) = At(0);
                    Put(px, py, e > 0.5 ? C[3] : C[2]);
                    for (int q = 1; q <= 3; q++) { var (tx, ty) = At(q); Put(tx, ty, q == 1 ? C[2] : q == 2 ? C[1] : C[0]); }
                    Glow(px, py, 3, 0.45 * k);
                });
                if ((t * 1.3) % 1 < 0.1) Glint(cx, cy, 2, 1);
            }
            else if (kind == "chest")
            {
                // 寶箱：箱子周圍一閃一閃的星光，加幾顆慢慢往上的光點
                Each(t, 5, 61, 0.9, 1.8, (age, life, i, r) =>
                {
                    double e = age / life; if (e > 0.35) return;
                    double s = Pf.Sin((e / 0.35) * Math.PI), px = x + (r(0) - 0.5) * 30, py = y - 4 - r(1) * 22;
                    Glint(px, py, s > 0.7 ? 2 : 1, s);
                });
                Each(t, 4, 67, 1.8, 2.8, (age, life, i, r) =>
                {
                    double k = Fade(age, life, 0.4, 0.6), px = x + (r(0) - 0.5) * 22, py = y - 8 - age * 8;
                    if (k > 0.2) { Put(px, py, C[2]); Glow(px, py, 3, 0.3 * k); }
                });
            }
        }
    }
}
