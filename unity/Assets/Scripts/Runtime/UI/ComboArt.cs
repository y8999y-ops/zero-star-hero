// combo-art.js：連段計數器（像素風）。粗體斜字的數字、階級配色、COMBO 字樣＋小星星、會慢慢縮短的倒數條。
// 階級：1～9 白、10～24 金、25～49 火紅、50～99 星藍、100 以上彩虹。到 10／25／50／100 會閃一下、冒星星。
// 畫在一張 76×32 的小圖上（邏輯像素 1 格＝2 CSS px），每一格都重畫。
// 網頁版的 CSS 動畫（bump、mile、end）改成這裡算時間：Hud 照 BumpAge、MileAge、EndAge 放大、旋轉、淡出。
using System;
using System.Collections.Generic;
using UnityEngine;

namespace ZeroStar.UI
{
    public class ComboArt
    {
        public const int LW = 76, LH = 32;
        static readonly Dictionary<char, string[]> BIG = new Dictionary<char, string[]>
        {
            ['0'] = new[] { ".###.", "##.##", "##.##", "##.##", "##.##", "##.##", ".###." }, ['1'] = new[] { ".##..", "###..", ".##..", ".##..", ".##..", ".##..", "####." },
            ['2'] = new[] { ".###.", "##.##", "...##", "..##.", ".##..", "##...", "#####" }, ['3'] = new[] { "####.", "...##", "...##", ".###.", "...##", "...##", "####." },
            ['4'] = new[] { "##.##", "##.##", "##.##", "#####", "...##", "...##", "...##" }, ['5'] = new[] { "#####", "##...", "####.", "...##", "...##", "##.##", ".###." },
            ['6'] = new[] { ".###.", "##...", "##...", "####.", "##.##", "##.##", ".###." }, ['7'] = new[] { "#####", "...##", "...##", "..##.", "..##.", ".##..", ".##.." },
            ['8'] = new[] { ".###.", "##.##", "##.##", ".###.", "##.##", "##.##", ".###." }, ['9'] = new[] { ".###.", "##.##", "##.##", ".####", "...##", "...##", ".###." },
        };
        static readonly Dictionary<char, string[]> SMALL = new Dictionary<char, string[]>
        {
            ['C'] = new[] { "111", "100", "100", "100", "111" }, ['O'] = new[] { "111", "101", "101", "101", "111" }, ['M'] = new[] { "101", "111", "111", "101", "101" }, ['B'] = new[] { "110", "101", "110", "101", "110" },
        };
        static readonly string[] STAR = { "...#...", "..###..", "#######", ".#####.", "..###..", ".##.##.", "##...##" };
        // [亮, 中, 暗, 外框]
        static readonly (int min, string[] pal)[] TIERS =
        {
            (1, new[] { "#ffffff", "#fff0c8", "#c8b08a", "#2a1626" }),
            (10, new[] { "#fffbe0", "#ffd24a", "#c07a14", "#2a1206" }),
            (25, new[] { "#fff0a0", "#ff9a2a", "#c02a10", "#2a0806" }),
            (50, new[] { "#ffffff", "#7ae8ff", "#2a7ad0", "#08142a" }),
        };
        static readonly string[] RAINBOW = { "#ff6a6a", "#ffb03a", "#ffe85a", "#6af07a", "#5ad0ff", "#a88aff" };
        static readonly int[] MILES = { 10, 25, 50, 100, 200, 300 };
        static readonly Dictionary<string, Color32> cache = new Dictionary<string, Color32>();
        static Color32 Hex(string h) { if (!cache.TryGetValue(h, out var c)) { ColorUtility.TryParseHtmlString(h, out var f); cache[h] = c = f; } return c; }

        public readonly Texture2D Tex = new Texture2D(LW, LH, TextureFormat.RGBA32, false) { filterMode = FilterMode.Point, wrapMode = TextureWrapMode.Clamp };
        readonly Color32[] buf = new Color32[LW * LH];
        int shown; float endT, clock;
        class Spark { public float x, y, vx, vy, t; }
        readonly List<Spark> sparks = new List<Spark>();
        /// 給 Hud 用的狀態（網頁版的 class：on、end、bump、mile）
        public bool On, End; public float BumpAge = 99, MileAge = 99, EndAge;

        void Px(int x, int y, Color32 c) { if (x < 0 || y < 0 || x >= LW || y >= LH) return; buf[(LH - 1 - y) * LW + x] = c; }

        string[] Palette(int n)
        {
            if (n >= 100)
            {
                int i = (int)Math.Floor(clock * 8);
                return new[] { "#ffffff", RAINBOW[i % 6], RAINBOW[(i + 2) % 6], "#140a24" };
            }
            var p = TIERS[0].pal;
            foreach (var (min, q) in TIERS) if (n >= min) p = q;
            return p;
        }

        static readonly int[,] OUT8 = { { -1, 0 }, { 1, 0 }, { 0, -1 }, { 0, 1 }, { 1, 1 }, { 2, 2 }, { 1, 2 }, { 2, 1 } };
        static readonly int[,] OUT5 = { { -1, 0 }, { 1, 0 }, { 0, -1 }, { 0, 1 }, { 1, 1 } };
        static readonly int[,] OUT4 = { { -1, 0 }, { 1, 0 }, { 0, -1 }, { 0, 1 } };
        readonly List<(int x, int y, int yy)> cells = new List<(int, int, int)>();

        void Draw(int n, float k)
        {
            Array.Clear(buf, 0, buf.Length);
            var P = Palette(n); Color32 hi = Hex(P[0]), mid = Hex(P[1]), low = Hex(P[2]), outc = Hex(P[3]), white = Hex("#ffffff");
            string text = n.ToString(); const int s = 2, dw = 5 * s, gap = 2;
            int tw = text.Length * dw + (text.Length - 1) * gap;
            int x0 = LW - 4 - tw, y0 = 2;
            // 數字：先畫影子（右下 1 格）＋外框，再填色；越上面的列往右偏一點＝斜體
            cells.Clear();
            for (int ci = 0; ci < text.Length; ci++)
            {
                var rows = BIG[text[ci]];
                for (int j = 0; j < rows.Length; j++) for (int i = 0; i < rows[j].Length; i++)
                {
                    if (rows[j][i] != '#') continue;
                    for (int a = 0; a < s; a++) for (int b = 0; b < s; b++)
                    {
                        int yy = j * s + b, slant = (int)Math.Floor((7 * s - 1 - yy) / 5.0);
                        cells.Add((x0 + ci * (dw + gap) + i * s + a + slant, y0 + yy, yy));
                    }
                }
            }
            foreach (var (x, y, _) in cells) for (int q = 0; q < 8; q++) Px(x + OUT8[q, 0], y + OUT8[q, 1], outc);
            foreach (var (x, y, yy) in cells) Px(x, y, yy < 4 ? hi : yy < 9 ? mid : low);
            // 每個數字左上角一點白光
            for (int ci = 0; ci < text.Length; ci++) { int bx = x0 + ci * (dw + gap) + 2 + (int)Math.Floor((7 * s - 2) / 5.0); if (BIG[text[ci]][0][1] == '#') Px(bx, y0 + 1, white); }
            // COMBO 字樣＋左邊的小星星
            const string label = "COMBO";
            int ly = y0 + 7 * s + 4, lw = label.Length * 4 - 1, lx = LW - 4 - lw;
            for (int pass = 0; pass < 2; pass++)
                for (int ci = 0; ci < label.Length; ci++)
                {
                    var rows = SMALL[label[ci]];
                    for (int j = 0; j < rows.Length; j++) for (int i = 0; i < rows[j].Length; i++)
                    {
                        if (rows[j][i] != '1') continue;
                        int x = lx + ci * 4 + i, y = ly + j;
                        if (pass == 0) { for (int q = 0; q < 5; q++) Px(x + OUT5[q, 0], y + OUT5[q, 1], outc); }
                        else Px(x, y, j < 2 ? hi : mid);
                    }
                }
            int sx = lx - 10, sy = ly - 1, spin = (int)Math.Floor(clock * 6) % 2;
            for (int j = 0; j < STAR.Length; j++) for (int i = 0; i < STAR[j].Length; i++) if (STAR[j][i] == '#') for (int q = 0; q < 4; q++) Px(sx + i + OUT4[q, 0], sy + j + OUT4[q, 1], outc);
            for (int j = 0; j < STAR.Length; j++) for (int i = 0; i < STAR[j].Length; i++) if (STAR[j][i] == '#') Px(sx + i, sy + j, j < 3 ? hi : spin == 1 && j == 3 ? hi : mid);
            // 倒數條：連段還剩多少時間
            const int bw = 34; int bx0 = LW - 4 - bw, by = ly + 7;
            for (int x = -1; x <= bw; x++) { Px(bx0 + x, by - 1, outc); Px(bx0 + x, by + 2, outc); }
            Px(bx0 - 1, by, outc); Px(bx0 - 1, by + 1, outc); Px(bx0 + bw, by, outc); Px(bx0 + bw, by + 1, outc);
            int fill = (int)Math.Round(bw * Math.Max(0, Math.Min(1, k)), MidpointRounding.AwayFromZero);
            bool blink = k < 0.3 && (int)Math.Floor(clock * 8) % 2 == 1;
            for (int x = 0; x < bw; x++) { Px(bx0 + x, by, x < fill ? hi : outc); Px(bx0 + x, by + 1, x < fill ? (blink ? outc : mid) : outc); }
            // 里程碑的星星火花
            foreach (var p in sparks)
            {
                int r = p.t < 0.15f ? 1 : p.t < 0.3f ? 2 : 1; var c = p.t < 0.2f ? white : mid;
                int px = Mathf.RoundToInt(p.x), py = Mathf.RoundToInt(p.y);
                for (int i = -r; i <= r; i++) { Px(px + i, py, c); Px(px, py + i, c); }
            }
            Tex.SetPixels32(buf); Tex.Apply(false);
        }

        /// 每一格叫：n＝目前連段、k＝倒數剩多少（0～1）
        public void Update(int n, float k, float dt)
        {
            clock += dt; BumpAge += dt; MileAge += dt; if (End) EndAge += dt;
            if (n > 0 && End) { End = false; shown = 0; }   // 斷掉後馬上又開始新的連段
            foreach (var p in sparks) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; }
            sparks.RemoveAll(p => p.t >= 0.45f);
            if (n > shown)
            {
                // 加連段：跳一下；跨過里程碑就閃、冒星星
                bool mile = false; foreach (var m in MILES) if (shown < m && n >= m) mile = true;
                if (mile)
                {
                    MileAge = 0;
                    for (int i = 0; i < 8; i++) { float a = i / 8f * Mathf.PI * 2; sparks.Add(new Spark { x = LW - 22 + Mathf.Cos(a) * 8, y = 9 + Mathf.Sin(a) * 5, vx = Mathf.Cos(a) * 60, vy = Mathf.Sin(a) * 30 }); }
                }
                BumpAge = 0; On = true; End = false; endT = 0;
            }
            else if (n == 0 && shown > 0 && !End)
            {
                // 斷掉：最後的數字留一下、往下掉著淡出
                End = true; EndAge = 0; endT = 0.6f;
            }
            if (n > 0) shown = n;
            else if (endT > 0 && (endT -= dt) <= 0) { On = false; End = false; shown = 0; }
            if (On) Draw(shown, n > 0 ? k : 0);
        }
    }
}
