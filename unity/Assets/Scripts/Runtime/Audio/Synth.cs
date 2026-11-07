// 聲音的入口（audio.js 的 sfx、blip、music、tempo、jingle、introMusic、hitTune、setVolume 搬過來）。全部即時合成，不用音檔。
//   Synth.Init()：開一個不會跟著換場景消失的 GameObject，上面掛一個 AudioSource 跟 SynthHost；
//     SynthHost 用 OnAudioFilterRead（Unity 的聲音執行緒每次要一小塊聲音就叫一次）把合成器算出來的聲音填進去。
//   遊戲這邊呼叫的東西都只是「排隊」，真正的計算在聲音執行緒；所以遊戲執行緒隨時可以叫，不會卡。
//   聲音用自己的亂數（AudioRnd），不碰遊戲的 Rnd：放不放聲音都不會改到怪物、掉寶的亂數順序。
//   音量：讀 ZeroStar.UI.Volume（設定面板存在 PlayerPrefs 的）；設定面板改了就叫 Synth.Apply(...)。
using UnityEngine;
using ZeroStar.UI;

namespace ZeroStar
{
    public static class Synth
    {
        static SynthEngine engine;
        static SynthHost host;
        static double hitK = 1;
        static float vMusic = 0.55f, vSfx = 0.8f; static bool vMute;

        public static bool Ready => engine != null;
        /// 給除錯／測試看：合成器本體
        public static SynthEngine Engine => engine;

        /// 開始（只做一次）：建立聲音用的 GameObject，讀設定的音量
        public static void Init()
        {
            if (host != null) return;
            var go = new GameObject("ZeroStarSynth");
            Object.DontDestroyOnLoad(go);
            var src = go.AddComponent<AudioSource>();
            src.playOnAwake = false; src.loop = true; src.spatialBlend = 0; src.volume = 1; src.priority = 0;
            src.bypassEffects = true; src.bypassListenerEffects = true; src.bypassReverbZones = true;
            int sr = AudioSettings.outputSampleRate;
            src.clip = AudioClip.Create("ZeroStarSynthSilence", sr, 1, sr, false);   // 一段無聲的 loop，讓 AudioSource 一直「在播」；真正的聲音在 OnAudioFilterRead 蓋上去
            vMusic = Volume.Music; vSfx = Volume.Sfx; vMute = Volume.Mute;
            engine = NewEngine(sr);
            host = go.AddComponent<SynthHost>();
            host.Engine = engine;
            src.Play();
            AudioSettings.OnAudioConfigurationChanged += OnConfigChanged;
        }

        static SynthEngine NewEngine(int sr)
        {
            var e = new SynthEngine(sr) { HitTuneK = hitK };
            e.Apply(vMusic, vSfx, vMute);
            return e;
        }

        // 換了喇叭／耳機（取樣率可能變了）：換一個新的合成器，原本的背景音樂接著放
        static void OnConfigChanged(bool deviceWasChanged)
        {
            if (host == null) return;
            string song = engine?.MusicNow;
            engine = NewEngine(AudioSettings.outputSampleRate);
            host.Engine = engine;
            var src = host.GetComponent<AudioSource>();
            if (src != null && !src.isPlaying) src.Play();
            if (!string.IsNullOrEmpty(song)) engine.Music(song);
        }

        /// 播一個音效（名字跟網頁版 sfx 一樣）：Synth.Sfx("jump")、Synth.Sfx("land", true)、Synth.Sfx("swing", "slime")、Synth.Sfx("chime", 1318)
        public static void Sfx(string name, params object[] args) => engine?.Sfx(name, args);
        /// 對話的打字聲（dialog.js 的 blip）：type＝"square"｜"triangle"｜"sawtooth"｜"sine"；delay＝晚幾秒響（取代 JS 的 setTimeout，對到樣本）
        public static void Blip(double freq, string type = "square", double delay = 0) => engine?.Blip(freq, type, delay);
        /// 換背景音樂（"town"、"stage"、"boss"；同一首不重來）；null＝停止
        public static void Music(string name) => engine?.Music(name);
        /// 現在在放哪一首（開場動畫播完要接回去）
        public static string MusicNow => engine?.MusicNow;
        /// 王戰第三階段：音樂加快（例如 1.08）
        public static void Tempo(double k) => engine?.Tempo(k);
        /// 過關的小號曲（會先停掉背景音樂）
        public static void Jingle(string kind = "clear") => engine?.Jingle(kind);
        /// 開場動畫的配樂；回傳的東西 .Stop() 可以淡出停掉（沒初始化或靜音時回傳一個什麼都不做的）
        public static SynthScore IntroMusic() => engine?.IntroMusic() ?? new SynthScore(null);
        /// 打擊音的音高倍數（連擊越高越高）：2^(min(8, floor(連擊/5))/12)
        public static double HitTuneK
        {
            get => hitK;
            set { hitK = value; if (engine != null) engine.HitTuneK = value; }
        }
        /// 設定面板改音量時叫（0～1）。靜音＝總音量 0，而且新的音效、開場配樂不會開始。
        public static void Apply(float music, float sfx, bool mute)
        {
            vMusic = music; vSfx = sfx; vMute = mute;
            engine?.Apply(music, sfx, mute);
        }
        /// 直接用 Volume（PlayerPrefs）裡現在的值
        public static void ApplySaved() => Apply(Volume.Music, Volume.Sfx, Volume.Mute);

        // ---- 接 Game.OnSfx 這種只有一個字串的地方用（Intro.cs 用 "music:intro"、"music:end"、"blip"）
        static SynthScore introScore; static string introPrev;
        /// 一個字串的路由：一般名字＝Sfx(name)；"名字:參數"＝Sfx(名字, 參數)；"music:intro"＝停掉現在的音樂、開始開場配樂；"music:end"＝停掉開場配樂、接回原本的音樂；"blip"＝系統的打字聲
        public static void Route(string name)
        {
            switch (name)
            {
                case "music:intro":
                    introScore?.Stop();
                    introPrev = MusicNow; Music(null);
                    introScore = IntroMusic();
                    break;
                case "music:end":
                    introScore?.Stop(); introScore = null;
                    if (!string.IsNullOrEmpty(introPrev)) Music(introPrev);
                    introPrev = null;
                    break;
                case "blip": Blip(1320, "sine"); break;   // 開場、系統訊息的打字聲（intro.js、main.js 都是 1320 正弦波）
                default:
                    // "名字:參數"：只能傳一個字串的地方也能帶參數，例如 "land:true"、"swing:slime"、"chime:1318"、"inhale:0.9"
                    int c = name == null ? -1 : name.IndexOf(':');
                    if (c > 0)
                    {
                        string n = name.Substring(0, c), a = name.Substring(c + 1);
                        object arg = a == "true" ? true : a == "false" ? (object)false
                            : double.TryParse(a, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out double d) ? d : (object)a;
                        Sfx(n, arg);
                    }
                    else Sfx(name);
                    break;
            }
        }
    }

    /// 掛在聲音 GameObject 上：Unity 的聲音執行緒要聲音時，叫合成器算一塊，複製到每個聲道（單聲道放到左右一樣大，跟 Web Audio 一樣）
    public sealed class SynthHost : MonoBehaviour
    {
        internal volatile SynthEngine Engine;
        float[] mono = new float[4096];

        void OnAudioFilterRead(float[] data, int channels)
        {
            var e = Engine;
            if (e == null || channels <= 0) return;
            int frames = data.Length / channels;
            if (mono.Length < frames) mono = new float[frames];
            e.Render(mono, frames);
            for (int f = 0, j = 0; f < frames; f++)
            {
                float v = mono[f];
                for (int c = 0; c < channels; c++) data[j++] = v;
            }
        }
    }
}
