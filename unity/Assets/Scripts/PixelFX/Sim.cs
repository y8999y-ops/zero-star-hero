// pixelfx core 的 sim.js（模擬粒子、碎塊、會閃滅的光、星芒、八道光、斜面光環）、shapes.js（閃電路徑）、
// particles.js（cycle）翻成 C#。運算順序、亂數取用順序都照原本，模擬結果才會跟網頁版一模一樣。
// 單位：像素、秒；都畫在特效自己的座標裡（經過畫筆，鏡像、旋轉一樣有效）。
using System;
using System.Collections.Generic;
using static PixelFX.Pf;

namespace PixelFX
{
    /// 粒子種類（sim.js 的 P）。
    public static class P
    {
        public const int SPARK = 0, MOTE = 1, STREAK = 2, FLAKE = 3, VAPOUR = 4, DUST = 5, STAR = 6, EMBER = 7, SMOKE = 8, FIRE = 9, BRAND = 10, GRIT = 11;
    }
    /// 粒子旗標（sim.js 的 PF）：SMOKES（火團燒完變煙）、BIG（大煙）、BACK（畫在後面）。
    public static class PFlag
    {
        public const int SMOKES = 1, BIG = 2, BACK = 4;
    }

    public static class Sim
    {
        public const double GRAVITY = 950;
        public static readonly int[][] CROSS = { new[] { 1, 0 }, new[] { -1, 0 }, new[] { 0, 1 }, new[] { 0, -1 } };
        public static readonly int[][] DIAG = { new[] { 1, 1 }, new[] { 1, -1 }, new[] { -1, 1 }, new[] { -1, -1 } };
        public static readonly uint[] HOT = Col.Ramp(new[] { "#fff3a6", "#ffe26b", "#ff8a2a", "#f2561d" });
        public static readonly uint[] FIRE_RAMP = Col.Ramp(new[] { "#ffffff", "#fff3a6", "#ffe26b", "#ffc23d", "#ff8a2a", "#f2561d", "#c9281f", "#8a1f17", "#4a1712" });
        public static readonly uint[] SMOKE_RAMP = Col.Ramp(new[] { "#7b6f72", "#5d5660", "#433d48", "#2b2630", "#1a171e" });
        public static uint RampAt(uint[] r, double t) => r[(int)Math.Min(r.Length - 1, Math.Max(0, Math.Floor(t * r.Length)))];
        public static bool Soft(int k) => k == P.VAPOUR || k == P.DUST || k == P.SMOKE;

        /// 星芒：長度 arm 的十字臂（顏色 c、尖端 tip）、白色中心、光。
        public static void Sparkle(Painter p, double x, double y, double arm, uint c, uint tip, double k = 0.6)
        {
            double n = Round(arm);
            if (n < 1) return;
            double X = Math.Floor(x), Y = Math.Floor(y);
            for (double d = 1; d <= n; d++)
            {
                uint cc = d > n * 0.6 ? tip : c;
                foreach (var q in CROSS) p.Px(X + q[0] * d, Y + q[1] * d, cc);
            }
            if (n >= 3) foreach (var q in DIAG) p.Px(X + q[0], Y + q[1], c);
            if (n >= 6) foreach (var q in DIAG) p.Px(X + q[0] * 2, Y + q[1] * 2, tip);
            p.Px(X, Y, Col.WHITE);
            p.Glow(x, y, 4 + n * 2, c, k);
        }
        public static void Sparkle(Painter p, double x, double y, double arm, uint c) => Sparkle(p, x, y, arm, c, c, 0.6);

        /// 八道光：軸上長、斜的短，越外面越淡。ramp 暗到亮。
        public static void Flare(Painter p, double x, double y, double L, double k, uint[] R)
        {
            if (L < 1) return;
            int n = R.Length;
            for (int i = 0; i < 8; i++)
            {
                double an = (i * Math.PI) / 4, len = i % 4 == 0 ? L : i % 2 == 0 ? L * 0.6 : L * 0.3, ca = Cos(an), sa = Sin(an);
                for (double d = 0; d <= len; d += 0.5)
                {
                    double u = d / len;
                    p.Dot(x + ca * d, y + sa * d, u < 0.35 ? Col.WHITE : u < 0.7 ? R[n - 2] : R[n - 3], u < 0.6 ? 1 : k * 1.5 * (1 - u) + 0.2);
                }
            }
        }

        /// 斜面上的光環（sy 壓扁：0.16 貼地、1 立起來），厚度 th 往內，keep(角度) 決定畫哪一段（遠半邊／近半邊）。
        public static void Band(Painter p, double cx, double cy, double r, double sy, double th, double k, uint[] R, Func<double, bool> keep = null, bool hot = false)
        {
            if (r <= 0 || k <= 0) return;
            long __t = PfProf.T0(); try {
            int n = R.Length;
            for (int j = 0, m = (int)Math.Ceiling(r * TAU * 1.2); j < m; j++)
            {
                double ang = ((double)j / m) * TAU, ca = Cos(ang), sa = Sin(ang);
                if (keep != null && !keep(ang)) continue;
                for (double o = th; o >= 0; o -= 0.5)
                {
                    double u = o / th;
                    uint c = u < 0.15 ? (hot ? Col.WHITE : R[n - 1]) : u < 0.4 ? R[n - 2] : u < 0.7 ? R[n - 3] : R[n - 4];
                    p.Dot(cx + ca * (r - o), cy + sa * (r - o) * sy, c, k * (u < 0.4 ? 1.2 : 1.15 - u));
                }
            }
            } finally { PfProf.T1("Band", __t); }
        }

        // ---- shapes.js
        /// 閃電路徑：中點位移 depth 次。回傳點列。
        public static List<double[]> Bolt(Rng r, double x0, double y0, double x1, double y1, double jag = 0.22, int depth = 5)
        {
            var pts = new List<double[]> { new[] { x0, y0 }, new[] { x1, y1 } };
            for (int d = 0; d < depth; d++)
            {
                var next = new List<double[]> { pts[0] };
                for (int i = 1; i < pts.Count; i++)
                {
                    double ax = pts[i - 1][0], ay = pts[i - 1][1], bx = pts[i][0], by = pts[i][1], dx = bx - ax, dy = by - ay, L = Hypot(dx, dy);
                    double off = (r.Next() * 2 - 1) * jag * L, Ld = L != 0 ? L : 1;
                    next.Add(new[] { (ax + bx) / 2 + (-dy / Ld) * off, (ay + by) / 2 + (dx / Ld) * off });
                    next.Add(pts[i]);
                }
                pts = next;
            }
            return pts;
        }
        /// 從閃電路徑分岔出 count 條。
        public static List<List<double[]>> Forks(Rng r, List<double[]> path, int count = 3, double len = 20, double jag = 0.3, double spread = 0.9)
        {
            var o = new List<List<double[]>>();
            for (int k = 0; k < count; k++)
            {
                int i = 1 + (int)Math.Floor(r.Next() * (path.Count - 2));
                double x = path[i][0], y = path[i][1], px = path[i - 1][0], py = path[i - 1][1];
                double s = r.Next() < 0.5 ? -1 : 1;
                double a = Atan2(y - py, x - px) + s * spread * (0.4 + 0.6 * r.Next());
                double l = len * (0.4 + 0.6 * r.Next());
                o.Add(Bolt(r, x, y, x + Cos(a) * l, y + Sin(a) * l, jag, 3));
            }
            return o;
        }

        // ---- particles.js
        /// 每 period 秒重複的粒子（無縫迴圈）：對每個活著的複本呼叫 fn(age, life, rng, i)。
        public static void Cycle(double t, double period, int count, int seed, Func<Rng, double> life, Action<double, double, Rng, int> fn)
        {
            for (int i = 0; i < count; i++)
            {
                var g = Rng.Of(seed, i, 911);
                double born = g.Next() * period;
                double L = life(g);
                double age = (((t - born) % period) + period) % period;
                for (; age < L; age += period) fn(age, L, Rng.Of(seed, i), i);
            }
        }
        public static void Cycle(double t, double period, int count, int seed, double life, Action<double, double, Rng, int> fn) =>
            Cycle(t, period, count, seed, g => life, fn);
    }

    /// 一顆模擬粒子。
    public class Particle
    {
        public int k, flag; public double x, y, vx, vy, life, max, size, seed, delay; public uint col;
    }

    /// 粒子系統（sim.js 的 Particles）。
    public class Particles
    {
        public Rng R;
        public List<Particle> List = new List<Particle>();
        public double t;
        public Func<double, double> Ground = x => double.PositiveInfinity;
        public uint[] Sparks = Sim.HOT;
        public uint Haze; public bool HasHaze;
        public Action<double, double> OnLand;

        public Particles(Rng rng = null, int seed = 1, uint[] sparks = null, Func<double, double> ground = null)
        {
            R = rng ?? new Rng((uint)seed);
            if (sparks != null) Sparks = sparks;
            if (ground != null) Ground = ground;
        }
        /// delay：幾秒後才出現；flag：PFlag。col 0 讓火、煙用自己的色階。
        public void Spawn(int k, double x, double y, double vx, double vy, double life, uint col = 0xffffffff, double size = 1, double delay = 0, int flag = 0)
        {
            List.Add(new Particle { k = k, x = x, y = y, vx = vx, vy = vy, life = life, max = life, col = col, size = size, seed = R.Next() * 100, delay = delay, flag = flag });
        }
        public int Count => List.Count;

        public void Update(double dt)
        {
            t += dt;
            var R = this.R; double t0 = t;
            for (int i = List.Count - 1; i >= 0; i--)
            {
                var p = List[i];
                if (p.delay > 0) { p.delay -= dt; continue; }
                if ((p.life -= dt) <= 0)
                {
                    if (p.k == P.FIRE && (p.flag & PFlag.SMOKES) != 0)
                    {
                        bool big = (p.flag & PFlag.BIG) != 0;
                        Spawn(P.SMOKE, p.x, p.y, p.vx * 0.6, p.vy * 0.6 - 6, big ? R.Range(1.3, 2.3) : R.Range(0.8, 1.4), 0, p.size * (big ? 0.85 : 0.7), 0, big ? PFlag.BIG : 0);
                    }
                    List.RemoveAt(i);
                    continue;
                }
                switch (p.k)
                {
                    case P.FIRE:
                        p.vy -= 95 * dt;
                        p.vx += Sin(t0 * 17 + p.seed) * 30 * dt;
                        p.vx -= p.vx * 5 * dt;
                        p.vy -= p.vy * 3.2 * dt;
                        break;
                    case P.GRIT:
                        {
                            p.vy += Sim.GRAVITY * dt;
                            p.vx -= p.vx * 0.8 * dt;
                            double g = Ground(p.x), ny = p.y + p.vy * dt;
                            p.x += p.vx * dt;
                            if (p.vy > 0 && p.y <= g && ny >= g)
                            {
                                p.y = g - 0.25;
                                if (p.vy > 130 && R.Chance(0.4)) { p.vy = -p.vy * 0.25; p.vx = p.vx * 0.5 + R.Range(-10, 10); }
                                else { p.vx = p.vy = 0; p.life = Math.Min(p.life, 0.5); }
                            }
                            else p.y = ny;
                            continue;
                        }
                    case P.BRAND:
                        {
                            p.vy += Sim.GRAVITY * 0.8 * dt;
                            p.vx -= p.vx * 0.9 * dt;
                            if (R.Chance(0.9 * Math.Min(1, dt * 60)))
                            {
                                double vx = p.vx * 0.1 + R.Range(-7, 7), vy = p.vy * 0.1 - 10, life = R.Range(0.16, 0.32), size = R.Range(0.9, 1.7) * (0.5 + (p.life / p.max) * 0.6);
                                Spawn(P.FIRE, p.x, p.y, vx, vy, life, 0, size, 0, R.Chance(0.4) ? PFlag.SMOKES : 0);
                            }
                            double g = Ground(p.x), ny = p.y + p.vy * dt;
                            p.x += p.vx * dt;
                            if (p.vy > 0 && p.y <= g && ny >= g) { OnLand?.Invoke(p.x, g); List.RemoveAt(i); }
                            else p.y = ny;
                            continue;
                        }
                    case P.SPARK:
                        {
                            p.vy += Sim.GRAVITY * 0.45 * dt;
                            p.vx -= p.vx * 2.2 * dt;
                            p.vy -= p.vy * 2.2 * dt;
                            double g = Ground(p.x), ny = p.y + p.vy * dt;
                            p.x += p.vx * dt;
                            if (p.vy > 0 && p.y <= g && ny >= g) { p.vy = -p.vy * 0.45; p.vx *= 0.7; p.y = g - 0.25; }
                            else p.y = ny;
                            continue;
                        }
                    case P.STREAK: p.vx += p.vx * 3 * dt; p.vy += p.vy * 3 * dt; break;
                    case P.FLAKE:
                        p.vx -= p.vx * 2.2 * dt;
                        p.vy -= p.vy * 2.2 * dt - 35 * dt;
                        p.x += Sin(t * 2.5 + p.seed) * 7 * dt;
                        break;
                    case P.EMBER:
                        p.vy += (-30 + Sin(t0 * 3 + p.seed) * 20) * dt;
                        p.vx += Cos(t0 * 2.3 + p.seed) * 45 * dt;
                        p.vx -= p.vx * 1.6 * dt;
                        p.vy -= p.vy * 1.6 * dt;
                        break;
                    case P.SMOKE:
                        {
                            bool big = (p.flag & PFlag.BIG) != 0;
                            p.vy -= (big ? 23 : 16) * dt;
                            p.vx += Sin(t0 * 1.3 + p.seed) * 8 * dt;
                            p.vx -= p.vx * 1.6 * dt;
                            p.vy -= p.vy * 1.2 * dt;
                            break;
                        }
                    case P.MOTE: p.vx -= p.vx * 0.6 * dt; p.vy -= p.vy * 0.6 * dt; break;
                    default:
                        {
                            double drag = Sim.Soft(p.k) ? 4 : 1.6;
                            p.vx -= p.vx * drag * dt;
                            p.vy -= p.vy * drag * dt + 5 * dt;
                            break;
                        }
                }
                p.x += p.vx * dt;
                p.y += p.vy * dt;
            }
        }

        /// layer："back" 畫軟的（煙、塵、蒸氣）和 BACK 旗標的，"front" 畫其他，null 全畫。
        public void Draw(Painter p, string layer = null)
        {
            uint WHITE = Col.WHITE;
            foreach (var q in List)
            {
                if (q.delay > 0) continue;
                if (layer != null && ((Sim.Soft(q.k) || (q.flag & PFlag.BACK) != 0) ? "back" : "front") != layer) continue;
                double k = q.life / q.max, x = q.x, y = q.y, sp = Hypot(q.vx, q.vy);
                if (sp == 0 || double.IsNaN(sp)) sp = 1;
                double ux = q.vx / sp, uy = q.vy / sp;
                switch (q.k)
                {
                    case P.SPARK:
                        {
                            var S = Sparks; uint head = k > 0.6 ? S[0] : k > 0.3 ? S[1] : S[2]; double len = Math.Min(9, 1 + sp * 0.022);
                            p.Line(x - ux * len, y - uy * len, x - ux * len * 0.4, y - uy * len * 0.4, k > 0.5 ? head : S[S.Length - 1]);
                            p.Line(x - ux * len * 0.45, y - uy * len * 0.45, x, y, head);
                            p.Glow(x, y, 3, head, 0.45 * k);
                            break;
                        }
                    case P.MOTE:
                        {
                            double len = Math.Min(16, 0.5 + sp * 0.026) * q.size, a = k < 0.35 ? k / 0.35 : 1;
                            p.Line(x - ux * len, y - uy * len, x - ux * len * 0.35, y - uy * len * 0.35, Col.Scale(q.col, 0.55), a);
                            p.Line(x - ux * len * 0.4, y - uy * len * 0.4, x, y, q.col, a);
                            p.Glow(x, y, 2.5 + q.size, q.col, 0.4 * k);
                            break;
                        }
                    case P.STREAK:
                        {
                            double L = Clamp(sp / 30, 1, 7);
                            for (double d = L; d >= 0; d -= 0.5) p.Dot(x - ux * d, y - uy * d, d < 1 ? WHITE : d < L * 0.5 ? q.col : Col.Scale(q.col, 0.6), d < L * 0.5 ? 1 : 1.2 - d / L);
                            p.Glow(x, y, 4, q.col, 0.4);
                            break;
                        }
                    case P.FLAKE:
                        {
                            double a = Math.Min(1, k * 3);
                            p.Dot(x, y, q.col, a);
                            if (q.size > 1.3) foreach (var c in Sim.CROSS) p.Dot(x + c[0], y + c[1], Col.Scale(q.col, 0.8), a * 0.8);
                            break;
                        }
                    case P.VAPOUR:
                        {
                            double r = q.size * (0.6 + (1 - k) * 0.9);
                            p.Disc(x, y, r, q.col, Pow(k, 1.3) * 0.45);
                            if (HasHaze) p.Glow(x, y, r * 1.8, Haze, 0.16 * k);
                            break;
                        }
                    case P.DUST: p.Disc(x, y, q.size * (0.6 + (1 - k) * 0.9), q.col, Pow(k, 1.3) * 0.7); break;
                    case P.SMOKE:
                        {
                            double age = 1 - k; bool big = (q.flag & PFlag.BIG) != 0;
                            double r = q.size * (0.65 + Math.Min(1, age * 2.5) * 0.45 + age * (big ? 0.5 : 0.4));
                            double a = Math.Min(1, age * 12) * Math.Min(1, k * 2.4) * (big ? 0.7 : 0.58);
                            uint c = q.col != 0 ? Col.Mix(q.col, Sim.RampAt(Sim.SMOKE_RAMP, age), age) : Sim.RampAt(Sim.SMOKE_RAMP, age * 1.05);
                            p.Disc(x, y, r, c, a * 0.45);
                            p.Disc(x + r * 0.05, y + r * 0.06, r * 0.74, c, a * 0.62);
                            if (age < 0.5) p.Disc(x - r * 0.22, y - r * 0.3, r * 0.5, Col.Mix(c, WHITE, 0.12), a * 0.4 * (1 - age * 2));
                            break;
                        }
                    case P.FIRE:
                        {
                            double age = 1 - k, heat = Math.Min(0.999, Pow(age, 0.62) + (q.seed % 1) * 0.1); var F = Sim.FIRE_RAMP; int n = F.Length;
                            int idx = (int)Math.Min(n - 2, Math.Floor(heat * (n - 1)));
                            double r = q.size * (0.55 + 0.45 * Math.Min(1, age * 7)) * (1 - age * 0.55); uint c = F[idx];
                            if (idx >= n - 2) p.Disc(x, y, r, c, Math.Min(1, k * 3) * 0.85);
                            else
                            {
                                p.Circle(x, y, r, F[Math.Min(n - 1, idx + 2)]);
                                p.Circle(x - r * 0.16, y - r * 0.22, r * 0.78, c);
                                if (r > 1.6) p.Circle(x, y - r * 0.9, r * 0.42, c);
                                if (idx <= 3 && r > 1.8) p.Circle(x - r * 0.28, y - r * 0.34, r * 0.36, F[Math.Max(0, idx - 1)]);
                                if (idx < 6) p.Glow(x, y, r * 2.4 + 2, c, 0.18 * k);
                            }
                            break;
                        }
                    case P.BRAND:
                        p.Circle(x, y, 1.6, Sim.HOT[3]);
                        p.Px(x, y, Sin(t * 40 + q.seed) > 0 ? Sim.HOT[0] : Sim.HOT[1]);
                        p.Px(x + 1, y, Sim.HOT[1]);
                        p.Glow(x, y, 7, Sim.HOT[2], 0.45);
                        break;
                    case P.GRIT:
                        if (k > 0.25 || k * 4 > 0.5)
                        {
                            p.Px(x, y, q.col);
                            if (q.size >= 2) { p.Px(x + 1, y, q.col); p.Px(x, y + 1, Col.Scale(q.col, 0.8)); p.Px(x + 1, y + 1, Col.Scale(q.col, 0.7)); }
                        }
                        break;
                    case P.EMBER:
                        {
                            uint c = k > 0.6 ? Sparks[0] : k > 0.3 ? Sparks[1] : Sparks[2];
                            if (k < 0.25 && Sin(t * 40 + q.seed) < 0) break;
                            p.Px(x, y, c);
                            if (q.size > 1.5) p.Px(x, y + 1, Sparks[Sparks.Length - 1]);
                            p.Glow(x, y, 3 + q.size, c, 0.35 * k);
                            break;
                        }
                    default:
                        {
                            // STAR：閃爍的十字
                            double tw = 0.6 + 0.4 * Sin(t * (8 + (q.seed % 5)) + q.seed);
                            if (q.size < 1)
                            {
                                if (tw * k > 0.25) p.Px(x, y, tw > 0.8 ? WHITE : q.col);
                                p.Glow(x, y, 3, q.col, 0.4 * k * tw);
                                break;
                            }
                            Sim.Sparkle(p, x, y, q.size * tw * Math.Min(1, k * 3), q.col, Col.Scale(q.col, 0.75), 0.5 * k * tw);
                            break;
                        }
                }
            }
        }
    }

    /// 會閃滅的光（sim.js 的 Lights）。
    public class Lights
    {
        class L { public double x, y, r, k, life, max; public uint color; }
        readonly List<L> list = new List<L>();
        public void Add(double x, double y, double r, uint color, double k, double life) => list.Add(new L { x = x, y = y, r = r, color = color, k = k, life = life, max = life });
        public void Update(double dt) { for (int i = list.Count - 1; i >= 0; i--) if ((list[i].life -= dt) <= 0) list.RemoveAt(i); }
        public void Draw(Painter p)
        {
            foreach (var l in list) { double k = l.life / l.max; p.Glow(l.x, l.y, l.r * (0.55 + 0.45 * k), l.color, l.k * k * k); }
        }
    }

    /// 碎塊種類（sim.js 的 B）。
    public static class BKind { public const int SHARD = 0, CHUNK = 1, DRIP = 2; }

    /// 一塊碎塊；Pts、Pvy 是特效自己掛上的資料（石頭形狀、上一步的速度）。
    public class Bit
    {
        public int kind = BKind.SHARD;
        public double x, y, vx, vy, a, va, s = 1, g = 1, drag, bounce, life = 1, max;
        public bool rest;
        public uint c = 0xffffffff;
        public uint[] ramp;
        public double[] pts; public double pvy;
    }

    /// 會翻滾、彈跳、停下來的碎塊（sim.js 的 Bits）。
    public class Bits
    {
        public List<Bit> List = new List<Bit>();
        public Func<double, double> Ground = x => double.PositiveInfinity;
        static readonly uint[] CHUNK_RAMP = Col.Ramp(new[] { "#1c2030", "#3a4a66", "#6e86a8", "#a8c0dc", "#e8f2ff" });
        public Bits(Func<double, double> ground = null) { if (ground != null) Ground = ground; }
        public void Add(Bit b) { b.max = b.life; List.Add(b); }
        public int Count => List.Count;
        public void Update(double dt)
        {
            for (int i = List.Count - 1; i >= 0; i--)
            {
                var b = List[i];
                if ((b.life -= dt) <= 0) { List.RemoveAt(i); continue; }
                if (b.rest) continue;
                b.vy += Sim.GRAVITY * b.g * dt;
                b.vx -= b.vx * b.drag * dt;
                b.vy -= b.vy * b.drag * dt;
                b.x += b.vx * dt;
                b.y += b.vy * dt;
                b.a += b.va * dt;
                double floor = Ground(b.x), sp = b.vy;
                if (b.g <= 0 || b.y < floor || sp <= 0) continue;
                b.y = floor - 0.01;
                if (b.kind == BKind.DRIP) b.life = 0;
                else if (b.bounce > 0 && sp > 70) { b.vy = -sp * b.bounce; b.vx *= 0.7; b.va *= 0.6; }
                else { b.rest = true; b.vx = b.vy = 0; }
            }
        }
        public void Draw(Painter p)
        {
            foreach (var b in List)
            {
                double a = Math.Min(1, b.life / 0.4), ca = Cos(b.a), sa = Sin(b.a);
                if (b.kind == BKind.SHARD)
                {
                    for (double d = -b.s / 2; d <= b.s / 2; d += 0.5) p.Dot(b.x + ca * d, b.y + sa * d, d > b.s / 2 - 0.6 ? Col.WHITE : b.c, a);
                }
                else if (b.kind == BKind.DRIP)
                {
                    p.Dot(b.x, b.y, b.c, a);
                    p.Dot(b.x, b.y - 1, b.c, a * 0.5);
                }
                else
                {
                    var R = b.ramp ?? CHUNK_RAMP; int n = R.Length;
                    double x = Round(b.x), y = Round(b.y), r = Math.Ceiling(b.s) + 1;
                    for (double py = -r; py <= r; py++)
                        for (double px = -r; px <= r; px++)
                        {
                            double u = (px + 0.5) * ca + (py + 0.5) * sa, v = -(px + 0.5) * sa + (py + 0.5) * ca;
                            double d = Math.Abs(u) / b.s + Math.Abs(v) / (b.s * 0.62);
                            if (d > 1.3) continue;
                            p.Dot(x + px, y + py, d > 1 ? R[0] : v < 0 ? (u < 0 ? R[n - 1] : R[n - 2]) : u < 0 ? R[n - 3] : R[Math.Max(1, n - 4)], a);
                        }
                }
            }
        }
    }
}
