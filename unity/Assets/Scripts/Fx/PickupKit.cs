// pixelfx/src/fx/pickups/_lib.js 的其他部分翻成 C#：暫存圖層 Layer（畫好再描 1px 外框、整塊蓋上去）、
// 地上的柔影 BlobShadow、地上的一池光 Pool、翻轉的金幣 Coin、小寶石 Gemlet。（Glint 在 FxLib.cs 的 PickupLib。）
using System;
using static PixelFX.Pf;

namespace PixelFX.Fx
{
    /// 暫存圖層：用特效自己的座標畫一個小圖，描外框、換色，然後蓋到畫布上。
    public class PickupLayer
    {
        public readonly Frame F; readonly uint[] tmp;
        public PickupLayer(int w = 64, int h = 64) { F = new Frame(w, h); tmp = new uint[w * h]; }
        /// 清空，左上角放在本地座標 (x0, y0)
        public void Begin(double x0, double y0) { F.Ox = (int)Math.Floor(x0); F.Oy = (int)Math.Floor(y0); F.Clear(); }
        int Idx(double x, double y) { int i = (int)Math.Floor(x) - F.Ox, j = (int)Math.Floor(y) - F.Oy; return i < 0 || j < 0 || i >= F.W || j >= F.H ? -1 : j * F.W + i; }
        public uint Get(double x, double y) { int i = Idx(x, y); return i < 0 ? 0 : F.Color[i]; }
        public void Set(double x, double y, uint c) { int i = Idx(x, y); if (i >= 0) F.Color[i] = c; }
        /// 每格中心 (x + 0.5, y + 0.5) 呼叫 fn，回傳顏色或 0
        public void Fill(double x0, double y0, double x1, double y1, Func<double, double, uint> fn)
        {
            for (double y = Math.Floor(y0); y <= y1; y++)
                for (double x = Math.Floor(x0); x <= x1; x++)
                {
                    uint c = fn(x + 0.5, y + 0.5);
                    if (c != 0) Set(x, y, c);
                }
        }
        /// 畫過的東西外面描一圈 1px（c 一個顏色）
        public PickupLayer Outline(uint c, bool corners = false)
        {
            var C = F.Color; int w = F.W, h = F.H;
            Array.Clear(tmp, 0, tmp.Length);
            for (int j = 0; j < h; j++)
                for (int i = 0; i < w; i++)
                {
                    int k = j * w + i;
                    if (C[k] != 0) continue;
                    bool n = (i > 0 && C[k - 1] != 0) || (i < w - 1 && C[k + 1] != 0) || (j > 0 && C[k - w] != 0) || (j < h - 1 && C[k + w] != 0);
                    if (!n && corners) n = (i > 0 && j > 0 && C[k - w - 1] != 0) || (i < w - 1 && j > 0 && C[k - w + 1] != 0) || (i > 0 && j < h - 1 && C[k + w - 1] != 0) || (i < w - 1 && j < h - 1 && C[k + w + 1] != 0);
                    if (n) tmp[k] = c;
                }
            for (int k = 0; k < w * h; k++) if (tmp[k] != 0) C[k] = tmp[k];
            return this;
        }
        /// 蓋到畫筆上，偏移 (dx, dy)，透明度 a（網點）
        public PickupLayer Draw(Painter p, double dx = 0, double dy = 0, double a = 1)
        {
            var C = F.Color;
            for (int k = 0; k < C.Length; k++)
            {
                if (C[k] == 0) continue;
                double x = (k % F.W) + F.Ox + dx;
                p.Dot(x, Math.Floor((double)k / F.W) + F.Oy + dy, C[k], a);
            }
            return this;
        }
    }

    public static class PickupKit
    {
        static readonly uint INK = Col.Hex("#0b0814");

        /// 地上的柔影：x 置中、半寬 rx，地面那排網點變暗、中間比較濃，下面再短一排。k＝強度。
        public static void BlobShadow(Painter p, double x, double rx, double k = 1, double y = 0)
        {
            if (rx < 0.8 || k <= 0) return;
            for (double i = Math.Floor(x - rx); i <= Math.Ceiling(x + rx); i++)
            {
                double u = Math.Abs(i + 0.5 - x) / rx;
                if (u > 1) continue;
                double a = k * (1 - u * u);
                p.Dot(i, y, INK, a * 1.1);
                if (u < 0.6) p.Dot(i, y + 1, INK, a * 0.6);
            }
        }

        /// 地上的一池光（橢圓的加法光），中間 k、邊緣 0
        public static void Pool(Painter p, double x, double y, double rx, double ry, uint c, double k)
        {
            if (k <= 0.004 || rx < 1) return;
            p.Shade(x - rx, y - ry, x + rx, y + ry, (double px, double py, ref Painter.Out o) =>
            {
                double dx = (px - x) / rx, dy = (py - y) / ry, d = dx * dx + dy * dy;
                if (d >= 1) return;
                double f = 1 - Math.Sqrt(d);
                o.l = c;
                o.k = f * f * k;
            });
        }

        /// 半徑 r 的金幣翻滾：臉繞著畫面角度 ax 的軸轉 spin，側過來時露出邊。C：8 階金色。
        public static void Coin(PickupLayer L, Painter p, double x, double y, double r, double ax, double spin, uint[] C, bool white = false, double a = 1, bool snap = true)
        {
            double X = snap ? Round(x) : x, Y = snap ? Round(y) : y, cs = Cos(spin), sn = Sin(spin);
            double b = Math.Max(0.5, r * Math.Abs(cs)), th = 1.2 * sn * Sign(cs != 0 ? cs : 1), ca = Cos(ax), sa = Sin(ax);
            double face = Math.Abs(cs), R = Math.Ceiling(r) + 2;
            L.Begin(Math.Floor(X) - R, Math.Floor(Y) - R);
            L.Fill(Math.Floor(X) - R, Math.Floor(Y) - R, Math.Floor(X) + R, Math.Floor(Y) + R, (px, py) =>
            {
                double dx = px - X, dy = py - Y, u = dx * ca + dy * sa, w = -dx * sa + dy * ca;
                double ef = Hypot(u / r, w / b), er = Hypot(u / r, (w - th) / b);
                if (white && (ef <= 1 || er <= 1)) return Col.WHITE;
                if (ef <= 1)
                {
                    // 臉上：凸起的邊、裡面凹一圈、中間凸起有亮光
                    double lit = -(dx * 0.62 + dy * 0.78) / Math.Max(1, Hypot(dx, dy)); int dim = face < 0.45 ? 1 : 0;
                    if (b < 1.1) return lit > 0 ? C[6] : C[4];
                    if (ef > 0.72) return C[(lit > 0.3 ? 6 : lit > -0.35 ? 5 : 3) - dim];
                    if (b > 2.2 && ef > 0.42) return C[(lit > 0.2 ? 4 : 5) - dim];
                    if (face > 0.6 && lit > 0.5) return C[7];
                    return C[5 - dim];
                }
                if (er <= 1) return Math.Abs(w - th) < Math.Abs(w) ? C[2] : C[3];
                return 0;
            });
            L.Outline(C[1]).Draw(p, 0, 0, a);
        }

        static readonly double[][] GEM_N = { new[] { 0, -1.0 }, new[] { -0.7, -0.7 }, new[] { 0.7, -0.7 }, new[] { -0.6, 0.8 }, new[] { 0, 1.0 }, new[] { 0.6, 0.8 } };
        /// 半徑 r 的小寶石轉到角度 ang：冠部有桌面、下面尖尖的亭部，各面受左上的光；G：暗到亮（6 階以上）
        public static void Gemlet(PickupLayer L, Painter p, double x, double y, double r, double ang, uint[] G, bool white = false, double a = 1)
        {
            double X = Round(x), Y = Round(y), ca = Cos(ang), sa = Sin(ang); int n = G.Length; double R = Math.Ceiling(r * 1.4) + 2;
            double ct = r * 0.75, tw = r * 0.5, pv = r * 1.3;
            L.Begin(X - R, Y - R);
            L.Fill(X - R, Y - R, X + R - 1, Y + R - 1, (px, py) =>
            {
                double dx = px - X, dy = py - Y, u = dx * ca + dy * sa, w = -dx * sa + dy * ca;
                int facet;
                if (w < 0)
                {
                    if (w < -ct || Math.Abs(u) > r - ((-w) / ct) * (r - tw)) return 0;
                    facet = w < -ct * 0.45 && Math.Abs(u) < tw * 0.95 ? 0 : u < 0 ? 1 : 2;
                }
                else
                {
                    if (w > pv || Math.Abs(u) > r * (1 - w / pv)) return 0;
                    facet = Math.Abs(u) < 0.5 ? 4 : u < 0 ? 3 : 5;
                }
                if (white) return Col.WHITE;
                // 每一面的法線跟著寶石轉；光從畫面左上來
                var N = GEM_N[facet];
                double nx = N[0] * ca - N[1] * sa, ny = N[0] * sa + N[1] * ca, l = -(nx * 0.62 + ny * 0.78);
                if (facet == 0 && l > 0.3 && u < 0) return Col.WHITE;
                return l > 0.6 ? G[n - 1] : l > 0.2 ? G[n - 2] : l > -0.2 ? G[n - 3] : l > -0.6 ? G[n - 4] : G[n - 5];
            });
            L.Outline(G[0]).Draw(p, 0, 0, a);
        }
    }
}
