// 介面素材（Resources/UI 底下的 PNG：網頁版 ui-art.js 匯出的面板、按鈕、圖示、系統的臉、徽章）匯入時一律設成像素圖：
// 最近點取樣（不模糊）、不壓縮、不產生縮小圖、邊緣不重複。關卡縮圖（Resources/Thumbs）也一樣。
using UnityEditor;
using UnityEngine;

namespace ZeroStar.EditorTools
{
    public class UiImport : AssetPostprocessor
    {
        void OnPreprocessTexture()
        {
            string p = assetPath.Replace('\\', '/');
            if (!p.Contains("/Resources/UI/") && !p.Contains("/Resources/Thumbs/")) return;
            var ti = (TextureImporter)assetImporter;
            ti.textureType = TextureImporterType.Default;
            ti.filterMode = FilterMode.Point;
            ti.textureCompression = TextureImporterCompression.Uncompressed;
            ti.mipmapEnabled = false;
            ti.wrapMode = TextureWrapMode.Clamp;
            ti.alphaIsTransparency = true;
            ti.npotScale = TextureImporterNPOTScale.None;
            ti.isReadable = false;
        }
        /// 已經匯入過的介面素材重新照上面的設定匯入一次
        [MenuItem("零星工具/重新匯入介面素材")]
        public static void Reimport()
        {
            foreach (var dir in new[] { "Assets/Resources/UI", "Assets/Resources/Thumbs" })
                AssetDatabase.ImportAsset(dir, ImportAssetOptions.ImportRecursive | ImportAssetOptions.ForceUpdate);
        }
    }
}
