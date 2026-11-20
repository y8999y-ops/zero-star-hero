using System;

namespace PixelFX.Fx
{
    public static class TownActivity
    {
        public static readonly FxDef Def = new FxDef
        {
            Name = "Town activity", W = 148, H = 115, Duration = 1.85,
            Options = new FxOptions().Set("mode", 0),
            Pure = new FxImpl { Draw = Paint }
        };

        static readonly uint gold = Col.Hex("#ffe1a0"), mint = Col.Hex("#98eee4"), violet = Col.Hex("#bdc8ff");

        static void Paint(Painter p, double t, FxOptions options)
        {
            int mode = (int)options["mode"];
            if (mode == 0)
            {
                if (t < 0.56)
                {
                    double u = t / 0.56;
                    double x = -34 * (1 - u), y = (1 - u) * 19 - 31 * Math.Sin(Math.PI * u);
                    int wide = 1 + (int)Math.Round(2 * Math.Abs(Math.Cos(t * 24)));
                    p.Rect(x - wide, y - 3, wide * 2, 6, Col.Hex("#754232"));
                    p.Rect(x - wide + 1, y - 2, wide * 2 - 1, 4, gold);
                    return;
                }
                double ripple = (t - 0.56) / 1.16;
                if (ripple > 1) return;
                p.Glow(0, 0, 10 + 16 * ripple, mint, (1 - ripple) * 0.28);
                for (int j = 0; j < 3; j++)
                {
                    int arc = (int)Math.Round(5 + (j + 1) * ripple * 9);
                    p.Line(-arc, j + 1, -arc + 4 + 5 * ripple, j + 1, mint, 1 - ripple);
                    p.Line(arc - 4 - 5 * ripple, j + 1, arc, j + 1, mint, 1 - ripple);
                }
                Sparkles(p, t - 0.56, 11, mint, 25, true);
            }
            else if (mode == 1)
            {
                for (int j = 0; j < 3; j++)
                {
                    double u = (t - j * 0.23) / 1.12;
                    if (u < 0 || u > 1) continue;
                    int radius = (int)(5 + 39 * u);
                    p.Line(-radius, -radius * 0.42, -radius - 5, -radius * 0.64, gold, 1 - u);
                    p.Line(radius, -radius * 0.42, radius + 5, -radius * 0.64, gold, 1 - u);
                    p.Line(-radius, radius * 0.26, -radius - 5, radius * 0.42, gold, (1 - u) * 0.7);
                    p.Line(radius, radius * 0.26, radius + 5, radius * 0.42, gold, (1 - u) * 0.7);
                    p.Glow(0, 0, radius + 8, gold, 0.18 * (1 - u));
                }
            }
            else
            {
                uint color = mode == 2 ? violet : gold;
                double u = Math.Min(1, t / 1.65);
                p.Glow(0, 0, 18 + 18 * u, color, 0.42 * (1 - u));
                Sparkles(p, t, 14, color, mode == 2 ? 40 : 27, false);
            }
        }

        static void Sparkles(Painter p, double time, int count, uint color, double distance, bool splash)
        {
            for (int i = 0; i < count; i++)
            {
                double age = time - (i % 4) * 0.065;
                if (age < 0 || age > 1.16) continue;
                double angle = i * 2.39996, spread = age * distance * (0.45 + i % 3 * 0.18);
                double x = Math.Cos(angle) * spread;
                double y = Math.Sin(angle) * spread * 0.57 - age * 19;
                if (splash) y = age * age * (18 + i % 4 * 5) - age * 24;
                double alpha = 1 - age / 1.16;
                p.Dot(x, y, color, alpha);
                if ((i & 3) == 0 && age < 0.52)
                {
                    p.Rect(x - 2, y, 5, 1, color, alpha);
                    p.Rect(x, y - 2, 1, 5, color, alpha);
                }
            }
        }
    }
}
