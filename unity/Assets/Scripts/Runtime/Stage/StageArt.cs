// 幾個小的畫法一起翻成 C#（一行一行照原本）：
//   game/src/altar-art.js（Altar.Draw：星之祭壇，存檔點）
//   game/src/chest-tiers.js（ChestTiers：寶箱等級）
//   game/src/lowhpfx.js（LowHp.Draw、LowHp.Beat：低血量時四角染紅、心跳）
using System;
using System.Collections.Generic;
using System.Linq;
using PixelFX;

namespace ZeroStar
{
    public static class Altar
    {
        static uint P(string c) => Col.Hex(c);
        static readonly uint[] STONE = new[] { "#1a1828", "#3a3850", "#5a5874", "#7c7a98", "#a8a6c0" }.Select(P).ToArray();
        static readonly uint[] DULL = new[] { "#1c2236", "#34405e", "#506488", "#7488aa" }.Select(P).ToArray();
        static readonly uint[] GOLD = new[] { "#6e3a0c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff" }.Select(P).ToArray();
        static readonly uint OUT = P("#0c0a14");
        static void Put(Frame frame, double x, double y, uint c, bool glow = false)
        {
            int X = (int)Pf.Round(x) - frame.Ox, Y = (int)Pf.Round(y) - frame.Oy;
            if (X < 0 || Y < 0 || X >= frame.W || Y >= frame.H) return;
            frame.Color[Y * frame.W + X] = c;
            if (glow) frame.Light[Y * frame.W + X] = c;
        }
        // 石台：三層，字元 a～d＝明暗；中段正中間刻一顆星（r，點亮會發光）
        static readonly string[] BASE = new[]
        {
            "..bccccccccccccccb..",
            ".bdddddddddddddddcb.",
            ".abbbbbbbbbbbbbbbba.",
            "...bcccccrcccccba...",
            "...bccccrrrcccba....",
            "...bcccccrcccccba...",
            "..bccccccccccccccb..",
            ".bdddddddddddddddcba",
            "abbbbbbbbbbbbbbbbbba",
        }.Select(r => r.PadRight(20, '.')).ToArray();
        // 碎片：一個斷掉的星星尖角
        static readonly string[] SHARD =
        {
            ".....w.....",
            ".....sm....",
            "....ssm....",
            "....ssmd...",
            "...sssmd...",
            "...sssmdd..",
            "..ssssmdd..",
            "..ssssmddd.",
            ".sssssmddd.",
            ".sssssmdddd",
            "ssssssmdddd",
            "ssssssmdddd",
            ".ssss.mdd.d",
            "..ss..md...",
            "...s.......",
        };
        static bool At(string[] rows, int i, int j) => j >= 0 && j < rows.Length && i >= 0 && i < rows[j].Length && rows[j][i] != '.';
        /// (x, y)＝石台底部中心（貼地）；pulse 0～1＝重生時的反應（main.js 每幀遞減）
        public static void Draw(Frame frame, double x, double y, bool lit, double t = 0, double pulse = 0)
        {
            int W = BASE[0].Length; double bx = Pf.Round(x - W / 2.0), by = Pf.Round(y - BASE.Length);
            var SC = new Dictionary<char, uint> { ['a'] = STONE[1], ['b'] = STONE[2], ['c'] = STONE[3], ['d'] = pulse > 0.5 ? GOLD[4] : STONE[4], ['r'] = pulse > 0.3 ? GOLD[5] : lit ? GOLD[3] : STONE[1] };
            void Cells(string[] rows, double ox, double oy, Dictionary<char, uint> map, string glowKeys = "")
            {
                for (int j = 0; j < rows.Length; j++) for (int i = 0; i < rows[j].Length; i++) { char ch = rows[j][i]; if (ch != '.') Put(frame, ox + i, oy + j, map[ch], glowKeys.IndexOf(ch) >= 0); }
            }
            void Outline(string[] rows, double ox, double oy)
            {
                for (int j = -1; j <= rows.Length; j++) for (int i = -1; i <= rows[0].Length; i++) if (!At(rows, i, j) && (At(rows, i + 1, j) || At(rows, i - 1, j) || At(rows, i, j + 1) || At(rows, i, j - 1))) Put(frame, ox + i, oy + j, OUT);
            }
            // 碎片插在石台頂上（底部埋進去 2 格）
            double sx = Pf.Round(x - 6), sy = by - SHARD.Length + 3, bob = lit ? Pf.Round(Pf.Sin(t * 2) * 0.6) : 0;
            Outline(BASE, bx, by);
            Cells(BASE, bx, by, SC, lit ? (pulse > 0.5 ? "rd" : "r") : "");
            Outline(SHARD, sx, sy + bob);
            var MC = pulse > 0.45 ? new Dictionary<char, uint> { ['w'] = GOLD[5], ['s'] = GOLD[5], ['m'] = GOLD[5], ['d'] = GOLD[3] }
                : pulse > 0.15 ? new Dictionary<char, uint> { ['w'] = GOLD[5], ['s'] = GOLD[4], ['m'] = GOLD[5], ['d'] = GOLD[2] }
                : lit ? new Dictionary<char, uint> { ['w'] = GOLD[5], ['s'] = GOLD[3], ['m'] = GOLD[4], ['d'] = GOLD[1] }
                : new Dictionary<char, uint> { ['w'] = DULL[3], ['s'] = DULL[3], ['m'] = DULL[2], ['d'] = DULL[1] };
            Cells(SHARD, sx, sy + bob, MC, lit || pulse > 0 ? (pulse > 0.15 ? "wsmd" : "wm") : "");
            // 重生的反應：碎片上方一道細光柱、石台底部一圈光點往兩邊散開
            if (pulse > 0)
            {
                double hgt = Pf.Round(46 * pulse), cx = sx + 5;
                for (int j = 0; j < hgt; j++)
                {
                    double yy = sy - 2 - j, e = 1 - j / (hgt + 1); if (e < 0.3 && j % 2 != 0) continue;
                    Put(frame, cx, yy, e > 0.5 ? GOLD[5] : GOLD[4], true); if (pulse > 0.4 && e > 0.25) { Put(frame, cx - 1, yy, GOLD[3], true); Put(frame, cx + 1, yy, GOLD[3], true); }
                }
                double spread = Pf.Round(4 + (1 - pulse) * 26);
                foreach (int sgn in new[] { -1, 1 }) for (int q = 0; q < 3; q++) { double px = x + sgn * (spread + q * 5), py = y - 1 - Pf.Round(Pf.Sin((1 - pulse) * Math.PI) * (3 + q * 2)); Put(frame, px, py, q == 0 ? GOLD[5] : GOLD[3], true); }
            }
            if (!lit) return;
            // 點亮：碎片尖端的十字星光一閃一閃、往上飄的星屑
            double k = Pf.Sin(t * 3.1) * 0.5 + 0.5, tx = sx + 5, ty = sy + bob;
            Put(frame, tx, ty - 1, GOLD[5], true);
            foreach (var (dx, dy) in new[] { (1, 0), (-1, 0), (0, 1), (0, -1) }) Put(frame, tx + dx, ty - 1 + dy, GOLD[k > 0.5 ? 4 : 3], true);
            if (k > 0.7) foreach (var (dx, dy) in new[] { (2, 0), (-2, 0), (0, -2), (0, 2) }) Put(frame, tx + dx, ty - 1 + dy, GOLD[2], true);
            for (int n = 0; n < 6; n++)
            {
                double p = (t * 0.45 + n / 6.0) % 1, px = x - 9 + ((n * 7) % 18) + Pf.Sin(p * 6 + n) * 2, py = by - 2 - p * 30;
                Put(frame, px, py, p < 0.4 ? GOLD[5] : p < 0.75 ? GOLD[3] : GOLD[1], p < 0.75);
            }
        }
    }

    /// 寶箱等級：0 木箱、1 鐵箱、2 紅漆金箱、3 星箱。wood＝箱子本體的 7 階色，palette＝裡面透出來的光、光芒、金粉的 8 階色。
    public static class ChestTiers
    {
        public class Tier { public string Name; public string[] Wood, Palette; public int Coins, Gems; public (string rarity, int n)[] Items; }
        public static readonly Tier[] ALL =
        {
            new Tier { Name = "木箱", Wood = new[] { "#110a10", "#24131a", "#3a1f1f", "#552d24", "#73402c", "#925737", "#b07246" }, Palette = new[] { "#1e1206", "#4a2c08", "#86520c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff" }, Coins = 8, Gems = 1, Items = new[] { ("common", 1), ("fine", 1) } },
            new Tier { Name = "鐵箱", Wood = new[] { "#0c0a0e", "#1a1418", "#2a1f22", "#3c2b2a", "#523a32", "#6a4b3c", "#866048" }, Palette = new[] { "#0a1420", "#1a3048", "#2a5878", "#4a90b8", "#7ac8e8", "#b8f0ff", "#e8fcff", "#ffffff" }, Coins = 14, Gems = 3, Items = new[] { ("fine", 2), ("rare", 1) } },
            new Tier { Name = "紅漆金箱", Wood = new[] { "#14060a", "#2e0c14", "#4e1420", "#701c28", "#922834", "#b43a40", "#d0584e" }, Palette = new[] { "#1e1206", "#4a2c08", "#86520c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff" }, Coins = 22, Gems = 6, Items = new[] { ("fine", 2), ("rare", 2) } },
            new Tier { Name = "星箱", Wood = new[] { "#0c0618", "#1c0e34", "#2e1656", "#46207a", "#622ca0", "#8040c8", "#a462e8" }, Palette = new[] { "#1a0a2a", "#3e1466", "#6a28a8", "#a050e0", "#d08cff", "#f0c8ff", "#fff0ff", "#ffffff" }, Coins = 32, Gems = 10, Items = new[] { ("rare", 3), ("epic", 1) } },
        };
        /// main.js 的 chestOpts(tier)：寶箱演出的選項（不噴錢和寶石，真正的錢由遊戲自己生）
        public static FxOptions Opts(int tier)
        {
            var T = ALL[tier];
            return new FxOptions { Palette = T.Palette, Light = 0.3 + tier * 0.08 }.Set("tier", tier).Set("wood", T.Wood).Set("coins", 0).Set("gems", 0);
        }
    }

    public static class LowHp
    {
        static readonly int[] BAYER = { 0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5 };
        static readonly int[][] RED = { new[] { 160, 18, 26 }, new[] { 86, 6, 14 } };   // 外圈、最角落
        /// k＝血量比例（0～0.3 有效）、pulse＝0～1 的脈動；zoom：鏡頭拉近時照看得到的範圍算四角；dy0：看得到的範圍往下移幾格
        public static void Draw(Frame frame, double k, double pulse, double zoom = 1, double dy0 = 0)
        {
            if (k >= 0.3) return;
            int W = frame.W, H = frame.H; var C = frame.Color; double danger = 1 - k / 0.3;
            double reach = Math.Max(0.6, 0.93 - 0.22 * danger - 0.1 * pulse);
            double amt = 0.3 + 0.3 * danger + 0.4 * pulse;
            double cx = W / 2.0, cy = H / 2.0 + dy0;
            for (int y = 0; y < H; y++) for (int x = 0; x < W; x++)
                {
                    double dx = ((x - cx) / cx) * zoom, dy = ((y - cy) / (H / 2.0)) * zoom, d = Math.Sqrt(dx * dx * 0.7 + dy * dy * 1.0) / Math.Sqrt(1.7) * 1.3;
                    double v = (d - reach) / (1 - reach) * amt;
                    if (v <= 0) continue;
                    double th = BAYER[((y & 3) << 2) | (x & 3)] / 16.0;
                    int step = v > 0.82 + th * 0.18 ? 2 : v > th ? 1 : 0;
                    if (step == 0) continue;
                    int i = y * W + x; uint c = C[i]; double r = c & 255, g = (c >> 8) & 255, b = (c >> 16) & 255; var tc = RED[step - 1]; double m = step == 1 ? 0.38 : 0.62;
                    C[i] = 0xff000000u | ((uint)Pf.Round(b + (tc[2] - b) * m) << 16) | ((uint)Pf.Round(g + (tc[1] - g) * m) << 8) | (uint)Pf.Round(r + (tc[0] - r) * m);
                }
        }
        /// 心跳的脈動曲線：phase 0～1 一拍；兩下（咚、咚）
        public static double Beat(double phase)
        {
            double p1 = phase < 0.5 ? Pf.Exp(-phase * 14) : 0, p2 = phase > 0.18 && phase < 0.7 ? 0.6 * Pf.Exp(-(phase - 0.18) * 14) : 0;
            return Math.Min(1, p1 + p2);
        }
    }
}
