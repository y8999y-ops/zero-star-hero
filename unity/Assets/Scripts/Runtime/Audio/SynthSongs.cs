// 音效清單、背景音樂、開場配樂（audio.js 的 S、SONGS、schedule()、introMusic() 照抄）。
//   音效照 sfxr 的做法：每種聲音是一組參數（波形、起訖音高、長度、包絡、濾波、琶音），每次播放帶一點隨機變化。
//   音樂照 NES 的分工：方波（25%）主旋律、方波（12.5%）琶音當和弦、三角波低音、雜訊打鼓；16 分音符一格。
using System;
using System.Collections.Generic;

namespace ZeroStar
{
    public sealed partial class SynthEngine
    {
        // ---- 傳進來的參數（JS 的 sfx(name, ...args)）
        static object Arg(object[] a, int i) => a != null && a.Length > i ? a[i] : null;
        static bool Truthy(object[] a, int i)
        {
            var x = Arg(a, i);
            switch (x)
            {
                case null: return false;
                case bool b: return b;
                case string s: return s.Length > 0;
                case IConvertible c: try { return Convert.ToDouble(c) != 0; } catch { return true; }
                default: return true;
            }
        }
        static double Num(object[] a, int i, double def)
        {
            var x = Arg(a, i);
            if (x == null) return def;
            try { return Convert.ToDouble(x); } catch { return def; }
        }
        static string Str(object[] a, int i) => Arg(a, i)?.ToString();

        /// 音效清單（audio.js 的 S）。找不到名字回傳 false。
        bool BuildSfx(List<VoiceSpec> L, string name, object[] a)
        {
            const SynthWave sq12 = SynthWave.Sq12, sq25 = SynthWave.Sq25, sq50 = SynthWave.Sq50, tri = SynthWave.Tri, saw = SynthWave.Saw, sine = SynthWave.Sine;
            const SynthFilt hp = SynthFilt.Highpass, bp = SynthFilt.Bandpass, lpf = SynthFilt.Lowpass;
            double k = HitTuneK;
            switch (name)
            {
                case "jump": T(L, sq25, 290 * R(), 0.12, 0.18, f1: 640); break;
                case "jump2": T(L, sq12, 440 * R(), 0.13, 0.16, f1: 960); T(L, tri, 1320, 0.08, 0.12, at: 0.02); break;
                case "land":
                    {
                        bool hard = Truthy(a, 0);
                        N(L, hard ? 0.12 : 0.07, hard ? 0.26 : 0.14, f0: 900, f1: 300);
                        if (hard) T(L, tri, 120, 0.1, 0.3, f1: 55);
                        break;
                    }
                case "dash": N(L, 0.16, 0.2, bp, 900, 3200, q: 1.4); break;
                case "swing":
                    {
                        string form = Str(a, 0);
                        bool slime = form == "slime";
                        if (form == "can") T(L, sq50, 900 * R(), 0.06, 0.07, f1: 700);
                        else N(L, 0.07, slime ? 0.1 : 0.12, slime ? lpf : hp, slime ? 1400 : 2600, slime ? 500 : 5000);
                        break;
                    }
                case "hitL": T(L, sq25, 230 * k * R(0.08), 0.06, 0.2, f1: 120 * k); N(L, 0.04, 0.12, f0: 3000 * k); break;
                case "hitH": HitH(L, k); break;
                case "crit": HitH(L, k); T(L, tri, 1320, 0.12, 0.18, f1: 1760, at: 0.01); break;
                case "kill": T(L, sq25, 620 * R(), 0.2, 0.18, f1: 90); N(L, 0.12, 0.14, f0: 2400, f1: 600); break;
                case "hurt": T(L, saw, 320, 0.22, 0.24, f1: 90, vr: 30, vd: 30, lp: 2400); N(L, 0.08, 0.18, f0: 1200); break;
                case "coin": T(L, sq25, 988 * R(0.01), 0.16, 0.1, arp: new[] { 0.05, 1.335 }); break;
                case "pickup": T(L, tri, 523, 0.18, 0.2, arp: new[] { 0.05, 1.26, 0.1, 1.5 }); break;
                case "rare": T(L, sq12, 784, 0.32, 0.14, arp: new[] { 0.06, 1.26, 0.12, 1.5, 0.18, 2 }); T(L, tri, 1568, 0.3, 0.1, at: 0.1); break;
                case "levelup":
                    {
                        double[] fs = { 523, 659, 784, 1047 };
                        for (int i = 0; i < 4; i++) T(L, sq25, fs[i], i == 3 ? 0.4 : 0.1, 0.16, delay: i * 0.08);
                        T(L, tri, 262, 0.6, 0.2);
                        break;
                    }
                case "shot":
                    if (Str(a, 0) == "slime") T(L, sine, 300, 0.14, 0.25, f1: 160, vr: 24, vd: 40);
                    else { T(L, sq12, 880, 0.1, 0.12, f1: 1500); N(L, 0.08, 0.08, hp, 3000); }
                    break;
                case "boom": N(L, 0.5, 0.4, f0: 3200, f1: 160); T(L, tri, 95, 0.4, 0.32, f1: 38); break;
                case "ultCharge": T(L, saw, 180, 0.9, 0.14, f1: 1400, at: 0.3, lp: 3000); N(L, 0.9, 0.18, bp, 400, 4000, at: 0.4, q: 2); break;
                case "ultHit":
                    N(L, 1.1, 0.5, f0: 4000, f1: 120); T(L, sine, 70, 0.9, 0.5, f1: 30);
                    T(L, sq25, 1047, 0.6, 0.12, arp: new[] { 0.1, 1.5, 0.2, 2 });
                    break;
                case "form": T(L, tri, 392, 0.3, 0.2, arp: new[] { 0.07, 1.26, 0.14, 1.5, 0.21, 2 }); break;
                case "absorb": T(L, sq12, 523, 0.5, 0.13, arp: new[] { 0.08, 1.26, 0.16, 1.5, 0.24, 2, 0.32, 2.52 }); T(L, tri, 262, 0.5, 0.18); break;
                case "chest":
                    {
                        double[] fs = { 659, 784, 988, 1319 };
                        for (int i = 0; i < 4; i++) T(L, sq25, fs[i], 0.14, 0.13, delay: i * 0.07);
                        break;
                    }
                case "ui": T(L, sq50, 1200, 0.035, 0.06); break;
                case "open": T(L, tri, 660, 0.08, 0.14, f1: 990); break;
                case "close": T(L, tri, 880, 0.08, 0.12, f1: 520); break;
                case "crate": N(L, 0.14, 0.24, bp, 700, q: 1.2); T(L, sq25, 180, 0.07, 0.14, f1: 90); break;
                case "clank": T(L, sq50, 820 * R(0.1), 0.08, 0.08); T(L, sq50, 1230 * R(0.1), 0.06, 0.05); break;
                case "grass": N(L, 0.06, 0.08, hp, 4000); break;
                case "splash": N(L, 0.16, 0.14, hp, 1600, 900); break;
                case "chime": T(L, sine, Num(a, 0, 1976), 0.5, 0.12); break;
                case "heart": T(L, sine, 78, 0.11, 0.34, f1: 46); T(L, sine, 66, 0.11, 0.22, f1: 40, delay: 0.16); break;   // 低血量的心跳（咚、咚）
                // ---- 王
                case "bossLand": N(L, 0.4, 0.5, f0: 500, f1: 90); T(L, sine, 75, 0.35, 0.55, f1: 32); break;
                case "roar":
                    T(L, saw, 150, 1.1, 0.3, f1: 70, at: 0.08, vr: 9, vd: 14, lp: 1200);
                    T(L, sq25, 75, 1.1, 0.18, f1: 50, at: 0.08);
                    N(L, 1.1, 0.2, f0: 900, f1: 300, at: 0.1);
                    break;
                case "inhale": { double d = Num(a, 0, 0.7); N(L, d, 0.2, bp, 300, 2600, q: 1.6, at: d * 0.6); break; }
                case "spit": N(L, 0.12, 0.26, f0: 2200, f1: 500); T(L, sq25, 300, 0.12, 0.18, f1: 110); break;
                case "fire": N(L, 0.35, 0.22, f0: 1400, f1: 400); T(L, saw, 220, 0.25, 0.12, f1: 110, lp: 900); break;
                case "squish": T(L, sine, 340, 0.3, 0.28, f1: 140, vr: 14, vd: 60); break;
                case "vacuum": { double d = Num(a, 0, 3); N(L, d, 0.3, bp, 260, 1800, q: 2.4, at: 0.3); T(L, saw, 60, d, 0.1, f1: 90, at: 0.3, lp: 400); break; }
                case "beam":
                    {
                        double d = Num(a, 0, 2.9);
                        T(L, saw, 110, d, 0.18, at: 0.4, vr: 18, vd: 6, lp: 1600);
                        T(L, sq12, 220, d, 0.1, at: 0.4, vr: 12, vd: 4);
                        N(L, d, 0.22, bp, 2400, q: 0.7, at: 0.4);
                        break;
                    }
                case "melt": T(L, saw, 320, 1.8, 0.22, f1: 40, vr: 6, vd: 20, lp: 1400); N(L, 1.4, 0.18, f0: 1200, f1: 200); break;
                default: return false;
            }
            return true;
        }
        void HitH(List<VoiceSpec> L, double k)
        {
            T(L, SynthWave.Saw, 170 * k * R(), 0.15, 0.26, f1: 55 * k, lp: 1800);
            N(L, 0.12, 0.28, f0: 1800 * k, f1: 400);
        }
        /// 開發用：音效清單的所有名字
        public static readonly string[] SFX_NAMES = {
            "jump", "jump2", "land", "dash", "swing", "hitL", "hitH", "crit", "kill", "hurt", "coin", "pickup", "rare", "levelup", "shot", "boom",
            "ultCharge", "ultHit", "form", "absorb", "chest", "ui", "open", "close", "crate", "clank", "grass", "splash", "chime", "heart",
            "bossLand", "roar", "inhale", "spit", "fire", "squish", "vacuum", "beam", "melt",
        };

        // ================= 音樂 =================
        // 一首歌：bpm、調（根音 MIDI）、音階、和弦進行（每小節一個：音階的第幾級）、主旋律（每小節 8 個八分音符：音階級數，"." 休止、"-" 延長，
        // "'" 高八度、"," 低八度）、低音型、鼓（16 格：k 大鼓、s 小鼓、h 鈸、. 空）。琶音聲部用和弦音每 16 分音符輪流。
        internal sealed class Song
        {
            public double Bpm; public int Root; public int[] Scale; public int[] Chords; public string[][] Lead; public string[] Bass; public string Drums;
            public double Arp; public SynthWave LeadWave; public double LeadVol; public bool Sixteen;
        }
        static readonly int[] MAJOR = { 0, 2, 4, 5, 7, 9, 11 }, MINOR = { 0, 2, 3, 5, 7, 8, 10 };
        static string[][] Bars(params string[] s) { var r = new string[s.Length][]; for (int i = 0; i < s.Length; i++) r[i] = s[i].Split(' '); return r; }
        internal static readonly Dictionary<string, Song> SONGS = new Dictionary<string, Song>
        {
            // 碎星鎮：溫暖、慢慢走的感覺（C 大調）
            ["town"] = new Song
            {
                Bpm = 92, Root = 60, Scale = MAJOR, Chords = new[] { 1, 6, 4, 5, 1, 6, 2, 5 },
                Lead = Bars("3 - 5 - 6 5 3 -", "1 - 2 3 - - . .", "4 - 6 - 1' 6 5 -", "5 - 4 3 2 - . .", "3 - 5 - 6 5 3 5", "6 - 5 3 - 2 1 -", "2 - 3 4 - 6 5 4", "3 - 2 - . . . ."),
                Bass = "1 . 5 . 1 . 5 .".Split(' '), Drums = "k...h...k...h...", Arp = 0.5, LeadWave = SynthWave.Sq25, LeadVol = 0.07,
            },
            // 關卡：往前冒險（A 小調），低音一直推
            ["stage"] = new Song
            {
                Bpm = 120, Root = 57, Scale = MINOR, Chords = new[] { 1, 6, 3, 7, 1, 6, 7, 5 },
                Lead = Bars("5 - 1' - 7 5 4 5", "3 - - - 1 3 4 5", "5 - 3 - 5 6 7 1'", "7 - 5 - - - . .", "5 - 1' - 2' 1' 7 5", "6 - 5 4 3 - 1 -", "2 - 3 4 5 - 7 -", "#7 - - - 5 . . ."),
                Bass = "1 1 5 1 8 1 5 1".Split(' '), Drums = "k.h.s.h.k.k.s.hh", Arp = 0.35, LeadWave = SynthWave.Sq25, LeadVol = 0.075,
            },
            // 王戰：快、壓迫（D 小調），低音十六分音符八度跳
            ["boss"] = new Song
            {
                Bpm = 152, Root = 50, Scale = MINOR, Chords = new[] { 1, 6, 7, 5, 1, 6, 4, 5 },
                Lead = Bars("1' - 7 - 6 - 5 -", "6 - 5 - 4 - 3 -", "4 - 5 - 6 - 7 -", "#7 - - - 5 - - -", "1' 2' 3' - 2' 1' 7 -", "6 - 7 1' - 6 4 -", "4 - 6 - 1' - 6 -", "#7 - 5 - #7 - 2' -"),
                Bass = "1 8 1 8 1 8 1 8".Split(' '), Drums = "k.hsk.hsk.hsk.ss", Arp = 0.45, LeadWave = SynthWave.Sq25, LeadVol = 0.08, Sixteen = true,
            },
        };

        /// 音階級數字串 → 半音（相對根音）："#7"、"1'"（高八度）、"5,"（低八度）
        static int Degree(string tok, int[] sc)
        {
            string s = tok; int oct = 0, sharp = 0;
            if (s.StartsWith("#")) { sharp = 1; s = s.Substring(1); }
            while (s.EndsWith("'")) { oct++; s = s.Substring(0, s.Length - 1); }
            while (s.EndsWith(",")) { oct--; s = s.Substring(0, s.Length - 1); }
            int d = int.Parse(s) - 1;
            return sc[((d % 7) + 7) % 7] + 12 * ((int)Math.Floor(d / 7.0) + oct) + sharp;
        }

        void Drum(char kind, double t)
        {
            var L = new List<VoiceSpec>(2);
            if (kind == 'k') T(L, SynthWave.Sine, 150, 0.12, 0.5, f1: 42, bus: 1);
            else if (kind == 's') { N(L, 0.1, 0.22, SynthFilt.Bandpass, 1800, q: 0.9, bus: 1); T(L, SynthWave.Tri, 190, 0.06, 0.18, f1: 120, bus: 1); }
            else if (kind == 'h') N(L, 0.03, 0.07, SynthFilt.Highpass, 7000, bus: 1);
            foreach (var o in L) AddVoice(o, t, null);
        }

        /// 聲音執行緒：把這一塊結束前要開始的 16 分音符都排好（網頁版是每 25ms 提前 0.12 秒排；這裡直接排到樣本上）
        void ScheduleMusic(long b1)
        {
            if (song == null) return;
            double sp = 60 / (song.Bpm * tempoK) / 4;   // 一個 16 分音符幾秒
            double tEnd = b1 / (double)SampleRate;
            var L = new List<VoiceSpec>(4);
            while (nextT < tEnd)
            {
                int bar = (int)(step / 16 % song.Chords.Length), s16 = (int)(step % 16);
                double t = nextT;
                int chordRoot = Degree(song.Chords[bar].ToString(), song.Scale);
                L.Clear();
                // 鼓
                char dk = song.Drums[s16];
                if (dk != '.') Drum(dk, t);
                // 低音（三角波）：八分音符；王戰是十六分音符
                if (song.Sixteen || s16 % 2 == 0)
                {
                    string tok = song.Bass[s16 / 2 % 8];
                    if (tok != ".")
                    {
                        int bn = song.Root - 12 + chordRoot + (tok == "5" ? 7 : tok == "8" ? 12 : 0);
                        double bd = sp * (song.Sixteen ? 0.9 : 1.8);
                        T(L, SynthWave.Tri, Midi(bn), bd, 0.22, at: 0.004, bus: 1);
                        T(L, SynthWave.Sq50, Midi(bn + 12), bd * 0.8, 0.035, at: 0.004, lp: 1400, bus: 1);   // 高八度的一層：手機喇叭放不出 55～110Hz，這層讓低音線聽得到
                    }
                }
                // 琶音（12.5% 方波）：和弦的 1、3、5 輪流
                if (song.Arp != 0)
                {
                    int triI = new[] { 0, 2, 4 }[s16 % 3];
                    int nn = song.Root + 12 + Degree((song.Chords[bar] + triI).ToString(), song.Scale);
                    T(L, SynthWave.Sq12, Midi(nn), sp * 0.9, 0.035 * song.Arp * 2, at: 0.003, bus: 1);
                }
                // 主旋律（25% 方波）：八分音符；"-" 延長上一個音
                if (s16 % 2 == 0)
                {
                    var toks = song.Lead[bar]; int i = s16 / 2; string tok = toks[i];
                    if (tok != "." && tok != "-")
                    {
                        int len = 1; while (i + len < toks.Length && toks[i + len] == "-") len++;
                        T(L, song.LeadWave, Midi(song.Root + 12 + Degree(tok, song.Scale)), sp * 2 * len * 0.92, song.LeadVol * 1.4, at: 0.006,
                            vr: len > 2 ? 5.5 : 0, vd: len > 2 ? 3 : 0, bus: 1);   // 主旋律再大一點，蓋得過音效
                    }
                }
                foreach (var o in L) AddVoice(o, t, null);
                step++;
                nextT += sp;
            }
        }

        // ================= 開場動畫的配樂 =================
        // 跟 intro.js 的時間表一幕一幕對齊（秒）：A 開機 0～8、B 夜空 8～14、B2 跟拍往下衝 14～21、C 撞擊（音樂停、只剩低鳴）、
        // T 標題 24～28.5（英雄號角）、D 主角醒來 28.5～39（輕快搞笑）、E 洞窟深處 39～46.5（陰森）。
        // 全部事先排成一張表；聲音執行緒照時間一個一個放進去。
        static (double t, VoiceSpec o)[] BuildIntro()
        {
            var ev = new List<(double t, VoiceSpec o, int i)>();
            var tmp = new List<VoiceSpec>(1);
            // T＝一個音、Nz＝一段雜訊（雜訊的起點在真的排進去時才抽亂數）
            void Tn(double t, SynthWave w, double f0, double dur, double vol, double f1 = 0, double at = 0.005, double lp = 0, double vr = 0, double vd = 0)
            { tmp.Clear(); T(tmp, w, f0, dur, vol, f1: f1, at: at, lp: lp, vr: vr, vd: vd, bus: 1); ev.Add((t, tmp[0], ev.Count)); }
            void Nz(double t, double dur, double vol, SynthFilt type, double f0, double f1 = 0, double q = 0.8, double at = 0.003)
            { ev.Add((t, new VoiceSpec { Noise = true, Dur = dur, Vol = vol, Filt = type, F0 = f0, F1 = f1, Q = q, At = at, Bus = 1 }, ev.Count)); }
            void nt(double t, double m, double dur, SynthWave w, double v, double lp = 0, double vr = 0, double vd = 0)
            {
                Tn(t, w, Midi(m), dur, v, at: 0.006, lp: lp, vr: vr, vd: vd);
                if (w == SynthWave.Tri && m < 52) Tn(t, SynthWave.Sq50, Midi(m + 12), dur * 0.8, v * 0.16, at: 0.006, lp: 1400);   // 低音加高八度一層（手機喇叭聽得到）
            }
            void kick(double t, double v = 0.45) => Tn(t, SynthWave.Sine, 150, 0.12, v, f1: 42);
            void snare(double t, double v = 0.2) { Nz(t, 0.1, v, SynthFilt.Bandpass, 1800, q: 0.9); Tn(t, SynthWave.Tri, 190, 0.06, v * 0.8, f1: 120); }
            void hat(double t, double v = 0.06) => Nz(t, 0.03, v, SynthFilt.Highpass, 7000);
            const SynthWave sq12 = SynthWave.Sq12, sq25 = SynthWave.Sq25, sq50 = SynthWave.Sq50, tri = SynthWave.Tri, saw = SynthWave.Saw, sine = SynthWave.Sine;

            // ---- A：開機
            Tn(0.2, tri, Midi(33), 4.4, 0.16, at: 0.8, vr: 0.4, vd: 1);
            Tn(0.2, sine, Midi(45), 4.4, 0.08, at: 1.2);
            foreach (var (t, m) in new[] { (0.7, 84), (1.2, 88), (1.7, 91), (2.3, 96), (3.0, 98) })
            {
                nt(t, m, 0.07, sq12, 0.05);
                for (int i = 1; i < 8; i++) nt(t + i * 0.05, 90 + ((i * 7) % 9), 0.025, sq12, 0.02);
            }
            for (int i = 0; i < 8; i++) nt(3.4 + i * 0.15, 72 + i * 2, 0.1, sq12, 0.04);   // 查詢中……（一路往上）
            for (int i = 0; i < 8; i++) nt(4.6 + i * 0.2, i % 2 == 1 ? 68 : 74, 0.17, saw, 0.07, lp: 2400);   // 警報（三全音）
            Tn(4.6, saw, Midi(38), 1.6, 0.1, lp: 500);
            { int[] ms = { 62, 66, 69, 74, 78, 81, 86 }; for (int i = 0; i < ms.Length; i++) nt(6.25 + i * 0.12, ms[i], 0.2, sq25, 0.06); }   // 強制寫入成功：D 大調往上
            foreach (int m in new[] { 62, 66, 69 }) nt(7.1, m, 0.5, tri, 0.1);
            Tn(7.4, sine, 880, 0.6, 0.12, f1: 40);   // 關機
            // ---- B：夜空（D 大調，夢幻）
            foreach (var (t0, ch) in new[] { (8.0, new[] { 62, 66, 69 }), (11.0, new[] { 59, 62, 66 }) })
            {
                foreach (int m in ch) Tn(t0, tri, Midi(m - 12), 3, 0.06, at: 0.6);
                for (int i = 0; i < 16; i++) nt(t0 + i * 0.1875, ch[i % 3] + 24, 0.15, sq12, 0.03);
            }
            foreach (var (t, m) in new[] { (8.6, 81), (9.4, 78), (10.2, 74), (11.0, 76), (12.2, 78), (13.0, 81) }) nt(t, m, 0.75, sine, 0.07, vr: 5, vd: 3);
            { int[] ms = { 86, 90, 93, 98, 102 }; for (int i = 0; i < ms.Length; i++) nt(10.0 + i * 0.06, ms[i], 0.12, sq12, 0.04); }   // 金色碎片出現：閃一下
            // ---- B2：跟拍往下衝（140 bpm，越來越大聲）
            {
                double b = 60.0 / 140, s16 = b / 4; int[] roots = { 38, 35, 43, 45 }; int[] up = { 0, 7, 12, 16, 19, 16, 12, 7 };
                for (int bar = 0; bar < 4; bar++)
                {
                    double t0 = 14.1 + bar * b * 4, k = 0.6 + bar * 0.15; int r = roots[bar];
                    for (int i = 0; i < 16; i++)
                    {
                        nt(t0 + i * s16, r + (i % 2 == 1 ? 12 : 0), s16 * 0.9, tri, 0.2 * k);
                        if (i % 4 == 0) kick(t0 + i * s16, 0.4 * k);
                        if (i % 8 == 4) snare(t0 + i * s16, 0.18 * k);
                        if (i % 2 == 0) hat(t0 + i * s16, 0.05 * k);
                        if (i % 2 == 0) nt(t0 + i * s16, r + 24 + up[i / 2], s16 * 1.8, sq25, 0.05 * k);
                    }
                }
            }
            for (int i = 0; i < 18; i++) snare(19.9 + i * (0.06 - i * 0.0015), 0.08 + i * 0.008);   // 最後衝進山谷：小鼓越打越密
            // ---- C：撞擊（音樂停，只剩往上爬的低鳴；撞地的聲音是音效）
            Nz(21.1, 2.1, 0.12, SynthFilt.Lowpass, 120, 900, at: 1.5);
            Tn(21.1, saw, Midi(26), 2.1, 0.08, f1: Midi(38), lp: 300, at: 1.5);
            // ---- T：標題砸下來（英雄號角，D 大調 120 bpm）
            const double tt = 24.28;
            foreach (int m in new[] { 62, 66, 69, 74 }) { nt(tt, m, 0.7, saw, 0.06, lp: 2600); nt(tt, m + 12, 0.5, sq25, 0.04); }
            kick(tt, 0.55); Nz(tt, 1.2, 0.12, SynthFilt.Highpass, 4000, 9000);
            {
                const double e8 = 0.25; double ct = tt + 0.5;
                foreach (var (m, l) in new[] { (74, 1), (78, 1), (81, 2), (79, 1), (78, 1), (76, 2), (78, 1), (76, 1), (74, 4) })
                {
                    if (l > 2) nt(ct, m, e8 * l * 0.92, sq25, 0.09, vr: 5.5, vd: 3); else nt(ct, m, e8 * l * 0.92, sq25, 0.09);
                    ct += e8 * l;
                }
            }
            foreach (var (m, d) in new[] { (50, 0.0), (55, 0.875), (57, 1.75), (50, 2.625) }) nt(tt + 0.5 + d, m, 0.8, tri, 0.22);
            for (int i = 0; i < 14; i++) { double t = tt + 0.5 + i * 0.25; if (i % 2 == 0) kick(t, 0.3); else hat(t); if (i % 4 == 2) snare(t, 0.12); }
            // ---- D：主角醒來（輕快、搞笑：撥弦一樣的短音）
            int[] tune = { 74, 0, 78, 0, 81, 0, 78, 0, 76, 0, 79, 0, 78, 76, 74, 0 };
            void pz(double t, double m, double v = 0.07) => nt(t, m, 0.07, sq50, v);
            void playBounce(double t0, double t1)
            {
                int i = 0;
                for (double t = t0; t < t1; i++, t += 0.3)
                {
                    int m = tune[i % 16];
                    if (m != 0) pz(t, m);
                    if (i % 2 == 0) nt(t, i % 4 == 0 ? 50 : 57, 0.12, tri, 0.18);
                }
            }
            playBounce(29.0, 32.8);
            Tn(32.9, sine, Midi(60), 0.45, 0.12, f1: Midi(86));   // 嚇一跳：滑笛往上
            playBounce(33.7, 35.0);
            Tn(35.1, sq25, Midi(62), 0.35, 0.08, f1: Midi(59)); Tn(35.5, sq25, Midi(59), 0.7, 0.08, f1: Midi(53), vr: 6, vd: 6);   // 跌倒：哇～哇～
            playBounce(36.6, 38.8);
            // ---- E：洞窟深處（陰森：低音持續＋心跳鼓＋零星的高音）
            Tn(39.0, tri, Midi(26), 7.2, 0.2, at: 1.2);
            Tn(39.0, saw, Midi(50), 7.2, 0.035, at: 2, lp: 420); Tn(39.0, saw, Midi(51), 7.2, 0.03, at: 2.5, lp: 420);
            for (double t = 39.6; t < 45.6; t += 1.1) { kick(t, 0.28); kick(t + 0.22, 0.18); }
            foreach (var (t, m) in new[] { (40.2, 86), (41.1, 87), (42.3, 81), (43.6, 82), (44.5, 75) }) nt(t, m, 0.5, sq12, 0.025, vr: 7, vd: 4);
            foreach (int m in new[] { 38, 45, 50 }) Tn(42.0, saw, Midi(m), 2.6, 0.06, at: 0.4, lp: 900);   // 「你可以吃掉」：低音銅管
            ev.Sort((a, b2) => a.t != b2.t ? a.t.CompareTo(b2.t) : a.i.CompareTo(b2.i));
            var r2 = new (double, VoiceSpec)[ev.Count];
            for (int i = 0; i < ev.Count; i++) r2[i] = (ev[i].t, ev[i].o);
            return r2;
        }
    }
}
