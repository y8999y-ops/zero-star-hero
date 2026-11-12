// 遊戲中的 HUD（網頁版 index.html 的 #hud、#qtrack、#topR、#forms、#sys、#toast、#pcKeys、#xpBar、#killBox 與 main.js 的 hud()）。
// 位置、大小照網頁版在 1280×720 量到的（#hud 整塊放大 1.2 倍，跟網頁版的 style.css 一樣）。
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
        readonly VisualElement root;
        // 左上
        readonly VisualElement medal, hpLag, hpFill, mpFill, mpMark; readonly Label lv, hpText, mpText;
        float hpLagK = 1, hpLagWait;
        // 主線追蹤、右上、形態
        readonly VisualElement qtrack, forms; string qtrackKey;
        /// 點了左上的任務追蹤（打開任務視窗）
        public Action OnTrack;
        readonly List<(string form, VisualElement slot)> formSlots = new List<(string, VisualElement)>();
        // 系統台詞、一般提示
        readonly VisualElement sys, sysFace; readonly Label sysText, toast;
        string sysFull, sysShown; int sysI; float sysNext, faceT; int faceF; string faceExpr = "normal";
        // 右下的技能、大招
        readonly VisualElement pcSkill, skillWipe, ultHud; readonly Label skillT; readonly Texture2D ultTex = new Texture2D(UltIcon.S, UltIcon.S, TextureFormat.RGBA32, false) { filterMode = FilterMode.Point }; readonly Color32[] ultBuf = new Color32[UltIcon.S * UltIcon.S];
        float skillCdK;
        // 經驗、擊倒數
        readonly VisualElement xpBar, xpFill; readonly Label xpText, killBox; float xpShowT, killShowT; long lastXp = -1; int lastKills = -1;
        readonly VisualElement hud, set, pc, menuBox;
        public bool Visible { set => root.style.display = value ? DisplayStyle.Flex : DisplayStyle.None; }
        /// 對話中：HUD 變淡（網頁版 body.talking #hud, #topR, #forms, #combo, #sys { opacity: .2 }）、提示框和手機按鈕藏起來
        public bool Dim { set => talking = value; }
        /// 手機的排法（body.touch）
        public bool Touch;
        /// 點了左上的背包、技能樹、地圖（bag、tree、map）；點了形態格（形態 id）
        public Action<string> OnMenu, OnForm;

        public Hud(VisualElement parent)
        {
            root = Box(parent, "hudRoot"); Abs(root, 0, 0, 0, 0);

            // ---- 左上：徽章、血條、魔力條、選單（整塊放大 1.2 倍）
            hud = Box(root, "hud"); Abs(hud, 8, 6);
            hud.style.flexDirection = FlexDirection.Row; hud.style.alignItems = Align.FlexStart;
            hud.style.scale = new Scale(new Vector2(1.2f, 1.2f)); hud.style.transformOrigin = new TransformOrigin(0, 0);
            medal = Box(hud, "medal"); Size(medal, 76, 76); medal.style.flexShrink = 0; Img(medal, "medal-star");
            medal.pickingMode = PickingMode.Position; medal.RegisterCallback<PointerDownEvent>(e => { e.StopPropagation(); OnMenu?.Invoke("hero"); });   // 點徽章＝打開背包
            var lvTab = Box(medal); Abs(lvTab, null, null, null, -4); lvTab.style.alignSelf = Align.Center; lvTab.style.left = new Length(50, LengthUnit.Percent); lvTab.style.translate = new Translate(new Length(-50, LengthUnit.Percent), 0);
            Nine(lvTab, "tab", 4, 4); lvTab.style.paddingLeft = lvTab.style.paddingRight = 9;
            lv = Text(lvTab, "Lv 1", 12, "#1a0e04", true); lv.style.unityTextAlign = TextAnchor.MiddleCenter; lv.style.whiteSpace = WhiteSpace.NoWrap;
            var bars = Box(hud); bars.style.marginTop = 14; bars.style.marginLeft = -6; bars.style.flexDirection = FlexDirection.Column;
            var hp = Box(bars); Size(hp, 168, 26); Nine(hp, "bar", 6, 6); hp.style.marginBottom = 3;
            var hpIn = Box(hp); hpIn.style.flexGrow = 1; hpIn.style.backgroundColor = C("#1a0a12"); hpIn.style.overflow = Overflow.Hidden;
            hpLag = Box(hpIn); Abs(hpLag, 0, 0, null, 0); hpLag.style.backgroundColor = C("#fff0e0"); hpLag.style.width = Length.Percent(100);
            hpFill = Bands(hpIn, ("#ff9aa6", 2), ("#ff4d6d", 7), ("#b3203f", 0)); Abs(hpFill, 0, 0, null, 0); hpFill.style.width = Length.Percent(100);
            hpText = Text(hpIn, "100", 12, null, true, 2); Abs(hpText, 0, -1, 0, 0); hpText.style.unityTextAlign = TextAnchor.MiddleCenter; hpText.style.letterSpacing = 1;
            var mp = Box(bars); Size(mp, 152, 14); Nine(mp, "bar", 6, 4);
            var mpIn = Box(mp); mpIn.style.flexGrow = 1; mpIn.style.backgroundColor = C("#0a0e22");
            mpFill = Bands(mpIn, ("#c8f0ff", 1), ("#4aa8ff", 3), ("#2a5ac8", 0)); Abs(mpFill, 0, 0, null, 0); mpFill.style.width = Length.Percent(100);
            mpMark = Box(mpIn); Abs(mpMark, null, -2, null, -2); mpMark.style.width = 2; mpMark.style.marginLeft = -1; mpMark.style.backgroundColor = C("#ffe066");
            mpMark.style.display = DisplayStyle.None;   // 使用者 2026-11-06：魔力條中間那條大招刻度線取消
            mpText = Text(mpIn, "", 12, "#dff4ff", true, 2); Abs(mpText, null, -5, 3); mpText.style.unityTextAlign = TextAnchor.UpperRight;
            var menu = menuBox = Box(hud, "hudMenu"); menu.style.flexDirection = FlexDirection.Row; menu.style.marginLeft = 6; menu.style.marginTop = 12;
            foreach (var (n, icon) in new[] { ("bag", "tb-bag"), ("tree", "icons/star"), ("map", "icons/map") })
            {
                // 使用者 2026-11-06：背包／技能樹／地圖鍵不要底框，只留 30px 的圖示
                var b = Box(menu, "btn-" + n); Size(b, 40, 40); b.style.marginRight = 4; b.pickingMode = PickingMode.Position;
                var ic = Box(b); Size(ic, 30, 30); Abs(ic, 5, 5); Img(ic, icon);
                string key = n; b.RegisterCallback<PointerDownEvent>(e => { e.StopPropagation(); OnMenu?.Invoke(key); });
            }

            // ---- 主線追蹤（左邊，徽章下面）
            // 任務追蹤：第一行主線，下面是追蹤中的那一個支線、料理的加成（main.js 的 renderTracker）
            qtrack = Box(root, "qtrack"); Abs(qtrack, 10, 100); qtrack.style.flexDirection = FlexDirection.Column; qtrack.style.maxWidth = 260;
            qtrack.style.paddingLeft = 8; qtrack.style.paddingRight = 16; qtrack.style.paddingTop = qtrack.style.paddingBottom = 4;
            qtrack.style.borderLeftWidth = 2; qtrack.style.borderLeftColor = C("#ffd84a", 0.7f);
            Stretch(qtrack, Gen(32, 1, (x, y) => new Color(10 / 255f, 8 / 255f, 26 / 255f, 0.62f * (1 - (x + 0.5f) / 32))));
            qtrack.pickingMode = PickingMode.Position; qtrack.RegisterCallback<PointerDownEvent>(e => { e.StopPropagation(); OnTrack?.Invoke(); });

            // ---- 右上：設定（齒輪）、形態
            set = Box(root, "btnSet"); Abs(set, null, 8, 10); Size(set, 34, 34); Nine(set, "inset", 6, 6);
            set.pickingMode = PickingMode.Position; set.RegisterCallback<PointerDownEvent>(e => { e.StopPropagation(); OnMenu?.Invoke("set"); });   // 齒輪＝設定
            var gear = Box(set); Size(gear, 20, 20); Abs(gear, 1, 1); Img(gear, "ic-gear");
            forms = Box(root, "forms"); Abs(forms, null, 62, 10); forms.style.flexDirection = FlexDirection.Row;

            // ---- 系統台詞（上方中間）
            sys = Box(root, "sys"); Abs(sys, 0, 10);   // 左右位置每格算（Update）：置中，但不蓋到左上的圖示
            Nine(sys, "panel-sys2", 8, 8); sys.style.paddingLeft = 8 + 50; sys.style.paddingRight = 8 + 10; sys.style.paddingTop = 8 + 2; sys.style.paddingBottom = 8 + 4;
            sys.style.minHeight = 44 + 16; sys.style.maxWidth = 400; sys.style.opacity = 0;
            sysFace = Box(sys); Size(sysFace, 40, 40); Abs(sysFace, 2 + 8, null); sysFace.style.top = new Length(50, LengthUnit.Percent); sysFace.style.marginTop = -20;
            var head = Text(sys, "■ SYSTEM // 系統", 12, "#6ad8ff", true); head.style.letterSpacing = 2;
            sysText = Text(sys, "", 14, "#e8fbff", true, 1, "#04101e"); sysText.style.whiteSpace = WhiteSpace.Normal; sysText.enableRichText = true;
            toast = Outline(Text(root, "", 18, "#f2eefc", true, 2)); Abs(toast, null, null); toast.style.top = new Length(30, LengthUnit.Percent); toast.style.left = new Length(50, LengthUnit.Percent);
            toast.style.translate = new Translate(new Length(-50, LengthUnit.Percent), 0); toast.style.whiteSpace = WhiteSpace.NoWrap; toast.style.opacity = 0;

            // ---- 右下：技能（E）、大招（Q）
            pc = Box(root, "pcKeys"); Abs(pc, null, null, 18, 16); pc.style.flexDirection = FlexDirection.Row; pc.style.alignItems = Align.FlexEnd;
            pcSkill = Box(pc); Size(pcSkill, 56, 56); Img(pcSkill, "tb-skill"); pcSkill.style.marginRight = 14;
            skillWipe = Box(pcSkill); Abs(skillWipe, 3, 3, 3, 3); skillWipe.generateVisualContent += DrawWipe;
            skillT = Text(pcSkill, "", 17, "#ffffff", true, 2); Abs(skillT, 0, 0, 0, 0); skillT.style.unityTextAlign = TextAnchor.MiddleCenter;
            KeyTag(pcSkill, "E");
            ultHud = Box(pc); Size(ultHud, 72, 72); Img(ultHud, ultTex);
            KeyTag(ultHud, "Q");

            // ---- 經驗條（下緣，拿到經驗才浮出來）、擊倒數
            xpBar = Box(root, "xpBar"); Abs(xpBar, 0, null, 0, 0); xpBar.style.height = 6; xpBar.style.backgroundColor = C("#120e1c"); xpBar.style.opacity = 0;
            xpFill = Bands(xpBar, ("#d0f4ff", 1), ("#5ac0f0", 2), ("#2a70b8", 0)); Abs(xpFill, 0, 0, null, 0);
            xpText = Text(root, "", 12, "#d0f4ff", true, 2); Abs(xpText, null, null, 4, 8); xpText.style.opacity = 0;
            killBox = Text(root, "", 14, "#a59fbd", true, 2); Abs(killBox, null, 172, 12); killBox.style.opacity = 0; killBox.enableRichText = true;
            BuildFx(root);
            Pad = new TouchPad(root, ultTex);
        }
        bool? lastTouch;
        /// 手機：左上整塊 0.96 倍、淡一點；右上 0.85 倍；形態格直排在右邊中間；右下的 E／Q 圖示不顯示（有觸控按鈕）
        void LayTouch(bool t)
        {
            hud.style.scale = new Scale(Vector2.one * (t ? 0.96f : 1.2f));
            set.style.scale = new Scale(Vector2.one * (t ? 0.85f : 1)); set.style.transformOrigin = new TransformOrigin(Length.Percent(100), 0);
            if (t) { forms.style.flexDirection = FlexDirection.Column; forms.style.top = Length.Percent(50); forms.style.right = 8; forms.style.translate = new Translate(0, Length.Percent(-82)); }
            else { forms.style.flexDirection = FlexDirection.Row; forms.style.top = 10; forms.style.right = 62; forms.style.translate = new Translate(0, 0); }
            formSlots.Clear();   // 重建形態格（手機的樣子不一樣）
        }
        static void KeyTag(VisualElement parent, string key)
        {
            var b = Text(parent, key, 14, "#fff6c0", true); Abs(b, -4, null, null, -4);
            b.style.minWidth = 20; b.style.paddingLeft = b.style.paddingRight = 5; b.style.paddingTop = b.style.paddingBottom = 1;
            b.style.backgroundColor = C("#1a1230"); b.style.unityTextAlign = TextAnchor.MiddleCenter;
            b.style.borderLeftWidth = b.style.borderRightWidth = b.style.borderTopWidth = b.style.borderBottomWidth = 2;
            b.style.borderLeftColor = b.style.borderRightColor = b.style.borderTopColor = b.style.borderBottomColor = C("#6a5a9a");
        }
        // 技能冷卻：一圈變暗的扇形（CSS 的 conic-gradient）
        void DrawWipe(MeshGenerationContext mgc)
        {
            if (skillCdK <= 0) return;
            var r = skillWipe.contentRect; var p = mgc.painter2D; var c = r.center; float rad = Mathf.Min(r.width, r.height) / 2;
            p.fillColor = new Color(6 / 255f, 4 / 255f, 16 / 255f, 0.72f);
            p.BeginPath(); p.MoveTo(c); p.Arc(c, rad, -90, -90 + 360 * skillCdK); p.ClosePath(); p.Fill();
        }

        /// 系統台詞（Say.Sys）有新的一句：打字效果、換表情（system-face.js 的 moodOf）
        void StartSys(string text)
        {
            sysFull = text; sysShown = text.Replace("【", "").Replace("】", ""); sysI = 0; sysNext = 0;
            faceExpr = System.Text.RegularExpressions.Regex.IsMatch(text, "哼|我設計的|開玩笑|大概|算了|還算|厲害") ? "smug" : System.Text.RegularExpressions.Regex.IsMatch(text, "[！？!?]") ? "wow" : "normal";
            faceF = 0; faceT = 0;
        }
        static string KeyChips(string text) => System.Text.RegularExpressions.Regex.Replace(text.Replace("<", "&lt;"), "【(.+?)】", "<mark=#8af0ffff><color=#04141e> $1 </color></mark>");

        /// 每一格（畫面更新時）：照遊戲的狀態更新 HUD
        public void Update(Game g, float dt)
        {
            var P = g.Player;
            if (lastTouch != Touch) { lastTouch = Touch; LayTouch(Touch); }
            {
                // 系統台詞：畫面置中；左上的血條和圖示比較寬時往右讓，右邊留給形態格
                float pw = root.layout.width, sw = sys.layout.width, hr = menuBox.worldBound.xMax;
                if (!float.IsNaN(pw) && pw > 0 && !float.IsNaN(sw) && !float.IsNaN(hr))
                {
                    sys.style.maxWidth = Mathf.Clamp(pw - hr - 8 - 190, 220, 400);
                    sys.style.left = Mathf.Max(hr + 8, (pw - sw) / 2);
                }
            }
            hud.style.opacity = talking ? 0.2f : Touch ? 0.85f : 1; set.style.opacity = talking ? 0.2f : Touch ? 0.85f : 1; forms.style.opacity = talking ? 0.2f : 1;
            // 血條：被打掉的那段先留白，0.25 秒後再慢慢縮
            float hpK = (float)Math.Max(0, P.Hp / P.MaxHp);
            hpFill.style.width = Length.Percent(hpK * 100);
            if (hpK < hpLagK) { if ((hpLagWait += dt) > 0.25f) hpLagK = Mathf.Max(hpK, hpLagK - dt * 1.6f); } else { hpLagK = hpK; hpLagWait = 0; }
            hpLag.style.width = Length.Percent(hpLagK * 100);
            hpText.text = Math.Ceiling(P.Hp).ToString();
            mpFill.style.width = Length.Percent((float)(P.Mp / P.MaxMp) * 100);
            mpText.text = Math.Floor(P.Mp).ToString();
            mpMark.style.left = Length.Percent((float)(Ult.ULT_MP / P.MaxMp) * 100);
            lv.text = "Lv " + g.Lv;
            Img(medal, "medal-" + P.Form);
            // 主線追蹤：還沒完成的第一個
            UpdateTrack(g);
            // 形態：帶著的那幾個，目前的亮
            if (formSlots.Count != g.Carry.Length || formSlots.Select(f => f.form).Where((f, i) => f != g.Carry[i]).Any()) BuildForms(g);
            for (int i = 0; i < formSlots.Count; i++)
            {
                bool on = formSlots[i].form == P.Form; var sl = formSlots[i].slot;
                if (!Touch) sl.style.opacity = on ? 1 : 0.65f;
                else { sl.style.opacity = on ? 1 : 0.8f; sl.style.backgroundColor = on ? C("#ffffff", 0.18f) : C("#0c0818", 0.32f); Border(sl, 2, on ? C("#ffe27a") : C("#ffffff", 0.35f)); }
            }
            // 系統台詞：打字（一般 32ms、「…」110ms、標點 160ms），打完把【】換成按鍵的樣子
            string s = g.Say.Sys;
            if (s != null && s != sysFull) StartSys(s);
            sys.style.opacity = s != null ? (talking ? 0.2f : 0.96f) : 0;
            if (s != null)
            {
                if (sysI < sysShown.Length) { sysNext -= dt; while (sysNext <= 0 && sysI < sysShown.Length) { char ch = sysShown[sysI++]; sysNext += ch == '…' ? 0.11f : "，。！？".IndexOf(ch) >= 0 ? 0.16f : 0.032f; } sysText.text = sysShown.Substring(0, sysI).Replace("<", "&lt;") + "<color=#8af0ff>▮</color>"; }
                else sysText.text = KeyChips(sysFull);
                if ((faceT += dt) >= 0.15f) { faceT -= 0.15f; faceF = (faceF + 1) % 8; }
                Img(sysFace, "face/" + (faceExpr == "normal" && faceF == 6 ? "blink" : faceExpr) + "-" + faceF);
            }
            else sysFull = null;
            // 一般提示（不是系統說的）
            string t = g.Say.Toast;
            toast.style.opacity = t != null && !t.StartsWith("系統：") ? 1 : 0;
            if (t != null && !t.StartsWith("系統：")) toast.text = t;
            // 右下：技能冷卻、大招的能量星
            skillCdK = (float)Math.Max(0, P.SkillCd / P.SkillMax); skillWipe.MarkDirtyRepaint();
            skillT.text = P.SkillCd > 0.05 ? (P.SkillCd >= 1 ? Math.Ceiling(P.SkillCd).ToString() : P.SkillCd.ToString("0.0")) : "";
            // 右下的 E／Q：手機、城鎮不顯示；1-1 還沒教到的先藏起來
            pc.style.display = Touch || g.Town ? DisplayStyle.None : DisplayStyle.Flex;
            pcSkill.style.visibility = Locked(g, "skill") ? Visibility.Hidden : Visibility.Visible;
            ultHud.style.visibility = Locked(g, "ult") ? Visibility.Hidden : Visibility.Visible;
            pcSkill.style.unityBackgroundImageTintColor = P.Mp < Player.MP_COST ? new Color(0.55f, 0.55f, 0.6f) : Color.white;
            UltIcon.Draw(ultTex, ultBuf, g.Ult.On ? 0 : Math.Min(1, P.Mp / Ult.ULT_MP), Time.realtimeSinceStartup);
            ultHud.MarkDirtyRepaint();
            // 經驗：有變化才浮出來 2.5 秒；擊倒數：打倒東西才出現 3 秒
            long xk = g.Lv * 1000000L + g.Xp;
            if (lastXp >= 0 && xk != lastXp) xpShowT = 2.5f;
            lastXp = xk;
            bool xs = (xpShowT -= dt) > 0;
            xpBar.style.opacity = xs ? 1 : 0; xpText.style.opacity = xs ? 1 : 0;
            xpFill.style.width = Length.Percent(g.Lv >= Items.MAX_LV ? 100 : (float)(g.Xp / Items.XpNeed(g.Lv)) * 100);
            xpText.text = g.Lv >= Items.MAX_LV ? "MAX" : $"{g.Xp}/{Items.XpNeed(g.Lv)}";
            if (g.Kills != lastKills) { if (lastKills >= 0) killShowT = 3; lastKills = g.Kills; }
            killBox.style.opacity = (killShowT -= dt) > 0 && !g.Town ? 1 : 0;
            killBox.text = $"擊倒 <color=#f2eefc><size=16>{g.Kills}</size></color>";
            UpdateFx(g, dt, Touch);
            Pad.Update(g, dt, Touch, talking, k => Locked(g, k));
        }
        /// 按鈕跟著教學一個一個出現（1-1 的新玩家）：教過的記在 Taught；打過 1-1 的全部照舊顯示
        static bool Locked(Game g, string k) => g.StageId == "1-1" && !g.Town && !g.Taught.Contains(k) && !g.Cleared_.Contains("1-1");
        void UpdateTrack(Game g)
        {
            var Q = g.Quests;
            Q.Tracked.RemoveAll(k => !Q.Active.Any(q => q.Id == k));
            string main = g.MainQuestTitle();
            var tq = Q.Tracked.Count > 0 ? Q.Active.First(q => q.Id == Q.Tracked[0]) : null;
            var meal = g.Meal != null && Game.MEALS.TryGetValue(g.Meal, out var m) ? m : default;
            bool hint = tq == null && Q.Active.Count > 0;
            string key = $"{main}|{tq?.Id}:{tq?.Have}|{g.Meal}|{hint}";
            if (key == qtrackKey) return;
            qtrackKey = key; qtrack.Clear();
            VisualElement Line(string icon, string text, string col)
            {
                var r = Box(qtrack); r.style.flexDirection = FlexDirection.Row; r.style.alignItems = Align.Center; r.style.minHeight = 19;
                var ic = Box(r); Size(ic, 16, 16); Img(ic, "icons/" + icon); ic.style.marginRight = 3; ic.style.flexShrink = 0;
                var l = Text(r, text, 13, col, true, 1); l.enableRichText = true;
                return r;
            }
            if (main != null) Line("xp", main, "#a8f0ff");
            if (tq != null)
            {
                bool ok = tq.Ready; var L = TownWins.QuestLook(tq);
                Line("guild", $"{L.label}　<color=#ffd24a>{(ok ? "✓" : tq.Have + "/" + tq.Need)}</color>", ok ? "#8af08a" : "#e8e0f4");
                var bar = Box(qtrack); bar.style.height = 3; bar.style.marginLeft = 22; bar.style.marginTop = 1; bar.style.marginBottom = 3; bar.style.backgroundColor = C("#000000", 0.5f);
                var f = Box(bar); f.style.height = Length.Percent(100); f.style.width = Length.Percent(Math.Min(100, tq.Have * 100f / tq.Need));
                if (ok) f.style.backgroundColor = C("#3ad06a"); else Stretch(f, Gen(16, 1, (x, y) => Color.Lerp(C("#c8861a"), C("#ffd84a"), (x + 0.5f) / 16)));
            }
            if (meal.name != null) Line(meal.icon, meal.buff, "#ffc89a");
            if (hint) Line("paper", "點這裡選要追蹤的支線", "#a59fbd");
            qtrack.style.display = qtrack.childCount > 0 ? DisplayStyle.Flex : DisplayStyle.None;
        }
        void BuildForms(Game g)
        {
            forms.Clear(); formSlots.Clear();
            for (int i = 0; i < g.Carry.Length; i++)
            {
                string f = g.Carry[i];
                var slot = Box(forms); slot.pickingMode = PickingMode.Position;
                if (!Touch) { Size(slot, 46, 40); Nine(slot, "inset", 6, 6); slot.style.marginLeft = 6; }
                else { Size(slot, 44, 40); Round(slot, 8); slot.style.marginBottom = 6; }
                var por = Box(slot); Size(por, 40, 34); if (Touch) Abs(por, 2, 3); else Abs(por, -3, -3); Img(por, "portrait-" + f);
                string fid = f; slot.RegisterCallback<PointerDownEvent>(e => { e.StopPropagation(); OnForm?.Invoke(fid); });
                var k = Text(slot, (i + 1).ToString(), 12, "#ffd24a", true, 1); Abs(k, null, null, -4, -6);
                formSlots.Add((f, slot));
            }
        }
    }
}
