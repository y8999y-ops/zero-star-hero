// pixelfx core 的 color.js 翻成 C#。顏色是 32 位元整數，記憶體排列 R、G、B、A（跟網頁 ImageData 一樣）：
//   值 = A<<24 | B<<16 | G<<8 | R。0 代表「沒有顏色」。
using System;
using System.Collections.Generic;

namespace PixelFX
{
    public static class Col
    {
        /// rgb(r, g, b)：JS 版用 `& 255`，小數會先被截斷。
        public static uint Rgb(double r, double g, double b) =>
            unchecked((uint)((255 << 24) | ((Pf.ToInt32(b) & 255) << 16) | ((Pf.ToInt32(g) & 255) << 8) | (Pf.ToInt32(r) & 255)));
        public static int R(uint c) => (int)(c & 255);
        public static int G(uint c) => (int)((c >> 8) & 255);
        public static int B(uint c) => (int)((c >> 16) & 255);
        public static int A(uint c) => (int)(c >> 24);

        /// "#rgb" 或 "#rrggbb" 轉成顏色。
        public static uint Hex(string h)
        {
            string s = h.Replace("#", "");
            if (s.Length == 3) s = "" + s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
            int v = Convert.ToInt32(s.Substring(0, 6), 16);
            return Rgb((v >> 16) & 255, (v >> 8) & 255, v & 255);
        }
        public static string ToHex(uint c) => "#" + R(c).ToString("x2") + G(c).ToString("x2") + B(c).ToString("x2");

        public static uint Mix(uint a, uint b, double t)
        {
            t = Pf.Clamp(t);
            return Rgb(R(a) + (R(b) - R(a)) * t, G(a) + (G(b) - G(a)) * t, B(a) + (B(b) - B(a)) * t);
        }
        public static uint Scale(uint c, double k) => Rgb(Math.Min(255, R(c) * k), Math.Min(255, G(c) * k), Math.Min(255, B(c) * k));
        public static double Luma(uint c) => (0.299 * R(c) + 0.587 * G(c) + 0.114 * B(c)) / 255;

        public static uint[] Ramp(string[] list) { var r = new uint[list.Length]; for (int i = 0; i < list.Length; i++) r[i] = Hex(list[i]); return r; }
        /// 把色階重新取樣成剛好 n 階（兩端不動），讓特效可以用 C[5] 這樣的編號。
        public static uint[] Fit(string[] list, int n) => Fit(Ramp(list), n);
        public static uint[] Fit(uint[] r, int n)
        {
            if (r.Length == n) return (uint[])r.Clone();
            var o = new uint[n];
            for (int i = 0; i < n; i++) o[i] = r[(int)Pf.Round((i * (r.Length - 1)) / (double)Math.Max(1, n - 1))];
            return o;
        }
        /// 色階上 t 的那一階，不混色。
        public static uint At(uint[] r, double t) => r[(int)Pf.Clamp(Math.Floor(t * r.Length), 0, r.Length - 1)];
        /// 色階上混色（給光用）。
        public static uint Blend(uint[] r, double t)
        {
            double x = Pf.Clamp(t) * (r.Length - 1); int i = (int)Math.Min(r.Length - 2, Math.Floor(x));
            return Mix(r[i], r[i + 1], x - i);
        }

        public static readonly uint WHITE = Hex("#ffffff");
        public static readonly uint BLACK = Hex("#000000");
        public static readonly uint INK = Hex("#0b0a10");
        public static readonly uint PATCH = Hex("#f53cd1");

        public static readonly Dictionary<string, string[]> PAL = new Dictionary<string, string[]>
        {
            ["fire"] = new[] { "#1f0b10", "#4a1118", "#8c1d1c", "#cc3a1a", "#f2701f", "#ffae35", "#ffe27a", "#fff8d6" },
            ["ember"] = new[] { "#1a0a0e", "#3d1012", "#701a14", "#a8301a", "#e0561e", "#ff8a2a", "#ffc46a" },
            ["smoke"] = new[] { "#0e0c12", "#1d1a22", "#2e2a35", "#433e4b", "#5c5664", "#7b7484", "#a39cab" },
            ["dust"] = new[] { "#1c1610", "#33281c", "#4f3f2c", "#6e5a40", "#927a58", "#b89f78", "#dcc8a2" },
            ["ice"] = new[] { "#0c1430", "#162c5c", "#1f4f94", "#2f7fcc", "#58b4ec", "#9bdcff", "#d8f4ff", "#ffffff" },
            ["holy"] = new[] { "#2a1c08", "#5a3e10", "#9a6c18", "#d8a428", "#ffd84a", "#fff09a", "#fffbe6", "#ffffff" },
            ["arcane"] = new[] { "#140a26", "#2b1252", "#481c88", "#6b2cc0", "#9a48ec", "#c684ff", "#ecc8ff", "#ffffff" },
            ["gold"] = new[] { "#1e1206", "#4a2c08", "#86520c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff" },
            ["metal"] = new[] { "#0c0e14", "#1c2230", "#2e3648", "#4a5468", "#6e7a90", "#9aa6ba", "#d0d8e6", "#ffffff" },
            ["stone"] = new[] { "#0e0e12", "#1c1c24", "#2c2c38", "#42424f", "#5c5c6b", "#7d7d8c", "#a4a4b2", "#d0d0da" },
        };
    }
}
