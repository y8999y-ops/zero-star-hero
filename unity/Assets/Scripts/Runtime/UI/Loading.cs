// loading.js＋loading-art.js：載入畫面。開遊戲、換場景時蓋住畫面，中間一顆蹦蹦跳的小星星（落地壓扁、彈起拉長、會眨眼、臉頰紅紅，
// 旁邊三顆小星光輪流閃），下面「載入中...」。踩傳送門通關後，換場景時在這裡播通關成績（系統框的樣子，一行一行打出來，
// 打完再停 1.2 秒，點一下可以跳過）。準備好了就淡掉（0.35 秒）。
using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UIElements;
using static ZeroStar.UI.Ui;

namespace ZeroStar.UI
{
    public class Loading
    {
        const int W = 48, H = 40; const float CYCLE = 0.7f;
        static readonly string OUT = "#2a1406", EYE = "#2a1406", BLUSH = "#ff8a9a", SH = "#000000"; static readonly string[] G = { "#8a4c10", "#d8962a", "#f6c843", "#ffe98a", "#fffbe0" };
        readonly VisualElement root, cv, rep; readonly Label lt; readonly List<Label> lines = new List<Label>(); readonly List<string> lineText = new List<string>();
        readonly Texture2D tex = new Texture2D(W, H, TextureFormat.RGBA32, false) { filterMode = FilterMode.Point }; readonly Color32[] buf = new Color32[W * H];
        float t, fadeT = -1, minUntil, repT; bool ready, showing;
        public bool Showing => showing;

        public Loading(VisualElement parent)
        {
            root = Box(parent, "loading"); Abs(root, 0, 0, 0, 0); root.style.backgroundColor = C("#0d0b14"); root.style.alignItems = Align.Center; root.style.justifyContent = Justify.Center;
            root.pickingMode = PickingMode.Position; root.style.display = DisplayStyle.None;
            cv = Box(root, "loadCv"); Size(cv, 144, 120); cv.style.backgroundImage = tex; cv.style.backgroundSize = new BackgroundSize(Length.Percent(100), Length.Percent(100));
            lt = Text(root, "載入中...", 14, "#ffe98a", true, 2, "#2a1406"); lt.style.letterSpacing = 3; lt.style.marginTop = 6;
            rep = Box(root, "crSys"); Abs(rep); rep.style.left = Length.Percent(50); rep.style.top = Length.Percent(42); rep.style.translate = new Translate(Length.Percent(-50), Length.Percent(-50));
            rep.style.maxWidth = 460; Nine(rep, "panel-sys2", 8, 8); rep.style.paddingLeft = rep.style.paddingRight = 8 + 12; rep.style.paddingTop = 8 + 2; rep.style.paddingBottom = 8 + 6; rep.style.display = DisplayStyle.None;
            var head = Text(rep, "■ SYSTEM // 系統", 12, "#6ad8ff", true); head.style.letterSpacing = 3;
            root.RegisterCallback<PointerDownEvent>(e => { minUntil = 0; repT = 999; });
        }

        /// 蓋住畫面。report：通關成績（null＝只有載入中）
        public void Show(string[] report = null)
        {
            showing = true; ready = false; fadeT = -1; root.style.display = DisplayStyle.Flex; root.style.opacity = 1; t = 0; repT = 0;
            foreach (var l in lines) l.RemoveFromHierarchy(); lines.Clear(); lineText.Clear();
            if (report != null)
            {
                rep.style.display = DisplayStyle.Flex; root.style.justifyContent = Justify.FlexEnd; root.style.paddingBottom = Length.Percent(5); cv.style.scale = new Scale(Vector2.one * 0.6f); cv.style.marginBottom = -10;
                float at = 0.25f;
                for (int i = 0; i < report.Length; i++)
                {
                    var l = Text(rep, "", i == 0 ? 18 : 15, i == 0 ? "#ffe27a" : "#e8fbff", true, 1, "#04101e"); if (i == 0) l.style.letterSpacing = 2; l.style.whiteSpace = WhiteSpace.Normal;
                    lines.Add(l); lineText.Add(report[i]); at += report[i].Length * 0.04f + 0.12f;
                }
                minUntil = at + 1.2f;
            }
            else { rep.style.display = DisplayStyle.None; root.style.justifyContent = Justify.Center; root.style.paddingBottom = 0; cv.style.scale = new Scale(Vector2.one); cv.style.marginBottom = 0; minUntil = 0.4f; }
        }
        /// 後面準備好了：時間到（成績打完再停 1.2 秒）就淡掉
        public void Done() { ready = true; }

        public void Update(float dt)
        {
            if (!showing) return;
            t += dt; repT += dt;
            // 小星星
            Array.Clear(buf, 0, buf.Length);
            DrawLoading(t);
            tex.SetPixels32(buf); tex.Apply(false); cv.MarkDirtyRepaint();
            // 「載入中...」的點一個一個跳
            int n = (int)(t * 2) % 4; lt.text = "載入中" + new string('.', Math.Max(1, n));
            // 成績：每個字 40ms，一行接一行
            float at = 0.25f;
            for (int i = 0; i < lines.Count; i++)
            {
                int show = Mathf.Clamp((int)((repT - at) / 0.04f), 0, lineText[i].Length); lines[i].text = lineText[i].Substring(0, show);
                at += lineText[i].Length * 0.04f + 0.12f;
            }
            if (ready && fadeT < 0 && t >= minUntil) fadeT = 0;
            if (fadeT >= 0) { fadeT += dt; root.style.opacity = 1 - Mathf.Clamp01(fadeT / 0.35f); if (fadeT >= 0.35f) { showing = false; root.style.display = DisplayStyle.None; } }
        }

        void Set(double x, double y, string c, float a = 1)
        {
            int ix = (int)Math.Round(x), iy = (int)Math.Round(y); if (ix < 0 || iy < 0 || ix >= W || iy >= H) return;
            ColorUtility.TryParseHtmlString(c, out var col); var d = buf[(H - 1 - iy) * W + ix];
            Color dc = d; float oa = a + dc.a * (1 - a); if (oa <= 0) return;
            buf[(H - 1 - iy) * W + ix] = new Color((col.r * a + dc.r * dc.a * (1 - a)) / oa, (col.g * a + dc.g * dc.a * (1 - a)) / oa, (col.b * a + dc.b * dc.a * (1 - a)) / oa, oa);
        }
        static bool InStar(double x, double y, double r, double rot)
        {
            double a = Math.Atan2(y, x) - rot, d = Math.Sqrt(x * x + y * y), seg = Math.PI / 5;
            double f = ((a % (2 * seg)) + 2 * seg) % (2 * seg); f = Math.Abs(f - seg) / seg;
            return d <= r * (0.52 + 0.48 * f);
        }
        /// loading-art.js 的 drawLoading
        void DrawLoading(double t)
        {
            double p = (t % CYCLE) / CYCLE, hy = 0, sx = 1, sy = 1;
            if (p < 0.12) { double k = Math.Sin(p / 0.12 * Math.PI); sx = 1 + 0.25 * k; sy = 1 - 0.22 * k; }
            else { double q = (p - 0.12) / 0.88; hy = 4 * q * (1 - q) * 11; double s = 1 - Math.Abs(q - 0.5) * 2; sx = 1 - 0.08 * (1 - s); sy = 1 + 0.1 * (1 - s); }
            const int ground = 34, r = 11, cx = 24; double cy = ground - r * sy * 0.82 - hy, rot = -Math.PI / 2 + Math.Sin(t * 4) * 0.04;
            int sw = (int)Math.Round(9 - hy * 0.35);
            for (int x = -sw; x <= sw; x++) { Set(cx + x, ground + 1, SH, 0.55f); if (Math.Abs(x) < sw - 2) Set(cx + x, ground + 2, SH, 0.3f); }
            bool Inside(double x, double y) => InStar((x - cx) / sx, (y - cy) / sy, r, rot);
            for (int y = (int)Math.Floor(cy - 14); y <= ground; y++) for (int x = cx - 15; x <= cx + 15; x++)
            {
                double px = x + 0.5, py = y + 0.5;
                if (Inside(px, py))
                {
                    double lx = (px - cx) / (r * sx), ly = (py - cy) / (r * sy), l = -lx * 0.6 - ly * 0.8;
                    bool edge = !Inside(px + 1, py) || !Inside(px, py + 1);
                    Set(x, y, edge ? G[1] : l > 0.62 ? G[4] : l > 0.3 ? G[3] : G[2]);
                }
                else if (Inside(px + 1, py) || Inside(px - 1, py) || Inside(px, py + 1) || Inside(px, py - 1)) Set(x, y, OUT);
            }
            int ey = (int)Math.Round(cy) - 1; bool blink = t % 2.1 > 1.98;
            foreach (int dx in new[] { -4, 2 })
            {
                if (blink) { Set(cx + dx, ey + 1, EYE); Set(cx + dx + 1, ey + 1, EYE); }
                else { Set(cx + dx, ey, EYE); Set(cx + dx + 1, ey, "#ffffff"); Set(cx + dx, ey + 1, EYE); Set(cx + dx + 1, ey + 1, EYE); }
                Set(cx + dx + (dx < 0 ? -1 : 2), ey + 2, BLUSH);
            }
            Set(cx - 2, ey + 3, EYE); Set(cx - 1, ey + 4, EYE); Set(cx, ey + 4, EYE); Set(cx + 1, ey + 3, EYE);
            var spots = new[] { (7, 12), (41, 9), (38, 26) };
            for (int i = 0; i < 3; i++)
            {
                var (x, y) = spots[i]; double k = Math.Sin((t * 2.4 + i * 0.33) * Math.PI * 2);
                if (k < 0.1) continue;
                Set(x, y, "#ffffff"); string c = k > 0.6 ? G[3] : G[2];
                Set(x - 1, y, c); Set(x + 1, y, c); Set(x, y - 1, c); Set(x, y + 1, c);
                if (k > 0.75) { Set(x - 2, y, G[1]); Set(x + 2, y, G[1]); Set(x, y - 2, G[1]); Set(x, y + 2, G[1]); }
            }
        }
    }
}
