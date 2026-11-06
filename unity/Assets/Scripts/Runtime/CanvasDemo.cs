// 階段 0 的示範：像素畫布上輪流播五個形態的普攻連段（星星→黏液星→蝠翼星→鐵罐星→尖刺星），
// 中間站一顆臨時的星星（真正的主角在階段 1 才搬）。
// 命令列 -shot <資料夾>：在幾個時間點截圖後自動關閉（給自動測試用）。
using System;
using System.Collections.Generic;
using UnityEngine;
using PixelFX;
using PixelFX.Fx;

namespace ZeroStar
{
    public class CanvasDemo : MonoBehaviour
    {
        PixelScreen screen;
        readonly List<(string form, FxModule fx)> seq = new List<(string, FxModule)>();
        int idx;
        double t, clock;
        static readonly Dictionary<string, string> BODY = new Dictionary<string, string>
        {
            ["star"] = "#f0b42e", ["slime"] = "#4cc04a", ["bat"] = "#8058b8", ["can"] = "#6e7a90", ["spike"] = "#e09a3a",
        };
        string shotDir; int shotNo; readonly double[] shotAt = { 0.10, 1.15, 2.20, 3.42, 5.05, 6.30 };

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void Boot()
        {
            if (FindAnyObjectByType<CanvasDemo>() != null) return;
            var go = new GameObject("CanvasDemo");
            go.AddComponent<PixelScreen>();
            go.AddComponent<CanvasDemo>();
        }

        void Start()
        {
            screen = GetComponent<PixelScreen>();
            foreach (var g in new[] { "star", "slime", "bat", "can", "spike" })
                foreach (var fx in Attacks.Group(g)) seq.Add((g, fx));
            screen.Tick += OnTick;
            screen.Draw += OnDraw;
            var args = Environment.GetCommandLineArgs();
            for (int i = 0; i < args.Length - 1; i++) if (args[i] == "-shot") shotDir = args[i + 1];
        }

        void OnTick(double dt)
        {
            clock += dt; t += dt;
            var m = seq[idx].fx.Meta;
            if (t > m.Duration + 0.12) { t = 0; idx = (idx + 1) % seq.Count; }
            if (shotDir != null && shotNo < shotAt.Length && clock >= shotAt[shotNo])
            {
                ScreenCapture.CaptureScreenshot(System.IO.Path.Combine(shotDir, $"canvas-{shotNo}.png"));
                shotNo++;
            }
            if (shotDir != null && shotNo >= shotAt.Length && clock > shotAt[shotAt.Length - 1] + 0.3) Application.Quit();
        }

        void OnDraw(Painter p)
        {
            // 背景：夜空色階＋地面
            uint[] sky = Col.Ramp(new[] { "#15164d", "#1c1b65", "#221f70" });
            for (int y = 0; y < PixelScreen.H; y++)
                for (int x = 0; x < PixelScreen.W; x++)
                    p.Px(x, y, y < 60 ? sky[0] : y < 140 ? sky[1] : sky[2]);
            const int GROUND = 170;
            for (int y = GROUND; y < PixelScreen.H; y++) for (int x = 0; x < PixelScreen.W; x++) p.Px(x, y, y == GROUND ? Col.Hex("#3a4b8c") : Col.Hex("#141a46"));

            var (form, fx) = seq[idx];
            double X = 150, Y = GROUND;
            // 臨時的星星身體：五角星（暗邊、亮心）
            p.Place(X, Y);
            uint body = Col.Hex(BODY[form]);
            var pts = new double[10][];
            for (int i = 0; i < 10; i++)
            {
                double a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 == 0 ? 10 : 4.5;
                pts[i] = new[] { Math.Cos(a) * r, -11 + Math.Sin(a) * r };
            }
            p.Poly(pts, body);
            p.Dot(-2, -13, Col.WHITE); p.Dot(2, -13, Col.WHITE);
            // 普攻特效：原點放在星星腳底，面向右
            p.Place(X, Y);
            fx.Draw(p, Math.Min(t, fx.Meta.Duration), fx.Meta.Palette);
        }
    }
}
