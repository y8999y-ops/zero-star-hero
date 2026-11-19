// game/src/level.js 每一格要做的事翻成 C#：畫背景＋遊玩層（分層視差、光照明暗、地面亮邊）、前景、大氣（光束、漂浮光點）、場景光源。
// 載入時烘好的資料（遊玩層像素、各圖層）從 Baked.Level 來。光影用 lightStyle v2（網頁版目前用的那套）。
using System;
using System.Collections.Generic;
using PixelFX;

namespace ZeroStar
{
    public class LevelArt
    {
        public const int H = 216;
        public readonly LevelData D;
        readonly int LW, MH;
        static readonly double[] PAR = { 0.05, 0.12, 0.3, 0.6 };
        const double PAR_F = 1.35;
        static readonly uint BACK_COLOR = Col.Hex("#07070f");
        const int FG_DROP = 26;
        static readonly double[] VPAR = { 0, 0.7, 0.85, 1 };
        static readonly double[] LAYER_DIM = { 0, 0.78, 0.66, 0.6, 1 };
        // lightStyle v2
        const double AMB = 0.42, FAR1 = 0.4, FAR2 = 0.36, COOL1 = 0.42, COOL2 = 0.3, RIM = 1.5, UNDER = 0.55, LIT_MAX = 1.7;
        static readonly int[] COOL = { 26, 36, 72 };

        public LevelArt(LevelData d) { D = d; LW = d.W; MH = d.H; BuildDepth(); BuildHaze(); }

        // ---- 2026-11-12 美術優化（照 Ori 的層次）：越遠越亮越淡（逆光的霧）、近景壓暗、地面深處壓暗，遊玩層對比最高。Unity 版自己的，不跟網頁版比對。
        byte[] depth;                       // 遊玩層每一格離表面多深（上下取近的那邊）
        void BuildDepth()
        {
            var PF = D.PF; depth = new byte[LW * MH];
            for (int x = 0; x < LW; x++)
            {
                int d = 0;
                for (int y = 0; y < MH; y++) { int i = y * LW + x; if (PF[i] != 0) { if (d < 255) d++; } else d = 0; depth[i] = (byte)d; }
                d = 0;
                for (int y = MH - 1; y >= 0; y--) { int i = y * LW + x; if (PF[i] != 0) { if (d < 255) d++; } else d = 0; if (d < depth[i]) depth[i] = (byte)d; }
            }
        }
        double hzR, hzG, hzB;               // 這一關霧的顏色
        readonly double[] hazeBack = new double[H], hazeFar = new double[H], hazeMid = new double[H];
        void BuildHaze()
        {
            (hzR, hzG, hzB) = D.Stage == "1-2" ? (96.0, 78.0, 104.0) : D.Stage == "1-3" ? (62.0, 70.0, 134.0) : D.Stage == "1-4" ? (78.0, 92.0, 100.0) : (52.0, 88.0, 122.0);
            for (int y = 0; y < H; y++)
            {
                double band = Math.Exp(-Math.Pow((y - 100) / 62.0, 2));   // 畫面中段一條亮的霧光帶
                hazeBack[y] = 0.30 + 0.34 * band; hazeFar[y] = 0.20 + 0.26 * band; hazeMid[y] = 0.08 + 0.14 * band;
            }
        }
        static uint MixF(uint c, double r, double g, double b, double t) =>
            0xff000000u | ((uint)(int)(((c >> 16) & 255) * (1 - t) + b * t) << 16) | ((uint)(int)(((c >> 8) & 255) * (1 - t) + g * t) << 8) | (uint)(int)((c & 255) * (1 - t) + r * t);
        static uint DesatF(uint c, double t)
        {
            double r = c & 255, g = (c >> 8) & 255, b = (c >> 16) & 255, gray = r * 0.3 + g * 0.59 + b * 0.11;
            return 0xff000000u | ((uint)(int)(b + (gray - b) * t) << 16) | ((uint)(int)(g + (gray - g) * t) << 8) | (uint)(int)(r + (gray - r) * t);
        }

        static int Wrap(int x, int w) => ((x % w) + w) % w;
        static uint Shade(uint c, double k) =>
            (uint)(unchecked((int)0xff000000) | (Pf.ToInt32(Math.Min(255, ((c >> 16) & 255) * k)) << 16) | (Pf.ToInt32(Math.Min(255, ((c >> 8) & 255) * k)) << 8) | Pf.ToInt32(Math.Min(255, (c & 255) * k)));
        static uint Cool(uint c, double t) =>
            (uint)(unchecked((int)0xff000000) | (Pf.ToInt32(((c >> 16) & 255) * (1 - t) + COOL[2] * t) << 16) | (Pf.ToInt32(((c >> 8) & 255) * (1 - t) + COOL[1] * t) << 8) | Pf.ToInt32((c & 255) * (1 - t) + COOL[0] * t));
        static uint Dim(uint c, double k) =>
            (uint)(unchecked((int)0xff000000) | (Pf.ToInt32(((c >> 16) & 255) * k) << 16) | (Pf.ToInt32(((c >> 8) & 255) * k) << 8) | Pf.ToInt32((c & 255) * k));

        float[] vig = new float[0]; int vigW;
        float[] Vignette(int W)
        {
            if (vigW == W) return vig;
            vigW = W; vig = new float[W * H];
            for (int y = 0; y < H; y++) for (int x = 0; x < W; x++)
            {
                double dx = (x - W / 2.0) / (W / 2.0), dy = (y - H / 2.0) / (H / 2.0), d = dx * dx * 0.6 + dy * dy;
                vig[y * W + x] = (float)Math.Max(0, Math.Min(1, (d - 0.55) * 1.3));
            }
            return vig;
        }

        /// 畫背景＋遊玩層。lv：SceneLight.Compute 算的亮度。
        /// 畫面切成幾條同時算（每個像素各算各的，結果一樣）；各圖層的欄位用累加取代每格取餘數。
        public void Draw(Frame frame, float[] lv) => Draw(frame, lv, null);
        uint[] skyPieces;
        internal void Draw(Frame frame, float[] lv, StageLayout layout)
        {
            if (layout != null)
            {
                if (skyPieces == null || skyPieces.Length != frame.Color.Length) skyPieces = new uint[frame.Color.Length];
                Array.Clear(skyPieces, 0, skyPieces.Length);
                layout.Draw(frame, SceneryLayer.Sky, skyPieces);
            }
            else skyPieces = null;
            var V = Vignette(frame.W);
            const int BANDS = 8;
            int per = (H + BANDS - 1) / BANDS;
            PixelFX.Par.For(BANDS, k =>
            {
                int y0 = k * per, y1 = Math.Min(H, (k + 1) * per);
                for (int y = y0; y < y1; y++) DrawRow(frame, lv, V, y);
            });
        }

        // 已知在 0～255 之間的正數：直接截成整數（跟 JS 的 << 一樣）
        static uint ShadeF(uint c, double k) =>
            0xff000000u | ((uint)(int)Math.Min(255, ((c >> 16) & 255) * k) << 16) | ((uint)(int)Math.Min(255, ((c >> 8) & 255) * k) << 8) | (uint)(int)Math.Min(255, (c & 255) * k);
        static uint CoolF(uint c, double t) =>
            0xff000000u | ((uint)(int)(((c >> 16) & 255) * (1 - t) + COOL[2] * t) << 16) | ((uint)(int)(((c >> 8) & 255) * (1 - t) + COOL[1] * t) << 8) | (uint)(int)((c & 255) * (1 - t) + COOL[0] * t);

        void DrawRow(Frame frame, float[] lv, float[] V, int y)
        {
            int W = frame.W, cx = frame.Ox, cy = frame.Oy;
            uint[] outc = frame.Color, LB = frame.Light, PF = D.PF;
            byte[] PFE = D.PFE;
            float[] TR = SceneLight.Tr, TG = SceneLight.Tg, TB = SceneLight.Tb;
            double rx = frame.CameraFractionX, ry = frame.CameraFractionY;
            int wy = y + cy, row = y * W, pfRow = wy * LW;
            if (wy < 0 || wy >= MH) { for (int x = 0; x < W; x++) outc[row + x] = BACK_COLOR; return; }
            Parallax.Row MakeRow(Img img, double ox, double yy, int minY = 0, int maxY = int.MaxValue) => img == null ? default : new Parallax.Row(img.Px, img.W, img.H, ox, yy, minY, maxY);
            (Parallax.Row top, Parallax.Row bottom) Rows(Img img, Img upper, int k)
            {
                double ox = Parallax.Offset(cx, rx, PAR[k]);
                if (!D.Tall) return (MakeRow(img, ox, y - ry), default);
                double top = y + Parallax.Offset(cy, ry, VPAR[k]);
                double bot = y + Parallax.Offset(cy - (MH - H), ry, VPAR[k]);
                return (MakeRow(img, ox, top, 0, D.Pin), bot < 0 ? MakeRow(upper, ox, D.UH + bot) : MakeRow(img, ox, bot, D.Pin));
            }
            var back = MakeRow(D.Back, Parallax.Offset(cx, rx, PAR[0]), y - ry);
            var far = Rows(D.Far, D.UpFar, 1);
            var mid = Rows(D.Mid, D.UpMid, 2);
            var near = Rows(D.Near, null, 3);
            uint Sample((Parallax.Row top, Parallax.Row bottom) rows, int x) { uint top = rows.top.Sample(x); return (top >> 24) == 255 ? top : Parallax.Over(rows.bottom.Sample(x), top); }
            for (int x = 0; x < W; x++)
            {
                int i = row + x, gx = x + cx;
                uint v = gx >= 0 && gx < LW ? PF[pfRow + gx] : 0;
                if (v == 0)
                {
                    uint n = Sample(near, x), bg = 0;
                    if ((n >> 24) != 255)
                    {
                        uint m = Sample(mid, x), f = 0;
                        if ((m >> 24) != 255)
                        {
                            f = Sample(far, x);
                            if ((f >> 24) != 255)
                            {
                                bg = Parallax.Over(BACK_COLOR, back.Sample(x));
                                if (skyPieces != null) bg = Parallax.Over(bg, skyPieces[i]);
                                bg = MixF(bg, hzR, hzG, hzB, hazeBack[y] * (1 - V[i] * 0.5));
                            }
                        }
                        uint ShadeFar(uint c, int k)
                        {
                            double light = (k == 1 ? FAR1 : FAR2) * (1 - V[i] * 0.2) * (1 + 0.25 * Math.Min(1, lv[i]));
                            uint shaded = ShadeF(CoolF(c, k == 1 ? COOL1 : COOL2), light);
                            return Parallax.Alpha(MixF(shaded, hzR, hzG, hzB, (k == 1 ? hazeFar[y] : hazeMid[y]) * (1 - V[i] * 0.5)), c);
                        }
                        if (f != 0) bg = Parallax.Over(bg, ShadeFar(f, 1));
                        if (m != 0) bg = Parallax.Over(bg, ShadeFar(m, 2));
                    }
                    if (n != 0)
                    {
                        double light = LAYER_DIM[3] * (1 - V[i] * 0.35) * (AMB + (1 - AMB) * Math.Min(LIT_MAX, lv[i] / 1.1)) * 0.72;
                        bg = Parallax.Over(bg, Parallax.Alpha(ShadeF(DesatF(n, 0.4), light), n));
                        double strength = (n >> 24) / 255.0 * 0.5;
                        if (lv[i] > 0.02) LB[i] = 0xff000000u | ((uint)(int)Math.Min(255, TB[i] * strength) << 16) | ((uint)(int)Math.Min(255, TG[i] * strength) << 8) | (uint)(int)Math.Min(255, TR[i] * strength);
                    }
                    outc[i] = bg;
                    continue;
                }
                if (PFE[pfRow + gx] != 0) { outc[i] = v; continue; }
                double l = lv[i];
                double k = LAYER_DIM[4] * (1 - V[i] * 0.35) * (AMB + (1 - AMB) * Math.Min(LIT_MAX, l / 1.1));
                int dp = depth[pfRow + gx];
                if (dp > 5) { double dk = Math.Min(1, (dp - 5) / 28.0); v = DesatF(v, 0.45 * dk); k *= 1 - 0.5 * dk; }
                bool up = wy > 0 && PF[pfRow - LW + gx] == 0, up2 = wy > 1 && PF[pfRow - 2 * LW + gx] == 0, dn = wy < MH - 1 && PF[pfRow + LW + gx] == 0;
                if (up) k *= RIM; else if (up2) k *= 1 + (RIM - 1) * 0.4; else if (dn) k *= UNDER;
                outc[i] = Math.Abs(k - 1) > 0.01 ? ShadeF(v, k) : v;
                if (l > 0.02) LB[i] = 0xff000000u | ((uint)(int)Math.Min(255, TB[i]) << 16) | ((uint)(int)Math.Min(255, TG[i]) << 8) | (uint)(int)Math.Min(255, TR[i]);
            }
        }

        /// 前景：在角色和特效之後畫，蓋在最上面。
        public void DrawForeground(Frame frame)
        {
            var FGI = D.Fg;
            if (FGI == null || FGI.Empty) return;
            int W = frame.W, cy = frame.Oy;
            double of = Parallax.Offset(frame.Ox, frame.CameraFractionX, PAR_F);
            uint[] outc = frame.Color;
            for (int y = 0; y < H; y++)
            {
                int sy;
                if (D.Tall)
                {
                    int top = y + cy;
                    if (top < 110 - FG_DROP) sy = top + FG_DROP;
                    else { int bot = y + cy - (MH - H); if (bot < 110 || bot >= H) continue; sy = bot; }
                }
                else { int wy = y + cy - (MH - H); if (wy < 0) continue; sy = wy < 110 ? wy + FG_DROP : wy; if (sy >= H) continue; }
                if (sy < 0) continue;
                int row = y * W;
                var sample = new Parallax.Row(FGI.Px, FGI.W, FGI.H, of, sy);
                for (int x = 0; x < W; x++)
                {
                    uint v = sample.Sample(x);
                    if (v != 0) outc[row + x] = Parallax.Over(outc[row + x], v);
                }
            }
        }

        // ---- 大氣：光束＋漂浮光點，寫進 light 層
        static readonly double[][] SHAFTS = { new double[] { 140, 14 }, new double[] { 520, 22 }, new double[] { 860, 10 }, new double[] { 1180, 18 } };
        const double SHAFT_W = 1400, SHAFT_PAR = 0.8;
        static readonly uint[] MOTE = { Col.Hex("#a0eef4"), Col.Hex("#46b4c8") };
        static void AddL(uint[] Lb, int i, double r, double g, double b)
        {
            uint d = Lb[i];
            Lb[i] = (uint)((255 << 24) | (Pf.ToInt32(Math.Min(255, ((d >> 16) & 255) + b)) << 16) | (Pf.ToInt32(Math.Min(255, ((d >> 8) & 255) + g)) << 8) | Pf.ToInt32(Math.Min(255, (d & 255) + r)));
        }
        public void DrawAtmosphere(Frame frame, double time)
        {
            int W = frame.W, Hh = frame.H;
            double os = Parallax.Offset(frame.Ox, frame.CameraFractionX, SHAFT_PAR);
            uint[] Lb = frame.Light, Cb = frame.Color;
            double flicker = 0.75 + 0.25 * Pf.Sin(time * 1.3);
            foreach (var s in SHAFTS) for (int rep = -1; rep <= 1; rep++)
            {
                double sw = s[1], bas = s[0] + rep * SHAFT_W - os;
                for (int y = 0; y < D.Floor - 10 && y < Hh; y++)
                {
                    double fall = 1 - y / 150.0;
                    if (fall <= 0) break;
                    double x0 = bas + y * 0.45, half = sw * 0.5 + 3, mid = x0 + sw * 0.5;
                    for (int x = (int)Math.Max(0, Math.Floor(mid - half)); x < Math.Min(W, Math.Ceiling(mid + half)); x++)
                    {
                        double across = 1 - Math.Abs(x + 0.5 - mid) / half;
                        if (across <= 0) continue;
                        double k = across * across * fall * flicker;
                        AddL(Lb, y * W + x, 10 * k, 22 * k, 26 * k);
                    }
                }
            }
            int om = (int)Math.Floor(frame.Ox * 0.6);
            for (int n = 0; n < 36; n++)
            {
                int x = Wrap((int)Math.Floor(Pf.Rand(n, 71) * 1440) + (int)Pf.Round(Pf.Sin(time * 0.8 + n) * 3) - om, 1440);
                if (x >= W) continue;
                int y = D.Floor - 4 - (int)Math.Floor((time * (6 + Pf.Rand(n, 72) * 8) + Pf.Rand(n, 73) * 170) % 170);
                if (y < 0 || y >= Hh) continue;
                int i = y * W + x;
                Cb[i] = MOTE[n & 1];
                AddL(Lb, i, 20, 50, 56);
                int[][] nb = { new[] { 1, 0 }, new[] { -1, 0 }, new[] { 0, 1 }, new[] { 0, -1 } };
                foreach (var d in nb)
                {
                    int xx = x + d[0], yy = y + d[1];
                    if (xx >= 0 && xx < W && yy >= 0 && yy < Hh) AddL(Lb, yy * W + xx, 6, 16, 18);
                }
            }
        }

        /// 這一幀的固定光源：火把＋近景水晶（會循環）＋地上道具的光。
        public List<LightSrc> SceneLights(double camX, int W, double time)
        {
            var list = new List<LightSrc>();
            foreach (var t in D.Torches) list.Add(new LightSrc(t.x, t.y - 26, 74 + (Math.Floor(time * 8) % 3), 3, "#ff8a3a"));
            double o = camX * PAR[3]; int W3 = D.Near.W != 0 ? D.Near.W : 896;
            foreach (var c in D.CrystalLights)
            {
                double k = Pf.Round((o - c.X + W / 2.0) / W3);
                list.Add(new LightSrc(c.X + k * W3, c.Y, c.R, c.Lv, "#46d4e8", PAR[3]));
            }
            foreach (var c in D.PropLights) list.Add(c);
            return list;
        }
    }
}
