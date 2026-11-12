// game/src/props.js 一行一行翻成 C#：場景互動物件。
//   草叢：主角或怪經過會往兩邊倒、像彈簧一樣晃回來；衝刺穿過會飛草屑；可以砍斷，離開畫面一陣子後長回來
//   木箱、垃圾堆：打 2～3 下會碎，碎片四散（onBreak 掉錢）
//   水晶：主角靠近會亮起來、「叮」一聲；黃水晶打 3 下碎、藍水晶打一下噴魔力（onMana）、暗 25 秒再亮
//   落地：踩到地面會揚起一點草屑
// Math.random 一律用 Rnd.Next()，呼叫順序照原本。音效（sfx、blip）用 Opts 裡的回呼。
using System;
using System.Collections.Generic;
using System.Linq;
using PixelFX;

namespace ZeroStar
{
    public class Props
    {
        static uint[] Ramp(params string[] a) => Col.Ramp(a);
        static readonly uint[] GRASS = Ramp("#07120e", "#0e2219", "#163626", "#1f4d35", "#2c6a46", "#3f8c58", "#5cb06c", "#86d488");
        static readonly uint[] TOWN_GRASS = Ramp("#0a160e", "#13281a", "#1c3c24", "#285430", "#386e3c", "#4e8c48", "#6eae5c", "#9ad27a");
        static readonly uint[] WOOD = Ramp("#1a0e08", "#2e1a0e", "#4a2a16", "#6a3e20", "#8e5a30", "#b07a44", "#d0a066", "#ecc890");
        static readonly uint[] TIN = Ramp("#10141c", "#1e2632", "#323e4e", "#4a5868", "#687888", "#8a9aaa", "#b0bece", "#dce6f0");
        static readonly uint[] RUST = Ramp("#1a0c08", "#34160c", "#5a2412", "#84361a", "#a84e24", "#c86e36", "#e0905a", "#f0b888");
        static readonly uint[] RUBBER = Ramp("#08080c", "#121218", "#1c1c24", "#282832", "#363642", "#484856", "#5e5e6e", "#7a7a8a");
        static readonly uint[] CYAN = Ramp("#0e3440", "#14505e", "#1e7080", "#2e8fa8", "#46b4c8", "#6ad4e0", "#a0eef4", "#e0ffff");
        static readonly uint[] GOLD = Ramp("#3a2408", "#6a420e", "#9a6414", "#c88a1c", "#f0b02a", "#ffd04a", "#fff08a", "#fffbe0");
        const double CYAN_DIM = 25;

        static double Rnd2(double a, double b = 0) { double s = Pf.Sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.Floor(s); }
        /// art.js 的 glows：這個顏色是不是會發光的像素（青、暖黃）
        public static bool Glows(uint c) { uint r = c & 255, g = (c >> 8) & 255, b = (c >> 16) & 255; return (g >= 170 && b >= 200 && r < 140) || (r >= 230 && g >= 150 && b < 130); }

        /// 建立時的選項（props.js createProps 的參數＋原本 import 進來的東西）
        public class Opts
        {
            public double Floor, W;
            public List<Platform> Platforms = new List<Platform>();
            public bool Town;
            public List<double> Avoid = new List<double>();
            /// 地面段（map.js surfaceRuns）；null＝舊的一條地板
            public List<(double x0, double x1, double y)> Runs;
            /// floorFn(x, y)：那裡往下的地面（大地圖）；null＝用 Floor 和 Platforms
            public Func<double, double, double> FloorFn;
            public List<BigCrystal> BigCrystals = new List<BigCrystal>();
            public FxSystem Fx;                                   // poof（"poof" 要在 FxSystem 的 DEFS 裡）、shake
            public Action<string> Sfx;                            // audio.js sfx(name)
            public Action<double, string, double> Blip;           // dialog.js blip(頻率, 波形)；第三個是延遲毫秒（JS 用 setTimeout）
            public Action<double, double, double, bool> HitFx;    // combatfx.js hitFx(x, y, dir, heavy)
        }

        public class Blade { public double dx, h, lean, t; }
        public class Tuft { public double x, y, bend, vel, cutT; public Blade[] blades; public bool cut, near; }
        public class Box { public double x, y, cool, shakeT, seed; public string type; public int hp; public bool broken; }
        public class Crystal
        {
            public double x, y, glow, cool, dimT, shakeT, ax, ay; public string col; public int big, hp; public bool broken, chimed;
            public Img art; public double? hgt;
        }
        class Bit { public double x, y, vx, vy, life, ph; public uint col, dark; public bool leaf, big, rest; }

        public readonly List<Tuft> Tufts = new List<Tuft>();
        public readonly List<Box> Boxes = new List<Box>();
        public readonly List<Crystal> Crystals = new List<Crystal>();
        readonly List<Bit> bits = new List<Bit>();
        /// 木箱、垃圾堆碎掉（main.js 掉錢、掉裝備）
        public Action<Box> OnBreakBox;
        /// 黃水晶碎掉（main.js 掉錢）
        public Action<Crystal> OnBreakCrystal;
        /// 藍水晶打出魔力
        public Action<Crystal> OnMana;

        readonly Opts o; readonly uint[] grassPal; readonly bool town; readonly double floor;

        public Props(Opts opts)
        {
            o = opts; town = o.Town; floor = o.Floor;
            grassPal = town ? TOWN_GRASS : GRASS;
            Func<double, double, bool> clear = (x, r) => o.Avoid.All(a => Math.Abs(a - x) > r);

            // ---- 草叢：每叢 3～6 根草，高低不一
            void AddTuft(double x, double y, double k)
            {
                int n = 3 + (int)Math.Floor(Rnd2(k, 1) * 4); var blades = new Blade[n];
                for (int i = 0; i < n; i++) blades[i] = new Blade { dx = i * 2 - n + 1 + Pf.Round(Rnd2(k, i + 10) - 0.5), h = 4 + Math.Floor(Rnd2(k, i + 20) * (town ? 5 : 7)), lean = Rnd2(k, i + 30) * 2 - 1, t = 4 + Math.Floor(Rnd2(k, i + 40) * 3) };
                Tufts.Add(new Tuft { x = x, y = y, blades = blades, bend = 0, vel = 0, cut = false, cutT = 0, near = false });
            }
            foreach (var R in o.Runs ?? new List<(double, double, double)> { (0, o.W, floor) })
                for (double x = R.x0 + 30, k = R.x0 + R.y; x < R.x1 - 30; k++)
                {
                    if (clear(x, 14)) AddTuft(x, R.y, k);
                    x += 14 + Math.Floor(Rnd2(k, 2) * 30);
                }
            for (int j = 0; j < o.Platforms.Count; j++) { var p = o.Platforms[j]; for (double x = p.X + 8; x < p.X + p.W - 8; x += 18 + Math.Floor(Rnd2(j, x) * 14)) AddTuft(x, p.Y, 900 + j * 31 + x); }

            // ---- 可以打破的東西、水晶（城鎮不能打，只放草）
            if (!town && o.Runs != null)
            {
                // 大地圖：每段地面每 200～330 擺一個木箱或垃圾堆，每 ~450 一叢水晶（段太短的不擺）
                int n = 0;
                foreach (var R in o.Runs)
                {
                    if (R.x1 - R.x0 < 80) continue;
                    for (double x = R.x0 + 60 + Math.Floor(Rnd2(R.x0, R.y) * 80); x < R.x1 - 40; x += 200 + Math.Floor(Rnd2(x, R.y) * 130), n++)
                    {
                        if (!clear(x, 20)) continue;
                        if (n % 3 == 2) Crystals.Add(new Crystal { x = x, y = R.y, col = n % 2 != 0 ? "cyan" : "gold", big = n % 4 == 0 ? 1 : 0, glow = 0, broken = false, cool = 0, hp = 2, chimed = false, dimT = 0 });
                        else { string type = n % 2 != 0 ? "junk" : "crate"; Boxes.Add(new Box { x = x, y = R.y, type = type, hp = type == "crate" ? 2 : 3, cool = 0, shakeT = 0, broken = false, seed = x }); }
                    }
                }
            }
            else if (!town)
            {
                foreach (var (x, type) in new[] { (262.0, "crate"), (404, "junk"), (770, "crate"), (962, "junk"), (1150, "crate"), (1432, "junk"), (1604, "crate"), (1876, "junk"), (2010, "crate"), (2140, "junk") })
                    if (x < o.W - 40 && clear(x, 20)) Boxes.Add(new Box { x = x, y = floor, type = type, hp = type == "crate" ? 2 : 3, cool = 0, shakeT = 0, broken = false, seed = x });
                foreach (var (x, col, big) in new[] { (560.0, "cyan", 1), (1280, "gold", 1), (1720, "cyan", 0), (2240, "cyan", 1), (880, "gold", 0) })
                    if (x < o.W - 30 && clear(x, 16)) Crystals.Add(new Crystal { x = x, y = floor, col = col, big = big, glow = 0, broken = false, cool = 0, hp = 2, chimed = false });
            }

            if (!town) foreach (var b in o.BigCrystals)
                {
                    // 大水晶：碰撞高度用圖的實際高度；黃的比較硬（3 下）
                    Crystals.Add(new Crystal { x = b.X, y = b.Y, col = b.Col, big = 2, art = b.Img, ax = b.X0, ay = b.Y0, hgt = b.Y - b.Y0, glow = 0, broken = false, cool = 0, hp = 3, chimed = false, dimT = 0, shakeT = 0 });
                }
        }

        // ---- 粒子（草屑、木片、碎片）：自己的小系統，有重力、會在地上彈一下
        void Emit(double x, double y, int n, uint[] pal, double vx = 0, double spread = 90, double up = 110, bool leaf = false, bool big = false, double life = 0.9)
        {
            for (int i = 0; i < n; i++)
            {
                var q = new Bit { x = x, y = y };
                q.vx = vx + (Rnd.Next() - 0.5) * spread; q.vy = -up * (0.4 + Rnd.Next() * 0.8); q.life = life * (0.6 + Rnd.Next() * 0.6);
                q.col = pal[3 + (int)Math.Floor(Rnd.Next() * 4)]; q.dark = pal[2]; q.leaf = leaf; q.big = big; q.ph = Rnd.Next() * 6; q.rest = false;
                bits.Add(q);
            }
        }

        void Blip(double f, string type, double ms = 0) => o.Blip?.Invoke(f, type, ms);
        void Sfx(string n) => o.Sfx?.Invoke(n);

        /// 每一格更新：movers[0] 是主角，其他是怪（x, y, vx, dash）；view＝鏡頭的左右邊
        public void Update(double dt, List<(double x, double y, double vx, bool dash)> movers, (double x0, double x1) view)
        {
            foreach (var t in Tufts)
            {
                // 經過的東西把草往外推：越近、跑越快推越多
                double force = 0;
                foreach (var m in movers)
                {
                    double dx = t.x - m.x;
                    if (Math.Abs(dx) > 14 || Math.Abs(m.y - t.y) > 6) continue;
                    force += Pf.Sign(dx != 0 ? dx : m.vx != 0 ? m.vx : 1) * (1 - Math.Abs(dx) / 14) * (3 + Math.Min(3, Math.Abs(m.vx) / 50));
                    if (m.dash && !t.cut && Rnd.Next() < 0.3) Emit(t.x, t.y - 4, 1, grassPal, vx: m.vx * 0.4, leaf: true, up: 60, life: 1.4);
                }
                // 彈簧：被推開，再晃回來
                t.vel += (force * 440 - t.bend * 260 - t.vel * 14) * dt;
                t.bend = Math.Max(-6, Math.Min(6, t.bend + t.vel * dt));
                if (t.cut && (t.cutT -= dt) <= 0 && (t.x < view.x0 - 20 || t.x > view.x1 + 20)) t.cut = false;   // 離開畫面才長回來
            }
            foreach (var b in Boxes) { b.cool -= dt; b.shakeT -= dt; }
            foreach (var c in Crystals)
            {
                if (c.broken) continue;
                c.cool -= dt; c.shakeT = c.shakeT - dt;
                if (c.dimT > 0 && (c.dimT -= dt) <= 0)
                {
                    // 藍水晶恢復：叮一聲、亮一下
                    c.dimT = 0; c.glow = 1;
                    SceneLight.AddFlash(c.x, c.y - (c.hgt ?? 10) / 2, 70, 2.5, 0.5, "#46d4e8");
                    Blip(1976, "sine", 0); Blip(2637, "sine", 80);
                    Emit(c.x, c.y - (c.hgt ?? 10) / 2, 8, CYAN, spread: 120, up: 120, life: 1);
                }
                bool near = movers.Count > 0 && Math.Abs(movers[0].x - c.x) < 40 && Math.Abs(movers[0].y - c.y) < 40 && !(c.dimT > 0);
                c.glow += ((near ? 1 : 0) - c.glow) * Math.Min(1, dt * (near ? 5 : 1.5));
                if (near && !c.chimed && c.glow > 0.5) { c.chimed = true; Blip(c.col == "gold" ? 1568 : 1976, "sine"); Blip(c.col == "gold" ? 2093 : 2637, "sine", 70); }
                if (!near && c.glow < 0.15) c.chimed = false;
            }
            for (int i = bits.Count - 1; i >= 0; i--)
            {
                var q = bits[i];
                if ((q.life -= dt) <= 0) { bits.RemoveAt(i); continue; }
                if (q.rest) continue;
                q.ph += dt * 9;
                if (q.leaf) { q.vy += 260 * dt; q.vy = Math.Min(q.vy, 40); q.vx *= 1 - 2.5 * dt; q.x += (q.vx + Pf.Sin(q.ph) * 22) * dt; }   // 葉子飄著掉
                else { q.vy += 520 * dt; q.x += q.vx * dt; }
                q.y += q.vy * dt;
                double g = GroundY(q.x, q.y);
                if (q.vy > 0 && q.y >= g) { q.y = g; if (q.leaf || Math.Abs(q.vy) < 60) q.rest = true; else { q.vy *= -0.3; q.vx *= 0.5; } }
            }
        }
        double GroundY(double x, double y)
        {
            if (o.FloorFn != null) return o.FloorFn(x, y - 2);
            double best = floor;
            foreach (var p in o.Platforms) if (x >= p.X && x <= p.X + p.W && y <= p.Y + 2 && p.Y < best) best = p.Y;
            return best;
        }

        /// 攻擊打到：box 是攻擊範圍，dir 是方向。回傳打到幾個（不算怪）
        public int Hit((double x0, double x1, double y0, double y1) box, double dir)
        {
            if (town) return 0;
            int n = 0;
            Func<double, double, double, bool> inBox = (x, y0, y1) => x >= box.x0 - 2 && x <= box.x1 + 2 && y1 >= box.y0 && y0 <= box.y1;
            foreach (var t in Tufts)
            {
                if (t.cut || !inBox(t.x, t.y - 10, t.y)) continue;
                t.cut = true; t.cutT = 6; t.vel += dir * 60;
                if (Rnd.Next() < 0.5) Sfx("grass");
                Emit(t.x, t.y - 4, 7, grassPal, vx: dir * 50, leaf: true, up: 90, life: 1.6);
                Emit(t.x, t.y - 2, 3, grassPal, vx: dir * 80, up: 120);
            }
            foreach (var b in Boxes)
            {
                if (b.broken || b.cool > 0) continue;
                double hgt = b.type == "crate" ? 13 : 11;
                if (!inBox(b.x, b.y - hgt, b.y)) continue;
                b.cool = 0.2; b.shakeT = 0.16; b.hp--; n++;
                Sfx(b.hp <= 0 ? "crate" : b.type == "crate" ? "hitL" : "clank");
                var pal = b.type == "crate" ? WOOD : RUST;
                o.HitFx?.Invoke(b.x - dir * 4, b.y - 7, dir, b.hp <= 0);
                Emit(b.x, b.y - 8, 4, pal, vx: dir * 60, up: 100);
                if (b.hp <= 0)
                {
                    b.broken = true;
                    var po = new FxOptions { Light = 0.2, Seed = Pf.ToInt32(Rnd.Next() * 99), Palette = new[] { "#1a1420", "#3a3040", "#5e5466", "#857a8a", "#aaa0ac", "#d0c8d0" } };
                    o.Fx?.SpawnLive("poof", Pf.Round(b.x), b.y, po, 1.8, back: true);
                    Emit(b.x, b.y - 8, 10, pal, vx: dir * 70, spread: 160, up: 180, big: true, life: 2.2);
                    if (b.type == "junk") { Emit(b.x, b.y - 6, 5, TIN, vx: dir * 40, spread: 140, up: 160, big: true, life: 2); Emit(b.x, b.y - 6, 3, RUBBER, spread: 120, up: 120, big: true, life: 2); }
                    o.Fx?.Shake(0.12, 1.5);
                    OnBreakBox?.Invoke(b);
                }
            }
            foreach (var c in Crystals)
            {
                if (c.broken || c.cool > 0) continue;
                double hgt = c.hgt ?? (c.big != 0 ? 16 : 11), my = c.y - hgt / 2;
                if (!inBox(c.x, c.y - hgt, c.y)) continue;
                var pal = c.col == "gold" ? GOLD : CYAN; string light = c.col == "gold" ? "#ffd84a" : "#46d4e8";
                if (c.col == "cyan")
                {
                    // 藍水晶：亮著的時候打一下＝噴出魔力（onMana）、暗掉 25 秒；暗著打只會「鏗」一聲
                    c.cool = 0.3; c.shakeT = 0.14; n++;
                    if (c.dimT > 0) { Sfx("clank"); Emit(c.x, my, 2, CYAN, vx: dir * 40, up: 60); continue; }
                    c.dimT = CYAN_DIM; c.glow = 0;
                    Blip(2349, "triangle"); Blip(1760, "sine", 90);
                    SceneLight.AddFlash(c.x, my, 90, 3, 0.5, light);
                    Emit(c.x, my, 12, CYAN, vx: dir * 30, spread: 180, up: 170, life: 1.4);
                    o.HitFx?.Invoke(c.x - dir * 4, my, dir, false);
                    OnMana?.Invoke(c);
                    continue;
                }
                c.cool = 0.2; c.hp--; c.glow = 1; c.shakeT = 0.14; n++;
                Blip(c.col == "gold" ? 1760 : 2349, "triangle");
                SceneLight.AddFlash(c.x, my, 50, 2, 0.25, light);
                Emit(c.x, my, c.art != null ? 6 : 3, pal, vx: dir * 60, up: 100);
                if (c.hp <= 0)
                {
                    c.broken = true;
                    SceneLight.AddFlash(c.x, my, c.art != null ? 120 : 90, 3.5, 0.6, light);
                    Emit(c.x, my, c.art != null ? 26 : 14, pal, vx: dir * 50, spread: 220, up: 220, big: true, life: 2.4);
                    Emit(c.x, my - 2, c.art != null ? 14 : 8, pal, spread: 140, up: 160, life: 1.2);
                    Blip(2637, "sine", 0); Blip(2093, "sine", 90); Blip(3136, "sine", 180);
                    o.Fx?.Shake(0.15, 2);
                    OnBreakCrystal?.Invoke(c);
                }
            }
            return n;
        }

        /// 落地：腳下揚起草屑（有草的地方多一點）
        public void Landing(double x, double y, bool hard)
        {
            bool near = Tufts.Any(t => !t.cut && Math.Abs(t.x - x) < 10 && Math.Abs(t.y - y) < 3);
            Emit(x, y - 1, (near ? 5 : 2) + (hard ? 3 : 0), grassPal, spread: 120, up: 70, leaf: near, life: near ? 1.2 : 0.6);
            foreach (var t in Tufts) if (Math.Abs(t.x - x) < 16 && Math.Abs(t.y - y) < 3) t.vel += Pf.Sign(t.x - x != 0 ? t.x - x : 1) * (hard ? 50 : 25);
        }

        /// 水晶的光（靠近時變亮）
        public void Lights(List<LightSrc> list)
        {
            foreach (var c in Crystals)
            {
                if (c.broken) continue;
                double dim = c.dimT > 0 ? 0.15 : 1, big = c.art != null ? 1.6 : 1;   // 暗掉的藍水晶幾乎不亮
                list.Add(new LightSrc(c.x, c.y - (c.hgt.HasValue && c.hgt.Value != 0 ? c.hgt.Value * 0.45 : c.big != 0 ? 8 : 5), (22 + c.glow * 26) * big, (0.5 + c.glow * 1.8) * dim * (c.art != null ? 1.3 : 1), c.col == "gold" ? "#ffd27a" : "#46d4e8"));
            }
        }

        public delegate void PutFn(double x, double y, uint[] pal, double t, double emissive = 0);

        /// 畫：跟遊玩層一樣，色階位置加上光照（lv 是畫布座標的亮度，可以是 null）
        /// part：-1 全部、0 草、1 木箱和水晶、2 碎片
        public void Draw(Frame frame, float[] lv, int part = -1)
        {
            int Wf = frame.W, Hf = frame.H; var C = frame.Color; int ox = frame.Ox, oy = frame.Oy;
            PutFn put = (x, y, pal, t, emissive) =>
            {
                int sx = (int)Pf.Round(x) - ox, sy = (int)Pf.Round(y) - oy;
                if (sx < 0 || sy < 0 || sx >= Wf || sy >= Hf) return;
                int i = sy * Wf + sx; double l = lv != null ? lv[i] : 1;
                C[i] = pal[(int)Math.Max(0, Math.Min(7, Pf.Round(t + Math.Min(2.5, l) * (emissive != 0 ? 0.4 : 0.9) + emissive)))];
            };
            double x0 = ox - 30, x1 = ox + Wf + 30;
            if (part <= 0) foreach (var t in Tufts)
            {
                if (t.x < x0 || t.x > x1) continue;
                foreach (var b in t.blades)
                {
                    double h = t.cut ? 2 : b.h;
                    for (int r = 0; r < h; r++)
                    {
                        double k = r / Math.Max(1, b.h - 1);   // 越上面彎越多（根部不動）
                        double off = Pf.Round((t.bend + b.lean * 1.2) * k * k);
                        double tone = r == h - 1 && !t.cut ? b.t + 1 : r < 2 ? b.t - 2 : b.t - (r < h / 2 ? 1 : 0);
                        put(t.x + b.dx + off, t.y - 1 - r, grassPal, tone - 2);
                    }
                }
            }
            if (part == 0 || part == 2) goto Bits;
            foreach (var b in Boxes)
            {
                if (b.broken || b.x < x0 || b.x > x1) continue;
                double sx = b.shakeT > 0 ? (Math.Floor(b.shakeT * 60) % 2 != 0 ? 1 : -1) : 0;
                if (b.type == "crate") DrawCrate(put, b.x + sx, b.y, b.hp);
                else DrawJunk(put, b.x + sx, b.y, b.hp);
            }
            foreach (var c in Crystals)
            {
                if (c.broken || c.x < x0 - 30 || c.x > x1 + 30) continue;
                double sx = c.shakeT > 0 ? (Math.Floor(c.shakeT * 60) % 2 != 0 ? 1 : -1) : 0;
                if (c.art != null) { DrawArtCrystal(frame, lv, c, sx); continue; }
                if (c.dimT > 0) { DrawCrystal((x, y, pal, t, e) => put(x, y, pal, t - 2, 0), c.x + sx, c.y, c.big, CYAN, 0, c.hp); continue; }
                DrawCrystal(put, c.x + sx, c.y, c.big, c.col == "gold" ? GOLD : CYAN, c.glow, c.hp);
            }
        Bits:
            if (part == 1) return;
            foreach (var q in bits)
            {
                bool blink = q.life < 0.3 && Math.Floor(q.life * 20) % 2 != 0;   // 快消失時閃一下
                if (blink) continue;
                put(q.x, q.y, new[] { q.col, q.col, q.col, q.col, q.col, q.col, q.col, q.col }, 0);
                if (q.big) put(q.x + 1, q.y, new[] { q.dark, q.dark, q.dark, q.dark, q.dark, q.dark, q.dark, q.dark }, 0);
            }
        }

        /// 大水晶：照原本的圖畫，暗處跟著場景光暗一點，發光的像素保持亮；被打過（黃）多幾道裂痕、暗掉的藍水晶整顆變暗變灰
        void DrawArtCrystal(Frame frame, float[] lv, Crystal c, double sx)
        {
            var img = c.art; int Wf = frame.W, Hf = frame.H; var C = frame.Color; var L = frame.Light; int ox = frame.Ox, oy = frame.Oy;
            bool dim = c.dimT > 0; double k0 = c.glow * 0.25;
            for (int y = 0; y < img.H; y++) for (int x = 0; x < img.W; x++)
                {
                    uint v = img.Px[y * img.W + x]; if (v == 0) continue;
                    double X = c.ax + x + sx - ox, Y = c.ay + y - oy;
                    if (X < 0 || Y < 0 || X >= Wf || Y >= Hf) continue;
                    int i = (int)(Y * Wf + X); bool g = Glows(v);
                    double r = v & 255, gg = (v >> 8) & 255, b = (v >> 16) & 255;
                    if (dim) { double m = (r + gg + b) / 3; r = (r * 0.35 + m * 0.25) * 0.6; gg = (gg * 0.35 + m * 0.25) * 0.6; b = (b * 0.4 + m * 0.25) * 0.7; }
                    else if (!g) { double l = lv != null ? Math.Min(1.6, lv[i]) : 1, f = 0.62 + l * 0.3 + k0; r *= f; gg *= f; b *= f; }
                    else { double f = 1 + k0; r *= f; gg *= f; b *= f; }
                    uint outc = 0xff000000u | ((uint)Math.Min(255, Pf.Round(b)) << 16) | ((uint)Math.Min(255, Pf.Round(gg)) << 8) | (uint)Math.Min(255, Pf.Round(r));
                    C[i] = outc;
                    if (g && !dim) L[i] = outc;
                }
            // 黃水晶被打過：從中間往外的白色裂痕（剩 2 下＝一條、剩 1 下＝三條）
            if (c.col == "gold" && c.hp < 3)
            {
                double cx = c.x + sx, cy = c.y - Pf.Round(c.hgt.Value * 0.45); int n = c.hp == 2 ? 1 : 3;
                for (int m = 0; m < n; m++)
                {
                    double a = -1.2 + m * 1.1;
                    for (int d = 0; d < 9; d++)
                    {
                        int X = (int)Pf.Round(cx + Pf.Cos(a) * d + (d % 3 == 1 ? 1 : 0)) - ox, Y = (int)Pf.Round(cy + Pf.Sin(a) * d * 1.2) - oy;
                        if (X >= 0 && Y >= 0 && X < Wf && Y < Hf && (C[Y * Wf + X] >> 24) != 0) C[Y * Wf + X] = d < 3 ? 0xffe0fbffu : 0xff7ad8ffu;
                    }
                }
            }
        }

        // 木箱 14×13：外框深、木板一條一條、斜撐，左上亮右下暗；被打過會多裂痕
        static void DrawCrate(PutFn put, double cx, double by, int hp)
        {
            double L = Pf.Round(cx) - 7, T = by - 13;
            for (int y = 0; y < 13; y++) for (int x = 0; x < 14; x++)
                {
                    bool edge = x == 0 || y == 0 || x == 13 || y == 12;
                    bool frameBand = x <= 1 || x >= 12 || y <= 1 || y >= 11;
                    bool diag = Math.Abs((x - 1) - (y - 1) * 11 / 10.0) < 1;
                    int t = edge ? 1 : frameBand || diag ? 4 : (y % 4 == 3 ? 2 : 3);
                    if (!edge && (x == 1 || y == 1)) t += 1;
                    if (!edge && (x == 12 || y == 11)) t -= 1;
                    if (hp < 2 && !edge && ((x == 8 && y > 3 && y < 9) || (x == 9 && y > 5 && y < 8))) t = 0;   // 裂痕
                    put(L + x, T + y, WOOD, t - 1);
                }
        }
        // 垃圾堆 20×11：鐵罐、輪胎、木板疊成一小堆
        static void DrawJunk(PutFn put, double cx, double by, int hp)
        {
            double L = Pf.Round(cx) - 10;
            // 底下的土堆
            for (int x = 0; x < 20; x++) { double h = Pf.Round(4 - Math.Abs(x - 9.5) / 3); for (int y = 0; y < h; y++) put(L + x, by - 1 - y, RUST, y == h - 1 ? 2 : 1); }
            // 輪胎（左）
            for (int y = 0; y < 7; y++) for (int x = 0; x < 8; x++)
                {
                    double dx = x - 3.5, dy = y - 3, d = Pf.Hypot(dx, dy * 1.1);
                    if (d > 3.8 || d < 1.6) continue;
                    put(L + 1 + x, by - 9 + y, RUBBER, d > 3.1 ? 1 : dx + dy < 0 ? 5 : 3);
                }
            // 鐵罐（中，被打過會凹）
            for (int y = 0; y < 8; y++) for (int x = 0; x < 5; x++)
                {
                    if (hp < 3 && x == 4 && y > 2 && y < 6) continue;
                    put(L + 9 + x, by - 10 + y, TIN, x == 0 ? 5 : x == 4 || y == 7 ? 2 : y == 0 ? 6 : y == 3 ? 2 : 4);
                }
            // 木板（右，斜靠）
            for (int i = 0; i < 9; i++) { put(L + 14 + Math.Floor(i / 2.0), by - 2 - i, WOOD, 4); put(L + 15 + Math.Floor(i / 2.0), by - 2 - i, WOOD, 2); }
            if (hp < 2) put(L + 11, by - 6, TIN, 0);
        }
        // 水晶：三根尖柱，中間最高；靠近時整個變亮（emissive）
        static readonly int[][] CRYS = { new[] { -4, 9, 2 }, new[] { 0, 15, 3 }, new[] { 4, 10, 2 } };
        static void DrawCrystal(PutFn put, double cx, double by, int big, uint[] pal, double glow, int hp)
        {
            double S = big != 0 ? 1 : 0.7;
            foreach (var col in CRYS)
            {
                int dx = col[0]; double h0 = col[1], wd = col[2];
                double h = Pf.Round(h0 * S);
                for (int r = 0; r < h; r++)
                {
                    double w = Math.Max(0, Pf.Round(wd * (1 - r / h) + (r < h - 2 ? 0.6 : 0)));
                    for (double x = -w; x <= w; x++)
                    {
                        int t = x < 0 ? 5 : x == 0 ? 6 : 3;
                        if (hp < 2 && dx == 0 && r == Pf.Round(h * 0.5) && x == 0) continue;   // 裂一條
                        put(cx + dx + x, by - 1 - r, pal, t - 2, 0.3 + glow * 1.1);
                    }
                }
            }
        }
    }

    /// map.js 的 surfaceRuns(minAir)：每一段上面有 minAir 以上空間的地面 { x0, x1, y }（用 GameMap.SolidAt 讀同一張格子）。
    /// main.js：RUNS = surfaceRuns(32).filter(R => R.y > 40 && R.x1 - R.x0 >= 24)，要在 createFeatures（會加實心）之前算。
    public static class StageRuns
    {
        public static List<(double x0, double x1, double y)> SurfaceRuns(GameMap map, double minAir = 32)
        {
            const int TILE = GameMap.TILE;
            int gw = (int)Math.Ceiling(map.W / TILE), gh = (int)Math.Ceiling(map.H / TILE), need = (int)Math.Ceiling(minAir / TILE);
            bool Solid(int tx, int ty) => map.SolidAt(tx * TILE + 0.5, ty * TILE + 0.5);
            var runs = new List<(double x0, double x1, double y)>();
            for (int ty = 1; ty < gh; ty++)
            {
                bool has = false; double cx0 = 0, cx1 = 0, cy = 0;
                for (int tx = 0; tx < gw; tx++)
                {
                    bool ok = Solid(tx, ty);
                    for (int k = 1; ok && k <= need; k++) if (ty - k >= 0 && Solid(tx, ty - k)) ok = false;
                    if (ok) { if (has) cx1 = (tx + 1) * TILE; else { has = true; cx0 = tx * TILE; cx1 = (tx + 1) * TILE; cy = ty * TILE; } }
                    else if (has) { runs.Add((cx0, cx1, cy)); has = false; }
                }
                if (has) runs.Add((cx0, cx1, cy));
            }
            return runs;
        }
        /// main.js 的 RUNS
        public static List<(double x0, double x1, double y)> MainRuns(GameMap map) => SurfaceRuns(map, 32).Where(R => R.y > 40 && R.x1 - R.x0 >= 24).ToList();
    }
}
