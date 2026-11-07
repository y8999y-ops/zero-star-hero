// game/src/bake.js 的 blit、blitScaled、play 翻成 C#：把烘焙好的動畫貼到畫布上（運算順序照 JS，每個像素一樣）。
using System;
using PixelFX;

namespace ZeroStar
{
    public static class Blit
    {
        static readonly double[] BAYER = Make();
        static double[] Make()
        {
            int[] v = { 0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5 };
            var r = new double[16];
            for (int i = 0; i < 16; i++) r[i] = (v[i] + 0.5) / 16;
            return r;
        }

        public static AnimFrame FrameAt(Anim a, double t)
        {
            int n = a.Frames.Length;
            int i = (int)Math.Floor(t * a.Fps);
            i = a.Loop ? ((i % n) + n) % n : Math.Min(n - 1, Math.Max(0, i));
            return a.Frames[i];
        }

        // 半透明：跟底下的顏色混合（JS 的 << 會先把小數截成整數）
        static uint Mix(uint c, uint d, double k)
        {
            double m = 1 - k;
            int r = Pf.ToInt32(((c >> 16) & 255) * k + ((d >> 16) & 255) * m) << 16;
            int g = Pf.ToInt32(((c >> 8) & 255) * k + ((d >> 8) & 255) * m) << 8;
            int b = Pf.ToInt32((c & 255) * k + (d & 255) * m);
            return (uint)((255 << 24) | r | g | b);
        }
        static uint AddLight(uint d, uint l) =>
            (uint)((255 << 24) | ((int)Math.Min(255, ((d >> 16) & 255) + ((l >> 16) & 255)) << 16) | ((int)Math.Min(255, ((d >> 8) & 255) + ((l >> 8) & 255)) << 8) | (int)Math.Min(255, (d & 255) + (l & 255)));

        /// 把動畫的第 t 秒貼到 frame 上，(x, y) 是特效原點的世界座標。alpha < 1 用網點淡出。
        public static void Draw(Frame frame, Anim anim, double t, double x, double y, bool flip = false, double alpha = 1)
        {
            var s = FrameAt(anim, t);
            if (s.W == 0) return;
            int W = frame.W, H = frame.H;
            uint[] C = frame.Color;
            int bx = (int)Pf.Round(x) - frame.Ox, by = (int)Pf.Round(y) - frame.Oy;
            // 顏色直接貼；光交給畫布（畫布在延後光暈時，會照順序跟光暈一起切條畫；顏色和光是分開的緩衝，結果一樣）
            for (int yy = 0; yy < s.H; yy++)
            {
                int py = by + s.Ly + yy;
                if (py < 0 || py >= H) continue;
                int row = yy * s.W, outp = py * W;
                for (int xx = 0; xx < s.W; xx++)
                {
                    int lx = s.Lx + xx, px = flip ? bx - lx - 1 : bx + lx;
                    if (px < 0 || px >= W) continue;
                    if (alpha < 1 && alpha <= BAYER[((py & 3) << 2) | (px & 3)]) continue;
                    uint c = s.Color[row + xx]; int j = outp + px;
                    if (c != 0)
                    {
                        uint a = c >> 24;
                        if (a == 255) C[j] = c;
                        else C[j] = Mix(c, C[j], a / 255.0);
                    }
                }
            }
            if (s.Light == null) return;
            int y0 = Math.Max(0, by + s.Ly), y1 = Math.Min(H - 1, by + s.Ly + s.H - 1);
            if (y0 > y1) return;
            uint[] L = frame.LightRaw; int oy = frame.Oy;
            frame.Push(new Frame.GlowCmd { kind = 3, x0 = 0, x1 = s.W - 1, y0 = y0 + oy, y1 = y1 + oy, rows = (ya, yb) =>
            {
                for (int py = ya - oy; py <= yb - oy; py++)
                {
                    int yy = py - by - s.Ly, row = yy * s.W, outp = py * W;
                    for (int xx = 0; xx < s.W; xx++)
                    {
                        int lx = s.Lx + xx, px = flip ? bx - lx - 1 : bx + lx;
                        if (px < 0 || px >= W) continue;
                        if (alpha < 1 && alpha <= BAYER[((py & 3) << 2) | (px & 3)]) continue;
                        uint l = s.Light[row + xx];
                        if (l != 0) { int j = outp + px; L[j] = AddLight(L[j], l); }
                    }
                }
            } });
        }

        /// 跟 Draw 一樣，但以原點（腳底）為中心縮放（受擊壓扁用）。最近鄰取樣。
        public static void DrawScaled(Frame frame, Anim anim, double t, double x, double y, bool flip, double sx, double sy)
        {
            if (sx == 1 && sy == 1) { Draw(frame, anim, t, x, y, flip); return; }
            var s = FrameAt(anim, t);
            if (s.W == 0) return;
            int W = frame.W, H = frame.H;
            uint[] C = frame.Color, L = frame.Light;
            int bx = (int)Pf.Round(x) - frame.Ox, by = (int)Pf.Round(y) - frame.Oy;
            int x0 = (int)Math.Floor(s.Lx * sx), x1 = (int)Math.Ceiling((s.Lx + s.W) * sx), y0 = (int)Math.Floor(s.Ly * sy), y1 = (int)Math.Ceiling((s.Ly + s.H) * sy);
            for (int dy = y0; dy < y1; dy++)
            {
                int py = by + dy, yy = (int)Math.Floor((dy + 0.5) / sy) - s.Ly;
                if (py < 0 || py >= H || yy < 0 || yy >= s.H) continue;
                for (int dx = x0; dx < x1; dx++)
                {
                    int xx = (int)Math.Floor((dx + 0.5) / sx) - s.Lx;
                    if (xx < 0 || xx >= s.W) continue;
                    int px = flip ? bx - dx - 1 : bx + dx;
                    if (px < 0 || px >= W) continue;
                    int k = yy * s.W + xx, j = py * W + px;
                    uint c = s.Color[k];
                    if (c != 0)
                    {
                        uint a = c >> 24;
                        if (a == 255) C[j] = c;
                        else C[j] = Mix(c, C[j], a / 255.0);
                    }
                    if (s.Light != null && s.Light[k] != 0) L[j] = AddLight(L[j], s.Light[k]);
                }
            }
        }
    }

    /// 烘焙動畫的播放器（bake.js 的 play）：特效管理裡的一個特效。
    public class Playing
    {
        public readonly Anim Anim;
        public double X, Y; public bool Flip;
        public double T; double stopAt = double.PositiveInfinity;
        public Playing(Anim a, double x, double y, bool flip = false) { Anim = a; X = x; Y = y; Flip = flip; }
        public void Update(double dt) { T += dt; }
        public void Draw(Frame f)
        {
            double a = double.IsPositiveInfinity(stopAt) ? 1 : 1 - (T - stopAt) / 0.3;
            if (a > 0) Blit.Draw(f, Anim, T, X, Y, Flip, a);
        }
        public void Stop() { if (double.IsPositiveInfinity(stopAt)) stopAt = T; }
        public bool Done() => T - stopAt >= 0.3 || (!Anim.Loop && T >= Anim.Duration);
    }
}
