// townui.js 的 openTree、carryPage：形態技能樹視窗（青色主題）。
//   第一頁「形態」：帶在身上的 3 格，下面每個已經有的形態一張卡（帶上／放下；戰鬥中不能換）。
//   之後每個形態一頁：左邊三條路線＋被動、最下面最終節點；右邊選中節點的說明和投入鍵。點已選的節點再點一下＝直接投入。
//   上方：剩幾顆靈核，2 顆可以換一次那種魔物的屬性。
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
    public static class TreeWin
    {
        static Win W => TownWins.W;
        static string sel;
        static VisualElement Row(VisualElement p) { var r = Box(p); r.style.flexDirection = FlexDirection.Row; r.style.alignItems = Align.Center; return r; }
        static string FormIcon(string id) => id == "star" ? "star" : "core_" + id;

        public static Task Open(Game g, bool inCombat, Action onCarry, string tab = null)
        {
            var owned = SkillTree.FORM_IDS.Where(f => g.FormsOwned.ContainsKey(f)).ToList();
            sel = null;
            void CarryPage(VisualElement body)
            {
                string cur = g.Player.Form; bool canEdit = !inCombat;
                var ttl = Row(body); ttl.style.marginBottom = 4;
                Text(ttl, "帶在身上", 13, "#8ae0ff").style.letterSpacing = 2;
                Text(ttl, $"{g.Carry.Length}/{SkillTree.CARRY_MAX}", 13, "#ffd24a").style.marginLeft = 4;
                if (!canEdit) Text(ttl, "（戰鬥中不能換，先脫離戰鬥）", 12, "#a59fbd").style.marginLeft = 6;
                var slots = Row(body); slots.style.marginBottom = 8;
                for (int i = 0; i < SkillTree.CARRY_MAX; i++)
                {
                    string id = i < g.Carry.Length ? g.Carry[i] : null;
                    var s = Box(slots); Size(s, 52, 46); s.style.marginRight = 8; s.style.alignItems = Align.Center; s.style.justifyContent = Justify.Center;
                    s.style.backgroundColor = C("#061222", 0.55f); Border(s, 2, id != null && id == cur ? C(Game.FORM_COLOR[id]) : C("#8ae0ff", 0.35f));
                    if (id != null) { var p = Box(s); Size(p, 40, 34); Img(p, "portrait-" + id); var n = Text(s, (i + 1).ToString(), 11, "#8ae0ff", true); Abs(n, 2, 0); }
                    else Text(s, "空", 12, "#a59fbd");
                }
                var grid = Row(body); grid.style.flexWrap = Wrap.Wrap; grid.style.alignItems = Align.Stretch;
                foreach (var id in owned)
                {
                    bool carried = g.Carry.Contains(id), on = id == cur; string col = Game.FORM_COLOR[id];
                    var card = Box(grid); card.style.flexDirection = FlexDirection.Row; card.style.width = Length.Percent(49); card.style.marginRight = Length.Percent(1); card.style.marginBottom = 8;
                    card.style.paddingLeft = card.style.paddingRight = card.style.paddingTop = card.style.paddingBottom = 6; card.style.backgroundColor = C("#061222", 0.5f);
                    Border(card, 2, on ? C(col) : carried ? C("#8ae0ff", 0.5f) : C("#8ae0ff", 0.25f));
                    var pic = Box(card); Size(pic, 84, 72); pic.style.flexShrink = 0; pic.style.alignItems = Align.Center; pic.style.justifyContent = Justify.Center; pic.style.marginRight = 8;
                    var cc = C(col); Stretch(pic, Gen(32, 32, (x, y) => { float d = Vector2.Distance(new Vector2(x + 0.5f, y + 0.5f), new Vector2(16, 19)) / 16; return new Color(cc.r, cc.g, cc.b, 0.35f * Mathf.Clamp01(1 - d / 0.7f)); }));
                    var por = Box(pic); Size(por, 80, 68); Img(por, "portrait-" + id);
                    var info = Box(card); info.style.flexGrow = 1; info.style.flexShrink = 1;
                    var nm = Row(info); Text(nm, Game.FORM_NAME[id], 16, col, true);
                    if (on || carried) { var tg = Text(nm, on ? "目前" : "帶著", 11, "#0a0810", true); tg.style.backgroundColor = on ? C(col) : C("#8ae0ff", 0.6f); tg.style.paddingLeft = tg.style.paddingRight = 4; tg.style.marginLeft = 6; }
                    var d0 = Text(info, SkillTree.FORM_DESC[id], 12, "#f2eefc"); d0.style.whiteSpace = WhiteSpace.Normal; d0.style.marginTop = 2;
                    if (!canEdit) continue;
                    var btns = Row(info); btns.style.marginTop = 4;
                    string fid = id;
                    if (carried)
                        W.IBtn(btns, "close", "放下", () =>
                        {
                            if (fid == cur) { W.Msg("正在用的形態不能放下", false); return; }
                            if (g.Carry.Length <= 1) { W.Msg("至少要帶一個", false); return; }
                            g.Carry = g.Carry.Where(f => f != fid).ToArray(); g.Sfx("ui"); onCarry?.Invoke(); W.Render();
                        }, "plain", false, fid == cur);
                    else
                        W.IBtn(btns, "check", "帶上", () =>
                        {
                            if (g.Carry.Length >= SkillTree.CARRY_MAX) { W.Msg($"最多帶 {SkillTree.CARRY_MAX} 個，先放下一個", false); return; }
                            g.Carry = g.Carry.Concat(new[] { fid }).ToArray(); g.Sfx("pickup"); onCarry?.Invoke(); W.Msg($"帶上{Game.FORM_NAME[fid]}"); W.Render();
                        }, "plain", false, g.Carry.Length >= SkillTree.CARRY_MAX);
                }
            }
            Action<VisualElement> Page(string id) => body =>
            {
                var T = SkillTree.TREES[id];
                var wrap = Row(body); wrap.style.alignItems = Align.FlexStart;
                var left = Box(wrap); left.style.flexGrow = 1; left.style.flexShrink = 1; left.style.marginRight = 8;
                // 上方：剩幾顆靈核、2 顆換一次屬性
                var head = Row(left); head.style.marginTop = 2; head.style.marginBottom = 6;
                Win.Ico(head, FormIcon(id)).style.marginRight = 4; Text(head, SkillTree.FreePts(g, id).ToString(), 16, "#ffe98a", true).style.marginRight = 4; Text(head, "靈核", 12, "#a59fbd");
                if (SkillTree.CORE_STAT.TryGetValue(id, out var cs))
                {
                    bool can = SkillTree.FreePts(g, id) >= SkillTree.CORE_COST;
                    var b = W.IBtn(head, cs.icon, $"{cs.label}（{SkillTree.CORE_COST} 靈核）", () =>
                    {
                        if (SkillTree.FreePts(g, id) < SkillTree.CORE_COST) { W.Msg("靈核不夠", false); return; }
                        g.CoreSpent[id] = (g.CoreSpent.TryGetValue(id, out var c) ? c : 0) + SkillTree.CORE_COST;
                        g.CoreBonus[cs.id] = Math.Round((g.CoreBonus.TryGetValue(cs.id, out var v) ? v : 0) + cs.v, 2);
                        g.Sfx("pickup"); W.Msg(cs.label); g.ApplyStats(); W.Render();
                    }, "plain", false, !can);
                    b.style.marginLeft = 10; b.style.height = 26; b.Q<Label>()?.style.SetFontSize(11);
                }
                var grid = Row(left); grid.style.alignItems = Align.Stretch;
                for (int p = 0; p < 3; p++) Col(grid, id, PathTitle(id, p), T.Where(n => n.Path == p), false);
                var pn = T.FirstOrDefault(n => n.Path == 4);
                if (pn != null) Col(grid, id, "被動", new[] { pn }, true);
                var cap = T.First(n => n.Path == 3);
                var capRow = Box(left); capRow.style.alignItems = Align.Center; capRow.style.marginTop = 8; capRow.style.marginBottom = 4;
                NodeEl(capRow, id, cap, false); Text(capRow, $"三條路線各投入 {SkillTree.CAP_NEED} 顆靈核解鎖", 12, "#a59fbd").style.marginTop = 6;
                // 右邊：選中的節點
                var info = Box(wrap); info.style.width = 180; info.style.flexShrink = 0; info.style.paddingLeft = info.style.paddingRight = 8; info.style.paddingTop = info.style.paddingBottom = 6;
                info.style.borderLeftWidth = 1; info.style.borderLeftColor = C("#7ae8ff", 0.25f); info.style.backgroundColor = C("#0a1428", 0.5f);
                var n0 = sel != null ? T.FirstOrDefault(x => x.Id == sel) : null;
                if (n0 != null)
                {
                    int r = g.Rank(id, n0.Id);
                    var tn = Row(info); tn.style.marginBottom = 6; Win.Ico(tn, n0.Icon, 28).style.marginRight = 6; Text(tn, n0.Name, 14, "#f2eefc", true).style.marginRight = 6; Text(tn, $"{r}/{n0.Max}", 12, "#ffe98a");
                    var td = Text(info, n0.Desc(Math.Max(1, r)), 12, "#d8f4ff"); td.style.whiteSpace = WhiteSpace.Normal; td.style.marginBottom = 6;
                    if (r < n0.Max) W.IBtn(info, "check", $"用 {SkillTree.CostOf(n0, r)} 顆靈核", () => Invest(g, id, n0), "go", false, !SkillTree.CanBuy(g, id, n0));
                    else Text(info, "MAX", 12, "#a8f0ff", true);
                }
                else Text(info, "點一個節點看說明", 12, "#a59fbd");
            };
            string PathTitle(string id, int p) => $"{SkillTree.PATHS[p]}<color=#ffe98a> {SkillTree.PathSpent(g, id, p)}</color>";
            void Col(VisualElement grid, string id, string title, IEnumerable<SkillTree.Node> nodes, bool pas)
            {
                var col = Box(grid); col.style.flexGrow = pas ? 0 : 1; col.style.flexBasis = 0; if (pas) col.style.paddingLeft = col.style.paddingRight = 8; col.style.marginRight = 6; col.style.alignItems = Align.Center;
                col.style.paddingTop = 2; col.style.paddingBottom = 4; col.style.backgroundColor = C("#0a1e32", 0.35f); Border(col, 1, C("#7ae8ff", 0.18f));
                var t = Text(col, title, 12, pas ? "#ffd24a" : "#9af0ff"); t.enableRichText = true; t.style.whiteSpace = WhiteSpace.NoWrap; t.style.letterSpacing = 2; t.style.marginBottom = 4;
                foreach (var n in nodes) NodeEl(col, id, n, pas);
            }
            void NodeEl(VisualElement p, string id, SkillTree.Node n, bool pas)
            {
                int r = g.Rank(id, n.Id); bool can = SkillTree.CanBuy(g, id, n);
                var el = Box(p); Size(el, 42, 42); el.style.flexShrink = 0; el.style.marginBottom = 8; el.style.alignItems = Align.Center; el.style.justifyContent = Justify.Center; el.pickingMode = PickingMode.Position;
                el.style.backgroundColor = C("#0c1626"); Border(el, 2, r > 0 ? C("#ffd84a") : can ? C("#7ae8ff") : C("#2a4a60"));
                var ic = Win.Ico(el, n.Icon, 32); if (r == 0) ic.style.unityBackgroundImageTintColor = can ? new Color(0.7f, 0.75f, 0.8f) : new Color(0.45f, 0.45f, 0.5f);
                if (sel == n.Id) { var o = Box(el); Abs(o, -5, -5, -5, -5); Border(o, 2, Color.white); }
                if (pas) { var o = Box(el); Abs(o, -4, -4, -4, -4); Border(o, 2, C("#ffd84a", 0.55f)); }
                var pip = Text(el, n.Max > 1 ? $"{r}/{n.Max}" : r > 0 ? "✓" : n.Cost.ToString(), 12, "#ffe98a", true); Abs(pip, null, null, -4, -6);
                pip.style.backgroundColor = C("#0a0810"); Border(pip, 1, C("#5a4a20")); pip.style.paddingLeft = pip.style.paddingRight = 2;
                el.AddManipulator(new Clickable(() => { if (sel == n.Id && SkillTree.CanBuy(g, id, n)) { Invest(g, id, n); return; } sel = n.Id; g.Sfx("ui"); W.Render(); }));
                el.userData = n.Id;
            }
            var tabs = new List<Win.Tab> { new Win.Tab { Id = "carry", Label = "形態", Icon = "core_slime", Render = CarryPage } };
            foreach (var id in owned) tabs.Add(new Win.Tab { Id = id, Label = Game.FORM_NAME[id], Icon = FormIcon(id), Render = Page(id) });
            string first = tab == "carry" ? "carry" : tab != null && owned.Contains(tab) ? tab : owned.Count > 0 ? owned[0] : "carry";
            return W.Show("形態技能樹", "sys", "star", tabs, first, false);   // 分頁多，不放金幣星塵
        }
        static void Invest(Game g, string id, SkillTree.Node n)
        {
            if (g.Rank(id, n.Id) >= n.Max) return;
            if (!SkillTree.Buy(g, id, n)) { g.Sfx("close"); W.Msg(n.Path == 3 ? $"三條路線各要投入 {SkillTree.CAP_NEED} 顆靈核" : "靈核不夠", false); return; }
            g.Sfx("levelup");
            VisualElement el = null; W.BodyQuery(e => { if (e.userData as string == n.Id) el = e; });
            if (el != null) TownWins.Fx?.At(el.worldBound.center, "collect-burst", new FxOptions { Palette = new[] { "#1a1430", Game.FORM_COLOR[id], Game.FORM_COLOR[id], "#ffffff" }, Light = 0.6 });
            W.Msg($"{n.Name} {g.Rank(id, n.Id)}/{n.Max}");
            g.ApplyStats(); W.Render();
        }
    }
    static class StyleExt2 { public static void SetFontSize(this IStyle s, float v) => s.fontSize = v; }
}
