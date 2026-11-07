// 軟體合成器的零件（audio.js 用 Web Audio 現成的節點，這裡自己一個一個樣本算出來）：
//   SynthWave   波形種類（方波 12.5%／25%／50%、三角波、鋸齒波、正弦波）
//   SynthTables 波形表：先用傅立葉級數把一個週期畫好；音越高、能放的泛音越少（不然高音會有刺耳的「折返雜音」），跟 Web Audio 的 PeriodicWave 一樣
//   SynthParam  一條會變的數值（音高、音量、濾波頻率）：照 setValueAtTime／exponentialRampToValueAtTime 的規則走
//   SynthBiquad 濾波器（低通、高通、帶通），公式跟 Web Audio 的 BiquadFilterNode 規格一樣
//   SynthLimiter 總輸出前面的壓縮器（網頁版：門檻 -6dB、膝 6dB、比例 12、起音 3ms、釋放 0.2 秒），聲音太大時把它壓下來不破音
//   SynthVoice  一個正在響的音（一個振盪器或一段雜訊，加上它的音量包絡、濾波器）
//   AudioRnd    聲音自己的亂數（audio.js 的 arnd）：不碰遊戲的 Rnd，比對測試的亂數順序才不會被聲音打亂
using System;
using System.Collections.Generic;

namespace ZeroStar
{
    public enum SynthWave { Sq12, Sq25, Sq50, Tri, Saw, Sine }
    public enum SynthFilt { Lowpass, Highpass, Bandpass }

    /// 聲音專用亂數（照抄 audio.js 的 arnd：mulberry32，種子 0x2f6b1d3）。音效在遊戲執行緒、音樂在聲音執行緒都會用到，所以上鎖。
    public sealed class AudioRnd
    {
        uint seed;
        readonly object gate = new object();
        public AudioRnd(uint s = 0x2f6b1d3) { seed = s; }
        public double Next()
        {
            lock (gate)
            {
                seed += 0x6d2b79f5;
                uint t = seed;
                t = (t ^ (t >> 15)) * (t | 1);
                t ^= t + (t ^ (t >> 7)) * (t | 61);
                return (t ^ (t >> 14)) / 4294967296.0;
            }
        }
    }

    /// 波形表。每種波形準備好幾張表：只有 1 個泛音、2 個、3 個……一直到全部。播放時看音高挑「最高泛音不超過一半取樣率」的那張。
    public static class SynthTables
    {
        public const int N = 4096;   // 一個週期切幾格
        public sealed class Bank
        {
            public float[][] Levels;   // 每張表長 N+1（最後一格＝第一格，內插時不用繞回去）
            public int[] Lut;          // 「最多可以放 h 個泛音」→ 用第幾張表
            public int MaxH;
        }
        static readonly Bank[] banks = new Bank[6];

        static SynthTables()
        {
            // 方波：audio.js 的 pulse(duty) 用 32 個係數（第 1～31 個泛音）做 PeriodicWave
            Func<double, Func<int, double>> pulse = duty => k => 2 / (k * Math.PI) * Math.Sin(k * Math.PI * duty);
            banks[(int)SynthWave.Sq12] = Build(pulse(0.125), 31);
            banks[(int)SynthWave.Sq25] = Build(pulse(0.25), 31);
            banks[(int)SynthWave.Sq50] = Build(pulse(0.5), 31);
            // 三角波、鋸齒波：Web Audio 內建波形的傅立葉係數（規格書寫的）
            banks[(int)SynthWave.Tri] = Build(k => 8 * Math.Sin(k * Math.PI / 2) / (Math.PI * k * Math.PI * k), 1024);
            banks[(int)SynthWave.Saw] = Build(k => 2 / (k * Math.PI) * ((k & 1) == 1 ? 1 : -1), 1024);
            banks[(int)SynthWave.Sine] = Build(k => k == 1 ? 1 : 0, 1);
        }
        public static Bank Get(SynthWave w) => banks[(int)w];

        static Bank Build(Func<int, double> coef, int maxH)
        {
            // 要做哪幾張：泛音數 1、1.26、1.59、2……（每 1/3 個八度一張）一直到 maxH
            var counts = new List<int>();
            for (int i = 0; ; i++)
            {
                int h = (int)Math.Floor(Math.Pow(2, i / 3.0));
                if (h >= maxH) break;
                if (counts.Count == 0 || counts[counts.Count - 1] != h) counts.Add(h);
            }
            counts.Add(maxH);
            var sin = new double[N];
            for (int j = 0; j < N; j++) sin[j] = Math.Sin(2 * Math.PI * j / N);
            var sum = new double[N];
            var raw = new List<double[]>();
            int done = 0;
            foreach (int c in counts)
            {
                for (int k = done + 1; k <= c; k++)
                {
                    double b = coef(k);
                    if (b == 0) continue;
                    for (int j = 0; j < N; j++) sum[j] += b * sin[(int)(((long)k * j) % N)];
                }
                done = c;
                raw.Add((double[])sum.Clone());
            }
            // 正規化：跟 Web Audio 一樣，用「全部泛音」那張的最高點當 1，所有表都乘同一個倍數
            double peak = 0;
            foreach (double v in raw[raw.Count - 1]) peak = Math.Max(peak, Math.Abs(v));
            double scale = peak > 0 ? 1 / peak : 1;
            var bank = new Bank { Levels = new float[raw.Count][], Lut = new int[maxH + 1], MaxH = maxH };
            for (int l = 0; l < raw.Count; l++)
            {
                var t = new float[N + 1];
                for (int j = 0; j < N; j++) t[j] = (float)(raw[l][j] * scale);
                t[N] = t[0];
                bank.Levels[l] = t;
            }
            for (int h = 0; h <= maxH; h++)
            {
                int best = 0;
                for (int l = 0; l < counts.Count; l++) if (counts[l] <= h) best = l;
                bank.Lut[h] = best;
            }
            return bank;
        }
    }

    /// 一條自動變化的數值。事件：在某時間「直接設成」某值，或「從上一個事件開始，指數滑到」某值（Web Audio 的規則：滑完就停在那個值）。
    /// 每呼叫一次 Next() 走一個樣本（從聲音開始那一刻算起）。
    public sealed class SynthParam
    {
        readonly long[] pos; readonly double[] val; readonly bool[] ramp; readonly int n;
        int k; long s; double cur, mul = 1;
        public bool Constant => n <= 1;

        /// ev：(秒, 值, 是不是滑過去)。時間相同的照加進來的順序。
        public SynthParam(List<(double t, double v, bool ramp)> ev, double sr, double initial)
        {
            var sorted = new List<(double t, double v, bool ramp, int i)>();
            for (int i = 0; i < ev.Count; i++) sorted.Add((ev[i].t, ev[i].v, ev[i].ramp, i));
            sorted.Sort((a, b) => a.t != b.t ? a.t.CompareTo(b.t) : a.i.CompareTo(b.i));   // 穩定排序
            n = sorted.Count; pos = new long[n]; val = new double[n]; ramp = new bool[n];
            for (int i = 0; i < n; i++) { pos[i] = (long)Math.Round(sorted[i].t * sr); val[i] = sorted[i].v; ramp[i] = sorted[i].ramp; }
            cur = initial;
        }

        public double Next()
        {
            while (k < n && pos[k] <= s)
            {
                cur = val[k]; k++;
                // 下一個事件如果是「滑過去」，算出每個樣本要乘多少（指數滑動＝每一步乘同一個倍數）
                if (k < n && ramp[k])
                {
                    long len = pos[k] - pos[k - 1];
                    mul = len > 0 && cur > 0 && val[k] > 0 ? Math.Pow(val[k] / cur, 1.0 / len) : 1;
                }
                else mul = 1;
            }
            double v = cur;
            cur *= mul; s++;
            return v;
        }
    }

    /// 雙二階濾波器（RBJ 公式，跟 Web Audio 規格一樣：低通／高通的 Q 是分貝，帶通的 Q 是倍數）。
    public sealed class SynthBiquad
    {
        readonly SynthFilt type; readonly double q, sr;
        double b0, b1, b2, a1, a2, z1, z2;
        public SynthBiquad(SynthFilt type, double q, double sr) { this.type = type; this.q = q; this.sr = sr; }

        public void Set(double f)
        {
            double nyq = sr / 2;
            f = Math.Max(1, Math.Min(nyq * 0.9999, f));
            double w0 = 2 * Math.PI * f / sr, cs = Math.Cos(w0), sn = Math.Sin(w0);
            double alpha, a0;
            switch (type)
            {
                case SynthFilt.Lowpass:
                    alpha = sn / (2 * Math.Pow(10, q / 20));
                    a0 = 1 + alpha;
                    b0 = (1 - cs) / 2 / a0; b1 = (1 - cs) / a0; b2 = b0;
                    break;
                case SynthFilt.Highpass:
                    alpha = sn / (2 * Math.Pow(10, q / 20));
                    a0 = 1 + alpha;
                    b0 = (1 + cs) / 2 / a0; b1 = -(1 + cs) / a0; b2 = b0;
                    break;
                default:
                    alpha = sn / (2 * Math.Max(1e-4, q));
                    a0 = 1 + alpha;
                    b0 = alpha / a0; b1 = 0; b2 = -alpha / a0;
                    break;
            }
            a1 = -2 * cs / a0; a2 = (1 - alpha) / a0;
        }

        public double Process(double x)
        {
            double y = b0 * x + z1;
            z1 = b1 * x - a1 * y + z2;
            z2 = b2 * x - a2 * y;
            return y;
        }
    }

    /// 總輸出的壓縮器（近似 Web Audio 的 DynamicsCompressor）：
    ///   靜態曲線照 Chrome（WebKit）的做法：門檻以下不動；門檻到「門檻＋膝」之間用一條指數曲線慢慢彎；再上面每大 12dB 只大 1dB。
    ///   補償增益也照它：整體放大 (1 / 曲線(1))^0.6 倍（所以網頁版其實整體大聲約 2dB，這裡一樣）。
    ///   起音 3ms、釋放 0.2 秒用簡單的一階平滑（Chrome 的釋放比較複雜，聽感差不多）。預看 6ms；最後保險不讓它超過 ±1。
    public sealed class SynthLimiter
    {
        const double THRESH_DB = -6, KNEE_DB = 6, RATIO = 12, ATTACK = 0.003, RELEASE = 0.2;
        readonly double linThresh, linKneeEnd, kneeEndOutDb, k, makeup, att, rel;
        double grDb;   // 現在壓掉幾 dB（0 或負數）
        public long Clipped;     // 被最後那道 ±1 切到的樣本數（檢查用，應該永遠是 0）
        public long SafetyHits;  // 壓縮器來不及、靠「保險」當場壓下來的樣本數（檢查用）
        readonly double[] delay; int di;

        public SynthLimiter(double sr)
        {
            linThresh = Db2Lin(THRESH_DB); linKneeEnd = Db2Lin(THRESH_DB + KNEE_DB);
            // 找 k：膝的終點斜率要剛好是 1/比例（二分法）
            double lo = 0.1, hi = 10000;
            for (int i = 0; i < 100; i++)
            {
                double mid = Math.Sqrt(lo * hi);
                double y = KneeCurve(linKneeEnd, mid);
                double slope = Math.Exp(-mid * (linKneeEnd - linThresh)) * linKneeEnd / y;   // dB 斜率
                if (slope > 1 / RATIO) lo = mid; else hi = mid;
            }
            k = Math.Sqrt(lo * hi);
            kneeEndOutDb = Lin2Db(KneeCurve(linKneeEnd, k));
            makeup = Math.Pow(1 / Curve(1), 0.6);
            att = Math.Exp(-1 / (ATTACK * sr)); rel = Math.Exp(-1 / (RELEASE * sr));
            delay = new double[Math.Max(1, (int)Math.Round(0.006 * sr))];
        }
        static double Db2Lin(double db) => Math.Pow(10, db / 20);
        static double Lin2Db(double x) => 20 * Math.Log10(Math.Max(1e-12, x));
        double KneeCurve(double x, double kk) => x < linThresh ? x : linThresh + (1 - Math.Exp(-kk * (x - linThresh))) / kk;
        /// 靜態曲線：輸入振幅 → 輸出振幅
        public double Curve(double x)
        {
            if (x <= linThresh) return x;
            if (x < linKneeEnd) return KneeCurve(x, k);
            return Db2Lin(kneeEndOutDb + (Lin2Db(x) - (THRESH_DB + KNEE_DB)) / RATIO);
        }

        public float Process(double x)
        {
            // 偵測看「現在」的樣本，輸出的是 6ms 前的樣本（Chrome 的壓縮器也有 6ms 的預看），音頭還沒出去之前就先壓好
            double a = Math.Abs(x);
            double target = a > linThresh ? Lin2Db(Curve(a)) - Lin2Db(a) : 0;
            grDb = target < grDb ? target + (grDb - target) * att : target + (grDb - target) * rel;
            double xd = delay[di]; delay[di] = x; if (++di >= delay.Length) di = 0;
            double y = xd * makeup * (grDb < -1e-9 ? Db2Lin(grDb) : 1);
            // 保險：還是超過 0.999 的話，當場把壓縮量加到剛好不超過（之後照釋放時間慢慢放開）
            double ay = Math.Abs(y);
            if (ay > 0.999) { grDb += Lin2Db(0.999 / ay); y *= 0.999 / ay; SafetyHits++; }
            if (y > 1) { y = 1; Clipped++; } else if (y < -1) { y = -1; Clipped++; }
            return (float)y;
        }
    }

    /// 要播的一個音的參數（audio.js 的 tone() 或 hiss() 的 o）
    public sealed class VoiceSpec
    {
        public bool Noise;                 // true＝雜訊（hiss）
        public SynthWave Wave;
        public double F0, F1, Dur, At, Vol, Lp, VibRate, VibDepth;
        public double[] Arp;               // [秒, 倍數, 秒, 倍數, ...]
        public SynthFilt Filt; public double Q;   // 雜訊的濾波器
        public double NoiseOffset;         // 雜訊從 loop 的第幾秒開始（arnd()*0.5）
        public double Delay;               // 比「現在」晚幾秒開始（升級音、寶箱音那種一串音）
        public int Bus;                    // 0＝音效，1＝音樂
    }

    /// 一個正在響的音
    public sealed class SynthVoice
    {
        public long Start, End;
        public int Bus;
        public SynthScore Score;          // 開場配樂的音：跟著那首配樂的淡出
        readonly double sr, nyq;
        readonly bool noise;
        readonly SynthTables.Bank bank;
        readonly SynthParam freq, gain, filtF;
        readonly SynthBiquad filt;
        readonly double vibW, vibDepth;
        readonly float[] noiseBuf; readonly long noiseOff;
        double phase; long s; int filtCount;

        public SynthVoice(VoiceSpec o, long start, double sr, float[] noiseBuf)
        {
            this.sr = sr; nyq = sr / 2; Start = start; Bus = o.Bus; noise = o.Noise;
            // 音量包絡：0.0001 → at 秒時到 vol → dur 秒時回到 0.0001（都是指數滑動）
            gain = new SynthParam(new List<(double, double, bool)> { (0, 0.0001, false), (o.At, o.Vol, true), (o.Dur, 0.0001, true) }, sr, 1);
            End = start + (long)Math.Round((o.Dur + 0.02) * sr);   // osc.stop(t + dur + 0.02)
            if (noise)
            {
                this.noiseBuf = noiseBuf;
                noiseOff = (long)Math.Round(o.NoiseOffset * sr);
                filt = new SynthBiquad(o.Filt, o.Q, sr);
                var fe = new List<(double, double, bool)> { (0, o.F0, false) };
                if (o.F1 != 0) fe.Add((o.Dur, o.F1, true));
                filtF = new SynthParam(fe, sr, o.F0);
            }
            else
            {
                bank = SynthTables.Get(o.Wave);
                var fe = new List<(double, double, bool)> { (0, o.F0, false) };
                if (o.F1 != 0) fe.Add((o.Dur, Math.Max(20, o.F1), true));
                if (o.Arp != null) for (int i = 0; i + 1 < o.Arp.Length; i += 2) fe.Add((o.Arp[i], o.F0 * o.Arp[i + 1], false));
                freq = new SynthParam(fe, sr, o.F0);
                if (o.VibRate != 0) { vibW = 2 * Math.PI * o.VibRate / sr; vibDepth = o.VibDepth; }
                if (o.Lp != 0) { filt = new SynthBiquad(SynthFilt.Lowpass, 1, sr); filt.Set(o.Lp); }   // tone 的低通：Q 用預設 1
            }
        }

        /// 把 [i0, i1) 這幾個樣本加進 buf（i 是這一塊裡的位置）
        public void Render(float[] buf, int i0, int i1)
        {
            for (int i = i0; i < i1; i++)
            {
                double y, g = gain.Next();
                if (noise)
                {
                    // 雜訊 → 濾波器 → 音量（網頁版的接法）
                    if (filtCount-- <= 0) { filt.Set(filtF.Next()); filtCount = 7; } else filtF.Next();   // 濾波頻率每 8 個樣本更新一次
                    y = filt.Process(noiseBuf[(int)((noiseOff + s) % noiseBuf.Length)]) * g;
                }
                else
                {
                    double f = freq.Next();
                    if (vibW != 0) f += vibDepth * Math.Sin(vibW * s);   // 顫音：直接加在頻率上（Hz）
                    double af = Math.Abs(f);
                    int h = af > 0 ? (int)Math.Min(bank.MaxH, nyq / af) : bank.MaxH;
                    var t = bank.Levels[bank.Lut[h]];
                    double p = phase * SynthTables.N;
                    int j = (int)p;
                    y = t[j] + (t[j + 1] - t[j]) * (p - j);
                    phase += f / sr;
                    phase -= Math.Floor(phase);
                    y *= g;                                   // 振盪器 → 音量 → 低通（網頁版的接法）
                    if (filt != null) y = filt.Process(y);
                }
                buf[i] += (float)y;
                s++;
            }
        }
    }
}
