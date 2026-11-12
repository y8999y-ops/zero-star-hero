// townui.js 的視窗外框（show、render、msg）：斜角像素牌子當外框，依功能換主題色＋左上的徽章圖示。
//   公會＝金、系統（主線）＝青、鍛造＝橘紅、旅館＝暖綠。上面一排：徽章、標題、分頁、金幣星塵、關閉鈕；中間可以捲；下面跳一行結果。
// 打開時有轉場（ui-trans.js）：公會卷軸展開、工坊鐵門拉開、旅館木門推開、系統全息投影。
// 共用的小零件（圖示、籌碼、圖示按鈕、說話的一行、進度條）也在這裡。
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.UIElements;
using static ZeroStar.UI.Ui;

namespace ZeroStar.UI
{
    public class Win
    {
        public class Tab { public string Id, Label, Icon, Theme, Emblem, Title; public Action<VisualElement> Render; }
        static readonly Dictionary<string, (string acc, string acc2)> THEME = new Dictionary<string, (string, string)>
        {
            ["guild"] = ("#ffe7a0", "#c8862a"), ["sys"] = ("#a8f0ff", "#2a8ab8"), ["forge"] = ("#ffb070", "#c84a1e"), ["inn"] = ("#d0f0a0", "#5a9a4a"),
        };
        readonly VisualElement overlay, box, emb, tabsRow, money; readonly Label ttl, msgEl; readonly Scroller body;
        readonly VisualElement fxLayer, fade;
        string title, theme, emblem, tab; List<Tab> tabs; bool keepScroll;
        TaskCompletionSource<bool> done;
        public bool Open { get; private set; }
        public Action<string> Sfx;
        /// 每次畫視窗時拿目前的錢（金幣、星塵）
        public Func<(int coins, int scrap)> Money;
        public string Acc => THEME[CurTheme].acc;
        public string Acc2 => THEME[CurTheme].acc2;
        string CurTheme => tabs?.Find(t => t.Id == tab)?.Theme ?? theme;

        public Win(VisualElement parent)
        {
            overlay = Box(parent, "win"); Abs(overlay, 0, 0, 0, 0); overlay.style.backgroundColor = C("#06040e", 0.55f);
            overlay.style.alignItems = Align.Center; overlay.style.justifyContent = Justify.Center; overlay.style.display = DisplayStyle.None;
            overlay.pickingMode = PickingMode.Position;   // 視窗打開時擋住後面的點擊
            box = Box(overlay, "winBox"); box.style.flexDirection = FlexDirection.Column;
            Nine(box, "win-guild", 16, 16); box.style.paddingLeft = box.style.paddingRight = 16 + 2; box.style.paddingBottom = 16 + 4;
            var head = Box(box); head.style.flexDirection = FlexDirection.Row; head.style.alignItems = Align.Center; head.style.paddingBottom = 6;
            head.style.borderBottomWidth = 2; head.style.borderBottomColor = C("#ffffff", 0.12f); head.style.flexShrink = 0;
            emb = Box(head); Size(emb, 34, 34); emb.style.marginTop = -4; emb.style.marginRight = 6; Round(emb, 17); emb.style.backgroundColor = C("#ffffff", 0.08f);
            emb.style.alignItems = Align.Center; emb.style.justifyContent = Justify.Center;
            ttl = Text(head, "", 15, null, true, 2); ttl.style.letterSpacing = 3; ttl.style.whiteSpace = WhiteSpace.NoWrap; ttl.style.marginRight = 6;
            tabsRow = Box(head); tabsRow.style.flexDirection = FlexDirection.Row; tabsRow.style.flexGrow = 1; tabsRow.style.justifyContent = Justify.Center;
            money = Box(head); money.style.flexDirection = FlexDirection.Row; money.style.marginRight = 6;
            var x = Box(head, "winX"); Size(x, 28, 28); Round(x, 14); x.style.backgroundColor = C("#000000", 0.4f); Border(x, 2, C("#ffffff", 0.15f));
            x.style.alignItems = Align.Center; x.style.justifyContent = Justify.Center; x.pickingMode = PickingMode.Position;
            var xi = Box(x); Size(xi, 18, 18); Img(xi, "icons/close");
            x.AddManipulator(new Clickable(Close));
            body = new Scroller(box);
            body.Content.style.paddingTop = 6; body.Content.style.paddingLeft = body.Content.style.paddingRight = 2; body.Content.style.paddingBottom = 2;
            msgEl = Text(box, "", 14, null, true); Abs(msgEl, null, null, null, 6); msgEl.style.left = Length.Percent(50); msgEl.style.translate = new Translate(Length.Percent(-50), 0);
            msgEl.style.paddingLeft = msgEl.style.paddingRight = 14; msgEl.style.paddingTop = msgEl.style.paddingBottom = 3; Round(msgEl, 12); msgEl.style.opacity = 0; msgEl.style.whiteSpace = WhiteSpace.NoWrap;
            // 蓋在視窗中間的一條紅緞帶大字（任務完成！）
            stamp = Box(box, "stamp"); Abs(stamp, 0, null, 0); stamp.style.top = Length.Percent(40); stamp.style.height = 46; stamp.style.backgroundColor = C("#a82432", 0.96f);
            stamp.style.borderTopWidth = stamp.style.borderBottomWidth = 2; stamp.style.borderTopColor = stamp.style.borderBottomColor = C("#ffd24a");
            stamp.style.alignItems = Align.Center; stamp.style.justifyContent = Justify.Center; stamp.style.display = DisplayStyle.None;
            stampText = Text(stamp, "", 26, "#fff0b0", true, 2, "#4a0c14"); stampText.style.letterSpacing = 8;
            fxLayer = Box(box, "tfx"); Abs(fxLayer, -16, -16, -16, -16); fxLayer.style.overflow = Overflow.Hidden;
            fade = Box(parent, "fade"); Abs(fade, 0, 0, 0, 0); fade.style.backgroundColor = C("#000000"); fade.style.display = DisplayStyle.None;
        }

        /// 打開視窗（已經開著就先把前一個「等關閉」送出去）；回傳的工作在關閉時完成
        bool showMoney = true;
        /// 捲動區裡的每個東西（找節點、按鈕用）
        public void BodyQuery(Action<VisualElement> f) => body.Content.Query<VisualElement>().ForEach(f);
        public Task Show(string title, string theme, string emblem, List<Tab> tabs, string tab = null, bool money = true)
        {
            showMoney = money;
            if (Open) { var r = done; done = null; r?.TrySetResult(true); }
            this.title = title; this.theme = theme; this.emblem = emblem; this.tabs = tabs; this.tab = tab ?? tabs[0].Id;
            Open = true; overlay.style.display = DisplayStyle.Flex;
            Sfx?.Invoke("open");
            lastMoney = null; keepScroll = false;
            Render();
            PlayOpen(tabs.Find(t => t.Id == this.tab).Theme ?? theme);
            done = new TaskCompletionSource<bool>();
            return done.Task;
        }
        public void Close()
        {
            if (!Open) return;
            Open = false; overlay.style.display = DisplayStyle.None; stampT = 9; stamp.style.display = DisplayStyle.None;
            Sfx?.Invoke("close");
            var r = done; done = null; r?.TrySetResult(true);
        }

        (int, int)? lastMoney; readonly Label[] moneyLabels = new Label[2]; readonly VisualElement[] moneyChips = new VisualElement[2]; readonly float[] bumpT = { 9, 9 }; readonly bool[] bumpUp = new bool[2];
        public void Render()
        {
            var t = tabs.Find(x => x.Id == tab); string th = t.Theme ?? theme;
            Nine(box, "win-" + th, 16, 16); box.style.paddingLeft = box.style.paddingRight = 16 + 2; box.style.paddingBottom = 16 + 4;
            float pw = overlay.parent.layout.width > 0 ? overlay.parent.layout.width : 1280, ph = overlay.parent.layout.height > 0 ? overlay.parent.layout.height : 720;
            box.style.width = Mathf.Min(620, pw * 0.94f); box.style.height = Mathf.Min(400, ph * (ph <= 420 ? 0.94f : 0.92f));
            emb.Clear(); var ei = Box(emb); Size(ei, 32, 32); Img(ei, "icons/" + (t.Emblem ?? emblem));
            ttl.text = t.Title ?? title; ttl.style.color = C(Acc);
            tabsRow.Clear();
            if (tabs.Count > 1)
                foreach (var x in tabs)
                {
                    bool on = x.Id == tab;
                    var b = Box(tabsRow); b.style.flexDirection = FlexDirection.Row; b.style.alignItems = Align.Center; b.pickingMode = PickingMode.Position;
                    b.style.paddingLeft = 4; b.style.paddingRight = 10; b.style.paddingTop = b.style.paddingBottom = 2; b.style.marginLeft = b.style.marginRight = 2; Round(b, 12);
                    b.style.backgroundColor = on ? C(Acc) : C("#000000", 0.35f); Border(b, 2, on ? C("#ffffff", 0.5f) : C("#ffffff", 0.1f));
                    var ic = Box(b); Size(ic, 20, 20); Img(ic, "icons/" + x.Icon); ic.style.marginRight = 3;
                    Text(b, x.Label, 12, on ? "#12080a" : "#b8acc8", true).style.whiteSpace = WhiteSpace.NoWrap;
                    if (tabs.Count > 4) { b.style.paddingRight = 6; b.style.marginLeft = b.style.marginRight = 1; }   // 分頁多（技能樹）：擠一點
                    string id = x.Id; b.AddManipulator(new Clickable(() => { tab = id; keepScroll = false; Sfx?.Invoke("ui"); Render(); }));
                }
            var (coins, scrap) = Money?.Invoke() ?? (0, 0);
            money.Clear(); money.style.display = showMoney ? DisplayStyle.Flex : DisplayStyle.None;
            moneyChips[0] = Chip(money, "coin", coins.ToString()); moneyChips[1] = Chip(money, "scrap", scrap.ToString());
            moneyChips[0].style.marginRight = 4;
            for (int i = 0; i < 2; i++) moneyLabels[i] = moneyChips[i].Q<Label>();
            if (lastMoney != null)
            {
                var (c0, s0) = lastMoney.Value;
                if (c0 != coins) { bumpT[0] = 0; bumpUp[0] = coins > c0; }
                if (s0 != scrap) { bumpT[1] = 0; bumpUp[1] = scrap > s0; }
            }
            lastMoney = (coins, scrap);
            // 重畫之後捲到原本的位置（新開的視窗、換分頁從最上面開始；只捲上下）
            if (!keepScroll) body.Y = 0;
            keepScroll = true;
            body.Content.Clear();
            t.Render(body.Content);
            foreach (var ch in body.Content.Children()) ch.style.flexShrink = 0;   // 捲動區裡的東西不要被擠扁
        }

        /// 視窗中間、右上錢的位置（介面座標，給介面特效用）
        public Vector2 BoxCenter() => box.worldBound.center;
        public Vector2 MoneyCenter() => (moneyChips[0] ?? money).worldBound.center;

        // ---- 整個畫面變黑再亮回來（旅館睡一晚；網頁版的 #fade）
        float fadeT = 9, fadeLen;
        public async Task FadeBlack(float hold)
        {
            fadeLen = hold; fadeT = 0; fade.style.display = DisplayStyle.Flex;
            await Task.Delay((int)(hold * 1000));
        }
        void UpdateFade(float dt)
        {
            if (fadeT > fadeLen + 0.4f) { fade.style.display = DisplayStyle.None; return; }
            fadeT += dt;
            fade.style.opacity = fadeT < 0.3f ? fadeT / 0.3f : fadeT < fadeLen ? 1 : Mathf.Clamp01(1 - (fadeT - fadeLen) / 0.4f);
        }

        // ---- 視窗中間的大字緞帶：跳出來、停 1.2 秒、淡掉（2026-11-12：取代英文的 QUEST COMPLETE）
        readonly VisualElement stamp; readonly Label stampText; float stampT = 9;
        public void Stamp(string text) { stampText.text = text; stampT = 0; stamp.style.display = DisplayStyle.Flex; }
        void UpdateStamp(float dt)
        {
            if (stampT > 1.6f) { stamp.style.display = DisplayStyle.None; return; }
            stampT += dt;
            float p = Mathf.Clamp01(stampT / 0.15f), sc = Mathf.Lerp(1.5f, 1, EaseOut(p));
            stamp.style.scale = new Scale(new Vector2(1, Mathf.Lerp(0.2f, 1, p))); stampText.style.scale = new Scale(new Vector2(sc, sc));
            stamp.style.opacity = stampT < 1.3f ? 1 : Mathf.Clamp01(1 - (stampT - 1.3f) / 0.3f);
        }

        // ---- 結果的一行（綠＝好、紅＝不好），2.2 秒後淡掉
        float msgT;
        public void Msg(string text, bool good = true)
        {
            msgEl.text = text; msgT = 2.2f;
            msgEl.style.backgroundColor = good ? C("#143c1e", 0.95f) : C("#461018", 0.95f);
            msgEl.style.color = good ? C("#c8ffb8") : C("#ffc8c0");
            Border(msgEl, 1, good ? C("#6ad06a") : C("#e05a5a"));
        }

        // ---- 第一次打開：主要按鈕閃金光（main.js 的 guideFlash：0.45 秒後，閃 5 下）
        VisualElement pulse; float pulseT = 99;
        public void GuidePulse()
        {
            body.Content.schedule.Execute(() =>
            {
                VisualElement first = null;
                body.Content.Query<VisualElement>(className: "ibtn-go").ForEach(e => { if (first == null) first = e; });
                if (first == null) return;
                pulse?.RemoveFromHierarchy();
                pulse = Box(first); Abs(pulse, -4, -4, -4, -4); Border(pulse, 2, C("#ffe066")); Round(pulse, 4); pulseT = 0;
            }).ExecuteLater(450);
        }

        // ---- 開啟轉場
        string trans; float transT = 9; int bw, bh;
        void PlayOpen(string th)
        {
            trans = th; transT = 0; fxLayer.Clear(); fxLayer.style.opacity = 1;   // 公會的卷軸最後會把這層淡掉，下一次要還原
            float w = box.style.width.value.value, h = box.style.height.value.value;
            bw = Mathf.CeilToInt(w / 2); bh = Mathf.CeilToInt(h / 2);
            if (th == "forge")
            {
                int hw = Mathf.CeilToInt(bw / 2f);
                foreach (var side in new[] { "L", "R" }) { var d = Box(fxLayer, "d" + side); Abs(d, side == "L" ? 0 : (float?)null, 0, side == "R" ? 0 : (float?)null); Size(d, hw * 2, bh * 2); Stretch(d, DoorArt.Get("iron", hw, bh, side)); }
            }
            else if (th == "inn") { var d = Box(fxLayer, "dW"); Abs(d, 0, 0); Size(d, bw * 2, bh * 2); Stretch(d, DoorArt.Get("wood", bw, bh)); d.style.transformOrigin = new TransformOrigin(0, Length.Percent(50)); }
            else if (th == "guild") foreach (var s in new[] { "rT", "rB" }) { var r = Box(fxLayer, s); Abs(r, 12, 0); Size(r, (bw + 8) * 2, 14); Stretch(r, DoorArt.Get("rod", bw + 8, 7)); }
            else if (th == "sys")
            {
                var scan = Box(fxLayer, "scan"); Abs(scan, 0, 0, 0, 0); Stretch(scan, ScanTex()); scan.style.backgroundRepeat = new BackgroundRepeat(Repeat.Repeat, Repeat.Repeat); scan.style.backgroundSize = new BackgroundSize(4, 6);
                var beam = Box(fxLayer, "beam"); Abs(beam, 0, 0, 0); beam.style.height = 4; beam.style.backgroundColor = C("#c8fbff");
            }
            Update(0);
        }
        static Texture2D scanTex;
        static Texture2D ScanTex() => scanTex != null ? scanTex : (scanTex = MakeScan());
        static Texture2D MakeScan() { var t = Gen(1, 6, (x, y) => y >= 4 ? new Color(140 / 255f, 240 / 255f, 1, 0.22f) : new Color(0, 0, 0, 0)); t.filterMode = FilterMode.Point; t.wrapMode = TextureWrapMode.Repeat; return t; }

        public void Update(float dt)
        {
            UpdateFade(dt);
            if (!Open) return;
            UpdateStamp(dt);
            body.Update();
            // 結果那一行
            msgT -= dt;
            float mk = Mathf.Clamp01(msgT > 0 ? 1 - (msgT - 2.0f) / 0.2f : 1 + msgT / 0.2f);
            msgEl.style.opacity = mk; msgEl.style.translate = new Translate(Length.Percent(-50), 6 * (1 - mk));
            // 錢跳一下（bump.js：0.45 秒、6 格；變多往上跳變亮，變少往下沉變紅）
            for (int i = 0; i < 2; i++)
            {
                bumpT[i] += dt; var ch = moneyChips[i]; if (ch == null) continue;
                if (bumpT[i] < 0.45f)
                {
                    float p = Steps(6)(bumpT[i] / 0.45f), k = p < 0.3f ? p / 0.3f : 1 - (p - 0.3f) / 0.7f;
                    ch.style.translate = new Translate(0, (bumpUp[i] ? -5 : 3) * k); ch.style.scale = new Scale(Vector2.one * (1 + (bumpUp[i] ? 0.25f : -0.1f) * k));
                    moneyLabels[i].style.color = Color.Lerp(C("#fff4d0"), C(bumpUp[i] ? "#fff6c0" : "#ff8a7a"), k);
                }
                else { ch.style.translate = new Translate(0, 0); ch.style.scale = new Scale(Vector2.one); }
            }
            // 引導的金光（0.8 秒一下、5 下）
            if (pulse != null) { pulseT += dt; if (pulseT > 4.2f) { pulse.RemoveFromHierarchy(); pulse = null; } else pulse.style.opacity = 0.5f - 0.5f * Mathf.Cos(pulseT / 0.8f * Mathf.PI * 2); }
            // 轉場
            transT += dt;
            float T = transT;
            box.style.scale = new Scale(Vector2.one); box.style.opacity = 1;
            if (T > 0.7f) { fxLayer.Clear(); if (T < 1) box.style.translate = new Translate(0, 0); return; }
            if (trans == "forge")
            {
                float p = Steps(11)(Mathf.Clamp01(T / 0.55f));
                float off = p < 0.18f ? 0 : p < 0.24f ? Mathf.Lerp(0, 3, (p - 0.18f) / 0.06f) : p < 0.3f ? Mathf.Lerp(3, 0, (p - 0.24f) / 0.06f) : -102 * (p - 0.3f) / 0.7f;
                var dl = fxLayer.Q("dL"); var dr = fxLayer.Q("dR");
                if (p < 0.3f) { dl?.style.SetTranslate(off, 0); dr?.style.SetTranslate(-off, 0); }
                else { dl.style.translate = new Translate(Length.Percent(off), 0); dr.style.translate = new Translate(Length.Percent(-off), 0); }
            }
            else if (trans == "inn")
            {
                // 木門以左邊為軸轉開（UI Toolkit 沒有 3D：用寬度的 cos 縮起來，一邊轉一邊變暗）
                float p = Bezier(Mathf.Clamp01(T / 0.6f), 0.5f, 0, 0.3f, 1), a = p < 0.15f ? 0 : (p - 0.15f) / 0.85f * 100;
                var d = fxLayer.Q("dW"); if (d != null) { d.style.scale = new Scale(new Vector2(Mathf.Max(0.001f, Mathf.Cos(a * Mathf.Deg2Rad)), 1)); float br = 1 - 0.5f * Mathf.Clamp01(a / 100); d.style.unityBackgroundImageTintColor = new Color(br, br, br); }
            }
            else if (trans == "guild")
            {
                // 卷軸從中間往上下展開（0.5 秒、10 格），兩根桿子往外滾
                float p = Steps(10)(Mathf.Clamp01(T / 0.5f)), hh = box.layout.height > 0 ? box.layout.height + 32 : bh * 2 + 32;
                box.style.scale = new Scale(new Vector2(1, Mathf.Lerp(0.08f, 1, p)));
                var rt = fxLayer.Q("rT"); var rb = fxLayer.Q("rB");
                float mid = hh / 2 - 7;
                if (rt != null) rt.style.top = Mathf.Lerp(mid, 2, p);
                if (rb != null) rb.style.top = Mathf.Lerp(mid, hh - 16, p);
                fxLayer.style.opacity = T < 0.5f ? 1 : 1 - (T - 0.5f) / 0.2f;
            }
            else if (trans == "sys")
            {
                float p = Steps(7)(Mathf.Clamp01(T / 0.42f));
                float sy = p < 0.35f ? 0.02f : Mathf.Lerp(0.02f, 1, (p - 0.35f) / 0.65f), sx = p < 0.35f ? Mathf.Lerp(0.6f, 1, p / 0.35f) : 1;
                box.style.scale = new Scale(new Vector2(sx, sy));
                var scan = fxLayer.Q("scan"); if (scan != null) scan.style.opacity = T < 0.3f ? 1 : Steps(6)(1 - (T - 0.3f) / 0.3f);
                var beam = fxLayer.Q("beam"); if (beam != null) { float bp = Steps(12)(Mathf.Clamp01(T / 0.6f)); beam.style.top = Length.Percent(bp * 100); beam.style.opacity = 1 - bp; }
            }
            else
            {
                // 其他（地圖）：從下面滑上來淡入（dlgIn 0.18 秒）
                float p = EaseOut(Mathf.Clamp01(T / 0.18f));
                box.style.translate = new Translate(0, 16 * (1 - p)); box.style.opacity = p;
            }
        }

        // ================= 小零件 =================
        public static VisualElement Ico(VisualElement p, string name, float size = 18)
        {
            var e = Box(p); Size(e, size, size); e.style.flexShrink = 0; var t = Tex("icons/" + name); if (t != null) Img(e, t); return e;
        }
        /// 籌碼：圖示＋數字（lack＝不夠，紅字；buff＝主題色）
        public VisualElement Chip(VisualElement p, string icon, string n, string cls = "")
        {
            var c = Box(p); c.style.flexDirection = FlexDirection.Row; c.style.alignItems = Align.Center; c.style.height = 20; c.style.flexShrink = 0;
            c.style.paddingLeft = 2; c.style.paddingRight = 6; Round(c, 10); c.style.backgroundColor = C("#000000", 0.45f);
            Ico(c, icon).style.marginRight = 1;
            Text(c, n, 12, cls == "lack" ? "#ff8a7a" : cls == "buff" ? Acc : "#fff4d0", true, 1).style.whiteSpace = WhiteSpace.NoWrap;
            return c;
        }
        public VisualElement Chips(VisualElement p, int coins, int scrap, int xp)
        {
            if (coins > 0) Chip(p, "coin", coins.ToString()).style.marginBottom = 2;
            if (scrap > 0) Chip(p, "scrap", scrap.ToString()).style.marginBottom = 2;
            if (xp > 0) Chip(p, "xp", xp.ToString()).style.marginBottom = 2;
            return p;
        }
        public void CostChips(VisualElement p, int scrap, int coins, int haveScrap, int haveCoins)
        {
            Chip(p, "scrap", scrap.ToString(), haveScrap < scrap ? "lack" : "").style.marginRight = 3;
            Chip(p, "coin", coins.ToString(), haveCoins < coins ? "lack" : "");
        }
        static readonly Dictionary<string, (string ink, string inkS)> INK = new Dictionary<string, (string, string)>
        {
            ["go"] = ("#3a1c04", "#fff6c880"), ["bad"] = ("#fff2ec", "#5a0c1a"), ["plain"] = ("#f4eeff", "#261c44"),
        };
        /// 圖示按鈕（圖示＋兩個字）：kind go＝主要（金）、bad＝危險（紅）、plain＝一般（紫灰）；mini＝只有圖示
        public VisualElement IBtn(VisualElement p, string icon, string label, Action onClick, string kind = "go", bool mini = false, bool off = false)
        {
            var b = Box(p); b.AddToClassList("ibtn"); if (kind == "go" && !mini) b.AddToClassList("ibtn-go");
            b.style.flexDirection = FlexDirection.Row; b.style.alignItems = Align.Center; b.style.height = 34; b.style.flexShrink = 0; b.pickingMode = PickingMode.Position;
            string skin = "b-" + (kind == "bad" ? "bad" : kind == "plain" ? "plain" : "go");
            void Skin(string st) { Nine(b, skin + "-" + st, 8, 8); b.style.paddingLeft = 8 + (mini ? 0 : 2); b.style.paddingRight = 8 + (mini || label == "" ? 0 : 8); }
            Skin(off ? "x" : "n");
            var ic = Ico(b, icon); if (off) ic.style.unityBackgroundImageTintColor = new Color(0.5f, 0.5f, 0.5f);
            Label l = null;
            if (!string.IsNullOrEmpty(label)) { l = Text(b, label, 14, off ? "#8a8496" : INK[kind].ink, true, off ? 0 : 1, INK[kind].inkS); l.style.marginLeft = 2; l.style.whiteSpace = WhiteSpace.NoWrap; }
            if (!off)
            {
                b.RegisterCallback<PointerEnterEvent>(e => Skin("h"));
                b.RegisterCallback<PointerLeaveEvent>(e => Skin("n"));
                b.RegisterCallback<PointerDownEvent>(e => { Skin("d"); b.style.paddingTop = 8 + 2; });
                b.RegisterCallback<PointerUpEvent>(e => { Skin("h"); b.style.paddingTop = 8; });
                b.AddManipulator(new Clickable(() => onClick()));
            }
            return b;
        }
        /// 說話的一行：「名字：內容」
        public Label Say(VisualElement p, string who, string text)
        {
            var l = Text(p, $"<color={Acc}><b>{who}：</b></color>{text}", 12, "#d8cce8"); l.enableRichText = true; l.style.whiteSpace = WhiteSpace.Normal;
            l.style.paddingLeft = l.style.paddingRight = 4; l.style.paddingBottom = 2; l.style.marginBottom = 5;
            return l;
        }
        static readonly Dictionary<string, Texture2D> grads = new Dictionary<string, Texture2D>();
        /// linear-gradient(上色, 下色)
        public static Texture2D VGrad(string a, string b)
        {
            string k = a + b; if (grads.TryGetValue(k, out var t)) return t;
            Color ca = C(a), cb = C(b);
            return grads[k] = Gen(1, 16, (x, y) => Color.Lerp(ca, cb, (y + 0.5f) / 16));
        }
        /// 進度條（have/need）
        public VisualElement Bar(VisualElement p, int have, int need)
        {
            var bar = Box(p); bar.style.height = 10; bar.style.marginTop = 3; bar.style.backgroundColor = C("#0c0a16"); Border(bar, 1, C("#000000")); Round(bar, 5); bar.style.overflow = Overflow.Hidden;
            var f = Box(bar); Abs(f, 0, 0, null, 0); f.style.width = Length.Percent(Mathf.Round(have * 100f / need)); Stretch(f, VGrad(Acc, Acc2));
            var t = Text(bar, $"{have}/{need}", 12, "#ffffff", false, 1); Abs(t, 0, -4, 0, 0); t.style.unityTextAlign = TextAnchor.MiddleCenter;
            return bar;
        }
        /// 卡片外框（card-guild、card-sys、card-forge、card-inn）
        public static VisualElement Card(VisualElement p, string kind, bool row = true)
        {
            var c = Box(p); Nine(c, "card-" + kind, 12, 12); c.style.flexDirection = row ? FlexDirection.Row : FlexDirection.Column; c.style.alignItems = row ? Align.Center : Align.Stretch;
            c.style.paddingLeft = c.style.paddingRight = 12 + 6; c.style.marginBottom = 5; c.style.flexShrink = 0;
            return c;
        }
    }

    /// 上下捲動的區域（UI Toolkit 的 ScrollView 要主題樣式表才排得對，這裡自己做）：滑鼠滾輪、手指拖、右邊一條細捲軸
    public class Scroller
    {
        public readonly VisualElement View, Content; readonly VisualElement bar;
        public float Y; float dragY0, dragStart; int dragId = -1; bool dragging;
        public Scroller(VisualElement parent)
        {
            View = Box(parent, "winBody"); View.style.flexGrow = 1; View.style.flexShrink = 1; View.style.minHeight = 0; View.style.overflow = Overflow.Hidden; View.pickingMode = PickingMode.Position;
            Content = Box(View, "winContent"); Abs(Content, 0, 0, 0); Content.style.flexDirection = FlexDirection.Column;
            bar = Box(View); Abs(bar, null, 0, 0); bar.style.width = 3; Round(bar, 2); bar.style.backgroundColor = C("#ffffff", 0.25f);
            View.RegisterCallback<WheelEvent>(e => { Y += e.delta.y * 24; e.StopPropagation(); });
            View.RegisterCallback<PointerDownEvent>(e => { dragId = e.pointerId; dragY0 = e.position.y; dragStart = Y; dragging = false; }, TrickleDown.TrickleDown);
            View.RegisterCallback<PointerMoveEvent>(e =>
            {
                if (e.pointerId != dragId) return;
                float d = e.position.y - dragY0;
                if (!dragging && Mathf.Abs(d) > 8) { dragging = true; var cap = View.panel?.GetCapturingElement(e.pointerId) as VisualElement; cap?.ReleasePointer(e.pointerId); }   // 拖動＝捲，不算按到按鈕
                if (dragging) Y = dragStart - d;
            }, TrickleDown.TrickleDown);
            View.RegisterCallback<PointerUpEvent>(e => { if (e.pointerId == dragId) dragId = -1; }, TrickleDown.TrickleDown);
        }
        public void Update()
        {
            float vh = View.layout.height, ch = Content.layout.height;
            float max = float.IsNaN(ch) || float.IsNaN(vh) ? 0 : Mathf.Max(0, ch - vh);
            Y = Mathf.Clamp(Y, 0, max);
            Content.style.top = -Y;
            bar.style.display = max > 0 ? DisplayStyle.Flex : DisplayStyle.None;
            if (max > 0) { float bh = Mathf.Max(20, vh * vh / ch); bar.style.height = bh; bar.style.top = (vh - bh) * Y / max; }
        }
    }

    static class StyleExt
    {
        public static void SetTranslate(this IStyle s, float x, float y) => s.translate = new Translate(x, y);
    }
}
