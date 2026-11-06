// 技能樹的小特效：game/src/starwave.js（星光斬的月牙）與 minibat.js（蝙蝠群的小蝙蝠）翻成 C#。
using System;
using System.Linq;
using PixelFX;

namespace ZeroStar
{
    static class PutPx
    {
        public static void Put(Frame f, double x, double y, uint c, bool glow)
        {
            int X = (int)Pf.Round(x) - f.Ox, Y = (int)Pf.Round(y) - f.Oy;
            if (X < 0 || Y < 0 || X >= f.W || Y >= f.H) return;
            f.Color[Y * f.W + X] = c;
            if (glow) f.Light[Y * f.W + X] = c;
        }
    }

    /// 技能樹「星光斬」（星星）：連段最後一下往前射出一道短距離的月牙形星光
    public static class StarWave
    {
        static readonly uint[] G = new[] { "#6e3a0c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff" }.Select(Col.Hex).ToArray();
        public const double WAVE_T = 0.32, WAVE_V = 300;
        static void Crescent(Frame f, double cx, double cy, double dir, double k, bool ghost)
        {
            int R = ghost ? 10 : 12;
            for (int j = -R; j <= R; j++)
            {
                double q = Math.Abs(j) / (double)R, outer = Math.Sqrt(1 - q * q) * 6, inner = Math.Sqrt(Math.Max(0, 1 - Pf.Pow(q * 1.15, 2))) * 6 - (ghost ? 1.5 : 4.5) * (1 - k * 0.5);
                double w = Math.Max(1, Pf.Round(outer - inner));
                for (int i = 0; i < w; i++)
                {
                    double x = cx + dir * (outer - i), fr = i / w;
                    int lvl = ghost ? (i == 0 ? 1 : 0) : fr < 0.2 ? (q < 0.6 ? 5 : 4) : fr < 0.45 ? 4 : fr < 0.7 ? 3 : 2;
                    PutPx.Put(f, x, cy + j, G[Math.Max(0, lvl - (k > 0.75 ? 1 : 0))], !ghost && fr < 0.5);
                }
            }
        }
        public static void Draw(Frame f, Game.Wave w)
        {
            double k = w.T / WAVE_T;
            Crescent(f, w.X - w.Dir * 16, w.Y, w.Dir, k, true);
            Crescent(f, w.X - w.Dir * 8, w.Y, w.Dir, k, true);
            Crescent(f, w.X, w.Y, w.Dir, k, false);
            for (int s = 0; s < 4; s++)
            {
                double a = (s * 1.7 + w.Seed) % 1, px = w.X - w.Dir * (6 + a * 18), py = w.Y + (s % 2 != 0 ? -1 : 1) * (6 + ((s * 3 + Math.Floor(w.T * 20)) % 5));
                PutPx.Put(f, px, py, G[s % 2 != 0 ? 4 : 3], true);
            }
        }
    }

    /// 技能樹「蝙蝠群」的小蝙蝠（蝠翼星）：9×6 的小紫蝙蝠，翅膀上下兩格動畫
    public static class MiniBat
    {
        static uint P(string c) => Col.Hex(c);
        static readonly uint O = P("#160c24");
        static uint C(char ch) => ch == 'd' ? P("#4a2a7a") : ch == 'm' ? P("#8058b8") : ch == 'l' ? P("#b48ae8") : ch == 'w' ? P("#e2d0ff") : P("#ff4a5a");
        static readonly string[][] FR =
        {
            new[] { "l.........l", "ll..l.l..ll", ".lm.lml.ml.", ".mmmewemmm.", "..m.mdm.m..", "....ddd....", "..........." },
            new[] { "...........", "....l.l....", "....ewe....", ".lmmmdmmml.", "lm.mdddm.ml", "m.........m", "..........." },
        };
        public static void Draw(Frame frame, Game.Mini m)
        {
            var f = FR[(int)(Math.Floor(m.T * 12) % 2)]; bool flip = m.Vx < 0; int H = f.Length, Wd = f[0].Length;
            bool At(int i, int j) => j >= 0 && j < H && i >= 0 && i < Wd && f[j][i] != '.';
            double X(int i) => m.X + (flip ? 5 - i : i - 5);
            double Y(int j) => m.Y + j - 3;
            for (int j = -1; j <= H; j++) for (int i = -1; i <= Wd; i++) if (!At(i, j) && (At(i + 1, j) || At(i - 1, j) || At(i, j + 1) || At(i, j - 1))) PutPx.Put(frame, X(i), Y(j), O, false);
            for (int j = 0; j < H; j++) for (int i = 0; i < Wd; i++) { char ch = f[j][i]; if (ch != '.') PutPx.Put(frame, X(i), Y(j), C(ch), ch == 'e' || ch == 'w'); }
        }
    }
}
