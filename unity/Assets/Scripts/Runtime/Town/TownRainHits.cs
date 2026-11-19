// 碎星鎮：雨跟房子、物件互動（Unity 版自己的，不跟網頁版比對）。scene-fx skill §3、§4。
//  1. 接雨面：載入時從建築圖層（MAIN）每一欄由上往下找第一個不透明的像素＝屋頂／物件頂。換建築、移動建築都會自動跟著變。
//  2. 雨打在屋頂和物件頂上：一個亮點，然後兩顆小水珠往左右彈開。
//  3. 滴水：照水路（TownFlow：有結構圖的建築照結構圖，其他物件自動）流到哪就從哪滴，加上結構圖的滴水點（青苔尖、山牆下角）；
//     水珠在簷下慢慢長大、掉下去，打在接水面（陽台欄杆、招牌頂）或地上，落地起漣漪；滴水下面的地面比較早積水。
//  4. 慢慢變濕（照 Mushreb DEV LOG.05 雪的堆積遮罩）：分數＝「離水路多近」＋雜訊，濕度越高門檻越低，
//     先沿著水路濕出一條條彎的，再往兩邊擴散；擋雨區不會濕。濕的地方變深、飽和一點，頂面一條濕亮邊，亮點沿著水路往下流。
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
        static byte[] plat;                       // 平台積水：0＝不是，1＝水面最上面那一列，2＝第二列
        static byte[] platNeed;                   // 平台積水：濕度要多少才出現（0～255）
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
                topY[x] = -1; hiY[x] = -1;
                for (int y = 0; y < FLOOR - 6; y++) if (Solid(x, y)) { topY[x] = y; break; }
                if (topY[x] < 0) continue;
                for (int y = topY[x]; y < Math.Min(topY[x] + 3, WET_BOTTOM); y++) { if (!Solid(x, y)) break; if (!Dark(main[y * TOWN_W + x])) { hiY[x] = y; break; } }
            }
            // 水路（照結構圖或自動）：滴水點、往下流的亮點、變濕都照它
            TownFlow.Build(main, topY);
            var cls = TownStructure.Cls;
            // 離水路多近（最多 10 格）：水先沿著水路濕，濕度越高越往兩邊擴散
            var near = new byte[TOWN_W * H]; var q = new Queue<int>();
            const int R = 10;
            for (int i = 0; i < near.Length; i++) if (TownFlow.PathSeed[i] != 0) { near[i] = R + 1; q.Enqueue(i); }
            while (q.Count > 0)
            {
                int i = q.Dequeue(); byte v = near[i]; if (v <= 1) continue;
                int x = i % TOWN_W, y = i / TOWN_W;
                if (x > 0 && near[i - 1] < v - 1) { near[i - 1] = (byte)(v - 1); q.Enqueue(i - 1); }
                if (x < TOWN_W - 1 && near[i + 1] < v - 1) { near[i + 1] = (byte)(v - 1); q.Enqueue(i + 1); }
                if (y > 0 && near[i - TOWN_W] < v - 1) { near[i - TOWN_W] = (byte)(v - 1); q.Enqueue(i - TOWN_W); }
                if (y < H - 1 && near[i + TOWN_W] < v - 1) { near[i + TOWN_W] = (byte)(v - 1); q.Enqueue(i + TOWN_W); }
            }
            for (int x = 0; x < TOWN_W; x++)
            {
                if (topY[x] < 0) continue;
                // 從頂面往下：越往下越不濕；碰到空的（屋簷下）就被擋住，下面都不濕（沒有結構圖的物件用這個）
                double expo = 1;
                for (int y = topY[x]; y < WET_BOTTOM; y++)
                {
                    int k = y * TOWN_W + x;
                    if (!Solid(x, y))
                    {
                        // 空的：短短一段（屋頂上的小東西、圖裡的小縫）雨還是淋得到下面，跳過去；長的一段＝屋簷下，被擋住
                        int gap = 0; while (y + gap < WET_BOTTOM && !Solid(x, y + gap)) gap++;
                        if (gap > 6 || y + gap >= WET_BOTTOM) break;
                        y += gap - 1; expo -= gap / 64.0; continue;
                    }
                    double n = Noise2(x / 4.0, y / 4.0, 3) * 0.7 + Noise2(x / 9.0, y / 9.0, 4) * 0.3;
                    double nr = near[k] / (double)(R + 1);   // 1＝在水路上，0＝離水路 10 格以上
                    byte c = cls != null ? cls[k] : TownStructure.NONE;
                    double s;
                    if (c == TownStructure.SHELTER) s = -1;                                    // 擋雨區：不會濕
                    else if (c == TownStructure.LAND) s = 0.35 + (n - 0.5) * 0.3;               // 接水面：上面滴下來的水打濕
                    else if (c != TownStructure.NONE) s = 0.15 + nr * 0.75 + (n - 0.5) * 0.4;   // 結構圖的屋頂：沿著水路先濕，再往兩邊擴散
                    else s = Math.Max(expo * 0.7 + (n - 0.5) * 0.35, 0.15 + nr * 0.75 + (n - 0.5) * 0.4);
                    score[k] = s < 0 ? (byte)0 : (byte)Math.Max(1, Math.Min(255, s * 200 + 40));
                    expo -= 1 / 64.0;
                }
            }
            // 有結構圖的格子：不看那一欄上面有什麼（小香菇、煙囪底下不能被當成屋簷下），一律照結構圖與水路算
            if (cls != null)
                for (int y = 0; y < WET_BOTTOM; y++) for (int x = 0; x < TOWN_W; x++)
                {
                    int k = y * TOWN_W + x; byte c = cls[k];
                    if (c == TownStructure.NONE) continue;
                    double n = Noise2(x / 4.0, y / 4.0, 3) * 0.7 + Noise2(x / 9.0, y / 9.0, 4) * 0.3, nr = near[k] / (double)(R + 1);
                    double s2 = c == TownStructure.SHELTER ? -1 : c == TownStructure.LAND ? 0.35 + (n - 0.5) * 0.3 : 0.15 + nr * 0.75 + (n - 0.5) * 0.4;
                    score[k] = s2 < 0 ? (byte)0 : (byte)Math.Max(1, Math.Min(255, s2 * 200 + 40));
                }
            // 滴水點：水路滴下去的地方＋結構圖的滴水點（青苔尖、山牆下角）
            var land = new List<int>();
            foreach (var d in TownFlow.Drips)
            {
                drips.Add(new Drip { x = d.x, y0 = d.y0, y1 = d.y1, period = 0.55 + Hash(d.x * 7 + d.y0, 31) * 0.9, phase = Hash(d.x * 7 + d.y0, 32) * 3, lastCycle = int.MinValue });
                if (d.ground) land.Add(d.x);
            }
            TownPuddles.SetDrips(land);
            // 給 shader（PostFx）的資料：世界座標 R＝變濕分數、G＝不會濕（外框、會發光）、B＝沿著水路走了多遠、A＝哪一條水路（0＝不是）；
            // 每一欄 G＝接雨面、A＝濕亮邊那一列
            // 平台積水：朝上的平面（結構圖的接水面，或沒有結構圖的物件從天空看下來第一個面），平的一段至少 4 格寬；
            // 水積在外框裡面那一列（寬的平台兩列），兩頭各留一格；每一段要多濕才出現不一樣
            plat = new byte[TOWN_W * H]; platNeed = new byte[TOWN_W * H];
            for (int y = 2; y < FLOOR - 8; y++)
            {
                int run0 = -1;
                for (int x = 0; x <= TOWN_W; x++)
                {
                    bool ok = false;
                    if (x < TOWN_W && Solid(x, y))
                    {
                        byte c = cls != null ? cls[y * TOWN_W + x] : TownStructure.NONE;
                        byte cu = cls != null ? cls[(y - 1) * TOWN_W + x] : TownStructure.NONE;
                        // 結構圖的接水面：最上面那一列就是（陽台欄杆在牆前面，上面一格是牆，不能要求上面是空的）；沒有結構圖的物件：從天空看下來第一個面
                        ok = (c == TownStructure.LAND && cu != TownStructure.LAND) || (c == TownStructure.NONE && !Solid(x, y - 1) && topY[x] == y);
                    }
                    if (ok && run0 < 0) run0 = x;
                    if (!ok && run0 >= 0)
                    {
                        int len = x - run0;
                        if (len >= 4)
                        {
                            byte need = (byte)(60 + Hash(run0 * 31 + y, 51) * 100);
                            for (int xx = run0 + 1; xx < x - 1; xx++)
                            {
                                int yy = y; while (yy < y + 3 && Solid(xx, yy) && Dark(main[yy * TOWN_W + xx])) yy++;   // 外框裡面那一列
                                if (!Solid(xx, yy) || Dark(main[yy * TOWN_W + xx]) || emit[yy * TOWN_W + xx] != 0) continue;
                                plat[yy * TOWN_W + xx] = 1; platNeed[yy * TOWN_W + xx] = need;
                                if (len >= 8 && Solid(xx, yy + 1) && !Dark(main[(yy + 1) * TOWN_W + xx])) { plat[(yy + 1) * TOWN_W + xx] = 2; platNeed[(yy + 1) * TOWN_W + xx] = need; }
                            }
                        }
                        run0 = -1;
                    }
                }
            }
            var world = new byte[TOWN_W * H * 4]; var cols = new byte[TOWN_W * 4];
            for (int y = 0; y < H; y++) for (int x = 0; x < TOWN_W; x++)
            {
                int k = y * TOWN_W + x;
                world[k * 4] = score[k];
                world[k * 4 + 1] = emit[k] != 0 || Dark(main[k]) ? (byte)255 : (byte)0;
                world[k * 4 + 2] = TownFlow.PathArc[k];
                world[k * 4 + 3] = TownFlow.PathSeed[k];
                if (plat[k] != 0) { world[k * 4] = platNeed[k]; world[k * 4 + 1] = 120; world[k * 4 + 2] = (byte)(plat[k] - 1); world[k * 4 + 3] = 0; }   // 平台積水：G＝120 當記號，R＝要多濕，B＝第幾列
            }
            for (int x = 0; x < TOWN_W; x++)
            {
                cols[x * 4 + 1] = topY[x] < 0 ? (byte)255 : (byte)topY[x];
                cols[x * 4 + 3] = hiY[x] < 0 ? (byte)255 : (byte)hiY[x];
                // 有結構圖的地方：濕亮邊只畫在屋頂面上
                if (hiY[x] >= 0 && cls != null && cls[hiY[x] * TOWN_W + x] != TownStructure.NONE && cls[hiY[x] * TOWN_W + x] != TownStructure.ROOF) { cols[x * 4 + 3] = 255; hiY[x] = -1; }
            }
            PostFx.SetTown(TOWN_W, H, world, cols);
            if (DebugLog) UnityEngine.Debug.Log("[RainHits] 滴水點 " + drips.Count + "，結構圖：" + string.Join("、", TownStructure.Placed.ConvertAll(p => $"{p.name}@{p.x},{p.y}")));
        }

        /// 開發用：濕的分數圖（世界座標，灰階）、接雨面（紅）
        public static byte[] DebugScore(out int w, out int h, out int[] top) { w = TOWN_W; h = H; top = topY; return score; }
        static uint Pack(double r, double g, double b) => unchecked(0xff000000u | ((uint)Math.Min(255, Math.Max(0, b)) << 16) | ((uint)Math.Min(255, Math.Max(0, g)) << 8) | (uint)Math.Min(255, Math.Max(0, r)));
        static void Px(Frame f, int wx, int wy, uint c)
        {
            int x = wx - f.Ox, y = wy - f.Oy;
            if (x < 0 || y < 0 || x >= f.W || y >= f.H) return;
            int i=y*f.W+x; f.ExcludeWeather(i); f.Color[i]=c;
        }

        /// 畫在建築之後、角色之前（角色會擋住屋簷滴下來的水）。rain＝雨量 0～1、day＝白天程度
        public static void Draw(Frame frame, double time, double rain, double day)
        {
            if (main == null) return;
            double dt = lastT < 0 ? 0 : Math.Max(0, Math.Min(0.1, time - lastT)); lastT = time;
            double wet = TownPuddles.Wet;
            int W = frame.W, cx = frame.Ox, cy = frame.Oy;
            if (wet > 0.02 && !PostFx.ActiveFor(frame)) WetPass(frame, time, wet, day);   // 有 shader 就交給顯示卡（PostFx.shader）
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
                        if (plat[k] != 0 && wet * 255 > platNeed[k])
                        {
                            // 平台積水（CPU 版：水色＋最上面一列亮邊，沒有倒影）
                            double wr0 = 40 + 60 * day, wg0 = 52 + 70 * day, wb0 = 84 + 80 * day;
                            C[row + x] = plat[k] == 1 && ((gx + (int)(time * 3)) % 5) < 2 ? Pack(200 + 30 * day, 215 + 25 * day, 240) : Pack(wr0, wg0, wb0);
                            continue;
                        }
                        if (s <= T || emit[k] != 0 || Dark(main[k])) continue;
                        uint c = C[row + x]; double r = c & 255, g = (c >> 8) & 255, b = (c >> 16) & 255;
                        // 濕：變深、飽和一點、偏冷一點
                        double gray = r * 0.3 + g * 0.59 + b * 0.11, sat = 1.12;
                        r = (gray + (r - gray) * sat) * 0.87; g = (gray + (g - gray) * sat) * 0.88; b = (gray + (b - gray) * sat) * 0.92;
                        if (wy == hiY[gx]) { r += (215 - r) * hiK; g += (228 - g) * hiK; b += (245 - b) * hiK; }   // 頂面的濕亮邊
                        else
                        {
                            byte tr = TownFlow.PathSeed[k];
                            if (tr != 0)
                            {
                                // 往下流的水痕：一小段亮的沿著水路（照著建築的弧度）慢慢往下走
                                double sp = 10 + tr / 255.0 * 12;
                                double head = (time * sp + tr * 1.7) % 160;
                                double dd = head - TownFlow.PathArc[k];
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
