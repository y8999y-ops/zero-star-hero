// 開發用：碎星鎮天氣截圖（看雨天積水這類天氣特效用）。主角從 START 往右走，在幾個時間點各存一張放大 3 倍的 PNG。
// 執行（不用開編輯器）：Unity.exe -batchmode（要看 shader 的結果就不要加 -nographics） -projectPath <unity> -executeMethod ZeroStar.Tests.WeatherShot.Run -quit
// 環境變數：SHOT_OUT（輸出資料夾，預設 unity/Golden/weather）、SHOT_WEATHER（rain／cloudy／clear，預設 rain）、
//   SHOT_WET（進場時的濕度 0～1）、SHOT_DAY（0.25＝中午、0.75＝半夜，預設 0.3）、SHOT_TICKS（逗號分開的第幾步，預設 60,400,700,900）、SHOT_X（主角起點）、SHOT_WALK（第幾步開始往右走，預設 380）
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
            TownRainHits.DebugLog = true;
            if (Environment.GetEnvironmentVariable("SHOT_FLOWSEED") != null) TownFlow.Seed = int.Parse(Environment.GetEnvironmentVariable("SHOT_FLOWSEED"));
            if (Environment.GetEnvironmentVariable("SHOT_FLOWRANGE") != null) TownFlow.RangeDeg = float.Parse(Environment.GetEnvironmentVariable("SHOT_FLOWRANGE"), inv);
            // 顯示卡模式（預設：有顯示卡就用）：跟遊戲一樣跑 PostFx.shader。SHOT_GPU=0＝強制 CPU 版。要顯示卡就不能加 -nographics
            bool gpu = Env("SHOT_GPU", "1") != "0" && PostFx.Supported && PostFx.Enabled;

            Debug.Log($"[WeatherShot] {(gpu ? "顯示卡（PostFx shader）" : "CPU")} 模式，{SystemInfo.graphicsDeviceType}");
            var g = new Game("town");
            TownArt.NowMs = () => 1767225600000.0 + g.SimMs;
            TraceScript.Apply(g, TraceScript.DefaultPath());
            var frame = new Frame(Game.W, Game.H){UseGpuWeather=gpu,SoftLight=true};
            var rgba = new byte[Game.W * Game.H * 4];
            g.StartStage();
            g.Warm(frame);
            TownArt.DayOverride = double.Parse(Env("SHOT_DAY", "0.3"), inv);
            TownArt.WeatherOverride = Env("SHOT_WEATHER", "rain");
            TownPuddles.Reset();   // 進場時就在下雨：積水直接照現在的雨量設好
            var sw = Environment.GetEnvironmentVariable("SHOT_WET");   // 指定進場時的濕度（看慢慢變濕的過程）
            TownPuddles.WetStart = sw == null ? (double?)null : double.Parse(sw, inv);
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
                if (gpu && Array.IndexOf(at, n) >= 0) PostFx.RenderInto(rgba, frame);
                if (Array.IndexOf(at, n) >= 0) Save(rgba, Path.Combine(outDir, $"shot-{n:0000}.png"));
            }
            if (Environment.GetEnvironmentVariable("SHOT_FLOW") != null) FlowMap(outDir);
            {   // 濕的分數圖
                var sc = TownRainHits.DebugScore(out int sw2, out int sh2, out int[] top);
                var tex = new Texture2D(sw2, sh2, TextureFormat.RGBA32, false); var px = new Color32[sw2 * sh2];
                for (int y = 0; y < sh2; y++) for (int x = 0; x < sw2; x++) { byte v = sc[y * sw2 + x]; px[(sh2 - 1 - y) * sw2 + x] = top[x] == y ? new Color32(255, 0, 0, 255) : new Color32(v, v, v, 255); }
                tex.SetPixels32(px); tex.Apply(); File.WriteAllBytes(Path.Combine(outDir, "score.png"), tex.EncodeToPNG()); UnityEngine.Object.DestroyImmediate(tex);
                Debug.Log($"[WeatherShot] 鏡頭 {frame.Ox},{frame.Oy}");
            }
            Debug.Log($"[WeatherShot] {string.Join(",", at)} → {outDir}");
        }
        /// 水路圖：建築（調暗）上畫水路。青＝水路、綠＝起點、紅＝滴下去、黃＝流進地面、白＝併進別條、紫＝停住。上下兩半各放大 2 倍
        static void FlowMap(string outDir)
        {
            var main = TownArtMain();
            int W = TownArt.TOWN_W, H = TownArt.H, S = 2, half = W / 2;
            var img = new Color32[W * H];
            for (int i = 0; i < img.Length; i++) { uint c = main[i]; img[i] = c == 0 ? new Color32(22, 20, 34, 255) : new Color32((byte)((c & 255) * 0.45), (byte)(((c >> 8) & 255) * 0.45), (byte)(((c >> 16) & 255) * 0.45), 255); }
            void P(int x, int y, Color32 c) { if (x >= 0 && x < W && y >= 0 && y < H) img[y * W + x] = c; }
            // 結構圖淡淡疊上去（屋頂藍、擋雨灰、繞開橘、導水黃）
            if (TownStructure.Cls != null)
                for (int i = 0; i < img.Length; i++)
                {
                    byte k = TownStructure.Cls[i]; if (k == 0) continue;
                    var tc = k == TownStructure.ROOF ? new Color32(70, 140, 255, 255) : k == TownStructure.SHELTER ? new Color32(110, 110, 120, 255) : k == TownStructure.AVOID ? new Color32(255, 150, 40, 255) : k == TownStructure.GUIDE ? new Color32(255, 230, 40, 255) : k == TownStructure.LAND ? new Color32(40, 230, 120, 255) : new Color32(255, 40, 40, 255);
                    var o = img[i]; img[i] = new Color32((byte)((o.r + tc.r) / 3), (byte)((o.g + tc.g) / 3), (byte)((o.b + tc.b) / 3), 255);
                }
            foreach (var p in TownFlow.Paths)
            {
                foreach (var q in p.Px) P(q.x, q.y, new Color32(90, 230, 255, 255));
                if (p.Px.Count == 0) continue;
                P(p.Px[0].x, p.Px[0].y, new Color32(80, 255, 90, 255));
                var e = p.Px[p.Px.Count - 1];
                var ec = p.End == TownFlow.End.Drip ? new Color32(255, 60, 60, 255) : p.End == TownFlow.End.Ground ? new Color32(255, 230, 40, 255) : p.End == TownFlow.End.Merge ? new Color32(255, 255, 255, 255) : new Color32(230, 80, 255, 255);
                for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) if (dx == 0 || dy == 0) P(e.x + dx, e.y + dy, ec);
            }
            {   // 原始建築圖層（除錯）
                var mt = new Texture2D(W, H, TextureFormat.RGBA32, false); var mp = new Color32[W * H];
                for (int y = 0; y < H; y++) for (int x = 0; x < W; x++) { uint c = main[y * W + x]; mp[(H - 1 - y) * W + x] = new Color32((byte)(c & 255), (byte)((c >> 8) & 255), (byte)((c >> 16) & 255), (byte)(c >> 24)); }
                mt.SetPixels32(mp); mt.Apply(); File.WriteAllBytes(Path.Combine(outDir, "main.png"), mt.EncodeToPNG()); UnityEngine.Object.DestroyImmediate(mt);
            }
            // 滴水：從滴的地方（紅）一路虛線往下，落點（綠＝打在東西上，黃＝地上）
            foreach (var d in TownFlow.Drips)
            {
                for (int y = d.y0; y < d.y1; y += 3) P(d.x, y, new Color32(255, 120, 120, 255));
                P(d.x, d.y0 - 1, new Color32(255, 40, 40, 255));
                var lc = d.ground ? new Color32(255, 230, 40, 255) : new Color32(60, 255, 120, 255);
                P(d.x - 1, d.y1 - 1, lc); P(d.x, d.y1 - 1, lc); P(d.x + 1, d.y1 - 1, lc);
            }
            int OW = half * S, OH = H * S * 2;
            var tex = new Texture2D(OW, OH, TextureFormat.RGBA32, false); var px = new Color32[OW * OH];
            for (int oy = 0; oy < OH; oy++) for (int ox = 0; ox < OW; ox++)
            {
                int part = oy / (H * S), y = (oy % (H * S)) / S, x = ox / S + part * half;
                px[(OH - 1 - oy) * OW + ox] = x < W ? img[y * W + x] : new Color32(0, 0, 0, 255);
            }
            tex.SetPixels32(px); tex.Apply(); File.WriteAllBytes(Path.Combine(outDir, "flow.png"), tex.EncodeToPNG()); UnityEngine.Object.DestroyImmediate(tex);
            Debug.Log($"[WeatherShot] 水路 {TownFlow.Paths.Count} 條：滴下去 {TownFlow.Paths.Count(p => p.End == TownFlow.End.Drip)}、流進地面 {TownFlow.Paths.Count(p => p.End == TownFlow.End.Ground)}、併過去 {TownFlow.Paths.Count(p => p.End == TownFlow.End.Merge)}、停住 {TownFlow.Paths.Count(p => p.End == TownFlow.End.Stop)}");
        }
        static uint[] TownArtMain() => (uint[])typeof(TownArt).GetField("MAIN", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static).GetValue(null);
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
