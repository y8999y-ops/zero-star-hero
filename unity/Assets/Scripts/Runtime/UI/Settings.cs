// 設定面板（index.html 的 #setPanel、main.js 的聲音設定）：右上齒輪或主畫面的「設定」打開，右上角一塊。
//   音樂、音效音量（拉桿）、全部靜音；重看開場動畫、回主畫面；放棄這趟回城鎮（關卡裡才有）；關閉。
//   開著時遊戲暫停；點面板外面任何地方就關掉（那一下不會變成攻擊或移動）。
//   音量先記在 PlayerPrefs（聲音在階段 5 才搬，到時候直接讀這裡）。
using System;
using UnityEngine;
using UnityEngine.UIElements;
using static ZeroStar.UI.Ui;

namespace ZeroStar.UI
{
    public static class Volume
    {
        public static float Music { get => PlayerPrefs.GetFloat("vol.music", 0.6f); set => PlayerPrefs.SetFloat("vol.music", value); }
        public static float Sfx { get => PlayerPrefs.GetFloat("vol.sfx", 0.8f); set => PlayerPrefs.SetFloat("vol.sfx", value); }
        public static bool Mute { get => PlayerPrefs.GetInt("vol.mute", 0) == 1; set => PlayerPrefs.SetInt("vol.mute", value ? 1 : 0); }
    }

    /// 電腦版的視窗：全螢幕開關（設定的按鈕、F11、Alt+Enter）；第一次打開照螢幕大小開一個合適的視窗
    ///   之後的視窗大小、是否全螢幕，Unity 自己會記住（下次打開照舊）
    public static class WindowMode
    {
        public static bool Desktop => !Application.isMobilePlatform && !Application.isEditor;
        public static bool Full => Screen.fullScreenMode != FullScreenMode.Windowed;
        public static void Toggle()
        {
            if (!Desktop) return;
            if (Full) Screen.SetResolution(PlayerPrefs.GetInt("win.w", 1152), PlayerPrefs.GetInt("win.h", 648), FullScreenMode.Windowed);
            else
            {
                PlayerPrefs.SetInt("win.w", Screen.width); PlayerPrefs.SetInt("win.h", Screen.height);   // 退出全螢幕時回到原本的視窗大小
                Screen.SetResolution(Display.main.systemWidth, Display.main.systemHeight, FullScreenMode.FullScreenWindow);
            }
        }
        /// 第一次打開：視窗高＝螢幕高的 75%（16:9），不會在大螢幕上小小一塊、小筆電上超出螢幕
        public static void FirstLaunch()
        {
            if (!Desktop || PlayerPrefs.GetInt("win.init", 0) == 1) return;
            if (Array.IndexOf(Environment.GetCommandLineArgs(), "-screen-width") >= 0) return;   // 指定了大小（測試用）：照指定的
            PlayerPrefs.SetInt("win.init", 1);
            int sw = Display.main.systemWidth, sh = Display.main.systemHeight; if (sw <= 0 || sh <= 0) return;
            int h = Mathf.RoundToInt(sh * 0.75f), w = Mathf.RoundToInt(h * 16f / 9);
            if (w > sw * 0.9f) { w = Mathf.RoundToInt(sw * 0.9f); h = Mathf.RoundToInt(w * 9f / 16); }
            Screen.SetResolution(w, h, FullScreenMode.Windowed);
        }
    }

    public class Settings
    {
        readonly VisualElement overlay, panel, homeRow; readonly Label musicV, sfxV, muteL, fullL; readonly VisualElement musicBar, sfxBar;
        public Action OnIntro, OnTitle, OnGoHome, OnExport, OnImport; public Action<string> Sfx;
        public bool Open { get; private set; }
        float openT = 9;

        public Settings(VisualElement parent)
        {
            overlay = Box(parent, "setLayer"); Abs(overlay, 0, 0, 0, 0); overlay.style.display = DisplayStyle.None; overlay.pickingMode = PickingMode.Position;
            overlay.RegisterCallback<PointerDownEvent>(e => { if (e.target == overlay) { e.StopPropagation(); Close(); } });
            panel = Box(overlay, "setPanel"); Abs(panel, null, 56, 10); panel.style.width = 230; Nine(panel, "panel", 12, 12);
            panel.style.paddingLeft = panel.style.paddingRight = 12 + 10; panel.style.paddingTop = 12 + 6; panel.style.paddingBottom = 12 + 8; panel.pickingMode = PickingMode.Position;
            var t = Text(panel, "設定", 14, "#ffd24a", true); t.style.letterSpacing = 3; t.style.marginBottom = 8;
            musicBar = Slider(panel, "音樂", out musicV, v => { Volume.Music = v; Sync(); ZeroStar.Synth.ApplySaved(); });
            sfxBar = Slider(panel, "音效", out sfxV, v => { Volume.Sfx = v; Sync(); ZeroStar.Synth.ApplySaved(); Sfx?.Invoke("coin"); });
            var r1 = Row(panel);
            muteL = Btn(r1, "全部靜音：關", "plain", () => { Volume.Mute = !Volume.Mute; Sync(); ZeroStar.Synth.ApplySaved(); Sfx?.Invoke("ui"); }).Q<Label>();
            if (WindowMode.Desktop) fullL = Btn(r1, "全螢幕：關", "plain", () => { WindowMode.Toggle(); Sfx?.Invoke("ui"); }).Q<Label>();   // 電腦版才有
            var r2 = Row(panel); Btn(r2, "重看開場動畫", "plain", () => { Close(); OnIntro?.Invoke(); }); Btn(r2, "回主畫面", "plain", () => { Close(); OnTitle?.Invoke(); });
            // 存檔：複製成代碼（備份、換裝置）、從剪貼簿匯入（網頁版「匯出存檔」的代碼）
            var r3 = Row(panel); Btn(r3, "匯出存檔", "plain", () => OnExport?.Invoke()); Btn(r3, "從剪貼簿匯入", "plain", () => { Close(); OnImport?.Invoke(); });
            homeRow = Row(panel); Btn(homeRow, "放棄這趟，回城鎮", "red", () => { Close(); OnGoHome?.Invoke(); });
            Btn(Row(panel), "關閉", "go", Close);
        }
        static VisualElement Row(VisualElement p) { var r = Box(p); r.style.flexDirection = FlexDirection.Row; r.style.marginBottom = 8; return r; }
        static VisualElement Btn(VisualElement p, string label, string kind, Action on)
        {
            string skin = kind == "red" ? "b-bad" : kind == "plain" ? "b-plain" : "b-go";
            var b = Box(p); b.style.flexGrow = 1; b.style.height = 30; Nine(b, skin + "-n", 8, 8); b.style.paddingLeft = b.style.paddingRight = 8 + 4; b.style.marginRight = 3;
            b.style.alignItems = Align.Center; b.style.justifyContent = Justify.Center; b.pickingMode = PickingMode.Position;
            var l = Text(b, label, 12, kind == "red" ? "#fff2ec" : kind == "plain" ? "#f4eeff" : "#3a1c04", true, 1, kind == "red" ? "#5a0c1a" : kind == "plain" ? "#261c44" : "#fff6c880"); l.style.whiteSpace = WhiteSpace.NoWrap;
            b.RegisterCallback<PointerEnterEvent>(e => Nine(b, skin + "-h", 8, 8)); b.RegisterCallback<PointerLeaveEvent>(e => Nine(b, skin + "-n", 8, 8));
            b.AddManipulator(new Clickable(on));
            return b;
        }
        /// 拉桿（0～100，每格 5）：一條深色軌道、金色填滿、圓頭
        VisualElement Slider(VisualElement p, string name, out Label val, Action<float> set)
        {
            var r = Box(p); r.style.flexDirection = FlexDirection.Row; r.style.alignItems = Align.Center; r.style.marginBottom = 8;
            Text(r, name, 14, "#f2eefc").style.marginRight = 8;
            var track = Box(r); track.style.flexGrow = 1; track.style.height = 16; track.pickingMode = PickingMode.Position; track.style.justifyContent = Justify.Center;
            var bg = Box(track); bg.style.height = 6; bg.style.backgroundColor = C("#2a2040"); Round(bg, 3); Border(bg, 1, C("#000000"));
            var fill = Box(bg); fill.style.height = Length.Percent(100); fill.style.backgroundColor = C("#ffd24a"); Round(fill, 3); fill.name = "fill";
            var knob = Box(track); Abs(knob); Size(knob, 14, 14); Round(knob, 7); knob.style.backgroundColor = C("#fff6c8"); Border(knob, 2, C("#6a4a10")); knob.name = "knob"; knob.style.top = 1;
            val = Text(r, "", 12, "#a59fbd"); val.style.width = 30; val.style.unityTextAlign = TextAnchor.MiddleRight; val.style.marginLeft = 8;
            int id = -1;
            void At(Vector2 pos) { var w = track.worldBound; float v = Mathf.Clamp01((pos.x - w.xMin) / Mathf.Max(1, w.width)); set(Mathf.Round(v * 20) / 20); }
            track.RegisterCallback<PointerDownEvent>(e => { id = e.pointerId; track.CapturePointer(id); At(e.position); });
            track.RegisterCallback<PointerMoveEvent>(e => { if (e.pointerId == id) At(e.position); });
            track.RegisterCallback<PointerUpEvent>(e => { if (e.pointerId == id) { track.ReleasePointer(id); id = -1; } });
            return track;
        }
        void SetBar(VisualElement track, float v) { track.Q("fill").style.width = Length.Percent(v * 100); track.Q("knob").style.left = Length.Percent(v * 100); track.Q("knob").style.marginLeft = -7; }
        void Sync()
        {
            SetBar(musicBar, Volume.Music); SetBar(sfxBar, Volume.Sfx);
            musicV.text = Mathf.RoundToInt(Volume.Music * 100).ToString(); sfxV.text = Mathf.RoundToInt(Volume.Sfx * 100).ToString();
            muteL.text = "全部靜音：" + (Volume.Mute ? "開" : "關");
        }
        /// inStage：在關卡裡（才有「放棄這趟，回城鎮」）
        public void Show(bool inStage)
        {
            Open = true; overlay.style.display = DisplayStyle.Flex; homeRow.style.display = inStage ? DisplayStyle.Flex : DisplayStyle.None; openT = 0; Sync(); Sfx?.Invoke("ui");
        }
        public void Close() { if (!Open) return; Open = false; overlay.style.display = DisplayStyle.None; Sfx?.Invoke("close"); }
        public void Toggle(bool inStage) { if (Open) Close(); else Show(inStage); }
        /// 開啟動畫：全息投影（一條亮線上下展開，0.42 秒、7 格）
        public void Update(float dt)
        {
            if (!Open) return;
            if (fullL != null) fullL.text = "全螢幕：" + (WindowMode.Full ? "開" : "關");   // F11、Alt+Enter 切換時也跟著變
            openT += dt; float p = Steps(7)(Mathf.Clamp01(openT / 0.42f));
            panel.style.scale = new Scale(p < 0.35f ? new Vector2(Mathf.Lerp(0.6f, 1, p / 0.35f), 0.02f) : new Vector2(1, Mathf.Lerp(0.02f, 1, (p - 0.35f) / 0.65f)));
        }
    }
}
