// 混合畫面（CPU＋shader）的底層。scene-fx skill §6。
// 畫面主體照舊由 C# 在 CPU 算好（Frame → 合成 → 上傳貼圖）；比較重的「整片逐格」效果改在顯示卡上做：
//   CPU 每格額外給 shader 的東西：
//     ・遮罩貼圖（跟畫面一樣大）：這一格是不是「場景本身」（場景畫完時記下畫面，之後角色、特效、雨改過的格子就不是場景）。
//       變濕、積水只改場景的格子，角色、雨滴、水珠留在上面。
//     ・每一欄的資料（城鎮寬 × 1）：R＝積水深度（每格更新）、G＝接雨面、B＝水痕種子、A＝濕亮邊那一列（後三個載入時算一次）。
//     ・世界座標的資料（城鎮寬 × 高）：R＝變濕分數、G＝不會濕（外框、會發光的像素），載入時算一次。
//     ・參數：鏡頭位置、時間、濕度、白天程度、漣漪（最多 32 個）。
//   顯示卡：PostFx.shader 一次跑完（場景不是城鎮就原樣輸出），結果放在 RenderTexture，ScreenShow.shader 把它畫到螢幕。
// 沒有顯示卡（-nographics 的自動測試）或 shader 不能用：Active＝false，CPU 照舊自己畫（TownPuddles、TownRainHits 的 CPU 版）。
// 新效果的寫法：CPU 端只準備資料（Active 時不要逐格畫），shader 裡加一段；兩邊都要能跑（沒有顯示卡時用 CPU 版或乾脆不畫）。
using System;
using UnityEngine;
using UnityEngine.Rendering;
using PixelFX;

namespace ZeroStar
{
    public static class PostFx
    {
        /// 有人負責把 shader 的結果畫出來（PixelScreen、WeatherShot 的顯示卡模式）時設 true
        public static bool Use;
        /// 開發用：false＝強制用 CPU 版（比較兩種做法）
        public static bool Enabled = true;
        static bool tried, ok;
        static Material post, show;
        public static bool Supported { get { Init(); return ok; } }
        /// CPU 端看這個：true＝交給 shader（自己不要逐格畫），false＝CPU 自己畫
        public static bool Active => Use && Enabled && Supported;

        static void Init()
        {
            if (tried) return; tried = true;
            if (Environment.GetEnvironmentVariable("ZS_POSTFX") == "0") Enabled = false;   // 開發用：強制 CPU 版（比效能）
            if (SystemInfo.graphicsDeviceType == GraphicsDeviceType.Null) return;
            var ps = Resources.Load<Shader>("Shaders/PostFx"); var ss = Resources.Load<Shader>("Shaders/ScreenShow");
            ok = ps != null && ps.isSupported && ss != null && ss.isSupported;
            if (!ok) { Debug.LogWarning("[PostFx] shader 不能用，改用 CPU 版"); return; }
            post = new Material(ps) { hideFlags = HideFlags.HideAndDontSave };
            show = new Material(ss) { hideFlags = HideFlags.HideAndDontSave };
            post.SetVectorArray(ID_RIP, Rip);   // 陣列大小第一次設定就固定
        }

        // ---- 場景遮罩
        static uint[] snap, snap2; static bool marked, masked;
        static byte[] mask; static int maskW, maskH;
        /// 場景（背景、建築、地面）畫完時叫：之後改過的格子都不算場景
        public static void MarkScenery(Frame f)
        {
            if (!Active) return;
            int n = f.W * f.H;
            if (snap == null || snap.Length != n) snap = new uint[n];
            Array.Copy(f.Color, snap, n); marked = true; masked = false;
        }
        /// 角色、雨都畫完、前景（比主角近的草葉）之前叫：算出遮罩，並記下畫面，前景畫過的格子再扣掉（FinishMask）
        public static void BuildMask(Frame f)
        {
            if (!Active || !marked) return;
            int W = f.W, H = f.H, tw = W + 2, th = H + 2;
            if (mask == null || maskW != tw || maskH != th) { mask = new byte[tw * th]; maskW = tw; maskH = th; }
            var C = f.Color;
            for (int y = 0; y < H; y++)
            {
                int row = y * W, mrow = (y + 1) * tw + 1;
                for (int x = 0; x < W; x++) mask[mrow + x] = C[row + x] == snap[row + x] ? (byte)255 : (byte)0;
            }
            if (snap2 == null || snap2.Length != C.Length) snap2 = new uint[C.Length];
            Array.Copy(C, snap2, C.Length); masked = true;
        }
        /// 前景畫完、四角壓暗之前叫：前景蓋到的格子不算場景
        public static void FinishMask(Frame f)
        {
            if (!masked) return;
            int W = f.W, H = f.H, tw = W + 2; var C = f.Color;
            for (int y = 0; y < H; y++)
            {
                int row = y * W, mrow = (y + 1) * tw + 1;
                for (int x = 0; x < W; x++) if (C[row + x] != snap2[row + x]) mask[mrow + x] = 0;
            }
        }

        // ---- 城鎮的資料
        public const int MAX_RIP = 32;
        public static readonly Vector4[] Rip = new Vector4[MAX_RIP];   // 漣漪：x、經過時間、大的（1）、那裡的水深
        public static int RipN;
        public static float Wet, Day, Time; public static int Ox, Oy;
        /// 這一格城鎮有把資料準備好（TownPuddles 設；Render 之後清掉，所以換到關卡就自動變回原樣輸出）
        public static bool TownFrame;
        static Texture2D worldTex, colTex; static byte[] colData; static int townW, townH;
        public static byte[] Cols => colData;   // 每一欄 4 個 byte（RGBA）；R 每格更新
        /// 載入城鎮時叫一次：world＝城鎮寬×高×4（R 分數、G 不會濕），cols＝城鎮寬×4（G、B、A 的靜態資料）
        public static void SetTown(int w, int h, byte[] world, byte[] cols)
        {
            townW = w; townH = h; colData = cols;
            if (!Supported) return;
            if (worldTex == null || worldTex.width != w || worldTex.height != h)
            {
                if (worldTex != null) UnityEngine.Object.Destroy(worldTex);
                worldTex = new Texture2D(w, h, TextureFormat.RGBA32, false, true) { filterMode = FilterMode.Point, wrapMode = TextureWrapMode.Clamp, name = "PostFxWorld", hideFlags = HideFlags.HideAndDontSave };
            }
            worldTex.SetPixelData(world, 0); worldTex.Apply(false);
            if (colTex == null || colTex.width != w)
            {
                if (colTex != null) UnityEngine.Object.Destroy(colTex);
                colTex = new Texture2D(w, 1, TextureFormat.RGBA32, false, true) { filterMode = FilterMode.Point, wrapMode = TextureWrapMode.Clamp, name = "PostFxCols", hideFlags = HideFlags.HideAndDontSave };
            }
        }

        // ---- 顯示卡那一步
        static RenderTexture rt; static Texture2D maskTex;
        static readonly int ID_MASK = Shader.PropertyToID("_MaskTex"), ID_WORLD = Shader.PropertyToID("_WorldTex"), ID_COL = Shader.PropertyToID("_ColTex"),
            ID_WSIZE = Shader.PropertyToID("_WorldSize"), ID_CAM = Shader.PropertyToID("_Cam"), ID_ENV = Shader.PropertyToID("_Env"),
            ID_RIP = Shader.PropertyToID("_Rip"), ID_RIPN = Shader.PropertyToID("_RipN"), ID_POST = Shader.PropertyToID("_PostTex");

        /// 把 CPU 的畫面（含四周補的一格，寬 W+2、高 H+2）跑過 shader，結果在回傳的 RenderTexture（同樣大小）
        public static RenderTexture Render(Texture2D src, Frame f)
        {
            Init();
            int tw = src.width, th = src.height;
            if (rt == null || rt.width != tw || rt.height != th)
            {
                if (rt != null) { rt.Release(); UnityEngine.Object.Destroy(rt); }
                rt = new RenderTexture(tw, th, 0, RenderTextureFormat.ARGB32, RenderTextureReadWrite.Linear) { filterMode = FilterMode.Point, wrapMode = TextureWrapMode.Clamp, name = "PostFxOut", hideFlags = HideFlags.HideAndDontSave };
                rt.Create();
            }
            bool town = TownFrame && marked && masked && worldTex != null && mask != null && maskW == tw && maskH == th;
            if (town)
            {
                if (maskTex == null || maskTex.width != tw || maskTex.height != th)
                {
                    if (maskTex != null) UnityEngine.Object.Destroy(maskTex);
                    maskTex = new Texture2D(tw, th, TextureFormat.R8, false, true) { filterMode = FilterMode.Point, wrapMode = TextureWrapMode.Clamp, name = "PostFxMask", hideFlags = HideFlags.HideAndDontSave };
                }
                maskTex.SetPixelData(mask, 0); maskTex.Apply(false);
                colTex.SetPixelData(colData, 0); colTex.Apply(false);
                post.SetTexture(ID_MASK, maskTex); post.SetTexture(ID_WORLD, worldTex); post.SetTexture(ID_COL, colTex);
                post.SetVector(ID_WSIZE, new Vector4(townW, townH, 0, 0));
                post.SetVectorArray(ID_RIP, Rip); post.SetFloat(ID_RIPN, RipN);
                post.SetVector(ID_ENV, new Vector4(Wet, Day, TownArt.FLOOR, 0));
            }
            post.SetVector(ID_CAM, new Vector4(Ox, Oy, Time, town ? 1 : 0));
            Graphics.Blit(src, rt, post);
            TownFrame = false; marked = false; masked = false;
            return rt;
        }

        static Material defaultMat;
        /// PixelScreen 每格上傳貼圖之後叫：可以用 shader 就把結果換上去，不行就維持原本的貼圖
        public static void Present(Texture2D src, Frame f, Renderer r)
        {
            if (defaultMat == null) defaultMat = r.sharedMaterial;
            if (!Active) { if (r.sharedMaterial != defaultMat) r.sharedMaterial = defaultMat; TownFrame = false; marked = masked = false; return; }
            var o = Render(src, f);
            show.SetTexture(ID_POST, o);
            if (r.sharedMaterial != show) r.sharedMaterial = show;
        }

        /// 截圖工具用：rgba（W×H，左上原點）跑過 shader 再讀回來
        public static void RenderInto(byte[] rgba, Frame f)
        {
            int W = f.W, H = f.H, tw = W + 2, th = H + 2;
            var up = new byte[tw * th * 4];
            for (int i = 3; i < rgba.Length; i += 4) rgba[i] = 255;
            PixelScreen.PadEdges(rgba, up, W, H);
            var src = new Texture2D(tw, th, TextureFormat.RGBA32, false) { filterMode = FilterMode.Point, wrapMode = TextureWrapMode.Clamp };
            src.SetPixelData(up, 0); src.Apply(false);
            var o = Render(src, f);
            var prev = RenderTexture.active; RenderTexture.active = o;
            var rd = new Texture2D(tw, th, TextureFormat.RGBA32, false);
            rd.ReadPixels(new Rect(0, 0, tw, th), 0, 0); rd.Apply(false);
            RenderTexture.active = prev;
            var got = rd.GetPixelData<byte>(0);
            for (int y = 0; y < H; y++) for (int x = 0; x < W; x++)
            {
                int s = ((y + 1) * tw + x + 1) * 4, d = (y * W + x) * 4;
                rgba[d] = got[s]; rgba[d + 1] = got[s + 1]; rgba[d + 2] = got[s + 2]; rgba[d + 3] = 255;
            }
            UnityEngine.Object.DestroyImmediate(src); UnityEngine.Object.DestroyImmediate(rd);
        }
    }
}
