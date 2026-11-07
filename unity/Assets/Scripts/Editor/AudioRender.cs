// 開發用：不開喇叭，直接叫合成器（SynthEngine.Render）把音效、背景音樂、開場配樂算成 WAV，檢查聲音正不正常。
//   輸出：unity/Golden/audio/*.wav（48000Hz 單聲道 16 位元）＋ summary.tsv（長度、RMS、最大值、NaN、被切到的樣本數）
//   檢查：沒有 NaN、不是無聲、壓縮器之後沒有超過 ±1 被切掉的樣本。有問題會在 log 印 "AUDIO FAIL"。
//   音量用網頁版的預設（音樂 0.55、音效 0.8），方便跟網頁版的離線算圖比。
//   執行：Unity.exe -batchmode -nographics -projectPath unity -executeMethod PixelFX.Tests.AudioRender.Run -quit
using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using UnityEditor;
using UnityEngine;
using ZeroStar;

namespace PixelFX.Tests
{
    public static class AudioRender
    {
        const int SR = 48000;

        [MenuItem("零星工具/聲音離線算圖")]
        public static void Run()
        {
            string outDir = Path.Combine(Directory.GetParent(Application.dataPath).FullName, "Golden", "audio");
            Directory.CreateDirectory(outDir);
            var sb = new StringBuilder("name\tseconds\tactive_s\trms_db\tpeak\tnan\tclipped\tsafety\n");
            int fails = 0;

            // ---- 音效：每個一個新的合成器（時鐘從 0 開始）
            var jobs = new List<(string file, Action<SynthEngine> play, double secs)>();
            foreach (var n in SynthEngine.SFX_NAMES) { string nn = n; jobs.Add(("sfx-" + nn, e => e.Sfx(nn), 3.6)); }
            jobs.Add(("sfx-land-hard", e => e.Sfx("land", true), 1));
            jobs.Add(("sfx-swing-slime", e => e.Sfx("swing", "slime"), 1));
            jobs.Add(("sfx-swing-can", e => e.Sfx("swing", "can"), 1));
            jobs.Add(("sfx-shot-slime", e => e.Sfx("shot", "slime"), 1));
            jobs.Add(("sfx-chime-1318", e => e.Sfx("chime", 1318), 1));
            jobs.Add(("sfx-hitL-combo40", e => { e.HitTuneK = Math.Pow(2, 8 / 12.0); e.Sfx("hitL"); }, 1));
            jobs.Add(("blip-1320-sine", e => e.Blip(1320, "sine"), 0.5));
            jobs.Add(("blip-196-square", e => e.Blip(196, "square"), 0.5));
            jobs.Add(("jingle-clear", e => e.Jingle("clear"), 2.5));
            // ---- 背景音樂：每首 8 秒；王戰另外算一段加速的
            foreach (var s in new[] { "town", "stage", "boss" }) { string ss = s; jobs.Add(("music-" + ss, e => e.Music(ss), 8)); }
            jobs.Add(("music-boss-tempo108", e => { e.Music("boss"); e.Tempo(1.08); }, 8));
            // ---- 開場配樂整首（47 秒）
            jobs.Add(("intro-music", e => e.IntroMusic(), 47.5));

            foreach (var (file, play, secs) in jobs)
            {
                var e = new SynthEngine(SR);
                e.Apply(0.55f, 0.8f, false);
                play(e);
                var buf = new float[(int)(secs * SR)];
                e.Render(buf, buf.Length);
                var st = Stats(buf);
                bool bad = st.nan > 0 || st.active <= 0 || e.ClippedSamples > 0 || st.peak > 1.0001;
                if (bad) { fails++; Debug.LogError($"AUDIO FAIL {file}: nan={st.nan} active={st.active:0.000}s clipped={e.ClippedSamples} peak={st.peak:0.000}"); }
                int keep = Math.Min(buf.Length, st.last + SR / 20);
                WriteWav(Path.Combine(outDir, file + ".wav"), buf, Math.Max(keep, 1));
                sb.Append($"{file}\t{keep / (double)SR:0.000}\t{st.active:0.000}\t{st.rmsDb:0.0}\t{st.peak:0.000}\t{st.nan}\t{e.ClippedSamples}\t{e.LimiterSafetyHits}\n");
            }

            // ---- 壓縮器的靜態曲線（跟網頁版比對用）：輸入 dB → 輸出 dB（含補償增益）
            var lim = new SynthLimiter(SR);
            sb.Append("\n# limiter static curve (in_db -> out_db, includes makeup)\n");
            double makeup = Math.Pow(1 / lim.Curve(1), 0.6);
            foreach (double db in new[] { -24.0, -12, -6, -3, 0, 3, 6, 12 })
            {
                double x = Math.Pow(10, db / 20);
                sb.Append($"limiter\t{db}\t{20 * Math.Log10(lim.Curve(x) * makeup):0.00}\n");
            }

            File.WriteAllText(Path.Combine(outDir, "summary.tsv"), sb.ToString());
            Debug.Log("AUDIO RENDER " + (fails == 0 ? "OK" : $"FAILED x{fails}") + " → " + outDir + "\n" + sb);
        }

        /// 有聲音的範圍（超過 -60dB 的第一個到最後一個樣本）、那段的 RMS、最大值、NaN 數
        static (double active, double rmsDb, double peak, int nan, int first, int last) Stats(float[] b)
        {
            int nan = 0, first = -1, last = -1; double peak = 0;
            for (int i = 0; i < b.Length; i++)
            {
                float v = b[i];
                if (float.IsNaN(v) || float.IsInfinity(v)) { nan++; continue; }
                double a = Math.Abs(v);
                if (a > peak) peak = a;
                if (a > 0.001) { if (first < 0) first = i; last = i; }
            }
            if (first < 0) return (0, -999, peak, nan, 0, 0);
            double sum = 0;
            for (int i = first; i <= last; i++) if (!float.IsNaN(b[i])) sum += b[i] * (double)b[i];
            double rms = Math.Sqrt(sum / (last - first + 1));
            return ((last - first + 1) / (double)SR, 20 * Math.Log10(Math.Max(1e-9, rms)), peak, nan, first, last);
        }

        static void WriteWav(string path, float[] b, int n)
        {
            using (var w = new BinaryWriter(File.Create(path)))
            {
                w.Write(Encoding.ASCII.GetBytes("RIFF")); w.Write(36 + n * 2); w.Write(Encoding.ASCII.GetBytes("WAVE"));
                w.Write(Encoding.ASCII.GetBytes("fmt ")); w.Write(16); w.Write((short)1); w.Write((short)1); w.Write(SR); w.Write(SR * 2); w.Write((short)2); w.Write((short)16);
                w.Write(Encoding.ASCII.GetBytes("data")); w.Write(n * 2);
                for (int i = 0; i < n; i++) { float v = Mathf.Clamp(float.IsNaN(b[i]) ? 0 : b[i], -1, 1); w.Write((short)Mathf.RoundToInt(v * 32767)); }
            }
        }
    }
}
