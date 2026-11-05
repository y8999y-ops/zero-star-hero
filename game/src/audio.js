// 聲音：全部用 Web Audio 即時合成（8-bit 風格，不用音檔）。
// 音效照 sfxr 的做法：每種聲音是一組參數（波形、起訖音高、長度、包絡、濾波、琶音），每次播放帶一點隨機變化，聽起來不會一模一樣。
// 音樂照 NES 的分工：方波（25%）主旋律、方波（12.5%）琶音當和弦、三角波低音、雜訊打鼓；16 分音符一格，排程器提前 0.12 秒排好。
// 第一次有聲音前要有使用者操作（按「點擊開始」時呼叫 unlock）。音量存在 localStorage（讀不到就用預設）。
const KEY = "zero-hero-audio";
export const vol = { music: 0.55, sfx: 0.8, mute: false };
try { Object.assign(vol, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch {}

let ctx = null, master, sfxBus, musicBus, noiseBuf = null;
const waves = {};
export function unlock() {
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.connect(ctx.destination);
      sfxBus = ctx.createGain(); sfxBus.connect(master);
      musicBus = ctx.createGain(); musicBus.connect(master);
      applyVolume();
    }
    if (ctx.state === "suspended") ctx.resume();
  } catch {}
}
export function setVolume(k, v) {
  vol[k] = v;
  applyVolume();
  try { localStorage.setItem(KEY, JSON.stringify(vol)); } catch {}
}
function applyVolume() {
  if (!ctx) return;
  master.gain.value = vol.mute ? 0 : 1;
  sfxBus.gain.value = vol.sfx * 0.9;
  musicBus.gain.value = vol.music * 0.5;
}
// 方波的佔空比（NES 的 12.5%、25%、50%）：用傅立葉係數做出 PeriodicWave
function pulse(duty) {
  if (waves[duty]) return waves[duty];
  const n = 32, re = new Float32Array(n), im = new Float32Array(n);
  for (let k = 1; k < n; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
  return (waves[duty] = ctx.createPeriodicWave(re, im));
}
function noise() {
  if (noiseBuf) return noiseBuf;
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}
const rnd = (k = 0.04) => 1 + (Math.random() - 0.5) * 2 * k;

/**
 * 一個音：{ wave: "sq25"|"sq12"|"sq50"|"tri"|"saw"|"sine", f0, f1（滑到的音高）, dur, at（起音秒）, vol, vib: [速度, 深度], arp: [[秒, 倍數]...], lp（低通） }
 * bus＝要接到哪（音效或音樂），t＝開始時間（預設現在）
 */
function tone(o, bus = sfxBus, t = ctx.currentTime) {
  const osc = ctx.createOscillator(), g = ctx.createGain();
  if (o.wave?.startsWith("sq")) osc.setPeriodicWave(pulse({ sq12: 0.125, sq25: 0.25, sq50: 0.5 }[o.wave]));
  else osc.type = o.wave === "tri" ? "triangle" : o.wave === "saw" ? "sawtooth" : "sine";
  const dur = o.dur, at = o.at ?? 0.005, v = o.vol ?? 0.3;
  osc.frequency.setValueAtTime(o.f0, t);
  if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + dur);
  for (const [dt, k] of o.arp ?? []) osc.frequency.setValueAtTime(o.f0 * k, t + dt);
  if (o.vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = o.vib[0]; lg.gain.value = o.vib[1]; l.connect(lg).connect(osc.frequency); l.start(t); l.stop(t + dur + 0.05); }
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + at);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let out = osc.connect(g);
  if (o.lp) { const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = o.lp; out = out.connect(f); }
  out.connect(bus);
  osc.start(t); osc.stop(t + dur + 0.02);
  return { osc, g };
}
/** 雜訊：{ dur, vol, type: "lowpass"|"highpass"|"bandpass", f0, f1（濾波頻率滑動）, q, at } */
function hiss(o, bus = sfxBus, t = ctx.currentTime) {
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = noise(); src.loop = true;
  f.type = o.type ?? "lowpass"; f.Q.value = o.q ?? 0.8;
  f.frequency.setValueAtTime(o.f0 ?? 2000, t);
  if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + o.dur);
  const at = o.at ?? 0.003, v = o.vol ?? 0.3;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + at);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  src.connect(f).connect(g).connect(bus);
  src.start(t, Math.random() * 0.5); src.stop(t + o.dur + 0.02);
  return { src, g };
}

// ---- 音效清單
const S = {
  jump: () => tone({ wave: "sq25", f0: 290 * rnd(), f1: 640, dur: 0.12, vol: 0.18 }),
  jump2: () => { tone({ wave: "sq12", f0: 440 * rnd(), f1: 960, dur: 0.13, vol: 0.16 }); tone({ wave: "tri", f0: 1320, dur: 0.08, vol: 0.12, at: 0.02 }); },
  land: (hard) => { hiss({ dur: hard ? 0.12 : 0.07, vol: hard ? 0.26 : 0.14, f0: 900, f1: 300 }); if (hard) tone({ wave: "tri", f0: 120, f1: 55, dur: 0.1, vol: 0.3 }); },
  dash: () => hiss({ dur: 0.16, vol: 0.2, type: "bandpass", f0: 900, f1: 3200, q: 1.4 }),
  swing: (form) => form === "can" ? tone({ wave: "sq50", f0: 900 * rnd(), f1: 700, dur: 0.06, vol: 0.07 }) : hiss({ dur: 0.07, vol: form === "slime" ? 0.1 : 0.12, type: form === "slime" ? "lowpass" : "highpass", f0: form === "slime" ? 1400 : 2600, f1: form === "slime" ? 500 : 5000 }),
  hitL: () => { tone({ wave: "sq25", f0: 230 * rnd(0.08), f1: 120, dur: 0.06, vol: 0.2 }); hiss({ dur: 0.04, vol: 0.12, f0: 3000 }); },
  hitH: () => { tone({ wave: "saw", f0: 170 * rnd(), f1: 55, dur: 0.15, vol: 0.26, lp: 1800 }); hiss({ dur: 0.12, vol: 0.28, f0: 1800, f1: 400 }); },
  crit: () => { S.hitH(); tone({ wave: "tri", f0: 1320, f1: 1760, dur: 0.12, vol: 0.18, at: 0.01 }); },
  kill: () => { tone({ wave: "sq25", f0: 620 * rnd(), f1: 90, dur: 0.2, vol: 0.18 }); hiss({ dur: 0.12, vol: 0.14, f0: 2400, f1: 600 }); },
  hurt: () => { tone({ wave: "saw", f0: 320, f1: 90, dur: 0.22, vol: 0.24, vib: [30, 30], lp: 2400 }); hiss({ dur: 0.08, vol: 0.18, f0: 1200 }); },
  coin: () => tone({ wave: "sq25", f0: 988 * rnd(0.01), dur: 0.16, vol: 0.1, arp: [[0.05, 1.335]] }),
  pickup: () => tone({ wave: "tri", f0: 523, dur: 0.18, vol: 0.2, arp: [[0.05, 1.26], [0.1, 1.5]] }),
  rare: () => { tone({ wave: "sq12", f0: 784, dur: 0.32, vol: 0.14, arp: [[0.06, 1.26], [0.12, 1.5], [0.18, 2]] }); tone({ wave: "tri", f0: 1568, dur: 0.3, vol: 0.1, at: 0.1 }); },
  levelup: () => { const t = ctx.currentTime; [523, 659, 784, 1047].forEach((f, i) => tone({ wave: "sq25", f0: f, dur: i === 3 ? 0.4 : 0.1, vol: 0.16 }, sfxBus, t + i * 0.08)); tone({ wave: "tri", f0: 262, dur: 0.6, vol: 0.2 }, sfxBus, t); },
  shot: (form) => form === "slime" ? tone({ wave: "sine", f0: 300, f1: 160, dur: 0.14, vol: 0.25, vib: [24, 40] }) : (tone({ wave: "sq12", f0: 880, f1: 1500, dur: 0.1, vol: 0.12 }), hiss({ dur: 0.08, vol: 0.08, type: "highpass", f0: 3000 })),
  boom: () => { hiss({ dur: 0.5, vol: 0.4, f0: 3200, f1: 160 }); tone({ wave: "tri", f0: 95, f1: 38, dur: 0.4, vol: 0.32 }); },
  ultCharge: () => { tone({ wave: "saw", f0: 180, f1: 1400, dur: 0.9, vol: 0.14, at: 0.3, lp: 3000 }); hiss({ dur: 0.9, vol: 0.18, type: "bandpass", f0: 400, f1: 4000, at: 0.4, q: 2 }); },
  ultHit: () => { hiss({ dur: 1.1, vol: 0.5, f0: 4000, f1: 120 }); tone({ wave: "sine", f0: 70, f1: 30, dur: 0.9, vol: 0.5 }); tone({ wave: "sq25", f0: 1047, dur: 0.6, vol: 0.12, arp: [[0.1, 1.5], [0.2, 2]] }); },
  form: () => tone({ wave: "tri", f0: 392, dur: 0.3, vol: 0.2, arp: [[0.07, 1.26], [0.14, 1.5], [0.21, 2]] }),
  absorb: () => { tone({ wave: "sq12", f0: 523, dur: 0.5, vol: 0.13, arp: [[0.08, 1.26], [0.16, 1.5], [0.24, 2], [0.32, 2.52]] }); tone({ wave: "tri", f0: 262, dur: 0.5, vol: 0.18 }); },
  chest: () => { const t = ctx.currentTime; [659, 784, 988, 1319].forEach((f, i) => tone({ wave: "sq25", f0: f, dur: 0.14, vol: 0.13 }, sfxBus, t + i * 0.07)); },
  ui: () => tone({ wave: "sq50", f0: 1200, dur: 0.035, vol: 0.06 }),
  open: () => tone({ wave: "tri", f0: 660, f1: 990, dur: 0.08, vol: 0.14 }),
  close: () => tone({ wave: "tri", f0: 880, f1: 520, dur: 0.08, vol: 0.12 }),
  crate: () => { hiss({ dur: 0.14, vol: 0.24, type: "bandpass", f0: 700, q: 1.2 }); tone({ wave: "sq25", f0: 180, f1: 90, dur: 0.07, vol: 0.14 }); },
  clank: () => { tone({ wave: "sq50", f0: 820 * rnd(0.1), dur: 0.08, vol: 0.08 }); tone({ wave: "sq50", f0: 1230 * rnd(0.1), dur: 0.06, vol: 0.05 }); },
  grass: () => hiss({ dur: 0.06, vol: 0.08, type: "highpass", f0: 4000 }),
  splash: () => hiss({ dur: 0.16, vol: 0.14, type: "highpass", f0: 1600, f1: 900 }),
  chime: (f = 1976) => tone({ wave: "sine", f0: f, dur: 0.5, vol: 0.12 }),
  heart: () => { const t = ctx.currentTime; tone({ wave: "sine", f0: 78, f1: 46, dur: 0.11, vol: 0.34 }, sfxBus, t); tone({ wave: "sine", f0: 66, f1: 40, dur: 0.11, vol: 0.22 }, sfxBus, t + 0.16); },   // 低血量的心跳（咚、咚）
  // ---- 王
  bossLand: () => { hiss({ dur: 0.4, vol: 0.5, f0: 500, f1: 90 }); tone({ wave: "sine", f0: 75, f1: 32, dur: 0.35, vol: 0.55 }); },
  roar: () => { tone({ wave: "saw", f0: 150, f1: 70, dur: 1.1, vol: 0.3, at: 0.08, vib: [9, 14], lp: 1200 }); tone({ wave: "sq25", f0: 75, f1: 50, dur: 1.1, vol: 0.18, at: 0.08 }); hiss({ dur: 1.1, vol: 0.2, f0: 900, f1: 300, at: 0.1 }); },
  inhale: (d = 0.7) => hiss({ dur: d, vol: 0.2, type: "bandpass", f0: 300, f1: 2600, q: 1.6, at: d * 0.6 }),
  spit: () => { hiss({ dur: 0.12, vol: 0.26, f0: 2200, f1: 500 }); tone({ wave: "sq25", f0: 300, f1: 110, dur: 0.12, vol: 0.18 }); },
  fire: () => { hiss({ dur: 0.35, vol: 0.22, f0: 1400, f1: 400 }); tone({ wave: "saw", f0: 220, f1: 110, dur: 0.25, vol: 0.12, lp: 900 }); },
  squish: () => tone({ wave: "sine", f0: 340, f1: 140, dur: 0.3, vol: 0.28, vib: [14, 60] }),
  vacuum: (d = 3) => { hiss({ dur: d, vol: 0.3, type: "bandpass", f0: 260, f1: 1800, q: 2.4, at: 0.3 }); tone({ wave: "saw", f0: 60, f1: 90, dur: d, vol: 0.1, at: 0.3, lp: 400 }); },
  beam: (d = 2.9) => { tone({ wave: "saw", f0: 110, dur: d, vol: 0.18, at: 0.4, vib: [18, 6], lp: 1600 }); tone({ wave: "sq12", f0: 220, dur: d, vol: 0.1, at: 0.4, vib: [12, 4] }); hiss({ dur: d, vol: 0.22, type: "bandpass", f0: 2400, q: 0.7, at: 0.4 }); },
  melt: () => { tone({ wave: "saw", f0: 320, f1: 40, dur: 1.8, vol: 0.22, vib: [6, 20], lp: 1400 }); hiss({ dur: 1.4, vol: 0.18, f0: 1200, f1: 200 }); },
};
export const SFX = S;   // 開發用：測試每個音效
/** 播一個音效：sfx("jump")、sfx("land", true) */
export function sfx(name, ...args) {
  if (!ctx || vol.mute || !S[name]) return;
  try { S[name](...args); } catch {}
}
/** 對話的打字聲（給 dialog.js 用） */
export function blip(freq, type = "square") {
  if (!ctx || vol.mute) return;
  try { tone({ wave: type === "square" ? "sq50" : type === "triangle" ? "tri" : type === "sawtooth" ? "saw" : "sine", f0: freq * rnd(), dur: 0.05, vol: 0.08 }); } catch {}
}

// ================= 音樂 =================
// 一首歌：bpm、調（根音 MIDI）、音階、和弦進行（每小節一個：音階的第幾級）、主旋律（每小節 8 個八分音符：音階級數，"." 休止、"-" 延長，
// "'" 高八度、"," 低八度）、低音型、鼓（16 格：k 大鼓、s 小鼓、h 鈸、. 空）。琶音聲部用和弦音每 16 分音符輪流。
const MAJOR = [0, 2, 4, 5, 7, 9, 11], MINOR = [0, 2, 3, 5, 7, 8, 10];
const SONGS = {
  // 碎星鎮：溫暖、慢慢走的感覺（C 大調）
  town: {
    bpm: 92, root: 60, scale: MAJOR, chords: [1, 6, 4, 5, 1, 6, 2, 5],
    lead: ["3 - 5 - 6 5 3 -", "1 - 2 3 - - . .", "4 - 6 - 1' 6 5 -", "5 - 4 3 2 - . .", "3 - 5 - 6 5 3 5", "6 - 5 3 - 2 1 -", "2 - 3 4 - 6 5 4", "3 - 2 - . . . ."],
    bass: "1 . 5 . 1 . 5 .", drums: "k...h...k...h...", arp: 0.5, leadWave: "sq25", leadVol: 0.07,
  },
  // 關卡：往前冒險（A 小調），低音一直推
  stage: {
    bpm: 120, root: 57, scale: MINOR, chords: [1, 6, 3, 7, 1, 6, 7, 5],
    lead: ["5 - 1' - 7 5 4 5", "3 - - - 1 3 4 5", "5 - 3 - 5 6 7 1'", "7 - 5 - - - . .", "5 - 1' - 2' 1' 7 5", "6 - 5 4 3 - 1 -", "2 - 3 4 5 - 7 -", "#7 - - - 5 . . ."],
    bass: "1 1 5 1 8 1 5 1", drums: "k.h.s.h.k.k.s.hh", arp: 0.35, leadWave: "sq25", leadVol: 0.075,
  },
  // 王戰：快、壓迫（D 小調），低音十六分音符八度跳
  boss: {
    bpm: 152, root: 50, scale: MINOR, chords: [1, 6, 7, 5, 1, 6, 4, 5],
    lead: ["1' - 7 - 6 - 5 -", "6 - 5 - 4 - 3 -", "4 - 5 - 6 - 7 -", "#7 - - - 5 - - -", "1' 2' 3' - 2' 1' 7 -", "6 - 7 1' - 6 4 -", "4 - 6 - 1' - 6 -", "#7 - 5 - #7 - 2' -"],
    bass: "1 8 1 8 1 8 1 8", drums: "k.hsk.hsk.hsk.ss", arp: 0.45, leadWave: "sq25", leadVol: 0.08, sixteen: true,
  },
};
let song = null, step = 0, nextT = 0, timer = 0, songName = "", tempoK = 1;
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
// 音階級數字串 → 半音（相對根音）
function degree(tok, sc) {
  let s = tok, oct = 0, sharp = 0;
  if (s.startsWith("#")) { sharp = 1; s = s.slice(1); }
  while (s.endsWith("'")) { oct++; s = s.slice(0, -1); }
  while (s.endsWith(",")) { oct--; s = s.slice(0, -1); }
  const d = parseInt(s, 10) - 1;
  return sc[((d % 7) + 7) % 7] + 12 * (Math.floor(d / 7) + oct) + sharp;
}
function drum(kind, t) {
  if (kind === "k") { tone({ wave: "sine", f0: 150, f1: 42, dur: 0.12, vol: 0.5 }, musicBus, t); }
  else if (kind === "s") { hiss({ dur: 0.1, vol: 0.22, type: "bandpass", f0: 1800, q: 0.9 }, musicBus, t); tone({ wave: "tri", f0: 190, f1: 120, dur: 0.06, vol: 0.18 }, musicBus, t); }
  else if (kind === "h") hiss({ dur: 0.03, vol: 0.07, type: "highpass", f0: 7000 }, musicBus, t);
}
function schedule() {
  if (!song) return;
  const sp = 60 / (song.bpm * tempoK) / 4;   // 一個 16 分音符幾秒
  while (nextT < ctx.currentTime + 0.12) {
    const bar = Math.floor(step / 16) % song.chords.length, s16 = step % 16, t = nextT;
    const chordRoot = degree(String(song.chords[bar]), song.scale);
    // 鼓
    const dk = song.drums[s16];
    if (dk !== ".") drum(dk, t);
    // 低音（三角波）：八分音符；王戰是十六分音符
    if (song.sixteen || s16 % 2 === 0) {
      const tok = song.bass.split(" ")[Math.floor(s16 / 2) % 8];
      if (tok !== ".") tone({ wave: "tri", f0: midi(song.root - 12 + chordRoot + (tok === "5" ? 7 : tok === "8" ? 12 : 0)), dur: sp * (song.sixteen ? 0.9 : 1.8), vol: 0.22, at: 0.004 }, musicBus, t);
    }
    // 琶音（12.5% 方波）：和弦的 1、3、5 輪流
    if (song.arp) {
      const tri = [0, 2, 4][s16 % 3], n = song.root + 12 + degree(String(song.chords[bar] + tri), song.scale);
      tone({ wave: "sq12", f0: midi(n), dur: sp * 0.9, vol: 0.035 * song.arp * 2, at: 0.003 }, musicBus, t);
    }
    // 主旋律（25% 方波）：八分音符；"-" 延長上一個音
    if (s16 % 2 === 0) {
      const toks = song.lead[bar].split(" "), i = s16 / 2, tok = toks[i];
      if (tok !== "." && tok !== "-") {
        let len = 1; while (toks[i + len] === "-") len++;
        tone({ wave: song.leadWave, f0: midi(song.root + 12 + degree(tok, song.scale)), dur: sp * 2 * len * 0.92, vol: song.leadVol, at: 0.006, vib: len > 2 ? [5.5, 3] : undefined }, musicBus, t);
      }
    }
    step++;
    nextT += sp;
  }
}
/** 換背景音樂（同一首就不重來）；null＝停止 */
export function music(name) {
  if (name === songName) return;
  songName = name;
  clearInterval(timer);
  song = null;
  if (!ctx || !name || !SONGS[name]) return;
  song = SONGS[name]; step = 0; tempoK = 1; nextT = ctx.currentTime + 0.08;
  timer = setInterval(schedule, 25);
}
/** 王戰第三階段：音樂加快 */
export const tempo = (k) => { tempoK = k; };
/** 過關的小號曲（一次） */
export function jingle(kind = "clear") {
  if (!ctx) return;
  music(null);
  const t = ctx.currentTime + 0.05, notes = kind === "clear" ? [[72, 0], [76, 0.12], [79, 0.24], [84, 0.36], [79, 0.6], [84, 0.72]] : [[72, 0], [79, 0.15], [84, 0.3]];
  for (const [n, dt] of notes) tone({ wave: "sq25", f0: midi(n), dur: dt === 0.72 ? 0.7 : 0.14, vol: 0.12 }, musicBus, t + dt);
  tone({ wave: "tri", f0: midi(48), dur: 1.2, vol: 0.25 }, musicBus, t);
  tone({ wave: "tri", f0: midi(55), dur: 0.7, vol: 0.2 }, musicBus, t + 0.6);
}
