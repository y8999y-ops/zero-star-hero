// game/src/player.js 翻成 C#（階段 1：星星形態的移動、跳、穿平台、閃避、普攻三連段、受傷）。
// 技能、大招、其他形態、裝備效果、技能樹在後面的階段才搬；這裡的運算順序照原本，讓比對測試每一步都一樣。
using System;
using System.Collections.Generic;
using UnityEngine;
using PixelFX;

namespace ZeroStar
{
    [Serializable] public class ComboHit { public double t, stop = -1, push = -1, amp = -1; }
    [Serializable] public class ComboStep { public string anim; public double wind, cancel, end, reach, back, start; public double[] dmg; public bool launch, big; public ComboHit[] hits; }
    [Serializable] public class ComboDef { public ComboStep[] steps; }

    public struct Roll { public double Dmg; public bool Crit; }
    public struct Box
    {
        public double X0, X1, Y0, Y1;
        public Box(double x0, double x1, double y0, double y1) { X0 = x0; X1 = x1; Y0 = y0; Y1 = y1; }
        public bool Overlaps(Box b) => X0 < b.X1 && X1 > b.X0 && Y0 < b.Y1 && Y1 > b.Y0;
    }
    public struct HitOpts { public bool Launch; public double Push; }

    /// 主角和怪要用到的世界（main.js 的 world）
    public interface IWorld
    {
        GameMap Map { get; }
        FxSystem Fx { get; }
        CombatFx Combat { get; }
        GameInput Input { get; }
        double SimMs { get; }
        Enemy NearestEnemy(double x, double y, double range, int dir = 0);
        int HitArea(Box box, Func<Roll> dmg, double dir, HitOpts o);
        void Land(double x, double y, bool hard);
        void Dust(double x, double y, int n);
        void DropCoins(double x, double y, int n);
        void OnKill(Enemy e);
        void OnPlayerHurt(double dmg);
        void Sfx(string name);
    }

    public class Player
    {
        const double RUN = 128, ACC_GROUND = 1500, ACC_AIR = 950, GRAV = 1000, MAX_FALL = 430;
        const double JUMP_V = -335, JUMP2_V = -295, COYOTE = 0.15;
        const double DASH_T = 0.19, DASH_V = 345, DASH_CD = 0.32;
        const double ATK_BUF = 0.15;
        const double APEX_V = 50, FALL_K = 1.15;
        public const double MP_REGEN = 0.8;

        static readonly uint WHITE = Col.Hex("#f0ecff");
        static readonly uint[] GHOST = { Col.Hex("#8ae8ff"), Col.Hex("#4ab0d8"), Col.Hex("#2a6ea0"), Col.Hex("#1c3e6a") };

        public double X, Y, Vx, Vy, Face = 1, Coyote, DropT, T, LastAtk = 9, DashCd, SkillCd, Hp = 100, MaxHp = 100, Mp = 100, MaxMp = 100;
        public double Invuln, Flash, LandT, RunDist, Clock, GhostAcc, TurnT, LastFace, AtkBuf, StepAcc, HurtK = 1;
        public bool Grounded, AirDash = true, CritNext;
        public int Jumps, Step;
        public string State = "move", Form = "star", Pose = "stand";
        // 數值（stats.js 的 computeStats；階段 1 先用沒穿裝備的基礎值）
        public double Atk = 12, Def = 0, MoveP = 0, Crit = 0, CritDmg = 10, Charge = 0, DmgMul = 1, BuffAtk = 0, BuffSpd = 0, BuffMove = 0, BuffT = 0;

        public class Attack { public ComboStep S; public double Time; public bool Spawned, Flip, Crit; public int Nh; }
        public Attack Atk_;
        class Ghost { public double X, Y, Age; public string Q; public bool Flip; }
        readonly List<Ghost> ghosts = new List<Ghost>();
        public ComboStep[] Combo;

        public Player(double x, double y, ComboStep[] combo) { X = x; Y = y; Combo = combo; }

        /// 一下攻擊的傷害（攻擊力 × 倍率，再算暴擊）。force＝必定暴擊
        public Roll RollDmg(double mult, bool force = false)
        {
            double critK = Crit + 0;
            bool crit = force || Rnd.Next() * 100 < critK;
            double coreMul = (Hp >= MaxHp * 0.8 ? 1 + 0 / 100.0 : 1) * 1;
            double dmg = Atk * mult * (1 + BuffAtk) * DmgMul * 1.0 * (crit ? 1 + (CritDmg + 0) / 100 : 1) * 1 * coreMul;
            return new Roll { Dmg = dmg, Crit = crit };
        }

        public void Update(double dt, IWorld w)
        {
            var input = w.Input; var map = w.Map;
            Clock += dt;
            T += dt;
            LastAtk += dt;
            DashCd -= dt;
            SkillCd -= dt;
            Mp = Math.Min(MaxMp, Mp + MP_REGEN * dt * (1 + Charge / 100));
            Invuln -= dt; Flash -= dt; LandT -= dt; DropT -= dt; Coyote -= dt; TurnT -= dt;

            // ---- 狀態切換：閃避隨時可以取消攻擊
            if (input.Dash && DashCd <= 0 && State != "hurt" && (Grounded || AirDash))
            {
                input.Consume("dash");
                double dir = Math.Sign(input.Move);
                if (dir == 0)
                {
                    var e = w.NearestEnemy(X, Y, 140);
                    dir = e != null ? (e.X > X ? -1 : 1) : Face;
                }
                State = "dash";
                w.Sfx("dash");
                T = 0; Atk_ = null;
                Vx = dir * DASH_V * 1;
                Vy = 0;
                if (!Grounded) AirDash = false;
                Invuln = Math.Max(Invuln, DASH_T + 0.06);
                DashCd = DASH_CD * 1;
            }
            // 攻擊輸入緩衝
            if (input.Attack) AtkBuf = ATK_BUF; else AtkBuf -= dt;
            if (AtkBuf > 0 && (State == "move" || (State == "attack" && Atk_.Time >= Atk_.S.cancel))) { AtkBuf = input.Attack ? ATK_BUF : 0; StartAttack(w); }
            if ((BuffT -= dt) <= 0) { BuffAtk = 0; BuffSpd = 0; BuffMove = 0; }

            // ---- 各狀態
            double ctl = State == "move" ? 1 : State == "attack" ? 0.25 : 0;
            if (State == "dash")
            {
                Vy = 0;
                if (T >= DASH_T) { State = "move"; Vx *= 0.35; }
                GhostAcc += dt;
                if (GhostAcc > 1 / 40.0) { GhostAcc = 0; ghosts.Add(new Ghost { X = X, Y = Y, Q = Pose, Flip = DrawFlip(), Age = 0 }); }
            }
            else if (State == "attack") UpdateAttack(dt, w);
            else if (State == "hurt") { if (T >= 0.32 * HurtK) State = "move"; }

            // ---- 水平移動
            if (State != "dash" && State != "hurt")
            {
                double target = input.Move * RUN * (1 + MoveP / 100 + BuffMove + 0 + 0 + 0) * ctl;
                double acc = (Grounded ? ACC_GROUND : ACC_AIR) * dt;
                Vx += Math.Max(-acc, Math.Min(acc, target - Vx));
                if (State == "move" && input.Move != 0) Face = Math.Sign(input.Move);
            }
            else if (State == "hurt") Vx *= 1 - 4 * dt;

            // ---- 跳、穿平台
            if (State == "move" || State == "attack")
            {
                if (input.Drop && Grounded && map.OnPlatform(X, Y))
                {
                    input.Consume("drop");
                    DropT = 0.22; Grounded = false; Y += 1;
                }
                else if (input.Jump && (Grounded || Coyote > 0 || Jumps < 2))
                {
                    input.Consume("jump");
                    bool first = Grounded || Coyote > 0;
                    double jk = 1;
                    Vy = (first ? JUMP_V : JUMP2_V) * jk;
                    Jumps = first ? 1 : 2;
                    Grounded = false; Coyote = 0;
                    if (State == "attack") { State = "move"; Atk_ = null; }
                    w.Combat.Dust(first ? "jump" : "double", X, Y);
                    w.Sfx(first ? "jump" : "jump2");
                }
            }
            if (!input.JumpHeld && Vy < -150 && State == "move") Vy = -150;   // 短按跳得低

            // ---- 重力
            if (State != "dash")
            {
                double g = State == "attack" && !Grounded && Vy > -40 ? GRAV * 0.25 : GRAV;   // 空中攻擊時懸停一下
                double cap = MAX_FALL;
                double g2 = State == "move" && !Grounded ? (Math.Abs(Vy) < APEX_V && input.JumpHeld ? g * 0.5 : Vy > 0 ? g * FALL_K : g) : g;
                Vy = Math.Min(cap, Vy + g2 * dt);
            }
            double prevY = Y;
            double nx = map.MoveX(X, X + Vx * dt, Y, 24, 7);
            if (nx != X + Vx * dt && State != "dash") Vx = 0;
            X = Math.Max(7, Math.Min(map.W - 7, nx));
            Y += Vy * dt;
            if (Vy < 0)
            {
                double? cy = map.CeilingAt(X, prevY, Y, 24);
                // 撞頭修正：頭只擦到平台邊角（3px 以內），自動往旁邊推開
                if (cy != null) foreach (int d in new[] { 1, -1, 2, -2, 3, -3 })
                {
                    if (map.CeilingAt(X + d, prevY, Y, 24) == null && map.MoveX(X, X + d, prevY, 24, 7) == X + d) { X += d; cy = null; break; }
                }
                if (cy != null) { Y = cy.Value; Vy = 0; }
            }
            bool wasGrounded = Grounded;
            double? gy = Vy >= 0 ? map.GroundAt(X, prevY, Y, DropT > 0) : null;
            if (gy != null)
            {
                if (!wasGrounded && Vy > 260) LandT = 0.1;
                else if (!wasGrounded && Vy > 150) LandT = 0.07;
                if (!wasGrounded && Vy > 80) w.Land(X, gy.Value, Vy > 260);
                Y = gy.Value; Vy = 0; Grounded = true; Jumps = 0; AirDash = true;
            }
            else if (wasGrounded)
            {
                Grounded = false;
                if (Vy >= 0) { Coyote = COYOTE; Jumps = 1; }
            }
            input.Air = !Grounded && Jumps < 2;
            Unstick(map);

            // ---- 動畫
            if (Face != LastFace)
            {
                if (LastFace != 0) { TurnT = 0.09; if (Grounded && Math.Abs(Vx) > 40 && State == "move") w.Combat.Dust("skid", X, Y, false, LastFace); }
                LastFace = Face;
            }
            if (Grounded && State == "move" && Math.Abs(Vx) > 90) { StepAcc += Math.Abs(Vx) * dt; if (StepAcc > 18) { StepAcc = 0; w.Combat.Dust("step", X - Math.Sign(Vx) * 4, Y); } }
            Pose = PoseNow();
            foreach (var g in ghosts) g.Age += dt;
            while (ghosts.Count > 0 && ghosts[0].Age > 0.22) ghosts.RemoveAt(0);
        }

        /// 卡進地形裡：推回最近的空位（先左右、再往上）
        void Unstick(GameMap map)
        {
            bool Inside(double x, double y) => map.SolidAt(x, y - 3) || map.SolidAt(x, y - 12);
            if (!Inside(X, Y) && Y <= map.H) return;
            for (int d = 1; d <= 40; d++) foreach (int s in new[] { -1, 1 })
            {
                double x = X + s * d;
                if (x > 7 && x < map.W - 7 && !Inside(x, Y) && !map.SolidAt(x + s * 6, Y - 6) && Y <= map.H) { X = x; return; }
            }
            for (int up = 8; up <= 96; up += 8) if (!Inside(X, Y - up)) { Y = map.FloorAt(X, Y - up); Vy = 0; return; }
            Y = map.FloorAt(X, 0); Vy = 0;
        }

        // 自動瞄準：有推方向時優先打前面；前面打不到、但背後很近有敵人，就轉身打背後
        void Aim(IWorld w)
        {
            double mv = w.Input.Move;
            int held = Math.Abs(mv) > 0.3 ? Math.Sign(mv) : 0;
            if (held != 0 && w.NearestEnemy(X, Y - 16, 80, held) != null) { Face = held; return; }
            var e = w.NearestEnemy(X, Y - 16, held != 0 ? 70 : 150);
            if (e != null) Face = e.X >= X ? 1 : -1;
            else if (held != 0) Face = held;
        }

        void StartAttack(IWorld w)
        {
            if (State != "attack" && LastAtk > 0.45) Step = 0;
            var s = Combo[Step % Combo.Length];
            Step = (Step + 1) % Combo.Length;
            Aim(w);
            State = "attack"; T = 0;
            Atk_ = new Attack { S = s, Time = s.start, Spawned = false, Nh = 0, Flip = Face < 0, Crit = CritNext };
            CritNext = false;
            LastAtk = 0;
        }

        void UpdateAttack(double dt, IWorld w)
        {
            var a = Atk_; var s = a.S; double spd = 1 + BuffSpd;
            a.Time += dt * spd;
            LastAtk = 0;
            double mv = w.Input.Move;
            if (!a.Spawned && Math.Abs(mv) > 0.3 && Math.Sign(mv) != Face) { Face = Math.Sign(mv); a.Flip = Face < 0; }
            if (!a.Spawned && a.Time >= 0)
            {
                a.Spawned = true;
                w.Fx.Spawn(Baked.Anim(s.anim), Pf.Round(X), Pf.Round(Y), a.Flip, speed: spd);
                w.Sfx("swing");
                if (Grounded) Vx = Face * 70;
            }
            for (; a.Nh < s.hits.Length && s.hits[a.Nh].t <= a.Time; a.Nh++)
            {
                var h = s.hits[a.Nh]; double d = Face;
                double reach = s.reach * 1 * (1 + 0 / 100.0);
                var box = new Box(X - d * s.back, X + d * reach, Y - 44, Y + 4);
                if (box.X0 > box.X1) { double tmp = box.X0; box.X0 = box.X1; box.X1 = tmp; }
                double mult = (a.Nh < s.dmg.Length ? s.dmg[a.Nh] : s.dmg[0]) * (1 + 0.05 * 0);
                bool force = a.Crit && a.Nh == 0;
                bool fin = s.launch && a.Nh == s.hits.Length - 1;
                double finMul = fin ? 1 + 0 / 100.0 : 1;
                double push = (h.push >= 0 ? h.push : 2) * 1 * (1 + 0 / 100.0);
                int n = w.HitArea(box, () => RollDmg(mult * finMul, force), d, new HitOpts { Launch = fin, Push = push });
                if (n > 0)
                {
                    w.Fx.HitStop(Math.Min(s.big ? 0.14 : 0.11, (h.stop >= 0 ? h.stop : 0.06) * (n > 3 ? 0.7 : 1)));
                    if (fin || a.Crit || s.big) w.Fx.Shake(0.2, Math.Min(s.big ? 4 : 3, (h.amp >= 0 ? h.amp : 2) + 1 + (n > 4 ? 1 : 0)), true, d);
                    else w.Fx.Shake(0.1, 2, false, d);
                }
                else if (s.big) w.Fx.Shake(0.2, 2);
            }
            if (a.Time >= s.end) { State = "move"; Atk_ = null; }
        }

        public bool Hurt(double dmg, double fromX, IWorld w)
        {
            if (Invuln > 0 || State == "dash") return false;
            double def = Def * 1 * 1;
            dmg = Math.Max(1, Pf.Round(dmg * (1 - def / (def + 60)) * 1 * 1));
            Hp = Math.Max(0, Hp - dmg);
            Invuln = 0.9; Flash = 0.08;
            State = "hurt"; T = 0; Atk_ = null;
            HurtK = 1;
            Vx = (X >= fromX ? 1 : -1) * 170 * HurtK;
            Vy = -170 * HurtK;
            Grounded = false;
            w.Fx.HitStop(0.07);
            w.Fx.Shake(0.25, 3);
            w.Sfx("hurt");
            w.Fx.Spawn(Baked.Anim("sparkRed"), Pf.Round(X), Pf.Round(Y) - 6, X < fromX);
            w.OnPlayerHurt(dmg);
            return true;
        }

        string PoseNow()
        {
            switch (State)
            {
                case "attack": return AttackPose();
                case "dash": return "dash";
                case "hurt": return "hurt";
            }
            if (TurnT > 0 && State == "move") return "turn";
            if (!Grounded) return Vy < -120 ? "jump" : Vy < 90 ? "apex" : Vy < 300 ? "fall" : "fallFast";
            if (LandT > 0) return LandT > 0.05 ? "land" : "landUp";
            if (Math.Abs(Vx) > 20)
            {
                RunDist += Math.Abs(Vx) / 60;
                return "run#" + (int)(Math.Floor(RunDist / 9) % 4);
            }
            return "idle#" + (int)(Math.Floor(Clock * 8) % 8);
        }

        string AttackPose()
        {
            var a = Atk_; var s = a.S; var hits = s.hits; double t = a.Time;
            string Kind(int k) => s.launch && k == hits.Length - 1 ? "Up" : (Step + k) % 2 == 0 ? "F" : "B";
            int k0 = 0;
            while (k0 + 1 < hits.Length && hits[k0 + 1].t - 0.05 <= t) k0++;
            double d = t - hits[k0].t; string K = Kind(k0);
            if (d < -0.05) return K == "B" ? "windB" : "windF";
            if (d < 0) return "smear" + K;
            if (d < 0.07) return K == "Up" ? "punchUp" : "hit" + K;
            if (d < 0.15) return K == "B" ? "followB" : "followF";
            return "land";
        }

        public bool DrawFlip() => Atk_ != null ? Atk_.Flip : Face < 0;

        public void Draw(Frame frame)
        {
            foreach (var g in ghosts) HeroArt.Paint(frame, g.X, g.Y, HeroArt.Pose(Form, g.Q), g.Flip, GHOST[Math.Min(GHOST.Length - 1, (int)Math.Floor((g.Age / 0.22) * GHOST.Length))]);
            if (Invuln > 0 && State != "dash" && (long)Math.Floor(Clock * 20) % 2 == 0) return;
            HeroArt.Paint(frame, X, Y, HeroArt.Pose(Form, Pose), DrawFlip(), Flash > 0 ? WHITE : 0);
        }

        /// 重生（階段 1 的簡化：回到檢查點、補滿血）
        public void Respawn(double x, double y)
        {
            X = x; Y = y; Vx = Vy = 0; Hp = MaxHp; State = "move"; Atk_ = null; Invuln = 1; Grounded = false; ghosts.Clear();
        }
    }
}
