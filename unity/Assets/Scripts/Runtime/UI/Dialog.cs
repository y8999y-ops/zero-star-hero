// game/src/dialog.js 翻成 UI Toolkit：城鎮的對話框。畫面下方的面板，左右站著說話者的立繪（左＝主角、右＝居民），
// 說話的那邊亮、另一邊變暗；「系統」說話時對話框換成青藍色，系統的水晶飄在主角右上方（主角腦中的聲音）。
// 用法：await dlg.Talk("波波", new[] { "第一句", "第二句" });  var v = await dlg.Ask("波波", "要做什麼？", new[] { ("接任務", "quest"), ("離開", null) });
// 點一下、J、空白鍵、Enter、F：還在打字＝直接顯示整句，打完了＝下一句；選項可以點，或按 1～9。
using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.UIElements;
using static ZeroStar.UI.Ui;

namespace ZeroStar.UI
{
    public class Dialog
    {
        public bool Open { get; private set; }
        readonly VisualElement box, bg, body, opts, porL, porR, sysPor; readonly Label nameEl, textEl;
        readonly Texture2D texL = NewTex(), texR = NewTex();
        readonly Func<string> heroForm;
        string text, shownText; int typed; float typeNext; bool typing, more; float hideT = -1;
        TaskCompletionSource<bool> advance; TaskCompletionSource<string> pick; readonly List<string> values = new List<string>(); float optWait;
        string faceId; int frameN; float frameT; string sysExpr = "normal";
        static Texture2D NewTex() => new Texture2D(2, 2, TextureFormat.RGBA32, false) { filterMode = FilterMode.Point, wrapMode = TextureWrapMode.Clamp };

        // 名字 → 頭像用哪個居民（dialog.js 的 SPEAKERS）
        static readonly (Regex re, string face)[] SPEAKERS =
        {
            (new Regex("波波"), "clerk"), (new Regex("岩叔"), "golem"), (new Regex("菇媽"), "mushroom"), (new Regex("系統"), null),
            (new Regex("啵啵"), "kid"), (new Regex("慢慢"), "turtle"), (new Regex("碎碎"), "pebble"), (new Regex("菇菇寶寶"), "shroom"),
        };
        static string FaceOf(string name) { foreach (var s in SPEAKERS) if (s.re.IsMatch(name)) return s.face; return null; }

        public Dialog(VisualElement parent, Func<string> heroForm)
        {
            this.heroForm = heroForm;
            porL = Box(parent, "dlgL"); Abs(porL, null, null); porL.style.left = Length.Percent(4); Img(porL, texL);
            porR = Box(parent, "dlgR"); Abs(porR, null, null); porR.style.right = Length.Percent(4); Img(porR, texR); porR.style.scale = new Scale(new Vector2(-1, 1));
            sysPor = Box(parent, "dlgSys"); Abs(sysPor, null, null);
            box = Box(parent, "dlg"); Abs(box, null, null, null, 12); box.style.left = Length.Percent(50); box.style.translate = new Translate(Length.Percent(-50), 0);
            box.style.width = Length.Percent(94); box.style.maxWidth = 700; box.style.minHeight = 112; box.style.flexDirection = FlexDirection.Row;
            box.style.paddingLeft = 8; box.style.paddingRight = 12; box.style.paddingTop = 8; box.style.paddingBottom = 8;
            bg = Box(box); Abs(bg, -12, -12, -12, -12); bg.style.opacity = 0.84f;   // CSS 的 #dlg::before：面板半透明
            box.style.marginLeft = box.style.marginRight = 12; box.style.marginTop = box.style.marginBottom = 0;
            body = Box(box); body.style.flexGrow = 1; body.style.paddingTop = 8; body.style.marginRight = 12;
            var tab = Box(body); Abs(tab, -4, -32); Nine(tab, "tab", 4, 4); tab.style.paddingLeft = tab.style.paddingRight = 14;
            nameEl = Text(tab, "", 14, "#1a0e04", true); nameEl.style.whiteSpace = WhiteSpace.NoWrap;
            textEl = Text(body, "", 16, "#f2eefc", false); textEl.style.whiteSpace = WhiteSpace.Normal; textEl.style.minHeight = 16 * 3.2f; textEl.enableRichText = true;
            opts = Box(box); opts.style.flexDirection = FlexDirection.Column; opts.style.justifyContent = Justify.Center; opts.style.flexShrink = 0;
            box.pickingMode = PickingMode.Position; box.RegisterCallback<PointerDownEvent>(e => Next());
            Show(false);
        }
        void Show(bool on)
        {
            var d = on ? DisplayStyle.Flex : DisplayStyle.None;
            box.style.display = d; porL.style.display = d; if (!on) { porR.style.display = d; sysPor.style.display = d; }
        }

        void Say(string name, string line)
        {
            hideT = -1;
            bool sys = name.Contains("系統"), wasOpen = Open;
            string face0 = FaceOf(name), face = sys && wasOpen ? faceId : face0;   // 系統插話時，居民留在原地（變暗）
            Open = true; Show(true);
            Nine(bg, sys ? "panel-sys" : "panel", 12, 12); bg.style.paddingLeft = bg.style.paddingRight = bg.style.paddingTop = bg.style.paddingBottom = 0;
            var tab = nameEl.parent;
            if (sys) { tab.style.backgroundImage = StyleKeyword.None; nameEl.style.color = C("#a8f0ff"); nameEl.style.textShadow = new TextShadow { offset = new Vector2(0, 2), color = Color.black }; nameEl.style.letterSpacing = 3; }
            else { Nine(tab, "tab", 4, 4); tab.style.paddingLeft = tab.style.paddingRight = 14; nameEl.style.color = C("#1a0e04"); nameEl.style.textShadow = StyleKeyword.None; nameEl.style.letterSpacing = 0; }
            textEl.style.color = C(sys ? "#e0faff" : "#f2eefc");
            nameEl.text = name;
            opts.Clear(); values.Clear();
            faceId = face; porR.style.display = face != null ? DisplayStyle.Flex : DisplayStyle.None;
            bool right = !sys && face0 != null;
            tab.style.left = right ? StyleKeyword.Auto : (StyleLength)(-4); tab.style.right = right ? (StyleLength)(-4) : StyleKeyword.Auto;
            Active(porL, !right); Active(porR, right);
            sysPor.style.display = sys ? DisplayStyle.Flex : DisplayStyle.None;
            if (sys) sysExpr = Regex.IsMatch(line, "哼|我設計的|開玩笑|大概|算了|還算|厲害") ? "smug" : Regex.IsMatch(line, "[！？!?]") ? "wow" : "normal";
            text = line; shownText = line; typed = 0; typeNext = 0; typing = true;
            DrawPortraits();
        }
        static void Active(VisualElement p, bool on)
        {
            p.style.unityBackgroundImageTintColor = on ? Color.white : new Color(0.42f, 0.42f, 0.42f);
            p.style.translate = new Translate(0, on ? 0 : 6);
        }

        /// 一句一句講完，講完關掉對話框
        public async Task Talk(string name, IList<string> lines)
        {
            foreach (var line in lines)
            {
                Say(name, line); more = true;
                advance = new TaskCompletionSource<bool>();
                await advance.Task;
            }
            more = false;
            Hide();
        }
        /// 顯示選項，回傳選到的值
        public Task<string> Ask(string name, string line, IList<(string label, string value)> options)
        {
            Say(name, line); more = false;
            for (int i = 0; i < options.Count; i++)
            {
                int k = i; values.Add(options[i].value);
                var b = Box(opts); b.pickingMode = PickingMode.Position; Nine(b, "sbtn", 8, 8); b.style.height = 30; b.style.marginBottom = 6; b.style.paddingLeft = b.style.paddingRight = 6 + 8;
                var l = Text(b, $"{i + 1}. {options[i].label}", 12, "#3a1c04", true); l.style.whiteSpace = WhiteSpace.NoWrap; l.style.unityTextAlign = TextAnchor.MiddleLeft; l.style.flexGrow = 1;
                b.RegisterCallback<PointerDownEvent>(e => { e.StopPropagation(); Choose(k); });
            }
            optWait = -1;   // 字打完再等 0.45 秒，選項才能點（防誤觸）
            pick = new TaskCompletionSource<string>();
            return pick.Task;
        }
        void Choose(int i)
        {
            if (pick == null || i < 0 || i >= values.Count) return;
            if (typing || optWait < 0 || optWait > 0) { if (typing) Next(); return; }
            var r = pick; pick = null; Hide(); r.SetResult(values[i]);
        }
        public void Next()
        {
            if (typing) { typed = shownText.Length; return; }
            if (advance == null) return;
            var a = advance; advance = null; a.SetResult(true);
        }
        // 晚一點點才真的關（接著馬上有下一段對話時，不會閃一下）
        void Hide() { hideT = 0.15f; }

        /// 每一格：打字、立繪動畫、鍵盤
        public void Update(float dt)
        {
            if (hideT >= 0 && (hideT -= dt) < 0) { Open = false; Show(false); hideT = -1; }
            if (!Open) return;
            if (typing)
            {
                typeNext -= dt;
                while (typeNext <= 0 && typed < shownText.Length) { char ch = shownText[typed++]; typeNext += ch == '…' ? 0.11f : "，。！？".IndexOf(ch) >= 0 ? 0.16f : 0.032f; }
                if (typed >= shownText.Length) { typing = false; if (pick != null) optWait = 0.45f; }
            }
            else if (optWait > 0 && (optWait -= dt) <= 0) optWait = 0;
            textEl.text = shownText.Substring(0, typed).Replace("<", "&lt;") + (!typing && more ? " <color=#ffd24a><size=12>▼</size></color>" : "");
            for (int i = 0; i < opts.childCount; i++) opts[i].style.opacity = typing || optWait != 0 ? 0.55f : 1;
            if ((frameT += dt) >= 0.15f) { frameT -= 0.15f; frameN = (frameN + 1) % 8; DrawPortraits(); }
            // 立繪站在對話框上緣
            float top = box.worldBound.yMin, h = box.panel != null ? box.panel.visualTree.worldBound.height : Screen.height;
            porL.style.bottom = porR.style.bottom = h - top - 6;
            if (sysPor.style.display == DisplayStyle.Flex)
            {
                int k = Mathf.Max(2, Mathf.FloorToInt(h * 0.22f / 40)); Size(sysPor, 40 * k, 40 * k);
                var r = porL.worldBound; sysPor.style.left = r.xMin + r.width * 0.55f; sysPor.style.bottom = h - r.yMin - 40 * k * 0.35f;
                Img(sysPor, "face/" + (sysExpr == "normal" && frameN == 6 ? "blink" : sysExpr) + "-" + frameN);
            }
            // 鍵盤：1～9 選項；F、空白、J、Enter、X、Z 下一句
            if (pick != null) for (int i = 0; i < 9; i++) if (Input.GetKeyDown(KeyCode.Alpha1 + i)) Choose(i);
            if (Input.GetKeyDown(KeyCode.F) || Input.GetKeyDown(KeyCode.Space) || Input.GetKeyDown(KeyCode.J) || Input.GetKeyDown(KeyCode.Return) || Input.GetKeyDown(KeyCode.X) || Input.GetKeyDown(KeyCode.Z)) Next();
        }
        // 立繪：主角＝星星待機 8 格（目前形態）；居民＝待機動畫平均分成 8 格。整數倍放大，高度約螢幕的 4 成
        void DrawPortraits()
        {
            var hp = HeroArt.Pose(heroForm(), "idle#" + frameN);
            Paint(texL, hp.W, hp.H, (x, y) => hp.Px[y * hp.W + x]);
            Fit(porL, hp.W, hp.H);
            if (faceId != null)
            {
                var a = Baked.Anim("npc:" + faceId); var s = a.Frames[(int)Math.Floor((frameN % 8) * a.Frames.Length / 8.0)];
                Paint(texR, s.W, s.H, (x, y) => { uint c = s.Color[y * s.W + x]; return (c >> 24) > 160 ? c | 0xff000000 : 0; });
                Fit(porR, s.W, s.H);
            }
        }
        static void Paint(Texture2D t, int w, int h, Func<int, int, uint> px)
        {
            if (t.width != w || t.height != h) t.Reinitialize(w, h);
            var buf = new Color32[w * h];
            for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) { uint c = px(x, y); if (c != 0) buf[(h - 1 - y) * w + x] = new Color32((byte)c, (byte)(c >> 8), (byte)(c >> 16), 255); }
            t.SetPixels32(buf); t.Apply(false);
        }
        void Fit(VisualElement p, int w, int h)
        {
            float sh = p.panel != null ? p.panel.visualTree.worldBound.height : Screen.height;
            int k = Mathf.Max(2, Mathf.FloorToInt(sh * 0.4f / h)); Size(p, w * k, h * k); p.MarkDirtyRepaint();
        }
    }
}
