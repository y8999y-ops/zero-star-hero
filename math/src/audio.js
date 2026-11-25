// 暫用音效：瀏覽器內建合成的短音（M3 再用 sfx-select 挑正式音效替換）。
// 網址加 ?mute 或設定關閉聲音就不出聲。

let ctx = null, on = !new URLSearchParams(location.search).has("mute");
export const setSound = (v) => { on = v && !new URLSearchParams(location.search).has("mute"); };

const NOTES = {
  cast: [[660, 0.06], [880, 0.08]],
  hit: [[220, 0.08, "square"]],
  hurt: [[180, 0.12, "sawtooth"], [120, 0.14, "sawtooth"]],
  tick: [[520, 0.05]],
  good: [[523, 0.08], [659, 0.08], [784, 0.14]],
  level: [[523, 0.1], [659, 0.1], [784, 0.1], [1046, 0.24]],
  click: [[700, 0.03]],
};

export function sfx(name) {
  if (!on) return;
  try {
    ctx ??= new AudioContext();
    let t = ctx.currentTime;
    for (const [f, d, type = "triangle"] of NOTES[name] ?? []) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
      o.connect(g).connect(ctx.destination);
      o.start(t); o.stop(t + d);
      t += d * 0.9;
    }
  } catch {}
}
