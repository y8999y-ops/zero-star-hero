// townui.js 的 openQuests、openForge、openInn：任務（主線／支線）、鍛造（強化／重鑄／拆解）、旅館（休息／料理）。
// 少字多圖：任務種類用圖示、獎勵用「圖示＋數字」籌碼、強化等級用菱形亮點、成功率用量條、按鈕是「圖示＋兩個字」。
// 介面特效（打鐵火花、開副屬性、交付緞帶、金幣）用 UiFx 播在按鈕、視窗上。
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using PixelFX;
using UnityEngine;
using UnityEngine.UIElements;
using static ZeroStar.UI.Ui;

namespace ZeroStar.UI
{
    public static class TownWins
    {
        public static Win W; public static UiFx Fx; public static Action OpenBag;
        static readonly Dictionary<string, string> ENEMY = new Dictionary<string, string> { ["slime"] = "史萊姆", ["bat"] = "蝙蝠", ["trash"] = "垃圾桶怪", ["hog"] = "刺蝟", ["elite"] = "菁英魔物" };
        static readonly Dictionary<string, string> SYS_ICON = new Dictionary<string, string> { ["out11"] = "star", ["reg"] = "guild", ["guild1"] = "seal", ["core1"] = "core_slime", ["forge2"] = "hammer", ["meal1"] = "bowl", ["reroll1"] = "dice", ["rankE"] = "guild", ["forms3"] = "star", ["boss1"] = "q_kill" };
        static readonly Dictionary<string, string> SYS_DESC = new Dictionary<string, string>
        {
            ["out11"] = "找到出口，走出這個洞窟。", ["reg"] = "去公會找波波登記。沒有冒險者證，哪裡都去不了。", ["guild1"] = "完成並交付 1 個公會任務。",
            ["core1"] = "吸收 1 顆魔物的靈核，解鎖新形態。", ["forge2"] = "在岩叔的工坊把任何一件裝備強化到 +2。", ["meal1"] = "在菇媽的旅館吃一道料理。",
            ["reroll1"] = "在工坊重鑄 1 條詞綴。", ["rankE"] = "公會等級升到 E（交付 3 個公會任務）。", ["forms3"] = "同時帶著 3 個形態。", ["boss1"] = "通關 1-4，打倒大胃王史萊姆。",
        };
        static readonly int[] RANK_AT = { 0, 3, 8, 15, 25, 40, 60 }; static readonly string[] RANK_NAME = { "F", "E", "D", "C", "B", "A", "S" };
        public static (string icon, string label, string tag) QuestLook(Quest q)
        {
            if (q.Kind == "kill") return ("q_kill", ENEMY[q.Enemy], null);
            if (q.Kind == "junk") return ("q_junk", "撿垃圾", null);
            if (q.Kind == "clear") return (q.Stage == "1-4" ? "guild" : "q_clear", $"{q.Stage} {(QuestBook.LAYOUT_NAME.TryGetValue(q.Stage, out var n) ? n : "")}", q.NoDeath ? "不能死" : null);
            return ("core_slime", "吸收靈核", null);
        }
        static Label Tag(VisualElement p, string text, bool ok)
        {
            var t = Text(p, text, 12, ok ? "#0a2a0e" : "#ffffff"); t.style.backgroundColor = C(ok ? "#8af08a" : "#c83a4a"); t.style.paddingLeft = t.style.paddingRight = 5; Round(t, 2); t.style.marginLeft = 4;
            return t;
        }
        static VisualElement Row(VisualElement p, float gap = 0) { var r = Box(p); r.style.flexDirection = FlexDirection.Row; r.style.alignItems = Align.Center; return r; }
        static VisualElement QIc(VisualElement p, string icon)
        {
            var q = Box(p); Size(q, 32, 32); q.style.flexShrink = 0; Round(q, 16); q.style.backgroundColor = C("#000000", 0.35f); q.style.alignItems = Align.Center; q.style.justifyContent = Justify.Center; q.style.marginRight = 8;
            Win.Ico(q, icon, 32); return q;
        }

        // ================= 任務 =================
        /// 任務視窗。atGuild：在公會（可以接任務、交付、放棄）
        public static Task OpenQuests(Game g, bool atGuild = false, string tab = "guild")
        {
            var Q = g.Quests;
            if (atGuild) Q.RefreshBoard(g.UnlockedStages());
            var tracked = Q.Tracked;
            VisualElement TrackBtn(VisualElement p, string id)
            {
                bool on = tracked.Contains(id);
                var b = W.IBtn(p, "star", "", () =>
                {
                    if (tracked.Contains(id)) tracked.Remove(id);
                    else { tracked.Clear(); tracked.Add(id); W.Msg("改追蹤這個任務"); }
                    g.Sfx("ui"); g.QuestProgress("tick"); W.Render();
                }, "go", true);
                if (!on) b.style.unityBackgroundImageTintColor = new Color(0.55f, 0.55f, 0.55f);
                b.style.marginLeft = 4;
                return b;
            }
            void Card(VisualElement body, Quest q, bool offer)
            {
                var L = QuestLook(q); bool ready = !offer && q.Ready;
                var c = Win.Card(body, "guild"); if (offer) c.style.opacity = 0.92f;
                if (ready) { c.style.unityBackgroundImageTintColor = C("#e8ffe0"); }
                QIc(c, L.icon);
                var main = Box(c); main.style.flexGrow = 1; main.style.flexShrink = 1; main.style.minWidth = 0; main.style.marginRight = 8;
                var qt = Row(main); qt.style.flexWrap = Wrap.Wrap; Text(qt, L.label, 14, "#fff2c8", true);
                if (L.tag != null) Tag(qt, L.tag, false);
                if (ready) Tag(qt, "完成", true);
                if (!offer) W.Bar(main, q.Have, q.Need);
                if (offer && q.Need > 1) Text(main, "×" + q.Need, 16, W.Acc, true);
                var rw = Row(c); rw.style.flexWrap = Wrap.Wrap; rw.style.justifyContent = Justify.FlexEnd; rw.style.maxWidth = 190; rw.style.marginRight = 6;
                foreach (var (ic, n) in new[] { ("coin", q.Coins), ("scrap", q.Scrap), ("xp", q.Xp) }) if (n > 0) { var ch = W.Chip(rw, ic, n.ToString()); ch.style.marginLeft = 2; ch.style.marginBottom = 2; }
                var act = Row(c); act.style.flexShrink = 0;
                if (offer)
                    W.IBtn(act, "check", "接受", () =>
                    {
                        if (!Q.Accept(q.Id)) return;
                        if (tracked.Count < 1 && !tracked.Contains(q.Id)) tracked.Add(q.Id);
                        g.Sfx("pickup"); W.Msg($"接下了：{L.label}"); g.QuestProgress("tick"); W.Render();
                    });
                else if (atGuild && ready)
                    W.IBtn(act, "seal", "交付", () =>
                    {
                        var r = Q.TurnIn(q.Id); if (r == null) return;
                        g.GuildDone++;
                        g.Money += r.Coins; g.Scrap += r.Scrap; if (r.Xp > 0) g.GainXp(r.Xp);
                        g.Sfx("levelup"); W.Msg("交付完成！"); g.QuestProgress("tick"); W.Render();
                        // 交付特效：視窗中間蓋一條「任務完成！」緞帶，金幣飛向右上的錢
                        Fx?.At(W.BoxCenter(), "quest-complete-zh", new FxOptions { Seed = g.GuildDone });
                        if (r.Coins > 0) Fx?.At(W.MoneyCenter(), "coin-collect", new FxOptions { Seed = g.GuildDone }.Set("count", 8));
                    });
                else if (atGuild) W.IBtn(act, "close", "", () => { Q.Abandon(q.Id); g.Sfx("close"); W.Msg("放棄了任務", false); W.Render(); }, "bad", true);
                else if (ready) { var go = Row(act); Win.Ico(go, "guild"); Text(go, "回公會", 12, W.Acc); }
                if (!offer) TrackBtn(act, q.Id);
            }
            void GuildTab(VisualElement body)
            {
                int done = g.GuildDone, ri = 0; for (int i = 0; i < RANK_AT.Length; i++) if (done >= RANK_AT[i]) ri = i;
                bool hasNext = ri + 1 < RANK_AT.Length; int prev = RANK_AT[ri];
                var head = Row(body); head.style.paddingLeft = head.style.paddingRight = 4; head.style.paddingBottom = 2; head.style.marginBottom = 5;
                var rank = Box(head); Size(rank, 40, 40); rank.style.marginRight = 10; Win.Ico(rank, "guild", 40);
                var rl = Text(rank, RANK_NAME[ri], 18, "#ffffff", true, 2); Abs(rl, 0, 0, 0, 0); rl.style.unityTextAlign = TextAnchor.MiddleCenter;
                var rp = Box(head); rp.style.flexGrow = 1;
                if (hasNext) W.Bar(rp, done - prev, RANK_AT[ri + 1] - prev); else W.Bar(rp, 1, 1);
                Text(rp, hasNext ? $"下一級 {RANK_NAME[ri + 1]}" : "最高級", 12, "#b8acc8");
                if (Q.Active.Count == 0 && !atGuild) W.Say(body, "系統", "還沒接任務。去公會找波波。");
                foreach (var q in Q.Active.ToList()) Card(body, q, false);
                if (atGuild)
                {
                    var sec = Row(body); sec.style.marginTop = 4; sec.style.marginBottom = 5; Win.Ico(sec, "paper").style.marginRight = 4;
                    Text(sec, "任務板", 12, W.Acc, true).style.letterSpacing = 2;
                    foreach (var q in Q.Board.ToList()) Card(body, q, true);
                }
            }
            void SysTab(VisualElement body)
            {
                W.Say(body, "系統", "這是你的主線。一次一件，做完我再告訴你下一件。");
                foreach (var s in Game.SYSTEM.Where(s => !g.SysDone.Contains(s.id)).Take(1))
                {
                    var c = Win.Card(body, "sys");
                    QIc(c, SYS_ICON.TryGetValue(s.id, out var ic) ? ic : "xp");
                    var main = Box(c); main.style.flexGrow = 1; main.style.flexShrink = 1; main.style.marginRight = 8;
                    Text(main, s.title, 14, "#fff2c8", true);
                    var d = Text(main, SYS_DESC[s.id], 12, "#b8c8d8"); d.style.whiteSpace = WhiteSpace.Normal;
                    var rw = Box(c); rw.style.alignItems = Align.FlexEnd; W.Chips(rw, s.coins, s.scrap, s.xp);
                }
                var grid = Row(body); grid.style.flexWrap = Wrap.Wrap; grid.style.paddingLeft = grid.style.paddingRight = grid.style.paddingTop = grid.style.paddingBottom = 4;
                var sm = Text(grid, $"已完成 {Game.SYSTEM.Count(s => g.SysDone.Contains(s.id))}/{Game.SYSTEM.Length}", 12, W.Acc); sm.style.width = Length.Percent(100); sm.style.marginBottom = 4;
                foreach (var s in Game.SYSTEM)
                {
                    bool on = g.SysDone.Contains(s.id);
                    var cell = Box(grid); Size(cell, 30, 30); Border(cell, 2, on ? C(W.Acc) : C("#2a4a5a")); Round(cell, 4); cell.style.marginRight = 4; cell.style.marginBottom = 4;
                    cell.style.alignItems = Align.Center; cell.style.justifyContent = Justify.Center; if (on) cell.style.backgroundColor = C("#6ad8ff", 0.12f);
                    var ic = Win.Ico(cell, SYS_ICON.TryGetValue(s.id, out var n) ? n : "xp"); if (!on) { ic.style.unityBackgroundImageTintColor = new Color(0.35f, 0.35f, 0.35f); ic.style.opacity = 0.7f; }
                }
            }
            // 主線一開始就有；支線（公會）要登記之後才出現
            var tabs = new List<Win.Tab> { new Win.Tab { Id = "sys", Label = "主線", Icon = "xp", Theme = "sys", Emblem = "xp", Title = "主線任務", Render = SysTab } };
            if (g.GuildRegistered) tabs.Add(new Win.Tab { Id = "guild", Label = "支線", Icon = "guild", Title = atGuild ? "冒險者公會" : "支線任務", Render = GuildTab });
            return W.Show(atGuild ? "冒險者公會" : "任務", "guild", "guild", tabs, g.GuildRegistered ? tab : "sys");
        }

        // ================= 鍛造 =================
        static readonly string[] SLOT_ORDER = { "weapon", "head", "body", "hands", "feet", "acc1", "acc2" };
        static readonly string[] SPARK = { "#3a1a06", "#8a4a10", "#e0901c", "#ffc83a", "#ffe98a", "#fff8d8", "#ffffff" };
        static readonly string[] DULL = { "#141018", "#2a2430", "#463e4c", "#6a6070", "#8a8090", "#a8a0ae", "#c0bac4" };
        // 使用者 2026-11-05：強化、重鑄只能用在「身上穿著的」裝備
        static List<Item> Worn(Game g) => SLOT_ORDER.Where(s => g.Equip.ContainsKey(s) && g.Equip[s] != null).Select(s => g.Equip[s]).ToList();
        static VisualElement ItemHead(VisualElement p, Item it)
        {
            var h = Row(p); h.style.flexGrow = 1; h.style.flexShrink = 1; h.style.flexBasis = 150; h.style.minWidth = 0;
            var img = Box(h); img.style.marginRight = 6; Win.Ico(img, it.Icon, 32);
            var e = Text(img, "E", 12, "#0a0810", true); Abs(e, null, null, -4, -2); e.style.backgroundColor = C(W.Acc); e.style.paddingLeft = e.style.paddingRight = 3; Round(e, 2);
            var n = Text(h, it.Name, 12, Items.RARITY[it.Rarity].Color, true); n.style.whiteSpace = WhiteSpace.NoWrap; n.style.overflow = Overflow.Hidden; n.style.textOverflow = TextOverflow.Ellipsis; n.style.flexShrink = 1;
            return img;
        }
        static void Pips(VisualElement p, int plus, int max, int step)
        {
            var plv = Row(p); Text(plv, "+" + plus, 14, "#ffe98a", true); Text(plv, "/" + max, 12, "#a59fbd");
            var pips = Row(p); pips.style.paddingLeft = 2;
            for (int i = 0; i < max / step; i++)
            {
                bool on = plus >= (i + 1) * step;
                var d = Box(pips); Size(d, 7, 7); d.style.rotate = new Rotate(45); d.style.marginRight = 4; Round(d, 1);
                d.style.backgroundColor = on ? C(W.Acc) : C("#1a1018"); Border(d, 1, on ? C("#ffffff", 0.6f) : C("#5a3a2a"));
            }
        }
        static void Gauge(VisualElement p, int rate)
        {
            var g = Box(p); g.style.height = 12; g.style.backgroundColor = C("#120c10"); Border(g, 1, C("#000000")); Round(g, 6); g.style.overflow = Overflow.Hidden;
            var f = Box(g); Abs(f, 0, 0, null, 0); f.style.width = Length.Percent(rate); f.style.backgroundColor = C(rate >= 80 ? "#6ad06a" : rate >= 50 ? "#e8c040" : "#e0603a");
            var t = Text(g, rate + "%", 12, "#ffffff", true, 1); Abs(t, 0, -4, 0, 0); t.style.unityTextAlign = TextAnchor.MiddleCenter;
        }
        public static Task OpenForge(Game g)
        {
            Item failed = null; float failAt = -9;
            void EnhanceTab(VisualElement body)
            {
                W.Say(body, "岩叔", "……只打你身上穿著的。每 +5 會多一條能力，星核是每 +10，但能打到兩倍高、核心效果會升階。+10 以後會失敗，失敗只會少材料。");
                if (Worn(g).Count == 0) W.Say(body, "岩叔", "……你身上什麼都沒穿。先去背包把裝備穿上。");
                foreach (var it in Worn(g))
                {
                    int p = it.Plus, max = Items.MaxPlus(it), rate = Items.EnhanceRate(p); var cost = Items.EnhanceCost(p, it); bool top = p >= max;
                    var row = Win.Card(body, "forge"); row.style.flexWrap = Wrap.Wrap; row.style.paddingTop = row.style.paddingBottom = 12 + 2;
                    var img = ItemHead(row, it);
                    if (it == failed && Time.realtimeSinceStartup - failAt < 0.4f) { img.style.unityBackgroundImageTintColor = new Color(0.6f, 0.6f, 0.6f); }
                    var mid = Box(row); mid.style.width = 120; mid.style.marginLeft = 8; mid.style.marginRight = 8;
                    Pips(mid, p, max, Items.SubStep(it));
                    if (Items.IsCore(it)) Text(mid, $"第 {Items.CoreTier(it)} 階", 12, "#ffe066", true);
                    if (top) Text(mid, "MAX", 12, W.Acc, true); else { var gg = Box(mid); gg.style.marginTop = 3; Gauge(gg, rate); }
                    var fc = Row(row); fc.style.marginRight = 8; if (!top) W.CostChips(fc, cost.scrap, cost.coins, g.Scrap, g.Money);
                    if (!top) W.IBtn(row, "hammer", "強化", () =>
                    {
                        if (g.Scrap < cost.scrap || g.Money < cost.coins) { g.Sfx("close"); W.Msg("材料不夠", false); return; }
                        g.Scrap -= cost.scrap; g.Money -= cost.coins;
                        var at = img.worldBound.center;
                        if (Rnd.Next() * 100 < rate)
                        {
                            double before = Items.MainValue(it); var up = Items.EnhanceUp(it);
                            g.Quests.EnhanceMax = Math.Max(g.Quests.EnhanceMax, it.Plus);
                            g.Sfx("chime");
                            Fx?.At(at, "parry", new FxOptions { Palette = SPARK, Light = 0.5, Seed = it.Plus });
                            if (Items.IsCore(it) && it.Plus % 10 == 0) { var c = Items.CoreOf(it); if (c != null) { var cc = c.Value; W.Msg($"核心效果升到第 {cc.tier} 階：{Items.CORE_TEXT[cc.id](cc.x)}"); } }
                            if (up != null)
                            {
                                var col = Items.RARITY[it.Rarity].Color;
                                Fx?.At(at, "collect-burst", new FxOptions { Palette = new[] { "#1a1430", col, col, "#ffffff" }, Light = 0.6, Seed = it.Plus }, 0.18f);
                                g.Sfx("levelup");
                                W.Msg(up.Kind == "add" ? $"+{it.Plus}！新增 {Items.FmtStat(up.Id, up.After)}" : $"+{it.Plus}！{Items.Stat(up.Id).Name} {Items.FmtStat(up.Id, up.Before).Split(' ')[1]} → {Items.FmtStat(up.Id, up.After).Split(' ')[1]}");
                            }
                            else if (!(Items.IsCore(it) && it.Plus % 10 == 0)) W.Msg(before == Items.MainValue(it) ? $"成功！+{it.Plus}" : $"成功！+{it.Plus}　{Items.Stat(it.Main.Id).Name} {Fmt(before)} → {Fmt(Items.MainValue(it))}");
                            g.ApplyStats();
                        }
                        else
                        {
                            g.Sfx("clank");
                            Fx?.At(at, "parry", new FxOptions { Palette = DULL, Light = 0.1, Seed = p });
                            failed = it; failAt = Time.realtimeSinceStartup;
                            W.Msg("失敗……材料沒了", false);
                        }
                        g.QuestProgress("tick");
                        W.Render();
                    });
                }
            }
            void RerollTab(VisualElement body)
            {
                W.Say(body, "岩叔", "……選一條不要的，我重打。");
                var list = Worn(g).Where(it => it.Affixes.Count > 0 && it.Unique == null).ToList();
                if (list.Count == 0) W.Say(body, "岩叔", "……你身上沒有能重打的東西。背包裡的要先穿上。");
                foreach (var it in list)
                {
                    var cost = Items.RerollCost(it);
                    var card = Win.Card(body, "forge", false); card.style.paddingTop = card.style.paddingBottom = 12 + 2;
                    var top = Row(card); ItemHead(top, it); var fc = Row(top); W.CostChips(fc, cost.scrap, cost.coins, g.Scrap, g.Money);
                    for (int i = 0; i < it.Affixes.Count; i++)
                    {
                        int idx = i; var a = it.Affixes[i];
                        var row = Row(card); row.style.paddingLeft = 40; row.style.marginTop = 2;
                        var at = Text(row, Items.FmtStat(a.Id, a.V), 12, "#d8e4ff"); at.style.flexGrow = 1;
                        W.IBtn(row, "dice", "重鑄", () =>
                        {
                            if (g.Scrap < cost.scrap || g.Money < cost.coins) { g.Sfx("close"); W.Msg("材料不夠", false); return; }
                            g.Scrap -= cost.scrap; g.Money -= cost.coins;
                            var na = Items.RerollAffix(it, idx);
                            g.Quests.Rerolls++;
                            g.Sfx("chime"); W.Msg("→ " + Items.FmtStat(na.Id, na.V));
                            var pos = new Vector2(row.worldBound.xMin + row.worldBound.width * 0.3f, row.worldBound.center.y);
                            g.ApplyStats(); g.QuestProgress("tick"); W.Render();
                            Fx?.At(pos, "collect-burst", new FxOptions { Palette = new[] { "#0c2a60", "#3ab8f0", "#9af0ff", "#ffffff" }, Light = 0.5, Seed = g.Quests.Rerolls });
                        }, "plain");
                    }
                }
            }
            void SalvageTab(VisualElement body)
            {
                W.Say(body, "岩叔", "……不要的拆一拆，變星塵。");
                var big = BigCard(body, "forge");
                Win.Ico(big, "scrap", 48); Text(big, g.Scrap.ToString(), 22, W.Acc, true); Text(big, "星塵＝強化、重鑄的材料", 12, "#b8acc8").style.marginBottom = 6;
                W.IBtn(big, "bag", "去背包拆", () => { W.Close(); OpenBag?.Invoke(); });
            }
            return W.Show("岩叔的工坊", "forge", "anvil", new List<Win.Tab>
            {
                new Win.Tab { Id = "up", Label = "強化", Icon = "hammer", Render = EnhanceTab },
                new Win.Tab { Id = "re", Label = "重鑄", Icon = "dice", Render = RerollTab },
                new Win.Tab { Id = "sal", Label = "拆解", Icon = "scrap", Render = SalvageTab },
            });
        }
        static string Fmt(double v) => v.ToString("0.##");
        static VisualElement BigCard(VisualElement body, string kind)
        {
            var big = Win.Card(body, kind, false); big.style.alignItems = Align.Center; big.style.alignSelf = Align.Center; big.style.minWidth = 340;
            big.style.paddingTop = big.style.paddingBottom = 12 + 22; big.style.marginTop = 26;
            return big;
        }

        // ================= 旅館 =================
        public static Task OpenInn(Game g, Func<Task> rest)
        {
            void RestTab(VisualElement body)
            {
                W.Say(body, "菇媽", "累了就睡一晚吧～");
                var big = BigCard(body, "inn");
                Win.Ico(big, "moon", 64).style.marginBottom = 10;
                var perks = Row(big); perks.style.marginBottom = 6;
                foreach (var (ic, t) in new[] { ("heart", "生命全滿"), ("check", "存檔"), ("paper", "任務板換新") }) { var s = Row(perks); s.style.marginLeft = s.style.marginRight = 5; Win.Ico(s, ic).style.marginRight = 2; Text(s, t, 12, "#e8f4d8"); }
                W.IBtn(big, "moon", "睡一晚", async () => { W.Close(); await rest(); });
            }
            void FoodTab(VisualElement body)
            {
                W.Say(body, "菇媽", "一次吃一道，效果到下一趟冒險結束～");
                var grid = Row(body); grid.style.alignItems = Align.Stretch;
                foreach (var kv in Game.MEALS)
                {
                    var id = kv.Key; var m = kv.Value;
                    var c = Win.Card(grid, "inn", false); c.style.flexGrow = 1; c.style.flexBasis = 0; c.style.alignItems = Align.Center; c.style.marginLeft = c.style.marginRight = 3;
                    c.style.paddingTop = c.style.paddingBottom = 12 + 6; c.style.paddingLeft = c.style.paddingRight = 12 + 4;
                    if (g.Meal == id) c.style.unityBackgroundImageTintColor = C("#f4ffe0");
                    Win.Ico(c, m.icon, 48).style.marginBottom = 4;
                    Text(c, m.name, 14, "#fff4d8", true).style.marginBottom = 4;
                    W.Chip(c, m.buffIcon, m.buff, "buff").style.marginBottom = 4;
                    W.Chip(c, "coin", m.cost.ToString(), g.Money < m.cost ? "lack" : "").style.marginBottom = 4;
                    if (g.Meal == id) { var e = Row(c); Win.Ico(e, "check").style.marginRight = 2; Text(e, "吃了", 12, W.Acc, true); }
                    else W.IBtn(c, "bowl", "吃", () =>
                    {
                        if (g.Money < m.cost) { g.Sfx("close"); W.Msg("金幣不夠喔～", false); return; }
                        g.Money -= m.cost; g.Meal = id; g.Quests.Meals++;
                        g.Sfx("pickup"); W.Msg($"{m.name}：{m.buff}");
                        g.ApplyStats(); g.QuestProgress("tick"); W.Render();
                    });
                }
            }
            return W.Show("菇媽的旅館", "inn", "bowl", new List<Win.Tab>
            {
                new Win.Tab { Id = "rest", Label = "休息", Icon = "moon", Render = RestTab },
                new Win.Tab { Id = "food", Label = "料理", Icon = "stew", Render = FoodTab },
            });
        }
    }
}
