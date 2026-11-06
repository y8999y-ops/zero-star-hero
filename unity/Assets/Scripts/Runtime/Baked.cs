// 讀網頁版匯出的資料（game/tools/unity-export.mjs → Assets/Resources/Baked/*.bytes，gzip 壓過的二進位）：
//   場景（遊玩層像素、各圖層、光源、地形）、主角每個姿勢的像素、烘焙好的動畫（史萊姆、火把、煙、刀光）。
// 這些都是網頁版載入時算好的東西，直接拿來用，所以每個像素跟網頁版一樣。
using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Text;
using UnityEngine;

namespace ZeroStar
{
    /// 一張圖：W×H，像素 0xAABBGGRR（跟畫布一樣），0＝透明。
    public class Img
    {
        public int W, H;
        public uint[] Px;
        public bool Empty => W == 0;
    }

    /// 烘焙動畫的一格：只留有畫東西的範圍（Lx, Ly 是相對原點的左上角）。
    public class AnimFrame
    {
        public int W, H, Lx, Ly;
        public uint[] Color, Light;   // Light 可能是 null
    }

    /// 烘焙好的動畫（bake.js 的 bake）。
    public class Anim
    {
        public string Name;
        public int Fps;
        public bool Loop;
        public double Duration;
        public AnimFrame[] Frames;
    }

    /// 主角一個姿勢（star.js 的 build）：像素、腳底在第幾格（Ax, Ay）、肚子光的位置、前角尖端。
    public class HeroPose
    {
        public int W, H, Ax, Ay;
        public double CoreX, CoreY, HandX, HandY;
        public uint[] Px;
    }

    public class LightSrc
    {
        public double X, Y, R, Lv, Par = 1;
        public string Col;
        public LightSrc(double x, double y, double r, double lv, string col, double par = 1) { X = x; Y = y; R = r; Lv = lv; Col = col; Par = par; }
    }

    public class BigCrystal { public string Col; public double X, Y, X0, Y0; public Img Img; }
    public struct RectD { public double X, Y, W, H; }
    public struct Platform { public double X, Y, W; }

    public class LevelData
    {
        public string Stage;
        public int W, H, Floor, UH, Pin;
        public bool Tall;
        public uint[] PF;
        public byte[] PFE;
        public Img Back, Far, Mid, Near, Fg, UpFar, UpMid;
        public List<LightSrc> CrystalLights = new List<LightSrc>(), PropLights = new List<LightSrc>();
        public List<(double x, double y)> Torches = new List<(double, double)>();
        public List<BigCrystal> BigCrystals = new List<BigCrystal>();
        public List<RectD> Solids = new List<RectD>();
        public List<Platform> Platforms = new List<Platform>();
    }

    public static class Baked
    {
        class Rd
        {
            readonly byte[] b; int p;
            public Rd(byte[] gz)
            {
                using (var ms = new MemoryStream(gz)) using (var z = new GZipStream(ms, CompressionMode.Decompress)) using (var o = new MemoryStream()) { z.CopyTo(o); b = o.ToArray(); }
            }
            public int I32() { int v = BitConverter.ToInt32(b, p); p += 4; return v; }
            public double F64() { double v = BitConverter.ToDouble(b, p); p += 8; return v; }
            public string Str() { int n = I32(); string s = Encoding.UTF8.GetString(b, p, n); p += n; return s; }
            public uint[] U32() { int n = I32(); var a = new uint[n]; Buffer.BlockCopy(b, p, a, 0, n * 4); p += n * 4; return a; }
            public byte[] U8() { int n = I32(); var a = new byte[n]; Buffer.BlockCopy(b, p, a, 0, n); p += n; return a; }
            public Img Img() { var m = new Img { W = I32(), H = I32() }; m.Px = U32(); return m; }
        }

        static byte[] Load(string name)
        {
            var t = Resources.Load<TextAsset>("Baked/" + name);
            if (t == null) throw new Exception("找不到匯出資料 Resources/Baked/" + name + ".bytes（先跑 node game/tools/unity-export.mjs）");
            return t.bytes;
        }

        public static LevelData Level(string stage)
        {
            var r = new Rd(Load("level-" + stage));
            if (r.Str() != "ZLV1") throw new Exception("場景資料格式不對");
            var L = new LevelData { Stage = r.Str(), W = r.I32(), H = r.I32(), Floor = r.I32(), Tall = r.I32() != 0, UH = r.I32(), Pin = r.I32() };
            L.PF = r.U32(); L.PFE = r.U8();
            L.Back = r.Img(); L.Far = r.Img(); L.Mid = r.Img(); L.Near = r.Img(); L.Fg = r.Img();
            L.UpFar = r.Img(); L.UpMid = r.Img();
            int n = r.I32(); for (int i = 0; i < n; i++) L.CrystalLights.Add(new LightSrc(r.F64(), r.F64(), r.F64(), r.F64(), null));
            n = r.I32(); for (int i = 0; i < n; i++) { double x = r.F64(), y = r.F64(), rr = r.F64(), lv = r.F64(); L.PropLights.Add(new LightSrc(x, y, rr, lv, r.Str())); }
            n = r.I32(); for (int i = 0; i < n; i++) L.Torches.Add((r.F64(), r.F64()));
            n = r.I32(); for (int i = 0; i < n; i++) L.BigCrystals.Add(new BigCrystal { Col = r.Str(), X = r.F64(), Y = r.F64(), X0 = r.F64(), Y0 = r.F64(), Img = r.Img() });
            n = r.I32(); for (int i = 0; i < n; i++) L.Solids.Add(new RectD { X = r.F64(), Y = r.F64(), W = r.F64(), H = r.F64() });
            n = r.I32(); for (int i = 0; i < n; i++) L.Platforms.Add(new Platform { X = r.F64(), Y = r.F64(), W = r.F64() });
            return L;
        }

        static Dictionary<string, HeroPose> hero;
        /// 主角姿勢：key＝"形態:姿勢名"（陣列的姿勢是 "run#2"）。
        public static Dictionary<string, HeroPose> Hero()
        {
            if (hero != null) return hero;
            var r = new Rd(Load("hero"));
            if (r.Str() != "ZHR1") throw new Exception("主角資料格式不對");
            int n = r.I32();
            hero = new Dictionary<string, HeroPose>(n);
            for (int i = 0; i < n; i++)
            {
                string k = r.Str();
                var q = new HeroPose { W = r.I32(), H = r.I32(), Ax = r.I32(), Ay = r.I32(), CoreX = r.F64(), CoreY = r.F64(), HandX = r.F64(), HandY = r.F64() };
                q.Px = r.U32();
                hero[k] = q;
            }
            return hero;
        }

        static Dictionary<string, Anim> anims;
        public static Dictionary<string, Anim> Anims()
        {
            if (anims != null) return anims;
            var r = new Rd(Load("anims"));
            if (r.Str() != "ZAN1") throw new Exception("動畫資料格式不對");
            int n = r.I32();
            anims = new Dictionary<string, Anim>(n);
            for (int i = 0; i < n; i++)
            {
                var a = new Anim { Name = r.Str(), Fps = r.I32(), Loop = r.I32() != 0, Duration = r.F64() };
                int nf = r.I32();
                a.Frames = new AnimFrame[nf];
                for (int j = 0; j < nf; j++)
                {
                    var f = new AnimFrame { W = r.I32(), H = r.I32(), Lx = r.I32(), Ly = r.I32() };
                    if (f.W == 0) { r.I32(); a.Frames[j] = f; continue; }
                    bool hasLight = r.I32() != 0;
                    f.Color = r.U32();
                    if (hasLight) f.Light = r.U32();
                    a.Frames[j] = f;
                }
                anims[a.Name] = a;
            }
            return anims;
        }
        public static Anim Anim(string name) => Anims()[name];

        public static string Text(string name)
        {
            var t = Resources.Load<TextAsset>("Baked/" + name);
            if (t == null) throw new Exception("找不到 Resources/Baked/" + name);
            return t.text;
        }
    }
}
