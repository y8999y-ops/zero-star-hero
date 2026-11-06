// game/src/combatfx.js（命中閃光、火花、灰塵、傷害跳字）與 alertfx.js（怪發現主角的「!」）翻成 C#。
using System;
using System.Collections.Generic;
using System.Linq;
using PixelFX;

namespace ZeroStar
{
    /// 遊戲用的亂數（網頁版的 Math.random）。測試時設固定種子。
    public static class Rnd
    {
        public static Rng R = new Rng((uint)Environment.TickCount);
        public static double Next() => R.Next();
    }

    public interface IBoxed { bool Dead { get; } double X { get; } (double x0, double x1, double y0, double y1) Box(); }

    public class CombatFx
    {
        static uint C(string s) => Col.Hex(s);
        static readonly uint OUT = C("#120c1a");
        static readonly Dictionary<string, uint[]> SPARK = new Dictionary<string, uint[]>
        {
            ["star"] = new[] { "#ffffff", "#fff6cf", "#ffe27a", "#f0b42e", "#b8701a" }.Select(C).ToArray(),
            ["slime"] = new[] { "#f0fff0", "#d4ffb0", "#8ee86a", "#4cc04a", "#2a8a3a" }.Select(C).ToArray(),
            ["can"] = new[] { "#ffffff", "#fff3a6", "#ffc23d", "#ff8a2a", "#c44a1a" }.Select(C).ToArray(),
        };
        static readonly uint[] DUST = new[] { "#d0c8dc", "#a49cb4", "#7a7290", "#4e486a" }.Select(C).ToArray();
        static readonly uint[] NUM_N = { C("#fff8e8"), C("#c8b8a0") }, NUM_H = { C("#ffe27a"), C("#d08a1c") }, NUM_C = { C("#ffb060"), C("#e0401c") };

        public string Form = "star";
        uint[] Pal => SPARK.TryGetValue(Form, out var p) ? p : SPARK["star"];

        class FlashFx { public int X, Y; public double T; public bool Heavy; public uint[] Pal; public double Dir; }
        class Part { public double X, Y, Vx, Vy, Life, G, Px = double.NaN, Py = double.NaN; public uint Col; public bool Trail; }
        class Puff { public double X, Y, Vx, R0, R1, T, Life; }
        class Num { public IBoxed Target; public double X, Y, Total, Since, Age, Bump, Rise; public bool Crit, Heavy, Fading; public int Hits; }
        readonly List<FlashFx> flashes = new List<FlashFx>();
        readonly List<Part> parts = new List<Part>();
        readonly List<Puff> puffs = new List<Puff>();
        readonly List<Num> nums = new List<Num>();

        public void Hit(double x, double y, double dir, bool heavy)
        {
            var pal = Pal;
            flashes.Add(new FlashFx { X = (int)Pf.Round(x), Y = (int)Pf.Round(y), T = 0, Heavy = heavy, Pal = pal, Dir = dir });
            int n = heavy ? 7 : 3;
            for (int i = 0; i < n; i++)
            {
                double a = (Rnd.Next() - 0.5) * (heavy ? 2.2 : 1.6) + (dir < 0 ? Math.PI : 0), sp = (heavy ? 140 : 90) + Rnd.Next() * (heavy ? 120 : 60);
                double vx = Math.Cos(a) * sp, vy = Math.Sin(a) * sp - 30, life = (heavy ? 0.28 : 0.18) * (0.7 + Rnd.Next() * 0.6);
                parts.Add(new Part { X = x, Y = y, Vx = vx, Vy = vy, Life = life, Col = pal[1 + (i % 3)], Trail = heavy, G = 300 });
            }
        }

        /// 灰塵：jump（起跳）、double（二段跳）、land（落地）、step（腳步）、skid（急轉身）
        public void Dust(string kind, double x, double y, bool hard = false, double dir = 1)
        {
            x = Pf.Round(x); y = Pf.Round(y);
            if (kind == "step") { puffs.Add(new Puff { X = x, Y = y, Vx = 0, R0 = 0.5, R1 = 1.5, T = 0, Life = 0.2 }); return; }
            if (kind == "skid") { for (int i = 0; i < 3; i++) puffs.Add(new Puff { X = x + dir * (3 + i * 3), Y = y, Vx = dir * (40 - i * 10), R0 = 1, R1 = 2.5 - i * 0.4, T = 0, Life = 0.3 + i * 0.05 }); return; }
            if (kind == "double")
            {
                var pal = Pal;
                for (int i = 0; i < 8; i++)
                {
                    double a = (i / 8.0) * Math.PI * 2;
                    parts.Add(new Part { X = x, Y = y + 1, Vx = Math.Cos(a) * 46, Vy = Math.Sin(a) * 18 + 8, Life = 0.26, Col = pal[i % 2 != 0 ? 2 : 1], Trail = false, G = 0 });
                }
                puffs.Add(new Puff { X = x, Y = y + 1, Vx = 0, R0 = 2, R1 = 4, T = 0, Life = 0.18 });
                return;
            }
            int n = kind == "land" ? (hard ? 3 : 2) : 1; double sp = kind == "land" ? (hard ? 46 : 30) : 22;
            foreach (int s in new[] { -1, 1 }) for (int i = 0; i < n; i++)
                puffs.Add(new Puff { X = x + s * (2 + i * 2), Y = y, Vx = s * sp * (1 - i * 0.25), R0 = 1, R1 = (kind == "land" && hard ? 3 : 2) + (i == 0 ? 0 : -0.5), T = 0, Life = 0.28 + i * 0.06 });
        }

        /// 傷害跳字：同一隻 0.5 秒內再被打，就加到同一個數字上
        public void Damage(IBoxed target, double x, double y, double d, bool crit = false, bool heavy = false)
        {
            var old = nums.FirstOrDefault(q => q.Target == target && q.Since < 0.5 && !q.Fading);
            if (old != null)
            {
                old.Total += d; old.Since = 0; old.Bump = 0.1; old.Crit |= crit; old.Heavy |= heavy; old.Hits++;
                return;
            }
            nums.Add(new Num { Target = target, X = x, Y = y, Total = d, Since = 0, Age = 0, Bump = 0.1, Crit = crit, Heavy = heavy, Hits = 1, Rise = 0, Fading = false });
        }

        public void Update(double dt)
        {
            for (int i = flashes.Count - 1; i >= 0; i--) if ((flashes[i].T += dt) > (flashes[i].Heavy ? 0.2 : 0.12)) flashes.RemoveAt(i);
            for (int i = parts.Count - 1; i >= 0; i--)
            {
                var p = parts[i];
                if ((p.Life -= dt) <= 0) { parts.RemoveAt(i); continue; }
                p.Px = p.X; p.Py = p.Y;
                p.Vx *= 1 - 5 * dt; p.Vy = p.Vy * (1 - 5 * dt) + p.G * dt;
                p.X += p.Vx * dt; p.Y += p.Vy * dt;
            }
            for (int i = puffs.Count - 1; i >= 0; i--)
            {
                var p = puffs[i];
                if ((p.T += dt) >= p.Life) { puffs.RemoveAt(i); continue; }
                p.X += p.Vx * dt; p.Vx *= 1 - 6 * dt;
            }
            for (int i = nums.Count - 1; i >= 0; i--)
            {
                var q = nums[i];
                q.Since += dt; q.Age += dt; q.Bump -= dt;
                if (q.Target != null && !q.Target.Dead && q.Since < 0.5) { var b = q.Target.Box(); q.X += (q.Target.X - q.X) * Math.Min(1, dt * 12); q.Y = b.y0 - 3; }
                if (q.Since > 0.5) { q.Fading = true; q.Rise += 26 * dt; }
                if (q.Since > 0.95) nums.RemoveAt(i);
            }
        }

        static void Plot(Frame f, int x, int y, uint c)
        {
            int sx = x - f.Ox, sy = y - f.Oy;
            if (sx < 0 || sy < 0 || sx >= f.W || sy >= f.H) return;
            f.Color[sy * f.W + sx] = c;
        }

        public void Draw(Frame frame)
        {
            foreach (var p in puffs)
            {
                double k = p.T / p.Life, r = p.R0 + (p.R1 - p.R0) * Math.Min(1, k * 1.6); uint shade = DUST[Math.Min(3, (int)Math.Floor(k * 4))];
                int cx = (int)Pf.Round(p.X), cy = (int)Pf.Round(p.Y - r * 0.6 - k * 2), R = (int)Math.Ceiling(r);
                for (int y = -R; y <= R; y++) for (int x = -R; x <= R; x++)
                {
                    if (x * x + y * y > r * r + 0.3) continue;
                    if (k > 0.6 && (x + y + (int)Math.Floor(p.T * 30)) % 2 != 0) continue;
                    Plot(frame, cx + x, cy + y, y < 0 && x < 0 ? DUST[Math.Max(0, (int)Math.Floor(k * 4) - 1)] : shade);
                }
            }
            foreach (var f in flashes)
            {
                int x = f.X, y = f.Y; var pal = f.Pal; int step = (int)Math.Floor(f.T * 60 / (f.Heavy ? 3 : 2));
                if (!f.Heavy)
                {
                    int R = step == 0 ? 2 : step == 1 || step == 2 ? 4 : 0; bool core = step < 2;
                    for (int i = -R; i <= R; i++)
                    {
                        uint c = Math.Abs(i) <= 1 && core ? pal[0] : pal[Math.Abs(i) > R - 2 ? 3 : 1];
                        if (step == 2 && Math.Abs(i) < 3) continue;
                        Plot(frame, x + i, y, c); Plot(frame, x, y + i, c);
                    }
                    if (step == 1) foreach (var d in new[] { (1, 1), (-1, 1), (1, -1), (-1, -1) }) Plot(frame, x + d.Item1, y + d.Item2, pal[2]);
                }
                else
                {
                    if (step == 0)
                    {
                        for (int j = -4; j <= 4; j++) for (int i = -4; i <= 4; i++) if (Math.Abs(i) + Math.Abs(j) <= 4) Plot(frame, x + i, y + j, Math.Abs(i) + Math.Abs(j) <= 2 ? pal[0] : pal[1]);
                    }
                    else if (step <= 2)
                    {
                        int R = step == 1 ? 7 : 9;
                        for (int i = -R; i <= R; i++) { uint c = pal[Math.Abs(i) < 3 ? 0 : Math.Abs(i) > R - 3 ? 3 : 1]; Plot(frame, x + i, y, c); Plot(frame, x, y + i, c); }
                        int D = (int)Pf.Round(R * 0.6);
                        for (int i = -D; i <= D; i++) { uint c = pal[Math.Abs(i) > D - 2 ? 3 : 2]; Plot(frame, x + i, y + i, c); Plot(frame, x + i, y - i, c); }
                        int rr = step == 1 ? 6 : 8;
                        for (int a = 0; a < 32; a++) { if (step == 2 && a % 3 == 0) continue; Plot(frame, x + (int)Pf.Round(Math.Cos(a / 32.0 * Math.PI * 2) * rr), y + (int)Pf.Round(Math.Sin(a / 32.0 * Math.PI * 2) * rr * 0.8), pal[step == 1 ? 2 : 3]); }
                    }
                    else
                    {
                        for (int a = 0; a < 12; a++) if (a % 2 == 0) Plot(frame, x + (int)Pf.Round(Math.Cos(a / 12.0 * Math.PI * 2) * 11), y + (int)Pf.Round(Math.Sin(a / 12.0 * Math.PI * 2) * 9), pal[3]);
                    }
                }
            }
            foreach (var p in parts)
            {
                int x = (int)Pf.Round(p.X), y = (int)Pf.Round(p.Y);
                if (p.Trail && !double.IsNaN(p.Px)) Plot(frame, (int)Pf.Round((p.X + p.Px) / 2), (int)Pf.Round((p.Y + p.Py) / 2), p.Col);
                Plot(frame, x, y, p.Life < 0.06 ? DUST[1] : p.Col);
            }
        }

        // ---- 像素數字 3×5
        static readonly Dictionary<char, string[]> GLYPH = new Dictionary<char, string[]>
        {
            ['0'] = new[] { "111", "101", "101", "101", "111" }, ['1'] = new[] { "010", "110", "010", "010", "111" }, ['2'] = new[] { "111", "001", "111", "100", "111" },
            ['3'] = new[] { "111", "001", "011", "001", "111" }, ['4'] = new[] { "101", "101", "111", "001", "001" }, ['5'] = new[] { "111", "100", "111", "001", "111" },
            ['6'] = new[] { "111", "100", "111", "101", "111" }, ['7'] = new[] { "111", "001", "001", "010", "010" }, ['8'] = new[] { "111", "101", "111", "101", "111" },
            ['9'] = new[] { "111", "101", "111", "001", "111" }, ['!'] = new[] { "1", "1", "1", "0", "1" },
        };
        /// 傷害數字：最後畫（在前景之上），推到看得到的範圍裡，彼此不重疊。view＝看得到的範圍（畫布座標）
        public void DrawNumbers(Frame frame, (double x0, double y0, double w, double h) v)
        {
            int W = frame.W, H = frame.H, ox = frame.Ox, oy = frame.Oy;
            var placed = new List<(int x, int y, int w, int h)>();
            var list = nums.OrderBy(q => q.Age).ToList();   // 穩定排序，跟 JS 一樣
            foreach (var q in list)
            {
                string text = ((long)q.Total).ToString() + (q.Crit ? "!" : "");
                bool big = q.Crit || q.Heavy || q.Hits >= 3;
                int s = big ? 2 : 1, gap = 1;
                int wpx = -gap; foreach (char ch in text) wpx += GLYPH[ch][0].Length * s + gap;
                int hpx = 5 * s;
                int x = (int)Pf.Round(q.X - ox - wpx / 2.0), y = (int)Pf.Round(q.Y - oy - hpx - q.Rise - (q.Bump > 0 ? 2 : 0));
                x = (int)Math.Max(Math.Ceiling(v.x0) + 2, Math.Min(Math.Floor(v.x0 + v.w) - wpx - 2, x));
                y = (int)Math.Max(Math.Ceiling(v.y0) + 2, Math.Min(Math.Floor(v.y0 + v.h) - hpx - 2, y));
                foreach (var p in placed) if (x < p.x + p.w + 2 && x + wpx + 2 > p.x && y < p.y + p.h + 2 && y + hpx + 2 > p.y) y = p.y - hpx - 3;
                y = (int)Math.Max(Math.Ceiling(v.y0) + 2, y);
                placed.Add((x, y, wpx, hpx));
                var cols = q.Crit ? NUM_C : q.Heavy || q.Hits >= 3 ? NUM_H : NUM_N;
                var pixels = new List<(int, int, bool)>();
                int cx = x;
                foreach (char ch in text)
                {
                    var g = GLYPH[ch];
                    for (int j = 0; j < g.Length; j++) for (int i = 0; i < g[j].Length; i++)
                        if (g[j][i] == '1') for (int a = 0; a < s; a++) for (int b = 0; b < s; b++) pixels.Add((cx + i * s + a, y + j * s + b, j >= 3));
                    cx += g[0].Length * s + gap;
                }
                if (q.Since > 0.8 && (int)Math.Floor(q.Since * 30) % 2 != 0) continue;
                uint[] Cb = frame.Color;
                void Put(int px, int py, uint c) { if (px >= 0 && py >= 0 && px < W && py < H) Cb[py * W + px] = c; }
                foreach (var (px, py, _) in pixels) { Put(px - 1, py, OUT); Put(px + 1, py, OUT); Put(px, py - 1, OUT); Put(px, py + 1, OUT); Put(px + 1, py + 1, OUT); }
                foreach (var (px, py, low) in pixels) Put(px, py, low ? cols[1] : cols[0]);
            }
        }

        // ---- 怪物發現主角的「!」（alertfx.js，只搬 big＝1）
        public const double ALERT_T = 0.7;
        static readonly uint[] AL_N = new[] { "#fff6c8", "#ffd84a", "#e08a1a", "#3a1a06", "#ffffff" }.Select(C).ToArray();
        static readonly uint[] AL_E = new[] { "#ffd0c0", "#ff6a52", "#c02030", "#3a0812", "#ffffff" }.Select(C).ToArray();
        static List<(int x, int y, int v)> Glyph(int h)
        {
            var px = new List<(int, int, int)>();
            for (int y = 0; y < h; y++) for (int x = 0; x < 2; x++) px.Add((x, y, y == 0 && x == 0 ? 4 : y < 1 ? 0 : y < h - 1 ? 1 : 2));
            for (int x = 0; x < 2; x++) { px.Add((x, h + 2, 1)); px.Add((x, h + 3, 2)); }
            return px;
        }
        static readonly List<(int x, int y, int v)> BAR = Glyph(5), SQUASH = Glyph(3);
        public static void DrawAlert(Frame frame, double x, double y, double t, bool elite = false)
        {
            if (t >= ALERT_T) return;
            if (t > ALERT_T - 0.15 && (int)Math.Floor(t * 30) % 2 != 0) return;
            uint[] Cc = frame.Color; int W = frame.W, H = frame.H, ox = frame.Ox, oy = frame.Oy; var R = elite ? AL_E : AL_N;
            var shape = t < 0.06 ? SQUASH : BAR; int lift = t < 0.06 ? 0 : t < 0.14 ? 3 : t < 0.2 ? 1 : 0;
            int hgt = shape == SQUASH ? 7 : 9; int[] copies = elite ? new[] { -3, 2 } : new[] { 0 };
            int top = (int)Pf.Round(y) - (hgt + 4) + 4 - lift, left = (int)Pf.Round(x) - 1;
            var order = new List<(int, int)>(); var cells = new Dictionary<(int, int), int>();
            foreach (int cx in copies) foreach (var (gx, gy, v) in shape)
            {
                var k = (left + cx + gx, top + gy);
                if (!cells.ContainsKey(k)) order.Add(k);
                cells[k] = v;
            }
            void Put(int px, int py, uint c) { px -= ox; py -= oy; if (px >= 0 && py >= 0 && px < W && py < H) Cc[py * W + px] = c; }
            var nb = new[] { (1, 0), (-1, 0), (0, 1), (0, -1) };
            foreach (var (px, py) in order) foreach (var (dx, dy) in nb) if (!cells.ContainsKey((px + dx, py + dy))) Put(px + dx, py + dy, R[3]);
            foreach (var k in order) Put(k.Item1, k.Item2, R[cells[k]]);
        }
    }
}
