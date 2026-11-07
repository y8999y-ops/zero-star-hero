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
        string shotDir; List<(int t, string type, string code)> script; int tickN, si; readonly int[] shotAt = { 760, 790, 2660, 2700, 2930, 3170, 3420, 3480 }; int shotNo, scTicks;

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
            for (int i = 0; i < args.Length - 1; i++) if (args[i] == "-mapshot") mapShot = args[i + 1];   // 開發用：打開地圖、換幾個地點各截一張圖
            if (shotDir != null) { Application.runInBackground = true; Directory.CreateDirectory(shotDir); var ts = TraceScript.Load(TraceScript.DefaultPath()); script = ts.events; scTicks = ts.ticks; Rnd.R = new Rng(12345); }
            // 暖身：裝備產生、數值計算第一次用到時要編譯程式（會卡一下），載入時先做掉；用另一組亂數，不影響遊戲
            { var saved = Rnd.R; Rnd.R = new Rng(1); var eq = new Dictionary<string, Item> { ["weapon"] = null, ["head"] = null, ["body"] = null, ["hands"] = null, ["feet"] = null, ["acc1"] = null, ["acc2"] = null };
              for (int i = 0; i < 40; i++) { var it = Items.MakeItem(1 + i * 2, i % 6); Items.Compare(it, eq, 10); } Items.ComputeStats(eq, 10); Rnd.R = saved; }
            var sc = shotDir != null ? TraceScript.Load(TraceScript.DefaultPath()) : null;
            screen.Tick += OnTick;
            screen.Draw += f => { if (map != null) { screen.Zoom = 1; DrawMap(f); return; } screen.Zoom = Game.Zoom; game.Render(f); };   // 王戰時鏡頭拉遠（Game.Zoom）
            screen.PostComposite += d => { if (map == null) game.PostComposite(d); };
            NewGame(sc?.stage ?? "1-1", null, sc != null ? TraceScript.DefaultPath() : null);
            touchMode = Input.touchSupported && Application.isMobilePlatform;
            if (mapShot != null) { Directory.CreateDirectory(mapShot); game.Cleared_.UnionWith(new[] { "1-1", "1-2" }); OpenMap(false); }
        }
        string mapShot; int mapShotN;

        static readonly string[] ORDER = { "1-1", "1-2", "1-3", "1-4" };

        // ---- 選關世界地圖（worldmap.js 的 openWorldMap）：進傳送門之後打開（網頁版是回碎星鎮、走到路標才打開；碎星鎮在階段 4）
        WorldMap map; bool mapFromLeave; string mapMsg; float mapMsgT; UnityEngine.Rect cardRect;
        static readonly Dictionary<string, string> NOTE = new Dictionary<string, string> { ["1-1"] = "主角掉下來的地方，系統教你怎麼打", ["1-2"] = "垃圾桶怪很多", ["1-3"] = "蝙蝠群、菁英", ["1-4"] = "王：大胃王史萊姆" };
        readonly Dictionary<string, Texture2D> thumbs = new Dictionary<string, Texture2D>();
        GUIStyle mapStyle;
        int MapOx => (screen.W - map.Frame.W) / 2;
        int MapOy => (216 - map.Frame.H) / 2;
        void OpenMap(bool fromLeave)
        {
            map = new WorldMap(game.Cleared_); mapFromLeave = fromLeave; mapMsg = null;
            game.Sfx("open");
        }
        void CloseMap() { map = null; game.Sfx("close"); }
        /// 出發：關卡＝換到那一關（等級、裝備這些帶過去）；碎星鎮、無限討伐還沒搬過來
        void MapGo(string id)
        {
            if (id == null) return;
            if (id == "town") { if (!mapFromLeave) CloseMap(); else { mapMsg = "碎星鎮要等階段 4 才搬過來，先選一關出發吧。"; mapMsgT = 3; } return; }
            if (id == "endless") { mapMsg = "無限討伐還沒搬到 Unity。"; mapMsgT = 3; return; }
            if (Array.IndexOf(WorldMap.STAGES, id) >= 0 && map.Nodes[id].Open) { map = null; game.Sfx("ui"); NewGame(id, game); }
        }
        void MapInput()
        {
            if (Input.GetKeyDown(KeyCode.RightArrow) || Input.GetKeyDown(KeyCode.D)) { map.SelectNext(1); game.Sfx("ui"); }
            if (Input.GetKeyDown(KeyCode.LeftArrow) || Input.GetKeyDown(KeyCode.A)) { map.SelectNext(-1); game.Sfx("ui"); }
            if (Input.GetKeyDown(KeyCode.Return) || Input.GetKeyDown(KeyCode.Space) || Input.GetKeyDown(KeyCode.F)) MapGo(map.Sel);
            if (map != null && Input.GetKeyDown(KeyCode.Escape) && !mapFromLeave) CloseMap();
            if (map == null) return;
            // 點地圖：找最近的地點；點已經選的那個＝出發（點在資訊卡上不算，那裡有自己的按鈕）
            Vector2? tap = null;
            if (Input.touchCount > 0 && Input.GetTouch(0).phase == TouchPhase.Began) tap = Input.GetTouch(0).position;
            else if (Input.touchCount == 0 && Input.GetMouseButtonDown(0)) tap = Input.mousePosition;
            if (tap != null && !cardRect.Contains(new Vector2(tap.Value.x, Screen.height - tap.Value.y)))
            {
                var c = screen.ScreenToCanvas(tap.Value);
                string id = map.Pick(c.x - MapOx, c.y - MapOy);
                if (id != null) { if (map.Select(id)) MapGo(id); else game.Sfx("ui"); }
            }
        }
        /// 地圖畫在畫布中間（320×180），四周塗暗
        void DrawMap(Frame f)
        {
            uint bg = 0xff100a0a; var C = f.Color; var L = f.Light;
            for (int i = 0; i < C.Length; i++) { C[i] = bg; L[i] = 0; }
            var m = map.Frame; int ox = MapOx, oy = MapOy;
            for (int y = 0; y < m.H; y++)
            {
                int fy = y + oy; if (fy < 0 || fy >= f.H) continue;
                for (int x = 0; x < m.W; x++) { int fx = x + ox; if (fx < 0 || fx >= f.W) continue; C[fy * f.W + fx] = m.Color[y * m.W + x]; L[fy * f.W + fx] = m.LightRaw[y * m.W + x]; }
            }
        }
        Texture2D Thumb(string id)
        {
            if (!thumbs.TryGetValue(id, out var t)) { t = Resources.Load<Texture2D>("Thumbs/" + id); if (t != null) t.filterMode = FilterMode.Point; thumbs[id] = t; }
            return t;
        }
        /// 地圖上的字：標題、資訊卡（關卡縮圖、名稱、狀態、出發）。暫時版，UI 在階段 4 重做
        void MapGui()
        {
            float u = Mathf.Max(1, Screen.height / 360f);
            if (mapStyle == null) mapStyle = new GUIStyle(GUI.skin.label) { wordWrap = true };
            Vector2 S(double px, double py) { var s = screen.CanvasToScreen(new Vector2((float)px + MapOx, (float)py + MapOy)); return new Vector2(s.x, Screen.height - s.y); }
            var tl = S(0, 0); var br = S(map.Frame.W, map.Frame.H);
            mapStyle.fontSize = Mathf.RoundToInt(13 * u); mapStyle.fontStyle = FontStyle.Bold; mapStyle.normal.textColor = new Color(1f, 0.85f, 0.4f);
            GUI.Label(new UnityEngine.Rect(tl.x, tl.y - 22 * u, 200 * u, 20 * u), "墜星之谷", mapStyle);
            mapStyle.fontSize = Mathf.RoundToInt(9 * u); mapStyle.fontStyle = FontStyle.Normal; mapStyle.normal.textColor = new Color(1, 1, 1, 0.6f);
            GUI.Label(new UnityEngine.Rect(br.x - 260 * u, tl.y - 20 * u, 260 * u, 20 * u), touchMode ? "點地圖上的地方" : "← → 選地方、Enter 出發" + (mapFromLeave ? "" : "、Esc 關掉"), mapStyle);
            string id = map.Sel; if (id == null) return;
            var n = map.D.Nodes[id]; var p = S(n.x, n.y); var st = map.Nodes[id];
            bool stage = Array.IndexOf(WorldMap.STAGES, id) >= 0;
            float cw = 150 * u, ch = id == "ch2" ? 60 * u : stage || id == "endless" ? 150 * u : 70 * u;
            bool left = n.x > map.Frame.W * 0.55;
            float cx = left ? p.x - cw - 18 * u : p.x + 18 * u, cy = Mathf.Clamp(p.y - ch / 2, tl.y, br.y - ch);
            cardRect = new UnityEngine.Rect(cx, cy, cw, ch);
            Rect(cx, cy, cw, ch, new Color(0.08f, 0.06f, 0.1f, 0.92f));
            Rect(cx, cy, cw, 2 * u, new Color(1f, 0.85f, 0.4f, 0.8f));
            float y = cy + 6 * u;
            var tex = stage || id == "endless" ? Thumb(id) : null;
            if (tex != null) { float th = (cw - 12 * u) * tex.height / tex.width; GUI.DrawTexture(new UnityEngine.Rect(cx + 6 * u, y, cw - 12 * u, th), tex); y += th + 4 * u; }
            string name = stage ? StageData.Get(id).Name + (st.Cleared ? "　已通關" : st.Fresh ? "　NEW" : "") : id == "endless" ? "無限討伐" : id == "town" ? "碎星鎮" : "第 2 章　迷霧森林";
            string note = stage ? NOTE[id] : id == "endless" ? "怪一直出，打到你手痠為止" : id == "town" ? "先不出發，留在鎮上" : "霧太濃了，現在還過不去";
            mapStyle.fontSize = Mathf.RoundToInt(10 * u); mapStyle.fontStyle = FontStyle.Bold; mapStyle.normal.textColor = new Color(1f, 0.93f, 0.75f);
            GUI.Label(new UnityEngine.Rect(cx + 6 * u, y, cw - 12 * u, 16 * u), name, mapStyle); y += 15 * u;
            mapStyle.fontSize = Mathf.RoundToInt(8 * u); mapStyle.fontStyle = FontStyle.Normal; mapStyle.normal.textColor = new Color(1, 1, 1, 0.75f);
            GUI.Label(new UnityEngine.Rect(cx + 6 * u, y, cw - 12 * u, 24 * u), note, mapStyle); y += 22 * u;
            if (id != "ch2" && GUI.Button(new UnityEngine.Rect(cx + 6 * u, Mathf.Min(y, cy + ch - 22 * u), cw - 12 * u, 18 * u), id == "town" ? "留在鎮上" : "出發")) MapGo(id);
            if (mapMsg != null && (mapMsgT -= Time.unscaledDeltaTime) > 0) { mapStyle.normal.textColor = new Color(1f, 0.8f, 0.6f); GUI.Label(new UnityEngine.Rect(tl.x, br.y + 2 * u, br.x - tl.x, 18 * u), mapMsg, mapStyle); }
        }

        /// 開一關。from＝上一關（等級、裝備、背包、形態、技能樹這些帶過來）
        void NewGame(string stage, Game from, string tracePath = null)
        {
            game = new Game(stage, from);
            if (tracePath != null) TraceScript.Apply(game, tracePath);   // 自動玩：照比對腳本的存檔
            Debug.Log($"[Stage] 開始 {stage}（Lv {game.Lv}）");
            game.OnSay = msg => { sayText = msg; sayT = 2.6f; };
            game.Say.OnShow = (msg, sec, focus) => { sayText = msg; sayT = (float)(sec + msg.Length * 0.035); };
            if (from == null && tracePath == null) foreach (var f in game.Carry) game.FormsOwned[f] = 0;   // 開發用：形態全部都有（存檔、技能樹畫面在階段 4、5）
            game.OnPickup = it => { sayText = "撿到：" + it.Name; sayT = 1.6f; };
            // 進傳送門：網頁版回碎星鎮、再從選關地圖選下一關（階段 3d）；這裡先直接到下一關（1-4 打完回 1-1）
            game.OnLeave = () => game.After(380, () => { if (shotDir != null) pending = NextStage(); else OpenMap(true); });   // 自動玩（-shot）照舊直接到下一關
#if UNITY_ANDROID || UNITY_IOS
            game.Vibrate = () => Handheld.Vibrate();   // 大招落地震一下（手機）
#endif
            game.StartStage();
            game.Warm(screen.Frame);
        }
        string NextStage() { int i = Array.IndexOf(ORDER, game.StageId); return ORDER[(i + 1) % ORDER.Length]; }
        string pending;   // 這一步跑完之後要換到哪一關

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
            if (map != null) { MapInput(); return; }
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
            // 開發用：N＝直接到下一關、M＝打開選關地圖
            if (Input.GetKeyDown(KeyCode.N)) pending = NextStage();
            if (Input.GetKeyDown(KeyCode.M)) OpenMap(false);
            if (Input.GetKeyDown(KeyCode.Escape) && !Application.isEditor) Application.Quit();
        }

        string NextForm() { int i = Array.IndexOf(game.Carry, game.Player.Form); return game.Carry[(i + 1) % game.Carry.Length]; }

        void OnTick(double dt)
        {
            if (map != null)
            {
                map.Step(dt);   // 地圖開著：遊戲暫停
                if (mapShot != null && ++mapShotN % 90 == 0)
                {
                    int k = mapShotN / 90;
                    ScreenCapture.CaptureScreenshot(Path.Combine(mapShot, $"map-{k}.png"));
                    if (k >= 4) Application.Quit(); else map.SelectNext(k == 2 ? -3 : 1);
                }
                return;
            }
            if (shotDir != null)
            {
                while (si < script.Count && script[si].t == tickN) { var e = script[si++]; if (e.type == "f") game.SwitchForm(e.code); else if (e.type == "m") game.Player.Mp = game.Player.MaxMp; else if (e.type == "h") game.Player.Hp = int.Parse(e.code); else if (e.type == "x") game.GainXp(int.Parse(e.code)); else if (e.type == "i") game.DropItem(game.Player.X + 40 * game.Player.Face, game.Player.Y - 12, int.Parse(e.code)); else if (e.type == "d") game.Input.KeyDown(e.code); else game.Input.KeyUp(e.code); }
                if (shotNo < shotAt.Length && tickN == shotAt[shotNo]) { ScreenCapture.CaptureScreenshot(Path.Combine(shotDir, $"play-{shotNo}.png")); shotNo++; }
                if (tickN % 30 == 0) Debug.Log($"[Perf] 第 {tickN} 步{(game.Ult.On ? "（大招）" : "")}：{screen.Fps:F0} fps，平均 {screen.AvgMs:F2} ms，最慢 {screen.MaxMs:F2} ms，回收 {GC.CollectionCount(0)} 次");
                if (shotNo >= shotAt.Length && tickN > Math.Max(shotAt[shotAt.Length - 1] + 20, scTicks)) { Debug.Log($"[Shot] 結束：{game.StageId} 主角 {game.Player.X:F1},{game.Player.Y:F1} 通關 {game.StageDone} 離開 {game.Leaving}"); Application.Quit(); }
            }
            game.RunTimers();
            game.Tick(game.SlowT > 0 ? dt * 0.35 : dt);   // 慢動作（傳說掉落、打倒菁英）
            game.SlowT -= dt;
            game.Hud(Game.STEP);   // 台詞計時每一步都走（網頁版每步：tick、畫、hud；畫面不讀台詞，先後一樣）。原本放在畫面那邊，畫面卡、一次跑兩步時台詞和關卡事件會被拖慢
            game.SimMs += 1000 / 60.0;
            if (pending != null) { var next = pending; pending = null; NewGame(next, game); }
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
        // 王戰的 HUD（網頁版是 HTML：畫面下方的王血條、大招時四周變暗、大招名稱；暫時版，UI 在階段 4 重做）
        float bossLag = 1; GUIStyle bossStyle;
        void DrawBossHud(float u)
        {
            double now = game.SimMs;
            // 大招：四周暗下來（5 秒：一開始淡入、最後淡出）
            double du = (now - game.BossUltAt) / 5000;
            if (du >= 0 && du < 1)
            {
                float a = (float)(du < 0.08 ? du / 0.08 : du < 0.75 ? 1 : (1 - du) / 0.25) * 0.55f;
                float bw = Screen.width * 0.18f, bh = Screen.height * 0.18f; var c = new Color(0.04f, 0.03f, 0.02f, a);
                Rect(0, 0, Screen.width, bh, c); Rect(0, Screen.height - bh, Screen.width, bh, c); Rect(0, bh, bw, Screen.height - 2 * bh, c); Rect(Screen.width - bw, bh, bw, Screen.height - 2 * bh, c);
            }
            if (bossStyle == null) bossStyle = new GUIStyle(GUI.skin.label) { alignment = TextAnchor.MiddleCenter, fontStyle = FontStyle.Bold };
            // 大招名（1.6 秒：放大縮回、最後淡出）
            double nu = (now - game.BossUltAt) / 1600;
            if (nu >= 0 && nu < 1 && game.BossUltName != null)
            {
                float a = (float)(nu < 0.15 ? nu / 0.15 : nu < 0.8 ? 1 : (1 - nu) / 0.2), sc = (float)(nu < 0.15 ? 1.8 - 0.8 * nu / 0.15 : 1);
                bossStyle.fontSize = Mathf.RoundToInt(30 * u * sc); bossStyle.normal.textColor = new Color(1f, 0.96f, 0.75f, a);
                GUI.Label(new UnityEngine.Rect(0, Screen.height * 0.3f, Screen.width, 50 * u), game.BossUltName, bossStyle);
            }
            if (!game.BossBarOn) { bossLag = 1; return; }
            // 血條：白色的「剛剛被打掉的部分」慢一點跟上；三個階段換顏色；60%、30% 有刻度
            float k = (float)game.BossBarK; bossLag = Mathf.Max(k, bossLag - Time.unscaledDeltaTime * 0.6f);
            float w = Mathf.Min(460 * u, Screen.width * 0.7f), h = 10 * u, x = (Screen.width - w) / 2, y = Screen.height - 22 * u - h;
            bossStyle.fontSize = Mathf.RoundToInt(11 * u); bossStyle.normal.textColor = new Color(0.91f, 0.94f, 0.63f);
            GUI.Label(new UnityEngine.Rect(x, y - 16 * u, w, 16 * u), "大胃王史萊姆", bossStyle);
            Rect(x - 2 * u, y - 2 * u, w + 4 * u, h + 4 * u, new Color(0.07f, 0.05f, 0.06f, 0.95f));
            Rect(x, y, w, h, new Color(0.08f, 0.07f, 0.04f));
            Rect(x, y, w * bossLag, h, new Color(1f, 0.94f, 0.88f));
            Color fill = game.BossBarPhase == 1 ? new Color(0.6f, 0.75f, 0.16f) : game.BossBarPhase == 2 ? new Color(1f, 0.48f, 0.23f) : new Color(1f, 0.85f, 0.29f);
            if (game.BossBarPhase == 3 && (int)(Time.unscaledTime / 0.25f) % 2 == 0) fill = new Color(1f, 0.98f, 0.88f);
            Rect(x, y, w * k, h, fill);
            Rect(x, y, w * k, 2 * u, new Color(1f, 1f, 1f, 0.35f));
            foreach (float m in new[] { 0.6f, 0.3f }) Rect(x + w * m - u, y - u, 2 * u, h + 2 * u, new Color(0.07f, 0.05f, 0.06f));
        }

        void OnGUI()
        {
            if (game == null) return;
            if (white == null) { white = Texture2D.whiteTexture; circle = Circle(128); }
            if (map != null) { MapGui(); return; }
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
            DrawBossHud(u);
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
        public int ticks, frameEvery; public string tree, stage = "1-1";
        public List<(int t, string type, string code)> events = new List<(int, string, string)>();
        public static string DefaultPath() => Path.GetFullPath(Path.Combine(Application.dataPath, "..", "..", "game", "tools", Environment.GetEnvironmentVariable("TRACE_SCRIPT") ?? "unity-trace-script.json"));
        public static TraceScript Load(string path)
        {
            var s = new TraceScript();
            string txt = File.Exists(path) ? File.ReadAllText(path) : (Resources.Load<TextAsset>("Baked/trace-script")?.text ?? "{}");
            s.ticks = Num(txt, "\"ticks\""); s.frameEvery = Num(txt, "\"frameEvery\"");
            var tm = System.Text.RegularExpressions.Regex.Match(txt, "\"tree\"\\s*:\\s*\"(\\w+)\"");
            if (tm.Success) s.tree = tm.Groups[1].Value;
            var sm = System.Text.RegularExpressions.Regex.Match(txt, @"""stage""\s*:\s*""([\w-]+)""");
            if (sm.Success) s.stage = sm.Groups[1].Value;
            int i = txt.IndexOf("\"events\"");
            if (i >= 0)
            {
                var m = System.Text.RegularExpressions.Regex.Matches(txt.Substring(i), "\\[\\s*(\\d+)\\s*,\\s*\"(\\w)\"\\s*,\\s*\"(\\w*)\"\\s*\\]");
                foreach (System.Text.RegularExpressions.Match x in m) s.events.Add((int.Parse(x.Groups[1].Value), x.Groups[2].Value, x.Groups[3].Value));
            }
            s.events = System.Linq.Enumerable.ToList(System.Linq.Enumerable.OrderBy(s.events, a => a.t));   // 穩定排序（同一步的事件照檔案裡的順序），跟網頁版一樣
            return s;
        }
        /// 照腳本把遊戲設成網頁版比對時的存檔：技能樹、穿搭（variant 沒選＝新存檔的初始裝備）、形態、打過的關卡
        public static void Apply(Game g, string path, string variant = "")
        {
            string txt = File.Exists(path) ? File.ReadAllText(path) : (Resources.Load<TextAsset>("Baked/trace-script")?.text ?? "{}");
            var sc = Load(path);
            if (sc.tree == "max") g.MaxTree();
            var root = (OrderedDict)MiniJson.Parse(txt);
            var V = variant != "" ? (OrderedDict)((OrderedDict)root["variants"])[variant] : (OrderedDict)root["starter"];
            g.Lv = V.ContainsKey("lv") ? (int)(double)V["lv"] : 1;
            foreach (var k in System.Linq.Enumerable.ToList(g.Equip.Keys)) g.Equip[k] = null;   // 存檔裡只有腳本給的那幾件
            var eq = (OrderedDict)V["equip"];
            foreach (var slot in eq.Order) g.Equip[slot] = SpecItem((OrderedDict)eq[slot]);
            g.ApplyStats();
            g.Player.Hp = g.Player.MaxHp;
            foreach (var f in new[] { "star", "slime", "bat", "can", "spike" }) g.FormsOwned[f] = 0;
            g.Carry = root.ContainsKey("carry") ? System.Linq.Enumerable.ToArray(System.Linq.Enumerable.Cast<string>((List<object>)root["carry"])) : new[] { "star", "slime", "bat" };
            g.TipUse = root.ContainsKey("tipUse") && (double)root["tipUse"] != 0;
            var order = new[] { "1-1", "1-2", "1-3", "1-4" };
            for (int i = 0; i < Array.IndexOf(order, sc.stage); i++) g.Cleared_.Add(order[i]);   // 前面的關卡算打過了
        }
        static Item SpecItem(OrderedDict sp)
        {
            string S(string k) => sp.ContainsKey(k) ? (string)sp[k] : null;
            int N(string k) => sp.ContainsKey(k) ? (int)(double)sp[k] : 0;
            string kind = S("base") != null ? Items.Base(S("base")).Kind : S("unique") != null ? System.Linq.Enumerable.First(Items.UNIQUES, u => u.Id == S("unique")).Kind : System.Linq.Enumerable.First(Items.MYTHS, m => m.id == S("myth")).kind;
            var main = (List<object>)sp["main"];
            var it = new Item { Uid = "x", Kind = kind, Rarity = N("rarity"), Ilvl = N("ilvl"), Plus = N("plus"), Main = new Affix { Id = (string)main[0], V = (double)main[1] }, Name = "x", Icon = "x",
                Base = S("base"), Unique = S("unique"), Myth = S("myth"), Set = S("set"), AwakenKills = N("kills") };
            if (sp.ContainsKey("affixes")) foreach (List<object> a in (List<object>)sp["affixes"]) it.Affixes.Add(new Affix { Id = (string)a[0], Tier = (int)(double)a[1], V = (double)a[2] });
            return it;
        }
        static int Num(string txt, string key) { int i = txt.IndexOf(key); if (i < 0) return 0; var m = System.Text.RegularExpressions.Regex.Match(txt.Substring(i + key.Length), "\\d+"); return int.Parse(m.Value); }
    }
}
