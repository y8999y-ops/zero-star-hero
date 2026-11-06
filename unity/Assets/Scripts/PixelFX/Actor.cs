// pixelfx core 的 actor.js 翻成 C#：試特效用的替身角色（只有 mask 和原本的顏色，給 level-up 這類特效讀）。
// 特效只讀它的 mask（哪些像素是身體）和 pixels（原本的顏色），腳底在 (0, 0)。
using System.Collections.Generic;

namespace PixelFX
{
    public class Actor
    {
        public int MW, MH;           // mask 大小
        public byte[] Mask;          // 1＝身體
        public uint[] Pixels;        // 原本的顏色（0＝空）
        public double X, Y;          // mask 左上角（本地座標）
        public int K;
        public double HeadX, HeadY, ChestX, ChestY;
        public bool At(int i, int j) => i >= 0 && j >= 0 && i < MW && j < MH && Mask[j * MW + i] != 0;

        static readonly string[] HERO =
        {
            "....kkkkk...",
            "..kkhhhhhk..",
            ".khhhhhhhhk.",
            ".khhhhhhhhhk",
            ".khhssssshhk",
            ".khsessesshk",
            ".khsessesshk",
            "..ksssssssk.",
            "...kkSSSkk..",
            "..kttttttk..",
            ".kttTttTttk.",
            ".ksttTTttsk.",
            ".kstttttttk.",
            "..kbbbbbbk..",
            "..kppkkppk..",
            "..kppk.kppk.",
            "..kppk.kppk.",
            "..koook.kook",
            "..kkkkk.kkkk",
        };
        static readonly string[] HERO2 =
        {
            "...........kkk..........",
            "..........kAABk.........",
            ".........kAAABJk........",
            ".........kABBJJk........",
            ".........kBBBJCDk.......",
            ".........kBCJDDDk.......",
            ".........kkJJJDk........",
            ".......kkkkABBJCkk......",
            "......kAABCJBCCCkDk.....",
            "......kABBCJCCCmDkDk....",
            "......kBBCDDJCDDDkDk....",
            "......kABCDJDDDDDkk.....",
            ".....kAABDkDDDDJkk......",
            ".....kABCDkDDJJGkk......",
            ".....kABCkJJJGGGkk......",
            "....kJJCDkFFFGGGk.......",
            "....kAJJDkJJJGGGk.......",
            "....kJCJJkABBJGGk.......",
            ".....kJCCkBBCDJJJk......",
            ".....kCCCJBBCDJJDk......",
            ".....kCCCDJCCDkJDDk.....",
            "......kCDDJBCDkDDDk.....",
            ".......kDJJJCDkDDDkk....",
            ".......kJBCJCDkDDDkk....",
            ".......kBDJBCDkCDDkk....",
            "........kJJBCDkCDDk.....",
            "........kBBBCDkCCDDk....",
            "........kBBBCDkCCDDk....",
            ".........kBBCDkJDDDk....",
            "........kBJJJJkCJJJk....",
            "........kBBCCDkCCDDk....",
            "........kBBCDDkCDDk.....",
            "........kBBCDkCCDDk.....",
            "........kBCCDkCCDDk.....",
            "........kBCDDkCDDDk.....",
            ".......kJBCJkkkDJkkkk...",
            ".......kAJJAAAAkCCCCCk..",
            "........kkkkkkkkkkkkk...",
        };
        static readonly Dictionary<char, string> HERO_PAL = new Dictionary<char, string>
        {
            ['k'] = "#17121f",
            ['h'] = "#7a4128",
            ['s'] = "#f3c49d",
            ['S'] = "#c98b6c",
            ['e'] = "#17121f",
            ['t'] = "#5f6f94",
            ['T'] = "#46536f",
            ['b'] = "#8a5a32",
            ['p'] = "#38334a",
            ['o'] = "#6a4030",
            ['H'] = "#a35d34",
            ['w'] = "#ffffff",
            ['m'] = "#a3564a",
            ['g'] = "#e8c060",
            ['L'] = "#7f90b6",
            ['O'] = "#8f5a3f",
            ['P'] = "#4b4560",
            ['c'] = "#f53cd1",
            ['C'] = "#ff8fe6",
            ['D'] = "#a31f8a",
        };
        static readonly Dictionary<char, string> DUMMY_PAL = new Dictionary<char, string>
        {
            ['k'] = "#0e0c14",
            ['A'] = "#e4e6ec",
            ['B'] = "#b6b9c3",
            ['C'] = "#868995",
            ['D'] = "#5c5e6a",
            ['E'] = "#6e707c",
            ['F'] = "#4b4d58",
            ['G'] = "#34353f",
            ['J'] = "#2a2b33",
            ['m'] = "#f53cd1",
        };

        /// 替身角色：k = 1（12×19）或 2（24×38，中性灰的假人），腳底在原點。照 stockActor(k)。
        public static Actor Stock(int k = 1)
        {
            k = k == 2 ? 2 : 1;
            var rows = k == 2 ? HERO2 : HERO; var pal = k == 2 ? DUMMY_PAL : HERO_PAL;
            int w = rows[0].Length, h = rows.Length;
            var a = new Actor { MW = w, MH = h, Mask = new byte[w * h], Pixels = new uint[w * h], K = k };
            for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) { char ch = rows[y][x]; if (ch == '.') continue; a.Mask[y * w + x] = 1; a.Pixels[y * w + x] = Col.Hex(pal[ch]); }
            a.X = -(w / 2); a.Y = -h;
            a.HeadX = 0; a.HeadY = a.Y; a.ChestX = 0; a.ChestY = k == 2 ? -26 : a.Y + 11;
            return a;
        }
    }
}
