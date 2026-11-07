// 網頁版 pixelfx/src/fx/critters/slime.js 一行一行翻成 C#（純函式迴圈特效，有前後兩層）。
// 亮晶晶的史萊姆原地跳：壓扁蓄力、拉長起跳、在空中變圓、啪一聲落地甩出水滴（水滴會爬回來），然後晃一晃、眨眼。
// 選項：Palette（7 階）、Num["hop"]（跳多高）、Seed（不是 1 的從迴圈別的地方開始）、Light。
using System;
using static PixelFX.Pf;
using static PixelFX.Fx.CritterLib;

namespace PixelFX.Fx
{
    public static class Slime
    {
        public static readonly FxDef Def = new FxDef
        {
            Name = "Slime", W = 112, H = 88, OX = 56, OY = 72, Duration = 1.8, Loop = true, Fps = 30,
            Options = new FxOptions { Palette = new[] { "#061412", "#0b2f2b", "#12594a", "#1f8f4f", "#47c752", "#a6f06a", "#f0ffd2" }, Seed = 1 }.Set("hop", 24),
            Pure = new FxImpl { DrawBack = DrawBack, Draw = Draw },
        };

        static readonly Grid GRID = new Grid(-30, -64, 60, 66);
        const double D = 1.8, T_SQ = 0.5, T_UP = 0.84, T_LIFT = 0.9, T_LAND = 1.44, SNAP = 0.965;
        const double W0 = 30, H0 = 22, VC = 0.4, G = 640; const int NDROP = 12;
        static readonly double[][] DRIPS = { new[] { 1.02, -4 }, new[] { 1.18, 3.0 } };

        /// 關鍵格之間平滑接起來的曲線（不循環：第一格之前、最後一格之後都持平）
        static double Curve(double x, double[][] list)
        {
            if (x <= list[0][0]) return list[0][1];
            for (int i = 1; i < list.Length; i++)
            {
                double x0 = list[i - 1][0], v0 = list[i - 1][1], x1 = list[i][0], v1 = list[i][1];
                if (x <= x1)
                {
                    double d = x1 - x0, u = (x - x0) / (d != 0 ? d : 1);
                    return v0 + (v1 - v0) * u * u * (3 - 2 * u);
                }
            }
            return list[list.Length - 1][1];
        }
        /// 每 D 秒重複的平滑雜訊（-1～1）
        static double LNoise(double t, double Dd, double F, double off = 0, int seed = 0) => TileNoise((t / Dd) * F + off, 0.5, F, 0, seed);

        class Pz { public double s, by, lean, round, q, age, W, H; }
        static readonly double[][] AIR = { new[] { 0, 0.36 }, new[] { 0.4, 0.02 }, new[] { 0.55, -0.05 }, new[] { 0.85, 0.08 }, new[] { 1, 0.16 } };
        // 迴圈時間 t 的身體形狀：s > 0 拉高、s < 0 壓扁
        static Pz Pose(double t, double hop)
        {
            double age = Wrap(t - T_LAND, D);
            double s, by = 0, lean = 0, round = 0.1, q = -1;
            if (t >= T_LIFT && t < T_LAND)
            {
                q = (t - T_LIFT) / (T_LAND - T_LIFT);
                by = -hop * 4 * q * (1 - q);
                s = Curve(q, AIR);
                round = 0.1 + 0.8 * Smooth(0, 0.16, q) * (1 - Smooth(0.86, 1, q));
            }
            else if (t >= T_UP && t < T_LIFT) s = Lerp(-0.3, 0.36, Ease.OutCubic(Seg(t, T_UP, T_LIFT)));
            else if (t >= T_SQ && t < T_UP)
            {
                double u = Seg(t, T_SQ, T_UP);
                s = -0.3 * Ease.InOutSine(u) + 0.018 * Sin(t * TAU * 16) * Smooth(0.55, 1, u);
            }
            else
            {
                // 落地壓扁停一下，再彈簧一樣晃；上面左右擺一點
                s = age < 0.06 ? -0.46 : -0.46 * Spring(age - 0.06, 2.1, 4.6);
                lean = 0.07 * Exp(-age * 4) * Sin(age * TAU * 1.9);
                if (t < T_SQ) s += 0.02 * Sin((t / T_SQ) * TAU);
            }
            return new Pz { s = s, by = by, lean = lean, round = round, q = q, age = age, W = W0 / Math.Sqrt(1 + s), H = H0 * (1 + s) };
        }

        // 高度 v（0 底～1 頂）那裡身體的半寬：圓頂＋圓角的底
        static double HalfW(double v, Pz P)
        {
            if (v < 0 || v > 1) return -1;
            double W = P.W, Hh = P.H, round = P.round;
            if (v >= VC)
            {
                double q2 = (v - VC) / (1 - VC);
                return (W / 2) * Math.Sqrt(1 - q2 * q2);
            }
            double q = (VC - v) / VC, hb = v * Hh, rc = 3;
            double hw = (W / 2) * Math.Sqrt(Math.Max(0, 1 - round * q * q));
            if (hb < rc) hw -= rc - Math.Sqrt(rc * rc - Pow(rc - hb, 2));
            return hw;
        }
        static bool Inside(Pz P, double x, double y)
        {
            double v = (P.by - 1 - y) / P.H, hw = HalfW(v, P);
            return hw >= 0 && Math.Abs(x - P.lean * v * P.H) <= hw;
        }

        // 果凍的畫法：暗的圓頂、底部積著亮光、陰影月牙、左上沿輪廓的亮線和下面一點反光、地面反上來的光
        static void Body(Grid g, uint[] C, Pz P)
        {
            double yb = P.by - 1, half = P.W / 2 + 3;
            double cx = P.lean * 0.45 * P.H, cy = yb - P.H * 0.5, lx = cx - P.W * 0.24, ly = cy - P.H * 0.36;
            Func<double, double, double, bool> lit = (x, y, k) => Inside(P, lx + (x - lx) / k, ly + (y - ly) / k);
            g.Clear();
            g.Shade(-half, yb - P.H - 1, half, yb, (double x, double y, ref Grid.GOut o) =>
            {
                if (!Inside(P, x, y)) return 0;
                o.t = 1;
                o.a = 0.92;
                int i = lit(x, y, 0.42) ? 5 : lit(x, y, 0.7) ? 4 : 3;
                double v = (yb - y) / P.H;
                if (v < 0.3 && Inside(P, x, y + 1.4)) i = !Inside(P, x, y + 2.4) ? 5 : v < 0.2 ? 4 : i;
                if (!Inside(P, x + 2, y + 2.4)) { i = 2; o.a = 1; }
                double ang = Atan2(y - cy, (x - cx) * (P.H / P.W));
                if (!Inside(P, x - 1.6, y - 1.6) && Inside(P, x - 0.7, y - 0.7) && ang > -2.75 && ang < -1.55) { i = ang > -2.45 && ang < -1.8 ? 6 : 5; o.a = 1; }
                if (i == 2 && Inside(P, x + 1, y + 1.2) && !Inside(P, x + 2, y + 2.4) && ang > 0.3 && ang < 1.5) i = 4;
                return C[i];
            });
            // 亮線下面一小格窗戶的反光
            double hx = Round(cx - P.W * 0.27), hy = Round(cy - P.H * 0.14);
            if (Inside(P, hx - 1, hy) && Inside(P, hx + 1, hy + 1)) { g.Set(hx, hy, C[6]); g.Set(hx, hy + 1, C[5]); }
        }

        // 眼睛跟著壓扁：蓄力時瞇眼、空中睜大、落地緊閉、休息時眨一下
        static void Face(Grid g, uint[] C, Pz P, double t)
        {
            double yb = P.by - 1, ev = 0.47, ey = Round(yb - P.H * ev), ex = Math.Max(3, Round(P.W * 0.16)), xc = Round(P.lean * ev * P.H);
            bool air = P.q >= 0, shut = P.age < 0.16 && !air, blink = t > 0.22 && t < 0.29;
            double wind = t >= T_SQ && t < T_LIFT ? Seg(t, T_SQ, T_UP) : 0; int look = air ? (P.q < 0.45 ? -1 : P.q > 0.7 ? 1 : 0) : 0;
            double eh = Clamp(Round(4 * (1 + P.s * 0.8) - wind * 2 + (air && P.q < 0.6 ? 1 : 0)), 1, 5);
            foreach (int side in new[] { -1, 1 })
            {
                double x = xc + side * ex - (side > 0 ? 1 : 0);
                if (shut)
                {
                    int a = side < 0 ? 0 : 1, b = 1 - a;
                    g.Set(x + a, ey - 1, C[0]); g.Set(x + b, ey, C[0]); g.Set(x + a, ey + 1, C[0]);
                    continue;
                }
                if (blink)
                {
                    g.Set(x, ey + 1, C[0]); g.Set(x + 1, ey + 1, C[0]);
                    continue;
                }
                double top = ey + 2 - eh + look;
                for (int k = 0; k < eh; k++) { g.Set(x, top + k, C[0]); g.Set(x + 1, top + k, C[0]); }
                g.Set(x + (look > 0 ? 1 : 0), top + (look > 0 ? 1 : 0), C[6]);
                if (eh >= 4) g.Set(x + 1, top + eh - 1, C[2]);
            }
            double my = Round(yb - P.H * 0.31);
            if (air && P.q < 0.75) { g.Set(xc, my, C[0]); g.Set(xc - 1, my, C[0]); g.Set(xc, my + 1, C[1]); g.Set(xc - 1, my + 1, C[1]); }
            else if (!shut) { g.Set(xc, my, C[1]); g.Set(xc - 1, my, C[1]); }
        }

        // 休息時一顆泡泡從果凍裡往上爬，到頂破掉
        const double POP = 0.4;
        static void BubbleIn(Grid g, uint[] C, Pz P, double t)
        {
            if (t > POP) return;
            double v = Lerp(0.18, 0.86, Ease.InQuad(t / POP)), hw = HalfW(v, P), x = P.lean * v * P.H - hw * Lerp(0.35, 0.05, t / POP), y = P.by - 1 - v * P.H;
            g.Set(x, y, C[6]); g.Set(x + 1, y, C[5]); g.Set(x, y + 1, C[5]); g.Set(x + 1, y + 1, C[4]);
        }

        // 落地甩出去的水滴：拋物線、落地小啪一下、再爬回身體
        class Drop { public double x, y, vx, vy, at, lx, k, splat; public bool landed, gone; public int size; }
        static Drop Droplet(int i, int seed, double age)
        {
            var r = Rng.Of(seed, i, 7);
            double a = -Math.PI / 2 + r.Range(-1.2, 1.2), sp = r.Range(60, 118); int size = r.Chance(0.35) ? 1 : r.Chance(0.7) ? 2 : 3;
            double fa = a + Math.PI / 2, x0 = Sin(fa) * 21, y0 = -1 - Cos(fa) * 12.5;
            var tz = Toss(x0, y0, Cos(a) * sp * 0.75, Sin(a) * sp, age, G, -1);
            var f = new Drop { x = tz.x, y = tz.y, vx = tz.vx, vy = tz.vy, at = tz.at, lx = tz.lx, landed = tz.landed, size = size };
            if (f.landed)
            {
                double home = (f.lx != 0 ? Sign(f.lx) : 1) * (W0 / 2 - 2), dur = Math.Min(0.55, 0.22 + Math.Abs(f.lx - home) / 60), u = Seg(age - f.at - 0.14, 0, dur);
                f.x = Lerp(f.lx, home, Ease.InOutSine(u));
                f.k = 1 - u;
                f.gone = u >= 1;
                f.splat = Clamp(1 - (age - f.at) / 0.14);
            }
            return f;
        }

        // 坐著的那灘水：壓扁時寬、落地濺開、跳起來時留在地上
        static double PuddleR(double t, Pz P)
        {
            if (P.q >= 0) return (W0 / Math.Sqrt(1.36) / 2 + 3) * (1 - 0.22 * P.q);
            return P.W / 2 + 3 + 9 * Exp(-P.age * 5) * (1 - Exp(-P.age * 40)) * (t >= T_LAND || t < T_SQ ? 1 : 0);
        }

        static void Draw(Painter p, double time, FxOptions o)
        {
            int seed = o.SeedOr0; double hop = o["hop"];
            double t = Shift(time, D, seed); uint[] C = Col.Fit(o.Palette, 7); var P = Pose(t, hop); double yb = P.by - 1, age = P.age;
            var g = GRID;
            Body(g, C, P);
            Face(g, C, P, t);
            BubbleIn(g, C, P, t);
            g.Outline((x, y, nx, ny) => ny < 0 && nx <= 0 && y < yb - P.H * 0.5 ? C[1] : C[0]);
            g.Draw(p);

            // 泡泡從頂上破出來：一圈和兩點
            if (t >= POP && t < POP + 0.16)
            {
                double k = (t - POP) / 0.16, x = P.lean * P.H - HalfW(0.86, P) * 0.05, y = yb - P.H - 0.5;
                for (double a = 0; a < TAU; a += 0.6) p.Dot(x + Cos(a) * (1 + k * 3), y + Sin(a) * (1 + k * 3) * 0.7, C[6], 1.2 - k);
                foreach (int s in new[] { -1, 1 }) p.Dot(x + s * (1 + k * 4), y - 1 - k * 6 + k * k * 4, C[5], 1.3 - k);
                p.Glow(x, y, 6, C[5], 0.4 * (1 - k));
            }
            // 飛在空中的水滴
            for (int i = 0; i < NDROP; i++)
            {
                var f = Droplet(i, seed, age);
                if (f.landed || Inside(P, f.x, f.y)) continue;
                double sv = Hypot(f.vx, f.vy); if (sv == 0 || double.IsNaN(sv)) sv = 1;
                double ux = f.vx / sv, uy = f.vy / sv, L = Math.Min(2.5, sv / 50);
                p.Line(f.x - ux * L, f.y - uy * L, f.x, f.y, C[3]);
                if (f.size >= 2) { p.Px(f.x - 1, f.y, C[4]); p.Px(f.x - 1, f.y + 1, C[3]); p.Px(f.x, f.y + 1, C[2]); }
                if (f.size >= 3) { p.Px(f.x + 1, f.y, C[3]); p.Px(f.x - 1, f.y - 1, C[4]); p.Px(f.x, f.y - 1, C[5]); }
                p.Px(f.x, f.y, f.size >= 2 ? C[6] : C[5]);
                p.Glow(f.x, f.y, 5 + f.size, C[4], 0.32);
            }
            // 從水灘飄上去、會發光的孢子
            Sim.Cycle(t, D, 7, seed * 13 + 1, r => r.Range(1.2, 1.8), (ag, L, r, i) =>
            {
                double k = ag / L, x = r.Range(-24, 24) + Sin(ag * 2.1 + i * 1.7) * 3, y = -2 - r.Range(9, 17) * ag - 5 * ag * ag;
                double a = Math.Min(1, k * 4) * Math.Min(1, (1 - k) * 2.5), tw = 0.6 + 0.4 * Sin(ag * 7 + i * 2.3); bool big = r.Chance(0.35);
                p.Dot(x, y, tw > 0.8 ? C[6] : C[5], a);
                if (big) { p.Dot(x + 1, y, C[5], a); p.Dot(x, y + 1, C[4], a); p.Dot(x + 1, y + 1, C[4], a * 0.6); }
                p.Glow(x, y, big ? 9 : 6, C[5], (big ? 0.45 : 0.32) * a * tw);
            });
            // 在空中時從底下滴下去、掉進水灘的水滴
            foreach (var dr in DRIPS)
            {
                double t0 = dr[0], dx = dr[1];
                double a2 = Wrap(t - t0, D);
                if (a2 > 0.6) continue;
                var P0 = Pose(t0, hop); var f = Toss(dx, P0.by - 0.5, 0, 12, a2, G, -1);
                if (!f.landed) { p.Px(dx, f.y, C[5]); p.Px(dx, f.y - 1, C[4]); p.Glow(dx, f.y, 4, C[4], 0.3); }
                else if (a2 - f.at < 0.14)
                {
                    double k = (a2 - f.at) / 0.14;
                    foreach (int s2 in new[] { -1, 1 }) p.Dot(dx + s2 * (1 + k * 3), -2 - k * 3 + k * k * 3, C[5], 1.2 - k);
                }
            }
            // 跳到最高時圓頂上一道閃光
            if (P.q > 0.4 && P.q < 0.64)
            {
                double k = Sin(Math.PI * Seg(P.q, 0.4, 0.64));
                Sim.Sparkle(p, P.lean * 0.8 * P.H - P.W * 0.21, yb - P.H * 0.8, 1 + 2.5 * k, C[6], C[5], 0.5 * k);
            }
            // 光：史萊姆透出來的光、水灘照亮地面、落地一閃
            double cx = P.lean * P.H * 0.4, cy = yb - P.H * 0.45, near = Clamp(1 + P.by / (hop * 1.1));
            double R = PuddleR(t, P), br = 0.9 + 0.1 * Sin((t / D) * TAU * 2);
            p.Glow(cx * 0.5, -14, 64, C[3], 0.3 * br);
            p.Glow(cx, cy, 30 + P.W * 0.3, C[4], 0.2);
            p.Glow(cx, cy + 3, 14, C[5], 0.16);
            p.Glow(0, -2, R * 1.3 + 6, C[4], 0.12 + 0.08 * near);
            if (t >= T_LAND || t < T_SQ) p.Glow(0, -3, 40, C[5], 0.42 * Exp(-age * 9));
        }

        static void DrawBack(Painter p, double time, FxOptions o)
        {
            int seed = o.SeedOr0; double hop = o["hop"];
            double t = Shift(time, D, seed); uint[] C = Col.Fit(o.Palette, 7); var P = Pose(t, hop); double age = P.age;
            // 水灘：低低的一片，上緣有光滑過去，貼地的地方暗
            double R = PuddleR(t, P), hp = Math.Min(2.4, 0.9 + R * 0.06);
            for (int x = (int)Math.Floor(-R); x <= (int)Math.Ceiling(R); x++)
            {
                double d = Math.Abs(x + 0.5) / R;
                if (d > 1) continue;
                int top = -1 - (int)Round(Math.Sqrt(1 - d * d) * hp);
                for (int y = top; y <= 0; y++)
                {
                    uint c = y == top ? C[5] : y == 0 ? C[2] : C[4];
                    if (d > 0.88) c = y == top ? C[4] : C[3];
                    if (y == top && d < 0.88)
                    {
                        double n = LNoise(t, D, 7, x * 0.18, 3) + LNoise(t, D, 4, x * 0.07, 4) * 0.6;
                        if (n > 0.55) c = C[6];
                    }
                    else if (y == top + 1 && d < 0.8 && LNoise(t, D, 3, x * 0.12, 5) > 0.3) c = C[5];
                    p.Px(x, y, c);
                }
                if (d > 0.96) p.Px(x, top - 1, C[1]);
            }
            // 水灘冒出來的泡泡，破掉時甩出小點
            Sim.Cycle(t, D, 4, seed * 17 + 3, r => r.Range(0.45, 0.75), (ag, L, r, i) =>
            {
                double x = r.Range(-0.85, 0.85) * R, k = ag / L, rb = r.Range(1.4, 2.6) * (0.3 + 0.7 * Ease.OutCubic(Math.Min(1, k * 1.25)));
                if (Math.Abs(x) < P.W / 2 + 1 && P.q < 0) return;
                double sy = -1 - Round(Math.Sqrt(Math.Max(0, 1 - Pow(x / R, 2))) * hp);
                if (k < 0.85)
                {
                    for (double y = Math.Floor(sy - rb); y <= sy; y++)
                        for (double xx = Math.Floor(x - rb - 1); xx <= Math.Ceiling(x + rb + 1); xx++)
                        {
                            double dx = xx + 0.5 - x, dy = y + 0.5 - sy, dd = Hypot(dx, dy);
                            if (dd > rb + 0.5) continue;
                            if (dd > rb - 0.7) p.Px(xx, y, dx < 0 && dy < -rb * 0.3 ? C[6] : C[4]);
                            else p.Blend(xx, y, C[5], 0.3);
                        }
                    p.Glow(x, sy - rb * 0.5, rb * 2 + 3, C[5], 0.2);
                }
                else
                {
                    double q = (k - 0.85) / 0.15;
                    double[][] dirs = { new[] { 1.0, 0 }, new[] { -1.0, 0 }, new[] { 0.6, -0.7 }, new[] { -0.6, -0.7 }, new[] { 0.0, -1 } };
                    foreach (var dd in dirs) p.Dot(x + dd[0] * (2 + 3 * q), sy + dd[1] * (2 + 3 * q), C[6], 1.2 - q);
                }
            });
            // 落地的水滴：壓扁的一點，再一顆慢慢爬回家，後面留一條濕痕
            for (int i = 0; i < NDROP; i++)
            {
                var f = Droplet(i, seed, age);
                if (!f.landed || f.gone) continue;
                int x = (int)Round(f.x), w = f.size + (f.splat > 0 ? 1 : 0);
                for (int j = 0; j < w; j++) p.Px(x - (w >> 1) + j, -1, j == 0 ? C[5] : C[4]);
                if (f.size >= 2 && f.splat <= 0) { p.Px(x, -2, C[5]); p.Px(x - 1, -2, C[4]); }
                p.Px(x, 0, C[3]);
                double dir = Sign(f.lx - f.x);
                for (int j = 1; j < Math.Min(8, Math.Abs(f.lx - f.x)); j++) p.Dot(x + dir * j, 0, C[2], 0.7 - j * 0.08);
                p.Glow(x, -1, 5, C[4], 0.25 * f.k + 0.1);
            }
            // 離地時從地上拉起的黏絲；斷掉時一滴掉回去、其他縮上去
            if (t >= T_LIFT && t < SNAP)
            {
                double bot = P.by - 1, u = (t - T_LIFT) / (SNAP - T_LIFT);
                for (double y = Math.Floor(bot); y < 0; y++)
                {
                    double m = Sin(((y - bot) / -bot) * Math.PI);
                    p.Px(-1, y, C[4]);
                    if (m * u < 0.45) p.Px(0, y, C[3]);
                }
            }
            else if (t >= SNAP && t < SNAP + 0.3)
            {
                double a2 = t - SNAP, ys = Pose(SNAP, hop).by - 1; var f = Toss(-1, ys * 0.45, 0, 0, a2, G * 1.3, -2);
                if (!f.landed) { p.Px(-1, f.y, C[5]); p.Px(-1, f.y - 1, C[3]); }
                double nub = 3 * (1 - a2 / 0.12);
                for (int j = 0; j < nub; j++) p.Px(-1, P.by + j, j == 0 ? C[3] : C[4]);
            }
        }
    }
}
