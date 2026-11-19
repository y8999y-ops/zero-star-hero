// 開發用：用 Unity Recorder 錄實機影片（MP4）。進 Play Mode，照比對腳本自動玩（GameRoot 的 -shot 模式），錄滿秒數就存檔、關掉編輯器。
// 執行（要有畫面，不能 -batchmode）：
//   Unity.exe -projectPath <unity> -executeMethod ZeroStar.EditorTools.RecordPlay.Run -shot <暫存資料夾> -shotat 999999
//   環境變數：TRACE_SCRIPT（自動玩的腳本：場景、天氣、時間、按鍵）、REC_OUT（輸出檔，不含副檔名）、REC_SECONDS（秒數，預設 18）、
//            REC_SNOW（開場的積雪程度 0～1，錄融雪用）、REC_W／REC_H（解析度，預設 1152×648）、REC_FPS（預設 60）
// 錄影是固定影格時間（Recorder 的 Constant＋Cap），電腦慢也不會掉格；遊戲的時間照影格走。
using System;
using System.IO;
using UnityEditor;
using UnityEditor.Recorder;
using UnityEditor.Recorder.Encoder;
using UnityEditor.Recorder.Input;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace ZeroStar.EditorTools
{
    [InitializeOnLoad]
    public static class RecordPlay
    {
        const string KEY = "ZeroStar.RecordPlay";
        static RecorderController controller;
        static int startFrame, stopAt, exitAt = -1;

        static RecordPlay()
        {
            EditorApplication.playModeStateChanged += OnPlayMode;
        }

        static string Env(string k, string d) => Environment.GetEnvironmentVariable(k) ?? d;

        public static void Run()
        {
            SessionState.SetBool(KEY, true);
            EditorSceneManager.OpenScene("Assets/Scenes/Main.unity");
            EditorApplication.EnterPlaymode();
        }

        static void OnPlayMode(PlayModeStateChange s)
        {
            if (s != PlayModeStateChange.EnteredPlayMode || !SessionState.GetBool(KEY, false)) return;
            SessionState.SetBool(KEY, false);
            var rs = Environment.GetEnvironmentVariable("REC_SNOW");   // 開場的積雪程度（錄融雪用）
            if (rs != null) { TownSnow.CoverStart = double.Parse(rs, System.Globalization.CultureInfo.InvariantCulture); TownSnow.Reset(); }
            int w = int.Parse(Env("REC_W", "1152")), h = int.Parse(Env("REC_H", "648"));
            float fps = float.Parse(Env("REC_FPS", "60"), System.Globalization.CultureInfo.InvariantCulture);
            float seconds = float.Parse(Env("REC_SECONDS", "18"), System.Globalization.CultureInfo.InvariantCulture);
            string outFile = Env("REC_OUT", Path.Combine(Directory.GetParent(Application.dataPath).FullName, "Golden", "rec", "play"));
            Directory.CreateDirectory(Path.GetDirectoryName(outFile));

            var cs = ScriptableObject.CreateInstance<RecorderControllerSettings>();
            var movie = ScriptableObject.CreateInstance<MovieRecorderSettings>();
            movie.name = "ZeroStar";
            movie.Enabled = true;
            movie.EncoderSettings = new CoreEncoderSettings { Codec = CoreEncoderSettings.OutputCodec.MP4, EncodingQuality = CoreEncoderSettings.VideoEncodingQuality.High };
            movie.CaptureAudio = false;
            movie.ImageInputSettings = new GameViewInputSettings { OutputWidth = w, OutputHeight = h };
            movie.OutputFile = outFile;
            cs.AddRecorderSettings(movie);
            cs.SetRecordModeToManual();
            cs.FrameRatePlayback = FrameRatePlayback.Constant;
            cs.FrameRate = fps;
            cs.CapFrameRate = true;
            controller = new RecorderController(cs);
            controller.PrepareRecording();
            controller.StartRecording();
            startFrame = Time.frameCount; stopAt = startFrame + Mathf.RoundToInt(seconds * fps);
            Debug.Log($"[RecordPlay] 開始錄 {w}×{h} {fps} fps {seconds} 秒 → {outFile}.mp4");
            EditorApplication.update += Tick;
        }

        static void Tick()
        {
            if (controller != null && Time.frameCount >= stopAt)
            {
                controller.StopRecording(); controller = null;
                Debug.Log($"[RecordPlay] 錄好了（{stopAt - startFrame} 格）");
                exitAt = Time.frameCount + 5;
                return;
            }
            if (exitAt >= 0 && Time.frameCount >= exitAt)
            {
                EditorApplication.update -= Tick; exitAt = -1;
                EditorApplication.ExitPlaymode();
                EditorApplication.delayCall += () => EditorApplication.Exit(0);
            }
        }
    }
}
