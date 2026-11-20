using System;
using System.Linq;
using PixelFX;
using UnityEditor;
using UnityEngine;

namespace ZeroStar.Tests
{
    public static class TownActivityTest
    {
        [MenuItem("ZeroStar/Tests/碎星鎮玩法驗收")]
        public static void Run()
        {
            var previousDate = Game.TownLocalDate;
            var previousDay = TownArt.DayOverride;
            var date = new DateTime(2026, 11, 20);
            try
            {
                Game.TownLocalDate = () => date;
                Rnd.R = new Rng(3226);
                var g = new Game("town");
                g.StartStage();
                Must(g.MakeTownWish() == null && !g.ReadTownStars() && !g.StartTownRace(), "未完工的區域必須鎖住");
                g.SetTestTownConstruction(TownProject.All.Select(p => p.Id));
                g.Money = 9;
                Must(g.MakeTownWish() == null && g.Money == 9, "投幣前須檢查金幣");
                g.Money = 100;
                string first = g.MakeTownWish();
                Must(first != null && g.TownWishUsed && g.MakeTownWish() == null, "同日只能許願一次");

                TownArt.DayOverride = 0.25;
                g.RingTownBell();
                Must(TownArt.DayOverride == 0.5 && g.TownBellPreview, "鐘樓切到日落");
                g.RingTownBell();
                Must(TownArt.DayOverride == null && !g.TownBellPreview, "第二次敲鐘恢復即時天色");

                date = date.AddDays(1);
                while (g.TodayConstellation.Form == null) date = date.AddDays(1);
                Must(g.TodayConstellation.Form != null && !g.TownWishUsed, "日期跨日正確重置");
                g.Player.SetForm(g.TodayConstellation.Form);
                double baseline = g.Player.RollDmg(1, true).Dmg;
                Must(g.ReadTownStars() && !g.ReadTownStars(), "同日只能啟用一次星象");
                Must(Math.Abs(g.Player.RollDmg(1, true).Dmg / baseline - 1.1) < 0.001, "星象影響實際傷害");
                date = date.AddDays(1);
                Must(!g.TownStarActive && g.ReadTownStars(), "星象跨午夜失效並可重新啟用");
                g.Player.SetForm("star");

                Place(g, 1710, 440);
                g.Input.KeyDown("KeyJ");
                Step(g, 173);
                g.Input.KeyUp("KeyJ");
                Must(g.TownTrainingDamage > 0 && g.TownTrainingTime > 0 && g.Kills == 0, "實際按攻擊命中木樁，有統計且不算擊殺");
                Step(g, 630);
                Must(g.TownTrainingDone && g.TownTrainingTime == 0 && g.TownTrainingDps > 0, "練習十秒結算 DPS");
                Place(g, 1640, 440);
                g.Input.KeyDown("KeyJ"); Step(g, 30); g.Input.KeyUp("KeyJ");
                Must(g.Player.State != "attack", "練習場外不能攻擊");

                Place(g, 1816, 440);
                int scrap = g.Scrap;
                Must(g.StartTownRace() && g.TownRaceClock < 0, "比賽從三秒倒數開始");
                Step(g, 182);
                Walk(g, 2166, 400);
                Climb(g, 287, 180);
                Walk(g, 2192, 50);
                Climb(g, 140, 180);
                Walk(g, 1507, 440);
                Must(g.TownRaceSeconds > 0 && g.TownRaceResult != null && g.Scrap == scrap + 10, "從起跑旗實走到觀星台並記錄首次獎勵");
                Must(g.StartTownRace() && g.TravelTown("upper") && g.TownRaceClock == null, "傳送會取消計時");

                Must(g.TravelTown("sewer") && g.TownSewerJunkLeft >= 3 && g.TownSewerJunkLeft <= 5, "每天三到五個下水道拾荒點");
                int expected = g.TownSewerJunkLeft;
                foreach (int x in new[] { 538, 714, 1018, 1184, 1420 }) { Place(g, x, 528); Step(g, 2); }
                Must(g.TownSewerJunkLeft == 0 && g.Inv.Count(it => it.Kind == "junk") == expected, "垃圾透過正式背包流程拾取");
                Must(g.OpenTownCache("cache-west") && g.OpenTownCache("cache-east") && !g.OpenTownCache("cache-east"), "兩口藏寶箱各領一次");
                Must(g.Map.SolidAt(1538, 500) && g.OpenTownSewerWall() && !g.Map.SolidAt(1538, 500), "裂牆互動後移除碰撞");
                Place(g, 1652, 528); Step(g, 1);
                Must(g.NearNow?.Id == "inscription", "石室碑文可互動");

                g.Cleared_.UnionWith(new[] { "1-1", "1-3" });
                Must(g.TownUnreadLetters == 2, "每個首通關卡有一封信");
                g.ReadTownLetter("1-1");
                Must(g.TownUnreadLetters == 1, "已讀郵件更新未讀數");
                g.TownWishLuck = true;
                double best = g.TownRaceSeconds.Value;
                var restored = new Game("town");
                SaveData.Apply(restored, SaveData.ToJson(g));
                Must(restored.TownWishLuck && restored.TownRaceSeconds == best && restored.TownCacheOpened("cache-west")
                    && restored.TownCacheOpened("cache-east") && restored.TownWallOpened
                    && restored.TownUnreadLetters == 1 && restored.TownSewerJunkLeft == 0, "完整存檔往返");
                date = date.AddDays(1);
                Must(restored.TownSewerJunkLeft >= 3 && restored.TownSewerJunkLeft <= 5, "每日垃圾跨日重刷");
                var adventure = new Game("1-1", restored);
                Must(adventure.TownWishLuck, "好運帶入關卡");
                adventure.Clear();
                Must(!adventure.TownWishLuck, "通關才清除下次冒險好運");
                Debug.Log("[TownActivity] PASS: daily wishes and stars, bell, real training hits, full climbing race, sewer and mail save");
            }
            finally { Game.TownLocalDate = previousDate; TownArt.DayOverride = previousDay; }
        }

        static void Must(bool value, string message) { if (!value) throw new InvalidOperationException(message); }
        static void Place(Game g, int x, int y)
        {
            g.Input.ReleaseAll();
            g.SetTestPosition(new Vector2(x, y));
            g.Player.Vx = g.Player.Vy = 0;
            g.Player.Grounded = true;
        }
        static void Step(Game game, int ticks)
        {
            for (int i = 0; i < ticks; i++)
            {
                game.RunTimers();
                game.Tick(Game.STEP);
                game.SimMs += 1000.0 / 60;
            }
        }
        static void Walk(Game g, int x, int limit)
        {
            int sign = x >= g.Player.X ? 1 : -1;
            string key = sign > 0 ? "KeyD" : "KeyA";
            g.Input.KeyDown(key);
            for (int i = 0; i < limit && (x - g.Player.X) * sign > 2; i++) Step(g, 1);
            g.Input.KeyUp(key);
            Must(Math.Abs(g.Player.X - x) <= 4, $"實走沒有到 {x}，實際 {g.Player.X},{g.Player.Y}");
            Step(g, 8);
        }
        static void Climb(Game g, int y, int limit)
        {
            g.Input.KeyDown("KeyW");
            for (int i = 0; i < limit && (g.Player.Y != y || !g.Player.Grounded); i++) Step(g, 1);
            g.Input.KeyUp("KeyW");
            Must(g.Player.Y == y && g.Player.Grounded, $"爬到 {y} 失敗，實際 {g.Player.X},{g.Player.Y}");
            Step(g, 12);
        }
    }
}
