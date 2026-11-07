// 比對測試（Unity 這一邊）：用跟 game/tools/unity-golden.mjs 一樣的規則，把五個普攻模組一格一格畫出來，
// 存到 unity/Golden/unity/，再用 node game/tools/unity-compare.mjs 跟網頁版逐像素比對。
// 執行（不用開編輯器）：Unity.exe -batchmode -nographics -projectPath unity -executeMethod PixelFX.Tests.Golden.Run -quit
// 也可以在編輯器選單「零星工具／比對測試：輸出普攻特效」。
// RunFx：pixelfx 即時特效（FxRun）照 game/tools/unity-fx-golden.mjs 的 manifest.json 播一次，存到 unity/Golden/fx-unity/，
//   再用 node game/tools/unity-fx-compare.mjs 跟 unity/Golden/fx-web/ 逐像素比對。
//   執行：Unity.exe -batchmode -nographics -projectPath unity -executeMethod PixelFX.Tests.Golden.RunFx -quit
using System;
using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEngine;
using PixelFX.Fx;

namespace PixelFX.Tests
{
    public static class Golden
    {
        static readonly string[] GROUPS = { "star", "slime", "bat", "can", "spike" };

        [MenuItem("零星工具/比對測試：輸出普攻特效")]
        public static void Run()
        {
            string outDir = Path.Combine(Directory.GetParent(Application.dataPath).FullName, "Golden", "unity");
            Directory.CreateDirectory(outDir);
            int files = 0;
            var watch = System.Diagnostics.Stopwatch.StartNew();
            foreach (string g in GROUPS)
            {
                var steps = Attacks.Group(g);
                for (int si = 0; si < steps.Length; si++)
                {
                    var m = steps[si].Meta; int n = m.FrameCount, wh = m.W * m.H;
                    foreach (bool flip in new[] { false, true })
                    {
                        var f = new Frame(m.W, m.H);
                        var p = new Painter(f);
                        var bytes = new byte[n * wh * 2 * 4];
                        for (int i = 0; i < n; i++)
                        {
                            f.Clear();
                            p.Reset().Place(flip ? m.W - m.OX : m.OX, m.OY, flip, 0);
                            steps[si].Draw(p, i / (double)m.Fps, m.Palette);
                            Buffer.BlockCopy(f.Color, 0, bytes, i * wh * 8, wh * 4);
                            Buffer.BlockCopy(f.Light, 0, bytes, i * wh * 8 + wh * 4, wh * 4);
                        }
                        File.WriteAllBytes(Path.Combine(outDir, $"{g}-{si}-{(flip ? 1 : 0)}.bin"), bytes);
                        files++;
                    }
                }
            }
            Debug.Log($"[Golden] 寫出 {files} 個比對檔到 {outDir}（{watch.ElapsedMilliseconds} ms）");
        }

        // manifest 的選項（JSON）換成 FxOptions：palette／accent／light／angle／seed 有自己的欄位，
        // 其他的照型別放：數字和真假值 → Num（真＝1、假＝0）、字串 → Str、色階陣列 → Ramps
        static FxOptions OptsOf(Dictionary<string, object> js)
        {
            var o = new FxOptions();
            foreach (var kv in js)
            {
                object v = kv.Value;
                string[] Arr() { var l = (List<object>)v; var a = new string[l.Count]; for (int i = 0; i < a.Length; i++) a[i] = (string)l[i]; return a; }
                switch (kv.Key)
                {
                    case "palette": o.Palette = Arr(); continue;
                    case "accent": o.Accent = Arr(); continue;
                    case "light": o.Light = (double)v; continue;
                    case "angle": o.Angle = (double)v; continue;
                    case "seed": o.Seed = (int)(double)v; continue;
                }
                if (v is double d) o.Num[kv.Key] = d;
                else if (v is bool b) o.Num[kv.Key] = b ? 1 : 0;
                else if (v is string str) o.Str[kv.Key] = str;
                else if (v is List<object>) o.Ramps[kv.Key] = Arr();
            }
            return o;
        }

        [MenuItem("零星工具/比對測試：輸出即時特效")]
        public static void RunFx()
        {
            string root = Directory.GetParent(Application.dataPath).FullName;
            string web = Path.Combine(root, "Golden", "fx-web"), outDir = Path.Combine(root, "Golden", "fx-unity");
            Directory.CreateDirectory(outDir);
            var manifest = (List<object>)ZeroStar.MiniJson.Parse(File.ReadAllText(Path.Combine(web, "manifest.json")));
            int files = 0, frames = 0;
            var watch = System.Diagnostics.Stopwatch.StartNew();
            foreach (Dictionary<string, object> c in manifest)
            {
                var def = ZeroStar.FxSystem.Def((string)c["fx"]);
                int W = def.W, H = def.H, wh = W * H, steps = (int)(double)c["steps"], stopAt = (int)(double)c["stopAt"];
                double speed = (double)c["speed"];
                foreach (bool flip in new[] { false, true })
                {
                    var o = OptsOf((Dictionary<string, object>)c["opts"]);
                    o.X = flip ? W - def.OX : def.OX; o.Y = def.OY; o.Flip = flip;
                    var fx = new FxRun(def, o);
                    var list = new List<byte[]>();
                    for (int i = 0; steps > 0 ? i < steps : i < 1200; i++)
                    {
                        fx.Update((1 / 60.0) * speed);
                        if (i == stopAt) fx.Stop();
                        var f = new Frame(W, H);
                        f.Clear();
                        fx.Draw(f);
                        var light = f.Light;
                        var b = new byte[wh * 8];
                        Buffer.BlockCopy(f.Color, 0, b, 0, wh * 4);
                        Buffer.BlockCopy(light, 0, b, wh * 4, wh * 4);
                        list.Add(b);
                        if (steps == 0 && fx.Done()) break;
                    }
                    var all = new byte[list.Count * wh * 8];
                    for (int i = 0; i < list.Count; i++) Buffer.BlockCopy(list[i], 0, all, i * wh * 8, wh * 8);
                    File.WriteAllBytes(Path.Combine(outDir, $"{c["name"]}-{(flip ? 1 : 0)}.bin"), all);
                    files++; frames += list.Count;
                }
            }
            Debug.Log($"[Golden] 即時特效：寫出 {files} 個比對檔（{frames} 格）到 {outDir}（{watch.ElapsedMilliseconds} ms）");
        }

        // RunOrbit：背包左欄主角圖（ZeroStar.UI.HeroOrbit.DrawHero）照 game/tools/unity-orbit-golden.mjs 的 manifest.json 畫一次，
        //   composite（背景 null、光 0.6）存到 unity/Golden/orbit-unity/，再用 node game/tools/unity-orbit-golden.mjs --compare 比對。
        //   執行：Unity.exe -batchmode -nographics -projectPath unity -executeMethod PixelFX.Tests.Golden.RunOrbit -quit
        [MenuItem("零星工具/比對測試：輸出背包主角圖")]
        public static void RunOrbit()
        {
            string root = Directory.GetParent(Application.dataPath).FullName;
            string web = Path.Combine(root, "Golden", "orbit-web"), outDir = Path.Combine(root, "Golden", "orbit-unity");
            Directory.CreateDirectory(outDir);
            var manifest = (List<object>)ZeroStar.MiniJson.Parse(File.ReadAllText(Path.Combine(web, "manifest.json")));
            var of = new Frame(ZeroStar.UI.HeroOrbit.OW, ZeroStar.UI.HeroOrbit.OH); var sf = new Frame(ZeroStar.UI.HeroOrbit.SW, ZeroStar.UI.HeroOrbit.SH);
            int files = 0;
            foreach (Dictionary<string, object> c in manifest)
            {
                var sl = (List<object>)c["slots"]; var cols = new string[7];
                for (int i = 0; i < 7; i++) cols[i] = sl[i] as string;
                var aura = new List<(string id, int n)>();
                foreach (Dictionary<string, object> a in (List<object>)c["aura"]) aura.Add(((string)a["id"], (int)(double)a["n"]));
                ZeroStar.UI.HeroOrbit.DrawHero(of, sf, (double)c["t"], (double)c["spin"], cols, aura, (string)c["form"]);
                File.WriteAllBytes(Path.Combine(outDir, (string)c["name"] + ".bin"), of.Composite(null, null, 0.6));
                files++;
            }
            Debug.Log($"[Golden] 背包主角圖：寫出 {files} 個比對檔到 {outDir}");
        }
    }
}
