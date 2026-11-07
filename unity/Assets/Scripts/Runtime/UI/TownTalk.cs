// main.js 的 interact、guild、workshop、inn、travel：碎星鎮裡按互動之後的對話流程。
// 公會的任務板、工坊、旅館的視窗在 UI/TownWins.cs（openQuests、openForge、openInn）。
using System;
using System.Linq;
using System.Threading.Tasks;
using PixelFX;

namespace ZeroStar.UI
{
    public static class TownTalk
    {
        static readonly string[] INN_CHAT =
        {
            "以前這裡只是隕石坑旁邊的小村子。星星掉下來以後，冒險者就變多了。",
            "野外的史萊姆會咬人？哎呀，我家隔壁的史萊姆很乖的。是那些碎片害的啦。",
            "岩叔看起來很兇，其實他會偷偷幫小孩修玩具喔。",
            "波波每天都推眼鏡推一千次。我數過。",
            "你是星靈？那你晚上會發光嗎？省電耶。",
        };
        static readonly (string rank, int need)[] RANKS = { ("F", 0), ("E", 3), ("D", 8), ("C", 15), ("B", 25), ("A", 40), ("S", 60) };
        public static string RankOf(int done) { string r = "F"; foreach (var (k, n) in RANKS) if (done >= n) r = k; return r; }

        /// 按互動：路人聊天、公會、工坊、旅館、路標
        public static async Task Interact(Game g, Dialog dlg, Game.Near n, Action openMap)
        {
            g.TownBusy = true;
            try
            {
                if (n.FolkO != null) { n.FolkO.Talking = true; await dlg.Talk(n.Name, g.Folk.Lines(n.FolkO)); n.FolkO.Talking = false; }
                else if (n.Place == "guild") await Guild(g, dlg, n.Name);
                else if (n.Place == "workshop") await Workshop(g, dlg, n.Name);
                else if (n.Place == "inn") await Inn(g, dlg, n.Name);
                else await Travel(g, dlg, openMap);
            }
            finally { g.TownBusy = false; }
        }

        static async Task Guild(Game g, Dialog dlg, string name)
        {
            if (!g.GuildRegistered)
            {
                await dlg.Talk(name, new[] { "歡迎來到冒險者公會碎星鎮分部。我是櫃檯的波波。", "要登記冒險者嗎？請在這裡填寫……種族？" });
                await dlg.Talk("系統", new[] { "填「發光的五角形」應該就好。" });
                await dlg.Talk(name, new[] { "……好的，星靈。", "這是你的冒險者證，等級 F。完成任務就會升級喔。", "（推眼鏡）別擔心，大家一開始都是 F。……大部分的人啦。" });
                g.GuildRegistered = true;
                if (g.TGuide == 0) g.TGuide = 1;
            }
            // 主線完成（例如登記冒險者）當場由系統講
            var done = g.QuestProgressLines();
            if (done.Count > 0) await dlg.Talk("系統", done);
            string before = RankOf(g.GuildDone);
            bool firstBoard = g.TGuide == 1;
            if (firstBoard) await dlg.Talk(name, new[] { "任務都貼在任務板上，想接幾張都可以。", "不過一次只能追蹤一個——點任務右邊的星星，它就會顯示在你的頭像下面。", "做完再回來找我交付喔。" });
            else await dlg.Talk(name, new[] { g.GuildDone == 0 && g.Quests.Active.Count == 0 ? "任務都貼在任務板上，挑喜歡的接吧。做完再回來找我交付喔。" : "（推眼鏡）任務板在這裡。" });
            var qp = TownWins.OpenQuests(g, true);
            if (firstBoard) TownWins.W.GuidePulse();   // 第一次打開：主要按鈕閃金光
            await qp;
            if (firstBoard) g.GuideNext("系統：下一站，岩叔的工坊。撿到用不到的裝備，可以拿去那裡拆掉、把身上的打強一點。");
            if (RankOf(g.GuildDone) != before)
            {
                await dlg.Talk(name, new[] { $"恭喜！冒險者等級升到 {RankOf(g.GuildDone)} 級了。", "（推眼鏡）……我就知道你可以。大概。" });
                g.QuestProgress("tick");
            }
        }
        static async Task Workshop(Game g, Dialog dlg, string name)
        {
            bool first = g.TGuide == 2;
            if (first) await dlg.Talk(name, new[] { "……新來的？我是岩叔。", "用不到的裝備拿來，拆了變碎屑。碎屑拿來強化你身上穿的。", "……要重鑄、合成，也在這裡。" });
            else await dlg.Talk(name, new[] { "……要打什麼？" });
            var fp = TownWins.OpenForge(g);
            if (first) TownWins.W.GuidePulse();
            await fp;
            g.ApplyStats();
            if (first) g.GuideNext("系統：再來是旅館。菇媽那裡可以睡一晚、吃點東西。");
        }
        static async Task Inn(Game g, Dialog dlg, string name)
        {
            bool firstInn = g.TGuide == 3;
            if (firstInn)
            {
                await dlg.Talk(name, new[] { "哎呀，新面孔～我是菇媽。", "累了就來睡一晚，血會回滿，公會的任務板也會換一批新的喔。", "出門前吃一道料理，會有加成～" });
                g.GuideNext("系統：最後，鎮子最右邊的路標。準備好了就去那裡選要去哪。");
            }
            else await dlg.Talk(name, new[] { Rnd.Next() < 0.4 ? INN_CHAT[(int)Math.Floor(Rnd.Next() * INN_CHAT.Length)] : "哎呀，歡迎光臨～要休息還是吃點東西？" });
            if (firstInn) TownWins.W.GuidePulse();   // 第一次打開：「睡一晚」閃一下
            await TownWins.OpenInn(g, async () =>
            {
                g.Player.Hp = g.Player.MaxHp;
                g.Quests.RefreshBoard(g.UnlockedStages(), true);
                await TownWins.W.FadeBlack(0.6f);
                await dlg.Talk(name, new[] { "睡得好嗎？生命全滿，也幫你存好檔了。", "對了，公會的任務板好像換新了喔～" });
            });
            g.ApplyStats();
        }
        static async Task Travel(Game g, Dialog dlg, Action openMap)
        {
            if (g.TGuide == 4) g.GuideNext(null);
            if (g.Quests.Active.Count == 0 && g.GuildRegistered) await dlg.Talk("系統", new[] { "……你沒接公會任務喔。打怪是可以，但沒有人會付錢給你。" });
            openMap();
        }
    }
}
