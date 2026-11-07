// game/src/boss.js 一行一行翻成 C#：第一章王「大胃王史萊姆」（1-4 大胃王的巢穴）。
// 三個階段（預兆越來越快）：
//   第一階段（100～60%）：跳躍壓地（影子＋地面衝擊波）、垃圾彈幕、黏液衝撞（留下減速黏液）
//   第二階段（60～30%）：生氣（冒蒸氣）＋吐火球（落地燒一陣）、分裂（一次）、天降垃圾（先有落點影子）
//   第三階段（30～0%）：暴食模式（金光、招式連發）＋大招「星屑暴食」：跳上高台大吼 → 大口吸 → 金色光束掃地 → 累倒 3 秒（受傷 1.5 倍）
// 弱點：左邊那塊發光的星星碎片，打中 1.5 倍。打倒：融化、垃圾彈出來、碎片飛向主角被吸收、掉金幣和星箱。
// 跟一般敵人一樣放在 Enemies 裡（Box／Hit／Update／Draw），主程式的接觸傷害跳過它（K.Dmg = 0），撞人自己處理。
// 每個姿勢的圖是網頁版烘好匯出的（anims.bytes 的 boss:姿勢）。
using System;
using System.Collections.Generic;
using System.Linq;
using PixelFX;

namespace ZeroStar
{
    public class Boss : Enemy
    {
        public const double BOSS_HP = 4800;
        const double GRAV = 900, PHASE2 = 0.6, PHASE3 = 0.3;
        static readonly EnemyKind KIND = new EnemyKind { Name = "boss", Dmg = 0, W = 26, H = 40, Fly = false };
        static readonly string[] POSES = { "idle", "crouch", "air", "land", "inhale", "spit", "lean", "slide", "roar", "split", "vacuum", "beam", "dizzy", "melt" };
        static Dictionary<string, Anim> baked;
        static Dictionary<string, Anim> Baked_() { if (baked != null) return baked; baked = new Dictionary<string, Anim>(); foreach (var p in POSES) baked[p] = Baked.Anim("boss:" + p); return baked; }

        static uint C(string s) => Col.Hex(s);
        static readonly uint[] GOO = new[] { "#1e3008", "#3a5210", "#5e7c16", "#8aaa22", "#c0dc54", "#eefcb8" }.Select(C).ToArray();
        static readonly uint[] GOLD = new[] { "#8a5a0c", "#d8a020", "#ffd84a", "#fff6c0", "#ffffff" }.Select(C).ToArray();
        static readonly uint[] FIRE = new[] { "#7a1a08", "#d04a10", "#ff8a2a", "#ffd060", "#fff6c0" }.Select(C).ToArray();
        static readonly uint STEAM = C("#c8d0c0"), WIND0 = C("#e8f4e0"), WIND1 = C("#8aa890");
        static readonly string[] GOLD_P = { "#8a5a0c", "#d8a020", "#ffd84a", "#fff6c0", "#ffffff" };

        // ---- 狀態（照 boss.js 的欄位）
        class Opts { public double? Wait; public string Kind, Say; public bool Rain, Snd, Shook, Done, Started, Shown; public double? From; }
        class Junk { public string type; public double x, y, vx, vy, life, rot; public int bounces; public bool harmless; }
        class Ball { public double x, y, vx, vy; public FxRun fx; public bool done; }
        class Fire { public double x, life; }
        class Wave { public double x, d, life; }
        class Trail { public double x, life; }
        class Rain { public double x, t, land; public string type; public bool fell; }
        class Shard { public double x, y, t; public bool done; }

        public override bool IsBoss => true;
        readonly Game G;
        public readonly double Floor;
        public string State = "intro"; public double Tt, BClock, Pk = 0.5, UltT, Flash, StarsN, ShadowX, Dying, Dir;
        public string Pose = "air", LastMove = "";
        public int Phase = 1, Chain;
        public bool Split, ShadowOn = true, OnTop, Roared, Popped, Dropped, RainSaid;
        public double? BeamX; double sucks;
        Opts o = new Opts();
        readonly List<Junk> junk = new List<Junk>(); List<Fire> fires = new List<Fire>(); List<Ball> balls = new List<Ball>(); List<Wave> waves = new List<Wave>(); List<Trail> trail = new List<Trail>(); List<Rain> rain = new List<Rain>();
        Shard shardFly;

        public Boss(double x, double floor, Game g) : base(KIND, "boss", x, floor - 264)
        {
            Baked_();
            G = g; Floor = floor; Hp = BOSS_HP;
            ShadowX = x;
            G.BossBar(1, 1);
        }
        double Tm => Phase == 1 ? 1 : Phase == 2 ? 0.8 : 0.72;   // 預兆的長短（越後面越快）
        double GroundY => OnTop ? G.BossTop.Y : Floor;
        public override (double x0, double x1, double y0, double y1) Box() => (Xp - 27, Xp + 27, Yp - 40, Yp);
        (double x, double y) ShardPos() => (Xp - 27, Yp - 28);
        (double l, double r) Lock => G.BossLock();

        // ---- 受傷
        public override void Hit(Roll roll, double dir, HitOpts opts, IWorld world, Box? area = null)
        {
            if (State == "intro" || Dying != 0 || Dead_) return;
            double dmg = roll.Dmg; bool crit = roll.Crit;
            var (sx, sy) = ShardPos();
            bool weak = area != null && sx >= area.Value.X0 - 3 && sx <= area.Value.X1 + 3 && sy >= area.Value.Y0 - 3 && sy <= area.Value.Y1 + 3;
            if (weak) { dmg *= 1.5; crit = true; }
            if (State == "dizzy") dmg *= 1.5;
            double d = Math.Max(1, Pf.Round(dmg * (0.9 + Rnd.Next() * 0.2)));
            Hp -= d;
            Flash = 0.07;
            var b = Box(); double hx = Math.Max(b.x0, Math.Min(b.x1, G.Player.X + dir * 6));
            G.Combat.Hit(weak ? sx : hx, weak ? sy : Yp - 22, dir, weak || opts.Launch || crit);
            if (weak) SceneLight.AddFlash(sx, sy, 40, 2.5, 0.15, "#ffd84a");
            G.Sfx(weak || crit ? "crit" : opts.Launch ? "hitH" : "hitL");
            G.Combat.Damage(this, Xp, b.y0 - 4, d, crit, opts.Launch);
            G.BossBar(Math.Max(0, Hp) / BOSS_HP, Phase);
            if (Hp <= 0) StartDeath();
        }
        // 王沒有 tick（網頁版的狀態傷害不會打到王）
        public override void Tick(double dmg, IWorld w, bool small = false) { }

        // ---- 每一格
        public override void Update(double dt, Player player, IWorld world)
        {
            BClock += dt; Tt += dt; Flash -= dt;
            var P = G.Player;
            UpdateHazards(dt, P);
            if (Dying != 0) { UpdateDeath(dt, P); return; }
            if (State != "intro" && State != "ult") UltT += dt;
            double k = Hp / BOSS_HP;
            if (Phase == 1 && k <= PHASE2 && State == "idle") { Phase = 2; G.BossBar(k, 2); Go("roar", new Opts { Say = "系統：牠生氣了。……你剛剛是不是戳到牠的肚子？" }); return; }
            if (Phase == 2 && k <= PHASE3 && State == "idle") { Phase = 3; G.BossBar(k, 3); UltT = 99; G.Say.Unshift("系統：那個光……牠把星星吃掉了？！小心，你也是星星。", 3); }
            if (!Split && k <= 0.5 && State == "idle") { Split = true; Go("split"); return; }
            switch (State)
            {
                case "intro": S_intro(dt); break;
                case "roar": S_roar(); break;
                case "idle": S_idle(dt, P); break;
                case "crouch": S_crouch(dt, P); break;
                case "jump": S_jump(dt); break;
                case "land": S_land(); break;
                case "inhale": S_inhale(dt); break;
                case "spit": S_spit(); break;
                case "lean": S_lean(dt, P); break;
                case "slide": S_slide(dt); break;
                case "split": S_split(dt); break;
                case "ultJump": S_ultJump(dt); break;
                case "ultRoar": S_ultRoar(); break;
                case "vacuum": S_vacuum(dt, P); break;
                case "beam": S_beam(dt); break;
                case "ultDown": S_ultDown(dt); break;
                case "dizzy": S_dizzy(); break;
            }
            // 撞到主角（在地上滑、壓下來的時候比較痛）
            if (State != "intro" && State != "dizzy")
            {
                var b = Box();
                if (b.x0 < P.X + 7 && b.x1 > P.X - 7 && b.y0 < P.Y && b.y1 > P.Y - 20)
                {
                    double dmg = State == "slide" ? 14 : State == "jump" && Vy > 0 ? 18 : 8;
                    G.BossHurt(dmg, Xp);
                }
            }
        }
        void Go(string state, Opts opts = null) { State = state; Tt = 0; o = opts ?? new Opts(); if (o.Say != null) G.Say.Unshift(o.Say, 2.6); }

        // 開場：從上面掉下來 → 落地震動 → 大吼 → 嗆聲
        void S_intro(double dt)
        {
            if (Yp < Floor)
            {
                Vy += GRAV * dt; Yp += Vy * dt; Pose = "air"; Pk = 0.6;
                if (Yp >= Floor) { Yp = Floor; LandFx(true); Tt = 0; }
                return;
            }
            if (Tt < 0.8) { Pose = "land"; Pk = Tt / 1.2; return; }
            if (Tt < 2.2)
            {
                Pose = "roar";
                if (!Roared) { Roared = true; G.Fx.Shake(0.9, 3, true); G.Sfx("roar"); G.Say.Show("大胃王：一顆小星星也想挑戰本大爺？……正好，飯後甜點。", 3.2); }
                return;
            }
            G.Say.Unshift("系統：牠說的沒錯。但你可以讓牠閉嘴。", 2.8);
            Go("idle", new Opts { Wait = 0.8 });
        }
        void S_roar() { Pose = "roar"; if (!o.Shook) { o.Shook = true; G.Fx.Shake(0.9, 3, true); G.Sfx("roar"); } if (Tt > 1.2) Go("idle", new Opts { Wait = 0.4 }); }
        void S_idle(double dt, Player P)
        {
            Pose = "idle";
            if (Tt < (o.Wait ?? 0.9 * Tm)) return;
            if (Phase == 3 && UltT > 25) { Go("ultJump"); return; }
            if (Chain > 0) { Chain--; Go(LastMove == "slam" ? "crouch" : "inhale", new Opts { Kind = "junk" }); return; }
            var moves = Phase == 1 ? new[] { "slam", "barrage", "slide" } : new[] { "slam", "barrage", "slide", "fire", "rain" };
            string m;
            do m = moves[(int)Math.Floor(Rnd.Next() * moves.Length)]; while (m == LastMove && moves.Length > 1);
            LastMove = m;
            if (Phase == 3 && (m == "slam" || m == "barrage")) Chain = m == "slam" ? 2 : 1;   // 暴食模式：連發
            if (m == "slam") Go("crouch");
            else if (m == "barrage") Go("inhale", new Opts { Kind = "junk" });
            else if (m == "fire") Go("inhale", new Opts { Kind = "fire" });
            else if (m == "slide") Go("lean");
            else if (m == "rain") Go("crouch", new Opts { Rain = true });
        }

        // ---- 跳躍壓地（天降垃圾也是先壓地）
        void S_crouch(double dt, Player P)
        {
            double T = (o.Rain ? 0.35 : 0.6) * Tm;
            Pose = "crouch"; Pk = Math.Min(1, Tt / T);
            if (!o.Rain) { ShadowOn = true; ShadowX = ClampX(P.X); }
            if (Tt >= T)
            {
                double tx = o.Rain ? Xp : ClampX(P.X), air = o.Rain ? 0.45 : 0.8;
                Vx = (tx - Xp) / air; Vy = -GRAV * air / 2; ShadowX = tx;
                Go("jump", new Opts { Rain = o.Rain });
            }
        }
        void S_jump(double dt)
        {
            Vy += GRAV * dt; Xp += Vx * dt; Yp += Vy * dt;
            Pose = "air"; Pk = Math.Min(1, Tt / 0.8);
            if (Yp >= GroundY && Vy > 0)
            {
                Yp = GroundY; Vx = 0; ShadowOn = false;
                LandFx(true);
                foreach (double d in new[] { -1.0, 1.0 }) waves.Add(new Wave { x = Xp + d * 28, d = d, life = 1.4 });
                if (o.Rain) StartRain(G.Player);
                Go("land");
            }
        }
        void S_land() { Pose = "land"; Pk = Math.Min(1, Tt / 1.2); if (Tt > 0.8) Go("idle"); }

        // ---- 吸氣 → 吐（垃圾彈幕／火球）
        void S_inhale(double dt)
        {
            double T = (o.Kind == "fire" ? 0.6 : 0.7) * Tm;
            Pose = "inhale"; Pk = Math.Min(1, Tt / T);
            if (!o.Snd) { o.Snd = true; G.Sfx("inhale"); }
            if (Tt >= T) { SpitOut(o.Kind); Go("spit"); }
        }
        void S_spit() { Pose = "spit"; Pk = Math.Min(1, Tt / 0.5); if (Tt > 0.5) Go("idle"); }
        void SpitOut(string kind)
        {
            var P = G.Player; double mx = Xp, my = Yp - 18, dir = P.X >= Xp ? 1 : -1;
            G.Sfx(kind == "fire" ? "fire" : "spit");
            if (kind == "fire")
            {
                double a0 = Pf.Atan2(P.Y - 12 - my, P.X - mx);
                foreach (double da in new[] { 0, -0.35, 0.35 })
                {
                    double a = a0 + da, sp = 170;
                    balls.Add(new Ball { x = mx, y = my, vx = Pf.Cos(a) * sp, vy = Pf.Sin(a) * sp - 40, fx = G.SpawnLive("fireball", mx, my, new FxOptions { Flip = Pf.Cos(a) < 0, Palette = Col.PAL["ember"], Light = 0.6, Seed = Pf.ToInt32(Rnd.Next() * 99) }) });
                }
                return;
            }
            // 垃圾：輪胎（在地上彈）、鐵罐（拋物線）、木板（直直飛）
            var types = new[] { "tire", "can", "plank", "can", "tire" };
            for (int i = 0; i < types.Length; i++)
            {
                string type = types[i]; double spread = (i - 2) * 0.18;
                double vx, vy;
                if (type == "tire") { vx = dir * (110 + i * 25); vy = -160; }
                else if (type == "can") { vx = dir * (70 + i * 30); vy = -320 + i * 20; }
                else { vx = dir * 230; vy = -40 + spread * 60; }
                junk.Add(new Junk { type = type, x = mx + dir * 10, y = my, vx = vx, vy = vy, life = 3.5, rot = 0, bounces = type == "tire" ? 3 : 0 });
            }
        }

        // ---- 黏液衝撞：往後縮 → 滑過去
        void S_lean(double dt, Player P)
        {
            double T = 0.5 * Tm;
            Pose = "lean"; Pk = Math.Min(1, Tt / T);
            if (Tt >= T) { Dir = P.X >= Xp ? 1 : -1; Go("slide"); G.Sfx("dash"); }
        }
        void S_slide(double dt)
        {
            Pose = "slide";
            Xp += Dir * 250 * dt;
            if (Math.Floor(BClock * 30) % 2 != 0) trail.Add(new Trail { x = Xp - Dir * 20, life = 3.5 });
            var (l, r) = Lock;
            if (Xp <= l + 34 || Xp >= r - 34) { Xp = Math.Max(l + 34, Math.Min(r - 34, Xp)); G.Fx.Shake(0.25, 2); LandFx(false); Go("land"); }
        }

        // ---- 分裂：身上鼓包 → 吐出 3 隻小史萊姆
        void S_split(double dt)
        {
            Pose = "split"; Pk = Math.Min(1, Tt / 1);
            if (Tt >= 1 && !o.Done)
            {
                o.Done = true;
                foreach (double d in new[] { -1.0, 0, 1 }) G.SpawnEnemy("slime", ClampX(Xp + d * 40), G.StageD.ArenaInfo?.Floor);
                SceneLight.AddFlash(Xp, Yp - 20, 70, 2, 0.3, "#c0dc54"); G.Fx.Shake(0.2, 2); G.Sfx("squish");
                G.Say.Unshift("系統：分裂了？！……不對，那是牠吃太飽吐出來的。好噁。", 2.6);
            }
            if (Tt > 1.4) Go("idle");
        }

        // ---- 大招：星屑暴食
        void S_ultJump(double dt)
        {
            var top = G.BossTop;
            if (Tt == dt || !o.Started)
            {
                o.Started = true;
                double air = 0.9, tx = top.X + top.W / 2;
                Vx = (tx - Xp) / air; Vy = (top.Y - Yp) / air - GRAV * air / 2; ShadowOn = false;
            }
            Vy += GRAV * dt; Xp += Vx * dt; Yp += Vy * dt; Pose = "air"; Pk = 0.5;
            if (Vy > 0 && Yp >= top.Y) { Yp = top.Y; OnTop = true; Vx = 0; LandFx(true); Go("ultRoar"); }
        }
        void S_ultRoar()
        {
            Pose = "roar";
            if (!o.Shown) { o.Shown = true; G.BossUlt("星屑暴食"); G.Fx.Shake(1.2, 3, true); G.Sfx("roar"); G.Sfx("ultCharge"); SceneLight.AddFlash(Xp, Yp - 20, 120, 3, 0.8, "#ffd84a"); }
            if (Tt > 1.3) Go("vacuum");
        }
        void S_vacuum(double dt, Player P)
        {
            Pose = "vacuum";
            if (!o.Snd) { o.Snd = true; G.Sfx("vacuum"); }
            double mx = Xp, dx = mx - P.X, dist = Math.Abs(dx);
            // 往嘴巴拉：越近拉越大力；閃避中拉不動
            double pull = (70 + Math.Max(0, 160 - dist) * 0.6) * (P.State == "dash" ? 0.25 : 1);
            P.X += Math.Sign(dx) * pull * dt;
            if (Rnd.Next() < 0.6) sucks++;
            if (dist < 16)
            {
                // 被吸進去 → 吐出來
                if (G.BossHurt(30, mx - Math.Sign(dx) * 10))
                {
                    P.Vx = (P.X >= mx ? 1 : -1) * 300; P.Vy = -340;
                    G.Say.Unshift("系統：被吸進去了……又被吐出來了。……你被嫌難吃了耶。", 2.8);
                    G.Sfx("spit");
                }
                Go("beam"); return;
            }
            if (Tt > 3) Go("beam");
        }
        void S_beam(double dt)
        {
            Pose = "beam";
            var (l, r) = Lock; double T = 2.4;
            double from = o.From ?? (double)(o.From = G.Player.X < Xp ? l + 20 : r - 20), to = from < Xp ? r - 20 : l + 20;
            if (!o.Snd) { o.Snd = true; G.Sfx("beam"); }
            if (Tt < 0.5) { BeamX = null; return; }   // 肚子先亮 0.5 秒（預兆）
            double k = Math.Min(1, (Tt - 0.5) / T);
            BeamX = from + (to - from) * k;
            var P = G.Player;
            if (P.Y >= Floor - 2 && Math.Abs(P.X - BeamX.Value) < 9) G.BossHurt(25, BeamX.Value);
            if (Rnd.Next() < 0.5) G.Fx.Shake(0.05, 1);
            if (k >= 1) { BeamX = null; Go("ultDown"); }
        }
        void S_ultDown(double dt)
        {
            if (!o.Started) { o.Started = true; OnTop = false; var top = G.BossTop; Vx = (top.X + top.W / 2 + 50 * (Rnd.Next() < 0.5 ? -1 : 1) - Xp) / 0.7; Vy = -120; }
            Vy += GRAV * dt; Xp += Vx * dt; Yp += Vy * dt; Pose = "air"; Pk = 0.8;
            if (Vy > 0 && Yp >= Floor) { Yp = Floor; Vx = 0; LandFx(true); UltT = 0; Go("dizzy"); G.Say.Unshift("系統：牠累倒了！現在！打牠！", 2.4); }
        }
        void S_dizzy() { Pose = "dizzy"; StarsN += 1; if (Tt > 3) Go("idle"); }

        // ---- 打倒
        void StartDeath()
        {
            Dying = 0.001; State = "dying"; Tt = 0; BeamX = null; OnTop = false;
            junk.Clear(); foreach (var b in balls) b.fx.Stop(); balls.Clear(); rain.Clear();
            G.Fx.HitStop(0.25); G.Fx.Shake(0.8, 4); SceneLight.AddFlash(Xp, Yp - 20, 140, 3.5, 1, "#fff6c0"); G.Sfx("melt");
            G.Say.Unshift("系統：倒了……牠倒了！", 2.4);
        }
        public bool IsDying => Dying != 0;
        void UpdateDeath(double dt, Player P)
        {
            if (Yp < Floor) { Vy = Vy + GRAV * dt; Yp = Math.Min(Floor, Yp + Vy * dt); }
            Dying += dt;
            Pose = "melt"; Pk = Math.Min(1, Dying / 2.4);
            // 肚子裡的垃圾一件一件彈出來、金幣噴出來
            if (Dying > 0.6 && !Popped)
            {
                Popped = true;
                for (int i = 0; i < 6; i++) { double vx = (Rnd.Next() - 0.5) * 260, vy = -260 - Rnd.Next() * 120; junk.Add(new Junk { type = new[] { "tire", "can", "plank" }[i % 3], x = Xp, y = Yp - 16, vx = vx, vy = vy, life = 1.6, rot = 0, bounces = 1, harmless = true }); }
                G.DropCoins(Xp, Yp - 20, 40);
            }
            if (Dying > 1.4 && !Dropped) { Dropped = true; G.BossDropLoot(Xp, Yp - 16); }
            // 碎片飛向主角
            if (Dying > 2.0 && shardFly == null) { var (sx, sy) = ShardPos(); shardFly = new Shard { x = sx, y = sy, t = 0 }; }
            if (shardFly != null && !shardFly.done)
            {
                var s = shardFly; s.t += dt;
                double k = Math.Min(1, s.t / 0.9), tx = P.X, ty = P.Y - 12;
                s.x += (tx - s.x) * Math.Min(1, dt * (2 + k * 10)); s.y += (ty - s.y) * Math.Min(1, dt * (2 + k * 10)) - Pf.Sin(k * Math.PI) * 30 * dt;
                if (Pf.Hypot(tx - s.x, ty - s.y) < 6 || s.t > 1.6)
                {
                    s.done = true;
                    G.SpawnLive("collect-burst", Pf.Round(tx), Pf.Round(ty), new FxOptions { Palette = GOLD_P, Light = 0.6 });
                    SceneLight.AddFlash(tx, ty, 90, 3, 0.6, "#ffd84a"); G.BossAbsorb();
                }
            }
            if (Dying > 4.2) Dead_ = true;
        }

        // ---- 天降垃圾
        void StartRain(Player P)
        {
            var (l, r) = Lock; var xs = new List<double> { P.X };
            while (xs.Count < 6) { double x = l + 30 + Rnd.Next() * (r - l - 60); if (xs.All(q => Math.Abs(q - x) > 34)) xs.Add(x); }
            for (int i = 0; i < xs.Count; i++) rain.Add(new Rain { x = xs[i], t = -i * 0.12, type = new[] { "tire", "can", "plank" }[i % 3] });
            if (!RainSaid) G.Say.Unshift("系統：上面！天花板的管子在掉垃圾！", 2.2);
            RainSaid = true;
        }

        // ---- 飛行物、地上的危險
        void UpdateHazards(double dt, Player P)
        {
            double fl = Floor; var (l, r) = Lock;
            void HitP(double x, double y, double rad, double dmg) { if (Math.Abs(P.X - x) < rad + 6 && P.Y - 20 < y + rad && P.Y > y - rad) G.BossHurt(dmg, x); }
            foreach (var j in junk)
            {
                j.life -= dt; j.vy += GRAV * 0.8 * dt; j.x += j.vx * dt; j.y += j.vy * dt; j.rot += dt * (j.vx > 0 ? 12 : -12);
                if (j.y >= fl - 3)
                {
                    j.y = fl - 3;
                    if (j.bounces > 0) { j.vy = -Math.Abs(j.vy) * 0.55; j.bounces--; G.Combat.Dust("land", j.x, fl); if (Rnd.Next() < 0.5) G.Sfx("clank"); }
                    else { j.life = Math.Min(j.life, 0.25); j.vx *= 0.5; j.vy = 0; }
                }
                if (j.x < l + 4 || j.x > r - 4) j.life = 0;
                if (!j.harmless && j.life > 0.3) HitP(j.x, j.y, 4, 10);
            }
            junk.RemoveAll(j => !(j.life > 0));
            foreach (var b in balls)
            {
                b.vy += 120 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.fx.Options.X = Pf.Round(b.x); b.fx.Options.Y = Pf.Round(b.y);
                if (b.y >= fl - 4 || b.x < l || b.x > r) { b.done = true; b.fx.Stop(); if (b.y >= fl - 4) fires.Add(new Fire { x = b.x, life = 2 }); SceneLight.AddFlash(b.x, fl - 6, 50, 2, 0.2, "#ff8a2a"); }
                else if (Math.Abs(P.X - b.x) < 9 && Math.Abs(P.Y - 10 - b.y) < 12) { b.done = true; b.fx.Stop(); G.BossHurt(12, b.x); }
            }
            balls.RemoveAll(b => b.done);
            foreach (var f in fires) { f.life -= dt; if (P.Y >= fl - 2 && Math.Abs(P.X - f.x) < 9) G.BossHurt(8, f.x); }
            fires.RemoveAll(f => !(f.life > 0));
            foreach (var w in waves) { w.life -= dt; w.x += w.d * 170 * dt; if (P.Grounded && P.Y >= fl - 2 && Math.Abs(P.X - w.x) < 6) G.BossHurt(10, w.x - w.d * 10); if (w.x < l + 6 || w.x > r - 6) w.life = 0; }
            waves.RemoveAll(w => !(w.life > 0));
            foreach (var s in trail) s.life -= dt;
            trail.RemoveAll(s => !(s.life > 0));
            if (P.Grounded && trail.Any(s => Math.Abs(s.x - P.X) < 6)) P.Vx *= 0.82;   // 黏液：走起來很慢
            foreach (var q in rain)
            {
                q.t += dt;
                if (q.t > 0.8 && !q.fell)
                {
                    double y = fl - 204 + (q.t - 0.8) * 420;
                    if (y >= fl - 4) { q.fell = true; q.land = 0.3; G.Combat.Dust("land", q.x, fl, true); G.Fx.Shake(0.1, 1); }
                    else if (Math.Abs(P.X - q.x) < 9 && Math.Abs(P.Y - 10 - y) < 12) { q.fell = true; q.land = 0.3; G.BossHurt(12, q.x); }
                }
                if (q.fell) q.land -= dt;
            }
            rain.RemoveAll(q => !(!q.fell || q.land > 0));
        }

        void LandFx(bool big)
        {
            G.Combat.Dust("land", Xp - 20, Yp, true); G.Combat.Dust("land", Xp + 20, Yp, true);
            G.Fx.Shake(big ? 0.35 : 0.2, big ? 3 : 2); G.Fx.HitStop(big ? 0.05 : 0.02);
            SceneLight.AddFlash(Xp, Yp - 10, 60, 1.5, 0.2, "#c0dc54");
            G.Sfx(big ? "bossLand" : "land");
        }
        double ClampX(double x) { var (l, r) = Lock; return Math.Max(l + 36, Math.Min(r - 36, x)); }

        // ---- 光
        public override void Lights(List<LightSrc> list)
        {
            if (Dead_) return;
            var (sx, sy) = ShardPos();
            if (Dying == 0) list.Add(new LightSrc(sx, sy, 30, 1.4, "#ffd84a"));
            if (Phase == 3 && Dying == 0) list.Add(new LightSrc(Xp, Yp - 20, 70, 1.2 + 0.4 * Pf.Sin(BClock * 6), "#ffd84a"));
            if (Phase == 2 && Dying == 0) list.Add(new LightSrc(Xp, Yp - 20, 50, 0.6, "#ff6a3a"));
            if (BeamX != null) { list.Add(new LightSrc(BeamX.Value, Floor - 6, 60, 3, "#ffd84a")); list.Add(new LightSrc(Xp, Yp - 18, 50, 2.4, "#fff6c0")); }
            foreach (var f in fires) list.Add(new LightSrc(f.x, Floor - 6, 30, 1.2 * Math.Min(1, f.life), "#ff8a2a"));
            if (shardFly != null && !shardFly.done) list.Add(new LightSrc(shardFly.x, shardFly.y, 40, 2.5, "#ffd84a"));
        }

        // ---- 畫
        public override void Draw(Frame frame, FxSystem fx, double simMs)
        {
            if (Dead_) return;
            int W = frame.W, H = frame.H, ox = frame.Ox, oy = frame.Oy; var Cb = frame.Color; double fl = Floor;
            void Put(double x, double y, uint c) { int sx = (int)Pf.Round(x) - ox, sy = (int)Pf.Round(y) - oy; if (sx >= 0 && sy >= 0 && sx < W && sy < H) Cb[sy * W + sx] = c; }
            void Dark(double x, double y, double k)
            {
                int sx = (int)Pf.Round(x) - ox, sy = (int)Pf.Round(y) - oy; if (sx < 0 || sy < 0 || sx >= W || sy >= H) return;
                int i = sy * W + sx; uint c = Cb[i];
                Cb[i] = unchecked((uint)(unchecked((int)0xff000000) | (Pf.ToInt32(((c >> 16) & 255) * k) << 16) | (Pf.ToInt32(((c >> 8) & 255) * k) << 8) | Pf.ToInt32((c & 255) * k)));
            }
            void Shadow(double x, double y, double rx, double k)
            {
                for (double dx = -rx; dx <= rx; dx++) { double h = Pf.Round(Math.Sqrt(1 - Pf.Pow(dx / (rx + 0.5), 2)) * 2); for (double dy = -h; dy <= 0; dy++) Dark(x + dx, y + dy, k); }
            }
            // 地上：黏液、火、衝擊波、落點影子、壓地的影子
            foreach (var s in trail) for (int dx = -5; dx <= 5; dx++) { Put(s.x + dx, fl - 1, GOO[s.life > 1 ? 3 : 2]); if ((dx + Math.Floor(BClock * 8)) % 7 == 0) Put(s.x + dx, fl - 2, GOO[5]); }
            foreach (var f in fires) for (int i = 0; i < 6; i++) { double h = 2 + ((i * 7 + Math.Floor(BClock * 14)) % 4); for (int y = 0; y < h; y++) Put(f.x - 3 + i, fl - 1 - y, FIRE[(int)Math.Min(4, 4 - y + (i % 2))]); }
            foreach (var w in waves) for (int i = -4; i <= 4; i++) { double h = Pf.Round(4 * (1 - Math.Abs(i) / 5.0)); for (int y = 0; y < h; y++) Put(w.x + i * w.d * -1, fl - 1 - y, GOO[y == h - 1 ? 5 : 3]); }
            foreach (var q in rain) if (!q.fell) Shadow(q.x, fl - 1, 6 + Pf.Round(Math.Max(0, q.t) * 3), 0.55);
            if (ShadowOn && (State == "crouch" || State == "jump") && !o.Rain) Shadow(ShadowX, fl - 1, 26, 0.5);
            // 光束（在王後面先畫一條，從嘴到地上）
            if (BeamX != null)
            {
                double x0 = Xp, y0 = Yp - 18, x1 = BeamX.Value, y1 = fl - 2, n = Math.Ceiling(Pf.Hypot(x1 - x0, y1 - y0));
                for (double i = 0; i <= n; i++) { double x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n; for (int w = -2; w <= 2; w++) Put(x + w, y, Math.Abs(w) < 1 ? GOLD[4] : Math.Abs(w) < 2 ? GOLD[3] : GOLD[2]); }
                for (int i = 0; i < 8; i++) { double a = BClock * 20 + i, rr = 3 + (i % 3) * 2; Put(x1 + Pf.Cos(a) * rr, y1 - Math.Abs(Pf.Sin(a)) * rr, GOLD[3 + (i % 2)]); }
            }
            // 王本體
            var anim = baked.TryGetValue(Pose, out var an) ? an : baked["idle"]; int nf = anim.Frames.Length;
            int fi = anim.Duration != 0 ? (int)(Math.Floor(BClock / anim.Duration) % nf) : (int)Pf.Round(Math.Min(1, Pk) * (nf - 1));
            BlitFrame(frame, anim.Frames[fi], Xp, Yp + 1, Flash > 0 ? 0.7 : 0);
            // 第二階段：頭頂冒蒸氣；第三階段：身上的金光粒子
            if (Dying == 0 && Phase >= 2) for (int k = 0; k < 4; k++) { double a = (BClock * 0.9 + k * 0.25) % 1, x = Xp - 16 + k * 11 + Pf.Sin(a * 6 + k) * 2, y = Yp - 44 - a * 18; if (Phase == 2) { if (a < 0.8) Put(x, y, STEAM); } else { Put(x, y + 10, GOLD[3]); if (a < 0.5) Put(x + 1, y + 10, GOLD[2]); } }
            // 累倒：頭上轉星星
            if (State == "dizzy") for (int k = 0; k < 3; k++) { double a = BClock * 4 + k * 2.1, x = Xp + Pf.Cos(a) * 16, y = Yp - 50 + Pf.Sin(a) * 4; Put(x, y, GOLD[3]); Put(x - 1, y, GOLD[2]); Put(x + 1, y, GOLD[2]); Put(x, y - 1, GOLD[2]); Put(x, y + 1, GOLD[2]); }
            // 吸入：風的線條往嘴巴跑
            if (State == "vacuum") for (int k = 0; k < 10; k++) { double a = (BClock * 1.6 + k * 0.1) % 1, side = k % 2 != 0 ? 1 : -1, x = Xp + side * (140 * (1 - a) + 10), y = Yp - 18 + ((k * 13) % 30 - 15) * (1 - a); for (int q = 0; q < 4; q++) Put(x - side * q * 2, y, q < 2 ? WIND0 : WIND1); }
            // 飛行的垃圾、落下的垃圾
            void PutRgb(double x, double y, int[] c) => Put(x, y, 0xff000000u | ((uint)c[2] << 16) | ((uint)c[1] << 8) | (uint)c[0]);
            foreach (var j in junk) ZeroStar.Junk.Draw(PutRgb, j.type, j.x, j.y, j.rot);
            foreach (var q in rain) if (q.t > 0.8 && !q.fell) ZeroStar.Junk.Draw(PutRgb, q.type, q.x, fl - 204 + (q.t - 0.8) * 420, q.t * 8);
            // 被吸收的碎片
            if (shardFly != null && !shardFly.done) { var s = shardFly; foreach (var (dx, dy, c) in SHARD) Put(s.x + dx, s.y + dy, GOLD[c]); }
        }
        static readonly (int dx, int dy, int c)[] SHARD = { (0, -3, 4), (-1, -2, 3), (0, -2, 4), (1, -2, 3), (-2, -1, 2), (-1, -1, 3), (0, -1, 4), (1, -1, 3), (2, -1, 2), (-1, 0, 2), (0, 0, 3), (1, 0, 2), (0, 1, 2) };

        // 貼一張烘焙好的圖；white＝受傷閃白（保留明暗，只是很亮）。照 boss.js 的 blitFrame（JS 的 << 先把小數截成整數）
        static void BlitFrame(Frame frame, AnimFrame s, double x, double y, double white)
        {
            if (s.W == 0) return;
            int W = frame.W, H = frame.H; var Cb = frame.Color; var L = frame.Light; int bx = (int)Pf.Round(x) - frame.Ox, by = (int)Pf.Round(y) - frame.Oy;
            for (int yy = 0; yy < s.H; yy++)
            {
                int py = by + s.Ly + yy;
                if (py < 0 || py >= H) continue;
                for (int xx = 0; xx < s.W; xx++)
                {
                    int px = bx + s.Lx + xx;
                    if (px < 0 || px >= W) continue;
                    uint c = s.Color[yy * s.W + xx]; int j = py * W + px;
                    if (c != 0)
                    {
                        double r = c & 255, g = (c >> 8) & 255, b = (c >> 16) & 255;
                        if (white != 0) { r += (255 - r) * white; g += (255 - g) * white; b += (255 - b) * white; }
                        double a = (c >> 24) / 255.0; uint d = Cb[j];
                        Cb[j] = a >= 0.99
                            ? unchecked((uint)(unchecked((int)0xff000000) | (Pf.ToInt32(b) << 16) | (Pf.ToInt32(g) << 8) | Pf.ToInt32(r)))
                            : unchecked((uint)(unchecked((int)0xff000000) | (Pf.ToInt32(b * a + ((d >> 16) & 255) * (1 - a)) << 16) | (Pf.ToInt32(g * a + ((d >> 8) & 255) * (1 - a)) << 8) | Pf.ToInt32(r * a + (d & 255) * (1 - a))));
                    }
                    if (s.Light != null)
                    {
                        uint l = s.Light[yy * s.W + xx];
                        if (l != 0) { uint dd = L[j]; L[j] = 0xff000000u | ((uint)Math.Min(255, ((dd >> 16) & 255) + ((l >> 16) & 255)) << 16) | ((uint)Math.Min(255, ((dd >> 8) & 255) + ((l >> 8) & 255)) << 8) | (uint)Math.Min(255, (dd & 255) + (l & 255)); }
                    }
                }
            }
        }
    }
}
