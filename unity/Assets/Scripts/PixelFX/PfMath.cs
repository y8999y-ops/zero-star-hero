// pixelfx core 的 math.js 翻成 C#。全部用 double，運算順序照原本的 JS，讓每一格像素跟網頁版一樣。
// JS 的位元運算（x | 0、x & 255）是先「截斷成 32 位元整數」再算，用 ToInt32 模擬。
using System;

namespace PixelFX
{
    public static class Pf
    {
        public const double TAU = Math.PI * 2;
        public const double PI = Math.PI;

        /// JS ToInt32：截掉小數、超出範圍時取 2^32 的餘數（NaN、無限大變 0）。
        public static int ToInt32(double x)
        {
            if (double.IsNaN(x) || double.IsInfinity(x)) return 0;
            double t = Math.Truncate(x);
            if (t >= int.MinValue && t <= int.MaxValue) return (int)t;
            double m = t % 4294967296.0;
            if (m < 0) m += 4294967296.0;
            return unchecked((int)(uint)m);
        }
        /// JS Math.round：四捨五入、剛好 .5 往大的方向（C# 的 Math.Round 是銀行家捨入，不能用）。
        public static double Round(double x)
        {
            double r = Math.Floor(x);
            return x - r >= 0.5 ? r + 1 : r;
        }
        /// JS Math.hypot（照 V8 的做法：先除以最大值再平方加總，避免溢位）。
        public static double Hypot(double a, double b)
        {
            a = Math.Abs(a); b = Math.Abs(b);
            double max = Math.Max(a, b);
            if (double.IsInfinity(max)) return double.PositiveInfinity;
            if (double.IsNaN(a) || double.IsNaN(b)) return double.NaN;
            if (max == 0) return 0;
            // V8：sum 用 Kahan 補償加總
            double sum = 0, comp = 0;
            double x = a / max, s = x * x - comp, p = sum + s;
            comp = (p - sum) - s; sum = p;
            x = b / max; s = x * x - comp; p = sum + s;
            comp = (p - sum) - s; sum = p;
            return Math.Sqrt(sum) * max;
        }

        public static double Clamp(double x, double a = 0, double b = 1) => x < a ? a : x > b ? b : x;
        public static double Lerp(double a, double b, double t) => a + (b - a) * t;
        public static double InvLerp(double a, double b, double x) => b == a ? 0 : (x - a) / (b - a);
        public static double Remap(double x, double a0, double a1, double b0, double b1) => Lerp(b0, b1, InvLerp(a0, a1, x));
        public static double Fract(double x) => x - Math.Floor(x);
        public static double Wrap(double x, double m) => ((x % m) + m) % m;
        public static double Seg(double t, double t0, double t1) => Clamp((t - t0) / (t1 - t0));
        public static double Smooth(double e0, double e1, double x) { double t = Seg(x, e0, e1); return t * t * (3 - 2 * t); }
        public static double Bump(double t, double t0, double t1) => t <= t0 || t >= t1 ? 0 : Math.Sin(Math.PI * Seg(t, t0, t1));
        public static double Pingpong(double x) => 1 - Math.Abs(Wrap(x, 2) - 1);
        public static double Dist(double x0, double y0, double x1, double y1) => Hypot(x1 - x0, y1 - y0);
        public static double AngleTo(double x0, double y0, double x1, double y1) => Math.Atan2(y1 - y0, x1 - x0);

        static int Imul(int a, int b) => unchecked(a * b);
        /// 32 位元雜湊（照 math.js 的 hash）。
        public static uint Hash(params int[] ns)
        {
            int h = unchecked((int)0x9e3779b9);
            foreach (int n in ns)
            {
                h = Imul(h ^ n, unchecked((int)0x85ebca6b));
                h ^= (int)((uint)h >> 13);
                h = Imul(h, unchecked((int)0xc2b2ae35));
                h ^= (int)((uint)h >> 16);
            }
            return (uint)h;
        }
        public static double Rand(params int[] ns) => Hash(ns) / 4294967296.0;

        public static double Noise(double x, int seed = 0)
        {
            double i = Math.Floor(x), f = x - i, u = f * f * (3 - 2 * f);
            return Lerp(Rand(ToInt32(i), seed), Rand(ToInt32(i + 1), seed), u) * 2 - 1;
        }
        public static double Noise2(double x, double y, int seed = 0)
        {
            double ix = Math.Floor(x), iy = Math.Floor(y), fx = x - ix, fy = y - iy;
            double ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
            int X = ToInt32(ix), Y = ToInt32(iy);
            double a = Rand(X, Y, seed), b = Rand(X + 1, Y, seed), c = Rand(X, Y + 1, seed), d = Rand(X + 1, Y + 1, seed);
            return Lerp(Lerp(a, b, ux), Lerp(c, d, ux), uy) * 2 - 1;
        }
        public static double Fbm(double x, double y, int seed = 0, int octaves = 3)
        {
            double s = 0, a = 0.5, n = 0;
            for (int o = 0; o < octaves; o++) { s += Noise2(x, y, seed + o * 101) * a; n += a; x *= 2.03; y *= 2.03; a *= 0.5; }
            return s / n;
        }
        public static double LoopNoise(double phase, double radius = 1, int seed = 0)
        {
            double a = phase * TAU;
            return Noise2(Math.Cos(a) * radius + 50, Math.Sin(a) * radius + 50, seed);
        }
    }

    /// 緩動曲線（照 math.js 的 ease）。
    public static class Ease
    {
        public static double Linear(double t) => t;
        public static double InQuad(double t) => t * t;
        public static double OutQuad(double t) => 1 - (1 - t) * (1 - t);
        public static double InOutQuad(double t) => t < 0.5 ? 2 * t * t : 1 - Math.Pow(-2 * t + 2, 2) / 2;
        public static double InCubic(double t) => t * t * t;
        public static double OutCubic(double t) => 1 - Math.Pow(1 - t, 3);
        public static double InOutCubic(double t) => t < 0.5 ? 4 * t * t * t : 1 - Math.Pow(-2 * t + 2, 3) / 2;
        public static double InQuart(double t) => t * t * t * t;
        public static double OutQuart(double t) => 1 - Math.Pow(1 - t, 4);
        public static double InExpo(double t) => t <= 0 ? 0 : Math.Pow(2, 10 * t - 10);
        public static double OutExpo(double t) => t >= 1 ? 1 : 1 - Math.Pow(2, -10 * t);
        public static double InSine(double t) => 1 - Math.Cos((t * Math.PI) / 2);
        public static double OutSine(double t) => Math.Sin((t * Math.PI) / 2);
        public static double InOutSine(double t) => -(Math.Cos(Math.PI * t) - 1) / 2;
        public static double InBack(double t, double s = 1.70158) => t <= 0 ? 0 : t >= 1 ? 1 : (s + 1) * t * t * t - s * t * t;
        public static double OutBack(double t, double s = 1.70158) => t <= 0 ? 0 : t >= 1 ? 1 : 1 + (s + 1) * Math.Pow(t - 1, 3) + s * Math.Pow(t - 1, 2);
        public static double OutElastic(double t) => t <= 0 ? 0 : t >= 1 ? 1 : Math.Pow(2, -10 * t) * Math.Sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
        public static double OutBounce(double t)
        {
            const double n = 7.5625, d = 2.75;
            if (t < 1 / d) return n * t * t;
            if (t < 2 / d) { t -= 1.5 / d; return n * t * t + 0.75; }
            if (t < 2.5 / d) { t -= 2.25 / d; return n * t * t + 0.9375; }
            t -= 2.625 / d; return n * t * t + 0.984375;
        }
    }

    /// 可設種子的亂數（mulberry32，照 math.js 的 Rng）。
    public class Rng
    {
        uint s;
        public Rng(uint seed = 1) { s = seed != 0 ? seed : 1; }
        public double Next()
        {
            unchecked
            {
                s = s + 0x6d2b79f5;
                int t = (int)s;
                t = (int)((uint)t ^ ((uint)t >> 15)) * (t | 1);
                t ^= t + (int)((uint)t ^ ((uint)t >> 7)) * (t | 61);
                return (uint)(t ^ (int)((uint)t >> 14)) / 4294967296.0;
            }
        }
        public double Range(double a, double b) => a + (b - a) * Next();
        public int Int(int a, int b) => (int)Math.Floor(Range(a, b + 1));
        public bool Chance(double p) => Next() < p;
        public int Sign() => Next() < 0.5 ? -1 : 1;
        public double Gauss() => (Next() + Next() + Next() + Next() - 2) * 1.732;
        public static Rng Of(params int[] ns) => new Rng(Pf.Hash(ns));
    }
}
