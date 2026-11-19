// 混合畫面（CPU＋shader）的底層。scene-fx skill §6。
// 畫面主體照舊由 C# 在 CPU 算好（Frame → 合成 → 上傳貼圖）；比較重的「整片逐格」效果改在顯示卡上做：
//   CPU 每格額外給 shader 的東西：
//     ・遮罩貼圖（跟畫面一樣大）：這一格是不是「場景本身」（背景可受天氣影響，景物和前景覆蓋的格子扣除）。
//       變濕、積水只改場景的格子，角色、雨滴、水珠留在上面。
//     ・每一欄的資料（城鎮寬 × 1）：R＝積水深度（每格更新）、G＝接雨面、B＝水痕種子、A＝濕亮邊那一列（後三個載入時算一次）。
//     ・世界座標的資料（城鎮寬 × 高）：R＝變濕分數、G＝不會濕（外框、會發光的像素），載入時算一次。
//     ・參數：鏡頭位置、時間、濕度、白天程度、漣漪（最多 32 個）。
//   顯示卡：PostFx.shader 處理需要天氣後製的畫面，結果放在 RenderTexture，ScreenShow.shader 把它畫到螢幕。
// 沒有顯示卡（-nographics 的自動測試）或 shader 不能用：ActiveFor(frame)＝false，CPU 照舊自己畫（TownPuddles、TownRainHits 的 CPU 版）。
// 新效果的寫法：CPU 端只準備資料（ActiveFor(frame) 時不要逐格畫），shader 裡加一段；兩邊都要能跑（沒有顯示卡時用 CPU 版或乾脆不畫）。
using System;
using UnityEngine;
using UnityEngine.Rendering;
using PixelFX;

namespace ZeroStar
{
    public static class PostFx
    {
        /// 開發用：false＝強制用 CPU 版（比較兩種做法）
        public static bool Enabled = true;
        static bool tried, ok;
        static Material post, show;
        public static bool Supported { get { Init(); return ok; } }
        /// CPU 端看這個：true＝交給 shader（自己不要逐格畫），false＝CPU 自己畫
        public static bool ActiveFor(Frame f) => f.UseGpuWeather && Supported && Enabled;
        /// 城鎮的天氣交給顯示卡：除了 ActiveFor，城鎮資料貼圖也要建得起來（擴大碎星鎮後太寬、超過這台的貼圖上限，就改用 CPU 版）
        public static bool TownOnGpu(Frame f) => ActiveFor(f) && worldTex != null;

        static void Init()
        {
            if (tried) return; tried = true;
#if UNITY_EDITOR
            UnityEditor.AssemblyReloadEvents.beforeAssemblyReload += ReleaseSharedResources;
#endif
            Application.quitting += ReleaseSharedResources;
            if (Environment.GetEnvironmentVariable("ZS_POSTFX") == "0") Enabled = false;   // 開發用：強制 CPU 版（比效能）
            if (SystemInfo.graphicsDeviceType == GraphicsDeviceType.Null) return;
            var ps = Resources.Load<Shader>("Shaders/PostFx"); var ss = Resources.Load<Shader>("Shaders/ScreenShow");
            ok = ps != null && ps.isSupported && ss != null && ss.isSupported;
            if (!ok) { Debug.LogWarning("[PostFx] shader 不能用，改用 CPU 版"); return; }
            post = new Material(ps) { hideFlags = HideFlags.HideAndDontSave };
            show = new Material(ss) { hideFlags = HideFlags.HideAndDontSave };
            post.SetVectorArray(ID_RIP, Rip);   // 陣列大小第一次設定就固定
        }

        // ---- 城鎮的資料
        public const int MAX_RIP = 32;
        public static readonly Vector4[] Rip = new Vector4[MAX_RIP];   // 漣漪：x、經過時間、大的（1）、那裡的水深
        public static int RipN;
        public static float Wet, Day, Time; public static int Ox, Oy;
        static Texture2D worldTex, colTex; static byte[] colData; static int townW, townH;
        public static byte[] Cols => colData;   // 每一欄 4 個 byte（RGBA）；R 每格更新
        /// 載入城鎮時叫一次：world＝城鎮寬×高×4（R 分數、G 不會濕），cols＝城鎮寬×4（G、B、A 的靜態資料）
        public static void SetTown(int w, int h, byte[] world, byte[] cols)
        {
            townW = w; townH = h; colData = cols;
            if (!Supported) return;
            if (w > SystemInfo.maxTextureSize || h > SystemInfo.maxTextureSize)
            {
                Debug.LogWarning($"[PostFx] 城鎮 {w}×{h} 超過這台的貼圖上限 {SystemInfo.maxTextureSize}，天氣改用 CPU 版");
                if (worldTex != null) { ReleaseObject(worldTex); worldTex = null; }
                return;
            }
            if (worldTex == null || worldTex.width != w || worldTex.height != h)
            {
                if (worldTex != null) ReleaseObject(worldTex);
                worldTex = new Texture2D(w, h, TextureFormat.RGBA32, false, true) { filterMode = FilterMode.Point, wrapMode = TextureWrapMode.Clamp, name = "PostFxWorld", hideFlags = HideFlags.HideAndDontSave };
            }
            worldTex.SetPixelData(world, 0); worldTex.Apply(false);
            if (colTex == null || colTex.width != w)
            {
                if (colTex != null) ReleaseObject(colTex);
                colTex = new Texture2D(w, 1, TextureFormat.RGBA32, false, true) { filterMode = FilterMode.Point, wrapMode = TextureWrapMode.Clamp, name = "PostFxCols", hideFlags = HideFlags.HideAndDontSave };
            }
        }

        // ---- 顯示卡那一步
        static Texture2D maskTex;
        static byte[] paddedMask;
        static readonly int ID_MASK = Shader.PropertyToID("_MaskTex"), ID_WORLD = Shader.PropertyToID("_WorldTex"), ID_COL = Shader.PropertyToID("_ColTex"),
            ID_WSIZE = Shader.PropertyToID("_WorldSize"), ID_CAM = Shader.PropertyToID("_Cam"), ID_ENV = Shader.PropertyToID("_Env"),
            ID_RIP = Shader.PropertyToID("_Rip"), ID_RIPN = Shader.PropertyToID("_RipN"), ID_POST = Shader.PropertyToID("_PostTex");

        /// 需要天氣效果時輸出同尺寸的 GPU 貼圖，其他畫面直接顯示原始貼圖。
        public static Texture Resolve(Texture2D src, Frame f, ref RenderTexture rt)
        {
            if (!f.WeatherReady || !f.TrackingWeather || !ActiveFor(f) || worldTex == null) return src;
            int tw = src.width, th = src.height;
            if (rt == null || rt.width != tw || rt.height != th)
            {
                if (rt != null) { rt.Release(); ReleaseObject(rt); }
                rt = new RenderTexture(tw, th, 0, RenderTextureFormat.ARGB32, RenderTextureReadWrite.Linear) { filterMode = FilterMode.Point, wrapMode = TextureWrapMode.Clamp, name = "PostFxOut", hideFlags = HideFlags.HideAndDontSave };
                rt.Create();
            }
            if (maskTex == null || maskTex.width != tw || maskTex.height != th)
            {
                if (maskTex != null) ReleaseObject(maskTex);
                maskTex = new Texture2D(tw, th, TextureFormat.R8, false, true) { filterMode = FilterMode.Point, wrapMode = TextureWrapMode.Clamp, name = "PostFxMask", hideFlags = HideFlags.HideAndDontSave };
            }
            if (paddedMask == null || paddedMask.Length != tw*th) paddedMask = new byte[tw*th];
            for (int y=0; y<f.H; y++)
            {
                int start=(y+1)*tw;
                Buffer.BlockCopy(f.WeatherMask,y*f.W,paddedMask,start+1,f.W);
                paddedMask[start]=paddedMask[start+1];
                paddedMask[start+tw-1]=paddedMask[start+tw-2];
            }
            Buffer.BlockCopy(paddedMask,tw,paddedMask,0,tw);
            Buffer.BlockCopy(paddedMask,(th-2)*tw,paddedMask,(th-1)*tw,tw);
            maskTex.SetPixelData(paddedMask,0); maskTex.Apply(false);
            colTex.SetPixelData(colData, 0); colTex.Apply(false);
            post.SetTexture(ID_MASK, maskTex); post.SetTexture(ID_WORLD, worldTex); post.SetTexture(ID_COL, colTex);
            post.SetVector(ID_WSIZE, new Vector4(townW, townH, 0, 0));
            post.SetVectorArray(ID_RIP, Rip); post.SetFloat(ID_RIPN, RipN);
            post.SetVector(ID_ENV, new Vector4(Wet, Day, TownArt.FLOOR, 0));
            post.SetVector(ID_CAM, new Vector4(Ox, Oy, Time, 1));
            Graphics.Blit(src, rt, post);

            return rt;
        }

        static void ReleaseSharedResources()
        {
#if UNITY_EDITOR
            UnityEditor.AssemblyReloadEvents.beforeAssemblyReload -= ReleaseSharedResources;
#endif
            Application.quitting -= ReleaseSharedResources;
            foreach (var resource in new UnityEngine.Object[] { post, show, maskTex, worldTex, colTex })
                if (resource) ReleaseObject(resource);
            post = show = null;
            maskTex = worldTex = colTex = null;
            tried = ok = false;
        }

        internal static void ReleaseObject(UnityEngine.Object value)
        {
            if (Application.isPlaying) UnityEngine.Object.Destroy(value);
            else UnityEngine.Object.DestroyImmediate(value);
        }

        public static void Present(Texture output, Texture2D source, Renderer renderer, Material spriteMaterial)
        {
            if (output == source)
            {
                if (renderer.sharedMaterial != spriteMaterial) renderer.sharedMaterial = spriteMaterial;
                return;
            }
            show.SetTexture(ID_POST, output);
            if (renderer.sharedMaterial != show) renderer.sharedMaterial = show;
        }

        /// 截圖與顯示使用相同的上傳、補邊及後製，只有截圖才讀回 CPU。
        public static void RenderInto(byte[] rgba, Frame f)
        {
            using (var presentation = new FramePresentation(f.W,f.H))
            {
                Buffer.BlockCopy(rgba,0,presentation.Pixels,0,rgba.Length);
                var output=presentation.Upload(f);
                if (!(output is RenderTexture result))
                {
                    Buffer.BlockCopy(presentation.Pixels,0,rgba,0,rgba.Length);
                    return;
                }
                var previous=RenderTexture.active;
                var read=new Texture2D(f.W,f.H,TextureFormat.RGBA32,false);
                try
                {
                    RenderTexture.active=result;
                    read.ReadPixels(new Rect(1,1,f.W,f.H),0,0);
                    read.GetPixelData<byte>(0).CopyTo(rgba);
                }
                finally { RenderTexture.active=previous; ReleaseObject(read); }
            }
        }
    }
}
