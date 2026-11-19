using System;
using System.IO;
using System.Reflection;
using System.Security.Cryptography;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace ZeroStar.Tests
{
    // 啟動時用 -executeMethod ZeroStar.Tests.WorkbenchPlayTest.Run，不帶 -quit。
    [InitializeOnLoad]
    public static class WorkbenchPlayTest
    {
        const string Phase="ZeroStar.PlayTest.Phase";
        static WorkbenchPlayTest(){EditorApplication.update+=Check;}
        static string Signature()
        {
            if(!File.Exists(SaveData.FilePath))return "missing";
            using(var hash=SHA256.Create())return Convert.ToBase64String(hash.ComputeHash(File.ReadAllBytes(SaveData.FilePath)));
        }
        public static void Run()
        {
            SessionState.SetString("ZeroStar.PlayTest.Save",Signature());
            var path=WorldLayoutEditor.AssetPath("1-2");
            PrefabStageUtility.OpenPrefab(path);
            SessionState.SetString("ZeroStar.TestMap","1-2");
            SessionState.SetString("ZeroStar.ReturnMap",path);
            SessionState.SetVector3("ZeroStar.TestPoint",new Vector3(318,590));
            SessionState.SetVector3("ZeroStar.ReturnPivot",new Vector3(318,-590));
            SessionState.SetFloat("ZeroStar.ReturnSize",145);
            SessionState.SetInt(Phase,1);
            SessionState.SetString("ZeroStar.PlayTest.Start",DateTime.UtcNow.Ticks.ToString());
            EditorApplication.EnterPlaymode();
        }
        static void Check()
        {
            int phase=SessionState.GetInt(Phase,0);if(phase==0)return;
            try
            {
                if((DateTime.UtcNow-new DateTime(long.Parse(SessionState.GetString("ZeroStar.PlayTest.Start","0")))).TotalSeconds>90)throw new TimeoutException("Play Mode 試玩未完成");
                if(phase==1 && EditorApplication.isPlaying)
                {
                    var root=UnityEngine.Object.FindAnyObjectByType<GameRoot>();if(!root)return;
                    const BindingFlags flags=BindingFlags.Instance|BindingFlags.NonPublic;
                    var game=(Game)typeof(GameRoot).GetField("game",flags).GetValue(root);if(game==null)return;
                    if(!game.Started || game.StageId!="1-2" || Math.Abs(game.Player.X-318)>1 || Math.Abs(game.Player.Y-590)>11)throw new Exception("試玩起點錯誤");
                    if((bool)typeof(GameRoot).GetProperty("CanSave",flags).GetValue(root))throw new Exception("試玩允許覆寫正式存檔");
                    typeof(GameRoot).GetMethod("Save",flags).Invoke(root,null);
                    SessionState.SetInt(Phase,2);EditorApplication.ExitPlaymode();
                }
                if(phase==2 && !EditorApplication.isPlayingOrWillChangePlaymode)
                {
                    var stage=PrefabStageUtility.GetCurrentPrefabStage();
                    if(stage==null || stage.assetPath!=WorldLayoutEditor.AssetPath("1-2"))return;
                    if(Signature()!=SessionState.GetString("ZeroStar.PlayTest.Save",""))throw new Exception("玩家存檔遭變更");
                    Debug.Log("[WorkbenchPlayTest] PASS: Play Mode spawn, isolated save, return to 1-2");Finish(0);
                }
            }catch(Exception ex){Debug.LogException(ex);Finish(1);}
        }
        static void Finish(int code){SessionState.EraseInt(Phase);EditorApplication.Exit(code);}
    }
}
