using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;
using PixelFX;

namespace ZeroStar.Tests
{
    public sealed partial class MapWorkbench
    {
        string[] ids,labels;
        int tab,brush,template;
        bool newPanel, testingPoint, collisionOn, dragging,live,paused;
        Vector2Int brushStart;
        string mapTitle="我的關卡";
        readonly List<(UnityEngine.Object target,string text)> issues=new List<(UnityEngine.Object,string)>();
        readonly List<(Rect rect,bool platform)> collisionShapes=new List<(Rect,bool)>();
        readonly HashSet<int> locked=new HashSet<int>();
        readonly List<GameObject> changedPicking=new List<GameObject>();
        Game preview;
        Frame frame;
        Texture texture;
        FramePresentation presentation;
        Action<byte[]> previewPost;
        double nextFrame,previewTime,rebuildAt;

        // Unity 的 Ctrl+D 會複製序列化欄位。保留已存在的寶箱 ID，只替剛複製出來的物件換 ID。
        [InitializeOnLoadMethod]
        static void WatchChestCopies()
        {
            var known=new HashSet<WorldStamp>();
            GameObject observed=null;
            void Remember(GameObject root)
            {
                observed=root;known.Clear();
                if(root)foreach(var s in root.GetComponentsInChildren<WorldStamp>(true))
                    if(s.kind==StampKind.RewardChest)known.Add(s);
            }
            PrefabStage.prefabStageOpened+=s=>Remember(s.prefabContentsRoot);
            EditorApplication.hierarchyChanged+=()=>
            {
                var stage=PrefabStageUtility.GetCurrentPrefabStage();
                if(stage==null || !stage.assetPath.StartsWith("Assets/Resources/StageLayouts/",StringComparison.Ordinal)){Remember(null);return;}
                var root=stage.prefabContentsRoot;
                if(root!=observed){Remember(root);return;}
                var chests=root.GetComponentsInChildren<WorldStamp>(true).Where(s=>s.kind==StampKind.RewardChest).ToArray();
                var idsInUse=new HashSet<string>(chests.Where(known.Contains).Select(s=>s.rewardId));
                foreach(var chest in chests)
                {
                    if(known.Contains(chest))continue;
                    if(string.IsNullOrEmpty(chest.rewardId) || !idsInUse.Add(chest.rewardId))
                    {
                        Undo.RecordObject(chest,"建立寶箱識別");
                        chest.rewardId=Guid.NewGuid().ToString("N");idsInUse.Add(chest.rewardId);
                        EditorUtility.SetDirty(chest);EditorSceneManager.MarkSceneDirty(root.scene);
                    }
                }
                Remember(root);
            };
        }
        void SetupTools()
        {
            PrefabStage.prefabSaving+=CheckBeforeSave;
            Selection.selectionChanged+=EnforceLock; Catalog();EditorApplication.projectChanged+=Catalog;
            Undo.postprocessModifications+=Modified;EditorApplication.update+=UpdatePreview;
            Undo.undoRedoPerformed+=Invalidate;
        }
        void CloseTools()
        {
            PrefabStage.prefabSaving-=CheckBeforeSave;
            Selection.selectionChanged-=EnforceLock;EditorApplication.projectChanged-=Catalog;Undo.postprocessModifications-=Modified;
            EditorApplication.update-=UpdatePreview;Undo.undoRedoPerformed-=Invalidate;
            ReleaseLocks();ResetPreview();
        }
        UndoPropertyModification[] Modified(UndoPropertyModification[] changes)
        {
            if(listRoot && changes.Any(m=>m.currentValue.target is Component c && c.transform.IsChildOf(listRoot.transform)))Invalidate();
            return changes;
        }
        void Invalidate(){if(rebuildAt==0)rebuildAt=EditorApplication.timeSinceStartup+0.12;collisionShapes.Clear();}
        void Catalog()
        {
            var paths=AssetDatabase.FindAssets("t:Prefab",new[]{"Assets/Resources/StageLayouts"}).Select(AssetDatabase.GUIDToAssetPath);
            var extra=paths.Where(p=>AssetDatabase.LoadAssetAtPath<GameObject>(p).GetComponent<CustomMap>()).OrderBy(p=>p).ToArray();
            ids=WorldLayoutEditor.Stages.Concat(extra.Select(Path.GetFileNameWithoutExtension)).ToArray();
            labels=DefaultMaps.Concat(extra.Select(p=>AssetDatabase.LoadAssetAtPath<GameObject>(p).GetComponent<CustomMap>().displayName)).ToArray();
            map=Mathf.Clamp(map,0,ids.Length-1);Repaint();
        }
        void NewMapUI()
        {
            newPanel=EditorGUILayout.Foldout(newPanel,"建立新關卡",true);
            if(!newPanel)return;
            mapTitle=EditorGUILayout.TextField("名稱",mapTitle);
            template=EditorGUILayout.Popup("起始配置",template,new[]{"空白場地","複製 1-1","複製 1-2","複製 1-3"});
            using(new EditorGUI.DisabledScope(string.IsNullOrWhiteSpace(mapTitle)))
            if(GUILayout.Button("建立並開啟"))
            {
                string path=CreateMap(mapTitle.Trim(),template);
                Catalog();newPanel=false;PrefabStageUtility.OpenPrefab(path);GUIUtility.ExitGUI();
            }
        }
        internal static string CreateMap(string title,int template)
        {
            string source=template==0?"1-2":"1-"+template;
            string path="Assets/Resources/StageLayouts/map-"+Guid.NewGuid().ToString("N")+".prefab";
            var root=PrefabUtility.LoadPrefabContents(WorldLayoutEditor.AssetPath(source));
            try
            {
                var config=root.AddComponent<CustomMap>();config.template=source;config.blank=template==0;config.displayName=title;
                if(config.blank)
                {
                    foreach(var stamp in root.GetComponentsInChildren<WorldStamp>())
                    {
                        bool background=stamp.kind>=StampKind.Back && stamp.kind<=StampKind.UpMid;
                        if(!background && stamp.kind!=StampKind.Start && stamp.kind!=StampKind.Exit)DestroyImmediate(stamp.gameObject);
                    }
                    foreach(var p in root.GetComponentsInChildren<StagePiece>())DestroyImmediate(p.gameObject);
                    var start=root.GetComponentsInChildren<WorldStamp>().First(s=>s.kind==StampKind.Start);
                    var exit=root.GetComponentsInChildren<WorldStamp>().First(s=>s.kind==StampKind.Exit);
                    start.transform.position=new Vector3(64,-568);exit.transform.position=new Vector3(280,-568);
                    AddTile(root,new Vector3(0,-568),384,32,false,false);
                }
                if(!PrefabUtility.SaveAsPrefabAsset(root,path))throw new IOException("無法建立關卡 "+path);
                return path;
            }
            finally{PrefabUtility.UnloadPrefabContents(root);}
        }

        void ToolShelf(GameObject root)
        {
            int next=GUILayout.Toolbar(tab,new[]{"擺設","地形","試玩與檢查"});
            if(next!=tab){tab=next;pending=-1;testingPoint=dragging=false;}
            if(tab==0)
            {
                for(int row=0;row<2;row++)
                {
                    EditorGUILayout.BeginHorizontal();
                    for(int col=0;col<3;col++)
                    {
                        int i=row*3+col;
                        var r=GUILayoutUtility.GetRect(55,44,GUILayout.ExpandWidth(true));
                        var sprite=AssetDatabase.LoadAssetAtPath<Sprite>("Assets/StagePieces/"+Art[i]+".png");
                        bool available=(map!=5 || i<4) && !locked.Contains(i==0?1:i==3?3:i==5?4:2);
                        using(new EditorGUI.DisabledScope(!available))
                        {
                            GUI.Box(r,GUIContent.none);
                            if(sprite)GUI.DrawTexture(new Rect(r.center.x-13,r.y+1,26,24),sprite.texture,ScaleMode.ScaleToFit,true);
                            GUI.Label(new Rect(r.x,r.y+24,r.width,20),(pending==i?"✓ ":"")+Presets[i],EditorStyles.centeredGreyMiniLabel);
                            var e=Event.current;
                            if(available && r.Contains(e.mousePosition))
                            {
                                if(e.type==EventType.MouseDown && e.button==0){pending=i;DragAndDrop.PrepareStartDrag();DragAndDrop.objectReferences=new UnityEngine.Object[]{sprite};DragAndDrop.SetGenericData("ZeroStar.Preset",i);e.Use();}
                                else if(e.type==EventType.MouseDrag && pending==i){DragAndDrop.StartDrag(Presets[i]);e.Use();}
                            }
                        }
                    }
                    EditorGUILayout.EndHorizontal();
                }
                if(pending>=0)EditorGUILayout.HelpBox("點場景或拖放縮圖來放置。Esc 取消。",MessageType.Info);
                var selected=Selection.activeGameObject;
                if(selected && selected.transform.IsChildOf(root.transform) && selected.TryGetComponent<WorldStamp>(out var chest) && chest.kind==StampKind.RewardChest && !IsLocked(chest))
                    if(GUILayout.Button("複製寶箱"))Selection.activeGameObject=AddReward(root,root.transform.InverseTransformPoint(selected.transform.position)+Vector3.right*24);
            }
            if(tab==1)
            {
                brush=GUILayout.Toolbar(brush,new[]{"實心地面","單向平台","擦除筆刷地形"});
                EditorGUILayout.HelpBox(map==5?"城鎮使用固定街道。地形筆刷適用於戰鬥地圖。":"在場景拖曳畫出地形，放開滑鼠完成。Ctrl+Z 復原。",MessageType.Info);
            }
            EditorGUILayout.BeginHorizontal();
            bool show=GUILayout.Toggle(collisionOn,"碰撞線","Button");
            if(show!=collisionOn){collisionOn=show;collisionShapes.Clear();SceneView.RepaintAll();}
            bool play=GUILayout.Toggle(live,"光影預覽","Button");
            if(play!=live){live=play;previewTime=0;Invalidate();SceneView.RepaintAll();}
            if(live)paused=GUILayout.Toggle(paused,"暫停","Button");
            EditorGUILayout.EndHorizontal();
            if(tab==2)
            {
                if(root.TryGetComponent<CustomMap>(out var custom))
                {
                    var obj=new SerializedObject(custom);
                    EditorGUILayout.PropertyField(obj.FindProperty("displayName"),new GUIContent("地圖名稱"));
                    int idx=Array.IndexOf(ids,custom.destination);
                    int dest=EditorGUILayout.Popup("出口前往",idx,labels);
                    if(dest>=0 && dest!=idx)obj.FindProperty("destination").stringValue=ids[dest];
                    obj.ApplyModifiedProperties();
                }
                testingPoint=GUILayout.Toggle(testingPoint,"點選試玩起點","Button");
                if(GUILayout.Button("檢查關卡"))Check(root);
                var pick=Selection.activeGameObject;
                if(pick && pick.transform.IsChildOf(root.transform) && pick.TryGetComponent<WorldStamp>(out var reward) &&
                    reward.kind==StampKind.RewardChest && issues.Any(i=>i.target==pick && i.text.Contains("識別")))
                {
                    if(GUILayout.Button("為此寶箱產生獨立識別"))
                    { Undo.RecordObject(reward,"修復寶箱識別");reward.rewardId=Guid.NewGuid().ToString("N");Check(root); }
                }
                foreach(var issue in issues)if(GUILayout.Button(issue.text,EditorStyles.miniButton) && issue.target)
                {Selection.activeObject=issue.target;SceneView.lastActiveSceneView?.FrameSelected();}
            }
            if(group!=0)
            {
                bool isLocked=locked.Contains(group);
                if(GUILayout.Button((isLocked?"解鎖":"鎖定")+Groups[group]+"圖層")) ToggleLock(root,group);
            }
        }

        static Component Owner(Transform t)
        {
            for(;t;t=t.parent)
            {
                if(t.TryGetComponent<WorldStamp>(out var stamp))return stamp;
                if(t.TryGetComponent<StagePiece>(out var piece))return piece;
            }
            return null;
        }
        void EnforceLock()
        {
            if(!listRoot || locked.Count==0)return;
            var allowed=Selection.gameObjects.Where(o=>!o.transform.IsChildOf(listRoot.transform) || !Owner(o.transform) || !IsLocked(Owner(o.transform))).ToArray();
            if(allowed.Length!=Selection.gameObjects.Length)Selection.objects=allowed;
        }
        bool IsLocked(Component entry)=>locked.Contains(GroupOf(entry));
        void ToggleLock(GameObject root,int layer)
        {
            if(locked.Remove(layer))
            {
                foreach(var o in changedPicking.ToArray())if(o)
                {
                    Component c=Owner(o.transform);
                    if(c && GroupOf(c)==layer){SceneVisibilityManager.instance.EnablePicking(o,false);changedPicking.Remove(o);}
                }
            }
            else
            {
                locked.Add(layer);
                foreach(var c in root.GetComponentsInChildren<Component>(true))
                {
                    if(!(c is StagePiece || c is WorldStamp) || GroupOf(c)!=layer)continue;
                    foreach(var t in c.GetComponentsInChildren<Transform>(true))
                    {
                        if(t!=c.transform && (Owner(t))!=c)continue;
                        if(SceneVisibilityManager.instance.IsPickingDisabled(t.gameObject))continue;
                        SceneVisibilityManager.instance.DisablePicking(t.gameObject,false);changedPicking.Add(t.gameObject);
                    }
                }
                Selection.activeObject=null;pending=-1;
            }
        }
        void ReleaseLocks(){foreach(var go in changedPicking)if(go)SceneVisibilityManager.instance.EnablePicking(go,false);changedPicking.Clear();locked.Clear();}

        static GameObject Stamp(GameObject root,Vector3 pos,string name,StampKind kind,string asset)
        {
            var go=new GameObject(name);SceneManager.MoveGameObjectToScene(go,root.scene);go.transform.SetParent(root.transform,false);go.transform.localPosition=pos;
            var s=go.AddComponent<WorldStamp>();s.kind=kind;s.index=-1;s.original=s.Position(root.transform);s.lights=Array.Empty<int>();
            var sr=go.AddComponent<SpriteRenderer>();sr.sprite=AssetDatabase.LoadAssetAtPath<Sprite>("Assets/StagePieces/"+asset+".png");sr.sortingOrder=1200;
            return go;
        }
        internal static GameObject AddReward(GameObject root,Vector3 pos)
        {
            var go=Stamp(root,pos,"寶箱",StampKind.RewardChest,"Previews/Feature-safe");
            go.GetComponent<WorldStamp>().rewardId=Guid.NewGuid().ToString("N");
            Undo.RegisterCreatedObjectUndo(go,"放置寶箱");EditorSceneManager.MarkSceneDirty(root.scene);return go;
        }
        internal static GameObject AddTile(GameObject root,Vector3 pos,int width,int height,bool platform,bool record=true)
        {
            var go=Stamp(root,pos,platform?"單向平台":"實心地面",platform?StampKind.PaintedPlatform:StampKind.PaintedGround,platform?"PlatformTile":"GroundTile");
            var s=go.GetComponent<WorldStamp>();s.size=new Vector2Int(width,height);
            var sr=go.GetComponent<SpriteRenderer>();sr.drawMode=SpriteDrawMode.Tiled;sr.size=s.size;
            if(record){Undo.RegisterCreatedObjectUndo(go,"繪製地形");EditorSceneManager.MarkSceneDirty(root.scene);}
            return go;
        }

        LevelData baseData;
        string baseId;
        LevelData Base(GameObject root)
        {
            string id=root.TryGetComponent<CustomMap>(out var c)?c.template:ids[map];
            if(baseData==null || baseId!=id){baseId=id;baseData=id=="town"?TownArt.Level():Baked.Level(id);}
            return baseData;
        }
        internal static Rect Collision(WorldStamp s,GameObject root,LevelData data)
        {
            var p=s.Position(root.transform);var d=p-s.original;
            if(s.kind==StampKind.Solid && s.index>=0 && s.index<data.Solids.Count)
            {var a=data.Solids[s.index];return new Rect((float)a.X+d.x,(float)a.Y+d.y,(float)a.W,(float)a.H);}
            if(s.kind==StampKind.Platform && s.index>=0 && s.index<data.Platforms.Count)
            {var a=data.Platforms[s.index];return new Rect((float)a.X+d.x,(float)a.Y+d.y,(float)a.W,1);}
            if(s.kind==StampKind.PaintedGround || s.kind==StampKind.PaintedPlatform)return new Rect(p.x,p.y,s.size.x,s.kind==StampKind.PaintedPlatform?1:s.size.y);
            return default;
        }
        void Shapes(GameObject root)
        {
            if(collisionShapes.Count!=0)return;
            var data=Base(root);
            foreach(var s in root.GetComponentsInChildren<WorldStamp>())
            {
                var r=Collision(s,root,data);if(r.width>0)collisionShapes.Add((r,s.kind==StampKind.Platform || s.kind==StampKind.PaintedPlatform));
            }
            if(ids[map]=="town")foreach(var a in data.Solids)collisionShapes.Add((new Rect((float)a.X,(float)a.Y,(float)a.W,(float)a.H),false));
        }
        void CheckBeforeSave(GameObject root)
        {
            if(root!=listRoot || Root(out int active)!=root || active!=map)return;
            collisionShapes.Clear();Check(root);
            int count=issues.Count(i=>i.target);
            if(count>0){tab=2;ShowNotification(new GUIContent($"關卡有 {count} 個問題可定位"));Repaint();}
        }
        void Check(GameObject root)
        {
            issues.Clear();Shapes(root);var stamps=root.GetComponentsInChildren<WorldStamp>();var data=Base(root);
            var solids=collisionShapes.Where(a=>!a.platform).Select(a=>new RectD{X=a.rect.x,Y=a.rect.y,W=a.rect.width,H=a.rect.height}).ToList();
            var grid=new GameMap(data.W,data.H,solids,new List<Platform>());
            foreach(var s in stamps.Where(s=>s.kind==StampKind.Start || s.kind==StampKind.Exit))
            {
                var p=s.Position(root.transform);
                if(p.x<0 || p.x>=data.W || p.y<0 || p.y>=data.H || grid.SolidAt(p.x,p.y-4))
                    issues.Add((s.gameObject,s.name+"：位置在牆內或地圖外"));
            }
            foreach(var g in stamps.Where(s=>s.kind==StampKind.RewardChest).GroupBy(s=>s.rewardId))
                if(string.IsNullOrEmpty(g.Key)||g.Count()>1)foreach(var s in g)issues.Add((s.gameObject,s.name+"：存檔識別缺失或重複"));
            foreach(var s in stamps.Where(s=>s.kind==StampKind.PaintedGround || s.kind==StampKind.PaintedPlatform))
            {
                var p=s.Position(root.transform);
                if(s.size.x<=0 || s.size.y<=0 || p.x<0 || p.y<0 || p.x+s.size.x>data.W || p.y+s.size.y>data.H)
                    issues.Add((s.gameObject,s.name+"：地形範圍無效"));
            }
            foreach(var piece in root.GetComponentsInChildren<StagePiece>())
            {
                var sprite=piece.GetComponent<SpriteRenderer>().sprite;
                if(!sprite || !sprite.texture.isReadable)issues.Add((piece.gameObject,piece.name+"：缺少圖片或未開啟 Read/Write"));
            }
            if(root.TryGetComponent<CustomMap>(out var c) && !ids.Contains(c.destination))issues.Add((root,"出口目的地不存在"));
            if(!stamps.Any(s=>s.kind==StampKind.Start))issues.Add((root,"找不到出生點"));
            if(root.TryGetComponent<CustomMap>(out _) && !stamps.Any(s=>s.kind==StampKind.Exit))issues.Add((root,"找不到傳送門"));
            if(issues.Count==0)issues.Add((null,"檢查通過"));
        }

        void ResetPreview(){preview=null;rebuildAt=0;presentation?.Dispose();presentation=null;texture=null;previewPost=null;}
        void UpdatePreview()
        {
            if(!live || !listRoot || EditorApplication.isPlayingOrWillChangePlaymode)return;
            double now=EditorApplication.timeSinceStartup;
            if(now<nextFrame)return;
            double dt=paused?0:Math.Min(0.1,Math.Max(0,now-nextFrame+1.0/15));nextFrame=now+1.0/15;
            try
            {
                if(rebuildAt>now)return;
                if(preview==null || rebuildAt>0)
                {
                    preview=new Game(ids[map],null,listRoot);preview.StartStage();previewPost=preview.PostComposite;
                    double warm=Math.Min(1.5,previewTime);
                    preview.AdvanceLayoutPreview(Math.Max(0,previewTime-warm));
                    for(int i=0;i<(int)(warm*30);i++)preview.AdvanceLayoutPreview(1.0/30);
                    rebuildAt=0;
                }
                previewTime+=dt;preview.AdvanceLayoutPreview(dt);
                int w=Game.W,h=Game.H;
                if(presentation==null || frame.W!=w || frame.H!=h)
                {
                    presentation?.Dispose();
                    frame=new Frame(w,h){UseGpuWeather=true};
                    presentation=new FramePresentation(w,h);
                }
                var view=SceneView.lastActiveSceneView;if(!view)return;
                Vector3 pivot=listRoot.transform.InverseTransformPoint(view.pivot);
                frame.Clear();preview.RenderAt(frame,Mathf.Clamp(pivot.x-w/2,0,preview.Data.W-w),Mathf.Clamp(-pivot.y-h/2,0,preview.Data.H-h));
                presentation.Composite(frame,previewPost);
                texture=presentation.Upload(frame);
                SceneView.RepaintAll();
            }
            catch(Exception ex){live=false;Debug.LogException(ex);ShowNotification(new GUIContent("預覽失敗，請查看 Console"));Repaint();}
        }
        static void Outline(Rect r,Color c)
        {
            Handles.color=c;
            Handles.DrawWireCube(new Vector3(r.center.x,-r.center.y),new Vector3(r.width,r.height));
        }
        bool ExtraSceneTools(SceneView view)
        {
            var root=Root(out int active);
            if(!root || root!=listRoot || active!=map || EditorApplication.isPlayingOrWillChangePlaymode)return false;
            var e=Event.current;
            if(collisionOn && e.type==EventType.Repaint){Shapes(root);foreach(var shape in collisionShapes)Outline(shape.rect,shape.platform?Color.yellow:Color.green);}
            if(collisionOn && e.type==EventType.Repaint)
            {
                foreach(var piece in root.GetComponentsInChildren<StagePiece>())if(piece.lightRadius>0 && piece.layer==SceneryLayer.Playfield)
                {
                    Handles.color=piece.lightColor;
                    Handles.DrawWireDisc(piece.transform.position+(Vector3)piece.effectAnchor,Vector3.forward,piece.lightRadius);
                }
                foreach(var s in root.GetComponentsInChildren<WorldStamp>())
                {
                    var p=s.Position(root.transform);Vector2 size;
                    switch(s.kind)
                    {
                        case StampKind.RewardChest:size=new Vector2(44,52);break;
                        case StampKind.Chest:size=new Vector2(48,40);break;
                        case StampKind.Altar:size=new Vector2(32,48);break;
                        case StampKind.Exit:size=new Vector2(32,40);break;
                        default:continue;
                    }
                    Outline(new Rect((Vector2)p-size/2,size),Color.cyan);
                }
            }
            if(live && texture){Handles.BeginGUI();GUI.DrawTextureWithTexCoords(new Rect(8,8,256,144),texture,new Rect(1f/texture.width,1f-1f/texture.height,(float)frame.W/texture.width,-(float)frame.H/texture.height));Handles.EndGUI();}
            bool drag=e.type==EventType.DragUpdated || e.type==EventType.DragPerform;
            int preset=drag && DragAndDrop.GetGenericData("ZeroStar.Preset") is int i?i:-1;
            bool paint=tab==1 && map!=5 && !locked.Contains(2);
            if(!paint && !testingPoint && preset<0)return false;
            if(e.alt)return true;
            var ray=HandleUtility.GUIPointToWorldRay(e.mousePosition);
            if(!new Plane(root.transform.forward,root.transform.position).Raycast(ray,out float distance))return true;
            Vector3 local=root.transform.InverseTransformPoint(ray.GetPoint(distance));
            var point=new Vector2Int(Mathf.RoundToInt(local.x),Mathf.RoundToInt(-local.y));
            var pos=new Vector3(point.x,-point.y);
            if(preset>=0)
            {
                if(locked.Contains(preset==0?1:preset==3?3:preset==5?4:2) || map==5 && preset>=4)return true;
                DragAndDrop.visualMode=DragAndDropVisualMode.Copy;
                if(e.type==EventType.DragPerform){DragAndDrop.AcceptDrag();Selection.activeGameObject=Place(root,pos,preset);pending=-1;Refresh();}
                e.Use();return true;
            }
            int control=GUIUtility.GetControlID(FocusType.Passive);
            if(e.type==EventType.Layout)HandleUtility.AddDefaultControl(control);
            if(e.type==EventType.KeyDown && e.keyCode==KeyCode.Escape){dragging=testingPoint=false;tab=0;GUIUtility.hotControl=0;e.Use();Repaint();return true;}
            if(e.type==EventType.MouseDown && e.button==0 && HandleUtility.nearestControl==control)
            {
                if(testingPoint)
                {
                    Check(root);if(issues.Any(issue=>issue.target)){ShowNotification(new GUIContent("請先修正關卡問題"));return true;}
                    Shapes(root);if(point.x<0 || point.y<0 || point.x>=Base(root).W || point.y>=Base(root).H || collisionShapes.Any(s=>!s.platform && s.rect.Contains(new Vector2(point.x,point.y-4))))
                    {ShowNotification(new GUIContent("請點選地圖內可站立的位置"));return true;}
                    var stage=PrefabStageUtility.GetCurrentPrefabStage();
                    if(!PrefabUtility.SaveAsPrefabAsset(root,stage.assetPath))throw new IOException("場景未儲存");
                    SessionState.SetString("ZeroStar.TestMap",ids[map]);SessionState.SetString("ZeroStar.ReturnMap",stage.assetPath);
                    SessionState.SetVector3("ZeroStar.TestPoint",new Vector3(point.x,point.y));SessionState.SetVector3("ZeroStar.ReturnPivot",view.pivot);
                    SessionState.SetFloat("ZeroStar.ReturnSize",view.size);testingPoint=false;
                    EditorApplication.EnterPlaymode();
                }
                else if(brush==2)
                {
                    var tile=root.GetComponentsInChildren<WorldStamp>().LastOrDefault(s=>
                    {
                        if(s.kind!=StampKind.PaintedGround && s.kind!=StampKind.PaintedPlatform)return false;
                        var corner=s.Position(root.transform);
                        return new Rect(corner.x,corner.y,s.size.x,s.size.y).Contains(point);
                    });
                    if(tile){Undo.DestroyObjectImmediate(tile.gameObject);Refresh();}
                }
                else{brushStart=Snap(point);dragging=true;GUIUtility.hotControl=control;}
                e.Use();return true;
            }
            if(dragging)
            {
                var end=Snap(point);var min=Vector2Int.Min(brushStart,end);var max=Vector2Int.Max(brushStart,end);
                var r=new Rect(min.x,brush==1?brushStart.y:min.y,max.x-min.x+8,brush==1?8:max.y-min.y+8);
                Outline(r,Color.cyan);
                if(e.type==EventType.MouseUp && e.button==0)
                {
                    var data=Base(root);
                    if(r.xMin>=0 && r.yMin>=0 && r.xMax<=data.W && r.yMax<=data.H)
                        Selection.activeGameObject=AddTile(root,new Vector3(r.x,-r.y),(int)r.width,(int)r.height,brush==1);
                    else ShowNotification(new GUIContent("地形超出地圖範圍"));
                    GUIUtility.hotControl=0;dragging=false;Refresh();e.Use();
                }
                view.Repaint();
            }
            return true;
        }
        static Vector2Int Snap(Vector2Int p)=>new Vector2Int(Mathf.FloorToInt(p.x/8f)*8,Mathf.FloorToInt(p.y/8f)*8);
        [InitializeOnLoadMethod]
        static void RestoreAfterTest()
        {
            EditorApplication.playModeStateChanged+=state=>
            {
                if(state!=PlayModeStateChange.EnteredEditMode)return;
                string path=SessionState.GetString("ZeroStar.ReturnMap","");if(path=="")return;
                SessionState.EraseString("ZeroStar.ReturnMap");SessionState.EraseString("ZeroStar.TestMap");
                EditorApplication.delayCall+=()=>{PrefabStageUtility.OpenPrefab(path);var v=SceneView.lastActiveSceneView;if(v){v.pivot=SessionState.GetVector3("ZeroStar.ReturnPivot",v.pivot);v.size=SessionState.GetFloat("ZeroStar.ReturnSize",v.size);v.Repaint();}};
            };
        }
    }
}
