// 碎星鎮的雨天積水（Unity 版自己的，不跟網頁版比對）。做法參考 Mushreb〈2D游戏中的雨天效果 DEV LOG.02〉，改成橫向卷軸的側面視角：
//  1. 積水形狀：沿著地面的一維雜訊，用「積水程度」當門檻切出一攤一攤（下雨慢慢變多變大，雨停慢慢乾掉）。
//     側面看過去，一攤水是地面那條草皮上扁扁的橢圓：中間厚、兩頭收成一條線。
//  2. 倒影：水面裡畫「地面上方的畫面」上下翻過來、壓扁（會映出主角、居民、建築、晚上的燈光）。
//  3. 邊緣：遠的那一邊一條亮邊（會跟著慢慢移動的雜訊斷斷續續），近的那一邊一條暗線。
//  4. 漣漪：雨滴落進水裡＝一個亮點，然後側面看到的環（兩小段往左右滑開），漣漪附近的倒影跟著左右晃。
//  5. 主角跑過水面：濺起小水珠，腳下也起漣漪。
using System;
using System.Collections.Generic;
using PixelFX;

namespace ZeroStar
{
    public static class TownPuddles
    {
        const int FLOOR = TownArt.FLOOR;
        static int TOWN_W => TownArt.TOWN_W;   // 擴大碎星鎮時不是固定值也能用
        const double TOP = FLOOR + 1, MID = FLOOR + 3.5, HALF = 3.2;   // 積水所在的草皮帶：第 185～190 列
        const double SQUASH = 2.6;                                    // 倒影壓扁的倍數

        static double wet = -1;      // 積水程度 0～1（-1＝剛進場，照現在的雨直接設好）
        /// 現在有多濕（0～1）：房子變濕（TownRainHits）也用同一個值
        public static double Wet => Math.Max(0, wet);
        /// 開發用（截圖）：進場時的濕度，不設＝照現在的雨量
        public static double? WetStart;
        /// 每秒融掉多少雪（TownSnow 每格設；0＝沒在融雪）
        public static double MeltIn;
        static double[] bump = new double[0];
        /// 屋簷滴水落地的地方（世界 x）：附近比較早積水（TownRainHits.Build 設，載入時算一次）
        public static void SetDrips(IEnumerable<int> xs)
        {
            if (bump.Length != TOWN_W) bump = new double[TOWN_W]; else Array.Clear(bump, 0, bump.Length);
            foreach (int dx in xs) for (int x = Math.Max(0, dx - 20); x < Math.Min(TOWN_W, dx + 21); x++) { double e = (x - dx) / 7.0; bump[x] = Math.Max(bump[x], 0.13 * Math.Exp(-e * e)); }
        }
        /// 雨滴或屋簷滴水落進水裡：起一圈漣漪（不在水裡就不做事）
        public static void AddRipple(double x, bool big = false) { if (InWater(x)) ripples.Add(new Ripple { x = Math.Round(x), t = 0, big = big }); }
        static double lastT = -1;
        static float[] depth;        // 每一欄的水深（0＝沒有水，1＝最深），每格照 wet 重算

        public static void Reset() { wet = -1; lastT = -1; drops.Clear(); ripples.Clear(); stepAcc = 0; lastPx = double.NaN; }

        // ---- 雜訊（固定的種子，一維）
        static double Hash(int i, int s) { unchecked { uint h = (uint)(i * 374761393 + s * 668265263); h = (h ^ (h >> 13)) * 1274126177; h ^= h >> 16; return (h & 0xffffff) / 16777216.0; } }
        static double Noise(double x, int s)
        {
            int i = (int)Math.Floor(x); double f = x - i; f = f * f * (3 - 2 * f);
            return Hash(i, s) + (Hash(i + 1, s) - Hash(i, s)) * f;
        }
        static double Field(int x) => Noise(x / 58.0, 1) * 0.72 + Noise(x / 17.0, 2) * 0.28;

        static void BuildDepth()
        {
            if (depth == null || depth.Length != TOWN_W) depth = new float[TOWN_W];
            if (bump.Length != TOWN_W) bump = new double[TOWN_W];
            double thr = 0.74 - 0.27 * wet;   // 越濕門檻越低：水窪變多變長
            for (int x = 0; x < TOWN_W; x++)
            {
                double f = Field(x) + bump[x];   // 屋簷下：水從屋頂滴下來，先積
                double v = x < TownArt.WALL + 4 || x > TOWN_W - TownArt.WALL - 4 ? 0 : (f - thr) / 0.15;
                depth[x] = (float)Math.Max(0, Math.Min(1, v));
            }
        }
        public static bool InWater(double x) { int i = (int)Math.Round(x); return depth != null && i >= 0 && i < TOWN_W && depth[i] > 0.12f; }

        // ---- 漣漪、水珠
        struct Ripple { public double x, t; public bool big; }
        struct Drop { public double x, y, vx, vy, t; }
        static readonly List<Ripple> ripples = new List<Ripple>();
        static readonly List<Drop> drops = new List<Drop>();
        static double stepAcc, lastPx = double.NaN;
        static double rng = 0.5;
        static double Rand() { rng = (rng * 9301 + 49297) % 233280; return rng / 233280; }

        /// 主角在不在水裡跑（Game 每格叫）
        public static void Player(double x, double vx, bool grounded)
        {
            double dx = double.IsNaN(lastPx) ? 0 : Math.Abs(x - lastPx); lastPx = x;
            if (!grounded || depth == null || !InWater(x) || dx > 20) { stepAcc = 0; return; }
            stepAcc += dx;
            if (stepAcc < 9) return;
            stepAcc = 0;
            ripples.Add(new Ripple { x = x, t = 0, big = true });
            int n = 4 + (int)(Rand() * 3);
            for (int k = 0; k < n; k++)
                drops.Add(new Drop { x = x + (Rand() - 0.5) * 6, y = FLOOR + 1, vx = -Math.Sign(vx) * (8 + Rand() * 26) + (Rand() - 0.5) * 20, vy = -(30 + Rand() * 45), t = 0 });
        }

        static uint Pack(double r, double g, double b) => unchecked(0xff000000u | ((uint)Math.Min(255, Math.Max(0, b)) << 16) | ((uint)Math.Min(255, Math.Max(0, g)) << 8) | (uint)Math.Min(255, Math.Max(0, r)));

        static uint[] srcC, srcL;
        /// 畫積水（在角色之後、雨之前）。rain＝雨量 0～1，day＝白天程度 0～1
        public static void Draw(Frame frame, double time, double rain, double day)
        {
            double dt = lastT < 0 ? 0 : Math.Max(0, Math.Min(0.1, time - lastT)); lastT = time;
            if (wet < 0) wet = WetStart ?? rain;
            else wet = rain > 0.03 ? Math.Min(1, wet + dt * rain / 40) : Math.Max(0, wet - dt / 90);   // 下 40 秒積滿、停 90 秒乾掉
            if (MeltIn > 0) wet = Math.Min(1, wet + dt * MeltIn * 2.4);   // 融雪的水（TownSnow）：雪融完約積到八成
            if (wet < 0.02 && drops.Count == 0) return;
            BuildDepth();

            int W = frame.W, Hh = frame.H, cx = frame.Ox, cy = frame.Oy; var C = frame.Color; var L = frame.Light;

            // 水的底色（倒影混進去的顏色）：白天灰藍、晚上深藍
            double wr = 24 + 44 * day, wg = 34 + 52 * day, wb = 62 + 64 * day;
            double drift = time * 3.0;

            // 漣漪：雨滴落進水裡（每 0.05 秒一個時段，每個時段在畫面範圍內抽幾個點）
            if (rain > 0.03)
            {
                int slot = (int)Math.Floor(time * 20), prev = (int)Math.Floor((time - dt) * 20);
                for (int s = prev + 1; s <= slot; s++)
                    for (int k = 0; k < 3; k++)
                    {
                        if (Hash(s * 7 + k, 11) > rain * 0.9) continue;
                        double x = cx - 20 + Hash(s * 7 + k, 12) * (W + 40);
                        if (InWater(x) && depth[(int)Math.Round(x)] > 0.3f) ripples.Add(new Ripple { x = Math.Round(x), t = 0 });
                    }
            }
            for (int i = ripples.Count - 1; i >= 0; i--) { var r = ripples[i]; r.t += dt; if (r.t > 0.9) ripples.RemoveAt(i); else ripples[i] = r; }

            // 交給 shader（PostFx）：這裡只準備資料，倒影、邊、漣漪的環都在顯示卡上畫；水珠照舊 CPU 畫（會在水面上面）
            if (PostFx.TownOnGpu(frame) && PostFx.Cols != null)
            {
                var cols = PostFx.Cols;
                for (int x = 0; x < TOWN_W; x++) cols[x * 4] = (byte)Math.Round(depth[x] * 255);
                int rn = 0;
                foreach (var r in ripples)
                {
                    if (rn >= PostFx.MAX_RIP) break;
                    if (r.x < cx - 12 || r.x > cx + W + 12) continue;
                    int X = (int)r.x; float dx = X >= 0 && X < TOWN_W ? depth[X] : 0;
                    PostFx.Rip[rn++] = new UnityEngine.Vector4((float)r.x, (float)r.t, r.big ? 1 : 0, dx);
                }
                PostFx.RipN = rn; PostFx.Wet = (float)wet; PostFx.Day = (float)day; PostFx.Time = (float)(time % 3600); PostFx.Ox = cx; PostFx.Oy = cy;
                frame.WeatherReady = true;
                DrawDrops(frame, dt, day);
                return;
            }
            int n = W * Hh;
            if (srcC == null || srcC.Length != n) { srcC = new uint[n]; srcL = new uint[n]; }
            Array.Copy(C, srcC, n); Array.Copy(L, srcL, n);

            // 每一欄：水深→上下範圍；每一格：倒影＋水色，再加邊
            for (int sx = 0; sx < W; sx++)
            {
                int wx = sx + cx; if (wx < 0 || wx >= TOWN_W) continue;
                double d = depth[wx]; if (d <= 0) continue;
                double h = 0.5 + d * HALF;
                int y0 = (int)Math.Ceiling(MID - h - 0.01), y1 = (int)Math.Floor(MID + h);
                y0 = Math.Max(y0, (int)TOP);
                if (y1 < y0) continue;
                // 漣漪讓倒影左右晃
                double wob = 0;
                foreach (var r in ripples) { double u = r.t / 0.9, dd = Math.Abs(wx - r.x) - (1 + 9 * Math.Sqrt(u)); if (Math.Abs(dd) < 2) wob += Math.Sin(dd * 2.5 + r.t * 20) * (1 - u) * (r.big ? 1.6 : 1.0); }
                {   // 水窪底下一列草皮壓暗（水比地面低一點的感覺）
                    int by = y1 + 1 - cy;
                    if (by >= 0 && by < Hh && d > 0.25) { uint g = C[by * W + sx]; C[by * W + sx] = Pack((g & 255) * 0.72, ((g >> 8) & 255) * 0.74, ((g >> 16) & 255) * 0.8); }
                }
                for (int wy = y0; wy <= y1; wy++)
                {
                    int y = wy - cy; if (y < 0 || y >= Hh) continue;
                    int i = y * W + sx;
                    double row = wy - TOP;                       // 0＝最遠的那一列
                    int ry = (int)Math.Round(FLOOR - 1 - (row + 0.5) * SQUASH) - cy;
                    int rx = sx + (int)Math.Round(wob + Math.Sin(wy * 1.7 + time * 2.1 + wx * 0.05) * 0.45);
                    rx = Math.Max(0, Math.Min(W - 1, rx));
                    uint rc = ry >= 0 && ry < Hh ? srcC[ry * W + rx] : srcC[rx];
                    uint rl = ry >= 0 && ry < Hh ? srcL[ry * W + rx] : 0;
                    // 遠的列反射多（像鏡子），近的列看得到水底、比較暗
                    double refl = 0.74 - 0.07 * row;
                    double r0 = rc & 255, g0 = (rc >> 8) & 255, b0 = (rc >> 16) & 255;
                    // 水底：被漣漪和雜訊左右扭的草皮（地面的折射）
                    int ux = Math.Max(0, Math.Min(W - 1, sx + (int)Math.Round(wob * 0.6 + Math.Sin(wy * 2.3 + time * 3.1 + wx * 0.4) * 0.8)));
                    uint uc = srcC[y * W + ux];
                    double ur = (uc & 255) * 0.55 + wr * 0.35, ug = ((uc >> 8) & 255) * 0.62 + wg * 0.35, ub = ((uc >> 16) & 255) * 0.78 + wb * 0.35;
                    double rr = r0 * refl + ur * (1 - refl), gg = g0 * refl + ug * (1 - refl), bb = b0 * refl + ub * (1 - refl);
                    double edgeT = wy - (MID - h), edgeB = (MID + h) - wy;
                    // 跟原本的草皮淡淡混一點：水很淺的兩頭
                    double a = Math.Min(1, 0.55 + d * 0.9);
                    uint gc = srcC[i];
                    rr = rr * a + (gc & 255) * (1 - a); gg = gg * a + ((gc >> 8) & 255) * (1 - a); bb = bb * a + ((gc >> 16) & 255) * (1 - a);
                    if (edgeB < 1) { rr *= 0.5; gg *= 0.54; bb *= 0.64; }                 // 近邊：暗線
                    else if (edgeT < 1)
                    {
                        // 遠邊：亮邊，跟著慢慢移動的雜訊斷斷續續
                        double lip = Noise((wx + drift) / 6.0, 5) * 0.7 + Noise((wx - drift * 0.6) / 2.3, 6) * 0.3;
                        if (lip > 0.36) { double k = 0.5 + 0.3 * day; rr += (220 - rr) * k; gg += (232 - gg) * k; bb += (246 - bb) * k; }
                    }
                    // 反光點：沿著遠邊慢慢滑動的亮點
                    bool glint = edgeT < 2 && Noise((wx - time * 5) / 7.0, 7) > 0.9 && d > 0.35;
                    if (glint) { rr += (255 - rr) * 0.85; gg += (255 - gg) * 0.85; bb += (255 - bb) * 0.85; }
                    C[i] = Pack(rr, gg, bb);
                    if (glint) { uint ll = L[i]; L[i] = Pack((ll & 255) + 60, ((ll >> 8) & 255) + 70, ((ll >> 16) & 255) + 90); }
                    // 燈光的倒影（晚上的路燈、窗戶）
                    if (rl != 0)
                    {
                        uint ll = L[i]; double kL = 0.55 * refl;
                        L[i] = Pack((ll & 255) + (rl & 255) * kL, ((ll >> 8) & 255) + ((rl >> 8) & 255) * kL, ((ll >> 16) & 255) + ((rl >> 16) & 255) * kL);
                    }
                }
            }

            // 漣漪的環：側面看＝兩小段往左右滑開，兩圈
            uint ringHot = Pack(232, 242, 255), ringCool = Pack(150 + 60 * day, 175 + 50 * day, 215 + 30 * day);
            foreach (var r in ripples)
            {
                int X = (int)r.x; if (X < 0 || X >= TOWN_W) continue;
                double d = depth[X]; int ry = (int)Math.Round(MID - (0.5 + d * HALF) * 0.15);
                if (r.t < 0.05) Px(frame, X, ry, ringHot);
                for (int k = 0; k < 2; k++)
                {
                    double u = (r.t - k * 0.16) / (r.big ? 0.7 : 0.55);
                    if (u <= 0 || u >= 1) continue;
                    int w = (int)Math.Round(1 + (r.big ? 9 : 6) * Math.Sqrt(u));
                    uint c = u < 0.4 && k == 0 ? ringHot : ringCool;
                    for (int s = -1; s <= 1; s += 2) for (int e = 0; e < (u < 0.6 ? 2 : 1); e++)
                    {
                        int px = X + s * (w - e);
                        if (px >= 0 && px < TOWN_W && depth[px] > 0.15f) Px(frame, px, ry, c);
                    }
                }
            }

            DrawDrops(frame, dt, day);
        }

        // 主角踩起的水珠
        static void DrawDrops(Frame frame, double dt, double day)
        {
            uint dropC = Pack(170 + 60 * day, 200 + 40 * day, 240);
            for (int i = drops.Count - 1; i >= 0; i--)
            {
                var p = drops[i]; p.t += dt; p.vy += 260 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
                if (p.y > FLOOR + 2 || p.t > 1) { drops.RemoveAt(i); continue; }
                drops[i] = p;
                Px(frame, (int)Math.Round(p.x), (int)Math.Round(p.y), dropC);
            }
        }
        static void Px(Frame f, int wx, int wy, uint c)
        {
            int x = wx - f.Ox, y = wy - f.Oy;
            if (x < 0 || y < 0 || x >= f.W || y >= f.H) return;
            int i=y*f.W+x; f.ExcludeWeather(i); f.Color[i]=c;
        }
    }
}
