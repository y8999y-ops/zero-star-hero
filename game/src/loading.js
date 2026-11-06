// 載入畫面：換場景（重新載入頁面）或第一次打開時，main.js 還在下載、烘焙動畫的這段時間顯示蹦蹦跳的小星星。
// main.js 載完呼叫 window.__loadDone() 淡掉。圖在 loading-art.js。
import { drawLoading, W, H } from "./loading-art.js";
const box = document.getElementById("loading"), cv = document.getElementById("loadCv");
if (box && cv) {
  cv.width = W; cv.height = H;
  const g = cv.getContext("2d"), t0 = performance.now();
  let raf = 0;
  const tick = () => {
    g.clearRect(0, 0, W, H);
    drawLoading((x, y, c, a = 1) => { g.globalAlpha = a; g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), 1, 1); }, (performance.now() - t0) / 1000);
    g.globalAlpha = 1;
    raf = requestAnimationFrame(tick);
  };
  tick();
  // 使用者 2026-11-06：踩進傳送門之後，通關播報在這裡播（後面同時在載入城鎮）；至少播 3.6 秒，點一下可以跳過
  let minUntil = 0, ready = false, closed = false;
  const close = () => { if (closed) return; closed = true; box.classList.add("done"); setTimeout(() => { cancelAnimationFrame(raf); box.remove(); }, 400); };
  try {
    const rep = JSON.parse(sessionStorage.getItem("zero-hero-clear") || "null");
    sessionStorage.removeItem("zero-hero-clear");
    if (rep) {
      const el = document.createElement("div");
      el.className = "clearRep";
      el.innerHTML = `<div class="cr-ttl">${rep.chapter ? "第一章　完" : "通關！"}</div><div class="cr-stage">${rep.stage}</div>
        <div class="cr-rows"><span>時間<b>${rep.time}</b></span><span>擊倒<b>${rep.kills}</b></span><span>最高連擊<b>${rep.best}</b></span><span>${rep.deaths ? "死亡" : "沒死過"}<b>${rep.deaths ? rep.deaths + " 次" : "★"}</b></span></div>
        <div class="cr-say"><em>系統</em>${rep.say}</div>`;
      box.appendChild(el);
      box.classList.add("rep");
      minUntil = performance.now() + 3600;
      box.addEventListener("pointerdown", () => { minUntil = 0; if (ready) close(); });
    }
  } catch {}
  window.__loadDone = () => { ready = true; const wait = minUntil - performance.now(); if (wait > 0) setTimeout(close, wait); else close(); };
}
