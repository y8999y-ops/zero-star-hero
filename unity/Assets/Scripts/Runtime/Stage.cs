// game/src/stage.js 翻成 C#：關卡資料（網頁版匯出的 stages.json）＋關卡流程（照 x 位置觸發提示、對話；王房封住、一波一波出；走到出口過關）
// 另外是 main.js 的系統台詞排隊（一句一句講；1-1 要等上一句看完才觸發下一段，所以計時要跟網頁版一樣）。
using System;
using System.Collections.Generic;
using System.Linq;

namespace ZeroStar
{
    public class StageData
    {
        public class Spawn { public string K, Core; public double X; public double? Y; public bool Air, Deep; }
        public class Tip { public string Touch, Key, Focus; }
        public class Wave { public string Kind; public int Side; }
        public class Event { public double X; public double? Y; public bool OnCore, Quiet, WaitCore, Ult; public string Say, Teach; public Tip Tip, Hint; public List<List<Wave>> Waves; public double[] Lock; }
        public class Cache { public double X, Y; public int N; }
        public class Altar { public double X; public double? Y; }
        public class Feature { public string T, Form; public double X, Y, W, H; public int I; public OrderedDict Raw; }
        public class Arena { public double L, R, Floor; public RectD? Top, Hole; }   // Top＝王放大招站的高台（y＝台面）、Hole＝屋頂的破洞
        public string Id, Name; public bool Paced;
        public double StartX, StartY, ExitX, ExitY;
        public List<string> Intro = new List<string>();
        public List<Spawn> Spawns; public List<Event> Events = new List<Event>(); public List<Cache> Caches = new List<Cache>();
        public List<Altar> Altars; public List<Feature> Features = new List<Feature>(); public List<(string kind, double x, double y)> Hazards = new List<(string, double, double)>();
        public Arena ArenaInfo;
        public OrderedDict Raw;

        public class ChestTier { public string Name; public string[] Wood, Palette; public int Coins, Gems; public List<(string rar, int n)> Items = new List<(string, int)>(); }
        public static List<ChestTier> ChestTiers;

        static Dictionary<string, StageData> all;
        public static StageData Get(string id)
        {
            if (all == null) Load();
            return all[id];
        }
        static double D(object o) => o is double d ? d : 0;
        static double? DN(object o) => o is double d ? d : (double?)null;
        static string S(object o) => o as string;
        static bool B(object o) => o is bool b && b;
        static object G(OrderedDict d, string k) => d != null && d.TryGetValue(k, out var v) ? v : null;
        static List<object> L(object o) => o as List<object> ?? new List<object>();
        static Tip TipOf(object o) { var d = o as OrderedDict; return d == null ? null : new Tip { Touch = S(G(d, "touch")), Key = S(G(d, "key")), Focus = S(G(d, "focus")) }; }
        static void Load()
        {
            all = new Dictionary<string, StageData>();
            var root = (OrderedDict)MiniJson.Parse(Baked.Text("stages"));
            ChestTiers = L(root["chestTiers"]).Select(o =>
            {
                var d = (OrderedDict)o;
                var t = new ChestTier { Name = S(G(d, "name")), Wood = L(G(d, "wood")).Cast<string>().ToArray(), Palette = L(G(d, "palette")).Cast<string>().ToArray(), Coins = (int)D(G(d, "coins")), Gems = (int)D(G(d, "gems")) };
                foreach (var it in L(G(d, "items"))) { var p = L(it); t.Items.Add(((string)p[0], (int)D(p[1]))); }
                return t;
            }).ToList();
            var stages = (OrderedDict)root["stages"];
            foreach (var id in stages.Order)
            {
                var d = (OrderedDict)stages[id];
                var s = new StageData { Id = id, Raw = d, Name = S(G(d, "name")), Paced = B(G(d, "paced")) };
                var st = (OrderedDict)G(d, "start"); s.StartX = D(G(st, "x")); s.StartY = D(G(st, "y"));
                s.ExitX = D(G(d, "exitX")); s.ExitY = D(G(d, "exitY"));
                foreach (var m in L(G(d, "intro"))) s.Intro.Add((string)m);
                foreach (var o in L(G(d, "caches"))) { var c = (OrderedDict)o; s.Caches.Add(new Cache { X = D(G(c, "x")), Y = D(G(c, "y")), N = (int)D(G(c, "n")) }); }
                if (G(d, "altars") != null) s.Altars = L(G(d, "altars")).Select(o => { var a = (OrderedDict)o; return new Altar { X = D(G(a, "x")), Y = DN(G(a, "y")) }; }).ToList();
                if (G(d, "spawns") != null) s.Spawns = L(G(d, "spawns")).Select(o => { var a = (OrderedDict)o; var y = G(a, "y"); return new Spawn { K = S(G(a, "k")), X = D(G(a, "x")), Y = DN(y), Air = (y as string) == "air", Core = S(G(a, "core")), Deep = B(G(a, "deep")) }; }).ToList();
                foreach (var o in L(G(d, "features"))) { var f = (OrderedDict)o; s.Features.Add(new Feature { Raw = f, T = S(G(f, "t")), X = D(G(f, "x")), Y = D(G(f, "y")), W = D(G(f, "w")), H = D(G(f, "h")), I = (int)D(G(f, "i")), Form = S(G(f, "form")) }); }
                foreach (var o in L(G(d, "hazards"))) { var h = L(o); s.Hazards.Add(((string)h[0], D(h[1]), D(h[2]))); }
                if (G(d, "arena") is OrderedDict ar)
                {
                    s.ArenaInfo = new Arena { L = D(G(ar, "l")), R = D(G(ar, "r")), Floor = D(G(ar, "floor")) };
                    if (G(ar, "top") is OrderedDict tp) s.ArenaInfo.Top = new RectD { X = D(G(tp, "x")), Y = D(G(tp, "y")), W = D(G(tp, "w")) };
                    if (G(ar, "hole") is OrderedDict ho) s.ArenaInfo.Hole = new RectD { X = D(G(ho, "x")), Y = D(G(ho, "y")), W = D(G(ho, "w")), H = D(G(ho, "h")) };
                }
                foreach (var o in L(G(d, "events")))
                {
                    var e = (OrderedDict)o;
                    var ev = new Event { X = D(G(e, "x")), Y = DN(G(e, "y")), OnCore = B(G(e, "onCore")), Quiet = B(G(e, "quiet")), WaitCore = B(G(e, "waitCore")), Ult = B(G(e, "ult")), Say = S(G(e, "say")), Teach = S(G(e, "teach")), Tip = TipOf(G(e, "tip")), Hint = TipOf(G(e, "hint")) };
                    if (G(e, "waves") != null) ev.Waves = L(G(e, "waves")).Select(w => L(w).Select(p => { var q = L(p); return new Wave { Kind = (string)q[0], Side = (int)D(q[1]) }; }).ToList()).ToList();
                    if (G(e, "lock") != null) ev.Lock = L(G(e, "lock")).Select(D).ToArray();
                    s.Events.Add(ev);
                }
                all[id] = s;
            }
        }
    }

    public interface IStageApi
    {
        Enemy SpawnEnemy(string kind, double x, double? y, bool air = false);
        void Say(string msg, double sec, string focus = null);
        void Hint(string msg, double sec);
        void Teach(string k);
        bool CoreLeft();
        bool CoreNear(Player p);
        bool Busy(double x, double y, double before);
        bool Talking();
        void Cut();
        int Alive((double l, double r)? lk);
        void DropCache(double x, double y, int n);
        void Clear();
    }

    /// stage.js 的 Director
    public class Director
    {
        const double SAY_TIME = 3.2, HINT_TIME = 5;
        readonly StageData stage; readonly IStageApi api; readonly bool isTouch;
        public int Next, Wave; public (double l, double r)? Lock; public List<List<StageData.Wave>> Waves; public double WaveDelay, Time, HoldT, WaitT; public bool Done, UltOK;

        public Director(StageData stage, IStageApi api, bool isTouch)
        {
            this.stage = stage; this.api = api; this.isTouch = isTouch;
            foreach (var m in stage.Intro) api.Say(m, SAY_TIME);
            foreach (var c in stage.Caches) api.DropCache(c.X, c.Y, c.N);
            // 怪物一開始就擺在地圖上
            if (stage.Spawns != null) foreach (var sp in stage.Spawns) { var e = api.SpawnEnemy(sp.K, sp.X, sp.Y, sp.Air); if (e != null && sp.Core != null) e.Core = sp.Core; if (e != null && sp.Deep) e.DeepSleep = true; }
            else foreach (var ev in stage.Events)
            {
                if (ev.Waves == null || ev.Lock != null) continue;
                var flat = ev.Waves.SelectMany(w => w).ToList();
                for (int i = 0; i < flat.Count; i++) { double x = ev.X + 150 + i * 34 + (i % 2) * 9; api.SpawnEnemy(flat[i].Kind, x, null, flat[i].Kind.StartsWith("bat")); }
            }
        }

        public void Update(double dt, Player player, double camX, double W)
        {
            if (Done) return;
            Time += dt;
            if ((HoldT -= dt) > 0) return;   // 王戰中死掉，淡出、送回祭壇的這段時間不要又觸發王房
            // 戰鬥中：等這一波清完，再出下一波
            if (Lock != null)
            {
                if (api.Alive(Lock) == 0 && (WaveDelay -= dt) <= 0)
                {
                    if (Wave < Waves.Count) SpawnWave(Waves[Wave++]);
                    else
                    {
                        Lock = null;
                        if (!stage.Events.Any(e => e.Lock != null)) api.Say("系統：清除！……哼，還算可以。", 2);
                    }
                }
                else if (api.Alive(Lock) > 0) WaveDelay = 0.6;
                return;
            }
            var ev = Next < stage.Events.Count ? stage.Events[Next] : null;
            bool reached = ev != null && (ev.OnCore ? api.CoreNear(player) : player.X >= ev.X && (ev.Y == null || player.Y >= ev.Y));
            if (!reached) WaitT = 0;
            else if ((WaitT += dt) < 8 && ((ev.Quiet && api.Busy(player.X, player.Y, ev.X)) || (ev.WaitCore && api.CoreLeft()) || (stage.Paced && api.Talking()))) { /* 等一下 */ }
            else
            {
                Next++; WaitT = 0;
                if (stage.Paced && (ev.Say != null || ev.Tip != null)) api.Cut();
                if (ev.Ult) UltOK = true;
                if (ev.Teach != null) api.Teach(ev.Teach);
                if (ev.Say != null) api.Say(ev.Say, SAY_TIME);
                if (ev.Hint != null) api.Hint(isTouch ? ev.Hint.Touch : ev.Hint.Key, HINT_TIME);
                if (ev.Tip != null) api.Say("系統：" + (isTouch ? ev.Tip.Touch : ev.Tip.Key), HINT_TIME, ev.Tip.Focus);
                if (ev.Waves != null && ev.Lock != null)
                {
                    Lock = (ev.Lock[0], ev.Lock[1]);
                    Waves = ev.Waves;
                    Wave = 0;
                    WaveDelay = 0.4;
                }
            }
            if (Lock == null && Next >= stage.Events.Count && player.X >= stage.ExitX && (stage.ExitY == 0 || Math.Abs(player.Y - stage.ExitY) < 40))
            {
                Done = true;
                api.Clear();
            }
        }

        /// 王戰中死掉 → 解除封鎖，下次走進王房重新開打
        public void ResetLock()
        {
            if (Lock == null) return;
            Lock = null; Waves = null;
            Next = stage.Events.FindIndex(e => e.Lock != null);
            HoldT = 1;
        }

        void SpawnWave(List<StageData.Wave> list)
        {
            var (l, r) = Lock.Value;
            for (int i = 0; i < list.Count; i++)
            {
                var (kind, side) = (list[i].Kind, list[i].Side);
                double x = side > 0 ? r - 24 - i * 14 : side < 0 ? l + 24 + i * 14 : l + 60 + Rnd.Next() * (r - l - 120);
                api.SpawnEnemy(kind, x, kind.StartsWith("bat") ? 40 + Rnd.Next() * 30 : (double?)null);
            }
        }
    }

    /// main.js 的系統台詞排隊與計時（toast、updateSay、hud 裡的倒數）。畫面在階段 4 才做，這裡只管「現在講哪一句、講多久」
    public class SayQueue
    {
        public readonly List<(string msg, double sec, string focus)> Queue = new List<(string, double, string)>();
        public double ToastT, SysT, SysAge, SysMin;
        public string Sys, Toast, Focus;   // 現在顯示的系統台詞（打字中或打完）、一般提示
        public bool Paced, Imp;
        public Action<string, double, string> OnShow;
        public void Push(string m, double s, string f = null) => Queue.Add((m, s, f));
        public void Unshift(string m, double s, string f = null) => Queue.Insert(0, (m, s, f));
        public bool Talking() => Queue.Count > 0 || (SysT > 0.3 && SysAge < SysMin);
        public void Cut() { if (SysT > 0.2) ToastT = SysT = 0.2; }
        public void Show(string msg, double sec = 3, string focus = null)
        {
            OnShow?.Invoke(msg, sec, focus);
            if (msg.StartsWith("系統："))
            {
                string text = msg.Substring(3);
                Sys = text; Imp = text.StartsWith("主線「");
                SysT = ToastT = sec + text.Length * 0.035;
                SysAge = 0; SysMin = 1.4 + text.Length * 0.035;
                Focus = focus;
                return;
            }
            Toast = msg;
            ToastT = sec;
        }
        public void Update()
        {
            bool urgent = Queue.Count > 0 && Queue[0].msg.StartsWith("系統：主線「") && !Imp;
            if ((urgent || ToastT <= 0.2 || (Paced && SysT > 0 && SysAge >= SysMin)) && Queue.Count > 0) { var (m, s, f) = Queue[0]; Queue.RemoveAt(0); Show(m, s, f); }
        }
        /// hud(dt)：每畫一格跑一次
        public void Hud(double dt)
        {
            SysAge += dt;
            if ((ToastT -= dt) <= 0) Toast = null;
            if ((SysT -= dt) <= 0 && Sys != null) Sys = null;
        }
    }
}
