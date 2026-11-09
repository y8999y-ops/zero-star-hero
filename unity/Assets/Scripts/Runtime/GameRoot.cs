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
            Synth.Init();   // 即時合成的音效和音樂（Runtime/Audio）
            Game.W = screen.W;
            screen.Resized += w => Game.W = w;
            var args = Environment.GetCommandLineArgs();
            ZeroStar.UI.WindowMode.FirstLaunch();   // 電腦版第一次打開：照螢幕大小開視窗
            if (Array.IndexOf(args, "-mute") >= 0) AudioListener.volume = 0;   // 開發用：測試時不出聲
            for (int i = 0; i < args.Length - 1; i++) if (args[i] == "-shot") shotDir = args[i + 1];
            for (int i = 0; i < args.Length - 1; i++) if (args[i] == "-mapshot") mapShot = args[i + 1];
            for (int i = 0; i < args.Length - 1; i++) if (args[i] == "-shotat") shotAt = Array.ConvertAll(args[i + 1].Split(','), int.Parse);   // 開發用：自動玩時在第幾步截圖（逗號分開）   // 開發用：打開地圖、換幾個地點各截一張圖
            if (shotDir != null) { Application.runInBackground = true; Directory.CreateDirectory(shotDir); var ts = TraceScript.Load(TraceScript.DefaultPath()); script = ts.events; scTicks = ts.ticks; Rnd.R = new Rng(12345); }
            // 暖身：裝備產生、數值計算第一次用到時要編譯程式（會卡一下），載入時先做掉；用另一組亂數，不影響遊戲
            { var saved = Rnd.R; Rnd.R = new Rng(1); var eq = new Dictionary<string, Item> { ["weapon"] = null, ["head"] = null, ["body"] = null, ["hands"] = null, ["feet"] = null, ["acc1"] = null, ["acc2"] = null };
              for (int i = 0; i < 40; i++) { var it = Items.MakeItem(1 + i * 2, i % 6); Items.Compare(it, eq, 10); } Items.ComputeStats(eq, 10); Rnd.R = saved; }
            var sc = shotDir != null ? TraceScript.Load(TraceScript.DefaultPath()) : null;
            screen.Tick += OnTick;
            screen.Draw += f => { screen.Zoom = Game.Zoom; game.Render(f); };   // 王戰時鏡頭拉遠（Game.Zoom）；地圖開著時後面照樣畫（暫停中）
            screen.PostComposite += d => game.PostComposite(d);
            screen.Paused = () => map != null || (win != null && win.Open) || (inv != null && inv.Open) || (settings != null && settings.Open) || (title != null && title.Open) || (intro != null && intro.Playing);
            { var uiGo = new GameObject("UI"); uiGo.transform.SetParent(transform); var uiRoot = ZeroStar.UI.Ui.CreateRoot(uiGo); uiRootEl = uiRoot; hud = new ZeroStar.UI.Hud(uiRoot); dlg = new ZeroStar.UI.Dialog(uiRoot, () => game.Player.Form);
              win = new ZeroStar.UI.Win(uiRoot); inv = new ZeroStar.UI.Inventory(uiRoot); mapWin = new ZeroStar.UI.MapWin(uiRoot);
              title = new ZeroStar.UI.Title(uiRoot); intro = new ZeroStar.UI.Intro(uiRoot); settings = new ZeroStar.UI.Settings(uiRoot); loading = new ZeroStar.UI.Loading(uiRoot); uiFx = new ZeroStar.UI.UiFx(uiRoot); }   // 疊的順序：主畫面、開場 < 設定 < 載入畫面 < 介面特效   // 4e：設定、主畫面、開場、載入畫面
            settings.Sfx = s => game.Sfx(s); title.Sfx = s => game.Sfx(s); intro.Sfx = Synth.Route;
            settings.OnIntro = () => _ = ReplayIntro();
            settings.OnExport = ExportSave; settings.OnImport = () => _ = ImportSave();
            settings.OnTitle = BackToTitle;
            settings.OnGoHome = async () => { if (game.Town || dlg.Open) return; if (await dlg.Ask("系統", "要放棄這趟回碎星鎮嗎？撿到的東西都會留著，但這關要重來。", new[] { ("回城鎮", "y"), ("繼續打", "n") }) == "y") pending = "town"; };
            title.OnStart = () => _ = StartOrIntro();
            title.OnSettings = () => settings.Show(false);
            inv.Fx = uiFx; inv.Sfx = s => game.Sfx(s);
            ZeroStar.UI.TownWins.OpenBag = () => inv.Show(game);   // 介面特效蓋在最上面
            mapWin.OnGo = MapGo;
            mapWin.OnClose = () => { if (!mapFromLeave) CloseMap(); };
            mapWin.OnPick = (x, y) => { string id = map?.Pick(x, y); if (id != null) { if (map.Select(id)) MapGo(id); else game.Sfx("ui"); } };   // 階段 4b：UI Toolkit 的 HUD；4c：視窗、介面特效
            win.Sfx = s => game.Sfx(s); win.Money = () => (game.Money, game.Scrap);
            ZeroStar.UI.TownWins.W = win; ZeroStar.UI.TownWins.Fx = uiFx;
            hud.OnTrack = () => { if (!dlg.Open && !win.Open && !game.TownBusy) { game.Sfx("ui"); _ = ZeroStar.UI.TownWins.OpenQuests(game, false, game.Quests.Tracked.Count > 0 ? "guild" : "sys"); } };
            hud.CanvasToScreen = screen.CanvasToScreen;
            hud.OnMenu = k => { if (k == "set") { if (!dlg.Open) settings.Toggle(!game.Town); return; } if (Busy()) return; if (k == "bag" || k == "hero") inv.Show(game); else if (k == "tree") OpenTree(); else if (k == "map") OpenLevelMap(); };
            hud.OnForm = f => { if (!game.Town) game.PendingForm = f; };
            NewGame(sc?.stage ?? "1-1", null, sc != null ? TraceScript.DefaultPath() : null);
            touchMode = Input.touchSupported && Application.isMobilePlatform || Array.IndexOf(args, "-touch") >= 0;   // -touch：開發用，電腦上看手機的排法
            // 開遊戲：載入畫面 → 主畫面（自動玩、地圖截圖直接開始）
            for (int i = 0; i < args.Length - 1; i++) if (args[i] == "-titleshot") titleShot = args[i + 1];   // 開發用：截主畫面、說明、設定、開場、通關載入畫面
            if (titleShot != null) Directory.CreateDirectory(titleShot);
            if (shotDir != null || mapShot != null) started = true;
            else
            {
                // 讀存檔：有打過關或登記過冒險者＝從碎星鎮繼續，不然從 1-1 開始
                bool cont = false;
                if (!uiDemo && SaveData.Load() is string json)
                {
                    try { SaveData.Apply(game, json); cont = game.Clears > 0 || game.GuildRegistered; if (cont) NewGame("town", game); }
                    catch (Exception e) { Debug.LogWarning("[Save] 讀不了存檔：" + e.Message); }
                }
                title.Form = game.Player.Form; title.Show(cont ? "繼續冒險" : "開始冒險"); loading.Show(); loading.Done();
            }
            if (mapShot != null) { Directory.CreateDirectory(mapShot); game.Cleared_.UnionWith(new[] { "1-1", "1-2" }); OpenMap(false); }
        }
        string mapShot; int mapShotN, endlessN; readonly bool goEndless = Array.IndexOf(Environment.GetCommandLineArgs(), "-endless") >= 0;
        ZeroStar.UI.Inventory inv; ZeroStar.UI.Settings settings; ZeroStar.UI.Title title; ZeroStar.UI.Intro intro; ZeroStar.UI.Loading loading;
        bool started;
        // -titleshot：依時間截圖（主畫面 → 操作說明 → 設定 → 開場 → 通關的載入畫面）
        string titleShot; float tsT; int tsN;
        static readonly (float t, string name)[] TS = { (2.5f, "title"), (4, "help"), (5.5f, "settings"), (9, "intro-03"), (12, "intro-06"), (17, "intro-11"), (23, "intro-17"), (28, "intro-22"), (31, "intro-25"), (36, "intro-30"), (41, "intro-35"), (48, "intro-42"), (55, "game"), (57, "report") };
        void TitleShot(float dt)
        {
            float prev = tsT; tsT += dt;
            bool At(float x) => prev < x && tsT >= x;
            if (At(3.2f)) title.Help(true);
            if (At(4.6f)) { title.Help(false); settings.Show(false); }
            if (At(6)) { settings.Close(); _ = StartOrIntro(); }
            if (At(55.6f)) { game.StageDone = true; loading.Show(new[] { "通關！1-1 墜落之底", "時間 3:21　擊倒 42　最高連擊 18　一次都沒死", "一次都沒死？……好吧，我對你改觀了。一點點。" }); }
            foreach (var (t, n) in TS) if (At(t)) ScreenCapture.CaptureScreenshot(Path.Combine(titleShot, $"{tsN++:00}-{n}.png"));
            if (tsT > 58.5f) Application.Quit();
        }   // 按過「開始冒險」（主畫面、開場、載入畫面都過了）
        // ---- 主畫面 → 開場（新遊戲第一次進 1-1，只播一次）→ 遊戲
        async System.Threading.Tasks.Task StartOrIntro()
        {
            if (started || intro.Playing) return;
            if (game.Town || game.StageId != "1-1" || game.SeenIntro) { StartGame(); return; }
            title.MenuVisible = false;
            await intro.Play();
            game.SeenIntro = true; Save();
            game.SkipStageIntro();   // 開場已經講過「轉生成功、種族星靈」，1-1 直接接第一句教學
            StartGame();
        }
        void StartGame() { started = true; title.Hide(); title.MenuVisible = true; StageMusic(); }
        /// 遊戲裡的聲音：music=名字（空白＝停）、tempo=倍數、jingle=種類，其他交給 Synth.Route（「名字:參數」）
        void Sound(string s)
        {
            if (s.StartsWith("music=")) { var n = s.Substring(6); Synth.Music(n == "" ? null : n); }
            else if (s.StartsWith("tempo=")) Synth.Tempo(double.Parse(s.Substring(6), System.Globalization.CultureInfo.InvariantCulture));
            else if (s.StartsWith("jingle=")) Synth.Jingle(s.Substring(7));
            else Synth.Route(s);
        }
        /// main.js 的 start()：城鎮放城鎮的歌、關卡放關卡的歌；1-4 王出場大吼時才開始王戰音樂
        void StageMusic() { if (shotDir == null) Synth.Music(game.Town ? "town" : game.StageId == "1-4" ? null : "stage"); }
        // ---- 存檔：換場景、關背包和視窗、每 20 秒、App 切到背景、關掉時（自動玩、比對、截圖不存）
        bool CanSave => shotDir == null && mapShot == null && titleShot == null && !uiDemo && game != null;
        float saveT;
        void Save() { if (CanSave) SaveData.Save(game); }
        void OnApplicationPause(bool pause) { if (pause) Save(); }
        void OnApplicationQuit() { Save(); }
        /// 設定：把存檔複製成一段代碼（備份、換裝置）
        void ExportSave() { GUIUtility.systemCopyBuffer = SaveData.Encode(SaveData.ToJson(game)); hud.ShowHint("存檔代碼複製好了。", 2.5); }
        /// 設定：從剪貼簿匯入（網頁版「匯出存檔」的代碼）：問一次，之後從碎星鎮（或 1-1）重新開始
        async System.Threading.Tasks.Task ImportSave()
        {
            string json = SaveData.Decode(GUIUtility.systemCopyBuffer);
            if (json == null) { hud.ShowHint("剪貼簿裡沒有存檔代碼。先在網頁版的設定按「匯出存檔」。", 3.5); return; }
            if (await dlg.Ask("系統", "要用剪貼簿裡的存檔取代現在的進度嗎？現在的進度會被蓋掉。", new[] { ("匯入", "y"), ("取消", "n") }) != "y") return;
            var fresh = new Game("1-1", null);
            try { SaveData.Apply(fresh, json); }
            catch (Exception e) { hud.ShowHint("這段存檔讀不了：" + e.Message, 3.5); return; }
            bool cont = fresh.Clears > 0 || fresh.GuildRegistered;
            started = false;
            NewGame(cont ? "town" : "1-1", fresh);
            Save();
            title.Form = game.Player.Form; title.Show(cont ? "繼續冒險" : "開始冒險");
            hud.ShowHint("匯入完成。", 2.5);
        }
        /// 設定裡的「重看開場動畫」：在原地播（遊戲暫停），播完回到原本的畫面
        async System.Threading.Tasks.Task ReplayIntro() { if (intro.Playing) return; await intro.Play(); }
        /// 「回主畫面」：關卡中回去的話，下次從碎星鎮繼續；還沒到過鎮上的新玩家從原本的關卡
        void BackToTitle()
        {
            bool toTown = game.Town || game.Cleared_.Count > 0 || game.GuildRegistered;
            started = false;
            if (toTown && !game.Town) NewGame("town", game); else if (!toTown) NewGame(game.StageId, game);   // 重新開始這一關（網頁版是重新載入頁面）
            title.Form = game.Player.Form; title.Show(toTown ? "繼續冒險" : "開始冒險");
        }
        /// 有對話、視窗、背包、地圖開著
        bool Busy() => dlg.Open || win.Open || inv.Open || map != null || game.TownBusy || settings.Open || !started;
        void OpenTree() { game.Sfx("ui"); _ = ZeroStar.UI.TreeWin.Open(game, hud.InCombat, null, game.Player.Form); }
        /// 地圖：關卡裡＝這一關走過的地方（mapview.js）；碎星鎮沒有關卡地圖，打開選關地圖
        void OpenLevelMap() { if (game.Town) OpenMap(false); else if (game.Endless) return; else { game.Sfx("open"); _ = ZeroStar.UI.LevelMap.Open(game); } }
        ZeroStar.UI.Hud hud; ZeroStar.UI.Dialog dlg; ZeroStar.UI.Win win; ZeroStar.UI.UiFx uiFx; ZeroStar.UI.MapWin mapWin; int winTicks;
        bool wasOpen; UnityEngine.Rect lastSafe;
        /// 手機：介面避開瀏海、圓角（Screen.safeArea）；遊戲畫面照樣蓋滿
        void FitSafeArea()
        {
            var sa = Screen.safeArea; if (sa == lastSafe || uiRootEl == null || uiRootEl.panel == null) return; lastSafe = sa;
            float k = ZeroStar.UI.Ui.Scale();
            uiRootEl.style.left = sa.xMin / k; uiRootEl.style.right = (Screen.width - sa.xMax) / k;
            uiRootEl.style.bottom = sa.yMin / k; uiRootEl.style.top = (Screen.height - sa.yMax) / k;
        }
        UnityEngine.UIElements.VisualElement uiRootEl;
        void LateUpdate()
        {
            if (hud == null || game == null) return;
            ZeroStar.UI.Ui.Refit();   // 電腦版：介面跟著視窗大小
            FitSafeArea();
            bool open = win.Open || inv.Open; if (wasOpen && !open) Save(); wasOpen = open;   // 關掉背包、視窗：存檔
            if (titleShot != null) TitleShot(Time.unscaledDeltaTime);
            float dt = Time.unscaledDeltaTime;
            hud.Touch = touchMode; mapWin.Touch = touchMode; hud.Dim = dlg.Open;
            hud.Update(game, dt); mapWin.Update(dt); dlg.Update(dt); win.Update(dt); inv.Update(dt); settings.Update(dt);
            title.Update(dt); intro.Update(dt); loading.Update(dt); uiFx.Update(dt);
            hud.Visible = started;
        }

        static readonly string[] ORDER = { "1-1", "1-2", "1-3", "1-4" };

        // ---- 選關世界地圖（worldmap.js 的 openWorldMap）：進傳送門之後打開（網頁版是回碎星鎮、走到路標才打開；碎星鎮在階段 4）
        WorldMap map; bool mapFromLeave;
        void OpenMap(bool fromLeave)
        {
            map = new WorldMap(game.Cleared_); mapFromLeave = fromLeave;
            mapWin.Show(map, !fromLeave);
            game.Sfx("open");
        }
        void CloseMap() { map = null; mapWin.Hide(); game.Sfx("close"); }
        /// 出發：關卡＝換到那一關（等級、裝備這些帶過去）；碎星鎮＝回鎮上；無限討伐＝舊的 1-1 平地一直冒怪
        void MapGo(string id)
        {
            if (id == null) return;
            if (id == "town") { if (game.Town) CloseMap(); else { map = null; mapWin.Hide(); game.Sfx("ui"); NewGame("town", game); } return; }   // 在鎮上＝留在鎮上；在關卡裡＝回碎星鎮
            if (id == "endless") { map = null; mapWin.Hide(); game.Sfx("ui"); NewGame("endless", game); return; }   // 無限討伐（main.js 的 goScene("endless")）
            if (Array.IndexOf(WorldMap.STAGES, id) >= 0 && map.Nodes[id].Open) { map = null; mapWin.Hide(); game.Sfx("ui"); NewGame(id, game); }
        }
        void MapInput()
        {
            if (Input.GetKeyDown(KeyCode.RightArrow) || Input.GetKeyDown(KeyCode.D)) { map.SelectNext(1); game.Sfx("ui"); }
            if (Input.GetKeyDown(KeyCode.LeftArrow) || Input.GetKeyDown(KeyCode.A)) { map.SelectNext(-1); game.Sfx("ui"); }
            if (Input.GetKeyDown(KeyCode.Return) || Input.GetKeyDown(KeyCode.Space) || Input.GetKeyDown(KeyCode.F)) MapGo(map.Sel);
            if (map != null && Input.GetKeyDown(KeyCode.Escape) && !mapFromLeave) CloseMap();
            if (map == null) return;
        }

        /// 開一關。from＝上一關（等級、裝備、背包、形態、技能樹這些帶過來）
        void NewGame(string stage, Game from, string tracePath = null)
        {
            // 換場景：載入畫面蓋一下；踩傳送門通關的話，在載入畫面播通關成績（loading.js）
            if (from != null && shotDir == null && loading != null)
            {
                Save();
                string[] rep = null;
                if (from.StageDone && !from.Town)
                {
                    int tt = (int)Math.Round(from.StatTime); bool ch = from.StageId == "1-4";
                    rep = new[] { $"{(ch ? "第一章　完。" : "通關！")}{from.StageId} {(QuestBook.LAYOUT_NAME.TryGetValue(from.StageId, out var ln) ? ln : "")}",
                        $"時間 {tt / 60}:{tt % 60:00}　擊倒 {from.Kills}　最高連擊 {from.BestCombo}　{(from.Deaths > 0 ? "死了 " + from.Deaths + " 次" : "一次都沒死")}",
                        ch ? "第一章　墜星之谷　完。前面就是碎星鎮了。" : from.Deaths == 0 ? "一次都沒死？……好吧，我對你改觀了。一點點。" : "過是過了。死了幾次這件事我會幫你保密。" };
                }
                loading.Show(rep); loading.Done();
            }
            game = new Game(stage, from);
            if (tracePath != null) TraceScript.Apply(game, tracePath);   // 自動玩：照比對腳本的存檔
            Debug.Log($"[Stage] 開始 {stage}（Lv {game.Lv}）");
            game.OnSay = msg => hud.ShowHint(msg, 2.6);
            game.OnSfx = Sound;   // 開發用的提示（G 換裝備）
            game.OnHint = (msg, sec) => hud.ShowHint(msg, sec);
            game.OnFeed = hud.Feed;
            game.OnFormBanner = hud.FormBanner;
            game.OnResBanner = hud.ResBanner;
            game.Say.OnShow = null;   // 系統台詞、提示改由 HUD 顯示（UI/Hud.cs）
            if (from == null && tracePath == null) game.Carry = new[] { "star" };   // 新遊戲：只有星星（跟網頁版的新存檔一樣）
            // 進傳送門：網頁版回碎星鎮、再從選關地圖選下一關（階段 3d）；這裡先直接到下一關（1-4 打完回 1-1）
            game.OnLeave = () => game.After(380, () => pending = shotDir != null ? NextStage() : "town");   // 進傳送門：回碎星鎮（自動玩（-shot）照舊直接到下一關）
            // 碎星鎮：路標＝打開選關地圖；店家、路人的對話和視窗在階段 4b、4c
            game.OnTalk = n => _ = ZeroStar.UI.TownTalk.Interact(game, dlg, n, () => OpenMap(false));
#if UNITY_ANDROID || UNITY_IOS
            game.Vibrate = () => Handheld.Vibrate();   // 大招落地震一下（手機）
#endif
            game.StartStage();
            if (started) StageMusic();   // 換場景：換歌
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
            if (Input.GetKeyDown(KeyCode.F11)) ZeroStar.UI.WindowMode.Toggle();   // 全螢幕開關（Alt+Enter 也可以）
            if (!started || intro.Playing) { if (Input.GetKeyDown(KeyCode.Escape)) settings.Close(); return; }   // 主畫面、開場：遊戲的按鍵不動作
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
            if (Input.GetKeyDown(KeyCode.M)) { if (win.Open && !game.Town) win.Close(); else if (!Busy()) OpenLevelMap(); }
            // 背包：I／B／Tab 開關（main.js）
            if (Input.GetKeyDown(KeyCode.I) || Input.GetKeyDown(KeyCode.B) || Input.GetKeyDown(KeyCode.Tab)) { if (inv.Open) inv.Close(); else if (!dlg.Open && !win.Open && map == null) inv.Show(game); }
            if (Input.GetKeyDown(KeyCode.Escape) && settings.Open) settings.Close();
            else if (Input.GetKeyDown(KeyCode.Escape) && inv.Open) inv.Close();
            else if (Input.GetKeyDown(KeyCode.Escape) && win.Open) win.Close();
            else if (Input.GetKeyDown(KeyCode.Escape) && !dlg.Open && map == null) settings.Show(!game.Town);   // 什麼都沒開：Esc（手機的返回鍵）＝打開設定
        }

        bool mouseOnUi;
        // -uidemo：開發用，自動玩時叫出橫幅、訊息、提示框（截圖檢查介面用）
        bool uiDemo = Array.IndexOf(Environment.GetCommandLineArgs(), "-uidemo") >= 0;
        void UiDemo()
        {
            if (game.Town)
            {
                // 碎星鎮：依序打開任務（公會）、工坊、旅館、主線、地圖（每個 4 秒後自動關）
                if (tickN == 30) { game.GuildRegistered = true; game.Money = 900; game.Scrap = 120; game.Equip["weapon"] = Items.MakeItem(20, 3, "weapon"); game.Equip["head"] = Items.MakeItem(12, 2, "head"); game.Quests.RefreshBoard(game.UnlockedStages()); game.Quests.Accept(game.Quests.Board[0].Id); game.Quests.Active[0].Have = game.Quests.Active[0].Need; game.Quests.Tracked.Add(game.Quests.Active[0].Id); }
                if (tickN == 40) _ = ZeroStar.UI.TownWins.OpenQuests(game, true);
                if (tickN == 110) { uiFx.At(win.BoxCenter(), "quest-complete", new FxOptions { Seed = 1 }); uiFx.At(win.MoneyCenter(), "coin-collect", new FxOptions { Seed = 1 }.Set("count", 8)); }
                if (tickN == 330) _ = ZeroStar.UI.TownWins.OpenForge(game);
                if (tickN == 400) uiFx.At(win.BoxCenter(), "parry", new FxOptions { Palette = new[] { "#3a1a06", "#8a4a10", "#e0901c", "#ffc83a", "#ffe98a", "#fff8d8", "#ffffff" }, Light = 0.5, Seed = 3 });
                if (tickN == 620) _ = ZeroStar.UI.TownWins.OpenInn(game, () => System.Threading.Tasks.Task.CompletedTask);
                if (tickN == 910) _ = ZeroStar.UI.TownWins.OpenQuests(game, false, "sys");
                if (tickN == 1200) OpenMap(false);
                return;
            }
            // 4d：背包、技能樹、關卡地圖
            if (tickN == 540)
            {
                game.Money = 1234; game.Scrap = 87; game.FormsOwned["slime"] = 7; game.FormsOwned["bat"] = 3; game.Tree["slime:g_big"] = 2;
                game.Equip["head"] = Items.MakeItem(15, 4, "head"); game.Equip["acc1"] = Items.MakeItem(15, 5);
                for (int i = 0; i < 14; i++) game.Inv.Add(Items.MakeItem(5 + i * 3, i % 6, i % 3 == 0 ? "feet" : null));
                game.Inv[2].New = true; game.Locked.Add(game.Inv[3]);
                game.ApplyStats(); inv.Show(game);
            }
            if (tickN == 680) inv.Select(1);
            if (tickN == 760) inv.Select(5);
            if (tickN == 840) { inv.Close(); _ = ZeroStar.UI.TreeWin.Open(game, false, null, "slime"); }
            if (tickN == 1090) { win.Close(); _ = ZeroStar.UI.TreeWin.Open(game, false, null, "carry"); }
            if (tickN == 1340) { win.Close(); _ = ZeroStar.UI.LevelMap.Open(game); }
            if (tickN == 120) hud.FormBanner("slime");
            if (tickN == 300) hud.ResBanner("fire", "星之殘火", "攻擊力 +3%（永久）", "從星星上剝落的一小塊火。還溫溫的。");
            if (tickN == 420) { hud.Feed(new Game.FeedRow { Icon = "dagger", Name = "生鏽的小刀", Color = Items.RARITY[2].Color, Better = true }); hud.Feed(new Game.FeedRow { Icon = "mana", Name = "藍水晶", Color = Items.RARITY[1].Color, Note = "魔力 +25" }); hud.ShowHint("往上滑＝跳，在空中再滑一次＝二段跳", 3); }
        }
        string NextForm() { int i = Array.IndexOf(game.Carry, game.Player.Form); return game.Carry[(i + 1) % game.Carry.Length]; }

        void OnTick(double dt)
        {
            if (shotDir != null)
            {
                while (si < script.Count && script[si].t == tickN) { var e = script[si++]; if (e.type == "f") game.SwitchForm(e.code); else if (e.type == "m") game.Player.Mp = game.Player.MaxMp; else if (e.type == "h") game.Player.Hp = int.Parse(e.code); else if (e.type == "x") game.GainXp(int.Parse(e.code)); else if (e.type == "i") game.DropItem(game.Player.X + 40 * game.Player.Face, game.Player.Y - 12, int.Parse(e.code)); else if (e.type == "d") { game.Input.KeyDown(e.code); if (dlg != null && dlg.Open && e.code == "KeyF") dlg.Next(); } else game.Input.KeyUp(e.code); }   // 自動玩：F 也翻對話
                if (shotNo < shotAt.Length && tickN == shotAt[shotNo]) { ScreenCapture.CaptureScreenshot(Path.Combine(shotDir, $"play-{shotNo}.png")); shotNo++; }
                if (tickN % 30 == 0) Debug.Log($"[Perf] 第 {tickN} 步{(game.Ult.On ? "（大招）" : "")}：{screen.Fps:F0} fps，平均 {screen.AvgMs:F2} ms，最慢 {screen.MaxMs:F2} ms，回收 {GC.CollectionCount(0)} 次");
                if (shotNo >= shotAt.Length && tickN > Math.Max(shotAt[shotAt.Length - 1] + 20, scTicks)) { Debug.Log($"[Shot] 結束：{game.StageId} 主角 {game.Player.X:F1},{game.Player.Y:F1} 通關 {game.StageDone} 離開 {game.Leaving}"); Application.Quit(); }
            }
            if (map != null)
            {
                map.Step(dt);   // 地圖開著：遊戲暫停
                if (mapShot != null && ++mapShotN % 90 == 0)
                {
                    int k = mapShotN / 90;
                    ScreenCapture.CaptureScreenshot(Path.Combine(mapShot, $"map-{k}.png"));
                    if (goEndless && k == 1) { StartGame(); MapGo("endless"); return; }   // -mapshot … -endless：從地圖進無限討伐（開發用截圖）
                    if (k >= 4) Application.Quit(); else map.SelectNext(k == 2 ? -3 : 1);
                }
                if (shotDir != null) tickN++;   // 自動玩：地圖開著也照樣數步數（才會截圖、結束）
                return;
            }
            if (uiDemo) UiDemo();
            // 視窗開著：遊戲暫停，系統的話照樣播（main.js：isWinOpen 時只跑 updateSay）。自動玩：開 4 秒後自己關（截圖用）
            if (!started || intro.Playing || loading.Showing && shotDir == null) { if (started) game.Hud(Game.STEP); tickN++; return; }   // 主畫面、開場、載入畫面：遊戲還沒開始
            if (win.Open || inv.Open || settings.Open)
            {
                game.Hud(Game.STEP); tickN++;
                if (shotDir != null && ++winTicks > 240) { winTicks = 0; win.Close(); inv.Close(); }
                return;
            }
            game.RunTimers();
            game.Tick(game.SlowT > 0 ? dt * 0.35 : dt);   // 慢動作（傳說掉落、打倒菁英）
            game.SlowT -= dt;
            if (!game.Endless) ZeroStar.UI.LevelMap.UpdateSeen(game, (float)dt);
            if (mapShot != null && game.Endless && ++endlessN % 150 == 0)   // 無限討伐的截圖：每 2.5 秒一張，40 秒後結束
            {
                ScreenCapture.CaptureScreenshot(Path.Combine(mapShot, $"endless-{endlessN / 150:00}.png"));
                Debug.Log($"[Endless] {endlessN} 步：怪 {System.Linq.Enumerable.Count(game.Enemies, e => !e.Dead)} 隻（毒菇 {System.Linq.Enumerable.Count(game.Enemies, e => !e.Dead && e.Kind == "shroom")}），主角血 {game.Player.Hp:F0}，擊倒 {game.Kills}，死了 {game.Deaths} 次，主角 {game.Player.X:F0},{game.Player.Y:F0}");
                if (endlessN >= 2400) Application.Quit();
            }   // 關卡地圖：看得到的範圍算走過
            if (CanSave && (saveT += (float)dt) > 20) { saveT = 0; Save(); }   // 每 20 秒存一次
            Synth.HitTuneK = game.HitTune;
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
            if (game == null || !started || intro.Playing) return;   // 主畫面、開場不顯示效能
            float u = Mathf.Max(1, Screen.height / 360f);
            // 效能（下方中間，跟網頁版的 #fps 一樣）：每秒幾格、每格算畫面花幾毫秒
            if (perfStyle == null) perfStyle = new GUIStyle(GUI.skin.label) { alignment = TextAnchor.LowerCenter, fontSize = Mathf.RoundToInt(9 * u) };
            perfStyle.normal.textColor = new Color(0.65f, 0.62f, 0.74f, 0.6f);
            GUI.Label(new UnityEngine.Rect(Screen.width / 2f - 150 * u, Screen.height - 18 * u, 300 * u, 16 * u), screen.PerfText, perfStyle);
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
