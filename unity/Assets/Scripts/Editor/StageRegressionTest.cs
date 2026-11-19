using System;
using System.IO;
using UnityEditor;
using UnityEngine;
using PixelFX;

namespace ZeroStar.Tests
{
    public static class StageRegressionTest
    {
        [MenuItem("ZeroStar/Tests/Stage return and render")]
        public static void Run()
        {
            var rng = Rnd.R;
            int width = Game.W, dy = Game.VIEW_DY;
            double zoom = Game.Zoom;
            try
            {
                Rnd.R = new Rng(12345);
                Game.W = 384;
                string output = Path.GetFullPath(Path.Combine(Application.dataPath, "../build/outputs/audit"));
                Directory.CreateDirectory(output);
                var source = new Game("1-2");
                source.StartStage();
                source.GuildRegistered = true;
                source.GuildDone = 1;
                source.Clear();
                bool left = false;
                source.Player.X = source.PortalX.Value;
                source.Player.Y = source.PortalY;
                source.Player.Grounded = true;
                source.OnLeave = () => left = true;
                source.Input.KeyDown("KeyF");
                source.Tick(Game.STEP);
                if (!left || !source.Leaving) throw new Exception("1-2 portal interaction failed");
                // 不畫畫面也必須結束切換冷卻；單純重畫不得讓冷卻提早結束。
                var clockGame = new Game("town");
                clockGame.StartStage();
                clockGame.FormsOwned["slime"] = 0;
                clockGame.SwitchForm("slime");
                var clockFrame = new Frame(Game.W, Game.H);
                for (int i = 0; i < 90; i++) { clockFrame.Clear(); clockGame.Render(clockFrame); }
                clockGame.SwitchForm("star");
                if (clockGame.Player.Form != "slime") throw new Exception("Rendering advanced form cooldown");
                for (int i = 0; i < 120; i++) clockGame.Tick(Game.STEP);
                clockGame.SwitchForm("star");
                if (clockGame.Player.Form != "star") throw new Exception("Cooldown depended on rendered frames");
                foreach (int guide in new[] { -1, 0, 1, 2, 3, 4, 5, 99 })
                {
                    source.TGuide = guide;
                    var town = new Game("town", source);
                    town.StartStage();
                    if (!town.Cleared_.Contains("1-2") || !town.GuildRegistered)
                        throw new Exception("Stage progress lost on return");
                    var restored = new Game("town");
                    SaveData.Apply(restored, SaveData.ToJson(town));
                    restored.StartStage();
                    restored.Tick(Game.STEP);
                }
                foreach (string stage in new[] { "1-1", "1-2", "1-3", "1-4", "town", "endless" })
                {
                    var g = new Game(stage);
                    g.StartStage();
                    var frame = new Frame(Game.W, Game.H);
                    var pixels = new byte[Game.W * Game.H * 4];
                    g.Warm(frame);
                    g.Input.KeyDown("KeyD");
                    var timer = System.Diagnostics.Stopwatch.StartNew();
                    for (int i = 0; i < 120; i++)
                    {
                        g.Tick(Game.STEP);
                        frame.Clear(); g.Render(frame); frame.SoftLight = true;
                        frame.Composite(pixels, null, 0.8);
                        g.SimMs += 1000.0 / 60;
                    }
                    Debug.Log($"[StageRegression] {stage}: tick/render/composite {timer.Elapsed.TotalMilliseconds / 120:F2} ms/frame (Editor CPU benchmark)");
                    var texture = new Texture2D(Game.W, Game.H, TextureFormat.RGBA32, false);
                    // Frame rows run top-to-bottom; PNG texture rows run bottom-to-top.
                    var flipped = new byte[pixels.Length];
                    for (int y = 0; y < Game.H; y++)
                        Buffer.BlockCopy(pixels, y * Game.W * 4, flipped, (Game.H - 1 - y) * Game.W * 4, Game.W * 4);
                    texture.LoadRawTextureData(flipped); texture.Apply();
                    File.WriteAllBytes(Path.Combine(output, stage + ".png"), texture.EncodeToPNG());
                    UnityEngine.Object.DestroyImmediate(texture);
                }
                Debug.Log("[StageRegression] PASS: 1-2 portal, render-independent cooldown, return/save reload (8 guide states), 6 stage render smoke tests");
            }
            finally { Rnd.R = rng; Game.W = width; Game.VIEW_DY = dy; Game.Zoom = zoom; }
        }
    }
}
