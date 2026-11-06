// 建場景、輸出遊戲（不用開編輯器也能跑）：
//   Unity.exe -batchmode -projectPath unity -executeMethod ZeroStar.EditorTools.BuildTools.BuildWindows -quit
// 也可以在編輯器選單「零星工具／輸出 Windows 版」。
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace ZeroStar.EditorTools
{
    public static class BuildTools
    {
        const string DEMO = "Assets/Scenes/CanvasDemo.unity";

        [MenuItem("零星工具/建立示範場景")]
        public static void MakeDemoScene()
        {
            Directory.CreateDirectory("Assets/Scenes");
            var scene = EditorSceneManager.NewScene(NewSceneSetup.DefaultGameObjects, NewSceneMode.Single);
            EditorSceneManager.SaveScene(scene, DEMO);
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(DEMO, true) };
            AssetDatabase.SaveAssets();
            Debug.Log("[Build] 示範場景：" + DEMO);
        }

        [MenuItem("零星工具/輸出 Windows 版")]
        public static void BuildWindows()
        {
            if (!File.Exists(DEMO)) MakeDemoScene();
            PlayerSettings.companyName = "y8999y";
            PlayerSettings.productName = "轉生成星星碎片的我";
            PlayerSettings.fullScreenMode = FullScreenMode.Windowed;
            PlayerSettings.defaultScreenWidth = 1152;
            PlayerSettings.defaultScreenHeight = 648;
            PlayerSettings.resizableWindow = true;
            var r = BuildPipeline.BuildPlayer(new BuildPlayerOptions
            {
                scenes = new[] { DEMO },
                locationPathName = "Builds/Windows/ZeroStar.exe",
                target = BuildTarget.StandaloneWindows64,
                options = BuildOptions.None,
            });
            Debug.Log($"[Build] 結果：{r.summary.result}，{r.summary.totalSize / 1024 / 1024} MB，{r.summary.totalTime}");
            if (r.summary.result != UnityEditor.Build.Reporting.BuildResult.Succeeded) EditorApplication.Exit(1);
        }
    }
}
