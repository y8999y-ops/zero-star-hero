using System;
using System.Linq;
using System.Reflection;
using PixelFX;
using UnityEditor;
using UnityEngine;

namespace ZeroStar.Tests
{
    public static class WeatherPresentationTest
    {
        const BindingFlags Instance = BindingFlags.Instance | BindingFlags.NonPublic;
        static Color32[] Read(RenderTexture target)
        {
            var previous=RenderTexture.active;
            var read=new Texture2D(target.width,target.height,TextureFormat.RGBA32,false);
            try
            {
                RenderTexture.active=target;
                read.ReadPixels(new Rect(0,0,target.width,target.height),0,0);
                return read.GetPixels32();
            }
            finally { RenderTexture.active=previous; UnityEngine.Object.DestroyImmediate(read); }
        }

        static void CheckCoverage()
        {
            // 同色的前景／背景可揭露用顏色差異猜遮罩的錯誤。中間的透明像素必須繼續受雨。
            var root=new GameObject("Weather mask test");
            var piece=new GameObject("Foreground").AddComponent<StagePiece>();
            piece.transform.SetParent(root.transform,false);piece.transform.localPosition=new Vector3(5,-5);
            piece.layer=SceneryLayer.Foreground;piece.receivesLight=false;
            var ink=new Color32(200,160,100,255);
            var art=new Texture2D(3,1,TextureFormat.RGBA32,false);
            art.SetPixels32(new[]{ink,new Color32(0,0,0,0),ink});art.Apply();
            var sprite=Sprite.Create(art,new Rect(0,0,3,1),new Vector2(0,1),1,0,SpriteMeshType.FullRect);
            piece.GetComponent<SpriteRenderer>().sprite=sprite;
            try
            {
                var type=typeof(Game).Assembly.GetType("ZeroStar.StageLayout",true);
                object layout=Activator.CreateInstance(type,Instance,null,new object[]{root},null);
                var f=new Frame(16,16){UseGpuWeather=true};
                byte[] wet=new byte[32*32*4];for(int i=0;i<wet.Length;i+=4)wet[i]=255;
                PostFx.SetTown(32,32,wet,new byte[32*4]); PostFx.Wet=1; PostFx.Day=1; PostFx.Ox=PostFx.Oy=PostFx.RipN=0;
                Array.Fill(f.Color,0xff64a0c8u);
                f.BeginWeatherMask();f.ProtectLegacyDraws();
                type.GetMethod("Draw").Invoke(layout,new object[]{f,SceneryLayer.Foreground,f.Color});
                int p=5*16+5;
                if(f.WeatherMask[p]!=0 || f.WeatherMask[p+1]!=255 || f.WeatherMask[p+2]!=0)
                    throw new Exception("Mask disagrees with authored foreground coverage");
                f.WeatherReady=true;
                using(var display=new FramePresentation(16,16))
                {
                    display.Composite(f,null);
                    var result=display.Upload(f);
                    if(PostFx.ActiveFor(f))
                    {
                        var pixels=Read((RenderTexture)result);int index=(5+1)*18+5+1;
                        if(!pixels[index].Equals(ink) || pixels[index+1].Equals(ink) || !pixels[index+2].Equals(ink))
                            throw new Exception("GPU changed the foreground or left the wall dry");
                        Debug.Log($"[WeatherPresentation] foreground={pixels[index]}, wet wall through gap={pixels[index+1]}");
                    }
                    else if(result!=display.Source)throw new Exception("CPU fallback returned a GPU target");
                    f.ResetWeather();
                    if(display.Upload(f)!=display.Source)throw new Exception("A subsequent dry frame retained the weather pass");
                }
            }
            finally
            {
                UnityEngine.Object.DestroyImmediate(root);UnityEngine.Object.DestroyImmediate(sprite);UnityEngine.Object.DestroyImmediate(art);
            }
        }

        static void CheckWorkbench()
        {
            var window=ScriptableObject.CreateInstance<MapWorkbench>();
            var root=PrefabUtility.LoadPrefabContents(WorldLayoutEditor.AssetPath("town"));
            var view=EditorWindow.GetWindow<SceneView>();
            var pivot=view.pivot;
            var type=typeof(MapWorkbench);
            void Set(string key,object value)=>type.GetField(key,Instance).SetValue(window,value);
            object Get(string key)=>type.GetField(key,Instance).GetValue(window);
            try
            {
                view.pivot=new Vector3(190,-100);
                Set("map",5);Set("listRoot",root);Set("live",true);Set("paused",true);
                type.GetMethod("UpdatePreview",Instance).Invoke(window,null);
                var frame=(Frame)Get("frame");var preview=(Texture)Get("texture");
                if(!preview || frame==null)throw new Exception("Editor did not present a frame");
                if(!PostFx.ActiveFor(frame))
                {
                    if(!(preview is Texture2D))throw new Exception("Editor CPU fallback failed");
                    Debug.Log("[WeatherPresentation] CPU fallback preview rendered");return;
                }
                if(!(preview is RenderTexture wet) || !frame.WeatherReady)throw new Exception("Wet editor preview missed the shader");
                var expected=Read(wet);
                using(var display=new FramePresentation(frame.W,frame.H))
                {
                    display.Composite(frame,((Game)Get("preview")).PostComposite);
                    var output=display.Upload(frame);
                    var go=new GameObject("Display under test");go.layer=30;
                    var renderer=go.AddComponent<SpriteRenderer>();
                    var rect=new Rect(0,0,output.width,output.height);
                    var sprite=Sprite.Create(display.Source,rect,Vector2.one*0.5f,1,0,SpriteMeshType.FullRect);
                    renderer.sprite=sprite;renderer.flipY=true;
                    var cam=new GameObject("Display camera").AddComponent<Camera>();
                    var target=new RenderTexture(output.width,output.height,24,RenderTextureFormat.ARGB32);
                    try
                    {
                        PostFx.Present(output,display.Source,renderer,renderer.sharedMaterial);
                        cam.transform.position=new Vector3(0,0,-10);cam.orthographic=true;cam.orthographicSize=output.height*0.5f;
                        cam.aspect=output.width/(float)output.height;cam.cullingMask=1<<30;cam.allowMSAA=false;cam.allowHDR=false;
                        cam.targetTexture=target;cam.Render();var actual=Read(target);
                        for(int y=1;y<=frame.H;y++)for(int x=1;x<=frame.W;x++)
                            if(!actual[(output.height-1-y)*output.width+x].Equals(expected[y*output.width+x]))
                                throw new Exception($"Editor/playback mismatch at {x},{y}");
                        Debug.Log($"[WeatherPresentation] PASS {frame.W*frame.H} wet town pixels matched the SpriteRenderer on {SystemInfo.graphicsDeviceType}");
                    }
                    finally
                    {
                        cam.targetTexture=null;UnityEngine.Object.DestroyImmediate(cam.gameObject);
                        target.Release();UnityEngine.Object.DestroyImmediate(target);UnityEngine.Object.DestroyImmediate(go);UnityEngine.Object.DestroyImmediate(sprite);
                    }
                }
            }
            finally { view.pivot=pivot;UnityEngine.Object.DestroyImmediate(window);PrefabUtility.UnloadPrefabContents(root); }
        }

        public static void Run()
        {
            var weather=TownArt.WeatherOverride;var day=TownArt.DayOverride;var wet=TownPuddles.WetStart;
            try
            {
                TownArt.WeatherOverride="rain";TownArt.DayOverride=0.3;TownPuddles.WetStart=1;
                CheckCoverage();CheckWorkbench();
                Debug.Log("[WeatherPresentation] PASS");
            }
            finally {TownArt.WeatherOverride=weather;TownArt.DayOverride=day;TownPuddles.WetStart=wet;}
        }
    }
}
