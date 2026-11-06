// 一個特效模組（對應網頁版 fx 檔的 meta＋draw）。
using System;

namespace PixelFX
{
    public class FxMeta
    {
        public string Name;
        public int W, H, OX, OY;
        public double Duration;
        public int Fps = 30;
        public bool Loop;
        public string[] Palette;
        public int FrameCount => (int)Pf.Round(Duration * Fps) + (Loop ? 0 : 1);
    }

    public class FxModule
    {
        public FxMeta Meta;
        /// draw(p, t, palette)：t＝秒，palette＝這個特效的色階（meta 的預設或換色後的）。
        public Action<Painter, double, string[]> Draw;
        public FxModule(FxMeta meta, Action<Painter, double, string[]> draw) { Meta = meta; Draw = draw; }
    }
}
