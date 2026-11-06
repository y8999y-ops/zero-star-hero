// 比對測試（Unity 這一邊）：用跟 game/tools/unity-golden.mjs 一樣的規則，把五個普攻模組一格一格畫出來，
// 存到 unity/Golden/unity/，再用 node game/tools/unity-compare.mjs 跟網頁版逐像素比對。
// 執行（不用開編輯器）：Unity.exe -batchmode -nographics -projectPath unity -executeMethod PixelFX.Tests.Golden.Run -quit
// 也可以在編輯器選單「零星工具／比對測試：輸出普攻特效」。
using System;
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
    }
}
