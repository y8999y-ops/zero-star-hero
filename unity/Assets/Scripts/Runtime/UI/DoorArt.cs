// door-art.js：視窗開啟轉場用的門板（工坊的鐵門、旅館的木門）＋ ui-trans.js 的卷軸桿。整片一次畫出來，放大 2 倍顯示。
using System;
using System.Collections.Generic;
using UnityEngine;

namespace ZeroStar.UI
{
    public static class DoorArt
    {
        static readonly Dictionary<string, Color32> cache = new Dictionary<string, Color32>();
        static Color32 H(string hex) { if (!cache.TryGetValue(hex, out var c)) { ColorUtility.TryParseHtmlString(hex, out var f); cache[hex] = c = f; } return c; }
        // JS 的 hash：乘法用浮點（超過 2^53 會進位），再照 ToInt32 截成 32 位元
        static int I32(double v) => unchecked((int)(long)v);
        static double Hash(int a, int b)
        {
            int h = I32((double)a * 374761393 + (double)b * 668265263);
            h = I32((double)(h ^ (int)((uint)h >> 13)) * 1274126177);
            return (uint)(h ^ (int)((uint)h >> 16)) / 4294967296.0;
        }
        static readonly Dictionary<string, Texture2D> made = new Dictionary<string, Texture2D>();

        /// kind：iron（side L／R）、wood、rod；回傳最近點取樣的貼圖
        public static Texture2D Get(string kind, int w, int h, string side = "L")
        {
            string key = $"{kind}{side}{w}x{h}";
            if (made.TryGetValue(key, out var t)) return t;
            var px = kind == "rod" ? Rod(w) : Door(kind, w, h, side);
            int ph = kind == "rod" ? 7 : h;
            t = new Texture2D(w, ph, TextureFormat.RGBA32, false) { filterMode = FilterMode.Point, wrapMode = TextureWrapMode.Clamp };
            var buf = new Color32[w * ph];
            for (int y = 0; y < ph; y++) for (int x = 0; x < w; x++) buf[(ph - 1 - y) * w + x] = px[y * w + x];
            t.SetPixels32(buf); t.Apply(false);
            return made[key] = t;
        }

        static Color32[] Door(string kind, int w, int h, string side)
        {
            var px = new Color32[w * h];
            void Set(int x, int y, string c) { if (x >= 0 && y >= 0 && x < w && y < h) px[y * w + x] = H(c); }
            if (kind == "iron")
            {
                string bas = "#5a5e74", hi = "#9aa0b4", lo = "#3a3c4e", dk = "#1e1e2a", rv = "#d8dce8", rvd = "#26263a", hot = "#ff8a3a", hot2 = "#ffd070";
                void Rivet(int x, int y) { Set(x, y, rv); Set(x + 1, y, hi); Set(x, y + 1, hi); Set(x + 1, y + 1, rvd); Set(x + 2, y + 1, dk); Set(x + 1, y + 2, dk); }
                const int PL = 18;
                for (int y = 0; y < h; y++) for (int x = 0; x < w; x++)
                {
                    int r = y % PL; bool edge = x < 2 || x >= w - 2 || y < 2 || y >= h - 2;
                    string c = r == 0 ? dk : r == 1 ? hi : r == PL - 1 ? lo : bas;
                    if (!edge && r > 2 && r < PL - 2 && Hash(x >> 3, y >> 2) < 0.025) c = lo;
                    if (edge) c = x == 0 || y == 0 || x == w - 1 || y == h - 1 ? dk : x == 1 || y == 1 ? hi : lo;
                    Set(x, y, c);
                }
                for (int y = PL; y < h - 4; y += PL) for (int x = 6; x < w - 6; x += 14) Rivet(x, y + 3);
                for (int y = 8; y < h - 6; y += 22) { Rivet(4, y); Rivet(w - 7, y); }
                int by = h / 2, bx0 = side == "L" ? w - 22 : 0, bx1 = side == "L" ? w : 22;
                for (int x = bx0; x < bx1; x++) { Set(x, by - 3, dk); Set(x, by - 2, hot2); Set(x, by - 1, hot); Set(x, by, hot); Set(x, by + 1, "#a83a14"); Set(x, by + 2, dk); }
                int kx = side == "L" ? w - 16 : 8;
                for (int y = by - 6; y <= by + 5; y++) for (int x = kx; x < kx + 8; x++)
                {
                    if (y >= by - 3 && y <= by + 2 && x > kx && x < kx + 7) continue;
                    Set(x, y, x == kx || x == kx + 7 || y == by + 5 ? dk : y == by - 6 ? hi : lo);
                }
            }
            else
            {
                string bas = "#9a6434", b2 = "#8a5a2c", hi = "#c89058", lo = "#6a4020", dk = "#2e1808", knot = "#4a2a10", iron = "#3a3c4e", ironHi = "#9aa0b4";
                var seams = new List<int> { 0 };
                for (int x = 0; x < w;) { x += 9 + (int)Math.Floor(Hash(x, 7) * 5); seams.Add(x); }
                for (int y = 0; y < h; y++) for (int x = 0; x < w; x++)
                {
                    int i = seams.FindIndex(s => s > x) - 1, s0 = seams[i], s1 = seams[i + 1], u = x - s0;
                    string c = u == 0 ? dk : u == 1 ? hi : x == s1 - 1 ? lo : i % 2 == 1 ? b2 : bas;
                    if (u > 2 && x < s1 - 2 && (u == 3 + (i % 3) || u == s1 - s0 - 3) && Hash(x, y >> 3) < 0.55) c = lo;
                    Set(x, y, c);
                }
                void Bar(int y0) { for (int y = y0; y < y0 + 8; y++) for (int x = 2; x < w - 2; x++) Set(x, y, y == y0 ? hi : y == y0 + 7 ? dk : y == y0 + 6 ? lo : bas); }
                int t = 12, b = h - 20;
                Bar(t); Bar(b);
                for (int k = 0; ; k++)
                {
                    int x = 4 + k, y = b - 1 - (int)Math.Round((double)(k * (b - t - 8)) / (w - 8), MidpointRounding.AwayFromZero);
                    if (x >= w - 4) break;
                    for (int d = 0; d < 9; d++) Set(x, y - d, d == 0 ? dk : d == 1 ? lo : d == 8 ? hi : bas);
                }
                foreach (int y in new[] { t + 3, b + 3 }) foreach (int x in new[] { 5, w - 8 }) { Set(x, y, ironHi); Set(x + 1, y, iron); Set(x, y + 1, iron); Set(x + 1, y + 1, dk); }
                foreach (var (kx, ky) in new[] { ((int)Math.Floor(w * 0.3 + 0.5), (int)Math.Floor(h * 0.35 + 0.5)), ((int)Math.Floor(w * 0.7 + 0.5), (int)Math.Floor(h * 0.68 + 0.5)) })
                { Set(kx, ky, knot); Set(kx + 1, ky, knot); Set(kx, ky + 1, dk); Set(kx + 1, ky + 1, knot); Set(kx - 1, ky, lo); Set(kx + 2, ky + 1, lo); }
                int hx = w - 14, hy = h / 2;
                for (int dy = -4; dy <= 4; dy++) for (int dx = -4; dx <= 4; dx++)
                {
                    double d = Math.Sqrt(dx * dx + dy * dy);
                    if (d > 2.6 && d < 4.4) Set(hx + dx, hy + dy, d > 3.6 ? dk : dx + dy < 0 ? ironHi : iron);
                }
                Set(hx - 1, hy - 1, ironHi); Set(hx, hy - 1, ironHi); Set(hx - 1, hy, iron); Set(hx, hy, dk);
                for (int x = 0; x < w; x++) { Set(x, 0, dk); Set(x, h - 1, dk); }
                for (int y = 0; y < h; y++) { Set(0, y, dk); Set(w - 1, y, dk); }
            }
            return px;
        }
        // 卷軸桿：木棒＋兩端金色圓頭
        static Color32[] Rod(int w)
        {
            const int h = 7; var px = new Color32[w * h];
            string[] WOOD = { "#2e1808", "#c89058", "#9a6434", "#6a4020", "#2e1808" }, GOLD = { "#1a0c06", "#fff2b0", "#f0b840", "#c07a2a", "#1a0c06" };
            for (int x = 0; x < w; x++)
            {
                bool cap = x < 6 || x >= w - 6; var R = cap ? GOLD : WOOD;
                for (int y = cap ? 0 : 1; y < (cap ? h : h - 1); y++)
                {
                    int t = cap ? y : y - 1, n = cap ? h : h - 2;
                    px[y * w + x] = H(x == 0 || x == w - 1 || t == 0 || t == n - 1 ? R[0] : t == 1 ? R[1] : t >= n - 2 ? R[3] : R[2]);
                }
            }
            return px;
        }
    }
}
