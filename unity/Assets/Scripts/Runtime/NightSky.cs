// 夜空（網頁版 starsky.js 的 createSky）：shooting-stars 特效疊在由上往下深藍→紫的漸層上，320×180。
// 碎星鎮的天空、主畫面、開場動畫共用這一份（原本三個地方各寫一份，一模一樣）。
using PixelFX;

namespace ZeroStar
{
    public class NightSky
    {
        public const int W = 320, H = 180;
        static readonly (double t, int[] c)[] GRAD = { (0, new[] { 8, 6, 24 }), (0.4, new[] { 20, 13, 48 }), (0.75, new[] { 44, 22, 78 }), (1, new[] { 86, 40, 100 }) };
        readonly FxRun fx;
        readonly Frame f = new Frame(W, H);
        readonly uint[] bg = new uint[W * H];
        /// 合成好的天空（RGBA，上到下；不透明）
        public readonly byte[] Rgba = new byte[W * H * 4];

        public NightSky()
        {
            var o = new FxOptions { X = W / 2, Y = H, Seed = 4 }; o.Ramps["sky"] = new[] { "#120c26", "#2a1e4a", "#4a3878", "#9a88d0", "#e8e0ff" };
            fx = new FxRun(FxSystem.Def("shooting-stars"), o);
            for (int y = 0; y < H; y++)
            {
                double t = y / (double)(H - 1); int[] c = GRAD[GRAD.Length - 1].c;
                for (int i = 1; i < GRAD.Length; i++) if (t <= GRAD[i].t) { double k = (t - GRAD[i - 1].t) / (GRAD[i].t - GRAD[i - 1].t); c = new int[3]; for (int j = 0; j < 3; j++) c[j] = (int)Pf.Round(GRAD[i - 1].c[j] + (GRAD[i].c[j] - GRAD[i - 1].c[j]) * k); break; }
                uint v = 0xff000000u | ((uint)c[2] << 16) | ((uint)c[1] << 8) | (uint)c[0];
                for (int x = 0; x < W; x++) bg[y * W + x] = v;
            }
        }

        /// 往前走 dt 秒，重畫一次
        public void Update(double dt)
        {
            fx.Update(dt);
            f.Clear(); fx.Draw(f); f.CompositeBg(Rgba, bg);
        }

        /// 抄到主畫面、開場用的圖（UI.Img，同一張圖重複用）
        public void CopyTo(UI.Img im)
        {
            for (int i = 0; i < im.Px.Length; i++) im.Px[i] = new UnityEngine.Color(Rgba[i * 4] / 255f, Rgba[i * 4 + 1] / 255f, Rgba[i * 4 + 2] / 255f, Rgba[i * 4 + 3] / 255f);
        }
    }
}
