// game/src/enemies.js 翻成 C#（完整版）：史萊姆（跳著靠近）、金幣史萊姆（拼命逃跑）、蝙蝠（盤旋後俯衝）、
// 垃圾桶怪（走過來、靠近就撲咬）、刺蝟（縮成刺球滾過來、展開後頭暈），以及紅色菁英版。
// 外觀是網頁版烘焙好的動畫；運算順序照原本。
using System;
using System.Collections.Generic;
using PixelFX;

namespace ZeroStar
{
    public class EnemyKind
    {
        public string Name, Base, Anim, White, Poof, Curl, Roll, WhiteCurl, WhiteRoll, Bite, WhiteBite;
        public double Hp, Dmg, RollDmg, BiteDmg, W, H; public int Coin0, Coin1; public bool Fly, Elite;
        public EnemyKind Clone() => (EnemyKind)MemberwiseClone();
        public static readonly Dictionary<string, EnemyKind> All = Make();
        static Dictionary<string, EnemyKind> Make()
        {
            var d = new Dictionary<string, EnemyKind>
            {
                ["slime"] = new EnemyKind { Name = "slime", Anim = "slime", White = "slimeWhite", Poof = "poofSlime", Hp = 34, Dmg = 8, W = 15, H = 22, Coin0 = 1, Coin1 = 3 },
                ["gold"] = new EnemyKind { Name = "gold", Anim = "slimeGold", White = "slimeWhite", Poof = "poofGold", Hp = 60, Dmg = 0, W = 15, H = 22, Coin0 = 14, Coin1 = 20 },
                ["bat"] = new EnemyKind { Name = "bat", Anim = "bat", White = "batWhite", Poof = "poofBat", Hp = 22, Dmg = 7, W = 10, H = 9, Coin0 = 1, Coin1 = 2, Fly = true },
                ["hog"] = new EnemyKind { Name = "hog", Anim = "hogWalk", White = "hogWhite", Curl = "hogCurl", Roll = "hogRoll", WhiteCurl = "hogWhiteCurl", WhiteRoll = "hogWhiteRoll", Hp = 40, Dmg = 7, RollDmg = 14, W = 10, H = 14, Coin0 = 2, Coin1 = 4, Poof = "poofHog" },
                // 毒菇怪（第 2 章，只有 Unity 版）：慢慢走過來，靠近就蹲下鼓氣、噴一團毒雲。噴毒借用撲咬的欄位（Bite＝噴毒動畫）
                ["shroom"] = new EnemyKind { Name = "shroom", Anim = "shroomWalk", White = "shroomWhite", Bite = "shroomPuff", WhiteBite = "shroomWhitePuff", Hp = 38, Dmg = 6, BiteDmg = 4, W = 10, H = 22, Coin0 = 2, Coin1 = 4, Poof = "poofShroom" },
                ["trash"] = new EnemyKind { Name = "trash", Anim = "trashWalk", White = "trashWhite", Bite = "trashBite", WhiteBite = "trashWhiteBite", Hp = 70, Dmg = 5, BiteDmg = 13, W = 11, H = 30, Coin0 = 3, Coin1 = 6, Poof = "poofTrash" },
            };
            EnemyKind E(string b, Action<EnemyKind> f) { var k = d[b].Clone(); k.Base = b; k.Elite = true; f(k); return k; }
            d["slimeE"] = E("slime", k => { k.Anim = "slimeElite"; k.Hp = 130; k.Dmg = 12; k.Coin0 = 6; k.Coin1 = 10; });
            d["batE"] = E("bat", k => { k.Anim = "batElite"; k.Hp = 80; k.Dmg = 11; k.Coin0 = 5; k.Coin1 = 8; });
            d["hogE"] = E("hog", k => { k.Anim = "hogEliteWalk"; k.Curl = "hogEliteCurl"; k.Roll = "hogEliteRoll"; k.Hp = 140; k.Dmg = 11; k.RollDmg = 22; k.Coin0 = 8; k.Coin1 = 12; });
            d["trashE"] = E("trash", k => { k.Anim = "trashEliteWalk"; k.Bite = "trashEliteBite"; k.Hp = 220; k.Dmg = 8; k.BiteDmg = 20; k.Coin0 = 10; k.Coin1 = 16; });
            return d;
        }
    }

    public class Enemy : IBoxed
    {
        const double GRAV = 900;
        const double HOP_AIM = 0.84, HOP_UP = 0.9, HOP_DOWN = 1.44;
        const double HOG_CURL = 0.5, HOG_ROLL = 1.3, HOG_UNCURL = 0.4, HOG_DAZE = 0.8, HOG_ROLL_V = 205;
        const double BITE_LUNGE = 0.3, BITE_HIT0 = 0.38, BITE_HIT1 = 0.48, BITE_END = 0.8;
        const double SQ_T = 0.18;
        const double PUFF_AT = 0.55, PUFF_END = 1.0;   // 毒菇怪：第 0.55 秒噴（跟動畫用力一壓那格對齊），1 秒做完
        public const double HP_MUL = 3;
        public static int Seed = 1;
        static double alertSfxT = -1e9;   // 一次醒很多隻：提示音 0.3 秒內只響一次
        static readonly List<(double x, double y, double t)> recentPoofs = new List<(double, double, double)>();
        public static void ResetStatics() { Seed = 1; recentPoofs.Clear(); alertSfxT = -1e9; }
        static readonly Dictionary<string, string[]> POOF_SPARK = new Dictionary<string, string[]>
        {
            ["hog"] = new[] { "#1a0c06", "#4a2814", "#965a2e", "#c4864a", "#f0c890", "#fff4dc", "#ffffff" },
            ["slime"] = new[] { "#0b2f2b", "#12594a", "#1f8f4f", "#47c752", "#a6f06a", "#f0ffd2", "#ffffff" },
            ["gold"] = new[] { "#4a2e06", "#8c5a0c", "#d49a14", "#ffd23a", "#fff09a", "#ffffff", "#ffffff" },
            ["bat"] = new[] { "#1f1629", "#382645", "#5b3f66", "#866089", "#b88fb0", "#e8cfe0", "#ffffff" },
            ["shroom"] = new[] { "#2a0e3a", "#4a1a5e", "#6c2a82", "#9242a6", "#b86ac6", "#c8f05a", "#ffffff" },
            ["trash"] = new[] { "#1f272c", "#313d42", "#485a5c", "#667a78", "#8ea29c", "#c4d4cc", "#ffffff" },
        };

        public readonly EnemyKind K; public readonly string Kind; public readonly bool Elite; readonly Anim anim, white;
        public virtual bool IsBoss => false;
        /// 自己的光源（王才有；enemies.js 的怪沒有 lights）
        public virtual void Lights(List<LightSrc> list) { }
        public double X0, Vx, Vy, Hp, MaxHp, Stun, FlashT, Face = 1, Clock, HopDir = 1, T, Speed, SqT, AwakeT, AlertT = -1;
        public double Xp, Yp;
        public bool Dead_, Awake, DeepSleep, FlungUp;
        public string Core;   // 關卡指定必掉的魔物核（1-1 教吸收那隻）
        public StatusSet St;   // 元素狀態（status.js 的 e.st）
        public double MarkT, FlungT, FlungDmg, DizzyT, MeteorMark; public HashSet<Enemy> FlungHit;
        // 蝙蝠
        public string Mode; public double ModeT, Side, HomeY; bool hasHome;
        // 刺蝟
        public string Hog; public double HogT, HogCd = 0.6, RollDir, DustT; public bool RollHit;
        // 垃圾桶怪
        public bool Biting, BitDone; public double BiteT, BiteCd = 1;
        IWorld world;
        public bool Dead => Dead_;
        public double X => Xp;
        public double Y => Yp;

        public Enemy(string kind, double x, double y)
        {
            K = EnemyKind.All[kind]; Kind = K.Base ?? kind; Elite = K.Elite;
            anim = Baked.Anim(K.Anim); white = Baked.Anim(K.White);
            Seed++;
            Xp = x; Yp = y; Hp = K.Hp * HP_MUL; MaxHp = K.Hp * HP_MUL;
            T = Pf.Rand(Seed, 3) * anim.Duration;   // 錯開動畫，不要大家一起跳
            Speed = kind == "gold" ? 120 : (52 + Pf.Rand(Seed, 4) * 30) * (K.Elite ? 1.25 : 1);
            if (K.Fly) { Mode = "hover"; ModeT = 1 + Pf.Rand(Seed, 5) * 2; Side = Pf.Rand(Seed, 6) < 0.5 ? -1 : 1; }
        }

        /// 王（boss.js）用：不是 enemies.js 的怪，不動 Seed、不載動畫
        protected Enemy(EnemyKind k, string kind, double x, double y) { K = k; Kind = kind; Xp = x; Yp = y; }

        /// 身體的碰撞框（世界座標）
        public virtual (double x0, double x1, double y0, double y1) Box() => K.Fly ? (Xp - K.W, Xp + K.W, Yp - K.H, Yp + K.H) : (Xp - K.W, Xp + K.W, Yp - K.H, Yp);
        public Box HitBox() { var b = Box(); return new Box(b.x0, b.x1, b.y0, b.y1); }

        public virtual void Update(double dt, Player player, IWorld world)
        {
            Clock += dt;
            dt *= St != null && St.Slime > 0 ? 0.5 : 1;   // 黏液：動作、移動都變慢
            FlashT -= dt;
            if (SqT > 0) SqT -= dt;
            if (MarkT > 0) MarkT -= dt;
            bool stunned = Stun > 0;
            Stun -= dt;
            if (!stunned) T += dt;   // 硬直時動畫停住
            double toward = player.X >= Xp ? 1 : -1;
            this.world = world;
            // 主角靠近（左右 160、上下 90）或被打到才醒來；還沒醒的在原地待著
            if (!Awake)
            {
                if ((!DeepSleep && Math.Abs(player.X - Xp) < 160 && Math.Abs(player.Y - Yp) < 90) || Hp < MaxHp)
                {
                    Awake = true; AlertT = 0;
                    if (world.SimMs - alertSfxT > 300) { alertSfxT = world.SimMs; world.Sfx("chime"); }
                }
                else
                {
                    if (!K.Fly) { Vx *= 1 - 8 * dt; Vy += GRAV * dt; Land(dt, world); }
                    else { if (!hasHome) { HomeY = Yp; hasHome = true; } Yp = HomeY + Pf.Sin(Clock * 2.2) * 4; }
                    return;
                }
            }
            AwakeT += dt;
            if (AlertT >= 0 && AlertT < CombatFx.ALERT_T) AlertT += dt;
            var map = world.Map;
            if (K.Fly)
            {
                if (stunned)
                {
                    Vx *= 1 - 5 * dt;
                    Vy += (Vy < 0 ? GRAV * 0.6 : 0) * dt;
                    Vy *= 1 - 3 * dt;
                }
                else if (Mode == "hover")
                {
                    double tx = player.X + Side * 70, ty = player.Y - 64 + Pf.Sin(Clock * 3) * 10;
                    Vx += Math.Sign(tx - Xp) * Math.Min(1, Math.Abs(tx - Xp) / 40) * 400 * dt;
                    Vy += Math.Sign(ty - Yp) * Math.Min(1, Math.Abs(ty - Yp) / 30) * 400 * dt;
                    Vx *= 1 - 2.2 * dt;
                    Vy *= 1 - 2.2 * dt;
                    if ((ModeT -= dt) <= 0) { Mode = "wind"; ModeT = 0.35; }
                }
                else if (Mode == "wind")
                {
                    Vx *= 1 - 8 * dt;
                    Vy = -30;
                    if ((ModeT -= dt) <= 0)
                    {
                        double dx = player.X - Xp, dy = player.Y - 12 - Yp, d = Pf.Hypot(dx, dy); if (d == 0) d = 1;
                        Vx = (dx / d) * 230;
                        Vy = (dy / d) * 230;
                        Mode = "swoop";
                        ModeT = 0.75;
                    }
                }
                else if (Mode == "swoop")
                {
                    if ((ModeT -= dt) <= 0) { Mode = "hover"; ModeT = 1.6 + Pf.Rand(Pf.ToInt32(Clock), 7) * 1.8; Side = -Side; }
                }
                Xp = map.MoveX(Xp, Xp + Vx * dt, Yp + 6, 12, 6);
                Yp += Vy * dt;
                Yp = Math.Min(map.FloorAt(Xp, Yp - 12) - 12, Math.Max(12, Yp));
                if (Math.Abs(Vx) > 10) Face = Math.Sign(Vx);
            }
            else if (Kind == "hog")
            {
                HogCd -= dt;
                string st = Hog ?? "walk";
                HogT += stunned && st != "roll" ? 0 : dt;
                if (st == "walk")
                {
                    if (!stunned)
                    {
                        Face = toward;
                        Vx = toward * 40 * (Elite ? 1.3 : 1);
                        if (Math.Abs(player.X - Xp) < 120 && Math.Abs(player.Y - Yp) < 34 && HogCd <= 0) { Hog = "curl"; HogT = 0; Vx = 0; RollDir = toward; }
                    }
                    else Vx *= 1 - 4 * dt;
                }
                else if (st == "curl")
                {
                    Vx *= 1 - 12 * dt;
                    if (HogT >= HOG_CURL) { Hog = "roll"; HogT = 0; RollHit = false; world.Sfx("dash"); world.Dust(Xp - RollDir * 6, Yp, 5); }
                }
                else if (st == "roll")
                {
                    // 滾：一直往同一個方向，撞牆彈回來（刺球不會被打停）
                    Vx = RollDir * HOG_ROLL_V * (Elite ? 1.2 : 1);
                    Face = RollDir;
                    if ((DustT -= dt) <= 0) { DustT = 0.2; world.Combat.Dust("step", Xp - RollDir * 5, Yp); }
                    if (HogT >= HOG_ROLL * (Elite ? 1.3 : 1) || RollHit) { Hog = "uncurl"; HogT = 0; }
                }
                else if (st == "uncurl")
                {
                    Vx *= 1 - 6 * dt;
                    if (HogT >= HOG_UNCURL) { Hog = "daze"; HogT = 0; }
                }
                else if (st == "daze")
                {
                    Vx *= 1 - 10 * dt;
                    if (HogT >= HOG_DAZE) { Hog = "walk"; HogT = 0; HogCd = 1.6 + Pf.Rand(Pf.ToInt32(Clock), 11) * 0.8; }
                }
                Vy += GRAV * dt;
                double vx0 = Vx;
                Land(dt, world);
                if (st == "roll" && Math.Sign(Vx) != Math.Sign(vx0)) { RollDir = -RollDir; world.Dust(Xp, Yp, 4); }   // 撞牆：反彈
            }
            else if (Kind == "trash")
            {
                BiteCd -= dt;
                if (Biting)
                {
                    double bt = (BiteT += stunned ? 0 : dt);
                    if (!stunned)
                    {
                        Vx = bt > BITE_LUNGE && bt < BITE_HIT1 ? Face * 160 : Vx * (1 - 10 * dt);
                        // 咬到了沒
                        if (bt > BITE_HIT0 && bt < BITE_HIT1 && !BitDone)
                        {
                            double x0 = Face > 0 ? Xp : Xp - 30, x1 = Face > 0 ? Xp + 30 : Xp;
                            if (player.X + 6 > x0 && player.X - 6 < x1 && Math.Abs(player.Y - Yp) < 30 && player.Hurt(K.BiteDmg, Xp, world)) BitDone = true;
                        }
                    }
                    if (bt >= BITE_END) { Biting = false; BiteCd = 1.1 + Pf.Rand(Pf.ToInt32(Clock), 9) * 0.8; }
                }
                else if (!stunned)
                {
                    Face = toward;
                    Vx = toward * 34;
                    if (Math.Abs(player.X - Xp) < 50 && Math.Abs(player.Y - Yp) < 30 && BiteCd <= 0) { Biting = true; BiteT = 0; BitDone = false; Vx = 0; }
                }
                else Vx *= 1 - 4 * dt;
                Vy += GRAV * dt;
                Land(dt, world);
            }
            else if (Kind == "shroom")
            {
                BiteCd -= dt;
                if (Biting)   // 噴毒：蹲下鼓氣（被打會延後）→ 噴 → 回復
                {
                    double bt = (BiteT += stunned ? 0 : dt);
                    Vx *= 1 - 10 * dt;
                    if (bt >= PUFF_AT && !BitDone) { BitDone = true; (world as Game)?.SporePuff(Xp, Yp, K.BiteDmg, Elite); }
                    if (bt >= PUFF_END) { Biting = false; BiteCd = 2.2 + Pf.Rand(Pf.ToInt32(Clock), 9) * 1.2; }
                }
                else if (!stunned)
                {
                    Face = toward;
                    Vx = toward * 24;
                    if (Math.Abs(player.X - Xp) < 58 && Math.Abs(player.Y - Yp) < 34 && BiteCd <= 0) { Biting = true; BiteT = 0; BitDone = false; Vx = 0; world.Sfx("inhale:0"); }
                }
                else Vx *= 1 - 4 * dt;
                Vy += GRAV * dt;
                Land(dt, world);
            }
            else
            {
                // 史萊姆：只在自己動畫的「跳起來」那段時間移動（金幣史萊姆往反方向逃）
                double t = T % anim.Duration;
                if (!stunned && t >= HOP_AIM && t < HOP_UP) HopDir = Kind == "gold" ? -toward : toward;
                bool hopping = !stunned && t >= HOP_UP && t < HOP_DOWN;
                if (hopping) Vx = HopDir * Speed;
                else if (!stunned) Vx *= 1 - 12 * dt;
                else Vx *= 1 - 4 * dt;
                Vy += GRAV * dt;
                Land(dt, world);
                Face = HopDir;
            }
        }

        /// 地上的怪移動＋落地＋撞牆（撞牆就彈回來）
        void Land(double dt, IWorld world)
        {
            var map = world.Map;
            double prevY = Yp, want = Xp + Vx * dt, nx = map.MoveX(Xp, want, Yp, 18, 9);
            if (nx != want) { Vx = -Vx * 0.5; if (Kind == "gold") HopDir = -HopDir; }
            Xp = Math.Max(9, Math.Min(map.W - 9, nx));
            Yp += Vy * dt;
            double? g = Vy >= 0 ? map.GroundAt(Xp, prevY, Yp) : null;
            if (g != null)
            {
                if (FlungUp && Vy > 140) { FlungUp = false; Yp = g.Value; Vy = -Vy * 0.32; Vx *= 0.6; SqT = SQ_T * 0.7; world.Dust(Xp, g.Value, 4); return; }
                FlungUp = false; Yp = g.Value; Vy = 0;
            }
            if (Yp > map.H + 40) { Yp = map.FloorAt(Xp, 0); Vy = 0; }
        }

        /// area：打到的範圍（hitArea、hitOnce 才有；王用來判斷有沒有打到弱點）
        public virtual void Hit(Roll roll, double dir, HitOpts o, IWorld world, Box? area = null)
        {
            double dmg = roll.Dmg * (MarkT > 0 ? 1.1 : 1); bool crit = roll.Crit;   // 尖刺星「破綻」：被標記的多受 10% 傷害
            if (crit && roll.Mark) MarkT = 3;
            // 星核「沉重」：被打飛的這隻，0.4 秒內撞到別的敵人時對方也受傷
            if (o.Fling) { FlungT = 0.4; FlungDmg = dmg * 0.5; FlungHit = new HashSet<Enemy> { this }; }
            bool rolling = Hog == "roll";   // 刺蝟滾的時候：刺擋掉一半傷害、打不停、不會被擊飛
            double d = Math.Max(1, Pf.Round(dmg * (0.9 + Rnd.Next() * 0.2) * (rolling ? 0.5 : Hog == "daze" ? 1.3 : 1)));
            Hp -= d;
            FlashT = 0.07;
            SqT = SQ_T;
            if (!rolling)
            {
                Stun = Kind == "gold" ? 0.1 : 0.3;
                Vx = dir * o.Push * (K.Fly ? 55 : 42);
                if (o.Launch || crit) { Vy = K.Fly ? -120 : -230; FlungUp = !K.Fly; }
            }
            var b = Box(); double cy = Pf.Round((b.y0 + b.y1) / 2);
            bool heavy = o.Launch || crit || o.Push >= 3;
            world.Combat.Hit(Xp - dir * 3, cy, dir, heavy);
            world.Sfx(crit ? "crit" : heavy ? "hitH" : "hitL");
            SceneLight.AddFlash(Xp, cy, heavy ? 36 : 18, heavy ? 2.2 : 1.1, heavy ? 0.14 : 0.08);
            world.Combat.Damage(this, Xp, b.y0 - 3, d, crit, heavy);
            if (Hp <= 0) Die(world);
            else if (o.Elem != null) (world as Game)?.Status.Apply(this, o.Elem);
        }

        /// 狀態、反應造成的傷害：不會硬直、不會擊退，只跳數字（small＝持續傷害）
        public virtual void Tick(double dmg, IWorld w, bool small = false)
        {
            if (Dead_) return;
            double d = Math.Max(1, Pf.Round(dmg));
            Hp -= d;
            if (!small) FlashT = 0.05;
            var b = Box();
            w.Combat.Damage(this, Xp, b.y0 - 3, d, false, !small);
            if (Hp <= 0 && world != null) Die(world);
        }

        void Die(IWorld world)
        {
            Dead_ = true;
            world.Sfx("kill");
            var b = Box();
            double now = world.SimMs;
            recentPoofs.RemoveAll(q => !(now - q.t < 350));
            int near = 0; foreach (var q in recentPoofs) if (Math.Abs(q.x - Xp) < 70 && Math.Abs(q.y - Yp) < 60) near++;
            bool crowded = near >= 2;
            recentPoofs.Add((Xp, Yp, now));
            // 一次打死一群：後面的改成往上噴的小火花（不然煙疊成一大片）
            if (crowded && world is Game g) g.SpawnLive("hit-spark", Pf.Round(Xp), Pf.Round((b.y0 + b.y1) / 2), new FxOptions { Palette = POOF_SPARK.TryGetValue(Kind, out var ps) ? ps : POOF_SPARK["slime"], Angle = -Math.PI / 2, Light = 0.35 }, 1.2);
            else world.Fx.Spawn(Baked.Anim(K.Poof), Pf.Round(Xp), Pf.Round(b.y1), speed: 1.5);
            world.DropCoins(Xp, (b.y0 + b.y1) / 2, K.Coin0 + (int)Math.Floor(Rnd.Next() * (K.Coin1 - K.Coin0 + 1)));
            world.OnKill(this);
        }

        public virtual void Draw(Frame frame, FxSystem fx, double simMs)
        {
            DrawEnemy(frame, fx, simMs);
        }
        void DrawEnemy(Frame frame, FxSystem fx, double simMs)
        {
            var snap = Status.TakeSnap(frame, this);   // 有元素狀態：先記下這塊畫面，畫完比對出身體的形狀
            double sx = 1, sy = 1, jx = 0;
            if (SqT > 0)
            {
                double p = 1 - SqT / SQ_T;
                if (p < 0.4) { sx = 1.18; sy = 0.85; }
                else { double q = (p - 0.4) / 0.6, w = Pf.Sin(q * Math.PI) * (1 - q); sx = 1 - 0.14 * w; sy = 1 + 0.16 * w; }
            }
            if (fx.Freeze > 0 && FlashT > 0) jx = (long)Math.Floor(simMs / 34) % 2 != 0 ? 1 : -1;   // 停頓中原地抖
            if (Kind == "hog" && Hog != null && Hog != "walk")
            {
                // 刺蝟：縮球（往前播）、滾、展開（倒著播縮球）、頭暈（停在剛展開的那格，左右晃）
                bool wf = FlashT > 0; string st = Hog; Anim an; double tt;
                if (st == "curl") { an = Baked.Anim(wf ? K.WhiteCurl : K.Curl); tt = HogT; }
                else if (st == "roll") { an = Baked.Anim(wf ? K.WhiteRoll : K.Roll); tt = HogT; }
                else if (st == "uncurl") { an = Baked.Anim(wf ? K.WhiteCurl : K.Curl); tt = Math.Max(0, HOG_CURL - HogT * (HOG_CURL / HOG_UNCURL)); }
                else { an = wf ? white : anim; tt = 0; }
                Blit.DrawScaled(frame, an, Math.Min(tt, an.Duration - 0.01), Xp + jx + (st == "daze" ? Pf.Round(Pf.Sin(Clock * 18)) : 0), Yp, Face < 0, sx, sy);
            }
            else if (Biting) Blit.DrawScaled(frame, Baked.Anim(FlashT > 0 ? K.WhiteBite : K.Bite), BiteT, Xp + jx, Yp, Face < 0, sx, sy);
            else Blit.DrawScaled(frame, FlashT > 0 ? white : anim, T, Xp + jx, Yp, Face < 0, sx, sy);
            Status.DrawOn(frame, this, snap);
            if (AlertT >= 0 && AlertT < CombatFx.ALERT_T && !Dead_) CombatFx.DrawAlert(frame, Xp, Box().y0 - 3, AlertT, Elite);
        }
    }
}
