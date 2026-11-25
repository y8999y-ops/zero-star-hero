// 自動全螢幕（使用者 2026-11-25「進入遊戲要自動全螢幕」）。
// 瀏覽器規定一定要在玩家點畫面的那一下才能進全螢幕，所以：開遊戲後第一次點畫面就進全螢幕、鎖成橫的。
// iPhone 的 Safari 不支援網頁全螢幕：要「加入主畫面」再從主畫面打開（manifest.json 設定成全螢幕、橫的）。

export function isFullscreen() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }

export async function enterFullscreen() {
  if (isFullscreen()) return;
  const el = document.documentElement;
  try {
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: "hide" });
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  } catch {}
  try { await screen.orientation?.lock?.("landscape"); } catch {}
}

/** 第一次點畫面時進全螢幕（之後玩家自己退出就不再硬拉回去） */
export function autoFullscreen() {
  const once = () => { window.removeEventListener("pointerdown", once, true); enterFullscreen(); };
  window.addEventListener("pointerdown", once, true);
}
