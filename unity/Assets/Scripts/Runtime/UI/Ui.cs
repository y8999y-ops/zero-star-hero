// 介面的基礎（階段 4b）：用 UI Toolkit 照網頁版的 HTML/CSS 排（網頁版是 HTML 疊在畫布上，這裡是 UI Toolkit 疊在畫面上）。
//   字型：Noto Sans TC（思源黑體；網頁版在 Windows 用微軟正黑體，長得很像）
//   像素素材：網頁版 ui-art.js 畫的（node game/tools/unity-ui-export.mjs 匯出到 Resources/UI），當 9 宮格背景用（CSS 的 border-image）
//   大小：網頁版的 CSS px＝這裡的 1 單位（電腦上 1 單位＝1 螢幕像素；Windows 放大字型、手機照螢幕密度放大）
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UIElements;

namespace ZeroStar.UI
{
    public static class Ui
    {
        static Font font;
        public static Font Font => font != null ? font : (font = Resources.Load<Font>("Fonts/NotoSansTC"));
        static readonly Dictionary<string, Texture2D> tex = new Dictionary<string, Texture2D>();
        /// Resources/UI 底下的圖（不含 .png）
        public static Texture2D Tex(string name)
        {
            if (!tex.TryGetValue(name, out var t)) { t = Resources.Load<Texture2D>("UI/" + name); if (t != null) t.filterMode = FilterMode.Point; tex[name] = t; }
            return t;
        }
        public static Color C(string hex, float a = 1) { ColorUtility.TryParseHtmlString(hex, out var c); c.a = a; return c; }

        /// 建一個 UI Toolkit 的畫面（UIDocument），回傳根節點
        public static VisualElement CreateRoot(GameObject host, int sort = 0)
        {
            var ps = ScriptableObject.CreateInstance<PanelSettings>();
            ps.scaleMode = PanelScaleMode.ConstantPixelSize;
            ps.scale = Scale();
            ps.sortingOrder = sort;
            ps.clearColor = false;
            var doc = host.AddComponent<UIDocument>();
            doc.panelSettings = ps;
            var root = doc.rootVisualElement;
            root.style.position = Position.Absolute; root.style.left = 0; root.style.top = 0; root.style.right = 0; root.style.bottom = 0;
            root.pickingMode = PickingMode.Ignore;
            root.style.unityFontDefinition = FontDefinition.FromFont(Font);
            root.style.color = C("#f2eefc");
            return root;
        }
        /// 網頁版 1 CSS px 在這裡放大幾倍：電腦照 Windows 的縮放（96 dpi＝1），手機照螢幕密度（160 dpi＝1，像 Android 的 dp）
        public static float Scale()
        {
            float dpi = Screen.dpi > 0 ? Screen.dpi : 96;
            return Application.isMobilePlatform ? Mathf.Max(1, dpi / 160f) : Mathf.Max(1, dpi / 96f);
        }

        // ---- 小工具
        public static VisualElement Box(VisualElement parent = null, string name = null)
        {
            var e = new VisualElement { name = name, pickingMode = PickingMode.Ignore };
            parent?.Add(e);
            return e;
        }
        public static Label Text(VisualElement parent, string text, float size, string color = null, bool bold = false, float shadowY = 0, string shadowCol = "#000000")
        {
            var l = new Label(text) { pickingMode = PickingMode.Ignore };
            l.style.fontSize = size;
            if (color != null) l.style.color = C(color);
            l.style.unityFontStyleAndWeight = bold ? FontStyle.Bold : FontStyle.Normal;
            l.style.paddingLeft = l.style.paddingRight = l.style.paddingTop = l.style.paddingBottom = 0;
            l.style.marginLeft = l.style.marginRight = l.style.marginTop = l.style.marginBottom = 0;
            if (shadowY != 0) l.style.textShadow = new TextShadow { offset = new Vector2(0, shadowY), color = C(shadowCol) };
            parent?.Add(l);
            return l;
        }
        public static void Abs(VisualElement e, float? left = null, float? top = null, float? right = null, float? bottom = null)
        {
            e.style.position = Position.Absolute;
            if (left != null) e.style.left = left.Value;
            if (top != null) e.style.top = top.Value;
            if (right != null) e.style.right = right.Value;
            if (bottom != null) e.style.bottom = bottom.Value;
        }
        public static void Size(VisualElement e, float w, float h) { e.style.width = w; e.style.height = h; }
        /// CSS 的 border-image：texName 的圖切 slice 格（圖上的像素），畫成 border 寬（CSS px），中間也填（fill）
        public static void Nine(VisualElement e, string texName, int slice, float border)
        {
            e.style.backgroundImage = Tex(texName);
            e.style.unitySliceLeft = e.style.unitySliceRight = e.style.unitySliceTop = e.style.unitySliceBottom = slice;
            e.style.unitySliceScale = border / slice;
            e.style.paddingLeft = e.style.paddingRight = e.style.paddingTop = e.style.paddingBottom = border;
        }
        /// 整張圖鋪滿（CSS 的 background: url() center / 100%）
        public static void Img(VisualElement e, string texName)
        {
            e.style.backgroundImage = Tex(texName);
            e.style.backgroundSize = new BackgroundSize(BackgroundSizeType.Contain);
        }
        public static void Img(VisualElement e, Texture2D t)
        {
            e.style.backgroundImage = t;
            e.style.backgroundSize = new BackgroundSize(BackgroundSizeType.Contain);
        }
        /// 水平分層的漸層（CSS 的 linear-gradient(a 0 1px, b 1px 4px, c 4px)）：每層一條實色
        public static VisualElement Bands(VisualElement parent, params (string col, float h)[] bands)
        {
            var e = Box(parent); e.style.flexDirection = FlexDirection.Column; e.style.overflow = Overflow.Hidden;
            for (int i = 0; i < bands.Length; i++)
            {
                var b = Box(e); b.style.backgroundColor = C(bands[i].col);
                if (bands[i].h > 0) { b.style.height = bands[i].h; b.style.flexShrink = 0; } else b.style.flexGrow = 1;
            }
            return e;
        }
    }
}
