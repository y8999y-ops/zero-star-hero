// 各類特效共用的小工具（網頁版 pixelfx/src/fx/*/_lib.js）翻成 C#，只翻這邊特效用得到的。
//   FireLib：fire/_lib.js（迴圈雜訊、無縫粒子、火舌、火團、煙團、火星、餘燼、阻力運動）
//   BoltLib：lightning/_lib.js（之字形閃電、粗筆、細電弧；先在格子上標記再一次畫）
//   NatureLib：nature/_lib.js 的 Drops（液滴）
//   PickupLib：pickups/_lib.js 的 glint（十字閃光）
//   BoomLib：explosions/_lib.js 的 cull（超出畫面的粒子丟掉）
using System;
using System.Collections.Generic;
using static PixelFX.Pf;

namespace PixelFX.Fx
{
    /// 迴圈雜訊：N(tt, rate, seed, off)。
    public delegate double LoopNoiseFn(double tt, double rate, int seed = 0, double off = 0);
    /// 這一格的雜訊：N(rate, seed, off)。
    public delegate double FrameNoiseFn(double rate, int seed = 0, double off = 0);

    public static class FireLib
    {
        /// 每 period 格重複的 1D 雜訊，[-1, 1]。
        public static double PNoise(double x, double period, int seed = 0)
        {
            double i = Math.Floor(x), f = x - i, u = f * f * (3 - 2 * f);
            double a = Rand(ToInt32(Wrap(i, period)), seed), b = Rand(ToInt32(Wrap(i + 1, period)), seed);
            return (a + (b - a) * u) * 2 - 1;
        }
        /// D 秒長的迴圈用的雜訊；D = 0 給一次性的（不重複）。
        public static LoopNoiseFn NoiseFor(double D)
        {
            if (D == 0) return (tt, rate, seed, off) => Noise(tt * rate + off, seed);
            return (tt, rate, seed, off) =>
            {
                double P = Math.Max(1, Round(rate * D));
                return PNoise((tt / D) * P + off, P, seed);
            };
        }
        /// D 秒長迴圈的無縫粒子：make(r, i) 用粒子自己的 rng 造出來（要有 life），draw(q, age, i) 每個活著的複本呼叫一次。
        public static void Looped<T>(double t, double D, int count, int seed, Func<Rng, int, T> make, Func<T, double> life, Action<T, double, int> draw)
        {
            for (int i = 0; i < count; i++)
            {
                var r = Rng.Of(seed, i); double born = r.Next() * D; var q = make(r, i); double L = life(q);
                for (double age = Wrap(t - born, D); age < L; age += D) draw(q, age, i);
            }
        }
        /// 從暗到亮的色階倒過來（H[0] 最白熱）。
        public static uint[] HotFirst(uint[] F) { var r = (uint[])F.Clone(); Array.Reverse(r); return r; }

        /// 火舌的層 [寬比例, 長比例, 熱色階第幾階]：紅邊、橘、黃、白心。
        public static readonly double[][] LAYERS = { new[] { 1, 1, 6.0 }, new[] { 0.76, 0.86, 4.0 }, new[] { 0.54, 0.68, 2.0 }, new[] { 0.3, 0.42, 0.0 } };

        /// 沿任意方向 (ux, uy) 躺著的火舌（噴射、吐息、彗尾）。
        public static void FlameBlade(Painter p, double x, double y, double ux, double uy, double len, double w, double bend, FrameNoiseFn N, int n, uint[] H, double[][] layers, double jit = 0.5, double wob = 1.1)
        {
            if (len < 1) return;
            double nx = -uy, ny = ux;
            foreach (var ly in layers)
            {
                double lw = ly[0], lh = ly[1]; uint c = H[(int)ly[2]];
                double L = len * lh;
                for (double r = 0; r <= L; r += 0.5)
                {
                    double u = r / Math.Max(1, L);
                    double half = w * lw * Pow(1 - u, 0.85) * Math.Min(1, (r + 1.5) / 3.5) + N(9, n, r * 0.45) * jit;
                    if (half < 0.3) continue;
                    double off = bend * u * u * lh + N(4, n + 7, r * 0.2) * u * wob, cx = x + ux * r + nx * off, cy = y + uy * r + ny * off;
                    for (double q = -half; q <= half; q += 0.5) p.Px(cx + nx * q, cy + ny * q, c);
                }
            }
        }
        /// 畫面空間的實心圓（快；圓鏡像、旋轉都一樣）。
        public static void Solid(Painter p, double x, double y, double r, uint c)
        {
            if (r < 0.6) { p.Px(x, y, c); return; }
            double cx = p.ToX(x, y), cy = p.ToY(x, y), r2 = r * r;
            for (double sy = Math.Floor(cy - r); sy <= Math.Ceiling(cy + r); sy++)
            {
                double dy = sy + 0.5 - cy, s2 = r2 - dy * dy;
                if (s2 < 0) continue;
                double s = Math.Sqrt(s2);
                for (double sx = Math.Ceiling(cx - s - 0.5); sx <= Math.Floor(cx + s - 0.5); sx++) p.Put((int)sx, (int)sy, c, 1);
            }
        }
        /// 畫面空間的半透明圓（煙、霧）。
        public static void SoftDisc(Painter p, double x, double y, double r, uint c, double a)
        {
            if (a <= 0.004) return;
            if (r < 0.5) { p.Blend(x, y, c, a); return; }
            double cx = p.ToX(x, y), cy = p.ToY(x, y), r2 = r * r;
            for (double sy = Math.Floor(cy - r); sy <= Math.Ceiling(cy + r); sy++)
            {
                double dy = sy + 0.5 - cy, s2 = r2 - dy * dy;
                if (s2 < 0) continue;
                double s = Math.Sqrt(s2);
                for (double sx = Math.Ceiling(cx - s - 0.5); sx <= Math.Floor(cx + s - 0.5); sx++) p.BlendPx((int)sx, (int)sy, c, a);
            }
        }
        /// 一團火，k＝剩下的壽命（1 新、0 沒了），沿熱色階 H 冷下來。(tx, ty)：火舌朝哪。
        public static void FirePuff(Painter p, double x, double y, double k, double size, double frac, uint[] H, double glowK = 0.18, double tx = 0, double ty = -1)
        {
            double age = 1 - k; int n = H.Length; double heat = Math.Min(0.999, Pow(age, 0.62) + frac * 0.1);
            int idx = (int)Math.Min(n - 2, Math.Floor(heat * (n - 1)));
            double r = size * (0.55 + 0.45 * Math.Min(1, age * 7)) * (1 - age * 0.55); uint c = H[idx];
            if (idx >= n - 2) { SoftDisc(p, x, y, r, c, Math.Min(1, k * 3) * 0.85); return; }
            Solid(p, x, y, r, H[Math.Min(n - 1, idx + 2)]);
            if (r > 1.6 && ty > -0.99) Solid(p, x + tx * r * 1.5, y + ty * r * 1.5, r * 0.3, H[Math.Min(n - 1, idx + 1)]);
            Solid(p, x - r * 0.16, y - r * 0.22, r * 0.78, c);
            if (r > 1.6) Solid(p, x + tx * r * 0.9, y + ty * r * 0.9, r * 0.42, c);
            if (idx <= 3 && r > 1.8) Solid(p, x - r * 0.28, y - r * 0.34, r * 0.36, H[Math.Max(0, idx - 1)]);
            if (idx < 6) p.Glow(x, y, r * 2.4 + 2, c, glowK * k);
        }
        /// 一團煙：三個半透明圓（身體、偏下的濃核心、年輕時亮的頂）。col 染色（0＝一般煙）。
        public static void SmokePuff(Painter p, double x, double y, double k, double size, uint col = 0, bool big = false, double aMul = 1)
        {
            double age = 1 - k;
            double r = size * (0.65 + Math.Min(1, age * 2.5) * 0.45 + age * (big ? 0.5 : 0.4));
            double a = Math.Min(1, age * 12) * Math.Min(1, k * 2.4) * (big ? 0.7 : 0.58) * aMul;
            uint c = col != 0 ? Col.Mix(col, Sim.RampAt(Sim.SMOKE_RAMP, age), age) : Sim.RampAt(Sim.SMOKE_RAMP, age * 1.05);
            SoftDisc(p, x, y, r, c, a * 0.45);
            SoftDisc(p, x + r * 0.05, y + r * 0.06, r * 0.74, c, a * 0.62);
            if (age < 0.5) SoftDisc(p, x - r * 0.22, y - r * 0.3, r * 0.5, Col.Mix(c, Col.WHITE, 0.12), a * 0.4 * (1 - age * 2));
        }
        /// 餘燼：冷下來的熱像素，快沒時閃爍（ph 閃爍相位），大的（size 2）是小十字。
        public static void Ember(Painter p, double x, double y, double k, double size, uint[] cols, double ph)
        {
            if (k < 0.25 && Sin(ph) < 0) return;
            uint c = k > 0.6 ? cols[0] : k > 0.3 ? cols[1] : cols[2];
            if (size >= 2)
            {
                uint rim = k > 0.45 ? cols[2] : cols[3];
                p.Px(x - 1, y, rim); p.Px(x + 1, y, rim); p.Px(x, y - 1, rim); p.Px(x, y + 1, rim);
                p.Px(x, y, c);
                p.Glow(x, y, 8, c, 0.4 * k);
                return;
            }
            p.Px(x, y, c);
            if (size > 1.4) p.Px(x, y + 1, cols[3]);
            p.Glow(x, y, 3 + size, c, 0.35 * k);
        }
        /// 火星：沿速度拉長的一條，熱頭冷尾，一點光。
        public static void Spark(Painter p, double x, double y, double vx, double vy, double k, uint[] cols)
        {
            double sp = Hypot(vx, vy); if (sp == 0 || double.IsNaN(sp)) sp = 1;
            double ux = vx / sp, uy = vy / sp, len = Math.Min(9, 1 + sp * 0.022);
            uint head = k > 0.6 ? cols[0] : k > 0.3 ? cols[1] : cols[2];
            p.Line(x - ux * len, y - uy * len, x - ux * len * 0.4, y - uy * len * 0.4, k > 0.5 ? head : cols[cols.Length - 1]);
            p.Line(x - ux * len * 0.45, y - uy * len * 0.45, x, y, head);
            p.Glow(x, y, 3, head, 0.45 * k);
        }
        static void Along(double x, double v, double a, double k, double t, out double X, out double V)
        {
            if (k <= 0) { X = x + v * t + 0.5 * a * t * t; V = v + a * t; return; }
            double e = Exp(-k * t), vt = a / k;
            X = x + vt * t + ((v - vt) * (1 - e)) / k; V = vt + (v - vt) * e;
        }
        /// 從 (x, y) 以 (vx, vy) 出發 t 秒後的位置與速度：加速度 (ax, ay)、線性阻力 kx、ky。
        public static (double x, double y, double vx, double vy) Drift(double x, double y, double vx, double vy, double t, double ax, double ay, double kx, double ky)
        {
            Along(x, vx, ax, kx, t, out double X, out double VX);
            Along(y, vy, ay, ky, t, out double Y, out double VY);
            return (X, Y, VX, VY);
        }
    }

    /// 閃電路徑：一條一條，第一條是主幹。w：粗細（主幹 1）。
    public class BoltPath { public List<double[]> pts; public double w; }

    public static class BoltLib
    {
        /// 預設色階（暗到亮）：深紫、電藍、冰白。
        public static readonly string[] VOLT = { "#120a33", "#2a1b78", "#4630c0", "#5a62f0", "#58a6ff", "#9ed8ff", "#e4f6ff", "#ffffff" };

        /// 從 (x0, y0) 到 (x1, y1) 的閃電：中點位移到約 3px 一段，途中分岔（每層更細），最多分兩層。
        public static List<BoltPath> Zigzag(Rng R, double x0, double y0, double x1, double y1, double jag = 0.32, double forks = 0.35, double w = 1, int depth = 0)
        {
            var o = new List<BoltPath>(); double L = Hypot(x1 - x0, y1 - y0);
            var pts = new List<double[]> { new[] { x0, y0 }, new[] { x1, y1 } }; double off = L * jag;
            while (pts.Count < 2 + L / 3)
            {
                var nxt = new List<double[]> { pts[0] };
                for (int i = 0; i < pts.Count - 1; i++)
                {
                    double ax = pts[i][0], ay = pts[i][1], bx = pts[i + 1][0], by = pts[i + 1][1], l = Hypot(bx - ax, by - ay);
                    if (l == 0 || double.IsNaN(l)) l = 1;
                    double ofs = R.Range(-off, off);
                    nxt.Add(new[] { (ax + bx) / 2 + (-(by - ay) / l) * ofs, (ay + by) / 2 + ((bx - ax) / l) * ofs });
                    nxt.Add(new[] { bx, by });
                }
                pts = nxt;
                off *= 0.52;
            }
            o.Add(new BoltPath { pts = pts, w = w });
            if (depth < 2)
                for (int i = 2; i < pts.Count - 3; i++)
                    if (R.Chance(forks / (1 + depth) / Math.Max(4, pts.Count / 6.0)))
                    {
                        double ax = pts[i][0], ay = pts[i][1], bx = pts[Math.Min(pts.Count - 1, i + 3)][0], by = pts[Math.Min(pts.Count - 1, i + 3)][1];
                        double a = Atan2(by - ay, bx - ax) + R.Sign() * R.Range(0.35, 0.9), l = (L - ((double)i / pts.Count) * L) * R.Range(0.25, 0.55);
                        o.AddRange(Zigzag(R, ax, ay, ax + Cos(a) * l, ay + Sin(a) * l, jag * 1.1, forks, w * 0.55, depth + 1));
                    }
            return o;
        }

        // ---- 上墨：像素先標在格子上（等級高的蓋過低的），最後每格畫一次。
        const int N = 1024, HALF = 512;
        static readonly byte[] GRID = new byte[N * N];
        static readonly List<int> HIT = new List<int>();
        static void Mark(double x, double y, int lvl)
        {
            double X = Math.Floor(x) + HALF, Y = Math.Floor(y) + HALF;
            if (X < 0 || Y < 0 || X >= N || Y >= N) return;
            int i = (int)(Y * N + X); int v = GRID[i];
            if (v == 0) HIT.Add(i);
            if (lvl > v) GRID[i] = (byte)lvl;
        }
        static void Stamp(double x, double y, double r, int lvl)
        {
            if (r <= 0.5) { Mark(Round(x), Round(y), lvl); return; }
            double r2 = r * r;
            for (double py = Math.Floor(y - r); py <= Math.Ceiling(y + r); py++)
            {
                double dy = py + 0.5 - y;
                for (double px = Math.Floor(x - r); px <= Math.Ceiling(x + r); px++)
                {
                    double dx = px + 0.5 - x;
                    if (dx * dx + dy * dy <= r2) Mark(px, py, lvl);
                }
            }
        }
        static void Flush(Painter p, uint[] cols, double[] alphas)
        {
            foreach (int i in HIT)
            {
                int v = GRID[i];
                GRID[i] = 0;
                double x = (i % N) - HALF, y = (i / N) - HALF, a = alphas != null ? alphas[v - 1] : 1;
                if (a >= 1) p.Px(x, y, cols[v - 1]);
                else if (a > 0) p.Dot(x, y, cols[v - 1], a);
            }
            HIT.Clear();
        }
        static void Walk(List<double[]> pts, Action<double, double, int> fn)
        {
            for (int i = 0; i < pts.Count - 1; i++)
            {
                double ax = pts[i][0], ay = pts[i][1], bx = pts[i + 1][0], by = pts[i + 1][1], l = Math.Max(1, Hypot(bx - ax, by - ay));
                for (double d = 0; d <= l; d += 0.5) fn(ax + ((bx - ax) * d) / l, ay + ((by - ay) * d) / l, i);
            }
        }

        public class StrokeOpts { public bool hero; public double light = 0.5; public double a = 1; public double? upTo; public double core; public double? minY; }

        /// 全力的閃電：深色光暈、淡色身體、主幹上白色核心，每幾個點一團光。k＝亮度，s＝粗細倍數。
        public static void Stroke(Painter p, List<BoltPath> b, double k, uint[] C, double s = 1, StrokeOpts o = null)
        {
            if (k <= 0.02) return;
            o = o ?? new StrokeOpts();
            double lk = o.light;
            foreach (var q in b)
            {
                bool trunk = q.w >= 1;
                if (!trunk && k < 0.5) continue;
                double rh = (trunk ? (k > 0.6 ? 2.1 : 1.6) : 1.1) * s, rb = (trunk ? (k > 0.6 ? 1.3 : 0.8) : 0.5) * s;
                var pts = o.upTo.HasValue && trunk ? q.pts.GetRange(0, Math.Min(q.pts.Count, (int)Math.Max(2, Math.Ceiling(q.pts.Count * o.upTo.Value)))) : q.pts;
                Walk(pts, (x, y, i) =>
                {
                    Stamp(x, y, rh, 1);
                    Stamp(x, y, rb, trunk ? 3 : 2);
                    if (trunk && k > 0.3) { if (o.core != 0) Stamp(x, y, o.core, 4); else Mark(x, y, 4); }
                });
                for (int i = 0; i < pts.Count - 1; i += 3) if (!o.minY.HasValue || pts[i][1] > o.minY.Value) p.Glow(pts[i][0], pts[i][1], (trunk ? 14 : 7) * s, C[4], lk * k * q.w);
            }
            double a = o.a;
            Flush(p, o.hero ? new[] { C[3], C[6], C[7], C[7] } : new[] { C[2], C[4], C[5], C[7] }, new[] { a, a, a, a });
        }

        /// 細電弧：1px 核心、2px 淡身體、亮的時候有網點光暈、沿線的光。給只活一兩格的短電弧。
        public static void Crackle(Painter p, List<BoltPath> b, double k, uint[] C, double glowK = 0.5, double a = 1)
        {
            if (k <= 0.02) return;
            foreach (var q in b)
            {
                bool thick = q.w >= 1;
                Walk(q.pts, (x, y, i) =>
                {
                    if (k > 0.45 && thick) foreach (var c in Sim.CROSS) Mark(x + c[0] * 1.5, y + c[1] * 1.5, 1);
                    if (k > 0.25 && (thick || q.w > 0.4)) { Mark(x + 1, y, 2); Mark(x, y + 1, 2); }
                    Mark(x, y, thick && k > 0.3 ? 4 : 3);
                });
                for (int i = 0; i < q.pts.Count - 1; i += 3) p.Glow(q.pts[i][0], q.pts[i][1], (thick ? 9 : 5) * (0.5 + k * 0.5), C[4], glowK * k * q.w);
            }
            Flush(p, new[] { C[3], C[5], C[5], C[7] }, new[] { Math.Min(1, (k - 0.45) * 1.6) * a, a, a, a });
        }
    }

    /// 液滴：受重力畫弧、有一點阻力，畫成亮珠加一小段尾巴；落地時呼叫 onLand 然後消失。
    public class Drops
    {
        public class Drop { public double x, y, vx, vy, s, delay; }
        public List<Drop> List = new List<Drop>();
        readonly Func<double, double> ground;
        public Drops(Func<double, double> ground = null) { this.ground = ground ?? (x => 0); }
        public void Add(double x, double y, double vx, double vy, double s = 1, double delay = 0) => List.Add(new Drop { x = x, y = y, vx = vx, vy = vy, s = s, delay = delay });
        public void Update(double dt, Action<Drop, double> onLand)
        {
            for (int i = List.Count - 1; i >= 0; i--)
            {
                var d = List[i];
                if (d.delay > 0) { d.delay -= dt; continue; }
                double drag = 0.6 / d.s, py = d.y;
                d.vy += Sim.GRAVITY * dt;
                d.vx -= d.vx * drag * dt;
                d.vy -= d.vy * drag * 0.5 * dt;
                d.x += d.vx * dt;
                d.y += d.vy * dt;
                double g = ground(d.x);
                if (d.vy > 0 && py <= g && d.y >= g) { onLand?.Invoke(d, g); List.RemoveAt(i); }
            }
        }
        /// C：液體色階，暗到亮（5 階以上）。
        public void Draw(Painter p, uint[] C)
        {
            int n = C.Length;
            foreach (var d in List)
            {
                if (d.delay > 0) continue;
                double sp = Hypot(d.vx, d.vy); if (sp == 0 || double.IsNaN(sp)) sp = 1;
                double ux = d.vx / sp, uy = d.vy / sp, len = Math.Min(5, 0.5 + sp * 0.012);
                p.Line(d.x - ux * len, d.y - uy * len, d.x - ux, d.y - uy, C[n - 4]);
                p.Px(d.x, d.y, C[n - 1]);
                if (d.s > 1) { p.Px(d.x - ux, d.y - uy, C[n - 2]); p.Px(d.x + 1, d.y, C[n - 3]); }
                p.Glow(d.x, d.y, 3 + d.s * 1.5, C[n - 2], 0.3);
            }
        }
    }

    public static class PickupLib
    {
        /// 十字閃光：長度 arm 的臂、尖端 tip、亮的時候中心白。
        public static void Glint(Painter p, double x, double y, double arm, uint c, double k = 0.4) => Glint(p, x, y, arm, c, k, Col.Scale(c, 0.8));
        public static void Glint(Painter p, double x, double y, double arm, uint c, double k, uint tip)
        {
            double n = Round(arm), X = Math.Floor(x), Y = Math.Floor(y);
            if (n < 0) return;
            for (double d = 1; d <= n; d++)
            {
                uint cc = d == n && n > 1 ? tip : c;
                p.Px(X + d, Y, cc); p.Px(X - d, Y, cc); p.Px(X, Y + d, cc); p.Px(X, Y - d, cc);
            }
            p.Px(X, Y, n > 0 ? Col.WHITE : c);
            p.Glow(X + 0.5, Y + 0.5, 3 + n * 2.5, c, k);
        }
    }

    public static class BoomLib
    {
        /// 超出方框的粒子直接丟掉。
        public static void Cull(Particles ps, double x0, double y0, double x1, double y1)
        {
            var L = ps.List;
            for (int i = L.Count - 1; i >= 0; i--)
            {
                var q = L[i];
                if (q.x < x0 || q.x > x1 || q.y < y0 || q.y > y1) L.RemoveAt(i);
            }
        }
    }
}
