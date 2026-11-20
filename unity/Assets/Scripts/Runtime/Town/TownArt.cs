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
    public static partial class TownArt
    {
        public static int TOWN_W { get; } = 2400;
        public static int H { get; } = 560;
        public static int FLOOR { get; } = 440;
        public const int WALL = 16;
        internal const int LegacyFloor = 184, LegacyHeight = 216, LegacyWidth = 1240;
        internal static int StreetTop => FLOOR - LegacyFloor;
        public static readonly (string id, string name, double x, string place, bool flip)[] NPCS =
        {
            ("clerk", "公會櫃檯・波波", 198, "guild", false),
            ("golem", "工坊老闆・岩叔", 510, "workshop", false),
            ("mushroom", "旅館老闆娘・菇媽", 932, "inn", true),
        };
        public static double SIGNPOST_X {get; private set;} = 1150;
        static bool hasCloudObjects;
        static readonly Dictionary<string,int> npcOffsetY=new Dictionary<string,int>();
        public static int FootY(string id)=>FLOOR+(id!=null && npcOffsetY.TryGetValue(id,out int dy)?dy:0);
        static Vector2Int workshopMove, farMove, cloudMove;

        // ---- 匯出的圖層
        static int FAR_W, MID_W, FG_W;
        static uint[] FAR, MID, MAIN, FG, constructionPreview, streetMain, streetPreview;
        static byte[] EMIT, streetEmit;
        static Img upperFar, upperMid, craterWall;
        static Img sewerBack;
        static FxRun sewerWater;
        internal const int SewerLeft = 400, SewerRight = 1704, SewerStoneHeight = 20;
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
            int bakedWidth = I32(); FAR_W = I32(); MID_W = I32(); FG_W = I32();
            FAR = U32(); MID = U32(); var street = U32(); FG = U32(); var emit = U8();
            if (bakedWidth != LegacyWidth || street.Length != LegacyWidth * LegacyHeight || emit.Length != street.Length)
                throw new Exception("碎星鎮舊街圖層尺寸不對");
            MAIN = new uint[TOWN_W * H]; EMIT = new byte[MAIN.Length];
            for (int y = 0; y < LegacyHeight; y++)
            {
                Array.Copy(street, y * LegacyWidth, MAIN, (y + StreetTop) * TOWN_W, LegacyWidth);
                Array.Copy(emit, y * LegacyWidth, EMIT, (y + StreetTop) * TOWN_W, LegacyWidth);
            }
            int nl = I32(); for (int i = 0; i < nl; i++) LIGHTS.Add((F64(), F64() + StreetTop, F64(), F64(), Str()));
            upperFar ??= ReadSceneTexture("far-up");
            upperMid ??= ReadSceneTexture("mid-up");
            craterWall ??= ReadSceneTexture("crater-wall");
            sewerBack ??= ReadSceneTexture("sewer-back");
            BuildClouds();
            cloudPixels = CLOUDS.Select(c => c == 0 ? 0u : c == 2 ? Pack(255, 253, 246) : c == 1 ? Pack(234, 240, 249) : Pack(204, 217, 238)).ToArray();
        }

        static Img ReadSceneTexture(string name)
        {
            var texture = Resources.Load<Texture2D>("Art/town2/" + name);
            if (!texture) return null;
            var rgba = texture.GetPixels32();
            var img = new Img { W = texture.width, H = texture.height, Px = new uint[rgba.Length] };
            for (int y = 0; y < img.H; y++)
            for (int x = 0; x < img.W; x++)
            {
                var c = rgba[(img.H - 1 - y) * img.W + x];
                if (c.a != 0) img.Px[y * img.W + x] = (uint)(c.r | c.g << 8 | c.b << 16 | c.a << 24);
            }
            return img;
        }

        static Parallax.Row UpperRow(Img upper, double x, double y) =>
            upper == null ? default : new Parallax.Row(upper.Px, upper.W, upper.H, x, upper.H / 2.0 + y);

        static uint BlendBackdrop(Parallax.Row original, Parallax.Row upper, int x, double y, double edge)
        {
            uint legacy = original.Sample(x);
            if (y >= edge) return legacy;
            uint extension = upper.Sample(x);
            double t = Math.Min(1, (edge - y) / 46);
            return Parallax.Mix(legacy, Parallax.Over(legacy, extension), t * t * (3 - 2 * t));
        }

        // ---- 2026-11-12 美術優化（照 Ori 的層次，維持像素畫）：白天的雲、霧、光束、遠近的淡化、角色外框。
        //   全部乘上「白天的程度」，晚上維持原本的夜景。這一段是 Unity 版自己的，不跟網頁版比對。
        const int CLOUD_W = 900, CLOUD_H = 112;
        static uint[] cloudPixels;
        static byte[] CLOUDS;   // 0 沒有、1 雲身、2 亮面、3 雲底的暗面
        static void BuildClouds() => GenerateClouds(null);
        public static void GenerateClouds(Action<int,int,int,byte[]> capture)
        {
            byte[] canvas=new byte[CLOUD_W * CLOUD_H];
            if(capture==null) CLOUDS=canvas;
            var rng = new System.Random(7);
            for (int c = 0; c < 11; c++)
            {
                if(capture!=null) Array.Clear(canvas,0,canvas.Length);
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
                        if (canvas[k] == 0 || v == 2 || (v == 1 && canvas[k] == 3 && yy < cy - 1)) canvas[k] = v;
                    }
                }
                capture?.Invoke(c,cx,cy,canvas);
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
        public static LevelData Level(WorldComposition composition = null)
        {
            var d = new LevelData { Stage = "town", W = TOWN_W, H = H, Floor = FLOOR };
            if (composition != null && composition.ApplyTownCollision(d)) return d;
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
        static readonly string[] WX_PICK = { "clear", "clear", "cloudy", "rain", "clear", "rain", "cloudy", "clear", "snow", "rain" };   // 2026-11-19：一格晴天換成下雪
        static string WxAt(double slot) => WX_PICK[(int)Math.Floor(Rnd2(slot, 97) * WX_PICK.Length)];
        /// 下雪量 0～1（換天氣時跟雨一樣慢慢過渡）
        public static double SnowK()
        {
            if (WeatherOverride != null) return WeatherOverride == "snow" ? 1 : 0;
            double now = NowMs() / 1000, slot = Math.Floor(now / WX_SLOT), k = Math.Min(1, (now - slot * WX_SLOT) / WX_FADE);
            double a = WxAt(slot - 1) == "snow" ? 1 : 0, b = WxAt(slot) == "snow" ? 1 : 0;
            return a + (b - a) * k;
        }
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
        public static void Reset(WorldComposition composition=null)
        {
            RebuildStructures(composition);
            SkyInit();
            rain = new FxRun[3];
            for (int k = 0; k < 3; k++) { var o = new FxOptions { X = 0, Y = FLOOR }; o.Num["density"] = 1; rain[k] = new FxRun(FxSystem.Def("town-rain"), o); }
            rainT = null; skyT = null;
            ResetSewerEffects();
            TownPuddles.Reset();
            TownSnow.Reset();
        }

        internal static void RebuildStructures(WorldComposition composition)
        {
            // 城鎮的畫布是靜態快取，每次重組都要從原始資料開始。
            hasCloudObjects=composition!=null && composition.HasCloudObjects;
            constructionPreview = null;
            streetMain = streetPreview = null;
            streetEmit = null;
            LIGHTS.Clear(); loaded=false; Load();
            if(composition!=null)
            {
                Img Layer(uint[] pixels,int width) => new Img{W=width,H=LegacyHeight,Px=pixels};
                if (composition.HasStreetView)
                {
                    var street = new LevelData { Stage = "town", W = TOWN_W, H = H, PFE = EMIT };
                    composition.Apply(street, streetView: true);
                    streetMain = street.PF;
                    streetEmit = street.PFE;
                    streetPreview = street.TownPreview;
                    ExtendStreet(streetMain);
                    PaintSewerVault(streetMain, false);
                }
                var d=new LevelData{Stage="town",W=TOWN_W,H=H,PF=MAIN,PFE=EMIT,Far=Layer(FAR,FAR_W),Mid=Layer(MID,MID_W),Fg=Layer(FG,FG_W)};
                foreach(var l in LIGHTS)d.PropLights.Add(new LightSrc(l.x,l.y,l.r,l.lv,l.col));
                composition.Apply(d); MAIN=d.PF;EMIT=d.PFE;
                constructionPreview = d.TownPreview;
                LIGHTS.Clear();foreach(var l in d.PropLights)LIGHTS.Add((l.X,l.Y,l.R,l.Lv,l.Col));
            }
            ExtendStreet(MAIN);
            PaintSewerVault(MAIN, true);
            Vector2Int Move(string role)=>composition?.Role(role)??Vector2Int.zero;
            for(int i=0;i<NPCS.Length;i++)
            {
                var n=NPCS[i]; var shift=composition?.Delta(StampKind.Resident,i)??Vector2Int.zero;
                NPCS[i].x=(i==0?198:i==1?510:932)+shift.x; npcOffsetY[n.id]=shift.y;
            }
            npcOffsetY["sign"]=Move("sign").y;
            SIGNPOST_X=1150+Move("sign").x; workshopMove=Move("workshop"); farMove=Move("Far");cloudMove=Move("Cloud");
            TownRainHits.Build(MAIN, EMIT, composition);   // 建築擺好後算雨打屋頂與屋簷滴水
            TownSnow.Build(MAIN);   // 下雪：每一欄能堆多少雪（要在結構圖之後）
        }
        static void ExtendStreet(uint[] pixels)
        {
            // 延伸街道沿用舊街地表，重複鋪在右側尚未開放的區域。
            const int sampleX = 1096, period = 128;
            for (int y = FLOOR; y < StreetTop + LegacyHeight; y++)
            {
                int row = y * TOWN_W;
                for (int x = LegacyWidth; x < TOWN_W; x++)
                    if (pixels[row + x] == 0) pixels[row + x] = pixels[row + sampleX + (x - LegacyWidth) % period];
            }
        }

        internal static double ElevatedVisibility(double cameraY)
        {
            // 保留 1× 取景。攀登時越過普通地面跳躍的取景範圍，才逐步露出跨空地的構件。
            double t = Math.Max(0, Math.Min(1, (StreetTop - cameraY - 12) / 62));
            return t * t * (3 - 2 * t);
        }

        internal static bool WeatherSurfaceVisible(int x, int y, double elevated)
        {
            if (streetMain == null || elevated >= 0.75 || (uint)x >= TOWN_W || (uint)y >= H) return true;
            int index = y * TOWN_W + x;
            return MAIN[index] == streetMain[index];
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
            double wday = DayInfo().d * (1 - 0.45 * wx.cloud);
            TownRainHits.DrawActors(frame, time, wx.rain, wday);   // 雨打在角色身上（在雨之前、角色之後）
            TownSnow.DrawFlakes(frame, time, SnowK());   // 雪花（在角色之後）
            if (wx.rain < 0.03) { TownPuddles.Draw(frame, time, wx.rain, wday); return; }
            int bse = (int)Math.Floor(frame.Ox / 332.0) * 332 + 166;
            for (int k = 0; k < 3; k++) { var fx = rain[k]; fx.Update(dt); fx.Options.X = bse + k * 332; fx.Options.Y = FLOOR + 1; fx.Options.Num["density"] = wx.rain * 0.25; fx.Draw(frame); }
            TownPuddles.Draw(frame, time, wx.rain, wday);   // 積水（Unity 版自己的）：畫在雨和貼地薄霧之後，才不會被霧蓋掉
        }

        /// 鎮上的固定光源
        public static List<LightSrc> Lights(double time, bool underground = false)
        {
            if (underground) return SewerLights(time);
            double dl = 1 - 0.75 * DayInfo().d * (1 - 0.5 * WeatherInfo().cloud);
            var list = LIGHTS.Select(l => new LightSrc(l.x, l.y, l.r + (l.r > 50 ? Math.Floor(time * 6) % 2 : 0), l.lv * dl, l.col)).ToList();
            list.Add(new LightSrc(106 + farMove.x, StreetTop + 128 + farMove.y, 110, 1.6 * dl, "#ffd27a", 0.12));   // 坑底的大星星（遠景圖左邊那顆）
            foreach (int x in new[] { 1623, 1876, 2291 }) list.Add(new LightSrc(x, FLOOR - 50, 40, 0.7 * dl, "#ffdc93"));
            return list;
        }

        /// 畫鎮的背景＋街道。lv：光的亮度（街道和店被照到時加上光源的顏色）
        public static void Draw(Frame frame,float[] lv,double time) => Draw(frame,lv,time,null);
        static uint[] customSky;
        internal static void Draw(Frame frame, float[] lv, double time, StageLayout layout, bool underground = false)
        {
            if (underground) { DrawSewer(frame, lv); return; }
            int W = frame.W, cx = frame.Ox, cy = frame.Oy; var outc = frame.Color; var LB = frame.Light; float[] TR = SceneLight.Tr, TG = SceneLight.Tg, TB = SceneLight.Tb;
            double rx = frame.CameraFractionX;
            double of = Parallax.Offset(cx, rx, 0.12), om = Parallax.Offset(cx, rx, 0.35), os = Parallax.Offset(cx, rx, 0.04);
            Prof.Mark("T:前"); SkyUpdate(skyT == null ? 0 : Math.Max(0, Math.Min(0.1, time - skyT.Value))); Prof.Mark("T:流星天空");
            if(layout!=null)
            {
                if(customSky==null || customSky.Length!=frame.Color.Length) customSky=new uint[frame.Color.Length];
                Array.Clear(customSky,0,customSky.Length);layout.Draw(frame,SceneryLayer.Sky,customSky);
            }
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
                double f = (y - StreetTop) / (LegacyHeight * 0.62); double w = DUSK / Math.Max(0.01, DAY + DUSK);
                double ka = Math.Max(0, Math.Min(DAY_SKY.Length - 1.001, f * (DAY_SKY.Length - 1))); int ia = (int)Math.Floor(ka); double ta = ka - ia;
                double kb = Math.Max(0, Math.Min(DUSK_SKY.Length - 1.001, f * (DUSK_SKY.Length - 1))); int ib = (int)Math.Floor(kb); double tb = kb - ib;
                double ff = Math.Max(0, Math.Min(1, f));
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
            double sunX = W * 0.16, shaftOx = Parallax.Offset(cx, rx, 0.2) + Pf.Sin(time * 0.07) * 14;
            double oc = Parallax.Offset(cx, rx, 0.05) + time * 1.2;
            double extension = Math.Min(124, (StreetTop - cy - 56) * 1.6);
            double elevated = streetMain == null ? 1 : ElevatedVisibility(cy + frame.CameraFractionY);
            double nearOffset = Parallax.Offset(cx, rx, 0.8);
            for (int y = 0; y < H; y++)
            {
                int localY = y - StreetTop;
                double streetFog = 1 - 0.5 * elevated * Math.Max(0, Math.Min(1, (FLOOR - y) / 145.0));
                fog1[y] = Math.Max(0, Math.Min(1, (localY - 96) / 70.0)) * 0.36 * D * streetFog;
                fog2[y] = Math.Max(0, Math.Min(1, (localY - 132) / 50.0)) * 0.30 * D * streetFog;
                sunRow[y] = 1 + (0.06 - 0.16 * Math.Max(0, Math.Min(1, (localY - 20) / 164.0))) * D;
                coolRow[y] = Math.Max(0, Math.Min(1, (localY - 120) / 64.0)) * 0.16 * D;
                shaftRow[y] = 1 - 0.75 * Math.Max(0, Math.Min(1, (localY - 50) / 120.0));
            }
            skyT = time; Prof.Mark("T:天色");
            // 每一格只寫自己那一格（顏色、光）：切成 8 段同時算，結果一樣
            PixelFX.Par.For(8, band => { for (int y = band * frame.H / 8, ye = (band + 1) * frame.H / 8; y < ye; y++) PixelRow(y); });
            void PixelRow(int y)
            {
                int wy = y + cy, row = y * W;
                int localY = wy - StreetTop;
                uint sky = SKY[Math.Max(0, Math.Min(SKY.Length - 1, (int)Math.Floor(localY / 13.0)))];
                if (wy < 0 || wy >= H) { uint fill = wy < 0 ? DaySky(SKYP[0], 0) : Lift(sky); for (int x = 0; x < W; x++) outc[row + x] = fill; return; }
                int sy = Math.Max(0, Math.Min(SKY_H - 1, localY));
                double midY = y + (cy - StreetTop) * 0.5, farY = y + (cy - StreetTop) * 0.3;
                var midRow = new Parallax.Row(MID, MID_W, LegacyHeight, om, midY);
                var farRow = new Parallax.Row(FAR, FAR_W, LegacyHeight, of, farY);
                var farUpper = UpperRow(upperFar, of, farY);
                var midUpper = UpperRow(upperMid, om, midY);
                var rock = craterWall == null ? default : new Parallax.Row(craterWall.Px, craterWall.W, craterWall.H,
                    nearOffset, y + cy * 0.8 - 14);
                double cliffAlpha = elevated * Math.Max(0, Math.Min(1, (352 - wy) / 56.0));
                double backdropGrade = 1 - 0.5 * elevated * Math.Max(0, Math.Min(1, (FLOOR - wy) / 170.0));
                var skyRow = new Parallax.Row(SKYP, SKY_W, SKY_H, os, sy);
                var cloudRow = new Parallax.Row(cloudPixels, CLOUD_W, CLOUD_H, oc - cloudMove.x, localY - cloudMove.y);
                for (int x = 0; x < W; x++)
                {
                    int i = row + x, gx = x + cx, world = wy * TOWN_W + gx;
                    bool inTown = (uint)gx < TOWN_W;
                    uint v = inTown ? MAIN[world] : 0;
                    bool emits = v != 0 && EMIT[world] != 0;
                    double opacity = 1;
                    if (inTown && elevated < 1)
                    {
                        uint street = streetMain[world];
                        if (elevated == 0)
                        {
                            v = street;
                            emits = v != 0 && streetEmit[world] != 0;
                        }
                        else if (v != street)
                        {
                            if (street == 0) opacity = elevated;
                            else if (v == 0)
                            {
                                v = street;
                                opacity = 1 - elevated;
                                emits = streetEmit[world] != 0;
                            }
                            else
                            {
                                v = Parallax.Over(street, Parallax.Alpha(v, (uint)(elevated * 255) << 24));
                                emits |= streetEmit[world] != 0;
                            }
                        }
                    }
                    uint structure = 0;
                    if (v != 0)
                    {
                        structure = D > 0.01 ? MainDay(Lift(v), wy, emits, D) : Lift(v);
                        if (opacity == 1)
                        {
                            outc[i] = structure;
                            if (lv[i] > 0.02 && !emits) LB[i] = unchecked((uint)(unchecked((int)0xff000000) | (Pf.ToInt32(Math.Min(255, TB[i] * 0.9)) << 16) | (Pf.ToInt32(Math.Min(255, TG[i] * 0.9)) << 8) | Pf.ToInt32(Math.Min(255, TR[i] * 0.9))));
                            continue;
                        }
                    }
                    double r, g, b, k, gray;
                    uint skyColor = DaySky(skyRow.Sample(x), wy);

                    r = skyColor & 255; g = (skyColor >> 8) & 255; b = (skyColor >> 16) & 255;
                    if (SUNK > 0.01)
                    {
                        double dx = x + rx - sunX, dy = localY + 10, gl = 1 - Math.Sqrt(dx * dx + dy * dy) / 190;
                        if (gl > 0) { gl = gl * Math.Sqrt(gl) * SUNK; r += 35 * gl; g += 29 * gl; b += 10 * gl; }
                        uint cloud = layout!=null && hasCloudObjects ? customSky[i] : cloudRow.Sample(x);
                        k = (cloud >> 24) / 255.0 * 0.9 * SUNK;
                        r += ((cloud & 255) - r) * k; g += (((cloud >> 8) & 255) - g) * k; b += (((cloud >> 16) & 255) - b) * k;
                    }
                    uint bg = BlendBackdrop(farRow, farUpper, x, farY, extension);
                    if (bg != 0)
                    {
                        bool warm = (bg & 255) > ((bg >> 16) & 255) * 1.25 && (bg & 255) > 150;
                        uint c = Lift(bg); double fr = c & 255, fg = (c >> 8) & 255, fb = (c >> 16) & 255;
                        gray = fr * 0.3 + fg * 0.59 + fb * 0.11; k = (warm ? 0.15 : 0.35) * D * backdropGrade;
                        fr += (gray - fr) * k; fg += (gray - fg) * k; fb += (gray - fb) * k;
                        k = (warm ? 0.42 : 0.58) * D * backdropGrade;
                        fr += ((warm ? 250 : 206) - fr) * k; fg += ((warm ? 236 : 222) - fg) * k; fb += ((warm ? 200 : 244) - fb) * k;
                        k = (bg >> 24) / 255.0; r += (fr - r) * k; g += (fg - g) * k; b += (fb - b) * k;
                    }
                    k = fog1[wy]; r += (236 - r) * k; g += (240 - g) * k; b += (244 - b) * k;
                    bg = BlendBackdrop(midRow, midUpper, x, midY, extension);
                    if (bg != 0)
                    {
                        uint c = Lift(bg); double mr = c & 255, mg = (c >> 8) & 255, mb = (c >> 16) & 255;
                        gray = mr * 0.3 + mg * 0.59 + mb * 0.11; k = 0.25 * D * backdropGrade;
                        mr += (gray - mr) * k; mg += (gray - mg) * k; mb += (gray - mb) * k;
                        k = 0.34 * D * backdropGrade; mr += (188 - mr) * k; mg += (208 - mg) * k; mb += (236 - mb) * k;
                        k = (bg >> 24) / 255.0; r += (mr - r) * k; g += (mg - g) * k; b += (mb - b) * k;
                    }
                    k = fog2[wy]; r += (228 - r) * k; g += (236 - g) * k; b += (244 - b) * k;       // 中景和街道之間的霧
                    if (SUNK > 0.01)
                    {
                        // 陽光光束：很淡、邊緣漸淡、只在天空和遠處（不蓋到建築和角色），慢慢飄
                        double u = x + shaftOx - localY * 0.75; u -= Math.Floor(u / 320) * 320;
                        double t1 = 1 - Math.Abs(u - 92) / 30, t2 = 1 - Math.Abs(u - 246) / 36, sh = 0;
                        if (t1 > 0) sh += t1 * t1 * (3 - 2 * t1) * 0.085;
                        if (t2 > 0) sh += t2 * t2 * (3 - 2 * t2) * 0.07;
                        if (sh > 0) { sh *= shaftRow[wy] * SUNK; r += 255 * sh; g += 244 * sh; b += 206 * sh; }
                    }
                    uint scene = Pack(r, g, b);
                    if (cliffAlpha > 0)
                    {
                        uint cliff = rock.Sample(x);
                        if (cliff != 0) scene = Parallax.Over(scene,
                            Parallax.Alpha(Parallax.Mix(cliff | 0xff000000, 0xff827084, D * 0.19),
                                (uint)((cliff >> 24) * cliffAlpha) << 24));
                    }
                    if (inTown)
                    {
                        uint asBuilt = constructionPreview == null ? 0 : constructionPreview[world];
                        if (elevated < 1)
                        {
                            uint onStreet = streetPreview == null ? 0 : streetPreview[world];
                            if (onStreet != asBuilt)
                                asBuilt = elevated == 0 ? onStreet : Parallax.Alpha(asBuilt, (uint)((asBuilt >> 24) * elevated) << 24);
                        }
                        scene = Parallax.Over(scene, asBuilt);
                    }
                    if (structure != 0)
                        scene = Parallax.Over(scene, Parallax.Alpha(structure, (uint)(opacity * 255) << 24));
                    outc[i] = scene;
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
            double bx = 106 + farMove.x - of;
            for (int y = 0, ye = Math.Min(frame.H, StreetTop + 66 - cy); y < ye; y++) for (int x = -16; x <= 16; x++)
            {
                double k = Pf.Pow(1 - Math.Abs(x) / 17.0, 2) * (y / 66.0) * (0.6 + 0.15 * Pf.Sin(time * 1.3)) * (1 - 0.7 * DAY);
                int px = (int)Math.Floor(bx + x); double fraction = bx + x - px;
                Add(px, y, 255, 210, 120, k * 0.35 * (1 - fraction));
                Add(px + 1, y, 255, 210, 120, k * 0.35 * fraction);
            }
            // 螢火蟲（只在晚上、沒下雨的時候）
            for (int n = 0; n < 26; n++)
            {
                int fx = (int)Pf.Round(Rnd2(n, 41) * LegacyWidth + Pf.Sin(time * 0.6 + n) * 14) - cx, fy = StreetTop + (int)Pf.Round(118 + Rnd2(n, 42) * 58 + Pf.Sin(time * 0.9 + n * 2) * 6) - cy;
                double on = (0.5 + 0.5 * Pf.Sin(time * 2.2 + n * 1.7)) * (1 - DAY0) * (1 - RAINK);
                if (on < 0.15 || fx < 0 || fy < 0 || fx >= W || fy >= frame.H) continue;
                outc[fy * W + fx] = 0xffa0f4d4;
                for (int y = -4; y <= 4; y++) for (int x = -4; x <= 4; x++) { double f = 1 - Pf.Hypot(x, y) / 4.5; if (f > 0) Add(fx + x, fy + y, 200, 255, 140, f * f * on * 0.5); }
            }
            // 工坊煙囪的煙
            for (int n = 0; n < 6; n++)
            {
                double t = (time * 0.3 + n / 6.0) % 1; int sx = 607 + workshopMove.x + (int)Pf.Round(Pf.Sin(t * 6 + n) * 3 + t * 12) - cx, sy2 = FLOOR - 128 + workshopMove.y - (int)Pf.Round(t * 50) - cy, R = 3 + (int)Pf.Round(t * 6);
                for (int y = -R; y <= R; y++) for (int x = -R; x <= R; x++) { double f = 1 - Pf.Hypot(x, y) / R; if (f > 0) Add(sx + x, sy2 + y, 120, 110, 140, f * (1 - t) * 0.45); }
            }
            TownSnow.DrawCover(frame, time, SnowK(), DAY, elevated);   // 積雪（場景的一部分，角色站在雪前面）
            if (PostFx.ActiveFor(frame))
            {
                frame.BeginWeatherMask();   // 角色和雨不參與屋頂變濕。
                if (streetMain != null && elevated < 0.75 && TownPuddles.Wet > 0.02)
                    for (int y = 0; y < frame.H; y++)
                    for (int x = 0; x < W; x++)
                        if (!WeatherSurfaceVisible(x + cx, y + cy, elevated)) frame.ExcludeWeather(y * W + x);
            }
            TownRainHits.Draw(frame, time, wi.rain, DAY, elevated);   // 雨打屋頂與屋簷滴水：在角色之前畫
        }
        /// 前景（在主角和居民之後畫）：比主角近的草葉＝深色剪影（框住畫面、增加景深），最後四角微微壓暗
        public static void DrawFg(Frame frame, double playerX, double playerY)
        {
            frame.ProtectLegacyDraws();   // 角色和雨都畫好了：算場景遮罩（前景畫過的格子在下面扣掉）
            int W = frame.W, cy = frame.Oy; var outc = frame.Color;
            double ofg = Parallax.Offset(frame.Ox, frame.CameraFractionX, 1.3);
            const int Lower = 12;
            double night = 1 - DayInfo().d;
            for (int y = 0; y < frame.H; y++)
            {
                int worldY = y + cy, wy = worldY - Lower - StreetTop;
                if (wy < 0 || wy >= LegacyHeight) continue;
                var sample = new Parallax.Row(FG, FG_W, LegacyHeight, ofg, wy);
                for (int x = 0; x < W; x++)
                {
                    uint v = sample.Sample(x);
                    if ((v >> 24) == 0) continue;
                    double alpha = (v >> 24) / 255.0;
                    if (worldY >= playerY - 25 && worldY <= playerY + 8)
                    {
                        double distance = Math.Abs(x + frame.Ox - playerX);
                        alpha *= 0.28 + 0.72 * Math.Max(0, Math.Min(1, (distance - 12) / 12));
                    }
                    frame.ExcludeWeather(y * W + x);
                    uint color = Pack((v & 255) * 0.154 + 18.7 + 6 * night, ((v >> 8) & 255) * 0.154 + 28.8 + 4 * night,
                        ((v >> 16) & 255) * 0.154 + 41.8 + 13 * night);
                    outc[y * W + x] = Parallax.Over(outc[y * W + x], Parallax.Alpha(color, (uint)(alpha * 255) << 24));
                }
            }
            // 暗角只調整亮度，不改變像素所屬圖層。
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
        public static void Shadow(Frame frame, double x, int half, double k = 0.3, int? footY = null)
        {
            int W = frame.W, bx = (int)Pf.Round(x) - frame.Ox, by = (footY ?? FLOOR) - frame.Oy; var C = frame.Color;
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
        public static void OutlinePeople(Frame frame) => OutlineActors(frame, 0.18 + 0.27 * DayInfo().d, 0xff3e1e2c);
        /// rim＝邊緣光的強度、outline＝外框顏色（關卡裡的怪物也用這個）
        /// lift＞0：暗的像素往上提亮（越暗提越多，亮的不動）——可以互動的物件在暗處也要看得到
        public static void OutlineActors(Frame frame, double rim, uint outline, double lift = 0)
        {
            if (snap == null || snap.Length != frame.W * frame.H) return;
            int W = frame.W, Hh = frame.H; var C = frame.Color; var M = pmask;
            if (lift > 0)
                for (int i = 0; i < C.Length; i++)
                {
                    uint c = C[i]; if (c == snap[i]) continue;
                    double r = c & 255, g = (c >> 8) & 255, b = (c >> 16) & 255, mx = Math.Max(r, Math.Max(g, b)), d = 1 - mx / 255;
                    double k = 1 + lift * d * Math.Sqrt(d);
                    C[i] = Pack(Math.Min(255, r * k + 6 * lift * d), Math.Min(255, g * k + 6 * lift * d), Math.Min(255, b * k + 8 * lift * d));
                }
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
            for (int i = 0; i < M.Length; i++) if (M[i] == 3) C[i] = outline;
        }
        /// 居民／路人（npcs.js 的 paintNpc）：x 腳底中間、y 腳底
        public static void PaintNpc(Frame frame, string id, double t, double x, double y, bool flip = false, bool walk = false) =>
            Blit.Draw(frame, Baked.Anim("npc:" + id + (walk ? ":walk" : "")), t, x, y + 1, flip);
        /// npcs.js 的 npcSize：[寬, 高（腳底到頭頂）]
        public static (int w, int h) NpcSize(string id) { var s = Baked.Anim("npc:" + id).Frames[0]; return (s.W, -s.Ly); }
        public static void DrawNpcs(Frame frame, double time) { foreach (var n in NPCS) PaintNpc(frame, n.id, time, n.x, FootY(n.id) - 1, n.flip); }
    }
}
