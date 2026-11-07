// game/src/quests.js 的公會任務（支線）一行一行翻成 C#：任務板一次 4 張，照解鎖的關卡隨機產生。
// 種類：kill 討伐指定魔物、junk 拾荒、clear 通關指定關卡（可能要求不死）、core 吸收魔物核。Math.random 一律 Rnd.Next()，順序照原本。
// 系統任務（主線）在 GameStage 的 SYSTEM。任務視窗在階段 4c。
using System;
using System.Collections.Generic;
using System.Linq;
using PixelFX;

namespace ZeroStar
{
    public class Quest
    {
        public string Id, Kind, Enemy, Stage, Title, Desc; public bool NoDeath; public int Need, Have;
        public int Coins, Scrap, Xp;
        public bool Ready => Have >= Need;
    }
    public class QuestBook
    {
        public readonly List<Quest> Active = new List<Quest>(), Board = new List<Quest>();
        public List<string> Tracked;
        public int EnhanceMax, Meals, Rerolls;

        static readonly Dictionary<string, string> ENEMY_NAME = new Dictionary<string, string> { ["slime"] = "狂化史萊姆", ["bat"] = "蝙蝠", ["trash"] = "垃圾桶怪", ["hog"] = "刺蝟", ["elite"] = "菁英（紅色）魔物" };
        static readonly Dictionary<string, string[]> STAGE_ENEMIES = new Dictionary<string, string[]> { ["1-1"] = new[] { "slime", "bat", "trash" }, ["1-2"] = new[] { "slime", "trash", "elite" }, ["1-3"] = new[] { "bat", "elite", "trash" }, ["1-4"] = new[] { "slime" } };
        public static readonly Dictionary<string, string> LAYOUT_NAME = new Dictionary<string, string> { ["1-1"] = "墜落之底", ["1-2"] = "垃圾山", ["1-3"] = "蝙蝠洞窟", ["1-4"] = "大胃王的巢穴" };
        static readonly string[] STAGE_ORDER = { "1-1", "1-2", "1-3", "1-4" };
        static int seq;
        static int RInt(int a, int b) => a + (int)Math.Floor(Rnd.Next() * (b - a + 1));
        static T Pick<T>(IList<T> a) => a[(int)Math.Floor(Rnd.Next() * a.Count)];

        /// 依照已解鎖的關卡產生一張任務
        static Quest MakeOffer(IList<string> unlocked)
        {
            string stage = Pick(unlocked); double k = Rnd.Next();
            string id = "q" + (seq++);
            if (k < 0.45)
            {
                string enemy = Pick(STAGE_ENEMIES.TryGetValue(stage, out var es) ? es : new[] { "slime" });
                int need = enemy == "elite" ? RInt(2, 3) : enemy == "trash" ? RInt(5, 8) : RInt(10, 18);
                return new Quest { Id = id, Kind = "kill", Enemy = enemy, Need = need, Title = $"討伐：{ENEMY_NAME[enemy]}", Desc = $"打倒 {need} 隻{ENEMY_NAME[enemy]}（{stage} {LAYOUT_NAME[stage]}比較多）", Coins = need * (enemy == "elite" ? 30 : 6), Scrap = (int)Math.Ceiling(need / 3.0), Xp = need * (enemy == "elite" ? 20 : 4) };
            }
            if (k < 0.65)
            {
                int need = RInt(4, 8);
                return new Quest { Id = id, Kind = "junk", Need = need, Title = "拾荒：回收委託", Desc = $"撿 {need} 件垃圾回來。……對，就是垃圾。", Coins = need * 10, Scrap = need, Xp = need * 5 };
            }
            if (k < 0.9 || stage == "1-4")
            {
                bool nodeath = Rnd.Next() < 0.35 && stage != "1-4";
                int si = Array.IndexOf(STAGE_ORDER, stage);
                return new Quest { Id = id, Kind = "clear", Stage = stage, NoDeath = nodeath, Need = 1, Title = $"{(stage == "1-4" ? "討伐王" : "探索")}：{LAYOUT_NAME[stage]}", Desc = $"通關 {stage} {LAYOUT_NAME[stage]}{(nodeath ? "，而且一次都不能死" : "")}", Coins = (nodeath ? 120 : 70) + si * 40, Scrap = 6, Xp = 60 + si * 30 };
            }
            return new Quest { Id = id, Kind = "core", Need = 1, Title = "研究：靈核", Desc = "吸收 1 顆魔物的靈核（史萊姆、垃圾桶怪、蝙蝠都會掉）", Coins = 90, Scrap = 8, Xp = 50 };
        }
        /// 任務板沒了或要換新時：補到 4 張
        public void RefreshBoard(IList<string> unlocked, bool force = false)
        {
            if (force) Board.Clear();
            while (Board.Count < 4) Board.Add(MakeOffer(unlocked));
        }
    }
}
