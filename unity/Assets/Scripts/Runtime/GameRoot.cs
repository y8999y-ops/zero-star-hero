// 遊戲的進入點：開場景就自動建立（不用在場景裡擺東西）。把 Unity 的按鍵、滑鼠、觸控轉成 GameInput，驅動 Game，畫血條和手機按鈕。
// 命令列：-shot <資料夾>：照比對測試的那串按鍵自動玩，在幾個時間點截圖後關閉（給自動測試用）。
using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
using PixelFX;

namespace ZeroStar
{
    public class GameRoot : MonoBehaviour
    {
        PixelScreen screen;
        Game game;
        // 自動玩（-shot）
        string shotDir; List<(int t, string type, string code)> script; int tickN, si; readonly int[] shotAt = { 760, 790, 2660, 2700, 2930, 3170, 3420, 3480 }; int shotNo;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void Boot()
        {
            if (FindAnyObjectByType<GameRoot>() != null) return;
            var go = new GameObject("GameRoot");
            go.AddComponent<PixelScreen>();
            go.AddComponent<GameRoot>();
        }

        void Start()
        {
            screen = GetComponent<PixelScreen>();
            Game.W = screen.W;
            screen.Resized += w => Game.W = w;
            var args = Environment.GetCommandLineArgs();
            for (int i = 0; i < args.Length - 1; i++) if (args[i] == "-shot") shotDir = args[i + 1];
            if (shotDir != null) { Application.runInBackground = true; Directory.CreateDirectory(shotDir); script = TraceScript.Load(TraceScript.DefaultPath()).events; Rnd.R = new Rng(12345); }
            // 暖身：裝備產生、數值計算第一次用到時要編譯程式（會卡一下），載入時先做掉；用另一組亂數，不影響遊戲
            { var saved = Rnd.R; Rnd.R = new Rng(1); var eq = new Dictionary<string, Item> { ["weapon"] = null, ["head"] = null, ["body"] = null, ["hands"] = null, ["feet"] = null, ["acc1"] = null, ["acc2"] = null };
              for (int i = 0; i < 40; i++) { var it = Items.MakeItem(1 + i * 2, i % 6); Items.Compare(it, eq, 10); } Items.ComputeStats(eq, 10); Rnd.R = saved; }
            game = new Game();
            game.OnSay = msg => { sayText = msg; sayT = 2.6f; };
            game.OnPickup = it => { sayText = "撿到：" + it.Name; sayT = 1.6f; };
            if (shotDir != null && TraceScript.Load(TraceScript.DefaultPath()).tree == "max") game.MaxTree();
            if (shotDir == null) { var (c, sh) = Items.StarterGear(); game.Equip["weapon"] = c; game.Equip["body"] = sh; game.ApplyStats(); }   // 新存檔的初始裝備（存檔在階段 5）
            screen.Tick += OnTick;
            screen.Draw += f => game.Render(f);
            screen.PostComposite += d => game.PostComposite(d);
#if UNITY_ANDROID || UNITY_IOS
            game.Vibrate = () => Handheld.Vibrate();   // 大招落地震一下（手機）
#endif
            touchMode = Input.touchSupported && Application.isMobilePlatform;
        }

        static readonly (KeyCode k, string code)[] KEYS =
        {
            (KeyCode.A, "KeyA"), (KeyCode.D, "KeyD"), (KeyCode.S, "KeyS"), (KeyCode.W, "KeyW"),
            (KeyCode.LeftArrow, "ArrowLeft"), (KeyCode.RightArrow, "ArrowRight"), (KeyCode.DownArrow, "ArrowDown"), (KeyCode.UpArrow, "ArrowUp"),
            (KeyCode.Space, "Space"), (KeyCode.Z, "KeyZ"), (KeyCode.X, "KeyX"), (KeyCode.J, "KeyJ"), (KeyCode.K, "KeyK"), (KeyCode.C, "KeyC"),
            (KeyCode.LeftShift, "ShiftLeft"), (KeyCode.E, "KeyE"), (KeyCode.U, "KeyU"), (KeyCode.V, "KeyV"), (KeyCode.Q, "KeyQ"), (KeyCode.L, "KeyL"),
            (KeyCode.B, "KeyB"), (KeyCode.F, "KeyF"),
        };

        void Update()
        {
            if (shotDir != null) return;
            var inp = game.Input;
            foreach (var (k, code) in KEYS)
            {
                if (Input.GetKeyDown(k)) inp.KeyDown(code);
                if (Input.GetKeyUp(k)) inp.KeyUp(code);
            }
            if (Input.touchCount == 0)
            {
                inp.Mouse(Input.GetMouseButton(0));
                if (Input.GetMouseButtonDown(1)) inp.Press("dash");
            }
            else touchMode = true;
            if (touchMode) UpdateTouch(inp);
            // 換形態：1～5 直接選、O 換下一個（網頁版只帶 3 個；階段 2 先全部都能用）
            for (int i = 0; i < game.Carry.Length; i++) if (Input.GetKeyDown(KeyCode.Alpha1 + i)) game.PendingForm = game.Carry[i];
            if (Input.GetKeyDown(KeyCode.O)) game.PendingForm = NextForm();
            // 開發用：T＝技能樹全部點滿／全部清掉（之後有技能樹畫面再拿掉）
            if (Input.GetKeyDown(KeyCode.T)) { if (game.Tree.Count > 0) game.Tree.Clear(); else game.MaxTree(); }
            // 開發用：G＝把背包裡比身上好的裝備換上去（背包畫面在階段 4）
            if (Input.GetKeyDown(KeyCode.G)) game.EquipBetter();
            if (Input.GetKeyDown(KeyCode.Escape) && !Application.isEditor) Application.Quit();
        }

        string NextForm() { int i = Array.IndexOf(game.Carry, game.Player.Form); return game.Carry[(i + 1) % game.Carry.Length]; }

        void OnTick(double dt)
        {
            if (shotDir != null)
            {
                while (si < script.Count && script[si].t == tickN) { var e = script[si++]; if (e.type == "f") game.PendingForm = e.code; else if (e.type == "m") game.Player.Mp = game.Player.MaxMp; else if (e.type == "x") game.GainXp(int.Parse(e.code)); else if (e.type == "i") game.DropItem(game.Player.X + 40 * game.Player.Face, game.Player.Y - 12, int.Parse(e.code)); else if (e.type == "d") game.Input.KeyDown(e.code); else game.Input.KeyUp(e.code); }
                if (shotNo < shotAt.Length && tickN == shotAt[shotNo]) { ScreenCapture.CaptureScreenshot(Path.Combine(shotDir, $"play-{shotNo}.png")); shotNo++; }
                if (tickN % 30 == 0) Debug.Log($"[Perf] 第 {tickN} 步{(game.Ult.On ? "（大招）" : "")}：{screen.Fps:F0} fps，平均 {screen.AvgMs:F2} ms，最慢 {screen.MaxMs:F2} ms");
                if (shotNo >= shotAt.Length && tickN > shotAt[shotAt.Length - 1] + 20) Application.Quit();
            }
            game.Tick(dt);
            game.SimMs += 1000 / 60.0;
            tickN++;
        }

        // ---- 手機觸控（input.js 的 initTouch）：左半邊拖動＝走、往上快滑＝跳、往下快滑＝穿平台；右下角攻擊（按住）、閃避
        bool touchMode;
        const double DEAD = 10, FULL = 38, FOLLOW = 60, SWIPE = 26, SWIPE_AIR = 16, SWIPE_TIME = 0.18;
        int stickId = -1; double ax, ay, lockT; readonly List<(double y, double t)> hist = new List<(double, double)>();
        Vector2 stickPos, knobOff;
        readonly Dictionary<int, string> btnOf = new Dictionary<int, string>();
        static float Css => Screen.dpi > 0 ? Mathf.Max(1, Screen.dpi / 160f) : 2.5f;
        // 按鈕的位置（螢幕像素，左上原點）：攻擊最大、在右下角；閃避在它左邊
        (Vector2 c, float r) AtkBtn { get { float A = Mathf.Clamp(Screen.height / Css * 0.19f, 58, 86) * Css; return (new Vector2(Screen.width - 14 * Css - A * 0.55f, Screen.height - 12 * Css - A * 0.55f), A * 0.55f); } }
        (Vector2 c, float r) DashBtn { get { var a = AtkBtn; float B = a.r * 2 * 0.7f; return (new Vector2(a.c.x - a.r - B * 0.7f, a.c.y + a.r - B * 0.5f), B * 0.5f); } }
        (Vector2 c, float r) SkillBtn { get { var a = AtkBtn; float B = a.r * 2 * 0.68f; return (new Vector2(a.c.x - a.r * 0.15f, a.c.y - a.r - B * 0.62f), B * 0.5f); } }
        (Vector2 c, float r) UltBtn { get { var a = AtkBtn; var k = SkillBtn; return (new Vector2(k.c.x - k.r * 2.3f, k.c.y + k.r * 0.2f), k.r); } }
        (Vector2 c, float r) AbsorbBtn { get { var a = AtkBtn; return (new Vector2(a.c.x - a.r * 0.2f, a.c.y - a.r * 2.9f), a.r * 0.6f); } }
        (Vector2 c, float r) FormBtn { get { var a = AtkBtn; float B = a.r * 2 * 0.55f; return (new Vector2(Screen.width - 14 * Css - B * 0.5f, a.c.y - a.r * 2.6f - B * 0.5f), B * 0.5f); } }

        void UpdateTouch(GameInput inp)
        {
            double now = Time.unscaledTimeAsDouble;
            bool atk = false, absorbHeld = false;
            for (int i = 0; i < Input.touchCount; i++)
            {
                var t = Input.GetTouch(i);
                var p = new Vector2(t.position.x, Screen.height - t.position.y);   // 左上原點
                double x = p.x / Css, y = p.y / Css;
                if (t.phase == TouchPhase.Began)
                {
                    var a = AtkBtn; var d = DashBtn;
                    if (game.AbsorbNear != null && Vector2.Distance(p, AbsorbBtn.c) < AbsorbBtn.r) { btnOf[t.fingerId] = "absorb"; }
                    else if (Vector2.Distance(p, a.c) < a.r) { btnOf[t.fingerId] = "attack"; }
                    else if (Vector2.Distance(p, d.c) < d.r) { btnOf[t.fingerId] = "dash"; inp.Press("dash"); }
                    else if (Vector2.Distance(p, SkillBtn.c) < SkillBtn.r) { btnOf[t.fingerId] = "skill"; inp.Press("skill"); }
                    else if (Vector2.Distance(p, UltBtn.c) < UltBtn.r) { btnOf[t.fingerId] = "ult"; inp.Press("ult"); }
                    else if (Vector2.Distance(p, FormBtn.c) < FormBtn.r) { btnOf[t.fingerId] = "form"; game.PendingForm = NextForm(); }
                    else if (p.x < Screen.width / 2f)
                    {
                        if (inp.Air) { inp.Press("jump"); inp.JumpHeld = true; }   // 在空中點一下左半邊＝二段跳
                        if (stickId < 0) { stickId = t.fingerId; ax = x; ay = y; hist.Clear(); hist.Add((y, now)); stickPos = p; knobOff = Vector2.zero; }
                    }
                }
                if (btnOf.TryGetValue(t.fingerId, out var b) && b == "attack" && t.phase != TouchPhase.Ended && t.phase != TouchPhase.Canceled) atk = true;
                if (b == "absorb" && t.phase != TouchPhase.Ended && t.phase != TouchPhase.Canceled) absorbHeld = true;
                if (t.fingerId == stickId && (t.phase == TouchPhase.Moved || t.phase == TouchPhase.Stationary))
                {
                    double dx = x - ax;
                    if (Math.Abs(dx) > FOLLOW) { ax += dx - Math.Sign(dx) * FOLLOW; dx = x - ax; }
                    inp.TouchMove = Math.Abs(dx) < DEAD ? 0 : Math.Sign(dx) * Math.Min(1, (Math.Abs(dx) - DEAD) / (FULL - DEAD) * 0.6 + 0.4);
                    hist.Add((y, now));
                    while (hist.Count > 2 && now - hist[0].t > SWIPE_TIME) hist.RemoveAt(0);
                    double maxY = double.MinValue, minY = double.MaxValue; foreach (var h in hist) { maxY = Math.Max(maxY, h.y); minY = Math.Min(minY, h.y); }
                    double up = y - maxY, down = y - minY;
                    if (up < -(inp.Air ? SWIPE_AIR : SWIPE) && now > lockT) { inp.Press("jump"); lockT = now + 0.22; inp.JumpHeld = true; hist.Clear(); hist.Add((y, now)); ay = y; }
                    else if (down > SWIPE && !inp.Air) { inp.Press("drop"); hist.Clear(); hist.Add((y, now)); ay = y; }
                    knobOff = new Vector2((float)Math.Max(-34, Math.Min(34, dx)), (float)Math.Max(-30, Math.Min(30, y - ay))) * Css;
                }
                if (t.phase == TouchPhase.Ended || t.phase == TouchPhase.Canceled)
                {
                    btnOf.Remove(t.fingerId);
                    if (t.fingerId == stickId) { stickId = -1; inp.TouchMove = 0; inp.JumpHeld = false; }
                }
            }
            inp.TouchAttack = atk;
            inp.TouchAbsorb = absorbHeld;
        }

        // ---- 介面（暫時版：血條、魔力條、手機按鈕；正式的介面在階段 3 用 UI Toolkit 重做）
        Texture2D white, circle;
        GUIStyle perfStyle, nameStyle, infoStyle;
        string sayText; float sayT;
        static Texture2D Circle(int n)
        {
            var t = new Texture2D(n, n) { filterMode = FilterMode.Bilinear };
            for (int y = 0; y < n; y++) for (int x = 0; x < n; x++) { float d = Vector2.Distance(new Vector2(x + 0.5f, y + 0.5f), new Vector2(n / 2f, n / 2f)) / (n / 2f); t.SetPixel(x, y, new Color(1, 1, 1, Mathf.Clamp01((1 - d) * n / 2f))); }
            t.Apply();
            return t;
        }
        void OnGUI()
        {
            if (game == null) return;
            if (white == null) { white = Texture2D.whiteTexture; circle = Circle(128); }
            float u = Mathf.Max(1, Screen.height / 360f);
            // 血條（左上）
            float x = 14 * u, y = 12 * u, w = 120 * u, h = 9 * u;
            Rect(x - u, y - u, w + 2 * u, h + 2 * u, new Color(0.07f, 0.05f, 0.1f, 0.9f));
            Rect(x, y, w, h, new Color(0.25f, 0.08f, 0.12f));
            Rect(x, y, w * (float)(game.Player.Hp / game.Player.MaxHp), h, new Color(0.9f, 0.25f, 0.3f));
            Rect(x, y, w * (float)(game.Player.Hp / game.Player.MaxHp), 2 * u, new Color(1f, 0.55f, 0.55f));
            // 魔力條
            y += h + 4 * u; h = 5 * u;
            Rect(x - u, y - u, w * 0.8f + 2 * u, h + 2 * u, new Color(0.07f, 0.05f, 0.1f, 0.9f));
            Rect(x, y, w * 0.8f * (float)(game.Player.Mp / game.Player.MaxMp), h, new Color(0.35f, 0.6f, 1f));
            // 等級、金幣、背包；系統訊息（暫時版）
            if (infoStyle == null) infoStyle = new GUIStyle(GUI.skin.label);
            infoStyle.fontSize = Mathf.RoundToInt(10 * u); infoStyle.normal.textColor = new Color(1, 0.95f, 0.8f, 0.85f);
            GUI.Label(new UnityEngine.Rect(14 * u, 34 * u, 300 * u, 18 * u), $"Lv {game.Lv}　金幣 {game.Money}　背包 {game.Inv.Count}　形態 {string.Join("", game.FormsOwned.Keys)}", infoStyle);
            if (sayT > 0)
            {
                sayT -= Time.unscaledDeltaTime;
                infoStyle.fontSize = Mathf.RoundToInt(12 * u);
                GUI.Label(new UnityEngine.Rect(14 * u, Screen.height * 0.62f, Screen.width * 0.6f, 24 * u), sayText, infoStyle);
            }
            if (game.AbsorbNear != null) { infoStyle.fontSize = Mathf.RoundToInt(11 * u); GUI.Label(new UnityEngine.Rect(Screen.width * 0.4f, Screen.height * 0.3f, 300 * u, 20 * u), touchMode ? "按住右下的吸收鍵" : "按住 F 吸收", infoStyle); }
            // 大招名（網頁版是 HTML 文字，跟特寫帶一起出現）
            if (game.Ult.On && game.Ult.T >= game.Ult.NameAt)
            {
                if (nameStyle == null) nameStyle = new GUIStyle(GUI.skin.label) { alignment = TextAnchor.MiddleCenter, fontStyle = FontStyle.Bold };
                nameStyle.fontSize = Mathf.RoundToInt(26 * u); nameStyle.normal.textColor = new Color(1f, 0.92f, 0.6f);
                GUI.Label(new UnityEngine.Rect(0, Screen.height * 0.18f, Screen.width, 40 * u), game.Ult.Name, nameStyle);
            }
            // 效能（右上角）：每秒幾格、每格算畫面花幾毫秒
            if (perfStyle == null) perfStyle = new GUIStyle(GUI.skin.label) { alignment = TextAnchor.UpperRight, fontSize = Mathf.RoundToInt(10 * u) };
            perfStyle.normal.textColor = new Color(1, 1, 1, 0.55f);
            GUI.Label(new UnityEngine.Rect(Screen.width - 220 * u, 6 * u, 210 * u, 20 * u), $"{screen.Fps:F0} fps  {screen.AvgMs:F1} ms（最慢 {screen.MaxMs:F0}）  {screen.W}×216", perfStyle);
            if (touchMode)
            {
                var a = AtkBtn; var d = DashBtn;
                Disc(a.c, a.r, game.Input.TouchAttack ? new Color(1f, 0.82f, 0.3f, 0.75f) : new Color(0.95f, 0.72f, 0.2f, 0.45f));   // 攻擊＝金色（主要按鈕）
                Disc(d.c, d.r, new Color(0.62f, 0.55f, 0.72f, 0.4f));                                                                   // 閃避＝紫灰
                var sk = SkillBtn; Disc(sk.c, sk.r, game.Player.Mp >= Player.MP_COST && game.Player.SkillCd <= 0 ? new Color(0.62f, 0.55f, 0.72f, 0.5f) : new Color(0.3f, 0.28f, 0.35f, 0.4f));   // 技能
                if (game.AbsorbNear != null) { var ab = AbsorbBtn; Disc(ab.c, ab.r, game.Input.TouchAbsorb ? new Color(0.5f, 1f, 0.5f, 0.75f) : new Color(0.4f, 0.85f, 0.4f, 0.5f)); }   // 吸收（旁邊有魔物核時才出現）
                var ub = UltBtn; Disc(ub.c, ub.r, game.Player.Mp >= Ult.ULT_MP ? new Color(0.95f, 0.72f, 0.2f, 0.6f) : new Color(0.3f, 0.28f, 0.35f, 0.4f));   // 大招（魔力夠了變金色）
                var fb = FormBtn; ColorUtility.TryParseHtmlString(Game.FORM_COLOR[game.Player.Form], out var fc); fc.a = 0.55f; Disc(fb.c, fb.r, fc);   // 換形態（目前形態的顏色）
                if (stickId >= 0) { Disc(stickPos, 55 * Css, new Color(1, 1, 1, 0.08f)); Disc(stickPos + knobOff, 22 * Css, new Color(1, 1, 1, 0.3f)); }
            }
        }
        void Rect(float x, float y, float w, float h, Color c) { var o = GUI.color; GUI.color = c; GUI.DrawTexture(new UnityEngine.Rect(x, y, w, h), white); GUI.color = o; }
        void Disc(Vector2 c, float r, Color col) { var o = GUI.color; GUI.color = col; GUI.DrawTexture(new UnityEngine.Rect(c.x - r, c.y - r, r * 2, r * 2), circle); GUI.color = o; }
    }

    /// 比對測試的那串按鍵（game/tools/unity-trace-script.json）
    public class TraceScript
    {
        public int ticks, frameEvery; public string tree;
        public List<(int t, string type, string code)> events = new List<(int, string, string)>();
        public static string DefaultPath() => Path.GetFullPath(Path.Combine(Application.dataPath, "..", "..", "game", "tools", "unity-trace-script.json"));
        public static TraceScript Load(string path)
        {
            var s = new TraceScript();
            string txt = File.Exists(path) ? File.ReadAllText(path) : (Resources.Load<TextAsset>("Baked/trace-script")?.text ?? "{}");
            s.ticks = Num(txt, "\"ticks\""); s.frameEvery = Num(txt, "\"frameEvery\"");
            var tm = System.Text.RegularExpressions.Regex.Match(txt, "\"tree\"\\s*:\\s*\"(\\w+)\"");
            if (tm.Success) s.tree = tm.Groups[1].Value;
            int i = txt.IndexOf("\"events\"");
            if (i >= 0)
            {
                var m = System.Text.RegularExpressions.Regex.Matches(txt.Substring(i), "\\[\\s*(\\d+)\\s*,\\s*\"(\\w)\"\\s*,\\s*\"(\\w*)\"\\s*\\]");
                foreach (System.Text.RegularExpressions.Match x in m) s.events.Add((int.Parse(x.Groups[1].Value), x.Groups[2].Value, x.Groups[3].Value));
            }
            s.events = System.Linq.Enumerable.ToList(System.Linq.Enumerable.OrderBy(s.events, a => a.t));   // 穩定排序（同一步的事件照檔案裡的順序），跟網頁版一樣
            return s;
        }
        static int Num(string txt, string key) { int i = txt.IndexOf(key); if (i < 0) return 0; var m = System.Text.RegularExpressions.Regex.Match(txt.Substring(i + key.Length), "\\d+"); return int.Parse(m.Value); }
    }
}
