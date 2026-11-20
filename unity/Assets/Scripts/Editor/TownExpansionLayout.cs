using System;
using System.Linq;
using UnityEditor;
using UnityEngine;

namespace ZeroStar.EditorTools
{
    public static class TownExpansionLayout
    {
        const string PrefabPath = "Assets/Resources/StageLayouts/town.prefab";

        [MenuItem("ZeroStar/場景擺設/準備碎星鎮擴建舊街")]
        public static void PrepareStreet()
        {
            var prefab = PrefabUtility.LoadPrefabContents(PrefabPath);
            try
            {
                var stamps = prefab.GetComponentsInChildren<WorldStamp>(true);
                if (stamps.All(stamp => stamp.role != "town-street"))
                {
                    var start = stamps.Single(stamp => stamp.kind == StampKind.Start);
                    int offset = TownArt.FLOOR - start.original.y;
                    var groups = stamps.Select(stamp => TopGroup(stamp.transform, prefab.transform)).Distinct();
                    foreach (var group in groups) group.localPosition += Vector3.down * offset;
                    // original is the baked sprite or light position, now in the shifted world.
                    foreach (var stamp in stamps) stamp.original += new Vector2Int(0, offset);

                    var collision = new GameObject("城鎮地形");
                    collision.transform.SetParent(prefab.transform, false);
                    AddSolid(collision.transform, "街道路面", "town-street",
                        0, TownArt.FLOOR, TownArt.TOWN_W, TownArt.H - TownArt.FLOOR);
                    AddSolid(collision.transform, "西界", "town-west",
                        0, 0, TownArt.WALL, TownArt.H);
                    AddSolid(collision.transform, "東界", "town-east",
                        TownArt.TOWN_W - TownArt.WALL, 0, TownArt.WALL, TownArt.H);
                    PrefabUtility.SaveAsPrefabAsset(prefab, PrefabPath);
                }
            }
            finally { PrefabUtility.UnloadPrefabContents(prefab); }

            ImportBackdrop("far-up");
            ImportBackdrop("mid-up");
            Debug.Log("[TownExpansion] 舊街移至 y=440，碰撞由城鎮地形擺設提供。");
        }

        static Transform TopGroup(Transform stamp, Transform root)
        {
            while (stamp.parent != root) stamp = stamp.parent;
            return stamp;
        }

        static void AddSolid(Transform parent, string name, string role, int x, int y, int width, int height)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.transform.localPosition = new Vector3(x, -y, 0);
            var stamp = go.AddComponent<WorldStamp>();
            stamp.kind = StampKind.Solid;
            stamp.role = role;
            stamp.index = -1;
            stamp.original = new Vector2Int(x, y);
            stamp.size = new Vector2Int(width, height);
        }

        static void ImportBackdrop(string name)
        {
            var path = "Assets/Resources/Art/town2/" + name + ".png";
            if (!(AssetImporter.GetAtPath(path) is TextureImporter importer))
                throw new InvalidOperationException("找不到擴建視差圖：" + path);
            if (importer.isReadable && !importer.mipmapEnabled && importer.filterMode == FilterMode.Point
                && importer.textureCompression == TextureImporterCompression.Uncompressed
                && importer.npotScale == TextureImporterNPOTScale.None) return;
            importer.isReadable = true;
            importer.mipmapEnabled = false;
            importer.filterMode = FilterMode.Point;
            importer.textureCompression = TextureImporterCompression.Uncompressed;
            importer.npotScale = TextureImporterNPOTScale.None;
            importer.SaveAndReimport();
        }
    }
}
