// game/src/scenery.js 一行一行翻成 C#：場景互動第二階段。
//   小生物：城鎮的小鳥、洞窟的光蛾停在地上，主角靠近或打到附近就受驚飛走，過一陣子再飛回來
//           螢火蟲一群一群繞著飛，主角經過會散開，之後慢慢聚回來
//   垂掛物：平台底下的藤蔓（碰到、打到會晃）、從洞頂吊下來的燈（打到會盪，光跟著晃）
//   水窪：走過去濺水花、落地有大水花，洞頂偶爾滴水，水面一圈一圈的漣漪
// Math.random 一律用 Rnd.Next()；performance.now() 用 Opts.NowMs（追蹤測試時要固定）。
using System;
using System.Collections.Generic;
using System.Linq;
using PixelFX;

namespace ZeroStar
{
    /// 水窪（scenery 建、hazards 讀：怪踩進去變潮濕）
    public class Puddle { public double x, w, y, stepD, dripT; }

    public class Scenery
    {
        static uint C(string s) => Col.Hex(s);
        static uint[] Ramp(params string[] a) => Col.Ramp(a);
        static readonly uint OUT = C("#120c1a");
        static readonly uint[] WATER = Ramp("#08121e", "#0e2034", "#16324e", "#20486c", "#2e6690", "#4a8cb4", "#7ab8d8", "#c8ecf8");
        static readonly uint[] DROP = Ramp("#2a7fc4", "#45a9e3", "#86d3f5", "#cdf1ff");
        static readonly uint[] VINE = Ramp("#07120e", "#0e2219", "#163626", "#1f4d35", "#2c6a46", "#3f8c58", "#5cb06c", "#86d488");
        static readonly uint[] CHAIN = Ramp("#14141c", "#262632", "#3a3a4a", "#565668", "#7a7a8e", "#a0a0b4");
        static readonly uint[] LAMP = Ramp("#3a1a06", "#7a3a0c", "#c06a14", "#f0a030", "#ffd060", "#fff2b0");
        static readonly uint[] FLY = { C("#9ad02a"), C("#d6ff5a"), C("#f4ffb8") }; static readonly uint FLY_LIGHT = C("#5a7a1a");
        static readonly uint BULB = C("#a0eef4"), BULB_LIGHT = C("#1e7080"), LAMP_GLOW = C("#7a3a0c");
        static double Rnd2(double a, double b = 0) { double s = Pf.Sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.Floor(s); }

        // ---- 生物的小圖：材質格 → 上色（左上亮、右下暗）→ 1px 外框。mats：一個顏色（長度 1）或 3 階 [暗, 中, 亮]
        class Spr { public uint[][] px; public int W, H; }
        static Spr Sprite(string[] rows, Dictionary<char, uint[]> mats)
        {
            int H = rows.Length, W = rows[0].Length;
            bool Empty(int x, int y) => x < 0 || y < 0 || x >= W || y >= H || rows[y][x] == '.';
            var px = new uint[H + 2][]; for (int y = 0; y < H + 2; y++) px[y] = new uint[W + 2];
            for (int y = 0; y < H; y++) for (int x = 0; x < W; x++)
                {
                    char k = rows[y][x];
                    if (k == '.') continue;
                    var R = mats[k];
                    if (R.Length == 1) { px[y + 1][x + 1] = R[0]; continue; }
                    bool Diff(int a, int b) => Empty(a, b) || rows[b][a] != k;
                    int t = 1;
                    if (Diff(x - 1, y) || Diff(x, y - 1)) t = 2;
                    else if (Diff(x + 1, y) || Diff(x, y + 1)) t = 0;
                    px[y + 1][x + 1] = R[t];
                }
            uint At(int x, int y) => y >= 0 && y < H + 2 && x >= 0 && x < W + 2 ? px[y][x] : 0;
            for (int y = 0; y < H + 2; y++) for (int x = 0; x < W + 2; x++)
                {
                    if (px[y][x] != 0) continue;
                    foreach (var (a, b) in new[] { (1, 0), (-1, 0), (0, 1), (0, -1) })
                    {
                        uint q = At(x + a, y + b);
                        if (q != 0 && q != OUT) { px[y][x] = OUT; break; }
                    }
                }
            return new Spr { px = px, W = W + 2, H = H + 2 };
        }
        // 小鳥（面向右）：b 身體、r 胸口、k 嘴、e 眼睛、l 腳、w 翅膀
        static readonly Dictionary<char, uint[]> BIRD_M = new Dictionary<char, uint[]> { ['b'] = Ramp("#5a3a22", "#8a5a32", "#b88452"), ['r'] = Ramp("#a8441c", "#e8783a", "#ffb070"), ['w'] = Ramp("#4a2e1a", "#6e4626", "#9a6a3e"), ['k'] = new[] { C("#ffc040") }, ['e'] = new[] { C("#120c1a") }, ['l'] = new[] { C("#3a2418") } };
        static readonly Spr BIRD_SIT = Sprite(new[] { "...bb..", "..bbbek", ".bbbbb.", "bbwwrr.", ".bwwrr.", "..l.l.." }, BIRD_M);
        static readonly Spr BIRD_PECK = Sprite(new[] { ".......", "..bb...", ".bbbb..", "bbwwbbe", ".bwwrrk", "..l.l.." }, BIRD_M);
        static readonly Spr BIRD_UP = Sprite(new[] { ".ww....", "..ww...", "..wbbb.", ".bbbbek", "bbbrrr.", "..rr..." }, BIRD_M);
        static readonly Spr BIRD_DOWN = Sprite(new[] { "...bbb.", "..bbbek", "bbbbrr.", "..wwr..", ".ww....", "ww....." }, BIRD_M);
        // 光蛾：g 發光的翅膀、d 身體
        static readonly Dictionary<char, uint[]> MOTH_M = new Dictionary<char, uint[]> { ['g'] = Ramp("#2e8fa8", "#6ad4e0", "#c8f8ff"), ['d'] = Ramp("#2a2440", "#3e3660", "#5a5088") };
        static readonly Spr MOTH_SIT = Sprite(new[] { ".g.g.", "ggdgg", ".gdg.", "..d.." }, MOTH_M);
        static readonly Spr MOTH_OPEN = Sprite(new[] { "gg.gg", "ggdgg", "gg.gg" }, MOTH_M);
        static readonly Spr MOTH_SHUT = Sprite(new[] { "..d..", ".gdg.", ".gdg.", "..d.." }, MOTH_M);
        static readonly string[] LAMP_ROWS = { "..ooo..", ".occco.", "oglllgo", "ogllLgo", "ogllLgo", "oglllgo", ".occco.", "..ooo.." };

        public class Opts
        {
            public double Floor, W;
            public List<Platform> Platforms = new List<Platform>();
            public bool Town, NoPuddles;
            public List<(double x0, double x1, double y)> Runs;
            public FxSystem Fx;               // 大水花（"splash" 要在 FxSystem 的 DEFS 裡）
            public Action<string> Sfx;
            public Func<double> NowMs;        // performance.now()（垂掛物的風）
        }

        public class Critter { public string kind, state; public double hx, x, y, fy, vx, vy, face, t, gone, flap; }
        public class Fly { public double ox, oy, x, y, vx, vy, ph, sp; }
        public class Swarm { public double x, y; public List<Fly> flies; }
        public class Hang { public string kind; public double x, y, len, a, av, ph; public bool bulb; }
        class Drop { public double x, y, vx, vy, life; public double? fy; public uint col; public Puddle drip; }
        class RingQ { public Puddle pd; public double x, r, life, max; }

        public readonly List<Critter> Critters = new List<Critter>();
        public readonly List<Swarm> Swarms = new List<Swarm>();
        public readonly List<Hang> Hangs = new List<Hang>();
        public readonly List<Puddle> Puddles = new List<Puddle>();
        readonly List<Drop> drops = new List<Drop>();
        readonly List<RingQ> rings = new List<RingQ>();
        readonly Opts o; readonly double floor;

        public Scenery(Opts opts)
        {
            o = opts; floor = o.Floor; bool town = o.Town; var runs = o.Runs;
            // ---- 水窪（關卡）：x 是中心
            if (o.NoPuddles) { /* 1-1 只留黏液和火焰：會讓怪潮濕的水窪拿掉 */ }
            else if (!town && runs != null) { for (int i = 0; i < runs.Count; i++) { var R = runs[i]; if (R.x1 - R.x0 >= 120 && i % 3 == 1) { double x = Pf.Round((R.x0 + R.x1) / 2 + (Rnd2(i, 4) - 0.5) * 40); Puddles.Add(new Puddle { x = x, w = 26 + Math.Floor(Rnd2(i, 5) * 10), y = R.y, stepD = 0, dripT = 1 + Rnd2(x) * 3 }); } } }
            else if (!town) foreach (var (x, pw) in new[] { (470.0, 30.0), (1010, 34), (1360, 26), (1800, 32), (2075, 28) }) if (x < o.W - 30) Puddles.Add(new Puddle { x = x, w = pw, y = floor, stepD = 0, dripT = 1 + Rnd2(x) * 3 });

            // ---- 小生物
            var homes = town ? new double[] { 118, 282, 640, 870, 960 } : new double[] { 350, 905, 1235, 1490, 1955, 2190 };
            List<(double x, double y)> homeAt;
            if (runs != null)
            {
                var f = new List<(double, double, double)>(); for (int i = 0; i < runs.Count; i++) if (runs[i].x1 - runs[i].x0 >= 60 && i % 2 == 0) f.Add(runs[i]);
                homeAt = f.Select((R, i) => (Pf.Round(R.Item1 + (R.Item2 - R.Item1) * (0.3 + Rnd2(i, 6) * 0.4)), R.Item3)).ToList();
            }
            else homeAt = homes.Select(x => (x, floor)).ToList();
            for (int i = 0; i < homeAt.Count; i++) { var (x, fy) = homeAt[i]; if (x < o.W - 20) Critters.Add(new Critter { kind = town ? "bird" : "moth", hx = x, x = x, y = fy, fy = fy, vx = 0, vy = 0, face = i % 2 != 0 ? -1 : 1, state = "sit", t = Rnd2(i, 3) * 3, gone = 0, flap = 0 }); }
            // 螢火蟲群
            List<(double x, double y)> swarmAt;
            if (town) swarmAt = new List<(double, double)> { (300, 150), (720, 140), (930, 156) };
            else if (runs != null) { swarmAt = new List<(double, double)>(); for (int i = 0; i < runs.Count; i++) if (runs[i].x1 - runs[i].x0 >= 100 && i % 3 == 0) swarmAt.Add((Pf.Round((runs[i].x0 + runs[i].x1) / 2), runs[i].y - 30)); }
            else swarmAt = new List<(double, double)> { (700, 156), (1180, 150), (1660, 160), (2150, 150) };
            foreach (var (x, y) in swarmAt) if (x < o.W - 20)
                {
                    var flies = new List<Fly>();
                    for (int i = 0; i < 7; i++) flies.Add(new Fly { ox = (Rnd2(x, i) - 0.5) * 36, oy = (Rnd2(x, i + 9) - 0.5) * 22, x = x + (Rnd2(x, i) - 0.5) * 36, y = y + (Rnd2(x, i + 9) - 0.5) * 22, vx = 0, vy = 0, ph = Rnd2(x, i + 20) * 6, sp = 0.6 + Rnd2(x, i + 30) * 0.8 });
                    Swarms.Add(new Swarm { x = x, y = y, flies = flies });
                }

            // ---- 垂掛物：藤蔓（平台底下）、吊燈（洞頂）
            for (int j = 0; j < o.Platforms.Count; j++)
            {
                var p = o.Platforms[j];
                for (double x = p.X + 6; x < p.X + p.W - 4; x += 11 + Math.Floor(Rnd2(j, x) * 14))
                    Hangs.Add(new Hang { kind = "vine", x = x, y = p.Y + 9, len = 6 + Math.Floor(Rnd2(j, x + 1) * 11), a = 0, av = 0, bulb = Rnd2(j, x + 2) < 0.35, ph = Rnd2(j, x + 3) * 6 });
            }
            if (!town && runs == null) foreach (double x in new double[] { 820, 1560, 2120 }) if (x < o.W - 30) Hangs.Add(new Hang { kind = "lamp", x = x, y = -4, len = 92 + (x % 3) * 6, a = 0, av = 0, ph = x });
        }

        // ---- 粒子：水滴
        void Splash(double x, double y, int n, double dir = 0, double up = 90)
        {
            for (int i = 0; i < n; i++)
            {
                var q = new Drop { fy = y };
                q.x = x + (Rnd.Next() - 0.5) * 4; q.y = y - 1; q.vx = dir * 30 + (Rnd.Next() - 0.5) * 70; q.vy = -up * (0.5 + Rnd.Next() * 0.7); q.life = 0.8; q.col = DROP[1 + (int)Math.Floor(Rnd.Next() * 3)];
                drops.Add(q);
            }
        }
        void Ripple(Puddle pd, double x, bool big = false) => rings.Add(new RingQ { pd = pd, x = x, r = 0, life = big ? 1.4 : 1, max = big ? pd.w / 2 : pd.w / 3 });
        Puddle PuddleAt(double x, double y) => Puddles.FirstOrDefault(p => Math.Abs(p.x - x) < p.w / 2 && Math.Abs(p.y - y) < 2);

        void Scare(Critter c, double fromX)
        {
            if (c.state != "sit") return;
            c.state = "fly";
            c.face = c.x >= fromX ? 1 : -1;
            c.vx = c.face * (60 + Rnd.Next() * 40);
            c.vy = -(70 + Rnd.Next() * 40);
            c.t = 0;
        }

        public void Update(double dt, Player player, (double x0, double x1) view)
        {
            double px = player.X, py = player.Y; bool fast = Math.Abs(player.Vx) > 70 || player.State == "dash";
            // 小生物
            foreach (var c in Critters)
            {
                c.t += dt; c.flap += dt;
                if (c.state == "sit")
                {
                    double d = Math.Abs(px - c.x);
                    if ((d < 34 && Math.Abs(py - c.y) < 40) || (fast && d < 60)) Scare(c, px);
                    // 停著的時候：小鳥偶爾轉身
                    if (c.kind == "bird" && c.t > 2.2) { c.t = 0; if (Rnd.Next() < 0.35) { c.face = -c.face; } }
                }
                else if (c.state == "fly")
                {
                    c.vy -= 30 * dt; c.vx *= 1 + 0.4 * dt;
                    if (c.kind == "moth") c.x += Pf.Sin(c.t * 9) * 30 * dt;   // 光蛾飛得歪歪扭扭
                    c.x += c.vx * dt; c.y += c.vy * dt;
                    if (c.y < -20 || c.x < view.x0 - 60 || c.x > view.x1 + 60) { c.state = "gone"; c.gone = 9 + Rnd.Next() * 8; }
                }
                else if (c.state == "gone")
                {
                    // 主角走遠了才回來，從上面斜斜飛下來停回原位
                    if ((c.gone -= dt) <= 0 && Math.Abs(px - c.hx) > 90) { c.state = "back"; c.x = c.hx + (Rnd.Next() < 0.5 ? -60 : 60); c.y = c.fy - 90; c.face = c.x < c.hx ? 1 : -1; }
                }
                else if (c.state == "back")
                {
                    double dx = c.hx - c.x, dy = c.fy - c.y, d = Pf.Hypot(dx, dy);
                    if (d < 2) { c.state = "sit"; c.x = c.hx; c.y = c.fy; c.t = 0; continue; }
                    double sp = Math.Min(70, d * 2.2);
                    c.x += (dx / d) * sp * dt; c.y += (dy / d) * sp * dt;
                    if (Math.Abs(px - c.x) < 40) { c.state = "sit"; Scare(c, px); }
                }
            }
            // 螢火蟲：跟著自己的「家」繞，被主角推開
            foreach (var s in Swarms) foreach (var f in s.flies)
                {
                    f.ph += dt * f.sp;
                    double tx = s.x + f.ox + Pf.Sin(f.ph * 1.3) * 10, ty = s.y + f.oy + Pf.Cos(f.ph) * 6;
                    f.vx += (tx - f.x) * 1.6 * dt; f.vy += (ty - f.y) * 1.6 * dt;
                    double dx = f.x - px, dy = f.y - (py - 12), d = Pf.Hypot(dx, dy);
                    if (d < 34) { double k = (34 - d) * (fast ? 90 : 55) * dt / Math.Max(4, d); f.vx += dx * k; f.vy += dy * k; }
                    f.vx *= 1 - 1.4 * dt; f.vy *= 1 - 1.4 * dt;
                    f.x += f.vx * dt; f.y += f.vy * dt;
                }
            // 垂掛物：鐘擺；主角穿過藤蔓、身體碰到吊燈都會推一下
            double now = o.NowMs != null ? o.NowMs() : 0;
            foreach (var h in Hangs)
            {
                double L = h.kind == "lamp" ? h.len : h.len * 3;   // 藤蔓擺得比較快
                h.av += (-(900 / L) * Pf.Sin(h.a) - h.av * (h.kind == "lamp" ? 0.5 : 2.2)) * dt;
                h.av += Pf.Sin(now / 900 + h.ph) * (h.kind == "lamp" ? 0.02 : 0.15) * dt;   // 一點點風
                h.a += h.av * dt;
                double tipY = h.y + h.len, tipX = h.x + Pf.Sin(h.a) * h.len;
                if (Math.Abs(px - tipX) < 7 && py - 24 < tipY && py > h.y + (h.kind == "lamp" ? h.len - 8 : 0)) h.av += (player.Vx / 60 + (px < tipX ? 0.4 : -0.4)) * (h.kind == "lamp" ? 1.2 : 3) * dt * 10;
            }
            // 水窪：走路踩水、滴水
            var pd = player.Grounded ? PuddleAt(px, py) : null;
            if (pd != null && Math.Abs(player.Vx) > 20)
            {
                pd.stepD += Math.Abs(player.Vx) * dt;
                if (pd.stepD > 10) { pd.stepD = 0; Splash(px, pd.y, 3, Pf.Sign(player.Vx) * 0.5, 70); Ripple(pd, px); o.Sfx?.Invoke("splash"); }
            }
            foreach (var p in Puddles)
            {
                if (p.x < view.x0 - 40 || p.x > view.x1 + 40) continue;
                if ((p.dripT -= dt) <= 0)
                {
                    p.dripT = 2.5 + Rnd.Next() * 3;
                    drops.Add(new Drop { x = p.x + (Rnd.Next() - 0.5) * p.w * 0.6, y = p.y - 154, vx = 0, vy = 0, life = 3, col = DROP[2], drip = p });
                }
            }
            for (int i = drops.Count - 1; i >= 0; i--)
            {
                var q = drops[i];
                q.vy += 520 * dt; q.x += q.vx * dt; q.y += q.vy * dt;
                if ((q.life -= dt) <= 0) { drops.RemoveAt(i); continue; }
                if (q.drip != null && q.y >= q.drip.y) { Ripple(q.drip, q.x); Splash(q.x, q.drip.y, 2, 0, 50); drops.RemoveAt(i); continue; }
                if (q.drip == null && q.vy > 0 && q.y >= (q.fy ?? floor)) drops.RemoveAt(i);
            }
            for (int i = rings.Count - 1; i >= 0; i--) { var r = rings[i]; r.r += 16 * dt; if ((r.life -= dt) <= 0 || r.r > r.max) rings.RemoveAt(i); }
        }

        /// 攻擊打到附近：小生物嚇跑、垂掛物被打得盪起來
        public void Hit((double x0, double x1, double y0, double y1) box, double dir)
        {
            double cx = (box.x0 + box.x1) / 2;
            foreach (var c in Critters) if (c.state == "sit" && Math.Abs(c.x - cx) < 50) Scare(c, cx);
            foreach (var h in Hangs)
            {
                double tipX = h.x + Pf.Sin(h.a) * h.len, top = h.kind == "lamp" ? h.y + h.len - 10 : h.y, bot = h.y + h.len + (h.kind == "lamp" ? 10 : 0);
                if (tipX >= box.x0 - 4 && tipX <= box.x1 + 4 && bot >= box.y0 && top <= box.y1) h.av += dir * (h.kind == "lamp" ? 0.8 : 2.5);
            }
        }
        /// 落地：落在水窪裡是大水花
        public void Landing(double x, double y, bool hard)
        {
            var pd = PuddleAt(x, y);
            if (pd == null) return;
            Splash(x, pd.y, hard ? 10 : 6, 0, hard ? 150 : 100);
            o.Sfx?.Invoke("splash");
            Ripple(pd, x, true);
            if (hard) o.Fx?.SpawnLive("splash", Pf.Round(x), pd.y + 1, new FxOptions { Light = 0.2, Seed = Pf.ToInt32(Rnd.Next() * 99) }.Set("stone", 0), 2.2);
        }
        public void Lights(List<LightSrc> list)
        {
            foreach (var h in Hangs) if (h.kind == "lamp") list.Add(new LightSrc(h.x + Pf.Sin(h.a) * (h.len + 4), h.y + Pf.Cos(h.a) * (h.len + 4), 64, 2.2, "#ffb050"));
            foreach (var s in Swarms) list.Add(new LightSrc(s.x, s.y, 30, 0.35, "#9ad02a"));
        }

        public void Draw(Frame frame, float[] lv, double time)
        {
            int Wf = frame.W, Hf = frame.H; var Cb = frame.Color; var LB = frame.Light; int ox = frame.Ox, oy = frame.Oy;
            int Idx(double x, double y) { int sx = (int)Pf.Round(x) - ox, sy = (int)Pf.Round(y) - oy; return sx < 0 || sy < 0 || sx >= Wf || sy >= Hf ? -1 : sy * Wf + sx; }
            void Put(double x, double y, uint c, uint glow = 0) { int i = Idx(x, y); if (i < 0) return; Cb[i] = c; if (glow != 0) LB[i] = glow; }
            void Shade(double x, double y, uint[] pal, double t) { int i = Idx(x, y); if (i < 0) return; Cb[i] = pal[(int)Math.Max(0, Math.Min(pal.Length - 1, Pf.Round(t + Math.Min(2, lv[i]) * 0.9)))]; }
            double x0 = ox - 40, x1 = ox + Wf + 40;
            // 水窪：表面一排亮的、下面兩排暗的；左右兩端收窄；漣漪是表面上往外跑的亮點
            foreach (var p in Puddles)
            {
                if (p.x < x0 || p.x > x1) continue;
                double L = Pf.Round(p.x - p.w / 2), R = Pf.Round(p.x + p.w / 2);
                for (double x = L; x <= R; x++)
                {
                    double edge = Math.Min(x - L, R - x);
                    for (int r = 0; r < 3; r++)
                    {
                        if (edge < r) continue;
                        double tw = r == 0 ? 4 + ((x + Math.Floor(time * 3)) % 9 == 0 ? 2 : 0) : 2 - r * 0.5;
                        Shade(x, p.y + r, WATER, tw);
                    }
                }
            }
            foreach (var r in rings)
            {
                int k = r.life > 0.5 ? 7 : 6;
                foreach (double s in new[] { -1.0, 1.0 }) { double x = r.x + s * r.r; if (Math.Abs(x - r.pd.x) < r.pd.w / 2 - 1) Put(x, r.pd.y, WATER[k]); }
            }
            // 垂掛物
            foreach (var h in Hangs)
            {
                if (h.x < x0 || h.x > x1) continue;
                double s = Pf.Sin(h.a), c = Pf.Cos(h.a);
                if (h.kind == "vine")
                {
                    for (int i = 0; i <= h.len; i++)
                    {
                        double k = i / h.len, bend = Pf.Sin(h.a * (0.6 + 0.8 * k));   // 越下面晃越多
                        double x = h.x + bend * i, y = h.y + i * Pf.Cos(h.a * 0.7);
                        Shade(x, y, VINE, i < 2 ? 2 : 3 + (i % 3 == 0 ? 1 : 0));
                        if (i % 4 == 2) Shade(x + (i % 8 == 2 ? 1 : -1), y, VINE, 2);   // 小葉子
                    }
                    if (h.bulb) { double bx = h.x + Pf.Sin(h.a * 1.4) * h.len, by = h.y + h.len + 1; Put(bx, by, BULB, BULB_LIGHT); Put(bx, by + 1, OUT); }
                }
                else
                {
                    for (int i = 0; i < h.len; i++) { double x = h.x + s * i, y = h.y + c * i; Shade(x, y, CHAIN, Math.Floor(i / 2.0) % 2 != 0 ? 2 : 3); }
                    // 燈：蓋子、發光的燈罩、底座（跟著角度歪）
                    double lx = h.x + s * h.len, ly = h.y + c * h.len;
                    for (int j = 0; j < LAMP_ROWS.Length; j++)
                        for (int i = 0; i < LAMP_ROWS[j].Length; i++)
                        {
                            char ch = LAMP_ROWS[j][i];
                            if (ch == '.') continue;
                            double dx = i - 3, dy = j, x = lx + dx * c + dy * s, y = ly - dx * s + dy * c;
                            uint col = ch == 'o' ? OUT : ch == 'c' ? CHAIN[3] : ch == 'g' ? LAMP[2] : ch == 'L' ? LAMP[5] : LAMP[4];
                            Put(x, y, col, ch == 'l' || ch == 'L' ? LAMP_GLOW : 0);
                        }
                }
            }
            // 螢火蟲：亮度一閃一閃，亮的時候寫進光的緩衝
            foreach (var sw in Swarms) foreach (var f in sw.flies)
                {
                    if (f.x < x0 || f.x > x1) continue;
                    double b = 0.5 + 0.5 * Pf.Sin(f.ph * 3 + f.ox);
                    if (b < 0.2) continue;
                    Put(f.x, f.y, FLY[b > 0.75 ? 2 : b > 0.45 ? 1 : 0], FLY_LIGHT);
                }
            // 小生物
            foreach (var c in Critters)
            {
                if (c.state == "gone" || c.x < x0 || c.x > x1) continue;
                Spr s;
                if (c.kind == "bird") s = c.state == "sit" ? (Math.Floor(time * 1.3 + c.hx) % 4 == 0 ? BIRD_PECK : BIRD_SIT) : Math.Floor(c.flap * 14) % 2 != 0 ? BIRD_UP : BIRD_DOWN;
                else s = c.state == "sit" ? (Math.Floor(time * 0.8 + c.hx) % 5 == 0 ? MOTH_OPEN : MOTH_SIT) : Math.Floor(c.flap * 18) % 2 != 0 ? MOTH_OPEN : MOTH_SHUT;
                double bx = Pf.Round(c.x) - (s.W >> 1), by = Pf.Round(c.y) - s.H + 1; bool flip = c.face < 0;
                for (int y = 0; y < s.H; y++) for (int x = 0; x < s.W; x++)
                    {
                        uint col = s.px[y][flip ? s.W - 1 - x : x];
                        if (col != 0) Put(bx + x, by + y, col, c.kind == "moth" && col != OUT ? BULB_LIGHT : 0);
                    }
            }
            foreach (var q in drops) Put(q.x, q.y, q.col);
        }
    }
}
