using System;
using System.IO;
using System.Linq;
using System.Reflection;
using UnityEditor;
using UnityEngine;
using ZeroStar.UI;

namespace ZeroStar.Tests
{
    [InitializeOnLoad]
    public static class ExplorationMapShots
    {
        const string Phase="ZeroStar.ExploreShots";
        static ExplorationMapShots(){EditorApplication.update+=Capture;}
        public static void Before()=>Begin("before");
        public static void After()=>Begin("after");
        static void Begin(string pass)
        {
            SessionState.SetString(Phase,pass);SessionState.SetInt(Phase+"step",0);
            SessionState.SetString(Phase+"start",DateTime.UtcNow.Ticks.ToString());
            SessionState.SetString("ZeroStar.TestMap","1-2");
            SessionState.SetVector3("ZeroStar.TestPoint",new Vector3(1820,600));
            EditorWindow.GetWindow(typeof(EditorWindow).Assembly.GetType("UnityEditor.GameView")).Show();
            EditorApplication.EnterPlaymode();
        }
        static readonly string Output=Path.GetFullPath("build/outputs/exploration-map");
        static void Capture()
        {
            string pass=SessionState.GetString(Phase,"");if(pass=="")return;
            try
            {
                if((DateTime.UtcNow-new DateTime(long.Parse(SessionState.GetString(Phase+"start","0")))).TotalSeconds>65)throw new TimeoutException();
                if(!EditorApplication.isPlaying)return;
                const BindingFlags flags=BindingFlags.Instance|BindingFlags.NonPublic;
                var root=UnityEngine.Object.FindAnyObjectByType<GameRoot>();if(!root)return;
                var g=(Game)typeof(GameRoot).GetField("game",flags).GetValue(root);if(g==null || !g.Started)return;
                int step=SessionState.GetInt(Phase+"step",0);
                if(step==0 || step==2)
                {
                    Directory.CreateDirectory(Output);
                    if(step==0)
                    {
                        g.SetTestPosition(new Vector2(1820,600));
                        int cols=(g.Data.W+31)/32, rows=(g.Data.H+31)/32;
                        var seen=new bool[rows*cols];
                        for(int y=0;y<rows;y++)for(int x=0;x<cols;x++)
                            seen[y*cols+x]=(x>=4 && x<=84 && y>=13) || (x>=18 && x<=53 && y>=7 && y<13) || (x>=40 && x<=50 && y>=2);
                        g.MapSeen[g.StageId]=seen;
                        g.Features.Items.First(i=>i.t=="fossil").done=true;
                        g.Altars[1].Lit=true;
                    }
                    else
                    {
                        ((Win)typeof(GameRoot).GetField("win",flags).GetValue(root)).Close();
                        var safe=g.Features.Items.First(i=>i.t=="safe");
                        g.Features.Use(new Features.Usable{f=safe});
                        if(!safe.done)throw new Exception("Chest was not collected");
                    }
                    typeof(GameRoot).GetMethod("OpenLevelMap",flags).Invoke(root,null);
                    var tex=(Texture2D)typeof(LevelMap).GetField("last",BindingFlags.Static|BindingFlags.NonPublic).GetValue(null);
                    string tag=step==2?"collected":pass;
                    File.WriteAllBytes(Path.Combine(Output,tag+"-map.png"),tex.EncodeToPNG());
                    SessionState.SetFloat(Phase+"wait",(float)EditorApplication.timeSinceStartup+2.0f);
                    SessionState.SetInt(Phase+"step",step+1);return;
                }
                if(EditorApplication.timeSinceStartup<SessionState.GetFloat(Phase+"wait",0))return;
                string name=step==3?"collected":pass;
                string file=Path.Combine(Output,name+".png");
                if(step==1 || step==3)
                {
                    if(File.Exists(file))File.Delete(file);
                    ScreenCapture.CaptureScreenshot(file);
                    SessionState.SetInt(Phase+"step",step==1?4:5);return;
                }
                name=step==5?"collected":pass;
                file=Path.Combine(Output,name+".png");
                if(!File.Exists(file) || new FileInfo(file).Length<500)return;
                if(step==4 && pass=="after"){SessionState.SetInt(Phase+"step",2);return;}
                Debug.Log("[ExplorationMapShots] PASS "+pass);Finish(0);
            }catch(Exception ex){Debug.LogException(ex);Finish(1);}
        }
        static void Finish(int code){SessionState.EraseString(Phase);EditorApplication.Exit(code);}
    }
}
