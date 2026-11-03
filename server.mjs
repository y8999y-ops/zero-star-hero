// 本機開發用的靜態伺服器：node server.mjs，然後開 http://localhost:5173/game/
// 加上 --host 可以讓同一個 Wi-Fi 下的手機連進來測試。
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { networkInterfaces } from "node:os";
import { exec } from "node:child_process";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PORT = Number(process.env.PORT) || 5173;
const HOST = process.argv.includes("--host") ? "0.0.0.0" : "127.0.0.1";
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml",
  ".woff2": "font/woff2", ".ttf": "font/ttf", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav",
};

createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    // 網址要真的跳到 /game/，不然頁面裡的相對路徑（src/main.js）會找不到
    if (path === "/" || path === "/game") { res.writeHead(302, { Location: "/game/" }); return res.end(); }
    let file = normalize(join(ROOT, path));
    if (!file.startsWith(normalize(ROOT))) throw new Error("outside root");
    if ((await stat(file)).isDirectory()) file = join(file, "index.html");
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream", "Cache-Control": "no-store" });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("404");
  }
}).on("error", (e) => {
  // 已經有一個伺服器在跑：直接開遊戲就好
  if (e.code !== "EADDRINUSE") throw e;
  console.log(`伺服器已經在執行了：http://localhost:${PORT}/game/`);
  openBrowser();
  setTimeout(() => process.exit(0), 1500);
}).listen(PORT, HOST, () => {
  console.log(`遊戲：http://localhost:${PORT}/game/`);
  if (HOST === "0.0.0.0")
    for (const list of Object.values(networkInterfaces()))
      for (const n of list ?? []) if (n.family === "IPv4" && !n.internal) console.log(`手機：http://${n.address}:${PORT}/game/`);
  console.log("玩完關掉這個視窗就好。");
  openBrowser();
});

// --open：伺服器開好後自動用預設瀏覽器打開遊戲（開始遊戲.bat 用）
function openBrowser() {
  if (!process.argv.includes("--open")) return;
  const url = `http://localhost:${PORT}/game/`;
  const cmd = process.platform === "win32" ? `start "" "${url}"` : process.platform === "darwin" ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd);
}
