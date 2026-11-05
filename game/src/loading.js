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
  window.__loadDone = () => { box.classList.add("done"); setTimeout(() => { cancelAnimationFrame(raf); box.remove(); }, 400); };
}
