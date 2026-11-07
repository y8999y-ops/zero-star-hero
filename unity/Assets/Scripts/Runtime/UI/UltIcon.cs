// game/src/ult-icon.js 翻成 C#：大招鍵的圖示（29×29）。玻璃圓底；外圈 20 段能量環從正上方順時針亮起；
// 中間一顆有稜面的五角星，能量像金色液體從下往上灌滿；集滿：整顆星亮一階、白色星心、斜斜的掃光、星角輪流閃十字光、外環一段白光在繞。
using System;
using UnityEngine;

namespace ZeroStar.UI
{
    public static class UltIcon
    {
        public const int S = 29; const int C = 14;
        static readonly int[][] G = { Rgb("#3a1a06"), Rgb("#7a3c0c"), Rgb("#b8661a"), Rgb("#e8a028"), Rgb("#ffd24a"), Rgb("#ffee98"), Rgb("#fffbe6") };
        static readonly int[][] E = { Rgb("#0c0818"), Rgb("#2a2248"), Rgb("#3a3062"), Rgb("#5c5090") };
        static readonly int[] WHITE = { 255, 255, 255 };
        static int[] Rgb(string h) => new[] { Convert.ToInt32(h.Substring(1, 2), 16), Convert.ToInt32(h.Substring(3, 2), 16), Convert.ToInt32(h.Substring(5, 2), 16) };
        const double SX = C, SY = C + 0.6, RO = 10.2, RI = 4.3;
        static readonly double[][] PTS = new double[10][];
        static readonly float[] FACET = new float[S * S]; static readonly byte[] STAR = new byte[S * S], OUT = new byte[S * S], RING = new byte[S * S];
        static int TOP = S, BOT = 0; static readonly int[][] TIPS = new int[5][];
        static UltIcon()
        {
            for (int i = 0; i < 10; i++) { double a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 != 0 ? RI : RO; PTS[i] = new[] { SX + Math.Cos(a) * r, SY + Math.Sin(a) * r }; }
            for (int y = 0; y < S; y++) for (int x = 0; x < S; x++)
            {
                if (!InStar(x + 0.5, y + 0.5)) continue;
                int i = y * S + x; STAR[i] = 1; TOP = Math.Min(TOP, y); BOT = Math.Max(BOT, y);
                double a = Math.Atan2(y + 0.5 - SY, x + 0.5 - SX), arm = Math.Round((a + Math.PI / 2) / ((2 * Math.PI) / 5), MidpointRounding.AwayFromZero) * ((2 * Math.PI) / 5) - Math.PI / 2;
                double d = a - arm; d = Math.Atan2(Math.Sin(d), Math.Cos(d));
                double fa = arm + (d >= 0 ? 0.55 : -0.55);
                FACET[i] = (float)(Math.Cos(fa) * -0.6 + Math.Sin(fa) * -0.8);
            }
            for (int y = 0; y < S; y++) for (int x = 0; x < S; x++)
            {
                int i = y * S + x; if (STAR[i] != 0) continue;
                bool Has(int dx, int dy) { int xx = x + dx, yy = y + dy; return xx >= 0 && xx < S && yy >= 0 && yy < S && STAR[yy * S + xx] != 0; }
                if (Has(1, 0) || Has(-1, 0) || Has(0, 1) || Has(0, -1)) OUT[i] = 1;
            }
            for (int y = 0; y < S; y++) for (int x = 0; x < S; x++) { double r = Math.Sqrt((x - C) * (x - C) + (y - C) * (y - C)); RING[y * S + x] = (byte)(r > 14.4 ? 0 : r > 13.4 ? 1 : r > 11.6 ? 2 : 3); }
            for (int k = 0; k < 5; k++) { double x = PTS[k * 2][0], y = PTS[k * 2][1]; TIPS[k] = new[] { (int)Math.Round(x - 0.5 + (x - SX) * 0.02, MidpointRounding.AwayFromZero), (int)Math.Round(y - 0.5, MidpointRounding.AwayFromZero) }; }
        }
        static bool InStar(double x, double y)
        {
            bool ins = false;
            for (int i = 0, j = 9; i < 10; j = i++) { double xi = PTS[i][0], yi = PTS[i][1], xj = PTS[j][0], yj = PTS[j][1]; if ((yi > y) != (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins; }
            return ins;
        }
        /// 畫一格到 tex（S×S）。k：能量 0～1；t：秒
        public static void Draw(Texture2D tex, Color32[] buf, double k, double t)
        {
            Array.Clear(buf, 0, buf.Length);
            void Put(int i, int[] c, int a = 255) { int x = i % S, y = i / S; buf[(S - 1 - y) * S + x] = new Color32((byte)c[0], (byte)c[1], (byte)c[2], (byte)a); }
            bool full = k >= 1; k = Math.Max(0, Math.Min(1, k));
            const int segs = 20; double headF = k;
            for (int y = 0; y < S; y++) for (int x = 0; x < S; x++)
            {
                int i = y * S + x, L = RING[i];
                if (L == 0) continue;
                if (L == 1) { bool tl = x + y < S - 1; if (full) Put(i, tl ? G[4] : G[2]); else Put(i, tl ? new[] { 150, 140, 200 } : new[] { 70, 60, 110 }, tl ? 200 : 170); continue; }
                if (L == 2)
                {
                    double f = (Math.Atan2(x - C, -(y - C)) / (Math.PI * 2) + 1) % 1, seg = f * segs; bool gap = seg % 1 > 0.82;
                    if (gap) { Put(i, E[0], 200); continue; }
                    if (full) { double run = (((f - t * 0.6) % 1) + 1) % 1; Put(i, run < 0.06 ? WHITE : run < 0.14 ? G[5] : x + y < S ? G[3] : G[2]); }
                    else if (f < headF) Put(i, headF - f < 0.04 ? WHITE : headF - f < 0.09 ? G[5] : x + y < S ? G[4] : G[3]);
                    else Put(i, E[2], 230);
                    continue;
                }
                if (full) { double r = Math.Sqrt((x - SX) * (x - SX) + (y - SY) * (y - SY)); Put(i, r < 8 ? new[] { 70, 40, 12 } : new[] { 40, 22, 14 }, 190); }
                else Put(i, new[] { 14, 10, 28 }, 120);
            }
            double H = BOT - TOP + 1, level = BOT + 1 - k * H, sweep = ((t * 0.8) % 1.6) * 40 - 12;
            for (int y = 0; y < S; y++) for (int x = 0; x < S; x++)
            {
                int i = y * S + x;
                if (OUT[i] != 0) { bool filled = full || (k > 0 && y + 0.5 > level); Put(i, filled ? G[0] : E[0]); continue; }
                if (STAR[i] == 0) continue;
                double f = FACET[i]; int step = f > 0.55 ? 2 : f > 0 ? 1 : f > -0.5 ? 0 : -1;
                double wob = full ? 0 : Math.Sin(x * 0.9 + t * 6) * 0.6, yl = level + wob;
                if (full || (k > 0 && y + 0.5 > yl))
                {
                    int s = 3 + step;
                    if (!full && y + 0.5 - yl < 1) s = 6;
                    if (full)
                    {
                        double r = Math.Sqrt((x + 0.5 - SX) * (x + 0.5 - SX) + (y + 0.5 - SY) * (y + 0.5 - SY));
                        if (r < 1.6) s = 7; else if (r < 2.7) s = Math.Max(s, 6);
                        if (Math.Abs(x + y - sweep) < 1.2) s = Math.Max(s, 6);
                    }
                    Put(i, s >= 7 ? WHITE : G[Math.Max(1, Math.Min(6, s))]);
                }
                else
                {
                    bool rim = (x + 1 < S && OUT[i + 1] != 0) || (x > 0 && OUT[i - 1] != 0) || (y + 1 < S && OUT[i + S] != 0) || (y > 0 && OUT[i - S] != 0);
                    Put(i, rim && f > -0.2 ? E[3] : E[Math.Max(1, Math.Min(2, 1 + step))]);
                }
            }
            if (full)
            {
                int n = (int)Math.Floor(t / 0.22); double ph = (t / 0.22) % 1;
                void Cross(int tip, int arm)
                {
                    int px = TIPS[tip][0], py = TIPS[tip][1]; double dx = px - SX, dy = py - SY, l = Math.Sqrt(dx * dx + dy * dy);
                    int tx = (int)Math.Round(px + (dx / l) * 1.5, MidpointRounding.AwayFromZero), ty = (int)Math.Round(py + (dy / l) * 1.5, MidpointRounding.AwayFromZero);
                    for (int d = -arm; d <= arm; d++) foreach (var (x, y) in new[] { (tx + d, ty), (tx, ty + d) })
                    {
                        if (x < 0 || y < 0 || x >= S || y >= S) continue;
                        int a = Math.Abs(d); Put(y * S + x, a == 0 ? WHITE : a == 1 ? G[6] : G[4]);
                    }
                }
                Cross((n * 2) % 5, ph < 0.6 ? 3 : 2);
                if (ph < 0.5) Cross((((n - 1) * 2 + 20) % 5 + 5) % 5, 1);
            }
            if (!full && k > 0.05)
            {
                double p = (t * 0.9) % 1; int bx = (int)Math.Round(SX - 2 + Math.Sin(t * 1.7) * 3, MidpointRounding.AwayFromZero), by = (int)Math.Round(level - 1 - p * 4, MidpointRounding.AwayFromZero);
                if (by >= 0 && by < S && bx >= 0 && bx < S && STAR[by * S + bx] != 0 && p < 0.8) Put(by * S + bx, G[5]);
            }
            tex.SetPixels32(buf); tex.Apply(false);
        }
    }
}
