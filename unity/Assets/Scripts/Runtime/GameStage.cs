// main.js 的關卡流程部分翻成 C#：stageApi（給 Director 用）、星之祭壇、寶箱、寶石、金幣堆、傳送門、互動鍵、死掉重來、主線任務、系統台詞。
// 跟 Game.cs 是同一個類別（partial），分開放比較好找。
using System;
using System.Collections.Generic;
using System.Linq;
using PixelFX;

namespace ZeroStar
{
    public partial class Game : IStageApi
    {
        public StageData StageD;
        public Director Director;
        public readonly SayQueue Say = new SayQueue();
        public bool Started, Cleared, StageDone, Leaving, IsTouch;
        bool placing;
        public double SlowT;   // 慢動作（傳說掉落、打倒菁英、清掉最後一隻）
        public double StatTime; public int Deaths;
        public readonly HashSet<string> Taught = new HashSet<string>();
        public bool TipUse, SeenSet, SeenCoreTip; bool ultTipped;
        public readonly HashSet<string> Reacted = new HashSet<string>();
        public readonly HashSet<string> Cleared_ = new HashSet<string>();   // 打過的關卡（profile.cleared）
        public readonly HashSet<string> SysDone = new HashSet<string>();     // 完成的主線（profile.quests.sysDone）

        // ---- 星之祭壇
        public class Altar { public double X, Y, Pulse; public bool Lit; }
        public readonly List<Altar> Altars = new List<Altar>();
        public Altar CheckpointAltar;
        // ---- 寶箱
        public class ChestState { public double X, Y, T; public int Tier; public bool Opened; }
        public ChestState Chest;
        public readonly List<ZeroStar.Coins.Coin> GemList = new List<ZeroStar.Coins.Coin>();
        // ---- 傳送門
        public double? PortalX; public double PortalY;
        static readonly Dictionary<string, int> STAGE_CHEST = new Dictionary<string, int> { ["1-1"] = 0, ["1-2"] = 1, ["1-3"] = 2 };

        /// 建立關卡流程需要的東西（祭壇、寶箱、傳送門），照 main.js 載入時的順序
        void InitStage(string id)
        {
            StageD = id == "town" ? StageData.Empty("town") : StageData.Get(id);
            Say.Paced = StageD.Paced;
            if (StageD.Altars != null) foreach (var a in StageD.Altars) Altars.Add(new Altar { X = a.X, Y = a.Y ?? Map.FloorAt(a.X, 0) });
            if (id == "town") return;
            if (id != "1-4") Chest = MakeChest(StageD.ExitX - 120, STAGE_CHEST.TryGetValue(id, out var ct) ? ct : 0, Map.FloorAt(StageD.ExitX - 120, (StageD.ExitY != 0 ? StageD.ExitY : Data.Floor) - 8));
            if (id != "1-4") { PortalX = StageD.ExitX + 26; PortalY = StageD.ExitY != 0 ? StageD.ExitY : Data.Floor; }
        }
        /// main.js 的 start()：擺怪、開場台詞
        public void StartStage()
        {
            Started = true;
            if (Town) TownArrive();
            else { placing = true; Director = new Director(StageD, this, IsTouch); placing = false; }
            SnapCam();
        }
        static ChestState MakeChest(double x, int tier, double y) => new ChestState { X = Pf.Round(x), Y = y, Tier = tier };

        // ---- IStageApi
        public Enemy SpawnEnemy(string kind, double x, double? y, bool air = false)
        {
            double gy = Map.FloorAt(x, y != null ? y.Value - 4 : 0);
            double yy = air ? gy - 60 - Rnd.Next() * 30 : y ?? gy;
            Enemy e = kind == "boss" ? new Boss(x, StageD.ArenaInfo?.Floor ?? Data.Floor, this) : new Enemy(kind, x, yy);
            e.X0 = x;
            Enemies.Add(e);
            if (Started && !placing) Dust(e.X, e.K.Fly ? e.Y + 8 : e.Y, 4);
            return e;
        }
        void IStageApi.Say(string msg, double sec, string focus) => Say.Push(msg, sec, focus);
        public void Hint(string msg, double sec) { OnHint?.Invoke(msg, sec); }
        public Action<string, double> OnHint;
        public void Teach(string k) { if (Taught.Add(k)) Sfx("chime"); }
        public bool CoreLeft() => Drops.List.Any(d => d.Item.Kind == "formcore" && !d.Got);
        public bool CoreNear(Player p) => Drops.List.Any(d => d.Item.Kind == "formcore" && !d.Got && d.Landed && Math.Abs(d.X - p.X) < 70);
        public bool Busy(double x, double y, double before) => Enemies.Any(e => !e.Dead && e.Awake && e.Kind != "gold" && e.X0 < before && Math.Abs(e.X - x) < 220 && Math.Abs(e.Y - y) < 120);
        public bool Talking() => Say.Talking();
        public void Cut() => Say.Cut();
        public int Alive((double l, double r)? lk)
        {
            int n = 0;
            foreach (var e in Enemies) if (!(e.Dead || e.Kind == "gold" || (lk != null && !e.IsBoss && (e.X < lk.Value.l || e.X > lk.Value.r || (StageD.ArenaInfo != null && e.Y < StageD.ArenaInfo.Floor - 220))))) n++;
            return n;
        }
        public void DropCache(double x, double y, int n)
        {
            for (int i = 0; i < n; i++) CoinList.List.Add(new ZeroStar.Coins.Coin { X = x + (i - (n - 1) / 2.0) * 6, Y = y - (i % 2) * 4, Still = true });
        }
        /// 走到出口：傳送門開了（main.js 的 showClear）
        public void Clear()
        {
            if (StageDone) return;
            StageDone = true;
            Cleared_.Add(StageD.Id); Clears++;
            Sfx("jingle=clear");   // 通關的小段音樂
            QuestProgress("clear", stage: StageD.Id, deaths: Deaths);
            if (PortalX == null) OpenBossPortal();   // 1-4：打倒王之後在主角前面開傳送門
            Say.Queue.Clear();
            Say.Show("系統：傳送門開了。走過去按互動，回碎星鎮。", 2.6);
        }

        // ---- 主線任務（quests.js 的 SYSTEM：一次一個，條件達成就自動完成、給獎勵、系統吐槽）
        public static readonly (string id, string title, string say, int coins, int scrap, int xp)[] SYSTEM =
        {
            ("out11", "離開墜落之底", "出來了。……外面比我想的還亮。", 0, 0, 30),
            ("reg", "登記冒險者", "登記好了。F 級。……從谷底開始，很適合你。", 50, 0, 0),
            ("guild1", "第一份工作", "第一份薪水。我建議你存起來。……你不會聽的。", 60, 0, 40),
            ("core1", "吸收的滋味", "你把魔物的靈核吃掉了。……我是說吸收。差不多啦。", 0, 10, 0),
            ("forge2", "叮叮噹噹", "強化成功。岩叔的手還沒裂，很好。", 80, 0, 0),
            ("meal1", "吃飽才有力氣", "星星需要吃東西嗎？……我也不知道，但你吃得很開心。", 0, 8, 0),
            ("reroll1", "不滿意就重來", "重鑄是一種賭博。我什麼都沒說。", 100, 0, 0),
            ("rankE", "脫離 F 級", "E 級了。波波推眼鏡的次數好像變少了。", 80, 0, 120),
            ("forms3", "百變星星", "三個形態。你現在是一顆很忙的星星。", 0, 20, 0),
            ("boss1", "大胃王", "第一章的王倒了。……我開始覺得你有點東西了。", 300, 30, 200),
        };
        bool SysCheck(string id)
        {
            switch (id)
            {
                case "out11": return Cleared_.Contains("1-1");
                case "reg": return GuildRegistered;
                case "guild1": return GuildDone >= 1;
                case "rankE": return GuildDone >= 3;
                case "forge2": return Quests.EnhanceMax >= 2;
                case "meal1": return Quests.Meals >= 1;
                case "reroll1": return Quests.Rerolls >= 1;
                case "core1": return FormsOwned.Count >= 2;
                case "forms3": return Carry.Length >= 3;
                case "boss1": return Cleared_.Contains("1-4");
                default: return false;   // 城鎮的條件（登記、工坊、旅館）在關卡裡不會變
            }
        }
        /// 開場動畫播過了：1-1 一開始的台詞（轉生成功、種族星靈）不用再講，直接接第一句教學（main.js 的 STAGE.intro = []）
        public void SkipStageIntro()
        {
            Say.Queue.RemoveAll(q => StageD.Intro.Contains(q.msg));
            foreach (var m in StageD.Intro) if (m.StartsWith("系統：") && Say.Sys == m.Substring(3)) { Say.Sys = null; Say.SysT = Say.ToastT = 0; }
        }
        /// 主線追蹤：還沒完成的第一個主線的名稱（全部完成＝null）
        public string MainQuestTitle() { foreach (var s in SYSTEM) if (!SysDone.Contains(s.id)) return s.title; return null; }
        /// 跟 QuestProgress 一樣，但在對話中：主線完成的台詞回傳回來讓對話當場講（main.js 的 questProgress(ev, d, true)）
        public List<string> QuestProgressLines()
        {
            var lines = new List<string>();
            foreach (var s in SYSTEM)
            {
                if (SysDone.Contains(s.id)) continue;
                if (SysCheck(s.id))
                {
                    SysDone.Add(s.id);
                    Money += s.coins; Scrap += s.scrap; if (s.xp > 0) GainXp(s.xp);
                    Sfx("chime");
                    var rw = string.Join("、", new[] { s.coins > 0 ? $"{s.coins} 金幣" : null, s.scrap > 0 ? $"{s.scrap} 星塵" : null, s.xp > 0 ? $"{s.xp} 經驗" : null }.Where(t => t != null));
                    lines.Add($"主線「{s.title}」完成。{s.say}（{rw}）");
                }
                break;
            }
            return lines;
        }
        public void QuestProgress(string ev, string kind = null, bool elite = false, string stage = null, int deaths = 0)
        {
            foreach (var q in Quests.Event(ev, kind, elite, stage, deaths)) Say.Push($"系統：公會任務「{q.Title}」完成！回公會找波波交付。", 2.6);
            foreach (var s in SYSTEM)
            {
                if (SysDone.Contains(s.id)) continue;
                if (SysCheck(s.id))
                {
                    SysDone.Add(s.id);
                    Money += s.coins; Scrap += s.scrap; if (s.xp > 0) GainXp(s.xp);
                    Sfx("chime");
                    var rw = string.Join("、", new[] { s.coins > 0 ? $"{s.coins} 金幣" : null, s.scrap > 0 ? $"{s.scrap} 星塵" : null, s.xp > 0 ? $"{s.xp} 經驗" : null }.Where(t => t != null));
                    Say.Unshift($"系統：主線「{s.title}」完成。{s.say}（{rw}）", 3.6);
                }
                break;   // 一次只看第一個還沒完成的
            }
        }

        // ---- 互動鍵：傳送門、星之祭壇、寶箱（站在旁邊按 F；手機是攻擊鍵）
        public class Use { public string Kind; public double X, Top; public Action Go; }
        public Use UseT; string useKind = ""; bool prevUseAtk, prevUseKey, fLock;
        bool CanOpenChest() => Chest != null && !Chest.Opened && Math.Abs(Player.X - Chest.X) < 24 && Math.Abs(Player.Y - Chest.Y) < 20 && Player.Grounded && Director?.Lock == null && !Enemies.Any(e => !e.Dead && e.Kind != "gold" && Math.Abs(e.X - Chest.X) < 160 && Math.Abs(e.Y - Chest.Y) < 80);
        Use FindUse()
        {
            if (!Player.Grounded || Player.HideT > 0 || Ult.On) return null;
            var c = new List<Use>();
            if (CanOpenChest()) c.Add(new Use { Kind = "chest", X = Chest.X, Top = Chest.Y - 34, Go = OpenChest });
            if (StageDone && !Leaving && PortalX != null && Math.Abs(Player.X - PortalX.Value) < 16 && Math.Abs(Player.Y - PortalY) < 20) c.Add(new Use { Kind = "door", X = PortalX.Value, Top = PortalY - 48, Go = LeaveStage });
            foreach (var a in Altars) if (!a.Lit && Math.Abs(Player.X - a.X) < 16 && Math.Abs(Player.Y - a.Y) < 24) { var aa = a; c.Add(new Use { Kind = "hand", X = a.X, Top = a.Y - 44, Go = () => UseAltar(aa) }); }
            foreach (var u in StageUsables()) c.Add(u);
            Use best = null;
            foreach (var o in c) if (best == null || Math.Abs(o.X - Player.X) < Math.Abs(best.X - Player.X)) best = o;
            return best;
        }
        /// 場景機關（features.js）可以用的東西：等機關搬好接上
        public Func<IEnumerable<Use>> FeatureUsables;
        IEnumerable<Use> StageUsables() => FeatureUsables?.Invoke() ?? Enumerable.Empty<Use>();
        /// 在 player.update 之前攔截：剛按下那一下用掉旁邊的東西
        void UseInput()
        {
            bool atk = Input.Attack, key = Input.Absorb;
            UseT = FindUse();
            string kind = UseT?.Kind ?? "";
            if (kind != useKind)
            {
                useKind = kind;
                if (kind != "" && !TipUse) { TipUse = true; Say.Unshift(IsTouch ? "系統：站在旁邊時右下角的鍵會換圖示、發亮——按一下就能用。門、祭壇、撿東西都一樣。" : "系統：站在旁邊時按【F】就能用。門、祭壇、寶箱都一樣——頭上有「！」的就是。", 3.6); }
            }
            if (IsTouch)
            {
                if (UseT != null && atk && !prevUseAtk) { Input.Attack = false; UseT.Go(); UseT = null; }
                else if (UseT != null) Input.Attack = false;
            }
            else if (UseT != null && key && !prevUseKey) { UseT.Go(); UseT = null; fLock = true; }
            if (fLock) { if (key) Input.Absorb = false; else fLock = false; }
            prevUseAtk = atk; prevUseKey = key;
        }
        public Action OnLeave;
        void LeaveStage()
        {
            Leaving = true;
            Sfx("form");
            SceneLight.AddFlash(PortalX.Value, PortalY - 16, 90, 3, 0.5, "#a8f0ff");
            OnLeave?.Invoke();
        }
        void UpdateAltars() { foreach (var a in Altars) if (a.Pulse > 0) a.Pulse = Math.Max(0, a.Pulse - STEP / 0.8); }
        /// 星之祭壇：生命、魔力回滿，設成重生點
        void UseAltar(Altar a)
        {
            Player.Hp = Player.MaxHp; Player.Mp = Player.MaxMp;
            CheckpointAltar = a;
            if (!a.Lit)
            {
                a.Lit = true;
                SpawnLive("collect-burst", a.X, a.Y - 18, new FxOptions { Palette = new[] { "#1e1206", "#4a2c08", "#86520c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff" }, Light = 0.6 });
                SceneLight.AddFlash(a.X, a.Y - 16, 110, 3, 0.8, "#ffe066"); Sfx("levelup");
                Say.Show("星之祭壇：啟動", 1.8);
            }
            else { SceneLight.AddFlash(a.X, a.Y - 16, 60, 2, 0.3, "#ffe066"); Sfx("chime"); Say.Show("星之祭壇：啟動", 1.4); }
        }

        // ---- 寶箱：0.8 秒時蓋子彈開，噴出金幣、寶石、裝備
        static readonly string[] CHEST_SAY = { "系統：木箱。……聊勝於無。", "系統：鐵箱！裡面應該不是垃圾吧。", "系統：紅漆金箱！我聞到錢的味道了。", "系統：星箱……！這是傳說中的那個嗎？" };
        public int PityMyth;
        void OpenChest()
        {
            Chest.Opened = true;
            Chest.T = 0;
            var T = StageData.ChestTiers[Chest.Tier]; var c = Chest;
            SpawnLive("treasure-chest", c.X, c.Y, ChestTiers.Opts(c.Tier), 1, back: true);
            Sfx("chest");
            After(800, () => { SceneLight.AddFlash(c.X, c.Y - 16, 80 + c.Tier * 30, 3, 1 + c.Tier * 0.4, T.Palette[5]); Fx.Shake(0.15 + c.Tier * 0.08, 2 + c.Tier); if (c.Tier >= 2) Sfx("rare"); });
            Say.Unshift(CHEST_SAY[c.Tier], 2.6);
        }
        void UpdateChest(double dt)
        {
            if (Chest == null || !Chest.Opened) return;
            double before = Chest.T;
            Chest.T += dt;
            if (before < 0.8 && Chest.T >= 0.8)
            {
                var T = StageData.ChestTiers[Chest.Tier];
                SpawnLoot(Chest.X, Chest.Y - 14, T.Coins, T.Gems, Chest.Tier);
                int k = 0;
                foreach (var (rar, n) in T.Items) for (int i = 0; i < n; i++, k++) { int r = Items.RarityOf(rar); int il = IlvlNow(1 + Chest.Tier); DropItem(Chest.X, Chest.Y - 12, r, il, r, k % 2 != 0 ? 1 : -1); }
                if (Chest.Tier >= 3)
                {
                    var c = Chest;
                    if (Rnd.Next() < 0.15) { int il = IlvlNow(2); DropItem(c.X, c.Y - 12, Items.LEGEND, il, Items.LEGEND, 1); }
                    if (Rnd.Next() < 0.03 || PityMyth >= 9) { PityMyth = 0; After(500, () => { int il = IlvlNow(2); DropItem(c.X, c.Y - 12, Items.MYTH, il, Items.MYTH, -1); }); }
                    else PityMyth++;
                }
            }
        }
        void SpawnLoot(double x, double y, int nCoins, int nGems, int tier)
        {
            double sp = 1 + tier * 0.25;
            for (int i = 0; i < nCoins; i++) { double vx = (Rnd.Next() - 0.5) * 220 * sp, vy = -150 - Rnd.Next() * 170 * sp; CoinList.List.Add(new ZeroStar.Coins.Coin { X = x, Y = y, Vx = vx, Vy = vy, Lay = true }); }
            for (int i = 0; i < nGems; i++)
            {
                int type = tier >= 3 && i % 3 == 0 ? 3 : (int)Math.Floor(Rnd.Next() * (tier >= 2 ? 4 : 3));
                double vx = (Rnd.Next() - 0.5) * 200 * sp, vy = -170 - Rnd.Next() * 160 * sp;
                GemList.Add(new ZeroStar.Coins.Coin { X = x, Y = y, Vx = vx, Vy = vy, Lay = true, Type = type });
            }
        }
        void UpdateGems(double dt)
        {
            foreach (var g in GemList)
                if (ZeroStar.Coins.LootPhysics(g, dt, Player, Map))
                {
                    var T = Gems.TYPES[g.Type];
                    Money += T.Val; Coins += T.Val;
                    Sfx("pickup");
                    SpawnLive("collect-burst", Pf.Round(g.X), Pf.Round(g.Y), new FxOptions { Palette = T.G, Light = 0.3 });
                }
            GemList.RemoveAll(g => g.Got);
        }

        // ---- 死掉：碎掉 → 黑幕 → 送回最後點亮的祭壇（沒點過＝關卡起點），打倒的怪不會回來
        public Action<double, double, string> OnShatter, OnRegather;   // 死亡碎片特效（deathfx.js）
        public Action<bool> OnFade;
        void PlayerDied()
        {
            Deaths++;
            (double x, double y)? to = CheckpointAltar != null ? (CheckpointAltar.X, CheckpointAltar.Y) : (StageD.StartX, Map.FloorAt(StageD.StartX, 0));
            to = BossDeath(to);   // 王戰中死掉：王和房裡的小怪收掉、解除封鎖；王融化中死掉：原地復活
            string col = FORM_COLOR.TryGetValue(Player.Form, out var cc) ? cc : "#ffd84a";
            OnShatter?.Invoke(Player.X, Player.Y, col);
            Fx.HitStop(0.12); Fx.Shake(0.35, 3); Sfx("crit");
            Player.HideT = 9; Player.Invuln = 10; Player.State = "move";
            After(550, () => OnFade?.Invoke(true));
            var altar = CheckpointAltar;
            After(900, () =>
            {
                if (to != null)
                {
                    Player.X = to.Value.x; Player.Y = to.Value.y; Player.Vx = Player.Vy = 0; Player.State = "move";
                    var v = ViewRect(); camRefY = null; lookX = Player.Face * 36;
                    CamX = Math.Max(-v.x0, Math.Min(Data.W - v.x0 - v.w, to.Value.x - W / 2.0));
                    if (Data.H > H) CamY = Math.Max(-v.y0, Math.Min(Data.H - v.y0 - v.h, to.Value.y - H * 0.62));
                }
                Player.Hp = Player.MaxHp; Player.Mp = Player.MaxMp;
                OnFade?.Invoke(false);
                OnRegather?.Invoke(Player.X, Player.Y, col);
                Player.HideT = 0.52; Player.Invuln = 2;
                After(480, () => { Sfx("levelup"); if (altar != null) { altar.Pulse = 1; SceneLight.AddFlash(altar.X, altar.Y - 16, 90, 3, 0.5, "#ffe066"); } });
            });
            Say.Show(CheckpointAltar != null ? "系統：你死了。……從祭壇重來吧，打倒的怪不會回來。" : "系統：你死了。……算了，當我沒看到，再給你一次機會。");
        }

        /// 「！」：旁邊有東西可以用
        void DrawBang(Frame f, double wx, double top)
        {
            int bob = (int)Math.Floor(sceneClock * 4) % 2, x0 = (int)Pf.Round(wx) - f.Ox - 1, y0 = (int)Pf.Round(top) - bob - f.Oy;
            uint C1 = Col.Hex("#ffd84a");
            for (int y = -1; y <= 9; y++) for (int x = -1; x <= 3; x++)
            {
                bool on = x >= 0 && x <= 2 && ((y >= 0 && y <= 5) || (y >= 7 && y <= 8)) && (x == 1 || y <= 5);
                int px = x0 + x, py = y0 + y;
                if (px < 0 || py < 0 || px >= f.W || py >= f.H) continue;
                if (on) f.Color[py * f.W + px] = C1;
            }
            for (int y = 0; y <= 8; y++) if (y != 6) { int px = x0 + 1, py = y0 + y; if (px >= 0 && py >= 0 && px < f.W && py < f.H) f.Color[py * f.W + px] = C1; }
        }

        // ---- 王房的封鎖牆（兩道能量牆）
        static readonly uint[] BAR = new[] { "#2a1258", "#5a24a8", "#9a5af0", "#e8c8ff" }.Select(Col.Hex).ToArray(); static readonly uint BAR_LIGHT = Col.Hex("#5a24a8");
        double barClock;
        void DrawBarrier(Frame f, (double l, double r) lk)
        {
            barClock += 1 / 60.0;
            int scroll = (int)Math.Floor(barClock * 16);
            void Put(int x, int y, uint c, bool light = false)
            {
                if (x < 0 || y < 0 || x >= f.W || y >= f.H) return;
                f.Color[y * f.W + x] = c;
                if (light) f.Light[y * f.W + x] = BAR_LIGHT;
            }
            foreach (var (wx, side) in new[] { (lk.l, 1), (lk.r - 1, -1) })
            {
                int x0 = (int)(wx - f.Ox);
                if (x0 < -8 || x0 >= f.W + 8) continue;
                int bottom = (int)((StageD.ArenaInfo?.Floor ?? Data.Floor) - f.Oy);
                for (int y = 0; y < bottom; y++)
                {
                    int wy = y + f.Oy + scroll;
                    for (int i = 0; i < 6; i++)
                    {
                        bool on = (wy + i) % 6 == 0 || (wy - i + 60) % 6 == 0;
                        if (on) Put(x0 + side * i, y, BAR[i < 2 ? 2 : 1]);
                    }
                    Put(x0 + side * 6, y, BAR[3], (y & 1) == 0);
                    Put(x0 + side * 7, y, BAR[0]);
                }
                for (int n = 0; n < 3; n++)
                {
                    int y = (int)Math.Floor((barClock * 70 + n * 61) % bottom);
                    Put(x0 + side * 5, y, BAR[3], true);
                    Put(x0 + side * 5, y - 1, BAR[2]);
                }
            }
        }
    }
}
