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
            for (int i = 0; i < 12; i++) Advance(touch);
            if (touch.Player.Y <= 270) throw new InvalidOperationException("觸控下拖沒有穿過平台");

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
