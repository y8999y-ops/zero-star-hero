// 網頁版 pixelfx/src/fx/critters/frog.js 一行一行翻成 C#（純函式迴圈特效，有前後兩層）。
// 青蛙鼓起喉囊、眨眼、蹲低、跳起來把嗡嗡飛的蒼蠅從空中舔掉，落地壓扁、揚起一圈灰，吞下去、坐好。
// 選項：Palette（7 階身體）、Ramps["belly"]（3 階肚子）、Seed（不是 1 的從迴圈別的地方開始）、Light。
using System;
using System.Collections.Generic;
using static PixelFX.Pf;
using static PixelFX.Fx.CritterLib;

namespace PixelFX.Fx
{
    public static class Frog
    {
        public static readonly FxDef Def = new FxDef
        {
            Name = "Frog", W = 112, H = 88, OX = 56, OY = 80, Duration = 2.6, Loop = true, Fps = 30,
            Options = new FxOptions
            {
                Palette = new[] { "#0a160c", "#173a18", "#256024", "#3a8a2e", "#62b440", "#a8e070", "#e8ffc0" },
                Seed = 1,
            }.Set("belly", new[] { "#5e5a24", "#bdb45a", "#efe9a8" }),
            Pure = new FxImpl { DrawBack = DrawBack, Draw = Draw },
        };

        const double D = 2.6;
        static readonly Grid GRID = new Grid(-22, -40, 44, 44);
        static readonly Swarm SWARM = new Swarm();
        const double T_CROUCH = 0.95, T_UP = 1.2, T_LAND = 1.62, T_SNAP = 1.4, T_BACK = 1.95, G = 1000;
        static readonly double HOP = (G * Pow(T_LAND - T_UP, 2)) / 8;
        static readonly uint[] EYE = Col.Ramp(new[] { "#3a2a08", "#c89420", "#ffd860" });
        static readonly uint TONGUE = Col.Hex("#e8607a"), FLY = Col.Hex("#141018"), WINGS = Col.Hex("#c8d0e0"), DUST = Col.Hex("#8a7f92");
        static readonly uint GRIT_A = Col.Hex("#6a6074"), GRIT_B = Col.Hex("#9a90a4");

        struct Pose { public double by, rot, sq, leg, throat; public bool shut, air; }
        static readonly double[][] THROAT = { new[] { 0.05, 0.45 }, new[] { 0.5, 0.85 }, new[] { 1.75, 1.95 } };
        // 迴圈時間 t 的姿勢：離地多高、鼻子仰角、壓扁、後腿伸出、喉囊鼓起、眼睛閉上
        static Pose PoseAt(double t)
        {
            double by = 0, rot = 0, sq = 0, leg = 0, throat = 0; bool shut = false;
            double age = Wrap(t - T_LAND, D);
            foreach (var w in THROAT) { double a = w[0], b = w[1]; if (t > a && t < b) throat = Pow(Sin(Math.PI * ((t - a) / (b - a))), 0.7) * (a > 1 ? 0.6 : 1); }
            if (t > 0.88 && t < 0.95) shut = true;
            if (t >= T_CROUCH && t < T_UP)
            {
                double u = Ease.InOutSine(Seg(t, T_CROUCH, T_UP));
                sq = -0.18 * u;
                rot = -0.12 * u;
            }
            else if (t >= T_UP && t < T_LAND)
            {
                double q = (t - T_UP) / (T_LAND - T_UP);
                by = -HOP * 4 * q * (1 - q);
                rot = Lerp(0.42, -0.25, q);
                sq = Lerp(0.18, 0.02, Math.Min(1, q * 2));
                leg = q < 0.75 ? 1 : 1 - (q - 0.75) / 0.25;
            }
            else
            {
                sq = -0.24 * Spring(age, 2.4, 6.5);
                rot = -0.08 * Exp(-age * 6);
            }
            return new Pose { by = by, rot = rot, sq = sq, leg = leg, throat = throat, shut = shut, air = t >= T_UP && t < T_LAND };
        }
        // 蒼蠅：在青蛙上面繞小圈，T_SNAP 被舔走，T_BACK 從旁邊飛回來
        static double[] Fly(double t)
        {
            if (t > T_SNAP && t < T_BACK) return null;
            double a = (t / D) * TAU * 3, h0 = 16 + 6 * Sin(a), h1 = -40 + 3 * Sin(2 * a);
            double inn = Wrap(t - T_BACK, D);
            if (inn < 0.45)
            {
                double u = Ease.OutCubic(inn / 0.45);
                return new[] { Lerp(-52, h0, u), Lerp(-46, h1, u) + Sin(inn * 30) * 1.5 };
            }
            return new[] { h0, h1 };
        }

        static bool InBody(double x, double y) => Pow((x + 1) / 10.5, 2) + Pow((y + 7) / 6, 2) <= 1 || Pow((x - 6) / 6.2, 2) + Pow((y + 8.6) / 4.8, 2) <= 1;
        static bool InEye(double x, double y) => Pow(x - 5.5, 2) + Pow(y + 13.2, 2) <= Pow(3.2, 2);
        static bool Lit(double x, double y, double k) => InBody(-4 + (x + 4) / k, -13 + (y + 13) / k);
        static readonly double[][] SPOTS = { new[] { -5, -10, 1.6 }, new[] { 0, -11.5, 1.3 }, new[] { -8, -7, 1.2 }, new[] { 3, -12.5, 0.9 } };

        static void DrawFrog(Grid g, uint[] C, uint[] Bl, Pose Pz, double t)
        {
            g.Clear();
            double cs = Cos(Pz.rot), sn = Sin(Pz.rot), sx = 1 + Pz.sq * -0.6, sy = 1 + Pz.sq;
            // 身體和頭：上面受光、淡色的肚子、背上的深色斑點
            g.Shade(-15, -22, 15, 1, (double x, double y, ref Grid.GOut o) =>
            {
                // 換到青蛙自己的座標：以身體為中心、跟著轉、跟著壓扁
                double dx = x, dy = y + 7;
                double u = (dx * cs + dy * sn) / sx, v = (-dx * sn + dy * cs) / sy - 7;
                if (!InBody(u, v) && !InEye(u, v)) return 0;
                if (InEye(u, v))
                {
                    double d = Hypot(u - 5.5, v - 13.2 * -1);
                    if (Pz.shut) return v < -13.2 ? C[4] : C[3];
                    if (Math.Abs(v + 13) < 0.7 && Math.Abs(u - 6) < 1.8) return C[0];
                    if (u < 4.7 && v < -14) return EYE[2];
                    return d < 2.4 ? EYE[1] : EYE[0];
                }
                if (v > -5 && u > -6) return v > -3 ? Bl[1] : Bl[2];
                foreach (var s in SPOTS) if (Hypot(u - s[0], v - s[1]) < s[2]) return C[2];
                if (!InBody(u + 2, v + 2.4)) return C[2];
                return Lit(u, v, 0.5) ? C[5] : Lit(u, v, 0.8) ? C[4] : C[3];
            });
            // 後腿：大腿折在屁股旁，跳的時候整條踢直
            var legs = new List<double[][]>();
            if (Pz.leg < 0.5)
            {
                g.Ellipse(-7.5, -4.5 + (1 - sy) * 3, 5, 3.6, (nx, ny) => nx * -0.6 + ny * -0.8 > 0.35 ? C[4] : ny > 0.4 ? C[2] : C[3]);
                legs.Add(new[] { new[] { -4, -1.5 }, new[] { -9, -1.0 }, new[] { -3, -0.5 }, new[] { 4, -0.5 } });
            }
            else
            {
                double ex = -8 - 10 * Pz.leg, ey = 4 + 6 * Pz.leg;
                legs.Add(new[] { new[] { -6, -5.0 }, new[] { -10, 0.0 }, new[] { ex, ey }, new[] { ex - 5, ey + 2 } });
            }
            foreach (var L in legs)
            {
                // 越來越細的管子：粗大腿、細小腿、長腳掌；上緣受光
                g.Tube(L, u => Lerp(2, 0.7, u), (u, v) => v > 0.55 ? C[2] : u > 0.66 ? C[3] : C[4]);
                // 腳掌尾端張開的蹼趾
                double fx = L[L.Length - 1][0], fy = L[L.Length - 1][1], px = L[L.Length - 2][0], py = L[L.Length - 2][1], ddx = fx - px, ddy = fy - py, l = Hypot(ddx, ddy);
                if (l == 0) l = 1;
                foreach (double k in new[] { -1.0, 0, 1 }) g.Line(fx, fy, fx + (ddx / l) * 2 - (ddy / l) * k * 1.6, fy + (ddy / l) * 2 + (ddx / l) * k * 1.6, C[3]);
            }
            // 眼睛的反光、嘴巴那條線
            if (!Pz.shut)
            {
                double gx = 4.6, gy = -14.4, X = gx * cs - (gy + 7) * sn * 1, Y = gx * sn + (gy + 7) * cs - 7;
                g.Set(X, Y, C[6]);
            }
            for (double u = 3; u <= 11; u++)
            {
                double v = -7.8 + (u - 3) * 0.05, X = (u * sx) * cs - ((v + 7) * sy) * sn, Y = (u * sx) * sn + ((v + 7) * sy) * cs - 7;
                g.Set(X, Y, C[1]);
            }
            // 前腿撐著，跳的時候收起來
            double fl1x = Pz.air ? 9 : 8, fl1y = Pz.air ? -1 : -0.5;
            g.Line(7, -4, fl1x, fl1y, C[3]);
            g.Set(fl1x + 1, fl1y, C[3]); g.Set(fl1x - 1, fl1y, C[3]);
            // 下巴下面的喉囊鼓成亮亮的泡泡
            if (Pz.throat > 0.05)
            {
                double r = 0.8 + 2.8 * Pz.throat, cx = 7, cy = -5.2 + r * 0.25;
                g.Ellipse(cx, cy, r * 1.1, r, (nx, ny) => nx * -0.6 + ny * -0.8 > 0.55 ? Bl[2] : ny > 0.5 ? Bl[1] : Col.Mix(Bl[2], C[5], 0.4), 0.9);
                g.Set(cx - r * 0.4, cy - r * 0.45, C[6]);
            }
            g.Outline(C[0]);
        }

        static readonly double[][] DUSTS = { new[] { T_UP, 7, 0.6 }, new[] { T_LAND, 18, 1 } };
        public static void Draw(Painter p, double time, FxOptions o)
        {
            int seed = o.SeedOr0;
            double t = Shift(time, D, seed); uint[] C = Col.Fit(o.Palette, 7), Bl = Col.Fit(o.Ramps["belly"], 3); var Pz = PoseAt(t);
            var g = GRID;
            DrawFrog(g, C, Bl, Pz, t);
            g.Draw(p, 1, 0, Round(Pz.by));
            // 舌頭彈出去舔蒼蠅再收回來
            double ts = (t - T_SNAP + 0.06) / 0.14;
            if (ts > 0 && ts < 1)
            {
                var f0 = Fly(T_SNAP - 0.001); double e = Sin(Math.PI * ts), mx = 11, my = Pz.by - 8;
                double x1 = Lerp(mx, f0[0], e), y1 = Lerp(my, f0[1], e);
                p.Line(mx, my, x1, y1, TONGUE);
                p.Line(mx, my + 1, x1, y1 + 1, Col.Mix(TONGUE, C[0], 0.4));
                p.Circle(x1, y1, 1.4, TONGUE);
            }
            // 嗡嗡飛的蒼蠅
            var f = Fly(t);
            if (f != null)
            {
                bool flap = Sin(t * 90) > 0;
                p.Px(f[0], f[1], FLY); p.Px(f[0] + 1, f[1], FLY);
                p.Dot(f[0], f[1] - (flap ? 1 : 0), WINGS, 0.8); p.Dot(f[0] + 1, f[1] - (flap ? 0 : 1), WINGS, 0.8);
                p.Glow(f[0], f[1], 3, WINGS, 0.15);
            }
            // 起跳和落地時沿地面揚起的灰，還有彈跳的砂粒
            var sw = SWARM.Begin(t);
            foreach (var dd in DUSTS)
            {
                double t0 = dd[0], pow = dd[2]; int n = (int)dd[1];
                double age = Wrap(t - t0, D);
                for (int i = 0; i < n; i++)
                {
                    var r = Rng.Of(seed, i, ToInt32(t0 * 100)); double L = r.Range(0.6, 1.1) * pow;
                    if (age > L) continue;
                    double s = r.Sign(), v = r.Range(24, 70) * pow, x = s * (7 + (v / 3.5) * (1 - Exp(-age * 3.5))), y = -1.5 - r.Range(1, 5) * age;
                    sw.Add(P.SMOKE, x, y, 0, 0, age, L, DUST, r.Range(2.2, 4.2) * (0.65 + 0.35 * pow), 2);
                }
                if (pow == 1)
                    for (int i = 0; i < 8; i++)
                    {
                        var r = Rng.Of(seed, i, 909);
                        double bx = r.Range(-8, 8), bvx = r.Range(-40, 40), bvy = -r.Range(30, 70);
                        var b = Toss(bx, -1, bvx, bvy, age, 700, -0.5);
                        if (age < 0.7) p.Dot(b.x, b.y, i % 2 != 0 ? GRIT_A : GRIT_B, b.landed ? 1.4 - age * 2 : 1);
                    }
            }
            sw.Draw(p);
        }

        public static void DrawBack(Painter p, double time, FxOptions o)
        {
            double t = Shift(time, D, o.SeedOr0); uint[] C = Col.Fit(o.Palette, 7); var Pz = PoseAt(t); double hgt = Clamp(-Pz.by / HOP);
            Shadow(p, 0, -0.2, 13 * (1 - 0.35 * hgt), 1.6, C[0], 0.6 - 0.3 * hgt);
        }
    }
}
