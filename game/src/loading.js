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
  // 使用者 2026-11-06：踩進傳送門之後，通關播報在這裡播（後面同時在載入城鎮）。
  //   樣子跟遊戲裡的系統框一樣（SYSTEM // 系統、全像掃描線），一行一行、一個字一個字打出來；打完再停 1.2 秒，點一下可以跳過
  let minUntil = 0, ready = false, closed = false;
  const close = () => { if (closed) return; closed = true; box.classList.add("done"); setTimeout(() => { cancelAnimationFrame(raf); box.remove(); }, 400); };
  try {
    const rep = JSON.parse(sessionStorage.getItem("zero-hero-clear") || "null");
    sessionStorage.removeItem("zero-hero-clear");
    if (rep) {
      import("./ui-art.js").then((m) => m.installSysPanel()).catch(() => {});
      const el = document.createElement("div");
      el.className = "crSys";
      el.innerHTML = `<div class="sysHead">SYSTEM // 系統</div><div class="crText"></div>`;
      box.appendChild(el);
      box.classList.add("rep");
      const lines = [
        `${rep.chapter ? "第一章　完。" : "通關！"}${rep.stage}`,
        `時間 ${rep.time}　擊倒 ${rep.kills}　最高連擊 ${rep.best}　${rep.deaths ? "死了 " + rep.deaths + " 次" : "一次都沒死"}`,
        rep.say,
      ];
      // 使用者 2026-11-06「結算介面順順的打字就好」：原本用 setTimeout 一個字一個字塞，後面在載入城鎮時主執行緒很忙，字會卡一下衝一下，
      //   框也跟著字變寬。改成整段字一開始就排好（框大小固定），用「外框往右滑、裡面的字反方向滑」的遮罩一格一格露出來——
      //   只動 transform，瀏覽器在合成層跑，主執行緒再忙也照樣順
      const out = el.querySelector(".crText"), CH = 0.04;   // 每個字 40ms
      let at = 0.25;
      out.innerHTML = lines.map((l) => {
        const n = [...l].length, d = n * CH, html = `<div class="crLine" style="--n:${n};--d:${d}s;--at:${at}s"><span>${l}</span></div>`;
        at += d + 0.12;
        return html;
      }).join("");
      minUntil = performance.now() + (at + 1.2) * 1000;
      box.addEventListener("pointerdown", () => { el.classList.add("skip"); minUntil = 0; if (ready) close(); });    }
  } catch {}
  window.__loadDone = () => { ready = true; const wait = minUntil - performance.now(); if (wait > 0) setTimeout(close, wait); else close(); };
}
