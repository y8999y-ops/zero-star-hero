// pixelfx core 的 fx.js（createFx、resolveOptions）翻成 C#：一個「正在播的特效」。
// 用法：
//   var fx = FxRun.Create(Fireball.Def, new FxOptions { Palette = pal, Light = 0.65, Seed = 37, X = 112, Y = 28 });
//   每格：fx.Update(dt); frame.Clear(); fx.Draw(frame);          // 或 Draw(frame, "back") / Draw(frame, "front")
//   要它結束：fx.Stop()（迴圈特效淡出 0.3 秒，一次性的直接收掉）；fx.Done() 為真就可以丟掉。
// 純函式特效（只看時間 t 畫）跟模擬特效（create 之後一直 update）都用同一套。
using System;
using System.Collections.Generic;

namespace PixelFX
{
    /// 特效選項：常用的有自己的欄位，其他數值放 Num（radius、speed、height、aim、spread…）。沒給的用特效自己的預設。
    public class FxOptions
    {
        public string[] Palette, Accent;
        public double? Light, Angle, X, Y;
        public int? Seed;
        public bool? Flip;
        public Dictionary<string, double> Num = new Dictionary<string, double>();
        /// 特效自己的文字選項（例如石頭顏色 "stone"）。
        public Dictionary<string, string> Str = new Dictionary<string, string>();
        /// 特效要照亮／包住的角色（meta.actor）；沒給而特效需要時用替身角色 Actor.Stock。
        public Actor Actor;
        /// 其他色階選項（例如寶箱的 "wood"、poof 的 "stars"）；長度跟預設不同時會重新取樣成預設的長度。
        public Dictionary<string, string[]> Ramps = new Dictionary<string, string[]>();

        public FxOptions Set(string key, double v) { Num[key] = v; return this; }
        public FxOptions Set(string key, string v) { Str[key] = v; return this; }
        public FxOptions Set(string key, string[] ramp) { Ramps[key] = ramp; return this; }
        /// 特效自己的數值選項（預設已合併進來）。
        public double this[string key] => Num[key];
        public int SeedOr0 => Seed ?? 0;

        /// resolveOptions：預設墊底、給的蓋上去；色階長度跟預設不一樣時重新取樣成預設的長度。
        public static FxOptions Resolve(FxOptions def, FxOptions o)
        {
            def = def ?? new FxOptions(); o = o ?? new FxOptions();
            var r = new FxOptions
            {
                Palette = FitTo(o.Palette, def.Palette), Accent = FitTo(o.Accent, def.Accent),
                Light = o.Light ?? def.Light, Angle = o.Angle ?? def.Angle, X = o.X ?? def.X, Y = o.Y ?? def.Y,
                Seed = o.Seed ?? def.Seed, Flip = o.Flip ?? def.Flip, Actor = o.Actor ?? def.Actor,
            };
            foreach (var kv in def.Num) r.Num[kv.Key] = kv.Value;
            foreach (var kv in o.Num) r.Num[kv.Key] = kv.Value;
            foreach (var kv in def.Str) r.Str[kv.Key] = kv.Value;
            foreach (var kv in o.Str) r.Str[kv.Key] = kv.Value;
            foreach (var kv in def.Ramps) r.Ramps[kv.Key] = kv.Value;
            foreach (var kv in o.Ramps) r.Ramps[kv.Key] = def.Ramps.TryGetValue(kv.Key, out var d0) ? FitTo(kv.Value, d0) : kv.Value;
            return r;
        }
        static string[] FitTo(string[] given, string[] def)
        {
            if (given == null) return def;
            if (def == null || given.Length == def.Length) return given;
            var f = Col.Fit(given, def.Length); var s = new string[f.Length];
            for (int i = 0; i < f.Length; i++) s[i] = Col.ToHex(f[i]);
            return s;
        }
    }

    /// 特效實作：模擬特效有 Update；DrawBack 畫在角色後面（可以沒有），Draw 畫在前面。
    /// t＝特效時間（秒，迴圈的已經取餘數），模擬特效通常用自己記的時間。
    public class FxImpl
    {
        public Action<double, FxOptions> Update;
        public Action<Painter, double, FxOptions> DrawBack, Draw;
    }

    /// 一個特效模組（對應網頁版的 meta＋draw/drawBack 或 meta＋create）。
    public class FxDef
    {
        public string Name;
        public int W, H, OX, OY;
        public double Duration = 1;
        public int Fps = 30;
        public bool Loop;
        public FxOptions Options = new FxOptions();
        /// meta.actor：特效需要一個角色（1 或 2＝替身角色的大小），0＝不需要。
        public int ActorK;
        /// 純函式特效：直接給 Pure（不需要 Update）。
        public FxImpl Pure;
        /// 模擬特效：每次播放 Create 一份新的狀態。
        public Func<FxOptions, FxImpl> Create;
    }

    public class FxRun
    {
        const double FADE = 0.3;
        public readonly FxDef Def;
        public readonly FxOptions Options;
        readonly FxImpl impl;
        double t, stopAt = double.PositiveInfinity;
        Frame lastFrame; Painter painter;

        public double T => t;
        public static FxRun Create(FxDef def, FxOptions o = null) => new FxRun(def, o);
        public FxRun(FxDef def, FxOptions o = null)
        {
            Def = def;
            Options = FxOptions.Resolve(def.Options, o);
            if (def.ActorK > 0 && Options.Actor == null) Options.Actor = Actor.Stock(def.ActorK == 2 ? 2 : 1);
            impl = def.Create != null ? def.Create(Options) : def.Pure;
        }

        public void Update(double dt)
        {
            t += dt;
            if (impl.Update == null) return;
            // 模擬一律用 120 Hz 以上的小步，不管呼叫端幾 fps，看起來都一樣
            int n = (int)Math.Max(1, Math.Ceiling(dt * 120 - 1e-9));
            for (int i = 0; i < n; i++) impl.Update(dt / n, Options);
        }

        /// layer：null＝前後都畫，"back"＝只畫角色後面那層，"front"＝只畫前面那層。
        public void Draw(Frame frame, string layer = null)
        {
            if (frame != lastFrame) { lastFrame = frame; painter = new Painter(frame); }
            var p = painter.Reset();
            var o = Options;
            p.Place(o.X ?? 0, o.Y ?? 0, o.Flip ?? false, o.Angle ?? 0);
            p.Fade = double.IsPositiveInfinity(stopAt) ? 1 : Pf.Clamp(1 - (t - stopAt) / FADE);
            p.LightK = o.Light ?? 1;
            double D = Def.Duration, tt = Def.Loop ? t % D : Math.Min(t, D);
            if (layer != "front" && impl.DrawBack != null) { p.Layer = "back"; impl.DrawBack(p, tt, o); }
            if (layer != "back") { p.Layer = "front"; impl.Draw(p, tt, o); }
        }

        /// 讓它結束：迴圈的淡出，一次性的提早收。
        public void Stop() { if (double.IsPositiveInfinity(stopAt)) stopAt = t; }
        public bool Done() => t - stopAt >= FADE || (!Def.Loop && t >= Def.Duration);
    }
}
