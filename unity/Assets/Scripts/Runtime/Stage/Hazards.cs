// game/src/hazards.js 一行一行翻成 C#：場景裡的元素來源（環境就是武器），敵人走進去就沾上狀態，主角不受影響。
//   水窪＝潮濕、火盆＝燃燒，另外：黏液池＝黏液、油桶（打破流一灘油）＝油汙、廚餘堆＝毒、漏電管線＝帶電（每 1.6 秒放一次電）。
//   油灘裡有燃燒的敵人 → 整灘油燒起來 4 秒。
using System;
using System.Collections.Generic;
using System.Linq;
using PixelFX;

namespace ZeroStar
{
    public class Hazards
    {
        static uint[] P(params string[] a) => Col.Ramp(a);
        static readonly uint[] GOO = P("#2a5a10", "#5a9a18", "#9ad830", "#d8ff70", "#ffffff");
        static readonly uint[] OIL = P("#120c1a", "#241a32", "#40325a", "#5af0d0", "#e080ff", "#ffe070", "#6a5a8a");
        static readonly uint[] DRUM = P("#1a0c0c", "#4a1c14", "#7a2e1c", "#b04a26", "#d87a3a", "#f0b070");
        static readonly uint[] STRIPE = P("#2a2a2a", "#f0c020");
        static readonly uint[] JUNK = P("#1a1410", "#3a2c20", "#5a4430", "#8a6a48", "#3a5a20", "#6a9a28", "#b8e040", "#e8ff90");
        static readonly uint[] PIPE = P("#14161c", "#2a2e38", "#4a5468", "#6e7a90", "#9aa6ba", "#d0d8e6");
        static readonly uint[] VOLT = P("#1e64b0", "#3ab8f0", "#9af0ff", "#ffffff");
        static readonly uint[] FIRE = P("#8a1f17", "#f2561d", "#ffc23d", "#fff3a6");
        static readonly uint BLACKBAG = Col.Hex("#0a0810");
        static double Hash(double a, double b) { double s = Pf.Sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.Floor(s); }

        // 每一關放哪些（x 是地上的位置）
        static readonly Dictionary<string, (string, double)[]> PLAN = new Dictionary<string, (string, double)[]>
        {
            ["1-1"] = new[] { ("goo", 760.0), ("drum", 1240), ("junk", 1720), ("pipe", 2120) },
            ["1-2"] = new[] { ("junk", 520.0), ("drum", 980), ("drum", 1460), ("pipe", 1880), ("junk", 2360) },
            ["1-3"] = new[] { ("goo", 620.0), ("pipe", 1060), ("goo", 1640), ("drum", 2100) },
        };

        public class H { public string type; public double x, y, w, shakeT, fireT, spill; public int hp; public double? ttl; }
        public readonly List<H> List;
        readonly double floor; readonly List<(double x, double y)> torches; readonly List<Puddle> puddles;
        readonly Action<Enemy, string> applyStatus;
        double clock, tickT;

        /// items＝[(種類, x, y)]（大地圖每個放在自己的地面上，y 可以 null＝地板）；沒給就用舊的 PLAN。applyStatus＝status.js applyStatus。
        public Hazards(string stage, double floor, List<(double x, double y)> torches, List<Puddle> puddles, List<(string type, double x, double? y)> items, Action<Enemy, string> applyStatus)
        {
            this.floor = floor; this.torches = torches ?? new List<(double, double)>(); this.puddles = puddles ?? new List<Puddle>(); this.applyStatus = applyStatus;
            var src = items ?? (stage != null && PLAN.TryGetValue(stage, out var pl) ? pl.Select(q => (q.Item1, q.Item2, (double?)null)).ToList() : new List<(string, double, double?)>());
            List = src.Select(q => new H { type = q.type, x = q.x, y = q.y ?? floor, w = q.type == "goo" ? 30 : q.type == "junk" ? 26 : 12, hp = 2, shakeT = 0, fireT = 0, spill = 0 }).ToList();
        }
        bool Zone(H h, Enemy e) => Math.Abs(e.X - h.x) < h.w / 2 + 6 && e.Y > h.y - 8 && e.Y < h.y + 4;

        public void Update(double dt, List<Enemy> enemies)
        {
            clock += dt;
            // 暫時的（技能樹「黏液地面」）：時間到就消失
            for (int i = List.Count - 1; i >= 0; i--) if (List[i].ttl.HasValue && (List[i].ttl -= dt) <= 0) List.RemoveAt(i);
            foreach (var h in List) { h.shakeT = Math.Max(0, h.shakeT - dt); if (h.fireT > 0) h.fireT -= dt; if (h.type == "oil" && h.spill < 1) h.spill = Math.Min(1, h.spill + dt * 2.5); }
            if ((tickT -= dt) > 0) return;
            tickT = 0.25;
            // 還沒醒的怪（在原地待著）不吃地上的東西，醒了才會
            var ground = enemies.Where(e => !e.Dead && !e.K.Fly && e.Awake).ToList();
            foreach (var e in ground)
            {
                foreach (var p in puddles) if (Math.Abs(e.X - p.x) < p.w / 2 && Math.Abs(e.Y - p.y) < 6 && !(e.St != null && e.St.Wet != 0)) applyStatus(e, "wet");
                foreach (var t in torches) if (Math.Abs(e.X - t.x) < 9 && Math.Abs(e.Y - t.y) < 10) applyStatus(e, "burn");
                foreach (var h in List)
                {
                    if (!Zone(h, e)) continue;
                    if (h.type == "goo") applyStatus(e, "slime");
                    else if (h.type == "junk") applyStatus(e, "poison");
                    else if (h.type == "oil")
                    {
                        if (h.fireT > 0) applyStatus(e, "burn");
                        else if (e.St != null && e.St.Burn > 0) { h.fireT = 4; applyStatus(e, "oil"); }   // 著火的踩進油灘：整灘燒起來
                        else applyStatus(e, "oil");
                    }
                    else if (h.type == "pipe" && clock % 1.6 < 0.3) applyStatus(e, "shock");
                }
            }
        }

        /// 攻擊打到：油桶會壞，壞了流出一灘油
        public void Hit((double x0, double x1, double y0, double y1) box)
        {
            foreach (var h in List)
            {
                if (h.type != "drum" || box.x1 < h.x - 6 || box.x0 > h.x + 6 || box.y1 < h.y - 16 || box.y0 > h.y) continue;
                h.shakeT = 0.2;
                if (--h.hp <= 0) { h.type = "oil"; h.w = 44; h.spill = 0; }
            }
        }

        public delegate void PutFn(Frame frame, double x, double y, uint c, bool glow = false);
        static void Put(Frame frame, double x, double y, uint c, bool glow = false)
        {
            int X = (int)Pf.Round(x) - frame.Ox, Y = (int)Pf.Round(y) - frame.Oy;
            if (X < 0 || Y < 0 || X >= frame.W || Y >= frame.H) return;
            frame.Color[Y * frame.W + X] = c;
            if (glow) frame.Light[Y * frame.W + X] = c;
        }

        public void Draw(Frame frame)
        {
            foreach (var h in List)
            {
                if (h.x < frame.Ox - 40 || h.x > frame.Ox + frame.W + 40) continue;
                if (h.ttl.HasValue && h.ttl.Value < 0.6 && Math.Floor(h.ttl.Value * 12) % 2 != 0) continue;   // 快消失時閃
                DrawHazard(frame, h, clock, h.y, Put);
            }
        }
        /// 放一個暫時的元素地面（ttl 秒後消失）：JS addTemp({ type, x, y, w, ttl })
        public void AddTemp(string type, double x, double? y, double w, double ttl) => List.Add(new H { shakeT = 0, fireT = 0, spill = 1, hp = 2, y = y ?? floor, type = type, x = x, w = w, ttl = ttl });

        static readonly int[][] BAG = { new[] { -6, 6 }, new[] { -7, 7 }, new[] { -7, 7 }, new[] { -8, 7 }, new[] { -8, 7 }, new[] { -7, 7 }, new[] { -7, 6 }, new[] { -6, 5 }, new[] { -4, 3 }, new[] { -2, 1 }, new[] { -1, 1 }, new[] { -2, 2 } };

        /// 畫一個場景物件
        public static void DrawHazard(Frame frame, H h, double t, double floor, PutFn put)
        {
            double x0 = h.x, y = floor;
            double sx = h.shakeT > 0 ? Pf.Round(Pf.Sin(h.shakeT * 80)) : 0;
            if (h.type == "goo")
            {
                // 黏液池：地上一灘 3 排的亮綠黏液，表面一條白亮線，泡泡慢慢鼓起來破掉
                double hw = h.w / 2;
                for (double i = -hw; i <= hw; i++)
                {
                    double a = Math.Abs(i) / hw;
                    put(frame, x0 + i, y - 1, a > 0.92 ? GOO[0] : GOO[1]);
                    if (a < 0.9) put(frame, x0 + i, y - 2, a > 0.75 ? GOO[1] : GOO[2]);
                    if (a < 0.7) put(frame, x0 + i, y - 3, i < -hw * 0.3 && i > -hw * 0.6 ? GOO[4] : GOO[3]);
                }
                for (int k = 0; k < 2; k++)
                {
                    double p = (t * 0.5 + k * 0.5) % 1, bx = x0 - hw * 0.4 + k * hw * 0.8, r = p < 0.8 ? Pf.Round(p * 2.5) : 0;
                    if (r != 0) for (double i = -r; i <= r; i++) put(frame, bx + i, y - 3 - r + Math.Abs(i), Math.Abs(i) == r ? GOO[2] : GOO[3]);
                    if (p > 0.8 && p < 0.9) { put(frame, bx - 2, y - 5, GOO[3]); put(frame, bx + 2, y - 6, GOO[3]); }
                }
            }
            else if (h.type == "drum")
            {
                // 油桶：鏽紅色的直筒鐵桶（左亮右暗、上下兩圈箍）、中間黃黑警告條、桶口一點黑油
                for (int j = 0; j < 16; j++) for (int i = -6; i <= 6; i++)
                    {
                        double u = (i + 6) / 12.0; bool rim = j == 0 || j == 15 || j == 5 || j == 10;
                        uint c = u < 0.15 ? DRUM[2] : u < 0.35 ? DRUM[4] : u < 0.7 ? DRUM[3] : u < 0.9 ? DRUM[2] : DRUM[1];
                        if (rim) c = u < 0.3 ? DRUM[5] : u < 0.8 ? DRUM[4] : DRUM[2];
                        if (j >= 6 && j <= 9 && !rim) c = ((i + j) & 3) < 2 ? STRIPE[1] : STRIPE[0];
                        if (Math.Abs(i) == 6) c = DRUM[0];
                        put(frame, x0 + i + sx, y - 1 - j, c);
                    }
                for (int i = -5; i <= 5; i++) put(frame, x0 + i + sx, y - 17, i < -2 ? DRUM[4] : DRUM[2]);
                put(frame, x0 + 2 + sx, y - 17, OIL[1]); put(frame, x0 + 3 + sx, y - 17, OIL[1]);
                if (h.hp < 2) { put(frame, x0 - 2 + sx, y - 12, DRUM[0]); put(frame, x0 - 1 + sx, y - 11, DRUM[0]); put(frame, x0 + sx, y - 12, DRUM[0]); }   // 被打凹的裂縫
            }
            else if (h.type == "oil")
            {
                // 油灘：3 排高、邊緣一圈偏紫的亮邊，表面兩三道會流動的彩虹油光
                double hw = Pf.Round((h.w / 2) * h.spill);
                for (double i = -hw; i <= hw; i++)
                {
                    double a = Math.Abs(i) / Math.Max(1, hw);
                    put(frame, x0 + i, y - 1, a > 0.92 ? OIL[2] : OIL[1]);
                    if (a < 0.9) put(frame, x0 + i, y - 2, a > 0.8 ? OIL[2] : OIL[0]);
                    if (a < 0.7) put(frame, x0 + i, y - 3, a > 0.55 ? OIL[2] : i < 0 && i > -hw * 0.5 ? OIL[6] : OIL[2]);   // 頂上一段亮邊
                }
                for (int k = 0; k < 3; k++)
                {
                    double sx0 = Pf.Round(x0 - hw * 0.6 + ((k * 0.37 + t * 0.15) % 1) * hw * 1.2);
                    for (int q = 0; q < 3; q++) if (Math.Abs(sx0 + q - x0) < hw * 0.8) put(frame, sx0 + q, y - 2, OIL[3 + ((q + k) % 3)]);
                }
                if (h.fireT > 0)
                {
                    // 著火：火舌粗細高低不一、間距亂，底下一排紅
                    for (double i = -hw; i <= hw; i++) put(frame, x0 + i, y - 2, FIRE[0], true);
                    for (int k = 0; k < Math.Floor(hw / 2); k++)
                    {
                        double fx = Pf.Round(x0 - hw + 2 + Hash(k, 3) * (hw * 2 - 4)), f = Math.Floor(t * 12 + k * 3);
                        double fh = 4 + Math.Floor(Hash(k, f % 5) * 7) + (h.fireT > 3.5 ? 3 : 0); bool wide = Hash(k, 9) > 0.35;
                        for (int j = 0; j < fh; j++)
                        {
                            double q = j / fh; uint c = FIRE[q < 0.3 ? 0 : q < 0.6 ? 1 : q < 0.85 ? 2 : 3]; double dx = q > 0.6 ? Pf.Round(Pf.Sin(t * 9 + k)) : 0;
                            put(frame, fx + dx, y - 3 - j, c, true);
                            if (wide && q < 0.55) put(frame, fx + 1, y - 3 - j, FIRE[q < 0.3 ? 0 : 1], true);
                        }
                    }
                }
            }
            else if (h.type == "junk")
            {
                // 廚餘堆：綁起來的黑色垃圾袋、罐頭和魚骨頭，底下滲出一灘發光的毒汁，上面冒毒泡
                for (int i = -13; i <= 13; i++)
                {   // 毒汁
                    double a = Math.Abs(i) / 13.0;
                    put(frame, x0 + i, y - 1, a > 0.85 ? JUNK[4] : JUNK[5]);
                    if (a < 0.6) put(frame, x0 + i, y - 2, (i & 3) == 1 ? JUNK[7] : JUNK[6], true);
                }
                for (int j = 0; j < BAG.Length; j++)
                {
                    int l = BAG[j][0], r = BAG[j][1];
                    for (int i = l; i <= r; i++)
                    {
                        double u = (double)(i - l) / Math.Max(1, r - l); bool top = j >= 9;
                        uint c = u < 0.2 ? PIPE[3] : u < 0.6 ? PIPE[2] : u < 0.85 ? PIPE[1] : PIPE[0];
                        if (!top && u > 0.15 && u < 0.3 && j > 2 && j < 7) c = PIPE[4];   // 塑膠袋的亮面
                        if (top) c = j == 11 ? PIPE[3] : PIPE[2];
                        put(frame, x0 - 2 + i, y - 2 - j, c);
                    }
                }
                for (int j = 0; j < 5; j++) for (int i = 0; i < 4; i++) put(frame, x0 + 8 + i, y - 2 - j, j == 4 ? PIPE[5] : i == 0 ? PIPE[4] : i < 3 ? PIPE[3] : PIPE[2]);   // 罐頭
                put(frame, x0 + 9, y - 4, DRUM[3]); put(frame, x0 + 10, y - 4, DRUM[3]);
                for (int i = 0; i < 5; i++) put(frame, x0 - 13 + i, y - 3, JUNK[3]);   // 魚骨頭
                foreach (int i in new[] { 1, 2, 3 }) { put(frame, x0 - 13 + i, y - 4, JUNK[3]); put(frame, x0 - 13 + i, y - 2, JUNK[3]); }
                put(frame, x0 - 8, y - 4, JUNK[3]); put(frame, x0 - 8, y - 2, JUNK[3]);
                for (int k = 0; k < 3; k++)
                {
                    double p = (t * 0.5 + k / 3.0) % 1, bx = x0 - 5 + k * 5 + Pf.Sin(p * 6 + k) * 1.5, by = y - 4 - p * 18;
                    if (p < 0.55) { put(frame, bx, by, JUNK[7], true); put(frame, bx + 1, by, JUNK[6]); put(frame, bx, by + 1, JUNK[5]); put(frame, bx + 1, by + 1, JUNK[4]); }
                    else put(frame, bx, by, JUNK[6], true);
                }
            }
            else if (h.type == "pipe")
            {
                // 漏電管線：地上冒出一截斷掉的鐵管（彎頭朝右），斷口每 1.6 秒放一次電，平常偶爾冒小火花
                for (int j = 0; j < 12; j++) for (int i = -3; i <= 3; i++) put(frame, x0 + i, y - 1 - j, i == -3 ? PIPE[1] : i < -1 ? PIPE[4] : i < 1 ? PIPE[3] : i < 3 ? PIPE[2] : PIPE[0]);
                for (int i = -4; i <= 4; i++) { put(frame, x0 + i, y - 4, PIPE[i < 0 ? 5 : 2]); put(frame, x0 + i, y - 1, PIPE[1]); }   // 管箍、底座
                for (int j = 0; j < 5; j++) for (int i = 3; i <= 7; i++) put(frame, x0 + i, y - 13 + j, j == 0 ? PIPE[4] : j == 4 ? PIPE[0] : PIPE[3]);   // 彎頭
                for (int j = 0; j < 5; j++) put(frame, x0 + 8, y - 13 + j, PIPE[0]);   // 斷口
                bool zap = t % 1.6 < 0.3;
                if (zap)
                {
                    double f = Math.Floor(t * 30);
                    double px = x0 + 9, py = y - 11;
                    for (int s = 0; s < 5; s++)
                    {
                        double nx = px + (s % 2 != 0 ? 0 : 2) + Hash(f, s) * 2, ny = py + 1 + Hash(s, f) * 2.5;
                        for (int q = 0; q <= 3; q++) { put(frame, px + ((nx - px) * q) / 3, py + ((ny - py) * q) / 3, VOLT[3], true); put(frame, px + ((nx - px) * q) / 3, py + ((ny - py) * q) / 3 - 1, VOLT[1], true); }
                        px = nx; py = Math.Min(y - 1, ny);
                    }
                    put(frame, px, y - 1, VOLT[3], true); put(frame, px - 1, y - 1, VOLT[2], true); put(frame, px + 1, y - 1, VOLT[2], true);
                }
                else if (Math.Floor(t * 8) % 5 == 0) put(frame, x0 + 9, y - 11 + (Math.Floor(t * 8) % 3), VOLT[2], true);
            }
        }
    }
}
