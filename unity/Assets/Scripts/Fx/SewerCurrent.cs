using System;

namespace PixelFX.Fx
{
    public static class SewerCurrent
    {
        public static readonly FxDef Def = new FxDef
        {
            Name = "Sewer current", W = 1304, H = 32, Duration = 32, Loop = true,
            Options = new FxOptions { Palette = new[] { "#112934", "#183844", "#24515b", "#386875", "#559096" } }
                .Set("width", 1304).Set("depth", 12),
            Pure = new FxImpl { Draw = Paint }
        };

        static void Paint(Painter p, double t, FxOptions options)
        {
            var colors = Col.Fit(options.Palette, 5);
            int width = (int)options["width"], depth = (int)options["depth"];
            p.Rect(0, 0, width, depth, colors[0]);
            p.Rect(0, 0, width, 4, colors[1]);
            int drift = (int)(t * 8);
            for (int i = -5; i <= width / 64; i++)
            {
                int x = i * 64 + drift;
                int l = Math.Max(0, x), r = Math.Min(width, x + 15 + (i & 3) * 3);
                if (r > l) p.Rect(l, 1 + (i & 3), r - l, 1, colors[(i & 1) == 0 ? 3 : 2]);
                l = Math.Max(0, x - 18); r = Math.Min(width, x - 8);
                if (r > l) p.Rect(l, 7 + (i & 1), r - l, 1, colors[1]);
            }

            // 固定出水點的滴水與短漣漪。只在槽內畫，鏡頭移動不會帶著水走。
            for (int i = 0; i < 7; i++)
            {
                int x = 59 + i * 181;
                if (x >= width - 12) break;
                double phase = (t + 1.13 * i) % 4;
                if (phase < 0.46)
                    p.Dot(x, -19 * (1 - phase * phase / (0.46 * 0.46)), colors[3]);
                else if (phase < 1.08)
                {
                    double radius = 2 + (phase - 0.46) * 15;
                    p.Line(x - radius, 2, x - radius + 3, 2, colors[4], 0.6);
                    p.Line(x + radius - 3, 2, x + radius, 2, colors[4], 0.6);
                }
            }
        }
    }
}
