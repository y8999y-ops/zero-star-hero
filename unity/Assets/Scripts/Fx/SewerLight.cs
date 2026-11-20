using System;

namespace PixelFX.Fx
{
    public static class SewerLight
    {
        public static readonly FxDef Def = new FxDef
        {
            Name = "Sewer light", W = 72, H = 96, Duration = 32, Loop = true,
            Options = new FxOptions().Set("lamp", 0).Set("reach", 55).Set("reflection", 66).Set("day", 1),
            Pure = new FxImpl { Draw = Draw }
        };

        static void Draw(Painter p, double t, FxOptions options)
        {
            int kind = (int)options["lamp"];
            uint warm = Col.Hex("#eccc8e"), cool = Col.Hex("#9bcbe9");
            double day = options["day"], reflection = options["reflection"];
            double phase = t + (options.X ?? 0) * 0.045;
            if (kind == 2)
            {
                p.Glow(0, 0, 9, Col.Hex("#5bccdc"), 0.25 + 0.035 * Math.Sin(phase * 3));
                return;
            }
            if (kind == 1)
            {
                // 背板、玻璃與內側暖光共用同一個效果掛點。
                p.Rect(-4, -7, 8, 12, Col.Hex("#211b35"));
                p.Rect(-2, -5, 4, 8, Col.Hex("#a76b42"));
                p.Rect(-1, -4, 2, 6, warm);
                p.Rect(-2, -4, 1, 2, Col.Hex("#fff0b7"));
                p.Glow(0, 0, 18, warm, 0.25 + 0.03 * Math.Sin(phase * 5));
                Reflect(p, phase, reflection, warm, 10, 0.48);
                return;
            }
            uint color = day > 0.45 ? Col.Hex("#ffe3ad") : cool;
            double reach = options["reach"], gain = 0.042 + 0.07 * day;
            for (int y = 0; y < reach; y++)
            {
                double taper = y / reach;
                int half = (int)Math.Round(4 + taper * 9);
                for (int x = -half; x <= half; x++)
                {
                    double edge = Math.Abs(x) / (half + 0.1);
                    double strength = edge < 0.38 ? 2.1 : edge < 0.72 ? 1.4 : 0.75;
                    p.Blend(x, y, color, gain * strength * (1 - taper * 0.5));
                }
            }
            p.Glow(0, reach - 4, 20, color, 0.16 + 0.15 * day);
            Reflect(p, phase, reflection, color, 15, 0.36 + 0.28 * day);
        }

        static void Reflect(Painter p, double t, double y, uint tint, double half, double gain)
        {
            for (int row = 0; row < 4; row++)
            {
                double wave = Math.Sin(t * 3.2 - row * 0.9);
                double w = half * (0.65 + 0.23 * wave) * (1 - row * 0.14);
                for (int x = (int)Math.Ceiling(wave * 3 - w); x <= wave * 3 + w; x++)
                    p.Blend(x, y + row * 2, tint, gain * (1 - row * 0.18));
            }
        }
    }
}
