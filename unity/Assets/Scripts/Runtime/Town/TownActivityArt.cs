using System;
using PixelFX;

namespace ZeroStar
{
    public partial class Game
    {
        static readonly uint Ink = Col.Hex("#15142b"), Metal = Col.Hex("#585678"),
            Stone = Col.Hex("#85829e"), Gold = Col.Hex("#f3c969"), Ice = Col.Hex("#72c9dc"),
            Wood = Col.Hex("#754332"), WoodFace = Col.Hex("#a76a43"), Paper = Col.Hex("#ffebc7");

        void DrawTownActivities(Frame frame, bool underground)
        {
            var painter = new Painter(frame);
            if (underground)
            {
                if (!IsTownBuilt("sewer")) return;
                if (!TownWallOpened) DrawSealedSewer(painter, frame);
                else DrawSewerDoorway(painter);
                PrepareSewerJunk();
                for (int i = 0; i < sewerPickups.Count; i++)
                    if ((SewerTakenToday & (1 << i)) == 0)
                        DrawSewerJunk(painter, sewerPickups[i]);
            }
            foreach (var a in TownActivityPlaces)
            {
                if ((a.Y >= SewerCeiling) != underground || !ActivityOpen(a)
                    || a.X + 24 < frame.Ox || a.X - 24 >= frame.Ox + frame.W) continue;
                if (a.Y < TownArt.FLOOR && TownArt.ElevatedVisibility(frame.Oy + frame.CameraFractionY) <= 0) continue;
                painter.Place(a.X, a.Y);
                switch (a.Id)
                {
                    case "mail": DrawMailbox(painter, TownUnreadLetters != 0); break;
                    case "race-start": DrawFlag(painter, false, TownCanRace); break;
                    case "race-end": DrawFlag(painter, true, TownRaceClock.HasValue); break;
                    case "cache-west":
                    case "cache-east": DrawTownCache(painter, TownCacheOpened(a.Id)); break;
                    case "inscription": DrawInscription(painter); break;
                }
            }
            if (!underground && IsTownBuilt("tree") && trainingFlash > 0)
            {
                painter.Place(DummyX, TownArt.FLOOR - 26);
                painter.Glow(0, 0, 14, Gold, trainingFlash * 2.1);
            }
        }

        void DrawSewerJunk(Painter p, Drops.Drop drop)
        {
            int size = Icons.S;
            var pixels = Icons.Get(drop.Item.Icon);
            if (pixels == null) return;
            int bob = (int)Math.Round(Math.Sin(sceneClock * 3.3 + drop.X) * 1.4);
            p.Place(drop.X - size / 2, drop.Y - size + bob - 3);
            for (int y = 0; y < size; y++)
            for (int x = 0; x < size; x++)
            {
                uint color = pixels[y * size + x];
                if (color != 0) p.Dot(x, y, color);
            }
            if (Math.Sin(sceneClock * 2.0 + drop.X) > 0.7) p.Dot(size - 1, 1, Paper);
        }

        void DrawSealedSewer(Painter p, Frame frame)
        {
            p.Place(0, 0);
            int edge = Math.Min(TownArt.SewerRight, frame.Ox + frame.W);
            for (int x = CrackX; x < edge; x += 22)
            for (int y = SewerCeiling; y < SewerFloor; y += 7)
            {
                int stagger = (y - SewerCeiling) / 7 % 2 * 8;
                int left = Math.Max(CrackX, x - stagger), right = Math.Min(edge, x + 22 - stagger);
                uint face = x == CrackX ? Metal : Col.Hex("#393246");
                p.Rect(left, y, right - left, 7, Ink);
                p.Rect(left + 1, y + 1, right - left - 1, 5, face);
                if (right > left + 3) p.Rect(left + 2, y + 1, right - left - 3, 1, x == CrackX ? Stone : Metal);
            }
            p.Line(CrackX + 4, SewerCeiling + 6, CrackX + 11, SewerCeiling + 18, Ink);
            p.Line(CrackX + 11, SewerCeiling + 18, CrackX + 3, SewerCeiling + 32, Ink);
            p.Line(CrackX + 3, SewerCeiling + 32, CrackX + 12, SewerCeiling + 46, Ink);
            p.Line(CrackX + 8, SewerCeiling + 24, CrackX + 19, SewerCeiling + 19, Ink);
        }

        static void DrawSewerDoorway(Painter p)
        {
            p.Place(CrackX, SewerFloor);
            p.Rect(-4, -55, 22, 4, Ink);
            p.Rect(-3, -54, 20, 2, Metal);
            p.Rect(-4, -51, 4, 51, Ink);
            p.Rect(-3, -50, 2, 49, Metal);
            p.Rect(0, -3, 13, 2, Metal);
            for (int y = -44; y < -5; y += 9) p.Dot(-2, y, Stone);
        }

        static void DrawMailbox(Painter p, bool unread)
        {
            p.Rect(-4, -16, 8, 16, Ink); p.Rect(-2, -15, 4, 15, WoodFace);
            p.Rect(-10, -27, 20, 14, Ink);
            p.Rect(-8, -28, 16, 4, Metal); p.Rect(-8, -24, 16, 10, Col.Hex("#893b57"));
            p.Rect(-6, -22, 12, 2, Ink); p.Rect(-5, -18, 10, 2, Gold);
            if (unread)
            {
                p.Rect(3, -25, 5, 7, Paper); p.Rect(2, -25, 6, 1, Gold);
                p.Glow(5, -22, 7, Gold, 0.25);
            }
        }

        void DrawFlag(Painter p, bool finish, bool live)
        {
            p.Rect(-6, -2, 12, 2, Ink); p.Rect(-2, -30, 4, 29, Wood);
            p.Rect(-1, -32, 2, 4, Gold);
            int flap = (int)Math.Round(Math.Sin(sceneClock * 4) * 2);
            uint fill = finish ? Gold : live ? Ice : Metal;
            p.Rect(2, -29, 14 + flap, 12, Ink);
            p.Rect(3, -28, 12 + flap, 10, fill);
            p.Rect(5, -26, 2, 6, Paper);
            if (finish) { p.Rect(7, -24, 6, 2, Wood); p.Rect(9, -26, 2, 6, Wood); }
        }

        static void DrawTownCache(Painter p, bool open)
        {
            p.Rect(-10, -11, 20, 11, Ink); p.Rect(-8, -10, 16, 8, WoodFace);
            p.Rect(-8, -5, 16, 2, Wood);
            p.Rect(-6, -9, 2, 7, Gold); p.Rect(4, -9, 2, 7, Gold);
            if (open) { p.Rect(-9, -16, 18, 6, Ink); p.Rect(-7, -15, 14, 3, Wood); }
            else
            {
                p.Rect(-10, -15, 20, 6, Ink); p.Rect(-8, -14, 16, 3, WoodFace);
                p.Rect(-2, -12, 4, 5, Gold); p.Dot(0, -10, Paper);
            }
        }

        static void DrawInscription(Painter p)
        {
            p.Rect(-15, -32, 30, 31, Ink); p.Rect(-12, -30, 24, 26, Metal);
            p.Rect(-10, -28, 20, 2, Stone); p.Rect(-13, -4, 26, 3, Stone);
            for (int i = -7; i <= 7; i += 7)
            {
                p.Rect(i, -24, 2, 16, Ice); p.Rect(i - 2, -20, 6, 1, Ice);
                p.Rect(i, -14, 5, 1, Ice);
            }
            p.Glow(0, -16, 15, Ice, 0.21);
        }
    }
}
