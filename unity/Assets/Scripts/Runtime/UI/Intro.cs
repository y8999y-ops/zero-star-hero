// 網頁版 game/src/intro.js（開場動畫第三版，約 46.5 秒，隨時可以跳過）翻成 C#。時間表、台詞、表情、各幕的畫法都照原本：
//   A  0 ～ 8     系統開機：掃描線、開機紀錄一行行跑出來、雜訊；紅色警告「種族不在資料庫」閃爍震動 → 金色「強制寫入」＋進度條 → 舊電視關機
//   B  8 ～ 14    夜空流星雨，一顆特別亮的金色碎片往下墜（pixelfx star-fall＋star-meteor 不冒煙版）
//   B2 14 ～ 21   鏡頭跟著碎片往下衝：星空往上飛走、穿過三層雲、速度線、經過碎星鎮上空、衝進山谷
//   C  21 ～ 24   洞窟：撞地前慢動作 → 閃白、大震動、衝擊波、碎石、煙塵（pixelfx meteor）
//   T  24 ～ 28.5 標題字從上面砸下來（彈一下、震一下）
//   D  28.5 ～ 39 主角醒來的表演（趴著 → 眨眼 → 爬起來 → 看手 → 嚇一跳 → 跌倒 → 爬起來）
//   E  39 ～ 46.5 洞窟深處：黑暗裡發光的眼睛、史萊姆從右邊探頭（pixelfx slime）→ 淡出
// 畫面：遊戲解析度（高 216）的像素畫布（Pix2D），放大蓋滿螢幕；畫布上的字（開機紀錄、警告框）交給 UI 疊在上面（字要清楚）。
// 台詞框（系統樣式）＝UI；網頁版最後的 CSS 把它放在上面中間、跳過鍵放右下（下面是主角掉下來的地方），這裡照那個。
// 音效、音樂都交給 Sfx（名字跟網頁版的 sfx 一樣；音樂是 "music:intro"、"music:end"）。
// 主角的姿勢：開場用到幾種特別的（換眼睛、看手、正面待機），由 node game/tools/unity-intro-export.mjs 匯出成 Resources/Baked/intro-hero.bytes。
using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Text;
using System.Threading.Tasks;
using PixelFX;
using UnityEngine;
using UnityEngine.UIElements;
using static ZeroStar.UI.Ui;

namespace ZeroStar.UI
{
    public class Intro
    {
        // ---- 時間表（秒）
        const int H = 216, M = 10;   // M：洞窟那層畫布四周多留的邊（震動時看得到畫面外一點點）
        const double T_SKY = 8, T_DIVE = 14, T_CAVE = 21, T_TITLE = 24, T_WAKE = 28.5, T_DEEP = 39, END = 46.5;
        static readonly string[] GOLD = { "#3a1a06", "#6e3a0c", "#a8601a", "#d8902a", "#f4c040", "#ffe27a", "#fff2b0", "#fffbe8", "#ffffff" };
        // 台詞時間表：[開始秒, 文字]
        static readonly (double t, string s)[] LINES =
        {
            (1.0, "……偵測到靈魂。"), (2.8, "轉生程序，啟動。"), (4.7, "錯誤：種族不在資料庫！"), (6.3, "……算了，強制寫入。"),
            (T_WAKE + 0.6, "恭喜轉生成功。"), (T_WAKE + 2.6, "種族：星靈。"), (T_WAKE + 4.6, "……不，我也是第一次看到。"), (T_WAKE + 7.4, "連路都不會走？……這下麻煩了。"),
            (T_DEEP + 1.0, "對了，順帶一提——"), (T_DEEP + 3.0, "這裡的魔物，你可以吃掉。"), (T_DEEP + 5.4, "……祝你好運。"),
        };
        // 系統框要藏起來的時段（開機紀錄和砸下來、標題的時候不要擋畫面）
        static bool SayHidden(double t) => (t > 7.6 && t < T_WAKE + 0.4) || (t > T_WAKE + 9.6 && t < T_DEEP + 0.8) || t > END - 0.9;
        // 開機紀錄（畫在畫布上，一行一行跑出來）
        static readonly (double t, string s)[] BOOT =
        {
            (0.7, "STAR-SYS v0.0.1  BOOT"), (1.2, "MEMORY ............ OK"), (1.7, "SOUL SIGNAL ....... 1"), (2.3, "REINCARNATE.EXE ... LOAD"), (3.0, "RACE LOOKUP ......."),
        };

        public Action<string> Sfx;
        public bool Playing { get; private set; }

        readonly VisualElement parent;
        VisualElement root, cv, txtLayer, say, sayFace, hfx, hfxLine, hfxSweep; Label sayText; VisualElement[] corners;
        readonly List<Label> txtPool = new List<Label>();
        TaskCompletionSource<bool> done;

        // 畫布：g＝螢幕那張；world＝洞窟那幾幕的場景（先畫好再用鏡頭的放大、震動貼到 g 上）
        Pix2D g, world; int W = 384;
        Img far, tmid, logo, vback, vfar, vmid, vground;
        readonly Dictionary<string, Img> heroImg = new Dictionary<string, Img>(); Dictionary<string, (int w, int ax, int ay)> heroInfo;
        Sky sky; double skyLast;
        Frame fxF, fxWorld; byte[] fxImg, fxWorldImg;
        public readonly List<OverText> Texts = new List<OverText>();   // 這一格畫布上的字（UI 疊上去）
        int txOff;   // 現在 translate 的 x（警告框震動時字也跟著動）

        // ---- 這一次播放的狀態（每次 Play 重來）
        double seed;
        double Rnd() => (seed = (seed * 16807) % 2147483647) / 2147483647;
        struct Cloud { public int layer; public double x, y, w, h; }
        struct SpeedLine { public double x, y, len, sp; public bool hot; }
        struct Rock { public double a, v, spin; public int s; }
        struct Eye { public double x, y, t0, blink; public bool red; }
        Cloud[] clouds; SpeedLine[] lines; Rock[] rocks; Eye[] eyes;
        FxRun fallFx, heroFx, crashFx, slime; double fxLast, crashT;
        readonly HashSet<string> played = new HashSet<string>();
        int lineI; string mood = "normal"; bool sayOn, sayErr; float sayP, glitchT = 9;
        string typeFull = ""; int typeI; float typeNext; bool typing;
        double clock, last, lastT; bool inited;

        public Intro(VisualElement parent) { this.parent = parent; }

        /// 一個 Sfx（音效名字跟網頁版一樣）
        void S(string n) => Sfx?.Invoke(n);
        void Once(string k, Action fn) { if (played.Add(k)) fn(); }

        // ================= 播放 =================
        /// 播開場：蓋滿全螢幕，播完（46.5 秒）或按「跳過」時結束
        public Task Play()
        {
            if (Playing) return done.Task;
            Build(); Reset();
            Playing = true; clock = 0; last = -1; lastT = 0;
            done = new TaskCompletionSource<bool>();
            S("music:intro");
            return done.Task;
        }
        public void Skip() { if (!Playing) return; S("ui"); Finish(); }
        void Finish()
        {
            if (!Playing) return;
            Playing = false;
            S("music:end");
            root?.RemoveFromHierarchy(); root = null;
            done?.TrySetResult(true);
        }

        /// 每一格（主程式的 LateUpdate，不受時間縮放）：最多 30 fps 畫一次，台詞框的動畫每格都跑
        public void Update(float dt)
        {
            if (root == null) return;
            UpdateSay(dt);
            if (!Playing) return;
            clock += dt;
            if (clock - last < 1 / 30.0) return;
            last = clock;
            double t = clock;
            if (t >= END) { Finish(); return; }
            Resize();
            Draw(t, Math.Min(0.1, t - lastT));
            lastT = t;
            Present();
        }

        /// 開發用（截圖）：一格一格往前畫到第 t 秒（像網頁版的 window.__introAt），時鐘停住
        public void DrawAt(double t)
        {
            Build();
            if (!inited) Reset();
            Playing = false;
            Resize();
            while (fxLast < t) { double n = Math.Min(t, fxLast + 1 / 30.0); Draw(n, n - fxLast); fxLast = n; }
            if (typing) { typing = false; typeI = typeFull.Length; }
            sayP = sayOn ? 1 : 0;
            Present(); UpdateSay(0);
        }
        /// 開發用：畫布（截圖工具直接讀像素）
        public Pix2D Canvas => g;

        void Reset()
        {
            inited = true;
            if (far == null) LoadArt();
            sky = new Sky(); skyLast = 0;
            seed = 11;
            // 雲（三層，越近越大越快）、速度線、碎石、發光的眼睛（順序照網頁版抽亂數）
            clouds = new Cloud[18];
            for (int i = 0; i < 18; i++) { var c = new Cloud { layer = i % 3 }; c.x = Rnd() * 560 - 20; c.y = Rnd() * 900; c.w = 40 + Rnd() * 70; c.h = 10 + Rnd() * 10; clouds[i] = c; }
            lines = new SpeedLine[26];
            for (int i = 0; i < 26; i++) { var l = new SpeedLine(); l.x = Rnd() * 520; l.y = Rnd() * 400; l.len = 10 + Rnd() * 30; l.sp = 500 + Rnd() * 500; l.hot = Rnd() < 0.25; lines[i] = l; }
            rocks = new Rock[22];
            for (int i = 0; i < 22; i++) { var r = new Rock(); r.a = -Math.PI * (0.08 + Rnd() * 0.84); r.v = 90 + Rnd() * 170; r.s = Rnd() < 0.3 ? 3 : 2; r.spin = Rnd(); rocks[i] = r; }
            eyes = new Eye[7];
            for (int i = 0; i < 7; i++) { var e = new Eye(); e.x = i < 4 ? 30 + Rnd() * 90 : -30 - Rnd() * 90; e.y = 70 + Rnd() * 70; e.t0 = 0.6 + i * 0.45 + Rnd() * 0.3; e.red = Rnd() < 0.5; e.blink = Rnd() * 3; eyes[i] = e; }
            fallFx = heroFx = crashFx = slime = null; fxLast = 0; crashT = 0; played.Clear();
            lineI = 0; mood = "normal"; sayOn = false; sayErr = false; sayP = 0; glitchT = 9; typeFull = ""; typeI = 0; typing = false;
        }

        void LoadArt()
        {
            far = Img.Load("Art/town/far"); tmid = Img.Load("Art/town/mid"); logo = Img.Load("Art/ui/logo");
            vback = Img.Load("Art/valley/back"); vfar = Img.Load("Art/valley/far"); vmid = Img.Load("Art/valley/mid"); vground = Img.Load("Art/valley/ground");
            // 主角的姿勢（intro-hero.bytes：格式跟 Baked 的 hero.bytes 一樣）
            heroInfo = new Dictionary<string, (int, int, int)>();
            var ta = Resources.Load<TextAsset>("Baked/intro-hero");
            if (ta == null) { Debug.LogWarning("找不到 Resources/Baked/intro-hero.bytes（先跑 node game/tools/unity-intro-export.mjs）"); return; }
            byte[] b; using (var ms = new MemoryStream(ta.bytes)) using (var z = new GZipStream(ms, CompressionMode.Decompress)) using (var o = new MemoryStream()) { z.CopyTo(o); b = o.ToArray(); }
            int p = 0;
            int I32() { int v = BitConverter.ToInt32(b, p); p += 4; return v; }
            string Str() { int n = I32(); string s = Encoding.UTF8.GetString(b, p, n); p += n; return s; }
            if (Str() != "ZHR1") return;
            int count = I32();
            for (int k = 0; k < count; k++)
            {
                string name = Str(); int w = I32(), h = I32(), ax = I32(), ay = I32(); p += 32;   // 肚子光、前角尖端的位置（開場不用）
                int n = I32(); var im = new Img(w, h);
                for (int i = 0; i < n; i++) { uint c = BitConverter.ToUInt32(b, p + i * 4); if (c != 0) im.Px[i] = new Color((c & 255) / 255f, ((c >> 8) & 255) / 255f, ((c >> 16) & 255) / 255f, (c >> 24) / 255f); }
                p += n * 4;
                heroImg[name] = im; heroInfo[name] = (w, ax, ay);
            }
        }

        // ================= 畫面（UI） =================
        void Build()
        {
            if (root != null) return;
            root = Box(parent, "intro"); Abs(root, 0, 0, 0, 0); root.style.backgroundColor = C("#000000"); root.style.overflow = Overflow.Hidden; root.pickingMode = PickingMode.Position;
            cv = Box(root, "introCv"); Abs(cv); cv.style.left = Length.Percent(50); cv.style.top = Length.Percent(50);
            cv.style.backgroundSize = new BackgroundSize(Length.Percent(100), Length.Percent(100));
            txtLayer = Box(cv); Abs(txtLayer, 0, 0, 0, 0);
            txtPool.Clear();
            // 台詞框（系統樣式）：左邊水晶臉、上面「SYSTEM // 系統」、下面打字的台詞
            say = Box(root, "introSay"); Abs(say, null, 14); say.style.left = Length.Percent(50); say.style.opacity = 0;
            sayFace = Box(say); Size(sayFace, 44, 44); sayFace.style.position = Position.Absolute; sayFace.style.top = Length.Percent(50); sayFace.style.marginTop = -22;
            hfx = Box(say); hfx.style.position = Position.Absolute; hfx.style.overflow = Overflow.Hidden;
            // .hfx：四個角的青色括號、每隔幾秒掃過去的一道光、上緣會呼吸的光線
            hfxSweep = Box(hfx); Abs(hfxSweep, null, 0, null, 0); hfxSweep.style.width = Length.Percent(40);
            Stretch(hfxSweep, Gen(32, 1, (x, y) => { float u = (x + 0.5f) / 32; float a = u < 0.45f ? Mathf.Lerp(0, 0.22f, u / 0.45f) : u < 0.5f ? Mathf.Lerp(0.22f, 0.35f, (u - 0.45f) / 0.05f) : u < 0.55f ? Mathf.Lerp(0.35f, 0.22f, (u - 0.5f) / 0.05f) : Mathf.Lerp(0.22f, 0, (u - 0.55f) / 0.45f); return u > 0.47f && u < 0.53f ? new Color(1, 1, 1, a) : new Color(160 / 255f, 245 / 255f, 1, a); }));
            corners = new VisualElement[8];
            for (int i = 0; i < 8; i++)
            {
                var e = Box(hfx); e.style.position = Position.Absolute; e.style.backgroundColor = C("#8af0ff");
                bool wide = i % 2 == 0; Size(e, wide ? 10 : 2, wide ? 2 : 10);
                int corner = i / 2; if (corner % 2 == 0) e.style.left = 0; else e.style.right = 0; if (corner < 2) e.style.top = 0; else e.style.bottom = 0;
                corners[i] = e;
            }
            hfxLine = Box(hfx); Abs(hfxLine, 14, 0, 14); hfxLine.style.height = 2;
            Stretch(hfxLine, Gen(64, 1, (x, y) => { float u = (x + 0.5f) / 64; var cy = C("#8af0ff"); if (u < 0.2f) { cy.a = u / 0.2f; return cy; } if (u > 0.8f) { cy.a = (1 - u) / 0.2f; return cy; } return Color.Lerp(cy, Color.white, 1 - Mathf.Abs(u - 0.5f) / 0.3f); }));
            var head = Text(say, "SYSTEM // 系統", 12, "#6ad8ff"); head.style.letterSpacing = 3; head.style.height = 14; head.style.unityTextAlign = TextAnchor.MiddleLeft;
            sayText = Text(say, "", 17, "#e8fbff", true); sayText.style.whiteSpace = WhiteSpace.Normal; sayText.style.minHeight = 17 * 1.5f;
            sayText.style.textShadow = new TextShadow { offset = new Vector2(1, 0), color = new Color(1, 60 / 255f, 200 / 255f, 0.35f) };
            SaySkin(false);
            // 跳過鍵（右下）
            var skip = new Label("跳過 ▶▶") { pickingMode = PickingMode.Position }; root.Add(skip);
            Abs(skip, null, null, 14, 12); skip.style.fontSize = 14; skip.style.unityFontStyleAndWeight = FontStyle.Bold; skip.style.letterSpacing = 2;
            skip.style.color = C("#d8cbe8"); skip.style.paddingLeft = skip.style.paddingRight = 12; skip.style.paddingTop = skip.style.paddingBottom = 4;
            skip.style.backgroundColor = new Color(10 / 255f, 8 / 255f, 26 / 255f, 0.55f); Border(skip, 1, new Color(1, 1, 1, 0.25f)); Round(skip, 3);
            skip.RegisterCallback<PointerEnterEvent>(e => { skip.style.color = C("#ffe7a0"); Border(skip, 1, new Color(1, 226 / 255f, 122 / 255f, 0.7f)); });
            skip.RegisterCallback<PointerLeaveEvent>(e => { skip.style.color = C("#d8cbe8"); Border(skip, 1, new Color(1, 1, 1, 0.25f)); });
            skip.AddManipulator(new Clickable(Skip));
        }
        // 平常＝系統框的 9 宮格；報錯時（.introSay.err）＝3px 紅框、深紅底、字變粉紅
        void SaySkin(bool err)
        {
            float b = err ? 3 : 8;   // 框的寬（Nine 的框是 padding；紅框是真的 border）
            if (err)
            {
                say.style.backgroundImage = StyleKeyword.None; say.style.backgroundColor = new Color(40 / 255f, 4 / 255f, 10 / 255f, 0.92f); Border(say, 3, C("#ff3a4a"));
                say.style.paddingLeft = 56; say.style.paddingRight = 14; say.style.paddingTop = 4; say.style.paddingBottom = 8;
                sayText.style.color = C("#ffd0c8");
            }
            else
            {
                Nine(say, "panel-sys2", 8, 8); Border(say, 0, Color.clear); say.style.backgroundColor = Color.clear;
                say.style.paddingLeft = 8 + 56; say.style.paddingRight = 8 + 14; say.style.paddingTop = 8 + 4; say.style.paddingBottom = 8 + 8;
                sayText.style.color = C("#e8fbff");
            }
            float inner = err ? 0 : 8;   // 絕對位置從哪裡算起（Nine 的框在元素裡面）
            sayFace.style.left = inner + 4;
            hfx.style.left = hfx.style.top = hfx.style.right = hfx.style.bottom = inner - 4;
        }

        /// 台詞框：淡入淡出（0.3 秒）、新台詞的雜訊抖動（0.3 秒 4 格）、打字、水晶臉、hfx 的光
        void UpdateSay(float dt)
        {
            if (say == null) return;
            float pw = root.layout.width > 0 ? root.layout.width : 1280;
            say.style.minWidth = Mathf.Min(360, pw * 0.8f); say.style.maxWidth = Mathf.Min(560, pw * 0.88f);
            sayP = Mathf.Clamp01(sayP + (sayOn ? dt : -dt) / 0.3f);
            float e = Ease(sayP);
            say.style.opacity = 0.96f * e;
            float gx = 0, gy = -8 * (1 - e);
            if (sayOn && glitchT < 0.3f)
            {
                int st = Mathf.Min(3, (int)(glitchT / 0.3f * 4));
                (float x, float y)[] K = { (-4, 0), (3, -1), (-2, 1), (0, 0) };
                gx = K[st].x; gy = K[st].y;
            }
            glitchT += dt;
            say.style.translate = new Translate(new Length(-50, LengthUnit.Percent), 0);
            say.style.marginLeft = gx; say.style.marginTop = gy;
            // 打字（dialog.js 的 typewriter：一般 32 ms 一個字，「…」110 ms，，。！？ 160 ms；奇數個字嗶一聲）
            if (typing)
            {
                typeNext -= dt;
                while (typing && typeNext <= 0)
                {
                    if (typeI >= typeFull.Length) { typing = false; break; }
                    char ch = typeFull[typeI++];
                    if (typeI % 2 == 1 && " \t…，。！？、「」（）".IndexOf(ch) < 0) S("blip");
                    typeNext += ch == '…' ? 0.11f : "，。！？".IndexOf(ch) >= 0 ? 0.16f : 0.032f;
                }
            }
            sayText.text = typeFull.Substring(0, Math.Min(typeI, typeFull.Length));
            // hfx：光每 3.6 秒從左掃到右（前 55% 停在左邊外面）、上緣的線 2 秒呼吸一次
            double tt = clock;
            float sw = (float)((tt % 3.6) / 3.6); float sp = sw < 0.55f ? 0 : EaseInOut((sw - 0.55f) / 0.45f);
            hfxSweep.style.left = Length.Percent(-60 + 190 * sp);
            float br = (float)((tt % 2) / 2); hfxLine.style.opacity = 1 - 0.65f * EaseInOut(br < 0.5f ? br * 2 : 2 - br * 2);
        }

        /// 新的一句台詞：換表情、紅框、雜訊抖一下、開始打字
        void NewLine(string s)
        {
            bool err = s.Contains("錯誤");
            mood = err ? "wow" : MoodOf(s);
            sayOn = true;
            if (err != sayErr) { sayErr = err; SaySkin(err); }
            glitchT = 0;
            typeFull = s; typeI = 0; typeNext = 0; typing = true;
        }
        static string MoodOf(string text)
        {
            if (System.Text.RegularExpressions.Regex.IsMatch(text, "哼|我設計的|開玩笑|大概|算了|還算|厲害")) return "smug";
            if (System.Text.RegularExpressions.Regex.IsMatch(text, "[！？!?]")) return "wow";
            return "normal";
        }

        /// 大小：寬 = 216 × 螢幕比例（320～520，偶數），放大蓋滿整個畫面（多的切掉一點點）
        void Resize()
        {
            float pw = root != null && root.layout.width > 0 ? root.layout.width : 1280, ph = root != null && root.layout.height > 0 ? root.layout.height : 720;
            W = Mathf.Clamp(Mathf.RoundToInt(H * pw / ph / 2) * 2, 320, 520);
            if (g == null) { g = new Pix2D(W, H); world = new Pix2D(W + 2 * M, H + 2 * M); }
            else if (g.W != W) { g.Resize(W); world.Resize(W + 2 * M); }
            if (fxF == null || fxF.W != W) { fxF = new Frame(W, H); fxImg = new byte[W * H * 4]; fxWorld = new Frame(W + 2 * M, H + 2 * M, -M, -M); fxWorldImg = new byte[(W + 2 * M) * (H + 2 * M) * 4]; }
            if (cv != null)
            {
                float k = Mathf.Max(pw / W, ph / H);
                Size(cv, Mathf.Ceil(W * k), Mathf.Ceil(H * k)); cv.style.marginLeft = -Mathf.Ceil(W * k) / 2; cv.style.marginTop = -Mathf.Ceil(H * k) / 2;
            }
        }

        /// 畫好的這一格貼上去：畫布、畫布上的字、水晶臉
        void Present()
        {
            if (cv == null) return;
            cv.style.backgroundImage = g.Upload(); cv.MarkDirtyRepaint();
            float pw = root.layout.width > 0 ? root.layout.width : 1280, ph = root.layout.height > 0 ? root.layout.height : 720, k = Mathf.Max(pw / W, ph / H);
            for (int i = 0; i < Texts.Count; i++)
            {
                if (i >= txtPool.Count) { var nl = Text(txtLayer, "", 8); nl.style.position = Position.Absolute; nl.style.whiteSpace = WhiteSpace.NoWrap; txtPool.Add(nl); }
                var o = Texts[i]; var l = txtPool[i];
                l.style.display = DisplayStyle.Flex; l.text = o.S; l.style.fontSize = o.Size * k; l.style.color = C(o.Col, o.Alpha);
                l.style.left = (float)o.X * k; l.style.top = (float)o.Y * k;
                l.style.translate = new Translate(new Length(o.Align == 1 ? -50 : o.Align == 2 ? -100 : 0, LengthUnit.Percent), 0);
            }
            for (int i = Texts.Count; i < txtPool.Count; i++) txtPool[i].style.display = DisplayStyle.None;
            int f = (int)Math.Floor(lastDrawT * 6.6) % 8;
            Img(sayFace, "face/" + (mood == "normal" && f == 6 ? "blink" : mood) + "-" + f);
        }
        double lastDrawT;

        // ================= 畫布的小工具（網頁版 intro.js 裡同名的那幾個） =================
        static double JR(double x) => Pf.Round(x);   // JS 的 Math.round
        static Color Rgba(string rgb, double a) { var p = rgb.Split(','); return new Color(int.Parse(p[0]) / 255f, int.Parse(p[1]) / 255f, int.Parse(p[2]) / 255f, (float)a); }
        static Color Hex(string h, float a = 1) => Pix2D.Hex(h, a);
        static readonly Dictionary<string, Color> rgbCache = new Dictionary<string, Color>();
        static Color Rgb(string rgb) { if (!rgbCache.TryGetValue(rgb, out var c)) rgbCache[rgb] = c = Rgba(rgb, 1); return c; }
        /// 一團光（中心 a 往外淡到 0）
        static void Glow(Pix2D d, double x, double y, double r, string col, double a) { if (r <= 0 || a <= 0) return; d.Glow(x, y, r, Rgb(col), (float)a); }
        void FadeTo(Pix2D d, double a, string col = "4,3,10") { if (a > 0) d.FillRect(0, 0, W, H, Rgba(col, Math.Min(1, a))); }
        // 畫布上的字：記下來給 UI 疊（等寬小字，像舊螢幕）
        void CText(string s, double x, double y, string col, float size = 8, int align = 0) => Texts.Add(new OverText { S = s, X = JR(x) + txOff, Y = JR(y), Col = col, Size = size, Align = align, Alpha = 1 });
        // 雜訊：把幾條橫的畫面切片左右錯開（字也跟著錯開）
        void Glitch(int n, double amp)
        {
            for (int i = 0; i < n; i++)
            {
                int y = (int)Math.Floor(Rnd() * H), h = 1 + (int)Math.Floor(Rnd() * 6), dx = (int)JR((Rnd() - 0.5) * amp);
                if (dx == 0) continue;
                g.ShiftRows(y, h, dx);
                for (int k = 0; k < Texts.Count; k++) { var o = Texts[k]; if (o.Y >= y && o.Y < y + h) { o.X += dx; Texts[k] = o; } }
            }
        }
        // 「！」：主角嚇一跳時頭上冒出來
        static void Bang(Pix2D d, double x, double y)
        {
            d.FillRect(x - 2, y - 1, 5, 11, Hex("#2a1626"));
            var c = Hex("#ffd84a"); d.FillRect(x - 1, y, 3, 6, c); d.FillRect(x - 1, y + 7, 3, 2, c);
        }
        // 特效畫進自己的 Frame，composite 後疊上來（world＝洞窟那層）
        void DrawFx(bool inWorld, params FxRun[] list)
        {
            var f = inWorld ? fxWorld : fxF; var img = inWorld ? fxWorldImg : fxImg; var d = inWorld ? world : g;
            f.Clear();
            foreach (var fx in list) fx?.Draw(f);
            f.Composite(img, null);
            d.DrawRgba(img, f.W, f.H);
        }
        // 主角某個姿勢的圖（左右翻時錨點也翻）
        (Img im, int ax, int ay) Hero(string name, bool flip = false)
        {
            if (!heroImg.TryGetValue(name, out var im)) return (null, 0, 0);
            var (w, ax, ay) = heroInfo[name];
            return (im, flip ? w - 1 - ax : ax, ay);
        }
        // 橢圓的外框（canvas 的 ellipse + stroke，粗 lw，邊緣柔一點）
        static void StrokeEllipse(Pix2D d, double cx, double cy, double rx, double ry, double lw, Color c)
        {
            if (rx <= 0 || ry <= 0 || c.a <= 0) return;
            int x0 = (int)Math.Floor(cx - rx - lw), x1 = (int)Math.Ceiling(cx + rx + lw), y0 = (int)Math.Floor(cy - ry - lw), y1 = (int)Math.Ceiling(cy + ry + lw);
            float a0 = c.a;
            for (int y = y0; y <= y1; y++)
                for (int x = x0; x <= x1; x++)
                {
                    double dx = x + 0.5 - cx, dy = y + 0.5 - cy, F = Math.Sqrt((dx / rx) * (dx / rx) + (dy / ry) * (dy / ry));
                    if (F <= 1e-6) continue;
                    double gx = dx / (rx * rx) / F, gy = dy / (ry * ry) / F, gl = Math.Sqrt(gx * gx + gy * gy), dist = Math.Abs((F - 1) / gl);
                    double cov = Math.Max(0, Math.Min(1, lw / 2 + 0.5 - dist));
                    if (cov <= 0) continue;
                    c.a = (float)(a0 * cov); d.FillRect(x, y, 1, 1, c);
                }
        }
        // 洞窟那層貼到螢幕：先平移 (sx, sy)，再以 (fx, fy) 為中心放大 zoom 倍（最近點取樣，像素畫）
        void Compose(int sx, int sy, double fx, double fy, double zoom)
        {
            int ww = world.W, wh = world.H; var src = world.Px; var dst = g.Px;
            for (int y = 0; y < H; y++)
            {
                double wy = fy + (y + 0.5 - sy - fy) / zoom; int iy = (int)Math.Floor(wy) + M;
                if (iy < 0 || iy >= wh) continue;
                for (int x = 0; x < W; x++)
                {
                    double wx = fx + (x + 0.5 - sx - fx) / zoom; int ix = (int)Math.Floor(wx) + M;
                    if (ix < 0 || ix >= ww) continue;
                    var c = src[iy * ww + ix]; if (c.a <= 0) continue;
                    int i = y * W + x; var d = dst[i];
                    if (c.a >= 1) { dst[i] = c; continue; }
                    float a = c.a, ia = 1 - a, oa = a + d.a * ia; if (oa <= 0) continue;
                    dst[i] = new Color((c.r * a + d.r * d.a * ia) / oa, (c.g * a + d.g * d.a * ia) / oa, (c.b * a + d.b * d.a * ia) / oa, oa);
                }
            }
        }

        // ================= 畫第 t 秒（dt＝跟上一格差多少秒） =================
        void Draw(double t, double dt)
        {
            lastDrawT = t;
            Texts.Clear(); txOff = 0;
            g.Clear(); g.Lighter = false; g.Alpha = 1; g.Tx = g.Ty = 0;
            g.FillRect(0, 0, W, H, Hex("#04030a"));
            // ---- 台詞
            while (lineI < LINES.Length && t >= LINES[lineI].t) { NewLine(LINES[lineI].s); lineI++; }
            if (SayHidden(t)) sayOn = false;

            if (t < T_SKY) DrawBoot(t);
            else if (t < T_DIVE) DrawSky(t, dt);
            else if (t < T_CAVE) DrawDive(t, dt);
            else DrawCave(t, dt);
        }

        // ================= A：系統開機 =================
        void DrawBoot(double t)
        {
            double cx = W / 2.0, cy = H * 0.42;
            // 0 ～ 0.7：中間一條全像光線展開
            double open = Math.Min(1, t / 0.7), w = JR(W * 0.5 * open);
            if (t < 7.4)
            {
                g.FillRect(JR(cx - w / 2), JR(cy), w, 1, Rgba("122,232,255", 0.5));
                Glow(g, cx, cy, 50 * open, "70,200,255", 0.14);
            }
            // 開機紀錄
            bool err = t > 4.6 && t < 6.2, ok = t >= 6.2;
            for (int i = 0; i < BOOT.Length; i++)
            {
                var (t0, s) = BOOT[i];
                if (t < t0) break;
                int n = (int)Math.Min(s.Length, Math.Floor((t - t0) * 40));
                CText(s.Substring(0, n) + ((t * 3) % 1 < 0.5 && n < s.Length ? "_" : ""), 18, 14 + i * 13, err ? "#ff8a7a" : "#7ae8ff", 11);   // 第 3 輪：8px 看不清楚 → 11px
            }
            if (t > 3.4 && t < 4.6) CText(new string('?', (int)Math.Floor((t - 3.4) * 6) % 6), 150, 14 + 4 * 13, "#7ae8ff", 11);
            // 紅色警告：閃爍、震動、整片泛紅
            if (err)
            {
                double k = t - 4.6; bool fl = (int)Math.Floor(k * 8) % 2 == 0; int sh = (int)JR((Rnd() - 0.5) * 6 * Math.Max(0, 1 - k / 1.2));
                FadeTo(g, 0.25 + (fl ? 0.12 : 0), "120,10,20");
                g.Tx = sh; txOff = sh;
                double bw = 190, bh = 46, bx = JR(cx - bw / 2), by = JR(cy - bh / 2 + 18);
                g.FillRect(bx, by, bw, bh, Hex("#1a0408"));
                var bc = Hex(fl ? "#ff3a4a" : "#a8141e"); g.FillRect(bx, by, bw, 2, bc); g.FillRect(bx, by + bh - 2, bw, 2, bc); g.FillRect(bx, by, 2, bh, bc); g.FillRect(bx + bw - 2, by, 2, bh, bc);
                CText("!! ERROR 0x5741 !!", cx, by + 8, fl ? "#ffffff" : "#ff8a7a", 8, 1);
                CText("種族不在資料庫", cx, by + 23, "#ffd0c8", 12, 1);
                g.Tx = 0; txOff = 0;
                Once("err", () => { S("hurt"); S("close"); });
            }
            // 強制寫入：金色框＋進度條
            if (ok && t < 7.4)
            {
                double k = Math.Min(1, (t - 6.2) / 1.0);
                double bw = 190, bh = 46, bx = JR(cx - bw / 2), by = JR(cy - bh / 2 + 18);
                g.FillRect(bx, by, bw, bh, Hex("#140c02"));
                var bc = Hex("#ffd84a"); g.FillRect(bx, by, bw, 2, bc); g.FillRect(bx, by + bh - 2, bw, 2, bc); g.FillRect(bx, by, 2, bh, bc); g.FillRect(bx + bw - 2, by, 2, bh, bc);
                CText("強制寫入：種族＝星靈", cx, by + 8, "#ffe9a0", 12, 1);
                g.FillRect(bx + 16, by + 30, bw - 32, 6, Hex("#3a2a10"));
                g.FillRect(bx + 16, by + 30, JR((bw - 32) * k), 6, bc);
                if (k >= 1) Once("okb", () => S("levelup"));
            }
            // 掃描線：一條亮線往下掃，加上淡淡的橫紋
            double sy = ((t * 70) % (H + 40)) - 20;
            g.FillRect(0, JR(sy), W, 6, Rgba("122,232,255", 0.08));
            var scan = new Color(0, 0, 0, 0.18f); for (int y = 0; y < H; y += 2) g.FillRect(0, y, W, 1, scan);
            // 雜訊：警告時很多
            Glitch(err ? 10 : t > 4.2 && t < 4.6 ? 4 : (t * 7) % 1 < 0.08 ? 2 : 0, err ? 24 : 10);
            // 7.4 ～ 8：像舊電視關機——畫面壓成一條白線再縮成一點
            if (t > 7.4)
            {
                double k = (t - 7.4) / 0.6, lw = JR(W * Math.Max(0, 1 - k * 1.6)), lh = Math.Max(1, JR(H * Math.Max(0, 0.4 - k)));
                g.FillRect(0, 0, W, H, Hex("#04030a"));
                Texts.Clear();   // 整片蓋黑了，字也看不到
                g.FillRect(JR(cx - lw / 2), JR(cy - lh / 2), Math.Max(2, lw), lh, Hex("#e8fbff"));
                Glow(g, cx, cy, 30 * (1 - k), "122,232,255", 0.5);
                Once("off", () => S("dash"));
            }
            FadeTo(g, t < 0.3 ? 1 - t / 0.3 : 0);
        }

        // ================= B：夜空流星雨 =================
        void DrawSky(double t, double dt)
        {
            double tb = t - T_SKY, pan = Math.Pow(Math.Min(1, tb / 5), 2);
            sky.Update(Math.Min(0.1, tb - skyLast)); skyLast = tb;
            g.FillRect(0, 0, W, H, Hex("#2c1a48"));
            g.Tile(sky.Img, -tb * 3, -pan * 10);
            if (tb > 0.4 && fallFx == null) { var pal = new string[8]; Array.Copy(GOLD, 1, pal, 0, 8); fallFx = new FxRun(FxSystem.Def("star-fall"), new FxOptions { X = JR(W * 0.55), Y = H - 52, Palette = pal, Seed = 13, Light = 0.6 }); }
            if (tb > 2.0 && heroFx == null) { heroFx = new FxRun(FxSystem.Def("star-meteor"), new FxOptions { X = JR(W * 0.32), Y = H - 46, Palette = GOLD, Flip = true, Light = 0.5 }.Set("clean", 1)); S("dash"); }
            fallFx?.Update(dt); heroFx?.Update(dt);
            DrawFx(false, fallFx, heroFx);
            g.Tile(far, -tb * 2 - 260, H - (far != null ? far.H : 216) + 40 - pan * 12);
            // 最後 0.8 秒：鏡頭猛地往那顆碎片推過去（白光蓋過來，接下一幕的跟拍）
            if (tb > 5.2) { double k = (tb - 5.2) / 0.8; Glow(g, W * 0.32, H * 0.55, 40 + k * 300, "255,236,170", Math.Min(1, k * 1.3)); }
            FadeTo(g, tb < 0.5 ? 1 - tb * 2 : 0);
        }

        // ================= B2：跟拍往下衝 =================
        void DrawDive(double t, double dt)
        {
            double td = t - T_DIVE, D = T_CAVE - T_DIVE;
            // 往下掉的速度：一開始快、穿雲最快、看到城鎮時慢一點（讓人看清楚）、最後衝進山谷再加速
            double fall = td * 160 + (td > 3 ? (td - 3) * -60 : 0) + (td > 5 ? Math.Pow(td - 5, 2) * 260 : 0);
            // 天空：上面深、下面亮一點的藍紫（城鎮那段是夜色）
            Color top = Hex("#140c2a"), bot = Hex(td < 3 ? "#3a2860" : "#241a40");
            for (int y = 0; y < H; y++) g.FillRect(0, y, W, 1, Color.Lerp(top, bot, (y + 0.5f) / H));
            // 星空往上飛走
            g.Tile(sky.Img, -td * 4, -((fall * 0.25) % 216));
            g.Tile(sky.Img, -td * 4, 216 - ((fall * 0.25) % 216));
            // 雲：三層，遠的慢、近的快
            void CloudLayer(int L, bool front)
            {
                foreach (var c in clouds)
                {
                    if (c.layer != L || td > 3.6) continue;
                    double sp = new[] { 0.5, 0.9, 1.6 }[L], y = ((c.y - fall * sp) % 900 + 900) % 900 - 120, s = 1 + L * 0.6;
                    if (y > H + 20 || y < -40) continue;
                    var col = front ? Rgba("214,206,240", 0.85) : L == 0 ? Rgba("90,72,140", 0.6) : Rgba("150,132,200", 0.7);
                    double hs = c.h * s;
                    for (double r = 0; r < hs; r += 2) { double ww = c.w * s * Math.Sqrt(1 - Math.Pow((r - hs / 2) / (hs / 2), 2)); g.FillRect(JR(c.x - ww / 2), JR(y + r), JR(ww), 2, col); }
                }
            }
            CloudLayer(0, false); CloudLayer(1, false);
            // 城鎮：從下面升上來，燈火一閃一閃
            if (td > 2.6 && td < 6)
            {
                double k = (td - 2.6) / 3.4, ty = H + 20 - k * 420;   // 第 3 輪：原本升得不夠高，城鎮的房子一直在畫面外
                g.Tile(tmid ?? far, -60 - td * 6, ty);
                for (int i = 0; i < 9; i++) { double lx = (i * 57 + 30) % W, ly = ty + 60 + ((i * 23) % 40); Glow(g, lx, ly, 6 + (Math.Sin(t * 5 + i) > 0 ? 2 : 0), "255,190,90", 0.7); }
            }
            // 山谷：最後衝進去（山從下面湧上來）
            if (td > 4.8)
            {
                double k = Math.Min(1, (td - 4.8) / 2.2), vy = H - k * 260;
                g.Tile(vfar, -td * 10, vy - 20); g.Tile(vmid, -td * 18, vy + 40);
            }
            // 速度線：往上飛
            foreach (var l in lines)
            {
                double y = ((l.y - fall * (l.sp / 300)) % 400 + 400) % 400 - 100;
                g.FillRect(JR(l.x % W), JR(y), 1, JR(l.len * (1 + Math.Min(1, td / 2))), l.hot ? Rgba("255,230,150", 0.55) : Rgba("200,210,255", 0.3));
            }
            // 主角那顆碎片：畫面中間偏上，蜷著身體往下掉（2 倍大），拖一條金色尾巴往上
            double hx = W / 2.0 + Math.Sin(td * 2.3) * 8, hy = H * 0.46 + Math.Sin(td * 3.1) * 3;
            for (int i = 14; i > 0; i--) Glow(g, hx + Math.Sin((td - i * 0.03) * 2.3) * 8 * 0.9, hy - i * 7, 10 - i * 0.5, "255,210,90", 0.12);
            Glow(g, hx, hy, 34, "255,226,140", 0.45);
            var (him, hax, hay) = Hero("fall-hurt"); const int S2 = 2;
            if (him != null) g.DrawImageScaled(him, JR(hx - hax * S2), JR(hy - hay * S2 + 18), him.W * S2, him.H * S2);
            Glow(g, hx, hy, 14, "255,255,230", 0.5);
            CloudLayer(2, true);   // 最近的雲蓋在主角前面
            // 穿雲的白閃、城鎮段的音效
            if (td > 0.9 && td < 1.05) FadeTo(g, 0.5, "230,226,255");
            Once("dive", () => S("dash"));
            if (td > 3) Once("town", () => S("chime:1318"));
            // 最後 0.5 秒：全黑（下一幕從洞窟裡看它砸下來）
            FadeTo(g, td < 0.25 ? 1 - td / 0.25 : td > D - 0.5 ? (td - (D - 0.5)) * 2 : 0);
        }

        // ================= C、T、D、E：洞窟 =================
        void DrawCave(double t, double dt)
        {
            double tc = t - T_CAVE;
            // 撞擊特效的時間：撞地前 0.35 秒放慢到 0.18 倍（慢動作），撞到之後恢復
            const double IMPACT = 0.67; double slow = crashT > IMPACT - 0.35 && crashT < IMPACT ? 0.18 : 1;
            crashT += dt * slow;
            double a = crashT - IMPACT;   // 撞地後幾秒（負的＝還沒撞）
            double quake = a > 0 && a < 0.8 ? (1 - a / 0.8) * 9 : t > T_DEEP + 3.2 && t < T_DEEP + 3.6 ? 2 : 0;
            int sx = quake != 0 ? (int)JR((Rnd() - 0.5) * quake) : 0, sy = quake != 0 ? (int)JR((Rnd() - 0.5) * quake * 0.7) : 0;
            double deep = t > T_DEEP ? Math.Min(1, (t - T_DEEP) / 2) : 0;   // E：鏡頭往右邊（洞窟深處）挪一點
            // D 段鏡頭推近到 2 倍（對準主角），E 段拉回 1.5 倍（看得到右邊的史萊姆）
            double zIn = t > T_WAKE ? Math.Min(1, (t - T_WAKE) / 1.2) : 0, ease = zIn * zIn * (3 - 2 * zIn);
            double zoom = 1 + ease * (1 - deep * 0.5), focusX = W / 2.0 + 12 + deep * 40, focusY = H - 52;
            // 場景畫在 world（world 座標＝畫布座標，四周多留 M），最後照鏡頭貼到螢幕
            var w0 = world; w0.Clear(); w0.Lighter = false; w0.Alpha = 1; w0.Tx = w0.Ty = M;
            double camX = deep * 40;
            w0.Tile(vback, -40 - camX * 0.2, 0); w0.Tile(vfar, -80 - camX * 0.4, 0); w0.Tile(vmid, -140 - camX * 0.7, 0);
            double gy = H - 40;
            w0.Tile(vground, -60 - camX, gy - 9);
            double cx = JR(W / 2.0 - camX);
            if (crashFx == null) crashFx = new FxRun(FxSystem.Def("meteor"), new FxOptions { X = JR(W / 2.0), Y = gy, Palette = GOLD, Light = 0.6, Seed = 5 });
            crashFx.Update(dt * slow);
            // 慢動作時四周壓暗
            if (slow < 1) FadeTo(w0, 0.35);
            // ---- 撞擊：衝擊波、碎石
            if (a > 0)
            {
                Once("boom", () => { S("bossLand"); S("boom"); });
                if (a < 0.7)
                {
                    double r = 10 + a * 260, al = 1 - a / 0.7;
                    StrokeEllipse(w0, W / 2.0, gy, r, r * 0.28, 3, Rgba("255,236,170", al));
                    StrokeEllipse(w0, W / 2.0, gy, r * 0.7, r * 0.2, 1, Rgba("255,255,255", al * 0.8));
                }
                foreach (var r in rocks)
                {
                    double tt = Math.Min(a, 1.6), x = W / 2.0 + Math.Cos(r.a) * r.v * tt, y = gy - 4 + Math.Sin(r.a) * r.v * tt + 220 * tt * tt;
                    if (y > gy + 2) continue;
                    w0.FillRect(JR(x), JR(y), r.s, r.s, Hex(r.spin < 0.5 ? "#6a5a7a" : "#3a2f4a"));
                    w0.FillRect(JR(x), JR(y), 1, 1, Hex("#a898b8"));
                }
            }
            // ---- 主角（撞地之後）
            if (a > 0)
            {
                double w = t - T_WAKE;   // 醒來的表演（負的＝還在煙裡）
                string q = "hurt"; bool flip = false, mark = false; double hx = cx, hy = gy + 3;
                if (w > 0.9) q = w < 1.1 || (w > 1.5 && w < 1.62) ? "hurt-blink" : "hurt-open";                     // 睜眼、眨一下
                if (w > 2.2) { q = "land"; hy = gy; }                                                                // 爬起來
                if (w > 2.6) q = "stand";
                if (w > 3.2) q = "look-open";                                                                        // 低頭看自己的手
                if (w > 3.8 && w < 4.4) q = (int)Math.Floor(w * 8) % 2 != 0 ? "look-open" : "look-blink";
                if (w > 4.4 && w < 5.2)
                {                                                                                                    // 嚇一跳：原地彈起來
                    double k = (w - 4.4) / 0.8; q = "jump"; hy = gy - JR(Math.Sin(k * Math.PI) * 22); mark = true;
                    Once("jump", () => S("chime:2093"));
                }
                if (w >= 5.2 && w < 5.5) { q = "land"; Once("land1", () => S("land")); }
                if (w >= 5.5 && w < 6.6) { double k = w - 5.5; q = "run#" + (int)Math.Floor(k * 10) % 4; hx = cx + JR(k * 22); }   // 想走路
                if (w >= 6.6 && w < 7.9) { hx = cx + 24; hy = gy + 3; q = "hurt"; Once("trip", () => { S("land:true"); S("squish"); }); }   // 跌個狗吃屎
                if (w >= 7.9) { hx = cx + 24; q = w < 8.2 ? "land" : "idle#" + (int)Math.Floor(t * 6.6) % 8; }
                if (w > 2.2) Once("up", () => S("land"));
                // E：轉頭看右邊的史萊姆
                if (t > T_DEEP + 3.4) flip = false;
                if (t > T_DEEP + 2.6 && t < T_DEEP + 3.4) flip = true;
                var (him, hax, hay) = Hero(q, flip);
                // 星星自己會發光（E 段黑暗裡更明顯）
                if (w > 0.9) Glow(w0, hx, hy - 10, 26 + deep * 10, "255,216,120", 0.18 + deep * 0.12);
                if (him != null) w0.DrawImage(him, JR(hx - hax), JR(hy - hay), flip);
                if (mark) Bang(w0, hx, hy - 34);
                if (w >= 6.6 && w < 7.3) { var dc = Rgba("200,190,220", 0.6); for (int i = 0; i < 6; i++) w0.FillRect(JR(hx - 10 + i * 4), JR(gy - 2 - ((w - 6.6) * 30 * (i % 3)) % 8), 2, 2, dc); }   // 跌倒揚起的灰
            }
            DrawFx(true, crashFx);
            if (a > 0 && a < 0.14) w0.FillRect(-10, -10, W + 20, H + 20, Rgba("255,250,235", 1 - a / 0.14));
            // ---- E：洞窟深處——史萊姆從右邊探頭
            if (deep > 0)
            {
                FadeTo(w0, deep * 0.45);
                double te = t - T_DEEP;
                if (te > 2.4)
                {
                    if (slime == null) { slime = new FxRun(FxSystem.Def("slime"), new FxOptions { X = W + 30, Y = gy, Flip = true, Light = 0.3 }); S("squish"); }
                    double k = Math.Min(1, (te - 2.4) / 1.2);
                    slime.Options.X = JR(W + 30 - k * 140);   // 第 3 輪：鏡頭推近 1.5 倍，原本停的位置在畫面外
                    slime.Update(dt);
                }
            }
            if (slime != null) DrawFx(true, slime);
            w0.Tx = w0.Ty = 0;
            Compose(sx, sy, focusX, focusY, zoom);
            // 黑暗裡的眼睛：畫在螢幕座標（鏡頭推近後才不會被推到畫面外）
            if (deep > 0)
            {
                double te = t - T_DEEP;
                foreach (var e in eyes)
                {
                    if (te < e.t0) continue;
                    double k = Math.Min(1, (te - e.t0) / 0.4); bool bl = (te + e.blink) % 3.2 < 0.12;
                    if (bl) continue;
                    double ex = e.x > 0 ? e.x : W + e.x; var col = Hex(e.red ? "#ff4a3a" : "#ffd84a"); string gl = e.red ? "255,80,60" : "255,216,74";
                    Glow(g, ex + 3, e.y + 1, 7, gl, 0.55 * k);
                    g.Alpha = (float)k; g.FillRect(JR(ex), JR(e.y), 3, 2, col); g.FillRect(JR(ex + 6), JR(e.y), 3, 2, col); g.Alpha = 1;
                }
            }
            // ---- 標題：「轉生成星星碎片的我」砸下來
            double ttl = t - T_TITLE;
            if (ttl > 0 && ttl < T_WAKE - T_TITLE + 0.3)
            {
                double drop = Math.Min(1, ttl / 0.28), bounce = ttl > 0.28 && ttl < 0.5 ? Math.Sin(((ttl - 0.28) / 0.22) * Math.PI) * 4 : 0;
                double s = 1 + (1 - drop) * 1.6, al = Math.Min(1, ttl / 0.15) * (ttl > 4 ? Math.Max(0, 1 - (ttl - 4) / 0.6) : 1);
                if (ttl > 0.28) Once("title", () => { S("bossLand"); S("levelup"); });
                double oy = H * 0.36 - bounce + (ttl > 0.28 && ttl < 0.6 ? JR((Rnd() - 0.5) * 4) : 0);
                g.Alpha = (float)al;
                // 用標題畫面那張正式的標題字（art/ui/logo.png）；沒有的話才用字
                var L = logo;
                if (L != null)
                {
                    double k = Math.Min((W * 0.86) / L.W, (H * 0.42) / L.H), lx = JR((-L.W * k) / 2), ly = JR((-L.H * k) / 2), lw = JR(L.W * k), lh = JR(L.H * k);
                    g.DrawImageScaled(L, W / 2.0 + lx * s, oy + ly * s, lw * s, lh * s);
                }
                else
                {
                    Texts.Add(new OverText { S = "轉生成星星碎片的我", X = W / 2.0, Y = oy - 11 * s, Col = "#ffd84a", Size = (float)(22 * s), Align = 1, Alpha = (float)al });
                    if (ttl > 1.0) Texts.Add(new OverText { S = "～靠吸收魔物變成最強～", X = W / 2.0, Y = H * 0.36 + 21 - 6, Col = "#e8e0ff", Size = 11, Align = 1, Alpha = (float)(Math.Min(1, (ttl - 1) / 0.6) * al) });
                }
                g.Alpha = 1;
                if (ttl > 0.28 && ttl < 0.5) Glow(g, W / 2.0, H * 0.36, 120, "255,226,140", 0.5 * (1 - (ttl - 0.28) / 0.22));
            }
            // 四周壓暗（越深越暗）＋淡入淡出
            g.Radial(W / 2.0, H * 0.6, H * 0.2, W * 0.65, new[] { (0f, Rgba("4,3,10", 0)), (1f, Rgba("4,3,10", 0.7 + deep * 0.2)) }, 0, 0, W, H);
            FadeTo(g, tc < 0.3 ? 1 - tc / 0.3 : t > END - 0.8 ? (t - (END - 0.8)) / 0.8 : 0);
        }

        // ================= 夜空（共用 NightSky）：開場用的圖 =================
        class Sky
        {
            readonly NightSky ns = new NightSky();
            public readonly Img Img = new Img(NightSky.W, NightSky.H);
            public Sky() { Update(0); }
            public void Update(double dt) { ns.Update(dt); ns.CopyTo(Img); }
        }
    }
}
