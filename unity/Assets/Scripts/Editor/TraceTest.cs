// 比對測試（Unity 這一邊）：操作錄影。用 game/tools/unity-trace-script.json 的同一串按鍵跑 Game，
// 每一步記下主角、怪、鏡頭的數值，每 frameEvery 步存一張合成好的畫面，寫到 unity/Golden/unity/。
// 再用 node game/tools/unity-trace-compare.mjs 跟網頁版（node game/tools/unity-trace-full.mjs，跑真正的 main.js）逐步比對。
// 執行（不用開編輯器）：Unity.exe -batchmode -nographics -projectPath unity -executeMethod ZeroStar.Tests.TraceTest.Run -quit
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using UnityEditor;
using System.Linq;
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
            string ultOnly = Environment.GetEnvironmentVariable("ULT_PROF"); int profN = 0; double maxMs = 0; int maxAt = 0;
            Game.W = 384; Game.LegacySpawns = true;   // 無限討伐照網頁版的怪
            string variant = Environment.GetEnvironmentVariable("TRACE_VARIANT") ?? "";
            TownArt.DayOverride = null; TownArt.WeatherOverride = null;
            var g = new Game(sc.stage);
            TownArt.NowMs = () => 1767225600000.0 + g.SimMs;   // 城鎮的日夜、天氣：固定的日期＋遊戲時間（跟網頁版的比對工具一樣）
            TraceScript.Apply(g, TraceScript.DefaultPath(), variant);   // 穿搭、技能樹、帶著的形態、打過的關卡（跟網頁版的存檔一樣）
            var frame = new Frame(Game.W, Game.H);
            var rgba = new byte[Game.W * Game.H * 4];
            g.StartStage();
            g.Warm(frame);
            {   // 城鎮的白天晚上、天氣：腳本可以固定（網頁版也是載入完才設）
                var r = (OrderedDict)MiniJson.Parse(File.ReadAllText(TraceScript.DefaultPath()));
                if (r.ContainsKey("day")) TownArt.DayOverride = (double)r["day"];
                if (r.ContainsKey("weather")) TownArt.WeatherOverride = (string)r["weather"];
            }
            var sb = new StringBuilder();
            var frames = new MemoryStream();
            int si = 0;
            for (int n = 0; n < sc.ticks; n++)
            {
              try {
                while (si < sc.events.Count && sc.events[si].t == n) { var e = sc.events[si++]; if (e.type == "f") g.SwitchForm(e.code); else if (e.type == "m") g.Player.Mp = g.Player.MaxMp; else if (e.type == "h") g.Player.Hp = int.Parse(e.code); else if (e.type == "x") g.GainXp(int.Parse(e.code)); else if (e.type == "i") g.DropItem(g.Player.X + 40 * g.Player.Face, g.Player.Y - 12, int.Parse(e.code)); else if (e.type == "d") g.Input.KeyDown(e.code); else g.Input.KeyUp(e.code); }
                var stepWatch = System.Diagnostics.Stopwatch.StartNew();
                bool one = Environment.GetEnvironmentVariable("PROF_TICK") == n.ToString();
                Dictionary<string, double> saved = null;
                if (one) { saved = new Dictionary<string, double>(Prof.Ms); Prof.Ms.Clear(); }
                var rng = Environment.GetEnvironmentVariable("PROF_RANGE");   // 例如 700-870：只量這幾步
                Prof.On = rng != null ? n >= int.Parse(rng.Split('-')[0]) && n <= int.Parse(rng.Split('-')[1]) : g.Ult.On || ultOnly == null;   // ULT_PROF=1：只量大招期間
                PixelFX.PfProf.On = Prof.On && rng != null;
                Prof.Mark(null);
                g.RunTimers();
                frame.Clear();
                var fr = frame;
                FxSystem.Probe = Environment.GetEnvironmentVariable("DUMP_TICK") == n.ToString() ? (Action<string>)(k => Debug.Log("PROBE " + k + " " + fr.Color[145 * 384 + 144].ToString("x"))) : null;
                g.Step(frame);
                g.SimMs += 1000 / 60.0;
                Prof.Mark(null);
                frame.Composite(rgba, null, 0.8);
                g.PostComposite(rgba);
                Prof.Mark("黑白定格");
                if (Prof.On) profN++;
                double stepMs = stepWatch.Elapsed.TotalMilliseconds;
                if (one)
                {
                    var sb1 = new StringBuilder(); foreach (var kv in Prof.Ms) sb1.Append($"{kv.Key} {kv.Value:F2}　");
                    Debug.Log($"[Trace] 第 {n} 步（{stepMs:F1} ms）：" + sb1);
                    foreach (var kv in saved) { Prof.Ms.TryGetValue(kv.Key, out var v); Prof.Ms[kv.Key] = kv.Value + v; }
                }
                if (n > 30 && stepMs > maxMs) { maxMs = stepMs; maxAt = n; }
                Prof.Mark("合成");
                var p = g.Player;
                var row = new List<string> { n.ToString(), F(p.X), F(p.Y), F(p.Vx), F(p.Vy), p.State, F(p.Hp), F(p.Face), p.Grounded ? "1" : "0", p.Pose, F(g.CamX), F(g.CamY), F(g.Fx.Freeze), F(g.Fx.ShakeT), p.Form, F(p.Mp), g.Combo.ToString(), g.Ult.On ? "U" + F(g.Ult.T) : "-", (g.Director?.Next ?? -1).ToString() + (g.StageDone ? "d" : "") + (g.Leaving ? "l" : ""), g.Enemies.Count.ToString() };
                foreach (var e in g.Enemies)
                {
                    row.Add(e.Kind[0] + (e.Elite ? "E" : ""));
                    row.Add(F(e.X)); row.Add(F(e.Y)); row.Add(F(e.Vx)); row.Add(F(e.Vy)); row.Add(F(e.Hp)); row.Add(e.Awake ? "1" : "0");
                    var S = e.St; string st = S == null ? "" : (S.Burn > 0 ? "b" : "") + (S.Slime > 0 ? "s" : "") + (S.Shock > 0 ? "s" : "") + (S.Poison > 0 ? "p" : "") + (S.Stuck > 0 ? "s" : "");
                    row.Add(st == "" ? "-" : st);
                }
                sb.Append(string.Join(" ", row)).Append('\n');
                if (n % sc.frameEvery == 0) frames.Write(rgba, 0, rgba.Length);
                if (Environment.GetEnvironmentVariable("DUMP_TICK") == n.ToString())
                {
                    var raw = new byte[frame.Color.Length * 8];
                    Buffer.BlockCopy(frame.Color, 0, raw, 0, frame.Color.Length * 4); Buffer.BlockCopy(frame.Light, 0, raw, frame.Color.Length * 4, frame.Light.Length * 4);
                    Directory.CreateDirectory(Path.Combine(Directory.GetParent(Application.dataPath).FullName, "Golden", "unity"));
                    File.WriteAllBytes(Path.Combine(Directory.GetParent(Application.dataPath).FullName, "Golden", "unity", "dump.bin"), raw);
                }
              } catch (Exception ex) { Debug.LogError($"[Trace] 第 {n} 步出錯，先存到這裡：{ex}"); break; }
            }
            string outDir = Path.Combine(Directory.GetParent(Application.dataPath).FullName, "Golden", "unity");
            Directory.CreateDirectory(outDir);
            string tag = System.Text.RegularExpressions.Regex.Replace(Path.GetFileNameWithoutExtension(TraceScript.DefaultPath()), "^unity-trace-script", "");   // unity-trace-script-full.json → 「-full」
            string suf = tag + (variant != "" ? "-" + variant : "");
            File.WriteAllText(Path.Combine(outDir, $"trace{suf}.txt"), sb.ToString());
            File.WriteAllBytes(Path.Combine(outDir, $"trace-frames{suf}.bin"), frames.ToArray());
            var prof = new StringBuilder();
            foreach (var kv in Prof.Ms) prof.Append($"{kv.Key} {kv.Value / Math.Max(1, profN):F2}　");
            prof.Append($"（{profN} 步）最慢一步 {maxMs:F1} ms（第 {maxAt} 步）");
            Prof.On = false;
            Debug.Log("[Trace] 每步平均（毫秒）：" + prof);
            var al = new StringBuilder(); double tot = 0;
            foreach (var kv in Prof.Bytes.OrderByDescending(k => k.Value)) { tot += kv.Value; if (kv.Value > 0) al.Append($"{kv.Key} {kv.Value / Math.Max(1, profN):F0}　"); }
            Debug.Log($"[Alloc] 每步產生的暫存資料（位元組）共 {tot / Math.Max(1, profN):F0}：" + al); Prof.Bytes.Clear();
            var pp = new StringBuilder(); foreach (var kv in PixelFX.PfProf.Ms) pp.Append($"{kv.Key} {kv.Value / Math.Max(1, profN):F2}　");
            Debug.Log("[Trace] 畫筆：" + pp); PixelFX.PfProf.Ms.Clear(); PixelFX.PfProf.On = false;
            Debug.Log($"[Trace] {sc.ticks} 步 → {outDir}（{watch.ElapsedMilliseconds} ms，平均每步含畫面 {watch.ElapsedMilliseconds / (double)sc.ticks:F2} ms）");
        }
    }
}
