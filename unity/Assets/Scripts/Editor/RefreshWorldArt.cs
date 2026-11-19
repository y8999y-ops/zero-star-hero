// 換了美術（art/3-已通過 → 重新匯出 Baked）之後，把 StageLayouts 各場景 Prefab 裡「照舊圖切出來的圖片」換成新的。
// 只換有圖的擺放物（遠近景圖層、街道／地形、碰撞地形、裝飾、平台、互動水晶）；出生點、火盆、草叢、居民、雲這些錨點和其他手動加的東西都不動。
// 換之前會檢查：要換的擺放物都沒被手動移動過（移動過就停下來，不覆蓋）。
// 先跑（專案根目錄）：
//   node --no-use-std-math-pow unity/build/outputs/layout-authoring/capture.mjs <場景>   （town 1-1 1-2 1-3 1-4 endless 各一次）
//   PYTHONUTF8=1 python unity/build/outputs/layout-authoring/export.py
// 再跑：Unity -batchmode -executeMethod ZeroStar.Tests.RefreshWorldArt.Run，或選單 ZeroStar/場景擺設/換成新美術
using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using UnityEditor;
using UnityEngine;

namespace ZeroStar.Tests
{
    public static class RefreshWorldArt
    {
        [Serializable] class Entry { public string name, kind, path; public int x, y, index; public int[] lights; }
        [Serializable] class Manifest { public Entry[] items; }
        static readonly HashSet<StampKind> ART = new HashSet<StampKind> {
            StampKind.Back, StampKind.Far, StampKind.Mid, StampKind.Near, StampKind.Fg, StampKind.UpFar, StampKind.UpMid,
            StampKind.Terrain, StampKind.Solid, StampKind.Decor, StampKind.Platform, StampKind.Crystal };

        [MenuItem("ZeroStar/場景擺設/換成新美術")]
        public static void Run()
        {
            var imported = new HashSet<string>();
            foreach (var stage in WorldLayoutEditor.Stages)
            {
                var mf = "build/outputs/layout-authoring/" + stage + ".json";
                if (!File.Exists(mf)) { Debug.LogWarning("[RefreshWorldArt] 沒有 " + mf + "，跳過 " + stage); continue; }
                var manifest = JsonUtility.FromJson<Manifest>(File.ReadAllText(mf));
                string path = WorldLayoutEditor.AssetPath(stage);
                var root = PrefabUtility.LoadPrefabContents(path);
                try
                {
                    var old = root.GetComponentsInChildren<WorldStamp>(true).Where(s => ART.Contains(s.kind)).ToList();
                    var moved = old.Where(s => s.Position(root.transform) != s.original).ToList();
                    if (moved.Count > 0) throw new Exception(stage + "：有 " + moved.Count + " 個擺放物被手動移動過（" + moved[0].name + "），不覆蓋");
                    var groups = new Dictionary<string, Transform>();
                    foreach (Transform t in root.transform) groups[t.name] = t;
                    Transform Group(string n)
                    {
                        if (groups.TryGetValue(n, out var g)) return g;
                        var t = new GameObject(n).transform; t.SetParent(root.transform, false); return groups[n] = t;
                    }
                    // 同種類、同名稱、同編號的照順序配對：配到的原地更新（子物件——例如掛在店面底下的居民——世界位置不變），配不到的才新增／拿掉
                    var pool = new Dictionary<(StampKind, string, int), Queue<WorldStamp>>();
                    foreach (var s in old) { var k = (s.kind, s.role, s.index); if (!pool.TryGetValue(k, out var q)) pool[k] = q = new Queue<WorldStamp>(); q.Enqueue(s); }
                    int order = 0, added = 0, reused = 0;
                    foreach (var e in manifest.items)
                    {
                        var kind = (StampKind)Enum.Parse(typeof(StampKind), e.kind);
                        if (!ART.Contains(kind)) { if (!string.IsNullOrEmpty(e.path)) order++; continue; }
                        WorldStamp s;
                        if (pool.TryGetValue((kind, e.name, e.index), out var q) && q.Count > 0)
                        {
                            s = q.Dequeue(); reused++;
                            var kids = s.transform.Cast<Transform>().Select(c => (c, c.position)).ToList();
                            var shift = new Vector2Int(e.x, e.y) - s.original;
                            s.transform.localPosition += new Vector3(shift.x, -shift.y);
                            foreach (var (c, p) in kids) c.position = p;
                        }
                        else
                        {
                            string group = kind >= StampKind.Back && kind <= StampKind.UpMid ? "遠近景圖層" : kind == StampKind.Solid || kind == StampKind.Platform || kind == StampKind.Terrain ? "地面與平台" : kind == StampKind.Crystal ? "火盆與水晶" : "街景與道具";
                            var o = new GameObject(e.name); o.transform.SetParent(Group(group), false); o.transform.localPosition = new Vector3(e.x, -e.y);
                            s = o.AddComponent<WorldStamp>(); s.kind = kind; s.index = e.index; s.role = e.name; added++;
                            if (kind == StampKind.Decor && (e.name == "rocks" || e.name == "bigRocks" || e.name == "junk")) s.blocksLight = s.blocksSparks = true;
                        }
                        s.original = new Vector2Int(e.x, e.y); s.lights = e.lights;
                        var o2 = s.gameObject;
                        if (string.IsNullOrEmpty(e.path)) { var none = o2.GetComponent<SpriteRenderer>(); if (none) UnityEngine.Object.DestroyImmediate(none); continue; }
                        if (imported.Add(e.path))
                        {
                            AssetDatabase.ImportAsset(e.path);
                            var imp = (TextureImporter)AssetImporter.GetAtPath(e.path);
                            imp.textureType = TextureImporterType.Sprite; imp.spriteImportMode = SpriteImportMode.Single;
                            imp.spritePixelsPerUnit = 1; imp.isReadable = true; imp.mipmapEnabled = false; imp.filterMode = FilterMode.Point;
                            imp.alphaIsTransparency = false; imp.textureCompression = TextureImporterCompression.Uncompressed; imp.maxTextureSize = 8192;
                            var st = new TextureImporterSettings(); imp.ReadTextureSettings(st); st.spriteAlignment = (int)SpriteAlignment.TopLeft; st.spriteMeshType = SpriteMeshType.FullRect; imp.SetTextureSettings(st); imp.SaveAndReimport();
                        }
                        var sr = o2.GetComponent<SpriteRenderer>(); if (!sr) sr = o2.AddComponent<SpriteRenderer>(); sr.sprite = AssetDatabase.LoadAssetAtPath<Sprite>(e.path);
                        if (sr.sprite == null) throw new Exception(stage + "：讀不到圖 " + e.path);
                        sr.sortingOrder = kind == StampKind.Fg ? 30000 : order + (kind == StampKind.Decor ? 500 : 0);
                        order++;
                    }
                    int removed = 0;
                    foreach (var q in pool.Values) while (q.Count > 0)
                    {
                        var s = q.Dequeue(); removed++;
                        foreach (var c in s.transform.Cast<Transform>().ToList()) c.SetParent(s.transform.parent, true);
                        UnityEngine.Object.DestroyImmediate(s.gameObject);
                    }
                    PrefabUtility.SaveAsPrefabAsset(root, path);
                    Debug.Log("[RefreshWorldArt] " + stage + "：更新 " + reused + " 個、新增 " + added + " 個、拿掉 " + removed + " 個");
                }
                finally { PrefabUtility.UnloadPrefabContents(root); }
            }
            WorldLayoutEditor.Verify();
        }
    }
}
