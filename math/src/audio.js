// 音效：瀏覽器內建的合成器做的短音（不用下載檔案）。每個音效是幾段「音」疊起來：
//   tone 純音（可以滑音）、noise 沙沙聲（可以濾波掃過去）。
// 第一批（批次 4）：五屬性施法、答對、答錯、連擊升級、王登場、封印碎裂、恢復色彩，以及介面、走路、對話。
// 網址加 ?mute 或設定關閉聲音就不出聲。

let ctx = null, on = !new URLSearchParams(location.search).has("mute");
export const setSound = (v) => { on = v && !new URLSearchParams(location.search).has("mute"); };
let vol = 0.8;
export const setVolume = (v) => { vol = Math.max(0, Math.min(1, v)); };

let noiseBuf = null;
function noise() {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; return s;
}

/** 一段音。o：{ at 開始(秒), d 長度, f 頻率, f2 滑到, type, g 音量, a 起音, noise, filt, q, f2filt } */
function voice(t0, o) {
  const t = t0 + (o.at ?? 0), d = o.d ?? 0.1, g = ctx.createGain(), peak = (o.g ?? 0.15) * vol + 0.0001;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + (o.a ?? 0.005));
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  let src, out = g;
  if (o.noise) {
    src = noise();
    const f = ctx.createBiquadFilter(); f.type = o.noise; f.Q.value = o.q ?? 1;
    f.frequency.setValueAtTime(o.filt ?? 2000, t);
    if (o.f2filt) f.frequency.exponentialRampToValueAtTime(o.f2filt, t + d);
    src.connect(f).connect(g);
  } else {
    src = ctx.createOscillator(); src.type = o.type ?? "triangle";
    src.frequency.setValueAtTime(o.f, t);
    if (o.f2) src.frequency.exponentialRampToValueAtTime(o.f2, t + d);
    if (o.vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = o.vib[0]; lg.gain.value = o.vib[1]; l.connect(lg).connect(src.frequency); l.start(t); l.stop(t + d); }
    src.connect(g);
  }
  out.connect(ctx.destination);
  src.start(t); src.stop(t + d + 0.02);
}

const arp = (notes, step, o = {}) => notes.map((f, i) => ({ at: i * step, f, d: o.d ?? step * 2, type: o.type ?? "triangle", g: o.g ?? 0.12 }));

const SFX = {
  // 五屬性施法
  cast_fire: [{ noise: "lowpass", filt: 400, f2filt: 3000, d: 0.35, g: 0.22, a: 0.04 }, { f: 220, f2: 660, d: 0.25, type: "sawtooth", g: 0.05 }],
  cast_water: [{ f: 300, f2: 900, d: 0.18, type: "sine", g: 0.16, vib: [18, 60] }, { at: 0.12, f: 500, f2: 1200, d: 0.16, type: "sine", g: 0.12, vib: [22, 80] }, { noise: "bandpass", filt: 900, f2filt: 2400, q: 3, d: 0.3, g: 0.08 }],
  cast_ice: [...arp([1568, 2093, 2637, 3136], 0.05, { type: "sine", g: 0.09, d: 0.3 }), { noise: "highpass", filt: 6000, d: 0.25, g: 0.05 }],
  cast_forest: [...arp([523, 659, 784, 1046], 0.06, { type: "triangle", g: 0.11, d: 0.22 }), { noise: "bandpass", filt: 1800, q: 2, d: 0.3, g: 0.05, a: 0.08 }],
  cast_thunder: [{ noise: "highpass", filt: 1500, d: 0.08, g: 0.25 }, { at: 0.06, f: 880, f2: 110, d: 0.22, type: "sawtooth", g: 0.08 }, { at: 0.05, noise: "lowpass", filt: 600, d: 0.35, g: 0.2 }],
  cast: [{ f: 660, d: 0.06 }, { at: 0.05, f: 880, d: 0.08 }],
  // 打中、答對、答錯
  hit: [{ noise: "lowpass", filt: 1200, f2filt: 200, d: 0.16, g: 0.25 }, { f: 180, f2: 70, d: 0.14, type: "square", g: 0.08 }],
  good: arp([523, 659, 784], 0.07, { d: 0.18 }),
  hurt: [{ f: 220, f2: 90, d: 0.28, type: "sawtooth", g: 0.1 }, { noise: "lowpass", filt: 500, d: 0.2, g: 0.15 }],
  combo: arp([784, 988, 1175, 1568], 0.045, { type: "square", g: 0.06, d: 0.12 }),
  level: arp([523, 659, 784, 1046], 0.1, { d: 0.25 }),
  tick: [{ f: 520, d: 0.05 }],
  // 王登場：低沉的轟一聲＋不安的和弦
  boss: [{ f: 55, f2: 40, d: 1.0, type: "sawtooth", g: 0.12, a: 0.1 }, { noise: "lowpass", filt: 200, d: 0.9, g: 0.25, a: 0.05 }, { at: 0.35, f: 233, d: 0.6, type: "triangle", g: 0.08 }, { at: 0.35, f: 247, d: 0.6, type: "triangle", g: 0.08 }],
  // 封印碎裂：玻璃碎掉
  shatter: [{ noise: "highpass", filt: 3000, d: 0.5, g: 0.22 }, ...[2400, 3100, 2700, 3600, 2200].map((f, i) => ({ at: i * 0.04, f, d: 0.25, type: "sine", g: 0.06 }))],
  // 恢復色彩：一串往上的亮晶晶
  restore: [...arp([523, 659, 784, 1046, 1318, 1568, 2093], 0.08, { type: "sine", g: 0.1, d: 0.4 }), { noise: "highpass", filt: 7000, d: 1.0, g: 0.04, a: 0.3 }],
  // 轉場：魔法咻一聲
  whoosh: [{ noise: "bandpass", filt: 300, f2filt: 4000, q: 1.5, d: 0.5, g: 0.18, a: 0.15 }],
  // 介面、地圖
  click: [{ f: 700, d: 0.03 }],
  step: [{ noise: "lowpass", filt: 700, d: 0.05, g: 0.05 }],
  blip: [{ f: 880, d: 0.025, type: "square", g: 0.025 }],
};

export function sfx(name) {
  if (!on || vol <= 0) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") ctx.resume();
    const t = ctx.currentTime + 0.01;
    for (const o of SFX[name] ?? []) voice(t, o);
  } catch {}
}
