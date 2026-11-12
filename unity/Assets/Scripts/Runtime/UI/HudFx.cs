// HUD 的其他部分（網頁版 index.html 的 #feed、#hint、#combo、#ultName、#resBanner、#formBanner、#bossBar、#bossDim、#bossUlt、#absorbTip、#bubble）。
// 網頁版的 CSS 動畫（@keyframes）改成這裡算時間：每個東西記「從出現到現在幾秒」，照關鍵格算透明度、位置、大小。
using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UIElements;
using static ZeroStar.UI.Ui;

namespace ZeroStar.UI
{
    public partial class Hud
    {
        /// 遊戲畫布上的點 → 螢幕像素（左下原點；GameRoot 給 PixelScreen.CanvasToScreen）
        public Func<Vector2, Vector2> CanvasToScreen;
        public readonly TouchPad Pad;

        // 撿東西的訊息（最多 3 行、2 秒淡出）
        VisualElement feed; readonly List<(VisualElement row, float age)> feedRows = new List<(VisualElement, float)>();
        static Texture2D feedBg;
        // 提示框
        VisualElement hint; Label hintText; float hintT, hintK;
        // 連擊
        VisualElement combo, comboCv; readonly ComboArt comboArt = new ComboArt();
        // 大招名
        Label ultName; float ultNameAge = 99; bool ultNameShown;
        // 重要資源、新形態的橫幅
        VisualElement resBanner, rbIcon; Label rbTitle, rbEff, rbFlavor; float rbAge = 99;
        VisualElement formBanner, fbRays, fbStar; Label fbName; float fbAge = 99;
        // 王
        VisualElement bossBar, bossFrame, bossFill, bossLag, bossDim; Label bossUlt; float bossShowK; int bossPhase;
        float lagFrom = 1, lagTo = 1, lagStart, lagNow = 1, clock;
        // 吸收提示、居民的泡泡
        VisualElement absorbTip, absorbPc; Label absorbTc; VisualElement bubble; Label bubbleText; float bubbleK;
        // 戰鬥中：次要的 HUD 變淡
        float combatT, feedDim = 1; bool talking;
        /// 戰鬥中（附近有敵人，離開 2 秒後才算脫離）：技能樹的形態頁不能換帶哪幾個
        public bool InCombat => combatT > 0;

        void BuildFx(VisualElement root)
        {
            if (feedBg == null) feedBg = Gen(40, 1, (x, y) => new Color(10 / 255f, 8 / 255f, 20 / 255f, 0.85f * Mathf.Clamp01((1 - (x + 0.5f) / 40f) / 0.4f)));
            feed = Box(root, "feed"); Abs(feed, 10, 92); feed.style.flexDirection = FlexDirection.Column;

            hint = Box(root, "hint"); Center(hint, 50, 100, -50, 0); hint.style.top = StyleKeyword.Auto; hint.style.bottom = Length.Percent(22);
            hint.style.maxWidth = Length.Percent(70); Nine(hint, "inset", 6, 6);
            hint.style.paddingLeft = hint.style.paddingRight = 6 + 14; hint.style.paddingTop = hint.style.paddingBottom = 6 + 6; hint.style.opacity = 0;
            hintText = Text(hint, "", 14, "#ffd24a", true, 2); hintText.style.whiteSpace = WhiteSpace.Normal; hintText.style.unityTextAlign = TextAnchor.MiddleCenter;

            combo = Box(root, "combo"); Abs(combo, null, 104, 8); combo.style.transformOrigin = new TransformOrigin(Length.Percent(85), Length.Percent(40));
            comboCv = Box(combo); Size(comboCv, 152, 64); Stretch(comboCv, comboArt.Tex); combo.style.opacity = 0;

            ultName = Text(root, "流星墜落", 34, "#fff09a", true, 3, "#8a4a0c"); ultName.style.letterSpacing = 6;
            Abs(ultName); ultName.style.left = Length.Percent(12); ultName.style.top = Length.Percent(78); ultName.style.opacity = 0; ultName.style.whiteSpace = WhiteSpace.NoWrap;

            // 重要資源：深色長帶＋上下金邊（box-shadow 那條外線＝外面再包一層）
            resBanner = Box(root, "resBanner"); Abs(resBanner, 0, null, 0); resBanner.style.top = Length.Percent(24);
            resBanner.style.borderTopWidth = resBanner.style.borderBottomWidth = 2; resBanner.style.borderTopColor = resBanner.style.borderBottomColor = C("#c48412");
            var rbIn = Box(resBanner); rbIn.style.backgroundColor = C("#140c26", 0.9f);
            rbIn.style.borderTopWidth = rbIn.style.borderBottomWidth = 2; rbIn.style.borderTopColor = rbIn.style.borderBottomColor = C("#fff09a");
            rbIn.style.flexDirection = FlexDirection.Row; rbIn.style.alignItems = Align.Center; rbIn.style.justifyContent = Justify.Center;
            rbIn.style.paddingTop = rbIn.style.paddingBottom = 10; rbIn.style.paddingLeft = rbIn.style.paddingRight = 16;
            rbIcon = Box(rbIn); Size(rbIcon, 48, 48); rbIcon.style.marginRight = 14;
            var rbText = Box(rbIn); rbText.style.flexDirection = FlexDirection.Column;
            rbTitle = Text(rbText, "", 22, "#ffd84a", true, 2, "#4a2a08"); rbTitle.style.letterSpacing = 6; rbTitle.style.marginBottom = 2;
            rbEff = Text(rbText, "", 16, "#ffffff", true, 1); rbEff.style.marginBottom = 2;
            rbFlavor = Text(rbText, "", 13, "#b8a8d0");
            resBanner.style.opacity = 0;

            // 新形態：中間大字＋後面轉的光芒
            formBanner = Box(root, "formBanner"); Center(formBanner, 50, 34); formBanner.style.alignItems = Align.Center; formBanner.style.opacity = 0;
            fbRays = Box(formBanner); Abs(fbRays); fbRays.style.left = Length.Percent(50); fbRays.style.top = Length.Percent(40); Size(fbRays, 360, 360); fbRays.style.marginLeft = fbRays.style.marginTop = -180;
            Stretch(fbRays, RaysTex());
            fbStar = Box(formBanner); Size(fbStar, 120, 102); fbStar.style.marginBottom = 2;
            var sub = Text(formBanner, "新形態", 16, "#fff2c8", true, 2); sub.style.letterSpacing = 6; sub.style.marginBottom = 2;
            fbName = Text(formBanner, "", 38, "#ffffff", true, 3); fbName.style.letterSpacing = 8;

            // 王：四周變暗、大招名、下方的血條
            bossDim = Box(root, "bossDim"); Abs(bossDim, 0, 0, 0, 0); Stretch(bossDim, DimTex()); bossDim.style.opacity = 0;
            bossDim.SendToBack();
            bossUlt = Text(root, "", 36, "#fff6c0", true, 3, "#8a4a0c"); Abs(bossUlt, 0, null, 0); bossUlt.style.top = Length.Percent(30);
            bossUlt.style.unityTextAlign = TextAnchor.MiddleCenter; bossUlt.style.letterSpacing = 10; bossUlt.style.opacity = 0;
            bossBar = Box(root, "bossBar"); Abs(bossBar, null, null, null, 14); bossBar.style.left = Length.Percent(50); bossBar.style.opacity = 0;
            var bn = Text(bossBar, "大胃王史萊姆", 14, "#e8f0a0", true, 2); bn.style.unityTextAlign = TextAnchor.MiddleCenter; bn.style.letterSpacing = 4; bn.style.marginBottom = 2;
            bossFrame = Box(bossBar); bossFrame.style.height = 18; Nine(bossFrame, "bar", 6, 6);
            var bIn = Box(bossFrame); bIn.style.flexGrow = 1; bIn.style.backgroundColor = C("#14120a");
            bossLag = Box(bIn); Abs(bossLag, 0, 0, null, 0); bossLag.style.backgroundColor = C("#fff0e0");
            bossFill = Box(bIn); Abs(bossFill, 0, 0, null, 0); bossFill.style.overflow = Overflow.Hidden;
            SetBossPhase(1);
            foreach (float m in new[] { 60f, 30f }) { var t = Box(bIn); Abs(t, null, -2, null, -2); t.style.left = Length.Percent(m); t.style.width = 2; t.style.backgroundColor = C("#120c10"); }

            // 吸收提示（核的上面一行字）
            absorbTip = Box(root, "absorbTip"); Abs(absorbTip); absorbTip.style.translate = new Translate(Length.Percent(-50), Length.Percent(-100)); absorbTip.style.display = DisplayStyle.None;
            absorbPc = Box(absorbTip); absorbPc.style.flexDirection = FlexDirection.Row; absorbPc.style.alignItems = Align.Center;
            TipText(absorbPc, "按住");
            var kbd = TipText(absorbPc, "F"); kbd.style.color = C("#ffe27a"); kbd.style.paddingLeft = kbd.style.paddingRight = 5; kbd.style.marginLeft = kbd.style.marginRight = 4;
            Border(kbd, 2, C("#ffd84a")); Round(kbd, 3); kbd.style.backgroundColor = C("#000000", 0.5f);
            TipText(absorbPc, "吸收");
            absorbTc = TipText(absorbTip, "按住【吸收】");

            // 居民的自言自語泡泡
            bubble = Box(root, "bubble"); Abs(bubble); Nine(bubble, "bubble", 8, 8); bubble.style.translate = new Translate(Length.Percent(-50), Length.Percent(-100));
            bubble.style.paddingLeft = bubble.style.paddingRight = 8 + 6; bubble.style.paddingTop = bubble.style.paddingBottom = 8 + 2; bubble.style.opacity = 0;
            bubbleText = Text(bubble, "", 14, "#2a1626", true); bubbleText.style.whiteSpace = WhiteSpace.NoWrap;
            var tail = Box(bubble); Abs(tail, null, null, null, -6); Size(tail, 14, 8); tail.style.left = Length.Percent(50); tail.style.marginLeft = -7; Img(tail, "bubble-tail");
        }
        static Label TipText(VisualElement p, string s) { var l = Text(p, s, 13, "#fff2c8", true, 1); l.style.whiteSpace = WhiteSpace.NoWrap; return l; }

        // repeating-conic-gradient 的光芒（每 22° 一條 6° 寬），用 radial 遮罩（20%～70%）淡掉
        static Texture2D RaysTex() => Gen(180, 180, (x, y) =>
        {
            float dx = (x + 0.5f) / 180 * 360 - 180, dy = (y + 0.5f) / 180 * 360 - 180;
            float ang = Mathf.Atan2(dx, -dy) * Mathf.Rad2Deg; if (ang < 0) ang += 360;
            float d = Mathf.Sqrt(dx * dx + dy * dy), far = 180 * Mathf.Sqrt(2);
            float mask = Mathf.Clamp01((0.7f * far - d) / (0.5f * far));
            return new Color(1, 1, 1, ang % 22 < 6 ? 0.22f * mask : 0);
        });
        // radial-gradient(ellipse at center, 透明 30%, rgba(10,8,4,.55) 100%)
        static Texture2D DimTex() => Gen(64, 36, (x, y) =>
        {
            float u = (x + 0.5f) / 32 - 1, v = (y + 0.5f) / 18 - 1, r = Mathf.Sqrt(u * u + v * v) / Mathf.Sqrt(2);
            return new Color(10 / 255f, 8 / 255f, 4 / 255f, 0.55f * Mathf.Clamp01((r - 0.3f) / 0.7f));
        });

        void SetBossPhase(int phase)
        {
            bossPhase = phase; bossFill.Clear();
            var (a, b, c) = phase == 2 ? ("#ffd0a0", "#ff7a3a", "#b03a14") : phase == 3 ? ("#fffbe0", "#ffd84a", "#c08a1c") : ("#e8f878", "#9ac02a", "#5e7c16");
            var bands = Bands(bossFill, (a, 2), (b, 2), (c, 0)); Abs(bands, 0, 0, null, 0); bands.style.width = Length.Percent(100);
        }

        // ---- 遊戲叫的
        /// 左邊那排：圖示、名字（顏色）、▲（比身上好）、附註
        public void Feed(Game.FeedRow f)
        {
            var row = Box(feed); feed.Insert(0, row);
            row.style.flexDirection = FlexDirection.Row; row.style.alignItems = Align.Center; row.style.marginBottom = 3; row.style.alignSelf = Align.FlexStart;
            row.style.paddingLeft = 2; row.style.paddingRight = 16; row.style.paddingTop = row.style.paddingBottom = 1; Stretch(row, feedBg);
            var ic = Box(row); Size(ic, 24, 24); var t = Tex("icons/" + f.Icon); if (t != null) Img(ic, t); ic.style.marginRight = 4;
            Text(row, f.Name, 14, f.Color, true, 1);
            if (f.Better) { var up = Text(row, "▲", 14, "#3ad06a", true, 1); up.style.marginLeft = 4; }
            if (!string.IsNullOrEmpty(f.Note)) { var n = Text(row, f.Note, 12, "#a59fbd", false, 1); n.style.marginLeft = 8; }
            feedRows.Insert(0, (row, 0));
            while (feedRows.Count > 3) { feedRows[feedRows.Count - 1].row.RemoveFromHierarchy(); feedRows.RemoveAt(feedRows.Count - 1); }
        }
        public void ShowHint(string msg, double sec) { hintText.text = msg; hintT = (float)sec; }
        public void ResBanner(string icon, string title, string eff, string flavor)
        {
            var t = Tex("icons/" + icon); rbIcon.style.backgroundImage = t; rbIcon.style.backgroundSize = new BackgroundSize(BackgroundSizeType.Contain);
            rbTitle.text = title; rbEff.text = eff; rbFlavor.text = flavor; rbAge = 0;
        }
        public void FormBanner(string form)
        {
            Img(fbStar, "portrait-" + form);
            fbName.text = Game.FORM_NAME[form]; fbName.style.color = C(Game.FORM_COLOR[form]);
            fbAge = 0;
        }

        void UpdateFx(Game g, float dt, bool touch)
        {
            clock += dt;
            var P = g.Player;
            // 戰鬥中（附近 240px 有活的敵人），次要的 HUD 變淡；離開戰鬥 2 秒後恢復
            if (!g.Town && g.Enemies.Any(e => !e.Dead && Math.Abs(e.X - P.X) < 240)) combatT = 2; else combatT -= dt;
            float dimK = combatT > 0 ? 0.4f : 1;   // 任務追蹤一直清楚顯示（style.css 最後的規則），只有訊息列變淡
            feedDim = Mathf.MoveTowards(feedDim, dimK, dt / 0.4f); feed.style.opacity = feedDim;

            // 撿東西：放在任務追蹤下面（任務多一行就跟著往下）；進場從左邊滑進來，2 秒後往左淡出
            float top = qtrack.resolvedStyle.display != DisplayStyle.None && qtrack.layout.height > 0 ? qtrack.layout.yMax + 6 : 92;
            feed.style.top = top;
            for (int i = feedRows.Count - 1; i >= 0; i--)
            {
                var (row, age) = feedRows[i]; age += dt; feedRows[i] = (row, age);
                if (age >= 2.6f) { row.RemoveFromHierarchy(); feedRows.RemoveAt(i); continue; }
                float x, o;
                if (age < 0.2f) { float k = EaseOut(age / 0.2f); x = -16 * (1 - k); o = k; }
                else if (age < 2) { x = 0; o = 1; }
                else { float k = Ease(Mathf.Clamp01((age - 2) / 0.5f)); x = -12 * k; o = 1 - k; }
                row.style.translate = new Translate(x, 0); row.style.opacity = o;
            }

            // 提示框（對話中不顯示）
            hintT -= dt;
            hintK = Mathf.MoveTowards(hintK, hintT > 0 ? 1 : 0, dt / 0.4f);
            hint.style.opacity = hintK; hint.style.display = talking ? DisplayStyle.None : DisplayStyle.Flex;

            // 連擊（城鎮不顯示）
            comboArt.Update(g.Combo, (float)(g.ComboT / Game.COMBO_T), dt);
            combo.style.display = g.Town ? DisplayStyle.None : DisplayStyle.Flex;
            if (touch) { combo.style.top = StyleKeyword.Auto; combo.style.right = StyleKeyword.Auto; combo.style.left = 10; combo.style.bottom = Length.Percent(34); combo.style.transformOrigin = new TransformOrigin(0, Length.Percent(50)); }
            else { combo.style.top = 104; combo.style.right = 8; combo.style.left = StyleKeyword.Auto; combo.style.bottom = StyleKeyword.Auto; combo.style.transformOrigin = new TransformOrigin(Length.Percent(85), Length.Percent(40)); }
            float baseS = touch ? 0.8f : 1;
            if (comboArt.End)
            {
                float k = EaseIn(Mathf.Clamp01(comboArt.EndAge / 0.6f));
                combo.style.opacity = 1 - k; combo.style.translate = new Translate(0, 14 * k); combo.style.scale = new Scale(Vector2.one);
            }
            else { combo.style.opacity = comboArt.On ? (talking ? 0.2f : 1) : 0; combo.style.translate = new Translate(0, 0); combo.style.scale = new Scale(Vector2.one * baseS); }
            // 跳一下（0.16 秒、3 格）；跨過里程碑：放大更多、轉更多（0.5 秒、每段 5 格）
            float s = 1, rot = 0;
            if (comboArt.MileAge < 0.5f)
            {
                float p = comboArt.MileAge / 0.5f, st = Steps(5)((p < 0.4f ? p / 0.4f : (p - 0.4f) / 0.6f));
                if (p < 0.4f) { s = Mathf.Lerp(1.7f, 1.15f, st); rot = Mathf.Lerp(-6, 0, st); } else s = Mathf.Lerp(1.15f, 1, st);
            }
            else if (comboArt.BumpAge < 0.16f) { float st = Steps(3)(comboArt.BumpAge / 0.16f); s = Mathf.Lerp(1.3f, 1, st); rot = Mathf.Lerp(-4, 0, st); }
            comboCv.style.scale = new Scale(Vector2.one * s); comboCv.style.rotate = new Rotate(rot);

            // 大招名：跟特寫帶一起出現（0.45 秒：從左邊滑進來、停一下、往右淡掉）
            bool want = g.Ult.On && g.Ult.T >= g.Ult.NameAt;
            if (want && !ultNameShown) { ultNameShown = true; ultNameAge = 0; ultName.text = g.Ult.Name; }
            if (!g.Ult.On) ultNameShown = false;
            ultNameAge += dt;
            if (ultNameAge < 0.45f && g.Ult.On)
            {
                float p = ultNameAge / 0.45f;
                ultName.style.opacity = Keys(p, new[] { 0, 0.3f, 0.8f, 1 }, new[] { 0f, 1, 1, 0 }, EaseOut);
                ultName.style.translate = new Translate(Keys(p, new[] { 0, 0.3f, 1 }, new[] { -40f, 0, 10 }, EaseOut), Length.Percent(-50));
            }
            else ultName.style.opacity = 0;

            // 重要資源：從中間往上下展開（2.6 秒、每段 40 格）
            rbAge += dt;
            resBanner.style.top = Length.Percent(touch ? 18 : 24);
            if (rbAge < 2.6f)
            {
                float p = rbAge / 2.6f;
                resBanner.style.opacity = Keys(p, new[] { 0, 0.85f, 1 }, new[] { 1f, 1, 0 }, Steps(40));
                resBanner.style.scale = new Scale(new Vector2(1, Keys(p, new[] { 0, 0.06f, 0.1f, 1 }, new[] { 0f, 1.15f, 1, 1 }, Steps(40))));
                float ip = Mathf.Clamp01(rbAge / 0.5f);
                rbIcon.style.scale = new Scale(Vector2.one * Mathf.Lerp(2, 1, Steps(5)(ip)));
            }
            else resBanner.style.opacity = 0;

            // 新形態（2.4 秒）
            fbAge += dt;
            if (fbAge < 2.4f)
            {
                float p = fbAge / 2.4f;
                formBanner.style.opacity = Keys(p, new[] { 0, 0.12f, 0.82f, 1 }, new[] { 0f, 1, 1, 0 }, EaseOut);
                formBanner.style.scale = new Scale(Vector2.one * Keys(p, new[] { 0, 0.12f, 0.2f, 1 }, new[] { 0.4f, 1.12f, 1, 1.04f }, EaseOut));
                fbRays.style.rotate = new Rotate(clock / 6 * 360 % 360);
            }
            else formBanner.style.opacity = 0;

            UpdateBoss(g, dt, touch);
            UpdateAbsorbTip(g, touch);
            UpdateBubble(g, dt);
        }

        void UpdateBoss(Game g, float dt, bool touch)
        {
            double now = g.SimMs;
            // 大招：四周暗下來（5 秒）；大招名（1.6 秒：從大字縮回來、最後淡出）
            float du = (float)((now - g.BossUltAt) / 5000);
            bossDim.style.opacity = du >= 0 && du < 1 ? Keys(du, new[] { 0, 0.08f, 0.75f, 1 }, new[] { 0f, 1, 1, 0 }, EaseOut) : 0;
            float nu = (float)((now - g.BossUltAt) / 1600);
            if (nu >= 0 && nu < 1 && g.BossUltName != null)
            {
                bossUlt.text = g.BossUltName;
                bossUlt.style.opacity = Keys(nu, new[] { 0, 0.15f, 0.8f, 1 }, new[] { 0f, 1, 1, 0 }, EaseOut);
                bossUlt.style.scale = new Scale(Vector2.one * Keys(nu, new[] { 0, 0.15f, 1 }, new[] { 1.8f, 1, 0.96f }, EaseOut));
                bossUlt.style.letterSpacing = Keys(nu, new[] { 0, 0.15f }, new[] { 30f, 10 }, EaseOut);
            }
            else bossUlt.style.opacity = 0;
            // 血條：出現時往上滑、淡入（0.4 秒）；白色的「剛剛被打掉的部分」等 0.3 秒再花 0.6 秒跟上
            bossShowK = Mathf.MoveTowards(bossShowK, g.BossBarOn ? 1 : 0, dt / 0.4f);
            float pw = root.layout.width > 0 ? root.layout.width : 1280;
            float w = touch ? Mathf.Min(330, pw * 0.44f) : Mathf.Min(460, pw * 0.7f);
            bossBar.style.width = w; bossBar.style.marginLeft = -w / 2;
            float e = Ease(bossShowK);
            bossBar.style.opacity = e; bossBar.style.translate = new Translate(0, 20 * (1 - e));
            if (!g.BossBarOn && bossShowK <= 0) { lagFrom = lagTo = lagNow = 1; return; }
            float k = (float)Math.Max(0, g.BossBarK);
            if (g.BossBarPhase != bossPhase) SetBossPhase(g.BossBarPhase);
            bossFill.style.width = Length.Percent(k * 100);
            if (k != lagTo) { lagFrom = lagNow; lagTo = k; lagStart = clock + 0.3f; }
            lagNow = Mathf.Lerp(lagFrom, lagTo, Ease(Mathf.Clamp01((clock - lagStart) / 0.6f)));
            bossLag.style.width = Length.Percent(lagNow * 100);
            // 第三階段：血條一閃一閃（金光）
            bossFrame.style.unityBackgroundImageTintColor = g.BossBarPhase == 3 && (int)(clock / 0.25f) % 2 == 1 ? C("#ffe890") : Color.white;
        }

        /// 螢幕像素（左下原點，Input 給的）→ 面板座標
        public Vector2 ToPanel(Vector2 screen) => root.panel == null ? screen : RuntimePanelUtils.ScreenToPanel(root.panel, new Vector2(screen.x, Screen.height - screen.y));
        /// 這一點底下有可以點的介面（形態格、選單、對話的選項）
        public bool Blocks(Vector2 screen) => root.panel != null && root.panel.Pick(ToPanel(screen)) != null;
        Vector2 ToPanel(double cx, double cy)
        {
            if (CanvasToScreen == null || root.panel == null) return Vector2.zero;
            var sp = CanvasToScreen(new Vector2((float)cx, (float)cy));
            return RuntimePanelUtils.ScreenToPanel(root.panel, new Vector2(sp.x, Screen.height - sp.y));
        }

        void UpdateAbsorbTip(Game g, bool touch)
        {
            var near = g.AbsorbNear;
            bool show = near != null && !g.Town && !talking && near.Hold <= 0;
            absorbTip.style.display = show ? DisplayStyle.Flex : DisplayStyle.None;
            if (!show) return;
            var p = ToPanel(near.X - Math.Round(g.CamX), near.Y - 40 - Math.Round(g.CamY));
            absorbTip.style.left = p.x; absorbTip.style.top = p.y;
            absorbTip.style.marginTop = -3 * (0.5f - 0.5f * Mathf.Cos(clock / 1.2f * Mathf.PI * 2));   // 上下輕輕晃（1.2 秒）
            absorbPc.style.display = touch ? DisplayStyle.None : DisplayStyle.Flex;
            absorbTc.style.display = touch ? DisplayStyle.Flex : DisplayStyle.None;
        }

        void UpdateBubble(Game g, float dt)
        {
            bool on = g.Town && g.BubbleText != null && !talking;
            bubbleK = Mathf.MoveTowards(bubbleK, on ? 1 : 0, dt / 0.25f);
            bubble.style.opacity = Ease(bubbleK);
            if (!on) return;
            bubbleText.text = g.BubbleText;
            var p = ToPanel(g.BubbleX - Math.Round(g.CamX), g.BubbleHead - Math.Round(g.CamY));
            bubble.style.left = p.x; bubble.style.top = p.y;
        }
    }
}
