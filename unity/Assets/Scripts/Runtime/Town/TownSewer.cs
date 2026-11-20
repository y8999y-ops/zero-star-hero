using System;
using System.Collections.Generic;
using PixelFX;

namespace ZeroStar
{
    public static partial class TownArt
    {
        const int VaultTop = 455, SewerLampY = 495, GrateY = 475, Liner = 16;
        static int WaterY => Game.SewerFloor + SewerStoneHeight;
        static readonly int[] sewerLamps = { 431, 721, 1038, 1354, 1673 };
        static readonly int[] grateInTile = { 49, 143, 237 };
        static readonly (int x, int artY)[] crystalInTile = { (60, 51), (257, 50), (171, 135) };
        static FxRun sewerLight;
        static uint[] sewerSoil;

        static void ResetSewerEffects()
        {
            sewerWater = new FxRun(FxSystem.Def("sewer-current"),
                new FxOptions { X = SewerLeft + Liner, Y = WaterY, Light = 0 }
                    .Set("width", SewerRight - SewerLeft - 2 * Liner).Set("depth", H - WaterY));
            sewerLight = new FxRun(FxSystem.Def("sewer-light"), new FxOptions { Light = 1 });
        }

        internal static void TickSewerWater(double dt)
        {
            sewerWater?.Update(dt);
            sewerLight?.Update(dt);
        }

        static uint BrickPixel(int x, int y)
        {
            if (sewerBack == null) return 0xff393248;
            // 共用背牆的石料與灰縫，地面剖面跟下水道封口是同一層砌築。
            int sy = Math.Min(sewerBack.H - 1, 168 + Wrap(y, 16));
            return sewerBack.Px[sy * sewerBack.W + Wrap(x, sewerBack.W)];
        }

        static void PaintSewerVault(uint[] pixels, bool retainSoil)
        {
            if (sewerBack == null) return;
            if (retainSoil)
            {
                sewerSoil ??= new uint[TOWN_W * 14];
                Array.Copy(pixels, (FLOOR + 18) * TOWN_W, sewerSoil, 0, sewerSoil.Length);
            }
            for (int y = VaultTop; y < Game.SewerCeiling; y++)
            for (int x = SewerLeft; x < SewerRight; x++)
                pixels[y * TOWN_W + x] = BrickPixel(x, y - VaultTop);
        }

        static uint EarthPixel(int x, int y)
        {
            int shift = y / 13 * 37;
            uint c = sewerSoil == null ? 0 : sewerSoil[Wrap(y, 14) * TOWN_W + Wrap(x + shift, TOWN_W)];
            return c == 0 ? 0xff413045 : Parallax.Mix(c, 0xff503e49, 0.49);
        }

        static List<LightSrc> SewerLights(double time)
        {
            var lights = new List<LightSrc>(sewerLamps.Length);
            foreach (int x in sewerLamps)
                lights.Add(new LightSrc(x, SewerLampY, 50, 0.94 + 0.07 * Math.Sin(time * 5 + x), "#f3bc77"));
            return lights;
        }

        static void DrawSewer(Frame frame, float[] lv)
        {
            double offset = Parallax.Offset(frame.Ox, frame.CameraFractionX, 0.6);
            for (int y = 0; y < frame.H; y++)
            {
                int wy = y + frame.Oy, row = y * frame.W;
                int artY = 14 + (int)Math.Round((wy - Game.SewerCeiling) * 2.22);
                var backdrop = sewerBack == null ? default : new Parallax.Row(sewerBack.Px, sewerBack.W,
                    sewerBack.H, offset, artY);
                for (int x = 0; x < frame.W; x++)
                {
                    int wx = x + frame.Ox, i = row + x;
                    bool room = wx >= SewerLeft + Liner && wx < SewerRight - Liner;
                    uint c;
                    double level = 0.62 + Math.Min(1, Math.Max(0, lv[i])) * 0.22;
                    if (wy < VaultTop)
                    {
                        c = EarthPixel(wx, wy);
                        level *= 0.53 + 0.22 * Math.Max(0, Math.Min(1, (wy - frame.Oy) / 106.0));
                    }
                    else if (!room)
                    {
                        c = BrickPixel(wx + (wy / 8 % 2) * 9, wy);
                        int fromRoom = wx < SewerLeft + Liner ? SewerLeft + Liner - wx : wx - (SewerRight - Liner);
                        level *= fromRoom < 3 ? 1.12 : fromRoom < 10 ? 0.85 : 0.60;
                    }
                    else if (wy < Game.SewerCeiling)
                    {
                        c = MAIN[wy * TOWN_W + wx];
                        if (c == 0) c = BrickPixel(wx, wy);
                        level *= 0.82;
                    }
                    else
                    {
                        c = backdrop.Sample(x);
                        if (wy < H && MAIN[wy * TOWN_W + wx] != 0)
                            c = MAIN[wy * TOWN_W + wx];
                        if (c == 0) c = BrickPixel(wx, wy);
                    }
                    frame.Color[i] = Pack((c & 255) * level, ((c >> 8) & 255) * level, ((c >> 16) & 255) * level * 1.10);
                }
            }
            sewerWater?.Draw(frame);
            if (sewerLight == null || sewerBack == null) return;
            var fx = sewerLight.Options;
            double day = DayInfo().d;
            int a = (int)Math.Floor((offset - 25) / sewerBack.W);
            int b = (int)Math.Floor((offset + frame.W + 25) / sewerBack.W);
            for (int period = a; period <= b; period++)
            {
                double tile = frame.Ox + period * sewerBack.W - offset;
                foreach (int center in grateInTile)
                {
                    double x = tile + center;
                    if (x < SewerLeft + 28 || x > SewerRight - 28) continue;
                    fx.X = x; fx.Y = GrateY;
                    fx.Set("lamp", 0).Set("day", day).Set("reach", Game.SewerFloor - GrateY)
                        .Set("reflection", WaterY - GrateY + 1);
                    sewerLight.Draw(frame);
                }
                foreach (var crystal in crystalInTile)
                {
                    double x = tile + crystal.x;
                    if (x < SewerLeft + Liner || x >= SewerRight - Liner) continue;
                    fx.X = x;
                    fx.Y = Game.SewerCeiling + (crystal.artY - 14) / 2.22;
                    fx.Set("lamp", 2);
                    sewerLight.Draw(frame);
                }
            }
            foreach (int x in sewerLamps)
            {
                if (x < frame.Ox - 22 || x > frame.Ox + frame.W + 22) continue;
                fx.X = x; fx.Y = SewerLampY;
                fx.Set("lamp", 1).Set("reflection", WaterY - SewerLampY + 2);
                sewerLight.Draw(frame);
            }
        }
    }
}
