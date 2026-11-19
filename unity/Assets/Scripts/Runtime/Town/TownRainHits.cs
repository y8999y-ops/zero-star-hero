// 碎星鎮：雨跟房子、物件互動（Unity 版自己的，不跟網頁版比對）。scene-fx skill §3、§4。
//  1. 接雨面：載入時從建築圖層（MAIN）每一欄由上往下找第一個不透明的像素＝屋頂／物件頂。換建築、移動建築都會自動跟著變。
//  2. 雨打在屋頂和物件頂上：一個亮點，然後兩顆小水珠往左右彈開。
//  3. 屋簷滴水：屋頂邊緣下面是空的那幾欄＝滴水點，水珠在簷下慢慢長大、掉下去，落地起漣漪；屋簷下的地面比較早積水。
//  4. 慢慢變濕（照 Mushreb DEV LOG.05 雪的堆積遮罩）：分數＝「離受雨頂面多近」＋往下拉長的雜訊，濕度越高門檻越低，
//     從屋頂往下一條條濕下來；屋簷下被擋住的牆不會濕。濕的地方變深、飽和一點，頂面一條濕亮邊，有幾條水痕慢慢往下流。
// 效能：遮罩分數載入時算一次存 byte；每格只查表、比門檻，畫面切 8 段同時算。
using System;
using System.Collections.Generic;
using PixelFX;

namespace ZeroStar
{
    public static class TownRainHits
    {
        const int FLOOR = TownArt.FLOOR, TOWN_W = TownArt.TOWN_W, H = TownArt.H;
        const int WET_BOTTOM = FLOOR - 4;        // 再往下是草皮、地面（積水管）

        static uint[] main; static byte[] emit;
        static int[] topY;                        // 每一欄的接雨面（-1＝沒有）
        static int[] hiY;                         // 濕亮邊畫在哪一列：頂面往下第一個不是外框（暗色）的像素
        static byte[] score;                      // 每一格變濕的分數（0＝不會濕）
        static byte[] trickle;                    // 每一欄有沒有往下流的水痕（0＝沒有，其他＝速度與相位的種子）
        struct Drip { public int x, y0, y1; public double period, phase; public int lastCycle; }
        static readonly List<Drip> drips = new List<Drip>();
        struct Hit { public int x, y; public double t; }
        static readonly List<Hit> hits = new List<Hit>();
        static double lastT = -1;
        public static bool DebugLog;   // 開發用：載入時印出滴水點

        static double Hash(int i, int s) { unchecked { uint h = (uint)(i * 374761393 + s * 668265263); h = (h ^ (h >> 13)) * 1274126177; h ^= h >> 16; return (h & 0xffffff) / 16777216.0; } }
        static double Noise2(double x, double y, int s)
        {
            int ix = (int)Math.Floor(x), iy = (int)Math.Floor(y); double fx = x - ix, fy = y - iy;
            fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
            double a = Hash(ix + iy * 7919, s), b = Hash(ix + 1 + iy * 7919, s), c = Hash(ix + (iy + 1) * 7919, s), d = Hash(ix + 1 + (iy + 1) * 7919, s);
            return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
        }
        static bool Dark(uint c) => (c & 255) + ((c >> 8) & 255) + ((c >> 16) & 255) < 150;   // 外框（黑）不碰：外框只能是黑色
        static bool Solid(int x, int y) => x >= 0 && x < TOWN_W && y >= 0 && y < H && main[y * TOWN_W + x] != 0;

        /// 載入（或重新擺放建築）之後叫一次
        public static void Build(uint[] mainLayer, byte[] emitLayer)
        {
            main = mainLayer; emit = emitLayer;
            topY = new int[TOWN_W]; hiY = new int[TOWN_W]; score = new byte[TOWN_W * H]; trickle = new byte[TOWN_W];
            drips.Clear(); hits.Clear(); lastT = -1;
            for (int x = 0; x < TOWN_W; x++)
            {
                topY[x] = -1;
                for (int y = 0; y < FLOOR - 6; y++) if (Solid(x, y)) { topY[x] = y; break; }
                hiY[x] = -1;
                if (topY[x] < 0) continue;
                for (int y = topY[x]; y < Math.Min(topY[x] + 3, WET_BOTTOM); y++) { if (!Solid(x, y)) break; if (!Dark(main[y * TOWN_W + x])) { hiY[x] = y; break; } }
                // 從頂面往下：越往下越不濕；碰到空的（屋簷下）就被擋住，下面都不濕
                double expo = 1;
                for (int y = topY[x]; y < WET_BOTTOM; y++)
                {
                    if (!Solid(x, y))
                    {
                        // 空的：短短一段（屋頂上的小東西、圖裡的小縫）雨還是淋得到下面，跳過去；長的一段＝屋簷下，被擋住
                        int gap = 0; while (y + gap < WET_BOTTOM && !Solid(x, y + gap)) gap++;
                        if (gap > 6 || y + gap >= WET_BOTTOM) break;
                        y += gap - 1; expo -= gap / 64.0; continue;
                    }
                    double n = Noise2(x / 2.6, y / 13.0, 3) * 0.8 + Noise2(x / 7.0, y / 5.0, 4) * 0.2;   // 往下拉長的雜訊＝水痕
                    double s = expo * 0.95 + (n - 0.5) * 0.45;
                    score[y * TOWN_W + x] = (byte)Math.Max(0, Math.Min(255, s * 200 + 40));
                    expo -= 1 / 64.0;
                }
                if (Hash(x, 21) < 0.12 && FLOOR - topY[x] > 24) trickle[x] = (byte)(1 + Hash(x, 22) * 254);
            }
            // 屋簷滴水點：頂面下面有一段是空的（凸出去的屋簷、陽台），而且旁邊那一欄比較低（邊緣）
            int lastX = -99;
            var land = new List<int>();
            for (int x = 1; x < TOWN_W - 1; x++)
            {
                int t = topY[x]; if (t < 0) continue;
                int yb = -1;
                for (int y = t; y < FLOOR - 6; y++) if (!Solid(x, y)) { yb = y; break; }
                if (yb < 0) continue;
                bool edge = topY[x - 1] < 0 || topY[x - 1] > yb || topY[x + 1] < 0 || topY[x + 1] > yb;
                if (!edge || x - lastX < 5) continue;
                int y1 = FLOOR;
                for (int y = yb + 1; y < FLOOR; y++) if (Solid(x, y)) { y1 = y; break; }
                if (y1 - yb < 10) continue;
                drips.Add(new Drip { x = x, y0 = yb, y1 = y1, period = 0.55 + Hash(x, 31) * 0.8, phase = Hash(x, 32) * 3, lastCycle = int.MinValue });
                if (y1 >= FLOOR) land.Add(x);
                lastX = x;
            }
            TownPuddles.SetDrips(land);
            if (DebugLog) UnityEngine.Debug.Log("[RainHits] 屋簷滴水點 " + drips.Count + "：" + string.Join(",", drips.ConvertAll(d => d.x + "@" + d.y0 + "-" + d.y1)));
        }

        /// 開發用：濕的分數圖（世界座標，灰階）、接雨面（紅）
        public static byte[] DebugScore(out int w, out int h, out int[] top) { w = TOWN_W; h = H; top = topY; return score; }
        static uint Pack(double r, double g, double b) => unchecked(0xff000000u | ((uint)Math.Min(255, Math.Max(0, b)) << 16) | ((uint)Math.Min(255, Math.Max(0, g)) << 8) | (uint)Math.Min(255, Math.Max(0, r)));
        static void Px(Frame f, int wx, int wy, uint c)
        {
            int x = wx - f.Ox, y = wy - f.Oy;
            if (x < 0 || y < 0 || x >= f.W || y >= f.H) return;
            f.Color[y * f.W + x] = c;
        }

        /// 畫在建築之後、角色之前（角色會擋住屋簷滴下來的水）。rain＝雨量 0～1、day＝白天程度
        public static void Draw(Frame frame, double time, double rain, double day)
        {
            if (main == null) return;
            double dt = lastT < 0 ? 0 : Math.Max(0, Math.Min(0.1, time - lastT)); lastT = time;
            double wet = TownPuddles.Wet;
            int W = frame.W, cx = frame.Ox, cy = frame.Oy;
            if (wet > 0.02) WetPass(frame, time, wet, day);
            uint hot = Pack(232, 242, 255), cool = Pack(150 + 60 * day, 178 + 50 * day, 215 + 30 * day);

            // 雨打在屋頂、物件頂：每 1/30 秒一個時段，畫面內抽幾欄
            if (rain > 0.03)
            {
                int slot = (int)Math.Floor(time * 30), prev = (int)Math.Floor((time - dt) * 30);
                for (int s = prev + 1; s <= slot && s - prev < 6; s++)
                    for (int k = 0; k < 6; k++)
                    {
                        if (Hash(s * 13 + k, 41) > rain * 0.7) continue;
                        int x = cx + (int)(Hash(s * 13 + k, 42) * W);
                        if (x < 0 || x >= TOWN_W || topY[x] < 0) continue;
                        hits.Add(new Hit { x = x, y = topY[x], t = 0 });
                    }
            }
            for (int i = hits.Count - 1; i >= 0; i--)
            {
                var h = hits[i]; h.t += dt;
                if (h.t > 0.28) { hits.RemoveAt(i); continue; }
                hits[i] = h;
                if (h.t < 0.05) { Px(frame, h.x, h.y - 1, hot); continue; }
                double u = (h.t - 0.05) / 0.23;
                for (int sgn = -1; sgn <= 1; sgn += 2)
                {
                    int px = h.x + sgn * (int)Math.Round(1 + 3 * u), py = h.y - 1 - (int)Math.Round(4 * u - 5 * u * u);
                    Px(frame, px, py, u < 0.5 ? hot : cool);
                }
            }

            // 屋簷滴水：雨停了還濕的時候也會滴，越乾越慢
            if (wet > 0.12)
                for (int i = 0; i < drips.Count; i++)
                {
                    var d = drips[i];
                    if (d.x - cx < -2 || d.x - cx > W + 2) continue;
                    double per = d.period / Math.Max(0.25, Math.Min(1, rain + wet * 0.5));
                    double ph = (time + d.phase) / per; int cyc = (int)Math.Floor(ph); double u = (ph - cyc) * per;
                    const double HANG = 0.35, G = 320;
                    if (u < HANG) { if (u > HANG * 0.4) Px(frame, d.x, d.y0, cool); }            // 簷下慢慢長大的水珠
                    else
                    {
                        double ft = u - HANG, y = d.y0 + 0.5 * G * ft * ft;
                        if (y < d.y1)
                        {
                            Px(frame, d.x, (int)Math.Round(y), hot);
                            Px(frame, d.x, (int)Math.Round(y) - 1, cool);                          // 拖一格尾巴，才看得到
                            if (G * ft > 90) Px(frame, d.x, (int)Math.Round(y) - 2, cool);         // 掉快了拉成三格
                        }
                        else
                        {
                            double after = ft - Math.Sqrt(2 * (d.y1 - d.y0) / G);
                            if (after < 0.12) { Px(frame, d.x - 1, d.y1 - 1 - (after > 0.06 ? 1 : 0), cool); Px(frame, d.x + 1, d.y1 - 1 - (after > 0.06 ? 1 : 0), cool); }
                            if (d.lastCycle != cyc) { d.lastCycle = cyc; drips[i] = d; if (d.y1 >= FLOOR) TownPuddles.AddRipple(d.x); }
                        }
                    }
                }
        }

        static void WetPass(Frame frame, double time, double wet, double day)
        {
            int W = frame.W, Hh = frame.H, cx = frame.Ox, cy = frame.Oy; var C = frame.Color;
            double thr = 1.0 - 1.1 * wet; int T = (int)(thr * 200 + 40);
            double hiK = (0.3 + 0.2 * day) * Math.Min(1, wet * 1.5);
            PixelFX.Par.For(8, band =>
            {
                int per = (Hh + 7) / 8;
                for (int y = band * per, ye = Math.Min(Hh, y + per); y < ye; y++)
                {
                    int wy = y + cy; if (wy < 0 || wy >= WET_BOTTOM) continue;
                    int row = y * W, wrow = wy * TOWN_W;
                    for (int x = 0; x < W; x++)
                    {
                        int gx = x + cx; if (gx < 0 || gx >= TOWN_W) continue;
                        int k = wrow + gx; byte s = score[k];
                        if (s <= T || emit[k] != 0 || Dark(main[k])) continue;
                        uint c = C[row + x]; double r = c & 255, g = (c >> 8) & 255, b = (c >> 16) & 255;
                        // 濕：變深、飽和一點、偏冷一點
                        double gray = r * 0.3 + g * 0.59 + b * 0.11, sat = 1.12;
                        r = (gray + (r - gray) * sat) * 0.87; g = (gray + (g - gray) * sat) * 0.88; b = (gray + (b - gray) * sat) * 0.92;
                        if (wy == hiY[gx]) { r += (215 - r) * hiK; g += (228 - g) * hiK; b += (245 - b) * hiK; }   // 頂面的濕亮邊
                        else
                        {
                            byte tr = trickle[gx];
                            if (tr != 0)
                            {
                                // 往下流的水痕：一小段亮的慢慢往下走
                                double sp = 10 + tr / 255.0 * 14, len = FLOOR - topY[gx];
                                double head = (time * sp + tr * 0.37) % (len + 30) + topY[gx];
                                double dd = head - wy;
                                if (dd >= 0 && dd < 3) { double kk = (dd < 1 ? 0.5 : 0.25) * (0.6 + 0.4 * day); r += (225 - r) * kk; g += (236 - g) * kk; b += (250 - b) * kk; }
                            }
                        }
                        C[row + x] = Pack(r, g, b);
                    }
                }
            });
        }
    }
}
