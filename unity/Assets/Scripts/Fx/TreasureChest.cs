// 網頁版 game/fx/loot/treasure-chest.js 一行一行翻成 C#（模擬特效）：遊戲用的寶箱（pixelfx pickups/chest-open 加上等級）。
// 箱子搖一搖、縫裡漏金光，蓋子彈開，光芒扇形射出，金幣和寶石飛出來、彈跳、閃一下、被收走，最後空箱子化成金粉。
// 選項：Palette（8 階光）、Ramps["wood"]（7 階木頭）、Num["tier"]（0 木箱～3 星箱）、Num["coins"]、Num["gems"]、Seed、Light。
// 遊戲裡（main.js chestOpts）coins、gems 都是 0，只用開箱演出。
using System;
using System.Collections.Generic;
using System.Linq;
using static PixelFX.Pf;

namespace PixelFX.Fx
{
    public static class TreasureChest
    {
        public static readonly FxDef Def = new FxDef
        {
            Name = "Chest open", W = 176, H = 112, OX = 88, OY = 96, Duration = 4.6, Loop = false, Fps = 30,
            Options = new FxOptions { Palette = new[] { "#1e1206", "#4a2c08", "#86520c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff" }, Seed = 3 }
                .Set("wood", new[] { "#110a10", "#24131a", "#3a1f1f", "#552d24", "#73402c", "#925737", "#b07246" }).Set("coins", 12).Set("gems", 4).Set("tier", 0),
            Create = Create,
        };

        // 跟金子一起出來的寶石：紅、綠、藍、紫（暗到亮）
        static readonly uint[][] GEMS =
        {
            Col.Ramp(new[] { "#2a0612", "#6e0f2a", "#b81c3c", "#f0405a", "#ff8a96", "#ffd2d6" }),
            Col.Ramp(new[] { "#06200f", "#0f4a26", "#1a8040", "#34c060", "#8af0a0", "#d8ffe0" }),
            Col.Ramp(new[] { "#0a1030", "#142a70", "#2050c0", "#3a8cf0", "#8ccaff", "#dcf0ff" }),
            Col.Ramp(new[] { "#1a0a2a", "#3e1466", "#6a28a8", "#a050e0", "#d09cff", "#f0e0ff" }),
        };
        const double T_OPEN = 0.8, T_COLLECT = 2.55, T_POOF = 3.3;
        static readonly double[][] RATTLES = { new[] { 0.1, 0.4 }, new[] { 0.32, 0.62 }, new[] { 0.5, 0.8 }, new[] { 0.64, 1.0 } };
        const double CS = 0.94, SN = 0.34;

        /// 各等級的造型（尺寸已經 ×1.3）
        class Shape { public int HW, FH; public double LA, LB; public int[] STRAPS; public string corner, rim, lock_; public bool band, dots, spikes, rivets, goldStraps, glow; }
        const double CHEST_K = 1.3;
        static double K5(double v) => Round(v * CHEST_K * 2) / 2;
        static Shape S(int HW, int FH, double LA, double LB, int[] straps, string corner, string rim, string lk, bool band, bool dots, bool spikes, bool rivets, bool goldStraps = false, bool glow = false)
            => new Shape { HW = (int)Round(HW * CHEST_K), FH = (int)Round(FH * CHEST_K), LA = K5(LA), LB = K5(LB), STRAPS = straps.Select(v => (int)Round(v * CHEST_K)).ToArray(), corner = corner, rim = rim, lock_ = lk, band = band, dots = dots, spikes = spikes, rivets = rivets, goldStraps = goldStraps, glow = glow };
        static readonly Shape[] SHAPES =
        {
            S(10, 7, 5, 3.5, new int[0], "wood", "wood", "latch", false, false, false, false),
            S(12, 9, 6, 5.5, new[] { -9, 7 }, "iron", "iron", "plate", false, false, false, true),
            S(13, 10, 6.5, 7, new[] { -10, 8 }, "gold", "gold", "gem", true, false, false, false, true),
            S(14, 11, 7, 8.5, new[] { -11, 9 }, "gold", "gold", "star", true, true, true, false, true, true),
        };
        static readonly uint[] IRON = Col.Ramp(new[] { "#0e0d16", "#1d1c28", "#2f2e3e", "#474658", "#6a6a7e", "#9898ac" });
        static readonly uint[] RUBY = Col.Ramp(new[] { "#5a0c18", "#b81c3c", "#ff5a6a", "#ffd0d6" });
        static readonly string[] STAR_LOCK = { "...a...", "..aba..", "abbbbba", ".abcba.", ".ab.ba.", "a.....a" };
        static readonly string[] SHARD = { "..a....", ".ab....", ".abb.a.", "abbcab.", "abbcbbc", ".bcccc." };
        static uint Tone(uint[] R, double l, int[] steps) => R[steps[l > 0.6 ? 0 : l > 0.25 ? 1 : l > -0.1 ? 2 : l > -0.45 ? 3 : 4]];

        /// 一個寶箱的畫法（JS 是模組層的全域變數，這裡每個箱子一份；每次畫前都先 setShape，結果一樣）
        class Painter3
        {
            public Shape SH; public int HW, FH; public double HB, LA, LB; public int[] STRAPS;
            public readonly PickupLayer L = new PickupLayer(64, 76);
            public void SetShape(int tier) { SH = tier >= 0 && tier < SHAPES.Length ? SHAPES[tier] : SHAPES[1]; HW = SH.HW; FH = SH.FH; LA = SH.LA; LB = SH.LB; STRAPS = SH.STRAPS; HB = FH / CS; }

            class Row { public int row; public double al, dep, lit; public bool @out, crest, seam; }
            // 蓋子在角度 th 時的每一列：顯示曲面上哪一點、哪一面、多亮；轉到箱口以下（後牆後面）的點看不到
            List<Row> LidRows(double th)
            {
                var best = new Dictionary<int, Row>(); double ct = Cos(th), st = Sin(th);
                for (int i = 0; i <= 260; i++)
                {
                    double al = (i / 260.0) * Math.PI, dz = LA + LA * Cos(al), dy = LB * Sin(al);
                    double z = -LA + dz * ct - dy * st, y = HB + dz * st + dy * ct;
                    if (y < HB - 0.05) continue;
                    double nz = Cos(al) / LA, ny = Sin(al) / LB;
                    double nl = Hypot(nz, ny);
                    nz /= nl; ny /= nl;
                    double Nz = nz * ct - ny * st, Ny = nz * st + ny * ct;
                    double v = y * CS + (LA - z) * SN, dep = z * CS + y * SN; int row = (int)Math.Floor(-v);
                    if (!best.TryGetValue(row, out var cur) || dep > cur.dep) best[row] = new Row { row = row, al = al, dep = dep, @out = Nz * CS + Ny * SN > 0, lit = Ny * 0.95 + Nz * 0.3 - 0.2 };
                }
                var rows = best.Values.OrderBy(r => r.row).ToList();
                // 亮的脊：朝光最正的外面那列
                Row hi = null;
                foreach (var r in rows) if (r.@out && (hi == null || r.lit > hi.lit)) hi = r;
                if (hi != null && hi.lit > 0.5) hi.crest = true;
                // 木板接縫：最靠近接縫角度的那列
                foreach (double s in new[] { Math.PI / 3, (2 * Math.PI) / 3 })
                {
                    Row k = null;
                    foreach (var r in rows) if (k == null || Math.Abs(r.al - s) < Math.Abs(k.al - s)) k = r;
                    if (k != null && Math.Abs(k.al - s) < 0.4) k.seam = true;
                }
                return rows;
            }

            // 打開的箱口裡發光的一堆金子
            void PaintHoard(uint[] C, uint[] W, double g)
            {
                Func<double, uint> heat = k => C[(int)Clamp(Round(k + g * 2.2), 0, 7)];
                double y0 = -FH - 4;
                for (double y = y0; y <= y0 + 3; y++)
                    for (double x = -HW; x < HW; x++)
                    {
                        double h = Rand(ToInt32(x), ToInt32(y), 7); int k = h < 0.18 ? 5 : h < 0.55 ? 4 : 3;
                        L.Set(x, y, y == y0 && Math.Abs(x + 0.5) > HW - 3 ? W[2] : heat(k - (y == y0 ? 1 : 0)));
                    }
                for (double x = -(HW - 3); x < HW - 3; x++)
                {
                    double top = y0 - Round(2.2 * (1 + SH.LB / 10) * Pow(Cos(((x + 0.5) / (HW - 2)) * (Math.PI / 2)), 1.4));
                    for (double y = top; y < y0; y++) L.Set(x, y, heat(y == top ? 5 : 4 + (Rand(ToInt32(x), ToInt32(y), 3) < 0.3 ? 1 : 0)));
                }
            }

            // 角度 th 的蓋子：外面木板、鐵條、金邊和扣；裡面暗木頭被金子照亮
            void PaintLid(uint[] C, uint[] W, double th, double g)
            {
                var rows = LidRows(th); Func<double, uint> heat = k => C[(int)Clamp(Round(k + g * 2.2), 0, 7)]; int top = rows.Count > 0 ? rows[0].row : 0;
                foreach (var r in rows)
                {
                    double u = r.al;
                    for (int x = -HW; x < HW; x++)
                    {
                        bool strap = STRAPS.Any(s => x == s || x == s + 1), left = STRAPS.Any(s => x == s); double side = (x + HW + 0.5) / (2 * HW);
                        bool corner = x == -HW || x == HW - 1;
                        uint c;
                        if (r.@out)
                        {
                            if (r.row == top && corner && th < 0.6) continue;
                            double l = r.lit + 0.2 - side * 0.35 - (r.row == top ? 0.45 : 0);
                            if (u < 0.3 || (u < 0.55 && x >= -2 && x <= 1)) c = SH.rim == "wood" ? Tone(W, l + 0.2, new[] { 6, 5, 4, 3, 2 }) : SH.rim == "iron" ? Tone(IRON, l + 0.2, new[] { 5, 4, 3, 2, 1 }) : Tone(C, l + (x >= -2 && x <= 1 ? 0.15 : 0.1), new[] { 6, 5, 5, 4, 3 });
                            else if (corner) c = SH.corner == "wood" ? W[x < 0 ? 5 : 2] : SH.corner == "gold" ? C[x < 0 ? 6 : 3] : x < 0 ? IRON[4] : IRON[2];
                            else if (strap) c = SH.goldStraps ? Tone(C, l + (left ? 0.3 : -0.3), SH.glow ? new[] { 7, 6, 5, 4, 3 } : new[] { 6, 5, 4, 3, 2 }) : Tone(IRON, l + (left ? 0.3 : -0.3), new[] { 5, 4, 3, 2, 1 });
                            else if (r.seam) c = W[0];
                            else
                            {
                                c = r.crest && side < 0.62 ? W[6] : Tone(W, l, new[] { 5, 4, 3, 2, 1 });
                                if (Rand(x >> 1, ToInt32(Round(u * 6)), 11) < 0.2) c = W[Math.Max(0, Array.IndexOf(W, c) - 1)];
                            }
                        }
                        else
                        {
                            // 蓋子內側，被下面的金子照亮
                            double k = g * Pow(u / Math.PI, 1.3);
                            if (u < 0.3) c = heat(1);
                            else if (r.seam) c = W[0];
                            else c = k > 0.6 ? Col.Mix(W[4], C[5], 0.3) : k > 0.35 ? W[3] : k > 0.15 ? W[2] : W[1];
                            if (corner) c = W[0];
                        }
                        L.Set(x, r.row, c);
                    }
                }
            }

            // 正面：邊、兩片木板、鐵條和鉚釘、鎖片和鑰匙孔
            void PaintFront(uint[] C, uint[] W, double g)
            {
                int mid = -(int)Round(FH / 2.0) - 0;
                for (int y = -FH; y <= -1; y++)
                    for (int x = -HW; x < HW; x++)
                    {
                        double side = (x + HW + 0.5) / (2 * HW);
                        uint c;
                        if (y == -FH) c = SH.rim == "wood" ? W[side < 0.4 ? 6 : side < 0.75 ? 5 : 4] : SH.rim == "iron" ? IRON[side < 0.4 ? 5 : side < 0.75 ? 4 : 3] : side < 0.3 ? C[6] : side < 0.7 ? C[5] : C[4];
                        else if (y == -1) c = W[1];
                        else if (y == mid) c = SH.band ? (side < 0.4 ? C[6] : side < 0.75 ? C[5] : C[3]) : W[0];
                        else
                        {
                            int rel = y - -FH; bool top = rel == 1 || y == mid + 1, bot = y == mid - 1 || y == -2;
                            c = W[top ? (side < 0.45 ? 4 : 3) : bot ? 2 : 3];
                            if (!top && Rand(x >> 1, y, 5) < 0.2) c = W[bot ? 1 : 2];
                        }
                        // 星箱：正面散著幾顆星點
                        if (SH.dots && y > -FH && y < -1 && y != mid && Rand(x, y, 21) < 0.06) c = Rand(x, y, 22) < 0.5 ? C[6] : C[5];
                        if (x == -HW) c = y == -FH ? (SH.rim == "wood" ? W[6] : C[5]) : SH.corner == "wood" ? W[4] : SH.corner == "gold" ? C[5] : IRON[4];
                        if (x == HW - 1) c = y == -FH ? (SH.rim == "wood" ? W[3] : C[3]) : SH.corner == "wood" ? W[1] : SH.corner == "gold" ? C[3] : IRON[2];
                        foreach (int s in STRAPS)
                        {
                            if (x == s && y > -FH) c = SH.goldStraps ? (y == mid ? C[7] : SH.glow ? C[6] : C[5]) : y == -7 || y == -3 ? IRON[5] : IRON[4];
                            if (x == s + 1 && y > -FH) c = SH.goldStraps ? (SH.glow ? C[4] : C[3]) : IRON[2];
                        }
                        // 鐵箱：上下各一排鉚釘
                        if (SH.rivets && (y == -FH + 1 || y == -2) && (x + HW) % 4 == 2) c = IRON[5];
                        L.Set(x, y, c);
                    }
                uint kh = g < 0.15 ? W[0] : g < 0.4 ? C[4] : g < 0.7 ? C[6] : Col.WHITE;
                if (SH.lock_ == "latch")
                {
                    // 木箱：一個小鐵扣
                    for (int y = -FH; y <= -FH + 3; y++) for (int x = -1; x <= 0; x++) L.Set(x, y, x == 0 ? IRON[2] : IRON[4]);
                    L.Set(-1, -FH + 2, kh);
                }
                else if (SH.lock_ == "plate")
                {
                    for (int y = -FH; y <= -4; y++) for (int x = -2; x <= 1; x++) L.Set(x, y, x == 1 || y == -4 ? C[3] : x == -2 && y == -FH ? C[7] : C[5]);
                    L.Set(-1, -7, kh); L.Set(0, -7, kh); L.Set(-1, -6, kh); L.Set(0, -6, Col.Scale(kh, 0.85));
                }
                else if (SH.lock_ == "gem")
                {
                    // 紅漆金箱：寬金鎖片＋紅寶石
                    for (int y = -FH; y <= mid + 1; y++) for (int x = -3; x <= 2; x++) L.Set(x, y, x == 2 || y == mid + 1 ? C[3] : x == -3 ? C[6] : C[5]);
                    var R = RUBY;
                    L.Set(-1, mid - 2, R[2]); L.Set(0, mid - 2, R[1]); L.Set(-1, mid - 1, R[1]); L.Set(0, mid - 1, R[0]); L.Set(-1, mid - 3, R[3]);
                    L.Set(-1, mid, kh); L.Set(0, mid, Col.Scale(kh, 0.85));
                }
                else
                {
                    // 星箱：鎖片是一顆五角星
                    for (int j = 0; j < STAR_LOCK.Length; j++) for (int i = 0; i < STAR_LOCK[j].Length; i++) { char ch = STAR_LOCK[j][i]; if (ch != '.') L.Set(i - 3, mid - 3 + j, ch == 'a' ? C[5] : ch == 'b' ? C[6] : kh); }
                }
                // 星箱：前面兩個角長出一叢水晶
                if (SH.spikes)
                {
                    for (int j = 0; j < SHARD.Length; j++)
                        for (int i = 0; i < SHARD[j].Length; i++)
                        {
                            char ch = SHARD[j][i];
                            if (ch == '.') continue;
                            int y = -FH - SHARD.Length + 2 + j;
                            L.Set(-HW - 2 + i, y, CR(C, ch));
                            L.Set(HW + 1 - i, y, CR(C, ch == 'a' ? 'b' : ch == 'b' ? 'c' : 'd'));   // 右邊鏡像、暗一階（背光）
                        }
                }
            }
            static uint CR(uint[] C, char ch) => ch == 'a' ? C[7] : ch == 'b' ? C[6] : ch == 'c' ? C[5] : C[4];

            // 整個箱子：蓋子翻過直立後站在金子後面，之前蓋住金子
            public void PaintChest(uint[] C, uint[] W, double th, double g)
            {
                if (th > 1.2) { PaintLid(C, W, th, g); PaintHoard(C, W, g); }
                else { PaintHoard(C, W, g); PaintLid(C, W, th, g); }
                PaintFront(C, W, g);
            }
        }

        class Ray { public double a, len, w, d, f, ph; }
        class Loot { public bool gem, up, rest, gone; public uint[] G; public double x, y, vx, vy, t0, r, ax, spin, vs, settle, ph, pop; }
        class RingQ { public double x, y, t0; }
        class BitQ { public double x, y, td; public uint c; public bool mote, done; }

        static FxImpl Create(FxOptions o)
        {
            uint WHITE = Col.WHITE;
            int TIER = (int)o["tier"];
            var pc = new Painter3(); pc.SetShape(TIER);
            uint[] C = Col.Fit(o.Palette, 8), W = Col.Fit(o.Ramps["wood"], 7); var R = new Rng((uint)o.SeedOr0); Func<double, double> floor = x => 0;
            var ps = new Particles(R, sparks: new[] { C[7], C[6], C[5], C[4] }, ground: floor) { Haze = C[4], HasHaze = true };
            var lights = new Lights(); var loot = new List<Loot>(); var rings = new List<RingQ>(); var bits = new List<BitQ>();
            var dust = new Particles(R, sparks: new[] { C[5], C[5], C[4], C[3] });
            uint DUST = Col.Hex("#5e5068");
            var IL = new PickupLayer(16, 16);
            // 從打開的箱子扇形射出的光芒
            int NR = 9 + TIER * 4;
            var rays = new List<Ray>();
            for (int i = 0; i < NR; i++)
            {
                double u = ((double)i / (NR - 1)) * 2 - 1;
                var r = new Ray(); r.a = u * (1.05 + TIER * 0.12) + R.Range(-0.06, 0.06); r.len = R.Range(46, 64) * (1 + TIER * 0.28) * (1.2 - 0.4 * Math.Abs(u));
                r.w = R.Range(0.035, 0.08); r.d = R.Range(0, 0.06); r.f = R.Range(5, 10); r.ph = R.Range(0, TAU);
                rays.Add(r);
            }
            // 寶物：金幣和寶石，從箱口扇形噴出
            int n = (int)o["coins"], gems = (int)o["gems"];
            for (int i = 0; i < n + gems; i++)
            {
                bool gem = i >= n; double s = i % 2 != 0 ? 1 : -1, a = s * R.Range(0.1, 0.5), sp = R.Range(190, 270);
                var it = new Loot { gem = gem, G = gem ? GEMS[(i - n) % GEMS.Length] : null };
                it.x = R.Range(-7, 7); it.y = -12; it.vx = Sin(a) * sp; it.vy = -Cos(a) * sp; it.t0 = T_OPEN + 0.03 + R.Range(0, 0.2);
                it.up = false; it.rest = false; it.r = gem ? 2.6 : 3; it.ax = R.Range(-0.6, 0.6); it.spin = R.Range(0, TAU); it.vs = R.Sign() * R.Range(14, 24);
                it.settle = 0; it.ph = R.Next(); it.pop = 0; it.gone = false;
                loot.Add(it);
            }
            // 從外面往裡面一個一個被收走（JS 的 sort 是穩定排序）
            int kk = 0;
            foreach (var it in loot.OrderByDescending(q => Math.Abs(q.vx)).ToList()) { it.pop = T_COLLECT + kk * 0.04 + R.Range(0, 0.02); kk++; }

            double t = 0; bool opened = false, poofed = false;
            Func<(double dx, double hop, double lid)> shake = () =>
            {
                double dx = 0, hop = 0, lid = 0;
                foreach (var rt in RATTLES)
                {
                    double t0 = rt[0], s = rt[1], u = t - t0;
                    if (u < 0 || u > 0.18) continue;
                    double e = 1 - u / 0.18;
                    dx += Sin(u * 90) * 1.6 * s * e;
                    if (u < 0.06 && s > 0.5) hop = 1;
                    lid = Math.Max(lid, Math.Max(0, Sin(u * 38)) * 0.13 * s * e);
                }
                if (t >= T_OPEN && t < T_OPEN + 0.08) hop = 1;
                // 最後一下：蓋子在彈開前從縫上慢慢撐起來
                double strain = Smooth(T_OPEN - 0.14, T_OPEN, t);
                if (t < T_OPEN) { lid = Math.Max(lid, 0.07 * strain); dx += strain > 0.2 ? (Math.Floor(t * 60) % 2 != 0 ? 1 : -1) * 0.6 : 0; }
                return (Round(dx), hop, lid);
            };
            Func<double, double> lidAngle = lid =>
            {
                if (t < T_OPEN) return lid;
                double u = t - T_OPEN; const double w = 30, z = 0.55; double wd = w * Math.Sqrt(1 - z * z);
                return 1.98 * (1 - Exp(-z * w * u) * (Cos(wd * u) + ((z * w) / wd) * Sin(wd * u)));
            };
            // 裡面的光：搖的時候越來越亮，蓋子彈開時大亮，然後穩下來、淡掉
            Func<double> inner = () =>
            {
                if (t < T_OPEN)
                {
                    double k = 0.1 + 0.45 * Smooth(0, T_OPEN, t) + 0.5 * Smooth(T_OPEN - 0.14, T_OPEN, t);
                    foreach (var rt in RATTLES) if (t > rt[0]) k += 0.45 * rt[1] * Exp(-(t - rt[0]) * 9);
                    return k;
                }
                return (0.62 + 0.3 * Exp(-(t - T_OPEN) * 5)) * (1 - Smooth(T_COLLECT - 0.3, T_POOF, t)) + 0.05 * Sin(t * 9);
            };
            Func<Ray, double> rayK = r =>
            {
                double u = t - T_OPEN - r.d;
                if (u < 0) return 0;
                return Ease.OutCubic(Clamp(u / 0.1)) * (1 - Smooth(1.0, 2.1, u)) * (0.72 + 0.28 * Sin(t * r.f + r.ph));
            };

            return new FxImpl
            {
                Update = (dt, _) =>
                {
                    pc.SetShape(TIER);
                    t += dt;
                    double g = inner();
                    foreach (var rt in RATTLES)
                    {
                        double t0 = rt[0], s = rt[1];
                        if (s > 0.5 && t - dt < t0 + 0.05 && t >= t0 + 0.05)
                            for (int i = 0; i < 4; i++)
                            {
                                double sd = i % 2 != 0 ? 1 : -1;
                                ps.Spawn(P.DUST, sd * R.Range(9, 13), -1, sd * R.Range(20, 50), -R.Range(2, 8), R.Range(0.3, 0.5), DUST, R.Range(1.2, 2.2) * s);
                            }
                    }
                    // 預告：光點從縫和鑰匙孔擠出來
                    if (t < T_OPEN && R.Chance(g * 0.08))
                    {
                        double x = R.Range(-11, 11);
                        ps.Spawn(P.STAR, x, -10, x * 1.5, -R.Range(8, 30), R.Range(0.3, 0.6), R.Chance(0.5) ? C[6] : C[5], R.Range(0.4, 1.2));
                    }
                    if (!opened && t >= T_OPEN)
                    {
                        opened = true;
                        lights.Add(0, -18, 64 * (1 + TIER * 0.15), C[5], 0.45 + TIER * 0.05, 0.7 + TIER * 0.15);
                        lights.Add(0, -16, 22 + TIER * 4, WHITE, 0.35 + TIER * 0.05, 0.1 + TIER * 0.03);
                        for (int i = 0; i < 7 + TIER * 9; i++)
                        {
                            double a = -Math.PI / 2 + R.Range(-1.1, 1.1), sp = R.Range(120, 260);
                            ps.Spawn(P.SPARK, R.Range(-8, 8), -13, Cos(a) * sp, Sin(a) * sp, R.Range(0.12, 0.26));
                        }
                        for (int i = 0; i < 8; i++)
                        {
                            int s = R.Sign();
                            ps.Spawn(P.DUST, s * R.Range(10, 14), -1, s * R.Range(30, 80), -R.Range(2, 10), R.Range(0.4, 0.7), DUST, R.Range(1.6, 3));
                        }
                    }
                    // 開著的時候：金粉從金堆裡往上飄，光裡閃著星光
                    if (t > T_OPEN && t < T_COLLECT)
                    {
                        if (R.Chance(0.22 * (1 + TIER * 0.9))) ps.Spawn(P.EMBER, R.Range(-9, 9), -13, R.Range(-12, 12), -R.Range(25, 60), R.Range(0.8, 1.5), C[5], R.Range(0.8, 1.6));
                        if (R.Chance(0.12 * (1 + TIER)))
                        {
                            double a = R.Range(-1, 1), d = R.Range(10, 40);
                            ps.Spawn(P.STAR, Sin(a) * d, -12 - Cos(a) * d, 0, -R.Range(4, 12), R.Range(0.3, 0.7), R.Chance(0.5) ? WHITE : C[6], R.Range(0.5, 2));
                        }
                    }
                    // 寶物飛出去、彈跳、停下來
                    foreach (var it in loot)
                    {
                        if (it.gone || t < it.t0) continue;
                        it.up = true;
                        if (t >= it.pop + 0.13)
                        {
                            it.gone = true;
                            double y = it.y - 6;
                            if (it.gem) rings.Add(new RingQ { x = it.x, y = y, t0 = t });
                            lights.Add(it.x, y, 18, it.gem ? it.G[4] : C[5], 0.65, 0.25);
                            for (int i = 0; i < 4; i++)
                            {
                                double a = R.Range(0, TAU), sp = R.Range(25, 55);
                                ps.Spawn(P.STAR, it.x, y, Cos(a) * sp - it.x * 0.25, Sin(a) * sp - 20, R.Range(0.3, 0.55), i != 0 ? (it.gem ? it.G[5] : C[6]) : WHITE, R.Range(0.6, 1.5));
                            }
                            continue;
                        }
                        if (it.rest)
                        {
                            it.settle += dt;
                            it.vx -= it.vx * 9 * dt;
                            it.x = Clamp(it.x + it.vx * dt, -74, 74);
                            continue;
                        }
                        it.vy += 950 * dt;
                        it.x += it.vx * dt;
                        // 留在畫布上：飛太遠的從邊緣彈回來
                        if (Math.Abs(it.x) > 74) { it.x = Sign(it.x) * 74; it.vx *= -0.3; }
                        it.y += it.vy * dt;
                        it.spin += it.vs * dt;
                        double bottom = it.y + it.r;
                        if (bottom >= -0.5 && it.vy > 0)
                        {
                            it.y = -0.5 - it.r;
                            if (it.vy > 110)
                            {
                                ps.Spawn(P.DUST, it.x, -1, R.Range(-20, 20), -R.Range(4, 12), R.Range(0.25, 0.45), DUST, R.Range(1, 1.8));
                                if (it.vy > 220)
                                {
                                    for (int i = 0; i < 2; i++) ps.Spawn(P.SPARK, it.x, -1, R.Range(-90, 90), -R.Range(60, 140), R.Range(0.1, 0.22));
                                    lights.Add(it.x, -2, 9, C[5], 0.5, 0.12);
                                }
                                it.vy = -it.vy * 0.42;
                                it.vx *= 0.5;
                                it.vs *= 0.55;
                            }
                            else
                            {
                                it.rest = true;
                                it.vy = 0;
                            }
                        }
                    }
                    for (int i = rings.Count - 1; i >= 0; i--) if (t - rings[i].t0 > 0.3) rings.RemoveAt(i);
                    if (!poofed && t >= T_POOF)
                    {
                        // 空箱子從蓋子往下化成往上飄的金粉
                        poofed = true;
                        lights.Add(0, -12, 40, C[5], 0.5, 0.6);
                        pc.L.Begin(-32, -62);
                        pc.PaintChest(C, W, lidAngle(0), 0.3);
                        pc.L.Outline(W[0]);
                        var f = pc.L.F;
                        double top = 0;
                        for (int i = 0; i < f.Color.Length; i++) if (f.Color[i] != 0) top = Math.Min(top, Math.Floor((double)i / f.W) + f.Oy);
                        for (int i = 0; i < f.Color.Length; i++)
                        {
                            uint c = f.Color[i];
                            if (c == 0) continue;
                            double x = (i % f.W) + f.Ox, y = Math.Floor((double)i / f.W) + f.Oy;
                            bits.Add(new BitQ { x = x, y = y, c = c, td = T_POOF + ((y - top) / -top) * 0.32 + Rand(ToInt32(x), ToInt32(y), 21) * 0.05, mote = Rand(ToInt32(x), ToInt32(y), 23) < 0.14 });   // JS 的 c !== W[0] 永遠成立（Uint32Array 的值是正的、hex() 是負的 int32），照原本的行為
                        }
                    }
                    foreach (var b in bits)
                        if (!b.done && t >= b.td)
                        {
                            b.done = true;
                            if (b.mote) dust.Spawn(P.EMBER, b.x + 0.5, b.y + 0.5, R.Range(-28, 28), -R.Range(14, 50), R.Range(0.4, 0.8), C[5], R.Range(0.5, 1.1));
                        }
                    ps.Update(dt);
                    dust.Update(dt);
                    lights.Update(dt);
                },
                DrawBack = (p, _, __) =>
                {
                    if (t < T_POOF + 0.2) PickupKit.BlobShadow(p, 0, 15, 1 - Smooth(T_POOF, T_POOF + 0.2, t));
                    ps.Draw(p, "back");
                },
                Draw = (p, _, __) =>
                {
                    pc.SetShape(TIER);
                    double g = inner(); var sh = shake(); double th = lidAngle(sh.lid);
                    // 地上和箱子周圍的光
                    double open = t >= T_OPEN ? 1 : 0;
                    PickupKit.Pool(p, 0, 0, 30 + 10 * g, 4, C[4], (0.1 + 0.18 * open) * g);
                    p.Glow(0, -16, 24 + 8 * g, C[4], (0.1 + 0.2 * open) * g);
                    if (t < T_POOF)
                    {
                        pc.L.Begin(-32, -62);
                        pc.PaintChest(C, W, th, Math.Min(1.2, g));
                        pc.L.Outline(W[0]);
                        pc.L.Draw(p, sh.dx, -sh.hop);
                    }
                    else foreach (var b in bits) if (!b.done) p.Px(b.x, b.y, b.td - t < 0.04 ? C[6] /* JS 的 b.c === W[0] 永遠不成立（同上） */ : b.c);
                    // 打開前從縫裡漏出的光
                    if (t < T_OPEN)
                    {
                        p.GlowLine(-11, -9.5 - sh.hop, 11, -9.5 - sh.hop, 5, C[5], 0.22 * g);
                        // 蓋子下的縫透出的光，金子越亮越長
                        if (g > 0.35 && sh.lid < 0.015) p.Line(-10 + sh.dx, -10 - sh.hop, 9 + sh.dx, -10 - sh.hop, u => Math.Abs(u - 0.5) < 0.2 ? WHITE : C[6], u => (g - 0.35) * 2.2 * (1 - Math.Abs(u - 0.5) * 0.9));
                        p.Glow(sh.dx, -7 - sh.hop, 6, C[6], 0.35 * g);
                        // 每撞一下蓋子離開縫，細細的光從縫射出來
                        if (sh.lid > 0.015)
                            for (int i = 0; i < 8; i++)
                            {
                                double x = -10.5 + i * 3 + sh.dx + (Rand(i, 3) - 0.5) * 1.5, a = -Math.PI / 2 + (x / 11) * 1.25, l = (7 + Rand(i, ToInt32(Math.Floor(t * 30)), 1) * 12) * Math.Min(1, sh.lid / 0.05);
                                double y0 = -10 - sh.hop;
                                p.Line(x, y0, x + Cos(a) * l, y0 + Sin(a) * l, u => u < 0.25 ? WHITE : u < 0.6 ? C[6] : C[5], u => 1.15 - u);
                                p.GlowLine(x, y0, x + Cos(a) * l * 0.7, y0 + Sin(a) * l * 0.7, 3, C[5], 0.25);
                            }
                    }
                    // 光芒：從打開的箱子扇形射出的光楔
                    foreach (var r in rays)
                    {
                        double k = rayK(r);
                        if (k <= 0.01) continue;
                        double ox = Sin(r.a) * 7, oy = -12, dx = Sin(r.a), dy = -Cos(r.a), len = r.len * (0.88 + 0.12 * Sin(t * r.f * 0.7 + r.ph)), tw = Tan(r.w);
                        double x1 = ox + dx * len, y1 = oy + dy * len;
                        p.Shade(Math.Min(ox, x1) - 8, Math.Min(oy, y1) - 8, Math.Max(ox, x1) + 8, Math.Max(oy, y1) + 8, (double x, double y, ref Painter.Out out_) =>
                        {
                            double rx = x - ox, ry = y - oy, d = rx * dx + ry * dy;
                            if (d < 0 || d > len) return;
                            double q = Math.Abs(rx * dy - ry * dx), hw = 0.6 + d * tw, f = q < hw ? 1 - 0.35 * (q / hw) : 0.65 * (1 - (q - hw) / 1.6);
                            if (f <= 0) return;
                            out_.l = q < hw * 0.45 ? C[6] : C[5];
                            out_.k = k * 0.55 * Math.Sqrt(9.0 / NR) * f * Pow(1 - d / len, 1.4) * Smooth(5, 14, d);   // 光芒多的時候每條淡一點
                        });
                    }
                    // 彈開：箱口一道八道光
                    if (t >= T_OPEN && t < T_OPEN + 0.2)
                    {
                        double a = (t - T_OPEN) / 0.2;
                        Sim.Flare(p, 0, -14, 22 * Pow(1 - a, 1.4), 1 - a, C);
                    }
                    // 寶物
                    foreach (var it in loot)
                    {
                        if (!it.up || it.gone) continue;
                        double pu = t - it.pop, lift = pu > 0 ? 6 * Ease.OutCubic(Clamp(pu / 0.1)) : 0; bool wh = pu > 0.095;
                        double y = it.y - lift, ax = it.ax, spin = it.spin;
                        bool flat = false;
                        if (it.rest && !it.gem)
                        {
                            // 金幣平倒、晃一晃，然後躺成一片金色
                            double w = Exp(-it.settle * 8) * Math.Abs(Cos(it.settle * 22));
                            ax = 0;
                            spin = Acos(Clamp(0.5 + 0.5 * w, 0, 1));
                            flat = w < 0.12;
                            y = flat ? -1.5 - lift : -it.r * Cos(spin) - lift;
                        }
                        if (it.y > -10) PickupKit.BlobShadow(p, it.x, 3, 0.7 * (1 - Clamp(-it.y / 30)));
                        if (it.gem) PickupKit.Gemlet(IL, p, it.x, y, it.r, it.rest ? 0.4 * Sign(it.vs) : it.spin, it.G, wh);
                        else PickupKit.Coin(IL, p, flat ? Round(it.x) + 0.5 : it.x, y, it.r, ax, flat ? Acos(0.5) : spin, C, wh, 1, !flat);
                        p.Glow(it.x, y, 9, it.gem ? it.G[4] : C[5], it.rest ? 0.26 : 0.18);
                        p.Glow(it.x, y, 3, WHITE, 0.12);
                        // 停著的寶物輪流閃一下
                        if (it.rest && t < it.pop)
                        {
                            double u = (t * 0.9 + it.ph) % 1;
                            if (u < 0.16) PickupLib.Glint(p, it.x - 1, y - 1.5, 2.6 * Sin((u / 0.16) * Math.PI), it.gem ? it.G[5] : C[6], 0.5);
                        }
                    }
                    foreach (var r in rings)
                    {
                        double k = (t - r.t0) / 0.3, e = Ease.OutCubic(k);
                        p.Ring(r.x, r.y, 2 + 5 * e, 1, k < 0.3 ? WHITE : C[6], 1.15 - k);
                        p.Glow(r.x, r.y, 12, C[5], 0.45 * (1 - k));
                        if (k < 0.5) PickupLib.Glint(p, r.x, r.y, 3.4 * (1 - k / 0.5), C[6], 0.55);
                    }
                    ps.Draw(p, "front");
                    dust.Draw(p);
                    lights.Draw(p);
                },
            };
        }
    }
}
