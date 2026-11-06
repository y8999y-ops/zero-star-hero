// 像素畫布：遊戲畫面是一張 384×216 的貼圖，每一格用 C# 把像素算好再上傳，放大到螢幕上（最近點取樣，不模糊）。
// 放大倍率：能整數倍就整數倍（像素大小一致），螢幕比畫布小時才用小數倍；多出來的地方塗黑。
// 跟網頁版一樣，固定每秒 60 步：畫面更新率高低都不影響遊戲速度。
using System;
using UnityEngine;
using PixelFX;

namespace ZeroStar
{
    public class PixelScreen : MonoBehaviour
    {
        public const int W = 384, H = 216;
        public const double STEP = 1.0 / 60;

        public Frame Frame { get; private set; }
        public Painter Painter { get; private set; }
        /// 每一步呼叫（固定 1/60 秒）。
        public event Action<double> Tick;
        /// 每次要畫畫面時呼叫：在 Frame 上畫東西。
        public event Action<Painter> Draw;
        /// 畫布沒畫到的地方的顏色（不透明）。
        public uint Background = Col.Hex("#0b0a10");

        Texture2D tex;
        byte[] rgba;
        SpriteRenderer sr;
        Camera cam;
        double acc;

        void Awake()
        {
            Frame = new Frame(W, H);
            Painter = new Painter(Frame);
            rgba = new byte[W * H * 4];
            tex = new Texture2D(W, H, TextureFormat.RGBA32, false) { filterMode = FilterMode.Point, wrapMode = TextureWrapMode.Clamp, name = "PixelScreen" };

            // 顯示方式：一個正交攝影機看著一張 Sprite（1 像素＝1 單位），用攝影機的大小決定放大倍率
            cam = Camera.main != null ? Camera.main : new GameObject("Main Camera", typeof(Camera)).GetComponent<Camera>();
            cam.orthographic = true;
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = Color.black;
            cam.transform.position = new Vector3(0, 0, -10);
            var go = new GameObject("Screen", typeof(SpriteRenderer));
            go.transform.SetParent(transform, false);
            sr = go.GetComponent<SpriteRenderer>();
            sr.sprite = Sprite.Create(tex, new Rect(0, 0, W, H), new Vector2(0.5f, 0.5f), 1f, 0, SpriteMeshType.FullRect);
            sr.flipY = true;   // 畫布第 0 列在最上面，貼圖第 0 列在最下面：上下翻轉
            Application.targetFrameRate = 60;
            QualitySettings.vSyncCount = 0;
        }

        void Update()
        {
            acc = Math.Min(acc + Time.unscaledDeltaTime, 0.25);
            while (acc >= STEP) { acc -= STEP; Tick?.Invoke(STEP); }
            Frame.Clear();
            Painter.Reset();
            Draw?.Invoke(Painter);
            Frame.Composite(rgba, Background);
            tex.SetPixelData(rgba, 0);
            tex.Apply(false);
            Fit();
        }

        void Fit()
        {
            float sw = Screen.width, sh = Screen.height;
            float k = Mathf.Min(sw / W, sh / H);
            if (k >= 1) k = Mathf.Floor(k);
            cam.orthographicSize = sh / (2 * k);
        }
    }
}
