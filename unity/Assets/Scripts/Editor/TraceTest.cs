// 比對測試（Unity 這一邊）：操作錄影。用 game/tools/unity-trace-script.json 的同一串按鍵跑 Game，
// 每一步記下主角、怪、鏡頭的數值，每 frameEvery 步存一張合成好的畫面，寫到 unity/Golden/unity/。
// 再用 node game/tools/unity-trace-compare.mjs 跟網頁版（node game/tools/unity-trace.mjs）逐步比對。
// 執行（不用開編輯器）：Unity.exe -batchmode -nographics -projectPath unity -executeMethod ZeroStar.Tests.TraceTest.Run -quit
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using UnityEditor;
using UnityEngine;
using PixelFX;

namespace ZeroStar.Tests
{
    public static class TraceTest
    {
        static string F(double v) => v.ToString("G17", CultureInfo.InvariantCulture);

        [MenuItem("零星工具/比對測試：操作錄影")]
        public static void Run()
        {
            var watch = System.Diagnostics.Stopwatch.StartNew();
            var sc = TraceScript.Load(TraceScript.DefaultPath());
            Rnd.R = new Rng(12345);
            Prof.On = true; Prof.Ms.Clear();
            Game.W = 384;
            var g = new Game();
            var frame = new Frame(Game.W, Game.H);
            var rgba = new byte[Game.W * Game.H * 4];
            var sb = new StringBuilder();
            var frames = new MemoryStream();
            int si = 0;
            for (int n = 0; n < sc.ticks; n++)
            {
                while (si < sc.events.Count && sc.events[si].t == n) { var e = sc.events[si++]; if (e.type == "d") g.Input.KeyDown(e.code); else g.Input.KeyUp(e.code); }
                Prof.Mark(null);
                g.Tick(Game.STEP);
                Prof.Mark("邏輯");
                g.SimMs += 1000 / 60.0;
                frame.Clear();
                g.Render(frame);
                Prof.Mark(null);
                frame.Composite(rgba, null, 0.8);
                Prof.Mark("合成");
                var p = g.Player;
                var row = new List<string> { n.ToString(), F(p.X), F(p.Y), F(p.Vx), F(p.Vy), p.State, F(p.Hp), F(p.Face), p.Grounded ? "1" : "0", p.Pose, F(g.CamX), F(g.CamY), F(g.Fx.Freeze), F(g.Fx.ShakeT), g.Enemies.Count.ToString() };
                foreach (var e in g.Enemies) { row.Add(F(e.X)); row.Add(F(e.Y)); row.Add(F(e.Vx)); row.Add(F(e.Vy)); row.Add(F(e.Hp)); row.Add(e.Awake ? "1" : "0"); }
                sb.Append(string.Join(" ", row)).Append('\n');
                if (n % sc.frameEvery == 0) frames.Write(rgba, 0, rgba.Length);
            }
            string outDir = Path.Combine(Directory.GetParent(Application.dataPath).FullName, "Golden", "unity");
            Directory.CreateDirectory(outDir);
            File.WriteAllText(Path.Combine(outDir, "trace.txt"), sb.ToString());
            File.WriteAllBytes(Path.Combine(outDir, "trace-frames.bin"), frames.ToArray());
            var prof = new StringBuilder();
            foreach (var kv in Prof.Ms) prof.Append($"{kv.Key} {kv.Value / sc.ticks:F2}　");
            Prof.On = false;
            Debug.Log("[Trace] 每步平均（毫秒）：" + prof);
            Debug.Log($"[Trace] {sc.ticks} 步 → {outDir}（{watch.ElapsedMilliseconds} ms，平均每步含畫面 {watch.ElapsedMilliseconds / (double)sc.ticks:F2} ms）");
        }
    }
}
