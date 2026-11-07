// 合成器本體（audio.js 搬過來）：收「要播什麼」的指令、排時間、把所有正在響的音一個樣本一個樣本加起來。
//   時間：用「聲音時鐘」（從開始到現在算了幾個樣本，像 Web Audio 的 currentTime），音樂的 16 分音符格子、升級音那種一串音都對到同一個樣本，不會因為畫面卡一下就歪掉。
//   執行緒：遊戲那邊（Sfx、Music……）只把指令丟進一個排隊用的佇列；聲音執行緒（Render）每一塊開頭把佇列拿出來處理。兩邊不會同時改到同一個東西。
//   不用 AudioSource 也能跑：編輯器的離線算圖（AudioRender）直接 new 一個、呼叫 Render。
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;

namespace ZeroStar
{
    /// 開場配樂（introMusic 的回傳值）：Stop() 會在 0.4 秒內淡出
    public sealed class SynthScore
    {
        internal (double t, VoiceSpec o)[] Ev;
        internal int I;
        internal double T0 = -1;          // 開始的聲音時鐘（秒）
        internal long FadeStart = -1;     // 開始淡出的樣本
        internal volatile bool StopReq;
        internal bool Dead, Started;
        internal int Voices;
        internal float[] Buf, Gain;
        readonly SynthEngine owner;
        internal SynthScore(SynthEngine owner) { this.owner = owner; }
        public void Stop() { if (StopReq) return; StopReq = true; owner?.Enqueue(new SynthEngine.CmdStop { S = this }); }
    }

    public sealed partial class SynthEngine
    {
        public readonly int SampleRate;
        const int BLOCK = 256;

        // ---- 指令（遊戲執行緒 → 聲音執行緒）
        internal sealed class CmdVoices { public VoiceSpec[] List; }
        internal sealed class CmdMusic { public string Name; }
        internal sealed class CmdTempo { public double K; }
        internal sealed class CmdScore { public SynthScore S; }
        internal sealed class CmdStop { public SynthScore S; }
        readonly ConcurrentQueue<object> cmds = new ConcurrentQueue<object>();
        internal void Enqueue(object c) => cmds.Enqueue(c);

        // ---- 音量（哪個執行緒改都可以）
        volatile float volMusic = 0.55f, volSfx = 0.8f; volatile bool mute;
        public bool Muted => mute;
        /// 打擊音的音高倍數（main.js 每格依連擊數設：每 5 連擊升半音，最多升 8 個半音）。遊戲執行緒用。
        public double HitTuneK = 1;

        // ---- 聲音執行緒自己的東西
        readonly List<SynthVoice> voices = new List<SynthVoice>();
        readonly List<SynthScore> scores = new List<SynthScore>();
        readonly float[] sfxBuf = new float[BLOCK], musBuf = new float[BLOCK];
        readonly float[] noise;
        readonly SynthLimiter lim;
        readonly AudioRnd rnd = new AudioRnd();
        long clock;                       // 聲音時鐘（樣本數）
        Song song; long step; double nextT, tempoK = 1;

        // ---- 遊戲執行緒自己的東西
        string songName = "";

        public SynthEngine(int sampleRate)
        {
            SampleRate = sampleRate;
            lim = new SynthLimiter(sampleRate);
            // 雜訊：一秒長、會一直 loop 的白雜訊（網頁版第一次用到才做，這裡一開始就做好）
            noise = new float[sampleRate];
            for (int i = 0; i < noise.Length; i++) noise[i] = (float)(rnd.Next() * 2 - 1);
        }

        /// 聲音時鐘（秒），像 Web Audio 的 currentTime
        public double Now => clock / (double)SampleRate;
        public long ClippedSamples => lim.Clipped;
        public long LimiterSafetyHits => lim.SafetyHits;
        public int ActiveVoices => voices.Count;

        public void Apply(float music, float sfx, bool mute) { volMusic = music; volSfx = sfx; this.mute = mute; }

        // ================= 遊戲執行緒的 API =================
        /// 播一個音效：Sfx("jump")、Sfx("land", true)
        public void Sfx(string name, params object[] args)
        {
            if (mute || name == null) return;
            var L = new List<VoiceSpec>();
            if (!BuildSfx(L, name, args) || L.Count == 0) return;
            cmds.Enqueue(new CmdVoices { List = L.ToArray() });
        }
        /// 對話的打字聲；delay＝晚幾秒響（props.js 用 setTimeout 排的那種「叮、叮」）
        public void Blip(double freq, string type = "square", double delay = 0)
        {
            if (mute) return;
            var L = new List<VoiceSpec>();
            var w = type == "square" ? SynthWave.Sq50 : type == "triangle" ? SynthWave.Tri : type == "sawtooth" ? SynthWave.Saw : SynthWave.Sine;
            T(L, w, freq * R(), 0.05, 0.08, delay: delay);
            cmds.Enqueue(new CmdVoices { List = L.ToArray() });
        }
        /// 換背景音樂（同一首就不重來）；null＝停止
        public void Music(string name)
        {
            if (name == songName) return;
            songName = name;
            cmds.Enqueue(new CmdMusic { Name = name });
        }
        public string MusicNow => songName;
        /// 王戰第三階段：音樂加快
        public void Tempo(double k) => cmds.Enqueue(new CmdTempo { K = k });
        /// 過關的小號曲（一次）
        public void Jingle(string kind = "clear")
        {
            Music(null);
            var L = new List<VoiceSpec>();
            double[][] notes = kind == "clear"
                ? new[] { new[] { 72, 0.0 }, new[] { 76, 0.12 }, new[] { 79, 0.24 }, new[] { 84, 0.36 }, new[] { 79, 0.6 }, new[] { 84, 0.72 } }
                : new[] { new[] { 72, 0.0 }, new[] { 79, 0.15 }, new[] { 84, 0.3 } };
            foreach (var nd in notes) T(L, SynthWave.Sq25, Midi(nd[0]), nd[1] == 0.72 ? 0.7 : 0.14, 0.12, delay: 0.05 + nd[1], bus: 1);
            T(L, SynthWave.Tri, Midi(48), 1.2, 0.25, delay: 0.05, bus: 1);
            T(L, SynthWave.Tri, Midi(55), 0.7, 0.2, delay: 0.65, bus: 1);
            cmds.Enqueue(new CmdVoices { List = L.ToArray() });
        }
        /// 開場動畫的配樂（跟 Intro 的時間表對齊）。回傳的東西 Stop() 可以淡出停掉。
        public SynthScore IntroMusic()
        {
            var sc = new SynthScore(this);
            if (mute) { sc.StopReq = true; return sc; }
            sc.Ev = BuildIntro();
            cmds.Enqueue(new CmdScore { S = sc });
            return sc;
        }

        // ================= 聲音執行緒：算出 frames 個樣本（單聲道） =================
        public void Render(float[] output, int frames)
        {
            int done = 0;
            while (done < frames)
            {
                int n = Math.Min(BLOCK, frames - done);
                RenderBlock(output, done, n);
                done += n;
            }
        }

        void RenderBlock(float[] output, int off, int n)
        {
            long b0 = clock, b1 = clock + n;
            Drain(b0);
            ScheduleMusic(b1);
            ScheduleScores(b1);
            Array.Clear(sfxBuf, 0, n); Array.Clear(musBuf, 0, n);
            // 開場配樂的音量（淡出用）
            foreach (var sc in scores)
            {
                Array.Clear(sc.Buf, 0, n);
                for (int i = 0; i < n; i++)
                {
                    long s = b0 + i;
                    sc.Gain[i] = sc.FadeStart < 0 ? 1f : (float)Math.Max(0, 1 - (s - sc.FadeStart) / (0.4 * SampleRate));
                }
                if (sc.FadeStart >= 0 && b0 - sc.FadeStart >= (long)(0.6 * SampleRate)) sc.Dead = true;   // 0.6 秒後拔掉
            }
            for (int v = 0; v < voices.Count; v++)
            {
                var vo = voices[v];
                if (vo.Start >= b1) continue;
                int i0 = (int)Math.Max(0, vo.Start - b0), i1 = (int)Math.Min(n, vo.End - b0);
                if (i1 <= i0) continue;
                vo.Render(vo.Score != null ? vo.Score.Buf : vo.Bus == 0 ? sfxBuf : musBuf, i0, i1);
            }
            for (int v = voices.Count - 1; v >= 0; v--)
            {
                var vo = voices[v];
                if (vo.End <= b1 || (vo.Score != null && vo.Score.Dead)) { if (vo.Score != null) vo.Score.Voices--; voices.RemoveAt(v); }
            }
            foreach (var sc in scores) for (int i = 0; i < n; i++) musBuf[i] += sc.Buf[i] * sc.Gain[i];
            scores.RemoveAll(sc => sc.Dead || (sc.Started && sc.I >= sc.Ev.Length && sc.Voices <= 0));
            // 匯流排音量：音效 vol.sfx*0.9、音樂 vol.music*2.5、靜音時總音量 0
            float gS = volSfx * 0.9f, gM = volMusic * 2.5f, gMaster = mute ? 0f : 1f;
            for (int i = 0; i < n; i++)
            {
                double x = (sfxBuf[i] * gS + musBuf[i] * gM) * gMaster;
                if (double.IsNaN(x) || double.IsInfinity(x)) x = 0;
                output[off + i] = lim.Process(x);
            }
            clock = b1;
        }

        void Drain(long b0)
        {
            double now = b0 / (double)SampleRate;
            while (cmds.TryDequeue(out var c))
            {
                switch (c)
                {
                    case CmdVoices cv:
                        foreach (var o in cv.List) AddVoice(o, now + o.Delay, null);
                        break;
                    case CmdMusic cm:
                        song = cm.Name != null && SONGS.TryGetValue(cm.Name, out var sg) ? sg : null;
                        if (song != null) { step = 0; tempoK = 1; nextT = now + 0.08; }
                        break;
                    case CmdTempo ct: tempoK = ct.K; break;
                    case CmdScore cs:
                        var sc = cs.S;
                        sc.T0 = now + 0.05; sc.Started = true; sc.Buf = new float[BLOCK]; sc.Gain = new float[BLOCK];
                        if (sc.StopReq) { sc.FadeStart = b0; }
                        scores.Add(sc);
                        break;
                    case CmdStop cst:
                        if (cst.S.FadeStart < 0) cst.S.FadeStart = b0;
                        break;
                }
            }
        }

        void AddVoice(VoiceSpec o, double t, SynthScore sc)
        {
            long start = Math.Max(clock, (long)Math.Round(t * SampleRate));
            var v = new SynthVoice(o, start, SampleRate, noise) { Score = sc };
            if (sc != null) sc.Voices++;
            voices.Add(v);
        }

        void ScheduleScores(long b1)
        {
            double tEnd = b1 / (double)SampleRate;
            foreach (var sc in scores)
            {
                if (sc.FadeStart >= 0) continue;   // 停了就不再排新的音
                while (sc.I < sc.Ev.Length && sc.T0 + sc.Ev[sc.I].t < tEnd)
                {
                    var e = sc.Ev[sc.I++];
                    if (e.o.Noise) e.o.NoiseOffset = rnd.Next() * 0.5;
                    AddVoice(e.o, sc.T0 + e.t, sc);
                }
            }
        }

        // ================= 小工具 =================
        static double Midi(double n) => 440 * Math.Pow(2, (n - 69) / 12);
        /// 每次播放的小變化：1 ± k
        double R(double k = 0.04) => 1 + (rnd.Next() - 0.5) * 2 * k;

        /// 一個音（tone）：預設 at 0.005、vol 0.3
        static void T(List<VoiceSpec> L, SynthWave w, double f0, double dur, double vol = 0.3, double f1 = 0, double at = 0.005, double lp = 0,
            double vr = 0, double vd = 0, double[] arp = null, double delay = 0, int bus = 0)
        {
            L.Add(new VoiceSpec { Wave = w, F0 = f0, F1 = f1, Dur = dur, Vol = vol, At = at, Lp = lp, VibRate = vr, VibDepth = vd, Arp = arp, Delay = delay, Bus = bus });
        }
        /// 雜訊（hiss）：預設 vol 0.3、低通、f0 2000、q 0.8、at 0.003
        void N(List<VoiceSpec> L, double dur, double vol = 0.3, SynthFilt type = SynthFilt.Lowpass, double f0 = 2000, double f1 = 0, double q = 0.8,
            double at = 0.003, double delay = 0, int bus = 0)
        {
            L.Add(new VoiceSpec { Noise = true, Dur = dur, Vol = vol, Filt = type, F0 = f0, F1 = f1, Q = q, At = at, Delay = delay, Bus = bus, NoiseOffset = rnd.Next() * 0.5 });
        }
    }
}
