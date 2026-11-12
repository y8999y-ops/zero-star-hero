// game/src/town.js（碎星鎮）每格會變的部分一行一行翻成 C#：白天晚上（照真實時間，一天 8 分鐘）、天氣（晴／陰／雨，每 3 分鐘可能換）、
// 背景＋街道（drawTown：調亮、天空顏色、坑底大星星的光柱、螢火蟲、工坊煙囪的煙）、前景、居民、雨、光源。
// 載入時畫好的圖層（遠景、中景、街道、前景、會發光的像素、光源）是網頁版匯出的（town.bytes）。
// 夜空＝starsky.js（pixelfx 的 shooting-stars 疊在漸層底圖上）。
using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Text;
using PixelFX;
using UnityEngine;

namespace ZeroStar
{
    public static class TownArt
    {
        public const int TOWN_W = 1240, H = 216, FLOOR = 184, WALL = 16;
        public static readonly (string id, string name, double x, string place, bool flip)[] NPCS =
        {
            ("clerk", "公會櫃檯・波波", 198, "guild", false),
            ("golem", "工坊老闆・岩叔", 510, "workshop", false),
            ("mushroom", "旅館老闆娘・菇媽", 932, "inn", true),
        };
        public const double SIGNPOST_X = 1150;

        // ---- 匯出的圖層
        static int FAR_W, MID_W, FG_W;
        static uint[] FAR, MID, MAIN, FG; static byte[] EMIT;
        static readonly List<(double x, double y, double r, double lv, string col)> LIGHTS = new List<(double, double, double, double, string)>();
        static bool loaded;
        static void Load()
        {
            if (loaded) return; loaded = true;
            var gz = Resources.Load<TextAsset>("Baked/town").bytes; byte[] b;
            using (var ms = new MemoryStream(gz)) using (var z = new GZipStream(ms, CompressionMode.Decompress)) using (var o = new MemoryStream()) { z.CopyTo(o); b = o.ToArray(); }
            int p = 0;
            int I32() { int v = BitConverter.ToInt32(b, p); p += 4; return v; }
            double F64() { double v = BitConverter.ToDouble(b, p); p += 8; return v; }
            string Str() { int n = I32(); var s = Encoding.UTF8.GetString(b, p, n); p += n; return s; }
            uint[] U32() { int n = I32(); var a = new uint[n]; Buffer.BlockCopy(b, p, a, 0, n * 4); p += n * 4; return a; }
            byte[] U8() { int n = I32(); var a = new byte[n]; Buffer.BlockCopy(b, p, a, 0, n); p += n; return a; }
            if (Str() != "ZTN1") throw new Exception("城鎮資料格式不對");
            I32(); FAR_W = I32(); MID_W = I32(); FG_W = I32();
            FAR = U32(); MID = U32(); MAIN = U32(); FG = U32(); EMIT = U8();
            int nl = I32(); for (int i = 0; i < nl; i++) LIGHTS.Add((F64(), F64(), F64(), F64(), Str()));
            BuildClouds();
        }

        // ---- 2026-11-12 美術優化（照 Ori 的層次，維持像素畫）：白天的雲、霧、光束、遠近的淡化、角色外框。
        //   全部乘上「白天的程度」，晚上維持原本的夜景。這一段是 Unity 版自己的，不跟網頁版比對。
        const int CLOUD_W = 900, CLOUD_H = 112;
        static byte[] CLOUDS;   // 0 沒有、1 雲身、2 亮面、3 雲底的暗面
        static void BuildClouds()
        {
            CLOUDS = new byte[CLOUD_W * CLOUD_H];
            var rng = new System.Random(7);
            for (int c = 0; c < 11; c++)
            {
                int cx = (int)(rng.NextDouble() * CLOUD_W), cy = 20 + (int)(rng.NextDouble() * 66), n = 4 + (int)(rng.NextDouble() * 5);
                double big = 0.7 + rng.NextDouble() * 0.8;
                for (int i = 0; i < n; i++)
                {
                    double x = cx + (i - n / 2.0) * (9 + rng.NextDouble() * 6) * big, r = (6 + rng.NextDouble() * 8) * big * (1 - Math.Abs(i - n / 2.0) / n), y = cy - r * 0.5;
                    for (int yy = (int)(y - r) - 1; yy <= cy; yy++) for (int xx = (int)(x - r) - 1; xx <= (int)(x + r) + 1; xx++)
                    {
                        if (yy < 0 || yy >= CLOUD_H) continue;
                        double dx = xx - x, dy = yy - y;
                        if (dx * dx + dy * dy > r * r) continue;
                        int k = yy * CLOUD_W + Wrap(xx, CLOUD_W);
                        double hx = dx + 1.5, hy = dy + 2;
                        byte v = yy >= cy - 1 ? (byte)3 : hx * hx + hy * hy <= r * 0.72 * r * 0.72 && yy <= cy - 3 ? (byte)2 : (byte)1;
                        if (CLOUDS[k] == 0 || v == 2 || (v == 1 && CLOUDS[k] == 3 && yy < cy - 1)) CLOUDS[k] = v;
                    }
                }
            }
        }
        static readonly double[] shaftRow = new double[H], fog1 = new double[H], fog2 = new double[H], sunRow = new double[H], coolRow = new double[H];
        static uint Pack(double r, double g, double b) => unchecked((uint)(unchecked((int)0xff000000) | ((int)Math.Min(255, Math.Max(0, b)) << 16) | ((int)Math.Min(255, Math.Max(0, g)) << 8) | (int)Math.Min(255, Math.Max(0, r))));
        /// 街道與店在白天的樣子：彩度降一點（不跟角色搶）、上面受光、靠近地面偏藍偏暗、草地不要螢光綠、泥土壓暗。窗戶和水晶這些會發光的不動。
        static uint MainDay(uint c, int wy, bool emit, double D)
        {
            if (emit && wy < FLOOR - 10) return c;
            double r = (c & 255) * (1 - 0.09 * D), g = ((c >> 8) & 255) * (1 - 0.085 * D), b = ((c >> 16) & 255) * (1 - 0.02 * D);
            double gray = r * 0.3 + g * 0.59 + b * 0.11, k = 0.22 * D;
            r += (gray - r) * k; g += (gray - g) * k; b += (gray - b) * k;
            double s = sunRow[wy]; r *= s; g *= s; b *= s;
            k = coolRow[wy]; r += (70 - r) * k; g += (86 - g) * k; b += (130 - b) * k;
            if (wy >= FLOOR - 10 && wy <= FLOOR + 4)
            {
                if (g > r * 1.02 && g > b * 1.25)
                {
                    gray = r * 0.3 + g * 0.59 + b * 0.11; k = 0.3 * D;
                    r += (gray - r) * k; g += (gray - g) * k; b += (gray - b) * k;
                    k = 0.35 * D; r += (86 - r) * k; g += (150 - g) * k; b += (74 - b) * k;
                    double m = 1 - 0.1 * D; r *= m; g *= m; b *= m;
                }
            }
            else if (wy > FLOOR + 4) { k = 0.28 * D; r += (10 - r) * k; g += (12 - g) * k; b += (26 - b) * k; }
            return Pack(r, g, b);
        }

        /// 城鎮的地形（map.js 的 flatMap：平地＋左右兩面牆），給遊戲的共用程式用
        public static LevelData Level()
        {
            var d = new LevelData { Stage = "town", W = TOWN_W, H = H, Floor = FLOOR };
            d.Solids.Add(new RectD { X = 0, Y = FLOOR, W = TOWN_W, H = H - FLOOR });
            d.Solids.Add(new RectD { X = 0, Y = 0, W = WALL, H = H });
            d.Solids.Add(new RectD { X = TOWN_W - WALL, Y = 0, W = WALL, H = H });
            return d;
        }

        // ---- 時間（真實時間；比對測試時換成固定的日期＋遊戲時間）
        public static Func<double> NowMs = () => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        const double DAY_LEN = 480, TAU = Math.PI * 2;
        public static double? DayOverride;        // 開發用：0＝日出、0.25＝中午、0.5＝日落、0.75＝半夜
        public static string WeatherOverride;     // 開發用："clear" / "cloudy" / "rain"
        static double Rnd2(double a, double b = 0) { double s = Pf.Sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.Floor(s); }
        public static (double p, double d, double dusk) DayInfo()
        {
            double p = DayOverride ?? (NowMs() / 1000 / DAY_LEN) % 1;
            double d = Math.Max(0, Math.Min(1, 0.5 + Pf.Sin(p * TAU) * 2.5));
            return (p, d, 1 - Math.Abs(2 * d - 1));
        }
        const double WX_SLOT = 180, WX_FADE = 25;
        static readonly string[] WX_PICK = { "clear", "clear", "cloudy", "rain", "clear", "rain", "cloudy", "clear", "clear", "rain" };
        static string WxAt(double slot) => WX_PICK[(int)Math.Floor(Rnd2(slot, 97) * WX_PICK.Length)];
        public static (string kind, double rain, double cloud) WeatherInfo()
        {
            if (WeatherOverride != null) return (WeatherOverride, WeatherOverride == "rain" ? 1 : 0, WeatherOverride == "clear" ? 0 : 1);
            double now = NowMs() / 1000, slot = Math.Floor(now / WX_SLOT), k = Math.Min(1, (now - slot * WX_SLOT) / WX_FADE);
            string a = WxAt(slot - 1), b = WxAt(slot);
            double V(string w, string x) => w == x ? 1 : 0;
            double Lerp(double x, double y) => x + (y - x) * k;
            return (b, Lerp(V(a, "rain"), V(b, "rain")), Lerp(a == "clear" ? 0 : 1, b == "clear" ? 0 : 1));
        }

        // ---- 夜空（starsky.js）：shooting-stars 疊在由上往下深藍→紫的漸層上
        public const int SKY_W = 320, SKY_H = 180;
        static NightSky sky; static uint[] skyPx;   // 夜空（共用 NightSky）
        static void SkyInit()
        {
            sky = new NightSky(); skyPx = new uint[SKY_W * SKY_H];
            SkyUpdate(0);
        }
        static void SkyUpdate(double dt)
        {
            sky.Update(dt);
            Buffer.BlockCopy(sky.Rgba, 0, skyPx, 0, sky.Rgba.Length);
        }

        // ---- 雨（fx-town-rain.js）：三塊接起來，固定在世界上
        static FxRun[] rain;
        static double? rainT, skyT;
        /// 換場景（新的一局）時重設：網頁版每次載入頁面都是新的模組狀態
        public static void Reset()
        {
            Load();
            SkyInit();
            rain = new FxRun[3];
            for (int k = 0; k < 3; k++) { var o = new FxOptions { X = 0, Y = FLOOR }; o.Num["density"] = 1; rain[k] = new FxRun(FxSystem.Def("town-rain"), o); }
            rainT = null; skyT = null;
        }

        static readonly uint[] SKY = new[] { "#0e0a24", "#130e2e", "#181238", "#1e1642", "#261a4c", "#301e56", "#3c225e", "#4c2864", "#5e2e68" }.Select(Col.Hex).ToArray();
        static readonly double[][] DAY_SKY = { new double[] { 92, 156, 226 }, new double[] { 110, 166, 226 }, new double[] { 141, 183, 226 }, new double[] { 179, 204, 226 }, new double[] { 224, 228, 226 } };
        static readonly double[][] DUSK_SKY = { new double[] { 58, 48, 120 }, new double[] { 128, 72, 140 }, new double[] { 214, 104, 120 }, new double[] { 250, 150, 96 }, new double[] { 255, 196, 120 } };
        static readonly double[] NIGHT = { 34, 36, 52 }, rowClear = new double[H * 3], rowCloud = new double[H * 3];
        static int Wrap(int x, int w) => ((x % w) + w) % w;

        /// 雨（在主角、居民之後，前景之前畫）
        public static void DrawWeather(Frame frame, double time)
        {
            var wx = WeatherInfo(); double dt = rainT == null ? 0 : Math.Max(0, Math.Min(0.1, time - rainT.Value));
            rainT = time;
            if (wx.rain < 0.03) return;
            int bse = (int)Math.Floor(frame.Ox / 332.0) * 332 + 166;
            for (int k = 0; k < 3; k++) { var fx = rain[k]; fx.Update(dt); fx.Options.X = bse + k * 332; fx.Options.Y = FLOOR + 1; fx.Options.Num["density"] = wx.rain * 0.45; fx.Draw(frame); }
        }

        /// 鎮上的固定光源
        public static List<LightSrc> Lights(double time)
        {
            double dl = 1 - 0.75 * DayInfo().d * (1 - 0.5 * WeatherInfo().cloud);
            var list = LIGHTS.Select(l => new LightSrc(l.x, l.y, l.r + (l.r > 50 ? Math.Floor(time * 6) % 2 : 0), l.lv * dl, l.col)).ToList();
            list.Add(new LightSrc(106, 128, 110, 1.6 * dl, "#ffd27a", 0.12));   // 坑底的大星星（遠景圖左邊那顆）
            return list;
        }

        /// 畫鎮的背景＋街道。lv：光的亮度（街道和店被照到時加上光源的顏色）
        public static void Draw(Frame frame, float[] lv, double time)
        {
            int W = frame.W, cx = frame.Ox, cy = frame.Oy; var outc = frame.Color; var LB = frame.Light; float[] TR = SceneLight.Tr, TG = SceneLight.Tg, TB = SceneLight.Tb;
            int of = (int)Math.Floor(cx * 0.12), om = (int)Math.Floor(cx * 0.35), os = (int)Math.Floor(cx * 0.04);
            Prof.Mark("T:前"); SkyUpdate(skyT == null ? 0 : Math.Max(0, Math.Min(0.1, time - skyT.Value))); Prof.Mark("T:流星天空");
            var SKYP = skyPx;
            var di = DayInfo(); var wi = WeatherInfo();
            double DAY0 = di.d, DUSK0 = di.dusk, RAINK = wi.rain, CLOUD = wi.cloud;
            double DAY = DAY0 * (1 - 0.45 * CLOUD), DUSK = DUSK0 * (1 - 0.8 * CLOUD), dim = 1 - 0.12 * CLOUD - 0.08 * RAINK;
            double mR = 1 + 0.32 * DAY + 0.2 * DUSK, mG = 1 + 0.3 * DAY + 0.02 * DUSK, mB = 1 + 0.1 * DAY - 0.12 * DUSK, aR = 12 * DAY + 8 * DUSK, aG = 11 * DAY, aB = 2 * DAY;
            double kR = mR * dim * (1 - 0.06 * RAINK), kG = mG * dim, kB = mB * dim * (1 + 0.04 * RAINK);
            bool noLift = DAY + DUSK + CLOUD < 0.01;
            uint Lift(uint v) => noLift ? v : unchecked((uint)(unchecked((int)0xff000000) | (Pf.ToInt32(Math.Min(255, ((v >> 16) & 255) * kB + aB)) << 16) | (Pf.ToInt32(Math.Min(255, ((v >> 8) & 255) * kG + aG)) << 8) | Pf.ToInt32(Math.Min(255, (v & 255) * kR + aR))));
            // 每一列天空的顏色（晴天＋黃昏混合、陰天的雲色）：放在固定的陣列裡，每格不用產生新的
            var RC = rowClear; var RD = rowCloud; double SK = Math.Min(1, DAY + DUSK);
            for (int y = 0; y < H; y++)
            {
                double f = y / (H * 0.62); double w = DUSK / Math.Max(0.01, DAY + DUSK);
                double ka = Math.Max(0, Math.Min(DAY_SKY.Length - 1.001, f * (DAY_SKY.Length - 1))); int ia = (int)Math.Floor(ka); double ta = ka - ia;
                double kb = Math.Max(0, Math.Min(DUSK_SKY.Length - 1.001, f * (DUSK_SKY.Length - 1))); int ib = (int)Math.Floor(kb); double tb = kb - ib;
                double ff = Math.Min(1, f);
                for (int j = 0; j < 3; j++)
                {
                    double a = DAY_SKY[ia][j] + (DAY_SKY[ia + 1][j] - DAY_SKY[ia][j]) * ta, b = DUSK_SKY[ib][j] + (DUSK_SKY[ib + 1][j] - DUSK_SKY[ib][j]) * tb;
                    double day = j == 0 ? 150 - 30 * (1 - ff) : j == 1 ? 160 - 30 * (1 - ff) : 176 - 26 * (1 - ff), night = NIGHT[j];
                    RD[y * 3 + j] = night + (day - night) * DAY0;
                    RC[y * 3 + j] = a + (b - a) * w;
                }
            }
            uint DaySky(uint v, int wy)
            {
                int ry = Math.Max(0, Math.Min(H - 1, wy)) * 3;
                if (SK < 0.01 && CLOUD < 0.01) return v;
                double r = v & 255, g = (v >> 8) & 255, b = (v >> 16) & 255;
                r += (RC[ry] - r) * SK; g += (RC[ry + 1] - g) * SK; b += (RC[ry + 2] - b) * SK;
                double ck = CLOUD * 0.85;
                r += (RD[ry] - r) * ck; g += (RD[ry + 1] - g) * ck; b += (RD[ry + 2] - b) * ck;
                return unchecked((uint)(unchecked((int)0xff000000) | (Pf.ToInt32(Pf.Round(b)) << 16) | (Pf.ToInt32(Pf.Round(g)) << 8) | Pf.ToInt32(Pf.Round(r))));
            }
            // 白天的層次（D＝白天的程度；陰天雨天少一點）
            double D = DAY, SUNK = DAY * (1 - CLOUD);
            double sunX = W * 0.16, shaftOx = cx * 0.2 + Pf.Sin(time * 0.07) * 14;
            int oc = (int)Math.Floor(cx * 0.05 + time * 1.2);
            for (int y = 0; y < H; y++)
            {
                fog1[y] = Math.Max(0, Math.Min(1, (y - 96) / 70.0)) * 0.36 * D;
                fog2[y] = Math.Max(0, Math.Min(1, (y - 132) / 50.0)) * 0.30 * D;
                sunRow[y] = 1 + (0.06 - 0.16 * Math.Max(0, Math.Min(1, (y - 20) / 164.0))) * D;
                coolRow[y] = Math.Max(0, Math.Min(1, (y - 120) / 64.0)) * 0.16 * D;
                shaftRow[y] = 1 - 0.75 * Math.Max(0, Math.Min(1, (y - 50) / 120.0));
            }
            skyT = time; Prof.Mark("T:天色");
            // 每一格只寫自己那一格（顏色、光）：切成 8 段同時算，結果一樣
            PixelFX.Par.For(8, band => { for (int y = band * 27, ye = Math.Min(H, y + 27); y < ye; y++) PixelRow(y); });
            void PixelRow(int y)
            {
                int wy = y + cy, row = y * W;
                uint sky = SKY[Math.Max(0, Math.Min(SKY.Length - 1, (int)Math.Floor(wy / 13.0)))];
                if (wy < 0 || wy >= H) { uint fill = wy < 0 ? DaySky(SKYP[0], 0) : Lift(sky); for (int x = 0; x < W; x++) outc[row + x] = fill; return; }
                int sy = Math.Min(SKY_H - 1, wy);
                for (int x = 0; x < W; x++)
                {
                    int i = row + x, gx = x + cx;
                    uint v = gx >= 0 && gx < TOWN_W ? MAIN[wy * TOWN_W + gx] : 0;
                    if (v != 0)
                    {
                        outc[i] = D > 0.01 ? MainDay(Lift(v), wy, EMIT[wy * TOWN_W + gx] != 0, D) : Lift(v);
                        if (lv[i] > 0.02 && EMIT[wy * TOWN_W + gx] == 0) LB[i] = unchecked((uint)(unchecked((int)0xff000000) | (Pf.ToInt32(Math.Min(255, TB[i] * 0.9)) << 16) | (Pf.ToInt32(Math.Min(255, TG[i] * 0.9)) << 8) | Pf.ToInt32(Math.Min(255, TR[i] * 0.9))));
                        continue;
                    }
                    double r, g, b, k, gray;
                    uint bg = MID[wy * MID_W + Wrap(x + om, MID_W)];
                    if (bg != 0)
                    {
                        // 中景（山坡上的住家）：往霧的顏色靠
                        uint c = Lift(bg); r = c & 255; g = (c >> 8) & 255; b = (c >> 16) & 255;
                        gray = r * 0.3 + g * 0.59 + b * 0.11; k = 0.25 * D; r += (gray - r) * k; g += (gray - g) * k; b += (gray - b) * k;
                        k = 0.34 * D; r += (188 - r) * k; g += (208 - g) * k; b += (236 - b) * k;
                    }
                    else
                    {
                        bg = FAR[wy * FAR_W + Wrap(x + of, FAR_W)];
                        if (bg != 0)
                        {
                            // 遠景（坑壁、墜落的大星星）：最淡最藍；大星星和金色水晶留一點暖色，不要洗白
                            bool warm = (bg & 255) > ((bg >> 16) & 255) * 1.25 && (bg & 255) > 150;
                            uint c = Lift(bg); r = c & 255; g = (c >> 8) & 255; b = (c >> 16) & 255;
                            gray = r * 0.3 + g * 0.59 + b * 0.11; k = (warm ? 0.15 : 0.35) * D; r += (gray - r) * k; g += (gray - g) * k; b += (gray - b) * k;
                            if (warm) { k = 0.42 * D; r += (250 - r) * k; g += (236 - g) * k; b += (200 - b) * k; }
                            else { k = 0.58 * D; r += (206 - r) * k; g += (222 - g) * k; b += (244 - b) * k; }
                        }
                        else
                        {
                            uint c = DaySky(SKYP[sy * SKY_W + Wrap(x + os, SKY_W)], wy); r = c & 255; g = (c >> 8) & 255; b = (c >> 16) & 255;
                            if (SUNK > 0.01)
                            {
                                // 左上的太陽光暈
                                double dx = x - sunX, dy = wy + 10, gl = 1 - Math.Sqrt(dx * dx + dy * dy) / 190;
                                if (gl > 0) { gl = gl * Math.Sqrt(gl) * SUNK; r += 35 * gl; g += 29 * gl; b += 10 * gl; }
                                // 雲（慢慢飄）
                                if (wy < CLOUD_H)
                                {
                                    byte cl = CLOUDS[wy * CLOUD_W + Wrap(x + oc, CLOUD_W)];
                                    if (cl != 0)
                                    {
                                        k = 0.9 * SUNK;
                                        if (cl == 2) { r += (255 - r) * k; g += (253 - g) * k; b += (246 - b) * k; }
                                        else if (cl == 1) { r += (234 - r) * k; g += (240 - g) * k; b += (249 - b) * k; }
                                        else { r += (204 - r) * k; g += (217 - g) * k; b += (238 - b) * k; }
                                    }
                                }
                            }
                        }
                        k = fog1[wy]; r += (236 - r) * k; g += (240 - g) * k; b += (244 - b) * k;   // 遠景和中景之間的霧
                    }
                    k = fog2[wy]; r += (228 - r) * k; g += (236 - g) * k; b += (244 - b) * k;       // 中景和街道之間的霧
                    if (SUNK > 0.01)
                    {
                        // 陽光光束：很淡、邊緣漸淡、只在天空和遠處（不蓋到建築和角色），慢慢飄
                        double u = x + shaftOx - wy * 0.75; u -= Math.Floor(u / 320) * 320;
                        double t1 = 1 - Math.Abs(u - 92) / 30, t2 = 1 - Math.Abs(u - 246) / 36, sh = 0;
                        if (t1 > 0) sh += t1 * t1 * (3 - 2 * t1) * 0.085;
                        if (t2 > 0) sh += t2 * t2 * (3 - 2 * t2) * 0.07;
                        if (sh > 0) { sh *= shaftRow[wy] * SUNK; r += 255 * sh; g += 244 * sh; b += 206 * sh; }
                    }
                    outc[i] = Pack(r, g, b);
                }
            }
            Prof.Mark("T:像素");
            void Add(int x, int y, double r, double g, double b, double k)
            {
                if (x < 0 || y < 0 || x >= W || y >= frame.H) return;
                int i = y * W + x; uint d = LB[i];
                LB[i] = unchecked((uint)(unchecked((int)0xff000000) | (Pf.ToInt32(Math.Min(255, ((d >> 16) & 255) + b * k)) << 16) | (Pf.ToInt32(Math.Min(255, ((d >> 8) & 255) + g * k)) << 8) | Pf.ToInt32(Math.Min(255, (d & 255) + r * k))));
            }
            // 坑底大星星的光柱（往上，柔和）
            int bx = 106 - of;
            for (int y = 0; y < 66 - cy; y++) for (int x = -16; x <= 16; x++)
            {
                double k = Pf.Pow(1 - Math.Abs(x) / 17.0, 2) * (y / 66.0) * (0.6 + 0.15 * Pf.Sin(time * 1.3)) * (1 - 0.7 * DAY);
                Add(bx + x, y, 255, 210, 120, k * 0.35);
            }
            // 螢火蟲（只在晚上、沒下雨的時候）
            for (int n = 0; n < 26; n++)
            {
                int fx = (int)Pf.Round(Rnd2(n, 41) * TOWN_W + Pf.Sin(time * 0.6 + n) * 14) - cx, fy = (int)Pf.Round(118 + Rnd2(n, 42) * 58 + Pf.Sin(time * 0.9 + n * 2) * 6) - cy;
                double on = (0.5 + 0.5 * Pf.Sin(time * 2.2 + n * 1.7)) * (1 - DAY0) * (1 - RAINK);
                if (on < 0.15 || fx < 0 || fy < 0 || fx >= W || fy >= frame.H) continue;
                outc[fy * W + fx] = 0xffa0f4d4;
                for (int y = -4; y <= 4; y++) for (int x = -4; x <= 4; x++) { double f = 1 - Pf.Hypot(x, y) / 4.5; if (f > 0) Add(fx + x, fy + y, 200, 255, 140, f * f * on * 0.5); }
            }
            // 工坊煙囪的煙
            for (int n = 0; n < 6; n++)
            {
                double t = (time * 0.3 + n / 6.0) % 1; int sx = 607 + (int)Pf.Round(Pf.Sin(t * 6 + n) * 3 + t * 12) - cx, sy2 = FLOOR - 128 - (int)Pf.Round(t * 50) - cy, R = 3 + (int)Pf.Round(t * 6);
                for (int y = -R; y <= R; y++) for (int x = -R; x <= R; x++) { double f = 1 - Pf.Hypot(x, y) / R; if (f > 0) Add(sx + x, sy2 + y, 120, 110, 140, f * (1 - t) * 0.45); }
            }
        }
        /// 前景（在主角和居民之後畫）：比主角近的草葉＝深色剪影（框住畫面、增加景深），最後四角微微壓暗
        public static void DrawFg(Frame frame)
        {
            int W = frame.W, cx = frame.Ox, cy = frame.Oy, ofg = (int)Math.Floor(cx * 1.3); var outc = frame.Color;
            const int LIFT = 2;
            for (int y = 0; y < frame.H; y++)
            {
                int wy = y + cy + LIFT;
                if (wy < 0 || wy >= H) continue;
                for (int x = 0; x < W; x++)
                {
                    uint v = FG[wy * FG_W + Wrap(x + ofg, FG_W)];
                    if (v != 0) outc[y * W + x] = Pack((v & 255) * 0.154 + 18.7, ((v >> 8) & 255) * 0.154 + 28.8, ((v >> 16) & 255) * 0.154 + 41.8);
                }
            }
            if (vig == null || vig.Length != W * frame.H)
            {
                vig = new float[W * frame.H];
                for (int y = 0; y < frame.H; y++) for (int x = 0; x < W; x++)
                {
                    double d = Math.Sqrt(Math.Pow((x - W / 2.0) / (W / 2.0), 2) + Math.Pow((y - frame.H / 2.0) / (frame.H / 2.0), 2));
                    vig[y * W + x] = (float)(1 - 0.24 * Math.Pow(Math.Max(0, Math.Min(1, (d - 0.85) / 0.55)), 1.6));
                }
            }
            for (int i = 0; i < vig.Length; i++)
            {
                float k = vig[i]; if (k >= 0.999f) continue;
                uint v = outc[i];
                outc[i] = unchecked((uint)(unchecked((int)0xff000000) | ((int)(((v >> 16) & 255) * k) << 16) | ((int)(((v >> 8) & 255) * k) << 8) | (int)((v & 255) * k)));
            }
        }
        static float[] vig;

        // ---- 角色（居民、路人、主角）從背景跳出來：腳下的影子、一圈深色外框、左上的邊緣光
        static uint[] snap; static byte[] pmask;
        /// 腳下的影子（x＝腳底中間，half＝半寬）
        public static void Shadow(Frame frame, double x, int half, double k = 0.3)
        {
            int W = frame.W, bx = (int)Pf.Round(x) - frame.Ox, by = FLOOR - frame.Oy; var C = frame.Color;
            for (int dy = 0; dy < 3; dy++) for (int dx = -half; dx <= half; dx++)
            {
                double e = (double)dx / Math.Max(1, half), f = (dy - 1) / 1.6;
                if (e * e + f * f > 1) continue;
                int px = bx + dx, py = by + dy; if (px < 0 || py < 0 || px >= W || py >= frame.H) continue;
                uint v = C[py * W + px];
                C[py * W + px] = Pack((v & 255) * (1 - k) + 14 * k, ((v >> 8) & 255) * (1 - k) + 20 * k, ((v >> 16) & 255) * (1 - k) + 34 * k);
            }
        }
        /// 畫角色之前記下畫面；畫完之後 OutlinePeople 比對出「角色畫在哪」
        public static void SnapPeople(Frame frame)
        {
            int n = frame.W * frame.H;
            if (snap == null || snap.Length != n) { snap = new uint[n]; pmask = new byte[n]; }
            Array.Copy(frame.Color, snap, n);
        }
        public static void OutlinePeople(Frame frame)
        {
            if (snap == null || snap.Length != frame.W * frame.H) return;
            int W = frame.W, Hh = frame.H; var C = frame.Color; var M = pmask;
            double rim = 0.18 + 0.27 * DayInfo().d;
            for (int i = 0; i < M.Length; i++)
            {
                uint c = C[i];
                M[i] = c == snap[i] ? (byte)0 : (c & 255) + ((c >> 8) & 255) + ((c >> 16) & 255) < 150 ? (byte)2 : (byte)1;
            }
            for (int y = 1; y < Hh - 1; y++) for (int x = 1; x < W - 1; x++)
            {
                int i = y * W + x; byte m = M[i];
                if (m == 1)
                {
                    // 左上沒有東西的邊：往暖白提亮（太陽在左上）
                    if (M[i - W] == 0 || M[i - 1] == 0) { uint c = C[i]; double r = c & 255, g = (c >> 8) & 255, b = (c >> 16) & 255; C[i] = Pack(r + (255 - r) * rim, g + (248 - g) * rim, b + (220 - b) * rim); }
                }
                else if (m == 0)
                {
                    byte a = M[i - 1], b2 = M[i + 1], c2 = M[i - W], d = M[i + W];
                    if ((a == 1 || b2 == 1 || c2 == 1 || d == 1) && a != 2 && b2 != 2 && c2 != 2 && d != 2) M[i] = 3;   // 外框（原本就有深色邊的地方不重複）
                }
            }
            for (int i = 0; i < M.Length; i++) if (M[i] == 3) C[i] = 0xff3e1e2c;
        }
        /// 居民／路人（npcs.js 的 paintNpc）：x 腳底中間、y 腳底
        public static void PaintNpc(Frame frame, string id, double t, double x, double y, bool flip = false, bool walk = false) =>
            Blit.Draw(frame, Baked.Anim("npc:" + id + (walk ? ":walk" : "")), t, x, y + 1, flip);
        /// npcs.js 的 npcSize：[寬, 高（腳底到頭頂）]
        public static (int w, int h) NpcSize(string id) { var s = Baked.Anim("npc:" + id).Frames[0]; return (s.W, -s.Ly); }
        public static void DrawNpcs(Frame frame, double time) { foreach (var n in NPCS) PaintNpc(frame, n.id, time, n.x, FLOOR - 1, n.flip); }
    }
}
