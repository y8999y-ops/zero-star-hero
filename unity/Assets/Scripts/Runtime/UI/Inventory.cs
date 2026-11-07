// inventory.js：背包畫面（方案 A：手機電腦一樣三欄同時顯示，固定 760×360，等比縮放塞進螢幕）。
//   左：星星站在中間、7 件裝備在外圈的軌道上慢慢繞（HeroOrbit），下面是數值和戰力。
//   中：100 格背包（一排 5 格）、部位／稀有度篩選、整理、批量分解、拆垃圾、自動拆解。
//   右：選中物品的詳細資料（主屬性、副屬性、核心效果、獨特／神話／套裝說明）和按鈕；選背包裡的東西時，身上同部位那件蓋在左欄給你對照。
// 點一下選取，再點一次同一格＝穿上／卸下；也可以把背包裡的東西拖到身上的格子（或從身上拖回背包＝卸下）。I／B／Tab 開關，Esc 關閉。
using System;
using System.Collections.Generic;
using System.Linq;
using PixelFX;
using UnityEngine;
using UnityEngine.UIElements;
using static ZeroStar.UI.Ui;

namespace ZeroStar.UI
{
    public class Inventory
    {
        // ---- 網頁版 items.js 的說明文字（Unity 的 Items.cs 只有數值）
        static readonly Dictionary<string, (string text, string lore)> UNIQUE_TEXT = new Dictionary<string, (string, string)>
        {
            ["slipper"] = ("閃避後的下一擊必定暴擊；閃避距離 +50%", "前任冒險者逃跑時掉的。跑得很快。"),
            ["overtime"] = ("戰鬥越久傷害越高：每 10 秒 +5%，上限 +100%，戰鬥結束歸零", "公會的通宵委託單。上面蓋著「明天再說」的章。"),
            ["noisy"] = ("", "「拜託你認真打好嗎。」"),
            ["hardhat"] = ("擊殺時 25% 機率爆炸", "矮人礦工頭的遺物。坑道施工中，請勿靠近。"),
        };
        static string MythText(string id, int st) => id == "starking"
            ? $"放完大招後 {(st >= 2 ? 12 : 8)} 秒「星王化」：全身發光、傷害 +20%{(st >= 3 ? "；星王化開始時退回一半的大招魔力" : "")}"
            : $"每次切換形態，原地爆出「前一個形態」的元素（範圍 {(st >= 2 ? 60 : 40)}、攻擊力 {(st >= 3 ? 160 : 80)}%）";
        static readonly Dictionary<string, (string f, string t)[]> MYTH_FORMS = new Dictionary<string, (string, string)[]>
        {
            ["starking"] = new[] { ("star", "星屑彈一次射 3 發"), ("slime", "黏液彈爆開時連火一起點（直接大火）"), ("can", "衝撞沒有冷卻"), ("spike", "刺球衝刺沒有冷卻"), ("bat", "可以一直飛（滑翔不會往下掉、飛行沒有冷卻）") },
            ["fallheart"] = new[] { ("star", "爆出星火（燃燒）"), ("slime", "爆出黏液"), ("can", "爆出電流（帶電）"), ("spike", "爆出一圈星光"), ("bat", "爆出毒霧（中毒）") },
        };
        static readonly Dictionary<string, string[]> MYTH_LORE = new Dictionary<string, string[]>
        {
            ["starking"] = new[] { "王冠內側刻著一行小字：「給最亮的那一顆」。", "你聽見王冠裡有人在數數：一、二、三……數到第九就停了。九顆星星？", "星王沒有死。祂只是碎成了很多很多片——其中一片，正戴著祂的王冠。" },
            ["fallheart"] = new[] { "一顆還在跳動的星星碎片。摸起來是溫的。", "它跳動的節奏，跟你切換形態的節奏一模一樣。", "這是星王的心。祂把心留給了下一顆星星——也就是你。" },
        };
        static readonly Dictionary<string, (string name, string color, string emblem, string two, string four)> SET_INFO = new Dictionary<string, (string, string, string, string, string)>
        {
            ["meteor"] = ("流星獵手", "#ff9a4a", "set_meteor", "暴擊率 +8%", "暴擊打中的敵人被標上流星記號；5 秒內再暴擊牠，天上掉一顆小流星砸下去（攻擊力 80%）"),
            ["reson"] = ("星辰共鳴", "#7ae8ff", "set_reson", "魔力回復 +15%", "放完大招後 10 秒內，技能冷卻 -30%、技能傷害 +25%"),
            ["feast"] = ("夜宴", "#ff5a7a", "set_feast", "吸血 +2%", "生命低於 30% 時吸血加倍；生命已滿時，多吸的血變成護盾（最多最大生命的 20%）"),
        };
        static readonly string[] AUTO = { "關", "垃圾", "普通以下" };
        static readonly Dictionary<string, int> KIND_ORDER = new Dictionary<string, int> { ["weapon"] = 0, ["head"] = 1, ["body"] = 2, ["hands"] = 3, ["feet"] = 4, ["acc"] = 5, ["junk"] = 6 };
        static readonly Dictionary<string, string> STAT_ICON = new Dictionary<string, string> { ["atk"] = "st_atk", ["atkPct"] = "st_atk", ["hp"] = "st_hp", ["hpPct"] = "st_hp", ["maxHp"] = "st_hp", ["def"] = "st_def", ["crit"] = "st_crit", ["critDmg"] = "st_critDmg", ["skill"] = "st_skill", ["ult"] = "st_ult", ["charge"] = "st_charge", ["cdr"] = "st_cdr", ["leech"] = "st_leech", ["move"] = "st_move", ["mf"] = "st_mf" };
        static readonly string[] SLOTS = { "weapon", "head", "body", "hands", "feet", "acc1", "acc2" };
        static readonly Dictionary<string, string> SLOT_NAME = new Dictionary<string, string> { ["weapon"] = "星核", ["head"] = "星冠", ["body"] = "星殼", ["hands"] = "星爪", ["feet"] = "星靴", ["acc1"] = "碎片", ["acc2"] = "碎片" };
        static readonly Dictionary<string, string> SLOT_ICON = new Dictionary<string, string> { ["weapon"] = "core_dawn", ["head"] = "crown", ["body"] = "star", ["hands"] = "glove", ["feet"] = "boot", ["acc1"] = "shard", ["acc2"] = "shard" };
        static readonly (string k, string ic, string n)[] PARTS = { ("all", null, "全部"), ("weapon", "core_dawn", "星核"), ("head", "crown", "頭"), ("body", "star", "身體"), ("hands", "glove", "手"), ("feet", "boot", "腳"), ("acc", "shard", "碎片") };
        static double Reduction(double def) => def / (def + 60);
        static string N(double v) => v.ToString("0.##");
        // 數值欄：攻擊力、生命、防禦、暴擊率、暴擊傷害一定顯示，其他有數值才在「更多」裡
        static readonly (string k, string n, Func<Stats, double> v, Func<double, string> f)[] STAT_ROWS =
        {
            ("atk", "攻擊力", s => s.Atk, v => N(v)), ("maxHp", "生命", s => s.MaxHp, v => N(v)),
            ("def", "防禦", s => s.Def, v => $"{N(v)}<size=11><color=#a59fbd> -{Math.Round(Reduction(v) * 100, MidpointRounding.AwayFromZero)}%</color></size>"),
            ("crit", "暴擊率", s => s.Crit, v => N(v) + "%"), ("critDmg", "暴擊傷害", s => s.CritDmg, v => "+" + N(v) + "%"),
            ("skill", "技能傷害", s => s.Skill, v => "+" + N(v) + "%"), ("ult", "大招傷害", s => s.Ult, v => "+" + N(v) + "%"),
            ("charge", "魔力回復", s => s.Charge, v => "+" + N(v) + "%"), ("cdr", "技能冷卻", s => s.Cdr, v => "-" + N(v) + "%"),
            ("leech", "吸血", s => s.Leech, v => N(v) + "%"), ("move", "移速", s => s.Move, v => "+" + N(v) + "%"), ("mf", "掉寶率", s => s.Mf, v => "+" + N(v) + "%"),
        };

        readonly VisualElement overlay, box, dollEl, orbitEl, statsEl, gridView, gridEl, filterPart, filterRar, bagBtns, batchBtns, detail, cmpEl, ghost;
        readonly Label lvEl, xpText, bagN, coinsEl, scrapEl, sayEl, autoBtnLabel, batchGoLabel; readonly VisualElement xpFill;
        readonly Scroller gridScroll, detailScroll;
        readonly Dictionary<string, VisualElement> slotEls = new Dictionary<string, VisualElement>();
        readonly List<VisualElement> cells = new List<VisualElement>();
        Game g; public UiFx Fx; public Action<string> Sfx; public Action OnChange;
        public bool Open { get; private set; }
        (string where, int i, string slot)? sel;
        string fPart = "all"; int fRar = -1; bool batch, warned, moreStats;
        readonly HashSet<Item> picked = new HashSet<Item>();
        float openT = 9, sayT, spin, clock; Dictionary<string, int> prevSets;
        readonly Frame orbitFrame = new Frame(113, 104), starFrame = new Frame(48, 64);
        readonly Texture2D orbitTex = new Texture2D(113, 104, TextureFormat.RGBA32, false) { filterMode = FilterMode.Point }; byte[] orbitRgba = new byte[113 * 104 * 4], orbitFlip = new byte[113 * 104 * 4];
        static Texture2D lockTex;

        public Inventory(VisualElement parent)
        {
            overlay = Box(parent, "inv"); Abs(overlay, 0, 0, 0, 0); overlay.style.backgroundColor = C("#06040c", 0.72f); overlay.style.display = DisplayStyle.None;
            overlay.pickingMode = PickingMode.Position;
            overlay.RegisterCallback<PointerDownEvent>(e => { if (e.target == overlay) Close(); });
            box = Box(overlay, "invBox"); Size(box, 760, 360); Abs(box); box.style.left = Length.Percent(50); box.style.top = Length.Percent(50);
            box.style.marginLeft = -380; box.style.marginTop = -180; box.style.flexDirection = FlexDirection.Row;

            // ---- 左：星星、裝備軌道、數值
            var hero = Pane(250);
            var ttl = Row(hero); Text(ttl, "星靈", 15, "#ffd24a", true, 2).style.letterSpacing = 2; lvEl = Text(ttl, "Lv 1", 14, "#a59fbd"); lvEl.style.marginLeft = 8;
            var xp = Box(hero); xp.style.height = 8; xp.style.backgroundColor = C("#120e1c"); Border(xp, 1, C("#000000")); xp.style.marginTop = 6; xp.style.flexShrink = 0;
            xpFill = Box(xp); Abs(xpFill, 0, 0, null, 0); Stretch(xpFill, Gen(1, 2, (x, y) => C(y == 0 ? "#a8e8ff" : "#3a9ae0"))); xpFill.style.backgroundImage.value.texture.filterMode = FilterMode.Point;
            xpText = Text(xp, "", 12, "#ffffff", false, 1); Abs(xpText, null, -5, 2);
            dollEl = Box(hero, "doll"); Size(dollEl, 226, 208); dollEl.style.alignSelf = Align.Center; dollEl.style.marginTop = 2; dollEl.style.flexShrink = 0;
            orbitEl = Box(dollEl); Abs(orbitEl, 0, 0); Size(orbitEl, 226, 208); Stretch(orbitEl, orbitTex); orbitEl.style.scale = new Scale(new Vector2(1, -1));
            foreach (var s in SLOTS)
            {
                var el = SlotEl(dollEl, 40); Abs(el); el.style.translate = new Translate(Length.Percent(-50), Length.Percent(-50));
                string slot = s; el.RegisterCallback<PointerDownEvent>(e => StartDrag(e, ("equip", -1, slot)));
                el.RegisterCallback<PointerUpEvent>(e => { if (!dragMoved) Pick(("equip", -1, slot)); });
                slotEls[s] = el;
            }
            statsEl = Box(hero); statsEl.style.flexDirection = FlexDirection.Row; statsEl.style.flexWrap = Wrap.Wrap; statsEl.style.marginTop = 6;

            // ---- 中：背包
            var bag = Pane(316); bag.style.marginLeft = bag.style.marginRight = 4;
            var bt = Row(bag); Text(bt, "背包", 15, "#ffd24a", true, 2).style.letterSpacing = 2; bagN = Text(bt, "", 14, "#a59fbd"); bagN.style.marginLeft = 8;
            var cur = Row(bt); cur.style.marginLeft = StyleKeyword.Auto; Win.Ico(cur, "coin", 14).style.marginRight = 3; coinsEl = Text(cur, "", 12, "#f2eefc"); coinsEl.style.marginRight = 6;
            Win.Ico(cur, "scrap", 14).style.marginRight = 3; scrapEl = Text(cur, "", 12, "#f2eefc");
            filterPart = Row(bag); filterPart.style.justifyContent = Justify.Center; filterPart.style.marginTop = 6;
            filterRar = Row(bag); filterRar.style.justifyContent = Justify.Center; filterRar.style.marginTop = 2; filterRar.style.marginBottom = 6;
            foreach (var (k, ic, n) in PARTS) { string key = k; FBtn(filterPart, ic, ic == null ? "全" : null, null, () => { fPart = key; Render(); }).userData = "p:" + k; }
            FBtn(filterRar, null, "全", null, () => { fRar = -1; Render(); }).userData = "r:-1";
            for (int i = 0; i < Items.RARITY.Length; i++) { int r = i; FBtn(filterRar, null, null, Items.RARITY[i].Color, () => { fRar = r; Render(); }).userData = "r:" + i; }
            gridScroll = new Scroller(bag); gridView = gridScroll.View;
            gridEl = gridScroll.Content; gridEl.style.flexDirection = FlexDirection.Row; gridEl.style.flexWrap = Wrap.Wrap; gridEl.style.width = 5 * 54 + 4 * 3; gridEl.style.left = (316 - 24 - (5 * 54 + 4 * 3)) / 2f;
            for (int i = 0; i < Items.BAG_SIZE; i++)
            {
                var el = SlotEl(gridEl, 54); el.style.marginRight = (i % 5 == 4) ? 0 : 3; el.style.marginBottom = 3;
                var cell = el; el.RegisterCallback<PointerDownEvent>(e => { if (!batch && cell.userData is int k && k >= 0) StartDrag(e, ("bag", k, null)); });
                el.RegisterCallback<PointerUpEvent>(e => { if (dragMoved) return; Pick(("bag", cell.userData is int k ? k : -1, null)); });
                cells.Add(el);
            }
            bagBtns = Row(bag); bagBtns.style.justifyContent = Justify.Center; bagBtns.style.marginTop = 6; bagBtns.style.flexShrink = 0;
            PBtn(bagBtns, "整理", "plain", Sort); PBtn(bagBtns, "批量分解", "plain", () => { SetBatch(true); Say("點要分解的物品打勾，再按「分解」。鎖定的不會被選到。"); });
            PBtn(bagBtns, "拆垃圾", "red", SalvageAll); autoBtnLabel = PBtn(bagBtns, "自動：關", "plain", () => { g.Auto = (g.Auto + 1) % AUTO.Length; Changed(); }).Q<Label>();
            batchBtns = Row(bag); batchBtns.style.justifyContent = Justify.Center; batchBtns.style.marginTop = 6; batchBtns.style.flexShrink = 0;
            PBtn(batchBtns, "全選", "plain", PickAll); PBtn(batchBtns, "取消", "plain", () => SetBatch(false)); batchGoLabel = PBtn(batchBtns, "分解 0 件", "red", BatchGo).Q<Label>();
            sayEl = Text(bag, "", 12, "#ffd24a", false, 1); Abs(sayEl, 0, null, 0, 34); sayEl.style.unityTextAlign = TextAnchor.MiddleCenter; sayEl.style.opacity = 0; sayEl.style.whiteSpace = WhiteSpace.Normal;

            // ---- 右：詳細
            var det = Pane(186);
            detailScroll = new Scroller(det); detail = detailScroll.Content;
            // 替換對比：身上同部位那件，半透明蓋在左欄（點一下收起來）
            cmpEl = Box(box, "invCmp"); Abs(cmpEl, 0, 0, null, 0); cmpEl.style.width = 250; cmpEl.style.paddingLeft = cmpEl.style.paddingRight = cmpEl.style.paddingTop = cmpEl.style.paddingBottom = 14;
            cmpEl.style.backgroundColor = C("#0c081a", 0.86f); Border(cmpEl, 2, C("#c9a258", 0.7f)); cmpEl.style.display = DisplayStyle.None; cmpEl.pickingMode = PickingMode.Position;
            cmpEl.RegisterCallback<PointerDownEvent>(e => { e.StopPropagation(); sel = null; Render(); });
            // 關閉鈕
            var x = Box(box, "invClose"); Abs(x, null, -4, -4); Size(x, 32, 32); x.style.backgroundColor = C("#1d1730"); Border(x, 2, C("#0a0810")); x.pickingMode = PickingMode.Position;
            var xi = Box(x); Abs(xi, 0, 0, 0, 0); Img(xi, "ic-close"); x.AddManipulator(new Clickable(Close));
            // 拖動時跟著手指的圖示
            ghost = Box(overlay, "dragGhost"); Abs(ghost); Size(ghost, 36, 36); ghost.style.display = DisplayStyle.None; ghost.style.translate = new Translate(Length.Percent(-50), Length.Percent(-50));
            overlay.RegisterCallback<PointerMoveEvent>(DragMove, TrickleDown.TrickleDown);
            overlay.RegisterCallback<PointerUpEvent>(DragEnd, TrickleDown.TrickleDown);
        }

        // ---- 小零件
        VisualElement Pane(float w)
        {
            var p = Box(box); Nine(p, "panel", 12, 12); p.style.width = w; p.style.height = Length.Percent(100); p.style.flexShrink = 0; p.style.flexDirection = FlexDirection.Column;
            if (w == 186) p.style.flexGrow = 1;
            return p;
        }
        static VisualElement Row(VisualElement p) { var r = Box(p); r.style.flexDirection = FlexDirection.Row; r.style.alignItems = Align.Center; r.style.flexShrink = 0; return r; }
        static VisualElement SlotEl(VisualElement p, float size)
        {
            var el = Box(p); Size(el, size, size); el.style.flexShrink = 0; Img(el, "slot-empty"); el.pickingMode = PickingMode.Position;
            el.style.alignItems = Align.Center; el.style.justifyContent = Justify.Center;
            var ic = Box(el, "ic"); Size(ic, size * 0.8f, size * 0.8f); ic.pickingMode = PickingMode.Ignore;
            return el;
        }
        VisualElement FBtn(VisualElement p, string icon, string text, string dot, Action on)
        {
            var b = Box(p); Size(b, 38, 22); b.style.marginLeft = b.style.marginRight = 1; b.style.backgroundColor = C("#1a1430"); Border(b, 2, C("#3a2f52"));
            b.style.alignItems = Align.Center; b.style.justifyContent = Justify.Center; b.pickingMode = PickingMode.Position;
            if (icon != null) Win.Ico(b, icon, 16);
            if (text != null) Text(b, text, 12, "#a59fbd", true);
            if (dot != null) { var d = Box(b); Size(d, 10, 10); d.style.backgroundColor = C(dot); Border(d, 1, C("#000000")); }
            b.AddManipulator(new Clickable(() => { Sfx?.Invoke("ui"); on(); }));
            return b;
        }
        static VisualElement PBtn(VisualElement p, string label, string kind, Action on)
        {
            string skin = kind == "red" ? "b-bad" : kind == "plain" ? "b-plain" : "b-go";
            var b = Box(p); b.style.height = 30; Nine(b, skin + "-n", 8, 8); b.style.paddingLeft = b.style.paddingRight = 8 + 3; b.style.marginLeft = b.style.marginRight = 2;
            b.style.alignItems = Align.Center; b.style.justifyContent = Justify.Center; b.pickingMode = PickingMode.Position; b.style.flexShrink = 1;
            var l = Text(b, label, 12, kind == "red" ? "#fff2ec" : kind == "plain" ? "#f4eeff" : "#3a1c04", true, 1, kind == "red" ? "#5a0c1a" : kind == "plain" ? "#261c44" : "#fff6c880");
            l.enableRichText = true; l.style.whiteSpace = WhiteSpace.NoWrap;
            b.RegisterCallback<PointerEnterEvent>(e => Nine(b, skin + "-h", 8, 8)); b.RegisterCallback<PointerLeaveEvent>(e => Nine(b, skin + "-n", 8, 8));
            b.AddManipulator(new Clickable(on));
            return b;
        }
        static Texture2D LockTex()
        {
            if (lockTex != null) return lockTex;
            string[] rows = { ".dddddd".Substring(0, 0) };
            var px = new Color32[7 * 9]; Color32 D = C("#140c20"), L = C("#fff6c8"), G = C("#ffd84a"), O = C("#c8861a");
            void S(int x, int y, Color32 c) => px[(8 - y) * 7 + x] = c;
            for (int y = 1; y <= 8; y++) { S(0, y, D); S(6, y, D); }
            foreach (var (x, ys) in new[] { (1, new[] { 0, 1, 8 }), (2, new[] { 0, 2, 3, 8 }), (3, new[] { 0, 2, 3, 5, 6, 8 }), (4, new[] { 0, 2, 3, 8 }), (5, new[] { 0, 1, 8 }) }) foreach (var y in ys) S(x, y, D);
            foreach (var (x, y) in new[] { (1, 2), (2, 1), (3, 1), (4, 1), (5, 2) }) S(x, y, L);
            for (int y = 3; y <= 7; y++) S(1, y, G); for (int y = 4; y <= 7; y++) S(2, y, G); S(3, 4, G); S(3, 7, G);
            for (int y = 4; y <= 7; y++) S(4, y, O); for (int y = 3; y <= 7; y++) S(5, y, O);
            lockTex = new Texture2D(7, 9, TextureFormat.RGBA32, false) { filterMode = FilterMode.Point }; lockTex.SetPixels32(px); lockTex.Apply();
            return lockTex;
        }
        static void Badge(VisualElement cell, string text, string color, float? l, float? t, float? r, float? b, float size = 13)
        {
            var e = Text(cell, text, size, color, true, 1); Abs(e, l, t, r, b); e.style.textShadow = new TextShadow { offset = new Vector2(1, 1), color = Color.black };
        }

        // ---- 開關
        public void Show(Game game)
        {
            g = game; if (Open) return;
            Open = true; overlay.style.display = DisplayStyle.Flex; Sfx?.Invoke("open"); openT = 0; prevSets = null; prevStats = null;
            Render();
        }
        public void Close()
        {
            if (!Open) return;
            Open = false; overlay.style.display = DisplayStyle.None; Sfx?.Invoke("close"); sel = null; if (batch) SetBatch(false);
            g?.ApplyStats();
        }
        /// 開發用（-uidemo）：選背包第 i 格
        public void Select(int i) { sel = ("bag", i, null); Render(); }
        void Say(string msg) { sayEl.text = msg; sayT = 2.6f; }
        void Changed() { g.ApplyStats(); OnChange?.Invoke(); Render(); }

        Item ItemAt((string where, int i, string slot)? s) => s == null ? null : s.Value.where == "bag" ? (s.Value.i >= 0 && s.Value.i < g.Inv.Count ? g.Inv[s.Value.i] : null) : g.Equip[s.Value.slot];
        bool Same((string where, int i, string slot)? a, (string where, int i, string slot) b) => a != null && a.Value.where == b.where && a.Value.i == b.i && a.Value.slot == b.slot;

        void Pick((string where, int i, string slot) s)
        {
            if (batch && s.where == "bag")
            {
                var it0 = ItemAt(s); if (it0 == null) return;
                if (g.Locked.Contains(it0)) { Sfx?.Invoke("close"); Say("鎖定的不能分解。"); return; }
                if (!picked.Remove(it0)) picked.Add(it0);
                warned = false; Sfx?.Invoke("ui"); Render(); return;
            }
            var it = ItemAt(s);
            if (Same(sel, s) && it != null) { if (s.where == "bag") Equip(s.i); else Unequip(s.slot); return; }   // 點同一格第二次：穿上／卸下
            sel = it != null ? s : ((string, int, string)?)null;
            if (it != null) it.New = false;
            Render();
        }
        static string[] SlotsFor(Item it) => it == null || it.Kind == "junk" ? new string[0] : it.Kind == "acc" ? new[] { "acc1", "acc2" } : new[] { it.Kind };
        void Equip(int i, string slot = null)
        {
            var it = g.Inv[i]; if (it == null || it.Kind == "junk" || it.Kind == "formcore") return;
            slot = slot ?? Items.Compare(it, g.Equip, g.Lv)?.slot; if (slot == null) return;
            var old = g.Equip[slot]; g.Equip[slot] = it;
            if (old != null) g.Inv[i] = old; else g.Inv.RemoveAt(i);
            sel = ("equip", -1, slot); Sfx?.Invoke("pickup"); Changed();
        }
        void Unequip(string slot)
        {
            if (slot == "weapon") { Say("星核不能拿出來。那是你的心臟欸。"); return; }
            if (g.Inv.Count >= Items.BAG_SIZE) { Say("背包滿了，卸不下來。"); return; }
            g.Inv.Add(g.Equip[slot]); g.Equip[slot] = null;
            sel = ("bag", g.Inv.Count - 1, null); Changed();
        }
        void SalvageSel()
        {
            var it = ItemAt(sel); if (it == null || sel.Value.where != "bag") return;
            if (g.Locked.Contains(it)) { Say("鎖定中，先解鎖才能拆。"); return; }
            var r = Items.RARITY[it.Rarity]; g.Scrap += r.Scrap; g.Money += r.Coin; g.Inv.RemoveAt(sel.Value.i); sel = null;
            Say($"拆解 {it.Name}：星塵 +{r.Scrap}，金幣 +{r.Coin}"); Changed();
        }
        void Sort() { g.Inv.Sort((a, b) => KIND_ORDER[a.Kind] != KIND_ORDER[b.Kind] ? KIND_ORDER[a.Kind] - KIND_ORDER[b.Kind] : b.Rarity != a.Rarity ? b.Rarity - a.Rarity : b.Ilvl - a.Ilvl); sel = null; Sfx?.Invoke("ui"); Changed(); }
        void SalvageAll()
        {
            int n = 0, scrap = 0, coin = 0;
            g.Inv.RemoveAll(it =>
            {
                bool bad = !g.Locked.Contains(it) && it.Rarity <= Items.COMMON && !(Items.Compare(it, g.Equip, g.Lv)?.better ?? false);
                if (bad) { n++; scrap += Items.RARITY[it.Rarity].Scrap; coin += Items.RARITY[it.Rarity].Coin; }
                return bad;
            });
            g.Scrap += scrap; g.Money += coin; sel = null;
            Say(n > 0 ? $"拆解了 {n} 件垃圾和普通裝備：星塵 +{scrap}，金幣 +{coin}" : "沒有可以拆的東西（比身上好的不會拆）。");
            Changed();
        }
        bool MatchF(Item it) => (fPart == "all" || it.Kind == fPart) && (fRar < 0 || (it.Kind != "junk" && it.Rarity == fRar));
        void SetBatch(bool on) { batch = on; picked.Clear(); warned = false; sel = null; Render(); }
        void PickAll()
        {
            Sfx?.Invoke("ui");
            var all = g.Inv.Where(it => MatchF(it) && !g.Locked.Contains(it)).ToList();
            if (all.All(picked.Contains)) foreach (var it in all) picked.Remove(it); else foreach (var it in all) picked.Add(it);
            warned = false; Render();
        }
        void BatchGo()
        {
            if (picked.Count == 0) { Say("還沒選東西。"); return; }
            int better = picked.Count(it => it.Kind != "junk" && (Items.Compare(it, g.Equip, g.Lv)?.better ?? false));
            if (better > 0 && !warned) { warned = true; Sfx?.Invoke("close"); Say($"選到 {better} 件比身上好的（▲），確定要拆就再按一次。"); return; }
            int n = 0, scrap = 0, coin = 0;
            g.Inv.RemoveAll(it => { if (!picked.Contains(it) || g.Locked.Contains(it)) return false; n++; scrap += Items.RARITY[it.Rarity].Scrap; coin += Items.RARITY[it.Rarity].Coin; return true; });
            g.Scrap += scrap; g.Money += coin; Sfx?.Invoke("chime");
            var r = batchBtns.worldBound; Fx?.At(new Vector2(r.center.x, r.yMin), "collect-burst", new FxOptions { Palette = new[] { "#0c2a60", "#3ab8f0", "#9af0ff", "#ffffff" }, Light = 0.5, Seed = n });
            SetBatch(false); Say($"分解了 {n} 件：星塵 +{scrap}，金幣 +{coin}"); g.ApplyStats(); OnChange?.Invoke();
        }

        // ---- 拖動：從背包拖到身上的格子（對應的格子會亮），或從身上拖回背包＝卸下
        (string where, int i, string slot)? dragFrom; Item dragIt; Vector2 drag0; int dragId = -1; bool dragMoved;
        void StartDrag(PointerDownEvent e, (string where, int i, string slot) from)
        {
            dragMoved = false; var it = ItemAt(from); if (it == null || e.button > 0) return;
            dragFrom = from; dragIt = it; drag0 = e.position; dragId = e.pointerId;
        }
        void DragMove(PointerMoveEvent e)
        {
            if (dragId != e.pointerId || dragIt == null) return;
            if (!dragMoved) { if (Vector2.Distance(e.position, drag0) < 6) return; dragMoved = true; ghost.style.display = DisplayStyle.Flex; Img(ghost, "icons/" + dragIt.Icon); }
            var p = overlay.WorldToLocal(e.position); ghost.style.left = p.x; ghost.style.top = p.y;
            foreach (var kv in slotEls) kv.Value.style.unityBackgroundImageTintColor = dragFrom.Value.where == "bag" && SlotsFor(dragIt).Contains(kv.Key) ? (kv.Value.worldBound.Contains(e.position) ? C("#fff0a0") : C("#ffe680")) : Color.white;
        }
        void DragEnd(PointerUpEvent e)
        {
            if (dragId != e.pointerId) return;
            dragId = -1; var from = dragFrom; var it = dragIt; dragIt = null;
            foreach (var kv in slotEls) kv.Value.style.unityBackgroundImageTintColor = Color.white;
            if (!dragMoved) return;
            ghost.style.display = DisplayStyle.None;
            if (from.Value.where == "bag") { foreach (var s in SlotsFor(it)) if (slotEls[s].worldBound.Contains(e.position)) { Equip(from.Value.i, s); break; } }
            else if (from.Value.slot != "weapon" && gridView.worldBound.Contains(e.position)) Unequip(from.Value.slot);
            overlay.schedule.Execute(() => dragMoved = false);
        }

        // ---- 畫
        Stats prevStats; double prevPw;
        void SetSlot(VisualElement el, Item it, bool selOn)
        {
            Img(el, it == null ? "slot-empty" : selOn ? "slot-sel" : "slot-" + it.Rarity);
            var ic = el.Q("ic"); var t = it != null ? Tex("icons/" + it.Icon) : null;
            ic.style.backgroundImage = t; ic.style.backgroundSize = new BackgroundSize(BackgroundSizeType.Contain); ic.style.unityBackgroundImageTintColor = Color.white; ic.style.opacity = 1;
        }
        public void Render()
        {
            if (!Open) return;
            var st = Items.ComputeStats(g.Equip, g.Lv, g.CoreBonus);
            lvEl.text = "Lv " + g.Lv;
            xpFill.style.width = Length.Percent(g.Lv >= Items.MAX_LV ? 100 : (float)(g.Xp / Items.XpNeed(g.Lv)) * 100);
            xpText.text = g.Lv >= Items.MAX_LV ? "MAX" : $"{g.Xp} / {Items.XpNeed(g.Lv)}";
            foreach (var s in SLOTS)
            {
                var el = slotEls[s]; var it = g.Equip[s];
                SetSlot(el, it, sel != null && sel.Value.where == "equip" && sel.Value.slot == s);
                if (it == null) { var ic = el.Q("ic"); Img(ic, "icons/" + SLOT_ICON[s]); ic.style.unityBackgroundImageTintColor = C("#2a2340"); }
            }
            // 背包格：篩選後的清單；沒篩選時空格也畫出來，有篩選時只補滿最後一排
            var view = Enumerable.Range(0, g.Inv.Count).Where(i => MatchF(g.Inv[i])).ToList();
            bool filtering = fPart != "all" || fRar >= 0; int shown = filtering ? Math.Max(5, (int)Math.Ceiling(view.Count / 5.0) * 5) : Items.BAG_SIZE;
            for (int c = 0; c < cells.Count; c++)
            {
                var el = cells[c]; int? i = c < view.Count ? view[c] : (int?)null; var it = i != null ? g.Inv[i.Value] : null;
                el.style.display = c < shown ? DisplayStyle.Flex : DisplayStyle.None;
                el.userData = i ?? -1;
                foreach (var b in el.Children().Where(x => x.name != "ic").ToList()) b.RemoveFromHierarchy();
                SetSlot(el, it, it != null && sel != null && sel.Value.where == "bag" && sel.Value.i == i);
                if (it == null) continue;
                if (batch && !picked.Contains(it)) el.Q("ic").style.opacity = 0.75f;
                if (picked.Contains(it)) { Border(el, 2, C("#ff7a5a")); Badge(el, "✓", "#ff9a7a", null, 2, 4, null, 14); } else Border(el, 0, Color.clear);
                if (it.New) Badge(el, "!", "#ffd24a", 4, 1, null, null);
                if (Items.Compare(it, g.Equip, g.Lv)?.better == true) Badge(el, "▲", "#3ad06a", null, null, 3, 1);
                if (g.Locked.Contains(it)) { var lk = Box(el); Abs(lk, 3, null, null, 3); Size(lk, 14, 18); lk.style.backgroundImage = LockTex(); lk.style.backgroundSize = new BackgroundSize(Length.Percent(100), Length.Percent(100)); }
            }
            gridScroll.Update();
            bagN.text = $"{g.Inv.Count} / {Items.BAG_SIZE}";
            foreach (var b in filterPart.Children().Concat(filterRar.Children()))
            {
                bool on = b.userData is string u && (u == "p:" + fPart || u == "r:" + fRar);
                b.style.backgroundColor = on ? C("#2a2040") : C("#1a1430"); Border(b, 2, on ? C("#ffd24a") : C("#3a2f52"));
            }
            bagBtns.style.display = batch ? DisplayStyle.None : DisplayStyle.Flex; batchBtns.style.display = batch ? DisplayStyle.Flex : DisplayStyle.None;
            if (batch) { int sc = picked.Sum(it => Items.RARITY[it.Rarity].Scrap); batchGoLabel.text = $"分解 {picked.Count} 件 <size=11>+{sc}星塵</size>"; }
            coinsEl.text = g.Money.ToString(); scrapEl.text = g.Scrap.ToString();
            autoBtnLabel.text = "自動：" + AUTO[g.Auto];
            // 數值：圖示＋數字（三欄），前 5 個一定顯示，其他按「更多」展開
            statsEl.Clear();
            var extra = STAT_ROWS.Skip(5).Where(r => r.v(st) != 0).ToList();
            foreach (var (row, idx) in STAT_ROWS.Select((r, i) => (r, i)))
            {
                if (idx >= 5 && !(moreStats && row.v(st) != 0)) continue;
                var c = Row(statsEl); c.style.width = Length.Percent(33.3f); c.style.height = 15;
                if (STAT_ICON.TryGetValue(row.k, out var ic)) Win.Ico(c, ic, 12).style.marginRight = 3;
                var l = Text(c, row.f(row.v(st)), 12, "#f2eefc", true); l.enableRichText = true; l.style.whiteSpace = WhiteSpace.NoWrap;
                if (prevStats != null && row.v(prevStats) != row.v(st)) l.style.color = C(row.v(st) > row.v(prevStats) ? "#fff6c0" : "#ff8a7a");
            }
            if (extra.Count > 0)
            {
                var m = Box(statsEl); m.style.width = Length.Percent(100); m.pickingMode = PickingMode.Position;
                var ml = Text(m, moreStats ? "收起" : $"更多 ＋{extra.Count}", 12, "#ffd24a"); ml.style.alignSelf = Align.FlexStart; Border(ml, 1, C("#5a4a20")); ml.style.paddingLeft = ml.style.paddingRight = 6;
                m.AddManipulator(new Clickable(() => { moreStats = !moreStats; Render(); }));
            }
            double pw = Math.Round(Items.Power(st) * 10, MidpointRounding.AwayFromZero);
            var pwRow = Row(statsEl); pwRow.style.width = Length.Percent(100); pwRow.style.borderTopWidth = 1; pwRow.style.borderTopColor = C("#3a2f52"); pwRow.style.marginTop = 2; pwRow.style.justifyContent = Justify.SpaceBetween;
            Text(pwRow, "戰力", 12, "#a59fbd"); Text(pwRow, pw.ToString(), 12, prevStats != null && pw != prevPw ? (pw > prevPw ? "#fff6c0" : "#ff8a7a") : "#ffd24a", true);
            prevStats = st; prevPw = pw;
            // 套裝湊到 2 件或 4 件的那一下：人像那邊爆一圈套裝顏色的光
            var sc2 = Items.SetCounts(g.Equip);
            if (prevSets != null) foreach (var kv in sc2)
            {
                int was = prevSets.TryGetValue(kv.Key, out var w) ? w : 0, hit = was < 4 && kv.Value >= 4 ? 4 : was < 2 && kv.Value >= 2 ? 2 : 0;
                if (hit == 0) continue;
                var S = SET_INFO[kv.Key]; var c = dollEl.worldBound.center;
                Fx?.At(c, "collect-burst", new FxOptions { Palette = new[] { "#1a1430", S.color, S.color, "#ffffff" }, Light = 0.7, Seed = kv.Value });
                if (hit == 4) Fx?.At(c, "collect-burst", new FxOptions { Palette = new[] { "#1a1430", S.color, "#fff0a0", "#ffffff" }, Light = 0.8, Seed = 9 }, 0.2f);
                Say($"套裝「{S.name}」{hit} 件效果啟動！"); Sfx?.Invoke("levelup");
            }
            prevSets = sc2;
            RenderDetail();
        }

        /// 一件裝備的資料：名稱、主屬性、副屬性、核心效果、獨特效果（右邊詳細和左邊對比共用）
        void ItemCard(VisualElement p, Item it)
        {
            var head = Row(p); head.style.marginBottom = 4;
            var sl = SlotEl(head, 40); SetSlot(sl, it, false); sl.style.marginRight = 8; sl.pickingMode = PickingMode.Ignore;
            var nm = Box(head); nm.style.flexDirection = FlexDirection.Row; nm.style.flexWrap = Wrap.Wrap; nm.style.alignItems = Align.Center; nm.style.flexShrink = 1;
            var n = Text(nm, it.Name, 15, it.Kind == "junk" ? "#8f8a9e" : Items.RARITY[it.Rarity].Color, true, 2); n.style.whiteSpace = WhiteSpace.Normal; n.style.marginRight = 6;
            if (it.Kind != "junk") { var lv = Text(nm, it.Ilvl.ToString(), 12, "#fff6c0"); lv.style.backgroundColor = C("#2a2040"); Border(lv, 1, C("#5a4a80")); lv.style.paddingLeft = lv.style.paddingRight = 4; }
            int lines = 0;
            if (it.Main != null)
            {
                var r = Row(p); r.style.paddingTop = 2; r.style.paddingBottom = 4; r.style.borderBottomWidth = 1; r.style.borderBottomColor = C("#3a2f52"); r.style.marginBottom = 2;
                if (STAT_ICON.TryGetValue(it.Main.Id, out var ic)) Win.Ico(r, ic, 16).style.marginRight = 3;
                Text(r, Items.FmtStat(it.Main.Id, Items.MainValue(it)), 14, "#fff6d8", true);
                if (it.Plus > 0) { var em = Text(r, "+" + it.Plus, 12, "#ffd24a"); em.style.marginLeft = StyleKeyword.Auto; }
                lines++;
            }
            foreach (var a in it.Affixes)
            {
                var S = Items.Stat(a.Id); bool perfect = a.Tier == 1 && a.V == S.T[0][1];
                var r = Row(p); r.style.marginBottom = 2; if (STAT_ICON.TryGetValue(a.Id, out var ic)) Win.Ico(r, ic, 12).style.marginRight = 3;
                Text(r, Items.FmtStat(a.Id, a.V), 12, perfect ? "#ff9ae8" : "#c8d8ff"); lines++;
            }
            if (Items.IsCore(it) && Items.CoreOf(it) is var co && co != null)
            {
                var c = co.Value; var r = Row(p); r.style.marginBottom = 2;
                var t = Text(r, $"【{Items.CORES[c.id].Name}】{Items.CORE_TEXT[c.id](c.x)}", 12, "#f2eefc"); t.style.whiteSpace = WhiteSpace.Normal; t.style.flexShrink = 1;
                Text(r, $"第 {c.tier} 階", 12, "#ffd24a").style.marginLeft = 4; lines++;
            }
            if (it.Unique != null && UNIQUE_TEXT.TryGetValue(it.Unique, out var u) && u.text != "") { var t = Text(p, u.text, 12, "#ff8a2a"); t.style.whiteSpace = WhiteSpace.Normal; lines++; }
            if (it.Myth != null) { var t = Text(p, MythText(it.Myth, Items.AwakenStage(it)), 12, "#ff8a2a"); t.style.whiteSpace = WhiteSpace.Normal; lines++; }
            if (lines == 0) Text(p, "（什麼都沒有）", 12, "#f2eefc");
        }
        void RenderCmp()
        {
            var it = ItemAt(sel);
            bool show = !batch && it != null && sel.Value.where == "bag" && it.Kind != "junk" && it.Kind != "formcore";
            cmpEl.style.display = show ? DisplayStyle.Flex : DisplayStyle.None;
            if (!show) return;
            cmpEl.Clear();
            var slot = Items.Compare(it, g.Equip, g.Lv)?.slot; var old = slot != null ? g.Equip[slot] : null;
            Text(cmpEl, "身上的", 13, "#ffd24a", true).style.letterSpacing = 2;
            if (old != null) { var c = Box(cmpEl); c.style.marginTop = 4; ItemCard(c, old); if (old.Unique != null) Text(cmpEl, Items.UNIQUES.First(x => x.Id == old.Unique).Name, 12, "#ffcf8a"); }
            else { var e = Text(cmpEl, "這個部位沒有裝備", 12, "#a59fbd"); e.style.marginTop = 20; e.style.unityTextAlign = TextAnchor.MiddleCenter; }
        }
        void RenderDetail()
        {
            RenderCmp();
            detail.Clear();
            var it = ItemAt(sel);
            if (batch)
            {
                int sc = picked.Sum(p => Items.RARITY[p.Rarity].Scrap), co = picked.Sum(p => Items.RARITY[p.Rarity].Coin);
                Empty($"批量分解\n\n已選 <b><color=#f2eefc>{picked.Count}</color></b> 件\n星塵 +{sc}　金幣 +{co}\n\n<size=11>點格子打勾／取消\n「全選」＝選目前篩選的全部\n鎖定的不會被選到</size>");
                detailScroll.Update(); return;
            }
            if (it == null) { Empty("點一下物品看詳細資料\n再點一次就穿上\n\n<size=11>▲ 比身上的好　! 新撿到的\n鎖頭＝鎖定（不會被拆）</size>"); detailScroll.Update(); return; }
            ItemCard(detail, it);
            if (it.Unique != null && UNIQUE_TEXT.TryGetValue(it.Unique, out var u)) Lore(detail, u.lore);
            // 神話：五種形態各自的效果（目前的形態亮）、覺醒階段與進度、解鎖的故事
            if (it.Myth != null)
            {
                var mb = Box(detail); mb.style.marginTop = 4; mb.style.paddingLeft = mb.style.paddingRight = 6; mb.style.paddingTop = mb.style.paddingBottom = 4; Border(mb, 1, C("#fff0a0"));
                Stretch(mb, Gen(8, 8, (x, y) => Color.Lerp(new Color(1, 240 / 255f, 160 / 255f, 0.12f), new Color(160 / 255f, 120 / 255f, 1, 0.12f), (x + y) / 14f)));
                foreach (var (f, t) in MYTH_FORMS[it.Myth])
                {
                    bool on = g.Player.Form == f; var l = Text(mb, $"<b>{Game.FORM_NAME[f]}</b>　{t}", 12, on ? "#fff0a0" : "#a59fbd"); l.enableRichText = true; l.style.whiteSpace = WhiteSpace.Normal;
                }
                int stg = Items.AwakenStage(it), k = it.AwakenKills, next = stg < 3 ? Items.AWAKEN[stg] : 0;
                var aw = Row(mb); aw.style.marginTop = 4; aw.style.marginBottom = 2;
                Text(aw, "覺醒 " + new string('★', stg) + new string('☆', 3 - stg), 12, "#fff0a0").style.marginRight = 6;
                if (next > 0)
                {
                    var bar = Box(aw); bar.style.flexGrow = 1; bar.style.height = 6; bar.style.backgroundColor = C("#1a1430"); Border(bar, 1, C("#5a4a20"));
                    var f2 = Box(bar); f2.style.height = Length.Percent(100); f2.style.width = Length.Percent(Mathf.Round(k * 100f / next)); f2.style.backgroundColor = C("#ffe066");
                    Text(aw, $"{k}/{next}", 12, "#a59fbd").style.marginLeft = 6;
                }
                else Text(aw, "MAX", 12, "#a59fbd");
                foreach (var l in MYTH_LORE[it.Myth].Take(stg)) Lore(mb, l);
            }
            // 套裝：套名＋身上穿了幾件，2 件／4 件效果（達成的亮起來）
            if (it.Set != null && SET_INFO.TryGetValue(it.Set, out var S))
            {
                int n = Items.SetCounts(g.Equip).TryGetValue(it.Set, out var nn) ? nn : 0;
                var sb = Box(detail); sb.style.marginTop = 4; sb.style.paddingLeft = sb.style.paddingRight = 6; sb.style.paddingTop = sb.style.paddingBottom = 4; Border(sb, 1, C(S.color)); sb.style.backgroundColor = C("#28143c", 0.5f);
                var sn = Row(sb); Win.Ico(sn, S.emblem, 12).style.marginRight = 2; Text(sn, S.name, 14, S.color, true); var em = Text(sn, $"{n}/4", 12, "#f2eefc"); em.style.marginLeft = StyleKeyword.Auto;
                foreach (var (need, txt) in new[] { (2, S.two), (4, S.four) })
                {
                    bool on = n >= need; var r = Box(sb); r.style.flexDirection = FlexDirection.Row; r.style.marginTop = 2;
                    var b = Text(r, need.ToString(), 12, on ? "#0a0810" : "#a59fbd", true); Size(b, 16, 16); b.style.flexShrink = 0; b.style.unityTextAlign = TextAnchor.MiddleCenter; Border(b, 1, on ? C(S.color) : C("#4a3a60")); if (on) b.style.backgroundColor = C(S.color); b.style.marginRight = 6;
                    var t = Text(r, txt, 12, on ? "#f2eefc" : "#a59fbd"); t.style.whiteSpace = WhiteSpace.Normal; t.style.flexShrink = 1;
                }
            }
            // 按鈕
            var btns = Box(detail); btns.style.flexDirection = FlexDirection.Row; btns.style.flexWrap = Wrap.Wrap; btns.style.marginTop = 6;
            bool junk = it.Kind == "junk";
            if (sel.Value.where == "bag" && !junk) PBtn(btns, "裝備", "go", () => Equip(sel.Value.i)).style.marginBottom = 3;
            else if (sel.Value.where == "equip")
            {
                Text(btns, "已裝備", 12, "#a59fbd").style.width = Length.Percent(100);
                if (sel.Value.slot != "weapon") PBtn(btns, "卸下", "plain", () => Unequip(sel.Value.slot)).style.marginBottom = 3;
            }
            bool locked = g.Locked.Contains(it);
            if (!junk) PBtn(btns, locked ? "解鎖" : "鎖定", "plain", () =>
            {
                if (!g.Locked.Remove(it)) g.Locked.Add(it);
                bool now = g.Locked.Contains(it); Sfx?.Invoke(now ? "clank" : "ui"); Say(now ? $"{it.Name} 鎖定了：不會被拆掉。" : $"{it.Name} 解鎖了。"); Changed();
            }).style.marginBottom = 3;
            if (sel.Value.where == "bag" && !locked) PBtn(btns, $"拆解 <size=11>+{Items.RARITY[it.Rarity].Scrap}星塵</size>", "red", SalvageSel).style.marginBottom = 3;
            detailScroll.Update();
        }
        void Empty(string text) { var e = Text(detail, text, 12, "#a59fbd"); e.enableRichText = true; e.style.unityTextAlign = TextAnchor.MiddleCenter; e.style.whiteSpace = WhiteSpace.Normal; e.style.marginTop = 40; }
        static void Lore(VisualElement p, string text) { var l = Text(p, text, 12, "#a59fbd"); l.style.unityFontStyleAndWeight = FontStyle.Italic; l.style.whiteSpace = WhiteSpace.Normal; l.style.marginTop = 2; }

        /// 每一格：縮放、開啟動畫、裝備軌道（90 秒一圈；拖東西時停下來）、訊息淡出
        public void Update(float dt)
        {
            if (!Open) return;
            float pw = overlay.layout.width > 0 ? overlay.layout.width : 1280, ph = overlay.layout.height > 0 ? overlay.layout.height : 720;
            float k = Mathf.Min(pw * 0.98f / 760, ph * 0.98f / 360, 2.2f);
            openT += dt; float p = Mathf.Clamp01(openT / 0.34f), e = Bezier(p, 0.3f, 1.5f, 0.5f, 1);
            box.style.scale = new Scale(Vector2.one * k); box.style.translate = new Translate(0, 60 * (1 - e)); box.style.opacity = Mathf.Clamp01(e);
            sayT -= dt; sayEl.style.opacity = Mathf.Clamp01(sayT / 0.3f);
            gridScroll.Update(); detailScroll.Update();
            clock += dt; if (!dragMoved) spin += dt * 0.07f;
            // 星星和裝備軌道
            var cols = SLOTS.Select(s => g.Equip[s] != null ? Items.RARITY[g.Equip[s].Rarity].Color : null).ToArray();
            var aura = Game.FORM_NAME.Keys.Where(f => f != "star" && g.FormsOwned.ContainsKey(f)).Select(f => (f, g.FormGot(f))).ToList();
            HeroOrbit.DrawHero(orbitFrame, starFrame, clock, spin, cols, aura, g.Player.Form);
            orbitFrame.Composite(orbitRgba, null, 0.6);
            orbitTex.LoadRawTextureData(orbitRgba); orbitTex.Apply(false); orbitEl.MarkDirtyRepaint();
            for (int i = 0; i < SLOTS.Length; i++)
            {
                double a = -Math.PI / 2 + (double)i / SLOTS.Length * Math.PI * 2 + spin;
                var el = slotEls[SLOTS[i]]; el.style.left = (float)((56 + Math.Cos(a) * 47) * 2); el.style.top = (float)((50 + Math.Sin(a) * 41) * 2);
                if (Math.Sin(a) >= 0) el.BringToFront(); else el.SendToBack();
            }
            orbitEl.SendToBack();
        }
    }
}
