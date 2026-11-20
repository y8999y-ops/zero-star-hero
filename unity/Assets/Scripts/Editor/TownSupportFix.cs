// 碎星鎮擴建：修掉「浮空」（2026-11-20，使用者：「碎星鎮擴建有一些問題如建築浮空等」）。
// 規則：可以站的台地都要看得出靠在什麼上面——下面的建築屋頂、旁邊的牆（鐘樓、大樹），或是一路接到地面／屋頂的支撐。
//   懸在半空、底下什麼都沒有的支撐（短柱、鐵鍊、外側的斜撐）拿掉；要撐住的柱子、鷹架拉長到碰到地面或下一層。
//   只改裝飾圖（PaintedDetail），碰撞、梯子、平台都不動。拉長的圖是通過稿的柱頭＋柱腳不動、中間重複（StagePieces/World/TownExpansion/*-長度.png）。
// 執行：Unity -batchmode -executeMethod ZeroStar.Tests.TownSupportFix.Apply -quit；之後跑 TownFloatCheck 看剩下的。
using System.Collections.Generic;
using System.Linq;
using UnityEditor;
using UnityEngine;

namespace ZeroStar.Tests
{
    public static class TownSupportFix
    {
        const string PrefabPath = "Assets/Resources/StageLayouts/town.prefab";
        const string Folder = "Assets/StagePieces/World/TownExpansion/";

        // 拿掉：懸空、沒有東西可以撐的支撐（名稱, x, y）
        static readonly (string name, int x, int y)[] Remove =
        {
            ("iron-chain", 1158, 311), ("brace-left", 981, 308), ("brace-right", 1202, 308),   // 鎮長台地：左邊壓在工坊屋頂、右邊壓在木屋屋頂上
            ("brace-right", 719, 178),                                                          // 鐘樓台地外側（內側那個靠著鐘樓，留著）
            ("brace-left", 1320, 178), ("brace-right", 1524, 178), ("iron-chain", 1485, 181), ("pillar-moss", 1379, 181),   // 觀星台
            ("brace-right", 157, 308),                                                          // 城牆步道：壓在城門屋頂上
            ("pillar-moss", 2032, 178),                                                         // 樹冠台地：靠著大樹
        };
        // 拉長：(名稱, 原本 x, y, 新的圖, 新 x)
        static readonly (string name, int x, int y, string sprite, int newX)[] Extend =
        {
            ("pillar-tall", 1091, 311, "pillar-tall-126", 1079),   // 鎮長台地中間 → 地面（工坊和木屋中間的空地）
            ("pillar-moss", 1003, 181, "pillar-moss-89", 1003),    // 鎮長家左邊 → 中層台地
            ("scaffold", 1421, 181, "scaffold-259", 1421),         // 觀星台中間 → 地面（兩間蘑菇屋中間）
        };

        static Sprite ImportSprite(string name)
        {
            string path = Folder + name + ".png";
            AssetDatabase.ImportAsset(path);
            var imp = (TextureImporter)AssetImporter.GetAtPath(path);
            imp.textureType = TextureImporterType.Sprite; imp.spriteImportMode = SpriteImportMode.Single;
            imp.spritePixelsPerUnit = 1; imp.isReadable = true; imp.mipmapEnabled = false; imp.filterMode = FilterMode.Point;
            imp.alphaIsTransparency = false; imp.textureCompression = TextureImporterCompression.Uncompressed;
            var st = new TextureImporterSettings(); imp.ReadTextureSettings(st); st.spriteAlignment = (int)SpriteAlignment.TopLeft; st.spriteMeshType = SpriteMeshType.FullRect; imp.SetTextureSettings(st);
            imp.SaveAndReimport();
            var sp = AssetDatabase.LoadAssetAtPath<Sprite>(path);
            if (!sp) throw new System.Exception("讀不到 " + path);
            return sp;
        }

        /// 樹屋（2026-11-20 使用者：「樹屋也有問題也要修正」）：
        ///   梯子換成大樹原圖自己那把梯子的樣子（tree-ladder-tile：從原圖抽出直木和橫木、兩根橫木一個週期），接到地面那段對齊原圖梯子的底；
        ///   樹冠左邊懸空的石頭台地換成木頭平台（右端藏進葉子裡，大樹畫在它前面）。碰撞、梯子的可爬範圍都不動。
        [MenuItem("ZeroStar/場景擺設/碎星鎮：修樹屋")]
        public static void ApplyTree()
        {
            var tile = ImportSprite("tree-ladder-tile"); var ext = ImportSprite("tree-ladder-ext");
            var deck = AssetDatabase.LoadAssetAtPath<Sprite>(Folder + "rope-bridge.png");
            var root = PrefabUtility.LoadPrefabContents(PrefabPath);
            try
            {
                var art = root.GetComponentsInChildren<WorldStamp>(true).Where(t => t.kind == StampKind.PaintedDetail || t.kind == StampKind.TownPathArt).ToList();
                WorldStamp Find(string name, int x, int y)
                {
                    var s = art.FirstOrDefault(t => t.name == name && t.Position(root.transform) == new Vector2Int(x, y));
                    if (!s) throw new System.Exception($"找不到 {name} ({x},{y})");
                    return s;
                }
                void Set(WorldStamp s, Sprite sp, int x, int y, int w, int h)
                {
                    var p = s.Position(root.transform);
                    s.GetComponent<SpriteRenderer>().sprite = sp; s.size = new Vector2Int(w, h); s.sourceTop = 0; s.sourceInsetX = 0;
                    s.transform.position += new Vector3(x - p.x, -(y - p.y), 0);
                    s.original = s.Position(root.transform);
                }
                Set(Find("接到地面的繩梯", 2153, 386), ext, 2159, 387, 18, 53);          // 原圖梯子直木在 2161～2162、2173，最後一根橫木 378
                foreach (var (name, y, h) in new[] { ("樹冠繩梯", 140, 62), ("樹屋之間的繩梯", 202, 85) })
                {
                    var s = art.FirstOrDefault(t => t.name == name && t.Position(root.transform).y == y);
                    if (!s) throw new System.Exception("找不到 " + name);
                    Set(s, tile, 2183, y, 18, h);                                         // 可爬範圍 2180～2204 的正中間
                }
                Set(Find("石台地", 2020, 140), deck, 2020, 115, 50, 33);                    // 木板踏面對齊 y 140
                PrefabUtility.SaveAsPrefabAsset(root, PrefabPath);
                Debug.Log("[TownSupportFix] tree: ladders and canopy landing replaced");
            }
            finally { PrefabUtility.UnloadPrefabContents(root); }
        }

        [MenuItem("ZeroStar/場景擺設/碎星鎮：修浮空的支撐")]
        public static void Apply()
        {
            var sprites = new Dictionary<string, Sprite>();
            foreach (var e in Extend)
            {
                string path = Folder + e.sprite + ".png";
                AssetDatabase.ImportAsset(path);
                var imp = (TextureImporter)AssetImporter.GetAtPath(path);
                imp.textureType = TextureImporterType.Sprite; imp.spriteImportMode = SpriteImportMode.Single;
                imp.spritePixelsPerUnit = 1; imp.isReadable = true; imp.mipmapEnabled = false; imp.filterMode = FilterMode.Point;
                imp.alphaIsTransparency = false; imp.textureCompression = TextureImporterCompression.Uncompressed;
                var st = new TextureImporterSettings(); imp.ReadTextureSettings(st); st.spriteAlignment = (int)SpriteAlignment.TopLeft; st.spriteMeshType = SpriteMeshType.FullRect; imp.SetTextureSettings(st);
                imp.SaveAndReimport();
                sprites[e.sprite] = AssetDatabase.LoadAssetAtPath<Sprite>(path);
                if (!sprites[e.sprite]) throw new System.Exception("讀不到 " + path);
            }
            var root = PrefabUtility.LoadPrefabContents(PrefabPath);
            try
            {
                var stamps = root.GetComponentsInChildren<WorldStamp>(true).ToList();
                WorldStamp Find(string name, int x, int y)
                {
                    var s = stamps.FirstOrDefault(t => t && t.name == name && t.Position(root.transform) == new Vector2Int(x, y));
                    if (!s) throw new System.Exception($"找不到 {name} ({x},{y})");
                    return s;
                }
                foreach (var (name, x, y) in Remove) Object.DestroyImmediate(Find(name, x, y).gameObject);
                foreach (var e in Extend)
                {
                    var s = Find(e.name, e.x, e.y);
                    var sp = sprites[e.sprite];
                    s.GetComponent<SpriteRenderer>().sprite = sp;
                    s.size = new Vector2Int((int)sp.rect.width, (int)sp.rect.height);
                    s.sourceTop = 0; s.sourceInsetX = 0;
                    s.transform.position += new Vector3(e.newX - e.x, 0, 0);
                    s.original = s.Position(root.transform);
                }
                PrefabUtility.SaveAsPrefabAsset(root, PrefabPath);
                Debug.Log($"[TownSupportFix] removed {Remove.Length}, extended {Extend.Length}");
            }
            finally { PrefabUtility.UnloadPrefabContents(root); }
        }
    }
}
