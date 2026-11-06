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

    /// 金幣（main.js 的 coins）：先噴出去，再被吸過來
    public class Coins
    {
        public class Coin { public double X, Y, Vx, Vy, T; public bool Got; }
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
        /// 撿到幾枚
        public int Update(double dt, Player player, GameMap map)
        {
            int got = 0;
            foreach (var c in List)
            {
                c.T += dt;
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
        public void Draw(Frame f)
        {
            foreach (var c in List)
            {
                var spr = FRAMES[(int)Math.Floor(c.T * 10 + c.X * 0.1) & 3]; int w = spr[0].Length;
                int x = (int)Pf.Round(c.X) - f.Ox - (w >> 1), y = (int)Pf.Round(c.Y) - f.Oy - 3;
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
}
