// game/src/heroorbit.js（drawOrbit、blit2x）＋ game/src/heroaura.js（drawAura）＋ inventory.js 的 drawHero 翻成 C#：
// 背包左欄的主角圖（113×104，放大 2 倍顯示）：星星站在中間（畫 2 倍大），7 件裝備在外圈軌道上慢慢繞，
// 吸收過的形態各一圈粒子繞著星星轉。運算順序照原本的 JS（Pf.* 的 fdlibm 數學），每一格像素跟網頁版一樣。
// 比對：node --no-use-std-math-pow game/tools/unity-orbit-golden.mjs → Unity 的 PixelFX.Tests.Golden.RunOrbit
//       → node game/tools/unity-orbit-golden.mjs --compare
using System;
using System.Collections.Generic;
using PixelFX;

namespace ZeroStar.UI
{
    public static class HeroOrbit
    {
        public const int OW = 113, OH = 104, SW = 48, SH = 64;
        // inventory.js 的 ORB
        public const double CX = 56, CY = 50, RX = 47, RY = 41, FEET = 70;
        const double TAU = Math.PI * 2;

        static int[] HexC(string h) { int n = Convert.ToInt32(h.Substring(1), 16); return new[] { (n >> 16) & 255, (n >> 8) & 255, n & 255 }; }
        static uint Pack(int[] c) => 0xff000000u | ((uint)c[2] << 16) | ((uint)c[1] << 8) | (uint)c[0];
        // heroorbit.js 的 hash：乘法用 Math.imul（32 位元）
        static double HashO(int i, int k)
        {
            uint h = unchecked((uint)((long)i * 374761393L + (long)k * 668265263L));
            h = unchecked((uint)((int)(h ^ (h >> 13)) * 1274126177));
            return (h ^ (h >> 16)) / 4294967296.0;
        }
        // heroaura.js 的 hash：乘法是一般的浮點數乘法（超過 2^53 會失準，照樣模擬），再截成 32 位元
        static double HashA(double a, double b)
        {
            int h = Pf.ToInt32(a * 374761393 + b * 668265263);
            double m = (double)(h ^ (int)((uint)h >> 13)) * 1274126177;
            int h2 = Pf.ToInt32(m);
            return (uint)(h2 ^ (int)((uint)h2 >> 16)) / 4294967296.0;
        }

        // 軌道的顏色：星星的金色（暗 → 白）
        static readonly uint[] GOLD = Array.ConvertAll(new[] { "#3a2a5a", "#7a5a9a", "#c8a050", "#ffd860", "#fff2b0", "#ffffff" }, h => Pack(HexC(h)));
        static readonly int[] GOLD_RGB = HexC("#ffd860");

        /// 7 個裝備格的角度（-π/2 起、順時針等分，加上慢慢轉的 spin）
        public static double SlotAngle(int i, double spin) => -Math.PI / 2 + (i / 7.0) * Math.PI * 2 + spin;
        /// 7 個裝備格在 113×104 畫布上的中心（網頁版的 left/top 是這個 ×2 的 CSS 像素）；front＝下半圈（畫在星星前面，zIndex 3）
        public static (double x, double y, bool front)[] SlotPositions(double spin)
        {
            var r = new (double, double, bool)[7];
            for (int i = 0; i < 7; i++) { double a = SlotAngle(i, spin); r[i] = (CX + Pf.Cos(a) * RX, CY + Pf.Sin(a) * RY, Pf.Sin(a) >= 0); }
            return r;
        }

        /// inventory.js 的 drawHero：of＝113×104 的畫布、sf＝48×64 的星星小畫布；slotColors＝7 格的稀有度顏色（null＝空格）；
        /// aura＝吸收過的形態（不含 star，順序照 FORMS）；form＝星星現在的形態。畫完用 of.Composite(null, null, 0.6) 輸出。
        public static void DrawHero(Frame of, Frame sf, double t, double spin, string[] slotColors, List<(string id, int n)> aura, string form)
        {
            var slots = new (double a, string col)[7];
            for (int i = 0; i < 7; i++) slots[i] = (SlotAngle(i, spin), slotColors?[i]);
            of.Clear(); sf.Clear();
            DrawOrbit(of, t, slots, false);
            DrawAura(of, t, CX, CY + 4, 1.3, aura, false);
            HeroArt.Paint(sf, 24, 50, HeroArt.Pose(string.IsNullOrEmpty(form) ? "star" : form, "stand"), false, 0, 0);
            Blit2x(of, sf, CX, FEET + 28 + Pf.Round(Pf.Sin(t * 2.5)));
            DrawAura(of, t, CX, CY + 4, 1.3, aura, true);
            DrawOrbit(of, t, slots, true);
        }

        // ---- heroorbit.js 的 drawOrbit
        static void DrawOrbit(Frame frame, double t, (double a, string col)[] slots, bool front)
        {
            int W = frame.W, H = frame.H; uint[] C = frame.Color, L = frame.Light;
            void Put(double x, double y, uint c) { int X = (int)Pf.Round(x), Y = (int)Pf.Round(y); if (X >= 0 && Y >= 0 && X < W && Y < H) C[Y * W + X] = c; }
            void Glow(double x, double y, int r, int[] rgb, double a)
            {
                int gx = (int)Pf.Round(x), gy = (int)Pf.Round(y);
                for (int dy = -r; dy <= r; dy++) for (int dx = -r; dx <= r; dx++)
                {
                    int X = gx + dx, Y = gy + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
                    double f = 1 - Pf.Hypot(dx, dy) / (r + 0.5); if (f <= 0) continue;
                    int i = Y * W + X; uint d = L[i]; double k = f * f * a;
                    L[i] = 0xff000000u | ((uint)Math.Min(255, ((d >> 16) & 255) + rgb[2] * k) << 16) | ((uint)Math.Min(255, ((d >> 8) & 255) + rgb[1] * k) << 8) | (uint)Math.Min(255, (d & 255) + rgb[0] * k);
                }
            }
            double cx = CX, cy = CY, rx = RX, ry = RY;
            bool IsFront(double g) => Pf.Sin(g) >= 0;   // 下半圈（離我們近）畫在星星前面
            double Gap(double a, double b) => Math.Abs(Pf.Atan2(Pf.Sin(a - b), Pf.Cos(a - b)));
            if (!front) Glow(cx, cy, 30, GOLD_RGB, 0.22 + 0.06 * Pf.Sin(t * 2));   // 星星身後一團柔光

            // ---- 外圈軌道：細的點線，兩顆追逐的亮點拖著尾巴；遠的那半暗一階
            double chase = t * 0.9; int N = (int)Pf.Round((rx + ry) * 3.2);
            for (int i = 0; i < N; i++)
            {
                double g = ((double)i / N) * TAU;
                if (IsFront(g) != front) continue;
                double d = Math.Min(Gap(g, chase), Gap(g, chase + Math.PI)), behind = ((chase - g) % TAU + TAU) % TAU;
                double x = cx + Pf.Cos(g) * rx, y = cy + Pf.Sin(g) * ry;
                if (d < 0.05) { Put(x, y, GOLD[5]); Glow(x, y, 3, GOLD_RGB, 0.6); continue; }
                const double TL = 0.6; bool tail = behind < TL || (behind > Math.PI && behind < Math.PI + TL);
                if (tail) { double k = 1 - (behind % Math.PI) / TL; Put(x, y, k > 0.6 ? GOLD[4] : k > 0.3 ? GOLD[3] : GOLD[2]); if (k > 0.5) Glow(x, y, 2, GOLD_RGB, 0.25 * k); continue; }
                if (i % 3 == 0) Put(x, y, front ? GOLD[2] : GOLD[1]);
            }
            // ---- 內圈：腳下一個斜的小光環，慢慢轉的四個亮點
            double fx = cx, fy = FEET, frx = 20, fry = 5;
            for (int i = 0; i < 48; i++)
            {
                double g = (i / 48.0) * TAU;
                if (IsFront(g) != front) continue;
                double x = fx + Pf.Cos(g) * frx, y = fy + Pf.Sin(g) * fry;
                bool lit = false;
                for (int q = 0; q < 4 && !lit; q++) lit = Gap(g, t * 1.6 + (q * TAU) / 4) < 0.18;
                Put(x, y, lit ? GOLD[4] : front ? GOLD[2] : GOLD[1]);
                if (lit) Glow(x, y, 2, GOLD_RGB, 0.3);
            }
            // ---- 每個裝備格背後一圈光（稀有度顏色，慢慢呼吸）；空格沒有
            if (!front) foreach (var s in slots)
            {
                if (string.IsNullOrEmpty(s.col)) continue;
                Glow(cx + Pf.Cos(s.a) * rx, cy + Pf.Sin(s.a) * ry, 13, HexC(s.col), 0.28 + 0.1 * Pf.Sin(t * 2.2 + s.a * 3));
            }
            // ---- 光點：從星星腳下往上飄，繞著星星轉（前後分層）
            for (int i = 0; i < 10; i++)
            {
                double life = 2.2 + HashO(i, 3) * 1.4, age = (t + HashO(i, 4) * life) % life, e = age / life;
                double g = HashO(i, 5) * TAU + age * (1.2 + HashO(i, 6)), r = 10 + HashO(i, 7) * 10;
                if (IsFront(g) != front) continue;
                double x = cx + Pf.Cos(g) * r, y = fy - age * 14 + Pf.Sin(g) * 3, k = Math.Min(1, Math.Min(e * 5, (1 - e) * 3));
                if (k < 0.2) continue;
                Put(x, y, front ? (k > 0.6 ? GOLD[5] : GOLD[4]) : GOLD[2]);
                if (front) Glow(x, y, 2, GOLD_RGB, 0.35 * k);
            }
        }

        /// heroorbit.js 的 blit2x：把小畫布的像素放大 2 倍貼上去，腳底對齊 (cx, bottom)
        public static void Blit2x(Frame frame, Frame src, double cx, double bottom)
        {
            int W = frame.W, H = frame.H, ox = (int)Pf.Round(cx - src.W), oy = (int)Pf.Round(bottom - src.H * 2);
            for (int y = 0; y < src.H; y++) for (int x = 0; x < src.W; x++)
            {
                uint c = src.Color[y * src.W + x];
                if ((c >> 24) == 0) continue;
                for (int b = 0; b < 2; b++) for (int a = 0; a < 2; a++) { int X = ox + x * 2 + a, Y = oy + y * 2 + b; if (X >= 0 && Y >= 0 && X < W && Y < H) frame.Color[Y * W + X] = c; }
            }
        }

        // ---- heroaura.js 的 drawAura
        static uint U(string h) { uint n = Convert.ToUInt32(h.Substring(1), 16); return 0xff000000u | ((n & 255) << 16) | (n & 0xff00) | (n >> 16); }
        static readonly uint[] GOO = Array.ConvertAll(new[] { "#1e5a2a", "#3aa83a", "#7ee86a", "#d8ffb0", "#ffffff" }, U);
        static readonly uint[] IRON = Array.ConvertAll(new[] { "#2a2e3a", "#5a6274", "#9aa6ba", "#dfe6f0" }, U);
        static readonly uint[] VOLT = Array.ConvertAll(new[] { "#c89a20", "#ffe27a", "#fffbe0" }, U);
        static readonly uint[] BATC = Array.ConvertAll(new[] { "#1a1028", "#3e2a5e", "#6a4a98", "#ff4a5a" }, U);
        static readonly uint HOLE = U("#14161e");
        struct Band { public double dy, rx, ry, sp; public Band(double a, double b, double c, double d) { dy = a; rx = b; ry = c; sp = d; } }
        // 每一種形態的軌道：dy＝離星星中心的高度、rx/ry＝橢圓、sp＝轉速（正負＝方向）
        static readonly Dictionary<string, Band> BAND = new Dictionary<string, Band> { ["slime"] = new Band(20, 30, 7, 0.55), ["can"] = new Band(2, 34, 8, -0.4), ["bat"] = new Band(-20, 28, 9, 0.75) };
        static readonly Band[] EXTRA = { new Band(10, 38, 6, 0.3), new Band(-10, 36, 10, -0.6) };
        static readonly string[] SLIME_D = { "..a..", ".aba.", "abccb", "abbbd", ".ddd." };
        static readonly int[][] WU = { new[] { -1, -1 }, new[] { -2, -2 }, new[] { -3, -3 }, new[] { -4, -3 }, new[] { -2, -1 }, new[] { -3, -2 } };
        static readonly int[][] WD = { new[] { -1, 0 }, new[] { -2, 0 }, new[] { -3, 0 }, new[] { -4, 1 }, new[] { -2, 1 }, new[] { -3, 1 }, new[] { -4, 2 } };
        static string FormColor(string id) => Game.FORM_COLOR.TryGetValue(id, out var c) ? c : "#ffd84a";

        static void DrawAura(Frame frame, double t, double ocx, double ocy, double ok, List<(string id, int n)> forms, bool front)
        {
            if (forms == null) return;
            int W = frame.W, H = frame.H; uint[] C = frame.Color, L = frame.Light;
            void Put(double px, double py, uint c, bool lit = false) { int X = (int)Pf.Round(px), Y = (int)Pf.Round(py); if (X < 0 || Y < 0 || X >= W || Y >= H) return; C[Y * W + X] = c; if (lit) L[Y * W + X] = c; }
            // 柔光：半徑 r 的圓，往外變淡（加到光層）
            void Glow(double gx, double gy, uint c, double k, int r = 3)
            {
                int x0 = (int)Pf.Round(gx), y0 = (int)Pf.Round(gy);
                uint cr = c & 255, cg = (c >> 8) & 255, cb = (c >> 16) & 255;
                for (int dy = -r; dy <= r; dy++) for (int dx = -r; dx <= r; dx++)
                {
                    int X = x0 + dx, Y = y0 + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
                    double f = 1 - Pf.Hypot(dx, dy) / (r + 0.5); if (f <= 0) continue;
                    int i = Y * W + X; uint d = L[i]; double q = f * f * k;
                    L[i] = 0xff000000u | ((uint)Math.Min(255, ((d >> 16) & 255) + cb * q) << 16) | ((uint)Math.Min(255, ((d >> 8) & 255) + cg * q) << 8) | (uint)Math.Min(255, (d & 255) + cr * q);
                }
            }
            int extra = 0;
            foreach (var (id, n) in forms)
            {
                Band B0 = BAND.TryGetValue(id, out var bb) ? bb : EXTRA[extra++ % EXTRA.Length];
                Band B = new Band(B0.dy * ok, B0.rx * ok, B0.ry * ok, B0.sp);
                int count = Math.Min(id == "bat" ? 10 : 14, 3 + n * 2);   // 吸得越多越多
                // 淡淡的點線軌道，後面那半更稀；前半圈只畫兩側
                uint tc = id == "slime" ? GOO[1] : id == "can" ? IRON[1] : id == "bat" ? BATC[2] : U(FormColor(id));
                int N = (int)Pf.Round((B.rx + B.ry) * 3);
                for (int k = 0; k < N; k++)
                {
                    double g = ((double)k / N) * TAU, sg = Pf.Sin(g);
                    if ((sg >= 0) != front || k % (front ? 3 : 5) != 0 || (front && Math.Abs(Pf.Cos(g)) < 0.5)) continue;
                    Put(ocx + Pf.Cos(g) * B.rx, ocy + B.dy + sg * B.ry, tc);
                }
                for (int i = 0; i < count; i++)
                {
                    double a = ((double)i / count) * TAU + HashA(i, id.Length * 7) * 0.6 + t * B.sp, sa = Pf.Sin(a);
                    if ((sa >= 0) != front) continue;
                    double r = 0.85 + HashA(i, 3) * 0.3, x = ocx + Pf.Cos(a) * B.rx * r, y = ocy + B.dy + sa * B.ry * r + Pf.Sin(t * 2.2 + i * 1.7) * 1.5;
                    bool far = !front;   // 後面那半暗一階
                    if (id == "slime")
                    {
                        if (far) { Put(x, y, GOO[1]); Put(x + 1, y, GOO[0]); Put(x, y + 1, GOO[0]); continue; }
                        // 5×4 的水滴（上尖下圓），暗邊、左上白高光、發一點綠光
                        for (int j = 0; j < SLIME_D.Length; j++) for (int k = 0; k < SLIME_D[j].Length; k++)
                        {
                            char ch = SLIME_D[j][k]; if (ch == '.') continue;
                            Put(x - 2 + k, y - 3 + j, ch == 'a' ? GOO[1] : ch == 'b' ? GOO[2] : ch == 'c' ? GOO[3] : GOO[0]);
                        }
                        Put(x - 1, y - 1, GOO[4], true); Put(x, y - 1, GOO[3], true);
                        Glow(x, y - 1, GOO[2], 0.35, 3);
                        // 偶爾冒一顆小泡泡往上飄、破掉
                        double p = (t * 0.7 + HashA(i, 11)) % 1;
                        if (HashA(i, 12) < 0.4 && p < 0.8) { double by = y - 3 - p * 14, bx = x + Pf.Sin(p * 9 + i) * 2; Put(bx, by, GOO[3], true); if (p < 0.5) Put(bx + 1, by - 1, GOO[4]); }
                    }
                    else if (id == "can")
                    {
                        // 螺帽或螺絲，慢慢轉；旁邊一閃一閃的電火花
                        int spin = (int)(Math.Floor(t * 6 + i) % 4); uint hi = far ? IRON[1] : IRON[3], mid = far ? IRON[0] : IRON[2], lo = far ? IRON[0] : IRON[1];
                        if (i % 3 == 0)
                        {
                            bool v = spin % 2 != 0;
                            for (int k = -2; k <= 2; k++) { Put(x + (v ? k : 0), y + (v ? 0 : k), k < -1 ? hi : k > 1 ? lo : mid); Put(x + (v ? k : 1), y + (v ? 1 : k), k > 0 ? lo : mid); }
                            Put(x + (v ? -2 : -1), y + (v ? -1 : -2), hi); Put(x + (v ? -1 : -1), y + (v ? -1 : -2), hi);
                        }
                        else
                        {
                            for (int j = -2; j <= 1; j++) for (int k = -2; k <= 1; k++) { if ((j == -2 || j == 1) && (k == -2 || k == 1)) continue; Put(x + k, y + j, j + k < -1 ? hi : j + k > 0 ? lo : mid); }
                            Put(x - 1 + (spin % 2), y - 1 + (spin > 1 ? 1 : 0), HOLE);   // 洞
                        }
                        if (!far && Math.Floor(t * 9 + i * 3) % 3 == 0)
                        {
                            // 電火花：一小段鋸齒（白芯黃邊）
                            int dir = HashA(i, Math.Floor(t * 9)) < 0.5 ? -1 : 1;
                            Put(x + dir * 2, y - 1, VOLT[2], true); Put(x + dir * 3, y - 2, VOLT[1], true); Put(x + dir * 3, y, VOLT[1], true); Put(x + dir * 4, y - 1, VOLT[0], true);
                            Glow(x + dir * 3, y - 1, VOLT[1], 0.7, 3);
                        }
                    }
                    else if (id == "bat")
                    {
                        // 小蝙蝠：翅膀兩格動畫（上舉＝V 字、下拍＝攤平往下垂），耳朵兩格，紅眼發光
                        bool flap = Math.Floor(t * 10 + i * 2) % 2 != 0; uint body = far ? BATC[1] : BATC[2], wing = far ? BATC[0] : BATC[1], edge = far ? BATC[1] : BATC[2];
                        Put(x, y, body); Put(x + 1, y, body); Put(x, y + 1, wing); Put(x + 1, y + 1, wing); Put(x, y - 1, edge); Put(x + 1, y - 1, edge);
                        foreach (var w in flap ? WU : WD) { int dx = w[0], dy = w[1]; uint c = dy < 0 || dx > -3 ? edge : wing; Put(x + dx, y + dy, c); Put(x + 1 - dx, y + dy, c); }
                        if (!far) { Put(x, y, BATC[3], true); Put(x + 1, y, BATC[3], true); Glow(x, y, BATC[3], 0.45, 2); }
                    }
                    else
                    {
                        // 之後的新形態：那個形態顏色的光點（十字一閃）
                        uint c = U(FormColor(id)); bool tw = Math.Floor(t * 6 + i) % 4 == 0;
                        Put(x, y, c, !far);
                        if (tw && !far) { Put(x - 1, y, c, true); Put(x + 1, y, c, true); Put(x, y - 1, c, true); Put(x, y + 1, c, true); }
                    }
                }
            }
        }
    }
}
