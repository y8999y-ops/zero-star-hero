using System;
using System.Collections.Generic;

namespace ZeroStar
{
    public partial class Game
    {
        public sealed class TownStop
        {
            public string Id, Name;
            public double X, Y;
        }

        public const int SewerCeiling = 472;
        public const int SewerFloor = 528;
        readonly List<RectD> townLadders = new List<RectD>();
        readonly List<TownStop> townStops = new List<TownStop>();
        public IReadOnlyList<TownStop> TownStops => townStops;
        TownStop townManhole;
        RectD? activeLadder;
        double ladderCooldown;
        public bool TownClimbing => activeLadder.HasValue;
        public bool TownUnderground => Town && Player.Y >= SewerCeiling;
        public bool TownNearLadder => Town && FindLadder(false) != null;

        void ReadTownTraversal()
        {
            townLadders.Clear();
            townStops.Clear();
            townManhole = null;
            activeLadder = null;
            if (composition == null) return;
            foreach (var (role, p, size) in composition.TownStamps(StampKind.Climb))
                if (size.x > 0 && size.y > 0) townLadders.Add(new RectD { X = p.x, Y = p.y, W = size.x, H = size.y });
            foreach (var (role, p, _) in composition.TownStamps(StampKind.TownMarker))
            {
                string name = role switch
                {
                    "surface" => "地面・城門", "middle" => "中層・鎮長家", "upper" => "上層・觀星台",
                    "sewer" => "地下・下水道", "manhole" => "下水道入口", _ => null
                };
                if (name == null) continue;
                var stop = new TownStop { Id = role, Name = name, X = p.x, Y = p.y };
                if (role == "manhole") townManhole = stop; else townStops.Add(stop);
            }
            townStops.Sort((a, b) => a.Y.CompareTo(b.Y));
        }

        RectD? FindLadder(bool toClimb)
        {
            RectD? nearest = null;
            double distance = double.PositiveInfinity;
            foreach (var r in townLadders)
            {
                if (Player.X < r.X - 3 || Player.X > r.X + r.W + 3
                    || Player.Y < r.Y - 2 || Player.Y > r.Y + r.H + 4) continue;
                if (toClimb && Player.Y <= r.Y + 1) continue;
                double d = Math.Abs(Player.X - (r.X + r.W / 2));
                if (d < distance) { nearest = r; distance = d; }
            }
            return nearest;
        }

        bool UpdateTownLadder(double dt)
        {
            ladderCooldown = Math.Max(0, ladderCooldown - dt);
            if (!activeLadder.HasValue)
            {
                if (!Input.Up || ladderCooldown > 0) return false;
                activeLadder = FindLadder(true);
                if (!activeLadder.HasValue) return false;
                Input.Consume("jump"); // W / 上同時是跳鍵。這次按下是抓梯子。
                Input.Consume("drop");
            }
            var r = activeLadder.Value;
            if (Input.Jump)
            {
                Input.Consume("jump");
                activeLadder = null;
                ladderCooldown = 0.22;
                Player.Vx = Player.Face * 94;
                Player.Vy = -270;
                Player.Grounded = false;
                Player.Jumps = 1;
                Sfx("jump");
                return true;
            }
            double bottom = r.Y + r.H;
            Player.X = r.X + r.W / 2;
            Player.Y = Math.Max(r.Y, Math.Min(bottom, Player.Y + ((Input.Down ? 1 : 0) - (Input.Up ? 1 : 0)) * 60 * dt));
            Player.Vx = Player.Vy = 0;
            Player.Grounded = false;
            Player.State = "move";
            Player.Pose = "stand";  // 攀爬美術待補；先沿用待機姿勢。
            Player.Clock += dt;
            if (Player.Y <= r.Y || (Input.Down && Player.Y >= bottom))
            {
                activeLadder = null;
                ladderCooldown = 0.15;
                Player.Grounded = Map.OnPlatform(Player.X, Player.Y) || Map.SolidAt(Player.X, Player.Y + 0.5);
                Player.Jumps = 0;
                Player.AirDash = true;
            }
            return true;
        }

        Near FindTownStop(double x, double y)
        {
            Near Make(TownStop stop, string place) => stop != null
                && Math.Abs(stop.X - x) < 24 && Math.Abs(stop.Y - y) < 17
                ? new Near { Id = stop.Id, Name = stop.Name, Place = place, X = stop.X, FootY = stop.Y, Hgt = 27 } : null;
            foreach (var stop in townStops)
            {
                var hit = Make(stop, "town-waypoint");
                if (hit != null) return hit;
            }
            return Make(townManhole, "town-manhole");
        }

        public bool TravelTown(string id)
        {
            if (!Town) return false;
            var target = townStops.Find(stop => stop.Id == id);
            if (target == null) return false;
            activeLadder = null;
            ladderCooldown = 0.2;
            Player.X = target.X; Player.Y = target.Y;
            Player.Vx = Player.Vy = Player.Coyote = Player.DropT = 0;
            Player.Grounded = true; Player.AirDash = true; Player.Jumps = 0;
            Player.State = "move";
            Input.ReleaseAll(); Input.Consume("jump"); Input.Consume("drop"); Input.Consume("dash");
            NearNow = null;
            SnapTownCamera();
            Say.Show(target.Name, 1.4);
            return true;
        }

        void SnapTownCamera()
        {
            var v = ViewRect();
            CamX = Math.Max(-v.x0, Math.Min(Data.W - v.x0 - v.w, Player.X - W / 2.0));
            CamY = TownUnderground ? Data.H - v.y0 - v.h
                : Math.Max(-v.y0, Math.Min(TownArt.StreetTop, Player.Y - TownArt.LegacyFloor));
            camLand = null;
            camRefY = Player.Y;
        }

        void FollowTownHeight(double dt)
        {
            var v = ViewRect();
            if (TownUnderground) { CamY = Data.H - v.y0 - v.h; return; }
            if (TownClimbing) camRefY = Player.Y;
            FollowVertical(dt, TownArt.LegacyFloor, -v.y0, TownArt.StreetTop);
        }
    }
}
