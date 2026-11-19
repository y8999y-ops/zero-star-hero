using System;

namespace ZeroStar
{
    /// 視差層在 CPU 畫布上的取樣位置。顯示鏡頭還會加上 fraction，
    /// 因此先扣掉同一份位移，最後總位移才會恰好是 camera * speed。
    public static class Parallax
    {
        public static double Offset(int origin, double fraction, double speed) =>
            origin * speed + fraction * (speed - 1);

        // 預乘 alpha 插值後還原顏色，透明邊緣不會變黑。
        public static uint Mix(uint a, uint b, double t)
        {
            if (a == b) return a;
            if (t <= 0) return a;
            if (t >= 1) return b;
            if ((a >> 24) == 0) return (b & 0xffffffu) | ((uint)((b >> 24) * t + 0.5) << 24);
            if ((b >> 24) == 0) return (a & 0xffffffu) | ((uint)((a >> 24) * (1 - t) + 0.5) << 24);
            if ((a >> 24) == 255 && (b >> 24) == 255) return OpaqueMix(a, b, t);
            double aa = (a >> 24) * (1 - t), ab = (b >> 24) * t, alpha = aa + ab;
            if (alpha < 0.5) return 0;
            uint r = (uint)(((a & 255) * aa + (b & 255) * ab) / alpha + 0.5);
            uint g = (uint)((((a >> 8) & 255) * aa + ((b >> 8) & 255) * ab) / alpha + 0.5);
            uint bl = (uint)((((a >> 16) & 255) * aa + ((b >> 16) & 255) * ab) / alpha + 0.5);
            return ((uint)(alpha + 0.5) << 24) | (bl << 16) | (g << 8) | r;
        }
        static uint OpaqueMix(uint a, uint b, double t)
        {
            int r = (int)(a & 255), g = (int)((a >> 8) & 255), blue = (int)((a >> 16) & 255);
            return 0xff000000u | (uint)(r + ((int)(b & 255) - r) * t + 0.5)
                | ((uint)(g + ((int)((b >> 8) & 255) - g) * t + 0.5) << 8)
                | ((uint)(blue + ((int)((b >> 16) & 255) - blue) * t + 0.5) << 16);
        }
        public static uint Over(uint back, uint front)
        {
            uint a = front >> 24;
            if (a == 0) return back;
            if (a == 255 || back == 0) return front;
            if ((back >> 24) == 255) return OpaqueMix(back, front, a / 255.0);
            // 所有畫布背景都是不透明；圖層拼接亦支援半透明背景。
            double fa = a / 255.0, ba = (back >> 24) / 255.0 * (1 - fa), total = fa + ba;
            uint r = (uint)(((front & 255) * fa + (back & 255) * ba) / total + 0.5);
            uint g = (uint)((((front >> 8) & 255) * fa + ((back >> 8) & 255) * ba) / total + 0.5);
            uint b = (uint)((((front >> 16) & 255) * fa + ((back >> 16) & 255) * ba) / total + 0.5);
            return ((uint)(total * 255 + 0.5) << 24) | (b << 16) | (g << 8) | r;
        }
        public static uint Alpha(uint color, uint original) => (color & 0x00ffffffu) | (original & 0xff000000u);

        public readonly struct Row
        {
            readonly uint[] pixels;
            readonly int width, height, x0, y0, minY, maxY;
            readonly double tx, ty;
            public Row(uint[] pixels, int width, int height, double x, double y, int minY = 0, int maxY = int.MaxValue)
            {
                this.pixels = pixels; this.width = width; this.height = height;
                this.minY = Math.Max(0, minY); this.maxY = Math.Min(height, maxY);
                x0 = (int)Math.Floor(x); y0 = (int)Math.Floor(y); tx = x - x0; ty = y - y0;
            }
            uint At(int x, int y) => y < minY || y >= maxY ? 0 : pixels[y * width + x];
            public uint Sample(int x)
            {
                if (pixels == null || width == 0 || y0 >= maxY || y0 + 1 < minY) return 0;
                int a = ((x + x0) % width + width) % width, b = a + 1 == width ? 0 : a + 1;
                uint top = Mix(At(a, y0), At(b, y0), tx);
                return ty == 0 ? top : Mix(top, Mix(At(a, y0 + 1), At(b, y0 + 1), tx), ty);
            }
        }
    }
}
