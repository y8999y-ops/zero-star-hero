using System;

namespace ZeroStar
{
    // 僅在兩端固定柱之間調整跨距，橋柱、繩結與兩端石基維持原來的像素比例。
    internal sealed class TownBridgeShape
    {
        static readonly TownBridgeShape Long = new TownBridgeShape(36, 336, 42,
            (36, 0), (48, 0), (60, 2), (98, 8), (138, 13), (181, 16), (204, 15), (244, 13), (281, 9), (308, 4), (320, 0), (336, 0));
        static readonly TownBridgeShape Short = new TownBridgeShape(26, 154, 30,
            (26, 0), (38, 0), (54, 3), (73, 7), (91, 8), (106, 7), (126, 5), (142, 0), (154, 0));

        readonly int left, right, baseline;
        readonly (int x, int dip)[] points;

        TownBridgeShape(int left, int right, int baseline, params (int x, int dip)[] points)
        {
            this.left = left; this.right = right; this.baseline = baseline; this.points = points;
        }

        internal static TownBridgeShape FromWidth(int width) => width >= 300 ? Long : Short;

        internal Platform Platform(int x, int y, int span)
        {
            var surface = new double[span + 1];
            int segment = 1;
            for (int i = 0; i <= span; i++)
            {
                double u = left + i * (right - left) / (double)span;
                while (u > points[segment].x) segment++;
                var a = points[segment - 1]; var b = points[segment];
                surface[i] = a.dip + (b.dip - a.dip) * (u - a.x) / (b.x - a.x);
            }
            return new Platform { X = x, Y = y, W = span, Deck = surface };
        }

        internal void Paint(Img artwork, LevelData data, int x, int y, int span)
        {
            if (span <= 0) return;
            int top = y - baseline;
            for (int u = Math.Max(-x, -left); u < Math.Min(data.W - x, span + artwork.W - right); u++)
            {
                int sx = u < 0 ? left + u : u >= span ? right + u - span : left + u * (right - left) / span;
                for (int v = Math.Max(0, -top); v < Math.Min(artwork.H, data.H - top); v++)
                {
                    uint c = artwork.Px[v * artwork.W + sx];
                    if (c == 0) continue;
                    int i = (top + v) * data.W + x + u;
                    data.PF[i] = c;
                    data.PFE[i] = 0;
                }
            }
        }
    }
}
