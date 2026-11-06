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
      const out = el.querySelector(".crText");
      let li = 0, ci = 0, cur = null;
      minUntil = performance.now() + 60000;   // 打完字之前不關
      const step = () => {
        if (li >= lines.length) { el.classList.remove("typing"); minUntil = performance.now() + 1200; if (ready) setTimeout(close, 1200); return; }
        if (!cur) { cur = document.createElement("div"); out.appendChild(cur); el.classList.add("typing"); }
        cur.textContent = lines[li].slice(0, ++ci);
        if (ci >= lines[li].length) { li++; ci = 0; cur = null; setTimeout(step, 260); } else setTimeout(step, 34);
      };
      setTimeout(step, 250);
      box.addEventListener("pointerdown", () => { li = lines.length; out.innerHTML = lines.map((l) => `<div>${l}</div>`).join(""); minUntil = 0; if (ready) close(); });
    }
  } catch {}
  window.__loadDone = () => { ready = true; const wait = minUntil - performance.now(); if (wait > 0) setTimeout(close, wait); else close(); };
}
