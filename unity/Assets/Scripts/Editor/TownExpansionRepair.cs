using System.Linq;
using UnityEditor;
using UnityEngine;

namespace ZeroStar.EditorTools
{
    public static partial class TownExpansionLayout
    {
        [MenuItem("ZeroStar/場景擺設/套用通過的碎星鎮修復")]
        public static void ApplyApprovedRepairs()
        {
            ImportBackdrop("crater-wall");
            var capLeft = ImportSprite("terrace-left"); var capRight = ImportSprite("terrace-right");
            var longBridge = ImportBridge("bridge-long", 36, 38);
            var shortBridge = ImportBridge("bridge-short", 26, 28);
            var tall = ImportSprite("pillar-tall"); var low = ImportSprite("pillar-moss");
            var braceLeft = ImportSprite("brace-left"); var braceRight = ImportSprite("brace-right");
            var chain = ImportSprite("iron-chain"); var scaffold = ImportSprite("scaffold");
            var closedLid = ImportSprite("manhole-closed"); var openLid = ImportSprite("manhole-open");
            var prefab = PrefabUtility.LoadPrefabContents(PrefabPath);
            try
            {
                var expansion = prefab.transform.Find("擴建四層動線");
                var existing = expansion.Find("通過稿結構與河道");
                if (existing)
                {
                    if (PositionSupports(existing, prefab.transform, low))
                        PrefabUtility.SaveAsPrefabAsset(prefab, PrefabPath);
                    return;
                }
                var ground = expansion.Find("地面街景");
                var middle = expansion.Find("中層台地");
                var repairs = Group(expansion, "通過稿結構與河道");

                void Detail(Transform parent, string name, Sprite sprite, int x, int y, string project, bool elevated)
                {
                    Art(parent, name, sprite, x, y);
                    var stamp = parent.GetChild(parent.childCount - 1).GetComponent<WorldStamp>();
                    stamp.townProject = project;
                    stamp.aboveStreet = elevated;
                }
                void Bridge(Transform parent, string name, int x, int y, int span, string project, bool wide)
                {
                    var tile = wide ? longBridge : shortBridge;
                    int left = wide ? 36 : 26, right = wide ? 38 : 28, datum = wide ? 42 : 30;
                    var stamp = Marker(parent, name, "", StampKind.TownBridge, x, y, span, (int)tile.rect.height);
                    stamp.townProject = project;
                    stamp.aboveStreet = true;
                    var face = Group(stamp.transform, "美術");
                    face.localPosition = new Vector3(-left, datum, 0);
                    var sprite = face.gameObject.AddComponent<SpriteRenderer>();
                    sprite.sprite = tile;
                    sprite.drawMode = SpriteDrawMode.Sliced;
                    sprite.size = new Vector2(span + left + right, tile.rect.height);
                    // Unity 的 Sliced preview 以中央為錨點，遊戲採用左上角。
                    face.localPosition += new Vector3((sprite.size.x - tile.rect.width) * 0.5f, 0, 0);
                }
                var stamps = expansion.GetComponentsInChildren<WorldStamp>();
                foreach (var surface in stamps.Where(s => s.name == "吊橋踏面"))
                {
                    var p = surface.Position(prefab.transform);
                    int end = p.x + surface.size.x;
                    int start = p.x;
                    if (p.y == 270)
                    {
                        // 原位置的梯頂保持水平，弧面從鐘樓陽台右邊才開始下降。
                        var landing = Marker(surface.transform.parent, "鐘樓陽台出入口", "", StampKind.Platform, start, p.y, 43, 1);
                        landing.townProject = surface.townProject;
                        start += 33;
                    }
                    Bridge(surface.transform.parent, "完整吊橋", start, p.y, end - start, surface.townProject, end - start > 240);
                    Object.DestroyImmediate(surface.gameObject);
                }
                foreach (var old in expansion.GetComponentsInChildren<WorldStamp>().Where(s => s.name == "吊橋" || s.name == "樹冠落腳木板"))
                    Object.DestroyImmediate(old.gameObject);

                // 接通西側步道與鐘樓。樹冠保留水平梯口，中間用短橋跨過葉叢。
                Bridge(middle, "城牆至鐘樓吊橋", 210, 270, 434, "wall", true);
                var canopy = expansion.Find("大樹繩梯");
                Bridge(canopy, "樹冠短橋", 2064, 140, 121, "tree", false);
                var treeExit = Marker(canopy, "樹冠梯口踏面", "", StampKind.Platform, 2178, 140, 34, 1);
                treeExit.townProject = "tree";
                Detail(canopy, "樹冠踏面木托", braceLeft, 2175, 146, "tree", true);
                var exitDeck = ImportSprite("rope-bridge");
                Paint(canopy, "樹冠梯口木板", exitDeck, 2178, 115, 34, 33, StampKind.TownPathArt);
                var exitArt = canopy.GetChild(canopy.childCount - 1).GetComponent<WorldStamp>();
                exitArt.townProject = "tree"; exitArt.aboveStreet = true;

                foreach (var terrace in expansion.GetComponentsInChildren<WorldStamp>().Where(s => s.kind == StampKind.PaintedPlatform))
                {
                    var p = terrace.Position(prefab.transform);
                    int span = p.x == 2020 ? 50 : terrace.size.x;
                    string project = terrace.townProject;
                    var deck = Marker(terrace.transform.parent, "石台地踏面", "", StampKind.Platform, p.x, p.y, span, 1);
                    deck.townProject = project;
                    // 短台地仍留一段連續的磚面；從原圖的收邊取不透明外形。
                    int capWidth = span < 80 ? 0 : 35;
                    terrace.transform.localPosition += Vector3.right * capWidth;
                    terrace.size = new Vector2Int(span - capWidth * 2, terrace.size.y);
                    terrace.kind = StampKind.PaintedDetail;
                    terrace.GetComponent<SpriteRenderer>().size = terrace.size;
                    if (capWidth > 0)
                    {
                        Detail(repairs, "台地左端", capLeft, p.x, p.y - 2, project, true);
                        Detail(repairs, "台地右端", capRight, p.x + span - capWidth, p.y - 2, project, true);
                    }
                    void Support(Sprite sprite, int x, int dy) =>
                        Detail(repairs, sprite.name, sprite, x, p.y + dy, project, true);
                    Support(capWidth > 0 ? braceLeft : low, p.x + (capWidth > 0 ? 23 : 12), 38);
                    if (span > 100) Support(braceRight, p.x + span - 56, 38);
                    if (span > 150) Support(p.y == 270 ? tall : scaffold, p.x + span / 2 - 17, 41);
                    if (span >= 250) Support(chain, p.x + span * 2 / 3, 41);
                    if (span >= 250) Support(low, p.x + span / 3 - 12, 41);
                }

                var shutter = ground.Find("manhole");
                if (shutter) Object.DestroyImmediate(shutter.gameObject);
                Detail(ground, "嵌入式人孔・關閉", closedLid, 862, TownArt.FLOOR - 7, "plaza", false);
                ground.GetChild(ground.childCount - 1).GetComponent<WorldStamp>().townHiddenAfter = "sewer";
                Detail(ground, "嵌入式人孔・打開", openLid, 862, TownArt.FLOOR - 26, "sewer", false);
                // 東街的新存檔也有間隔清楚的路燈和指路牌，沿用城鎮素材。
                var lamp = prefab.GetComponentsInChildren<WorldStamp>().First(s => s.role == "lamp").GetComponent<SpriteRenderer>().sprite;
                var sign = prefab.GetComponentsInChildren<WorldStamp>().Single(s => s.role == "sign").GetComponent<SpriteRenderer>().sprite;
                foreach (int x in new[] { 1602, 1855, 2270 })
                    Detail(ground, "東街路燈", lamp, x, TownArt.FLOOR - (int)lamp.rect.height, null, false);
                Detail(ground, "東街指路牌", sign, 2006, TownArt.FLOOR - (int)sign.rect.height, null, false);
                PositionSupports(repairs, prefab.transform, low);
                PrefabUtility.SaveAsPrefabAsset(prefab, PrefabPath);
            }
            finally { PrefabUtility.UnloadPrefabContents(prefab); }
            Debug.Log("[TownRepair] 已更新坑壁、橋面、台地承托、東街與人孔");
        }

        static bool PositionSupports(Transform repairs, Transform root, Sprite footing)
        {
            if (repairs.Find("台地支撐基礎")) return false;
            var supports = repairs.GetComponentsInChildren<WorldStamp>().Where(s =>
                s.role is "pillar-tall" or "pillar-moss" or "scaffold" or "iron-chain" or "brace-left" or "brace-right").ToArray();
            var feet = Group(repairs, "台地支撐基礎");
            foreach (var pier in supports)
            {
                // 承托接到下方，房屋與梯口在它前方。
                pier.kind = StampKind.PaintedDetail;
                var p = pier.Position(root);
                if (pier.role != "pillar-tall" || p.y < 300) continue;
                int width = (int)footing.rect.width, height = (int)footing.rect.height;
                int x = p.x + (pier.size.x - width) / 2;
                Paint(feet, "接地石基", footing, x, TownArt.FLOOR - height, width, height, StampKind.PaintedDetail);
                var baseStone = feet.GetChild(feet.childCount - 1).GetComponent<WorldStamp>();
                baseStone.townProject = pier.townProject;
                baseStone.aboveStreet = true;
            }
            return true;
        }

        static Sprite ImportBridge(string name, int left, int right)
        {
            ImportSprite(name);
            string path = SpriteFolder + name + ".png";
            var importer = (TextureImporter)AssetImporter.GetAtPath(path);
            var border = new Vector4(left, 0, right, 0);
            if (importer.spriteBorder != border)
            {
                importer.spriteBorder = border;
                importer.SaveAndReimport();
            }
            return AssetDatabase.LoadAssetAtPath<Sprite>(path);
        }
    }
}
