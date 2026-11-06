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
        public readonly List<Shot> Shots = new List<Shot>();
        public class Shot { public double X, Y, Dir, Vy, Life, Mult = 1; public string Form; public bool Small, Done; public FxRun Fx; }
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
            Status = new Status(this) { Allow = new HashSet<string> { "burn", "slime" } };   // 1-1 只有燃燒和黏液（main.js 同一個設定）
            Data = Baked.Level(stage);
            Art = new LevelArt(Data);
            Map = new GameMap(Data.W, Data.H, Data.Solids, Data.Platforms);
            var combos = JsonUtility.FromJson<ComboDef>(Baked.Text("combos"));
            Player = new Player(START.x, START.y, combos);
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
        public int HitArea(Box box, Func<Roll> dmg, double dir, HitOpts o)
        {
            int n = 0;
            foreach (var e in Enemies.ToArray()) if (!e.Dead && box.Overlaps(e.HitBox())) { var r = dmg(); e.Hit(r, dir, o, this); n++; }
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
        void AddCombo(int n)
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
            SpawnLive("collect-burst", Pf.Round(Player.X), Pf.Round(Player.Y) - 12, new FxOptions { Palette = FORM_BURST[id], Light = 0.4 });
            SceneLight.AddFlash(Player.X, Player.Y - 12, 60, 2, 0.3, FORM_COLOR[id]);
        }
        public void Land(double x, double y, bool hard) { Sfx("land"); Combat.Dust("land", x, y, hard); }
        public void Dust(double x, double y, int n) { Fx.Spawn(Baked.Anim("dust"), Pf.Round(x), Pf.Round(y), Rnd.Next() < 0.5, speed: 1.8); }
        public void DropCoins(double x, double y, int n) { Coins += n; }
        public void OnKill(Enemy e) { Kills++; if (e.SqT > 0) Fx.HitStop(0.08); }   // 直接打死的停久一點
        public void OnPlayerHurt(double dmg) { }
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
            if (PendingForm != null) { SwitchForm(PendingForm); PendingForm = null; }
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
            foreach (var s in Shots)
            {
                s.X += s.Dir * 290 * dt;
                if (s.Vy != 0) s.Y = Math.Min(Map.FloorAt(s.X, s.Y) - 6, s.Y + s.Vy * dt);
                s.Life -= dt;
                s.Fx.Options.X = Pf.Round(s.X); s.Fx.Options.Y = Pf.Round(s.Y);
                bool hit = s.Life <= 0 || Map.SolidAt(s.X, s.Y);
                if (!hit) foreach (var e in Enemies) if (!e.Dead && e.HitBox().Overlaps(new Box(s.X - 8, s.X + 8, s.Y - 8, s.Y + 8))) { hit = true; break; }
                if (hit)
                {
                    s.Done = true;
                    s.Fx.Stop();
                    var P = SHOT_PAL.ContainsKey(s.Form) ? SHOT_PAL[s.Form] : SHOT_PAL["star"];
                    double big = 1 + 0.15 * 0, R = P.r * big * (s.Small ? 0.55 : 1);
                    Sfx("boom");
                    SpawnLive("plasma-explosion", Pf.Round(s.X), Pf.Round(s.Y), new FxOptions { Palette = P.boom, Accent = P.accent, Light = 0.65 * (s.Small ? 0.5 : 1), Seed = Pf.ToInt32(Rnd.Next() * 99) }, s.Small ? 1.8 : 1.3);
                    SceneLight.AddFlash(s.X, s.Y, s.Small ? 50 : 100, 4, 0.4, P.light);
                    var sx = s.X; var mult = s.Mult;
                    HitArea(new Box(s.X - R, s.X + R, s.Y - 40, s.Y + 40), () => Player.RollDmg(2.4 * mult * Player.SkillMul()), s.Dir, new HitOpts { Launch = true, Push = P.push, Elem = Player.ELEM.TryGetValue(s.Form, out var el) ? el : "burn" });
                    Fx.HitStop(s.Small ? 0.03 : 0.06);
                    Fx.Shake(s.Small ? 0.12 : 0.3, s.Small ? 1 : 3);
                }
            }
            Shots.RemoveAll(s => s.Done);
            Fx.Update(dt);
            if ((ComboT -= dt) <= 0 && Combo != 0) Combo = 0;
            FollowCam(dt);
        }

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
            Prof.Mark(null);
            var lv = SceneLight.Compute(frame, lights);
            Prof.Mark("光源");
            Art.Draw(frame, lv);
            Prof.Mark("場景");
            Art.DrawAtmosphere(frame, sceneClock);
            Prof.Mark("大氣");
            Fx.Draw(frame, true);
            foreach (var e in Enemies) e.Draw(frame, Fx, SimMs);
            Status.DrawBolts(frame);
            if (Player.Hp > 0) Player.Draw(frame);
            Fx.Draw(frame, false);
            Combat.Form = Player.Form;
            Combat.Draw(frame);
            Prof.Mark("角色特效");
            Art.DrawForeground(frame);
            Combat.DrawNumbers(frame, ViewRect());
            Prof.Mark("前景");
        }
    }
}
