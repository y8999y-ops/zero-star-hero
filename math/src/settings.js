// 遊戲設定（企劃書 3.4）：預設值、套用到畫面與聲音。
// 存在存檔的 settings 裡；舊存檔少了的欄位會用預設值補上。

import { setSound, setVolume } from "./audio.js";
import { setMusic } from "./music.js";

export const DEFAULT_SETTINGS = {
  // 聲音
  music: 70, sfx: 80, mute: false,
  // 遊戲
  timer: true,              // 限時（三年級以上）
  timerEase: "normal",      // normal 標準、loose 寬鬆、veryloose 很寬鬆
  magic: "full",            // 數學變魔法演出：full 完整、short 簡短
  bigText: false,           // 戰鬥文字放大
  voice: false,             // 自動朗讀題目（瀏覽器內建語音）
  // 操作
  lefty: false,             // 左手模式：答案按鈕左右鏡像
  // 畫面
  shake: true,              // 畫面晃動
  flash: "full",            // full 閃光、soft 減弱
};

export const TIMER_EASE = { normal: 1, loose: 1.3, veryloose: 1.6 };

export function withDefaults(s) {
  const out = { ...DEFAULT_SETTINGS, ...(s ?? {}) };
  if (s && "sound" in s && !("mute" in s)) out.mute = !s.sound;   // 舊版只有「音效開關」
  delete out.sound;
  return out;
}

/** 套用到整個遊戲：聲音、文字大小、左手模式 */
export function applySettings(st) {
  setSound(!st.mute);
  setVolume(st.sfx / 100);
  setMusic(st.music / 100, st.mute);
  const app = document.querySelector("#app");
  app.classList.toggle("bigtext", !!st.bigText);
  app.classList.toggle("lefty", !!st.lefty);
}
