// game/src/fx.js 翻成 C#：特效清單（畫在角色前面或後面）、命中停頓（hit-stop）、畫面震動。
using System;
using System.Collections.Generic;
using PixelFX;

namespace ZeroStar
{
    public class FxSystem
    {
        const int MAX = 70;
        // 一個特效：烘焙動畫（Playing）或即時特效（FxRun，pixelfx 翻成 C# 的）
        class E { public Playing Baked; public FxRun Live; public bool Back, Keep; public double Speed; public double X => Baked != null ? Baked.X : Live.Options.X ?? 0; }
        readonly List<E> list = new List<E>();
        static readonly Dictionary<string, FxDef> DEFS = new Dictionary<string, FxDef>
        {
            ["fireball"] = PixelFX.Fx.Fireball.Def, ["plasma-explosion"] = PixelFX.Fx.PlasmaExplosion.Def, ["hit-spark"] = PixelFX.Fx.HitSpark.Def,
            ["zap-hit"] = PixelFX.Fx.ZapHit.Def, ["poison-cloud"] = PixelFX.Fx.PoisonCloud.Def, ["acid-splash"] = PixelFX.Fx.AcidSplash.Def,
            ["collect-burst"] = PixelFX.Fx.CollectBurst.Def, ["rune-circle"] = PixelFX.Fx.RuneCircle.Def, ["sunburst"] = PixelFX.Fx.Sunburst.Def,
            ["ground-slam"] = PixelFX.Fx.GroundSlam.Def, ["star-fall"] = PixelFX.Fx.StarFall.Def,
        };

        void Add(E e)
        {
            list.Add(e);
            if (list.Count > MAX)
            {
                int i = list.FindIndex(q => !q.Keep);
                if (i >= 0) list.RemoveAt(i);
            }
        }
        public Playing Spawn(Anim a, double x, double y, bool flip = false, bool back = false, bool keep = false, double speed = 1)
        {
            var fx = new Playing(a, x, y, flip);
            Add(new E { Baked = fx, Back = back, Keep = keep, Speed = speed });
            return fx;
        }
        /// 即時特效（網頁版 spawn(模組, 選項)）：x, y 是原點的世界座標
        public FxRun SpawnLive(string name, double x, double y, FxOptions o, double speed = 1, bool back = false, bool keep = false)
        {
            o.X = x; o.Y = y;
            var fx = new FxRun(DEFS[name], o);
            Add(new E { Live = fx, Back = back, Keep = keep, Speed = speed });
            return fx;
        }
        public void Update(double dt)
        {
            foreach (var e in list) { if (e.Baked != null) e.Baked.Update(dt * e.Speed); else e.Live.Update(dt * e.Speed); }
            for (int i = list.Count - 1; i >= 0; i--) if (list[i].Baked != null ? list[i].Baked.Done() : list[i].Live.Done()) list.RemoveAt(i);
        }
        public void Draw(Frame frame, bool back)
        {
            double mid = frame.Ox + frame.W / 2.0;
            foreach (var e in list)
                if (e.Back == back && Math.Abs(e.X - mid) < frame.W / 2.0 + 220) { if (e.Baked != null) e.Baked.Draw(frame); else e.Live.Draw(frame); Probe?.Invoke(e.Baked != null ? e.Baked.Anim.Name + " t=" + e.Baked.T.ToString("R") : e.Live.Def.Name + " t=" + e.Live.T.ToString("R")); }
        }
        public int Count => list.Count;
        public static Action<string> Probe;   // 開發用：每畫完一個特效呼叫一次

        // ---- 命中停頓與震動
        public double Freeze, ShakeT, Shake0, Amp, Dir;
        public void HitStop(double sec) { Freeze = Math.Max(Freeze, sec); }
        /// dir：±1＝往打的方向頓一下再彈回來；0＝隨機晃。keep：大震動不減半
        public void Shake(double sec, double amp, bool keep = false, double dir = 0)
        {
            if (amp < 4 && !keep) amp *= 0.5;
            if (amp >= Amp * (ShakeT / (Shake0 != 0 ? Shake0 : 1)))
            {
                ShakeT = Shake0 = sec;
                Amp = amp;
                Dir = dir;
            }
        }
        public (int, int) ShakeOffset()
        {
            if (ShakeT <= 0) return (0, 0);
            if (Dir != 0)
            {
                double p = 1 - ShakeT / Shake0, v = Pf.Cos(p * Math.PI * 2.2) * (1 - p) * (1 - p);
                return ((int)Pf.Round(Dir * Amp * v), (int)Pf.Round(Math.Abs(v) * Amp * 0.3));
            }
            double k = Amp * (ShakeT / Shake0), f = Math.Floor(ShakeT * 60);
            return ((int)Pf.Round(Pf.Sin(f * 2.4) * k), (int)Pf.Round(Pf.Cos(f * 3.7) * k * 0.7));
        }
    }
}
