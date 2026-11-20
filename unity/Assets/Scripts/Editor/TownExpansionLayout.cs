using System;
using System.Linq;
using UnityEditor;
using UnityEngine;

namespace ZeroStar.EditorTools
{
    public static partial class TownExpansionLayout
    {
        const string PrefabPath = "Assets/Resources/StageLayouts/town.prefab";
        const string SpriteFolder = "Assets/StagePieces/World/TownExpansion/";

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

        [MenuItem("ZeroStar/場景擺設/準備碎星鎮四層動線")]
        public static void PrepareTraversal()
        {
            PrepareStreet();
            ImportBackdrop("sewer-back");
            var prefab = PrefabUtility.LoadPrefabContents(PrefabPath);
            try
            {
                var existing = prefab.transform.Find("擴建四層動線");
                if (existing)
                {
                    // 修正最早的擺設版，保留使用者自行移過尺寸與位置的擺設。
                    var west = existing.GetComponentsInChildren<WorldStamp>().FirstOrDefault(s =>
                        s.kind == StampKind.PaintedPlatform && s.size.x == 414
                        && s.Position(prefab.transform) == new Vector2Int(16, 270));
                    bool changed = west != null;
                    if (west)
                    {
                        west.size = new Vector2Int(153, west.size.y);
                        var sr = west.GetComponent<SpriteRenderer>();
                        sr.size = west.size;
                    }
                    foreach (var stamp in existing.GetComponentsInChildren<WorldStamp>())
                        if (stamp.sourceTop == 2 && stamp.sourceInsetX == 0
                            && stamp.TryGetComponent<SpriteRenderer>(out var art) && art.sprite
                            && art.sprite.rect.width == 260)
                        { stamp.sourceInsetX = 2; changed = true; }
                    changed |= TagConstruction(existing, prefab.transform);
                    changed |= PrepareApproaches(existing);
                    if (changed) PrefabUtility.SaveAsPrefabAsset(prefab, PrefabPath);
                    return;
                }
                var stamps = prefab.GetComponentsInChildren<WorldStamp>(true);
                var street = stamps.Single(stamp => stamp.role == "town-street");
                street.size = new Vector2Int(TownArt.TOWN_W, Game.SewerCeiling - TownArt.FLOOR);
                var root = Group(prefab.transform, "擴建四層動線");
                var ground = Group(root, "地面街景");
                var tower = Group(root, "鐘樓與中層吊橋");
                var middle = Group(root, "中層台地");
                var upper = Group(root, "上層台地");
                var tree = Group(root, "大樹繩梯");
                var tunnel = Group(root, "地下走道");

                void Move(string role, int x)
                {
                    var stamp = stamps.Single(s => s.role == role);
                    int dx = x - stamp.Position(prefab.transform).x;
                    stamp.transform.position += prefab.transform.TransformVector(Vector3.right * dx);
                }
                Move("guild", 180); Move("workshop", 900); Move("inn", 1270); Move("sign", 66);
                var sign = stamps.Single(s => s.role == "sign").GetComponent<SpriteRenderer>().sprite;
                void Building(Transform parent, string name, int x, int footY)
                {
                    var sprite = ImportSprite(name);
                    Art(parent, name, sprite, x, footY - (int)sprite.rect.height);
                }
                void Terrace(Transform parent, int x, int y, int w)
                {
                    Paint(parent, "石台地", ImportSprite("terrace"), x, y, w, 44, StampKind.PaintedPlatform, 2);
                }
                void Bridge(Transform parent, int x, int y, int w)
                {
                    Paint(parent, "吊橋", ImportSprite("rope-bridge"), x, y - 25, w, 33, StampKind.PaintedDetail);
                    Marker(parent, "吊橋踏面", "", StampKind.Platform, x, y, w, 1);
                }
                void Ladder(Transform parent, string label, int x, int y, int bottom, bool draw = true)
                {
                    Marker(parent, label, "", StampKind.Climb, x, y, 24, bottom - y);
                    if (draw) Paint(parent, label, ImportSprite("rope-ladder"), x - 1, y, 26, bottom - y, StampKind.PaintedDetail);
                }
                void Waypoint(Transform parent, string label, string key, int x, int y, bool draw = true)
                {
                    Marker(parent, label, key, StampKind.TownMarker, x, y, 12, 1);
                    if (draw) Art(parent, label, sign, x - (int)sign.rect.width / 2, y - (int)sign.rect.height);
                }

                Building(ground, "gate", 20, TownArt.FLOOR);
                Building(ground, "house-a", 470, TownArt.FLOOR);
                Building(ground, "bell-tower", 580, TownArt.FLOOR);
                Building(ground, "plaza", 700, TownArt.FLOOR);
                Building(ground, "house-b", 1110, TownArt.FLOOR);
                Building(ground, "house-c", 1450, TownArt.FLOOR);
                Building(ground, "training", 1705, TownArt.FLOOR);
                Building(ground, "market", 1840, TownArt.FLOOR);
                Building(ground, "cart", 1948, TownArt.FLOOR);
                Building(ground, "big-tree", 2060, TownArt.FLOOR);
                Building(ground, "manhole", 854, TownArt.FLOOR);
                Waypoint(ground, "城門路標", "surface", 90, TownArt.FLOOR, false);
                Waypoint(ground, "廣場人孔", "manhole", 882, TownArt.FLOOR, false);

                // 第一段樓梯的五階。踏面獨立於圖，可以在場景擺設中對準。
                Building(ground, "wood-step", 526, TownArt.FLOOR);
                for (int i = 0; i < 5; i++)
                    Marker(ground, "鐘樓西側階梯", "", StampKind.TownStep, 527 + i * 8,
                        TownArt.FLOOR - (i + 1) * 8, 10, 1);
                Marker(ground, "石屋平屋頂", "", StampKind.Platform, 478, 345, 59, 1);
                Marker(ground, "木屋平屋頂", "", StampKind.Platform, 1117, 337, 95, 1);
                Marker(ground, "蘑菇屋平屋頂", "", StampKind.Platform, 1458, 342, 103, 1);

                Ladder(tower, "鐘樓外側繩梯", 653, 270, TownArt.FLOOR);
                Bridge(tower, 639, 270, 325);
                // 陽台落腳點和頂端的鐘樓出口。
                Marker(tower, "低處陽台", "", StampKind.Platform, 631, 341, 38, 1);
                Marker(tower, "左側陽台", "", StampKind.Platform, 580, 315, 36, 1);
                Terrace(upper, 657, 140, 118);
                Ladder(tower, "鐘樓上段梯子", 664, 140, 270);
                Bridge(upper, 769, 140, 177);

                Terrace(middle, 16, 270, 153);
                Ladder(middle, "城牆步道梯子", 124, 270, TownArt.FLOOR);
                Terrace(middle, 958, 270, 300);
                Building(middle, "mayor", 1015, 270);
                Waypoint(middle, "鎮長家路標", "middle", 1235, 270);
                Ladder(middle, "中層通往上層的梯子", 952, 140, 270);
                Terrace(upper, 929, 140, 260);
                Bridge(upper, 1183, 140, 128);
                Terrace(upper, 1297, 140, 283);
                Building(upper, "star-wreck", 1300, 140);
                Waypoint(upper, "觀星台路標", "upper", 1541, 140);
                Bridge(upper, 1574, 140, 453);
                Terrace(upper, 2020, 140, 192);

                // 樹屋的可站處取實際木板與枝幹高度。只補原圖繩梯沒到地面的部分。
                Ladder(tree, "下層樹屋繩梯", 2154, 287, TownArt.FLOOR, false);
                Paint(tree, "接到地面的繩梯", ImportSprite("rope-ladder"), 2153, 386, 26, 54, StampKind.PaintedDetail);
                Marker(tree, "下層樹屋木板", "", StampKind.Platform, 2110, 287, 95, 1);
                Marker(tree, "上層樹屋木板", "", StampKind.Platform, 2202, 202, 68, 1);
                Ladder(tree, "樹屋之間的繩梯", 2180, 202, 287);
                Marker(tree, "上層樹屋連接踏面", "", StampKind.Platform, 2180, 202, 26, 1);
                Ladder(tree, "樹冠繩梯", 2180, 140, 202);

                AddSolid(tunnel, "下水道西壁", "sewer-wall-west", 400, Game.SewerCeiling, 8, TownArt.H - Game.SewerCeiling);
                AddSolid(tunnel, "下水道東壁", "sewer-wall-east", 1696, Game.SewerCeiling, 8, TownArt.H - Game.SewerCeiling);
                // 只取參考圖的石磚帶。下方的水由 PixelFX 繪製。
                Paint(tunnel, "下水道石磚", ImportSprite("sewer-floor"), 400, Game.SewerFloor, 1304, 20, StampKind.PaintedGround, 2);
                Waypoint(tunnel, "下水道路標", "sewer", 882, Game.SewerFloor);
                TagConstruction(root, prefab.transform);
                PrepareApproaches(root);
                PrefabUtility.SaveAsPrefabAsset(prefab, PrefabPath);
            }
            finally { PrefabUtility.UnloadPrefabContents(prefab); }
            Debug.Log("[TownExpansion] 四層攀爬、踏面與路標擺設已寫入 town.prefab。");
        }

        static bool TagConstruction(Transform expansion, Transform root)
        {
            bool changed = false;
            foreach (Transform group in expansion)
            foreach (var stamp in group.GetComponentsInChildren<WorldStamp>())
            {
                if (!string.IsNullOrEmpty(stamp.townProject)) continue;
                int x = stamp.Position(root).x;
                string key = group.name switch
                {
                    "地面街景" => stamp.name switch
                    {
                        "plaza" or "market" or "cart" or "manhole" or "廣場人孔" => "plaza",
                        "bell-tower" or "wood-step" or "鐘樓西側階梯" => "tower",
                        "training" or "big-tree" => "tree",
                        "house-a" or "石屋平屋頂" => "house-a",
                        "house-b" or "木屋平屋頂" => "house-b",
                        "house-c" or "蘑菇屋平屋頂" => "house-c",
                        _ => null
                    },
                    "鐘樓與中層吊橋" => "tower",
                    "中層台地" => x < 200 ? "wall" : "terrace",
                    "上層台地" => x < 1100 ? "tower" : x >= 2020 ? "tree" : "star",
                    "大樹繩梯" => "tree",
                    "地下走道" => "sewer",
                    _ => null
                };
                if (key == null) continue;
                stamp.townProject = key;
                stamp.townPreview = group.name == "中層台地" || group.name == "上層台地"
                    ? stamp.kind == StampKind.PaintedPlatform || stamp.kind == StampKind.Decor
                    : stamp.name == "bell-tower" || stamp.name == "big-tree";
                changed = true;
            }
            return changed;
        }

        static bool PrepareApproaches(Transform expansion)
        {
            bool changed = false;
            foreach (var stamp in expansion.GetComponentsInChildren<WorldStamp>())
            {
                bool suspended = stamp.kind == StampKind.PaintedPlatform
                    || (stamp.kind == StampKind.PaintedDetail && stamp.name == "吊橋")
                    || (stamp.kind == StampKind.Decor && stamp.role is "mayor" or "鎮長家路標" or "觀星台路標")
                    || ((stamp.name is "鐘樓上段梯子" or "中層通往上層的梯子" or "樹冠落腳木板"
                        or "樹屋之間的繩梯" or "樹冠繩梯" or "城牆梯子上段")
                        && stamp.kind is StampKind.PaintedDetail or StampKind.TownPathArt);
                if (suspended && !stamp.aboveStreet)
                {
                    stamp.aboveStreet = true;
                    changed = true;
                }
            }
            changed |= SplitWallLadder(expansion.Find("中層台地"));
            if (expansion.Find("橋端工地與出入口")) return changed;
            var ground = expansion.Find("地面街景");
            var middle = expansion.Find("中層台地");
            var tree = expansion.Find("大樹繩梯");
            foreach (var stamp in expansion.GetComponentsInChildren<WorldStamp>())
            {
                if (stamp.transform.parent == middle && stamp.kind == StampKind.PaintedPlatform && stamp.townProject == "wall")
                {
                    stamp.size = new Vector2Int(197, stamp.size.y);
                    stamp.GetComponent<SpriteRenderer>().size = stamp.size;
                }
                if (stamp.transform.parent == tree && stamp.kind == StampKind.PaintedDetail)
                    stamp.kind = StampKind.TownPathArt;
            }
            var mushroom = Marker(ground, "蘑菇住宅右側梯子", "", StampKind.Climb, 1541, 342, 24, TownArt.FLOOR - 342);
            mushroom.townProject = "house-c";

            var deck = AssetDatabase.LoadAssetAtPath<Sprite>(SpriteFolder + "rope-bridge.png");
            Paint(tree, "樹冠落腳木板", deck, 2060, 115, 156, 33, StampKind.TownPathArt);
            var canopy = tree.Find("樹冠落腳木板").GetComponent<WorldStamp>();
            canopy.townProject = "tree";
            canopy.aboveStreet = true;

            var gates = Group(expansion, "橋端工地與出入口");
            void Gate(string name, string from, string pending, int x, int floor)
            {
                var stamp = Marker(gates, name, pending, StampKind.TownBarrier, x, floor - 24, 8, 24);
                stamp.townProject = from;
            }
            Gate("吊橋至石台地", "tower", "terrace", 960, 270);
            Gate("上層西側至觀星台", "tower", "star", 1184, 140);
            Gate("觀星台至上層西側", "star", "tower", 1184, 140);
            Gate("觀星台至樹冠", "star", "tree", 2024, 140);
            Gate("樹冠至觀星台", "tree", "star", 2016, 140);
            return true;
        }

        static bool SplitWallLadder(Transform middle)
        {
            if (middle.Find("城牆梯子上段")) return false;
            // 地面看得到接在城門牆邊的梯腳。屋簷以上的梯段跟步道同時顯現。
            var marker = middle.GetComponentsInChildren<WorldStamp>().Single(s => s.name == "城牆步道梯子" && s.kind == StampKind.Climb);
            var art = middle.GetComponentsInChildren<WorldStamp>().Single(s => s.name == "城牆步道梯子" && s.kind == StampKind.PaintedDetail);
            var sprite = art.GetComponent<SpriteRenderer>().sprite;
            const int x = 166, top = 270, split = 324;
            marker.transform.localPosition = new Vector3(x, -top);
            art.transform.localPosition = new Vector3(x - 1, -split);
            art.size = new Vector2Int(26, TownArt.FLOOR - split);
            art.GetComponent<SpriteRenderer>().size = art.size;
            art.kind = StampKind.TownPathArt;
            Paint(middle, "城牆梯子上段", sprite, x - 1, top, 26, split - top, StampKind.TownPathArt);
            var extension = middle.Find("城牆梯子上段").GetComponent<WorldStamp>();
            extension.townProject = "wall";
            extension.aboveStreet = true;
            return true;
        }

        static Transform Group(Transform parent, string name)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            return go.transform;
        }

        static WorldStamp Marker(Transform parent, string name, string role, StampKind kind, int x, int y, int w, int h)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.transform.localPosition = new Vector3(x, -y, 0);
            var stamp = go.AddComponent<WorldStamp>();
            stamp.kind = kind;
            stamp.role = role;
            stamp.index = -1;
            stamp.original = new Vector2Int(x, y);
            stamp.size = new Vector2Int(w, h);
            return stamp;
        }

        static void Art(Transform parent, string name, Sprite sprite, int x, int y)
        {
            var stamp = Marker(parent, name, name, StampKind.Decor, x, y, (int)sprite.rect.width, (int)sprite.rect.height);
            stamp.useBakedEmission = false;
            stamp.gameObject.AddComponent<SpriteRenderer>().sprite = sprite;
        }

        static void Paint(Transform parent, string name, Sprite sprite, int x, int y, int w, int h, StampKind kind, int sourceTop = 0)
        {
            var stamp = Marker(parent, name, "", kind, x, y, w, h);
            stamp.sourceTop = sourceTop;
            if (sourceTop == 2 && sprite.rect.width == 260) stamp.sourceInsetX = 2;
            // Authoring preview shows the span; the game repeats and crops the texture in integer pixels.
            var sr = stamp.gameObject.AddComponent<SpriteRenderer>();
            sr.sprite = sprite;
            sr.drawMode = SpriteDrawMode.Tiled;
            sr.size = new Vector2(w, h);
        }

        static Sprite ImportSprite(string name)
        {
            string path = SpriteFolder + name + ".png";
            if (!(AssetImporter.GetAtPath(path) is TextureImporter t)) throw new InvalidOperationException("找不到城鎮美術：" + path);
            if (t.textureType != TextureImporterType.Sprite || !t.isReadable || t.filterMode != FilterMode.Point)
            {
                t.textureType = TextureImporterType.Sprite;
                t.spriteImportMode = SpriteImportMode.Single;
                t.spritePixelsPerUnit = 1;
                t.isReadable = true;
                t.mipmapEnabled = false;
                t.filterMode = FilterMode.Point;
                t.textureCompression = TextureImporterCompression.Uncompressed;
                t.npotScale = TextureImporterNPOTScale.None;
                var settings = new TextureImporterSettings();
                t.ReadTextureSettings(settings);
                settings.spriteAlignment = (int)SpriteAlignment.TopLeft;
                settings.spriteMeshType = SpriteMeshType.FullRect;
                t.SetTextureSettings(settings);
                t.SaveAndReimport();
            }
            return AssetDatabase.LoadAssetAtPath<Sprite>(path);
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
