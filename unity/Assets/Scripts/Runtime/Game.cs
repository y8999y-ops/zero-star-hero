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
        /// 每一段產生了多少暫存資料（位元組；手機上清這些垃圾時會頓一下）
        public static readonly Dictionary<string, double> Bytes = new Dictionary<string, double>();
        static long lastBytes;
        public static void Mark(string name)
        {
            if (!On) return;
            long b = GC.GetTotalMemory(false);
            if (name != null) { Ms.TryGetValue(name, out var v); Ms[name] = v + sw.Elapsed.TotalMilliseconds; Bytes.TryGetValue(name, out var bv); Bytes[name] = bv + Math.Max(0, b - lastBytes); }   // 中間剛好清過垃圾（變少）就不算
            lastBytes = b;
            sw.Restart();
        }
    }

    public partial class Game : IWorld
    {
        public static int W = 384;
        public const int H = 216;
        public const double STEP = 1 / 60.0, ZOOM = 1.38;
        public static int VIEW_DY = (int)Pf.Round(0.05 * H / ZOOM);   // 城鎮比關卡再往下 5%（0.10）

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
        public int Kills, Coins, Combo, BestCombo; public double ComboT;
        public double HitTune = 1;   // 打擊音的音高倍數（GameRoot 交給 Synth.HitTuneK）
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
        public int Clears; public bool SeenIntro;   // 存檔：通關次數、看過開場沒有
        public readonly List<Item> Inv = new List<Item>();
        public readonly Dictionary<string, int> FormsOwned = new Dictionary<string, int> { ["star"] = 0 };   // 吸收過的形態 → 多出來的靈核
        public readonly Drops Drops = new Drops();
        public readonly Coins CoinList = new Coins();
        static readonly Dictionary<string, double> KILL_XP = new Dictionary<string, double> { ["slime"] = 5, ["bat"] = 5, ["trash"] = 12, ["gold"] = 20, ["hog"] = 9, ["shroom"] = 8 };
        static readonly Dictionary<string, double> DROP_RATE = new Dictionary<string, double> { ["slime"] = 0.1, ["bat"] = 0.1, ["trash"] = 0.35, ["gold"] = 1, ["hog"] = 0.2, ["shroom"] = 0.15 };
        const double ABSORB_T = 1;
        double? absorbHp; double absorbTick; public Drops.Drop AbsorbNear;
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
            Say.Unshift($"升級！Lv {Lv}　生命全滿", 2.2);
        }
        /// 在 (x, y) 掉一件東西。minR＝保底稀有度
        public void DropItem(double x, double y, int minR = 0, int? ilvl = null, int? rarity = null, double? dir = null)
        {
            int r = rarity ?? Items.RollRarity(Player.S.Mf, minR);
            var item = Items.MakeItem(ilvl ?? IlvlNow(), r);
            Drops.Add(item, x, y, dir);
            if (item.Rarity == Items.LEGEND)
            {
                // 傳說：時間變慢、畫面一閃
                SlowT = 0.9;
                SceneLight.AddFlash(x, y, 110, 4, 1, "#ff8a2a"); Fx.HitStop(0.12); Fx.Shake(0.4, 3);
                OnScreenFlash?.Invoke();
                Say.Unshift("系統：……等等，那個橘色的光是怎樣？！", 2.6);
            }
            else if (item.Rarity == Items.EPIC)
            {
                SceneLight.AddFlash(x, y, 90, 3, 0.6, "#b878ff"); Fx.Shake(0.25, 2); Fx.HitStop(0.06);
                if (!SeenSet) { SeenSet = true; Say.Unshift("系統：紫色的光……套裝！同一套穿 2 件、4 件都有效果。", 3); }
            }
            else if (item.Rarity == Items.RARE) Fx.Shake(0.15, 2);
        }
        public Action OnScreenFlash;
        /// 撿起來（背包滿了回傳 false；魔物核要按住吸收）
        bool PickUp(Drops.Drop d)
        {
            if (d.Item.Kind == "formcore") return false;
            var it = d.Item;
            // 自動拆解：關／只拆純垃圾／純垃圾和普通（比身上好的不拆）
            bool better = Items.Compare(it, Equip, Lv)?.better == true;
            bool auto = Auto == 1 ? it.Kind == "junk" : Auto == 2 ? it.Kind == "junk" || it.Rarity <= Items.COMMON : false;
            if (auto && !better)
            {
                var r = Items.RARITY[it.Rarity]; Scrap += r.Scrap; Money += r.Coin;
                OnFeed?.Invoke(new FeedRow { Icon = it.Icon, Name = it.Name, Color = it.Kind == "junk" ? "#8f8a9e" : r.Color, Note = $"自動拆解 +{r.Scrap} 星塵" });
                return true;
            }
            if (Inv.Count >= Items.BAG_SIZE)
            {
                if (!d.Warned) { d.Warned = true; Say.Show("系統：背包滿了！打開右上角的【背包】整理一下。", 2.5, "bag"); }
                return false;
            }
            it.New = true;
            Inv.Add(it);
            OnFeed?.Invoke(new FeedRow { Icon = it.Icon, Name = it.Name, Color = it.Kind == "junk" ? "#8f8a9e" : Items.RARITY[it.Rarity].Color, Better = Items.Compare(it, Equip, Lv)?.better == true });
            if (it.Kind == "junk") QuestProgress("junk");
            if (it.Kind == "junk" && Rnd.Next() < 0.4) Say.Push(Items.JUNK.First(j => j.id == it.Junk).say, 2.4);
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
            if (near != null && AbsorbNear == null) Sfx("chime");   // 吸收鍵出現
            AbsorbNear = near;
            bool hit = absorbHp != null && Player.Hp < absorbHp;
            absorbHp = Player.Hp;
            foreach (var d in cores) if (d != near && d.Hold != 0) d.Hold = Math.Max(0, d.Hold - dt * 3);
            if (near == null) return;
            if (hit && near.Hold > 0) { near.Hold = 0; Sfx("close"); Say.Show("系統：被打斷了！核掉回地上了。", 1.4); return; }
            if (Input.Absorb && !Ult.On)
            {
                near.Hold = Math.Min(1, near.Hold + dt / ABSORB_T);
                if ((absorbTick += dt) > 0.22) { absorbTick = 0; Sfx("ui"); }   // 按住吸收：滴答
                if (near.Hold >= 1) { near.Got = true; Absorb(near.Item); }
            }
            else near.Hold = Math.Max(0, near.Hold - dt * 3);
        }
        public static readonly Dictionary<string, string> FORM_NAME = new Dictionary<string, string> { ["star"] = "星星", ["slime"] = "黏液星", ["bat"] = "蝠翼星", ["spike"] = "尖刺星", ["can"] = "鐵罐星" };
        void Absorb(Item it)
        {
            bool unlocked = !FormsOwned.ContainsKey(it.Form);
            if (unlocked) FormsOwned[it.Form] = 0; else FormsOwned[it.Form]++;
            After(0, () => QuestProgress("core"));
            Sfx("absorb");
            SpawnLive("collect-burst", Pf.Round(Player.X), Pf.Round(Player.Y) - 12, new FxOptions { Palette = FORM_BURST[it.Form], Light = 0.7 });
            SpawnLive("collect-burst", Pf.Round(Player.X), Pf.Round(Player.Y) - 12, new FxOptions { Palette = FORM_BURST[it.Form], Light = 0.4, Seed = 7 }, 0.7);
            SceneLight.AddFlash(Player.X, Player.Y - 12, 120, 4, 0.9, FORM_COLOR[it.Form]);
            Fx.Shake(0.18, 2.5);
            if (unlocked)
            {
                OnFormBanner?.Invoke(it.Form); Sfx("levelup");
                bool carried = Array.IndexOf(Carry, it.Form) >= 0;
                Say.Show($"系統：吸收了{FORM_NAME[it.Form]}的靈核！新形態「{FORM_NAME[it.Form]}」。" + (carried ? (IsTouch ? "點右邊的【形態】就能變身。" : "按【1】～【3】就能變身。") : "已經帶滿 3 個了，不在戰鬥中時打開技能樹的【形態】頁就能換。"), 3.4, "forms");
                Say.Unshift($"系統：你把{(it.Form == "slime" ? "史萊姆" : "垃圾桶")}的靈核吃掉了？不對，是吸收。好吧，差不多。", 2.8);
            }
            else
            {
                OnFeed?.Invoke(new FeedRow { Icon = it.Icon, Name = it.Name, Color = Items.RARITY[3].Color, Note = $"靈核 +1（{FORM_NAME[it.Form]}有 {FormsOwned[it.Form]} 顆）" });
                if (!SeenCoreTip) { SeenCoreTip = true; Say.Push("系統：重複的靈核也有用——在左上的【技能樹】用它點技能，兩顆還能換一次屬性。", 3.4); }
            }
        }
        /// 左邊那排「撿到東西」的訊息（loot.js 的 feed）：圖示、名字（稀有度的顏色）、比身上好的 ▲、附註
        public struct FeedRow { public string Icon, Name, Color, Note; public bool Better; }
        public Action<FeedRow> OnFeed;
        public Action<string> OnFormBanner;                         // 獲得新形態：畫面中間的大字（main.js 的 formBanner）
        public Action<string, string, string, string> OnResBanner;  // 重要資源的橫幅（icon, title, eff, flavor）
        // ---- 背包、技能樹用的存檔欄位
        public readonly HashSet<Item> Locked = new HashSet<Item>();                      // 鎖定（不會被任何拆解拆掉）
        public int Auto;                                                                 // 自動拆解：0 關、1 垃圾、2 普通以下
        public readonly Dictionary<string, int> CoreSpent = new Dictionary<string, int>();      // 換屬性花掉的靈核
        public readonly Dictionary<string, double> CoreBonus = new Dictionary<string, double>(); // 靈核換來的基礎屬性
        public readonly Dictionary<string, bool[]> MapSeen = new Dictionary<string, bool[]>();  // 關卡地圖走過的格子
        /// 總共吸過幾顆這個形態的靈核（背包星星周圍的粒子數）
        public int FormGot(string f) => 1 + (FormsOwned.TryGetValue(f, out var p) ? p : 0);
        public void ApplyStats() { var s = Items.ComputeStats(Equip, Lv, CoreBonus); s.MaxMp = 100 + MpBonus; if (Meal != null && MEALS.TryGetValue(Meal, out var m)) m.apply(s); Player.SetStats(s); }
        // ---- 旅館的料理（townui.js 的 MEALS）：吃了下一趟冒險有效（回到城鎮時用掉），一次只能一道
        public string Meal;
        public static readonly Dictionary<string, (string name, string icon, string buffIcon, string buff, int cost, Action<Stats> apply)> MEALS = new Dictionary<string, (string, string, string, string, int, Action<Stats>)>
        {
            ["stew"] = ("星光燉肉", "stew", "q_kill", "攻擊 +10%", 80, s => s.Atk = Pf.Round(s.Atk * 1.1)),
            ["soup"] = ("菇菇濃湯", "soup", "heart", "生命 +20%", 60, s => s.MaxHp = Pf.Round(s.MaxHp * 1.2)),
            ["pie"] = ("幸運蘋果派", "pie", "coin", "掉寶 +25%", 100, s => s.Mf += 25),
        };
        Item MythOn(string id) { foreach (var it in Equip.Values) if (it?.Myth == id) return it; return null; }
        // 裝備效果的物件
        public class Strike { public double X, Y, T, Mult = 0.8; public Enemy E; public bool Done; }
        public readonly List<Strike> Strikes = new List<Strike>();
        public readonly List<CoreFx.TrailPt> Trail = new List<CoreFx.TrailPt>();
        HashSet<Enemy> comet;
        double noisyT = 4, combatT, idleT; int boomDepth;
        static readonly (string line, string stat)[] NOISY = { ("系統（星核）：拜託你認真打好嗎。給你攻擊 +30%。", "atk"), ("系統（星核）：太慢了啦！攻速 +30%，快點！", "spd"), ("系統（星核）：跑起來！移速 +30%！", "move"), ("系統（星核）：……我不想講話。攻擊 +30%，自己看著辦。", "atk") };
        public Action<string> OnSay;   // 開發用的提示（不在網頁版的台詞排隊裡）
        static readonly Dictionary<string, string[]> MYTH_LORE = new Dictionary<string, string[]>
        {
            ["starking"] = new[] { "王冠內側刻著一行小字：「給最亮的那一顆」。", "你聽見王冠裡有人在數數：一、二、三……數到第九就停了。九顆星星？", "星王沒有死。祂只是碎成了很多很多片——其中一片，正戴著祂的王冠。" },
            ["fallheart"] = new[] { "一顆還在跳動的星星碎片。摸起來是溫的。", "它跳動的節奏，跟你切換形態的節奏一模一樣。", "這是星王的心。祂把心留給了下一顆星星——也就是你。" },
        };
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
                Say.Unshift(line, 2.4);
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
                    var M = Items.MYTHS.First(x => x.id == it.Myth);
                    Say.Show($"{M.name} 覺醒到第 {after} 階！", 2.6);
                    Say.Push("系統：" + MYTH_LORE[it.Myth][after - 1], 4);
                    SceneLight.AddFlash(Player.X, Player.Y - 14, 120, 4, 0.6, "#fff0a0"); Fx.Shake(0.3, 3); Sfx("levelup");
                    SpawnLive("level-up", Pf.Round(Player.X), Pf.Round(Player.Y), new FxOptions { Light = 0.55, Seed = after * 7, Palette = new[] { "#2a1405", "#5c3008", "#9a5a0e", "#d48e18", "#f5b92c", "#ffde5e", "#fff4bc", "#ffffff" } }.Set("text", "AWAKEN!"));
                    ApplyStats();
                }
            }
        }
        static readonly string[] METAL7 = { "#14161c", "#2a2e38", "#4a5468", "#6e7a90", "#9aa6ba", "#d0d8e6", "#ffffff" };
        public readonly List<Shot> Shots = new List<Shot>();
        public class Shot { public double X, Y, Dir, Vy, Life, Mult = 1; public string Form; public bool Small, Done; public FxRun Fx; public Enemy Skip; }
        public const double COMBO_T = 4.4; const double FORM_CD = 1;
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

        public readonly string StageId;
        /// 新存檔的初始裝備（save.js 載入時一定會做一份：亂數照網頁版的順序先取掉）
        public readonly (Item core, Item shell) Fresh;

        /// 照 main.js 載入關卡的順序建立（亂數的順序要一樣）。建好之後呼叫 StartStage() 才開始（擺怪、開場台詞）
        /// from：上一關的遊戲（換關時把存檔裡的東西帶過來：等級、裝備、背包、形態、技能樹、找到的機關……；存檔在階段 5）
        public Game(string stage = "1-1", Game from = null)
        {
            StageId = stage;
            Town = stage == "town"; Endless = stage == "endless";
            VIEW_DY = (int)Pf.Round((Town ? 0.10 : 0.05) * H / ZOOM);
            Zoom = Town ? TOWN_ZOOM : ZOOM;   // 2026-11-12：城鎮鏡頭拉遠，一個畫面看得到兩棟店
            Enemy.ResetStatics();
            SceneLight.Reset();
            Fresh = Items.StarterGear();
            if (from != null) CarryOver(from);
            Status = new Status(this) { Allow = stage == "1-1" ? new HashSet<string> { "burn", "slime" } : null };   // 1-1 只有燃燒和黏液
            Ult = new Ult(this);
            FxSystem.WarmUp();
            SceneLight.GlobalLv = 0;
            Data = Town ? TownArt.Level() : Baked.Level(stage);
            Art = Town ? null : new LevelArt(Data);
            if (Town) TownArt.Reset();
            Map = new GameMap(Data.W, Data.H, Data.Solids, Data.Platforms);
            InitStage(stage);
            var combos = JsonUtility.FromJson<ComboDef>(Baked.Text("combos"));
            Player = Town ? new Player(120, TownArt.FLOOR, combos) { RankFn = Rank } : new Player(StageD.StartX, Endless ? Data.Floor : StageD.StartY, combos) { RankFn = Rank };
            if (from == null) { Equip["weapon"] = Fresh.core; Equip["body"] = Fresh.shell; }
            ApplyStats();
            Player.Hp = Player.MaxHp;
            CamY = Math.Max(0, Data.H - H);
            InitStageObjects();   // 場景物件、機關（載入時取亂數的在這裡）
            var brazier = Baked.Anim("brazier");
            foreach (var t in Data.Torches) Fx.Spawn(brazier, t.x, t.y, back: true, keep: true).Update(Rnd.Next() * 3);
            if (PortalX != null) Fx.Spawn(Baked.Anim("portal"), PortalX.Value, PortalY, back: true, keep: true);
            if (Town) { Folk = new Folk(TownArt.FLOOR); var fo = new FxOptions { Seed = 3, Light = 0.2 }; Fx.SpawnLive("frog", 742, TownArt.FLOOR, fo, 1, back: true, keep: true); }   // 路人、青蛙
        }
        /// 場景物件（props、scenery、hazards、features）：搬好之後在這裡建立
        partial void InitStageObjects();
        /// 換關：網頁版是存檔、重新載入頁面；這裡直接把存檔裡會留下來的東西抄過來
        void CarryOver(Game f)
        {
            Lv = f.Lv; Xp = f.Xp; Money = f.Money; Scrap = f.Scrap;
            foreach (var k in f.Equip.Keys) Equip[k] = f.Equip[k];
            Inv.AddRange(f.Inv);
            foreach (var kv in f.FormsOwned) FormsOwned[kv.Key] = kv.Value;
            foreach (var kv in f.Tree) Tree[kv.Key] = kv.Value;
            Carry = f.Carry;
            foreach (var kv in f.Found) Found[kv.Key] = new Dictionary<string, int>(kv.Value);
            MpBonus = f.MpBonus; Lore = f.Lore; PityMyth = f.PityMyth;
            TipUse = f.TipUse; SeenSet = f.SeenSet; SeenCoreTip = f.SeenCoreTip;
            Taught.UnionWith(f.Taught); Reacted.UnionWith(f.Reacted); SysDone.UnionWith(f.SysDone); Cleared_.UnionWith(f.Cleared_);
            GuildRegistered = f.GuildRegistered; GuildDone = f.GuildDone; TGuide = f.TGuide;
            Meal = f.Town || !Town ? f.Meal : null;
            Locked.UnionWith(f.Locked); Auto = f.Auto; Clears = f.Clears; SeenIntro = f.SeenIntro; PityLegend = f.PityLegend;
            foreach (var kv in f.CoreSpent) CoreSpent[kv.Key] = kv.Value;
            foreach (var kv in f.CoreBonus) CoreBonus[kv.Key] = kv.Value;
            foreach (var kv in f.MapSeen) MapSeen[kv.Key] = kv.Value;   // 料理的效果只到這趟冒險結束（從關卡回城鎮時用掉）
            Quests.Tracked.AddRange(f.Quests.Tracked);
            Quests.Active.AddRange(f.Quests.Active); Quests.Board.AddRange(f.Quests.Board); Quests.EnhanceMax = f.Quests.EnhanceMax; Quests.Meals = f.Quests.Meals; Quests.Rerolls = f.Quests.Rerolls;
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
            var bt = (box.X0, box.X1, box.Y0, box.Y1);
            Props.Hit(bt, dir);
            Features.Hit(bt);
            Scenery.Hit(bt, dir);
            Hazards.Hit(bt);
            foreach (var e in Enemies.ToArray()) if (!e.Dead && box.Overlaps(e.HitBox()))
            {
                var r = dmg(); bool poisoned = e.St != null && e.St.Poison > 0;
                e.Hit(r, dir, o, this, box); n++;
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
            var bt = (box.X0, box.X1, box.Y0, box.Y1);
            Props.Hit(bt, dir);
            Features.Hit(bt);
            Scenery.Hit(bt, dir);
            foreach (var e in Enemies.ToArray()) if (!e.Dead && !hit.Contains(e) && box.Overlaps(e.HitBox())) { hit.Add(e); var r = dmg(); e.Hit(r, dir, o, this, box); OnCritHit(e, r); n++; }
            if (n > 0) { AddCombo(n); Fx.HitStop(0.05); Fx.Shake(0.15, 2); }
            return n;
        }
        /// 連擊：每滿 10 下給 10 魔力
        public void AddCombo(int n)
        {
            int gain = (int)(Math.Floor((Combo + n) / 10.0) - Math.Floor(Combo / 10.0));
            if (gain > 0 && Player.Mp < Player.MaxMp) Player.Mp = Math.Min(Player.MaxMp, Player.Mp + gain * Player.COMBO_MP);
            Combo += n;
            BestCombo = Math.Max(BestCombo, Combo);   // 通關成績的「最高連擊」
            ComboT = COMBO_T;
        }
        public void SpawnFireball(double x, double y, double dir, string form, double vy = 0)
        {
            Sfx("shot:" + form);
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
                if (Rank("slime", "g_ground") != 0) Hazards.AddTemp("goo", Pf.Round(x), Map.FloorAt(x, y - 8), 40, 3);
                if (Rank("slime", "g_split") != 0) foreach (double vy in new[] { -140.0, 0, 140 }) SpawnShotlet(x, y, vy != 0 ? s.Dir : -s.Dir, "slime", vy, 0.5, 0.28);
            }
        }
        // ---- 技能樹的世界效果
        public void GroundSlam(double x, double y, double r, double mult)
        {
            double fy = Map.FloorAt(x, y - 8);
            SpawnLive("ground-slam", Pf.Round(x), Pf.Round(fy), new FxOptions { Palette = METAL7, Light = 0.4, Seed = Pf.ToInt32(Rnd.Next() * 99) }, 1.8);
            Fx.Shake(0.25, 3); Sfx("land:true");
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
        public void SwitchForm(string id)
        {
            if (id == null || id == Player.Form || !FormsOwned.ContainsKey(id) || Ult.On) return;
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
        public void Land(double x, double y, bool hard) { Sfx(hard ? "land:true" : "land"); Combat.Dust("land", x, y, hard); Props.Landing(x, y, hard); Scenery.Landing(x, y, hard); }
        public void Dust(double x, double y, int n) { Fx.Spawn(Baked.Anim("dust"), Pf.Round(x), Pf.Round(y), Rnd.Next() < 0.5, speed: 1.8); }
        public void DropCoins(double x, double y, int n) { CoinList.Drop(x, y, n); }
        static readonly Dictionary<string, string> CORE_FROM = new Dictionary<string, string> { ["slime"] = "slime", ["bat"] = "bat", ["trash"] = "can", ["hog"] = "spike", ["shroom"] = "bat" };   // 毒菇怪：毒的核拿來升級蝠翼星（第 2 章小怪不給新形態）
        /// forms.js 的 coreChance：還沒有這個形態時比較容易掉
        (string id, double p) CoreChance(string kind)
        {
            if (!CORE_FROM.TryGetValue(kind, out var id)) return (null, 0);
            bool owned = FormsOwned.ContainsKey(id);
            double b = kind == "trash" ? (owned ? 0.12 : 0.3) : kind == "hog" ? (owned ? 0.08 : 0.2) : owned ? 0.03 : 0.08;
            return (id, b);
        }
        public int PityLegend;
        /// 傳說保底：菁英 0.5%，每隻沒掉傳說的菁英 +0.5%
        bool EliteLegend()
        {
            if (Rnd.Next() < 0.005 * (1 + PityLegend)) { PityLegend = 0; return true; }
            PityLegend++;
            return false;
        }
        public void OnKill(Enemy e)
        {
            Kills++;
            if (e.SqT > 0) Fx.HitStop(0.08);   // 直接打死的停久一點
            bool lastOne = Director?.Lock != null && Director.Wave >= Director.Waves.Count && Alive(Director.Lock) == 0;
            if (e.Elite || lastOne) { Fx.HitStop(0.11); SlowT = Math.Max(SlowT, 0.45); }
            MythKill();
            QuestProgress("kill", e.Kind, e.Elite);
            if (Kills == 30) Say.Show("系統：……三十隻了。你真的只是一塊碎片嗎？");
            if (Kills == 100) Say.Show("系統：好啦，我承認你有一點點厲害。");
            if (e.Kind == "gold") Say.Show("系統：金幣史萊姆！今晚加菜！");
            GainXp((KILL_XP.TryGetValue(e.Kind, out var kx) ? kx : 5) * (e.Elite ? 4 : 1));
            var (coreId, coreP) = CoreChance(e.Kind);
            if (e.Core != null) { var bb = e.Box(); Drops.Add(Items.MakeCore(e.Core), e.X, (bb.y0 + bb.y1) / 2, 1); }   // 關卡指定必掉
            else if (coreId != null && !StageD.Paced && Rnd.Next() < (e.Elite ? Math.Min(1, coreP * 4) : coreP)) { var bb = e.Box(); Drops.Add(Items.MakeCore(coreId), e.X, (bb.y0 + bb.y1) / 2); }
            var b = e.Box(); double cy = (b.y0 + b.y1) / 2;
            if (e.Elite || Rnd.Next() < (DROP_RATE.TryGetValue(e.Kind, out var dr) ? dr : 0.1) * (1 + Player.S.Mf / 200))
            {
                int minR = e.Kind == "gold" || e.Elite ? Items.FINE : 0;
                if (e.Elite && EliteLegend()) { int il = IlvlNow(1); DropItem(e.X, cy, minR, il, Items.LEGEND); }
                else if (e.Elite && Rnd.Next() < 0.03) { int il = IlvlNow(1); DropItem(e.X, cy, minR, il, Items.EPIC); }
                else { int il = IlvlNow(e.Kind == "trash" || e.Elite ? 1 : 0); DropItem(e.X, cy, minR, il); }
            }
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
        // ---- 毒菇怪噴的毒雲：留 2.6 秒，主角站在裡面每 0.5 秒扣一次血
        class SporeCloud { public double X, Y, T, Tick, Dmg, R; }
        readonly List<SporeCloud> spores = new List<SporeCloud>();
        public void SporePuff(double x, double y, double dmg, bool elite)
        {
            double R = elite ? 46 : 34;
            var fx = SpawnLive("poison-cloud", Pf.Round(x), Pf.Round(y), new FxOptions { Light = 0.35, Seed = Pf.ToInt32(Rnd.Next() * 99) }.Set("spread", R / 80), 1.2);
            After(2300, () => fx?.Stop());
            spores.Add(new SporeCloud { X = x, Y = y, T = 2.6, Tick = 0.25, Dmg = dmg * (elite ? 1.5 : 1), R = R });
            SceneLight.AddFlash(x, y - 10, 50, 1.6, 0.3, "#c8f05a");
            Sfx("squish");
        }
        void UpdateSpores(double dt)
        {
            for (int i = spores.Count - 1; i >= 0; i--)
            {
                var c = spores[i];
                c.T -= dt;
                if ((c.Tick -= dt) <= 0) { c.Tick = 0.5; if (Math.Abs(Player.X - c.X) < c.R && Player.Y > c.Y - 40 && Player.Y < c.Y + 10) Player.PoisonTick(c.Dmg, this); }
                if (c.T <= 0) spores.RemoveAt(i);
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
            Combo = 0;
            if (Player.Hp <= 0) PlayerDied();
        }
        public void Sfx(string name) { OnSfx?.Invoke(name); }

        // ---- 看得到的範圍（畫布座標）：放大 ZOOM 倍後四周被裁掉
        public const double TOWN_ZOOM = 1.0;
        public const double ZOOM_BOSS = 1.2;   // 王戰時鏡頭稍微拉遠（王房比一個畫面寬）
        public static double Zoom = ZOOM;       // 現在的放大倍率（王戰時慢慢變成 ZOOM_BOSS）
        public static (double x0, double y0, double w, double h) ViewRect()
        {
            double vw = W / Zoom, vh = H / Zoom, my = (H - vh) / 2;
            return ((W - vw) / 2, my + Math.Min(VIEW_DY, my), vw, vh);
        }
        void SnapCam()
        {
            if (Town || Endless) return;
            var v = ViewRect(); double gy = Map.FloorAt(Player.X, Math.Max(0, Player.Y));
            camLand = Player.Grounded ? (double?)null : gy; camRefY = gy; lookX = Player.Face * 36;
            CamX = Math.Max(-v.x0, Math.Min(Data.W - v.x0 - v.w, Player.X - W / 2.0));
            if (Director?.Lock != null) CamX = Math.Max(Director.Lock.Value.l - v.x0, Math.Min(Director.Lock.Value.r - v.x0 - v.w, CamX));
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
            // 王戰時慢慢拉遠、打完慢慢拉回來
            double zt = Director?.Lock != null && StageD.ArenaInfo != null ? ZOOM_BOSS : ZOOM;
            if (Zoom != zt) Zoom += Math.Sign(zt - Zoom) * Math.Min(Math.Abs(zt - Zoom), 0.5 * dt);
            var v = ViewRect();
            CamX = DeadFollow(CamX + W / 2.0, Player.X + LookAhead(dt, 36), 14, 5, dt) - W / 2.0;
            CamX = Math.Max(-v.x0, Math.Min(Data.W - v.x0 - v.w, CamX));
            if (Director?.Lock != null) CamX = Math.Max(Director.Lock.Value.l - v.x0, Math.Min(Director.Lock.Value.r - v.x0 - v.w, CamX));
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
                    if (a.K.Fly != b.K.Fly || a.IsBoss || b.IsBoss) continue;
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

        /// 主迴圈的一步（main.js 的 loop：慢動作時世界走 0.35 倍）＋畫一格＋提示計時
        public void Step(Frame frame)
        {
            Tick(SlowT > 0 ? STEP * 0.35 : STEP);
            SlowT -= STEP;
            Render(frame);
            Hud(STEP);
        }
        /// main.js 的 hud(dt)：系統台詞的計時
        public void Hud(double dt) { Say.Hud(dt); }
        /// 載入畫面還蓋著的時候先跑幾格（main.js 載入完的暖機：tick(0)、畫、hud(0) 六次，畫面時間歸零）
        public void Warm(Frame frame)
        {
            double c0 = sceneClock;
            for (int i = 0; i < 6; i++) { Tick(0); Render(frame); Hud(0); }
            sceneClock = c0;
        }
        public double LowHpK = 1, LowHpPhase = 0.99, LowHpPulse;
        /// 一步（固定 1/60 秒；慢動作時比較短）
        public void Tick(double dt)
        {
            Input.Tick(dt);
            if (Fx.ShakeT > 0) Fx.ShakeT -= dt;
            if (Fx.Freeze > 0) { Fx.Freeze -= dt; return; }
            if (!Started) return;
            Prof.Mark("L:按鍵"); Combat.Update(dt); Prof.Mark("L:戰鬥");
            if (Town) { TownTick(dt); Prof.Mark("L:城鎮"); return; }
            SceneLight.Update(dt);
            Status.Update(dt);
            Prof.Mark("L:狀態"); UpdateStageObjectsEarly(dt); Prof.Mark("L:場景物件前");   // 元素場景物件、死亡碎片
            LowHpK = Player.Hp > 0 && !(Player.HideT > 0) ? Player.Hp / Player.MaxHp : 1;
            if (LowHpK < 0.3) { LowHpPhase += dt * (1.2 + 1.2 * (1 - LowHpK / 0.3)); if (LowHpPhase >= 1) { LowHpPhase -= 1; Sfx("heart"); } LowHpPulse = HeartBeat(LowHpPhase); } else { LowHpPhase = 0.99; LowHpPulse = 0; }
            if (NoManaT > 0) NoManaT -= dt;
            // 大招進行中：世界停住，只有主角、特效和鏡頭在動
            if (Ult.On)
            {
                Ult.Update(dt, Player);
                SceneLight.GlobalLv = Ult.GlobalLv;
                Enemies.RemoveAll(e => e.Dead);
                Fx.Update(dt);
                FollowCam(dt);
                Say.Update();
                return;
            }
            if (PendingForm != null) { SwitchForm(PendingForm); PendingForm = null; }
            ultCd -= dt;
            bool ultReady = Player.Mp >= Ult.ULT_MP && !Ult.On && ultCd <= 0;
            if (!ultTipped && ultReady && Kills >= 3 && (StageId != "1-1" || (Director?.UltOK ?? false))) { ultTipped = true; Teach("ult"); Say.Push("系統：" + (IsTouch ? "魔力夠了就能放大招！按【大招】，讓牠們見識一下星星的厲害。" : "魔力夠了就能放大招！按【Q】，讓牠們見識一下星星的厲害。"), 2.6, "ult"); }
            if (Input.Ult && !ultReady && !Ult.On) { Input.Consume("ult"); if (Player.Mp < Ult.ULT_MP) NoMana(); }
            if (Input.Ult && ultReady && Player.State != "hurt")
            {
                Input.Consume("ult");
                Player.Mp -= Ult.ULT_MP; ultCd = 1;
                Ult.Start(Player);
                if (Player.Set4("reson")) Player.ResonT = 10;   // 星辰共鳴 4 件
                // 星王之冠：星王化（8 秒，覺醒 2 階 12 秒；3 階退回一半的大招魔力）
                var crown = MythOn("starking");
                if (crown != null) { int st = Items.AwakenStage(crown); Player.KingT = st >= 2 ? 12 : 8; if (st >= 3) Player.Mp = Math.Min(Player.MaxMp, Player.Mp + Ult.ULT_MP / 2); Say.Show("星王化！", 1.6); }
                Sfx("ultCharge");
                return;
            }
            UseInput();
            Prof.Mark("L:其他"); Player.Update(dt, this); Prof.Mark("L:主角");
            UpdateStageObjectsPlayer(dt); Prof.Mark("L:草叢木箱");   // 草叢、木箱（props）、小生物（scenery）
            UpdateUniques(dt);
            UpdateChest(dt);
            UpdateGems(dt);
            Drops.Update(dt, Player, 16, Map, PickUp);
            UpdateAbsorb(dt); Prof.Mark("L:寶箱掉落吸收");
            if (Endless) SpawnEnemies(dt);
            else { StatTime += dt; var v = ViewRect(); Director?.Update(dt, Player, CamX + v.x0, v.w); }
            Prof.Mark("L:出怪");
            // 戰鬥區封鎖：主角出不去
            if (Director?.Lock != null) Player.X = Math.Max(Director.Lock.Value.l + 10, Math.Min(Director.Lock.Value.r - 10, Player.X));
            for (int ei = 0; ei < Enemies.Count; ei++)   // 照 JS 的 for…of：迴圈中新加的怪（王分裂）同一格也會跑到
            {
                var e = Enemies[ei];
                if (e.Dead) continue;
                e.Update(dt, Player, this);
                bool rolling = e.Hog == "roll";   // 刺蝟滾過來比較痛；撞到人就停下來展開
                if (e.K.Dmg > 0 && (e.Stun <= 0 || rolling) && e.HitBox().Overlaps(new Box(Player.X - 8, Player.X + 8, Player.Y - 22, Player.Y)) && Player.Hurt(rolling ? e.K.RollDmg : e.K.Dmg, e.X, this))
                {
                    e.Vx = (e.X >= Player.X ? 1 : -1) * 120;
                    e.Stun = 0.4;
                    if (rolling) e.RollHit = true;
                }
            }
            Prof.Mark("L:怪"); UpdateSpores(dt); Separate(dt); Prof.Mark("L:推開");
            UpdateCoreFx(dt);
            UpdateAltars();
            UpdatePlug(dt);
            UpdateStageObjectsLate(dt); Prof.Mark("L:機關祭壇");   // 形態機關（features）
            foreach (var e in Enemies)
            {
                if (e.Dead) continue;
                var lk = Director?.Lock;
                bool inLock = lk != null && (StageD.ArenaInfo == null || (e.X > lk.Value.l && e.X < lk.Value.r && e.Y > StageD.ArenaInfo.Floor - 220));
                if (inLock && (e.X < lk.Value.l + 12 || e.X > lk.Value.r - 12))
                {
                    e.Xp = Math.Max(lk.Value.l + 12, Math.Min(lk.Value.r - 12, e.X));
                    if (e.Kind == "gold") e.HopDir = -e.HopDir;
                }
                // 金幣史萊姆 10 秒沒抓到就逃走
                if (e.Kind == "gold" && e.AwakeT > 10)
                {
                    e.Dead_ = true;
                    Fx.Spawn(Baked.Anim("poofGold"), Pf.Round(e.X), Pf.Round(e.Y));
                    Say.Unshift("系統：金幣史萊姆逃走了……我的晚餐……", 2.5);
                }
            }
            Enemies.RemoveAll(e => e.Dead);
            // 技能彈：直線飛，撞到怪或地形就爆開（範圍傷害、擊飛、沾元素）
            for (int si = 0; si < Shots.Count; si++)   // 跟 JS 一樣：迴圈中途加進來的小彈（彈跳、分裂）同一步也會處理
            {
                var s = Shots[si];
                s.X += s.Dir * 290 * dt;
                if (s.Vy != 0) s.Y = Math.Min(Map.FloorAt(s.X, s.Y) - 6, s.Y + s.Vy * dt);
                s.Life -= dt;
                s.Fx.Options.X = Pf.Round(s.X); s.Fx.Options.Y = Pf.Round(s.Y);
                bool hit = s.Life <= 0 || Features.ShotAt(s.X, s.Y, s.Form) || Map.SolidAt(s.X, s.Y);
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
            Shots.RemoveAll(s => s.Done); Prof.Mark("L:怪後＋技能彈");
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
            Prof.Mark("L:技能樹金幣"); Fx.Update(dt); Prof.Mark("L:特效更新");
            if ((ComboT -= dt) <= 0 && Combo != 0) Combo = 0;
            HitTune = Math.Pow(2, Math.Min(8, Math.Floor(Combo / 5.0)) / 12);   // 連擊越高打擊音越高（每 5 連擊升半音，最多 8 個半音）
            FollowCam(dt);
            Say.Update();
        }
        /// lowhpfx.js 的 beat：心跳（咚、咚）
        static double HeartBeat(double phase)
        {
            double p1 = phase < 0.5 ? Pf.Exp(-phase * 14) : 0, p2 = phase > 0.18 && phase < 0.7 ? 0.6 * Pf.Exp(-(phase - 0.18) * 14) : 0;
            return Math.Min(1, p1 + p2);
        }

        /// 合成之後（大招落地的黑白衝擊定格）
        public void PostComposite(byte[] rgba) => Ult.PostProcess(rgba);

        /// 畫一格（main.js 的 render），結果在 frame 裡（還沒合成）
        public void Render(Frame frame)
        {
            var (sx, sy) = Fx.ShakeOffset();
            frame.Ox = (int)Pf.Round(CamX) + sx;
            frame.Oy = (int)Pf.Round(CamY) + sy;
            Array.Clear(frame.Light, 0, frame.Light.Length);
            sceneClock += 1 / 60.0;
            var lights = Town ? TownArt.Lights(sceneClock) : Art.SceneLights(CamX, W, sceneClock);
            lights.Add(new LightSrc(Player.X, Player.Y - 10, 64, 1.6, "#ffcf6a"));
            foreach (var e in Enemies) e.Lights(lights);
            foreach (var e in Enemies) if (e.Elite && !e.Dead) lights.Add(new LightSrc(e.X, e.Y - 10, 36, 1.2, "#ff4a3a"));
            foreach (var s in Shots) lights.Add(new LightSrc(s.X, s.Y, 64, 3, (SHOT_PAL.ContainsKey(s.Form) ? SHOT_PAL[s.Form] : SHOT_PAL["star"]).light));
            foreach (var d in Drops.List) if (d.Landed && d.Item.Rarity >= Items.RARE) lights.Add(new LightSrc(d.X, d.Y - 10, d.Item.Rarity == Items.LEGEND ? 48 : 30, 2, Items.RARITY[d.Item.Rarity].Color));
            Ult.Lights(lights);
            StageLights(lights);   // props、scenery、features
            foreach (var a in Altars) lights.Add(a.Lit ? new LightSrc(a.X, a.Y - 18, 70, 2.4, "#ffd060") : new LightSrc(a.X, a.Y - 14, 26, 0.8, "#7488aa"));
            Prof.Mark("邏輯");
            var lv = SceneLight.Compute(frame, lights);
            Prof.Mark("光源");
            if (Town) TownArt.Draw(frame, lv, sceneClock);
            else { Art.Draw(frame, lv); }
            Prof.Mark("場景");
            if (!Town) Art.DrawAtmosphere(frame, sceneClock);
            Prof.Mark("大氣");
            foreach (var a in Altars) if (Math.Abs(a.X - CamX - W / 2.0) < W) DrawAltar(frame, a);
            Prof.Mark("S:祭壇"); DrawPlug(frame);   // 王房屋頂的垃圾塞子
            DrawStageObjects(frame, lv);   // features、props、scenery、hazards
            if (Town) DrawTownPeople(frame);
            else if (UseT != null) DrawBang(frame, UseT.X, UseT.Top);
            Prof.Mark("S:人"); if (Chest != null && !Chest.Opened && Math.Abs(Chest.X - CamX - W / 2.0) < W) DrawChestSolid(frame); Prof.Mark("S:寶箱");
            Prof.Mark("場景物件");
            if (!Ult.On) Fx.Draw(frame, true);
            Drops.Draw(frame, sceneClock);
            foreach (var d in Drops.List) if (d.Item.Kind == "formcore" && d.Hold > 0 && d.HasCenter) CoreArt.DrawBeams(frame, d.Cx, d.Cy, Player.X, Player.Y - 12, sceneClock, d.Item.Form, d.Hold);
            Prof.Mark("背景特效");
            // 2026-11-12：怪物描一圈深色外框＋左上邊緣光，跟水晶、草、其他怪疊在一起時還分得出來
            if (!Town) TownArt.SnapPeople(frame);
            foreach (var e in Enemies) e.Draw(frame, Fx, SimMs);
            if (!Town) TownArt.OutlineActors(frame, 0.34, 0xff200c0e);
            Status.DrawBolts(frame);
            foreach (var w in Waves) StarWave.Draw(frame, w);
            foreach (var m in Minis) MiniBat.Draw(frame, m);
            foreach (var e in Enemies) if (e.MeteorMark > 0 && !e.Dead) SetFx.DrawMark(frame, e.X, e.Box().y0 - 7, sceneClock);
            foreach (var s in Strikes) SetFx.DrawStrike(frame, s.X, s.Y, s.T);
            CoreFx.DrawTrail(frame, Trail);
            foreach (var e in Enemies) if (e.DizzyT > 0 && !e.Dead) CoreFx.DrawDizzy(frame, e.X, e.Box().y0 - 4, sceneClock);
            if (Player.Shield > 0) SetFx.DrawShield(frame, Player.X, Player.Y - 12, Player.Shield / (Player.MaxHp * 0.2), sceneClock);
            if (Player.ResonT > 0) SetFx.DrawReson(frame, Player.X, Player.Y - 12, sceneClock);
            CoinList.Draw(frame, StatTime);
            Gems.Draw(frame, GemList, StatTime);
            Prof.Mark("怪");
            if (Ult.On) { Ult.DimScene(frame); Prof.Mark("暗場"); Fx.Draw(frame, true); Prof.Mark("背景特效"); }   // 大招：先畫怪再暗場，法陣這些背景特效畫在暗場之後才會亮
            if (Player.KingT > 0) SetFx.DrawKingBack(frame, Player.X, Player.Y - 12, sceneClock);   // 星王化：光芒在主角後面
            Player.Draw(frame);
            if (Town && townPeopleDrawn) { TownArt.OutlinePeople(frame); townPeopleDrawn = false; }
            DrawDeathFx(frame);
            if (Player.KingT > 0) SetFx.DrawKingFront(frame, Player.X, Player.Y - 12, sceneClock);
            Prof.Mark("主角");
            Fx.Draw(frame, false);
            Prof.Mark("前景特效");
            Combat.Form = Player.Form;
            Combat.Draw(frame);
            Prof.Mark("戰鬥小特效");
            Ult.Draw(frame);
            Prof.Mark("大招畫");
            if (!Town) DrawLowHp(frame);
            if (Town) { TownArt.DrawWeather(frame, sceneClock); TownArt.DrawFg(frame); }
            if (Director?.Lock != null) DrawBarrier(frame, Director.Lock.Value);
            if (!Town) Art.DrawForeground(frame);
            Combat.DrawNumbers(frame, ViewRect());
            Prof.Mark("前景");
            Ult.DrawCutIn(frame);
            Prof.Mark("特寫帶");
        }
        // ---- 場景物件的畫法、光（props.js、scenery.js、hazards.js、features.js、altar-art.js、objglow.js、deathfx.js、lowhpfx.js、寶箱）：搬好之後接上
        partial void StageLights(List<LightSrc> lights);
        partial void DrawAltar(Frame frame, Altar a);
        partial void DrawStageObjects(Frame frame, float[] lv);
        partial void DrawChestSolid(Frame frame);
        partial void DrawDeathFx(Frame frame);
        partial void DrawLowHp(Frame frame);
        partial void UpdateStageObjectsEarly(double dt);
        partial void UpdateStageObjectsPlayer(double dt);
        partial void UpdateStageObjectsLate(double dt);
    }
}
