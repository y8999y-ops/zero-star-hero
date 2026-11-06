// game/src/fx.js 翻成 C#：特效清單（畫在角色前面或後面）、命中停頓（hit-stop）、畫面震動。
using System;
using System.Collections.Generic;
using PixelFX;

namespace ZeroStar
{
    public class FxSystem
    {
        const int MAX = 70;
        class E { public Playing Fx; public bool Back, Keep; public double Speed; }
        readonly List<E> list = new List<E>();

        public Playing Spawn(Anim a, double x, double y, bool flip = false, bool back = false, bool keep = false, double speed = 1)
        {
            var fx = new Playing(a, x, y, flip);
            list.Add(new E { Fx = fx, Back = back, Keep = keep, Speed = speed });
            if (list.Count > MAX)
            {
                int i = list.FindIndex(q => !q.Keep);
                if (i >= 0) list.RemoveAt(i);
            }
            return fx;
        }
        public void Update(double dt)
        {
            foreach (var e in list) e.Fx.Update(dt * e.Speed);
            for (int i = list.Count - 1; i >= 0; i--) if (list[i].Fx.Done()) list.RemoveAt(i);
        }
        public void Draw(Frame frame, bool back)
        {
            double mid = frame.Ox + frame.W / 2.0;
            foreach (var e in list)
                if (e.Back == back && Math.Abs(e.Fx.X - mid) < frame.W / 2.0 + 220) e.Fx.Draw(frame);
        }
        public int Count => list.Count;

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
                double p = 1 - ShakeT / Shake0, v = Math.Cos(p * Math.PI * 2.2) * (1 - p) * (1 - p);
                return ((int)Pf.Round(Dir * Amp * v), (int)Pf.Round(Math.Abs(v) * Amp * 0.3));
            }
            double k = Amp * (ShakeT / Shake0), f = Math.Floor(ShakeT * 60);
            return ((int)Pf.Round(Math.Sin(f * 2.4) * k), (int)Pf.Round(Math.Cos(f * 3.7) * k * 0.7));
        }
    }
}
