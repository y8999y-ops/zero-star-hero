// 選關世界地圖「墜星之谷」：game/src/worldmap.js（route、stepHero、select）＋ worldmap-art.js 的 drawWorld 一行一行翻成 C#。
// 不會動的底圖（bakeBase）是網頁版畫好匯出的（Baked.WorldMap）；每格把底圖貼上，再畫會動的：
// 路上的光點、鎮上燈光、蝙蝠、王的紅眼、無限討伐的裂縫、旗子、NEW 光圈、選中的亮框、霧、第 2 章木牌，最後是小星靈。
// 資訊卡（關卡縮圖、名稱、出發）在 GameRoot 用暫時版的介面畫（UI 在階段 4 重做）。
using System;
using System.Collections.Generic;
using System.Linq;
using PixelFX;

namespace ZeroStar
{
    public class WorldMap
    {
        public static readonly string[] ORDER = { "town", "1-1", "1-2", "1-3", "1-4", "endless", "ch2" };   // 鍵盤 ← → 的順序
        public static readonly string[] STAGES = { "1-1", "1-2", "1-3", "1-4" };
        public class NodeSt { public bool Open, Cleared, Fresh; }
        public class HeroSt { public double X, Y, Dist; public string At; public List<double[]> Path = new List<double[]>(); public double Face = 1; }

        public readonly Baked.WorldMapData D = Baked.WorldMap();
        public readonly Frame Frame;
        public readonly Dictionary<string, NodeSt> Nodes = new Dictionary<string, NodeSt>();
        public readonly List<string> Unlocked;
        public string Sel; public double T; public bool Moving;
        public readonly HeroSt Hero;

        /// cleared：打過的關卡。一開始選：還沒打過的最新一關，都打過就選最後一關
        public WorldMap(ICollection<string> cleared)
        {
            Frame = new Frame(D.W, D.H);
            Unlocked = STAGES.Where((id, i) => i == 0 || cleared.Contains(STAGES[i - 1])).ToList();
            var open = new HashSet<string>(new[] { "town", "endless" }.Concat(Unlocked));
            foreach (var id in ORDER) Nodes[id] = new NodeSt { Open = open.Contains(id) || id == "ch2", Cleared = cleared.Contains(id), Fresh = Unlocked.Contains(id) && !cleared.Contains(id) };
            Nodes["ch2"].Open = false;
            string first = Enumerable.Reverse(Unlocked).FirstOrDefault(id => !cleared.Contains(id)) ?? (Unlocked.Count > 0 ? Unlocked[Unlocked.Count - 1] : "1-1");
            var t = D.Nodes["town"];
            Hero = new HeroSt { X = t.x, Y = t.y, At = "town" };
            Select(first);
        }

        /// 點一個地點：第一次＝選它（小星靈沿著路走過去）；已經選了再點＝出發（回傳 true）
        public bool Select(string id)
        {
            if (id == null) return false;
            if (Sel == id) return id != "ch2";
            Sel = id;
            if (Nodes[id].Open) { Hero.Path = Route(Hero.At, id); Hero.At = id; }   // 第 2 章還沒開：只看資訊，不走過去
            return false;
        }
        /// 鍵盤 ← →：在開了的地點之間換
        public void SelectNext(int d)
        {
            var list = ORDER.Where(id => Nodes[id].Open).ToList();
            int k = list.IndexOf(Sel);
            Select(list[((k + d) % list.Count + list.Count) % list.Count]);
        }
        /// 點地圖（地圖座標）：找最近的地點（地點本身或上面的地標都算，26 格內）
        public string Pick(double mx, double my)
        {
            string best = null; double bd = 26;
            foreach (var id in ORDER)
            {
                var n = D.Nodes[id]; double d = Math.Min(Pf.Hypot(mx - n.x, my - n.y), Pf.Hypot(mx - n.x, my - (n.y - D.Lmy)));
                if (d < bd && (Nodes[id].Open || id == "ch2")) { bd = d; best = id; }
            }
            return best;
        }

        // ---- 地點之間的路（沿著畫好的路走）：回傳一串點
        public List<double[]> Route(string from, string to)
        {
            var nt = D.Nodes[to];
            if (from == to) return new List<double[]> { new[] { nt.x, nt.y } };
            var adj = new Dictionary<string, List<(string m, double[][] pts)>>();
            void Add(string k, string m, double[][] p) { if (!adj.TryGetValue(k, out var l)) adj[k] = l = new List<(string, double[][])>(); l.Add((m, p)); }
            foreach (var s in D.Segs) { Add(s.a, s.b, s.pts); Add(s.b, s.a, s.pts.Reverse().ToArray()); }
            var prev = new Dictionary<string, (string n, double[][] pts)?> { [from] = null }; var q = new Queue<string>(); q.Enqueue(from);
            while (q.Count > 0) { var n = q.Dequeue(); if (n == to) break; if (adj.TryGetValue(n, out var l)) foreach (var (m, pts) in l) if (!prev.ContainsKey(m)) { prev[m] = (n, pts); q.Enqueue(m); } }
            if (!prev.ContainsKey(to)) return new List<double[]> { new[] { nt.x, nt.y } };
            var parts = new List<double[][]>();
            for (string n = to; prev[n] != null; n = prev[n].Value.n) parts.Insert(0, prev[n].Value.pts);
            return parts.SelectMany(p => p).ToList();
        }
        /// 小星靈沿著路走一格（每秒 80 格）
        bool StepHero(double dt)
        {
            double move = 80 * dt; bool moving = false; var h = Hero;
            while (move > 0 && h.Path.Count > 0)
            {
                double px = h.Path[0][0], py = h.Path[0][1], dx = px - h.X, dy = py - h.Y, d = Pf.Hypot(dx, dy);
                if (d <= move) { h.X = px; h.Y = py; h.Path.RemoveAt(0); move -= d; }
                else { h.X += (dx / d) * move; h.Y += (dy / d) * move; move = 0; }
                if (Math.Abs(dx) > 0.3) h.Face = Math.Sign(dx);
                moving = true;
            }
            if (moving) h.Dist += 80 * dt;
            return moving;
        }

        /// 一格：走路、畫地圖、畫小星靈（照 worldmap.js 的 frameLoop）
        public void Step(double dt)
        {
            T += dt;
            Moving = StepHero(dt);
            DrawWorld();
            var pose = HeroArt.Pose("star", Moving ? "run#" + (int)(Math.Floor(Hero.Dist / 6) % 4) : "stand");
            HeroArt.Paint(Frame, Hero.X, Hero.Y + 3, pose, Hero.Face < 0, 0, 0);
        }

        // ---------- 畫（worldmap-art.js 的 drawWorld）
        static int[] Hex(string h) { int n = Convert.ToInt32(h.Substring(1), 16); return new[] { (n >> 16) & 255, (n >> 8) & 255, n & 255 }; }
        static uint Pk(string h) { var c = Hex(h); return 0xff000000u | ((uint)c[2] << 16) | ((uint)c[1] << 8) | (uint)c[0]; }
        static double Hash(double x, double y, double k = 0)
        {
            uint h = unchecked((uint)Pf.ToInt32(x * 374761393 + y * 668265263 + k * 2147483647));
            h = unchecked((uint)((int)(h ^ (h >> 13)) * 1274126177));
            return (h ^ (h >> 16)) / 4294967296.0;
        }
        static double Smooth(double t) => t * t * (3 - 2 * t);
        static double VNoise(double x, double y, double k)
        {
            double xi = Math.Floor(x), yi = Math.Floor(y), fx = Smooth(x - xi), fy = Smooth(y - yi);
            double a = Hash(xi, yi, k), b = Hash(xi + 1, yi, k), c = Hash(xi, yi + 1, k), d = Hash(xi + 1, yi + 1, k);
            return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
        }
        static readonly uint[] GOLD = new[] { "#7a5a2a", "#c8961a", "#ffd84a", "#fff2a0", "#ffffff" }.Select(Pk).ToArray();
        static readonly int[] GOLD_RGB = Hex("#ffd860");
        static readonly uint OUT = Pk("#0a0810");
        static readonly int[][] FOGC = { Hex("#3a3a58"), Hex("#5a5a7a"), Hex("#8a8aaa"), Hex("#b4b4cc") };
        static void Glow(uint[] L, int W, int H, double x, double y, int r, int[] rgb, double a)
        {
            double cx = Pf.Round(x), cy = Pf.Round(y);
            for (int dy = -r; dy <= r; dy++) for (int dx = -r; dx <= r; dx++)
            {
                double X = cx + dx, Y = cy + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
                double f = 1 - Pf.Hypot(dx, dy) / (r + 0.5); if (f <= 0) continue;
                int i = (int)(Y * W + X); uint d = L[i]; double k = f * f * a;
                L[i] = unchecked((uint)(unchecked((int)0xff000000) | (Pf.ToInt32(Math.Min(255, ((d >> 16) & 255) + rgb[2] * k)) << 16) | (Pf.ToInt32(Math.Min(255, ((d >> 8) & 255) + rgb[1] * k)) << 8) | Pf.ToInt32(Math.Min(255, (d & 255) + rgb[0] * k))));
            }
        }
        bool IsOpen(string id) => Nodes.TryGetValue(id, out var n) && n.Open;
        void DrawWorld()
        {
            var frame = Frame; int W = frame.W, H = frame.H; var Cc = frame.Color; var L = frame.LightRaw; double t = T; int LMY = D.Lmy;
            Array.Copy(D.Base, Cc, Cc.Length); Array.Clear(L, 0, L.Length);
            void Put(double x, double y, uint c) { x = Pf.Round(x); y = Pf.Round(y); if (x >= 0 && y >= 0 && x < W && y < H) Cc[(int)(y * W + x)] = c; }
            void Blend(double x, double y, int[] rgb, double a)
            {
                x = Pf.Round(x); y = Pf.Round(y); if (x < 0 || y < 0 || x >= W || y >= H) return;
                int i = (int)(y * W + x); uint c = Cc[i];
                double r = (c & 255) * (1 - a) + rgb[0] * a, g = ((c >> 8) & 255) * (1 - a) + rgb[1] * a, b = ((c >> 16) & 255) * (1 - a) + rgb[2] * a;
                Cc[i] = unchecked((uint)(unchecked((int)0xff000000) | (Pf.ToInt32(b) << 16) | (Pf.ToInt32(g) << 8) | Pf.ToInt32(r)));
            }
            (double x, double y) N(string id) => D.Nodes[id];
            // 路上的光點：開了的路上，金色小點一顆顆往前流
            foreach (var s in D.Segs)
            {
                if (!IsOpen(s.b) || !IsOpen(s.a)) continue;
                for (int i = 0; i < s.pts.Length; i += 4)
                {
                    double k = (i / 4.0 - t * 6) % 6, x = s.pts[i][0], y = s.pts[i][1];
                    if (((k % 6) + 6) % 6 < 1) { Put(x, y, GOLD[3]); Glow(L, W, H, x, y, 2, GOLD_RGB, 0.35); } else Put(x, y, GOLD[1]);
                }
            }
            // 鎮上燈光（窗戶一閃一閃）
            Glow(L, W, H, 50, 32, 9, GOLD_RGB, 0.28 + 0.06 * Pf.Sin(t * 2));
            foreach (var (x, y) in new[] { (33, 48), (35, 48), (41, 52), (43, 52), (51, 54), (53, 54), (61, 52), (63, 52), (69, 47), (71, 47), (26, 42), (28, 42) }) Glow(L, W, H, x, y, 2, GOLD_RGB, 0.16 + 0.08 * Pf.Sin(t * 3 + x));
            // 1-1：坑底有一點星光在呼吸
            Glow(L, W, H, N("1-1").x, N("1-1").y - LMY, 7, Hex("#a0c8ff"), 0.25 + 0.15 * Pf.Sin(t * 1.7));
            // 1-3：洞口飛出兩隻小蝙蝠
            if (IsOpen("1-3")) for (int b = 0; b < 2; b++)
            {
                double a = t * (1.6 + b * 0.4) + b * 3, x = 196 + Pf.Cos(a) * (10 + b * 5), y = 96 - LMY - 16 + Pf.Sin(a) * 4 - b * 4, flap = Math.Floor(t * 8 + b) % 2;
                Put(x, y, Pk("#1a1428")); Put(x - 1, y - flap, Pk("#2a2440")); Put(x + 1, y - flap, Pk("#2a2440")); Put(x - 2, y - 1 + flap, Pk("#2a2440")); Put(x + 2, y - 1 + flap, Pk("#2a2440"));
            }
            // 1-4：眼睛發紅光
            if (IsOpen("1-4")) { double ly = N("1-4").y - LMY; Glow(L, W, H, 258, ly - 2, 2, Hex("#ff4a5a"), 0.45); Glow(L, W, H, 267, ly - 2, 2, Hex("#ff4a5a"), 0.45); Glow(L, W, H, 262, ly - 12, 3, GOLD_RGB, 0.3); }
            // 無限討伐的裂縫：紫光＋往上飄的小星
            if (IsOpen("endless"))
            {
                Glow(L, W, H, 136, 58 - LMY + 6, 9, Hex("#a060ff"), 0.25 + 0.08 * Pf.Sin(t * 2.3));
                for (int i = 0; i < 5; i++) { double life = 1.6, age = (t + i * 0.37) % life, x = 130 + i * 3 + Pf.Sin(age * 3 + i) * 1.5, y = 58 - LMY + 4 - age * 10; if (age / life < 0.85) Put(x, y, i % 2 != 0 ? Pk("#c88aff") : Pk("#fff2ff")); }
            }
            // 地點標記：打過＝金色小旗；新開的＝金色光圈一直擴散；選中的＝腳下一圈亮框
            foreach (var id in new[] { "1-1", "1-2", "1-3", "1-4", "endless", "town" })
            {
                var n = N(id); var s = Nodes[id]; if (!s.Open) continue;
                double fx = n.x + (id == "town" ? 12 : 13), fy = n.y + (id == "town" ? -10 : -LMY - 9);
                if (s.Cleared)
                {
                    for (int y = 0; y < 8; y++) Put(fx, fy + y, y == 7 ? OUT : Pk("#c8b08a"));
                    double wave = Pf.Round(Pf.Sin(t * 5 + n.x) * 0.8);
                    for (int y = 0; y < 3; y++) for (int x = 1; x <= 4; x++) Put(fx + x, fy + y + (x > 2 ? wave : 0), y == 0 || x == 1 ? GOLD[3] : GOLD[2]);
                }
                if (s.Fresh)
                {
                    double k = (t * 0.8) % 1, r = 4 + k * 10;
                    for (double a = 0; a < Math.PI * 2; a += 0.12) Blend(n.x + Pf.Cos(a) * r, n.y + Pf.Sin(a) * r * 0.55, Hex("#ffe066"), (1 - k) * 0.9);
                    Glow(L, W, H, n.x, n.y, 6, GOLD_RGB, 0.3 * (1 - k));
                }
                if (Sel == id)
                {
                    double r = 9 + Pf.Sin(t * 4) * 0.6;
                    for (double a = 0; a < Math.PI * 2; a += 0.06) { double x = n.x + Pf.Cos(a) * r, y = n.y + 4 + Pf.Sin(a) * r * 0.42; Put(x, y, (a / (Math.PI * 2) * 16 + t * 4) % 2 < 1 ? GOLD[3] : GOLD[1]); }
                }
            }
            // 迷霧：沒開的地方蓋一團雲（第 2 章整片在霧裡）。邊緣用雜訊切成一塊一塊，上面亮下面暗，慢慢飄
            var zones = new List<(double x, double y, double rx, double ry)> { (N("ch2").x, N("ch2").y, 62, 48) };
            foreach (var id in new[] { "1-1", "1-2", "1-3", "1-4", "endless" }) if (!IsOpen(id)) zones.Add((N(id).x, N(id).y - LMY + 4, 24, 20));
            foreach (var z in zones)
                for (double y = Math.Max(0, Math.Floor(z.y - z.ry)); y < Math.Min(H, z.y + z.ry); y++)
                    for (double x = Math.Max(0, Math.Floor(z.x - z.rx)); x < Math.Min(W, z.x + z.rx); x++)
                    {
                        double d = Pf.Hypot((x - z.x) / z.rx, (y - z.y) / z.ry); if (d >= 1) continue;
                        double n = VNoise(x / 9 + t * 0.12, y / 6, 51) * 0.65 + VNoise(x / 4 - t * 0.2, y / 3, 52) * 0.35;
                        double v = (1 - d) * 1.6 + n - 0.75;
                        if (v < 0) continue;
                        double up = VNoise((x) / 9 + t * 0.12, (y - 2) / 6, 51) * 0.65 + VNoise(x / 4 - t * 0.2, (y - 2) / 3, 52) * 0.35;
                        int lit = up < n - 0.02 ? 1 : 0;
                        int k = v > 0.55 ? 3 : v > 0.3 ? 2 : v > 0.12 ? 1 : 0;
                        Blend(x, y, FOGC[Math.Min(3, k + lit)], k == 0 ? 0.35 : k == 1 ? 0.6 : 0.85);
                    }
            // 第 2 章的木牌：霧裡露出來
            {
                double cx = N("ch2").x, cy = N("ch2").y + 4;
                for (int y = 0; y < 8; y++) Put(cx, cy + y, Pk("#5a4434"));
                for (int y = -7; y < 0; y++) for (int x = -7; x <= 7; x++) Put(cx + x, cy + y, Math.Abs(x) == 7 || y == -7 || y == -1 ? Pk("#2a1c18") : y == -6 ? Pk("#b8946a") : Pk("#9a7a52"));
                foreach (var (x, y) in new[] { (-1, -5), (0, -6), (1, -5), (1, -4), (0, -3), (0, -1) }) if (y > -7 && y < -1) Put(cx + x, cy + y, Pk("#2a1c18"));
            }
        }
    }
}
