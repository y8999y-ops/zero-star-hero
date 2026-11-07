// game/src/ult-forms.js 一行一行翻成 C#：黏液星、鐵罐星、蝠翼星、尖刺星的大招（星星的在 Ult.cs）。
//   黏液星「黏黏大海嘯」：背後湧起黏液浪，主角站上浪頭往前衝，把怪一路推著走，最後拍下來。
//   鐵罐星「廢鐵豪雨」：垃圾噴上天、整個畫面下垃圾雨（落點先有影子），最後帶電大油桶砸下來，閃電連鎖。
//   蝠翼星「月下夜襲」：天色轉深、大月亮升起，在附近的怪之間來回突擊、每隻抓三下，最後毒爆、吸血回復。
//   尖刺星「千針風暴」：縮成刺球升到半空連發尖針，砸回地面，一道尖刺往兩邊冒出來。
// 還有 boss.js 的 drawJunk（垃圾小圖）放在最下面的 Junk。
// 運算順序、Math.random（Rnd.Next）的呼叫順序都照原本；Set 的走訪順序（加入的順序）用 List 保留。
using System;
using System.Collections.Generic;
using System.Linq;
using PixelFX;

namespace ZeroStar
{
    public static class UltForms
    {
        /// 這個形態的大招（每次新建一個）；星星或不認得的形態回傳 null。
        public static UltMod For(string form)
        {
            switch (form)
            {
                case "slime": return new SlimeUlt();
                case "can": return new CanUlt();
                case "bat": return new BatUlt();
                case "spike": return new SpikeUlt();
                default: return null;
            }
        }

        // ---- 共用的小工具（ult-forms.js 最上面）
        public static double Clamp01(double v) => v < 0 ? 0 : v > 1 ? 1 : v;
        public static double OutCubic(double p) => 1 - Pf.Pow(1 - p, 3);
        public static int[] Rgb(string s) => UltPainter.Rgb(s);
        public static int[][] Ramp(params string[] a) => a.Select(Rgb).ToArray();
        public static double Rnd(double i, double k) { double s = Pf.Sin(i * 127.1 + k * 311.7) * 43758.5453; return s - Math.Floor(s); }
        static readonly int[] BAYER = { 0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5 };
        public static bool Dith(double x, double y, double a) => a * 16 > BAYER[((Pf.ToInt32(Pf.Round(y)) & 3) << 2) | (Pf.ToInt32(Pf.Round(x)) & 3)];
    }

    /// 照加入順序走訪的集合（JS 的 Set）
    class OrderedSet<T>
    {
        public readonly List<T> List = new List<T>();
        readonly HashSet<T> set = new HashSet<T>();
        public bool Has(T v) => set.Contains(v);
        public void Add(T v) { if (set.Add(v)) List.Add(v); }
    }

    // =====================================================================================
    // 黏液星「黏黏大海嘯」
    // =====================================================================================
    public class SlimeUlt : UltMod
    {
        static readonly int[][] GOO = UltForms.Ramp("#0c2010", "#1a4a20", "#2a8a3a", "#4cc04a", "#8ee86a", "#d4ffb0", "#ffffff");
        static readonly int[] GOO_LIGHT = UltForms.Rgb("#8ee86a");
        const double RISE = 0.5, CUT0 = 0.45, CUT1 = 0.9, GO = 0.95, CRASH = 2.05, END = 2.7, HH = 96, SPEED = 300, BODY = 150;
        public override string Name => "黏黏大海嘯";
        public override double Dur => END;
        public override double Cut0 => CUT0;
        public override double Cut1 => CUT1;

        class Bubble { public double dx, d, sp, r; }
        class Drop { public double x, y, vx, vy, life; }
        double side, x0, y0, fy, front, h; bool crashed, stopped;
        readonly HashSet<Enemy> hit = new HashSet<Enemy>(), hit2 = new HashSet<Enemy>();
        List<Drop> drops = new List<Drop>();
        Bubble[] bubbles;

        void SetFy(Ult U, double v) { fy = v; U.Fy = v; U.HasFy = true; }

        public override void Start(Ult U, Player player, UltKit kit, UltHooks H)
        {
            side = player.Face; x0 = player.X; y0 = player.Y;
            SetFy(U, kit.FloorAt(player.X, player.Y - 8));
            front = kit.SolidAt(player.X - side * 26, fy - 10) ? player.X : player.X - side * 26;   // 背後是牆的話從腳下出發
            h = 0; crashed = false; stopped = false;
            bubbles = new Bubble[22];
            for (int i = 0; i < 22; i++) bubbles[i] = new Bubble { dx = (UltForms.Rnd(i, 1) - 0.5) * 44, d = UltForms.Rnd(i, 2) * 0.45, sp = 40 + UltForms.Rnd(i, 3) * 50, r = 1 + Math.Floor(UltForms.Rnd(i, 4) * 2.5) };
        }

        public override void Update(Ult U, double dt, Player player, UltKit kit, UltHooks H)
        {
            double t = U.T;
            if (t < RISE) { player.UltPose("charge", dt); return; }
            if (t < GO)
            {   // 浪在背後湧起來
                h = HH * UltForms.OutCubic(UltForms.Clamp01((t - RISE) / (GO - RISE)));
                player.UltPose("rise", dt);
                return;
            }
            if (t < CRASH)
            {   // 往前衝
                if (!stopped)
                {
                    double nx = front + side * SPEED * dt, l = kit.BoundL, r = kit.BoundR;
                    if (nx < l || nx > r || kit.SolidAt(nx + side * 6, fy - 60)) stopped = true;   // 撞到高牆（60 以上）才停，矮台階爬過去
                    else
                    {
                        front = nx;
                        double f = kit.FloorAt(front, fy - 40);
                        if (Math.Abs(f - fy) < 48) SetFy(U, fy + (f - fy) * Math.Min(1, dt * 10));   // 沿著地面高低走
                    }
                }
                // 主角站在浪頭上
                player.X = front - side * 22; player.Y = fy - h * 0.92 + Pf.Sin(t * 18) * 1.5;
                player.Face = side; player.UltPose("throw", dt);
                foreach (var e in H.Enemies())
                {
                    if (Math.Abs(e.Y - fy) > 110) continue;
                    double d = side * (front - e.X);   // 浪頭已經過去多遠（> 0＝在浪裡）
                    if (d >= -6 && d < BODY)
                    {
                        if (!hit.Contains(e)) { hit.Add(e); H.Hit(e, 7, side, new HitOpts { Launch = true, Push = 5, Elem = "slime" }); kit.Sfx("squish"); }
                        if (!e.IsBoss) { e.Xp += side * SPEED * dt * 0.85; e.Vx = side * 60; }   // 被浪推著走
                    }
                }
                if (Math.Floor(t * 30) % 3 == 0)
                {
                    var dr = new Drop { x = front + side * 4, y = fy - h * 0.7 };
                    dr.vx = side * (60 + Rnd.Next() * 90); dr.vy = -120 - Rnd.Next() * 100; dr.life = 0.5;
                    drops.Add(dr);
                }
                return;
            }
            // 拍下來
            if (!crashed)
            {
                crashed = true;
                kit.Shake(0.5, 4); kit.HitStop(0.08); kit.Sfx("splash");
                kit.Flash(front, fy - 30, 160, 3, 0.6, "#8ee86a");
                for (int i = 0; i < 36; i++)
                {
                    double a = -Math.PI / 2 + (UltForms.Rnd(i, 9) - 0.5) * 2.6 + side * 0.4;
                    drops.Add(new Drop { x = front, y = fy - h * 0.6, vx = Pf.Cos(a) * (90 + UltForms.Rnd(i, 10) * 160), vy = Pf.Sin(a) * (150 + UltForms.Rnd(i, 11) * 140), life = 0.5 + UltForms.Rnd(i, 12) * 0.4 });
                }
                foreach (var e in H.Enemies()) if (Math.Abs(e.X - front) < 80 && Math.Abs(e.Y - fy) < 90 && !hit2.Contains(e)) { hit2.Add(e); H.Hit(e, 3.5, side, new HitOpts { Launch = true, Push = 4, Elem = "slime" }); }
                double span = front - x0;
                for (int k2 = 0; k2 < 4; k2++) { double x = x0 + span * (0.2 + k2 * 0.27); H.Puddle(x, kit.FloorAt(x, fy - 40)); }
                H.Dust(front, fy);
            }
            double k = UltForms.Clamp01((t - CRASH) / 0.35);
            h = HH * Pf.Pow(1 - k, 2);   // JS：SL.H * (1 - k) ** 2
            double fx = front - side * 10, fyy = kit.FloorAt(fx, fy - 50);
            if (Math.Abs(fyy - fy) > 56 || kit.SolidAt(fx, fyy - 6)) fyy = fy;   // 找不到合理的地面就站在浪的高度
            player.X = fx; player.Y = fy - h * 0.92 + (fyy - fy) * k;
            player.UltPose(t < CRASH + 0.3 ? "throw" : "finish", dt);
        }

        public override void Tick(Ult U, double dt)
        {
            foreach (var d in drops) { d.vy += 600 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.life -= dt; }
            drops = drops.Where(d => d.life > 0 && d.y < fy + 2).ToList();
        }

        public override double Dim(Ult U) { double t = U.T; return t < 0.25 ? t / 0.25 : t < GO ? 1 : 1 - UltForms.Clamp01((t - GO) / 0.5) * 0.6; }
        public override void Lights(Ult U, List<LightSrc> list, UltHooks H) { if (h > 4) list.Add(new LightSrc(front - side * 20, fy - h * 0.8, 80, 1.6, "#8ee86a")); }

        public override void Draw(UltPainter P, Ult U, UltKit kit, UltHooks H)
        {
            double t = U.T;
            // 起：腳下冒泡、地上一圈黏液
            if (t < GO + 0.2) foreach (var b in bubbles)
                {
                    double p = (t - b.d) / 0.5; if (p < 0 || p >= 1) continue;
                    double x = x0 + b.dx, y = fy - 2 - b.sp * p;
                    for (double dy = -b.r; dy <= b.r; dy++) for (double dx = -b.r; dx <= b.r; dx++) { double d = Pf.Hypot(dx, dy); if (d > b.r + 0.3) continue; P.Blend(x + dx, y + dy, d > b.r - 0.6 ? GOO[4] : dx + dy < 0 ? GOO[5] : GOO[3], 1 - p * 0.5); }
                }
            if (t < GO) { double w = Pf.Round(30 * UltForms.Clamp01(t / 0.4)); for (double dx = -w; dx <= w; dx++) { P.Blend(x0 + dx, fy - 1, GOO[3], 0.9); if (Math.Abs(dx) < w - 3) P.Blend(x0 + dx, fy - 2, GOO[4], 0.7); } }
            // 浪身：圓滑的駝峰，浪頭往前捲成一道粗弧
            if (h > 1)
            {
                double L = t < GO ? 60 : BODY, Hh = h; const double peak = 16;
                for (int d = -2; d < L; d++)
                {
                    double x = front - side * d;
                    double prof = d < peak ? 0.62 + 0.38 * Pf.Sin((Math.Max(0, d) / peak) * Math.PI / 2) : Pf.Pow(Pf.Cos(((d - peak) / (L - peak)) * Math.PI / 2), 0.9);
                    double hgt = Pf.Round(Hh * prof + Pf.Sin(d * 0.3 - t * 8) * 1.5 * (d > peak ? 1 : 0));
                    double tail = d > L * 0.65 ? 1 - (d - L * 0.65) / (L * 0.35) : 1;
                    for (int yy = 0; yy < hgt; yy++)
                    {
                        double y = fy - 1 - yy, fromTop = hgt - yy;
                        if (tail < 1 && !UltForms.Dith(x, y, tail)) continue;
                        // 兩條沿著浪頂的斷續亮帶（水面的波紋），前緣暗一階
                        bool band = (fromTop == 11 || fromTop == 21) && UltForms.Rnd(Math.Floor((d + t * 30) / 5), fromTop) < 0.6;
                        var c = fromTop <= 1 ? GOO[6] : fromTop <= 3 ? GOO[5] : fromTop <= 6 ? GOO[4] : band ? GOO[4] : yy < 5 ? GOO[1] : d < 3 ? GOO[1] : GOO[2];
                        if (Math.Floor((yy + t * 60 + d * 7) % 23) == 0 && d % 9 == 3) c = GOO[5];   // 泡泡
                        P.Blend(x, y, c, fromTop <= 6 ? 1 : 0.9);
                        if (fromTop <= 4) P.Glow(x, y, GOO_LIGHT, 0.25);
                    }
                }
                // 捲浪：從最高點出發往前、往下捲的實心粗弧
                double R = Hh * 0.32, cx = front - side * peak, cy = fy - Hh + R, steps = Math.Ceiling(R * 5);
                for (int k = 0; k <= steps; k++)
                {
                    double ang = -Math.PI / 2 + (k / steps) * Math.PI * 0.85, th = Math.Max(2, Pf.Round(7 * (1 - k / (steps * 1.2))));
                    for (int w = 0; w < th; w++)
                    {
                        double r = R - w, x = cx + side * Pf.Cos(ang) * r, y = cy + Pf.Sin(ang) * r;
                        P.Blend(x, y, w == 0 ? GOO[6] : w == 1 ? GOO[5] : GOO[4], 1); if (w < 2) P.Glow(x, y, GOO_LIGHT, 0.35);
                    }
                }
                // 浪頭噴出去的泡沫
                for (int k = 0; k < 6; k++) { double a = UltForms.Rnd(k, Math.Floor(t * 15)), x = cx + side * (R + 1 + a * 6), y = cy - R * 0.2 + (UltForms.Rnd(k + 9, Math.Floor(t * 15)) - 0.5) * 10; P.Blend(x, y, GOO[6], 0.9); }
            }
            // 拍下來：往上噴的水柱＋地面一圈白色衝擊線
            if (crashed)
            {
                double age = t - CRASH;
                if (age < 0.45)
                {
                    double hgt = Pf.Round(70 * Pf.Sin(Math.Min(1, age / 0.45) * Math.PI)), w = 8 + Pf.Round(age * 30);
                    for (int yy = 0; yy < hgt; yy++) for (double dx = -w; dx <= w; dx++)
                        {
                            double e = 1 - Math.Abs(dx) / (w + 1), top = hgt * (0.5 + 0.5 * e);
                            if (yy > top || !UltForms.Dith(front + dx, fy - yy, e * (1 - age / 0.45) + 0.2)) continue;
                            P.Blend(front + dx, fy - 1 - yy, yy > top - 3 ? GOO[6] : e > 0.6 ? GOO[5] : GOO[4], 0.95); P.Glow(front + dx, fy - 1 - yy, GOO_LIGHT, 0.3);
                        }
                    double ring = Pf.Round(age * 260);
                    foreach (int sgn in new[] { -1, 1 }) for (int k = 0; k < 10; k++) P.Blend(front + sgn * (ring - k), fy - 1, k < 3 ? GOO[6] : GOO[4], 1 - k / 10.0);
                }
            }
            // 水花（水珠 2×2）
            foreach (var d in drops) { bool big = d.life > 0.35; P.Blend(d.x, d.y, big ? GOO[6] : GOO[5], 1); P.Blend(d.x + 1, d.y, GOO[4], 0.9); if (big) { P.Blend(d.x, d.y + 1, GOO[4], 0.9); P.Blend(d.x + 1, d.y + 1, GOO[3], 0.9); } P.Glow(d.x, d.y, GOO_LIGHT, 0.3); }
        }
    }

    // =====================================================================================
    // 鐵罐星「廢鐵豪雨」
    // =====================================================================================
    public class CanUlt : UltMod
    {
        static readonly int[][] WARN = UltForms.Ramp("#c47a12", "#ffc23d"), ZAP = UltForms.Ramp("#1e64b0", "#3ab8f0", "#9af0ff", "#f0ffff");
        static readonly int[] WARN_LIGHT = UltForms.Rgb("#ffc23d"), SHADOW = UltForms.Rgb("#0a0610"), ZAP_LIGHT = UltForms.Rgb("#9af0ff");
        static readonly int[][] DRUM = UltForms.Ramp("#2a1418", "#5a2a20", "#8a3e24", "#b05a2a", "#d27c3c"), STRIPE = UltForms.Ramp("#2a2010", "#f0b424");
        const double THROW = 0.3, CUT0 = 0.5, CUT1 = 0.95, RAIN0 = 0.95, RAIN1 = 2.15, DRUM0 = 2.2, DRUMHIT = 2.5, END = 2.9; const int N = 26;
        static readonly string[] TYPES = { "can", "tire", "plank" };
        public override string Name => "廢鐵豪雨";
        public override double Dur => END;
        public override double Cut0 => CUT0;
        public override double Cut1 => CUT1;

        class Up { public double x, y, vx, vy, rot; public string type; }
        class Item { public double x, y, vy, fy, rot, land, warn; public string type; }
        class Plan { public double t, x; public string type; }
        class Drum { public double x, y, fy; public bool landed; }
        class Bolt { public double x0, y0, x1, y1, seed; }
        double side, x0, y0, fy; int next; double pop; bool hasPop;
        readonly List<Up> ups = new List<Up>();
        List<Item> items = new List<Item>();
        readonly Dictionary<Enemy, int> counts = new Dictionary<Enemy, int>();
        Drum drum; readonly List<Bolt> bolts = new List<Bolt>();
        Plan[] plan;

        public override void Start(Ult U, Player player, UltKit kit, UltHooks H)
        {
            side = player.Face; x0 = player.X; y0 = player.Y; fy = kit.FloorAt(player.X, player.Y - 8); U.Fy = fy; U.HasFy = true;
            next = 0;
            var v = H.View(); var foes = H.Enemies().Where(e => e.X > v.l && e.X < v.r && Math.Abs(e.Y - y0) < 140).ToList();
            plan = new Plan[N];
            for (int i = 0; i < N; i++)
            {
                double aim = foes.Count > 0 && i % 2 == 0 ? foes[(i >> 1) % foes.Count].X + (UltForms.Rnd(i, 3) - 0.5) * 16 : v.l + 12 + UltForms.Rnd(i, 4) * (v.r - v.l - 24);
                plan[i] = new Plan { t = RAIN0 + ((double)i / N) * (RAIN1 - RAIN0 - 0.3), x = aim, type = TYPES[i % 3] };
            }
        }

        public override void Update(Ult U, double dt, Player player, UltKit kit, UltHooks H)
        {
            double t = U.T; var v = H.View();
            player.UltPose(t < THROW ? "charge" : t < DRUMHIT + 0.15 ? "throw" : "finish", dt);
            // 起：噴垃圾上天
            if (t >= THROW && ups.Count == 0)
            {
                kit.Sfx("clank"); kit.Shake(0.2, 2);
                for (int i = 0; i < 10; i++) ups.Add(new Up { x = player.X, y = player.Y - 22, vx = (UltForms.Rnd(i, 1) - 0.5) * 180, vy = -360 - UltForms.Rnd(i, 2) * 220, type = TYPES[i % 3], rot = 0 });
                pop = t; hasPop = true;
            }
            foreach (var u in ups) { u.vy += 200 * dt; u.x += u.vx * dt; u.y += u.vy * dt; u.rot += dt * 10; }
            // 承～轉：垃圾雨
            while (next < plan.Length && t >= plan[next].t)
            {
                var p = plan[next++]; double pfy = kit.FloorAt(p.x, y0 - 120);
                items.Add(new Item { x = p.x, y = v.top - 20 - 70, vy = 380, fy = pfy, type = p.type, rot = UltForms.Rnd(next, 5) * 6, land = -1, warn = 0 });
            }
            foreach (var it in items)
            {
                it.warn += dt;
                if (it.land < 0)
                {
                    it.vy += 900 * dt; it.y += it.vy * dt; it.rot += dt * 12;
                    if (it.y >= it.fy - 4)
                    {
                        it.y = it.fy - 4; it.land = 0; it.vy = -90; H.Dust(it.x, it.fy); if (Rnd.Next() < 0.5) kit.Sfx("clank");
                        foreach (var e in H.Enemies())
                        {
                            if (Math.Abs(e.X - it.x) > 20 || Math.Abs(e.Y - it.fy) > 44) continue;
                            int n = counts.TryGetValue(e, out int c0) ? c0 : 0; if (n >= 4) continue;
                            counts[e] = n + 1; H.Hit(e, 1.1, e.X < it.x ? -1 : 1, new HitOpts { Launch = true, Push = 3 });
                        }
                    }
                }
                else { it.land += dt; it.vy += 600 * dt; it.y = Math.Min(it.fy - 4, it.y + it.vy * dt); }
            }
            items = items.Where(it => it.land < 0.45).ToList();
            // 合：帶電大油桶
            if (t >= DRUM0 && drum == null) { double x = Math.Max(v.l + 30, Math.Min(v.r - 30, player.X + side * 70)); drum = new Drum { x = x, y = v.top - 40, fy = kit.FloorAt(x, y0 - 120), landed = false }; }
            if (drum != null && !drum.landed)
            {
                double k = UltForms.Clamp01((t - DRUM0) / (DRUMHIT - DRUM0)); var d = drum;
                d.y = (H.View().top - 40) + (d.fy - (H.View().top - 40)) * k * k;
                if (k >= 1)
                {
                    d.landed = true; d.y = d.fy;
                    kit.HitStop(0.14); kit.Shake(0.7, 6); kit.Flash(d.x, d.fy - 20, 220, 4, 0.9, "#9af0ff"); kit.Sfx("crit"); U.Post = 1;
                    foreach (var e in H.Enemies())
                    {
                        if (Math.Abs(e.X - d.x) > 150 || Math.Abs(e.Y - d.fy) > 110) continue;
                        H.Hit(e, 3, e.X < d.x ? -1 : 1, new HitOpts { Launch = true, Push = 4, Elem = "shock" });
                        bolts.Add(new Bolt { x0 = d.x, y0 = d.fy - 18, x1 = e.X, y1 = e.Y - 10, seed = bolts.Count + 1 });
                    }
                    for (int i = 0; i < 4; i++) bolts.Add(new Bolt { x0 = d.x, y0 = d.fy - 18, x1 = d.x + (i - 1.5) * 50, y1 = d.fy - 2, seed = 20 + i });   // 打到地上的
                    H.Dust(d.x, d.fy);
                }
            }
        }

        public override double Dim(Ult U) { double t = U.T; return t < 0.25 ? t / 0.25 : t < DRUMHIT ? 1 : 1 - UltForms.Clamp01((t - DRUMHIT) / 0.4); }
        public override void Lights(Ult U, List<LightSrc> list, UltHooks H) { if (drum != null) list.Add(new LightSrc(drum.x, drum.y - 10, drum.landed ? 140 : 50, drum.landed ? 3 : 1.5, "#9af0ff")); }

        public override void Draw(UltPainter P, Ult U, UltKit kit, UltHooks H)
        {
            double t = U.T;
            Action<double, double, int[]> put = (x, y, c) => P.Blend(x, y, c, 1);
            foreach (var u in ups) kit.DrawJunk(put, u.type, u.x, u.y, u.rot);
            // 開場：頭頂一圈放射狀火花
            if (hasPop && t - pop < 0.25)
            {
                double a = 1 - (t - pop) / 0.25, r0 = 4 + (t - pop) * 80;
                for (int q = 0; q < 10; q++)
                {
                    double ang = (q / 10.0) * Math.PI * 2, ca = Pf.Cos(ang), sa = Pf.Sin(ang);
                    for (int d = 0; d < 6; d++) { double x = x0 + ca * (r0 + d), y = y0 - 22 + sa * (r0 + d) * 0.8; P.Blend(x, y, d < 2 ? WARN[1] : WARN[0], a); P.Glow(x, y, WARN_LIGHT, a * 0.4); }
                }
            }
            // 落點預告：影子＋琥珀色的準星，從寬到窄、越接近落地閃越快
            foreach (var it in items) if (it.land < 0)
                {
                    double k = UltForms.Clamp01(it.warn / 0.4), w = Pf.Round(12 - 7 * k); bool blink = Math.Floor(it.warn * (8 + 16 * k)) % 2 == 0;
                    for (double dx = -w + 2; dx <= w - 2; dx++) P.Blend(it.x + dx, it.fy - 1, SHADOW, 0.7);
                    if (blink) foreach (int sgn in new[] { -1, 1 }) for (int j = 0; j < 3; j++) { P.Blend(it.x + sgn * (w - j), it.fy - 1, WARN[1], 1); P.Glow(it.x + sgn * (w - j), it.fy - 1, WARN_LIGHT, 0.5); P.Blend(it.x + sgn * w, it.fy - 1 - j, WARN[1], 1); }
                }
            foreach (var it in items) kit.DrawJunk(put, it.type, it.x, it.y, it.rot);
            // 油桶：鏽紅的圓桶、中間一圈黃黑警示條、周圍劈啪的電
            if (drum != null)
            {
                var d = drum; double X0 = Pf.Round(d.x), Y0 = Pf.Round(d.y);
                if (!d.landed) for (int q = -3; q <= 3; q++) for (int k = 0; k < 26; k++) P.Blend(X0 + q * 4, Y0 - 34 - k, ZAP[1], (1 - k / 26.0) * 0.5);
                // 電弧從桶緣出發、畫在油桶後面
                for (int i = 0; i < 6; i++) { double ang = t * 18 + i * 1.05, ca = Pf.Cos(ang), sa = Pf.Sin(ang), r = 22 + (i % 3) * 5; Zap(P, X0 + ca * 12, Y0 - 16 + sa * 14, X0 + ca * r, Y0 - 16 + sa * r, i + Math.Floor(t * 24), 0.85); }
                for (int yy = -32; yy <= 0; yy++) for (int xx = -13; xx <= 13; xx++)
                    {
                        bool edge = Math.Abs(xx) == 13 || yy == -32 || yy == 0, ring = yy == -26 || yy == -6, lid = yy == -31;
                        bool band = yy >= -20 && yy <= -12, bolt = band && Math.Abs(xx - Pf.Round((yy + 16) * -0.9 + ((yy + 16) > 0 ? 3 : -3) * 0)) <= 1 && Math.Abs(xx) < 6;
                        var c = edge ? DRUM[0] : lid ? DRUM[4] : ring ? DRUM[4] : bolt ? ZAP[3] : band ? STRIPE[((xx + yy + 60) >> 1) % 2] : xx < -6 ? DRUM[3] : xx < -2 ? DRUM[4] : xx > 7 ? DRUM[1] : DRUM[2];
                        P.Blend(X0 + xx, Y0 + yy, c, 1);
                    }
                // 落地：地面掃出一圈青色電波
                if (d.landed)
                {
                    double age = t - DRUMHIT;
                    if (age < 0.5)
                    {
                        double ring = age * 320, a = 1 - age / 0.5;
                        foreach (int sgn in new[] { -1, 1 }) for (int k = 0; k < 14; k++) { double x = X0 + sgn * (ring - k), e = 1 - k / 14.0; for (int hh = 0; hh < 3; hh++) P.Blend(x, d.fy - 1 - hh, hh == 0 || k < 3 ? ZAP[3] : ZAP[2], e * a * (1 - hh * 0.25)); P.Glow(x, d.fy - 2, ZAP_LIGHT, 0.7 * e * a); }
                    }
                    if (age < 0.12) for (int q = -26; q <= 26; q++) { double e = 1 - Math.Abs(q) / 27.0; P.Blend(X0 + q, Y0 - 16, ZAP[3], e); P.Blend(X0, Y0 - 16 + q * 0.8, ZAP[3], e); P.Glow(X0 + q, Y0 - 16, ZAP_LIGHT, e); }   // 落地瞬間的白色十字光
                }
            }
            foreach (var b in bolts) { double age = t - DRUMHIT; if (age < 0.5 && (int)Math.Floor(age * 30) % 4 != 3) Zap(P, b.x0, b.y0, b.x1, b.y1, b.seed + Math.Floor(age * 20), Math.Min(1, 1.4 - age / 0.5)); }
        }

        /// 一道閃電：起點到終點，中間隨機折幾下；中心白、外面青
        static void Zap(UltPainter P, double x0, double y0, double x1, double y1, double seed, double a)
        {
            double n = Math.Max(3, Pf.Round(Pf.Hypot(x1 - x0, y1 - y0) / 9)); var pts = new List<double[]> { new[] { x0, y0 } };
            for (int i = 1; i < n; i++) { double u = i / n; pts.Add(new[] { x0 + (x1 - x0) * u + (UltForms.Rnd(seed, i) - 0.5) * 10, y0 + (y1 - y0) * u + (UltForms.Rnd(seed, i + 50) - 0.5) * 10 }); }
            pts.Add(new[] { x1, y1 });
            for (int i = 0; i < pts.Count - 1; i++)
            {
                double ax = pts[i][0], ay = pts[i][1], bx = pts[i + 1][0], by = pts[i + 1][1]; int m = Pf.ToInt32(Math.Max(Math.Abs(bx - ax), Math.Abs(by - ay)));
                for (int s = 0; s <= m; s++) { double x = ax + (bx - ax) * (s / (double)(m != 0 ? m : 1)), y = ay + (by - ay) * (s / (double)(m != 0 ? m : 1)); P.Blend(x, y, ZAP[3], a); P.Blend(x + 1, y, ZAP[2], a * 0.9); P.Blend(x - 1, y, ZAP[1], a * 0.6); P.Glow(x, y, ZAP_LIGHT, a * 0.6); }
                // 中間的折點長出短分岔
                if (i > 0 && UltForms.Rnd(seed, i + 90) < 0.45)
                {
                    double bx2 = ax + (UltForms.Rnd(seed, i + 91) - 0.5) * 16, by2 = ay + 6 + UltForms.Rnd(seed, i + 92) * 8; int mm = Pf.ToInt32(Math.Max(Math.Abs(bx2 - ax), Math.Abs(by2 - ay)));
                    for (int s = 0; s <= mm; s++) P.Blend(ax + (bx2 - ax) * (s / (double)(mm != 0 ? mm : 1)), ay + (by2 - ay) * (s / (double)(mm != 0 ? mm : 1)), ZAP[1], a * 0.8);
                }
            }
        }
    }

    // =====================================================================================
    // 蝠翼星「月下夜襲」
    // =====================================================================================
    public class BatUlt : UltMod
    {
        static readonly int[][] MOON = UltForms.Ramp("#5a4a8a", "#8a7ab8", "#b8a8e0", "#e8e0ff", "#ffffff"), CLAW = UltForms.Ramp("#3a1660", "#7a3ab8", "#c48cff", "#f0d8ff", "#ffffff");
        static readonly int[] MOON_LIGHT = UltForms.Rgb("#c8b8ff"), CLAW_LIGHT = UltForms.Rgb("#b48ae8"), BATC = UltForms.Rgb("#140a24");
        static readonly int[] TINT = { 26, 18, 64 };   // 暗場往深藍紫壓（夜晚）
        static readonly double[][] CRATERS = { new double[] { -6, -4, 4 }, new double[] { 7, 5, 5 }, new double[] { -2, 10, 3 }, new double[] { 9, -9, 2 } };
        static readonly int[][] BATV = { new[] { 0, 0 }, new[] { -1, -1 }, new[] { -2, -1 }, new[] { 1, -1 }, new[] { 2, -1 } };
        static readonly int[][] WING = { new[] { 0, 0 }, new[] { -1, -1 }, new[] { -2, -2 }, new[] { -3, -2 }, new[] { -4, -1 }, new[] { 1, -1 }, new[] { 2, -2 }, new[] { 3, -2 }, new[] { 4, -1 }, new[] { -2, -1 }, new[] { 2, -1 }, new[] { 0, 1 } };
        const double MOONT = 0.5, CUT0 = 0.45, CUT1 = 0.9, S0 = 0.9, S1 = 2.3, BACK = 2.35, END = 2.9; const int N = 8;
        public override string Name => "月下夜襲";
        public override double Dur => END;
        public override double Cut0 => CUT0;
        public override double Cut1 => CUT1;
        public override int[] Tint => TINT;

        class Trail { public double x0, y0, x1, y1, t; }
        class Claw { public double x, y, t; public int flip, n; }
        double side, x0, y0, prevX, prevY; int k = -1, hits, n; bool burst, back;
        List<Enemy> targets; Enemy cur;
        readonly List<Trail> trails = new List<Trail>(); readonly List<Claw> claws = new List<Claw>();
        readonly OrderedSet<Enemy> struck = new OrderedSet<Enemy>();
        readonly Dictionary<Enemy, int> visits = new Dictionary<Enemy, int>();

        public override void Start(Ult U, Player player, UltKit kit, UltHooks H)
        {
            side = player.Face; x0 = player.X; y0 = player.Y;
            double px = player.X, py = player.Y;
            targets = H.Enemies().Where(e => Math.Abs(e.X - px) < 210 && Math.Abs(e.Y - py) < 120).OrderBy(e => Math.Abs(e.X - px)).Take(N).ToList();
            k = -1; hits = 0; burst = false;
            prevX = player.X; prevY = player.Y - 10;
        }

        public override void Update(Ult U, double dt, Player player, UltKit kit, UltHooks H)
        {
            double t = U.T;
            if (t < S0) { player.UltPose(t < MOONT ? "charge" : "rise", dt); return; }
            if (t < S1)
            {
                int kk = (int)Math.Floor((t - S0) / ((S1 - S0) / N)); double local = (t - S0) - kk * ((S1 - S0) / N);
                if (kk != k && kk < N)
                {   // 下一次突擊：瞬移到目標旁邊
                    k = kk;
                    var alive = targets.Where(e => !e.Dead).ToList(); var e0 = alive.Count > 0 ? alive[kk % alive.Count] : null;
                    double x = e0 != null ? e0.X + (kk % 2 != 0 ? -12 : 12) : x0 + side * (30 + kk * 18), y = e0 != null ? e0.Y : y0;
                    trails.Add(new Trail { x0 = prevX, y0 = prevY, x1 = x, y1 = y - 10, t = t });
                    prevX = x; prevY = y - 10;
                    player.X = x; player.Y = y; player.Face = e0 != null ? (e0.X > x ? 1 : -1) : side;
                    cur = e0; n = 0; kit.Sfx("dash");
                }
                player.UltPose("throw", dt);
                // 抓三下（0、0.05、0.1 秒），最後一下帶毒
                if (cur != null && !cur.Dead && n < 3 && local >= n * 0.05)
                {
                    var e = cur; n++;
                    // 同一隻最多吃 2 次完整突擊，之後只剩擦傷
                    int v = (visits.TryGetValue(e, out int v0) ? v0 : 0) + (n == 1 ? 1 : 0);
                    if (n == 1) visits[e] = v;
                    H.Hit(e, v <= 2 ? 0.8 : 0.12, player.Face, new HitOpts { Push = 1, Elem = n == 3 ? "poison" : null });
                    struck.Add(e); hits++;
                    claws.Add(new Claw { x = e.X, y = e.Y - 12, t = t, flip = (k + n) % 2, n = n });
                }
                return;
            }
            if (!back) { back = true; trails.Add(new Trail { x0 = prevX, y0 = prevY, x1 = x0, y1 = y0 - 10, t = t }); player.X = x0; player.Y = y0; player.Face = side; }
            player.UltPose("finish", dt);
            if (t >= BACK && !burst)
            {
                burst = true; kit.Shake(0.4, 3); kit.HitStop(0.08); kit.Sfx("crit");
                foreach (var e in struck.List) if (!e.Dead) { H.Hit(e, 2, e.X < x0 ? -1 : 1, new HitOpts { Launch = true, Push = 3, Elem = "poison" }); kit.Spawn("poison-cloud", Pf.Round(e.X), Pf.Round(e.Y), new FxOptions { Light = 0.4 }, 1.6); }
                double heal = Math.Min(0.3, hits * 0.012);
                if (heal > 0) { H.Heal(heal); kit.Flash(x0, y0 - 12, 70, 2, 0.4, "#c48cff"); }
            }
        }

        public override double Dim(Ult U) { double t = U.T; return t < 0.35 ? (t / 0.35) * 1.15 : t < BACK ? 1.15 : 1.15 - UltForms.Clamp01((t - BACK) / 0.5) * 1.15; }
        public override void Lights(Ult U, List<LightSrc> list, UltHooks H) { var m = MoonPos(U, H); if (m != null) list.Add(new LightSrc(m.Value.x, m.Value.y, 90, 1.4, "#c8b8ff")); }

        static (double x, double y, double a)? MoonPos(Ult U, UltHooks H)
        {
            double t = U.T; if (t > END) return null;
            var v = H.View(); double k = UltForms.OutCubic(UltForms.Clamp01(t / MOONT)), a = t > BACK ? 1 - UltForms.Clamp01((t - BACK) / 0.5) : 1;
            return (v.l + (v.r - v.l) * 0.72, v.top - 24 + 64 * k, Math.Min(1, k * 1.5) * a);
        }

        public override void Draw(UltPainter P, Ult U, UltKit kit, UltHooks H)
        {
            double t = U.T; var mm = MoonPos(U, H);
            // 月亮：大圓、左上亮右下暗、幾個坑、外面一圈抖動的光暈；前面飛過幾隻蝙蝠剪影
            if (mm != null)
            {
                var m = mm.Value; const int R = 20;
                for (int y = -R - 6; y <= R + 6; y++) for (int x = -R - 6; x <= R + 6; x++)
                    {
                        double d = Pf.Hypot(x, y);
                        if (d <= R)
                        {
                            double lit = (-x - y) / (R * 1.4); bool crater = CRATERS.Any(c => Pf.Hypot(x - c[0], y - c[1]) < c[2]);
                            if (m.a < 1 && !UltForms.Dith(m.x + x, m.y + y, m.a)) continue;   // 淡出用網點
                            P.Blend(m.x + x, m.y + y, crater ? MOON[1] : d > R - 1 ? MOON[2] : lit > 0.3 ? MOON[4] : lit > -0.2 ? MOON[3] : MOON[2], 1);
                            P.Glow(m.x + x, m.y + y, MOON_LIGHT, 0.25 * m.a);
                        }
                        else if (d < R + 6 && UltForms.Dith(m.x + x, m.y + y, (1 - (d - R) / 6) * 0.5 * m.a)) P.Blend(m.x + x, m.y + y, MOON[1], 0.6);
                    }
                for (int i = 0; i < 4; i++)
                {   // 蝙蝠剪影（小 V）飛過月亮
                    double bx = m.x - 50 + ((t * 40 + i * 31) % 100), by = m.y - 12 + i * 7 + Pf.Sin(t * 10 + i) * 2, flap = Math.Floor(t * 12 + i) % 2;
                    foreach (var q in BATV) P.Blend(bx + q[0], by + (q[0] == 0 ? 0 : -1 + flap * Math.Abs(q[0])), BATC, m.a);
                }
            }
            // 殘影線：前一個位置到新位置，一條紫色虛線，很快消失
            foreach (var s in trails)
            {
                double age = t - s.t; if (age > 0.22) continue;
                double a = 1 - age / 0.22, n = Math.Max(1, Pf.Round(Pf.Hypot(s.x1 - s.x0, s.y1 - s.y0)));
                for (int i = 0; i <= n; i += 1) { double u = i / n, x = s.x0 + (s.x1 - s.x0) * u, y = s.y0 + (s.y1 - s.y0) * u; if (i % 5 == 4) continue; P.Blend(x, y, u > 0.8 ? CLAW[4] : CLAW[3], a * (0.4 + 0.6 * u)); P.Blend(x, y + 1, CLAW[2], a * (0.4 + 0.6 * u)); P.Blend(x, y - 1, CLAW[1], a * 0.5); P.Glow(x, y, CLAW_LIGHT, a * 0.4); }
                // 沿路三個蝙蝠翅膀形的殘影（越舊越暗）
                for (int g = 1; g <= 3; g++) { double u = g / 4.0, gx = s.x0 + (s.x1 - s.x0) * u, gy = s.y0 + (s.y1 - s.y0) * u, ga = a * u; foreach (var q in WING) P.Blend(gx + q[0], gy + q[1], CLAW[1 + (g == 3 ? 1 : 0)], ga); }
            }
            // 爪痕：三道平行的斜線，中間白、兩邊紫，閃一下就淡掉
            foreach (var c in claws)
            {
                double age = t - c.t; if (age > 0.28) continue;
                double a = 1 - age / 0.28, grow = UltForms.Clamp01(age / 0.05), dir = c.flip != 0 ? 1 : -1;
                for (int j = -1; j <= 1; j++) for (int s = -11; s <= -11 + 22 * grow; s++)
                    {
                        double x = c.x + s * dir + j * 4, y = c.y + s * 0.85 - j * 2;
                        double e = 1 - Math.Abs(s) / 12.0; bool wide = e > 0.45;
                        P.Blend(x, y, e > 0.55 ? CLAW[4] : e > 0.25 ? CLAW[3] : CLAW[2], a); if (wide) P.Blend(x + dir, y, CLAW[2], a); P.Blend(x - dir, y + 1, CLAW[1], a * 0.6); P.Glow(x, y, CLAW_LIGHT, a * 0.6 * e);
                    }
            }
        }
    }

    // =====================================================================================
    // 尖刺星「千針風暴」
    // =====================================================================================
    public class SpikeUlt : UltMod
    {
        static readonly int[][] AMB = UltForms.Ramp("#2a1206", "#6a3010", "#a85a1c", "#e09a3a", "#ffd890", "#fff2d0", "#ffffff");
        static readonly int[] AMB_LIGHT = UltForms.Rgb("#ffb050");
        const double RISE = 0.5, CUT0 = 0.45, CUT1 = 0.9, BALL = 0.9, FIRE0 = 1.1, FIRE1 = 2.0, DROP = 2.05, SLAM = 2.2, END = 2.9, R = 13, HIGH = 64; const int MAXN = 16;
        static readonly double[][] CLUMP = { new double[] { 0, 1, 1 }, new double[] { -6, 0.55, 0.7 }, new double[] { 6, 0.45, 0.65 }, new double[] { -11, 0.3, 0.5 } };
        public override string Name => "千針風暴";
        public override double Dur => END;
        public override double Cut0 => CUT0;
        public override double Cut1 => CUT1;

        class Needle { public double x, y, vx, vy, life; public Enemy e; public bool done; }
        class Stuck { public double x, y, a, t; }
        class Spk { public double x, y, h, w, lean, t0; }
        double side, x0, y0, fy, cx, cy, spin; int vol; bool slammed;
        List<Needle> needles = new List<Needle>();
        readonly List<Stuck> stuck = new List<Stuck>(); readonly List<Spk> spikes = new List<Spk>();
        readonly Dictionary<Enemy, int> cnt = new Dictionary<Enemy, int>();

        public override void Start(Ult U, Player player, UltKit kit, UltHooks H)
        {
            side = player.Face; x0 = player.X; y0 = player.Y; fy = kit.FloorAt(player.X, player.Y - 8); U.Fy = fy; U.HasFy = true;
            cx = player.X; cy = player.Y - 12; vol = 0; slammed = false; spin = 0;
        }

        public override void Update(Ult U, double dt, Player player, UltKit kit, UltHooks H)
        {
            double t = U.T;
            spin += dt * (t < FIRE0 ? 6 : t < FIRE1 ? 16 : 24);
            if (t < BALL) { player.UltPose(t < RISE ? "charge" : "rise", dt); return; }
            // 刺球：升到半空（主角藏起來，換成刺球）
            if (t < SLAM) player.HideT = 0.1;
            if (t < DROP) cy = y0 - 12 - (HIGH - 12) * UltForms.OutCubic(UltForms.Clamp01((t - BALL) / 0.25));
            else { double q = UltForms.Clamp01((t - DROP) / (SLAM - DROP)); cy = y0 - HIGH + (HIGH - R) * Pf.Pow(q, 2); }   // 往下砸：越掉越快
            // 連發尖針：每 0.07 秒一輪，每隻怪一根（對準），再加兩根亂射的
            if (t >= FIRE0 && t < FIRE1 && t - FIRE0 >= vol * 0.07)
            {
                vol++;
                if (vol % 3 == 1) kit.Sfx("swing");   // JS：sfx("swing", "spike")，UltKit.Sfx 只收一個參數
                double ccx = cx, ccy = cy;
                var foes = H.Enemies().Where(e => Math.Abs(e.X - ccx) < 230 && Math.Abs(e.Y - ccy) < 170).ToList();
                foreach (var e in foes)
                {
                    double tx = e.X + (UltForms.Rnd(vol, e.X) - 0.5) * 8, ty = e.Y - 8, dx = tx - cx, dy = ty - cy, d = Pf.Hypot(dx, dy);
                    if (d == 0 || double.IsNaN(d)) d = 1;
                    needles.Add(new Needle { x = cx + (dx / d) * R, y = cy + (dy / d) * R, vx = (dx / d) * 560, vy = (dy / d) * 560, e = e, life = d / 560 + 0.02 });
                }
                for (int k = 0; k < 2; k++)
                {
                    double a = Math.PI * (0.15 + 0.7 * UltForms.Rnd(vol, k + 9)); const double v = 520;
                    needles.Add(new Needle { x = cx, y = cy, vx = Pf.Cos(a) * v * (UltForms.Rnd(vol, k) < 0.5 ? -1 : 1), vy = Pf.Sin(a) * v, e = null, life = 0.6 });
                }
            }
            // 尖針飛行：對準的針到了就刺；亂射的插進地上
            foreach (var n in needles)
            {
                n.life -= dt; n.x += n.vx * dt; n.y += n.vy * dt;
                if (n.e != null && n.life <= 0 && !n.done)
                {
                    n.done = true;
                    if (!n.e.Dead) { int c = (cnt.TryGetValue(n.e, out int c0) ? c0 : 0) + 1; cnt[n.e] = c; H.Hit(n.e, c <= MAXN ? 0.35 : 0.05, n.vx > 0 ? 1 : -1, new HitOpts { Push = 0.4 }); }
                }
                else if (n.e == null && !n.done)
                {
                    double gy = kit.FloorAt(n.x, n.y - 4);
                    if (n.y >= gy) { n.done = true; stuck.Add(new Stuck { x = n.x, y = gy, a = Pf.Atan2(n.vy, n.vx), t = t }); }
                    else if (n.life <= 0) n.done = true;
                }
            }
            needles = needles.Where(n => !n.done).ToList();
            // 砸地：一道尖刺從落點往兩邊冒出來，全部擊飛
            if (t >= SLAM && !slammed)
            {
                slammed = true; cy = fy - R;
                kit.Shake(0.5, 4); kit.HitStop(0.1); kit.Sfx("ultHit");
                kit.Flash(cx, fy - 10, 160, 4, 0.8, "#ffd890");
                H.Dust(cx, fy);
                double l = kit.BoundL, r = kit.BoundR;
                // 一叢一叢（每叢一根大的＋兩旁小的），中間最高、往外越來越矮
                for (int cxk = -210; cxk <= 210; cxk += 30)
                {
                    double far = Math.Abs(cxk) / 210.0, bas = 34 - far * 20;
                    foreach (var cl in CLUMP)
                    {
                        double ox = cl[0], hk = cl[1], wk = cl[2];
                        double dx = cxk + ox + (UltForms.Rnd(cxk, ox + 3) - 0.5) * 6, x = cx + dx; if (x < l - 20 || x > r + 20) continue;
                        double gy = kit.FloorAt(x, fy - 16); if (Math.Abs(gy - fy) > 40) continue;
                        spikes.Add(new Spk { x = x, y = gy, h = bas * hk * (0.85 + UltForms.Rnd(cxk, ox) * 0.3), w = (3 + (1 - far) * 2) * wk + 1, lean = (dx > 0 ? 1 : -1) * (0.1 + UltForms.Rnd(cxk, ox + 7) * 0.3) * (ox != 0 ? 1.6 : 1), t0 = t + Math.Abs(dx) / 700 + (ox != 0 ? 0.03 : 0) });
                    }
                }
                foreach (var e in H.Enemies()) if (Math.Abs(e.X - cx) < 230 && Math.Abs(e.Y - fy) < 90) H.Hit(e, 3.5, e.X < cx ? -1 : 1, new HitOpts { Launch = true, Push = 4 });
            }
            if (t >= SLAM) { player.HideT = 0; player.X = cx; player.Y = fy; player.Face = side; player.UltPose("finish", dt); }
        }

        public override double Dim(Ult U) { double t = U.T; return t < 0.35 ? (t / 0.35) * 1.1 : t < SLAM + 0.2 ? 1.1 : 1.1 - UltForms.Clamp01((t - SLAM - 0.2) / 0.5) * 1.1; }
        public override void Lights(Ult U, List<LightSrc> list, UltHooks H)
        {
            if (U.T >= BALL && U.T < SLAM) list.Add(new LightSrc(cx, cy, 70, 1.2, "#ffb050"));
            if (slammed && U.T < SLAM + 0.4) list.Add(new LightSrc(cx, fy - 10, 140, 1.6 * (1 - (U.T - SLAM) / 0.4), "#ffd890"));
        }

        public override void Draw(UltPainter P, Ult U, UltKit kit, UltHooks H)
        {
            double t = U.T;
            // ---- 刺球在地上的影子（越高越小、越淡）
            if (t >= BALL && t < SLAM) { double hgt = UltForms.Clamp01((fy - cy) / HIGH), rx = 14 - 6 * hgt; for (double x = -rx; x <= rx; x++) if (UltForms.Dith(cx + x, fy, 0.6 - 0.35 * hgt)) P.Blend(cx + x, fy - 1, AMB[0], 0.8); }
            // ---- 刺球
            if (t >= BALL && t < SLAM + 0.05)
            {
                double grow = UltForms.OutCubic(UltForms.Clamp01((t - BALL) / 0.2)), Rr = R * (0.5 + 0.5 * grow); bool firing = t >= FIRE0 && t < FIRE1;
                const int NS = 14; double len = Rr * (0.7 + (firing ? 0.25 * (0.5 + 0.5 * Pf.Sin(t * 40)) : 0));
                // 刺（先畫，球身蓋在根部）：三角形，左上那一面亮、右下暗，尖端亮米色
                for (int i = 0; i < NS; i++)
                {
                    double a = spin + ((double)i / NS) * Math.PI * 2, ca = Pf.Cos(a), sa = Pf.Sin(a); bool lit = -ca * 0.6 - sa * 0.8 > 0;
                    for (double s = 0; s <= len; s += 0.5)
                    {
                        double u = s / len, w = (1 - u) * 2.4;
                        for (double q = -w; q <= w; q += 0.5)
                        {
                            double x = cx + ca * (Rr - 1 + s) - sa * q, y = cy + sa * (Rr - 1 + s) + ca * q;
                            P.Blend(x, y, u > 0.8 ? AMB[5] : (q < 0) == lit ? AMB[lit ? 4 : 3] : AMB[lit ? 3 : 1], 1);
                        }
                    }
                }
                // 球身：左上亮、右下暗、外圈深
                for (double y = -Rr; y <= Rr; y++) for (double x = -Rr; x <= Rr; x++)
                    {
                        double d = Pf.Hypot(x, y); if (d > Rr) continue;
                        double l = (-x - y) / (Rr * 1.4);
                        P.Blend(cx + x, cy + y, d > Rr - 1.5 ? AMB[0] : l > 0.45 ? AMB[4] : l > 0.1 ? AMB[3] : l > -0.3 ? AMB[2] : AMB[1], 1);
                    }
                double pulse = 2 + Pf.Round(Pf.Sin(t * 20));
                for (double k = -pulse; k <= pulse; k++) { P.Blend(cx + k, cy, AMB[Math.Abs(k) < 2 ? 6 : 5], 1); P.Blend(cx, cy + k, AMB[Math.Abs(k) < 2 ? 6 : 5], 1); P.Glow(cx + k, cy, AMB_LIGHT, 0.5); }
                // 轉的速度線：外面一圈斷斷續續的弧
                if (firing) for (int i = 0; i < 18; i++) { if (i % 3 == 0) continue; double a = -spin * 0.5 + i * 0.35, rr = Rr + len + 3; P.Blend(cx + Pf.Cos(a) * rr, cy + Pf.Sin(a) * rr, AMB[4], 0.55); }
            }
            // ---- 尖針：白色針尖、亮琥珀針身、暗尾，針尖發光
            foreach (var n in needles)
            {
                double v = Pf.Hypot(n.vx, n.vy); if (v == 0 || double.IsNaN(v)) v = 1;
                double ux = n.vx / v, uy = n.vy / v;
                for (int s = 0; s < 14; s++)
                {
                    double x = n.x - ux * s, y = n.y - uy * s; var c = s == 0 ? AMB[6] : s < 5 ? AMB[5] : s < 10 ? AMB[4] : AMB[2];
                    P.Blend(x, y, c, s < 10 ? 1 : 0.6);
                    if (s > 0 && s < 11) P.Blend(x - uy, y + ux, s < 6 ? AMB[4] : AMB[3], s < 10 ? 1 : 0.5);
                }
                P.Glow(n.x, n.y, AMB_LIGHT, 0.8);
            }
            // ---- 插在地上的針：慢慢淡掉
            foreach (var s0 in stuck)
            {
                double age = t - s0.t, a = 1 - UltForms.Clamp01((age - 0.5) / 0.4); if (a <= 0) continue;
                double ux = Pf.Cos(s0.a), uy = Pf.Sin(s0.a);
                for (int k = 1; k < 7; k++) { double x = s0.x - ux * k, y = s0.y - uy * k; if (UltForms.Dith(x, y, a)) P.Blend(x, y, k < 3 ? AMB[2] : AMB[4], 1); }
            }
            // ---- 地上冒出來的尖刺：從落點往兩邊一波一波冒出來，冒到頂時尖端閃一下，最後縮回地裡
            foreach (var k in spikes)
            {
                double age = t - k.t0; if (age < 0) continue;
                double up = age < 0.12 ? UltForms.OutCubic(age / 0.12) * 1.12 : age < 0.2 ? 1.12 - 0.12 * ((age - 0.12) / 0.08) : 1;
                double sink = UltForms.Clamp01((age - 0.4) / 0.25), h = k.h * up * (1 - sink); if (h < 1) continue;
                for (int j = 0; j <= h; j++)
                {
                    double u = j / k.h, w = k.w * (1 - j / Math.Max(1, h)), ccx = k.x + k.lean * j;
                    bool wf = age > 0.34 && age < 0.4;   // 縮回去之前全部白一下
                    for (double q = -w; q <= w; q += 0.5) P.Blend(ccx + q, k.y - j, wf ? AMB[6] : u > 0.85 && age < 0.25 ? AMB[6] : q < -w * 0.2 ? AMB[4] : q < w * 0.4 ? AMB[3] : AMB[1], 1);
                    P.Blend(ccx - w - 0.5, k.y - j, AMB[0], 1); P.Blend(ccx + w + 0.5, k.y - j, AMB[0], 1);
                }
                if (age < 0.25) P.Glow(k.x + k.lean * h, k.y - h, AMB_LIGHT, 1 - age / 0.25);
                // 根部噴土（兩三顆往外彈的小點）
                if (age < 0.3) for (int d = 0; d < 3; d++) { double s = d % 2 != 0 ? 1 : -1, px = k.x + s * (3 + age * 40 * (1 + d * 0.4)), py = k.y - 2 - age * 30 + age * age * 160; P.Blend(px, py, AMB[1], 1 - age / 0.3); }
            }
            // ---- 砸地的光圈：一圈往外擴的扁橢圓（網點淡出）
            if (slammed)
            {
                double age = t - SLAM;
                if (age < 0.35)
                {
                    double rx = 20 + age * 520, ry = rx * 0.18, a = 1 - age / 0.35;
                    for (int i = 0; i < 160; i++) { double g = (i / 160.0) * Math.PI * 2, x = cx + Pf.Cos(g) * rx, y = fy - 2 + Pf.Sin(g) * ry; if (UltForms.Dith(x, y, a)) P.Blend(x, y, AMB[5], 1); }
                }
            }
        }
    }

    // =====================================================================================
    // boss.js 的 drawJunk：垃圾小圖（輪胎轉的時候輻條跟著轉、鐵罐翻滾、木板旋轉的一條）
    // =====================================================================================
    public static class Junk
    {
        static readonly int[][] RUB = UltForms.Ramp("#121218", "#2a2a36", "#4a4a5a", "#6e6e80"), TINC = UltForms.Ramp("#2a3240", "#5e6e82", "#9aa8b8", "#d0d8e4"), WOODC = UltForms.Ramp("#3a200c", "#7a4a22", "#b07a40", "#e0aa66");
        static readonly int[] RUSTC = UltForms.Rgb("#a4552a"), OUTC = UltForms.Rgb("#120c10");

        /// put(x, y, [r, g, b])
        public static void Draw(Action<double, double, int[]> put, string type, double x, double y, double rot)
        {
            x = Pf.Round(x); y = Pf.Round(y);
            if (type == "tire")
            {
                for (int dy = -4; dy <= 4; dy++) for (int dx = -4; dx <= 4; dx++) { double d = Pf.Hypot(dx, dy); if (d > 4.3) continue; put(x + dx, y + dy, d > 3.4 ? OUTC : d > 2.2 ? RUB[dx + dy < 0 ? 3 : 2] : d > 1.2 ? RUB[1] : RUB[0]); }
                double a = rot; put(x + Pf.Round(Pf.Cos(a) * 2), y + Pf.Round(Pf.Sin(a) * 2), RUB[3]);
            }
            else if (type == "can")
            {
                bool flip = Math.Floor(rot * 2) % 2 != 0;
                int w = flip ? 6 : 4, h = flip ? 4 : 6;
                for (int dy = 0; dy < h; dy++) for (int dx = 0; dx < w; dx++) { bool edge = dx == 0 || dy == 0 || dx == w - 1 || dy == h - 1; put(x - (w >> 1) + dx, y - (h >> 1) + dy, edge ? OUTC : (flip ? dx == 2 : dy == 2) ? RUSTC : TINC[(flip ? dy : dx) == 1 ? 3 : 2]); }
            }
            else
            {
                double c = Pf.Cos(rot), s = Pf.Sin(rot);
                for (int i = -5; i <= 5; i++) { put(x + Pf.Round(i * c), y + Pf.Round(i * s), WOODC[2]); put(x + Pf.Round(i * c - s), y + Pf.Round(i * s + c), WOODC[1]); }
            }
        }
    }
}
