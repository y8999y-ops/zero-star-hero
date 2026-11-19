using System;
using System.IO;
using System.Collections.Generic;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace ZeroStar.Tests
{
    public static class StageLayoutEditor
    {
        const string Path = "Assets/Resources/StageLayouts/1-2.prefab";

        [MenuItem("ZeroStar/編輯 1-2 場景擺設")]
        public static void Open() => PrefabStageUtility.OpenPrefab(Path);

        [DrawGizmo(GizmoType.Selected | GizmoType.Active)]
        static void ShowPlacement(StagePiece piece, GizmoType gizmoType)
        {
            if (piece.layer == SceneryLayer.Sky) return;
            var origin = piece.transform.position;
            if (piece.lightRadius > 0 || piece.sparks)
            {
                var anchor = origin + (Vector3)piece.effectAnchor;
                Handles.color = piece.lightColor;
                Handles.DrawWireDisc(anchor, Vector3.forward, piece.lightRadius);
                Handles.DrawLine(origin, anchor);
            }
            Handles.Label(origin + Vector3.up * 18, piece.name);
        }

        public static void BuildAndVerify()
        {
            if (!File.Exists(Path))
            {
                Directory.CreateDirectory("Assets/Resources/StageLayouts");
                AssetDatabase.Refresh();
                var root = new GameObject("1-2");
                try
                {
                    StagePiece Add(string name,string art,SceneryLayer layer,int x,int y)
                    {
                        string path="Assets/StagePieces/"+art+".png";
                        var importer=(TextureImporter)AssetImporter.GetAtPath(path);
                        importer.textureType=TextureImporterType.Sprite;
                        importer.spriteImportMode=SpriteImportMode.Single; importer.spritePixelsPerUnit=1;
                        importer.isReadable=true; importer.mipmapEnabled=false; importer.filterMode=FilterMode.Point;
                        importer.textureCompression=TextureImporterCompression.Uncompressed; importer.SaveAndReimport();
                        var o=new GameObject(name); o.transform.SetParent(root.transform,false);
                        o.transform.localPosition=new Vector3(x,-y);
                        var p=o.AddComponent<StagePiece>(); p.layer=layer;
                        var sr=o.GetComponent<SpriteRenderer>(); sr.sprite=AssetDatabase.LoadAssetAtPath<Sprite>(path);
                        sr.sortingOrder=(int)layer*10;
                        return p;
                    }
                    var cloud=Add("背景雲","Cloud",SceneryLayer.Sky,90,54);
                    cloud.drift=3; cloud.parallax=0.12f; cloud.repeatWidth=360;
                    var crystal=Add("發光水晶","Crystal",SceneryLayer.Playfield,186,590);
                    var crystalSprite=crystal.GetComponent<SpriteRenderer>().sprite;
                    crystal.transform.localPosition=new Vector3(186,-600+crystalSprite.bounds.extents.y);
                    crystal.effectAnchor=new Vector2(0,3); crystal.lightRadius=70; crystal.sparks=true;
                    crystal.lightColor=new Color(0.3f,0.8f,1f);
                    var stone=Add("遮光岩石","Stone",SceneryLayer.Playfield,202,590);
                    stone.transform.localPosition=new Vector3(202,-600+stone.GetComponent<SpriteRenderer>().sprite.bounds.extents.y);
                    stone.blocksLight=true; stone.blocksSparks=true;
                    var grass=Add("前景草","Grass",SceneryLayer.Foreground,226,598);
                    grass.transform.localPosition=new Vector3(226,-602+grass.GetComponent<SpriteRenderer>().sprite.bounds.extents.y);
                    PrefabUtility.SaveAsPrefabAsset(root,Path);
                }
                finally { UnityEngine.Object.DestroyImmediate(root); }
            }
            Verify();
        }

        [MenuItem("ZeroStar/Tests/Stage layout")]
        public static void Verify()
        {
            var prefab=AssetDatabase.LoadAssetAtPath<GameObject>(Path);
            var copy=UnityEngine.Object.Instantiate(prefab);
            try
            {
                var stone=Array.Find(copy.GetComponentsInChildren<StagePiece>(),p=>p.blocksLight);
                var layoutType=typeof(Game).Assembly.GetType("ZeroStar.StageLayout",true);
                LightSrc GetLight()
                {
                    object layout=Activator.CreateInstance(layoutType,System.Reflection.BindingFlags.NonPublic|System.Reflection.BindingFlags.Instance,null,new object[]{copy},null);
                    var lights=new List<LightSrc>();
                    layoutType.GetMethod("Lights").Invoke(layout,new object[]{lights});
                    return lights[0];
                }
                var before=GetLight();
                bool shadow=false; foreach(bool v in before.Shadow) shadow |= v;
                if(!shadow) throw new Exception("Expected a rock shadow beside the crystal");
                stone.transform.localPosition+=Vector3.right*200;
                foreach(bool v in GetLight().Shadow) if(v) throw new Exception("Shadow remained after moving the rock");
            }
            finally { UnityEngine.Object.DestroyImmediate(copy); }
            Debug.Log("[StageLayout] PASS: moving the rock updates the crystal shadow");
            ParallaxMotionTest.Run();
        }
    }
}
