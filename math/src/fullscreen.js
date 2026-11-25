// 自動全螢幕：跟《轉生成星星碎片的我》同一套做法（使用者 2026-11-25「跟另外一個遊戲全螢幕的效果不一樣」）
//   ・只在手機、平板（觸控螢幕）自動做；電腦不硬開
//   ・要在手指「放開」（pointerup）的時候呼叫：手機瀏覽器不把按下（pointerdown）當成「玩家點了」，在 pointerdown 開會失敗
//   ・進全螢幕後鎖橫向
//   ・切到後台再回來，瀏覽器會退出全螢幕（而且一定要點一下才能再進去）→ 蓋一層「點一下回到全螢幕」
//   ・直的拿著時蓋一層「轉成橫向」，點一下就進全螢幕＋鎖橫向
// iPhone 的 Safari 不支援網頁全螢幕：要「加入主畫面」再從主畫面打開（manifest.json 設定成全螢幕、橫的）。

const touchy = matchMedia("(pointer: coarse)").matches;
export function isFullscreen() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }

export function enterFullscreen() {
  if (isFullscreen()) return;
  const el = document.documentElement;
  const done = () => { try { screen.orientation?.lock?.("landscape")?.catch?.(() => {}); } catch {} };
  try {
    if (el.requestFullscreen) el.requestFullscreen({ navigationUI: "hide" }).then(done).catch(() => {});
    else if (el.webkitRequestFullscreen) { el.webkitRequestFullscreen(); done(); }
  } catch {}
}

export function autoFullscreen() {
  if (!touchy) return;
  // 第一次點畫面（任何地方）就進全螢幕
  addEventListener("pointerup", function first() { removeEventListener("pointerup", first, true); enterFullscreen(); }, true);
  // 直的拿著：「轉成橫向」那層點一下也進全螢幕
  document.querySelector(".rotate")?.addEventListener("pointerup", (e) => { e.preventDefault(); enterFullscreen(); });
  // 切到後台再回來：原本是全螢幕、現在不是了 → 請玩家點一下
  const refull = document.createElement("div");
  refull.className = "refull";
  refull.innerHTML = '<div class="tap">點一下回到全螢幕</div><div class="no">不用了</div>';
  document.body.append(refull);
  let wantFull = false;
  const check = () => refull.classList.toggle("on", wantFull && !isFullscreen() && document.visibilityState === "visible");
  const onChange = () => { if (isFullscreen()) wantFull = true; setTimeout(check, 300); };
  document.addEventListener("fullscreenchange", onChange);
  document.addEventListener("webkitfullscreenchange", onChange);
  document.addEventListener("visibilitychange", () => setTimeout(check, 300));
  refull.addEventListener("pointerdown", (e) => e.preventDefault());
  refull.addEventListener("pointerup", (e) => {
    e.preventDefault(); refull.classList.remove("on");
    if (e.target.closest(".no")) { wantFull = false; return; }
    enterFullscreen();
  });
}
