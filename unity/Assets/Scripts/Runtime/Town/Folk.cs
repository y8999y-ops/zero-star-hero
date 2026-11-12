// game/src/folk.js 一行一行翻成 C#：碎星鎮的路人。在自己的範圍裡來回走、偶爾停下來轉身；菇菇寶寶兩顆，後面那顆跟著前面那顆。
// 走近按互動可以聊天（輪流講不同的話）；頭上的自言自語泡泡在 GameTown 裡。Math.random 一律用 Rnd.Next()，順序照原本。
using System;
using System.Collections.Generic;
using System.Linq;
using PixelFX;

namespace ZeroStar
{
    public class Folk
    {
        public class Info { public string Name; public double Speed; public bool Hop; public string[] Ambient; public string[][] Talk; }
        public static readonly Dictionary<string, Info> INFO = new Dictionary<string, Info>
        {
            ["kid"] = new Info { Name = "史萊姆小孩・啵啵", Speed = 26, Hop = true, Ambient = new[] { "我哥在公會上班！很厲害吧！", "你會發光耶！可以當我的夜燈嗎？", "啵！" },
                Talk = new[] { new[] { "你是星靈？真的假的！", "我哥說，從天上掉下來的東西都是垃圾。", "……啊，不是說你啦。大概。" }, new[] { "長大以後我也要戴眼鏡。", "我哥說戴眼鏡看起來比較聰明。", "……我哥其實看得很清楚。" } } },
            ["turtle"] = new Info { Name = "郵差・慢慢", Speed = 9, Ambient = new[] { "信……在……路……上……", "今天……也……準時……", "……（打呵欠）" },
                Talk = new[] { new[] { "你的……信……", "……喔，不對。你才剛來，還沒有人寫信給你。" }, new[] { "我……送信……已經……三百年了……", "最快的……一次……是……上個月……", "……寄到了……去年的信。" } } },
            ["pebble"] = new Info { Name = "學徒・碎碎", Speed = 16, Ambient = new[] { "師父說石頭要有耐心。", "我在練習發火。……還不行。", "嘿咻、嘿咻。" },
                Talk = new[] { new[] { "我是岩叔的學徒！今天也在搬石頭。", "師父說，再搬一千年就可以摸鐵鎚了。", "……一千年是多久？" }, new[] { "師父很少講話。", "但是他打鐵的時候，會偷偷哼歌。", "……這是秘密喔。" } } },
            ["shroom"] = new Info { Name = "菇菇寶寶", Speed = 34, Ambient = new[] { "抓不到～", "媽媽說不能跑太遠～", "嘻嘻～" },
                Talk = new[] { new[] { "你是新來的嗎～", "我們在玩鬼抓人～你當鬼～", "……你跑好慢喔～" }, new[] { "媽媽的湯很好喝喔～", "裡面沒有我們喔～", "……應該沒有吧～" } } },
        };
        public class O
        {
            public string Id; public Info Info; public double X, Min, Max, Dir, T; public string State = "walk";
            public double? Clock; public bool Moving, Talking; public int TalkN; public O Follow;
        }
        public readonly List<O> List = new List<O>();
        readonly double floor;

        public Folk(double floor)
        {
            this.floor = floor;
            var defs = new[] { ("kid", 300.0, 240.0, 420.0), ("turtle", 700, 660, 790), ("pebble", 590, 548, 650), ("shroom", 1030, 968, 1110) };
            for (int i = 0; i < defs.Length; i++) { var (id, x, mn, mx) = defs[i]; List.Add(new O { Id = id, X = x, Min = mn, Max = mx, Info = INFO[id], Dir = i % 2 != 0 ? -1 : 1, T = 2 + i }); }
            var lead = List.First(o => o.Id == "shroom");
            List.Add(new O { Id = "shroom2", Info = INFO["shroom"], X = lead.X - 14, Dir = lead.Dir, Follow = lead });
        }

        public void Update(double dt, double playerX)
        {
            foreach (var o in List)
            {
                o.Clock = (o.Clock ?? Rnd.Next() * 2) + dt;
                o.Moving = false;
                if (o.Talking) { o.Dir = playerX >= o.X ? 1 : -1; continue; }
                if (o.Follow != null)
                {
                    // 跟著前面那顆，隔 14px，慢一格
                    var L = o.Follow; double tx = L.X - L.Dir * 14, d = tx - o.X;
                    if (Math.Abs(d) > 1) { o.X += Math.Sign(d) * Math.Min(Math.Abs(d), L.Info.Speed * 1.15 * dt); o.Dir = Math.Sign(d); o.Moving = true; }
                    else o.Dir = L.Dir;
                    continue;
                }
                o.T -= dt;
                if (o.State == "walk")
                {
                    o.X += o.Dir * o.Info.Speed * dt;
                    o.Moving = true;
                    if (o.X < o.Min || o.X > o.Max) { o.X = Math.Max(o.Min, Math.Min(o.Max, o.X)); o.Dir = -o.Dir; }
                    if (o.T <= 0) { o.State = "idle"; o.T = 1.2 + Rnd.Next() * 2.5; }
                }
                else if (o.T <= 0)
                {
                    o.State = "walk"; o.T = 3 + Rnd.Next() * 5;
                    if (Rnd.Next() < 0.5) o.Dir = -o.Dir;
                }
            }
        }
        public void Draw(Frame frame) { foreach (var o in List) TownArt.PaintNpc(frame, o.Id, o.Clock ?? 0, o.X, floor - 1, o.Dir < 0, o.Moving); }
        /// 主角旁邊的路人（可以聊天的）；菇菇寶寶跟著的那顆不算
        public O Nearby(double x)
        {
            O best = null; double bd = 16;
            foreach (var o in List) if (o.Follow == null && Math.Abs(o.X - x) < bd) { bd = Math.Abs(o.X - x); best = o; }
            return best;
        }
        /// 聊天：輪流講不同的話
        public string[] Lines(O o) => o.Info.Talk[o.TalkN++ % o.Info.Talk.Length];
    }
}
