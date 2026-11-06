// 網頁版 pixelfx/src/fx/water/splash.js 一行一行翻成 C#（模擬特效），加上 water/_lib.js 用到的部分（WaterLib）。
// 石頭掉進靜水：白色一擊、水冠撕成水珠往外飛、落下時一圈圈漣漪、中間反彈一根水柱、泡沫和低低的水霧。
// 選項：Palette（8 階水）、Seed、Light，Num["stone"]＝1 畫掉下來的石頭（預設）、0 不畫。
using System;
using System.Collections.Generic;
using static PixelFX.Pf;

namespace PixelFX.Fx
{
    public static class WaterLib
    {
        public static readonly string[] WATER = { "#0a1630", "#123063", "#1b5596", "#2a7fc4", "#45a9e3", "#86d3f5", "#cdf1ff", "#ffffff" };
        public static readonly string[] ROCK = { "#141219", "#221f2b", "#34303f", "#4a4558", "#655f74", "#8a8498" };
        public static uint[] Rock() => Col.Ramp(ROCK);

        /// 水珠：s 1＝一格、2＝有明暗的 2×2、3＝有亮點的圓珠；後面沿速度拖一條尾巴。
        public static void Bead(Painter p, double x, double y, double vx, double vy, double s, uint[] C, double a = 1)
        {
            double sp = Hypot(vx, vy); if (sp == 0 || double.IsNaN(sp)) sp = 1;
            double ux = vx / sp, uy = vy / sp, tail = Math.Min(5, sp * 0.011);
            if (tail >= 1) p.Line(x - ux * (tail + 1), y - uy * (tail + 1), x - ux * 1.2, y - uy * 1.2, u => u < 0.45 ? C[3] : s > 1 ? C[5] : C[4], u => a);
            if (s >= 3)
            {
                p.Circle(x, y, 1.75, C[4], a);
                p.Circle(x - 0.25, y - 0.25, 1.15, C[6], a);
                p.Dot(x - 0.7, y - 0.7, Col.WHITE, a);
            }
            else if (s >= 2)
            {
                double X = Math.Floor(x), Y = Math.Floor(y);
                p.Dot(X, Y, Col.WHITE, a);
                p.Dot(X + 1, Y, C[6], a);
                p.Dot(X, Y + 1, C[5], a);
                p.Dot(X + 1, Y + 1, C[4], a);
            }
            else p.Dot(x, y, sp > 160 ? C[6] : C[5], a);
        }

        /// 水面上漣漪的一圈（低角度看，sy 壓扁）：n 道波峰、相隔 gap，k 是強度。half：0 全圈、-1 遠半邊、1 近半邊。
        public static void Ring(Painter p, double cx, double cy, double r, double sy, double k, uint[] C, int n = 2, double gap = 3, int half = 0, bool hot = false, double glint = 0, int seed = 0, double wob = 0)
        {
            if (k <= 0.02 || r < 0.5) return;
            for (int j = 0; j < n; j++)
            {
                double rr = r - j * gap;
                if (rr < 0.6) break;
                double kj = k * (1 - j * 0.42), m = Math.Max(6, Math.Ceiling(rr * TAU * 1.3)), need = 1.15 - 2.3 * Math.Min(1, kj * 1.25);
                for (int i = 0; i < m; i++)
                {
                    double a = (i / m) * TAU, s = Sin(a); bool near = s > 0;
                    if ((half > 0 && !near) || (half < 0 && near)) continue;
                    // 變弱時波峰斷成一段一段的亮點（整格，不用網點），固定在環上
                    if (Noise(a * 4.7 + seed * 13.1 + j * 5.3, seed) * 0.65 + Noise(a * 11.3 + seed * 7.7, seed + 3) * 0.35 < need) continue;
                    // 近的那邊和朝光（左上）的那邊比較亮
                    double lit = kj * (near ? 1 : 0.7) * (0.88 - 0.12 * Cos(a));
                    uint c = hot && near && j == 0 ? Col.WHITE : C[lit > 0.7 ? 6 : lit > 0.38 ? 5 : 4];
                    double ra = wob != 0 ? rr + wob * Noise(a * 2.6 + seed * 1.9 + j, seed + 11) : rr;
                    double x = cx + Cos(a) * ra, y = cy + s * ra * sy;
                    p.Dot(x, y, c);
                    if (j == 0) p.LightAt(x, y, C[4], 0.3 * lit);
                }
            }
            if (glint > 0 && half >= 0)
            {
                double x = cx + Cos(2.05) * r, y = cy + Sin(2.05) * r * sy;
                p.Px(x, y, Col.WHITE);
                p.Glow(x, y, 3 + glint * 2, C[5], 0.35 * glint);
            }
        }

        /// 浮在水面上的蕾絲泡沫：雜訊的峰連成一張白網，k 變小時變稀。
        public static void Lace(Painter p, double cx, double cy, double rx, double ry, double k, uint[] C, double t, int seed = 0)
        {
            if (k <= 0.01 || rx < 1) return;
            double sy = ry / rx;
            p.Shade(cx - rx, cy - ry, cx + rx, cy + ry, (double x, double y, ref Painter.Out o) =>
            {
                double dx = (x - cx) / rx, dy = (y - cy) / ry, d = dx * dx + dy * dy;
                if (d > 1) return;
                double u = (x - cx) * 0.36, v = ((y - cy) / sy) * 0.36;
                double n = Noise2(u + seed * 7.13, v - t * 0.35, seed), m = Noise2(u * 2.2 - t * 0.3, v * 2.2 + seed * 3.1, seed + 9);
                double net = 1 - Math.Abs(n) * 4.6 + m * 0.3, need = 1.02 - k * (1.15 - d * 0.9);
                if (net < need) return;
                o.c = net > need + 0.4 ? Col.WHITE : C[6];
            });
        }

        /// 小石頭：左上亮、右下暗、暗邊。ST：6 階石頭色。
        public static void Pebble(Painter p, double x, double y, double r, uint[] ST)
        {
            p.Shade(x - r - 1, y - r - 1, x + r + 1, y + r + 1, (double px, double py, ref Painter.Out o) =>
            {
                double dx = px - x, dy = py - y, d = Hypot(dx * 1.1, dy);
                if (d > r + 0.8) return;
                double lit = (dx + dy) / Math.Max(0.5, r);
                o.c = d > r ? ST[0] : lit < -0.7 ? ST[5] : lit < 0.2 ? ST[4] : lit < 0.8 ? ST[3] : ST[2];
            });
        }
    }

    /// 低角度看的水面上飛的水珠：x 橫向、z 往畫面裡（負＝遠）、h 離水面高；落到水面時呼叫 onLand。
    public class WaterDrops
    {
        public class D { public double x, z, h, vx, vz, vh, s = 1, delay, life = 4, max; public bool small; }
        public readonly List<D> List = new List<D>();
        readonly double sy, g, drag; public Action<D> OnLand;
        public WaterDrops(double sy = 0.22, double g = 820, double drag = 0.35) { this.sy = sy; this.g = g; this.drag = drag; }
        public void Add(D d) { d.max = d.life; List.Add(d); }
        public void Update(double dt)
        {
            double k = drag * dt;
            for (int i = List.Count - 1; i >= 0; i--)
            {
                var d = List[i];
                if (d.delay > 0) { d.delay -= dt; continue; }
                if ((d.life -= dt) <= 0) { List.RemoveAt(i); continue; }
                d.vh -= g * dt;
                d.vx -= d.vx * k;
                d.vz -= d.vz * k;
                d.vh -= d.vh * k * 0.5;
                d.x += d.vx * dt;
                d.z += d.vz * dt;
                d.h += d.vh * dt;
                if (d.h <= 0 && d.vh < 0)
                {
                    d.h = 0;
                    List.RemoveAt(i);
                    OnLand?.Invoke(d);
                }
            }
        }
        /// "back"＝z < 0 的，"front"＝z >= 0 的，null＝全部
        public void Draw(Painter p, uint[] C, string layer)
        {
            foreach (var d in List)
            {
                if (d.delay > 0 || (layer == "back" && d.z >= 0) || (layer == "front" && d.z < 0)) continue;
                double x = d.x, y = d.z * sy - d.h;
                WaterLib.Bead(p, x, y, d.vx, d.vz * sy - d.vh, d.s, C, Math.Min(1, d.life / 0.2));
                p.Glow(x, y, 2.5 + d.s, C[5], 0.1 + 0.05 * d.s);
            }
        }
    }

    /// 擴散、變淡的漣漪
    public class Ripples
    {
        class Q { public double x, z, r0, r1, life, age, k, gap, hot, glint; public int n, seed; }
        readonly List<Q> list = new List<Q>(); readonly double sy; int seq;
        public Ripples(double sy = 0.22) { this.sy = sy; }
        public void Add(double x, double z, double r0, double r1, double life, int n = 2, double gap = 3, double k = 1, double hot = 0.1, double glint = 0, double delay = 0)
            => list.Add(new Q { x = x, z = z, r0 = r0, r1 = r1, life = life, age = -delay, k = k, n = n, gap = gap, hot = hot, glint = glint, seed = ++seq });
        public void Update(double dt) { for (int i = list.Count - 1; i >= 0; i--) if ((list[i].age += dt) >= list[i].life) list.RemoveAt(i); }
        public void Draw(Painter p, uint[] C, int half = 0)
        {
            foreach (var q in list)
            {
                if (q.age < 0) continue;
                double u = q.age / q.life, r = q.r0 + (q.r1 - q.r0) * (1 - Pow(1 - u, 2.6)), k = q.k * Pow(1 - u, 1.7);
                WaterLib.Ring(p, q.x, q.z * sy, r, sy, k, C, q.n, q.gap * (0.55 + 0.6 * u), half, q.age < q.hot, q.glint * k, q.seed);
            }
        }
    }

    /// 水霧：沒有硬邊的軟團（越外越透明）、頂上亮，鼓起、漂、變淡。
    public class Mist
    {
        class M { public double x, y, vx, vy, r0, r1, life, max, a, delay; public uint c; }
        readonly List<M> list = new List<M>();
        public void Add(double x, double y, double vx, double vy, double r0, double r1, double life, uint c, double a = 0.25, double delay = 0)
            => list.Add(new M { x = x, y = y, vx = vx, vy = vy, r0 = r0, r1 = r1, life = life, max = life, c = c, a = a, delay = delay });
        public void Update(double dt)
        {
            for (int i = list.Count - 1; i >= 0; i--)
            {
                var m = list[i];
                if (m.delay > 0) { m.delay -= dt; continue; }
                if ((m.life -= dt) <= 0) { list.RemoveAt(i); continue; }
                m.vx -= m.vx * 2.4 * dt;
                m.vy -= m.vy * 2.4 * dt + 7 * dt;
                m.x += m.vx * dt;
                m.y += m.vy * dt;
            }
        }
        public void Draw(Painter p, uint haze)
        {
            foreach (var m in list)
            {
                if (m.delay > 0) continue;
                double age = 1 - m.life / m.max, r = m.r0 + (m.r1 - m.r0) * (1 - Pow(1 - age, 2.2));
                double a = m.a * Math.Min(1, age / 0.12) * Pow(1 - age, 1.4);
                if (a < 0.01) continue;
                p.Disc(m.x, m.y, r, (d, g) => m.c, (d, g) => a * (1 - d * d) * (1 - d * 0.5));
                p.Disc(m.x - r * 0.2, m.y - r * 0.32, r * 0.55, (d, g) => Col.WHITE, (d, g) => a * 0.25 * (1 - d) * (1 - d));
                if (haze != 0) p.Glow(m.x, m.y, r * 1.5, haze, (0.16 * a) / m.a * Math.Min(1, m.a * 3));
            }
        }
    }

    public static class Splash
    {
        public static readonly FxDef Def = new FxDef
        {
            Name = "Splash", W = 176, H = 100, OX = 88, OY = 78, Duration = 2.5, Loop = false, Fps = 30,
            Options = new FxOptions { Palette = WaterLib.WATER, Seed = 3 }.Set("stone", 1),
            Create = Create,
        };

        const double SY = 0.22, HIT = 0.16, G = 820, JET = 0.3, TEAR = 0.11; const int FINGERS = 12;

        // 擊中後 u 秒的水冠：幾格內跳起來、張開，然後落回去
        static double Height(double u) => 19 * Ease.OutCubic(Clamp(u / 0.09)) * (1 - Ease.InQuad(Clamp((u - 0.12) / 0.3)));
        static double Foot(double u) => 3 + 7.5 * Ease.OutCubic(Clamp(u / 0.45));
        static double Lip(double u) => Foot(u) + Height(u) * 0.42 + 3 * Ease.OutCubic(Clamp(u / 0.25));
        // 水冠落下後從中間彈回來的水柱
        static double JetH(double u) => 26 * (Ease.OutCubic(Clamp(u / 0.12)) - Ease.InQuad(Clamp((u - 0.15) / 0.28)));

        class Spike { public double a, L; }
        class Plink { public double x, y, s, age; }
        class Bubble { public double x, z, t0, r; public bool popped; }
        class Cell { public int x, y; public uint c; public double a; public int r; }

        static FxImpl Create(FxOptions o)
        {
            uint WHITE = Col.WHITE;
            uint[] C = Col.Fit(o.Palette, 8); var R = new Rng((uint)o.SeedOr0); var ST = WaterLib.Rock(); double phi = R.Range(0, TAU);
            var ps = new Particles(R); var mist = new Mist(); var lights = new Lights(); var rings = new Ripples(SY);
            var plinks = new List<Plink>(); var bubbles = new List<Bubble>(); var spikes = new Spike[FINGERS];
            for (int k = 0; k < FINGERS; k++) spikes[k] = new Spike { a = ((k * TAU) / FINGERS + phi) % TAU, L = R.Range(0.2, 0.36) };
            var drops = new WaterDrops(SY, G);
            drops.OnLand = d =>
            {
                // 每顆落下的水珠都會「咚」：一點白、一圈漣漪，大的還會濺起一個小水冠
                rings.Add(d.x, d.z, 0.6, 2 + d.s * 1.8, 0.34 + d.s * 0.1, n: 1, k: 0.95, hot: 0.06);
                plinks.Add(new Plink { x = d.x, y = d.z * SY, s = d.s, age = 0 });
                if (d.s > 1 && !d.small)
                    for (int i = 0; i < d.s; i++)
                    {
                        double a = R.Range(0, TAU), v = R.Range(10, 34);
                        drops.Add(new WaterDrops.D { x = d.x, z = d.z, h = 0.5, vx = Cos(a) * v, vz = Sin(a) * v, vh = R.Range(55, 110), s = 1, small = true, life = 1 });
                    }
            };
            double t = 0;
            var doneKeys = new HashSet<string>();
            Func<string, double, bool> once = (key, at) => { if (doneKeys.Contains(key) || !(t >= at)) return false; doneKeys.Add(key); return true; };
            int seed = o.SeedOr0;
            // 水冠的邊不是平的：繞一圈高高低低
            Func<double, double, double> scallop = (a, h) => h * (0.86 + 0.14 * Noise(Cos(a) * 2.2 + Sin(a) * 1.3 + phi * 3, seed));

            // 水冠：從底到捲起的唇邊一片薄薄的水。遠牆的內側陰影露在近的唇邊上面；近牆半透明夾著亮紋，受光的邊緣白；唇邊長出指頭
            void Crown(Painter p, bool back)
            {
                double u = t - HIT, h = Height(u);
                if (u < 0 || h < 0.7) return;
                double r0 = Foot(u), rt = Lip(u); bool white = u < 0.045;
                var cells = new Dictionary<long, Cell>(); var order = new List<long>();
                void Put(double x, double y, uint c, double a, int rank)
                {
                    int X = (int)Math.Floor(x), Y = (int)Math.Floor(y); long key = (long)(Y + 4096) * 8192 + X + 4096;
                    if (!cells.TryGetValue(key, out var cur)) { cells[key] = new Cell { x = X, y = Y, c = c, a = a, r = rank }; order.Add(key); }
                    else if (rank > cur.r) { cur.x = X; cur.y = Y; cur.c = c; cur.a = a; cur.r = rank; }
                }
                double n = Math.Ceiling(rt * TAU * 1.6);
                for (int i = 0; i < n; i++)
                {
                    double a = (i / n) * TAU, s = Sin(a), c = Cos(a);
                    if ((s < 0) != back) continue;
                    double lane = Math.Floor(((a + phi) * rt) / 2.2); bool streak = Rand(ToInt32(lane), 31) < 0.3; double H = scallop(a, h);
                    // 落下時每一條從上面開始各自垮掉
                    double keep = 1 - Clamp((u - 0.13 - 0.14 * Rand(ToInt32(lane), 7)) / 0.1), steps = Math.Ceiling(H * 1.4) + 2;
                    for (int k = 0; k <= steps * keep; k++)
                    {
                        double v = k / steps, r = r0 + (rt - r0) * Pow(v, 2.2), x = c * r, y = s * r * SY - H * v;
                        if (white) Put(x, y, WHITE, 1, 3);
                        else if (back) Put(x, y, v > 0.72 ? (streak ? C[5] : C[4]) : streak ? C[3] : C[2], 1, 1);
                        else if (Math.Abs(c) > 0.9) Put(x, y, c < 0 ? (Math.Abs(c) > 0.97 ? WHITE : C[6]) : C[4], 1, 2);
                        else if (v < 0.1) Put(x, y, v < 0.05 ? WHITE : C[6], 1, 2);
                        else if (streak) Put(x, y, c < -0.2 ? C[6] : C[5], 1, 1);
                        else Put(x, y, c < 0 ? C[5] : C[4], 0.22, 0);
                    }
                    // 捲起的唇邊：近的那邊一條白硬線、遠的柔一點，那條垮掉的地方就沒有
                    if (!white && keep >= 1)
                    {
                        double x = c * rt, y = s * rt * SY - H;
                        Put(x, y, back ? C[5] : c < 0.45 ? WHITE : C[6], 1, 3);
                        if (!back && c < 0.2) Put(x, y + 1, C[6], 1, 2);
                    }
                }
                foreach (var key in order)
                {
                    var q = cells[key];
                    if (q.r == 0) p.Blend(q.x, q.y, q.c, q.a);
                    else p.Px(q.x, q.y, q.c);
                }
                // 指頭：從唇邊再往上往外的尖，撕掉之前頂著一顆珠
                double reach = 1 - Smooth(TEAR, TEAR + 0.1, u);
                foreach (var f in spikes)
                {
                    if ((Sin(f.a) < 0) != back || reach <= 0) continue;
                    double H = scallop(f.a, h), L = h * f.L * reach, x0 = Cos(f.a) * rt, y0 = Sin(f.a) * rt * SY - H, x1 = x0 + Cos(f.a) * L * 0.45, y1 = y0 - L;
                    if (L >= 1) p.Line(x0, y0, x1, y1, white ? WHITE : back ? C[4] : C[6]);
                    if (u > 0.04 && u < TEAR) WaterLib.Bead(p, x1 - (back ? 0 : 0.5), y1 - 1, 0, -1, back ? 1 : 2, C);
                    if (!back && Sin(f.a) > 0.3) p.Glow(x0, y0, 6, C[5], 0.22 * reach);
                }
            }

            void Jet(Painter p)
            {
                double u = t - HIT - JET, h = JetH(u);
                if (u < 0 || h < 0.8) return;
                double top = -h;
                // 底下鼓起一團水
                p.Ellipse(0, 0, 5, 2.4, (d, a) => Sin(a) > 0 ? 0u : d < 0.5 ? WHITE : Cos(a) < 0 ? C[6] : C[5], (d, a) => 1);
                p.Shade(-3, top - 2, 3, 0, (double x, double y, ref Painter.Out o2) =>
                {
                    double v = Clamp((y - top) / h), w = 1.15 + 1.5 * v * v * v, q = x / w;
                    if (Math.Abs(q) > 1) return;
                    o2.c = q < -0.5 ? C[6] : q < 0.3 ? WHITE : q < 0.72 ? C[5] : C[4];
                });
                if (u < 0.12)
                {
                    // 尖端快要斷掉的那顆
                    p.Circle(0, top - 1, 1.7, C[5]);
                    p.Circle(-0.3, top - 1.3, 1.1, C[6]);
                    p.Px(-1, top - 2, WHITE);
                }
                p.GlowLine(0, -1, 0, top, 7, C[5], 0.3);
            }

            return new FxImpl
            {
                Update = (dt, _) =>
                {
                    t += dt;
                    if (once("hit", HIT))
                    {
                        lights.Add(0, -6, 52, C[5], 0.6, 0.45);
                        lights.Add(0, -4, 16, WHITE, 0.5, 0.08);
                        rings.Add(0, 0, 8, 56, 2.0, n: 2, gap: 3.4, k: 1.35, hot: 0.16, glint: 1);
                        rings.Add(0, 0, 5, 38, 1.7, n: 1, k: 0.9, delay: 0.14);
                        // 第一片水花，又快又細
                        for (int i = 0; i < 20; i++)
                        {
                            double a = R.Range(0, TAU), v = R.Range(50, 125);
                            var d = new WaterDrops.D { x = Cos(a) * 3, z = Sin(a) * 3 };
                            d.h = R.Range(1, 6); d.vx = Cos(a) * v; d.vz = Sin(a) * v; d.vh = R.Range(160, 270); d.s = R.Chance(0.25) ? 2 : 1; d.delay = R.Range(0, 0.04);
                            drops.Add(d);
                        }
                        // 水霧沿水面低低地滾出去
                        for (int i = 0; i < 9; i++)
                        {
                            double s = i % 2 != 0 ? 1 : -1, x = s * R.Range(4, 12);
                            mist.Add(x, -R.Range(1, 7), s * R.Range(25, 70), -R.Range(4, 16), R.Range(2.5, 4), R.Range(7, 11), R.Range(0.9, 1.5), R.Chance(0.5) ? C[6] : C[5], R.Range(0.3, 0.42), R.Range(0, 0.1));
                        }
                    }
                    if (once("spray", HIT + 0.04))
                    {
                        for (int i = 0; i < 20; i++)
                        {
                            double a = R.Range(0, TAU);
                            ps.Spawn(P.FLAKE, Cos(a) * 9, Sin(a) * 9 * SY - R.Range(6, 15), Cos(a) * R.Range(25, 90), -R.Range(30, 100), R.Range(0.7, 1.3), R.Chance(0.5) ? WHITE : C[6], R.Range(0.6, 1.5));
                        }
                        for (int i = 0; i < 5; i++) ps.Spawn(P.STAR, R.Range(-13, 13), -R.Range(6, 20), 0, -4, R.Range(0.25, 0.55), C[6], R.Range(1, 2.4), R.Range(0, 0.15));
                    }
                    if (once("tear", HIT + TEAR))
                    {
                        // 指頭尖上的珠撕掉、畫弧飛走
                        double h = Height(TEAR), rt = Lip(TEAR);
                        foreach (var f in spikes)
                        {
                            double a = f.a + R.Range(-0.08, 0.08), v = R.Range(32, 88), L = h * f.L;
                            var d = new WaterDrops.D { x = Cos(f.a) * (rt + L * 0.45), z = Sin(f.a) * rt, h = h + L + 1, vx = Cos(a) * v, vz = Sin(a) * v };
                            d.vh = R.Range(90, 190); d.s = R.Chance(0.3) ? 3 : 2;
                            drops.Add(d);
                        }
                    }
                    // 水冠垮掉時唇邊散成水珠
                    double uu = t - HIT;
                    if (uu > 0.13 && uu < 0.3 && R.Chance(0.3))
                    {
                        double a = R.Range(0, TAU), rt = Lip(uu), v = R.Range(15, 45);
                        var d = new WaterDrops.D { x = Cos(a) * rt, z = Sin(a) * rt };
                        d.h = scallop(a, Height(uu)) * R.Range(0.6, 1); d.vx = Cos(a) * v; d.vz = Sin(a) * v; d.vh = R.Range(-10, 45); d.s = R.Chance(0.3) ? 2 : 1;
                        drops.Add(d);
                    }
                    if (once("fall", HIT + 0.3))
                    {
                        // 水冠落回去，在近處掉幾顆重的
                        for (int i = 0; i < 8; i++)
                        {
                            double a = R.Range(0, TAU), r = Lip(0.3), v = R.Range(15, 40);
                            var d = new WaterDrops.D { x = Cos(a) * r, z = Sin(a) * r };
                            d.h = R.Range(3, 7); d.vx = Cos(a) * v; d.vz = Sin(a) * v; d.vh = R.Range(30, 80); d.s = R.Chance(0.4) ? 2 : 1;
                            drops.Add(d);
                        }
                    }
                    if (once("bead", HIT + JET + 0.12))
                    {
                        // 水柱尖端斷成一顆珠，停一下再落回去
                        var d = new WaterDrops.D { x = 0, z = 0.2, h = JetH(0.12) + 1 };
                        d.vx = R.Range(-6, 6); d.vz = 0; d.vh = 55; d.s = 3;
                        drops.Add(d);
                        for (int i = 0; i < 3; i++) mist.Add(R.Range(-3, 3), -JetH(0.12) + R.Range(2, 8), R.Range(-14, 14), -R.Range(4, 12), 2, R.Range(4, 6), R.Range(0.6, 1), C[6], 0.3);
                    }
                    if (once("slump", HIT + JET + 0.38))
                    {
                        rings.Add(0, 0, 3, 30, 1.5, n: 2, gap: 2.6, k: 0.9);
                        for (int i = 0; i < 4; i++) mist.Add(R.Range(-6, 6), -R.Range(1, 4), R.Range(-30, 30), -R.Range(3, 10), 2.5, R.Range(6, 9), R.Range(0.8, 1.2), C[5], 0.28);
                    }
                    // 石頭沉下去吐出空氣：幾顆泡泡浮上來破掉
                    double[][] GLUG = { new[] { 0, 0.95 }, new[] { 1, 1.2 }, new[] { 2, 1.5 } };
                    foreach (var gl in GLUG)
                        if (once("glug" + (int)gl[0], HIT + gl[1]))
                        {
                            var b = new Bubble(); b.x = R.Range(-5, 5); b.z = R.Range(-6, 6); b.t0 = t; b.r = R.Range(1.3, 2.3); b.popped = false;
                            bubbles.Add(b);
                        }
                    foreach (var b in bubbles)
                        if (!b.popped && t - b.t0 > 0.2)
                        {
                            b.popped = true;
                            rings.Add(b.x, b.z, 1, 7, 0.6, n: 1, k: 0.9);
                            plinks.Add(new Plink { x = b.x, y = b.z * SY, s = 1, age = 0 });
                            for (int i = 0; i < 2; i++)
                            {
                                var d = new WaterDrops.D { x = b.x, z = b.z, h = 1 };
                                d.vx = R.Range(-20, 20); d.vz = R.Range(-10, 10); d.vh = R.Range(50, 90); d.s = 1; d.small = true; d.life = 1;
                                drops.Add(d);
                            }
                        }
                    for (int i = plinks.Count - 1; i >= 0; i--) if ((plinks[i].age += dt) > 0.14) plinks.RemoveAt(i);
                    drops.Update(dt);
                    rings.Update(dt);
                    mist.Update(dt);
                    ps.Update(dt);
                    lights.Update(dt);
                },
                DrawBack = (p, _, __) =>
                {
                    double u = t - HIT;
                    // 石頭打出來的凹洞，水冠底部裡面暗暗的
                    if (u > 0 && u < 0.26)
                    {
                        double r = Foot(u) * 0.85 * (1 - Smooth(0.12, 0.26, u));
                        p.Ellipse(0, 0, r, r * SY + 0.6, (d, a) => Sin(a) < 0 ? C[1] : C[2], (d, a) => 1);
                    }
                    rings.Draw(p, C, -1);
                    Crown(p, true);
                    drops.Draw(p, C, "back");
                },
                Draw = (p, _, __) =>
                {
                    double u = t - HIT;
                    rings.Draw(p, C, 1);
                    if (u > 0.2)
                    {
                        double rx = 4 + 11 * Ease.OutCubic(Clamp((u - 0.2) / 0.7)), k = Smooth(0.2, 0.32, u) * (1 - Smooth(0.5, 2.0, u)) * 0.9;
                        WaterLib.Lace(p, 0, 0, rx, rx * SY + 0.5, k, C, t, seed);
                    }
                    Crown(p, false);
                    Jet(p);
                    foreach (var b in bubbles)
                    {
                        double g = (t - b.t0) / 0.2;
                        if (g > 1) continue;
                        double r = b.r * Ease.OutBack(g), x = b.x, y = b.z * SY;
                        for (double a = Math.PI; a <= TAU + 0.01; a += 0.5 / Math.Max(1, r)) p.Dot(x + Cos(a) * r, y + Sin(a) * r, C[6]);
                        p.Px(x - r * 0.4, y - r * 0.6, WHITE);
                        p.Glow(x, y - 1, 4, C[5], 0.25);
                    }
                    foreach (var q in plinks)
                    {
                        double k = q.age / 0.14;
                        if (k < 0.5) p.Px(q.x, q.y, WHITE);
                        if (q.s > 1) p.Line(q.x, q.y - 1, q.x, q.y - 1 - 3 * (1 - k), k < 0.4 ? WHITE : C[6]);
                        p.Glow(q.x, q.y, 4, C[5], 0.3 * (1 - k));
                    }
                    drops.Draw(p, C, "front");
                    // 擊中：水面上平平的白閃兩格
                    if (u >= 0 && u < 0.07)
                    {
                        p.Ellipse(0, 0, 10, 2.4, (d, g) => d < 0.6 ? WHITE : C[6], (d, g) => 1);
                        Sim.Sparkle(p, 0, -3, 5 * (1 - u / 0.07), C[6], C[5], 0.5);
                    }
                    // 石頭：快速掉下來，後面一條空氣的線
                    if (o.Num["stone"] != 0 && t < HIT)
                    {
                        double v = t / HIT, y = -70 + 70 * (0.4 * v + 0.6 * v * v);
                        p.Line(0, y - 12, 0, y - 3, w => ST[4], w => w * 0.8);
                        WaterLib.Pebble(p, 0, y, 2.6, ST);
                    }
                    mist.Draw(p, C[5]);
                    ps.Draw(p);
                    lights.Draw(p);
                    // 被攪動的水在平靜下來前一直帶一點冷光
                    if (u > 0)
                    {
                        p.Glow(0, -2, 34, C[4], 0.2 * (1 - Smooth(0, 1.6, u)));
                        p.Glow(0, 2, 64, C[3], 0.16 * (1 - Smooth(0.1, 2.1, u)));
                    }
                },
            };
        }
    }
}
