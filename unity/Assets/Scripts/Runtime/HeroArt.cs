// game/src/star.js 的 paintStar 翻成 C#：把主角某個姿勢的像素貼到畫布（腳底在 x, y），加上肚子閃光的柔光。
// 姿勢的像素是網頁版算好匯出的（Baked.Hero）。
using System;
using PixelFX;

namespace ZeroStar
{
    public static class HeroArt
    {
        public static HeroPose Pose(string form, string name) => Baked.Hero()[form + ":" + name];

        /// tint：整個剪影換成單色（受擊閃白、閃避殘影）。
        public static void Paint(Frame frame, double x, double y, HeroPose s, bool flip, uint tint = 0, double glow = 1)
        {
            int Wf = frame.W, Hf = frame.H; uint[] Cc = frame.Color, L = frame.Light;
            int ox = (int)Pf.Round(x) - frame.Ox, oy = (int)Pf.Round(y) - frame.Oy;
            for (int j = 0; j < s.H; j++)
            {
                int py = oy + j - s.Ay;
                if (py < 0 || py >= Hf) continue;
                for (int i = 0; i < s.W; i++)
                {
                    uint c = s.Px[j * s.W + i];
                    if (c == 0) continue;
                    int px = ox + (flip ? s.Ax - i : i - s.Ax);
                    if (px < 0 || px >= Wf) continue;
                    Cc[py * Wf + px] = tint != 0 ? tint : c;
                }
            }
            if (glow > 0 && tint == 0)
            {
                double gx = ox + (flip ? -s.CoreX : s.CoreX), gy = oy + s.CoreY; const int R = 18;
                for (int j = -R; j <= R; j++)
                {
                    double py = gy + j;
                    if (py < 0 || py >= Hf) continue;
                    for (int i = -R; i <= R; i++)
                    {
                        double px = gx + i;
                        if (px < 0 || px >= Wf) continue;
                        double f = 1 - Pf.Hypot(i, j) / R;
                        if (f <= 0) continue;
                        double sx = flip ? s.Ax - (px - ox) : px - ox + s.Ax, sy = py - oy + s.Ay;
                        if (sx >= 0 && sy >= 0 && sx < s.W && sy < s.H && sx == Math.Floor(sx) && sy == Math.Floor(sy) && s.Px[(int)sy * s.W + (int)sx] != 0) continue;
                        double k = f * f * 48 * glow; int idx = Pf.ToInt32(py * Wf + px); uint l = L[idx];
                        L[idx] = (uint)(unchecked((int)0xff000000) | (Pf.ToInt32(Math.Min(255, ((l >> 16) & 255) + k * 0.35)) << 16) | (Pf.ToInt32(Math.Min(255, ((l >> 8) & 255) + k * 0.8)) << 8) | Pf.ToInt32(Math.Min(255, (l & 255) + k)));
                    }
                }
            }
        }
    }
}
