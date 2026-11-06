// game/src/deathfx.js 一行一行翻成 C#：主角死亡與重生的演出（自己的亂數，不用 Math.random）。
//   碎掉（Shatter）：一格白色亮框 → 星星碎成十幾片碎片往外噴、受重力翻滾、閃一閃消失；八道短光芒往外射。
//   重生（Regather）：碎片從四周繞著飛回祭壇的那一點 → 一道光柱打下來 → 地上一圈光點散開。顏色跟著目前的形態。
using System;
using System.Collections.Generic;
using PixelFX;

namespace ZeroStar
{
    public class DeathFx
    {
        const double TAU = Math.PI * 2;
        static int[] HexC(string h) { int n = Convert.ToInt32(h.Substring(1), 16); return new[] { (n >> 16) & 255, (n >> 8) & 255, n & 255 }; }
        static uint Pack(int[] c) => 0xff000000u | ((uint)c[2] << 16) | ((uint)c[1] << 8) | (uint)c[0];
        static int[] MixRGB(int[] a, int[] b, double t) => new[] { (int)Pf.Round(a[0] + (b[0] - a[0]) * t), (int)Pf.Round(a[1] + (b[1] - a[1]) * t), (int)Pf.Round(a[2] + (b[2] - a[2]) * t) };
        /// 形態顏色 → 5 階（暗 → 白）
        public static uint[] RampOf(string hex)
        {
            int[] c = HexC(hex), dark = { 20, 14, 32 }, w = { 255, 255, 255 };
            return new[] { MixRGB(dark, c, 0.35), MixRGB(dark, c, 0.7), c, MixRGB(c, w, 0.5), w }.Select2(Pack);
        }
        // 碎片的形狀（相對中心的點，值＝明暗：3 亮面、2 本色、1 暗邊），翻滾時輪流換
        static readonly int[][][] SHAPES =
        {
            new[] { new[] { 0, -1, 3 }, new[] { -1, 0, 3 }, new[] { 0, 0, 2 }, new[] { 1, 0, 2 }, new[] { 0, 1, 1 } },
            new[] { new[] { 0, -2, 3 }, new[] { 0, -1, 3 }, new[] { -1, 0, 3 }, new[] { 0, 0, 2 }, new[] { 1, 0, 2 }, new[] { 0, 1, 2 }, new[] { 0, 2, 1 } },
            new[] { new[] { -1, -1, 3 }, new[] { 0, -1, 3 }, new[] { -1, 0, 2 }, new[] { 0, 0, 2 }, new[] { 1, 0, 1 }, new[] { 0, 1, 1 } },
            new[] { new[] { 0, -1, 3 }, new[] { 1, -1, 3 }, new[] { -1, 0, 2 }, new[] { 0, 0, 2 }, new[] { 1, 0, 2 }, new[] { -1, 1, 1 }, new[] { 0, 1, 1 } },
        };
        static readonly int[] BAYER = { 0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5 };
        static bool Dither(double x, double y, double a) => a * 16 > BAYER[((Pf.ToInt32(y) & 3) << 2) | (Pf.ToInt32(x) & 3)];

        public class Shard { public double x, y, vx, vy, spin, life, floor; public int s, bounced; }
        public class Mote { public double a, r, d; }
        public class It { public string k; public double x, y, t, dur; public uint[] R; public List<Shard> shards; public List<Mote> motes; }
        public readonly List<It> Items = new List<It>();
        double seed = 1;
        double Rnd() => (seed = (seed * 16807) % 2147483647) / 2147483647;

        public void Shatter(double x, double y, string color)
        {
            var R = RampOf(color); var shards = new List<Shard>();
            for (int i = 0; i < 11; i++)
            {
                double a = -Math.PI / 2 + ((i + Rnd() * 0.6) / 11 - 0.5) * Math.PI * 1.6, sp = 55 + Rnd() * 75;
                var s = new Shard { x = x + Pf.Cos(a) * 4, y = y - 12 + Pf.Sin(a) * 4, vx = Pf.Cos(a) * sp, vy = Pf.Sin(a) * sp - 70 };
                s.s = (int)Math.Floor(Rnd() * 4); s.spin = 5 + Rnd() * 7; s.life = 0.6 + Rnd() * 0.35; s.floor = y; s.bounced = 0;
                shards.Add(s);
            }
            Items.Add(new It { k = "shatter", x = x, y = y - 12, t = 0, R = R, shards = shards, dur = 1 });
        }
        public void Regather(double x, double y, string color)
        {
            var R = RampOf(color); var motes = new List<Mote>();
            for (int i = 0; i < 12; i++) { var m = new Mote(); m.a = (i / 12.0) * TAU + Rnd() * 0.3; m.r = 34 + Rnd() * 14; m.d = Rnd() * 0.12; motes.Add(m); }
            Items.Add(new It { k = "regather", x = x, y = y, t = 0, R = R, motes = motes, dur = 1.15 });
        }
        public void Update(double dt)
        {
            foreach (var it in Items)
            {
                it.t += dt;
                if (it.k == "shatter") foreach (var s in it.shards)
                    {
                        s.vy += 430 * dt; s.vx *= 1 - 1.1 * dt; s.x += s.vx * dt; s.y += s.vy * dt;
                        if (s.y > s.floor - 1 && s.vy > 0) { s.y = s.floor - 1; s.vy *= -0.35; s.vx *= 0.6; s.spin *= 0.5; s.bounced++; }   // 落地彈一下
                    }
            }
            for (int i = Items.Count - 1; i >= 0; i--) if (Items[i].t >= Items[i].dur) Items.RemoveAt(i);
        }
        public void Draw(Frame frame)
        {
            int W = frame.W, H = frame.H; var C = frame.Color; var L = frame.Light; int ox = frame.Ox, oy = frame.Oy;
            void Put(double x, double y, uint c) { int X = (int)Pf.Round(x) - ox, Y = (int)Pf.Round(y) - oy; if (X >= 0 && Y >= 0 && X < W && Y < H) C[Y * W + X] = c; }
            void Glow(double x, double y, double v)
            {
                int X = (int)Pf.Round(x) - ox, Y = (int)Pf.Round(y) - oy; if (X < 0 || Y < 0 || X >= W || Y >= H) return;
                int i = Y * W + X; uint d = L[i];
                uint Add(int s) => (uint)Pf.ToInt32(Math.Min(255, ((d >> s) & 255) + v));
                L[i] = 0xff000000u | (Add(16) << 16) | (Add(8) << 8) | Add(0);
            }
            foreach (var it in Items)
            {
                double t = it.t; var R = it.R;
                if (it.k == "shatter")
                {
                    // 第 1～2 格：白色星形亮框＋四道短光芒
                    if (t < 0.09)
                    {
                        int rr = t < 0.045 ? 9 : 12;
                        for (int dy = -rr; dy <= rr; dy++) for (int dx = -rr; dx <= rr; dx++) { int d = Math.Abs(dx) + Math.Abs(dy); if (d <= rr * 0.75 || (dx == 0 || dy == 0) && Math.Abs(dx + dy) <= rr) { Put(it.x + dx, it.y + dy, d > rr * 0.55 ? R[3] : R[4]); Glow(it.x + dx, it.y + dy, 70); } }
                    }
                    // 八道往外射的短光芒（前段白、後段形態色）
                    if (t > 0.03 && t < 0.25)
                    {
                        double k = (t - 0.03) / 0.22, r0 = 5 + 20 * k, len = Pf.Round(8 * (1 - k)) + 2;
                        for (int q = 0; q < 8; q++) { double a = (q / 8.0) * TAU + 0.2, ca = Pf.Cos(a), sa = Pf.Sin(a) * 0.8; for (int d = 0; d < len; d++) { double px = it.x + ca * (r0 + d), py = it.y + sa * (r0 + d); Put(px, py, d < len / 2 ? R[4] : R[3]); Glow(px, py, 50); } }
                    }
                    // 碎片
                    foreach (var s in it.shards)
                    {
                        if (t > s.life) continue;
                        double k = t / s.life; var shape = SHAPES[(s.s + (int)Math.Floor(t * s.spin)) % SHAPES.Length]; bool white = k < 0.12;
                        if (k > 0.7 && Math.Floor(t * 24 + s.s) % 3 == 0) continue;   // 最後一段閃爍消失
                        foreach (var q in shape) Put(s.x + q[0], s.y + q[1], white ? R[4] : R[q[2]]);
                        Glow(s.x, s.y, 55 * (1 - k));
                        if ((Math.Floor(t * 16) + s.s) % 9 == 0) { Put(s.x - 2, s.y, R[4]); Put(s.x + 2, s.y, R[4]); Put(s.x, s.y - 2, R[4]); }   // 偶爾閃一下（十字光）
                    }
                }
                else
                {
                    // 光點繞著飛回中心（0～0.5 秒，越近越快）：2×2 亮點＋三格尾巴
                    double cx = it.x, cy = it.y - 12;
                    foreach (var m in it.motes)
                    {
                        double k = Math.Max(0, Math.Min(1, (t - m.d) / 0.48));
                        if (k >= 1) continue;
                        double e = k * k, r = m.r * (1 - e), a = m.a + e * 2.4;
                        double px = cx + Pf.Cos(a) * r, py = cy + Pf.Sin(a) * r * 0.85;
                        foreach (var (dx, dy) in new[] { (0, 0), (1, 0), (0, 1), (1, 1) }) Put(px + dx, py + dy, dx + dy == 0 ? R[4] : R[3]);
                        Glow(px, py, 80);
                        for (int q = 1; q <= 3; q++) { double pa = a - q * 0.12, pr = r + q * 2; Put(cx + Pf.Cos(pa) * pr, cy + Pf.Sin(pa) * pr * 0.85, q == 1 ? R[3] : R[2]); }
                    }
                    if (t > 0.5 && t < 0.58) for (int dy = -4; dy <= 4; dy++) for (int dx = -4; dx <= 4; dx++) if (Math.Abs(dx) + Math.Abs(dy) <= 4) { Put(cx + dx, cy + dy, R[4]); Glow(cx + dx, cy + dy, 90); }   // 聚成一點的閃光
                    // 光柱：0.42～0.5 先垂下一條細線，0.5 砰地變寬，之後慢慢變細消失
                    if (t > 0.42 && t < 1.05)
                    {
                        bool pre = t < 0.5; double k = pre ? 0 : (t - 0.5) / 0.55, half = pre ? 0 : Math.Max(0, Pf.Round(6 * Pf.Pow(1 - k, 1.5)));
                        double bottom = it.y, top = pre ? Pf.Round(bottom - (bottom - oy) * ((t - 0.42) / 0.08)) : oy;
                        for (double y = top; y <= bottom; y++) for (double dx = -half - 2; dx <= half + 2; dx++)
                            {
                                double ad = Math.Abs(dx);
                                if (pre) { if (dx == 0) { Put(it.x, y, R[3]); Glow(it.x, y, 40); } continue; }
                                uint c; double g;
                                bool band = ((Pf.ToInt32(y) + Pf.ToInt32(Math.Floor(t * 90))) & 7) < 2;   // 往上捲動的掃描帶
                                if (ad <= Math.Max(0, half - 3)) { c = band ? R[3] : R[4]; g = 100; }
                                else if (ad <= half - 1) { c = R[3]; g = 60; }
                                else if (ad <= half) { c = R[2]; g = 40; }
                                else { if (!Dither(it.x + dx, y, 0.45 * (1 - k))) continue; c = R[2]; g = 25; }
                                Put(it.x + dx, y, c); Glow(it.x + dx, y, g);
                            }
                        // 打到地面：一條亮線往兩邊散開＋光點彈起來
                        if (!pre)
                        {
                            double spread = 6 + k * 30;
                            for (double dx = -spread; dx <= spread; dx++) if (Dither(Pf.Round(it.x + dx), bottom, (1 - k) * (1 - Math.Abs(dx) / (spread + 1)))) { Put(it.x + dx, bottom - 1, R[3]); Glow(it.x + dx, bottom - 1, 40); }
                            foreach (int sgn in new[] { -1, 1 }) for (int j = 0; j < 3; j++) { double px = it.x + sgn * (8 + j * 7 + k * 18), py = bottom - 2 - Pf.Round(Pf.Sin(Math.Min(1, k * 2 + j * 0.2) * Math.PI) * (6 + j * 3)); if (k < 0.8) { Put(px, py, R[4]); Glow(px, py, 50); } }
                        }
                    }
                }
            }
        }
        public bool Busy() => Items.Count > 0;
    }

    static class ArrExt { public static TOut[] Select2<TIn, TOut>(this TIn[] a, Func<TIn, TOut> f) { var o = new TOut[a.Length]; for (int i = 0; i < a.Length; i++) o[i] = f(a[i]); return o; } }
}
