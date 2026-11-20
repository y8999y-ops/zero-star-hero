using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using PixelFX;
using UnityEditor;
using UnityEngine;

namespace ZeroStar.Tests
{
    public static class TownTraversalTest
    {
        [MenuItem("ZeroStar/Tests/碎星鎮四層動線")]
        public static void Run()
        {
            Rnd.R = new Rng(12345);
            Game.W = 384;
            TownArt.DayOverride = 0.25;
            TownArt.WeatherOverride = "clear";
            string directory = Path.GetFullPath(Path.Combine(Application.dataPath, "../Golden/town-expansion-phase2"));
            Directory.CreateDirectory(directory);
            var trace = new List<(int tick, string type, string code)>();
            var shots = new List<int>();
            var game = Start();
            int tick = 0;

            void Step()
            {
                Advance(game);
                tick++;
            }
            void Key(string k, bool down)
            {
                trace.Add((tick, down ? "d" : "u", k));
                if (down) game.Input.KeyDown(k); else game.Input.KeyUp(k);
            }
            void Until(Func<bool> goal, string label, int limit = 450)
            {
                int remain = limit;
                while (!goal() && remain-- > 0) Step();
                if (!goal()) throw new InvalidOperationException($"{label} did not finish at {game.Player.X:F1},{game.Player.Y:F1}");
            }
            void Walk(double target)
            {
                bool right = target > game.Player.X;
                string key = right ? "KeyD" : "KeyA";
                Key(key, true);
                Until(() => right ? game.Player.X >= target - 3 : game.Player.X <= target + 3, "步行");
                Key(key, false);
                for (int n = 0; n < 12; n++) Step();
                if (Math.Abs(game.Player.X - target) > 15) throw new InvalidOperationException("錯過走路目標");
            }
            void Up(double y)
            {
                if (!game.TownNearLadder) throw new InvalidOperationException("測試角色沒有走到梯腳");
                Key("KeyW", true);
                Until(() => game.Player.Y == y && game.Player.Grounded && !game.TownClimbing, "爬到頂端");
                Key("KeyW", false);
                for (int i = 0; i < 12; i++) Step();
                if (game.Player.Y != y) throw new InvalidOperationException("頂端沒有站穩");
            }
            void Shot(string name)
            {
                shots.Add(tick);
                Capture(game, Path.Combine(directory, name + ".png"));
                Debug.Log($"[TownTraversal] {name} tick {tick} ({game.Player.X:F1},{game.Player.Y:F1})");
            }

            for (int n = 0; n < 20; n++) Step();
            Walk(665);
            if (game.Player.Y != TownArt.FLOOR) throw new InvalidOperationException("鐘樓梯腳的街道高度不正確");
            Shot("01-ground");
            Up(270);
            Walk(965);
            if (game.Player.Y != 270) throw new InvalidOperationException("走吊橋時掉出中層");
            Shot("02-middle");
            Up(140);
            var lookout = game.TownStops.Single(x => x.Id == "upper");
            Walk(lookout.X);
            if (game.Player.Y != 140 || game.NearNow?.Id != "upper") throw new InvalidOperationException("觀星台路標不可用");
            Shot("03-upper");
            trace.Add((tick, "t", "sewer"));
            bool activated = false;
            game.OnTalk = n => { activated = n.Place == "town-waypoint" && n.Id == "upper" && game.TravelTown("sewer"); };
            game.Input.KeyDown("KeyF"); Step(); game.Input.KeyUp("KeyF");
            if (!activated || !game.TownUnderground || game.Player.Y != Game.SewerFloor)
                throw new InvalidOperationException("路標沒有傳送到下水道");
            for (int i = 0; i < 25; i++) Step();
            Shot("04-sewer");
            if (!game.TravelTown("surface") || game.Player.Y != TownArt.FLOOR || game.TownUnderground)
                throw new InvalidOperationException("地下路標無法回到地面");

            var touch = Start();
            touch.Player.X = 665;
            touch.Input.TouchVertical = 1;
            for (int i = 0; i < 200 && (touch.Player.Y != 270 || !touch.Player.Grounded); i++) Advance(touch);
            if (touch.Player.Y != 270 || touch.TownClimbing) throw new InvalidOperationException("觸控上拖不能爬上鐘樓");
            touch.Input.TouchVertical = 0; Advance(touch);
            touch.Input.TouchVertical = -1;
            for (int i = 0; i < 22; i++) Advance(touch);
            if (!touch.TownClimbing || touch.Player.Y <= 270) throw new InvalidOperationException("觸控下拖不能從梯頂抓梯");
            for (int i = 0; i < 170 && touch.TownClimbing; i++) Advance(touch);
            if (touch.Player.Y != TownArt.FLOOR) throw new InvalidOperationException("往下爬沒有踩到街道");
            Place(touch, 705, (float)touch.Map.FloorAt(705, 270));
            touch.Input.TouchVertical = 0; Advance(touch);
            touch.Input.TouchVertical = -1;
            for (int i = 0; i < 12; i++) Advance(touch);
            if (touch.Player.Y <= 270 || touch.TownClimbing) throw new InvalidOperationException("離開梯口的觸控下拖沒有穿過平台");

            var jump = Start();
            jump.Player.X = 665;
            jump.Input.KeyDown("KeyW");
            for (int i = 0; i < 20; i++) Advance(jump);
            jump.Input.KeyUp("KeyW");
            jump.Input.KeyDown("Space");
            Advance(jump);
            if (jump.TownClimbing || jump.Player.Vy >= 0 || jump.Player.Vx <= 0)
                throw new InvalidOperationException("沒有向面向的方向跳離梯子");

            var stairs = Start();
            stairs.Player.X = 519;
            stairs.Input.KeyDown("KeyD");
            double highest = stairs.Player.Y;
            for (int i = 0; i < 26; i++) { Advance(stairs); highest = Math.Min(highest, stairs.Player.Y); }
            if (highest > TownArt.FLOOR - 16) throw new InvalidOperationException("走路沒有自動踩上樓梯");

            File.WriteAllText(Path.Combine(directory, "unity-trace-script-town-climb.json"),
                "{\n  \"stage\": \"town\", \"day\": 0.25, \"weather\": \"clear\",\n"
                + "  \"town\": {\"built\": [" + string.Join(", ", TownProject.All.Select(p => $"\"{p.Id}\"")) + "]},\n"
                + $"  \"ticks\": {shots.Last() + 21}, \"shotTicks\": [{string.Join(",", shots)}],\n  \"events\": [\n"
                + string.Join(",\n", trace.Select(e => $"    [{e.tick},\"{e.type}\",\"{e.code}\"]")) + "\n  ]\n}\n");
            Debug.Log("[TownTraversal] PASS: keyboard route, touch vertical controls, drop-through, jump off, stair step and waypoint");
        }

        public static void VerifyApproaches()
        {
            Rnd.R = new Rng(12345);
            Game.W = 384;
            TownArt.DayOverride = 0.25;
            TownArt.WeatherOverride = "clear";
            string directory = Path.GetFullPath(Path.Combine(Application.dataPath, "../Golden/town-framing-repair"));
            Directory.CreateDirectory(directory);

            var game = new Game("town");
            game.SetTestTownConstruction(new[] { "tower" });
            game.StartStage();
            Place(game, 907, 270);
            Walk(game, "KeyD", 70);
            Require(game.Player.X < 960 && game.Player.Y == 270 && game.Player.Grounded,
                $"只完工鐘樓時應在橋端停住，實際 {game.Player.X:F1},{game.Player.Y:F1}");
            Require(game.NearNow?.Id == "terrace", "橋端應可讀取石台地施工告示");
            Capture(game, Path.Combine(directory, "02-吊橋工地.png"));
            Place(game, 1140, 140);
            Walk(game, "KeyD", 65);
            Require(game.Player.X < 1184 && game.Player.Y == 140 && game.Player.Grounded, "上層施工橋端應擋住");
            Place(game, 910, TownArt.FLOOR);
            Walk(game, "KeyD", 70);
            Require(game.Player.X > 980 && game.Player.Y == TownArt.FLOOR, "橋端下方的地面仍須通行");

            game.SetTestTownConstruction(TownProject.All.Select(p => p.Id));
            Place(game, 907, 270);
            Walk(game, "KeyD", 70);
            Require(game.Player.X > 960 && game.Player.Y == 270 && game.Player.Grounded, "石台地開放後可以走過橋端");
            Capture(game, Path.Combine(directory, "03-石台地完工.png"));
            Place(game, 178, TownArt.FLOOR);
            Climb(game, "KeyW", 270);
            Climb(game, "KeyS", TownArt.FLOOR);
            Place(game, 1553, TownArt.FLOOR);
            Climb(game, "KeyW", 342);
            Climb(game, "KeyS", TownArt.FLOOR);
            Place(game, 2166, TownArt.FLOOR);
            Climb(game, "KeyW", 287);
            Place(game, 2192, 287);
            Climb(game, "KeyW", 202);
            Climb(game, "KeyW", 140);
            Capture(game, Path.Combine(directory, "04-樹冠落腳面.png"));
            Climb(game, "KeyS", 202);

            foreach (var (day, label) in new[] { (0.25, "白天"), (0.75, "晚上") })
            {
                TownArt.DayOverride = day;
                foreach (var (x, name) in new[] { (120, "城門"), (325, "公會"), (665, "鐘樓"), (800, "廣場"),
                    (962, "工坊"), (1360, "旅館"), (2166, "大樹") })
                {
                    Place(game, x, TownArt.FLOOR);
                    var v = Game.ViewRect();
                    Require(Game.Zoom == Game.TOWN_ZOOM && game.CamY + v.y0 + v.h <= Game.SewerCeiling,
                        $"{name}的街道鏡頭應維持既有倍率並對齊地下拱頂");
                    Capture(game, Path.Combine(directory, $"01-{label}-{name}.png"));
                }
            }
            Debug.Log("[TownApproaches] PASS: blocked passages, street camera, castle, house and tree ladders");
        }

        static void Require(bool condition, string message)
        {
            if (!condition) throw new InvalidOperationException(message);
        }

        [MenuItem("ZeroStar/Tests/碎星鎮修復總驗收")]
        public static void VerifyRepairs()
        {
            Rnd.R = new Rng(12345);
            TownArt.DayOverride = 0.25;
            TownArt.WeatherOverride = "clear";
            Game.W = 384;
            string path = Path.GetFullPath(Path.Combine(Application.dataPath, "../Golden/town-repair-complete"));
            Directory.CreateDirectory(path);
            var game = new Game("town");
            game.StartStage();
            void Shot(string file, float x, float y)
            {
                Place(game, x, y);
                Advance(game);
                Capture(game, Path.Combine(path, file + ".png"));
            }
            Shot("新存檔-東街", 1920, 440);
            Require(game.Map.Platforms.Count == 0 && game.TownStops.Count == 1
                && !game.TravelTown("sewer"), "新存檔只能走地面");
            Place(game, 882, 440); Advance(game);
            Require(game.NearNow?.Place != "town-manhole", "廣場未建不應有可互動的人孔");
            game.SetTestTownConstruction(new[] { "plaza" });
            Shot("已建廣場-人孔關閉", 835, 440);
            Place(game, 882, 440); Advance(game);
            Require(game.NearNow?.Place == "town-manhole" && !game.TravelTown("sewer"), "廣場人孔關閉時仍須提示");
            game.SetTestTownConstruction(new[] { "tower" });
            Place(game, 909, (float)game.Map.FloorAt(909, 270));
            Walk(game, "KeyD", 75);
            Require(game.Player.Grounded && game.Player.X < 960 && game.Player.Y <= 271, "只有鐘樓時橋端必須擋住");
            Capture(game, Path.Combine(path, "只完工鐘樓-施工橋端.png"));

            game.SetTestTownConstruction(TownProject.All.Select(p => p.Id));
            Place(game, 191, 270);
            game.Input.KeyDown("KeyD");
            double deepest = 270;
            for (int i = 0; i < 370 && game.Player.X < 664; i++)
            {
                Advance(game);
                if (game.Player.X >= 212 && game.Player.X < 640)
                {
                    double deck = game.Map.FloorAt(game.Player.X, 269);
                    Require(Math.Abs(game.Player.Y - deck) < 1.1, $"城牆吊橋踏面失配 {game.Player.X:F1},{game.Player.Y:F1} vs {deck:F1}");
                }
                deepest = Math.Max(deepest, game.Player.Y);
            }
            game.Input.KeyUp("KeyD");
            Require(game.Player.X >= 664 && game.Player.Y == 270 && deepest >= 284 && deepest < 289,
                $"城牆吊橋要可雙端通行並有下垂，實際 {game.Player.X:F1},{game.Player.Y:F1}, lowest {deepest:F1}");
            game.Input.KeyDown("KeyA");
            for (int i = 0; i < 390 && game.Player.X > 190; i++) Advance(game);
            game.Input.KeyUp("KeyA");
            Require(game.Player.X <= 190 && game.Player.Y == 270 && game.Player.Grounded, "城牆吊橋回程");
            Place(game, 1110, 270);
            Require(game.TravelTown("sewer") && game.Player.Y == 528, "路標進入下水道");
            Shot("白天-下水道西端", 423, 528);
            Require(game.CamX >= 400, "西端鏡頭不得超出下水道");
            Shot("白天-下水道東端", 1678, 528);
            Require(game.CamX + Game.ViewRect().w <= 1704, "東端鏡頭不得超出下水道");

            foreach (var (day, label) in new[] { (0.25, "白天"), (0.75, "夜晚") })
            {
                TownArt.DayOverride = day;
                Shot(label + "-地面廣場", 830, 440);
                Shot(label + "-東街", 1960, 440);
                Shot(label + "-城牆吊橋", 430, (float)game.Map.FloorAt(430, 270));
                Shot(label + "-鎮長家", 1105, 270);
                Shot(label + "-觀星台", 1480, 140);
                Shot(label + "-下水道", 882, 528);
            }
            Debug.Log("[TownRepair] PASS: fresh, plaza locked, tower only, two-way sagging bridge, all built, sewer bounds and day/night render");
        }

        static void Place(Game game, float x, float y)
        {
            game.Input.ReleaseAll();
            game.SetTestPosition(new Vector2(x, y));
            game.Player.Vx = game.Player.Vy = game.Player.DropT = 0;
            game.Player.Grounded = true;
        }

        static void Walk(Game game, string key, int ticks)
        {
            game.Input.KeyDown(key);
            for (int tick = 0; tick < ticks; tick++) Advance(game);
            game.Input.KeyUp(key);
        }

        static void Climb(Game game, string key, int target)
        {
            Walk(game, key, 1);
            game.Input.KeyDown(key);
            for (int tick = 0; tick < 200 && (game.Player.Y != target || game.TownClimbing); tick++) Advance(game);
            game.Input.KeyUp(key);
            for (int tick = 0; tick < 10; tick++) Advance(game);
            Require(game.Player.Y == target && game.Player.Grounded,
                $"{key}應落在 {target}，實際 {game.Player.X:F1},{game.Player.Y:F1}");
        }

        static Game Start()
        {
            var g = new Game("town");
            g.SetTestTownConstruction(TownProject.All.Select(project => project.Id));
            g.StartStage();
            return g;
        }

        static void Advance(Game g)
        {
            g.RunTimers();
            g.Tick(Game.STEP);
            g.SimMs += 1000.0 / 60;
        }

        internal static void Capture(Game g, string path)
        {
            var frame = new Frame(Game.W, Game.H) { SoftLight = true, UseGpuWeather = PostFx.Supported && PostFx.Enabled };
            var rgba = new byte[Game.W * Game.H * 4];
            frame.Clear();
            g.Render(frame);
            frame.Composite(rgba, null, 0.8);
            g.PostComposite(rgba);
            if (frame.UseGpuWeather) PostFx.RenderInto(rgba, frame);
            const int scale = 3;
            int w = Game.W, h = Game.H;
            var tex = new Texture2D(w * scale, h * scale, TextureFormat.RGBA32, false);
            var pixels = new Color32[w * h * scale * scale];
            for (int y = 0; y < h; y++)
            for (int x = 0; x < w; x++)
            {
                int i = (y * w + x) * 4;
                var c = new Color32(rgba[i], rgba[i + 1], rgba[i + 2], 255);
                for (int dy = 0; dy < scale; dy++)
                for (int dx = 0; dx < scale; dx++)
                    pixels[(h * scale - 1 - y * scale - dy) * w * scale + x * scale + dx] = c;
            }
            tex.SetPixels32(pixels); tex.Apply();
            File.WriteAllBytes(path, tex.EncodeToPNG());
            UnityEngine.Object.DestroyImmediate(tex);
        }
    }
}
