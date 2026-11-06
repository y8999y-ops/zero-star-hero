// game/src/feature-art.js 一行一行翻成 C#：形態機關＋一次性資源的畫法（drawPlug 是王房用的，沒翻）。
//   機關：crack 裂開的垃圾牆、wind 深淵氣流、shroom 黏液菇、seal 星光封印
//   資源：ember 星之殘火、vein 星塵礦脈、fossil 魔物化石核、safe 被丟下來的寶箱、stele 星王的碑文
// 每個 DrawXxx(frame, x, y, ..., t)：(x, y)＝底部中心（貼地）。
using System;
using System.Collections.Generic;
using System.Linq;
using PixelFX;

namespace ZeroStar
{
    public static class FeatureArt
    {
        static uint P(string c) => Col.Hex(c);
        static readonly uint OUT = P("#0c0a14");
        public static void Put(Frame frame, double x, double y, uint c, bool glow = false)
        {
            int X = (int)Pf.Round(x) - frame.Ox, Y = (int)Pf.Round(y) - frame.Oy;
            if (X < 0 || Y < 0 || X >= frame.W || Y >= frame.H) return;
            frame.Color[Y * frame.W + X] = c;
            if (glow) frame.Light[Y * frame.W + X] = c;
        }
        /// JS：(a * 374761393 + b * 668265263 + c * 2147483647) | 0 之後亂數化（中間是 double 乘法，照 JS 的取整規則）
        public static double Hash(double a, double b, double c = 0)
        {
            int h = Pf.ToInt32(a * 374761393 + b * 668265263 + c * 2147483647);
            double m = (double)(h ^ (int)((uint)h >> 13)) * 1274126177;
            int hi = Pf.ToInt32(m); uint hu = unchecked((uint)hi);
            return unchecked((uint)(hi ^ (int)(hu >> 16))) / 4294967296.0;
        }
        static bool At(string[] rows, int i, int j) => j >= 0 && j < rows.Length && i >= 0 && i < rows[j].Length && rows[j][i] != '.';
        /// 字元圖：rows（'.' 透明），map 字元→顏色，glow 裡的字元會發光；自動加 1px 外框
        static void Sprite(Frame frame, string[] rows, double x0, double y0, Dictionary<char, uint> map, string glow = "", bool outline = true)
        {
            if (outline) for (int j = -1; j <= rows.Length; j++) for (int i = -1; i <= rows[0].Length; i++) if (!At(rows, i, j) && (At(rows, i + 1, j) || At(rows, i - 1, j) || At(rows, i, j + 1) || At(rows, i, j - 1))) Put(frame, x0 + i, y0 + j, OUT);
            for (int j = 0; j < rows.Length; j++) for (int i = 0; i < rows[j].Length; i++) { char ch = rows[j][i]; if (ch != '.') Put(frame, x0 + i, y0 + j, map[ch], glow.IndexOf(ch) >= 0); }
        }

        // ---------- 裂開的垃圾牆：32×48，壓扁的垃圾一塊塊疊起來，裂縫照受傷程度變多（hp 0～1）
        static readonly uint[][] JUNK = new[] { new[] { "#5a2a20", "#8a3e24", "#b05a2a" }, new[] { "#5c5868", "#7c7884", "#9a968c" }, new[] { "#4a2830", "#7a4434", "#a06446" }, new[] { "#342646", "#463c5e", "#5a5274" } }.Select(r => r.Select(P).ToArray()).ToArray();
        public static void DrawCrack(Frame frame, double x, double y, double hp = 1, double t = 0, double H = 48)
        {
            const int W = 32; double x0 = Pf.Round(x - W / 2.0), y0 = Pf.Round(y - H), shake = hp < 1 && Pf.Sin(t * 60) > 0.6 ? 1 : 0;
            for (int j = 0; j < H; j++) for (int i = 0; i < W; i++)
                {
                    bool edge = i == 0 || j == 0 || i == W - 1 || j == H - 1;
                    // 每塊 10×8 左右的垃圾塊，錯開排
                    int row = j / 8, off = row % 2 != 0 ? 5 : 0, bx = (i + off) / 10, lx = (i + off) % 10, ly = j % 8;
                    var M = JUNK[(int)Math.Floor(Hash(bx, row, 3) * JUNK.Length)];
                    uint c = edge || lx == 0 || ly == 0 ? OUT : ly == 1 || lx == 1 ? M[2] : ly == 7 || lx == 9 ? M[0] : M[1];
                    Put(frame, x0 + i + shake, y0 + j, c);
                }
            // 裂縫：從中間往外的鋸齒線，傷越重越多條
            int n = hp >= 1 ? 1 : hp > 0.5 ? 2 : 3;
            // 受傷時：右上角缺一塊（露出後面的黑）
            if (hp < 1) for (int j = 1; j < 9; j++) for (int i = W - 10 + j / 2; i < W - 1; i++) Put(frame, x0 + i + shake, y0 + j, P("#0a0810"));
            for (int k = 0; k < n; k++)
            {
                double cx = W / 2.0 + (k - 1) * 6, cy = 6 + k * 12;
                for (int s = 0; s < (hp >= 1 ? 14 : 30); s++)
                {
                    Put(frame, x0 + cx + shake, y0 + cy, OUT); Put(frame, x0 + cx + 1 + shake, y0 + cy, s % 4 != 0 ? OUT : P("#2a0a10"));
                    cx += Hash(k, s, 4) < 0.5 ? -1 : 1; cy += 1;
                    if (cy >= H - 1) break;
                }
            }
        }

        // ---------- 裂牆被撞破：牆上的每一塊垃圾各自變成一塊碎片，往衝撞的方向噴飛、落地彈一下、網點淡出
        public class Debris { public double x, y, w, h, vx, vy, floor, life, age, spin; public int bounced; public uint[] M; }
        public static List<Debris> CrackDebris(double x, double y, double H = 48, double dir = 1)
        {
            const int W = 32; double x0 = x - W / 2.0, y0 = y - H; var o = new List<Debris>();
            for (int row = 0; row < Math.Ceiling(H / 8); row++)
            {
                int off = row % 2 != 0 ? 5 : 0;
                for (int bx = 0; bx <= 3; bx++)
                {
                    double l = Math.Max(0, bx * 10 - off), r = Math.Min(W, bx * 10 + 10 - off);
                    if (r - l < 3) continue;
                    var M = JUNK[(int)Math.Floor(Hash(bx, row, 3) * JUNK.Length)]; double k = Hash(bx, row, 9);
                    double cx = x0 + (l + r) / 2, cy = y0 + row * 8 + 4, up = 1 - row / (H / 8);   // 上面的飛得高、下面的滾得遠
                    double near = dir > 0 ? (cx - x0) / W : 1 - (cx - x0) / W, j1 = Hash(bx, row, 12) - 0.5, j2 = Hash(bx, row, 13) - 0.5;
                    o.Add(new Debris { x = cx + j1 * 4, y = cy + j2 * 3, w = r - l - 1, h = 7, M = M, vx = dir * (70 + near * 170 + k * 150) * (Hash(bx, row, 14) < 0.15 ? -0.35 : 1) + j1 * 90, vy = -40 - up * 120 - k * 70 + j2 * 70, floor = y, life = 1.2 + k * 0.5, age = 0, bounced = 0, spin = k });
                }
            }
            return o;
        }
        public static void UpdateDebris(List<Debris> list, double dt)
        {
            foreach (var d in list)
            {
                d.age += dt; d.vy += 700 * dt; d.x += d.vx * dt; d.y += d.vy * dt;
                if (d.y > d.floor - 2 && d.vy > 0) { d.y = d.floor - 2; d.vy *= -0.3; d.vx *= 0.5; d.bounced++; if (d.bounced > 2) { d.vy = 0; d.vx *= 0.6; } }
            }
        }
        static readonly int[] BAY = { 0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5 };
        /// 碎片：越飛越小（翻滾的感覺）、落地之後最後 0.4 秒用網點淡出
        public static void DrawDebris(Frame frame, List<Debris> list)
        {
            foreach (var d in list)
            {
                if (d.age > d.life) continue;
                double fade = Math.Min(1, (d.life - d.age) / 0.4), shrink = d.bounced != 0 ? 0.75 : 1 - Math.Min(0.25, d.age * 0.5);
                int w = (int)Math.Max(2, Pf.Round(d.w * shrink * (0.7 + 0.3 * Math.Abs(Pf.Cos(d.age * 9 + d.spin * 6))))), h = (int)Math.Max(2, Pf.Round(d.h * shrink));
                int x0 = (int)Pf.Round(d.x - w / 2.0), y0 = (int)Pf.Round(d.y - h);
                for (int j = 0; j < h; j++) for (int i = 0; i < w; i++)
                    {
                        int X = x0 + i, Y = y0 + j;
                        if (fade < 1 && fade * 16 <= BAY[((Y & 3) << 2) | (X & 3)]) continue;
                        bool edge = i == 0 || j == 0 || i == w - 1 || j == h - 1;
                        Put(frame, X, Y, edge ? OUT : j == 1 || i == 1 ? d.M[2] : j == h - 2 ? d.M[0] : d.M[1]);
                    }
            }
        }

        // ---------- 深淵氣流：寬 w、高 h 的往上吹的風
        static readonly uint[] WIND = { P("#1a3a5a"), P("#3a7aa8"), P("#7ac8f0"), P("#c8f0ff") };
        static void Lit(Frame frame, double x, double y, uint c) { int X = (int)Pf.Round(x) - frame.Ox, Y = (int)Pf.Round(y) - frame.Oy; if (X >= 0 && Y >= 0 && X < frame.W && Y < frame.H && frame.Light[Y * frame.W + X] == 0) frame.Light[Y * frame.W + X] = c; }
        static readonly uint[] WIND_LIT = { 0x200e0904, 0x28140c06, 0x301c1208, 0x3826180a };   // 光層：由淡到亮（AABBGGRR）
        public static void DrawWind(Frame frame, double x, double y, double w, double h, double t)
        {
            double x0 = Pf.Round(x - w / 2);
            // 光柱：從出風口往上越來越淡（4 階，網點交錯）
            for (int j = 0; j < h; j++)
            {
                double f = 1 - j / h; int lv = f > 0.8 ? 3 : f > 0.55 ? 2 : f > 0.3 ? 1 : 0;
                if (lv == 0 && (j & 1) != 0) continue;
                // 中間亮、兩邊淡
                for (int i = 1; i < w - 1; i++)
                {
                    double e = Math.Min(i, w - 1 - i) / (w / 2); int l2 = Math.Max(0, lv - (e < 0.25 ? 2 : e < 0.5 ? 1 : 0));
                    if (((i + j) & 1) != 0 || (e > 0.6 && lv >= 2)) Lit(frame, x0 + i, y - j, WIND_LIT[l2]);
                }
            }
            // 兩側的氣流邊：一段段亮線往上爬
            foreach (double ex in new[] { x0, x0 + w - 1 }) for (int j = 0; j < h; j++)
                {
                    double ph = (j + t * 120 + (ex == x0 ? 0 : 17)) % 34;
                    if (ph < 9) Put(frame, ex + Pf.Round(Pf.Sin((j + t * 40) * 0.2)), y - j, ph < 3 ? WIND[3] : WIND[2], true);
                }
            // 往上飄的箭頭（︿）
            double na = Math.Max(2, Pf.Round(h / 70));
            for (int n = 0; n < na; n++)
            {
                double p = (t * 0.55 + n / na) % 1, cy = y - 10 - p * (h - 20), cx = x0 + w / 2 + Pf.Sin(p * 8 + n) * (w / 6);
                uint c = p < 0.7 ? WIND[3] : WIND[2];
                for (int k = -4; k <= 4; k++) { Put(frame, cx + k, cy + Math.Abs(k), c, true); if (p < 0.5) Put(frame, cx + k, cy + Math.Abs(k) + 1, WIND[1], true); }
            }
            for (int n = 0; n < Pf.Round(w / 1.6); n++)
            {
                double sx = x0 + Math.Floor(Hash(n, 1) * w), speed = 90 + Hash(n, 2) * 80, len = 6 + Math.Floor(Hash(n, 3) * 10);
                double head = y - ((t * speed + Hash(n, 4) * h) % h);
                for (int k = 0; k < len; k++)
                {
                    double yy = head + k, f = k / len, wob = Pf.Round(Pf.Sin((yy + n * 7) * 0.12) * 1.5);
                    if (yy > y || yy < y - h) continue;
                    int lv = f < 0.15 ? 3 : f < 0.45 ? 2 : f < 0.8 ? 1 : 0;
                    Put(frame, sx + wob, yy, WIND[lv], lv >= 2);
                }
            }
            // 被吹起來的小碎屑
            for (int n = 0; n < Pf.Round(w / 6); n++)
            {
                double p = (t * (0.5 + Hash(n, 11) * 0.4) + Hash(n, 12)) % 1, px = x0 + Hash(n, 13) * w + Pf.Sin(p * 9 + n) * 3, py = y - p * h;
                Put(frame, px, py, p < 0.6 ? WIND[3] : WIND[2], true);
            }
            // 地面的出風口：一排暗色的裂縫、出風口亮光一閃一閃
            for (int i = 0; i < w; i++) if (Hash(i, 9) < 0.5) Put(frame, x0 + i, y - 1, P("#0a1a2a"));
                else Put(frame, x0 + i, y - 1, Pf.Sin(t * 6 + i * 0.5) > 0 ? WIND[2] : WIND[1], true);
        }

        // ---------- 黏液菇：24×16；squash 0～1＝被踩扁的程度
        static readonly string[] SHROOM =
        {
            "......aaaaaaaaaa......",
            "....aabbbbbbbbbbaa....",
            "...abbbwwbbbbbbbbba...",
            "..abbbwwwbbbbsbbbbba..",
            ".abbbbbwbbbbbsssbbbba.",
            ".abbsbbbbbbbbbsbbbbba.",
            "abbsssbbbbbbbbbbbbcbba",
            "abbbsbbbbbbbbbbbbccbba",
            "accbbbbbbbbbbbbbccccca",
            ".acccccccccccccccccca.",
            "......dddddddddd......",
            "......deeeeeeeed......",
            "......deeeeeeeed......",
            "......deeeeeeefd......",
            ".....ddeeeeeeffdd.....",
            ".....dddddddddddd.....",
        };
        static readonly Dictionary<char, uint> SHROOM_MAP = new Dictionary<char, uint> { ['a'] = P("#2a6a2a"), ['b'] = P("#5ac84a"), ['c'] = P("#3a9a3a"), ['w'] = P("#e8ffd8"), ['s'] = P("#b4f890"), ['d'] = P("#3a2a1e"), ['e'] = P("#c8b08a"), ['f'] = P("#8a7454") };
        public static void DrawShroom(Frame frame, double x, double y, double squash = 0, double t = 0)
        {
            int w = SHROOM[0].Length;
            // 照 squash 把傘中間幾列拿掉（最多拿 4 列）、柄也縮短 2 列
            int drop = (int)Pf.Round(squash * 4), stemDrop = (int)Pf.Round(squash * 2);
            var scaled = SHROOM.Take(2).Concat(SHROOM.Skip(2 + drop).Take(Math.Max(0, 10 - (2 + drop)))).Concat(SHROOM.Skip(10).Take(1)).Concat(SHROOM.Skip(11 + stemDrop)).ToArray();
            Sprite(frame, scaled, Pf.Round(x - w / 2.0), Pf.Round(y - scaled.Length), SHROOM_MAP, "ws");
        }

        // ---------- 星光封印：24×48 的石門，中間一顆星的刻紋；lit 0～1＝被打亮的程度，open 0～1＝往上收進去
        static readonly uint[] SEAL_ST = { P("#141428"), P("#2a2e48"), P("#3c4466"), P("#545e84") }, SEAL_GOLD = { P("#6e3a0c"), P("#f0b424"), P("#ffe066"), P("#fff6c4") };
        public static void DrawSeal(Frame frame, double x, double y, double lit = 0, double open = 0, double t = 0, double H = 48)
        {
            const int W = 24; double x0 = Pf.Round(x - W / 2.0), y0 = Pf.Round(y - H), lift = Pf.Round(open * H);
            var ST = SEAL_ST; var GOLD = SEAL_GOLD;
            for (double j = lift; j < H; j++) for (int i = 0; i < W; i++)
                {
                    double yy = y0 + j - lift;
                    bool edge = i == 0 || i == W - 1 || j == lift;
                    uint c = edge ? OUT : i == 1 || j == lift + 1 ? ST[3] : i == W - 2 ? ST[1] : (j % 12 == 0 ? ST[1] : ST[2]);
                    Put(frame, x0 + i, yy, c);
                }
            if (open >= 1) return;
            // 中間的五角星輪廓：亮的時候沿著輪廓一點一點亮起來
            double cx = x0 + W / 2.0, cy = y0 + H / 2 - lift;
            var pts = new double[10][];
            for (int a = 0; a < 10; a++) { double ang = -Math.PI / 2 + (a * Math.PI) / 5, r = a % 2 != 0 ? 3.5 : 8.5; pts[a] = new[] { cx + Pf.Cos(ang) * r, cy + Pf.Sin(ang) * r }; }
            for (int a = 0; a < 10; a++)
            {
                double x1 = pts[a][0], y1 = pts[a][1], x2 = pts[(a + 1) % 10][0], y2 = pts[(a + 1) % 10][1];
                for (int k = 0; k <= 8; k++) { double f = k / 8.0; bool on = lit > (a + f) / 10; Put(frame, x1 + (x2 - x1) * f, y1 + (y2 - y1) * f, on ? GOLD[2] : ST[0], on); }
            }
            if (lit > 0) Put(frame, cx, cy, GOLD[3], true);
            // 門縫透出的光（打亮之後）
            if (lit >= 1) for (int j = 2; j < H - 2; j += 3) Put(frame, x0 + W - 1, y0 + j - lift, GOLD[1], true);
        }

        // ---------- 一次性資源
        static readonly Dictionary<char, uint> STONE = new Dictionary<char, uint> { ['a'] = P("#1e2236"), ['b'] = P("#2e3450"), ['c'] = P("#454e72"), ['d'] = P("#6a7498"), ['e'] = P("#9aa4c4") };
        // 柔光：只寫在光層（不蓋顏色），越外面越淡
        static void GlowRing(Frame frame, double cx, double cy, double r, uint c, double k = 0.45)
        {
            uint cr = c & 255, cg = (c >> 8) & 255, cb = (c >> 16) & 255;
            for (double dy = -r; dy <= r; dy++) for (double dx = -r; dx <= r; dx++)
                {
                    double d = Pf.Hypot(dx, dy); if (d > r) continue;
                    int gx = (int)Pf.Round(cx + dx) - frame.Ox, gy = (int)Pf.Round(cy + dy) - frame.Oy;
                    if (gx < 0 || gy < 0 || gx >= frame.W || gy >= frame.H) continue;
                    int i = gy * frame.W + gx; double f = Pf.Pow(1 - d / r, 2) * k; uint o = frame.Light[i];
                    frame.Light[i] = 0xff000000u | ((uint)Pf.ToInt32(Math.Min(255, ((o >> 16) & 255) + cb * f)) << 16) | ((uint)Pf.ToInt32(Math.Min(255, ((o >> 8) & 255) + cg * f)) << 8) | (uint)Pf.ToInt32(Math.Min(255, (o & 255) + cr * f));
                }
        }

        // ---------- 星之殘火：刻花的石台上浮著一團星形的火，火舌往上舔，火星往上飄
        static readonly uint[] EMBER_F = { P("#6e2a0c"), P("#d8641a"), P("#f0b424"), P("#ffe066"), P("#fff6c4"), P("#ffffff"), P("#5ac8ff") };
        static readonly string[] PED =
        {
            ".eeeeeeeeeeeeeeee.",
            "edddddddddddddddcb",
            ".cccccccccccccccb.",
            "..bcccccccccccbb..",
            "...abbbbbbbbbba...",
            ".....bccccbbb.....",
            ".....bccccbbb.....",
            "...dcccccccccbb...",
            "..ddccccccccccbba.",
            "..aaaaaaaaaaaaaaa.",
        };
        public static void DrawEmber(Frame frame, double x, double y, double t)
        {
            var F = EMBER_F;
            double px0 = Pf.Round(x - 9), py0 = Pf.Round(y - PED.Length);
            // 碗裡的炭火（碗口那排）
            Sprite(frame, PED, px0, py0, STONE);
            for (int i = 2; i < 16; i++) Put(frame, px0 + i, py0 + 1, Hash(i, Math.Floor(t * 8)) < 0.5 ? F[1] : F[2], true);
            double cx = Pf.Round(x), cy = Pf.Round(py0 - 7 + Pf.Sin(t * 2.4) * 1.5);
            // 火舌（畫在星的後面）：5 條，中間最長，長度一直晃
            for (int k = -2; k <= 2; k++)
            {
                double len = 13 - Math.Abs(k) * 3 + Pf.Round(Pf.Sin(t * 8 + k * 1.9) * 2);
                for (int j = 0; j < len; j++)
                {
                    double f = j / len, sway = Pf.Round(Pf.Sin(t * 6 + j * 0.7 + k) * f * 1.8), fx = cx + k * 2 + sway, fy = cy - 4 - j;
                    uint c = f < 0.35 ? F[4] : f < 0.6 ? F[3] : f < 0.85 ? F[2] : F[1];
                    Put(frame, fx, fy, c, true);
                    if (f < 0.5) Put(frame, fx + (k <= 0 ? -1 : 1), fy, f < 0.25 ? F[3] : F[2], true);
                }
            }
            // 星形的芯：五角星（外框暗橘、金、白芯），底下一點藍根
            for (int dy = -5; dy <= 5; dy++) for (int dx = -5; dx <= 5; dx++)
                {
                    double a = Pf.Atan2(dy, dx) + Math.PI / 2, d = Pf.Hypot(dx, dy), R = 2.4 + 3 * Pf.Pow(Math.Max(0, Pf.Cos(a * 5)), 3);
                    if (d > R + 0.9) continue;
                    Put(frame, cx + dx, cy + dy, d > R - 0.1 ? F[0] : d < 1.5 ? F[5] : d < 2.5 ? F[4] : F[3], d <= R - 0.1);
                }
            Put(frame, cx - 1, cy + 5, F[6], true); Put(frame, cx, cy + 6, F[6], true); Put(frame, cx + 1, cy + 5, F[6], true);
            // 火星：往上飄、左右晃，越高越暗
            for (int k = 0; k < 5; k++)
            {
                const double life = 1.4; double p = ((t + k * 0.29) % life) / life, sx = cx + Pf.Round(Pf.Sin(p * 9 + k * 2) * 3 + (Hash(k, Math.Floor((t + k * 0.29) / life)) - 0.5) * 8), sy = cy - 6 - p * 20;
                Put(frame, sx, sy, p < 0.4 ? F[4] : p < 0.75 ? F[2] : F[1], true);
            }
            GlowRing(frame, cx, cy - 3, 11, F[2]);
        }

        // ---------- 星塵礦脈：一塊圓圓的岩石上斜插 5 根大水晶；hits 0～2：岩石多一道裂縫、水晶少一根
        static readonly uint[] VEIN_CR = { P("#0e3a5a"), P("#1a7aa8"), P("#4cd8ec"), P("#a0f2fa"), P("#ffffff") };
        static readonly double[][] XT = { new[] { -9, 13, -0.45 }, new[] { -3, 20, -0.12 }, new[] { 3, 17, 0.18 }, new[] { 9, 12, 0.5 }, new[] { -6, 9, -0.8 } };
        static readonly int[][][] VEIN_CRACKS = { new[] { new[] { 0, 0 }, new[] { 1, 1 }, new[] { 1, 2 }, new[] { 2, 3 }, new[] { 2, 4 }, new[] { 3, 5 } }, new[] { new[] { 0, 0 }, new[] { -1, 1 }, new[] { -1, 2 }, new[] { -2, 3 }, new[] { -3, 4 }, new[] { -3, 5 }, new[] { -4, 6 } } };
        public static void DrawVein(Frame frame, double x, double y, int hits = 0, double t = 0)
        {
            var CR = VEIN_CR;
            const int W = 30; double X0 = Pf.Round(x - 15), shake = hits > 0 && Pf.Sin(t * 40) > 0.75 ? 1 : 0;
            // 水晶（先畫，岩石蓋在根部）：[根部 x, 長度, 傾斜]
            for (int k = 0; k < XT.Length; k++)
            {
                double dx = XT[k][0], len = XT[k][1], lean = XT[k][2];
                if (k >= XT.Length - hits * 2) continue;
                for (int j = 0; j < len; j++)
                {
                    double cx = Pf.Round(x + dx + lean * j + shake), cy = Pf.Round(y - 6 - j), tip = len - j;
                    int half = tip <= 1 ? 0 : tip <= 3 ? 1 : 2;
                    for (int i = -half - 1; i <= half + 1; i++)
                    {
                        bool edge = Math.Abs(i) == half + 1;
                        Put(frame, cx + i, cy, edge ? OUT : tip <= 2 ? CR[4] : i < 0 ? CR[3] : i == 0 ? CR[2] : CR[1], !edge && (tip <= 3 || i < 0));
                    }
                }
                Put(frame, Pf.Round(x + dx + lean * len + shake), Pf.Round(y - 6 - len), OUT);
            }
            // 岩石：半圓的一塊，左上亮、右下暗、頂上一圈亮邊
            for (int i = 0; i < W; i++)
            {
                double u = (i - W / 2.0 + 0.5) / (W / 2.0), hh = Pf.Round(9 * Math.Sqrt(Math.Max(0, 1 - u * u)) + (Hash(i, 7) < 0.3 ? 1 : 0));
                for (int j = 0; j < hh; j++)
                {
                    double yy = y - 1 - j; bool top = j == hh - 1, lit = u < -0.2 && j > hh * 0.4;
                    Put(frame, X0 + i, yy, top ? STONE['e'] : lit ? STONE['d'] : u > 0.45 || j < 2 ? STONE['b'] : STONE['c']);
                }
                Put(frame, X0 + i, y - 1 - hh, OUT);
            }
            Put(frame, X0 - 1, y - 1, OUT); Put(frame, X0 + W, y - 1, OUT);
            // 裂縫：敲一下多一條
            for (int c = 0; c < Math.Min(hits, 2); c++) foreach (var q in VEIN_CRACKS[c]) Put(frame, x + (c != 0 ? -4 : 3) + q[0], y - 9 + q[1], OUT);
            // 閃光：每 2 秒一根水晶的尖端閃一下
            double g = Math.Floor(t / 2) % 5, gp = (t % 2) / 2;
            if (gp < 0.18 && g < XT.Length - hits * 2)
            {
                var q = XT[(int)g]; double dx = q[0], len = q[1], lean = q[2], gx = Pf.Round(x + dx + lean * (len - 2)), gy = Pf.Round(y - 6 - (len - 2)); int r = gp < 0.09 ? 2 : 1;
                for (int i = -r; i <= r; i++) { Put(frame, gx + i, gy, CR[4], true); Put(frame, gx, gy + i, CR[4], true); }
            }
            GlowRing(frame, x, y - 14, 13, CR[1]);
        }

        // ---------- 魔物化石核：半埋在土堆裡的大魔物頭骨，眼窩裡嵌著一顆發光的核（形態的顏色），後面翹著兩根肋骨
        static readonly uint[] BONE = { P("#4a3a2e"), P("#8a7a60"), P("#c8b896"), P("#efe4c8") }, DIRT = { P("#2a1c14"), P("#4a3424"), P("#6a4c32") };
        public static void DrawFossil(Frame frame, double x, double y, double t, string color = null)
        {
            color = color ?? "#b878ff";
            double k = Pf.Sin(t * 2) * 0.5 + 0.5; uint GL = P(color), WH = P("#ffffff");
            double cx = Pf.Round(x), bas = Pf.Round(y);
            // 肋骨：右後方兩根彎彎的骨頭
            foreach (var (ox, h, bend) in new[] { (5.0, 22.0, 0.55), (10, 17, 0.7) })
            {
                for (int j = 0; j < h; j++)
                {
                    double q = j / h, bx = Pf.Round(cx + ox + Pf.Sin(q * 1.6) * bend * 9), by = bas - 4 - j;
                    Put(frame, bx - 1, by, OUT); Put(frame, bx, by, BONE[3]); Put(frame, bx + 1, by, BONE[2]); Put(frame, bx + 2, by, BONE[1]); Put(frame, bx + 3, by, OUT);
                }
                double tx = Pf.Round(cx + ox + Pf.Sin(1.6) * bend * 9), ty = bas - 4 - h;
                Put(frame, tx, ty, BONE[3]); Put(frame, tx + 1, ty, BONE[2]); Put(frame, tx, ty - 1, OUT); Put(frame, tx + 1, ty - 1, OUT);
            }
            // 頭骨：大圓頂（下半埋在土裡）
            double sx = cx - 4, sy = bas - 9; const double rx = 11, ry = 9;
            for (double dy = -ry - 1; dy <= 4; dy++) for (double dx = -rx - 1; dx <= rx + 1; dx++)
                {
                    double d = Pf.Hypot(dx / rx, dy / ry);
                    if (d > 1.08) continue;
                    double X = sx + dx, Y = sy + dy;
                    if (d > 0.95) { Put(frame, X, Y, OUT); continue; }
                    Put(frame, X, Y, dx + dy < -8 ? BONE[3] : dx + dy < 0 ? BONE[2] : dx + dy < 6 ? BONE[1] : BONE[0]);
                }
            // 頭骨上的裂紋、鼻孔、牙
            foreach (var (dx, dy) in new[] { (2, -7), (3, -6), (3, -5), (4, -4) }) Put(frame, sx + dx, sy + dy, BONE[0]);
            Put(frame, sx + 3, sy + 1, OUT); Put(frame, sx + 4, sy + 1, OUT);
            for (int i = -6; i <= 4; i += 2) { Put(frame, sx + i, sy + 4, BONE[3]); Put(frame, sx + i + 1, sy + 4, OUT); }
            // 眼窩（右邊小的空著）＋左邊大的嵌著核
            foreach (var (dx, dy) in new[] { (6, -2), (7, -2), (6, -1), (7, -1) }) Put(frame, sx + dx, sy + dy, OUT);
            double ex = sx - 4, ey = sy - 2;
            for (int dy = -5; dy <= 5; dy++) for (int dx = -5; dx <= 5; dx++)
                {
                    double d = Pf.Hypot(dx, dy);
                    if (d > 5.2) continue;
                    if (d > 3.3) Put(frame, ex + dx, ey + dy, d > 4.4 ? OUT : P("#141018"));
                }
            // 核：會呼吸的光球（暗邊、本色、亮、白點），外面一圈光
            uint LI = P(Lighten(color));
            for (int dy = -3; dy <= 3; dy++) for (int dx = -3; dx <= 3; dx++)
                {
                    double d = Pf.Hypot(dx, dy); if (d > 3.3) continue;
                    Put(frame, ex + dx, ey + dy, d < 1.2 ? WH : dx + dy < -1 ? LI : GL, d < 3);
                }
            Put(frame, ex - 1, ey - 2, WH, true);
            GlowRing(frame, ex, ey, 8 + Pf.Round(k * 3), GL, 0.3);
            // 光點：從核往上飄
            for (int m = 0; m < 3; m++) { double p = ((t * 0.6 + m * 0.33) % 1); Put(frame, ex + Pf.Round(Pf.Sin(p * 8 + m) * 3), ey - 6 - p * 14, p < 0.6 ? GL : LI, true); }
            // 土堆：把頭骨下半部埋起來
            for (int i = -16; i <= 16; i++)
            {
                double u = i / 16.0, hh = Pf.Round(5 * Math.Sqrt(Math.Max(0, 1 - u * u)) + (Hash(i, 9) < 0.35 ? 1 : 0));
                for (int j = 0; j < hh; j++) Put(frame, cx + i, bas - 1 - j, j == hh - 1 ? DIRT[2] : Hash(i, j, 4) < 0.2 ? DIRT[0] : DIRT[1]);
                Put(frame, cx + i, bas - 1 - hh, OUT);
            }
        }
        static string Lighten(string hexStr)
        {
            int n = Convert.ToInt32(hexStr.Substring(1), 16);
            int F(int v) => (int)Math.Min(255, v + Pf.Round((255 - v) * 0.55));
            return "#" + F(n >> 16).ToString("x2") + F((n >> 8) & 255).ToString("x2") + F(n & 255).ToString("x2");
        }

        // ---------- 被丟下來的寶箱：正正地坐在一圈焦黑的坑裡、有點破損的鐵箍木箱；opened＝蓋子往後翻開、裡面暗掉
        static readonly uint[] SAFE_WD = { P("#3a1a14"), P("#6a2e1e"), P("#8e4428"), P("#b0603a") }, SAFE_FE = { P("#2a2a36"), P("#5c5a6a"), P("#8a8898"), P("#b8b6c4") }, SAFE_GD = { P("#8a5a10"), P("#f0b424"), P("#ffe066"), P("#fff6c4") };
        public static void DrawSafe(Frame frame, double x, double y, bool opened = false, double t = 0)
        {
            var WD = SAFE_WD; var FE = SAFE_FE; var GD = SAFE_GD;
            double cx = Pf.Round(x), bas = Pf.Round(y);
            // 焦黑的坑
            for (int i = -23; i <= 23; i++) { double u = Math.Abs(i) / 23.0; Put(frame, cx + i, bas - 1, u > 0.85 ? P("#3a2a20") : P("#140c0c")); if (u < 0.7) Put(frame, cx + i, bas - 2, P("#241818")); }
            const int BW = 31, BH = 17, LH = 10; double x0 = cx - 16, y0 = bas - 2 - BH;
            Func<int, int> sh = j => 0;
            bool Chipped(int i, int j) => i >= BW - 5 && j <= 4 - (BW - 1 - i);   // 右上角缺一塊（三角形）
            for (int j = 0; j < BH; j++) for (int i = -1; i <= BW; i++)
                {
                    double X = x0 + i + sh(j), Y = y0 + j;
                    if (Chipped(i, j)) continue;
                    if (i == -1 || i == BW || j == BH - 1 || Chipped(i - 1, j) || Chipped(i, j - 1)) { Put(frame, X, Y, OUT); continue; }
                    bool brokeBand = (i == 2 || i == 3) && j >= 7 && j <= 12;   // 左邊鐵條斷一截
                    bool band = (i == 2 || i == 3 || i == BW - 4 || i == BW - 3) && !brokeBand;
                    bool crack = j >= 5 && j <= 12 && i == 19 + ((j * 3) % 2) - (j > 9 ? 1 : 0);   // 一條木板裂開
                    Put(frame, X, Y, crack ? OUT : band ? (i % 2 != 0 ? FE[2] : FE[1]) : brokeBand && (j == 7 || j == 12) ? (i == 2 ? FE[3] : FE[0]) : brokeBand && j == 8 && i == 3 ? FE[2] : (j + (i >> 2)) % 4 == 0 ? WD[0] : i < 6 ? WD[3] : WD[2]);
                }
            // 鎖片（金）
            double lx = x0 + 13 + sh(2);
            for (int j = 0; j < 5; j++) for (int i = 0; i < 5; i++) Put(frame, lx + i, y0 + j, j == 0 || i == 0 ? GD[2] : j == 4 || i == 4 ? GD[0] : GD[1]);
            Put(frame, lx + 2, y0 + 2, OUT); Put(frame, lx + 2, y0 + 3, OUT);
            double ly0 = y0 - LH; int lsh = sh(0) + 1;
            if (!opened)
            {
                // 蓋子：半圓拱頂，鐵箍
                for (int j = 0; j < LH; j++) for (int i = -1; i <= BW; i++)
                    {
                        double u = (i - BW / 2.0 + 0.5) / (BW / 2.0 + 1), top = LH - Pf.Round(LH * Math.Sqrt(Math.Max(0, 1 - u * u)) * 0.95);
                        if (j < top - 1) continue;
                        double X = x0 + i + lsh - 1, Y = ly0 + j;
                        if (j == top - 1 || i == -1 || i == BW) { Put(frame, X, Y, OUT); continue; }
                        bool band = i == 2 || i == 3 || i == BW - 4 || i == BW - 3;
                        Put(frame, X, Y, band ? FE[3 - (j > 4 ? 1 : 0)] : j == top ? WD[3] : i < 7 ? WD[3] : WD[2]);
                    }
                // 縫：一排金光一閃一閃，往上漏幾道光
                for (int i = 0; i < BW; i++) Put(frame, x0 + i + sh(0), y0 - 1, Hash(i, Math.Floor(t * 10)) < 0.65 ? GD[3] : GD[2], true);
                for (int r = 0; r < 3; r++)
                {
                    double rx = x0 + 6 + r * 9 + sh(0), len = 4 + Pf.Round((Pf.Sin(t * 3 + r * 2) * 0.5 + 0.5) * 5);
                    for (int j = 1; j <= len; j++) { double gi = (rx - frame.Ox) + (y0 - 1 - j - frame.Oy) * frame.W; if (gi >= 0 && gi < frame.Light.Length && frame.Light[(int)gi] == 0) frame.Light[(int)gi] = GD[1]; }
                }
                // 從天上掉下來還在冒的細煙
                for (int m = 0; m < 3; m++) { double p = ((t * 0.4 + m * 0.33) % 1); Put(frame, x0 + BW + sh(0) - 2 + Pf.Round(Pf.Sin(p * 6 + m) * 2), ly0 - 2 - p * 18, p < 0.5 ? P("#6a6070") : P("#463e4c")); }
                GlowRing(frame, cx, y0 - 2, 16, GD[1]);
            }
            else
            {
                // 打開：箱子裡面黑掉、只剩幾點金屑；蓋子直直地立在箱子後面
                for (int i = 0; i < BW; i++) Put(frame, x0 + i + sh(0), y0, i < 2 || i > BW - 3 ? OUT : P("#120a0a"));
                for (int i = 4; i < BW - 4; i += 6) Put(frame, x0 + i + sh(0), y0, GD[0]);
                for (int j = 0; j < 12; j++) for (int i = -1; i <= BW; i++)
                    {
                        double X = x0 + i + sh(0) + 1 - Pf.Round(j * 0.25), Y = y0 - 2 - j;
                        Put(frame, X, Y, i == -1 || i == BW || j == 11 ? OUT : (i == 2 || i == 3 || i == BW - 4 || i == BW - 3) ? FE[1] : j < 2 ? WD[0] : WD[1]);
                    }
            }
        }

        // ---------- 星王的碑文：拱頂的石碑（右上角缺一塊），頂上刻一顆星，下面四排符文，底座長青苔
        static readonly int[][][] STELE_GLYPH = { new[] { new[] { 0, 0 }, new[] { 1, 0 }, new[] { -1, 0 }, new[] { 0, -1 }, new[] { 0, 1 } }, new[] { new[] { -1, 1 }, new[] { 0, 0 }, new[] { 1, -1 }, new[] { 1, 1 } }, new[] { new[] { -1, -1 }, new[] { 1, -1 }, new[] { 0, 0 }, new[] { -1, 1 }, new[] { 1, 1 } }, new[] { new[] { -1, 0 }, new[] { 0, 0 }, new[] { 1, 0 }, new[] { 0, 1 } } };
        public static void DrawStele(Frame frame, double x, double y, bool read = false, double t = 0)
        {
            const int W = 22, H = 32; double x0 = Pf.Round(x - W / 2.0), y0 = Pf.Round(y - H - 4);
            // 底座
            for (int j = 0; j < 4; j++) for (int i = -3; i < W + 3; i++) Put(frame, x0 + i, y0 + H + j, j == 0 ? STONE['e'] : i < 2 ? STONE['c'] : j == 3 ? STONE['a'] : STONE['b']);
            // 碑身：拱頂、右上角缺角；左邊亮、右邊暗
            for (int j = 0; j < H; j++) for (int i = 0; i < W; i++)
                {
                    double u = (i - W / 2.0 + 0.5) / (W / 2.0), arch = j < 6 ? 6 - Pf.Round(6 * Math.Sqrt(Math.Max(0, 1 - u * u))) : 0;
                    bool chip = i > W - 6 && j < 9 && i - (W - 6) > j - 3;
                    if (j < arch || chip) continue;
                    bool edgeL = i == 0 || j == arch, edgeR = i == W - 1;
                    Put(frame, x0 + i, y0 + j, edgeL ? STONE['e'] : edgeR ? STONE['a'] : i < 4 ? STONE['d'] : i > W - 5 ? STONE['b'] : STONE['c']);
                }
            // 外框
            bool Inside(int ii, int jj)
            {
                if (ii < 0 || jj < 0 || ii >= W || jj >= H) return false;
                double u = (ii - W / 2.0 + 0.5) / (W / 2.0), arch = jj < 6 ? 6 - Pf.Round(6 * Math.Sqrt(Math.Max(0, 1 - u * u))) : 0;
                bool chip = ii > W - 6 && jj < 9 && ii - (W - 6) > jj - 3; return jj >= arch && !chip;
            }
            for (int j = -1; j <= H; j++) for (int i = -1; i <= W; i++)
                    if (!Inside(i, j) && (Inside(i + 1, j) || Inside(i - 1, j) || Inside(i, j + 1) || Inside(i, j - 1))) Put(frame, x0 + i, y0 + j, OUT);
            // 裂紋
            foreach (var (dx, dy) in new[] { (4, 20), (5, 21), (5, 22), (6, 23), (6, 24) }) Put(frame, x0 + dx, y0 + dy, STONE['a']);
            // 符文：沒讀＝暗刻痕＋每 3 秒淡淡亮一次紫；讀過＝金色，由上往下一排一排亮
            double pulse = (t % 3) / 3; uint RUNE_D = P("#1a1830"); uint[] V = { P("#4a3a8a"), P("#8a6ae0") }, G = { P("#c8861a"), P("#ffe066") };
            for (int line = 0; line < 4; line++) for (int i = 0; i < 5; i++)
                {
                    double gx = x0 + 3 + i * 4, gy = y0 + 13 + line * 4; int kind = (int)Math.Floor(Hash(line, i, 5) * 4);
                    uint c = RUNE_D; bool glow = false;
                    if (read) { bool on = Pf.Sin(t * 2.2 - line * 0.8) > -0.2; c = on ? G[1] : G[0]; glow = on; }
                    else if (pulse < 0.25) { double k = Pf.Sin((pulse / 0.25) * Math.PI); c = k > 0.5 ? V[1] : V[0]; glow = k > 0.3; }
                    foreach (var q in STELE_GLYPH[kind]) Put(frame, gx + q[0], gy + q[1], c, glow);
                }
            // 頂上的星（刻在拱頂裡）
            uint sc = read ? P("#fff6c4") : pulse < 0.25 ? V[1] : STONE['e']; double scx = x0 + W / 2.0 - 1, scy = y0 + 7;
            for (int dy = -3; dy <= 3; dy++) for (int dx = -3; dx <= 3; dx++) { double a = Pf.Atan2(dy, dx) + Math.PI / 2, d = Pf.Hypot(dx, dy), R = 1.2 + 2 * Pf.Pow(Math.Max(0, Pf.Cos(a * 5)), 2); if (d <= R + 0.4) Put(frame, scx + dx, scy + dy, sc, read || pulse < 0.25); }
            // 底部的青苔
            for (int i = 0; i < W; i++) { double h = Pf.Round(Hash(i, 3) * 3); for (int j = 0; j < h; j++) Put(frame, x0 + i, y0 + H - 1 - j, j == h - 1 ? P("#5a9a3a") : P("#2a5a2a")); }
            if (read) GlowRing(frame, x0 + W / 2.0, y0 + 18, 14, G[0]);
            else if (pulse < 0.25) GlowRing(frame, x0 + W / 2.0, y0 + 18, 12, V[0]);
        }
    }
}
