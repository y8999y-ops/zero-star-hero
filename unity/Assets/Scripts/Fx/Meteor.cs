// 網頁版 pixelfx/src/fx/fire/meteor.js 一行一行翻成 C#（模擬特效），加上 game/fx/fire/star-meteor.js（同一顆流星的「不冒煙」版）。
// 一顆燒著的石頭從左上方拖著火焰彗尾衝下來，砸在地上：白閃、火球、石塊和火把噴飛、發光的坑慢慢冷掉。
//   Meteor.Def：pixelfx 原版（開場 C 幕撞進洞窟那顆）
//   Meteor.StarDef：star-meteor.js，多一個 clean 選項（Num["clean"] = 1）：火不會冷成煙、撞地不噴煙（開場 B 幕遠方那顆）
// 也在這裡翻了 core sim.js 的 Blazes（落地還在燒的小火堆）。亂數取用的順序跟網頁版一模一樣。
using System;
using System.Collections.Generic;
using static PixelFX.Pf;
using static PixelFX.Fx.FireLib;

namespace PixelFX.Fx
{
    /// 落在地上還在燒的小火：每隻一直冒小火團（畫在後面），偶爾一顆餘燼（core sim.js 的 Blazes）
    public class Blazes
    {
        class Bz { public double x, y, life, max, acc, power; }
        readonly Particles ps; readonly List<Bz> list = new List<Bz>();
        public Blazes(Particles ps) { this.ps = ps; }
        public void Add(double x, double y, double life, double power) => list.Add(new Bz { x = x, y = y, life = life, max = life, acc = ps.R.Next(), power = power });
        public int Count => list.Count;
        public void Update(double dt)
        {
            var R = ps.R;
            for (int i = list.Count - 1; i >= 0; i--)
            {
                var b = list[i];
                if ((b.life -= dt) <= 0) { list.RemoveAt(i); continue; }
                double k = b.life / b.max, intensity = b.power * (k > 0.7 ? 1 : 0.35 + (k / 0.7) * 0.65);
                for (b.acc += dt * (6 + 16 * intensity); b.acc > 1; b.acc--)
                {
                    double s = R.Range(1.2, 2.8) * intensity;
                    // 參數照 JS 由左到右取亂數
                    double x = b.x + R.Range(-1.5, 1.5), y = b.y - s * 0.6, vx = R.Range(-6, 6), vy = R.Range(-30, -12), life = R.Range(0.28, 0.6);
                    ps.Spawn(P.FIRE, x, y, vx, vy, life, 0, s, 0, PFlag.BACK | (R.Chance(0.3) ? PFlag.SMOKES : 0));
                    if (R.Chance(0.06)) { double ex = R.Range(-15, 15), ey = R.Range(-45, -15), el = R.Range(0.6, 1.4); ps.Spawn(P.EMBER, b.x, b.y - 1.5, ex, ey, el, Sim.HOT[2], 1, 0, PFlag.BACK); }
                }
            }
        }
        public void DrawBack(Painter p)
        {
            foreach (var b in list)
            {
                double k = b.life / b.max;
                p.Px(b.x, b.y, k > 0.4 ? (Sin(b.life * 31 + b.x) > 0 ? Sim.HOT[1] : Sim.HOT[2]) : Sim.HOT[3]);
                p.Glow(b.x, b.y, 6 + 5 * k * b.power, Sim.HOT[2], 0.3 * k * b.power);
            }
        }
    }

    public static class Meteor
    {
        static FxDef Make(bool star) => new FxDef
        {
            Name = "Meteor", W = 272, H = 232, OX = 150, OY = 208, Duration = 5, Loop = false, Fps = 30,
            Options = new FxOptions
            {
                Palette = new[] { "#4a1712", "#8a1f17", "#c9281f", "#f2561d", "#ff8a2a", "#ffc23d", "#ffe26b", "#fff3a6", "#ffffff" },
                Seed = 9,
            }.Set("stone", "#4a3f69").Set("rock", new[] { "#120e16", "#2a2230", "#463a4a", "#6a5a66" }),
            Create = o => Create(o, star),
        };
        public static readonly FxDef Def = Make(false);
        public static readonly FxDef StarDef = Make(true);

        const double HIT = 0.62, DURATION = 5;
        static readonly double[] FROM = { -112, -142 };
        static readonly uint SOOT = Col.Hex("#0d0a12"), SOOT2 = Col.Hex("#17121d"), OUTLINE = Col.Hex("#1a1422"), WARM = Col.Rgb(255, 176, 96);

        class Stone { public uint light, body, shade, dust; }
        static Stone StoneOf(uint c) => new Stone { light = Col.Mix(Col.Scale(c, 1.35), Col.WHITE, 0.08), body = c, shade = Col.Scale(c, 0.64), dust = Col.Mix(Col.Scale(c, 1.2), Col.Rgb(150, 140, 150), 0.3) };
        // 飛出去的石塊：有亮面、暗面、外框的小圓石，快沒時淡掉
        static void Rock(Painter p, Bit b, Stone st)
        {
            double r = 0.6 + b.s * 0.75, fade = Math.Min(1, b.life / 0.5), lx = Cos(b.a) * r * 0.4, ly = Sin(b.a) * r * 0.4;
            p.Shade(b.x - r - 1, b.y - r - 1, b.x + r + 1, b.y + r + 1, (double x, double y, ref Painter.Out o) =>
            {
                double dx = x - b.x, dy = y - b.y, d = Hypot(dx * 1.15, dy);
                if (d > r + 0.9) return;
                double lit = dx * lx + dy * ly;
                o.c = d > r ? OUTLINE : lit < -0.4 ? st.light : lit > 0.6 ? st.shade : st.body;
                o.a = fade;
            });
        }
        // 貼地的光（fire/_lib.js 的 floorLight）：只加光，不畫顏色
        static void FloorLight(Painter p, double x, double y, double rx, double ry, uint c, double k)
        {
            if (k <= 0.004 || rx < 1 || ry < 0.5) return;
            p.Shade(x - rx, y - ry, x + rx, y + ry, (double px, double py, ref Painter.Out o) =>
            {
                double dx = (px - x) / rx, dy = (py - y) / ry, d = dx * dx + dy * dy;
                if (d >= 1) return;
                double f = 1 - Math.Sqrt(d);
                o.l = c;
                o.k = f * f * k;
            });
        }
        // 粒子系統照熱色階 H 畫火團（fire/_lib.js 的 simDraw）：煙和後面的粒子 → 火團 → 火星和其他的
        static void SimDraw(Painter p, Particles ps, uint[] H, string layer)
        {
            var all = ps.List; var rest = new List<Particle>(); var fire = new List<Particle>();
            foreach (var q in all) (q.k == P.FIRE ? fire : rest).Add(q);
            Action<bool> puffs = back =>
            {
                foreach (var q in fire) if (q.delay <= 0 && ((q.flag & PFlag.BACK) != 0) == back) FirePuff(p, q.x, q.y, q.life / q.max, q.size, q.seed % 1, H);
            };
            ps.List = rest;
            if (layer != "front") { ps.Draw(p, "back"); puffs(true); }
            if (layer != "back") { puffs(false); ps.Draw(p, "front"); }
            ps.List = all;
        }

        static FxImpl Create(FxOptions o, bool star)
        {
            uint WHITE = Col.WHITE;
            bool clean = star && o.Num.TryGetValue("clean", out double cl) && cl != 0;
            int SMK = clean ? PFlag.BIG : PFlag.SMOKES | PFlag.BIG;   // 遊戲改：clean＝不冒煙
            uint[] F = Col.Fit(o.Palette, 9), H = HotFirst(F), RK = Col.Fit(o.Ramps["rock"], 4); var st = StoneOf(Col.Hex(o.Str["stone"]));
            var R = new Rng((uint)o.SeedOr0); Func<double, double> floor = x => 0; int S = o.SeedOr0 * 11;
            Blazes blazes = null;
            var ps = new Particles(R, sparks: new[] { H[1], H[2], H[4], H[5] }, ground: floor);
            ps.OnLand = (x, y) => { double life = R.Range(0.9, 1.6), power = R.Range(0.5, 0.85); blazes.Add(x, y - 0.25, life, power); };
            blazes = new Blazes(ps);
            var bits = new Bits(floor); var lights = new Lights(); uint GLOW = Col.Mix(Col.Mix(H[3], H[4], 0.5), WHITE, 0.25);
            var dusted = new HashSet<Bit>();
            double len = Hypot(FROM[0], FROM[1]), ux = -FROM[0] / len, uy = -FROM[1] / len;
            // 飛行：越掉越快一點
            Func<double, (double x, double y)> pos = tt =>
            {
                double k = Ease.InQuad(Clamp(tt / HIT)) * 0.35 + Clamp(tt / HIT) * 0.65;
                return (FROM[0] * (1 - k), FROM[1] * (1 - k));
            };
            double t = 0; bool hit = false; var last = pos(0);

            // 流星本體：凹凸的石頭，前面白熱、背面暗、裂縫發光、外框
            Action<Painter, double, double, double, double, double> meteor = (p, x, y, R0, cool, alpha) =>
            {
                p.Shade(x - R0 - 2, y - R0 - 2, x + R0 + 2, y + R0 + 2, (double px, double py, ref Painter.Out ot) =>
                {
                    ot.a = alpha;
                    double dx = px - x, dy = py - y, d = Hypot(dx, dy), a = Atan2(dy, dx), rr = R0 * (1 + 0.18 * Noise(a * 2.2 + 3, S) + 0.1 * Noise(a * 5, S + 1));
                    if (d > rr + 1) return;
                    if (d > rr) { ot.c = OUTLINE; return; }
                    double face = (dx * ux + dy * uy) / Math.Max(1, d), heat = (1 - cool) * (face * 0.6 + 0.5 - (d / rr) * 0.25);
                    if (heat > 0.62) { ot.c = heat > 0.85 ? H[0] : heat > 0.74 ? H[1] : H[2]; return; }
                    if (heat > 0.42) { ot.c = H[4]; return; }
                    double h = Rand(ToInt32(Math.Floor(px - x)), ToInt32(Math.Floor(py - y)), S + 3);
                    if (h < 0.22 * (1 - cool * 0.7)) { ot.c = (1 - cool) > 0.5 ? H[4] : H[6]; return; }
                    ot.c = dx * -0.6 + dy * -0.8 > 0 ? RK[2] : d / rr > 0.6 ? RK[0] : RK[1];
                });
            };
            // 坑：凹進去的熱石慢慢冷成黑灰，邊緣翻起碎地面
            Action<Painter> crater = p =>
            {
                if (t < HIT) return;
                double a = t - HIT, end = 1 - Smooth(DURATION - 1, DURATION - 0.15, t), rx = 36 * Math.Min(1, a / 0.08), ry = 6;
                for (int y = -1; y <= 3; y++)
                    for (int x = (int)Math.Floor(-rx); x <= (int)Math.Ceiling(rx); x++)
                    {
                        double dx = (x + 0.5) / rx, dy = (y + 0.5) / ry, d = Math.Sqrt(dx * dx + dy * dy);
                        if (d > 1) continue;
                        double k = Rand(x * 31 + y, S + 5), T = Pow(Clamp(1 - a / 2.6), 1.3) * (1.25 - d) - k * 0.35;
                        if (T > 0.06)
                        {
                            uint c = H[Math.Min(8, (int)Math.Floor((1 - Math.Min(1, T)) * 8))];
                            p.Dot(x, y, c, end);
                            if ((x & 3) == 0) p.Glow(x + 0.5, y, 7, c, 0.2 * T * end);
                        }
                        else p.Dot(x, y, d < 0.55 ? SOOT : SOOT2, (d < 0.95 - k * 0.3 ? 1 : 1 - d) * end);
                    }
                // 坑邊：碎掉的地面堆在邊上，被裡面的光照亮
                for (int x = -40; x <= 40; x++)
                {
                    double e = Math.Abs(x) / 40.0; int hh = e < 0.7 ? 0 : (int)Round(2.4 * Sin(((e - 0.7) / 0.3) * Math.PI) * (0.6 + 0.4 * Rand(x, S + 7)));
                    for (int j = 0; j < hh; j++) p.Dot(x, -1 - j, j == hh - 1 ? Col.Mix(st.light, H[4], 0.5 * Clamp(1 - a / 2)) : st.shade, end);
                    if (hh != 0) p.Dot(x, 0, OUTLINE, end);
                }
            };
            uint[] bandR = { st.body, st.light, H[4], H[1] };

            return new FxImpl
            {
                Update = (dt, _) =>
                {
                    t += dt;
                    if (t < HIT)
                    {
                        // 飛行：後面甩出一條火、煙、火星、餘燼
                        var (x, y) = pos(t); double vx = (x - last.x) / dt, vy = (y - last.y) / dt;
                        last = (x, y);
                        for (int i = 0; i < 3; i++)
                        {
                            if (!R.Chance(0.8 * dt * 60)) continue;
                            double a1 = x - ux * R.Range(2, 8) + R.Range(-3, 3), a2 = y - uy * R.Range(2, 8) + R.Range(-3, 3), a3 = vx * 0.15 + R.Range(-20, 20), a4 = vy * 0.15 + R.Range(-30, 10), a5 = R.Range(0.3, 0.6), a6 = R.Range(3, 6);
                            ps.Spawn(P.FIRE, a1, a2, a3, a4, a5, 0, a6, 0, R.Chance(0.65) ? SMK : 0);
                        }
                        if (R.Chance(0.6 * dt * 60)) { double a1 = vx * 0.35 + R.Range(-80, 80), a2 = vy * 0.35 + R.Range(-80, 40), a3 = R.Range(0.2, 0.5); ps.Spawn(P.SPARK, x, y, a1, a2, a3); }
                        if (R.Chance(0.3 * dt * 60)) { double a1 = vx * 0.1 + R.Range(-30, 30), a2 = vy * 0.1 + R.Range(-40, 0), a3 = R.Range(0.8, 1.6); ps.Spawn(P.EMBER, x, y, a1, a2, a3, H[3], R.Chance(0.2) ? 2 : 1); }
                    }
                    else if (!hit)
                    {
                        hit = true;
                        // 撞擊：閃光、往前上方甩的火球、一根火柱、煙、火星
                        lights.Add(0, -40, 100, WARM, 0.95, 0.9);
                        lights.Add(0, -20, 46, WHITE, 0.9, 0.12);
                        for (int i = 0; i < 34; i++)
                        {
                            double a = -Math.PI / 2 + R.Range(-1.3, 1.3) + 0.25, sp = R.Range(50, 210);
                            double a1 = R.Range(-6, 6), a2 = -R.Range(2, 10), a5 = R.Range(0.5, 1.1), a6 = R.Range(5, 9);
                            ps.Spawn(P.FIRE, a1, a2, Cos(a) * sp, Sin(a) * sp * 0.75 - 30, a5, 0, a6, 0, R.Chance(0.5) ? SMK : 0);
                        }
                        for (int i = 0; i < 9; i++) { double a1 = R.Range(-6, 6), a3 = R.Range(-14, 14), a4 = -R.Range(130, 220), a5 = R.Range(0.8, 1.2), a6 = R.Range(6, 8.5), a7 = R.Range(0, 0.12); ps.Spawn(P.FIRE, a1, -6, a3, a4, a5, 0, a6, a7, SMK); }
                        for (int i = 0; i < 20; i++)
                        {
                            double a = R.Range(-Math.PI, 0), d = R.Range(4, 18);
                            if (!clean) { double a2 = -R.Range(6, 24), a3 = Cos(a) * R.Range(10, 40), a4 = -R.Range(30, 110), a5 = R.Range(1.8, 2.8), a6 = R.Range(8, 12), a7 = R.Range(0.15, 0.5); ps.Spawn(P.SMOKE, Cos(a) * d, a2, a3, a4, a5, 0, a6, a7, PFlag.BIG); }
                        }
                        for (int i = 0; i < 16; i++)
                        {
                            int s = R.Sign();
                            if (!clean) { double a1 = s * R.Range(4, 18), a2 = -R.Range(1, 5), a3 = s * R.Range(60, 130) + 10, a4 = -R.Range(2, 12), a5 = R.Range(1.2, 2.0), a6 = R.Range(5, 8), a7 = R.Range(0, 0.06); ps.Spawn(P.SMOKE, a1, a2, a3, a4, a5, st.dust, a6, a7, PFlag.BIG); }
                        }
                        for (int i = 0; i < 90; i++)
                        {
                            double a = -Math.PI / 2 + R.Range(-1.3, 1.3) + 0.15, sp = R.Range(100, 300);
                            ps.Spawn(P.SPARK, 0, -4, Cos(a) * sp, Sin(a) * sp, R.Range(0.2, 0.7));
                        }
                        for (int i = 0; i < 36; i++)
                        {
                            double a = R.Range(0, TAU), sp = R.Range(40, 150);
                            ps.Spawn(P.EMBER, Cos(a) * 8, -8 + Sin(a) * 6, Cos(a) * sp, Sin(a) * sp - 70, R.Range(1.2, 2.6), H[3]);
                        }
                        for (int i = 0; i < 10; i++)
                        {
                            double a = -Math.PI / 2 + R.Range(-1, 1.05), sp = R.Range(130, 240);
                            ps.Spawn(P.BRAND, 0, -6, Cos(a) * sp, Sin(a) * sp, R.Range(0.7, 1.3));
                        }
                        uint[] ramp = { OUTLINE, st.shade, st.body, st.light, Col.Mix(st.light, WHITE, 0.3) };
                        for (int i = 0; i < 28; i++)
                            bits.Add(new Bit { kind = BKind.CHUNK, x = R.Range(-8, 8), y = -3, vx = R.Range(-80, 110), vy = -R.Range(140, 340), g = 1, drag = 0.4, bounce = 0.3, life = R.Range(1.8, 2.8), a = R.Range(0, TAU), va = R.Range(-16, 16), s = R.Int(1, 3), ramp = ramp });
                        for (int i = 0; i < 80; i++)
                        {
                            double u = R.Range(-1, 1), a = -Math.PI / 2 + u * 0.7 + 0.15, sp = R.Range(90, 270) * (1 - 0.4 * Math.Abs(u));
                            double a5 = R.Range(1.2, 2.2); uint c = R.Pick(new[] { st.light, st.body, st.body, st.shade });
                            ps.Spawn(P.GRIT, u * 6, -1, Cos(a) * sp, Sin(a) * sp, a5, c, R.Chance(0.45) ? 2 : 1);
                        }
                    }
                    bits.Update(dt);
                    foreach (var b in bits.List)
                        if (b.rest && !dusted.Contains(b))
                        {
                            dusted.Add(b);
                            for (int i = 0; i < 3; i++) { double a1 = b.x + R.Range(-1.5, 1.5), a3 = R.Sign() * R.Range(8, 35), a4 = -R.Range(2, 18), a5 = R.Range(0.3, 0.6), a6 = R.Range(1.3, 2.6); ps.Spawn(P.DUST, a1, -0.5, a3, a4, a5, st.dust, a6); }
                        }
                    blazes.Update(dt);
                    ps.Update(dt);
                    lights.Update(dt);
                },
                DrawBack = (p, _, __) =>
                {
                    crater(p);
                    SimDraw(p, ps, H, "back");
                    blazes.DrawBack(p);
                    double k = (t - HIT) / 0.5;
                    if (k > 0 && k < 1) Sim.Band(p, 0, 0.5, 110 * Ease.OutCubic(k), 0.16, Math.Max(1, 5 * (1 - k)), 1.15 - k, bandR, g => Sin(g) < 0);
                },
                Draw = (p, _, __) =>
                {
                    double k = (t - HIT) / 0.5;
                    if (k > 0 && k < 1) Sim.Band(p, 0, 0.5, 110 * Ease.OutCubic(k), 0.16, Math.Max(1, 5 * (1 - k)), 1.15 - k, bandR, g => Sin(g) >= 0, k < 0.12);
                    foreach (var b in bits.List) Rock(p, b, st);
                    if (t < HIT)
                    {
                        // 彗星：火舌從石頭往後甩、石頭、它的光；下面的地被照亮
                        var (x, y) = pos(t); double tt = t;
                        FrameNoiseFn NZ = (rate, seed, off) => Noise(tt * rate + off, seed);
                        FloorLight(p, 0, 0.5, 30 + 40 * (t / HIT), 7, GLOW, 0.5 * Pow(t / HIT, 2));
                        double[][] tongues = { new[] { 36, 7, 0.0 }, new[] { 26, 7.5, -2.5 }, new[] { 26, 7.5, 2.5 }, new[] { 16, 8, 0.0 } };
                        for (int i = 0; i < tongues.Length; i++)
                        {
                            double L = tongues[i][0], w = tongues[i][1], off = tongues[i][2]; int n = (S + i) * 13;
                            FlameBlade(p, x - uy * off, y + ux * off, -ux, -uy, L * (0.85 + 0.25 * NZ(5, n)), w, NZ(3, n + 3) * 3, NZ, n, H, LAYERS, 0.5, 1.6);
                        }
                        meteor(p, x, y, 6.5, 0, 1);
                        p.Glow(x, y, 46, GLOW, 0.55);
                        p.Glow(x, y, 12, H[1], 0.4);
                    }
                    else
                    {
                        // 流星的核心半埋在坑裡，慢慢冷掉
                        double a = t - HIT, cool = Clamp(a / 2.8), end = 1 - Smooth(DURATION - 1.1, DURATION - 0.2, t);
                        if (end > 0)
                        {
                            meteor(p, 0, 0, 5.5, cool, end);
                            p.Glow(0, -2, 22, GLOW, 0.4 * (1 - cool) * end);
                        }
                    }
                    SimDraw(p, ps, H, "front");
                    // 撞到的那一格：白熱的閃光和一圈光芒
                    double f = (t - HIT) / 0.08;
                    if (f > 0 && f < 1)
                    {
                        p.Circle(0, -6, 11 * (1 - f * 0.3) + 1.5, H[3]);
                        p.Circle(0, -6, 11 * (1 - f * 0.3), f < 0.5 ? H[1] : H[2]);
                        p.Circle(0, -6, 7 * (1 - f * 0.3), f < 0.5 ? WHITE : H[1]);
                    }
                    double fr = (t - HIT) / 0.24;
                    if (fr > 0 && fr < 1) Sim.Flare(p, 0, -6, 44 * Pow(1 - fr, 1.4), 1 - fr, new[] { H[6], H[4], H[2], H[1] });
                    lights.Draw(p);
                },
            };
        }
    }
}
