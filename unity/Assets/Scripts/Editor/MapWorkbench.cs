using System;
using System.Collections.Generic;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace ZeroStar.Tests
{
    public sealed partial class MapWorkbench : EditorWindow
    {
        static readonly string[] DefaultMaps = { "1-1 墜落之底", "1-2 垃圾山", "1-3 洞窟", "1-4 王房", "無限討伐", "碎星鎮" };
        static readonly string[] Groups = { "全部", "背景", "地面", "前景", "互動", "角色" };
        static readonly string[] Presets = { "漂移雲", "岩石", "發光水晶", "前景草", "單向平台", "寶箱" };
        static readonly string[] Art = { "Cloud", "Stone", "Crystal", "Grass", "PlatformTile", "Previews/Chest-寶箱" };
        static readonly string[] Layers = { "背景", "地面", "前景" };
        static readonly string[] Kinds = { "地形","裝飾","實心地形","平台","天空","遠景","中景","近景","前景","上層遠景","上層中景","火盆","水晶","出生點","傳送門","寶箱","祭壇","機關","危險物","雲","草叢","箱子","可破壞水晶","積水","吊飾","小生物","蟲群","居民","敵人出生點","實心地形","單向平台","獎勵寶箱" };
        readonly List<Component> items = new List<Component>();
        GameObject listRoot;
        bool dirty = true, advanced;
        int group, page, pending = -1, map;
        string search = "";
        Vector2 scroll;

        [MenuItem("ZeroStar/地圖編輯器")]
        public static void Open() => GetWindow<MapWorkbench>("地圖編輯器");

        void OnEnable()
        {
            SetupTools();
            minSize = new Vector2(300, 320);
            SceneView.duringSceneGui += SceneTools;
            EditorApplication.hierarchyChanged += Refresh;
            Undo.undoRedoPerformed += Refresh;
            Selection.selectionChanged += Repaint;
        }
        void OnDisable()
        {
            CloseTools();
            SceneView.duringSceneGui -= SceneTools;
            EditorApplication.hierarchyChanged -= Refresh;
            Undo.undoRedoPerformed -= Refresh;
            Selection.selectionChanged -= Repaint;
        }
        void Refresh() { dirty = true; Invalidate(); Repaint(); }

        GameObject Root(out int index)
        {
            var stage = PrefabStageUtility.GetCurrentPrefabStage();
            index = stage == null ? -1 : Array.FindIndex(ids, id => stage.assetPath == WorldLayoutEditor.AssetPath(id));
            return index < 0 ? null : stage.prefabContentsRoot;
        }

        static int GroupOf(Component c)
        {
            if (c is StagePiece piece) return 1 + (int)piece.layer;
            switch (((WorldStamp)c).kind)
            {
                case StampKind.Fg: return 3;
                case StampKind.Back: case StampKind.Far: case StampKind.Mid: case StampKind.Near:
                case StampKind.UpFar: case StampKind.UpMid: case StampKind.Cloud: return 1;
                case StampKind.Decor: case StampKind.Solid: case StampKind.Platform: case StampKind.Terrain: case StampKind.PaintedGround: case StampKind.PaintedPlatform: return 2;
                case StampKind.Start: case StampKind.EnemySpawn: case StampKind.Resident: case StampKind.Critter: return 5;
                default: return 4;
            }
        }

        void OnGUI()
        {
            var root = Root(out int active);
            if (root != listRoot)
            {
                ReleaseLocks(); ResetPreview();issues.Clear(); collisionShapes.Clear(); collisionOn=false; listRoot = root; page = 0; pending = -1; dirty = true;
                if (active >= 0) map = active;
            }
            EditorGUILayout.BeginHorizontal();
            map = EditorGUILayout.Popup(map, labels);
            using (new EditorGUI.DisabledScope(map == active || EditorApplication.isPlayingOrWillChangePlaymode))
                if (GUILayout.Button("開啟關卡", GUILayout.Width(84)))
                {
                    pending = -1;
                    PrefabStageUtility.OpenPrefab(WorldLayoutEditor.AssetPath(ids[map]));
                    GUIUtility.ExitGUI();
                }
            EditorGUILayout.EndHorizontal();
            if(EditorApplication.isPlayingOrWillChangePlaymode)return;
            NewMapUI();
            if(!root)return;
            if(map != active) { EditorGUILayout.HelpBox("按「開啟關卡」切換到所選地圖。", MessageType.Info); pending=-1; return; }
            scroll = EditorGUILayout.BeginScrollView(scroll);
            EditorGUILayout.Space();
            ToolShelf(root);
            var selected = Selection.activeGameObject;
            if (selected && selected.transform.IsChildOf(root.transform))
            {
                Component entry = selected.TryGetComponent<WorldStamp>(out var stampEntry) ? (Component)stampEntry : selected.GetComponent<StagePiece>();
                if(entry && !IsLocked(entry)) Details(root,entry);
            }
            EditorGUILayout.Space();
            EditorGUILayout.LabelField("尋找物件", EditorStyles.boldLabel);
            EditorGUI.BeginChangeCheck();
            group = GUILayout.Toolbar(group,Groups);
            search = EditorGUILayout.TextField("名稱或類型",search);
            if(EditorGUI.EndChangeCheck()) page=0;
            if(dirty)
            {
                items.Clear(); items.AddRange(root.GetComponentsInChildren<WorldStamp>(true));
                items.AddRange(root.GetComponentsInChildren<StagePiece>(true)); dirty=false;
            }
            const int size=16;
            int count=0;
            foreach(var item in items)
            {
                if (!item || group!=0 && GroupOf(item)!=group) continue;
                string type=item is WorldStamp stamp ? Kinds[(int)stamp.kind] : Layers[(int)((StagePiece)item).layer];
                string label=item.name+"  ·  "+type;
                if(label.IndexOf(search,StringComparison.OrdinalIgnoreCase)<0) continue;
                if(count++/size!=page) continue;
                if(GUILayout.Button(label,EditorStyles.miniButton) && !IsLocked(item))
                {
                    Selection.activeGameObject=item.gameObject;
                    SceneView.lastActiveSceneView?.FrameSelected();
                }
            }
            int last=Math.Max(0,(count-1)/size);page=Math.Min(page,last);
            EditorGUILayout.BeginHorizontal();
            using(new EditorGUI.DisabledScope(page==0)) if(GUILayout.Button("上一頁"))page--;
            GUILayout.Label($"{page+1} / {last+1}（{count} 件）");
            using(new EditorGUI.DisabledScope(page>=last)) if(GUILayout.Button("下一頁"))page++;
            EditorGUILayout.EndHorizontal();
            EditorGUILayout.EndScrollView();
        }

        void Details(GameObject root,Component entry)
        {
            EditorGUILayout.Space();
            EditorGUILayout.LabelField("已選取　"+entry.name,EditorStyles.boldLabel);
            var t=entry.transform;
            var pos=root.transform.InverseTransformPoint(t.position);
            EditorGUI.BeginChangeCheck();
            var point=EditorGUILayout.Vector2IntField("地圖位置（Y 向下）",new Vector2Int(Mathf.RoundToInt(pos.x),Mathf.RoundToInt(-pos.y)));
            if(EditorGUI.EndChangeCheck())
            {
                Undo.RecordObject(t,"移動景物");
                t.position=root.transform.TransformPoint(new Vector3(point.x,-point.y,pos.z));
            }
            var obj=new SerializedObject(entry);
            void Field(string id,string label)=>EditorGUILayout.PropertyField(obj.FindProperty(id),new GUIContent(label));
            if(entry is StagePiece piece)
            {
                var layer=obj.FindProperty("layer");
                layer.enumValueIndex=EditorGUILayout.Popup("圖層",layer.enumValueIndex,Layers);
                if(layer.enumValueIndex==0) Field("drift","飄移速度");
                if(layer.enumValueIndex==(int)SceneryLayer.Playfield)Field("lightRadius","發光半徑");
                advanced=EditorGUILayout.Foldout(advanced,"更多設定",true);
                if(advanced)
                {
                    if(layer.enumValueIndex==0){ Field("parallax","視差倍率"); Field("repeatWidth","循環間距"); }
                    else Field("receivesLight","接受光照");
                    if(layer.enumValueIndex==(int)SceneryLayer.Playfield)
                    {
                        Field("blocksLight","遮光"); Field("blocksSparks","擋住火星");
                        Field("effectAnchor","效果掛點"); Field("lightColor","光色"); Field("sparks","產生火星");
                    }
                }
                if(obj.ApplyModifiedProperties())
                {
                    var sr=piece.GetComponent<SpriteRenderer>();
                    Undo.RecordObject(sr,"更新圖層預覽");
                    sr.sortingOrder=SortOrder(piece.layer);
                }
            }
            else if(entry is WorldStamp s && (s.kind==StampKind.Decor || s.kind==StampKind.Solid || s.kind==StampKind.Platform || s.kind==StampKind.Terrain))
            {
                advanced=EditorGUILayout.Foldout(advanced,"更多設定",true);
                if(advanced){ Field("blocksLight","遮光"); Field("blocksSparks","擋住火星"); obj.ApplyModifiedProperties(); }
            }
        }
        static int SortOrder(SceneryLayer layer)=>layer==SceneryLayer.Sky?-20:layer==SceneryLayer.Foreground?30010:1500;

        void SceneTools(SceneView view)
        {
            if(ExtraSceneTools(view))return;
            if(pending<0)return;
            var root=Root(out int active);
            if(!root || root!=listRoot || active!=map || EditorApplication.isPlayingOrWillChangePlaymode){pending=-1;Repaint();return;}
            var e=Event.current;
            if(e.type==EventType.KeyDown && e.keyCode==KeyCode.Escape){pending=-1;e.Use();Repaint();return;}
            if(e.alt)return;
            int control=GUIUtility.GetControlID(FocusType.Passive);
            if(e.type==EventType.Layout)HandleUtility.AddDefaultControl(control);
            var ray=HandleUtility.GUIPointToWorldRay(e.mousePosition);
            if(!new Plane(root.transform.forward,root.transform.position).Raycast(ray,out float distance))return;
            var local=root.transform.InverseTransformPoint(ray.GetPoint(distance));
            var pos=new Vector3(Mathf.Round(local.x),Mathf.Round(local.y),0);
            Handles.Label(root.transform.TransformPoint(pos),Presets[pending]);
            if(e.type!=EventType.MouseDown || e.button!=0 || HandleUtility.nearestControl!=control)return;
            Selection.activeGameObject=Place(root,pos,pending);
            pending=-1;Refresh();e.Use();
        }

        internal static GameObject Place(GameObject root,Vector3 pos,int preset)
        {
            if(preset==4)return AddTile(root,pos,32,8,true);
            if(preset==5)return AddReward(root,pos);
            var sprite=AssetDatabase.LoadAssetAtPath<Sprite>("Assets/StagePieces/"+Art[preset]+".png");
            if(!sprite)throw new InvalidOperationException("找不到景物圖片 "+Art[preset]);
            Undo.IncrementCurrentGroup();
            int undo=Undo.GetCurrentGroup();
            var go=new GameObject(Presets[preset]);
            UnityEngine.SceneManagement.SceneManager.MoveGameObjectToScene(go,root.scene);
            go.transform.SetParent(root.transform,false);go.transform.localPosition=pos;
            var piece=go.AddComponent<StagePiece>();
            piece.layer=preset==0?SceneryLayer.Sky:preset==3?SceneryLayer.Foreground:SceneryLayer.Playfield;
            var sr=go.GetComponent<SpriteRenderer>();sr.sprite=sprite;sr.sortingOrder=SortOrder(piece.layer);
            if(preset==0){piece.drift=3;piece.parallax=0.12f;piece.repeatWidth=360;}
            if(preset==1)piece.blocksLight=piece.blocksSparks=true;
            if(preset==2){piece.lightRadius=70;piece.lightColor=new Color(0.3f,0.8f,1);piece.sparks=true;piece.effectAnchor=Vector2.up*3;}
            Undo.RegisterCreatedObjectUndo(go,"放置"+Presets[preset]);
            Undo.CollapseUndoOperations(undo);
            EditorSceneManager.MarkSceneDirty(root.scene);return go;
        }
    }
}
