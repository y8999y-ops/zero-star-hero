using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using PixelFX;

namespace ZeroStar
{
    public partial class Game
    {
        readonly struct TownActivity
        {
            public readonly string Id, Name, Project;
            public readonly int X, Y, Head;
            internal TownActivity(string id, string name, string project, int x, int y, int head)
            { Id = id; Name = name; Project = project; X = x; Y = y; Head = head; }
        }

        static readonly IReadOnlyList<TownActivity> TownActivityPlaces = Array.AsReadOnly(new[]
        {
            new TownActivity("mail", "碎星鎮郵筒", null, 453, 440, 25),
            new TownActivity("wish", "許願池", "plaza", 743, 440, 39),
            new TownActivity("bell", "鐘樓頂", "tower", 705, 140, 24),
            new TownActivity("stars", "觀星望遠鏡", "star", 1432, 140, 29),
            new TownActivity("race-start", "攀爬賽起點", "tree", 1816, 440, 33),
            new TownActivity("race-end", "攀爬賽終點", "star", 1507, 140, 33),
            new TownActivity("cache-west", "西側藏寶箱", "sewer", 450, 528, 18),
            new TownActivity("cache-east", "東側藏寶箱", "sewer", 1348, 528, 18),
            new TownActivity("crack", "裂開的牆", "sewer", 1536, 528, 36),
            new TownActivity("inscription", "坑底碑文", "sewer", 1652, 528, 35),
        });

        public readonly struct TownConstellation
        {
            public readonly string Name, Text, Form;
            internal TownConstellation(string name, string text, string form)
            { Name = name; Text = text; Form = form; }
        }
        static readonly TownConstellation[] skies =
        {
            new TownConstellation("墜星", "星靈形態傷害 +10%", "star"),
            new TownConstellation("黏液弧", "史萊姆形態傷害 +10%", "slime"),
            new TownConstellation("夜翼", "蝠翼星形態傷害 +10%", "bat"),
            new TownConstellation("鐵環", "鐵罐星形態傷害 +10%", "can"),
            new TownConstellation("刺冠", "刺刺星形態傷害 +10%", "spike"),
            new TownConstellation("拾荒者", "垃圾掉落機率 +20%", null),
        };
        public static Func<DateTime> TownLocalDate = () => DateTime.Now;
        static long DayIndex => TownLocalDate().Date.Ticks / TimeSpan.TicksPerDay;
        public string TownToday => TownLocalDate().ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        public TownConstellation TodayConstellation => skies[(int)(DayIndex % skies.Length)];
        public int TownConstellationIndex => (int)(DayIndex % skies.Length);
        public bool TownWishUsed => TownWishDate != null && TownWishDate == TownToday;
        public bool TownStarActive => TownStarDate != null && TownStarDate == TownToday;
        internal double TownDamageFactor => TownStarActive && TodayConstellation.Form == Player.Form ? 1.10 : 1;
        internal double TownJunkFactor => !Town && TownStarActive && TodayConstellation.Form == null ? 1.20 : 1;
        internal double TownLootFactor => !Town && !Endless && TownWishLuck ? 1.10 : 1;

        public bool TownWishLuck, TownWallOpened;
        public bool TownBellPreview { get; private set; }
        public int TownSewerCaches, TownSewerTaken;
        public string TownSewerDate;
        public readonly HashSet<string> TownReadLetters = new HashSet<string>();
        public IEnumerable<string> TownLetters => Cleared_.Where(id => QuestBook.LAYOUT_NAME.ContainsKey(id)).OrderBy(id => id);
        public int TownUnreadLetters => TownLetters.Count(id => !TownReadLetters.Contains(id));
        public const int WishCost = 10;
        const int CrackX = 1536, DummyX = 1730;
        public int TownDummyX => DummyX;
        public bool TownTrainingZone => Town && IsTownBuilt("tree") && !TownRaceClock.HasValue && Math.Abs(Player.X - DummyX) < 47
            && Player.Y >= TownArt.FLOOR - 72 && Player.Y <= TownArt.FLOOR;
        public double TownTrainingTime { get; private set; }
        public double TownTrainingDamage { get; private set; }
        public bool TownTrainingDone { get; private set; }
        public double TownTrainingDps => TownTrainingDamage / Math.Max(0.1, TownTrainingDone ? 10 : 10 - TownTrainingTime);
        double trainingEnd, trainingFlash;
        public double? TownRaceClock { get; private set; }
        public bool TownCanRace => Town && IsTownBuilt("tree") && IsTownBuilt("star");
        public string TownRaceResult { get; private set; }
        double raceResultTime;
        string townLayoutDate;
        readonly List<Drops.Drop> sewerPickups = new List<Drops.Drop>(5);
        static readonly int[] sewerPickupX = { 538, 714, 1018, 1184, 1420 };

        internal void CarryTownActivities(Game prior)
        {
            TownWishDate = prior.TownWishDate; TownStarDate = prior.TownStarDate; TownRaceSeconds = prior.TownRaceSeconds;
            TownWishLuck = prior.TownWishLuck; TownWallOpened = prior.TownWallOpened;
            TownSewerCaches = prior.TownSewerCaches; TownSewerTaken = prior.TownSewerTaken; TownSewerDate = prior.TownSewerDate;
            TownReadLetters.UnionWith(prior.TownReadLetters);
            if (prior.TownBellPreview) TownArt.DayOverride = null;
        }

        bool ActivityOpen(TownActivity a)
        {
            if (a.Project != null && !IsTownBuilt(a.Project)) return false;
            return a.Id switch
            {
                "crack" => !TownWallOpened,
                "inscription" => TownWallOpened,
                "race-end" => TownCanRace,
                _ => true,
            };
        }

        Near NearbyTownActivity(double x, double y)
        {
            foreach (var a in TownActivityPlaces)
                if (ActivityOpen(a) && Math.Abs(a.X - x) < (a.Id == "crack" ? 25 : 18) && Math.Abs(a.Y - y) < 13)
                    return new Near { Id = a.Id, Name = a.Name, Place = "town-activity", X = a.X, FootY = a.Y, Hgt = a.Head };
            return null;
        }

        public string MakeTownWish()
        {
            if (!Town || !IsTownBuilt("plaza") || TownWishUsed || Money < WishCost) return null;
            TownWishDate = TownToday;
            Money -= WishCost;
            int roll = (int)(Rnd.Next() * 3);
            string text;
            if (roll == 0)
            {
                int gold = 30 + (int)(Rnd.Next() * 51);
                Money += gold; text = $"金幣 +{gold}";
            }
            else if (roll == 1 || TownWishLuck)
            {
                int scrap = 3 + (int)(Rnd.Next() * 6);
                Scrap += scrap; text = $"星塵 +{scrap}";
            }
            else { TownWishLuck = true; text = "下次冒險掉寶率 +10%"; }
            TownMoment("wish", 757, TownArt.FLOOR - 48);
            Sfx("coin");
            After(560, () => { Sfx("splash"); Say.Show($"許願回音　{text}", 2.7); });
            OnTownBuilt?.Invoke(); // 同一個城鎮存檔入口。
            return text;
        }

        public void RingTownBell()
        {
            if (!Town || !IsTownBuilt("tower")) return;
            if (TownBellPreview) TownArt.DayOverride = null;
            else TownArt.DayOverride = ((int)Math.Floor(TownArt.DayInfo().p * 4) + 1) % 4 * 0.25;
            TownBellPreview = !TownBellPreview;
            Sfx("chime:392");
            After(115, () => Sfx("chime:587"));
            After(250, () => Sfx("chime:784"));
            TownMoment("bell", 617, 101);
            string period = TownBellPreview ? new[] { "日出", "中午", "日落", "半夜" }[(int)(TownArt.DayOverride.Value * 4)] : "即時天色";
            Say.Show(period, 2.1);
        }

        public bool ReadTownStars()
        {
            if (!Town || !IsTownBuilt("star") || TownStarActive) return false;
            TownStarDate = TownToday;
            Sfx("chime:988");
            TownMoment("stars", 1461, 94);
            Say.Show(TodayConstellation.Text, 2.4);
            OnTownBuilt?.Invoke();
            return true;
        }

        public bool StartTownRace()
        {
            if (!TownCanRace || TownRaceClock.HasValue) return false;
            TownRaceClock = -3;
            TownRaceResult = null;
            return true;
        }

        public void CancelTownRace()
        {
            if (!TownRaceClock.HasValue) return;
            TownRaceClock = null;
            TownRaceResult = "計時已取消";
            raceResultTime = 2.5;
        }

        void FinishTownRace()
        {
            if (!(TownRaceClock > 0)) return;
            double result = TownRaceClock.Value;
            bool first = !TownRaceSeconds.HasValue;
            bool best = first || result < TownRaceSeconds.Value;
            if (best) TownRaceSeconds = result;
            if (first) Scrap += 10;
            TownRaceClock = null;
            TownRaceResult = $"{(best ? "新紀錄" : "抵達終點")}　{result:0.00} 秒{(first ? "　星塵 +10" : "")}";
            raceResultTime = 6;
            Sfx("pickup");
            TownMoment("stars", 1507, 110);
            OnTownBuilt?.Invoke();
        }

        public bool TownCacheOpened(string id) => (TownSewerCaches & (id == "cache-west" ? 1 : 2)) != 0;
        public bool OpenTownCache(string id)
        {
            if (!TownUnderground || !IsTownBuilt("sewer") || (id != "cache-west" && id != "cache-east") || TownCacheOpened(id)) return false;
            TownSewerCaches |= id == "cache-west" ? 1 : 2;
            Money += 90; Scrap += 8;
            var a = TownActivityPlaces.First(p => p.Id == id);
            Sfx("chest"); TownMoment("cache", a.X, a.Y - 13);
            Say.Show("找到藏寶　金幣 +90　星塵 +8", 2.6);
            OnTownBuilt?.Invoke();
            return true;
        }

        public bool OpenTownSewerWall()
        {
            if (!TownUnderground || !IsTownBuilt("sewer") || TownWallOpened) return false;
            Map.SetSolid(TownCrackedWall, false);
            TownWallOpened = true;
            Sfx("crate");
            Fx.Shake(0.18, 2);
            Dust(CrackX + 4, SewerFloor - 12, 12);
            TownMoment("cache", CrackX, SewerFloor - 26);
            Say.Show("石牆崩開，後面露出一間舊石室。", 2.7);
            OnTownBuilt?.Invoke();
            return true;
        }

        static RectD TownCrackedWall => new RectD { X = CrackX, Y = SewerCeiling, W = 8, H = SewerFloor - SewerCeiling };
        void SyncTownActivityCollision()
        {
            if (Town && IsTownBuilt("sewer")) Map.SetSolid(TownCrackedWall, !TownWallOpened);
        }

        internal void RefreshLoadedTownActivities()
        {
            townLayoutDate = null;
            sewerPickups.Clear();
            SyncTownActivityCollision();
        }

        public void ReadTownLetter(string id)
        {
            if (Town && TownLetters.Contains(id) && TownReadLetters.Add(id))
            {
                Sfx("ui");
                OnTownBuilt?.Invoke();
            }
        }

        void PrepareSewerJunk()
        {
            string date = TownToday;
            if (townLayoutDate == date) return;
            townLayoutDate = date;
            sewerPickups.Clear();
            long day = DayIndex;
            int total = 3 + (int)(day % 3);
            for (int i = 0; i < total; i++)
            {
                var kind = Items.JUNK[(int)((day + i * 3) % Items.JUNK.Length)];
                int x = sewerPickupX[(i + (int)(day % 5)) % 5];
                sewerPickups.Add(new Drops.Drop { X = x, Y = SewerFloor, Landed = true,
                    Item = new Item { Uid = $"sewer-{date}-{i}", Kind = "junk", Junk = kind.id, Name = kind.name, Icon = kind.icon, Rarity = Items.COMMON, Ilvl = 1 } });
            }
        }
        public int TownSewerJunkLeft
        {
            get
            {
                if (!IsTownBuilt("sewer")) return 0;
                PrepareSewerJunk();
                return Enumerable.Range(0, sewerPickups.Count).Count(i => (SewerTakenToday & (1 << i)) == 0);
            }
        }
        int SewerTakenToday => TownSewerDate == townLayoutDate ? TownSewerTaken : 0;

        void TickTownActivities(double dt)
        {
            trainingFlash = Math.Max(0, trainingFlash - dt);
            if (TownTrainingTime > 0)
            {
                TownTrainingTime = Math.Max(0, TownTrainingTime - dt);
                if (TownTrainingTime == 0) { trainingEnd = 4; TownTrainingDone = true; }
            }
            else trainingEnd = Math.Max(0, trainingEnd - dt);
            if (raceResultTime > 0 && (raceResultTime -= dt) <= 0) TownRaceResult = null;
            if (TownBusy) return;
            if (TownRaceClock is double clock)
            {
                TownRaceClock = clock + dt;
                int was = Math.Max(0, (int)Math.Ceiling(-clock)), now = Math.Max(0, (int)Math.Ceiling(-TownRaceClock.Value));
                if (now < was) Sfx(now == 0 ? "chime:988" : "chime:494");
                if (Player.Grounded && Math.Abs(Player.X - 1507) < 15 && Math.Abs(Player.Y - 140) < 3)
                    FinishTownRace();
            }
            if (!TownUnderground || !IsTownBuilt("sewer")) return;
            PrepareSewerJunk();
            for (int i = 0; i < sewerPickups.Count; i++)
            {
                var drop = sewerPickups[i]; int mask = 1 << i;
                if ((SewerTakenToday & mask) != 0 || Math.Abs(Player.X - drop.X) >= 13 || Math.Abs(Player.Y - drop.Y) >= 14) continue;
                if (!PickUp(drop)) continue;
                TownSewerTaken = SewerTakenToday | mask;
                TownSewerDate = townLayoutDate;
                SpawnLive("collect-burst", drop.X, drop.Y - 12, new FxOptions { Light = 0.3 });
                OnTownBuilt?.Invoke();
            }
        }

        public bool ShowTownTrainingResult => TownTrainingTime > 0 || trainingEnd > 0;
        int HitTownDummy(Box box, Func<Roll> damage)
        {
            if (!TownTrainingZone || !box.Overlaps(new Box(DummyX - 8, DummyX + 8, TownArt.FLOOR - 39, TownArt.FLOOR - 9))) return 0;
            var roll = damage();
            int hp = Math.Max(1, (int)Pf.Round(roll.Dmg));
            if (TownTrainingTime == 0 && trainingEnd == 0)
            {
                TownTrainingTime = 10; TownTrainingDamage = 0; TownTrainingDone = false;
            }
            if (TownTrainingTime > 0) TownTrainingDamage += hp;
            Combat.Damage(dummy, DummyX, TownArt.FLOOR - 44, hp, roll.Crit, false);
            SpawnLive("hit-spark", DummyX, TownArt.FLOOR - 25, new FxOptions { Light = 0.35, Seed = (int)(SimMs % 1000) });
            Sfx(roll.Crit ? "crit" : "clank");
            trainingFlash = 0.16;
            return 1;
        }
        readonly Dummy dummy = new Dummy();
        sealed class Dummy : IBoxed
        {
            public bool Dead => false;
            public double X => DummyX;
            public (double x0, double x1, double y0, double y1) Box() => (DummyX - 8, DummyX + 8, TownArt.FLOOR - 39, TownArt.FLOOR);
        }

        void TownMoment(string kind, double x, double y)
        {
            SpawnLive("town-activity", x, y, new FxOptions { Light = 0.5 }
                .Set("mode", kind == "wish" ? 0 : kind == "bell" ? 1 : kind == "stars" ? 2 : 3));
        }
    }
}
