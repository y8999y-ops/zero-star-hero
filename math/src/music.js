// 背景音樂（待辦 F2）：瀏覽器內建合成器做的晶片音樂，不用下載檔案、全部自己做（跟 audio.js 的音效同一套做法）。
// 每首是幾行「一格一個音」的譜，一格＝八分音符：
//   lead 主旋律（方波／正弦）、bass 低音（三角波）、arp 和弦分解（輕輕的）、beat 節奏（k 大鼓、h 小鈸、s 小鼓）
//   「.」＝延長上一個音，「-」＝休止。小節之間的「|」只是給人看的。
// 換畫面時呼叫 playMusic(名字)：舊的淡出、新的從頭開始；同一首就不重來。網址加 ?mute 或設定靜音就不出聲。

const MUTE_URL = new URLSearchParams(location.search).has("mute");
let ctx = null, master = null, vol = 0.7, muted = MUTE_URL;
let cur = null;            // { name, track, gain, step, next }
let timer = null;

const NOTE = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };
const freq = (n) => { const m = n.match(/^([A-G]#?)(\d)$/); return 440 * 2 ** ((NOTE[m[1]] + (Number(m[2]) + 1) * 12 - 69) / 12); };
const parse = (s) => s.replace(/\|/g, " ").trim().split(/\s+/);

export const TRACKS = {
  // 標題：溫柔的 C 大調，像打開一本故事書
  title: { bpm: 92, lead: { wave: "square", g: 0.035 }, bass: { g: 0.06 },
    lead_: "E5 . G5 . C6 . B5 A5 | G5 . E5 . D5 . E5 . | F5 . A5 . G5 . E5 C5 | D5 . . . - - - - | E5 . G5 . C6 . D6 E6 | D6 . C6 . A5 . G5 . | F5 . E5 . D5 . G5 . | C5 . . . - - - -",
    bass_: "C3 . G3 . C3 . G3 . | A2 . E3 . A2 . E3 . | F2 . C3 . F2 . C3 . | G2 . D3 . G2 . B2 . | C3 . G3 . C3 . G3 . | A2 . E3 . A2 . E3 . | F2 . C3 . G2 . D3 . | C3 . G3 . C3 . . .",
    arp_: "C4 E4 G4 E4 C4 E4 G4 E4 | A3 C4 E4 C4 A3 C4 E4 C4 | F3 A3 C4 A3 F3 A3 C4 A3 | G3 B3 D4 B3 G3 B3 D4 B3 | C4 E4 G4 E4 C4 E4 G4 E4 | A3 C4 E4 C4 A3 C4 E4 C4 | F3 A3 C4 A3 G3 B3 D4 B3 | C4 E4 G4 E4 C4 . . ." },
  // 學院全景、學院裡、商店、宿舍：輕快的 F 大調
  hub: { bpm: 112, lead: { wave: "square", g: 0.035 }, bass: { g: 0.06 },
    lead_: "C5 . F5 . A5 G5 F5 . | G5 . A5 . C6 . A5 . | A#5 . A5 . G5 . F5 . | G5 . . . E5 . . . | C5 . F5 . A5 G5 F5 . | G5 . A5 . C6 . D6 . | C6 . A#5 . A5 . G5 . | F5 . . . - - - -",
    bass_: "F2 . C3 . F2 . C3 . | C3 . G3 . C3 . G3 . | A#2 . F3 . A#2 . F3 . | C3 . G3 . C3 . E3 . | F2 . C3 . F2 . C3 . | C3 . G3 . C3 . G3 . | A#2 . F3 . C3 . G3 . | F2 . C3 . F2 . . .",
    beat_: "k - h - s - h - | k - h - s - h h | k - h - s - h - | k - h - s - h - | k - h - s - h - | k - h - s - h h | k - h - s - h - | k - - - s - - -" },
  // 圖書館、魔法教室、圖鑑：音樂盒，慢一點
  library: { bpm: 84, lead: { wave: "sine", g: 0.06 }, bass: { g: 0.05 },
    lead_: "A4 C5 E5 C5 B4 D5 G5 D5 | A4 C5 E5 A5 G5 E5 C5 - | F4 A4 C5 A4 E4 G4 B4 G4 | A4 . . . - - - - | C5 E5 G5 E5 D5 F5 A5 F5 | E5 G5 C6 B5 A5 G5 E5 - | F5 E5 D5 C5 B4 C5 D5 E5 | A4 . . . - - - -",
    bass_: "A2 . . . G2 . . . | A2 . . . C3 . . . | F2 . . . E2 . . . | A2 . . . . . . . | C3 . . . D3 . . . | C3 . . . A2 . . . | F2 . . . E2 . . . | A2 . . . . . . ." },
  // 受污染的區域：灰灰的、有點神祕的 D 小調
  area: { bpm: 96, lead: { wave: "triangle", g: 0.06 }, bass: { g: 0.06 },
    lead_: "D5 . F5 . E5 . A4 . | D5 . F5 . G5 . A5 . | A#5 . A5 . G5 . F5 . | E5 . . . - - - - | D5 . F5 . E5 . A4 . | D5 . F5 . G5 . A5 . | A#5 . A5 . G5 . E5 . | D5 . . . - - - -",
    bass_: "D2 . A2 . D2 . A2 . | C3 . G2 . C3 . G2 . | A#2 . F2 . A#2 . F2 . | A2 . E2 . A2 . C#3 . | D2 . A2 . D2 . A2 . | C3 . G2 . C3 . G2 . | A#2 . F2 . A2 . E2 . | D2 . A2 . D2 . . .",
    beat_: "k - - - h - - - | k - - - h - - - | k - - - h - - - | k - - - h - h - | k - - - h - - - | k - - - h - - - | k - - - h - - - | k - - - - - - -" },
  // 戰鬥：A 小調、快
  battle: { bpm: 140, lead: { wave: "square", g: 0.032 }, bass: { g: 0.07 },
    lead_: "A4 . C5 A4 E5 . D5 C5 | B4 . G4 B4 D5 . C5 B4 | A4 . C5 E5 A5 . G5 E5 | F5 . E5 D5 E5 . . . | A4 . C5 A4 E5 . D5 C5 | B4 . G4 B4 D5 . E5 F5 | G5 . F5 E5 D5 . C5 B4 | A4 . . . - - - -",
    bass_: "A2 A2 A3 A2 A2 A2 A3 A2 | G2 G2 G3 G2 G2 G2 G3 G2 | F2 F2 F3 F2 F2 F2 F3 F2 | E2 E2 E3 E2 E2 E2 G#2 E2 | A2 A2 A3 A2 A2 A2 A3 A2 | G2 G2 G3 G2 G2 G2 G3 G2 | F2 F2 F3 F2 E2 E2 E3 E2 | A2 A2 A3 A2 A2 . . .",
    beat_: "k h s h k h s h | k h s h k h s h | k h s h k h s h | k h s h k k s s | k h s h k h s h | k h s h k h s h | k h s h k h s h | k - s - k - - -" },
  // 王戰：D 小調、更快、低音一直跳八度
  boss: { bpm: 152, lead: { wave: "sawtooth", g: 0.022 }, bass: { g: 0.08 },
    lead_: "D5 . D5 F5 - D5 A5 . | G5 . F5 E5 - C5 D5 . | A#4 . D5 F5 - A#5 A5 . | A5 . G5 . E5 . C#5 . | D5 . D5 F5 - D5 A5 . | G5 . F5 E5 - C5 D5 . | A#5 . A5 G5 F5 . E5 F5 | D5 . . . - - - -",
    bass_: "D2 D3 D2 D3 D2 D3 D2 D3 | C2 C3 C2 C3 C2 C3 C2 C3 | A#1 A#2 A#1 A#2 A#1 A#2 A#1 A#2 | A1 A2 A1 A2 A1 A2 C#2 A2 | D2 D3 D2 D3 D2 D3 D2 D3 | C2 C3 C2 C3 C2 C3 C2 C3 | A#1 A#2 A#1 A#2 A1 A2 A1 A2 | D2 D3 D2 D3 D2 . . .",
    beat_: "k h s h k k s h | k h s h k k s h | k h s h k k s h | k h s h s s s s | k h s h k k s h | k h s h k k s h | k h s h k k s h | k - s - k - s -" },
  // 結局：慢慢的、暖暖的 C 大調
  ending: { bpm: 76, lead: { wave: "sine", g: 0.07 }, bass: { g: 0.06 },
    lead_: "G4 . C5 . E5 . D5 C5 | A4 . C5 . G5 . . . | F5 . E5 . D5 . C5 A4 | G4 . . . C5 . . . | E5 . G5 . C6 . B5 A5 | G5 . E5 . C5 . . . | D5 . E5 . F5 . D5 B4 | C5 . . . - - - -",
    bass_: "C2 . G2 . C3 . G2 . | A1 . E2 . A2 . E2 . | F1 . C2 . F2 . C2 . | G1 . D2 . G2 . D2 . | C2 . G2 . C3 . G2 . | A1 . E2 . A2 . E2 . | F1 . C2 . G1 . D2 . | C2 . G2 . C3 . . .",
    arp_: "E4 G4 C5 G4 E4 G4 C5 G4 | C4 E4 A4 E4 C4 E4 A4 E4 | A3 C4 F4 C4 A3 C4 F4 C4 | B3 D4 G4 D4 B3 D4 G4 D4 | E4 G4 C5 G4 E4 G4 C5 G4 | C4 E4 A4 E4 C4 E4 A4 E4 | A3 C4 F4 C4 B3 D4 G4 D4 | E4 G4 C5 . . . . ." },
};
for (const t of Object.values(TRACKS)) for (const k of ["lead_", "bass_", "arp_", "beat_"]) if (t[k]) t[k.slice(0, -1) + "S"] = parse(t[k]);

function ensure() {
  if (ctx) return true;
  try { ctx = new AudioContext(); master = ctx.createGain(); master.gain.value = muted ? 0 : vol * 0.6; master.connect(ctx.destination); } catch { return false; }
  // 瀏覽器規定要使用者先碰一下畫面才能出聲：碰到就恢復
  const wake = () => { if (ctx.state === "suspended") ctx.resume(); };
  addEventListener("pointerdown", wake); addEventListener("keydown", wake);
  return true;
}

let noiseBuf = null;
function noiseSrc() {
  if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; return s;
}
function note(out, t, f, dur, wave, g) {
  const o = ctx.createOscillator(), e = ctx.createGain();
  o.type = wave; o.frequency.value = f;
  e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(g, t + 0.01); e.gain.setValueAtTime(g * 0.7, t + dur * 0.6); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(e).connect(out); o.start(t); o.stop(t + dur + 0.02);
}
function drum(out, t, kind) {
  if (kind === "k") { const o = ctx.createOscillator(), e = ctx.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12); e.gain.setValueAtTime(0.12, t); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.14); o.connect(e).connect(out); o.start(t); o.stop(t + 0.16); return; }
  const s = noiseSrc(), f = ctx.createBiquadFilter(), e = ctx.createGain();
  f.type = kind === "h" ? "highpass" : "bandpass"; f.frequency.value = kind === "h" ? 7000 : 1800;
  const g = kind === "h" ? 0.025 : 0.05, d = kind === "h" ? 0.04 : 0.1;
  e.gain.setValueAtTime(g, t); e.gain.exponentialRampToValueAtTime(0.0001, t + d);
  s.connect(f).connect(e).connect(out); s.start(t); s.stop(t + d + 0.02);
}
// 一行譜在第 i 格：回傳 [音, 持續幾格]（「.」接在後面算延長）
function at(seq, i) {
  const n = seq[i % seq.length];
  if (n === "." || n === "-") return null;
  let len = 1; while (seq[(i + len) % seq.length] === "." && len < seq.length) len++;
  return [n, len];
}

function schedule() {
  if (!cur || !ctx) return;
  const T = cur.track, stepDur = 60 / T.bpm / 2;
  while (cur.next < ctx.currentTime + 0.15) {
    const i = cur.step, t = cur.next;
    for (const [seq, opt, wave] of [[T.leadS, T.lead, T.lead.wave], [T.bassS, T.bass, "triangle"], [T.arpS, { g: 0.018 }, "triangle"]]) {
      if (!seq) continue;
      const n = at(seq, i);
      if (n) note(cur.gain, t, freq(n[0]), n[1] * stepDur * 0.95, wave, opt.g);
    }
    if (T.beatS) { const b = T.beatS[i % T.beatS.length]; if (b !== "-" && b !== ".") drum(cur.gain, t, b); }
    cur.step++; cur.next += stepDur;
  }
}

/** 換背景音樂（同一首不重來）；name＝null 停掉 */
export function playMusic(name) {
  if (cur?.name === name) return;
  if (!ensure()) return;
  if (cur) { const g = cur.gain; g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.25); setTimeout(() => g.disconnect(), 1500); cur = null; }
  if (!name || !TRACKS[name]) return;
  const gain = ctx.createGain(); gain.gain.value = 0.0001; gain.gain.setTargetAtTime(1, ctx.currentTime + 0.1, 0.3); gain.connect(master);
  cur = { name, track: TRACKS[name], gain, step: 0, next: ctx.currentTime + 0.15 };
  timer ??= setInterval(schedule, 40);
}
/** 設定：音樂音量 0～1、靜音 */
export function setMusic(volume, mute) {
  vol = Math.max(0, Math.min(1, volume)); muted = mute || MUTE_URL;
  if (master) master.gain.setTargetAtTime(muted ? 0 : vol * 0.6, ctx.currentTime, 0.1);
}
// 切到別的分頁時停一下（手機省電），回來再繼續
document.addEventListener("visibilitychange", () => { if (!ctx) return; if (document.hidden) ctx.suspend(); else ctx.resume(); });
