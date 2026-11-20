using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.UIElements;
using static ZeroStar.UI.Ui;

namespace ZeroStar.UI
{
    public static class TownActivityWin
    {
        static Win Window => TownWins.W;
        static readonly Texture2D[] starCharts = new Texture2D[6];
        const string Cream = "#f8e8c2", Muted = "#ccc2e4", Teal = "#a0eee5";

        public static Task Open(Game g, string id)
        {
            switch (id)
            {
                case "wish": return Show("許願池", "inn", "coin", body => Wish(g, body));
                case "bell": return Show("鐘樓頂", "forge", "star", body => Bell(g, body));
                case "stars": return Show("今日星象", "sys", "star", body => Stars(g, body));
                case "race-start":
                case "race-end": return Show("攀爬計時賽", "guild", "boot", body => Race(g, body, id == "race-start"));
                case "cache-west":
                case "cache-east":
                    if (g.OpenTownCache(id)) return Task.CompletedTask;
                    return Show("下水道藏寶箱", "forge", "scrap", body => Caption(body, "這口箱子的寶物已領取。", Muted));
                case "crack":
                    g.OpenTownSewerWall();
                    return Task.CompletedTask;
                case "inscription":
                    return Show("坑底碑文", "sys", "paper", body =>
                    {
                        var card = Card(body, "sys");
                        Caption(card, "石室深處的碑面泛著淡藍光。", Teal);
                        Caption(card, "（碑文待補）", Cream, true);
                    });
                case "mail":
                {
                    string letter = g.TownLetters.FirstOrDefault(id => !g.TownReadLetters.Contains(id)) ?? g.TownLetters.FirstOrDefault();
                    return Show("碎星鎮郵筒", "guild", "paper", body => Mail(g, body, letter, key => { letter = key; Window.Render(); }));
                }
                default: return Task.CompletedTask;
            }
        }

        static Task Show(string title, string theme, string icon, Action<VisualElement> render)
        {
            var tab = new Win.Tab { Id = "town-play", Title = title, Render = render };
            float height = title is "今日星象" or "碎星鎮郵筒" ? 310 : 204;
            return Window.Show(title, theme, icon, new List<Win.Tab> { tab }, tab.Id, size: new Vector2(470, height));
        }
        static VisualElement Card(VisualElement body, string theme)
        {
            var card = Win.Card(body, theme, false);
            card.style.paddingTop = card.style.paddingBottom = 14;
            return card;
        }
        static Label Caption(VisualElement parent, string value, string color, bool strong = false)
        {
            var label = Text(parent, value, strong ? 17 : 13, color, strong);
            label.style.whiteSpace = WhiteSpace.Normal;
            label.style.marginBottom = 5;
            return label;
        }
        static VisualElement Actions(VisualElement body)
        {
            var row = Box(body);
            row.style.flexDirection = FlexDirection.Row;
            row.style.flexWrap = Wrap.Wrap;
            row.style.alignItems = Align.Center;
            row.style.justifyContent = Justify.FlexEnd;
            row.style.marginTop = 8;
            return row;
        }
        static void Wish(Game g, VisualElement body)
        {
            var card = Card(body, "inn");
            Caption(card, "池底的回音", Cream, true);
            Caption(card, "每天可以投一枚願望。回音會帶回金幣、星塵或下一場冒險的好運。", Muted);
            if (g.TownWishUsed) Caption(card, "今日已許願，明天再來。", Teal, true);
            else if (g.Money < Game.WishCost) Caption(card, $"還差 {Game.WishCost - g.Money} 金幣。", "#ffc3a4");
            var row = Actions(card);
            Window.Chip(row, "coin", Game.WishCost.ToString());
            Window.IBtn(row, "coin", "投幣許願", () =>
            {
                if (g.MakeTownWish() != null) Window.Close(); else Window.Render();
            }, off: g.TownWishUsed || g.Money < Game.WishCost);
        }
        static void Bell(Game g, VisualElement body)
        {
            var card = Card(body, "forge");
            Caption(card, g.TownBellPreview ? "鐘聲正在留住這片天色" : "敲響鐘樓", Cream, true);
            Caption(card, g.TownBellPreview ? "再敲一次，碎星鎮會回到即時天色。" : "響起鐘聲後，城鎮會跳到下一個時段。", Muted);
            var row = Actions(card);
            Window.IBtn(row, "star", g.TownBellPreview ? "恢復即時" : "敲鐘", () => { g.RingTownBell(); Window.Close(); });
        }
        static void Stars(Game g, VisualElement body)
        {
            var card = Card(body, "sys");
            var info = g.TodayConstellation;
            Caption(card, info.Name, Cream, true);
            var sky = Box(card);
            sky.style.height = 94;
            sky.style.marginTop = 5; sky.style.marginBottom = 12;
            Stretch(sky, StarChart(g.TownConstellationIndex));
            Border(sky, 1, C("#71719e"));
            Caption(card, info.Text, Teal, true);
            Caption(card, g.TownStarActive ? "今日加成已生效，午夜重置。" : "啟用後，效果持續到當地午夜。", Muted);
            if (!g.TownStarActive)
                Window.IBtn(Actions(card), "star", "啟用星象", () => { g.ReadTownStars(); Window.Render(); });
        }
        static Texture2D StarChart(int constellation)
        {
            if (starCharts[constellation] != null) return starCharts[constellation];
            const int w = 150, h = 48;
            var points = new Vector2Int[6];
            int[] ridge = { 8, 21, 14, 30, 24, 37 };
            for (int i = 0; i < points.Length; i++)
                points[i] = new Vector2Int(24 + 20 * i, 6 + (ridge[(i + constellation) % ridge.Length] + 6 * constellation) % 36);
            var chart = Gen(w, h, (x, y) =>
            {
                int seed = (x * 149 + y * 101 + x * y * 17 + constellation * 173) % 613;
                if (seed < 5) return C(seed == 0 ? "#c9d3fa" : "#5c6592");
                for (int i = 0; i < points.Length; i++)
                {
                    var a = points[i];
                    int dx = Math.Abs(x - a.x), dy = Math.Abs(y - a.y);
                    if (dx + dy <= 2) return C(i % 2 == 0 ? "#f5dc9f" : "#bcecf3");
                    if (i == points.Length - 1 || x < a.x || x > points[i + 1].x) continue;
                    var b = points[i + 1];
                    if (y == Mathf.RoundToInt(Mathf.Lerp(a.y, b.y, (x - a.x) / (float)(b.x - a.x)))) return C("#7ca6c6");
                }
                return C(y < 13 ? "#24223e" : "#15162e");
            });
            chart.filterMode = FilterMode.Point;
            return starCharts[constellation] = chart;
        }
        static void Race(Game g, VisualElement body, bool start)
        {
            var card = Card(body, "guild");
            Caption(card, "練習場 → 觀星台", Cream, true);
            Caption(card, g.TownRaceSeconds is double best ? $"最佳紀錄　{best:0.00} 秒" : "首次抵達終點可得 10 星塵。", Teal);
            if (!g.TownCanRace) Caption(card, "觀星台完工後開放計時賽。", "#ffc3a4");
            else if (g.TownRaceClock.HasValue)
            {
                Caption(card, "計時中。請沿著攀爬路線抵達觀星台的旗子。", Muted);
                if (start) Window.IBtn(Actions(card), "close", "取消計時", () => { g.CancelTownRace(); Window.Close(); }, "plain");
            }
            else if (start)
            {
                Caption(card, "三秒倒數後出發。路標傳送會取消本次計時。", Muted);
                Window.IBtn(Actions(card), "boot", "開始倒數", () => { if (g.StartTownRace()) Window.Close(); });
            }
            else Caption(card, "到練習場的起跑旗開始。", Muted);
        }
        static void Mail(Game g, VisualElement body, string selected, Action<string> select)
        {
            var items = g.TownLetters.ToArray();
            if (items.Length == 0)
            {
                Caption(Card(body, "guild"), "通過新的關卡後，來這裡收信。", Muted);
                return;
            }
            var head = Card(body, "guild");
            Caption(head, g.TownUnreadLetters > 0 ? $"{g.TownUnreadLetters} 封未讀信件" : "信件已讀完", Cream, true);
            var slots = Actions(head);
            slots.style.justifyContent = Justify.FlexStart;
            foreach (string id in items)
            {
                string name = g.TownReadLetters.Contains(id) ? id : $"新信 {id}";
                string key = id;
                Window.IBtn(slots, "paper", name, () => select(key), "plain", mini: true);
            }
            if (!items.Contains(selected)) selected = items[0];
            string reading = selected;
            var paper = Card(body, "guild");
            Caption(paper, QuestBook.LAYOUT_NAME[reading], Cream, true);
            if (!g.TownReadLetters.Contains(reading))
            {
                Caption(paper, "郵差把這封信留在郵筒裡。", Muted);
                Window.IBtn(Actions(paper), "paper", "拆開信件", () => { g.ReadTownLetter(reading); Window.Render(); });
            }
            else Caption(paper, "（居民寄來的信件內容待補）", Muted);
        }
    }
}
