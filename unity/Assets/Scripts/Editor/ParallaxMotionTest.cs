using System;
using UnityEditor;
using UnityEngine;
using PixelFX;

namespace ZeroStar.Tests
{
    public static class ParallaxMotionTest
    {
        [MenuItem("ZeroStar/Tests/Parallax motion")]
        public static void Run()
        {
            var marker = new uint[64]; marker[32] = 0xff80c0ff;
            foreach (double speed in new[] { 0.0, 0.04, 0.05, 0.12, 0.3, 0.35, 0.6, 0.7, 0.85, 1.0, 1.3, 1.35 })
            {
                double previous = double.NaN;
                for (int i = -400; i <= 400; i++)
                {
                    double camera = i / 100.0;
                    int origin = (int)Pf.Round(camera);
                    double remainder = camera - origin;
                    double offset = Parallax.Offset(origin, remainder, speed);
                    var row = new Parallax.Row(marker, 64, 1, offset, 0);
                    double weight = 0, sum = 0;
                    for (int x = 0; x < 64; x++)
                    {
                        uint color = row.Sample(x); double a = color >> 24;
                        weight += a; sum += x * a;
                        if (a > 0 && (color & 0xffffff) != 0x80c0ff) throw new Exception("Transparent edge darkened");
                    }
                    double center = sum / weight - remainder;
                    if (Math.Abs(center - (32 - camera * speed)) > 0.006)
                        throw new Exception($"Parallax drift at speed {speed}, camera {camera}");
                    if (!double.IsNaN(previous) && Math.Abs(center - previous) > 0.025)
                        throw new Exception("Parallax jumped across rounded camera boundary");
                    previous = center;
                }
            }
            // 負座標循環、垂直小數位移與透明合成。
            var pixels = new uint[] { 0xff0000ff, 0, 0, 0xff00ff00 };
            if (new Parallax.Row(pixels, 2, 2, -2, 0).Sample(0) != pixels[0]) throw new Exception("Negative wrap failed");
            uint half = new Parallax.Row(pixels, 2, 2, 0, 0.5).Sample(0);
            if (new Parallax.Row(pixels, 2, 2, 0, 1, 0, 1).Sample(1) != 0)
                throw new Exception("Tall level upper layer crossed its pin boundary");
            if ((half >> 24) != 128 || (half & 255) != 255) throw new Exception("Vertical alpha sampling failed");
            if ((Parallax.Over(0xff000000, half) & 255) != 128) throw new Exception("Alpha compositing failed");
            Debug.Log("[ParallaxMotionTest] PASS: 12 speeds across positive/negative pixel boundaries, transparent edges, vertical interpolation and wrapping");
            CameraMotionTest.Run();
        }
    }
}
