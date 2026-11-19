using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using PixelFX;
using UnityEngine;
using UnityEditor;
using UnityEditor.SceneManagement;

namespace ZeroStar.Tests
{
    public static class WorldLayoutEditor
    {
        [InitializeOnLoadMethod]
        static void SelectPlacementRoot()
        {
            Selection.selectionChanged += () =>
            {
                var selected=Selection.activeGameObject;
                if(!selected || selected.name!="預覽" || !selected.transform.parent)return;
                if(selected.transform.parent.TryGetComponent<WorldStamp>(out var stamp))
                    Selection.activeGameObject=stamp.gameObject;
            };
        }
        public static readonly string[] Stages = {"1-1","1-2","1-3","1-4","endless","town"};
        public static string AssetPath(string id) => "Assets/Resources/StageLayouts/"+id+".prefab";
        [MenuItem("ZeroStar/場景擺設/1-1 墜落之底")] static void A()=>Open("1-1");
        [MenuItem("ZeroStar/場景擺設/1-2 垃圾山")] static void B()=>Open("1-2");
        [MenuItem("ZeroStar/場景擺設/1-3 洞窟")] static void C()=>Open("1-3");
        [MenuItem("ZeroStar/場景擺設/1-4 王房")] static void D()=>Open("1-4");
        [MenuItem("ZeroStar/場景擺設/無限討伐")] static void E()=>Open("endless");
        [MenuItem("ZeroStar/場景擺設/碎星鎮")] static void F()=>Open("town");
        static void Open(string id)=>PrefabStageUtility.OpenPrefab(AssetPath(id));

        [DrawGizmo(GizmoType.NonSelected|GizmoType.Selected)]
        static void Anchor(WorldStamp stamp,GizmoType type)
        {
            var sr=stamp.GetComponent<SpriteRenderer>();
            if(sr && sr.sprite) return;
            Gizmos.color=Color.cyan; Gizmos.DrawWireSphere(stamp.transform.position,3);
            if((type&GizmoType.Selected)!=0) Handles.Label(stamp.transform.position,stamp.name);
        }

        [MenuItem("ZeroStar/Tests/World layouts")]
        public static void Verify()
        {
            foreach(string id in Stages)
            {
                var prefab=AssetDatabase.LoadAssetAtPath<GameObject>(AssetPath(id));
                if(!prefab || prefab.GetComponentsInChildren<WorldStamp>().Length==0) throw new Exception("Missing layout "+id);
                var g=new Game(id);
                if(id=="town")
                {
                    var copy=UnityEngine.Object.Instantiate(prefab);
                    try
                    {
                        var guild=copy.GetComponentsInChildren<WorldStamp>().First(s=>s.role=="guild");
                        var resident=TownArt.NPCS[0].x;guild.transform.position+=Vector3.right*13;
                        TownArt.Reset(new WorldComposition(copy));
                        if(TownArt.NPCS[0].x!=resident+13) throw new Exception("公會櫃檯與店面位置不同步");
                    }
                    finally{UnityEngine.Object.DestroyImmediate(copy);TownArt.Reset(WorldComposition.Load(id));}
                }
                if(id!="town")
                {
                    var copy=UnityEngine.Object.Instantiate(prefab);
                    try
                    {
                        var platform=copy.GetComponentsInChildren<WorldStamp>().FirstOrDefault(s=>s.kind==StampKind.Platform);
                        if(platform!=null)
                        {
                            var baseline=Baked.Level(id);
                            var composed=Baked.Level(id);
                            var old=baseline.Platforms[platform.index];
                            var delta=platform.Position(copy.transform)-platform.original;
                            platform.transform.position+=new Vector3(7,-3,0);
                            new WorldComposition(copy).Apply(composed);
                            if(!composed.Platforms.Any(p=>p.X==old.X+delta.x+7 && p.Y==old.Y+delta.y+3))throw new Exception("Moved platform lost its collision in "+id);
                        }
                    }
                    finally { UnityEngine.Object.DestroyImmediate(copy); }
                }
                Debug.Log($"[WorldLayouts] {id} {prefab.GetComponentsInChildren<WorldStamp>().Length} scenery and interaction objects");
            }
            StageLayoutEditor.Verify();
            Debug.Log("[WorldLayouts] PASS: six layouts, collision attachment, lighting, stage and camera regressions");
        }
    }
}
