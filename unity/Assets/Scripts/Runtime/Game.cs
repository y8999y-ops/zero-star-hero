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
                var e = new Enemy(sp.k, sp.x, sp.y) { X0 = sp.x, DeepSleep = sp.deep };
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
                // 技能樹「嗜血爪」（蝠翼星）：打中毒的敵人回復傷害的 3%
                if (poisoned && Player.Form == "bat" && Rank("bat", "b_blood") != 0) Player.Hp = Math.Min(Player.MaxHp, Player.Hp + r.Dmg * 0.03);
            }
            if (n > 0) AddCombo(n);
            return n;
        }
        public int HitOnce(Box box, HashSet<Enemy> hit, Func<Roll> dmg, double dir, HitOpts o)
        {
            int n = 0;
            foreach (var e in Enemies.ToArray()) if (!e.Dead && !hit.Contains(e) && box.Overlaps(e.HitBox())) { hit.Add(e); var r = dmg(); e.Hit(r, dir, o, this); n++; }
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
        public void CometStart() { }
        public void CoreMeteor() { }
        public void CoreStun(double fromX, double y) { }
        public double NoManaT;
        public void NoMana() { Sfx("close"); NoManaT = 0.6; }
        void SwitchForm(string id)
        {
            if (id == null || id == Player.Form) return;
            if (sceneClock < formCdUntil) { Sfx("close"); return; }
            formCdUntil = sceneClock + FORM_CD;
            Sfx("form");
            Player.SetForm(id);
            Player.TurnT = 0.09;
            Player.Invuln = Math.Max(Player.Invuln, 0.15);
            // 技能樹：切換時的效果
            if (id == "star" && Rank("star", "s_origin") != 0 && sceneClock - originT > 3) { originT = sceneClock; Player.Mp = Math.Min(Player.MaxMp, Player.Mp + 10); }
            if (id == "star" && Rank("star", "s_return") != 0) Player.SkillCd *= 0.5;
            if (id == "slime" && Rank("slime", "g_film") != 0) Player.FilmT = 3;
            if (id == "can" && Rank("can", "c_dent") != 0) Player.DentT = 3;
            if (id == "bat" && Rank("bat", "b_night") != 0) Player.NightT = 3;
            if (id == "spike" && Rank("spike", "k_curl") != 0) Player.CurlT = 3;
            Player.Invuln = Math.Max(Player.Invuln, 0.15);
            SpawnLive("collect-burst", Pf.Round(Player.X), Pf.Round(Player.Y) - 12, new FxOptions { Palette = FORM_BURST[id], Light = 0.4 });
            SceneLight.AddFlash(Player.X, Player.Y - 12, 60, 2, 0.3, FORM_COLOR[id]);
        }
        public void Land(double x, double y, bool hard) { Sfx("land"); Combat.Dust("land", x, y, hard); }
        public void Dust(double x, double y, int n) { Fx.Spawn(Baked.Anim("dust"), Pf.Round(x), Pf.Round(y), Rnd.Next() < 0.5, speed: 1.8); }
        public void DropCoins(double x, double y, int n) { Coins += n; }
        public void OnKill(Enemy e) { Kills++; if (e.SqT > 0) Fx.HitStop(0.08); }   // 直接打死的停久一點
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
                Sfx("ultCharge");
                return;
            }
            if (Player.Hp <= 0)
            {
                // 階段 1 的簡化：倒下 1 秒後從檢查點重來
                if ((DeadT += dt) > 1) { DeadT = 0; Player.Respawn(Checkpoint.x, Checkpoint.y); SnapCam(); }
            }
            else Player.Update(dt, this);
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
            Prof.Mark("背景特效");
            foreach (var e in Enemies) e.Draw(frame, Fx, SimMs);
            Status.DrawBolts(frame);
            foreach (var w in Waves) StarWave.Draw(frame, w);
            foreach (var m in Minis) MiniBat.Draw(frame, m);
            Prof.Mark("怪");
            if (Ult.On) { Ult.DimScene(frame); Prof.Mark("暗場"); Fx.Draw(frame, true); Prof.Mark("背景特效"); }   // 大招：先畫怪再暗場，法陣這些背景特效畫在暗場之後才會亮
            if (Player.Hp > 0) Player.Draw(frame);
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
