// 開發用：把開場動畫（ZeroStar.UI.Intro）某幾秒的畫布存成 PNG（畫布上的字是 UI 疊的，這裡沒有），跟網頁版同一刻比對用。
//   輸出：unity/Golden/intro-unity/intro-<秒>.png（放大 3 倍）
//   執行：Unity.exe -batchmode -nographics -projectPath unity -executeMethod PixelFX.Tests.IntroShots.Run -quit
using System.IO;
using UnityEditor;
using UnityEngine;
using UnityEngine.UIElements;

namespace PixelFX.Tests
{
    public static class IntroShots
    {
        static readonly double[] TIMES = { 2, 5, 7, 10, 13.5, 16, 18, 22, 25, 30, 34, 42, 44 };

        [MenuItem("零星工具/開場動畫截圖")]
        public static void Run()
        {
            string outDir = Path.Combine(Directory.GetParent(Application.dataPath).FullName, "Golden", "intro-unity");
            Directory.CreateDirectory(outDir);
            var intro = new ZeroStar.UI.Intro(new VisualElement());
            foreach (double t in TIMES)
            {
                intro.DrawAt(t);
                var g = intro.Canvas; const int K = 3;
                var tex = new Texture2D(g.W * K, g.H * K, TextureFormat.RGBA32, false);
                var px = new Color32[g.W * K * g.H * K];
                for (int y = 0; y < g.H * K; y++) for (int x = 0; x < g.W * K; x++) { var c = g.Px[(y / K) * g.W + x / K]; c.a = 1; px[(g.H * K - 1 - y) * g.W * K + x] = c; }
                tex.SetPixels32(px); tex.Apply(false);
                File.WriteAllBytes(Path.Combine(outDir, $"intro-{t:00.0}.png"), tex.EncodeToPNG());
                Object.DestroyImmediate(tex);
                Debug.Log($"[IntroShots] t={t} 字：{string.Join(" | ", intro.Texts.ConvertAll(o => o.S))}");
            }
            Debug.Log($"[IntroShots] 寫到 {outDir}");
        }
    }
}
