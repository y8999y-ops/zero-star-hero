// 開發用：碎星鎮天氣截圖（看雨天積水這類天氣特效用）。主角從 START 往右走，在幾個時間點各存一張放大 3 倍的 PNG。
// 執行（不用開編輯器）：Unity.exe -batchmode -nographics -projectPath <unity> -executeMethod ZeroStar.Tests.WeatherShot.Run -quit
// 環境變數：SHOT_OUT（輸出資料夾，預設 unity/Golden/weather）、SHOT_WEATHER（rain／cloudy／clear，預設 rain）、
//   SHOT_DAY（0.25＝中午、0.75＝半夜，預設 0.3）、SHOT_TICKS（逗號分開的第幾步，預設 60,400,700,900）、SHOT_X（主角起點）、SHOT_WALK（第幾步開始往右走，預設 380）
using System;
using System.Globalization;
using System.IO;
using System.Linq;
using UnityEngine;
using PixelFX;

namespace ZeroStar.Tests
{
    public static class WeatherShot
    {
        static string Env(string k, string d) => Environment.GetEnvironmentVariable(k) ?? d;
        public static void Run()
        {
            var inv = CultureInfo.InvariantCulture;
            string outDir = Env("SHOT_OUT", Path.Combine(Directory.GetParent(Application.dataPath).FullName, "Golden", "weather"));
            Directory.CreateDirectory(outDir);
            int[] at = Env("SHOT_TICKS", "60,400,700,900").Split(',').Select(int.Parse).ToArray();
            int walk = int.Parse(Env("SHOT_WALK", "380"));
            Rnd.R = new Rng(12345);
            Game.W = 384;
            TownArt.DayOverride = null; TownArt.WeatherOverride = null;
            var g = new Game("town");
            TownArt.NowMs = () => 1767225600000.0 + g.SimMs;
            TraceScript.Apply(g, TraceScript.DefaultPath());
            var frame = new Frame(Game.W, Game.H);
            var rgba = new byte[Game.W * Game.H * 4];
            g.StartStage();
            g.Warm(frame);
            TownArt.DayOverride = double.Parse(Env("SHOT_DAY", "0.3"), inv);
            TownArt.WeatherOverride = Env("SHOT_WEATHER", "rain");
            TownPuddles.Reset();   // 進場時就在下雨：積水直接照現在的雨量設好
            var sx = Environment.GetEnvironmentVariable("SHOT_X");
            if (sx != null) g.Player.X = double.Parse(sx, inv);
            int last = at.Max();
            for (int n = 0; n <= last; n++)
            {
                if (n == walk) g.Input.KeyDown("ArrowRight");
                g.RunTimers();
                frame.Clear();
                g.Step(frame);
                g.SimMs += 1000 / 60.0;
                frame.Composite(rgba, null, 0.8);
                g.PostComposite(rgba);
                if (Array.IndexOf(at, n) >= 0) Save(rgba, Path.Combine(outDir, $"shot-{n:0000}.png"));
            }
            Debug.Log($"[WeatherShot] {string.Join(",", at)} → {outDir}");
        }
        static void Save(byte[] rgba, string path)
        {
            const int S = 3; int W = Game.W, H = Game.H;
            var tex = new Texture2D(W * S, H * S, TextureFormat.RGBA32, false);
            var px = new Color32[W * S * H * S];
            for (int y = 0; y < H; y++) for (int x = 0; x < W; x++)
            {
                int i = (y * W + x) * 4; var c = new Color32(rgba[i], rgba[i + 1], rgba[i + 2], 255);
                for (int dy = 0; dy < S; dy++) for (int dx = 0; dx < S; dx++) px[((H - 1 - y) * S + (S - 1 - dy)) * W * S + x * S + dx] = c;
            }
            tex.SetPixels32(px); tex.Apply();
            File.WriteAllBytes(path, tex.EncodeToPNG());
            UnityEngine.Object.DestroyImmediate(tex);
        }
    }
}
