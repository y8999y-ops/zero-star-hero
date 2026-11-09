// game/src/player.js 翻成 C#（完整版）：移動、跳、穿平台、閃避、五形態連段與技能、受傷，
// 加上技能樹（Rank）、裝備數值（Stats）、星核核心效果（Core）、傳說效果（Has）、套裝 4 件（Set4）、星王化（KingT）。
// 運算順序照原本，讓比對測試每一步都一樣。
using System;
using System.Collections.Generic;
using UnityEngine;
using PixelFX;

namespace ZeroStar
{
    [Serializable] public class ComboHit { public double t, stop = -1, push = -1, amp = -1; }
    [Serializable] public class ComboStep { public string anim; public double wind, cancel, end, reach, back, start; public double[] dmg; public bool launch, big; public ComboHit[] hits; }
    [Serializable] public class FormCombo { public string form, skill; public ComboStep[] steps; }
    [Serializable] public class ComboDef { public FormCombo[] forms; public double CHARGE_T, CHARGE_V, SPIKE_T, SPIKE_V, FLY_T, FLY_VX, FLY_VY, GLIDE_FALL; }

    public struct Roll { public double Dmg; public bool Crit, Mark; }
    public struct Box
    {
        public double X0, X1, Y0, Y1;
        public Box(double x0, double x1, double y0, double y1) { X0 = x0; X1 = x1; Y0 = y0; Y1 = y1; }
        public bool Overlaps(Box b) => X0 < b.X1 && X1 > b.X0 && Y0 < b.Y1 && Y1 > b.Y0;
    }
    public struct HitOpts { public bool Launch, Fling; public double Push; public string Elem; }

    /// 主角的戰鬥數值（stats.js 的 computeStats 的結果）
    public class Stats
    {
        public double Atk = 12, MaxHp = 100, Def, Crit, CritDmg = 10, Skill, Ult, Charge, Cdr, Leech, Move, Mf, MaxMp = 100;
        public HashSet<string> Uniques = new HashSet<string>();
        public Dictionary<string, int> Sets = new Dictionary<string, int>();
        public string CoreId; public double CoreX; public int CoreTier;   // 星核的核心效果
    }

    /// 主角和怪要用到的世界（main.js 的 world）
    public interface IWorld
    {
        GameMap Map { get; }
        FxSystem Fx { get; }
        CombatFx Combat { get; }
        GameInput Input { get; }
        double SimMs { get; }
        int Rank(string form, string id);
        Enemy NearestEnemy(double x, double y, double range, int dir = 0);
        List<Enemy> EnemiesIn(Box box);
        int HitArea(Box box, Func<Roll> dmg, double dir, HitOpts o);
        int HitOnce(Box box, HashSet<Enemy> hit, Func<Roll> dmg, double dir, HitOpts o);
        void SpawnFireball(double x, double y, double dir, string form, double vy = 0);
        void NoMana();
        void Land(double x, double y, bool hard);
        void Dust(double x, double y, int n);
        void DropCoins(double x, double y, int n);
        void OnKill(Enemy e);
        void OnPlayerHurt(double dmg);
        void Sfx(string name);
        // 技能樹、星核的效果
        void GroundSlam(double x, double y, double r, double mult);
        void SpikeBurst(double x, double y);
        void Thorns(double fromX, double y);
        void SpawnWave(double x, double y, double dir);
        void OnGlide(double dt);
        void CometStart();
        void CoreMeteor();
        void CoreStun(double fromX, double y);
    }

    public class Player
    {
        const double RUN = 128, ACC_GROUND = 1500, ACC_AIR = 950, GRAV = 1000, MAX_FALL = 430;
        const double JUMP_V = -335, JUMP2_V = -295, COYOTE = 0.15;
        const double DASH_T = 0.19, DASH_V = 345, DASH_CD = 0.32;
        const double ATK_BUF = 0.15;
        const double APEX_V = 50, FALL_K = 1.15;
        public const double MP_REGEN = 0.8, MP_COST = 25, COMBO_MP = 10, SKILL_CD = 1.1;
        public static readonly Dictionary<string, string> ELEM = new Dictionary<string, string> { ["star"] = "burn", ["slime"] = "slime", ["can"] = "shock", ["bat"] = "poison" };

        static readonly uint WHITE = Col.Hex("#f0ecff");
        static readonly uint[] GHOST = { Col.Hex("#8ae8ff"), Col.Hex("#4ab0d8"), Col.Hex("#2a6ea0"), Col.Hex("#1c3e6a") };

        public double X, Y, Vx, Vy, Face = 1, Coyote, DropT, T, LastAtk = 9, DashCd, SkillCd, Hp = 100, MaxHp = 100, Mp = 100, MaxMp = 100;
        public double HideT;   // 大招（尖刺星）期間主角藏起來
        public double Invuln, Flash, LandT, RunDist, Clock, GhostAcc, TurnT, LastFace, AtkBuf, StepAcc, HurtK = 1, BoostT;
        // 各種效果的倒數（技能樹、星核、套裝、神話）
        public double ResonT, KingT, LightT, FilmT, CurlT, DentT, NightT, ShadowT, MeteorT, DoubleT, LeechBudget, Shield;
        public bool Grounded, AirDash = true, CritNext, DoubleReady;
        public int Jumps, Step;
        public string State = "move", Form = "star", Pose = "stand";
        public double DmgMul = 1, BuffAtk = 0, BuffSpd = 0, BuffMove = 0, BuffT = 0;
        public Stats S = new Stats();
        public double Atk => S.Atk;
        public Func<string, string, int> RankFn = (f, id) => 0;
        int Rank(string f, string id) => RankFn(f, id);

        public class Attack { public ComboStep S; public double Time; public bool Spawned, Flip, Crit; public int Nh; }
        public Attack Atk_;
        class Ghost { public double X, Y, Age; public string Q; public bool Flip; }
        readonly List<Ghost> ghosts = new List<Ghost>();
        public ComboStep[] Combo;
        readonly ComboDef def;
        string skill = "stardust";
        public double SkillMax = SKILL_CD, ChargeDur, FlyDur, SpikeDur;
        bool cast; int spikeBounce;
        HashSet<Enemy> chargeHit = new HashSet<Enemy>();
        readonly List<Enemy> truck = new List<Enemy>();   // 回收車推著走的怪（照加入順序）

        public Player(double x, double y, ComboDef def) { X = x; Y = y; this.def = def; SetForm("star"); SetStats(new Stats()); }

        /// 套用裝備算出來的數值
        public void SetStats(Stats s)
        {
            double grow = s.MaxHp - (S?.MaxHp ?? s.MaxHp);
            S = s;
            MaxHp = s.MaxHp;
            Hp = Math.Max(1, Math.Min(MaxHp, Hp + Math.Max(0, grow)));
            SkillMax = SKILL_CD * (1 - s.Cdr / 100);
            MaxMp = s.MaxMp;
            Mp = Math.Min(MaxMp, Mp);
            if (State == "attack") { State = "move"; Atk_ = null; }
            Step = 0;
        }
        public bool Has(string u) => S.Uniques.Contains(u);
        public double Core(string id) => S.CoreId == id ? S.CoreX : 0;
        public bool Set4(string id) => S.Sets.TryGetValue(id, out var n) && n >= 4;

        /// 換形態：連段、技能、身體顏色一起換
        public void SetForm(string id)
        {
            Form = id;
            foreach (var f in def.forms) if (f.form == id) { Combo = f.steps; skill = f.skill; }
            Step = 0;
            if (State == "attack") { State = "move"; Atk_ = null; }
        }

        /// 一下攻擊的傷害（攻擊力 × 倍率，再算暴擊）。force＝必定暴擊。吸血：傷害的 leech% 回復生命
        public Roll RollDmg(double mult, bool force = false)
        {
            var s = S; bool spk = Form == "spike";
            double critK = s.Crit + (spk ? 8 + 3 * Rank("spike", "k_tip") + Rank("spike", "p_spike") : 0);
            bool crit = force || Rnd.Next() * 100 < critK;
            double coreMul = (Hp >= MaxHp * 0.8 ? 1 + Core("dawn") / 100 : 1) * (ShadowT > 0 ? 1 + Core("shadow") / 100 : 1);
            double dmg = s.Atk * mult * (1 + BuffAtk) * DmgMul * 1.0 * (crit ? 1 + (s.CritDmg + (spk && Rank("spike", "k_sharp") != 0 ? 25 : 0)) / 100 : 1) * (KingT > 0 ? 1.2 : 1) * coreMul;
            if (s.Leech > 0 && Hp > 0)
            {
                bool feast = Set4("feast"); double k = feast && Hp < MaxHp * 0.3 ? 2 : 1;
                double h = Math.Min(LeechBudget, (dmg * s.Leech * k) / 100);
                LeechBudget -= h;
                double over = Hp + h - MaxHp;
                Hp = Math.Min(MaxHp, Hp + h);
                if (feast && over > 0) Shield = Math.Min(MaxHp * 0.2, Shield + over);
            }
            return new Roll { Dmg = dmg, Crit = crit, Mark = spk && Rank("spike", "k_mark") > 0 };
        }

        /// 技能傷害倍率：技能傷害% ×（星辰共鳴 4 件：大招後 10 秒 +25%）
        public double SkillMul() => (1 + S.Skill / 100) * (ResonT > 0 ? 1.25 : 1);

        public void Update(double dt, IWorld w)
        {
            var input = w.Input; var map = w.Map;
            Clock += dt;
            if (HideT > 0) { HideT -= dt; Vx = Vy = 0; ghosts.Clear(); return; }
            if (ResonT > 0) ResonT -= dt;
            if (KingT > 0) KingT -= dt;
            if (LightT > 0) LightT -= dt;
            if (FilmT > 0) FilmT -= dt;
            if (CurlT > 0) CurlT -= dt;
            if (DentT > 0) DentT -= dt;
            if (NightT > 0) NightT -= dt;
            if (ShadowT > 0) ShadowT -= dt;
            MeteorT += dt;
            if (DoubleT > 0) DoubleT -= dt;
            LeechBudget = Math.Min(MaxHp * 0.05, LeechBudget + MaxHp * 0.05 * dt);
            T += dt;
            LastAtk += dt;
            DashCd -= dt;
            SkillCd -= dt;
            Mp = Math.Min(MaxMp, Mp + MP_REGEN * dt * (1 + S.Charge / 100));
            Invuln -= dt; Flash -= dt; LandT -= dt; DropT -= dt; Coyote -= dt; TurnT -= dt;

            // ---- 狀態切換：閃避和技能隨時可以取消攻擊
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
                Vx = dir * DASH_V * (Has("slipper") ? 1.5 : 1);
                if (Has("slipper")) CritNext = true;
                if (Core("shadow") != 0) ShadowT = 2;
                if (Core("comet") != 0) w.CometStart();
                Vy = 0;
                if (!Grounded) AirDash = false;
                Invuln = Math.Max(Invuln, DASH_T + 0.06);
                DashCd = DASH_CD * (NightT > 0 ? 0.7 : 1);
            }
            // 魔力不夠：按了沒反應，魔力條閃一下（二段飛不用魔力）
            if (input.Skill && SkillCd <= 0 && !(DoubleT > 0) && Mp < MP_COST && State != "hurt" && State != "dash") { input.Consume("skill"); w.NoMana(); }
            if (input.Skill && (SkillCd <= 0 || DoubleT > 0) && State != "hurt" && State != "dash")
            {
                input.Consume("skill");
                if (!(DoubleT > 0)) Mp -= MP_COST;
                Aim(w);
                State = "cast"; T = 0; Atk_ = null; cast = false;
                SkillCd = SkillMax * (ResonT > 0 ? 0.7 : 1);
                double mt = Core("meteor");
                if (mt != 0 && MeteorT >= mt) { MeteorT = 0; w.CoreMeteor(); }
            }
            // 攻擊輸入緩衝
            if (input.Attack) AtkBuf = ATK_BUF; else AtkBuf -= dt;
            if (AtkBuf > 0 && (State == "move" || (State == "attack" && Atk_.Time >= Atk_.S.cancel))) { AtkBuf = input.Attack ? ATK_BUF : 0; StartAttack(w); }
            if ((BuffT -= dt) <= 0) { BuffAtk = 0; BuffSpd = 0; BuffMove = 0; }
            // 形態被動「黏液再生」
            if (Form == "slime" && Hp > 0 && Hp < MaxHp) { int pr = Rank("slime", "p_slime"); if (pr != 0) Hp = Math.Min(MaxHp, Hp + MaxHp * (0.009 + 0.001 * pr) * dt); }

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
            else if (State == "cast")
            {
                if (!cast && T >= 0.1)
                {
                    cast = true;
                    ChargeDur = def.CHARGE_T * (1 + 0.12 * Rank("can", "c_long"));
                    FlyDur = def.FLY_T * (1 + 0.12 * Rank("bat", "b_far"));
                    if (skill == "spikeball")
                    {
                        State = "spikeball"; T = 0; chargeHit = new HashSet<Enemy>(); spikeBounce = 0;
                        SpikeDur = def.SPIKE_T * (1 + 0.12 * Rank("spike", "k_long"));
                        Invuln = Math.Max(Invuln, SpikeDur + 0.05); w.Sfx("dash");
                        if (DoubleT > 0) DoubleT = 0; else DoubleReady = Rank("spike", "k_double") != 0;
                    }
                    else if (skill == "charge") { State = "charge"; T = 0; chargeHit = new HashSet<Enemy>(); truck.Clear(); Invuln = Math.Max(Invuln, ChargeDur + 0.05); }
                    else if (skill == "flight")
                    {
                        State = "fly"; T = 0; chargeHit = new HashSet<Enemy>(); Grounded = false; Invuln = Math.Max(Invuln, FlyDur + 0.05); w.Sfx("dash");
                        if (DoubleT > 0) DoubleT = 0; else DoubleReady = Rank("bat", "b_double") != 0;
                    }
                    else
                    {
                        w.SpawnFireball(X + Face * 18, Y - 14, Face, Form);
                        // 星王化＋星星：一次射 3 發（上、中、下）
                        if (KingT > 0 && Form == "star") foreach (double vy in new[] { -70.0, 70 }) w.SpawnFireball(X + Face * 18, Y - 14, Face, Form, vy);
                    }
                }
                if (State == "cast" && T >= 0.28) State = "move";
            }
            else if (State == "charge")
            {
                // 鐵罐星：往前衝，路上的怪每隻打一次、擊飛
                Vx = Face * def.CHARGE_V;
                GhostAcc += dt;
                if (GhostAcc > 1 / 30.0) { GhostAcc = 0; ghosts.Add(new Ghost { X = X, Y = Y, Q = Pose, Flip = DrawFlip(), Age = 0 }); }
                w.HitOnce(new Box(X - 12, X + 12, Y - 26, Y + 2), chargeHit, () => RollDmg(2.2 * SkillMul()), Face, new HitOpts { Launch = true, Push = 4, Elem = "shock" });
                // 技能樹「回收車」：路上的小怪被推著走
                if (Rank("can", "c_truck") != 0) foreach (var e in w.EnemiesIn(new Box(X - 4, X + Face * 26, Y - 30, Y + 4)))   // 跟網頁版一樣不排序左右（往左時這個框是反的）
                {
                    if (e.IsBoss) continue;
                    if (!truck.Contains(e)) truck.Add(e);
                    e.Xp = X + Face * (16 + truck.Count * 3); e.Vx = Vx; e.Stun = Math.Max(e.Stun, 0.3);
                }
                if (T >= ChargeDur)
                {
                    State = "move"; Vx *= 0.3;
                    if (KingT > 0) SkillCd = Math.Min(SkillCd, 0.15);
                    if (truck.Count > 0) { foreach (var e in truck) if (!e.Dead) e.Hit(RollDmg(1.2 * SkillMul()), Face, new HitOpts { Launch = true, Push = 6, Elem = "shock" }, w); truck.Clear(); }
                    if (Rank("can", "c_brake") != 0) w.GroundSlam(X, Y, 46, 1.2);
                }
            }
            else if (State == "spikeball")
            {
                // 尖刺星：縮成刺球往前滾，路上的怪每隻刺一次；撞牆彈回來一次
                Vx = Face * def.SPIKE_V;
                GhostAcc += dt;
                if (GhostAcc > 1 / 24.0) { GhostAcc = 0; w.Combat.Dust("step", X - Face * 5, Y); }
                w.HitOnce(new Box(X - 13, X + 13, Y - 24, Y + 2), chargeHit, () => RollDmg(1.7 * SkillMul()), Face, new HitOpts { Push = 3 });
                if (T >= SpikeDur)
                {
                    State = "move"; Vx *= 0.3;
                    if (Rank("spike", "k_shed") != 0) w.SpikeBurst(X, Y - 10);
                    if (Rank("spike", "k_refund") != 0 && chargeHit.Count >= 3) SkillCd *= 0.5;
                    if (KingT > 0) SkillCd = Math.Min(SkillCd, 0.15);
                    if (DoubleReady) { DoubleReady = false; DoubleT = 1.2; }
                }
            }
            else if (State == "fly")
            {
                // 蝠翼星：往前上方飛，越飛越平；路上的怪每隻打一次。飛完可以再跳一次
                Vx = Face * def.FLY_VX;
                Vy = def.FLY_VY * (1 - T / def.FLY_T);
                GhostAcc += dt;
                if (GhostAcc > 1 / 30.0) { GhostAcc = 0; ghosts.Add(new Ghost { X = X, Y = Y, Q = Pose, Flip = DrawFlip(), Age = 0 }); }
                w.HitOnce(new Box(X - 14, X + 14, Y - 28, Y + 2), chargeHit, () => RollDmg(1.8 * SkillMul()), Face, new HitOpts { Push = 3, Elem = "poison" });
                if (T >= FlyDur)
                {
                    State = "move"; Vx *= 0.5; Jumps = Math.Min(Jumps, 1);
                    if (KingT > 0) SkillCd = Math.Min(SkillCd, 0.15);
                    if (DoubleReady) { DoubleReady = false; DoubleT = 1.2; }
                }
            }
            else if (State == "hurt") { if (T >= 0.32 * HurtK) State = "move"; }

            // ---- 水平移動
            if (State != "dash" && State != "hurt" && State != "charge" && State != "fly" && State != "spikeball")
            {
                double target = input.Move * RUN * (1 + S.Move / 100 + BuffMove + (LightT > 0 ? 0.2 : 0) + (NightT > 0 ? 0.3 : 0) + (Form == "bat" ? 0.02 * Rank("bat", "p_bat") : 0)) * ctl;
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
                    double jk = Form == "bat" ? Math.Sqrt(1 + 0.015 * Rank("bat", "p_bat")) : 1;
                    Vy = (first ? JUMP_V : JUMP2_V) * jk;
                    Jumps = first ? 1 : 2;
                    Grounded = false; Coyote = 0;
                    if (State == "attack") { State = "move"; Atk_ = null; }
                    w.Combat.Dust(first ? "jump" : "double", X, Y);
                    w.Sfx(first ? "jump" : "jump2");
                }
            }
            if (BoostT > 0) BoostT -= dt;
            else if (!input.JumpHeld && Vy < -150 && State == "move") Vy = -150;   // 短按跳得低

            // ---- 重力
            if (State != "dash" && State != "fly")
            {
                // 空中攻擊時懸停一下（蝠翼星停得更久；懸停：更久）
                bool bat = Form == "bat";
                double g = State == "attack" && !Grounded && Vy > -40 ? GRAV * (bat ? (Rank("bat", "b_hover") != 0 ? 0.03 : 0.08) : 0.25) : GRAV;
                // 蝠翼星按住跳往下掉時：滑翔（星王化：不會往下掉）
                bool gliding = bat && input.JumpHeld && State == "move" && !Grounded && Vy > 0;
                double cap = gliding ? (KingT > 0 ? 0 : def.GLIDE_FALL) : MAX_FALL;
                if (gliding) w.OnGlide(dt);
                double g2 = State == "move" && !Grounded && !gliding && !(BoostT > 0) ? (Math.Abs(Vy) < APEX_V && input.JumpHeld ? g * 0.5 : Vy > 0 ? g * FALL_K : g) : g;
                Vy = Math.Min(cap, Vy + g2 * dt);
            }
            double prevY = Y;
            double nx = map.MoveX(X, X + Vx * dt, Y, 24, 7);
            if (nx != X + Vx * dt && State == "spikeball" && spikeBounce == 0) { spikeBounce = 1; Face = -Face; w.Dust(X, Y, 4); }   // 刺球撞牆彈回來
            if (nx != X + Vx * dt && State != "dash") Vx = 0;
            X = Math.Max(7, Math.Min(map.W - 7, nx));
            Y += Vy * dt;
            if (Vy < 0)
            {
                double? cy = map.CeilingAt(X, prevY, Y, 24);
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
                w.Sfx("swing:" + Form);   // 揮擊聲照形態（鐵罐叮、黏液悶、其他咻）
                if (Grounded) Vx = Face * 70;
            }
            for (; a.Nh < s.hits.Length && s.hits[a.Nh].t <= a.Time; a.Nh++)
            {
                var h = s.hits[a.Nh]; double d = Face;
                double reach = s.reach * (Form == "slime" ? 1 + 0.08 * Rank("slime", "g_horn") : 1) * (1 + Core("long") / 100);
                var box = new Box(X - d * s.back, X + d * reach, Y - 44, Y + 4);
                if (box.X0 > box.X1) { double tmp = box.X0; box.X0 = box.X1; box.X1 = tmp; }
                double mult = (a.Nh < s.dmg.Length ? s.dmg[a.Nh] : s.dmg[0]) * (Form == "star" ? 1 + 0.05 * Rank("star", "s_edge") : Form == "bat" ? 1 + 0.04 * Rank("bat", "b_claw") : 1);
                bool force = a.Crit && a.Nh == 0;
                // 連段最後一下沾上形態的元素；黏液角：黏液星每一下都沾
                bool fin = s.launch && a.Nh == s.hits.Length - 1;
                double finMul = fin ? 1 + Core("rust") / 100 : 1;
                bool coat = fin || (Form == "slime" && Rank("slime", "g_coat") != 0);
                double push = (h.push >= 0 ? h.push : 2) * (Form == "can" ? 1 + 0.1 * Rank("can", "c_weight") : 1) * (1 + Core("heavy") / 100);
                string elem = coat && ELEM.TryGetValue(Form, out var el) ? el : null;
                int n = w.HitArea(box, () => RollDmg(mult * finMul, force), d, new HitOpts { Launch = fin, Push = push, Elem = elem, Fling = Core("heavy") > 0 });
                if (fin && Form == "can" && Rank("can", "c_quake") != 0) w.GroundSlam(X + d * 18, Y, 54, 0.6);
                if (fin && Form == "star")
                {
                    if (Rank("star", "s_wave") != 0) w.SpawnWave(X + d * 10, Y - 16, d);
                    if (Rank("star", "s_light") != 0) LightT = 2;
                }
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
            // 夜宴的護盾先擋
            if (Shield > 0) { double a = Math.Min(Shield, dmg); Shield -= a; dmg -= a; if (dmg <= 0) { Invuln = 0.5; Flash = 0.06; w.Sfx("hitL"); return true; } }
            double def = S.Def * (DentT > 0 ? 1.5 : 1) * (Hp < MaxHp * 0.4 ? 1 + Core("rock") / 100 : 1);
            // 星核「鈍光」：一定機率讓攻擊你的敵人暈 1 秒
            if (Core("dull") != 0 && Rnd.Next() * 100 < Core("dull")) w.CoreStun(fromX, Y);
            dmg = Math.Max(1, Pf.Round(dmg * (1 - def / (def + 60)) * (FilmT > 0 ? 0.75 : 1) * (CurlT > 0 ? 0.75 : 1)));
            if (Form == "spike" && Rank("spike", "k_thorn") != 0) w.Thorns(fromX, Y);
            // 鐵皮（鐵罐星）：攻擊中被打不會中斷，只扣血
            if (Form == "can" && State == "attack" && Rank("can", "c_iron") != 0)
            {
                Hp = Math.Max(0, Hp - dmg); Invuln = 0.4; Flash = 0.08; w.Sfx("hurt"); w.OnPlayerHurt(dmg);
                return true;
            }
            Hp = Math.Max(0, Hp - dmg);
            Invuln = 0.9; Flash = 0.08;
            State = "hurt"; T = 0; Atk_ = null;
            HurtK = Form == "can" ? 1 - 0.05 * Rank("can", "p_can") : 1;
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

        /// 毒（毒菇怪的毒雲）：每一下扣一點血，不會被擊退、不會無敵（衝刺中躲得掉）；防禦照算
        public void PoisonTick(double dmg, IWorld w)
        {
            if (State == "dash" || Hp <= 0) return;
            double def = S.Def * (DentT > 0 ? 1.5 : 1);
            dmg = Math.Max(1, Pf.Round(dmg * (1 - def / (def + 60))));
            Hp = Math.Max(0, Hp - dmg); Flash = 0.05;
            w.Sfx("hitL");
            w.OnPlayerHurt(dmg);
        }

        string PoseNow()
        {
            switch (State)
            {
                case "attack": return AttackPose();
                case "dash": case "charge": case "spikeball": return "dash";
                case "fly": return "jump";
                case "cast": return "cast";
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
            if (HideT > 0) return;
            foreach (var g in ghosts) HeroArt.Paint(frame, g.X, g.Y, HeroArt.Pose(Form, g.Q), g.Flip, GHOST[Math.Min(GHOST.Length - 1, (int)Math.Floor((g.Age / 0.22) * GHOST.Length))]);
            if (Invuln > 0 && State != "dash" && State != "ult" && (long)Math.Floor(Clock * 20) % 2 == 0) return;
            if (State == "spikeball") { Blit.Draw(frame, Baked.Anim("spikeBall"), T, X, Y, Face < 0); return; }   // 尖刺星：縮成刺球
            HeroArt.Paint(frame, X, Y, HeroArt.Pose(Form, Pose), DrawFlip(), Flash > 0 ? WHITE : 0);
        }

        /// 大招期間：位置由大招控制，這裡只換姿勢
        public void UltPose(string q, double dt)
        {
            State = "ult"; Atk_ = null; Vx = Vy = 0; Clock += dt; Pose = q;
        }
        public void EndUlt() { State = "move"; Grounded = true; Invuln = Math.Max(Invuln, 0.5); }

        /// 重生（簡化：回到檢查點、補滿血）
        public void Respawn(double x, double y)
        {
            X = x; Y = y; Vx = Vy = 0; Hp = MaxHp; State = "move"; Atk_ = null; Invuln = 1; Grounded = false; ghosts.Clear();
        }
    }
}
