// 裝備效果的小特效：game/src/setfx.js（套裝與神話：流星記號、小流星、夜宴護盾、星辰共鳴、星王化）
// 與 corefx.js（星核：彗尾、暈眩星星）翻成 C#。
using System;
using System.Collections.Generic;
using System.Linq;
using PixelFX;

namespace ZeroStar
{
    public static class SetFx
    {
        static uint P(string c) => Col.Hex(c);
        static readonly uint[] GOLD = new[] { "#6e3a0c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff" }.Select(P).ToArray();
        static readonly uint[] RED = new[] { "#4a0a18", "#8a1a2a", "#d42e36", "#ff6a52", "#ffc0b0" }.Select(P).ToArray();
        static readonly uint[] CY = new[] { "#0c2a60", "#1e64b0", "#3ab8f0", "#9af0ff", "#f0ffff" }.Select(P).ToArray();
        public const double STRIKE_T = 0.22;
        static void Put(Frame f, double x, double y, uint c, bool glow = false) => PutPx.Put(f, x, y, c, glow);

        /// 流星記號：中心 (x, y)，t 秒
        public static void DrawMark(Frame f, double x, double y, double t)
        {
            bool big = (long)Math.Floor(t * 6) % 2 == 0; int r = big ? 3 : 2;
            var cells = new List<(int, int, int)> { (0, 0, 5) };
            for (int k = 1; k <= r; k++) { int c = k == 1 ? 4 : k == 2 ? 3 : 2; cells.Add((k, 0, c)); cells.Add((-k, 0, c)); cells.Add((0, k, c)); cells.Add((0, -k, c)); }
            if (big) foreach (var (dx, dy) in new[] { (1, 1), (-1, -1), (1, -1), (-1, 1) }) cells.Add((dx, dy, 2));
            var has = new HashSet<(int, int)>(cells.Select(c => (c.Item1, c.Item2)));
            foreach (var (dx, dy, _) in cells) foreach (var (ox, oy) in new[] { (1, 0), (-1, 0), (0, 1), (0, -1) }) if (!has.Contains((dx + ox, dy + oy))) Put(f, x + dx + ox, y + dy + oy, GOLD[0]);
            foreach (var (dx, dy, c) in cells) Put(f, x + dx, y + dy, GOLD[c], true);
        }
        /// 小流星：從右上 (x+30, y-60) 砸到 (x, y)
        public static void DrawStrike(Frame f, double sx, double sy, double st)
        {
            double k = Math.Min(1, st / STRIKE_T), hx = sx + 30 * (1 - k), hy = sy - 60 * (1 - k);
            for (int i = 0; i < 20; i++)
            {
                double tx = hx + i * 0.5, ty = hy - i; uint c = i < 3 ? GOLD[4] : i < 7 ? GOLD[3] : i < 12 ? GOLD[2] : GOLD[1];
                Put(f, tx, ty, c, i < 12);
                if (i < 12) Put(f, tx + 1, ty, i < 5 ? GOLD[3] : GOLD[1], i < 8);
            }
            for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) Put(f, hx + dx, hy + dy, dx == 0 && dy == 0 ? GOLD[5] : GOLD[4], true);
            foreach (var (dx, dy) in new[] { (-2, 0), (2, 0), (0, -2), (0, 2) }) Put(f, hx + dx, hy + dy, GOLD[3], true);
        }
        /// 夜宴護盾：中心 (x, y)，k＝護盾量 0～1
        public static void DrawShield(Frame f, double x, double y, double k, double t)
        {
            const int R = 15, n = 140; double spin = t * 2, len = Math.Max(0.3, k);
            for (int i = 0; i < n; i++)
            {
                double fr = i / (double)n;
                if (fr > len) continue;
                double a = fr * Math.PI * 2 - Math.PI / 2 + spin * 0.3, px = x + Pf.Cos(a) * R, py = y + Pf.Sin(a) * R * 1.15;
                bool top = Pf.Sin(a) < 0; double d = Math.Abs(((a - spin) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
                Put(f, px, py, d < 0.3 ? RED[4] : top ? RED[3] : RED[2], d < 0.3);
                Put(f, x + Pf.Cos(a) * (R - 1), y + Pf.Sin(a) * (R - 1) * 1.15, top ? RED[2] : RED[1]);
            }
        }
        /// 星辰共鳴：三顆繞圈的青色光點
        public static void DrawReson(Frame f, double x, double y, double t)
        {
            for (int k = 0; k < 3; k++)
            {
                double a = t * 4 + (k * Math.PI * 2) / 3;
                for (int q = 4; q >= 0; q--)
                {
                    double b = a - q * 0.16, px = x + Pf.Cos(b) * 14, py = y + Pf.Sin(b) * 6 - 4; uint c = q == 0 ? CY[4] : q < 2 ? CY[3] : q < 4 ? CY[2] : CY[1];
                    Put(f, px, py, c, true);
                    if (q == 0) { Put(f, px + 1, py, CY[3], true); Put(f, px, py + 1, CY[3], true); Put(f, px + 1, py + 1, CY[2], true); }
                }
            }
        }
        static readonly string[] CROWN = { ".G....G....G.", ".GH...GH...GH", ".GHG.GHHG.GHI", ".GHHGHHHHGHHI", ".GrHHHbHHHrHI", "..GHHHHHHHHI.", "..IJJJJJJJJI." };
        static readonly uint J = P("#6e3a0c");
        /// 星王化：主角之前畫（光芒、星屑）
        public static void DrawKingBack(Frame f, double x, double y, double t)
        {
            for (int k = 0; k < 8; k++)
            {
                double a = t * 0.6 + (k * Math.PI) / 4; int len = k % 2 != 0 ? 16 : 22; double nx = -Pf.Sin(a), ny = Pf.Cos(a);
                for (int r = 8; r < len; r++)
                {
                    double fr = (r - 8) / (double)(len - 8); uint c = fr < 0.3 ? GOLD[3] : fr < 0.65 ? GOLD[2] : GOLD[1];
                    Put(f, x + Pf.Cos(a) * r, y + Pf.Sin(a) * r, c, fr < 0.5);
                    if (fr < 0.4) Put(f, x + Pf.Cos(a) * r + nx, y + Pf.Sin(a) * r + ny, GOLD[2]);
                }
            }
            for (int k = 0; k < 5; k++)
            {
                double p = (t * 0.7 + k / 5.0) % 1, sx = x - 12 + ((k * 7) % 24) + Pf.Sin(p * 6 + k) * 2, sy = y + 12 - p * 34;
                Put(f, sx, sy, p < 0.5 ? GOLD[5] : GOLD[3], true);
            }
        }
        /// 星王化：主角之後畫（王冠）
        public static void DrawKingFront(Frame f, double x, double y, double t)
        {
            double cy = Pf.Round(y - 28 + Pf.Sin(t * 3)), cx = x - 6;
            uint Cc(char ch) => ch == 'G' ? GOLD[2] : ch == 'H' ? GOLD[3] : ch == 'I' ? GOLD[1] : ch == 'J' ? J : ch == 'r' ? P("#ff4a5a") : P("#5ab8ff");
            bool At(int i, int j) => j >= 0 && j < CROWN.Length && i >= 0 && i < CROWN[j].Length && CROWN[j][i] != '.';
            for (int j = -1; j <= CROWN.Length; j++) for (int i = -1; i <= 13; i++) if (!At(i, j) && (At(i + 1, j) || At(i - 1, j) || At(i, j + 1) || At(i, j - 1))) Put(f, cx + i, cy + j, J);
            for (int j = 0; j < CROWN.Length; j++) for (int i = 0; i < CROWN[j].Length; i++) { char ch = CROWN[j][i]; if (ch != '.') Put(f, cx + i, cy + j, Cc(ch), ch == 'r' || ch == 'b'); }
        }
    }

    public static class CoreFx
    {
        static readonly uint[] G = new[] { "#6e3a0c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff" }.Select(Col.Hex).ToArray();
        public const double TRAIL_T = 0.5;
        static void Put(Frame f, double x, double y, uint c, bool glow = false) => PutPx.Put(f, x, y, c, glow);
        static double Hash(double n) { double s = Pf.Sin(n * 127.1) * 43758.5453; return s - Math.Floor(s); }
        public class TrailPt { public double X, Y, T, Seed; }
        /// 彗尾：照時間順序的點，相鄰兩點之間補滿
        public static void DrawTrail(Frame f, List<TrailPt> pts)
        {
            for (int n = 0; n < pts.Count; n++)
            {
                var p = pts[n]; var q = n + 1 < pts.Count ? pts[n + 1] : p; double steps = Math.Max(1, Pf.Round(Math.Abs(q.X - p.X)));
                for (int s = 0; s < steps; s++)
                {
                    double fr = s / steps, x = p.X + (q.X - p.X) * fr, y = p.Y + (q.Y - p.Y) * fr, k = (p.T + (q.T - p.T) * fr) / TRAIL_T;
                    if (k >= 1 || k < 0) continue;
                    int lvl = k < 0.12 ? 5 : k < 0.3 ? 4 : k < 0.55 ? 3 : k < 0.8 ? 2 : 1; bool h = k < 0.45;
                    Put(f, x, y, G[lvl], k < 0.4);
                    if (h) { Put(f, x, y - 1, G[Math.Max(1, lvl - 2)]); Put(f, x, y + 1, G[Math.Max(0, lvl - 3)]); }
                }
                double kk = p.T / TRAIL_T, r = Hash(p.Seed), side = r < 0.5 ? -1 : 1;
                if (kk < 1 && r < 0.6)
                {
                    double sx = p.X + (Hash(p.Seed + 1) - 0.5) * 4, sy = p.Y + side * (4 + kk * 10); uint c = G[kk < 0.4 ? 4 : kk < 0.7 ? 3 : 1];
                    Put(f, sx, sy, c, kk < 0.5);
                    if (kk < 0.35) { Put(f, sx + 1, sy, G[2]); Put(f, sx - 1, sy, G[2]); Put(f, sx, sy - 1, G[2]); Put(f, sx, sy + 1, G[2]); }
                }
            }
        }
        static readonly string[] STAR = { "..a..", ".aba.", "abcba", ".aba.", "..a.." };
        static readonly uint OUTC = Col.Hex("#2a1406");
        /// 暈眩：(x, y) 是頭頂，兩顆小星星繞圈
        public static void DrawDizzy(Frame f, double x, double y, double t)
        {
            for (int i = 0; i < 2; i++)
            {
                double a = t * 7 + i * Math.PI; double px = Pf.Round(x + Pf.Cos(a) * 8) - 2, py = Pf.Round(y - 4 + Pf.Sin(a) * 2) - 2; bool front = Pf.Sin(a) > 0;
                uint C(char ch) => front ? (ch == 'a' ? G[2] : ch == 'b' ? G[4] : G[5]) : (ch == 'a' ? G[1] : ch == 'b' ? G[2] : G[3]);
                bool At(int u, int v) => v >= 0 && v < 5 && u >= 0 && u < 5 && STAR[v][u] != '.';
                for (int v = -1; v <= 5; v++) for (int u = -1; u <= 5; u++) if (!At(u, v) && (At(u + 1, v) || At(u - 1, v) || At(u, v + 1) || At(u, v - 1))) Put(f, px + u, py + v, OUTC);
                for (int v = 0; v < 5; v++) for (int u = 0; u < 5; u++) { char ch = STAR[v][u]; if (ch != '.') Put(f, px + u, py + v, C(ch), front && ch != 'a'); }
            }
        }
    }
}
