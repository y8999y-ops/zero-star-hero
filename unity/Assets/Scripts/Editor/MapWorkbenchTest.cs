using System;
using UnityEditor;
using UnityEngine;
using UnityEditor.SceneManagement;
using System.Linq;
using System.Reflection;

namespace ZeroStar.Tests
{
    public static class MapWorkbenchTest
    {
        static void VerifyCustom(int template)
        {
            string path=MapWorkbench.CreateMap("測試關卡",template);
            try
            {
                var root=PrefabUtility.LoadPrefabContents(path);
                try
                {
                    var a=MapWorkbench.AddReward(root,new Vector3(152,-568));
                    var b=MapWorkbench.AddReward(root,new Vector3(200,-568));
                    if(a.GetComponent<WorldStamp>().rewardId==b.GetComponent<WorldStamp>().rewardId)throw new Exception("寶箱識別重複");
                    MapWorkbench.AddTile(root,new Vector3(48,-512),32,16,false);
                    MapWorkbench.AddTile(root,new Vector3(96,-504),32,8,true);
                    string id=System.IO.Path.GetFileNameWithoutExtension(path);
                    var g=new Game(id,null,root);
                    if(!g.Map.SolidAt(50,516) || !g.Map.OnPlatform(100,504) || g.StageD.Id!=id)throw new Exception("自訂地圖地形或關卡識別錯誤");
                    string key="reward-"+a.GetComponent<WorldStamp>().rewardId;
                    var item=g.Features.Items.Find(f=>f.id==key);
                    if(item==null)throw new Exception("新增寶箱未載入");
                    g.Features.Use(new Features.Usable{f=item});
                    if(!g.Found[id].ContainsKey(key) || g.Found[id].ContainsKey("reward-"+b.GetComponent<WorldStamp>().rewardId))throw new Exception("寶箱進度未獨立");
                    g.StartStage();g.AdvanceLayoutPreview(0.1);g.RenderAt(new PixelFX.Frame(Game.W,Game.H),0,400);
                    if(template==0 && (g.StageD.Events.Count!=0 || g.Chest!=null || g.Enemies.Count!=0))throw new Exception("空白地圖含有範本事件");
                }
                finally{PrefabUtility.UnloadPrefabContents(root);}
            }
            finally{AssetDatabase.DeleteAsset(path);}
        }
        static void VerifyEditingTools()
        {
            var tempPath=MapWorkbench.CreateMap("工具驗證",2);
            var stage=PrefabStageUtility.OpenPrefab(tempPath);
            var root=stage.prefabContentsRoot;
            var window=ScriptableObject.CreateInstance<MapWorkbench>();
            var flags=BindingFlags.Instance|BindingFlags.NonPublic;
            var type=typeof(MapWorkbench);
            object Call(string name,params object[] args)=>type.GetMethod(name,flags).Invoke(window,args);
            var stamp=root.GetComponentsInChildren<WorldStamp>().First(s=>s.kind==StampKind.Solid);
            GameObject reward1=null,reward2=null;
            try
            {
                type.GetField("listRoot",flags).SetValue(window,root);type.GetField("map",flags).SetValue(window,1);
                Call("ToggleLock",root,2);
                if(!SceneVisibilityManager.instance.IsPickingDisabled(stamp.gameObject))throw new Exception("無法鎖定地形");
                Call("ToggleLock",root,2);
                if(SceneVisibilityManager.instance.IsPickingDisabled(stamp.gameObject))throw new Exception("無法解鎖地形");
                reward1=MapWorkbench.AddReward(root,new Vector3(100,-600));
                reward2=MapWorkbench.AddReward(root,new Vector3(140,-600));
                reward2.GetComponent<WorldStamp>().rewardId=reward1.GetComponent<WorldStamp>().rewardId;
                Call("Check",root);
                var issues=(System.Collections.Generic.List<(UnityEngine.Object,string)>)type.GetField("issues",flags).GetValue(window);
                if(!issues.Any(i=>i.Item1==reward2 && i.Item2.Contains("識別")))throw new Exception("重複寶箱未列出可定位的物件");
                type.GetField("live",flags).SetValue(window,true);
                SceneView.GetWindow<SceneView>();Call("UpdatePreview");
                if(!(type.GetField("texture",flags).GetValue(window) is Texture tex) || tex.width!=Game.W+2)throw new Exception("場景預覽未產生遊戲畫面");
            }
            finally
            {
                if(reward1)UnityEngine.Object.DestroyImmediate(reward1);
                if(reward2)UnityEngine.Object.DestroyImmediate(reward2);
                UnityEngine.Object.DestroyImmediate(window);
                StageUtility.GoToMainStage();
                AssetDatabase.DeleteAsset(tempPath);
            }
            Debug.Log("[MapWorkbench] PASS layer picking locks, click-target diagnostics and live scene preview");
        }
        public static void Run()
        {
            var root=PrefabUtility.LoadPrefabContents(WorldLayoutEditor.AssetPath("1-2"));
            try
            {
                for(int i=0;i<6;i++)
                {
                    var position=new Vector3(154+i,-532,0);
                    var go=MapWorkbench.Place(root,position,i);
                    var p=go.GetComponent<StagePiece>();
                    if(go.transform.parent!=root.transform || go.transform.localPosition!=position ||
                       !go.GetComponent<SpriteRenderer>().sprite || (i==0 && p.drift==0) ||
                       (i==1 && !p.blocksLight) || (i==2 && (!p.sparks || p.lightRadius==0)) ||
                       (i==3 && p.layer!=SceneryLayer.Foreground)) throw new Exception("景物放置錯誤");
                    Undo.PerformUndo();
                    if(go) throw new Exception("無法復原新增景物");
                }
            }
            finally { PrefabUtility.UnloadPrefabContents(root); }
            VerifyEditingTools();
            VerifyCustom(0);
            VerifyCustom(2);
            Debug.Log("[MapWorkbench] PASS six placements, undo, blank/template maps, painted collisions, reward identities and render preview");

            WorldLayoutEditor.Verify();
        }
    }
}
