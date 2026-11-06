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

        public LevelArt(LevelData d) { D = d; LW = d.W; MH = d.H; }

        static int Wrap(int x, int w) => ((x % w) + w) % w;
        static uint Shade(uint c, double k) =>
            (uint)(unchecked((int)0xff000000) | (Pf.ToInt32(Math.Min(255, ((c >> 16) & 255) * k)) << 16) | (Pf.ToInt32(Math.Min(255, ((c >> 8) & 255) * k)) << 8) | Pf.ToInt32(Math.Min(255, (c & 255) * k)));
        static uint Cool(uint c, double t) =>
            (uint)(unchecked((int)0xff000000) | (Pf.ToInt32(((c >> 16) & 255) * (1 - t) + COOL[2] * t) << 16) | (Pf.ToInt32(((c >> 8) & 255) * (1 - t) + COOL[1] * t) << 8) | Pf.ToInt32((c & 255) * (1 - t) + COOL[0] * t));
        static uint Dim(uint c, double k) =>
            (uint)(unchecked((int)0xff000000) | (Pf.ToInt32(((c >> 16) & 255) * k) << 16) | (Pf.ToInt32(((c >> 8) & 255) * k) << 8) | Pf.ToInt32((c & 255) * k));

        // 某一層在螢幕第 y 列：[上段的列（-1＝不在上段）, 下段的列]
        void LayerRows(int y, int cy, int k, out int t, out int b)
        {
            if (!D.Tall) { t = -1; b = y; return; }
            int top = y + (int)Pf.Round(cy * VPAR[k]), bot = y + (int)Pf.Round((cy - (MH - H)) * VPAR[k]);
            t = top >= 0 && top < D.Pin ? top : -1;
            b = bot >= D.Pin && bot < H ? bot : bot < 0 ? bot : H;
        }
        uint Sample(Img img, Img up, int t, int b, int x)
        {
            if (t >= 0) { uint v = img.Px[t * img.W + Wrap(x, img.W)]; if (v != 0) return v; }
            if (b >= 0) return b < H ? img.Px[b * img.W + Wrap(x, img.W)] : 0;
            return up != null && !up.Empty && D.UH + b >= 0 ? up.Px[(D.UH + b) * up.W + Wrap(x, up.W)] : 0;
        }

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
        public void Draw(Frame frame, float[] lv)
        {
            var V = Vignette(frame.W);
            const int BANDS = 8;
            int per = (H + BANDS - 1) / BANDS;
            System.Threading.Tasks.Parallel.For(0, BANDS, k =>
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
            Img B = D.Back, F1 = D.Far, M2 = D.Mid, N3 = D.Near, UF = D.UpFar, UM = D.UpMid;
            int o0 = (int)Math.Floor(cx * PAR[0]), o1 = (int)Math.Floor(cx * PAR[1]), o2 = (int)Math.Floor(cx * PAR[2]), o3 = (int)Math.Floor(cx * PAR[3]);
            int wy = y + cy, row = y * W;
            if (wy < 0 || wy >= MH) { for (int x = 0; x < W; x++) outc[row + x] = BACK_COLOR; return; }
            int by = y;
            LayerRows(y, cy, 1, out int t1, out int b1);
            LayerRows(y, cy, 2, out int t2, out int b2);
            LayerRows(y, cy, 3, out int t3, out int b3);
            // 每一層這一列的起點（-1＝這一段沒有）：上段 t、下段 b（b>=H 或 b<0 時看上層圖）
            int n3t = t3 >= 0 ? t3 * N3.W : -1, n3b = b3 >= 0 && b3 < H ? b3 * N3.W : -1;
            int m2t = t2 >= 0 ? t2 * M2.W : -1, m2b = b2 >= 0 && b2 < H ? b2 * M2.W : -1, umr = b2 < 0 && UM != null && !UM.Empty && D.UH + b2 >= 0 ? (D.UH + b2) * UM.W : -1;
            int f1t = t1 >= 0 ? t1 * F1.W : -1, f1b = b1 >= 0 && b1 < H ? b1 * F1.W : -1, ufr = b1 < 0 && UF != null && !UF.Empty && D.UH + b1 >= 0 ? (D.UH + b1) * UF.W : -1;
            int bRow = by * B.W;
            int cN = Wrap(o3, N3.W), cM = Wrap(o2, M2.W), cF = Wrap(o1, F1.W), cB = Wrap(o0, B.W);
            int wUM = UM != null && !UM.Empty ? UM.W : 1, wUF = UF != null && !UF.Empty ? UF.W : 1;
            int cUM = Wrap(o2, wUM), cUF = Wrap(o1, wUF);
            int pfRow = wy * LW;
            for (int x = 0; x < W; x++, cN = cN + 1 == N3.W ? 0 : cN + 1, cM = cM + 1 == M2.W ? 0 : cM + 1, cF = cF + 1 == F1.W ? 0 : cF + 1, cB = cB + 1 == B.W ? 0 : cB + 1, cUM = cUM + 1 == wUM ? 0 : cUM + 1, cUF = cUF + 1 == wUF ? 0 : cUF + 1)
            {
                int i = row + x, gx = x + cx;
                uint v = gx >= 0 && gx < LW ? PF[pfRow + gx] : 0; int layer = 4;
                if (v == 0)
                {
                    layer = 3;
                    if (n3t >= 0) v = N3.Px[n3t + cN];
                    if (v == 0 && n3b >= 0) v = N3.Px[n3b + cN];
                }
                if (v == 0)
                {
                    layer = 2;
                    if (m2t >= 0) v = M2.Px[m2t + cM];
                    if (v == 0) v = m2b >= 0 ? M2.Px[m2b + cM] : umr >= 0 ? UM.Px[umr + cUM] : 0;
                }
                if (v == 0)
                {
                    layer = 1;
                    if (f1t >= 0) v = F1.Px[f1t + cF];
                    if (v == 0) v = f1b >= 0 ? F1.Px[f1b + cF] : ufr >= 0 ? UF.Px[ufr + cUF] : 0;
                }
                if (v == 0) { uint bv = B.Px[bRow + cB]; outc[i] = bv != 0 ? bv : BACK_COLOR; continue; }
                if (layer == 4 && PFE[pfRow + gx] != 0) { outc[i] = v; continue; }
                double l = lv[i], k;
                if (layer <= 2) { k = (layer == 1 ? FAR1 : FAR2) * (1 - V[i] * 0.2) * (1 + 0.25 * Math.Min(1, l)); v = CoolF(v, layer == 1 ? COOL1 : COOL2); }
                else
                {
                    k = LAYER_DIM[layer] * (1 - V[i] * 0.35) * (AMB + (1 - AMB) * Math.Min(LIT_MAX, l / 1.1));
                    if (layer == 4)
                    {
                        bool up = wy > 0 && PF[pfRow - LW + gx] == 0, up2 = wy > 1 && PF[pfRow - 2 * LW + gx] == 0, dn = wy < MH - 1 && PF[pfRow + LW + gx] == 0;
                        if (up) k *= RIM; else if (up2) k *= 1 + (RIM - 1) * 0.4; else if (dn) k *= UNDER;
                    }
                }
                outc[i] = Math.Abs(k - 1) > 0.01 ? ShadeF(v, k) : v;
                if (l > 0.02 && layer >= 3)
                {
                    double s3 = layer == 4 ? 1 : 0.5;
                    LB[i] = 0xff000000u | ((uint)(int)Math.Min(255, TB[i] * s3) << 16) | ((uint)(int)Math.Min(255, TG[i] * s3) << 8) | (uint)(int)Math.Min(255, TR[i] * s3);
                }
            }
        }

        /// 前景：在角色和特效之後畫，蓋在最上面。
        public void DrawForeground(Frame frame)
        {
            var FGI = D.Fg;
            if (FGI == null || FGI.Empty) return;
            int W = frame.W, cy = frame.Oy, of = (int)Math.Floor(frame.Ox * PAR_F);
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
                int r = sy * FGI.W, row = y * W;
                for (int x = 0; x < W; x++)
                {
                    uint v = FGI.Px[r + Wrap(x + of, FGI.W)];
                    if (v != 0) outc[row + x] = v;
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
            int W = frame.W, Hh = frame.H, os = (int)Math.Floor(frame.Ox * SHAFT_PAR);
            uint[] Lb = frame.Light, Cb = frame.Color;
            double flicker = 0.75 + 0.25 * Math.Sin(time * 1.3);
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
                int x = Wrap((int)Math.Floor(Pf.Rand(n, 71) * 1440) + (int)Pf.Round(Math.Sin(time * 0.8 + n) * 3) - om, 1440);
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
