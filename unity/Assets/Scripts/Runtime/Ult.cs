// game/src/ult.js 翻成 C#：大招。星星的「流星墜落」在這裡，其他四個形態的大招在 UltForms.cs（UltMod）。
//   起（0～0.65 秒）：全場停住變暗，腳下金色法陣，光點被吸進主角手中聚成星核。
//   承（0.65～1.28）：跳上半空，星核長大；畫面下方橫過特寫帶。
//   轉（1.28～1.46）：星核射出畫面，一顆巨大的星星從天上斜斜砸下；落地瞬間黑白反轉兩拍、全場大亮、震動。
//   合（1.46～2.7）：衝擊波沿著地面往兩邊掃開，星屑落下，光退回去，主角落地收招。
using System;
using System.Collections.Generic;
using PixelFX;

namespace ZeroStar
{
    /// 大招畫圖用的小工具（世界座標，顏色是 [r, g, b]）
    public class UltPainter
    {
        readonly Frame f;
        public UltPainter(Frame frame) { f = frame; }
        int Idx(double x, double y) { int X = (int)Pf.Round(x) - f.Ox, Y = (int)Pf.Round(y) - f.Oy; return X < 0 || Y < 0 || X >= f.W || Y >= f.H ? -1 : Y * f.W + X; }
        public void Blend(double x, double y, int[] c, double a)
        {
            int i = Idx(x, y);
            if (i < 0 || a <= 0) return;
            int r = c[0], g = c[1], b = c[2];
            if (a >= 1) { f.Color[i] = (uint)(unchecked((int)0xff000000) | (b << 16) | (g << 8) | r); return; }
            uint d = f.Color[i]; double q = 1 - a;
            f.Color[i] = (uint)(unchecked((int)0xff000000) | (Pf.ToInt32(((d >> 16) & 255) * q + b * a) << 16) | (Pf.ToInt32(((d >> 8) & 255) * q + g * a) << 8) | Pf.ToInt32((d & 255) * q + r * a));
        }
        public void Glow(double x, double y, int[] c, double k)
        {
            int i = Idx(x, y);
            if (i < 0 || k <= 0) return;
            uint l = f.Light[i];
            f.Light[i] = (uint)(unchecked((int)0xff000000) | (Pf.ToInt32(Math.Min(255, ((l >> 16) & 255) + c[2] * k)) << 16) | (Pf.ToInt32(Math.Min(255, ((l >> 8) & 255) + c[1] * k)) << 8) | Pf.ToInt32(Math.Min(255, (l & 255) + c[0] * k)));
        }
        public static int[] Rgb(string s) { int v = Convert.ToInt32(s.Substring(1), 16); return new[] { v >> 16, (v >> 8) & 255, v & 255 }; }
    }

    /// 大招要用的世界操作（ult.js 的 KIT）
    public class UltKit
    {
        public Game G;
        public double FloorAt(double x, double y) => G.Map.FloorAt(x, y);
        public bool SolidAt(double x, double y) => G.Map.SolidAt(x, y);
        public FxRun Spawn(string fx, double x, double y, FxOptions o, double speed = 1, bool back = false) => G.SpawnLive(fx, x, y, o, speed, back);
        public void Flash(double x, double y, double r, double lv, double sec = 0.25, string col = "#ffd890") => SceneLight.AddFlash(x, y, r, lv, sec, col);
        public void HitStop(double s) => G.Fx.HitStop(s);
        public void Shake(double sec, double amp, bool keep = false, double dir = 0) => G.Fx.Shake(sec, amp, keep, dir);
        public void Sfx(string n) => G.Sfx(n);
        public double BoundL, BoundR;
        /// boss.js 的 drawJunk（垃圾：輪胎、罐子、木板）
        public void DrawJunk(Action<double, double, int[]> put, string type, double x, double y, double rot) => Junk.Draw(put, type, x, y, rot);
    }

    /// 大招給形態大招用的操作（main.js 的 ultHooks）
    public class UltHooks
    {
        public Game G;
        public List<Enemy> Enemies() => G.Enemies.FindAll(e => !e.Dead);
        public void Hit(Enemy e, double mult, double dir, HitOpts o) { if (e.Dead) return; e.Hit(G.Player.RollDmg(mult * (1 + G.Player.S.Ult / 100) * G.UltPassive()), dir, o, G); G.AddCombo(1); }
        /// 大招只打看得到的範圍
        public (double l, double r, double top) View() { var v = Game.ViewRect(); return (G.CamX + v.x0, G.CamX + v.x0 + v.w, G.CamY + v.y0); }
        public void Puddle(double x, double y) { G.Hazards.AddTemp("goo", Pf.Round(x), y, 44, 6); }   // 黏液灘
        public void Heal(double k) { G.Player.Hp = Math.Min(G.Player.MaxHp, G.Player.Hp + G.Player.MaxHp * k); }
        public void Dust(double x, double y) { G.Dust(x, y, 6); G.Sfx("ultHit"); }
        /// 衝擊波掃到的怪：每隻只打一次
        public void Wave(Ult U, double x0, double x1, double tx)
        {
            int n = 0;
            foreach (var e in G.Enemies)
            {
                if (e.Dead || U.HitSet.Contains(e) || e.X < x0 || e.X > x1 || Math.Abs(e.Y - (U.HasFy ? U.Fy : e.Y)) > 130) continue;
                U.HitSet.Add(e);
                e.Hit(G.Player.RollDmg(Ult.ULT_MULT * (1 + G.Player.S.Ult / 100) * G.UltPassive()), e.X < tx ? -1 : 1, new HitOpts { Launch = true, Push = 4 }, G);
                n++;
            }
            if (n > 0) G.AddCombo(n);
        }
    }

    /// 一個形態的大招（ult-forms.js 的 { name, dur, cut, start, update, tick, dim, lights, draw }）。每次放大招建一個新的。
    public abstract class UltMod
    {
        public abstract string Name { get; }
        public abstract double Dur { get; }
        public abstract double Cut0 { get; }
        public abstract double Cut1 { get; }
        public virtual int[] Tint => null;   // 暗場往這個顏色壓（蝠翼星：夜晚）
        public abstract void Start(Ult U, Player player, UltKit kit, UltHooks H);
        public abstract void Update(Ult U, double dt, Player player, UltKit kit, UltHooks H);
        public virtual void Tick(Ult U, double dt) { }
        public abstract double Dim(Ult U);
        public abstract void Lights(Ult U, List<LightSrc> list, UltHooks H);
        public abstract void Draw(UltPainter P, Ult U, UltKit kit, UltHooks H);
    }

    public class Ult
    {
        public const double ULT_MP = 60, ULT_MULT = 9;
        const double T_RISE = 0.65, T_TOP = 1.0, T_CUT0 = 0.7, T_CUT1 = 1.15, T_THROW = 1.15, T_DROP = 1.28, T_HIT = 1.46, T_LAND = 1.64, T_END = 2.7;

        public bool On; public double T; public int Post;
        public double X0, Y0, Face, Tx, Fy, Wave; public bool HasFy, Impacted, Landed;
        public string Form;
        public UltMod Mod;
        public string Name = "流星墜落"; public double NameAt;   // 招式名（特寫帶出現時顯示）
        public readonly HashSet<Enemy> HitSet = new HashSet<Enemy>();
        /// 整個畫面一起變亮（light.js 的 global.lv）
        public double GlobalLv;
        class Core { public double X, Y, R, Rot; }
        Core core;
        FxRun circle, burst; bool circleStopped, burstStopped;
        (double x, double y, double dx, double dy)? star;

        readonly Game G; readonly UltKit kit; readonly UltHooks H;
        public Ult(Game g) { G = g; kit = new UltKit { G = g }; H = new UltHooks { G = g }; }

        static double Clamp01(double v) => v < 0 ? 0 : v > 1 ? 1 : v;
        static double OutCubic(double p) => 1 - Pf.Pow(1 - p, 3);
        static double InQuad(double p) => p * p;
        static readonly int[][] GOLD = { UltPainter.Rgb("#f0a020"), UltPainter.Rgb("#ffd84a"), UltPainter.Rgb("#fff09a"), UltPainter.Rgb("#ffffff") };
        static readonly int[] LIGHT_GOLD = UltPainter.Rgb("#ffcf6a");
        static double Rnd2(double i, double k) { double s = Pf.Sin(i * 127.1 + k * 311.7) * 43758.5453; return s - Math.Floor(s); }
        struct Mote { public double A, R0, D, Dur, Spin; public bool Big; }
        static readonly Mote[] MOTES = MakeMotes();
        static Mote[] MakeMotes()
        {
            var m = new Mote[56];
            for (int i = 0; i < 56; i++) m[i] = new Mote { A = Rnd2(i, 1) * Math.PI * 2, R0 = 46 + Rnd2(i, 2) * 70, D = Rnd2(i, 3) * 0.5, Dur = 0.22 + Rnd2(i, 4) * 0.2, Spin = 1.2 + Rnd2(i, 5) * 1.6, Big = Rnd2(i, 6) < 0.3 };
            return m;
        }
        struct Line { public double Y, X, Len, Sp; public bool Hot; }
        static readonly Line[] LINES = MakeLines();
        static Line[] MakeLines()
        {
            var l = new Line[34];
            for (int i = 0; i < 34; i++) l[i] = new Line { Y = Rnd2(i, 7), X = Rnd2(i, 8), Len = 18 + Rnd2(i, 9) * 60, Sp = 0.7 + Rnd2(i, 10) * 0.8, Hot = Rnd2(i, 11) < 0.25 };
            return l;
        }

        public void Start(Player player)
        {
            On = true; T = 0; Post = 0; X0 = player.X; Y0 = player.Y; Face = player.Face; Impacted = false; Landed = false; HasFy = false;
            HitSet.Clear();
            double l = G.Data.W > 0 ? 16 + 24 : 0, r = G.Data.W - 16 - 24;   // 沒有戰鬥區封鎖：地圖的牆內
            kit.BoundL = l; kit.BoundR = r;
            Form = player.Form;
            Mod = UltForms.For(player.Form);
            Name = Mod?.Name ?? "流星墜落"; NameAt = Mod?.Cut0 ?? T_CUT0;
            if (Mod != null) { Mod.Start(this, player, kit, H); return; }
            Tx = Math.Max(l, Math.Min(r, player.X + player.Face * 72));
            Fy = G.Map.FloorAt(Tx, player.Y - 8); HasFy = true;
            circle = G.SpawnLive("rune-circle", Pf.Round(player.X), Pf.Round(player.Y), new FxOptions { Palette = Col.PAL["gold"], Light = 0.6, Seed = 4 }, 1.4, back: true);
            circleStopped = false; burst = null; burstStopped = false;
            core = new Core { X = player.X, Y = player.Y - 22, R = 0, Rot = 0 };
            star = null;
        }

        public void Update(double dt, Player player)
        {
            if (!On) return;
            if (Mod != null)
            {
                T += dt;
                player.Invuln = Math.Max(player.Invuln, 0.6);
                Mod.Update(this, dt, player, kit, H);
                Mod.Tick(this, dt);
                if (T >= Mod.Dur) { On = false; Mod = null; GlobalLv = 0; player.EndUlt(); }
                return;
            }
            double t = (T += dt), side = Face; var c = core;
            player.Invuln = Math.Max(player.Invuln, 0.6);
            string q = "charge"; double y = Y0;
            if (t >= T_RISE && t < T_HIT)
            {
                y = Y0 - 46 * OutCubic(Clamp01((t - T_RISE) / (T_TOP - T_RISE))) + (t > T_TOP ? Pf.Round(Pf.Sin((t - T_TOP) * 12)) : 0);
                q = t < T_THROW ? "rise" : "throw";
            }
            else if (t >= T_HIT && t < T_LAND)
            {
                y = Y0 - 46 * (1 - InQuad(Clamp01((t - T_HIT) / (T_LAND - T_HIT))));
                q = "throw";
            }
            else if (t >= T_LAND)
            {
                q = "finish";
                if (!Landed) { Landed = true; H.Dust(player.X, Y0); G.Fx.Shake(0.15, 2); }
            }
            player.Y = y;
            player.Face = side;
            player.UltPose(q, dt);

            if (t < T_THROW)
            {
                double tx = t < T_RISE ? player.X + side * 2 : player.X, ty = t < T_RISE ? y - 12 : y - 36;
                c.X += (tx - c.X) * Math.Min(1, dt * 18);
                c.Y += (ty - c.Y) * Math.Min(1, dt * 18);
                c.R = 2 + 9 * OutCubic(Clamp01((t - 0.15) / (T_THROW - 0.15)));
                if (burst == null && t >= T_RISE) burst = G.SpawnLive("sunburst", Pf.Round(c.X), Pf.Round(c.Y), new FxOptions { Light = 0.5, Seed = 7 }.Set("rays", 10));
            }
            else if (t < T_DROP)
            {
                c.Y -= 900 * dt * (0.4 + Clamp01((t - T_THROW) / (T_DROP - T_THROW)));
                c.R = 7;
            }
            else c.R = 0;
            c.Rot += dt * (t < T_THROW ? 2 + t * 4 : 10);
            if (burst != null)
            {
                burst.Options.X = Pf.Round(c.X); burst.Options.Y = Pf.Round(c.Y);
                if (t >= T_THROW && !burstStopped) { burst.Stop(); burstStopped = true; }
            }
            if (t >= T_RISE && circle != null && !circleStopped) { circle.Stop(); circleStopped = true; }

            if (t >= T_DROP && t < T_HIT)
            {
                double p = Pf.Pow(Clamp01((t - T_DROP) / (T_HIT - T_DROP)), 1.6);
                double sx = Tx - side * 120, sy = Fy - 208;
                star = (sx + (Tx - sx) * p, sy + (Fy - 8 - sy) * p, Tx - sx, Fy - 8 - sy);
            }
            else star = null;

            if (t >= T_HIT && !Impacted)
            {
                Impacted = true;
                double tx = Pf.Round(Tx);
                G.SpawnLive("ground-slam", tx, Fy, new FxOptions { Light = 0.7, Seed = 9 }.Set("reach", 150), 1, back: true);
                G.SpawnLive("star-fall", tx, Fy, new FxOptions { Palette = Col.PAL["holy"], Light = 0.6, Seed = 21 }, 1.2);
                G.SpawnLive("star-fall", tx + side * 90, Fy, new FxOptions { Palette = Col.PAL["gold"], Light = 0.5, Seed = 5 }, 1.3);
                SceneLight.AddFlash(tx, Fy - 24, 260, 4, 1.1, "#ffe08a");
                G.Fx.HitStop(0.16);
                G.Fx.Shake(0.7, 6);
                Post = 1;
                G.Vibrate?.Invoke();
            }
            if (t >= T_HIT)
            {
                Wave = (t - T_HIT) * 330;
                if (t < T_HIT + 0.95) H.Wave(this, Tx - Wave - 8, Tx + Wave + 8, Tx);
            }
            GlobalLv = t >= T_HIT ? 0.6 * Pf.Pow(1 - Clamp01((t - T_HIT) / 0.6), 2) : 0;

            if (t >= T_END)
            {
                On = false;
                GlobalLv = 0;
                player.Y = Y0;
                player.EndUlt();
            }
        }

        double DimK()
        {
            double t = T;
            if (!On) return 0;
            if (Mod != null) return Math.Max(0, Mod.Dim(this));
            if (t < 0.25) return t / 0.25;
            if (t < T_HIT) return 1;
            return 1 - Clamp01((t - T_HIT) / 0.6);
        }

        public void Lights(List<LightSrc> list)
        {
            if (!On) return;
            if (Mod != null) { Mod.Lights(this, list, H); return; }
            var c = core;
            if (c.R > 0) list.Add(new LightSrc(c.X, c.Y, 30 + c.R * 6, 1.2 + c.R * 0.18, "#ffd27a"));
            if (star != null) list.Add(new LightSrc(star.Value.x, star.Value.y, 110, 3.5, "#fff0b0"));
        }

        /// 暗場：畫完場景和怪之後、畫主角之前呼叫
        public void DimScene(Frame frame)
        {
            double d = DimK();
            if (d <= 0) return;
            double kc = Math.Max(0.2, 1 - 0.62 * d), kl = Math.Max(0, 1 - 0.75 * d);
            uint[] C = frame.Color, L = frame.Light; int n = frame.W * frame.H;
            var tint = Mod?.Tint; double tk = (1 - kc) * 0.9;
            // 每個像素各算各的：切成 8 條同時算。數值都是 0～255 的正數，直接截成整數（跟 JS 的 << 一樣）
            const int BANDS = 8; int per = (n + BANDS - 1) / BANDS;
            PixelFX.Par.For(BANDS, band =>
            {
                int i0 = band * per, i1 = Math.Min(n, i0 + per);
                if (tint != null)
                {
                    double t0 = tint[0] * tk, t1 = tint[1] * tk, t2 = tint[2] * tk;
                    for (int i = i0; i < i1; i++)
                    {
                        uint c = C[i];
                        C[i] = (c & 0xff000000) | ((uint)(int)(((c >> 16) & 255) * kc + t2) << 16) | ((uint)(int)(((c >> 8) & 255) * kc + t1) << 8) | (uint)(int)((c & 255) * kc + t0);
                        uint l = L[i];
                        if ((l & 0xffffff) != 0) L[i] = (l & 0xff000000) | ((uint)(int)(((l >> 16) & 255) * kl) << 16) | ((uint)(int)(((l >> 8) & 255) * kl) << 8) | (uint)(int)((l & 255) * kl);
                    }
                }
                else
                {
                    for (int i = i0; i < i1; i++)
                    {
                        uint c = C[i];
                        C[i] = (c & 0xff000000) | ((uint)(int)(((c >> 16) & 255) * kc) << 16) | ((uint)(int)(((c >> 8) & 255) * kc) << 8) | (uint)(int)((c & 255) * kc);
                        uint l = L[i];
                        if ((l & 0xffffff) != 0) L[i] = (l & 0xff000000) | ((uint)(int)(((l >> 16) & 255) * kl) << 16) | ((uint)(int)(((l >> 8) & 255) * kl) << 8) | (uint)(int)((l & 255) * kl);
                    }
                }
            });
        }

        static void DrawStar(UltPainter P, double cx, double cy, double R, double rot, double glow = 1)
        {
            if (R <= 0) return;
            double ca = Pf.Cos(rot), sa = Pf.Sin(rot); int ext = (int)Math.Ceiling(R * 2.4); double sR = Math.Sqrt(R), sR2 = Math.Sqrt(R * 0.55);
            const double SQ = 0.7071067811865476;   // Math.SQRT1_2
            for (int y = -ext; y <= ext; y++) for (int x = -ext; x <= ext; x++)
            {
                double u = Math.Abs(x * ca + y * sa), v = Math.Abs(-x * sa + y * ca);
                double u2 = Math.Abs((u - v) * SQ), v2 = Math.Abs((u + v) * SQ);
                double d = Pf.Hypot(x, y);
                double val = Math.Max(Math.Max(1 - (Math.Sqrt(u) + Math.Sqrt(v)) / sR, 0.8 * (1 - (Math.Sqrt(u2) + Math.Sqrt(v2)) / sR2)), 1 - d / (R * 0.32));
                if (val > 0)
                {
                    var col = val > 0.55 ? GOLD[3] : val > 0.32 ? GOLD[2] : val > 0.14 ? GOLD[1] : GOLD[0];
                    P.Blend(cx + x, cy + y, col, Math.Min(1, val * 5));
                }
                double h = 1 - d / ext;
                if (h > 0) P.Glow(cx + x, cy + y, LIGHT_GOLD, h * h * 0.55 * glow);
            }
        }

        /// 主角之後畫：集光粒子、星核、墜落的星星和尾巴、地面衝擊波
        public void Draw(Frame frame)
        {
            if (!On) return;
            var P = new UltPainter(frame);
            if (Mod != null) { Mod.Draw(P, this, kit, H); return; }
            double t = T; var c = core;
            if (t < T_THROW) foreach (var m in MOTES)
            {
                double p = (t - m.D) / m.Dur;
                if (p < 0 || p >= 1) continue;
                double r = m.R0 * (1 - InQuad(p)), a = m.A + m.Spin * p, dx = Pf.Cos(a), dy = Pf.Sin(a);
                double len = 3 + Pf.Round(7 * p); var col = m.Big ? GOLD[3] : GOLD[2];
                for (int k = 0; k < len; k++)
                {
                    double x = c.X + dx * (r + k), y = c.Y + dy * (r + k), fade = 1 - k / len;
                    P.Blend(x, y, k == 0 ? GOLD[3] : col, fade * (0.5 + 0.5 * p));
                    P.Glow(x, y, LIGHT_GOLD, fade * 0.35);
                }
            }
            if (t >= T_THROW && t < T_DROP) for (int k = 0; k < 30; k++)
            {
                double a = 1 - k / 30.0;
                P.Blend(c.X, c.Y + k * 2, k < 4 ? GOLD[3] : GOLD[2], a);
                P.Glow(c.X, c.Y + k * 2, LIGHT_GOLD, a * 0.8);
            }
            DrawStar(P, c.X, c.Y, c.R, c.Rot, 1);
            if (star != null)
            {
                var s = star.Value; double len = Pf.Hypot(s.dx, s.dy), ux = s.dx / len, uy = s.dy / len;
                for (int k = 0; k < 90; k++)
                {
                    double a = 1 - k / 90.0; int w = (int)Math.Max(0, Pf.Round(11 * a)); double bx = s.x - ux * k * 1.6, by = s.y - uy * k * 1.6;
                    for (int j = -w; j <= w; j++)
                    {
                        double e = 1 - Math.Abs(j) / (double)(w + 1);
                        P.Blend(bx - uy * j, by + ux * j, e > 0.6 ? GOLD[3] : e > 0.3 ? GOLD[2] : GOLD[1], a * e * 1.4);
                        P.Glow(bx - uy * j, by + ux * j, LIGHT_GOLD, a * e * 0.7);
                    }
                }
                DrawStar(P, s.x, s.y, 22, c.Rot * 1.5, 2);
            }
            if (t >= T_HIT && t < T_HIT + 1.1)
            {
                double w = Wave, fade = 1 - Clamp01((t - T_HIT) / 1.1);
                foreach (int dir in new[] { -1, 1 })
                {
                    double fx = Tx + dir * w; double hgt = Pf.Round(46 * fade + 6);
                    for (int k = 0; k < 10; k++)
                    {
                        double x = fx - dir * k, a = (1 - k / 10.0) * fade;
                        for (int yy = 0; yy < hgt; yy++)
                        {
                            double up = 1 - yy / hgt;
                            P.Blend(x, Fy - 1 - yy, k < 2 ? GOLD[3] : GOLD[2], a * up * (k < 2 ? 1 : 0.5));
                            P.Glow(x, Fy - 1 - yy, LIGHT_GOLD, a * up * 0.6);
                        }
                    }
                }
                for (double x = -w; x <= w; x += 1)
                {
                    double e = Math.Abs(x) / (w != 0 ? w : 1), y = Pf.Round(Math.Sqrt(Math.Max(0, 1 - e * e)) * Math.Min(10, w * 0.08));
                    P.Glow(Tx + x, Fy + 2 + y, LIGHT_GOLD, 0.5 * fade * e);
                    P.Glow(Tx + x, Fy - 1 - y * 0.4, LIGHT_GOLD, 0.35 * fade * e);
                }
            }
        }

        // ---- 特寫帶（承的時候橫過畫面下方）
        readonly Frame portrait = new Frame(48, 52);
        static readonly int[] NAVY = UltPainter.Rgb("#140c26"), EDGE_HI = UltPainter.Rgb("#fff09a"), EDGE_LO = UltPainter.Rgb("#c48412"), SLASH = UltPainter.Rgb("#2a1a4a");
        public void DrawCutIn(Frame frame)
        {
            if (!On) return;
            double t = T, cut0 = Mod?.Cut0 ?? T_CUT0, cut1 = Mod?.Cut1 ?? T_CUT1;
            if (t < cut0 || t > cut1) return;
            int W = frame.W; uint[] C = frame.Color, L = frame.Light;
            double open = Math.Min(Clamp01((t - cut0) / 0.07), Clamp01((cut1 - t) / 0.07)); int half = (int)Pf.Round(24 * OutCubic(open));
            if (half <= 0) return;
            var vw = Game.ViewRect(); int cy = (int)Pf.Round(vw.y0 + vw.h - 30); double local = t - cut0;
            void Put(int x, int y, int[] c, double a = 1)
            {
                if (x < 0 || y < 0 || x >= W || y >= frame.H) return;
                int i = y * W + x; uint d = C[i]; double q = 1 - a;
                C[i] = (uint)(unchecked((int)0xff000000) | (Pf.ToInt32(((d >> 16) & 255) * q + c[2] * a) << 16) | (Pf.ToInt32(((d >> 8) & 255) * q + c[1] * a) << 8) | Pf.ToInt32((d & 255) * q + c[0] * a));
                L[i] = 0;
            }
            for (int y = cy - half; y < cy + half; y++) for (int x = 0; x < W; x++)
            {
                double s = x - (y - cy) * 0.6 - W * 0.55 + local * 60;
                Put(x, y, s > 0 && s < 46 ? SLASH : NAVY);
            }
            foreach (var l in LINES)
            {
                int y = (int)Pf.Round(cy - half + 3 + l.Y * (half * 2 - 6));
                int x0 = (int)Pf.Round((((l.X * (W + 120) - local * 900 * l.Sp) % (W + 120)) + (W + 120)) % (W + 120)) - 60;
                for (int k = 0; k < l.Len; k++) Put(x0 + k, y, l.Hot ? GOLD[2] : GOLD[1], (1 - k / l.Len) * (l.Hot ? 0.9 : 0.45));
            }
            portrait.Clear();
            HeroArt.Paint(portrait, 24, 50, HeroArt.Pose(Form, "portrait"), Face < 0, 0, 0);
            int top = 52;
            for (int i = 0; i < portrait.Color.Length; i++) if ((portrait.Color[i] >> 24) != 0) { top = i / 48; break; }
            int S = 4, rows = (int)Math.Ceiling((half * 2) / (double)S) + 1;
            int px0 = (int)Pf.Round((vw.x0 + vw.w - 206) + 40 * (1 - OutCubic(Clamp01(local / 0.12))) - local * 14);
            for (int r = 0; r < rows; r++) for (int x = 0; x < 48; x++)
            {
                int pi = (top + 3 + r) * 48 + x;
                if (pi >= portrait.Color.Length) continue;
                uint c = portrait.Color[pi];
                if ((c >> 24) == 0) continue;
                var col = new[] { (int)(c & 255), (int)((c >> 8) & 255), (int)((c >> 16) & 255) };
                for (int a = 0; a < S; a++) for (int b = 0; b < S; b++)
                {
                    int yy = cy - half + r * S + a;
                    if (yy < cy + half) Put(px0 + x * S + b, yy, col);
                }
            }
            for (int x = 0; x < W; x++) { Put(x, cy - half - 1, EDGE_HI); Put(x, cy - half - 2, EDGE_LO); Put(x, cy + half, EDGE_HI); Put(x, cy + half + 1, EDGE_LO); }
        }

        /// 合成之後：落地瞬間黑白反轉兩拍（每拍 2 幀）
        public void PostProcess(byte[] data)
        {
            if (Post == 0) return;
            int step = Post++;
            if (step > 4) { Post = 0; return; }
            bool invert = step > 2;
            for (int j = 0; j < data.Length; j += 4)
            {
                double lum = data[j] * 0.3 + data[j + 1] * 0.59 + data[j + 2] * 0.11;
                byte v = (lum > 120) != invert ? (byte)255 : (byte)0;
                data[j] = data[j + 1] = data[j + 2] = v;
            }
        }
    }
}
