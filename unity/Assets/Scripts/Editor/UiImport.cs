// 介面素材（Resources/UI 底下的 PNG：網頁版 ui-art.js 匯出的面板、按鈕、圖示、系統的臉、徽章）匯入時一律設成像素圖：
// 最近點取樣（不模糊）、不壓縮、不產生縮小圖、邊緣不重複。關卡縮圖（Resources/Thumbs）也一樣。
// 標題畫面、開場動畫的美術（Resources/Art，從 game/art 複製）另外設成可讀（C# 畫布要讀像素）。
using UnityEditor;
using UnityEngine;

namespace ZeroStar.EditorTools
{
    public class UiImport : AssetPostprocessor
    {
        void OnPreprocessTexture()
        {
            string p = assetPath.Replace('\\', '/');
            bool art = p.Contains("/Resources/Art/");   // 標題、開場用的美術圖（Pix2D 要讀像素）
            if (!p.Contains("/Resources/UI/") && !p.Contains("/Resources/Thumbs/") && !art) return;
            var ti = (TextureImporter)assetImporter;
            ti.textureType = TextureImporterType.Default;
            ti.filterMode = FilterMode.Point;
            ti.textureCompression = TextureImporterCompression.Uncompressed;
            ti.mipmapEnabled = false;
            ti.wrapMode = TextureWrapMode.Clamp;
            ti.alphaIsTransparency = true;
            ti.npotScale = TextureImporterNPOTScale.None;
            ti.isReadable = art;
        }
        /// 已經匯入過的介面素材重新照上面的設定匯入一次
        [MenuItem("零星工具/重新匯入介面素材")]
        public static void Reimport()
        {
            foreach (var dir in new[] { "Assets/Resources/UI", "Assets/Resources/Thumbs", "Assets/Resources/Art" })
                AssetDatabase.ImportAsset(dir, ImportAssetOptions.ImportRecursive | ImportAssetOptions.ForceUpdate);
        }
    }
}
