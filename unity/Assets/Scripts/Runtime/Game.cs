// 遊戲本體（main.js 的 tick、render、world、鏡頭）：階段 1 的子集——1-1 的地形、主角、史萊姆、火把、戰鬥特效。
// 不碰 Unity 的東西（畫面、按鍵），所以比對測試可以在編輯器裡直接跑同一份程式。
using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using PixelFX;

namespace ZeroStar
{
    /// 量時間（開發用）：Prof.On＝true 時，記下每一段花多少毫秒
    public static class Prof
    {
        public static bool On;
        public static readonly Dictionary<string, double> Ms = new Dictionary<string, double>();
        static readonly System.Diagnostics.Stopwatch sw = new System.Diagnostics.Stopwatch();
        public static void Mark(string name)
        {
            if (!On) return;
            if (name != null) { Ms.TryGetValue(name, out var v); Ms[name] = v + sw.Elapsed.TotalMilliseconds; }
            sw.Restart();
        }
    }

    public class Game : IWorld
    {
        public static int W = 384;
        public const int H = 216;
        public const double STEP = 1 / 60.0, ZOOM = 1.38;
        public static readonly int VIEW_DY = (int)Pf.Round(0.05 * H / ZOOM);

        public readonly LevelData Data;
        public readonly LevelArt Art;
        public GameMap Map { get; }
        public FxSystem Fx { get; } = new FxSystem();
        public CombatFx Combat { get; } = new CombatFx();
        public GameInput Input { get; } = new GameInput();
        public double SimMs { get; set; }
        public readonly Player Player;
        public readonly List<Enemy> Enemies = new List<Enemy>();
        public double CamX, CamY;
        double lookX, sceneClock;
        double? camRefY, camLand;
        public int Kills, Coins, Combo; public double ComboT;
        public readonly Status Status;
        public readonly Ult Ult;
        double ultCd;
        public Action Vibrate;
        public double UltPassive() => Player.Form == "star" ? 1 + 0.04 * Rank("star", "p_star") : 1;
        /// 技能樹：形態 → 節點 → 點了幾級（skilltree.js 的 rank）
        public readonly Dictionary<string, int> Tree = new Dictionary<string, int>();
        [Serializable] class TreeNode { public string form, id, name; public int max, path; }
        [Serializable] class TreeList { public TreeNode[] nodes; }
        /// 技能樹全部點滿（比對測試、開發用）
        public void MaxTree() { foreach (var n in JsonUtility.FromJson<TreeList>(Baked.Text("tree")).nodes) Tree[n.form + ":" + n.id] = n.max; }
        public int Rank(string form, string id) => Tree.TryGetValue(form + ":" + id, out var r) ? r : 0;
        // 技能樹的效果物件
        public class Wave { public double X, Y, Dir, T, Seed; public HashSet<Enemy> Hit = new HashSet<Enemy>(); }
        public class Mini { public double X, Y, Vx, Vy, T, Life, Cd, Seed; }
        public readonly List<Wave> Waves = new List<Wave>();
        public readonly List<Mini> Minis = new List<Mini>();
        double swarmT, originT = -9;
        // ---- 裝備（存檔的 profile.equip、profile.lv；存檔系統在階段 5 才搬）
        public readonly Dictionary<string, Item> Equip = new Dictionary<string, Item> { ["weapon"] = null, ["head"] = null, ["body"] = null, ["hands"] = null, ["feet"] = null, ["acc1"] = null, ["acc2"] = null };
        public int Lv = 1, Xp, Money, Scrap;
        public readonly List<Item> Inv = new List<Item>();
        public readonly Dictionary<string, int> FormsOwned = new Dictionary<string, int> { ["star"] = 0 };   // 吸收過的形態 → 多出來的靈核
        public readonly Drops Drops = new Drops();
        public readonly Coins CoinList = new Coins();
        static readonly Dictionary<string, double> KILL_XP = new Dictionary<string, double> { ["slime"] = 5, ["bat"] = 5, ["trash"] = 12, ["gold"] = 20, ["hog"] = 9 };
        static readonly Dictionary<string, double> DROP_RATE = new Dictionary<string, double> { ["slime"] = 0.1, ["bat"] = 0.1, ["trash"] = 0.35, ["gold"] = 1, ["hog"] = 0.2 };
        const double ABSORB_T = 1;
        double? absorbHp; public Drops.Drop AbsorbNear;
        int IlvlNow(int bonus = 0) => Lv + bonus + (int)Math.Floor(Rnd.Next() * 2);
        /// 經驗：升級＝數值重算、生命全滿、金色光柱
        public void GainXp(double n)
        {
            if (Lv >= Items.MAX_LV) return;
            Xp += (int)n;
            bool up = false;
            while (Lv < Items.MAX_LV && Xp >= Items.XpNeed(Lv)) { Xp -= (int)Items.XpNeed(Lv); Lv++; up = true; }
            if (!up) return;
            Sfx("levelup");
            ApplyStats();
            Player.Hp = Player.MaxHp;
            SpawnLive("level-up", Pf.Round(Player.X), Pf.Round(Player.Y), new FxOptions { Light = 0.45, Seed = Lv });
            SceneLight.AddFlash(Player.X, Player.Y - 12, 90, 3, 0.8, "#ffd84a");
            OnSay?.Invoke($"升級！Lv {Lv}　生命全滿");
        }
        /// 在 (x, y) 掉一件東西。minR＝保底稀有度
        public void DropItem(double x, double y, int minR = 0, int? ilvl = null, int? rarity = null)
        {
            int r = rarity ?? Items.RollRarity(Player.S.Mf, minR);
            var item = Items.MakeItem(ilvl ?? IlvlNow(), r);
            Drops.Add(item, x, y);
            if (item.Rarity == Items.LEGEND) { SceneLight.AddFlash(x, y, 110, 4, 1, "#ff8a2a"); Fx.HitStop(0.12); Fx.Shake(0.4, 3); }
            else if (item.Rarity == Items.EPIC) { SceneLight.AddFlash(x, y, 90, 3, 0.6, "#b878ff"); Fx.Shake(0.25, 2); Fx.HitStop(0.06); }
            else if (item.Rarity == Items.RARE) Fx.Shake(0.15, 2);
        }
        /// 撿起來（背包滿了回傳 false；魔物核要按住吸收）
        bool PickUp(Drops.Drop d)
        {
            if (d.Item.Kind == "formcore") return false;
            var it = d.Item;
            if (Inv.Count >= Items.BAG_SIZE) return false;
            it.New = true;
            Inv.Add(it);
            if (it.Kind == "junk" && Rnd.Next() < 0.4) OnSay?.Invoke(Items.JUNK.First(j => j.id == it.Junk).say);
            Sfx(it.Rarity >= Items.RARE ? "rare" : "pickup");
            if (it.Rarity >= Items.RARE) SpawnLive("collect-burst", Pf.Round(Player.X), Pf.Round(Player.Y) - 10, new FxOptions { Palette = it.Rarity == Items.LEGEND ? Col.PAL["ember"] : new[] { "#1e1206", "#4a2c08", "#86520c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff" }, Light = 0.4 });
            OnPickup?.Invoke(it);
            return true;
        }
        public Action<Item> OnPickup;
        /// 開發用：背包裡比身上好的裝備換上去
        public int EquipBetter()
        {
            int n = 0;
            foreach (var it in Inv.ToList())
            {
                var c = Items.Compare(it, Equip, Lv);
                if (c == null || !c.Value.better) continue;
                var old = Equip[c.Value.slot]; Equip[c.Value.slot] = it; Inv.Remove(it); if (old != null) Inv.Add(old); n++;
            }
            if (n > 0) { ApplyStats(); OnSay?.Invoke($"換上 {n} 件更好的裝備"); }
            return n;
        }
        /// 魔物核：站在旁邊按住吸收鍵 1 秒（被打會中斷）
        void UpdateAbsorb(double dt)
        {
            var cores = Drops.List.Where(d => d.Item.Kind == "formcore" && d.Landed && d.T > 0.45 && !d.Got).ToList();
            Drops.Drop near = null;
            foreach (var d in cores) if (Math.Abs(d.X - Player.X) < 26 && Math.Abs(d.Y - Player.Y) < 30 && (near == null || Math.Abs(d.X - Player.X) < Math.Abs(near.X - Player.X))) near = d;
            AbsorbNear = near;
            bool hit = absorbHp != null && Player.Hp < absorbHp;
            absorbHp = Player.Hp;
            foreach (var d in cores) if (d != near && d.Hold != 0) d.Hold = Math.Max(0, d.Hold - dt * 3);
            if (near == null) return;
            if (hit && near.Hold > 0) { near.Hold = 0; Sfx("close"); OnSay?.Invoke("系統：被打斷了！核掉回地上了。"); return; }
            if (Input.Absorb && !Ult.On)
            {
                near.Hold = Math.Min(1, near.Hold + dt / ABSORB_T);
                if (near.Hold >= 1) { near.Got = true; Absorb(near.Item); }
            }
            else near.Hold = Math.Max(0, near.Hold - dt * 3);
        }
        static readonly Dictionary<string, string> FORM_NAME = new Dictionary<string, string> { ["star"] = "星星", ["slime"] = "黏液星", ["bat"] = "蝠翼星", ["spike"] = "尖刺星", ["can"] = "鐵罐星" };
        void Absorb(Item it)
        {
            bool unlocked = !FormsOwned.ContainsKey(it.Form);
            if (unlocked) FormsOwned[it.Form] = 0; else FormsOwned[it.Form]++;
            Sfx("absorb");
            SpawnLive("collect-burst", Pf.Round(Player.X), Pf.Round(Player.Y) - 12, new FxOptions { Palette = FORM_BURST[it.Form], Light = 0.7 });
            SpawnLive("collect-burst", Pf.Round(Player.X), Pf.Round(Player.Y) - 12, new FxOptions { Palette = FORM_BURST[it.Form], Light = 0.4, Seed = 7 }, 0.7);
            SceneLight.AddFlash(Player.X, Player.Y - 12, 120, 4, 0.9, FORM_COLOR[it.Form]);
            Fx.Shake(0.18, 2.5);
            OnSay?.Invoke(unlocked ? $"系統：吸收了{FORM_NAME[it.Form]}的靈核！新形態「{FORM_NAME[it.Form]}」。" : $"靈核 +1（{FORM_NAME[it.Form]}）");
        }
        public void ApplyStats() => Player.SetStats(Items.ComputeStats(Equip, Lv));
        Item MythOn(string id) { foreach (var it in Equip.Values) if (it?.Myth == id) return it; return null; }
        // 裝備效果的物件
        public class Strike { public double X, Y, T, Mult = 0.8; public Enemy E; public bool Done; }
        public readonly List<Strike> Strikes = new List<Strike>();
        public readonly List<CoreFx.TrailPt> Trail = new List<CoreFx.TrailPt>();
        HashSet<Enemy> comet;
        double noisyT = 4, combatT, idleT; int boomDepth;
        static readonly (string line, string stat)[] NOISY = { ("系統（星核）：拜託你認真打好嗎。給你攻擊 +30%。", "atk"), ("系統（星核）：太慢了啦！攻速 +30%，快點！", "spd"), ("系統（星核）：跑起來！移速 +30%！", "move"), ("系統（星核）：……我不想講話。攻擊 +30%，自己看著辦。", "atk") };
        public Action<string> OnSay;   // 系統的話（介面在階段 4）
        static readonly string[] LAVA = { "#14060a", "#380a10", "#6e1210", "#ac2410", "#e8501a", "#ff8c2a", "#ffd25a" };

        /// 傳說：很吵的星核（每 10 秒吐槽＋隨機增益）、通宵委託單（戰鬥越久傷害越高）
        void UpdateUniques(double dt)
        {
            if (Player.Has("noisy") && (noisyT -= dt) <= 0)
            {
                noisyT = 10;
                var (line, stat) = NOISY[(int)Math.Floor(Rnd.Next() * NOISY.Length)];
                Player.BuffAtk = 0; Player.BuffSpd = 0; Player.BuffMove = 0;
                if (stat == "atk") Player.BuffAtk = 0.3; else if (stat == "spd") Player.BuffSpd = 0.3; else Player.BuffMove = 0.3;
                Player.BuffT = Player.Core("noisy") != 0 ? Player.Core("noisy") : 5;
                OnSay?.Invoke(line);
            }
            bool fighting = Enemies.Exists(e => !e.Dead && e.Kind != "gold" && Math.Abs(e.X - Player.X) < 220 && Math.Abs(e.Y - Player.Y) < 140);
            idleT = fighting ? 0 : idleT + dt;
            combatT = fighting ? combatT + dt : idleT > 3 ? 0 : combatT;
            Player.DmgMul = Player.Has("overtime") ? 1 + Math.Min(1, Math.Floor(combatT / 10) * 0.05) : 1;
        }
        /// 星核：暈眩倒數、被打飛的撞到別隻（沉重）、彗尾
        void UpdateCoreFx(double dt)
        {
            foreach (var e in Enemies.ToArray())
            {
                if (e.DizzyT > 0) e.DizzyT -= dt;
                if (!(e.FlungT > 0) || e.Dead) continue;
                e.FlungT -= dt;
                if (Math.Abs(e.Vx) < 40) continue;
                foreach (var o in Enemies.ToArray()) if (!o.Dead && !e.FlungHit.Contains(o) && e.HitBox().Overlaps(o.HitBox())) { e.FlungHit.Add(o); o.Hit(new Roll { Dmg = e.FlungDmg, Crit = false }, Math.Sign(e.Vx), new HitOpts { Push = 3 }, this); }
            }
            double x = Player.Core("comet");
            if (comet != null && Player.State == "dash" && x != 0) Trail.Add(new CoreFx.TrailPt { X = Player.X, Y = Player.Y - 10, T = 0, Seed = Trail.Count * 7 + Pf.ToInt32(sceneClock * 60) });
            else if (Player.State != "dash") comet = null;
            foreach (var p in Trail)
            {
                p.T += dt;
                if (comet == null || p.T > 0.45) continue;
                foreach (var e in Enemies.ToArray()) if (!e.Dead && !comet.Contains(e) && new Box(p.X - 6, p.X + 6, p.Y - 14, p.Y + 10).Overlaps(e.HitBox())) { comet.Add(e); e.Hit(Player.RollDmg(x / 100), Player.Face, new HitOpts { Push = 1 }, this); }
            }
            Trail.RemoveAll(p => p.T > CoreFx.TRAIL_T);
        }
        /// 暴擊打中時：星核「尖銳」多打一次；流星獵手 4 件：流星記號，5 秒內再暴擊 → 小流星
        void OnCritHit(Enemy e, Roll r)
        {
            if (r.Crit && Player.Core("sharp") != 0 && !e.Dead) e.Hit(new Roll { Dmg = r.Dmg * Player.Core("sharp") / 100, Crit = false }, Player.Face, new HitOpts { Push = 0 }, this);
            if (!r.Crit || !Player.Set4("meteor")) return;
            if (e.MeteorMark > 0) { e.MeteorMark = 0; Strikes.Add(new Strike { X = e.X, Y = (e.Box().y0 + e.Box().y1) / 2, T = 0, E = e }); }
            else e.MeteorMark = 5;
        }
        /// 墜落之心：切換形態時，原地爆出前一個形態的元素
        void HeartBurst(string from)
        {
            var it = MythOn("fallheart");
            if (it == null) return;
            int st = Items.AwakenStage(it); double r = st >= 2 ? 60 : 40, mult = st >= 3 ? 1.6 : 0.8;
            string el = Player.ELEM.TryGetValue(from, out var e0) ? e0 : null;
            string[] pal = el == "burn" ? new[] { "#4a1712", "#c9281f", "#f2561d", "#ff8a2a", "#ffc23d", "#ffe26b", "#fff3a6", "#ffffff" }
                : el == "slime" ? POISON : el == "shock" ? new[] { "#0c2a60", "#1e64b0", "#3ab8f0", "#9af0ff", "#f0ffff", "#ffffff" }
                : el == "poison" ? new[] { "#1a0a2a", "#3e1466", "#6a28a8", "#8ae040", "#e8ff70", "#ffffff" } : Col.PAL["gold"];
            SpawnLive("plasma-explosion", Pf.Round(Player.X), Pf.Round(Player.Y - 10), new FxOptions { Palette = pal, Accent = pal, Light = 0.6, Seed = Pf.ToInt32(Rnd.Next() * 99) }, 1.6);
            SceneLight.AddFlash(Player.X, Player.Y - 10, r * 2, 3, 0.3, pal[4]);
            HitArea(new Box(Player.X - r, Player.X + r, Player.Y - r, Player.Y + 10), () => Player.RollDmg(mult), Player.Face, new HitOpts { Push = 3, Elem = el });
        }
        /// 神話：穿著累積擊殺，覺醒
        void MythKill()
        {
            foreach (var it in Equip.Values)
            {
                if (it?.Myth == null) continue;
                int before = Items.AwakenStage(it);
                it.AwakenKills++;
                int after = Items.AwakenStage(it);
                if (after > before)
                {
                    OnSay?.Invoke($"{it.Name} 覺醒到第 {after} 階！");
                    SceneLight.AddFlash(Player.X, Player.Y - 14, 120, 4, 0.6, "#fff0a0"); Fx.Shake(0.3, 3); Sfx("levelup");
                    SpawnLive("level-up", Pf.Round(Player.X), Pf.Round(Player.Y), new FxOptions { Light = 0.55, Seed = after * 7, Palette = new[] { "#2a1405", "#5c3008", "#9a5a0e", "#d48e18", "#f5b92c", "#ffde5e", "#fff4bc", "#ffffff" } }.Set("text", "AWAKEN!"));
                    ApplyStats();
                }
            }
        }
        static readonly string[] METAL7 = { "#14161c", "#2a2e38", "#4a5468", "#6e7a90", "#9aa6ba", "#d0d8e6", "#ffffff" };
        public readonly List<Shot> Shots = new List<Shot>();
        public class Shot { public double X, Y, Dir, Vy, Life, Mult = 1; public string Form; public bool Small, Done; public FxRun Fx; public Enemy Skip; }
        const double COMBO_T = 4.4, FORM_CD = 1;
        double formCdUntil = -9;
        public string PendingForm;   // 換形態（按鍵或操作錄影）
        public string[] Carry = { "star", "slime", "bat", "can", "spike" };   // 帶在身上的形態（階段 2：全部都有）
        static readonly string[] POISON = { "#0d1a0c", "#173a14", "#265e18", "#3f8a1e", "#6cb82a", "#a8e04a", "#e0ff8a" };   // pixelfx PAL.poison
        static readonly string[] LEAF = { "#0c1a0e", "#163418", "#225224", "#357530", "#4f9a3a", "#7cc048", "#b4e070", "#e4ffb0" };   // pixelfx PAL.leaf
        // 技能彈的顏色（main.js 的 SHOT_PAL）
        static readonly Dictionary<string, (string[] fx, string[] boom, string[] accent, string light, double r, double push)> SHOT_PAL = new Dictionary<string, (string[], string[], string[], string, double, double)>
        {
            ["star"] = (Col.PAL["gold"], Col.PAL["gold"], Col.PAL["holy"], "#ffd27a", 46, 3),
            ["slime"] = (POISON, POISON, LEAF, "#7ee86a", 62, 5),
        };
        static readonly Dictionary<string, string[]> FORM_BURST = new Dictionary<string, string[]>
        {
            ["star"] = new[] { "#1e1206", "#4a2c08", "#86520c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff" },
            ["slime"] = new[] { "#0c2010", "#1a4a20", "#2a8a3a", "#4cc04a", "#8ee86a", "#d4ffb0", "#ffffff" },
            ["bat"] = new[] { "#160c24", "#2e1a4a", "#5c388c", "#8058b8", "#b48ae8", "#e2d0ff", "#ffffff" },
            ["can"] = new[] { "#14161c", "#2a2e38", "#4a5468", "#6e7a90", "#9aa6ba", "#d0d8e6", "#ffffff" },
            ["spike"] = new[] { "#2a1206", "#6a3010", "#a85a1c", "#e09a3a", "#ffd890", "#fff2d0", "#ffffff" },
        };
        public static readonly Dictionary<string, string> FORM_COLOR = new Dictionary<string, string> { ["star"] = "#ffd84a", ["slime"] = "#7ee86a", ["bat"] = "#b48ae8", ["spike"] = "#e09a3a", ["can"] = "#9aa6ba" };

        // ---- 遊戲時間的計時器（網頁版的 setTimeout）：每一步開始前，到時間的依序執行
        class Timer { public double Due; public long Seq; public Action Fn; }
        readonly List<Timer> timers = new List<Timer>(); long timerSeq;
        public void After(double ms, Action fn) { timers.Add(new Timer { Due = SimMs + ms, Seq = timerSeq++, Fn = fn }); }
        public void RunTimers()
        {
            for (;;)
            {
                int best = -1;
                for (int i = 0; i < timers.Count; i++) if (timers[i].Due <= SimMs && (best < 0 || timers[i].Due < timers[best].Due || (timers[i].Due == timers[best].Due && timers[i].Seq < timers[best].Seq))) best = i;
                if (best < 0) return;
                var t = timers[best]; timers.RemoveAt(best);
                t.Fn();
            }
        }

        // ---- 即時特效（pixelfx 的特效翻成 C#，跟烘焙動畫放在同一個清單）
        public FxRun SpawnLive(string name, double x, double y, FxOptions o, double speed = 1, bool back = false) => Fx.SpawnLive(name, x, y, o, speed, back);
        public Action<string> OnSfx;
        public (double x, double y) Checkpoint;

        /// 1-1 的出生點與第一段的怪（stage.js 的 STAGE_1_1）
        public static readonly (double x, double y) START = (84, -40);
        public static readonly (string k, double x, double y, bool deep)[] SPAWNS =
        {
            ("slime", 1140, 384, true), ("slime", 1720, 384, false), ("slime", 1770, 384, false), ("slime", 1820, 384, false),
        };

        public Game(string stage = "1-1")
        {
            Enemy.ResetStatics();
            SceneLight.Reset();
            Status = new Status(this) { Allow = new HashSet<string> { "burn", "slime" } };
            Ult = new Ult(this);
            FxSystem.WarmUp();
            SceneLight.GlobalLv = 0;   // 1-1 只有燃燒和黏液（main.js 同一個設定）
            Data = Baked.Level(stage);
            Art = new LevelArt(Data);
            Map = new GameMap(Data.W, Data.H, Data.Solids, Data.Platforms);
            var combos = JsonUtility.FromJson<ComboDef>(Baked.Text("combos"));
            Player = new Player(START.x, START.y, combos) { RankFn = Rank };
            Checkpoint = (START.x, 0);
            CamY = Math.Max(0, Data.H - H);
            var brazier = Baked.Anim("brazier");
            foreach (var t in Data.Torches) Fx.Spawn(brazier, t.x, t.y, back: true, keep: true).Update(Rnd.Next() * 3);
            foreach (var sp in SPAWNS)
            {
                var e = new Enemy(sp.k, sp.x, sp.y) { X0 = sp.x, DeepSleep = sp.deep, Core = sp.deep ? "slime" : null };   // 1-1：睡著的那隻必掉史萊姆核
                Enemies.Add(e);
            }
            SnapCam();
        }

        // ---- world
        public Enemy NearestEnemy(double x, double y, double range, int dir = 0)
        {
            Enemy best = null; double bd = range;
            foreach (var e in Enemies)
            {
                if (e.Dead || (dir != 0 && Math.Sign(e.X - x) != dir)) continue;
                double d = Math.Abs(e.X - x) + Math.Abs(e.Y - y) * 0.5;
                if (d < bd) { bd = d; best = e; }
            }
            return best;
        }
        public List<Enemy> EnemiesIn(Box box) => Enemies.FindAll(e => !e.Dead && box.Overlaps(e.HitBox()));
        public int HitArea(Box box, Func<Roll> dmg, double dir, HitOpts o)
        {
            int n = 0;
            foreach (var e in Enemies.ToArray()) if (!e.Dead && box.Overlaps(e.HitBox()))
            {
                var r = dmg(); bool poisoned = e.St != null && e.St.Poison > 0;
                e.Hit(r, dir, o, this); n++;
                OnCritHit(e, r);
                // 技能樹「嗜血爪」（蝠翼星）：打中毒的敵人回復傷害的 3%
                if (poisoned && Player.Form == "bat" && Rank("bat", "b_blood") != 0) Player.Hp = Math.Min(Player.MaxHp, Player.Hp + r.Dmg * 0.03);
            }
            if (n > 0) AddCombo(n);
            return n;
        }
        public int HitOnce(Box box, HashSet<Enemy> hit, Func<Roll> dmg, double dir, HitOpts o)
        {
            int n = 0;
            foreach (var e in Enemies.ToArray()) if (!e.Dead && !hit.Contains(e) && box.Overlaps(e.HitBox())) { hit.Add(e); var r = dmg(); e.Hit(r, dir, o, this); OnCritHit(e, r); n++; }
            if (n > 0) { AddCombo(n); Fx.HitStop(0.05); Fx.Shake(0.15, 2); }
            return n;
        }
        /// 連擊：每滿 10 下給 10 魔力
        public void AddCombo(int n)
        {
            int gain = (int)(Math.Floor((Combo + n) / 10.0) - Math.Floor(Combo / 10.0));
            if (gain > 0 && Player.Mp < Player.MaxMp) Player.Mp = Math.Min(Player.MaxMp, Player.Mp + gain * Player.COMBO_MP);
            Combo += n;
            ComboT = COMBO_T;
        }
        public void SpawnFireball(double x, double y, double dir, string form, double vy = 0)
        {
            Sfx("shot");
            var pal = SHOT_PAL.ContainsKey(form) ? SHOT_PAL[form] : SHOT_PAL["star"];
            Shots.Add(new Shot { X = x, Y = y, Dir = dir, Vy = vy, Form = form, Life = 1.1, Mult = 1, Fx = SpawnLive("fireball", x, y, new FxOptions { Flip = dir < 0, Palette = pal.fx, Light = 0.65, Seed = Pf.ToInt32(Rnd.Next() * 99) }) });
        }
        /// 技能樹的小彈（彈跳、分裂）：比較小、比較短、不會再分
        public void SpawnShotlet(double x, double y, double dir, string form, double vy = 0, double mult = 0.6, double life = 0.35)
        {
            var pal = SHOT_PAL.ContainsKey(form) ? SHOT_PAL[form] : SHOT_PAL["star"];
            Shots.Add(new Shot { X = x, Y = y, Dir = dir, Vy = vy, Form = form, Life = life, Mult = mult, Small = true, Fx = SpawnLive("fireball", x, y, new FxOptions { Flip = dir < 0, Palette = pal.fx, Light = 0.65 * 0.6, Seed = Pf.ToInt32(Rnd.Next() * 99) }) });
        }
        /// 技能樹：技能彈爆開之後的追加效果（星雨、彈跳、分裂；黏液地面要等場景機關搬了才有）
        void SkillTreeBoom(Shot s)
        {
            double x = s.X, y = s.Y;
            if (s.Form == "star" && Rank("star", "s_rain") != 0)
            {
                double fy = Map.FloorAt(x, y - 8);
                After(1000, () =>
                {
                    SpawnLive("star-fall", Pf.Round(x), fy, new FxOptions { Palette = Col.PAL["gold"], Light = 0.4, Seed = Pf.ToInt32(Rnd.Next() * 99) }, 1.2);
                    for (int k = 0; k < 4; k++) After(150 + k * 180, () => HitArea(new Box(x - 50, x + 50, fy - 60, fy), () => Player.RollDmg(0.6 * Player.SkillMul()), s.Dir, new HitOpts { Push = 1 }));
                });
            }
            if (s.Form == "slime")
            {
                if (Rank("slime", "g_bounce") != 0) SpawnShotlet(x, y, s.Dir, "slime", 0, 0.6, 0.3);
                if (Rank("slime", "g_split") != 0) foreach (double vy in new[] { -140.0, 0, 140 }) SpawnShotlet(x, y, vy != 0 ? s.Dir : -s.Dir, "slime", vy, 0.5, 0.28);
            }
        }
        // ---- 技能樹的世界效果
        public void GroundSlam(double x, double y, double r, double mult)
        {
            double fy = Map.FloorAt(x, y - 8);
            SpawnLive("ground-slam", Pf.Round(x), Pf.Round(fy), new FxOptions { Palette = METAL7, Light = 0.4, Seed = Pf.ToInt32(Rnd.Next() * 99) }, 1.8);
            Fx.Shake(0.25, 3); Sfx("land");
            HitArea(new Box(x - r, x + r, fy - 30, fy + 2), () => Player.RollDmg(mult * Player.SkillMul()), Player.Face, new HitOpts { Launch = true, Push = 3 });
        }
        public void SpikeBurst(double x, double y)
        {
            Fx.Spawn(Baked.Anim("spark"), Pf.Round(x), Pf.Round(y));
            SceneLight.AddFlash(x, y, 70, 2.5, 0.25, "#ffd890");
            Sfx("hitH");
            HitArea(new Box(x - 48, x + 48, y - 40, y + 18), () => Player.RollDmg(1.2 * Player.SkillMul()), Player.Face, new HitOpts { Push = 3 });
        }
        public void Thorns(double fromX, double y)
        {
            var e = NearestEnemy(fromX, y, 40);
            if (e == null) return;
            e.Hit(Player.RollDmg(0.8), e.X >= Player.X ? 1 : -1, new HitOpts { Push = 2 }, this);
            Fx.Spawn(Baked.Anim("spark"), Pf.Round(e.X), Pf.Round(y - 12));
        }
        public void SpawnWave(double x, double y, double dir) { Waves.Add(new Wave { X = x, Y = y, Dir = dir, Seed = Rnd.Next() }); Sfx("swing"); }
        public void OnGlide(double dt)
        {
            if (Rank("bat", "b_swarm") == 0) return;
            if ((swarmT -= dt) > 0 || Minis.Count >= 3) return;
            swarmT = 0.5;
            Minis.Add(new Mini { X = Player.X, Y = Player.Y - 16, Vx = 0, Vy = -40, Life = 4, Seed = Rnd.Next() * 9 });
        }
        // 星核的效果（裝備，下一段才搬）
        public void CometStart() { comet = new HashSet<Enemy>(); }
        /// 隕鐵：前方最近的敵人頭上砸一顆小隕石
        public void CoreMeteor()
        {
            var e = NearestEnemy(Player.X, Player.Y, 320, (int)Player.Face) ?? NearestEnemy(Player.X, Player.Y, 320);
            if (e != null) Strikes.Add(new Strike { X = e.X, Y = (e.Box().y0 + e.Box().y1) / 2, T = 0, E = e, Mult = 1.2 });
        }
        /// 鈍光：攻擊你的那隻暈 1 秒
        public void CoreStun(double fromX, double y)
        {
            Enemy best = null; double bd = 48;
            foreach (var e in Enemies) { if (e.Dead) continue; double d = Math.Abs(e.X - fromX) + Math.Abs(e.Y - y) * 0.3; if (d < bd) { bd = d; best = e; } }
            if (best != null) { best.Stun = Math.Max(best.Stun, 1); best.DizzyT = 1; }
        }
        public double NoManaT;
        public void NoMana() { Sfx("close"); NoManaT = 0.6; }
        void SwitchForm(string id)
        {
            if (id == null || id == Player.Form) return;
            if (sceneClock < formCdUntil) { Sfx("close"); return; }
            formCdUntil = sceneClock + FORM_CD;
            Sfx("form");
            string prevForm = Player.Form;
            Player.SetForm(id);
            Player.TurnT = 0.09;
            Player.Invuln = Math.Max(Player.Invuln, 0.15);
            // 技能樹：切換時的效果
            if (id == "star" && Rank("star", "s_origin") != 0 && sceneClock - originT > 3) { originT = sceneClock; Player.Mp = Math.Min(Player.MaxMp, Player.Mp + 10); }
            if (id == "star" && Rank("star", "s_return") != 0) Player.SkillCd *= 0.5;
            if (id == "slime" && Rank("slime", "g_film") != 0) Player.FilmT = 3;
            if (id == "can" && Rank("can", "c_dent") != 0) Player.DentT = 3;
            HeartBurst(prevForm);
            if (id == "bat" && Rank("bat", "b_night") != 0) Player.NightT = 3;
            if (id == "spike" && Rank("spike", "k_curl") != 0) Player.CurlT = 3;
            Player.Invuln = Math.Max(Player.Invuln, 0.15);
            SpawnLive("collect-burst", Pf.Round(Player.X), Pf.Round(Player.Y) - 12, new FxOptions { Palette = FORM_BURST[id], Light = 0.4 });
            SceneLight.AddFlash(Player.X, Player.Y - 12, 60, 2, 0.3, FORM_COLOR[id]);
        }
        public void Land(double x, double y, bool hard) { Sfx("land"); Combat.Dust("land", x, y, hard); }
        public void Dust(double x, double y, int n) { Fx.Spawn(Baked.Anim("dust"), Pf.Round(x), Pf.Round(y), Rnd.Next() < 0.5, speed: 1.8); }
        public void DropCoins(double x, double y, int n) { CoinList.Drop(x, y, n); }
        public void OnKill(Enemy e)
        {
            Kills++;
            if (e.SqT > 0) Fx.HitStop(0.08);   // 直接打死的停久一點
            MythKill();
            GainXp(KILL_XP.TryGetValue(e.Kind, out var kx) ? kx : 5);
            if (e.Core != null) { var bb = e.Box(); Drops.Add(Items.MakeCore(e.Core), e.X, (bb.y0 + bb.y1) / 2, 1); }   // 關卡指定必掉
            var b = e.Box(); double cy = (b.y0 + b.y1) / 2;
            if (Rnd.Next() < (DROP_RATE.TryGetValue(e.Kind, out var dr) ? dr : 0.1) * (1 + Player.S.Mf / 200)) { int il = IlvlNow(0); DropItem(e.X, cy, 0, il); }
            // 傳說「爆炸頭礦工帽」：擊殺時 25% 爆炸，會連鎖（最多 6 次）
            if (Player.Has("hardhat") && boomDepth < 6 && Rnd.Next() * 100 < 25)
            {
                double big = Player.Has("hardhat") ? 1.5 : 1, rx = 34 * big;
                boomDepth++;
                SpawnLive("plasma-explosion", Pf.Round(e.X), Pf.Round(cy), new FxOptions { Palette = Col.PAL["ember"], Accent = LAVA, Light = 0.65 * 0.7, Seed = Pf.ToInt32(Rnd.Next() * 99) }, 1.6);
                SceneLight.AddFlash(e.X, cy, 70, 3, 0.3, "#ff8a30");
                HitArea(new Box(e.X - rx, e.X + rx, cy - rx, cy + rx), () => Player.RollDmg(1.2), e.X < Player.X ? -1 : 1, new HitOpts { Launch = true, Push = 2 });
                Fx.Shake(0.2, 2);
                boomDepth--;
            }
        }
        public void OnPlayerHurt(double dmg)
        {
            // 技能樹「彈性」（黏液星）：被打時 20% 把旁邊的敵人彈開
            if (Player.Form == "slime" && Rank("slime", "g_spring") != 0 && Rnd.Next() < 0.2)
            {
                foreach (var e in Enemies) if (!e.Dead && Math.Abs(e.X - Player.X) < 44 && Math.Abs(e.Y - Player.Y) < 40) { e.Vx = (e.X >= Player.X ? 1 : -1) * 260; e.Vy = -160; e.Stun = Math.Max(e.Stun, 0.5); }
                SceneLight.AddFlash(Player.X, Player.Y - 12, 60, 2, 0.25, "#b4f890");
            }
        }
        public void Sfx(string name) { OnSfx?.Invoke(name); }

        // ---- 看得到的範圍（畫布座標）：放大 ZOOM 倍後四周被裁掉
        public static (double x0, double y0, double w, double h) ViewRect()
        {
            double vw = W / ZOOM, vh = H / ZOOM, my = (H - vh) / 2;
            return ((W - vw) / 2, my + Math.Min(VIEW_DY, my), vw, vh);
        }
        void SnapCam()
        {
            var v = ViewRect(); double gy = Map.FloorAt(Player.X, Math.Max(0, Player.Y));
            camLand = Player.Grounded ? (double?)null : gy; camRefY = gy; lookX = Player.Face * 36;
            CamX = Math.Max(-v.x0, Math.Min(Data.W - v.x0 - v.w, Player.X - W / 2.0));
            if (Data.H > H) CamY = Math.Max(-v.y0, Math.Min(Data.H - v.y0 - v.h, gy - H * 0.62));
        }
        double LookAhead(double dt, double dist) { lookX += (Player.Face * dist - lookX) * Math.Min(1, 2.2 * dt); return lookX; }
        static double DeadFollow(double c, double target, double dz, double rate, double dt)
        {
            double d = target - c;
            if (Math.Abs(d) <= dz) return c;
            return c + (d - Math.Sign(d) * dz) * Math.Min(1, rate * dt);
        }
        void FollowCam(double dt)
        {
            var v = ViewRect();
            CamX = DeadFollow(CamX + W / 2.0, Player.X + LookAhead(dt, 36), 14, 5, dt) - W / 2.0;
            CamX = Math.Max(-v.x0, Math.Min(Data.W - v.x0 - v.w, CamX));
            if (Data.H > H)
            {
                if (camLand != null && Player.Grounded) camLand = null;
                if (camLand != null) camRefY = camLand;
                else if (Player.Grounded || camRefY == null) camRefY = Player.Y;
                else if (Player.Y > camRefY) camRefY = Player.Y;
                else if (Player.Y < camRefY - 72) camRefY = Player.Y + 72;
                double wy = camRefY.Value - H * 0.62, rate = 3 + Math.Min(4, Math.Max(0, Player.Vy) / 100);
                CamY += (wy - CamY) * Math.Min(1, rate * dt);
                CamY = Math.Max(-v.y0, Math.Min(Data.H - v.y0 - v.h, CamY));
            }
        }
        void Separate(double dt)
        {
            for (int i = 0; i < Enemies.Count; i++)
            {
                var a = Enemies[i];
                for (int j = i + 1; j < Enemies.Count; j++)
                {
                    var b = Enemies[j];
                    if (a.K.Fly != b.K.Fly) continue;
                    double dx = b.Xp - a.Xp, dy = b.Yp - a.Yp, min = a.K.W + b.K.W - 4;
                    if (Math.Abs(dx) < min && Math.Abs(dy) < (a.K.Fly ? 16 : 6))
                    {
                        double push = (min - Math.Abs(dx)) * 0.5 * Math.Min(1, 10 * dt) * (dx >= 0 ? 1 : -1);
                        if (push == 0 || double.IsNaN(push)) push = 0.5;
                        a.Xp -= push; b.Xp += push;
                    }
                }
            }
        }

        public double DeadT;
        /// 一步（固定 1/60 秒）
        public void Tick(double dt)
        {
            RunTimers();
            Input.Tick(dt);
            if (Fx.ShakeT > 0) Fx.ShakeT -= dt;
            if (Fx.Freeze > 0) { Fx.Freeze -= dt; return; }
            Combat.Update(dt);
            SceneLight.Update(dt);
            Status.Update(dt);
            if (NoManaT > 0) NoManaT -= dt;
            // 大招進行中：世界停住，只有主角、特效和鏡頭在動
            if (Ult.On)
            {
                Ult.Update(dt, Player);
                SceneLight.GlobalLv = Ult.GlobalLv;
                Enemies.RemoveAll(e => e.Dead);
                Fx.Update(dt);
                FollowCam(dt);
                return;
            }
            if (PendingForm != null) { SwitchForm(PendingForm); PendingForm = null; }
            ultCd -= dt;
            bool ultReady = Player.Mp >= Ult.ULT_MP && !Ult.On && ultCd <= 0;
            if (Input.Ult && !ultReady && !Ult.On) { Input.Consume("ult"); if (Player.Mp < Ult.ULT_MP) NoMana(); }
            if (Input.Ult && ultReady && Player.State != "hurt" && Player.Hp > 0)
            {
                Input.Consume("ult");
                Player.Mp -= Ult.ULT_MP; ultCd = 1;
                Ult.Start(Player);
                if (Player.Set4("reson")) Player.ResonT = 10;   // 星辰共鳴 4 件
                // 星王之冠：星王化（8 秒，覺醒 2 階 12 秒；3 階退回一半的大招魔力）
                var crown = MythOn("starking");
                if (crown != null) { int st = Items.AwakenStage(crown); Player.KingT = st >= 2 ? 12 : 8; if (st >= 3) Player.Mp = Math.Min(Player.MaxMp, Player.Mp + Ult.ULT_MP / 2); OnSay?.Invoke("星王化！"); }
                Sfx("ultCharge");
                return;
            }
            if (Player.Hp <= 0)
            {
                // 階段 1 的簡化：倒下 1 秒後從檢查點重來
                if ((DeadT += dt) > 1) { DeadT = 0; Player.Respawn(Checkpoint.x, Checkpoint.y); SnapCam(); }
            }
            else Player.Update(dt, this);
            UpdateUniques(dt);
            Drops.Update(dt, Player, 16, Map, PickUp);
            UpdateAbsorb(dt);
            if (Player.Grounded && Player.X > Checkpoint.x + 200 && Player.Hp > 0) Checkpoint = (Player.X, Player.Y - 1);
            foreach (var e in Enemies)
            {
                if (e.Dead) continue;
                e.Update(dt, Player, this);
                if (e.K.Dmg > 0 && e.Stun <= 0 && Player.Hp > 0 && e.HitBox().Overlaps(new Box(Player.X - 8, Player.X + 8, Player.Y - 22, Player.Y)) && Player.Hurt(e.K.Dmg, e.X, this))
                {
                    e.Vx = (e.X >= Player.X ? 1 : -1) * 120;
                    e.Stun = 0.4;
                }
            }
            Separate(dt);
            UpdateCoreFx(dt);
            Enemies.RemoveAll(e => e.Dead);
            // 技能彈：直線飛，撞到怪或地形就爆開（範圍傷害、擊飛、沾元素）
            for (int si = 0; si < Shots.Count; si++)   // 跟 JS 一樣：迴圈中途加進來的小彈（彈跳、分裂）同一步也會處理
            {
                var s = Shots[si];
                s.X += s.Dir * 290 * dt;
                if (s.Vy != 0) s.Y = Math.Min(Map.FloorAt(s.X, s.Y) - 6, s.Y + s.Vy * dt);
                s.Life -= dt;
                s.Fx.Options.X = Pf.Round(s.X); s.Fx.Options.Y = Pf.Round(s.Y);
                bool hit = s.Life <= 0 || Map.SolidAt(s.X, s.Y);
                if (!hit) foreach (var e in Enemies.ToArray()) if (!e.Dead && e != s.Skip && e.HitBox().Overlaps(new Box(s.X - 8, s.X + 8, s.Y - 8, s.Y + 8)))
                {
                    // 技能樹「貫穿」（星星）：穿過第一隻，打到第二隻才爆
                    if (s.Form == "star" && !s.Small && Rank("star", "s_pierce") != 0 && s.Skip == null) { s.Skip = e; e.Hit(Player.RollDmg(1.2 * Player.SkillMul()), s.Dir, new HitOpts { Push = 2 }, this); continue; }
                    hit = true; break;
                }
                if (hit)
                {
                    s.Done = true;
                    s.Fx.Stop();
                    var P = SHOT_PAL.ContainsKey(s.Form) ? SHOT_PAL[s.Form] : SHOT_PAL["star"];
                    double big = 1 + 0.15 * (s.Form == "slime" ? Rank("slime", "g_big") : Rank("star", "s_big")), R = P.r * big * (s.Small ? 0.55 : 1);
                    Sfx("boom");
                    SpawnLive("plasma-explosion", Pf.Round(s.X), Pf.Round(s.Y), new FxOptions { Palette = P.boom, Accent = P.accent, Light = 0.65 * (s.Small ? 0.5 : 1), Seed = Pf.ToInt32(Rnd.Next() * 99) }, s.Small ? 1.8 : 1.3);
                    SceneLight.AddFlash(s.X, s.Y, s.Small ? 50 : 100, 4, 0.4, P.light);
                    var sx = s.X; var mult = s.Mult;
                    HitArea(new Box(s.X - R, s.X + R, s.Y - 40, s.Y + 40), () => Player.RollDmg(2.4 * mult * Player.SkillMul()), s.Dir, new HitOpts { Launch = true, Push = P.push, Elem = Player.ELEM.TryGetValue(s.Form, out var el) ? el : "burn" });
                    Fx.HitStop(s.Small ? 0.03 : 0.06);
                    Fx.Shake(s.Small ? 0.12 : 0.3, s.Small ? 1 : 3);
                    if (!s.Small) SkillTreeBoom(s);
                    // 星王化＋黏液星：黏液彈連火一起點
                    if (s.Form == "slime" && Player.KingT > 0) foreach (var e in EnemiesIn(new Box(s.X - R, s.X + R, s.Y - 40, s.Y + 40))) Status.Apply(e, "burn");
                }
            }
            Shots.RemoveAll(s => s.Done);
            // 技能樹「星光斬」：往前飛，穿過敵人、每隻打一次
            foreach (var w in Waves)
            {
                w.T += dt; w.X += w.Dir * StarWave.WAVE_V * dt;
                HitOnce(new Box(w.X - 8, w.X + 8, w.Y - 14, w.Y + 14), w.Hit, () => Player.RollDmg(1.0), w.Dir, new HitOpts { Push = 2 });
            }
            Waves.RemoveAll(w => w.T >= StarWave.WAVE_T);
            // 技能樹「蝙蝠群」：小蝙蝠飛向最近的敵人咬一口（沾毒），0.6 秒一口，4 秒後飛走
            foreach (var m in Minis)
            {
                m.T += dt; m.Life -= dt; m.Cd -= dt;
                var tgt = NearestEnemy(m.X, m.Y, 160);
                double tx = tgt != null ? tgt.X : Player.X + Pf.Sin(m.T * 3 + m.Seed) * 20, ty = tgt != null ? (tgt.Box().y0 + tgt.Box().y1) / 2 : Player.Y - 30;
                m.Vx += Math.Sign(tx - m.X) * 600 * dt; m.Vy += Math.Sign(ty - m.Y) * 600 * dt;
                m.Vx *= 1 - 3 * dt; m.Vy *= 1 - 3 * dt;
                m.X += m.Vx * dt; m.Y += m.Vy * dt;
                if (tgt != null && m.Cd <= 0 && Math.Abs(tgt.X - m.X) < 10 && Math.Abs(ty - m.Y) < 12) { m.Cd = 0.6; tgt.Hit(Player.RollDmg(0.4), m.Vx >= 0 ? 1 : -1, new HitOpts { Push = 1, Elem = "poison" }, this); }
            }
            Minis.RemoveAll(m => m.Life <= 0);
            foreach (var e in Enemies) if (e.MeteorMark > 0) e.MeteorMark -= dt;
            // 流星獵手 4 件、隕鐵：小流星砸下來
            foreach (var s in Strikes)
            {
                s.T += dt;
                if (s.T >= SetFx.STRIKE_T && !s.Done)
                {
                    s.Done = true;
                    SpawnLive("hit-spark", Pf.Round(s.X), Pf.Round(s.Y), new FxOptions { Palette = new[] { "#6e3a0c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff" }, Light = 0.6 });
                    SceneLight.AddFlash(s.X, s.Y, 50, 2.5, 0.2, "#ffe066"); Fx.Shake(0.12, 2);
                    if (!s.E.Dead) s.E.Hit(Player.RollDmg(s.Mult), Player.Face, new HitOpts { Push = 2 }, this);
                }
            }
            Strikes.RemoveAll(s => s.Done);
            // 金幣：先噴出去，再被吸過來
            int got = CoinList.Update(dt, Player, Map);
            if (got > 0) { Coins += got; Money += got; Sfx("coin"); }
            Fx.Update(dt);
            if ((ComboT -= dt) <= 0 && Combo != 0) Combo = 0;
            FollowCam(dt);
        }

        /// 合成之後（大招落地的黑白衝擊定格）
        public void PostComposite(byte[] rgba) => Ult.PostProcess(rgba);

        /// 畫一格（main.js 的 render 子集），結果在 frame 裡（還沒合成）
        public void Render(Frame frame)
        {
            var (sx, sy) = Fx.ShakeOffset();
            frame.Ox = (int)Pf.Round(CamX) + sx;
            frame.Oy = (int)Pf.Round(CamY) + sy;
            Array.Clear(frame.Light, 0, frame.Light.Length);
            sceneClock += 1 / 60.0;
            var lights = Art.SceneLights(CamX, W, sceneClock);
            lights.Add(new LightSrc(Player.X, Player.Y - 10, 64, 1.6, "#ffcf6a"));
            foreach (var s in Shots) lights.Add(new LightSrc(s.X, s.Y, 64, 3, (SHOT_PAL.ContainsKey(s.Form) ? SHOT_PAL[s.Form] : SHOT_PAL["star"]).light));
            Ult.Lights(lights);
            Prof.Mark(null);
            var lv = SceneLight.Compute(frame, lights);
            Prof.Mark("光源");
            Art.Draw(frame, lv);
            Prof.Mark("場景");
            Art.DrawAtmosphere(frame, sceneClock);
            Prof.Mark("大氣");
            if (!Ult.On) Fx.Draw(frame, true);
            Drops.Draw(frame, sceneClock);
            foreach (var d in Drops.List) if (d.Item.Kind == "formcore" && d.Hold > 0 && d.HasCenter) CoreArt.DrawBeams(frame, d.Cx, d.Cy, Player.X, Player.Y - 12, sceneClock, d.Item.Form, d.Hold);
            Prof.Mark("背景特效");
            foreach (var e in Enemies) e.Draw(frame, Fx, SimMs);
            Status.DrawBolts(frame);
            foreach (var w in Waves) StarWave.Draw(frame, w);
            foreach (var m in Minis) MiniBat.Draw(frame, m);
            foreach (var e in Enemies) if (e.MeteorMark > 0 && !e.Dead) SetFx.DrawMark(frame, e.X, e.Box().y0 - 7, sceneClock);
            foreach (var s in Strikes) SetFx.DrawStrike(frame, s.X, s.Y, s.T);
            CoreFx.DrawTrail(frame, Trail);
            foreach (var e in Enemies) if (e.DizzyT > 0 && !e.Dead) CoreFx.DrawDizzy(frame, e.X, e.Box().y0 - 4, sceneClock);
            if (Player.Shield > 0) SetFx.DrawShield(frame, Player.X, Player.Y - 12, Player.Shield / (Player.MaxHp * 0.2), sceneClock);
            if (Player.ResonT > 0) SetFx.DrawReson(frame, Player.X, Player.Y - 12, sceneClock);
            CoinList.Draw(frame);
            Prof.Mark("怪");
            if (Ult.On) { Ult.DimScene(frame); Prof.Mark("暗場"); Fx.Draw(frame, true); Prof.Mark("背景特效"); }   // 大招：先畫怪再暗場，法陣這些背景特效畫在暗場之後才會亮
            if (Player.KingT > 0) SetFx.DrawKingBack(frame, Player.X, Player.Y - 12, sceneClock);   // 星王化：光芒在主角後面
            if (Player.Hp > 0) Player.Draw(frame);
            if (Player.KingT > 0) SetFx.DrawKingFront(frame, Player.X, Player.Y - 12, sceneClock);
            Prof.Mark("主角");
            Fx.Draw(frame, false);
            Prof.Mark("前景特效");
            Combat.Form = Player.Form;
            Combat.Draw(frame);
            Prof.Mark("戰鬥小特效");
            Ult.Draw(frame);
            Prof.Mark("大招畫");
            Art.DrawForeground(frame);
            Combat.DrawNumbers(frame, ViewRect());
            Prof.Mark("前景");
            Ult.DrawCutIn(frame);
            Prof.Mark("特寫帶");
        }
    }
}
