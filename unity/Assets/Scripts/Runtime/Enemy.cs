// game/src/enemies.js 翻成 C#（階段 1：史萊姆）。蝙蝠、垃圾桶怪、刺蝟、菁英在後面的階段才搬。
// 外觀是網頁版烘焙好的動畫；移動跟著動畫的節奏（只在「跳起來」那段時間往前）。
using System;
using System.Collections.Generic;
using PixelFX;

namespace ZeroStar
{
    public class EnemyKind
    {
        public string Name, Anim, White, Poof;
        public double Hp, Dmg, W, H; public int Coin0, Coin1; public bool Fly;
        public static readonly Dictionary<string, EnemyKind> All = new Dictionary<string, EnemyKind>
        {
            ["slime"] = new EnemyKind { Name = "slime", Anim = "slime", White = "slimeWhite", Poof = "poofSlime", Hp = 34, Dmg = 8, W = 15, H = 22, Coin0 = 1, Coin1 = 3 },
        };
    }

    public class Enemy : IBoxed
    {
        const double GRAV = 900;
        const double HOP_AIM = 0.84, HOP_UP = 0.9, HOP_DOWN = 1.44;
        const double SQ_T = 0.18;
        public const double HP_MUL = 3;
        public static int Seed = 1;
        static readonly List<(double x, double y, double t)> recentPoofs = new List<(double, double, double)>();
        public static void ResetStatics() { Seed = 1; recentPoofs.Clear(); }

        public readonly EnemyKind K; public readonly string Kind; readonly Anim anim, white;
        public double X0, Vx, Vy, Hp, MaxHp, Stun, FlashT, Face = 1, Clock, HopDir = 1, T, Speed, SqT, AwakeT, AlertT = -1;
        public double Xp, Yp;
        public bool Dead_, Awake, DeepSleep, FlungUp;
        public StatusSet St;
        public double MarkT, FlungT, FlungDmg, DizzyT, MeteorMark; public HashSet<Enemy> FlungHit;   // 元素狀態（status.js 的 e.st）
        IWorld world;
        public bool Dead => Dead_;
        public double X => Xp;
        public double Y => Yp;

        public Enemy(string kind, double x, double y)
        {
            K = EnemyKind.All[kind]; Kind = kind;
            anim = Baked.Anim(K.Anim); white = Baked.Anim(K.White);
            Seed++;
            Xp = x; Yp = y; Hp = K.Hp * HP_MUL; MaxHp = K.Hp * HP_MUL;
            T = Pf.Rand(Seed, 3) * anim.Duration;
            Speed = (52 + Pf.Rand(Seed, 4) * 30) * 1;
        }

        public (double x0, double x1, double y0, double y1) Box() => (Xp - K.W, Xp + K.W, Yp - K.H, Yp);
        public Box HitBox() { var b = Box(); return new Box(b.x0, b.x1, b.y0, b.y1); }

        public void Update(double dt, Player player, IWorld world)
        {
            Clock += dt;
            dt *= St != null && St.Slime > 0 ? 0.5 : 1;   // 黏液：動作、移動都變慢
            this.world = world;
            FlashT -= dt;
            if (SqT > 0) SqT -= dt;
            if (MarkT > 0) MarkT -= dt;
            bool stunned = Stun > 0;
            Stun -= dt;
            if (!stunned) T += dt;
            double toward = player.X >= Xp ? 1 : -1;
            if (!Awake)
            {
                if ((!DeepSleep && Math.Abs(player.X - Xp) < 160 && Math.Abs(player.Y - Yp) < 90) || Hp < MaxHp)
                {
                    Awake = true; AlertT = 0;
                    world.Sfx("chime");
                }
                else
                {
                    Vx *= 1 - 8 * dt; Vy += GRAV * dt; Land(dt, world);
                    return;
                }
            }
            AwakeT += dt;
            if (AlertT >= 0 && AlertT < CombatFx.ALERT_T) AlertT += dt;
            // 史萊姆：只在自己動畫的「跳起來」那段時間移動
            double t = T % anim.Duration;
            if (!stunned && t >= HOP_AIM && t < HOP_UP) HopDir = toward;
            bool hopping = !stunned && t >= HOP_UP && t < HOP_DOWN;
            if (hopping) Vx = HopDir * Speed;
            else if (!stunned) Vx *= 1 - 12 * dt;
            else Vx *= 1 - 4 * dt;
            Vy += GRAV * dt;
            Land(dt, world);
            Face = HopDir;
        }

        /// 地上的怪移動＋落地＋撞牆（撞牆就彈回來）
        void Land(double dt, IWorld world)
        {
            var map = world.Map;
            double prevY = Yp, want = Xp + Vx * dt, nx = map.MoveX(Xp, want, Yp, 18, 9);
            if (nx != want) Vx = -Vx * 0.5;
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

        public void Hit(Roll roll, double dir, HitOpts o, IWorld world)
        {
            double dmg = roll.Dmg * (MarkT > 0 ? 1.1 : 1); bool crit = roll.Crit;   // 尖刺星「破綻」：被標記的多受 10% 傷害
            if (crit && roll.Mark) MarkT = 3;
            // 星核「沉重」：被打飛的這隻，0.4 秒內撞到別的敵人時對方也受傷
            if (o.Fling) { FlungT = 0.4; FlungDmg = dmg * 0.5; FlungHit = new HashSet<Enemy> { this }; }
            double d = Math.Max(1, Pf.Round(dmg * (0.9 + Rnd.Next() * 0.2) * 1));
            Hp -= d;
            FlashT = 0.07;
            SqT = SQ_T;
            Stun = 0.3;
            Vx = dir * o.Push * (K.Fly ? 55 : 42);
            if (o.Launch || crit) { Vy = K.Fly ? -120 : -230; FlungUp = !K.Fly; }
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
        public void Tick(double dmg, IWorld w, bool small = false)
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
            if (crowded) world.Fx.Spawn(Baked.Anim("spark"), Pf.Round(Xp), Pf.Round((b.y0 + b.y1) / 2), speed: 1.2);
            else world.Fx.Spawn(Baked.Anim(K.Poof), Pf.Round(Xp), Pf.Round(b.y1), speed: 1.5);
            world.DropCoins(Xp, (b.y0 + b.y1) / 2, K.Coin0 + (int)Math.Floor(Rnd.Next() * (K.Coin1 - K.Coin0 + 1)));
            world.OnKill(this);
        }

        public void Draw(Frame frame, FxSystem fx, double simMs)
        {
            double sx = 1, sy = 1, jx = 0;
            if (SqT > 0)
            {
                double p = 1 - SqT / SQ_T;
                if (p < 0.4) { sx = 1.18; sy = 0.85; }
                else { double q = (p - 0.4) / 0.6, w = Pf.Sin(q * Math.PI) * (1 - q); sx = 1 - 0.14 * w; sy = 1 + 0.16 * w; }
            }
            if (fx.Freeze > 0 && FlashT > 0) jx = (long)Math.Floor(simMs / 34) % 2 != 0 ? 1 : -1;   // 停頓中原地抖
            var snap = Status.TakeSnap(frame, this);   // 有元素狀態：先記下這塊畫面，畫完比對出身體的形狀
            Blit.DrawScaled(frame, FlashT > 0 ? white : anim, T, Xp + jx, Yp, Face < 0, sx, sy);
            Status.DrawOn(frame, this, snap);
            if (AlertT >= 0 && AlertT < CombatFx.ALERT_T && !Dead_) CombatFx.DrawAlert(frame, Xp, Box().y0 - 3, AlertT);
        }
    }
}
