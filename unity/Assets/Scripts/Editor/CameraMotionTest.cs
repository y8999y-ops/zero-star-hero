using System;
using UnityEditor;
using UnityEngine;
using PixelFX;

namespace ZeroStar.Tests
{
    public static class CameraMotionTest
    {
        [MenuItem("ZeroStar/Tests/Smooth camera")]
        public static void Run()
        {
            // 穿越正負半像素邊界時，畫布取整＋顯示補償必須保持連續。
            double last = -2.01;
            for (int i = -200; i <= 200; i++)
            {
                double x = i / 100.0;
                var camera = new Game.RenderCamera(x, -x, 0, 0);
                double presented = camera.OriginX + camera.FractionX;
                if (Math.Abs(presented - x) > 0.000001 || Math.Abs(camera.OriginY + camera.FractionY + x) > 0.000001)
                    throw new Exception("Subpixel camera discontinuity");
                if (Math.Abs(presented - last - 0.01) > 0.000001) throw new Exception("Camera snapped at pixel boundary");
                last = presented;
            }
            var source = new byte[2 * 2 * 4];
            for (int i = 0; i < source.Length; i++) source[i] = (byte)i;
            var padded = new byte[4 * 4 * 4];
            PixelScreen.PadEdges(source, padded, 2, 2);
            for (int y = 0; y < 4; y++) for (int x = 0; x < 4; x++) for (int c = 0; c < 4; c++)
                if (padded[(y * 4 + x) * 4 + c] != source[(Math.Max(0, Math.Min(1, y - 1)) * 2 + Math.Max(0, Math.Min(1, x - 1))) * 4 + c])
                    throw new Exception("Camera overscan border mismatch");

            var rng = Rnd.R; double zoom = Game.Zoom; int width = Game.W, dy = Game.VIEW_DY;
            try
            {
                Rnd.R = new Rng(12345); Game.W = 384;
                foreach (string stage in new[] { "town", "1-2", "1-3" })
                {
                    var game = new Game(stage); game.StartStage();
                    var frame = new Frame(Game.W, Game.H);
                    game.Input.KeyDown("KeyD");
                    for (int tick = 0; tick < 180; tick++)
                    {
                        double oldX = game.CamX, oldY = game.CamY;
                        if (tick == 50) game.Input.KeyDown("Space");
                        if (tick == 60) game.Input.KeyUp("Space");
                        if (tick == 100) { game.Input.KeyUp("KeyD"); game.Input.KeyDown("KeyA"); }
                        game.Tick(Game.STEP);
                        double currentX = game.CamX, currentY = game.CamY;
                        frame.Clear(); game.RenderAt(frame, (oldX + currentX) / 2, (oldY + currentY) / 2);
                        if (game.CamX != currentX || game.CamY != currentY || double.IsNaN(currentX) || double.IsNaN(currentY))
                            throw new Exception("Presentation changed simulation camera");
                    }
                }
                Debug.Log("[CameraMotionTest] PASS: subpixel boundaries, overscan edges, walk/jump/reverse in town, 1-2 and 1-3");
            }
            finally { Rnd.R = rng; Game.Zoom = zoom; Game.W = width; Game.VIEW_DY = dy; }
            StageRegressionTest.Run();
        }
    }
}
