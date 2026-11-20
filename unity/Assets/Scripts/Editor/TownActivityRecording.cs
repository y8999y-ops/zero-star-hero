using System;
using System.Reflection;
using UnityEditor;
using UnityEngine;
using ZeroStar.UI;

namespace ZeroStar.EditorTools
{
    // 讓現有 Recorder 透過遊戲的互動入口展示每個玩法。
    // 只在以 -shot 開啟的驗收存檔執行，遊戲成品不包含這段。
    internal static class TownActivityRecording
    {
        static readonly FieldInfo CurrentGame = typeof(GameRoot).GetField("game", BindingFlags.Instance | BindingFlags.NonPublic);
        static readonly FieldInfo WindowTicks = typeof(GameRoot).GetField("winTicks", BindingFlags.Instance | BindingFlags.NonPublic);
        static int first, index;
        static float fps;

        static readonly (float second, Action<Game> play)[] Steps =
        {
            (0.35f, g => { g.Money = 600; Game.TownLocalDate = () => new DateTime(2026, 11, 20); Place(g, 743, 440); }),
            (0.8f, g => Talk(g, "wish")),
            (2.55f, g => { g.MakeTownWish(); TownWins.W.Close(); }),
            (4.4f, g => { TownArt.DayOverride = 0.50; Place(g, 705, 140); }),
            (4.85f, g => Talk(g, "bell")),
            (6.4f, g => { g.RingTownBell(); TownWins.W.Close(); }),
            (8.2f, g => Place(g, 1432, 140)),
            (8.55f, g => Talk(g, "stars")),
            (10.15f, g => { g.ReadTownStars(); TownWins.W.Render(); }),
            (11.4f, g => TownWins.W.Close()),
            (11.8f, g => Place(g, 1710, 440)),
            (12.25f, g => g.Input.KeyDown("KeyJ")),
            (14.15f, g => g.Input.KeyUp("KeyJ")),
            (15.25f, g => Place(g, 1816, 440)),
            (15.6f, g => Talk(g, "race-start")),
            (17.0f, g => { g.StartTownRace(); TownWins.W.Close(); }),
            (20.35f, g => { g.TravelTown("sewer"); Place(g, 688, 528); }),
            (21.65f, g => Place(g, 450, 528)),
            (22.1f, g => Talk(g, "cache-west")),
            (24.0f, g => Place(g, 1518, 528)),
            (24.75f, g => Talk(g, "crack")),
            (26.1f, g => Place(g, 1652, 528)),
            (26.55f, g => Talk(g, "inscription")),
            (28.35f, g => TownWins.W.Close()),
            (28.65f, g => { g.TravelTown("surface"); g.Cleared_.UnionWith(new[] { "1-1", "1-2" }); Place(g, 453, 440); }),
            (29.2f, g => Talk(g, "mail")),
            (30.6f, g => { g.ReadTownLetter("1-1"); TownWins.W.Render(); }),
        };

        internal static void Begin(int start, float rate)
        {
            if (Array.IndexOf(Environment.GetCommandLineArgs(), "-shot") < 0) return;
            first = start; fps = rate; index = 0;
            EditorApplication.update -= Advance;
            EditorApplication.update += Advance;
        }

        static void Advance()
        {
            if (!EditorApplication.isPlaying || index == Steps.Length)
            { EditorApplication.update -= Advance; return; }
            if ((Time.frameCount - first) / fps < Steps[index].second) return;
            var root = UnityEngine.Object.FindFirstObjectByType<GameRoot>();
            if (root == null || !(CurrentGame.GetValue(root) is Game game) || !game.Town) return;
            if (!TownWins.W.Open) WindowTicks?.SetValue(root, 0);
            var step = Steps[index++];
            step.play(game);
        }

        static void Place(Game g, int x, int y)
        {
            g.Input.ReleaseAll();
            g.SetTestPosition(new Vector2(x, y));
            g.Player.State = "move";
            g.Player.Vx = g.Player.Vy = 0;
            g.Player.Grounded = true;
        }
        static void Talk(Game g, string id)
        {
            if (g.NearNow?.Id == id) g.OnTalk?.Invoke(g.NearNow);
            else Debug.LogError($"[TownActivityRecording] 沒找到互動點 {id}，實際為 {g.NearNow?.Id ?? "無"}");
        }
    }
}
