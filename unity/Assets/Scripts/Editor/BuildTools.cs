// 建場景、輸出遊戲（不用開編輯器也能跑）：
//   Unity.exe -batchmode -projectPath unity -executeMethod ZeroStar.EditorTools.BuildTools.BuildWindows -quit
//   Unity.exe -batchmode -projectPath unity -executeMethod ZeroStar.EditorTools.BuildTools.BuildAndroid -quit
// 也可以在編輯器選單「零星工具／輸出 Windows 版」「零星工具／輸出 Android 版」。
// 遊戲本身不用在場景裡擺東西：開任何場景都會自動建立 GameRoot（Runtime/GameRoot.cs）。
using System.IO;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace ZeroStar.EditorTools
{
    public static class BuildTools
    {
        const string MAIN = "Assets/Scenes/Main.unity";

        [MenuItem("零星工具/建立主場景")]
        public static void MakeScene()
        {
            Directory.CreateDirectory("Assets/Scenes");
            var scene = EditorSceneManager.NewScene(NewSceneSetup.DefaultGameObjects, NewSceneMode.Single);
            EditorSceneManager.SaveScene(scene, MAIN);
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(MAIN, true) };
            AssetDatabase.SaveAssets();
            Debug.Log("[Build] 主場景：" + MAIN);
        }

        static void Common()
        {
            if (!File.Exists(MAIN)) MakeScene();
            PlayerSettings.companyName = "y8999y";
            PlayerSettings.productName = "轉生成星星碎片的我";
            PlayerSettings.bundleVersion = "0.5.0";
            // App 圖示（暫時版：主角的像素圖放大，深紫底＋金色光暈；Resources/Art/ui/app-icon.png）
            var icon = AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/Resources/Art/ui/app-icon.png");
            if (icon != null) PlayerSettings.SetIcons(UnityEditor.Build.NamedBuildTarget.Unknown, new[] { icon }, IconKind.Any);
        }
        static void Report(BuildReport r)
        {
            Debug.Log($"[Build] 結果：{r.summary.result}，{r.summary.totalSize / 1024 / 1024} MB，{r.summary.totalTime}，輸出：{r.summary.outputPath}");
            if (r.summary.result != BuildResult.Succeeded) EditorApplication.Exit(1);
        }

        [MenuItem("零星工具/輸出 Windows 版")]
        public static void BuildWindows()
        {
            Common();
            PlayerSettings.fullScreenMode = FullScreenMode.Windowed;
            PlayerSettings.defaultScreenWidth = 1152;
            PlayerSettings.defaultScreenHeight = 648;
            PlayerSettings.resizableWindow = true;
            Report(BuildPipeline.BuildPlayer(new BuildPlayerOptions
            {
                scenes = new[] { MAIN }, locationPathName = "Builds/Windows/ZeroStar.exe", target = BuildTarget.StandaloneWindows64, options = BuildOptions.None,
            }));
        }

        [MenuItem("零星工具/輸出 Android 版")]
        public static void BuildAndroid()
        {
            Common();
            PlayerSettings.SetApplicationIdentifier(UnityEditor.Build.NamedBuildTarget.Android, "com.y8999y.zerostar");
            PlayerSettings.Android.bundleVersionCode = 5;   // 每次上架要比上一次大
            PlayerSettings.Android.minSdkVersion = AndroidSdkVersions.AndroidApiLevel26;
            PlayerSettings.SetScriptingBackend(UnityEditor.Build.NamedBuildTarget.Android, ScriptingImplementation.IL2CPP);
            PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64;
            PlayerSettings.defaultInterfaceOrientation = UIOrientation.LandscapeLeft;
            PlayerSettings.allowedAutorotateToLandscapeLeft = true;
            PlayerSettings.allowedAutorotateToLandscapeRight = true;
            PlayerSettings.allowedAutorotateToPortrait = false;
            PlayerSettings.allowedAutorotateToPortraitUpsideDown = false;
            PlayerSettings.Android.renderOutsideSafeArea = true;
            EditorUserBuildSettings.buildAppBundle = false;
            Report(BuildPipeline.BuildPlayer(new BuildPlayerOptions
            {
                scenes = new[] { MAIN }, locationPathName = "Builds/Android/ZeroStar.apk", target = BuildTarget.Android, options = BuildOptions.None,
            }));
        }
    }
}
