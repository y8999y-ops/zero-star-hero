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
        string shotDir; List<(int t, string type, string code)> script; int tickN, si; int[] shotAt = { 760, 790, 2660, 2700, 2930, 3170, 3420, 3480 }; int shotNo, scTicks;

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
            for (int i = 0; i < args.Length - 1; i++) if (args[i] == "-mapshot") mapShot = args[i + 1];
            for (int i = 0; i < args.Length - 1; i++) if (args[i] == "-shotat") shotAt = Array.ConvertAll(args[i + 1].Split(','), int.Parse);   // 開發用：自動玩時在第幾步截圖（逗號分開）   // 開發用：打開地圖、換幾個地點各截一張圖
            if (shotDir != null) { Application.runInBackground = true; Directory.CreateDirectory(shotDir); var ts = TraceScript.Load(TraceScript.DefaultPath()); script = ts.events; scTicks = ts.ticks; Rnd.R = new Rng(12345); }
            // 暖身：裝備產生、數值計算第一次用到時要編譯程式（會卡一下），載入時先做掉；用另一組亂數，不影響遊戲
            { var saved = Rnd.R; Rnd.R = new Rng(1); var eq = new Dictionary<string, Item> { ["weapon"] = null, ["head"] = null, ["body"] = null, ["hands"] = null, ["feet"] = null, ["acc1"] = null, ["acc2"] = null };
              for (int i = 0; i < 40; i++) { var it = Items.MakeItem(1 + i * 2, i % 6); Items.Compare(it, eq, 10); } Items.ComputeStats(eq, 10); Rnd.R = saved; }
            var sc = shotDir != null ? TraceScript.Load(TraceScript.DefaultPath()) : null;
            screen.Tick += OnTick;
            screen.Draw += f => { if (map != null) { screen.Zoom = 1; DrawMap(f); return; } screen.Zoom = Game.Zoom; game.Render(f); };   // 王戰時鏡頭拉遠（Game.Zoom）
            screen.PostComposite += d => { if (map == null) game.PostComposite(d); };
            { var uiGo = new GameObject("UI"); uiGo.transform.SetParent(transform); var uiRoot = ZeroStar.UI.Ui.CreateRoot(uiGo); hud = new ZeroStar.UI.Hud(uiRoot); dlg = new ZeroStar.UI.Dialog(uiRoot, () => game.Player.Form); }   // 階段 4b：UI Toolkit 的 HUD
            hud.CanvasToScreen = screen.CanvasToScreen;
            hud.OnMenu = k => { if (k == "map" && map == null) OpenMap(false); };   // 背包、技能樹的畫面在階段 4d
            hud.OnForm = f => { if (!game.Town) game.PendingForm = f; };
            NewGame(sc?.stage ?? "1-1", null, sc != null ? TraceScript.DefaultPath() : null);
            touchMode = Input.touchSupported && Application.isMobilePlatform || Array.IndexOf(args, "-touch") >= 0;   // -touch：開發用，電腦上看手機的排法
            if (mapShot != null) { Directory.CreateDirectory(mapShot); game.Cleared_.UnionWith(new[] { "1-1", "1-2" }); OpenMap(false); }
        }
        string mapShot; int mapShotN;
        ZeroStar.UI.Hud hud; ZeroStar.UI.Dialog dlg;
        void LateUpdate() { if (hud == null || game == null) return; hud.Visible = map == null; hud.Touch = touchMode; hud.Dim = dlg.Open; if (map == null) hud.Update(game, Time.unscaledDeltaTime); dlg.Update(Time.unscaledDeltaTime); }

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
            if (id == "town") { if (game.Town) CloseMap(); else { map = null; game.Sfx("ui"); NewGame("town", game); } return; }   // 在鎮上＝留在鎮上；在關卡裡＝回碎星鎮
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
            game.OnSay = msg => hud.ShowHint(msg, 2.6);   // 開發用的提示（G 換裝備）
            game.OnHint = (msg, sec) => hud.ShowHint(msg, sec);
            game.OnFeed = hud.Feed;
            game.OnFormBanner = hud.FormBanner;
            game.OnResBanner = hud.ResBanner;
            game.Say.OnShow = null;   // 系統台詞、提示改由 HUD 顯示（UI/Hud.cs）
            if (from == null && tracePath == null) foreach (var f in game.Carry) game.FormsOwned[f] = 0;   // 開發用：形態全部都有（存檔、技能樹畫面在階段 4、5）
            // 進傳送門：網頁版回碎星鎮、再從選關地圖選下一關（階段 3d）；這裡先直接到下一關（1-4 打完回 1-1）
            game.OnLeave = () => game.After(380, () => pending = shotDir != null ? NextStage() : "town");   // 進傳送門：回碎星鎮（自動玩（-shot）照舊直接到下一關）
            // 碎星鎮：路標＝打開選關地圖；店家、路人的對話和視窗在階段 4b、4c
            game.OnTalk = n => _ = ZeroStar.UI.TownTalk.Interact(game, dlg, n, () => OpenMap(false));
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
                if (Input.GetMouseButtonDown(0)) mouseOnUi = hud.Blocks(Input.mousePosition);
                inp.Mouse(Input.GetMouseButton(0) && !mouseOnUi);
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

        bool mouseOnUi;
        // -uidemo：開發用，自動玩時叫出橫幅、訊息、提示框（截圖檢查介面用）
        bool uiDemo = Array.IndexOf(Environment.GetCommandLineArgs(), "-uidemo") >= 0;
        void UiDemo()
        {
            if (tickN == 120) hud.FormBanner("slime");
            if (tickN == 300) hud.ResBanner("fire", "星之殘火", "攻擊力 +3%（永久）", "從星星上剝落的一小塊火。還溫溫的。");
            if (tickN == 420) { hud.Feed(new Game.FeedRow { Icon = "dagger", Name = "生鏽的小刀", Color = Items.RARITY[2].Color, Better = true }); hud.Feed(new Game.FeedRow { Icon = "mana", Name = "藍水晶", Color = Items.RARITY[1].Color, Note = "魔力 +25" }); hud.ShowHint("往上滑＝跳，在空中再滑一次＝二段跳", 3); }
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
                while (si < script.Count && script[si].t == tickN) { var e = script[si++]; if (e.type == "f") game.SwitchForm(e.code); else if (e.type == "m") game.Player.Mp = game.Player.MaxMp; else if (e.type == "h") game.Player.Hp = int.Parse(e.code); else if (e.type == "x") game.GainXp(int.Parse(e.code)); else if (e.type == "i") game.DropItem(game.Player.X + 40 * game.Player.Face, game.Player.Y - 12, int.Parse(e.code)); else if (e.type == "d") { game.Input.KeyDown(e.code); if (dlg != null && dlg.Open && e.code == "KeyF") dlg.Next(); } else game.Input.KeyUp(e.code); }   // 自動玩：F 也翻對話
                if (shotNo < shotAt.Length && tickN == shotAt[shotNo]) { ScreenCapture.CaptureScreenshot(Path.Combine(shotDir, $"play-{shotNo}.png")); shotNo++; }
                if (tickN % 30 == 0) Debug.Log($"[Perf] 第 {tickN} 步{(game.Ult.On ? "（大招）" : "")}：{screen.Fps:F0} fps，平均 {screen.AvgMs:F2} ms，最慢 {screen.MaxMs:F2} ms，回收 {GC.CollectionCount(0)} 次");
                if (shotNo >= shotAt.Length && tickN > Math.Max(shotAt[shotAt.Length - 1] + 20, scTicks)) { Debug.Log($"[Shot] 結束：{game.StageId} 主角 {game.Player.X:F1},{game.Player.Y:F1} 通關 {game.StageDone} 離開 {game.Leaving}"); Application.Quit(); }
            }
            if (uiDemo) UiDemo();
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
        Vector2 knobOff;
        readonly Dictionary<int, string> btnOf = new Dictionary<int, string>();
        static float Css => Screen.dpi > 0 ? Mathf.Max(1, Screen.dpi / 160f) : 2.5f;
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
                    string key = dlg.Open ? null : hud.Pad.ButtonAt(hud.ToPanel(t.position));   // 右下的按鈕（UI/TouchPad.cs）
                    if (key != null) { btnOf[t.fingerId] = key; if (key != "attack" && key != "absorb") inp.Press(key); }
                    else if (hud.Blocks(t.position)) btnOf[t.fingerId] = "ui";   // 按在形態格、選單上：給介面處理
                    else if (p.x < Screen.width / 2f && !dlg.Open)
                    {
                        if (inp.Air) { inp.Press("jump"); inp.JumpHeld = true; }   // 在空中點一下左半邊＝二段跳
                        if (stickId < 0) { stickId = t.fingerId; ax = x; ay = y; hist.Clear(); hist.Add((y, now)); knobOff = Vector2.zero; }
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
                    knobOff = new Vector2((float)Math.Max(-34, Math.Min(34, dx)), (float)Math.Max(-30, Math.Min(30, y - ay)));   // CSS px
                }
                if (t.phase == TouchPhase.Ended || t.phase == TouchPhase.Canceled)
                {
                    btnOf.Remove(t.fingerId);
                    if (t.fingerId == stickId) { stickId = -1; inp.TouchMove = 0; inp.JumpHeld = false; }
                }
            }
            if (dlg.Open) { btnOf.Clear(); if (stickId >= 0) { stickId = -1; inp.TouchMove = 0; inp.JumpHeld = false; } atk = absorbHeld = false; }   // 對話打開：放開所有觸控
            inp.TouchAttack = atk;
            inp.TouchAbsorb = absorbHeld;
            hud.Pad.Down.Clear(); foreach (var v in btnOf.Values) hud.Pad.Down.Add(v);
            hud.Pad.StickOn = stickId >= 0; hud.Pad.StickOff = knobOff;
        }

        // ---- 介面：HUD、對話、手機按鈕都在 UI Toolkit（UI/*.cs）；這裡只剩選關地圖（階段 4c 跟視窗一起換）和效能
        GUIStyle perfStyle;
        void Rect(float x, float y, float w, float h, Color c) { var o = GUI.color; GUI.color = c; GUI.DrawTexture(new UnityEngine.Rect(x, y, w, h), Texture2D.whiteTexture); GUI.color = o; }
        void OnGUI()
        {
            if (game == null) return;
            if (map != null) { MapGui(); return; }
            float u = Mathf.Max(1, Screen.height / 360f);
            // 效能（下方中間，跟網頁版的 #fps 一樣）：每秒幾格、每格算畫面花幾毫秒
            if (perfStyle == null) perfStyle = new GUIStyle(GUI.skin.label) { alignment = TextAnchor.LowerCenter, fontSize = Mathf.RoundToInt(9 * u) };
            perfStyle.normal.textColor = new Color(0.65f, 0.62f, 0.74f, 0.6f);
            GUI.Label(new UnityEngine.Rect(Screen.width / 2f - 150 * u, Screen.height - 18 * u, 300 * u, 16 * u), $"{screen.Fps:F0} fps  {screen.AvgMs:F1} ms（最慢 {screen.MaxMs:F0}）  {screen.W}×216", perfStyle);
        }
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
            if (root.ContainsKey("cleared")) foreach (string id in (List<object>)root["cleared"]) g.Cleared_.Add(id);   // 城鎮：腳本指定打過哪幾關
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
