// worldmap.js 的 openWorldMap 介面部分：視窗（金色外框、卷軸轉場）裡一張像素地圖，選中地點時旁邊跳出資訊卡（真實關卡縮圖、名稱、已通關／NEW、說明、出發）。
// 地圖本身（WorldMap.cs）照網頁版逐像素畫好，這裡每格把它貼成圖。點地圖：找最近的地點；已經選的再點一次＝出發。
using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UIElements;
using static ZeroStar.UI.Ui;

namespace ZeroStar.UI
{
    public class MapWin
    {
        static readonly Dictionary<string, string> NOTE = new Dictionary<string, string> { ["1-1"] = "主角掉下來的地方，系統教你怎麼打", ["1-2"] = "垃圾桶怪很多", ["1-3"] = "蝙蝠群、菁英", ["1-4"] = "王：大胃王史萊姆" };
        readonly VisualElement overlay, box, mapEl, card, closeX; readonly Label tip, msg;
        Texture2D tex; byte[] rgba; WorldMap map; string shownSel; float popT = 9, msgT, openT = 9;
        public bool Open => map != null;
        public bool Touch;
        public Action<string> OnGo; public Action OnClose; public Action<double, double> OnPick;

        public MapWin(VisualElement parent)
        {
            overlay = Box(parent, "worldWin"); Abs(overlay, 0, 0, 0, 0); overlay.style.backgroundColor = C("#06040e", 0.55f);
            overlay.style.alignItems = Align.Center; overlay.style.justifyContent = Justify.Center; overlay.style.display = DisplayStyle.None; overlay.pickingMode = PickingMode.Position;
            overlay.RegisterCallback<PointerDownEvent>(e => { if (e.target == overlay && closeX.style.display != DisplayStyle.None) OnClose?.Invoke(); });
            box = Box(overlay, "wmBox"); Nine(box, "win-guild", 16, 16); box.style.paddingLeft = box.style.paddingRight = 16 + 2; box.style.paddingBottom = 16 + 2;
            var head = Box(box); head.style.flexDirection = FlexDirection.Row; head.style.alignItems = Align.Center; head.style.paddingBottom = 4;
            var ttl = Text(head, "墜星之谷", 15, "#ffe7a0", true, 2); ttl.style.letterSpacing = 3; ttl.style.marginRight = 10;
            tip = Text(head, "", 13, "#c9c2dc"); tip.style.flexGrow = 1;
            closeX = Box(head); Size(closeX, 28, 28); Round(closeX, 14); closeX.style.backgroundColor = C("#000000", 0.4f); Border(closeX, 2, C("#ffffff", 0.15f));
            closeX.style.alignItems = Align.Center; closeX.style.justifyContent = Justify.Center; closeX.pickingMode = PickingMode.Position;
            Win.Ico(closeX, "close"); closeX.AddManipulator(new Clickable(() => OnClose?.Invoke()));
            var wrap = Box(box);
            mapEl = Box(wrap, "wmCv"); Border(mapEl, 2, C("#1a1226")); mapEl.pickingMode = PickingMode.Position;
            mapEl.RegisterCallback<PointerDownEvent>(e =>
            {
                e.StopPropagation();
                var r = mapEl.contentRect; if (map == null || r.width <= 0) return;
                OnPick?.Invoke(e.localPosition.x / r.width * map.Frame.W, e.localPosition.y / r.height * map.Frame.H);
            });
            card = Box(wrap, "wmCard"); Abs(card, null, 6, 6); card.style.flexDirection = FlexDirection.Column;
            card.style.paddingLeft = card.style.paddingRight = card.style.paddingTop = card.style.paddingBottom = 6;
            card.style.backgroundColor = C("#0c091a", 0.9f); Border(card, 2, C("#ffe7a0", 0.55f)); card.pickingMode = PickingMode.Position;
            msg = Text(box, "", 12, "#ffccaa", true, 1); msg.style.unityTextAlign = TextAnchor.MiddleCenter; msg.style.height = 0; msg.style.overflow = Overflow.Visible;
        }

        public void Show(WorldMap m, bool canClose)
        {
            map = m; shownSel = null; openT = 0; msgT = 0;
            overlay.style.display = DisplayStyle.Flex;
            closeX.style.display = canClose ? DisplayStyle.Flex : DisplayStyle.None;
            if (tex == null || tex.width != m.Frame.W || tex.height != m.Frame.H)   // 同樣大小就沿用上次的圖（不會每開一次多一張）
            {
                if (tex != null) UnityEngine.Object.Destroy(tex);
                tex = new Texture2D(m.Frame.W, m.Frame.H, TextureFormat.RGBA32, false) { filterMode = FilterMode.Point, wrapMode = TextureWrapMode.Clamp };
                rgba = new byte[m.Frame.W * m.Frame.H * 4];
            }
            mapEl.style.backgroundImage = tex; mapEl.style.backgroundSize = new BackgroundSize(Length.Percent(100), Length.Percent(100));
            mapEl.style.scale = new Scale(Vector2.one);
        }
        public void Hide() { map = null; overlay.style.display = DisplayStyle.None; }
        public void Msg(string text) { msg.text = text; msgT = 3; }

        public void Update(float dt)
        {
            if (map == null) return;
            // 大小：寬 min(900px, 92vw, (100vh − 96px) × 16/9)，16:9
            float pw = overlay.layout.width > 0 ? overlay.layout.width : 1280, ph = overlay.layout.height > 0 ? overlay.layout.height : 720;
            float w = Touch ? Mathf.Min(pw * 0.92f, (ph - 70) * 16 / 9f) : Mathf.Min(900, Mathf.Min(pw * 0.92f, (ph - 96) * 16 / 9f));
            mapEl.style.width = w; mapEl.style.height = w * 9 / 16;
            card.style.width = Touch ? Mathf.Min(w * 0.4f, 230) : Mathf.Min(w * 0.36f, 250);
            tip.text = Touch ? "點地圖上的地方" : "← → 選地方、Enter 出發" + (closeX.style.display == DisplayStyle.None ? "" : "、Esc 關掉");
            // 地圖（WorldMap 已經畫好的這一格）
            var lightRaw = map.Frame.LightRaw;
            // 網頁版 composite(frame, img, null)：沒畫到的地方透明；地圖本身整張都有畫
            map.Frame.Composite(rgba, null);
            // 合成出來是上到下，貼圖是下到上：一列一列倒過來
            int W = map.Frame.W, H = map.Frame.H; var flip = Flip(rgba, W, H);
            tex.LoadRawTextureData(flip); tex.Apply(false);
            mapEl.MarkDirtyRepaint();
            // 資訊卡：換地點時重畫、跳一下
            if (map.Sel != shownSel) { shownSel = map.Sel; RenderCard(map.Sel); popT = 0; }
            popT += dt;
            float p = EaseOut(Mathf.Clamp01(popT / 0.22f));
            card.style.opacity = p; card.style.translate = new Translate(0, 6 * (1 - p)); card.style.scale = new Scale(Vector2.one * Mathf.Lerp(0.94f, 1, p));
            // 卷軸展開（0.5 秒、10 格）
            openT += dt;
            box.style.scale = new Scale(new Vector2(1, openT < 0.5f ? Mathf.Lerp(0.08f, 1, Steps(10)(openT / 0.5f)) : 1));
            msgT -= dt; msg.style.opacity = Mathf.Clamp01(msgT / 0.3f);
        }
        byte[] flipBuf;
        byte[] Flip(byte[] src, int w, int h)
        {
            if (flipBuf == null || flipBuf.Length != src.Length) flipBuf = new byte[src.Length];
            int row = w * 4;
            for (int y = 0; y < h; y++) Buffer.BlockCopy(src, y * row, flipBuf, (h - 1 - y) * row, row);
            return flipBuf;
        }

        void RenderCard(string id)
        {
            card.Clear();
            if (id == null) { card.style.display = DisplayStyle.None; return; }
            card.style.display = DisplayStyle.Flex;
            var n = map.Nodes[id]; bool stage = Array.IndexOf(WorldMap.STAGES, id) >= 0;
            // 卡片放在地點的另一邊，不要蓋住
            bool left = map.D.Nodes[id].x > map.Frame.W * 0.55;
            if (left) { card.style.left = 6; card.style.right = StyleKeyword.Auto; } else { card.style.right = 6; card.style.left = StyleKeyword.Auto; }
            VisualElement Thumb(Texture2D t, float aspect)
            {
                var e = Box(card); e.style.width = Length.Percent(100); Border(e, 2, C("#2a2040")); e.style.marginBottom = 4;
                e.style.height = (card.style.width.value.value - 16) / aspect; if (t != null) { e.style.backgroundImage = t; e.style.backgroundSize = new BackgroundSize(BackgroundSizeType.Cover); }
                return e;
            }
            var nameRow = Box(); nameRow.style.flexDirection = FlexDirection.Row; nameRow.style.alignItems = Align.Center; nameRow.style.flexWrap = Wrap.Wrap; nameRow.style.marginBottom = 4;
            void Name(string s, string col = "#fff2c8") { var l = Text(nameRow, s, 15, col, true); l.style.marginRight = 6; }
            void Em(string s, bool ok) { var l = Text(nameRow, s, 11, ok ? "#c8ffd0" : "#fff6d0"); l.style.backgroundColor = C(ok ? "#2a6a3a" : "#c8861a"); l.style.paddingLeft = l.style.paddingRight = 5; Round(l, 2); }
            string note;
            if (stage)
            {
                Thumb(ThumbTex(id), 232f / 157);
                Name(id, "#ffd84a"); Name(StageData.Get(id).Name);
                if (n.Cleared) Em("已通關", true); else if (n.Fresh) Em("NEW", false);
                note = NOTE[id];
            }
            else if (id == "endless") { Thumb(ThumbTex("endless"), 232f / 157); Name("無限討伐"); note = "怪一直出，打到你手痠為止"; }
            else if (id == "town") { Name("碎星鎮"); note = "先不出發，留在鎮上"; }
            else { Thumb(FogTex(), 116f / 78); Name("第 2 章　迷霧森林"); note = "霧太濃了，現在還過不去"; }
            card.Add(nameRow);
            var nt = Text(card, note, 12, "#c8bedc"); nt.style.whiteSpace = WhiteSpace.Normal; nt.style.marginBottom = 4;
            if (id != "ch2")
            {
                var b = Box(card); b.style.height = 34; b.style.alignItems = Align.Center; b.style.justifyContent = Justify.Center; b.pickingMode = PickingMode.Position;
                string skin = id == "town" ? "b-plain" : "b-go"; Nine(b, skin + "-n", 8, 8);
                Text(b, id == "town" ? "留在鎮上" : "出發", 14, id == "town" ? "#f4eeff" : "#3a1c04", true);
                b.RegisterCallback<PointerEnterEvent>(e => Nine(b, skin + "-h", 8, 8)); b.RegisterCallback<PointerLeaveEvent>(e => Nine(b, skin + "-n", 8, 8));
                string go = id; b.AddManipulator(new Clickable(() => OnGo?.Invoke(go)));
            }
        }
        readonly Dictionary<string, Texture2D> thumbs = new Dictionary<string, Texture2D>();
        Texture2D ThumbTex(string id)
        {
            if (!thumbs.TryGetValue(id, out var t)) { t = Resources.Load<Texture2D>("Thumbs/" + id); if (t != null) t.filterMode = FilterMode.Point; thumbs[id] = t; }
            return t;
        }
        // 第 2 章沒有關卡畫面：直接截地圖上那團霧（116×78）
        Texture2D fogTex;
        Texture2D FogTex()
        {
            if (fogTex != null) return fogTex;   // 截一次就好
            var c = map.D.Nodes["ch2"]; int x0 = (int)c.x - 58, y0 = (int)c.y - 30, W = map.Frame.W, H = map.Frame.H;
            var t = new Texture2D(116, 78, TextureFormat.RGBA32, false) { filterMode = FilterMode.Point };
            var px = new Color32[116 * 78];
            for (int y = 0; y < 78; y++) for (int x = 0; x < 116; x++)
            {
                int sx = x0 + x, sy = y0 + y; if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
                int j = (sy * W + sx) * 4; px[(77 - y) * 116 + x] = new Color32(rgba[j], rgba[j + 1], rgba[j + 2], rgba[j + 3]);
            }
            t.SetPixels32(px); t.Apply(false);
            return fogTex = t;
        }
    }
}
