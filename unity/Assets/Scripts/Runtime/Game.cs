// 遊戲本體（main.js 的 tick、render、world、鏡頭）：階段 1 的子集——1-1 的地形、主角、史萊姆、火把、戰鬥特效。
// 不碰 Unity 的東西（畫面、按鍵），所以比對測試可以在編輯器裡直接跑同一份程式。
using System;
using System.Collections.Generic;
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
        public int Kills, Coins;
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
            Data = Baked.Level(stage);
            Art = new LevelArt(Data);
            Map = new GameMap(Data.W, Data.H, Data.Solids, Data.Platforms);
            var combo = JsonUtility.FromJson<ComboDef>(Baked.Text("combo-star")).steps;
            Player = new Player(START.x, START.y, combo);
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
            foreach (var e in Enemies) if (!e.Dead && box.Overlaps(e.HitBox())) { var r = dmg(); e.Hit(r, dir, o, this); n++; }
            return n;
        }
        public void Land(double x, double y, bool hard) { Sfx("land"); Combat.Dust("land", x, y, hard); }
        public void Dust(double x, double y, int n) { Fx.Spawn(Baked.Anim("dust"), Pf.Round(x), Pf.Round(y), Rnd.Next() < 0.5, speed: 1.8); }
        public void DropCoins(double x, double y, int n) { Coins += n; }
        public void OnKill(Enemy e) { Kills++; }
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
            Input.Tick(dt);
            if (Fx.ShakeT > 0) Fx.ShakeT -= dt;
            if (Fx.Freeze > 0) { Fx.Freeze -= dt; return; }
            Combat.Update(dt);
            SceneLight.Update(dt);
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
            Fx.Update(dt);
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
            Prof.Mark(null);
            var lv = SceneLight.Compute(frame, lights);
            Prof.Mark("光源");
            Art.Draw(frame, lv);
            Prof.Mark("場景");
            Art.DrawAtmosphere(frame, sceneClock);
            Prof.Mark("大氣");
            Fx.Draw(frame, true);
            foreach (var e in Enemies) e.Draw(frame, Fx, SimMs);
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
