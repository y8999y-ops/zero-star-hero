// 設定畫面（企劃書 3.4）：聲音、遊戲、操作、畫面、其他。從標題和學院地圖都能打開。

import { el, show } from "../ui.js";
import { enterFullscreen } from "../fullscreen.js";
import { writeSave, resetSave } from "../save.js";
import { applySettings } from "../settings.js";
import { sfx } from "../audio.js";

export function settingsScene(game, { from = "title" } = {}) {
  const s = game.save, st = s.settings;
  const save = () => { writeSave(s); applySettings(st); };

  const toggle = (label, key, note) => el("label.set-row", {},
    el("span.set-label", {}, label, note ? el("small", {}, note) : null),
    el("input.switch", { type: "checkbox", checked: !!st[key], onchange: (e) => { st[key] = e.target.checked; save(); sfx("click"); } }));

  const choice = (label, key, options) => {
    const box = el("div.seg");
    const draw = () => box.replaceChildren(...options.map(([v, t]) =>
      el(`button.btn.small${st[key] === v ? ".on" : ""}`, { onclick: () => { st[key] = v; save(); sfx("click"); draw(); } }, t)));
    draw();
    return el("div.set-row", {}, el("span.set-label", {}, label), box);
  };

  const slider = (label, key) => {
    const val = el("span.val", {}, `${st[key]}`);
    return el("label.set-row", {}, el("span.set-label", {}, label),
      el("span.slider", {}, el("input", { type: "range", min: 0, max: 100, step: 10, value: st[key], oninput: (e) => { st[key] = Number(e.target.value); val.textContent = e.target.value; save(); }, onchange: () => sfx("click") }), val));
  };

  const group = (title, ...rows) => el("section.set-group", {}, el("h3", {}, title), ...rows);

  let clearStep = 0;
  const clearBtn = el("button.btn.red", { onclick: () => {
    if (clearStep === 0) { clearStep = 1; clearBtn.textContent = "真的要清除嗎？再按一次就會清除全部進度"; return; }
    if (!confirm("最後確認：清除後無法復原。確定清除存檔？")) { clearStep = 0; clearBtn.textContent = "清除存檔"; return; }
    game.save = resetSave();
    applySettings(game.save.settings);
    game.go("title");
  } }, "清除存檔");

  show(el("div.screen.settings", {},
    el("h2", {}, "設定"),
    group("聲音",
      slider("音樂音量", "music"),
      slider("音效音量", "sfx"),
      toggle("全部靜音", "mute")),
    group("遊戲",
      toggle("限時", "timer"),
      choice("限時寬鬆度", "timerEase", [["normal", "標準"], ["loose", "寬鬆"], ["veryloose", "很寬鬆"]]),
      choice("數學變魔法演出", "magic", [["full", "完整"], ["short", "簡短"]]),
      toggle("戰鬥文字放大", "bigText"),
      toggle("自動朗讀題目", "voice")),
    group("操作",
      toggle("左手模式", "lefty")),
    group("畫面",
      toggle("畫面晃動", "shake"),
      choice("閃光效果", "flash", [["full", "開"], ["soft", "減弱"]]),
      el("button.btn", { onclick: () => enterFullscreen() }, "進入全螢幕")),
    group("其他",
      el("button.btn", { onclick: () => game.go("opening", { replay: true, back: from }) }, "重看開場動畫"),
      s.attr ? el("button.btn", { onclick: () => game.go("resonance", { retest: true }) }, "重新做共鳴儀式") : null,
      clearBtn),
    el("p.note", {}, "iPhone：分享 →「加入主畫面」才能全螢幕"),
    el("button.btn.gold.big", { onclick: () => { sfx("click"); game.go(from); } }, "完成"),
  ));
}
