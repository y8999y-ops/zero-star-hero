using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;
using UnityEngine.UIElements;
using ZeroStar.UI;

namespace ZeroStar.Tests
{
    public static class TownConstructionTest
    {
        [MenuItem("ZeroStar/Tests/碎星鎮建設委託")]
        public static void Run()
        {
            TownArt.DayOverride = 0.25;
            TownArt.WeatherOverride = "clear";
            string path = Path.GetFullPath(Path.Combine(Application.dataPath, "../Golden/town-expansion-phase3"));
            Directory.CreateDirectory(path);

            var town = new Game("town");
            town.StartStage();
            CheckGroundOnly(town);
            Place(town, 665, 440);
            town.Input.KeyDown("KeyW");
            Step(town, 180);
            town.Input.KeyUp("KeyW");
            Require(town.Player.Y == 440 && !town.TownClimbing, "Hold up at the locked tower");

            Place(town, 794, 440);
            Game.Near talked = null;
            town.OnTalk = near => talked = near;
            town.Input.KeyDown("KeyF");
            Step(town);
            town.Input.KeyUp("KeyF");
            Require(talked?.Place == "town-mayor", "Mayor is available by the plaza worksite");
            TownTraversalTest.Capture(town, Path.Combine(path, "01-worksites.png"));
            CheckPanel(town);

            town.Money = 4000;
            town.Scrap = 300;
            Require(!town.TryBuildTown("plaza") && town.Money == 4000 && town.Scrap == 300, "Registration gate");
            town.GuildRegistered = true;
            town.TrackTownConstruction = true;
            Require(town.TrackedTownProject?.Id == "plaza", "First tracked commission");
            int saves = 0;
            town.OnTownBuilt = () => saves++;
            Build(town, "plaza");
            Place(town, 882, 440);
            Require(town.NearNow?.Place == "town-manhole" && !town.TravelTown("sewer"), "Manhole stays locked after the plaza");
            Require(!town.TryBuildTown("sewer") && !town.TryBuildTown("tower"), "Completion gates");
            town.Cleared_.Add("1-1");

            var locked = Junk(0);
            var gear = town.Fresh.core;
            town.Inv.Add(locked); town.Locked.Add(locked); town.Inv.Add(gear);
            for (int i = 1; i <= 4; i++) town.Inv.Add(Junk(i));
            int coins = town.Money, scrap = town.Scrap;
            Require(town.TrackedTownProject?.Id == "tower"
                && town.TownBuildShortage(town.TrackedTownProject, town.TownBuildJunk) == "垃圾 1", "Tracking displays construction shortage");
            Require(!town.TryBuildTown("tower") && saves == 1 && town.Money == coins && town.Scrap == scrap
                && town.Inv.Count == 6, "Locked junk or equipment cannot satisfy an incomplete payment");

            for (int i = 5; i <= 25; i++) town.Inv.Add(Junk(i));
            Require(!town.TryBuildTown("terrace") && !town.TryBuildTown("wall") && !town.TryBuildTown("house-b"), "Per-project prereqs");
            Build(town, "tower");
            Require(town.Inv.Contains(locked) && town.Inv.Contains(gear) && town.TownBuildJunk == 20, "Exact item payment");
            coins = town.Money;
            Require(!town.TryBuildTown("tower") && town.Money == coins && saves == 2, "No duplicate payment");
            Place(town, 665, 440);
            Require(town.TownNearLadder && town.Map.OnPlatform(665, 270) && !town.TravelTown("middle"), "Tower opens independently");
            TownTraversalTest.Capture(town, Path.Combine(path, "02-tower.png"));

            Build(town, "terrace");
            Place(town, 794, 440);
            Require(town.NearNow?.Place != "town-mayor", "Mayor moves out of the ground site");
            Require(town.TravelTown("middle"), "Middle waypoint opens");
            Place(town, 1094, 270);
            Require(town.NearNow?.Place == "town-mayor" && town.Map.OnPlatform(1094, 270), "Mayor stands at completed home");
            TownTraversalTest.Capture(town, Path.Combine(path, "03-mayor.png"));
            Build(town, "wall");
            Build(town, "house-a");
            Require(town.Map.OnPlatform(505, 345) && !town.Map.OnPlatform(1166, 337)
                && town.Folk.List.Count(o => o.Home != null) == 1, "Housing unlocks independently");
            town.Cleared_.Add("1-2");
            Build(town, "sewer");
            Build(town, "tree");
            Build(town, "house-b");
            Require(!town.TryBuildTown("star") && !town.TryBuildTown("house-c") && !town.TravelTown("upper"), "Upper gates");
            town.Cleared_.Add("1-3");
            Build(town, "star");
            Build(town, "house-c");

            Require(town.TownBuiltIds.Count() == 10 && town.TrackedTownProject == null && saves == 10, "All ten commissions saved");
            Require(town.Money == 4000 - TownProject.All.Sum(p => p.Coins)
                && town.Scrap == 300 - TownProject.All.Sum(p => p.Scrap)
                && town.Inv.Count == 2 && town.Locked.Contains(locked), "Total cost and inventory");
            Require(town.Folk.List.Count(o => o.Home != null) == 3, "One resident per finished house");
            Require(town.TravelTown("upper"), "Upper waypoint opens");
            TownTraversalTest.Capture(town, Path.Combine(path, "04-observatory.png"));
            Require(town.TravelTown("sewer") && town.TownUnderground && town.Map.SolidAt(882, Game.SewerFloor), "Sewer collision and travel");
            Step(town, 24);
            TownTraversalTest.Capture(town, Path.Combine(path, "05-sewer.png"));
            Require(town.TravelTown("surface") && town.Player.Y == 440, "Surface exit remains available");

            var restored = new Game("town");
            SaveData.Apply(restored, SaveData.ToJson(town));
            Require(restored.Player.Y == 440 && restored.TrackTownConstruction && restored.TownBuiltIds.SequenceEqual(town.TownBuiltIds)
                && restored.Money == town.Money && restored.Scrap == town.Scrap
                && restored.Inv.Count == 2 && restored.Locked.Count == 1 && restored.TravelTown("middle"), "Save round-trip");
            var returned = new Game("town", new Game("1-1", restored));
            Require(returned.TownBuiltIds.Count() == 10 && returned.TravelTown("sewer"), "Carry construction across stage changes");

            var old = new Game("town");
            SaveData.Apply(old, "{\"ver\":3,\"equip\":{},\"inv\":[],\"guild\":{\"registered\":true},\"cleared\":{\"1-2\":true},\"coins\":321,\"scrap\":22}");
            Require(old.GuildRegistered && old.Cleared_.Contains("1-2") && old.Money == 321 && old.Scrap == 22, "Read old save resources");
            CheckGroundOnly(old);
            string trace = Path.Combine(path, "partial-town.json");
            File.WriteAllText(trace, "{\"stage\":\"town\",\"town\":{\"built\":[\"plaza\",\"tower\",\"tower\",\"unknown\"]}}");
            TraceScript.Apply(old, trace);
            Require(old.TownBuiltIds.SequenceEqual(new[] { "plaza", "tower" }) && old.Map.OnPlatform(665, 270)
                && !old.TravelTown("middle") && !old.TravelTown("sewer"), "Trace can set partial construction");
            Debug.Log("[TownConstruction] PASS: gates, mayor, construction panel, ten payments, residents, tracking, old save, round-trip and partial trace");
        }

        static Item Junk(int index) => new Item { Uid = $"test-junk-{index}", Kind = "junk", Junk = Items.JUNK[0].id, Name = Items.JUNK[0].name };
        static void Require(bool ok, string test) { if (!ok) throw new InvalidOperationException(test); }
        static void Build(Game town, string id) => Require(town.TryBuildTown(id), $"Could not complete {id}");
        static void CheckGroundOnly(Game town)
        {
            Require(!town.TownBuiltIds.Any() && town.TownStops.Select(s => s.Id).SequenceEqual(new[] { "surface" })
                && town.Map.Platforms.Count == 0 && !town.Map.SolidAt(882, Game.SewerFloor)
                && !town.TravelTown("upper") && !town.TravelTown("sewer"), "Unfinished town travel and collision");
        }
        static void Place(Game town, int x, int y)
        {
            town.SetTestPosition(new Vector2(x, y));
            town.Player.Vx = town.Player.Vy = 0;
            town.Player.Grounded = true;
            Step(town);
        }
        static void Step(Game town, int count = 1)
        {
            for (int i = 0; i < count; i++)
            {
                town.RunTimers();
                town.Tick(Game.STEP);
                town.SimMs += 1000.0 / 60;
            }
        }
        static void CheckPanel(Game town)
        {
            var oldWin = TownWins.W;
            var root = new VisualElement();
            var win = new Win(root);
            try
            {
                TownWins.W = win;
                _ = TownWins.OpenConstruction(town);
                var labels = new List<string>();
                win.BodyQuery(e => { if (e is Label label) labels.Add(label.text); });
                Require(TownProject.All.All(p => labels.Contains(p.Name) && labels.Contains(p.Opens))
                    && labels.Any(l => l.Contains("完成公會登記")) && labels.Any(l => l.Contains("星塵 10")), "Commission panel lists projects, gates and costs");
                win.Close();
            }
            finally { TownWins.W = oldWin; }
        }
    }
}
