// 地上的掉落物（game/src/loot.js）與金幣（main.js 的 coins）翻成 C#：噴出來、落地、依稀有度冒光柱，主角走過去自動撿。
using System;
using System.Collections.Generic;
using System.Linq;
using PixelFX;

namespace ZeroStar
{
    public static class Icons
    {
        public static int S = 16;
        static Dictionary<string, uint[]> px;
        public static uint[] Get(string name)
        {
            if (px == null)
            {
                px = new Dictionary<string, uint[]>();
                var raw = Resources_Load();
                S = raw.size;
                foreach (var (n, p) in raw.list) px[n] = p;
            }
            return px.TryGetValue(name, out var a) ? a : null;
        }
        static (int size, List<(string, uint[])> list) Resources_Load()
        {
            var t = UnityEngine.Resources.Load<UnityEngine.TextAsset>("Baked/icons");
            using (var ms = new System.IO.MemoryStream(t.bytes)) using (var z = new System.IO.Compression.GZipStream(ms, System.IO.Compression.CompressionMode.Decompress)) using (var o = new System.IO.MemoryStream())
            {
                z.CopyTo(o); var b = o.ToArray(); int p = 0;
                int I32() { int v = BitConverter.ToInt32(b, p); p += 4; return v; }
                string Str() { int n = I32(); string s = System.Text.Encoding.UTF8.GetString(b, p, n); p += n; return s; }
                uint[] U32() { int n = I32(); var a = new uint[n]; Buffer.BlockCopy(b, p, a, 0, n * 4); p += n * 4; return a; }
                Str(); int size = I32(), count = I32();
                var list = new List<(string, uint[])>();
                for (int i = 0; i < count; i++) list.Add((Str(), U32()));
                return (size, list);
            }
        }
    }

    public class Drops
    {
        public class Drop { public Item Item; public double X, Y, Vx, Vy, T, Hold, Cx, Cy; public bool Landed, Got, Warned, HasCenter; }
        public readonly List<Drop> List = new List<Drop>();
        double clock;
        static readonly uint OUTLINE = Col.Hex("#1a1424");
        class BeamDef { public uint[] Px; public uint Light; public int H, W; }
        static BeamDef Bm(string a, string b, string c, int h, int w) => new BeamDef { Px = new[] { Col.Hex(a), Col.Hex(b), Col.Hex(c) }, Light = Col.Hex(a), H = h, W = w };
        static readonly Dictionary<int, BeamDef> BEAM = new Dictionary<int, BeamDef>
        {
            [Items.FINE] = Bm("#0e4018", "#2fa040", "#b4f8a0", 34, 1),
            [Items.RARE] = Bm("#1c3a80", "#3a78e0", "#b8dcff", 56, 1),
            [Items.EPIC] = Bm("#3a1466", "#8a48e0", "#e8c8ff", 80, 1),
            [Items.LEGEND] = Bm("#6a2008", "#e06010", "#ffe0b0", 130, 2),
            [Items.MYTH] = Bm("#6a5010", "#f0d060", "#ffffff", 160, 2),
        };
        static readonly uint[] RING = Items.RARITY.Select(r => Col.Hex(r.Color)).ToArray();

        /// 噴出一件物品。dir 決定往哪邊噴（不給就隨機）
        public void Add(Item item, double x, double y, double? dir = null)
        {
            double vx = (dir ?? (Rnd.Next() < 0.5 ? -1 : 1)) * (25 + Rnd.Next() * 55);
            List.Add(new Drop { Item = item, X = x, Y = y, Vx = vx, Vy = -210 - Rnd.Next() * 70 });
        }
        /// onPick 回傳 true＝撿起來了
        public void Update(double dt, Player player, double radius, GameMap map, Func<Drop, bool> onPick)
        {
            clock += dt;
            foreach (var d in List)
            {
                d.T += dt;
                if (!d.Landed)
                {
                    d.Vy = Math.Min(420, d.Vy + 820 * dt);
                    double prevY = d.Y;
                    d.X = map.MoveX(d.X, d.X + d.Vx * dt, d.Y, 8, 6);
                    d.Y += d.Vy * dt;
                    double? g = d.Vy >= 0 ? map.GroundAt(d.X, prevY, d.Y, false) : null;
                    if (g != null) { d.Y = g.Value; d.Landed = true; }
                }
                if (d.T > 0.45 && Math.Abs(player.X - d.X) < radius && Math.Abs(player.Y - 10 - d.Y) < radius + 14 && onPick(d)) d.Got = true;
            }
            List.RemoveAll(d => d.Got);
        }
        public void Draw(Frame f, double sceneClock)
        {
            foreach (var d in List)
            {
                // 魔物核自己畫（大顆的結晶球＋光＋繞著轉的光點）
                if (d.Item.Kind == "formcore") { (d.Cx, d.Cy) = CoreArt.Draw(f, d.X, d.Y, clock + d.X * 0.01, d.Item.Form, d.Hold); d.HasCenter = true; continue; }
                int r = d.Item.Rarity; double bob = d.Landed ? Pf.Round(Pf.Sin(clock * 3 + d.X) * 1.5) : 0;
                int x = (int)Pf.Round(d.X), y = (int)Pf.Round(d.Y);
                if (BEAM.TryGetValue(r, out var b) && d.Landed) Beam(f, x, y - 4, b, clock + d.X * 0.1);
                Icon(f, d.Item.Icon, x - Icons.S / 2, (int)(y - Icons.S - 2 + bob), r >= Items.FINE && d.Item.Kind != "junk" ? RING[r] : 0);
            }
        }
        static void Icon(Frame f, string name, int x0, int y0, uint ring)
        {
            var src = Icons.Get(name); int S = Icons.S;
            if (src == null) return;
            int bx = x0 - f.Ox, by = y0 - f.Oy;
            for (int j = 0; j < S; j++)
            {
                int y = by + j; if (y < 0 || y >= f.H) continue;
                for (int i = 0; i < S; i++)
                {
                    int x = bx + i; uint c = src[j * S + i];
                    if (c == 0 || x < 0 || x >= f.W) continue;
                    if (c == OUTLINE && ring != 0) c = ring;
                    f.Color[y * f.W + x] = c;
                }
            }
            if (ring != 0)
            {
                int lx = bx + S / 2, ly = by + S / 2;
                if (lx >= 0 && ly >= 0 && lx < f.W && ly < f.H) f.Light[ly * f.W + lx] = ring;
            }
        }
        static void Beam(Frame f, int x, int y, BeamDef b, double t)
        {
            int bx = x - f.Ox, by = y - f.Oy;
            void Put(int px, int py, uint c, bool light = false)
            {
                if (px < 0 || py < 0 || px >= f.W || py >= f.H) return;
                f.Color[py * f.W + px] = c;
                if (light) f.Light[py * f.W + px] = b.Light;
            }
            double solid = Pf.Round(b.H * 0.55); double shift = Math.Floor(t * 12);
            for (int k = 0; k < b.H; k++)
            {
                if (k >= solid)
                {
                    double u = (k - solid) / (b.H - solid), on = Math.Max(1, Pf.Round(5 * (1 - u)));
                    if ((k + shift) % 6 >= on) continue;
                }
                int py = by - k;
                Put(bx, py, b.Px[2], true);
                for (int s = 1; s <= b.W; s++) { Put(bx - s, py, b.Px[1]); Put(bx + s, py, b.Px[1]); }
                if (k < solid * 0.6) { Put(bx - b.W - 1, py, b.Px[0]); Put(bx + b.W + 1, py, b.Px[0]); }
            }
            int rr = b.W + 3 + ((int)Math.Floor(t * 3) & 1);
            for (int dx = -rr + 2; dx <= rr - 2; dx++) { Put(bx + dx, by + 2, b.Px[0]); Put(bx + dx, by + 4, b.Px[0]); }
            Put(bx - rr + 1, by + 3, b.Px[1]); Put(bx + rr - 1, by + 3, b.Px[1]);
            for (int n = 0; n < 3; n++)
            {
                int k = (int)Math.Floor((t * 22 + (n * b.H) / 3.0) % b.H), px = bx + (n - 1) * (b.W + 3);
                Put(px, by - k, b.Px[2], true);
            }
        }
    }

    /// 金幣（main.js 的 coins）：先噴出去，再被吸過來。still＝高處擺好的一堆（主角靠近才吸）；lay＝寶箱噴出來的（落地躺著，靠近才吸）
    public class Coins
    {
        public class Coin { public double X, Y, Vx, Vy, T; public bool Got, Still, Lay; public int Type; }
        public readonly List<Coin> List = new List<Coin>();
        static uint P(char ch) => ch == 'k' ? Col.Hex("#3a1e08") : ch == 'h' ? Col.Hex("#fff2a8") : ch == 'g' ? Col.Hex("#ffc83a") : ch == 'G' ? Col.Hex("#c07c18") : Col.Hex("#6e3c10");
        static readonly uint[][][] FRAMES = new[]
        {
            new[] { ".kkkk.", "khhgGk", "khgGGk", "kggGGk", "kggGHk", "kgGGHk", ".kkkk." },
            new[] { ".kk.", "khgk", "khGk", "kgGk", "kgGk", "kGHk", ".kk." },
            new[] { ".k.", "kGk", "kGk", "kGk", "kGk", "kHk", ".k." },
            new[] { ".kk.", "kgGk", "kgGk", "kgGk", "kGHk", "kGHk", ".kk." },
        }.Select(rows => rows.Select(r => r.Select(ch => ch == '.' ? 0u : P(ch)).ToArray()).ToArray()).ToArray();
        static readonly uint LIGHT = Col.Hex("#8a5a10");

        public void Drop(double x, double y, int n)
        {
            for (int i = 0; i < n; i++) { double vx = (Rnd.Next() - 0.5) * 160, vy = -120 - Rnd.Next() * 140; List.Add(new Coin { X = x, Y = y, Vx = vx, Vy = vy }); }
        }
        /// main.js 的 lootPhysics：落地彈跳；躺在地上時主角靠近才開始吸。回傳 true＝撿到
        public static bool LootPhysics(Coin c, double dt, Player player, GameMap map)
        {
            c.T += dt;
            const double m = 30;
            if (c.Lay)
            {
                c.Vy += 700 * dt;
                double py = c.Y + 2;
                c.X = map.MoveX(c.X, c.X + c.Vx * dt, c.Y + 2, 4, 3);
                c.Y += c.Vy * dt;
                double? gy = c.Vy >= 0 ? map.GroundAt(c.X, py, c.Y + 2) : null;
                if (gy != null) { c.Y = gy.Value - 2; c.Vy *= -0.4; c.Vx *= 0.55; if (Math.Abs(c.Vy) < 30) c.Vy = 0; }
                if (c.T > 0.5 && Math.Abs(player.X - c.X) < m && Math.Abs(player.Y - 10 - c.Y) < m) { c.Lay = false; c.T = 0.45; }
                return false;
            }
            double dx = player.X - c.X, dy = player.Y - 12 - c.Y, d = Pf.Hypot(dx, dy); if (d == 0) d = 1; double s2 = 120 + (c.T - 0.45) * 900;
            c.X += (dx / d) * s2 * dt;
            c.Y += (dy / d) * s2 * dt;
            if (d < 10) { c.Got = true; return true; }
            return false;
        }
        /// 撿到幾枚
        public int Update(double dt, Player player, GameMap map)
        {
            int got = 0;
            foreach (var c in List)
            {
                if (c.Lay) { if (LootPhysics(c, dt, player, map)) got++; continue; }
                c.T += dt;
                if (c.Still)
                {
                    const double m = 34;
                    if (Math.Abs(player.X - c.X) < m && Math.Abs(player.Y - 12 - c.Y) < m) { c.Still = false; c.T = 0.45; }
                    continue;
                }
                if (c.T < 0.45)
                {
                    c.Vy += 700 * dt;
                    double py = c.Y + 2;
                    c.X = map.MoveX(c.X, c.X + c.Vx * dt, c.Y + 2, 4, 3);
                    c.Y += c.Vy * dt;
                    double? gy = c.Vy >= 0 ? map.GroundAt(c.X, py, c.Y + 2) : null;
                    if (gy != null) { c.Y = gy.Value - 2; c.Vy *= -0.45; c.Vx *= 0.6; }
                }
                else
                {
                    double dx = player.X - c.X, dy = player.Y - 12 - c.Y, d = Pf.Hypot(dx, dy); if (d == 0) d = 1; double sp = 120 + (c.T - 0.45) * 900;
                    c.X += (dx / d) * sp * dt;
                    c.Y += (dy / d) * sp * dt;
                    if (d < 10) { c.Got = true; got++; }
                }
            }
            List.RemoveAll(c => c.Got);
            return got;
        }
        public void Draw(Frame f, double time)
        {
            foreach (var c in List)
            {
                var spr = FRAMES[(int)Math.Floor(c.T * 10 + c.X * 0.1) & 3]; int w = spr[0].Length;
                int x = (int)Pf.Round(c.X) - f.Ox - (w >> 1), y = (int)Pf.Round(c.Y + (c.Still ? Pf.Sin(time * 4 + c.X) * 1.5 : 0)) - f.Oy - 3;
                for (int j = 0; j < spr.Length; j++) for (int i = 0; i < spr[j].Length; i++)
                {
                    uint col = spr[j][i]; int px = x + i, py = y + j;
                    if (col != 0 && px >= 0 && py >= 0 && px < f.W && py < f.H) f.Color[py * f.W + px] = col;
                }
                int lx = x + (w >> 1), ly = y + 3;
                if (lx >= 0 && ly >= 0 && lx < f.W && ly < f.H) f.Light[ly * f.W + lx] = LIGHT;
            }
        }
    }

    /// 寶石（寶箱噴出來的，main.js 的 gems）：5×5，左上亮右下暗、一顆高光、外框用最暗那階
    public static class Gems
    {
        public class Type { public string Name; public int Val; public string[] G; public uint[] C; }
        public static readonly Type[] TYPES = new[]
        {
            new Type { Name = "紅寶石", Val = 30, G = new[] { "#2a0612", "#6e0f2a", "#b81c3c", "#f0405a", "#ff8a96", "#ffd2d6" } },
            new Type { Name = "翡翠", Val = 20, G = new[] { "#06200f", "#0f4a26", "#1a8040", "#34c060", "#8af0a0", "#d8ffe0" } },
            new Type { Name = "藍寶石", Val = 25, G = new[] { "#0a1030", "#142a70", "#2050c0", "#3a8cf0", "#8ccaff", "#dcf0ff" } },
            new Type { Name = "紫水晶", Val = 50, G = new[] { "#1a0a2a", "#3e1466", "#6a28a8", "#a050e0", "#d09cff", "#f0e0ff" } },
        }.Select(t => { t.C = t.G.Select(Col.Hex).ToArray(); return t; }).ToArray();
        static readonly string[] ART = { ".4554.", "5w5432", "443321", ".3221.", "..21.." };
        static bool At(int i, int j) => j >= 0 && j < ART.Length && i >= 0 && i < ART[j].Length && ART[j][i] != '.';
        public static void Draw(Frame f, List<Coins.Coin> gems, double time)
        {
            foreach (var g in gems)
            {
                var T = TYPES[g.Type]; int x = (int)Pf.Round(g.X) - f.Ox - 3, y = (int)Pf.Round(g.Y) - f.Oy - 3;
                for (int j = -1; j <= 5; j++) for (int i = -1; i <= 6; i++)
                {
                    int px = x + i, py = y + j;
                    if (px < 0 || py < 0 || px >= f.W || py >= f.H) continue;
                    if (At(i, j)) f.Color[py * f.W + px] = ART[j][i] == 'w' ? 0xffffffffu : T.C[ART[j][i] - '0'];
                    else if (At(i + 1, j) || At(i - 1, j) || At(i, j + 1) || At(i, j - 1)) f.Color[py * f.W + px] = T.C[0];
                }
                double tw = Pf.Sin(time * 5 + g.X * 0.7);
                if (tw > 0.92) foreach (var (dx, dy) in new[] { (0, 0), (1, 0), (-1, 0), (0, 1), (0, -1) }) { int px = x + 1 + dx, py = y + dy; if (px >= 0 && py >= 0 && px < f.W && py < f.H) f.Color[py * f.W + px] = 0xffffffffu; }
                int lx = x + 2, ly = y + 2;
                if (lx >= 0 && ly >= 0 && lx < f.W && ly < f.H) f.Light[ly * f.W + lx] = T.C[4];
            }
        }
    }
}
