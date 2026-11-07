// 像素畫布：遊戲畫面是一張 W×216 的貼圖，每一格用 C# 把像素算好再上傳，放大到螢幕上（最近點取樣，不模糊）。
// 照網頁版 main.js 的 resize／applyZoom：
//   寬度跟著螢幕比例（320～480，16:9 是 384，手機長螢幕比較寬）；
//   顯示時放大 Zoom 倍（1.38），四周超出螢幕的裁掉；看得到的範圍往下移 ViewDy 格（看得到腳下多一點）。
// 跟網頁版一樣，固定每秒 60 步：畫面更新率高低都不影響遊戲速度（一次最多補 0.1 秒）。
using System;
using UnityEngine;
using PixelFX;

namespace ZeroStar
{
    public class PixelScreen : MonoBehaviour
    {
        public const int H = 216;
        public const double STEP = 1.0 / 60;
        public int W { get; private set; } = 384;
        public double Zoom = 1.38;
        public int ViewDy = 8;

        public Frame Frame { get; private set; }
        /// 每一步呼叫（固定 1/60 秒）。
        public event Action<double> Tick;
        /// 每次要畫畫面時呼叫：在 Frame 上畫東西。
        public event Action<Frame> Draw;
        /// 畫布大小改了（螢幕比例變了）
        public event Action<int> Resized;
        /// 合成之後再改像素（大招的黑白定格）
        public event Action<byte[]> PostComposite;

        Texture2D tex;
        byte[] rgba;
        SpriteRenderer sr;
        Camera cam;
        double acc;
        float lastAspect;
        /// 效能：最近 0.5 秒平均每格花多少毫秒算畫面（遊戲邏輯＋畫圖＋合成，不含上傳貼圖）、每秒幾格
        public double AvgMs { get; private set; }
        public double Fps { get; private set; }
        public double MaxMs { get; private set; }   // 最近 0.5 秒最慢的一格
        double perfMax;
        double perfMs, perfT; int perfN;
        readonly System.Diagnostics.Stopwatch watch = new System.Diagnostics.Stopwatch();

        public static int WidthFor(float aspect) => Math.Max(320, Math.Min(480, (int)Pf.Round(H * aspect / 2) * 2));

        void Awake()
        {
            cam = Camera.main != null ? Camera.main : new GameObject("Main Camera", typeof(Camera)).GetComponent<Camera>();
            cam.orthographic = true;
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = Color.black;
            var go = new GameObject("Screen", typeof(SpriteRenderer));
            go.transform.SetParent(transform, false);
            sr = go.GetComponent<SpriteRenderer>();
            sr.flipY = true;   // 畫布第 0 列在最上面，貼圖第 0 列在最下面：上下翻轉
            Application.targetFrameRate = 60;
            QualitySettings.vSyncCount = 0;
            Rebuild(WidthFor(Aspect()));
        }
        static float Aspect() => Screen.height > 0 ? (float)Screen.width / Screen.height : 16f / 9;

        void Rebuild(int w)
        {
            W = w; lastAspect = Aspect();
            Frame = new Frame(W, H);
            rgba = new byte[W * H * 4];
            if (tex != null) Destroy(tex);
            tex = new Texture2D(W, H, TextureFormat.RGBA32, false) { filterMode = FilterMode.Point, wrapMode = TextureWrapMode.Clamp, name = "PixelScreen" };
            sr.sprite = Sprite.Create(tex, new Rect(0, 0, W, H), new Vector2(0.5f, 0.5f), 1f, 0, SpriteMeshType.FullRect);
            Resized?.Invoke(W);
        }

        void Update()
        {
            if (Math.Abs(Aspect() - lastAspect) > 0.001f) { int w = WidthFor(Aspect()); if (w != W) Rebuild(w); else lastAspect = Aspect(); }
            watch.Restart();
            acc += Math.Min(0.1, Time.unscaledDeltaTime);
            while (acc >= STEP) { acc -= STEP; Tick?.Invoke(STEP); }
            Frame.Clear();
            Draw?.Invoke(Frame);
            Frame.Composite(rgba, null, 0.8);
            PostComposite?.Invoke(rgba);
            double ms = watch.Elapsed.TotalMilliseconds;
            perfMs += ms; perfN++; perfMax = Math.Max(perfMax, ms);
            if ((perfT += Time.unscaledDeltaTime) >= 0.5) { AvgMs = perfMs / perfN; Fps = perfN / perfT; MaxMs = perfMax; perfMs = 0; perfN = 0; perfT = 0; perfMax = 0; }
            // 沒畫到的地方（透明）在網頁上會露出黑底：這裡直接補成不透明
            for (int i = 3; i < rgba.Length; i += 4) rgba[i] = 255;
            tex.SetPixelData(rgba, 0);
            tex.Apply(false);
            Fit();
        }

        /// 放大倍率：畫布高度剛好塞滿螢幕再放大 Zoom 倍；看得到的範圍往下移 ViewDy 格
        void Fit()
        {
            float sw = Screen.width, sh = Screen.height;
            double k = Math.Min(sw / W, sh / H) * Zoom;
            cam.orthographicSize = (float)(sh / (2 * k));
            double vh = H / Zoom, my = (H - vh) / 2, dy = Math.Min(ViewDy, my);
            cam.transform.position = new Vector3(0, (float)-dy, -10);
        }

        /// 畫布座標（左上原點）→ 螢幕座標（像素，左下原點）
        public Vector2 CanvasToScreen(Vector2 c)
        {
            var s = cam.WorldToScreenPoint(new Vector3(c.x - W / 2f, H / 2f - c.y, 0));
            return new Vector2(s.x, s.y);
        }
        /// 螢幕座標（像素，左下原點）→ 畫布座標（左上原點）
        public Vector2 ScreenToCanvas(Vector2 p)
        {
            var w = cam.ScreenToWorldPoint(new Vector3(p.x, p.y, 10));
            return new Vector2(w.x + W / 2f, H / 2f - w.y);
        }
    }
}
